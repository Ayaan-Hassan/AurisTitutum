/**
 * Firebase Admin SDK singleton for Vercel serverless functions.
 *
 * Required environment variables (set in Vercel dashboard):
 *   FIREBASE_PROJECT_ID         — your Firebase project ID
 *   FIREBASE_CLIENT_EMAIL       — service account email
 *   FIREBASE_PRIVATE_KEY        — service account private key (with \n newlines)
 *
 * How to get these values:
 *   Firebase Console → Project Settings → Service Accounts →
 *   Generate new private key → download JSON → copy the three fields above.
 *
 * In Vercel env vars, paste FIREBASE_PRIVATE_KEY exactly as-is from the JSON
 * (including \\n escape sequences — Vercel will preserve them).
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let _adminApp = null;
let _auth = null;
let _firestore = null;

/**
 * Returns { auth, firestore } — lazily initialised Admin SDK singletons.
 * Safe to call multiple times; only initialises once per cold-start.
 */
export function getAdminApp() {
    if (_adminApp) return { auth: _auth, firestore: _firestore };

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Vercel stores \n as literal \\n in some cases — normalise here
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            "Missing Firebase Admin env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
        );
    }

    // Avoid double-initialisation when the module is hot-reloaded
    _adminApp =
        getApps().length === 0
            ? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
            : getApps()[0];

    _auth = getAuth(_adminApp);
    _firestore = getFirestore(_adminApp);

    return { auth: _auth, firestore: _firestore };
}
