/**
 * Type declarations for the electronAPI exposed by preload.ts
 *
 * This augments the global Window interface so TypeScript knows
 * about window.electronAPI in the renderer process.
 */

interface TranscriptEvent {
  transcript: string
  isFinal: boolean
}

interface AppUser {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  authMethod: 'email' | 'google' | 'facebook'
}

interface SubscriptionInfo {
  status: 'free' | 'pro' | 'team'
  expiresAt: string | null
  features: {
    managedApiKeys: boolean
    voiceMinutes: number
    aiRequests: number
  }
}

interface ElectronAPI {
  // Audio
  listAudioDevices: () => Promise<{ success: boolean; devices: string[]; selected: string | null }>
  setAudioDevice: (device: string) => Promise<void>
  startRecording: () => Promise<{ success: boolean; error?: string }>
  stopRecording: (apiKey: string) => Promise<{ success: boolean; transcript?: string; error?: string }>
  getAudioLevel: () => Promise<number>

  // Deepgram streaming
  startDeepgram: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  stopDeepgram: () => Promise<void>
  onTranscript: (callback: (event: TranscriptEvent) => void) => (() => void)

  // Quick Dictation window
  onQuickDictationStart: (callback: () => void) => (() => void)
  onQuickDictationToggle: (callback: () => void) => (() => void)
  openSettingsWindow: () => void
  setDictationAlwaysOnTop: (value: boolean) => Promise<void>
  setMinimizeToTray?: (value: boolean) => Promise<void>

  // Theme sync
  broadcastThemeChange: (themeId: string) => void
  onThemeChange: (callback: (themeId: string) => void) => (() => void)

  // Settings sync
  broadcastSettings: (settings: Record<string, string>) => void
  onSettingsChanged: (callback: (settings: Record<string, string>) => void) => (() => void)

  // Clipboard
  copyToClipboard: (text: string) => Promise<void>
  autoPaste: () => void

  // Auth — Supabase (email, Google, Facebook)
  getUser: () => Promise<{ success: boolean; user?: AppUser }>
  signUpEmail: (email: string, password: string) => Promise<{ success: boolean; user?: AppUser; error?: string }>
  signInEmail: (email: string, password: string) => Promise<{ success: boolean; user?: AppUser; error?: string }>
  signInOAuth: (provider: 'google' | 'facebook') => Promise<{ success: boolean; user?: AppUser; error?: string }>
  signOut: () => Promise<{ success: boolean }>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>

  // Subscription + managed keys
  getSubscription: () => Promise<{ success: boolean; subscription?: SubscriptionInfo; error?: string }>
  getManagedKeys: () => Promise<{ success: boolean; deepgramKey?: string | null; anthropicKey?: string | null; hasManagedKeys?: boolean; error?: string }>
  checkout: (plan: 'pro' | 'team') => Promise<{ success: boolean; error?: string }>
  billingPortal: () => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
