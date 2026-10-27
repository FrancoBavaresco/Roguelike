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
   Layers, back to front, all from the same drawings: a mirrored copy fading in and out, the next drawing (alt)
   melted in a little at the slow pulse's peak, the main drawing (dominant), its bright heart (core: only the light
   centre of the drawing, smaller, on its own rhythm), and a few tongues (the top of the drawing on small cards) that
   break off, rise, stretch thin and fade. Each layer has its own speed and phase.
   The shader moves the paint without redrawing it: the tips sway more than the foot, licks travel up the flame, and
   a moving noise across the width makes single tongues reach up or sink (the card has room above the drawing for
   that), so the silhouette never deforms as one piece; a faint light/dark drift moves up through the paint.
   The height breathes on two out-of-step waves over a slow pulse (CFG.states[].pulse/period: the flame grows and
   shrinks). Each brazier runs on its own clock (CFG.speedVar) and phase, so no two are in step.
   Particles, born inside the flame and capped per brazier and in total (one fixed pool, one draw call): painted
   flakes (green and white, sparks.png), small embers (the atlas's 5th row) and brief twinkling flashes; each has its
   own life, rise, wobble and fade. A soft glow sits on the coals. The colour turns from the painted green to the
   depth's own fire colour (theme.rune) by a hue shift.

   Three states, same cup (CFG.states): A small steady flame, faint light, no fragments; B medium flame, livelier,
   a few flakes now and then, more light; C tall flame, strong motion, flakes rising, most light. There is no game
   mechanic for them: the state is picked per room (CFG.byRoom, the same for every brazier of a room; CFG.state is
   the default), and R.brazier.setState(state) changes a room's braziers live.

   Lights: the existing fixed pool of two point lights (no shader recompiles between rooms) serves the first two
   braziers, at the fire's height, with the state's intensity and flicker; there is no extra light.
   Resources: geometries, the cup's materials and the textures are shared and kept between rooms; each brazier has
   its own flame materials (their uniforms: 4 layers and CFG.tipsPer tongues), freed with the room. Nothing is created
   per frame. */
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
      // tex: flame drawing; breathe: quick height wobble; sway (sketch-px-scaled m) / lick (uv): the bend and the ripple
      // up the flame; tongue: how far single tongues stretch up on their own (uv, by a moving noise across the width);
      // mirror: the mirrored copy's peak opacity; core: the inner flame layer's opacity; pulse: the slow grow/shrink (±,
      // of the height) over period (s); alt/altAt/altMax: the drawing it melts into at the pulse's peak (1) or trough
      // (-1), and how much; tips: tongues per second that break off the top, rise (tipRise m) and fade; light: [painted,
      // classic]; sparks / embers / flashes: per second; rise (m) and life (s) of the flakes
      A: { tex: 'A', scale: 1.0, breathe: 0.05, sway: 0.03, lick: 0.014, tongue: 0.16, mirror: 0.16, core: 0.35, pulse: 0.12, period: 3.4, alt: 'B', altAt: 1, altMax: 0.35, tips: 0.7, tipRise: 0.22, glow: 0.85, light: [1.2, 0.7], flicker: 0.07, sparks: 0.3, embers: 1.2, flashes: 0.6, rise: 0.6, life: 0.8, dish: 0.14 },
      B: { tex: 'B', scale: 1.0, breathe: 0.06, sway: 0.045, lick: 0.018, tongue: 0.2, mirror: 0.2, core: 0.38, pulse: 0.14, period: 3.0, alt: 'C', altAt: 1, altMax: 0.35, tips: 1.1, tipRise: 0.3, glow: 1.1, light: [1.9, 1.1], flicker: 0.1, sparks: 1.2, embers: 2.5, flashes: 1.2, rise: 0.9, life: 1.0, dish: 0.22 },
      C: { tex: 'C', scale: 1.0, breathe: 0.07, sway: 0.06, lick: 0.022, tongue: 0.24, mirror: 0.22, core: 0.4, pulse: 0.15, period: 2.6, alt: 'B', altAt: -1, altMax: 0.25, tips: 1.6, tipRise: 0.4, glow: 1.35, light: [2.6, 1.5], flicker: 0.14, sparks: 2.5, embers: 4, flashes: 2, rise: 1.4, life: 1.1, dish: 0.32 }
    },
    speedVar: 0.12,         // each brazier runs its fire this much faster or slower (±), so no two are in step
    tipsPer: 3,             // tongue cards per brazier (a fixed set, reused)
    sparkMax: 160,          // fragments alive at once, all braziers together (a fixed pool)
    perBrazier: 26,         // ...and per brazier
    sparkSize: [0.07, 0.12],   // m (painted flakes)
    emberSize: [0.035, 0.07],  // m (embers and flashes)
    // the flame cards have room round the drawing (in drawing widths/heights) for the tongues to stretch into
    pad: { x: 0.12, top: 0.32 },
    // sketch frames (from brazier.json): crop size and the flame's foot (px)
    flames: { A: { w: 48, h: 61, pivot: [22, 68] }, B: { w: 75, h: 78, pivot: [31, 81] }, C: { w: 109, h: 127, pivot: [58, 126] } },
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
    // flame cards in sketch px, foot at the origin, with room round the drawing (uv outside 0–1 is empty unless a
    // tongue stretches into it); and per drawing a few tip pieces (the top of the flame, in uv) for the tongues that
    // break off
    const card = (F, u0, u1, v0, v1, ox, oy) => { const g = new THREE.PlaneGeometry(1, 1), P = g.attributes.position, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) { const u = U.getX(i) ? u1 : u0, v = U.getY(i) ? v1 : v0; U.setXY(i, u, v); P.setXYZ(i, u * F.w - F.pivot[0] - ox, F.pivot[1] - F.h + v * F.h - oy, 0); }
      return mk(g); };
    const plane = {}, tips = {};
    for (const k of ['A', 'B', 'C']) { const F = CFG.flames[k]; plane[k] = card(F, -CFG.pad.x, 1 + CFG.pad.x, 0, 1 + CFG.pad.top, 0, 0);
      tips[k] = [0.3, 0.5, 0.7].map(c => { const ox = c * F.w - F.pivot[0], oy = F.pivot[1] - F.h + 0.55 * F.h; const g = card(F, c - 0.16, c + 0.16, 0.55, 1.0, ox, oy); g.userData.at = [ox, oy]; return g; }); }
    // matte like the rest of the dungeon; colours are the sketch's own (sRGB), turned linear for the renderer
    const std = (c, o) => mat(R.std(lin(c), o));
    shared = {
      tex, sparkTex, plane, tips,
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
    m.userData.u = { uTime: { value: 0 }, uSway: { value: 0.03 }, uLick: { value: 0.01 }, uTongue: { value: 0.15 }, uPhase: { value: phase }, uHue: { value: hue }, uCut: { value: -1 }, uCore: { value: 0 } };
    m.onBeforeCompile = flameShader;
    return m;
  }
  function flameShader(shader) {
    Object.assign(shader.uniforms, this.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uSway, uPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hk = clamp(uv.y, 0.0, 1.3); hk *= hk;   // the tips move, the foot stays on the coals
        transformed.x += (sin(uTime * 1.7 + uPhase) * 0.45 + sin(uTime * 3.1 + uPhase * 1.3) * 0.35 + sin(uTime * 5.3 + uPhase * 1.7) * 0.2) * uSway * hk;   // uSway in sketch px`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uLick, uTongue, uPhase, uHue, uCut, uCore;
        vec3 hueTurn(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }
        float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fhash(i), fhash(i + vec2(1.0, 0.0)), f.x), mix(fhash(i + vec2(0.0, 1.0)), fhash(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `
        vec2 fuv = vUv; float hy = clamp(vUv.y, 0.0, 1.3);
        // tongues: a noise moving across the width and in time; where it is high the column is sampled lower, so that
        // part of the top reaches up, where it is low it sinks: the silhouette never deforms as one piece
        float tg = fnoise(vec2(vUv.x * 5.0 + uPhase * 3.0, uTime * 1.6 + uPhase)) * 0.7 + fnoise(vec2(vUv.x * 11.0 - uPhase, uTime * 3.1)) * 0.3 - 0.42;
        fuv.y -= tg * uTongue * hy * hy;
        fuv.x += (sin(fuv.y * 11.0 - uTime * 7.0 + uPhase) * 0.7 + sin(fuv.y * 23.0 - uTime * 13.0 + uPhase * 2.0) * 0.3) * uLick * fuv.y;   // licks travelling up the flame
        vec4 texelColor = texture2D(map, clamp(fuv, 0.0, 1.0)); texelColor = mapTexelToLinear(texelColor);
        texelColor.a *= step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0) * smoothstep(uCut, uCut + 0.14, fuv.y);
        // inner life: a soft light/dark pattern drifting up through the paint (small, keeps the drawing's colours)
        texelColor.rgb *= 0.9 + 0.2 * fnoise(vec2(fuv.x * 4.0 + uPhase, fuv.y * 3.0 - uTime * 2.2));
        // the inner flame layer keeps only the drawing's bright heart
        float lum = dot(texelColor.rgb, vec3(0.3, 0.55, 0.15));
        texelColor.a *= mix(1.0, smoothstep(0.3, 0.62, lum), uCore);
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
    const pool = []; for (let i = 0; i < N; i++) pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 1, cell: 0, size: 0.1, sway: 0, drag: 0.8, wf: 4, wa: 0.1, kind: 0, b: null });
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
      const mk2 = (phase, flip, geo) => { const m = new THREE.Mesh(geo || S.plane[CFG.states[st].tex], flameMat(S.tex[CFG.states[st].tex], hue, phase)); m.userData.overlay = true; m.renderOrder = 3; m.frustumCulled = false; if (flip) m.userData.flip = true; fire.add(m); return m; };
      // layers, back to front: the mirrored copy, the next drawing (alt, melted in at the pulse), the main drawing,
      // its bright heart (core, smaller, on its own rhythm), and the tongues that break off the top
      const copy = mk2(ph + 2.1, true), alt = mk2(ph + 4.2, false), main = mk2(ph, false), core = mk2(ph + 1.3, false);
      core.material.userData.u.uCore.value = 1;
      const tips = []; for (let n = 0; n < CFG.tipsPer; n++) { const m = mk2(ph + 0.7 * n, false, S.tips[CFG.states[st].tex][0]); m.material.userData.u.uCut.value = 0.55; m.visible = false; tips.push({ m, t: 0, life: 1, on: false, k: 0, dx: 0 }); }
      const glow = R.glowSprite(theme.rune, 1); glow.position.y = 0.12; fire.add(glow);
      R.chamber.add(fire);
      let light = null;
      if (i < 2 && H.settings.quality !== 'low') { light = R.brazierLights[i]; light.color.setHex(theme.rune); light.distance = H.settings.look === 'classic' ? 10 : 13; const toward = room && room.main ? Math.sign(((room.main.minX + room.main.maxX) / 2) - x) || 1 : 1;   // a little into the room: it lights the floor and walls, not its own cup from up close
        light.position.set(x + toward * CFG.lightOut, CFG.lightY, z); }
      const hz = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, rate = 1 + ((hz - Math.floor(hz)) * 2 - 1) * CFG.speedVar;   // from its place: the room's own random sequence is left untouched
      const b = { x, z, fire, main, copy, alt, core, tips, glow, dishMat, light, ph, rate, state: st, hue, spawn: 0, ember: 0, flash: 0, tip: 0.3, alive: 0, color: theme.rune };
      R.brazier.apply(b, st);
      const sp = sparkSystem(); if (!sp.pts.parent) R.fx.add(sp.pts);
      return b;
    },
    // switch one brazier to a state (A, B, C)
    apply(b, st) {
      const S = res(), c = CFG.states[st] || CFG.states.B; b.state = st; b.c = c;
      for (const m of [b.main, b.copy, b.core]) { m.geometry = S.plane[c.tex]; m.material.map = S.tex[c.tex]; m.material.needsUpdate = true; }
      for (const q of b.tips) { q.on = false; q.m.visible = false; q.m.material.map = S.tex[c.tex]; q.m.material.needsUpdate = true; }
      b.alt.geometry = S.plane[c.alt]; b.alt.material.map = S.tex[c.alt]; b.alt.material.needsUpdate = true;
      b.altK = CFG.flames[c.tex].h / CFG.flames[c.alt].h;   // the alt drawing is sized to the flame's own height
      b.dishMat.emissiveIntensity = c.dish;
    },
    // every brazier of the current room (no game mechanic uses this; for tuning and future use)
    setState(st) { if (H.G.room) H.G.room.brazierState = st; for (const b of R.braziers || []) R.brazier.apply(b, st); },
    tick(dt, t) {
      const cam = R.camera, look = H.settings.look === 'classic' ? 1 : 0, list = R.braziers || [];
      const sp = sparks, S = shared;
      for (const b of list) {
        if (!b.fire) continue;
        const c = b.c, tb = t * b.rate;   // each brazier on its own clock
        const w1 = Math.sin(tb * 2.3 + b.ph), w2 = Math.sin(tb * 5.7 + b.ph * 1.3), w3 = Math.sin(tb * 11 + b.ph * 0.7);
        // the slow pulse: the flame grows and shrinks on a smooth cycle (a sine with a little second harmonic, so it
        // rises slowly and sinks a bit quicker, like a real fire drawing breath)
        const ph = tb * 6.2832 / c.period + b.ph, e = Math.sin(ph) * 0.85 + Math.sin(ph * 2 + 0.6) * 0.15;
        const hy = (1 + c.pulse * e) * (1 + c.breathe * (0.6 * w1 + 0.4 * w2));
        const hx = (1 + c.pulse * 0.4 * e) * (1 - c.breathe * 0.4 * w1 + c.breathe * 0.2 * w3);
        const s = CFG.mpp * c.scale;
        b.fire.quaternion.copy(cam.quaternion);
        b.main.scale.set(s * hx, s * hy, 1);
        b.copy.scale.set(-s * (2 - hx) * 0.97 * (1 + c.pulse * 0.4 * e), s * (1 + c.pulse * e) * (1 + c.breathe * 0.5 * Math.sin(tb * 3.3 + b.ph + 1.5)), 1);
        // the heart: smaller, a little lower, breathing on its own rhythm
        const w4 = Math.sin(tb * 3.9 + b.ph * 2.1), w5 = Math.sin(tb * 7.3 + b.ph * 0.4);
        b.core.scale.set(s * hx * (0.8 + 0.04 * w5), s * hy * (0.74 + 0.07 * w4), 1);
        b.core.material.opacity = c.core * (0.8 + 0.2 * w5);
        // at the pulse's peak (or trough) the next drawing melts in a little: the flame changes shape as it grows
        const x = e * c.altAt, wa = c.altMax * (x <= 0.3 ? 0 : x >= 0.95 ? 1 : ((x - 0.3) / 0.65) * ((x - 0.3) / 0.65) * (3 - 2 * (x - 0.3) / 0.65));
        const ak = s * b.altK; b.alt.scale.set(ak * hx * (1 - 0.1 * w3), ak * hy, 1);
        const mo = c.mirror * (0.5 + 0.5 * Math.sin(tb * 1.7 + b.ph));   // the copy fades in and out: the shape keeps changing
        b.main.material.opacity = (1 - mo * 0.4) * (1 - wa * 0.5); b.copy.material.opacity = mo * (1 - wa); b.alt.material.opacity = wa;
        b.alt.visible = wa > 0.001;
        for (const m of [b.main, b.copy, b.alt]) { const u = m.material.userData.u; u.uTime.value = tb; u.uSway.value = c.sway / CFG.mpp; u.uLick.value = c.lick; u.uTongue.value = c.tongue; }
        { const u = b.core.material.userData.u; u.uTime.value = tb * 1.3 + 3; u.uSway.value = c.sway * 0.7 / CFG.mpp; u.uLick.value = c.lick * 1.3; u.uTongue.value = c.tongue * 0.6; }
        // tongues breaking off the top: each rises, stretches thin and fades, then waits to be used again
        b.tip -= dt * c.tips * (0.7 + 0.6 * Math.max(0, e));
        if (b.tip <= 0) { b.tip = 0.4 + Math.random() * 0.9; let q = null; for (const o of b.tips) if (!o.on) { q = o; break; }
          if (q) { const k = Math.floor(Math.random() * 3); q.on = true; q.t = 0; q.life = 0.55 + Math.random() * 0.45; q.k = k; q.dx = (Math.random() - 0.5) * 0.4; q.rise = c.tipRise * (0.7 + Math.random() * 0.6);
            q.m.geometry = S.tips[c.tex][k]; q.m.visible = true; } }
        for (const q of b.tips) {
          if (!q.on) continue;
          q.t += dt; const k = q.t / q.life;
          if (k >= 1) { q.on = false; q.m.visible = false; continue; }
          const at = q.m.geometry.userData.at, ease = 1 - (1 - k) * (1 - k);
          q.m.position.set(at[0] * s * hx + q.dx * ease * 0.15, at[1] * s * hy + q.rise * ease, 0.002);
          q.m.scale.set(s * hx * (1 - 0.5 * k), s * hy * (1 + 0.8 * k), 1);
          q.m.material.opacity = Math.min(1, k / 0.12) * (1 - k) * (1 - k) * 0.9;
          const u = q.m.material.userData.u; u.uTime.value = tb + q.k; u.uSway.value = c.sway * 1.5 / CFG.mpp; u.uLick.value = c.lick * 1.5; u.uTongue.value = 0;
        }
        const f = (1 + c.flicker * (0.6 * w2 + 0.4 * w3)) * (1 + c.pulse * 0.25 * e);
        b.glow.scale.setScalar(c.glow * f); b.glow.material.opacity = 0.45;
        b.dishMat.emissiveIntensity = c.dish * f;
        if (b.light) b.light.intensity = c.light[look] * f;
        if (!sp) continue;
        // particles: a few painted flakes, a light stream of embers and brief flashes, all born inside the flame
        const gust = 0.6 + 0.4 * (w1 * 0.5 + 0.5) + 0.4 * Math.max(0, e);
        b.spawn = Math.min(b.spawn + dt * c.sparks * gust, 2); b.ember = Math.min(b.ember + dt * c.embers * gust, 2); b.flash = Math.min(b.flash + dt * c.flashes * (0.5 + Math.random()), 2);
        const cap = Math.min(CFG.sparkMax - sp.n, CFG.perBrazier - b.alive);
        for (let n = 0; n < cap; n++) {
          if (b.spawn >= 1) { b.spawn -= 1; R.brazier._emit(b, c, 0, hy); } else if (b.ember >= 1) { b.ember -= 1; R.brazier._emit(b, c, 1, hy); } else if (b.flash >= 1) { b.flash -= 1; R.brazier._emit(b, c, 2, hy); } else break;
        }
      }
      if (sp) {
        const L = sp.pool, P = sp.g.attributes.position.array, C = sp.g.attributes.aCell.array, Z = sp.g.attributes.aSize.array, A = sp.g.attributes.aAlpha.array;
        let i = 0;
        while (i < sp.n) {
          const q = L[i]; q.t += dt;
          if (q.t >= q.life) { if (q.b) q.b.alive--; q.b = null; L[i] = L[sp.n - 1]; L[sp.n - 1] = q; sp.n--; continue; }   // swap the dead one out of the live range
          q.x += (q.vx + Math.sin(q.t * q.wf + q.sway) * q.wa) * dt; q.y += q.vy * dt; q.z += (q.vz + Math.cos(q.t * q.wf * 0.8 + q.sway) * q.wa * 0.7) * dt; q.vy *= Math.exp(-dt * q.drag);
          const k = q.t / q.life;
          let al = Math.min(1, k * 6) * (1 - k * k);
          if (q.kind === 2) al = Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(q.t * 47 + q.sway));   // a flash: a quick twinkle
          else if (q.kind === 1) al *= 0.8 + 0.2 * Math.sin(q.t * 19 + q.sway);
          P[i * 3] = q.x; P[i * 3 + 1] = q.y; P[i * 3 + 2] = q.z; C[i] = q.cell; Z[i] = q.size * (q.kind === 2 ? 0.6 + 0.6 * Math.sin(Math.PI * k) : 1 - 0.5 * k); A[i] = al; i++;
        }
        for (const a of ['position', 'aCell', 'aSize', 'aAlpha']) sp.g.attributes[a].needsUpdate = true;
        sp.g.setDrawRange(0, sp.n);
        if (list[0]) sp.m.uniforms.uHue.value = list[0].hue;
        // point size: metres → pixels for the current camera (orthographic or perspective at the fires' distance)
        const hpx = R.renderer ? R.renderer.getDrawingBufferSize(R._v2 || (R._v2 = new (T().Vector2)())).y / 2 : 300;
        sp.m.uniforms.uScale.value = cam.isOrthographicCamera ? hpx * cam.zoom / ((cam.top - cam.bottom) / 2) : hpx * cam.projectionMatrix.elements[5] / 12;
      }
    },
    // one particle from a fire, taken from the pool: kind 0 a painted flake, 1 an ember, 2 a brief flash. It is born
    // inside the flame (round its axis, low to mid height), rises, drifts on its own wobble and fades
    _emit(b, c, kind, hy) {
      const sp = sparks, q = sp.pool[sp.n++], a = Math.random() * 6.283, F = CFG.flames[c.tex];
      const fh = F.h * CFG.mpp * c.scale * hy, r = Math.sqrt(Math.random()) * Math.min(0.2, F.w * CFG.mpp * 0.3) * CFG.cup;
      q.b = b; b.alive++; q.kind = kind;
      q.x = b.x + Math.cos(a) * r; q.z = b.z + Math.sin(a) * r; q.y = CFG.fireY * CFG.cup + fh * (kind === 2 ? 0.2 + Math.random() * 0.6 : 0.1 + Math.random() * 0.35);
      q.vx = (Math.random() - 0.5) * 0.2; q.vz = (Math.random() - 0.5) * 0.2;
      q.t = 0; q.life = kind === 2 ? 0.12 + Math.random() * 0.2 : c.life * (kind === 1 ? 0.5 + Math.random() * 0.6 : 0.6 + Math.random() * 0.6);
      q.vy = kind === 2 ? 0.15 + Math.random() * 0.2 : (kind === 1 ? 1.3 : 1) * c.rise / c.life * (0.6 + Math.random() * 0.8); q.drag = kind === 1 ? 1.3 : 0.9;
      q.wf = 3 + Math.random() * 6; q.wa = 0.05 + Math.random() * 0.15; q.sway = Math.random() * 6.283;
      q.cell = kind ? 16 + Math.floor(Math.random() * 4) : Math.random() < 0.6 ? Math.floor(Math.random() * 8) : 8 + Math.floor(Math.random() * 8);
      const z = kind ? CFG.emberSize : CFG.sparkSize; q.size = (z[0] + Math.random() * (z[1] - z[0])) * (kind === 2 ? 1.3 : 1);
    },
    // a new room: drop the fragments still in the air
    clear() { if (sparks) { for (let i = 0; i < sparks.n; i++) sparks.pool[i].b = null; sparks.n = 0; sparks.g.setDrawRange(0, 0); } },
    preload() { res(); }
  };
})();
