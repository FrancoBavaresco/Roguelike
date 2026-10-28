'use strict';
/* HEXWRIGHT — Theron's painted thrust (view only): the third hit of the sword's ground combo.
   The artist's drawing art/estocada_azul.kra (tools/kra_thrust.py → public/textures/fx/thrust/thrust_atlas.png): 23
   drawings, one per paint layer, played bottom to top as one short sequence — the star where the thrust starts, the
   launch, the rune charging and flying forward with its shock shapes, the speed lines, the white impact and the big
   star where it lands. Nothing is redrawn: every drawing is shown as painted, at its own place in the painting.

   How it plays (times in seconds from the start of the swing, game time, so any frame rate plays it the same):
     launch → hit   the drawings run fast and slowing (an explosive start), so the white impact lands with the blow
                    (CFG.hit = the combo's own damage delay, 0.2 s);
     hit → end      the impact gives way to the big star, which fades out by the end of the swing.
   Neighbouring drawings overlap for a moment (each fades in over CFG.lead frames and out over CFG.trail), so the
   sequence reads as motion, not as flicker; the whole picture also stretches out along the thrust and drifts
   forward a little (CFG.stretch, CFG.drift), and follows the step Theron takes (CFG.follow).

   Where: the painting's origin star is put on the blade (CFG.onBlade: 0 hilt … 1 tip) when the blow starts; it runs
   along the attack (the aim, turned CFG.align of the way toward the blade's own direction) and is sized so its end
   star sits at the end of the damage strip (CFG.reach m from Theron). The picture stays upright and turns about the
   thrust's line to face the camera (never seen edge-on), and thins out near the floor instead of cutting into it.
   In the painted look it is a "painted overlay" (paint.js): laid over the picture with its real alpha, depth-tested.

   It only watches the combo's thrust (p.anim.hitN marks combo hits); damage, hitboxes, reach, step, timings and the
   other attacks are untouched. The painted slash (js/slashfx.js) steps aside for this one swing.
   Resources: one atlas, one plane, one shader program; per hero a pool of 2 effects × 4 meshes, made once and
   reused (spare meshes are hidden). Nothing is created per frame. Tune it in R.thrustCfg. */
(function () {
  const R = H.R, THREE = window.THREE;
  const CFG = R.thrustCfg = {
    enabled: true,
    heroes: ['knight'],                 // Theron
    weapons: ['sword', 'bastard'],      // his swords (the bastard sword's combo ends in the same thrust)
    atlas: 'public/textures/fx/thrust/thrust_atlas.png', atlasPx: 1024,
    // per drawing, in play order: atlas x, y and painting x, y, w, h (px; from thrust.json)
    frames: [[569, 2, 39, 129, 204, 201], [710, 762, 109, 188, 182, 99], [896, 762, 162, 198, 115, 83], [556, 762, 145, 176, 150, 114], [294, 762, 220, 160, 50, 125], [707, 617, 187, 160, 109, 138], [179, 617, 186, 160, 105, 139], [194, 457, 58, 164, 276, 153], [2, 617, 44, 157, 173, 141], [725, 457, 81, 151, 250, 152], [348, 762, 308, 155, 50, 125], [288, 617, 268, 152, 105, 139], [820, 617, 268, 151, 109, 138], [2, 762, 128, 168, 175, 138], [402, 762, 208, 170, 150, 124], [181, 762, 307, 155, 109, 138], [397, 617, 305, 154, 105, 139], [506, 617, 294, 159, 197, 139], [2, 457, 309, 160, 188, 156], [777, 2, 300, 142, 209, 169], [474, 457, 258, 152, 247, 153], [302, 2, 130, 88, 263, 250], [2, 2, 216, 0, 296, 451]],
    origin: [139, 236],                 // painting px: the start star (and the thrust's line)
    end: [458, 236],                    // painting px: the end star
    // timing (s from the swing's start)
    launch: 0.03,                       // first drawing
    hit: 0.2,                           // the impact drawing (hitFrame) shows here: the combo's damage delay
    hitFrame: 21,                       // the white impact
    accel: 1.7,                         // launch → hit: >1 = fast start, slowing into the impact
    endT: 0.4,                          // the last drawing has faded out (the swing lasts 0.42 s)
    hold: 0.035,                        // the impact drawing holds this long at full strength
    lastAt: 0.285,                      // the last drawing (the big star) is fully in
    lead: 0.7, trail: 2.2,              // fade-in and fade-out of each drawing, in frames of the sequence
    trailHit: 0.9,                      // ...shorter after the hit: the white impact is a brief accent, not a cloud
    opacity: 1.0,
    // place and size
    onBlade: 0.55,                      // origin on the blade (0 hilt … 1 tip)
    align: 0.35,                        // 0 = straight along the aim, 1 = along the blade
    reach: 2.3,                         // m from Theron to the end star (the damage strip ends at 0.3 + 2.0 m)
    mppClamp: [0.0026, 0.0055],         // m per painting px (keeps the size sane at odd blade poses)
    yClamp: [0.75, 1.25],               // height of the thrust's line (m)
    stretch: [0.82, 1.06, 1.0],         // along the thrust: at launch, at the hit, at the end
    drift: 0.18,                        // m it travels forward over the effect
    follow: 0.75,                       // how much of Theron's step it follows
    floorFade: [0.04, 0.35]             // world heights (m) where it fades out above the floor
  };
  const N = CFG.frames.length;

  let tex = null, geo = null, loadErr = false;
  function texture() {
    if (tex || loadErr) return tex;
    tex = new THREE.TextureLoader().load(CFG.atlas, undefined, undefined, () => { loadErr = true; console.warn('[thrustfx] could not load', CFG.atlas); });
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = Math.min(4, R.renderer ? R.renderer.capabilities.getMaxAnisotropy() : 1);
    return tex;
  }
  function geometry() { return geo || (geo = new THREE.PlaneGeometry(1, 1)); }
  // the drawing's window in the atlas (vUv = uv * uScale + uOffset), and a soft fade above the floor
  function onBeforeCompile(shader) {
    Object.assign(shader.uniforms, this.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uScale, uOffset; varying float vWorldY;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = uv * uScale + uOffset;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uFloor; varying float vWorldY;')
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', 'gl_FragColor = vec4( outgoingLight, diffuseColor.a * smoothstep(uFloor.x, uFloor.y, vWorldY) );');
  }
  function material() {
    const mat = new THREE.MeshBasicMaterial({ map: texture(), transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, opacity: 0, toneMapped: false, fog: false });
    mat.userData.u = { uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2() }, uFloor: { value: new THREE.Vector2(CFG.floorFade[0], CFG.floorFade[1]) } };
    mat.onBeforeCompile = onBeforeCompile;   // one function for all: one shared program
    return mat;
  }

  const POOL = 2, LAYERS = 4;   // at most 4 drawings overlap
  function make() {
    const items = [];
    for (let i = 0; i < POOL; i++) {
      const holder = new THREE.Group(), pic = new THREE.Group(), meshes = [];
      for (let j = 0; j < LAYERS; j++) {
        const mesh = new THREE.Mesh(geometry(), material());
        mesh.castShadow = mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.renderOrder = 6 + j; mesh.visible = false;
        mesh.userData.overlay = true;   // painted look: laid over the picture with its own alpha (paint.js)
        pic.add(mesh); meshes.push(mesh);
      }
      holder.add(pic); holder.visible = false; R.fx.add(holder);
      items.push({ holder, pic, meshes, on: false, t: 0, placed: false });
    }
    return { items, next: 0, key: null, room: null };
  }
  function weaponType(p) {
    const id = p.equip && p.equip.weapon, it = id && H.ITEMS && H.ITEMS[id];
    return it ? it.weapon : (H.DEFAULT_WEAPON && H.DEFAULT_WEAPON[p.hero || p.kind] && H.ITEMS[H.DEFAULT_WEAPON[p.hero || p.kind]] || {}).weapon;
  }
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const outCubic = x => 1 - Math.pow(1 - clamp01(x), 3);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4();

  R.thrustFx = {
    CFG,
    // is this swing the combo's thrust, with a sword, on a hero that uses the painted thrust?
    covers(m, p) {
      if (!CFG.enabled || loadErr || !m || !p || CFG.heroes.indexOf(m.kind) < 0 || CFG.weapons.indexOf(weaponType(p)) < 0) return false;
      const A = p.anim || {};
      return m.swingT > 0 && m.swing === 'thrust' && A.hitN === m._swingN;
    },
    update(m, p, dt) {
      if (!m.root || !R.camera) return;
      let S = m.thrust;
      if (S && S.room !== H.G.room) { R.thrustFx.clear(m); S.room = H.G.room; }   // a new room: nothing left floating
      if (R.thrustFx.covers(m, p)) {
        const key = m._swingN;
        if (!S) { S = m.thrust = make(); S.room = H.G.room; }
        if (S.key !== key) { S.key = key; R.thrustFx.fire(S, m, p); }
      }
      if (S) R.thrustFx.tick(S, m, p, dt);
    },
    fire(S, m, p) {
      const o = S.items[S.next]; S.next = (S.next + 1) % S.items.length;
      const rate = R.swingRate ? R.swingRate(m) : 2.4;
      o.on = true; o.t = (1 - m.swingT) / rate;   // seconds into the swing already
      o.placed = false; o.p = p; o.ax = p.aimDX; o.az = p.aimDZ; o.hx = p.x; o.hz = p.z;
      const al = Math.hypot(o.ax, o.az); if (al > 1e-6) { o.ax /= al; o.az /= al; } else { o.ax = -Math.sin(m.vf || 0); o.az = -Math.cos(m.vf || 0); }
      o.holder.visible = false; for (const me of o.meshes) me.visible = false;
    },
    // put the picture on the blade, along the attack (once, when the first drawing shows)
    place(o, m) {
      const p = o.p, sw = m.sword, inner = sw && sw.userData.inner;
      let ox = p.x + o.ax * 1.2, oy = 1.0, oz = p.z + o.az * 1.2, bx = o.ax, bz = o.az;
      if (inner) {
        m.root.updateMatrixWorld(true);
        _a.set(0, sw.userData.bladeY0 || 0.1, 0); inner.localToWorld(_a);
        _b.set(0, (sw.userData.bladeY0 || 0.1) + (sw.userData.bladeLen || 0.86), 0); inner.localToWorld(_b);
        ox = _a.x + (_b.x - _a.x) * CFG.onBlade; oy = _a.y + (_b.y - _a.y) * CFG.onBlade; oz = _a.z + (_b.z - _a.z) * CFG.onBlade;
        const bl = Math.hypot(_b.x - _a.x, _b.z - _a.z); if (bl > 0.05) { bx = (_b.x - _a.x) / bl; bz = (_b.z - _a.z) / bl; }
        if (bx * o.ax + bz * o.az < 0.3) { bx = o.ax; bz = o.az; }   // a blade not pointing ahead says nothing about the line
      }
      let dx = o.ax + (bx - o.ax) * CFG.align, dz = o.az + (bz - o.az) * CFG.align; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
      // size: the end star at the end of the damage strip (measured along the aim, from Theron)
      const toEnd = (p.x + o.ax * CFG.reach - ox) * o.ax + (p.z + o.az * CFG.reach - oz) * o.az, along = Math.max(0.5, toEnd / Math.max(0.3, dx * o.ax + dz * o.az));
      o.mpp = Math.max(CFG.mppClamp[0], Math.min(CFG.mppClamp[1], along / (CFG.end[0] - CFG.origin[0])));
      o.ox = ox; o.oy = Math.max(CFG.yClamp[0], Math.min(CFG.yClamp[1], oy)); o.oz = oz; o.dx = dx; o.dz = dz; o.hx = p.x; o.hz = p.z;
      o.placed = true;
    },
    // which drawing (fractional) at time t, and the fade of the last one
    frameAt(t) {
      if (t < CFG.hit) return CFG.hitFrame * (1 - Math.pow(1 - clamp01((t - CFG.launch) / (CFG.hit - CFG.launch)), CFG.accel));
      return CFG.hitFrame + (N - 1 - CFG.hitFrame) * smooth((t - CFG.hit - CFG.hold) / Math.max(0.01, CFG.lastAt - CFG.hit - CFG.hold));
    },
    tick(S, m, p, dt) {
      for (const o of S.items) {
        if (!o.on) continue;
        o.t += dt;
        if (o.t >= CFG.endT || p.dead) { R.thrustFx.hide(o); continue; }
        if (o.t < CFG.launch) continue;
        if (!o.placed) R.thrustFx.place(o, m);
        R.thrustFx.pose(o);
      }
    },
    pose(o) {
      const t = o.t, f = R.thrustFx.frameAt(t), cam = R.camera;
      const u = clamp01((t - CFG.launch) / (CFG.endT - CFG.launch));
      // follows Theron's step along the thrust, and drifts on a little
      const p = o.p, step = ((p.x - o.hx) * o.dx + (p.z - o.hz) * o.dz) * CFG.follow, fwd = step + CFG.drift * outCubic(u);
      o.holder.position.set(o.ox + o.dx * fwd, o.oy, o.oz + o.dz * fwd);
      // upright, turned about the thrust's line toward the camera: x along the thrust, y up-ish, z to the camera
      _x.set(o.dx, 0, o.dz); cam.getWorldDirection(_d);
      _n.copy(_d).addScaledVector(_x, -_d.dot(_x)).negate(); if (_n.lengthSq() < 1e-6) _n.set(0, 1, 0); _n.normalize();
      _u.crossVectors(_n, _x).normalize(); if (_u.y < 0) { _u.negate(); _n.negate(); }
      o.holder.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _u, _n));
      // stretch along the thrust: tight at the launch, longest at the hit, settling
      const st = CFG.stretch, sk = t < CFG.hit ? st[0] + (st[1] - st[0]) * outCubic((t - CFG.launch) / (CFG.hit - CFG.launch)) : st[1] + (st[2] - st[1]) * smooth((t - CFG.hit) / (CFG.endT - CFG.hit));
      o.pic.scale.set(o.mpp * sk, o.mpp, o.mpp);
      // the drawings around f: each fades in over CFG.lead and out over CFG.trail (the last one fades at the end)
      const lastFade = 1 - smooth((t - CFG.lastAt) / Math.max(0.01, CFG.endT - CFG.lastAt));
      const trail = t < CFG.hit ? CFG.trail : CFG.trailHit, i0 = Math.max(0, Math.ceil(f - trail)), S = CFG.atlasPx;
      let j = 0;
      for (let i = i0; i < N && i <= f + CFG.lead && j < o.meshes.length; i++) {
        let a = i <= f ? 1 - (f - i) / trail : 1 - (i - f) / CFG.lead;
        if (i === N - 1) a = Math.min(1, 1 - (i - f) / CFG.lead) * lastFade;
        if (a <= 0.01) continue;
        const F = CFG.frames[i], me = o.meshes[j++], mat = me.material, U = mat.userData.u;
        me.visible = true; mat.opacity = CFG.opacity * smooth(a);
        U.uScale.value.set(F[4] / S, F[5] / S); U.uOffset.value.set(F[0] / S, 1 - (F[1] + F[5]) / S);
        me.scale.set(F[4], F[5], 1);
        me.position.set(F[2] + F[4] / 2 - CFG.origin[0], CFG.origin[1] - (F[3] + F[5] / 2), 0.001 * j);   // later drawings a hair in front
      }
      for (; j < o.meshes.length; j++) o.meshes[j].visible = false;
      o.holder.visible = true;
    },
    hide(o) { o.on = false; o.holder.visible = false; for (const me of o.meshes) { me.visible = false; me.material.opacity = 0; } },
    // hide every thrust at once (death, room change); the meshes stay for reuse
    clear(m) { const S = m && m.thrust; if (!S) return; for (const o of S.items) R.thrustFx.hide(o); S.key = null; },
    preload() { if (CFG.enabled) texture(); }
  };
})();
