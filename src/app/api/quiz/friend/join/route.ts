import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type MatchStatus =
  | "lobby"
  | "starting"
  | "in_progress"
  | "finished"
  | "expired";

type PlayerInfo = {
  name: string;
  photoURL?: string;
  joinedAt: unknown;
  ready: boolean;
};

type MatchData = {
  status?: unknown;
  expiresAt?: unknown;
  maxPlayers?: unknown;
  playerUids?: unknown;
  readyUids?: unknown;
  players?: unknown;
};

type JoinFailCode =
  | "room_not_found"
  | "expired"
  | "room_full"
  | "already_started";

type TxOk = { ok: true; matchId: string };
type TxFail = { ok: false; code: JoinFailCode };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBearer(req: Request): string | undefined {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1];
}

function asStatus(v: unknown): MatchStatus | undefined {
  return v === "lobby" ||
    v === "starting" ||
    v === "in_progress" ||
    v === "finished" ||
    v === "expired"
    ? v
    : undefined;
}

function toNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

function isExpired(expiresAt: unknown): boolean {
  if (!expiresAt) return false;

  if (expiresAt instanceof Date) return expiresAt.getTime() < Date.now();

  if (isRecord(expiresAt) && typeof expiresAt.toDate === "function") {
    const d = (expiresAt.toDate as () => Date)();
    return d.getTime() < Date.now();
  }

  return false;
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
    const joinCodeRaw =
      isRecord(body) && typeof body.joinCode === "string" ? body.joinCode : "";
    const joinCode = joinCodeRaw.trim().toUpperCase();

    if (!joinCode) {
      return NextResponse.json(
        { error: "bad_request", detail: "joinCode inválido" },
        { status: 400 }
      );
    }

    const q = await adminDb
      .collection("quiz_friend_matches")
      .where("joinCode", "==", joinCode)
      .limit(1)
      .get();

    if (q.empty) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }

    const matchRef = q.docs[0].ref;

    const name =
      typeof decoded.name === "string" && decoded.name.trim()
        ? decoded.name.trim()
        : typeof decoded.email === "string" && decoded.email.trim()
        ? decoded.email.trim()
        : "Jogador";

    const photoURL =
      typeof decoded.picture === "string" && decoded.picture.trim()
        ? decoded.picture.trim()
        : undefined;

    const result: TxOk | TxFail = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists) return { ok: false, code: "room_not_found" };

      const raw = snap.data() as unknown;
      if (!isRecord(raw)) return { ok: false, code: "room_not_found" };

      const d = raw as MatchData;

      if (isExpired(d.expiresAt)) {
        tx.update(matchRef, {
          status: "expired",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: false, code: "expired" };
      }

      const status = asStatus(d.status) ?? "lobby";
      const maxPlayers = Math.min(Math.max(toNumber(d.maxPlayers, 2), 2), 8);

      const playerUids = asStringArray(d.playerUids);

      // Se já está na sala, deixa passar (mesmo se já iniciou).
      if (playerUids.includes(uid)) {
        return { ok: true, matchId: snap.id };
      }

      // Só permite entrar enquanto estiver no lobby
      if (status !== "lobby") {
        return { ok: false, code: "already_started" };
      }

      if (playerUids.length >= maxPlayers) {
        return { ok: false, code: "room_full" };
      }

      const upd: Record<string, unknown> = {
        playerUids: FieldValue.arrayUnion(uid),
        // garante que readyUids exista no doc (sem adicionar o novo)
        readyUids: Array.isArray(d.readyUids) ? d.readyUids : [],
        updatedAt: FieldValue.serverTimestamp(),
      };

      const p: PlayerInfo = {
        name,
        photoURL,
        joinedAt: FieldValue.serverTimestamp(),
        ready: false,
      };

      upd[`players.${uid}`] = p;

      tx.update(matchRef, upd);

      return { ok: true, matchId: snap.id };
    });

    if (!result.ok) {
      const httpStatus =
        result.code === "room_not_found"
          ? 404
          : result.code === "expired"
          ? 410
          : result.code === "room_full"
          ? 409
          : 409;

      return NextResponse.json({ error: result.code }, { status: httpStatus });
    }

    return NextResponse.json({ matchId: result.matchId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("FRIEND_JOIN_ERROR", e);
    return NextResponse.json(
      { error: "server_error", detail: msg },
      { status: 500 }
    );
  }
}
