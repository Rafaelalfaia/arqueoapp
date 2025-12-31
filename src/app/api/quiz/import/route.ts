import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type Difficulty = "easy" | "medium" | "hard";
type ExcelRow = Record<string, unknown>;
type ImportError = { row: number; field: string; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Unknown error";
}

function jsonError(status: number, error: string, detail?: string) {
  const payload =
    process.env.NODE_ENV === "production"
      ? { ok: false as const, error }
      : { ok: false as const, error, detail };

  return NextResponse.json(payload, { status });
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

function getRoleFromToken(decoded: DecodedIdToken): string | null {
  const rec = decoded as unknown as Record<string, unknown>;
  const role = rec?.role;
  return typeof role === "string" ? role : null;
}

async function isAdminByFirestore(uid: string): Promise<boolean> {
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) return false;
  const data = snap.data() as unknown;
  if (!isRecord(data)) return false;
  return data.role === "admin";
}

function normStr(v: unknown): string {
  return String(v ?? "").trim();
}

function normBool(v: unknown, def = true): boolean {
  const s = normStr(v).toLowerCase();
  if (s === "") return def;
  if (["true", "1", "sim", "yes", "y"].includes(s)) return true;
  if (["false", "0", "nao", "não", "no", "n"].includes(s)) return false;
  return def;
}

function normDifficulty(v: unknown): Difficulty | null {
  const s = normStr(v).toLowerCase();
  if (["easy", "facil", "fácil"].includes(s)) return "easy";
  if (["medium", "medio", "médio"].includes(s)) return "medium";
  if (["hard", "dificil", "difícil"].includes(s)) return "hard";
  return null;
}

function cell(row: ExcelRow, key: string): unknown {
  return row[key];
}

export async function POST(req: Request) {
  try {
    // 1) Auth
    const token = getBearerToken(req);
    if (!token) return jsonError(401, "missing_token");

    let decoded: DecodedIdToken;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch (e: unknown) {
      console.error("verifyIdToken failed:", e);
      return jsonError(401, "invalid_token", getErrorMessage(e));
    }

    // 2) Permissão: claim ou users/{uid}.role
    const roleClaim = getRoleFromToken(decoded);
    const okByClaim = roleClaim === "admin";
    const okByDb = okByClaim ? true : await isAdminByFirestore(decoded.uid);

    if (!okByDb) return jsonError(403, "forbidden");

    // 3) Arquivo
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) return jsonError(400, "missing_file");

    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return jsonError(400, "empty_workbook");

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: "" });

    // 4) Validar
    const errors: ImportError[] = [];
    const docs: Array<{
      text: string;
      choices: string[];
      correctIndex: number;
      difficulty: Difficulty;
      active: boolean;
    }> = [];

    rows.forEach((r, idx) => {
      const rowNum = idx + 2;

      const text = normStr(cell(r, "text"));
      const c1 = normStr(cell(r, "choice1"));
      const c2 = normStr(cell(r, "choice2"));
      const c3 = normStr(cell(r, "choice3"));
      const c4 = normStr(cell(r, "choice4"));

      if (!text && !c1 && !c2 && !c3 && !c4) return;

      if (!text) {
        errors.push({
          row: rowNum,
          field: "text",
          message: "Texto da pergunta vazio",
        });
        return;
      }

      const choices = [c1, c2, c3, c4];
      if (choices.some((c) => !c)) {
        errors.push({
          row: rowNum,
          field: "choices",
          message: "Preencha choice1..choice4",
        });
        return;
      }

      const correctRaw = Number(normStr(cell(r, "correct")));
      if (!Number.isFinite(correctRaw) || correctRaw < 1 || correctRaw > 4) {
        errors.push({ row: rowNum, field: "correct", message: "Use 1,2,3,4" });
        return;
      }
      const correctIndex = correctRaw - 1;

      const difficulty = normDifficulty(cell(r, "difficulty"));
      if (!difficulty) {
        errors.push({
          row: rowNum,
          field: "difficulty",
          message: "Use easy/medium/hard (ou Fácil/Médio/Difícil)",
        });
        return;
      }

      const active = normBool(cell(r, "active"), true);

      docs.push({ text, choices, correctIndex, difficulty, active });
    });

    try {
      await adminDb().collection("_health").limit(1).get();
    } catch (e: unknown) {
      console.error("Firestore init failed:", e);
      return NextResponse.json(
        {
          ok: false,
          error: "server_error",
          detail: `firestore_init_failed: ${getErrorMessage(e)}`,
        },
        { status: 500 }
      );
    }

    // 5) Batch write
    const db = adminDb();
    const col = db.collection("quiz_questions");

    let imported = 0;
    const BATCH_LIMIT = 450;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const d of chunk) {
        const ref = col.doc();
        batch.set(ref, {
          text: d.text,
          choices: d.choices,
          correctIndex: d.correctIndex,
          difficulty: d.difficulty,
          active: d.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: decoded.uid,
        });
      }

      await batch.commit();
      imported += chunk.length;
    }

    return NextResponse.json({
      ok: true,
      imported,
      totalRows: rows.length,
      validDocs: docs.length,
      errors,
    });
  } catch (e: unknown) {
    console.error("IMPORT route crashed:", e);
    return jsonError(500, "server_error", getErrorMessage(e));
  }
}
