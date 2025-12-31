import "server-only";

import {
  getApps,
  initializeApp,
  applicationDefault,
  cert,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  // Em alguns painéis, quebras de linha do private_key viram "\n"
  const parsed = JSON.parse(raw);
  if (parsed?.private_key && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

export function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const sa = getServiceAccountFromEnv();

  // 1) Preferir env secret (produção)
  if (sa) {
    return initializeApp({ credential: cert(sa) });
  }

  // 2) Fallback: ADC (gcloud) ou GOOGLE_APPLICATION_CREDENTIALS (local)
  return initializeApp({ credential: applicationDefault() });
}

export const adminDb = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
