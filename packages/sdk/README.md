# @recur/sdk

Recur SDK helpers for merchant subscription integrations.

## Billing and Fee Behavior

For each billing cycle, `amount` is the total amount pulled from the subscriber.

- Subscriber pays: `amount`
- Merchant receives: `amount - platform_fee`
- Recur treasury receives: `platform_fee`

`platform_fee` is computed as:

- Flat fee: `$0.05` (`50_000` in 6-decimal USDC base units)
- Plus variable fee: `0.25%` of `amount` (`amount * 25 / 10_000`)

Because the split happens inside the on-chain `process_payment` instruction, the subscriber's SPL delegation must cover the full `amount`, not just the merchant net amount.

## Minimum Plan Amount

Minimum supported plan amount is `$1.00` (`1_000_000` in 6-decimal USDC base units).
