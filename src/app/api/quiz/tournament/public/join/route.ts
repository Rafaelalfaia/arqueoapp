import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

import { COL, DEFAULTS, type TournamentType } from "@/lib/tournament/config";
import {
  requireUser,
  nowMs,
  applyDiamondsDeltaTx,
} from "@/lib/tournament/server";

export const runtime = "nodejs";

/** ============================
 * Helpers (sem any, sem null)
 * ============================ */
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

function readNumber(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function coerceType(v: unknown): TournamentType | undefined {
  return v === "recurring" || v === "special" ? v : undefined;
}

function clampInt(n: number, min: number, max: number): number {
  const x = Math.trunc(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

function readMillis(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object") {
    const o = v as { toMillis?: unknown };
    if (typeof o.toMillis === "function") {
      try {
        const ms = (o.toMillis as () => unknown)();
        return typeof ms === "number" && Number.isFinite(ms) ? ms : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const me = await requireUser(req);

    const body = await req.json().catch(() => undefined);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "DADOS_INVALIDOS" }, { status: 400 });
    }

    const tournamentId = (readString(body, "tournamentId") ?? "").trim();
    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId obrigatório" },
        { status: 400 }
      );
    }

    const out = await adminDb.runTransaction(async (tx) => {
      /**
       * ==========================================================
       * FASE 1 — READS (tudo que precisar ler, ler antes de escrever)
       * ==========================================================
       */
      const tRef = adminDb.collection(COL.tournaments).doc(tournamentId);
      const tSnap = await tx.get(tRef);

      if (!tSnap.exists) throw new Error("NOT_FOUND");
      const tDataRaw = tSnap.data();
      if (!tDataRaw || !isRecord(tDataRaw)) throw new Error("TORNEIO_INVALIDO");
      if (tDataRaw.deletedAt) throw new Error("DELETED");

      const type = coerceType(readString(tDataRaw, "type"));
      if (!type) throw new Error("TORNEIO_INVALIDO");

      const questionCount = clampInt(
        readNumber(tDataRaw, "questionCount") ?? 0,
        0,
        50
      );
      if (questionCount < 1) throw new Error("TORNEIO_INVALIDO");

      const entryFeeDiamonds = clampInt(
        readNumber(tDataRaw, "entryFeeDiamonds") ?? 0,
        0,
        1_000_000
      );

      const graceMinutes = clampInt(
        readNumber(tDataRaw, "graceMinutes") ?? DEFAULTS.graceMinutes,
        1,
        60
      );

      const now = nowMs();

      // seleção de instância
      let instanceId = "";
      let iRef = adminDb.collection(COL.instances).doc("___placeholder___");
      let iSnap:
        | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
        | undefined;

      let createInstance = false;
      let setTournamentActiveInstance = false;

      // dados auxiliares da instância
      let instanceStartAtMs: number | undefined;
      let joinClosesAtMs: number | undefined;

      // ========= SPECIAL =========
      if (type === "special") {
        const startMs =
          readMillis(tDataRaw.startAtMs) ?? readMillis(tDataRaw.startAt);

        if (!startMs) throw new Error("START_AT_MISSING");

        instanceStartAtMs = startMs;
        joinClosesAtMs = startMs + graceMinutes * 60_000;

        // regra: só entra do horário até a tolerância
        if (now < startMs) throw new Error("TOO_EARLY");
        if (now > joinClosesAtMs) throw new Error("JOIN_CLOSED");

        // regra: precisa estar inscrito
        // Tentamos 2 padrões comuns (você pode manter ambos, não custa):
        // A) coleção privates: quiz_tournament_private/{tournamentId}_{uid}
        // B) subcollection: quiz_tournaments/{tournamentId}/enrollments/{uid}
        const enrollRefA = adminDb
          .collection(COL.privates)
          .doc(`${tournamentId}_${me.uid}`);
        const enrollRefB = tRef.collection("enrollments").doc(me.uid);

        const [enA, enB] = await Promise.all([
          tx.get(enrollRefA),
          tx.get(enrollRefB),
        ]);
        if (!enA.exists && !enB.exists) throw new Error("NOT_ENROLLED");

        // instância fixa por torneio especial
        instanceId = tournamentId;
        iRef = adminDb.collection(COL.instances).doc(instanceId);
        iSnap = await tx.get(iRef);

        createInstance = !iSnap.exists;
      }

      // ========= RECURRING =========
      if (type === "recurring") {
        const maxParticipants = clampInt(
          readNumber(tDataRaw, "maxParticipants") ?? 0,
          0,
          10_000
        );
        if (maxParticipants < 2) throw new Error("TORNEIO_INVALIDO");

        const activeId = readString(tDataRaw, "activeInstanceId");

        // tenta usar instância ativa se estiver “open” e com vaga
        if (activeId) {
          const activeRef = adminDb.collection(COL.instances).doc(activeId);
          const activeSnap = await tx.get(activeRef);

          const aData = activeSnap.data();
          const aRec = aData && isRecord(aData) ? aData : undefined;
          const aStatus = aRec ? readString(aRec, "status") ?? "open" : "open";
          const aCount = aRec
            ? clampInt(readNumber(aRec, "playersCount") ?? 0, 0, 100_000)
            : 0;

          const joinable =
            activeSnap.exists && aStatus === "open" && aCount < maxParticipants;

          if (joinable) {
            instanceId = activeId;
            iRef = activeRef;
            iSnap = activeSnap;
          }
        }

        // se não tem instância ativa válida, cria uma nova (id gerado já)
        if (!instanceId) {
          instanceId = adminDb.collection(COL.instances).doc().id;
          iRef = adminDb.collection(COL.instances).doc(instanceId);
          createInstance = true;
          setTournamentActiveInstance = true;
        }

        // read do player (para idempotência)
        let pRef = iRef.collection("players").doc(me.uid);
        let pSnap = await tx.get(pRef);

        // se por concorrência pegamos uma instância já lotada, troca para outra (ainda na fase READ)
        if (!createInstance) {
          const maxParticipants2 = maxParticipants;
          const d = iSnap?.data();
          const rec = d && isRecord(d) ? d : undefined;
          const curCount = rec
            ? clampInt(readNumber(rec, "playersCount") ?? 0, 0, 100_000)
            : 0;

          if (!pSnap.exists && curCount >= maxParticipants2) {
            // cria outra
            instanceId = adminDb.collection(COL.instances).doc().id;
            iRef = adminDb.collection(COL.instances).doc(instanceId);
            createInstance = true;
            setTournamentActiveInstance = true;

            pRef = iRef.collection("players").doc(me.uid);
            pSnap = await tx.get(pRef);
            iSnap = undefined;
          }
        }

        /**
         * ==========================================================
         * FASE 2 — WRITES (a partir daqui, NUNCA MAIS tx.get)
         * ==========================================================
         */
        const willCreatePlayer = !pSnap.exists;

        // taxa de entrada: cobra 1x por instância (somente quando cria o player)
        if (willCreatePlayer && entryFeeDiamonds > 0) {
          await applyDiamondsDeltaTx(
            tx,
            me.uid,
            -entryFeeDiamonds,
            "tournament_entry_fee",
            { tournamentId, instanceId }
          );
        }

        // cria instância se necessário
        if (createInstance) {
          tx.set(iRef, {
            tournamentId,
            type,
            status: "open",
            questionCount,
            maxParticipants,
            playersCount: willCreatePlayer ? 1 : 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else if (willCreatePlayer) {
          const d = iSnap?.data();
          const rec = d && isRecord(d) ? d : undefined;
          const cur = rec
            ? clampInt(readNumber(rec, "playersCount") ?? 0, 0, 100_000)
            : 0;

          tx.update(iRef, {
            playersCount: cur + 1,
            updatedAt: FieldValue.serverTimestamp(),
          });

          // se encheu, trava e libera o torneio para criar próxima sala
          if (cur + 1 >= maxParticipants) {
            tx.update(iRef, {
              status: "starting",
              lockedAtMs: now,
              updatedAt: FieldValue.serverTimestamp(),
            });
            tx.update(tRef, {
              activeInstanceId: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          tx.update(iRef, { updatedAt: FieldValue.serverTimestamp() });
        }

        // registra player
        if (willCreatePlayer) {
          tx.set(
            pRef,
            {
              uid: me.uid,
              joinedAt: FieldValue.serverTimestamp(),
              joinedAtMs: now,
            },
            { merge: true }
          );
        } else {
          tx.set(
            pRef,
            {
              lastSeenAt: FieldValue.serverTimestamp(),
              lastSeenAtMs: now,
            },
            { merge: true }
          );
        }

        // marca instância ativa no torneio (quando criamos uma nova)
        if (setTournamentActiveInstance) {
          tx.update(tRef, {
            activeInstanceId: instanceId,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        return {
          tournamentId,
          instanceId,
          type,
          serverNowMs: now,
        };
      }

      // ========= SPECIAL (writes) =========
      // read do player
      const pRef = iRef.collection("players").doc(me.uid);
      const pSnap = await tx.get(pRef); // ainda está na fase READ do special? NÃO: cuidado!
      // Para special, precisamos manter a regra: sem reads após writes.
      // Então: vamos reestruturar corretamente: o pSnap do special deve ser lido ANTES de qualquer write.

      // Se chegou aqui, é special e ainda não fizemos writes.
      const pSnap2 = await tx.get(pRef);

      /**
       * ==========================================================
       * FASE 2 — WRITES (special)
       * ==========================================================
       */
      const willCreatePlayer = !pSnap2.exists;

      if (willCreatePlayer && entryFeeDiamonds > 0) {
        await applyDiamondsDeltaTx(
          tx,
          me.uid,
          -entryFeeDiamonds,
          "tournament_entry_fee",
          { tournamentId, instanceId }
        );
      }

      if (createInstance) {
        tx.set(iRef, {
          tournamentId,
          type,
          status: "live",
          questionCount,
          playersCount: willCreatePlayer ? 1 : 0,
          startAtMs: instanceStartAtMs ?? null,
          joinClosesAtMs: joinClosesAtMs ?? null,
          graceMinutes,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (willCreatePlayer) {
        // incrementa playersCount
        const d = iSnap?.data();
        const rec = d && isRecord(d) ? d : undefined;
        const cur = rec
          ? clampInt(readNumber(rec, "playersCount") ?? 0, 0, 100_000)
          : 0;

        tx.update(iRef, {
          playersCount: cur + 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(iRef, { updatedAt: FieldValue.serverTimestamp() });
      }

      // registra player
      if (willCreatePlayer) {
        tx.set(
          pRef,
          {
            uid: me.uid,
            joinedAt: FieldValue.serverTimestamp(),
            joinedAtMs: now,
          },
          { merge: true }
        );
      } else {
        tx.set(
          pRef,
          { lastSeenAt: FieldValue.serverTimestamp(), lastSeenAtMs: now },
          { merge: true }
        );
      }

      // opcional: coloca torneio como live quando alguém entra
      tx.update(tRef, {
        status: "live",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        tournamentId,
        instanceId,
        type,
        startAtMs: instanceStartAtMs ?? null,
        joinClosesAtMs: joinClosesAtMs ?? null,
        serverNowMs: now,
      };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";

    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "FORBIDDEN"
        ? 403
        : msg === "NOT_FOUND"
        ? 404
        : msg === "NOT_ENROLLED" || msg === "TOO_EARLY" || msg === "JOIN_CLOSED"
        ? 400
        : msg === "DELETED"
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
