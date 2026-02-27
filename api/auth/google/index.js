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
  const protocol =
    req.headers["x-forwarded-proto"] ||
    (String(req.headers.host || "").includes("localhost") ? "http" : "https");
  const FRONTEND =
    process.env.FRONTEND_URL || `${protocol}://${req.headers.host}`;

  // ── CORS / preflight ───────────────────────────────────────────────────────
  if (handleCors(req, res)) return;

  // ── Method guard ───────────────────────────────────────────────────────────
  if (req.method !== "GET") {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        "Invalid request method for Google Sheets connect.",
      )}`,
    );
  }

  // ── Validate required param ────────────────────────────────────────────────
  const { userId, userEmail } = req.query;

  if (!userId) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        "Missing user identity for Google Sheets connection.",
      )}`,
    );
  }

  // ── Build OAuth URL ────────────────────────────────────────────────────────
  let client;
  try {
    client = createOAuthClient();
  } catch (err) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        `Google OAuth is not configured: ${err.message}`,
      )}`,
    );
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
