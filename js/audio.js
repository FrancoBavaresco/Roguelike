'use strict';
/* HEXWRIGHT — audio: synthesized SFX and adaptive generative score (no samples) */
const A = H.audio = { ctx: null, ready: false, intensity: 0, target: 0, theme: 'hub', lastPlay: {} };

A.init = function () {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = A.ctx = new AC();
  A.master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  A.master.connect(comp); comp.connect(ctx.destination);
  A.music = ctx.createGain(); A.sfx = ctx.createGain();
  A.music.connect(A.master); A.sfx.connect(A.master);
  // reverb
  A.verb = ctx.createConvolver(); A.verb.buffer = A.impulse(2.6, 2.4);
  A.verbIn = ctx.createGain(); A.verbIn.gain.value = 0.6; A.verbIn.connect(A.verb); A.verb.connect(A.master);
  // noise
  const len = ctx.sampleRate * 2; const nb = ctx.createBuffer(1, len, ctx.sampleRate); const d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; A.noiseBuf = nb;
  A.fireInit();
  A.applyVolumes();
  A.musicInit();
  A.ready = true;
};
/* --- Fire bolt: sampled-feel fire whoosh built from pre-rendered "flame" buffers.
   Each cast picks a random buffer/offset/pitch/filter so spam never sounds identical, a heat
   meter ducks and shortens rapid repeats, and a soft continuous roar fills in while spamming. */
A.fireInit = function () {
  const ctx = A.ctx, sr = ctx.sampleRate; A.fireBufs = [];
  for (let v = 0; v < 6; v++) {
    const n = Math.floor(sr * 0.9), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let brown = 0, pink = 0, crack = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      brown = (brown + 0.02 * w) / 1.02; pink = 0.94 * pink + 0.06 * w;           // low roar + hiss body
      if (Math.random() < 0.0009) crack = (Math.random() < .5 ? -1 : 1) * (0.4 + Math.random() * 0.6); // crackle pops
      crack *= 0.93;
      const flutter = 0.75 + 0.25 * Math.sin(i / sr * (18 + v * 3) * 6.283) * Math.sin(i / sr * 7.3 * 6.283); // flame flicker
      d[i] = (brown * 3.2 + pink * 1.1 + w * 0.12) * flutter + crack * w * 0.9;
    }
    let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= mx;
    A.fireBufs.push(b);
  }
  A.fireHeat = 0; A.fireHeatT = ctx.currentTime; A.fireVoices = [];
  // continuous bed that swells only while the attack is spammed
  const bed = ctx.createBufferSource(); bed.buffer = A.fireBufs[0]; bed.loop = true; bed.playbackRate.value = 0.7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  A.fireBed = ctx.createGain(); A.fireBed.gain.value = 0; bed.connect(lp); lp.connect(A.fireBed); A.fireBed.connect(A.sfx); bed.start();
};
A.fireBolt = function (o = {}) {
  const ctx = A.ctx, t = ctx.currentTime;
  // heat decays over time; rapid casts raise it
  A.fireHeat = Math.max(0, A.fireHeat - (t - A.fireHeatT) * 2.2); A.fireHeatT = t; A.fireHeat = Math.min(6, A.fireHeat + 1);
  const heat = A.fireHeat, duck = 1 / (1 + 0.32 * Math.max(0, heat - 1));
  const r = (a, b) => a + Math.random() * (b - a);
  const dur = r(0.26, 0.34) * (1 - Math.min(0.45, 0.08 * (heat - 1))), att = r(0.012, 0.03);
  const peak = 0.34 * duck * r(0.85, 1.05);
  // voice cap: fade the oldest when too many overlap
  A.fireVoices = A.fireVoices.filter(v => v.end > t);
  while (A.fireVoices.length >= 3) { const v = A.fireVoices.shift(); try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, 0.02); } catch (e) { } }
  const src = ctx.createBufferSource(); src.buffer = A.fireBufs[(Math.random() * A.fireBufs.length) | 0];
  src.playbackRate.value = r(0.85, 1.18) * (1 + 0.02 * heat);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = r(70, 120);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = r(0.7, 1.6);
  const f0 = r(500, 800), f1 = r(2600, 4200) * (1 - 0.06 * heat), f2 = r(500, 900);   // whoosh: open up as it leaves, then dull as it flies away
  lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(f1, t + att + 0.04); lp.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(peak * 0.35, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = g;
  if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); const p0 = Math.max(-0.6, Math.min(0.6, (o.pan || 0) * 0.3)); pn.pan.setValueAtTime(p0 * 0.3, t); pn.pan.linearRampToValueAtTime(p0, t + dur); g.connect(pn); out = pn; }
  src.connect(hp); hp.connect(lp); lp.connect(g); out.connect(A.sfx);
  if (heat < 2.5) { const vg = ctx.createGain(); vg.gain.value = 0.12; g.connect(vg); vg.connect(A.verbIn); }
  src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
  // low "thump" of ignition, only on the first shots of a burst
  if (heat < 2.2) A.osc({ f: r(140, 180), f2: 55, type: 'sine', v: 0.1 * duck, dur: 0.12, a: 0.004 });
  A.fireVoices.push({ g, end: t + dur });
  // spam bed: rises with heat, falls back when you stop
  A.fireBed.gain.cancelScheduledValues(t); A.fireBed.gain.setTargetAtTime(Math.min(0.09, Math.max(0, heat - 1.5) * 0.025), t, 0.08); A.fireBed.gain.setTargetAtTime(0, t + 0.35, 0.25);
};
/* --- Fire kit voices: layers built from the flame buffers (roar/crackle) and white noise (air) --- */
const arnd = (a, b) => a + Math.random() * (b - a);
A.flameLayer = function (o) {
  const ctx = A.ctx, t = o.t || ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = A.fireBufs[(Math.random() * A.fireBufs.length) | 0]; src.loop = !!o.loop; src.playbackRate.value = o.rate || 1;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = o.hp || 60;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = o.q || 0.9;
  lp.frequency.setValueAtTime(o.f0 || 800, t); if (o.f1) lp.frequency.exponentialRampToValueAtTime(o.f1, t + (o.a || 0.02) + (o.fT || 0.05)); if (o.f2) lp.frequency.exponentialRampToValueAtTime(o.f2, t + (o.a || 0.02) + o.dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v, t + (o.a || 0.02));
  if (o.hold) g.gain.setValueAtTime(o.v, t + (o.a || 0.02) + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (o.a || 0.02) + (o.hold || 0) + o.dur);
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(o.out || A.sfx);
  if (o.verb) { const vg = ctx.createGain(); vg.gain.value = o.verb; g.connect(vg); vg.connect(A.verbIn); }
  src.start(t, Math.random() * 0.3); src.stop(t + (o.a || 0.02) + (o.hold || 0) + o.dur + 0.05);
};
A.airLayer = function (o) {
  const ctx = A.ctx, t = o.t || ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = o.type || 'bandpass'; bp.Q.value = o.q || 0.8;
  bp.frequency.setValueAtTime(o.f0, t); if (o.f1) bp.frequency.exponentialRampToValueAtTime(o.f1, t + (o.fT || o.dur));
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v, t + (o.a || 0.02));
  if (o.hold) g.gain.setValueAtTime(o.v, t + (o.a || 0.02) + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (o.a || 0.02) + (o.hold || 0) + o.dur);
  src.connect(bp); bp.connect(g); g.connect(o.out || A.sfx);
  if (o.verb) { const vg = ctx.createGain(); vg.gain.value = o.verb; g.connect(vg); vg.connect(A.verbIn); }
  src.start(t, Math.random()); src.stop(t + (o.a || 0.02) + (o.hold || 0) + o.dur + 0.05);
};
/* Lanzallamas: a sudden blowtorch gust — air hiss that bursts open plus a heavy roar */
A.sfxFlamethrower = function () {
  const k = arnd(0.92, 1.08);
  A.airLayer({ f0: 900 * k, f1: 3800 * k, fT: 0.08, q: 0.7, v: 0.26, a: 0.015, hold: 0.12, dur: 0.38 });
  A.airLayer({ type: 'highpass', f0: 5000, v: 0.07, a: 0.01, hold: 0.1, dur: 0.25 });
  A.flameLayer({ rate: arnd(0.75, 0.9), f0: 500, f1: 2600, fT: 0.06, f2: 600, v: 0.42, a: 0.02, hold: 0.1, dur: 0.45, verb: 0.15 });
  A.osc({ f: 120, f2: 45, type: 'sine', v: 0.16, dur: 0.25, a: 0.005 });
};
/* Meteorito: rising whistle-roar while it falls, then the impact explosion */
A.sfxMeteorFall = function () {
  const ctx = A.ctx, t = ctx.currentTime, fall = 0.62;
  A.airLayer({ type: 'lowpass', f0: 300, f1: 1400, fT: fall, q: 0.5, v: 0.14, a: fall * 0.9, dur: 0.1 });
  A.flameLayer({ rate: 0.8, f0: 400, f1: 1800, fT: fall, v: 0.22, a: fall * 0.9, dur: 0.15 });
};
/* Deep, clean explosion: smooth sub thump + low-passed noise body that decays naturally.
   No distortion or resonant filters, so it reads as a clear "boom". size scales weight/length. */
A.boom = function (size = 1, t0) {
  const ctx = A.ctx, t = t0 || ctx.currentTime;
  const L = 0.8 + 0.45 * size;
  const out = ctx.createGain(); out.gain.value = 0.75; out.connect(A.sfx);
  const vg = ctx.createGain(); vg.gain.value = 0.1; out.connect(vg); vg.connect(A.verbIn);
  // sub thump (pitch drops smoothly)
  A.osc({ f: 62, f2: 32, slide: 0.5 + 0.2 * size, type: 'sine', v: 0.7 * Math.min(1.2, size), dur: L, a: 0.003, out });
  // body: white noise through two gentle low-passes that close over time
  const src = ctx.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
  const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.Q.value = 0.5;
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.Q.value = 0.5;
  for (const f of [lp1, lp2]) { f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.3); f.frequency.exponentialRampToValueAtTime(90, t + L + 0.6); }
  const g = ctx.createGain(); const v = 0.75 * Math.min(1.25, size);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.setTargetAtTime(v * 0.55, t + 0.06, 0.12); g.gain.setTargetAtTime(0.0001, t + 0.15 + 0.25 * size, L / 3);
  src.connect(lp1); lp1.connect(lp2); lp2.connect(g); g.connect(out);
  src.start(t, Math.random()); src.stop(t + L + 1.4);
  // short soft punch on the attack
  A.airLayer({ type: 'lowpass', f0: 1600, f1: 400, fT: 0.1, q: 0.5, v: 0.22, a: 0.003, dur: 0.12, t, out });
};
A.sfxMeteorHit = function () {
  const ctx = A.ctx, t = ctx.currentTime;
  A.boom(1, t);
  A.flameLayer({ rate: 0.6, f0: 1200, f1: 900, fT: 0.2, f2: 250, v: 0.22, a: 0.08, dur: 1.4, t: t + 0.15, verb: 0.15 }); // burning ground
};
/* Torbellino: sustained blowtorch — roaring fire + swirling wind, faded in/out by the zone */
A.loopFirestorm = function () {
  const ctx = A.ctx, t = ctx.currentTime;
  A.fireLoops = (A.fireLoops || []).filter(l => !l.done);
  if (A.fireLoops.length >= 2) { const old = A.fireLoops.shift(); old.stop(); }
  const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(1, t, 0.12); out.connect(A.sfx);
  const nodes = [];
  // fire roar
  const f = ctx.createBufferSource(); f.buffer = A.fireBufs[(Math.random() * A.fireBufs.length) | 0]; f.loop = true; f.playbackRate.value = 0.7;
  const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 1400; const fg = ctx.createGain(); fg.gain.value = 0.26; f.connect(flp); flp.connect(fg); fg.connect(out); nodes.push(f);
  // swirling wind: bandpass sweeping with an LFO
  const w = ctx.createBufferSource(); w.buffer = A.noiseBuf; w.loop = true;
  const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 900; wbp.Q.value = 2.2;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 1.6; const lg = ctx.createGain(); lg.gain.value = 600; lfo.connect(lg); lg.connect(wbp.frequency);
  const wg = ctx.createGain(); wg.gain.value = 0.2; const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 3.1; const l2g = ctx.createGain(); l2g.gain.value = 0.08; lfo2.connect(l2g); l2g.connect(wg.gain);
  w.connect(wbp); wbp.connect(wg); wg.connect(out); nodes.push(w, lfo, lfo2);
  // blowtorch hiss
  const hs = ctx.createBufferSource(); hs.buffer = A.noiseBuf; hs.loop = true; const hhp = ctx.createBiquadFilter(); hhp.type = 'bandpass'; hhp.frequency.value = 3200; hhp.Q.value = 0.6;
  const hg = ctx.createGain(); hg.gain.value = 0.07; hs.connect(hhp); hhp.connect(hg); hg.connect(out); nodes.push(hs);
  const vg = ctx.createGain(); vg.gain.value = 0.15; out.connect(vg); vg.connect(A.verbIn);
  for (const n of nodes) n.start(t, n.buffer ? Math.random() : undefined);
  const h = { done: false, last: performance.now(),
    touch() { h.last = performance.now(); },
    stop() { if (h.done) return; h.done = true; const t2 = ctx.currentTime; out.gain.cancelScheduledValues(t2); out.gain.setTargetAtTime(0.0001, t2, 0.18); for (const n of nodes) try { n.stop(t2 + 1); } catch (e) { } clearInterval(h.iv); } };
  // if the game stops touching it (paused, room changed), fade it out on its own
  h.iv = setInterval(() => { if (performance.now() - h.last > 300) h.stop(); }, 150);
  A.fireLoops.push(h); return h;
};
/* Dash de Fuego: short flame swoosh */
A.sfxFireDash = function () {
  A.flameLayer({ rate: arnd(1.0, 1.25), f0: 700, f1: 3000, fT: 0.05, f2: 500, v: 0.22, a: 0.01, dur: 0.3 });
  A.airLayer({ f0: 1500, f1: 600, fT: 0.25, q: 1, v: 0.08, a: 0.01, dur: 0.25 });
};
/* Supernova: rising fire charge, a big explosion, then a long fire roar with crackles */
A.sfxNovaCharge = function () {
  A.flameLayer({ rate: 0.7, f0: 300, f1: 2400, fT: 0.5, v: 0.32, a: 0.5, dur: 0.1 });
  A.airLayer({ type: 'lowpass', f0: 250, f1: 1500, fT: 0.52, q: 0.5, v: 0.12, a: 0.5, dur: 0.08 });
};
A.sfxNovaBoom = function () {
  const ctx = A.ctx, t = ctx.currentTime;
  A.boom(1.6, t);
  // after the blast: fire roars and crackles, then settles
  A.flameLayer({ rate: 0.6, f0: 1400, f1: 2000, fT: 0.3, f2: 350, v: 0.4, a: 0.35, hold: 0.7, dur: 2.0, t: t + 0.25, verb: 0.3 });
  A.airLayer({ f0: 1800, f1: 800, fT: 2.2, q: 0.6, v: 0.06, a: 0.4, hold: 0.5, dur: 1.6, t: t + 0.4 });
  for (let i = 0; i < 9; i++) A.airLayer({ type: 'bandpass', f0: arnd(1500, 3500), q: 1.5, v: arnd(0.04, 0.08), a: 0.002, dur: arnd(0.02, 0.05), t: t + arnd(0.6, 2.6) });
};
/* soft impact puff for fire bolts, heavily rate-limited */
A.fireHit = function () {
  const ctx = A.ctx, t = ctx.currentTime; if (A.fireHitT && t - A.fireHitT < 0.07) return; A.fireHitT = t;
  const src = ctx.createBufferSource(); src.buffer = A.fireBufs[(Math.random() * A.fireBufs.length) | 0]; src.playbackRate.value = 1.3 + Math.random() * 0.4;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.15);
  const g = ctx.createGain(); const v = 0.16 / (1 + 0.25 * A.fireHeat); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  src.connect(lp); lp.connect(g); g.connect(A.sfx); src.start(t, Math.random() * 0.4); src.stop(t + 0.2);
};
A.impulse = function (sec, decay) {
  const ctx = A.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
};
A.applyVolumes = function () {
  if (!A.ctx) return; const s = H.settings, t = A.ctx.currentTime;
  A.master.gain.setTargetAtTime(s.master, t, 0.05);
  A.music.gain.setTargetAtTime(s.music * 0.5, t, 0.05);
  A.sfx.gain.setTargetAtTime(s.sfx * 0.9, t, 0.05);
};

/* --- primitive voices --- */
function env(g, t, a, peak, dec, sus = 0, rel = 0) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (sus > 0) { g.gain.setTargetAtTime(peak * sus, t + a, dec / 3); g.gain.setTargetAtTime(0.0001, t + a + dec, rel / 3 || 0.05); }
  else g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
A.osc = function (o) {
  const ctx = A.ctx, t = (o.t || ctx.currentTime);
  const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || o.dur || 0.2));
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain(); env(g, t, o.a || 0.005, o.v || 0.3, o.dur || 0.2);
  let node = osc;
  if (o.lp || o.hp || o.bp) { const f = ctx.createBiquadFilter(); f.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass'; f.frequency.value = o.lp || o.hp || o.bp; f.Q.value = o.q || 1; if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + (o.dur || .2)); node.connect(f); node = f; }
  node.connect(g); g.connect(o.out || A.sfx);
  if (o.verb) { const vg = ctx.createGain(); vg.gain.value = o.verb; g.connect(vg); vg.connect(A.verbIn); }
  osc.start(t); osc.stop(t + (o.a || 0.005) + (o.dur || 0.2) + 0.05);
  return osc;
};
A.noise = function (o) {
  const ctx = A.ctx, t = (o.t || ctx.currentTime);
  const src = ctx.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
  src.playbackRate.value = o.rate || 1;
  const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
  if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t + (o.dur || .2));
  const g = ctx.createGain(); env(g, t, o.a || 0.005, o.v || 0.3, o.dur || 0.2);
  src.connect(f); f.connect(g); g.connect(o.out || A.sfx);
  if (o.verb) { const vg = ctx.createGain(); vg.gain.value = o.verb; g.connect(vg); vg.connect(A.verbIn); }
  src.start(t, Math.random() * 1.5); src.stop(t + (o.a || 0.005) + (o.dur || 0.2) + 0.05);
};

/* --- SFX library --- */
const rnd = (a, b) => a + Math.random() * (b - a);
A.SFX = {
  ui_move: () => A.osc({ f: 880, f2: 1100, type: 'triangle', v: 0.05, dur: 0.05 }),
  ui_ok: () => { A.osc({ f: 520, type: 'triangle', v: 0.1, dur: 0.12, verb: .2 }); A.osc({ f: 780, type: 'triangle', v: 0.08, dur: 0.18, t: A.ctx.currentTime + 0.05, verb: .3 }); },
  ui_back: () => A.osc({ f: 500, f2: 300, type: 'triangle', v: 0.09, dur: 0.12 }),
  ui_deny: () => { A.osc({ f: 160, type: 'square', v: 0.07, dur: 0.1, lp: 900 }); A.osc({ f: 150, type: 'square', v: 0.07, dur: 0.1, lp: 900, t: A.ctx.currentTime + 0.11 }); },
  ui_start: () => { const t = A.ctx.currentTime; [0, 3, 7, 12].forEach((s, i) => A.osc({ f: 293.66 * Math.pow(2, s / 12), type: 'triangle', v: 0.1, dur: 0.5, t: t + i * 0.06, verb: .5 })); A.noise({ f: 300, f2: 3000, type: 'bandpass', v: .12, dur: .5, q: .8, verb: .4 }); },
  cast_ember: () => { A.noise({ f: 900, f2: 300, type: 'bandpass', q: 1.2, v: 0.22, dur: 0.18 }); A.osc({ f: 180, f2: 70, type: 'sawtooth', v: 0.08, dur: 0.12, lp: 800 }); },
  cast_frost: () => { const t = A.ctx.currentTime; A.osc({ f: rnd(1900, 2300), type: 'sine', v: 0.07, dur: 0.25, verb: .4 }); A.osc({ f: rnd(2700, 3100), type: 'sine', v: 0.05, dur: 0.2, t: t + 0.03, verb: .4 }); A.noise({ f: 6000, type: 'highpass', v: 0.08, dur: 0.12 }); },
  cast_volt: () => { A.osc({ f: rnd(140, 220), f2: rnd(900, 1400), type: 'square', v: 0.07, dur: 0.09, lp: 3000 }); A.noise({ f: 3000, type: 'bandpass', q: 3, v: 0.15, dur: 0.1 }); },
  cast_venom: () => { A.osc({ f: rnd(300, 380), f2: 120, type: 'sine', v: 0.16, dur: 0.18 }); A.noise({ f: 1200, f2: 500, type: 'bandpass', q: 4, v: 0.1, dur: 0.15 }); },
  cast_gale: () => A.noise({ f: 400, f2: 2400, type: 'bandpass', q: 1.5, v: 0.24, dur: 0.28 }),
  cast_stone: () => { A.osc({ f: 110, f2: 45, type: 'sine', v: 0.35, dur: 0.25 }); A.noise({ f: 700, f2: 200, type: 'lowpass', v: 0.2, dur: 0.2 }); },
  cast_void: () => { A.osc({ f: 420, f2: 60, type: 'sine', v: 0.16, dur: 0.4, verb: .6 }); A.osc({ f: 426, f2: 63, type: 'triangle', v: 0.08, dur: 0.4 }); },
  zap: () => { A.noise({ f: rnd(2500, 4000), type: 'bandpass', q: 5, v: 0.12, dur: 0.06 }); A.osc({ f: rnd(600, 1200), type: 'square', v: 0.03, dur: 0.05, lp: 4000 }); },
  hit: (o) => { const p = o && o.heavy ? 0.6 : 1; A.osc({ f: 160 * p, f2: 60, type: 'sine', v: 0.22, dur: 0.1 }); A.noise({ f: 1800 * p, type: 'bandpass', q: 1, v: 0.12, dur: 0.05 }); },
  block: () => { A.osc({ f: 1300, type: 'square', v: 0.05, dur: 0.06, lp: 3000 }); A.osc({ f: 1700, type: 'triangle', v: 0.05, dur: 0.12, verb: .3 }); },
  kill: () => { A.noise({ f: rnd(500, 900), f2: 120, type: 'bandpass', q: 1.4, v: 0.22, dur: 0.3 }); A.osc({ f: 90, f2: 40, type: 'sine', v: 0.25, dur: 0.22 }); },
  hurt: () => { A.osc({ f: 120, f2: 50, type: 'sawtooth', v: 0.22, dur: 0.25, lp: 600 }); A.noise({ f: 400, type: 'lowpass', v: 0.25, dur: 0.18 }); },
  dash: () => A.noise({ f: 2400, f2: 500, type: 'bandpass', q: 0.9, v: 0.2, dur: 0.18 }),
  dodge: () => { A.osc({ f: 1200, f2: 2400, type: 'triangle', v: 0.06, dur: 0.15, verb: .3 }); },
  reaction: (o) => { const t = A.ctx.currentTime; const base = o && o.base || 392; [0, 4, 7, 11].forEach((s, i) => A.osc({ f: base * Math.pow(2, s / 12), type: i % 2 ? 'triangle' : 'sawtooth', v: 0.06, dur: 0.35, t: t + i * 0.012, lp: 3500, verb: .5 })); A.noise({ f: 800, f2: 200, type: 'lowpass', v: 0.3, dur: 0.35 }); A.osc({ f: 70, f2: 35, type: 'sine', v: .35, dur: .3 }); },
  interrupt: () => { const t = A.ctx.currentTime; A.noise({ f: 5000, type: 'highpass', v: 0.25, dur: 0.15 }); A.osc({ f: 2200, f2: 800, type: 'square', v: 0.06, dur: 0.18, lp: 5000 }); A.osc({ f: 1800, type: 'sine', v: 0.08, dur: 0.5, t: t + 0.03, verb: .5 }); },
  telegraph: () => A.osc({ f: 220, f2: 240, type: 'triangle', v: 0.035, dur: 0.12 }),
  enemy_shot: () => { A.osc({ f: 380, f2: 180, type: 'square', v: 0.045, dur: 0.12, lp: 1200 }); },
  explode: () => { A.noise({ f: 1500, f2: 100, type: 'lowpass', v: 0.4, dur: 0.5, verb: .3 }); A.osc({ f: 80, f2: 30, type: 'sine', v: 0.45, dur: 0.4 }); },
  punch: () => { A.osc({ f: arnd(150, 180), f2: 60, type: 'sine', v: 0.32, dur: 0.12, a: 0.002 }); A.airLayer({ type: 'lowpass', f0: 1800, f1: 300, fT: 0.08, q: 0.5, v: 0.22, a: 0.002, dur: 0.09 }); },
  whiff: () => A.airLayer({ type: 'bandpass', f0: 600, f1: 1600, fT: 0.12, q: 1.2, v: 0.08, a: 0.01, dur: 0.12 }),
  axe_swish: () => { A.airLayer({ type: 'bandpass', f0: arnd(380, 480), f1: arnd(1200, 1500), fT: 0.16, q: 1.2, v: 0.2, a: 0.02, dur: 0.22 }); },
  axe_hit: (o) => { const h = o && o.heavy; A.osc({ f: h ? 95 : 130, f2: 40, type: 'sine', v: h ? 0.45 : 0.32, dur: h ? 0.3 : 0.16, a: 0.002 }); A.noise({ f: 900, f2: 200, type: 'lowpass', v: h ? 0.32 : 0.22, dur: h ? 0.22 : 0.12 }); A.osc({ f: arnd(900, 1100), f2: 760, type: 'triangle', v: 0.03, dur: 0.18, verb: .3 }); },
  sword_draw: () => { A.airLayer({ type: 'bandpass', f0: 2600, f1: 1400, fT: 0.25, q: 3, v: 0.05, a: 0.05, dur: 0.3 }); A.osc({ f: 2900, f2: 2700, type: 'sine', v: 0.012, dur: 0.35, verb: .3 }); },
  sword_ready: () => { A.osc({ f: 1760, type: 'triangle', v: 0.05, dur: 0.25, verb: .4 }); A.osc({ f: 2637, type: 'sine', v: 0.03, dur: 0.3, t: A.ctx.currentTime + 0.04, verb: .4 }); },
  sword_swish: () => { A.airLayer({ type: 'bandpass', f0: arnd(700, 900), f1: arnd(2600, 3200), fT: 0.1, q: 1.6, v: 0.13, a: 0.008, dur: 0.15 }); },
  sword_hit: (o) => { const h = o && o.heavy; A.osc({ f: arnd(1700, 2100) * (h ? 0.7 : 1), f2: arnd(1450, 1650) * (h ? 0.7 : 1), type: 'triangle', v: 0.045, dur: 0.22, verb: .3 }); A.noise({ f: 3200, type: 'bandpass', q: 2.5, v: 0.12, dur: 0.05 }); A.osc({ f: h ? 120 : 170, f2: 55, type: 'sine', v: h ? 0.32 : 0.2, dur: h ? 0.22 : 0.1, a: 0.002 }); },
  sword_thrust: () => { A.airLayer({ type: 'bandpass', f0: 1200, f1: 4200, fT: 0.07, q: 2.2, v: 0.14, a: 0.004, dur: 0.1 }); A.osc({ f: 2400, f2: 2100, type: 'sine', v: 0.025, dur: 0.18, verb: .3 }); },
  sword_cleave: () => { A.airLayer({ type: 'lowpass', f0: 2200, f1: 260, fT: 0.3, q: 0.7, v: 0.26, a: 0.03, dur: 0.34 }); A.osc({ f: 85, f2: 32, type: 'sine', v: 0.4, dur: 0.35, a: 0.1 }); },
  punch_heavy: () => { A.boom(0.6); A.osc({ f: 120, f2: 45, type: 'sine', v: 0.35, dur: 0.25, a: 0.002 }); },
  slam: () => { A.osc({ f: 60, f2: 28, type: 'sine', v: 0.6, dur: 0.5 }); A.noise({ f: 500, f2: 80, type: 'lowpass', v: 0.4, dur: 0.6, verb: .3 }); },
  roar: () => { const t = A.ctx.currentTime; A.osc({ f: 70, f2: 50, type: 'sawtooth', v: 0.22, dur: 1.4, lp: 500, verb: .5 }); A.osc({ f: 73, f2: 52, type: 'sawtooth', v: 0.2, dur: 1.4, lp: 500 }); A.noise({ f: 300, f2: 120, type: 'bandpass', q: 2, v: 0.25, dur: 1.3, verb: .5, t }); },
  spawn: () => A.osc({ f: 200, f2: 600, type: 'sine', v: 0.06, dur: 0.5, verb: .5 }),
  door: () => { A.osc({ f: 196, type: 'triangle', v: 0.1, dur: 1.0, verb: .6 }); A.osc({ f: 293.66, type: 'triangle', v: 0.08, dur: 1.2, t: A.ctx.currentTime + 0.1, verb: .6 }); A.noise({ f: 200, f2: 60, type: 'lowpass', v: .2, dur: .8 }); },
  clear: () => { const t = A.ctx.currentTime; [0, 7, 12, 15, 19].forEach((s, i) => A.osc({ f: 293.66 * Math.pow(2, s / 12), type: 'triangle', v: 0.09, dur: 0.9, t: t + i * 0.08, verb: .7 })); },
  reward: () => { const t = A.ctx.currentTime; [12, 15, 19, 24].forEach((s, i) => A.osc({ f: 293.66 * Math.pow(2, s / 12), type: 'sine', v: 0.08, dur: 0.6, t: t + i * 0.05, verb: .7 })); },
  heal: () => { const t = A.ctx.currentTime; [0, 5, 9].forEach((s, i) => A.osc({ f: 440 * Math.pow(2, s / 12), type: 'sine', v: 0.08, dur: 0.6, t: t + i * 0.09, verb: .6 })); },
  death: () => { const t = A.ctx.currentTime; A.osc({ f: 220, f2: 40, type: 'sawtooth', v: 0.2, dur: 1.8, lp: 900, verb: .7 }); A.osc({ f: 146.8, f2: 30, type: 'triangle', v: 0.2, dur: 2.0, verb: .7, t: t + .1 }); A.noise({ f: 800, f2: 60, type: 'lowpass', v: 0.3, dur: 1.6, verb: .5 }); },
  freeze: () => { A.noise({ f: 7000, type: 'highpass', v: 0.12, dur: 0.25 }); A.osc({ f: 2600, type: 'sine', v: .05, dur: .3, verb: .5 }); },
  fire_bolt: (o) => A.fireBolt(o),
  flamethrower: () => A.sfxFlamethrower(),
  meteor_fall: () => A.sfxMeteorFall(),
  meteor_hit: () => A.sfxMeteorHit(),
  fire_dash: () => A.sfxFireDash(),
  nova_charge: () => A.sfxNovaCharge(),
  nova_boom: () => A.sfxNovaBoom(),
  fire_hit: () => A.fireHit(),
  shatter: () => { A.noise({ f: 6000, f2: 1500, type: 'bandpass', q: 1, v: 0.35, dur: 0.35 }); A.osc({ f: 3000, f2: 1200, type: 'triangle', v: 0.08, dur: 0.3, verb: .4 }); },
  plunge: () => A.osc({ f: 500, f2: 50, type: 'sine', v: 0.12, dur: 0.8, verb: .5 }),
  lvl_charge: () => { const t = A.ctx.currentTime; A.osc({ f: 180, f2: 1400, slide: 1.0, type: 'triangle', v: 0.12, dur: 1.05, a: 0.05, verb: .4 }); A.osc({ f: 182, f2: 1410, slide: 1.0, type: 'sawtooth', v: 0.04, dur: 1.05, a: 0.05, lp: 2400 }); A.noise({ f: 400, f2: 6000, type: 'bandpass', q: 2, v: 0.08, dur: 1.0, a: 0.3, t }); },
  lvl_burst: () => { const t = A.ctx.currentTime; A.noise({ f: 2500, f2: 120, type: 'lowpass', v: 0.5, dur: 0.7, verb: .5 }); A.osc({ f: 90, f2: 30, type: 'sine', v: 0.55, dur: 0.5 }); [0, 7, 12, 16, 19, 24].forEach((s, i) => A.osc({ f: 293.66 * Math.pow(2, s / 12), type: i % 2 ? 'sine' : 'triangle', v: 0.09, dur: 1.6, t: t + 0.04 + i * 0.03, verb: .8 })); },
  victory: () => { const t = A.ctx.currentTime; [0, 3, 7, 10, 14, 15, 19].forEach((s, i) => A.osc({ f: 146.83 * Math.pow(2, s / 12), type: 'triangle', v: 0.1, dur: 1.6, t: t + i * 0.12, verb: .8 })); }
};
A.play = function (name, opts) {
  if (!A.ready || !H.settings.sfx) return;
  const now = A.ctx.currentTime;
  // voice limiting per sound
  const minGap = { hit: 0.03, zap: 0.03, enemy_shot: 0.05, ui_move: 0.03, telegraph: 0.08, kill: 0.04, cast_ember: 0.04, fire_bolt: 0.03, fire_hit: 0.06, punch: 0.05, whiff: 0.05, sword_hit: 0.05, sword_swish: 0.04, axe_hit: 0.05, axe_swish: 0.05 }[name] || 0.015;
  if (A.lastPlay[name] && now - A.lastPlay[name] < minGap) return;
  A.lastPlay[name] = now;
  const f = A.SFX[name]; if (f) { try { f(opts); } catch (e) { } }
};

/* --- Generative score ---
   D phrygian-minor. Layers crossfade with intensity: 0 hub, 1 explore, 2 combat, 3 warden. */
const SCALE = [0, 1, 3, 5, 7, 8, 10];
const PROG = [[0, 3, 7], [1, 5, 8], [5, 8, 12], [7, 10, 14]]; // i, bII, iv, v (semitones from D)
const ROOT = 146.83; // D3
A.musicInit = function () {
  const ctx = A.ctx;
  A.layers = {};
  for (const k of ['pad', 'bass', 'arp', 'drums', 'bell', 'choir']) { const g = ctx.createGain(); g.gain.value = 0; g.connect(A.music); A.layers[k] = g; }
  const pv = ctx.createGain(); pv.gain.value = 0.35; A.layers.bell.connect(pv); pv.connect(A.verbIn);
  const cv = ctx.createGain(); cv.gain.value = 0.5; A.layers.choir.connect(cv); cv.connect(A.verbIn);
  // pad: two detuned saws through a slowly moving lowpass
  A.pad = [];
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2; lp.connect(A.layers.pad);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  for (let i = 0; i < 4; i++) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = ROOT / 2; o.detune.value = (i - 1.5) * 9; const g = ctx.createGain(); g.gain.value = 0.11; o.connect(g); g.connect(lp); o.start(); A.pad.push(o); }
  A.padFilter = lp;
  A.step = 0; A.nextTime = ctx.currentTime + 0.1; A.bar = 0;
  A.timer = setInterval(A.schedule, 30);
};
A.setTheme = function (theme) {
  A.theme = theme;
  A.target = { title: 0, hub: 0, explore: 1, combat: 2, warden: 3, results: 0.5, silent: -1 }[theme] ?? 1;
};
A.schedule = function () {
  const ctx = A.ctx; if (!ctx || ctx.state !== 'running') return;
  // ease intensity
  A.intensity += (A.target - A.intensity) * 0.04;
  const I = A.intensity; const L = A.layers; const t0 = ctx.currentTime;
  const lv = (k, v) => L[k].gain.setTargetAtTime(v, t0, 0.4);
  if (A.target < 0) { for (const k in L) lv(k, 0); return; }
  lv('pad', 0.55 + 0.1 * Math.min(I, 2));
  lv('bell', I < 1.5 ? 0.35 : 0.12);
  lv('bass', H.clamp(I - 0.6, 0, 1) * 0.5);
  lv('arp', H.clamp(I - 1.2, 0, 1) * 0.22);
  lv('drums', H.clamp(I - 1.4, 0, 1.6) * 0.45);
  lv('choir', I > 2.5 ? 0.3 : I < 0.5 ? 0.18 : 0.06);
  const bpm = 84 + 14 * Math.min(I, 3);
  const sixteenth = 60 / bpm / 4;
  while (A.nextTime < t0 + 0.15) {
    A.tick(A.step, A.nextTime, sixteenth);
    A.nextTime += sixteenth; A.step = (A.step + 1) % 64;
  }
};
A.tick = function (step, t, sx) {
  const ctx = A.ctx, I = A.intensity, L = A.layers;
  const barIdx = Math.floor(step / 16) % 4; const chord = PROG[barIdx]; const s16 = step % 16;
  const f = semi => ROOT * Math.pow(2, semi / 12);
  if (s16 === 0) { // pad chord change
    A.pad.forEach((o, i) => o.frequency.setTargetAtTime(f(chord[i % 3] - 12 + (i === 3 ? 12 : 0)), t, 0.3));
    if (I > 2.5 || I < 0.5) { for (const n of chord) A.osc({ f: f(n + 12), type: 'triangle', v: 0.05, dur: sx * 15, a: sx * 4, out: L.choir, t }); }
  }
  // bell motif (sparse)
  if (I < 2 && (s16 === 0 || s16 === 10) && Math.random() < 0.6) {
    const n = chord[Math.floor(Math.random() * 3)] + 24 + (Math.random() < .3 ? SCALE[Math.floor(Math.random() * 7)] - chord[0] : 0);
    A.osc({ f: f(n), type: 'sine', v: 0.06, dur: 1.6, out: L.bell, t }); A.osc({ f: f(n) * 2.01, type: 'sine', v: 0.015, dur: 0.8, out: L.bell, t });
  }
  // bass
  if (I > 0.6) {
    const pattern = I > 2.5 ? [0, 3, 6, 8, 10, 14] : [0, 6, 10];
    if (pattern.includes(s16)) A.osc({ f: f(chord[0] - 12), type: 'sawtooth', v: 0.22, dur: sx * 2.2, lp: 420, out: L.bass, t });
  }
  // arp
  if (I > 1.2 && step % 2 === 0) {
    const seq = [0, 1, 2, 1, 2, 0, 2, 1]; const n = chord[seq[(step / 2) % 8]] + 12 + (Math.floor(step / 8) % 2 ? 12 : 0);
    A.osc({ f: f(n), type: 'triangle', v: 0.09, dur: sx * 1.6, lp: 2400, out: L.arp, t });
  }
  // drums
  if (I > 1.4) {
    const kick = I > 2.5 ? [0, 6, 8, 11] : [0, 8];
    if (kick.includes(s16)) A.osc({ f: 120, f2: 38, slide: 0.12, type: 'sine', v: 0.6, dur: 0.22, out: L.drums, t });
    if (s16 === 4 || s16 === 12) A.noise({ f: 1800, type: 'bandpass', q: 0.7, v: 0.28, dur: 0.12, out: L.drums, t });
    if (s16 % 2 === 0) A.noise({ f: 8000, type: 'highpass', v: s16 % 4 === 2 ? 0.1 : 0.05, dur: 0.035, out: L.drums, t });
    if (I > 2.5 && s16 === 15) A.noise({ f: 1200, type: 'bandpass', q: 0.7, v: 0.18, dur: 0.08, out: L.drums, t });
  }
};
