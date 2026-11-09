# PayPal subscriptions

PayPal is the only implemented payment processor. There is no card form in this app. Unconfigured billing is a preview and never creates charges or paid access.

## Configure in sandbox first

Create a PayPal business/developer app and monthly USD billing plans for Companion ($5), Everyday ($15) and Signature ($30). The app does not create products or plans automatically. Set server variables PAYPAL_ENV=sandbox, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_PLAN_STARTER, PAYPAL_PLAN_PLUS and PAYPAL_PLAN_PRO. Plan amounts/cadence in PayPal must match the displayed offer; taxes, refunds, policy notices and consumer obligations must be reviewed for your business before live sales.

Use an HTTPS APP_ORIGIN. Register /api/billing/webhook for BILLING.SUBSCRIPTION.ACTIVATED, UPDATED, CANCELLED, SUSPENDED and EXPIRED events. The server obtains OAuth tokens, creates an approval request using the authenticated user ID as custom_id, and redirects only to approved PayPal hosts. Returning to a success URL grants nothing.

For each webhook, the server asks PayPal's verification API to authenticate its signature, then fetches the current subscription from PayPal. Account assignment and plan access come from the fetched custom_id, plan_id and ACTIVE status, not browser claims. Unrecognized plan IDs do not grant paid access. Events are deduplicated. Current provider state avoids blindly applying an old webhook snapshot. An unrelated cancelled subscription does not remove another active subscription's access.

Cancellation is explicitly confirmed in the authenticated Plans screen. The app asks PayPal to cancel that user's recorded subscription and removes paid app access immediately. The private workspace remains available on the free allowance. Payment history and final billing information remain in PayPal.

## Live configuration

After separately testing your PayPal sandbox and business/legal policies, set PAYPAL_ENV=live and the corresponding live app, webhook and plan IDs. Sandbox and live IDs are separate. Keep all secrets in host settings; never commit them or paste them into chat. No real PayPal credentials, approval, subscription, cancellation or charge was exercised during development. Tests mock PayPal's OAuth, verification and lookup endpoints and are not proof of merchant approval or live readiness.

Sources: https://developer.paypal.com/api/subscriptions/v1 and https://developer.paypal.com/api/webhooks/v1
