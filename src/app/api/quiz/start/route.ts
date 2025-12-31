import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type {
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase-admin/firestore";

export const runtime = "nodejs";

function getBearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  const [type, token] = h.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

type QuizDifficulty = "easy" | "medium" | "hard";

type QuizQuestionDoc = {
  text: string;
  choices: string[];
  correctIndex: number;
  difficulty: QuizDifficulty;
  active: boolean;
};

type PickedQuestion = QuizQuestionDoc & { id: string };

function scoreWeight(difficulty: QuizDifficulty): number {
  if (difficulty === "hard") return 200;
  if (difficulty === "medium") return 150;
  return 100;
}

function toQuizQuestionDoc(
  snap: QueryDocumentSnapshot<DocumentData>
): PickedQuestion | null {
  const data = snap.data();

  const text = data.text;
  const choices = data.choices;
  const correctIndex = data.correctIndex;
  const difficulty = data.difficulty;
  const active = data.active;

  const ok =
    typeof text === "string" &&
    Array.isArray(choices) &&
    choices.every((c) => typeof c === "string") &&
    Number.isInteger(correctIndex) &&
    (difficulty === "easy" ||
      difficulty === "medium" ||
      difficulty === "hard") &&
    typeof active === "boolean";

  if (!ok) return null;

  return {
    id: snap.id,
    text,
    choices,
    correctIndex,
    difficulty,
    active,
  };
}

function getErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "server_error";
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body: unknown = await req.json().catch(() => ({}));

    const obj: Record<string, unknown> =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};

    const mode = obj.mode === "classic" ? "classic" : "classic";

    const countInput = obj.count;
    const rawCount =
      typeof countInput === "number"
        ? countInput
        : typeof countInput === "string"
        ? Number(countInput)
        : 10;

    const count = Math.min(
      Math.max(Number.isFinite(rawCount) ? rawCount : 10, 5),
      15
    );

    const snap = await adminDb
      .collection("quiz_questions")
      .where("active", "==", true)
      .limit(50)
      .get();

    const all = snap.docs
      .map(toQuizQuestionDoc)
      .filter((q): q is PickedQuestion => q !== null);

    if (all.length < count) {
      return NextResponse.json(
        { error: "not_enough_questions", available: all.length },
        { status: 400 }
      );
    }

    // Amostragem simples
    const picked: PickedQuestion[] = [];
    const used = new Set<number>();
    while (picked.length < count) {
      const idx = Math.floor(Math.random() * all.length);
      if (used.has(idx)) continue;
      used.add(idx);
      picked.push(all[idx]);
    }

    const questionIds = picked.map((q) => q.id);

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 60 * 1000);

    const sessionRef = await adminDb.collection("quiz_sessions").add({
      uid,
      mode,
      questionIds,
      status: "active",
      startedAt: now,
      expiresAt: expires,
    });

    // Retorna SEM correctIndex
    const questions = picked.map((q) => ({
      id: q.id,
      text: q.text,
      choices: q.choices,
      difficulty: q.difficulty,
      points: scoreWeight(q.difficulty),
    }));

    return NextResponse.json({ sessionId: sessionRef.id, mode, questions });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
