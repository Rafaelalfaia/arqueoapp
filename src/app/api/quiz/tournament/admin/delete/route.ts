import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { COL } from "@/lib/tournament/config";
import { requireAdmin } from "@/lib/tournament/server";

export const runtime = "nodejs";

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

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const ct = req.headers.get("content-type") ?? "";
    let tournamentId = "";

    if (ct.includes("application/json")) {
      const body: unknown = await req.json().catch(() => undefined);
      if (isRecord(body)) {
        tournamentId = (
          readString(body, "tournamentId") ??
          readString(body, "id") ??
          ""
        ).trim();
      }
    } else {
      // fallback (caso você queira chamar via formData no futuro)
      const fd = await req.formData();
      const v = fd.get("tournamentId") ?? fd.get("id");
      tournamentId = typeof v === "string" ? v.trim() : "";
    }

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

    const data = snap.data() as Record<string, unknown>;
    const coverPath =
      typeof data.coverPath === "string" ? data.coverPath : undefined;

    if (coverPath) {
      const bucket = adminStorage.bucket();
      await bucket.file(coverPath).delete({ ignoreNotFound: true });
    }

    await tRef.delete();

    return NextResponse.json({ ok: true, tournamentId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
