// C:\Users\rafae\arqueoapp\src\app\(admin)\admin\perguntas\page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  doc,
  updateDoc,
  deleteDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

type Difficulty = "easy" | "medium" | "hard";
type DifficultyFilter = Difficulty | "all";

type Question = {
  id: string;
  text: string;
  choices: string[];
  correctIndex: number;
  difficulty: Difficulty;
  active: boolean;
};

type ImportError = { row: number; field: string; message: string };

type ImportResponseOk = {
  ok: true;
  imported: number;
  totalRows: number;
  validDocs: number;
  errors: ImportError[];
};

type ImportResponseFail = {
  ok: false;
  error: string;
  detail?: string;
};

const IMPORT_ENDPOINT = "/api/quiz/import"; // ajuste aqui se mover para /api/admin/quiz/import

function asDifficulty(v: unknown): Difficulty {
  return v === "hard" ? "hard" : v === "medium" ? "medium" : "easy";
}

function getErrMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  if (typeof e === "string") return e;
  return "Falha";
}

function parseQuestionDoc(d: QueryDocumentSnapshot<DocumentData>): Question {
  const data = d.data() as {
    text?: unknown;
    choices?: unknown;
    correctIndex?: unknown;
    difficulty?: unknown;
    active?: unknown;
  };

  const text = typeof data.text === "string" ? data.text : "";
  const choices = Array.isArray(data.choices) ? data.choices.map(String) : [];
  const correctIndex =
    Number.isFinite(Number(data.correctIndex)) && Number(data.correctIndex) >= 0
      ? Number(data.correctIndex)
      : 0;
  const difficulty = asDifficulty(data.difficulty);
  const active = typeof data.active === "boolean" ? data.active : true;

  return { id: d.id, text, choices, correctIndex, difficulty, active };
}

function downloadTemplateCsv() {
  // Modelo simples em CSV (abre no Excel e pode salvar como .xlsx)
  const header = [
    "text",
    "choice1",
    "choice2",
    "choice3",
    "choice4",
    "correct",
    "difficulty",
    "active",
  ].join(",");

  const sample1 = [
    `"Qual técnica arqueológica é mais usada para determinar a idade de materiais orgânicos?"`,
    `"Datação por radiocarbono (Carbono-14)"`,
    `"Termoluminescência"`,
    `"Dendrocronologia"`,
    `"Datação por potássio-argônio"`,
    "1",
    "easy",
    "true",
  ].join(",");

  const sample2 = [
    `"O que é estratigrafia em arqueologia?"`,
    `"O estudo das camadas de solo e deposição para interpretar a sequência temporal de um sítio"`,
    `"A técnica de restaurar cerâmicas antigas com resina moderna"`,
    `"O método de identificar DNA antigo em esqueletos"`,
    `"A análise do clima histórico por anéis de árvores"`,
    "1",
    "medium",
    "true",
  ].join(",");

  const csv = [header, sample1, sample2].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_import_quiz_questions.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseImportResponse(
  data: unknown
): ImportResponseOk | ImportResponseFail {
  if (!isRecord(data)) return { ok: false, error: "Resposta inválida da API" };

  const ok = data.ok === true;
  if (!ok) {
    const msg =
      typeof data.error === "string" ? data.error : "Falha na importação";
    const detail = typeof data.detail === "string" ? data.detail : undefined;
    return { ok: false, error: msg, detail };
  }

  const imported = Number(data.imported ?? 0);
  const totalRows = Number(data.totalRows ?? 0);
  const validDocs = Number(data.validDocs ?? 0);

  const errorsRaw = data.errors;
  const errors: ImportError[] = Array.isArray(errorsRaw)
    ? errorsRaw
        .map((x) => (isRecord(x) ? x : null))
        .filter((x): x is Record<string, unknown> => !!x)
        .map((x) => ({
          row: Number(x.row ?? 0),
          field: String(x.field ?? ""),
          message: String(x.message ?? ""),
        }))
    : [];

  return {
    ok: true,
    imported: Number.isFinite(imported) ? imported : 0,
    totalRows: Number.isFinite(totalRows) ? totalRows : 0,
    validDocs: Number.isFinite(validDocs) ? validDocs : 0,
    errors,
  };
}

export default function AdminPerguntasPage() {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  const ready = useMemo(() => !loading, [loading]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [items, setItems] = useState<Question[]>([]);

  // create form
  const [text, setText] = useState("");
  const [c0, setC0] = useState("");
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [diff, setDiff] = useState<Difficulty>("easy");
  const [active, setActive] = useState(true);

  // edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eText, setEText] = useState("");
  const [e0, setE0] = useState("");
  const [e1, setE1] = useState("");
  const [e2, setE2] = useState("");
  const [e3, setE3] = useState("");
  const [eCorrectIndex, setECorrectIndex] = useState(0);
  const [eDiff, setEDiff] = useState<Difficulty>("easy");
  const [eActive, setEActive] = useState(true);

  // import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponseOk | null>(
    null
  );

  const uiBusy = busy || importBusy;

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role !== "admin") {
      router.replace("/perfil");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, role]);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const base = collection(db, "quiz_questions");

      const qy =
        difficulty === "all"
          ? query(base, orderBy("difficulty"), orderBy("text"), limit(200))
          : query(
              base,
              where("difficulty", "==", difficulty),
              orderBy("text"),
              limit(200)
            );

      const snap = await getDocs(qy);
      setItems(snap.docs.map(parseQuestionDoc));
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function createOne() {
    setBusy(true);
    setErr(null);
    try {
      const t = text.trim();
      const choices = [c0, c1, c2, c3].map((v) => v.trim());

      if (!t) throw new Error("Texto é obrigatório");
      if (choices.some((v) => !v))
        throw new Error("Preencha as 4 alternativas");
      if (correctIndex < 0 || correctIndex > 3)
        throw new Error("Correta inválida (0–3)");

      await addDoc(collection(db, "quiz_questions"), {
        text: t,
        choices,
        correctIndex,
        difficulty: diff,
        active,
        createdAt: serverTimestamp(),
      });

      // reset form
      setText("");
      setC0("");
      setC1("");
      setC2("");
      setC3("");
      setCorrectIndex(0);
      setDiff("easy");
      setActive(true);

      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
    }
  }
  function pad4(arr: string[]) {
    return [arr[0] ?? "", arr[1] ?? "", arr[2] ?? "", arr[3] ?? ""];
  }

  function startEdit(q: Question) {
    const [p0, p1, p2, p3] = pad4(q.choices);
    setEditingId(q.id);
    setEText(q.text);
    setE0(p0);
    setE1(p1);
    setE2(p2);
    setE3(p3);
    setECorrectIndex(q.correctIndex ?? 0);
    setEDiff(q.difficulty ?? "easy");
    setEActive(q.active ?? true);
  }

  function cancelEdit() {
    setEditingId(null);
    setEText("");
    setE0("");
    setE1("");
    setE2("");
    setE3("");
    setECorrectIndex(0);
    setEDiff("easy");
    setEActive(true);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setErr(null);

    try {
      const t = eText.trim();
      const choices = [e0, e1, e2, e3].map((v) => v.trim());

      if (!t) throw new Error("Texto é obrigatório");
      if (choices.some((v) => !v))
        throw new Error("Preencha as 4 alternativas");
      if (eCorrectIndex < 0 || eCorrectIndex > 3)
        throw new Error("Correta inválida (0–3)");

      const ref = doc(db, "quiz_questions", id);
      await updateDoc(ref, {
        text: t,
        choices,
        correctIndex: eCorrectIndex,
        difficulty: eDiff,
        active: eActive,
        updatedAt: serverTimestamp(),
      });

      cancelEdit();
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setBusy(true);
    setErr(null);

    try {
      const ref = doc(db, "quiz_questions", id);
      await updateDoc(ref, { active: next, updatedAt: serverTimestamp() });
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: string) {
    const ok = confirm(
      "Tem certeza que deseja excluir esta pergunta? Essa ação não pode ser desfeita."
    );
    if (!ok) return;

    setBusy(true);
    setErr(null);

    try {
      const ref = doc(db, "quiz_questions", id);
      await deleteDoc(ref);

      if (editingId === id) cancelEdit();
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function importXlsx() {
    setImportBusy(true);
    setErr(null);
    setImportResult(null);

    try {
      if (!importFile) throw new Error("Selecione um arquivo .xlsx primeiro");
      if (!user) throw new Error("Não autenticado");

      const token = await user.getIdToken(true);

      const fd = new FormData();
      fd.append("file", importFile);

      const res = await fetch(IMPORT_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const raw = await res.text();

      if (!raw) {
        throw new Error(
          `Resposta vazia do servidor (HTTP ${res.status}). Veja o terminal do Next.`
        );
      }

      let data: unknown;
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        throw new Error(
          `Resposta não-JSON do servidor (HTTP ${
            res.status
          }). Início: ${raw.slice(0, 120)}`
        );
      }
      const parsed = parseImportResponse(data);

      if (!res.ok || !parsed.ok) {
        if (!parsed.ok && parsed.detail) {
          throw new Error(`${parsed.error}: ${parsed.detail}`);
        }
        throw new Error(parsed.ok ? "Falha na importação" : parsed.error);
      }

      setImportResult(parsed);
      setImportFile(null);

      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setImportBusy(false);
    }
  }

  if (!ready) return <main className="p-6">Carregando…</main>;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin • Perguntas do Quiz</h1>
        <button className="underline" onClick={() => router.push("/admin")}>
          Voltar
        </button>
      </div>

      <div className="mt-6 flex gap-3 items-center flex-wrap">
        <label className="text-sm opacity-80">Filtro:</label>
        <select
          className="border rounded px-3 py-2"
          value={difficulty}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "easy" || v === "medium" || v === "hard" || v === "all") {
              setDifficulty(v);
            }
          }}
          disabled={uiBusy}
        >
          <option value="all">Todas</option>
          <option value="easy">Fácil</option>
          <option value="medium">Média</option>
          <option value="hard">Difícil</option>
        </select>

        <button
          className="border rounded px-4 py-2"
          onClick={load}
          disabled={uiBusy}
        >
          {busy ? "Carregando…" : "Recarregar"}
        </button>

        <button
          className="border rounded px-4 py-2"
          onClick={downloadTemplateCsv}
          disabled={uiBusy}
        >
          Baixar modelo (CSV)
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border rounded p-4">
          <h2 className="font-medium">Operações</h2>

          {/* Importação */}
          <div className="mt-4 border rounded p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">Importar em massa (Excel)</div>
                <div className="text-xs opacity-70 mt-1">
                  Cabeçalho:{" "}
                  <code>
                    text, choice1..choice4, correct(1-4), difficulty, active
                  </code>
                  <br />
                  difficulty: <code>easy|medium|hard</code> (aceita
                  Fácil/Médio/Difícil se sua API normalizar)
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                disabled={uiBusy}
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />

              <button
                className="border rounded px-4 py-2"
                onClick={importXlsx}
                disabled={uiBusy || !importFile}
              >
                {importBusy ? "Importando…" : "Importar"}
              </button>
            </div>

            {importResult && (
              <div className="mt-3 text-sm">
                <div>
                  Importadas: <b>{importResult.imported}</b> • Linhas:{" "}
                  {importResult.totalRows} • Válidas: {importResult.validDocs}
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium">
                      Erros ({importResult.errors.length})
                    </div>
                    <ul className="mt-1 list-disc pl-5 space-y-1">
                      {importResult.errors.slice(0, 25).map((er, i) => (
                        <li key={i}>
                          Linha {er.row} • {er.field}: {er.message}
                        </li>
                      ))}
                    </ul>
                    {importResult.errors.length > 25 && (
                      <div className="text-xs opacity-70 mt-2">
                        Mostrando 25 primeiros erros…
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Criar pergunta */}
          <div className="mt-6">
            <h3 className="font-medium">Criar pergunta</h3>

            <div className="mt-3 space-y-2">
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Texto da pergunta"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={uiBusy}
              />

              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Alternativa 1"
                value={c0}
                onChange={(e) => setC0(e.target.value)}
                disabled={uiBusy}
              />
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Alternativa 2"
                value={c1}
                onChange={(e) => setC1(e.target.value)}
                disabled={uiBusy}
              />
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Alternativa 3"
                value={c2}
                onChange={(e) => setC2(e.target.value)}
                disabled={uiBusy}
              />
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Alternativa 4"
                value={c3}
                onChange={(e) => setC3(e.target.value)}
                disabled={uiBusy}
              />

              <div className="flex gap-3 flex-wrap">
                <select
                  className="border rounded px-3 py-2"
                  value={correctIndex}
                  onChange={(e) => setCorrectIndex(Number(e.target.value))}
                  disabled={uiBusy}
                >
                  <option value={0}>Correta: 1</option>
                  <option value={1}>Correta: 2</option>
                  <option value={2}>Correta: 3</option>
                  <option value={3}>Correta: 4</option>
                </select>

                <select
                  className="border rounded px-3 py-2"
                  value={diff}
                  onChange={(e) => setDiff(asDifficulty(e.target.value))}
                  disabled={uiBusy}
                >
                  <option value="easy">Fácil</option>
                  <option value="medium">Média</option>
                  <option value="hard">Difícil</option>
                </select>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    disabled={uiBusy}
                  />
                  Ativa
                </label>
              </div>

              <button
                className="border rounded px-4 py-2"
                onClick={createOne}
                disabled={uiBusy}
              >
                {busy ? "Salvando…" : "Salvar pergunta"}
              </button>
            </div>
          </div>
        </section>

        <section className="border rounded p-4">
          <h2 className="font-medium">Perguntas ({items.length})</h2>

          <div className="mt-3 space-y-3 max-h-[70vh] overflow-auto pr-2">
            {items.map((q) => {
              const isEditing = editingId === q.id;

              return (
                <div key={q.id} className="border rounded p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs opacity-70">
                      {q.difficulty.toUpperCase()} •{" "}
                      {q.active ? "ATIVA" : "INATIVA"}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {!isEditing ? (
                        <>
                          <button
                            className="border rounded px-3 py-1 text-sm"
                            onClick={() => startEdit(q)}
                            disabled={uiBusy}
                          >
                            Editar
                          </button>

                          <button
                            className="border rounded px-3 py-1 text-sm"
                            onClick={() => toggleActive(q.id, !q.active)}
                            disabled={uiBusy}
                            title="Ativa/Desativa sem excluir"
                          >
                            {q.active ? "Desativar" : "Ativar"}
                          </button>

                          <button
                            className="border rounded px-3 py-1 text-sm text-red-600 border-red-300"
                            onClick={() => deleteOne(q.id)}
                            disabled={uiBusy}
                          >
                            Excluir
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="border rounded px-3 py-1 text-sm"
                            onClick={() => saveEdit(q.id)}
                            disabled={uiBusy}
                          >
                            Salvar
                          </button>

                          <button
                            className="border rounded px-3 py-1 text-sm"
                            onClick={cancelEdit}
                            disabled={uiBusy}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing ? (
                    <>
                      <div className="mt-1 font-medium">{q.text}</div>
                      <ol className="mt-2 text-sm list-decimal pl-5 space-y-1">
                        {q.choices.map((c, i) => (
                          <li
                            key={i}
                            className={i === q.correctIndex ? "underline" : ""}
                          >
                            {c}
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <input
                        className="w-full border rounded px-3 py-2"
                        value={eText}
                        onChange={(e) => setEText(e.target.value)}
                        disabled={uiBusy}
                        placeholder="Texto da pergunta"
                      />

                      <input
                        className="w-full border rounded px-3 py-2"
                        value={e0}
                        onChange={(e) => setE0(e.target.value)}
                        disabled={uiBusy}
                        placeholder="Alternativa 1"
                      />
                      <input
                        className="w-full border rounded px-3 py-2"
                        value={e1}
                        onChange={(e) => setE1(e.target.value)}
                        disabled={uiBusy}
                        placeholder="Alternativa 2"
                      />
                      <input
                        className="w-full border rounded px-3 py-2"
                        value={e2}
                        onChange={(e) => setE2(e.target.value)}
                        disabled={uiBusy}
                        placeholder="Alternativa 3"
                      />
                      <input
                        className="w-full border rounded px-3 py-2"
                        value={e3}
                        onChange={(e) => setE3(e.target.value)}
                        disabled={uiBusy}
                        placeholder="Alternativa 4"
                      />

                      <div className="flex gap-3 flex-wrap">
                        <select
                          className="border rounded px-3 py-2"
                          value={eCorrectIndex}
                          onChange={(e) =>
                            setECorrectIndex(Number(e.target.value))
                          }
                          disabled={uiBusy}
                        >
                          <option value={0}>Correta: 1</option>
                          <option value={1}>Correta: 2</option>
                          <option value={2}>Correta: 3</option>
                          <option value={3}>Correta: 4</option>
                        </select>

                        <select
                          className="border rounded px-3 py-2"
                          value={eDiff}
                          onChange={(e) =>
                            setEDiff(asDifficulty(e.target.value))
                          }
                          disabled={uiBusy}
                        >
                          <option value="easy">Fácil</option>
                          <option value="medium">Média</option>
                          <option value="hard">Difícil</option>
                        </select>

                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={eActive}
                            onChange={(e) => setEActive(e.target.checked)}
                            disabled={uiBusy}
                          />
                          Ativa
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {items.length === 0 && (
              <p className="text-sm opacity-70">Nenhuma pergunta.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
