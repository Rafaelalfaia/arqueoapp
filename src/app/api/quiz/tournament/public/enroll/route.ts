import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { COL } from "@/lib/tournament/config";
import { requireUser, nowMs } from "@/lib/tournament/server";

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

function coerceType(v: unknown): "recurring" | "special" | undefined {
  return v === "recurring" || v === "special" ? v : undefined;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const body = (await req.json().catch(() => null)) as unknown;
    if (!isRecord(body)) {
      return NextResponse.json({ error: "BODY_INVALIDO" }, { status: 400 });
    }

    const tournamentId = (readString(body, "tournamentId") ?? "").trim();
    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId obrigatório" },
        { status: 400 }
      );
    }

    const tRef = adminDb.collection(COL.tournaments).doc(tournamentId);

    const result = await adminDb.runTransaction(async (tx) => {
      const tSnap = await tx.get(tRef);
      if (!tSnap.exists) throw new Error("NOT_FOUND");

      const tData = tSnap.data();
      if (!tData || !isRecord(tData)) throw new Error("TORNEIO_INVALIDO");
      if (tData.deletedAt) throw new Error("DELETED");

      const type = coerceType(tData.type);
      if (!type) throw new Error("TORNEIO_INVALIDO");

      const status = (
        typeof tData.status === "string" ? tData.status : ""
      ) as string;
      if (status === "draft" || status === "closed")
        throw new Error("TORNEIO_INDISPONIVEL");

      // enrollment doc
      const eRef = tRef.collection("enrollments").doc(user.uid);
      const eSnap = await tx.get(eRef);

      if (!eSnap.exists) {
        tx.set(eRef, {
          uid: user.uid,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: user.uid,
          serverNowMs: nowMs(),
        });

        // contador simples (opcional, mas útil)
        tx.update(tRef, {
          enrolledCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return { type };
    });

    return NextResponse.json({ ok: true, tournamentId, type: result.type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "NOT_FOUND"
        ? 404
        : msg === "TORNEIO_INDISPONIVEL" ||
          msg === "TORNEIO_INVALIDO" ||
          msg === "DELETED"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
