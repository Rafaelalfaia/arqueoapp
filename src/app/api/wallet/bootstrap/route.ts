import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COL } from "@/lib/tournament/config";
import { requireUser } from "@/lib/tournament/server";

export const runtime = "nodejs";

const MIN_WALLET = 50;
const TOPUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readNumber(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function readTimestampMs(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const v = obj[key];
  if (v instanceof Timestamp) return v.toMillis();
  if (v && typeof v === "object" && "toMillis" in v) {
    const tm = (v as { toMillis?: unknown }).toMillis;
    if (typeof tm === "function") {
      const ms = (v as { toMillis: () => number }).toMillis();
      return Number.isFinite(ms) ? ms : undefined;
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const u = await requireUser(req);
    const uid = u.uid;

    const now = Date.now();
    const userRef = adminDb.collection(COL.users).doc(uid);

    let resultBalance = 0;
    let applied = false;

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      const data = snap.exists ? snap.data() : undefined;
      const obj = data && isRecord(data) ? data : undefined;

      const curWB = obj ? readNumber(obj, "walletBalance") : undefined;
      const curD = obj ? readNumber(obj, "diamonds") : undefined;
      const cur =
        typeof curWB === "number" ? curWB : typeof curD === "number" ? curD : 0;

      const lastTopupMs = obj
        ? readTimestampMs(obj, "walletTopupAt")
        : undefined;
      const canTopup =
        typeof lastTopupMs !== "number" ||
        now - lastTopupMs >= TOPUP_INTERVAL_MS;

      const shouldTopup = cur < MIN_WALLET && canTopup;

      resultBalance = shouldTopup ? MIN_WALLET : cur;

      // se não existe doc, cria apenas o necessário (SEM role)
      if (!snap.exists) {
        applied = true;

        tx.set(
          userRef,
          {
            uid,
            walletBalance: MIN_WALLET,
            diamonds: MIN_WALLET,
            walletTopupAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const ledgerRef = adminDb.collection(COL.ledger).doc();
        tx.set(ledgerRef, {
          uid,
          delta: MIN_WALLET - cur, // cur é 0 aqui
          reason: "WALLET_FLOOR_TOPUP",
          meta: { min: MIN_WALLET, via: "bootstrap" },
          createdAt: FieldValue.serverTimestamp(),
        });

        return;
      }

      if (!shouldTopup) return;

      applied = true;

      tx.update(userRef, {
        walletBalance: MIN_WALLET,
        diamonds: MIN_WALLET,
        walletTopupAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const delta = MIN_WALLET - cur;
      const ledgerRef = adminDb.collection(COL.ledger).doc();
      tx.set(ledgerRef, {
        uid,
        delta,
        reason: "WALLET_FLOOR_TOPUP",
        meta: { min: MIN_WALLET, via: "bootstrap" },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      ok: true,
      walletBalance: resultBalance,
      applied,
      min: MIN_WALLET,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
