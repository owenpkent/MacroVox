// Centralized API configuration for the MacroVox renderer.
// All network endpoints live here — never hardcode URLs in hooks or components.

// Netlify site URL — use local dev server when running in Vite dev mode
export const SITE_URL = import.meta.env.DEV
  ? 'http://localhost:8888'
  : 'https://macrovox.netlify.app'

// Supabase Edge Functions (proxied through Netlify or direct)
export const API = {
  claudeProxy:      `${SITE_URL}/.netlify/functions/claude-proxy`,
  deepgramProxy:    `${SITE_URL}/.netlify/functions/deepgram-proxy`,
} as const

// Haiku for fast cleanup tasks; Sonnet for quality writing generation
export const ANTHROPIC_MODEL_CLEANUP  = 'claude-haiku-4-5-20251001'
export const ANTHROPIC_MODEL_WRITING  = 'claude-sonnet-4-20250514'
