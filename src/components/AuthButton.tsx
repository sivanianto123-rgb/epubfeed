import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { signInWithGoogle, signOutUser } from '../lib/auth'
import { firebaseEnabled } from '../lib/firebase'

/** Firebase Auth errors carry a stable `.code` — surfacing it (translated
 * where we can, raw otherwise) beats a generic "try again" that hides
 * exactly what's misconfigured. */
function describeAuthError(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : null
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'This domain isn’t authorized in Firebase yet (Authentication → Settings → Authorized domains).'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup — allow popups for this site and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was closed before finishing.'
    case 'auth/configuration-not-found':
      return 'Google sign-in isn’t enabled in Firebase yet (Authentication → Sign-in method → Google).'
    case 'auth/invalid-api-key':
      return 'The Firebase API key looks wrong — double check VITE_FIREBASE_API_KEY.'
    case 'auth/network-request-failed':
      return 'Network error reaching Firebase — check your connection and try again.'
    default:
      return code ? `Could not sign in (${code}).` : 'Could not sign in — try again.'
  }
}

export function AuthButton() {
  const user = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setError(null)
    if (!firebaseEnabled) {
      setError('Sign-in isn’t set up yet.')
      return
    }
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(describeAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return (
      <button type="button" className="auth-button auth-button--signed-in" onClick={() => signOutUser()} title="Sign out">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="auth-avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="auth-avatar auth-avatar-fallback">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
        )}
        <span className="auth-name">{user.displayName || user.email}</span>
      </button>
    )
  }

  return (
    <span className="auth-widget">
      <button type="button" className="auth-button" onClick={handleSignIn} disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <span className="auth-error">{error}</span>}
    </span>
  )
}
