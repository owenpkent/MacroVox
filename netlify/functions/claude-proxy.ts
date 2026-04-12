/**
 * Netlify Function — claude-proxy
 *
 * Proxies Claude (Anthropic) API requests for authenticated Pro/Team subscribers.
 * Used by:
 *   - usePostProcessing  — transcript cleanup after dictation
 *   - useAgentiveWriting — agentic writing from spoken command
 *
 * Security model:
 *   1. Caller sends `Authorization: Bearer <supabase_jwt>` in the request header.
 *   2. This function verifies the JWT with Supabase.
 *   3. Checks that the user has a Pro or Team subscription.
 *   4. Forwards the message payload to the Anthropic API using the managed key.
 *
 * Request body (JSON):
 *   { user_id: string, model: string, max_tokens: number, system: string,
 *     messages: Array<{ role: "user" | "assistant", content: string }> }
 *
 * Response: Anthropic Messages API response (JSON)
 *
 * Required Netlify environment variables:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (for admin auth verify)
 *   ANTHROPIC_MANAGED_KEY     — Anthropic API key for Pro users
 */

import type { Handler } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-6',
]

const MAX_TOKENS_LIMIT = 4096
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_CALLS = 200 // per user per hour

const MAX_BODY_SIZE = 512 * 1024 // 512 KB
const MAX_SYSTEM_PROMPT_LENGTH = 10_000
const MAX_MESSAGE_LENGTH = 100_000

// Local dev: skip auth when running under `netlify dev` with DEV_BYPASS_AUTH=true
const isDevBypass = process.env.DEV_BYPASS_AUTH === 'true'

export const handler: Handler = async (event) => {
  const origin = (event.headers['origin'] ?? '').toLowerCase()
  const allowedOrigins = ['https://macrovox.netlify.app', 'tauri://localhost', 'https://tauri.localhost']
  if (isDevBypass) allowedOrigins.push('http://localhost:8888', 'http://localhost:5173')
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

  // Reject oversized payloads before parsing
  const bodySize = Buffer.byteLength(event.body || '', 'utf8')
  if (bodySize > MAX_BODY_SIZE) {
    return {
      statusCode: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Payload too large' }),
    }
  }

  // ── Auth, subscription & rate-limit checks (skipped in local dev) ───────
  let authedUserId: string | null = null

  if (!isDevBypass) {
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

    authedUserId = user.id

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

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
    const { count: recentCalls } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('service', 'claude')
      .gte('created_at', windowStart)

    if ((recentCalls ?? 0) >= RATE_LIMIT_MAX_CALLS) {
      return {
        statusCode: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' },
        body: JSON.stringify({ error: 'Rate limit exceeded — try again later' }),
      }
    }

    supabase.from('api_usage').insert({ user_id: user.id, service: 'claude' }).then(() => {})
  }

  // Parse request body
  let body: {
    user_id?: string
    model?: string
    max_tokens?: number
    system?: string
    messages?: Anthropic.MessageParam[]
  }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    }
  }

  const { user_id: bodyUserId, model, max_tokens, system, messages } = body

  // Reject if body user_id doesn't match the authenticated JWT user
  if (authedUserId && bodyUserId && bodyUserId !== authedUserId) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'user_id mismatch' }),
    }
  }

  if (!Array.isArray(messages) || !messages.length) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'messages is required' }),
    }
  }

  // Validate message structure and size
  const validRoles = ['user', 'assistant']
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object' || !validRoles.includes(msg.role) || typeof msg.content !== 'string') {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid message format' }),
      }
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Message too long' }),
      }
    }
  }

  // Validate system prompt length
  if (system && typeof system === 'string' && system.length > MAX_SYSTEM_PROMPT_LENGTH) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'System prompt too long' }),
    }
  }

  const safeModel = ALLOWED_MODELS.includes(model ?? '') ? model! : 'claude-sonnet-4-20250514'
  const safeMaxTokens = Math.min(Math.max(max_tokens ?? 2048, 1), MAX_TOKENS_LIMIT)

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_MANAGED_KEY! })
    const response = await anthropic.messages.create({
      model: safeModel,
      max_tokens: safeMaxTokens,
      ...(system ? { system } : {}),
      messages,
    })

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    }
  } catch (err) {
    console.error('[claude-proxy] Anthropic error:', err instanceof Error ? err.message : 'unknown')
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream error' }),
    }
  }
}
