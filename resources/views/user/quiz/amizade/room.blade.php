@extends('user.layouts.app')
@section('title','Quiz • Amizade')
@section('topbar_title','Sala')

@section('content')
@php
  $music = $music ?? [];
@endphp

<div class="space-y-4" data-room-code="{{ $code }}">
  <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Código da sala</div>
        <div class="mt-1 text-2xl font-extrabold tracking-wider text-wine" id="roomCode">{{ $code }}</div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Compartilhe este código. Taxa: <span class="font-semibold">5 diamantes</span> por jogador (cobrado ao iniciar). Vencedor leva tudo.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button id="btnCopy"
          class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm
                 hover:bg-zinc-50 active:scale-[0.99] transition
                 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
          Copiar código
        </button>

        <form method="POST" action="{{ route('user.quiz.amizade.leave') }}" class="inline">
          @csrf
          <input type="hidden" name="code" value="{{ $code }}">
          <button type="submit"
            class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm
                   hover:bg-zinc-50 active:scale-[0.99] transition
                   dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
            Sair
          </button>
        </form>
      </div>
    </div>

    <audio id="bgMusic" preload="auto" loop class="hidden"></audio>
    <audio id="sfxAudio" preload="auto" class="hidden"></audio>

  </div>

  {{-- Lobby --}}
  <div id="cardLobby" class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Jogadores</div>
        <div class="mt-1 text-lg font-semibold" id="playersCount">—</div>
      </div>

      <div class="text-right">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Pot</div>
        <div class="mt-1 text-lg font-semibold text-wine" id="potText">—</div>
      </div>
    </div>

    <div class="mt-4 space-y-2" id="playersList"></div>

    <div class="mt-5 flex flex-wrap gap-2">
      <button id="btnStart"
        class="hidden inline-flex items-center justify-center rounded-2xl bg-wine px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition">
        Iniciar jogo
      </button>

      <button id="btnSound"
        class="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm
               hover:bg-zinc-50 active:scale-[0.99] transition
               dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
        Som: ON
      </button>

      <div id="lobbyHint" class="text-sm text-zinc-500 dark:text-zinc-400 self-center">
        Aguardando 2+ jogadores...
      </div>
    </div>

    <div id="lobbyErr" class="mt-4 hidden rounded-2xl p-4 text-sm"></div>
  </div>

  {{-- Game --}}
  <div id="cardGame" class="hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Progresso</div>
        <div class="mt-1 text-base font-semibold" id="progressText">—</div>
      </div>

      <div class="text-right">
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Tempo</div>
        <div class="mt-1 text-base font-semibold" id="timerText">01:00</div>
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

    <div id="gameMsg" class="mt-4 hidden rounded-2xl p-4 text-sm"></div>

    <div class="mt-4 grid gap-2 sm:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Seu placar</div>
        <div class="mt-1 text-lg font-semibold text-wine" id="myScore">—</div>
      </div>
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Saldo</div>
        <div class="mt-1 text-lg font-semibold" id="myBalance">—</div>
      </div>
    </div>
  </div>

  {{-- Finished --}}
  <div id="cardDone" class="hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="text-sm text-zinc-500 dark:text-zinc-400">Finalizado</div>
    <div class="mt-1 text-xl font-semibold">Partida concluída</div>

    <div class="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800" id="doneText"></div>

    <div class="mt-4">
      <a href="{{ route('user.quiz.amizade.index') }}"
         class="inline-flex items-center justify-center rounded-2xl bg-wine px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition">
        Voltar
      </a>
    </div>
  </div>
</div>

<script>
(function () {
  const root = document.querySelector('[data-room-code]');
  const code = root?.getAttribute('data-room-code');
  const csrf = "{{ csrf_token() }}";
  const musicList = @json($music);

  const cardLobby = document.getElementById('cardLobby');
  const cardGame  = document.getElementById('cardGame');
  const cardDone  = document.getElementById('cardDone');

  const playersCount = document.getElementById('playersCount');
  const playersList  = document.getElementById('playersList');
  const potText      = document.getElementById('potText');
  const btnStart     = document.getElementById('btnStart');
  const lobbyHint    = document.getElementById('lobbyHint');
  const lobbyErr     = document.getElementById('lobbyErr');

  const progressText = document.getElementById('progressText');
  const timerText    = document.getElementById('timerText');
  const timerBar     = document.getElementById('timerBar');
  const questionText = document.getElementById('questionText');
  const choicesWrap  = document.getElementById('choices');
  const gameMsg      = document.getElementById('gameMsg');
  const myScore      = document.getElementById('myScore');
  const myBalance    = document.getElementById('myBalance');

  const doneText     = document.getElementById('doneText');

  const btnCopy  = document.getElementById('btnCopy');
  const btnSound = document.getElementById('btnSound');
  const audio    = document.getElementById('bgMusic');

  const sfxCorrectList = [
    "{{ asset('musicas/certo1.mp3') }}",
    "{{ asset('musicas/certo2.mp3') }}",
    "{{ asset('musicas/certo3.mp3') }}",
    ];

    const sfxWrongList = [
    "{{ asset('musicas/errou1.mp3') }}",
    "{{ asset('musicas/errou2.mp3') }}",
    "{{ asset('musicas/errou3.mp3') }}",
    ];

    const sfxAudio = document.getElementById('sfxAudio');


  let pollTimer = null;
  let lastQuestionId = null;
  let answered = false;

  let timeOffsetMs = 0; // serverNow - clientNow
  let soundOn = true;

  let failCount = 0;
  const FAIL_LIMIT = 6;

  function pickMusic() {
    if (!musicList.length) return null;
    return musicList[Math.floor(Math.random() * musicList.length)];
  }

  function playMusic() {
    if (!audio) return;
    const src = pickMusic();
    if (!src) return;
    audio.src = src;
    audio.volume = 0.35;
    if (soundOn) audio.play().catch(() => {});
  }

    function setSound(on) {
    soundOn = on;
    if (on) {
        if (audio) {
        audio.volume = 0.35;
        audio.play().catch(() => {});
        }
        btnSound.textContent = 'Som: ON';
    } else {
        if (audio) audio.pause();
        if (sfxAudio) sfxAudio.pause();
        btnSound.textContent = 'Som: OFF';
    }
    }


    function pickFrom(list) {
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
    }

    function pauseBgForSfx() {
    if (audio && !audio.paused) {
        audio.pause();
    }
    }

    function resumeBgAfterSfx() {
    if (!soundOn) return;
    if (!audio) return;
    // volta o bg se estiver configurado
    audio.play().catch(() => {});
    }

    function playSfx(list) {
    if (!soundOn) return;
    if (!sfxAudio) return;

    const src = pickFrom(list);
    if (!src) return;

    // para bg e toca sfx
    pauseBgForSfx();

    try {
        sfxAudio.pause();
        sfxAudio.currentTime = 0;
    } catch (_) {}

    sfxAudio.src = src;
    sfxAudio.volume = 0.9;

    sfxAudio.onended = () => {
        // ao terminar, volta música de fundo
        resumeBgAfterSfx();
    };

    sfxAudio.play().catch(() => {
        // se o browser bloquear, só volta o bg
        resumeBgAfterSfx();
    });
    }

  function showBox(el, ok, msg) {
    if (!el) return;
    el.classList.remove('hidden');
    el.className = 'mt-4 rounded-2xl p-4 text-sm ' + (ok
      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
      : 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200');
    el.textContent = msg;
  }

  function hideBox(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.textContent = '';
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function renderPlayers(list, hostId) {
    playersList.innerHTML = '';
    list.forEach(p => {
      const isHost = Number(p.id) === Number(hostId);
      const row = document.createElement('div');
      row.className = 'rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 flex items-center justify-between';
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-wine/10 text-wine dark:bg-wine/15 dark:text-rose-200">
            ${escapeHtml(String(p.name).slice(0,1).toUpperCase())}
          </span>
          <span>${escapeHtml(p.name)}</span>
          ${isHost ? '<span class="ml-2 rounded-full bg-wine/10 px-2 py-1 text-xs font-bold text-wine dark:bg-wine/15 dark:text-rose-200">HOST</span>' : ''}
        </div>
        <div class="text-xs text-zinc-500 dark:text-zinc-400">Score: ${Number(p.score||0)}</div>
      `;
      playersList.appendChild(row);
    });
  }

  function updateTimer(remainingMs, secondsPerQ) {
    const totalMs = Math.max(1, Number(secondsPerQ || 60) * 1000);
    const rem = Math.max(0, Number(remainingMs || 0));

    const s = Math.ceil(rem / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2,'0');
    const ss = String(s % 60).padStart(2,'0');
    timerText.textContent = `${mm}:${ss}`;

    const pct = Math.max(0, Math.min(100, (rem / totalMs) * 100));
    timerBar.style.width = pct + '%';
  }

  function renderQuestion(q, idx, total, remainingMs, alreadyAnswered, secondsPerQ) {
    answered = !!alreadyAnswered;

    progressText.textContent = `${idx + 1}/${total}`;
    questionText.textContent = q?.text || '(sem texto)';
    choicesWrap.innerHTML = '';

    const entries = Object.entries(q?.choices || {});
    if (!entries.length) {
      const div = document.createElement('div');
      div.className = 'rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300';
      div.textContent = 'Questão sem alternativas configuradas.';
      choicesWrap.appendChild(div);
    } else {
      entries.forEach(([letter, text]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.disabled = answered;

        btn.className =
          'group w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm ' +
          'hover:bg-zinc-50 active:scale-[0.99] transition ' +
          'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 ' +
          (answered ? 'opacity-70 cursor-not-allowed' : '');

        btn.innerHTML = `
          <div class="flex items-start gap-3">
            <div class="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-2xl bg-wine/10 text-sm font-extrabold text-wine dark:bg-wine/15 dark:text-rose-200">
              ${letter}
            </div>
            <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${escapeHtml(text)}</div>
          </div>
        `;

        btn.addEventListener('click', async () => {
          if (answered) return;

          try {
                    answered = true;
                    hideBox(gameMsg);

                    const resp = await post("{{ route('user.quiz.amizade.answer', $code) }}", {
        question_id: q.id,
        choice: letter,
        });

        const result = resp?.result || null;
        const isCorrect = !!result?.isCorrect;
        const correctChoice = (result?.correctChoice || '').toString().toUpperCase();
        const inTime = (result?.inTime !== false); // default true

        if (!inTime) {
        showBox(gameMsg, false, `Tempo esgotado. Resposta registrada como errada.`);
        playSfx(sfxWrongList);
        } else if (isCorrect) {
        showBox(gameMsg, true, `Correto!`);
        playSfx(sfxCorrectList);
        } else {
        // mostra a correta também (como no treino)
        showBox(gameMsg, false, `Incorreto. Correta: ${correctChoice || '-'}`);
        playSfx(sfxWrongList);
        }

            // Força atualização imediata (não esperar próximo poll)
            await tick();

          } catch (e) {
            answered = false;
            showBox(gameMsg, false, e?.message || 'Erro ao responder.');
          }
        });

        choicesWrap.appendChild(btn);
      });
    }

    updateTimer(remainingMs, secondsPerQ);
  }

  async function safeJson(res) {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      return await res.json().catch(() => null);
    }
    const txt = await res.text().catch(() => '');
    return { ok: false, message: txt || 'Resposta não-JSON do servidor.' };
  }

  async function getState() {
    const res = await fetch("{{ route('user.quiz.amizade.state', $code) }}", {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    const json = await safeJson(res);

    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.message || `Erro ao ler estado (HTTP ${res.status}).`);
    }

    return json;
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'X-CSRF-TOKEN': csrf,
        'Accept':'application/json',
      },
      body: JSON.stringify(body || {}),
    });

    const json = await safeJson(res);

    if (!res.ok || (json && json.ok === false)) {
      throw new Error(json?.message || `Erro (HTTP ${res.status}).`);
    }

    return json;
  }

  async function startGame() {
    try {
      hideBox(lobbyErr);
      await post("{{ route('user.quiz.amizade.start', $code) }}");
      await tick(); // atualiza de imediato
    } catch (e) {
      showBox(lobbyErr, false, e?.message || 'Não foi possível iniciar.');
    }
  }

  function showPollError(msg) {
    // mostra no card atual
    if (!cardDone.classList.contains('hidden')) {
      // finished: mostra no doneText sem quebrar
      doneText.innerHTML = `<div class="text-sm text-rose-700 dark:text-rose-200">Falha ao sincronizar: ${escapeHtml(msg)}</div>`;
      return;
    }

    if (!cardGame.classList.contains('hidden')) {
      showBox(gameMsg, false, `Falha ao sincronizar: ${msg}`);
      return;
    }

    showBox(lobbyErr, false, `Falha ao sincronizar: ${msg}`);
  }

  async function tick() {
    const st = await getState();
    failCount = 0;

    // sincroniza offset
    timeOffsetMs = Number(st.serverNowMs) - Date.now();

    potText.textContent = String(st.pot || 0);
    playersCount.textContent = String((st.players || []).length);
    renderPlayers(st.players || [], st.hostId);

    if (myScore) myScore.textContent = String(st.me?.score ?? 0);
    if (myBalance) myBalance.textContent = String(st.balance ?? 0);

    if (st.status === 'lobby') {
      cardLobby.classList.remove('hidden');
      cardGame.classList.add('hidden');
      cardDone.classList.add('hidden');

      hideBox(gameMsg);
      hideBox(lobbyErr);

      const canStart = !!st.isHost && (st.players || []).length >= 2;

      if (canStart) {
        btnStart.classList.remove('hidden');
        lobbyHint.textContent = 'Pronto. Clique em “Iniciar jogo”.';
      } else {
        btnStart.classList.add('hidden');
        lobbyHint.textContent = 'Aguardando 2+ jogadores...';
      }

      if (audio && audio.paused && soundOn) playMusic();
      return;
    }

    if (st.status === 'in_progress') {
      cardLobby.classList.add('hidden');
      cardGame.classList.remove('hidden');
      cardDone.classList.add('hidden');

      const q = st.question;
      const qid = q?.id ?? null;

      // se mudou a questão, reseta UI
      if (qid !== lastQuestionId) {
        lastQuestionId = qid;
        hideBox(gameMsg);
      }

      const secondsPerQ = Number(st.secondsPerQ || 60);

      renderQuestion(
        q,
        Number(st.currentIndex || 0),
        Number(st.total || 10),
        Number(st.remainingMs || 0),
        !!st.answered,
        secondsPerQ
      );

      // Se já respondeu, reforça mensagem (sem “travamento” aparente)
      if (st.answered) {
        showBox(gameMsg, true, 'Resposta enviada. Aguardando outros jogadores...');
      }

      return;
    }

    if (st.status === 'finished') {
      cardLobby.classList.add('hidden');
      cardGame.classList.add('hidden');
      cardDone.classList.remove('hidden');

      const winnerId = Number(st.winnerId || 0);
      const meId = Number(st.me?.id || 0);
      const pot = Number(st.pot || 0);

      const winner = (st.players || []).find(p => Number(p.id) === winnerId);
      const winnerName = winner?.name || '—';

      doneText.innerHTML = `
        <div class="text-sm text-zinc-600 dark:text-zinc-300">
          Vencedor: <span class="font-semibold text-wine">${escapeHtml(winnerName)}</span><br>
          Prêmio: <span class="font-semibold">${pot}</span> diamantes<br>
          Seu score: <span class="font-semibold">${Number(st.me?.score || 0)}</span>
        </div>
        ${winnerId === meId
          ? '<div class="mt-3 rounded-xl bg-wine/10 p-3 text-sm font-semibold text-wine dark:bg-wine/15 dark:text-rose-200">Você ganhou!</div>'
          : '<div class="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Você não venceu desta vez.</div>'}
      `;

      if (audio) audio.pause();
      return;
    }
  }

  btnStart?.addEventListener('click', startGame);

  btnCopy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(String(code || ''));
      btnCopy.textContent = 'Copiado!';
      setTimeout(() => btnCopy.textContent = 'Copiar código', 900);
    } catch (e) {
      btnCopy.textContent = 'Não foi possível copiar';
      setTimeout(() => btnCopy.textContent = 'Copiar código', 1200);
    }
  });

  btnSound?.addEventListener('click', () => setSound(!soundOn));

  // start
  playMusic();
  setSound(true);

  pollTimer = setInterval(async () => {
    try {
      await tick();
    } catch (e) {
      failCount += 1;
      const msg = e?.message || 'Erro desconhecido.';
      showPollError(msg);

      // evita loop infinito silencioso
      if (failCount >= FAIL_LIMIT) {
        clearInterval(pollTimer);
        showPollError('Perda de sincronização (muitas falhas). Recarregue a página.');
      }
    }
  }, 1200);

  tick().catch((e) => {
    const msg = e?.message || 'Erro ao iniciar sincronização.';
    showPollError(msg);
  });
})();
</script>
@endsection
