/**
 * Supabase Edge Function — create-checkout
 *
 * Creates a Stripe checkout session for MacroVox/Team upgrade.
 * Called from the renderer via `supabase.functions.invoke('create-checkout', { body: { userId, plan } })`.
 *
 * Required environment variables (set in Supabase dashboard → Settings → Edge Functions):
 *   STRIPE_SECRET_KEY    — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_PRICE_ID  — Stripe Price ID for MacroVox ($6.99/month)
 *   SITE_URL             — Your Netlify site URL (https://macrovox.netlify.app)
 */

import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const ALLOWED_ORIGINS = ['https://macrovox.netlify.app', 'tauri://localhost', 'https://tauri.localhost']

function getCorsHeaders(req: Request) {
  const origin = (req.headers.get('origin') ?? '').toLowerCase()
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : null
  return {
    'Access-Control-Allow-Origin': corsOrigin || '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  const origin = (req.headers.get('origin') ?? '').toLowerCase()
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { userId, plan } = await req.json() as { userId: string; plan: string }

    if (user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const allowedPlans = ['pro', 'team']
    if (!plan || !allowedPlans.includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const priceId = Deno.env.get('STRIPE_PRICE_ID')

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Pricing not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://macrovox.netlify.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/success`,
      cancel_url: `${siteUrl}/cancel`,
      customer_email: user.email,
      metadata: { userId: user.id, plan },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[create-checkout]', err instanceof Error ? err.message : 'unknown')
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
