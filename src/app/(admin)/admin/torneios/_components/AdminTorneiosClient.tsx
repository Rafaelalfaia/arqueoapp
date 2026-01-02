"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

type TournamentType = "recurring" | "special";
type Tab = "all" | "recurring" | "special";
type Mode = "create" | "edit";

type ListItem = {
  id: string;
  title: string;
  type: TournamentType;
  status?: string;
  description?: string;
  questionCount?: number;
  maxParticipants?: number;
  startAtMs?: number;
  coverUrl?: string;
  entryFeeDiamonds?: number;
  prizePoolDiamonds?: number;
};

const FALLBACK_COVER = "/covers/tournaments/fallback.jpg"; // precisa existir no /public

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

  if (!ct.includes("application/json")) throw buildNonJsonError(res, ct, text);

  const parsed = safeJsonParse(text);
  if (!parsed || !isRecord(parsed)) {
    throw new Error(
      `JSON inválido. body[0..200]=${JSON.stringify(text.slice(0, 200))}`
    );
  }

  if (!res.ok) {
    const msg = readString(parsed, "error");
    throw new Error(msg ?? `Falha HTTP (${res.status})`);
  }

  return parsed;
}

function toLocalInputValue(ms: number): string {
  // datetime-local espera horário local
  const d = new Date(ms);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(ms - tz).toISOString().slice(0, 16);
}

function isoFromLocalInput(v: string): string {
  const d = new Date(v);
  const t = d.getTime();
  if (!Number.isFinite(t)) throw new Error("Data/Hora inválida");
  return d.toISOString();
}

export default function AdminTorneiosClient() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<ListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<string>("");

  const [busyId, setBusyId] = useState<string>(""); // trava botões por item
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string>("");

  // form (reutilizado para create/edit)
  const [type, setType] = useState<TournamentType>("recurring");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [startAtLocal, setStartAtLocal] = useState(""); // datetime-local
  const [entryFeeDiamonds, setEntryFeeDiamonds] = useState(0);
  const [prizePoolDiamonds, setPrizePoolDiamonds] = useState(0);

  // cover (create obrigatório, edit opcional)
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [existingCoverUrl, setExistingCoverUrl] = useState<string>("");

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
      const rawArr = (json.items ?? json.tournaments) as unknown;
      if (!Array.isArray(rawArr)) {
        console.error("Payload inesperado:", json);
        throw new Error("RESPOSTA_INVALIDA");
      }

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
          description: readString(it, "description"),
          questionCount: readNumber(it, "questionCount"),
          maxParticipants: readNumber(it, "maxParticipants"),
          startAtMs: readNumber(it, "startAtMs"),
          coverUrl: readString(it, "coverUrl"),
          entryFeeDiamonds: readNumber(it, "entryFeeDiamonds") ?? 0,
          prizePoolDiamonds: readNumber(it, "prizePoolDiamonds") ?? 0,
        });
      }

      setItems(parsed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingList(false);
    }
  }, [user, getToken]);

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

  const resetToCreate = useCallback(() => {
    setMode("create");
    setEditingId("");
    setType("recurring");
    setTitle("");
    setDescription("");
    setQuestionCount(10);
    setMaxParticipants(20);
    setStartAtLocal("");
    setEntryFeeDiamonds(0);
    setPrizePoolDiamonds(0);
    setCoverFile(null);
    setExistingCoverUrl("");
  }, []);

  const onStartEdit = useCallback((t: ListItem) => {
    setError("");
    setMode("edit");
    setEditingId(t.id);

    setType(t.type); // travado na UI durante edição
    setTitle(t.title);
    setDescription(t.description ?? "");
    setQuestionCount(t.questionCount ?? 10);
    setEntryFeeDiamonds(t.entryFeeDiamonds ?? 0);
    setPrizePoolDiamonds(t.prizePoolDiamonds ?? 0);

    if (t.type === "recurring") {
      setMaxParticipants(t.maxParticipants ?? 20);
      setStartAtLocal("");
    } else {
      const ms = t.startAtMs ?? 0;
      setStartAtLocal(ms > 0 ? toLocalInputValue(ms) : "");
      setMaxParticipants(20);
    }

    setExistingCoverUrl((t.coverUrl ?? "").trim());
    setCoverFile(null);
  }, []);

  const canSubmit = useMemo(() => {
    if (!user) return false;
    if (title.trim().length < 3) return false;
    if (!(questionCount >= 1)) return false;
    if (type === "recurring" && !(maxParticipants >= 2)) return false;
    if (type === "special" && startAtLocal.trim().length < 8) return false;
    if (mode === "create" && !coverFile) return false;
    return true;
  }, [
    user,
    title,
    questionCount,
    type,
    maxParticipants,
    startAtLocal,
    coverFile,
    mode,
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

  const onSubmit = useCallback(async () => {
    setError("");
    if (!canSubmit) return;

    try {
      const token = await getToken();

      const fd = new FormData();
      fd.set("title", title.trim());

      const desc = description.trim();
      fd.set("description", desc); // vazio => backend remove

      fd.set("questionCount", String(questionCount));
      fd.set("entryFeeDiamonds", String(entryFeeDiamonds));
      fd.set("prizePoolDiamonds", String(prizePoolDiamonds));

      if (type === "recurring") {
        fd.set("maxParticipants", String(maxParticipants));
      } else {
        fd.set("startAt", isoFromLocalInput(startAtLocal));
      }

      if (mode === "create") {
        if (!coverFile) throw new Error("Selecione uma imagem de capa.");
        fd.set("type", type);
        fd.set("cover", coverFile, coverFile.name);

        setLoadingSubmit(true);
        const res = await fetch("/api/tournament/admin/create", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        await readJsonOrThrow(res);
        resetToCreate();
      } else {
        // edit
        fd.set("tournamentId", editingId);

        // capa opcional
        if (coverFile) fd.set("cover", coverFile, coverFile.name);

        setLoadingSubmit(true);
        const res = await fetch("/api/tournament/admin/update", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        await readJsonOrThrow(res);
        resetToCreate();
      }

      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingSubmit(false);
    }
  }, [
    canSubmit,
    getToken,
    mode,
    editingId,
    type,
    title,
    description,
    questionCount,
    entryFeeDiamonds,
    prizePoolDiamonds,
    maxParticipants,
    startAtLocal,
    coverFile,
    loadList,
    resetToCreate,
  ]);

  const onDelete = useCallback(
    async (t: ListItem) => {
      setError("");
      if (!user) return;

      const ok = window.confirm(
        `Apagar o torneio "${t.title}"?\n\nID: ${t.id}`
      );
      if (!ok) return;

      setBusyId(t.id);
      try {
        const token = await getToken();
        const res = await fetch("/api/tournament/admin/delete", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tournamentId: t.id }),
        });

        await readJsonOrThrow(res);

        // se estava editando esse item, sai da edição
        if (mode === "edit" && editingId === t.id) resetToCreate();

        await loadList();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        setBusyId("");
      }
    },
    [user, getToken, loadList, mode, editingId, resetToCreate]
  );

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
              const isEditing = mode === "edit" && editingId === t.id;
              const img = (t.coverUrl ?? "").trim() || FALLBACK_COVER;

              return (
                <div
                  key={t.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-black/50"
                >
                  <div className="relative h-24 w-full overflow-hidden bg-gradient-to-r from-emerald-900/30 via-black/30 to-black/60">
                    <img
                      src={img}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-90"
                      onError={(e) => {
                        // se quebrar até o fallback, esconde a tag e deixa o gradiente de fundo
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    <div className="absolute left-3 top-3 flex gap-2">
                      {isEditing ? (
                        <span className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs">
                          Editando
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute right-3 top-3">
                      <span className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs">
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

                    <div className="mt-4 flex gap-2">
                      <button
                        className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm disabled:opacity-50"
                        onClick={() => onStartEdit(t)}
                        disabled={
                          !user ||
                          busyId === t.id ||
                          loadingSubmit ||
                          loadingList
                        }
                        title={!user ? "Faça login como admin" : undefined}
                      >
                        Editar
                      </button>

                      <button
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm disabled:opacity-50"
                        onClick={() => void onDelete(t)}
                        disabled={
                          !user ||
                          busyId === t.id ||
                          loadingSubmit ||
                          loadingList
                        }
                        title={!user ? "Faça login como admin" : undefined}
                      >
                        {busyId === t.id ? "Apagando…" : "Apagar"}
                      </button>
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

        {/* Form (Create/Edit) */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">
                {mode === "create" ? "Criar torneio" : "Editar torneio"}
              </div>
              <div className="mt-1 text-sm opacity-80">
                Split fixo 50/30/20 (sem edição).
              </div>
            </div>

            {mode === "edit" ? (
              <button
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                onClick={resetToCreate}
                disabled={loadingSubmit}
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            {/* Upload da capa */}
            <label className="grid gap-1">
              <span className="text-sm opacity-80">
                Imagem de capa{" "}
                {mode === "create" ? "(obrigatório)" : "(opcional na edição)"}
              </span>
              <input
                className="rounded-lg border border-white/10 bg-black/60 p-2 text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
              />

              <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                <div className="relative h-24 w-full bg-gradient-to-r from-emerald-900/30 via-black/30 to-black/60">
                  <img
                    src={coverPreviewUrl || existingCoverUrl || FALLBACK_COVER}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-90"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                </div>
              </div>

              <div className="text-xs opacity-70">JPG/PNG/WEBP, até 4MB.</div>
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-80">Tipo</span>
              <select
                className="rounded-lg border border-white/10 bg-black/60 p-2 disabled:opacity-60"
                value={type}
                disabled={mode === "edit"} // trava na edição
                onChange={(e) =>
                  setType(
                    e.target.value === "special" ? "special" : "recurring"
                  )
                }
              >
                <option value="recurring">Recorrente</option>
                <option value="special">Especial</option>
              </select>
              {mode === "edit" ? (
                <div className="text-xs opacity-70">
                  Na edição, o tipo fica travado para evitar inconsistências.
                </div>
              ) : null}
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
                placeholder="Regras/tema/premiação (vazio remove na edição)"
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
              disabled={loadingSubmit || !canSubmit}
              onClick={() => void onSubmit()}
              title={!user ? "Faça login como admin" : undefined}
            >
              {loadingSubmit
                ? mode === "create"
                  ? "Criando…"
                  : "Salvando…"
                : mode === "create"
                ? "Criar torneio"
                : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
