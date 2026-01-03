import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COL } from "@/lib/tournament/config";
import {
  requireUser,
  nowMs,
  pickQuestionPack,
  toMs,
  readWalletBalance,
} from "@/lib/tournament/server";

export const runtime = "nodejs";

type TournamentType = "recurring" | "special";
type TournamentStatus = "draft" | "open" | "scheduled" | "live" | "closed";

const MIN_WALLET = 50;
const TOPUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

// NOVO: regra de início do recorrente
const RECURRING_AUTO_START_DELAY_MS = 30_000; // 30s
const RECURRING_MIN_PLAYERS = 2;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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

function coerceType(v: unknown): TournamentType | undefined {
  return v === "recurring" || v === "special" ? v : undefined;
}

function coerceStatus(v: unknown): TournamentStatus | undefined {
  return v === "draft" ||
    v === "open" ||
    v === "scheduled" ||
    v === "live" ||
    v === "closed"
    ? v
    : undefined;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new Error("CONTENT_TYPE_INVALID");
  const raw = (await req.json()) as unknown;
  if (!isRecord(raw)) throw new Error("DADOS_INVALIDOS");
  return raw;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await readBody(req);

    const tournamentId = (readString(body, "tournamentId") ?? "").trim();
    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId obrigatório" },
        { status: 400 }
      );
    }

    const now = nowMs();

    // Pré-leitura do torneio para validar e congelar pack fora da TX
    const tRef = adminDb.collection(COL.tournaments).doc(tournamentId);
    const tSnap = await tRef.get();
    if (!tSnap.exists)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const tDataRaw = tSnap.data();
    if (!tDataRaw || !isRecord(tDataRaw)) {
      return NextResponse.json({ error: "TORNEIO_INVALIDO" }, { status: 400 });
    }
    if (tDataRaw.deletedAt)
      return NextResponse.json({ error: "DELETED" }, { status: 400 });

    const type = coerceType(tDataRaw.type);
    if (!type)
      return NextResponse.json({ error: "TORNEIO_INVALIDO" }, { status: 400 });

    const status =
      coerceStatus(tDataRaw.status) ??
      (type === "recurring" ? "open" : "scheduled");
    if (status === "draft" || status === "closed") {
      return NextResponse.json(
        { error: "TORNEIO_INDISPONIVEL" },
        { status: 400 }
      );
    }

    const questionCount = readNumber(tDataRaw, "questionCount") ?? 10;
    const graceMinutes = readNumber(tDataRaw, "graceMinutes") ?? 10;
    const maxParticipants = readNumber(tDataRaw, "maxParticipants") ?? 20;
    const entryFeeDiamonds = readNumber(tDataRaw, "entryFeeDiamonds") ?? 0;

    const startAtMs =
      type === "special"
        ? readNumber(tDataRaw, "startAtMs") ?? toMs(tDataRaw.startAt)
        : undefined;

    const joinClosesAtMs =
      type === "special" && typeof startAtMs === "number"
        ? startAtMs + graceMinutes * 60_000
        : undefined;

    // Pack fixo (se precisar criar instância)
    const pack = await pickQuestionPack(questionCount);

    // candidate id para uma nova instância (caso necessário)
    const candidateInstanceId = adminDb.collection(COL.instances).doc().id;

    let resultInstanceId = "";

    await adminDb.runTransaction(async (tx) => {
      // ================= READS primeiro =================
      const tSnap2 = await tx.get(tRef);
      if (!tSnap2.exists) throw new Error("NOT_FOUND");
      const t2 = tSnap2.data();
      if (!t2 || !isRecord(t2)) throw new Error("TORNEIO_INVALIDO");
      if (t2.deletedAt) throw new Error("DELETED");

      const curType = coerceType(t2.type);
      if (!curType) throw new Error("TORNEIO_INVALIDO");

      const curStatus =
        coerceStatus(t2.status) ??
        (curType === "recurring" ? "open" : "scheduled");
      if (curStatus === "draft" || curStatus === "closed") {
        throw new Error("TORNEIO_INDISPONIVEL");
      }

      // special: precisa estar inscrito e dentro da janela
      if (curType === "special") {
        const stMs = readNumber(t2, "startAtMs") ?? toMs(t2.startAt);
        const g = readNumber(t2, "graceMinutes") ?? graceMinutes;
        const closesMs =
          typeof stMs === "number" ? stMs + g * 60_000 : undefined;

        if (typeof stMs !== "number" || typeof closesMs !== "number") {
          throw new Error("STARTAT_INVALIDO");
        }
        if (now < stMs || now > closesMs) throw new Error("FORA_DA_JANELA");

        const eRef = adminDb
          .collection(COL.tournaments)
          .doc(tournamentId)
          .collection("enrollments")
          .doc(user.uid);

        const eSnap = await tx.get(eRef);
        if (!eSnap.exists) throw new Error("NAO_INSCRITO");
      }

      const userRef = adminDb.collection(COL.users).doc(user.uid);
      const uSnap = await tx.get(userRef);

      // ============ Determina instância a usar ============
      const activeInstanceId = (
        readString(t2, "activeInstanceId") ?? ""
      ).trim();
      const baseInstanceId = activeInstanceId
        ? activeInstanceId
        : candidateInstanceId;

      const baseIRef = adminDb.collection(COL.instances).doc(baseInstanceId);
      const baseISnap = await tx.get(baseIRef);

      // Se é recorrente e a instância ativa já terminou/cancelou, cria uma nova
      let instanceIdToUse = baseInstanceId;
      let iRef = baseIRef;
      let iSnap = baseISnap;

      if (curType === "recurring" && baseISnap.exists) {
        const iData = baseISnap.data();
        const iStatus =
          iData && isRecord(iData) ? readString(iData, "status") : undefined;
        if (iStatus === "finished" || iStatus === "cancelled") {
          instanceIdToUse = candidateInstanceId;
          iRef = adminDb.collection(COL.instances).doc(instanceIdToUse);
          iSnap = await tx.get(iRef); // read (deve não existir)
        }
      }

      const pRef = iRef.collection("participants").doc(user.uid);
      const pSnap = await tx.get(pRef);

      // ================= WALLET floor + cobrança =================
      const uObj =
        uSnap.exists && uSnap.data() && isRecord(uSnap.data())
          ? (uSnap.data() as Record<string, unknown>)
          : undefined;

      let balance = uObj ? readWalletBalance(uObj) : 0;

      const lastTopupMs = uObj
        ? toMs((uObj as Record<string, unknown>)["walletTopupAt"])
        : undefined;
      const canTopup =
        typeof lastTopupMs !== "number" ||
        now - lastTopupMs >= TOPUP_INTERVAL_MS;

      if (balance < MIN_WALLET && canTopup) {
        const delta = MIN_WALLET - balance;
        balance = MIN_WALLET;

        tx.set(adminDb.collection(COL.ledger).doc(), {
          uid: user.uid,
          delta,
          reason: "WALLET_FLOOR_TOPUP",
          meta: { min: MIN_WALLET, via: "tournament_join" },
          createdAt: FieldValue.serverTimestamp(),
        });

        if (!uSnap.exists) {
          tx.set(
            userRef,
            {
              uid: user.uid,
              role: "user",
              walletBalance: balance,
              diamonds: balance,
              walletTopupAt: FieldValue.serverTimestamp(),
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          tx.update(userRef, {
            walletBalance: balance,
            diamonds: balance,
            walletTopupAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } else {
        // garante doc mínimo
        if (!uSnap.exists) {
          tx.set(
            userRef,
            {
              uid: user.uid,
              role: "user",
              walletBalance: balance,
              diamonds: balance,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      // não cobra duas vezes se já está como participante
      if (!pSnap.exists && entryFeeDiamonds > 0) {
        const next = balance - entryFeeDiamonds;
        if (next < 0) throw new Error("SALDO_INSUFICIENTE");
        balance = next;

        tx.update(userRef, {
          walletBalance: balance,
          diamonds: balance,
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.set(adminDb.collection(COL.ledger).doc(), {
          uid: user.uid,
          delta: -entryFeeDiamonds,
          reason: "TOURNAMENT_ENTRY_FEE",
          meta: { tournamentId, instanceId: instanceIdToUse },
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // ================= INSTANCE create/reuse =================
      const shouldCreate = !iSnap.exists;

      if (shouldCreate) {
        const baseStatus = curType === "special" ? "in_progress" : "lobby";

        const autoStartAtMs =
          curType === "recurring" ? now + RECURRING_AUTO_START_DELAY_MS : null;

        tx.set(
          iRef,
          {
            tournamentId,
            type: curType,
            status: baseStatus,

            questionCount,
            // recorrente: usa maxParticipants, special: null
            maxParticipants: curType === "recurring" ? maxParticipants : null,

            // NOVO: recorrente
            minParticipants:
              curType === "recurring" ? RECURRING_MIN_PLAYERS : null,
            autoStartAtMs, // recorrente

            // special
            startAtMs: curType === "special" ? startAtMs ?? null : null,
            graceMinutes: curType === "special" ? graceMinutes : null,
            joinClosesAtMs:
              curType === "special" ? joinClosesAtMs ?? null : null,

            participantCount: 0,
            questionIds: pack.questionIds,

            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: false }
        );

        // privates (gabarito/pontos)
        tx.set(
          adminDb.collection(COL.privates).doc(iRef.id),
          {
            instanceId: iRef.id,
            tournamentId,
            correctIndexes: pack.correctIndexes,
            points: pack.points,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: false }
        );

        // grava activeInstanceId no torneio (recurring)
        if (curType === "recurring") {
          tx.update(tRef, {
            activeInstanceId: iRef.id,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } else {
        // Se recorrente e instância legacy não tem autoStartAtMs, define a partir de agora
        if (curType === "recurring") {
          const iData = iSnap.data();
          const hasAuto =
            iData && isRecord(iData)
              ? typeof readNumber(iData, "autoStartAtMs") === "number"
              : false;
          const st =
            iData && isRecord(iData) ? readString(iData, "status") : undefined;
          if (!hasAuto && st === "lobby") {
            tx.update(iRef, {
              autoStartAtMs: now + RECURRING_AUTO_START_DELAY_MS,
              minParticipants: RECURRING_MIN_PLAYERS,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      // ================= join participant =================
      if (!pSnap.exists) {
        tx.set(
          pRef,
          {
            uid: user.uid,
            joinedAt: FieldValue.serverTimestamp(),
            score: 0,
            finished: false,
          },
          { merge: true }
        );

        // Atualiza contador
        const iData = iSnap.exists ? iSnap.data() : null;
        const curCount =
          iData && isRecord(iData)
            ? readNumber(iData, "participantCount") ?? 0
            : 0;

        const nextCount = curCount + 1;

        // start imediato se encher
        if (curType === "recurring") {
          const mp = readNumber(t2, "maxParticipants") ?? maxParticipants;
          const shouldStartNow = nextCount >= mp;

          tx.update(iRef, {
            participantCount: nextCount,
            status: shouldStartNow ? "in_progress" : "lobby",
            startedAt: shouldStartNow
              ? FieldValue.serverTimestamp()
              : FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          // special já entra in_progress
          tx.update(iRef, {
            participantCount: nextCount,
            status: "in_progress",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      resultInstanceId = iRef.id;
    });

    return NextResponse.json({
      ok: true,
      tournamentId,
      instanceId: resultInstanceId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "FORBIDDEN"
        ? 403
        : msg === "SALDO_INSUFICIENTE"
        ? 400
        : msg === "NAO_INSCRITO"
        ? 400
        : msg === "FORA_DA_JANELA"
        ? 400
        : msg === "CONTENT_TYPE_INVALID"
        ? 400
        : msg === "DADOS_INVALIDOS"
        ? 400
        : msg === "NOT_FOUND"
        ? 404
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
