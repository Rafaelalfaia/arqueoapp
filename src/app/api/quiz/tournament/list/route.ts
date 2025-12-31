import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  COL,
  DEFAULTS,
  type TournamentType,
  type TournamentStatus,
} from "@/lib/tournament/config";
import { nowMs } from "@/lib/tournament/server";

/** Guards locais (sem any) */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asRecord(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) return {};
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
  // Firestore Timestamp (Admin SDK) tem toMillis()
  if (
    isRecord(v) &&
    typeof (v as { toMillis?: unknown }).toMillis === "function"
  ) {
    const ms = (v as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

function coerceType(s: unknown): TournamentType | undefined {
  return s === "recurring" || s === "special" ? s : undefined;
}

function coerceStatus(s: unknown): TournamentStatus | undefined {
  return s === "draft" ||
    s === "open" ||
    s === "scheduled" ||
    s === "live" ||
    s === "closed"
    ? s
    : undefined;
}

type TournamentListItem = {
  id: string;
  type: TournamentType;
  status: TournamentStatus;
  title: string;
  description?: string;
  questionCount: number;
  maxParticipants?: number;
  startAtMs?: number;
  graceMinutes: number;
  entryFeeDiamonds: number;
  prizePoolDiamonds: number;
  joinOpen: boolean;
};

export const runtime = "nodejs";

export async function GET() {
  const now = nowMs();

  const snap = await adminDb
    .collection(COL.tournaments)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const tournaments: TournamentListItem[] = [];

  for (const d of snap.docs) {
    const raw = asRecord(d.data() as unknown);

    const type = coerceType(raw.type);
    const status = coerceStatus(raw.status);
    const title = (readString(raw, "title") ?? "").trim();

    const questionCount = readNumber(raw, "questionCount");

    if (!type || !status || !title || !questionCount) {
      // pula docs inválidos para não quebrar o feed
      continue;
    }

    const description = (() => {
      const s = readString(raw, "description");
      const t = s ? s.trim() : undefined;
      return t && t.length > 0 ? t : undefined;
    })();

    const maxParticipants = readNumber(raw, "maxParticipants");
    const startAtMs = readTimestampMs(raw, "startAt");

    const graceMinutes =
      readNumber(raw, "graceMinutes") ?? DEFAULTS.graceMinutes;
    const entryFeeDiamonds = readNumber(raw, "entryFeeDiamonds") ?? 0;
    const prizePoolDiamonds = readNumber(raw, "prizePoolDiamonds") ?? 0;

    const joinOpen =
      type === "recurring"
        ? status === "open"
        : startAtMs !== undefined &&
          status !== "closed" &&
          now >= startAtMs &&
          now <= startAtMs + graceMinutes * 60_000;

    const item: TournamentListItem = {
      id: d.id,
      type,
      status,
      title,
      questionCount,
      graceMinutes,
      entryFeeDiamonds,
      prizePoolDiamonds,
      joinOpen,
    };

    if (description) item.description = description;
    if (typeof maxParticipants === "number")
      item.maxParticipants = maxParticipants;
    if (typeof startAtMs === "number") item.startAtMs = startAtMs;

    tournaments.push(item);
  }

  return NextResponse.json({ ok: true, tournaments });
}
