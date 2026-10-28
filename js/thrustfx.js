'use strict';
/* HEXWRIGHT — Theron's painted thrust (view only): the third hit of the sword's ground combo.
   Drawings: the artist's art/estocada_azul.kra (tools/kra_thrust.py → public/textures/fx/thrust/thrust_atlas.png),
   23 paint layers kept exactly as painted. They are not flipped through one after another: each drawing has a part
   in one discharge of energy, and several play at once on separate tracks (CFG.tracks):
     origin  the first star (layer "Capa 1"), on the blade                     — phase A, charge
     bolt    the star with its bolt and the small bits (Capa 2, 3)             — phase A
     base    the teal blast (Capa 9), the trail's body, stretched from the blade to the front
     body    the launch blasts (Capa 8 → 10 → 11), crossfading, head on the front — phase B, propulsion
     rune    one rune that rides the front, legible: it only shimmers between the painted variants (Capa 4 copies,
             Capa 7), with two fading afterimages behind it; at the hit it lands (the rune with its streak and lines)
     speed   speed lines and flakes (Capa 13, 12, 6) trailing the front
     ring    the shock ring (Capa 5), opening round the front before the hit
     impact  the white impact (Capa 14), under the blasts, a short pop at the hit — phase C
     finale  the big star (Capa 15) at the end of the path, then everything fades — phase D
   The front runs from the blade to the end of the path with a marked acceleration, so the energy grows and travels,
   and the trail stretches behind it (never the rune: it keeps its proportions).

   Times are seconds from the start of the swing (game time). The impact peaks at CFG.t.hit = 0.2 s, when the combo
   deals its damage; nothing in the game's timing is changed.

   Size: CFG.size metres per painting pixel (the painting's path, 319 px, is about 2.7 m). The picture stays upright
   and turns about the thrust's line toward the camera; a thrust that points toward or away from the camera looks
   shorter on screen, so its length is stretched back up to CFG.screenComp. It thins out near the floor.
   In the painted look it is a "painted overlay" (paint.js), laid over the picture with its real alpha.

   Only the combo's thrust (p.anim.hitN marks combo hits) uses it; the charged Thrust skill and the other hits keep
   their effects, and the painted slash (js/slashfx.js) steps aside for this swing only. One atlas, one plane, one
   shader program; per hero 2 effects × CFG.meshes meshes, made once and reused. Nothing is created per frame. */
(function () {
  const R = H.R, THREE = window.THREE;
  const CFG = R.thrustCfg = {
    enabled: true,
    heroes: ['knight'],                 // Theron
    weapons: ['sword', 'bastard'],      // his swords (the bastard sword's combo ends in the same thrust)
    atlas: 'public/textures/fx/thrust/thrust_atlas.png', atlasPx: 1024,
    // per drawing (index = layer from the bottom of the stack): atlas x, y and painting x, y, w, h (px; thrust.json)
    frames: [[569, 2, 39, 129, 204, 201], [710, 762, 109, 188, 182, 99], [896, 762, 162, 198, 115, 83], [556, 762, 145, 176, 150, 114], [294, 762, 220, 160, 50, 125], [707, 617, 187, 160, 109, 138], [179, 617, 186, 160, 105, 139], [194, 457, 58, 164, 276, 153], [2, 617, 44, 157, 173, 141], [725, 457, 81, 151, 250, 152], [348, 762, 308, 155, 50, 125], [288, 617, 268, 152, 105, 139], [820, 617, 268, 151, 109, 138], [2, 762, 128, 168, 175, 138], [402, 762, 208, 170, 150, 124], [181, 762, 307, 155, 109, 138], [397, 617, 305, 154, 105, 139], [506, 617, 294, 159, 197, 139], [2, 457, 309, 160, 188, 156], [777, 2, 300, 142, 209, 169], [474, 457, 258, 152, 247, 153], [302, 2, 130, 88, 263, 250], [2, 2, 216, 0, 296, 451]],
    origin: [139, 236],                 // painting px: the start star, on the thrust's line
    // ---- size and place
    size: 0.0085,                       // m per painting px (the old version was ~0.0044, a rune 0.55 m tall)
    screenComp: 1.5,                    // most a thrust seen end-on is lengthened to look as long as a sideways one
    onBlade: 0.85,                      // where the origin sits on the blade (0 hilt … 1 tip), when the blow starts
    align: 0.35,                        // 0 = straight along the aim, 1 = along the blade
    yClamp: [0.95, 1.3],                // height of the thrust's line (m): high enough that the trail clears the floor
    follow: 0.75,                       // how much of Theron's step it follows
    floorFade: [0.03, 0.3],             // world heights (m) where it fades out above the floor
    opacity: 1.0,
    // ---- timing (s from the swing's start); the game hits at 0.2 s
    t: { charge: 0.015, launch: 0.05, hit: 0.2, impact: 0.07, end: 0.4 },
    // the front of the energy, in painting px along the path: from the blade to the end, accelerating
    front: { start: 175, hit: 420, after: 30, accel: 1.6 },
    // ---- tracks (frame numbers are layers from the bottom: 0 = Capa 1 … 22 = Capa 15)
    tracks: {
      origin: { frame: 0, scale: [0.45, 0.8], life: 0.11 },
      bolt:   { frames: [1, 2], at: 0.02, life: 0.09 },
      base:   { frame: 8, lag: 34, stretch: [0.8, 1.9], peak: 0.85, thick: 1.05 },
      body:   { frames: [3, 13, 14], stretch: [0.8, 1.6], peak: 1.0, thick: 1.0 },
      rune:   { frames: [5, 12, 15, 16, 11, 6], land: [17, 18], swap: 0.045, scale: 1.3, lag: -18, pop: 0.04, ghosts: [[60, 0.4], [120, 0.2]] },   // lag < 0: it leads the energy
      speed:  { lines: 20, flakes: [19, 9], from: 0.1, life: 0.2, stretch: 1.35 },
      ring:   { frame: 7, from: 0.12, life: 0.12, scale: [0.75, 1.3], back: 70 },
      impact: { frame: 21, peak: 0.8, scale: [0.7, 1.08], back: 120 },
      finale: { frame: 22, bright: [458, 235], scale: [0.3, 0.62], at: -0.012, life: 0.2 }
    },
    back: 12,                           // nothing reaches further back than this (px) behind the origin star: the hero stays clear
    fadeOut: 0.12,                      // the trail, speed lines and rune fade over this after the impact
    meshes: 18                          // drawings on screen at once, at most
  };
  const F = CFG.frames;

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

  const POOL = 2;
  function make() {
    const items = [];
    for (let i = 0; i < POOL; i++) {
      const holder = new THREE.Group(), pic = new THREE.Group(), meshes = [];
      for (let j = 0; j < CFG.meshes; j++) {
        const mesh = new THREE.Mesh(geometry(), material());
        mesh.castShadow = mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.renderOrder = 6 + j; mesh.visible = false;
        mesh.userData.overlay = true;   // painted look: laid over the picture with its own alpha (paint.js)
        pic.add(mesh); meshes.push(mesh);
      }
      holder.add(pic); holder.visible = false; R.fx.add(holder);
      items.push({ holder, pic, meshes, on: false, t: 0, placed: false, n: 0 });
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
  const outBack = x => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  // rise → hold → fall envelope (s)
  const env = (t, a, rise, hold, fall) => t < a ? 0 : t < a + rise ? smooth((t - a) / rise) : t < a + rise + hold ? 1 : 1 - smooth((t - a - rise - hold) / fall);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4(), _m3 = new THREE.Matrix3();

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
      o.placed = false; o.p = p; o.ax = p.aimDX; o.az = p.aimDZ;
      const al = Math.hypot(o.ax, o.az); if (al > 1e-6) { o.ax /= al; o.az /= al; } else { o.ax = -Math.sin(m.vf || 0); o.az = -Math.cos(m.vf || 0); }
      o.rv = Math.floor(Math.random() * CFG.tracks.rune.frames.length);   // which rune variant it starts on
      o.holder.visible = false; for (const me of o.meshes) me.visible = false;
    },
    // put the picture on the blade, along the attack (once, when the charge shows)
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
      o.ox = ox; o.oy = Math.max(CFG.yClamp[0], Math.min(CFG.yClamp[1], oy)); o.oz = oz; o.dx = dx; o.dz = dz; o.hx = p.x; o.hz = p.z;
      // on screen, a thrust toward or away from the camera is shorter than a sideways one: lengthen it back
      const V = _m3.setFromMatrix4(R.camera.matrixWorldInverse);
      _x.set(dx, 0, dz).applyMatrix3(V); const along = Math.hypot(_x.x, _x.y);
      _x.set(-dz, 0, dx).applyMatrix3(V); const side = Math.hypot(_x.x, _x.y);
      const flat = Math.max(along, side, 1e-3); o.comp = Math.max(1, Math.min(CFG.screenComp, flat / Math.max(along, 1e-3)));
      o.placed = true;
    },
    tick(S, m, p, dt) {
      for (const o of S.items) {
        if (!o.on) continue;
        o.t += dt;
        if (o.t >= CFG.t.end || p.dead) { R.thrustFx.hide(o); continue; }
        if (o.t < CFG.t.charge) continue;
        if (!o.placed) R.thrustFx.place(o, m);
        R.thrustFx.pose(o);
      }
    },
    // the front of the energy (painting px along the path) at time t
    frontAt(t) {
      const T = CFG.t, f = CFG.front;
      if (t < T.launch) return f.start;
      if (t < T.hit) return f.start + (f.hit - f.start) * Math.pow(clamp01((t - T.launch) / (T.hit - T.launch)), f.accel);
      return f.hit + f.after * outCubic((t - T.hit) / (T.end - T.hit));
    },
    // draw drawing i with its centre at painting (cx, cy), scaled (sx, sy) on its own size, at opacity a
    draw(o, i, cx, cy, sx, sy, a) {
      if (a <= 0.008 || o.n >= o.meshes.length) return;
      const D = F[i], me = o.meshes[o.n++], mat = me.material, U = mat.userData.u, S = CFG.atlasPx;
      me.visible = true; mat.opacity = Math.min(1, a) * CFG.opacity;
      U.uScale.value.set(D[4] / S, D[5] / S); U.uOffset.value.set(D[0] / S, 1 - (D[1] + D[5]) / S);
      me.scale.set(D[4] * sx, D[5] * sy, 1);
      me.position.set(cx - CFG.origin[0], CFG.origin[1] - cy, 0.0015 * o.n);   // later tracks a hair in front
    },
    // a drawing at its painted height, with its right edge (head) at painting x = head
    drawHead(o, i, head, sx, sy, a) { const D = F[i]; sx = Math.max(0.35, Math.min(sx, (head - CFG.origin[0] + CFG.back) / D[4])); R.thrustFx.draw(o, i, head - D[4] * sx / 2, D[3] + D[5] / 2, sx, sy, a); },
    pose(o) {
      const t = o.t, T = CFG.t, K = CFG.tracks, cam = R.camera;
      // place: on the blade, following Theron's step along the thrust; upright, turned about the line to the camera
      const p = o.p, step = ((p.x - o.hx) * o.dx + (p.z - o.hz) * o.dz) * CFG.follow;
      o.holder.position.set(o.ox + o.dx * step, o.oy, o.oz + o.dz * step);
      _x.set(o.dx, 0, o.dz); cam.getWorldDirection(_d);
      _n.copy(_d).addScaledVector(_x, -_d.dot(_x)).negate(); if (_n.lengthSq() < 1e-6) _n.set(0, 1, 0); _n.normalize();
      _u.crossVectors(_n, _x).normalize(); if (_u.y < 0) { _u.negate(); _n.negate(); }
      o.holder.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _u, _n));
      o.pic.scale.set(CFG.size * o.comp, CFG.size, CFG.size);
      o.n = 0;
      const fr = R.thrustFx.frontAt(t), x0 = CFG.origin[0];
      const kB = clamp01((t - T.launch) / (T.hit - T.launch));                    // 0 → 1 over the propulsion
      const out = 1 - smooth((t - T.hit - T.impact * 0.5) / CFG.fadeOut);          // dissipation after the impact
      const on = smooth((t - T.launch + 0.02) / 0.03);                             // the trail switches on fast
      // the trail's base: the teal blast, stretched from the blade to just behind the front
      { const c = K.base, D = F[c.frame], head = fr - c.lag, sx = Math.max(c.stretch[0], Math.min(c.stretch[1], (head - x0 + 10) / D[4]));
        R.thrustFx.drawHead(o, c.frame, head, sx, c.thick * (0.85 + 0.15 * kB), c.peak * on * out); }
      // the white impact: under the blasts, a short pop at the hit
      { const c = K.impact, D = F[c.frame], k = clamp01((t - T.hit + 0.012) / T.impact), a = c.peak * (k > 0 ? Math.sin(Math.PI * Math.min(1, k * 1.15)) : 0);
        const s = c.scale[0] + (c.scale[1] - c.scale[0]) * outCubic(k * 1.4);
        R.thrustFx.draw(o, c.frame, fr - c.back, D[3] + D[5] / 2, s, s, a); }
      // the body: the launch blasts, crossfading, their heads on the front, stretched with the speed
      { const c = K.body, n = c.frames.length, fi = (n - 1) * smooth(kB * 1.1), i0 = Math.floor(fi), w = fi - i0, sx = c.stretch[0] + (c.stretch[1] - c.stretch[0]) * Math.pow(kB, 0.7);
        for (let j = 0; j < 2; j++) { const idx = Math.min(n - 1, i0 + j), a = (j ? w : 1 - w) * c.peak * on * out; if (!j || w > 0.01) R.thrustFx.drawHead(o, c.frames[idx], fr - 4, sx, c.thick, a); } }
      // speed lines and flakes, trailing the front
      { const c = K.speed, a = env(t, c.from, 0.03, c.life - 0.09, 0.06), sl = c.stretch * (0.9 + 0.3 * kB);
        R.thrustFx.drawHead(o, c.lines, fr - 18, sl, 1, 0.9 * a);
        R.thrustFx.drawHead(o, c.flakes[1], fr - 110, 1.15, 1, 0.7 * env(t, T.launch + 0.03, 0.03, 0.06, 0.06));
        R.thrustFx.drawHead(o, c.flakes[0], fr + 34, 1.1, 1, 0.85 * env(t, T.hit - 0.025, 0.02, 0.04, 0.08)); }
      // the shock ring, opening round the front before the hit
      { const c = K.ring, D = F[c.frame], k = clamp01((t - c.from) / c.life), s = c.scale[0] + (c.scale[1] - c.scale[0]) * outCubic(k);
        R.thrustFx.draw(o, c.frame, fr - c.back, D[3] + D[5] / 2, s * 1.1, s, 0.85 * Math.sin(Math.PI * k)); }
      // the rune: rides the front, legible, shimmering between its painted variants; lands at the hit
      { const c = K.rune, landed = t >= T.hit, list = landed ? c.land : c.frames, sw = (t - T.charge) / c.swap, i0 = Math.floor(sw), w = smooth((sw - i0 - 0.6) / 0.4);
        const fa = list[(o.rv + i0) % list.length], fb = list[(o.rv + i0 + 1) % list.length];
        const pop = c.scale * (0.55 + 0.45 * outBack((t - T.charge) / c.pop)), a = smooth((t - T.charge) / 0.02) * (landed ? 1 - smooth((t - T.hit - 0.03) / CFG.fadeOut) : 1);
        const cx = fr - c.lag, put = (i, x, al) => { const D = F[i]; R.thrustFx.draw(o, i, x - (landed ? D[4] / 2 - 30 : 0), D[3] + D[5] / 2, pop, pop, al); };
        if (!landed) for (const [back, ga] of c.ghosts) put(fa, cx - back * (0.4 + kB), a * ga * kB);
        put(fa, cx, a * (1 - w)); if (w > 0.01) put(fb, cx, a * w); }
      // the charge: the first star on the blade, and the bolt and bits leaving it
      { const c = K.origin, D = F[c.frame], k = clamp01((t - T.charge) / c.life), s = c.scale[0] + (c.scale[1] - c.scale[0]) * outCubic(k * 2);
        R.thrustFx.draw(o, c.frame, x0, CFG.origin[1], s, s, Math.sin(Math.PI * k));
        const b = K.bolt; R.thrustFx.draw(o, b.frames[0], F[b.frames[0]][2] + F[b.frames[0]][4] / 2 + 20 * kB, F[b.frames[0]][3] + F[b.frames[0]][5] / 2, 1, 1, env(t, b.at, 0.015, 0.03, b.life - 0.045));
        R.thrustFx.draw(o, b.frames[1], F[b.frames[1]][2] + F[b.frames[1]][4] / 2 + 60 * kB, F[b.frames[1]][3] + F[b.frames[1]][5] / 2, 1.1, 1, 0.9 * env(t, b.at + 0.02, 0.02, 0.03, 0.05)); }
      // the finale: the big star at the end of the path, a hard pop and a quick fade
      { const c = K.finale, k = clamp01((t - T.hit - c.at) / c.life), s = c.scale[0] + (c.scale[1] - c.scale[0]) * outBack(k * 2.5) * (1 - 0.25 * smooth((k - 0.4) / 0.6));
        const D = F[c.frame], bx = c.bright[0] - (D[2] + D[4] / 2), by = c.bright[1] - (D[3] + D[5] / 2);   // its bright centre on the end of the path
        R.thrustFx.draw(o, c.frame, fr + 40 - bx * s, CFG.origin[1] - by * s, s, s, k > 0 ? Math.min(1, k * 8) * (1 - smooth((k - 0.3) / 0.7)) : 0); }
      for (let j = o.n; j < o.meshes.length; j++) o.meshes[j].visible = false;
      o.holder.visible = true;
    },
    hide(o) { o.on = false; o.holder.visible = false; for (const me of o.meshes) { me.visible = false; me.material.opacity = 0; } },
    // hide every thrust at once (death, room change); the meshes stay for reuse
    clear(m) { const S = m && m.thrust; if (!S) return; for (const o of S.items) R.thrustFx.hide(o); S.key = null; },
    preload() { if (CFG.enabled) texture(); }
  };
})();
