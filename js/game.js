'use strict';
/* HEXWRIGHT — game: run flow, players, spells, statuses, reactions, rooms, modes */
const G = H.G = {
  active: false, paused: false, modal: null, players: [], enemies: [], projs: [], zones: [], tgs: [], totems: [],
  run: null, room: null, time: 0, slow: { t: 0, s: 1 }, hitstop: 0, god: false, events: {}, uid: 1
};
G.timers = [];
G.after = (fn, ms) => { G.timers.push({ t: (ms || 0) / 1000, fn }); };
G.runTimers = dt => { if (!G.timers.length) return; const due = []; for (const t of G.timers) { t.t -= dt; if (t.t <= 0) due.push(t); } if (due.length) { G.timers = G.timers.filter(t => t.t > 0); for (const t of due) { try { t.fn(); } catch (err) { console.error(err); } } } };
G.emit = (name, data) => { if (H.UI && H.UI.onGame) H.UI.onGame(name, data || {}); };
G.timeScale = () => (G.slow.t > 0 ? G.slow.s : 1) * (H.settings.gameSpeed || 1);
G.setSlow = (s, t) => { G.slow.s = s; G.slow.t = t; };
G.float = (x, y, z, text, cls) => { if (H.UI && H.UI.floatText) H.UI.floatText(x, y, z, H.t ? H.t(text) : text, cls); };
G.depthMul = () => G.run ? 1 + 0.32 * (G.run.depth - 1) : 1;

/* ---------------- Availability (meta unlocks) ---------------- */
G.spellUnlocked = id => { const d = H.SPELLS[id]; if (!d) return false; if (d.start) return true; const m = H.save.meta; if (m.unlocked.spells.includes(id)) return true; if (d.milestone && m.milestones[d.milestone]) return true; return false; };
G.charmUnlocked = id => { const l = H.CHARM_LOCKED[id]; if (!l) return true; const m = H.save.meta; if (m.unlocked.charms.includes(id)) return true; if (l.milestone && m.milestones[l.milestone]) return true; return false; };
G.boonUnlocked = id => { const b = H.BOONS[id]; const m = H.save.meta; if (m.unlocked.boons.includes(id)) return true; if (b.milestone && m.milestones[b.milestone]) return true; return false; };
G.availableSpells = () => Object.keys(H.SPELLS).filter(id => !H.SPELLS[id].kit && !H.SPELLS[id].hero && G.spellUnlocked(id));
G.heroOf = owner => H.HEROES[(owner && owner.charId) || 'percy'] || H.HEROES.percy;
G.kitFor = owner => { const hero = G.heroOf(owner); if (hero.kit) return H.KITS[hero.kit] || null; const pr = owner && owner.spells && owner.spells[0]; return pr ? (H.KITS[H.SPELLS[pr.id].el] || null) : null; };
/* Primary attack for a player: the equipped main weapon's primary if it names one, else the hero's chosen/default primary. */
G.primaryFor = function (p) { const k = G.weaponKit(p); if (k && H.SPELLS[k.primary]) return k.primary; return p.basePrimary; };
/* Each hero keeps their own equipment and bag (meta.gear[charId]). The old shared inventory is migrated once. */
G.heroGear = function (charId) {
  const me = H.save.meta; charId = charId || me.character || 'percy';
  me.gear = me.gear || {};
  if (!me.gearMigrated) {
    me.gearMigrated = true;
    const oldEq = me.equip || {}, oldBag = (me.bag || []).filter(Boolean);
    const owner = me.character && H.CHARACTERS && H.CHARACTERS[me.character] ? me.character : 'percy';
    const fill = (id, hero) => { const g = G.heroGear(hero); const i = g.bag.findIndex(x => !x); if (i >= 0) g.bag[i] = id; };
    for (const k in oldEq) { const id = oldEq[k]; if (!id || !H.ITEMS[id]) continue; const lock = H.ITEMS[id].hero; const hero = lock || owner; const g = G.heroGear(hero); if (!g.equip[k]) g.equip[k] = id; else fill(id, hero); }
    for (const id of oldBag) { if (!H.ITEMS[id]) continue; fill(id, H.ITEMS[id].hero || owner); }
    me.equip = {}; me.bag = [];
  }
  let g = me.gear[charId];
  if (!g) g = me.gear[charId] = { equip: {}, bag: [] };
  for (const sl of H.EQUIP_SLOTS) if (!(sl.id in g.equip)) g.equip[sl.id] = null;
  for (let i = 0; i < H.BAG_SIZE; i++) if (g.bag[i] === undefined) g.bag[i] = null;
  if (g.equip.weapon && G.itemDisabled(g.equip.weapon)) { const f = g.bag.findIndex(x => !x); if (f >= 0) { g.bag[f] = g.equip.weapon; g.equip.weapon = null; } }
  if (H.DISABLED_WEAPONS && H.DISABLED_WEAPONS.fists && H.DEFAULT_WEAPON[charId] && (!g.equip.weapon || G.itemDisabled(g.equip.weapon))) { if (g.equip.weapon) { const f = g.bag.findIndex(x => !x); if (f >= 0) g.bag[f] = g.equip.weapon; } g.equip.weapon = H.DEFAULT_WEAPON[charId]; }
  return g;
};
/* Hero-locked items (weapons): Percy can't equip them. */
G.canUse = (p, id) => { const it = H.ITEMS[id]; return !!it && !G.itemDisabled(id) && (!it.hero || ((p && p.charId) || 'percy') === it.hero); };
G.itemDisabled = id => { const it = H.ITEMS[id]; return !!(it && it.weapon && H.DISABLED_WEAPONS && H.DISABLED_WEAPONS[it.weapon]); };
/* With the fists switched off, a hero that has a default weapon always holds one. Returns true if it changed. */
G.ensureWeapon = function (p) {
  const dw = H.DISABLED_WEAPONS && H.DISABLED_WEAPONS.fists && H.DEFAULT_WEAPON[p.charId]; if (!dw || !p.equip) return false;
  const cur = p.equip.weapon; if (cur && G.canUse(p, cur)) return false;
  p.equip.weapon = dw; return true;
};
G.weaponKit = p => { const id = p.equip && p.equip.weapon; const it = id && H.ITEMS[id]; return it && it.weapon && G.canUse(p, id) ? H.WEAPON_KITS[it.weapon] : null; };
/* Equip/unequip a main weapon: slot I becomes its basic attack, slots II–IV take its attacks. */
G.refreshWeapon = function (p) {
  if (!p.spells || p.kind !== 'player') return;
  const k = G.weaponKit(p); const skills = k ? (H.WEAPON_SKILLS_OFF ? [] : k.skills.slice()) : [];
  const special = k && k.special && H.SPELLS[k.special] ? k.special : null; if (special) skills.push(special);
  G.refreshPrimary(p);
  for (let i = 1; i < 4; i++) { const s = p.spells[i]; if (s && H.SPELLS[s.id].weapon && !skills.includes(s.id)) p.spells[i] = null; }
  // the Special always sits on slot III (Q)
  if (special) { const SL = H.SPECIAL_SLOT; const at = p.spells.findIndex(x => x && x.id === special); if (at !== SL) { const prev = p.spells[SL]; p.spells[SL] = at > 0 ? p.spells[at] : { id: special, rank: 1, cd: 0 }; if (at > 0) p.spells[at] = null; if (prev && prev.id !== special) { const f = [1, 2, 3].find(j => !p.spells[j]); if (f != null) p.spells[f] = prev; } } }
  for (const id of skills) { if (p.spells.some(s => s && s.id === id)) continue; const i = [1, 2, 3].find(j => !p.spells[j]); if (i != null) p.spells[i] = { id, rank: 1, cd: 0 }; }
  // a weapon's ultimate takes the ultimate slot while it is equipped (off with the weapon skills: R is the Aid's Call)
  if (k && k.ult && !H.WEAPON_SKILLS_OFF) { if (!p.ult || p.ult.id !== k.ult) { const d = H.SPELLS[k.ult]; p.ult = { id: k.ult, rank: 1, cd: 0, charges: d.charges || 0 }; } }
  else if (p.ult && H.SPELLS[p.ult.id].weapon) p.ult = null;
};
G.refreshPrimary = function (p) { const id = G.primaryFor(p); if (!p.spells[0] || p.spells[0].id !== id) { const old = p.spells[0]; p.spells[0] = { id, rank: old && !H.SPELLS[old.id].weapon && !H.SPELLS[id].weapon ? old.rank : 1, cd: 0 }; } };

/* ---------------- Run setup ---------------- */
// cfg: { mode:'solo'|'coop'|'arena'|'tutorial', arenaRule, seats:[{src, build:[4 ids], boon}] }
G.newRun = function (cfg) {
  G.timers = []; G.ending = null; G.transitioning = false; G.slow.t = 0; G.hitstop = 0;
  G.clearAll();
  const seed = (Math.random() * 1e9) | 0;
  G.run = {
    mode: cfg.mode, arenaRule: cfg.arenaRule || 'siege', seed, rng: H.rng(seed), depth: 1, map: null, node: null, cfg,
    time: 0, score: 0, kills: 0, rooms: 0, elites: 0, wardens: 0, reactions: 0, reactionsBy: {}, interrupts: 0, dodges: 0,
    dmgBySpell: {}, castsBySpell: {}, killsBy: {}, hitsTaken: 0, embers: 0, milestonesNew: [], unlocksNew: [], deathCause: null,
    xp: 0, level: 1, xpNext: 0, pendingLevels: 0, xpTotal: 0,
    victory: false, wave: 0, combo: 0, comboT: 0, bestCombo: 0, startRanks: {}, curse: 0, kilnKills: 0, depthsCleared: 0, log: []
  };
  G._gearTaken = new Set();
  G.players = cfg.seats.map((s, i) => G.makePlayer(i, s));
  G.active = true; G.paused = false; G.modal = null;
  G.run.xpNext = G.xpNeed(1);
  G.emit('runStart');
  if (cfg.mode === 'arena') { G.startArena(); }
  else if (cfg.mode === 'tutorial') { G.startTutorial(); }
  else { H.save.meta.stats.runs++; G.run.map = G.genMap(1); G.enterNode(G.run.map.layers[0][0]); }
  G.emit('runReady');
};
G.makePlayer = function (idx, seat) {
  const accent = idx === 0 ? 0xd9a441 : 0x46e0c8;
  const p = {
    kind: 'player', idx, src: seat.src, x: 0, z: 0, vx: 0, vz: 0, r: 0.5, hp: 100, maxHp: 100, mana: 100, maxMana: 100, manaRegen: 15, speed: H.MOVE.speed,
    spells: [0, 1, 2, 3].map(i => seat.build[i] ? { id: seat.build[i], rank: 1, cd: 0 } : null), mods: {}, ups: {}, passives: {}, ult: null, equip: { head: null, chest: null, legs: null, feet: null, cloak: null, weapon: null, ring1: null, ring2: null }, gear: {}, bag: new Array(H.BAG_SIZE).fill(null), charms: new Set(), boon: seat.boon || 'none',
    dashMax: H.MOVE.dashCharges, dashCharges: H.MOVE.dashCharges, dashRecharge: 0, dashT: 0, dashDX: 0, dashDZ: 0, dashSpeed: H.MOVE.dashDist / H.MOVE.dashTime, iframes: 0, invuln: 0, hurtT: 0, invulnBlink: 0,
    faceAng: Math.PI, aimDX: 0, aimDZ: -1, aimPt: null, lastEl: null, ward: null, bastionT: 0, mirrorT: 0, tempoT: 0, secondWind: false, ashUsed: false,
    downed: false, bleedT: 0, reviveK: 0, statuses: {}, slowT: 0, dead: false, color: accent, accentCss: idx === 0 ? '#d9a441' : '#46e0c8',
    intent: null, castLock: 0, dmgDealt: 0, divine: 0, name: idx === 0 ? 'Percy' : 'Rogue II', dashSlowT: 1
  };
  if (p.boon === 'ironbark') { p.maxHp += 15; p.hp = p.maxHp; }
  if (p.boon === 'spare_breath') { p.dashMax++; p.dashCharges++; }
  if (p.boon === 'attuned' && p.spells[0]) p.spells[0].rank = 2;
  p.charId = (G.run && G.run.mode === 'tutorial') ? 'percy' : (seat.character || (idx === 0 ? (H.save.meta.character || 'percy') : 'percy'));
  { const hero = H.HEROES[p.charId] || H.HEROES.percy; const want = p.spells[0] && p.spells[0].id; p.basePrimary = hero.primaries.includes(want) ? want : hero.defaultPrimary; p.spells[0] = { id: p.basePrimary, rank: 1, cd: 0 }; }
  p.useStam = p.charId === 'knight' && H.STAMINA.enabled !== false; p.maxStam = H.STAMINA.max; p.stam = p.maxStam; p.stamT = 0;
  // animation state written by the game; the view reads it (castN/swingN/twirlN are event counters)
  p.anim = { castN: 0, castSide: 1, swing: null, swingN: 0, twirlN: 0, chargeK: 0, el: null };
  H.views.create(p, { accent, cloak: idx === 0 ? 0x38323f : 0x1e3a40 });
  if (idx === 0 && H.CHARACTERS[p.charId]) p.name = H.CHARACTERS[p.charId].name;
  // each hero carries their own persistent equipment (one seat per hero in co-op)
  if (G.run && G.run.mode !== 'tutorial' && G._gearTaken && !G._gearTaken.has(p.charId)) { G._gearTaken.add(p.charId); const me = G.heroGear(p.charId); p.persist = true; for (const k in p.equip) p.equip[k] = (me.equip[k] && H.ITEMS[me.equip[k]]) ? me.equip[k] : null; for (let i = 0; i < H.BAG_SIZE; i++) p.bag[i] = (me.bag[i] && H.ITEMS[me.bag[i]]) ? me.bag[i] : null; p.heldBack = {}; for (const k in p.equip) if (p.equip[k] && !G.canUse(p, p.equip[k])) { p.heldBack[k] = p.equip[k]; p.equip[k] = null; } G.ensureWeapon(p); G.recalcPlayer(p); p.hp = p.maxHp; p.mana = p.maxMana; }
  else if (p.kind === 'player' && G.ensureWeapon(p)) { G.recalcPlayer(p); p.hp = p.maxHp; p.mana = p.maxMana; }
  return p;
};
G.gearStats = function (p) { const g = {}; for (const k in (p.equip || {})) { const it = p.equip[k] && H.ITEMS[p.equip[k]]; if (it) for (const s in it.stats) g[s] = (g[s] || 0) + it.stats[s]; } return g; };
G.syncGear = function (p) {
  if (!p.persist) return;
  const eq = Object.assign({}, p.equip), bag = p.bag.slice();
  // items this hero can't use stay equipped for the hero who can (or drop to the bag if the slot got taken)
  for (const k in (p.heldBack || {})) { const id = p.heldBack[k]; if (!eq[k]) eq[k] = id; else { const f = bag.findIndex(x => !x); if (f >= 0) bag[f] = id; } }
  const g = G.heroGear(p.charId); for (const k in eq) g.equip[k] = eq[k]; for (let i = 0; i < H.BAG_SIZE; i++) g.bag[i] = bag[i] || null;
  H.saveNow();
};
G.recalcPlayer = function (p) {
  const g = p.gear = G.gearStats(p);
  if (p.kind === 'player') G.refreshWeapon(p);
  if (p.model && H.R.dressRogue) H.R.dressRogue(p.model, p.equip);
  let mh = 100 + (p.boon === 'ironbark' ? 15 : 0) + (p.fortify || 0) + (g.hp || 0);
  if (p.charms.has('ironbark')) mh += 25; if (p.charms.has('glass_edge')) mh -= 15;
  mh += 12 * ((p.attrs || {}).thick_skin || 0);
  const ratio = p.hp / p.maxHp; p.maxHp = mh; p.hp = Math.min(mh, Math.max(1, Math.round(mh * ratio)));
  p.maxMana = 100 + (p.charms.has('deep_well') ? 30 : 0) + (g.mana || 0); p.mana = Math.min(p.mana, p.maxMana); p.manaRegen = 15 * (p.charms.has('deep_well') ? 1.25 : 1) * (1 + (g.regen || 0));
  const at = p.attrs || {};
  if (p.useStam) p.maxStam = H.STAMINA.max + 15 * (at.vigor || 0);
  p.speed = H.MOVE.speed * (1 + Math.max(-0.3, Math.min(0.45, (g.speed || 0) + 0.05 * (at.footwork || 0))));
  const dm = H.MOVE.dashCharges + (p.boon === 'spare_breath' ? 1 : 0) + (p.charms.has('spare_breath') ? 1 : 0); if (dm > p.dashMax) p.dashCharges += dm - p.dashMax; p.dashMax = dm;
};
G.clearAll = function () {
  for (const e of G.enemies) H.views.release(e);
  for (const p of G.projs) H.R.removeMesh(p.mesh);
  for (const z of G.zones) G.disposeZone(z);
  for (const t of G.tgs) H.R.removeMesh(t.mesh);
  for (const t of G.totems) H.R.removeMesh(t.mesh);
  for (const p of G.players) H.views.release(p);
  G.clearFlyers(); G.enemies = []; G.projs = []; G.zones = []; G.tgs = []; G.totems = []; G.players = [];
  G.room = null; G.boss = null; G.tut = null;
};
G.quit = function () { G.timers = []; G.clearAll(); G.active = false; G.run = null; H.R.clearChamber(); };

/* ---------------- Map generation ---------------- */
G.genMap = function (depth) {
  const rng = G.run.rng; const L = H.DEPTHS[depth].layers; const layers = [];
  let treasure = 0, merchants = 0;
  for (let i = 0; i < L; i++) {
    const n = i === 0 || i === L - 1 ? 1 : (i === L - 2 ? 2 : rng.range(0, 1) < 0.55 ? 3 : 2);
    const row = [];
    for (let j = 0; j < n; j++) {
      let type = 'combat';
      if (i === L - 1) type = 'warden';
      else if (i === 0) type = 'combat';
      else if (i === L - 2) type = j === 0 ? 'rest' : rng.pick(['shrine', 'combat', 'elite']);
      else {
        const opts = [{ t: 'combat', w: 42 }, { t: 'mystery', w: 14 }, { t: 'shrine', w: 9 }, { t: 'challenge', w: i >= 1 ? 10 : 0 }, { t: 'elite', w: i >= 2 ? 14 : 0 }, { t: 'treasure', w: treasure < 1 ? 7 : 0 }, { t: 'rest', w: i >= 2 ? 6 : 0 }, { t: 'merchant', w: i >= 2 && merchants < 1 ? 9 : 0 }];
        type = rng.weighted(opts, 'w').t;
        if (type === 'treasure') treasure++; if (type === 'merchant') merchants++;
      }
      row.push({ id: depth + '-' + i + '-' + j, layer: i, col: j, n, type, next: [], visited: false });
    }
    // ensure some variety: not all identical in a row of 3
    if (row.length >= 2 && row.every(r => r.type === row[0].type) && i > 0 && i < L - 2) row[1].type = row[0].type === 'combat' ? 'mystery' : 'combat';
    layers.push(row);
    // every depth gets one merchant: convert a mid-depth chamber if none rolled
    if (i === L - 3 && !merchants) { const c = row.find(r => r.type === 'combat') || row[row.length - 1]; if (c) { c.type = 'merchant'; merchants++; } }
  }
  for (let i = 0; i < L - 1; i++) {
    const a = layers[i], b = layers[i + 1];
    for (const node of a) {
      const pos = a.length === 1 ? 0.5 : node.col / (a.length - 1);
      const sorted = b.slice().sort((x, y) => Math.abs((b.length === 1 ? .5 : x.col / (b.length - 1)) - pos) - Math.abs((b.length === 1 ? .5 : y.col / (b.length - 1)) - pos));
      node.next.push(sorted[0]);
      if (sorted[1] && rng() < 0.6) node.next.push(sorted[1]);
    }
    for (const t of b) if (!a.some(n => n.next.includes(t))) { const src = a.slice().sort((x, y) => Math.abs(x.col / Math.max(1, a.length - 1) - t.col / Math.max(1, b.length - 1)) - Math.abs(y.col / Math.max(1, a.length - 1) - t.col / Math.max(1, b.length - 1)))[0]; src.next.push(t); }
    for (const node of a) node.next.sort((x, y) => x.col - y.col);
  }
  return { depth, layers };
};

/* ---------------- Room generation ---------------- */
/* A room is a union of axis-aligned rectangles: the main hall (rects[0]) plus 0–2 annexes on its sides,
   overlapping it by 2 m so the opening is wide and smooth. All edges sit on an even-metre lattice, so walls are
   laid as 2×2 m blocks around the outline (render.js). bounds = the box around all of it. */
G.ROOM = { scale: 1.5, overlap: 2 };
G.inRect = (q, x, z, r) => x >= q.minX + r && x <= q.maxX - r && z >= q.minZ + r && z <= q.maxZ - r;
// "inside with a margin r" must hold for the room as a whole, not for one rectangle at a time: where an annex meets
// the hall, a point in the 2 m overlap is close to the edge of BOTH rectangles but far from any real wall (the opening).
// So for r > 0 the margin is measured to the actual outline (G.roomWalls); r ≤ 0 keeps the simple per-rectangle test.
G.inRoom = function (x, z, r = 0, room = G.room) {
  if (!room) return true;
  const rects = room.rects || [room.bounds];
  for (const q of rects) if (G.inRect(q, x, z, r)) return true;
  if (r <= 0 || rects.length < 2) return false;
  let inside = false; for (const q of rects) if (G.inRect(q, x, z, 0)) { inside = true; break; }
  return inside && G.wallDist(x, z, room) >= r;
};
// the outline's wall segments: every rectangle edge minus the stretches that run through the inside of another rectangle
G.roomWalls = function (room) {
  const rects = room.rects || [room.bounds];
  if (room._walls && room._wallsOf === rects) return room._walls;
  const W = [];
  const cut = (span, holes) => { let parts = [span]; for (const [h0, h1] of holes) { const nx = []; for (const [a, b] of parts) { if (h1 <= a || h0 >= b) { nx.push([a, b]); continue; } if (h0 > a) nx.push([a, h0]); if (h1 < b) nx.push([h1, b]); } parts = nx; } return parts; };
  for (const q of rects) {
    for (const x of [q.minX, q.maxX]) { const holes = rects.filter(o => o !== q && o.minX < x && x < o.maxX).map(o => [o.minZ, o.maxZ]); for (const [a, b] of cut([q.minZ, q.maxZ], holes)) if (b - a > 1e-6) W.push({ v: true, c: x, a, b }); }
    for (const z of [q.minZ, q.maxZ]) { const holes = rects.filter(o => o !== q && o.minZ < z && z < o.maxZ).map(o => [o.minX, o.maxX]); for (const [a, b] of cut([q.minX, q.maxX], holes)) if (b - a > 1e-6) W.push({ v: false, c: z, a, b }); }
  }
  room._walls = W; room._wallsOf = rects;
  return W;
};
// distance from (x, z) to the nearest wall of the outline; out = the nearest wall point (optional)
G.wallDist = function (x, z, room = G.room, out) {
  let bd = 1e18, bx = x, bz = z;
  for (const w of G.roomWalls(room)) {
    const px = w.v ? w.c : H.clamp(x, w.a, w.b), pz = w.v ? H.clamp(z, w.a, w.b) : w.c, d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bd) { bd = d; bx = px; bz = pz; }
  }
  if (out) { out.x = bx; out.z = bz; }
  return Math.sqrt(bd);
};
// nearest point inside the walkable area (keeping r from the walls)
G.clampToRoom = function (x, z, r = 0, room = G.room) {
  if (!room || G.inRoom(x, z, r, room)) return { x, z };
  let best = null, bd = 1e9;
  const rects = room.rects || [room.bounds];
  for (const q of rects) { const cx = H.clamp(x, q.minX + r, q.maxX - r), cz = H.clamp(z, q.minZ + r, q.maxZ - r), d = (cx - x) ** 2 + (cz - z) ** 2; if (d < bd) { bd = d; best = { x: cx, z: cz }; } }
  // inside the outline but too close to a wall (e.g. in the opening between hall and annex): step straight off the wall,
  // which is shorter than snapping into one rectangle and keeps the opening passable
  if (r > 0 && rects.length > 1 && G.inRoom(x, z, 0, room)) {
    const w = G._wp || (G._wp = { x: 0, z: 0 }); let cx = x, cz = z;
    for (let k = 0; k < 4; k++) {
      const d = G.wallDist(cx, cz, room, w); if (d >= r - 1e-6) break;
      const nx = d > 1e-6 ? (cx - w.x) / d : 0, nz = d > 1e-6 ? (cz - w.z) / d : 0; if (!nx && !nz) break;
      cx = w.x + nx * r; cz = w.z + nz * r;
    }
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd && G.inRoom(cx, cz, 0, room) && G.wallDist(cx, cz, room) >= r - 1e-3) best = { x: cx, z: cz };
  }
  return best;
};
G.makeRoomLayout = function (type, rng, opts = {}) {
  const big = type === 'warden' || type === 'arena';
  const peaceful = ['rest', 'shrine', 'treasure', 'mystery', 'merchant'].includes(type);
  // main hall, 50% bigger than before (sizes are multiples of 4 so every edge lands on the even lattice)
  const W = big ? (type === 'arena' ? 52 : 44) : rng.pick(peaceful ? [28, 32] : [32, 36, 40]);
  const D = big ? (type === 'arena' ? 36 : 32) : rng.pick(peaceful ? [24] : [24, 28]);
  const main = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2, kind: 'main' };
  const rects = [main];
  // annexes: no two rooms look alike (hall only, one side, or both sides; varied size and height)
  const plan = big ? 'hall' : rng.pick(peaceful ? ['hall', 'hall', 'left', 'right'] : ['hall', 'left', 'right', 'twin', 'twin']);
  for (const side of plan === 'twin' ? ['left', 'right'] : plan === 'hall' ? [] : [plan]) {
    const aw = rng.pick([12, 14, 16]), ad = rng.pick([12, 14, 16, 18]), ov = G.ROOM.overlap;
    // vertical placement: anywhere from poking out above the hall (like a side chapel) to its middle; always ≥ 8 m of opening
    const opts2 = []; for (let z0 = main.minZ - 6; z0 <= main.maxZ - 10; z0 += 2) { const open = Math.min(main.maxZ - 4, z0 + ad) - Math.max(main.minZ, z0); if (open >= 8) opts2.push(z0); }
    if (!opts2.length) continue; const z0 = rng.pick(opts2);
    rects.push(side === 'left' ? { minX: main.minX - aw, maxX: main.minX + ov, minZ: z0, maxZ: z0 + ad, kind: 'annex', side } : { minX: main.maxX - ov, maxX: main.maxX + aw, minZ: z0, maxZ: z0 + ad, kind: 'annex', side });
  }
  const bounds = { minX: Math.min(...rects.map(q => q.minX)), maxX: Math.max(...rects.map(q => q.maxX)), minZ: Math.min(...rects.map(q => q.minZ)), maxZ: Math.max(...rects.map(q => q.maxZ)) };
  const room = { type, bounds, rects, main, pillars: [], pits: [], vents: [], doors: [], prop: null, W, D, plan };
  const inAny = (x, z, r) => G.inRoom(x, z, r, room);
  const free = (x, z, r) => {
    if (!inAny(x, z, r + 1.5)) return false;
    if (Math.abs(x) < 3 && z > main.maxZ - 5) return false; // entry
    if (Math.abs(x) < 3.5 && Math.abs(z) < 3.5 && (opts.centerFree || ['rest', 'shrine', 'treasure', 'mystery', 'challenge', 'warden'].includes(type))) return false;
    for (const q of rects) if (G.inRect(q, x, z, 0) && z < q.minZ + 4 && !(q.kind === 'annex' && x > main.minX && x < main.maxX)) return false; // keep the doors' wall clear
    // keep the openings between hall and annexes walkable
    for (const q of rects) if (q.kind === 'annex') { const ex = q.side === 'left' ? main.minX : main.maxX; if (Math.abs(x - ex) < r + 2.5 && z > Math.max(q.minZ, main.minZ) && z < Math.min(q.maxZ, main.maxZ)) return false; }
    for (const p of room.pillars) if (H.dist2(x, z, p.x, p.z) < (p.r + r + 3) ** 2) return false;
    for (const p of room.pits) if (H.dist2(x, z, p.x, p.z) < (p.r + r + 3) ** 2) return false;
    for (const v of room.vents) if (H.dist2(x, z, v.x, v.z) < (v.r + r + 2) ** 2) return false;
    return true;
  };
  const tries = (n, f) => { for (let k = 0; k < n * 20 && n > 0; k++) if (f()) n--; };
  const inR = (q, m) => [rng.range(q.minX + m, q.maxX - m), rng.range(q.minZ + m, q.maxZ - m)];
  const depth = opts.depth || 1;
  // columns: symmetric pairs in the hall, one or two in each annex
  const nPil = type === 'warden' ? 4 : rng.int(3) + (peaceful ? 2 : 3);
  tries(Math.ceil(nPil / 2), () => { const x = rng.range(4, W / 2 - 4), z = rng.range(main.minZ + 5, main.maxZ - 5), r = rng.range(0.8, 1.3); if (!free(x, z, r) || !free(-x, z, r)) return false; room.pillars.push({ x, z, r }, { x: -x, z, r }); return true; });
  for (const q of rects) if (q.kind === 'annex') tries(1 + rng.int(2), () => { const [x, z] = inR(q, 3), r = rng.range(0.8, 1.2); if (!free(x, z, r)) return false; room.pillars.push({ x, z, r }); return true; });
  if (!peaceful && type !== 'warden' && rng() < (type === 'arena' ? 1 : 0.55)) {
    tries(type === 'arena' ? 2 : 1, () => { const [x, z] = inR(main, 6), r = rng.range(1.6, 2.4); if (!free(x, z, r + 1)) return false; room.pits.push({ x, z, r }); return true; });
    for (const q of rects) if (q.kind === 'annex' && rng() < 0.3) tries(1, () => { const [x, z] = inR(q, 5), r = rng.range(1.4, 2); if (!free(x, z, r + 1)) return false; room.pits.push({ x, z, r }); return true; });
  }
  // fire traps: spread over the hall and the annexes (fewer in the first chambers)
  if (!peaceful && type !== 'warden') {
    const early = depth === 1 && (opts.layer || 0) < 3 && type !== 'arena';
    const nMain = type === 'arena' ? 6 : early ? 2 + rng.int(2) : 4 + rng.int(depth >= 3 ? 4 : 3);
    const mk = q => { const [x, z] = inR(q, 3); if (!free(x, z, 1.4)) return false; room.vents.push({ x, z, r: 1.4, period: rng.range(4.5, 6.5), t: rng.range(0, 4), state: 'idle' }); return true; };
    tries(nMain, () => mk(main));
    for (const q of rects) if (q.kind === 'annex') tries(early ? 1 : 2 + rng.int(2), () => mk(q));
  }
  return room;
};
/* Exit doors on the north walls: up to two on the hall; a third (or, sometimes, the second) goes on an annex
   that has a free north wall. */
G.placeDoors = function (room, nodes) {
  const n = nodes.length, main = room.main || room.bounds, rng = G.run ? G.run.rng : Math.random;
  const annex = (room.rects || []).filter(q => q.kind === 'annex' && q.maxX - q.minX >= 10);
  const onAnnex = annex.length && (n >= 3 || (n === 2 && rng() < 0.35)) ? 1 : 0;
  const nMain = n - onAnnex, W = main.maxX - main.minX, span = Math.min(W - 10, nMain * 9);
  nodes.forEach((node, i) => {
    if (i < nMain) { const x = nMain === 1 ? 0 : -span / 2 + span * i / (nMain - 1); room.doors.push({ x: Math.round(x / 2) * 2 + 1, z: main.minZ - 0.6, type: node.type, node, open: false }); }
    else { const q = annex[0]; const xs = q.side === 'left' ? (q.minX + main.minX) / 2 : (q.maxX + main.maxX) / 2; room.doors.push({ x: Math.round((xs - 1) / 2) * 2 + 1, z: q.minZ - 0.6, type: node.type, node, open: false, annex: true }); }
  });
};

G.enterNode = function (node) {
  const run = G.run;
  node.visited = true; run.node = node;
  run.layer = node.layer;
  G.loadRoom(node.type, { layer: node.layer, nodes: node.next });
};
G.loadRoom = function (type, opts = {}) {
  // cleanup transient
  for (const e of G.enemies) H.views.release(e);
  for (const p of G.projs) H.R.removeMesh(p.mesh);
  for (const z of G.zones) G.disposeZone(z);
  for (const t of G.tgs) H.R.removeMesh(t.mesh);
  for (const t of G.totems) H.R.removeMesh(t.mesh);
  G.clearFlyers(); G.enemies = []; G.projs = []; G.zones = []; G.tgs = []; G.totems = []; G.boss = null;
  const run = G.run; const rng = run.rng; const depth = run.depth || 1;
  const room = G.makeRoomLayout(type, rng, { depth, layer: opts.layer || 0, centerFree: opts.centerFree });
  room.layer = opts.layer || 0; room.cleared = false; room.waves = []; room.waveIdx = -1; room.spawnQ = []; room.t = 0; room.waveT = 0; room.started = false; room.rewardGiven = false;
  if (opts.nodes && opts.nodes.length) G.placeDoors(room, opts.nodes);
  const propKinds = { rest: 'hearth', shrine: 'shrine', treasure: 'chest', mystery: 'eye', challenge: 'altar', merchant: 'merchant' };
  if (propKinds[type]) room.prop = { kind: propKinds[type], x: 0, z: 0, used: false };
  G.room = room;
  H.R.buildChamber(room, H.DEPTHS[Math.min(3, depth)]);
  // place players at entry
  G.players.forEach((p, i) => { p.x = (i - (G.players.length - 1) / 2) * 1.6; p.z = (room.main || room.bounds).maxZ - 2; p.vx = p.vz = 0; p.kvx = p.kvz = 0; p.lungeT = 0; p.faceAng = 0; p.dashT = 0; p.secondWind = false; p.statuses = {}; p.slowT = 0; p.spinT = 0; p.lungeT = 0; p.lungeHit = null; if (p.charge) { p.charge = null; p.anim.chargeK = 0; H.R.chargeArrow(p, false); } });
  H.R.follow.x = 0; H.R.follow.z = (room.main || room.bounds).maxZ - 6; H.R.updateCamera(0, true);
  // encounters
  if (['combat', 'elite', 'warden'].includes(type)) G.setupEncounter(room, type);
  if (type === 'warden') { room.isBoss = true; }
  if (['rest', 'shrine', 'treasure', 'mystery', 'challenge', 'merchant'].includes(type)) G.openDoors();
  room.started = true;
  G.emit('roomStart', { type, depth, layer: room.layer });
  H.audio.setTheme(type === 'warden' ? 'warden' : room.waves.length ? 'combat' : 'explore');
  if (type === 'warden') G.startBoss();
};
G.openDoors = function () { if (!G.room) return; for (const d of G.room.doors) d.open = true; if (G.room.doors.length) H.audio.play('door'); };

/* Encounter composition */
G.enemyPool = function (depth, layer) {
  return Object.keys(H.ENEMIES).filter(k => { const d = H.ENEMIES[k]; if (d.boss || !d.cost) return false; if (d.minDepth > depth) return false; if (depth === 1 && (d.minLayer || 0) > layer) return false; return true; });
};
G.buildWave = function (budget, pool, rng, cap) {
  const wave = []; let guard = 0;
  while (budget > 0.5 && wave.length < cap && guard++ < 50) {
    const opts = pool.filter(k => H.ENEMIES[k].cost <= budget + 0.3);
    if (!opts.length) break;
    const k = rng.pick(opts); wave.push({ type: k }); budget -= H.ENEMIES[k].cost;
  }
  return wave;
};
G.setupEncounter = function (room, type) {
  const run = G.run, rng = run.rng, depth = run.depth, layer = room.layer;
  const coop = G.players.length > 1;
  const pool = G.enemyPool(depth, layer);
  const base = (3.4 + depth * 1.8 + layer * 0.6) * (coop ? 1.45 : 1) * (1 + run.curse * 0.1);
  const cap = 5 + depth * 2;
  if (type === 'combat') {
    const n = depth >= 3 ? 3 : 2;
    for (let i = 0; i < n; i++) room.waves.push(G.buildWave(base * (i === n - 1 ? 1.25 : 1), pool, rng, cap));
  } else if (type === 'elite') {
    const eliteType = rng.pick(pool.filter(k => k !== 'wisp'));
    const affix = rng.pick(Object.keys(H.ELITE_AFFIXES));
    room.waves.push([{ type: eliteType, elite: affix }].concat(G.buildWave(base * 0.5, pool, rng, 3)));
    room.waves.push(G.buildWave(base * 0.8, pool, rng, cap));
  } else if (type === 'challenge') {
    for (let i = 0; i < 3; i++) room.waves.push(G.buildWave(base * (1.1 + i * 0.2), pool, rng, cap + 1));
  }
};
G.spawnPoint = function (minDist = 7) {
  const b = G.room.bounds;
  for (let k = 0; k < 60; k++) {
    const x = H.rand(b.minX + 2, b.maxX - 2), z = H.rand(b.minZ + 2, b.maxZ - 2);
    if (!G.inRoom(x, z, 2) || G.blocked(x, z, 1)) continue;
    if (G.players.some(p => !p.dead && H.dist2(x, z, p.x, p.z) < minDist * minDist)) continue;
    return { x, z };
  }
  const m = G.room.main || b; return { x: H.rand(m.minX + 2, m.maxX - 2), z: m.minZ + 3 };
};
G.blocked = function (x, z, r) {
  const room = G.room; if (!room) return false;
  for (const p of room.pillars) if (H.dist2(x, z, p.x, p.z) < (p.r + r) ** 2) return true;
  for (const p of room.pits) if (H.dist2(x, z, p.x, p.z) < (p.r + r) ** 2) return true;
  return false;
};
G.queueSpawn = function (spec, x, z, delay = 0.85) {
  if (x == null) { const sp = G.spawnPoint(); x = sp.x; z = sp.z; }
  const tg = G.tg('circle', { x, z, r: 1.1, color: 0xff7a95, inner: 0.6 }, delay, () => { G.spawnEnemy(spec.type, x, z, spec.elite); }, null);
  tg.spawn = true;
  H.audio.play('spawn');
  for (let i = 0; i < 8; i++) H.R.emit(x + (Math.random() - .5), 0.1, z + (Math.random() - .5), 0, 2 + Math.random() * 2, 0, 0.7, 0.35, 0, 0xff2e55, 0.9, 0, 1);
};
G.nextWave = function () {
  const room = G.room; room.waveIdx++;
  const wave = room.waves[room.waveIdx]; if (!wave) return;
  room.waveT = 0;
  wave.forEach((spec, i) => G.queueSpawn(spec, null, null, 0.75 + i * 0.12));
  G.emit('wave', { idx: room.waveIdx, total: room.waves.length });
};
G.pendingSpawns = () => G.tgs.filter(t => t.spawn).length;

/* ---------------- Entities ---------------- */
G.spawnEnemy = function (type, x, z, affix, extra) {
  const def = H.ENEMIES[type];
  const run = G.run; const depth = run ? run.depth : 1;
  const coop = G.players.length > 1;
  let hpMul = (1 + 0.5 * (depth - 1) + 0.04 * ((G.room && G.room.layer) || 0)) * (coop ? 1.7 : 1) * (1 + (run ? run.curse : 0) * 0.1);
  if (run && run.mode === 'arena') hpMul = (1 + 0.09 * run.wave) * (coop ? 1.5 : 1);
  if (G.room && G.room.bloodMul) hpMul *= G.room.bloodMul;
  if (!def.boss && !(run && run.mode === 'tutorial')) hpMul *= G.ENEMY_HP_MUL;   // common foes and elites (bosses and the tutorial keep their own life)
  if (def.boss) hpMul = (coop ? 1.9 : 1);
  if (type === 'dummy' || type === 'turret') hpMul = 1;
  const elite = !!affix;
  const e = {
    kind: 'enemy', uid: G.uid++, type, def, x, z, vx: 0, vz: 0, kvx: 0, kvz: 0, r: def.r * (elite ? 1.3 : 1), mass: def.mass * (elite ? 2 : 1),
    hp: 0, maxHp: Math.round(def.hp * hpMul * (elite ? 2.6 : 1)), speed: def.speed * (affix === 'hasted' ? 1.4 : 1), elite: affix || null, boss: !!def.boss,
    statuses: {}, frozenT: 0, stunT: 0, faceAng: 0, ai: { state: 'spawn', t: 0.35, cd: H.rand(0.6, 1.6) }, windupK: 0, stagger: 0, staggerMax: def.boss ? 340 * (coop ? 1.4 : 1) : 0,
    spawnK: 0, dead: false, dmgMul: (1 + 0.22 * (depth - 1)) * (run && run.mode === 'arena' ? 1 + 0.03 * run.wave : 1), lastHurtT: 0, reactCd: 0, flying: type === 'wisp' || type === 'summoner' || type === 'hexcaster' || type === 'regent_echo' || def.boss
  };
  Object.assign(e, extra || {});
  e.hp = e.maxHp;
  H.views.create(e);
  if (e.boss) { e.ai.state = 'intro'; e.spawnK = 1; }
  G.enemies.push(e);
  if (H.AI.init) H.AI.init(e);
  return e;
};
G.nearestPlayer = function (x, z, alive = true) {
  let best = null, bd = 1e9;
  for (const p of G.players) { if (alive && (p.dead || p.downed)) continue; const d = H.dist2(x, z, p.x, p.z); if (d < bd) { bd = d; best = p; } }
  return best;
};
G.enemyTarget = function (e) {
  // totems draw aggro when near
  let best = G.nearestPlayer(e.x, e.z); let bd = best ? H.dist2(e.x, e.z, best.x, best.z) : 1e9;
  for (const t of G.totems) { const d = H.dist2(e.x, e.z, t.x, t.z) * 0.6; if (d < bd) { bd = d; best = t; } }
  return best;
};
G.enemiesNear = function (x, z, r, exclude) { const out = []; for (const e of G.enemies) { if (e.dead || e === exclude || e.spawnK < 1) continue; if (H.dist2(x, z, e.x, e.z) <= (r + e.r) ** 2) out.push(e); } return out; };

/* ---------------- Telegraphs ---------------- */
G.tg = function (shape, o, dur, onFire, owner) {
  const mesh = H.R.makeTelegraph(shape, o);
  const t = { shape, o, mesh, t: 0, dur, onFire, owner, x: o.x, z: o.z, done: false };
  G.tgs.push(t); return t;
};
G.cancelTelegraphs = function (owner) { for (const t of G.tgs) if (t.owner === owner && !t.done) { t.done = true; t.cancelled = true; } };
G.inTelegraph = function (t, x, z, pad = 0) {
  const o = t.o;
  if (t.shape === 'circle' || t.shape === 'cone') {
    const d = Math.sqrt(H.dist2(x, z, t.x, t.z));
    if (d > o.r + pad) return false; if (o.inner && d < o.inner * o.r - pad) return false;
    if (t.shape === 'cone') { const a = Math.atan2(x - t.x, z - t.z); const f = Math.atan2(o.dx, o.dz); if (Math.abs(H.angDiff(a, f)) > o.angle + 0.08 && d > 0.8) return false; }
    return true;
  }
  // rect
  const dx = x - t.x, dz = z - t.z; const along = dx * o.dx + dz * o.dz; const side = Math.abs(dx * -o.dz + dz * o.dx);
  return along >= -pad && along <= o.len + pad && side <= o.w / 2 + pad;
};

/* ---------------- Main step ---------------- */
G.step = function (dt) {
  if (!G.active || !G.room) return;
  const run = G.run;
  G.time += dt; run.time += dt; G.room.t += dt;
  if (G.slow.t > 0) G.slow.t -= dt / Math.max(0.05, G.slow.s);
  for (const p of G.players) G.updatePlayer(p, dt);
  for (const e of G.enemies) if (!e.dead) G.updateEnemy(e, dt);
  G.updateProjs(dt); G.updateFlyers(dt); G.updateZones(dt); G.updateTelegraphs(dt); G.updateTotems(dt); G.updateVents(dt);
  G.enemies = G.enemies.filter(e => { if (e.dead && e.removeT <= 0) { H.views.release(e); return false; } if (e.dead) e.removeT -= dt; return true; });
  G.runTimers(dt);
  G.updateRoom(dt);
  if (run.comboT > 0) { run.comboT -= dt; if (run.comboT <= 0) run.combo = 0; }
  G.updateFollow(dt);
  if (G.tut) G.updateTutorial(dt);
  G.checkLevelUp();
};
G.updateFollow = function () {
  const live = G.players.filter(p => !p.dead);
  if (!live.length) return;
  let x = 0, z = 0; for (const p of live) { x += p.x; z += p.z; } x /= live.length; z /= live.length;
  const f = H.R.follow;
  // gentle lead toward aim for solo
  if (live.length === 1) { const p = live[0]; x += p.aimDX * 1.2; z += p.aimDZ * 1.0; }
  if (G.boss && !G.boss.dead) { x = x * 0.82 + G.boss.x * 0.18; z = z * 0.82 + G.boss.z * 0.18; }
  f.x = x; f.z = z;
  let spread = 0; if (live.length > 1) spread = Math.hypot(live[0].x - live[1].x, live[0].z - live[1].z);
  f.zoom = G.CAM_ZOOM * (1 + Math.max(0, spread - 8) * 0.035 + (G.boss ? 0.15 : 0));
};

/* ---------------- Players ---------------- */
G.resolveAim = function (p, it) {
  // returns unit aim dir and target point
  let dx = p.aimDX, dz = p.aimDZ, tx = null, tz = null, hasTarget = false;
  const assist = { off: 0, low: 0.14, medium: 0.26, high: 0.42 }[H.settings.aimAssist] || 0;
  if (it.aimMode === 'point' && it.aimPt) {
    tx = it.aimPt.x; tz = it.aimPt.z; [dx, dz] = H.norm(tx - p.x, tz - p.z);
    if (H.settings.mouseAssist) { const e = G.pickTarget(p, dx, dz, 0.12, 18, tx, tz); if (e) { tx = e.x; tz = e.z; [dx, dz] = H.norm(tx - p.x, tz - p.z); } }
    hasTarget = true;
  } else if (it.aimMode === 'dir') {
    [dx, dz] = H.norm(it.aimX, it.aimZ);
    if (assist > 0) { const e = G.pickTarget(p, dx, dz, assist, 16); if (e) { [dx, dz] = H.norm(e.x - p.x, e.z - p.z); tx = e.x; tz = e.z; } }
    hasTarget = true;
  } else if ((p.src.startsWith('pad') && H.settings.padAutoAim) || p.src === 'touch' || p.src === 'bot') {
    const e = G.pickTarget(p, Math.sin(p.faceAng) * -1, -Math.cos(p.faceAng), Math.PI, 15);
    if (e) { [dx, dz] = H.norm(e.x - p.x, e.z - p.z); tx = e.x; tz = e.z; }
    else if (Math.hypot(it.mx, it.mz) > 0.2) [dx, dz] = H.norm(it.mx, it.mz);
  } else if (Math.hypot(it.mx, it.mz) > 0.2) { [dx, dz] = H.norm(it.mx, it.mz); }
  p.aimDX = dx; p.aimDZ = dz;
  if (tx == null) { tx = p.x + dx * 6; tz = p.z + dz * 6; }
  p.aimPt = { x: tx, z: tz }; p.hasAim = hasTarget;
};
G.pickTarget = function (p, dx, dz, maxAng, range, px, pz) {
  let best = null, bs = 1e9;
  for (const e of G.enemies) {
    if (e.dead || e.spawnK < 1 || e.type === 'dummy' && G.tut && G.tut.ignoreDummy) continue;
    const ex = e.x - p.x, ez = e.z - p.z; const d = Math.hypot(ex, ez); if (d > range) continue;
    if (px != null) { const dd = Math.hypot(e.x - px, e.z - pz); if (dd < 1.4 + e.r) { if (dd < bs) { bs = dd; best = e; } } continue; }
    const ang = Math.abs(H.angDiff(Math.atan2(ex, ez), Math.atan2(dx, dz)));
    if (ang > maxAng) continue;
    const score = ang * 6 + d * 0.15;
    if (score < bs) { bs = score; best = e; }
  }
  return best;
};
G.updatePlayer = function (p, dt) {
  if (p.dead) return; // the view hides a dead hero
  const it = p.intent || { mx: 0, mz: 0, held: {}, pressed: {}, released: {} };
  // timers
  p.iframes = Math.max(0, p.iframes - dt); p.invuln = Math.max(0, p.invuln - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.dashChainT = Math.max(0, (p.dashChainT || 0) - dt); p.comboT = Math.max(0, (p.comboT || 0) - dt); p.invulnBlink = Math.max(0, p.invulnBlink - dt);
  p.bastionT = Math.max(0, p.bastionT - dt); p.mirrorT = Math.max(0, p.mirrorT - dt); p.tempoT = Math.max(0, p.tempoT - dt); p.slowT = Math.max(0, p.slowT - dt); p.castLock = Math.max(0, p.castLock - dt); p.callT = Math.max(0, (p.callT || 0) - dt);
  if (p.ward) { p.ward.t -= dt; if (p.ward.t <= 0 || p.ward.hp <= 0) G.breakWard(p); }
  for (const s of p.spells) if (s) s.cd = Math.max(0, s.cd - dt);
  if (p.ult) { const ud = H.SPELLS[p.ult.id]; p.ult.cd = Math.max(0, p.ult.cd - dt);
    if (ud.charges && p.ult.cd <= 0 && p.ult.charges < ud.charges) { p.ult.charges++; if (p.ult.charges < ud.charges) { p.ult.cd = p.ult.maxCd || ud.cd; } } }
  p.mana = Math.min(p.maxMana, p.mana + p.manaRegen * dt);
  if (p.useStam) { p.stamT = Math.max(0, p.stamT - dt); if (p.stamT <= 0 && !p.charge && !(p.spinT > 0)) p.stam = Math.min(p.maxStam, p.stam + H.STAMINA.regen * (1 + 0.2 * ((p.attrs && p.attrs.second_breath) || 0)) * dt); }
  if (p.dashCharges < p.dashMax) { p.dashRecharge += dt * (p.dashSlowT || 1) * (1 + ((p.gear && p.gear.dash) || 0)); if (p.dashRecharge >= H.MOVE.dashRecharge) { p.dashRecharge = 0; p.dashCharges++; } }
  // player burn (from hazards)
  G.tickPlayerStatuses(p, dt);
  if (p.spinT > 0) {
    const def = p.spinDef, st = p.spinSt;
    p.spinT -= dt; p.spinAng = (1 - Math.max(0, p.spinT) / p.spinDur) * Math.PI * 2 * def.turns;
    const half = Math.floor(p.spinAng / (Math.PI * 2)); if (half > p.spinHalf) { p.spinHalf = half; H.audio.play('sword_swish'); }
    p.spinTick -= dt;
    if (p.spinTick <= 0) {
      p.spinTick = def.tick; let hit = 0;
      for (const e of G.enemiesNear(p.x, p.z, st.range)) { const [kx, kz] = H.norm(e.x - p.x, e.z - p.z); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz, knock: 1.5, phys: true, quiet: true, cone: true })); hit++; }
      if (hit) H.audio.play('sword_hit');
    }
    if (Math.random() < dt * 30) { const a = p.faceAng + p.spinAng; H.R.emit(p.x - Math.sin(a) * st.range * 0.8, 1.0, p.z - Math.cos(a) * st.range * 0.8, 0, 0.3, 0, 0.25, 0.2, 0, 0xe8ecf2, 1, 0, 1); }
    if (p.spinT <= 0) { p.spinT = 0; p.spinAng = 0; }
  }
  if (p.downed) {
    p.bleedT -= dt; p.vx *= 0.8; p.vz *= 0.8;
    const ally = G.players.find(q => q !== p && !q.dead && !q.downed && H.dist2(q.x, q.z, p.x, p.z) < 2.6 * 2.6);
    if (ally) { p.reviveK += dt / 2.2; if (Math.random() < dt * 20) H.R.emit(p.x, 0.5, p.z, (Math.random() - .5) * 2, 2, (Math.random() - .5) * 2, .6, .3, 0, ally.color, 1, 0, 1); }
    else p.reviveK = Math.max(0, p.reviveK - dt * 0.5);
    if (p.reviveK >= 1) { p.downed = false; p.hp = Math.round(p.maxHp * 0.4); p.invuln = 1.5; p.reviveK = 0; G.float(p.x, 2.4, p.z, 'REVIVED', 'big good'); H.audio.play('heal'); G.emit('revive', { p }); }
    else if (p.bleedT <= 0) { G.killPlayer(p); }
    return;
  }
  G.resolveAim(p, it);
  // dash
  const dashPressed = it.pressed.dash;
  if (dashPressed) p.bufDash = 0.2; // input buffer: a dash pressed slightly early still happens
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDX * p.dashSpeed; p.vz = p.dashDZ * p.dashSpeed;
    if (Math.random() < 0.9) H.R.emit(p.x, 0.8 + Math.random() * 0.8, p.z, -p.dashDX * 2, 0.5, -p.dashDZ * 2, 0.35, 0.5, 0.05, p.dashFx || p.color, 0.8, 0, 3);
    if (p.dashTrail) p.dashTrail(p, dt);
    // a dash never ends inside a column or over a pit: it carries on a little until the hero is clear
    if (p.dashT <= 0 && G.overObstacle(p) && (p.dashExt || 0) < 0.3) { p.dashT = dt; p.dashExt = (p.dashExt || 0) + dt; }
    else if (p.dashT <= 0) { // out of the dash: keep running if a direction is held, otherwise ease out of the remaining speed
      const run = p.speed, held = Math.hypot(it.mx, it.mz) > 0.2; p.vx = held ? it.mx * run : p.dashDX * run * H.MOVE.dashExit; p.vz = held ? it.mz * run : p.dashDZ * run * H.MOVE.dashExit; p.dashTrail = null; p.dashFx = null; p.dashChainT = 0.35; p.dashExt = 0; p.dashImmune = false; }
  } else {
    p.bufDash = Math.max(0, (p.bufDash || 0) - dt);
    if (p.bufDash > 0 && p.dashCharges > 0 && p.castLock <= 0 && !(p.lungeT > 0)) { p.bufDash = 0; if (p.charge) { p.charge = null; p.anim.chargeK = 0; H.R.chargeArrow(p, false); } if (p.holdA) { p.holdA = null; p.anim.chargeK = 0; } G.dash(p, it); }
    const sp = p.speed * (p.slowT > 0 ? 0.6 : 1) * (p.casting > 0 ? 0.55 : 1) * (p.stSlow || 1) * (p.spinT > 0 ? 1 + ((p.spinSt && p.spinSt.haste) || 0) : 1) * (p.charge ? 0.35 : 1) * (p.holdA && p.holdA.k > 0 ? 0.45 : 1);
    const tx = it.mx * sp, tz = it.mz * sp;
    if (p.lungeT > 0) { p.lungeT -= dt; p.vx = p.lungeDX * p.lungeSpeed; p.vz = p.lungeDZ * p.lungeSpeed; G.lungeStrike(p, false); if (Math.random() < 0.8) H.R.emit(p.x, 0.7 + Math.random() * 0.8, p.z, -p.lungeDX * 2, 0.4, -p.lungeDZ * 2, 0.3, 0.45, 0.05, 0xe8ecf2, 0.7, 0, 3); if (p.lungeT <= 0) { p.vx = 0; p.vz = 0; G.lungeStrike(p, true); } }
    else { // Hades-style: very short acceleration and braking (H.MOVE), so it answers at once without feeling robotic
      const M = H.MOVE, rate = 3 / ((tx || tz) ? M.accelTime : M.decelTime), kk = 1 - Math.exp(-dt * rate);
      p.vx += (tx - p.vx) * kk; p.vz += (tz - p.vz) * kk; if (!tx && !tz && Math.hypot(p.vx, p.vz) < 0.05) p.vx = p.vz = 0; }
  }
  p.casting = Math.max(0, (p.casting || 0) - dt);
  // knockback is a separate, fast-decaying push so instant movement doesn't erase it
  const kd = Math.exp(-dt * 10); p.kvx = (p.kvx || 0) * kd; p.kvz = (p.kvz || 0) * kd;
  p.x += (p.vx + p.kvx) * dt; p.z += (p.vz + p.kvz) * dt;
  G.collide(p);
  // co-op leash
  if (G.players.length > 1) { const o = G.players.find(q => q !== p && !q.dead); if (o) { const d = Math.hypot(p.x - o.x, p.z - o.z); const max = 19; if (d > max) { const [nx, nz] = H.norm(p.x - o.x, p.z - o.z); p.x = o.x + nx * max; p.z = o.z + nz * max; } } }
  // face
  // mouse & keyboard: face where you walk; turn to the mouse only while attacking/casting (and briefly after)
  p.aimHoldT = Math.max(0, (p.aimHoldT || 0) - dt);
  const busy = p.aimHoldT > 0 || p.casting > 0 || !!p.charge || p.lungeT > 0 || (p.flameZone && !p.flameZone.dead);
  const wantAim = p.src === 'kbm' ? busy : (it.aimMode !== 'none' || busy);
  const target = wantAim ? Math.atan2(-p.aimDX, -p.aimDZ) : (Math.hypot(p.vx, p.vz) > 1 ? Math.atan2(-p.vx, -p.vz) : p.faceAng);
  p.faceAng = target; // turn instantly toward input / aim
  // casting
  const touch = p.src === 'touch';
  for (let i = 0; i < 4; i++) {
    const a = 'cast' + (i + 1); const s = p.spells[i]; if (!s) continue;
    const def = H.SPELLS[s.id];
    // hold-to-charge attacks (Thrust): press starts the wind-up, release lets it fly
    if (def.chargeable) {
      const want = it.pressed[a] || (p.bufCast && p.bufCast.i === i && p.bufCast.t > 0 && it.held[a]);
      if (!p.charge && want && !(s.cd <= 0 && p.dashT <= 0 && !(p.spinT > 0) && !(p.lungeT > 0)) && it.pressed[a] && s.cd < 0.3) p.bufCast = { i, t: 0.25 };
      if (!p.charge && want && s.cd <= 0 && p.dashT <= 0 && !(p.spinT > 0) && !(p.lungeT > 0) && G.stamCost(p, def) > p.stam) { if (it.pressed[a]) G.noStamina(p, i); }
      else if (!p.charge && want && s.cd <= 0 && p.dashT <= 0 && !(p.spinT > 0) && !(p.lungeT > 0)) { p.bufCast = null; p.charge = { slot: i, t: 0 }; p.anim.chargeK = 0; H.audio.play('sword_draw'); }
      if (p.charge && p.charge.slot === i) {
        const cc = def.chargeable; p.charge.t += dt; const k = Math.min(1, p.charge.t / cc.time);
        p.anim.chargeK = k; if (k >= 1 && !p.charge.full) { p.charge.full = true; H.audio.play('sword_ready'); G.float(p.x, 2.7, p.z, H.t('READY'), 'small good'); }
        const st = H.spellStats(s.id, s.rank, p); const dist = G.thrustDist(def, st, k);
        H.R.chargeArrow(p, true, p.x + p.aimDX * 0.5, p.z + p.aimDZ * 0.5, Math.atan2(p.aimDX, p.aimDZ), dist + def.lunge.tip - 0.5, k);
        if (!it.held[a] || p.charge.t > cc.time + cc.hold) { p.thrustCharge = k; p.charge = null; p.anim.chargeK = 0; H.R.chargeArrow(p, false); G.tryCast(p, i); }
      }
      continue;
    }
    let trigger = touch ? it.released[a] : it.pressed[a];
    let quiet = false;
    if (i === 0 && def.hold && !touch) G.holdInput(p, s, def, it.pressed[a], it.held[a], dt);
    if (!trigger && !touch && H.settings.autoRepeat && it.held[a] && def.role === 'attack' && s.cd <= 0 && !def.hold) { trigger = true; quiet = true; }
    if (!trigger && touch && it.held[a] && !it.touchAiming && H.settings.autoRepeat && def.role === 'attack' && s.cd <= 0 && it.heldLong && it.heldLong[a]) { trigger = true; quiet = true; }
    if (trigger) { if (!G.tryCast(p, i, quiet) && !quiet && it.pressed[a] && s.cd < 0.3) p.bufCast = { i, t: 0.25 }; else if (p.bufCast && p.bufCast.i === i) p.bufCast = null; }
    else if (p.bufCast && p.bufCast.i === i && p.bufCast.t > 0 && G.tryCast(p, i, true)) p.bufCast = null;
  }
  if (p.bufCast) { p.bufCast.t -= dt; if (p.bufCast.t <= 0) p.bufCast = null; }
  if (p.ult && H.SPELLS[p.ult.id].call) G.callInput(p, it, dt, touch);
  else if (p.ult && (touch ? it.released.ult : it.pressed.ult)) G.tryCast(p, 4);
  // interaction
  G.checkInteract(p, it);
  // regen ward visuals etc handled in model
  if (p.idx === 0 && H.R.reticle) {
    const show = p.src === 'kbm' && G.active && !G.modal; H.R.reticle.visible = show && !!p.aimPt;
    if (show && p.aimPt) { H.R.reticle.position.x = p.aimPt.x; H.R.reticle.position.z = p.aimPt.z; }
  }
};
G.dash = function (p, it) {
  let dx = it.mx, dz = it.mz;
  if (Math.hypot(dx, dz) < 0.2) { dx = -Math.sin(p.faceAng); dz = -Math.cos(p.faceAng); } // no direction held: dash where the hero is facing
  [dx, dz] = H.norm(dx, dz);
  p.dashCharges--; p.dashT = H.MOVE.dashTime; p.dashDX = dx; p.dashDZ = dz; p.dashSpeed = H.MOVE.dashDist / H.MOVE.dashTime; p.iframes = 0.24 + ((p.gear && p.gear.iframes) || 0);
  p.dashImmune = true; p.dashExt = 0; p.quickN = 0;
  // the dash cancels the basic attack's recovery: the first Quick Attack is ready straight away
  if (p.spells[0] && H.SPELLS[p.spells[0].id].role === 'attack') p.spells[0].cd = Math.min(p.spells[0].cd, H.QUICK_ATTACK.cd);   // immune to everything while the dash lasts, unless the hero attacks or casts during it
  p.tempoT = p.charms.has('tempo_loop') ? 1.5 : 0;
  H.audio.play('dash'); H.R.kickCam(dx, dz, 0.25);
  H.R.burst(p.x, 0.4, p.z, p.color, 12, 4, 0.4, 0.4, { flat: true });
  if (p.charms.has('rift_heel')) { const sx = p.x, sz = p.z; G.after(() => { if (!G.active) return; G.voidTear(p, sx, sz, p.x, p.z); }, 180); }
  if (p.passives && p.passives.fire_dash) {
    const ps = H.passiveStats('fire_dash', p); let acc = 1;
    p.dashTrail = (pp, dt) => { acc += dt; if (acc > 0.035) { acc = 0; G.addZone({ kind: 'fire', team: 0, x: pp.x, z: pp.z, r: 1.15, dur: ps.dur, tick: 0.5, owner: pp, dmg: ps.dmg, hit: { src: pp, el: 'ember', status: 'burn', stacks: 1, spell: 'fire_dash', role: 'passive' }, color: 0xff6a2b, fx: 'fire' }); } };
    p.dashFx = 0xff6a2b; H.audio.play('fire_dash');
  }
  G.events.dashes = (G.events.dashes || 0) + 1;
  if (p.intent && p.intent.padRef) H.input.rumble(p.intent.padRef, 0.1, 0.3, 60);
};
G.voidTear = function (p, x1, z1, x2, z2) {
  const n = 5; for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, z = z1 + (z2 - z1) * i / n; H.R.burst(x, 0.6, z, 0xb36bff, 4, 2, 0.5, 0.4); for (const e of G.enemiesNear(x, z, 1.2)) if (!e._tearHit) { e._tearHit = true; G.damage(e, 10, { src: p, el: 'void', status: 'hex', stacks: 1, spell: 'rift_heel' }); } }
  for (const e of G.enemies) e._tearHit = false;
};
G.overObstacle = function (p) {
  const room = G.room; if (!room) return false;
  for (const q of room.pillars) if (H.dist2(p.x, p.z, q.x, q.z) < (q.r + p.r) ** 2) return true;
  for (const q of room.pits) if (H.dist2(p.x, p.z, q.x, q.z) < (q.r + p.r * 0.6) ** 2) return true;
  return false;
};
G.collide = function (ent) {
  const room = G.room; if (!room) return;
  const r = ent.r;
  // walls: stay inside the hall-and-annexes outline
  { const c = G.clampToRoom(ent.x, ent.z, r, room); ent.x = c.x; ent.z = c.z; }
  if (ent.kind === 'player' && ent.dashT > 0) return;   // a dashing hero crosses columns and pits (the walls still stop it)
  for (const p of room.pillars) { const dx = ent.x - p.x, dz = ent.z - p.z, d = Math.hypot(dx, dz), m = p.r + r; if (d < m && d > 0.0001) { ent.x = p.x + dx / d * m; ent.z = p.z + dz / d * m; if (ent.onWall) ent.onWall(p); } }
  const knocked = ent.kind === 'enemy' && Math.hypot(ent.kvx, ent.kvz) > 5 && !ent.flying;
  for (const p of room.pits) {
    const dx = ent.x - p.x, dz = ent.z - p.z, d = Math.hypot(dx, dz);
    if (knocked || ent.flying) { if (ent.kind === 'enemy' && !ent.flying && !ent.boss && d < p.r - r * 0.2 && !ent.dead) G.plunge(ent); continue; }
    const m = p.r + r * 0.6; if (d < m && d > 0.0001) { ent.x = p.x + dx / d * m; ent.z = p.z + dz / d * m; }
  }
};
G.plunge = function (e) {
  e.falling = true; G.float(e.x, 2, e.z, 'PLUNGED', 'big'); H.audio.play('plunge');
  G.kill(e, { plunge: true });
};

/* ---------------- Casting ---------------- */
G.tryCast = function (p, i, quiet) {
  const s = i === 4 ? p.ult : p.spells[i]; if (!s) return false; const def = H.SPELLS[s.id]; const st = H.spellStats(s.id, s.rank, p);
  const md = i === 0 ? (p.mods || {}) : {};
  if (md.heavy) st.dmg = Math.round(st.dmg * (1 + 0.25 * md.heavy));
  if (p.spinT > 0) return false;
  if (p.throwing && def.weapon) return false; // the axe is still in the air
  if (def.charges ? s.charges <= 0 : s.cd > 0) { if (!quiet) G.emit('deny', { p, slot: i, why: 'cd' }); return false; }
  if (p.mana < st.cost) { if (!quiet) { G.emit('deny', { p, slot: i, why: 'mana' }); H.audio.play('ui_deny'); } return false; }
  const stamCost = G.stamCost(p, def);
  if (stamCost > p.stam) { if (!quiet) G.noStamina(p, i); return false; }
  if (stamCost) G.spendStam(p, stamCost);
  p.mana -= st.cost;
  let cd = st.cd * Math.pow(0.85, md.rapid || 0); if (p.tempoT > 0) { cd *= 0.6; p.tempoT = 0; }
  if (def.charges) { s.charges--; s.maxCd = cd; if (s.cd <= 0) s.cd = cd; } else { s.cd = cd; s.maxCd = cd; }
  p.lastEl = def.el; p.anim.el = def.el;
  p.aimHoldT = def.role === 'attack' ? 0.45 : 0.3; p.faceAng = Math.atan2(-p.aimDX, -p.aimDZ);
  p.anim.castN++; p.anim.castSide = -p.anim.castSide; p.casting = def.role === 'attack' ? 0.12 : 0.05;
  const run = G.run; run.castsBySpell[s.id] = (run.castsBySpell[s.id] || 0) + 1;
  const kitSfx = { cinder_bolt: 'fire_bolt', flamethrower: 'flamethrower', meteor: 'meteor_fall', pyre_supernova: 'nova_charge', firestorm: null, fist_strike: null }[def.id];
  if (kitSfx) H.audio.play(kitSfx, { pan: p.aimDX }); else if (kitSfx !== null && !def.weapon) H.audio.play('cast_' + def.el);
  // casting or attacking mid-dash: allowed, but the hero is no longer immune for the rest of the dash
  if (p.dashT > 0 && p.dashImmune) { p.dashImmune = false; p.iframes = 0; }
  // attacking during a dash or right after it is a Quick Attack (weapons with their own dash strike handle it in melee())
  // up to 3 Quick Attacks in a row (H.QUICK_ATTACK.max): each one keeps the window open and leaves almost no cooldown
  const quick = G.quickReady(p, def, i);
  if (quick) {
    p.quickN = (p.quickN || 0) + 1; const last = p.quickN >= H.QUICK_ATTACK.max;
    p.dashChainT = last ? 0 : Math.max(p.dashChainT || 0, H.QUICK_ATTACK.window);
    if (!last) { s.cd = Math.min(s.cd, H.QUICK_ATTACK.cd); s.maxCd = s.cd; }
    if (!(def.kind === 'melee' && def.charge)) { st.dmg = Math.round(st.dmg * H.QUICK_ATTACK.dmgMul); if (!def.quick) H.R.ring(p.x, p.z, 0xf2ead8, 0.3, 1.6, 0.25, 0.1, 0.8, 0.1); }
    G.float(p.x, 2.6, p.z, H.t('QUICK ATTACK') + ' ' + p.quickN + '/' + H.QUICK_ATTACK.max, p.quickN === H.QUICK_ATTACK.max ? 'big gold' : 'big');
  }
  // ground combo (sword): hits 1 and 2 come almost without cooldown, the 3rd is a slow sweep all around, then a pause
  const cb = !quick && i === 0 && def.combo;
  if (quick) p.comboN = 0;
  if (cb) {
    if (!(p.comboT > 0)) p.comboN = 0;
    p.comboN = (p.comboN || 0) + 1;
    const hits = def.combo.hits, n = p.comboN, hd = hits[n - 1];
    if (n < hits.length) { s.cd = s.maxCd = hd.gap; p.comboT = def.combo.window; }
    else { s.cd = s.maxCd = def.combo.recover + hd.delay; p.comboN = 0; p.comboT = 0; }
    G.comboHit(p, def, st, hd); G.emit('cast', { p, slot: i, id: s.id }); return true;
  }
  // the 3rd attack of the dash combo is a horizontal slash that shoves and stuns weak foes
  if (quick && def.quickFinisher && p.quickN >= H.QUICK_ATTACK.max) { s.cd = s.maxCd = (def.combo ? def.combo.recover : 0.5) + def.quickFinisher.delay; G.comboFinisher(p, def, st, def.quickFinisher); G.emit('cast', { p, slot: i, id: s.id }); return true; }
  // the swing animation starts here; a combo finisher plays only its own swing, at the moment it cuts
  if (def.weapon) { p.anim.castSide = 1; p.anim.swing = def.swing || def.kind; p.anim.swingN++; }
  G.quick = quick;
  G.md = md; G.SPELL[def.kind](p, def, st); G.md = {}; G.quick = false;
  if (p.lungeT > 0 && p.dashT > 0) { p.dashT = 0; p.dashExt = 0; p.dashTrail = null; p.dashFx = null; }   // a lunge takes over the dash's movement
  G.emit('cast', { p, slot: i, id: s.id });
  if (G.tut) G.tutEvent('cast', { slot: i, id: s.id });
  return true;
};
G.aimTarget = function (p, range) {
  // ground point for targeted spells, clamped to range
  let tx = p.aimPt.x, tz = p.aimPt.z;
  if (p.src !== 'kbm' && !p.hasAim) { tx = p.x + p.aimDX * Math.min(range, 6.5); tz = p.z + p.aimDZ * Math.min(range, 6.5); const e = G.pickTarget(p, p.aimDX, p.aimDZ, 0.5, range); if (e) { tx = e.x; tz = e.z; } }
  const d = Math.hypot(tx - p.x, tz - p.z); if (d > range) { tx = p.x + (tx - p.x) / d * range; tz = p.z + (tz - p.z) / d * range; }
  { const c = G.clampToRoom(tx, tz, 0.5); tx = c.x; tz = c.z; }
  return { x: tx, z: tz };
};
const hitOpts = (p, def, st, extra) => Object.assign({ ignoreShield: !!def.ignoreShield, src: p, el: def.el, status: def.status, stacks: def.stacks || 1, spell: def.id, knock: def.knock || 0, interrupt: !!def.interrupt, stun: def.stun || 0, role: def.role }, extra || {});
G.SPELL = {
  projectile(p, def, st) {
    const md = G.md || {};
    const spd = def.speed * (p.charms.has('coil') ? 1.15 : 1) * (1 - 0.1 * (md.heavy || 0));
    const n = 1 + (md.multishot || 0); const big = 1 + 0.3 * (md.heavy || 0);
    const base = Math.atan2(p.aimDX, p.aimDZ);
    for (let k = 0; k < n; k++) {
      const a = base + (k - (n - 1) / 2) * 0.16; const dx = Math.sin(a), dz = Math.cos(a);
      G.fireProj({ team: 0, x: p.x + dx * 0.6, z: p.z + dz * 0.6, dx, dz, speed: spd, range: def.range, r: (def.radius || 0.35) * big, dmg: Math.round(st.dmg * (n > 1 ? 0.8 : 1)), pierce: def.pierce + (st.rank >= 3 && def.pierce ? 1 : 0) + 2 * (md.pierce || 0), ricochet: md.ricochet || 0, explode: md.explosive || 0, color: H.EL[def.el].color, hit: hitOpts(p, def, st, { stacks: (def.stacks || 1) + (md.surge || 0) }), owner: p, size: (def.radius ? def.radius * 1.3 : 0.4) * big });
    }
    H.R.burst(p.x + p.aimDX * 0.8, 1, p.z + p.aimDZ * 0.8, H.EL[def.el].color, 6, 4, 0.25, 0.35, { dir: [p.aimDX, p.aimDZ], mul: G.fxMul(p) });
  },
  supernova(p, def, st) {
    const rad = st.radius, col = 0xff6a2b;
    p.iframes = Math.max(p.iframes, 1.0); p.casting = 0.55; p.castLock = 0.55;
    H.R.ring(p.x, p.z, 0xffd27a, rad, 0.6, 0.55, 0.1, 0.9, 0.06); H.R.ring(p.x, p.z, col, rad * 0.8, 0.4, 0.5, 0.1, 0.7, 0.1);
    H.R.flash(p.x, p.z, col, 3, 0.55);
    for (let k = 0; k < 90 * G.fxMul(p); k++) { const a = Math.random() * 6.283, r = rad * (0.5 + Math.random() * 0.5); H.R.emit(p.x + Math.cos(a) * r, 0.3 + Math.random() * 1.5, p.z + Math.sin(a) * r, -Math.cos(a) * r * 1.8, 1, -Math.sin(a) * r * 1.8, 0.5, 0.5, 0.15, H.pick([0xff6a2b, 0xffd27a, 0xff3d1f]), 1, 0, 0.5); }
    G.after(() => {
      if (!G.active || p.dead) return;
      const x = p.x, z = p.z; G.float(x, 3.2, z, H.t('SUPERNOVA'), 'big gold');
      H.R.flash(x, z, 0xffb050, 10, 0.6); H.R.shake(1); H.R.kickCam(0, 1, 0.5); H.audio.play('nova_boom');
      H.R.ring(x, z, 0xffffff, 0.5, rad * 1.05, 0.35, 0.12, 1, 0.08); H.R.ring(x, z, 0xffd27a, 0.5, rad, 0.5, 0.1, 1, 0.22); H.R.ring(x, z, col, 0.5, rad * 1.25, 0.8, 0.08, 0.8, 0.12); H.R.ring(x, z, 0xff3d1f, 0.5, rad * 0.6, 0.6, 0.1, 0.9, 0.4);
      H.R.burst(x, 0.6, z, col, 220 * G.fxMul(p), rad * 2.4, 0.9, 0.8, { flat: true, palette: [0xff6a2b, 0xffd27a, 0xff3d1f, 0xffffff] });
      H.R.burst(x, 0.6, z, col, 80 * G.fxMul(p), 9, 1.1, 0.9, { up: 9, grav: 8, palette: [0xff6a2b, 0xffd27a, 0x2a1408] });
      H.R.decal(x, z, col, rad * 0.9, 6);
      for (const e of G.enemiesNear(x, z, rad)) { const [kx, kz] = H.norm(e.x - x, e.z - z); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz, knock: def.knock })); }
      for (const pr of G.projs) if (pr.team === 1 && !pr.dead && H.dist2(pr.x, pr.z, x, z) < rad * rad) { pr.dead = true; H.R.burst(pr.x, 1, pr.z, col, 6, 3, 0.3, 0.3); }
      const n = Math.max(8, Math.round(rad * 1.6));
      for (let k = 0; k < n; k++) { const a = k / n * 6.283; const fx = x + Math.cos(a) * rad * 0.75, fz = z + Math.sin(a) * rad * 0.75; if (!G.blocked(fx, fz, 0.3)) G.addZone({ kind: 'fire', team: 0, x: fx, z: fz, r: 1.2, dur: 4, tick: 0.5, owner: p, dmg: Math.max(3, Math.round(st.dmg * 0.06)), hit: hitOpts(p, def, st, { stacks: 1 }), color: col, fx: 'fire' }); }
    }, 550);
  },
  melee(p, def, st) {
    // charged if used during a dash or within the window right after it
    const ch = def.charge; const charged = !!ch && G.quick;
    const base = Math.atan2(p.aimDX, p.aimDZ), col = H.EL[def.el] ? H.EL[def.el].color : 0xcfc4ae;
    if (charged && def.weapon) {
      // rushing slash: a full-circle whirl of the blade out of the dash
      const R0 = ch.radius + Math.max(0, st.range - def.range), dmg = Math.round(st.dmg * ch.dmgMul);
      p.anim.twirlN++; // the view starts the whirl and cancels the swing
      if (!G.paintedSlash(p, def)) {
        H.R.slashArc(p.x, p.z, base, Math.PI, 0.35, R0, 0xf6ecd4, 0.38); H.R.slashArc(p.x, p.z, base, Math.PI, 0.35, R0 * 0.7, 0xcfd8e6, 0.3, 0.14);
        H.R.burst(p.x, 0.5, p.z, 0xe8ecf2, 26 * G.fxMul(p), 8, 0.35, 0.4, { flat: true });
      }
      H.R.shake(0.24); H.audio.play('sword_cleave'); G.hitstop = Math.max(G.hitstop, 0.05);
      let hit = 0; for (const e of G.enemiesNear(p.x, p.z, R0)) { const [kx, kz] = H.norm(e.x - p.x, e.z - p.z); G.damage(e, dmg, hitOpts(p, def, st, { kx, kz, knock: ch.knock, interrupt: true, phys: true, cone: true })); hit++; }
      if (hit) H.audio.play('sword_hit', { heavy: true });
      return;
    }
    if (charged) {
      const R0 = ch.radius + Math.max(0, st.range - def.range), dmg = Math.round(st.dmg * ch.dmgMul);
      H.R.ring(p.x, p.z, 0xe8dcc4, 0.4, R0 * 1.1, 0.35, 0.1, 1, 0.22); H.R.ring(p.x, p.z, col, 0.3, R0 * 1.4, 0.5, 0.08, 0.7, 0.1);
      H.R.burst(p.x, 0.4, p.z, col, 36 * G.fxMul(p), 9, 0.45, 0.5, { flat: true, palette: [0xe8dcc4, 0xa89c84, 0x6e6a64] }); H.R.decal(p.x, p.z, 0x8a7a64, R0 * 0.7, 2.5);
      H.R.shake(0.28); H.audio.play('punch_heavy'); G.hitstop = Math.max(G.hitstop, 0.06);
      for (const e of G.enemiesNear(p.x, p.z, R0)) { const [kx, kz] = H.norm(e.x - p.x, e.z - p.z); G.damage(e, dmg, hitOpts(p, def, st, { kx, kz, knock: ch.knock, interrupt: true, phys: true, blunt: def.dtype === 'blunt' })); }
      return;
    }
    // a weapon with its own Quick Attack shape (the sword: a fast, narrow 45° cut straight ahead)
    const qa = G.quick && def.quick;
    const R0 = st.range * (qa ? def.quick.rangeMul || 1 : 1), ang = (qa ? def.quick.angle : def.angle) * Math.PI / 360; let hit = 0;
    if (qa && !G.paintedSlash(p, def)) { H.R.slashArc(p.x, p.z, base, ang, 0.4, R0, 0xf6ecd4, 0.18); H.R.slashArc(p.x, p.z, base, ang * 0.6, 0.4, R0 * 0.8, 0xcfd8e6, 0.14, 0.14); }
    for (const e of G.enemies) {
      if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > R0 + e.r || Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + Math.atan2(e.r, Math.max(d, 0.1))) continue;
      const [kx, kz] = H.norm(dx, dz); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz, phys: true, cone: !!def.weapon, blunt: def.dtype === 'blunt', pierce: def.dtype === 'pierce' })); hit++;
    }
    const fx = p.x + p.aimDX * 1.1, fz = p.z + p.aimDZ * 1.1;
    H.R.burst(fx, 1.0, fz, 0xe8dcc4, hit ? 10 : 5, 3, 0.2, 0.3, { dir: [p.aimDX, p.aimDZ] }); if (hit) { H.R.ring(fx, fz, 0xe8dcc4, 0.1, 0.8, 0.15, 1.0, 0.8, 0.2); H.R.kickCam(p.aimDX, p.aimDZ, 0.08); }
    H.audio.play(hit ? (def.sfx ? def.sfx + '_hit' : 'punch') : (def.sfx ? def.sfx + '_swish' : 'whiff'));
  },
  thrust(p, def, st) {
    // dash-like lunge along the arrow; the blade pierces every foe on the way (and a short reach past the end)
    const ax = p.aimDX, az = p.aimDZ;
    const ck = p.thrustCharge != null ? p.thrustCharge : 0.5; p.thrustCharge = null;
    const dist = G.thrustDist(def, st, ck), speed = def.lunge.speed + (def.lunge.fullSpeed - def.lunge.speed) * ck, dur = dist / speed;
    if (ck >= 1) st = Object.assign({}, st, { dmg: Math.round(st.dmg * def.chargeable.fullMul) });
    p.lungeT = dur; p.lungeDX = ax; p.lungeDZ = az; p.lungeSpeed = speed;
    p.lungeHit = { def, st, set: new Set(), ax, az, hits: 0 };
    H.R.groundArrow(p.x + ax * 0.5, p.z + az * 0.5, Math.atan2(ax, az), dist + def.lunge.tip - 0.5, 0.55, ck >= 1 ? 0xffd27a : 0xf2ead8, 0.45);
    H.audio.play('sword_thrust');
  },
  smash(p, def, st) {
    // overhead two-handed blow on ONE foe: the nearest in front within reach
    const base = Math.atan2(p.aimDX, p.aimDZ); let tgt = null, best = 1e9;
    for (const e of G.enemies) {
      if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz), da = Math.abs(H.angDiff(Math.atan2(dx, dz), base));
      if (d > st.range + e.r || da > 0.75) continue; const sc = d + da * 2; if (sc < best) { best = sc; tgt = e; }
    }
    H.audio.play('axe_swish');
    G.after(() => {
      if (p.dead || !G.active) return;
      const live = tgt && !tgt.dead;
      const fx = live ? tgt.x : p.x + p.aimDX * 2, fz = live ? tgt.z : p.z + p.aimDZ * 2;
      if (live) { const [kx, kz] = H.norm(tgt.x - p.x, tgt.z - p.z); G.damage(tgt, st.dmg, hitOpts(p, def, st, { kx, kz, knock: 3, phys: true, interrupt: true, stun: 0.5 })); H.audio.play('axe_hit', { heavy: true }); }
      H.R.decal(fx, fz, 0x6a5a48, 1.3, 3); H.R.burst(fx, 0.3, fz, 0xe8dcc4, 26 * G.fxMul(p), 6, 0.4, 0.45, { up: 4, palette: [0xe8dcc4, 0x8a7a64, 0x4a4038] }); H.R.ring(fx, fz, 0xe8dcc4, 0.2, 1.6, 0.3, 0.1, 0.9, 0.2);
      H.R.shake(0.4); G.hitstop = Math.max(G.hitstop, 0.09); H.R.kickCam(p.aimDX, p.aimDZ, 0.3); H.audio.play('slam');
    }, 300);
  },
  backhand(p, def, st) {
    // half-turn wind-up, then a heavy cut across the front: area damage, a big shove and Dazed
    const base = Math.atan2(p.aimDX, p.aimDZ), ang = def.angle * Math.PI / 360;
    H.audio.play('axe_swish');
    G.after(() => {
      if (p.dead || !G.active) return;
      const R0 = st.range; let hit = 0;
      for (const e of G.enemies) {
        if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > R0 + e.r || Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + Math.atan2(e.r, Math.max(d, 0.1)) * 0.5) continue;
        const [kx, kz] = H.norm(dx, dz); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz, knock: def.knock, phys: true, interrupt: true, stun: 0.6 })); hit++;
      }
      H.R.slashArc(p.x, p.z, base, ang, 0.4, R0, 0xf6ecd4, 0.4); H.R.slashArc(p.x, p.z, base, ang, R0 * 0.9, R0 * 1.25, 0xe8dcc4, 0.35, 0.12);
      H.R.burst(p.x + p.aimDX * R0 * 0.6, 0.5, p.z + p.aimDZ * R0 * 0.6, 0xe8dcc4, 24 * G.fxMul(p), 7, 0.35, 0.4, { dir: [p.aimDX, p.aimDZ] });
      H.R.shake(0.3); G.hitstop = Math.max(G.hitstop, hit ? 0.07 : 0.02); H.R.kickCam(p.aimDX, p.aimDZ, 0.25);
      H.audio.play('axe_swish'); if (hit) H.audio.play('axe_hit', { heavy: true });
    }, 190);
  },
  axethrow(p, def, st) {
    // hurl the axe at the foe nearest the aim; it bounces through st.bounces more and flies back
    let tgt = G.pickTarget(p, p.aimDX, p.aimDZ, 0.9, st.range);
    if (!tgt) tgt = G.enemiesNear(p.x, p.z, st.range).filter(e => !e.dead && e.spawnK >= 1).sort((a, b) => H.dist2(a.x, a.z, p.x, p.z) - H.dist2(b.x, b.z, p.x, p.z))[0] || null;
    const wpn = H.ITEMS[p.equip.weapon];
    const f = { p, def, st, hops: st.bounces, hit: new Set(), x: p.x + p.aimDX * 0.8, z: p.z + p.aimDZ * 0.8, y: 1.2, tgt, tx: p.x + p.aimDX * st.range, tz: p.z + p.aimDZ * st.range, back: false, mesh: H.R.makeThrownWeapon(wpn), spin: 0 };
    p.throwing = f; H.R.syncHeroWeapon(p.model, p); // the axe leaves the hand right away
    G.flyers.push(f); H.audio.play('axe_swish');
  },
  execute(p, def, st) {
    // one devastating cut on the foe in front; a one-hit kill gives the charge back
    const base = Math.atan2(p.aimDX, p.aimDZ), ang = def.angle * Math.PI / 360; let tgt = null, best = 1e9;
    for (const e of G.enemies) {
      if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > st.range + e.r || Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + 0.2) continue; if (d < best) { best = d; tgt = e; }
    }
    H.R.slashArc(p.x, p.z, base, ang, 0.3, st.range, 0xff4a5a, 0.35); H.R.slashArc(p.x, p.z, base, ang * 0.6, st.range * 0.8, st.range * 1.05, 0xffffff, 0.22, 0.14);
    H.audio.play('sword_cleave');
    if (!tgt) return;
    const [kx, kz] = H.norm(tgt.x - p.x, tgt.z - p.z);
    G.damage(tgt, st.dmg, hitOpts(p, def, st, { kx, kz, knock: 4, phys: true, status: null }));
    if (!tgt.dead) { G.applyStatus(tgt, 'sunder', 1, p, { noReact: true, spell: def.id }); G.applyStatus(tgt, 'bleed', 2, p, { noReact: true, spell: def.id }); }
    H.R.burst(tgt.x, 1.1, tgt.z, 0xc0182c, 30, 7, 0.45, 0.45, { dir: [kx, kz] }); H.audio.play('sword_hit', { heavy: true }); G.hitstop = Math.max(G.hitstop, 0.1); H.R.shake(0.35);
    if (tgt.dead && p.ult && p.ult.id === def.id) { p.ult.charges = Math.min(def.charges, p.ult.charges + 1); G.float(p.x, 3, p.z, H.t('EXECUTED · CHARGE BACK'), 'big gold'); H.audio.play('sword_ready'); }
  },
  cleave(p, def, st) {
    // a heavy forward cut: everything inside the 90° arc in front, nothing behind or to the sides
    const base = Math.atan2(p.aimDX, p.aimDZ), ang = def.angle * Math.PI / 360;
    H.audio.play('sword_cleave');
    G.after(() => {
      if (p.dead || !G.active) return;
      const R0 = st.range; let hit = 0;
      for (const e of G.enemies) {
        if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > R0 + e.r || Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + Math.atan2(e.r, Math.max(d, 0.1)) * 0.5) continue;
        const [kx, kz] = H.norm(dx, dz); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz, phys: true, interrupt: true, cone: true })); hit++;
      }
      H.R.slashArc(p.x, p.z, base, ang, 0.3, R0, 0xf6ecd4, 0.4);
      H.R.slashArc(p.x, p.z, base, ang, 0.3, R0 * 0.7, 0xcfd8e6, 0.3, 0.14);
      for (let k = -3; k <= 3; k++) { const a = base + k * ang / 3; H.R.burst(p.x + Math.sin(a) * R0 * 0.85, 0.3, p.z + Math.cos(a) * R0 * 0.85, 0xe8dcc4, 5, 3, 0.35, 0.3, { up: 2 }); }
      H.R.shake(0.32); G.hitstop = Math.max(G.hitstop, hit ? 0.08 : 0.03); H.R.kickCam(p.aimDX, p.aimDZ, 0.25);
      if (hit) H.audio.play('sword_hit', { heavy: true });
    }, 130);
  },
  quake(p, def, st) {
    // the weapon's Special: a slow overhead blow into the floor, a shockwave all around
    p.casting = Math.max(p.casting, (def.delay || 300) / 1000 + 0.1); p.castLock = Math.max(p.castLock, (def.delay || 300) / 1000);
    H.audio.play('sword_swish');
    G.after(() => {
      if (p.dead || !G.active) return;
      const x = p.x, z = p.z, R0 = st.range; let hit = 0;
      for (const e of G.enemiesNear(x, z, R0)) { const [kx, kz] = H.norm(e.x - x, e.z - z); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz, knock: def.knock, phys: true, blunt: true, interrupt: true, stun: def.stun })); hit++; }
      for (const pr of G.projs) if (pr.team === 1 && !pr.dead && H.dist2(pr.x, pr.z, x, z) < (R0 + 0.6) ** 2) { pr.dead = true; H.R.burst(pr.x, 1, pr.z, 0xe8dcc4, 6, 3, 0.3, 0.3); }
      H.R.ring(x, z, 0xf2ead8, 0.4, R0 * 1.05, 0.4, 0.12, 1, 0.2); H.R.ring(x, z, 0x9fe8c0, 0.3, R0 * 1.3, 0.55, 0.08, 0.7, 0.1);
      H.R.burst(x, 0.4, z, 0xe8dcc4, 40 * G.fxMul(p), R0 * 2.4, 0.5, 0.5, { flat: true, palette: [0xe8dcc4, 0xa89c84, 0x6e6a64] });
      H.R.burst(x + p.aimDX, 0.3, z + p.aimDZ, 0xe8dcc4, 18 * G.fxMul(p), 5, 0.45, 0.45, { up: 5, palette: [0xe8dcc4, 0x8a7a64, 0x4a4038] });
      H.R.decal(x + p.aimDX * 0.9, z + p.aimDZ * 0.9, 0x6a5a48, R0 * 0.55, 3.5);
      H.R.shake(0.45); G.hitstop = Math.max(G.hitstop, hit ? 0.08 : 0.03); H.R.kickCam(0, 1, 0.3); H.audio.play('slam'); if (hit) H.audio.play('sword_hit', { heavy: true });
    }, def.delay || 300);
  },
  spin(p, def, st) {
    // two full turns over st.dur, hitting all around every def.tick
    p.casting = 0; p.spinT = st.dur; p.spinDur = st.dur; p.spinTick = 0; p.spinSt = st; p.spinDef = def; p.spinAng = 0; p.spinHalf = 0;
    H.audio.play('sword_swish');
  },
  flamethrower(p, def, st) {
    // a sustained 45° stream that tracks the caster's aim for st.dur seconds
    if (p.flameZone && !p.flameZone.dead) p.flameZone.t = p.flameZone.dur; // restart replaces an old stream
    const ang = def.angle * Math.PI / 360, base = Math.atan2(p.aimDX, p.aimDZ);
    p.flameZone = G.addZone({ kind: 'flamestream', team: 0, x: p.x, z: p.z, r: 0.01, dur: st.dur, owner: p, color: 0xff6a2b, R0: st.range, ang, st, def, tickT: 0, extra: H.R.makeFlameCone(ang, base), nomesh: true });
    H.R.flash(p.x + p.aimDX * 2, p.z + p.aimDZ * 2, 0xff6a2b, 2.5, 0.3); H.R.kickCam(-p.aimDX, -p.aimDZ, 0.2);
  },
  meteor(p, def, st) {
    const t = G.aimTarget(p, def.range); const rad = st.radius;
    G.addZone({ kind: 'meteor', team: 0, x: t.x, z: t.z, r: rad, dur: 0.01, delay: 0.65, owner: p, color: 0xff6a2b, extra: H.R.makeMeteor(), from: [t.x - 4, 16, t.z + 5], onEnd: z => {
      H.R.burst(z.x, 0.5, z.z, 0xff6a2b, 70 * G.fxMul(p), 13, 0.7, 0.7, { up: 6, grav: 10, palette: [0xff6a2b, 0xffd27a, 0xff3d1f, 0x2a1408] });
      H.R.ring(z.x, z.z, 0xffd27a, 0.4, rad * 1.3, 0.45, 0.1, 1, 0.25); H.R.ring(z.x, z.z, 0xff6a2b, 0.3, rad * 2, 0.6, 0.08, 0.8, 0.1);
      H.R.flash(z.x, z.z, 0xff8a30, 7, 0.4); H.R.shake(0.45); H.audio.play('meteor_hit'); H.R.decal(z.x, z.z, 0xff6a2b, rad * 1.1, 4);
      for (const e of G.enemiesNear(z.x, z.z, rad)) { const [kx, kz] = H.norm(e.x - z.x, e.z - z.z); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz, knock: 6 })); }
      G.addZone({ kind: 'fire', team: 0, x: z.x, z: z.z, r: rad * 0.85, dur: 3, tick: 0.5, owner: p, dmg: Math.max(2, Math.round(st.dmg * 0.14)), hit: hitOpts(p, def, st, { stacks: 1 }), color: 0xff6a2b, fx: 'fire' });
    } });
    H.audio.play('cast_ember');
  },
  firestorm(p, def, st) {
    const t = G.aimTarget(p, def.range);
    H.R.ring(t.x, t.z, 0xffa040, 0.3, st.radius * 1.4, 0.4, 0.1, 1, 0.2);
    G.addZone({ kind: 'firestorm', team: 0, x: t.x, z: t.z, r: st.radius, dur: st.dur, tick: 0.35, owner: p, dmg: st.dmg, pull: 4, hit: hitOpts(p, def, st), color: 0xff6a2b, fx: 'firestorm', extra: H.R.makeTornado(st.radius) });
  },
  nova(p, def, st) {
    const r = st.area;
    H.R.ring(p.x, p.z, H.EL[def.el].color, 0.5, r, 0.4, 0.1, 1, 0.25); H.R.ring(p.x, p.z, 0xffd27a, 0.3, r * 0.8, 0.5);
    H.R.burst(p.x, 0.5, p.z, H.EL[def.el].color, 50, 12, 0.6, 0.6, { flat: true, palette: [0xff6a2b, 0xffd27a, 0xff3d1f], mul: G.fxMul(p) });
    H.R.flash(p.x, p.z, 0xff6a2b, 5, 0.25); H.R.shake(0.35);
    for (const e of G.enemiesNear(p.x, p.z, r)) { const [kx, kz] = H.norm(e.x - p.x, e.z - p.z); G.damage(e, st.dmg, hitOpts(p, def, st, { kx, kz })); }
  },
  chain(p, def, st) {
    const md = G.md || {}; const chains = 1 + (md.multishot || 0); const jumps = st.jumps + (md.pierce || 0); const mult = chains > 1 ? 0.8 : 1;
    const opts = hitOpts(p, def, st, { stacks: (def.stacks || 1) + (md.surge || 0) });
    const col = H.EL[def.el].color; const starts = new Set();
    for (let ci = 0; ci < chains; ci++) {
    let first = G.pickTarget(p, p.aimDX, p.aimDZ, 0.7 + ci * 0.6, def.range + ci * 2) || (p.src === 'kbm' && ci === 0 ? G.pickTarget(p, p.aimDX, p.aimDZ, 0, def.range + 2, p.aimPt.x, p.aimPt.z) : null);
    if (first && starts.has(first)) { first = null; let bd = 1e9; for (const e of G.enemies) { if (e.dead || e.spawnK < 1 || starts.has(e)) continue; const d = H.dist2(e.x, e.z, p.x, p.z); if (d < (def.range + 2) ** 2 && d < bd) { bd = d; first = e; } } }
    if (!first) { if (ci === 0) { H.R.bolt(p.x, 1.1, p.z, p.x + p.aimDX * 4, 0.6, p.z + p.aimDZ * 4, col); H.R.burst(p.x + p.aimDX * 4, 0.6, p.z + p.aimDZ * 4, col, 6, 3, 0.2, 0.3); return; } break; }
    starts.add(first);
    let prev = { x: p.x, z: p.z, y: 1.1 }; const hit = new Set(); let cur = first;
    for (let j = 0; j <= jumps && cur; j++) {
      hit.add(cur); H.R.bolt(prev.x, prev.y, prev.z, cur.x, 1.1, cur.z, col, 1.2); H.R.burst(cur.x, 1.1, cur.z, col, 8, 5, 0.25, 0.35, { mul: G.fxMul(p) });
      G.damage(cur, Math.round(st.dmg * mult * (1 - j * 0.12)), opts);
      prev = { x: cur.x, z: cur.z, y: 1.1 };
      let nx = null, nd = 1e9; for (const e of G.enemies) { if (e.dead || hit.has(e) || e.spawnK < 1) continue; const d = H.dist2(e.x, e.z, cur.x, cur.z); if (d < 36 && d < nd) { nd = d; nx = e; } }
      cur = nx; if (j > 0) H.audio.play('zap');
    }
    H.R.flash(first.x, first.z, col, 2.5, 0.12);
    }
  },
  cone(p, def, st) {
    const md = G.md || {}; const ang = def.angle * Math.PI / 180 / 2 * (1 + 0.35 * (md.multishot || 0)); const col = H.EL[def.el].color; const R0 = def.range + 1.5 * (md.pierce || 0);
    const base = Math.atan2(p.aimDX, p.aimDZ);
    const n = def.el === 'gale' ? 40 : 26;
    for (let k = 0; k < n * G.fxMul(p); k++) { const a = base + (Math.random() * 2 - 1) * ang; const sp = R0 * (2.2 + Math.random() * 1.5); H.R.emit(p.x + p.aimDX * 0.5, 0.6 + Math.random() * 0.8, p.z + p.aimDZ * 0.5, Math.sin(a) * sp, Math.random(), Math.cos(a) * sp, 0.35, def.el === 'gale' ? 0.6 : 0.45, 0.1, def.el === 'venom' ? H.pick([0x8fe64e, 0xc6ff4a, 0x4a8a2a]) : col, def.el === 'gale' ? 0.5 : 0.9, 0, 3); }
    if (def.el === 'gale') { H.R.shake(0.15); H.R.kickCam(-p.aimDX, -p.aimDZ, 0.2); }
    for (const e of G.enemies) {
      if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > R0 + e.r) continue; if (Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + Math.atan2(e.r, Math.max(d, 0.1))) continue;
      const [kx, kz] = H.norm(dx, dz); G.damage(e, Math.round(st.dmg * (md.multishot && Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang * 0.6 ? 1.2 : 1)), hitOpts(p, def, st, { kx, kz, cone: true, stacks: (def.stacks || 1) + (md.surge || 0) }));
    }
    if (def.deflect) {
      for (const pr of G.projs) { if (pr.team !== 1 || pr.dead) continue; const dx = pr.x - p.x, dz = pr.z - p.z, d = Math.hypot(dx, dz); if (d < R0 && Math.abs(H.angDiff(Math.atan2(dx, dz), base)) < ang + 0.2) { pr.dead = true; H.R.burst(pr.x, 1, pr.z, 0xc9fff0, 8, 4, 0.3, 0.3); G.float(pr.x, 1.5, pr.z, 'DEFLECT', 'small'); } }
    }
  },
  dash(p, def, st) {
    const it = p.intent || { mx: 0, mz: 0 };
    let [dx, dz] = Math.hypot(it.mx, it.mz) > 0.2 ? H.norm(it.mx, it.mz) : [p.aimDX, p.aimDZ];
    p.dashT = st.range / 40; p.dashDX = dx; p.dashDZ = dz; p.dashSpeed = 40; p.iframes = p.dashT + 0.12; p.dashFx = 0xc9fff0;
    p.dashCharges = Math.min(p.dashMax, p.dashCharges + 1);
    const hit = new Set();
    p.dashTrail = (pp) => { for (const e of G.enemiesNear(pp.x, pp.z, 1.6)) if (!hit.has(e)) { hit.add(e); const [kx, kz] = H.norm(-pp.dashDZ, pp.dashDX); const side = ((e.x - pp.x) * kx + (e.z - pp.z) * kz) > 0 ? 1 : -1; G.damage(e, st.dmg, hitOpts(pp, def, st, { knock: 8, kx: kx * side, kz: kz * side })); } };
    H.audio.play('dash'); H.R.ring(p.x, p.z, 0xc9fff0, 0.3, 2, 0.3);
  },
  dashTrail(p, def, st) {
    const it = p.intent || { mx: 0, mz: 0 };
    let [dx, dz] = Math.hypot(it.mx, it.mz) > 0.2 ? H.norm(it.mx, it.mz) : [p.aimDX, p.aimDZ];
    p.dashT = st.range / 38; p.dashDX = dx; p.dashDZ = dz; p.dashSpeed = 38; p.iframes = p.dashT + 0.1; p.dashFx = 0xff6a2b;
    let acc = 0;
    p.dashTrail = (pp, dt) => { acc += dt; if (acc > 0.035) { acc = 0; G.addZone({ kind: 'fire', team: 0, x: pp.x, z: pp.z, r: 1.1, dur: 3, tick: 0.5, owner: pp, dmg: st.dmg / 2, hit: hitOpts(pp, def, st), color: 0xff6a2b, fx: 'fire' }); } };
  },
  blink(p, def, st) {
    const t = G.aimTarget(p, st.range);
    let tx = t.x, tz = t.z;
    for (let k = 0; k < 12 && G.blocked(tx, tz, 0.6); k++) { tx -= (tx - p.x) * 0.12; tz -= (tz - p.z) * 0.12; }
    const col = H.EL.volt.color;
    const burst = (x, z) => { H.R.burst(x, 1, z, col, 24, 8, 0.35, 0.5, { mul: G.fxMul(p) }); H.R.ring(x, z, col, 0.3, 2.4, 0.3); for (const e of G.enemiesNear(x, z, 2.3)) G.damage(e, st.dmg, hitOpts(p, def, st)); };
    burst(p.x, p.z); H.R.bolt(p.x, 1, p.z, tx, 1, tz, col, 1.5);
    p.x = tx; p.z = tz; p.iframes = 0.3; G.collide(p); burst(p.x, p.z); H.R.flash(p.x, p.z, col, 3, 0.15);
  },
  ward(p, def, st) {
    p.ward = { hp: st.absorb, max: st.absorb, t: 5, dmg: st.dmg, def, st };
    H.R.burst(p.x, 1, p.z, 0x9fe8ff, 20, 4, 0.5, 0.4); H.audio.play('freeze');
  },
  bastion(p, def, st) { p.bastionT = 3.5; p.bastionSt = st; H.R.ring(p.x, p.z, 0xd99b5f, 0.5, 2.5, 0.35, 0.1, 1, 0.3); H.R.shake(0.2); H.R.burst(p.x, 0.4, p.z, 0xd99b5f, 20, 6, 0.5, 0.5, { flat: true, grav: 9 }); },
  mirror(p, def, st) { p.mirrorT = 1.6; p.mirrorSt = st; H.R.ring(p.x, p.z, 0xbb80ff, 0.5, 1.6, 0.3); },
  snare(p, def, st) {
    const t = G.aimTarget(p, def.range);
    G.addZone({ kind: 'snare', team: 0, x: t.x, z: t.z, r: 3, dur: 0.5, delay: 0.45, owner: p, color: 0x8fe8ff, onEnd: z => {
      H.R.burst(z.x, 0.4, z.z, 0xbff6ff, 40, 7, 0.6, 0.45, { flat: true }); H.R.ring(z.x, z.z, 0xbff6ff, 0.5, 3, 0.35); H.audio.play('freeze'); H.R.shake(0.15);
      for (const e of G.enemiesNear(z.x, z.z, 3)) G.damage(e, st.dmg, hitOpts(p, def, st));
    } });
  },
  totem(p, def, st) {
    const t = G.aimTarget(p, def.range);
    const mesh = H.R.makeTotem(); mesh.position.set(t.x, 0, t.z);
    G.totems.push({ kind: 'totem', x: t.x, z: t.z, r: 0.5, t: def.dur, zapT: 0, owner: p, st, def, mesh, hp: 60 });
    H.R.ring(t.x, t.z, 0xffe45c, 0.3, 2, 0.3);
  },
  cloud(p, def, st) {
    const t = G.aimTarget(p, def.range);
    G.addZone({ kind: 'cloud', team: 0, x: t.x, z: t.z, r: 3.5, dur: def.dur, tick: 0.5, owner: p, dmg: st.dmg, slow: 0.25, hit: hitOpts(p, def, st), color: 0x8fe64e, fx: 'cloud' });
  },
  cyclone(p, def, st) {
    G.addZone({ kind: 'cyclone', team: 0, x: p.x + p.aimDX * 1.5, z: p.z + p.aimDZ * 1.5, r: 2.2, dur: def.dur, tick: 0.3, owner: p, dmg: st.dmg, hit: hitOpts(p, def, st), color: 0xc9fff0, fx: 'cyclone', vx: p.aimDX * 6, vz: p.aimDZ * 6, pull: 9 });
  },
  line(p, def, st) {
    const n = 7, sp = def.range / n; const dx = p.aimDX, dz = p.aimDZ; const hit = new Set();
    for (let i = 1; i <= n; i++) {
      const x = p.x + dx * sp * i, z = p.z + dz * sp * i;
      G.after(() => {
        if (!G.active || G.blocked(x, z, 0.1)) return;
        H.R.burst(x, 0.3, z, 0xd99b5f, 10, 6, 0.5, 0.45, { grav: 14, up: 5, mul: G.fxMul(p) }); H.R.ring(x, z, 0xdca16a, 0.2, 1.2, 0.25); H.R.decal(x, z, 0xdca16a, 1, 1.5);
        H.R.shake(0.06);
        for (const e of G.enemiesNear(x, z, 1.1)) if (!hit.has(e)) { hit.add(e); G.damage(e, st.dmg, hitOpts(p, def, st, { kx: dx, kz: dz, knock: 3 })); }
      }, i * 45);
    }
  },
  orb(p, def, st) {
    G.fireProj({ team: 0, x: p.x + p.aimDX, z: p.z + p.aimDZ, dx: p.aimDX, dz: p.aimDZ, speed: def.speed, range: def.range, r: 0.6, dmg: 0, pierce: 99, color: 0xb36bff, size: 0.8, owner: p, orb: { st, def, tick: 0 }, hit: hitOpts(p, def, st) });
  },
  well(p, def, st) {
    const t = G.aimTarget(p, def.range);
    G.addZone({ kind: 'well', team: 0, x: t.x, z: t.z, r: 5, dur: def.dur, tick: 0.25, owner: p, dmg: 2, pull: 12, hit: hitOpts(p, def, st, { status: null }), color: 0xb36bff, fx: 'well', onEnd: z => {
      H.R.burst(z.x, 1, z.z, 0xb36bff, 50, 10, 0.6, 0.6, { mul: G.fxMul(p) }); H.R.ring(z.x, z.z, 0xd7a6ff, 5, 0.3, 0.35, 0.1, 1, 0.3); H.R.flash(z.x, z.z, 0xb36bff, 5, 0.3); H.R.shake(0.3); H.audio.play('explode');
      for (const e of G.enemiesNear(z.x, z.z, 3)) G.damage(e, st.dmg, hitOpts(p, def, st, { stun: 0.8 }));
    } });
  }
};
G.fxMul = p => (G.players.length > 1 && p.idx === 1 ? H.settings.allyFx : 1) * (G.players.length > 1 ? 0.75 : 1);
G.breakWard = function (p) {
  const w = p.ward; if (!w) return; p.ward = null;
  H.R.burst(p.x, 1, p.z, 0xbff6ff, 30, 7, 0.5, 0.45); H.R.ring(p.x, p.z, 0xbff6ff, 0.5, 3.2, 0.3); H.audio.play('shatter');
  for (const e of G.enemiesNear(p.x, p.z, 3.2)) G.damage(e, w.dmg, hitOpts(p, w.def, w.st));
};

/* ---------------- Projectiles ---------------- */
G.fireProj = function (o) {
  if (o.team === 1 && !G.tut) o.speed = (o.speed || 12) * H.ENEMY_PROJ_SPEED;
  o.mesh = H.R.makeProjMesh(o.color, o.team === 1, o.size || 0.4);
  o.y = o.y || 1.0; o.traveled = 0; o.hitSet = new Set(); o.dead = false;
  o.mesh.position.set(o.x, o.y, o.z);
  G.projs.push(o); return o;
};
G.updateProjs = function (dt) {
  for (const pr of G.projs) {
    if (pr.dead) continue;
    if (pr.homing && pr.team === 1) { const t = G.nearestPlayer(pr.x, pr.z); if (t) { const [hx, hz] = H.norm(t.x - pr.x, t.z - pr.z); pr.dx += (hx - pr.dx) * dt * pr.homing; pr.dz += (hz - pr.dz) * dt * pr.homing; [pr.dx, pr.dz] = H.norm(pr.dx, pr.dz); } }
    if (pr.accel) pr.speed = Math.min(pr.maxSpeed || 30, pr.speed + pr.accel * dt);
    const step = pr.speed * dt; pr.x += pr.dx * step; pr.z += pr.dz * step; pr.traveled += step;
    pr.mesh.position.set(pr.x, pr.y, pr.z);
    if (pr.mesh.userData.spin) pr.mesh.userData.spin.material.rotation += dt * 6;
    // trail
    if (pr.team === 0) { if (Math.random() < 0.8) H.R.emit(pr.x, pr.y, pr.z, -pr.dx + (Math.random() - .5), (Math.random() - .5), -pr.dz + (Math.random() - .5), 0.25, (pr.size || 0.4) * 1.1, 0, pr.color, 0.8, 0, 2); }
    else if (Math.random() < 0.5) H.R.emit(pr.x, pr.y, pr.z, 0, 0, 0, 0.2, 0.4, 0, 0xff2e55, 0.6, 0, 1);
    // orb behaviour
    if (pr.orb) {
      pr.orb.tick -= dt; for (const e of G.enemiesNear(pr.x, pr.z, 3.6)) { if (e.boss) continue; const [nx, nz] = H.norm(pr.x - e.x, pr.z - e.z); e.kvx += nx * 14 * dt / Math.max(0.5, e.mass * 0.5); e.kvz += nz * 14 * dt / Math.max(0.5, e.mass * 0.5); }
      if (pr.orb.tick <= 0) { pr.orb.tick = 0.3; for (const e of G.enemiesNear(pr.x, pr.z, 1.8)) G.damage(e, Math.round(pr.orb.st.dmg * 0.22), Object.assign({}, pr.hit, { status: null, quiet: true })); }
      if (Math.random() < 0.9) { const a = Math.random() * 7; H.R.emit(pr.x + Math.cos(a) * 2.5, 1, pr.z + Math.sin(a) * 2.5, -Math.cos(a) * 6, 0, -Math.sin(a) * 6, 0.4, 0.3, 0.05, 0xd7a6ff, 0.8, 0, 0); }
      if (pr.traveled >= pr.range) { G.orbCollapse(pr); continue; }
    }
    // bounds / pillars
    const b = G.room.bounds;
    if (!G.inRoom(pr.x, pr.z, -1) || pr.traveled > pr.range) { pr.dead = true; continue; }
    let hitWall = false; for (const p of G.room.pillars) if (H.dist2(pr.x, pr.z, p.x, p.z) < (p.r + pr.r * 0.5) ** 2) hitWall = true;
    if (hitWall) { pr.dead = true; H.R.burst(pr.x, pr.y, pr.z, pr.team === 1 ? 0xff2e55 : pr.color, 8, 4, 0.3, 0.3); if (pr.orb) G.orbCollapse(pr); continue; }
    if (pr.team === 0) {
      for (const e of G.enemies) {
        if (e.dead || e.spawnK < 1 || pr.hitSet.has(e)) continue;
        if (H.dist2(pr.x, pr.z, e.x, e.z) < (pr.r + e.r) ** 2) {
          if (pr.orb) { G.orbCollapse(pr); break; }
          pr.hitSet.add(e);
          G.damage(e, pr.dmg, Object.assign({}, pr.hit, { kx: pr.dx, kz: pr.dz, proj: pr }));
          H.R.burst(pr.x, pr.y, pr.z, pr.color, 7, 5, 0.25, 0.35, { mul: G.fxMul(pr.owner) });
          if (pr.blocked) { pr.dead = true; break; }
          if (pr.pierce-- <= 0) { if (pr.explode) G.projExplode(pr); if (pr.ricochet > 0 && G.ricochet(pr)) { pr.ricochet--; pr.pierce = 0; break; } pr.dead = true; break; }
        }
      }
    } else {
      for (const p of G.players) {
        if (p.dead || p.downed) continue;
        const d2 = H.dist2(pr.x, pr.z, p.x, p.z);
        if (p.mirrorT > 0 && d2 < 2.4 * 2.4) { G.reflect(pr, p); break; }
        if (d2 < (pr.r + p.r * 0.85) ** 2) {
          if (p.iframes > 0) { if (!pr.dodged) { pr.dodged = true; G.run.dodges++; G.float(p.x, 2.2, p.z, 'DODGE', 'small good'); H.audio.play('dodge'); if (G.tut) G.tutEvent('dodge'); } continue; }
          G.hurtPlayer(p, pr.dmg, pr.srcName || 'a hostile bolt', { kx: pr.dx, kz: pr.dz, knock: pr.knock || 3, by: pr.ownerEnt });
          if (pr.slow) p.slowT = Math.max(p.slowT, pr.slow);
          pr.dead = true; H.R.burst(pr.x, pr.y, pr.z, 0xff2e55, 10, 5, 0.3, 0.35); break;
        }
      }
      for (const t of G.totems) if (!pr.dead && H.dist2(pr.x, pr.z, t.x, t.z) < 0.8) { pr.dead = true; t.hp -= pr.dmg; }
    }
  }
  G.projs = G.projs.filter(p => { if (p.dead) { H.R.removeMesh(p.mesh); return false; } return true; });
};
G.ricochet = function (pr) {
  let best = null, bd = 49;
  for (const e of G.enemies) { if (e.dead || e.spawnK < 1 || pr.hitSet.has(e)) continue; const d = H.dist2(pr.x, pr.z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
  if (!best) return false;
  [pr.dx, pr.dz] = H.norm(best.x - pr.x, best.z - pr.z); pr.traveled = Math.max(0, pr.range - 9);
  H.R.burst(pr.x, pr.y, pr.z, pr.color, 10, 4, 0.25, 0.3); H.R.ring(pr.x, pr.z, pr.color, 0.2, 1, 0.2); H.audio.play('block');
  return true;
};
G.projExplode = function (pr) {
  const r = 1.5 + 0.4 * pr.explode;
  H.R.ring(pr.x, pr.z, pr.color, 0.3, r, 0.3, 0.1, 1, 0.25); H.R.burst(pr.x, 1, pr.z, pr.color, 22, 6, 0.4, 0.45); H.R.flash(pr.x, pr.z, pr.color, 2, 0.15); H.audio.play('explode');
  for (const e of G.enemiesNear(pr.x, pr.z, r)) G.damage(e, Math.round(pr.dmg * 0.5), Object.assign({}, pr.hit, { quiet: true, spell: pr.hit.spell }));
};
G.reflect = function (pr, p) {
  const st = p.mirrorSt; const t = G.pickTarget(p, -pr.dx, -pr.dz, Math.PI, 20);
  let [dx, dz] = t ? H.norm(t.x - pr.x, t.z - pr.z) : [-pr.dx, -pr.dz];
  pr.dead = true; H.R.ring(pr.x, pr.z, 0xbb80ff, 0.2, 1.2, 0.2); H.audio.play('block');
  G.fireProj({ team: 0, x: pr.x, z: pr.z, dx, dz, speed: 26, range: 20, r: 0.4, dmg: st.dmg, pierce: 0, color: 0xbb80ff, owner: p, hit: { src: p, el: 'void', status: 'hex', stacks: 1, spell: 'null_mirror' } });
};
G.orbCollapse = function (pr) {
  if (pr.dead && pr.collapsed) return; pr.dead = true; pr.collapsed = true;
  const st = pr.orb.st; H.R.burst(pr.x, 1, pr.z, 0xb36bff, 40, 9, 0.5, 0.55, { mul: G.fxMul(pr.owner) }); H.R.ring(pr.x, pr.z, 0xd7a6ff, 3, 0.3, 0.35, 0.1, 1, 0.3); H.R.flash(pr.x, pr.z, 0xb36bff, 4, 0.25); H.audio.play('explode'); H.R.shake(0.2);
  for (const e of G.enemiesNear(pr.x, pr.z, 2.8)) G.damage(e, st.dmg, Object.assign({}, pr.hit));
};

/* ---------------- Zones ---------------- */
G.disposeZone = function (z) { H.R.removeMesh(z.mesh); if (z.extra) { H.R.removeMesh(z.extra); z.extra = null; } if (z.snd) { z.snd.stop(); z.snd = null; } };
G.addZone = function (z) {
  z.t = 0; z.tickT = 0; z.delay = z.delay || 0; z.dead = false;
  if (!z.nomesh && (z.fx !== 'fire' || !G.zoneFireCount || G.zoneFireCount < 40)) z.mesh = H.R.makeZoneMesh(z.color, z.r, z.kind === 'snare' ? 0.6 : 0.3);
  G.zones.push(z); return z;
};
G.updateZones = function (dt) {
  let fires = 0;
  for (const z of G.zones) {
    if (z.dead) continue; z.t += dt; if (z.kind === 'fire') fires++;
    if (z.vx) { z.x += z.vx * dt; z.z += z.vz * dt; if (G.blocked(z.x, z.z, 0.5)) { z.vx *= -0.5; z.vz *= -0.5; } }
    if (z.mesh) { z.mesh.position.set(z.x, 0.06, z.z); z.mesh.rotation.z += dt * (z.kind === 'well' || z.kind === 'cyclone' ? 4 : 0.6); const k = z.t / (z.delay + z.dur); z.mesh.material.opacity = (z.kind === 'snare' ? 0.3 + k * 0.6 : 0.3) * (k > 0.85 ? (1 - k) / 0.15 : 1); }
    const active = z.t >= z.delay;
    // fx
    if (z.fx === 'fire' && Math.random() < dt * 14) H.R.emit(z.x + (Math.random() - .5) * z.r, 0.2, z.z + (Math.random() - .5) * z.r, 0, 2 + Math.random() * 2, 0, 0.5, 0.45, 0.05, H.pick([0xff6a2b, 0xffd27a, 0xff3d1f]), 0.9, -1, 1);
    if (z.fx === 'cloud' && Math.random() < dt * 30) H.R.emit(z.x + (Math.random() - .5) * z.r * 1.6, 0.3 + Math.random(), z.z + (Math.random() - .5) * z.r * 1.6, (Math.random() - .5), 0.3, (Math.random() - .5), 1.2, 1.1, 0.6, H.pick([0x5a9a2e, 0x8fe64e, 0x3a5a1e]), 0.35, 0, 0.5);
    if ((z.fx === 'well' || z.fx === 'cyclone') && Math.random() < dt * 50) { const a = Math.random() * 7, rr = z.r * (0.5 + Math.random() * 0.5); H.R.emit(z.x + Math.cos(a) * rr, 0.3 + Math.random() * (z.fx === 'cyclone' ? 3 : 1), z.z + Math.sin(a) * rr, -Math.sin(a) * 6 - Math.cos(a) * 3, z.fx === 'cyclone' ? 2 : 0, Math.cos(a) * 6 - Math.sin(a) * 3, 0.4, 0.35, 0.05, z.color, 0.8, 0, 1); }
    if (z.kind === 'meteor' && z.extra) { const k = Math.min(1, z.t / z.delay); const e = k * k; z.extra.position.set(z.from[0] + (z.x - z.from[0]) * e, z.from[1] + (0.6 - z.from[1]) * e, z.from[2] + (z.z - z.from[2]) * e); z.extra.rotation.x += dt * 6; z.extra.rotation.y += dt * 4; if (z.mesh) { z.mesh.material.opacity = 0.25 + k * 0.6; z.mesh.scale.setScalar(0.4 + 0.6 * k); } for (let q = 0; q < 3; q++) H.R.emit(z.extra.position.x + (Math.random() - .5) * 0.5, z.extra.position.y, z.extra.position.z + (Math.random() - .5) * 0.5, (Math.random() - .5), 1, (Math.random() - .5), 0.5, 0.9, 0.2, H.pick([0xff6a2b, 0xffd27a, 0x3a1a0a]), 0.9, 0, 1); }
    if (z.kind === 'flamestream') {
      const o = z.owner;
      if (!o || o.dead || o.downed || !G.players.includes(o)) { z.dead = true; continue; }
      const base = Math.atan2(o.aimDX, o.aimDZ), R0 = z.R0, ang = z.ang;
      z.x = o.x; z.z = o.z;
      if (z.extra) { z.extra.position.set(o.x, 0.4, o.z); z.extra.rotation.y = base - Math.PI / 2; const grow = Math.min(1, z.t * 6), fade = z.t > z.dur - 0.2 ? Math.max(0, (z.dur - z.t) / 0.2) : 1; z.extra.scale.setScalar(R0 * 1.05 * grow * (0.96 + Math.random() * 0.06)); z.extra.children.forEach(c => c.material.opacity = c.userData.op * 0.8 * fade); }
      if (Math.random() < 0.9) for (let k = 0; k < Math.round(7 * G.fxMul(o)); k++) { const a = base + (Math.random() * 2 - 1) * ang; const sp = R0 * (2.6 + Math.random() * 1.6); H.R.emit(o.x + o.aimDX * 0.6, 0.6 + Math.random() * 0.6, o.z + o.aimDZ * 0.6, Math.sin(a) * sp, 0.3 + Math.random(), Math.cos(a) * sp, 0.36 + Math.random() * 0.1, 0.6, 0.18, H.pick([0xff6a2b, 0xffa040, 0xffd27a, 0xff3d1f]), 1, -1.2, 3); }
      if (H.audio.ready && H.settings.sfx) { if (!z.snd || z.snd.done) { if (z.t < z.dur - 0.3) z.snd = H.audio.loopFirestorm(); } if (z.snd) { z.snd.touch(); if (z.t > z.dur - 0.25) z.snd.stop(); } }
      z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = z.def.tick;
        for (const e of G.enemies) {
          if (e.dead || e.spawnK < 1) continue; const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz);
          if (d > R0 + e.r || Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + Math.atan2(e.r, Math.max(d, 0.1))) continue;
          G.damage(e, z.st.dmg, hitOpts(o, z.def, z.st, { cone: true, quiet: true }));
        }
      }
    }
    if (z.kind === 'flamewave' && z.extra) { const k = Math.min(1, z.t / z.dur); const o = z.owner; z.extra.position.set(o.x, 0.35, o.z); z.extra.scale.setScalar(z.R0 * 1.05 * (0.35 + 0.65 * (1 - Math.pow(1 - k, 2)))); z.extra.children.forEach(c => c.material.opacity = c.userData.op * (1 - k * k)); }
    if (z.kind === 'firestorm' && H.audio.ready && H.settings.sfx) { if ((!z.snd || z.snd.done) && z.t < z.dur * 0.95) z.snd = H.audio.loopFirestorm(); if (z.snd) { z.snd.touch(); if (z.t > z.dur - 0.3) z.snd.stop(); } }
    if (z.kind === 'firestorm' && z.extra && H.R.texSwirl) H.R.texSwirl.offset.y -= dt * 0.6;
    if (z.kind === 'firestorm' && z.extra) { z.extra.position.set(z.x, 0, z.z); z.extra.children.forEach((c, i) => { if (c.isMesh) { c.rotation.y += dt * (6 + i * 3);  c.scale.x = c.scale.z = 1 + Math.sin(z.t * 7 + i) * 0.06; } }); const life = z.t / z.dur; const fade = life > 0.85 ? (1 - life) / 0.15 : Math.min(1, z.t * 4); z.extra.scale.setScalar(Math.max(0.05, fade)); if (Math.random() < dt * 60) { const a = Math.random() * 7, rr = z.r * (0.2 + Math.random() * 0.6), y = Math.random() * 3; H.R.emit(z.x + Math.cos(a) * rr, y, z.z + Math.sin(a) * rr, -Math.sin(a) * 7, 2 + Math.random() * 2, Math.cos(a) * 7, 0.5, 0.45, 0.05, H.pick([0xff6a2b, 0xffa040, 0xffd27a]), 1, -0.5, 1); } }
    if (z.fx === 'lava' && Math.random() < dt * 20) H.R.emit(z.x + (Math.random() - .5) * z.w, 0.1, z.z + (Math.random() - .5) * z.d, 0, 2, 0, 0.6, 0.6, 0.1, H.pick([0xff6a2b, 0xffd27a]), 0.9, -1, 1);
    if (active && z.pull) { for (const e of G.enemiesNear(z.x, z.z, z.r)) { if (e.boss) continue; const [nx, nz] = H.norm(z.x - e.x, z.z - e.z); const d = Math.hypot(z.x - e.x, z.z - e.z); if (d > 0.4) { e.x += nx * Math.min(d, z.pull * dt / Math.max(0.7, e.mass * 0.4)); e.z += nz * Math.min(d, z.pull * dt / Math.max(0.7, e.mass * 0.4)); } } }
    if (active && z.tick) {
      z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = z.tick;
        if (z.team === 0) { for (const e of G.enemiesNear(z.x, z.z, z.r)) { G.damage(e, Math.max(1, Math.round(z.dmg)), Object.assign({}, z.hit, { quiet: z.kind !== 'cyclone', knock: 0 })); if (z.slow) e.slowZ = 0.6; } }
        else { for (const p of G.players) if (!p.dead && !p.downed && G.inZone(z, p.x, p.z)) G.hurtPlayer(p, z.dmg, z.srcName || 'scorched ground', { dot: true, burn: z.burn }); for (const e of G.enemies) if (!e.dead && !e.boss && z.hurtsEnemies && G.inZone(z, e.x, e.z)) G.damage(e, z.dmg, { el: 'ember', quiet: true }); }
      }
    }
    if (z.t >= z.delay + z.dur) { z.dead = true; if (z.onEnd) z.onEnd(z); }
  }
  G.zoneFireCount = fires;
  G.zones = G.zones.filter(z => { if (z.dead) { G.disposeZone(z); return false; } return true; });
};
G.inZone = (z, x, y) => z.w ? (Math.abs(x - z.x) <= z.w / 2 && Math.abs(y - z.z) <= z.d / 2) : H.dist2(x, y, z.x, z.z) <= z.r * z.r;

G.updateTotems = function (dt) {
  for (const t of G.totems) {
    t.t -= dt; t.zapT -= dt; t.mesh.userData.orb.rotation.y += dt * 4; t.mesh.userData.orb.position.y = 2.1 + Math.sin(G.time * 5) * 0.1;
    if (t.zapT <= 0) { let best = null, bd = 49; for (const e of G.enemies) { if (e.dead || e.spawnK < 1) continue; const d = H.dist2(e.x, e.z, t.x, t.z); if (d < bd) { bd = d; best = e; } }
      if (best) { t.zapT = 0.5; H.R.bolt(t.x, 2.1, t.z, best.x, 1, best.z, 0xffe45c); H.audio.play('zap'); G.damage(best, t.st.dmg, { src: t.owner, el: 'volt', status: 'shock', stacks: 1, spell: 'storm_totem' }); } }
    if (t.t <= 0 || t.hp <= 0) { t.dead = true; H.R.burst(t.x, 1.5, t.z, 0xffe45c, 20, 5, 0.4, 0.4); }
  }
  G.totems = G.totems.filter(t => { if (t.dead) { H.R.removeMesh(t.mesh); return false; } return true; });
};

/* ---------------- Telegraph update ---------------- */
G.updateTelegraphs = function (dt) {
  for (const t of G.tgs) {
    if (t.done) continue;
    t.t += dt;
    if (t.follow) t.follow(t);
    const k = Math.min(1, t.t / t.dur);
    t.mesh.material.uniforms.uProg.value = k;
    t.mesh.position.set(t.x, 0.05, t.z);
    if (t.o.dx != null) t.mesh.rotation.y = Math.atan2(-t.o.dx, -t.o.dz);
    if (t.owner && (t.owner.dead || t.owner.stunT > 0 || t.owner.frozenT > 0) && !t.persist) { t.done = true; t.cancelled = true; continue; }
    if (t.t >= t.dur) { t.done = true; if (t.onFire) t.onFire(t); }
  }
  G.tgs = G.tgs.filter(t => { if (t.done) { if (!t.fade) H.R.removeMesh(t.mesh); return false; } return true; });
};
/* hostile area hit helper */
G.hitPlayersIn = function (t, dmg, srcName, o = {}) {
  let any = false;
  for (const p of G.players) { if (p.dead || p.downed) continue; if (G.inTelegraph(t, p.x, p.z, p.r * 0.6)) { if (p.iframes > 0) { G.float(p.x, 2.2, p.z, 'DODGE', 'small good'); G.run.dodges++; if (G.tut) G.tutEvent('dodge'); continue; } G.hurtPlayer(p, dmg, srcName, Object.assign({ kx: p.x - t.x, kz: p.z - t.z }, o)); any = true; } }
  for (const tt of G.totems) if (G.inTelegraph(t, tt.x, tt.z)) tt.hp -= dmg;
  return any;
};

/* ---------------- Vents ---------------- */
G.updateVents = function (dt) {
  for (const v of G.room.vents) {
    v.t += dt;
    const cycle = v.period; const ph = v.t % cycle;
    const st = ph < cycle - 1.6 ? 'idle' : ph < cycle - 0.6 ? 'warn' : 'fire';
    if (st !== v.state) {
      v.state = st;
      if (st === 'warn') { v.tgRef = G.tg('circle', { x: v.x, z: v.z, r: v.r + 0.4, color: 0xff7a2e }, 1.0, null, null); }
      if (st === 'fire') { H.R.burst(v.x, 0.3, v.z, 0xff6a2b, 30, 6, 0.7, 0.6, { up: 9, grav: 8, palette: [0xff6a2b, 0xffd27a, 0xff3d1f] }); H.R.flash(v.x, v.z, 0xff6a2b, 2.5, 0.4); H.audio.play('cast_ember'); v.hitSet = new Set(); }
    }
    if (st === 'fire') {
      if (Math.random() < 0.7) H.R.emit(v.x + (Math.random() - .5) * v.r, 0.3, v.z + (Math.random() - .5) * v.r, 0, 6 + Math.random() * 4, 0, 0.4, 0.6, 0.1, H.pick([0xff6a2b, 0xffd27a]), 1, 0, 1);
      for (const p of G.players) if (!p.dead && !p.downed && !v.hitSet.has(p) && H.dist2(p.x, p.z, v.x, v.z) < (v.r + 0.2) ** 2) { v.hitSet.add(p); if (p.iframes <= 0) { G.hurtPlayer(p, 14, 'a fire vent', { burn: true }); } }
      for (const e of G.enemies) if (!e.dead && !e.flying && !v.hitSet.has(e) && H.dist2(e.x, e.z, v.x, v.z) < (v.r + e.r) ** 2) { v.hitSet.add(e); G.damage(e, 25, { el: 'ember', status: 'burn', stacks: 2, spell: 'vent' }); }
    }
  }
};

/* ---------------- Damage, statuses, reactions ---------------- */
G.damage = function (e, amt, o = {}) {
  if (e.dead || e.spawnK < 1 || e.invuln) return 0;
  if (e.ai && e.ai.state === 'intro') return 0;
  const run = G.run;
  // shieldbearer frontal block
  if (e.type === 'shieldbearer' && !e.stunT && !e.frozenT && !(e.statuses.sunder) && (o.proj || o.cone) && !o.ignoreShield) {
    const fx = -Math.sin(e.faceAng), fz = -Math.cos(e.faceAng);
    const sx = o.src ? o.src.x - e.x : -(o.kx || 0), sz = o.src ? o.src.z - e.z : -(o.kz || 0);
    const [nx, nz] = H.norm(sx, sz);
    if (nx * fx + nz * fz > 0.35 && o.el !== 'gale' && !o.interrupt) {
      G.float(e.x, 2.2, e.z, 'BLOCKED', 'small block'); H.audio.play('block'); H.R.burst(e.x + fx * 0.8, 1, e.z + fz * 0.8, 0xffe0a0, 8, 5, 0.25, 0.25);
      if (o.proj) o.proj.blocked = true; e.stagger += amt * 0.3; return 0;
    }
  }
  let mul = 1;
  if (e.etherealT > 0) { if (!o.quiet) G.float(e.x, 2.4, e.z, 'ETHEREAL', 'small block'); return 0; }
  if (e.statuses.shock) mul += H.STATUS.shock.vuln;
  const C = H.classOf(e);
  if (C) { if (C.blunt && (o.blunt || (o.el === 'stone' && !o.phys))) mul += C.blunt - 1; if (C.pierce && o.pierce) mul += C.pierce - 1; if (C.magicRes && !o.phys && !o.dot) mul -= C.magicRes; }
  if (e.frozenT > 0) mul += 0.15;
  if (e.brute_stunned) mul += 0.5;
  if (e.boss && e.staggered) mul += 0.3;
  if ((e.elite || e.boss) && o.src && o.src.charms && o.src.charms.has('hunters_mark')) mul += 0.18;
  if (o.src && o.src.charms && o.src.charms.has('glass_edge') && o.reaction) mul += 0.25;
  if (e.type === 'dummy' || e.type === 'turret') mul = 1;
  const dmg = Math.max(1, Math.round(amt * mul));
  e.hp -= dmg; e.lastHurtT = 0;
  if (e.type === 'dummy' || e.type === 'turret') e.hp = Math.max(e.hp, 1);
  if (e.boss) { e.stagger += dmg * (o.interrupt ? 2.2 : o.reaction ? 1.6 : 1) * (o.stun ? 1.5 : 1); }
  // stats
  if (o.spell && run) { run.dmgBySpell[o.spell] = (run.dmgBySpell[o.spell] || 0) + dmg; }
  if (o.src && o.src.kind === 'player') { o.src.dmgDealt += dmg; if (!o.divine) G.gainDivine(o.src, Math.min(H.DIVINE.dealtCap, dmg * H.DIVINE.dealt)); }
  // feedback
  H.R.flashEnemy(e.model);
  if (!o.quiet || dmg >= 8) G.float(e.x + (Math.random() - .5) * 0.6, 2 + (e.boss ? 2.5 : 0), e.z, String(dmg), o.reaction ? 'react' : (o.el ? 'el-' + o.el : ''));
  if (!o.quiet && o.spell === 'cinder_bolt') H.audio.play('fire_hit');
  if (!o.quiet) { H.audio.play('hit', { heavy: dmg > 25 }); if (dmg >= 25) { G.hitstop = Math.max(G.hitstop, 0.05); H.R.shake(0.12); } }
  // knockback
  if (o.knock && !e.boss) { const [kx, kz] = H.norm(o.kx || (e.x - (o.src ? o.src.x : e.x)) || 0.01, o.kz || (e.z - (o.src ? o.src.z : e.z))); const f = o.knock / Math.max(0.6, e.mass); e.kvx += kx * f; e.kvz += kz * f; }
  // interrupt
  const winding = e.ai && (e.ai.state === 'windup') && e.ai.atk && !e.ai.atk.uninterruptible;
  if (winding && (o.interrupt || (e.ai.atk.channel && (e.chanDmg = (e.chanDmg || 0) + dmg) >= e.maxHp * 0.18) || o.stun)) G.interrupt(e, o);
  // stun
  if (o.stun && !e.boss) e.stunT = Math.max(e.stunT, o.stun);
  // venom ink
  if (o.src && o.src.charms && o.src.charms.has('venom_ink') && o.role === 'attack' && o.status !== 'poison') G.applyStatus(e, 'poison', 1, o.src, { spell: 'venom_ink' });
  // static sigil
  if (e.statuses.shock && o.src && o.src.charms && o.src.charms.has('static_sigil') && !o.staticArc) { const n = G.enemiesNear(e.x, e.z, 5, e).filter(x => !x.dead)[0]; if (n) { H.R.bolt(e.x, 1, e.z, n.x, 1, n.z, 0xffe45c, 0.6); G.damage(n, 6, { src: o.src, el: 'volt', quiet: true, staticArc: true, spell: 'static_sigil' }); } }
  if (o.status) G.applyStatus(e, o.status, o.stacks || 1, o.src, o);
  if (e.hp <= 0 && !e.dead) G.kill(e, o);
  if (G.tut) G.tutEvent('hit', { e, o });
  return dmg;
};
G.interrupt = function (e, o) {
  G.cancelTelegraphs(e);
  const wasChannel = e.ai.atk && e.ai.atk.channel;
  e.ai.state = 'recover'; e.ai.t = 0; e.ai.atk = null; e.windupK = 0; e.chanDmg = 0;
  if (e.boss) { e.stagger += 60; e.ai.t = 0.6; }
  else e.stunT = Math.max(e.stunT, wasChannel ? 1.8 : 1.1);
  G.float(e.x, 2.6 + (e.boss ? 3 : 0), e.z, 'INTERRUPTED', 'big interrupt');
  H.audio.play('interrupt'); H.R.burst(e.x, 1.6, e.z, 0xffffff, 24, 7, 0.4, 0.35); H.R.ring(e.x, e.z, 0xffffff, 0.4, 2.4, 0.3);
  G.hitstop = Math.max(G.hitstop, 0.06);
  G.run.interrupts++; G.run.score += 20;
  G.emit('interrupt', { e });
  if (G.tut) G.tutEvent('interrupt');
  if (e.onInterrupted) e.onInterrupted();
};
G.applyStatus = function (e, st, stacks, src, o = {}) {
  if (e.dead) return;
  const def = H.STATUS[st]; if (!def) return;
  // reaction check
  if (!o.noReact && e.reactCd <= 0) {
    const present = Object.keys(e.statuses).filter(k => k !== st);
    if (e.frozenT > 0 && st !== 'chill') present.push('chill');
    for (const other of present) { const r = H.reactionFor(st, other); if (r) { G.react(r, e, st, other, src); return; } }
  }
  const s = e.statuses[st] || (e.statuses[st] = { n: 0, t: 0, tick: 0.5 });
  s.n = Math.min(def.max, s.n + stacks);
  s.t = def.dur + (st === 'burn' && src && src.charms && src.charms.has('kindling') ? 1 : 0);
  s.src = src; s.spell = o.spell;
  if (st === 'chill') {
    const freezeAt = src && src.charms && src.charms.has('hoarfrost') ? 2 : 3;
    if (e.boss) s.n = Math.min(s.n, 2);
    else if (s.n >= freezeAt) { delete e.statuses.chill; e.frozenT = e.elite ? 1.0 : 1.6; G.cancelTelegraphs(e); if (e.ai.state === 'windup') { e.ai.state = 'recover'; e.ai.t = 0.2; e.ai.atk = null; e.windupK = 0; } H.audio.play('freeze'); G.float(e.x, 2.4, e.z, 'FROZEN', 'small el-frost'); }
  }
  if (st === 'gust' && e.type === 'shieldbearer') e.shieldDown = 1.6;
  if (def.cap) G.capLife(e);
  if (st === 'hex' && !o.extra) { const x = G.HEX_EXTRAS[Math.floor(Math.random() * G.HEX_EXTRAS.length)]; G.applyStatus(e, x, 1, src, { noReact: true, extra: true, spell: o.spell }); }
};
G.HEX_EXTRAS = ['burn', 'poison', 'bleed', 'shock', 'sunder', 'daze'];
/* Thrust: travel distance for a charge level; range upgrades lengthen it. The arrow = this + the blade's tip reach. */
G.thrustDist = (def, st, ck) => def.lunge.min + (def.lunge.max + Math.max(0, st.range - def.range) - def.lunge.min) * ck;
G.lungeStrike = function (p, final) {
  const L = p.lungeHit; if (!L) return; const { def, st, ax, az } = L, w = def.width, reach = final ? def.lunge.tip : 1.0;
  for (const e of G.enemies) {
    if (e.dead || e.spawnK < 1 || L.set.has(e)) continue; const dx = e.x - p.x, dz = e.z - p.z;
    const along = dx * ax + dz * az, perp = Math.abs(dx * az - dz * ax);
    if (along < -0.6 || along > reach + e.r || perp > w + e.r) continue;
    L.set.add(e); L.hits++;
    G.damage(e, st.dmg, hitOpts(p, def, st, { kx: ax, kz: az, knock: 2, phys: true, pierce: true, cone: true }));
    H.R.burst(e.x, 1.0, e.z, 0xc0182c, 12, 4, 0.3, 0.3, { dir: [ax, az] }); H.audio.play('sword_hit'); G.hitstop = Math.max(G.hitstop, 0.03);
  }
  if (final) { for (let i = 1; i <= 4; i++) H.R.emit(p.x + ax * def.lunge.tip * i / 4, 1.0, p.z + az * def.lunge.tip * i / 4, ax * 4, 0.2, az * 4, 0.18, 0.22, 0, 0xe8ecf2, 1, 0, 1); if (L.hits) H.R.kickCam(ax, az, 0.12); p.lungeHit = null; }
};
/* Max-life reducing effects (Cursed, Flayed): life can't sit above the reduced cap. Wardens feel a third of it. */
G.lifeCap = function (u) {
  let c = 0; for (const k in u.statuses) { const d = H.STATUS[k]; if (d && d.cap) c += d.cap; }
  if (u.boss) c /= 3;
  return Math.max(0.2, 1 - c);
};
G.capLife = function (u) { const cap = u.maxHp * G.lifeCap(u); if (u.hp > cap) u.hp = Math.max(1, Math.round(cap)); };
/* Speed multiplier from slowing effects (Broken, Dazed). Wardens shrug off half. */
G.statusSlow = function (u) {
  let m = 1; for (const k in u.statuses) { const d = H.STATUS[k]; if (d && d.slow) m *= 1 - d.slow * (u.boss ? 0.5 : 1); }
  return m;
};
/* ---- Effects on players ---- */
G.afflict = function (p, st, stacks = 1, by, o = {}) {
  const def = H.STATUS[st]; if (!def || p.dead || p.downed || G.god) return;
  if (def.instant) { if (st === 'heal') G.healPct(p, o.pct || 0.2); return; }
  const fresh = !p.statuses[st];
  const s = p.statuses[st] || (p.statuses[st] = { n: 0, t: 0, tick: 0.5 });
  s.n = Math.min(def.max, s.n + stacks); s.t = Math.max(s.t, o.dur || def.dur); s.by = by || s.by;
  if (fresh && !def.buff) G.float(p.x, 2.9, p.z, def.name.toUpperCase(), 'small hurt');
  if (def.cap) G.capLife(p);
  if (st === 'hex' && !o.extra) { const x = G.HEX_EXTRAS[Math.floor(Math.random() * G.HEX_EXTRAS.length)]; G.afflict(p, x, 1, by, { extra: true }); }
};
G.healPct = function (p, pct, label) {
  if (p.dead) return 0;
  const cap = p.maxHp * G.lifeCap(p); const before = p.hp;
  p.hp = Math.min(cap, p.hp + Math.round(p.maxHp * pct));
  const n = Math.round(p.hp - before);
  if (n > 0) { G.float(p.x, 2.6, p.z, '+' + n, 'big good'); H.R.burst(p.x, 1, p.z, 0xffd27a, 18, 4, 0.6, 0.4, { up: 3 }); }
  return n;
};
G.healFlat = function (p, n) { if (p.dead) return; p.hp = Math.min(p.maxHp * G.lifeCap(p), p.hp + n); };
G.tickPlayerStatuses = function (p, dt) {
  p.stSlow = G.statusSlow(p);
  for (const k in p.statuses) {
    const s = p.statuses[k]; const def = H.STATUS[k]; if (!def) { delete p.statuses[k]; continue; }
    s.t -= dt;
    if (def.pdot) { s.tick -= dt; if (s.tick <= 0) { s.tick = 0.5; G.hurtPlayer(p, Math.max(1, Math.round(def.pdot * s.n * (G.run ? 0.85 + 0.15 * G.run.depth : 1))), s.by || H.STATUS[k].name, { dot: true }); if (p.dead || p.downed) return; } }
    if (k === 'regen' && p.hp < p.maxHp * G.lifeCap(p)) G.healFlat(p, p.maxHp * 0.03 * s.n * dt);
    if (Math.random() < dt * (def.pdot ? 6 : 3)) H.R.emit(p.x + (Math.random() - .5) * 0.8, 0.6 + Math.random() * 1.2, p.z + (Math.random() - .5) * 0.8, 0, k === 'regen' ? 1.5 : k === 'burn' ? 2 : 0.6, 0, 0.5, 0.3, 0.04, H.statusColor(k), 0.9, k === 'burn' || k === 'regen' ? -1 : 0.5, 1);
    if (s.t <= 0) delete p.statuses[k];
  }
  if (p.hp > p.maxHp * G.lifeCap(p)) G.capLife(p);
};
G.react = function (r, e, s1, s2, src) {
  const run = G.run; const R = H.REACTIONS[r];
  e.reactCd = 0.25;
  run.reactions++; run.reactionsBy[r] = (run.reactionsBy[r] || 0) + 1; run.score += 15;
  const mul = (1 + 0.15 * (run.depth - 1) + (run.mode === 'arena' ? run.wave * 0.04 : 0)) * (src && src.charms && src.charms.has('catalyst') ? 1.45 : 1);
  const base = { src, reaction: true, spell: 'reaction:' + r, noReact: true };
  G.float(e.x, 3 + (e.boss ? 3 : 0), e.z, R.name.toUpperCase(), 'big react');
  H.audio.play('reaction', { base: { steam: 392, conduct: 523, blight: 349, paralysis: 440, overload: 330, shatter: 587, tempest: 466, collapse: 262 }[r] });
  H.R.flash(e.x, e.z, R.color, 4, 0.25); H.R.shake(0.22); G.hitstop = Math.max(G.hitstop, 0.045);
  if (src && src.charms && src.charms.has('blood_ward')) { src.hp = Math.min(src.maxHp, src.hp + 3); }
  const consume = (...ks) => { for (const k of ks) { delete e.statuses[k]; if (k === 'chill') e.frozenT = 0; } };
  const blast = (rad, dmg, extra, col) => { H.R.ring(e.x, e.z, col || R.color, 0.3, rad, 0.4, 0.1, 1, 0.22); H.R.burst(e.x, 1, e.z, col || R.color, 40, rad * 3, 0.5, 0.55); for (const t of G.enemiesNear(e.x, e.z, rad)) G.damage(t, Math.round(dmg * mul), Object.assign({}, base, extra || {}, { kx: t.x - e.x, kz: t.z - e.z })); };
  switch (r) {
    case 'steam': consume('burn', 'chill'); blast(3.2, 26, null, 0xfff0d8); for (let i = 0; i < 30; i++) H.R.emit(e.x + (Math.random() - .5) * 3, 0.5, e.z + (Math.random() - .5) * 3, 0, 2 + Math.random() * 2, 0, 1.2, 1.2, 0.3, 0xe8e0d8, 0.35, -0.5, 1); break;
    case 'conduct': { consume('chill', 'shock'); G.damage(e, Math.round(16 * mul), Object.assign({}, base, { stun: 1.2 })); const ns = G.enemiesNear(e.x, e.z, 7, e).slice(0, 3); for (const n of ns) { H.R.bolt(e.x, 1.2, e.z, n.x, 1.2, n.z, 0xbff6ff, 1.4); G.damage(n, Math.round(16 * mul), Object.assign({}, base, { stun: 1.2 })); } break; }
    case 'blight': consume('burn', 'poison'); blast(3, 20, null, 0xd8ff6a); for (const n of G.enemiesNear(e.x, e.z, 4, e)) G.applyStatus(n, 'poison', 3, src, { noReact: true }); break;
    case 'paralysis': consume('poison', 'shock'); G.damage(e, Math.round(12 * mul), Object.assign({}, base, { stun: 2 })); if (e.boss) e.stagger += 50; H.R.burst(e.x, 1.5, e.z, 0xe6ff7a, 30, 4, 0.6, 0.4); break;
    case 'overload': consume('burn', 'shock'); blast(3.4, 22, { knock: 14 }, 0xffc860); H.R.shake(0.2); break;
    case 'shatter': { const frozen = e.frozenT > 0; consume('chill', 'sunder'); e.frozenT = 0; G.damage(e, Math.round(45 * mul * (frozen ? 1.5 : 1)), base); H.audio.play('shatter'); H.R.burst(e.x, 1, e.z, 0xe8f8ff, 40, 10, 0.6, 0.4, { grav: 12 }); break; }
    case 'tempest': { const other = s1 === 'gust' ? s2 : s1; const n = G.enemiesNear(e.x, e.z, 4.5, e); H.R.ring(e.x, e.z, 0xe0fff6, 0.3, 4.5, 0.4); for (const t of n) { G.applyStatus(t, other, 1, src, { noReact: true }); H.R.bolt(e.x, 0.8, e.z, t.x, 0.8, t.z, H.EL[H.STATUS[other].el].color, 0.6); } G.damage(e, Math.round(8 * mul), base); delete e.statuses.gust; break; }
    case 'collapse': {
      const ks = Object.keys(e.statuses); const n = ks.length + 1; for (const k of ks) delete e.statuses[k]; e.frozenT = 0;
      for (const t of G.enemiesNear(e.x, e.z, 5.5, e)) { if (t.boss) continue; const [nx, nz] = H.norm(e.x - t.x, e.z - t.z); t.kvx += nx * 14 / Math.max(0.6, t.mass); t.kvz += nz * 14 / Math.max(0.6, t.mass); }
      H.R.ring(e.x, e.z, 0xd7a6ff, 5.5, 0.3, 0.45, 0.1, 1, 0.3);
      G.after(() => { if (!G.active) return; blast(2.8, 10 + 6 * n, null, 0xb36bff); }, 220); break;
    }
  }
  G.emit('reaction', { r, e });
  if (G.tut) G.tutEvent('reaction', { r });
};
G.tickStatuses = function (e, dt) {
  const C = H.classOf(e);
  for (const k in e.statuses) {
    const s = e.statuses[k]; const def = H.STATUS[k]; s.t -= dt;
    if (def.dot) {
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick = 0.5;
        const kind = k === 'burn' && s.src && s.src.charms && s.src.charms.has('kindling') ? 1.6 : 1;
        const d = def.dot * s.n * kind * G.depthMul() * (C && C.dotMul ? C.dotMul : 1);
        G.damage(e, Math.max(1, Math.round(d)), { src: s.src, el: def.el, quiet: true, dot: true, spell: s.spell || ('status:' + k) });
        if (e.dead) return;
      }
      if (Math.random() < dt * 8) H.R.emit(e.x + (Math.random() - .5) * e.r * 2, 0.5 + Math.random() * 1.5, e.z + (Math.random() - .5) * e.r * 2, 0, k === 'burn' ? 2 : 0.6, 0, 0.5, 0.35, 0.05, H.statusColor(k), 0.9, k === 'burn' ? -1 : 0.5, 1);
    } else if (Math.random() < dt * 3) H.R.emit(e.x + (Math.random() - .5) * e.r * 2, 1 + Math.random(), e.z + (Math.random() - .5) * e.r * 2, 0, 0.5, 0, 0.5, 0.3, 0, H.statusColor(k), 0.8, 0, 1);
    if (s.t <= 0) delete e.statuses[k];
  }
  if (e.hp > e.maxHp * G.lifeCap(e)) G.capLife(e);
};
G.kill = function (e, o = {}) {
  if (e.dead) return;
  e.dead = true; e.removeT = o.plunge ? 0.6 : 0.05; e.hp = 0;
  e.removeT = Math.max(e.removeT, H.R.enemyDeathHold(e.model));
  G.cancelTelegraphs(e);
  const run = G.run; const def = e.def;
  if (e.type === 'dummy' || e.type === 'turret') return;
  run.kills++; run.killsBy[e.type] = (run.killsBy[e.type] || 0) + 1;
  run.combo++; run.comboT = 3; run.bestCombo = Math.max(run.bestCombo, run.combo);
  const comboMul = run.mode === 'arena' ? 1 + Math.min(run.combo, 20) * 0.1 : 1;
  run.score += Math.round(10 * (def.cost || 1) * run.depth * comboMul * (e.elite ? 5 : 1));
  if (e.elite) { run.elites++; }
  H.audio.play('kill');
  const col = def.boss ? 0xff2e55 : (e.elite ? 0xf0bd4f : 0xff4d6a);
  if (!o.plunge) {
    H.R.burst(e.x, 1, e.z, col, e.elite ? 50 : 22, 7, 0.6, 0.55, { palette: [col, 0x2a1a2a, 0xffd0d8] });
    H.R.burst(e.x, 0.6, e.z, 0x1a1020, 10, 4, 1, 0.8, { grav: 6 });
    H.R.decal(e.x, e.z, 0x4a1020, e.r * 1.8, 4);
  }
  if (e.statuses.burn && o.src && o.src.charms && o.src.charms.has('ember_bloom')) { H.R.ring(e.x, e.z, 0xff6a2b, 0.3, 2.5, 0.3); for (const n of G.enemiesNear(e.x, e.z, 2.5, e)) G.damage(n, 14, { src: o.src, el: 'ember', spell: 'ember_bloom' }); }
  H.R.enemyDeathVisual(e.model, !!o.plunge);
  if (o.plunge) { e.fallY = 0; e.fallAnim = true; }
  // elite affixes on death
  if (e.elite === 'volatile') { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; G.fireProj({ team: 1, x: e.x, z: e.z, dx: Math.cos(a), dz: Math.sin(a), speed: 7, range: 14, r: 0.35, dmg: Math.round(9 * e.dmgMul), size: 0.4, srcName: 'a Volatile burst' }); } H.audio.play('explode'); }
  if (e.elite === 'splitting' && !e.split) { for (let i = 0; i < 2; i++) { const c = G.spawnEnemy(e.type, e.x + (i ? 1 : -1), e.z, null, { split: true }); c.maxHp = c.hp = Math.round(e.maxHp * 0.25); c.spawnK = 1; c.ai.state = 'chase'; } }
  if (H.AI.onDeath) H.AI.onDeath(e);
  if (run.mode !== 'tutorial' && !e.noXp) G.gainXP(G.xpFor(e), e);
  // Undead: may rise once
  { const C = H.classOf(e); if (C && C.revive && !e.revived && !e.boss && !e.split && !o.plunge && run.mode !== 'tutorial' && Math.random() < C.revive) {
    const c = G.spawnEnemy(e.type, e.x, e.z, null, { revived: true, noXp: true }); c.maxHp = c.hp = Math.max(1, Math.round(e.maxHp * 0.5));
    G.float(e.x, 2.8, e.z, H.t('RISES AGAIN'), 'big hurt'); H.R.burst(e.x, 0.3, e.z, 0xcfc4ae, 20, 4, 0.6, 0.5, { up: 3 }); } }
  if (e.boss) G.bossDefeated(e);
  G.emit('kill', { e });
};
G.hurtPlayer = function (p, dmg, srcName, o = {}) {
  if (p.dead || p.downed || G.god) return;
  if (p.dashT > 0 && p.dashImmune) return;
  if (!o.dot && (p.invuln > 0 || p.iframes > 0)) return;
  if (!G.tut) dmg *= o.dot ? H.ENEMY_DOT_MUL : H.ENEMY_DMG_MUL;
  if (p.gear && p.gear.armor) dmg *= 1 - Math.min(0.5, p.gear.armor);
  if (p.statuses.shock) dmg *= 1 + H.STATUS.shock.vuln;
  dmg = Math.round(dmg);
  if (p.bastionT > 0) { dmg = Math.round(dmg * 0.35); if (o.by && !o.by.dead && o.by.kind === 'enemy') G.applyStatus(o.by, 'sunder', 1, p, { spell: 'bastion' }); }
  if (p.ward && dmg > 0) { const a = Math.min(p.ward.hp, dmg); p.ward.hp -= a; dmg -= a; G.float(p.x, 2.2, p.z, 'ABSORB', 'small el-frost'); if (p.ward.hp <= 0) G.breakWard(p); if (dmg <= 0) { p.invuln = 0.3; return; } }
  if (p.charms.has('cold_blood') && !o.dot) for (const e of G.enemiesNear(p.x, p.z, 3.5)) G.applyStatus(e, 'chill', 1, p, { spell: 'cold_blood' });
  p.hp -= dmg; G.run.hitsTaken++; G.gainDivine(p, dmg * H.DIVINE.taken);
  if (o.by && o.by.elite === 'vampiric') o.by.hp = Math.min(o.by.maxHp, o.by.hp + dmg * 2);
  if (o.burn) G.afflict(p, 'burn', 1, srcName);
  if (o.inflict) G.afflict(p, o.inflict, o.stacks || 1, srcName, { dur: o.inflictDur });
  if (!o.dot && o.by && o.by.def && p.hp > 0) G.foeEffects(p, o.by, srcName);
  G.float(p.x, 2.4, p.z, '-' + dmg, 'hurt');
  if (!o.dot) {
    p.invuln = 0.55; p.invulnBlink = 0.55; p.hurtT = 0.2;
    if (o.kx != null && p.bastionT <= 0) { const [kx, kz] = H.norm(o.kx, o.kz); p.kvx = (p.kvx || 0) + kx * (o.knock || 4) * 2; p.kvz = (p.kvz || 0) + kz * (o.knock || 4) * 2; }
    H.audio.play('hurt'); H.R.shake(0.35 + Math.min(0.4, dmg / 60)); H.R.burst(p.x, 1, p.z, 0xff2e55, 14, 5, 0.4, 0.4);
    G.hitstop = Math.max(G.hitstop, 0.06);
    G.emit('hurt', { p, dmg });
    if (p.intent && p.intent.padRef) H.input.rumble(p.intent.padRef, 0.6, 0.4, 160);
  }
  p.lastHit = { name: srcName, depth: G.run.depth, layer: G.room.layer };
  if (p.hp <= 0) {
    if (p.charms.has('second_wind') && !p.secondWind) { p.secondWind = true; p.hp = 1; p.invuln = 1.5; G.float(p.x, 2.8, p.z, 'SECOND WIND', 'big good'); H.audio.play('heal'); return; }
    if (p.boon === 'regent_ash' && !p.ashUsed) { p.ashUsed = true; p.hp = Math.round(p.maxHp * 0.5); p.invuln = 2; G.float(p.x, 2.8, p.z, "REGENT'S ASH", 'big good'); H.R.burst(p.x, 1, p.z, 0xffd27a, 60, 8, 0.8, 0.6); H.audio.play('heal'); return; }
    p.hp = 0;
    if (G.players.filter(q => !q.dead && !q.downed && q !== p).length > 0) { p.downed = true; p.bleedT = 14; p.reviveK = 0; G.float(p.x, 2.8, p.z, 'DOWNED', 'big hurt'); G.emit('downed', { p }); }
    else G.killPlayer(p);
  }
};
/* What a foe's hit leaves on you, from its own kit and its class. */
G.foeEffects = function (p, e, srcName) {
  if (G.tut) return;
  const d = e.def, C = H.classOf(e);
  if (d.inflict && Math.random() < (d.inflictP || 1)) G.afflict(p, d.inflict, d.inflictN || 1, srcName);
  if (C && C.inflict && d.el && H.EL[d.el]) G.afflict(p, H.EL[d.el].status, 1, srcName);
  if (C && C.daze && Math.random() < 0.6) G.afflict(p, 'daze', 1, srcName, { dur: 1.4 });
  if (C && C.curse && Math.random() < 0.35) G.afflict(p, 'hex', 1, srcName);
};
G.killPlayer = function (p) {
  p.dead = true; p.downed = false; p.hp = 0;
  H.R.burst(p.x, 1, p.z, p.color, 60, 8, 1, 0.6); H.R.burst(p.x, 1, p.z, 0xff2e55, 30, 5, 1, 0.5);
  if (G.players.every(q => q.dead)) {
    const lh = p.lastHit || { name: 'the dark', depth: G.run.depth, layer: G.room ? G.room.layer : 0 };
    G.run.deathCause = lh;
    if (G.tut) { // tutorial: never end, just revive
      p.dead = false; p.hp = p.maxHp; G.float(p.x, 2.6, p.z, 'THE PRIMER FORGIVES', 'big good'); return;
    }
    G.setSlow(0.25, 1.8); H.audio.play('death'); H.audio.setTheme('silent'); H.R.shake(0.6);
    G.emit('playerDeath', { cause: lh });
    G.ending = 1.9;
  }
};

/* ---------------- Enemy update ---------------- */
/* Spirits: turn ethereal (immune, see-through) every so often. Wardens don't. */
G.tickEthereal = function (e, dt) {
  const C = H.classOf(e); if (!C || !C.ethereal || e.boss) return;
  if (e.ethCd == null) e.ethCd = H.rand(2.5, 5);
  if (e.etherealT > 0) { e.etherealT -= dt; if (e.etherealT <= 0) { e.etherealT = 0; H.R.setGhost(e.model, false); } return; }
  e.ethCd -= dt;
  if (e.ethCd <= 0 && e.ai && e.ai.state !== 'windup') { e.ethCd = H.rand(5.5, 7.5); e.etherealT = 1.6; H.R.setGhost(e.model, true); H.R.burst(e.x, 1.4, e.z, 0x8fd8e8, 14, 3, 0.5, 0.4); }
};
G.updateEnemy = function (e, dt) {
  if (e.spawnK < 1) { e.spawnK = Math.min(1, e.spawnK + dt * 4); return; }
  e.reactCd -= dt; e.lastHurtT += dt;
  if (e.shieldDown) { e.shieldDown -= dt; if (e.shieldDown <= 0) e.shieldDown = 0; }
  G.tickStatuses(e, dt); if (e.dead) return;
  G.tickEthereal(e, dt);
  if (e.elite === 'warded' && e.lastHurtT > 3 && e.hp < e.maxHp * G.lifeCap(e)) { e.hp = Math.min(e.maxHp * G.lifeCap(e), e.hp + e.maxHp * 0.06 * dt); (e.statuses.regen || (e.statuses.regen = { n: 1, t: 0, tick: 0.5 })).t = 0.4; if (Math.random() < dt * 6) H.R.emit(e.x, 1.5, e.z, 0, 1, 0, 0.6, 0.3, 0, 0x9de85d, 1, 0, 1); }
  // knockback integration
  e.x += e.kvx * dt; e.z += e.kvz * dt; const kd = Math.exp(-dt * 7); e.kvx *= kd; e.kvz *= kd;
  if (e.frozenT > 0) { e.frozenT -= dt; e.vx = e.vz = 0; }
  else if (e.stunT > 0) { e.stunT -= dt; e.vx *= 0.8; e.vz *= 0.8; if (e.stunT <= 0) e.brute_stunned = false; }
  else H.AI.update(e, dt);
  const slow = G.statusSlow(e) * (e.slowZ ? e.slowZ : 1);
  e.slowZ = 0; e.slowMul = slow;
  e.x += e.vx * dt * slow; e.z += e.vz * dt * slow;
  // separation
  for (const o of G.enemies) { if (o === e || o.dead || o.spawnK < 1) continue; const dx = e.x - o.x, dz = e.z - o.z, d2 = dx * dx + dz * dz, m = e.r + o.r; if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2), push = (m - d) * 0.5; const w = o.mass / (e.mass + o.mass); e.x += dx / d * push * w * 2; e.z += dz / d * push * w * 2; } }
  for (const p of G.players) { if (p.dead || p.dashT > 0) continue; const dx = e.x - p.x, dz = e.z - p.z, d2 = dx * dx + dz * dz, m = e.r + p.r * 0.8; if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2); e.x += dx / d * (m - d) * 0.7; e.z += dz / d * (m - d) * 0.7; p.x -= dx / d * (m - d) * 0.3; p.z -= dz / d * (m - d) * 0.3; } }
  G.collide(e);
};

/* ---------------- Room flow ---------------- */
G.updateRoom = function (dt) {
  const room = G.room; const run = G.run;
  if (G.ending != null) { G.ending -= dt / Math.max(0.2, G.timeScale()); if (G.ending <= 0) { G.ending = null; G.endRun(false); } return; }
  if (run.mode === 'arena') { G.updateArena(dt); }
  else if (!room.cleared && room.waves.length) {
    room.waveT += dt;
    const alive = G.enemies.filter(e => !e.dead && !e.boss).length;
    if (room.waveIdx < 0 && room.t > 0.6) G.nextWave();
    else if (room.waveIdx >= 0 && room.waveIdx < room.waves.length - 1 && G.pendingSpawns() === 0 && (alive <= 1 || room.waveT > 22)) G.nextWave();
    else if (room.waveIdx >= room.waves.length - 1 && alive === 0 && G.pendingSpawns() === 0) G.clearRoom();
    if (room.challenge && room.challenge.active) G.updateChallenge(dt);
  } else if (room.isBoss && !room.cleared) { /* boss handles itself */ }
  // doors
  if (!G.tut && (room.cleared || !room.waves.length || (room.prop && !room.challengeActive))) {
    for (const d of room.doors) {
      if (!d.open) continue;
      for (const p of G.players) {
        if (p.dead) continue;
        if (Math.abs(p.x - d.x) < 1.4 && p.z < d.z + 1.6) { G.takeDoor(d); return; }
      }
    }
  }
  // descent portal
  if (room.prop && room.prop.kind === 'descent' && room.prop.ready) {
    for (const p of G.players) if (!p.dead && H.dist2(p.x, p.z, room.prop.x, room.prop.z) < 2.2 * 2.2) { G.descend(); return; }
  }
};
G.clearRoom = function () {
  const room = G.room; if (room.cleared) return; room.cleared = true;
  const run = G.run; run.rooms++; run.score += 100;
  { const em = { combat: 3, elite: 8, challenge: 8 }[room.type] || 0; if (em && run.mode !== 'arena' && run.mode !== 'tutorial') G.gainEmbers(em); }
  G.setSlow(0.3, 0.5);
  H.audio.play('clear'); H.audio.setTheme('explore');
  G.emit('roomClear', { type: room.type });
  // purge leftover hostile bolts
  for (const pr of G.projs) if (pr.team === 1) pr.dead = true;
  for (const t of G.tgs) if (t.owner) t.done = true;
  const reward = room.challenge ? 'challenge' : room.type; room.challengeActive = false;
  if (reward === 'combat') { G.gainXP(12 + 8 * run.depth, null); G.after(() => { if (!G.active || G.room !== room) return; G.openDoors(); }, 700); return; }
  G.after(() => { if (!G.active || G.room !== room) return; G.giveRoomReward(reward, () => G.openDoors()); }, 900);
};
/* ---------------- Experience & levels ---------------- */
G.xpNeed = L => Math.round(22 + 14 * (L - 1) + 1.5 * (L - 1) * (L - 1));
G.xpFor = e => {
  if (e.boss) return 60 + 50 * (G.run ? G.run.depth : 1);
  const base = { husk: 6, spitter: 7, wisp: 4, hexcaster: 10, shieldbearer: 12, brute: 17, summoner: 14, regent_echo: 10 }[e.type] || Math.round((e.def.cost || 1) * 6);
  return Math.max(1, Math.round(base * G.ENEMY_XP_MUL * (e.elite ? 4 : 1) * (e.split ? 0.4 : 1)));
};
/* XP per enemy killed (×base above). Was 1.5; lowered 30% so levelling takes longer. Bosses and room-clear XP unchanged. */
G.ENEMY_XP_MUL = 1.05;
/* Life of common foes and elites: ×3 (+200%), in the descent and the arena. Bosses and the tutorial are unchanged. */
G.ENEMY_HP_MUL = 3;
G.gainXP = function (n, src) {
  const run = G.run; if (!run || run.mode === 'tutorial' || !n) return;
  run.xp += n; run.xpTotal += n;
  if (src && G.players[0]) { const p = G.nearestPlayer(src.x, src.z) || G.players[0]; const k = Math.min(10, 2 + Math.round(n / 4)); for (let i = 0; i < k; i++) { const dx = p.x - src.x, dz = p.z - src.z; const t = 0.45 + Math.random() * 0.25; H.R.emit(src.x + (Math.random() - .5), 1 + Math.random(), src.z + (Math.random() - .5), dx / t, 2 + Math.random() * 2, dz / t, t, 0.32, 0.12, 0xffd27a, 1, 4, 0); } }
  while (run.xp >= run.xpNext) {
    run.xp -= run.xpNext; run.level++; run.xpNext = G.xpNeed(run.level); run.pendingLevels++;
    for (const p of G.players) { if (p.dead) continue; G.healPct(p, 0.12); H.R.ring(p.x, p.z, 0xffd27a, 0.4, 3.2, 0.6, 0.1, 1, 0.2); H.R.burst(p.x, 1, p.z, 0xffd27a, 40, 6, 0.8, 0.45, { up: 4 }); if (H.botMode) G.float(p.x, 3, p.z, H.t('LEVEL {n}', { n: run.level }), 'big gold'); }
    H.audio.play('reward'); G.emit('levelUp', { level: run.level });
  }
};
G.checkLevelUp = function () {
  const run = G.run; if (!run || run.pendingLevels <= 0 || G.modal || G.transitioning || G.ending != null || !G.active) return;
  if (G.players.every(p => p.dead)) return;
  run.pendingLevels--;
  const lv = run.level - run.pendingLevels;
  const choose = () => { G.modal = null; G.offerChoice({ title: H.t('Level {n}!', { n: lv }), sub: H.t('Choose a new spell, an upgrade for your primary attack, or a charm.'), kind: 'level', count: 3 }, () => { }); };
  if (H.botMode || !H.UI.showLevelUp) { choose(); return; }
  G.modal = 'levelup';
  H.UI.showLevelUp(lv, choose);
};
G.takeDoor = function (d) {
  if (G.transitioning) return; G.transitioning = true;
  H.audio.play('door');
  G.emit('transition', { to: d.node.type });
  G.after(() => { G.transitioning = false; if (!G.active) return; G.enterNode(d.node); }, 380);
};
G.descend = function () {
  if (G.transitioning) return;
  const run = G.run;
  if (run.depth >= 3) { G.victory(); return; }
  G.transitioning = true; G.emit('transition', { to: 'descent' });
  G.after(() => {
    G.transitioning = false; if (!G.active) return;
    run.depth++; run.curse = 0;
    if (run.depth === 2) G.milestone('depth2');
    for (const p of G.players) if (!p.dead) { G.healPct(p, 0.35); }
    run.map = G.genMap(run.depth); G.enterNode(run.map.layers[0][0]);
    G.emit('depth', { depth: run.depth });
  }, 600);
};

/* ---------------- Interaction (props) ---------------- */
G.checkInteract = function (p, it) {
  const room = G.room; const prop = room && room.prop;
  p.nearProp = null;
  if (!prop || prop.used || prop.kind === 'descent') return;
  if (H.dist2(p.x, p.z, prop.x, prop.z) < 3.2 * 3.2) {
    p.nearProp = prop;
    const tap = p.src === 'touch' ? (it.pressed.interact || it.released.interact) : it.pressed.interact;
    if (tap || (p.src === 'bot')) G.useProp(p, prop);
  }
};
G.useProp = function (p, prop) {
  if (G.modal) return;
  const k = prop.kind;
  if (k === 'hearth') { G.offerRest(() => { prop.used = true; }); }
  else if (k === 'shrine') { G.offerChoice({ title: 'Forge Shrine', sub: 'Temper one spell. Each rank adds 24% damage and trims its cooldown.', kind: 'rank', count: 3 }, () => { prop.used = true; }); }
  else if (k === 'chest') { prop.used = true; if (prop.lid) prop.lid.rotation.x = -1.2; H.audio.play('reward'); G.dropItems(1, 1); const em = 6 + G.run.depth * 3; G.run.embers += em; G.float(prop.x, 2.4, prop.z, H.t('+{n} GOLD', { n: em }), 'big gold'); G.offerChoice({ title: 'Reliquary', sub: 'Claim one relic.', kind: 'treasure', count: 3 }, () => { }); }
  else if (k === 'eye') { G.mysteryEvent(() => { prop.used = true; }); }
  else if (k === 'merchant') { G.openShop(p, prop); }
  else if (k === 'altar') { G.offerChallenge(prop); }
};

/* ---------------- Rewards ---------------- */
G.randomNewSpell = function (owner, rng, exclude = []) {
  const have = new Set(owner.spells.filter(Boolean).map(s => s.id));
  const kit = G.kitFor(owner);
  const pool = (kit ? kit.spells : G.availableSpells()).filter(id => !have.has(id) && !exclude.includes(id));
  return pool.length ? rng.pick(pool) : null;
};
G.randomCharm = function (owner, rng, exclude = []) {
  const pool = Object.keys(H.CHARMS).filter(id => G.charmUnlocked(id) && !owner.charms.has(id) && !exclude.includes(id));
  return pool.length ? rng.pick(pool) : null;
};
/* The Veteran's rewards: no spell/primary mods or spell charms. Upgrade an equipped attack (damage, reach or
   cooldown) or raise an attribute (stamina, toughness, speed, rhythm). */
G.makeVeteranOffers = function (owner, kind, count) {
  const rng = G.run.rng; const offers = []; const used = new Set();
  count += owner.boon === 'scholar' ? 1 : 0;
  const push = o => { const key = o.type + ':' + o.id + ':' + (o.stat || ''); if (used.has(key) || offers.length >= count) return false; used.add(key); offers.push(o); return true; };
  const atks = owner.spells.concat([owner.ult]).filter(s => s && H.SPELLS[s.id].hero && H.SPELLS[s.id].ups).map(s => s.id);
  const branches = id => { const d = H.SPELLS[id]; if (!d || !d.ups) return []; const u = owner.ups[id] || {}; return Object.keys(d.ups).filter(k => (u[k] || 0) < H.BRANCH_MAX).map(k => ({ type: 'branch', id, stat: k })); };
  const upg = atks.filter(id => branches(id).length);
  const attrs = Object.keys(H.ATTRS).filter(k => !(H.ATTRS[k].stam && !owner.useStam) && ((owner.attrs || {})[k] || 0) < H.ATTRS[k].max);
  // the Aid blessing (Ultimate on R + Divine Bar) is offered until the hero takes it
  if (!owner.ult && H.SPELLS.aid_call && kind !== 'rank') push({ type: 'ult', id: 'aid_call' });
  // usually: two upgrades for one attack (A or B), plus one attribute
  if (upg.length) { const id = rng.pick(upg); rng.shuffle(branches(id)).slice(0, kind === 'elite' ? 1 : 2).forEach(push); }
  if (attrs.length) push({ type: 'attr', id: rng.pick(attrs) });
  let guard = 0;
  while (offers.length < count && guard++ < 60) {
    if (rng() < 0.5 && upg.length) { const id = rng.pick(upg); push(rng.pick(branches(id))); }
    else if (attrs.length) push({ type: 'attr', id: rng.pick(attrs) });
  }
  while (offers.length < count) offers.push({ type: 'heal', amt: 30 });
  return offers;
};
G.makeKitOffers = function (owner, kind, count, kit) {
  if (owner.charId === 'knight' && kind !== 'treasure') return G.makeVeteranOffers(owner, kind, count);
  const rng = G.run.rng; const offers = []; const used = new Set();
  count += owner.boon === 'scholar' ? 1 : 0;
  const empties = [1, 2, 3].filter(i => !owner.spells[i]).length;
  const have = new Set(owner.spells.filter(Boolean).map(s => s.id));
  const newSpells = kit.spells.filter(id => !have.has(id));
  const newPass = kit.passives.filter(id => !owner.passives[id]);
  // weapon / fist attacks (hero spells with upgrade branches) level up like kit abilities
  const heroAtk = owner.spells.filter(s => s && H.SPELLS[s.id].hero && H.SPELLS[s.id].ups).map(s => s.id);
  const ownedItems = kit.spells.filter(id => have.has(id)).concat(heroAtk).concat(kit.passives.filter(id => owner.passives[id])).concat(owner.ult ? [owner.ult.id] : []);
  const branchesOf = id => { const d = H.SPELLS[id] || H.PASSIVES[id]; if (!d || !d.ups) return []; const u = owner.ups[id] || {}; return Object.keys(d.ups).filter(k => (u[k] || 0) < H.BRANCH_MAX).map(k => ({ type: 'branch', id, stat: k })); };
  const upgradable = ownedItems.filter(id => branchesOf(id).length);
  const primKind = owner.spells[0] ? H.SPELLS[owner.spells[0].id].kind : 'projectile';
  const mods = Object.keys(H.MODS).filter(k => H.MODS[k].kinds.includes(primKind) && (owner.mods[k] || 0) < H.MODS[k].max);
  const charms = kit.charms.filter(id => H.CHARMS[id] && G.charmUnlocked(id) && !owner.charms.has(id));
  const push = o => { const key = o.type + ':' + o.id + ':' + (o.stat || ''); if (used.has(key) || offers.length >= count) return false; used.add(key); offers.push(o); return true; };
  if (kit.ult && !owner.ult && kind !== 'rank' && (G.run.level >= H.ULT_LEVEL || kind === 'warden')) push({ type: 'ult', id: kit.ult });
  // the "A || B" choice for one ability already owned
  if (upgradable.length && !offers.length && kind !== 'elite' && (kind === 'rank' || !(empties && newSpells.length) || rng() < 0.4)) { const id = rng.pick(upgradable); rng.shuffle(branchesOf(id)).slice(0, 2).forEach(push); }
  if (empties && newSpells.length && kind !== 'rank') push({ type: 'spell', id: rng.pick(newSpells), rank: 1 });
  const pools = kind === 'elite' || kind === 'warden' ? ['charm', 'passive', 'branch', 'mod', 'spell'] : kind === 'rank' ? ['branch', 'branch', 'mod'] : ['passive', 'mod', 'spell', 'branch', 'charm'];
  let guard = 0;
  while (offers.length < count && guard++ < 60) {
    const t = rng.pick(pools);
    if (t === 'spell' && newSpells.length && empties) push({ type: 'spell', id: rng.pick(newSpells), rank: 1 });
    else if (t === 'passive' && newPass.length) push({ type: 'passive', id: rng.pick(newPass) });
    else if (t === 'mod' && mods.length) push({ type: 'mod', id: rng.pick(mods) });
    else if (t === 'charm' && charms.length) push({ type: 'charm', id: rng.pick(charms) });
    else if (t === 'branch' && upgradable.length) { const id = rng.pick(upgradable); push(rng.pick(branchesOf(id))); }
  }
  while (offers.length < count) offers.push({ type: 'heal', amt: 30 });
  return offers;
};
G.makeOffers = function (owner, kind, count) {
  const kitO = G.kitFor(owner); if (kitO) return G.makeKitOffers(owner, kind, count, kitO);
  const rng = G.run.rng; const offers = []; const used = [];
  const scholar = owner.boon === 'scholar' ? 1 : 0;
  count += scholar;
  const addSpell = () => { const id = G.randomNewSpell(owner, rng, used); if (id) { used.push(id); offers.push({ type: 'spell', id, rank: Math.max(1, Math.min(3, G.run.depth - (rng() < 0.5 ? 1 : 0))) }); return true; } return false; };
  const primKind = owner.spells[0] ? H.SPELLS[owner.spells[0].id].kind : 'projectile';
  const addMod = () => { const pool = Object.keys(H.MODS).filter(k => H.MODS[k].kinds.includes(primKind) && (owner.mods[k] || 0) < H.MODS[k].max && !used.includes('m' + k)); if (!pool.length) return false; const k = rng.pick(pool); used.push('m' + k); offers.push({ type: 'mod', id: k }); return true; };
  const empty = owner.spells.some(s => !s);
  const addRank = () => { const cand = owner.spells.filter(s => s && s.rank < H.MAX_RANK && !used.includes('r' + s.id)); if (!cand.length) return false; const s = rng.pick(cand); used.push('r' + s.id); offers.push({ type: 'rank', id: s.id }); return true; };
  const addCharm = () => { const id = G.randomCharm(owner, rng, used); if (id) { used.push(id); offers.push({ type: 'charm', id }); return true; } return false; };
  const empties = owner.spells.filter(s => !s).length;
  const plan = { level: empties >= 2 ? ['spell', 'spell', 'mod'] : empty ? ['spell', 'mod', 'charm'] : ['mod', 'charm', 'rank'], combat: empties >= 2 ? ['spell', 'mod', 'spell'] : empty ? ['spell', 'mod', 'mix'] : ['mod', 'rank', 'mix'], elite: ['charm', 'mod', 'charm'], treasure: ['spell', 'mod', 'charm'], rank: ['rank', 'mod', 'rank'], challenge: ['charm', 'spell', 'mod'], warden: ['charm', 'mod', 'spell'], arena: empty ? ['spell', 'mod', 'charm'] : ['mod', 'rank', 'charm'] }[kind] || ['spell', 'mod', 'mix'];
  for (let i = 0; i < count; i++) {
    let t = plan[i % plan.length]; if (t === 'mix') t = rng.pick(empty ? ['spell', 'mod', 'charm'] : ['spell', 'mod', 'charm', 'heal']);
    let ok = t === 'spell' ? addSpell() : t === 'rank' ? addRank() : t === 'charm' ? addCharm() : t === 'mod' ? addMod() : (offers.push({ type: 'heal', amt: 30 }), true);
    if (!ok) ok = addMod() || addRank() || addSpell() || addCharm();
    if (!ok) offers.push({ type: 'heal', amt: 30 });
  }
  if (kind === 'warden' || kind === 'challenge') offers.forEach(o => { if (o.type === 'spell') o.rank = Math.min(4, (o.rank || 1) + 1); });
  return offers;
};
/* ---------------- Embers (shared purse: banked + earned this run) ---------------- */
G.wallet = () => (H.save.meta.embers || 0) + ((G.run && G.run.embers) || 0);
G.gainEmbers = function (n) { if (!G.run) return; G.run.embers += n; const p = G.players.find(q => !q.dead) || G.players[0]; if (p) G.float(p.x, 3.3, p.z, H.t('+{n} GOLD', { n }), 'gold'); };
G.spendEmbers = function (n) { if (G.wallet() < n) return false; const fromRun = Math.min(n, G.run.embers); G.run.embers -= fromRun; H.save.meta.embers -= n - fromRun; H.saveNow(); return true; };
/* ---------------- Merchant ---------------- */
G.SHOP_BASE = { common: 12, uncommon: 26, rare: 48 };
G.shopPrice = rarity => Math.round(G.SHOP_BASE[rarity] * (1 + 0.3 * ((G.run.depth || 1) - 1)) * (1 + 0.2 * (G.run.shopBuys || 0)));
G.rollItemOfRarity = function (p, rarity, rng, exclude = []) {
  const owned = new Set(Object.values(p.equip).concat(p.bag).filter(Boolean).concat(exclude));
  const all = Object.keys(H.ITEMS).filter(id => H.ITEMS[id].rarity === rarity && G.canUse(p, id)); const fresh = all.filter(id => !owned.has(id));
  const pool = fresh.length ? fresh : all; return pool[Math.floor((rng || Math.random)() * pool.length)];
};
G.openShop = function (p, prop) {
  if (!prop.stock) { const ex = []; prop.stock = ['common', 'uncommon', 'rare'].map(r => { const id = G.rollItemOfRarity(p, r, G.run.rng, ex); ex.push(id); return { id, rarity: r, sold: false }; }); }
  G.modal = 'shop'; H.audio.play('ui_ok');
  H.UI.showShop(p, prop, () => { G.modal = null; if (H.botMode || prop.stock.every(s => s.sold)) prop.used = true; });
};
G.buyItem = function (p, prop, i) {
  const s = prop.stock[i]; if (!s || s.sold) return 'sold';
  if (!p.bag.some(x => !x)) return 'full';
  const price = G.shopPrice(s.rarity); if (!G.spendEmbers(price)) return 'poor';
  s.sold = true; G.run.shopBuys = (G.run.shopBuys || 0) + 1; G.giveItem(p, s.id); H.audio.play('reward');
  return 'ok';
};
/* ---------------- Equipment drops ---------------- */
/* Stamina helpers (only heroes with useStam: the Veteran). Charged attacks out of a dash cost more. */
/* ---------------- Hold attack (basic attack held down) ----------------
   The tap already swung; keep holding and the hero winds up (slower walk). Released once ready = the hold attack. */
G.holdInput = function (p, s, def, pressed, held, dt) {
  const h = def.hold;
  if (pressed) { p.holdA = { t: 0, k: 0, full: false }; return; }
  const A = p.holdA; if (!A) return;
  const free = p.dashT <= 0 && !(p.spinT > 0) && !(p.lungeT > 0) && !p.charge && !G.modal;
  if (held && free) {
    A.t += dt; const k = Math.max(0, Math.min(1, (A.t - h.start) / h.time));
    if (k > 0 && A.k === 0) H.audio.play('sword_draw');
    A.k = k; p.anim.chargeK = k; p.faceAng = Math.atan2(-p.aimDX, -p.aimDZ);
    if (k > 0 && Math.random() < dt * 30) { const a = Math.random() * 6.283, r = 0.6 + k * 1.8; H.R.emit(p.x + Math.cos(a) * r, 0.2, p.z + Math.sin(a) * r, -Math.cos(a) * 2, 1.5, -Math.sin(a) * 2, 0.35, 0.35, 0.09, k >= 1 ? 0xffe9a8 : 0xe8dcc4, 1, 0, 0.3); }
    if (k >= 1 && !A.full) { A.full = true; H.audio.play('sword_ready'); G.float(p.x, 2.7, p.z, H.t('READY'), 'small good'); H.R.ring(p.x, p.z, 0xffe9a8, 0.4, 1.6, 0.25, 0.1, 0.9, 0.1); }
    return;
  }
  p.holdA = null; p.anim.chargeK = 0;
  if (A.full && !held && free) G.holdRelease(p, s, def);
};
G.holdRelease = function (p, s, def) {
  const h = def.hold, st = H.spellStats(s.id, s.rank, p);
  const cost = p.useStam ? Math.round((def.stam || 0) * h.stamMul) : 0;
  if (cost > p.stam) { G.noStamina(p, 0); return; }
  if (cost) G.spendStam(p, cost);
  s.cd = s.maxCd = h.cd; p.comboN = 0; p.comboT = 0;
  p.aimHoldT = 0.45; p.faceAng = Math.atan2(-p.aimDX, -p.aimDZ); p.casting = 0.14;
  p.anim.twirlN++;
  const R0 = h.radius + Math.max(0, st.range - def.range), dmg = Math.round(st.dmg * h.dmgMul), base = Math.atan2(p.aimDX, p.aimDZ);
  if (!G.paintedSlash(p, def)) {
    H.R.slashArc(p.x, p.z, base, Math.PI, 0.35, R0, 0xfff1c8, 0.4); H.R.slashArc(p.x, p.z, base, Math.PI, 0.35, R0 * 0.7, 0xcfd8e6, 0.32, 0.14);
    H.R.burst(p.x, 0.5, p.z, 0xffe9a8, 30 * G.fxMul(p), 9, 0.4, 0.45, { flat: true }); H.R.ring(p.x, p.z, 0xffe9a8, 0.4, R0 * 1.1, 0.35, 0.1, 1, 0.2);
  }
  H.R.shake(0.3); H.audio.play('sword_cleave'); G.hitstop = Math.max(G.hitstop, 0.06);
  let hit = 0; for (const e of G.enemiesNear(p.x, p.z, R0)) { const [kx, kz] = H.norm(e.x - p.x, e.z - p.z); G.damage(e, dmg, hitOpts(p, def, st, { kx, kz, knock: h.knock, interrupt: true, phys: true, cone: true, spell: def.id })); hit++; }
  if (hit) H.audio.play('sword_hit', { heavy: true });
  G.float(p.x, 2.8, p.z, H.t('CHARGED WHIRL'), 'big gold');
  G.emit('cast', { p, slot: 0, id: s.id });
};
/* ---------------- Divine Bar & the Aid's Call (R) ---------------- */
G.hasCall = p => !!(p && p.ult && H.SPELLS[p.ult.id] && H.SPELLS[p.ult.id].call);
G.gainDivine = function (p, n) {
  if (!G.hasCall(p) || !(n > 0)) return;
  const max = H.DIVINE.seg * H.DIVINE.segs, before = Math.floor(p.divine / H.DIVINE.seg);
  p.divine = Math.min(max, p.divine + n);
  const after = Math.floor(p.divine / H.DIVINE.seg);
  if (after > before) { H.audio.play(after >= H.DIVINE.segs ? 'sword_ready' : 'ui_ok'); if (after >= H.DIVINE.segs) G.float(p.x, 3, p.z, H.t('GREATER CALL READY'), 'big gold'); }
};
G.callInput = function (p, it, dt, touch) {
  const D = H.DIVINE, full = p.divine >= D.seg * D.segs - 0.01;
  if (p.callT > 0 || G.modal) { p.callHold = null; return; }
  if (touch) { if (it.released.ult) G.divineCall(p, full && it.heldLong && it.heldLong.ult); return; }
  if (it.pressed.ult) {
    if (p.divine < D.seg) { G.float(p.x, 2.6, p.z, H.t('DIVINE BAR EMPTY'), 'small'); H.audio.play('ui_deny'); G.emit('deny', { p, slot: 4, why: 'cd' }); return; }
    if (!full) { G.divineCall(p, false); return; }
    p.callHold = { t: 0 };
  }
  if (p.callHold) {
    if (it.held.ult) { p.callHold.t += dt; if (p.callHold.t >= D.holdT) { p.callHold = null; G.divineCall(p, true); } }
    else { p.callHold = null; G.divineCall(p, false); }
  }
};
G.divineCall = function (p, greater) {
  const D = H.DIVINE, def = H.SPELLS[p.ult.id]; if (p.divine < D.seg) return;
  if (p.dashT > 0 && p.dashImmune) { p.dashImmune = false; }
  const col = 0x6dffb0, deep = 0x1f8a5a, hit = { src: p, el: 'venom', spell: def.id, role: 'attack', phys: false, interrupt: true, divine: true };
  p.anim.castN++; p.casting = 0.3; p.aimHoldT = 0.3;
  G.run.castsBySpell[def.id] = (G.run.castsBySpell[def.id] || 0) + 1;
  const blast = (x, z, r, dmg, knock) => {
    for (const e of G.enemiesNear(x, z, r)) { const [kx, kz] = H.norm(e.x - x, e.z - z); G.damage(e, dmg, Object.assign({}, hit, { kx, kz, knock })); }
    for (const pr of G.projs) if (pr.team === 1 && !pr.dead && H.dist2(pr.x, pr.z, x, z) < r * r) { pr.dead = true; H.R.burst(pr.x, 1, pr.z, col, 6, 3, 0.3, 0.3); }
    H.R.ring(x, z, 0xeafff2, 0.5, r * 1.02, 0.35, 0.12, 1, 0.08); H.R.ring(x, z, col, 0.5, r, 0.5, 0.1, 1, 0.2); H.R.ring(x, z, deep, 0.4, r * 1.2, 0.7, 0.08, 0.8, 0.1);
    H.R.burst(x, 0.5, z, col, 90 * G.fxMul(p), r * 2.2, 0.7, 0.7, { flat: true, palette: [col, 0xc8ffe0, deep, 0xffffff] });
    H.R.burst(x, 0.5, z, col, 40 * G.fxMul(p), 8, 0.9, 0.8, { up: 8, grav: 6, palette: [col, deep] });
    H.R.flash(x, z, col, r * 1.2, 0.4); H.R.decal(x, z, deep, r * 0.7, 4);
  };
  if (!greater) {
    p.divine -= D.seg; p.iframes = Math.max(p.iframes, 0.5);
    G.float(p.x, 3.1, p.z, H.t('CALL'), 'big gold');
    blast(p.x, p.z, def.radius, def.dmg, def.knock); H.R.shake(0.6); G.hitstop = Math.max(G.hitstop, 0.08); H.audio.play('nova_boom');
    G.emit('cast', { p, slot: 4, id: def.id }); return;
  }
  // Greater Call: spends the whole bar; untouchable while the waves roll out, then one last blast
  p.divine = 0; p.callT = def.gInv; p.invuln = Math.max(p.invuln, def.gInv);
  G.float(p.x, 3.3, p.z, H.t('GREATER CALL'), 'big gold'); H.audio.play('nova_charge'); H.R.flash(p.x, p.z, col, 4, 0.5);
  const gap = Math.round((def.gInv - 0.4) * 1000 / (def.gPulses + 1));
  for (let k = 1; k <= def.gPulses; k++) G.after(() => { if (!G.active || p.dead) return; blast(p.x, p.z, def.gRadius * (0.7 + 0.3 * k / def.gPulses), def.gDmg, 6); H.R.shake(0.3); H.audio.play('slam'); }, gap * k);
  G.after(() => { if (!G.active || p.dead) return; blast(p.x, p.z, def.gRadius * 1.15, def.gFinal, 16); H.R.shake(1); H.R.kickCam(0, 1, 0.5); G.hitstop = Math.max(G.hitstop, 0.12); H.audio.play('nova_boom'); }, gap * (def.gPulses + 1));
  G.emit('cast', { p, slot: 4, id: def.id });
};
/* One hit of the sword's ground combo (def.combo.hits): the swing starts now, the blade lands after hd.delay.
   sweep = arc in front (hd.angle) · cone = narrow arc, shorter reach · line = a thrust that pierces every foe
   in a hd.len × hd.width strip, then a short step forward. */
// Theron's swords show only the painted slash (js/slashfx.js): no floor silhouettes, streaks or sparks for the hit area
G.paintedSlash = (p, def) => !!(def && def.weapon && H.R && H.R.slashFx && H.R.slashFx.active(p.charId, def.weapon));
G.comboHit = function (p, def, st, hd) {
  const dmg = Math.round(st.dmg * hd.dmgMul);
  p.anim.castSide = 1; p.anim.swing = hd.swing; p.anim.swingN++; p.anim.arcN = p.anim.swingN; p.anim.arc = hd.arc; p.anim.rate = hd.rate || 0;   // rate: swing speed for this hit (0 = the swing's own) if (hd.big) p.anim.bigN = p.anim.swingN;
  p.casting = Math.max(p.casting, hd.delay + 0.08); p.aimHoldT = Math.max(p.aimHoldT || 0, hd.delay + 0.3);
  H.audio.play(hd.shape === 'line' ? 'sword_thrust' : 'sword_swish');
  const ax = p.aimDX, az = p.aimDZ;
  G.after(() => {
    if (!G.active || p.dead) return;
    const base = Math.atan2(ax, az); let hit = 0;
    if (hd.shape === 'line') {
      const len = hd.len + Math.max(0, st.range - def.range) * 0.5, hw = hd.width / 2, x0 = p.x + ax * 0.3, z0 = p.z + az * 0.3;
      for (const e of G.enemies) {
        if (e.dead || e.spawnK < 1) continue; const dx = e.x - x0, dz = e.z - z0, along = dx * ax + dz * az, side = Math.abs(dx * az - dz * ax);
        if (along < -e.r || along > len + e.r || side > hw + e.r) continue;
        G.damage(e, dmg, hitOpts(p, def, st, { kx: ax, kz: az, knock: hd.knock, phys: true, pierce: true, interrupt: true })); hit++;
      }
      if (H.R.trail && H.R.trail.streak && !G.paintedSlash(p, def)) H.R.trail.streak(x0, z0, ax, az, len + 0.3, hd.arc);
      // carried forward by the thrust: a short, easing step (decays with the hero's knockback velocity)
      G.after(() => { if (!G.active || p.dead || p.dashT > 0) return; p.kvx = (p.kvx || 0) + ax * hd.step; p.kvz = (p.kvz || 0) + az * hd.step; }, 60);
      H.R.shake(0.16); H.R.kickCam(ax, az, 0.18);
    } else {
      const R0 = st.range * (hd.rangeMul || 1), ang = hd.angle * Math.PI / 360;
      for (const e of G.enemies) {
        if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > R0 + e.r || Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + Math.atan2(e.r, Math.max(d, 0.1)) * (hd.angle < 60 ? 0.5 : 1)) continue;
        const [kx, kz] = H.norm(dx, dz); G.damage(e, dmg, hitOpts(p, def, st, { kx, kz, knock: hd.knock, phys: true, cone: true, interrupt: hd.shape === 'cone' })); hit++;
      }
      if (G.paintedSlash(p, def)) { /* the painted slash is the whole effect */ }
      else if (hd.shape === 'sweep') { const AC = (H.R.trailCfg && H.R.trailCfg.styles && H.R.trailCfg.styles[hd.arc]) || { edge: 0xff2a3a }; H.R.slashArc(p.x, p.z, base, ang, R0 * 0.55, R0 * 1.1, AC.edge, 0.28); }
      else H.R.burst(p.x + ax * R0 * 0.8, 0.3, p.z + az * R0 * 0.8, 0xff4a4a, 14 * G.fxMul(p), 5, 0.3, 0.35, { up: 4 });
      H.R.shake(hd.shape === 'cone' ? 0.22 : 0.16);
    }
    if (hit) { H.audio.play('sword_hit', { heavy: hd.shape !== 'sweep' }); G.hitstop = Math.max(G.hitstop, hd.shape === 'sweep' ? 0.04 : 0.06); }
  }, hd.delay * 1000);
};
/* Third hit of the sword combo: a short wind-up, then a heavy cut straight ahead in a 45° wedge (nothing at the sides or behind). */
G.comboFinisher = function (p, def, st, fin) {
  const f = fin || def.combo.finisher, dmg = Math.round(st.dmg * f.dmgMul);
  p.casting = f.delay + 0.12; p.aimHoldT = Math.max(p.aimHoldT || 0, f.delay + 0.25);
  H.audio.play('sword_draw');
  G.after(() => {
    if (!G.active || p.dead) return;
    const base = Math.atan2(p.aimDX, p.aimDZ), R0 = st.range * (f.rangeMul || 1), ang = f.angle * Math.PI / 360;
    p.anim.swing = 'slash'; p.anim.swingN++; p.anim.bigN = p.anim.swingN;   // the finisher's energy arc is the big one
    // one floor sweep only, in the energy-arc colour (the old white sweep is gone), a bit wider than the cut
    const EC = H.R.trailCfg || { edge: 0x33d6b0 };
    if (!G.paintedSlash(p, def)) {
      H.R.slashArc(p.x, p.z, base, ang, R0 * 0.55, R0 * 1.18, EC.edge, 0.32);
      H.R.burst(p.x + p.aimDX * R0 * 0.6, 0.8, p.z + p.aimDZ * R0 * 0.6, EC.edge, 16 * G.fxMul(p), 6, 0.3, 0.4, { dir: [p.aimDX, p.aimDZ] });
    }
    H.R.shake(0.18); H.audio.play('sword_cleave'); G.hitstop = Math.max(G.hitstop, 0.05);
    let hit = 0;
    for (const e of G.enemies) {
      if (e.dead || e.spawnK < 1) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > R0 + e.r || Math.abs(H.angDiff(Math.atan2(dx, dz), base)) > ang + Math.atan2(e.r, Math.max(d, 0.1))) continue;
      const weak = !e.elite && !e.boss && (e.mass || 1) <= 1.5;
      const [kx, kz] = H.norm(dx, dz); G.damage(e, dmg, hitOpts(p, def, st, { kx, kz, knock: f.knock, phys: true, cone: true, stun: f.stunWeak && weak ? f.stunWeak : 0, interrupt: !!(f.stunWeak && weak) })); hit++;
    }
    if (hit) { H.audio.play('sword_hit', { heavy: true }); H.R.kickCam(p.aimDX, p.aimDZ, 0.12); }
  }, f.delay * 1000);
};
G.quickReady = (p, def, i) => def.role === 'attack' && i === 0 && (p.dashT > 0 || (p.dashChainT || 0) > 0) && (p.quickN || 0) < H.QUICK_ATTACK.max;
G.stamCost = (p, def) => { if (!p.useStam || !def.stam) return 0; const charged = def.charge && p.spells[0] && H.SPELLS[p.spells[0].id] === def && G.quickReady(p, def, 0); return Math.round(def.stam * (charged ? H.STAMINA.chargedMul : 1)); };
G.spendStam = (p, n) => { p.stam = Math.max(0, p.stam - n); p.stamT = H.STAMINA.delay; };
G.noStamina = (p, i) => { G.emit('deny', { p, slot: i, why: 'stamina' }); H.audio.play('ui_deny'); if (!(p.noStamFloatT > performance.now())) { G.float(p.x, 2.7, p.z, H.t('NO STAMINA'), 'small hurt'); p.noStamFloatT = performance.now() + 800; } p.stamFlash = 0.4; };
/* Thrown weapons (Axe Throw): fly to a target, bounce to the nearest foe not hit yet, then return to the thrower. */
G.flyers = [];
G.clearFlyers = function () {
  for (const f of G.flyers || []) { H.R.removeMesh(f.mesh); if (f.p) { f.p.throwing = null; if (f.p.model) H.R.syncHeroWeapon(f.p.model, f.p); } }
  G.flyers = [];
};
G.updateFlyers = function (dt) {
  for (let i = G.flyers.length - 1; i >= 0; i--) {
    const f = G.flyers[i], p = f.p; const sp = f.back ? 30 : 26;
    let tx, tz;
    if (f.back) { tx = p.x; tz = p.z; } else if (f.tgt && !f.tgt.dead) { tx = f.tgt.x; tz = f.tgt.z; } else { tx = f.tx; tz = f.tz; }
    const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz), step = sp * dt;
    f.spin += dt * 22; f.mesh.position.set(f.x, f.y, f.z); f.mesh.rotation.set(0, Math.atan2(dx, dz) + Math.PI, 0); f.mesh.userData.inner.rotation.x = -f.spin;
    if (Math.random() < 0.7) H.R.emit(f.x, f.y, f.z, 0, 0.2, 0, 0.25, 0.25, 0, 0xe8ecf2, 0.8, 0, 2);
    if (d > step + 0.3) { f.x += dx / d * step; f.z += dz / d * step; continue; }
    f.x = tx; f.z = tz;
    if (f.back || p.dead) { H.R.removeMesh(f.mesh); G.flyers.splice(i, 1); p.throwing = null; H.R.syncHeroWeapon(p.model, p); H.audio.play('axe_hit'); continue; }
    if (f.tgt && !f.tgt.dead) {
      const e = f.tgt; f.hit.add(e); const [kx, kz] = H.norm(dx || 0.01, dz);
      G.damage(e, f.st.dmg, hitOpts(p, f.def, f.st, { kx, kz, knock: 4, phys: true, interrupt: true }));
      H.R.burst(e.x, 1, e.z, 0xe8dcc4, 18, 5, 0.35, 0.35); H.audio.play('axe_hit', { heavy: true }); G.hitstop = Math.max(G.hitstop, 0.05); H.R.shake(0.18);
    }
    let nx = null;
    if (f.hops > 0) { let bd = f.def.hopRange * f.def.hopRange; for (const e of G.enemies) { if (e.dead || e.spawnK < 1 || f.hit.has(e)) continue; const dd = H.dist2(e.x, e.z, f.x, f.z); if (dd < bd) { bd = dd; nx = e; } } }
    if (nx) { f.hops--; f.tgt = nx; } else f.back = true;
  }
};
G.CAM_ZOOM = 0.78; // in-run camera distance (1 = old default; lower = closer)
G.WEAPON_DROP_MUL = 6; // weapons are much more likely than armour pieces (and can repeat)
G.rollItem = function (p, rng, bonus = 0) {
  rng = rng || G.run.rng; const depth = (G.run && G.run.depth) || 1;
  const owned = new Set(Object.values(p.equip).concat(p.bag).filter(Boolean));
  const ids = Object.keys(H.ITEMS).filter(id => G.canUse(p, id)); const fresh = ids.filter(id => !owned.has(id) || H.ITEMS[id].weapon); const pool = fresh.length ? fresh : ids;
  const w = id => { const r = H.ITEMS[id].rarity; return (r === 'legendary' ? 1 + depth * 1.5 + bonus * 3 : r === 'rare' ? 8 + depth * 5 + bonus * 10 : r === 'uncommon' ? 26 + depth * 4 + bonus * 6 : 60 - bonus * 10) * (H.ITEMS[id].weapon ? G.WEAPON_DROP_MUL : 1); };
  let tot = 0; for (const id of pool) tot += Math.max(1, w(id)); let x = rng() * tot;
  for (const id of pool) { x -= Math.max(1, w(id)); if (x <= 0) return id; } return pool[0];
};
G.giveItem = function (p, id) {
  const slot = p.bag.findIndex(x => !x); const it = H.ITEMS[id];
  if (slot < 0) { G.float(p.x, 2.8, p.z, H.t('BAG FULL'), 'big'); return false; }
  p.bag[slot] = id; G.syncGear(p); H.audio.play('reward');
  G.float(p.x, 3.0, p.z, it.name.toUpperCase(), 'big gold');
  H.UI.toast(H.t('New item: {n}', { n: it.name }) + ' · ' + H.t('{k} to open the inventory', { k: H.UI.keyFor('inventory', p.src) }));
  G.emit('itemGained', { p, id }); return true;
};
G.dropItems = function (chance, bonus) { if (!G.run || G.run.mode === 'tutorial') return; for (const p of G.players) if (!p.dead && G.run.rng() < chance) G.giveItem(p, G.rollItem(p, G.run.rng, bonus)); };
G.equipItem = function (p, bagIdx) {
  const id = p.bag[bagIdx]; const it = id && H.ITEMS[id]; if (!it) return false;
  if (!G.canUse(p, id)) return 'locked';
  const old = p.equip[it.slot]; p.equip[it.slot] = id; p.bag[bagIdx] = old || null; if (p.kind === 'player') G.recalcPlayer(p); else p.gear = G.gearStats(p); G.syncGear(p); H.audio.play('reward'); return true;
};
G.unequipItem = function (p, slot) {
  if (slot === 'weapon' && H.DISABLED_WEAPONS && H.DISABLED_WEAPONS.fists && H.DEFAULT_WEAPON[p.charId]) { H.UI.toast(H.t('The Veteran always keeps a weapon in hand: equip another one from the bag to swap it.')); return false; }
  const id = p.equip[slot]; if (!id) return false; const free = p.bag.findIndex(x => !x); if (free < 0) return false;
  p.bag[free] = id; p.equip[slot] = null; if (p.kind === 'player') G.recalcPlayer(p); else p.gear = G.gearStats(p); G.syncGear(p); return true;
};
G.giveRoomReward = function (kind, done) {
  if (kind === 'warden') { done && done(); return; }
  G.dropItems({ combat: 0.35, elite: 0.85, challenge: 0.9 }[kind] || 0, kind === 'combat' ? 0 : 1);
  if (['combat', 'elite', 'challenge'].includes(kind)) {
    const titles = { combat: ['Spoils of the Chamber', 'Choose one: a new spell for an empty slot, an upgrade for your primary attack, or a charm.'], elite: ['Crown Taken', 'The elite drops a charm. Choose one.'], challenge: ['Trial Overcome', 'Rich spoils for a cursed trial.'] };
    G.offerChoice({ title: titles[kind][0], sub: titles[kind][1], kind, count: 3 }, done);
  } else done && done();
};
/* Present choice to each player in turn */
G.offerChoice = function (spec, done) {
  const players = G.players.filter(p => !p.dead);
  let i = 0;
  const next = () => {
    if (i >= players.length) { G.modal = null; done && done(); return; }
    const owner = players[i++];
    const offers = spec.offers || G.makeOffers(owner, spec.kind, spec.count || 3);
    G.modal = 'choice';
    H.UI.showChoice({ title: spec.title, sub: spec.sub, owner, offers, multi: players.length > 1, skippable: true }, (pick) => { G.applyOffer(owner, pick, next); });
  };
  next();
};
/* Rank-ups that also work for element-kit abilities (those level through their branch upgrades instead of ranks) */
G.canRankUp = function (p, s, cap) {
  const d = H.SPELLS[s.id]; if (!d.kit) return s.rank < (cap || H.MAX_RANK);
  const u = p.ups[s.id] || {}; return Object.keys(d.ups).some(k => (u[k] || 0) < H.BRANCH_MAX);
};
G.rankUp = function (p, s, n, cap) {
  const d = H.SPELLS[s.id];
  if (!d.kit) { s.rank = Math.min(cap || H.MAX_RANK, s.rank + n); return; }
  for (let k = 0; k < n; k++) { const u = p.ups[s.id] || {}; const stat = (u.dmg || 0) < H.BRANCH_MAX ? 'dmg' : Object.keys(d.ups).find(q => (u[q] || 0) < H.BRANCH_MAX); if (!stat) break; G.addBranch(p, s.id, stat); }
};
/* Hotbar memory: each spell remembers the slot (II–IV) you last kept it in, across runs. */
G.slotPrefs = () => (H.save.meta.slotPref || (H.save.meta.slotPref = {}));
G.freeSlotFor = function (p, id) {
  const pref = G.slotPrefs()[id]; if (pref >= 1 && pref <= 3 && !p.spells[pref]) return pref;
  const empties = [1, 2, 3].filter(i => !p.spells[i]); if (!empties.length) return -1;
  // avoid slots another spell has claimed, when possible
  const claimed = new Set(Object.entries(G.slotPrefs()).filter(([k]) => k !== id && !p.spells.some(s => s && s.id === k)).map(([, v]) => v));
  return empties.find(i => !claimed.has(i)) || empties[0];
};
G.rememberSlots = function (p) { const pr = G.slotPrefs(); for (let i = 1; i <= 3; i++) if (p.spells[i]) pr[p.spells[i].id] = i; H.saveNow(); };
G.swapSlots = function (p, a, b) { if (a < 1 || b < 1 || a > 3 || b > 3 || a === b) return; const t = p.spells[a]; p.spells[a] = p.spells[b]; p.spells[b] = t; G.rememberSlots(p); G.emit('slotFilled', { p, slot: a }); };
G.addBranch = function (p, id, stat) {
  const u = p.ups[id] || (p.ups[id] = {}); u[stat] = Math.min(H.BRANCH_MAX, (u[stat] || 0) + 1);
  const sp = p.spells.concat([p.ult]).find(s => s && s.id === id); if (sp) sp.rank = 1 + Object.values(u).reduce((a, b) => a + b, 0);
};
G.applyOffer = function (p, o, next) {
  if (!o) { next(); return; }
  if (o.type === 'heal') { G.healFlat(p, o.amt); H.audio.play('heal'); G.float(p.x, 2.4, p.z, '+' + o.amt, 'big good'); next(); }
  else if (o.type === 'branch') { G.addBranch(p, o.id, o.stat); H.audio.play('reward'); G.float(p.x, 2.6, p.z, ((H.SPELLS[o.id] || H.PASSIVES[o.id]).name + ' +').toUpperCase(), 'big gold'); next(); }
  else if (o.type === 'ult') { p.ult = { id: o.id, rank: 1, cd: 0 }; p.ups[o.id] = p.ups[o.id] || {}; H.audio.play('reward'); G.float(p.x, 2.8, p.z, H.t('ULTIMATE') + ' · ' + H.SPELLS[o.id].name.toUpperCase(), 'big gold'); G.emit('slotFilled', { p, slot: 4 }); next(); }
  else if (o.type === 'passive') { p.passives[o.id] = true; p.ups[o.id] = p.ups[o.id] || {}; H.audio.play('reward'); G.float(p.x, 2.6, p.z, H.PASSIVES[o.id].name.toUpperCase(), 'big gold'); next(); }
  else if (o.type === 'rank' && H.SPELLS[o.id] && H.SPELLS[o.id].kit) { const sk = p.spells.concat([p.ult]).find(x => x && x.id === o.id); if (sk) G.rankUp(p, sk, 1); H.audio.play('reward'); next(); }
  else if (o.type === 'mod') { p.mods[o.id] = (p.mods[o.id] || 0) + 1; H.audio.play('reward'); G.float(p.x, 2.6, p.z, H.MODS[o.id].name.toUpperCase(), 'big gold'); next(); }
  else if (o.type === 'rank') { const s = p.spells.find(s => s && s.id === o.id); if (s) s.rank = Math.min(H.MAX_RANK, s.rank + (o.amount || 1)); H.audio.play('reward'); next(); }
  else if (o.type === 'charm') { p.charms.add(o.id); G.recalcPlayer(p); H.audio.play('reward'); next(); }
  else if (o.type === 'attr') { p.attrs = p.attrs || {}; p.attrs[o.id] = (p.attrs[o.id] || 0) + 1; G.recalcPlayer(p); if (o.id === 'vigor') p.stam = Math.min(p.maxStam, p.stam + 15); if (o.id === 'thick_skin') p.hp = Math.min(p.maxHp, p.hp + 12); H.audio.play('reward'); G.float(p.x, 2.6, p.z, (H.ATTRS[o.id].name + ' +').toUpperCase(), 'big gold'); next(); }
  else if (o.type === 'spell' && p.spells.some((s, i) => i > 0 && !s)) { const slot = G.freeSlotFor(p, o.id); p.spells[slot] = { id: o.id, rank: o.rank || 1, cd: 0 }; G.rememberSlots(p); H.audio.play('reward'); G.float(p.x, 2.6, p.z, H.t('NEW SPELL · SLOT {n}', { n: ['I', 'II', 'III', 'IV'][slot] }), 'big gold'); G.emit('slotFilled', { p, slot }); next(); }
  else if (o.type === 'spell') {
    H.UI.showSwap({ owner: p, id: o.id, rank: o.rank || 1 }, (slot) => {
      if (slot != null) { const old = p.spells[slot]; const r = Math.max(o.rank || 1, old.rank - 1); p.spells[slot] = { id: o.id, rank: r, cd: 0 }; G.rememberSlots(p); H.audio.play('reward'); }
      next();
    });
  } else if (o.type === 'fortify') { p.fortify = (p.fortify || 0) + o.amt; G.recalcPlayer(p); p.hp = Math.min(p.maxHp, p.hp + o.amt); H.audio.play('heal'); next(); }
  else next();
};
G.offerRest = function (done) {
  const players = G.players.filter(p => !p.dead); let i = 0;
  const next = () => {
    if (i >= players.length) { G.modal = null; done && done(); return; }
    const owner = players[i++];
    const heal = Math.round(owner.maxHp * 0.4);
    const rankable = owner.spells.filter(s => s && G.canRankUp(owner, s));
    const offers = [{ type: 'heal', amt: heal, label: 'Rest by the fire' }, rankable.length ? { type: 'rankpick', label: 'Attune' } : null, { type: 'fortify', amt: 12, label: 'Fortify' }].filter(Boolean);
    G.modal = 'choice';
    H.UI.showChoice({ title: 'The Hearth', sub: 'One choice. The fire will not wait twice.', owner, offers, multi: players.length > 1 }, (pick) => {
      if (pick && pick.type === 'rankpick') { H.UI.showSlotPick({ owner, title: 'Attune a spell', sub: 'Raise one spell by a rank.', filter: s => s && G.canRankUp(owner, s) }, slot => { if (slot != null) { G.rankUp(owner, owner.spells[slot], 1); } H.audio.play('reward'); next(); }); }
      else G.applyOffer(owner, pick, next);
    });
  };
  next();
};
G.offerChallenge = function (prop) {
  const trials = [
    { id: 'haste', name: 'Trial of Haste', desc: 'Clear three waves within 50 seconds.', curse: 'Fail: lose 20% of your current HP.' },
    { id: 'grace', name: 'Trial of Grace', desc: 'Clear three waves taking no more than 3 hits.', curse: 'Fail: lose 20% of your current HP.' },
    { id: 'blood', name: 'Trial of Blood', desc: 'Foes have 40% more HP for this trial.', curse: 'No penalty, but it is a long fight.' }
  ];
  const tr = trials[G.run.rng.int(trials.length)];
  G.modal = 'choice';
  H.UI.showChoice({ title: H.t(tr.name), sub: H.t(tr.desc) + H.t(' Reward: a charm, a rank II spell or an upgrade, plus gold coins. ') + H.t(tr.curse), owner: G.players[0], offers: [{ type: 'accept', label: 'Accept the trial' }, { type: 'decline', label: 'Walk past' }], noSkip: true }, (pick) => {
    G.modal = null;
    if (pick && pick.type === 'accept') {
      prop.used = true; const room = G.room;
      for (const d of room.doors) d.open = false;
      room.challengeActive = true;
      room.challenge = { id: tr.id, name: tr.name, active: true, t: 50, hits0: G.run.hitsTaken, failed: false };
      room.cleared = false; room.waves = []; room.waveIdx = -1; room.t = 0;
      room.bloodMul = tr.id === 'blood' ? 1.4 : 1;
      G.setupEncounter(room, 'challenge');
      H.audio.setTheme('combat'); G.emit('challenge', room.challenge);
    } else { prop.used = true; }
  });
};
G.updateChallenge = function (dt) {
  const c = G.room.challenge; if (!c || c.failed) return;
  if (c.id === 'haste') { c.t -= dt; if (c.t <= 0) G.failChallenge(); }
  if (c.id === 'grace' && G.run.hitsTaken - c.hits0 > 3) G.failChallenge();
};
G.failChallenge = function () {
  const room = G.room; const c = room.challenge; c.failed = true; c.active = false;
  G.emit('challengeFail', c); H.audio.play('ui_deny');
  for (const p of G.players) if (!p.dead && !p.downed) { p.hp = Math.max(1, Math.round(p.hp * 0.8)); }
  room.challenge = null; room.type = 'combat'; room.challengeActive = false; // remaining foes still need clearing; reward downgraded
};

/* ---------------- Mystery events ---------------- */
G.mysteryEvent = function (done) {
  const run = G.run; const rng = run.rng; const p = G.players[0];
  const id = rng.pick(H.MYSTERY_EVENTS);
  const ev = G.EVENTS[id](p, rng);
  G.modal = 'choice';
  H.UI.showEvent(ev, (choice) => {
    G.modal = null;
    const res = choice && choice.run ? choice.run() : null;
    done && done();
    if (res && res.then) res.then(() => { });
  });
};
G.EVENTS = {
  mirror: (p, rng) => ({ title: 'The Weeping Mirror', text: 'A mirror weeps black ink. In it, your reflection casts something you have never learned.', options: [
    { label: 'Touch the glass', hint: 'Swap a random spell for a new one at +1 rank.', run: () => { const filled = [1, 2, 3].filter(i => p.spells[i]); const id = G.randomNewSpell(p, rng); if (id && !filled.length) { const e = G.freeSlotFor(p, id); if (e > 0) { p.spells[e] = { id, rank: 1, cd: 0 }; G.rememberSlots(p); G.rankUp(p, p.spells[e], 1, 4); G.float(p.x, 2.5, p.z, H.SPELLS[id].name, 'big'); H.audio.play('reward'); } return; } const slot = rng.pick(filled); if (id) { const r = Math.min(4, p.spells[slot].rank + 1); G.float(p.x, 2.5, p.z, H.SPELLS[p.spells[slot].id].name + ' → ' + H.SPELLS[id].name, 'big'); p.spells[slot] = { id, rank: 1, cd: 0 }; G.rankUp(p, p.spells[slot], r - 1, 4); H.audio.play('reward'); } } },
    { label: 'Shatter it', hint: '+10 gold coins. Take 12 damage.', run: () => { G.run.embers += 10; p.hp = Math.max(1, p.hp - 12); H.audio.play('shatter'); G.float(p.x, 2.5, p.z, H.t('+{n} GOLD', { n: 10 }), 'big gold'); } },
    { label: 'Walk on', hint: 'Nothing happens.' }] }),
  pilgrim: (p, rng) => ({ title: 'The Chained Pilgrim', text: 'A pilgrim hangs in chains, whispering of a charm hidden in her sleeve. Her jailer sleeps nearby.', options: [
    { label: 'Break the chains', hint: 'Wake the jailer: an elite fight for a charm.', run: () => { G.room.cleared = false; G.room.waves = []; G.room.waveIdx = -1; G.room.t = 0; const pool = G.enemyPool(G.run.depth, 3).filter(k => k !== 'wisp'); G.room.waves.push([{ type: rng.pick(pool), elite: rng.pick(Object.keys(H.ELITE_AFFIXES)) }]); G.room.challenge = null; G.room.rewardKind = 'elite'; G.room.type = 'elite'; for (const d of G.room.doors) d.open = false; H.audio.setTheme('combat'); } },
    { label: 'Leave her', hint: 'Nothing happens.' }] }),
  font: (p, rng) => ({ title: 'Font of Ash', text: 'Warm ash rises from a stone basin. It tastes of iron and old spells.', options: [
    { label: 'Drink deeply', hint: '+15 max HP. Your dashes recharge 15% slower.', run: () => { p.fortify = (p.fortify || 0) + 15; G.recalcPlayer(p); p.hp += 15; p.dashSlowT = (p.dashSlowT || 1) * 0.85; H.audio.play('heal'); } },
    { label: 'Wash your hands', hint: 'Heal 20 HP.', run: () => { p.hp = Math.min(p.maxHp, p.hp + 20); H.audio.play('heal'); } }] }),
  grimoire: (p, rng) => ({ title: 'The Whispering Grimoire', text: 'An open book recites your spells back to you, slightly better, for a price.', options: [
    { label: 'Read aloud', hint: 'A random spell gains 2 ranks. Lose 25% current HP.', run: () => { const c = p.spells.filter(s => s && G.canRankUp(p, s, 4)); if (c.length) { const s = rng.pick(c); G.rankUp(p, s, 2, 4); G.float(p.x, 2.5, p.z, H.SPELLS[s.id].name + ' +2', 'big gold'); } p.hp = Math.max(1, Math.round(p.hp * 0.75)); H.audio.play('cast_void'); } },
    { label: 'Close the book', hint: 'Nothing happens.' }] }),
  brazier: (p, rng) => ({ title: "Gambler's Brazier", text: 'A brazier burns with blue fire. Offer it blood, and it offers something back.', options: [
    { label: 'Offer 20 HP', hint: 'Gain a random charm.', run: () => { const id = G.randomCharm(p, rng); p.hp = Math.max(1, p.hp - 20); if (id) { p.charms.add(id); G.recalcPlayer(p); G.float(p.x, 2.5, p.z, H.CHARMS[id].name, 'big gold'); H.audio.play('reward'); } } },
    { label: 'Warm your hands', hint: 'Restore all mana and gain Mending (life rises over 5 s).', run: () => { p.mana = p.maxMana; G.afflict(p, 'regen', 2); H.audio.play('heal'); } }] }),
  satchel: (p, rng) => ({ title: "A Lost Rogue's Satchel", text: 'Another rogue did not make it this far. Their satchel is still warm.', options: [
    { label: 'Take the salve', hint: 'Heal 30 HP.', run: () => { for (const q of G.players) q.hp = Math.min(q.maxHp, q.hp + 30); H.audio.play('heal'); } },
    { label: 'Take the cursed charm', hint: 'Gain a charm. Foes have +20% HP for the rest of this depth.', run: () => { const id = G.randomCharm(p, rng); if (id) { p.charms.add(id); G.recalcPlayer(p); G.float(p.x, 2.5, p.z, H.CHARMS[id].name, 'big gold'); } G.run.curse += 2; H.audio.play('cast_void'); } }] }),
  loom: (p, rng) => ({ title: 'The Sigil Loom', text: 'A loom of light can reweave a spell into another of the same purpose.', options: [
    { label: 'Reweave a spell', hint: 'Pick a slot; it becomes a random spell of the same role at the same rank.', run: () => new Promise(res => { G.modal = 'choice'; H.UI.showSlotPick({ owner: p, title: 'Reweave which spell?', sub: 'It becomes a random spell sharing its role.', filter: s => !!s && s !== p.spells[0] }, slot => { G.modal = null; if (slot != null) { const s = p.spells[slot]; const role = H.SPELLS[s.id].role; const have = new Set(p.spells.filter(Boolean).map(x => x.id)); const kitL = G.kitFor(p); const pool = (kitL ? kitL.spells : G.availableSpells()).filter(id => (kitL || H.SPELLS[id].role === role) && !have.has(id)); const pick = pool.length ? rng.pick(pool) : G.randomNewSpell(p, rng); if (pick) { G.float(p.x, 2.5, p.z, H.SPELLS[s.id].name + ' → ' + H.SPELLS[pick].name, 'big'); p.spells[slot] = { id: pick, rank: s.rank, cd: 0 }; H.audio.play('reward'); } } res(); }); }) },
    { label: 'Leave it be', hint: 'Nothing happens.' }] }),
  echo: (p, rng) => ({ title: 'Echo of a Past Run', text: 'A shade wearing your face stands here. It remembers how deep you once went.', options: [
    { label: 'Take its memory', hint: H.t('Gain {n} gold coins.', { n: 3 + 3 * Math.max(1, H.save.meta.stats.bestDepth) }), run: () => { const em = 3 + 3 * Math.max(1, H.save.meta.stats.bestDepth); G.run.embers += em; G.float(p.x, 2.5, p.z, H.t('+{n} GOLD', { n: em }), 'big gold'); H.audio.play('reward'); } },
    { label: 'Duel the echo', hint: 'Fight a Hasted elite. Win a rank II spell.', run: () => { G.room.cleared = false; G.room.waves = [[{ type: rng.pick(G.enemyPool(G.run.depth, 3).filter(k => k !== 'wisp')), elite: 'hasted' }]]; G.room.waveIdx = -1; G.room.t = 0; G.room.type = 'combat'; for (const d of G.room.doors) d.open = false; H.audio.setTheme('combat'); } }] })
};

/* ---------------- Wardens ---------------- */
G.startBoss = function () {
  const run = G.run; const type = H.DEPTHS[run.depth].boss;
  const e = G.spawnEnemy(type, 0, -4);
  G.boss = e; e.phase = 1;
  G.emit('bossIntro', { e });
  H.audio.play('roar'); H.R.shake(0.4);
};
G.bossDefeated = function (e) {
  const run = G.run; run.wardens++; run.score += 1000 * run.depth; run.rooms++; G.gainEmbers(20);
  G.setSlow(0.2, 2.2); H.R.shake(0.8); H.audio.play('explode'); H.audio.play('victory');
  for (let i = 0; i < 6; i++) G.after(() => { if (!G.active) return; H.R.burst(e.x + (Math.random() - .5) * 3, 2 + Math.random() * 3, e.z + (Math.random() - .5) * 3, 0xff2e55, 60, 12, 1, 0.8, { palette: [0xff2e55, 0xffd27a, 0xffffff] }); H.R.flash(e.x, e.z, 0xffd27a, 6, 0.4); H.R.ring(e.x, e.z, 0xffd27a, 1, 10, 0.8); }, i * 160);
  for (const pr of G.projs) if (pr.team === 1) pr.dead = true;
  for (const t of G.tgs) t.done = true;
  for (const z of G.zones) if (z.team === 1) { z.dur = 0; z.delay = 0; z.t = 1; }
  for (const o of G.enemies) if (!o.dead && o !== e) G.kill(o, {});
  G.room.cleared = true;
  const key = { gaolwright: 'warden1', kiln_saint: 'warden2', hollow_regent: 'victory' }[e.type];
  if (e.type === 'kiln_saint') { H.save.meta.stats.kiln = (H.save.meta.stats.kiln || 0) + 1; if (H.save.meta.stats.kiln >= 2) G.milestone('warden2b'); }
  if (key && key !== 'victory') G.milestone(key);
  if (G.players.length > 1) { run.depthsCleared++; G.milestone('coopwin'); }
  G.emit('bossDown', { e });
  G.after(() => {
    if (!G.active) return;
    for (const p of G.players) { if (p.dead) { p.dead = false; p.hp = Math.round(p.maxHp * 0.3); } if (p.downed) { p.downed = false; p.hp = Math.round(p.maxHp * 0.3); } p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.4)); }
    G.dropItems(1, 2);
    G.offerChoice({ title: H.t('{n} is unmade', { n: H.ENEMIES[e.type].name }), sub: 'Claim a Warden relic. Your wounds close by 40%.', kind: 'warden', count: 3 }, () => {
      const prop = { kind: 'descent', x: 0, z: -2, used: false, ready: false };
      G.room.prop = prop; H.R.buildProp(prop, H.DEPTHS[run.depth]);
      G.after(() => { prop.ready = true; }, 600);
      G.emit('descentReady', { last: run.depth >= 3 });
    });
  }, 1300);
};

/* ---------------- Arena ---------------- */
G.startArena = function () {
  const run = G.run; run.depth = 1; run.wave = 0; run.arenaT = 0; run.nextWaveT = 2.5; run.spawnT = 2; run.nextReward = 25;
  G.loadRoom('arena', { centerFree: true });
  G.room.waves = []; G.room.arena = true;
  H.audio.setTheme('combat');
};
G.updateArena = function (dt) {
  const run = G.run; const room = G.room;
  run.arenaT += dt;
  const alive = G.enemies.filter(e => !e.dead).length;
  const depthFor = w => w >= 12 ? 3 : w >= 5 ? 2 : 1;
  if (run.arenaRule === 'siege') {
    if (alive === 0 && G.pendingSpawns() === 0 && !G.modal) {
      run.nextWaveT -= dt;
      if (run.nextWaveT <= 0) {
        if (run.wave > 0 && run.wave % 3 === 0 && !run.rewarded) { run.rewarded = true; for (const p of G.players) if (!p.dead) G.healPct(p, 0.2); }
        run.rewarded = false; run.wave++; run.depth = depthFor(run.wave); run.nextWaveT = 2.5;
        if (run.wave >= 10) G.milestone('arena10');
        if (run.wave > 1 && (run.wave - 1) % 4 === 0) G.dropItems(1, 1);
        const pool = G.enemyPool(run.depth, 4);
        const budget = (4 + run.wave * 1.6) * (G.players.length > 1 ? 1.35 : 1);
        const wave = G.buildWave(budget, pool, run.rng, 6 + Math.min(10, run.wave));
        if (run.wave % 5 === 0) wave.unshift({ type: run.rng.pick(pool.filter(k => k !== 'wisp')), elite: run.rng.pick(Object.keys(H.ELITE_AFFIXES)) });
        wave.forEach((s, i) => G.queueSpawn(s, null, null, 0.8 + i * 0.1));
        G.emit('wave', { idx: run.wave - 1, arena: true, wave: run.wave });
        for (const p of G.players) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + 6);
      }
    }
  } else { // vigil: continuous
    run.score = Math.floor(run.arenaT * 10) + run.kills * 5;
    run.wave = Math.floor(run.arenaT / 30) + 1; run.depth = depthFor(run.wave * 2);
    run.spawnT -= dt;
    const cap = 6 + Math.min(14, Math.floor(run.arenaT / 20));
    if (run.spawnT <= 0 && alive + G.pendingSpawns() < cap) {
      run.spawnT = Math.max(0.55, 2.6 - run.arenaT / 90);
      const pool = G.enemyPool(run.depth, 4);
      const elite = run.rng() < Math.min(0.12, run.arenaT / 1500) ? run.rng.pick(Object.keys(H.ELITE_AFFIXES)) : null;
      G.queueSpawn({ type: run.rng.pick(elite ? pool.filter(k => k !== 'wisp') : pool), elite });
    }
    if (run.arenaT >= run.nextReward) { run.nextReward += 60; for (const p of G.players) if (!p.dead) G.healPct(p, 0.15); }
  }
};

/* ---------------- Milestones & end ---------------- */
G.milestone = function (key) {
  const m = H.save.meta.milestones; if (m[key]) return;
  m[key] = Date.now(); if (G.run) G.run.milestonesNew.push(key);
  H.saveNow();
  G.emit('milestone', { key });
};
G.victory = function () {
  const run = G.run; run.victory = true; G.milestone('victory');
  H.audio.play('victory');
  G.endRun(true);
};
G.endRun = function (victory) {
  const run = G.run; if (!run || run.ended) return; run.ended = true;
  const meta = H.save.meta, st = meta.stats;
  const tut = run.mode === 'tutorial';
  if (!tut) {
    let embers = run.embers + (run.mode === 'arena' ? Math.floor(run.wave * 2.5) : run.depth * 3);
    if (G.players.some(p => p.boon === 'ember_purse')) embers = Math.round(embers * 1.25);
    run.embersEarned = embers; meta.embers += embers; meta.totalEmbers += embers;
    st.rooms += run.rooms; st.kills += run.kills; st.reactions += run.reactions; st.interrupts += run.interrupts; st.elites += run.elites; st.wardens += run.wardens; st.playtime += run.time;
    if (!victory) st.deaths++; else st.wins++;
    if (run.mode !== 'arena') st.bestDepth = Math.max(st.bestDepth, run.depth);
    run.prevBest = run.mode === 'arena' ? (run.arenaRule === 'siege' ? st.arenaBestScore : st.vigilBest) : st.bestScore;
    if (run.mode === 'arena') { if (run.arenaRule === 'siege') { st.arenaBestWave = Math.max(st.arenaBestWave, run.wave); st.arenaBestScore = Math.max(st.arenaBestScore, run.score); } else st.vigilBest = Math.max(st.vigilBest, run.arenaT); }
    else { st.bestScore = Math.max(st.bestScore, run.score); }
    if (st.reactions >= 50) G.milestone('reactions50');
    if (st.interrupts >= 20) G.milestone('interrupts20');
    if (st.elites >= 10) G.milestone('elite10');
    meta.lastBuild = G.run.cfg.seats[0].build.slice(); meta.lastBoon = G.run.cfg.seats[0].boon;
    H.saveNow();
  }
  run.finalPlayers = G.players.map(p => ({ name: p.name, spells: p.spells.concat([p.ult]).filter(Boolean).map(s => ({ id: s.id, rank: s.rank })), mods: Object.entries(p.mods || {}), charms: [...p.charms], dmg: p.dmgDealt, color: p.accentCss }));
  G.active = false;
  G.emit('runEnd', { victory, run });
};

/* ---------------- Tutorial ---------------- */
G.startTutorial = function () {
  const run = G.run; run.depth = 1;
  G.loadRoom('tutorial', { centerFree: true });
  const room = G.room; room.pits = []; room.vents = []; room.waves = [];
  room.pillars = [{ x: -8, z: -2, r: 1 }, { x: 8, z: -2, r: 1 }];
  H.R.buildChamber(room, H.DEPTHS[1]);
  G.tut = { step: 0, t: 0, hits: 0, dodges: 0, mark: null, ents: [] };
  G.tutStep(0);
};
G.TUT_STEPS = [
  { id: 'move', title: 'Move', text: a => `Walk to the glowing rune. ${a.move}` },
  { id: 'cast', title: 'Aim and cast', text: a => `Aim at the effigy and cast Cinder Bolt with ${a.cast1}. Hit it 3 times.` },
  { id: 'dash', title: 'Dash through danger', text: a => `The thrower hurls bolts. Press ${a.dash} to dash; you are untouchable mid-dash. Dodge through 2 bolts.` },
  { id: 'interrupt', title: 'Interrupt', text: a => `The Hexcaster is channeling. Break its cast with Gust Fan (${a.cast2}) before the bar fills.` },
  { id: 'react', title: 'Elemental reactions', text: a => `Give the effigy Frostbite with Rime Shard (${a.cast3}), then Burn it with Cinder Bolt (${a.cast1}). Burn + Frostbite = Steamburst.` },
  { id: 'done', title: 'Primer complete', text: a => 'You know enough to die well. Walk through the door to finish.' }
];
G.tutStep = function (n) {
  const tut = G.tut; tut.step = n; tut.t = 0;
  for (const e of tut.ents) if (!e.dead) { e.dead = true; e.removeT = 0; }
  tut.ents = [];
  if (tut.mark) { H.R.removeMesh(tut.mark); tut.mark = null; }
  const id = G.TUT_STEPS[n].id;
  if (id === 'move') { tut.mark = H.R.makeZoneMesh(0xd9a441, 1.6, 0.8); tut.mark.position.set(0, 0.06, 1); tut.markPos = { x: 0, z: 1 }; }
  if (id === 'cast') { tut.ents.push(G.spawnEnemy('dummy', 0, -6)); tut.hits = 0; }
  if (id === 'dash') { const t = G.spawnEnemy('turret', 0, -7); t.tutTurret = true; tut.ents.push(t); tut.dodges = 0; }
  if (id === 'interrupt') { const h = G.spawnEnemy('hexcaster', 0, -6); h.tutCaster = true; h.maxHp = h.hp = 400; tut.ents.push(h); tut.ints = 0; }
  if (id === 'react') { tut.ents.push(G.spawnEnemy('dummy', -3, -6), G.spawnEnemy('dummy', 3, -6)); }
  if (id === 'done') { const room = G.room; room.doors = [{ x: 0, z: room.bounds.minZ - 0.6, type: 'combat', node: { type: 'combat' }, open: true, tutorial: true }]; H.R.buildDoor(room.doors[0], H.DEPTHS[1]); room.cleared = true; H.audio.play('clear'); G.milestone('first_steps'); H.save.tutorialDone = true; H.saveNow(); }
  G.emit('tutorial', { step: n });
};
G.tutEvent = function (kind, data) {
  const tut = G.tut; if (!tut) return; const id = G.TUT_STEPS[tut.step].id;
  if (id === 'cast' && kind === 'hit' && data.o && data.o.spell === 'cinder_bolt') { tut.hits++; if (tut.hits >= 3) G.tutAdvance(); }
  if (id === 'dash' && kind === 'dodge') { tut.dodges++; if (tut.dodges >= 2) G.tutAdvance(); }
  if (id === 'interrupt' && kind === 'interrupt') G.tutAdvance();
  if (id === 'react' && kind === 'reaction' && data.r === 'steam') G.tutAdvance();
};
G.tutAdvance = function () { const tut = G.tut; if (tut.advancing) return; tut.advancing = true; H.audio.play('reward'); G.emit('tutorialOk'); G.after(() => { if (!G.tut) return; tut.advancing = false; G.tutStep(tut.step + 1); }, 900); };
G.updateTutorial = function (dt) {
  const tut = G.tut; tut.t += dt; const id = G.TUT_STEPS[tut.step].id; const p = G.players[0];
  if (id === 'move' && tut.markPos && H.dist2(p.x, p.z, tut.markPos.x, tut.markPos.z) < 2.2 && !tut.advancing) G.tutAdvance();
  if (tut.mark) tut.mark.rotation.z += dt;
  if (id === 'dash' && tut.ents[0]) { const t = tut.ents[0]; const d = Math.hypot(p.x - t.x, p.z - t.z); if (d < 5.5 && p.dashT <= 0) { const [nx, nz] = H.norm(p.x - t.x, p.z - t.z || 1); p.x += nx * 7 * dt; p.z += nz * 7 * dt; G.collide(p); if (!tut.shoved) { tut.shoved = true; G.float(p.x, 2.4, p.z, 'TOO CLOSE: BACK OFF', 'small'); } } }
  // keep player healthy
  p.hp = Math.max(p.hp, 30);
  // override door to end tutorial
  if (id === 'done') { const d = G.room.doors[0]; if (d && Math.abs(p.x - d.x) < 1.4 && p.z < d.z + 1.6 && !tut.ended) { tut.ended = true; G.endRun(true); } }
};
