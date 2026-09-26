import './style.css';

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');

canvas.width = 640;
canvas.height = 480;
ctx.clearRect(0, 0, canvas.width, canvas.height);

let drawColor = 'black';
let drawWidth = 5;
let eraseWidth = 10;
let isErasing = false;
let isDrawing = false;

const strokes = []; // strokes drawn for all drawing sequences
const toolbar = document.querySelector('.toolbar');
let hoverTarget = null;
let hoverStartedAt = 0;
let hoverActivated = false;

const getColor = el => el.type === 'color' ? el.value : el.style.backgroundColor;

// select color depending on element type
document.querySelectorAll('.colorfield').forEach(el => {
  const event = el.type === 'color' ? 'input' : 'click';
  el.addEventListener(event, () => {
    drawColor = getColor(el);
    isErasing = false;
  })
})

const penRange = document.querySelector('#widthRange');
penRange.addEventListener('input', (e) => {
    drawWidth = Number(e.target.value);
    eraseWidth = Number(e.target.value);
})

function setBrushFromHover(range, clientX) {
  const rect = range.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const min = Number(range.min);
  const max = Number(range.max);
  const value = Math.round(min + ratio * (max - min));

  if (Number(range.value) !== value) {
    range.value = String(value);
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export function updateToolbarHover(clientX, clientY, enabled) {
  if (!toolbar || !enabled) {
    hoverTarget = null;
    hoverActivated = false;
    return false;
  }

  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest('.toolbar button, .toolbar .colorfield, .toolbar input[type="range"]');

  if (!target || !toolbar.contains(target)) {
    hoverTarget = null;
    hoverActivated = false;
    return false;
  }

  if (target !== hoverTarget) {
    hoverTarget = target;
    hoverStartedAt = performance.now();
    hoverActivated = false;
  }

  const dwellComplete = performance.now() - hoverStartedAt >= 500;
  if (dwellComplete && !hoverActivated) {
    if (target.matches('input[type="range"]')) {
      setBrushFromHover(target, clientX);
    } else {
      target.click();
    }
    hoverActivated = true;
  } else if (dwellComplete && target.matches('input[type="range"]')) {
    setBrushFromHover(target, clientX);
  }

  return true;
}

function currentStyle() {
  return isErasing
    ? { color: 'white', width: eraseWidth }
    : { color: drawColor, width: drawWidth };
}

// start drawing sequence
export function startStroke(x, y) {
  const { color, width } = currentStyle();
  const stroke = [{ color, width, x, y, erase: isErasing }];
  strokes.push(stroke);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
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


// redraw every stored stroke while preserving colors (for undo)
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
