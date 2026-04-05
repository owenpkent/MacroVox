/**
 * Supabase client singleton for the MacroVox renderer.
 *
 * Replaces the Electron main-process client (`src/main/auth/supabase-client.ts`).
 * Session tokens are persisted in `localStorage` by the Supabase JS SDK
 * automatically — no safeStorage needed in a WebView context.
 *
 * Environment variables (set in `.env`, Vite exposes VITE_* to the renderer):
 *   VITE_SUPABASE_URL  — project URL  (e.g. https://xyz.supabase.co)
 *   VITE_SUPABASE_KEY  — publishable / anon key  (safe to ship in client code)
 */

/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // localStorage is the default storage in browser/WebView environments;
    // explicitly set it here to document the intent.
    storage: window.localStorage,
  },
})
