import { useState, useEffect } from 'react'
import { Settings, Mic, X, RefreshCw, Sparkles, Loader2, CreditCard, MessageSquare, Pin, Palette, LogIn, User, PenLine } from 'lucide-react'
import { THEMES, getStoredTheme, setStoredTheme } from '../themes'
import * as ipc from '../lib/tauri-ipc'
import type { AppUser } from '../lib/tauri-ipc'
import * as auth from '../lib/auth'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  user?: AppUser | null
  isPopup?: boolean
}

type SubscriptionStatus = 'free' | 'pro' | 'team' | 'loading'

export function SettingsPanel({ isOpen, onClose, user }: SettingsPanelProps) {
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSuccess, setAuthSuccess] = useState<string | null>(null)
  const [devices, setDevices] = useState<string[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('loading')

  const [autoCopyOnStop, setAutoCopyOnStop] = useState(() =>
    localStorage.getItem('dictation_auto_copy') !== 'false'
  )
  const [clearOnNewRecording, setClearOnNewRecording] = useState(() =>
    localStorage.getItem('dictation_clear_on_new') === 'true'
  )
  const [autoCutoffSeconds, setAutoCutoffSeconds] = useState(() =>
    localStorage.getItem('dictation_auto_cutoff') || '30'
  )
  const [alwaysOnTop, setAlwaysOnTop] = useState(() =>
    localStorage.getItem('dictation_always_on_top') !== 'false'
  )
  const [dictationEnabled, setDictationEnabled] = useState(() =>
    localStorage.getItem('deepgram_dictation') !== 'false'
  )
  const [transcriptionMode, setTranscriptionMode] = useState(() =>
    localStorage.getItem('transcription_mode') || 'batch'
  )
  const [postProcessingContext, setPostProcessingContext] = useState(() =>
    localStorage.getItem('post_processing_context') || ''
  )
  const [autoPasteEnabled, setAutoPasteEnabled] = useState(() =>
    localStorage.getItem('dictation_auto_paste') === 'true'
  )
  const [minimizeToTray, setMinimizeToTray] = useState(() =>
    localStorage.getItem('minimize_to_tray') === 'true'
  )
  const [keywordBoosts, setKeywordBoosts] = useState(() =>
    localStorage.getItem('deepgram_keywords') || ''
  )
  const [writingStyleProfile, setWritingStyleProfile] = useState(() =>
    localStorage.getItem('writing_style_profile') || ''
  )

  const [selectedTheme, setSelectedTheme] = useState(() => getStoredTheme())

  const handleEmailAuth = async () => {
    if (!authEmail || !authPassword) return
    setAuthLoading(true)
    setAuthError(null)
    setAuthSuccess(null)
    try {
      const result = authTab === 'signin'
        ? await auth.signInEmail(authEmail, authPassword)
        : await auth.signUpEmail(authEmail, authPassword)
      if (result.success) {
        if (authTab === 'signup') {
          setAuthSuccess('Check your email to confirm your account.')
        } else {
          onClose()
        }
      } else {
        setAuthError(result.error || 'Authentication failed')
      }
    } catch {
      setAuthError('Something went wrong')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      await auth.signInWithOAuth(provider)
    } catch {
      setAuthError('OAuth sign-in failed')
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    const checkSub = async () => {
      if (!user) {
        setSubscriptionStatus('free')
        return
      }
      try {
        const subResult = await auth.getSubscription()
        if (subResult.success && subResult.subscription) {
          setSubscriptionStatus(subResult.subscription.status)
        } else {
          setSubscriptionStatus('free')
        }
      } catch {
        setSubscriptionStatus('free')
      }
    }
    if (isOpen) checkSub()
  }, [user, isOpen])

  const loadDevices = async () => {
    setIsLoading(true)
    try {
      const result = await ipc.listAudioDevices()
      if (result.success) {
        setDevices(result.devices)
        setSelectedDevice(result.selected)
      }
    } catch (error) {
      console.warn('[Settings] Failed to load devices')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadDevices()
      // Sync all current settings to backend so it has the correct state after a restart
      const allSettings: Record<string, string> = {}
      const keys = [
        'dictation_auto_copy', 'dictation_clear_on_new', 'dictation_auto_cutoff',
        'dictation_always_on_top', 'deepgram_dictation', 'transcription_mode',
        'post_processing_context', 'dictation_auto_paste',
        'deepgram_keywords', 'minimize_to_tray',
      ]
      keys.forEach(k => {
        const v = localStorage.getItem(k)
        if (v !== null) allSettings[k] = v
      })
      ipc.broadcastSettings(allSettings)
    }
  }, [isOpen])

  const handleDeviceSelect = async (device: string) => {
    try {
      await ipc.setAudioDevice(device)
      setSelectedDevice(device)
    } catch (error) {
      console.warn('[Settings] Failed to set device')
    }
  }

  const saveSetting = (key: string, value: string) => {
    localStorage.setItem(key, value)
    ipc.broadcastSettings({ [key]: value })
  }

  const handleAutoCopyToggle = (value: boolean) => {
    setAutoCopyOnStop(value)
    saveSetting('dictation_auto_copy', String(value))
  }

  const handleClearOnNewToggle = (value: boolean) => {
    setClearOnNewRecording(value)
    saveSetting('dictation_clear_on_new', String(value))
  }

  const handleAutoCutoffChange = (value: string) => {
    setAutoCutoffSeconds(value)
    saveSetting('dictation_auto_cutoff', value)
  }

  const handleAlwaysOnTopToggle = async (value: boolean) => {
    setAlwaysOnTop(value)
    saveSetting('dictation_always_on_top', String(value))
    await ipc.setDictationAlwaysOnTop(value)
  }

  const handleMinimizeToTrayToggle = async (value: boolean) => {
    setMinimizeToTray(value)
    saveSetting('minimize_to_tray', String(value))
    await ipc.setMinimizeToTray(value)
  }

  const isPro = subscriptionStatus === 'pro' || subscriptionStatus === 'team'

  const handleUpgrade = async () => {
    if (!user) return
    await auth.checkout('pro')
  }

  const handleManageSubscription = async () => {
    if (!user) return
    await auth.billingPortal()
  }

  const handleAutoPasteToggle = (value: boolean) => {
    setAutoPasteEnabled(value)
    saveSetting('dictation_auto_paste', String(value))
  }

  const handleKeywordBoostsChange = (value: string) => {
    setKeywordBoosts(value)
    saveSetting('deepgram_keywords', value)
  }

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId)
    setStoredTheme(themeId)
    window.dispatchEvent(new CustomEvent('theme-change', { detail: themeId }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="rounded-lg w-full max-w-md mx-4 shadow-xl max-h-[90vh] flex flex-col font-mono" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-lg font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-red-900/30 rounded text-slate-500 hover:text-red-400">
            <X size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-4 space-y-6 overflow-y-auto flex-1">

          {/* Sign-In Section */}
          {!user && (
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
                <User size={16} style={{ color: 'var(--accent-secondary)' }} />
                Account
              </h3>
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                <div className="flex rounded overflow-hidden mb-4" style={{ border: '1px solid var(--border-primary)' }}>
                  {(['signin', 'signup'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setAuthTab(tab); setAuthError(null); setAuthSuccess(null) }}
                      className="flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors"
                      style={{
                        backgroundColor: authTab === tab ? 'var(--accent-primary)' : 'transparent',
                        color: authTab === tab ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {tab === 'signin' ? 'Sign In' : 'Sign Up'}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                    className="w-full px-3 py-2 rounded text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>

                {authError && <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{authError}</p>}
                {authSuccess && <p className="text-xs mt-2" style={{ color: 'var(--accent-primary)' }}>{authSuccess}</p>}

                <button
                  onClick={handleEmailAuth}
                  disabled={authLoading || !authEmail || !authPassword}
                  className="w-full mt-3 py-2 rounded text-white text-sm font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  {authLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                  {authTab === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            </section>
          )}

          {/* Signed-in account pill */}
          {user && (
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
                <User size={16} style={{ color: 'var(--accent-secondary)' }} />
                Account
              </h3>
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}>
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-300 truncate max-w-[180px]">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={async () => { await auth.signOut(); onClose() }}
                  className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}
                >
                  Sign out
                </button>
              </div>
            </section>
          )}

          {/* Theme Selector */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              <Palette size={16} style={{ color: 'var(--accent-secondary)' }} />
              Theme
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedTheme === theme.id
                      ? 'border-cyan-500 bg-cyan-900/20'
                      : 'border-slate-700 hover:border-slate-600 bg-[#0a0f14]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: theme.colors.accentPrimary }} />
                    <span className="text-sm font-medium text-slate-200">{theme.name}</span>
                  </div>
                  <p className="text-xs text-slate-500">{theme.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Quick Dictation */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              <MessageSquare size={16} style={{ color: 'var(--accent-secondary)' }} />
              Quick Dictation
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Auto-copy on stop', desc: 'Instantly copy transcript to clipboard when you stop recording', value: autoCopyOnStop, onChange: handleAutoCopyToggle },
                { label: 'Auto-paste on stop', desc: 'Paste into the app you were typing in — text lands where your cursor was', value: autoPasteEnabled, onChange: handleAutoPasteToggle },
                { label: 'Clear on new recording', desc: 'Delete previous transcript when starting a new one', value: clearOnNewRecording, onChange: handleClearOnNewToggle },
              ].map(({ label, desc, value, onChange }) => (
                <label key={label} className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-slate-200">{label}</span>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                  <div
                    onClick={() => onChange(!value)}
                    className="w-10 h-5 rounded-full transition-colors cursor-pointer"
                    style={{ backgroundColor: value ? 'var(--accent-primary)' : 'var(--bg-tertiary)' }}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              ))}

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-200">Auto-cutoff</span>
                  <p className="text-xs text-slate-500">Automatically stop recording after duration</p>
                </div>
                <select
                  value={autoCutoffSeconds}
                  onChange={(e) => handleAutoCutoffChange(e.target.value)}
                  className="px-2 py-1 rounded text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  <option value="15">15 sec</option>
                  <option value="30">30 sec</option>
                  <option value="45">45 sec</option>
                  <option value="60">60 sec</option>
                </select>
              </div>
            </div>
          </section>

          {/* Voice Recognition */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              <Mic size={16} style={{ color: 'var(--accent-secondary)' }} />
              Voice Recognition
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-200">Transcription mode</span>
                  <p className="text-xs text-slate-500">
                    {transcriptionMode === 'streaming'
                      ? 'Words appear as you speak (real-time)'
                      : 'Full transcript after you stop (higher accuracy)'}
                  </p>
                </div>
                <select
                  value={transcriptionMode}
                  onChange={(e) => { setTranscriptionMode(e.target.value); saveSetting('transcription_mode', e.target.value) }}
                  className="px-2 py-1 rounded text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  <option value="batch">Batch</option>
                  <option value="streaming">Streaming</option>
                </select>
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm text-slate-200">Dictation commands</span>
                  <p className="text-xs text-slate-500">Say "period", "comma", "new line" to insert punctuation</p>
                </div>
                <div
                  onClick={() => { const next = !dictationEnabled; setDictationEnabled(next); saveSetting('deepgram_dictation', String(next)) }}
                  className="w-10 h-5 rounded-full transition-colors cursor-pointer"
                  style={{ backgroundColor: dictationEnabled ? 'var(--accent-primary)' : 'var(--bg-tertiary)' }}
                >
                  <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${dictationEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>

              <div>
                <span className="text-sm text-slate-200">Keyword boosting</span>
                <p className="text-xs text-slate-500 mb-2">Words or phrases to boost recognition accuracy — one per line</p>
                <textarea
                  value={keywordBoosts}
                  onChange={(e) => handleKeywordBoostsChange(e.target.value)}
                  placeholder={'MacroVox\nOAuth\nrefactor\nyour-custom-term'}
                  rows={3}
                  className="w-full px-3 py-2 rounded text-sm focus:outline-none resize-none font-mono"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </section>

          {/* AI Post-Processing */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-secondary)' }} />
              AI Post-Processing
            </h3>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Claude cleans up transcripts automatically after every recording.</p>
              <div>
                <span className="text-sm text-slate-200">Accessibility context</span>
                <p className="text-xs text-slate-500 mb-2">Describe your speech patterns so Claude can better correct errors</p>
                <textarea
                  value={postProcessingContext}
                  onChange={(e) => { setPostProcessingContext(e.target.value); saveSetting('post_processing_context', e.target.value) }}
                  placeholder={"e.g. I have a speech impediment that affects 'r' and 'l' sounds."}
                  rows={3}
                  className="w-full px-3 py-2 rounded text-sm focus:outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </section>

          {/* Agentic Writing */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              <PenLine size={16} style={{ color: 'var(--accent-secondary)' }} />
              Agentic Writing
            </h3>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Speak a request and Claude generates the full content.</p>
              <div>
                <span className="text-sm text-slate-200">Writing style profile</span>
                <p className="text-xs text-slate-500 mb-2">Describe your voice, tone, and preferences</p>
                <textarea
                  value={writingStyleProfile}
                  onChange={(e) => { setWritingStyleProfile(e.target.value); saveSetting('writing_style_profile', e.target.value) }}
                  placeholder={'e.g. I write casually but precisely. Short sentences.'}
                  rows={4}
                  className="w-full px-3 py-2 rounded text-sm focus:outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </section>

          {/* Dictation Window */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              <Pin size={16} style={{ color: 'var(--accent-secondary)' }} />
              Dictation Window
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Always on top', desc: 'Keep dictation window above other windows', value: alwaysOnTop, onChange: handleAlwaysOnTopToggle },
                { label: 'Minimize to tray on close', desc: 'Clicking X hides the main window instead of quitting', value: minimizeToTray, onChange: handleMinimizeToTrayToggle },
              ].map(({ label, desc, value, onChange }) => (
                <label key={label} className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-slate-200">{label}</span>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                  <div
                    onClick={() => onChange(!value)}
                    className="w-10 h-5 rounded-full transition-colors cursor-pointer"
                    style={{ backgroundColor: value ? 'var(--accent-primary)' : 'var(--bg-tertiary)' }}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Subscription */}
          {user && (
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-secondary)' }} />
                Subscription
              </h3>
              {subscriptionStatus === 'loading' ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-sm">Checking subscription...</span>
                </div>
              ) : isPro ? (
                <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-accent)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--accent-hover)' }}>
                      {subscriptionStatus === 'team' ? 'Team' : 'Pro'} Plan
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">You have access to managed API keys for Deepgram and Claude.</p>
                  <button onClick={handleManageSubscription} className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                    <CreditCard size={12} />
                    Manage subscription
                  </button>
                </div>
              ) : (
                <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>No Active Subscription</p>
                  <p className="text-xs text-slate-400 mb-3">Subscribe to unlock voice dictation and AI post-processing.</p>
                  <button onClick={handleUpgrade} className="w-full py-2 text-white text-sm rounded flex items-center justify-center gap-2 font-medium tracking-wide" style={{ backgroundColor: 'var(--accent-primary)' }}>
                    <Sparkles size={14} />
                    Subscribe — $6.99/mo
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Audio Input */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              <Mic size={16} style={{ color: 'var(--accent-secondary)' }} />
              Audio Input
            </h3>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Microphone</label>
                <button onClick={loadDevices} disabled={isLoading} className="p-1 rounded" style={{ color: 'var(--text-muted)' }} title="Refresh devices">
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              <select
                value={selectedDevice || ''}
                onChange={(e) => handleDeviceSelect(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">Auto-detect</option>
                {devices.map((device) => (
                  <option key={device} value={device}>{device}</option>
                ))}
              </select>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>About</h3>
            <div className="rounded p-3" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--accent-primary)' }}>⬡ MACROVOX</p>
              <p className="text-xs text-slate-400 mt-1">Voice Dictation for Windows</p>
              <p className="text-xs text-slate-500 mt-2">Version 1.0.0</p>
              <p className="text-xs text-slate-500 mt-1">© 2026 OK Studio</p>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>Keyboard Shortcuts</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Toggle Dictation</span>
                <kbd className="px-2 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--accent-hover)' }}>Ctrl+Space</kbd>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex justify-end shrink-0" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white transition-colors font-medium tracking-wide"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
