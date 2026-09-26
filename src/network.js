import './style.css';
import { Peer } from 'peerjs';

const peer = new Peer();
const myId = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id');
const connectButton = document.getElementById('connect-btn');
const passTurnButton = document.getElementById('pass-turn-btn');
const networkStatus = document.getElementById('network-status');
const roleStatus = document.getElementById('role-status');
const remoteVideo = document.getElementById('remote-webcam');

let conn = null;
let localStream = null;
let mediaCall = null;
let localIsConnector = false;
let drawerPeerId = null;
let turnNumber = 0;
let nextMessageId = 0;

function setStatus(message) {
  if (networkStatus) networkStatus.textContent = message;
}

function updateRoleUI() {
  const connected = Boolean(conn?.open && drawerPeerId);
  const isDrawer = connected && drawerPeerId === peer.id;

  if (roleStatus) {
    roleStatus.textContent = !connected ? 'Waiting for peer' : isDrawer ? 'Your turn: Drawer' : 'Your turn: Guesser';
  }
  if (passTurnButton) {
    passTurnButton.disabled = !connected;
    passTurnButton.textContent = isDrawer ? 'Pass turn' : 'Become drawer';
  }

  window.dispatchEvent(new CustomEvent('garticam:role-changed', { detail: { isDrawer } }));
}

function setDrawerPeer(id, newTurnNumber = turnNumber) {
  if (id !== peer.id && id !== conn?.peer) return;
  if (newTurnNumber < turnNumber) return;

  turnNumber = newTurnNumber;
  drawerPeerId = id;
  updateRoleUI();
}

function setRemoteStream(stream) {
  if (!remoteVideo) return;
  remoteVideo.srcObject = stream;
  remoteVideo.play().catch((error) => console.warn('Remote video playback was blocked:', error));
}

function answerPendingCall(call) {
  if (!localStream || !call) return;
  mediaCall = call;
  call.answer(localStream);
  call.on('stream', setRemoteStream);
  call.on('close', () => {
    if (mediaCall === call) mediaCall = null;
    if (remoteVideo) remoteVideo.srcObject = null;
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
    if (remoteVideo) remoteVideo.srcObject = null;
    mediaCall = null;
  });
  mediaCall.on('error', (error) => {
    console.error('Peer media error:', error);
    setStatus('Camera connection error');
  });
}

export function setLocalStream(stream) {
  localStream = stream;
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
      setDrawerPeer(message.drawerPeerId, message.turnNumber);
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
      setDrawerPeer(peer.id, 1);
      connection.send({ type: 'room-state', drawerPeerId: peer.id, turnNumber: 1 });
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
    localIsConnector = false;
    if (mediaCall) {
      mediaCall.close();
      mediaCall = null;
    }
    if (remoteVideo) remoteVideo.srcObject = null;
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
  const nextDrawerId = drawerPeerId === peer.id ? conn.peer : peer.id;
  const nextTurnNumber = turnNumber + 1;
  setDrawerPeer(nextDrawerId, nextTurnNumber);
  conn.send({ type: 'turn-change', drawerPeerId: nextDrawerId, turnNumber: nextTurnNumber });
});

export function isLocalDrawer() {
  return !conn?.open || drawerPeerId === peer.id;
}

export function sendStrokeEvent(message) {
  if (!isLocalDrawer() || !conn?.open) return;
  conn.send({ ...message, messageId: ++nextMessageId });
}