import './style.css';
import { Peer } from 'peerjs';

const peer = new Peer();
let conn = null;
const myId = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id');
const connectButton = document.getElementById('connect-btn');
const networkStatus = document.getElementById('network-status');
let nextMessageId = 0;

function setStatus(message) {
    if (networkStatus) networkStatus.textContent = message;
}

// open happened when we have connected to signalling server (server not client) and we get our id back
peer.on("open", (id) => {
    if (myId) myId.textContent = id;
    setStatus('Ready to connect');
});

function isValidPoint(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
        point.x >= 0 && point.x <= 640 && point.y >= 0 && point.y <= 480;
}

function handleStrokeMessage(message) {
    if (!message || typeof message !== 'object' || typeof message.strokeId !== 'string') return;

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

function setConnection(connection) {
    conn = connection;

    connection.on('open', () => {
        setStatus(`Connected to ${connection.peer}`);
    });

    connection.on('data', handleStrokeMessage);

    connection.on('close', () => {
        if (conn === connection) conn = null;
        setStatus('Peer disconnected');
    });

    connection.on('error', (error) => {
        console.error('Peer connection error:', error);
        setStatus('Connection error');
    });
}

// connect button clicked => get the other peer-id and try to establish connection
connectButton?.addEventListener('click', () => {
    const otherPeerId = peerIdInput?.value.trim();
    if (!otherPeerId) {
        setStatus('Enter a peer ID');
        return;
    }

    setStatus('Connecting...');
    setConnection(peer.connect(otherPeerId, { reliable: true }));
});

// detect incoming connection
peer.on('connection', (incomingConnection) => {
    setConnection(incomingConnection);
});

peer.on('error', (error) => {
    console.error('Peer signaling error:', error);
    setStatus('Signaling error');
});

export function sendStrokeEvent(message) {
    if (!conn || !conn.open) return;
    conn.send({ ...message, messageId: ++nextMessageId });
}