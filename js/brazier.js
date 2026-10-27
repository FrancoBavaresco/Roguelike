'use strict';
/* HEXWRIGHT — the dungeon braziers (view only): a big cup on a short pedestal, with a painted, moving fire.
   Design: the artist's sketch art/braseros_fuego_verde.kra (Capa 1: the empty cup). The cup is built here from
   simple shared geometry dressed in the sketch's own drawing (comic textures cup_*.png unwrapped from it by
   tools/brazier_sprites.py: ink lines and shading on the bands, rim, dish, pedestal and base tiles), plus a rolled lip,
   a seam ring, pedestal and base rings and rivets on the straps: a stepped octagonal teal base, a short pedestal with a collar, three teal claw legs, a wide
   shallow bowl (dark lower band, grey upper band and thick rim, six teal straps), an inner dish that takes the fire's
   colour, and a few charred sticks. Static parts are merged per room by R.bakeChildren like before.

   Fire: the sketch's own flames (tools/brazier_sprites.py → public/textures/fx/brazier/flame_A/B/C.png) on a card
   that faces the camera, its foot on the coals, so the front rim hides the base and the fire comes out of the cup.
   It moves: a small shader bend (the tips sway more than the base, a lick travelling up the flame), the height
   breathing on two out-of-step waves, a mirrored second copy fading in and out so the shape keeps changing, and a
   slow pulse (CFG.states[].pulse/period) that makes the flame grow and shrink, melting into the next drawing (alt) at
   its peak. Flakes and glowing embers (the atlas's 5th row) come from one fixed pool.
   A soft glow sits on the coals, and fragments painted in the sketch (green and white flakes, sparks.png) rise and
   fade from the bigger fires; all fragments share one draw call. The colour turns from the painted green to the
   depth's own fire colour (theme.rune) by a hue shift.

   Three states, same cup (CFG.states): A small steady flame, faint light, no fragments; B medium flame, livelier,
   a few flakes now and then, more light; C tall flame, strong motion, flakes rising, most light. There is no game
   mechanic for them: the state is picked per room (CFG.byRoom, the same for every brazier of a room; CFG.state is
   the default), and R.brazier.setState(state) changes a room's braziers live.

   Lights: the existing fixed pool of two point lights (no shader recompiles between rooms) serves the first two
   braziers, at the fire's height, with the state's intensity and flicker; there is no extra light.
   Resources: geometries, the cup's materials and the textures are shared and kept between rooms; each brazier has
   its own two flame materials (their uniforms), freed with the room. Nothing is created per frame. */
(function () {
  const R = H.R;
  const CFG = R.brazierCfg = {
    dir: 'public/textures/fx/brazier/',
    cup: 1.0,               // overall size of the cup (1 = bowl 1.32 m wide, 1.06 m high)
    mpp: 0.0115,            // metres per sketch pixel for the flames (the sketch's cup is 146 px wide; was 0.0088)
    fireY: 0.9,             // height of the coals (m, at cup 1)
    lightY: 2.4,            // height of the brazier's light (m)
    lightOut: 1.4,          // how far the light sits from the cup, toward the middle of the room (m)
    state: 'B',             // default state
    byRoom: { rest: 'A', shrine: 'A', merchant: 'A', treasure: 'A', mystery: 'A', elite: 'C', warden: 'C', arena: 'C', challenge: 'C' },
    states: {
      // tex: flame drawing; breathe: quick height wobble; sway (m) / lick (uv): the bend and the ripple up the flame;
      // mirror: the mirrored copy's peak opacity; pulse: the slow grow/shrink (±, of the height) over period (s); alt: the
      // drawing it melts into at the pulse's peak (altAt 1) or trough (altAt -1); light: [painted, classic];
      // sparks / embers: flakes and glowing embers per second; rise (m) and life (s) of the flakes
      A: { tex: 'A', scale: 1.0, breathe: 0.05, sway: 0.03, lick: 0.014, mirror: 0.2, pulse: 0.15, period: 3.4, alt: 'B', altAt: 1, glow: 0.9, light: [1.2, 0.7], flicker: 0.07, sparks: 0.4, embers: 1.5, rise: 0.6, life: 0.8, dish: 0.14 },
      B: { tex: 'B', scale: 1.0, breathe: 0.07, sway: 0.05, lick: 0.02, mirror: 0.26, pulse: 0.18, period: 3.0, alt: 'C', altAt: 1, glow: 1.2, light: [1.9, 1.1], flicker: 0.11, sparks: 3, embers: 4, rise: 1.0, life: 1.0, dish: 0.22 },
      C: { tex: 'C', scale: 1.0, breathe: 0.09, sway: 0.07, lick: 0.026, mirror: 0.3, pulse: 0.2, period: 2.6, alt: 'B', altAt: -1, glow: 1.5, light: [2.6, 1.5], flicker: 0.15, sparks: 8, embers: 9, rise: 1.7, life: 1.2, dish: 0.32 }
    },
    sparkMax: 180,          // fragments alive at once, all braziers together (a fixed pool)
    sparkSize: [0.11, 0.2], // m (painted flakes)
    emberSize: [0.05, 0.1], // m (embers)
    // sketch frames (from brazier.json): crop size and the flame's foot (px)
    flames: { A: { w: 50, h: 62, pivot: [23, 68] }, B: { w: 77, h: 79, pivot: [32, 81] }, C: { w: 111, h: 128, pivot: [59, 126] } },
    paintedHue: 0.36        // hue of the painted green (0–1); the fire is turned to the depth's colour from it
  };

  const T = () => window.THREE;
  // a colour picked from the sketch (sRGB) as the renderer wants it (linear): without this every hex looks paler
  const lin = hex => new (window.THREE.Color)(hex).convertSRGBToLinear().getHex();
  let shared = null;
  function res() {
    if (shared) return shared;
    const THREE = T(), L = new THREE.TextureLoader(), mk = (geo) => { geo.shared = true; return geo; }, mat = (m) => { m.shared = true; return m; };
    const tex = {}; for (const k of ['A', 'B', 'C']) { const t = L.load(CFG.dir + 'flame_' + k + '.png'); t.encoding = THREE.sRGBEncoding; tex[k] = t; }
    const sparkTex = L.load(CFG.dir + 'sparks.png'); sparkTex.encoding = THREE.sRGBEncoding;
    // the cup's comic textures, unwrapped from the sketch by tools/brazier_sprites.py (u round the cup, v up)
    const cupTex = {}; for (const k of ['band', 'rim', 'dish', 'stem', 'base']) { const t = L.load(CFG.dir + 'cup_' + k + '.png'); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; cupTex[k] = t; }
    // the cup, at size 1: profile of the bowl's outside (radius, height), then the rim, then the dish inside
    const V = (r, y) => new THREE.Vector2(r, y);
    const outer = mk(new THREE.LatheGeometry([V(0.2, 0.6), V(0.38, 0.62), V(0.54, 0.7), V(0.62, 0.8), V(0.645, 0.86), V(0.655, 0.95)], 32));
    const rim = mk(new THREE.LatheGeometry([V(0.655, 0.95), V(0.68, 0.98), V(0.66, 1.02), V(0.6, 1.03), V(0.57, 1.0)], 24));
    const dish = mk(new THREE.LatheGeometry([V(0.57, 1.0), V(0.5, 0.94), V(0.36, 0.88), V(0.16, 0.85), V(0.001, 0.845)], 24));
    const base1 = mk(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 8)), base2 = mk(new THREE.CylinderGeometry(0.31, 0.36, 0.08, 8));
    const ped = mk(new THREE.CylinderGeometry(0.15, 0.22, 0.36, 8)), collar = mk(new THREE.CylinderGeometry(0.24, 0.19, 0.07, 8));
    const claw = mk(new THREE.ConeGeometry(0.075, 0.46, 4)); claw.rotateX(Math.PI);   // point down
    const strap = mk(new THREE.BoxGeometry(0.07, 0.24, 0.04));
    const stick = mk(new THREE.BoxGeometry(0.42, 0.05, 0.05));
    // details: a rolled lip on the rim, a ring where the two bands meet, a ring round the pedestal, rivets on the straps
    const ring = (r, t, y) => { const g = new THREE.TorusGeometry(r, t, 6, 32); g.rotateX(Math.PI / 2); g.translate(0, y, 0); return mk(g); };
    const lip = ring(0.672, 0.024, 0.985), seam = ring(0.628, 0.018, 0.8), pedRing = ring(0.2, 0.022, 0.27), baseRing = ring(0.35, 0.018, 0.165);
    const rivet = mk(new THREE.IcosahedronGeometry(0.024, 0));
    const plane = {}; for (const k of ['A', 'B', 'C']) { const F = CFG.flames[k], g = new THREE.PlaneGeometry(F.w, F.h); g.translate(F.w / 2 - F.pivot[0], F.pivot[1] - F.h / 2, 0); plane[k] = mk(g); }
    // matte like the rest of the dungeon; colours are the sketch's own (sRGB), turned linear for the renderer
    const std = (c, o) => mat(R.std(lin(c), o));
    shared = {
      tex, sparkTex, plane,
      geo: { outer, rim, dish, base1, base2, ped, collar, claw, strap, stick, lip, seam, pedRing, baseRing, rivet }, cupTex,
      mat: {
        // the painted parts: the sketch's own drawing (ink lines and shading) on the 3D shape, white so the map shows as drawn
        band: std(0xffffff, { map: cupTex.band, metalness: 0.05, roughness: 0.85 }), rimTex: std(0xffffff, { map: cupTex.rim, metalness: 0.05, roughness: 0.85 }),
        stemTex: std(0xffffff, { map: cupTex.stem, metalness: 0.05, roughness: 0.85 }), baseTex: std(0xffffff, { map: cupTex.base, metalness: 0.05, roughness: 0.85 }),
        rim: std(0x5a6066, { metalness: 0.05, roughness: 0.85 }), knob: std(0x8a9298, { metalness: 0.05, roughness: 0.8 }), ink: std(0x15181a, { metalness: 0.05, roughness: 0.9 }),   // the sketch's greys and ink
        teal: std(0x2a8a96, { metalness: 0.05, roughness: 0.85 }), tealDark: std(0x1d5560, { metalness: 0.05, roughness: 0.85 }), claw: std(0x2c8c98, { metalness: 0.05, roughness: 0.85 }),   // the sketch's teals
        stick: std(0x3a2418, { roughness: 0.9 })
      }
    };
    return shared;
  }

  // fire card material: the painted flame, bent and licked by a small shader, hue-turned to the depth's colour
  function flameMat(tex, hue, phase) {
    const THREE = T();
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false, fog: false });
    m.userData.u = { uTime: { value: 0 }, uSway: { value: 0.03 }, uLick: { value: 0.01 }, uPhase: { value: phase }, uHue: { value: hue } };
    m.onBeforeCompile = flameShader;
    return m;
  }
  function flameShader(shader) {
    Object.assign(shader.uniforms, this.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uSway, uPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hk = clamp(uv.y, 0.0, 1.0); hk *= hk;   // the tips move, the foot stays on the coals
        transformed.x += (sin(uTime * 1.7 + uPhase) * 0.45 + sin(uTime * 3.1 + uPhase * 1.3) * 0.35 + sin(uTime * 5.3 + uPhase * 1.7) * 0.2) * uSway * hk;   // uSway in sketch px
        transformed.y *= 1.0 + 0.06 * sin(uTime * 4.1 + uPhase * 0.9) * hk;   // the tips stretch and settle`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uLick, uPhase, uHue;
        vec3 hueTurn(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }`)
      .replace('#include <map_fragment>', `
        vec2 fuv = vUv; fuv.x += (sin(fuv.y * 11.0 - uTime * 7.0 + uPhase) * 0.7 + sin(fuv.y * 23.0 - uTime * 13.0 + uPhase * 2.0) * 0.3) * uLick * fuv.y;   // licks travelling up the flame
        vec4 texelColor = texture2D(map, fuv); texelColor = mapTexelToLinear(texelColor);
        texelColor.rgb = hueTurn(texelColor.rgb, uHue); diffuseColor *= texelColor;`);
  }

  // all fragments of all braziers: one Points draw call, a cell of the sparks atlas per point
  let sparks = null;
  function sparkSystem() {
    if (sparks) return sparks;
    const THREE = T(), N = CFG.sparkMax, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCell', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { tex: { value: res().sparkTex }, uScale: { value: 300 }, uHue: { value: 0 } },
      vertexShader: `attribute float aCell, aSize, aAlpha; varying float vCell, vAlpha; uniform float uScale;
        void main() { vCell = aCell; vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale; }`,
      fragmentShader: `uniform sampler2D tex; uniform float uHue; varying float vCell, vAlpha;
        vec3 hueTurn(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }
        void main() { float cx = mod(vCell, 4.0), cy = floor(vCell / 4.0); vec2 uv = (vec2(cx, 4.0 - cy) + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)) / vec2(4.0, 5.0);   // 4 x 5 cells: flakes, then a row of embers
          vec4 c = texture2D(tex, uv); if (c.a * vAlpha < 0.02) discard; gl_FragColor = vec4(hueTurn(c.rgb, uHue), c.a * vAlpha); }`,
      transparent: true, depthWrite: false
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; m.shared = true; g.shared = true;
    // a fixed pool of records: [0, n) are alive, nothing is allocated while the game runs
    const pool = []; for (let i = 0; i < N; i++) pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 1, cell: 0, size: 0.1, sway: 0, drag: 0.8 });
    sparks = { pts, g, m, pool, n: 0 };
    return sparks;
  }

  // hue turn (radians) from the painted green to a colour
  function hueTo(color) {
    const c = new (T().Color)(color), hsl = {}; c.getHSL(hsl);
    let d = hsl.h - CFG.paintedHue; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return d * Math.PI * 2;
  }

  R.brazier = {
    CFG,
    stateFor(room) { return (room && room.brazierState) || CFG.byRoom[room && room.type] || CFG.state; },
    // build one brazier at (x, z) in R.chamber; returns its record for R.braziers
    build(x, z, theme, room, i) {
      const THREE = T(), S = res(), G = S.geo, M = S.mat, k = CFG.cup;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(k); g.userData.brazier = true;
      const add = (geo, mt, y, o) => { const m = new THREE.Mesh(geo, mt); m.position.y = y || 0; if (o) o(m); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      add(G.base1, M.baseTex, 0.04); add(G.base2, M.baseTex, 0.12); add(G.ped, M.stemTex, 0.34); add(G.collar, M.teal, 0.53);
      add(G.baseRing, M.ink); add(G.pedRing, M.teal);
      add(G.outer, M.band); add(G.rim, M.rimTex); add(G.lip, M.rim); add(G.seam, M.tealDark);
      for (let c = 0; c < 3; c++) {   // claws: from under the bowl, down and out
        const a = c * Math.PI * 2 / 3 + 0.5, r0 = 0.36, r1 = 0.58, y0 = 0.64, y1 = 0.3;
        add(G.claw, M.claw, (y0 + y1) / 2, m => { m.position.x = Math.cos(a) * (r0 + r1) / 2; m.position.z = Math.sin(a) * (r0 + r1) / 2;
          const dir = new THREE.Vector3(Math.cos(a) * (r1 - r0), y1 - y0, Math.sin(a) * (r1 - r0)).normalize(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); });
      }
      for (let c = 0; c < 6; c++) {   // straps down the outside of the bowl
        const a = c * Math.PI / 3; add(G.strap, M.teal, 0.87, m => { m.position.x = Math.cos(a) * 0.645; m.position.z = Math.sin(a) * 0.645; m.lookAt(Math.cos(a) * 2, 0.87, Math.sin(a) * 2); m.rotateX(-0.12); });   // flat against the bowl, leaning with it
        for (const [ry, rr] of [[0.94, 0.682], [0.8, 0.652]]) add(G.rivet, M.knob, ry, m => { m.position.x = Math.cos(a) * rr; m.position.z = Math.sin(a) * rr; });   // a rivet at each end
      }
      for (let c = 0; c < 4; c++) add(G.stick, M.stick, 0.87 + c * 0.012, m => { m.rotation.y = c * 0.8 + 0.3; m.rotation.z = (c % 2 ? 0.08 : -0.08); });
      // the dish: lit by its own fire (not merged: it flickers)
      const dishMat = R.std(lin(0x8a8e90), { map: S.cupTex.dish, metalness: 0.05, roughness: 0.85, emissive: new THREE.Color(theme.rune), emissiveIntensity: 0.2 });
      const dish = add(G.dish, dishMat); dish.userData.dish = true; dish.castShadow = false;
      R.chamber.add(g);
      // the fire: a card on the coals, facing the camera, and a mirrored copy
      const st = R.brazier.stateFor(room), hue = hueTo(theme.rune), ph = R.drand() * 7;
      const fire = new THREE.Group(); fire.position.set(x, CFG.fireY * k, z); fire.userData.fire = true;
      const mk2 = (phase, flip) => { const m = new THREE.Mesh(S.plane[CFG.states[st].tex], flameMat(S.tex[CFG.states[st].tex], hue, phase)); m.userData.overlay = true; m.renderOrder = 3; m.frustumCulled = false; if (flip) m.userData.flip = true; fire.add(m); return m; };
      const main = mk2(ph, false), copy = mk2(ph + 2.1, true), alt = mk2(ph + 4.2, false);   // alt: the next drawing, melted in at the pulse
      const glow = R.glowSprite(theme.rune, 1); glow.position.y = 0.12; fire.add(glow);
      R.chamber.add(fire);
      let light = null;
      if (i < 2 && H.settings.quality !== 'low') { light = R.brazierLights[i]; light.color.setHex(theme.rune); light.distance = H.settings.look === 'classic' ? 10 : 13; const toward = room && room.main ? Math.sign(((room.main.minX + room.main.maxX) / 2) - x) || 1 : 1;   // a little into the room: it lights the floor and walls, not its own cup from up close
        light.position.set(x + toward * CFG.lightOut, CFG.lightY, z); }
      const b = { x, z, fire, main, copy, alt, glow, dishMat, light, ph, state: st, hue, spawn: 0, ember: 0, color: theme.rune };
      R.brazier.apply(b, st);
      const sp = sparkSystem(); if (!sp.pts.parent) R.fx.add(sp.pts);
      return b;
    },
    // switch one brazier to a state (A, B, C)
    apply(b, st) {
      const S = res(), c = CFG.states[st] || CFG.states.B; b.state = st; b.c = c;
      for (const m of [b.main, b.copy]) { m.geometry = S.plane[c.tex]; m.material.map = S.tex[c.tex]; m.material.needsUpdate = true; }
      b.alt.geometry = S.plane[c.alt]; b.alt.material.map = S.tex[c.alt]; b.alt.material.needsUpdate = true;
      b.altK = CFG.flames[c.tex].h / CFG.flames[c.alt].h;   // the alt drawing is sized to the flame's own height
      b.dishMat.emissiveIntensity = c.dish;
    },
    // every brazier of the current room (no game mechanic uses this; for tuning and future use)
    setState(st) { if (H.G.room) H.G.room.brazierState = st; for (const b of R.braziers || []) R.brazier.apply(b, st); },
    tick(dt, t) {
      const cam = R.camera, look = H.settings.look === 'classic' ? 1 : 0, list = R.braziers || [];
      const sp = sparks;
      for (const b of list) {
        if (!b.fire) continue;
        const c = b.c, w1 = Math.sin(t * 2.3 + b.ph), w2 = Math.sin(t * 5.7 + b.ph * 1.3), w3 = Math.sin(t * 11 + b.ph * 0.7);
        // the slow pulse: the flame grows and shrinks on a smooth cycle (a sine with a little second harmonic, so it
        // rises slowly and sinks a bit quicker, like a real fire drawing breath)
        const ph = t * 6.2832 / c.period + b.ph, e = Math.sin(ph) * 0.85 + Math.sin(ph * 2 + 0.6) * 0.15;
        const hy = (1 + c.pulse * e) * (1 + c.breathe * (0.6 * w1 + 0.4 * w2));
        const hx = (1 + c.pulse * 0.4 * e) * (1 - c.breathe * 0.4 * w1 + c.breathe * 0.2 * w3);
        const s = CFG.mpp * c.scale;
        b.fire.quaternion.copy(cam.quaternion);
        b.main.scale.set(s * hx, s * hy, 1);
        b.copy.scale.set(-s * (2 - hx) * 0.97 * (1 + c.pulse * 0.4 * e), s * (1 + c.pulse * e) * (1 + c.breathe * 0.5 * Math.sin(t * 3.3 + b.ph + 1.5)), 1);
        // at the pulse's peak (or trough) the next drawing melts in: the flame changes shape as it grows
        const x = e * c.altAt, wa = x <= 0.3 ? 0 : x >= 0.95 ? 1 : ((x - 0.3) / 0.65) * ((x - 0.3) / 0.65) * (3 - 2 * (x - 0.3) / 0.65);
        const ak = s * b.altK; b.alt.scale.set(ak * hx * (1 - 0.1 * w3), ak * hy, 1);
        const mo = c.mirror * (0.5 + 0.5 * Math.sin(t * 1.7 + b.ph));   // the copy fades in and out: the shape keeps changing
        b.main.material.opacity = (1 - mo * 0.5) * (1 - wa * 0.9); b.copy.material.opacity = mo * (1 - wa * 0.85); b.alt.material.opacity = wa;
        b.alt.visible = wa > 0.001;
        for (const m of [b.main, b.copy, b.alt]) { const u = m.material.userData.u; u.uTime.value = t; u.uSway.value = c.sway / CFG.mpp; u.uLick.value = c.lick; }
        const f = (1 + c.flicker * (0.6 * w2 + 0.4 * w3)) * (1 + c.pulse * 0.5 * e);
        b.glow.scale.setScalar(c.glow * f); b.glow.material.opacity = 0.55;
        b.dishMat.emissiveIntensity = c.dish * f;
        if (b.light) b.light.intensity = c.light[look] * f;
        if (!sp) continue;
        // flakes leave the fire now and then (more when it is big), embers stream up all the time
        const gust = 0.6 + 0.4 * (w1 * 0.5 + 0.5) + 0.5 * Math.max(0, e);
        b.spawn = Math.min(b.spawn + dt * c.sparks * gust, 2); b.ember = Math.min(b.ember + dt * c.embers * gust, 3);
        while (b.spawn >= 1 && sp.n < CFG.sparkMax) { b.spawn -= 1; R.brazier._emit(b, c, false); }
        while (b.ember >= 1 && sp.n < CFG.sparkMax) { b.ember -= 1; R.brazier._emit(b, c, true); }
      }
      if (sp) {
        const L = sp.pool, P = sp.g.attributes.position.array, C = sp.g.attributes.aCell.array, Z = sp.g.attributes.aSize.array, A = sp.g.attributes.aAlpha.array;
        let i = 0;
        while (i < sp.n) {
          const q = L[i]; q.t += dt;
          if (q.t >= q.life) { L[i] = L[sp.n - 1]; L[sp.n - 1] = q; sp.n--; continue; }   // swap the dead one out of the live range
          q.x += (q.vx + Math.sin(q.t * 6 + q.sway) * 0.15) * dt; q.y += q.vy * dt; q.z += (q.vz + Math.cos(q.t * 5 + q.sway) * 0.1) * dt; q.vy *= Math.exp(-dt * q.drag);
          const k = q.t / q.life;
          P[i * 3] = q.x; P[i * 3 + 1] = q.y; P[i * 3 + 2] = q.z; C[i] = q.cell; Z[i] = q.size * (1 - 0.5 * k); A[i] = Math.min(1, k * 6) * (1 - k * k); i++;
        }
        for (const a of ['position', 'aCell', 'aSize', 'aAlpha']) sp.g.attributes[a].needsUpdate = true;
        sp.g.setDrawRange(0, sp.n);
        if (list[0]) sp.m.uniforms.uHue.value = list[0].hue;
        // point size: metres → pixels for the current camera (orthographic or perspective at the fires' distance)
        const hpx = R.renderer ? R.renderer.getDrawingBufferSize(R._v2 || (R._v2 = new (T().Vector2)())).y / 2 : 300;
        sp.m.uniforms.uScale.value = cam.isOrthographicCamera ? hpx * cam.zoom / ((cam.top - cam.bottom) / 2) : hpx * cam.projectionMatrix.elements[5] / 12;
      }
    },
    // one fragment from a fire: a painted flake (green or white) or a small glowing ember, taken from the pool
    _emit(b, c, ember) {
      const sp = sparks, q = sp.pool[sp.n++], a = Math.random() * 6.283, r = Math.random() * (ember ? 0.3 : 0.22) * CFG.cup;
      q.x = b.x + Math.cos(a) * r; q.y = (CFG.fireY + (ember ? 0.05 : 0.15)) * CFG.cup; q.z = b.z + Math.sin(a) * r;
      q.vx = (Math.random() - 0.5) * (ember ? 0.4 : 0.25); q.vz = (Math.random() - 0.5) * (ember ? 0.4 : 0.25);
      q.t = 0; q.life = c.life * (ember ? 0.5 + Math.random() * 0.6 : 0.6 + Math.random() * 0.6);
      q.vy = (ember ? 1.5 : 1) * c.rise / c.life * (0.7 + Math.random() * 0.6); q.drag = ember ? 1.2 : 0.8;
      q.cell = ember ? 16 + Math.floor(Math.random() * 4) : Math.random() < 0.6 ? Math.floor(Math.random() * 8) : 8 + Math.floor(Math.random() * 8);
      const z = ember ? CFG.emberSize : CFG.sparkSize; q.size = z[0] + Math.random() * (z[1] - z[0]); q.sway = Math.random() * 6;
    },
    // a new room: drop the fragments still in the air
    clear() { if (sparks) { sparks.n = 0; sparks.g.setDrawRange(0, 0); } },
    preload() { res(); }
  };
})();
