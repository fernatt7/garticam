import './style.css';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { canvas, endStroke, moveStroke, startStroke } from './draw';

const video = document.querySelector('#webcam');
const landmarkCanvas = document.querySelector('#landmarks');
const landmarkContext = landmarkCanvas?.getContext('2d');
const MAX_LOST = 3;
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
let smoothX = null;
let smoothY = null;
let lostFrames = 0;

function handleFingerDrawing(results) {

  // no hand
  if (!results || !results.landmarks || results.landmarks.length === 0) {
    if (lostFrames >= MAX_LOST) {
      if (isDrawing) {
        isDrawing = false;
        endStroke();
      }
    }

    smoothX = null;
    smoothY = null;

    return;
  }
  lostFrames = 0;

  const width = video.videoWidth || canvas.width;
  const height = video.videoHeight || canvas.height;

  const hand = results.landmarks[0];

  const wrist = hand[0];
  const indexTip = hand[8];

  // ensure landmarks exist
  if (!indexTip || !wrist) {
    if (isDrawing) {
      endStroke();
      isDrawing = false;
    }

    smoothX = null;
    smoothY = null;

    return;
  }

  const distanceFromWrist = Math.hypot(
    indexTip.x - wrist.x,
    indexTip.y - wrist.y
  );

  // if index pointer is close to wrist, treat as closed fist and stop drawing
  if (distanceFromWrist < 0.15) {
    if (isDrawing) {
      endStroke();
      isDrawing = false;
    }

    smoothX = null;
    smoothY = null;

    return;
  }

  const x = width - (indexTip.x * width);
  const y = indexTip.y * height;

  // Smoothing
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
    if (isDrawing) {
      endStroke();
      isDrawing = false;
    }

    smoothX = null;
    smoothY = null;

    return;
  }

  if (!isDrawing) {
    startStroke(smoothX, smoothY);
    isDrawing = true;
    return;
  }

  moveStroke(smoothX, smoothY);
}

function drawLandmarks(results) {
  if (!landmarkContext || !landmarkCanvas || !video) {
    return;
  }

  landmarkContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);

  if (!results || !results.landmarks || results.landmarks.length === 0) {
    return;
  }

  const width = video.videoWidth || landmarkCanvas.width;
  const height = video.videoHeight || landmarkCanvas.height;

  landmarkCanvas.width = width;
  landmarkCanvas.height = height;

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
    numHands: 2
  });
}

function predictWebcam() {
  if (!video || !handLandmarker) {
    return;
  }

  const startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(video, startTimeMs);

  drawLandmarks(results);
  handleFingerDrawing(results);

  requestAnimationFrame(predictWebcam);
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


