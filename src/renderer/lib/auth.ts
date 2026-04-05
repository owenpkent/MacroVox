/**
 * MacroVox auth & subscription — renderer-side Supabase calls.
 *
 * Phase 6 replaces all Rust IPC auth stubs with direct Supabase JS SDK calls.
 * Function signatures intentionally mirror the old `tauri-ipc.ts` auth exports
 * so callers only need to change the import, not the call sites.
 *
 * Session persistence: Supabase JS SDK writes tokens to `localStorage`
 * automatically.  No Rust IPC required.
 *
 * OAuth note: `signInWithOAuth` opens the provider URL in the system browser
 * via `@tauri-apps/plugin-shell`.  Returning the session back to the app
 * requires deep-link support (`macrovox://auth/callback`); that wiring is
 * scheduled for a future phase.  Email auth is fully functional.
 */

import type { User } from '@supabase/supabase-js'
import { open } from '@tauri-apps/plugin-shell'
import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthMethod = 'email' | 'google' | 'facebook'
export type OAuthProvider = 'google' | 'facebook'
export type SubscriptionStatus = 'free' | 'pro' | 'team'

export interface AppUser {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  authMethod: AuthMethod
}

export interface SubscriptionInfo {
  status: SubscriptionStatus
  expiresAt: string | null
  features: { managedApiKeys: boolean; voiceMinutes: number; aiRequests: number }
}

export interface OkResult {
  success: boolean
  error?: string
}

export interface GetUserResult {
  success: boolean
  user?: AppUser
  error?: string
}

export interface GetSubscriptionResult {
  success: boolean
  subscription?: SubscriptionInfo
  error?: string
}

export interface ManagedKeysResult {
  success: boolean
  deepgramKey?: string | null
  anthropicKey?: string | null
  hasManagedKeys?: boolean
  error?: string
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  status: 'free',
  expiresAt: null,
  features: { managedApiKeys: false, voiceMinutes: 15, aiRequests: 0 },
}

function mapUser(user: User): AppUser {
  const meta = user.user_metadata ?? {}
  const provider = user.app_metadata?.provider ?? 'email'
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: meta.full_name || meta.name || user.email || null,
    avatarUrl: meta.avatar_url || meta.picture || null,
    authMethod: provider === 'google' ? 'google' : provider === 'facebook' ? 'facebook' : 'email',
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user from the cached local session.
 * Uses `getSession()` (localStorage read) rather than `getUser()` (network call)
 * since this is polled on a 5-second interval by DictationMode.
 */
export async function getUser(): Promise<GetUserResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false }
  return { success: true, user: mapUser(session.user) }
}

export async function signInEmail(email: string, password: string): Promise<OkResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function signUpEmail(email: string, password: string): Promise<OkResult> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { success: false, error: error.message }
  // No session means email confirmation is required
  if (!data.session) return { success: true, error: 'Check your email to confirm your account.' }
  return { success: true }
}

export async function signOut(): Promise<OkResult> {
  const { error } = await supabase.auth.signOut()
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Opens the OAuth provider in the system browser via `@tauri-apps/plugin-shell`.
 * The session callback (deep-link `macrovox://auth/callback`) is not yet wired;
 * users will need to re-open the app after completing OAuth in the browser.
 */
export async function signInWithOAuth(provider: OAuthProvider): Promise<OkResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { skipBrowserRedirect: true },
  })
  if (error || !data.url) return { success: false, error: error?.message || 'Failed to get OAuth URL' }
  await open(data.url)
  return { success: true }
}

export async function resetPassword(email: string): Promise<OkResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Subscription ──────────────────────────────────────────────────────────────

/**
 * Fetches subscription info from the Supabase `subscriptions` table.
 * Returns free-tier defaults if the user has no subscription row.
 */
export async function getSubscription(): Promise<GetSubscriptionResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false, error: 'Not signed in' }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, expires_at')
    .eq('user_id', session.user.id)
    .single()

  if (error || !data) {
    return { success: true, subscription: DEFAULT_SUBSCRIPTION }
  }

  const status = data.status as SubscriptionStatus
  const features =
    status === 'team' ? { managedApiKeys: true, voiceMinutes: 3000, aiRequests: 2000 }
    : status === 'pro' ? { managedApiKeys: true, voiceMinutes: 600, aiRequests: 500 }
    : DEFAULT_SUBSCRIPTION.features

  return { success: true, subscription: { status, expiresAt: data.expires_at, features } }
}

/**
 * Fetches managed API keys (Deepgram, Anthropic) from the Supabase
 * `managed_api_keys` table.  Only provisioned for Pro/Team subscribers.
 */
export async function getManagedKeys(): Promise<ManagedKeysResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false, hasManagedKeys: false }

  const { data, error } = await supabase
    .from('managed_api_keys')
    .select('deepgram_key, anthropic_key')
    .eq('user_id', session.user.id)
    .single()

  if (error || !data) {
    return { success: true, hasManagedKeys: false, deepgramKey: null, anthropicKey: null }
  }

  return {
    success: true,
    deepgramKey: data.deepgram_key || null,
    anthropicKey: data.anthropic_key || null,
    hasManagedKeys: !!(data.deepgram_key || data.anthropic_key),
  }
}

// ── Billing ───────────────────────────────────────────────────────────────────

/**
 * Creates a Stripe checkout session via a Supabase Edge Function and opens the
 * payment URL in the system browser.
 */
export async function checkout(plan: 'pro' | 'team'): Promise<OkResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false, error: 'Not signed in' }

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { userId: session.user.id, plan },
  })
  if (error || !data?.url) return { success: false, error: error?.message || 'Checkout unavailable' }

  await open(data.url)
  return { success: true }
}

/**
 * Opens the Stripe billing portal via a Supabase Edge Function.
 */
export async function billingPortal(): Promise<OkResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false, error: 'Not signed in' }

  const { data, error } = await supabase.functions.invoke('billing-portal', {
    body: { userId: session.user.id },
  })
  if (error || !data?.url) return { success: false, error: error?.message || 'Billing portal unavailable' }

  await open(data.url)
  return { success: true }
}
