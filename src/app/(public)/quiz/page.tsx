import Link from "next/link";

export default function QuizHome() {
  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Quiz</h1>
      <p className="mt-2 opacity-80">Escolha um modo de jogo.</p>

      <div className="mt-6 grid gap-4">
        <Link
          className="border rounded p-4 hover:opacity-90"
          href="/quiz/classico"
        >
          <div className="font-medium">Clássico</div>
          <div className="text-sm opacity-80">
            Treino (MVP) — pontuação calculada no servidor.
          </div>
        </Link>

        <Link
          className="border rounded p-4 hover:opacity-90"
          href="/quiz/amizade"
        >
          <div className="font-medium">Amizade</div>
          <div className="text-sm opacity-80">
            Sala por código/link • lobby em tempo real • 2–8 jogadores.
          </div>
        </Link>

        <div className="border rounded p-4 opacity-50">
          <div className="font-medium">Torneio</div>
          <div className="text-sm">Em breve</div>
        </div>

        <div className="border rounded p-4 opacity-50">
          <div className="font-medium">Tatuzinho</div>
          <div className="text-sm">Em breve</div>
        </div>

        <Link className="underline text-sm" href="/quiz/historico">
          Ver histórico
        </Link>
      </div>
    </main>
  );
}
