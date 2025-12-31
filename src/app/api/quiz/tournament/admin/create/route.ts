import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

import { COL, DEFAULTS, type TournamentType } from "@/lib/tournament/config";
import { requireAdmin, tsFromISO, nowMs } from "@/lib/tournament/server";

export const runtime = "nodejs";

/** parsing (sem any, sem null) */
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

function coerceType(v: unknown): TournamentType | undefined {
  return v === "recurring" || v === "special" ? v : undefined;
}

function clampInt(n: number, min: number, max: number): number {
  const x = Math.trunc(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

export async function POST(req: Request) {
  try {
    // Admin via token/claims (e refresh server-side no requireAdmin)
    const admin = await requireAdmin(req);

    const body = asRecord(await req.json());

    const type = coerceType(body.type);
    if (!type) {
      return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }

    const title = (readString(body, "title") ?? "").trim();
    if (title.length < 3) {
      return NextResponse.json(
        { error: "title obrigatório (>= 3)" },
        { status: 400 }
      );
    }

    const description = (readString(body, "description") ?? "").trim();

    const rawQC = readNumber(body, "questionCount");
    const questionCount = rawQC ? clampInt(rawQC, 1, 50) : 0;
    if (questionCount < 1) {
      return NextResponse.json(
        { error: "questionCount inválido" },
        { status: 400 }
      );
    }

    const entryFeeDiamonds = clampInt(
      readNumber(body, "entryFeeDiamonds") ?? 0,
      0,
      1_000_000
    );
    const prizePoolDiamonds = clampInt(
      readNumber(body, "prizePoolDiamonds") ?? 0,
      0,
      1_000_000
    );

    // opcional: capa do torneio
    const coverUrl = (readString(body, "coverUrl") ?? "").trim() || undefined;

    // Regra fixa: 50/30/20 SEMPRE no servidor
    const prizeSplit = DEFAULTS.prizeSplit; // { first:0.5, second:0.3, third:0.2 }

    const now = nowMs();

    // status automático (MVP): não depender de “publish” ainda
    let status: "open" | "scheduled" | "live" = "open";

    // Campos específicos
    let maxParticipants: number | undefined;
    let startAt: ReturnType<typeof tsFromISO> | undefined;
    const graceMinutes = DEFAULTS.graceMinutes;

    if (type === "recurring") {
      const rawMax = readNumber(body, "maxParticipants");
      const mp = rawMax ? clampInt(rawMax, 2, 10_000) : 0;
      if (mp < 2) {
        return NextResponse.json(
          { error: "maxParticipants inválido (>= 2)" },
          { status: 400 }
        );
      }
      maxParticipants = mp;
      status = "open";
    } else {
      const startAtIso = (readString(body, "startAt") ?? "").trim();
      if (!startAtIso) {
        return NextResponse.json(
          { error: "startAt obrigatório (ISO)" },
          { status: 400 }
        );
      }
      startAt = tsFromISO(startAtIso);
      status = startAt.toMillis() <= now ? "live" : "scheduled";
    }

    const tRef = adminDb.collection(COL.tournaments).doc();

    await tRef.set({
      type,
      title,
      description: description || undefined,
      coverUrl,

      status,
      questionCount,

      // recurring
      maxParticipants: type === "recurring" ? maxParticipants : undefined,

      // special
      startAt: type === "special" ? startAt : undefined,
      graceMinutes,

      // economia/premiação
      entryFeeDiamonds,
      prizePoolDiamonds,
      prizeSplit, // fixo 50/30/20

      // controle/metadata
      createdBy: admin.uid,
      activeInstanceId: type === "recurring" ? undefined : undefined,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, tournamentId: tRef.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";

    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "FORBIDDEN"
        ? 403
        : msg === "DADOS_INVALIDOS"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
