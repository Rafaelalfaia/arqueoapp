import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { COL, DEFAULTS, type TournamentType } from "@/lib/tournament/config";
import {
  requireUser,
  nowMs,
  addMinutes,
  pickQuestionPack,
  applyDiamondsDeltaTx,
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

    const out = await adminDb.runTransaction(async (tx) => {
      const tSnap = await tx.get(tRef);
      if (!tSnap.exists) throw new Error("TORNEIO_NAO_ENCONTRADO");

      const t = asRecord(tSnap.data() as unknown);

      const type = coerceType(t.type);
      if (!type) throw new Error("TORNEIO_INVALIDO");

      const status = readString(t, "status");
      if (status === "draft" || status === "closed")
        throw new Error("TORNEIO_FECHADO");

      const questionCount = readNumber(t, "questionCount");
      if (!questionCount || questionCount < 1)
        throw new Error("TORNEIO_INVALIDO");

      const graceMinutes =
        readNumber(t, "graceMinutes") ?? DEFAULTS.graceMinutes;
      const startAtMs = readTimestampMs(t, "startAt");

      // Se SPECIAL e já passou a janela de início, fecha para novos registros (evita frustração)
      if (type === "special" && typeof startAtMs === "number") {
        const closeMs = startAtMs + graceMinutes * 60_000;
        if (now > closeMs) throw new Error("TORNEIO_FECHADO");
      }

      const regRef = tRef.collection("registrations").doc(user.uid);
      const regSnap = await tx.get(regRef);

      // Idempotente: se já existe, não cobra e devolve instanceId atual
      if (regSnap.exists) {
        const reg = asRecord(regSnap.data() as unknown);
        const instanceId = readString(reg, "instanceId");
        return { already: true, instanceId: instanceId ?? undefined };
      }

      const entryFee = readNumber(t, "entryFeeDiamonds") ?? 0;
      if (entryFee > 0) {
        await applyDiamondsDeltaTx(
          tx,
          user.uid,
          -entryFee,
          "tournament_entry",
          { tournamentId }
        );
      }

      // SPECIAL: apenas registra; instância nasce no /start
      if (type === "special") {
        tx.set(regRef, {
          uid: user.uid,
          registeredAt: FieldValue.serverTimestamp(),
          state: "registered",
          paid: entryFee > 0,
        });
        return { already: false, instanceId: undefined };
      }

      // RECURRING: garante uma instância lobby aberta (rotativa)
      const maxParticipants = readNumber(t, "maxParticipants") ?? 20;
      const joinMinutes =
        readNumber(t, "recurringJoinMinutes") ?? DEFAULTS.recurringJoinMinutes;
      const maxPlayMinutes =
        readNumber(t, "maxPlayMinutes") ?? DEFAULTS.maxPlayMinutes;

      const activeInstanceId = readString(t, "activeInstanceId");
      let canReuseExisting = false;

      if (activeInstanceId) {
        const instRefExisting = adminDb
          .collection(COL.instances)
          .doc(activeInstanceId);
        const instSnap = await tx.get(instRefExisting);

        if (instSnap.exists) {
          const inst = asRecord(instSnap.data() as unknown);

          const instStatus = readString(inst, "status");
          const closeAtMs = readTimestampMs(inst, "closeAt") ?? 0;
          const participantCount = readNumber(inst, "participantCount") ?? 0;

          const okLobby =
            instStatus === "lobby" &&
            now <= closeAtMs &&
            participantCount < maxParticipants;

          if (okLobby) {
            canReuseExisting = true;
          }
        }
      }

      let instanceId: string;

      if (!canReuseExisting) {
        const createdAt = Timestamp.fromMillis(now);
        const openAt = createdAt;
        const closeAt = addMinutes(openAt, joinMinutes);
        const playDeadlineAt = addMinutes(closeAt, maxPlayMinutes);

        const pack = await pickQuestionPack(questionCount);

        const newInstRef = adminDb.collection(COL.instances).doc();
        const privRef = adminDb.collection(COL.privates).doc(newInstRef.id);

        tx.set(newInstRef, {
          tournamentId,
          type: "recurring",
          status: "lobby",
          openAt,
          closeAt,
          playDeadlineAt,

          questionCount,
          participantCount: 0,

          entryFeeDiamonds: entryFee,
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
          activeInstanceId: newInstRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        });

        instanceId = newInstRef.id;
      } else {
        // Garantia explícita para o TS (sem cast)
        if (!activeInstanceId) throw new Error("INSTANCIA_NAO_ATRIBUIDA");
        instanceId = activeInstanceId;
      }

      // Participante (subcoleção) + contador (somente se novo)
      const instRef = adminDb.collection(COL.instances).doc(instanceId);
      const pRef = instRef.collection("participants").doc(user.uid);
      const pSnap = await tx.get(pRef);

      if (!pSnap.exists) {
        tx.set(
          pRef,
          { joinedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        tx.update(instRef, { participantCount: FieldValue.increment(1) });
      }

      tx.set(regRef, {
        uid: user.uid,
        registeredAt: FieldValue.serverTimestamp(),
        state: "assigned",
        instanceId,
        paid: entryFee > 0,
      });

      return { already: false, instanceId };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "TORNEIO_NAO_ENCONTRADO"
        ? 404
        : msg === "TORNEIO_FECHADO"
        ? 400
        : msg === "SALDO_INSUFICIENTE"
        ? 402
        : msg === "DADOS_INVALIDOS"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
