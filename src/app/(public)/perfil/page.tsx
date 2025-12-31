"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

type UserDoc = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  role: "user" | "reviewer" | "admin";
  walletBalance: number; // por enquanto congelado
};

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Falha na operação";
}

export default function PerfilPage() {
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ready = useMemo(() => !loading, [loading]);

  useEffect(() => {
    setMsg(null);
    setErr(null);

    if (!user) {
      setProfile(null);
      setName("");
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          setName(
            user.displayName ||
              (user.email ? user.email.split("@")[0] : "Usuário")
          );
          return;
        }

        const data = snap.data() as UserDoc;
        setProfile(data);
        setName(data.displayName || "");
      },
      () => {
        // se der permissão, veremos no err ao salvar
      }
    );

    return () => unsub();
  }, [user]);

  async function saveName() {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: trimmed,
        updatedAt: serverTimestamp(),
      });
      setMsg("Nome atualizado.");
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <main className="p-6 max-w-2xl mx-auto">Carregando...</main>;
  }

  if (!user) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="mt-2 opacity-80">
          Você não está logado. Vá em{" "}
          <Link className="underline" href="/login">
            /login
          </Link>
          .
        </p>

        <div className="mt-6 flex gap-3 text-sm">
          <Link className="underline" href="/feed">
            Feed
          </Link>
          <Link className="underline" href="/ranking">
            Ranking
          </Link>
          <Link className="underline" href="/quiz">
            Quiz
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <div className="text-sm opacity-80 flex gap-3">
          <Link className="underline" href="/feed">
            Feed
          </Link>
          <Link className="underline" href="/ranking">
            Ranking
          </Link>
          <Link className="underline" href="/quiz">
            Quiz
          </Link>
        </div>
      </div>

      <section className="mt-6 border rounded p-4">
        <div className="text-sm opacity-80 space-y-1">
          <p>
            <span className="font-medium">UID:</span> {user.uid}
          </p>
          <p>
            <span className="font-medium">E-mail:</span> {user.email}
          </p>
          <p>
            <span className="font-medium">Role (espelho):</span>{" "}
            {profile?.role ?? "user"}
          </p>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium">Nome público</label>
          <input
            className="mt-2 w-full border rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="Seu nome no app"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              className="rounded px-4 py-2 border disabled:opacity-50"
              onClick={saveName}
              disabled={busy || name.trim().length === 0}
            >
              {busy ? "Salvando..." : "Salvar"}
            </button>

            <button
              className="rounded px-4 py-2 border"
              onClick={() => signOut(auth)}
            >
              Sair
            </button>
          </div>

          {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        </div>
      </section>

      <section className="mt-6 border rounded p-4">
        <h2 className="font-medium">Economia (MVP)</h2>
        <p className="mt-2 text-sm opacity-80">
          Diamantes ainda serão controlados pelo servidor. Por enquanto, este
          campo fica congelado.
        </p>
        <p className="mt-2">
          <span className="text-sm opacity-80">Saldo:</span>{" "}
          <span className="font-semibold">{profile?.walletBalance ?? 0}</span>
        </p>
      </section>
    </main>
  );
}
