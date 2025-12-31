"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  status: "active" | "removed";
  createdAt?: Timestamp;
};

function mapPost(d: QueryDocumentSnapshot<DocumentData>): Post {
  const data = d.data();
  return {
    id: d.id,
    authorId: String(data.authorId ?? ""),
    authorName: String(data.authorName ?? "Usuário"),
    authorPhotoURL: (data.authorPhotoURL ?? null) as string | null,
    text: String(data.text ?? ""),
    status: (data.status ?? "active") as "active" | "removed",
    createdAt: data.createdAt as Timestamp | undefined,
  };
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Falha na operação";
}

export default function FeedPage() {
  const { user, loading } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  const canPost = useMemo(() => !loading && !!user, [loading, user]);

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => setPosts(snap.docs.map(mapPost)),
      () => {}
    );

    return () => unsub();
  }, []);

  async function publish() {
    if (!user) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    setErr(null);

    try {
      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName:
          user.displayName ||
          (user.email ? user.email.split("@")[0] : "Usuário"),
        authorPhotoURL: user.photoURL ?? null,
        text: trimmed,
        mediaUrls: [],
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setText("");
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feed</h1>
        <div className="text-sm opacity-80">
          <Link className="underline" href="/perfil">
            Perfil
          </Link>
        </div>
      </div>

      {!canPost && (
        <p className="mt-3 text-sm opacity-80">
          Para publicar, faça login em{" "}
          <Link className="underline" href="/login">
            /login
          </Link>
          .
        </p>
      )}

      <section className="mt-6 border rounded p-4">
        <h2 className="font-medium">Novo post</h2>

        <textarea
          className="mt-3 w-full border rounded px-3 py-2 min-h-[90px]"
          placeholder="Compartilhe uma curiosidade, dúvida ou descoberta sobre arqueologia..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canPost || busy}
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            className="rounded px-4 py-2 border disabled:opacity-50"
            onClick={publish}
            disabled={!canPost || busy || text.trim().length === 0}
          >
            {busy ? "Publicando..." : "Publicar"}
          </button>

          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {posts.length === 0 ? (
          <p className="opacity-70">Ainda não há posts.</p>
        ) : (
          posts.map((p) => (
            <article key={p.id} className="border rounded p-4">
              <div className="text-sm opacity-80">
                <span className="font-medium">{p.authorName}</span>
              </div>

              <p className="mt-2 whitespace-pre-wrap">{p.text}</p>

              <div className="mt-3 text-sm">
                <Link className="underline" href={`/post/${p.id}`}>
                  Ver detalhes
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
