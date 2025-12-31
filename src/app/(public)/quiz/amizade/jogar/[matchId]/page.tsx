"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { db } from "@/lib/firebase/client";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";

type Difficulty = "easy" | "medium" | "hard";
type MatchStatus =
  | "lobby"
  | "starting"
  | "in_progress"
  | "finished"
  | "expired";

type Q = {
  id: string;
  text: string;
  choices: string[];
  difficulty: Difficulty;
  points: number;
};

type ResultRow = {
  uid: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStatus(v: unknown): MatchStatus | null {
  return v === "lobby" ||
    v === "starting" ||
    v === "in_progress" ||
    v === "finished" ||
    v === "expired"
    ? v
    : null;
}

function toNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
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
  if (code === "not_in_progress") return "Partida ainda não está em andamento.";
  if (code === "session_not_found" || code === "room_not_found")
    return "Sala não encontrada.";
  if (code === "server_error") {
    const d = typeof data.detail === "string" ? data.detail : null;
    return d ? `Erro no servidor: ${d}` : "Erro no servidor.";
  }
  return code;
}

function parseQuestionDoc(d: DocumentData): Q | null {
  if (!isRecord(d)) return null;

  const id = typeof d.id === "string" ? d.id : "";
  const text = typeof d.text === "string" ? d.text : "";
  const choices = Array.isArray(d.choices) ? d.choices.map(String) : [];
  const difficulty =
    d.difficulty === "hard"
      ? "hard"
      : d.difficulty === "medium"
      ? "medium"
      : "easy";
  const points = toNumber(d.points, 10);

  if (!text || choices.length !== 4) return null;
  return { id, text, choices, difficulty, points };
}

export default function JogarAmizade() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const ready = useMemo(() => !loading, [loading]);

  const [status, setStatus] = useState<MatchStatus>("starting");

  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);

  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [myResult, setMyResult] = useState<ResultRow | null>(null);
  const [ranking, setRanking] = useState<ResultRow[]>([]);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  // match status realtime
  useEffect(() => {
    if (!matchId) return;
    const ref = doc(db, "quiz_friend_matches", matchId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as DocumentData | undefined;
      const st = data ? asStatus(data.status) : null;
      if (st) setStatus(st);
    });
    return () => unsub();
  }, [matchId]);

  // load public questions once
  useEffect(() => {
    async function run() {
      if (!matchId) return;
      setErr(null);
      try {
        const qy = query(
          collection(db, "quiz_friend_matches", matchId, "public_questions"),
          orderBy("index")
        );
        const snap = await getDocs(qy);
        const qs: Q[] = [];
        snap.docs.forEach((docSnap) => {
          const q = parseQuestionDoc(docSnap.data());
          if (q) qs.push(q);
        });

        setQuestions(qs);
        setAnswers(new Array(qs.length).fill(-1));
        setIdx(0);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Falha ao carregar perguntas");
      }
    }

    void run();
  }, [matchId]);

  // results realtime (ranking + meu resultado)
  useEffect(() => {
    if (!matchId) return;

    const col = collection(db, "quiz_friend_matches", matchId, "results");
    const unsub = onSnapshot(col, (snap) => {
      const rows: ResultRow[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as DocumentData;
        rows.push({
          uid: d.id,
          score: toNumber(data.score, 0),
          correctCount: toNumber(data.correctCount, 0),
          totalQuestions: toNumber(data.totalQuestions, 0),
        });
      });

      rows.sort((a, b) => b.score - a.score);
      setRanking(rows);

      if (user) {
        const me = rows.find((r) => r.uid === user.uid) ?? null;
        setMyResult(me);
        if (me) setWaiting(false);
      }
    });

    return () => unsub();
  }, [matchId, user]);

  async function submit() {
    if (!user || !matchId) return;
    setBusy(true);
    setErr(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/quiz/friend/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId, answers }),
      });

      const { rawText, data } = await readJsonOrText(res);

      if (!res.ok) {
        const fallback = `Falha ao enviar (HTTP ${res.status})${
          rawText ? `: ${rawText.slice(0, 160)}` : ""
        }`;
        throw new Error(parseApiError(data, fallback));
      }

      // se vier finished com score, também setamos direto (mas o realtime já resolve)
      if (isRecord(data) && data.state === "finished") {
        const score = toNumber(data.score, 0);
        const correctCount = toNumber(data.correctCount, 0);
        const totalQuestions = toNumber(data.totalQuestions, questions.length);
        setMyResult({ uid: user.uid, score, correctCount, totalQuestions });
        setWaiting(false);
      } else {
        setWaiting(true);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="p-6">Carregando...</main>;

  if (status === "lobby" || status === "starting") {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Link className="underline" href={`/quiz/amizade/sala/${matchId}`}>
            ← Sala
          </Link>
          <Link className="underline" href="/perfil">
            Perfil
          </Link>
        </div>

        <h1 className="mt-4 text-2xl font-semibold">Aguardando início...</h1>
        <p className="mt-2 opacity-80">
          Quando o host iniciar, a partida começará automaticamente.
        </p>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </main>
    );
  }

  if (status === "expired") {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Sala expirada</h1>
        <Link className="underline mt-4 inline-block" href="/quiz/amizade">
          Voltar
        </Link>
      </main>
    );
  }

  const finished = status === "finished";
  const canPlay = !finished && questions.length > 0 && !myResult;

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

      <h1 className="mt-4 text-2xl font-semibold">Amizade</h1>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {canPlay && (
        <div className="mt-6 border rounded p-4">
          <div className="text-sm opacity-80">
            Pergunta {idx + 1} de {questions.length} •{" "}
            {questions[idx]?.points ?? 0} pts
          </div>

          <p className="mt-3 font-medium whitespace-pre-wrap">
            {questions[idx]?.text}
          </p>

          <div className="mt-4 space-y-2">
            {questions[idx]?.choices?.map((c, i) => (
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

          <div className="mt-5 flex gap-3 flex-wrap">
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
          </div>
        </div>
      )}

      {(waiting || myResult || finished) && (
        <div className="mt-6 border rounded p-4">
          <h2 className="font-medium">Resultado</h2>

          {waiting && !myResult && (
            <p className="mt-2 opacity-80">
              Aguardando os outros jogadores finalizarem...
            </p>
          )}

          {myResult && (
            <>
              <p className="mt-2">
                Pontuação:{" "}
                <span className="font-semibold">{myResult.score}</span>
              </p>
              <p>
                Acertos:{" "}
                <span className="font-semibold">{myResult.correctCount}</span> /{" "}
                {myResult.totalQuestions}
              </p>
            </>
          )}

          <div className="mt-4">
            <div className="font-medium">Ranking</div>
            <ul className="mt-2 space-y-1">
              {ranking.map((r, i) => (
                <li
                  key={r.uid}
                  className="flex items-center justify-between border rounded px-3 py-2"
                >
                  <span className="text-sm">
                    #{i + 1} {r.uid === user?.uid ? "(você)" : ""}
                  </span>
                  <span className="text-sm font-semibold">{r.score} pts</span>
                </li>
              ))}
              {ranking.length === 0 && (
                <li className="text-sm opacity-70">Ainda sem resultados.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
