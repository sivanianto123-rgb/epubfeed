import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { signInWithGoogle, signOutUser } from '../lib/auth'
import { firebaseEnabled } from '../lib/firebase'

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
    } catch {
      setError('Could not sign in — try again.')
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
