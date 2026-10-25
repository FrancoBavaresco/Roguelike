'use strict';
/* HEXWRIGHT — boot, frame loop, input routing, test bot */
(function () {
  const $ = s => document.querySelector(s);
  const STEP = 1 / 60;
  let last = performance.now(), acc = 0, fpsT = 0, frames = 0;

  /* Autoplay bot (used for self-playtesting; never shown to players) */
  H.bot = {
    think(p) {
      const G = H.G; const it = { mx: 0, mz: 0, aimX: 0, aimZ: 0, aimMode: 'none', aimPt: null, held: {}, pressed: {}, released: {} };
      if (!G.room) return it;
      const room = G.room;
      const foes = G.enemies.filter(e => !e.dead && e.spawnK >= 1 && e.type !== 'dummy');
      let mx = 0, mz = 0;
      let danger = false;
      const skill = H.bot.skill != null ? H.bot.skill : 1;
      for (const t of G.tgs) {
        if (t.done) continue; const k = t.t / t.dur;
        if (t.botSeen == null) t.botSeen = Math.random() < skill; if (!t.botSeen || k < 0.25 * (1.2 - skill)) continue;
        if (G.inTelegraph(t, p.x, p.z, 0.9)) {
          danger = true;
          let ax = p.x - t.x, az = p.z - t.z;
          if (t.shape === 'rect') { const side = (p.x - t.x) * -t.o.dz + (p.z - t.z) * t.o.dx; const along = (p.x - t.x) * t.o.dx + (p.z - t.z) * t.o.dz; const toSide = t.o.w / 2 - Math.abs(side), toEnd = Math.min(along, t.o.len - along); if (toEnd < toSide) { const s = along < t.o.len / 2 ? -1 : 1; ax = t.o.dx * s; az = t.o.dz * s; } else { ax = -t.o.dz * Math.sign(side || 1); az = t.o.dx * Math.sign(side || 1); } }
          if (t.o.inner) { ax = -ax; az = -az; }
          const [nx, nz] = H.norm(ax, az); mx += nx * 2; mz += nz * 2;
          if (k > 0.72 && p.dashCharges > 0 && Math.random() < 0.5) it.pressed.dash = true;
        }
      }
      for (const pr of G.projs) {
        if (pr.team !== 1 || pr.dead) continue; if (pr.botSeen == null) pr.botSeen = Math.random() < skill; if (!pr.botSeen) continue; const dx = p.x - pr.x, dz = p.z - pr.z; const d = Math.hypot(dx, dz);
        if (d < 3.5 && (dx * pr.dx + dz * pr.dz) > 0) { mx += -pr.dz * 1.5; mz += pr.dx * 1.5; if (d < 1.6 && p.dashCharges > 0 && Math.random() < 0.3) it.pressed.dash = true; }
      }
      if (room.vents) for (const v of room.vents) if (v.state !== 'idle' && H.dist2(p.x, p.z, v.x, v.z) < (v.r + 1.5) ** 2) { const [nx, nz] = H.norm(p.x - v.x, p.z - v.z); mx += nx * 2; mz += nz * 2; }
      if (G.boss && G.boss.edge) { const ed = G.boss.edge; const d = Math.hypot(p.x - ed.cx, p.z - ed.cz); if (d > ed.r - 2) { const [nx, nz] = H.norm(ed.cx - p.x, ed.cz - p.z); mx += nx * 3; mz += nz * 3; } }
      let target = null, td = 1e9;
      for (const e of foes) { const d = H.dist2(p.x, p.z, e.x, e.z); if (d < td) { td = d; target = e; } }
      if (target) {
        const d = Math.sqrt(td); const [dx, dz] = H.norm(target.x - p.x, target.z - p.z);
        it.aimMode = 'dir'; it.aimX = dx; it.aimZ = dz;
        // stand-off distance: casters keep away; a melee basic attack (the Veteran's sword) has to close in to its reach
        const d0 = p.spells[0] && H.SPELLS[p.spells[0].id], melee = d0 && d0.kind === 'melee';
        const want = melee ? (d0.range || 2.9) * 0.6 + (target.r || 0.5) : target.boss ? 7 : 5.5;
        const band = melee ? [1, 0.6] : [1.5, 2];
        if (!danger) { if (d < want - band[0]) { mx -= dx; mz -= dz; } else if (d > want + band[1]) { mx += dx; mz += dz; } else { const s = (Math.floor(G.time / 2) % 2 ? 1 : -1); mx += -dz * s * 0.8; mz += dx * s * 0.8; } }
        if (p.ult && p.ult.cd <= 0 && G.enemiesNear(p.x, p.z, 5).length >= 3) it.pressed.ult = true;
        for (let i = 0; i < 4; i++) { const sp = p.spells[i]; if (!sp) continue; const st = H.spellStats(sp.id, sp.rank, p); if (sp.cd <= 0 && p.mana >= st.cost && Math.random() < 0.25) it.pressed['cast' + (i + 1)] = true; }
      } else if (!G.modal) {
        let goal = null;
        if (room.prop && room.prop.kind === 'descent' && room.prop.ready) goal = room.prop;
        else if (room.prop && !room.prop.used && room.prop.kind !== 'descent') goal = room.prop;
        else if (room.doors.some(d => d.open) && !(room.prop && room.prop.kind === 'descent')) { if (room.botDoor == null || !room.doors[room.botDoor]) room.botDoor = Math.floor(Math.random() * room.doors.length); const d = room.doors[room.botDoor]; goal = { x: d.x, z: d.z - 1 }; }
        if (goal) { const [dx, dz] = H.norm(goal.x - p.x, goal.z - p.z); mx += dx; mz += dz; }
      }
      // stuck nudge
      p._bt = (p._bt || 0) + 1; if (p._bt % 120 === 0) { if (p._lx != null && Math.hypot(p.x - p._lx, p.z - p._lz) < 0.5) { p._nudge = 40; p._nd = [Math.random() - .5, Math.random() - .5]; } p._lx = p.x; p._lz = p.z; }
      if (p._nudge > 0) { p._nudge--; mx += p._nd[0] * 3; mz += p._nd[1] * 3; }
      const l = Math.hypot(mx, mz); if (l > 0.01) { it.mx = mx / Math.max(1, l); it.mz = mz / Math.max(1, l); }
      return it;
    }
  };

  function routeInput() {
    const G = H.G; const I = H.input;
    if (I.pads.length) { for (const gp of I.pads) { const pr = I.padPressed[gp.index]; if ((pr && pr.some(x => x)) || Math.abs(gp.axes[0] || 0) > 0.5 || Math.abs(gp.axes[1] || 0) > 0.5 || Math.abs(gp.axes[2] || 0) > 0.5 || Math.abs(gp.axes[3] || 0) > 0.5) I.lastPad = gp.index; } }
    for (const p of G.players) {
      if (p.seatSrc === undefined) p.seatSrc = p.src;
      if (H.botMode) { p.src = 'bot'; p.intent = H.bot.think(p); continue; }
      const src = p.seatSrc === 'auto' ? H.UI.resolveAuto() : p.seatSrc;
      if (src !== p.src) { p.src = src; if (src === 'touch' || p._lastSrc === 'touch') H.UI.buildTouch(); p._lastSrc = src; }
      p.intent = I.readPlayer(src);
      // presses survive frames with no simulation step (high-refresh screens, hit-stop, slow-mo) until a step reads them
      const b = p._ibuf || (p._ibuf = { pressed: {}, released: {} });
      for (const k in p.intent.pressed) if (p.intent.pressed[k]) b.pressed[k] = true;
      for (const k in p.intent.released) if (p.intent.released[k]) b.released[k] = true;
      Object.assign(p.intent.pressed, b.pressed); Object.assign(p.intent.released, b.released);
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (H.manualTick) return;
    frame(dt, true);
  }
  H.tick = (dt, render) => frame(dt, render);
  function frame(dt, doRender) {
    const I = H.input; const G = H.G; const UI = H.UI;
    I.pollPads();
    const layersBefore = UI.layers.length;
    UI.updateNav(dt);
    let simDt = 0;
    if (G.active) {
      routeInput();
      const any = k => G.players.some(p => p.intent && p.intent.pressed[k]);
      // menu keys are handled here, once: never carry them over to later frames
      for (const p of G.players) if (p._ibuf) { delete p._ibuf.pressed.pause; delete p._ibuf.pressed.map; delete p._ibuf.pressed.inventory; }
      if (layersBefore === 0 && UI.layers.length === 0 && !G.modal) {
        if (any('pause')) UI.showPause();
        else if (any('map')) UI.toggleMap();
        else if (any('inventory')) UI.toggleInventory();
      } else if (UI.top() && UI.top().id === 'scr-pause' && G.players.some(p => p.intent && p.intent.padRef && p.intent.pressed.pause)) UI.top().back();
      if (G.active && !G.paused && !G.modal) {
        if (G.hitstop > 0) G.hitstop -= dt;
        else {
          acc += dt * G.timeScale(); let n = 0;
          while (acc >= STEP && n < 6) { G.step(STEP); acc -= STEP; n++; for (const p of G.players) { if (p.intent) { p.intent.pressed = {}; p.intent.released = {}; } p._ibuf = null; } if (!G.active || G.modal) break; }
          if (n >= 6) acc = 0;
          simDt = dt * G.timeScale();
        }
      }
      // while paused / in a menu / in a modal nothing is buffered: presses there belong to the UI
      if (!G.active || G.paused || G.modal || UI.layers.length) for (const p of G.players) p._ibuf = null;
    } else if (UI.showcase) { UI.updateShowcase(dt); simDt = dt; }
    if (G.active) H.views.sync(simDt); // models follow the simulation once per rendered frame
    H.R.update(dt, simDt);
    if (G.run && !$('#hud').hidden) UI.updateHud(dt);
    if (doRender) H.R.render();
    I.endFrame();
    if (H.settings.showFps) { frames++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' fps · ' + H.R.pCount + ' particles'; frames = 0; fpsT = 0; } }
  }

  function boot() {
    const bootEl = $('#boot');
    if (!window.THREE) { bootEl.textContent = /^es/i.test(navigator.language || '') ? 'No se pudo cargar el motor 3D. Revisa tu conexión y recarga.' : 'The 3D engine could not load. Check your connection and reload.'; return; }
    try {
      H.settings.lang = H.detectLang(); H.setLang(H.settings.lang);
      H.applyTextScale(); window.addEventListener('resize', H.applyTextScale);
      if (H.input.isTouchDevice) { $('#rotate').classList.add('need'); H.R.mobileZoom = 1.06; try { if (!localStorage.getItem('hexwright.save.v1')) H.settings.quality = 'medium'; } catch (e) { } }
      H.R.init($('#gl'));
      if (H.models) H.models.load().catch(() => { }); // .glb enemies; missing files fall back to prototypes
      $('#fps').hidden = !H.settings.showFps;
      bootEl.remove();
      H.UI.showTitle();
      requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });
    } catch (err) { console.error(err); bootEl.textContent = 'Something went wrong while starting: ' + err.message; }
  }
  // Recover gracefully if the tab is hidden mid-run
  document.addEventListener('visibilitychange', () => { if (document.hidden && H.G.active && !H.G.paused && !H.G.modal && !H.botMode) H.UI.showPause(); });
  window.addEventListener('gamepadconnected', e => H.UI && H.UI.toast && H.UI.toast(H.t('Gamepad connected: {n}', { n: (e.gamepad.id || '').split('(')[0].trim().slice(0, 32) })));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
