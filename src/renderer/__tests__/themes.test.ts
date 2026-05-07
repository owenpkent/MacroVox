// @vitest-environment jsdom
/**
 * Tests for the theme registry and its localStorage persistence layer.
 *
 * Why these matter: every Tailwind `style={{ color: 'var(--text-secondary)' }}`
 * call site reads from CSS variables that ThemeContext writes from these
 * palettes. A typo in a palette key, a missing variable, or a regression in
 * the invalid-id fallback produces silent visual breakage that's easy to ship.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { THEMES, getTheme, getStoredTheme, setStoredTheme, type Theme } from '../themes'

const REQUIRED_COLOR_KEYS: Array<keyof Theme['colors']> = [
  'bgPrimary', 'bgSecondary', 'bgTertiary',
  'accentPrimary', 'accentSecondary', 'accentHover',
  'textPrimary', 'textSecondary', 'textMuted',
  'borderPrimary', 'borderAccent',
  'danger', 'dangerBg', 'success',
]

describe('THEMES catalog', () => {
  it('contains the default mcrn theme as the first entry', () => {
    expect(THEMES[0].id).toBe('mcrn')
  })

  it('has unique theme ids', () => {
    const ids = THEMES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(REQUIRED_COLOR_KEYS)('every theme defines colors.%s', (key) => {
    for (const theme of THEMES) {
      expect(theme.colors[key], `theme "${theme.id}" missing colors.${key}`).toBeTruthy()
    }
  })

  it('every theme has a non-empty name and description', () => {
    for (const theme of THEMES) {
      expect(theme.name.length).toBeGreaterThan(0)
      expect(theme.description.length).toBeGreaterThan(0)
    }
  })
})

describe('getTheme', () => {
  it('returns the matching theme by id', () => {
    expect(getTheme('mcrn').id).toBe('mcrn')
  })

  it('falls back to the default theme on unknown id', () => {
    // This fallback is the load-bearing safety net for corrupted localStorage —
    // a stale/typo'd theme id from an old version must not blank the UI.
    expect(getTheme('does-not-exist').id).toBe('mcrn')
  })

  it('falls back to the default theme on empty string', () => {
    expect(getTheme('').id).toBe('mcrn')
  })
})

describe('getStoredTheme / setStoredTheme', () => {
  beforeEach(() => { localStorage.clear() })

  it('returns the default theme id when nothing is stored', () => {
    expect(getStoredTheme()).toBe('mcrn')
  })

  it('round-trips a theme id through localStorage', () => {
    setStoredTheme('laconia')
    expect(getStoredTheme()).toBe('laconia')
    expect(localStorage.getItem('app_theme')).toBe('laconia')
  })

  it('returns whatever was stored — even an unknown id', () => {
    // getStoredTheme is a raw read; the validation/fallback happens in getTheme.
    // This split keeps persistence layer pure and testable.
    localStorage.setItem('app_theme', 'definitely-not-real')
    expect(getStoredTheme()).toBe('definitely-not-real')
    expect(getTheme(getStoredTheme()).id).toBe('mcrn')
  })
})
