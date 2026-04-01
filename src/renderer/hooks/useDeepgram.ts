import { useState, useRef, useCallback } from 'react'

interface UseDeepgramOptions {
  useProxy?: boolean
  githubId?: string
}

export function useDeepgram({ useProxy = false, githubId }: UseDeepgramOptions = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async (apiKey: string, mode: 'streaming' | 'batch' = 'batch') => {
    if (!window.electronAPI) return false
    setError(null)

    if (mode === 'streaming') {
      const result = await window.electronAPI.startDeepgram(apiKey)
      if (!result.success) {
        setError(result.error || 'Failed to start streaming')
        return false
      }
    } else {
      const result = await window.electronAPI.startRecording()
      if (!result.success) {
        setError(result.error || 'Failed to start recording')
        return false
      }
    }

    setIsRecording(true)

    // Poll audio level
    audioLevelIntervalRef.current = setInterval(async () => {
      if (window.electronAPI?.getAudioLevel) {
        const level = await window.electronAPI.getAudioLevel()
        setAudioLevel(level)
      }
    }, 50)

    return true
  }, [])

  const stopRecording = useCallback(async (apiKey: string, mode: 'streaming' | 'batch' = 'batch') => {
    if (!window.electronAPI) return null

    // Stop audio level polling
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }

    setIsRecording(false)
    setAudioLevel(0)

    if (mode === 'streaming') {
      await window.electronAPI.stopDeepgram()
      return null // transcript comes via onTranscript events
    }

    setIsProcessing(true)
    const result = await window.electronAPI.stopRecording(apiKey)
    setIsProcessing(false)

    if (result.success && result.transcript) {
      return result.transcript
    } else if (!result.success && result.error) {
      setError(result.error)
    }
    return null
  }, [])

  return {
    isRecording,
    isProcessing,
    transcript,
    setTranscript,
    error,
    setError,
    audioLevel,
    startRecording,
    stopRecording,
  }
}
