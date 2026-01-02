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
import type { User as FbUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import type { AppRole } from "@/lib/auth/roles";
import { normalizeRole } from "@/lib/auth/roles";

type AuthCtx = {
  user: FbUser | null;
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

async function callWalletBootstrap(u: FbUser): Promise<void> {
  try {
    const token = await u.getIdToken(true);
    const res = await fetch("/api/wallet/bootstrap", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // Consome body para evitar pendência e ajudar debug (sem quebrar fluxo)
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();

    if (!res.ok) {
      let msg = `wallet/bootstrap falhou (${res.status})`;
      if (ct.includes("application/json")) {
        try {
          const parsed: unknown = JSON.parse(text);
          if (isRecord(parsed)) {
            const e = readString(parsed, "error");
            if (e) msg = e;
          }
        } catch {
          // ignora
        }
      }
      console.warn(msg, text.slice(0, 200));
    }
  } catch (e: unknown) {
    console.warn("wallet/bootstrap erro:", getErrMsg(e));
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FbUser | null>(null);
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

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
        if (cancelled) return;

        if (!snap.exists()) {
          // Cria doc mínimo de perfil (SEM saldo; saldo é somente servidor)
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
          if (cancelled) return;

          setRole("user");
        } else {
          const dataRaw: unknown = snap.data();
          const data = isRecord(dataRaw) ? dataRaw : {};

          const r = normalizeRole(readString(data, "role"));
          setRole(r);

          // Atualiza apenas campos não-críticos (não toca no role, não toca em saldo)
          const patch: Record<string, unknown> = {};
          const nextEmail = u.email ?? "";
          const nextName = u.displayName ?? "";
          const nextPhoto = u.photoURL ?? "";

          const curEmail = readString(data, "email") ?? "";
          const curName = readString(data, "displayName") ?? "";
          const curPhoto = readString(data, "photoURL") ?? "";

          if (curEmail !== nextEmail) patch.email = nextEmail;
          if (curName !== nextName) patch.displayName = nextName;
          if (curPhoto !== nextPhoto) patch.photoURL = nextPhoto;

          if (Object.keys(patch).length > 0) {
            patch.updatedAt = serverTimestamp();
            await updateDoc(ref, patch);
          }
        }

        // Dispara bootstrap (piso 50 + regra de 1h) sem bloquear a UI
        void callWalletBootstrap(u);
      } catch (e: unknown) {
        console.error("AuthProvider role load error:", getErrMsg(e));
        setRole("user");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
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
