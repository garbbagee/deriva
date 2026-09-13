// Motor de audio 100% sintetizado (sin archivos externos).
const Audio2 = (() => {
  let ctx = null;
  let master = null;
  let delay = null;
  let ambientNodes = [];
  let started = false;

  function ensureCtx() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.55;

    delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.32;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 2200;
    delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(delay);
    delay.connect(master);

    master.connect(ctx.destination);
    return ctx;
  }

  function toMaster(node, sendToDelay = true) {
    node.connect(master);
    if (sendToDelay) {
      const send = ctx.createGain();
      send.gain.value = 0.5;
      node.connect(send);
      send.connect(delay);
    }
  }

  function resume() {
    ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    if (!started) {
      started = true;
      startAmbient();
    }
  }

  function startAmbient() {
    const now = ctx.currentTime;
    const base = ctx.createGain();
    base.gain.value = 0.0;
    base.connect(master);

    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 55 * 1.5 + 0.3;

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;

    o1.connect(filt);
    o2.connect(filt);
    filt.connect(base);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(filt.frequency);

    o1.start(now);
    o2.start(now);
    lfo.start(now);
    base.gain.linearRampToValueAtTime(0.09, now + 4);

    ambientNodes = [o1, o2, lfo];
  }

  function setAmbientTension(t) {
    // t 0..1 empuja el filtro ambiental más brillante/tenso
    if (!ctx || !ambientNodes.length) return;
  }

  function chime(pitchT, size = 1) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = 420 + pitchT * 620;
    const o = ctx.createOscillator();
    o.type = size > 1 ? "triangle" : "sine";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.01;

    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const g2 = ctx.createGain();
    g2.gain.value = 0.0001;

    o.connect(g);
    o2.connect(g2);
    g.connect(master);
    g2.connect(master);
    const send = ctx.createGain();
    send.gain.value = 0.35;
    g.connect(send);
    send.connect(delay);

    const peak = size > 1 ? 0.18 : 0.11;
    g.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (size > 1 ? 1.1 : 0.55));
    g2.gain.exponentialRampToValueAtTime(peak * 0.4, now + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    o.start(now);
    o2.start(now);
    o.stop(now + 1.2);
    o2.stop(now + 1.2);
  }

  function hit() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(45, now + 0.35);
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.42);

    // ruido
    const bufSize = ctx.sampleRate * 0.3;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(master);
    noise.start(now);
  }

  function bloom() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.3, 659.3];
    notes.forEach((f, i) => {
      const t = now + i * 0.14;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g);
      toMaster(g, true);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.start(t);
      o.stop(t + 1.7);
    });
  }

  function fade() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(220, now);
    o.frequency.exponentialRampToValueAtTime(60, now + 1.6);
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 1.9);
  }

  return { resume, chime, hit, bloom, fade, setAmbientTension };
})();
