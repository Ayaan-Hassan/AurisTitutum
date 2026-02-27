import { handleCors } from "../_lib/cors.js";
import { getUserState } from "../_lib/store.js";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.query ?? {};
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const state = await getUserState(userId);
    return res.status(200).json({ state: state ?? null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
