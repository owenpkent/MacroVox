// @vitest-environment jsdom
/**
 * Tests for the cross-webview event helpers added to tauri-ipc.
 *
 * The `voice-buffer-updated` event is the integration glue that makes the
 * settings panel refresh when the dictation HUD saves a recording. The bug
 * we hit during development was using `window.dispatchEvent` (single-window
 * only) instead of Tauri's `emit` (broadcasts to all webviews). These tests
 * pin the wiring to Tauri's cross-window event API so a regression to DOM
 * events would be caught immediately.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockEmit, mockListen } = vi.hoisted(() => ({
  mockEmit: vi.fn(() => Promise.resolve()),
  mockListen: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: mockEmit,
  listen: mockListen,
}))

import { emitVoiceBufferUpdated, onVoiceBufferUpdated } from '../tauri-ipc'

describe('emitVoiceBufferUpdated', () => {
  beforeEach(() => { mockEmit.mockClear() })

  it('broadcasts the voice-buffer-updated event via Tauri (not the DOM)', async () => {
    await emitVoiceBufferUpdated()
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledWith('voice-buffer-updated')
  })

  it('does not dispatch a DOM event — that would not cross webview boundaries', async () => {
    const domSpy = vi.fn()
    window.addEventListener('voice-buffer-updated', domSpy)
    await emitVoiceBufferUpdated()
    expect(domSpy).not.toHaveBeenCalled()
    window.removeEventListener('voice-buffer-updated', domSpy)
  })
})

describe('onVoiceBufferUpdated', () => {
  let unlistenSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockListen.mockClear()
    unlistenSpy = vi.fn()
    mockListen.mockResolvedValue(unlistenSpy)
  })

  it('subscribes to voice-buffer-updated on the Tauri event bus', () => {
    const cb = vi.fn()
    onVoiceBufferUpdated(cb)
    expect(mockListen).toHaveBeenCalledWith('voice-buffer-updated', expect.any(Function))
  })

  it('invokes the user callback when an event arrives', async () => {
    const cb = vi.fn()
    onVoiceBufferUpdated(cb)

    // Pull the listener that was registered with Tauri and simulate an event.
    const [, registeredHandler] = mockListen.mock.calls[0]
    await Promise.resolve() // let listen() promise resolve
    registeredHandler({ event: 'voice-buffer-updated', payload: undefined })

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('returns a synchronous cleanup that unsubscribes once listen() resolves', async () => {
    const cb = vi.fn()
    const cleanup = onVoiceBufferUpdated(cb)
    expect(typeof cleanup).toBe('function')

    // Wait for the internal listen() promise to resolve so unlisten is in hand.
    await new Promise((r) => setTimeout(r, 0))

    cleanup()
    expect(unlistenSpy).toHaveBeenCalledTimes(1)
  })

  it('handles cleanup-before-listen-resolves without leaking the subscription', async () => {
    // React StrictMode mounts components twice in dev — the cleanup of the
    // first mount can fire before listen() has resolved. The wrapper must
    // tear down the subscription as soon as it's available.
    let resolveListen: (v: () => void) => void = () => {}
    mockListen.mockReturnValueOnce(new Promise<() => void>((r) => { resolveListen = r }))

    const cleanup = onVoiceBufferUpdated(vi.fn())
    cleanup() // fires before listen() resolves

    resolveListen(unlistenSpy as unknown as () => void)
    await new Promise((r) => setTimeout(r, 0))

    expect(unlistenSpy).toHaveBeenCalledTimes(1)
  })
})

afterEach(() => { vi.clearAllMocks() })
