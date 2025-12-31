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
  where,
  serverTimestamp,
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

function asDifficulty(v: unknown): Difficulty {
  return v === "hard" ? "hard" : v === "medium" ? "medium" : "easy";
}

function getErrMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
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
  const correctIndex = Number.isFinite(Number(data.correctIndex))
    ? Number(data.correctIndex)
    : 0;
  const difficulty = asDifficulty(data.difficulty);
  const active = typeof data.active === "boolean" ? data.active : true;

  return { id: d.id, text, choices, correctIndex, difficulty, active };
}

export default function AdminPerguntasPage() {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [items, setItems] = useState<Question[]>([]);

  // form
  const [text, setText] = useState("");
  const [c0, setC0] = useState("");
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [diff, setDiff] = useState<Difficulty>("easy");
  const [active, setActive] = useState(true);

  const ready = useMemo(() => !loading, [loading]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return router.replace("/login");
    if (role !== "admin") return router.replace("/perfil");
    load();
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
      const choices = [c0, c1, c2, c3].map((v) => v.trim());
      if (!text.trim()) throw new Error("Texto é obrigatório");
      if (choices.some((v) => !v))
        throw new Error("Preencha as 4 alternativas");
      if (correctIndex < 0 || correctIndex > 3)
        throw new Error("correctIndex inválido (0-3)");

      await addDoc(collection(db, "quiz_questions"), {
        text: text.trim(),
        choices,
        correctIndex,
        difficulty: diff,
        active,
        createdAt: serverTimestamp(),
      });

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

  if (!ready) return <main className="p-6">Carregando…</main>;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin • Perguntas do Quiz</h1>
        <button className="underline" onClick={() => router.push("/admin")}>
          Voltar
        </button>
      </div>

      <div className="mt-6 flex gap-3 items-center">
        <label className="text-sm opacity-80">Filtro:</label>
        <select
          className="border rounded px-3 py-2"
          value={difficulty}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "easy" || v === "medium" || v === "hard" || v === "all")
              setDifficulty(v);
          }}
          disabled={busy}
        >
          <option value="all">Todas</option>
          <option value="easy">Fácil</option>
          <option value="medium">Média</option>
          <option value="hard">Difícil</option>
        </select>

        <button
          className="border rounded px-4 py-2"
          onClick={load}
          disabled={busy}
        >
          {busy ? "Carregando…" : "Recarregar"}
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border rounded p-4">
          <h2 className="font-medium">Criar pergunta</h2>

          <div className="mt-3 space-y-2">
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Texto da pergunta"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />

            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Alternativa 1"
              value={c0}
              onChange={(e) => setC0(e.target.value)}
              disabled={busy}
            />
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Alternativa 2"
              value={c1}
              onChange={(e) => setC1(e.target.value)}
              disabled={busy}
            />
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Alternativa 3"
              value={c2}
              onChange={(e) => setC2(e.target.value)}
              disabled={busy}
            />
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Alternativa 4"
              value={c3}
              onChange={(e) => setC3(e.target.value)}
              disabled={busy}
            />

            <div className="flex gap-3 flex-wrap">
              <select
                className="border rounded px-3 py-2"
                value={correctIndex}
                onChange={(e) => setCorrectIndex(Number(e.target.value))}
                disabled={busy}
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
                disabled={busy}
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
                  disabled={busy}
                />
                Ativa
              </label>
            </div>

            <button
              className="border rounded px-4 py-2"
              onClick={createOne}
              disabled={busy}
            >
              {busy ? "Salvando…" : "Salvar pergunta"}
            </button>
          </div>
        </section>

        <section className="border rounded p-4">
          <h2 className="font-medium">Perguntas ({items.length})</h2>
          <div className="mt-3 space-y-3 max-h-[70vh] overflow-auto pr-2">
            {items.map((q) => (
              <div key={q.id} className="border rounded p-3">
                <div className="text-xs opacity-70">
                  {q.difficulty.toUpperCase()} •{" "}
                  {q.active ? "ATIVA" : "INATIVA"}
                </div>
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
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm opacity-70">Nenhuma pergunta.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
