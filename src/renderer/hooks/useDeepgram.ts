import { useState, useRef, useCallback } from 'react'
import * as ipc from '../lib/tauri-ipc'

export function useDeepgram() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async (apiKey: string, mode: 'streaming' | 'batch' = 'batch') => {
    setError(null)

    if (mode === 'streaming') {
      const result = await ipc.startDeepgram(apiKey)
      if (!result.success) {
        setError(result.error || 'Failed to start streaming')
        return false
      }
    } else {
      const result = await ipc.startRecording()
      if (!result.success) {
        setError(result.error || 'Failed to start recording')
        return false
      }
    }

    setIsRecording(true)

    audioLevelIntervalRef.current = setInterval(async () => {
      const level = await ipc.getAudioLevel()
      setAudioLevel(level)
    }, 50)

    return true
  }, [])

  const stopRecording = useCallback(async (apiKey: string, mode: 'streaming' | 'batch' = 'batch') => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }

    setIsRecording(false)
    setAudioLevel(0)

    if (mode === 'streaming') {
      await ipc.stopDeepgram()
      return null // transcript comes via onTranscript events
    }

    setIsProcessing(true)
    const result = await ipc.stopRecording(apiKey)
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
