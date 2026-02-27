/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth 2.0 flow.
 *
 * Query params:
 *   userId    {string} required - Firebase UID (passed as OAuth state)
 *   userEmail {string} optional - used as login_hint
 */

import { handleCors } from "../../_lib/cors.js";
import { createOAuthClient, SCOPES } from "../../_lib/oauth.js";

export default function handler(req, res) {
  const protocol =
    req.headers["x-forwarded-proto"] ||
    (String(req.headers.host || "").includes("localhost") ? "http" : "https");
  const FRONTEND =
    process.env.FRONTEND_URL || `${protocol}://${req.headers.host}`;

  // CORS / preflight
  if (handleCors(req, res)) return;

  // Method guard
  if (req.method !== "GET") {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        "Invalid request method for Google Sheets connect.",
      )}`,
    );
  }

  const { userId, userEmail } = req.query;

  if (!userId) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        "Missing user identity for Google Sheets connection.",
      )}`,
    );
  }

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
    access_type: "offline",
    scope: SCOPES,
    state: userId,
  };

  if (userEmail) {
    authParams.login_hint = userEmail;
  }

  const authUrl = client.generateAuthUrl(authParams);
  return res.redirect(authUrl);
}
