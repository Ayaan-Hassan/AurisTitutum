import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
export const isFirebaseConfigured =
  !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

let app;
let auth;
let db;

// Kept as a resolved promise so AuthContext can still `await authPersistenceReady`
// without any changes — but persistence is now guaranteed at construction time.
export const authPersistenceReady = Promise.resolve();

try {
  if (isFirebaseConfigured) {
    // Initialize the Firebase app (idempotent — safe to call repeatedly in HMR)
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    // Use initializeAuth with persistence baked in at construction.
    // This is the correct approach for guaranteed local persistence across
    // browser restarts, computer reboots, and cold boots — unlike
    // getAuth() + setPersistence() which is async and can lose the race.
    try {
      auth = initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    } catch (_alreadyInitialized) {
      // In Vite HMR / hot-reload, initializeAuth may throw because auth is
      // already initialized on the same app instance. getAuth() returns it.
      auth = getAuth(app);
    }

    db = getFirestore(app);
  } else {
    console.warn("Firebase API Key is missing. Check your .env file.");
    auth = null;
    db = null;
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  auth = null;
  db = null;
}

export { app, auth, db };
