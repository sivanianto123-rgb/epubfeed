import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** False until the Firebase env vars are configured on this deployment —
 * sign-in and cloud sync degrade to harmless no-ops rather than crash the
 * app when they aren't set. These values aren't secrets (Firebase's web
 * config is meant to ship in the client bundle; access is controlled by
 * Firestore security rules, not by hiding this object), so it's fine for
 * them to be public VITE_ env vars. */
export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let servicesPromise: Promise<FirebaseServices | null> | null = null

/** Lazily loads the Firebase SDK (a sizeable dependency) only once
 * something actually needs it, via dynamic import, so it lands in its own
 * chunk instead of bloating the app's main bundle for readers who never
 * touch sign-in. Cached after the first call. */
export function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!firebaseEnabled) return Promise.resolve(null)
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const [{ initializeApp, getApps }, { getAuth }, { initializeFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ])
      const app = getApps()[0] || initializeApp(firebaseConfig)
      const auth = getAuth(app)
      // ignoreUndefinedProperties: our StoredBook's optional fields
      // (highlights, bookmarks, etc.) are sometimes simply absent rather
      // than explicitly null, which Firestore otherwise rejects outright.
      const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
      return { app, auth, db }
    })()
  }
  return servicesPromise
}
