import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type PlayerInfo = {
  name: string;
  photoURL?: string;
  joinedAt: unknown;
  ready: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBearer(req: Request): string | undefined {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1];
}

function toInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function makeJoinCode(len = 6): string {
  // Evita 0/O e 1/I
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function generateUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeJoinCode(6);
    const q = await adminDb
      .collection("quiz_friend_matches")
      .where("joinCode", "==", code)
      .limit(1)
      .get();

    if (q.empty) return code;
  }
  return makeJoinCode(8);
}

function safeTrim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body: unknown = await req.json().catch(() => ({}));
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "bad_request", detail: "Body inválido" },
        { status: 400 }
      );
    }

    const maxPlayers = Math.min(Math.max(toInt(body.maxPlayers, 2), 2), 8);

    const qCountRaw = toInt(body.questionCount, 10);
    const questionCount =
      qCountRaw === 10 || qCountRaw === 15 || qCountRaw === 20 ? qCountRaw : 10;

    const joinCode = await generateUniqueJoinCode();

    const name = safeTrim(decoded.name) || safeTrim(decoded.email) || "Jogador";

    const photoURL = safeTrim(decoded.picture) || undefined;

    const matchRef = adminDb.collection("quiz_friend_matches").doc();
    const matchId = matchRef.id;

    const hostPlayer: PlayerInfo = {
      name,
      photoURL,
      joinedAt: FieldValue.serverTimestamp(),
      ready: false,
    };

    await matchRef.set({
      status: "lobby",
      joinCode,
      hostUid: uid,
      maxPlayers,
      questionCount,

      playerUids: [uid],
      readyUids: [],

      // importante: o host já entra no mapa de players
      players: {
        [uid]: hostPlayer,
      },

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ matchId, joinCode });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("FRIEND_CREATE_ERROR", e);
    return NextResponse.json(
      { error: "server_error", detail: msg },
      { status: 500 }
    );
  }
}
