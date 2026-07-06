import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
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

// authPersistenceReady is kept as a resolved promise so AuthContext can still
// `await authPersistenceReady` without any changes. Persistence is guaranteed
// at construction time via initializeAuth, so no async race is possible.
const authPersistenceReady = Promise.resolve();

try {
  if (isFirebaseConfigured) {
    console.log("[Firebase Init] Initializing Firebase App with config:", {
      apiKey: firebaseConfig.apiKey ? "PRESENT" : "MISSING",
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId
    });
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log("[Firebase Init] Firebase App initialized:", app.name);

    // initializeAuth is the correct approach for guaranteed persistence.
    // Unlike getAuth() + setPersistence() (which is async and can race with
    // onAuthStateChanged), initializeAuth applies persistence synchronously
    // at construction time — so sessions always survive browser/PC restarts.
    //
    // IMPORTANT: browserPopupRedirectResolver MUST be passed here so that
    // signInWithPopup (Google login) and signInWithRedirect (mobile OAuth)
    // continue to work correctly.
    try {
      console.log("[Firebase Init] Calling initializeAuth with indexedDBLocalPersistence and browserLocalPersistence fallback");
      auth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
      console.log("[Firebase Init] initializeAuth succeeded.");
      console.log("[Firebase Init] Configured persistence:", auth.config ? auth.config.persistence : "unknown");
      console.log("[Firebase Init] Actual runtime persistence manager:", auth.persistenceManager ? auth.persistenceManager.constructor.name : "none");
    } catch (_alreadyInitialized) {
      // Vite HMR re-runs this module on hot-reload, and initializeAuth throws
      // if the auth instance already exists. getAuth() returns the existing one.
      console.log("[Firebase Init] Auth already initialized (HMR), calling getAuth()");
      auth = getAuth(app);
      console.log("[Firebase Init] getAuth returned. Current Auth Persistence:", auth.persistence || "unknown");
      console.log("[Firebase Init] Actual HMR persistence manager:", auth.persistenceManager ? auth.persistenceManager.constructor.name : "none");
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

export { app, auth, db, authPersistenceReady };
