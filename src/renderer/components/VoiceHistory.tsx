/**
 * VoiceHistory — lists voice buffer recordings with playback and delete.
 *
 * Renders inside the settings panel when voice buffer is enabled.
 * Audio playback uses HTML5 <audio> with base64-encoded WAV data URIs
 * fetched from the Rust backend on demand.
 */

import { useState, useEffect, useRef } from 'react'
import { Play, Square, Trash2, Loader2 } from 'lucide-react'
import * as ipc from '../lib/tauri-ipc'
import type { VoiceRecording } from '../lib/tauri-ipc'

export function VoiceHistory() {
  const [recordings, setRecordings] = useState<VoiceRecording[]>([])
  const [loading, setLoading] = useState(true)
  const [playingFile, setPlayingFile] = useState<string | null>(null)
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const loadRecordings = async () => {
    setLoading(true)
    const list = await ipc.voiceBufferList()
    setRecordings(list)
    setLoading(false)
  }

  useEffect(() => {
    loadRecordings()
  }, [])

  const handlePlay = async (file: string) => {
    // Stop current playback if any
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (playingFile === file) {
      setPlayingFile(null)
      return
    }

    setLoadingAudio(file)
    try {
      const { base64, mime } = await ipc.voiceBufferGetAudio(file)
      const audio = new Audio(`data:${mime};base64,${base64}`)
      audio.onended = () => setPlayingFile(null)
      audioRef.current = audio
      await audio.play()
      setPlayingFile(file)
    } catch {
      console.warn('[VoiceHistory] Playback failed for', file)
    } finally {
      setLoadingAudio(null)
    }
  }

  const handleDelete = async (file: string) => {
    if (playingFile === file) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingFile(null)
    }
    await ipc.voiceBufferDelete(file)
    setRecordings(prev => prev.filter(r => r.file !== file))
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (recordings.length === 0) {
    return (
      <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
        No recordings yet. Recordings will appear here after you dictate.
      </p>
    )
  }

  return (
    <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
      {recordings.map((rec) => (
        <div
          key={rec.file}
          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
          style={{
            backgroundColor: playingFile === rec.file ? 'var(--accent-primary-10, rgba(103,232,249,0.1))' : 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          {/* Play/Stop button */}
          <button
            onClick={() => handlePlay(rec.file)}
            className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: playingFile === rec.file ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
            title={playingFile === rec.file ? 'Stop' : 'Play'}
          >
            {loadingAudio === rec.file ? (
              <Loader2 size={14} className="animate-spin" />
            ) : playingFile === rec.file ? (
              <Square size={14} />
            ) : (
              <Play size={14} />
            )}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ color: 'var(--text-primary)' }}>
              {rec.transcript || '(no transcript)'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              {formatDate(rec.timestamp)} · {formatDuration(rec.duration_secs)} · {formatSize(rec.size_bytes)}
            </p>
          </div>

          {/* Delete button */}
          <button
            onClick={() => handleDelete(rec.file)}
            className="shrink-0 p-1 rounded hover:bg-red-900/40 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Delete recording"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
