import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

import { COL, type TournamentType, DEFAULTS } from "@/lib/tournament/config";
import { requireAdmin, tsFromISO } from "@/lib/tournament/server";

export const runtime = "nodejs";

function isFile(v: FormDataEntryValue | null): v is File {
  return typeof File !== "undefined" && v instanceof File;
}

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

function clampInt(n: number, min: number, max: number): number {
  const x = Math.trunc(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

function coerceType(v: unknown): TournamentType | undefined {
  return v === "recurring" || v === "special" ? v : undefined;
}

function extFromMime(mime: string): "jpg" | "png" | "webp" {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "webp";
}

function computeStatus(type: TournamentType, startAtMs?: number): string {
  if (type === "recurring") return "open";
  if (typeof startAtMs !== "number" || !Number.isFinite(startAtMs))
    return "scheduled";
  return startAtMs > Date.now() ? "scheduled" : "open";
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "CONTENT_TYPE_INVALID (use multipart/form-data)" },
        { status: 400 }
      );
    }

    const fd = await req.formData();

    const tournamentId = (
      readFdString(fd, "tournamentId") ??
      readFdString(fd, "id") ??
      ""
    ).trim();

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId obrigatório" },
        { status: 400 }
      );
    }

    const tRef = adminDb.collection(COL.tournaments).doc(tournamentId);
    const snap = await tRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const cur = snap.data() as Record<string, unknown>;
    const curType = coerceType(cur.type);
    if (!curType) {
      return NextResponse.json({ error: "TORNEIO_INVALIDO" }, { status: 400 });
    }

    // ===== campos editáveis =====
    const title = (readFdString(fd, "title") ?? "").trim();
    if (title.length < 3) {
      return NextResponse.json(
        { error: "title obrigatório (>= 3)" },
        { status: 400 }
      );
    }

    const descRaw = (readFdString(fd, "description") ?? "").trim();
    const description = descRaw.length ? descRaw : undefined;

    const rawQC = readFdNumber(fd, "questionCount");
    if (rawQC === undefined) {
      return NextResponse.json(
        { error: "questionCount obrigatório" },
        { status: 400 }
      );
    }
    const questionCount = clampInt(rawQC, 1, 50);

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

    const patch: Record<string, unknown> = {
      title,
      questionCount,
      entryFeeDiamonds,
      prizePoolDiamonds,
      prizeSplit: DEFAULTS.prizeSplit, // fixo
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    };

    if (description) patch.description = description;
    else patch.description = FieldValue.delete();

    let computedStartAtMs: number | undefined;

    if (curType === "recurring") {
      const rawMax = readFdNumber(fd, "maxParticipants");
      if (rawMax === undefined) {
        return NextResponse.json(
          { error: "maxParticipants obrigatório" },
          { status: 400 }
        );
      }
      const mp = clampInt(rawMax, 2, 10_000);
      patch.maxParticipants = mp;
      patch.startAt = FieldValue.delete();
      patch.startAtMs = FieldValue.delete();
      patch.status = computeStatus(curType);
    } else {
      const startAtIso = (readFdString(fd, "startAt") ?? "").trim();
      if (!startAtIso) {
        return NextResponse.json(
          { error: "startAt obrigatório (ISO)" },
          { status: 400 }
        );
      }
      const startAt = tsFromISO(startAtIso);
      computedStartAtMs = startAt.toMillis();

      patch.startAt = startAt;
      patch.startAtMs = computedStartAtMs;
      patch.maxParticipants = FieldValue.delete();
      patch.status = computeStatus(curType, computedStartAtMs);
    }

    // ===== capa (opcional na edição) =====
    const coverEntry = fd.get("cover");
    if (coverEntry && isFile(coverEntry)) {
      const okTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!okTypes.has(coverEntry.type)) {
        return NextResponse.json(
          { error: "COVER_TYPE_INVALID" },
          { status: 400 }
        );
      }
      const maxBytes = 4 * 1024 * 1024;
      if (coverEntry.size > maxBytes) {
        return NextResponse.json({ error: "COVER_TOO_LARGE" }, { status: 400 });
      }

      const bucket = adminStorage.bucket();
      const tokenDownload = crypto.randomUUID();
      const ext = extFromMime(coverEntry.type);

      const objectPath = `tournaments/${tournamentId}/cover.${ext}`;
      const buf = Buffer.from(await coverEntry.arrayBuffer());

      // se existia uma capa anterior diferente, apaga para não acumular
      const oldCoverPath =
        typeof cur.coverPath === "string" ? cur.coverPath : undefined;
      if (oldCoverPath && oldCoverPath !== objectPath) {
        await bucket.file(oldCoverPath).delete({ ignoreNotFound: true });
      }

      await bucket.file(objectPath).save(buf, {
        resumable: false,
        contentType: coverEntry.type,
        metadata: {
          metadata: { firebaseStorageDownloadTokens: tokenDownload },
        },
      });

      const encodedPath = encodeURIComponent(objectPath);
      const coverUrl =
        `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}` +
        `?alt=media&token=${tokenDownload}`;

      patch.coverPath = objectPath;
      patch.coverUrl = coverUrl;
    }

    await tRef.update(patch);

    return NextResponse.json({ ok: true, tournamentId });
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
