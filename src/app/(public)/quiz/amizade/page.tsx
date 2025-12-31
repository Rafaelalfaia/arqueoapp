"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
  if (code === "room_not_found") return "Sala não encontrada.";
  if (code === "room_full") return "Sala cheia.";
  if (code === "already_started") return "Esta sala já foi iniciada.";
  if (code === "expired") return "Sala expirada.";
  if (code === "server_error") {
    const d = typeof data.detail === "string" ? data.detail : null;
    return d ? `Erro no servidor: ${d}` : "Erro no servidor.";
  }
  return code;
}

export default function QuizAmizadeHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const ready = useMemo(() => !loading, [loading]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");

  const [maxPlayers, setMaxPlayers] = useState(2);
  const [questionCount, setQuestionCount] = useState(10);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  async function createRoom() {
    if (!user) return;
    setBusy(true);
    setErr(null);

    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/quiz/friend/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ maxPlayers, questionCount }),
      });

      const { rawText, data } = await readJsonOrText(res);

      if (!res.ok) {
        const fallback = `Falha ao criar (HTTP ${res.status})${
          rawText ? `: ${rawText.slice(0, 160)}` : ""
        }`;
        throw new Error(parseApiError(data, fallback));
      }

      if (!isRecord(data) || typeof data.matchId !== "string") {
        throw new Error("Resposta inválida ao criar sala.");
      }

      router.push(`/quiz/amizade/sala/${data.matchId}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!user) return;
    setBusy(true);
    setErr(null);

    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) throw new Error("Informe o código da sala.");

      const token = await user.getIdToken();

      const res = await fetch("/api/quiz/friend/join", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ joinCode: code }),
      });

      const { rawText, data } = await readJsonOrText(res);

      if (!res.ok) {
        const fallback = `Falha ao entrar (HTTP ${res.status})${
          rawText ? `: ${rawText.slice(0, 160)}` : ""
        }`;
        throw new Error(parseApiError(data, fallback));
      }

      if (!isRecord(data) || typeof data.matchId !== "string") {
        throw new Error("Resposta inválida ao entrar na sala.");
      }

      router.push(`/quiz/amizade/sala/${data.matchId}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
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

      <h1 className="mt-4 text-2xl font-semibold">Modo Amizade</h1>
      <p className="mt-2 opacity-80">
        Crie uma sala e convide amigos por código. Todos jogam as mesmas
        perguntas.
      </p>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-6 grid gap-6">
        <section className="border rounded p-4">
          <h2 className="font-medium">Criar sala</h2>

          <div className="mt-3 flex gap-3 flex-wrap">
            <label className="text-sm">
              Jogadores
              <select
                className="ml-2 border rounded px-3 py-2"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                disabled={busy}
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Perguntas
              <select
                className="ml-2 border rounded px-3 py-2"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                disabled={busy}
              >
                {[10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="mt-4 border rounded px-4 py-2"
            onClick={createRoom}
            disabled={busy}
          >
            {busy ? "Criando..." : "Criar sala"}
          </button>
        </section>

        <section className="border rounded p-4">
          <h2 className="font-medium">Entrar em uma sala</h2>

          <div className="mt-3 flex gap-3 flex-wrap items-center">
            <input
              className="border rounded px-3 py-2 flex-1 min-w-[200px]"
              placeholder="Código (ex.: K9F2QX)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              disabled={busy}
            />
            <button
              className="border rounded px-4 py-2"
              onClick={joinRoom}
              disabled={busy}
            >
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
