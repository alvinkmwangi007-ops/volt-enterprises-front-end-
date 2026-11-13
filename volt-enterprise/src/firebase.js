import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDky6aGCwkjkQmd2xXuexStAqi1oilMSHY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'volt-motors-98ea6.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'volt-motors-98ea6',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'volt-motors-98ea6.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '57319870570',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:57319870570:web:c3c7e79ecbf27124837a13',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-NDJHJ01LT3',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// Analytics is optional and loaded lazily so it never blocks sign-in.
import('firebase/analytics')
  .then(({ getAnalytics, isSupported }) => isSupported().then((ok) => ok && getAnalytics(app)))
  .catch(() => {})

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/email-already-in-use': 'An account already uses that email address.',
  'auth/weak-password': 'Choose a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/unauthorized-domain': 'This website address is not authorised for Google sign-in. Add it under Firebase Console > Authentication > Settings > Authorized domains.',
  'auth/operation-not-allowed': 'Google sign-in is not enabled. Enable it under Firebase Console > Authentication > Sign-in method.',
  'auth/invalid-api-key': 'Firebase API key is invalid. Check the VITE_FIREBASE_* settings.',
  'auth/internal-error': 'Firebase reported an internal error. Check the browser console for details.',
}

function friendlyError(error) {
  console.error('Firebase auth error:', error?.code, error?.message)
  const message = ERROR_MESSAGES[error?.code] || 'Sign-in failed. Please try again.'
  return new Error(message, { cause: error })
}

export async function firebaseSignIn(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    return await credential.user.getIdToken()
  } catch (error) {
    throw friendlyError(error)
  }
}

export async function firebaseSignUp(email, password) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    return await credential.user.getIdToken()
  } catch (error) {
    throw friendlyError(error)
  }
}

export async function firebaseGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    const credential = await signInWithPopup(auth, provider)
    return {
      idToken: await credential.user.getIdToken(),
      email: credential.user.email || '',
      name: credential.user.displayName || '',
    }
  } catch (error) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      throw new Error('Google sign-in was cancelled.', { cause: error })
    }
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('Your browser blocked the Google sign-in popup. Allow popups and try again.', { cause: error })
    }
    throw friendlyError(error)
  }
}

export function firebaseSignOut() {
  return signOut(auth).catch(() => {})
}
