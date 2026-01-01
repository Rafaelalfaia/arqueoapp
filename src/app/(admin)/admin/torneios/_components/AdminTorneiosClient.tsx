// C:\Users\rafae\arqueoapp\src\app\(admin)\admin\torneios\_components\AdminTorneiosClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

type TournamentType = "recurring" | "special";

type Tab = "all" | "recurring" | "special";

type ListItem = {
  id: string;
  title: string;
  type: TournamentType;
  status?: string;
  questionCount?: number;
  maxParticipants?: number;
  startAtMs?: number;
  coverUrl?: string;
};

const FALLBACK_COVER = "/covers/tournaments/fallback.jpg"; // coloque no /public

/** ============================
 * Helpers (sem any, sem null)
 * ============================ */
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

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function buildNonJsonError(res: Response, ct: string, bodyText: string): Error {
  return new Error(
    [
      "API não retornou JSON.",
      `status=${res.status}`,
      `redirected=${res.redirected}`,
      `url=${res.url}`,
      `content-type=${ct}`,
      `body[0..200]=${JSON.stringify(bodyText.slice(0, 200))}`,
    ].join(" | ")
  );
}

async function readJsonOrThrow(
  res: Response
): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!ct.includes("application/json")) {
    throw buildNonJsonError(res, ct, text);
  }

  const parsed = safeJsonParse(text);
  if (!parsed || !isRecord(parsed)) {
    throw new Error(
      `JSON inválido. body[0..200]=${JSON.stringify(text.slice(0, 200))}`
    );
  }

  // Se backend retornar { error }, respeita.
  if (!res.ok) {
    const msg = readString(parsed, "error");
    throw new Error(msg ?? `Falha HTTP (${res.status})`);
  }

  return parsed;
}

/** ============================
 * Component
 * ============================ */
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

  // upload cover
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");

  const canCreate = useMemo(() => {
    if (!user) return false;
    if (title.trim().length < 3) return false;
    if (!(questionCount >= 1)) return false;
    if (type === "recurring" && !(maxParticipants >= 2)) return false;
    if (type === "special" && startAtLocal.trim().length < 8) return false;
    if (!coverFile) return false;
    return true;
  }, [
    user,
    title,
    questionCount,
    type,
    maxParticipants,
    startAtLocal,
    coverFile,
  ]);

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

      const res = await fetch("/api/tournament/list", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await readJsonOrThrow(res);

      const rawArr = (json.tournaments ?? json.items) as unknown;
      if (!Array.isArray(rawArr)) throw new Error("RESPOSTA_INVALIDA");

      const parsed: ListItem[] = [];
      for (const it of rawArr) {
        if (!isRecord(it)) continue;

        const id = readString(it, "id") ?? readString(it, "tournamentId");
        const ttl = readString(it, "title");
        const tp = coerceType(it["type"]);
        if (!id || !ttl || !tp) continue;

        parsed.push({
          id,
          title: ttl,
          type: tp,
          status: readString(it, "status"),
          questionCount: readNumber(it, "questionCount"),
          maxParticipants: readNumber(it, "maxParticipants"),
          startAtMs: readNumber(it, "startAtMs"),
          coverUrl: readString(it, "coverUrl"),
        });
      }

      setItems(parsed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingList(false);
    }
  }, [user, getToken]);

  // carrega lista quando tiver user
  useEffect(() => {
    if (!user) return;
    void loadList();
  }, [user, loadList]);

  // preview da imagem (limpa objectURL)
  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const onPickCover = useCallback((file: File | null) => {
    setError("");

    if (!file) {
      setCoverFile(null);
      return;
    }

    const okTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) {
      setError("Formato inválido. Envie JPG, PNG ou WEBP.");
      setCoverFile(null);
      return;
    }

    const maxBytes = 4 * 1024 * 1024; // 4MB
    if (file.size > maxBytes) {
      setError("Arquivo muito grande. Máximo: 4MB.");
      setCoverFile(null);
      return;
    }

    setCoverFile(file);
  }, []);

  const onCreate = useCallback(async (): Promise<void> => {
    setError("");
    if (!canCreate) return;

    if (!user) {
      setError("UNAUTHENTICATED");
      return;
    }

    if (!coverFile) {
      setError("Selecione uma imagem de capa.");
      return;
    }

    setLoadingCreate(true);

    try {
      const token = await getToken();

      const fd = new FormData();
      fd.set("type", type);
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("questionCount", String(questionCount));
      fd.set("entryFeeDiamonds", String(entryFeeDiamonds));
      fd.set("prizePoolDiamonds", String(prizePoolDiamonds));

      if (type === "recurring") {
        fd.set("maxParticipants", String(maxParticipants));
      } else {
        fd.set("startAt", new Date(startAtLocal).toISOString());
      }

      fd.set("cover", coverFile, coverFile.name);

      const res = await fetch("/api/tournament/admin/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // NÃO setar Content-Type (o browser define boundary do multipart)
        },
        body: fd,
      });

      await readJsonOrThrow(res);

      // reset
      setType("recurring");
      setTitle("");
      setDescription("");
      setQuestionCount(10);
      setMaxParticipants(20);
      setStartAtLocal("");
      setEntryFeeDiamonds(0);
      setPrizePoolDiamonds(0);
      setCoverFile(null);

      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingCreate(false);
    }
  }, [
    canCreate,
    user,
    coverFile,
    getToken,
    type,
    title,
    description,
    questionCount,
    entryFeeDiamonds,
    prizePoolDiamonds,
    maxParticipants,
    startAtLocal,
    loadList,
  ]);

  return (
    <div className="grid gap-4">
      {/* Banner */}
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
            disabled={loadingList || !user}
            title={!user ? "Faça login para carregar" : undefined}
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
        {/* Lista */}
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
            {filtered.map((t) => {
              const img = t.coverUrl?.trim() ? t.coverUrl : FALLBACK_COVER;

              return (
                <div
                  key={t.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-black/50"
                >
                  <div className="relative">
                    <div
                      className="h-24 w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${img})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute right-3 top-3">
                      <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs">
                        {t.type === "recurring" ? "Recorrente" : "Especial"}
                      </span>
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
                        {t.type === "recurring"
                          ? t.maxParticipants ?? "-"
                          : "-"}
                      </div>
                      <div>
                        Início:{" "}
                        {t.type === "special" ? formatDate(t.startAtMs) : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

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
            {/* Upload da capa */}
            <label className="grid gap-1">
              <span className="text-sm opacity-80">
                Imagem de capa (obrigatório)
              </span>
              <input
                className="rounded-lg border border-white/10 bg-black/60 p-2 text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
              />

              <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                <div
                  className="h-24 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${
                      coverPreviewUrl || FALLBACK_COVER
                    })`,
                  }}
                />
              </div>

              <div className="text-xs opacity-70">JPG/PNG/WEBP, até 4MB.</div>
            </label>

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
              title={!user ? "Faça login como admin" : undefined}
            >
              {loadingCreate ? "Criando…" : "Criar torneio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
