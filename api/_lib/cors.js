/**
 * CORS helper for Vercel serverless functions.
 *
 * Since the frontend and API are deployed to the SAME Vercel project,
 * same-origin requests don't need CORS at all in production.
 * However we still set the headers so that:
 *   - Local development (vercel dev / vite dev on a different port) works
 *   - Any future cross-origin consumers work out of the box
 */

const getAllowedOrigin = (req) => {
  // Prefer the explicit env var (set in Vercel dashboard)
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;

  // Fall back to the request's own origin (safe because frontend + api
  // are on the same Vercel deployment — same host)
  const origin = req.headers.origin;
  if (origin) return origin;

  // Final fallback for tooling / health-check requests with no Origin header
  return "*";
};

/**
 * Apply CORS headers to a response.
 * Call this at the TOP of every handler before any other logic.
 *
 * Returns `true` if the request was an OPTIONS preflight and has been
 * fully handled (caller should return immediately).
 * Returns `false` for all other requests (caller should continue).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 * @returns {boolean}
 */
export function handleCors(req, res) {
  const allowedOrigin = getAllowedOrigin(req);

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle OPTIONS preflight — browser sends this before any cross-origin POST
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // signal: request fully handled
  }

  return false; // signal: continue with normal handler logic
}
