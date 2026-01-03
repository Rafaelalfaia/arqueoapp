import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/tournament/config";
import { requireUser, nowMs } from "@/lib/tournament/server";

export const runtime = "nodejs";

type TournamentType = "recurring" | "special";
type TournamentStatus = "draft" | "open" | "scheduled" | "live" | "closed";

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

/** Converte startAt (Timestamp) para ms, suportando variações */
function getStartAtMs(raw: Record<string, unknown>): number | undefined {
  const startAtMs = readNumber(raw, "startAtMs");
  if (typeof startAtMs === "number") return startAtMs;

  const startAt = raw["startAt"];
  if (!startAt) return undefined;

  // Timestamp do Admin SDK costuma ter toMillis()
  if (typeof startAt === "object" && startAt !== null) {
    const anyTs = startAt as {
      toMillis?: unknown;
      _seconds?: unknown;
      seconds?: unknown;
    };
    if (typeof anyTs.toMillis === "function") {
      try {
        const v = (anyTs.toMillis as () => number)();
        return Number.isFinite(v) ? v : undefined;
      } catch {
        // ignore
      }
    }

    // fallback: { seconds } ou { _seconds }
    const sec = typeof anyTs.seconds === "number" ? anyTs.seconds : undefined;
    const sec2 =
      typeof anyTs._seconds === "number" ? anyTs._seconds : undefined;
    const s = typeof sec === "number" ? sec : sec2;
    if (typeof s === "number" && Number.isFinite(s)) return s * 1000;
  }

  return undefined;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    // MVP: lista os últimos 50
    const snap = await adminDb
      .collection(COL.tournaments)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const now = nowMs();

    const items: Array<Record<string, unknown>> = [];

    // Para reduzir N+1, só checamos enrollment de torneio especial
    const enrollmentChecks: Array<Promise<void>> = [];

    for (const d of snap.docs) {
      const dataRaw = d.data();
      if (!isRecord(dataRaw)) continue;

      // se existir soft-delete
      if (dataRaw.deletedAt) continue;

      const type = coerceType(dataRaw.type);
      if (!type) continue;

      const status =
        coerceStatus(dataRaw.status) ??
        (type === "recurring" ? "open" : "scheduled");

      // não expor draft no público
      if (status === "draft") continue;

      const title = (readString(dataRaw, "title") ?? "").trim();
      if (title.length < 1) continue;

      const questionCount = readNumber(dataRaw, "questionCount") ?? 0;
      const maxParticipants = readNumber(dataRaw, "maxParticipants");
      const coverUrl = readString(dataRaw, "coverUrl");

      const graceMinutes = readNumber(dataRaw, "graceMinutes") ?? 10;

      const startAtMs = type === "special" ? getStartAtMs(dataRaw) : undefined;
      const joinClosesAtMs =
        type === "special" && typeof startAtMs === "number"
          ? startAtMs + graceMinutes * 60_000
          : undefined;

      const baseItem: Record<string, unknown> = {
        id: d.id,
        title,
        type,
        status,
        questionCount,
        coverUrl: coverUrl ?? "",
        maxParticipants: type === "recurring" ? maxParticipants ?? null : null,
        startAtMs: type === "special" ? startAtMs ?? null : null,
        graceMinutes,
        joinClosesAtMs: type === "special" ? joinClosesAtMs ?? null : null,
        serverNowMs: now,
        enrolled: false, // será atualizado abaixo se special
      };

      // enrollment check (somente para special)
      if (type === "special") {
        const p = (async () => {
          const eRef = adminDb
            .collection(COL.tournaments)
            .doc(d.id)
            .collection("enrollments")
            .doc(user.uid);

          const eSnap = await eRef.get();
          if (eSnap.exists) baseItem.enrolled = true;
        })();

        enrollmentChecks.push(p);
      }

      items.push(baseItem);
    }

    // aguarda checagens
    if (enrollmentChecks.length) {
      await Promise.allSettled(enrollmentChecks);
    }

    return NextResponse.json({ ok: true, items, tournaments: items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
