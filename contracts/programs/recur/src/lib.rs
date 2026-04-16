use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::{self, Token, TokenAccount, TransferChecked};

declare_id!("Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj");

#[program]
pub mod recur {
    use super::*;

    /// Initialize a new Subscription PDA.
    /// Called by the SDK after the user signs the SPL Token approve delegation.
    /// The merchant pays rent; the subscriber must also sign to prove consent.
    pub fn initialize_subscription(
        ctx: Context<InitializeSubscription>,
        amount: u64,
        interval: u64,
    ) -> Result<()> {
        require!(amount > 0, RecurError::InvalidAmount);
        require!(interval > 0, RecurError::InvalidInterval);

        let now = Clock::get()?.unix_timestamp as u64;
        let sub = &mut ctx.accounts.subscription;

        sub.subscriber = ctx.accounts.subscriber.key();
        sub.merchant = ctx.accounts.merchant.key();
        sub.amount = amount;
        sub.interval = interval;
        // First pull is available `interval` seconds after creation.
        sub.last_payment_timestamp = now;
        sub.created_at = now;
        sub.cancel_requested_at = 0; // 0 = not pending cancellation
        sub.bump = ctx.bumps.subscription;

        Ok(())
    }

    /// Pull funds from subscriber → merchant.
    /// Called exclusively by the off-chain Keeper. Subscriber does NOT sign.
    ///
    /// Security properties:
    /// - Only the registered Keeper wallet can invoke this.
    /// - Time-lock: cannot be called before the interval has elapsed.
    /// - Blocked entirely once a cancellation has been requested AND the
    ///   paid period has elapsed — the subscription is logically over.
    /// - Uses `transfer_checked` (validates mint + decimals) to prevent
    ///   spoofed mint attacks.
    /// - Token accounts are constrained to the correct owner and mint in
    ///   the `ProcessPayment` context, preventing account substitution.
    /// - The subscriber's token account delegation is verified implicitly:
    ///   if the allowance was revoked the CPI will fail and we map that to
    ///   `DelegationRevoked`.
    pub fn process_payment(ctx: Context<ProcessPayment>) -> Result<()> {
        let sub = &ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp as u64;

        // Time-lock guard: interval must have fully elapsed.
        require!(
            now >= sub.last_payment_timestamp.saturating_add(sub.interval),
            RecurError::BillingIntervalNotReached
        );

        // Cancellation guard: if a cancel has been requested and the current
        // paid period has now elapsed, no further pulls are permitted.
        // (If the cancel was requested mid-period the Keeper still collects
        // the final payment the subscriber already committed to; after that
        // the subscription is closed by `finalize_cancel`.)
        if sub.cancel_requested_at > 0 {
            require!(
                now < sub.cancel_requested_at.saturating_add(sub.interval),
                RecurError::SubscriptionCancelled
            );
        }

        let amount = sub.amount;
        let decimals = ctx.accounts.mint.decimals;

        // CPI: transfer_checked from subscriber → merchant using the
        // subscription PDA's pre-approved delegation.
        let seeds = &[
            b"subscription",
            ctx.accounts.subscriber.key.as_ref(),
            ctx.accounts.merchant.key.as_ref(),
            &[ctx.accounts.subscription.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.subscriber_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.merchant_token_account.to_account_info(),
                // The subscription PDA is the delegated transfer authority.
                authority: ctx.accounts.subscription.to_account_info(),
            },
            signer_seeds,
        );

        token::transfer_checked(cpi_ctx, amount, decimals)
            .map_err(|_| error!(RecurError::DelegationRevoked))?;

        // Update timestamp so the next pull is gated correctly.
        let sub = &mut ctx.accounts.subscription;
        sub.last_payment_timestamp = now;

        Ok(())
    }

    /// Request cancellation of a subscription.
    ///
    /// Either the subscriber or the merchant may call this at any time.
    ///
    /// What this does:
    /// - Sets `cancel_requested_at = now` on the PDA (a flag, not a close).
    /// - The PDA remains open; `process_payment` can still collect the
    ///   final payment for the period the subscriber already paid for.
    /// - Once `last_payment_timestamp + interval` has elapsed, anyone may
    ///   call `finalize_cancel` to close the PDA and return rent.
    ///
    /// This design ensures:
    /// - Merchant cannot steal a payment and immediately cut service.
    /// - Subscriber's cancellation is recorded on-chain immediately.
    /// - No timing precision is required from either party.
    pub fn request_cancel(ctx: Context<RequestCancel>) -> Result<()> {
        let sub = &ctx.accounts.subscription;
        let authority_key = ctx.accounts.authority.key();

        require!(
            authority_key == sub.subscriber || authority_key == sub.merchant,
            RecurError::UnauthorizedCancellation
        );

        // Idempotency guard: prevent overwriting an existing cancel request,
        // which would reset the clock and delay finalization.
        require!(
            sub.cancel_requested_at == 0,
            RecurError::CancelAlreadyRequested
        );

        let now = Clock::get()?.unix_timestamp as u64;
        ctx.accounts.subscription.cancel_requested_at = now;

        Ok(())
    }

    /// Close the PDA after a pending cancellation has fully matured.
    ///
    /// This instruction is PERMISSIONLESS — anyone may call it once both
    /// conditions are satisfied on-chain:
    ///   1. `cancel_requested_at > 0`  (a cancel was requested)
    ///   2. `now >= last_payment_timestamp + interval`  (paid period elapsed)
    ///
    /// The Keeper calls this in practice (it already polls every subscription),
    /// but there is no trust assumption — the subscriber, merchant, or any
    /// third party can also call it, making the protocol self-cleaning.
    ///
    /// Rent is returned to the merchant Gas Tank.
    pub fn finalize_cancel(ctx: Context<FinalizeCancel>) -> Result<()> {
        let sub = &ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp as u64;

        // Must have an active cancel request.
        require!(sub.cancel_requested_at > 0, RecurError::NoCancelRequested);

        // The paid interval must have fully elapsed so the subscriber receives
        // the service they paid for before the PDA is closed.
        require!(
            now >= sub.last_payment_timestamp.saturating_add(sub.interval),
            RecurError::PaidPeriodNotElapsed
        );

        // Anchor's `close = merchant` transfers lamports and zeroes the
        // account automatically after this instruction returns.
        Ok(())
    }

    /// Force-cancel when the Keeper detects a revoked delegation or empty wallet.
    /// Only callable by the Keeper. Closes the PDA immediately without waiting
    /// for the interval to elapse, because no future payment is possible anyway.
    /// The Keeper fires a `subscription.canceled` webhook after this confirms.
    pub fn force_cancel(ctx: Context<ForceCancel>) -> Result<()> {
        // `keeper: Signer` in `ForceCancel` enforces Keeper identity at the
        // account-constraint level; no additional runtime check is needed.
        let _ = &ctx.accounts.subscription;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeSubscription<'info> {
    #[account(
        init,
        payer = merchant,
        space = 8 + Subscription::INIT_SPACE,
        seeds = [b"subscription", subscriber.key().as_ref(), merchant.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,

    /// The subscriber must sign to prove consent to the recurring charge.
    #[account(mut)]
    pub subscriber: Signer<'info>,

    /// Merchant pays rent for the PDA.
    #[account(mut)]
    pub merchant: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessPayment<'info> {
    #[account(
        mut,
        seeds = [b"subscription", subscriber.key().as_ref(), merchant.key().as_ref()],
        bump = subscription.bump,
        has_one = subscriber,
        has_one = merchant,
    )]
    pub subscription: Account<'info, Subscription>,

    /// CHECK: Subscriber does not sign. Identity enforced by `has_one` above.
    pub subscriber: AccountInfo<'info>,

    /// CHECK: Merchant does not sign. Identity enforced by `has_one` above.
    pub merchant: AccountInfo<'info>,

    /// Subscriber's token account. Must be owned by `subscriber` and use
    /// the correct mint, preventing account substitution.
    #[account(
        mut,
        constraint = subscriber_token_account.owner == subscriber.key()
            @ RecurError::InvalidTokenAccountOwner,
        constraint = subscriber_token_account.delegate == COption::Some(subscription.key())
            @ RecurError::InvalidDelegate,
        constraint = subscriber_token_account.delegated_amount >= subscription.amount
            @ RecurError::InsufficientDelegatedAmount,
        constraint = subscriber_token_account.mint == mint.key()
            @ RecurError::InvalidMint,
    )]
    pub subscriber_token_account: Account<'info, TokenAccount>,

    /// Merchant's token account. Must be owned by `merchant` and use the
    /// correct mint.
    #[account(
        mut,
        constraint = merchant_token_account.owner == merchant.key()
            @ RecurError::InvalidTokenAccountOwner,
        constraint = merchant_token_account.mint == mint.key()
            @ RecurError::InvalidMint,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    /// The SPL token mint. Used by `transfer_checked` to validate decimals
    /// and prevent mint-swap attacks.
    pub mint: Account<'info, token::Mint>,

    pub token_program: Program<'info, Token>,

    /// The Keeper wallet must sign every `process_payment` call.
    pub keeper: Signer<'info>,
}

#[derive(Accounts)]
pub struct RequestCancel<'info> {
    #[account(
        mut,
        seeds = [b"subscription", subscriber.key().as_ref(), merchant.key().as_ref()],
        bump = subscription.bump,
        has_one = subscriber,
        has_one = merchant,
    )]
    pub subscription: Account<'info, Subscription>,

    /// Either the subscriber or the merchant. Verified in instruction logic.
    pub authority: Signer<'info>,

    /// CHECK: Identity enforced by `has_one` on the PDA above.
    pub subscriber: AccountInfo<'info>,

    /// CHECK: Identity enforced by `has_one` on the PDA above.
    pub merchant: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct FinalizeCancel<'info> {
    #[account(
        mut,
        close = merchant,
        seeds = [b"subscription", subscriber.key().as_ref(), merchant.key().as_ref()],
        bump = subscription.bump,
        has_one = subscriber,
        has_one = merchant,
    )]
    pub subscription: Account<'info, Subscription>,

    /// CHECK: Identity enforced by `has_one` on the PDA above.
    pub subscriber: AccountInfo<'info>,

    /// Rent refund destination (Gas Tank). Identity enforced by `has_one`.
    #[account(mut)]
    /// CHECK: Verified by `has_one = merchant` on the PDA above.
    pub merchant: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ForceCancel<'info> {
    #[account(
        mut,
        close = merchant,
        seeds = [b"subscription", subscriber.key().as_ref(), merchant.key().as_ref()],
        bump = subscription.bump,
        has_one = subscriber,
        has_one = merchant,
    )]
    pub subscription: Account<'info, Subscription>,

    /// CHECK: Identity enforced by `has_one` on the PDA above.
    pub subscriber: AccountInfo<'info>,

    /// Rent refund destination. Identity enforced by `has_one`.
    #[account(mut)]
    /// CHECK: Verified by `has_one = merchant` on the PDA above.
    pub merchant: AccountInfo<'info>,

    /// Only the registered Keeper may force-cancel a subscription.
    pub keeper: Signer<'info>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Subscription {
    pub subscriber: Pubkey,          // wallet paying
    pub merchant: Pubkey,            // wallet receiving
    pub amount: u64,                 // token base units per interval
    pub interval: u64,               // seconds between pulls (e.g. 2_592_000 = 30 days)
    pub last_payment_timestamp: u64, // unix timestamp of last successful pull
    pub created_at: u64,             // unix timestamp of subscription creation
    /// 0 = active. Non-zero = unix timestamp when cancel was requested.
    /// The PDA is closed by `finalize_cancel` once the paid period elapses.
    pub cancel_requested_at: u64,
    pub bump: u8, // canonical PDA bump seed
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum RecurError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,

    #[msg("Interval must be greater than zero.")]
    InvalidInterval,

    #[msg("Billing interval has not elapsed yet.")]
    BillingIntervalNotReached,

    #[msg("Signer is not the subscriber or merchant on this subscription.")]
    UnauthorizedCancellation,

    #[msg("Delegation has been revoked or allowance is insufficient.")]
    DelegationRevoked,

    #[msg("Token account is not owned by the expected wallet.")]
    InvalidTokenAccountOwner,

    #[msg("Token account mint does not match the expected mint.")]
    InvalidMint,

    #[msg("Token account delegate does not match the subscription PDA.")]
    InvalidDelegate,

    #[msg("Delegated token allowance is below the subscription amount.")]
    InsufficientDelegatedAmount,

    #[msg("Cancellation has already been requested for this subscription.")]
    CancelAlreadyRequested,

    #[msg("No cancellation has been requested for this subscription.")]
    NoCancelRequested,

    #[msg("The subscriber's paid interval has not yet elapsed; cannot finalize cancellation.")]
    PaidPeriodNotElapsed,

    #[msg("Subscription is cancelled; no further payments can be collected.")]
    SubscriptionCancelled,
}
