import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function toNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toNumberArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((x) => toNumber(x, NaN));
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body: unknown = await req.json().catch(() => ({}));
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "bad_request", detail: "Body inválido" },
        { status: 400 }
      );
    }

    const sessionId = body.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json(
        { error: "bad_request", detail: "sessionId inválido" },
        { status: 400 }
      );
    }

    const answersArr = toNumberArray(body.answers);
    if (!answersArr || answersArr.length === 0) {
      return NextResponse.json(
        { error: "bad_request", detail: "answers inválidos" },
        { status: 400 }
      );
    }

    const sessionRef = adminDb.collection("quiz_sessions").doc(sessionId);
    const snap = await sessionRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }

    const rawSession = snap.data() as unknown;
    if (!isRecord(rawSession)) {
      return NextResponse.json(
        { error: "server_error", detail: "Sessão corrompida" },
        { status: 500 }
      );
    }

    const ownerUid = typeof rawSession.uid === "string" ? rawSession.uid : null;
    if (!ownerUid || ownerUid !== uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const correct = toNumberArray(rawSession.correctIndexes);
    const points = toNumberArray(rawSession.points);

    if (!correct || correct.length !== answersArr.length) {
      return NextResponse.json(
        { error: "bad_request", detail: "Answers não batem com sessão" },
        { status: 400 }
      );
    }

    if (!points || points.length !== correct.length) {
      return NextResponse.json(
        { error: "server_error", detail: "Sessão sem points" },
        { status: 500 }
      );
    }

    let score = 0;
    let correctCount = 0;

    for (let i = 0; i < correct.length; i++) {
      const a = answersArr[i];
      const c = correct[i];
      if (Number.isFinite(a) && Number.isFinite(c) && a === c) {
        correctCount++;
        const p = points[i];
        score += Number.isFinite(p) ? p : 0;
      }
    }

    const mode =
      typeof rawSession.mode === "string" ? rawSession.mode : "classic";
    const totalQuestions = correct.length;

    await adminDb.collection("quiz_history").add({
      uid,
      mode,
      score,
      correctCount,
      totalQuestions,
      createdAt: new Date(),
      sessionId,
    });

    // Evita reuso
    await sessionRef.delete();

    return NextResponse.json({ score, correctCount, totalQuestions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("QUIZ_SUBMIT_ERROR", e);
    return NextResponse.json(
      { error: "server_error", detail: msg },
      { status: 500 }
    );
  }
}
