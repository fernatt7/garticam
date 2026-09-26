import './style.css';
import { sendStrokeEvent } from './network.js';

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
const remoteStrokes = [];
const activeRemoteStrokes = new Map();
let nextStrokeId = 0;
const toolbar = document.querySelector('.toolbar');
let hoverTarget = null;
let hoverStartedAt = 0;
let hoverActivated = false;
let nextUndoAt = 0;

const toolColorSwatch = document.querySelector('#tool-color');
const toolColorName = document.querySelector('#tool-color-name');
const toolWidthLabel = document.querySelector('#tool-width');

function updateToolReadout() {
  const color = isErasing ? '#ffffff' : drawColor;
  toolColorSwatch.style.backgroundColor = color;
  toolColorName.textContent = `Color: ${isErasing ? 'eraser' : drawColor}`;
  toolWidthLabel.textContent = `Width: ${isErasing ? eraseWidth : drawWidth} px`;
}

updateToolReadout();

const getColor = el => el.type === 'color' ? el.value : el.style.backgroundColor;

// select color depending on element type
document.querySelectorAll('.colorfield').forEach(el => {
  const event = el.type === 'color' ? 'input' : 'click';
  el.addEventListener(event, () => {
    drawColor = getColor(el);
    isErasing = false;
    updateToolReadout();
  });
})

const penRange = document.querySelector('#widthRange');
penRange.addEventListener('input', (e) => {
    drawWidth = Number(e.target.value);
    eraseWidth = Number(e.target.value);
    updateToolReadout();
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
    hoverTarget?.classList.remove('gaze-hover');
    hoverTarget = null;
    hoverActivated = false;
    nextUndoAt = 0;
    return false;
  }

  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest('.toolbar button, .toolbar .colorfield, .toolbar input[type="range"]');

  if (!target || !toolbar.contains(target)) {
    hoverTarget?.classList.remove('gaze-hover');
    hoverTarget = null;
    hoverActivated = false;
    nextUndoAt = 0;
    return false;
  }

  if (target !== hoverTarget) {
    hoverTarget?.classList.remove('gaze-hover');
    hoverTarget = target;
    hoverTarget.classList.add('gaze-hover');
    hoverStartedAt = performance.now();
    hoverActivated = false;
    nextUndoAt = 0;
  }

  const now = performance.now();
  const dwellComplete = now - hoverStartedAt >= 500;
  if (dwellComplete && !hoverActivated) {
    if (target.matches('input[type="range"]')) {
      setBrushFromHover(target, clientX);
    } else {
      target.click();
    }
    hoverActivated = true;
    if (target.id === 'undo') nextUndoAt = now + 500;
  } else if (dwellComplete && target.matches('input[type="range"]')) {
    setBrushFromHover(target, clientX);
  }

  if (target.id === 'undo' && hoverActivated && now >= nextUndoAt) {
    undoStroke();
    nextUndoAt = now + 500;
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
  const strokeId = `${Date.now()}-${++nextStrokeId}`;
  const firstPoint = { color, width, x, y, erase: isErasing };
  const stroke = [firstPoint];
  stroke.id = strokeId;
  strokes.push(stroke);

  drawDot(firstPoint);
  sendStrokeEvent({
    type: 'stroke-start',
    strokeId,
    point: { x, y },
    color,
    width,
    erase: isErasing
  });
  isDrawing = true;
}

// drawing sequence
export function moveStroke(x, y) {
  if (!isDrawing) return;

  const { color, width } = currentStyle();
  const stroke = strokes[strokes.length - 1];
  const previous = stroke[stroke.length - 1];
  const point = { color, width, x, y, erase: isErasing };
  stroke.push(point);
  drawSegment(previous, point);
  sendStrokeEvent({ type: 'stroke-point', strokeId: stroke.id, point: { x, y } });
}

// stop drawing
export function endStroke() {
  const stroke = strokes[strokes.length - 1];
  if (isDrawing && stroke?.id) {
    sendStrokeEvent({ type: 'stroke-end', strokeId: stroke.id });
  }
  isDrawing = false;
  ctx.globalCompositeOperation = 'source-over';
}

function drawDot(point) {
  ctx.save();
  ctx.globalCompositeOperation = point.erase ? 'destination-out' : 'source-over';
  ctx.fillStyle = point.color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, point.width / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSegment(previous, point) {
  ctx.save();
  ctx.globalCompositeOperation = point.erase ? 'destination-out' : 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = point.width;
  ctx.strokeStyle = point.color;
  ctx.beginPath();
  ctx.moveTo(previous.x, previous.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
}

function handleRemoteStroke(event) {
  const message = event.detail;

  if (message.type === 'stroke-start') {
    const stroke = {
      id: message.strokeId,
      color: message.color,
      width: message.width,
      erase: Boolean(message.erase),
      points: [{ ...message.point }]
    };
    remoteStrokes.push(stroke);
    activeRemoteStrokes.set(stroke.id, stroke);
    drawDot({ ...message.point, color: stroke.color, width: stroke.width, erase: stroke.erase });
    return;
  }

  const stroke = activeRemoteStrokes.get(message.strokeId);
  if (!stroke) return;

  if (message.type === 'stroke-point') {
    const point = { ...message.point };
    const previous = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    drawSegment(
      { ...previous, color: stroke.color, width: stroke.width, erase: stroke.erase },
      { ...point, color: stroke.color, width: stroke.width, erase: stroke.erase }
    );
  } else if (message.type === 'stroke-end') {
    activeRemoteStrokes.delete(message.strokeId);
  }
}

window.addEventListener('garticam:remote-stroke', handleRemoteStroke);


// redraw every stored stroke while preserving colors (for undo)
function redrawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawStoredStroke = (stroke) => {
    const points = stroke.points || stroke;
    points.forEach((point, index) => {
      const styledPoint = {
        ...point,
        color: stroke.color || point.color,
        width: stroke.width || point.width,
        erase: stroke.points ? stroke.erase : point.erase
      };
      if (index === 0) drawDot(styledPoint);
      else {
        const previous = points[index - 1];
        drawSegment(
          { ...previous, color: styledPoint.color, width: styledPoint.width, erase: styledPoint.erase },
          styledPoint
        );
      }
    });
  };

  strokes.forEach(drawStoredStroke);
  remoteStrokes.forEach(drawStoredStroke);
  ctx.globalCompositeOperation = 'source-over';
}

const clear = document.querySelector('#clear');
clear.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.length = 0;
});

const undo = document.querySelector('#undo');
function undoStroke() {
  strokes.pop();
  redrawAll();
}
undo.addEventListener('click', undoStroke);

const eraser = document.querySelector('#eraser');
eraser.addEventListener('click', () => {
  isErasing = !isErasing;
  eraser.textContent = isErasing ? 'Eraser On' : 'Eraser';
  updateToolReadout();
});

export { canvas, ctx };
