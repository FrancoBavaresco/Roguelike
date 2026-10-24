'use strict';
/* HEXWRIGHT — sword energy arcs (view only).
   Every sword swing leaves a crescent of light that follows the real path of the blade.

   Sync: the combat code only bumps p.anim.swingN / twirlN; the view plays the swing with m.swingT (1 → 0).
   During the swing's ACTIVE phase (CFG.phases, as a fraction of the swing: wind-up before it, recovery after)
   this module samples the blade's base and tip every frame, after the arm and sword have been posed, and
   builds a ribbon from those samples. Each swing (or twirl) is its own stroke, keyed by its event counter,
   so a combo gives one arc per hit and a swing can never spawn twice.

   Space: samples are stored in a frame that sits on the hero and turns with his facing (not with the
   body's own swing twist), so the arc moves and turns with him instead of staying behind in the world.

   Nothing here touches damage, collisions or game state; it only reads the model.
   Tune the look in R.trail.CFG (colours, width, life, phases). */
(function () {
  const R = H.R, THREE = window.THREE;
  const CFG = R.trailCfg = {
    life: 0.18,          // seconds a sample takes to fade out (0.12–0.25 reads well)
    maxSamples: 40,      // per hero; the oldest are dropped first
    core: 0xeafff6,      // bright centre of the arc
    edge: 0x33d6b0,      // turquoise rim (matches the green Seal palette)
    opacity: 1.0,
    baseFrac: 0.3,       // the ribbon covers the blade from this fraction of its length…
    tipExtend: 1.08,     // …to a little past the tip
    widthMin: 0.1,       // thickness at both ends of a stroke (1 = full blade band); the middle is full
    // fraction of the swing (0 = start, 1 = end) when the blade is actually cutting
    phases: { slash: [0.04, 0.8], cleave: [0.3, 0.56], smash: [0.48, 0.7], backhand: [0.42, 0.72] },
    // the combo finisher's arc: longer reach past the tip, wider band, a little longer life
    big: { tipExtend: 1.32, baseFrac: 0.16, life: 0.24, boost: 1.7 },
    twirl: true,         // the Charged Whirl leaves a full-circle arc
    // colour per weapon item (optional): legendary blades glow their own colour
    items: { oathbreaker: { core: 0xfff1d8, edge: 0xff8a2a } }
  };

  let mat = null;
  function material() {
    if (mat) return mat;
    mat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: CFG.opacity } },
      vertexShader: `attribute float aA; attribute float aV; attribute vec3 aCore; attribute vec3 aEdge;
        varying float vA; varying float vV; varying vec3 vCore; varying vec3 vEdge;
        void main() { vA = aA; vV = aV; vCore = aCore; vEdge = aEdge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uOpacity; varying float vA; varying float vV; varying vec3 vCore; varying vec3 vEdge;
        void main() {
          // vV: 0 at the inner edge (toward the hilt), 1 at the cutting edge
          float soft = smoothstep(0.0, 0.45, vV);
          float core = smoothstep(0.55, 0.92, vV) * (1.0 - 0.6 * smoothstep(0.96, 1.0, vV));
          vec3 col = mix(vEdge, vCore, core);
          float a = clamp(vA * soft * (0.6 + 0.4 * core) * uOpacity * 1.5, 0.0, 1.0);
          // additive blending (src * alpha + dst): the colour stays un-premultiplied, the core runs a little hot
          gl_FragColor = vec4(col * (1.0 + 0.5 * core), a);
        }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    mat.shared = true;
    return mat;
  }

  // one ribbon per hero model, created the first time it swings
  function make(m) {
    const N = CFG.maxSamples, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(N * 2), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aV', new THREE.BufferAttribute(new Float32Array(N * 2), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCore', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array((N - 1) * 6), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(g, material()); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
    const frame = new THREE.Group(); frame.add(mesh); m.root.add(frame);
    return { frame, mesh, g, s: [], key: null, b: new THREE.Vector3(), t: new THREE.Vector3(), c0: new THREE.Color(), c1: new THREE.Color() };
  }

  // which stroke is cutting right now (null when the blade is winding up, recovering or at rest)
  function activeStroke(m, p) {
    if (m.twirlT > 0 && CFG.twirl) return 'tw' + m._twirlN;
    if (!(m.swingT > 0) || !m.swing) return null;
    const ph = CFG.phases[m.swing]; if (!ph) return null;
    const st = 1 - m.swingT;
    return st >= ph[0] && st <= ph[1] ? 'sw' + m._swingN : null;
  }

  R.trail = {
    CFG,
    update(m, p, dt) {
      const sw = m.sword;
      if (!sw || !m.root) { if (m.trail) R.trail.clear(m); return; }
      const key = sw.visible ? activeStroke(m, p) : null;
      if (!m.trail) { if (!key) return; m.trail = make(m); }
      const T = m.trail, life = CFG.life;
      // the frame follows the hero's facing only (m.vf), so arcs turn with him but not with the swing twist
      T.frame.rotation.y = m.vf || 0;
      { let j = 0; for (const s of T.s) { s.age += dt; if (s.age < s.life) T.s[j++] = s; } T.s.length = j; }
      if (key) {
        if (key !== T.key) { T.key = key; T.stroke = (T.stroke || 0) + 1; const it = p.equip && p.equip.weapon; const c = (it && CFG.items[it]) || CFG; T.c0.setHex(c.core); T.c1.setHex(c.edge); T.big = key[0] === 's' && !!m.swingBig; }
        // blade base and tip in world space, after this frame's pose
        const inner = sw.userData.inner, L = sw.userData.bladeLen || 0.86, y0 = sw.userData.bladeY0 || 0.1;
        m.root.updateMatrixWorld(true);
        const B = T.big ? CFG.big : CFG;
        T.b.set(0, y0 + L * B.baseFrac, 0); inner.localToWorld(T.b); T.frame.worldToLocal(T.b);
        T.t.set(0, (y0 + L + 0.16) * B.tipExtend, 0); inner.localToWorld(T.t); T.frame.worldToLocal(T.t);
        T.s.push({ id: T.stroke, age: 0, life: B.life || life, k: B.boost || 1, bx: T.b.x, by: T.b.y, bz: T.b.z, tx: T.t.x, ty: T.t.y, tz: T.t.z, r0: T.c0.r, g0: T.c0.g, b0: T.c0.b, r1: T.c1.r, g1: T.c1.g, b1: T.c1.b });
        if (T.s.length > CFG.maxSamples) T.s.shift();
      }
      R.trail.build(T);
    },
    // rewrite the ribbon from the live samples: two vertices per sample (inner, outer), quads only inside a stroke
    build(T) {
      const S = T.s, n = S.length, g = T.g;
      if (n < 2) { T.mesh.visible = false; g.setDrawRange(0, 0); return; }
      const pos = g.attributes.position.array, aA = g.attributes.aA.array, aV = g.attributes.aV.array, cc = g.attributes.aCore.array, ce = g.attributes.aEdge.array, idx = g.index.array;
      let k = 0, ii = 0;
      for (let i = 0; i < n; i++) {
        const s = S[i];
        // position inside its stroke → thin at both ends, full in the middle (a crescent)
        let a = i, b = i; while (a > 0 && S[a - 1].id === s.id) a--; while (b < n - 1 && S[b + 1].id === s.id) b++;
        const u = b > a ? (i - a) / (b - a) : 0.5, fade = 1 - s.age / s.life;
        const w = (CFG.widthMin + (1 - CFG.widthMin) * Math.pow(Math.sin(Math.PI * u), 0.8)) * (0.55 + 0.45 * fade);
        const ix = s.tx + (s.bx - s.tx) * w, iy = s.ty + (s.by - s.ty) * w, iz = s.tz + (s.bz - s.tz) * w;
        const al = s.k * Math.pow(fade, 1.4) * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)));
        pos[k * 3] = ix; pos[k * 3 + 1] = iy; pos[k * 3 + 2] = iz; aA[k] = al; aV[k] = 0;
        pos[k * 3 + 3] = s.tx; pos[k * 3 + 4] = s.ty; pos[k * 3 + 5] = s.tz; aA[k + 1] = al; aV[k + 1] = 1;
        for (const o of [k, k + 1]) { cc[o * 3] = s.r0; cc[o * 3 + 1] = s.g0; cc[o * 3 + 2] = s.b0; ce[o * 3] = s.r1; ce[o * 3 + 1] = s.g1; ce[o * 3 + 2] = s.b1; }
        if (i > 0 && S[i - 1].id === s.id) { const p0 = k - 2, p1 = k - 1; idx[ii++] = p0; idx[ii++] = p1; idx[ii++] = k; idx[ii++] = p1; idx[ii++] = k + 1; idx[ii++] = k; }
        k += 2;
      }
      for (const at of ['position', 'aA', 'aV', 'aCore', 'aEdge']) g.attributes[at].needsUpdate = true;
      g.index.needsUpdate = true; g.setDrawRange(0, ii);
      T.mesh.visible = ii > 0;
    },
    // drop every arc at once (death, room change, weapon swap); the mesh stays for reuse
    clear(m) { const T = m && m.trail; if (!T) return; T.s.length = 0; T.key = null; T.mesh.visible = false; T.g.setDrawRange(0, 0); },
    // free the ribbon (the shared material stays)
    dispose(m) { const T = m && m.trail; if (!T) return; if (T.frame.parent) T.frame.parent.remove(T.frame); T.g.dispose(); m.trail = null; }
  };
})();
