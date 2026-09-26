import './style.css';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { canvas, endStroke, moveStroke, startStroke, updateToolbarHover } from './draw.js';

const video = document.querySelector('#webcam');
const videoWrap = document.querySelector('.video-wrap');
const landmarkCanvas = document.querySelector('#landmarks');
const landmarkContext = landmarkCanvas?.getContext('2d');
const pointerEffects = document.querySelector('#pointer-effects');
const fingerGlow = pointerEffects?.querySelector('.finger-glow');
const trailDots = pointerEffects ? [...pointerEffects.querySelectorAll('.trail-dot')] : [];
const modeStatus = document.querySelector('#mode-status');
const MAX_LOST = 5;
const handConnections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

let handLandmarker = undefined;
let isDrawing = false;
let drawingPaused = false;
let phonePaused = false;
let pinchActive = false;
let smoothX = null;
let smoothY = null;
let lostFrames = 0;
let drawingReadyAt = null;
let phoneGestureFrames = 0;
let phoneGestureReleaseFrames = 0;
let phoneGestureLatched = false;
let lastVideoTime = -1;
let lastTrailPoint = null;
let lastTrailTime = 0;

function stopCurrentStroke() {
  if (!isDrawing) return;
  endStroke();
  isDrawing = false;
}

function updateFingerIndicator(x, y, visible) {
  if (!pointerEffects || !videoWrap || !fingerGlow) return;

  if (!visible) {
    pointerEffects.classList.remove('visible');
    trailDots.forEach(dot => { dot.style.opacity = '0'; });
    lastTrailPoint = null;
    return;
  }

  const bounds = videoWrap.getBoundingClientRect();
  const screenX = (x / canvas.width) * bounds.width;
  const screenY = (y / canvas.height) * bounds.height;
  pointerEffects.classList.add('visible');
  fingerGlow.style.left = `${screenX}px`;
  fingerGlow.style.top = `${screenY}px`;

  const now = performance.now();
  if (!lastTrailPoint || Math.hypot(screenX - lastTrailPoint.x, screenY - lastTrailPoint.y) > 5 || now - lastTrailTime > 70) {
    for (let i = trailDots.length - 1; i > 0; i--) {
      trailDots[i].style.left = trailDots[i - 1].style.left;
      trailDots[i].style.top = trailDots[i - 1].style.top;
      trailDots[i].style.opacity = String((trailDots.length - i) / (trailDots.length + 1) * 0.55);
    }
    trailDots[0].style.left = `${screenX}px`;
    trailDots[0].style.top = `${screenY}px`;
    trailDots[0].style.opacity = '0.48';
    lastTrailPoint = { x: screenX, y: screenY };
    lastTrailTime = now;
  }
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isPhoneGesture(hand) {
  const wrist = hand[0];
  const thumbExtended = distanceBetween(wrist, hand[4]) > distanceBetween(wrist, hand[2]) * 1.12;
  const pinkyExtended = distanceBetween(wrist, hand[20]) > distanceBetween(wrist, hand[18]) * 1.15;
  const indexCurled = distanceBetween(wrist, hand[8]) < distanceBetween(wrist, hand[6]) * 1.12;
  const middleCurled = distanceBetween(wrist, hand[12]) < distanceBetween(wrist, hand[10]) * 1.12;
  const ringCurled = distanceBetween(wrist, hand[16]) < distanceBetween(wrist, hand[14]) * 1.12;

  return thumbExtended && pinkyExtended && indexCurled && middleCurled && ringCurled;
}

function setDrawingPaused(paused) {
  if (drawingPaused === paused) return;
  drawingPaused = paused;
  modeStatus.textContent = paused ? (pinchActive ? 'PINCH TO PAUSE' : 'DRAWING PAUSED') : 'DRAWING ON';
  stopCurrentStroke();
  drawingReadyAt = null;
}

function handleFingerDrawing(results) {
  // missing hands end a stroke after a few frames
  if (!results || !results.landmarks || results.landmarks.length === 0) {
    lostFrames++;
    drawingReadyAt = null;
    updateToolbarHover(0, 0, false);
    updateFingerIndicator(0, 0, false);

    if (lostFrames >= MAX_LOST) {
      stopCurrentStroke();
    }
    smoothX = null;
    smoothY = null;
    return;
  }

  lostFrames = 0;
  const hand = results.landmarks[0];
  const wrist = hand[0];
  const indexTip = hand[8];

  if (!indexTip || !wrist) {
    stopCurrentStroke();
    drawingReadyAt = null;
    updateToolbarHover(0, 0, false);
    updateFingerIndicator(0, 0, false);
    smoothX = null;
    smoothY = null;
    return;
  }

  const phoneSign = isPhoneGesture(hand);
  if (phoneSign) {
    phoneGestureFrames++;
    phoneGestureReleaseFrames = 0;
  } else {
    phoneGestureFrames = 0;
    phoneGestureReleaseFrames++;
    if (phoneGestureReleaseFrames >= 8) phoneGestureLatched = false;
  }

  if (phoneGestureFrames >= 6 && !phoneGestureLatched) {
    phoneGestureLatched = true;
    phonePaused = !phonePaused;
    setDrawingPaused(phonePaused || pinchActive);
  }

  if (phoneSign) {
    stopCurrentStroke();
    drawingReadyAt = null;
    updateToolbarHover(0, 0, false);
    updateFingerIndicator(0, 0, false);
    return;
  }

  const x = (1 - indexTip.x) * canvas.width;
  const y = indexTip.y * canvas.height;
  const thumbTip = hand[4];
  const indexBase = hand[5];
  const pinkyBase = hand[17];
  const palmWidth = distanceBetween(indexBase, pinkyBase);
  const pinchDistance = thumbTip ? distanceBetween(indexTip, thumbTip) : Infinity;
  pinchActive = palmWidth > 0 && pinchDistance < palmWidth * 0.22;
  const indexIsExtended = distanceBetween(indexTip, wrist) >= 0.25;

  if (pinchActive) {
    setDrawingPaused(true);
    updateToolbarHover(0, 0, false);
    updateFingerIndicator(0, 0, false);
    smoothX = null;
    smoothY = null;
    return;
  }

  setDrawingPaused(phonePaused);

  const bounds = videoWrap.getBoundingClientRect();
  const clientX = bounds.left + (x / canvas.width) * bounds.width;
  const clientY = bounds.top + (y / canvas.height) * bounds.height;
  const hoveringToolbar = updateToolbarHover(clientX, clientY, indexIsExtended);

  if (hoveringToolbar || drawingPaused) {
    stopCurrentStroke();
    drawingReadyAt = null;
    updateFingerIndicator(0, 0, false);
    smoothX = null;
    smoothY = null;
    return;
  }

  // delay after the pointing pose begins so pulling the finger out is not recorded.
  if (!indexIsExtended) {
    stopCurrentStroke();
    drawingReadyAt = null;
    updateFingerIndicator(0, 0, false);
    smoothX = null;
    smoothY = null;
    return;
  }

  if (drawingReadyAt === null) {
    drawingReadyAt = performance.now();
    return;
  }
  if (performance.now() - drawingReadyAt < 80) return;

  // smoothing
  if (smoothX === null) {
    smoothX = x;
    smoothY = y;
  } else {
    smoothX = smoothX * 0.6 + x * 0.4;
    smoothY = smoothY * 0.6 + y * 0.4;
  }

  const insideCanvas =
    smoothX >= 0 &&
    smoothX <= canvas.width &&
    smoothY >= 0 &&
    smoothY <= canvas.height;

  if (!insideCanvas) {
    stopCurrentStroke();
    smoothX = null;
    smoothY = null;
    return;
  }

  if (!isDrawing) {
    startStroke(smoothX, smoothY);
    isDrawing = true;
    updateFingerIndicator(smoothX, smoothY, true);
    return;
  }

  moveStroke(smoothX, smoothY);
  updateFingerIndicator(smoothX, smoothY, true);
}

// show tracked points on hand (skeleton), not needed for final version
function drawLandmarks(results) {
  if (!landmarkContext || !landmarkCanvas || !video) {
    return;
  }

  landmarkContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);

  if (!results || !results.landmarks || results.landmarks.length === 0) {
    return;
  }

  const width = landmarkCanvas.width;
  const height = landmarkCanvas.height;

  landmarkContext.strokeStyle = '#22c55e';
  landmarkContext.fillStyle = '#22c55e';
  landmarkContext.lineWidth = 2;

  results.landmarks.forEach((landmarks) => {
    handConnections.forEach(([start, end]) => {
      const p1 = landmarks[start];
      const p2 = landmarks[end];

      if (!p1 || !p2) return;

      landmarkContext.beginPath();
      landmarkContext.moveTo(width - p1.x * width, p1.y * height);
      landmarkContext.lineTo(width - p2.x * width, p2.y * height);
      landmarkContext.stroke();
    });

    landmarks.forEach((point) => {
      landmarkContext.beginPath();
      landmarkContext.arc(width - point.x * width, point.y * height, 3, 0, Math.PI * 2);
      landmarkContext.fill();
    });
  });
}

async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 1
  });
}

function predictWebcam() {
  if (!video || !handLandmarker) {
    return;
  }

  requestAnimationFrame(predictWebcam);
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  const startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(video, startTimeMs);

  handleFingerDrawing(results);
}

export async function startCamera() {
  if (!video) {
    console.log('Webcam element not found');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    await createHandLandmarker();
    predictWebcam();
  } catch (err) {
    if (err.name === 'NotFoundError') {
      console.log('No webcam found');
    } else if (err.name === 'NotAllowedError') {
      console.log('Permission denied');
    } else if (err.name === 'NotReadableError') {
      console.log('Device in use');
    } else if (err.name === 'OverconstrainedError') {
      console.log('Constraints not met');
    } else if (err.name === 'TypeError') {
      console.log('Invalid constraints');
    } else {
      console.log('Camera setup failed:', err);
    }
  }
}


