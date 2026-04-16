# Free Trial Implementation Guide

7-day free trial for new MacroVox subscribers. Users get full Pro access during the trial, then auto-convert to \$6.99/month.

---

## How It Works

Stripe has built-in trial support on subscriptions. When a user starts checkout, we pass `trial_period_days: 7` to the Stripe checkout session. Stripe collects payment info upfront but doesn't charge until the trial ends. During the trial the subscription status is `trialing` — the webhook code already treats this as active.

**User flow:**
1. User signs up on website or in-app
2. Clicks "Start Free Trial" → Stripe Checkout
3. Enters payment info (card is validated but not charged)
4. Gets immediate Pro access (managed API keys provisioned)
5. After 7 days, Stripe auto-charges \$6.99/month
6. If they cancel during trial, no charge — keys are revoked

---

## Changes Required

### 1. Stripe Dashboard (manual)

**Add the `customer.subscription.trial_will_end` webhook event:**
- Go to Stripe Dashboard → Developers → Webhooks
- Edit your existing webhook endpoint
- Add event: `customer.subscription.trial_will_end`
- This fires 3 days before trial expiry (useful for reminder emails later)

**Optional — restrict one trial per customer:**
- Go to Stripe Dashboard → Settings → Billing → Subscriptions
- Under "Free trials", enable "Only allow one free trial per customer"
- This prevents the same Stripe customer from getting a second trial

### 2. Website Checkout API (`macrovox-web/src/app/api/create-checkout/route.ts`)

Add `subscription_data` with trial config to the checkout session:

```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO!, quantity: 1 }],
  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
  cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cancel`,
  metadata: { userId },
  // --- ADD THIS BLOCK ---
  subscription_data: {
    trial_period_days: 7,
    metadata: { userId },
  },
})
```

**Prevent repeat trials** — add a check before creating the session. If the user already has (or had) a Stripe subscription, skip the trial:

```typescript
// After looking up `sub` from Supabase...
const hadPriorSubscription = !!sub?.stripe_subscription_id

const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO!, quantity: 1 }],
  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
  cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cancel`,
  metadata: { userId },
  // Only offer trial to first-time subscribers
  ...(hadPriorSubscription ? {} : {
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId },
    },
  }),
})
```

### 3. Supabase Edge Function (`supabase/functions/create-checkout/index.ts`)

Same change as above. Add trial config to the checkout session creation:

```typescript
// Check if user already had a subscription
const { data: existingSub } = await supabase
  .from('subscriptions')
  .select('stripe_subscription_id')
  .eq('user_id', user.id)
  .single()

const hadPriorSubscription = !!existingSub?.stripe_subscription_id

const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${siteUrl}/success`,
  cancel_url: `${siteUrl}/cancel`,
  customer_email: user.email,
  metadata: { userId: user.id, plan },
  // Only offer trial to first-time subscribers
  ...(hadPriorSubscription ? {} : {
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId: user.id, plan },
    },
  }),
})
```

### 4. Webhook — No Code Changes Needed

The existing webhook handlers already work correctly with trials:

- **`checkout.session.completed`** — fires when checkout finishes (even with trial). The current code provisions API keys immediately. No change needed.
- **`customer.subscription.updated`** — line 141 of the Supabase Edge Function already maps `trialing` as active:
  ```typescript
  const isActive = stripeStatus === 'active' || stripeStatus === 'trialing'
  ```
- **`customer.subscription.deleted`** — handles cancellation/expiry. No change needed.

The website webhook (`macrovox-web/src/app/api/stripe-webhook/route.ts`) needs one fix in the `customer.subscription.updated` handler — it currently only checks for `active`, not `trialing`:

```typescript
// BEFORE (line 57):
const status = sub.status === 'active' ? 'pro' : 'free'

// AFTER:
const status = (sub.status === 'active' || sub.status === 'trialing') ? 'pro' : 'free'
```

### 5. Database — Add `trial_used` Column (optional but recommended)

Run this migration in Supabase SQL Editor:

```sql
-- Track whether user has used their free trial
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_used boolean DEFAULT false;

-- Set trial_used for all existing subscribers (they shouldn't get a trial)
UPDATE subscriptions
  SET trial_used = true
  WHERE stripe_subscription_id IS NOT NULL;
```

Then update the checkout endpoints to check `trial_used` instead of (or in addition to) checking `stripe_subscription_id`. This is more explicit and survives edge cases like a user whose subscription was fully deleted from the table.

### 6. Desktop App — Subscription Display (`src/renderer/components/SettingsPanel.tsx`)

Update the subscription card in SettingsPanel to show trial status. The Stripe subscription object includes `trial_end` as a Unix timestamp. You can fetch this from Supabase by adding a `trial_end` column, or by checking the status + calculating from `created_at`.

**Simplest approach** — add a `trial_end` column to `subscriptions`:

```sql
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_end timestamptz;
```

Then in the `checkout.session.completed` webhook handler, after upserting the subscription, also store the trial end date:

```typescript
// In handleCheckoutCompleted, after the upsert:
const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
if (stripeSubscription.trial_end) {
  await supabase
    .from('subscriptions')
    .update({ trial_end: new Date(stripeSubscription.trial_end * 1000).toISOString() })
    .eq('user_id', userId)
}
```

In the app UI, show "Trial — X days left" when `trial_end` is set and in the future.

### 7. Website UI Changes

These changes have already been made (see the updated files in `macrovox-web`):
- Homepage pricing: "7-day free trial, then \$6.99/month"
- CTA buttons: "Start Free Trial"
- Hero subtitle mentions free trial
- Dashboard: subscribe button says "Start 7-Day Free Trial"
- Success page: updated copy for trial activation

---

## Summary Checklist

| # | Task | Where | Difficulty |
|---|------|-------|------------|
| 1 | Add `trial_will_end` webhook event | Stripe Dashboard | Click |
| 2 | Enable "one trial per customer" | Stripe Dashboard | Click |
| 3 | Add `trial_period_days: 7` to website checkout | `macrovox-web/src/app/api/create-checkout/route.ts` | Easy |
| 4 | Add `trial_period_days: 7` to Edge Function checkout | `supabase/functions/create-checkout/index.ts` | Easy |
| 5 | Add repeat-trial prevention logic | Both checkout endpoints | Easy |
| 6 | Fix website webhook to treat `trialing` as active | `macrovox-web/src/app/api/stripe-webhook/route.ts` | One-liner |
| 7 | Add `trial_used` + `trial_end` columns | Supabase SQL Editor | Easy |
| 8 | Store `trial_end` in webhook handler | Supabase Edge Function webhook | Easy |
| 9 | Show trial status in desktop app UI | `src/renderer/components/SettingsPanel.tsx` | Medium |
| 10 | Deploy updated website | Netlify (auto on push) | Push |
| 11 | Deploy updated Edge Functions | `supabase functions deploy` | Command |

---

## Testing

1. **Stripe test mode** — use test API keys and `4242 4242 4242 4242` card
2. **Create a fresh test user** in Supabase Auth
3. Go through checkout flow — verify:
   - Stripe shows "7-day free trial" on checkout page
   - No charge appears on test card
   - `subscriptions` row has `status: 'pro'` and `trial_end` set
   - `managed_api_keys` row is provisioned
4. **Simulate trial end** — in Stripe Dashboard, find the test subscription and click "End trial now"
   - Verify card is charged \$6.99
   - Subscription status stays `pro`
5. **Test cancellation during trial** — cancel from billing portal
   - Verify no charge
   - Verify keys are revoked and status goes to `free`
6. **Test repeat trial prevention** — same user tries to subscribe again
   - Should go straight to paid checkout (no trial offered)
