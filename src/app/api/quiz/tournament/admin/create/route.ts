import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import {
  COL,
  DEFAULTS,
  type TournamentType,
  type TournamentStatus,
} from "@/lib/tournament/config";
import {
  requireAdmin,
  assertNumber,
  assertTournamentType,
  tsFromISO,
  normalizePrizeSplit,
} from "@/lib/tournament/server";

export const runtime = "nodejs";

/** Guards locais (sem any) */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asRecord(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error("BODY_INVALIDO");
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

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const body = asRecord(await req.json());

    const type: TournamentType = assertTournamentType(body.type);

    const title = (readString(body, "title") ?? "").trim();
    if (!title)
      return NextResponse.json({ error: "title obrigatório" }, { status: 400 });

    const descriptionRaw = readString(body, "description");
    const description = descriptionRaw ? descriptionRaw.trim() : undefined;

    const questionCount = assertNumber("questionCount", body.questionCount);
    if (questionCount < 1 || questionCount > 50) {
      return NextResponse.json(
        { error: "questionCount fora do limite (1..50)" },
        { status: 400 }
      );
    }

    const entryFeeDiamonds = readNumber(body, "entryFeeDiamonds") ?? 0;
    const prizePoolDiamonds = readNumber(body, "prizePoolDiamonds") ?? 0;

    const graceMinutes =
      readNumber(body, "graceMinutes") ?? DEFAULTS.graceMinutes;
    const recurringJoinMinutes =
      readNumber(body, "recurringJoinMinutes") ?? DEFAULTS.recurringJoinMinutes;
    const maxPlayMinutes =
      readNumber(body, "maxPlayMinutes") ?? DEFAULTS.maxPlayMinutes;

    const prizeSplit = normalizePrizeSplit(body.prizeSplit);

    let startAt: Timestamp | undefined;
    let maxParticipants: number | undefined;
    let status: TournamentStatus;

    if (type === "recurring") {
      status = "open";
      const mp = readNumber(body, "maxParticipants") ?? 20;
      if (mp < 2 || mp > 5000) {
        return NextResponse.json(
          { error: "maxParticipants fora do limite (2..5000)" },
          { status: 400 }
        );
      }
      maxParticipants = mp;
    } else {
      status = "scheduled";
      const startAtISO = readString(body, "startAt");
      if (!startAtISO) {
        return NextResponse.json(
          { error: "startAt obrigatório no special (ISO)" },
          { status: 400 }
        );
      }
      startAt = tsFromISO(startAtISO);
    }

    const ref = adminDb.collection(COL.tournaments).doc();

    // Monta payload sem undefined (para não quebrar no Firestore)
    const payload: Record<string, unknown> = {
      type,
      title,
      status,

      questionCount,

      graceMinutes,
      recurringJoinMinutes,
      maxPlayMinutes,

      entryFeeDiamonds,
      prizePoolDiamonds,
      prizeSplit,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (description && description.length > 0)
      payload.description = description;
    if (typeof maxParticipants === "number")
      payload.maxParticipants = maxParticipants;
    if (startAt) payload.startAt = startAt;

    await ref.set(payload);

    return NextResponse.json({ ok: true, tournamentId: ref.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "FORBIDDEN"
        ? 403
        : msg === "BODY_INVALIDO"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
