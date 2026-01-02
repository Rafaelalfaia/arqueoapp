// src/lib/tournament/server.ts
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COL, DEFAULTS, type PrizeSplit, type TournamentType } from "./config";

/** Helpers de parsing (sem any, sem null) */
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

/** Auth */
export type AuthedUser = {
  uid: string;
  role?: string; // claim role (raw)
  roles?: string[]; // claim roles (raw)
  admin?: boolean; // claim admin (raw)
  isAdmin?: boolean; // computed
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

/**
 * DEV fallback:
 * - Em produção: só usa se ALLOW_FIRESTORE_ROLE_FALLBACK === "true"
 * - Em desenvolvimento: habilita por padrão, a menos que ALLOW_FIRESTORE_ROLE_FALLBACK === "false"
 */
function firestoreFallbackEnabled(): boolean {
  const env = process.env.ALLOW_FIRESTORE_ROLE_FALLBACK;
  if (process.env.NODE_ENV === "production") return env === "true";
  // dev/test: default ON, allow opt-out
  return env !== "false";
}

async function getFirestoreRoleIfAllowed(
  uid: string
): Promise<"admin" | undefined> {
  if (!firestoreFallbackEnabled()) return undefined;

  const snap = await adminDb.collection(COL.users).doc(uid).get();
  if (!snap.exists) return undefined;

  const data = snap.data();
  if (!data) return undefined;

  const u = asRecord(data as unknown, "USER_INVALIDO");

  const role = normalizeRole(readString(u, "role"));
  const rolesArr = normalizeRoles(readStringArray(u, "roles"));

  if (role === "admin") return "admin";
  if (rolesArr.includes("admin")) return "admin";
  return undefined;
}

export async function requireUser(req: Request): Promise<AuthedUser> {
  const token = getBearer(req);
  if (!token) throw new Error("UNAUTHENTICATED");

  // true => verifica revogação (mais seguro)
  const decoded: DecodedIdToken = await adminAuth.verifyIdToken(token, true);
  const raw = asRecord(decoded as unknown, "UNAUTHENTICATED");

  // claims possíveis
  const rolesRaw = readStringArray(raw, "roles");
  const roleRaw = readString(raw, "role");
  const adminFlag = readBoolean(raw, "admin");
  const isAdminFlag = readBoolean(raw, "isAdmin");

  // normalização (case-insensitive)
  const roleNorm = normalizeRole(roleRaw);
  const rolesNorm = normalizeRoles(rolesRaw);

  // computed admin por claims
  let computedIsAdmin =
    adminFlag === true ||
    isAdminFlag === true ||
    roleNorm === "admin" ||
    rolesNorm.includes("admin");

  // fallback (DEV / opcional)
  if (!computedIsAdmin) {
    const dbRole = await getFirestoreRoleIfAllowed(decoded.uid);
    if (dbRole === "admin") computedIsAdmin = true;
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

/** Time */
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

/** Validadores */
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
 * Questões (MVP)
 * Ajuste os campos conforme seu schema real.
 */
export type QuestionPack = {
  questionIds: string[];
  correctIndexes: number[];
  points: number[];
};

export async function pickQuestionPack(
  questionCount: number
): Promise<QuestionPack> {
  const snap = await adminDb
    .collection(COL.questions)
    .where("isActive", "==", true)
    .limit(1000)
    .get();

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

    const ci = readNumber(data, "correctIndex");
    if (!isNumber(ci))
      throw new Error(`Questão ${d.id} sem correctIndex numérico`);

    const pts = readNumber(data, "points");

    questionIds.push(d.id);
    correctIndexes.push(ci);
    points.push(isNumber(pts) ? pts : 100);
  }

  return { questionIds, correctIndexes, points };
}

/**
 * Sanitiza questão para o cliente (remove gabarito / pontos).
 */
export type ClientQuestion = Record<string, unknown> & { id: string };

export function sanitizeQuestion(id: string, data: unknown): ClientQuestion {
  const obj = asRecord(data, `Questão ${id} sem dados`);
  const {
    correctIndex: _a,
    correctIndexes: _b,
    answer: _c,
    points: _d,
    ...rest
  } = obj;

  return { id, ...rest };
}

// === Wallet floor (MVP) ===
const WALLET_MIN = 50;
const WALLET_TOPUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

function readTimestampMs(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const v = obj[key];
  // Timestamp do firebase-admin geralmente tem toMillis()
  if (v && typeof v === "object" && "toMillis" in v) {
    const tm = (v as { toMillis?: unknown }).toMillis;
    if (typeof tm === "function") {
      const ms = (v as { toMillis: () => number }).toMillis();
      return Number.isFinite(ms) ? ms : undefined;
    }
  }
  return undefined;
}

type AnyDocSnap =
  FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>;

export type ApplyDiamondsOpts = {
  /**
   * IMPORTANTE:
   * Passe o snapshot lido ANTES de qualquer write na transação
   * para evitar: "all reads before all writes".
   */
  userSnap?: AnyDocSnap;
  nowMs?: number;
  /**
   * Default: true (aplica piso 50 se elegível).
   * Você pode desligar em flows específicos, se quiser.
   */
  ensureFloor?: boolean;
};

export async function applyDiamondsDeltaTx(
  tx: Transaction,
  uid: string,
  delta: number,
  reason: string,
  meta: Record<string, unknown>,
  opts?: ApplyDiamondsOpts
): Promise<void> {
  const userRef = adminDb.collection(COL.users).doc(uid);

  const snap: AnyDocSnap = opts?.userSnap ?? (await tx.get(userRef));

  const now = typeof opts?.nowMs === "number" ? opts!.nowMs : Date.now();
  const ensureFloor = opts?.ensureFloor !== false;

  const curBalance = snap.exists
    ? (() => {
        const u = asRecord(snap.data() as unknown, "USER_INVALIDO");
        const wb = readNumber(u, "walletBalance");
        const d = readNumber(u, "diamonds");
        const cur = isNumber(wb) ? wb : isNumber(d) ? d : 0;
        return cur;
      })()
    : 0;

  let effectiveCur = curBalance;
  let topupDelta = 0;

  // piso 50 por hora (server-authoritative)
  if (ensureFloor && effectiveCur < WALLET_MIN) {
    const u = snap.exists
      ? asRecord(snap.data() as unknown, "USER_INVALIDO")
      : undefined;

    const lastTopupMs = u ? readTimestampMs(u, "walletTopupAt") : undefined;

    const canTopup =
      typeof lastTopupMs !== "number" ||
      now - lastTopupMs >= WALLET_TOPUP_INTERVAL_MS;

    if (canTopup) {
      topupDelta = WALLET_MIN - effectiveCur; // > 0
      effectiveCur = WALLET_MIN;
    }
  }

  const next = effectiveCur + delta;
  if (next < 0) throw new Error("SALDO_INSUFICIENTE");

  // monta payload sem undefined
  const userPayload: Record<string, unknown> = {
    walletBalance: next,
    diamonds: next, // compatibilidade MVP
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (topupDelta > 0) {
    userPayload.walletTopupAt = FieldValue.serverTimestamp();
  }

  if (!snap.exists) {
    tx.set(
      userRef,
      { uid, ...userPayload, createdAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } else {
    tx.update(userRef, userPayload);
  }

  // ledger do topup (se ocorreu)
  if (topupDelta > 0) {
    const topupRef = adminDb.collection(COL.ledger).doc();
    tx.set(topupRef, {
      uid,
      delta: topupDelta,
      reason: "WALLET_FLOOR_TOPUP",
      meta: {
        min: WALLET_MIN,
        intervalMs: WALLET_TOPUP_INTERVAL_MS,
        via: "applyDiamondsDeltaTx",
        triggeredBy: reason,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // ledger do delta principal
  const ledgerRef = adminDb.collection(COL.ledger).doc();
  tx.set(ledgerRef, {
    uid,
    delta,
    reason,
    meta,
    createdAt: FieldValue.serverTimestamp(),
  });
}
