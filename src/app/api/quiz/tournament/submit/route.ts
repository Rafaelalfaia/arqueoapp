import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

import { COL } from "@/lib/tournament/config";
import { requireUser, nowMs } from "@/lib/tournament/server";

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
function readNumberArray(
  obj: Record<string, unknown>,
  key: string
): number[] | undefined {
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  const out: number[] = [];
  for (const it of v) {
    if (typeof it !== "number" || !Number.isFinite(it)) return undefined;
    out.push(it);
  }
  return out;
}

function parseAnswers(raw: unknown): number[] {
  if (!Array.isArray(raw)) throw new Error("ANSWERS_INVALIDO");
  const out: number[] = [];
  for (const it of raw) {
    // aceita number ou string numérica
    if (typeof it === "number" && Number.isFinite(it)) {
      out.push(it);
      continue;
    }
    if (typeof it === "string" && it.trim().length > 0) {
      const n = Number(it);
      if (Number.isFinite(n)) {
        out.push(n);
        continue;
      }
    }
    throw new Error("ANSWERS_INVALIDO");
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = asRecord(await req.json());

    const instanceId = (readString(body, "instanceId") ?? "").trim();
    if (!instanceId) {
      return NextResponse.json(
        { error: "instanceId obrigatório" },
        { status: 400 }
      );
    }

    const answers = parseAnswers(body.answers);

    const instRef = adminDb.collection(COL.instances).doc(instanceId);
    const privRef = adminDb.collection(COL.privates).doc(instanceId);

    const result = await adminDb.runTransaction(async (tx) => {
      const instSnap = await tx.get(instRef);
      if (!instSnap.exists) throw new Error("INSTANCIA_NAO_ENCONTRADA");

      const inst = asRecord(instSnap.data() as unknown, "INSTANCIA_INVALIDA");

      const playDeadlineAtMs = readTimestampMs(inst, "playDeadlineAt") ?? 0;
      if (playDeadlineAtMs > 0 && nowMs() > playDeadlineAtMs)
        throw new Error("PRAZO_ENCERRADO");

      const qCount = readNumber(inst, "questionCount");
      if (!qCount || qCount < 1) throw new Error("INSTANCIA_INVALIDA");

      if (answers.length !== qCount)
        throw new Error("TAMANHO_RESPOSTAS_INVALIDO");

      // precisa ser participante
      const pRef = instRef.collection("participants").doc(user.uid);
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists) throw new Error("NAO_PARTICIPANTE");

      // idempotência: já tem resultado? retorna sem recalcular
      const resRef = instRef.collection("results").doc(user.uid);
      const existingRes = await tx.get(resRef);
      if (existingRes.exists) {
        const data = asRecord(
          existingRes.data() as unknown,
          "RESULTADO_INVALIDO"
        );
        return { already: true, result: data };
      }

      const privSnap = await tx.get(privRef);
      if (!privSnap.exists) throw new Error("PRIVATE_NAO_ENCONTRADO");
      const priv = asRecord(privSnap.data() as unknown, "PRIVATE_INVALIDO");

      const correctIndexes = readNumberArray(priv, "correctIndexes");
      const points = readNumberArray(priv, "points");
      if (!correctIndexes || !points) throw new Error("PRIVATE_INVALIDO");
      if (correctIndexes.length !== qCount || points.length !== qCount)
        throw new Error("PRIVATE_INVALIDO");

      // duração (tie-break): startedAt -> now; fallback: joinedAt -> now; fallback grande
      const p = asRecord(pSnap.data() as unknown, "PARTICIPANTE_INVALIDO");
      const startedAtMs = readTimestampMs(p, "startedAt");
      const joinedAtMs = readTimestampMs(p, "joinedAt");
      const now = nowMs();
      const durationMs =
        typeof startedAtMs === "number"
          ? Math.max(0, now - startedAtMs)
          : typeof joinedAtMs === "number"
          ? Math.max(0, now - joinedAtMs)
          : 999_999_999;

      let score = 0;
      let correctCount = 0;

      for (let i = 0; i < qCount; i++) {
        if (answers[i] === correctIndexes[i]) {
          correctCount += 1;
          score += points[i];
        }
      }

      // grava submission e resultado (uma única vez)
      tx.set(instRef.collection("submissions").doc(user.uid), {
        answers,
        submittedAt: FieldValue.serverTimestamp(),
      });

      tx.set(resRef, {
        uid: user.uid,
        score,
        correctCount,
        durationMs,
        submittedAt: FieldValue.serverTimestamp(),
        computedAt: FieldValue.serverTimestamp(),
      });

      // (opcional) marca registration como played, se existir tournamentId na instância
      const tournamentId = readString(inst, "tournamentId");
      if (tournamentId) {
        const regRef = adminDb
          .collection(COL.tournaments)
          .doc(tournamentId)
          .collection("registrations")
          .doc(user.uid);
        const regSnap = await tx.get(regRef);
        if (regSnap.exists) tx.update(regRef, { state: "played" });
      }

      return {
        already: false,
        result: { uid: user.uid, score, correctCount, durationMs },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "INSTANCIA_NAO_ENCONTRADA"
        ? 404
        : msg === "NAO_PARTICIPANTE"
        ? 403
        : msg === "PRAZO_ENCERRADO"
        ? 400
        : msg === "TAMANHO_RESPOSTAS_INVALIDO"
        ? 400
        : msg === "ANSWERS_INVALIDO"
        ? 400
        : msg === "PRIVATE_NAO_ENCONTRADO"
        ? 500
        : msg === "PRIVATE_INVALIDO"
        ? 500
        : msg === "DADOS_INVALIDOS"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
