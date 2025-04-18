
// Full working SharpShot game.js — final version with fixes
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const crosshair = document.getElementById('crosshair');
const sensitivitySlider = document.getElementById('sensitivity');
const outputSpan = document.getElementById('converted-sens');

let mode = '', running = false;
let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let sensitivity = 1;
let score = 0, shots = 0, hits = 0;
let reactionTimes = [], lastTargetTime = 0;
let hoverTime = 0, timer = 0, startTime = 0;
let targets = [], trackingTarget = null, gridPositions = [];

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas && running) {
    document.addEventListener('mousemove', onMouseMove);
  } else {
    document.removeEventListener('mousemove', onMouseMove);
    
    // 🧠 Fix for pause menu showing immediately when pointer lock is lost
    if (running) {
      running = false;
      document.getElementById('pause-menu').style.display = 'flex';
    }
  }
});

function onMouseMove(e) {
  pointerX = Math.max(0, Math.min(canvas.width, pointerX + e.movementX * sensitivity));
  pointerY = Math.max(0, Math.min(canvas.height, pointerY + e.movementY * sensitivity));
  
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function convertSensitivity() {
  const dpi = parseFloat(document.getElementById('dpi-input')?.value || 800);
  const sens = parseFloat(document.getElementById('in-game-sens')?.value || 0.5);
  const multiplier = parseFloat(document.getElementById('game-select')?.value || 10.6);

  const user_cm_per_360 = (2.54 * 360) / (dpi * sens * multiplier);
  const base_cm_per_360 = 34.3; // tuned for 800 DPI & 0.5 sens in Valorant
  sensitivity = base_cm_per_360 / user_cm_per_360;

  outputSpan.textContent = sensitivity.toFixed(2);
}

sensitivitySlider.addEventListener('input', () => {
  sensitivity = parseFloat(sensitivitySlider.value);
  document.getElementById('slider-value').innerText = sensitivity.toFixed(2);
});

function updateHUD() {
  document.getElementById('score').innerText = 'Score: ' + score;
  document.getElementById('timer').innerText = 'Time: ' + Math.floor(timer / 1000);
  document.getElementById('accuracy').innerText = 'Accuracy: ' + (shots ? Math.round((hits / shots) * 100) : 100) + '%';
  document.getElementById('reaction').innerText = 'Reaction: ' + (reactionTimes.length ? (reactionTimes.reduce((a,b)=>a+b)/reactionTimes.length/1000).toFixed(2) : '0.00') + 's';
}

function updateStatsPanel() {
  document.getElementById('avg-score').innerText = 'Score: ' + score;
  document.getElementById('avg-accuracy').innerText = 'Accuracy: ' + (shots ? Math.round((hits / shots) * 100) : 100) + '%';
  document.getElementById('avg-reaction').innerText = 'Reaction Time: ' + (reactionTimes.length ? (reactionTimes.reduce((a,b)=>a+b)/reactionTimes.length/1000).toFixed(2) : '0.00') + 's';
}

function startGame(selectedMode) {
  mode = selectedMode;
  score = shots = hits = timer = hoverTime = 0;
  reactionTimes = [];
  pointerX = canvas.width / 2;
  pointerY = canvas.height / 2;
  targets = [];
  trackingTarget = null;
  running = true;
  lastTargetTime = Date.now();
  startTime = Date.now();
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('pause-menu').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  canvas.requestPointerLock();
  if (mode === 'grid') initGrid();
  else generateTargets();
  requestAnimationFrame(gameLoop);
}

function resumeGame() {
  running = true;
  document.getElementById('pause-menu').style.display = 'none';
  canvas.requestPointerLock();
  requestAnimationFrame(gameLoop);
}

function endSession() {
  running = false;
  document.exitPointerLock();
  document.getElementById('pause-menu').style.display = 'none';
  document.getElementById('game').style.display = 'none';
  document.getElementById('main-menu').style.display = 'flex';
  updateStatsPanel();
}

function initGrid() {
  const spacing = 100, size = 30;
  const offsetX = (canvas.width - spacing * 3) / 2;
  const offsetY = (canvas.height - spacing * 3) / 2;
  gridPositions = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      gridPositions.push({ x: offsetX + c * spacing, y: offsetY + r * spacing, size });
    }
  }
  targets = gridPositions.sort(() => 0.5 - Math.random()).slice(0, 3).map(p => ({ ...p, ttl: 2000 }));
}

function generateTargets() {
  const w = canvas.width, h = canvas.height;
  if (mode === 'flick') {
    targets = Array.from({ length: 3 }, () => ({ x: Math.random() * w, y: Math.random() * h, size: 30, ttl: 2000 }));
  } else if (mode === 'tracking') {
    trackingTarget = { x: w / 2, y: h / 2, dx: (Math.random() * 2 - 1) * 2, dy: (Math.random() * 2 - 1) * 2, size: 30 };
  } else if (mode === 'challenge') {
    targets = [{ x: Math.random() * w, y: Math.random() * h, size: 30, ttl: 1500 }];
  } else if (mode === 'competitive') {
    targets = [{ x: Math.random() * w, y: Math.random() * h, size: 30 }];
  }
}

function gameLoop() {
  if (!running) return;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGridBackground();
  timer = Date.now() - startTime;

  if (mode === 'tracking') {
    const t = trackingTarget;
    const now = Date.now();
    // Add erratic behavior
    if (!t.lastChange || now - t.lastChange > 500) {
      t.dx = (Math.random() * 2 - 1) * 4;
      t.dy = (Math.random() * 2 - 1) * 4;
      t.lastChange = now;
    }

    t.x += t.dx; t.y += t.dy;
    if (t.x < 0 || t.x > canvas.width) t.dx *= -1;
    if (t.y < 0 || t.y > canvas.height) t.dy *= -1;
    const dist = Math.hypot(t.x - pointerX, t.y - pointerY);
    if (dist <= t.size) hoverTime += 16;
    shots++;
    hits++;
    const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.size);
      gradient.addColorStop(0, '#ff4d4d');
      gradient.addColorStop(1, '#660000');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
  } else {
    if (mode === 'flick' || mode === 'challenge' || mode === 'grid') {
      let expiredIndexes = [];
targets.forEach((t, i) => {
  t.ttl -= 16;
  if (t.ttl <= 0) {
    shots++;
    expiredIndexes.push(i);
  }
});
expiredIndexes.reverse().forEach(i => {
  const expired = targets.splice(i, 1)[0];
  let available = gridPositions.filter(p => !targets.find(t => t.x === p.x && t.y === p.y));
  const newTarget = available[Math.floor(Math.random() * available.length)];
  if (newTarget) targets.push({ ...newTarget, ttl: 2000 });
});
    }
    for (let t of targets) {
      const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.size);
      gradient.addColorStop(0, '#ff4d4d');
      gradient.addColorStop(1, '#660000');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (targets.length === 0 && mode !== 'competitive') {
      if (mode === 'grid') {
        let available = gridPositions.filter(p => !targets.find(t => t.x === p.x && t.y === p.y));
        targets.push(...available.sort(() => 0.5 - Math.random()).slice(0, 3).map(p => ({ ...p, ttl: 2000 })));
      } else generateTargets();
      lastTargetTime = Date.now();
    }
  }

  
  // Draw crosshair using canvas
  ctx.beginPath();
  ctx.moveTo(pointerX - 10, pointerY);
  ctx.lineTo(pointerX + 10, pointerY);
  ctx.moveTo(pointerX, pointerY - 10);
  ctx.lineTo(pointerX, pointerY + 10);
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  ctx.stroke();

  updateHUD();
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousedown', () => {
  if (!running || mode === 'tracking') return;
  const now = Date.now();
  const px = pointerX, py = pointerY;

  let hit = false;
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const radius = t.size * 1.35; // ⬅️ Slightly more forgiving
    const dx = px - t.x;
    const dy = py - t.y;

    if ((dx * dx + dy * dy) <= (radius * radius)) {
      targets.splice(i, 1);
      hit = true;
      hits++; score += 100;
      reactionTimes.push(now - lastTargetTime);
      lastTargetTime = now;
      break;
    }
  }

  shots++;

  if (hit && mode === 'grid') {
    const available = gridPositions.filter(p => !targets.find(t => t.x === p.x && t.y === p.y));
    const newTarget = available[Math.floor(Math.random() * available.length)];
    if (newTarget) targets.push({ ...newTarget, ttl: 2000 });
  } else if (hit && mode === 'competitive') {
    if (timer >= 60000) endSession();
    else generateTargets();
  } else if (hit && mode === 'challenge') {
    targets.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.max(10, 30 - Math.floor(timer / 10000) * 5),
      ttl: Math.max(400, 1500 - Math.floor(timer / 5000) * 200)
    });
  }
});




window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && running) {
    running = false;
    document.getElementById('pause-menu').style.display = 'flex';
    document.exitPointerLock();
  }
});


  function drawGridBackground() {
    const spacing = 50;
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }
