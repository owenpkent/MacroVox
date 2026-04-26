# MacroVox Security Audit — 2026-04-19

Delta audit covering only the Linux UI + release-readiness changes on top of
the previous pass (`SECURITY_AUDIT_2026-04-16.md`). Prior findings are not
re-reviewed here — they stand on that document.

Scope: all uncommitted changes on `main` prior to the commit that records
this audit, comprising:

- `src-tauri/src/platform.rs` — new `is_wayland()` env-var probe.
- `src-tauri/src/commands.rs` — new `platform_info` command, new
  `filter_device_list` ALSA-noise filter, Wayland short-circuit in
  `dictation_auto_paste`.
- `src-tauri/src/lib.rs` — registers `platform_info`.
- `src-tauri/tauri.conf.json` — removes `alwaysOnTop` from settings window,
  adds `bundle.linux` (deb/rpm/appimage) config + app-level metadata.
- `src-tauri/installer/linux/macrovox.desktop` — Handlebars template.
- `src/renderer/components/DictationMode.tsx` — startup effect that
  restores `dictation_always_on_top` + `selected_mic_device` from
  `localStorage`.
- `src/renderer/components/SettingsPanel.tsx` — persists mic choice to
  `localStorage`; disables auto-paste UI on Wayland.
- `src/renderer/index.css` — global `select { appearance: none }` +
  inline-SVG data-URL chevron.
- `src/renderer/lib/tauri-ipc.ts` — `PlatformInfo` type + `getPlatformInfo()`.
- `scripts/generate-latest.mjs` — dev-machine release-manifest generator.
- `package.json` — updated `release:*` npm scripts.

## Executive summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 0     |
| Medium   | 0     |
| Low      | 0     |

**No vulnerabilities introduced by this batch.** The audit was conducted
with the `/security-review` workflow: a Phase-1 enumeration sub-agent read
the full 585-line diff plus the surrounding Rust, TS, and Tauri config; no
finding reached the ≥7 confidence bar, so no Phase-2 false-positive filter
pass was required.

## What was checked and why it's clean

- **`is_wayland()` env-var reads** — `XDG_SESSION_TYPE` / `WAYLAND_DISPLAY`
  are trusted env vars per project scope. The helper returns a bool; no
  string flows to shell, filesystem, or query sinks.
- **`filter_device_list`** — pure static-prefix string comparison over
  device names already enumerated by `cpal`. No execution sink and no path
  construction.
- **`platform_info` IPC command** — returns `{ os:
  std::env::consts::OS, is_wayland: bool }`. Both values are trivially
  inferable from the user agent / runtime environment; not PII.
- **`dictation_auto_paste` Wayland guard** — strictly reduces attack
  surface (one fewer `enigo` key-injection path on Wayland); returns a
  hardcoded English error string.
- **Renderer `localStorage` round-trip** — `dictation_always_on_top`
  coerces via `!== 'false'` (bool); `selected_mic_device` is forwarded to
  `audio_set_device`, which stores it in a `Mutex<Option<String>>`. The
  string never flows into a shell, path, SQL, template, or
  `dangerouslySetInnerHTML` sink. Client-side validation gaps are out of
  scope per project threat model (the backend is the trust boundary).
- **`bundle.linux` config + `macrovox.desktop` Handlebars template** — all
  substitution values (`{{name}}`, `{{exec}}`, `{{icon}}`, `{{categories}}`,
  `{{comment}}`) are populated by Tauri's bundler from developer-authored
  `tauri.conf.json` fields baked at build time. Not runtime user input;
  template injection requires attacker control of the repo, which is
  outside the trust boundary.
- **`scripts/generate-latest.mjs`** — runs only on the release-builder
  machine. Inputs are developer-supplied CLI args and locally staged
  artifact files. Output is built with `JSON.stringify` (proper escaping);
  `.sig` sidecar contents flow into a JSON string value. No `exec`/`spawn`,
  no outbound fetch, no path constructed from untrusted input.
- **`index.css`** — static literal CSS with an inline-SVG data URL. No
  attacker-controllable input.
- **`tauri.conf.json` settings-window `alwaysOnTop` removal** — not a
  security property; purely a UX/focus behavior.
- **IPC capabilities** — unchanged by this batch. `platform_info` ships via
  the existing invoke channel already scoped to `main` + `settings`
  webviews in `src-tauri/capabilities/default.json`.

## Out of scope but worth noting (carried over)

- `plugins.updater.pubkey` in `tauri.conf.json` is still empty. Unchanged
  by this PR, but worth tracking: until it's populated and the release
  flow produces signed `.sig` sidecars, the `scripts/generate-latest.mjs`
  generator will emit empty `signature` strings, and auto-update on both
  Windows and Linux is effectively disabled. This was already called out
  in the 2026-04-16 audit (§ C1) and remains an owner-action item.

  **Resolved 2026-04-26:** keypair generated, public key (ID `9B91F23A49E0246D`)
  wired into `tauri.conf.json`, `bundle.createUpdaterArtifacts: true` set,
  EV signing wrapper at `scripts/sign-windows.ps1` integrated. `tauri build`
  now emits valid `.sig` sidecars; smoke-test bundle for v1.0.6 verifies
  end-to-end against the new pubkey. See CHANGELOG entry "Release pipeline + EV signing".
