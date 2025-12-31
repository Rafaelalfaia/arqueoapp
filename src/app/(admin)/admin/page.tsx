"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AdminHome() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && role !== "admin") router.replace("/perfil");
  }, [loading, user, role, router]);

  if (loading) return <main className="p-6">Carregando…</main>;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Painel Admin</h1>

      <div className="mt-4 space-y-2">
        <Link className="underline" href="/admin/perguntas">
          Perguntas do Quiz
        </Link>

        <div>
          <Link className="underline" href="/admin/torneios">
            Torneios
          </Link>
        </div>

        <div className="pt-2">
          <Link className="underline" href="/perfil">
            Voltar ao perfil
          </Link>
        </div>
      </div>
    </main>
  );
}
