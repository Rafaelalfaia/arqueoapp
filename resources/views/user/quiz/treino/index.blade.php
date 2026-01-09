@extends('user.layouts.app')
@section('title','Quiz • Treino')
@section('topbar_title','Treino')

@section('content')
@php
  $music = [
    asset('musicas/musica.mp3'),
    asset('musicas/musica1.mp3'),
    asset('musicas/musica2.mp3'),
    asset('musicas/musica3.mp3'),
    asset('musicas/musica4.mp3'),
  ];

  $sfxCorrect = [
    asset('musicas/certo1.mp3'),
    asset('musicas/certo2.mp3'),
    asset('musicas/certo3.mp3'),
  ];

  $sfxWrong = [
    asset('musicas/errou1.mp3'),
    asset('musicas/errou2.mp3'),
    asset('musicas/errou3.mp3'),
  ];
@endphp

<div class="space-y-4">
  {{-- Header --}}
  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Modo</div>
        <div class="mt-1 text-xl font-semibold">Treino</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          10 perguntas aleatórias • 1 minuto por questão • Recompensa:
          <span class="font-semibold text-wine">+5 diamantes</span> se acertar <span class="font-semibold">mais que 50%</span> (6+).
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button id="btnStart"
          class="inline-flex items-center justify-center rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition">
          Iniciar
        </button>

        <button id="btnReset"
          class="hidden inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-[0.99] transition
                 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
          Reiniciar
        </button>

        <button id="btnSound"
          class="hidden inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-[0.99] transition
                 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
          Som: ON
        </button>
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Perguntas</div>
        <div class="mt-1 text-sm font-semibold">10 aleatórias</div>
        <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Uma por vez</div>
      </div>
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Tempo</div>
        <div class="mt-1 text-sm font-semibold">60s por questão</div>
        <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Auto-avança ao zerar</div>
      </div>
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Prêmio</div>
        <div class="mt-1 text-sm font-semibold text-wine">+5 diamantes</div>
        <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">somente com 6+ acertos</div>
      </div>
    </div>

    {{-- BG music + SFX --}}
    <audio id="bgMusic" preload="auto" loop class="hidden"></audio>
    <audio id="sfxAudio" preload="auto" class="hidden"></audio>
  </div>

  {{-- Game card --}}
  <div id="cardGame" class="hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Progresso</div>
        <div class="mt-1 text-base font-semibold">
          <span id="progressText">—</span>
        </div>
      </div>

      <div class="text-right">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Tempo</div>
        <div class="mt-1 text-base font-semibold">
          <span id="timerText">01:00</span>
        </div>

        <div class="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
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

    <div class="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
      <span>Regra do prêmio: 6+ acertos.</span>
      <span class="inline-flex items-center rounded-2xl bg-wine/10 px-3 py-1 font-semibold text-wine dark:bg-wine/15 dark:text-rose-200">
        +5 diamantes
      </span>
    </div>
  </div>

  {{-- Done card --}}
  <div id="cardDone" class="hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="text-sm text-zinc-500 dark:text-zinc-400">Finalizado</div>
    <div class="mt-1 text-xl font-semibold">Treino concluído</div>

    <div class="mt-3 grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Acertos</div>
        <div class="mt-1 text-lg font-semibold"><span id="doneCorrect">0</span>/10</div>
      </div>
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Recompensa</div>
        <div class="mt-1 text-lg font-semibold text-wine">+<span id="doneReward">0</span></div>
        <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">se 6+ acertos</div>
      </div>
      <div id="doneBalanceWrap" class="hidden rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Saldo</div>
        <div class="mt-1 text-lg font-semibold"><span id="doneBalance">—</span></div>
      </div>
    </div>

    <div id="doneMsg"
         class="mt-3 hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button id="btnPlayAgain"
        class="inline-flex items-center justify-center rounded-2xl bg-wine px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition">
        Jogar novamente
      </button>

      <a href="{{ route('user.quiz') }}"
        class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-[0.99] transition
               dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
        Voltar ao Quiz
      </a>
    </div>
  </div>
</div>

<script>
(function () {
  const csrf = "{{ csrf_token() }}";

  const musicList = @json($music);
  const sfxCorrectList = @json($sfxCorrect);
  const sfxWrongList = @json($sfxWrong);

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
  const doneMsg = document.getElementById('doneMsg');
  const btnPlayAgain = document.getElementById('btnPlayAgain');

  const bgAudio = document.getElementById('bgMusic');
  const sfxAudio = document.getElementById('sfxAudio');

  const state = {
    seconds: 60,
    total: 10,
    question: null,
    timer: null,
    remain: 60,
    soundOn: true,
    locked: false,
    started: false,
  };

  function pick(list) {
    if (!Array.isArray(list) || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function playBgMusic() {
    if (!bgAudio) return;
    const src = pick(musicList);
    if (!src) return;
    bgAudio.src = src;
    bgAudio.volume = 0.35;
    if (state.soundOn) bgAudio.play().catch(() => {});
  }

  function pauseBgMusic() {
    if (!bgAudio) return;
    bgAudio.pause();
  }

  function resumeBgMusic() {
    if (!bgAudio) return;
    if (!state.soundOn) return;
    if (!state.started) return;
    bgAudio.play().catch(() => {});
  }

  function playSfx(isCorrect) {
    if (!state.soundOn) return;
    if (!sfxAudio) return;

    pauseBgMusic();

    const list = isCorrect ? sfxCorrectList : sfxWrongList;
    const src = pick(list);
    if (!src) return;

    sfxAudio.src = src;
    sfxAudio.currentTime = 0;
    sfxAudio.volume = 0.85;
    sfxAudio.play().catch(() => {});
  }

  if (sfxAudio) {
    sfxAudio.addEventListener('ended', () => {
      // volta a música de fundo após o áudio de acerto/erro
      resumeBgMusic();
    });
  }

  function setSound(on) {
    state.soundOn = !!on;

    if (elSound) elSound.textContent = on ? 'Som: ON' : 'Som: OFF';

    if (!bgAudio || !sfxAudio) return;

    if (on) {
      // retoma bg se estiver em jogo
      resumeBgMusic();
    } else {
      bgAudio.pause();
      sfxAudio.pause();
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
      timerBar.style.width = ((state.remain / seconds) * 100) + '%';

      if (state.remain === 0) {
        stopTimer();
        submitAnswer(null); // tempo esgotado
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

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function renderQuestion(q, progress, seconds) {
    state.question = q;
    state.locked = false;

    hideFeedback();

    progressText.textContent = `${progress.index}/${progress.total}`;
    questionText.textContent = q.text || '(sem texto)';

    choicesWrap.innerHTML = '';

    const entries = Object.entries(q.choices || {});
    if (!entries.length) {
      const div = document.createElement('div');
      div.className = 'rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300';
      div.textContent = 'Questão sem alternativas configuradas.';
      choicesWrap.appendChild(div);
    } else {
      entries.forEach(([letter, text]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'group w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm ' +
          'hover:bg-zinc-50 active:scale-[0.99] transition ' +
          'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900';

        btn.innerHTML = `
          <div class="flex items-start gap-3">
            <div class="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-2xl bg-wine/10 text-sm font-extrabold text-wine dark:bg-wine/15 dark:text-rose-200">
              ${letter}
            </div>
            <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${escapeHtml(text)}</div>
          </div>
        `;

        btn.addEventListener('click', () => submitAnswer(letter));
        choicesWrap.appendChild(btn);
      });
    }

    startTimer(seconds);
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
    if (!res.ok) throw new Error(json.message || 'Erro na requisição.');
    return json;
  }

  async function startGame() {
    const data = await post("{{ route('user.quiz.treino.start') }}");

    state.started = true;

    cardDone.classList.add('hidden');
    cardGame.classList.remove('hidden');

    elReset.classList.remove('hidden');
    elSound.classList.remove('hidden');

    // inicia música de fundo
    playBgMusic();
    setSound(true);

    state.total = data.total || 10;
    state.seconds = data.seconds || 60;

    renderQuestion(data.question, data.progress, state.seconds);
  }

  async function submitAnswer(letter) {
    if (!state.started) return;
    if (state.locked) return;

    state.locked = true;
    stopTimer();

    try {
      const data = await post("{{ route('user.quiz.treino.answer') }}", {
        question_id: state.question.id,
        choice: letter,
      });

      const last = data.last || {};
      const isCorrect = !!last.isCorrect;
      const correctChoice = last.correctChoice ?? null;
      const timedOut = !!last.timedOut;

      // toca SFX (acerto/erro) e pausa bg
      playSfx(isCorrect);

      if (timedOut) {
        showFeedback(false, `Tempo esgotado. Resposta correta: ${correctChoice ?? '-'}`);
      } else if (letter === null) {
        showFeedback(false, `Sem resposta. Resposta correta: ${correctChoice ?? '-'}`);
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

          const min = (typeof data.minCorrectForReward === 'number') ? data.minCorrectForReward : 6;
          const reward = Number(data.reward || 0);

          if (doneMsg) {
            doneMsg.classList.remove('hidden');
            if (reward > 0) {
              doneMsg.innerHTML = `Parabéns! Você atingiu o mínimo e ganhou <span class="font-semibold text-wine">+${reward} diamantes</span>.`;
            } else {
              doneMsg.innerHTML = `Sem prêmio desta vez. Para ganhar <span class="font-semibold text-wine">+5 diamantes</span>, é preciso acertar <span class="font-semibold">${min}+</span> questões.`;
            }
          }

          if (typeof data.balance === 'number') {
            doneBalanceWrap.classList.remove('hidden');
            doneBalance.textContent = String(data.balance);
          } else {
            doneBalanceWrap.classList.add('hidden');
          }

          // encerra sons
          state.started = false;
          pauseBgMusic();
          if (sfxAudio) sfxAudio.pause();

        } else {
          renderQuestion(data.question, data.progress, data.seconds || state.seconds);
        }
      }, 650);

    } catch (e) {
      showFeedback(false, e.message || 'Erro ao enviar resposta.');
      state.locked = false;
      // retoma bg se tiver pausado indevidamente
      resumeBgMusic();
    }
  }

  async function resetGame() {
    stopTimer();
    state.started = false;
    state.locked = false;
    state.question = null;

    try { await post("{{ route('user.quiz.treino.reset') }}"); } catch (e) {}

    cardGame.classList.add('hidden');
    cardDone.classList.add('hidden');

    elReset.classList.add('hidden');
    elSound.classList.add('hidden');

    if (doneMsg) doneMsg.classList.add('hidden');

    hideFeedback();

    if (bgAudio) bgAudio.pause();
    if (sfxAudio) sfxAudio.pause();
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
