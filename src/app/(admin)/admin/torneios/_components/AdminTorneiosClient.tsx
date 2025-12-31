"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

type TournamentType = "recurring" | "special";

type ListItem = {
  id: string;
  title: string;
  type: TournamentType;
  status?: string;
  questionCount?: number;
  maxParticipants?: number;
  startAtMs?: number;
};

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
function coerceType(v: unknown): TournamentType | undefined {
  return v === "recurring" || v === "special" ? v : undefined;
}
function formatDate(ms?: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString("pt-BR");
}

type Tab = "all" | "recurring" | "special";

export default function AdminTorneiosClient() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [error, setError] = useState<string>("");

  // form
  const [type, setType] = useState<TournamentType>("recurring");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [startAtLocal, setStartAtLocal] = useState(""); // datetime-local
  const [entryFeeDiamonds, setEntryFeeDiamonds] = useState(0);
  const [prizePoolDiamonds, setPrizePoolDiamonds] = useState(0);

  const canCreate = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (!(questionCount >= 1)) return false;
    if (type === "recurring" && !(maxParticipants >= 2)) return false;
    if (type === "special" && startAtLocal.trim().length < 8) return false;
    return true;
  }, [title, questionCount, type, maxParticipants, startAtLocal]);

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

  async function getToken(): Promise<string> {
    if (!user) throw new Error("UNAUTHENTICATED");
    return user.getIdToken(true);
  }

  async function loadList(): Promise<void> {
    setError("");
    setLoadingList(true);
    try {
      const res = await fetch("/api/tournament/list", { method: "GET" });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = isRecord(json) ? readString(json, "error") : undefined;
        throw new Error(msg ?? "Falha ao carregar torneios");
      }
      if (!isRecord(json)) throw new Error("RESPOSTA_INVALIDA");

      const rawArr = (json.tournaments ?? json.items) as unknown;
      if (!Array.isArray(rawArr)) throw new Error("RESPOSTA_INVALIDA");

      const parsed: ListItem[] = [];
      for (const it of rawArr) {
        if (!isRecord(it)) continue;
        const id = readString(it, "id") ?? readString(it, "tournamentId");
        const ttl = readString(it, "title");
        const tp = coerceType(it.type);
        if (!id || !ttl || !tp) continue;

        parsed.push({
          id,
          title: ttl,
          type: tp,
          status: readString(it, "status"),
          questionCount: readNumber(it, "questionCount"),
          maxParticipants: readNumber(it, "maxParticipants"),
          startAtMs: readNumber(it, "startAtMs"),
        });
      }

      setItems(parsed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  async function onCreate(): Promise<void> {
    setError("");
    if (!canCreate) return;

    setLoadingCreate(true);
    try {
      const token = await getToken();

      const payload: Record<string, unknown> = {
        type,
        title: title.trim(),
        description: description.trim(),
        questionCount,
        maxParticipants: type === "recurring" ? maxParticipants : undefined,
        startAt:
          type === "special" ? new Date(startAtLocal).toISOString() : undefined,
        entryFeeDiamonds,
        prizePoolDiamonds,

        // NÃO enviar split — servidor aplica 50/30/20 fixo
      };

      const res = await fetch("/api/tournament/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = isRecord(json) ? readString(json, "error") : undefined;
        throw new Error(msg ?? "Falha ao criar torneio");
      }

      // reset
      setTitle("");
      setDescription("");
      setQuestionCount(10);
      setMaxParticipants(20);
      setStartAtLocal("");
      setEntryFeeDiamonds(0);
      setPrizePoolDiamonds(0);

      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingCreate(false);
    }
  }

  return (
    <div className="grid gap-4">
      {/* Banner / Capa */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <div
          className="h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: "url(/covers/admin-torneios.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
        <div className="absolute left-4 top-4">
          <div className="text-xl font-semibold">Central de Torneios</div>
          <div className="text-sm opacity-80">
            Premiação fixa: 1º 50% • 2º 30% • 3º 20%
          </div>
        </div>
        <div className="absolute right-4 top-4">
          <button
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => void loadList()}
            disabled={loadingList}
          >
            {loadingList ? "Carregando…" : "Recarregar"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {error}
          <div className="mt-2 opacity-80">
            Se aparecer <code>FORBIDDEN</code>, seu token não está validando
            como admin. Saia e entre novamente.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Lista estilo “cards” */}
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
              className="w-full md:w-64 rounded-lg border border-white/10 bg-black/60 p-2 text-sm"
              placeholder="Buscar por título ou ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-white/10 bg-black/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{t.title}</div>
                    <div className="text-xs opacity-70 font-mono mt-1">
                      {t.id}
                    </div>
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs">
                    {t.type === "recurring" ? "Recorrente" : "Especial"}
                  </span>
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
                    {t.type === "special" ? formatDate(t.startAtMs) : "-"}
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/50 p-4 opacity-70 sm:col-span-2">
                Nenhum torneio encontrado.
              </div>
            ) : null}
          </div>
        </div>

        {/* Criar torneio */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="text-base font-semibold">Criar torneio</div>
          <div className="mt-1 text-sm opacity-80">
            Split fixo 50/30/20 (sem edição).
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Tipo</span>
              <select
                className="rounded-lg border border-white/10 bg-black/60 p-2"
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value === "special" ? "special" : "recurring"
                  )
                }
              >
                <option value="recurring">Recorrente</option>
                <option value="special">Especial</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-80">Título</span>
              <input
                className="rounded-lg border border-white/10 bg-black/60 p-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Torneio Xingu - Semana 1"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-80">Descrição</span>
              <input
                className="rounded-lg border border-white/10 bg-black/60 p-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Regras/tema/premiação"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-80">
                Quantidade de perguntas
              </span>
              <input
                className="rounded-lg border border-white/10 bg-black/60 p-2"
                type="number"
                min={1}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              />
            </label>

            {type === "recurring" ? (
              <label className="grid gap-1">
                <span className="text-sm opacity-80">Máx. participantes</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/60 p-2"
                  type="number"
                  min={2}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                />
              </label>
            ) : (
              <label className="grid gap-1">
                <span className="text-sm opacity-80">Data/Hora (Especial)</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/60 p-2"
                  type="datetime-local"
                  value={startAtLocal}
                  onChange={(e) => setStartAtLocal(e.target.value)}
                />
              </label>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm opacity-80">
                  Taxa de entrada (diamantes)
                </span>
                <input
                  className="rounded-lg border border-white/10 bg-black/60 p-2"
                  type="number"
                  min={0}
                  value={entryFeeDiamonds}
                  onChange={(e) => setEntryFeeDiamonds(Number(e.target.value))}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm opacity-80">
                  Pool de prêmio (diamantes)
                </span>
                <input
                  className="rounded-lg border border-white/10 bg-black/60 p-2"
                  type="number"
                  min={0}
                  value={prizePoolDiamonds}
                  onChange={(e) => setPrizePoolDiamonds(Number(e.target.value))}
                />
              </label>
            </div>

            <button
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm disabled:opacity-50"
              disabled={loadingCreate || !canCreate}
              onClick={() => void onCreate()}
            >
              {loadingCreate ? "Criando…" : "Criar torneio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
