"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";

type MatchStatus =
  | "lobby"
  | "starting"
  | "in_progress"
  | "finished"
  | "expired";

type PlayerUI = {
  uid: string;
  name: string;
  ready: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getMyNameFallback(user: unknown): string {
  if (!user || typeof user !== "object") return "Você";
  const u = user as { displayName?: unknown; email?: unknown };
  const dn = typeof u.displayName === "string" ? u.displayName.trim() : "";
  if (dn) return dn;
  const em = typeof u.email === "string" ? u.email.trim() : "";
  if (em) return em;
  return "Você";
}

function parsePlayersFromMatch(
  data: Record<string, unknown>,
  currentUser: unknown
): { players: PlayerUI[]; myReady: boolean } {
  const uids = asStringArray(data.playerUids);
  const readyUids = asStringArray(data.readyUids);

  const playersRaw = isRecord(data.players) ? data.players : {};
  const meUid =
    currentUser && typeof currentUser === "object" && "uid" in currentUser
      ? String((currentUser as { uid: unknown }).uid ?? "")
      : "";

  const myName = getMyNameFallback(currentUser);

  const players: PlayerUI[] = uids.map((uid) => {
    const pRaw = playersRaw[uid];
    const p = isRecord(pRaw) ? pRaw : undefined;

    const nameFromDoc = p && typeof p.name === "string" ? p.name.trim() : "";
    const name = nameFromDoc || (uid === meUid ? myName : "Jogador");

    const readyFromDoc = p ? p.ready === true : false;
    const ready = readyUids.includes(uid) || readyFromDoc;

    return { uid, name, ready };
  });

  const myReady = meUid
    ? players.some((p) => p.uid === meUid && p.ready)
    : false;

  return { players, myReady };
}

async function readJsonOrText(
  res: Response
): Promise<{ rawText: string; data: unknown }> {
  const rawText = await res.text();
  if (!rawText) return { rawText: "", data: {} };
  try {
    return { rawText, data: JSON.parse(rawText) as unknown };
  } catch {
    return { rawText, data: {} };
  }
}

function parseApiError(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;
  const code = typeof data.error === "string" ? data.error : fallback;

  if (code === "unauthorized") return "Sessão inválida. Faça login novamente.";
  if (code === "not_host") return "Apenas o criador da sala pode iniciar.";
  if (code === "need_two_players")
    return "É necessário pelo menos 2 jogadores.";
  if (code === "not_ready")
    return "Todos precisam marcar 'Pronto' para iniciar.";
  if (code === "not_enough_questions")
    return "Sem perguntas suficientes ativas.";
  if (code === "server_error") {
    const d = typeof data.detail === "string" ? data.detail : undefined;
    return d ? `Erro no servidor: ${d}` : "Erro no servidor.";
  }
  return code;
}

export default function LobbyAmizade() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const ready = useMemo(() => !loading, [loading]);

  const [status, setStatus] = useState<MatchStatus>("lobby");
  const [joinCode, setJoinCode] = useState<string>("");
  const [hostUid, setHostUid] = useState<string>("");
  const [players, setPlayers] = useState<PlayerUI[]>([]);
  const [myReady, setMyReady] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (!matchId) return;

    const ref = doc(db, "quiz_friend_matches", matchId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as DocumentData | undefined;
        if (!data || !isRecord(data)) return;

        const st = asStatus(data.status) ?? "lobby";
        setStatus(st);

        setJoinCode(safeString(data.joinCode));
        setHostUid(safeString(data.hostUid));

        const parsed = parsePlayersFromMatch(data, user);
        setPlayers(parsed.players);
        setMyReady(parsed.myReady);

        if (st === "in_progress") {
          router.replace(`/quiz/amizade/jogar/${matchId}`);
        }
      },
      (e) => {
        setErr(
          typeof e?.message === "string" ? e.message : "Falha ao ouvir sala."
        );
      }
    );

    return () => unsub();
  }, [matchId, router, user]);

  async function setReady(next: boolean) {
    if (!user) return;
    setBusy(true);
    setErr(undefined);

    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/quiz/friend/ready", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId, ready: next }),
      });

      const { rawText, data } = await readJsonOrText(res);
      if (!res.ok) {
        const fallback = `Falha (HTTP ${res.status})${
          rawText ? `: ${rawText.slice(0, 160)}` : ""
        }`;
        throw new Error(parseApiError(data, fallback));
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!user) return;
    setBusy(true);
    setErr(undefined);

    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/quiz/friend/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId }),
      });

      const { rawText, data } = await readJsonOrText(res);
      if (!res.ok) {
        const fallback = `Falha ao iniciar (HTTP ${res.status})${
          rawText ? `: ${rawText.slice(0, 160)}` : ""
        }`;
        throw new Error(parseApiError(data, fallback));
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="p-6">Carregando...</main>;

  const isHost = !!user && user.uid === hostUid;

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Link className="underline" href="/quiz/amizade">
          ← Modo Amizade
        </Link>
        <Link className="underline" href="/perfil">
          Perfil
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Sala</h1>

      <div className="mt-3 border rounded p-4">
        <div className="text-sm opacity-80">Status: {status}</div>

        <div className="mt-2">
          <span className="opacity-80 text-sm">Código:</span>{" "}
          <span className="font-semibold">{joinCode || "—"}</span>
        </div>

        <div className="mt-1 text-xs opacity-60">Sala ID: {matchId}</div>

        <div className="mt-4">
          <div className="font-medium">Jogadores ({players.length})</div>
          <ul className="mt-2 space-y-1">
            {players.map((p) => (
              <li
                key={p.uid}
                className="flex items-center justify-between border rounded px-3 py-2"
              >
                <span className="text-sm">
                  {p.name} {p.uid === hostUid ? "(Host)" : ""}
                </span>
                <span className="text-xs opacity-80">
                  {p.ready ? "PRONTO" : "AGUARDANDO"}
                </span>
              </li>
            ))}
          </ul>

          {players.length === 0 && (
            <p className="mt-2 text-sm opacity-70">
              Nenhum jogador encontrado. (Se você acabou de criar, verifique se
              o servidor está gravando <code>playerUids</code>.)
            </p>
          )}
        </div>

        <div className="mt-4 flex gap-3 flex-wrap">
          <button
            className="border rounded px-4 py-2"
            disabled={busy || status !== "lobby"}
            onClick={() => setReady(!myReady)}
            title="Marcar/Desmarcar pronto"
          >
            {myReady ? "Estou pronto ✓" : "Marcar pronto"}
          </button>

          {isHost && (
            <button
              className="border rounded px-4 py-2"
              disabled={busy || status !== "lobby"}
              onClick={startGame}
              title="Somente host inicia"
            >
              {busy ? "Iniciando..." : "Iniciar partida"}
            </button>
          )}
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </div>
    </main>
  );
}
