(() => {
"use strict";

// ---------- Utilidades ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const TAU = Math.PI * 2;

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---------- Paleta ----------
const COL = {
  bg0: "#03050c",
  bg1: "#050a16",
  player: "#8ff5e0",
  playerCore: "#e8fffa",
  moteSmall: "#6fe8ff",
  moteBig: "#c9a8ff",
  shadow: "#7a3fe0",
  shadowCore: "#1a0630",
  warn: "#ff6a5e",
  gold: "#ffd27a",
};

// ---------- Entrada ----------
const input = {
  px: window.innerWidth / 2,
  py: window.innerHeight / 2,
  hasPointer: false,
  keys: new Set(),
};
window.addEventListener("pointermove", (e) => {
  input.px = e.clientX;
  input.py = e.clientY;
  input.hasPointer = true;
});
window.addEventListener("pointerdown", (e) => {
  input.px = e.clientX;
  input.py = e.clientY;
  input.hasPointer = true;
  onPrimaryAction();
});
window.addEventListener("keydown", (e) => {
  input.keys.add(e.code);
  if (e.code === "Space" || e.code === "Enter") onPrimaryAction();
});
window.addEventListener("keyup", (e) => input.keys.delete(e.code));

function keyboardDir() {
  let dx = 0, dy = 0;
  if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) dy -= 1;
  if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) dy += 1;
  if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) dx -= 1;
  if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const m = Math.hypot(dx, dy);
    return { x: dx / m, y: dy / m };
  }
  return null;
}

// ---------- Cámara ----------
const camera = {
  shakeMag: 0,
  x: 0, y: 0,
  driftT: 0,
  update(dt) {
    this.driftT += dt;
    this.shakeMag *= Math.pow(0.001, dt);
    if (this.shakeMag < 0.01) this.shakeMag = 0;
    const ang = this.driftT * 0.6;
    this.x = Math.sin(ang) * 3 + (Math.random() - 0.5) * this.shakeMag;
    this.y = Math.cos(ang * 0.8) * 3 + (Math.random() - 0.5) * this.shakeMag;
  },
  kick(mag) {
    this.shakeMag = Math.max(this.shakeMag, mag);
  },
};

// ---------- Fondo: polvo abisal en capas ----------
class DustLayer {
  constructor(count, depth) {
    this.depth = depth;
    this.items = Array.from({ length: count }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      r: rand(0.6, 1.8) * depth,
      a: rand(0.05, 0.22) * depth,
      p: rand(0, TAU),
    }));
  }
  update(dt, t) {
    for (const it of this.items) {
      it.y += dt * 6 * this.depth;
      it.x += Math.sin(t * 0.15 + it.p) * dt * 4 * this.depth;
      if (it.y > H + 5) { it.y = -5; it.x = rand(0, W); }
    }
  }
  draw(lightGlow) {
    ctx.save();
    for (const it of this.items) {
      ctx.globalAlpha = it.a * (0.5 + lightGlow * 0.5);
      ctx.fillStyle = "#bfe9ff";
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
const dustLayers = [new DustLayer(40, 0.4), new DustLayer(26, 0.8), new DustLayer(14, 1.3)];

// ---------- Partículas ----------
class Particles {
  constructor() { this.list = []; }
  spawn(p) { this.list.push(p); }
  ring(x, y, color, r0 = 8, r1 = 70, life = 0.5) {
    this.list.push({ type: "ring", x, y, r: r0, r1, t: 0, life, color });
  }
  burst(x, y, color, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.4, speed);
      this.list.push({
        type: "dot", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: rand(1.2, 3.2), t: 0, life: life * rand(0.6, 1.3), color, drag: 0.94,
      });
    }
  }
  ash(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(30, 140);
      this.list.push({
        type: "ash", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        r: rand(1, 3), t: 0, life: rand(0.5, 1.1), drag: 0.9,
      });
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.t += dt;
      if (p.type === "dot" || p.type === "ash") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag; p.vy *= p.drag;
        if (p.type === "ash") p.vy += 60 * dt;
      }
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }
  draw() {
    ctx.save();
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      if (p.type === "ring") {
        const r = lerp(p.r, p.r1, p.t / p.life);
        ctx.globalAlpha = k * 0.6;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
      } else if (p.type === "dot") {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * k, 0, TAU);
        ctx.fill();
      } else if (p.type === "ash") {
        ctx.globalAlpha = k * 0.8;
        ctx.fillStyle = "#140018";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
const particles = new Particles();

// ---------- Jugador ----------
const player = {
  x: 0, y: 0, vx: 0, vy: 0,
  angle: 0, stretch: 1,
  trail: [],
  invuln: 0,
  hitFlash: 0,
  popScale: 0,
  reset() {
    this.x = W / 2; this.y = H / 2; this.vx = 0; this.vy = 0;
    this.trail = []; this.invuln = 0; this.hitFlash = 0; this.popScale = 0;
  },
  update(dt) {
    const kdir = keyboardDir();
    let tx, ty;
    if (kdir) { tx = this.x + kdir.x * 300; ty = this.y + kdir.y * 300; }
    else { tx = input.px; ty = input.py; }

    const k = 34, damp = 8.2;
    const ax = (tx - this.x) * k - this.vx * damp;
    const ay = (ty - this.y) * k - this.vy * damp;
    this.vx += ax * dt; this.vy += ay * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 4) this.angle = lerp(this.angle, Math.atan2(this.vy, this.vx), 0.18);
    const targetStretch = 1 + clamp(speed / 900, 0, 0.55);
    this.stretch = lerp(this.stretch, targetStretch, 0.15);

    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 14) this.trail.pop();

    if (this.invuln > 0) this.invuln -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.popScale = lerp(this.popScale, 0, 0.18);
  },
  pop(amount) { this.popScale = Math.min(1.4, this.popScale + amount); },
  draw(radius, glowBoost) {
    // estela
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      const k = 1 - i / this.trail.length;
      ctx.globalAlpha = k * 0.16;
      ctx.fillStyle = COL.player;
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius * 0.7 * k, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const R = radius * (1 + this.popScale * 0.5);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const sx = this.stretch + this.popScale * 0.3;
    const sy = 1 / Math.sqrt(this.stretch) - this.popScale * 0.15;
    ctx.scale(sx, sy);

    const flashMix = this.hitFlash;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.6);
    glow.addColorStop(0, `rgba(232,255,250,${0.55 + glowBoost * 0.3})`);
    glow.addColorStop(0.35, flashMix > 0 ? `rgba(255,90,80,${0.35})` : `rgba(143,245,224,0.28)`);
    glow.addColorStop(1, "rgba(143,245,224,0)");
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.6, 0, TAU);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = flashMix > 0 ? COL.warn : COL.player;
    ctx.shadowColor = flashMix > 0 ? COL.warn : COL.player;
    ctx.shadowBlur = 24;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, R * 0.4, 0, TAU);
    ctx.fillStyle = COL.playerCore;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  },
};

// ---------- Motas ----------
class Mote {
  constructor(big) {
    this.big = big;
    this.respawn();
    this.x = rand(0, W); this.y = rand(0, H);
    this.phase = rand(0, TAU);
  }
  respawn() {
    const edge = Math.floor(rand(0, 4));
    if (edge === 0) { this.x = rand(0, W); this.y = -20; }
    else if (edge === 1) { this.x = W + 20; this.y = rand(0, H); }
    else if (edge === 2) { this.x = rand(0, W); this.y = H + 20; }
    else { this.x = -20; this.y = rand(0, H); }
    const cx = W / 2 + rand(-120, 120), cy = H / 2 + rand(-120, 120);
    const a = Math.atan2(cy - this.y, cx - this.x) + rand(-0.5, 0.5);
    const s = rand(18, 36);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.r = this.big ? rand(9, 11) : rand(4, 5.5);
    this.value = this.big ? rand(10, 14) : rand(2.8, 4);
    this.phase = rand(0, TAU);
    this.dead = false;
  }
  update(dt, t) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.flicker = 0.75 + Math.sin(t * 3 + this.phase) * 0.25;
    if (this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) this.respawn();
  }
  draw() {
    const R = this.r * this.flicker;
    const color = this.big ? COL.moteBig : COL.moteSmall;
    ctx.save();
    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R * 4);
    glow.addColorStop(0, color + "cc");
    glow.addColorStop(1, color + "00");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R * 4, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.arc(this.x, this.y, R * 0.55, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- Zarcillos de sombra ----------
class Tendril {
  constructor(speedMul) {
    const edge = Math.floor(rand(0, 4));
    if (edge === 0) { this.x = rand(0, W); this.y = -40; }
    else if (edge === 1) { this.x = W + 40; this.y = rand(0, H); }
    else if (edge === 2) { this.x = rand(0, W); this.y = H + 40; }
    else { this.x = -40; this.y = rand(0, H); }
    const a = Math.atan2(H / 2 - this.y, W / 2 - this.x) + rand(-0.9, 0.9);
    const s = rand(14, 24) * speedMul;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.len = rand(140, 220);
    this.segs = 9;
    this.phase = rand(0, TAU);
    this.freq = rand(1.4, 2.2);
    this.baseAngle = rand(0, TAU);
    this.turnSpeed = rand(-0.3, 0.3);
    this.points = [];
  }
  update(dt, t) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.baseAngle += this.turnSpeed * dt;
    if (this.x < -260) this.x = W + 200;
    if (this.x > W + 260) this.x = -200;
    if (this.y < -260) this.y = H + 200;
    if (this.y > H + 260) this.y = -200;

    this.points = [];
    for (let i = 0; i < this.segs; i++) {
      const tt = i / (this.segs - 1);
      const wob = Math.sin(t * this.freq + this.phase + tt * 5) * 26 * tt;
      const px = this.x + Math.cos(this.baseAngle) * this.len * tt + Math.cos(this.baseAngle + Math.PI / 2) * wob;
      const py = this.y + Math.sin(this.baseAngle) * this.len * tt + Math.sin(this.baseAngle + Math.PI / 2) * wob;
      this.points.push({ x: px, y: py });
    }
  }
  distToPlayer(px, py) {
    let min = Infinity;
    for (const p of this.points) min = Math.min(min, dist(px, py, p.x, p.y));
    return min;
  }
  draw() {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    this.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = COL.shadow + "55";
    ctx.lineWidth = 22;
    ctx.shadowColor = COL.shadow;
    ctx.shadowBlur = 20;
    ctx.stroke();

    ctx.beginPath();
    this.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = COL.shadowCore;
    ctx.lineWidth = 8;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- Estado del juego ----------
const LIGHT_MAX = 100;
const LIGHT_START = 22;
const DECAY_RATE = 0.8;

const state = {
  mode: "menu", // menu | playing | blooming | win | lose
  light: LIGHT_START,
  time: 0,
  motesEaten: 0,
  motes: [],
  tendrils: [],
  bloomT: 0,
  fadeT: 0,
  flash: 0,
  canRestart: false,
  t: 0,
};

function setupRun() {
  player.reset();
  state.light = LIGHT_START;
  state.time = 0;
  state.motesEaten = 0;
  state.bloomT = 0;
  state.fadeT = 0;
  state.flash = 0;
  state.canRestart = false;
  state.motes = [];
  for (let i = 0; i < 7; i++) state.motes.push(new Mote(false));
  state.motes.push(new Mote(true));
  state.tendrils = [new Tendril(1)];
}

function onPrimaryAction() {
  Audio2.resume();
  if (state.mode === "menu") {
    setupRun();
    state.mode = "playing";
  } else if ((state.mode === "win" || state.mode === "lose") && state.canRestart) {
    state.mode = "menu";
  }
}

function lightRatio() { return clamp(state.light / LIGHT_MAX, 0, 1); }

function update(dt) {
  state.t += dt;
  camera.update(dt);
  dustLayers.forEach((l) => l.update(dt, state.t));
  particles.update(dt);

  if (state.mode === "playing") {
    state.time += dt;
    player.update(dt);

    const lr = lightRatio();
    state.light = clamp(state.light - DECAY_RATE * dt * (0.6 + lr * 0.8), 0, LIGHT_MAX);

    for (const m of state.motes) {
      m.update(dt, state.t);
      const R = 20 + lr * 10;
      if (dist(player.x, player.y, m.x, m.y) < R + m.r) {
        state.light = clamp(state.light + m.value, 0, LIGHT_MAX);
        state.motesEaten++;
        player.pop(m.big ? 1.0 : 0.5);
        particles.ring(m.x, m.y, m.big ? COL.moteBig : COL.moteSmall, 6, m.big ? 90 : 55, m.big ? 0.7 : 0.45);
        particles.burst(m.x, m.y, m.big ? COL.moteBig : COL.moteSmall, m.big ? 18 : 9, m.big ? 160 : 110, 0.6);
        Audio2.chime(clamp(m.value / 13, 0, 1), m.big ? 2 : 1);
        m.respawn();
      }
    }

    const maxExtra = 4;
    const desired = 1 + Math.floor(lr * maxExtra);
    while (state.tendrils.length < desired) state.tendrils.push(new Tendril(1 + lr * 0.6));
    while (state.tendrils.length > desired && state.tendrils.length > 1) state.tendrils.pop();

    for (const tdr of state.tendrils) {
      tdr.update(dt, state.t);
      if (player.invuln <= 0) {
        const d = tdr.distToPlayer(player.x, player.y);
        if (d < 16) {
          state.light = clamp(state.light - 16, 0, LIGHT_MAX);
          player.invuln = 1.1;
          player.hitFlash = 1;
          const away = Math.atan2(player.y - tdr.y, player.x - tdr.x);
          player.vx += Math.cos(away) * 380;
          player.vy += Math.sin(away) * 380;
          camera.kick(14);
          state.flash = 1;
          particles.ash(player.x, player.y, 16);
          Audio2.hit();
        }
      }
    }

    state.flash = Math.max(0, state.flash - dt * 2.2);

    if (state.light <= 0) {
      state.mode = "lose";
      state.fadeT = 0;
      Audio2.fade();
    } else if (state.light >= LIGHT_MAX) {
      state.mode = "blooming";
      state.bloomT = 0;
      player.x = W / 2;
      player.y = H * 0.62;
      Audio2.bloom();
      particles.ring(player.x, player.y, COL.gold, 10, 260, 1.6);
      particles.ring(player.x, player.y, COL.gold, 4, 160, 1.1);
    }
  } else if (state.mode === "blooming") {
    state.bloomT += dt;
    player.trail = [];
    if (state.bloomT > 2.4) { state.mode = "win"; state.canRestart = false; setTimeout(() => (state.canRestart = true), 600); }
  } else if (state.mode === "lose") {
    state.fadeT += dt;
    if (state.fadeT > 1.4 && !state.canRestart) {
      state.canRestart = false;
      setTimeout(() => (state.canRestart = true), 500);
      state.fadeT = 1.4;
    }
  } else if (state.mode === "menu") {
    // demo ambiental
    const ang = state.t * 0.5;
    player.x = W / 2 + Math.cos(ang) * 90;
    player.y = H / 2 + Math.sin(ang * 1.3) * 50;
    player.trail.unshift({ x: player.x, y: player.y });
    if (player.trail.length > 14) player.trail.pop();
  }
}

// ---------- Render ----------
function drawVignette(lr) {
  const cx = W / 2, cy = H / 2;
  const inner = 120 + lr * Math.min(W, H) * 0.32;
  const outer = Math.max(W, H) * 0.75;
  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawMeter(lr) {
  const cx = W / 2, cy = 34;
  const r = 58;
  const start = Math.PI * 0.16, end = Math.PI * 0.84;
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + (end - start) * lr);
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, COL.player);
  grad.addColorStop(1, lr > 0.92 ? COL.gold : COL.moteBig);
  ctx.strokeStyle = grad;
  ctx.shadowColor = COL.player;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function centerText(lines, y0, opts = {}) {
  ctx.save();
  ctx.textAlign = "center";
  let y = y0;
  for (const line of lines) {
    ctx.font = line.font || "16px system-ui, sans-serif";
    ctx.fillStyle = line.color || "rgba(230,245,250,0.85)";
    if (line.glow) { ctx.shadowColor = line.glow; ctx.shadowBlur = line.blur || 16; }
    else ctx.shadowBlur = 0;
    ctx.globalAlpha = line.alpha === undefined ? 1 : line.alpha;
    ctx.fillText(line.text, W / 2, y);
    y += line.gap || 30;
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
  bgGrad.addColorStop(0, COL.bg1);
  bgGrad.addColorStop(1, COL.bg0);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(camera.x, camera.y);

  const lr = state.mode === "menu" ? 0.15 : lightRatio();
  dustLayers.forEach((l) => l.draw(lr));

  if (state.mode === "playing" || state.mode === "blooming") {
    for (const m of state.motes) if (state.mode === "playing") m.draw();
    for (const tdr of state.tendrils) if (state.mode === "playing") tdr.draw();
  }

  particles.draw();

  const pulse = state.mode === "playing" && lr < 0.18 ? (Math.sin(state.t * 8) * 0.5 + 0.5) * (0.18 - lr) * 4 : 0;
  const bloomScale = state.mode === "blooming" ? 1 + clamp(state.bloomT / 2.4, 0, 1) * 2.2 : 1;
  const baseR = 15;

  if (state.mode === "blooming" || state.mode === "win") {
    const k = clamp(state.bloomT / 2.4, 0, 1);
    const spin = state.mode === "win" ? state.t * 0.15 : state.bloomT * 0.6;
    const breathe = state.mode === "win" ? 1 + Math.sin(state.t * 1.1) * 0.04 : 1;
    ctx.save();
    ctx.translate(player.x, player.y);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + spin;
      const R = (20 + k * 130) * breathe;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 10 + k * 26, 4 + k * 10, a, 0, TAU);
      ctx.fillStyle = `rgba(255,210,122,${0.55 * (1 - k * 0.3)})`;
      ctx.shadowColor = COL.gold;
      ctx.shadowBlur = 30;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, (22 + k * 18) * breathe, 0, TAU);
    ctx.fillStyle = "#fffdf4";
    ctx.shadowColor = COL.gold;
    ctx.shadowBlur = 40;
    ctx.fill();
    ctx.restore();
  } else if (state.mode !== "lose") {
    player.draw(baseR + pulse, lr);
  } else {
    const k = clamp(1 - state.fadeT / 1.4, 0, 1);
    ctx.globalAlpha = k;
    player.draw(baseR * (0.4 + k * 0.6), lr * k);
    ctx.globalAlpha = 1;
  }

  drawVignette(state.mode === "lose" ? lr * clamp(1 - state.fadeT / 1.4, 0, 1) : lr);

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,70,60,${state.flash * 0.22})`;
    ctx.fillRect(-40, -40, W + 80, H + 80);
  }
  if (state.mode === "lose") {
    ctx.fillStyle = `rgba(0,0,0,${clamp(state.fadeT / 1.4, 0, 1) * 0.9})`;
    ctx.fillRect(-40, -40, W + 80, H + 80);
  }
  if (state.mode === "blooming") {
    const k = clamp(state.bloomT / 2.4, 0, 1);
    ctx.fillStyle = `rgba(255,226,170,${k * 0.35})`;
    ctx.fillRect(-40, -40, W + 80, H + 80);
  }

  ctx.restore();

  // UI (espacio de pantalla, sin cámara)
  if (state.mode === "menu") {
    const bob = Math.sin(state.t * 1.4) * 4;
    centerText(
      [
        { text: "D E R I V A", font: "600 52px system-ui, sans-serif", color: "#eafffb", glow: COL.player, blur: 30, gap: 46 },
        { text: "una gota de luz en el abismo", font: "16px system-ui, sans-serif", color: "rgba(220,240,240,0.55)", gap: 90 },
      ],
      H * 0.32 + bob,
    );
    const alpha = 0.55 + Math.sin(state.t * 2.4) * 0.25;
    centerText(
      [
        { text: input.hasPointer ? "toca para comenzar" : "mueve el puntero y haz clic para comenzar", font: "15px system-ui, sans-serif", color: `rgba(200,235,230,${alpha})`, gap: 26 },
        { text: "absorbe la luz · evita la sombra", font: "12px system-ui, sans-serif", color: "rgba(170,200,200,0.4)", gap: 24 },
      ],
      H * 0.68,
    );
  } else if (state.mode === "playing") {
    drawMeter(lr);
    ctx.save();
    ctx.textAlign = "left";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(210,235,235,0.5)";
    ctx.fillText(`${state.time.toFixed(1)}s`, 18, H - 18);
    ctx.textAlign = "right";
    ctx.fillText(`${state.motesEaten} motas`, W - 18, H - 18);
    ctx.restore();
    if (lr < 0.15) {
      centerText(
        [{ text: "tu luz se apaga...", font: "13px system-ui, sans-serif", color: `rgba(255,150,140,${0.5 + Math.sin(state.t * 8) * 0.3})`, gap: 20 }],
        H - 46,
      );
    }
  } else if (state.mode === "win") {
    centerText(
      [
        { text: "HAS FLORECIDO", font: "600 44px system-ui, sans-serif", color: "#fff6e2", glow: COL.gold, blur: 34, gap: 40 },
        { text: `${state.time.toFixed(1)}s a la deriva · ${state.motesEaten} motas absorbidas`, font: "14px system-ui, sans-serif", color: "rgba(255,240,210,0.7)", gap: 30 },
      ],
      H * 0.16,
    );
    if (state.canRestart) {
      const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
      centerText([{ text: "toca para volver a la deriva", color: `rgba(255,240,210,${alpha})`, font: "14px system-ui, sans-serif" }], H * 0.9);
    }
  } else if (state.mode === "lose") {
    centerText(
      [
        { text: "LA OSCURIDAD TE CUBRIÓ", font: "600 36px system-ui, sans-serif", color: "#dfe8ff", glow: COL.shadow, blur: 28, gap: 44 },
        { text: `${state.time.toFixed(1)}s a la deriva · ${state.motesEaten} motas absorbidas`, font: "14px system-ui, sans-serif", color: "rgba(210,220,255,0.6)", gap: 60 },
      ],
      H * 0.42,
    );
    if (state.canRestart) {
      const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
      centerText([{ text: "toca para intentarlo de nuevo", color: `rgba(210,220,255,${alpha})`, font: "14px system-ui, sans-serif" }], H * 0.62);
    }
  }
}

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
