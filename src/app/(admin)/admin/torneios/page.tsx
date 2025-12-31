"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import AdminTorneiosClient from "./_components/AdminTorneiosClient";

export default function AdminTorneiosPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && role !== "admin") router.replace("/perfil");
  }, [loading, user, role, router]);

  if (loading) return <main className="p-6">Carregando…</main>;

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin • Torneios</h1>
          <p className="text-sm opacity-80">
            Crie torneios e visualize todos. Premiação fixa: 50% / 30% / 20%.
          </p>
        </div>

        <nav className="flex gap-4 text-sm">
          <Link className="underline" href="/admin">
            Voltar
          </Link>
          <Link className="underline" href="/perfil">
            Perfil
          </Link>
        </nav>
      </header>

      <section className="mt-5">
        <AdminTorneiosClient />
      </section>
    </main>
  );
}
