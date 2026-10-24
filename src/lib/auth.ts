import type { User } from 'firebase/auth'
import { firebaseEnabled, getFirebaseServices } from './firebase'

export type { User }
export { firebaseEnabled }

let currentUser: User | null = null
let initStarted = false
const listeners = new Set<(user: User | null) => void>()

function ensureInitialized(): void {
  if (initStarted || !firebaseEnabled) return
  initStarted = true
  getFirebaseServices().then(async (services) => {
    if (!services) return
    const { onAuthStateChanged } = await import('firebase/auth')
    onAuthStateChanged(services.auth, (user) => {
      currentUser = user
      listeners.forEach((listener) => listener(user))
    })
  })
}

/** Synchronous read of the current auth state — for non-React code (e.g.
 * library.ts) that needs to know whether to mirror a write to the cloud,
 * without threading a user object through every call site. Returns null
 * both when signed out and before Firebase has finished loading. */
export function getCurrentUser(): User | null {
  return currentUser
}

/** Calls back immediately with the current state, then again on every
 * change. Returns an unsubscribe function. Triggers the (lazy) Firebase
 * SDK load on first call. */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  ensureInitialized()
  listeners.add(callback)
  callback(currentUser)
  return () => {
    listeners.delete(callback)
  }
}

export async function signInWithGoogle(): Promise<void> {
  const services = await getFirebaseServices()
  if (!services) throw new Error('Sign-in isn’t configured for this deployment yet.')
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
  await signInWithPopup(services.auth, new GoogleAuthProvider())
}

export async function signOutUser(): Promise<void> {
  const services = await getFirebaseServices()
  if (!services) return
  const { signOut } = await import('firebase/auth')
  await signOut(services.auth)
}
