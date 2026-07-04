import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
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

// This promise resolves once browserLocalPersistence has been applied to auth.
// AuthContext awaits this before doing any auth operations, guaranteeing that
// sessions survive page refreshes and browser restarts.
let authPersistenceReady = Promise.resolve();

try {
  if (isFirebaseConfigured) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);

    // Apply local persistence — this is what keeps users logged in across
    // restarts. We capture the promise so callers can await it before any
    // sign-in/sign-out action.
    authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(
      (error) => {
        console.error("Firebase auth persistence error:", error);
      },
    );

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
