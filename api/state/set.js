import { handleCors } from "../_lib/cors.js";
import { setUserState } from "../_lib/store.js";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, state } = req.body ?? {};
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return res.status(400).json({ error: "state object is required" });
  }

  try {
    await setUserState(userId, {
      ...state,
      updatedAt: Date.now(),
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
