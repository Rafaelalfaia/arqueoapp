// src/lib/tournament/server.ts
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COL, DEFAULTS, type PrizeSplit, type TournamentType } from "./config";

/**
 * ============================================================
 * Helpers de parsing (sem any, sem null)
 * ============================================================
 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asRecord(v: unknown, errMsg: string): Record<string, unknown> {
  if (!isRecord(v)) throw new Error(errMsg);
  return v;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function readNumber(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const v = obj[key];
  return isNumber(v) ? v : undefined;
}

function readString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const v = obj[key];
  return isString(v) ? v : undefined;
}

function readBoolean(
  obj: Record<string, unknown>,
  key: string
): boolean | undefined {
  const v = obj[key];
  return isBoolean(v) ? v : undefined;
}

function readStringArray(
  obj: Record<string, unknown>,
  key: string
): string[] | undefined {
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  for (const it of v) if (!isString(it)) return undefined;
  return v;
}

function normalizeRole(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const r = s.trim().toLowerCase();
  return r.length ? r : undefined;
}

function normalizeRoles(arr: string[] | undefined): string[] {
  if (!arr) return [];
  return arr.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0);
}

/**
 * Converte Timestamp/objetos Timestamp-like para ms (robusto p/ Admin SDK)
 */
export function toMs(v: unknown): number | undefined {
  if (!v) return undefined;

  if (v instanceof Timestamp) return v.toMillis();

  if (typeof v === "object") {
    const o = v as {
      toMillis?: unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };

    if (typeof o.toMillis === "function") {
      try {
        const x = (o.toMillis as () => number)();
        return Number.isFinite(x) ? x : undefined;
      } catch {
        return undefined;
      }
    }

    const s =
      typeof o.seconds === "number"
        ? o.seconds
        : typeof o._seconds === "number"
        ? o._seconds
        : undefined;

    if (typeof s === "number" && Number.isFinite(s)) return s * 1000;
  }

  return undefined;
}

/**
 * ============================================================
 * Auth
 * ============================================================
 */
export type AuthedUser = {
  uid: string;
  role?: string;
  roles?: string[];
  admin?: boolean;
  isAdmin?: boolean;
};

function getBearer(req: Request): string | undefined {
  const h =
    req.headers.get("authorization") ??
    req.headers.get("Authorization") ??
    undefined;
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1];
}

function firestoreFallbackEnabled(): boolean {
  const env = process.env.ALLOW_FIRESTORE_ROLE_FALLBACK;
  if (process.env.NODE_ENV === "production") return env === "true";
  return env !== "false"; // dev/test: default ON
}

async function getFirestoreAdminIfAllowed(uid: string): Promise<boolean> {
  if (!firestoreFallbackEnabled()) return false;

  const snap = await adminDb.collection(COL.users).doc(uid).get();
  if (!snap.exists) return false;

  const data = snap.data();
  if (!data) return false;

  const u = asRecord(data as unknown, "USER_INVALIDO");
  const role = normalizeRole(readString(u, "role"));
  const rolesArr = normalizeRoles(readStringArray(u, "roles"));
  return role === "admin" || rolesArr.includes("admin");
}

export async function requireUser(req: Request): Promise<AuthedUser> {
  const token = getBearer(req);
  if (!token) throw new Error("UNAUTHENTICATED");

  const decoded: DecodedIdToken = await adminAuth.verifyIdToken(token, true);
  const raw = asRecord(decoded as unknown, "UNAUTHENTICATED");

  const rolesRaw = readStringArray(raw, "roles");
  const roleRaw = readString(raw, "role");
  const adminFlag = readBoolean(raw, "admin");
  const isAdminFlag = readBoolean(raw, "isAdmin");

  const roleNorm = normalizeRole(roleRaw);
  const rolesNorm = normalizeRoles(rolesRaw);

  let computedIsAdmin =
    adminFlag === true ||
    isAdminFlag === true ||
    roleNorm === "admin" ||
    rolesNorm.includes("admin");

  if (!computedIsAdmin) {
    const dbAdmin = await getFirestoreAdminIfAllowed(decoded.uid);
    if (dbAdmin) computedIsAdmin = true;
  }

  return {
    uid: decoded.uid,
    roles: rolesRaw,
    role: roleRaw,
    admin: adminFlag,
    isAdmin: computedIsAdmin,
  };
}

export function isAdmin(user: AuthedUser): boolean {
  const roleNorm = normalizeRole(user.role);
  const rolesNorm = normalizeRoles(user.roles);

  return (
    user.isAdmin === true ||
    user.admin === true ||
    roleNorm === "admin" ||
    rolesNorm.includes("admin")
  );
}

export async function requireAdmin(req: Request): Promise<AuthedUser> {
  const user = await requireUser(req);
  if (!isAdmin(user)) throw new Error("FORBIDDEN");
  return user;
}

/**
 * ============================================================
 * Time
 * ============================================================
 */
export function nowMs(): number {
  return Date.now();
}

export function tsFromISO(iso: string): Timestamp {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("startAt inválido (ISO).");
  return Timestamp.fromDate(d);
}

export function addMinutes(ts: Timestamp, minutes: number): Timestamp {
  return Timestamp.fromMillis(ts.toMillis() + minutes * 60_000);
}

/**
 * ============================================================
 * Validadores
 * ============================================================
 */
export function assertTournamentType(raw: unknown): TournamentType {
  if (raw === "recurring" || raw === "special") return raw;
  throw new Error("TORNEIO_INVALIDO");
}

export function assertNumber(name: string, raw: unknown): number {
  if (!isNumber(raw)) throw new Error(`${name}_INVALIDO`);
  return raw;
}

export function normalizePrizeSplit(raw: unknown): PrizeSplit {
  const obj = isRecord(raw) ? raw : undefined;
  const first = obj ? readNumber(obj, "first") : undefined;
  const second = obj ? readNumber(obj, "second") : undefined;
  const third = obj ? readNumber(obj, "third") : undefined;

  return {
    first: isNumber(first) ? first : DEFAULTS.prizeSplit.first,
    second: isNumber(second) ? second : DEFAULTS.prizeSplit.second,
    third: isNumber(third) ? third : DEFAULTS.prizeSplit.third,
  };
}

/**
 * ============================================================
 * Questões (CANÔNICO + fallback legado)
 * ============================================================
 */
export type QuestionPack = {
  questionIds: string[];
  correctIndexes: number[];
  points: number[];
};

type Difficulty = "easy" | "medium" | "hard";

function asDifficulty(v: unknown): Difficulty {
  return v === "hard" ? "hard" : v === "medium" ? "medium" : "easy";
}

function pointsForDifficulty(d: Difficulty): number {
  if (d === "hard") return 30;
  if (d === "medium") return 20;
  return 10;
}

function readStringArray4(
  obj: Record<string, unknown>,
  key: string
): string[] | undefined {
  const v = obj[key];
  if (!Array.isArray(v) || v.length !== 4) return undefined;
  for (const it of v) if (!isString(it)) return undefined;
  return v;
}

async function loadActiveQuestionsSnapshot() {
  let snap = await adminDb
    .collection(COL.questions)
    .where("active", "==", true)
    .limit(1000)
    .get();
  if (snap.size === 0) {
    snap = await adminDb
      .collection(COL.questions)
      .where("isActive", "==", true)
      .limit(1000)
      .get();
  }
  return snap;
}

export async function pickQuestionPack(
  questionCount: number
): Promise<QuestionPack> {
  const snap = await loadActiveQuestionsSnapshot();

  if (snap.size < questionCount) {
    throw new Error(
      `Banco de questões insuficiente: ${snap.size}/${questionCount}`
    );
  }

  const docs = snap.docs.slice();
  for (let i = docs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [docs[i], docs[j]] = [docs[j], docs[i]];
  }

  const chosen = docs.slice(0, questionCount);

  const questionIds: string[] = [];
  const correctIndexes: number[] = [];
  const points: number[] = [];

  for (const d of chosen) {
    const data = asRecord(d.data() as unknown, `Questão ${d.id} inválida`);

    const text = (readString(data, "text") ?? "").trim();
    const choices = readStringArray4(data, "choices");
    const ci = readNumber(data, "correctIndex");
    const diff = asDifficulty(data["difficulty"]);
    const pts = readNumber(data, "points");

    if (!text) throw new Error(`Questão ${d.id} sem text`);
    if (!choices) throw new Error(`Questão ${d.id} sem choices[4]`);
    if (!isNumber(ci) || ci < 0 || ci > 3)
      throw new Error(`Questão ${d.id} correctIndex inválido`);

    questionIds.push(d.id);
    correctIndexes.push(ci);
    points.push(isNumber(pts) ? pts : pointsForDifficulty(diff));
  }

  return { questionIds, correctIndexes, points };
}

/**
 * ============================================================
 * Economia (helpers)
 * ============================================================
 */
export function readWalletBalance(u: Record<string, unknown>): number {
  const wb = readNumber(u, "walletBalance");
  const d = readNumber(u, "diamonds");
  return isNumber(wb) ? wb : isNumber(d) ? d : 0;
}

export async function applyDiamondsDeltaTx(
  tx: Transaction,
  uid: string,
  delta: number,
  reason: string,
  meta: Record<string, unknown>
): Promise<void> {
  const userRef = adminDb.collection(COL.users).doc(uid);
  const userSnap = await tx.get(userRef);

  const curBalance = userSnap.exists
    ? readWalletBalance(asRecord(userSnap.data() as unknown, "USER_INVALIDO"))
    : 0;

  const next = curBalance + delta;
  if (next < 0) throw new Error("SALDO_INSUFICIENTE");

  const payload = {
    walletBalance: next,
    diamonds: next,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!userSnap.exists) {
    tx.set(
      userRef,
      {
        uid,
        role: "user",
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    tx.update(userRef, payload);
  }

  tx.set(adminDb.collection(COL.ledger).doc(), {
    uid,
    delta,
    reason,
    meta,
    createdAt: FieldValue.serverTimestamp(),
  });
}
