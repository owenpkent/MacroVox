# Release process

How MacroVox cuts a release. Covers Windows and Linux bundles and the
`latest.json` manifest consumed by `tauri-plugin-updater` for auto-update.

> **Before running any of the steps below, work through
> [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).** That document is the
> preflight gate (tests, smoke tests, signing, Dependabot status, doc updates).
> The steps here only describe the mechanics; the checklist decides whether
> the release should happen at all.

---

## 1. Bump the version

Update `src-tauri/tauri.conf.json` → `version`, and update `package.json` →
`version` to match. Tauri reads the conf.json value at build time; other
tooling (including the release scripts below) reads package.json.

Then add an entry at the top of [docs/CHANGELOG.md](CHANGELOG.md).

---

## 2. Build the bundles

### Windows

On a Windows host with the EV signing certificate installed:

```
npx tauri build
npm run release:windows
```

This copies the NSIS installer (`.exe`), MSI (`.msi`), and the updater
artifacts (`-setup.nsis.zip` + `.sig`, `-setup.msi.zip` + `.sig`) from
`src-tauri/target/release/bundle/{nsis,msi}/` into `release/windows/`.

### Linux

On a Linux host (Debian/Ubuntu recommended for `.deb`, Fedora/RHEL for
`.rpm`, any distro for AppImage):

```
npx tauri build
npm run release:linux
```

This copies `.deb`, `.rpm`, the AppImage, and the updater artifacts
(`*.AppImage.tar.gz` + `.sig`) into `release/linux/`.

The bundle metadata (deb `depends`, rpm `depends`, AppImage gstreamer flag,
Categories/Keywords in the `.desktop` file) is configured under
`bundle.linux` in `src-tauri/tauri.conf.json`. Custom desktop template lives
at `src-tauri/installer/linux/macrovox.desktop` and uses Handlebars
variables (`{{name}}`, `{{exec}}`, `{{icon}}`, `{{categories}}`,
`{{comment}}`) that Tauri substitutes at bundle time.

---

## 3. Generate `latest.json`

Tauri's auto-updater consumes a JSON manifest with per-platform entries.
Run:

```
npm run release:manifest -- --version 1.0.7 --notes "Release notes here"
```

Output lands at `release/latest.json`. Example shape:

```json
{
  "version": "1.0.7",
  "notes": "Release notes here",
  "pub_date": "2026-04-19T18:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<from .nsis.zip.sig>",
      "url": "https://github.com/owenpkent/MacroVox/releases/download/v1.0.7/MacroVox_1.0.7_x64-setup.nsis.zip"
    },
    "linux-x86_64": {
      "signature": "<from .AppImage.tar.gz.sig>",
      "url": "https://github.com/owenpkent/MacroVox/releases/download/v1.0.7/MacroVox_1.0.7_amd64.AppImage.tar.gz"
    }
  }
}
```

**Platform-key requirements:**
- `windows-x86_64` — artifact must be `*-setup.nsis.zip` or `*-setup.msi.zip`; the plain `.exe`/`.msi` is for users, the `.zip` is what the updater downloads and extracts.
- `linux-x86_64` — artifact **must** be `*.AppImage.tar.gz`. The updater does not currently auto-install `.deb` / `.rpm` — those are for first install only. If a user installed via `.deb` / `.rpm`, they'll need to re-install manually; the in-app updater will skip.
- `darwin-x86_64` / `darwin-aarch64` — not yet shipped.

**Signatures:** `signature` values come from the `.sig` file Tauri writes
next to each updater artifact when an updater pubkey is set. If
`tauri.conf.json → plugins.updater.pubkey` is empty (the current default),
`generate-latest.mjs` emits an empty string and auto-update is effectively
disabled — users can still install manually.

---

## 4. Publish

1. Tag the commit: `git tag v1.0.7 && git push --tags`.
2. Create a GitHub release for the tag.
3. Attach **all** files in `release/windows/` and `release/linux/`, plus `release/latest.json`.
4. The `tauri.conf.json → plugins.updater.endpoints` entry points at
   `https://github.com/owenpkent/MacroVox/releases/latest/download/latest.json`,
   so existing installs will pick up the new version on their next launch.

---

## Known platform limits

- **Wayland (Linux)** — auto-paste is disabled (`enigo` has no reliable
  Wayland key-injection path); global hotkeys depend on the compositor's
  XDG portal. Both are detected at runtime via
  `src-tauri/src/platform.rs::is_wayland`.
- **macOS** — not yet built.
- **Signed `.deb` / `.rpm`** — not yet part of the release flow. GPG-signing
  the `.deb` with `dpkg-sig` is the recommended next step for Debian/Ubuntu
  repository distribution.
