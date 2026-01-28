// State Management
const state = {
  ws: null,
  playerId:
    localStorage.getItem('playerId') ||
    Math.random().toString(36).substring(2, 11),
  playerName: localStorage.getItem('playerName') || '',
  gameId: window.location.pathname.substring(1), // Get hash from URL
  isCreator: false,
  currentGame: null,
  timerInterval: null,
};

localStorage.setItem('playerId', state.playerId);

// Selectors
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const gameNameInput = document.getElementById('game-name');
const votingSystemSelect = document.getElementById('voting-system');
const revealPolicySelect = document.getElementById('reveal-policy');
const startBtn = document.getElementById('start-btn');
const joinBtn = document.getElementById('join-btn');
const gameSetupFields = document.getElementById('game-setup-fields');
const playerList = document.getElementById('player-list');
const gameBoard = document.getElementById('game-board');
const votingCards = document.getElementById('voting-cards');
const displayGameName = document.getElementById('display-game-name');
const gameLink = document.getElementById('game-link');
const revealBtn = document.getElementById('reveal-btn');
const resetBtn = document.getElementById('reset-btn');
const timerVal = document.getElementById('timer-val');
const timerToggle = document.getElementById('timer-toggle');

// Voting Systems
const SYSTEMS = {
  fibonacci: [
    '0',
    '1',
    '2',
    '3',
    '5',
    '8',
    '13',
    '21',
    '34',
    '55',
    '89',
    '?',
    '☕',
  ],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  natural: ['1', '4', '8', '16', '32', '?', '☕'],
};

// Initialization
function init() {
  if (state.playerName) {
    playerNameInput.value = state.playerName;
  }

  if (state.gameId && state.gameId.length > 0) {
    // We are joining an existing game
    gameSetupFields.classList.add('hidden');
    startBtn.classList.add('hidden');
    joinBtn.classList.remove('hidden');

    // Only show setup if we don't have a name to auto-join
    if (!state.playerName) {
      setupScreen.classList.remove('hidden');
    }
  } else {
    setupScreen.classList.remove('hidden');
  }

  connect();
}

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${protocol}//${window.location.host}`);

  state.ws.onopen = () => {
    if (state.playerName && state.gameId) {
      joinGame();
    }
  };

  state.ws.onmessage = (event) => {
    const { type, payload } = JSON.parse(event.data);
    handleMessage(type, payload);
  };

  state.ws.onclose = () => {
    console.log('Disconnected. Reconnecting...');
    setTimeout(connect, 2000);
  };
}

function handleMessage(type, payload) {
  switch (type) {
    case 'GAME_CREATED':
      window.history.pushState({}, '', `/${payload.gameId}`);
      state.gameId = payload.gameId;
      joinGame();
      break;

    case 'GAME_UPDATE':
      state.currentGame = payload;
      updateUI();
      break;

    case 'ERROR':
      alert(payload.message);
      window.history.pushState({}, '', `/`);
      state.gameId = '';
      location.reload();
      break;
  }
}

function updateUI() {
  const game = state.currentGame;
  if (!game) return;

  setupScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  displayGameName.textContent = game.name;
  gameLink.textContent = window.location.href;

  // Timer Logic
  if (game.timerStartedAt) {
    if (!state.timerInterval) {
      state.timerInterval = setInterval(updateTimer, 1000);
    }
  } else {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    timerVal.textContent = '00:00';
  }

  // Players List
  playerList.innerHTML = game.players
    .map(
      (p) => `
        <div class="glass p-3 rounded-xl flex items-center justify-between ${p.id === state.playerId ? 'border-blue-500/50' : ''}">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs">
                    ${p.name.charAt(0).toUpperCase()}
                </div>
                <span class="${p.id === state.playerId ? 'text-blue-400 font-semibold' : 'text-slate-200'}">
                    ${p.name} ${p.isCreator ? '<span class="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded ml-1">ADMIN</span>' : ''}
                </span>
            </div>
            <div class="flex items-center gap-2">
                ${p.vote === true ? '<span class="w-2 h-2 bg-emerald-500 rounded-full pulse"></span>' : ''}
                ${game.revealed && p.vote !== false && p.vote !== null ? `<span class="font-bold text-blue-400">${p.vote}</span>` : ''}
            </div>
        </div>
    `,
    )
    .join('');

  // Game Board
  gameBoard.innerHTML = game.players
    .map(
      (p) => `
        <div class="flex flex-col items-center gap-3">
            <div class="w-16 h-24 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-500 transform ${
              game.revealed
                ? 'bg-slate-800 border-blue-500 text-blue-400 rotate-0'
                : p.vote
                  ? 'bg-blue-600 border-blue-400 text-white rotate-180'
                  : 'bg-slate-900/50 border-slate-700 text-slate-600'
            }">
                ${game.revealed ? p.vote || '?' : p.vote ? '✓' : ''}
            </div>
            <span class="text-sm font-medium text-slate-400">${p.name}</span>
        </div>
    `,
    )
    .join('');

  // Voting Cards
  const system = SYSTEMS[game.votingSystem] || SYSTEMS.fibonacci;
  const myVote = game.players.find((p) => p.id === state.playerId)?.vote;

  votingCards.innerHTML = system
    .map(
      (val) => `
        <button onclick="vote('${val}')" class="vote-card glass w-12 h-16 md:w-16 md:h-24 rounded-2xl border-2 border-slate-700 flex items-center justify-center text-xl font-bold ${
          game.revealed ? 'opacity-50 cursor-not-allowed' : ''
        } ${myVote === val ? 'selected' : ''}">
            ${val}
        </button>
    `,
    )
    .join('');

  // Admin Controls
  const isAdmin =
    game.creatorId === state.playerId || game.revealPolicy === 'all';
  revealBtn.style.display = isAdmin && !game.revealed ? 'block' : 'none';
  resetBtn.style.display = isAdmin && game.revealed ? 'block' : 'none';
}

function updateTimer() {
  const start = state.currentGame?.timerStartedAt;
  if (!start) return;

  const diff = Math.floor((Date.now() - start) / 1000);
  const mins = Math.floor(diff / 60)
    .toString()
    .padStart(2, '0');
  const secs = (diff % 60).toString().padStart(2, '0');
  timerVal.textContent = `${mins}:${secs}`;
}

// Actions
window.vote = (val) => {
  if (state.currentGame?.revealed) return;
  state.ws.send(JSON.stringify({ type: 'VOTE', payload: { vote: val } }));
};

startBtn.onclick = () => {
  const name = playerNameInput.value.trim();
  if (!name) return alert('Please enter your name');

  state.playerName = name;
  localStorage.setItem('playerName', name);

  const gameName = gameNameInput.value.trim() || 'New Planning Session';
  const votingSystem = votingSystemSelect.value;
  const revealPolicy = revealPolicySelect.value;

  state.ws.send(
    JSON.stringify({
      type: 'CREATE_GAME',
      payload: {
        playerId: state.playerId,
        playerName: name,
        gameName,
        votingSystem,
        revealPolicy,
      },
    }),
  );
};

joinBtn.onclick = () => {
  const name = playerNameInput.value.trim();
  if (!name) return alert('Please enter your name');

  state.playerName = name;
  localStorage.setItem('playerName', name);
  joinGame();
};

function joinGame() {
  state.ws.send(
    JSON.stringify({
      type: 'JOIN_GAME',
      payload: {
        gameId: state.gameId,
        playerId: state.playerId,
        playerName: state.playerName,
      },
    }),
  );
}

revealBtn.onclick = () => {
  state.ws.send(JSON.stringify({ type: 'REVEAL_CARDS' }));
};

resetBtn.onclick = () => {
  state.ws.send(JSON.stringify({ type: 'RESET_GAME' }));
};

timerToggle.onclick = () => {
  state.ws.send(JSON.stringify({ type: 'START_TIMER' }));
};

gameLink.onclick = () => {
  navigator.clipboard.writeText(window.location.href);
  const original = gameLink.textContent;
  gameLink.textContent = 'Copied!';
  setTimeout(() => (gameLink.textContent = original), 2000);
};

init();
