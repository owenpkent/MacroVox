/**
 * Supabase client singleton for the main process.
 *
 * Uses SUPABASE_URL and SUPABASE_ANON_KEY from environment variables.
 * These are PUBLIC keys — safe to ship in the client binary.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,   // we handle persistence ourselves via safeStorage
        detectSessionInUrl: false,
      },
    })
    console.log('[Supabase] Client initialized:', SUPABASE_URL)
  }
  return _client
}

export function getSupabaseUrl(): string {
  return SUPABASE_URL
}
