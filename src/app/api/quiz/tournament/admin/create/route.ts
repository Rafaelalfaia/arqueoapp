import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import crypto from "crypto";

import { COL, DEFAULTS, type TournamentType } from "@/lib/tournament/config";
import { requireAdmin, tsFromISO, nowMs } from "@/lib/tournament/server";

export const runtime = "nodejs";

/** parsing (sem any, sem null) */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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

function readFdString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
}

function readFdNumber(fd: FormData, key: string): number | undefined {
  const s = readFdString(fd, key);
  if (typeof s !== "string") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function isFile(v: FormDataEntryValue | null): v is File {
  return typeof File !== "undefined" && v instanceof File;
}

function extFromMime(mime: string): "jpg" | "png" | "webp" {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "webp";
}

export async function POST(req: Request) {
  try {
    // Admin via token/claims (e refresh server-side no requireAdmin)
    const admin = await requireAdmin(req);

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "CONTENT_TYPE_INVALID (use multipart/form-data)" },
        { status: 400 }
      );
    }

    const fd = await req.formData();

    const type = coerceType(readFdString(fd, "type"));
    if (!type) {
      return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }

    const title = (readFdString(fd, "title") ?? "").trim();
    if (title.length < 3) {
      return NextResponse.json(
        { error: "title obrigatório (>= 3)" },
        { status: 400 }
      );
    }

    const description =
      (readFdString(fd, "description") ?? "").trim() || undefined;

    const rawQC = readFdNumber(fd, "questionCount");
    const questionCount = rawQC ? clampInt(rawQC, 1, 50) : 0;
    if (questionCount < 1) {
      return NextResponse.json(
        { error: "questionCount inválido" },
        { status: 400 }
      );
    }

    const entryFeeDiamonds = clampInt(
      readFdNumber(fd, "entryFeeDiamonds") ?? 0,
      0,
      1_000_000
    );
    const prizePoolDiamonds = clampInt(
      readFdNumber(fd, "prizePoolDiamonds") ?? 0,
      0,
      1_000_000
    );

    // Campos específicos
    let maxParticipants: number | undefined;
    let startAt: ReturnType<typeof tsFromISO> | undefined;
    const graceMinutes = DEFAULTS.graceMinutes;

    const now = nowMs();
    let status: "open" | "scheduled" | "live" = "open";

    if (type === "recurring") {
      const rawMax = readFdNumber(fd, "maxParticipants");
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
      const startAtIso = (readFdString(fd, "startAt") ?? "").trim();
      if (!startAtIso) {
        return NextResponse.json(
          { error: "startAt obrigatório (ISO)" },
          { status: 400 }
        );
      }
      startAt = tsFromISO(startAtIso);
      status = startAt.toMillis() <= now ? "live" : "scheduled";
    }

    // Upload obrigatório da capa
    const coverEntry = fd.get("cover");
    if (!coverEntry || !isFile(coverEntry)) {
      return NextResponse.json({ error: "COVER_REQUIRED" }, { status: 400 });
    }

    const okTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!okTypes.has(coverEntry.type)) {
      return NextResponse.json(
        { error: "COVER_TYPE_INVALID" },
        { status: 400 }
      );
    }

    const maxBytes = 4 * 1024 * 1024; // 4MB
    if (coverEntry.size > maxBytes) {
      return NextResponse.json({ error: "COVER_TOO_LARGE" }, { status: 400 });
    }

    // Regra fixa: 50/30/20 SEMPRE no servidor
    const prizeSplit = DEFAULTS.prizeSplit;

    // Cria doc id antes para montar o path no Storage
    const tRef = adminDb.collection(COL.tournaments).doc();
    const tournamentId = tRef.id;

    // Upload no Firebase Storage (bucket padrão)
    const bucket = getStorage().bucket();
    const tokenDownload = crypto.randomUUID();
    const ext = extFromMime(coverEntry.type);
    const objectPath = `tournaments/${tournamentId}/cover.${ext}`;

    const buf = Buffer.from(await coverEntry.arrayBuffer());

    await bucket.file(objectPath).save(buf, {
      resumable: false,
      contentType: coverEntry.type,
      metadata: {
        metadata: { firebaseStorageDownloadTokens: tokenDownload },
      },
    });

    const encodedPath = encodeURIComponent(objectPath);
    const coverUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${tokenDownload}`;

    await tRef.set({
      type,
      title,
      description,

      // capa
      coverUrl,
      coverPath: objectPath,

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
      activeInstanceId: undefined,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, tournamentId, coverUrl });
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
