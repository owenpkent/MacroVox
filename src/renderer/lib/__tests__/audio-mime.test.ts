/**
 * Security regression guard for the voice-buffer playback MIME whitelist.
 *
 * The frontend constructs a `data:<mime>;base64,<bytes>` URL from whatever the
 * backend returns. If the whitelist ever drops, a compromised backend (or a
 * crafted manifest) could send `text/html` and the renderer would happily
 * pipe it into `new Audio()`. The element won't render HTML, but the blob is
 * still attacker-controlled bytes the renderer trusts — easy to misuse later.
 * This test pins the allowed list so widening it requires intent.
 */

import { describe, it, expect } from 'vitest'
import { safeAudioMime } from '../audio-mime'

describe('safeAudioMime', () => {
  it.each([
    ['audio/wav'],
    ['audio/ogg'],
  ])('accepts %s', (mime) => {
    expect(safeAudioMime(mime)).toBe(mime)
  })

  it.each([
    ['audio/mpeg'],         // MP3 — could be added intentionally; not today
    ['audio/webm'],         // also a real audio format — not whitelisted
    ['audio/x-wav'],        // case/prefix variant — strict equality only
    ['AUDIO/WAV'],          // case-sensitivity guard
    ['text/html'],          // the actual XSS-adjacent concern
    ['application/javascript'],
    ['image/svg+xml'],      // svg can carry script
    [''],                   // empty string from a misconfigured backend
    ['audio/wav; charset=evil'], // parameter injection attempt
  ])('rejects %s', (mime) => {
    expect(safeAudioMime(mime)).toBeNull()
  })

  it.each([
    [null],
    [undefined],
    [123 as unknown as string],
    [{} as unknown as string],
  ])('rejects non-string input %p', (mime) => {
    expect(safeAudioMime(mime as string | null | undefined)).toBeNull()
  })
})
