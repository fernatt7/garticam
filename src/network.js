import './style.css';
import { Peer } from 'peerjs';

const peer = new Peer();
const myId = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id');
const connectButton = document.getElementById('connect-btn');
const passTurnButton = document.getElementById('pass-turn-btn');
const networkStatus = document.getElementById('network-status');
const remoteVideo = document.getElementById('remote-webcam');
const remoteStageVideo = document.getElementById('remote-stage-webcam');
const localPreview = document.getElementById('local-preview');
const room = document.getElementById('app');
const stageViewToggle = document.getElementById('stage-view-toggle');
const turnTimer = document.getElementById('turn-timer');
const TURN_DURATION_MS = 60_000;

let conn = null;
let localStream = null;
let mediaCall = null;
let localIsConnector = false;
let drawerPeerId = null;
let previousDrawerPeerId = null;
let previousTurnNumber = 0;
let turnNumber = 0;
let nextMessageId = 0;
let turnEndsAt = 0;
let turnClock = null;

function setStatus(message) {
  if (networkStatus) networkStatus.textContent = message;
}

function updateRoleUI() {
  const connected = Boolean(conn?.open && drawerPeerId);
  const isDrawer = connected && drawerPeerId === peer.id;

  room?.classList.toggle('is-drawer', connected && isDrawer);
  room?.classList.toggle('is-guesser', connected && !isDrawer);
  room?.classList.toggle('is-waiting', !connected);
  if (passTurnButton) {
    passTurnButton.disabled = !connected;
    passTurnButton.textContent = isDrawer ? 'Pass turn' : 'Become drawer';
  }

  if (stageViewToggle) {
    stageViewToggle.hidden = !connected;
    stageViewToggle.setAttribute('aria-pressed', String(room?.classList.contains('canvas-only') ?? false));
    stageViewToggle.textContent = room?.classList.contains('canvas-only') ? 'Show camera' : 'Canvas only';
  }
  window.dispatchEvent(new CustomEvent('garticam:role-changed', {
    detail: { isDrawer, connected, turnNumber, turnEndsAt }
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
    window.dispatchEvent(new CustomEvent('garticam:turn-changed', { detail: { turnNumber, turnEndsAt } }));
  }
}

function beginTurn(drawerId, nextTurnNumber = turnNumber + 1) {
  if (!conn?.open) return;
  const endsAt = Date.now() + TURN_DURATION_MS;
  setDrawerPeer(drawerId, nextTurnNumber, endsAt);
  conn.send({ type: 'turn-change', drawerPeerId: drawerId, turnNumber: nextTurnNumber, turnEndsAt: endsAt });
}

function updateTurnClock() {
  const connected = Boolean(conn?.open && turnEndsAt);
  const remainingSeconds = connected ? Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000)) : null;
  if (turnTimer) turnTimer.textContent = remainingSeconds === null
    ? '--:--'
    : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  if (localIsConnector && connected && remainingSeconds === 0) {
    beginTurn(drawerPeerId === peer.id ? conn.peer : peer.id);
  }
}

if (!turnClock) turnClock = setInterval(updateTurnClock, 250);

function setRemoteStream(stream) {
  [remoteVideo, remoteStageVideo].forEach((videoElement) => {
    if (!videoElement) return;
    videoElement.srcObject = stream;
    videoElement.play().catch((error) => console.warn('Remote video playback was blocked:', error));
  });
}

function clearRemoteStream() {
  [remoteVideo, remoteStageVideo].forEach((videoElement) => {
    if (videoElement) videoElement.srcObject = null;
  });
}

function answerPendingCall(call) {
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
  if (localPreview) {
    localPreview.srcObject = stream;
    localPreview.play().catch((error) => console.warn('Local preview playback was blocked:', error));
  }
  if (conn?.open && !localIsConnector && pendingIncomingCall) {
    answerPendingCall(pendingIncomingCall);
    pendingIncomingCall = null;
  } else {
    startMediaCall();
  }
}

let pendingIncomingCall = null;

peer.on('open', (id) => {
  if (myId) myId.textContent = id;
  setStatus('Ready to connect');
  updateRoleUI();
});

function isValidPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 640 && point.y >= 0 && point.y <= 480;
}

function handleStrokeMessage(message, sourcePeerId) {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'room-state' || message.type === 'turn-change') {
    if (typeof message.drawerPeerId === 'string' && Number.isInteger(message.turnNumber)) {
      setDrawerPeer(message.drawerPeerId, message.turnNumber, message.turnEndsAt);
    }
    return;
  }

  if (message.type === 'turn-pass-request') {
    if (localIsConnector && sourcePeerId === conn?.peer) {
      beginTurn(drawerPeerId === peer.id ? conn.peer : peer.id);
    }
    return;
  }

  if (message.type === 'game-guess') {
    if (isLocalDrawer() && sourcePeerId !== peer.id && typeof message.text === 'string') {
      window.dispatchEvent(new CustomEvent('garticam:incoming-guess', {
        detail: { text: message.text, fromPeerId: sourcePeerId }
      }));
    }
    return;
  }

  if (message.type === 'game-round-ready' || message.type === 'game-round-end') {
    const isCurrentDrawer = sourcePeerId === drawerPeerId;
    const isPreviousTurnDrawer = message.type === 'game-round-end' &&
      sourcePeerId === previousDrawerPeerId && message.turnNumber === previousTurnNumber;
    if (isCurrentDrawer || isPreviousTurnDrawer) {
      window.dispatchEvent(new CustomEvent(`garticam:${message.type}`, { detail: message }));
    }
    return;
  }

  if (message.type === 'game-public-guess') {
    if (sourcePeerId === drawerPeerId) {
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

  if (sourcePeerId !== drawerPeerId || sourcePeerId === peer.id ||
      typeof message.strokeId !== 'string') return;

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
  if (conn && conn !== connection) conn.close();
  conn = connection;
  localIsConnector = isOutgoing;
  drawerPeerId = null;
  turnNumber = 0;
  updateRoleUI();

  connection.on('open', () => {
    setStatus(`Connected to ${connection.peer}`);
    if (isOutgoing) {
      turnEndsAt = Date.now() + TURN_DURATION_MS;
      setDrawerPeer(peer.id, 1, turnEndsAt);
      connection.send({ type: 'room-state', drawerPeerId: peer.id, turnNumber: 1, turnEndsAt });
      startMediaCall();
    } else if (pendingIncomingCall && localStream) {
      answerPendingCall(pendingIncomingCall);
      pendingIncomingCall = null;
    }
  });

  connection.on('data', (message) => handleStrokeMessage(message, connection.peer));

  connection.on('close', () => {
    if (conn !== connection) return;
    conn = null;
    drawerPeerId = null;
    turnEndsAt = 0;
    localIsConnector = false;
    if (mediaCall) {
      mediaCall.close();
      mediaCall = null;
    }
    clearRemoteStream();
    setStatus('Peer disconnected');
    updateRoleUI();
  });

  connection.on('error', (error) => {
    console.error('Peer connection error:', error);
    setStatus('Connection error');
  });
}

connectButton?.addEventListener('click', () => {
  const otherPeerId = peerIdInput?.value.trim();
  if (!otherPeerId) {
    setStatus('Enter a peer ID');
    return;
  }

  setStatus('Connecting...');
  setConnection(peer.connect(otherPeerId, { reliable: true }), true);
});

peer.on('connection', (incomingConnection) => {
  setConnection(incomingConnection, false);
});

peer.on('call', (call) => {
  pendingIncomingCall = call;
  if (localStream && conn?.open && !localIsConnector) {
    answerPendingCall(call);
    pendingIncomingCall = null;
  }
});

peer.on('error', (error) => {
  console.error('Peer signaling error:', error);
  setStatus('Signaling error');
});

passTurnButton?.addEventListener('click', () => {
  if (!conn?.open) return;
  if (localIsConnector) beginTurn(drawerPeerId === peer.id ? conn.peer : peer.id);
  else conn.send({ type: 'turn-pass-request' });
});

stageViewToggle?.addEventListener('click', () => {
  if (!conn?.open) return;
  const canvasOnly = room.classList.toggle('canvas-only');
  stageViewToggle.setAttribute('aria-pressed', String(canvasOnly));
  stageViewToggle.textContent = canvasOnly ? 'Show camera' : 'Canvas only';
});

export function isLocalDrawer() {
  return conn?.open ? drawerPeerId === peer.id : true;
}

export function sendStrokeEvent(message) {
  if (!isLocalDrawer() || !conn?.open) return;
  conn.send({ ...message, messageId: ++nextMessageId });
}

export function sendGameMessage(message) {
  if (!conn?.open) return false;
  conn.send({ ...message, messageId: ++nextMessageId });
  return true;
}

export function getPeerIds() {
  return { localPeerId: peer.id, otherPeerId: conn?.peer ?? null };
}

export function requestTurnPass() {
  if (!conn?.open) return;
  if (localIsConnector) beginTurn(drawerPeerId === peer.id ? conn.peer : peer.id);
  else conn.send({ type: 'turn-pass-request' });
}