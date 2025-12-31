"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

type Post = {
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  status: "active" | "removed";
};

type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  status: "active" | "removed";
  createdAt?: Timestamp;
};

function mapComment(d: QueryDocumentSnapshot<DocumentData>): Comment {
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

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const router = useRouter();

  const { user, loading } = useAuth();
  const canInteract = useMemo(() => !loading && !!user, [loading, user]);

  const [post, setPost] = useState<Post | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [busyComment, setBusyComment] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [err, setErr] = useState<string | null>(null);
  const isOwner = !!user && !!post && post.authorId === user.uid;

  // 1) Escuta o post em tempo real (se for removido, vira "notFound")
  useEffect(() => {
    const ref = doc(db, "posts", postId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          setPost(null);
          return;
        }
        const data = snap.data() as Post;
        if (data.status !== "active") {
          setNotFound(true);
          setPost(null);
          return;
        }
        setNotFound(false);
        setPost(data);
      },
      () => {
        setNotFound(true);
        setPost(null);
      }
    );

    return () => unsub();
  }, [postId]);

  // 2) Comentários: só assina quando o post está ativo
  useEffect(() => {
    if (!post) return;

    const q = query(
      collection(db, "posts", postId, "comments"),
      where("status", "==", "active"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => setComments(snap.docs.map(mapComment)),
      () => {}
    );

    return () => unsub();
  }, [post, postId]);

  // 3) Like do usuário + contagem de likes: só assina quando o post está ativo
  useEffect(() => {
    if (!post) return;

    // contagem (snapshot do subcollection)
    const likesCol = collection(db, "posts", postId, "likes");
    const unsubCount = onSnapshot(
      likesCol,
      (snap) => setLikeCount(snap.size),
      () => setLikeCount(0)
    );

    // liked (doc do uid)
    if (!user) {
      setLiked(false);
      return () => unsubCount();
    }

    const likeRef = doc(db, "posts", postId, "likes", user.uid);
    const unsubLiked = onSnapshot(likeRef, (snap) => setLiked(snap.exists()));

    return () => {
      unsubLiked();
      unsubCount();
    };
  }, [post, postId, user]);

  async function publishComment() {
    if (!user || !post) return;
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setErr(null);
    setBusyComment(true);

    try {
      await addDoc(collection(db, "posts", postId, "comments"), {
        authorId: user.uid,
        authorName:
          user.displayName ||
          (user.email ? user.email.split("@")[0] : "Usuário"),
        authorPhotoURL: user.photoURL ?? null,
        text: trimmed,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCommentText("");
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setBusyComment(false);
    }
  }

  async function toggleLike() {
    if (!user || !post) return;

    setErr(null);
    const likeRef = doc(db, "posts", postId, "likes", user.uid);

    try {
      if (liked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, { createdAt: serverTimestamp() });
      }
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    }
  }

  async function removePost() {
    if (!user || !post) return;
    if (post.authorId !== user.uid) return;

    setErr(null);
    try {
      await updateDoc(doc(db, "posts", postId), {
        status: "removed",
        updatedAt: serverTimestamp(),
      });
      router.replace("/feed");
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    }
  }

  async function removeComment(commentId: string) {
    if (!user || !post) return;

    setErr(null);
    try {
      await updateDoc(doc(db, "posts", postId, "comments", commentId), {
        status: "removed",
        updatedAt: serverTimestamp(),
      });
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    }
  }

  if (notFound) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Post</h1>
        <p className="mt-3 opacity-80">Post não encontrado ou removido.</p>
        <Link className="underline mt-4 inline-block" href="/feed">
          Voltar ao feed
        </Link>
      </main>
    );
  }

  if (!post) {
    return <main className="p-6 max-w-2xl mx-auto">Carregando...</main>;
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Link className="underline" href="/feed">
          ← Feed
        </Link>
        <Link className="underline" href="/perfil">
          Perfil
        </Link>
      </div>

      <article className="mt-4 border rounded p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm opacity-80">
            <span className="font-medium">{post.authorName}</span>
          </div>

          {isOwner && (
            <button
              className="rounded px-3 py-2 border"
              onClick={removePost}
              title="Remove o post (soft delete)"
            >
              Remover
            </button>
          )}
        </div>

        <p className="mt-2 whitespace-pre-wrap">{post.text}</p>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="rounded px-3 py-2 border disabled:opacity-50"
            onClick={toggleLike}
            disabled={!canInteract}
            title={!canInteract ? "Faça login para curtir" : ""}
          >
            {liked ? "Descurtir" : "Curtir"}
          </button>

          <span className="text-sm opacity-80">{likeCount} curtidas</span>

          {!canInteract && (
            <span className="text-sm opacity-70">
              Faça login em{" "}
              <Link className="underline" href="/login">
                /login
              </Link>{" "}
              para interagir.
            </span>
          )}
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </article>

      <section className="mt-6 border rounded p-4">
        <h2 className="font-medium">Comentários</h2>

        <textarea
          className="mt-3 w-full border rounded px-3 py-2 min-h-[80px]"
          placeholder="Comente com respeito e objetividade..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          disabled={!canInteract || busyComment}
        />

        <div className="mt-3">
          <button
            className="rounded px-4 py-2 border disabled:opacity-50"
            onClick={publishComment}
            disabled={
              !canInteract || busyComment || commentText.trim().length === 0
            }
          >
            {busyComment ? "Enviando..." : "Comentar"}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {comments.length === 0 ? (
            <p className="opacity-70">Sem comentários ainda.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="border rounded p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm opacity-80">
                    <span className="font-medium">{c.authorName}</span>
                  </div>

                  {user && c.authorId === user.uid && (
                    <button
                      className="rounded px-3 py-2 border"
                      onClick={() => removeComment(c.id)}
                      title="Remove o comentário (soft delete)"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <p className="mt-2 whitespace-pre-wrap">{c.text}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
