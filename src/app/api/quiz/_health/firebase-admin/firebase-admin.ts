import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const snap = await adminDb().collection("_health").limit(1).get();
    res
      .status(200)
      .json({ ok: true, docs: snap.size, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
