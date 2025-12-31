"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Falha ao entrar";
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); // <-- role vindo do provider

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(role === "admin" ? "/admin" : "/perfil");
    }
  }, [loading, user, role, router]);

  async function loginEmail() {
    setErr(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // NÃO redireciona aqui
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function loginGoogle() {
    setErr(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // NÃO redireciona aqui
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold">Entrar</h1>

      <div className="mt-6 space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Senha"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          disabled={busy}
        />

        <button
          className="w-full rounded px-3 py-2 border"
          onClick={loginEmail}
          disabled={busy}
        >
          {busy ? "Entrando..." : "Entrar com e-mail"}
        </button>

        <button
          className="w-full rounded px-3 py-2 border"
          onClick={loginGoogle}
          disabled={busy}
        >
          {busy ? "Entrando..." : "Entrar com Google"}
        </button>

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </main>
  );
}
