"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";

type Instance = {
  instanceId: string;
  tournamentId: string;
  type: string;
  status: string;
  questionCount: number | null;
  capacity: number | null;
  playersCount: number;
  startsAtMs: number | null;
  startAtMs: number | null;
  joinClosesAtMs: number | null;
  serverNowMs: number;
};

type Player = { uid: string; status: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function readJsonOrThrow(
  res: Response
): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!ct.includes("application/json")) {
    throw new Error(
      `API não retornou JSON | status=${res.status} | body=${text.slice(
        0,
        200
      )}`
    );
  }
  const parsed = safeJsonParse(text);
  if (!parsed || !isRecord(parsed)) throw new Error("JSON inválido");
  if (!res.ok)
    throw new Error(
      typeof parsed.error === "string" ? parsed.error : `HTTP ${res.status}`
    );
  return parsed;
}

function fmt(ms?: number | null): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString("pt-BR");
}

export default function TorneioLobbyClient({
  instanceId,
}: {
  instanceId: string;
}) {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [instance, setInstance] = useState<Instance | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const getToken = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("UNAUTHENTICATED");
    return user.getIdToken(true);
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch(
        `/api/tournament/public/instance?instanceId=${encodeURIComponent(
          instanceId
        )}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await readJsonOrThrow(res);

      const instRaw = json.instance;
      const playersRaw = json.players;

      if (!isRecord(instRaw) || !Array.isArray(playersRaw))
        throw new Error("RESPOSTA_INVALIDA");

      setInstance(instRaw as unknown as Instance);
      setPlayers(playersRaw as unknown as Player[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [user, getToken, instanceId]);

  // primeira carga + polling leve
  useEffect(() => {
    if (!user) return;
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [user, load]);

  const countdown = useMemo(() => {
    if (!instance?.startsAtMs) return null;
    const diff = instance.startsAtMs - instance.serverNowMs;
    if (diff <= 0) return "Iniciando…";
    const s = Math.ceil(diff / 1000);
    return `${s}s`;
  }, [instance]);

  if (!user) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          Faça login para entrar no torneio.
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Lobby do torneio</div>
          <div className="text-sm opacity-80 font-mono">
            Instância: {instanceId}
          </div>
        </div>
        <button
          className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 grid gap-3">
        <div className="grid gap-1">
          <div className="text-sm opacity-80">Status</div>
          <div className="text-base font-semibold">
            {instance?.status ?? "-"}
          </div>
        </div>

        <div className="grid gap-1">
          <div className="text-sm opacity-80">Participantes</div>
          <div className="text-base">
            {instance
              ? `${instance.playersCount}${
                  instance.capacity ? ` / ${instance.capacity}` : ""
                }`
              : "-"}
          </div>
        </div>

        {instance?.type === "special" ? (
          <div className="grid gap-1">
            <div className="text-sm opacity-80">Janela de entrada</div>
            <div className="text-sm">
              Início: {fmt(instance.startAtMs)} <br />
              Fecha: {fmt(instance.joinClosesAtMs)}
            </div>
          </div>
        ) : null}

        {instance?.status === "starting" ? (
          <div className="rounded-xl border border-white/10 bg-black/50 p-3 text-sm">
            Sala completa. Iniciando em:{" "}
            <span className="font-semibold">{countdown ?? "-"}</span>
          </div>
        ) : null}

        {/* Próxima etapa real: quando status virar live, navegar para a tela de jogo */}
        {instance?.status === "live" ? (
          <button
            className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm"
            onClick={() => {
              // aqui você pluga o gameplay: /quiz/torneio/[instanceId]/play (ou semelhante)
              router.push(
                `/quiz/torneio/${encodeURIComponent(instanceId)}/play`
              );
            }}
          >
            Entrar no jogo
          </button>
        ) : (
          <div className="text-sm opacity-70">
            Aguardando condições de início…
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="text-sm opacity-80 mb-3">Jogadores (até 50)</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <div
              key={p.uid}
              className="rounded-xl border border-white/10 bg-black/50 p-3"
            >
              <div className="text-xs opacity-70 font-mono">{p.uid}</div>
              <div className="text-sm">Status: {p.status}</div>
            </div>
          ))}
          {players.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/50 p-3 opacity-70 sm:col-span-2">
              Nenhum jogador ainda.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
