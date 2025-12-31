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

type ScoreResult = {
  score: number;
  correctCount: number;
  totalQuestions: number;
};

type TxFailCode =
  | "room_not_found"
  | "unauthorized"
  | "not_in_progress"
  | "server_error";

type TxFail = { ok: false; code: TxFailCode; detail?: string };
type TxOkPending = { ok: true; state: "pending" };
type TxOkFinished = { ok: true; state: "finished"; result?: ScoreResult };

type TxResult = TxFail | TxOkPending | TxOkFinished;

type PrivateDoc = {
  correctIndexes?: unknown;
  points?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" && v !== undefined && v !== null && !Array.isArray(v)
  );
}

function getBearer(req: Request): string | undefined {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1];
}

function asStatus(v: unknown): MatchStatus | undefined {
  return v === "lobby" ||
    v === "starting" ||
    v === "in_progress" ||
    v === "finished" ||
    v === "expired"
    ? v
    : undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

function toNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toNumberArray(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => toNumber(x, NaN));
  return out.every((n) => Number.isFinite(n)) ? out : undefined;
}

function computeScore(
  answers: number[],
  correct: number[],
  points: number[]
): ScoreResult {
  let score = 0;
  let correctCount = 0;

  for (let i = 0; i < correct.length; i++) {
    const a = answers[i];
    const c = correct[i];
    if (a === c) {
      correctCount++;
      const p = points[i];
      score += Number.isFinite(p) ? p : 0;
    }
  }

  return { score, correctCount, totalQuestions: correct.length };
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

    const matchId = typeof body.matchId === "string" ? body.matchId : "";
    const answers = toNumberArray(body.answers);

    if (!matchId || !answers || answers.length === 0) {
      return NextResponse.json(
        { error: "bad_request", detail: "matchId/answers inválidos" },
        { status: 400 }
      );
    }

    const matchRef = adminDb.collection("quiz_friend_matches").doc(matchId);
    const subRef = matchRef.collection("submissions").doc(uid);
    const resRef = matchRef.collection("results").doc(uid);
    const privRef = adminDb.collection("quiz_friend_private").doc(matchId);

    const result: TxResult = await adminDb.runTransaction(async (tx) => {
      // =========================
      // 1) LEITURAS (todas primeiro)
      // =========================
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists) return { ok: false, code: "room_not_found" };

      const matchRaw = matchSnap.data() as unknown;
      if (!isRecord(matchRaw)) return { ok: false, code: "room_not_found" };

      const status = asStatus(matchRaw.status);
      const playerUids = asStringArray(matchRaw.playerUids);

      if (!status) return { ok: false, code: "room_not_found" };
      if (!playerUids.includes(uid)) return { ok: false, code: "unauthorized" };

      // Se já finalizado, devolve meu resultado (se existir)
      if (status === "finished") {
        const rSnap = await tx.get(resRef);
        if (!rSnap.exists) return { ok: true, state: "finished" };

        const rd = rSnap.data() as unknown;
        if (!isRecord(rd)) return { ok: true, state: "finished" };

        const score = toNumber(rd.score, 0);
        const correctCount = toNumber(rd.correctCount, 0);
        const totalQuestions = toNumber(rd.totalQuestions, 0);

        return {
          ok: true,
          state: "finished",
          result: { score, correctCount, totalQuestions },
        };
      }

      if (status !== "in_progress") {
        return { ok: false, code: "not_in_progress" };
      }

      // Ler submissions de TODOS (sem escrever ainda)
      const submissions: Record<string, number[]> = {};
      submissions[uid] = answers;

      let allSubmitted = true;

      for (const pUid of playerUids) {
        if (pUid === uid) continue;

        const sSnap = await tx.get(
          matchRef.collection("submissions").doc(pUid)
        );
        if (!sSnap.exists) {
          allSubmitted = false;
          continue;
        }

        const sd = sSnap.data() as unknown;
        if (!isRecord(sd)) {
          allSubmitted = false;
          continue;
        }

        const a = toNumberArray(sd.answers);
        if (!a) {
          allSubmitted = false;
          continue;
        }

        submissions[pUid] = a;
      }

      // Se todos enviaram, ler gabarito/points (ainda sem escrever)
      let correct: number[] | undefined;
      let points: number[] | undefined;

      if (allSubmitted) {
        const privSnap = await tx.get(privRef);
        if (!privSnap.exists) {
          return {
            ok: false,
            code: "server_error",
            detail: "Sem gabarito",
          };
        }

        const privRaw = privSnap.data() as unknown;
        if (!isRecord(privRaw)) {
          return {
            ok: false,
            code: "server_error",
            detail: "Gabarito inválido",
          };
        }

        const pdoc = privRaw as PrivateDoc;

        correct = toNumberArray(pdoc.correctIndexes);
        points = toNumberArray(pdoc.points);

        if (!correct || !points || correct.length !== points.length) {
          return {
            ok: false,
            code: "server_error",
            detail: "Gabarito incompleto",
          };
        }

        // Garantir que todos têm o mesmo tamanho de resposta
        for (const pUid of playerUids) {
          const a = submissions[pUid];
          if (!a || a.length !== correct.length) {
            allSubmitted = false;
            break;
          }
        }
      }

      // =========================
      // 2) ESCRITAS (somente depois das leituras)
      // =========================

      // sempre grava minha submission
      tx.set(
        subRef,
        { answers, submittedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      // se ainda falta alguém, não finaliza
      if (!allSubmitted) {
        tx.update(matchRef, { updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, state: "pending" };
      }

      // aqui é garantido: correct/points existem
      const corr = correct;
      const pts = points;
      if (!corr || !pts) {
        return {
          ok: false,
          code: "server_error",
          detail: "Gabarito ausente",
        };
      }

      // escreve results para todos
      for (const pUid of playerUids) {
        const a = submissions[pUid];
        if (!a) continue;

        const r = computeScore(a, corr, pts);

        tx.set(
          matchRef.collection("results").doc(pUid),
          { ...r, computedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      // finaliza sala
      tx.update(matchRef, {
        status: "finished",
        finishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // meu resultado
      const my = computeScore(answers, corr, pts);
      return { ok: true, state: "finished", result: my };
    });

    if (!result.ok) {
      const status =
        result.code === "room_not_found"
          ? 404
          : result.code === "unauthorized"
          ? 403
          : result.code === "not_in_progress"
          ? 409
          : 500;

      return NextResponse.json(
        { error: result.code, detail: result.detail },
        { status }
      );
    }

    if (result.state === "pending") {
      return NextResponse.json({ state: "pending" });
    }

    // finished
    if (!result.result) return NextResponse.json({ state: "finished" });
    return NextResponse.json({ state: "finished", ...result.result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("FRIEND_SUBMIT_ERROR", e);
    return NextResponse.json(
      { error: "server_error", detail: msg },
      { status: 500 }
    );
  }
}
