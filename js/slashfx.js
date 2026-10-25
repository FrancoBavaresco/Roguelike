'use strict';
/* HEXWRIGHT — Theron's painted sword slash (view only).
   A hand-painted crescent (public/textures/fx/theron_slash.png, painted in Krita; source in art/theron_slash.kra)
   flashes on a textured plane when one of Theron's sword swings starts cutting.

   Sync: the same per-swing keys the energy ribbon uses (R.trail): the combat code bumps p.anim.swingN, the view
   plays the swing with m.swingT (1 → 0), and the slash fires once when the swing enters its active phase
   (R.trailCfg.phases). For the swings listed in CFG.swings the textured slash takes the place of the ribbon, so
   a hit never shows two arcs at once; every other swing (thrust streak, axe, whirl) keeps its existing effect.

   Space: each slash sits in a frame on the hero's root, turned to his facing at the moment it fires, so it
   follows him while it fades but does not spin if he turns mid-swing.

   Resources: one texture, one plane geometry and a small pool of meshes per hero (each with its own material
   so their opacities fade independently). Nothing is created per frame; spare meshes are hidden, not freed.
   Nothing here touches damage, hitboxes, collisions or timings. Tune the look in R.slashCfg. */
(function () {
  const R = H.R, THREE = window.THREE;
  const CFG = R.slashCfg = {
    enabled: true,
    url: 'public/textures/fx/theron_slash.png',
    heroes: ['knight'],                 // Theron (the Veteran)
    weapons: ['sword', 'bastard'],      // item.weapon types that use it (axes keep their own arcs)
    life: 0.2,                          // seconds on screen (fade-in + fade-out)
    fadeIn: 0.15,                       // fraction of the life spent fading in
    opacity: 1.0,                       // peak opacity
    pivot: [215, 160],                  // pixel of the 512 px texture at the arc's centre of curvature (it sits on the hero)
    radiusPx: 170,                      // pixel radius of the arc's bright band, used to size the plane
    // per swing type: radius (m from the hero to the bright band), y (height above the floor), fwd (m along the
    // facing), spin (in-plane turn in radians at fire time; for 'up', + tips the arc's middle upward), lean (only 'up') and turn (extra turn over its life, the sense of motion),
    // scale0 → scale1 (growth over the life), mirror (flip the painting for swings that run the other way)
    swings: {
      slash: { plane: 'flat', radius: 1.9, y: 1.0, fwd: 0.0, spin: 0.0, turn: 0.35, scale0: 0.86, scale1: 1.06, mirror: false },
      chop:  { plane: 'up',   radius: 1.35, y: 1.0, fwd: 0.2, spin: -0.2, turn: 0.45, lean: 0.55, scale0: 0.86, scale1: 1.04, mirror: false }
    },
    big: 1.18                           // size multiplier on the combo finisher (m.swingBig)
  };

  let tex = null, geo = null, loadErr = false;
  function texture() {
    if (tex || loadErr) return tex;
    tex = new THREE.TextureLoader().load(CFG.url, undefined, undefined, () => { loadErr = true; console.warn('[slashfx] could not load', CFG.url); });
    tex.encoding = THREE.sRGBEncoding;   // painted in sRGB; the renderer outputs sRGB
    tex.anisotropy = Math.min(4, R.renderer ? R.renderer.capabilities.getMaxAnisotropy() : 1);
    return tex;
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
  const POOL = 3;
  function make(m) {
    const frame = new THREE.Group(), items = [];
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: texture(), transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, opacity: 0, toneMapped: false, fog: false });
      const mesh = new THREE.Mesh(geometry(), mat);
      mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false;
      const holder = new THREE.Group(); holder.add(mesh); frame.add(holder);
      items.push({ holder, mesh, mat, t: 0, life: 0, on: false, sw: null, s: 1 });
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
    // does this swing get the painted slash? (R.trail asks, so it can step aside)
    covers(m, p) {
      if (!CFG.enabled || loadErr || !m || !p || m.twirlT > 0 || !m.swing || !CFG.swings[m.swing]) return false;
      if (CFG.heroes.indexOf(m.kind) < 0) return false;
      return CFG.weapons.indexOf(weaponType(p)) >= 0;
    },
    update(m, p, dt) {
      if (!m.root) return;
      const S = m.slash;
      // fire once per swing, on the first frame of its cutting phase
      if (m.sword && m.sword.visible && m.swingT > 0 && R.slashFx.covers(m, p)) {
        const ph = R.trailCfg && R.trailCfg.phases[m.swing], st = 1 - m.swingT, key = 'sw' + m._swingN;
        if (ph && st >= ph[0] && st <= ph[1] && (!S || S.key !== key)) R.slashFx.fire(m, key);
      }
      if (S) R.slashFx.tick(S, dt);
    },
    fire(m, key) {
      const S = m.slash || (m.slash = make(m)), c = CFG.swings[m.swing];
      S.key = key;
      const o = S.items[S.next]; S.next = (S.next + 1) % S.items.length;
      const size = (c.radius / CFG.radiusPx) * 512 * (m.swingBig ? CFG.big : 1);
      o.on = true; o.t = 0; o.life = CFG.life; o.sw = c; o.size = size;
      // the frame for this slash: the hero's facing now (forward is −z in a frame turned by m.vf)
      const vf = m.vf || 0, f = _f.set(-Math.sin(vf), 0, -Math.cos(vf));
      o.holder.position.set(f.x * c.fwd, c.y, f.z * c.fwd);
      o.mesh.position.set(0, 0, 0);
      if (c.plane === 'up') {
        // a top-down cut: the painting stands in a plane through the facing, its arc bowing forward. The plane rolls
        // about the facing toward the camera (c.lean: 0 = upright, 1 = square to the camera) so it never shows edge-on
        const cam = R.camera, d = _d.set(0, 0, -1); if (cam) cam.getWorldDirection(d);
        const side = _s.set(-f.z, 0, f.x); if (side.dot(d) > 0) side.negate();          // the side facing the camera
        const n = _n.copy(d).addScaledVector(f, -d.dot(f)).negate(); if (n.lengthSq() < 1e-4) n.copy(side); n.normalize();
        n.multiplyScalar(c.lean).addScaledVector(side, 1 - c.lean).normalize();
        const u = _u.crossVectors(n, f).normalize();
        _q.setFromRotationMatrix(_m.makeBasis(f, u, n));
        S.frame.getWorldQuaternion(_pq); o.holder.quaternion.copy(_pq.invert().multiply(_q));
        o.mesh.rotation.set(0, 0, Math.PI / 2 + c.spin);   // in-plane: the arc's middle (−y in the painting) → the facing
      } else {
        // a horizontal sweep: the painting lies flat at blade height, its arc bowing toward the facing
        o.holder.rotation.set(0, vf, 0);
        o.mesh.rotation.set(Math.PI / 2, 0, c.spin);
      }
      o.base = o.mesh.rotation.z; o.dir = c.mirror ? -1 : 1;
      o.mesh.visible = true;
      R.slashFx.pose(o);
    },
    pose(o) {
      const c = o.sw, k = Math.min(1, o.t / o.life), fi = CFG.fadeIn;
      const a = k < fi ? k / fi : Math.pow(1 - (k - fi) / (1 - fi), 1.3);
      const e = 1 - Math.pow(1 - k, 2), s = o.size * (c.scale0 + (c.scale1 - c.scale0) * e);
      o.mesh.scale.set(s * o.dir, s, 1);
      o.mesh.rotation.z = o.base + o.dir * c.turn * (e - 0.5);
      o.mat.opacity = CFG.opacity * a;
    },
    tick(S, dt) {
      for (const o of S.items) {
        if (!o.on) continue;
        o.t += dt;
        if (o.t >= o.life) { o.on = false; o.mesh.visible = false; o.mat.opacity = 0; continue; }
        R.slashFx.pose(o);
      }
    },
    // hide every slash at once (death, room change); the meshes stay for reuse
    clear(m) { const S = m && m.slash; if (!S) return; for (const o of S.items) { o.on = false; o.mesh.visible = false; o.mat.opacity = 0; } S.key = null; },
    // free the pool (the shared texture and geometry stay)
    dispose(m) { const S = m && m.slash; if (!S) return; for (const o of S.items) o.mat.dispose(); if (S.frame.parent) S.frame.parent.remove(S.frame); m.slash = null; },
    preload() { if (CFG.enabled) texture(); }
  };
})();
