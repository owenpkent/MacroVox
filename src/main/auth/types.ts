/**
 * Authentication types for Supabase Auth
 *
 * Supabase handles email/password, Google, and Facebook login.
 * These types normalize the Supabase user/session into app-level types.
 */

/** Supported OAuth providers (Supabase built-in) */
export type OAuthProvider = 'google' | 'facebook'

/** How the user signed in */
export type AuthMethod = 'email' | 'google' | 'facebook'

/** Normalized user profile */
export interface AppUser {
  /** Supabase user UUID */
  id: string
  /** Email address */
  email: string | null
  /** Display name (from profile or OAuth metadata) */
  displayName: string | null
  /** Avatar URL (from OAuth metadata) */
  avatarUrl: string | null
  /** How the user logged in */
  authMethod: AuthMethod
}

/** Subscription tier */
export type SubscriptionStatus = 'free' | 'pro' | 'team'

/** Subscription details stored in Supabase `subscriptions` table */
export interface SubscriptionInfo {
  status: SubscriptionStatus
  expiresAt: string | null
  features: {
    managedApiKeys: boolean
    voiceMinutes: number
    aiRequests: number
  }
}

/** Result of any auth operation */
export interface AuthResult {
  success: boolean
  user?: AppUser
  error?: string
}
