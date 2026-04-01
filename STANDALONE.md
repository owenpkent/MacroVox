# MacroVox Backend Setup Guide (Supabase + Netlify)

Step-by-step instructions for setting up MacroVox's backend infrastructure from scratch. MacroVox uses **Supabase** for authentication and database, and **Netlify** for hosting serverless functions.

> **No backend?** MacroVox works without any backend at all — users just enter their own Deepgram API key in Settings. The backend is only needed for Pro subscriptions with managed API keys and auth.

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click **New Project**, choose a name and region
3. Save your **Project URL** and **anon public key** from `Settings > API`

### Configure environment variables

Set these in your shell or `.env` file (never commit `.env`):

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Update them in `src/main/auth/supabase-client.ts`:

```typescript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'
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
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own keys" ON managed_api_keys
  FOR SELECT USING (auth.uid() = user_id);
```

---

## Step 4: Deploy Netlify Functions (optional)

Only needed if you want Pro subscription features (Stripe checkout, API key proxy).

### 4a. Create a Netlify site

1. Go to [netlify.com](https://netlify.com), sign in
2. Click **Add new site > Import an existing project**
3. Connect your MacroVox repo
4. Set build settings:
   - **Build command**: (leave empty or `echo no build`)
   - **Publish directory**: `public` (or create an empty folder)
5. Deploy

### 4b. Add environment variables

In Netlify dashboard: **Site settings > Environment variables**:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (from Supabase Settings > API > service_role)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DEEPGRAM_MANAGED_KEY=...          (shared key for Pro users)
ANTHROPIC_MANAGED_KEY=...         (shared key for Pro users)
```

### 4c. Create Netlify Functions

Create `netlify/functions/create-checkout.ts`:

```typescript
// Stripe checkout session for Pro upgrade
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async (req: Request) => {
  const { userId, plan } = await req.json()
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: plan === 'team' ? 'price_TEAM_ID' : 'price_PRO_ID', quantity: 1 }],
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

### 4d. Update config.ts

After deploying, update `src/renderer/config.ts` with your Netlify URL:

```typescript
export const SITE_URL = 'https://YOUR-SITE.netlify.app'
```

---

## Step 5: Verify Everything Works

```powershell
npm run dev
```

1. **Settings > Sign Up** — create account with email or Google/Facebook
2. **Settings > Subscription** — should show "Free Plan"
3. **Dictation** — enter your own Deepgram key and test recording
4. **Ctrl+Space** — global hotkey should toggle recording

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
         │  billing-portal (Stripe)     │
         │  claude-proxy (optional)     │
         └─────────────────────────────┘
```

## Without a Backend (BYOK mode)

MacroVox works completely standalone without Supabase or Netlify:

1. Skip all backend setup
2. Leave the default placeholder values in `supabase-client.ts`
3. Users enter their own Deepgram API key in Settings
4. Auth and subscription features will silently fail — dictation works fine
5. AI post-processing requires user's own Anthropic API key
