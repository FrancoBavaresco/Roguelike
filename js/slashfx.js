'use strict';
/* HEXWRIGHT — Theron's painted sword slash (view only).
   The three paint layers of art/theron_slash_v3.kra (exported by tools/kra_slash.py to
   public/textures/fx/theron_slash_1..3.png) play as one cut in three moments:
     1 start  — the main turquoise arc (layer 1) is drawn on along the path of the blade, tail first, head last;
     2 impact — when the blow lands, the inner blue-white light (layer 2) and the crystal and sparkles (layer 3)
                flare over it, held back so the white never hides the turquoise;
     3 end    — the arc dissolves from its tail toward its head (the way a trail does), the crystal fragments drift
                outward and on along the cut, and everything fades; each layer on its own clock.
   A faint lagging copy of the main arc (the "ghost") trails it during the draw-on, for a sense of speed.

   How it moves: a small shader addition on MeshBasicMaterial reveals and erases each layer along the arc (by the
   angle round the arc's centre in the painting); the slash also turns along the cut, drifts along the attack and
   swells a little toward the impact, then settles. Times are in seconds of game time (dt), so any frame rate plays
   it the same.

   Sync: the combat code bumps p.anim.swingN (each sword hit; p.anim.hitN marks the combo's hits) or p.anim.twirlN
   (the whirls); the view plays the swing with m.swingT (1 → 0) at R.swingRate. Each kind of blow names the part of
   its swing where the blade is cutting (phase): the draw-on starts when the blade starts cutting and runs with it,
   and the flare peaks halfway through, when the blade is in front of Theron. Each kind has its own style
   (CFG.kinds): wide sweep, light dash hits, the big finisher, the vertical chop, the thrust, the whirl.

   Direction: the painting runs from a tail (left) to a head (upper right). The blade tip is tracked round the hero
   each frame of a swing, and the painting is mirrored if needed so its head lands where the blade is heading; a
   top-down cut ends low. Mirroring leaves the texture coordinates alone, so the draw-on always runs tail → head.

   In the painted look the slash is a "painted overlay" (userData.overlay, see paint.js): drawn with its real alpha
   and laid over the finished picture, depth-tested against the scene, instead of being added as glow.

   Resources: three textures, one plane geometry and one shader program, shared; a small pool of slashes per hero,
   each with four meshes (one material each, so every layer has its own timing). Nothing is created per frame; spare
   meshes are hidden, not freed. Nothing here touches damage, hitboxes, collisions or timings. Tune it in
   R.slashCfg. */
(function () {
  const R = H.R, THREE = window.THREE;
  const CFG = R.slashCfg = {
    enabled: true,
    heroes: ['knight'],                 // Theron (the Veteran)
    weapons: ['sword', 'bastard'],      // item.weapon types that use it (axes keep their own arcs)
    layers: ['public/textures/fx/theron_slash_1.png', 'public/textures/fx/theron_slash_2.png', 'public/textures/fx/theron_slash_3.png'],
    pivot: [210, 140],                  // pixel of the 512 px painting at the arc's centre of curvature (it sits on the hero)
    radiusPx: 175,                      // pixel radius of the arc's bright band, used to size the plane
    ends: { tail: [20, 200], head: [400, 60] },   // pixels of the painting's tail and head (direction and draw-on)
    sweep: { slash: 1, quick: 1, big: 1, whirl: 1 },   // which way each swing runs round the hero (+1 = counter-clockwise
                                        // seen from above), from Theron's animations; re-measured from the blade every swing
    soft: 0.09,                         // softness of the draw-on and erase edges (fraction of the arc)
    rim: 0.35,                          // extra light on the leading edge while it is drawn on
    opacity: 1.0,                       // overall opacity
    jitter: 0.1,                        // random variation of times, turn and size per slash (fraction)
    // the three moments, in seconds from the hit (negative = before it)
    stages: {
      main:  { peak: 1.0, hold: 0.05, fade: 0.13, eraseAt: 0.02, erase: 0.17 },                 // layer 1
      light: { at: -0.025, rise: 0.025, peak: 0.55, hold: 0.025, fade: 0.08, lag: 0.14, scale: 0.95 },   // layer 2
      shards:{ at: -0.005, rise: 0.03, peak: 0.9, hold: 0.035, fade: 0.14, spread: 0.1, slip: 0.14 },   // layer 3
      ghost: { peak: 0.32, back: 0.2, life: 0.1 }                                                   // lagging copy
    },
    // per kind of blow: phase [from, to] (fraction of the swing when the blade cuts; the whirl uses its own entry and
    // peak in seconds), entryK (how much of that phase the draw-on takes), plane ('flat' at blade height or 'up' in the plane of a top-down cut), radius (m to the bright
    // band), y (height), fwd (m along the facing), drift (m it moves along the attack), spin (in-plane turn; the painting's
    // arc leans 19° to one side, spin centres it), turn (how far it turns along the cut),
    // grow [start, at the hit, end] (size), stretch (forward/back scale), lean (only 'up': 0 upright … 1 to the camera),
    // copies (spread round the hero), light/shards (multipliers on those layers), mirror ('auto' = follow the blade)
    kinds: {
      slash:  { phase: [0.04, 0.8], entryK: 0.8, plane: 'flat', radius: 1.9, y: 1.0, fwd: 0.0, drift: 0.15, spin: -0.33, turn: 0.42, grow: [0.9, 1.05, 0.97], mirror: 'auto' },
      quick:  { phase: [0.04, 0.8], entryK: 0.55, plane: 'flat', radius: 1.65, y: 1.0, fwd: 0.1, drift: 0.2, spin: -0.33, turn: 0.32, grow: [0.92, 1.03, 0.97], light: 0.7, shards: 0.75, mirror: 'auto' },
      big:    { phase: [0.04, 0.8], entryK: 0.7, plane: 'flat', radius: 2.25, y: 1.0, fwd: 0.0, drift: 0.2, spin: -0.33, turn: 0.5, grow: [0.88, 1.08, 1.0], light: 1.25, shards: 1.15, mirror: 'auto' },
      chop:   { phase: [0.3, 0.64], entryK: 0.9, plane: 'up', radius: 1.35, y: 1.0, fwd: 0.2, drift: 0.12, spin: -0.5, turn: 0.38, lean: 0.55, grow: [0.9, 1.04, 0.98], mirror: 'auto' },
      thrust: { phase: [0.3, 0.55], entryK: 0.6, plane: 'flat', radius: 1.5, y: 1.0, fwd: 0.5, drift: 0.5, spin: -0.33, turn: 0.0, grow: [0.8, 1.06, 1.02], stretch: 1.45, light: 0.85, mirror: false },
      whirl:  { entry: 0.14, peak: 0.08, plane: 'flat', radius: 2.0, y: 0.9, fwd: 0.0, drift: 0.0, spin: -0.33, turn: 1.3, grow: [0.85, 1.06, 1.0], copies: 2, mirror: 'auto' }
    }
  };

  // ---- the painting's arc, in texture coordinates (v up): centre, middle direction and half span
  const PIV = new THREE.Vector2(CFG.pivot[0] / 512, 1 - CFG.pivot[1] / 512);
  const angOf = px => Math.atan2((CFG.pivot[1] - px[1]), (px[0] - CFG.pivot[0]));
  const A_TAIL = angOf(CFG.ends.tail), A_HEAD = angOf(CFG.ends.head);
  const A_HALF = (((A_HEAD - A_TAIL) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / 2, A_MID = A_TAIL + A_HALF;

  // draw-on / erase along the arc, a soft cut at the texture's border (no hard edge if paint touches it) and above the
  // floor (a cut standing upright never slices into it), and a little
  // light on the leading edge. sArc: 0 at the tail, 1 at the head.
  function onBeforeCompile(shader) {
    Object.assign(shader.uniforms, this.userData.u);
    // world height, so the slash thins out before it reaches the floor instead of being cut by it
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uHead, uTail, uSoft, uRim, uMid, uHalf; uniform vec2 uPiv; varying float vWorldY;')
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
        vec2 dq = vUv - uPiv; float rel = atan(dq.y, dq.x) - uMid; rel = mod(rel + PI, 2.0 * PI) - PI;
        float sArc = rel / (2.0 * uHalf) + 0.5;
        float shown = (1.0 - smoothstep(uHead - uSoft, uHead + uSoft * 0.3, sArc)) * smoothstep(uTail - uSoft, uTail + uSoft, sArc);
        vec2 bd = min(vUv, 1.0 - vUv); shown *= smoothstep(0.0, 0.03, min(bd.x, bd.y)) * smoothstep(0.05, 0.45, vWorldY);
        float rimK = (1.0 - smoothstep(0.0, uSoft * 1.8, abs(sArc - uHead))) * uRim;
        gl_FragColor = vec4( outgoingLight * (1.0 + rimK), diffuseColor.a * shown );`);
  }

  let texs = null, geo = null, loadErr = false;
  function textures() {
    if (texs || loadErr) return texs;
    const L = new THREE.TextureLoader();
    texs = CFG.layers.map(url => { const t = L.load(url, undefined, undefined, () => { loadErr = true; console.warn('[slashfx] could not load', url); });
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
  function material(tex) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, opacity: 0, toneMapped: false, fog: false });
    mat.userData.u = { uHead: { value: 0 }, uTail: { value: -1 }, uSoft: { value: CFG.soft }, uRim: { value: 0 }, uMid: { value: A_MID }, uHalf: { value: A_HALF }, uPiv: { value: PIV } };
    mat.onBeforeCompile = onBeforeCompile;   // one function for all: one shared program
    return mat;
  }

  const _f = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _m = new THREE.Matrix4(), _h = new THREE.Vector3(), _t = new THREE.Vector3();
  const POOL = 4;   // a whirl uses two at once
  // per slash: ghost (layer 1, lagging), main (layer 1), light (layer 2), shards (layer 3)
  function make(m) {
    const frame = new THREE.Group(), items = [], T = textures();
    for (let i = 0; i < POOL; i++) {
      const holder = new THREE.Group(), turner = new THREE.Group(), parts = {};
      [['ghost', 0], ['main', 0], ['light', 1], ['shards', 2]].forEach(([name, k], j) => {
        const mat = material(T[k]), mesh = new THREE.Mesh(geometry(), mat);
        mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.renderOrder = 6 + j; mesh.visible = false;
        mesh.userData.overlay = true;   // painted look: laid over the picture with its own alpha (paint.js)
        turner.add(mesh); parts[name] = { mesh, mat, u: mat.userData.u };
      });
      holder.add(turner); frame.add(holder);
      items.push({ holder, turner, parts, t: 0, on: false, c: null });
    }
    m.root.add(frame);
    return { frame, items, key: null, next: 0 };
  }

  // the item.weapon type Theron is holding ('sword', 'bastard', 'axe'…)
  function weaponType(p) {
    const id = p.equip && p.equip.weapon, it = id && H.ITEMS && H.ITEMS[id];
    return it ? it.weapon : (H.DEFAULT_WEAPON && H.DEFAULT_WEAPON[p.hero || p.kind] && H.ITEMS[H.DEFAULT_WEAPON[p.hero || p.kind]] || {}).weapon;
  }
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const outCubic = x => 1 - Math.pow(1 - clamp01(x), 3);
  const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  // rise → hold → fade envelope around a start time (all in seconds)
  const envelope = (t, at, rise, hold, fade) => t < at ? 0 : t < at + rise ? smooth((t - at) / rise) : t < at + rise + hold ? 1 : Math.pow(1 - clamp01((t - at - rise - hold) / fade), 1.4);

  R.slashFx = {
    CFG,
    // is the painted slash in use for this hero and weapon? (game.js asks through G.paintedSlash)
    active(charId, weapon) { return CFG.enabled && !loadErr && CFG.heroes.indexOf(charId) >= 0 && CFG.weapons.indexOf(weapon) >= 0; },
    // does this model's current swing or whirl get the painted slash? (R.trail asks, so it steps aside)
    covers(m, p) {
      if (!CFG.enabled || loadErr || !m || !p || CFG.heroes.indexOf(m.kind) < 0 || CFG.weapons.indexOf(weaponType(p)) < 0) return false;
      if (m.twirlT > 0) return true;
      return !!(m.swing && CFG.kinds[m.swing]);
    },
    update(m, p, dt) {
      if (!m.root) return;
      const S = m.slash;
      // follow the blade tip around the hero (in his root's frame) while a swing or whirl plays: its motion tells
      // which way the cut runs
      const sw = m.sword, inner = sw && sw.userData.inner;
      if (inner && (m.swingT > 0 || m.twirlT > 0)) {
        const T = m._slTip || (m._slTip = { cur: new THREE.Vector3(), prev: new THREE.Vector3(), n: 0 });
        T.prev.copy(T.cur); m.root.updateMatrixWorld(true);
        T.cur.set(0, (sw.userData.bladeY0 || 0.1) + (sw.userData.bladeLen || 0.86), 0); inner.localToWorld(T.cur); m.root.worldToLocal(T.cur); T.n++;
      } else if (m._slTip) m._slTip.n = 0;
      if (sw && sw.visible && R.slashFx.covers(m, p)) {
        if (m.twirlT > 0) { const key = 'tw' + m._twirlN, c = CFG.kinds.whirl; if (!S || S.key !== key) R.slashFx.fire(m, key, 'whirl', c.entry, c.peak); }
        else if (m.swingT > 0) {
          const key = 'sw' + m._swingN;
          if (!S || S.key !== key) {
            // the blade's cutting phase in this swing: start with it, run with it, peak halfway
            const A = p.anim || {}, kind = m.swing === 'slash' ? (m.swingBig ? 'big' : A.hitN === m._swingN ? 'slash' : 'quick') : m.swing;
            const c = CFG.kinds[kind], rate = R.swingRate ? R.swingRate(m) : 3.6, done = 1 - m.swingT;
            if (kind === 'thrust' && R.thrustFx && R.thrustFx.covers(m, p)) { /* the combo's thrust has its own painting (js/thrustfx.js) */ }
            else if (done >= c.phase[0]) {
              const cut = (c.phase[1] - c.phase[0]) / rate, left = Math.max(0, (c.phase[1] - done) / rate);
              const entry = Math.max(0.05, Math.min(0.2, Math.min(cut, left) * c.entryK));
              R.slashFx.fire(m, key, kind, entry, Math.max(0.03, ((c.phase[0] + c.phase[1]) / 2 - done) / rate));
            }
          }
        }
      }
      if (S) {
        for (const o of S.items) if (o.on && o.pending) { const T = m._slTip; if (!T || !T.n || o.tipN0 == null) { o.pending = false; continue; } if (T.n >= o.tipN0 + 5) { const t = o.t; R.slashFx.aim(m, S, o, o.c); o.pending = false; o.t = t; } }
        R.slashFx.tick(S, dt);
      }
    },
    // kind: a key of CFG.kinds; entry: seconds the draw-on takes; tHit: seconds until the flare peaks
    fire(m, key, kind, entry, tHit) {
      const S = m.slash || (m.slash = make(m)), c = CFG.kinds[kind];
      S.key = key;
      const J = () => 1 + (Math.random() * 2 - 1) * CFG.jitter;
      const size = (c.radius / CFG.radiusPx) * 512 * J();
      const T = m._slTip, G = CFG.stages;
      for (let n = 0; n < (c.copies || 1); n++) {
        const o = S.items[S.next]; S.next = (S.next + 1) % S.items.length;
        o.on = true; o.t = 0; o.c = c; o.kind = kind; o.size = size; o.tHit = tHit * (n ? 1.15 : 1); o.entry = entry * J(); o.turnK = J();
        o.life = o.tHit + Math.max(G.main.eraseAt + G.main.erase, G.shards.at + G.shards.rise + G.shards.hold + G.shards.fade) + 0.02;
        o.pending = false; o.tipN0 = T && T.n ? T.n : null; o.tipA0 = T && T.n ? Math.atan2(T.cur.x, T.cur.z) : 0;
        // the frame for this slash: the hero's facing now (forward is −z in a frame turned by m.vf); whirl copies spread around him
        const vf = (m.vf || 0) + n * 2 * Math.PI / (c.copies || 1), f = _f.set(-Math.sin(vf), 0, -Math.cos(vf)); o.vf = vf; o.fx = f.x; o.fz = f.z;
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
        o.dir = c.mirror === true ? -1 : 1; o.turnSign = 1;
        for (const k in o.parts) { o.parts[k].mesh.visible = false; o.parts[k].mat.opacity = 0; }
        if (c.mirror === 'auto') R.slashFx.aim(m, S, o, c);
        R.slashFx.pose(o);
      }
    },
    // mirror the painting (and its turn) so its head lands where the blade is heading
    aim(m, S, o, c) {
      const T = m._slTip, mem = S.sweepOf || (S.sweepOf = Object.assign({}, CFG.sweep)); let want = 0;
      if (c.plane === 'up') want = -1;                                              // a top-down cut: the head ends low
      else {                                                                        // a sweep: which way round the hero
        // the blade's travel over the first frames (one frame can still be the end of the wind-up)
        if (T && T.n && o.tipN0 != null && T.n >= o.tipN0 + 5) { const d = H.angDiff(Math.atan2(T.cur.x, T.cur.z), o.tipA0); if (Math.abs(d) > 0.02) mem[o.kind] = Math.sign(d); o.pending = false; }
        else o.pending = true;   // decide a few frames later; meanwhile the last swing of this kind says
        want = mem[o.kind] || 0;
      }
      if (!want) return;
      o.dir = 1; o.turnSign = 1;
      const L = o.parts.main.mesh, k = CFG.ends, px = CFG.pivot;
      const toFrame = (v, p) => { v.set((p[0] - px[0]) / 512, (px[1] - p[1]) / 512, 0); L.localToWorld(v); S.frame.worldToLocal(v); return v; };
      const fa = Math.atan2(-Math.sin(o.vf), -Math.cos(o.vf));
      const side = () => {   // +1 when the head is ahead of the tail along the cut
        o.holder.updateMatrixWorld(true); toFrame(_h, k.head); toFrame(_t, k.tail);
        if (c.plane === 'up') return _h.y < _t.y ? -1 : 1;
        // angles from this slash's own facing (head and tail are almost opposite, so never compare them directly)
        return Math.sign(H.angDiff(Math.atan2(_h.x, _h.z), fa) - H.angDiff(Math.atan2(_t.x, _t.z), fa)) || 1;
      };
      const t0 = o.t; o.t = 0; R.slashFx.pose(o, true);
      if (side() !== want) { o.dir = -1; R.slashFx.pose(o, true); }
      // its turn should also run with the blade
      if (c.turn && c.plane !== 'up') {
        const headAng = () => { o.holder.updateMatrixWorld(true); toFrame(_h, k.head); return Math.atan2(_h.x, _h.z); };
        const a0 = headAng(); o.t = o.life; R.slashFx.pose(o, true); const a1 = headAng();
        if (Math.sign(H.angDiff(a1, a0)) !== want) o.turnSign = -1;
      }
      o.t = t0;
    },
    // place every part for time o.t; probe = only the transforms (used to measure the direction)
    pose(o, probe) {
      const c = o.c, G = CFG.stages, t = o.t, th = o.tHit, k = clamp01(t / o.life);
      // draw-on: the front runs tail → head with the blade (quick start, eased end)
      const dk = clamp01(t / Math.max(0.02, o.entry)), front = -0.25 + 1.5 * (0.5 * outCubic(dk) + 0.5 * smooth(dk));
      // erase: after the hit the tail dissolves toward the head
      const erase = (at, dur) => -0.3 + 1.6 * smooth((t - th - at) / dur);
      // motion: turn along the cut (eased), drift along the attack, swell toward the hit and settle
      const move = outCubic(k * 1.15);
      const g = c.grow, sw = t < th + 0.04 ? g[0] + (g[1] - g[0]) * smooth(t / (th + 0.04)) : g[1] + (g[2] - g[1]) * smooth((t - th - 0.04) / Math.max(0.05, o.life - th - 0.04));
      const s = o.size * sw, rot = (c.spin + c.turn * o.turnK * (move - 0.5) * o.turnSign) * o.dir;
      o.holder.position.set(o.fx * (c.fwd + c.drift * move), c.y, o.fz * (c.fwd + c.drift * move));
      const stretch = c.stretch || 1, op = CFG.opacity;
      const set = (P, alpha, head, tail, scale, extraRot, rim) => {
        P.mesh.scale.set(s * scale * o.dir, s * scale * stretch, 1); P.mesh.rotation.z = rot + extraRot * o.dir;
        if (probe) return;
        P.mat.opacity = op * alpha; P.mesh.visible = P.mat.opacity > 0.004;
        P.u.uHead.value = head; P.u.uTail.value = tail; P.u.uRim.value = rim;
      };
      const M = G.main, Lg = G.light, Sh = G.shards, Gh = G.ghost;
      // 1 the main arc: drawn on, held, erased from the tail and faded
      const fadeK = clamp01((t - th - M.hold) / M.fade);
      const mainA = M.peak * smooth(t / 0.025) * (t < th + M.hold ? 1 : 0.65 * Math.pow(1 - fadeK, 1.2) + 0.35 * (1 - clamp01((t - th - M.hold) / (M.fade * 1.6))));
      set(o.parts.main, mainA, front, erase(M.eraseAt, M.erase), 1, 0, CFG.rim * (1 - smooth((t - th) / 0.05)));
      // ghost: a fainter copy a little behind along the cut, only while it is drawn on
      set(o.parts.ghost, Gh.peak * (1 - clamp01(t / (th + Gh.life))), front - 0.12, -1, 1.02, -Gh.back * o.turnSign, 0);
      // 2 the inner light: flares at the hit, slightly inside the main arc, trailing its front
      const lightA = Lg.peak * (c.light || 1) * envelope(t, th + Lg.at, Lg.rise, Lg.hold, Lg.fade);
      set(o.parts.light, Math.min(1, lightA), front - Lg.lag, erase(M.eraseAt - 0.02, M.erase * 0.8), Lg.scale, 0, 0);
      // 3 crystal and sparkles: peak just after the hit, then the fragments drift outward and on along the cut
      const shA = Sh.peak * (c.shards || 1) * envelope(t, th + Sh.at, Sh.rise, Sh.hold, Sh.fade);
      const after = smooth((t - th) / (Sh.rise + Sh.hold + Sh.fade));
      set(o.parts.shards, Math.min(1, shA), front - 0.05, erase(M.eraseAt + 0.04, M.erase * 1.1), 1 + Sh.spread * after, Sh.slip * after * o.turnSign, 0);
    },
    tick(S, dt) {
      for (const o of S.items) {
        if (!o.on) continue;
        o.t += dt;
        if (o.t >= o.life) { o.on = false; for (const k in o.parts) { o.parts[k].mesh.visible = false; o.parts[k].mat.opacity = 0; } continue; }
        R.slashFx.pose(o);
      }
    },
    // hide every slash at once (death, room change); the meshes stay for reuse
    clear(m) { const S = m && m.slash; if (!S) return; for (const o of S.items) { o.on = false; for (const k in o.parts) { o.parts[k].mesh.visible = false; o.parts[k].mat.opacity = 0; } } S.key = null; },
    // free the pool (the shared textures and geometry stay)
    dispose(m) { const S = m && m.slash; if (!S) return; for (const o of S.items) for (const k in o.parts) o.parts[k].mat.dispose(); if (S.frame.parent) S.frame.parent.remove(S.frame); m.slash = null; },
    preload() { if (CFG.enabled) textures(); }
  };
})();
