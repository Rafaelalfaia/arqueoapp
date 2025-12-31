import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type MatchStatus =
  | "lobby"
  | "starting"
  | "in_progress"
  | "finished"
  | "expired";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function asStatus(v: unknown): MatchStatus | null {
  return v === "lobby" ||
    v === "starting" ||
    v === "in_progress" ||
    v === "finished" ||
    v === "expired"
    ? v
    : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body: unknown = await req.json().catch(() => ({}));
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "bad_request", detail: "Body inválido" },
        { status: 400 }
      );
    }

    const matchId = typeof body.matchId === "string" ? body.matchId : "";
    const ready = typeof body.ready === "boolean" ? body.ready : null;

    if (!matchId || ready === null) {
      return NextResponse.json(
        { error: "bad_request", detail: "matchId/ready inválidos" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("quiz_friend_matches").doc(matchId);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists)
        return { ok: false as const, code: "room_not_found" as const };

      const data = snap.data() as unknown;
      if (!isRecord(data))
        return { ok: false as const, code: "room_not_found" as const };

      const status = asStatus(data.status);
      const playerUids = asStringArray(data.playerUids);

      if (!status || status !== "lobby")
        return { ok: false as const, code: "already_started" as const };
      if (!playerUids.includes(uid))
        return { ok: false as const, code: "unauthorized" as const };

      const upd: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      upd[`players.${uid}.ready`] = ready;

      tx.update(ref, upd);
      return { ok: true as const };
    });

    if (!result.ok) {
      const code = result.code;
      const status =
        code === "room_not_found"
          ? 404
          : code === "unauthorized"
          ? 403
          : code === "already_started"
          ? 409
          : 400;
      return NextResponse.json({ error: code }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("FRIEND_READY_ERROR", e);
    return NextResponse.json(
      { error: "server_error", detail: msg },
      { status: 500 }
    );
  }
}
