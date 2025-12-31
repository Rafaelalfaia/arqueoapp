import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs"; // garante Node (firebase-admin não roda em Edge)

export async function GET() {
  const snap = await adminDb().collection("_health").limit(1).get();

  return NextResponse.json({
    ok: true,
    docs: snap.size,
    ts: new Date().toISOString(),
  });
}
