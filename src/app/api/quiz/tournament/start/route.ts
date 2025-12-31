import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { COL, DEFAULTS, type TournamentType } from "@/lib/tournament/config";
import {
  requireUser,
  nowMs,
  addMinutes,
  pickQuestionPack,
  sanitizeQuestion,
} from "@/lib/tournament/server";

export const runtime = "nodejs";

/** Guards locais (sem any) */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asRecord(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error("DADOS_INVALIDOS");
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
function coerceType(v: unknown): TournamentType | undefined {
  return v === "recurring" || v === "special" ? v : undefined;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = asRecord(await req.json());

    const tournamentId = (readString(body, "tournamentId") ?? "").trim();
    if (!tournamentId)
      return NextResponse.json(
        { error: "tournamentId obrigatório" },
        { status: 400 }
      );

    const now = nowMs();
    const tRef = adminDb.collection(COL.tournaments).doc(tournamentId);

    const { instanceId } = await adminDb.runTransaction(async (tx) => {
      const tSnap = await tx.get(tRef);
      if (!tSnap.exists) throw new Error("TORNEIO_NAO_ENCONTRADO");

      const t = asRecord(tSnap.data() as unknown);

      const type = coerceType(t.type);
      if (!type) throw new Error("TORNEIO_INVALIDO");

      const regRef = tRef.collection("registrations").doc(user.uid);
      const regSnap = await tx.get(regRef);
      if (!regSnap.exists) throw new Error("NAO_INSCRITO");

      const reg = asRecord(regSnap.data() as unknown);

      // RECURRING: instanceId já atribuído no /register
      if (type === "recurring") {
        const instId = readString(reg, "instanceId");
        if (!instId) throw new Error("INSTANCIA_NAO_ATRIBUIDA");

        const instRef = adminDb.collection(COL.instances).doc(instId);
        const instSnap = await tx.get(instRef);
        if (!instSnap.exists) throw new Error("INSTANCIA_NAO_ENCONTRADA");

        const inst = asRecord(instSnap.data() as unknown);
        const closeAtMs = readTimestampMs(inst, "closeAt") ?? 0;

        // Se nunca iniciou e a janela fechou, bloqueia start
        const pRef = instRef.collection("participants").doc(user.uid);
        const pSnap = await tx.get(pRef);

        const alreadyStarted =
          pSnap.exists &&
          (() => {
            const p = asRecord(pSnap.data() as unknown);
            return readTimestampMs(p, "startedAt") !== undefined;
          })();

        if (!alreadyStarted && now > closeAtMs)
          throw new Error("JANELA_INICIO_FECHADA");

        // garante participant e marca startedAt
        tx.set(
          pRef,
          { startedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );

        // opcional: move status para in_progress quando alguém inicia
        const instStatus = readString(inst, "status");
        if (instStatus === "lobby") {
          tx.update(instRef, {
            status: "in_progress",
            startedAt: FieldValue.serverTimestamp(),
          });
        }

        return { instanceId: instId };
      }

      // SPECIAL: valida janela e cria instância lazy (idempotente)
      const startAtMs = readTimestampMs(t, "startAt");
      if (startAtMs === undefined) throw new Error("TORNEIO_SEM_STARTAT");

      const graceMinutes =
        readNumber(t, "graceMinutes") ?? DEFAULTS.graceMinutes;
      const maxPlayMinutes =
        readNumber(t, "maxPlayMinutes") ?? DEFAULTS.maxPlayMinutes;

      const openAt = Timestamp.fromMillis(startAtMs);
      const closeAt = addMinutes(openAt, graceMinutes);
      const playDeadlineAt = addMinutes(closeAt, maxPlayMinutes);

      const launchedInstanceId = readString(t, "launchedInstanceId");
      const regInstanceId = readString(reg, "instanceId");
      const instId = regInstanceId ?? launchedInstanceId;

      // Se ainda não abriu, não permite
      if (now < openAt.toMillis()) throw new Error("AINDA_NAO_ABRIU");

      // Se passou closeAt, só permite se já tinha startedAt antes (reentrar na tela)
      const alreadyHasInst = typeof instId === "string" && instId.length > 0;

      let instanceIdToUse: string;

      if (!alreadyHasInst) {
        // Se não existe instância ainda e a janela já fechou, bloqueia
        if (now > closeAt.toMillis()) throw new Error("JANELA_INICIO_FECHADA");

        const questionCount = readNumber(t, "questionCount");
        if (!questionCount || questionCount < 1)
          throw new Error("TORNEIO_INVALIDO");

        const pack = await pickQuestionPack(questionCount);

        const newInstRef = adminDb.collection(COL.instances).doc();
        const privRef = adminDb.collection(COL.privates).doc(newInstRef.id);

        tx.set(newInstRef, {
          tournamentId,
          type: "special",
          status: "lobby",
          openAt,
          closeAt,
          playDeadlineAt,

          questionCount,
          participantCount: 0,

          entryFeeDiamonds: readNumber(t, "entryFeeDiamonds") ?? 0,
          prizePoolDiamonds: readNumber(t, "prizePoolDiamonds") ?? 0,
          prizeSplit: t.prizeSplit ?? DEFAULTS.prizeSplit,

          prizesDistributed: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        tx.set(privRef, {
          tournamentId,
          questionIds: pack.questionIds,
          correctIndexes: pack.correctIndexes,
          points: pack.points,
          createdAt: FieldValue.serverTimestamp(),
        });

        tx.update(tRef, {
          launchedInstanceId: newInstRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        });

        instanceIdToUse = newInstRef.id;
      } else {
        instanceIdToUse = instId as string;
      }

      const instRef = adminDb.collection(COL.instances).doc(instanceIdToUse);
      const instSnap = await tx.get(instRef);
      if (!instSnap.exists) throw new Error("INSTANCIA_NAO_ENCONTRADA");

      const inst = asRecord(instSnap.data() as unknown);
      const instCloseAtMs =
        readTimestampMs(inst, "closeAt") ?? closeAt.toMillis();

      const pRef = instRef.collection("participants").doc(user.uid);
      const pSnap = await tx.get(pRef);

      const startedBefore =
        pSnap.exists &&
        (() => {
          const p = asRecord(pSnap.data() as unknown);
          return readTimestampMs(p, "startedAt") !== undefined;
        })();

      if (!startedBefore && now > instCloseAtMs)
        throw new Error("JANELA_INICIO_FECHADA");

      // Se participante não existia, cria e incrementa contador
      if (!pSnap.exists) {
        tx.set(
          pRef,
          { joinedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        tx.update(instRef, { participantCount: FieldValue.increment(1) });
      }

      // Marca startedAt e move status
      tx.set(
        pRef,
        { startedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      const instStatus = readString(inst, "status");
      if (instStatus === "lobby") {
        tx.update(instRef, {
          status: "in_progress",
          startedAt: FieldValue.serverTimestamp(),
        });
      }

      // atualiza registration
      tx.update(regRef, { instanceId: instanceIdToUse, state: "assigned" });

      return { instanceId: instanceIdToUse };
    });

    // Carrega pack privado e perguntas sanitizadas (fora da transação)
    const privSnap = await adminDb
      .collection(COL.privates)
      .doc(instanceId)
      .get();
    if (!privSnap.exists) throw new Error("PRIVATE_NAO_ENCONTRADO");

    const priv = asRecord(privSnap.data() as unknown);
    const ids = priv.questionIds;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
      throw new Error("PRIVATE_INVALIDO");
    }

    const refs = (ids as string[]).map((id) =>
      adminDb.collection(COL.questions).doc(id)
    );
    const qSnaps = await adminDb.getAll(...refs);

    const questions = qSnaps.map((s) => {
      if (!s.exists) throw new Error("QUESTAO_NAO_ENCONTRADA");
      return sanitizeQuestion(s.id, s.data() as unknown);
    });

    const instSnap = await adminDb
      .collection(COL.instances)
      .doc(instanceId)
      .get();
    if (!instSnap.exists) throw new Error("INSTANCIA_NAO_ENCONTRADA");

    const inst = asRecord(instSnap.data() as unknown);

    const openAtMs = readTimestampMs(inst, "openAt");
    const closeAtMs = readTimestampMs(inst, "closeAt");
    const playDeadlineAtMs = readTimestampMs(inst, "playDeadlineAt");

    return NextResponse.json({
      ok: true,
      instanceId,
      openAtMs,
      closeAtMs,
      playDeadlineAtMs,
      questions,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "TORNEIO_NAO_ENCONTRADO"
        ? 404
        : msg === "NAO_INSCRITO"
        ? 403
        : msg === "AINDA_NAO_ABRIU"
        ? 400
        : msg === "JANELA_INICIO_FECHADA"
        ? 400
        : msg === "INSTANCIA_NAO_ENCONTRADA"
        ? 404
        : msg === "PRIVATE_NAO_ENCONTRADO"
        ? 500
        : msg === "PRIVATE_INVALIDO"
        ? 500
        : msg === "QUESTAO_NAO_ENCONTRADA"
        ? 500
        : msg === "DADOS_INVALIDOS"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
