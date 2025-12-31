import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type Difficulty = "easy" | "medium" | "hard";

type QuestionPayload = {
  id: string;
  text: string;
  choices: string[];
  difficulty: Difficulty;
  points: number;
};

type SessionCreate = {
  uid: string;
  mode: string;
  questionIds: string[];
  correctIndexes: number[];
  points: number[];
  createdAt: Date;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function asDifficulty(v: unknown): Difficulty {
  return v === "hard" ? "hard" : v === "medium" ? "medium" : "easy";
}

function pointsForDifficulty(d: Difficulty): number {
  if (d === "hard") return 30;
  if (d === "medium") return 20;
  return 10;
}

function toStringArray4(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const arr = v.map((x) => String(x));
  return arr.length === 4 ? arr : null;
}

function toNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
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
    const mode =
      isRecord(body) && typeof body.mode === "string" ? body.mode : "classic";

    const countRaw =
      isRecord(body) && body.count !== undefined
        ? toNumber(body.count, 10)
        : 10;
    const count = Math.max(1, Math.min(50, countRaw));

    // Pega até 500 perguntas ativas e randomiza no servidor
    const snap = await adminDb
      .collection("quiz_questions")
      .where("active", "==", true)
      .limit(500)
      .get();

    const pool: Array<{
      id: string;
      text: string;
      choices: string[];
      correctIndex: number;
      difficulty: Difficulty;
      points: number;
    }> = [];

    for (const d of snap.docs) {
      const raw = d.data() as unknown;
      if (!isRecord(raw)) continue;

      const text = typeof raw.text === "string" ? raw.text.trim() : "";
      const choices = toStringArray4(raw.choices);
      const correctIndex = toNumber(raw.correctIndex, 0);
      const difficulty = asDifficulty(raw.difficulty);
      const points =
        raw.points !== undefined
          ? toNumber(raw.points, pointsForDifficulty(difficulty))
          : pointsForDifficulty(difficulty);

      if (!text) continue;
      if (!choices) continue;
      if (correctIndex < 0 || correctIndex > 3) continue;

      pool.push({
        id: d.id,
        text,
        choices,
        correctIndex,
        difficulty,
        points,
      });
    }

    if (pool.length < count) {
      return NextResponse.json(
        { error: "not_enough_questions", available: pool.length },
        { status: 400 }
      );
    }

    const picked = shuffle(pool).slice(0, count);

    const session: SessionCreate = {
      uid,
      mode,
      questionIds: picked.map((q) => q.id),
      correctIndexes: picked.map((q) => q.correctIndex),
      points: picked.map((q) => q.points),
      createdAt: new Date(),
    };

    const sessionRef = await adminDb.collection("quiz_sessions").add(session);

    const questions: QuestionPayload[] = picked.map((q) => ({
      id: q.id,
      text: q.text,
      choices: q.choices,
      difficulty: q.difficulty,
      points: q.points,
    }));

    return NextResponse.json({
      sessionId: sessionRef.id,
      mode,
      questions,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("QUIZ_START_ERROR", e);
    return NextResponse.json(
      { error: "server_error", detail: msg },
      { status: 500 }
    );
  }
}
