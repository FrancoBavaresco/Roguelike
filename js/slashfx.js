'use strict';
/* HEXWRIGHT — Theron's painted sword slash (view only).
   A hand-painted crescent in three layers (public/textures/fx/theron_slash_1..3.png, split from the painting
   art/theron_slash2.png by tools/slash_layers.py): 1 = the soft energy glow, 2 = the turquoise crystal blade of light,
   3 = the sparkles. They build up in that order (2 lands over 1, 3 over 2), then the whole slash fades together.

   Sync: the combat code bumps p.anim.swingN (each sword hit) or p.anim.twirlN (the whirls); the view plays the
   swing with m.swingT (1 → 0). A slash fires once per swing when the swing reaches CFG.swings[type].at (a fraction
   of the swing), and once at the start of each whirl. For Theron's swords this is the only attack effect: the
   energy ribbon (R.trail) steps aside, and the combat code skips its floor silhouettes and streaks
   (G.paintedSlash in game.js).

   Space: each slash sits in a frame on the hero's root, turned to his facing at the moment it fires, so it
   follows him while it fades but does not spin if he turns mid-swing.

   Resources: three textures and one plane geometry, shared; a small pool of slashes per hero, each with three
   meshes (one material each, so the layers fade independently). Nothing is created per frame; spare meshes are
   hidden, not freed. Nothing here touches damage, hitboxes, collisions or timings. Tune the look in R.slashCfg. */
(function () {
  const R = H.R, THREE = window.THREE;
  const CFG = R.slashCfg = {
    enabled: true,
    heroes: ['knight'],                 // Theron (the Veteran)
    weapons: ['sword', 'bastard'],      // item.weapon types that use it (axes keep their own arcs)
    // the three layers, bottom to top, and when each one appears (seconds after the slash fires)
    layers: [
      { url: 'public/textures/fx/theron_slash_1.png', at: 0.0 },    // 1: glow
      { url: 'public/textures/fx/theron_slash_2.png', at: 0.05 },   // 2: crystal, over the glow
      { url: 'public/textures/fx/theron_slash_3.png', at: 0.1 }     // 3: sparkles, over the crystal
    ],
    fadeIn: 0.035,                      // seconds each layer takes to appear
    fadeOutAt: 0.19,                    // all layers start fading together here…
    life: 0.32,                         // …and are gone here (seconds)
    opacity: 1.0,                       // peak opacity
    pivot: [212, 127],                  // pixel of the 512 px painting at the arc's centre of curvature (it sits on the hero)
    radiusPx: 185,                      // pixel radius of the arc's bright band, used to size the plane
    // per swing type: at (fraction of the swing when it fires), plane ('flat' = lying at blade height, 'up' = standing
    // in the plane of a top-down cut), radius (m from the hero to the bright band), y (height), fwd (m along the
    // facing), spin (in-plane turn in radians; the painting's arc leans 19° to one side, spin centres it), turn
    // (extra turn over its life, the sense of motion), lean (only 'up': 0 upright … 1 square to the camera),
    // scale0 → scale1 (growth over the life), stretch (forward/back scale, for the thrust), mirror (flip the painting)
    swings: {
      slash:  { at: 0.04, plane: 'flat', radius: 1.9, y: 1.0, fwd: 0.0, spin: -0.33, turn: 0.35, scale0: 0.88, scale1: 1.06, mirror: false },
      chop:   { at: 0.33, plane: 'up', radius: 1.35, y: 1.0, fwd: 0.2, spin: -0.5, turn: 0.45, lean: 0.55, scale0: 0.88, scale1: 1.04, mirror: false },
      thrust: { at: 0.3, plane: 'flat', radius: 1.5, y: 1.0, fwd: 0.6, spin: -0.33, turn: 0.0, scale0: 0.8, scale1: 1.1, stretch: 1.45, mirror: false },
      whirl:  { plane: 'flat', radius: 2.0, y: 0.9, fwd: 0.0, spin: -0.33, turn: 1.2, scale0: 0.85, scale1: 1.08, copies: 2, mirror: false }
    },
    big: 1.18                           // size multiplier on the combo finisher (m.swingBig)
  };

  let texs = null, geo = null, loadErr = false;
  function textures() {
    if (texs || loadErr) return texs;
    const L = new THREE.TextureLoader();
    texs = CFG.layers.map(l => { const t = L.load(l.url, undefined, undefined, () => { loadErr = true; console.warn('[slashfx] could not load', l.url); });
      t.encoding = THREE.sRGBEncoding;   // painted in sRGB; the renderer outputs sRGB
      t.anisotropy = Math.min(4, R.renderer ? R.renderer.capabilities.getMaxAnisotropy() : 1); return t; });
    return texs;
  }
  // a unit plane moved so the arc's centre of curvature is the origin (in-plane −y points through the middle of the arc)
  function geometry() {
    if (geo) return geo;
    geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0.5 - CFG.pivot[0] / 512, (CFG.pivot[1] / 512) - 0.5, 0);
    return geo;
  }

  const _f = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const POOL = 4;   // a whirl uses two at once
  function make(m) {
    const frame = new THREE.Group(), items = [], T = textures();
    for (let i = 0; i < POOL; i++) {
      const holder = new THREE.Group(), turner = new THREE.Group(), layers = [];
      CFG.layers.forEach((l, k) => {
        const mat = new THREE.MeshBasicMaterial({ map: T[k], transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, opacity: 0, toneMapped: false, fog: false });
        const mesh = new THREE.Mesh(geometry(), mat);
        mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.renderOrder = 6 + k; mesh.visible = false;
        turner.add(mesh); layers.push({ mesh, mat, at: l.at });
      });
      holder.add(turner); frame.add(holder);
      items.push({ holder, turner, layers, t: 0, life: 0, on: false, sw: null });
    }
    m.root.add(frame);
    return { frame, items, key: null, next: 0 };
  }

  // the item.weapon type Theron is holding ('sword', 'bastard', 'axe'…)
  function weaponType(p) {
    const id = p.equip && p.equip.weapon, it = id && H.ITEMS && H.ITEMS[id];
    return it ? it.weapon : (H.DEFAULT_WEAPON && H.DEFAULT_WEAPON[p.hero || p.kind] && H.ITEMS[H.DEFAULT_WEAPON[p.hero || p.kind]] || {}).weapon;
  }

  R.slashFx = {
    CFG,
    // is the painted slash in use for this hero and weapon? (game.js asks through G.paintedSlash)
    active(charId, weapon) { return CFG.enabled && !loadErr && CFG.heroes.indexOf(charId) >= 0 && CFG.weapons.indexOf(weapon) >= 0; },
    // does this model's current swing or whirl get the painted slash? (R.trail asks, so it steps aside)
    covers(m, p) {
      if (!CFG.enabled || loadErr || !m || !p || CFG.heroes.indexOf(m.kind) < 0 || CFG.weapons.indexOf(weaponType(p)) < 0) return false;
      if (m.twirlT > 0) return true;
      return !!(m.swing && CFG.swings[m.swing]);
    },
    update(m, p, dt) {
      if (!m.root) return;
      const S = m.slash;
      if (m.sword && m.sword.visible && R.slashFx.covers(m, p)) {
        // a whirl: once, as it starts; a swing: once, when it reaches its moment
        if (m.twirlT > 0) { const key = 'tw' + m._twirlN; if (!S || S.key !== key) R.slashFx.fire(m, key, CFG.swings.whirl); }
        else if (m.swingT > 0) { const c = CFG.swings[m.swing], key = 'sw' + m._swingN; if (1 - m.swingT >= c.at && (!S || S.key !== key)) R.slashFx.fire(m, key, c); }
      }
      if (S) R.slashFx.tick(S, dt);
    },
    fire(m, key, c) {
      const S = m.slash || (m.slash = make(m));
      S.key = key;
      const size = (c.radius / CFG.radiusPx) * 512 * (m.swingBig && key[0] === 's' ? CFG.big : 1);
      for (let n = 0; n < (c.copies || 1); n++) {
        const o = S.items[S.next]; S.next = (S.next + 1) % S.items.length;
        o.on = true; o.t = 0; o.life = CFG.life; o.sw = c; o.size = size;
        // the frame for this slash: the hero's facing now (forward is −z in a frame turned by m.vf); whirl copies spread around him
        const vf = (m.vf || 0) + n * 2 * Math.PI / (c.copies || 1), f = _f.set(-Math.sin(vf), 0, -Math.cos(vf));
        o.holder.position.set(f.x * c.fwd, c.y, f.z * c.fwd);
        if (c.plane === 'up') {
          // a top-down cut: the painting stands in a plane through the facing, its arc bowing forward. The plane rolls
          // about the facing toward the camera (c.lean: 0 = upright, 1 = square to the camera) so it never shows edge-on
          const cam = R.camera, d = _d.set(0, 0, -1); if (cam) cam.getWorldDirection(d);
          const side = _s.set(-f.z, 0, f.x); if (side.dot(d) > 0) side.negate();          // the side facing the camera
          const nn = _n.copy(d).addScaledVector(f, -d.dot(f)).negate(); if (nn.lengthSq() < 1e-4) nn.copy(side); nn.normalize();
          nn.multiplyScalar(c.lean).addScaledVector(side, 1 - c.lean).normalize();
          const u = _u.crossVectors(nn, f).normalize();
          _q.setFromRotationMatrix(_m.makeBasis(f, u, nn));
          S.frame.getWorldQuaternion(_pq); o.holder.quaternion.copy(_pq.invert().multiply(_q));
          o.turner.rotation.set(0, 0, Math.PI / 2);   // in-plane: the arc's middle (−y in the painting) → the facing
        } else {
          // lying flat at blade height, its arc bowing toward the facing
          o.holder.rotation.set(0, vf, 0);
          o.turner.rotation.set(Math.PI / 2, 0, 0);
        }
        o.dir = c.mirror ? -1 : 1;
        for (const L of o.layers) { L.mesh.visible = false; L.mat.opacity = 0; }
        R.slashFx.pose(o);
      }
    },
    pose(o) {
      const c = o.sw, k = Math.min(1, o.t / o.life);
      const e = 1 - Math.pow(1 - k, 2), s = o.size * (c.scale0 + (c.scale1 - c.scale0) * e);
      const out = o.t < CFG.fadeOutAt ? 1 : Math.pow(Math.max(0, 1 - (o.t - CFG.fadeOutAt) / (CFG.life - CFG.fadeOutAt)), 1.2);
      for (const L of o.layers) {
        L.mesh.scale.set(s * o.dir, s * (c.stretch || 1), 1);
        L.mesh.rotation.z = (c.spin + c.turn * (e - 0.5)) * o.dir;
        const inK = Math.max(0, Math.min(1, (o.t - L.at) / CFG.fadeIn));
        L.mat.opacity = CFG.opacity * inK * out;
        L.mesh.visible = L.mat.opacity > 0.003;
      }
    },
    tick(S, dt) {
      for (const o of S.items) {
        if (!o.on) continue;
        o.t += dt;
        if (o.t >= o.life) { o.on = false; for (const L of o.layers) { L.mesh.visible = false; L.mat.opacity = 0; } continue; }
        R.slashFx.pose(o);
      }
    },
    // hide every slash at once (death, room change); the meshes stay for reuse
    clear(m) { const S = m && m.slash; if (!S) return; for (const o of S.items) { o.on = false; for (const L of o.layers) { L.mesh.visible = false; L.mat.opacity = 0; } } S.key = null; },
    // free the pool (the shared textures and geometry stay)
    dispose(m) { const S = m && m.slash; if (!S) return; for (const o of S.items) for (const L of o.layers) L.mat.dispose(); if (S.frame.parent) S.frame.parent.remove(S.frame); m.slash = null; },
    preload() { if (CFG.enabled) textures(); }
  };
})();
