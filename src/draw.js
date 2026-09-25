import './style.css'

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext("2d");

ctx.fillStyle = "white";
ctx.fillRect(0, 0, canvas.width, canvas.height);

let drawColor = "black";
let drawWidth = 2;
let eraseWidth = 6;
let isErasing = false;
let isDrawing = false;

// strokes drawn for all drawing sequences
const strokes = [];

const colors = document.querySelectorAll(".colorfield");

colors.forEach(color => {
    color.addEventListener("click", function() {
        changeColor(this);
    });
});

function changeColor(element) {
    drawColor = element.style.backgroundColor;
    isErasing = false;
}

// convert mouse position into canvas coordinates
function getMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

// what color/width should this point use
function currentStyle() {
    return isErasing
        ? { color: "white", width: eraseWidth }
        : { color: drawColor, width: drawWidth };
}

// mouse clicked, start drawing sequence
canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getMousePosition(e);
    const { color, width } = currentStyle();

    const stroke = [];
    stroke.push({ color, width, x, y });
    strokes.push(stroke);

    ctx.beginPath();
    ctx.moveTo(x, y);

    isDrawing = true;
});

// drawing sequence
canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;

    const { x, y } = getMousePosition(e);
    const { color, width } = currentStyle();

    const stroke = strokes[strokes.length - 1];
    stroke.push({ color, width, x, y });

    ctx.lineTo(x, y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
});

// stop drawing
function stop() {
    isDrawing = false;
}

canvas.addEventListener('mouseup', stop);
canvas.addEventListener('mouseout', stop);

// redraw every stored stroke from scratch while preserving colors (for undo)
function redrawAll() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(stroke => {
        for (let i = 1; i < stroke.length; i++) {
            const prev = stroke[i - 1];
            const point = stroke[i];

            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(point.x, point.y);
            ctx.strokeStyle = point.color;
            ctx.lineWidth = point.width;
            ctx.stroke();
        }
    });
}

// clear
const clear = document.querySelector('#clear');

clear.addEventListener('click', () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokes.length = 0;
});

// undo
const undo = document.querySelector('#undo');

undo.addEventListener("click", () => {
    strokes.pop();
    redrawAll();
});

// eraser
const eraser = document.querySelector('#eraser');

eraser.addEventListener('click', () => {
    isErasing = true;
});
