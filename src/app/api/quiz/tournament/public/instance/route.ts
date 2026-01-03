import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/tournament/config";
import { requireUser, nowMs, toMs } from "@/lib/tournament/server";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

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

async function maybeAutoStartRecurring(
  instanceRef: FirebaseFirestore.DocumentReference
) {
  const now = nowMs();

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(instanceRef);
    if (!snap.exists) return;

    const data = snap.data();
    if (!data || !isRecord(data)) return;

    const type = readString(data, "type");
    const status = readString(data, "status");

    if (type !== "recurring") return;
    if (status !== "lobby") return;

    const participantCount = readNumber(data, "participantCount") ?? 0;
    const minPlayers =
      readNumber(data, "minParticipants") ?? RECURRING_MIN_PLAYERS;

    const autoStartAtMs = readNumber(data, "autoStartAtMs");
    if (typeof autoStartAtMs !== "number") return;

    // Regra: só inicia se já passou o tempo e tem mínimo de jogadores
    if (now < autoStartAtMs) return;
    if (participantCount < minPlayers) return;

    // Start idempotente: se alguém já iniciou entre leituras, esse update não roda porque status não é mais lobby
    tx.update(instanceRef, {
      status: "in_progress",
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function GET(req: Request) {
  try {
    const u = await requireUser(req);

    const url = new URL(req.url);
    const instanceId = (url.searchParams.get("instanceId") ?? "").trim();
    if (!instanceId) {
      return NextResponse.json(
        { error: "instanceId obrigatório" },
        { status: 400 }
      );
    }

    const iRef = adminDb.collection(COL.instances).doc(instanceId);

    // Segurança: só quem entrou pode ver
    const pRef = iRef.collection("participants").doc(u.uid);
    const pSnap = await pRef.get();
    if (!pSnap.exists) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // TICK: tenta iniciar recorrente quando chegar a hora (30s) e tiver >=2
    await maybeAutoStartRecurring(iRef);

    // Recarrega dados após tick
    const iSnap = await iRef.get();
    if (!iSnap.exists)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const iData = iSnap.data();
    if (!iData || !isRecord(iData)) {
      return NextResponse.json(
        { error: "INSTANCIA_INVALIDA" },
        { status: 400 }
      );
    }

    const tournamentId = (readString(iData, "tournamentId") ?? "").trim();
    const tSnap = tournamentId
      ? await adminDb.collection(COL.tournaments).doc(tournamentId).get()
      : null;
    const tData = tSnap?.exists ? tSnap.data() : undefined;

    const partsSnap = await iRef
      .collection("participants")
      .orderBy("joinedAt", "asc")
      .limit(200)
      .get();

    const participants = partsSnap.docs.map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        score: isRecord(x) ? readNumber(x, "score") ?? 0 : 0,
        finished: isRecord(x) ? x.finished === true : false,
      };
    });

    const createdAtMs = toMs(iData.createdAt) ?? null;

    return NextResponse.json({
      ok: true,
      serverNowMs: nowMs(),
      instance: {
        id: iSnap.id,
        tournamentId,
        type: readString(iData, "type") ?? "",
        status: readString(iData, "status") ?? "",
        participantCount:
          readNumber(iData, "participantCount") ?? participants.length,
        maxParticipants: readNumber(iData, "maxParticipants") ?? null,

        // útil pro client (se quiser exibir countdown)
        autoStartAtMs: readNumber(iData, "autoStartAtMs") ?? null,
        minParticipants: readNumber(iData, "minParticipants") ?? null,

        createdAtMs,
      },
      tournament:
        tData && isRecord(tData)
          ? {
              id: tournamentId,
              title: (typeof tData.title === "string" ? tData.title : "") ?? "",
              coverUrl:
                (typeof tData.coverUrl === "string" ? tData.coverUrl : "") ??
                "",
              questionCount:
                typeof (tData as Record<string, unknown>).questionCount ===
                "number"
                  ? (tData as Record<string, unknown>).questionCount
                  : null,
            }
          : null,
      participants,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
