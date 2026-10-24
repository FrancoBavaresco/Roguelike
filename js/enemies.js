'use strict';
/* HEXWRIGHT — enemy AI, attacks and the three Wardens */
const AI = H.AI = {};
const G_ = () => H.G;

function steer(e, tx, tz, mul = 1, away = false, strafe = 0) {
  const G = G_(); const room = G.room;
  let [dx, dz] = H.norm(tx - e.x, tz - e.z);
  if (away) { dx = -dx; dz = -dz; }
  if (strafe) { const sx = -dz * strafe, sz = dx * strafe; dx = dx * 0.4 + sx; dz = dz * 0.4 + sz; }
  const obs = e.flying ? room.pillars : room.pillars.concat(room.pits);
  for (const p of obs) { const ox = e.x - p.x, oz = e.z - p.z; const d = Math.hypot(ox, oz) || 0.01; const m = p.r + e.r + 0.8; if (d < m + 1.6) { const w = (m + 1.6 - d) / 1.6; dx += ox / d * w * 1.3; dz += oz / d * w * 1.3; } }
  // keep off the walls (the room may be a hall with annexes): lean toward the nearest point 2 m inside
  if (!G.inRoom(e.x, e.z, 2)) { const c = G.clampToRoom(e.x, e.z, 2); const [wx, wz] = H.norm(c.x - e.x, c.z - e.z); dx += wx; dz += wz; }
  [dx, dz] = H.norm(dx, dz);
  e.vx = dx * e.speed * mul; e.vz = dz * e.speed * mul;
}
function faceTo(e, tx, tz, dt, rate = 10) { const a = Math.atan2(-(tx - e.x), -(tz - e.z)); e.faceAng += H.angDiff(a, e.faceAng) * Math.min(1, dt * rate); }
function fwd(e) { return [-Math.sin(e.faceAng), -Math.cos(e.faceAng)]; }
function haste(e) { return (e.elite === 'hasted' ? 0.75 : 1) * (G_().tut ? 1 : H.ENEMY_TEMPO); }
function begin(e, atk) {
  const ai = e.ai; ai.state = 'windup'; ai.atk = atk; ai.t = 0; ai.dur = atk.windup * haste(e) * (e.enraged ? 0.85 : 1); e.chanDmg = 0; ai.tg = null;
  if (atk.start) atk.start(e, ai.dur);
  if (!atk.silent) H.audio.play('telegraph');
}
function dirTo(e, t) { return H.norm(t.x - e.x, t.z - e.z); }
const dmgOf = (e, base) => Math.round(base * e.dmgMul * (G_().tut ? 0.35 : 1));
function enemyBolt(e, dx, dz, o = {}) {
  H.G.fireProj(Object.assign({ team: 1, x: e.x + dx * (e.r + 0.3), z: e.z + dz * (e.r + 0.3), dx, dz, speed: 12, range: 18, r: 0.35, dmg: dmgOf(e, e.def.dmg), size: 0.42, srcName: e.def.name, ownerEnt: e }, o));
  H.audio.play('enemy_shot');
}

/* ---------------- Standard attacks ---------------- */
const ATK = {
  lunge: { windup: 0.6, recover: 0.6, cd: 1.3, start(e, dur) { const t = e.target; const [dx, dz] = dirTo(e, t); e.ai.dir = [dx, dz]; e.faceAng = Math.atan2(-dx, -dz); e.ai.tg = H.G.tg('rect', { x: e.x, z: e.z, dx, dz, w: 1.4, len: 3.8 }, dur, null, e); },
    fire(e) { const [dx, dz] = e.ai.dir; G_().hitPlayersIn(e.ai.tg, dmgOf(e, e.def.dmg), "a Husk's lunge", { by: e, knock: 6 }); e.kvx += dx * 16; e.kvz += dz * 16; H.R.burst(e.x + dx * 2, 0.4, e.z + dz * 2, 0xff4d6a, 10, 5, 0.3, 0.35, { dir: [dx, dz] }); } },
  bile: { windup: 0.65, recover: 0.4, cd: 2.0, start(e, dur) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; e.ai.tg = H.G.tg('rect', { x: e.x, z: e.z, dx, dz, w: 0.9, len: 12 }, dur, null, e); },
    during(e, dt) { if (e.ai.t < e.ai.dur * 0.5 && e.target) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; e.ai.tg.o.dx = dx; e.ai.tg.o.dz = dz; } e.ai.tg.x = e.x; e.ai.tg.z = e.z; faceTo(e, e.x + e.ai.dir[0], e.z + e.ai.dir[1], 1, 30); },
    fire(e) { const [dx, dz] = e.ai.dir; const spread = (G_().run && G_().run.depth >= 2) || e.elite ? [-0.22, 0, 0.22] : [0]; for (const s of spread) { const c = Math.cos(s), sn = Math.sin(s); enemyBolt(e, dx * c - dz * sn, dx * sn + dz * c, { speed: 13, slow: 1.2, srcName: 'Bile Spitter bile' }); } } },
  burst: { windup: 0.75, recover: 0, cd: 0, start(e, dur) { e.ai.tg = H.G.tg('circle', { x: e.x, z: e.z, r: 2.4 }, dur, null, e); e.vx = e.vz = 0; },
    during(e) { e.vx *= 0.5; e.vz *= 0.5; e.ai.tg.x = e.x; e.ai.tg.z = e.z; },
    fire(e) { G_().hitPlayersIn(e.ai.tg, dmgOf(e, e.def.dmg), 'a Cinder Wisp explosion', { by: e, knock: 7 }); H.R.burst(e.x, 1, e.z, 0xff2e55, 40, 9, 0.5, 0.5, { palette: [0xff2e55, 0xffd27a] }); H.R.ring(e.x, e.z, 0xff2e55, 0.5, 2.4, 0.3); H.R.flash(e.x, e.z, 0xff2e55, 3, 0.2); H.audio.play('explode'); H.R.shake(0.15); e.selfDestruct = true; } },
  curse: { windup: 1.5, recover: 0.6, cd: 3.2, channel: true, start(e, dur) { e.vx = e.vz = 0; },
    fire(e) { const G = G_(); const targets = G.players.filter(p => !p.dead && !p.downed); const pts = []; for (const p of targets) { pts.push([p.x + p.vx * 0.45, p.z + p.vz * 0.45]); } while (pts.length < 3) { const p = H.pick(targets) || { x: 0, z: 0 }; pts.push([p.x + H.rand(-4, 4), p.z + H.rand(-4, 4)]); }
      for (const [x, z] of pts) { const tg = G.tg('circle', { x, z, r: 2.1, color: 0xc070ff }, 0.95, (t) => { G.hitPlayersIn(t, dmgOf(e, e.def.dmg), 'a Hexcaster curse', { by: e }); H.R.burst(t.x, 0.5, t.z, 0xb36bff, 25, 6, 0.5, 0.45, { up: 4 }); H.R.ring(t.x, t.z, 0xd7a6ff, 0.3, 2.1, 0.3); H.audio.play('cast_void'); }, null); tg.persist = true; } } },
  bash: { windup: 0.7, recover: 0.6, cd: 1.8, start(e, dur) { const [dx, dz] = fwd(e); e.ai.dir = [dx, dz]; e.ai.tg = H.G.tg('cone', { x: e.x, z: e.z, r: 3.3, angle: 0.55, dx, dz }, dur, null, e); },
    during(e) { e.ai.tg.x = e.x; e.ai.tg.z = e.z; e.vx *= 0.3; e.vz *= 0.3; },
    fire(e) { G_().hitPlayersIn(e.ai.tg, dmgOf(e, e.def.dmg), "a Gaol Warden's shield bash", { by: e, knock: 9 }); const [dx, dz] = e.ai.dir; e.kvx += dx * 8; e.kvz += dz * 8; H.R.shake(0.1); H.audio.play('hit', { heavy: true }); } },
  charge: { windup: 0.95, recover: 0.5, cd: 4, start(e, dur) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; e.faceAng = Math.atan2(-dx, -dz); e.ai.tg = H.G.tg('rect', { x: e.x, z: e.z, dx, dz, w: 2.3, len: 14 }, dur, null, e); H.audio.play('roar'); },
    during(e) { e.vx = e.vz = 0; },
    fire(e) { e.ai.state = 'charging'; e.ai.t = 0; e.ai.hit = new Set(); } },
  slam: { windup: 0.85, recover: 0.8, cd: 2.5, start(e, dur) { e.ai.tg = H.G.tg('circle', { x: e.x, z: e.z, r: 3.1 }, dur, null, e); e.vx = e.vz = 0; },
    fire(e) { G_().hitPlayersIn(e.ai.tg, dmgOf(e, e.def.dmg * 0.8), "a Chain Brute's slam", { by: e, knock: 8 }); H.R.ring(e.x, e.z, 0xdca16a, 0.5, 3.2, 0.3); H.R.burst(e.x, 0.3, e.z, 0x8e5b4d, 30, 7, 0.5, 0.5, { flat: true, grav: 9 }); H.R.shake(0.25); H.audio.play('slam'); } },
  summon: { windup: 2.2, recover: 0.5, cd: 6.5, channel: true, start(e) { e.vx = e.vz = 0; },
    during(e, dt) { if (Math.random() < dt * 20) H.R.emit(e.x + H.rand(-1, 1), 0.2, e.z + H.rand(-1, 1), 0, 3, 0, 0.6, 0.3, 0, 0xff9a52, 1, 0, 1); },
    fire(e) { const G = G_(); for (let i = 0; i < 2; i++) { const a = Math.random() * 7; const x = e.x + Math.cos(a) * 2, z = e.z + Math.sin(a) * 2; if (!G.blocked(x, z, 0.5)) G.queueSpawn({ type: 'wisp' }, x, z, 0.5); } } },
  toss: { windup: 0.5, recover: 0.4, cd: 3, start(e, dur) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; },
    fire(e) { const [dx, dz] = dirTo(e, e.target); enemyBolt(e, dx, dz, { speed: 6, homing: 1.6, range: 20, dmg: dmgOf(e, 9), srcName: "a Candle Abbess's flame" }); } },
  pounce: { windup: 0.75, recover: 0.55, cd: 2.6, start(e, dur) {
      const t = e.target; const [dx, dz] = dirTo(e, t); const d = Math.min(7, Math.hypot(t.x - e.x, t.z - e.z) + 0.6);
      e.ai.dir = [dx, dz]; e.ai.land = [e.x + dx * d, e.z + dz * d]; e.faceAng = Math.atan2(-dx, -dz); e.vx = e.vz = 0; e.animEvt = 'windup';
      e.ai.tg = H.G.tg('circle', { x: e.ai.land[0], z: e.ai.land[1], r: 1.7 }, dur, null, e); },
    during(e) { e.vx *= 0.3; e.vz *= 0.3; },
    fire(e) { const G = G_(); const [lx, lz] = e.ai.land; e.animEvt = 'attack';
      if (!G.blocked(lx, lz, e.r)) { e.x = lx; e.z = lz; }
      G.hitPlayersIn(e.ai.tg, dmgOf(e, e.def.dmg), "a Bone Stalker's pounce", { by: e, knock: 7 });
      H.R.burst(e.x, 0.3, e.z, 0xcfc4ae, 18, 5, 0.4, 0.4, { flat: true }); H.R.ring(e.x, e.z, 0xff2e55, 0.3, 1.7, 0.25); H.audio.play('hit', { heavy: true }); H.R.shake(0.08); } },
  lance: { windup: 0.85, recover: 0.6, cd: 3.2, start(e, dur) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; e.ai.tg = H.G.tg('rect', { x: e.x, z: e.z, dx, dz, w: 1.0, len: 16, color: 0x8a6bff }, dur, null, e); },
    fire(e) { G_().hitPlayersIn(e.ai.tg, dmgOf(e, e.def.dmg), 'a Hollow Echo lance', { by: e }); lanceFx(e.x, e.z, e.ai.dir[0], e.ai.dir[1], 16); } },
  throwT: { windup: 0.6, recover: 0.2, cd: 1.5, silent: true, start(e, dur) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; e.ai.tg = H.G.tg('rect', { x: e.x, z: e.z, dx, dz, w: 0.8, len: 10 }, dur, null, e); },
    fire(e) { const [dx, dz] = e.ai.dir; enemyBolt(e, dx, dz, { speed: 9, dmg: 4, srcName: 'a training bolt' }); } }
};
function lanceFx(x, z, dx, dz, len) {
  H.R.bolt(x, 1.2, z, x + dx * len, 1.2, z + dz * len, 0xb08cff, 2);
  for (let i = 0; i < 20; i++) { const k = Math.random() * len; H.R.emit(x + dx * k, 1.2, z + dz * k, (Math.random() - .5) * 2, Math.random() * 2, (Math.random() - .5) * 2, 0.5, 0.5, 0, H.pick([0x6ff0e0, 0xb08cff]), 1, 0, 2); }
  H.R.shake(0.1); H.audio.play('cast_void');
}

/* ---------------- Init / update ---------------- */
AI.init = function (e) {
  if (e.boss) BOSS[e.type].init(e);
};
AI.update = function (e, dt) {
  const G = G_(); const ai = e.ai;
  e.target = G.enemyTarget(e);
  if (e.boss) { AI.bossUpdate(e, dt); return; }
  if (ai.state === 'spawn') { ai.t -= dt; if (ai.t <= 0) ai.state = 'chase'; return; }
  const t = e.target; if (!t) { e.vx *= 0.9; e.vz *= 0.9; return; }
  const d = Math.hypot(t.x - e.x, t.z - e.z);
  if (ai.state === 'windup') {
    ai.t += dt; e.windupK = Math.min(1, ai.t / ai.dur);
    e.vx *= 0.7; e.vz *= 0.7;
    if (ai.atk.during) ai.atk.during(e, dt);
    if (ai.t >= ai.dur) { const atk = ai.atk; ai.state = 'recover'; ai.t = atk.recover * haste(e); e.windupK = 0; ai.cd = atk.cd * haste(e) * H.rand(0.85, 1.2); atk.fire(e); if (e.selfDestruct) G.kill(e, {}); }
    return;
  }
  if (ai.state === 'charging') {
    const [dx, dz] = ai.dir; e.vx = dx * 20; e.vz = dz * 20; ai.t += dt; faceTo(e, e.x + dx, e.z + dz, dt, 30);
    if (Math.random() < 0.8) H.R.emit(e.x, 0.3, e.z, -dx * 3 + H.rand(-1, 1), 1, -dz * 3 + H.rand(-1, 1), 0.5, 0.6, 0.1, 0x6a5040, 0.8, 2, 1);
    for (const p of G.players) if (!p.dead && !p.downed && !ai.hit.has(p) && H.dist2(p.x, p.z, e.x, e.z) < (e.r + p.r + 0.3) ** 2) { ai.hit.add(p); if (p.iframes > 0) { G.float(p.x, 2.2, p.z, 'DODGE', 'small good'); G.run.dodges++; } else G.hurtPlayer(p, dmgOf(e, e.def.dmg), "a Chain Brute's charge", { by: e, kx: dx, kz: dz, knock: 10 }); }
    let wall = !G.inRoom(e.x, e.z, e.r + 0.2);
    for (const p of G.room.pillars) if (H.dist2(e.x, e.z, p.x, p.z) < (p.r + e.r + 0.25) ** 2) wall = true;
    if (wall) { ai.state = 'recover'; ai.t = 0.2; e.vx = e.vz = 0; e.stunT = 2.4; e.brute_stunned = true; G.float(e.x, 3, e.z, 'STUNNED', 'big interrupt'); H.R.shake(0.4); H.audio.play('slam'); H.R.burst(e.x, 1, e.z, 0xffe45c, 25, 6, 0.6, 0.4); return; }
    if (ai.t > 0.75) { ai.state = 'recover'; ai.t = 0.6; e.vx = e.vz = 0; }
    return;
  }
  if (ai.state === 'recover') { ai.t -= dt; e.vx *= 0.8; e.vz *= 0.8; if (ai.t <= 0) ai.state = 'chase'; return; }
  ai.cd -= dt;
  // chase behaviours
  const type = e.type;
  if (e.tutCaster) { e.vx = e.vz = 0; faceTo(e, t.x, t.z, dt); if (ai.cd <= 0) begin(e, Object.assign({}, ATK.curse, { windup: 2.6 })); return; }
  if (e.tutTurret) { faceTo(e, t.x, t.z, dt); if (ai.cd <= 0 && d > 4.5) begin(e, ATK.throwT); return; }
  if (type === 'dummy' || type === 'turret') { e.vx = e.vz = 0; return; }
  if (type === 'husk') { faceTo(e, t.x, t.z, dt); steer(e, t.x, t.z, 1); if (d < 3.4 && ai.cd <= 0) begin(e, ATK.lunge); }
  else if (type === 'spitter') { faceTo(e, t.x, t.z, dt); if (d < 6) steer(e, t.x, t.z, 1, true); else if (d > 10) steer(e, t.x, t.z, 1); else steer(e, t.x, t.z, 0.6, false, e.uid % 2 ? 1 : -1); if (d < 13 && ai.cd <= 0) begin(e, ATK.bile); }
  else if (type === 'wisp') { faceTo(e, t.x, t.z, dt); steer(e, t.x, t.z, 1); if (d < 2.3) begin(e, ATK.burst); }
  else if (type === 'hexcaster') { faceTo(e, t.x, t.z, dt); if (d < 7) steer(e, t.x, t.z, 0.9, true); else if (d > 11) steer(e, t.x, t.z, 0.9); else steer(e, t.x, t.z, 0.5, false, e.uid % 2 ? 1 : -1); if (ai.cd <= 0 && d < 15) begin(e, ATK.curse); }
  else if (type === 'shieldbearer') { faceTo(e, t.x, t.z, dt, 2.2); steer(e, t.x, t.z, 1); if (d < 3 && ai.cd <= 0) begin(e, ATK.bash); }
  else if (type === 'brute') { faceTo(e, t.x, t.z, dt, 4); steer(e, t.x, t.z, 1); if (d < 3.2 && ai.cd <= 0) begin(e, ATK.slam); else if (d > 5 && d < 13 && ai.cd <= 0) begin(e, ATK.charge); }
  else if (type === 'bone_stalker') { faceTo(e, t.x, t.z, dt, 8); if (d > 6) steer(e, t.x, t.z, 1); else steer(e, t.x, t.z, 0.85, false, e.uid % 2 ? 1 : -1); if (ai.cd <= 0 && d < 8 && d > 2) begin(e, ATK.pounce); }
  else if (type === 'summoner') { faceTo(e, t.x, t.z, dt); if (d < 8) steer(e, t.x, t.z, 1, true); else if (d > 12) steer(e, t.x, t.z, 0.8); else steer(e, t.x, t.z, 0.4, false, 1); const wisps = G.enemies.filter(x => !x.dead && x.type === 'wisp').length; if (ai.cd <= 0) begin(e, wisps < 4 && Math.random() < 0.6 ? ATK.summon : ATK.toss); }
  else if (type === 'regent_echo') { faceTo(e, t.x, t.z, dt); if (d < 6) steer(e, t.x, t.z, 0.8, true); else steer(e, t.x, t.z, 0.5, false, e.uid % 2 ? 1 : -1); if (ai.cd <= 0) begin(e, ATK.lance); }
};
AI.onDeath = function (e) { if (e.boss) AI.cleanupBoss(e); };

/* ---------------- Boss framework ---------------- */
AI.bossUpdate = function (e, dt) {
  const G = G_(); const ai = e.ai; const B = BOSS[e.type];
  // hazards update even while staggered
  B.hazards && B.hazards(e, dt);
  if (ai.state === 'intro') { ai.t += dt; e.vx = e.vz = 0; if (e.target) faceTo(e, e.target.x, e.target.z, dt, 2); if (ai.t > 2.0) { ai.state = 'idle'; ai.t = 0.6; } return; }
  // stagger
  if (e.staggered) { e.staggerT -= dt; e.vx *= 0.8; e.vz *= 0.8; if (Math.random() < dt * 8) H.R.emit(e.x + H.rand(-1, 1), 4.5, e.z + H.rand(-1, 1), 0, 0.5, 0, 0.6, 0.35, 0, 0xffe45c, 1, 0, 1); if (e.staggerT <= 0) { e.staggered = false; e.stagger = 0; ai.state = 'idle'; ai.t = 0.4; } return; }
  if (e.stagger >= e.staggerMax) { e.staggered = true; e.staggerT = 3; G.cancelTelegraphs(e); ai.state = 'stag'; e.windupK = 0; G.float(e.x, 5.5, e.z, 'STAGGERED', 'big interrupt'); H.audio.play('interrupt'); H.R.shake(0.5); G.emit('bossStagger', { e }); return; }
  // phases
  const frac = e.hp / e.maxHp;
  for (const ph of B.phases) { if (e.phase < ph.n && frac <= ph.at) { e.phase = ph.n; G.cancelTelegraphs(e); ai.state = 'idle'; ai.t = 0.2; e.windupK = 0; G.emit('bossPhase', { e, phase: ph.n, text: ph.text }); H.audio.play('roar'); H.R.shake(0.5); H.R.ring(e.x, e.z, 0xff2e55, 1, 14, 0.9, 0.1, 1, 0.08); if (ph.enter) ph.enter(e); } }
  const t = e.target; if (!t) return;
  if (ai.state === 'windup') {
    ai.t += dt; e.windupK = Math.min(1, ai.t / ai.dur);
    if (ai.atk.during) ai.atk.during(e, dt); else { e.vx *= 0.8; e.vz *= 0.8; }
    if (ai.t >= ai.dur) { const atk = ai.atk; e.windupK = 0; atk.fire(e); if (atk.active) { ai.state = 'active'; ai.t = 0; ai.activeDur = atk.active; } else { ai.state = 'recover'; ai.t = atk.recover; } }
    return;
  }
  if (ai.state === 'active') { ai.t += dt; ai.atk.tick(e, dt); if (ai.t >= ai.activeDur) { ai.state = 'recover'; ai.t = ai.atk.recover; } return; }
  if (ai.state === 'recover') { ai.t -= dt; e.vx *= 0.85; e.vz *= 0.85; if (ai.t <= 0) { ai.state = 'idle'; ai.t = H.rand(0.35, 0.8) * (e.enraged ? 0.6 : 1); } return; }
  // idle: reposition then pick attack
  ai.t -= dt;
  const d = Math.hypot(t.x - e.x, t.z - e.z);
  B.move(e, t, d, dt);
  if (ai.t <= 0) { const atk = B.choose(e, t, d); if (atk) begin(e, atk); else ai.t = 0.3; }
};
function ringWave(e, x, z, speed, maxR, w, dmg, name, color = 0xff2e55) {
  (e.waves || (e.waves = [])).push({ x, z, r: 0.5, speed, maxR, w, dmg, name, hit: new Set(), color, mesh: null });
}
function updateWaves(e, dt) {
  const G = G_(); if (!e.waves) return; const THREE = window.THREE;
  for (const wv of e.waves) {
    wv.r += wv.speed * dt;
    if (wv.mesh) { H.R.fx.remove(wv.mesh); wv.mesh.geometry.dispose(); }
    if (!wv.mat) wv.mat = new THREE.MeshBasicMaterial({ color: wv.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    wv.mesh = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, wv.r - wv.w / 2), wv.r + wv.w / 2, 64), wv.mat); wv.mesh.rotation.x = -Math.PI / 2; wv.mesh.position.set(wv.x, 0.12, wv.z); H.R.fx.add(wv.mesh);
    wv.mat.opacity = 0.9 * (1 - wv.r / wv.maxR * 0.6);
    for (const p of G.players) { if (p.dead || p.downed || wv.hit.has(p)) continue; const d = Math.hypot(p.x - wv.x, p.z - wv.z); if (Math.abs(d - wv.r) < wv.w / 2 + p.r * 0.5) { wv.hit.add(p); if (p.iframes > 0) { G.float(p.x, 2.2, p.z, 'DODGE', 'small good'); G.run.dodges++; } else G.hurtPlayer(p, dmgOf(e, wv.dmg), wv.name, { by: e, kx: p.x - wv.x, kz: p.z - wv.z, knock: 5 }); } }
    if (Math.random() < 0.6) { const a = Math.random() * 7; H.R.emit(wv.x + Math.cos(a) * wv.r, 0.3, wv.z + Math.sin(a) * wv.r, 0, 2, 0, 0.3, 0.4, 0, wv.color, 1, 0, 1); }
    if (wv.r >= wv.maxR) { wv.dead = true; H.R.fx.remove(wv.mesh); wv.mesh.geometry.dispose(); wv.mat.dispose(); }
  }
  e.waves = e.waves.filter(w => !w.dead);
}
AI.cleanupBoss = function (e) { if (e.waves) for (const w of e.waves) if (w.mesh) H.R.fx.remove(w.mesh); e.waves = []; if (e.beams) for (const b of e.beams) H.R.removeMesh(b.mesh); e.beams = []; if (e.edge) H.R.removeMesh(e.edge.mesh); e.edge = null; };
function bossRange(e, t, d, near, far, dt) { if (d > far) steer(e, t.x, t.z, 1); else if (d < near) steer(e, t.x, t.z, 0.7, true); else steer(e, t.x, t.z, 0.4, false, e.strafe || 1); faceTo(e, t.x, t.z, dt, 4); }

const BOSS = {
  gaolwright: {
    init(e) { e.strafe = 1; e.cool = { sweep: 0, slam: 2, hook: 3, lock: 0 }; },
    phases: [{ n: 2, at: 0.55, text: 'The cells unlock', enter(e) { e.enraged = true; e.cool.lock = 0; spawnBeams(e); } }],
    move(e, t, d, dt) { bossRange(e, t, d, 3, 6, dt); for (const k in e.cool) e.cool[k] -= dt; },
    choose(e, t, d) {
      const c = e.cool;
      if (e.phase >= 2 && c.lock <= 0) { c.lock = 22; return GW.lock; }
      if (d < 8.5 && c.sweep <= 0) { c.sweep = 3.2; return GW.sweep; }
      if (c.slam <= 0 && d < 10) { c.slam = 6.5; return GW.slam; }
      if (d > 6 && c.hook <= 0) { c.hook = 5; return GW.hook; }
      if (d < 8.5) { c.sweep = 3; return GW.sweep; }
      return null;
    },
    hazards(e, dt) { updateWaves(e, dt); updateBeams(e, dt); if (e.dead) AI.cleanupBoss(e); }
  },
  kiln_saint: {
    init(e) { e.strafe = 1; e.cool = { rain: 1, spiral: 4, wave: 6, heart: 0, lava: 6, adds: 0 }; },
    phases: [{ n: 2, at: 0.6, text: 'The kiln wakes', enter(e) { e.cool.heart = 2; e.lavaOn = true; } }, { n: 3, at: 0.25, text: 'Mother of Cinders burns hotter', enter(e) { e.enraged = true; const G = G_(); G.queueSpawn({ type: 'spitter' }); G.queueSpawn({ type: 'spitter' }); } }],
    move(e, t, d, dt) { bossRange(e, t, d, 6, 11, dt); for (const k in e.cool) e.cool[k] -= dt; },
    choose(e, t, d) {
      const c = e.cool;
      if (e.phase >= 2 && c.heart <= 0) { c.heart = 20; return KS.heart; }
      if (c.rain <= 0) { c.rain = e.enraged ? 4.5 : 6; return KS.rain; }
      if (c.spiral <= 0) { c.spiral = 9; return KS.spiral; }
      if (c.wave <= 0 && d < 9) { c.wave = 7; return KS.wave; }
      if (d < 4 && c.wave <= 0) { c.wave = 7; return KS.wave; }
      return null;
    },
    hazards(e, dt) {
      updateWaves(e, dt); if (e.dead) { AI.cleanupBoss(e); return; }
      if (e.lavaOn && e.ai.state !== 'intro') { e.cool.lava -= dt; if (e.cool.lava <= 0) { e.cool.lava = e.enraged ? 6 : 8; lavaQuadrant(e); } }
    }
  },
  hollow_regent: {
    init(e) { e.strafe = 1; e.cool = { lance: 1, orbit: 5, blink: 3, echoes: 0, unmake: 4 }; },
    phases: [{ n: 2, at: 0.65, text: 'Echoes answer the crown', enter(e) { summonEchoes(e); e.cool.echoes = 18; } }, { n: 3, at: 0.3, text: 'The court collapses inward', enter(e) { e.enraged = true; startEdge(e); e.cool.unmake = 3; } }],
    move(e, t, d, dt) { bossRange(e, t, d, 5, 10, dt); for (const k in e.cool) e.cool[k] -= dt; if (e.phase >= 2 && e.cool.echoes <= 0 && !G_().enemies.some(x => !x.dead && x.type === 'regent_echo')) { e.cool.echoes = 18; summonEchoes(e); } },
    choose(e, t, d) {
      const c = e.cool;
      if (e.phase >= 3 && c.unmake <= 0) { c.unmake = 14; return HR.unmake; }
      if (c.blink <= 0 && (d > 9 || Math.random() < 0.3)) { c.blink = 6; return HR.blink; }
      if (c.lance <= 0) { c.lance = e.enraged ? 2.4 : 3.2; return HR.lance; }
      if (c.orbit <= 0) { c.orbit = 10; return HR.orbit; }
      return null;
    },
    hazards(e, dt) { updateWaves(e, dt); updateEdge(e, dt); if (e.dead) AI.cleanupBoss(e); }
  }
};

/* Gaolwright attacks */
const GW = {
  sweep: { windup: 0.95, recover: 0.7, start(e, dur) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; e.faceAng = Math.atan2(-dx, -dz); e.ai.tg = H.G.tg('cone', { x: e.x, z: e.z, r: 8.5, angle: 1.2, dx, dz }, dur, null, e); e.chainSpin = 0; },
    during(e, dt) { e.vx *= 0.5; e.vz *= 0.5; e.chainSpin = -e.windupK * 1.4; },
    fire(e) { G_().hitPlayersIn(e.ai.tg, 18, "the Gaolwright's chain", { by: e, knock: 10 }); const [dx, dz] = e.ai.dir; for (let i = 0; i < 40; i++) { const a = Math.atan2(dx, dz) + (Math.random() * 2 - 1) * 1.2, r = Math.random() * 8.5; H.R.emit(e.x + Math.sin(a) * r, 0.5, e.z + Math.cos(a) * r, Math.sin(a) * 3, 2, Math.cos(a) * 3, 0.4, 0.4, 0, 0xffd0d8, 0.8, 4, 1); } H.R.shake(0.3); H.audio.play('slam'); e.chainSpin = 1.6; G_().after(() => { e.chainSpin = null; }, 500); } },
  slam: { windup: 1.0, recover: 1.1, start(e, dur) { e.ai.tg = H.G.tg('circle', { x: e.x, z: e.z, r: 3.6 }, dur, null, e); },
    fire(e) { G_().hitPlayersIn(e.ai.tg, 20, "the Gaolwright's slam", { by: e, knock: 10 }); H.R.shake(0.5); H.audio.play('slam'); H.R.burst(e.x, 0.3, e.z, 0x6e6170, 50, 9, 0.6, 0.6, { flat: true, grav: 9 }); H.R.decal(e.x, e.z, 0xff2e55, 4, 3);
      ringWave(e, e.x, e.z, 9, 18, 0.8, 12, "the Gaolwright's shockwave"); G_().after(() => { if (!e.dead) ringWave(e, e.x, e.z, 9, 18, 0.8, 12, "the Gaolwright's shockwave"); }, 650); } },
  hook: { windup: 0.8, recover: 0.6, start(e, dur) { const [dx, dz] = dirTo(e, e.target); e.ai.dir = [dx, dz]; e.faceAng = Math.atan2(-dx, -dz); e.ai.tg = H.G.tg('rect', { x: e.x, z: e.z, dx, dz, w: 1.3, len: 16 }, dur, null, e); },
    fire(e) { const [dx, dz] = e.ai.dir; const G = G_(); for (const p of G.players) { if (p.dead || p.downed) continue; if (G.inTelegraph(e.ai.tg, p.x, p.z, p.r * 0.5)) { if (p.iframes > 0) { G.float(p.x, 2.2, p.z, 'DODGE', 'small good'); G.run.dodges++; continue; } G.hurtPlayer(p, 10, "the Gaolwright's hook", { by: e }); p.x = e.x + dx * (e.r + 1.5); p.z = e.z + dz * (e.r + 1.5); G.collide(p); p.slowT = 0.8; } } H.R.bolt(e.x, 1.4, e.z, e.x + dx * 16, 1, e.z + dz * 16, 0xb0a8a0, 2); H.audio.play('block'); } },
  lock: { windup: 2.6, recover: 0.8, channel: true, start(e) { e.vx = e.vz = 0; },
    during(e, dt) { e.vx = e.vz = 0; if (Math.random() < dt * 30) { const a = Math.random() * 7; H.R.emit(e.x + Math.cos(a) * 3, 0.2, e.z + Math.sin(a) * 3, -Math.cos(a) * 2, 3, -Math.sin(a) * 2, 0.6, 0.4, 0, 0xff2e55, 1, 0, 1); } },
    fire(e) { const G = G_(); for (let i = 0; i < 4; i++) G.queueSpawn({ type: 'husk' }); G.float(e.x, 6, e.z, 'THE CELLS OPEN', 'big hurt'); H.audio.play('roar'); } }
};
function spawnBeams(e) {
  const THREE = window.THREE; e.beams = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const len = 13;
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, len), new THREE.MeshBasicMaterial({ color: 0xff2e55 })); chain.position.z = -len / 2; g.add(chain);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, len), new THREE.MeshBasicMaterial({ color: 0xff2e55, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.set(0, -0.5, -len / 2); g.add(glow);
    g.position.set(0, 0.6, 0); H.R.fx.add(g);
    e.beams.push({ ang: i * Math.PI, len, w: 0.9, mesh: g, cd: new Map(), warm: 2.5 });
  }
}
function updateBeams(e, dt) {
  if (!e.beams || !e.beams.length) return; const G = G_();
  const room = G.room; const cx = (room.bounds.minX + room.bounds.maxX) / 2, cz = (room.bounds.minZ + room.bounds.maxZ) / 2 + 1;
  for (const b of e.beams) {
    b.warm -= dt; b.ang += dt * (e.staggered ? 0.1 : 0.33);
    const dx = Math.sin(b.ang), dz = Math.cos(b.ang);
    b.mesh.position.set(cx, 0.6, cz); b.mesh.rotation.y = b.ang + Math.PI;
    b.mesh.children[0].material.opacity = b.warm > 0 ? 0.3 : 1; b.mesh.children[0].material.transparent = true;
    if (b.warm > 0) continue;
    for (const p of G.players) {
      if (p.dead || p.downed) continue;
      const px = p.x - cx, pz = p.z - cz; const along = px * dx + pz * dz; const side = Math.abs(px * dz - pz * dx);
      if (along > 0 && along < b.len && side < b.w / 2 + p.r * 0.6) { const last = b.cd.get(p) || 0; if (G.time - last > 1) { b.cd.set(p, G.time); if (p.iframes <= 0) G.hurtPlayer(p, 10, 'a rotating cell chain', { by: e, kx: dz, kz: -dx, knock: 5 }); } }
    }
    if (Math.random() < 0.4) { const k = Math.random() * b.len; H.R.emit(cx + dx * k, 0.6, cz + dz * k, 0, 1, 0, 0.3, 0.35, 0, 0xff2e55, 0.9, 0, 1); }
  }
}

/* Kiln Saint attacks */
const KS = {
  rain: { windup: 0.4, recover: 0.9, start(e) { e.vx = e.vz = 0; },
    fire(e) { const G = G_(); const ps = G.players.filter(p => !p.dead && !p.downed); const n = e.enraged ? 7 : 5;
      for (let i = 0; i < n; i++) { const p = ps[i % ps.length]; if (!p) break; const x = p.x + (i < ps.length ? p.vx * 0.5 : H.rand(-4.5, 4.5)), z = p.z + (i < ps.length ? p.vz * 0.5 : H.rand(-4.5, 4.5));
        G.after(() => { if (e.dead) return; const tg = G.tg('circle', { x, z, r: 1.8, color: 0xff7a2e }, 1.0, t => { G.hitPlayersIn(t, 14, 'falling cinders', { by: e, burn: true }); H.R.burst(t.x, 0.5, t.z, 0xff6a2b, 25, 6, 0.5, 0.5, { up: 4, palette: [0xff6a2b, 0xffd27a] }); H.R.flash(t.x, t.z, 0xff6a2b, 2, 0.2); H.audio.play('cast_ember'); const zz = G.addZone({ kind: 'firepool', team: 1, x: t.x, z: t.z, r: 1.5, dur: 2.2, tick: 0.5, dmg: 3, burn: false, color: 0xff6a2b, fx: 'fire', srcName: 'a cinder pool' }); }, null); tg.persist = true; }, i * 150); } } },
  spiral: { windup: 0.6, recover: 0.8, active: 2.2, start(e) { e.vx = e.vz = 0; e.spiralA = Math.random() * 7; },
    fire(e) { e.spiralT = 0; },
    tick(e, dt) { e.vx = e.vz = 0; e.spiralT -= dt; if (e.spiralT <= 0) { e.spiralT = e.enraged ? 0.11 : 0.15; const arms = e.enraged ? 3 : 2; for (let k = 0; k < arms; k++) { const a = e.spiralA + k * Math.PI * 2 / arms; enemyBolt(e, Math.cos(a), Math.sin(a), { speed: 8, range: 22, dmg: 9, srcName: "the Kiln Saint's spiral" }); } e.spiralA += 0.32; } } },
  wave: { windup: 1.0, recover: 0.9, start(e, dur) { e.ai.tg = H.G.tg('circle', { x: e.x, z: e.z, r: 3 }, dur, null, e); },
    fire(e) { G_().hitPlayersIn(e.ai.tg, 16, "the Kiln Saint's flare", { by: e, burn: true, knock: 8 }); ringWave(e, e.x, e.z, 8, 17, 0.9, 13, 'a molten wave', 0xff7a2e); H.R.shake(0.3); H.audio.play('explode'); H.R.burst(e.x, 1, e.z, 0xff6a2b, 50, 9, 0.6, 0.6, { palette: [0xff6a2b, 0xffd27a] }); } },
  heart: { windup: 2.5, recover: 0.6, channel: true, start(e) { e.vx = e.vz = 0; },
    during(e, dt) { e.vx = e.vz = 0; if (Math.random() < dt * 40) { const a = Math.random() * 7; H.R.emit(e.x + Math.cos(a) * 4, 0.3, e.z + Math.sin(a) * 4, -Math.cos(a) * 6, 2, -Math.sin(a) * 6, 0.6, 0.5, 0, 0xffd27a, 1, 0, 0.5); } },
    fire(e) { const heal = Math.round(e.maxHp * 0.06); e.hp = Math.min(e.maxHp, e.hp + heal); H.G.float(e.x, 6, e.z, '+' + heal, 'big good'); H.audio.play('heal'); H.R.ring(e.x, e.z, 0xffd27a, 0.5, 5, 0.6); } }
};
function lavaQuadrant(e) {
  const G = G_(); const room = G.room; const b = room.bounds; const THREE = window.THREE;
  const qs = [[0, 0], [1, 0], [0, 1], [1, 1]];
  let q = qs[Math.floor(Math.random() * 4)];
  // prefer the quadrant with most players, but never the one the boss had last
  const occ = qs.map(([qx, qz]) => G.players.filter(p => !p.dead && (p.x > (b.minX + b.maxX) / 2) === !!qx && (p.z > (b.minZ + b.maxZ) / 2) === !!qz).length);
  const best = occ.indexOf(Math.max(...occ)); if (best >= 0 && Math.random() < 0.7 && best !== e.lastQ) q = qs[best];
  e.lastQ = qs.indexOf(q);
  const W = (b.maxX - b.minX) / 2, D = (b.maxZ - b.minZ) / 2;
  const x0 = b.minX + q[0] * W, z0 = b.minZ + q[1] * D;
  const cx = x0 + W / 2, cz = z0 + D / 2;
  const tg = G.tg('rect', { x: cx, z: z0 + D, dx: 0, dz: -1, w: W, len: D, color: 0xff7a2e }, 2.0, () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(cx, 0.07, cz); H.R.fx.add(mesh);
    const z = G.addZone({ kind: 'lava', team: 1, x: cx, z: cz, w: W, d: D, r: 0, dur: 3.5, tick: 0.5, dmg: 5, burn: false, fx: 'lava', color: 0xff5a1f, srcName: 'molten floor', hurtsEnemies: true });
    if (z.mesh) H.R.removeMesh(z.mesh); z.mesh = null; z.onEnd = () => H.R.removeMesh(mesh);
    H.audio.play('explode'); H.R.shake(0.2);
  }, null);
  tg.persist = true;
}

/* Hollow Regent attacks */
const HR = {
  lance: { windup: 0.9, recover: 0.6, start(e, dur) { const [dx, dz] = dirTo(e, e.target); const base = Math.atan2(dx, dz); e.ai.lances = []; const spread = e.enraged ? [-0.42, -0.21, 0, 0.21, 0.42] : [-0.3, 0, 0.3];
      for (const s of spread) { const a = base + s; const tg = H.G.tg('rect', { x: e.x, z: e.z, dx: Math.sin(a), dz: Math.cos(a), w: 1.0, len: 19, color: 0x8a6bff }, dur, null, e); e.ai.lances.push(tg); } },
    fire(e) { const G = G_(); for (const tg of e.ai.lances) { G.hitPlayersIn(tg, 16, "the Regent's void lance", { by: e }); lanceFx(tg.x, tg.z, tg.o.dx, tg.o.dz, 19); } } },
  orbit: { windup: 0.7, recover: 0.8, active: 2.4, start(e) { e.vx = e.vz = 0; e.spiralA = 0; },
    fire(e) { e.spiralT = 0; },
    tick(e, dt) { e.vx = e.vz = 0; e.spiralT -= dt; if (e.spiralT <= 0) { e.spiralT = 0.16; for (let k = 0; k < 4; k++) { const a = e.spiralA + k * Math.PI / 2; enemyBolt(e, Math.cos(a), Math.sin(a), { speed: 7.5, range: 22, dmg: 10, srcName: "the Regent's orbit" }); } e.spiralA += 0.21 * (e.enraged ? -1 : 1); } } },
  blink: { windup: 0.85, recover: 0.8, start(e, dur) { const G = G_(); const t = e.target; let x = t.x, z = t.z; const a = Math.random() * 7; x += Math.cos(a) * 3.5; z += Math.sin(a) * 3.5; const b = G.room.bounds; x = H.clamp(x, b.minX + 2, b.maxX - 2); z = H.clamp(z, b.minZ + 2, b.maxZ - 2);
      H.R.burst(e.x, 2, e.z, 0x6ff0e0, 40, 8, 0.5, 0.5); e.x = x; e.z = z; H.R.burst(e.x, 2, e.z, 0x6ff0e0, 40, 8, 0.5, 0.5); H.audio.play('cast_void'); e.ai.tg = G.tg('circle', { x, z, r: 3.3, color: 0x8a6bff }, dur, null, e); },
    during(e) { e.vx = e.vz = 0; },
    fire(e) { G_().hitPlayersIn(e.ai.tg, 20, "the Regent's descent", { by: e, knock: 10 }); H.R.ring(e.x, e.z, 0x6ff0e0, 0.5, 3.4, 0.3); H.R.shake(0.4); H.audio.play('slam'); H.R.burst(e.x, 0.3, e.z, 0x6ff0e0, 40, 8, 0.6, 0.5, { flat: true }); } },
  unmake: { windup: 3.0, recover: 1.0, channel: true, start(e, dur) { e.ai.tg = H.G.tg('circle', { x: e.x, z: e.z, r: 16, inner: 3.6 / 16, color: 0x8a6bff }, dur, null, e); },
    during(e, dt) { e.vx = e.vz = 0; e.ai.tg.x = e.x; e.ai.tg.z = e.z; },
    fire(e) { G_().hitPlayersIn(e.ai.tg, 34, 'Unmaking', { by: e, knock: 6, inflict: 'flay' }); H.R.ring(e.x, e.z, 0xb08cff, 3.6, 16, 0.6, 0.1, 1, 0.1); H.R.flash(e.x, e.z, 0x8a6bff, 6, 0.5); H.R.shake(0.6); H.audio.play('explode'); } }
};
function summonEchoes(e) { const G = G_(); const b = G.room.bounds; G.queueSpawn({ type: 'regent_echo' }, b.minX + 5, (b.minZ + b.maxZ) / 2, 1.0); G.queueSpawn({ type: 'regent_echo' }, b.maxX - 5, (b.minZ + b.maxZ) / 2, 1.0); }
function startEdge(e) {
  const THREE = window.THREE; const G = G_(); const b = G.room.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ color: 0x8a6bff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(cx, 0.1, cz); H.R.fx.add(mesh);
  e.edge = { cx, cz, r: 19, target: 9.5, mesh, tick: 0 };
}
function updateEdge(e, dt) {
  const ed = e.edge; if (!ed) return; const G = G_();
  ed.r = Math.max(ed.target, ed.r - dt * 1.2);
  ed.mesh.scale.setScalar(ed.r);
  if (Math.random() < 0.9) { const a = Math.random() * 7, rr = ed.r + Math.random() * 6; H.R.emit(ed.cx + Math.cos(a) * rr, 0.2, ed.cz + Math.sin(a) * rr, 0, 1.5, 0, 0.8, 0.6, 0.1, H.pick([0x8a6bff, 0x1a1030]), 0.8, 0, 1); }
  ed.tick -= dt;
  if (ed.tick <= 0) { ed.tick = 0.5; for (const p of G.players) { if (p.dead || p.downed) continue; if (Math.hypot(p.x - ed.cx, p.z - ed.cz) > ed.r) G.hurtPlayer(p, 6, 'the encroaching void', { dot: true }); } }
}
