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

On the EV-cert Windows host:

- [ ] `npx tauri build` produces `.exe`, `.msi`, and the matching `*-setup.nsis.zip` / `*-setup.msi.zip` updater artifacts in `src-tauri/target/release/bundle/{nsis,msi}/`
- [ ] `npm run release:windows` copies all of the above into `release/windows/`, including the `.sig` sidecar files
- [ ] EV signature on the installer: right-click `.exe` → Properties → Digital Signatures shows "OK Studio" (or run `signtool verify /pa /v <path>`)
- [ ] **Clean-VM smoke test** on a Windows 11 VM with no prior MacroVox install:
  - [ ] NSIS installer runs end-to-end without SmartScreen warnings
  - [ ] First-run sign-in (Supabase email/password) succeeds
  - [ ] Streaming transcription: hold `Ctrl+Space`, speak, release — transcript appears, auto-paste fires into the previously focused window
  - [ ] Batch transcription works (Settings → Voice Recognition → Batch mode)
  - [ ] **Voice History playback runs at real-time speed** (regression check for the OGG Opus rate fix in v1.0.7)
  - [ ] Auto-update path: install the previous published version first, point `tauri.conf.json` updater endpoint at staging or `release/latest.json` served locally, launch — verify the in-app updater detects the new version, downloads, and relaunches
- [ ] `release/latest.json` `signature` for `windows-x86_64` matches the contents of `*-setup.nsis.zip.sig` and the `pub_date` is the current UTC time

---

## 4. Linux build verification (optional — required only if shipping Linux this release)

On a Debian/Ubuntu host (and a Fedora host if shipping `.rpm`):

- [ ] `npx tauri build && npm run release:linux` produces `.deb`, `.rpm`, AppImage, and `*.AppImage.tar.gz` + `.sig` in `release/linux/`
- [ ] `.deb` installs on a clean Ubuntu 22.04 VM (`sudo dpkg -i` or `apt install ./...`); `apt` resolves `libwebkit2gtk-4.1-0`, `libgtk-3-0`, `libasound2`, `libpulse0` without errors
- [ ] `.rpm` installs on a clean Fedora VM if shipping `.rpm`
- [ ] AppImage runs from a stock distro (no `--appimage-extract-and-run` workarounds)
- [ ] Smoke test on **X11** session: dictation flow, auto-paste, voice history playback all work
- [ ] Smoke test on **Wayland** session: clipboard copy succeeds, the Settings → Auto-paste toggle is rendered disabled with the inline explanation, global hotkey behaves per compositor's portal
- [ ] Mic picker shows real devices only (no `hw:`, `plughw:`, `dmix:`, `surround*:` entries)
- [ ] `release/latest.json` includes `linux-x86_64` with signature from `*.AppImage.tar.gz.sig`

---

## 5. Distribution / infra

- [ ] EV signing certificate not expiring within 30 days (check the cert's "Valid to" field)
- [ ] `tauri.conf.json` `plugins.updater.pubkey` matches the private key used to sign the `.sig` artifacts (otherwise installed clients reject the update)
- [ ] Netlify functions environment variables present and current on the production site (Supabase URL/key, Anthropic key, Deepgram key, Stripe keys if billing is live)
- [ ] Supabase RLS policies on `subscriptions` and `managed_api_keys` haven't been changed unintentionally this cycle
- [ ] GitHub release **draft** prepared with notes derived from CHANGELOG; do not publish yet

---

## 6. Tag, publish, verify

Run only after every required item above is ticked:

- [ ] `git tag v1.0.X && git push --tags`
- [ ] Create the GitHub release on the tag, attach **all** files in `release/windows/`, `release/linux/` (if shipping), and `release/latest.json`
- [ ] Publish the release
- [ ] `curl -I https://github.com/owenpkent/MacroVox/releases/latest/download/latest.json` returns `200` (the URL Tauri's updater hits)
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
