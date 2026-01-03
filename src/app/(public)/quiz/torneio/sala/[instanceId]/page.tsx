"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

type LobbyResp = {
  ok: true;
  serverNowMs: number;
  instance: {
    id: string;
    tournamentId: string;
    type: string;
    status: string;
    participantCount: number;
    maxParticipants: number | null;
  };
  tournament: { id: string; title: string; coverUrl: string } | null;
  participants: Array<{ uid: string; score: number; finished: boolean }>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || !isRecord(parsed)) throw new Error("JSON inválido");
  if (!res.ok)
    throw new Error((parsed.error as string) ?? `HTTP ${res.status}`);
  return parsed;
}

export default function SalaTorneioPage() {
  const params = useParams<{ instanceId: string }>();
  const instanceId = params?.instanceId ?? "";

  const { user } = useAuth();
  const [error, setError] = useState("");
  const [data, setData] = useState<LobbyResp | null>(null);
  const [loading, setLoading] = useState(false);

  const getToken = useCallback(async () => {
    if (!user) throw new Error("UNAUTHENTICATED");
    return user.getIdToken(true);
  }, [user]);

  const load = useCallback(async () => {
    if (!user || !instanceId) return;

    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      const res = await fetch(
        `/api/quiz/tournament/public/instance?instanceId=${encodeURIComponent(
          instanceId
        )}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = (await readJsonOrThrow(res)) as unknown;
      if (!isRecord(json) || json.ok !== true)
        throw new Error("RESPOSTA_INVALIDA");
      setData(json as LobbyResp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [user, instanceId, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // polling leve do lobby (2s)
  useEffect(() => {
    if (!user || !instanceId) return;
    const id = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(id);
  }, [user, instanceId, load]);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sala do Torneio</h1>
          <p className="mt-1 opacity-80 text-sm">
            Instância: <span className="font-mono">{instanceId || "-"}</span>
          </p>
        </div>

        <nav className="flex gap-4 text-sm">
          <Link className="underline" href="/quiz/torneio">
            Voltar
          </Link>
          <Link className="underline" href="/perfil">
            Perfil
          </Link>
        </nav>
      </header>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      ) : null}

      <section className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
        {loading && !data ? (
          <div className="opacity-80">Carregando…</div>
        ) : null}

        {data ? (
          <div className="grid gap-3">
            <div className="text-base font-semibold">
              {data.tournament?.title ?? "Torneio"}
            </div>

            <div className="text-sm opacity-80">
              Status da instância:{" "}
              <span className="font-mono">{data.instance.status}</span>
              {" • "}
              Jogadores:{" "}
              <span className="font-mono">
                {data.instance.participantCount}
                {data.instance.maxParticipants
                  ? `/${data.instance.maxParticipants}`
                  : ""}
              </span>
            </div>

            <div className="mt-2 rounded-xl border border-white/10 bg-black/50 p-3">
              <div className="text-sm font-semibold mb-2">Participantes</div>
              <ul className="text-sm opacity-90 grid gap-1">
                {data.participants.map((p) => (
                  <li key={p.uid} className="font-mono">
                    {p.uid} • score={p.score}
                    {p.finished ? " • finished" : ""}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-sm opacity-70">
              Próxima etapa: quando status ficar{" "}
              <span className="font-mono">in_progress</span>, buscar perguntas e
              iniciar o quiz.
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
