import './style.css';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { canvas, endStroke, moveStroke, startStroke } from './draw';

const video = document.querySelector('#webcam');
const landmarkCanvas = document.querySelector('#landmarks');
const landmarkContext = landmarkCanvas?.getContext('2d');
let handLandmarker = undefined;
let isDrawing = false;

const handConnections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

function handleFingerDrawing(results) {
  if (!results || !results.landmarks || results.landmarks.length === 0) {
    if (isDrawing) {
      endStroke();
      isDrawing = false;
    }
    return;
  }

  const hand = results.landmarks[0];
  const wrist = hand[0]
  const indexTip = hand[8];

  if (!indexTip || !wrist) {
    if (isDrawing) {
      endStroke();
      isDrawing = false;
    }
    return;
  }

  const distanceFromWrist = Math.hypot(indexTip.x -wrist.x, indexTip.y - wrist.y);

  // if index fingertip is very close to wrist, treat it as a closed fist and stop drawing.
  if (distanceFromWrist < 0.18) {
    if (isDrawing) {
      endStroke();
      isDrawing = false;
    }
    return;
  }

  const width = video.videoWidth || canvas.width;
  const height = video.videoHeight || canvas.height;
  const x = width - (indexTip.x * width);
  const y = indexTip.y * height;

  const insideCanvas = x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height;

  if (!insideCanvas) {
    if (isDrawing) {
      endStroke();
      isDrawing = false;
    }
    return;
  }

  if (!isDrawing) {
    startStroke(x, y);
    isDrawing = true;
    return;
  }

  moveStroke(x, y);
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


