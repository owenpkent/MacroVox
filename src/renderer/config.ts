// Centralized API configuration for the MacroVox renderer.
// All network endpoints live here — never hardcode URLs in hooks or components.

// Netlify site URL (update after deploying your Netlify site)
export const SITE_URL = 'https://macrovox.netlify.app'

// Supabase Edge Functions (proxied through Netlify or direct)
export const API = {
  claudeProxy:      `${SITE_URL}/.netlify/functions/claude-proxy`,
  deepgramProxy:    `${SITE_URL}/.netlify/functions/deepgram-proxy`,
} as const

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
export const ANTHROPIC_MODEL   = 'claude-sonnet-4-20250514'
