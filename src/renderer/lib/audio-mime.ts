/**
 * MIME whitelist for the voice-buffer playback path.
 *
 * Voice buffer audio is base64-encoded by the Rust backend and decoded in the
 * renderer via `new Audio('data:<mime>;base64,...')`. The data URI's MIME is
 * load-bearing: if the backend ever returned `text/html`, the Audio element
 * would refuse to play but other parts of the renderer might still treat the
 * blob as renderable content. The whitelist makes that class of bug impossible
 * regardless of what the backend sends.
 *
 * Returns the original MIME if it's an allowed audio format, or `null` to
 * signal the caller should refuse the blob entirely.
 */
const ALLOWED_AUDIO_MIMES = new Set(['audio/wav', 'audio/ogg'])

export function safeAudioMime(mime: string | null | undefined): string | null {
  if (typeof mime !== 'string') return null
  return ALLOWED_AUDIO_MIMES.has(mime) ? mime : null
}
