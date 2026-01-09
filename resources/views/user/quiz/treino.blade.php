@extends('user.layouts.app')
@section('title','Modo Treino')

@section('content')
@php
  $music = [
    asset('musicas/musica.mp3'),
    asset('musicas/musica1.mp3'),
    asset('musicas/musica2.mp3'),
    asset('musicas/musica3.mp3'),
    asset('musicas/musica4.mp3'),
  ];
@endphp

<div class="space-y-4">
  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="text-sm text-zinc-500 dark:text-zinc-400">Quiz</div>
    <div class="mt-1 text-xl font-semibold">Modo Treino</div>
    <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
      10 perguntas aleatórias • 1 minuto por questão • Recompensa: <span class="font-semibold text-wine">+5 diamantes</span> ao concluir.
    </p>

    <div class="mt-4 flex flex-wrap gap-2">
      <button id="btnStart"
        class="rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm">
        Iniciar treino
      </button>

      <button id="btnReset"
        class="hidden rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        Reiniciar
      </button>

      <button id="btnSound"
        class="hidden rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        Som: ON
      </button>
    </div>

    <audio id="bgMusic" preload="auto" loop class="hidden"></audio>
  </div>

  <div id="cardGame" class="hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Progresso</div>
        <div class="mt-1 text-base font-semibold">
          <span id="progressText">1/10</span>
        </div>
      </div>

      <div class="text-right">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Tempo</div>
        <div class="mt-1 text-base font-semibold">
          <span id="timerText">01:00</span>
        </div>
        <div class="mt-1 h-1 w-28 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div id="timerBar" class="h-full w-full bg-wine"></div>
        </div>
      </div>
    </div>

    <div class="mt-4">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">Pergunta</div>
      <div id="questionText" class="mt-2 text-lg font-semibold leading-snug"></div>
    </div>

    <div id="choices" class="mt-4 grid gap-3 sm:grid-cols-2"></div>

    <div id="feedback" class="mt-4 hidden rounded-2xl p-4 text-sm"></div>
  </div>

  <div id="cardDone" class="hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="text-sm text-zinc-500 dark:text-zinc-400">Finalizado</div>
    <div class="mt-1 text-xl font-semibold">Treino concluído</div>

    <div class="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
      Acertos: <span id="doneCorrect" class="font-semibold">0</span> / 10
      <span class="text-zinc-400 dark:text-zinc-500">•</span>
      Recompensa: <span class="font-semibold text-wine">+<span id="doneReward">5</span> diamantes</span>
    </div>

    <div id="doneBalanceWrap" class="mt-2 hidden text-sm text-zinc-600 dark:text-zinc-300">
      Saldo atual: <span id="doneBalance" class="font-semibold"></span>
    </div>

    <div class="mt-4">
      <button id="btnPlayAgain"
        class="rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm">
        Jogar novamente
      </button>
    </div>
  </div>
</div>

<script>
(function () {
  const csrf = "{{ csrf_token() }}";
  const musicList = @json($music);

  const elStart = document.getElementById('btnStart');
  const elReset = document.getElementById('btnReset');
  const elSound = document.getElementById('btnSound');

  const cardGame = document.getElementById('cardGame');
  const cardDone = document.getElementById('cardDone');

  const progressText = document.getElementById('progressText');
  const timerText = document.getElementById('timerText');
  const timerBar = document.getElementById('timerBar');

  const questionText = document.getElementById('questionText');
  const choicesWrap = document.getElementById('choices');
  const feedback = document.getElementById('feedback');

  const doneCorrect = document.getElementById('doneCorrect');
  const doneReward = document.getElementById('doneReward');
  const doneBalanceWrap = document.getElementById('doneBalanceWrap');
  const doneBalance = document.getElementById('doneBalance');
  const btnPlayAgain = document.getElementById('btnPlayAgain');

  const audio = document.getElementById('bgMusic');

  let state = {
    seconds: 60,
    total: 10,
    question: null,
    timer: null,
    remain: 60,
    soundOn: true,
    locked: false,
  };

  function pickMusicAndPlay() {
    if (!audio) return;
    const pick = musicList[Math.floor(Math.random() * musicList.length)];
    audio.src = pick;
    if (state.soundOn) {
      audio.volume = 0.35;
      audio.play().catch(() => {
        // browsers podem bloquear; botão já foi clicado, normalmente vai.
      });
    }
  }

  function setSound(on) {
    state.soundOn = on;
    if (!audio) return;
    if (on) {
      audio.volume = 0.35;
      audio.play().catch(() => {});
      elSound.textContent = 'Som: ON';
    } else {
      audio.pause();
      elSound.textContent = 'Som: OFF';
    }
  }

  function mmss(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
  }

  function stopTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function startTimer(seconds) {
    stopTimer();
    state.remain = seconds;
    timerText.textContent = mmss(state.remain);
    timerBar.style.width = '100%';

    state.timer = setInterval(() => {
      state.remain -= 1;
      if (state.remain < 0) state.remain = 0;

      timerText.textContent = mmss(state.remain);
      const pct = (state.remain / seconds) * 100;
      timerBar.style.width = pct + '%';

      if (state.remain === 0) {
        stopTimer();
        // tempo esgotado -> envia null
        submitAnswer(null);
      }
    }, 1000);
  }

  function showFeedback(ok, msg) {
    feedback.classList.remove('hidden');
    feedback.className = 'mt-4 rounded-2xl p-4 text-sm ' + (ok
      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
      : 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200');
    feedback.textContent = msg;
  }

  function hideFeedback() {
    feedback.classList.add('hidden');
    feedback.textContent = '';
  }

  function renderQuestion(q, progress, seconds) {
    state.question = q;
    state.locked = false;

    hideFeedback();

    progressText.textContent = `${progress.index}/${progress.total}`;
    questionText.textContent = q.text || '(sem texto)';

    choicesWrap.innerHTML = '';
    const entries = Object.entries(q.choices || {});
    entries.forEach(([letter, text]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'group w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm ' +
        'hover:bg-zinc-50 active:scale-[0.99] transition dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900';

      btn.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-wine/10 text-sm font-bold text-wine dark:bg-wine/15 dark:text-rose-200">
            ${letter}
          </div>
          <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${escapeHtml(text)}</div>
        </div>
      `;
      btn.addEventListener('click', () => submitAnswer(letter));
      choicesWrap.appendChild(btn);
    });

    startTimer(seconds);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrf,
        'Accept': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Erro na requisição.');
    }
    return json;
  }

  async function startGame() {
    const data = await post("{{ route('user.quiz.treino.start') }}");

    cardDone.classList.add('hidden');
    cardGame.classList.remove('hidden');
    elReset.classList.remove('hidden');
    elSound.classList.remove('hidden');

    pickMusicAndPlay();
    setSound(true);

    state.total = data.total || 10;
    state.seconds = data.seconds || 60;

    renderQuestion(data.question, data.progress, state.seconds);
  }

  async function submitAnswer(letter) {
    if (state.locked) return;
    state.locked = true;

    stopTimer();

    try {
      const data = await post("{{ route('user.quiz.treino.answer') }}", {
        question_id: state.question.id,
        choice: letter,
      });

      const isCorrect = !!(data.last && data.last.isCorrect);
      const correctChoice = data.last ? data.last.correctChoice : null;

      if (letter === null) {
        showFeedback(false, `Tempo esgotado. Resposta correta: ${correctChoice ?? '-'}`);
      } else if (isCorrect) {
        showFeedback(true, 'Correto!');
      } else {
        showFeedback(false, `Incorreto. Correta: ${correctChoice ?? '-'}`);
      }

      setTimeout(() => {
        if (data.finished) {
          cardGame.classList.add('hidden');
          cardDone.classList.remove('hidden');

          doneCorrect.textContent = String(data.correct ?? 0);
          doneReward.textContent = String(data.reward ?? 0);

          if (typeof data.balance === 'number') {
            doneBalanceWrap.classList.remove('hidden');
            doneBalance.textContent = String(data.balance);
          } else {
            doneBalanceWrap.classList.add('hidden');
          }
        } else {
          renderQuestion(data.question, data.progress, data.seconds || state.seconds);
        }
      }, 650);

    } catch (e) {
      showFeedback(false, e.message || 'Erro ao enviar resposta.');
      state.locked = false;
    }
  }

  async function resetGame() {
    stopTimer();
    try { await post("{{ route('user.quiz.treino.reset') }}"); } catch (e) {}
    cardGame.classList.add('hidden');
    cardDone.classList.add('hidden');
    elReset.classList.add('hidden');
    elSound.classList.add('hidden');
    hideFeedback();
    if (audio) audio.pause();
  }

  elStart.addEventListener('click', () => startGame().catch(err => alert(err.message)));
  elReset.addEventListener('click', () => resetGame());
  btnPlayAgain.addEventListener('click', async () => {
    await resetGame();
    await startGame().catch(err => alert(err.message));
  });

  elSound.addEventListener('click', () => setSound(!state.soundOn));
})();
</script>
@endsection
