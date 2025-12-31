import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase/client";

export async function provisionUser(u: User) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Atualizações leves opcionais podem ser feitas depois (ex.: lastLoginAt via Function)
    return;
  }

  const displayName =
    u.displayName?.trim() || (u.email ? u.email.split("@")[0] : "Usuário");

  await setDoc(
    ref,
    {
      uid: u.uid,
      displayName,
      photoURL: u.photoURL ?? null,
      email: u.email ?? null,

      // Campos controlados pelo servidor/claims no futuro:
      role: "user", // espelho p/ UI (não é fonte de verdade)
      walletBalance: 0, // SOMENTE servidor no futuro; por enquanto congelado

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  );
}
