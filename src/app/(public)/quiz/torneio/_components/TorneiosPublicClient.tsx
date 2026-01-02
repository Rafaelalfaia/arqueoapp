"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";

type TournamentType = "recurring" | "special";
type TournamentStatus = "open" | "scheduled" | "live" | "closed" | "draft";

type Item = {
  id: string;
  title: string;
  type: TournamentType;
  status: TournamentStatus;
  questionCount?: number;
  maxParticipants?: number | null;
  startAtMs?: number | null;
  graceMinutes?: number;
  joinClosesAtMs?: number | null;
  coverUrl?: string;
  enrolled?: boolean;
  serverNowMs?: number;
};

const FALLBACK_COVER = "/covers/tournaments/fallback.jpg"; // garanta existir em /public

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
      `API não retornou JSON | status=${res.status} | url=${
        res.url
      } | body[0..200]=${JSON.stringify(text.slice(0, 200))}`
    );
  }

  const parsed = safeJsonParse(text);
  if (!parsed || !isRecord(parsed)) {
    throw new Error(
      `JSON inválido | body[0..200]=${JSON.stringify(text.slice(0, 200))}`
    );
  }

  if (!res.ok) {
    throw new Error(
      readString(parsed, "error") ?? `Falha HTTP (${res.status})`
    );
  }

  return parsed;
}

function formatDate(ms?: number | null): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString("pt-BR");
}

export default function TorneiosPublicClient() {
  const { user } = useAuth();

  const [items, setItems] = useState<Item[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "recurring" | "special">("all");

  const getToken = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("UNAUTHENTICATED");
    return user.getIdToken(true);
  }, [user]);

  const loadList = useCallback(async (): Promise<void> => {
    if (!user) return;
    setError("");
    setLoadingList(true);

    try {
      const token = await getToken();

      const res = await fetch("/api/tournament/public/list", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await readJsonOrThrow(res);
      const raw = json.items as unknown;

      if (!Array.isArray(raw)) throw new Error("RESPOSTA_INVALIDA");

      const parsed: Item[] = [];
      for (const it of raw) {
        if (!isRecord(it)) continue;

        parsed.push({
          id: String(it.id ?? ""),
          title: String(it.title ?? ""),
          type: (it.type === "special"
            ? "special"
            : "recurring") as TournamentType,
          status: (typeof it.status === "string"
            ? it.status
            : "open") as TournamentStatus,
          questionCount:
            typeof it.questionCount === "number" ? it.questionCount : undefined,
          maxParticipants:
            typeof it.maxParticipants === "number"
              ? it.maxParticipants
              : ((it.maxParticipants ?? null) as null),
          startAtMs:
            typeof it.startAtMs === "number"
              ? it.startAtMs
              : ((it.startAtMs ?? null) as null),
          graceMinutes:
            typeof it.graceMinutes === "number" ? it.graceMinutes : 10,
          joinClosesAtMs:
            typeof it.joinClosesAtMs === "number"
              ? it.joinClosesAtMs
              : ((it.joinClosesAtMs ?? null) as null),
          coverUrl: typeof it.coverUrl === "string" ? it.coverUrl : "",
          enrolled: it.enrolled === true,
          serverNowMs:
            typeof it.serverNowMs === "number" ? it.serverNowMs : Date.now(),
        });
      }

      setItems(parsed.filter((x) => x.id && x.title));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingList(false);
    }
  }, [user, getToken]);

  const joinAndGo = useCallback(
    async (tournamentId: string) => {
      if (!user) return;
      setError("");

      try {
        const token = await getToken();
        const res = await fetch("/api/tournament/public/join", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ tournamentId }),
        });

        const json = await readJsonOrThrow(res);
        const redirectTo =
          typeof json.redirectTo === "string" ? json.redirectTo : "";
        if (!redirectTo) throw new Error("RESPOSTA_INVALIDA");
        router.push(redirectTo);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro");
      }
    },
    [user, getToken, router]
  );

  useEffect(() => {
    if (!user) return;
    void loadList();
  }, [user, loadList]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((t) => {
      if (tab !== "all" && t.type !== tab) return false;
      if (!qq) return true;
      return (
        t.title.toLowerCase().includes(qq) || t.id.toLowerCase().includes(qq)
      );
    });
  }, [items, tab, q]);

  const enroll = useCallback(
    async (tournamentId: string) => {
      if (!user) return;
      setError("");

      try {
        const token = await getToken();
        const res = await fetch("/api/tournament/public/enroll", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ tournamentId }),
        });

        await readJsonOrThrow(res);
        await loadList();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro");
      }
    },
    [user, getToken, loadList]
  );

  return (
    <div className="grid gap-4">
      {/* topo */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Torneios disponíveis</div>
          <div className="text-sm opacity-80">
            Em especiais, inscreva-se e entre quando estiver no horário.
          </div>
        </div>

        <button
          className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => void loadList()}
          disabled={loadingList || !user}
        >
          {loadingList ? "Carregando…" : "Recarregar"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <button
              className={`rounded-lg border border-white/10 px-3 py-2 text-sm ${
                tab === "all" ? "bg-white/10" : "bg-black/40"
              }`}
              onClick={() => setTab("all")}
            >
              Todos
            </button>
            <button
              className={`rounded-lg border border-white/10 px-3 py-2 text-sm ${
                tab === "recurring" ? "bg-white/10" : "bg-black/40"
              }`}
              onClick={() => setTab("recurring")}
            >
              Recorrentes
            </button>
            <button
              className={`rounded-lg border border-white/10 px-3 py-2 text-sm ${
                tab === "special" ? "bg-white/10" : "bg-black/40"
              }`}
              onClick={() => setTab("special")}
            >
              Especiais
            </button>
          </div>

          <input
            className="w-full md:w-72 rounded-lg border border-white/10 bg-black/60 p-2 text-sm"
            placeholder="Buscar por título ou ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const img = t.coverUrl?.trim() ? t.coverUrl : FALLBACK_COVER;

            // lógica de botão para special
            const now =
              typeof t.serverNowMs === "number" ? t.serverNowMs : Date.now();
            const start = typeof t.startAtMs === "number" ? t.startAtMs : null;
            const closes =
              typeof t.joinClosesAtMs === "number" ? t.joinClosesAtMs : null;

            const isSpecial = t.type === "special";
            const enrolled = t.enrolled === true;

            const canEnterSpecial =
              isSpecial &&
              enrolled &&
              typeof start === "number" &&
              typeof closes === "number" &&
              now >= start &&
              now <= closes;

            const showEnroll = isSpecial && !enrolled;

            return (
              <div
                key={t.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-black/50"
              >
                <div className="relative">
                  <div
                    className="h-28 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${img})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs">
                      {t.type === "recurring" ? "Recorrente" : "Especial"}
                    </span>
                    {enrolled ? (
                      <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs">
                        Inscrito
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-base font-semibold">{t.title}</div>
                  <div className="text-xs opacity-70 font-mono mt-1">
                    {t.id}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm opacity-90">
                    <div>Perguntas: {t.questionCount ?? "-"}</div>
                    <div>Status: {t.status ?? "-"}</div>
                    <div>
                      Máx:{" "}
                      {t.type === "recurring" ? t.maxParticipants ?? "-" : "-"}
                    </div>
                    <div>
                      Início:{" "}
                      {t.type === "special"
                        ? formatDate(t.startAtMs ?? null)
                        : "-"}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {showEnroll ? (
                      <button
                        className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm"
                        onClick={() => void enroll(t.id)}
                      >
                        Inscrever-se
                      </button>
                    ) : null}

                    {isSpecial && enrolled && !canEnterSpecial ? (
                      <button
                        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm opacity-60 cursor-not-allowed"
                        disabled
                      >
                        Aguardar horário
                      </button>
                    ) : null}

                    {canEnterSpecial ? (
                      <button
                        className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm"
                        onClick={() => void joinAndGo(t.id)}
                      >
                        Começar
                      </button>
                    ) : null}

                    {t.type === "recurring" ? (
                      <button
                        className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm"
                        onClick={() => void joinAndGo(t.id)}
                      >
                        Entrar
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/50 p-4 opacity-70 sm:col-span-2 lg:col-span-3">
              Nenhum torneio encontrado.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
