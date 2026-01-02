import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function readNumber(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

async function requireUser(req: Request): Promise<{ uid: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("UNAUTHENTICATED");
  const token = m[1] ?? "";
  if (!token) throw new Error("UNAUTHENTICATED");

  const decoded = await adminAuth.verifyIdToken(token);
  if (!decoded?.uid) throw new Error("UNAUTHENTICATED");
  return { uid: decoded.uid };
}

const INSTANCES = "tournamentInstances";

export async function GET(req: Request) {
  try {
    const { uid } = await requireUser(req);

    const url = new URL(req.url);
    const instanceId = (url.searchParams.get("instanceId") ?? "").trim();
    if (!instanceId) {
      return NextResponse.json(
        { error: "instanceId obrigatório" },
        { status: 400 }
      );
    }

    const iRef = adminDb.collection(INSTANCES).doc(instanceId);
    const iSnap = await iRef.get();
    if (!iSnap.exists)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // só permite ver se o user está na instância
    const pSnap = await iRef.collection("players").doc(uid).get();
    if (!pSnap.exists)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const iData = iSnap.data();
    const safe = iData && isRecord(iData) ? iData : {};

    const playersSnap = await iRef
      .collection("players")
      .orderBy("joinedAt", "asc")
      .limit(50)
      .get();

    const players = playersSnap.docs.map((d) => {
      const data = d.data();
      const rec = isRecord(data) ? data : {};
      return {
        uid: d.id,
        status: readString(rec, "status") ?? "joined",
      };
    });

    return NextResponse.json({
      ok: true,
      instance: {
        instanceId,
        tournamentId: readString(safe, "tournamentId") ?? "",
        type: readString(safe, "type") ?? "",
        status: readString(safe, "status") ?? "lobby",
        questionCount: readNumber(safe, "questionCount") ?? null,
        capacity: safe["capacity"] ?? null,
        playersCount: readNumber(safe, "playersCount") ?? 0,
        startsAtMs: readNumber(safe, "startsAtMs") ?? null,
        startAtMs: readNumber(safe, "startAtMs") ?? null,
        joinClosesAtMs: readNumber(safe, "joinClosesAtMs") ?? null,
        serverNowMs: Date.now(),
      },
      players,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
