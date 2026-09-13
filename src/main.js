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
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
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

// ---------- Interfaz: hotspots, botones, controles ----------
let hotspots = [];
function clearHotspots() { hotspots = []; }
function addHotspot(x, y, w, h, action) { if (action) hotspots.push({ x, y, w, h, action }); }
function hitTest(px, py) {
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const s = hotspots[i];
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return s;
  }
  return null;
}
function isHover(x, y, w, h) {
  return input.px >= x && input.px <= x + w && input.py >= y && input.py <= y + h;
}

function roundedRectPath(x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(cx, cy, w, h, label, opts = {}) {
  const x = cx - w / 2, y = cy - h / 2;
  const disabled = !!opts.disabled;
  const hover = !disabled && isHover(x, y, w, h);
  const r = h / 2;
  ctx.save();
  ctx.beginPath();
  roundedRectPath(x, y, w, h, r);
  ctx.fillStyle = disabled ? "rgba(255,255,255,0.03)" : `rgba(143,245,224,${hover ? 0.16 : 0.07})`;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = disabled ? "rgba(170,190,190,0.14)" : `rgba(143,245,224,${hover ? 0.8 : 0.38})`;
  if (hover && !disabled) { ctx.shadowColor = COL.player; ctx.shadowBlur = 18; }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = opts.font || "600 15px system-ui, sans-serif";
  ctx.fillStyle = disabled ? "rgba(180,200,200,0.32)" : "rgba(235,255,250,0.94)";
  ctx.fillText(label, cx, cy + 1);
  ctx.restore();
  if (!disabled) addHotspot(x, y, w, h, opts.action);
  return hover;
}

function drawTextLink(cx, cy, label, action) {
  ctx.save();
  ctx.font = "13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width + 44;
  const hover = isHover(cx - w / 2, cy - 16, w, 32);
  ctx.fillStyle = hover ? "rgba(230,250,245,0.95)" : "rgba(190,220,220,0.55)";
  if (hover) { ctx.shadowColor = COL.player; ctx.shadowBlur = 10; }
  ctx.fillText(label, cx, cy);
  ctx.restore();
  addHotspot(cx - w / 2, cy - 16, w, 32, action);
}

function drawSegmented(cx, cy, labels, selectedIndex, onSelect) {
  const w = 92, h = 34, gap = 8;
  const totalW = labels.length * w + (labels.length - 1) * gap;
  let x = cx - totalW / 2;
  labels.forEach((label, i) => {
    const bx = x + w / 2, by = cy;
    const selected = i === selectedIndex;
    const hover = isHover(x, cy - h / 2, w, h);
    ctx.save();
    ctx.beginPath();
    roundedRectPath(x, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = selected ? "rgba(143,245,224,0.22)" : hover ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = selected ? COL.player : "rgba(200,220,220,0.25)";
    if (selected) { ctx.shadowColor = COL.player; ctx.shadowBlur = 12; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = selected ? "#eafffb" : "rgba(210,230,230,0.62)";
    ctx.fillText(label, bx, by + 1);
    ctx.restore();
    addHotspot(x, cy - h / 2, w, h, () => onSelect(i));
    x += w + gap;
  });
}

let sliderDrag = null;
function drawSlider(cx, cy, w, value01, onChange, label) {
  const x = cx - w / 2;
  const trackH = 4;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(210,230,230,0.6)";
  ctx.fillText(label, cx, cy - 22);
  ctx.beginPath();
  roundedRectPath(x, cy - trackH / 2, w, trackH, trackH / 2);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.beginPath();
  roundedRectPath(x, cy - trackH / 2, Math.max(trackH, w * value01), trackH, trackH / 2);
  ctx.fillStyle = COL.player;
  ctx.shadowColor = COL.player;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  const hx = x + w * value01;
  const near = dist(input.px, input.py, hx, cy) < 16 || (sliderDrag && sliderDrag.label === label);
  ctx.beginPath();
  ctx.arc(hx, cy, near ? 9 : 7, 0, TAU);
  ctx.fillStyle = "#eafffb";
  ctx.shadowColor = COL.player;
  ctx.shadowBlur = near ? 16 : 8;
  ctx.fill();
  ctx.restore();
  addHotspot(x - 12, cy - 20, w + 24, 40, () => {
    sliderDrag = { label, x, w, onChange };
    onChange(clamp((input.px - x) / w, 0, 1));
  });
}

function drawFullscreenIcon() {
  const size = 36, pad = 14;
  const x = W - pad - size, y = pad;
  const hover = isHover(x, y, size, size);
  const m = 10, o = 4;
  ctx.save();
  ctx.globalAlpha = hover ? 0.95 : 0.45;
  ctx.strokeStyle = "#cfeee6";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (!isFullscreen) {
    ctx.moveTo(x, y + m); ctx.lineTo(x, y); ctx.lineTo(x + m, y);
    ctx.moveTo(x + size - m, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size, y + m);
    ctx.moveTo(x + size, y + size - m); ctx.lineTo(x + size, y + size); ctx.lineTo(x + size - m, y + size);
    ctx.moveTo(x + m, y + size); ctx.lineTo(x, y + size); ctx.lineTo(x, y + size - m);
  } else {
    ctx.moveTo(x + o, y + o + m); ctx.lineTo(x + o, y + o); ctx.lineTo(x + o + m, y + o);
    ctx.moveTo(x + size - o - m, y + o); ctx.lineTo(x + size - o, y + o); ctx.lineTo(x + size - o, y + o + m);
    ctx.moveTo(x + size - o, y + size - o - m); ctx.lineTo(x + size - o, y + size - o); ctx.lineTo(x + size - o - m, y + size - o);
    ctx.moveTo(x + o + m, y + size - o); ctx.lineTo(x + o, y + size - o); ctx.lineTo(x + o, y + size - o - m);
  }
  ctx.stroke();
  ctx.restore();
  addHotspot(x, y, size, size, toggleFullscreen);
}

// ---------- Pantalla completa ----------
let isFullscreen = false;
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
}
document.addEventListener("fullscreenchange", () => {
  isFullscreen = !!document.fullscreenElement;
  resize();
});

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
  kick(mag) { this.shakeMag = Math.max(this.shakeMag, mag); },
};

// ---------- Fondo: polvo abisal en capas ----------
class DustLayer {
  constructor(count, depth) {
    this.depth = depth;
    this.items = Array.from({ length: count }, () => ({
      x: rand(0, W), y: rand(0, H), r: rand(0.6, 1.8) * depth,
      a: rand(0.05, 0.22) * depth, p: rand(0, TAU),
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

// ---------- Fondo: destellos de profundidad (bokeh) ----------
class Bokeh {
  constructor(count) {
    this.items = Array.from({ length: count }, () => ({
      x: rand(0, W), y: rand(0, H), r: rand(50, 110), a: rand(0.03, 0.07),
      vx: rand(-2.5, 2.5), vy: rand(-3.5, -0.8),
      hue: Math.random() < 0.6 ? COL.player : COL.shadow,
    }));
  }
  update(dt) {
    for (const it of this.items) {
      it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.y < -140) { it.y = H + 140; it.x = rand(0, W); }
      if (it.x < -140) it.x = W + 140;
      if (it.x > W + 140) it.x = -140;
    }
  }
  draw(lightGlow) {
    ctx.save();
    for (const it of this.items) {
      ctx.globalAlpha = it.a * (0.4 + lightGlow * 0.6);
      const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, it.r);
      g.addColorStop(0, it.hue);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
const bokeh = new Bokeh(7);

// ---------- Partículas ----------
class Particles {
  constructor() { this.list = []; }
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
    const sens = Settings.get("sensitivity") || 1;
    const kdir = keyboardDir();
    let tx, ty;
    if (kdir) { const d = 300 * sens; tx = this.x + kdir.x * d; ty = this.y + kdir.y * d; }
    else { tx = input.px; ty = input.py; }

    const k = 34 * sens, damp = 8.2 * Math.sqrt(sens);
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
    glow.addColorStop(0.35, flashMix > 0 ? `rgba(255,90,80,0.35)` : `rgba(143,245,224,0.28)`);
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

    ctx.beginPath();
    ctx.ellipse(-R * 0.28, -R * 0.32, R * 0.18, R * 0.11, -0.6, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.shadowBlur = 0;
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

    const core = ctx.createRadialGradient(this.x - R * 0.25, this.y - R * 0.3, 0, this.x, this.y, R * 0.9);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.55, color);
    core.addColorStop(1, color + "aa");
    ctx.beginPath();
    ctx.fillStyle = core;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.arc(this.x, this.y, R * 0.55, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.arc(this.x, this.y, R * 0.55, 0, TAU);
    ctx.stroke();
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
    this.segs = 12;
    this.phase = rand(0, TAU);
    this.freq = rand(1.4, 2.2);
    this.baseAngle = rand(0, TAU);
    this.turnSpeed = rand(-0.3, 0.3);
    this.points = [];
    this.alpha = 0;
    this.phaseState = "in";
    this.lastT = 0;
  }
  update(dt, t) {
    this.lastT = t;
    if (this.phaseState === "in") {
      this.alpha = Math.min(1, this.alpha + dt / 0.6);
      if (this.alpha >= 1) this.phaseState = "active";
    } else if (this.phaseState === "out") {
      this.alpha = Math.max(0, this.alpha - dt / 0.6);
    } else {
      this.alpha = 1;
    }

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
    if (this.alpha <= 0.01) return;
    const pts = this.points;
    if (pts.length < 2) return;
    const baseW = 20, tipW = 3;
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const tx = next.x - prev.x, ty = next.y - prev.y;
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl, ny = tx / tl;
      const w = lerp(baseW, tipW, i / (pts.length - 1)) / 2;
      left.push({ x: p.x + nx * w, y: p.y + ny * w });
      right.push({ x: p.x - nx * w, y: p.y - ny * w });
    }
    ctx.save();
    ctx.globalAlpha = this.alpha;

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    grad.addColorStop(0, COL.shadow + "dd");
    grad.addColorStop(1, COL.shadow + "20");
    ctx.fillStyle = grad;
    ctx.shadowColor = COL.shadow;
    ctx.shadowBlur = 22;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = COL.shadowCore;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 8;
    ctx.stroke();

    const tip = pts[pts.length - 1];
    const pulse = 4.5 + Math.sin(this.lastT * 3 + this.phase) * 1.4;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, pulse, 0, TAU);
    ctx.fillStyle = "rgba(201,168,255,0.45)";
    ctx.shadowColor = COL.moteBig;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
  }
}

// ---------- Niveles ----------
const LEVELS = [
  { name: "Nivel 1", target: 55, time: 45, tendrilBase: 1, tendrilExtra: 1, speedMul: 1.0 },
  { name: "Nivel 2", target: 70, time: 50, tendrilBase: 1, tendrilExtra: 2, speedMul: 1.1 },
  { name: "Nivel 3", target: 85, time: 55, tendrilBase: 2, tendrilExtra: 2, speedMul: 1.25 },
  { name: "Nivel 4", target: 100, time: 60, tendrilBase: 2, tendrilExtra: 3, speedMul: 1.4 },
  { name: "Nivel 5", target: 120, time: 65, tendrilBase: 3, tendrilExtra: 3, speedMul: 1.6 },
];

function buildRunCfg(flavor, levelIndex) {
  if (flavor === "chill") {
    const density = Settings.get("chillTendrils");
    const map = {
      none: { tendrilBase: 0, tendrilExtra: 0 },
      few: { tendrilBase: 0, tendrilExtra: 2 },
      normal: { tendrilBase: 1, tendrilExtra: 3 },
    };
    const d = map[density] || map.few;
    return { flavor, lightMax: 100, decay: 0, tendrilBase: d.tendrilBase, tendrilExtra: d.tendrilExtra, speedMul: 0.85, timeLimit: null, noLose: true, loopBloom: true };
  }
  if (flavor === "levels") {
    const lvl = LEVELS[levelIndex];
    return { flavor, lightMax: lvl.target, decay: 0.8, tendrilBase: lvl.tendrilBase, tendrilExtra: lvl.tendrilExtra, speedMul: lvl.speedMul, timeLimit: lvl.time, noLose: false, loopBloom: false, levelIndex };
  }
  return { flavor: "classic", lightMax: 100, decay: 0.8, tendrilBase: 1, tendrilExtra: 4, speedMul: 1, timeLimit: null, noLose: false, loopBloom: false };
}

// ---------- Estado del juego ----------
const LIGHT_START = 22;

const state = {
  mode: "menu", // menu | settings | levelSelect | playing | paused | blooming | win | lose
  prevMode: "menu",
  flavor: "classic",
  levelIndex: 0,
  runCfg: null,
  light: LIGHT_START,
  time: 0,
  timeLeft: null,
  motesEaten: 0,
  motes: [],
  tendrils: [],
  bloomT: 0,
  fadeT: 0,
  flash: 0,
  canRestart: false,
  loseReason: null,
  t: 0,
};

function setupRun(flavor, levelIndex) {
  const cfg = buildRunCfg(flavor, levelIndex);
  state.flavor = flavor;
  state.levelIndex = levelIndex || 0;
  state.runCfg = cfg;
  player.reset();
  state.light = flavor === "levels" ? Math.min(LIGHT_START, cfg.lightMax * 0.3) : LIGHT_START;
  state.time = 0;
  state.timeLeft = cfg.timeLimit;
  state.motesEaten = 0;
  state.bloomT = 0;
  state.fadeT = 0;
  state.flash = 0;
  state.canRestart = false;
  state.loseReason = null;
  state.motes = [];
  for (let i = 0; i < 7; i++) state.motes.push(new Mote(false));
  state.motes.push(new Mote(true));
  state.tendrils = [];
}

function startRun(flavor, levelIndex) {
  Audio2.resume();
  setupRun(flavor, levelIndex);
  state.mode = "playing";
}

function handleRestartTap() {
  if (!state.canRestart) return;
  const cfg = state.runCfg;
  if (state.mode === "win") {
    if (cfg.flavor === "levels") {
      const next = state.levelIndex + 1;
      if (next < LEVELS.length) { setupRun("levels", next); state.mode = "playing"; }
      else { state.mode = "levelSelect"; }
    } else {
      state.mode = "menu";
    }
  } else if (state.mode === "lose") {
    if (cfg.flavor === "levels") { setupRun("levels", state.levelIndex); state.mode = "playing"; }
    else { state.mode = "menu"; }
  }
}

function lightRatio() {
  const max = state.runCfg ? state.runCfg.lightMax : 100;
  return clamp(state.light / max, 0, 1);
}

// ---------- Actualización ----------
function updatePlaying(dt) {
  const cfg = state.runCfg;
  state.time += dt;
  if (cfg.timeLimit != null) state.timeLeft = Math.max(0, state.timeLeft - dt);
  player.update(dt);

  const lr = lightRatio();
  state.light = clamp(state.light - cfg.decay * dt * (0.6 + lr * 0.8), 0, cfg.lightMax);

  for (const m of state.motes) {
    m.update(dt, state.t);
    const R = 20 + lr * 10;
    if (dist(player.x, player.y, m.x, m.y) < R + m.r) {
      state.light = clamp(state.light + m.value, 0, cfg.lightMax);
      state.motesEaten++;
      player.pop(m.big ? 1.0 : 0.5);
      particles.ring(m.x, m.y, m.big ? COL.moteBig : COL.moteSmall, 6, m.big ? 90 : 55, m.big ? 0.7 : 0.45);
      particles.burst(m.x, m.y, m.big ? COL.moteBig : COL.moteSmall, m.big ? 18 : 9, m.big ? 160 : 110, 0.6);
      Audio2.chime(clamp(m.value / 13, 0, 1), m.big ? 2 : 1);
      m.respawn();
    }
  }

  const desired = cfg.tendrilBase + Math.floor(lr * cfg.tendrilExtra);
  const notLeaving = state.tendrils.filter((t) => t.phaseState !== "out");
  if (notLeaving.length < desired) {
    for (let i = notLeaving.length; i < desired; i++) state.tendrils.push(new Tendril(cfg.speedMul));
  } else if (notLeaving.length > desired) {
    let excess = notLeaving.length - desired;
    for (let i = state.tendrils.length - 1; i >= 0 && excess > 0; i--) {
      if (state.tendrils[i].phaseState === "active") { state.tendrils[i].phaseState = "out"; excess--; }
    }
  }

  for (const tdr of state.tendrils) {
    tdr.update(dt, state.t);
    if (player.invuln <= 0 && tdr.alpha > 0.6) {
      const d = tdr.distToPlayer(player.x, player.y);
      if (d < 16) {
        state.light = clamp(state.light - 16, 0, cfg.lightMax);
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
  state.tendrils = state.tendrils.filter((t) => !(t.phaseState === "out" && t.alpha <= 0));
  state.flash = Math.max(0, state.flash - dt * 2.2);

  if (cfg.noLose) state.light = Math.max(state.light, 8);

  if (!cfg.noLose && state.light <= 0) {
    state.mode = "lose";
    state.loseReason = "dark";
    state.fadeT = 0;
    Audio2.fade();
  } else if (!cfg.noLose && cfg.timeLimit != null && state.timeLeft <= 0 && state.light < cfg.lightMax) {
    state.mode = "lose";
    state.loseReason = "time";
    state.fadeT = 0;
    Audio2.fade();
  } else if (state.light >= cfg.lightMax) {
    state.mode = "blooming";
    state.bloomT = 0;
    player.x = W / 2;
    player.y = H * 0.62;
    Audio2.bloom();
    particles.ring(player.x, player.y, COL.gold, 10, 260, 1.6);
    particles.ring(player.x, player.y, COL.gold, 4, 160, 1.1);
  }
}

function updateBlooming(dt) {
  state.bloomT += dt;
  player.trail = [];
  if (state.bloomT > 2.4) {
    if (state.runCfg.loopBloom) {
      state.light = state.runCfg.lightMax * 0.32;
      state.mode = "playing";
      player.x = W / 2; player.y = H / 2;
      player.invuln = 0; player.hitFlash = 0;
    } else {
      if (state.runCfg.flavor === "levels") Settings.unlockLevel(state.levelIndex + 1);
      state.mode = "win";
      state.canRestart = false;
      setTimeout(() => (state.canRestart = true), 600);
    }
  }
}

function update(dt) {
  state.t += dt;
  camera.update(dt);
  dustLayers.forEach((l) => l.update(dt, state.t));
  bokeh.update(dt);
  particles.update(dt);

  if (state.mode === "playing") updatePlaying(dt);
  else if (state.mode === "blooming") updateBlooming(dt);
  else if (state.mode === "lose") {
    state.fadeT += dt;
    if (state.fadeT > 1.4 && !state.canRestart) {
      setTimeout(() => (state.canRestart = true), 500);
      state.fadeT = 1.4;
    }
  } else if (state.mode === "menu" || state.mode === "settings" || state.mode === "levelSelect") {
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

function centerText(lines, y0) {
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
    y += line.gap === undefined ? 30 : line.gap;
  }
  ctx.restore();
}

function drawMenuScreen() {
  const bob = Math.sin(state.t * 1.4) * 4;
  centerText([
    { text: "D E R I V A", font: "600 52px system-ui, sans-serif", color: "#eafffb", glow: COL.player, blur: 30, gap: 40 },
    { text: "una gota de luz en el abismo", font: "15px system-ui, sans-serif", color: "rgba(220,240,240,0.5)", gap: 0 },
  ], H * 0.2 + bob);

  const cy0 = H * 0.5;
  drawButton(W / 2, cy0, 260, 52, "DERIVA", { action: () => startRun("classic", 0), font: "600 17px system-ui, sans-serif" });
  drawButton(W / 2, cy0 + 66, 260, 52, "CHILL", { action: () => startRun("chill", 0), font: "600 17px system-ui, sans-serif" });
  drawButton(W / 2, cy0 + 132, 260, 52, "NIVELES", { action: () => { state.mode = "levelSelect"; }, font: "600 17px system-ui, sans-serif" });

  drawTextLink(W / 2, cy0 + 190, "ajustes", () => { state.mode = "settings"; });
}

function drawSettingsScreen() {
  centerText([{ text: "AJUSTES", font: "600 30px system-ui, sans-serif", color: "#eafffb", glow: COL.player, blur: 20 }], H * 0.2);

  const sens = Settings.get("sensitivity");
  drawSlider(W / 2, H * 0.38, 280, (sens - 0.5) / 1.5, (v) => Settings.set("sensitivity", +(0.5 + v * 1.5).toFixed(2)), `sensibilidad de control (ratón, wasd y flechas) · ${sens.toFixed(2)}x`);

  centerText([{ text: "zarcillos en modo chill", font: "12px system-ui, sans-serif", color: "rgba(210,230,230,0.55)" }], H * 0.52);
  const density = Settings.get("chillTendrils");
  const opts = ["none", "few", "normal"];
  drawSegmented(W / 2, H * 0.57, ["ninguno", "pocos", "normal"], opts.indexOf(density), (i) => Settings.set("chillTendrils", opts[i]));

  drawTextLink(W / 2, H * 0.74, "atrás", () => { state.mode = "menu"; });
}

function drawLevelSelectScreen() {
  centerText([{ text: "NIVELES", font: "600 30px system-ui, sans-serif", color: "#eafffb", glow: COL.player, blur: 20 }], H * 0.16);
  const unlocked = Settings.getUnlockedLevel();
  const startY = H * 0.3, gap = 58;
  LEVELS.forEach((lvl, i) => {
    const locked = i > unlocked;
    const y = startY + i * gap;
    drawButton(W / 2, y, 240, 46, locked ? "🔒 " + lvl.name : lvl.name, {
      action: locked ? null : () => startRun("levels", i),
      disabled: locked,
      font: "600 15px system-ui, sans-serif",
    });
  });
  drawTextLink(W / 2, startY + LEVELS.length * gap + 20, "atrás", () => { state.mode = "menu"; });
}

function drawPausedScreen() {
  ctx.fillStyle = "rgba(2,4,10,0.74)";
  ctx.fillRect(0, 0, W, H);
  centerText([{ text: "EN PAUSA", font: "600 28px system-ui, sans-serif", color: "#eafffb", glow: COL.player, blur: 18 }], H * 0.24);

  const sens = Settings.get("sensitivity");
  drawSlider(W / 2, H * 0.38, 260, (sens - 0.5) / 1.5, (v) => Settings.set("sensitivity", +(0.5 + v * 1.5).toFixed(2)), `sensibilidad · ${sens.toFixed(2)}x`);

  let nextY = H * 0.56;
  if (state.runCfg && state.runCfg.flavor === "chill") {
    centerText([{ text: "zarcillos", font: "12px system-ui, sans-serif", color: "rgba(210,230,230,0.55)" }], H * 0.48);
    const density = Settings.get("chillTendrils");
    const opts = ["none", "few", "normal"];
    const extras = [0, 2, 3];
    const bases = [0, 0, 1];
    drawSegmented(W / 2, H * 0.53, ["ninguno", "pocos", "normal"], opts.indexOf(density), (i) => {
      Settings.set("chillTendrils", opts[i]);
      state.runCfg.tendrilBase = bases[i];
      state.runCfg.tendrilExtra = extras[i];
    });
    nextY = H * 0.66;
  }

  drawButton(W / 2, nextY, 200, 46, "continuar", { action: () => { state.mode = state.prevMode; } });
  drawButton(W / 2, nextY + 58, 200, 46, "menú principal", { action: () => { state.mode = "menu"; } });
}

function drawHud(lr) {
  drawMeter(lr);
  const cfg = state.runCfg;
  ctx.save();
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "left";
  if (cfg.timeLimit != null) {
    ctx.fillStyle = state.timeLeft < 8 ? "rgba(255,150,140,0.85)" : "rgba(210,235,235,0.5)";
    ctx.fillText(`${Math.ceil(state.timeLeft)}s restantes`, 18, H - 18);
  } else if (cfg.flavor !== "chill") {
    ctx.fillStyle = "rgba(210,235,235,0.5)";
    ctx.fillText(`${state.time.toFixed(1)}s`, 18, H - 18);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(210,235,235,0.5)";
  ctx.fillText(`${state.motesEaten} motas`, W - 18, H - 18);
  ctx.restore();

  if (cfg.flavor !== "chill" && cfg.timeLimit == null && lr < 0.15) {
    centerText([{ text: "tu luz se apaga...", font: "13px system-ui, sans-serif", color: `rgba(255,150,140,${0.5 + Math.sin(state.t * 8) * 0.3})`, gap: 20 }], H - 46);
  }
  if (state.time < 5) {
    const a = clamp(1 - state.time / 5, 0, 1) * 0.5;
    centerText([{ text: "esc · pausa    f · pantalla completa", font: "11px system-ui, sans-serif", color: `rgba(200,225,225,${a})` }], H - 66);
  }
}

function drawWinScreen() {
  const cfg = state.runCfg;
  if (cfg.flavor === "levels") {
    const isLast = state.levelIndex >= LEVELS.length - 1;
    centerText([
      { text: isLast ? "¡TODOS LOS NIVELES SUPERADOS!" : `${LEVELS[state.levelIndex].name.toUpperCase()} SUPERADO`, font: "600 30px system-ui, sans-serif", color: "#fff6e2", glow: COL.gold, blur: 30, gap: 40 },
      { text: `${state.time.toFixed(1)}s · ${state.motesEaten} motas absorbidas`, font: "14px system-ui, sans-serif", color: "rgba(255,240,210,0.7)", gap: 30 },
    ], H * 0.16);
    if (state.canRestart) {
      const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
      centerText([{ text: isLast ? "toca para volver a niveles" : "toca para el siguiente nivel", color: `rgba(255,240,210,${alpha})`, font: "14px system-ui, sans-serif" }], H * 0.9);
    }
  } else {
    centerText([
      { text: "HAS FLORECIDO", font: "600 44px system-ui, sans-serif", color: "#fff6e2", glow: COL.gold, blur: 34, gap: 40 },
      { text: `${state.time.toFixed(1)}s a la deriva · ${state.motesEaten} motas absorbidas`, font: "14px system-ui, sans-serif", color: "rgba(255,240,210,0.7)", gap: 30 },
    ], H * 0.16);
    if (state.canRestart) {
      const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
      centerText([{ text: "toca para volver al menú", color: `rgba(255,240,210,${alpha})`, font: "14px system-ui, sans-serif" }], H * 0.9);
    }
  }
}

function drawLoseScreen() {
  const cfg = state.runCfg;
  const title = state.loseReason === "time" ? "SE ACABÓ EL TIEMPO" : "LA OSCURIDAD TE CUBRIÓ";
  centerText([
    { text: title, font: "600 34px system-ui, sans-serif", color: "#dfe8ff", glow: COL.shadow, blur: 28, gap: 44 },
    { text: `${state.time.toFixed(1)}s · ${state.motesEaten} motas absorbidas`, font: "14px system-ui, sans-serif", color: "rgba(210,220,255,0.6)", gap: 60 },
  ], H * 0.38);
  if (state.canRestart) {
    const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
    const label = cfg.flavor === "levels" ? "toca para reintentar el nivel" : "toca para intentarlo de nuevo";
    centerText([{ text: label, color: `rgba(210,220,255,${alpha})`, font: "14px system-ui, sans-serif" }], H * 0.6);
  }
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

  const ambientModes = ["menu", "settings", "levelSelect"];
  const lr = ambientModes.includes(state.mode) ? 0.15 : lightRatio();
  dustLayers.forEach((l) => l.draw(lr));
  bokeh.draw(lr);

  const worldModes = ["playing", "paused"];
  if (worldModes.includes(state.mode)) {
    for (const m of state.motes) m.draw();
    for (const tdr of state.tendrils) tdr.draw();
  }

  particles.draw();

  const pulse = state.mode === "playing" && lr < 0.18 ? (Math.sin(state.t * 8) * 0.5 + 0.5) * (0.18 - lr) * 4 : 0;
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

  clearHotspots();
  if (state.mode === "menu") drawMenuScreen();
  else if (state.mode === "settings") drawSettingsScreen();
  else if (state.mode === "levelSelect") drawLevelSelectScreen();
  else if (state.mode === "playing") drawHud(lr);
  else if (state.mode === "win") drawWinScreen();
  else if (state.mode === "lose") drawLoseScreen();
  if (state.mode === "paused") drawPausedScreen();

  drawFullscreenIcon();
}

// ---------- Eventos ----------
window.addEventListener("pointermove", (e) => {
  input.px = e.clientX;
  input.py = e.clientY;
  input.hasPointer = true;
  if (sliderDrag) sliderDrag.onChange(clamp((e.clientX - sliderDrag.x) / sliderDrag.w, 0, 1));
});
window.addEventListener("pointerdown", (e) => {
  input.px = e.clientX;
  input.py = e.clientY;
  input.hasPointer = true;
  const hit = hitTest(e.clientX, e.clientY);
  if (hit) { Audio2.resume(); hit.action(); return; }
  if ((state.mode === "win" || state.mode === "lose") && state.canRestart) { Audio2.resume(); handleRestartTap(); }
});
window.addEventListener("pointerup", () => { sliderDrag = null; });
window.addEventListener("keydown", (e) => {
  input.keys.add(e.code);
  if (e.code === "KeyF") { toggleFullscreen(); return; }
  if (e.code === "Escape") {
    if (state.mode === "playing") { state.prevMode = "playing"; state.mode = "paused"; }
    else if (state.mode === "paused") { state.mode = state.prevMode; }
    else if (state.mode === "settings" || state.mode === "levelSelect") { state.mode = "menu"; }
    return;
  }
  if (e.code === "Space" || e.code === "Enter") {
    Audio2.resume();
    if (state.mode === "menu") startRun("classic", 0);
    else if ((state.mode === "win" || state.mode === "lose") && state.canRestart) handleRestartTap();
    else if (state.mode === "paused") state.mode = state.prevMode;
  }
});
window.addEventListener("keyup", (e) => input.keys.delete(e.code));

// ---------- Bucle ----------
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
