const PLAYER_COLORS = ['#ff4d6d', '#4dffb8', '#ffd166', '#6e8efb'];
const TIMER_SECONDS = 15;

let DATA = {};

const state = {
  numPlayers: 1,
  playerNames: ['Player 1'],
  subject: 'HTML',
  qPerPlayer: 3,
  players: [],
  questions: [],
  qIndex: 0,
  selectedAnswer: null,
  timerInterval: null,
  timerLeft: TIMER_SECONDS,
  submitted: false,
  history: []
};

fetch('data.json')
  .then(res => res.json())
  .then(json => { DATA = json; init(); })
  .catch(() => alert('Could not load data.json — make sure the file is in the same folder.'));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getQuestions(subject, count) {
  if (subject === 'Mixed') return shuffle(Object.values(DATA).flat()).slice(0, count);
  return shuffle(DATA[subject]).slice(0, count);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function renderPlayerInputs() {
  const container = document.getElementById('player-inputs');
  container.innerHTML = '';
  for (let i = 0; i < state.numPlayers; i++) {
    const row = document.createElement('div');
    row.className = 'player-input-row';

    const dot = document.createElement('div');
    dot.className = 'player-dot';
    dot.style.background = PLAYER_COLORS[i];

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Player ${i + 1}`;
    input.value = state.playerNames[i] || `Player ${i + 1}`;
    input.maxLength = 18;
    input.addEventListener('input', e => { state.playerNames[i] = e.target.value || `Player ${i + 1}`; });

    row.appendChild(dot);
    row.appendChild(input);
    container.appendChild(row);
  }
}

function startGame() {
  state.players = [];
  for (let i = 0; i < state.numPlayers; i++) {
    state.players.push({ name: state.playerNames[i] || `Player ${i + 1}`, color: PLAYER_COLORS[i], score: 0 });
  }

  const perPlayer = state.players.map(() => getQuestions(state.subject, state.qPerPlayer));
  state.questions = [];
  for (let r = 0; r < state.qPerPlayer; r++) {
    for (let p = 0; p < state.numPlayers; p++) {
      state.questions.push({ q: perPlayer[p][r], playerIdx: p });
    }
  }

  state.qIndex = 0;
  state.history = [];
  showScreen('screen-game');
  renderQuestion();
}

function renderQuestion() {
  const item   = state.questions[state.qIndex];
  const player = state.players[item.playerIdx];

  state.selectedAnswer = null;
  state.submitted = false;

  document.getElementById('turn-dot').style.background = player.color;
  document.getElementById('turn-name').textContent = `It's ${player.name}'s turn`;
  document.getElementById('turn-name').style.color = player.color;
  document.getElementById('turn-score').textContent = player.score;
  document.getElementById('q-meta').textContent = `Question ${state.qIndex + 1} of ${state.questions.length}`;
  document.getElementById('q-text').textContent = item.q.Question;

  const answersDiv = document.getElementById('answers');
  answersDiv.innerHTML = '';
  shuffle(item.q.Answers).forEach(ans => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = ans;
    btn.addEventListener('click', () => selectAnswer(ans, btn));
    answersDiv.appendChild(btn);
  });

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submit Answer';
  submitBtn.onclick = submitAnswer;

  renderProgressDots();
  startTimer();
}

function selectAnswer(ans, btn) {
  if (state.submitted) return;
  state.selectedAnswer = ans;
  const color = PLAYER_COLORS[state.questions[state.qIndex].playerIdx];

  document.querySelectorAll('.answer-btn').forEach(b => {
    b.classList.remove('selected');
    b.style.color = '';
    b.style.borderColor = '';
  });

  btn.classList.add('selected');
  btn.style.borderColor = color;
  btn.style.color = color;
  document.getElementById('btn-submit').disabled = false;
}

function submitAnswer() {
  if (state.submitted) return;
  state.submitted = true;
  clearInterval(state.timerInterval);

  const item    = state.questions[state.qIndex];
  const player  = state.players[item.playerIdx];
  const correct = item.q.CorrectAnswer;
  const chosen  = state.selectedAnswer;

  state.history.push({ question: item.q.Question, correct, chosen, playerIdx: item.playerIdx, answers: item.q.Answers });

  if (chosen === correct) {
    player.score += 10;
    document.getElementById('turn-score').textContent = player.score;
  }

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.classList.remove('selected');
    if (btn.textContent === correct) btn.classList.add('correct');
    else if (btn.textContent === chosen && chosen !== correct) btn.classList.add('wrong');
  });

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = false;

  if (state.qIndex < state.questions.length - 1) {
    submitBtn.textContent = chosen === correct ? '✓ Correct! Next →' : '✗ Wrong. Next →';
    submitBtn.onclick = () => { state.qIndex++; renderQuestion(); };
  } else {
    submitBtn.textContent = 'See Results →';
    submitBtn.onclick = showResults;
  }
}

function startTimer() {
  state.timerLeft = TIMER_SECONDS;
  const bar = document.getElementById('timer-bar');
  const num = document.getElementById('timer-num');

  bar.style.transition = 'none';
  bar.style.width = '100%';
  bar.style.background = 'var(--timer-normal)';
  num.style.color = 'var(--muted)';
  num.textContent = TIMER_SECONDS;

  clearInterval(state.timerInterval);

  setTimeout(() => {
    bar.style.transition = `width ${TIMER_SECONDS}s linear`;
    bar.style.width = '0%';
  }, 50);

  state.timerInterval = setInterval(() => {
    state.timerLeft--;
    num.textContent = state.timerLeft;
    if (state.timerLeft <= 5)      { bar.style.background = 'var(--timer-danger)'; num.style.color = 'var(--timer-danger)'; }
    else if (state.timerLeft <= 8) { bar.style.background = 'var(--timer-warn)';   num.style.color = 'var(--timer-warn)'; }
    if (state.timerLeft <= 0) { clearInterval(state.timerInterval); if (!state.submitted) submitAnswer(); }
  }, 1000);
}

function renderProgressDots() {
  const container = document.getElementById('progress-dots');
  container.innerHTML = '';
  state.questions.forEach((item, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (i < state.qIndex)      { dot.classList.add('done');    dot.style.background = PLAYER_COLORS[item.playerIdx] + '88'; }
    else if (i === state.qIndex) { dot.classList.add('current'); dot.style.background = PLAYER_COLORS[item.playerIdx]; }
    container.appendChild(dot);
  });
}

function showResults() {
  clearInterval(state.timerInterval);
  const sorted   = [...state.players].map((p, i) => ({ ...p, origIdx: i })).sort((a, b) => b.score - a.score);
  const maxScore = sorted[0].score;
  const podium   = document.getElementById('podium');
  podium.innerHTML = '';

  sorted.forEach((p, rank) => {
    const row = document.createElement('div');
    row.className = 'podium-row' + (p.score === maxScore ? ' winner' : '');

    const rankDiv = document.createElement('div');
    rankDiv.className = 'podium-rank';
    rankDiv.textContent = rank + 1;

    const dot = document.createElement('div');
    dot.className = 'player-dot';
    dot.style.cssText = `background:${p.color}; width:14px; height:14px; border-radius:50%; flex-shrink:0;`;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'podium-name';
    nameDiv.textContent = p.name;

    const ptsDiv = document.createElement('div');
    ptsDiv.className = 'podium-pts';
    ptsDiv.textContent = `${p.score} pts`;

    row.appendChild(rankDiv);
    row.appendChild(dot);
    row.appendChild(nameDiv);

    if (p.score === maxScore) {
      const badge = document.createElement('div');
      badge.className = 'winner-badge';
      badge.textContent = 'Winner';
      row.appendChild(badge);
    }

    row.appendChild(ptsDiv);
    podium.appendChild(row);
  });

  showScreen('screen-end');
}

function showReview() {
  const container = document.getElementById('review-content');
  container.innerHTML = '';

  state.history.forEach((item, idx) => {
    const player = state.players[item.playerIdx];
    const div    = document.createElement('div');
    div.className = 'review-item';

    const meta = document.createElement('div');
    meta.className = 'label-sm';
    meta.innerHTML = `Q${idx + 1} &bull; <span style="color:${player.color}">${player.name}</span>`;

    const qText = document.createElement('div');
    qText.className = 'review-q';
    qText.textContent = item.question;

    const answersDiv = document.createElement('div');
    answersDiv.className = 'review-answers';

    item.answers.forEach(ans => {
      const aRow = document.createElement('div');
      aRow.className = 'review-answer' + (ans === item.correct ? ' is-correct' : '');

      const icon = document.createElement('div');
      icon.className = 'review-icon';
      icon.textContent = ans === item.correct ? '✓' : '';

      const text = document.createElement('div');
      text.className = 'review-text';
      text.textContent = ans;

      aRow.appendChild(icon);
      aRow.appendChild(text);

      if (item.chosen === ans) {
        const wrap = document.createElement('div');
        wrap.className = 'review-chosen';
        const dot = document.createElement('div');
        dot.className = 'chosen-dot';
        dot.style.background = player.color;
        dot.title = player.name;
        wrap.appendChild(dot);
        aRow.appendChild(wrap);
      }

      answersDiv.appendChild(aRow);
    });

    div.appendChild(meta);
    div.appendChild(qText);
    div.appendChild(answersDiv);
    container.appendChild(div);
  });

  showScreen('screen-review');
}

function init() {
  renderPlayerInputs();

  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.numPlayers = parseInt(btn.dataset.n);
      while (state.playerNames.length < state.numPlayers) state.playerNames.push(`Player ${state.playerNames.length + 1}`);
      renderPlayerInputs();
    });
  });

  document.getElementById('btn-to-subject').addEventListener('click', () => {
    document.querySelectorAll('#player-inputs input').forEach((inp, i) => {
      state.playerNames[i] = inp.value.trim() || `Player ${i + 1}`;
    });
    showScreen('screen-subject');
  });

  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.subject = btn.dataset.s;
    });
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.qPerPlayer = parseInt(btn.dataset.q);
    });
  });

  document.getElementById('btn-back').addEventListener('click', () => showScreen('screen-players'));
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-new-game').addEventListener('click', () => {
    clearInterval(state.timerInterval);
    showScreen('screen-players');
    renderPlayerInputs();
  });
  document.getElementById('btn-review').addEventListener('click', showReview);
  document.getElementById('btn-back-results').addEventListener('click', () => showScreen('screen-end'));
}
