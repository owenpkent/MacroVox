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

### Windows (always built locally)

Windows is **not** built in CI — the EV Authenticode cert is on a
hardware token on Owen's local Windows host, and the correct ordering
(build → EV-sign → minisign) requires both signing steps to run in
the same `tauri build` invocation.

`bundle.windows.signCommand` in `tauri.conf.json` invokes
`scripts/sign-windows.ps1`, which:
- skips `.dll` and other non-installer files (Tauri runs signCommand
  against every staged binary, including vendor Wix/NSIS plugins that
  don't need OK Studio's signature);
- signs `.exe` and `.msi` files via `signtool` against the SafeNet
  eToken with up to 5 retries (handles Windows Defender file locks
  during the build, same pattern as alpha-osk's `build/windows/sign.py`).

On the EV-cert Windows host, with the token plugged in:

```
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\macrovox.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<password>'
$env:PATH = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64;$env:PATH"
npx tauri build
npm run release:windows
```

(`TAURI_SIGNING_PRIVATE_KEY` accepts either the file contents or an
absolute path; the path form is shorter. Adjust the SDK version in the
PATH line to whatever's installed under `Windows Kits\10\bin`.)

This copies the NSIS installer (`-setup.exe`), MSI (`.msi`), and their
minisign signatures (`-setup.exe.sig`, `.msi.sig`) from
`src-tauri/target/release/bundle/{nsis,msi}/` into `release/windows/`.
In Tauri 2 the installer itself is the updater artifact — there's no
intermediate `.zip` step like v1 had.

> **Gotcha — shared cargo target dir.** This host redirects all Rust
> output to `C:\Users\Owen\cargo-target` via `~/.cargo/config.toml`, so
> bundles actually land in `C:\Users\Owen\cargo-target\release\bundle\{nsis,msi}\`,
> **not** `src-tauri/target/release/bundle/`. The `release:windows` npm
> script still reads the `src-tauri` path and will silently copy nothing.
> Until the script is fixed to honor `CARGO_TARGET_DIR`, copy the artifacts
> by hand:
>
> ```powershell
> $bundle = "C:\Users\Owen\cargo-target\release\bundle"
> Copy-Item "$bundle\nsis\MacroVox_<ver>_x64-setup.exe*" release\windows\ -Force
> Copy-Item "$bundle\msi\MacroVox_<ver>_x64_en-US.msi*"  release\windows\ -Force
> ```

### First release with no minisign password (EV-only fallback)

A full build requires `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` because
`createUpdaterArtifacts: true` makes Tauri fail loudly when the minisign
key can't be unlocked. If you need to cut a build but don't have the
minisign password available (and there are **no existing clients** that
would verify a `.sig` — e.g. the very first release in `macrovox-releases`),
you can ship an EV-signed installer **without** updater artifacts:

1. Temporarily set `bundle.createUpdaterArtifacts` to `false` in
   `tauri.conf.json`.
2. `npx tauri build` — only the SafeNet eToken PIN prompts; no minisign
   password needed. The `-setup.exe` / `.msi` are still EV-signed.
3. Revert `createUpdaterArtifacts` back to `true`.
4. Publish the installer, but **omit `latest.json`** (a manifest with an
   empty signature would be rejected by clients).

This was used for **v1.0.8**. The trade-off: clients on that version can't
auto-update until a *later* release ships with valid minisign sigs — so the
**next** release must set both env vars and include `latest.json`.

### Linux (built in CI, published locally)

The Linux bundle is built automatically by `.github/workflows/release.yml`
when a `v*.*.*` tag is pushed. The workflow runs `npx tauri build` and
`npm run release:linux` on `ubuntu-22.04`, generates a Linux-only
`latest.json`, and uploads everything as a workflow artifact named
`linux-bundle`. **The workflow does not create a GitHub release.**
You download the artifact during the publish step (Section 4).

This matches the alpha-osk pattern: CI builds, you publish from your
local machine using your own `gh` auth — no PAT or workflow secret is
needed for cross-repo writes to `okstudio1/macrovox-releases`.

To build Linux locally instead (Debian/Ubuntu recommended for `.deb`,
Fedora/RHEL for `.rpm`, any distro for AppImage):

```
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/macrovox.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<password>'
npx tauri build
npm run release:linux
```

This copies `.deb`, `.rpm`, the AppImage, and the AppImage minisign
signature (`*.AppImage.sig`) into `release/linux/`. In Tauri 2 the
AppImage itself is the updater artifact.

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
      "signature": "<contents of -setup.exe.sig>",
      "url": "https://github.com/okstudio1/macrovox-releases/releases/download/v1.0.7/MacroVox_1.0.7_x64-setup.exe"
    },
    "linux-x86_64": {
      "signature": "<contents of .AppImage.sig>",
      "url": "https://github.com/okstudio1/macrovox-releases/releases/download/v1.0.7/MacroVox_1.0.7_amd64.AppImage"
    }
  }
}
```

**Platform-key requirements:**
- `windows-x86_64` — artifact is the NSIS `*-setup.exe` (preferred) or the `*.msi`. The updater downloads and runs it directly. Same file end users download manually.
- `linux-x86_64` — artifact **must** be `*.AppImage`. The updater does not currently auto-install `.deb` / `.rpm` — those are for first install only. If a user installed via `.deb` / `.rpm`, they'll need to re-install manually; the in-app updater will skip.
- `darwin-x86_64` / `darwin-aarch64` — not yet shipped.

**Signatures:** `signature` values come from the `.sig` file Tauri writes
next to each updater artifact. The minisign keypair lives at
`~/.tauri/macrovox.key` (private) and `~/.tauri/macrovox.key.pub` (public,
already wired into `tauri.conf.json → plugins.updater.pubkey`,
key ID `9B91F23A49E0246D`).

For `tauri build` to emit `.sig` sidecars, two env vars must be set:

```
TAURI_SIGNING_PRIVATE_KEY           # contents of ~/.tauri/macrovox.key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD  # password chosen at key generation
```

In CI these come from the GitHub repo secrets of the same name (see
`.github/workflows/release.yml`). Locally, set them in the shell before
running `npx tauri build`. If they are missing, no `.sig` files are
produced and `generate-latest.mjs` will emit empty signature strings —
which clients on the current pubkey will reject, breaking auto-update.

---

## 3b. Generate SBOMs

Each release ships a CycloneDX Software Bill of Materials so downstream
users can audit exactly what's inside the binary. MacroVox has two
dependency graphs, so there are two SBOMs:

```
npm run release:sbom
```

This writes, into `release/sbom/`:

- `MacroVox_<ver>_sbom.npm.cyclonedx.json` (renderer, production deps only)
- `MacroVox_<ver>_sbom.cargo.cyclonedx.json` (every crate compiled into the backend)

The npm side runs `@cyclonedx/cyclonedx-npm` via `npx` (nothing to install).
The cargo side needs `cargo-cyclonedx` once: `cargo install cargo-cyclonedx`.
Both files are attached to the GitHub release in Section 4 so the SBOM
travels with the binary it describes.

---

## 4. Publish

1. Tag the commit: `git tag v1.0.7 && git push --tags`. CI starts the
   Linux build and uploads the bundle as a workflow artifact named
   `linux-bundle`. Nothing is published to GitHub Releases yet.
2. On the local EV-cert Windows host, run the Windows build (Section 2)
   to produce `release/windows/`.
3. Download the Linux artifact from the workflow run into `release/linux/`:
   ```
   gh run download --name linux-bundle --dir release
   ```
   (Or download manually from the Actions tab.) After this, `release/linux/`
   has the `.deb` / `.rpm` / `.AppImage` / `.sig` files.
4. Re-run `npm run release:manifest -- --version 1.0.7 --notes "..."`
   locally. With both `release/windows/` and `release/linux/` populated,
   the script emits a `latest.json` covering both platforms.
5. Create the draft release on `macrovox-releases` from your local
   machine (your `gh` auth has write access — no PAT needed):
   ```
   gh release create v1.0.7 \
     --repo okstudio1/macrovox-releases \
     --draft \
     --title "MacroVox 1.0.7" \
     --notes "MacroVox 1.0.7 — see CHANGELOG.md in the source repo." \
     release/windows/* release/linux/* release/sbom/* release/latest.json
   ```
   (`release/sbom/*` are the CycloneDX SBOMs from Section 3b.)
6. Walk `RELEASE_CHECKLIST.md` Section 6 (post-build verify), then
   click Publish on the draft release.
7. The `tauri.conf.json → plugins.updater.endpoints` entry points at
   `https://github.com/okstudio1/macrovox-releases/releases/latest/download/latest.json`,
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
