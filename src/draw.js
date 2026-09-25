import './style.css';

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');

canvas.width = 640;
canvas.height = 480;
ctx.clearRect(0, 0, canvas.width, canvas.height);

let drawColor = 'black';
let drawWidth = 2;
let eraseWidth = 6;
let isErasing = false;
let isDrawing = false;

// strokes drawn for all drawing sequences
const strokes = [];

const colors = document.querySelectorAll('.colorfield');

colors.forEach(color => {
  color.addEventListener('click', function() {
    changeColor(this);
  });
});

function changeColor(element) {
  drawColor = element.style.backgroundColor;
  isErasing = false;
}

function currentStyle() {
  return isErasing
    ? { color: 'white', width: eraseWidth }
    : { color: drawColor, width: drawWidth };
}

function getMousePosition(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

// start drawing sequence
export function startStroke(x, y) {
  const { color, width } = currentStyle();
  const stroke = [{ color, width, x, y, erase: isErasing }];
  strokes.push(stroke);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
  isDrawing = true;
}

// drawing sequence
export function moveStroke(x, y) {
  if (!isDrawing) return;

  const { color, width } = currentStyle();
  const stroke = strokes[strokes.length - 1];
  stroke.push({ color, width, x, y, erase: isErasing });

  ctx.lineTo(x, y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
  ctx.stroke();
}

// stop drawing
export function endStroke() {
  isDrawing = false;
  ctx.globalCompositeOperation = 'source-over';
}

canvas.addEventListener('mousedown', (e) => {
  const { x, y } = getMousePosition(e);
  startStroke(x, y);
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;

  const { x, y } = getMousePosition(e);
  moveStroke(x, y);
});

canvas.addEventListener('mouseup', endStroke);
canvas.addEventListener('mouseout', endStroke);

// redraw every stored stroke from scratch while preserving colors (for undo)
function redrawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  strokes.forEach(stroke => {
    const first = stroke[0];
    const eraseMode = first.erase;

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.globalCompositeOperation = eraseMode ? 'destination-out' : 'source-over';
    ctx.strokeStyle = first.color;
    ctx.lineWidth = first.width;

    for (let i = 1; i < stroke.length; i++) {
      const point = stroke[i];
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = point.color;
      ctx.lineWidth = point.width;
      ctx.globalCompositeOperation = point.erase ? 'destination-out' : 'source-over';
    }

    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  });
}

const clear = document.querySelector('#clear');
clear.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.length = 0;
});

const undo = document.querySelector('#undo');
undo.addEventListener('click', () => {
  strokes.pop();
  redrawAll();
});

const eraser = document.querySelector('#eraser');
eraser.addEventListener('click', () => {
  isErasing = !isErasing;
  eraser.textContent = isErasing ? 'Eraser On' : 'Eraser';
});

export { canvas, ctx };
