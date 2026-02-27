/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth 2.0 flow.
 * Builds the Google consent-screen URL and redirects the user to it.
 *
 * Query params:
 *   userId    {string} required — Firebase UID or device ID (passed as OAuth `state`)
 *   userEmail {string} optional — pre-fills the Google account picker via login_hint
 *
 * The `state` param carries `userId` through the OAuth round-trip so the
 * callback handler knows which user to associate the tokens with.
 */

import { handleCors } from "../../_lib/cors.js";
import { createOAuthClient, SCOPES } from "../../_lib/oauth.js";

export default function handler(req, res) {
  // ── CORS / preflight ───────────────────────────────────────────────────────
  if (handleCors(req, res)) return;

  // ── Method guard ───────────────────────────────────────────────────────────
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Validate required param ────────────────────────────────────────────────
  const { userId, userEmail } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  // ── Build OAuth URL ────────────────────────────────────────────────────────
  let client;
  try {
    client = createOAuthClient();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const authParams = {
    // offline → Google issues a refresh_token so we can call Sheets
    // without the user being present on every request
    access_type: "offline",
    scope: SCOPES,
    // Carry userId through the round-trip; callback reads it from req.query.state
    state: userId,
  };

  // login_hint pre-selects the correct Google account in the picker,
  // avoiding confusion when the user has multiple Google accounts
  if (userEmail) {
    authParams.login_hint = userEmail;
  }

  const authUrl = client.generateAuthUrl(authParams);

  // ── Redirect to Google ─────────────────────────────────────────────────────
  return res.redirect(authUrl);
}
