"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import TorneiosPublicClient from "./_components/TorneiosPublicClient";

export default function QuizTorneioPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <main className="p-6">Carregando…</main>;
  if (!user) return <main className="p-6">Redirecionando…</main>;

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Torneios</h1>
          <p className="text-sm opacity-80">
            Recorrentes: sempre disponíveis • Especiais: inscrição + entrada no
            horário.
          </p>
        </div>

        <nav className="flex gap-4 text-sm">
          <Link className="underline" href="/quiz">
            Voltar
          </Link>
          <Link className="underline" href="/perfil">
            Perfil
          </Link>
        </nav>
      </header>

      <section className="mt-5">
        <TorneiosPublicClient />
      </section>
    </main>
  );
}
