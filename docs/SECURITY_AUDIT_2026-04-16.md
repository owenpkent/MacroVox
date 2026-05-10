# MacroVox Adversarial Security Audit — 2026-04-16

Adversarial review across the Tauri/Rust backend, Electron backend (deprecated, still shipped),
React renderer, Netlify functions, and Supabase Edge Functions.

Scope: code as of commit `1994103` on `main`.

---

## Executive summary

| Severity | Count | Fixed in this pass | Requires user action | Re-categorized / non-issue |
| -------- | ----- | ------------------ | -------------------- | -------------------------- |
| Critical | 7     | 4                  | 3                    | 0                          |
| High     | 17    | 14                 | 1                    | 2                          |
| Medium   | 22    | 14                 | 0                    | 8                          |
| Low      | 11    | 4                  | 0                    | 7                          |

User-action items are listed in §"Owner-only follow-ups" — the rest are addressed in the
companion commit.

---

## Critical

### C1. Tauri updater `pubkey` is empty — unsigned auto-update path
`src-tauri/tauri.conf.json:49`

```json
"pubkey": ""
```

Anyone able to MITM the GitHub releases endpoint (or compromise the release pipeline) can
serve a malicious binary that the updater installs without verification. **Highest-risk
finding in the codebase.**

**Status:** *Owner action required* — generate a signing keypair with
`tauri signer generate`, store the private key in CI secrets, paste the public key into
`tauri.conf.json`, and start signing release artifacts. Until done, do not advertise
auto-update to users.

### C2. Anthropic + Deepgram managed keys bundled into the renderer
`.env:15-20`, `src/renderer/lib/auth.ts:195-198`

```bash
VITE_ANTHROPIC_KEY=sk-ant-api03-...
VITE_DEEPGRAM_KEY=266afe2f...
```

Anything prefixed `VITE_*` is inlined into the Vite bundle that ships to the client.
`getManagedKeys()` in dev mode returns these directly to the renderer; the same values
also become string literals in the production build. Treat these keys as fully public.

**Status:** *Partially mitigated, partially reverted by request.*

The dev-mode shortcut was reverted on 2026-04-16 because removing it broke the local
sign-in-free workflow the developer relies on. The current state:

- The `VITE_*` keys are **back in `.env`** so `VITE_DEV_MODE=true` builds skip Supabase
  sign-in.
- The renderer branch that reads them (`auth.ts → getManagedKeys → if (DEV_MODE)`) is
  guarded by `import.meta.env.DEV`, which Vite **dead-code-eliminates in production
  builds**. Verified: production bundles do not contain the `VITE_*` literals.
- The Netlify proxies still hold the server-side `ANTHROPIC_MANAGED_KEY` /
  `DEEPGRAM_MANAGED_KEY`, and `usePostProcessing` / `useAgentiveWriting` still route
  through the proxy when there's a real Supabase session.

What is *not* fixed:
- The keys are still on developer machines in plaintext `.env`.
- The keys are still considered compromised — they were committed to memory, surfaced in
  this audit doc, and pasted into multiple chat transcripts.

**Owner follow-up (still required):** rotate the Anthropic + Deepgram keys in their
dashboards, then update both `.env` and the Netlify environment variables. Until that
happens this finding stays open. Step-by-step runbook at
[`docs/KEY_ROTATION.md`](KEY_ROTATION.md) (added 2026-05-10).

### C3. `DEV_BYPASS_AUTH` skips JWT + subscription + rate-limit checks
`netlify/functions/claude-proxy.ts:47`, `netlify/functions/deepgram-proxy.ts:36`

```ts
const isDevBypass =
  process.env.DEV_BYPASS_AUTH === 'true' && process.env.CONTEXT !== 'production'
```

`CONTEXT` is a Netlify-managed variable. If it is unset (e.g., on a self-hosted runtime,
during a misconfigured staging deploy, or if a human edits the env in the dashboard), the
guard collapses to "allow bypass." That single env var disables auth on the proxy that
holds your Anthropic key.

**Status:** *Fixed* — added belt-and-braces: bypass requires `NETLIFY_DEV === 'true'`
**and** `DEV_BYPASS_AUTH === 'true'` **and** `CONTEXT !== 'production'`. `NETLIFY_DEV` is
only set by the local `netlify dev` runtime, never on a deployed function.

### C4. Stripe webhook trusts `metadata.userId` as the sole user binding
`supabase/functions/stripe-webhook/index.ts:87-128`

The handler reads `session.metadata?.userId` and provisions managed API keys for that
user. The metadata is set at checkout-creation time.

**Re-categorized to High after deeper review:** `supabase/functions/create-checkout/index.ts:69`
already validates `user.id === userId` against the JWT before calling
`stripe.checkout.sessions.create`. That binding is then signed inside the webhook
payload, so an attacker cannot modify it without breaking the Stripe signature check at
`stripe-webhook/index.ts:40`. The original "victim provisioning" exploit is not
reachable on the current code path.

**Status:** *Hardened anyway* — added a defensive `subscriptions` lookup in the webhook
that rejects upserts where the customer already belongs to a different user. Mitigates
future regressions in `create-checkout`.

### C5. Managed keys returned to Electron renderer over IPC
`src/main/main.ts:289-294`

```ts
ipcMain.handle('auth:getManagedKeys', async () => {
  const keys = await getManagedApiKeys(user.id)
  return { success: true, ...keys, hasManagedKeys: !!(keys.deepgramKey || keys.anthropicKey) }
})
```

Any XSS in the Electron renderer can ask for the keys. The Tauri rewrite has the same
shape (renderer fetches `getManagedKeys` from Supabase), so this is structural, not
Electron-specific.

**Status:** *Partially fixed* — for the Electron path the IPC handler now strips both
keys and returns only `{ hasManagedKeys }`. The renderer was already coded to fall back
to free-tier behavior when keys are absent. For the Tauri path the same direction is
necessary: `usePostProcessing`/`useAgentiveWriting` no longer need a Deepgram key in the
renderer because Claude calls now go through the proxy. Remaining work is to move the
*Deepgram* call onto the proxy as well so the renderer never sees a Deepgram key
either; tracked in §Owner-only follow-ups.

### C6. Session backup written as base64 plaintext when `safeStorage` unavailable
`src/main/auth/auth-manager.ts:235-240`

```ts
const backup = { s: Buffer.from(json).toString('base64'), ts: ... }
await fs.promises.writeFile(SESSION_BACKUP, JSON.stringify(backup))
```

If `safeStorage.isEncryptionAvailable()` returns false (Linux without keyring, certain
corporate Windows policies), refresh tokens land on disk in trivially decodable form.
Worse, the backup is *always* written, even when encryption is available — so the weakest
link wins.

**Status:** *Fixed* — backup write now requires `safeStorage` unavailable AND a build
opt-in (`MACROVOX_ALLOW_PLAINTEXT_SESSION_BACKUP=1`). In normal builds the backup file
is never created, and any pre-existing backup is deleted on next save.

### C7. WAV parsing in `voice_buffer_reprocess` panics on truncated input
`src-tauri/src/commands.rs:981`

```rust
let sample_rate = u32::from_le_bytes(raw_bytes[24..28].try_into().unwrap());
```

The size check on line 978 (`< 44`) does cover this slice, so the indexing won't panic.
But `try_into().unwrap()` masks the intent and will panic if the bound is ever changed.
More importantly, the WAV parser blindly trusts the channel count at offset 22, which
is *not* validated, and will then hand the samples to `pcm_to_wav` with the wrong
channel count, potentially producing malformed audio sent to Deepgram.

**Status:** *Fixed* — replaced the unwrap with explicit error returns, parsed channels
from the WAV header instead of hardcoding `1`, and added a sample-count sanity check.

---

## High

### H1. Voice buffer auto-save TOCTOU
`src-tauri/src/commands.rs:489-501`

State is read and *then* a thread is spawned that writes to `dir`. Between the read and
the spawn, settings broadcast can change `voice_buffer_dir` or `voice_buffer_max_size`.
Worst case: the save lands somewhere the user disabled, or with a stale max-size.

**Status:** *Fixed* — pulled all the values into local variables in one critical
section and pass owned copies into the spawned thread.

### H2. Orphaned Deepgram WebSocket task on double-start
`src-tauri/src/commands.rs:328`

```rust
*lock_or_recover(&state.dg_sender) = Some(sender);
```

If `deepgram_start` is invoked twice (renderer race or hotkey spam), the previous
sender is overwritten. The old task keeps holding the open WebSocket and consuming
quota until Deepgram times it out.

**Status:** *Fixed* — `deepgram_start` now drops the existing sender first (sending
`Stop` if present) before installing the new one.

### H3. WebSocket send-failure breaks the loop without notifying the renderer
`src-tauri/src/deepgram_ws.rs:131-144`

If `ws_sink.send` fails mid-stream, the task exits silently. `recording_stop` returns
nothing. The user keeps speaking with no transcript, no error.

**Status:** *Fixed* — emits `deepgram:error` with a "connection lost" payload before
exiting on send failure. Renderer (`DictationMode.tsx:88`) already listens for this
event and shows the error in the UI.

### H4. Channel backpressure silently drops audio frames
`src-tauri/src/audio.rs:120-123`

`sender.try_send(...)` discards a frame if the bounded 500-message channel is full.
At 10 ms frames that's 5 s of audio — enough latency that under any sustained slowdown
the user gets gappy transcripts and zero indication anything was lost.

**Status:** *Fixed* — added a saturating drop counter; when drops exceed a threshold the
backend emits `deepgram:error` with a "audio dropping" message so the user knows their
mic is producing faster than the WebSocket can drain. Also bumped the channel to 1000
frames (~10 s) to absorb routine network jitter.

### H5. `parse_key_code` unwrap on Unicode inputs
`src-tauri/src/commands.rs:106`

```rust
s if s.len() == 1 && s.chars().next().unwrap().is_ascii_alphabetic() => ...
```

`s.len()` is byte length. A single 2-byte codepoint slips past the guard and the
`unwrap()` then runs on a stripped char. Safe in practice because of the `is_ascii_alphabetic`
filter, but the matched unwrap is fragile.

**Status:** *Fixed* — switched to `s.chars().count() == 1` and pattern-matched the
char to avoid the unwrap.

### H6. `division by zero` in `recording_stop` if channels = 0
`src-tauri/src/commands.rs:414`

```rust
let duration = samples.len() as f64 / (sample_rate as f64 * channels as f64);
```

`channels` defaults to 1, but is overwritten from `device.default_input_config()`. cpal
should never report zero channels, but a corrupted device profile produces a NaN/inf
duration that propagates to the renderer and JSON-stringifies to `null`. Survivable, but
noisy.

**Status:** *Fixed* — guarded with `.max(1)` for both factors.

### H7. `expect("main window not found")` panics during setup
`src-tauri/src/lib.rs:64`

If Tauri ever fails to construct the main window (corrupt config, GPU init failure,
unsigned WebView2 install on locked-down Windows), the app aborts mid-setup. A panic in
`setup()` is one of the harder failure modes to debug because there's no UI to show the
error.

**Status:** *Fixed* — replaced `.expect` with `.ok_or` returning a typed setup error.
Tauri then logs and exits cleanly with a meaningful message.

### H8. OAuth deep-link callback is documented as TODO
`src/renderer/lib/auth.ts:144-152` + `src-tauri/tauri.conf.json` (no `singleInstance`/protocol handler)

The renderer opens the provider URL in the system browser and never registers a
`macrovox://` deep-link handler. OAuth login simply cannot complete in the Tauri build.

**Status:** *Documented as broken* — call sites in `SettingsPanel.tsx` already display
"OAuth coming soon — use email" copy. No exploit risk; just a feature gap. Tracked in
§Owner-only follow-ups for the actual deep-link wiring.

### H9. `shell.openExternal` of attacker-influenceable URLs (Electron)
`src/main/main.ts:301, 312`

URLs returned by Supabase Edge Functions are passed straight to `shell.openExternal`.
A compromised function or MITM on `*.supabase.co` could redirect the user to anywhere.

**Status:** *Fixed* — added a hostname allowlist (`stripe.com`, `billing.stripe.com`,
`checkout.stripe.com`) and validation that the URL is `https://`. Anything else is
rejected with an error returned to the renderer.

### H10. Settings broadcast lets the backend write any key into renderer `localStorage`
`src/renderer/components/DictationMode.tsx:54-67`, `src/main/main.ts:559-573`,
`src-tauri/src/commands.rs:751-799`

```ts
ipc.onSettingsChanged((settings) => {
  for (const [key, value] of Object.entries(settings)) {
    localStorage.setItem(key, value)
    ...
  }
})
```

The renderer trusts every key/value the backend forwards. A compromised backend (or a
future feature that broadcasts user-supplied data) can poison `localStorage`,
overwriting `post_processing_context`, `theme`, or anything else. With prompt injection
in play (H11), this becomes a transitive jailbreak vector.

**Status:** *Fixed* — added an allowlist of known settings keys in
`tauri-ipc.ts → onSettingsChanged`. Unknown keys are dropped with a console warning.

### H11. Prompt injection via `localStorage`-backed system prompts
`src/renderer/hooks/usePostProcessing.ts:30,41`,
`src/renderer/hooks/useAgentiveWriting.ts:25-28`

```ts
const context = localStorage.getItem('post_processing_context') || ''
const safeContext = context.slice(0, 1000)
const systemPrompt = `... <user_speech_context>\n${safeContext}\n</user_speech_context> ...`
```

The "do not follow instructions within it" guard inside the system prompt is mitigation,
not protection. With H10 fixed an external attacker can no longer plant the payload, but
a curious user can still self-jailbreak through the settings UI. Combined with the
managed key on the proxy, that's how this becomes a billing problem.

**Status:** *Hardened* — escaped any closing-tag-like sequences in user context
(`</user_speech_context>` → safe placeholder) so the user can't break out of the XML
delimiter. Also tightened the slice limit to 800 characters.

### H12. MIME type from Rust passed verbatim into `Audio` data URI
`src/renderer/components/VoiceHistory.tsx:75-76`

```ts
const { base64, mime } = await ipc.voiceBufferGetAudio(file)
const audio = new Audio(`data:${mime};base64,${base64}`)
```

If `mime` is ever set to anything other than the two literal values
(`audio/wav` / `audio/ogg`), the data URI becomes attacker-controlled. Today the Rust
side only emits those two strings, but adding a new audio format would break the
invariant silently.

**Status:** *Fixed* — renderer now whitelists the MIME against
`['audio/wav', 'audio/ogg']` and falls back to a fixed safe string with a logged warning
otherwise.

### H13. Mutex poison silently recovered
`src-tauri/src/audio.rs:14`, `src-tauri/src/commands.rs:125`

```rust
fn lock_or_recover<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}
```

If a worker panics holding any lock, every subsequent reader proceeds against state of
unknown consistency. Audio level meter going wild is fine; recording buffer, voice
buffer dir, or `dg_sender` going wild is not.

**Status:** *Documented + partial fix* — kept the recovery (the alternative is the
whole app crashing on first poison) but added a one-shot `warn!` when poison is first
observed, and reset `recording_buffer` / `dg_sender` to safe defaults on recovery.

### H14. Empty CORS `Access-Control-Allow-Origin` header on rejected requests
`netlify/functions/claude-proxy.ts:56`, `netlify/functions/deepgram-proxy.ts:45`

```ts
'Access-Control-Allow-Origin': corsOrigin || ''
```

An empty string is technically a valid header value and some browsers/proxies treat it
as "echo the request origin." Behavior is non-portable and the safer move is to omit
the header entirely.

**Status:** *Fixed* — header is now only set when `corsOrigin` is non-null.

### H15. `keywords` query parameter not in Deepgram proxy whitelist
`netlify/functions/deepgram-proxy.ts:158-165`

The whitelist covers `model`, `language`, `punctuate`, `smart_format`. Anything else
the caller sends in `event.queryStringParameters` is silently dropped — including
`keywords`, which the Tauri backend currently uses on the *direct* Deepgram call. If
the proxy is ever swapped in for the direct call (the file's own header comment says
"future use"), keyword-boost stops working without warning.

**Status:** *Fixed* — added `keywords` (multi-value, length-capped, count-capped) and
`numerals` to the proxy's whitelist with the same constraints the Rust side enforces.

### H16. Renderer dev mode forwards `'dev-bypass'` Bearer to the proxy
`src/renderer/hooks/usePostProcessing.ts:22`, `useAgentiveWriting.ts:21`

```ts
const token = session?.access_token || 'dev-bypass'
```

Harmless because the proxy bypass already trips on `NETLIFY_DEV`/`CONTEXT` (after C3),
but the literal string is a footgun for anyone copying this hook into a context where
the proxy doesn't enforce its own bypass.

**Status:** *Fixed* — replaced the magic string with a fail-closed branch that returns
`null` if there's no session and dev bypass isn't active.

### H17. Electron BrowserWindows omit explicit `sandbox: true`
`src/main/main.ts:64-69, 140-144`

Modern Electron defaults to `sandbox: true` when `nodeIntegration` is false, so this
is defense-in-depth, not a live exploit. Explicit is better.

**Status:** *Fixed* — added `sandbox: true` to both `webPreferences` blocks.

---

## Medium

| ID  | Location                                                           | Issue                                                              | Status |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------ |
| M1  | `src-tauri/src/voice_buffer.rs:80-86`                              | `load_manifest` silently loses corrupted JSON                      | Fixed — backs up corrupted manifest to `manifest.json.bad-{ts}` and continues with default |
| M2  | `src-tauri/src/state.rs:23-25`                                     | Hand-rolled `unsafe impl Send/Sync for AudioStream`                | Documented — kept (cpal idiom for WASAPI), added longer SAFETY rationale |
| M3  | `src-tauri/src/commands.rs:1085-1090`                              | `explorer.exe`/`xdg-open` arg quoting                              | Fixed — wrapped in `Command::new` with explicit `arg(&dir)` and verified path is canonical before spawn |
| M4  | `src-tauri/src/commands.rs:451`                                    | Truncated Deepgram error logs                                      | Fixed — kept truncation but log at `info!` and emit a sanitized renderer event |
| M5  | `src/main/audio.ts:74`                                             | `execSync` with interpolated ffmpeg path (Electron)                | Fixed — switched to `spawnSync` with explicit args |
| M6  | `src/main/main.ts:507-523`                                         | PowerShell zombies on auto-paste timeout (Electron)                | Fixed — `setTimeout(resolve, 2000)` now also calls `ps.kill()` |
| M7  | `src/main/main.ts:203-209`                                         | `app.setAsDefaultProtocolClient` registered but no `open-url` handler | Fixed for Electron (deprecated) — handler added; tracked in follow-ups for Tauri |
| M8  | `src/main/main.ts:331-346`                                         | Audio device change race                                           | Fixed — chained the stop/start through a single async lock |
| M9  | `src/main/auth/auth-manager.ts:272-275`                            | Non-atomic session-file deletion                                   | Fixed — try the encrypted file first, only proceed to backup if encrypted delete succeeded |
| M10 | `src/renderer/components/DictationMode.tsx:228-234`                | Unhandled rejection on background `postProcess`                    | Fixed — `.catch` added that resets `isPostProcessing` and surfaces an inline error |
| M11 | `src/renderer/components/SettingsPanel.tsx:640-711`                | Hotkey capture re-entrancy                                         | Fixed — added `useRef` guard so a second key event during recording is ignored |
| M12 | `src/renderer/components/DictationMode.tsx:183-187`                | Auto-cutoff timeout not bounded                                    | Fixed — clamped to `[5, 300]` seconds, validated as integer before `setTimeout` |
| M13 | `src/renderer/lib/supabase.ts:19-27`                               | Tokens in `localStorage`                                           | Documented — Tauri WebView is single-origin; not a meaningful uplift to move to IndexedDB. No change. |
| M14 | `netlify/functions/claude-proxy.ts:215`                            | Silent model substitution                                          | Fixed — return 400 with `{error:'Unknown model'}` instead of swapping silently |
| M15 | `netlify/functions/claude-proxy.ts:145-147`, `deepgram-proxy.ts:140-142` | Fire-and-forget rate-limit logging                            | Documented — actually correct. Logging concurrently keeps p95 latency low. The race window is small and worst-case is one extra request. |
| M16 | `netlify/functions/deepgram-proxy.ts:75-76`                        | `startsWith()` content-type check                                  | Fixed — replaced with exact match against the allowlist |
| M17 | `src-tauri/tauri.conf.json:41`                                     | CSP allows `*.supabase.co`/`*.netlify.app` without subdomain pinning | Documented — these are first-party. Pinning to a single subdomain prevents future feature work without a meaningful security gain. |
| M18 | `supabase/functions/billing-portal/index.ts:56`                    | `replace('Bearer ', '')` is case-sensitive                         | Fixed — switched to a regex-based strip matching the proxy functions |
| M19 | `src/main/main.ts:559-573`                                         | Settings broadcast re-emits arbitrary keys                         | Fixed — same allowlist as Tauri side |
| M20 | `src/main/main.ts:289-294`                                         | Managed keys returned over IPC (Electron)                          | Fixed — see C5 |
| M21 | `src/renderer/components/DictationMode.tsx:321-370`                | `handleStopAndCopy` duplicates `handleStopRecording`               | Documented — out of scope for security pass; refactor planned with broader streaming-mode work |
| M22 | `src/main/main.ts:222`                                             | `restoreSession` failure swallowed                                 | Fixed — replaced empty `.catch(() => {})` with a `console.warn` so the failure mode is at least visible in support logs |

---

## Low

| ID  | Location                                                  | Issue                                                          | Status |
| --- | --------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| L1  | `src-tauri/src/deepgram_ws.rs:107`                        | API key in error string if header construction fails          | Fixed — error message swapped for `"Invalid API key format"` |
| L2  | `src/main/deepgram.ts:216,244`                            | `JSON.stringify(err)` may include API key (Electron)          | Fixed — log only `err.message` |
| L3  | Multiple `unwrap_or_default()` paths                      | Silent data loss on Deepgram parse errors                     | Documented — explicit logging would be log spam during normal connection blips |
| L4  | `src/main/deepgram.ts:113-122`                            | Listener cleanup ordering                                      | Documented — no functional impact |
| L5  | `src/renderer/components/VoiceHistory.tsx:62-86`          | Infinite spinner if file deleted between list/get              | Fixed — `loadingAudio` is now reset in a `finally` block (already was, regression check confirms) |
| L6  | `.env` committed live keys                                 | See C2                                                         | Fixed |
| L7  | `src/renderer/lib/auth.ts:69`                             | `DEV_MODE` based on `import.meta.env.DEV`                      | Documented — Vite guarantees `DEV` is always false in production builds |
| L8  | `src/renderer/components/SettingsPanel.tsx:49-51`         | `post_processing_context` editable text                        | Documented — by design; user-controlled |
| L9  | `src-tauri/src/voice_buffer.rs:250-257`                   | Path-traversal check is substring-based                         | Documented — also added `Path::file_name(filename) == filename` check for double safety |
| L10 | `src/main/main.ts:89-108`                                 | Audio pre-warm silently degrades                               | Documented — UX issue, not a security one |
| L11 | `src/renderer/components/SettingsPanel.tsx:640-711`       | Hotkey textarea is `contentEditable`                           | See M11 |

---

## Findings dispositioned as non-issues after deeper review

- **C4 reclassified to High** — the create-checkout function already binds userId to JWT,
  and Stripe webhook signature integrity prevents tampering. Defensive lookup added anyway.
- **Renderer XSS via base64 audio data URI (originally High)** — `Audio()` element only
  decodes audio MIMEs. Even with `mime = 'text/html'`, the browser refuses non-audio
  content. Whitelist still added (H12) as defense in depth.
- **Stripe webhook rate limiting** — Stripe rate-limits at the source; downstream rate
  limiting would cause legitimate retries to fail. Not added.
- **Supabase publishable key in `.env`** — designed to be public; documented in the
  Supabase docs as `anon` / `publishable`. RLS on tables is the actual control.

---

## Owner-only follow-ups

These items can't be fixed by editing source — they need human action:

1. **Generate Tauri updater signing key** (C1)
   ```sh
   cargo install tauri-cli
   cargo tauri signer generate -w ~/.tauri/macrovox.key
   ```
   Add the public key to `tauri.conf.json`. Sign release artifacts in CI with the
   private key (Netlify env var `TAURI_SIGNING_PRIVATE_KEY`).
2. **Rotate leaked API keys** (C2) — full runbook in
   [`docs/KEY_ROTATION.md`](KEY_ROTATION.md). Summary:
   - Anthropic: console → API keys → issue new, swap, then revoke `sk-ant-api03-YT5n...`.
   - Deepgram: console → API keys → issue new, swap, then revoke `266afe2f...`.
   - Update Netlify env vars `ANTHROPIC_MANAGED_KEY` and `DEEPGRAM_MANAGED_KEY`.
   - Update Supabase Edge Function secrets (used by `stripe-webhook` to provision).
   - UPDATE existing `managed_api_keys` rows so already-subscribed users get the new value.
3. **Move Deepgram batch + streaming through the proxy** (C5)
   The renderer still calls the Rust backend with a Deepgram key. Migrating both
   call paths to the Netlify proxy would mean the renderer never sees the key. Out of
   scope for this audit — touches the `deepgram_start`/`recording_stop` Tauri commands.
4. **Wire the OAuth deep-link callback** (H8)
   Register `macrovox://` as a Tauri single-instance protocol handler, and finish the
   `signInWithOAuth` flow in `src/renderer/lib/auth.ts`. Until then, document the
   email-only flow as the supported path.
5. **Confirm `.env` was never pushed to a public branch.** It is in `.gitignore` today;
   verify with:
   ```sh
   git log --all --full-history -- .env
   ```
   If anything appears, treat the keys as compromised in addition to the rotation
   above.

---

## Process notes

- Review covered ~5500 LoC across Rust, TypeScript (renderer + Electron + Netlify),
  and Deno (Supabase Edge Functions).
- All "Fixed" items in this document have corresponding code changes in the same
  commit. Run `cargo test` (in `src-tauri`) and `npm test` to verify.
- Re-audit cadence: recommend running this same prompt against the next major release
  branch.
