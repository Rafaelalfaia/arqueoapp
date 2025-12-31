"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

type Difficulty = "easy" | "medium" | "hard";

type Q = {
  id: string;
  text: string;
  choices: string[];
  difficulty: Difficulty;
  points: number;
};

type StartOk = {
  sessionId: string;
  mode: string;
  questions: Q[];
};

type SubmitOk = {
  score: number;
  correctCount: number;
  totalQuestions: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

function isQ(v: unknown): v is Q {
  if (!isRecord(v)) return false;

  const { id, text, choices, difficulty, points } = v;

  return (
    typeof id === "string" &&
    typeof text === "string" &&
    Array.isArray(choices) &&
    choices.every((c) => typeof c === "string") &&
    isDifficulty(difficulty) &&
    typeof points === "number" &&
    Number.isFinite(points)
  );
}

function parseStartOk(data: unknown): StartOk {
  if (!isRecord(data)) throw new Error("Resposta inválida do servidor.");

  const sessionId = data.sessionId;
  const mode = data.mode;
  const questions = data.questions;

  if (typeof sessionId !== "string" || typeof mode !== "string") {
    throw new Error("Resposta inválida do servidor (session/mode).");
  }

  if (!Array.isArray(questions)) {
    throw new Error("Resposta inválida do servidor (questions).");
  }

  const typed = questions.filter(isQ);
  if (typed.length === 0) {
    throw new Error("Servidor retornou lista de perguntas vazia.");
  }

  return { sessionId, mode, questions: typed };
}

function parseSubmitOk(data: unknown): SubmitOk {
  if (!isRecord(data)) throw new Error("Resposta inválida do servidor.");

  const score = Number(data.score ?? 0);
  const correctCount = Number(data.correctCount ?? 0);
  const totalQuestions = Number(data.totalQuestions ?? 0);

  if (
    !Number.isFinite(score) ||
    !Number.isFinite(correctCount) ||
    !Number.isFinite(totalQuestions)
  ) {
    throw new Error("Resposta inválida do servidor (resultado).");
  }

  return { score, correctCount, totalQuestions };
}

function parseApiError(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;

  const code = typeof data.error === "string" ? data.error : fallback;

  // Mensagens refinadas por código
  if (code === "unauthorized") return "Sessão inválida. Faça login novamente.";
  if (code === "not_enough_questions") {
    const available =
      typeof data.available === "number" ? data.available : null;
    return available !== null
      ? `Sem perguntas suficientes (${available}/10). Crie mais documentos em "quiz_questions" com active=true.`
      : `Sem perguntas suficientes. Crie mais documentos em "quiz_questions" com active=true.`;
  }

  return code;
}

export default function QuizClassico() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    total: number;
  } | null>(null);

  const ready = useMemo(() => !loading, [loading]);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  async function start() {
    if (!user) return;

    setBusy(true);
    setErr(null);
    setResult(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: "classic", count: 10 }),
      });

      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(parseApiError(data, "Falha ao iniciar"));
      }

      const ok = parseStartOk(data);

      setSessionId(ok.sessionId);
      setQuestions(ok.questions);
      setAnswers(new Array(ok.questions.length).fill(-1));
      setIdx(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!user || !sessionId) return;

    setBusy(true);
    setErr(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, answers }),
      });

      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(parseApiError(data, "Falha ao enviar"));
      }

      const ok = parseSubmitOk(data);

      setResult({
        score: ok.score,
        correctCount: ok.correctCount,
        total: ok.totalQuestions,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  function resetGame() {
    setSessionId(null);
    setQuestions([]);
    setAnswers([]);
    setIdx(0);
    setResult(null);
    setErr(null);
  }

  if (!ready) return <main className="p-6">Carregando...</main>;

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Link className="underline" href="/quiz">
          ← Quiz
        </Link>
        <Link className="underline" href="/perfil">
          Perfil
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Clássico</h1>

      {!sessionId && (
        <div className="mt-6 border rounded p-4">
          <p className="opacity-80">Inicie uma partida com 10 perguntas.</p>

          <button
            className="mt-4 border rounded px-4 py-2"
            onClick={start}
            disabled={busy}
          >
            {busy ? "Iniciando..." : "Começar"}
          </button>

          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        </div>
      )}

      {sessionId && !result && questions.length > 0 && (
        <div className="mt-6 border rounded p-4">
          <div className="text-sm opacity-80">
            Pergunta {idx + 1} de {questions.length} • {questions[idx].points}{" "}
            pts
          </div>

          <p className="mt-3 font-medium whitespace-pre-wrap">
            {questions[idx].text}
          </p>

          <div className="mt-4 space-y-2">
            {questions[idx].choices.map((c, i) => (
              <label
                key={i}
                className="flex items-center gap-2 border rounded p-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`q-${idx}`}
                  checked={answers[idx] === i}
                  onChange={() => {
                    const next = [...answers];
                    next[idx] = i;
                    setAnswers(next);
                  }}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              className="border rounded px-4 py-2"
              disabled={idx === 0 || busy}
              onClick={() => setIdx((v) => v - 1)}
            >
              Voltar
            </button>

            {idx < questions.length - 1 ? (
              <button
                className="border rounded px-4 py-2"
                disabled={busy}
                onClick={() => setIdx((v) => v + 1)}
              >
                Próxima
              </button>
            ) : (
              <button
                className="border rounded px-4 py-2"
                disabled={busy || answers.some((a) => a < 0)}
                onClick={submit}
              >
                {busy ? "Enviando..." : "Finalizar"}
              </button>
            )}

            <button
              className="border rounded px-4 py-2"
              disabled={busy}
              onClick={resetGame}
              title="Voltar ao início"
            >
              Reiniciar
            </button>
          </div>

          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        </div>
      )}

      {result && (
        <div className="mt-6 border rounded p-4">
          <h2 className="font-medium">Resultado</h2>

          <p className="mt-2">
            Pontuação: <span className="font-semibold">{result.score}</span>
          </p>

          <p>
            Acertos:{" "}
            <span className="font-semibold">{result.correctCount}</span> /{" "}
            {result.total}
          </p>

          <div className="mt-4 flex gap-3">
            <button className="border rounded px-4 py-2" onClick={resetGame}>
              Nova partida
            </button>

            <Link className="underline self-center" href="/quiz/historico">
              Ver histórico
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
