import { contextBridge, ipcRenderer } from 'electron'

// MacroVox — Restricted preload for the standalone dictation app.
// No GitHub auth, file system, or subscription IPC is exposed.
contextBridge.exposeInMainWorld('electronAPI', {
  // Audio devices
  listAudioDevices: () => ipcRenderer.invoke('audio:listDevices'),
  setAudioDevice: (deviceName: string) => ipcRenderer.invoke('audio:setDevice', deviceName),
  
  // Audio capture
  startAudio: () => ipcRenderer.invoke('audio:start'),
  stopAudio: () => ipcRenderer.invoke('audio:stop'),
  getAudioLevel: () => ipcRenderer.invoke('audio:getLevel'),

  // Deepgram (streaming mode)
  startDeepgram: (apiKey: string) => ipcRenderer.invoke('deepgram:start', apiKey),
  stopDeepgram: () => ipcRenderer.invoke('deepgram:stop'),
  onTranscript: (callback: (data: { transcript: string; isFinal: boolean }) => void) => {
    ipcRenderer.on('deepgram:transcript', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('deepgram:transcript')
  },

  // Buffered recording mode (record first, transcribe after)
  startRecording: () => ipcRenderer.invoke('recording:start'),
  stopRecording: (apiKey: string) => ipcRenderer.invoke('recording:stop', apiKey),
  cancelRecording: () => ipcRenderer.invoke('recording:cancel'),

  // Dictation Window
  setDictationAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('dictation:setAlwaysOnTop', value),
  openSettingsWindow: () => ipcRenderer.invoke('settings:openWindow'),
  onQuickDictationStart: (callback: () => void) => {
    ipcRenderer.on('quick-dictation-start', () => callback())
    return () => ipcRenderer.removeAllListeners('quick-dictation-start')
  },
  onQuickDictationToggle: (callback: () => void) => {
    ipcRenderer.on('quick-dictation-toggle', () => callback())
    return () => ipcRenderer.removeAllListeners('quick-dictation-toggle')
  },

  // Theme sync across windows
  broadcastThemeChange: (themeId: string) => ipcRenderer.invoke('theme:broadcast', themeId),
  onThemeChange: (callback: (themeId: string) => void) => {
    ipcRenderer.on('theme-changed', (_event, themeId) => callback(themeId))
    return () => ipcRenderer.removeAllListeners('theme-changed')
  },

  // Settings sync across windows
  broadcastSettings: (settings: Record<string, string>) => ipcRenderer.invoke('settings:broadcast', settings),
  onSettingsChanged: (callback: (settings: Record<string, string>) => void) => {
    ipcRenderer.on('settings-changed', (_event, settings) => callback(settings))
    return () => ipcRenderer.removeAllListeners('settings-changed')
  },

  // Clipboard (reliable native write regardless of window focus)
  copyToClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  // Auto-paste: hide dictation window and send Ctrl+V to the previously focused app
  autoPaste: () => ipcRenderer.invoke('dictation:autoPaste'),

  // App window behavior
  setMinimizeToTray: (value: boolean) => ipcRenderer.invoke('app:setMinimizeToTray', value),

  // Auth — Supabase (email, Google, Facebook)
  getUser: () => ipcRenderer.invoke('auth:getUser'),
  signUpEmail: (email: string, password: string) => ipcRenderer.invoke('auth:signUpEmail', email, password),
  signInEmail: (email: string, password: string) => ipcRenderer.invoke('auth:signInEmail', email, password),
  signInOAuth: (provider: 'google' | 'facebook') => ipcRenderer.invoke('auth:signInOAuth', provider),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  resetPassword: (email: string) => ipcRenderer.invoke('auth:resetPassword', email),

  // Subscription + managed keys
  getSubscription: () => ipcRenderer.invoke('auth:getSubscription'),
  getManagedKeys: () => ipcRenderer.invoke('auth:getManagedKeys'),
  checkout: (plan: 'pro' | 'team') => ipcRenderer.invoke('auth:checkout', plan),
  billingPortal: () => ipcRenderer.invoke('auth:billingPortal'),
})

declare global {
  interface Window {
    electronAPI: {
      listAudioDevices: () => Promise<{ success: boolean; devices: string[]; selected: string | null; error?: string }>
      setAudioDevice: (deviceName: string) => Promise<{ success: boolean }>
      startAudio: () => Promise<{ success: boolean; error?: string }>
      stopAudio: () => Promise<{ success: boolean }>
      getAudioLevel: () => Promise<number>
      startDeepgram: (apiKey: string) => Promise<{ success: boolean; error?: string }>
      stopDeepgram: () => Promise<{ success: boolean }>
      onTranscript: (callback: (data: { transcript: string; isFinal: boolean }) => void) => () => void
      startRecording: () => Promise<{ success: boolean; error?: string }>
      stopRecording: (apiKey: string) => Promise<{ 
        success: boolean; 
        error?: string; 
        transcript?: string;
        confidence?: number;
        duration?: number;
      }>
      cancelRecording: () => Promise<{ success: boolean }>
      
      // Dictation Window
      setDictationAlwaysOnTop: (value: boolean) => Promise<{ success: boolean }>
      openSettingsWindow: () => Promise<{ success: boolean }>
      onQuickDictationStart: (callback: () => void) => () => void
      onQuickDictationToggle: (callback: () => void) => () => void
      
      // Theme sync
      broadcastThemeChange: (themeId: string) => Promise<{ success: boolean }>
      onThemeChange: (callback: (themeId: string) => void) => () => void

      // Settings sync
      broadcastSettings: (settings: Record<string, string>) => Promise<{ success: boolean }>
      onSettingsChanged: (callback: (settings: Record<string, string>) => void) => () => void

      // Clipboard
      copyToClipboard: (text: string) => Promise<{ success: boolean }>

      // Auto-paste
      autoPaste: () => Promise<{ success: boolean; error?: string }>

      // App window behavior
      setMinimizeToTray: (value: boolean) => Promise<{ success: boolean }>

      // Auth — Supabase
      getUser: () => Promise<{ success: boolean; user?: { id: string; email: string | null; displayName: string | null; avatarUrl: string | null; authMethod: string }; error?: string }>
      signUpEmail: (email: string, password: string) => Promise<{ success: boolean; user?: any; error?: string }>
      signInEmail: (email: string, password: string) => Promise<{ success: boolean; user?: any; error?: string }>
      signInOAuth: (provider: 'google' | 'facebook') => Promise<{ success: boolean; user?: any; error?: string }>
      signOut: () => Promise<{ success: boolean }>
      resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>

      // Subscription + managed keys
      getSubscription: () => Promise<{ success: boolean; subscription?: any; error?: string }>
      getManagedKeys: () => Promise<{ success: boolean; deepgramKey?: string | null; anthropicKey?: string | null; hasManagedKeys?: boolean; error?: string }>
      checkout: (plan: 'pro' | 'team') => Promise<{ success: boolean; error?: string }>
      billingPortal: () => Promise<{ success: boolean; error?: string }>
    }
  }
}
