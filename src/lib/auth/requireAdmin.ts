import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function isUserAdmin(uid: string): Promise<boolean> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const role = snap.exists() ? (snap.data().role as unknown) : null;
  return role === "admin";
}
