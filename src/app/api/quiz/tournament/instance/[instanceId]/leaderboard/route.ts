import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

import { COL, DEFAULTS } from "@/lib/tournament/config";
import {
  requireUser,
  isAdmin,
  applyDiamondsDeltaTx,
  nowMs,
  normalizePrizeSplit,
} from "@/lib/tournament/server";

export const runtime = "nodejs";

/** Guards locais (sem any) */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asRecord(
  v: unknown,
  err = "DADOS_INVALIDOS"
): Record<string, unknown> {
  if (!isRecord(v)) throw new Error(err);
  return v;
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
function readTimestampMs(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const v = obj[key];
  if (
    isRecord(v) &&
    typeof (v as { toMillis?: unknown }).toMillis === "function"
  ) {
    const ms = (v as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizedSplit(raw: unknown): {
  first: number;
  second: number;
  third: number;
} {
  const s = normalizePrizeSplit(raw);
  const f = clamp01(s.first);
  const se = clamp01(s.second);
  const t = clamp01(s.third);
  const sum = f + se + t;

  if (sum <= 0) return DEFAULTS.prizeSplit;

  return { first: f / sum, second: se / sum, third: t / sum };
}

type LeaderRow = {
  uid: string;
  score: number;
  correctCount: number;
  durationMs: number;
  // submittedAtMs opcional para o client (evita enviar Timestamp)
  submittedAtMs?: number;
};

export async function GET(
  req: Request,
  ctx: { params: { instanceId: string } }
) {
  const instanceId = (ctx.params.instanceId ?? "").trim();

  try {
    const user = await requireUser(req);
    if (!instanceId)
      return NextResponse.json(
        { error: "instanceId inválido" },
        { status: 400 }
      );

    const instRef = adminDb.collection(COL.instances).doc(instanceId);

    // finalize/payout lazy (idempotente)
    await adminDb.runTransaction(async (tx) => {
      const instSnap = await tx.get(instRef);
      if (!instSnap.exists) throw new Error("INSTANCIA_NAO_ENCONTRADA");

      const inst = asRecord(instSnap.data() as unknown, "INSTANCIA_INVALIDA");

      // autorização: participante OU admin
      const participantRef = instRef.collection("participants").doc(user.uid);
      const pSnap = await tx.get(participantRef);
      if (!pSnap.exists && !isAdmin(user)) throw new Error("NAO_PARTICIPANTE");

      const deadlineMs = readTimestampMs(inst, "playDeadlineAt") ?? 0;
      const status = readString(inst, "status");

      const shouldFinalize =
        deadlineMs > 0 &&
        nowMs() >= deadlineMs &&
        status !== "finished" &&
        status !== "cancelled";

      if (!shouldFinalize) return;

      const prizesDistributed = inst.prizesDistributed === true;

      // se já distribuiu, só garante status finished
      if (prizesDistributed) {
        tx.update(instRef, {
          status: "finished",
          finishedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const q = instRef
        .collection("results")
        .orderBy("score", "desc")
        .orderBy("correctCount", "desc")
        .orderBy("durationMs", "asc")
        .orderBy("submittedAt", "asc")
        .limit(3);

      const topSnap = await tx.get(q);
      const topDocs = topSnap.docs;

      // se não tiver 3 resultados, fecha sem payout (MVP)
      if (topDocs.length < 3) {
        const top3Lite = topDocs.map((d) => {
          const r = asRecord(d.data() as unknown, "RESULTADO_INVALIDO");
          return {
            uid: d.id,
            score: typeof r.score === "number" ? r.score : 0,
            correctCount:
              typeof r.correctCount === "number" ? r.correctCount : 0,
            durationMs:
              typeof r.durationMs === "number" ? r.durationMs : 999_999_999,
          };
        });

        tx.update(instRef, {
          status: "finished",
          prizesDistributed: true,
          top3: top3Lite,
          finishedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const pool = readNumber(inst, "prizePoolDiamonds") ?? 0;
      const split = normalizedSplit(inst.prizeSplit);

      const p1 = Math.floor(pool * split.first);
      const p2 = Math.floor(pool * split.second);
      const p3 = Math.max(0, pool - p1 - p2);

      const w1 = topDocs[0].id;
      const w2 = topDocs[1].id;
      const w3 = topDocs[2].id;

      if (pool > 0) {
        await applyDiamondsDeltaTx(tx, w1, p1, "tournament_prize_1st", {
          instanceId,
        });
        await applyDiamondsDeltaTx(tx, w2, p2, "tournament_prize_2nd", {
          instanceId,
        });
        await applyDiamondsDeltaTx(tx, w3, p3, "tournament_prize_3rd", {
          instanceId,
        });
      }

      const top3 = topDocs.map((d) => {
        const r = asRecord(d.data() as unknown, "RESULTADO_INVALIDO");
        return {
          uid: d.id,
          score: typeof r.score === "number" ? r.score : 0,
          correctCount: typeof r.correctCount === "number" ? r.correctCount : 0,
          durationMs:
            typeof r.durationMs === "number" ? r.durationMs : 999_999_999,
        };
      });

      tx.update(instRef, {
        status: "finished",
        prizesDistributed: true,
        top3,
        finishedAt: FieldValue.serverTimestamp(),
      });
    });

    // leitura do leaderboard (fora da transação)
    const instSnap = await instRef.get();
    if (!instSnap.exists)
      return NextResponse.json(
        { error: "INSTANCIA_NAO_ENCONTRADA" },
        { status: 404 }
      );

    const inst = asRecord(instSnap.data() as unknown, "INSTANCIA_INVALIDA");

    // autorização: participante OU admin
    const pSnap = await instRef.collection("participants").doc(user.uid).get();
    if (!pSnap.exists && !isAdmin(user))
      return NextResponse.json({ error: "NAO_PARTICIPANTE" }, { status: 403 });

    const lbSnap = await instRef
      .collection("results")
      .orderBy("score", "desc")
      .orderBy("correctCount", "desc")
      .orderBy("durationMs", "asc")
      .orderBy("submittedAt", "asc")
      .limit(50)
      .get();

    const leaderboard: LeaderRow[] = lbSnap.docs.map((d) => {
      const r = asRecord(d.data() as unknown, "RESULTADO_INVALIDO");
      const submittedAtMs = readTimestampMs(r, "submittedAt");
      return {
        uid: d.id,
        score: readNumber(r, "score") ?? 0,
        correctCount: readNumber(r, "correctCount") ?? 0,
        durationMs: readNumber(r, "durationMs") ?? 999_999_999,
        ...(typeof submittedAtMs === "number" ? { submittedAtMs } : {}),
      };
    });

    const payload = {
      ok: true,
      instanceId,
      status: readString(inst, "status") ?? "lobby",
      participantCount: readNumber(inst, "participantCount") ?? 0,
      openAtMs: readTimestampMs(inst, "openAt"),
      closeAtMs: readTimestampMs(inst, "closeAt"),
      playDeadlineAtMs: readTimestampMs(inst, "playDeadlineAt"),
      prizesDistributed: inst.prizesDistributed === true,
      top3: Array.isArray(inst.top3) ? inst.top3 : undefined,
      leaderboard,
    };

    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "INSTANCIA_NAO_ENCONTRADA"
        ? 404
        : msg === "NAO_PARTICIPANTE"
        ? 403
        : msg === "INSTANCIA_INVALIDA"
        ? 500
        : msg === "DADOS_INVALIDOS"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
