(function(){
  let QUESTION_BANK = null; // Loaded only from data.json

  // Colors for players
  const PLAYER_COLORS = ['var(--player1)','var(--player2)','var(--player3)','var(--player4)'];

  // App state
  const state = {
    players:[], // {name,color,score}
    subject:'Mixed',
    qPerPlayer:3,
    queue:[], // questions in order {playerIndex, questionObj}
    history:[], // each answered item {playerIndex, question, choices, selected, correct}
    currentIndex:0,
    timer: null,
    timeLeft:0,
    perQuestionTime:15
  };

  // Helpers
  function $(sel){return document.querySelector(sel)}
  function $all(sel){return Array.from(document.querySelectorAll(sel))}

  function shuffleInPlace(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  }

  function prepareQuestion(qObj){
    const order = qObj.a.map((_,i)=>i);
    shuffleInPlace(order);
    const answers = order.map(i=>qObj.a[i]);
    const correct = order.indexOf(qObj.correct);
    return { q: qObj.q, a: answers, correct };
  }

  function normalizeQuestionBank(raw){
    if(!raw || typeof raw !== 'object') throw new Error('Invalid question bank JSON');

    const out = {};
    for(const [subject, list] of Object.entries(raw)){
      if(!Array.isArray(list)) continue;
      const normalized = [];

      for(const item of list){
        if(!item || typeof item !== 'object') continue;

        // Support both schemas:
        // - { q, a, correct }
        // - { Question, Answers, CorrectAnswer }
        const q = (typeof item.q === 'string') ? item.q : item.Question;
        const a = Array.isArray(item.a) ? item.a : item.Answers;
        let correct = (typeof item.correct === 'number') ? item.correct : item.CorrectAnswer;

        if(typeof q !== 'string' || !Array.isArray(a) || a.length < 2) continue;

        if(typeof correct === 'string'){
          const idx = a.indexOf(correct);
          if(idx === -1) continue;
          correct = idx;
        }

        if(typeof correct !== 'number' || !Number.isFinite(correct) || correct < 0 || correct >= a.length) continue;
        normalized.push({ q, a, correct });
      }

      if(normalized.length) out[subject] = normalized;
    }

    if(!Object.keys(out).length) throw new Error('No valid questions found in JSON');
    return out;
  }

  async function loadQuestionBank(){
    // Prefer embedded JSON so the app works even when opened as file://
    const embedded = document.getElementById('questionBankJson');
    if(embedded && typeof embedded.textContent === 'string' && embedded.textContent.trim()){
      const raw = JSON.parse(embedded.textContent);
      return normalizeQuestionBank(raw);
    }

    const res = await fetch('data.json', { cache: 'no-store' });
    if(!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
    const raw = await res.json();
    return normalizeQuestionBank(raw);
  }

  function ensureLocalFileLoader(){
    let box = document.querySelector('#localJsonLoader');
    if(box) return box;

    box = document.createElement('div');
    box.id = 'localJsonLoader';
    box.style.marginTop = '12px';
    box.style.padding = '12px';
    box.style.border = '1px solid rgba(255,255,255,.14)';
    box.style.borderRadius = '12px';
    box.style.background = 'rgba(255,255,255,.04)';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '6px';
    title.textContent = 'Не удалось загрузить data.json автоматически';

    const hint = document.createElement('div');
    hint.style.color = 'var(--muted)';
    hint.style.marginBottom = '10px';
    hint.textContent = 'Если ты открыл страницу как file://, браузер может блокировать fetch. Выбери data.json вручную:';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    const status = document.createElement('div');
    status.style.marginTop = '10px';
    status.style.color = 'var(--muted)';
    status.textContent = '';

    input.addEventListener('change', async ()=>{
      const file = input.files && input.files[0];
      if(!file){ status.textContent = ''; return; }
      try{
        const text = await file.text();
        const raw = JSON.parse(text);
        QUESTION_BANK = normalizeQuestionBank(raw);
        status.textContent = `Загружено: ${Object.keys(QUESTION_BANK).length} тем(ы)`;
        if(startGameBtn) startGameBtn.disabled = false;
        if(toSubjectBtn) toSubjectBtn.disabled = false;
        renderSubjects();
        renderDifficulties();
      }catch(err){
        console.error('Failed to read selected JSON:', err);
        status.textContent = 'Ошибка: файл не похож на корректный data.json';
      }
    });

    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(input);
    box.appendChild(status);

    // Prefer placing on first screen
    if(screenPlayers) screenPlayers.appendChild(box);
    else document.body.appendChild(box);

    return box;
  }

  // UI elements
  const playersRow = $('#playersRow');
  const toSubjectBtn = $('#to-subject');
  const subjectChoices = $('#subjectChoices');
  const difficultyChoices = $('#difficultyChoices');
  const backPlayersBtn = $('#back-players');
  const startGameBtn = $('#start-game');
  const submitAnswerBtn = $('#submitAnswer');
  const currentPlayerName = $('#currentPlayerName');
  const timerEl = $('#timer');
  const questionText = $('#questionText');
  const optionsGrid = $('#optionsGrid');
  const screenPlayers = $('#screen-players');
  const screenSubject = $('#screen-subject');
  const screenGame = $('#screen-game');
  const screenResults = $('#screen-results');
  const screenReview = $('#screen-review');
  const resultsList = $('#resultsList');
  const btnReview = $('#btnReview');
  const btnRestart = $('#btnRestart');
  const reviewList = $('#reviewList');
  const reviewBack = $('#reviewBack');
  const reviewRestart = $('#reviewRestart');

  // Init
  async function init(){
    renderPlayerCards();
    attachSetupHandlers();

    try{
      QUESTION_BANK = await loadQuestionBank();
    }catch(err){
      console.error('Failed to load questions from data.json:', err);
      // Block game start until user provides questions (server or manual file select)
      if(startGameBtn) startGameBtn.disabled = true;
      if(toSubjectBtn) toSubjectBtn.disabled = true;
      ensureLocalFileLoader();
      // allow UI to render players; subjects will appear after manual load
    }

    if(QUESTION_BANK){
      renderSubjects();
      renderDifficulties();
    }
    attachGameHandlers();
    updateStepper(screenPlayers);
  }

  function showScreen(el){
    $all('.screen').forEach(s=>s.classList.remove('active'));
    el.classList.add('active');
    updateStepper(el);
  }

  function updateStepper(activeEl){
    const id = activeEl && activeEl.id;
    if(!id) return;
    $all('.stepper .step').forEach(step => {
      const target = step.getAttribute('data-screen');
      step.classList.toggle('active', target === id);
    });
  }

  // Setup screen: player cards
  function renderPlayerCards(){
    playersRow.innerHTML = '';
    for(let i=0;i<4;i++){
      const div = document.createElement('div');
      div.className='player-card';
      div.innerHTML = `
        <div class="player-preview" style="background:${PLAYER_COLORS[i]}"></div>
        <input type="text" class="player-name" placeholder="Player ${i+1}" data-index="${i}" />
        <label><input type="checkbox" class="player-enabled" data-index="${i}" /> Enable</label>
      `;
      playersRow.appendChild(div);
    }
  }

  function attachSetupHandlers(){
    toSubjectBtn.addEventListener('click', ()=>{
      // gather selected players
      const enabled = $all('.player-enabled').filter(i => i.checked);
      if(enabled.length===0){alert('Select at least one player.');return}
      state.players = [];
      $all('.player-name').forEach(inp=>{
        const idx = Number(inp.dataset.index);
        const enabledChk = document.querySelector(`.player-enabled[data-index="${idx}"]`);
        if(enabledChk && enabledChk.checked){
          state.players.push({name: inp.value.trim()||`Player ${idx+1}`, color: PLAYER_COLORS[idx], score:0});
        }
      });
      showScreen(screenSubject);
    });

    backPlayersBtn.addEventListener('click', ()=> showScreen(screenPlayers));
    startGameBtn.addEventListener('click', startGameFromSetup);
  }

  function renderSubjects(){
    const base = Object.keys(QUESTION_BANK || {}).filter(s=>s && s !== 'Mixed');
    const subjects = [...base, 'Mixed'];
    subjectChoices.innerHTML='';
    subjects.forEach(s=>{
      const d = document.createElement('div'); d.className='choice'; d.textContent=s;
      d.addEventListener('click', ()=>{ state.subject=s; updateChoiceSelection(subjectChoices,d); });
      if(s==='Mixed') d.classList.add('selected');
      subjectChoices.appendChild(d);
    });
    state.subject='Mixed';
  }

  function renderDifficulties(){
    difficultyChoices.innerHTML='';
    [3,4,5].forEach(n=>{
      const d=document.createElement('div'); d.className='choice'; d.textContent=`${n}`;
      d.addEventListener('click', ()=>{ state.qPerPlayer=n; updateChoiceSelection(difficultyChoices,d); });
      if(n===3) d.classList.add('selected');
      difficultyChoices.appendChild(d);
    });
    state.qPerPlayer=3;
  }

  function updateChoiceSelection(container,selectedEl){
    container.querySelectorAll('.choice').forEach(c=>c.classList.remove('selected'));
    selectedEl.classList.add('selected');
  }

  // Start game
  function startGameFromSetup(){
    // prepare queue
    state.history=[]; state.currentIndex=0;
    state.players.forEach(p=>p.score=0);
    buildQueue();
    showScreen(screenGame);
    renderCurrentQuestion();
  }

  function buildQueue(){
    state.queue = [];
    const baseSubjects = Object.keys(QUESTION_BANK || {}).filter(s=>s && s !== 'Mixed');
    const subjectsPool = (state.subject==='Mixed') ? baseSubjects : [state.subject];
    if(!subjectsPool.length){ console.error('No subjects available in QUESTION_BANK'); return; }
    // For fairness, alternate players: for each round, each player gets one question.
    for(let r=0;r<state.qPerPlayer;r++){
      for(let pIdx=0;pIdx<state.players.length;pIdx++){
        const subject = subjectsPool[Math.floor(Math.random()*subjectsPool.length)];
        const pool = QUESTION_BANK[subject];
        if(!pool || !pool.length){ console.error('No questions for subject:', subject); continue; }
        // choose a random question (allow reuse)
        const qObj = pool[Math.floor(Math.random()*pool.length)];
        const question = prepareQuestion(qObj);
        state.queue.push({playerIndex:pIdx, question, subject});
      }
    }
  }

  // Game UI & logic
  let selectedIndex = null;

  function attachGameHandlers(){
    submitAnswerBtn.addEventListener('click', submitCurrentAnswer);
    btnReview.addEventListener('click', ()=>{ renderReview(); showScreen(screenReview); });
    btnRestart.addEventListener('click', resetToStart);
    reviewBack.addEventListener('click', ()=> showScreen(screenResults));
    reviewRestart.addEventListener('click', resetToStart);
  }

  function renderCurrentQuestion(){
    try{
      clearTimer(); selectedIndex=null; submitAnswerBtn.disabled=true;
      if(state.currentIndex >= state.queue.length){ endGame(); return }
      const item = state.queue[state.currentIndex];
      if(!item || !item.question){ console.error('Missing queue item at', state.currentIndex); endGame(); return }
      const player = state.players[item.playerIndex];
      if(!player){ console.warn('Missing player for question, defaulting to player 0', item); item.playerIndex = 0; }
      const activePlayer = state.players[item.playerIndex] || {name:'Player', color:'var(--muted)'};
      currentPlayerName.textContent = `It's ${activePlayer.name}'s turn`;
      currentPlayerName.style.color = activePlayer.color;
      questionText.textContent = item.question.q;
      optionsGrid.innerHTML='';
      item.question.a.forEach((opt,idx)=>{
        const b = document.createElement('button'); b.className='option-btn'; b.textContent = opt;
        b.addEventListener('click', ()=>{
          // select
          selectedIndex = idx; updateOptionSelection(activePlayer.color);
          if(submitAnswerBtn) submitAnswerBtn.disabled = false;
        });
        optionsGrid.appendChild(b);
      });
      // ensure timer always starts
      startTimer();
    }catch(err){
      console.error('Error rendering question:', err);
      // attempt to continue to next question instead of stopping the game
      clearTimer(); state.currentIndex++; setTimeout(()=> renderCurrentQuestion(), 300);
    }
  }

  function updateOptionSelection(color){
    $all('.option-btn').forEach((b,idx)=>{
      b.classList.toggle('selected', idx===selectedIndex);
      if(idx===selectedIndex) b.style.outline = `4px solid ${color}`;
      else b.style.outline='none';
    });
  }

  function startTimer(){
    state.timeLeft = state.perQuestionTime;
    timerEl.textContent = `${state.timeLeft}s`;
    state.timer = setInterval(()=>{
      state.timeLeft--;
      timerEl.textContent = `${state.timeLeft}s`;
      if(state.timeLeft<=0){
        // auto-submit
        clearTimer();
        autoSubmit();
      }
    },1000);
  }

  function clearTimer(){ if(state.timer){ clearInterval(state.timer); state.timer=null; } }

  function autoSubmit(){
    // if nothing selected, treat as no answer
    processAnswer(selectedIndex);
  }

  function submitCurrentAnswer(){ clearTimer(); processAnswer(selectedIndex); }

  function processAnswer(selIdx){
    try{
      const item = state.queue[state.currentIndex];
      if(!item || !item.question){ console.error('No queue item in processAnswer at', state.currentIndex); state.currentIndex++; setTimeout(()=> renderCurrentQuestion(), 250); return }
      const correct = item.question.correct;
      const player = state.players[item.playerIndex] || {name:'Player', color:'var(--muted)', score:0};
      let awarded = 0;
      if(typeof selIdx === 'number' && selIdx === correct){ player.score += 10; awarded = 10; }
      // record history
      state.history.push({playerIndex:item.playerIndex, playerName:player.name, subject:item.subject, question:item.question.q, choices:item.question.a.slice(), selected: (typeof selIdx==='number')?selIdx:null, correct});
      state.currentIndex++;
      // small delay to show selection
      setTimeout(()=> renderCurrentQuestion(), 250);
    }catch(err){
      console.error('Error processing answer:', err);
      state.currentIndex++; setTimeout(()=> renderCurrentQuestion(), 250);
    }
  }

  function endGame(){
    // compute rankings
    const ordered = state.players.map((p,idx)=>({idx, name:p.name, score:p.score, color:p.color})).sort((a,b)=>b.score-a.score);
    resultsList.innerHTML='';
    const topScore = ordered[0].score;
    ordered.forEach((p,place)=>{
      const div = document.createElement('div'); div.className='result-item';
      const left = document.createElement('div'); left.innerHTML = `<strong>${place+1}. ${p.name}</strong>`;
      const right = document.createElement('div'); right.innerHTML = `<span style="background:${p.color};padding:6px 10px;border-radius:6px;color:#022;font-weight:700">${p.score}</span>`;
      div.appendChild(left); div.appendChild(right);
      resultsList.appendChild(div);
    });
    // winners
    const winners = ordered.filter(p=>p.score===topScore);
    const title = document.createElement('div'); title.className='result-item'; title.innerHTML = `<div><strong>${winners.length>1? 'Winners':'Winner'}: ${winners.map(w=>w.name).join(' ')}</strong></div><div></div>`;
    resultsList.prepend(title);
    showScreen(screenResults);
  }

  function renderReview(){
    reviewList.innerHTML='';
    state.history.forEach((h,idx)=>{
      const qDiv = document.createElement('div'); qDiv.className='review-question';
      const title = document.createElement('div'); title.innerHTML = `<strong>Q${idx+1} (${h.subject})</strong> - ${h.question}`;
      qDiv.appendChild(title);
      const ul = document.createElement('div'); ul.style.display='grid'; ul.style.gridTemplateColumns='1fr 1fr'; ul.style.gap='8px';
      h.choices.forEach((c,i)=>{
        const opt = document.createElement('div'); opt.textContent = c; opt.style.padding='8px'; opt.style.borderRadius='6px';
        if(i===h.correct){ opt.style.background = '#064e3b'; opt.style.color='#c7f9eb'; }
        if(i===h.selected){
          // color by player who answered
          const playerColor = state.players[h.playerIndex].color;
          opt.style.boxShadow = `inset 0 0 0 4px ${playerColor}`;
        }
        ul.appendChild(opt);
      });
      qDiv.appendChild(ul);
      reviewList.appendChild(qDiv);
    });
  }

  function resetToStart(){
    state.players=[]; state.queue=[]; state.history=[]; state.currentIndex=0;
    renderPlayerCards(); renderSubjects(); renderDifficulties();
    showScreen(screenPlayers);
  }

  // small fix: showScreen expects element; we accidentally referenced variable
  // correct the reset function to use screenPlayers
  function resetToStart_fix(){
    state.players=[]; state.queue=[]; state.history=[]; state.currentIndex=0;
    renderPlayerCards(); renderSubjects(); renderDifficulties();
    showScreen(screenPlayers);
  }

  // Replace erroneous reset with fixed one
  resetToStart = resetToStart_fix;

  // start
  window.addEventListener('load', ()=>{ init(); });

})();
