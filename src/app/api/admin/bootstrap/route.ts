import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";

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
function getErrorCode(e: unknown): string | undefined {
  if (!isRecord(e)) return undefined;
  const c = e["code"];
  return typeof c === "string" ? c : undefined;
}

export async function POST(req: Request) {
  try {
    const secretHeader = req.headers.get("x-bootstrap-secret") ?? "";
    const secretEnv = process.env.BOOTSTRAP_ADMIN_SECRET ?? "";
    if (!secretEnv || secretHeader !== secretEnv) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const raw: unknown = await req.json();
    if (!isRecord(raw)) {
      return NextResponse.json({ error: "DADOS_INVALIDOS" }, { status: 400 });
    }

    const email = (readString(raw, "email") ?? "").trim();
    const uid = (readString(raw, "uid") ?? "").trim();
    if (!email && !uid) {
      return NextResponse.json(
        { error: "email ou uid obrigatório" },
        { status: 400 }
      );
    }

    const user = email
      ? await adminAuth.getUserByEmail(email)
      : await adminAuth.getUser(uid);

    const prev = isRecord(user.customClaims) ? user.customClaims : {};

    await adminAuth.setCustomUserClaims(user.uid, {
      ...prev,
      admin: true,
      role: "admin",
    });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (e: unknown) {
    const code = getErrorCode(e);
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      code === "auth/user-not-found"
        ? 404
        : code?.includes("permission")
        ? 403
        : 500;

    return NextResponse.json({ error: msg, code }, { status });
  }
}
