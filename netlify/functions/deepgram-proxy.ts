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

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' }
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

  const deepgramKey = process.env.DEEPGRAM_MANAGED_KEY
  if (!deepgramKey) {
    return {
      statusCode: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Transcription service not configured' }),
    }
  }

  // Build Deepgram URL — preserve any query params the caller passed
  const params = event.queryStringParameters ?? {}
  const qs = new URLSearchParams({
    model: params.model ?? 'nova-2',
    punctuate: params.punctuate ?? 'true',
    language: params.language ?? 'en',
    smart_format: params.smart_format ?? 'true',
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
        'Content-Type': event.headers['content-type'] ?? 'audio/wav',
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
    console.error('[deepgram-proxy] Error:', err)
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream error' }),
    }
  }
}
