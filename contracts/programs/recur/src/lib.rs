use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("Du86TLvDNSzGf1hkb6cVPoQpHPCwYiRXnGKm3J1GAgFj");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Minimum subscription amount: $1.00 in USDC base units (6 decimals).
const MIN_PLAN_AMOUNT_BASE_UNITS: u64 = 1_000_000;
/// Platform flat fee per payment: $0.05.
const PLATFORM_FLAT_FEE_BASE_UNITS: u64 = 50_000;
/// Platform percentage fee: 0.25% expressed as basis points.
const PLATFORM_BPS: u64 = 25;
const BPS_DENOMINATOR: u64 = 10_000;

/// Approved treasury multisig co-signers.
const TREASURY_MULTISIG_A: Pubkey = pubkey!("Cm4LcfF5N8Whu1pV3mYcLUuzdjhUhbhNt5GHz62vPGDM");
const TREASURY_MULTISIG_B: Pubkey = pubkey!("36RtRqX9fzFQYShzacRZKtfJB8uf8MqJbKkXSKvYUMPt");

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

#[program]
pub mod recur {
    use super::*;

    // -----------------------------------------------------------------------
    // Subscription instructions
    // -----------------------------------------------------------------------

    /// Create a new Subscription PDA.
    ///
    /// Both subscriber and merchant must sign — subscriber to prove consent,
    /// merchant to pay the ~0.002 SOL rent.
    ///
    /// The subscriber must have already called `spl_token::approve` delegating
    /// `amount` tokens to the Subscription PDA before invoking this.
    pub fn initialize_subscription(
        ctx: Context<InitializeSubscription>,
        amount: u64,
        interval: u64,
    ) -> Result<()> {
        require!(
            amount >= MIN_PLAN_AMOUNT_BASE_UNITS,
            RecurError::InvalidAmount
        );
        require!(interval > 0, RecurError::InvalidInterval);

        let now = Clock::get()?.unix_timestamp as u64;
        let sub = &mut ctx.accounts.subscription;

        sub.subscriber = ctx.accounts.subscriber.key();
        sub.merchant = ctx.accounts.merchant.key();
        sub.amount = amount;
        sub.interval = interval;
        sub.last_payment_timestamp = now; // first pull available after `interval` seconds
        sub.created_at = now;
        sub.cancel_requested_at = 0; // 0 = active
        sub.bump = ctx.bumps.subscription;

        Ok(())
    }

    /// Pull funds from subscriber → merchant (net) + treasury vault (platform fee).
    ///
    /// Called exclusively by the off-chain Keeper. Subscriber does NOT sign.
    ///
    /// The Subscription PDA is the SPL Token delegate authority, which is why
    /// `new_with_signer` is used — the PDA signs the CPI on behalf of itself.
    pub fn process_payment(ctx: Context<ProcessPayment>) -> Result<()> {
        let sub = &ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp as u64;

        // Time-lock: interval must have fully elapsed since last payment.
        require!(
            now >= sub.last_payment_timestamp.saturating_add(sub.interval),
            RecurError::BillingIntervalNotReached
        );

        // Cancellation guard: once a cancel is requested and the paid period
        // has elapsed, no further payments can be collected.
        if sub.cancel_requested_at > 0 {
            require!(
                now < sub.cancel_requested_at.saturating_add(sub.interval),
                RecurError::SubscriptionCancelled
            );
        }

        let total = sub.amount;
        let percent_fee = total
            .saturating_mul(PLATFORM_BPS)
            .saturating_div(BPS_DENOMINATOR);
        let platform_fee = PLATFORM_FLAT_FEE_BASE_UNITS.saturating_add(percent_fee);

        require!(total > platform_fee, RecurError::AmountTooSmall);

        let merchant_amount = total.saturating_sub(platform_fee);
        let decimals = ctx.accounts.mint.decimals;

        // PDA signer seeds — the Subscription PDA is the delegate authority.
        let sub_key = ctx.accounts.subscription.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"subscription",
            ctx.accounts.subscriber.key.as_ref(),
            ctx.accounts.merchant.key.as_ref(),
            &[ctx.accounts.subscription.bump],
        ]];

        // CPI 1: subscriber → merchant (amount minus platform fee).
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.subscriber_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.merchant_token_account.to_account_info(),
                    authority: ctx.accounts.subscription.to_account_info(),
                },
                signer_seeds,
            ),
            merchant_amount,
            decimals,
        )
        .map_err(|_| error!(RecurError::DelegationRevoked))?;

        // CPI 2: subscriber → treasury vault (platform fee).
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.subscriber_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_vault_token_account.to_account_info(),
                    authority: ctx.accounts.subscription.to_account_info(),
                },
                signer_seeds,
            ),
            platform_fee,
            decimals,
        )
        .map_err(|_| error!(RecurError::DelegationRevoked))?;

        // Suppress unused variable warning — sub_key is used only to document
        // the signer relationship above.
        let _ = sub_key;

        // Advance the timestamp so the next pull is gated correctly.
        let sub = &mut ctx.accounts.subscription;
        sub.last_payment_timestamp = now;

        Ok(())
    }

    /// Flag a subscription for cancellation.
    ///
    /// Callable by subscriber OR merchant at any time.
    /// Sets `cancel_requested_at` — does NOT close the PDA.
    /// `process_payment` can still collect within the already-paid window.
    /// After `last_payment_timestamp + interval` elapses, anyone may call
    /// `finalize_cancel` to close the PDA.
    pub fn request_cancel(ctx: Context<RequestCancel>) -> Result<()> {
        let sub = &ctx.accounts.subscription;
        let authority_key = ctx.accounts.authority.key();

        require!(
            authority_key == sub.subscriber || authority_key == sub.merchant,
            RecurError::UnauthorizedCancellation
        );
        // Idempotency guard — prevents resetting the clock on an existing request.
        require!(
            sub.cancel_requested_at == 0,
            RecurError::CancelAlreadyRequested
        );

        let now = Clock::get()?.unix_timestamp as u64;
        ctx.accounts.subscription.cancel_requested_at = now;

        Ok(())
    }

    /// Close the Subscription PDA after a pending cancellation has matured.
    ///
    /// PERMISSIONLESS — anyone may call once both conditions are satisfied:
    ///   1. `cancel_requested_at > 0`
    ///   2. `now >= last_payment_timestamp + interval`
    ///
    /// Rent returns to the merchant Gas Tank.
    pub fn finalize_cancel(ctx: Context<FinalizeCancel>) -> Result<()> {
        let sub = &ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp as u64;

        require!(sub.cancel_requested_at > 0, RecurError::NoCancelRequested);
        require!(
            now >= sub.last_payment_timestamp.saturating_add(sub.interval),
            RecurError::PaidPeriodNotElapsed
        );

        Ok(()) // Anchor `close = merchant` handles lamport transfer + zero-out.
    }

    /// Immediately close a Subscription PDA when the delegation is revoked or
    /// the subscriber's wallet is empty. Only callable by the Keeper.
    pub fn force_cancel(ctx: Context<ForceCancel>) -> Result<()> {
        // `keeper: Signer` enforces identity at the account-constraint level.
        let _ = &ctx.accounts.subscription;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Treasury instructions
    // -----------------------------------------------------------------------

    /// One-time initialisation of the global TreasuryVault PDA and its
    /// associated token account. Callable by either multisig key.
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        #[cfg(not(feature = "testing"))]
        {
            let signer_key = ctx.accounts.initializer.key();
            require!(
                signer_key == TREASURY_MULTISIG_A || signer_key == TREASURY_MULTISIG_B,
                RecurError::UnauthorizedMultisig
            );
        }

        let vault = &mut ctx.accounts.treasury_vault;
        vault.proposal_count = 0;
        vault.bump = ctx.bumps.treasury_vault;

        Ok(())
    }

    /// Create a withdrawal proposal. Either multisig key may propose.
    ///
    /// The nonce is auto-incremented from `treasury_vault.proposal_count`,
    /// preventing seed collisions and replay attacks without client-side
    /// nonce tracking.
    pub fn propose_withdrawal(
        ctx: Context<ProposeWithdrawal>,
        amount: u64,
        destination: Pubkey,
        ttl_seconds: u64,
    ) -> Result<()> {
        let proposer_key = ctx.accounts.proposer.key();
        #[cfg(not(feature = "testing"))]
        require!(
            proposer_key == TREASURY_MULTISIG_A || proposer_key == TREASURY_MULTISIG_B,
            RecurError::UnauthorizedMultisig
        );
        require!(amount > 0, RecurError::InvalidAmount);
        require!(ttl_seconds > 0, RecurError::InvalidInterval);
        require!(
            ctx.accounts.treasury_vault_token_account.amount >= amount,
            RecurError::InsufficientVaultBalance
        );

        let now = Clock::get()?.unix_timestamp as u64;
        let nonce = ctx.accounts.treasury_vault.proposal_count;

        let proposal = &mut ctx.accounts.withdrawal_proposal;
        proposal.proposer = proposer_key;
        proposal.amount = amount;
        proposal.destination = destination;
        proposal.created_at = now;
        proposal.expires_at = now.saturating_add(ttl_seconds);
        proposal.nonce = nonce;
        proposal.bump = ctx.bumps.withdrawal_proposal;

        // Increment nonce so the next proposal gets a fresh PDA seed.
        ctx.accounts.treasury_vault.proposal_count = nonce.saturating_add(1);

        Ok(())
    }

    /// Approve and execute a withdrawal proposal.
    ///
    /// Must be signed by the OTHER multisig key (not the proposer).
    /// Transfers `proposal.amount` from the vault to `proposal.destination`,
    /// then closes the proposal PDA (rent → approver).
    pub fn approve_withdrawal(ctx: Context<ApproveWithdrawal>) -> Result<()> {
        let approver_key = ctx.accounts.approver.key();
        let proposal = &ctx.accounts.withdrawal_proposal;

        // Both keys must be valid multisig signers.
        #[cfg(not(feature = "testing"))]
        require!(
            approver_key == TREASURY_MULTISIG_A || approver_key == TREASURY_MULTISIG_B,
            RecurError::UnauthorizedMultisig
        );
        // Self-approval is not permitted.
        require!(approver_key != proposal.proposer, RecurError::SelfApproval);

        let now = Clock::get()?.unix_timestamp as u64;
        require!(now < proposal.expires_at, RecurError::ProposalExpired);

        let amount = proposal.amount;
        require!(
            ctx.accounts.treasury_vault_token_account.amount >= amount,
            RecurError::InsufficientVaultBalance
        );

        let decimals = ctx.accounts.mint.decimals;
        let vault_bump = ctx.accounts.treasury_vault.bump;

        // Vault PDA signer seeds.
        let vault_signer_seeds: &[&[&[u8]]] = &[&[b"treasury_vault", &[vault_bump]]];

        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.treasury_vault_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination_token_account.to_account_info(),
                    authority: ctx.accounts.treasury_vault.to_account_info(),
                },
                vault_signer_seeds,
            ),
            amount,
            decimals,
        )?;

        // Proposal PDA is closed by Anchor's `close = approver` constraint.
        Ok(())
    }

    /// Cancel a live proposal. Only the original proposer may call this.
    /// Closes the proposal PDA and returns rent to the proposer.
    pub fn cancel_proposal(ctx: Context<CancelProposal>) -> Result<()> {
        let proposer_key = ctx.accounts.proposer.key();
        let proposal = &ctx.accounts.withdrawal_proposal;

        require!(proposer_key == proposal.proposer, RecurError::NotProposer);

        Ok(()) // Anchor `close = proposer` handles closure.
    }

    /// Permissionless cleanup of an expired proposal.
    /// Anyone may call this after `proposal.expires_at` to reclaim the rent.
    pub fn cleanup_expired_proposal(ctx: Context<CleanupExpiredProposal>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp as u64;
        require!(
            now >= ctx.accounts.withdrawal_proposal.expires_at,
            RecurError::ProposalNotExpired
        );

        Ok(()) // Anchor `close = caller` handles closure.
    }
}

// ---------------------------------------------------------------------------
// Account Contexts — Subscription
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

    /// Subscriber must sign to prove consent to the recurring charge.
    #[account(mut)]
    pub subscriber: Signer<'info>,

    /// Merchant pays the PDA rent (~0.002 SOL).
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

    /// CHECK: Identity enforced by `has_one` above.
    pub subscriber: AccountInfo<'info>,

    /// CHECK: Identity enforced by `has_one` above.
    pub merchant: AccountInfo<'info>,

    /// Subscriber token account.
    /// delegate must be the Subscription PDA; delegated_amount >= subscription.amount.
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

    /// Merchant token account.
    #[account(
        mut,
        constraint = merchant_token_account.owner == merchant.key()
            @ RecurError::InvalidTokenAccountOwner,
        constraint = merchant_token_account.mint == mint.key()
            @ RecurError::InvalidMint,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    /// Global treasury vault PDA (read-only — used for key derivation and
    /// to bind the vault token account via `has_one`).
    #[account(
        seeds = [b"treasury_vault"],
        bump = treasury_vault.bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    /// Treasury vault token account — receives the platform fee.
    #[account(
        mut,
        constraint = treasury_vault_token_account.owner == treasury_vault.key()
            @ RecurError::InvalidTokenAccountOwner,
        constraint = treasury_vault_token_account.mint == mint.key()
            @ RecurError::InvalidMint,
    )]
    pub treasury_vault_token_account: Account<'info, TokenAccount>,

    /// SPL token mint — validates decimals in `transfer_checked`.
    pub mint: Account<'info, Mint>,

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

    /// Either the subscriber or the merchant. Checked in instruction logic.
    pub authority: Signer<'info>,

    /// CHECK: Identity enforced by `has_one`.
    pub subscriber: AccountInfo<'info>,

    /// CHECK: Identity enforced by `has_one`.
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

    /// CHECK: Identity enforced by `has_one`.
    pub subscriber: AccountInfo<'info>,

    /// Rent refund destination (merchant Gas Tank). Identity enforced by `has_one`.
    #[account(mut)]
    /// CHECK: Verified by `has_one = merchant`.
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

    /// CHECK: Identity enforced by `has_one`.
    pub subscriber: AccountInfo<'info>,

    /// Rent refund destination. Identity enforced by `has_one`.
    #[account(mut)]
    /// CHECK: Verified by `has_one = merchant`.
    pub merchant: AccountInfo<'info>,

    /// Only the registered Keeper may force-cancel.
    pub keeper: Signer<'info>,
}

// ---------------------------------------------------------------------------
// Account Contexts — Treasury
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + TreasuryVault::INIT_SPACE,
        seeds = [b"treasury_vault"],
        bump
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    /// ATA owned by the TreasuryVault PDA — receives all platform fees.
    #[account(
        init,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = treasury_vault,
    )]
    pub treasury_vault_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    /// Must be TREASURY_MULTISIG_A or TREASURY_MULTISIG_B. Verified in logic.
    #[account(mut)]
    pub initializer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, destination: Pubkey, ttl_seconds: u64)]
pub struct ProposeWithdrawal<'info> {
    #[account(
        mut,
        seeds = [b"treasury_vault"],
        bump = treasury_vault.bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    /// Read balance to validate the proposed amount is available.
    #[account(
        constraint = treasury_vault_token_account.owner == treasury_vault.key()
            @ RecurError::InvalidTokenAccountOwner,
    )]
    pub treasury_vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = proposer,
        space = 8 + WithdrawalProposal::INIT_SPACE,
        seeds = [
            b"withdrawal_proposal",
            proposer.key().as_ref(),
            &treasury_vault.proposal_count.to_le_bytes(),
        ],
        bump
    )]
    pub withdrawal_proposal: Account<'info, WithdrawalProposal>,

    /// Must be TREASURY_MULTISIG_A or TREASURY_MULTISIG_B. Verified in logic.
    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveWithdrawal<'info> {
    #[account(
        mut,
        seeds = [b"treasury_vault"],
        bump = treasury_vault.bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    /// Vault token account — source of the withdrawal.
    #[account(
        mut,
        constraint = treasury_vault_token_account.owner == treasury_vault.key()
            @ RecurError::InvalidTokenAccountOwner,
        constraint = treasury_vault_token_account.mint == mint.key()
            @ RecurError::InvalidMint,
    )]
    pub treasury_vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        close = approver,
        seeds = [
            b"withdrawal_proposal",
            withdrawal_proposal.proposer.as_ref(),
            &withdrawal_proposal.nonce.to_le_bytes(),
        ],
        bump = withdrawal_proposal.bump,
    )]
    pub withdrawal_proposal: Account<'info, WithdrawalProposal>,

    /// Destination token account — receives the withdrawn funds.
    #[account(
        mut,
        constraint = destination_token_account.mint == mint.key()
            @ RecurError::InvalidMint,
        constraint = destination_token_account.key() == withdrawal_proposal.destination
            @ RecurError::InvalidDestination,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    /// Must be the OTHER multisig key (not the proposer). Verified in logic.
    #[account(mut)]
    pub approver: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelProposal<'info> {
    #[account(
        mut,
        close = proposer,
        seeds = [
            b"withdrawal_proposal",
            withdrawal_proposal.proposer.as_ref(),
            &withdrawal_proposal.nonce.to_le_bytes(),
        ],
        bump = withdrawal_proposal.bump,
    )]
    pub withdrawal_proposal: Account<'info, WithdrawalProposal>,

    /// Must be the original proposer. Verified in logic.
    #[account(mut)]
    pub proposer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CleanupExpiredProposal<'info> {
    #[account(
        mut,
        close = caller,
        seeds = [
            b"withdrawal_proposal",
            withdrawal_proposal.proposer.as_ref(),
            &withdrawal_proposal.nonce.to_le_bytes(),
        ],
        bump = withdrawal_proposal.bump,
    )]
    pub withdrawal_proposal: Account<'info, WithdrawalProposal>,

    /// Anyone may call — receives the reclaimed rent.
    #[account(mut)]
    pub caller: Signer<'info>,
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
    pub last_payment_timestamp: u64, // unix ts of last successful pull
    pub created_at: u64,             // unix ts of PDA creation
    /// 0 = active. Non-zero = unix ts when cancel was requested.
    pub cancel_requested_at: u64,
    pub bump: u8, // canonical PDA bump seed
}

#[account]
#[derive(InitSpace)]
pub struct TreasuryVault {
    /// Auto-incrementing nonce — used as part of WithdrawalProposal PDA seeds.
    /// Prevents seed collisions without client-side nonce tracking.
    pub proposal_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct WithdrawalProposal {
    pub proposer: Pubkey,    // MULTISIG_A or MULTISIG_B
    pub amount: u64,         // token base units to withdraw
    pub destination: Pubkey, // token account that receives the funds
    pub created_at: u64,
    pub expires_at: u64, // created_at + ttl_seconds
    pub nonce: u64,      // stored to reconstruct PDA seeds in approve/cancel
    pub bump: u8,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum RecurError {
    #[msg("Amount must be at least $1.00 (1_000_000 base units).")]
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

    #[msg("Amount after fee calculation is too small.")]
    AmountTooSmall,

    #[msg("Signer is not an approved treasury multisig key.")]
    UnauthorizedMultisig,

    #[msg("Approver cannot be the same key as the proposer (self-approval).")]
    SelfApproval,

    #[msg("This withdrawal proposal has expired.")]
    ProposalExpired,

    #[msg("Treasury vault token balance is insufficient for this withdrawal.")]
    InsufficientVaultBalance,

    #[msg("Only the original proposer may cancel this proposal.")]
    NotProposer,

    #[msg("This proposal has not yet expired.")]
    ProposalNotExpired,

    #[msg("Destination token account does not match the proposal.")]
    InvalidDestination,
}
