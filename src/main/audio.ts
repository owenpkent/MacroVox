/**
 * MacroVox — Electron-era audio capture (ffmpeg subprocess).
 *
 * Spawns `ffmpeg` to capture microphone audio as 16-bit signed little-endian
 * PCM at 16 kHz mono and exposes:
 *   - level metering (RMS + peak, smoothed) for the UI VU meter
 *   - a buffered "record-then-transcribe" path (`startBuffering`/`stopBuffering`)
 *   - a streaming `PassThrough` consumed by `DeepgramStreamer`
 *
 * The Tauri rebuild uses `cpal` directly (`src-tauri/src/audio.rs`) which
 * removes the subprocess and ~700 ms of ffmpeg startup latency. This module
 * remains in tree for the Electron build path.
 *
 * ## Platform notes
 * - Windows: enumerates DirectShow devices via `ffmpeg -list_devices`. Output
 *   is parsed from stderr because ffmpeg writes the device list there and exits
 *   non-zero. Stereo input is downmixed to mono via the `pan` filter so we
 *   capture audio even when one channel is dead.
 * - macOS: AVFoundation `:default` (whatever the system picks).
 * - Linux: PulseAudio `default` source.
 */

import { spawn, spawnSync, ChildProcess, execSync } from 'child_process'
import { PassThrough } from 'stream'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

/**
 * Locates an `ffmpeg` executable.
 *
 * Tries PATH first, then probes well-known install locations (WinGet's
 * `Gyan.FFmpeg` package, common `C:\ffmpeg`/`Program Files` paths on Windows;
 * Homebrew on macOS; `/usr/bin` on Linux). Returns `null` if nothing is found,
 * leaving the caller to surface an install-instruction error to the user.
 */
function findFfmpeg(): string | null {
  // First try PATH
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    return 'ffmpeg'
  } catch {
    // Not in PATH, check common locations
  }

  const platform = os.platform()
  const home = os.homedir()
  
  const possiblePaths: string[] = []
  
  if (platform === 'win32') {
    // WinGet installation path pattern
    const wingetBase = path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages')
    if (fs.existsSync(wingetBase)) {
      try {
        const packages = fs.readdirSync(wingetBase)
        for (const pkg of packages) {
          if (pkg.startsWith('Gyan.FFmpeg')) {
            const pkgPath = path.join(wingetBase, pkg)
            const subDirs = fs.readdirSync(pkgPath)
            for (const subDir of subDirs) {
              const ffmpegExe = path.join(pkgPath, subDir, 'bin', 'ffmpeg.exe')
              if (fs.existsSync(ffmpegExe)) {
                possiblePaths.push(ffmpegExe)
              }
            }
          }
        }
      } catch {}
    }
    
    // Other common Windows paths
    possiblePaths.push(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe'
    )
  } else if (platform === 'darwin') {
    possiblePaths.push(
      '/usr/local/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg'
    )
  } else {
    possiblePaths.push(
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg'
    )
  }
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log('[Audio] Found ffmpeg at:', p)
      return p
    }
  }
  
  return null
}

/**
 * Enumerates DirectShow audio capture devices on Windows by parsing
 * `ffmpeg -list_devices`.
 *
 * Uses `spawnSync` (not `execSync`) with the binary path as a separate argv
 * entry so a path containing spaces, quotes, or shell metacharacters can never
 * be reparsed by `/bin/sh` or `cmd.exe`.
 *
 * `ffmpeg -list_devices` exits non-zero but writes the device list to **stderr**,
 * so the parser concatenates stdout + stderr.
 */
// ffmpegPath is the bundled binary path resolved from app resources,
// never user input. spawnSync with shell: false and an argv list means
// no shell interpretation; semgrep's detect-child-process heuristic
// flags any parameter-driven child_process call regardless of safety.
function listWindowsAudioDevices(ffmpegPath: string): string[] {
  const result = spawnSync(
    ffmpegPath,  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
    ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
    { encoding: 'utf8', windowsHide: true, shell: false },
  )
  // ffmpeg exits non-zero but still writes the device list to stderr.
  const output = `${result.stdout || ''}${result.stderr || ''}`
  const devices: string[] = []
  for (const line of output.split('\n')) {
    const match = line.match(/"([^"]+)" \(audio\)/)
    if (match) devices.push(match[1])
  }
  return devices
}

/**
 * Microphone capture session backed by an `ffmpeg` child process.
 *
 * Lifecycle: `new AudioCapture(device?)` → `start()` (or `startPersistent()` to
 * pre-warm) → optional `enableStreaming()`/`startBuffering()` → `stop()`.
 *
 * One instance owns one ffmpeg subprocess. `stop()` kills the process and
 * tears down the `PassThrough` stream; the instance should be discarded after.
 */
export class AudioCapture {
  private recordingProcess: ChildProcess | null = null
  private audioStream: PassThrough | null = null
  private audioLevel: number = 0
  private levelInterval: NodeJS.Timeout | null = null
  private ffmpegPath: string | null = null
  private audioBuffer: Buffer[] = []
  private isBuffering: boolean = false
  private selectedDevice: string | null = null
  private streamingEnabled: boolean = false

  /**
   * Returns the list of input device names.
   * On Windows this is the DirectShow device list; on other platforms it's
   * just `['default']` because we hand audio routing to the OS.
   */
  static getAvailableDevices(): string[] {
    const ffmpegPath = findFfmpeg()
    if (!ffmpegPath) return []
    
    if (os.platform() === 'win32') {
      return listWindowsAudioDevices(ffmpegPath)
    }
    return ['default']
  }

  /**
   * @param deviceName - Optional Windows DirectShow device name. Pass nothing
   *                     to let the platform pick a default (or the first device
   *                     containing "Microphone" on Windows).
   */
  constructor(deviceName?: string) {
    this.selectedDevice = deviceName || null
  }

  /**
   * Spawns ffmpeg and resolves once the first audio chunk arrives (or after
   * 1.5 s as a fallback so the UI is never blocked indefinitely if the OS
   * decides to take a while to grant mic access).
   *
   * Rejects with an install-instructions error if ffmpeg can't be located.
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Find ffmpeg executable
        this.ffmpegPath = findFfmpeg()
        if (!this.ffmpegPath) {
          const platform = os.platform()
          let installInstructions = ''
          if (platform === 'win32') {
            installInstructions = 'Install ffmpeg: winget install ffmpeg  OR  download from https://ffmpeg.org/download.html and add to PATH'
          } else if (platform === 'darwin') {
            installInstructions = 'Install ffmpeg: brew install ffmpeg'
          } else {
            installInstructions = 'Install ffmpeg: sudo apt install ffmpeg  OR  sudo dnf install ffmpeg'
          }
          reject(new Error(`ffmpeg not found. ${installInstructions}`))
          return
        }

        console.log('[Audio] Using ffmpeg:', this.ffmpegPath)
        // PassThrough stream is created lazily via enableStreaming()
        // to avoid buffering audio data when nothing is reading from it

        const platform = os.platform()
        let args: string[]

        if (platform === 'win32') {
          // Windows: List devices and use selected or first microphone
          const devices = listWindowsAudioDevices(this.ffmpegPath)
          console.log('[Audio] Available devices:', devices)
          
          let deviceToUse = this.selectedDevice
          if (!deviceToUse || !devices.includes(deviceToUse)) {
            // Prefer devices with "Microphone" in the name
            deviceToUse = devices.find(d => d.toLowerCase().includes('microphone')) || null
            if (!deviceToUse && devices.length > 0) {
              deviceToUse = devices[0]
            }
          }
          
          if (!deviceToUse) {
            reject(new Error('No audio input devices found'))
            return
          }
          
          console.log('[Audio] Using device:', deviceToUse)
          
          // Use audio filter to properly mix stereo to mono (pan filter takes max of both channels)
          // This ensures we capture audio even if it's only on one stereo channel
          args = [
            '-f', 'dshow',
            '-audio_buffer_size', '20',
            '-i', `audio=${deviceToUse}`,
            '-af', 'pan=mono|c0=0.5*c0+0.5*c1',  // Mix both stereo channels to mono
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-f', 's16le',
            'pipe:1'
          ]
        } else if (platform === 'darwin') {
          // macOS: Use AVFoundation
          args = [
            '-f', 'avfoundation',
            '-i', ':default',
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-f', 's16le',
            'pipe:1'
          ]
        } else {
          // Linux: Use ALSA or PulseAudio
          args = [
            '-f', 'pulse',
            '-i', 'default',
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-f', 's16le',
            'pipe:1'
          ]
        }

        this.recordingProcess = spawn(this.ffmpegPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })

        this.recordingProcess.on('error', (err) => {
          console.error('Audio capture error:', err.message)
          this.audioStream?.destroy(err)
          reject(err)
        })

        this.recordingProcess.stderr?.on('data', (data: Buffer) => {
          const msg = data.toString().trim()
          if (msg && !msg.includes('size=')) {
            console.log('ffmpeg:', msg.substring(0, 100))
          }
        })

        // Handle audio data - calculate level and buffer
        // NOTE: Do NOT pipe stdout, it interferes with the data handler
        let chunkCount = 0
        let bufferedChunks = 0
        const SMOOTHING = 0.3 // Lower = smoother, higher = more responsive
        this.recordingProcess.stdout?.on('data', (chunk: Buffer) => {
          chunkCount++
          
          // Calculate RMS (root mean square) for representative level
          let sumSquares = 0
          let maxSample = 0
          const sampleCount = Math.floor(chunk.length / 2)
          for (let i = 0; i < chunk.length - 1; i += 2) {
            const sample = chunk.readInt16LE(i)
            const absSample = Math.abs(sample)
            sumSquares += sample * sample
            if (absSample > maxSample) maxSample = absSample
          }
          const rms = Math.sqrt(sumSquares / sampleCount) / 32768
          
          // Blend RMS with peak for responsive yet stable visualization
          // Use 60% peak + 40% RMS, then apply exponential smoothing
          const rawLevel = Math.min((maxSample / 32768) * 0.6 + rms * 0.4, 1)
          // Boost low-level signals so speech is more visible (power curve)
          const boosted = Math.pow(rawLevel, 0.6)
          // Exponential smoothing: rise fast, fall slower
          const alpha = boosted > this.audioLevel ? SMOOTHING * 1.5 : SMOOTHING * 0.7
          this.audioLevel = this.audioLevel * (1 - alpha) + boosted * alpha
          
          // Log first few chunks and periodically after
          if (chunkCount <= 3 || chunkCount % 100 === 0) {
            console.log(`[Audio] Chunk ${chunkCount}: ${chunk.length} bytes, level: ${this.audioLevel.toFixed(3)}, rms: ${rms.toFixed(3)}, max: ${maxSample}, buffering: ${this.isBuffering}, buffered: ${bufferedChunks}`)
          }
          
          // Buffer the audio chunk if buffering is enabled
          if (this.isBuffering) {
            this.audioBuffer.push(Buffer.from(chunk))
            bufferedChunks++
          }
          
          // Only write to audioStream when streaming mode is active (a consumer is reading).
          // Without this guard, the PassThrough buffers data indefinitely (~32KB/s),
          // causing unbounded memory growth when ffmpeg is pre-warmed but idle.
          if (this.streamingEnabled && this.audioStream && !this.audioStream.destroyed) {
            this.audioStream.write(chunk)
          }
        })

        // Wait for first audio data before resolving (ensures mic is actually capturing)
        let resolved = false
        const startTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            console.log('[Audio] Started (timeout fallback)')
            resolve()
          }
        }, 1500)

        this.recordingProcess.stdout?.once('data', () => {
          if (!resolved) {
            resolved = true
            clearTimeout(startTimeout)
            console.log('[Audio] Started (first audio data received)')
            resolve()
          }
        })

      } catch (err) {
        console.error('Failed to start audio capture:', err)
        reject(err)
      }
    })
  }

  /**
   * Kills the ffmpeg subprocess, destroys the streaming PassThrough, and
   * resets the level meter. Safe to call multiple times.
   */
  stop(): void {
    if (this.levelInterval) {
      clearInterval(this.levelInterval)
      this.levelInterval = null
    }

    if (this.recordingProcess) {
      console.log('Stopping audio capture...')
      this.recordingProcess.kill()
      this.recordingProcess = null
    }

    this.streamingEnabled = false
    if (this.audioStream) {
      this.audioStream.destroy()
      this.audioStream = null
    }

    this.audioLevel = 0
  }

  /** Returns the live PCM stream, or `null` if streaming hasn't been enabled. */
  getStream(): PassThrough | null {
    return this.audioStream
  }

  /**
   * Creates the `PassThrough` consumer (if needed) and starts forwarding PCM
   * chunks to it. The stream is created lazily — without an active consumer
   * we'd buffer ~32 KB/s indefinitely while ffmpeg is pre-warmed but idle.
   */
  enableStreaming(): PassThrough {
    if (!this.audioStream || this.audioStream.destroyed) {
      this.audioStream = new PassThrough()
      this.audioStream.on('error', (err) => {
        console.error('[Audio] Stream error:', err.message)
      })
    }
    this.streamingEnabled = true
    console.log('[Audio] Streaming enabled — audio data will flow to PassThrough')
    return this.audioStream
  }

  /**
   * Stops forwarding PCM to the `PassThrough` and tears it down so memory
   * isn't held while ffmpeg keeps running (pre-warm path).
   */
  disableStreaming(): void {
    this.streamingEnabled = false
    if (this.audioStream && !this.audioStream.destroyed) {
      this.audioStream.destroy()
      this.audioStream = null
    }
    console.log('[Audio] Streaming disabled — PassThrough destroyed to free memory')
  }

  /** Current smoothed level, range 0.0–1.0, suitable for VU rendering. */
  getAudioLevel(): number {
    return this.audioLevel
  }

  /**
   * Begins accumulating raw PCM chunks for the batch-transcribe path
   * (`recording:stop` → Deepgram pre-recorded API). Discards any prior buffer.
   */
  startBuffering(): void {
    this.audioBuffer = []
    this.isBuffering = true
    console.log('[Audio] Buffering started')
  }

  /**
   * Stops buffering and returns the concatenated PCM buffer (or `null` if
   * no data was captured). Empties the internal buffer regardless.
   */
  stopBuffering(): Buffer | null {
    this.isBuffering = false
    if (this.audioBuffer.length === 0) {
      console.log('[Audio] No audio data buffered')
      return null
    }
    const fullBuffer = Buffer.concat(this.audioBuffer)
    console.log(`[Audio] Buffering stopped, total size: ${fullBuffer.length} bytes`)
    this.audioBuffer = []
    return fullBuffer
  }

  /** Snapshot of the buffered audio without stopping the buffer. */
  getBufferedAudio(): Buffer | null {
    if (this.audioBuffer.length === 0) return null
    return Buffer.concat(this.audioBuffer)
  }

  /** True once the ffmpeg subprocess has been spawned and not yet stopped. */
  isRunning(): boolean {
    return this.recordingProcess !== null
  }

  /**
   * Starts the capture session and keeps ffmpeg alive indefinitely (pre-warm).
   *
   * Call once when the dictation window opens; call `stop()` when it closes.
   * Buffering remains opt-in via `startBuffering`/`stopBuffering`. No-op if
   * already running.
   */
  async startPersistent(): Promise<void> {
    if (this.recordingProcess) {
      console.log('[Audio] Already running, skipping startPersistent')
      return
    }
    return this.start()
  }
}
