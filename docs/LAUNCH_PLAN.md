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

## Where we actually are (updated 2026-04-26)

- **App code:** v1.0.7 bumped, CHANGELOG consolidated, all gates green
  (Vitest 20/20, `cargo test` 55/55, `tsc --noEmit` ×2, `cargo clippy
  -D warnings`).
- **EV signing pipeline:** working end-to-end on a single `tauri build`
  via `scripts/sign-windows.ps1` (filters vendor DLLs, retries on
  Defender locks). Signed v1.0.7 `.exe` + `.msi` + `.sig` sidecars
  staged in `release/windows/`; `release/latest.json` regenerated with
  the correct version + signature + URL. `signtool verify /pa` passes.
- **Updater code:** `tauri-plugin-updater` is wired with a real pubkey
  (minisign key ID `9B91F23A49E0246D`).
  `bundle.createUpdaterArtifacts: true`, so missing signing env vars
  fail the build loudly.
  **Endpoint mismatch:** `tauri.conf.json` points at
  `https://github.com/okstudio1/macrovox-releases/releases/latest/download/latest.json`
  but that repo doesn't exist — see "Open blockers" below.
- **CI:** `.github/workflows/ci.yml` (typescript / clippy / pyright on
  every push to `main`) green.
  `.github/workflows/release.yml` (tag-triggered, builds Linux only
  in CI; Windows is built locally because of the EV hardware token)
  has not yet fired since no `v*.*.*` tag exists yet.
- **Auth + billing code:** Supabase auth UI, Netlify proxies (Claude,
  Deepgram), and Supabase Edge Functions (`create-checkout`,
  `billing-portal`, `stripe-webhook`) are all written. **Untested
  end-to-end on the live site** — see "First-account smoke test"
  below.
- **Marketing site (`C:\Users\Owen\dev\macrovox-web`):** Next.js on
  Netlify; landing/pricing/login/signup/dashboard pages exist;
  `/api/download` redirects to GitHub Releases latest `.exe` —
  currently 404s because no release exists. **No code changes
  needed**, just the live-site smoke test.

## Open blockers before v1.0.7 ship

1. **Decide where v1.0.7 publishes.** `okstudio1/macrovox-releases` is
   404 today, but `tauri.conf.json` points at it. Two paths:
   - **(a) Create the releases repo** (`gh repo create
     okstudio1/macrovox-releases --public`) and update
     `release.yml` to publish there cross-repo (needs a PAT with
     write access on the new repo, exposed as a workflow secret).
   - **(b) Point the updater at the source repo.** Change
     `plugins.updater.endpoints` in `tauri.conf.json` to
     `https://github.com/okstudio1/MacroVox/releases/latest/download/latest.json`.
     Source repo is already public (Dependabot is configured), so
     this isn't a privacy regression. Simplest path; can revisit if
     the source ever needs to go private. **Recommended for v1.0.7.**

2. **Clean-VM smoke test on Windows 11** (Section 3 of
   `RELEASE_CHECKLIST.md`). Required before tagging. Not yet done.

## Remaining release steps (in order)

3. Resolve blocker #1 (point updater at source repo OR create
   `macrovox-releases`).
4. Run blocker #2 (clean-VM smoke test).
5. `git tag v1.0.7 && git push --tags` — CI's `release.yml` builds
   Linux, opens a draft GitHub release.
6. Attach `release/windows/*` to the draft, regenerate `latest.json`
   locally with both platforms, replace the Linux-only `latest.json`
   on the draft.
7. Publish the draft.
8. Verify: existing v1.0.6 install picks up v1.0.7 on relaunch.
9. Post-release watch (24–48 h).

## Launch validation & marketing (parallel, doesn't block tag)

- **First-account end-to-end test** on the live site
  (`https://macrovox.netlify.app`, production): signup → email
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

## Decisions needed from Owen before phase 3

1. **Repo visibility model.** ✅ **Decided: split (option B).**
   `okstudio1/MacroVox` (source) stays as-is. `okstudio1/macrovox-releases`
   (public, binaries-only) needs to be created on GitHub before v1.0.7
   ships. All updater + website plumbing has been updated to point at it.

2. **Managed-API-key delivery model.** The Stripe webhook provisions
   per-user rows in `managed_api_keys`, but the Netlify proxies
   currently forward using shared env-var keys (`ANTHROPIC_MANAGED_KEY`,
   `DEEPGRAM_MANAGED_KEY`). Pick:
   - **Shared keys (status quo):** simpler, fewer Supabase round-trips
     per request, but a leaked key affects every Pro user and rotation
     is global.
   - **Per-user keys:** the proxies read each user's row at request
     time. Better isolation, easier individual revocation, slightly
     slower (one Supabase select per request, cacheable).
   - One side or the other needs to change so they're consistent.

3. **Free-trial copy alignment.** Landing page promises "7-day free
   trial without a credit card." Stripe Checkout requires a payment
   method by default. Pick:
   - **Rewrite copy** to "7-day free trial — cancel anytime." Zero
     code, ships today.
   - **Build no-CC trial** via a server-side trial flag in Supabase
     and gate Pro features without Stripe involvement until day 7.
     Real work; estimate 1–2 days.

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
  - **Linux-only CI build.** Windows is built locally on the EV-cert
    host because the EV hardware token can't live in GitHub Actions and
    the correct order is `build → EV-sign → minisign`; splitting that
    across CI + local breaks one signature or the other.
  - Linux job: checkout, install Node + Rust + Linux system deps, run
    `npx tauri build`, then `npm run release:linux`, upload artifacts.
  - Publish job: downloads the Linux bundle, runs
    `npm run release:manifest`, opens a draft GitHub release with the
    Linux files attached.
  - Owen separately runs the local Windows build, attaches `.exe`,
    `.msi`, and their `.sig` sidecars to the same draft, then
    regenerates `latest.json` locally so it includes both platforms,
    replaces the Linux-only `latest.json` on the draft, and publishes.
  - `TAURI_SIGNING_PRIVATE_KEY` + password injected via GitHub
    repository secrets. Other build secrets (Sentry DSN if added) the
    same way.
  - **Does not** auto-publish. Always lands as draft, Owen ticks the
    preflight, then publishes manually.

## Phase 2 — Backend wiring (Stripe, Supabase, Netlify dashboards)

Needs Owen logged into the dashboards. I can prepare the migrations and
config snippets but the dashboard clicks are yours.

- [ ] Decide managed-keys architecture (decision 2 above) — implement
      whichever side needs to change.
- [ ] Stripe Dashboard:
  - Create Product "MacroVox Pro" with monthly Price $6.99.
  - Save Price ID for env vars.
  - Add a webhook endpoint pointing at the deployed Supabase Edge
    Function URL (`https://hlioqbizljywisvnbtat.supabase.co/functions/v1/stripe-webhook`),
    listening on `checkout.session.completed`,
    `customer.subscription.updated`, `customer.subscription.deleted`.
  - Save the webhook signing secret.
- [ ] Supabase:
  - Run `supabase/migrations/20260411_create_api_usage.sql`.
  - Deploy Edge Functions:
    `supabase functions deploy create-checkout billing-portal stripe-webhook`.
  - Set Edge Function env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
    `STRIPE_PRICE_ID`, `DEEPGRAM_MANAGED_KEY`, `ANTHROPIC_MANAGED_KEY`,
    `SITE_URL`.
- [ ] Netlify (`macrovox-web`):
  - Connect repo, deploy.
  - Set env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
    `ANTHROPIC_MANAGED_KEY`, `DEEPGRAM_MANAGED_KEY`,
    `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`,
    `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_*` keys.
- [ ] Smoke test end-to-end on a non-prod email:
  - Sign up → checkout → webhook fires → `subscriptions` and
    `managed_api_keys` rows appear → app proxy calls succeed → cancel
    via billing portal → keys revoked.

## Phase 3 — Public release

Chicken-and-egg phase: the app cannot auto-update from "no version"
to v1, so v1.0.7 ships as a fresh installer download.

- [ ] Create `okstudio1/macrovox-releases` on GitHub (public, empty
      is fine — it just needs to exist so the release workflow can push
      tags + release artifacts to it). Wiring is already done.
- [ ] Bump version to 1.0.7 in `package.json` + `tauri.conf.json`,
      collapse the CHANGELOG `## Unreleased` sections into
      `## v1.0.7 — YYYY-MM-DD`.
- [ ] Walk `RELEASE_CHECKLIST.md` end-to-end on the EV-cert host. Don't
      skip the clean-VM smoke test.
- [ ] `git tag v1.0.7 && git push --tags` → release workflow fires →
      draft release on `okstudio1/macrovox-releases` with artifacts.
- [ ] Publish the draft. Confirm
      `curl -I https://github.com/okstudio1/macrovox-releases/releases/latest/download/latest.json`
      returns 200.
- [ ] Confirm `https://<your-domain>/api/download` redirects to a real
      `.exe`.

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
