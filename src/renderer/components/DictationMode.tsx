import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Copy, Check, Trash2, Loader2, Settings } from 'lucide-react'
import { usePostProcessing } from '../hooks/usePostProcessing'

interface DictationUser {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  authMethod: string
}

export function DictationMode() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [isLoadingKey, setIsLoadingKey] = useState(true)
  const [user, setUser] = useState<DictationUser | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null)
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Quick Dictation settings from localStorage
  const [autoCopyOnStop, setAutoCopyOnStop] = useState(() => 
    localStorage.getItem('dictation_auto_copy') === 'true'
  )
  const [clearOnNewRecording, setClearOnNewRecording] = useState(() => 
    localStorage.getItem('dictation_clear_on_new') === 'true'
  )
  const [autoCutoffSeconds, setAutoCutoffSeconds] = useState(() => 
    localStorage.getItem('dictation_auto_cutoff') || '30'
  )
  const [transcriptionMode, setTranscriptionMode] = useState(() => 
    localStorage.getItem('transcription_mode') || 'batch'
  )
  const [autoPasteEnabled, setAutoPasteEnabled] = useState(() =>
    localStorage.getItem('dictation_auto_paste') === 'true'
  )
  const streamingTranscriptRef = useRef('')

  const { postProcess, isPostProcessing } = usePostProcessing({
    useProxy: !!user,
    githubId: user?.id?.toString(),
  })

  // Listen for settings changes from other windows via IPC
  useEffect(() => {
    if (!window.electronAPI?.onSettingsChanged) return
    const cleanup = window.electronAPI.onSettingsChanged((settings) => {
      // Update localStorage and React state for each changed setting
      for (const [key, value] of Object.entries(settings)) {
        localStorage.setItem(key, value)
        switch (key) {
          case 'dictation_auto_copy': setAutoCopyOnStop(value === 'true'); break
          case 'dictation_clear_on_new': setClearOnNewRecording(value === 'true'); break
          case 'dictation_auto_cutoff': setAutoCutoffSeconds(value || '30'); break
          case 'transcription_mode': setTranscriptionMode(value || 'batch'); break
          case 'dictation_auto_paste': setAutoPasteEnabled(value === 'true'); break
        }
      }
    })
    return cleanup
  }, [])

  // Cleanup auto-stop timer on unmount
  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current)
      }
    }
  }, [])

  // Listen for streaming transcripts from Deepgram
  useEffect(() => {
    if (!window.electronAPI?.onTranscript) return
    const cleanup = window.electronAPI.onTranscript(({ transcript: text, isFinal }) => {
      if (isFinal && text) {
        // Append final transcript
        streamingTranscriptRef.current = streamingTranscriptRef.current
          ? streamingTranscriptRef.current + ' ' + text
          : text
        setTranscript(streamingTranscriptRef.current)
      }
    })
    return cleanup
  }, [])

  // Extract as useCallback so it can be re-run whenever the window is shown
  const loadApiKey = useCallback(async () => {
    if (!window.electronAPI) {
      setIsLoadingKey(false)
      return
    }

    // Load user from Supabase session
    try {
      const userResult = await window.electronAPI.getUser()
      if (userResult.success && userResult.user) {
        setUser(userResult.user)

        // Try managed key for Pro users
        try {
          const keysResult = await window.electronAPI.getManagedKeys()
          if (keysResult.success && keysResult.deepgramKey) {
            console.log('[Dictation] Got managed API key')
            setApiKey(keysResult.deepgramKey)
            setIsLoadingKey(false)
            return
          }
        } catch (err) {
          console.log('[Dictation] Managed keys not available:', err)
        }
      }
    } catch {}

    // No BYOK — managed keys only. User must subscribe.
    setApiKey(null)
    setIsLoadingKey(false)
  }, [])

  // Load key on mount
  useEffect(() => {
    loadApiKey()
  }, [loadApiKey])

  // Re-run loadApiKey every time the window is shown via Ctrl+Space.
  // With hide-on-close + pre-warm the component never unmounts, so the
  // mount-time load may have run before auth was complete — this retries.
  useEffect(() => {
    if (!window.electronAPI?.onQuickDictationToggle) return
    const cleanup = window.electronAPI.onQuickDictationToggle(() => {
      loadApiKey()
    })
    return cleanup
  }, [loadApiKey])

  // Periodically re-check auth in case user logs in from settings window
  useEffect(() => {
    const interval = setInterval(() => {
      if (!user) loadApiKey()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadApiKey, user])

  const handleStartRecording = async () => {
    if (!window.electronAPI || !apiKey) return
    setError(null)
    
    // Clear previous transcript if setting is enabled
    if (clearOnNewRecording) {
      setTranscript('')
    }
    
    setIsPreparing(true)
    setAudioLevel(0)

    if (transcriptionMode === 'streaming') {
      // Streaming mode: real-time transcription via WebSocket
      streamingTranscriptRef.current = transcript || ''
      const result = await window.electronAPI.startDeepgram(apiKey)
      if (!result.success) {
        setError(result.error || 'Failed to start streaming')
        setIsPreparing(false)
        return
      }
    } else {
      // Batch mode: buffer audio, transcribe after stop
      const result = await window.electronAPI.startRecording()
      if (!result.success) {
        setError(result.error || 'Failed to start')
        setIsPreparing(false)
        return
      }
    }
    
    // Mic is ready — switch from preparing to recording
    setIsPreparing(false)
    setIsRecording(true)
    
    // Poll for audio level visualization
    audioLevelIntervalRef.current = setInterval(async () => {
      if (window.electronAPI?.getAudioLevel) {
        const level = await window.electronAPI.getAudioLevel()
        setAudioLevel(level)
      }
    }, 50)
    
    // Auto-stop after configured duration if setting is enabled
    if (autoCutoffSeconds && autoCutoffSeconds !== 'off') {
      const durationMs = parseInt(autoCutoffSeconds, 10) * 1000
      autoStopTimerRef.current = setTimeout(() => {
        // Clear previous transcript so cutoff transcription replaces it
        setTranscript('')
        streamingTranscriptRef.current = ''
        handleStopRecording()
      }, durationMs)
    }
  }

  const handleStopRecording = async () => {
    if (!window.electronAPI || !apiKey) return
    
    // Clear auto-stop timer if it exists
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
    
    // Stop audio level polling
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }
    
    setIsRecording(false)
    setAudioLevel(0)

    if (transcriptionMode === 'streaming') {
      // Streaming mode: just stop, transcript already accumulated in real-time
      await window.electronAPI.stopDeepgram()
      
      // Auto-copy if setting is enabled
      const currentText = streamingTranscriptRef.current
      if (autoCopyOnStop && currentText) {
        if (window.electronAPI?.copyToClipboard) {
          await window.electronAPI.copyToClipboard(currentText)
        } else {
          await navigator.clipboard.writeText(currentText).catch(() => {})
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } else {
      // Batch mode: transcribe the buffered audio
      setIsProcessing(true)
      const result = await window.electronAPI.stopRecording(apiKey)
      setIsProcessing(false)
      if (result.success && result.transcript) {
        const rawSegment = result.transcript
        // Show raw transcript immediately so there's zero wait for the user
        // Use functional updater to avoid stale closure over `transcript`
        let rawText = ''
        setTranscript(prev => {
          rawText = prev ? prev + ' ' + rawSegment : rawSegment
          return rawText
        })

        // Auto-copy raw text right away
        if (autoCopyOnStop) {
          if (window.electronAPI?.copyToClipboard) {
            await window.electronAPI.copyToClipboard(rawText)
          } else {
            await navigator.clipboard.writeText(rawText).catch(() => {})
          }
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }

        // Post-process in the background — updates transcript when ready
        // Use functional updater so the .then() callback always sees the
        // latest transcript, even if another recording completes first.
        postProcess(rawSegment).then((cleaned) => {
          if (cleaned && cleaned !== rawSegment) {
            setTranscript(prev => {
              // Replace the raw segment with the cleaned version
              const cleanedFull = prev.replace(rawSegment, cleaned)
              // Re-copy if auto-copy is on, since text improved
              if (autoCopyOnStop) {
                if (window.electronAPI?.copyToClipboard) {
                  window.electronAPI.copyToClipboard(cleanedFull)
                } else {
                  navigator.clipboard.writeText(cleanedFull).catch(() => {})
                }
              }
              return cleanedFull
            })
          }
        })
      } else if (!result.success && result.error) {
        setError(result.error)
      }
    }
  }

  const handleCopy = async () => {
    if (!transcript) return
    try {
      if (window.electronAPI?.copyToClipboard) {
        await window.electronAPI.copyToClipboard(transcript)
      } else {
        await navigator.clipboard.writeText(transcript)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed')
    }
  }

  const handleClear = () => {
    setTranscript('')
    setError(null)
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [transcript])

  // Handle Ctrl+Space quick dictation shortcut
  useEffect(() => {
    if (!window.electronAPI) return

    const cleanupStart = window.electronAPI.onQuickDictationStart(() => {
      if (apiKey && !isRecording && !isPreparing && !isProcessing) {
        handleStartRecording()
      }
    })

    const cleanupToggle = window.electronAPI.onQuickDictationToggle(() => {
      if (isRecording) {
        handleStopAndCopy()
      } else if (apiKey && !isPreparing && !isProcessing) {
        handleStartRecording()
      }
    })

    return () => {
      cleanupStart?.()
      cleanupToggle?.()
    }
  }, [apiKey, isRecording, isPreparing, isProcessing])

  const handleStopAndCopy = async () => {
    if (!window.electronAPI || !apiKey) return
    
    // Clear auto-stop timer if it exists
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
    
    // Stop audio level polling
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }
    
    setIsRecording(false)
    setIsProcessing(true)
    setAudioLevel(0)
    const result = await window.electronAPI.stopRecording(apiKey)
    setIsProcessing(false)
    if (result.success && result.transcript) {
      const rawSegment = result.transcript
      // Show raw transcript immediately — no wait for post-processing
      // Use functional updater to avoid stale closure over `transcript`
      let rawText = ''
      setTranscript(prev => {
        rawText = prev ? prev + ' ' + rawSegment : rawSegment
        return rawText
      })

      // Copy raw text right away
      if (window.electronAPI?.copyToClipboard) {
        await window.electronAPI.copyToClipboard(rawText)
      } else {
        await navigator.clipboard.writeText(rawText).catch(() => {})
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      // Auto-paste: hide window and send Ctrl+V to previously focused app
      if (autoPasteEnabled && window.electronAPI?.autoPaste) {
        window.electronAPI.autoPaste()
      }

      // Post-process in background — updates transcript when Claude responds
      // Use functional updater so the .then() callback always sees the
      // latest transcript, even if another recording completes first.
      postProcess(rawSegment).then((cleaned) => {
        if (cleaned && cleaned !== rawSegment) {
          setTranscript(prev => {
            const cleanedFull = prev.replace(rawSegment, cleaned)
            // Re-copy improved text
            if (window.electronAPI?.copyToClipboard) {
              window.electronAPI.copyToClipboard(cleanedFull)
            } else {
              navigator.clipboard.writeText(cleanedFull).catch(() => {})
            }
            return cleanedFull
          })
        }
      })
    } else if (!result.success && result.error) {
      setError(result.error)
    }
  }

  if (isLoadingKey) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col p-4 select-none font-mono" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Drag area for window with settings button */}
      <div className="h-6 -mx-4 -mt-4 mb-2 flex items-center justify-between px-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span className="text-[10px] uppercase tracking-widest ml-2" style={{ color: 'var(--accent-secondary)' }}>MacroVox</span>
        <button
          onClick={() => window.electronAPI?.openSettingsWindow()}
          className="p-1 rounded"
          style={{ color: 'var(--text-muted)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Main content */}
      <div className="shrink-0 flex flex-col items-center justify-center gap-4">
        {/* Error */}
        {error && (
          <div className="text-xs px-3 py-1 rounded" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Record button with voice-reactive animation */}
        <div className="relative">
          {/* Voice-reactive rings */}
          {isRecording && (
            <>
              {/* Outer scanning ring */}
              <div 
                className="absolute inset-[-8px] rounded-full border-2 border-red-500/40"
                style={{ 
                  animation: 'spin 3s linear infinite',
                  borderStyle: 'dashed'
                }}
              />
              {/* Pulsing radar ring */}
              <div 
                className="absolute inset-[-4px] rounded-full border-2 border-red-500/50 animate-ping"
                style={{ animationDuration: '1.5s' }}
              />
              {/* Audio-reactive concentric rings - amplified */}
              <div 
                className="absolute inset-0 rounded-full bg-red-500/30 transition-transform duration-50"
                style={{ 
                  transform: `scale(${1.2 + audioLevel * 1.2})`,
                  opacity: 0.3 + audioLevel * 0.7
                }}
              />
              <div 
                className="absolute inset-0 rounded-full bg-red-500/20 transition-transform duration-75"
                style={{ 
                  transform: `scale(${1.5 + audioLevel * 1.8})`,
                  opacity: 0.2 + audioLevel * 0.5
                }}
              />
              <div 
                className="absolute inset-0 rounded-full border-2 border-red-500/40 transition-transform duration-100"
                style={{ 
                  transform: `scale(${1.8 + audioLevel * 2.4})`,
                  opacity: 0.15 + audioLevel * 0.4
                }}
              />
              {/* Outer glow ring */}
              <div 
                className="absolute inset-0 rounded-full border border-red-400/20 transition-transform duration-150"
                style={{ 
                  transform: `scale(${2.1 + audioLevel * 3.0})`,
                  opacity: 0.1 + audioLevel * 0.3
                }}
              />
              {/* Inner core glow */}
              <div 
                className="absolute inset-2 rounded-full bg-red-500/50 blur-md transition-opacity duration-50"
                style={{ opacity: 0.5 + audioLevel * 0.5 }}
              />
            </>
          )}
          
          {/* Processing state */}
          {isProcessing && (
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/50 animate-spin" style={{ animationDuration: '1s' }} />
          )}
          
          {/* Preparing mic spinner */}
          {isPreparing && (
            <div className="absolute inset-[-4px] rounded-full border-2 border-amber-500/50 animate-spin" style={{ borderStyle: 'dashed', animationDuration: '1.5s' }} />
          )}
          
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isProcessing || isPreparing || !apiKey}
            className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${(!apiKey || isProcessing || isPreparing) ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ 
              backgroundColor: isPreparing ? 'var(--warning, #d97706)' : isRecording ? 'var(--danger)' : 'var(--accent-primary)',
              border: `2px solid ${isPreparing ? 'var(--warning, #d97706)' : isRecording ? 'var(--danger)' : 'var(--accent-hover)'}`
            }}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : isPreparing ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>
        </div>

        {/* Audio level bars — waveform visualizer */}
        {isRecording && (
          <div className="flex items-center gap-[3px] h-8">
            {[...Array(11)].map((_, i) => {
              const center = 5
              const dist = Math.abs(i - center)
              const amplified = Math.min(audioLevel * 4, 1)
              const barLevel = Math.max(0.08, amplified - (dist * 0.05))
              return (
                <div 
                  key={i}
                  className="w-[3px] rounded-full transition-all duration-[60ms]"
                  style={{ 
                    backgroundColor: 'var(--danger)',
                    height: `${3 + barLevel * 28}px`,
                    opacity: 0.3 + barLevel * 0.7
                  }}
                />
              )
            })}
          </div>
        )}

        {/* Status */}
        <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {!apiKey 
            ? 'Sign in & subscribe to start' 
            : isPostProcessing
              ? '◎ AI cleanup...'
              : isProcessing 
              ? '◎ Transcribing...' 
              : isPreparing
                ? '◎ Preparing mic — please wait...'
                : isRecording 
                  ? '● Recording — click to stop' 
                  : '○ Click to record'}
        </p>
      </div>

      {/* Transcript area */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <textarea
          ref={textareaRef}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript appears here..."
          className="w-full flex-1 min-h-[60px] p-2 rounded text-sm resize-none focus:outline-none overflow-y-auto"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        />
        
        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleClear}
            disabled={!transcript}
            className="p-2 rounded-lg transition-colors hover:bg-red-900/40 disabled:cursor-not-allowed"
            style={{ color: transcript ? '#f87171' : 'var(--text-secondary)', opacity: transcript ? 1 : 0.4 }}
            title="Clear transcript"
          >
            <Trash2 size={20} strokeWidth={2} />
          </button>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {transcript ? `${transcript.split(/\s+/).filter(Boolean).length} words` : ''}
          </span>
          <button
            onClick={handleCopy}
            disabled={!transcript}
            className="p-2 rounded-lg transition-colors hover:bg-cyan-900/40 disabled:cursor-not-allowed"
            style={{ color: transcript ? (copied ? '#34d399' : '#67e8f9') : 'var(--text-secondary)', opacity: transcript ? 1 : 0.4 }}
            title="Copy to clipboard"
          >
            {copied ? <Check size={20} strokeWidth={2} /> : <Copy size={20} strokeWidth={2} />}
          </button>
        </div>
      </div>

    </div>
  )
}
