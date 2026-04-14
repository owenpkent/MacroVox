# MacroVox Distribution Flow

How the app gets from source code to the end user's machine.

---

## Current Architecture

```
Source Code (GitHub)
    ↓
Tauri Build (cargo + vite)
    ↓
NSIS Installer (.exe) + Portable (.exe)
    ↓
EV Code Signing (Sectigo certificate)
    ↓
GitHub Releases (manual upload)
    ↓
Website (macrovox.netlify.app/dashboard → download link)
    ↓
End User
```

---

## Build Pipeline

### 1. Local Build

```bash
# Build the renderer (Vite → dist/renderer/)
npm run build:renderer

# Build the Tauri app (Rust + bundle NSIS installer)
cd src-tauri && cargo tauri build
```

**Output** (in `src-tauri/target/release/bundle/`):
- `nsis/MacroVox_1.0.6_x64-setup.exe` — NSIS installer
- `nsis/MacroVox_1.0.6_x64_en-US.msi` — MSI installer (alternative)

### 2. Code Signing

The installer must be EV code-signed to avoid Windows SmartScreen warnings. Without signing, users see "Windows protected your PC" and most won't proceed.

**Current process** (manual):
1. Build the unsigned installer
2. Sign with `signtool.exe` using the EV certificate (USB token + PIN)
3. Verify signature: `signtool verify /pa MacroVox_x64-setup.exe`

**EV Certificate details**:
- Issuer: Sectigo
- Type: Extended Validation (EV) — builds SmartScreen reputation immediately
- Hardware: USB token (SafeNet/Thales) — required for EV, cannot be automated in CI

### 3. Upload to GitHub Releases

```bash
# Create a new release tag
git tag v1.0.7
git push origin v1.0.7

# Create the release with the signed installer
gh release create v1.0.7 \
  "MacroVox_1.0.7_x64-setup.exe" \
  --title "MacroVox v1.0.7" \
  --notes "Release notes here"
```

### 4. Website Download Link

The dashboard at `macrovox.netlify.app/dashboard` links to:
```
https://github.com/owenpkent/MacroVox/releases/latest
```

This always resolves to the most recent release, so no website update is needed per release.

---

## What Needs to Happen Before Launch

### Pre-requisites (one-time setup)

- [x] EV code signing certificate obtained
- [x] NSIS installer configured (`tauri.conf.json` bundler settings)
- [x] GitHub Releases as distribution channel
- [x] Website with download link on dashboard
- [ ] **Stripe product created** (\$6.99/month MacroVox Pro)
- [ ] **Netlify env vars set** (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_MANAGED_KEY, DEEPGRAM_MANAGED_KEY)
- [ ] **Supabase Edge Functions deployed** (create-checkout, billing-portal, stripe-webhook)
- [ ] **Stripe webhook endpoint configured** → Supabase Edge Function URL
- [ ] **`api_usage` table migration run** in Supabase

### Per-release checklist

1. **Bump version** in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
2. **Build**: `npm run build:renderer && cd src-tauri && cargo tauri build`
3. **Sign**: `signtool sign /sha1 <thumbprint> /tr http://timestamp.sectigo.com /td sha256 /fd sha256 MacroVox_x64-setup.exe`
4. **Test the signed installer** on a clean Windows VM
5. **Tag + push**: `git tag v1.0.X && git push origin v1.0.X`
6. **Create GitHub Release**: upload signed `.exe`, write release notes
7. **Verify**: download from GitHub Releases link, install, test dictation flow
8. **Update CHANGELOG.md** with release notes

---

## End-User Flow

```
1. User visits macrovox.netlify.app
2. Signs up (email/password via Supabase Auth)
3. Subscribes to Pro ($6.99/mo via Stripe checkout)
4. Stripe webhook provisions managed API keys (Deepgram + Anthropic)
5. User downloads installer from dashboard → GitHub Releases
6. Runs installer (EV signed — no SmartScreen warning)
7. MacroVox installs to C:\Program Files\MacroVox
8. App launches, user signs in with same email/password
9. App retrieves managed API keys from Supabase
10. User starts dictating with Ctrl+Space
```

---

## Future: CI/CD Automation

The EV certificate USB token makes full CI/CD impossible (requires physical hardware + PIN). Options to explore:

### Option A: Cloud Code Signing (recommended)
- **Azure Trusted Signing** or **SSL.com eSigner** — cloud HSM services that support CI/CD
- Sign in the CI pipeline without physical USB token
- Cost: ~\$20-50/month

### Option B: Self-hosted signing server
- Dedicated Windows machine with USB token plugged in
- CI calls a signing API endpoint on that machine
- More complex to maintain

### Option C: Tauri Updater (auto-updates)
- Tauri has a built-in updater plugin (`tauri-plugin-updater`)
- Serves update manifests from a URL (GitHub Releases or custom endpoint)
- App checks for updates on launch and can self-update
- Requires signing updates with a separate key pair (not the EV cert)
- Best UX — users never manually download again after first install

### Recommended CI pipeline (future)

```
GitHub Actions
    ↓ push to main / tag
Build (Windows runner)
    ↓
Sign (Azure Trusted Signing or signing server)
    ↓
Upload to GitHub Releases (gh CLI)
    ↓
Tauri Updater manifest updated
    ↓
Existing installs auto-update
```

---

## Auto-Update Strategy (Tauri Updater)

Tauri's updater plugin checks a JSON endpoint for new versions:

```json
{
  "version": "1.0.7",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-04-15T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/okstudio1/MacroVox/releases/download/v1.0.7/MacroVox_1.0.7_x64-setup.nsis.zip"
    }
  }
}
```

**Setup**:
1. Add `tauri-plugin-updater` to Cargo.toml
2. Generate update signing keys: `cargo tauri signer generate -w ~/.tauri/macrovox.key`
3. Configure updater endpoint in `tauri.conf.json`
4. Host the JSON manifest (GitHub Gist, or a file in the website repo)
5. Sign update bundles with the private key during build
6. App checks the endpoint on launch and prompts user to update

This is the highest-impact distribution improvement — eliminates manual download for every update after the first install.

---

## Compression: Voice Buffer Storage Upgrade

The voice buffer currently uses WAV (~1.9 MB/min). Upgrading to Opus would give ~10x compression (~120 KB/min at 24 kbps).

### Recommended approach

Add `ogg-opus` crate — all-in-one OGG Opus encoder that takes i16 PCM and outputs a valid `.ogg` file:

```toml
ogg-opus = "0.1"
```

**Encoding flow**:
1. Convert f32 PCM samples to i16 (already have `f32_to_i16_bytes`)
2. Call `ogg_opus::encode::<16000, 1>(&i16_samples)` → OGG Opus bytes
3. Save as `.ogg` instead of `.wav`

**Playback**: HTML5 `<audio>` supports OGG Opus natively in Chrome, Firefox, and Edge. The data URI approach (`data:audio/ogg;base64,...`) works the same as WAV.

**Migration**: Existing WAV recordings continue to work. New recordings save as OGG. The manifest tracks the file extension, and `voice_buffer_get_audio` returns the correct MIME type.

### Alternative: pure Rust

If `ogg-opus` has build issues (it wraps C libopus), use `opus-codec` (vendored libopus, no cmake needed) + `ogg` (pure Rust OGG container):

```toml
opus-codec = "0.1"    # vendored libopus
ogg = "0.9"           # pure Rust OGG container
```

More code to write but zero system dependencies.
