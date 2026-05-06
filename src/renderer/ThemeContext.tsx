/**
 * MacroVox theme context.
 *
 * The provider:
 *   1. Reads the persisted theme id from `localStorage` on mount and applies
 *      it to the document's CSS custom properties.
 *   2. Subscribes to backend `theme-changed` events so a theme picked in the
 *      settings window propagates to the dictation window in real time.
 *   3. Exposes `setTheme(id, broadcast?)` to children. When `broadcast` is
 *      true (default) the change is forwarded to the backend so the other
 *      window updates too; the settings panel uses `false` for the local
 *      `theme-change` DOM event to avoid double-broadcasts.
 *
 * `useTheme()` throws outside a provider so a missing provider fails loudly
 * during development instead of silently rendering the wrong theme.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Theme, THEMES, getStoredTheme, setStoredTheme } from './themes'
import * as ipc from './lib/tauri-ipc'

interface ThemeContextType {
  /** Resolved theme object (colors + metadata). */
  theme: Theme
  /** Theme id (`'mcrn'`, `'mars'`, etc.) — useful for radio-button comparisons. */
  themeId: string
  /** Switch theme. Persists to localStorage and broadcasts to other windows. */
  setTheme: (themeId: string) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState(() => getStoredTheme())
  const [theme, setThemeState] = useState(() => THEMES.find(t => t.id === themeId) || THEMES[0])

  const setTheme = (newThemeId: string, broadcast = true) => {
    const newTheme = THEMES.find(t => t.id === newThemeId) || THEMES[0]
    setThemeId(newThemeId)
    setThemeState(newTheme)
    setStoredTheme(newThemeId)
    applyThemeToDocument(newTheme)
    if (broadcast) ipc.broadcastThemeChange(newThemeId)
  }

  // Apply theme on mount
  useEffect(() => {
    const storedThemeId = getStoredTheme()
    const storedTheme = THEMES.find(t => t.id === storedThemeId) || THEMES[0]
    applyThemeToDocument(storedTheme)
    setThemeId(storedThemeId)
    setThemeState(storedTheme)
  }, [])

  // Listen for theme changes from backend (other windows)
  useEffect(() => {
    const cleanup = ipc.onThemeChange((newThemeId: string) => {
      const newTheme = THEMES.find(t => t.id === newThemeId) || THEMES[0]
      setThemeId(newThemeId)
      setThemeState(newTheme)
      setStoredTheme(newThemeId)
      applyThemeToDocument(newTheme)
    })
    return cleanup
  }, [])

  // Listen for theme changes from settings panel (same window, custom DOM event)
  useEffect(() => {
    const handleThemeChange = (e: CustomEvent) => setTheme(e.detail, true)
    window.addEventListener('theme-change', handleThemeChange as EventListener)
    return () => window.removeEventListener('theme-change', handleThemeChange as EventListener)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Returns the active theme and a setter. Throws if used outside a
 * `<ThemeProvider>` so a missing provider fails fast in dev.
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

/**
 * Writes the theme's color palette to CSS custom properties on
 * `document.documentElement`. All Tailwind-driven `style={{ color: 'var(...)' }}`
 * call sites read from these variables.
 */
function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement
  const { colors } = theme
  root.style.setProperty('--bg-primary', colors.bgPrimary)
  root.style.setProperty('--bg-secondary', colors.bgSecondary)
  root.style.setProperty('--bg-tertiary', colors.bgTertiary)
  root.style.setProperty('--accent-primary', colors.accentPrimary)
  root.style.setProperty('--accent-secondary', colors.accentSecondary)
  root.style.setProperty('--accent-hover', colors.accentHover)
  root.style.setProperty('--text-primary', colors.textPrimary)
  root.style.setProperty('--text-secondary', colors.textSecondary)
  root.style.setProperty('--text-muted', colors.textMuted)
  root.style.setProperty('--border-primary', colors.borderPrimary)
  root.style.setProperty('--border-accent', colors.borderAccent)
  root.style.setProperty('--danger', colors.danger)
  root.style.setProperty('--danger-bg', colors.dangerBg)
  root.style.setProperty('--success', colors.success)
}
