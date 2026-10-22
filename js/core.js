'use strict';
/* HEXWRIGHT — core: utilities, save data, settings, input (keyboard/mouse, gamepad, touch) */
const H = window.H = {};

H.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
H.lerp = (a, b, t) => a + (b - a) * t;
H.rand = (a, b) => a + Math.random() * (b - a);
H.pick = arr => arr[Math.floor(Math.random() * arr.length)];
H.dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
H.dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
H.norm = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
H.angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
H.roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
H.fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
H.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

H.rng = function (seed) {
  let a = seed >>> 0;
  const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.int = n => Math.floor(f() * n);
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.chance = p => f() < p;
  f.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  f.weighted = (items, wkey) => { let tot = 0; for (const it of items) tot += it[wkey]; let r = f() * tot; for (const it of items) { r -= it[wkey]; if (r <= 0) return it; } return items[items.length - 1]; };
  return f;
};

/* ---------------- Save data ---------------- */
const SAVE_KEY = 'hexwright.save.v1';
H.defaultSettings = () => ({
  lang: null, master: 0.8, music: 0.55, sfx: 0.85,
  quality: 'high', shake: 1, reduceFlash: false, dmgNumbers: true, hiTelegraph: false,
  textScale: 1, gameSpeed: 1, aimAssist: 'medium', mouseAssist: false, autoRepeat: true,
  allyFx: 0.6, statusGlyphs: true, touchScale: 1, showFps: false, rumble: true, padAutoAim: true
});
H.defaultBindings = () => ({
  kb: {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    cast1: ['Mouse0', 'KeyJ'], cast2: ['Mouse2', 'KeyK'], cast3: ['KeyQ', 'KeyL'], cast4: ['KeyE', 'Semicolon'], ult: ['KeyR', 'KeyV'],
    dash: ['Space', 'ShiftLeft'], interact: ['KeyF', 'KeyG'], map: ['Tab', 'KeyM'], inventory: ['KeyI', 'KeyB'], pause: ['Escape', 'KeyP']
  },
  pad: { cast1: 7, cast2: 6, cast3: 5, cast4: 4, ult: 3, dash: 0, interact: 2, map: 8, inventory: 11, pause: 9 }
});
H.defaultMeta = () => ({
  embers: 0, totalEmbers: 0,
  unlocked: { spells: [], charms: [], boons: ['none', 'ironbark'] },
  milestones: {},
  stats: { runs: 0, wins: 0, bestDepth: 0, bestScore: 0, rooms: 0, kills: 0, reactions: 0, interrupts: 0, elites: 0, wardens: 0, deaths: 0, arenaBestWave: 0, arenaBestScore: 0, vigilBest: 0, coopDepths: 0, playtime: 0 },
  lastBuild: null, lastBoon: 'none', equip: {}, bag: []
});
H.loadSave = function () {
  let data = null;
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) data = JSON.parse(raw); } catch (e) { data = null; }
  const s = { settings: H.defaultSettings(), bindings: H.defaultBindings(), meta: H.defaultMeta(), tutorialDone: false, seenTitle: false };
  if (data) {
    Object.assign(s.settings, data.settings || {});
    if (data.bindings) { Object.assign(s.bindings.kb, data.bindings.kb || {}); Object.assign(s.bindings.pad, data.bindings.pad || {}); if (data.bindings.kb && !data.bindings.kb.ult) s.bindings.kb.interact = (s.bindings.kb.interact || []).map(c => c === 'KeyR' ? 'KeyG' : c); }
    if (data.meta) {
      const m = data.meta; Object.assign(s.meta, m);
      s.meta.unlocked = Object.assign(H.defaultMeta().unlocked, m.unlocked || {});
      s.meta.stats = Object.assign(H.defaultMeta().stats, m.stats || {});
      s.meta.milestones = m.milestones || {};
    }
    s.tutorialDone = !!data.tutorialDone;
  }
  H.save = s; H.settings = s.settings;
};
H.saveNow = function () {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(H.save)); } catch (e) { /* storage unavailable: progress lives for this session */ }
};
H.resetSave = function () {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  H.loadSave();
};
H.loadSave();

/* ---------------- Input ---------------- */
const ACTIONS = ['up', 'down', 'left', 'right', 'cast1', 'cast2', 'cast3', 'cast4', 'ult', 'dash', 'interact', 'map', 'inventory', 'pause'];
H.ACTIONS = ACTIONS;
H.ACTION_NAMES = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right', cast1: 'Spell slot I', cast2: 'Spell slot II', cast3: 'Spell slot III', cast4: 'Spell slot IV', ult: 'Ultimate', dash: 'Dash', interact: 'Interact', map: 'Chamber map', inventory: 'Inventory', pause: 'Pause' };
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D↑', 'D↓', 'D←', 'D→', 'Home'];
H.padName = i => PAD_NAMES[i] || ('B' + i);
H.keyName = code => {
  if (!code) return '—';
  if (code === 'Mouse0') return H.t ? H.t('LMB') : 'LMB'; if (code === 'Mouse2') return H.t ? H.t('RMB') : 'RMB'; if (code === 'Mouse1') return H.t ? H.t('MMB') : 'MMB';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Tab: 'Tab', Semicolon: ';', Enter: 'Enter', Backquote: '`', Comma: ',', Period: '.', Slash: '/', Quote: "'", BracketLeft: '[', BracketRight: ']', Backspace: 'Bksp', CapsLock: 'Caps' };
  const n = map[code] || code; return H.t ? H.t(n) : n;
};

const I = H.input = {
  keys: new Set(), keysPressed: new Set(), mouse: { x: 0, y: 0, down: new Set(), pressed: new Set(), released: new Set(), inside: false },
  pads: [], padPrev: {}, padPressed: {}, lastDevice: 'kbm', anyPressedHook: null, captureHook: null,
  touch: { enabled: false, stick: null, btn: {}, },
  menu: { up: 0, down: 0, left: 0, right: 0, confirm: 0, back: 0, tabL: 0, tabR: 0 }, menuRepeat: { dir: null, t: 0 },
  wheel: 0
};
I.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);

window.addEventListener('keydown', e => {
  if (I.captureHook) { e.preventDefault(); I.captureHook({ type: 'key', code: e.code }); return; }
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !(e.target && e.target.tagName === 'INPUT' && e.target.type === 'text')) e.preventDefault();
  if (!e.repeat) { I.keysPressed.add(e.code); if (I.anyPressedHook) I.anyPressedHook('kbm'); }
  I.keys.add(e.code); I.lastDevice = 'kbm';
});
window.addEventListener('keyup', e => { I.keys.delete(e.code); });
window.addEventListener('blur', () => { I.keys.clear(); I.mouse.down.clear(); });
window.addEventListener('mousemove', e => { I.mouse.x = e.clientX; I.mouse.y = e.clientY; I.mouse.inside = true; if (!I.touchActiveRecently()) I.lastDevice = 'kbm'; });
window.addEventListener('mousedown', e => {
  if (I.touchActiveRecently()) return;
  if (I.captureHook && e.target && e.target.closest && !e.target.closest('[data-nocapture]')) { e.preventDefault(); I.captureHook({ type: 'key', code: 'Mouse' + e.button }); return; }
  I.mouse.down.add(e.button); I.mouse.pressed.add(e.button); I.lastDevice = 'kbm';
  if (I.anyPressedHook) I.anyPressedHook('kbm');
});
window.addEventListener('mouseup', e => { I.mouse.down.delete(e.button); I.mouse.released.add(e.button); });
window.addEventListener('contextmenu', e => { if (e.target && e.target.id === 'gl' || (H.G && H.G.active)) e.preventDefault(); });
window.addEventListener('wheel', e => { I.wheel += Math.sign(e.deltaY); }, { passive: true });
let lastTouchTime = -1e9;
I.touchActiveRecently = () => performance.now() - lastTouchTime < 900;
window.addEventListener('touchstart', () => { lastTouchTime = performance.now(); I.lastDevice = 'touch'; I.touch.enabled = true; if (I.anyPressedHook) I.anyPressedHook('touch'); }, { passive: true, capture: true });

I.kbDown = action => { const b = H.save.bindings.kb[action] || []; for (const c of b) { if (!c) continue; if (c.startsWith('Mouse')) { if (I.mouse.down.has(+c.slice(5))) return true; } else if (I.keys.has(c)) return true; } return false; };
I.kbPressed = action => { const b = H.save.bindings.kb[action] || []; for (const c of b) { if (!c) continue; if (c.startsWith('Mouse')) { if (I.mouse.pressed.has(+c.slice(5))) return true; } else if (I.keysPressed.has(c)) return true; } return false; };

I.pollPads = function () {
  const raw = navigator.getGamepads ? navigator.getGamepads() : [];
  const pads = [];
  for (const gp of raw) { if (gp && gp.connected) pads.push(gp); }
  I.pads = pads;
  I.padPressed = {};
  for (const gp of pads) {
    const prev = I.padPrev[gp.index] || [];
    const cur = gp.buttons.map(b => b.pressed || b.value > 0.5);
    const pr = cur.map((v, i) => v && !prev[i]);
    I.padPressed[gp.index] = pr;
    if (pr.some(x => x)) {
      I.lastDevice = 'pad';
      if (I.captureHook) { const bi = pr.indexOf(true); I.captureHook({ type: 'pad', button: bi }); }
      else if (I.anyPressedHook) I.anyPressedHook('pad');
    }
    const ax = gp.axes;
    if (Math.abs(ax[0] || 0) > 0.5 || Math.abs(ax[1] || 0) > 0.5 || Math.abs(ax[2] || 0) > 0.5 || Math.abs(ax[3] || 0) > 0.5) I.lastDevice = 'pad';
    I.padPrev[gp.index] = cur;
  }
};
I.padByIndex = idx => I.pads.find(p => p.index === idx) || null;
I.padButtonDown = (gp, b) => !!(gp && gp.buttons[b] && (gp.buttons[b].pressed || gp.buttons[b].value > 0.5));
I.padButtonPressed = (gp, b) => !!(gp && I.padPressed[gp.index] && I.padPressed[gp.index][b]);
const dz = (x, y, d = 0.22) => { const m = Math.hypot(x, y); if (m < d) return [0, 0]; const s = Math.min(1, (m - d) / (1 - d)) / m; return [x * s, y * s]; };
I.padStick = (gp, which) => { if (!gp) return [0, 0]; const o = which === 'L' ? 0 : 2; return dz(gp.axes[o] || 0, gp.axes[o + 1] || 0, which === 'L' ? 0.2 : 0.25); };
I.rumble = (gp, strong, weak, ms) => {
  if (!H.settings.rumble || !gp || !gp.vibrationActuator) return;
  try { gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { }
};

/* Menu input derived each frame */
I.updateMenu = function (dt) {
  const m = I.menu; for (const k in m) m[k] = 0;
  if (I.captureHook) return;
  const kp = c => I.keysPressed.has(c);
  if (kp('ArrowUp')) m.up = 1; if (kp('ArrowDown')) m.down = 1; if (kp('ArrowLeft')) m.left = 1; if (kp('ArrowRight')) m.right = 1;
  if (kp('Enter') || kp('NumpadEnter')) m.confirm = 1;
  if (kp('Escape') || kp('Backspace')) m.back = 1;
  if (kp('KeyQ')) m.tabL = 1; if (kp('KeyE')) m.tabR = 1;
  let dir = null;
  for (const gp of I.pads) {
    if (I.padButtonPressed(gp, 0)) m.confirm = 1;
    if (I.padButtonPressed(gp, 1)) m.back = 1;
    if (I.padButtonPressed(gp, 4)) m.tabL = 1;
    if (I.padButtonPressed(gp, 5)) m.tabR = 1;
    if (I.padButtonPressed(gp, 12)) m.up = 1; if (I.padButtonPressed(gp, 13)) m.down = 1;
    if (I.padButtonPressed(gp, 14)) m.left = 1; if (I.padButtonPressed(gp, 15)) m.right = 1;
    const [sx, sy] = I.padStick(gp, 'L');
    if (Math.abs(sx) > 0.55 || Math.abs(sy) > 0.55) dir = Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up');
  }
  const r = I.menuRepeat;
  if (dir) { if (r.dir !== dir) { r.dir = dir; r.t = 0.38; m[dir] = 1; } else { r.t -= dt; if (r.t <= 0) { r.t = 0.13; m[dir] = 1; } } }
  else r.dir = null;
};

I.endFrame = function () { I.keysPressed.clear(); I.mouse.pressed.clear(); I.mouse.released.clear(); I.wheel = 0; for (const k in I.touch.btn) { const b = I.touch.btn[k]; b.pressed = false; b.released = false; } };

/* Label for an action given a player's input source */
I.label = function (action, src) {
  src = src || (I.lastDevice === 'pad' ? 'pad' : I.lastDevice === 'touch' ? 'touch' : 'kbm');
  if (src.startsWith('pad')) { const b = H.save.bindings.pad[action]; return b == null ? '—' : H.padName(b); }
  if (src === 'touch') { const v = { cast1: 'I', cast2: 'II', cast3: 'III', cast4: 'IV', ult: 'ULT', inventory: 'Bag', dash: 'Dash', interact: 'Tap', map: 'Map', pause: 'II' }[action] || ''; return H.t ? H.t(v) : v; }
  return H.keyName((H.save.bindings.kb[action] || [])[0]);
};

/* Build a per-player intent for this frame. src: 'kbm' | 'pad:<index>' | 'touch' | 'bot' */
I.readPlayer = function (src) {
  const out = { mx: 0, mz: 0, aimX: 0, aimZ: 0, aimMode: 'none', aimPt: null, held: {}, pressed: {}, released: {}, padRef: null };
  const casts = ['cast1', 'cast2', 'cast3', 'cast4', 'ult', 'dash', 'interact', 'map', 'inventory', 'pause'];
  if (src === 'kbm') {
    out.mx = (I.kbDown('right') ? 1 : 0) - (I.kbDown('left') ? 1 : 0);
    out.mz = (I.kbDown('down') ? 1 : 0) - (I.kbDown('up') ? 1 : 0);
    for (const a of casts) { out.held[a] = I.kbDown(a); out.pressed[a] = I.kbPressed(a); }
    if (I.mouse.inside && H.R && H.R.ready) { const p = H.R.screenToGround(I.mouse.x, I.mouse.y); if (p) { out.aimPt = p; out.aimMode = 'point'; } }
  } else if (src.startsWith('pad')) {
    const gp = I.padByIndex(+src.split(':')[1]); out.padRef = gp;
    if (gp) {
      const [lx, ly] = I.padStick(gp, 'L'); out.mx = lx; out.mz = ly;
      if (I.padButtonDown(gp, 12)) out.mz = -1; if (I.padButtonDown(gp, 13)) out.mz = 1; if (I.padButtonDown(gp, 14)) out.mx = -1; if (I.padButtonDown(gp, 15)) out.mx = 1;
      const [rx, ry] = I.padStick(gp, 'R');
      if (rx || ry) { out.aimX = rx; out.aimZ = ry; out.aimMode = 'dir'; }
      const pb = H.save.bindings.pad;
      for (const a of casts) { out.held[a] = I.padButtonDown(gp, pb[a]); out.pressed[a] = I.padButtonPressed(gp, pb[a]); }
    }
  } else if (src === 'touch') {
    const t = I.touch;
    if (t.stick) { out.mx = t.stick.vx; out.mz = t.stick.vy; }
    for (const a of casts) { const b = t.btn[a]; if (!b) continue; out.held[a] = b.held; out.pressed[a] = b.pressed; out.released[a] = b.released; if (b.dragging && (b.ax || b.az)) { out.aimX = b.ax; out.aimZ = b.az; out.aimMode = 'dir'; out.touchAiming = a; } if (b.released && b.relAim) { out.aimX = b.relAim[0]; out.aimZ = b.relAim[1]; out.aimMode = 'dir'; } }
  }
  const ml = Math.hypot(out.mx, out.mz); if (ml > 1) { out.mx /= ml; out.mz /= ml; }
  return out;
};

/* ---------------- Glyph paths (24x24) shared by SVG UI and canvas textures ---------------- */
H.GLYPH = {
  ember: { d: 'M12 2c1.2 4.2 6.5 6.3 6.5 12.3a6.5 6.5 0 0 1-13 0c0-3.1 1.9-5.1 3.1-6.3.1 2 1.1 3.3 2.3 3.6-.3-4.3-.6-6.6 1.1-9.6z', fill: true },
  frost: { d: 'M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17M9 3.8l3 2.6 3-2.6M9 20.2l3-2.6 3 2.6M4 10.6l3.8-.8-1.2-3.7M20 13.4l-3.8.8 1.2 3.7M20 10.6l-3.8-.8 1.2-3.7M4 13.4l3.8.8-1.2 3.7', fill: false },
  volt: { d: 'M13.5 1.5L4 13.5h6.2L8.8 22.5 19.5 9.6h-6.3z', fill: true },
  venom: { d: 'M12 2.2s7.2 8 7.2 13a7.2 7.2 0 0 1-14.4 0c0-5 7.2-13 7.2-13zM9 14.5a3 3 0 0 0 3 3', fill: true },
  gale: { d: 'M2.5 8.5h11.5a3.2 3.2 0 1 0-3.2-3.2M2.5 12.5h16a3.2 3.2 0 1 1-3.2 3.2M2.5 16.5h7', fill: false },
  stone: { d: 'M7 2.5h10l5 7.5-5 11.5H7L2 10z', fill: true },
  void: { d: 'M12 2.5a9.5 9.5 0 1 1 0 19a9.5 9.5 0 1 1 0-19zM12 8.6a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8z', fill: false },
  combat: { d: 'M4 3l11 11M20 3L9 14M13 17l5-5M6 12l5 5M3 21l4-4M21 21l-4-4', fill: false },
  elite: { d: 'M2.5 18.5l2-12 5 5.3L12 3.5l2.5 8.3 5-5.3 2 12zM4 20.5h16', fill: true },
  challenge: { d: 'M5.5 2.5h13M5.5 21.5h13M7 2.5c0 6 10 7 10 19M17 2.5c0 6-10 7-10 19', fill: false },
  rest: { d: 'M12 21.5s-8.5-5.3-8.5-11.4a4.6 4.6 0 0 1 8.5-2.5 4.6 4.6 0 0 1 8.5 2.5c0 6.1-8.5 11.4-8.5 11.4z', fill: true },
  shrine: { d: 'M12 1.8l2.7 6.6 7.1.5-5.4 4.6 1.7 6.9L12 16.6l-6.1 3.8 1.7-6.9L2.2 8.9l7.1-.5z', fill: false },
  treasure: { d: 'M3 10h18v10.5H3zM5 4h14l2 5H3zM10.5 12h3v4h-3z', fill: true },
  mystery: { d: 'M1.8 12S5.6 5 12 5s10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12zM12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z', fill: false },
  warden: { d: 'M3.5 2.5l3.2 5.3a7.4 7.4 0 0 1 10.6 0l3.2-5.3.9 9.2a9 9 0 0 1-4.2 7.3v2.5H6.8V19a9 9 0 0 1-4.2-7.3zM8.5 12.5h2v2h-2zM13.5 12.5h2v2h-2z', fill: true },
  attack: { d: 'M3 21l9-9M14 4l6 0 0 6-9 9-6-6z', fill: false },
  movement: { d: 'M3 12h12M11 6l6 6-6 6M19 5v14', fill: false },
  defense: { d: 'M12 2.5l8 3.2v6.1c0 4.7-3.4 8.4-8 9.7-4.6-1.3-8-5-8-9.7V5.7z', fill: false },
  control: { d: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8z', fill: false },
  ember_small: null,
  k_flame: { d: 'M2.5 12l9-4.5c2.5-1.2 4.5-3.2 8-3.7-1.2 2-1 3.5 0 5 .8 1.3 1.8 2 1.8 3.2s-1 1.9-1.8 3.2c-1 1.5-1.2 3 0 5-3.5-.5-5.5-2.5-8-3.7z', fill: true },
  k_meteor: { d: 'M15.5 11a5 5 0 1 1 0 10a5 5 0 1 1 0-10zM12 12.5L3 3.5M14.5 10L8.5 2.5M10 14.5L2.5 9', fill: false },
  k_nova: { d: 'M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5M4.6 4.6l3.6 3.6M15.8 15.8l3.6 3.6M4.6 19.4l3.6-3.6M15.8 8.2l3.6-3.6M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z', fill: false },
  eq_head: { d: 'M4 15c0-5 3.6-9.5 8-9.5s8 4.5 8 9.5M2.5 15h19M12 5.5V3M7.5 15v3h9v-3', fill: false },
  eq_chest: { d: 'M8 3L3.5 6.5 5.5 10.5 7 9.5V21h10V9.5l1.5 1 2-4L16 3c-.8 1.6-2.2 2.5-4 2.5S8.8 4.6 8 3z', fill: false },
  eq_legs: { d: 'M6 3h12l.8 18h-4.6L12 10l-2.2 11H5.2z', fill: false },
  eq_feet: { d: 'M7 3h5v11l7 2.5c1.2.4 2 1.4 2 2.6V21H4.5L5 14z', fill: false },
  eq_weapon: { d: 'M5 21L16.5 9.5M14 5.5a3.5 3.5 0 1 1 5 5M18.5 3.5l2 2M12 13l-1-1', fill: false },
  eq_ring: { d: 'M12 8.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13zM9 5.5l3-3 3 3-3 2.5z', fill: false },
  eq_cloak: { d: 'M8 3h8l1 3 4 15H3L7 6zM8 3c0 2 2 3 4 3s4-1 4-3', fill: false },
  it_helm: { d: 'M4 16c0-6 3.6-11 8-11s8 5 8 11zM3 16h18v3H3zM12 5v11M8.5 10h7', fill: false },
  k_fist: { d: 'M7 10V7.5a1.5 1.5 0 0 1 3 0V10M10 9.5V6.5a1.5 1.5 0 0 1 3 0v3M13 9.5V7a1.5 1.5 0 0 1 3 0v3.5M16 10.5V9a1.5 1.5 0 0 1 3 0v4c0 4-2.5 7-6.5 7S7 18 7 14v-4c0-1 .7-1.5 1.5-1.5S10 9 10 10v1.5', fill: false },
  it_ghelm: { d: 'M5 20V9c0-4 3.2-6.5 7-6.5S19 5 19 9v11zM5 11.5h14M12 2.5V20M8.5 15h1M14.5 15h1M8.5 17.5h1M14.5 17.5h1', fill: false },
  it_hat: { d: 'M2 19c3-2 7-2.5 10-2.5S19 17 22 19M6 17.2L11 3l3 5-1 1 4 8.5M8.5 13h7', fill: false },
  it_hood: { d: 'M12 2.5c-5 0-8 5-8 10v8.5h4.5v-6a3.5 4 0 0 1 7 0v6H20v-8.5c0-5-3-10-8-10z', fill: false },
  it_cuirass: { d: 'M7 3h10l3 4-2 3v11H6V10L4 7zM9 3c0 2 1.3 3 3 3s3-1 3-3M12 10v9M8 13h8', fill: false },
  it_robe: { d: 'M8 3l-4 4 2 3 1-1-2 12h14L17 9l1 1 2-3-4-4c-.8 1.6-2.2 2.5-4 2.5S8.8 4.6 8 3zM12 6v15', fill: false },
  it_scale: { d: 'M7 3h10l3 4-2 3v11H6V10L4 7zM8 11c1 1.5 3 1.5 4 0 1 1.5 3 1.5 4 0M8 15c1 1.5 3 1.5 4 0 1 1.5 3 1.5 4 0', fill: false },
  it_greaves: { d: 'M6 3h5v14l1 4H5l1-4zM13 3h5v14l1 4h-7l1-4zM6 8h5M13 8h5', fill: false },
  it_pants: { d: 'M6 3h12l.8 18h-4.6L12 10l-2.2 11H5.2zM6 6h12', fill: false },
  it_boots: { d: 'M7 3h5v11l7 2.5c1.2.4 2 1.4 2 2.6V21H4.5L5 14zM5 18h16', fill: false },
  it_cloak: { d: 'M8 3h8l1 3 4 15H3L7 6zM8 3c0 2 2 3 4 3s4-1 4-3M12 6v15', fill: false },
  it_feather: { d: 'M8 3h8l1 3 4 15H3L7 6zM8 3c0 2 2 3 4 3s4-1 4-3M7 12l3-1M17 12l-3-1M6 16l3.5-1M18 16l-3.5-1M12 7v13', fill: false },
  merchant: { d: 'M6 8h12l1.5 13h-15zM9 8V6.5a3 3 0 0 1 6 0V8M12 11.5v6M10 13h3a1.2 1.2 0 0 1 0 2.4h-2a1.2 1.2 0 0 0 0 2.4h3', fill: false },
  eq_bag: { d: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2', fill: false },
  k_storm: { d: 'M2.5 4h19M4.5 8h15M7 12h10M9 16h6M11 20h3', fill: false },
  it_sword: { d: 'M18.5 3.5h2v2L9.5 16.5l-2-2zM6 13l5 5M7.5 16.5l-3 3M4 19.5l.5.5M6.5 13.5l-1.5-1.5M11.5 18.5l-1.5-1.5', fill: false },
  k_slash: { d: 'M4 18C8 10 13 6 20 4M20 4l-1 4M20 4l-4 .5M6 20l2-2', fill: false },
  k_thrust: { d: 'M3 12h14M17 12l-3-3M17 12l-3 3M17 9.5l4 2.5-4 2.5M5 9v6', fill: false },
  k_cleave: { d: 'M12 3v11M8 7l4-4 4 4M4 20a8 8 0 0 1 16 0M7 20l2-3M17 20l-2-3M12 17v3', fill: false },
  k_spin: { d: 'M12 4a8 8 0 1 1-7.4 5M4.6 9L3.5 4.8M4.6 9l4.2-.8M12 9v3l2 2', fill: false },
  it_axe: { d: 'M6 21L15.5 6.5M13 4.5c2.5-1.5 5.5-1 7 1.5l-3.6 5.2c-1.6-.4-3.3-1.4-4.5-3zM7.5 19l1.5 1', fill: false },
  it_bastard: { d: 'M19 3h2v2L10.5 15.5l-2-2zM6.5 12.5l5 5M8 16.5l-4.5 4.5M3 20.5l.5.5M14 7l1 1', fill: false },
  k_axe: { d: 'M5 20L14 8M11.5 5.5c2.5-1.8 6-1.2 7.5 1.3l-3.8 5.4c-1.7-.4-3.6-1.5-4.8-3.3zM4 9c1.5-3 4-5 7-6', fill: false },
  k_sweep: { d: 'M20 16A9 9 0 0 0 4 16M4 16l-.5-4M4 16l4-1M12 7v4M9.5 9.5L12 7l2.5 2.5', fill: false },
  k_smash: { d: 'M12 3v10M8.5 6.5L12 3l3.5 3.5M5 21l7-6 7 6M7.5 21h9M3 13h3M18 13h3', fill: false },
  k_axethrow: { d: 'M4 18c4-1 8-4 10-9M14 9l-1 4M14 9l-4 .5M17 4.5a2.5 2.5 0 1 1 3 3l-2 1.5-2.5-2.5zM20 14l1 1M18 17l1 1', fill: false },
  k_backhand: { d: 'M5 12a7 7 0 1 1 7 7M5 12l-2-3M5 12l3-2M14 9l4 4M18 9l-4 4', fill: false },
  k_execute: { d: 'M4 20L18 6M18 6h3v3M15 3l6 6M7 21l-4-4M9 12l3 3', fill: false },
  st_bleed: { d: 'M12 2.5c3.2 4.6 6.2 8.1 6.2 11.8a6.2 6.2 0 0 1-12.4 0C5.8 10.6 8.8 7.1 12 2.5z', fill: true },
  st_daze: { d: 'M10 12a2 2 0 1 0 4 0a4 4 0 1 0-8 0a6 6 0 1 0 12 0M19 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z', fill: false },
  st_flay: { d: 'M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.8-8 10.6-8 10.6zM12 7.4l-1.8 4.2 3.4 2.2-1.6 3.4', fill: false },
  st_regen: { d: 'M9 21v-8H5l7-8.5 7 8.5h-4v8zM3 4h4M17 4h4', fill: false },
  st_heal: { d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', fill: true },
  cls: { d: 'M12 3a5 5 0 0 1 5 5c0 2-1 3.2-2 4v2.5H9V12c-1-.8-2-2-2-4a5 5 0 0 1 5-5zM10 9.5h.01M14 9.5h.01M9.5 17.5h5M10 20.5h4', fill: false }
};
H.glyphSVG = (name, color, size = 24, extra = '') => {
  const g = H.GLYPH[name]; if (!g) return '';
  const c = color || 'currentColor';
  return `<svg class="glyph ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${g.d}" fill="${g.fill ? c : 'none'}" stroke="${c}" stroke-width="${g.fill ? 0.6 : 1.8}" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd"/></svg>`;
};
H.drawGlyph = (ctx, name, x, y, size, color, lw) => {
  const g = H.GLYPH[name]; if (!g) return;
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  const p = new Path2D(g.d);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (g.fill) { ctx.fillStyle = color; ctx.fill(p, 'evenodd'); } else { ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.stroke(p); }
  ctx.restore();
};

/* Text scale: user setting, shrunk automatically on short (phone-landscape) screens */
H.applyTextScale = function () {
  const compact = window.matchMedia && window.matchMedia('(max-height: 500px)').matches;
  document.documentElement.style.setProperty('--ts', (H.settings.textScale || 1) * (compact ? 0.8 : 1));
  document.documentElement.classList.toggle('compact', !!compact);
};
