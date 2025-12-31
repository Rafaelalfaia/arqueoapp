import "server-only";

import fs from "node:fs";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountLike = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseServiceAccountObject(obj: unknown): ServiceAccountLike | null {
  if (!isRecord(obj)) return null;

  const project_id = obj.project_id;
  const client_email = obj.client_email;
  const private_key = obj.private_key;

  if (
    typeof project_id !== "string" ||
    typeof client_email !== "string" ||
    typeof private_key !== "string"
  ) {
    return null;
  }

  return {
    projectId: project_id.trim(),
    clientEmail: client_email.trim(),
    privateKey: private_key.replace(/\\n/g, "\n"),
  };
}

function getProjectIdFromEnv(): string | undefined {
  const v =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function getServiceAccountFromCredentialsFile(): ServiceAccountLike | null {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!p || typeof p !== "string") return null;
  if (!fs.existsSync(p)) return null;

  try {
    const raw = fs.readFileSync(p, "utf8");
    return parseServiceAccountObject(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const sa = getServiceAccountFromCredentialsFile();
  const projectId = getProjectIdFromEnv() || sa?.projectId;

  if (sa) {
    return initializeApp({
      credential: cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      }),
      projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export const adminDb = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
