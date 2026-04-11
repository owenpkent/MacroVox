/**
 * Netlify Function — deepgram-proxy
 *
 * Proxies Deepgram transcription requests for authenticated Pro/Team subscribers.
 *
 * NOTE: In the current MacroVox architecture, Deepgram is called directly from
 * the Rust backend using a managed API key retrieved from Supabase. This function
 * exists for future use — e.g. if transcription is moved server-side or for
 * a web-only variant of the app.
 *
 * Request (multipart/form-data or raw audio):
 *   Authorization: Bearer <supabase_jwt>
 *   Body: audio file binary
 *   Query params: ?model=nova-2&punctuate=true&language=en
 *
 * Response: Deepgram transcription JSON
 *
 * Required Netlify environment variables:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 *   DEEPGRAM_MANAGED_KEY      — Deepgram API key for Pro users
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const MAX_AUDIO_SIZE = 25 * 1024 * 1024 // 25 MB
const ALLOWED_AUDIO_TYPES = ['audio/wav', 'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/mp4']
const ALLOWED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh', 'ru', 'hi', 'ar']
const ALLOWED_MODELS = ['nova-2', 'nova-2-general', 'nova', 'enhanced', 'base']
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_CALLS = 300 // per user per hour (higher than claude — audio is lighter)

export const handler: Handler = async (event) => {
  const origin = (event.headers['origin'] ?? '').toLowerCase()
  const allowedOrigins = ['https://macrovox.netlify.app', 'tauri://localhost', 'https://tauri.localhost']
  const corsOrigin = allowedOrigins.includes(origin) ? origin : null

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin || '',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }

  // Reject requests from unknown origins
  if (!corsOrigin) {
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Origin not allowed' }) }
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' }
  }

  // Reject oversized audio payloads
  const bodySize = Buffer.byteLength(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8')
  if (bodySize > MAX_AUDIO_SIZE) {
    return {
      statusCode: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Audio file too large (max 25 MB)' }),
    }
  }

  // Validate Content-Type
  const contentType = (event.headers['content-type'] ?? 'audio/wav').toLowerCase()
  if (!ALLOWED_AUDIO_TYPES.some(t => contentType.startsWith(t))) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid audio format' }),
    }
  }

  // Verify bearer token
  const authHeader = event.headers['authorization'] || event.headers['Authorization']
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid token' }),
    }
  }

  // Check Pro or Team subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (!sub || !['pro', 'team'].includes(sub.status)) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Pro subscription required' }),
    }
  }

  // Rate limiting: count recent calls from this user
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count: recentCalls } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('service', 'deepgram')
    .gte('created_at', windowStart)

  if ((recentCalls ?? 0) >= RATE_LIMIT_MAX_CALLS) {
    return {
      statusCode: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' },
      body: JSON.stringify({ error: 'Rate limit exceeded — try again later' }),
    }
  }

  // Log this call for rate limiting (fire-and-forget)
  supabase.from('api_usage').insert({ user_id: user.id, service: 'deepgram' }).then(() => {})

  const deepgramKey = process.env.DEEPGRAM_MANAGED_KEY
  if (!deepgramKey) {
    return {
      statusCode: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Transcription service not configured' }),
    }
  }

  // Build Deepgram URL — whitelist allowed params
  const params = event.queryStringParameters ?? {}
  const model = ALLOWED_MODELS.includes(params.model ?? '') ? params.model! : 'nova-2'
  const language = ALLOWED_LANGUAGES.includes(params.language ?? '') ? params.language! : 'en'
  const qs = new URLSearchParams({
    model,
    punctuate: params.punctuate === 'false' ? 'false' : 'true',
    language,
    smart_format: params.smart_format === 'false' ? 'false' : 'true',
  }).toString()

  const deepgramUrl = `https://api.deepgram.com/v1/listen?${qs}`

  const body = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8')

  try {
    const resp = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramKey}`,
        'Content-Type': contentType,
      },
      body,
    })

    const data = await resp.text()
    return {
      statusCode: resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: data,
    }
  } catch (err) {
    console.error('[deepgram-proxy] Error:', err instanceof Error ? err.message : 'unknown')
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream error' }),
    }
  }
}
