# MacroVox Backend Setup Guide (Supabase + Netlify + Stripe)

Step-by-step instructions for setting up MacroVox's backend infrastructure from scratch. MacroVox uses **Supabase** for authentication and database, **Netlify** for hosting serverless functions, and **Stripe** for subscription billing.

> **MacroVox is a managed service** — Deepgram (speech-to-text) and Claude (AI post-processing) are both required and provisioned server-side for Pro subscribers. Users never configure API keys.

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click **New Project**, choose a name and region
3. In **Settings > API**, enable **Data API** (recommended for supabase-js) and **Enable automatic RLS** (security by default)
4. Save your **Project URL** and **anon public key** from `Settings > API`

### Configure environment variables

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Update them in `src/main/auth/supabase-client.ts`:

```typescript
/**
 * Supabase client singleton for the main process.
 *
 * Uses SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from environment variables.
 * These are PUBLIC keys — safe to ship in the client binary.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'YOUR_PUBLISHABLE_KEY'

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,   // we handle persistence ourselves via safeStorage
        detectSessionInUrl: false,
      },
    })
    console.log('[Supabase] Client initialized:', SUPABASE_URL)
  }
  return _client
}
```

---

## Step 2: Enable Auth Providers

In the Supabase dashboard, go to **Authentication > Providers**:

### Email/Password (enabled by default)
- Toggle **Enable Email Signup** on
- Optionally enable **Confirm email** (sends verification link)

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (type: Web application)
3. Set **Authorized redirect URI** to: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret
5. In Supabase dashboard: **Authentication > Providers > Google** — paste credentials

### Facebook OAuth
1. Go to [Facebook Developers](https://developers.facebook.com/apps)
2. Create an app, add **Facebook Login** product
3. Set **Valid OAuth Redirect URI** to: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy the App ID and App Secret
5. In Supabase dashboard: **Authentication > Providers > Facebook** — paste credentials

### Register custom protocol

For OAuth to work in the Electron app, the redirect must use the `macrovox://` custom protocol. This is already configured in `main.ts` — the OAuth flow opens a BrowserWindow, catches the redirect, and extracts tokens.

---

## Step 3: Create Database Tables

In the Supabase **SQL Editor**, run:

```sql
-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Managed API keys for Pro users
CREATE TABLE managed_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  deepgram_key TEXT,
  anthropic_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) — users can only read their own data
-- Note: Automatic RLS should be enabled in Settings > API for future tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own keys" ON managed_api_keys
  FOR SELECT USING (auth.uid() = user_id);
```

---

## Step 4: Create Stripe Products

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Products**
2. Click **+ Add product**
3. Create **MacroVox Pro** — `$9.99/month` recurring
4. Save the **Price ID** (starts with `price_`)
5. Optionally create **MacroVox Team** tier

---

## Step 5: Deploy Netlify Functions

### 5a. Create a Netlify site

1. Go to [netlify.com](https://netlify.com), sign in
2. Click **Add new site > Import an existing project**
3. Connect your MacroVox repo
4. Set build settings:
   - **Build command**: (leave empty or `echo no build`)
   - **Publish directory**: `public` (or create an empty folder)
5. Deploy

### 5b. Add environment variables

In Netlify dashboard: **Site settings > Environment variables**:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (from Supabase Settings > API > service_role)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
DEEPGRAM_MANAGED_KEY=...          (required — Deepgram key for all Pro users)
ANTHROPIC_MANAGED_KEY=...         (required — Claude key for all Pro users)
```

### 5c. Create Netlify Functions

Create `netlify/functions/create-checkout.ts`:

```typescript
// Stripe checkout session for Pro upgrade
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async (req: Request) => {
  const { userId, plan } = await req.json()
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: 'https://macrovox.netlify.app/success',
    cancel_url: 'https://macrovox.netlify.app/cancel',
    metadata: { userId },
  })

  return new Response(JSON.stringify({ url: session.url }))
}
```

Create `netlify/functions/billing-portal.ts`:

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async (req: Request) => {
  const { userId } = await req.json()
  // Look up Stripe customer ID from Supabase
  // ...
  const session = await stripe.billingPortal.sessions.create({
    customer: 'cus_...',
    return_url: 'https://macrovox.netlify.app',
  })
  return new Response(JSON.stringify({ url: session.url }))
}
```

### 5d. Create Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click **+ Add endpoint**
3. **Endpoint URL**: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
4. **Events**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy the **Signing secret** → add as `STRIPE_WEBHOOK_SECRET` in Netlify

### 5e. Update config.ts

After deploying, update `src/renderer/config.ts` with your Netlify URL:

```typescript
export const SITE_URL = 'https://YOUR-SITE.netlify.app'
```

---

## Step 6: Verify Everything Works

```powershell
npm run dev
```

1. **Settings > Sign Up** — create account with email or Google/Facebook
2. **Settings > Subscription** — should show "Free Plan"
3. **Upgrade to Pro** — completes Stripe checkout, keys are provisioned
4. **Dictation** — recording should work with managed Deepgram key
5. **Ctrl+Space** — global hotkey should toggle recording

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────┐
│                   MacroVox Electron                   │
│                                                       │
│  auth-manager.ts ←→ Supabase Auth (email/Google/FB)  │
│  subscription.ts ←→ Supabase DB (subscriptions)      │
│  Session stored locally with Electron safeStorage     │
└───────────────────────┬──────────────────────────────┘
                        │
         ┌──────────────▼──────────────┐
         │       Supabase (hosted)      │
         │  Auth: email, Google, FB     │
         │  DB: subscriptions, keys     │
         └──────────────┬──────────────┘
                        │
         ┌──────────────▼──────────────┐
         │    Netlify Functions          │
         │  create-checkout (Stripe)    │
         │  stripe-webhook              │
         │  billing-portal (Stripe)     │
         │  claude-proxy                │
         │  deepgram-proxy              │
         └─────────────────────────────┘
```
