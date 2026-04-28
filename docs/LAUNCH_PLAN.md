# MacroVox launch plan

The single source of truth for what's between v1.0.6 (built locally,
EV-signed, never published) and **a stranger pays $6.99 and starts
dictating**. Tick items as they go green. Everything that already exists
in the repo is annotated; everything that doesn't yet is the work.

> Companion docs:
> - [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) — preflight gate for any
>   release (tests, smoke tests, signing).
> - [RELEASE.md](RELEASE.md) — mechanics of building bundles + manifest.
>
> This file is the *strategic* layer above both: what order, who acts,
> what's blocked on what.

---

## Where we actually are (updated 2026-04-26 end-of-day)

- **App code:** v1.0.7 bumped, CHANGELOG consolidated, all gates green
  (Vitest 20/20, `cargo test` 55/55, `tsc --noEmit` ×2, `cargo clippy
  -D warnings`).
- **EV signing pipeline:** working end-to-end on a single `tauri build`
  via `scripts/sign-windows.ps1`. Signed v1.0.7 `.exe` + `.msi` + `.sig`
  staged in `release/windows/`; `signtool verify /pa` passes.
- **Updater code:** `tauri-plugin-updater` wired with real pubkey
  (minisign key ID `9B91F23A49E0246D`). `tauri.conf.json` points at
  `okstudio1/macrovox-releases` — **repo now exists** (created public
  2026-04-26 and seeded). Endpoint resolves once v1.0.7 is published.
- **CI release workflow:** `.github/workflows/release.yml` rewritten to
  alpha-osk pattern (commit `MacroVox@fa5ced8`) — Linux build →
  workflow artifact only; **no CI publish**. Owen publishes locally.
  Has not yet fired (no `v*.*.*` tag exists yet).
- **Backend wiring (Stripe / Supabase / Netlify):** **fully audited and
  fixed end-of-2026-04-26.** Stripe product+webhook+portal verified;
  Supabase tables + Edge Functions + secrets verified (the missing
  `api_usage` table was created today; `verify_jwt = false` for
  `stripe-webhook` toggled and persisted in `supabase/config.toml`);
  webhook delivery confirmed working (HTTP 200 after the JWT-verify
  fix). Trial flow wired in code: `subscription_data: {
  trial_period_days: 7 }` in both `create-checkout` implementations
  + trial copy across the marketing site.
- **Marketing site (`macrovox-web`):** Netlify deploy was broken since
  2026-04-14. Now green at `master@836661f`. Live at
  `https://macrovox.tech`.
- **Proxy hosting:** `claude-proxy.ts` + `deepgram-proxy.ts` were
  uploaded into the wrong repo (MacroVox) and never deployed. Moved
  into `macrovox-web/netlify/functions/` today (commit
  `macrovox-web@836661f`). Now resolve at the URLs the desktop app
  expects (`https://macrovox.tech/.netlify/functions/*`),
  zero desktop code change.

## Open blockers before v1.0.7 ship

1. **Add `SUPABASE_URL` env var to macrovox-web Netlify.** Same value
   as `NEXT_PUBLIC_SUPABASE_URL`, mark secret. The proxies read
   `process.env.SUPABASE_URL` directly — without this, every Pro
   dictation request 500s at runtime. **30-second dashboard fix.**

2. **Redeploy Supabase `create-checkout`** so the trial code at
   `MacroVox@d620a39` actually takes effect. Code in repo doesn't
   auto-deploy to Supabase: `supabase functions deploy create-checkout`
   from `C:\Users\Owen\dev\MacroVox`. Until this runs, signups still
   charge $6.99 immediately while the marketing copy advertises a
   trial.

3. **Click "Save changes" on Stripe Customer Portal**
   (https://dashboard.stripe.com/settings/billing/portal). Default
   config exists but may be unsaved — `billingPortal.sessions.create`
   returns "not configured" until saved.

4. **First-account end-to-end smoke test** on the live site (Task #4).
   Signup → trial Stripe Checkout → /success → verify in Supabase
   that `subscriptions` and `managed_api_keys` rows are populated →
   verify in Stripe that subscription is in `trialing` state →
   cancel/refund and verify `managed_api_keys` row is deleted.

5. **Clean-VM smoke test on Windows 11** (Section 3 of
   `RELEASE_CHECKLIST.md`). Required before tagging. Not yet done.

## Remaining release steps (in order)

After the open blockers above are cleared, the publish sequence:

1. `git tag v1.0.7 && git push --tags` — CI's `release.yml` builds
   Linux and uploads `linux-bundle` workflow artifact.
2. On EV host: build Windows locally, then
   `gh run download --name linux-bundle --dir release` to pull the CI
   Linux output into `release/linux/`.
3. Regenerate `latest.json` locally with both platforms.
4. `gh release create v1.0.7 --repo okstudio1/macrovox-releases --draft
   --title "MacroVox 1.0.7" release/windows/* release/linux/*
   release/latest.json`. Local `gh` auth handles cross-repo write —
   no PAT secret needed.
5. Publish the draft.
6. Verify: `curl -I https://github.com/okstudio1/macrovox-releases/releases/latest/download/latest.json`
   returns `200`; existing v1.0.6 install picks up v1.0.7 on relaunch.
7. Post-release watch (24–48 h): Netlify function logs, Supabase
   auth/sub tables.

## Launch validation & marketing (parallel, doesn't block tag)

- **First-account end-to-end test** on the live site
  (`https://macrovox.tech`, production): signup → email
  verify → Stripe Checkout (or 7-day trial flow) → land back in
  dashboard → managed API keys issued → download `.exe` → install →
  sign in → dictate. Only way to catch broken Netlify functions,
  missing Stripe webhook config, or RLS policy mistakes. Owen
  hasn't run this yet.
- **Product screenshots** for marketing — dictation HUD, Settings
  panel (Quick Dictation + Voice History especially), streaming
  transcript flow.
- **Demo GIF** (optional but high-leverage) — `Ctrl+Space` → speak →
  release → text appears in target app. Tools: ScreenToGif.

## Lessons we're carrying over from `alpha-osk`

1. **Pin the release endpoint, then verify it.** v1.0.3 and v1.0.4 of
   alpha-osk shipped pointing at the *private source* repo URL by
   mistake; GitHub returned 404 to unauthenticated update clients and
   the updater silently reported "no update" for two release cycles.
   Lesson: smoke-test the live `latest.json` URL in the preflight, not
   just locally.
2. **Consider a public `*-releases` repo.** alpha-osk keeps the source
   repo private and publishes binaries to a separate public
   `alpha-osk-releases` repo. The unauthenticated updater can read the
   public repo without auth tokens. Decision needed (see below).
3. **Layered identity checks**, not just the Tauri ed25519 pubkey:
   alpha-osk additionally pins the Authenticode signer CN ("OK Studio
   Inc.") and SHA1 thumbprint of the EV cert, plus a hostname
   whitelist on download URLs. Tauri's plugin handles the ed25519
   signature; we should still verify the EV signature on the installer
   in the preflight.
4. **signtool must run from a non-elevated shell** when using the
   SafeNet eToken — it isn't visible to admin processes.
5. **Retry signing on Defender locks.** alpha-osk's signer retries up
   to 5× with exponential backoff because `signtool` regularly fights
   Defender's real-time scan for newly written `.exe` files.

## Decisions resolved before v1.0.7 ship

1. **Repo visibility model.** ✅ **Decided: split.** `okstudio1/MacroVox`
   (source) stays private. `okstudio1/macrovox-releases` (public,
   binaries-only) was created on GitHub 2026-04-26. All updater +
   website plumbing points at it. CI workflow rewritten to alpha-osk
   pattern (build artifact in CI; publish locally with `gh release
   create --repo okstudio1/macrovox-releases`) so no PAT secret is
   needed.

2. **Managed-API-key delivery model.** ✅ **Decided: asymmetric, by
   service.** The original framing was a false dichotomy — the two
   services have different latency requirements:
   - **Deepgram:** per-user key from `managed_api_keys.deepgram_key`,
     read by the renderer at `src/renderer/lib/auth.ts:213`. The Rust
     backend uses it directly to open a WebSocket to Deepgram for
     low-latency streaming. A proxy hop is incompatible with real-time
     audio. Webhook provisions the row at checkout.
   - **Anthropic:** shared env-var key on the proxy (`claude-proxy`).
     No streaming concern, so all calls go through the proxy. The
     `managed_api_keys.anthropic_key` column is stored but unused
     (cleanup queued — drop the column).
   - This wasn't documented before; today's audit revealed the
     intended design. Both deliveries are correct as implemented.

3. **Free-trial flow.** ✅ **Decided: native Stripe trial with CC
   up-front.** Both `create-checkout` implementations now set
   `subscription_data: { trial_period_days: 7 }` (commits
   `MacroVox@d620a39` + `macrovox-web@8bb13f0`). Stripe collects the
   card at signup but doesn't charge until day 7. Marketing copy
   aligned across landing/dashboard/success pages: "Start Free Trial",
   "no charge until the trial ends." Default Stripe trial behavior
   (CC required) keeps churn low and qualifies leads; the no-CC
   variant (`payment_method_collection: 'if_required'`) is available
   later if signup conversion becomes a problem.

---

## Phase 1 — Local prep (no external accounts needed)

Owen-action items in this phase: just review and approve.

- [x] CI gate (typescript / clippy `-D warnings` / pyright) — added
      this session
- [x] Fix repo-URL inconsistencies — `tauri.conf.json` updater endpoint,
      `scripts/generate-latest.mjs` default, `docs/RELEASE.md`,
      `docs/RELEASE_CHECKLIST.md`, and `macrovox-web` `/api/download` +
      footer link now all point at `okstudio1/macrovox-releases`.
- [x] Generate the Tauri updater ed25519 keypair via `tauri signer
      generate -w ~/.tauri/macrovox.key` (one-time). Public key
      (minisign ID `9B91F23A49E0246D`) wired into
      `tauri.conf.json → plugins.updater.pubkey`. Private key lives at
      `~/.tauri/macrovox.key` — store it (and its password) in 1Password
      and inject as `TAURI_SIGNING_PRIVATE_KEY` /
      `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars for `tauri build`.
- [x] Write `.github/workflows/release.yml`:
  - Triggered on tag push matching `v*.*.*`.
  - **Linux-only CI build, no CI publish** (alpha-osk pattern).
    Windows is built locally on the EV-cert host because the EV hardware
    token can't live in GitHub Actions and the correct order is
    `build → EV-sign → minisign`; splitting that across CI + local
    breaks one signature or the other.
  - Linux job: checkout, install Node + Rust + Linux system deps, run
    `npx tauri build`, then `npm run release:linux`, generate a
    Linux-only `latest.json`, upload everything as a workflow artifact
    named `linux-bundle`.
  - **No publish job in CI.** Owen runs the Windows build locally,
    `gh run download --name linux-bundle --dir release` to pull the
    Linux artifact, regenerates `latest.json` covering both platforms,
    then `gh release create v1.0.7 --repo okstudio1/macrovox-releases
    --draft <files>` from the local machine. Local `gh` auth has
    cross-repo write access, so no PAT secret is needed.
  - `TAURI_SIGNING_PRIVATE_KEY` + password injected via GitHub
    repository secrets for the Linux build. Other build secrets
    (Sentry DSN if added) the same way.
  - **Always lands as draft.** Owen walks the preflight checklist,
    then publishes manually.

## Phase 2 — Backend wiring (Stripe, Supabase, Netlify dashboards)

**Audited and verified end of 2026-04-26.** Most of the dashboard work is
done. Two follow-ups before the smoke test (see "Open blockers" above).

- [x] Managed-keys architecture decided (decision 2 above) —
      Deepgram per-user (in-DB), Anthropic shared (proxy env). Both
      already implemented; no code change needed.
- [x] **Stripe Dashboard:**
  - [x] Product "MacroVox" $6.99/mo Active. Price ID
        `price_1TKT6F1kamQkbkSVfYoIVAqs` matches both env-var slots.
  - [x] Webhook endpoint registered at
        `https://hlioqbizljywisvnbtat.supabase.co/functions/v1/stripe-webhook`,
        listening on `checkout.session.completed`,
        `customer.subscription.updated`, `customer.subscription.deleted`,
        `charge.refunded`. Signing secret stored in Supabase as
        `STRIPE_WEBHOOK_SECRET`. Delivery confirmed (HTTP 200 after
        the JWT-verify fix below).
  - [ ] Click "Save changes" on Customer Portal config — default
        `bpc_…` config exists but may be unsaved. Until saved,
        `billingPortal.sessions.create` returns "not configured".
- [x] **Supabase:**
  - [x] Tables `subscriptions`, `managed_api_keys`, `api_usage`
        present. The `api_usage` table was created today by running
        `supabase/migrations/20260411_create_api_usage.sql` via the
        SQL Editor — the migration had never been applied.
  - [x] Edge Functions `billing-portal`, `create-checkout`,
        `stripe-webhook` deployed.
  - [x] Edge Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
        `STRIPE_WEBHOOK_SECRET`, `DEEPGRAM_MANAGED_KEY` all set.
        `ANTHROPIC_MANAGED_KEY` deliberately not set — webhook stores
        it into a column the app never reads (cleanup in queue).
        `SITE_URL` not set — code has fallback to `macrovox.tech`.
        Auto-injected: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
        `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.
  - [x] **`verify_jwt = false`** for `stripe-webhook` (Stripe doesn't
        carry a Supabase JWT; the function verifies Stripe's HMAC
        itself). Toggled via dashboard **and** persisted in
        `supabase/config.toml` so it survives future redeploys.
        Without this, every webhook delivery returned 401.
  - [ ] Redeploy `create-checkout` so the trial code at
        `MacroVox@d620a39` takes effect:
        `supabase functions deploy create-checkout`.
- [x] **Netlify (`macrovox-web`):**
  - [x] Repo connected, deploys auto-trigger on master push.
  - [x] Env vars set: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`,
        `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
        `ANTHROPIC_MANAGED_KEY`, `DEEPGRAM_MANAGED_KEY`.
        `STRIPE_WEBHOOK_SECRET` deliberately NOT set here — Supabase
        owns the webhook.
  - [ ] **Add `SUPABASE_URL`** (server-only, same value as
        `NEXT_PUBLIC_SUPABASE_URL`). Without this, the proxies
        (`claude-proxy`, `deepgram-proxy`) 500 at runtime — every Pro
        dictation request fails.
  - [x] Proxies now hosted alongside the Next.js app
        (commit `macrovox-web@836661f`). Resolve at
        `https://macrovox.tech/.netlify/functions/{claude-proxy,deepgram-proxy}`,
        which is what the desktop app's `src/renderer/config.ts`
        already expects.
- [ ] **Smoke test end-to-end on a non-prod email** — Task #4. Run
      AFTER the two `[ ]` items above:
  - Sign up → trial checkout → webhook fires → `subscriptions` and
    `managed_api_keys` rows appear → desktop app proxy calls succeed
    → cancel via billing portal → keys revoked.

## Phase 3 — Public release

Chicken-and-egg phase: the app cannot auto-update from "no version"
to v1, so v1.0.7 ships as a fresh installer download.

- [x] Create `okstudio1/macrovox-releases` on GitHub (public, empty
      is fine). Done 2026-04-26, seeded with a README so it has a
      default branch.
- [x] Bump version to 1.0.7 in `package.json` + `tauri.conf.json`,
      collapse the CHANGELOG `## Unreleased` sections into
      `## v1.0.7 — YYYY-MM-DD`. Done in earlier session.
- [ ] Walk `RELEASE_CHECKLIST.md` end-to-end on the EV-cert host. Don't
      skip the clean-VM smoke test.
- [ ] `git tag v1.0.7 && git push --tags` → release workflow runs the
      Linux build and uploads a `linux-bundle` workflow artifact.
- [ ] On EV host: build Windows locally, `gh run download --name
      linux-bundle --dir release` to pull the Linux files, regenerate
      `release/latest.json` with both platforms, then
      `gh release create v1.0.7 --repo okstudio1/macrovox-releases
      --draft --title "MacroVox 1.0.7" release/windows/* release/linux/*
      release/latest.json`.
- [ ] Publish the draft. Confirm
      `curl -I https://github.com/okstudio1/macrovox-releases/releases/latest/download/latest.json`
      returns 200.
- [ ] Confirm `https://macrovox.tech/api/download` redirects to
      a real `.exe`.

## Phase 4 — Auto-update verification (the alpha-osk pitfall)

Test the update path *with two releases*, not one. v1 alone proves
nothing.

- [ ] Keep one machine on v1.0.6 (or whatever pre-release build).
      Publish v1.0.7. Confirm v1.0.6 detects the update on next launch,
      downloads, verifies signature against `pubkey`, and relaunches as
      v1.0.7.
- [ ] Negative test: serve a `latest.json` with a tampered signature
      from a staging URL, point a test build at it, confirm the client
      *rejects* the update.
- [ ] If splitting repos: confirm an unauthenticated curl can fetch
      `latest.json` from the public releases repo.

## Phase 5 — After ship

- [ ] Align marketing-site free-trial copy with the actual Stripe trial
      flow (decision 3).
- [ ] Watch Netlify function logs and Supabase auth/subscription tables
      for 48 h. Sentry would help — not currently integrated.
- [ ] Consider Netlify auto-deploy on push to `macrovox-web` `main`.
- [ ] macOS build (medium-term roadmap item).
- [ ] EV cert rotation calendar entry — Sectigo certs are generally 1-3
      years; set a reminder 60 days before expiry.

---

## Architecture quick reference

```
   ┌──────────────┐       ┌────────────────────┐
   │ macrovox-web │──────▶│  /api/download     │──▶ GitHub Releases
   │  (Next.js)   │       │  /api/checkout      ──▶ Stripe
   │              │       │  /api/stripe-webhook◀── Stripe events
   └──────┬───────┘       └────────────────────┘
          │
          │  user clicks Download
          ▼
   ┌──────────────────────────┐
   │ MacroVox.exe  (Tauri 2)  │ ◀── auto-updater fetches latest.json
   │                          │     verifies ed25519 signature
   │  Renderer (React)        │
   │   ├── Supabase JS SDK    │ ◀── /auth/v1/* (sign-in, session)
   │   └── usePostProcessing  │
   │                          │
   │  Backend (Rust)          │
   │   ├── cpal WASAPI capture│
   │   ├── Deepgram WS stream │
   │   └── enigo paste        │
   └─────────────┬────────────┘
                 │  bearer JWT
                 ▼
   ┌──────────────────────────┐
   │ Netlify Functions        │
   │  claude-proxy   (rate    │ ◀── reads ANTHROPIC_MANAGED_KEY (env)
   │  deepgram-proxy  -limit) │ ◀── reads DEEPGRAM_MANAGED_KEY  (env)
   └─────────────┬────────────┘
                 │  service-role
                 ▼
   ┌──────────────────────────┐
   │ Supabase                 │
   │  auth.users              │
   │  public.subscriptions    │ ◀── upserted by stripe-webhook EF
   │  public.managed_api_keys │ ◀── upserted by stripe-webhook EF
   │  public.api_usage        │     (rate-limit counters)
   └──────────────────────────┘
```
