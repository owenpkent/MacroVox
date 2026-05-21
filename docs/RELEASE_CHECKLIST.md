# Release preflight checklist

Copy this file into the GitHub release issue and tick items off as you go. The
mechanics (bundle commands, manifest generation, publish steps) live in
[RELEASE.md](RELEASE.md) — this checklist is the **gate** that decides whether
those steps should run.

**Required to ship:** every Windows item. Linux is beta — the Linux block is
required only if shipping a Linux release this cycle (skip otherwise and note
"Linux: not shipping this release" on the GitHub issue).

---

## 1. Code quality (must pass)

- [ ] `npm test` — Vitest renderer suite green
- [ ] `npm run test:rust` — Rust unit tests green (currently 55+ tests)
- [ ] `npm run typecheck` (or `npx tsc -p config/tsconfig.main.json --noEmit`) — no type errors
- [ ] `npm run build` — clean renderer + main build, no warnings worth investigating
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml --release` — release-mode Rust build succeeds
- [ ] No outstanding **High** or **Critical** Dependabot alerts on `main`
      (`gh api repos/okstudio1/MacroVox/dependabot/alerts --jq '.[] | select(.state=="open") | select(.security_advisory.severity == "high" or .security_advisory.severity == "critical")'`).
      Medium/Low alerts pinned by upstream (Tauri's `glib`, `phf_codegen`'s `rand 0.7.3`) are documented in CHANGELOG and acceptable.
- [ ] Working tree clean (`git status`), `main` is the branch being released

---

## 2. Documentation

- [ ] `docs/CHANGELOG.md` — collapse all `## Unreleased — *` sections into a single `## v1.0.X — YYYY-MM-DD` heading, top of file
- [ ] `package.json` `version` and `src-tauri/tauri.conf.json` `version` match each other and match the planned tag
- [ ] `docs/STATUS_AND_ROADMAP.md` — Windows App row reflects the new version; any "🔧 In Progress" rows that shipped this cycle are flipped to "✅"
- [ ] README — feature list still accurate, screenshots not stale
- [ ] If breaking changes for end users: an upgrade note in the GitHub release body

---

## 3. Windows build verification (required)

Windows is built **locally** on the EV-cert host, not in CI. CI's `windows-latest`
runner has no EV hardware token, and the correct ordering is `build → EV-sign → minisign`
— if EV-signing happens after the minisign `.sig` is generated, the `.exe` bytes
change and the published `.sig` no longer matches, breaking auto-update. Tauri
solves this via `bundle.windows.signCommand` in `tauri.conf.json` which has to
run on a host with the token plugged in.

On the EV-cert Windows host:

- [ ] `bundle.windows.signCommand` in `tauri.conf.json` invokes `scripts/sign-windows.ps1` (the wrapper that filters out vendor DLLs and retries on Defender file locks)
- [ ] `signtool.exe` is on `PATH` for the build shell — typically `C:\Program Files (x86)\Windows Kits\10\bin\<latest>\x64`. Verify with `Get-Command signtool.exe`.
- [ ] `npx tauri build` produces `.exe`, `.msi`, and matching `.exe.sig` / `.msi.sig` minisign sidecars in `src-tauri/target/release/bundle/{nsis,msi}/`. The `.sig` is computed over the **EV-signed** bytes — order is enforced by Tauri's bundler when `signCommand` is configured. Sidecars only appear when `TAURI_SIGNING_PRIVATE_KEY[_PASSWORD]` env vars are set; if missing, the build fails because `bundle.createUpdaterArtifacts` is `true`.
- [ ] EV signature on the installer: right-click `.exe` → Properties → Digital Signatures shows "OK Studio" (or run `signtool verify /pa /v <path>`)
- [ ] `npm run release:windows` copies all of the above into `release/windows/`
- [ ] **Clean-VM smoke test** on a Windows 11 VM with no prior MacroVox install:
  - [ ] NSIS installer runs end-to-end without SmartScreen warnings
  - [ ] First-run sign-in (Supabase email/password) succeeds
  - [ ] Streaming transcription: hold `Ctrl+Space`, speak, release — transcript appears, auto-paste fires into the previously focused window
  - [ ] Batch transcription works (Settings → Voice Recognition → Batch mode)
  - [ ] **Voice History playback runs at real-time speed** (regression check for the OGG Opus rate fix in v1.0.7)
  - [ ] Auto-update path: install the previous published version first, point `tauri.conf.json` updater endpoint at staging or `release/latest.json` served locally, launch — verify the in-app updater detects the new version, downloads, and relaunches
- [ ] `release/latest.json` `signature` for `windows-x86_64` matches the contents of `*-setup.exe.sig` and the `pub_date` is the current UTC time

---

## 4. Linux build verification (optional — required only if shipping Linux this release)

On a Debian/Ubuntu host (and a Fedora host if shipping `.rpm`):

- [ ] `npx tauri build && npm run release:linux` produces `.deb`, `.rpm`, the `.AppImage`, and the matching `.AppImage.sig` in `release/linux/`
- [ ] `.deb` installs on a clean Ubuntu 22.04 VM (`sudo dpkg -i` or `apt install ./...`); `apt` resolves `libwebkit2gtk-4.1-0`, `libgtk-3-0`, `libasound2`, `libpulse0` without errors
- [ ] `.rpm` installs on a clean Fedora VM if shipping `.rpm`
- [ ] AppImage runs from a stock distro (no `--appimage-extract-and-run` workarounds)
- [ ] Smoke test on **X11** session: dictation flow, auto-paste, voice history playback all work
- [ ] Smoke test on **Wayland** session: clipboard copy succeeds, the Settings → Auto-paste toggle is rendered disabled with the inline explanation, global hotkey behaves per compositor's portal
- [ ] Mic picker shows real devices only (no `hw:`, `plughw:`, `dmix:`, `surround*:` entries)
- [ ] `release/latest.json` includes `linux-x86_64` with signature from `*.AppImage.sig`

---

## 5. Distribution / infra

- [ ] EV signing certificate not expiring within 30 days (check the cert's "Valid to" field)
- [ ] `tauri.conf.json` `plugins.updater.pubkey` matches the private key used to sign the `.sig` artifacts (otherwise installed clients reject the update)
- [ ] **okstudio1 org Actions budget is non-zero with `Stop usage: No`** ([Budgets and alerts](https://github.com/organizations/okstudio1/settings/billing/budgets)). With GitHub's unified budgets, a `$0 budget` + `Stop usage: Yes` row halts workflow runs the moment any metered usage is recorded — even when usage is fully covered by the included Actions quota. Personal-account budgets (`owenpkent`) are a separate ledger and do **not** unblock org-owned repos. The tag-triggered `release.yml` Linux build won't even start if this row is in stop-usage state, so verify before tagging.
- [ ] Netlify functions environment variables present and current on the production site (Supabase URL/key, Anthropic key, Deepgram key, Stripe keys if billing is live)
- [ ] Supabase RLS policies on `subscriptions` and `managed_api_keys` haven't been changed unintentionally this cycle
- [ ] GitHub release **draft** prepared with notes derived from CHANGELOG; do not publish yet

---

## 6. Tag, publish, verify

Run only after every required item above is ticked. Publishing is local
(alpha-osk pattern) — CI only builds Linux into a workflow artifact.

- [ ] `git tag v1.0.X && git push --tags` — fires `release.yml`, builds Linux, uploads `linux-bundle` artifact
- [ ] If shipping Linux: `gh run download --name linux-bundle --dir release` once the workflow finishes — pulls Linux files into `release/linux/` alongside the locally-built `release/windows/`
- [ ] Regenerate `release/latest.json` locally with both platforms: `npm run release:manifest -- --version 1.0.X --notes "…"`
- [ ] `gh release create v1.0.X --repo okstudio1/macrovox-releases --draft --title "MacroVox 1.0.X" release/windows/* release/linux/* release/latest.json` (omit `release/linux/*` if Linux not shipping). Local `gh` auth handles cross-repo write — no PAT needed.
- [ ] Publish the draft release
- [ ] `curl -I https://github.com/okstudio1/macrovox-releases/releases/latest/download/latest.json` returns `200` (the URL Tauri's updater hits)
- [ ] One existing-install machine (your own) auto-updates on relaunch and lands on the new version

---

## 7. Post-release watch (next 24–48 h)

- [ ] Watch Netlify function logs for spikes in 4xx/5xx
- [ ] Watch Supabase auth + subscriptions tables for unexpected churn
- [ ] If a Sentry/error-reporting integration exists, watch it
- [ ] If a regression surfaces, prepare a hotfix branch off the tag rather than rolling forward on `main`

---

## Skipping items

If you skip an item, write the reason in the GitHub release issue (not in this
file). Common acceptable skips: "Linux not shipping this cycle", "no UI changes
so screenshots not refreshed". Skipping the smoke tests, signature checks, or
the Dependabot gate is **not** acceptable — fix or defer the release.
