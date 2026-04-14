// MacroVox — Standalone Voice Dictation App (main process)
// Powered by Deepgram speech-to-text with AI post-processing.
// No IDE features, no file system access.
// Uses preload.ts for a restricted renderer context.

import { app, BrowserWindow, ipcMain, Menu, Tray, globalShortcut, nativeImage, clipboard, shell } from 'electron'
import * as path from 'path'
import { spawn } from 'child_process'
import { AudioCapture } from './audio'
import { DeepgramStreamer } from './deepgram'
import { AuthManager } from './auth/auth-manager'
import { getSubscription, getManagedApiKeys, createCheckoutSession, createBillingPortalSession } from './auth/subscription'

// Supabase auth manager (handles email, Google, Facebook login)
const authManager = new AuthManager()

const isDev = process.env.ELECTRON_DEV === 'true'

// Disable GPU cache to prevent "Unable to move cache" errors on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-program-cache')

// Prevent multiple instances (skip in dev — other Electron apps may hold the lock)
const gotTheLock = isDev || app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let dictationWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let audioCapture: AudioCapture | null = null
let deepgramStreamer: DeepgramStreamer | null = null

// Settings
let dictationAlwaysOnTop = true
let minimizeToTray = false
let audioPreWarmed = false
let deepgramKeywords: string[] = []
let selectedMicDevice: string | null = null

// ============================================================================
// Window creation
// ============================================================================

function createDictationWindow(autoStartRecording = false, hidden = false) {
  if (dictationWindow) {
    if (!hidden) {
      if (!dictationWindow.isVisible()) dictationWindow.show()
      dictationWindow.focus()
      if (autoStartRecording) {
        dictationWindow.webContents.send('quick-dictation-toggle')
      }
    }
    return
  }

  dictationWindow = new BrowserWindow({
    width: 380,
    height: 360,
    minWidth: 380,
    minHeight: 360,
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
    title: 'MacroVox',
    alwaysOnTop: dictationAlwaysOnTop,
    show: false,
  })

  dictationWindow.once('ready-to-show', () => {
    if (!hidden) dictationWindow?.show()
  })

  if (isDev) {
    dictationWindow.loadURL('http://localhost:5173/dictation.html')
  } else {
    const dictationPath = path.join(__dirname, '../renderer/dictation/index.html')
    dictationWindow.loadFile(dictationPath)
  }

  // Pre-warm ffmpeg
  dictationWindow.webContents.once('did-finish-load', () => {
    if (!audioCapture) {
      audioCapture = new AudioCapture(selectedMicDevice || undefined)
      audioCapture.startPersistent().then(() => {
        audioPreWarmed = true
      }).catch((err) => {
        console.error('[Audio] Pre-warm failed:', err.message)
        audioCapture = null
        audioPreWarmed = false
      })
    } else {
      audioPreWarmed = true
    }

    if (autoStartRecording) {
      setTimeout(() => {
        dictationWindow?.webContents.send('quick-dictation-start')
      }, 300)
    }
  })

  // Hide instead of destroy on close
  dictationWindow.on('close', (event) => {
    if (minimizeToTray) {
      event.preventDefault()
      dictationWindow?.hide()
    }
  })

  // Focus existing window when second instance launched
  app.on('second-instance', () => {
    if (dictationWindow) {
      if (dictationWindow.isMinimized()) dictationWindow.restore()
      dictationWindow.show()
      dictationWindow.focus()
    }
  })
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0a0f14',
    title: 'Settings',
    modal: false,
    alwaysOnTop: true,
  })

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/settings.html')
  } else {
    const settingsPath = path.join(__dirname, '../renderer/settings/index.html')
    settingsWindow.loadFile(settingsPath)
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function getAppIcon(): Electron.NativeImage {
  try {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icons', 'icon.png')
      : path.join(__dirname, '../../resources/icons/icon.png')
    const loaded = nativeImage.createFromPath(iconPath)
    if (!loaded.isEmpty()) return loaded.resize({ width: 256, height: 256 })
  } catch { /* fall through */ }
  return nativeImage.createEmpty()
}

function createTray() {
  const icon = getAppIcon().resize({ width: 32, height: 32 })
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Dictation', click: () => { createDictationWindow(); dictationWindow?.show() } },
    { type: 'separator' },
    { label: 'Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  
  tray.setToolTip('MacroVox')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => { createDictationWindow(); dictationWindow?.show() })
}

function registerGlobalShortcuts() {
  // Quick Dictation: Ctrl+Space
  globalShortcut.register('CommandOrControl+Space', () => {
    createDictationWindow(true)
  })
}

// ============================================================================
// App lifecycle
// ============================================================================

// Register custom protocol for OAuth redirects (macrovox://auth/callback)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('macrovox', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('macrovox')
}

app.whenReady().then(() => {
  // Show the window immediately — don't block on session restore.
  // Auth state is picked up by the renderer's existing polling once ready.
  createDictationWindow(false, false)
  createTray()
  registerGlobalShortcuts()
  Menu.setApplicationMenu(null)

  // Restore Supabase session in the background (makes a network round-trip).
  authManager.restoreSession().then(user => {
    if (user) console.log(`[MacroVox] Session restored for ${user.email}`)
  }).catch(() => {})
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (dictationWindow && !dictationWindow.isDestroyed()) {
    dictationWindow.removeAllListeners('close')
    dictationWindow.close()
    dictationWindow = null
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  audioPreWarmed = false
  if (audioCapture) {
    audioCapture.stop()
    audioCapture = null
  }
  if (deepgramStreamer) {
    deepgramStreamer.stop()
    deepgramStreamer = null
  }
})

// ============================================================================
// IPC Handlers — Auth (Supabase: email, Google, Facebook)
// ============================================================================

ipcMain.handle('auth:getUser', async () => {
  const user = authManager.getUser()
  return user ? { success: true, user } : { success: false }
})

ipcMain.handle('auth:signUpEmail', async (_event, email: string, password: string) => {
  return authManager.signUpWithEmail(email, password)
})

ipcMain.handle('auth:signInEmail', async (_event, email: string, password: string) => {
  return authManager.signInWithEmail(email, password)
})

ipcMain.handle('auth:signInOAuth', async (_event, provider: 'google' | 'facebook') => {
  return authManager.signInWithOAuth(provider)
})

ipcMain.handle('auth:signOut', async () => {
  await authManager.signOut()
  return { success: true }
})

ipcMain.handle('auth:resetPassword', async (_event, email: string) => {
  return authManager.resetPassword(email)
})

ipcMain.handle('auth:getSubscription', async () => {
  const user = authManager.getUser()
  if (!user) return { success: false, error: 'Not logged in' }
  const sub = await getSubscription(user.id)
  return { success: true, subscription: sub }
})

ipcMain.handle('auth:getManagedKeys', async () => {
  const user = authManager.getUser()
  if (!user) return { success: false, error: 'Not logged in' }
  const keys = await getManagedApiKeys(user.id)
  return { success: true, ...keys, hasManagedKeys: !!(keys.deepgramKey || keys.anthropicKey) }
})

ipcMain.handle('auth:checkout', async (_event, plan: 'pro' | 'team') => {
  const user = authManager.getUser()
  if (!user) return { success: false, error: 'Not logged in' }
  const url = await createCheckoutSession(user.id, plan)
  if (url) {
    shell.openExternal(url)
    return { success: true }
  }
  return { success: false, error: 'Failed to create checkout session' }
})

ipcMain.handle('auth:billingPortal', async () => {
  const user = authManager.getUser()
  if (!user) return { success: false, error: 'Not logged in' }
  const url = await createBillingPortalSession(user.id)
  if (url) {
    shell.openExternal(url)
    return { success: true }
  }
  return { success: false, error: 'Failed to open billing portal' }
})

// ============================================================================
// IPC Handlers — Audio
// ============================================================================

ipcMain.handle('audio:listDevices', async () => {
  try {
    const devices = AudioCapture.getAvailableDevices()
    return { success: true, devices, selected: selectedMicDevice }
  } catch (error) {
    return { success: false, error: (error as Error).message, devices: [] }
  }
})

ipcMain.handle('audio:setDevice', async (_event, deviceName: string) => {
  selectedMicDevice = deviceName
  if (audioPreWarmed && audioCapture) {
    audioCapture.stop()
    audioCapture = null
    audioPreWarmed = false
    audioCapture = new AudioCapture(deviceName)
    audioCapture.startPersistent().then(() => {
      audioPreWarmed = true
    }).catch((err) => {
      console.error('[Audio] Re-warm failed:', err.message)
      audioCapture = null
    })
  }
  return { success: true }
})

ipcMain.handle('audio:start', async () => {
  try {
    audioCapture = new AudioCapture(selectedMicDevice || undefined)
    await audioCapture.start()
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('audio:stop', async () => {
  if (audioCapture) {
    audioCapture.stop()
    audioCapture = null
  }
  return { success: true }
})

ipcMain.handle('audio:getLevel', () => {
  return audioCapture?.getAudioLevel() ?? 0
})

// ============================================================================
// IPC Handlers — Deepgram streaming
// ============================================================================

ipcMain.handle('deepgram:start', async (_event, apiKey: string) => {
  try {
    if (!apiKey) return { success: false, error: 'No API key provided' }

    if (!audioCapture) {
      audioCapture = new AudioCapture(selectedMicDevice || undefined)
      await audioCapture.start()
    }

    const stream = audioCapture.enableStreaming()

    deepgramStreamer = new DeepgramStreamer(apiKey)
    await deepgramStreamer.start(
      stream,
      (transcript, isFinal) => {
        if (dictationWindow && !dictationWindow.isDestroyed()) {
          dictationWindow.webContents.send('deepgram:transcript', { transcript, isFinal })
        }
      }
    )

    return { success: true }
  } catch (error) {
    if (audioCapture) {
      audioCapture.stop()
      audioCapture = null
    }
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('deepgram:stop', async () => {
  if (deepgramStreamer) {
    deepgramStreamer.stop()
    deepgramStreamer = null
  }
  if (audioCapture) {
    audioCapture.disableStreaming()
  }
  if (audioCapture && !audioPreWarmed) {
    audioCapture.stop()
    audioCapture = null
  }
  return { success: true }
})

// ============================================================================
// IPC Handlers — Buffered recording
// ============================================================================

ipcMain.handle('recording:start', async () => {
  try {
    if (audioCapture?.isRunning()) {
      audioCapture.startBuffering()
    } else {
      // audioCapture may exist but its ffmpeg process died — replace it
      if (audioCapture) {
        audioCapture.stop()
        audioCapture = null
        audioPreWarmed = false
      }
      audioCapture = new AudioCapture(selectedMicDevice || undefined)
      audioCapture.startBuffering()
      await audioCapture.start()
    }
    return { success: true }
  } catch (error) {
    if (audioCapture) {
      audioCapture.stop()
      audioCapture = null
      audioPreWarmed = false
    }
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('recording:stop', async (_event, apiKey: string) => {
  try {
    if (!audioCapture) return { success: false, error: 'No recording in progress' }
    
    const audioBuffer = audioCapture.stopBuffering()
    if (!audioPreWarmed) {
      audioCapture.stop()
      audioCapture = null
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return { success: true, transcript: '' }
    }

    const streamer = new DeepgramStreamer(apiKey)
    const result = await streamer.transcribeBatch(audioBuffer, deepgramKeywords.length ? deepgramKeywords : undefined)
    return { success: true, ...result }
  } catch (error) {
    if (audioCapture && !audioPreWarmed) {
      audioCapture.stop()
      audioCapture = null
    }
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('recording:cancel', async () => {
  if (audioCapture) {
    audioCapture.stopBuffering()
    if (!audioPreWarmed) {
      audioCapture.stop()
      audioCapture = null
    }
  }
  return { success: true }
})

// ============================================================================
// IPC Handlers — Clipboard & Auto-paste
// ============================================================================

ipcMain.handle('clipboard:write', (_event, text: string) => {
  clipboard.writeText(text)
  return { success: true }
})

ipcMain.handle('dictation:autoPaste', async () => {
  if (dictationWindow && !dictationWindow.isDestroyed() && dictationWindow.isVisible()) {
    dictationWindow.hide()
  }

  if (process.platform !== 'win32') {
    return { success: false, error: 'Auto-paste only supported on Windows' }
  }

  await new Promise(resolve => setTimeout(resolve, 180))

  try {
    const ps = spawn('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")'
    ], { windowsHide: true })

    await new Promise<void>((resolve) => {
      ps.on('close', () => resolve())
      ps.on('error', () => resolve())
      setTimeout(resolve, 2000)
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

// ============================================================================
// IPC Handlers — Settings
// ============================================================================

ipcMain.handle('app:setMinimizeToTray', (_event, value: boolean) => {
  minimizeToTray = value
  return { success: true }
})

ipcMain.handle('dictation:setAlwaysOnTop', (_event, value: boolean) => {
  dictationAlwaysOnTop = value
  if (dictationWindow && !dictationWindow.isDestroyed()) {
    dictationWindow.setAlwaysOnTop(value)
  }
  return { success: true }
})

ipcMain.handle('settings:openWindow', () => {
  createSettingsWindow()
  return { success: true }
})

// Theme sync
ipcMain.handle('theme:broadcast', (_event, themeId: string) => {
  const windows = [dictationWindow, settingsWindow]
  windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme-changed', themeId)
    }
  })
  return { success: true }
})

// Settings sync
ipcMain.handle('settings:broadcast', (_event, settings: Record<string, string>) => {
  if ('deepgram_keywords' in settings) {
    const raw = settings['deepgram_keywords'] || ''
    deepgramKeywords = raw.split('\n').map((s: string) => s.trim()).filter(Boolean)
  }
  if ('minimize_to_tray' in settings) {
    minimizeToTray = settings['minimize_to_tray'] === 'true'
  }
  const windows = [dictationWindow, settingsWindow]
  windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('settings-changed', settings)
    }
  })
  return { success: true }
})
