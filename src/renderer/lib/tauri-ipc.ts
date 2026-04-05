/**
 * MacroVox — Tauri IPC bridge.
 *
 * Replaces `window.electronAPI.*` with typed wrappers around
 * `@tauri-apps/api` `invoke()` / `listen()`.
 *
 * Naming mirrors the old ElectronAPI interface exactly so callers only
 * need to change the import, not the call sites.
 *
 * Command name mapping (JS camelCase → Rust snake_case auto-converted by Tauri):
 *   invoke("audio_list_devices")   ↔  audio_list_devices()
 *   invoke("deepgram_start", {...}) ↔  deepgram_start(api_key: String)
 *   etc.
 *
 * Event name mapping (emitted from Rust via app.emit()):
 *   "deepgram:transcript"    payload: TranscriptEvent
 *   "quick-dictation-start"  payload: null
 *   "quick-dictation-toggle" payload: null
 *   "theme-changed"          payload: string  (themeId)
 *   "settings-changed"       payload: Record<string, string>
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'

// ── Shared response types ─────────────────────────────────────────────────────

export interface OkResult {
  success: boolean
  error?: string
}

export interface AudioDevicesResult {
  success: boolean
  devices: string[]
  selected: string | null
  error?: string
}

export interface RecordingStopResult {
  success: boolean
  transcript?: string
  confidence?: number
  duration?: number
  error?: string
}

export interface AppUser {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  authMethod: string
}

export interface GetUserResult {
  success: boolean
  user?: AppUser
  error?: string
}

export interface SubscriptionInfo {
  status: 'free' | 'pro' | 'team'
  expiresAt: string | null
  features: { managedApiKeys: boolean; voiceMinutes: number; aiRequests: number }
}

export interface GetSubscriptionResult {
  success: boolean
  subscription?: SubscriptionInfo
  error?: string
}

export interface ManagedKeysResult {
  success: boolean
  deepgramKey?: string | null
  anthropicKey?: string | null
  hasManagedKeys?: boolean
  error?: string
}

export interface TranscriptEvent {
  transcript: string
  isFinal: boolean
}

// ── Event helpers ─────────────────────────────────────────────────────────────

/**
 * Subscribes to a Tauri backend event.  Returns a synchronous cleanup function
 * (same shape as the old Electron `on*` callbacks).  The `listen()` call is
 * async internally; the cleanup correctly cancels the subscription once it
 * resolves.
 */
function makeListener<T>(
  eventName: string,
  callback: (payload: T) => void,
): () => void {
  let unlisten: UnlistenFn | undefined
  listen<T>(eventName, (event) => callback(event.payload)).then((fn) => {
    unlisten = fn
  })
  return () => unlisten?.()
}

// ── Audio ─────────────────────────────────────────────────────────────────────

export const listAudioDevices = (): Promise<AudioDevicesResult> =>
  invoke('audio_list_devices')

export const setAudioDevice = (deviceName: string): Promise<OkResult> =>
  invoke('audio_set_device', { deviceName })

export const startAudio = (): Promise<OkResult> =>
  invoke('audio_start')

export const stopAudio = (): Promise<OkResult> =>
  invoke('audio_stop')

export const getAudioLevel = (): Promise<number> =>
  invoke('audio_get_level')

// ── Deepgram streaming ────────────────────────────────────────────────────────

export const startDeepgram = (apiKey: string): Promise<OkResult> =>
  invoke('deepgram_start', { apiKey })

export const stopDeepgram = (): Promise<OkResult> =>
  invoke('deepgram_stop')

export const onTranscript = (
  callback: (data: TranscriptEvent) => void,
): () => void => makeListener('deepgram:transcript', callback)

// ── Buffered recording ────────────────────────────────────────────────────────

export const startRecording = (): Promise<OkResult> =>
  invoke('recording_start')

export const stopRecording = (apiKey: string): Promise<RecordingStopResult> =>
  invoke('recording_stop', { apiKey })

export const cancelRecording = (): Promise<OkResult> =>
  invoke('recording_cancel')

// ── Local STT (whisper-rs, local-stt feature) ─────────────────────────────────

/**
 * Transcribes the current recording buffer using local whisper-rs (offline STT).
 * Call after `startRecording()` + user speaks, as an alternative to `stopRecording`.
 *
 * Requires the Tauri backend to be compiled with `--features local-stt` and a
 * GGML model file downloaded to `modelPath` (e.g. `ggml-base.en.bin`).
 * Returns `{ success: false, error: "local-stt feature not enabled" }` otherwise.
 */
export const whisperTranscribe = (modelPath: string): Promise<RecordingStopResult> =>
  invoke('whisper_transcribe', { modelPath })

// ── Clipboard & auto-paste ────────────────────────────────────────────────────

export const copyToClipboard = (text: string): Promise<OkResult> =>
  invoke('clipboard_write', { text })

export const autoPaste = (): Promise<OkResult> =>
  invoke('dictation_auto_paste')

// ── Window / app settings ─────────────────────────────────────────────────────

export const setDictationAlwaysOnTop = (value: boolean): Promise<OkResult> =>
  invoke('dictation_set_always_on_top', { value })

export const openSettingsWindow = (): Promise<OkResult> =>
  invoke('settings_open_window')

export const setMinimizeToTray = (value: boolean): Promise<OkResult> =>
  invoke('app_set_minimize_to_tray', { value })

// ── Theme & settings broadcast ────────────────────────────────────────────────

export const broadcastThemeChange = (themeId: string): Promise<OkResult> =>
  invoke('theme_broadcast', { themeId })

export const broadcastSettings = (
  settings: Record<string, string>,
): Promise<OkResult> => invoke('settings_broadcast', { settings })

// ── Events ────────────────────────────────────────────────────────────────────

export const onQuickDictationStart = (callback: () => void): () => void =>
  makeListener('quick-dictation-start', callback)

export const onQuickDictationToggle = (callback: () => void): () => void =>
  makeListener('quick-dictation-toggle', callback)

export const onThemeChange = (
  callback: (themeId: string) => void,
): () => void => makeListener('theme-changed', callback)

export const onSettingsChanged = (
  callback: (settings: Record<string, string>) => void,
): () => void => makeListener('settings-changed', callback)

// ── Auth (IPC stubs — replaced by direct Supabase SDK calls in Phase 6) ───────

export const getUser = (): Promise<GetUserResult> =>
  invoke('auth_get_user')

export const signUpEmail = (
  email: string,
  password: string,
): Promise<OkResult> => invoke('auth_sign_up_email', { email, password })

export const signInEmail = (
  email: string,
  password: string,
): Promise<OkResult> => invoke('auth_sign_in_email', { email, password })

export const signInOAuth = (
  provider: 'google' | 'facebook',
): Promise<OkResult> => invoke('auth_sign_in_oauth', { provider })

export const signOut = (): Promise<OkResult> =>
  invoke('auth_sign_out')

export const resetPassword = (email: string): Promise<OkResult> =>
  invoke('auth_reset_password', { email })

export const getSubscription = (): Promise<GetSubscriptionResult> =>
  invoke('auth_get_subscription')

export const getManagedKeys = (): Promise<ManagedKeysResult> =>
  invoke('auth_get_managed_keys')

export const checkout = (plan: 'pro' | 'team'): Promise<OkResult> =>
  invoke('auth_checkout', { plan })

export const billingPortal = (): Promise<OkResult> =>
  invoke('auth_billing_portal')
