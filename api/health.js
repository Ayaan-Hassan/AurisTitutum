/**
 * GET /api/health
 *
 * Simple liveness probe used by monitoring tools and the deployment
 * checklist to confirm the serverless functions are reachable.
 * No authentication required.
 */

export default function handler(req, res) {
  // Allow any origin — health checks may come from monitoring services
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? "unknown",
  });
}
