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

  // Verify JWT
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

  const { model, max_tokens, system, messages } = body

  if (!messages?.length) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'messages is required' }),
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
    console.error('[claude-proxy] Anthropic error:', err)
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream error' }),
    }
  }
}
