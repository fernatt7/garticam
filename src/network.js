import './style.css';
import { Peer } from 'peerjs';

const peer = new Peer();
const room = document.getElementById('app');
const myId = document.getElementById('my-id');
const usernameInput = document.getElementById('username-input');
const peerIdInput = document.getElementById('peer-id');
const createRoomButton = document.getElementById('create-room-btn');
const connectButton = document.getElementById('connect-btn');
const startGameButton = document.getElementById('start-game-btn');
const turnLengthInput = document.getElementById('turn-length-input');
const roundsInput = document.getElementById('rounds-input');
const lobbyHeading = document.getElementById('lobby-heading');
const lobbyRoomId = document.getElementById('lobby-room-id');
const lobbyStatus = document.getElementById('lobby-status');
const networkStatus = document.getElementById('network-status');
const startScreenStatus = document.getElementById('startup-network-status');
const startScreen = document.getElementById('start-screen');
const leaderLobby = document.getElementById('leader-lobby');
const gameOverScreen = document.getElementById('game-over-screen');
const localPreview = document.getElementById('local-preview');
const remoteVideo = document.getElementById('remote-webcam');
const remoteStageVideo = document.getElementById('remote-stage-webcam');
const localPlayerLabel = document.querySelector('#local-preview + span');
const remotePlayerLabel = document.querySelector('#remote-webcam + span');
const stageViewToggle = document.getElementById('stage-view-toggle');
const turnTimer = document.getElementById('turn-timer');
const passTurnButton = document.getElementById('pass-turn-btn');
const muteButton = document.getElementById('mute-btn');

let conn = null;
let localStream = null;
let mediaCall = null;
let pendingIncomingCall = null;
let localIsConnector = false;
let intendsToHost = false;
let username = 'Player';
let remoteUsername = 'Player 2';
let drawerPeerId = null;
let previousDrawerPeerId = null;
let previousTurnNumber = 0;
let turnNumber = 0;
let turnEndsAt = 0;
let turnDurationMs = 60_000;
let roundsPerPlayer = 3;
let turnsPlayed = 0;
let nextMessageId = 0;
let latestScores = {};
let isMuted = false;

function setStatus(message) {
  if (networkStatus) networkStatus.textContent = message;
  if (startScreenStatus) startScreenStatus.textContent = message;
}

function updateRoleUI() {
  const connected = Boolean(conn?.open);
  const isDrawer = connected && drawerPeerId === peer.id;

  if (localPlayerLabel) localPlayerLabel.textContent = username;
  if (remotePlayerLabel) remotePlayerLabel.textContent = remoteUsername;

  room.classList.toggle('is-drawer', connected && isDrawer);
  room.classList.toggle('is-guesser', connected && !isDrawer);
  room.classList.toggle('is-waiting', !connected);
  // Only the current drawer may pass their own turn.
  passTurnButton.disabled = !connected || !isDrawer;
  stageViewToggle.hidden = !connected || !drawerPeerId;
  stageViewToggle.setAttribute('aria-pressed', String(room.classList.contains('canvas-only')));
  stageViewToggle.textContent = room.classList.contains('canvas-only') ? 'Show camera' : 'Canvas only';

  window.dispatchEvent(new CustomEvent('garticam:role-changed', {
    detail: {
      isDrawer,
      connected,
      isHost: localIsConnector,
      turnNumber,
      turnEndsAt,
      username,
      remoteUsername
    }
  }));
}

function setDrawerPeer(id, newTurnNumber = turnNumber, newTurnEndsAt = turnEndsAt) {
  if (id !== peer.id && id !== conn?.peer) return;
  if (newTurnNumber < turnNumber) return;

  const isNewTurn = newTurnNumber > turnNumber;
  if (isNewTurn) {
    window.dispatchEvent(new CustomEvent('garticam:before-turn-change'));
    previousDrawerPeerId = drawerPeerId;
    previousTurnNumber = turnNumber;
  }

  turnNumber = newTurnNumber;
  turnEndsAt = newTurnEndsAt;
  drawerPeerId = id;
  updateRoleUI();

  if (isNewTurn) {
    window.dispatchEvent(new CustomEvent('garticam:turn-changed', {
      detail: { turnNumber, turnEndsAt }
    }));
  }
}

function beginTurn(drawerId, nextTurnNumber = turnNumber + 1) {
  if (!conn?.open || !localIsConnector) return;
  if (turnsPlayed >= roundsPerPlayer * 2) {
    finishGame();
    return;
  }

  turnsPlayed++;
  setDrawerPeer(drawerId, nextTurnNumber, 0); // 0 = timer not started yet
  conn.send({
    type: 'turn-change',
    drawerPeerId: drawerId,
    turnNumber: nextTurnNumber,
    turnEndsAt: 0,
    turnsPlayed,
    turnDurationMs,
    roundsPerPlayer
  });
}

export function confirmTopicReady() {
  if (!conn?.open || !localIsConnector || !drawerPeerId || turnEndsAt) return;
  turnEndsAt = Date.now() + turnDurationMs;
  conn.send({ type: 'turn-timer-start', turnEndsAt });
}

function finishGame(scores = latestScores, receivedFromPeer = false) {
  window.dispatchEvent(new CustomEvent('garticam:before-turn-change'));
  turnEndsAt = 0;
  latestScores = scores || {};
  updateRoleUI();
  const result = {
    scores: latestScores,
    localPeerId: peer.id,
    otherPeerId: conn?.peer,
    username,
    remoteUsername
  };
  window.dispatchEvent(new CustomEvent('garticam:game-over', { detail: result }));
  room.classList.remove('is-playing', 'is-lobby');
  room.classList.add('is-game-over');
  startScreen.hidden = true;
  leaderLobby.hidden = true;
  gameOverScreen.hidden = false;

  if (!receivedFromPeer && localIsConnector && conn?.open) {
    conn.send({ type: 'game-over', scores: latestScores });
  }
}

export function startGame(settings = {}) {
  if (!conn?.open || !localIsConnector) return;

  turnDurationMs = Math.min(300, Math.max(45, Number(settings.turnSeconds) || 60)) * 1000;
  roundsPerPlayer = Math.min(10, Math.max(1, Number(settings.roundsPerPlayer) || 3));
  turnsPlayed = 0;
  turnNumber = 0;
  drawerPeerId = null;
  latestScores = {};

  conn.send({
    type: 'game-start',
    turnDurationMs,
    roundsPerPlayer,
    hostName: username,
    guestName: remoteUsername
  });
  window.dispatchEvent(new CustomEvent('garticam:game-start', {
    detail: { turnDurationMs, roundsPerPlayer, resetScores: true }
  }));
  room.classList.remove('is-lobby', 'is-game-over');
  room.classList.add('is-playing');
  startScreen.hidden = true;
  leaderLobby.hidden = true;
  gameOverScreen.hidden = true;
  beginTurn(peer.id, 1);
}

function updateTurnClock() {
  const active = Boolean(conn?.open && turnEndsAt);
  const remaining = active ? Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000)) : null;
  turnTimer.textContent = remaining === null
    ? '--:--'
    : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  if (localIsConnector && active && remaining === 0) {
    beginTurn(drawerPeerId === peer.id ? conn.peer : peer.id);
  }
}

setInterval(updateTurnClock, 250);

function setRemoteStream(stream) {
  [remoteVideo, remoteStageVideo].forEach((element) => {
    element.srcObject = stream;
    element.play().catch((error) => console.warn('Remote video playback was blocked:', error));
  });
}

function clearRemoteStream() {
  [remoteVideo, remoteStageVideo].forEach((element) => { element.srcObject = null; });
}

function answerMediaCall(call) {
  if (!localStream || !call) return;
  mediaCall = call;
  call.answer(localStream);
  call.on('stream', setRemoteStream);
  call.on('close', () => {
    if (mediaCall === call) mediaCall = null;
    clearRemoteStream();
  });
  call.on('error', (error) => {
    console.error('Peer media error:', error);
    setStatus('Camera connection error');
  });
}

function startMediaCall() {
  if (!localStream || !conn?.open || !localIsConnector || mediaCall) return;
  mediaCall = peer.call(conn.peer, localStream);
  if (!mediaCall) return;
  mediaCall.on('stream', setRemoteStream);
  mediaCall.on('close', () => {
    clearRemoteStream();
    mediaCall = null;
  });
  mediaCall.on('error', (error) => {
    console.error('Peer media error:', error);
    setStatus('Camera connection error');
  });
}

export function setLocalStream(stream) {
  localStream = stream;
  localStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
  localPreview.srcObject = stream;
  localPreview.play().catch((error) => console.warn('Local preview playback was blocked:', error));

  if (conn?.open && !localIsConnector && pendingIncomingCall) {
    answerMediaCall(pendingIncomingCall);
    pendingIncomingCall = null;
  } else {
    startMediaCall();
  }
}

peer.on('open', (id) => {
  myId.textContent = id;
  setStatus('Network ready');
  createRoomButton.disabled = false;
  connectButton.disabled = false;
  window.dispatchEvent(new CustomEvent('garticam:peer-ready', { detail: { peerId: id } }));
  updateRoleUI();
});

function isValidPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 640 && point.y >= 0 && point.y <= 480;
}

function handleStrokeMessage(message, sourcePeerId) {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'room-join') {
    if (!localIsConnector || sourcePeerId !== conn?.peer) return;
    remoteUsername = message.username || 'Player 2';
    lobbyHeading.textContent = `${remoteUsername} joined your room`;
    lobbyRoomId.textContent = `Room ID: ${peer.id}`;
    lobbyStatus.textContent = 'Set the rules, then start the game.';
    window.dispatchEvent(new CustomEvent('garticam:room-ready', { detail: { isHost: true } }));
    conn.send({ type: 'room-state', username, host: true });
    return;
  }

  if (message.type === 'room-state') {
    if (sourcePeerId !== conn?.peer) return;
    remoteUsername = message.username || 'Room host';
    lobbyRoomId.textContent = `Connected to ${remoteUsername}'s room.`;
    lobbyHeading.textContent = `Joined ${remoteUsername}'s room`;
    lobbyStatus.textContent = 'Waiting for the room leader to start.';
    window.dispatchEvent(new CustomEvent('garticam:room-ready', { detail: { isHost: false } }));
    return;
  }

  if (message.type === 'game-start') {
    if (sourcePeerId !== conn?.peer) return;
    turnDurationMs = message.turnDurationMs;
    roundsPerPlayer = message.roundsPerPlayer;
    turnsPlayed = 0;
    turnNumber = 0;
    drawerPeerId = null;
    latestScores = {};
    remoteUsername = message.hostName || remoteUsername;
    username = message.guestName || username;
    window.dispatchEvent(new CustomEvent('garticam:game-start', {
      detail: { turnDurationMs, roundsPerPlayer, resetScores: true }
    }));
    return;
  }

  if (message.type === 'turn-change') {
    if (localIsConnector || sourcePeerId !== conn?.peer) return;
    if (Number.isFinite(message.turnDurationMs)) turnDurationMs = message.turnDurationMs;
    if (Number.isInteger(message.roundsPerPlayer)) roundsPerPlayer = message.roundsPerPlayer;
    if (Number.isInteger(message.turnsPlayed)) turnsPlayed = message.turnsPlayed;
    setDrawerPeer(message.drawerPeerId, message.turnNumber, message.turnEndsAt);
    return;
  }

  if (message.type === 'turn-pass-request') {
    // Only the peer currently holding the drawer role may trigger a pass.
    if (localIsConnector && sourcePeerId === conn?.peer && sourcePeerId === drawerPeerId) {
      beginTurn(drawerPeerId === peer.id ? conn.peer : peer.id);
    }
    return;
  }

  if (message.type === 'game-over') {
    if (sourcePeerId === conn?.peer) finishGame(message.scores, true);
    return;
  }

  if (message.type === 'play-again-request') {
    if (localIsConnector) startGame({ turnSeconds: turnDurationMs / 1000, roundsPerPlayer });
    return;
  }

  if (message.type === 'game-guess') {
    if (isLocalDrawer() && sourcePeerId === conn?.peer && typeof message.text === 'string') {
      window.dispatchEvent(new CustomEvent('garticam:incoming-guess', {
        detail: { text: message.text, fromPeerId: sourcePeerId }
      }));
    }
    return;
  }

  if (message.type === 'game-round-ready' || message.type === 'game-round-end') {
    const currentDrawer = sourcePeerId === drawerPeerId;
    const previousDrawer = message.type === 'game-round-end' &&
      sourcePeerId === previousDrawerPeerId && message.turnNumber === previousTurnNumber;
    if (currentDrawer || previousDrawer) {
      window.dispatchEvent(new CustomEvent(`garticam:${message.type}`, { detail: message }));
    }
    if (currentDrawer && message.type === 'game-round-ready') confirmTopicReady();
    return;
  }

  if (message.type === 'game-public-guess') {
    if (sourcePeerId === drawerPeerId) {
      latestScores = message.scores || latestScores;
      window.dispatchEvent(new CustomEvent('garticam:public-guess', { detail: message }));
    }
    return;
  }

  if (message.type === 'canvas-clear' || message.type === 'canvas-undo') {
    if (sourcePeerId === drawerPeerId && sourcePeerId !== peer.id) {
      window.dispatchEvent(new CustomEvent('garticam:remote-canvas-control', { detail: message }));
    }
    return;
  }

  if (sourcePeerId !== drawerPeerId || sourcePeerId === peer.id || typeof message.strokeId !== 'string') return;
  if (message.type === 'stroke-start') {
    if (!isValidPoint(message.point) || !Number.isFinite(message.width) ||
        message.width < 1 || message.width > 80 || typeof message.color !== 'string') return;
  } else if (message.type === 'stroke-point') {
    if (!isValidPoint(message.point)) return;
  } else if (message.type !== 'stroke-end') {
    return;
  }
  window.dispatchEvent(new CustomEvent('garticam:remote-stroke', { detail: message }));
}

function setConnection(connection, isOutgoing) {
  conn = connection;
  localIsConnector = intendsToHost;
  drawerPeerId = null;
  turnNumber = 0;

  connection.on('open', () => {
    setStatus('Room connection ready');
    if (!localIsConnector) connection.send({ type: 'room-join', username });
    if (pendingIncomingCall && localStream && !localIsConnector) {
      answerMediaCall(pendingIncomingCall);
      pendingIncomingCall = null;
    }
    if (localIsConnector) startMediaCall();
  });

  connection.on('data', (message) => handleStrokeMessage(message, connection.peer));
  connection.on('close', () => {
    if (conn !== connection) return;
    conn = null;
    drawerPeerId = null;
    turnEndsAt = 0;
    localIsConnector = false;
    clearRemoteStream();
    setStatus('Peer disconnected');
    window.dispatchEvent(new CustomEvent('garticam:room-disconnected'));
    updateRoleUI();
  });
  connection.on('error', (error) => {
    console.error('Peer connection error:', error);
    setStatus('Connection error');
  });
}

peer.on('connection', (incomingConnection) => setConnection(incomingConnection, false));
peer.on('call', (call) => {
  pendingIncomingCall = call;
  if (localStream && conn?.open && !localIsConnector) {
    answerMediaCall(call);
    pendingIncomingCall = null;
  }
});
peer.on('error', (error) => {
  console.error('Peer signaling error:', error);
  setStatus('Signaling error');
});

createRoomButton.addEventListener('click', () => {
  username = usernameInput.value.trim() || 'Player';
  intendsToHost = true;
  localIsConnector = true;
  lobbyRoomId.textContent = `Room ID: ${peer.id}`;
  lobbyHeading.textContent = 'Your room is ready';
  lobbyStatus.textContent = 'Waiting for another player to join.';
  window.dispatchEvent(new CustomEvent('garticam:room-created'));
});

connectButton.addEventListener('click', () => {
  const otherPeerId = peerIdInput.value.trim();
  if (!otherPeerId) {
    setStatus('Enter a room ID');
    return;
  }
  username = usernameInput.value.trim() || 'Player';
  intendsToHost = false;
  setStatus('Joining room...');
  lobbyStatus.textContent = 'Connecting to room...';
  const connection = peer.connect(otherPeerId, { reliable: true });
  setConnection(connection, true);
});

startGameButton.addEventListener('click', () => {
  startGame({ turnSeconds: turnLengthInput.value, roundsPerPlayer: roundsInput.value });
});

// Note: the click listener for passTurnButton lives in game.js (via the
// requestTurnPass export below), not here — having it wired in both files
// was firing two passes per click. Keep it that way; don't re-add a
// listener on this button in this file.

stageViewToggle.addEventListener('click', () => {
  if (!conn?.open) return;
  const canvasOnly = room.classList.toggle('canvas-only');
  stageViewToggle.setAttribute('aria-pressed', String(canvasOnly));
  stageViewToggle.textContent = canvasOnly ? 'Show camera' : 'Canvas only';
});

muteButton.addEventListener('click', () => {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
  muteButton.setAttribute('aria-pressed', String(isMuted));
  muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
});

export function isLocalDrawer() {
  return conn?.open ? drawerPeerId === peer.id : true;
}

export function sendStrokeEvent(message) {
  if (isLocalDrawer() && conn?.open) conn.send({ ...message, messageId: ++nextMessageId });
}

export function sendGameMessage(message) {
  if (!conn?.open) return false;
  if (message.type === 'game-public-guess' && message.scores) latestScores = message.scores;
  conn.send({ ...message, messageId: ++nextMessageId });
  return true;
}

export function getPeerIds() {
  return { localPeerId: peer.id, otherPeerId: conn?.peer ?? null };
}

export function requestTurnPass() {
  // Only the peer who currently holds the drawer role can pass the turn,
  // whether they're host or guest.
  if (!conn?.open || !drawerPeerId || drawerPeerId !== peer.id) return;
  if (localIsConnector) beginTurn(conn.peer);
  else conn.send({ type: 'turn-pass-request' });
}

export function requestPlayAgain() {
  if (!conn?.open) return;
  if (localIsConnector) startGame({ turnSeconds: turnDurationMs / 1000, roundsPerPlayer });
  else conn.send({ type: 'play-again-request' });
}

export function leaveRoom() {
  if (conn) conn.close();
  conn = null;
  drawerPeerId = null;
  turnNumber = 0;
  turnEndsAt = 0;
  turnsPlayed = 0;
  localIsConnector = false;
  intendsToHost = false;
  clearRemoteStream();
  window.dispatchEvent(new CustomEvent('garticam:room-disconnected'));
  updateRoleUI();
}

