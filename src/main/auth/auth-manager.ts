/**
 * AuthManager — Supabase-powered authentication
 *
 * Handles email/password, Google OAuth, and Facebook OAuth via Supabase.
 * OAuth flows open a BrowserWindow, catch the redirect, and extract tokens.
 * Sessions are persisted with Electron safeStorage encryption.
 */

import { app, safeStorage, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { Session } from '@supabase/supabase-js'
import { getSupabaseClient, getSupabaseUrl } from './supabase-client'
import type { AppUser, AuthMethod, AuthResult, OAuthProvider } from './types'

const SESSION_FILE = path.join(app.getPath('userData'), 'supabase-session.enc')
const SESSION_BACKUP = path.join(app.getPath('userData'), 'supabase-session.backup.json')

/** Custom protocol used to catch OAuth redirects in Electron */
const REDIRECT_URL = 'macrovox://auth/callback'

export class AuthManager {
  private currentUser: AppUser | null = null
  private oauthWindow: BrowserWindow | null = null

  // ── Getters ──

  getUser(): AppUser | null {
    return this.currentUser
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null
  }

  // ── Email / Password ──

  async signUpWithEmail(email: string, password: string): Promise<AuthResult> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      console.error('[Auth] Sign-up error:', error.message)
      return { success: false, error: error.message }
    }

    if (data.session) {
      await this.handleSession(data.session, 'email')
      return { success: true, user: this.currentUser! }
    }

    // Email confirmation required
    return { success: true, error: 'Check your email to confirm your account.' }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('[Auth] Sign-in error:', error.message)
      return { success: false, error: error.message }
    }

    if (data.session) {
      await this.handleSession(data.session, 'email')
      return { success: true, user: this.currentUser! }
    }

    return { success: false, error: 'No session returned' }
  }

  // ── OAuth (Google / Facebook) ──

  async signInWithOAuth(provider: OAuthProvider): Promise<AuthResult> {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
    })

    if (error || !data.url) {
      return { success: false, error: error?.message || 'Failed to get OAuth URL' }
    }

    // Open a BrowserWindow for the OAuth flow
    return this.openOAuthWindow(data.url, provider)
  }

  private openOAuthWindow(url: string, provider: OAuthProvider): Promise<AuthResult> {
    return new Promise((resolve) => {
      this.oauthWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: `Sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })

      this.oauthWindow.webContents.on('will-redirect', async (_event, redirectUrl) => {
        if (redirectUrl.startsWith('macrovox://')) {
          await this.handleOAuthRedirect(redirectUrl, provider, resolve)
        }
      })

      this.oauthWindow.webContents.on('will-navigate', async (_event, navUrl) => {
        if (navUrl.startsWith('macrovox://')) {
          await this.handleOAuthRedirect(navUrl, provider, resolve)
        }
      })

      this.oauthWindow.on('closed', () => {
        this.oauthWindow = null
        // If we haven't resolved yet, user closed the window
        resolve({ success: false, error: 'Login cancelled' })
      })

      this.oauthWindow.loadURL(url)
    })
  }

  private async handleOAuthRedirect(
    redirectUrl: string,
    provider: OAuthProvider,
    resolve: (result: AuthResult) => void
  ): Promise<void> {
    try {
      // Extract tokens from the URL fragment: #access_token=...&refresh_token=...
      const hashPart = redirectUrl.includes('#') ? redirectUrl.split('#')[1] : ''
      const params = new URLSearchParams(hashPart)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (data.session) {
          await this.handleSession(data.session, provider)
          this.oauthWindow?.close()
          resolve({ success: true, user: this.currentUser! })
          return
        }

        this.oauthWindow?.close()
        resolve({ success: false, error: error?.message || 'Failed to set session' })
      } else {
        this.oauthWindow?.close()
        resolve({ success: false, error: 'No tokens in redirect URL' })
      }
    } catch (err: unknown) {
      this.oauthWindow?.close()
      const msg = err instanceof Error ? err.message : String(err)
      resolve({ success: false, error: msg })
    }
  }

  // ── Session management ──

  private async handleSession(session: Session, method: AuthMethod): Promise<void> {
    const user = session.user
    const meta = user.user_metadata || {}

    this.currentUser = {
      id: user.id,
      email: user.email ?? null,
      displayName: meta.full_name || meta.name || user.email || null,
      avatarUrl: meta.avatar_url || meta.picture || null,
      authMethod: method,
    }

    await this.saveSession(session)
    console.log(`[Auth] Signed in as ${this.currentUser.email} via ${method}`)
  }

  /** Restore session from encrypted storage on app startup */
  async restoreSession(): Promise<AppUser | null> {
    const session = await this.loadSession()
    if (!session) return null

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    if (error || !data.session) {
      console.log('[Auth] Stored session expired, clearing...')
      await this.clearStoredSession()
      return null
    }

    // Session was refreshed — save the new tokens
    await this.handleSession(data.session, this.guessMethod(data.session))
    return this.currentUser
  }

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    this.currentUser = null
    await this.clearStoredSession()
    console.log('[Auth] Signed out')
  }

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSupabaseUrl()}/auth/v1/callback`,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // ── Persistence with safeStorage ──

  private async saveSession(session: Session): Promise<void> {
    const json = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(json)
        await fs.promises.writeFile(SESSION_FILE, encrypted)
      }
    } catch (err) {
      console.error('[Auth] Failed to save encrypted session:', err)
    }

    try {
      const backup = { s: Buffer.from(json).toString('base64'), ts: new Date().toISOString() }
      await fs.promises.writeFile(SESSION_BACKUP, JSON.stringify(backup))
    } catch (err) {
      console.error('[Auth] Failed to save session backup:', err)
    }
  }

  private async loadSession(): Promise<{ access_token: string; refresh_token: string } | null> {
    // Try encrypted first
    try {
      if (fs.existsSync(SESSION_FILE) && safeStorage.isEncryptionAvailable()) {
        const encrypted = await fs.promises.readFile(SESSION_FILE)
        const json = safeStorage.decryptString(encrypted)
        return JSON.parse(json)
      }
    } catch (err) {
      console.error('[Auth] Failed to load encrypted session:', err)
    }

    // Fallback to backup
    try {
      if (fs.existsSync(SESSION_BACKUP)) {
        const raw = await fs.promises.readFile(SESSION_BACKUP, 'utf-8')
        const backup = JSON.parse(raw)
        if (backup.s) {
          const json = Buffer.from(backup.s, 'base64').toString('utf-8')
          return JSON.parse(json)
        }
      }
    } catch (err) {
      console.error('[Auth] Failed to load session backup:', err)
    }

    return null
  }

  private async clearStoredSession(): Promise<void> {
    try { if (fs.existsSync(SESSION_FILE)) await fs.promises.unlink(SESSION_FILE) } catch {}
    try { if (fs.existsSync(SESSION_BACKUP)) await fs.promises.unlink(SESSION_BACKUP) } catch {}
  }

  private guessMethod(session: Session): AuthMethod {
    const provider = session.user?.app_metadata?.provider
    if (provider === 'google') return 'google'
    if (provider === 'facebook') return 'facebook'
    return 'email'
  }
}
