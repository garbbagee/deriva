(() => {
"use strict";

// ---------- Utilidades ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;
function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

let W = 0, H = 0, DPR = 1, UI = 1;
// Factor de escala de interfaz: adapta tipografía y controles a la ventana
// real (ventana pequeña, monitor grande, pantalla completa) sin deformar
// la composición. Los elementos de juego (gota, motas, zarcillos) NO usan
// este factor a propósito: su tamaño en píxeles debe ser estable respecto
// al puntero, no respecto al tamaño del monitor.
function computeUIScale() {
  return clamp(Math.min(W / 1280, H / 800), 0.62, 1.3);
}
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth;
  H = window.innerHeight;
  // Tamaño de respaldo en píxeles físicos (nítido en HiDPI) y tamaño CSS
  // explícito en píxeles lógicos: evita cualquier desajuste de redondeo
  // entre vw/vh y innerWidth/innerHeight que produciría un reescalado
  // adicional (y por lo tanto blur) por parte del navegador.
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  UI = computeUIScale();
}
window.addEventListener("resize", resize);
resize();

// devicePixelRatio puede cambiar sin disparar "resize" (cambiar el zoom del
// navegador, o arrastrar la ventana a un monitor con otro factor de escala).
// Un listener de matchMedia que se reinstala a sí mismo detecta esos casos
// de forma robusta y evita que el canvas quede renderizado a una resolución
// obsoleta (borroso) tras el cambio.
function watchDPR() {
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const onChange = () => { resize(); watchDPR(); };
  if (mq.addEventListener) mq.addEventListener("change", onChange, { once: true });
  else mq.addListener(onChange);
}
watchDPR();

// ---------- Paleta ----------
const COL = {
  bg0: "#03050c",
  bg1: "#050a16",
  player: "#8ff5e0",
  playerCore: "#e8fffa",
  moteSmall: "#6fe8ff",
  moteBig: "#c9a8ff",
  moteRare: "#eafff5",
  shadow: "#7a3fe0",
  shadowCore: "#1a0630",
  warn: "#ff6a5e",
  gold: "#ffd27a",
};

// ---------- Biomas ----------
// Un solo universo continuo. El bioma 0 es "casa" (paleta actual) y siempre
// está desbloqueado; los demás se desbloquean al superar niveles de Niveles
// (Settings.getUnlockedLevel()). El jugador/gota nunca cambia de color —
// sólo el entorno (fondo, motas, zarcillos) cambia al llegar a uno nuevo.
const BIOMES = [
  {
    id: 0, name: "Abismo", unlockLevel: 0, worldPos: { x: 0, y: 0 },
    bg0: "#03050c", bg1: "#050a16",
    moteSmall: "#6fe8ff", moteBig: "#c9a8ff", moteRare: "#eafff5",
    shadow: "#7a3fe0", shadowCore: "#1a0630",
    auraA: "#8ff5e0", auraB: "#7a3fe0", cloudSeed: 0.35,
  },
  {
    id: 1, name: "Grieta violeta", unlockLevel: 2, worldPos: { x: 2200, y: -1250 },
    bg0: "#0a0414", bg1: "#170826",
    moteSmall: "#c98bff", moteBig: "#ff8bd6", moteRare: "#f6e8ff",
    shadow: "#3f1fa0", shadowCore: "#120428",
    auraA: "#c98bff", auraB: "#3f1fa0", cloudSeed: 2.15,
  },
  {
    id: 2, name: "Umbral cian", unlockLevel: 4, worldPos: { x: -1900, y: 1500 },
    bg0: "#020a0c", bg1: "#031418",
    moteSmall: "#bdfff0", moteBig: "#7fe0ff", moteRare: "#ffffff",
    shadow: "#2f7a86", shadowCore: "#04181a",
    auraA: "#bdfff0", auraB: "#2f7a86", cloudSeed: 4.4,
  },
];
function applyBiome(id) {
  const b = BIOMES[id];
  COL.bg0 = b.bg0; COL.bg1 = b.bg1;
  COL.moteSmall = b.moteSmall; COL.moteBig = b.moteBig; COL.moteRare = b.moteRare;
  COL.shadow = b.shadow; COL.shadowCore = b.shadowCore;
  state.biome = id;
}

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

  // brillo suave que sigue al cursor dentro del botón (sólo con hover)
  if (hover && !disabled) {
    ctx.save();
    ctx.beginPath();
    roundedRectPath(x, y, w, h, r);
    ctx.clip();
    const g = ctx.createRadialGradient(input.px, input.py, 0, input.px, input.py, w * 0.75);
    g.addColorStop(0, "rgba(210,255,245,0.22)");
    g.addColorStop(1, "rgba(210,255,245,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  ctx.beginPath();
  roundedRectPath(x, y, w, h, r);
  ctx.lineWidth = 1.4 * UI;
  ctx.strokeStyle = disabled ? "rgba(170,190,190,0.14)" : `rgba(143,245,224,${hover ? 0.8 : 0.38})`;
  if (hover && !disabled) { ctx.shadowColor = COL.player; ctx.shadowBlur = 18 * UI; }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = opts.font || `600 ${Math.round(15 * UI)}px system-ui, sans-serif`;
  ctx.fillStyle = disabled ? "rgba(180,200,200,0.32)" : "rgba(235,255,250,0.94)";
  ctx.fillText(label, cx, cy + 1);
  ctx.restore();
  if (!disabled) addHotspot(x, y, w, h, opts.action);
  return hover;
}

function drawTextLink(cx, cy, label, action) {
  ctx.save();
  ctx.font = `${Math.round(13 * UI)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width + 44 * UI;
  const hh = 32 * UI;
  const hover = isHover(cx - w / 2, cy - hh / 2, w, hh);
  ctx.fillStyle = hover ? "rgba(230,250,245,0.95)" : "rgba(190,220,220,0.55)";
  if (hover) { ctx.shadowColor = COL.player; ctx.shadowBlur = 10 * UI; }
  ctx.fillText(label, cx, cy);
  ctx.restore();
  addHotspot(cx - w / 2, cy - hh / 2, w, hh, action);
}

function drawSegmented(cx, cy, labels, selectedIndex, onSelect) {
  const w = 92 * UI, h = 34 * UI, gap = 8 * UI;
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
    ctx.lineWidth = 1.3 * UI;
    ctx.strokeStyle = selected ? COL.player : "rgba(200,220,220,0.25)";
    if (selected) { ctx.shadowColor = COL.player; ctx.shadowBlur = 12 * UI; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(13 * UI)}px system-ui, sans-serif`;
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
  w *= UI;
  const x = cx - w / 2;
  const trackH = 4 * UI;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `${Math.round(12 * UI)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(210,230,230,0.6)";
  ctx.fillText(label, cx, cy - 22 * UI);
  ctx.beginPath();
  roundedRectPath(x, cy - trackH / 2, w, trackH, trackH / 2);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.beginPath();
  roundedRectPath(x, cy - trackH / 2, Math.max(trackH, w * value01), trackH, trackH / 2);
  ctx.fillStyle = COL.player;
  ctx.shadowColor = COL.player;
  ctx.shadowBlur = 8 * UI;
  ctx.fill();
  ctx.shadowBlur = 0;
  const hx = x + w * value01;
  const near = dist(input.px, input.py, hx, cy) < 16 * UI || (sliderDrag && sliderDrag.label === label);
  ctx.beginPath();
  ctx.arc(hx, cy, (near ? 9 : 7) * UI, 0, TAU);
  ctx.fillStyle = "#eafffb";
  ctx.shadowColor = COL.player;
  ctx.shadowBlur = (near ? 16 : 8) * UI;
  ctx.fill();
  ctx.restore();
  addHotspot(x - 12 * UI, cy - 20 * UI, w + 24 * UI, 40 * UI, () => {
    sliderDrag = { label, x, w, onChange };
    onChange(clamp((input.px - x) / w, 0, 1));
  });
}

function drawFullscreenIcon() {
  const size = 36 * UI, pad = 14 * UI;
  const x = W - pad - size, y = pad;
  const hover = isHover(x, y, size, size);
  const m = 10 * UI, o = 4 * UI;
  ctx.save();
  if (hover) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.72, 0, TAU);
    ctx.fillStyle = "rgba(143,245,224,0.1)";
    ctx.fill();
  }
  ctx.globalAlpha = hover ? 0.95 : 0.45;
  ctx.strokeStyle = "#cfeee6";
  ctx.lineWidth = 2.2 * UI;
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

// El CSS oculta el cursor del sistema en todo momento (cursor: none) porque
// durante la partida la propia gota hace de puntero. Pero en cualquier otra
// pantalla (menú, ajustes, niveles, pausa) eso dejaría al jugador sin forma
// de ver dónde está apuntando — así que dibujamos un cursor propio, acorde
// a la dirección de arte, que además reacciona al pasar sobre un botón.
function drawCursor() {
  if (!input.hasPointer) return;
  const x = input.px, y = input.py;
  const hovering = !!hitTest(x, y);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, (hovering ? 8 : 5) * UI, 0, TAU);
  ctx.strokeStyle = "rgba(232,255,250,0.85)";
  ctx.lineWidth = 1.4 * UI;
  ctx.shadowColor = COL.player;
  ctx.shadowBlur = (hovering ? 12 : 5) * UI;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 1.5 * UI, 0, TAU);
  ctx.fillStyle = "rgba(232,255,250,0.95)";
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.restore();
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
const ZOOM_MIN = 0.05;
const BIOME_ARRIVAL_RADIUS = 520;
const camera = {
  shakeMag: 0,
  x: 0, y: 0,
  driftT: 0,
  zoom: 1,
  zoomTarget: 1,
  update(dt) {
    this.driftT += dt;
    this.shakeMag *= Math.pow(0.001, dt);
    if (this.shakeMag < 0.01) this.shakeMag = 0;
    const ang = this.driftT * 0.6;
    this.x = Math.sin(ang) * 3 + (Math.random() - 0.5) * this.shakeMag;
    this.y = Math.cos(ang * 0.8) * 3 + (Math.random() - 0.5) * this.shakeMag;
    this.zoom = lerp(this.zoom, this.zoomTarget, 1 - Math.pow(0.02, dt));
  },
  kick(mag) { this.shakeMag = Math.max(this.shakeMag, mag); },
  // Cuánto se centra la cámara en el jugador en vez de quedarse fija —
  // 0 en juego normal (cámara fija centrada, como pide el diseño base),
  // sube suavemente conforme se aleja para viajar entre biomas.
  pan() {
    const followT = clamp((1 - this.zoom) * 1.8, 0, 1);
    return { x: (player.x - W / 2) * followT, y: (player.y - H / 2) * followT };
  },
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
  draw(lightGlow, sceneAlpha = 1) {
    ctx.save();
    for (const it of this.items) {
      ctx.globalAlpha = sceneAlpha * it.a * (0.5 + lightGlow * 0.5);
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
  draw(lightGlow, sceneAlpha = 1) {
    ctx.save();
    for (const it of this.items) {
      ctx.globalAlpha = sceneAlpha * it.a * (0.4 + lightGlow * 0.6);
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

// ---------- Aura de Chill: respaldo ambiental muy abstracto y de bajísimo
// contraste, pensado para sesiones largas y relajadas. Sólo se activa en
// modo Chill; deriva muy lento, respira en alpha, nunca usa el dorado
// reservado a la floración y jamás compite visualmente con motas/zarcillos.
class ChillAura {
  constructor(count) {
    this.items = Array.from({ length: count }, () => ({
      x: rand(0, W), y: rand(0, H), r: rand(260, 460),
      vx: rand(-1.1, 1.1), vy: rand(-1.1, 1.1),
      huePhase: rand(0, TAU), hueFreq: rand(0.006, 0.013),
      phase: rand(0, TAU), freq: rand(0.045, 0.085),
      rPhase: rand(0, TAU), rFreq: rand(0.02, 0.04),
      baseA: rand(0.035, 0.06),
    }));
  }
  update(dt) {
    for (const it of this.items) {
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (it.x < -it.r) it.x = W + it.r;
      if (it.x > W + it.r) it.x = -it.r;
      if (it.y < -it.r) it.y = H + it.r;
      if (it.y > H + it.r) it.y = -it.r;
    }
  }
  draw(t, sceneAlpha = 1) {
    ctx.save();
    for (const it of this.items) {
      // Deriva de color muy lenta (ciclo de varios minutos) entre los dos
      // tonos fríos de la paleta, para que el aura se sienta viva sin que
      // el cambio en sí sea perceptible instante a instante.
      const huT = 0.5 + Math.sin(t * it.hueFreq + it.huePhase) * 0.5;
      const col = lerpColor(COL.player, COL.shadow, huT);
      const breathe = 0.6 + Math.sin(t * it.freq + it.phase) * 0.4;
      const rBreathe = 1 + Math.sin(t * it.rFreq + it.rPhase) * 0.15;
      ctx.globalAlpha = sceneAlpha * it.baseA * breathe;
      const R = it.r * rBreathe;
      const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, R);
      g.addColorStop(0, col);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(it.x, it.y, R, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
const chillAura = new ChillAura(4);

// ---------- Corrientes invisibles ----------
// Dos remolinos lentos que derivan por la escena y empujan tangencialmente
// (nunca hacia/desde su centro, siempre "alrededor") a quien esté cerca.
// No se dibujan: son textura del espacio, no un peligro — la intención es
// que el agua deje de sentirse como un vacío uniforme sin romper el control
// directo del jugador (el empuje es mucho más débil sobre la gota que
// sobre las motas).
class Current {
  constructor() {
    this.baseX = rand(W * 0.3, W * 0.7);
    this.baseY = rand(H * 0.3, H * 0.7);
    this.ampX = rand(W * 0.22, W * 0.34);
    this.ampY = rand(H * 0.22, H * 0.34);
    this.freqX = rand(0.02, 0.035);
    this.freqY = rand(0.018, 0.03);
    this.phaseX = rand(0, TAU);
    this.phaseY = rand(0, TAU);
    this.radius = rand(220, 320);
    this.strength = rand(26, 42) * (Math.random() < 0.5 ? 1 : -1);
    this.cx = this.baseX;
    this.cy = this.baseY;
  }
  update(t) {
    this.cx = this.baseX + Math.sin(t * this.freqX + this.phaseX) * this.ampX;
    this.cy = this.baseY + Math.sin(t * this.freqY + this.phaseY) * this.ampY;
  }
  forceAt(x, y) {
    const dx = x - this.cx, dy = y - this.cy;
    const d = Math.hypot(dx, dy);
    if (d > this.radius || d < 1) return { fx: 0, fy: 0 };
    const mag = this.strength * (1 - d / this.radius);
    return { fx: (-dy / d) * mag, fy: (dx / d) * mag };
  }
}
function currentForceAt(x, y) {
  let fx = 0, fy = 0;
  if (!state.currents) return { fx, fy };
  for (const c of state.currents) {
    const f = c.forceAt(x, y);
    fx += f.fx; fy += f.fy;
  }
  return { fx, fy };
}

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
  draw(sceneAlpha = 1) {
    ctx.save();
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      if (p.type === "ring") {
        const r = lerp(p.r, p.r1, p.t / p.life);
        ctx.globalAlpha = sceneAlpha * k * 0.6;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
      } else if (p.type === "dot") {
        ctx.globalAlpha = sceneAlpha * k;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * k, 0, TAU);
        ctx.fill();
      } else if (p.type === "ash") {
        ctx.globalAlpha = sceneAlpha * k * 0.8;
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
    // El zoom de cámara (viaje entre biomas) reinterpreta el objetivo del
    // puntero/teclado en espacio local: a menor zoom, el mismo gesto cubre
    // mucho más terreno — así "alejar la cámara" se siente como acercarse
    // a viajar de verdad, no sólo mirar más lejos. zoomForTarget nunca baja
    // de 0.22 para que la velocidad de la gota no se dispare sin control
    // incluso con la cámara al mínimo de zoom.
    const zoomForTarget = Math.max(camera.zoom, 0.22);
    const pan = camera.pan();
    let tx, ty;
    if (kdir) { const d = (300 * sens) / zoomForTarget; tx = this.x + kdir.x * d; ty = this.y + kdir.y * d; }
    else {
      tx = pan.x + (input.px - W / 2) / zoomForTarget + W / 2;
      ty = pan.y + (input.py - H / 2) / zoomForTarget + H / 2;
    }

    const k = 34 * sens, damp = 8.2 * Math.sqrt(sens);
    const ax = (tx - this.x) * k - this.vx * damp;
    const ay = (ty - this.y) * k - this.vy * damp;
    const cur = currentForceAt(this.x, this.y);
    this.vx += (ax + cur.fx * 0.5) * dt; this.vy += (ay + cur.fy * 0.5) * dt;
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
    const sx = this.stretch;
    const sy = 1 / Math.sqrt(this.stretch);
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
    // arriveAtBiome reemplaza las motas durante update() y draw() ocurre en
    // ese mismo frame. Debe existir antes del primer Mote.update para que el
    // radio del gradiente nunca reciba NaN y detenga todo el canvas.
    this.flicker = 1;
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
    this.rare = !this.big && Math.random() < 0.025;
    // En Chill la abundancia crece muy levemente con cada floración, como
    // sensación de progreso a largo plazo sin meter fracaso ni presión.
    const growth = state.runCfg && state.runCfg.flavor === "chill" ? Math.min(state.chillBlooms, 8) : 0;
    const g = 1 + growth * 0.02;
    if (this.rare) { this.r = rand(6, 7); this.value = rand(20, 26) * g; }
    else { this.r = (this.big ? rand(9, 11) : rand(4, 5.5)) * g; this.value = (this.big ? rand(10, 14) : rand(2.8, 4)) * g; }
    this.phase = rand(0, TAU);
  }
  update(dt, t, px, py) {
    if (this.rare && px != null) {
      const d = dist(this.x, this.y, px, py);
      if (d < 150) {
        const away = Math.atan2(this.y - py, this.x - px);
        const flee = (1 - d / 150) * 70;
        this.vx = lerp(this.vx, Math.cos(away) * (60 + flee), 0.06);
        this.vy = lerp(this.vy, Math.sin(away) * (60 + flee), 0.06);
      }
    }
    const cur = currentForceAt(this.x, this.y);
    this.x += (this.vx + cur.fx) * dt;
    this.y += (this.vy + cur.fy) * dt;
    this.flicker = 0.75 + Math.sin(t * (this.rare ? 6 : 3) + this.phase) * 0.25;
    if (this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) this.respawn();
  }
  draw(sceneAlpha = 1) {
    const R = this.r * this.flicker;
    const color = this.rare ? COL.moteRare : this.big ? COL.moteBig : COL.moteSmall;
    ctx.save();
    ctx.globalAlpha = sceneAlpha;
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

    if (this.rare) {
      // Anillo giratorio: la marca visual de que esta mota es especial y huye.
      ctx.beginPath();
      ctx.strokeStyle = "rgba(234,255,245,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -this.phase * 40 - performance.now() * 0.02;
      ctx.arc(this.x, this.y, R * 1.7, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
    this.spawnX = this.x;
    this.spawnY = this.y;
    this.spdPhase = rand(0, TAU);
    this.spdFreq = rand(0.12, 0.3);
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

    // Pulso de velocidad: nunca avanza a ritmo constante, así el jugador no
    // puede memorizar un timing fijo para esquivarlo.
    const sPulse = 1 + Math.sin(t * this.spdFreq + this.spdPhase) * 0.35;
    this.x += this.vx * dt * sPulse;
    this.y += this.vy * dt * sPulse;
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
  draw(sceneAlpha = 1) {
    if (this.alpha <= 0.01) return;
    const pts = this.points;
    if (pts.length < 2) return;

    if (this.phaseState === "in") {
      // Destello de aviso en el punto de aparición: sube la anticipación
      // sin adelantar información que el jugador no tendría en pantalla.
      const tele = Math.sin(this.alpha * Math.PI);
      ctx.save();
      ctx.globalAlpha = sceneAlpha * tele * 0.7;
      const g = ctx.createRadialGradient(this.spawnX, this.spawnY, 0, this.spawnX, this.spawnY, 60 + tele * 40);
      g.addColorStop(0, COL.shadow + "cc");
      g.addColorStop(1, COL.shadow + "00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.spawnX, this.spawnY, 60 + tele * 40, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Silueta ahusada: base gruesa, punta fina pero nunca tan fina/transparente
    // que se lea como "desaparecida". La normal en cada punto se calcula con
    // un mínimo de longitud de tangente (MIN_TANGENT) para que dos puntos
    // casi coincidentes (curvas muy cerradas) nunca produzcan un vector
    // normal desbocado que rompa la silueta durante un frame.
    const baseW = 20, tipW = 5;
    const MIN_TANGENT = 6;
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const tx = next.x - prev.x, ty = next.y - prev.y;
      const tl = Math.max(Math.hypot(tx, ty), MIN_TANGENT);
      const nx = -ty / tl, ny = tx / tl;
      const w = lerp(baseW, tipW, i / (pts.length - 1)) / 2;
      left.push({ x: p.x + nx * w, y: p.y + ny * w });
      right.push({ x: p.x - nx * w, y: p.y - ny * w });
    }
    ctx.save();
    ctx.globalAlpha = sceneAlpha * this.alpha;

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    grad.addColorStop(0, COL.shadow + "e6");
    grad.addColorStop(1, COL.shadow + "40");
    ctx.fillStyle = grad;
    ctx.shadowColor = COL.shadow;
    ctx.shadowBlur = 22;
    ctx.fill();

    // filo luminoso sutil: ayuda a que la silueta se distinga con claridad
    // incluso superpuesta con otro zarcillo o con el fondo más oscuro.
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(222,196,255,0.4)";
    ctx.stroke();

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
    const pulse = 5 + Math.sin(this.lastT * 3 + this.phase) * 1.4;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, pulse, 0, TAU);
    ctx.fillStyle = "rgba(201,168,255,0.55)";
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

// Cada floración en Chill exige más que la anterior (50, 150, 300, 600,
// 1000...) para que volver a florecer se sienta como una meta creciente en
// vez de un bucle repetitivo — más allá de la lista, sigue escalando.
const CHILL_BLOOM_THRESHOLDS = [50, 150, 300, 600, 1000];
function chillLightMax(blooms) {
  if (blooms < CHILL_BLOOM_THRESHOLDS.length) return CHILL_BLOOM_THRESHOLDS[blooms];
  let v = CHILL_BLOOM_THRESHOLDS[CHILL_BLOOM_THRESHOLDS.length - 1];
  for (let i = CHILL_BLOOM_THRESHOLDS.length; i <= blooms; i++) v = Math.round(v * 1.6);
  return v;
}

function buildRunCfg(flavor, levelIndex) {
  if (flavor === "chill") {
    const density = Settings.get("chillTendrils");
    const map = {
      none: { tendrilBase: 0, tendrilExtra: 0 },
      few: { tendrilBase: 0, tendrilExtra: 2 },
      normal: { tendrilBase: 1, tendrilExtra: 3 },
    };
    const d = map[density] || map.few;
    return { flavor, lightMax: chillLightMax(0), decay: 0, tendrilBase: d.tendrilBase, tendrilExtra: d.tendrilExtra, speedMul: 0.85, timeLimit: null, noLose: true, loopBloom: true, bloomDuration: 0.9 };
  }
  if (flavor === "levels") {
    const lvl = LEVELS[levelIndex];
    return { flavor, lightMax: lvl.target, decay: 0.8, tendrilBase: lvl.tendrilBase, tendrilExtra: lvl.tendrilExtra, speedMul: lvl.speedMul, timeLimit: lvl.time, noLose: false, loopBloom: false, levelIndex, bloomDuration: 2.4 };
  }
  return { flavor: "classic", lightMax: 100, decay: 0.8, tendrilBase: 1, tendrilExtra: 4, speedMul: 1, timeLimit: null, noLose: false, loopBloom: false, bloomDuration: 2.4 };
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
  currents: [],
  bloomT: 0,
  fadeT: 0,
  flash: 0,
  canRestart: false,
  loseReason: null,
  tendrilApplied: null,
  tendrilCooldown: 0,
  t: 0,
  streak: 0,
  streakT: 0,
  chillBlooms: 0,
  biome: 0,
  travelLatch: false,
  arrivalLockT: 0,
};

const COMBO_WINDOW = 2.2;
const COMBO_STEP = 0.05;
const COMBO_MAX_STACK = 10;

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
  state.streak = 0;
  state.streakT = 0;
  state.chillBlooms = 0;
  state.motes = [];
  for (let i = 0; i < 7; i++) state.motes.push(new Mote(false));
  state.motes.push(new Mote(true));
  state.tendrils = [];
  state.tendrilApplied = null;
  state.tendrilCooldown = 0;
  state.currents = [new Current(), new Current()];
  state.travelLatch = false;
  state.arrivalLockT = 0;
  camera.zoom = 1;
  camera.zoomTarget = 1;
  applyBiome(0);
}

function arriveAtBiome(id) {
  applyBiome(id);
  player.reset();
  state.motes = [];
  for (let i = 0; i < 7; i++) state.motes.push(new Mote(false));
  state.motes.push(new Mote(true));
  state.tendrils = [];
  state.tendrilApplied = null;
  state.tendrilCooldown = 0;
  state.currents = [new Current(), new Current()];
  state.travelLatch = false;
  state.arrivalLockT = 0.8;
  camera.zoomTarget = 1;
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
  player.update(dt);

  // Histéresis de viaje: por debajo de zoom 0.42 se considera "viajando"
  // (se congela decaimiento/colisiones/zarcillos — explorar el universo
  // nunca debe costarte la partida), y sólo vuelve a false por encima de
  // 0.5, para que no parpadee cerca del umbral.
  if (state.travelLatch && camera.zoom > 0.5) state.travelLatch = false;
  else if (!state.travelLatch && camera.zoom < 0.42) state.travelLatch = true;

  if (state.travelLatch) {
    if (state.arrivalLockT > 0) state.arrivalLockT -= dt;
    else {
      const curAbsX = BIOMES[state.biome].worldPos.x + (player.x - W / 2);
      const curAbsY = BIOMES[state.biome].worldPos.y + (player.y - H / 2);
      for (const b of BIOMES) {
        if (b.id === state.biome) continue;
        if (Settings.getUnlockedLevel() < b.unlockLevel) continue;
        // La llegada coincide con entrar en la mancha visible, no con acertar
        // un punto diminuto en su centro. Esto mantiene el viaje relajado.
        if (dist(curAbsX, curAbsY, b.worldPos.x, b.worldPos.y) < BIOME_ARRIVAL_RADIUS) { arriveAtBiome(b.id); break; }
      }
    }
    return;
  }
  if (state.arrivalLockT > 0) state.arrivalLockT = Math.max(0, state.arrivalLockT - dt);

  state.time += dt;
  if (cfg.timeLimit != null) state.timeLeft = Math.max(0, state.timeLeft - dt);

  const lr = lightRatio();
  state.light = clamp(state.light - cfg.decay * dt * (0.6 + lr * 0.8), 0, cfg.lightMax);

  state.streakT += dt;
  if (state.streakT > COMBO_WINDOW) state.streak = 0;

  for (const m of state.motes) {
    m.update(dt, state.t, player.x, player.y);
    const R = 20 + lr * 10;
    if (dist(player.x, player.y, m.x, m.y) < R + m.r) {
      state.streak += 1;
      state.streakT = 0;
      const comboMul = 1 + Math.min(state.streak - 1, COMBO_MAX_STACK) * COMBO_STEP;
      state.light = clamp(state.light + m.value * comboMul, 0, cfg.lightMax);
      state.motesEaten++;
      const color = m.rare ? COL.moteRare : m.big ? COL.moteBig : COL.moteSmall;
      player.pop(m.rare ? 0.8 : m.big ? 1.0 : 0.5);
      particles.ring(m.x, m.y, color, m.big || m.rare ? 8 : 6, m.big || m.rare ? 100 : 55, m.big || m.rare ? 0.8 : 0.45);
      particles.burst(m.x, m.y, color, m.big || m.rare ? 22 : 9, m.big || m.rare ? 170 : 110, 0.6);
      Audio2.chime(clamp(m.value / 13, 0, 1), m.rare ? 3 : m.big ? 2 : 1);
      m.respawn();
    }
  }

  // Zumbido posicional de la mota rara: sube de volumen cuanto más cerca
  // esté, con un ligero pulso propio, para que perseguirla se sienta como
  // una búsqueda guiada por oído y no sólo un hallazgo visual casual.
  let rareDist = Infinity;
  for (const m of state.motes) if (m.rare) rareDist = Math.min(rareDist, dist(player.x, player.y, m.x, m.y));
  const rareT = clamp(1 - rareDist / 420, 0, 1);
  const rarePulse = 0.75 + Math.sin(state.t * 3.4) * 0.25;
  Audio2.rareHum(rareT * rareT * rarePulse);

  // El número de zarcillos objetivo escala con la Luz, pero se aplica con
  // histéresis: un cambio de umbral (por ejemplo, tras recibir un golpe)
  // no reduce ni aumenta la población instantáneamente, sino que espera un
  // tiempo mínimo entre ajustes. Sin esto, una lr que fluctúa cerca de un
  // umbral podía hacer que un zarcillo se marcara para desvanecerse y que,
  // acto seguido, se generara uno nuevo — un parpadeo de "aparece/desaparece"
  // que se sentía como un bug aunque cada transición individual ya usara fundido.
  const rawDesired = cfg.tendrilBase + Math.floor(lr * cfg.tendrilExtra);
  if (state.tendrilApplied === null) state.tendrilApplied = rawDesired;
  state.tendrilCooldown = Math.max(0, state.tendrilCooldown - dt);
  if (rawDesired !== state.tendrilApplied && state.tendrilCooldown <= 0) {
    state.tendrilApplied = rawDesired;
    state.tendrilCooldown = 1.4;
  }
  const desired = state.tendrilApplied;
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
        state.streak = 0;
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
  if (state.bloomT > state.runCfg.bloomDuration) {
    if (state.runCfg.loopBloom) {
      state.chillBlooms++;
      if (state.runCfg.flavor === "chill") state.runCfg.lightMax = chillLightMax(state.chillBlooms);
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
  if (state.runCfg && state.runCfg.flavor === "chill") chillAura.update(dt);
  state.currents.forEach((c) => c.update(state.t));
  particles.update(dt);

  if (state.mode === "playing") updatePlaying(dt);
  else {
    Audio2.rareHum(0);
    if (state.mode === "blooming") updateBlooming(dt);
  }
  if (state.mode === "lose") {
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

// Vista de mapa: cada zona se condensa en una nube de color sin bordes ni
// iconos. Las formas se construyen con lóbulos superpuestos y deterministas;
// así parecen materia suspendida, no un círculo, panel o miniatura del juego.
function drawBiomeCurrent(fromX, fromY, toX, toY, color, alpha, t, seed) {
  if (alpha <= 0.001) return;
  const dx = toX - fromX, dy = toY - fromY;
  const d = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / d, ny = dx / d;
  const sway = Math.sin(t * 0.055 + seed) * 120;
  const c1x = fromX + dx * 0.34 + nx * (180 + sway);
  const c1y = fromY + dy * 0.34 + ny * (180 + sway);
  const c2x = fromX + dx * 0.7 - nx * (130 - sway * 0.5);
  const c2y = fromY + dy * 0.7 - ny * (130 - sway * 0.5);
  const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
  gradient.addColorStop(0, color + "00");
  gradient.addColorStop(0.2, color + "55");
  gradient.addColorStop(0.8, color + "70");
  gradient.addColorStop(1, color + "00");

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = gradient;
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha * 0.22;
  ctx.lineWidth = 90;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, toX, toY);
  ctx.stroke();

  for (let i = -1; i <= 1; i++) {
    ctx.globalAlpha = alpha * (i === 0 ? 0.62 : 0.28);
    ctx.lineWidth = i === 0 ? 11 : 5;
    ctx.beginPath();
    ctx.moveTo(fromX + nx * i * 42, fromY + ny * i * 42);
    ctx.bezierCurveTo(
      c1x + nx * i * 64,
      c1y + ny * i * 64,
      c2x + nx * i * 48,
      c2y + ny * i * 48,
      toX + nx * i * 22,
      toY + ny * i * 22
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawBiomeCloud(biome, x, y, alpha, t, locked = false, current = false) {
  if (alpha <= 0.001) return;
  const breathe = 1 + Math.sin(t * 0.16 + biome.cloudSeed) * 0.045;
  const presence = locked ? 0.46 : current ? 1.05 : 1;
  const lobes = [
    { x: 0, y: 0, rx: 760, ry: 500, rot: -0.18, color: biome.auraB, a: 0.74 },
    { x: -275, y: 60, rx: 470, ry: 315, rot: 0.42, color: biome.auraA, a: 0.66 },
    { x: 285, y: -85, rx: 440, ry: 285, rot: -0.55, color: biome.auraA, a: 0.56 },
    { x: 80, y: 220, rx: 410, ry: 250, rot: 0.18, color: biome.auraB, a: 0.48 },
    { x: -40, y: -215, rx: 350, ry: 205, rot: 0.72, color: biome.auraA, a: 0.38 },
  ];

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Halo exterior muy tenue: hace legible cada destino incluso en el zoom
  // mínimo, sin convertirlo en un marcador o una figura geométrica dura.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(900 * breathe, 610 * breathe);
  const halo = ctx.createRadialGradient(0, 0, 0.15, 0, 0, 1);
  halo.addColorStop(0, biome.auraA + (locked ? "24" : "48"));
  halo.addColorStop(0.55, biome.auraB + (locked ? "16" : "32"));
  halo.addColorStop(1, biome.auraB + "00");
  ctx.globalAlpha = alpha * presence;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < lobes.length; i++) {
    const lobe = lobes[i];
    const driftX = Math.sin(t * 0.035 + biome.cloudSeed + i * 1.7) * 22;
    const driftY = Math.cos(t * 0.03 + biome.cloudSeed * 1.3 + i) * 18;
    ctx.save();
    ctx.translate(x + lobe.x + driftX, y + lobe.y + driftY);
    ctx.rotate(lobe.rot + Math.sin(t * 0.012 + i) * 0.025);
    ctx.scale(lobe.rx * breathe, lobe.ry * breathe);
    const g = ctx.createRadialGradient(-0.14, -0.12, 0, 0, 0, 1);
    g.addColorStop(0, lobe.color + "9c");
    g.addColorStop(0.42, lobe.color + "52");
    g.addColorStop(0.76, lobe.color + "1f");
    g.addColorStop(1, lobe.color + "00");
    ctx.globalAlpha = alpha * presence * lobe.a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Contornos respirando, casi imperceptibles en reposo. Dan riqueza a la
  // nube sin introducir estrellas, iconos ni movimiento nervioso.
  for (let i = 0; i < 3; i++) {
    const wave = 1 + ((t * 0.025 + biome.cloudSeed * 0.1 + i / 3) % 1) * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.18 + i * 0.09);
    ctx.scale(720 * wave, 455 * wave);
    ctx.globalAlpha = alpha * presence * (1.5 - wave) * 0.16;
    ctx.strokeStyle = i % 2 ? biome.auraA : biome.auraB;
    ctx.lineWidth = 7 / (720 * wave);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawBiomeMapStatus(alpha) {
  if (alpha <= 0.01 || state.mode !== "playing") return;
  const unlocked = BIOMES.filter((b) => Settings.getUnlockedLevel() >= b.unlockLevel).length;
  const next = BIOMES.find((b) => Settings.getUnlockedLevel() < b.unlockLevel);
  const y = H - 108 * UI;
  ctx.save();
  ctx.textAlign = "center";
  ctx.globalAlpha = alpha;
  ctx.font = fnt(11, "600");
  ctx.fillStyle = "rgba(224,246,246,0.72)";
  ctx.shadowColor = "rgba(120,220,210,0.35)";
  ctx.shadowBlur = 12;
  ctx.fillText(`${unlocked} / ${BIOMES.length} BIOMAS DESPIERTOS`, W / 2, y);
  if (next) {
    ctx.shadowBlur = 0;
    ctx.font = fnt(10);
    ctx.fillStyle = "rgba(190,212,220,0.48)";
    ctx.fillText(`el próximo despierta al completar el nivel ${next.unlockLevel}`, W / 2, y + 18 * UI);
  }
  ctx.restore();
}

function drawMeter(lr) {
  const cx = W / 2, cy = 34 * UI;
  const r = 58 * UI;
  const start = Math.PI * 0.16, end = Math.PI * 0.84;
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 4 * UI;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + (end - start) * lr);
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, COL.player);
  grad.addColorStop(1, lr > 0.92 ? COL.gold : COL.moteBig);
  ctx.strokeStyle = grad;
  ctx.shadowColor = COL.player;
  ctx.shadowBlur = 10 * UI;
  ctx.lineWidth = 4 * UI;
  ctx.stroke();

  // remates: un destello suave en cada extremo del arco para que se lea
  // como una pieza de joyería terminada, no como una barra de progreso cortada.
  for (const a of [start, end]) {
    const ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.2 * UI, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = 0;
    ctx.fill();
  }
  ctx.restore();
}

// Helper para construir cadenas de fuente ya escaladas por UI, evitando
// repetir Math.round(N * UI) en cada pantalla.
function fnt(px, weight) {
  return `${weight ? weight + " " : ""}${Math.round(px * UI)}px system-ui, sans-serif`;
}

function centerText(lines, y0) {
  ctx.save();
  ctx.textAlign = "center";
  let y = y0;
  for (const line of lines) {
    ctx.font = line.font || `${Math.round(16 * UI)}px system-ui, sans-serif`;
    ctx.fillStyle = line.color || "rgba(230,245,250,0.85)";
    if (line.glow) { ctx.shadowColor = line.glow; ctx.shadowBlur = (line.blur || 16) * UI; }
    else ctx.shadowBlur = 0;
    ctx.globalAlpha = line.alpha === undefined ? 1 : line.alpha;
    ctx.fillText(line.text, W / 2, y);
    y += (line.gap === undefined ? 30 : line.gap) * UI;
  }
  ctx.restore();
}

function drawMenuScreen() {
  const bob = Math.sin(state.t * 1.4) * 4;
  centerText([
    { text: "D E R I V A", font: fnt(52, "600"), color: "#eafffb", glow: COL.player, blur: 30, gap: 40 },
    { text: "una gota de luz en el abismo", font: fnt(15), color: "rgba(220,240,240,0.5)", gap: 0 },
  ], H * 0.2 + bob);

  const btnW = 260 * UI, btnH = 52 * UI, gapY = 66 * UI;
  const cy0 = H * 0.5;
  drawButton(W / 2, cy0, btnW, btnH, "DERIVA", { action: () => startRun("classic", 0), font: fnt(17, "600") });
  drawButton(W / 2, cy0 + gapY, btnW, btnH, "CHILL", { action: () => startRun("chill", 0), font: fnt(17, "600") });
  drawButton(W / 2, cy0 + gapY * 2, btnW, btnH, "NIVELES", { action: () => { state.mode = "levelSelect"; }, font: fnt(17, "600") });

  drawTextLink(W / 2, cy0 + gapY * 2 + 58 * UI, "ajustes", () => { state.mode = "settings"; });
}

function drawSettingsScreen() {
  centerText([{ text: "AJUSTES", font: fnt(30, "600"), color: "#eafffb", glow: COL.player, blur: 20 }], H * 0.2);

  const sens = Settings.get("sensitivity");
  drawSlider(W / 2, H * 0.38, 280, (sens - 0.5) / 1.5, (v) => Settings.set("sensitivity", +(0.5 + v * 1.5).toFixed(2)), `sensibilidad de control (ratón, wasd y flechas) · ${sens.toFixed(2)}x`);

  centerText([{ text: "zarcillos en modo chill", font: fnt(12), color: "rgba(210,230,230,0.55)" }], H * 0.52);
  const density = Settings.get("chillTendrils");
  const opts = ["none", "few", "normal"];
  drawSegmented(W / 2, H * 0.57, ["ninguno", "pocos", "normal"], opts.indexOf(density), (i) => Settings.set("chillTendrils", opts[i]));

  drawTextLink(W / 2, H * 0.74, "atrás", () => { state.mode = "menu"; });
}

function drawLevelSelectScreen() {
  centerText([{ text: "NIVELES", font: fnt(30, "600"), color: "#eafffb", glow: COL.player, blur: 20 }], H * 0.16);
  const unlocked = Settings.getUnlockedLevel();
  const startY = H * 0.3, gap = 58 * UI;
  const btnW = 240 * UI, btnH = 46 * UI;
  LEVELS.forEach((lvl, i) => {
    const locked = i > unlocked;
    const y = startY + i * gap;
    drawButton(W / 2, y, btnW, btnH, locked ? "🔒 " + lvl.name : lvl.name, {
      action: locked ? null : () => startRun("levels", i),
      disabled: locked,
      font: fnt(15, "600"),
    });
  });
  drawTextLink(W / 2, startY + LEVELS.length * gap + 20 * UI, "atrás", () => { state.mode = "menu"; });
}

function drawPausedScreen() {
  ctx.fillStyle = "rgba(2,4,10,0.74)";
  ctx.fillRect(0, 0, W, H);
  centerText([{ text: "EN PAUSA", font: fnt(28, "600"), color: "#eafffb", glow: COL.player, blur: 18 }], H * 0.24);

  const sens = Settings.get("sensitivity");
  drawSlider(W / 2, H * 0.38, 260, (sens - 0.5) / 1.5, (v) => Settings.set("sensitivity", +(0.5 + v * 1.5).toFixed(2)), `sensibilidad · ${sens.toFixed(2)}x`);

  let nextY = H * 0.56;
  if (state.runCfg && state.runCfg.flavor === "chill") {
    centerText([{ text: "zarcillos", font: fnt(12), color: "rgba(210,230,230,0.55)" }], H * 0.48);
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

  const btnW = 200 * UI, btnH = 46 * UI, gapY = 58 * UI;
  drawButton(W / 2, nextY, btnW, btnH, "continuar", { action: () => { state.mode = state.prevMode; } });
  drawButton(W / 2, nextY + gapY, btnW, btnH, "menú principal", { action: () => { state.mode = "menu"; } });
}

function drawHud(lr) {
  drawMeter(lr);
  const cfg = state.runCfg;
  if (state.streak >= 3) {
    const pulse = 0.75 + Math.sin(state.t * 10) * 0.15;
    centerText([{
      text: `x${state.streak} racha`,
      font: fnt(13, "600"),
      color: `rgba(232,255,250,${pulse})`,
      glow: COL.player,
      blur: 14,
    }], 34 * UI + 58 * UI + 26 * UI);
  }
  const margin = 18 * UI;
  ctx.save();
  ctx.font = fnt(12);
  ctx.textAlign = "left";
  if (cfg.timeLimit != null) {
    ctx.fillStyle = state.timeLeft < 8 ? "rgba(255,150,140,0.85)" : "rgba(210,235,235,0.5)";
    ctx.fillText(`${Math.ceil(state.timeLeft)}s restantes`, margin, H - margin);
  } else if (cfg.flavor === "chill") {
    ctx.fillStyle = "rgba(210,235,235,0.4)";
    ctx.fillText(`${Math.round(state.light)} / ${cfg.lightMax}`, margin, H - margin);
  } else {
    ctx.fillStyle = "rgba(210,235,235,0.5)";
    ctx.fillText(`${state.time.toFixed(1)}s`, margin, H - margin);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(210,235,235,0.5)";
  ctx.fillText(`${state.motesEaten} motas`, W - margin, H - margin);
  ctx.restore();

  if (cfg.flavor !== "chill" && cfg.timeLimit == null && lr < 0.15) {
    centerText([{ text: "tu luz se apaga...", font: fnt(13), color: `rgba(255,150,140,${0.5 + Math.sin(state.t * 8) * 0.3})`, gap: 20 }], H - 46 * UI);
  }
  if (state.time < 5) {
    const a = clamp(1 - state.time / 5, 0, 1) * 0.5;
    centerText([{ text: "esc · pausa    f · pantalla completa", font: fnt(11), color: `rgba(200,225,225,${a})` }], H - 66 * UI);
  }
}

function drawWinScreen() {
  const cfg = state.runCfg;
  if (cfg.flavor === "levels") {
    const isLast = state.levelIndex >= LEVELS.length - 1;
    centerText([
      { text: isLast ? "¡TODOS LOS NIVELES SUPERADOS!" : `${LEVELS[state.levelIndex].name.toUpperCase()} SUPERADO`, font: fnt(30, "600"), color: "#fff6e2", glow: COL.gold, blur: 30, gap: 40 },
      { text: `${state.time.toFixed(1)}s · ${state.motesEaten} motas absorbidas`, font: fnt(14), color: "rgba(255,240,210,0.7)", gap: 30 },
    ], H * 0.16);
    if (state.canRestart) {
      const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
      centerText([{ text: isLast ? "toca para volver a niveles" : "toca para el siguiente nivel", color: `rgba(255,240,210,${alpha})`, font: fnt(14) }], H * 0.9);
    }
  } else {
    centerText([
      { text: "HAS FLORECIDO", font: fnt(44, "600"), color: "#fff6e2", glow: COL.gold, blur: 34, gap: 40 },
      { text: `${state.time.toFixed(1)}s a la deriva · ${state.motesEaten} motas absorbidas`, font: fnt(14), color: "rgba(255,240,210,0.7)", gap: 30 },
    ], H * 0.16);
    if (state.canRestart) {
      const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
      centerText([{ text: "toca para volver al menú", color: `rgba(255,240,210,${alpha})`, font: fnt(14) }], H * 0.9);
    }
  }
}

function drawLoseScreen() {
  const cfg = state.runCfg;
  const title = state.loseReason === "time" ? "SE ACABÓ EL TIEMPO" : "LA OSCURIDAD TE CUBRIÓ";
  centerText([
    { text: title, font: fnt(34, "600"), color: "#dfe8ff", glow: COL.shadow, blur: 28, gap: 44 },
    { text: `${state.time.toFixed(1)}s · ${state.motesEaten} motas absorbidas`, font: fnt(14), color: "rgba(210,220,255,0.6)", gap: 60 },
  ], H * 0.38);
  if (state.canRestart) {
    const alpha = 0.5 + Math.sin(state.t * 2.4) * 0.3;
    const label = cfg.flavor === "levels" ? "toca para reintentar el nivel" : "toca para intentarlo de nuevo";
    centerText([{ text: label, color: `rgba(210,220,255,${alpha})`, font: fnt(14) }], H * 0.6);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // Estado del contexto reseteado explícitamente cada frame: cualquier
  // sombra/alpha/grosor que quedara sin limpiar de un dibujo anterior nunca
  // debe "filtrarse" a lo que se dibuja después.
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
  bgGrad.addColorStop(0, COL.bg1);
  bgGrad.addColorStop(1, COL.bg0);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(camera.x, camera.y);

  // Zoom/pan de viaje entre biomas: a zoom 1 y pan (0,0) esto es la
  // identidad exacta (cero cambio visual en juego normal). Alejar la
  // cámara encoge y aleja el área de juego local hacia el punto donde
  // aparecen las nebulosas de otros biomas — un único sistema de
  // coordenadas para la escena local y el "universo" lejano.
  const zoom = camera.zoom;
  const pan = camera.pan();
  ctx.translate(W / 2 - zoom * (W / 2 + pan.x), H / 2 - zoom * (H / 2 + pan.y));
  ctx.scale(zoom, zoom);

  // Al alejarnos, los objetos concretos desaparecen antes de poder leerse
  // como "estrellas". En su lugar se revela el mapa de manchas orgánicas.
  // Las dos capas se cruzan suavemente y nunca exponen el rectángulo del
  // viewport local.
  const mapAlpha = smoothstep(0.94, 0.58, zoom);
  const worldDetailAlpha = smoothstep(0.42, 0.82, zoom);
  const biomeLabels = [];
  if (mapAlpha > 0 && state.runCfg) {
    const origin = BIOMES[state.biome].worldPos;
    const views = BIOMES.map((b) => ({
      biome: b,
      x: W / 2 + (b.worldPos.x - origin.x),
      y: H / 2 + (b.worldPos.y - origin.y),
      locked: Settings.getUnlockedLevel() < b.unlockLevel,
      current: b.id === state.biome,
    }));

    // Corrientes que nacen en el bioma actual: no son caminos rígidos, sino
    // filamentos lentos que hacen comprensible el mapa de un vistazo.
    for (const view of views) {
      if (view.current) continue;
      drawBiomeCurrent(
        W / 2,
        H / 2,
        view.x,
        view.y,
        view.biome.auraA,
        mapAlpha * (view.locked ? 0.28 : 0.72),
        state.t,
        view.biome.cloudSeed
      );
    }

    for (const view of views) {
      drawBiomeCloud(view.biome, view.x, view.y, mapAlpha, state.t, view.locked, view.current);
      const sx = W / 2 - zoom * (W / 2 + pan.x) + view.x * zoom;
      const sy = H / 2 - zoom * (H / 2 + pan.y) + view.y * zoom;
      if (sx < -90 * UI || sx > W + 90 * UI || sy < -90 * UI || sy > H + 90 * UI) continue;
      const labelOffset = Math.max(40 * UI, 350 * zoom);
      const labelDirection = sy > H * 0.62 ? -1 : 1;
      biomeLabels.push({
        x: clamp(sx, 130 * UI, W - 130 * UI),
        y: clamp(sy + labelOffset * labelDirection, 70 * UI, H - 135 * UI),
        name: view.biome.name,
        locked: view.locked,
        current: view.current,
        unlockLevel: view.biome.unlockLevel,
      });
    }
  }

  const ambientModes = ["menu", "settings", "levelSelect"];
  const lr = ambientModes.includes(state.mode) ? 0.15 : lightRatio();
  if (state.runCfg && state.runCfg.flavor === "chill") chillAura.draw(state.t, worldDetailAlpha);
  dustLayers.forEach((l) => l.draw(lr, worldDetailAlpha));
  bokeh.draw(lr, worldDetailAlpha);

  const worldModes = ["playing", "paused"];
  if (worldModes.includes(state.mode)) {
    for (const m of state.motes) m.draw(worldDetailAlpha);
    for (const tdr of state.tendrils) tdr.draw(worldDetailAlpha);
  }

  particles.draw(worldDetailAlpha);

  const pulse = state.mode === "playing" && lr < 0.18 ? (Math.sin(state.t * 8) * 0.5 + 0.5) * (0.18 - lr) * 4 : 0;
  const baseR = 15;

  if (state.mode === "blooming" || state.mode === "win") {
    const k = clamp(state.bloomT / state.runCfg.bloomDuration, 0, 1);
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

  ctx.restore();

  // Vignette y flashes pertenecen a la pantalla, no al mundo. Si se
  // transforman con la cámara se convierten en el rectángulo oscuro que se
  // veía en la captura al alejar el zoom.
  drawVignette(state.mode === "lose" ? lr * clamp(1 - state.fadeT / 1.4, 0, 1) : lr);
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,70,60,${state.flash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.mode === "lose") {
    ctx.fillStyle = `rgba(0,0,0,${clamp(state.fadeT / 1.4, 0, 1) * 0.9})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.mode === "blooming") {
    const k = clamp(state.bloomT / state.runCfg.bloomDuration, 0, 1);
    ctx.fillStyle = `rgba(255,226,170,${k * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (biomeLabels.length) {
    ctx.save();
    ctx.textAlign = "center";
    for (const lbl of biomeLabels) {
      const a = mapAlpha * (lbl.locked ? 0.46 : lbl.current ? 0.72 : 0.9);
      ctx.font = fnt(lbl.current ? 12 : 13, "600");
      ctx.fillStyle = `rgba(234,255,250,${a})`;
      ctx.shadowColor = lbl.locked ? "rgba(130,150,170,0.25)" : "rgba(180,230,255,0.65)";
      ctx.shadowBlur = lbl.locked ? 7 : 16;
      ctx.fillText(lbl.name.toUpperCase(), lbl.x, lbl.y);

      ctx.shadowBlur = 0;
      ctx.font = fnt(9, "500");
      ctx.fillStyle = `rgba(205,226,230,${a * 0.68})`;
      const detail = lbl.current
        ? "ESTÁS AQUÍ"
        : lbl.locked
          ? `COMPLETA EL NIVEL ${lbl.unlockLevel} PARA DESPERTARLO`
          : "VIAJA HACIA SU LUZ";
      ctx.fillText(detail, lbl.x, lbl.y + 17 * UI);
    }
    ctx.restore();
  }

  drawBiomeMapStatus(mapAlpha * 0.85);

  clearHotspots();
  if (state.mode === "menu") drawMenuScreen();
  else if (state.mode === "settings") drawSettingsScreen();
  else if (state.mode === "levelSelect") drawLevelSelectScreen();
  else if (state.mode === "playing") drawHud(lr);
  else if (state.mode === "win") drawWinScreen();
  else if (state.mode === "lose") drawLoseScreen();
  if (state.mode === "paused") drawPausedScreen();

  drawFullscreenIcon();
  if (state.mode !== "playing") drawCursor();
}

// ---------- Eventos ----------
window.addEventListener("pointermove", (e) => {
  input.px = e.clientX;
  input.py = e.clientY;
  input.hasPointer = true;
  if (sliderDrag) sliderDrag.onChange(clamp((e.clientX - sliderDrag.x) / sliderDrag.w, 0, 1));
});
window.addEventListener("wheel", (e) => {
  if (state.mode !== "playing" || !state.runCfg) return;
  e.preventDefault();
  camera.zoomTarget = clamp(camera.zoomTarget * Math.pow(0.9984, e.deltaY), ZOOM_MIN, 1);
}, { passive: false });
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
