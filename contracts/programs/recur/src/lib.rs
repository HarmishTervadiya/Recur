use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod recur {
    use super::*;

    /// TODO: Initialize a new Subscription PDA.
    /// Called by the SDK after the user signs the SPL Token approve delegation.
    /// - Validate: amount > 0, interval > 0
    /// - Set subscriber, merchant, amount, interval, created_at
    /// - Set last_payment_timestamp = now (first pull happens interval seconds from now)
    /// - Merchant pays ~0.002 SOL rent via Gas Tank
    pub fn initialize_subscription(
        _ctx: Context<InitializeSubscription>,
        _amount: u64,
        _interval: u64,
    ) -> Result<()> {
        todo!()
    }

    /// TODO: Pull funds from subscriber -> merchant.
    /// Called exclusively by the off-chain Keeper. Subscriber does NOT sign.
    /// - Assert current_time >= last_payment_timestamp + interval (time-lock guardrail)
    /// - CPI into SPL Token transfer_checked using the delegated allowance
    /// - Update last_payment_timestamp = current_time
    /// - TODO (security): Use PDA signer seeds as the transfer authority, not the subscriber key directly
    pub fn process_payment(_ctx: Context<ProcessPayment>) -> Result<()> {
        todo!()
    }

    /// TODO: Cancel the subscription and close the PDA.
    /// - Either subscriber OR merchant can call this
    /// - Validate that authority matches subscriber or merchant on the PDA
    /// - Anchor close = merchant returns ~0.002 SOL rent to merchant Gas Tank
    pub fn cancel_subscription(_ctx: Context<CancelSubscription>) -> Result<()> {
        todo!()
    }

    /// TODO: Force-cancel when Keeper detects revoked delegation or empty wallet.
    /// - Only callable by Keeper
    /// - Same close logic as cancel_subscription
    /// - Keeper fires subscription.canceled webhook after this confirms
    pub fn force_cancel(_ctx: Context<CancelSubscription>) -> Result<()> {
        todo!()
    }
}

// Account Contexts

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

    #[account(mut)]
    pub subscriber: Signer<'info>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessPayment<'info> {
    #[account(
		mut,
		seeds = [b"subscription", subscriber.key().as_ref(), merchant.key().as_ref()],
		bump
	)]
    pub subscription: Account<'info, Subscription>,

    /// CHECK: Subscriber does not sign. Validated via PDA seeds only.
    pub subscriber: AccountInfo<'info>,

    /// CHECK: Merchant does not need to sign. Validated via PDA seeds only.
    pub merchant: AccountInfo<'info>,

    #[account(mut)]
    pub subscriber_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub merchant_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, token::Mint>,

    pub token_program: Program<'info, Token>,

    /// The Keeper wallet must sign every process_payment call.
    pub keeper: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelSubscription<'info> {
    #[account(
		mut,
		close = merchant,
		seeds = [b"subscription", subscriber.key().as_ref(), merchant.key().as_ref()],
		bump
	)]
    pub subscription: Account<'info, Subscription>,

    /// TODO: Validate this signer matches subscription.subscriber or subscription.merchant.
    pub authority: Signer<'info>,

    /// CHECK: Used for PDA seed derivation only.
    pub subscriber: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: Rent refund destination.
    pub merchant: AccountInfo<'info>,
}

// State

#[account]
#[derive(InitSpace)]
pub struct Subscription {
    pub subscriber: Pubkey,          // wallet paying
    pub merchant: Pubkey,            // wallet receiving
    pub amount: u64,                 // USDC base units per interval
    pub interval: u64,               // seconds between pulls (e.g. 2_592_000 = 30 days)
    pub last_payment_timestamp: u64, // unix timestamp of last successful pull
    pub created_at: u64,             // unix timestamp of subscription creation
    pub bump: u8,                    // PDA bump seed
}

// Errors

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
}
