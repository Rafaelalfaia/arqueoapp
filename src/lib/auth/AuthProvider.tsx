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

async function callWalletBootstrap(u: User): Promise<void> {
  try {
    const token = await u.getIdToken(true);
    await fetch("/api/wallet/bootstrap", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // silencioso: não pode travar login
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalId: number | null = null;

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
          // cria doc padrão (pode manter wallet vazio; bootstrap do servidor garante o piso)
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
          setRole(normalizeRole(data.role));
        }

        // Atualiza SOMENTE campos permitidos pelas rules (evita permission-denied)
        // (não toca email/role/wallet por client)
        await updateDoc(doc(db, "users", u.uid), {
          displayName: u.displayName ?? "",
          photoURL: u.photoURL ?? "",
          updatedAt: serverTimestamp(),
        });

        // wallet bootstrap imediato + a cada 1h
        await callWalletBootstrap(u);

        if (intervalId) window.clearInterval(intervalId);
        intervalId = window.setInterval(
          () => void callWalletBootstrap(u),
          60 * 60 * 1000
        );
      } catch (e: unknown) {
        console.error("AuthProvider role load error:", getErrMsg(e));
        setRole("user");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (intervalId) window.clearInterval(intervalId);
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
