import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Difficulty = "easy" | "medium" | "hard";
type MatchStatus =
  | "lobby"
  | "starting"
  | "in_progress"
  | "finished"
  | "expired";

type Picked = {
  id: string;
  text: string;
  choices: string[];
  correctIndex: number;
  difficulty: Difficulty;
  points: number;
};

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

function asDifficulty(v: unknown): Difficulty {
  return v === "hard" ? "hard" : v === "medium" ? "medium" : "easy";
}

function toNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStringArray4(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const arr = v.map((x) => String(x));
  return arr.length === 4 ? arr : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

function pointsForDifficulty(d: Difficulty): number {
  if (d === "hard") return 30;
  if (d === "medium") return 20;
  return 10;
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

function allReady(players: unknown, uids: string[]): boolean {
  if (!isRecord(players)) return false;
  for (const uid of uids) {
    const p = players[uid];
    if (!isRecord(p)) return false;
    if (p.ready !== true) return false;
  }
  return true;
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body: unknown = await req.json().catch(() => ({}));
    const matchId =
      isRecord(body) && typeof body.matchId === "string" ? body.matchId : "";

    if (!matchId) {
      return NextResponse.json(
        { error: "bad_request", detail: "matchId inválido" },
        { status: 400 }
      );
    }

    const matchRef = adminDb.collection("quiz_friend_matches").doc(matchId);

    // 1) trava o start (status: lobby -> starting) via transaction
    const lock = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists)
        return { ok: false as const, code: "room_not_found" as const };

      const data = snap.data() as unknown;
      if (!isRecord(data))
        return { ok: false as const, code: "room_not_found" as const };

      const status = asStatus(data.status);
      const hostUid = typeof data.hostUid === "string" ? data.hostUid : null;
      const playerUids = asStringArray(data.playerUids);
      const players = data.players;

      if (!hostUid || hostUid !== uid)
        return { ok: false as const, code: "not_host" as const };
      if (status !== "lobby")
        return { ok: false as const, code: "already_started" as const };
      if (playerUids.length < 2)
        return { ok: false as const, code: "need_two_players" as const };
      if (!allReady(players, playerUids))
        return { ok: false as const, code: "not_ready" as const };

      const questionCount = toNumber(data.questionCount, 10);

      tx.update(matchRef, {
        status: "starting",
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { ok: true as const, questionCount };
    });

    if (!lock.ok) {
      const code = lock.code;
      const status =
        code === "room_not_found"
          ? 404
          : code === "not_host"
          ? 403
          : code === "already_started"
          ? 409
          : code === "need_two_players"
          ? 409
          : code === "not_ready"
          ? 409
          : 400;

      return NextResponse.json({ error: code }, { status });
    }

    // 2) escolhe perguntas e escreve public/private
    const snapQ = await adminDb
      .collection("quiz_questions")
      .where("active", "==", true)
      .limit(500)
      .get();

    const pool: Picked[] = [];

    for (const d of snapQ.docs) {
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

      pool.push({ id: d.id, text, choices, correctIndex, difficulty, points });
    }

    const count = Math.max(5, Math.min(30, lock.questionCount));
    if (pool.length < count) {
      await matchRef.update({
        status: "lobby",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { error: "not_enough_questions", available: pool.length },
        { status: 400 }
      );
    }

    const picked = shuffle(pool).slice(0, count);

    // grava gabarito privado (apenas servidor)
    const privRef = adminDb.collection("quiz_friend_private").doc(matchId);

    // grava perguntas públicas (sem correctIndex)
    const pubCol = adminDb
      .collection("quiz_friend_matches")
      .doc(matchId)
      .collection("public_questions");

    const batch = adminDb.batch();

    batch.set(privRef, {
      questionIds: picked.map((q) => q.id),
      correctIndexes: picked.map((q) => q.correctIndex),
      points: picked.map((q) => q.points),
      createdAt: FieldValue.serverTimestamp(),
    });

    // limpa public_questions anteriores (se houver) — MVP: não limpamos por batch (manter simples)
    // para evitar lixo, usamos docs com id = index (0..n-1)
    picked.forEach((q, i) => {
      const ref = pubCol.doc(String(i));
      batch.set(ref, {
        index: i,
        id: q.id,
        text: q.text,
        choices: q.choices,
        difficulty: q.difficulty,
        points: q.points,
      });
    });

    await batch.commit();

    await matchRef.update({
      status: "in_progress",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, matchId, count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("FRIEND_START_ERROR", e);
    return NextResponse.json(
      { error: "server_error", detail: msg },
      { status: 500 }
    );
  }
}
