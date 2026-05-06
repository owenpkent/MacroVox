/**
 * MacroVox — Deepgram client for the Electron main process.
 *
 * Wraps the official `@deepgram/sdk` for two paths:
 *   1. Real-time streaming via `start()` — pumps PCM from a `PassThrough`
 *      into a Live Transcription socket and dispatches `(transcript, isFinal)`
 *      callbacks. Used when the user has selected "streaming" mode.
 *   2. Batch via `transcribeBatch()` — uploads a finished PCM buffer (wrapped
 *      in a WAV header) to the pre-recorded API and returns the final
 *      transcript. Used by the default "record then transcribe" mode.
 *
 * The Tauri rebuild moves both paths into Rust (`src-tauri/src/deepgram_ws.rs`
 * + the `recording_stop` HTTP path); this module remains for the Electron build.
 */

import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk'
import { PassThrough } from 'stream'

/** Callback fired for every interim and final transcript fragment. */
type TranscriptCallback = (transcript: string, isFinal: boolean) => void

/** Result returned by the pre-recorded ("batch") transcription path. */
export interface BatchTranscriptResult {
  /** Final transcript text (joined alternatives). */
  transcript: string
  /** Confidence of the top alternative, 0.0–1.0. */
  confidence: number
  /** Audio duration in seconds, as reported by Deepgram metadata. */
  duration: number
}

/**
 * Wraps a raw PCM buffer in a 44-byte RIFF/WAV header.
 *
 * Deepgram's pre-recorded API accepts raw PCM but is more forgiving when
 * given a proper WAV container with explicit sample-rate/channel metadata.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 16000, channels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = sampleRate * channels * bitsPerSample / 8
  const blockAlign = channels * bitsPerSample / 8
  const dataSize = pcmBuffer.length
  const headerSize = 44
  const fileSize = headerSize + dataSize - 8
  
  const header = Buffer.alloc(headerSize)
  
  // RIFF header
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)
  
  // fmt chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)           // fmt chunk size
  header.writeUInt16LE(1, 20)            // audio format (1 = PCM)
  header.writeUInt16LE(channels, 22)     // number of channels
  header.writeUInt32LE(sampleRate, 24)   // sample rate
  header.writeUInt32LE(byteRate, 28)     // byte rate
  header.writeUInt16LE(blockAlign, 32)   // block align
  header.writeUInt16LE(bitsPerSample, 34) // bits per sample
  
  // data chunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  
  return Buffer.concat([header, pcmBuffer])
}

/**
 * Manages a Deepgram session — either a Live Transcription WebSocket or a
 * one-shot pre-recorded upload. One instance handles one logical session
 * (start → stop, or a single batch call).
 */
export class DeepgramStreamer {
  private client: ReturnType<typeof createClient>
  private connection: LiveClient | null = null
  private isConnected: boolean = false
  private audioStream: PassThrough | null = null
  private dataHandler: ((chunk: Buffer) => void) | null = null
  private errorHandler: ((err: Error) => void) | null = null
  private endHandler: (() => void) | null = null

  /** @param apiKey Deepgram API token. Throws synchronously if empty. */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Deepgram API key is required')
    }
    this.client = createClient(apiKey)
  }

  /**
   * Opens a Live Transcription WebSocket and pipes `audioStream` into it.
   *
   * The promise resolves when Deepgram's `Open` event fires (so callers can
   * be sure the connection is ready before they signal "recording" in the UI).
   * Transcripts arrive via `onTranscript(text, isFinal)` for both interim and
   * final results; empty fragments are filtered.
   *
   * Tunings (set on the live options): `utterance_end_ms: 500` and
   * `endpointing: 200` are tighter than the SDK defaults so a sentence ends
   * faster after a brief pause — important for dictation feel.
   */
  async start(audioStream: PassThrough, onTranscript: TranscriptCallback): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Connecting to Deepgram...')

        const options = {
          model: 'nova-3',
          language: 'en-US',
          interim_results: true,
          punctuate: true,
          smart_format: true,
          dictation: true,
          vad_events: true,
          utterance_end_ms: 500,   // Reduced from 1000ms: finalize faster after silence
          endpointing: 200,        // Reduced from 300ms: shorter pause = end of sentence
          encoding: 'linear16' as const,
          sample_rate: 16000,
          channels: 1,
        }

        this.connection = this.client.listen.live(options)

        this.connection.on(LiveTranscriptionEvents.Open, () => {
          console.log('Deepgram connection opened')
          this.isConnected = true
          resolve()
        })

        this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
          if (data.channel?.alternatives?.[0]) {
            const transcript = data.channel.alternatives[0].transcript
            const isFinal = data.is_final === true

            if (transcript) {
              console.log(`[${isFinal ? 'final' : 'interim'}] ${transcript}`)
              onTranscript(transcript, isFinal)
            }
          }
        })

        this.connection.on(LiveTranscriptionEvents.Error, (err: Error) => {
          console.error('Deepgram error:', err.message)
          this.isConnected = false
        })

        this.connection.on(LiveTranscriptionEvents.Close, () => {
          console.log('Deepgram connection closed')
          this.isConnected = false
        })

        // Store stream reference so stop() can remove listeners
        this.audioStream = audioStream

        this.dataHandler = (chunk: Buffer) => {
          if (this.isConnected && this.connection) {
            try {
              const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
              this.connection.send(arrayBuffer)
            } catch (err) {
              console.error('Error sending audio chunk:', (err as Error).message)
            }
          }
        }

        this.errorHandler = (err: Error) => {
          console.error('Audio stream error:', err.message)
          this.stop()
          reject(err)
        }

        this.endHandler = () => {
          console.log('Audio stream ended')
          this.stop()
        }

        audioStream.on('data', this.dataHandler)
        audioStream.on('error', this.errorHandler)
        audioStream.on('end', this.endHandler)

      } catch (err) {
        console.error('Failed to start Deepgram:', err)
        reject(err)
      }
    })
  }

  /**
   * Detaches from the audio stream, then closes the Deepgram socket.
   *
   * Listeners are removed **before** the connection is finished so a chunk
   * arriving from a still-alive ffmpeg stream can't try to write to a closed
   * socket. Safe to call multiple times.
   */
  stop(): void {
    // Remove audio stream listeners before closing connection to prevent
    // stale chunks being sent if the ffmpeg stream outlives this session
    if (this.audioStream) {
      if (this.dataHandler)  this.audioStream.removeListener('data',  this.dataHandler)
      if (this.errorHandler) this.audioStream.removeListener('error', this.errorHandler)
      if (this.endHandler)   this.audioStream.removeListener('end',   this.endHandler)
      this.dataHandler = null
      this.errorHandler = null
      this.endHandler = null
      this.audioStream = null
    }
    if (this.connection) {
      console.log('Stopping Deepgram connection...')
      this.connection.finish()
      this.connection = null
      this.isConnected = false
    }
  }

  /** True between Deepgram's `Open` and `Close` events (or until `stop()`). */
  isLive(): boolean {
    return this.isConnected
  }

  /**
   * Uploads a completed PCM buffer to Deepgram's pre-recorded API and
   * returns the final transcript.
   *
   * @param audioBuffer  Raw 16-bit signed little-endian PCM at 16 kHz mono.
   * @param keywords     Optional keyword-boost list (forwarded to the API).
   * @returns Transcript text plus confidence/duration metadata.
   *
   * Logging note: error paths log `err.message` only — the SDK attaches the
   * outgoing request to errors, which carries the `Authorization` header. A
   * naive `JSON.stringify(err)` would leak the API key into stdout.
   */
  async transcribeBatch(audioBuffer: Buffer, keywords?: string[]): Promise<BatchTranscriptResult> {
    console.log(`[Deepgram] Transcribing batch audio: ${audioBuffer.length} bytes`)
    
    // Calculate audio duration: 16000 samples/sec * 2 bytes/sample = 32000 bytes/sec
    const estimatedDuration = audioBuffer.length / 32000
    console.log(`[Deepgram] Estimated audio duration: ${estimatedDuration.toFixed(2)} seconds`)
    
    // Check if audio has any content (not just silence)
    let maxSample = 0
    for (let i = 0; i < Math.min(audioBuffer.length, 10000); i += 2) {
      const sample = Math.abs(audioBuffer.readInt16LE(i))
      if (sample > maxSample) maxSample = sample
    }
    console.log(`[Deepgram] Max sample in first 10KB: ${maxSample} (silence threshold ~500)`)
    
    if (maxSample < 500) {
      console.warn('[Deepgram] Audio appears to be mostly silence!')
    }
    
    try {
      // Convert raw PCM to WAV format for reliable processing
      const wavBuffer = pcmToWav(audioBuffer, 16000, 1, 16)
      console.log(`[Deepgram] Converted to WAV: ${wavBuffer.length} bytes`)
      console.log('[Deepgram] Calling transcribeFile API...')
      
      const transcribeOptions: Record<string, unknown> = {
        model: 'nova-3',
        language: 'en-US',
        punctuate: true,
        smart_format: true,
        dictation: true,
        mimetype: 'audio/wav',
      }
      if (keywords && keywords.length > 0) {
        transcribeOptions['keywords'] = keywords
        console.log(`[Deepgram] Keyword boosting: ${keywords.join(', ')}`)
      }

      const response = await this.client.listen.prerecorded.transcribeFile(
        wavBuffer,
        transcribeOptions as Parameters<typeof this.client.listen.prerecorded.transcribeFile>[1]
      )

      // Avoid JSON.stringify(response) — the SDK includes the request object
      // on errors, which carries the Authorization header. Logging only the
      // shape keeps debugging useful without leaking the API key into stdout.
      const result = (response as any)?.result || response

      if ((response as any)?.error || (result as any)?.error) {
        const e = (response as any)?.error || (result as any)?.error
        console.error('[Deepgram] API returned error:', typeof e === 'string' ? e : (e?.message ?? 'unknown'))
      }

      const transcript = (result as any)?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
      const confidence = (result as any)?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
      const duration = (result as any)?.metadata?.duration || 0

      console.log(`[Deepgram] Batch transcription complete (${transcript.length} chars, conf=${confidence.toFixed(2)}, ${duration}s)`)

      return {
        transcript,
        confidence,
        duration
      }
    } catch (err: any) {
      // Log only the message; never JSON.stringify the error (it includes the
      // request object, which has the Authorization header).
      console.error('[Deepgram] Batch transcription failed:', err?.message ?? 'unknown')
      throw err
    }
  }
}
