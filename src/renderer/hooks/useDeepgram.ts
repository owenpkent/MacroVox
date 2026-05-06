/**
 * useDeepgram — recording + transcription state for a single dictation flow.
 *
 * Wraps the IPC bridge (`startDeepgram`/`startRecording` etc.) and exposes
 * UI-friendly state: `isRecording`, `isProcessing`, `transcript`, `error`,
 * `audioLevel`. Supports both `'streaming'` (live WebSocket) and `'batch'`
 * (record-then-upload) modes via the `mode` argument.
 *
 * In streaming mode the returned `transcript` is **not** populated by this
 * hook — interim/final fragments arrive via `onTranscript` events and are
 * combined by the caller. `stopRecording` returns `null` in that case.
 *
 * Audio level polling runs every 50 ms while recording so the UI VU meter
 * stays smooth; the interval is cleared on stop and on unmount via the
 * `audioLevelIntervalRef` guard.
 */

import { useState, useRef, useCallback } from 'react'
import * as ipc from '../lib/tauri-ipc'

export function useDeepgram() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Begins capture. Returns `true` if the backend accepted the start; `false`
   * (and sets `error`) if it rejected. The audio level poller starts on success.
   */
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

  /**
   * Stops capture. In batch mode resolves to the final transcript string (or
   * `null` on failure). In streaming mode always resolves to `null` — the
   * transcript stream comes from `onTranscript` events handled by the caller.
   */
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
