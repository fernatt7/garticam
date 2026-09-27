import { getPeerIds, leaveRoom, requestPlayAgain, requestTurnPass, sendGameMessage } from './network.js';

const room = document.querySelector('#app');
const startScreen = document.querySelector('#start-screen');
const leaderLobby = document.querySelector('#leader-lobby');
const gameOverScreen = document.querySelector('#game-over-screen');
const startStatus = document.querySelector('#start-status');
const cameraCheck = document.querySelector('#camera-check');
const trackingCheck = document.querySelector('#tracking-check');
const networkCheck = document.querySelector('#network-check');
const createRoomButton = document.querySelector('#create-room-btn');
const connectButton = document.querySelector('#connect-btn');
const soloPlayButton = document.querySelector('#solo-play-btn');
const helpOpenButton = document.querySelector('#help-open-btn');
const helpDialog = document.querySelector('#help-dialog');
const startGameButton = document.querySelector('#start-game-btn');
const turnLengthInput = document.querySelector('#turn-length-input');
const roundsInput = document.querySelector('#rounds-input');
const turnSettingLabel = document.querySelector('#turn-setting-label');
const roundSettingLabel = document.querySelector('#round-setting-label');
const lobbyStatus = document.querySelector('#lobby-status');
const leaderboard = document.querySelector('#leaderboard');
const resultsStatus = document.querySelector('#results-status');
const playAgainButton = document.querySelector('#play-again-btn');
const leaveRoomButton = document.querySelector('#leave-room-btn');
const topicPicker = document.querySelector('#topic-picker');
const topicOptions = document.querySelector('#topic-options');
const topicCard = document.querySelector('#topic-card');
const topicWord = document.querySelector('#topic-word');
const guessForm = document.querySelector('#guess-form');
const guessInput = document.querySelector('#guess-input');
const guessSend = document.querySelector('#guess-send');
const chatMessages = document.querySelector('#chat-messages');
const scoreReadout = document.querySelector('#score-readout');
const localScoreBadge = document.querySelector('#local-score-badge');
const remoteScoreBadge = document.querySelector('#remote-score-badge');
const landmarkToggle = document.querySelector('#landmark-toggle');
const passTurnButton = document.querySelector('#pass-turn-btn');

const topics = [

  // Animals
  'ant', 'bat', 'bear', 'bee', 'bird', 'butterfly',
  'camel', 'cat', 'chicken', 'cow', 'crab', 'crocodile', 'deer',
  'dog', 'dolphin', 'duck', 'eagle', 'elephant', 'fish', 'flamingo',
  'frog', 'giraffe', 'goat', 'gorilla', 'hamster', 'hedgehog',
  'hippo', 'horse', 'jellyfish', 'kangaroo', 'koala', 'ladybug',
  'lion', 'lizard', 'monkey', 'mouse', 'octopus', 'owl', 'panda',
  'parrot', 'penguin', 'pig', 'rabbit', 'shark', 'sheep', 'snail',
  'snake', 'spider', 'squirrel', 'tiger', 'turtle', 'whale', 'zebra',

  // Food
  'apple', 'avocado', 'banana', 'bread', 'burger', 'cake', 'candy',
  'carrot', 'cheese', 'cherry', 'chocolate', 'cookie', 'corn',
  'donut', 'egg', 'fries', 'grapes', 'hot dog', 'ice cream',
  'lemon', 'melon', 'mushroom', 'onion', 'orange', 'pancakes',
  'peach', 'pizza', 'popcorn', 'potato', 'pumpkin',
  'sandwich', 'strawberry', 'sushi', 'taco', 'tomato', 'watermelon',

  // Everyday objects
  'backpack', 'ball', 'balloon', 'basket', 'bed', 'bell', 'blanket',
  'bottle', 'box', 'bucket', 'button', 'candle', 'camera', 'chair',
  'clock', 'comb', 'cup', 'door', 'envelope', 'fan', 'flashlight',
  'fork', 'glasses', 'hammer', 'hat', 'key', 'knife', 'lamp',
  'laptop', 'lock', 'mirror', 'mug', 'notebook', 'pencil', 'phone',
  'pillow', 'plate', 'purse', 'ruler', 'scissors', 'shoe', 'spoon',
  'suitcase', 'table', 'television', 'towel', 'toothbrush', 'umbrella',
  'wallet', 'watch',

  // Vehicles
  'airplane', 'ambulance', 'bicycle', 'boat', 'bus', 'car',
  'fire truck', 'helicopter', 'motorcycle', 'police car', 'rocket',
  'boat', 'scooter', 'ship', 'skateboard', 'submarine',
  'taxi', 'tractor', 'train', 'truck', 'van',

  // Nature
  'cloud', 'flower', 'forest', 'grass', 'island', 'leaf', 'lightning',
  'moon', 'mountain', 'ocean', 'palm tree', 'rain', 'rainbow',
  'river', 'rock', 'snowflake', 'star', 'sun', 'sunflower', 'tree',
  'volcano', 'waterfall', 'wave',

  // Places
  'airport', 'bank', 'castle', 'church', 'farm', 'garage',
  'hospital', 'house', 'library', 'lighthouse', 'school', 'shop',
  'skyscraper', 'stadium', 'tent', 'tower',

  // People
  'baby', 'chef', 'clown', 'cowboy', 'detective', 'doctor',
  'firefighter', 'ghost', 'king', 'knight', 'mermaid', 'ninja',
  'pirate', 'police', 'princess', 'queen', 'robot',
  'santa', 'superhero', 'vampire', 'witch', 'wizard',

  // Simple recognizable things
  'anchor', 'bell', 'bomb', 'broom', 'cactus', 'crown', 'dice',
  'drum', 'flag', 'gift', 'heart', 'hourglass', 'magnet',
  'microphone', 'music note', 'palm', 'peace sign', 'pyramid',
  'question mark', 'skull', 'smiley face', 'snowman', 'sword',
  'target', 'trophy', 'wheel', 'wings',
].map(topic => topic.trim());

let connected = false;
let drawer = false;
let turnNumber = 0;
let activeTopic = '';
let choices = [];
let topicReady = false;
let roundSolved = false;
let hoverChoice = null;
let hoverStartedAt = 0;
let scores = {};
let showLandmarks = false;
let isHost = false;
let soloMode = false;
const readyChecks = { camera: false, tracking: false, network: false };

function updateReadiness() {
  const entries = [
    [cameraCheck, readyChecks.camera],
    [trackingCheck, readyChecks.tracking],
    [networkCheck, readyChecks.network]
  ];
  entries.forEach(([element, ready]) => {
    element.textContent = ready ? '✓' : '...';
    element.classList.toggle('ready', ready);
  });

  const cameraReady = readyChecks.camera && readyChecks.tracking;
  const multiplayerReady = cameraReady && readyChecks.network;
  createRoomButton.disabled = !multiplayerReady;
  connectButton.disabled = !multiplayerReady;
  soloPlayButton.disabled = !cameraReady;
  startStatus.textContent = multiplayerReady
    ? 'All systems ready.'
    : cameraReady
      ? 'Camera and hand tracking ready. Waiting for network.'
      : 'Loading Garticam...';
}

function showLobby(host) {
  startScreen.hidden = true;
  gameOverScreen.hidden = true;
  leaderLobby.hidden = false;
  room.classList.add('is-lobby');
  room.classList.remove('is-playing', 'is-game-over');
  isHost = host;
  turnLengthInput.disabled = !host;
  roundsInput.disabled = !host;
  turnSettingLabel.classList.toggle('settings-disabled', !host);
  roundSettingLabel.classList.toggle('settings-disabled', !host);
  startGameButton.hidden = !host;
  startGameButton.disabled = true;
  lobbyStatus.textContent = host ? 'Waiting for another player to join.' : 'Waiting for the room leader to start.';
}

function showGame() {
  startScreen.hidden = true;
  leaderLobby.hidden = true;
  gameOverScreen.hidden = true;
  room.classList.remove('is-lobby', 'is-game-over');
  room.classList.add('is-playing');
}

function startSolo() {
  soloMode = true;
  connected = true;
  drawer = true;
  isHost = false;
  turnNumber = 1;
  activeTopic = '';
  topicReady = false;
  roundSolved = false;
  scores = {};
  room.classList.add('is-solo');
  showGame();
  topicPicker.hidden = true;
  topicCard.hidden = true;
  setGuessEnabled();
  updateScores();
  window.dispatchEvent(new CustomEvent('garticam:role-changed', {
    detail: { isDrawer: true, connected: true, isSolo: true, turnNumber }
  }));
}

function showGameOver(result) {
  room.classList.add('is-game-over');
  room.classList.remove('is-playing', 'is-lobby');
  startScreen.hidden = true;
  leaderLobby.hidden = true;
  gameOverScreen.hidden = false;
  const players = [
    { id: result.localPeerId, name: result.username || 'You' },
    { id: result.otherPeerId, name: result.remoteUsername || 'Other player' }
  ];
  const ranked = players
    .map(player => ({ ...player, score: result.scores?.[player.id] || 0 }))
    .sort((a, b) => b.score - a.score);
  leaderboard.replaceChildren();

  ranked.forEach((player, index) => {
    const row = document.createElement('li');
    const place = document.createElement('span');
    const name = document.createElement('strong');
    const score = document.createElement('span');
    place.textContent = `${index + 1}.`;
    name.textContent = player.name;
    score.textContent = `${player.score} pts`;
    row.append(place, name, score);
    leaderboard.append(row);
  });

  resultsStatus.textContent = ranked[0]?.score === ranked[1]?.score ? 'It’s a tie.' : `${ranked[0]?.name} wins!`;
  playAgainButton.textContent = isHost ? 'Play again' : 'Request rematch';
}

function setGuessEnabled() {
  const canGuess = connected && !drawer && topicReady && !roundSolved;
  guessInput.disabled = !canGuess;
  guessSend.disabled = !canGuess;
  if (!canGuess) guessInput.placeholder = drawer ? 'Drawer cannot guess' : 'Waiting for topic';
  else guessInput.placeholder = 'Type a guess';
}

function updateScores() {
  const { localPeerId, otherPeerId } = getPeerIds();
  const localScore = scores[localPeerId] || 0;
  const otherScore = otherPeerId ? scores[otherPeerId] || 0 : 0;
  scoreReadout.textContent = `You ${localScore} · Other ${otherScore}`;
  if (localScoreBadge) localScoreBadge.textContent = `${localScore} pts`;
  if (remoteScoreBadge) remoteScoreBadge.textContent = `${otherScore} pts`;
}

function appendChat(text, result = '') {
  const item = document.createElement('li');
  const message = document.createElement('span');
  message.textContent = text;
  item.append(message);

  if (result) {
    const badge = document.createElement('strong');
    badge.className = `guess-result ${result.toLowerCase().replaceAll(' ', '-')}`;
    badge.textContent = result;
    item.append(badge);
  }

  chatMessages.append(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChatForTurn() {
  roundSolved = false;
  topicReady = false;
  setGuessEnabled();
  updateScores();
  if (turnNumber > 0) appendChat(`Turn ${turnNumber} started`);
}

function chooseTwoTopics() {
  const shuffled = [...topics];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 2);
}

function startTopicChoice() {
  activeTopic = '';
  topicReady = false;
  roundSolved = false;
  choices = chooseTwoTopics();
  hoverChoice = null;
  topicWord.textContent = 'Choose a topic';
  topicCard.hidden = true;
  topicOptions.replaceChildren();

  choices.forEach((topic, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'topic-option';
    button.dataset.choice = String(index);
    button.textContent = topic;
    button.addEventListener('click', () => selectTopic(index));
    topicOptions.append(button);
  });

  topicPicker.hidden = false;
}

function selectTopic(index) {
  if (!drawer || !choices[index] || activeTopic) return;
  activeTopic = choices[index];
  topicReady = true;
  topicWord.textContent = activeTopic;
  topicCard.hidden = false;
  topicPicker.hidden = true;
  setGuessEnabled();
  sendGameMessage({ type: 'game-round-ready' });
}

export function updateTopicHover(clientX, clientY, enabled) {
  if (!drawer || topicPicker.hidden) return false;

  const target = enabled
    ? document.elementFromPoint(clientX, clientY)?.closest('.topic-option')
    : null;

  if (target !== hoverChoice) {
    hoverChoice?.classList.remove('gaze-hover');
    hoverChoice = target;
    hoverStartedAt = performance.now();
    if (hoverChoice) hoverChoice.classList.add('gaze-hover');
  }

  if (hoverChoice) {
    const progress = Math.min(1, (performance.now() - hoverStartedAt) / 700);
    hoverChoice.style.setProperty('--dwell-progress', String(progress));
    if (progress >= 1) selectTopic(Number(hoverChoice.dataset.choice));
  }

  return true;
}

function normalizeGuess(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').trim().replace(/\s+/g, ' ');
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column++) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }

  return previous[right.length];
}

function gradeGuess(guess) {
  const expected = normalizeGuess(activeTopic);
  const actual = normalizeGuess(guess);
  if (actual === expected) return { result: 'Correct', correct: true };

  const similarity = 1 - editDistance(actual, expected) / Math.max(actual.length, expected.length, 1);
  return { result: similarity >= 0.72 ? 'Very close' : 'Not quite', correct: false };
}

function publishGuess(guess, guesserId) {
  const grade = gradeGuess(guess);
  const { localPeerId, otherPeerId } = getPeerIds();

  if (grade.correct && !roundSolved) {
    scores[guesserId] = (scores[guesserId] || 0) + 100;
    scores[localPeerId] = (scores[localPeerId] || 0) + 50;
    roundSolved = true;
    topicReady = false;
    setGuessEnabled();
  }

  const resultMessage = {
    type: 'game-public-guess',
    guess,
    result: grade.result,
    correct: grade.correct,
    answer: grade.correct ? activeTopic : '',
    scores: { ...scores },
    guesserId
  };

  appendChat(`Other guessed: ${guess}`, grade.result);
  updateScores();
  sendGameMessage(resultMessage);
}

guessForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const guess = guessInput.value.trim();
  if (!guess || !connected || drawer || !topicReady || roundSolved) return;

  sendGameMessage({ type: 'game-guess', text: guess });
  guessInput.value = '';
});

window.addEventListener('garticam:role-changed', (event) => {
  const next = event.detail;
  connected = next.connected;
  drawer = next.isDrawer;
  soloMode = Boolean(next.isSolo);
  if (next.turnNumber !== turnNumber) {
    turnNumber = next.turnNumber;
    clearChatForTurn();
    if (connected && drawer && !soloMode) startTopicChoice();
    else {
      topicPicker.hidden = true;
      topicCard.hidden = true;
    }
  }
  setGuessEnabled();
});

window.addEventListener('garticam:incoming-guess', (event) => {
  if (!drawer || !activeTopic || roundSolved) return;
  publishGuess(event.detail.text, event.detail.fromPeerId);
});

window.addEventListener('garticam:game-round-ready', () => {
  topicReady = true;
  setGuessEnabled();
});

window.addEventListener('garticam:public-guess', (event) => {
  const result = event.detail;
  scores = result.scores || scores;
  appendChat(`You guessed: ${result.guess}`, result.result);
  if (result.correct) {
    roundSolved = true;
    topicReady = false;
    topicWord.textContent = result.answer;
  }
  updateScores();
  setGuessEnabled();
});

window.addEventListener('garticam:before-turn-change', () => {
  if (!drawer || !activeTopic) return;
  appendChat(`Round ended. Answer: ${activeTopic}`);
  sendGameMessage({ type: 'game-round-end', answer: activeTopic, turnNumber });
});

window.addEventListener('garticam:game-round-end', (event) => {
  appendChat(`Round ended. Answer: ${event.detail.answer}`);
});

landmarkToggle.addEventListener('click', () => {
  showLandmarks = !showLandmarks;
  landmarkToggle.setAttribute('aria-pressed', String(showLandmarks));
  landmarkToggle.textContent = showLandmarks ? 'Landmarks on' : 'Landmarks off';
  window.dispatchEvent(new CustomEvent('garticam:landmarks-toggle', { detail: { show: showLandmarks } }));
});

passTurnButton.addEventListener('click', requestTurnPass);
playAgainButton.addEventListener('click', requestPlayAgain);
leaveRoomButton.addEventListener('click', leaveRoom);

window.addEventListener('garticam:camera-ready', () => {
  readyChecks.camera = true;
  updateReadiness();
});
window.addEventListener('garticam:tracking-ready', () => {
  readyChecks.tracking = true;
  updateReadiness();
});
window.addEventListener('garticam:peer-ready', () => {
  readyChecks.network = true;
  updateReadiness();
});

window.addEventListener('garticam:room-created', () => showLobby(true));
window.addEventListener('garticam:room-ready', (event) => {
  showLobby(event.detail.isHost);
  if (event.detail.isHost) startGameButton.disabled = false;
});
window.addEventListener('garticam:game-start', (event) => {
  if (event.detail?.resetScores) scores = {};
  soloMode = false;
  room.classList.remove('is-solo');
  showGame();
});
window.addEventListener('garticam:game-over', (event) => showGameOver(event.detail));
window.addEventListener('garticam:room-disconnected', () => {
  startScreen.hidden = false;
  leaderLobby.hidden = true;
  gameOverScreen.hidden = true;
  room.classList.add('is-lobby');
  room.classList.remove('is-playing', 'is-game-over', 'is-solo');
  soloMode = false;
  updateReadiness();
});

soloPlayButton.addEventListener('click', startSolo);
helpOpenButton.addEventListener('click', () => helpDialog.showModal());
helpDialog.addEventListener('click', (event) => {
  if (event.target === helpDialog) helpDialog.close();
});
helpDialog.addEventListener('click', (event) => {
  if (event.target === helpDialog) helpDialog.close();
});

updateReadiness();
setGuessEnabled();