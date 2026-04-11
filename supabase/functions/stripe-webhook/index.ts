/**
 * Supabase Edge Function — stripe-webhook
 *
 * Handles Stripe webhook events to keep subscription state in sync.
 * Events handled:
 *   checkout.session.completed       — provision managed API keys for new subscriber
 *   customer.subscription.updated    — sync subscription status changes
 *   customer.subscription.deleted    — deprovision keys on cancellation
 *   charge.refunded                  — deprovision keys on refund
 *
 * Required environment variables (set in Supabase dashboard → Settings → Edge Functions):
 *   STRIPE_SECRET_KEY         — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET     — Webhook signing secret (whsec_...)
 *   DEEPGRAM_MANAGED_KEY      — Deepgram API key to provision for Pro users
 *   ANTHROPIC_MANAGED_KEY     — Anthropic API key to provision for Pro users
 *
 * Webhook endpoint URL: https://<project>.supabase.co/functions/v1/stripe-webhook
 * Register this URL in Stripe Dashboard → Developers → Webhooks.
 */

import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed')
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(sub)
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleChargeRefunded(charge)
        break
      }
      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err instanceof Error ? err.message : 'unknown')
    return new Response('Handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const plan = (session.metadata?.plan ?? 'pro') as 'pro' | 'team'
  if (!userId) {
    console.error('[stripe-webhook] checkout.session.completed missing userId metadata')
    return
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id

  // Upsert subscription row
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      status: plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (subError) {
    console.error('[stripe-webhook] Failed to upsert subscription')
    return
  }

  // Provision managed API keys
  const deepgramKey = Deno.env.get('DEEPGRAM_MANAGED_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_MANAGED_KEY')

  const { error: keyError } = await supabase
    .from('managed_api_keys')
    .upsert({
      user_id: userId,
      deepgram_key: deepgramKey ?? null,
      anthropic_key: anthropicKey ?? null,
    }, { onConflict: 'user_id' })

  if (keyError) {
    console.error('[stripe-webhook] Failed to provision managed keys')
  } else {
    console.log(`[stripe-webhook] Provisioned keys (${plan})`)
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  // Map Stripe subscription status to our internal status
  const stripeStatus = sub.status
  const isActive = stripeStatus === 'active' || stripeStatus === 'trialing'

  if (!isActive) {
    // Suspension (past_due, unpaid, etc.) — deprovision keys
    await deprovisionByStripeCustomer(sub.customer as string)
    return
  }

  // If active, ensure the subscription row reflects the correct plan
  // (plan changes would come through here as well)
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', sub.customer as string)
    .single()

  if (existing?.user_id) {
    await supabase
      .from('subscriptions')
      .update({ status: 'pro', updated_at: new Date().toISOString() })
      .eq('user_id', existing.user_id)
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await deprovisionByStripeCustomer(sub.customer as string)
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const customerId = typeof charge.customer === 'string'
    ? charge.customer
    : charge.customer?.id

  if (!customerId) {
    console.error('[stripe-webhook] charge.refunded missing customer')
    return
  }

  await deprovisionByStripeCustomer(customerId)
  console.log('[stripe-webhook] Deprovisioned after refund')
}

async function deprovisionByStripeCustomer(customerId: string) {
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!subRow?.user_id) return

  const userId = subRow.user_id

  // Downgrade subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: 'free',
      stripe_subscription_id: null,
      expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  // Remove managed API keys
  await supabase
    .from('managed_api_keys')
    .delete()
    .eq('user_id', userId)

  console.log('[stripe-webhook] Deprovisioned keys')
}
