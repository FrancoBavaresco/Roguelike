'use strict';
/* HEXWRIGHT — the dungeon braziers (view only): a big cup on a short pedestal, with a painted, moving fire.
   Design: the artist's sketch art/braseros_fuego_verde.kra (Capa 1: the empty cup). The cup is built here from
   simple shared geometry: a stepped octagonal teal base, a short pedestal with a collar, three teal claw legs, a wide
   shallow bowl (dark lower band, grey upper band and thick rim, six teal straps), an inner dish that takes the fire's
   colour, and a few charred sticks. Static parts are merged per room by R.bakeChildren like before.

   Fire: the sketch's own flames (tools/brazier_sprites.py → public/textures/fx/brazier/flame_A/B/C.png) on a card
   that faces the camera, its foot on the coals, so the front rim hides the base and the fire comes out of the cup.
   It moves: a small shader bend (the tips sway more than the base, a lick travelling up the flame), the height
   breathing on two out-of-step waves, and a mirrored second copy fading in and out so the shape keeps changing.
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
    mpp: 0.0088,            // metres per sketch pixel for the flames (the sketch's cup is 146 px wide)
    fireY: 0.9,             // height of the coals (m, at cup 1)
    lightY: 2.4,            // height of the brazier's light (m)
    lightOut: 1.4,          // how far the light sits from the cup, toward the middle of the room (m)
    state: 'B',             // default state
    byRoom: { rest: 'A', shrine: 'A', merchant: 'A', treasure: 'A', mystery: 'A', elite: 'C', warden: 'C', arena: 'C', challenge: 'C' },
    states: {
      //       flame  size   breathe sway  lick   copy  glow  light (painted / classic) flicker sparks/s rise(m) life(s)
      A: { tex: 'A', scale: 1.0, breathe: 0.035, sway: 0.018, lick: 0.008, mirror: 0.16, glow: 0.8, light: [1.2, 0.7], flicker: 0.06, sparks: 0, rise: 0.5, life: 0.7, dish: 0.12 },
      B: { tex: 'B', scale: 1.0, breathe: 0.06, sway: 0.035, lick: 0.012, mirror: 0.22, glow: 1.1, light: [1.9, 1.1], flicker: 0.1, sparks: 2.2, rise: 0.8, life: 0.9, dish: 0.2 },
      C: { tex: 'C', scale: 1.0, breathe: 0.08, sway: 0.05, lick: 0.016, mirror: 0.26, glow: 1.4, light: [2.6, 1.5], flicker: 0.14, sparks: 6.5, rise: 1.5, life: 1.1, dish: 0.3 }
    },
    sparkMax: 96,           // fragments alive at once, all braziers together
    sparkSize: [0.11, 0.2], // m
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
    // the cup, at size 1: profile of the bowl's outside (radius, height), then the rim, then the dish inside
    const V = (r, y) => new THREE.Vector2(r, y);
    const outerLow = mk(new THREE.LatheGeometry([V(0.2, 0.6), V(0.38, 0.62), V(0.54, 0.7), V(0.62, 0.8)], 24));
    const outerHigh = mk(new THREE.LatheGeometry([V(0.62, 0.8), V(0.645, 0.86), V(0.655, 0.95)], 24));
    const rim = mk(new THREE.LatheGeometry([V(0.655, 0.95), V(0.68, 0.98), V(0.66, 1.02), V(0.6, 1.03), V(0.57, 1.0)], 24));
    const dish = mk(new THREE.LatheGeometry([V(0.57, 1.0), V(0.5, 0.94), V(0.36, 0.88), V(0.16, 0.85), V(0.001, 0.845)], 24));
    const base1 = mk(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 8)), base2 = mk(new THREE.CylinderGeometry(0.31, 0.36, 0.08, 8));
    const ped = mk(new THREE.CylinderGeometry(0.15, 0.22, 0.36, 8)), collar = mk(new THREE.CylinderGeometry(0.24, 0.19, 0.07, 8));
    const claw = mk(new THREE.ConeGeometry(0.075, 0.46, 4)); claw.rotateX(Math.PI);   // point down
    const strap = mk(new THREE.BoxGeometry(0.07, 0.24, 0.04));
    const stick = mk(new THREE.BoxGeometry(0.42, 0.05, 0.05));
    const plane = {}; for (const k of ['A', 'B', 'C']) { const F = CFG.flames[k], g = new THREE.PlaneGeometry(F.w, F.h); g.translate(F.w / 2 - F.pivot[0], F.pivot[1] - F.h / 2, 0); plane[k] = mk(g); }
    // matte like the rest of the dungeon; colours are the sketch's own (sRGB), turned linear for the renderer
    const std = (c, o) => mat(R.std(lin(c), o));
    shared = {
      tex, sparkTex, plane,
      geo: { outerLow, outerHigh, rim, dish, base1, base2, ped, collar, claw, strap, stick },
      mat: {
        low: std(0x202426, { metalness: 0.05, roughness: 0.85 }), high: std(0x3c4246, { metalness: 0.05, roughness: 0.85 }), rim: std(0x5a6066, { metalness: 0.05, roughness: 0.85 }),   // the sketch's greys
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
        transformed.x += (sin(uTime * 3.1 + uPhase) * 0.7 + sin(uTime * 5.3 + uPhase * 1.7) * 0.3) * uSway * hk;   // uSway in sketch px`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uLick, uPhase, uHue;
        vec3 hueTurn(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }`)
      .replace('#include <map_fragment>', `
        vec2 fuv = vUv; fuv.x += sin(fuv.y * 13.0 - uTime * 8.0 + uPhase) * uLick * fuv.y;   // a lick travelling up the flame
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
        void main() { float cx = mod(vCell, 4.0), cy = floor(vCell / 4.0); vec2 uv = (vec2(cx, 3.0 - cy) + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)) / 4.0;
          vec4 c = texture2D(tex, uv); if (c.a * vAlpha < 0.02) discard; gl_FragColor = vec4(hueTurn(c.rgb, uHue), c.a * vAlpha); }`,
      transparent: true, depthWrite: false
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; m.shared = true; g.shared = true;
    sparks = { pts, g, m, list: [] };
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
      add(G.base1, M.teal, 0.04); add(G.base2, M.tealDark, 0.12); add(G.ped, M.tealDark, 0.34); add(G.collar, M.teal, 0.53);
      add(G.outerLow, M.low); add(G.outerHigh, M.high); add(G.rim, M.rim);
      for (let c = 0; c < 3; c++) {   // claws: from under the bowl, down and out
        const a = c * Math.PI * 2 / 3 + 0.5, r0 = 0.36, r1 = 0.58, y0 = 0.64, y1 = 0.3;
        add(G.claw, M.claw, (y0 + y1) / 2, m => { m.position.x = Math.cos(a) * (r0 + r1) / 2; m.position.z = Math.sin(a) * (r0 + r1) / 2;
          const dir = new THREE.Vector3(Math.cos(a) * (r1 - r0), y1 - y0, Math.sin(a) * (r1 - r0)).normalize(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); });
      }
      for (let c = 0; c < 6; c++) {   // straps down the outside of the bowl
        const a = c * Math.PI / 3; add(G.strap, M.teal, 0.87, m => { m.position.x = Math.cos(a) * 0.645; m.position.z = Math.sin(a) * 0.645; m.lookAt(Math.cos(a) * 2, 0.87, Math.sin(a) * 2); m.rotateX(-0.12); });   // flat against the bowl, leaning with it
      }
      for (let c = 0; c < 4; c++) add(G.stick, M.stick, 0.87 + c * 0.012, m => { m.rotation.y = c * 0.8 + 0.3; m.rotation.z = (c % 2 ? 0.08 : -0.08); });
      // the dish: lit by its own fire (not merged: it flickers)
      const dishMat = R.std(lin(0x22282a), { metalness: 0.05, roughness: 0.85, emissive: new THREE.Color(theme.rune), emissiveIntensity: 0.2 });
      const dish = add(G.dish, dishMat); dish.userData.dish = true; dish.castShadow = false;
      R.chamber.add(g);
      // the fire: a card on the coals, facing the camera, and a mirrored copy
      const st = R.brazier.stateFor(room), hue = hueTo(theme.rune), ph = R.drand() * 7;
      const fire = new THREE.Group(); fire.position.set(x, CFG.fireY * k, z); fire.userData.fire = true;
      const mk2 = (phase, flip) => { const m = new THREE.Mesh(S.plane[CFG.states[st].tex], flameMat(S.tex[CFG.states[st].tex], hue, phase)); m.userData.overlay = true; m.renderOrder = 3; m.frustumCulled = false; if (flip) m.userData.flip = true; fire.add(m); return m; };
      const main = mk2(ph, false), copy = mk2(ph + 2.1, true);
      const glow = R.glowSprite(theme.rune, 1); glow.position.y = 0.12; fire.add(glow);
      R.chamber.add(fire);
      let light = null;
      if (i < 2 && H.settings.quality !== 'low') { light = R.brazierLights[i]; light.color.setHex(theme.rune); light.distance = H.settings.look === 'classic' ? 10 : 13; const toward = room && room.main ? Math.sign(((room.main.minX + room.main.maxX) / 2) - x) || 1 : 1;   // a little into the room: it lights the floor and walls, not its own cup from up close
        light.position.set(x + toward * CFG.lightOut, CFG.lightY, z); }
      const b = { x, z, fire, main, copy, glow, dishMat, light, ph, state: st, hue, spawn: 0, color: theme.rune };
      R.brazier.apply(b, st);
      const sp = sparkSystem(); if (!sp.pts.parent) R.fx.add(sp.pts);
      return b;
    },
    // switch one brazier to a state (A, B, C)
    apply(b, st) {
      const S = res(), c = CFG.states[st] || CFG.states.B; b.state = st; b.c = c;
      for (const m of [b.main, b.copy]) { m.geometry = S.plane[c.tex]; m.material.map = S.tex[c.tex]; m.material.needsUpdate = true; }
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
        // breathing height and a little width, out of step
        const hy = 1 + c.breathe * (0.6 * w1 + 0.4 * w2), hx = 1 - c.breathe * 0.4 * w1 + c.breathe * 0.2 * w3;
        const s = CFG.mpp * c.scale;
        b.fire.quaternion.copy(cam.quaternion);
        b.main.scale.set(s * hx, s * hy, 1);
        b.copy.scale.set(-s * (2 - hx) * 0.97, s * (1 + c.breathe * 0.5 * Math.sin(t * 3.3 + b.ph + 1.5)), 1);
        const mo = c.mirror * (0.5 + 0.5 * Math.sin(t * 1.7 + b.ph));   // the copy fades in and out: the shape keeps changing
        b.main.material.opacity = 1 - mo * 0.5; b.copy.material.opacity = mo;
        for (const m of [b.main, b.copy]) { const u = m.material.userData.u; u.uTime.value = t; u.uSway.value = c.sway / CFG.mpp; u.uLick.value = c.lick; }
        const f = 1 + c.flicker * (0.6 * w2 + 0.4 * w3);
        b.glow.scale.setScalar(c.glow * f); b.glow.material.opacity = 0.55;
        b.dishMat.emissiveIntensity = c.dish * f;
        if (b.light) b.light.intensity = c.light[look] * f;
        // fragments: flakes leave the fire now and then, rise and fade
        if (sp && c.sparks > 0) {
          b.spawn += dt * c.sparks * (0.6 + 0.4 * (w1 * 0.5 + 0.5));
          while (b.spawn >= 1 && sp.list.length < CFG.sparkMax) {
            b.spawn -= 1; const a = Math.random() * 6.283, r = Math.random() * 0.22 * CFG.cup;
            sp.list.push({ x: b.x + Math.cos(a) * r, y: (CFG.fireY + 0.15) * CFG.cup, z: b.z + Math.sin(a) * r, vx: (Math.random() - 0.5) * 0.25, vy: c.rise / c.life * (0.7 + Math.random() * 0.6), vz: (Math.random() - 0.5) * 0.25,
              t: 0, life: c.life * (0.6 + Math.random() * 0.6), cell: Math.random() < 0.6 ? Math.floor(Math.random() * 8) : 8 + Math.floor(Math.random() * 8), size: CFG.sparkSize[0] + Math.random() * (CFG.sparkSize[1] - CFG.sparkSize[0]), hue: b.hue, sway: Math.random() * 6 });
          }
          if (b.spawn > 1) b.spawn = 1;
        }
      }
      if (sp) {
        const L = sp.list, P = sp.g.attributes.position.array, C = sp.g.attributes.aCell.array, Z = sp.g.attributes.aSize.array, A = sp.g.attributes.aAlpha.array;
        let n = 0;
        for (let i = 0; i < L.length; i++) {
          const q = L[i]; q.t += dt; if (q.t >= q.life) continue;
          q.x += (q.vx + Math.sin(q.t * 6 + q.sway) * 0.15) * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy *= Math.exp(-dt * 0.8);
          const k = q.t / q.life; L[n] = q;
          P[n * 3] = q.x; P[n * 3 + 1] = q.y; P[n * 3 + 2] = q.z; C[n] = q.cell; Z[n] = q.size * (1 - 0.5 * k); A[n] = Math.min(1, k * 6) * (1 - k * k); n++;
        }
        L.length = n;
        for (const a of ['position', 'aCell', 'aSize', 'aAlpha']) sp.g.attributes[a].needsUpdate = true;
        sp.g.setDrawRange(0, n);
        if (list[0]) sp.m.uniforms.uHue.value = list[0].hue;
        // point size: metres → pixels for the current camera (orthographic or perspective at the fires' distance)
        const hpx = R.renderer ? R.renderer.getDrawingBufferSize(R._v2 || (R._v2 = new (T().Vector2)())).y / 2 : 300;
        sp.m.uniforms.uScale.value = cam.isOrthographicCamera ? hpx * cam.zoom / ((cam.top - cam.bottom) / 2) : hpx * cam.projectionMatrix.elements[5] / 12;
      }
    },
    // a new room: drop the fragments still in the air
    clear() { if (sparks) { sparks.list.length = 0; sparks.g.setDrawRange(0, 0); } },
    preload() { res(); }
  };
})();
