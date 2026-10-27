# Campus Loop ownership and Loop Plus

The Site is owned by the account that created it. The app's owner dashboard additionally requires ChatGPT sign-in whose authenticated email matches the server-only `PLATFORM_OWNER_EMAIL` runtime setting. Visit `/?view=owner`; other visitors cannot read owner data or grant access. GitHub source is in the owner's `carter-ryan123/owner-repp` repository.

## Membership

Loop Plus costs **$5 USD per month**, renews monthly, and allows **three available promoted listings** at a time. Members can change their selections. Promoted items receive priority under Recommended after school, area, category, condition, and price filters. Price and newest sorts follow the selected sort. Cards disclose promotion; views and sales are never guaranteed. Reserved/sold items leave browse results. Expired, canceled, past-due, paused, and held memberships receive no priority. Canceling at period end retains access through the active paid period.

Owner-granted 30-day complimentary access is separately labeled and counted. It does not create charges or represent paid revenue.

## Activation

Paid checkout is closed until all required settings are configured. Configure runtime values securely in Sites, never in GitHub or chat:

| Runtime setting | Purpose |
| --- | --- |
| `PLATFORM_OWNER_EMAIL` | Authenticated owner email; stored as a secret |
| `STRIPE_API_KEY` | Platform Stripe key, stored as a secret |
| `STRIPE_PLATFORM_ACCOUNT_ID` | Exact receiving Stripe account ID verified before checkout |
| `STRIPE_BOOST_PRICE_ID` | Active recurring price: USD 500 cents, every one month, licensed |
| `STRIPE_WEBHOOK_SECRET` | Endpoint signing secret; stored as a secret |
| `STRIPE_CHECKOUT_ENABLED` | Set to `true` only after test verification and activation |

Create the Loop Plus product and $5 monthly price on the intended Stripe account. Configure the customer billing portal to support cancellation and payment-method updates. Register this endpoint on that same account:

`https://campus-loop-exchange.milkyhawk20.chatgpt.site/api/billing/webhook`

Subscribe to `customer.subscription.*`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, and `radar.early_fraud_warning.created`.

The server verifies raw-body signatures and timestamp tolerance, rejects mismatched test/live events, records processed event IDs, and retrieves the canonical subscription from Stripe. A browser return URL never grants access. Checkout uses a server-chosen price, linked customer, and persisted idempotency key. Refunds/disputes/fraud warnings place promotion on hold pending owner review.

Before enabling live checkout, test payment success, authentication, cancellation, renewal, failure, duplicate/out-of-order events, refunds, disputes, account mismatch, and portal cancellation in Stripe's test environment. Local tests cover policy, signatures, owner authorization, and promotion access; no real Stripe payment was made during development. Redeploy after runtime settings change.

## Item sales

The planned **8% item-sale commission before processing fees** is separate from Loop Plus. Item payments, seller onboarding, transfers, and sale commission collection are not implemented or enabled. Members currently arrange local exchanges directly. Subscription checkout does not collect an item-sale commission.

References: [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), and [webhook management](https://docs.stripe.com/events/manage-webhook-endpoints).
