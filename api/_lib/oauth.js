/**
 * Google OAuth2 helpers for Vercel serverless functions.
 *
 * Responsibilities:
 *  1. createOAuthClient()       — builds a fresh OAuth2 client from env vars
 *  2. SCOPES                    — the exact Google API scopes we request
 *  3. getAuthenticatedClient()  — resolves stored tokens for a userId,
 *                                  auto-refreshes if expired, returns a ready
 *                                  client + the user's spreadsheetId
 */

import { google } from "googleapis";
import { getUser, setUser } from "./store.js";

// ─── Scopes ──────────────────────────────────────────────────────────────────

/**
 * Minimum scopes required:
 *  - spreadsheets  → read/write the habit-log sheet
 *  - drive.file    → create new spreadsheets on the user's Drive
 *
 * We do NOT request drive (full Drive access) — principle of least privilege.
 */
export const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

// ─── Client factory ──────────────────────────────────────────────────────────

/**
 * Build a new OAuth2 client using environment variables.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID      — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  — from Google Cloud Console
 *   GOOGLE_REDIRECT_URI   — must exactly match an Authorized Redirect URI
 *                           registered in Google Cloud Console, e.g.
 *                           https://your-app.vercel.app/api/auth/google/callback
 *
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env vars. " +
      "Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and " +
      "GOOGLE_REDIRECT_URI are set in your Vercel project settings."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ─── Authenticated client resolver ───────────────────────────────────────────

/**
 * Return a ready-to-use OAuth2 client for `userId`.
 *
 * Flow:
 *  1. Load stored tokens from the KV store.
 *  2. If the access token is expired (or will expire within 60 s),
 *     call refreshAccessToken() and persist the new tokens.
 *  3. Return { client, spreadsheetId } so callers can immediately
 *     instantiate a Sheets client.
 *
 * Throws if:
 *  - The user has never connected Google Sheets (no stored data).
 *  - Token refresh fails (user must re-authorise in Settings).
 *
 * @param {string} userId  Firebase UID or device ID stored on the frontend.
 * @returns {Promise<{ client: import('googleapis').Auth.OAuth2Client, spreadsheetId: string }>}
 */
export async function getAuthenticatedClient(userId, inputTokens, inputSpreadsheetId) {
  if (!inputTokens) {
    throw new Error(
      "Stored token data is corrupted or missing. Please reconnect Google Sheets in Settings."
    );
  }

  // ── 2. Build client and attach passed credentials ─────────────────────────
  const client = createOAuthClient();
  client.setCredentials(inputTokens);

  // Note: We don't need to manually refresh here anymore!
  // Google API SDK automatically refreshes the token in-memory if it's expired
  // provided the refresh_token is present in setCredentials.
  // Because we removed Redis to make the backend 100% stateless, we can't save the refreshed
  // token reliably from here anyway, and we don't need to since refresh_token stays valid.

  return { client, spreadsheetId: inputSpreadsheetId };
}
