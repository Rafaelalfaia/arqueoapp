"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import type { AppRole } from "@/lib/auth/roles";
import { normalizeRole } from "@/lib/auth/roles";

type AuthCtx = {
  user: User | null;
  role: AppRole;
  loading: boolean;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function getErrMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Falha";
}

async function bootstrapWallet(u: User, signal?: AbortSignal): Promise<void> {
  // Não quebra login se falhar; é “best effort”.
  const token = await u.getIdToken(true);

  const res = await fetch("/api/wallet/bootstrap", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  // Se não vier JSON/OK, apenas loga (não derruba a sessão)
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("wallet/bootstrap failed:", res.status, text.slice(0, 200));
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();

    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);

      try {
        if (!u) {
          setRole("user");
          return;
        }

        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // cria doc “perfil/espelho”, sem campos sensíveis (saldo)
          await setDoc(
            ref,
            {
              uid: u.uid,
              email: u.email ?? "",
              displayName: u.displayName ?? "",
              photoURL: u.photoURL ?? "",
              role: "user",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          setRole("user");
        } else {
          const data = snap.data() as { role?: unknown };
          const r = normalizeRole(data.role);

          // atualiza somente campos não-críticos
          await updateDoc(ref, {
            email: u.email ?? "",
            displayName: u.displayName ?? "",
            photoURL: u.photoURL ?? "",
            updatedAt: serverTimestamp(),
          });

          setRole(r);
        }

        // Garante piso de saldo no servidor (50 + regra 1h)
        await bootstrapWallet(u, ac.signal);
      } catch (e: unknown) {
        console.error("AuthProvider error:", getErrMsg(e));
        setRole("user");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      ac.abort();
      unsub();
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      role,
      loading,
      logout: async () => fbSignOut(auth),
    }),
    [user, role, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
