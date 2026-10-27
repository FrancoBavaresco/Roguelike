'use strict';
/* HEXWRIGHT — renderer: scene, chambers, models, telegraphs, particles, camera */
const R = H.R = { ready: false, t: 0 };
/* Cosmetic randomness for animation (sparks, wobble) has its own generator, so how often the view
   animates can never change the game's random outcomes (drops, AI choices, revives...). */
R.vrand = (() => { let s = 0x9e3779b9; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
// Scenery randomness has its own generator, seeded from the room's layout: building a room never draws
// from Math.random (the game's own randomness), and the same room always looks the same.
R.mulberry = seed => { let s = seed | 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
R.drand = R.mulberry(0x51ed27);
R.drandRange = (a, b) => a + R.drand() * (b - a);
R.decorRng = function (room) {
  let h = 2166136261; const mix = v => { h ^= Math.round(v * 100) | 0; h = Math.imul(h, 16777619); };
  const b = room.bounds; mix(b.minX); mix(b.maxX); mix(b.minZ); mix(b.maxZ);
  for (const p of room.pillars || []) { mix(p.x); mix(p.z); mix(p.r); } for (const p of room.pits || []) { mix(p.x); mix(p.z); mix(p.r); }
  for (const d of room.doors || []) mix(d.x);
  return R.mulberry(h);
};
const T3 = () => window.THREE;

R.init = function (canvas) {
  const THREE = T3();
  R.canvas = canvas;
  const renderer = R.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = R.scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120e19);
  scene.fog = new THREE.Fog(0x120e19, 24, 58);
  const cam = R.persCam = R.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 200);
  cam.position.set(0, 20, 14); cam.lookAt(0, 0, 0);
  // fixed isometric view (Hades-like): orthographic, 45° yaw, looking down at ISO.pitch
  R.orthoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.5, 220);
  R.hemi = new THREE.HemisphereLight(0xb7a8ff, 0x0a0810, 0.3); scene.add(R.hemi);
  const key = R.key = new THREE.DirectionalLight(0xffd9b0, 0.6); key.position.set(-8, 18, 6);
  key.shadow.mapSize.set(1024, 1024); const sc = key.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 50; key.shadow.bias = -0.0015;
  scene.add(key); scene.add(key.target);
  R.chamber = new THREE.Group(); scene.add(R.chamber);
  R.ents = new THREE.Group(); scene.add(R.ents);
  R.fx = new THREE.Group(); scene.add(R.fx);
  R.makeTextures();
  R.initParticles();
  R.initGroundMarks();
  R.initTelegraphMat();
  // cursor reticle
  const ret = R.reticle = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.85, depthWrite: false }));
  ret.rotation.x = -Math.PI / 2; ret.position.y = 0.06; ret.visible = false; scene.add(ret);
  const ret2 = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), ret.material); ret.add(ret2);
  // pooled lights for impacts
  R.flashLights = [];
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 2); l.position.y = 1.2; scene.add(l); R.flashLights.push({ l, t: 0, dur: 1, i0: 0 }); }
  // brazier lights come from a fixed pool: the number of lights never changes between rooms, so no shader recompiles
  R.brazierLights = []; for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.position.y = 1.8; scene.add(l); R.brazierLights.push(l); }
  // cool rim light from behind the isometric view: separates characters from the floor (painted look)
  R.rim = new THREE.DirectionalLight(0x8fa8ff, 0.45); R.rim.position.set(-10, 9, -12); scene.add(R.rim);
  R.rings = []; R.bolts = []; R.decals = []; R.arcs = [];
  R.shakeT = 0; R.kick = { x: 0, z: 0 }; R.camPos = new THREE.Vector3(0, 20, 14); R.camLook = new THREE.Vector3();
  R.follow = { x: 0, z: 0, zoom: 1 };
  R.raycaster = new THREE.Raycaster(); R.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  R.applyQuality(); R.setCameraMode(H.settings.camera || 'iso'); R.resize();
  window.addEventListener('resize', R.resize);
  R.ready = true;
  R.loadWeaponModels();
  if (R.slashFx) R.slashFx.preload();   // Theron's painted slash texture (tiny; ready before the first swing)
  if (R.dashFx) R.dashFx.preload();
  if (R.brazier) R.brazier.preload();   // the braziers' cup geometry and fire textures
  // marble and rock are shared by every room: prepare them while the menu is up, so no room stalls building them
  setTimeout(() => { try { if (H.settings.look !== 'classic') { R.rockTextures(); R.mixFloorMaterial(); R.pillarMats(); R.marbleTextures('beige'); setTimeout(() => R.marbleTextures('grey'), 300); } } catch (e) { /* built on demand instead */ } }, 1200);
};
R.applyQuality = function () {
  const q = H.settings.quality;
  const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
  R.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 0.85) : dpr);
  R.renderer.shadowMap.enabled = q === 'high';
  R.key.castShadow = q === 'high';
  R.maxParticles = q === 'low' ? 1400 : q === 'medium' ? 2600 : 4000;
  R.resize();
};
R.resize = function () {
  const w = window.innerWidth, h = window.innerHeight;
  R.renderer.setSize(w, h, false);
  R.persCam.aspect = w / h; R.persCam.updateProjectionMatrix();
  R.vw = w; R.vh = h;
  R.bufH = R.renderer.getDrawingBufferSize(new (T3().Vector2)()).y;
  // particle size: perspective divides by depth; orthographic uses pixels per world unit (set in updateCamera)
  if (R.pMat && R.camMode !== 'iso') R.pMat.uniforms.uScale.value = R.bufH / (2 * Math.tan(R.persCam.fov * Math.PI / 360));
};

/* ---------------- Textures ---------------- */
R.canvasTex = function (w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new (T3().CanvasTexture)(c); t.encoding = T3().sRGBEncoding; return t;
};
R.makeTextures = function () {
  R.texGlow = R.canvasTex(64, 64, (c, w) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  R.texStar = R.canvasTex(64, 64, (c) => {
    c.translate(32, 32); c.fillStyle = '#fff';
    c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 11 : 30; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill();
  });
  R.texRune = R.canvasTex(256, 256, (c) => {
    c.translate(128, 128); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 118, 0, 7); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 100, 0, 7); c.stroke();
    for (let i = 0; i < 12; i++) { c.save(); c.rotate(i / 12 * Math.PI * 2); c.beginPath(); c.moveTo(0, -100); c.lineTo(6, -112); c.lineTo(-4, -116); c.stroke(); c.restore(); }
    c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 5; i++) { const a = i * 4 * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * 92, Math.sin(a) * 92); } c.stroke();
  });
  R.texCrack = R.canvasTex(128, 128, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.lineCap = 'round';
    for (let k = 0; k < 5; k++) { c.beginPath(); let x = 64, y = 64; c.moveTo(x, y); const a0 = Math.random() * 7; for (let i = 0; i < 6; i++) { x += Math.cos(a0 + Math.random() - .5) * 12; y += Math.sin(a0 + Math.random() - .5) * 12; c.lineTo(x, y); } c.stroke(); }
  });
};
R.glyphTexture = function (glyph, color, label) {
  return R.canvasTex(256, 256, (c) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 256, 256);
    c.shadowColor = color; c.shadowBlur = 18;
    H.drawGlyph(c, glyph, 128, label ? 100 : 128, 130, color, 2.2);
    if (label) { c.shadowBlur = 8; let fs = 30; const txt = label.toUpperCase(); do { c.font = '600 ' + fs + 'px "Alegreya Sans SC", "Alegreya Sans", serif'; fs -= 2; } while (fs > 14 && c.measureText(txt).width > 244); c.fillStyle = '#efe6d2'; c.textAlign = 'center'; c.fillText(txt, 128, 222); }
  });
};

/* ---------------- Particles ---------------- */
R.initParticles = function () {
  const THREE = T3(), N = 4000; R.PN = N;
  const g = new THREE.BufferGeometry();
  R.pPos = new Float32Array(N * 3); R.pCol = new Float32Array(N * 4); R.pSize = new Float32Array(N);
  g.setAttribute('position', new THREE.BufferAttribute(R.pPos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('pcolor', new THREE.BufferAttribute(R.pCol, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(R.pSize, 1).setUsage(THREE.DynamicDrawUsage));
  R.pMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 }, uOrtho: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float size; attribute vec4 pcolor; varying vec4 vC; uniform float uScale; uniform float uOrtho; void main(){ vC=pcolor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(1.0,size*uScale/mix(-mv.z,1.0,uOrtho)); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard; float core=1.0-smoothstep(0.0,0.45,d); float a=(1.0-d)*(1.0-d); gl_FragColor=vec4(vC.rgb+core*0.55, vC.a*a); }'
  });
  R.points = new THREE.Points(g, R.pMat); R.points.frustumCulled = false; R.scene.add(R.points);
  R.P = []; // particle objects pool
  for (let i = 0; i < N; i++) R.P.push({ on: false });
  R.pCount = 0; R.pCursor = 0;
};
const _c = { r: 1, g: 1, b: 1 };
function hexToRgb(hex) { _c.r = ((hex >> 16) & 255) / 255; _c.g = ((hex >> 8) & 255) / 255; _c.b = (hex & 255) / 255; return _c; }
R.emit = function (x, y, z, vx, vy, vz, life, s0, s1, color, alpha = 1, grav = 0, drag = 1.5) {
  const max = R.maxParticles || 4000;
  let p = null;
  for (let k = 0; k < 64; k++) { const i = R.pCursor; R.pCursor = (R.pCursor + 1) % max; if (!R.P[i].on) { p = R.P[i]; break; } }
  if (!p) { p = R.P[R.pCursor]; R.pCursor = (R.pCursor + 1) % max; }
  const c = hexToRgb(color);
  p.on = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.s0 = s0; p.s1 = s1; p.r = c.r; p.g = c.g; p.b = c.b; p.a = alpha; p.grav = grav; p.drag = drag;
};
R.burst = function (x, y, z, color, n, speed, life, size, o = {}) {
  const fx = o.mul == null ? 1 : o.mul;
  n = Math.ceil(n * fx * (H.settings.quality === 'low' ? 0.5 : 1));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, el = o.flat ? (Math.random() - 0.3) * 0.5 : (Math.random() * 2 - 1);
    const sp = speed * (0.35 + Math.random() * 0.65);
    let vx = Math.cos(a) * Math.sqrt(1 - el * el) * sp, vz = Math.sin(a) * Math.sqrt(1 - el * el) * sp, vy = el * sp + (o.up || 0);
    if (o.dir) { vx = o.dir[0] * sp + (Math.random() - .5) * sp * (o.spread || .6); vz = o.dir[1] * sp + (Math.random() - .5) * sp * (o.spread || .6); vy = (Math.random() - .2) * sp * .4 + (o.up || 0); }
    R.emit(x + (Math.random() - .5) * (o.jit || 0), y, z + (Math.random() - .5) * (o.jit || 0), vx, vy, vz, life * (0.5 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.6), o.s1 != null ? o.s1 : 0, o.palette ? H.pick(o.palette) : color, o.alpha || 1, o.grav || 0, o.drag != null ? o.drag : 2.2);
  }
};
R.updateParticles = function (dt) {
  let n = 0; const P = R.P, max = R.maxParticles || 4000;
  for (let i = 0; i < max; i++) {
    const p = P[i]; if (!p.on) continue;
    p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.02 && p.grav > 0) { p.y = 0.02; p.vy *= -0.3; }
    const k = p.life / p.max;
    R.pPos[n * 3] = p.x; R.pPos[n * 3 + 1] = p.y; R.pPos[n * 3 + 2] = p.z;
    R.pCol[n * 4] = p.r; R.pCol[n * 4 + 1] = p.g; R.pCol[n * 4 + 2] = p.b; R.pCol[n * 4 + 3] = p.a * Math.min(1, k * 2.2);
    R.pSize[n] = p.s1 + (p.s0 - p.s1) * k;
    n++;
  }
  const g = R.points.geometry; g.setDrawRange(0, n);
  g.attributes.position.needsUpdate = true; g.attributes.pcolor.needsUpdate = true; g.attributes.size.needsUpdate = true;
  R.pCount = n;
};

/* Shock rings, lightning, flashes, ground decals */
R.ring = function (x, z, color, r0, r1, dur, y = 0.08, opacity = 0.9, width = 0.12) {
  const THREE = T3();
  let ring = R.rings.find(r => !r.on);
  if (!ring) { const m = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; R.fx.add(m); ring = { m, on: false, w: width }; R.rings.push(ring); }
  if (ring.w !== width) { ring.m.geometry.dispose(); ring.m.geometry = new THREE.RingGeometry(1 - width, 1, 48); ring.w = width; }
  ring.on = true; ring.t = 0; ring.dur = dur; ring.r0 = r0; ring.r1 = r1; ring.op = opacity;
  ring.m.material.color.setHex(color); ring.m.position.set(x, y, z); ring.m.visible = true;
};
/* A flat slash arc on the ground: a sector in front of (x,z) facing game angle `a` (dir = sin a, cos a).
   It wipes open across the arc, then fades. */
R.arcMaterial = function () {
  const THREE = T3();
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0.85 }, uR0: { value: 0.5 }, uStart: { value: 0 }, uLen: { value: 0.01 } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // same radial profile as the old canvas texture (bright rim, soft inside), cut to the swept sector
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uR0, uStart, uLen; varying vec2 vP;
      float prof(float r) { if (r < 0.5) return 0.0; if (r < 0.8) return mix(0.0, 0.22, (r - 0.5) / 0.3); if (r < 0.93) return mix(0.22, 0.75, (r - 0.8) / 0.13);
        if (r < 0.985) return mix(0.75, 1.0, (r - 0.93) / 0.055); return mix(1.0, 0.0, clamp((r - 0.985) / 0.015, 0.0, 1.0)); }
      void main() {
        float r = length(vP); if (r > 1.0 || r < uR0) discard;
        float d = mod(atan(vP.y, vP.x) - uStart, 6.2831853); if (d > uLen) discard;
        gl_FragColor = vec4(uColor, prof(r) * uOpacity);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
};
/* A flat slash arc on the ground: a sector in front of (x,z) facing game angle `a` (dir = sin a, cos a).
   It wipes open across the arc, then fades. Meshes are pooled and the sweep happens in the shader,
   so no geometry is built while it plays. */
R.slashArc = function (x, z, a, half, r0, r1, color, dur = 0.32, y = 0.12) {
  const THREE = T3();
  let m = (R.arcPool || (R.arcPool = [])).pop();
  if (!m) { R.arcGeo = R.arcGeo || new THREE.PlaneGeometry(2, 2); R.arcGeo.shared = true; m = new THREE.Mesh(R.arcGeo, R.arcMaterial()); m.rotation.x = -Math.PI / 2; m.frustumCulled = false; R.fx.add(m); }
  const u = m.material.uniforms; u.uColor.value.setHex(color); u.uOpacity.value = 0.85; u.uR0.value = r0 / r1; u.uStart.value = a - Math.PI / 2 - half; u.uLen.value = 0.01;
  m.position.set(x, y, z); m.scale.setScalar(r1); m.visible = true;
  R.arcs.push({ m, t: 0, dur, a, half, r0, r1, wipe: Math.min(0.12, dur * 0.35), pooled: true });
};
/* Flat arrow on the floor from (x,z) toward game angle a (dir = sin a, cos a), `len` long. Fades out. */
R.groundArrow = function (x, z, a, len, w, color, dur = 0.5) {
  const THREE = T3();
  const head = Math.min(0.9, len * 0.3), sh = w * 0.32;
  const sp = new THREE.Shape(); sp.moveTo(-sh, 0); sp.lineTo(sh, 0); sp.lineTo(sh, len - head); sp.lineTo(w, len - head); sp.lineTo(0, len); sp.lineTo(-w, len - head); sp.lineTo(-sh, len - head); sp.closePath();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(sp), mat); mesh.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.add(mesh); g.position.set(x, 0.11, z); g.rotation.y = a + Math.PI; R.fx.add(g);
  // shape's +Y becomes world -Z after the tilt; the group yaw turns it toward the aim
  R.arcs.push({ m: g, mat, t: 0, dur, arrow: true });
};
/* Live aiming arrow while a charged attack winds up: grows with the charge, turns gold when full. */
R.chargeArrow = function (p, on, x, z, a, len, k) {
  const THREE = T3();
  if (!on) { if (p._carrow) p._carrow.visible = false; return; }
  if (!p._carrow) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); mesh.rotation.x = -Math.PI / 2;
    const g = new THREE.Group(); g.add(mesh); R.fx.add(g); p._carrow = g; g.userData = { mesh, mat, len: -1 };
  }
  const g = p._carrow, u = g.userData; g.visible = true;
  if (Math.abs(u.len - len) > 0.02) {
    u.len = len; const w = 0.55, head = Math.min(0.9, len * 0.3), sh = w * 0.32;
    const sp = new THREE.Shape(); sp.moveTo(-sh, 0); sp.lineTo(sh, 0); sp.lineTo(sh, len - head); sp.lineTo(w, len - head); sp.lineTo(0, len); sp.lineTo(-w, len - head); sp.lineTo(-sh, len - head); sp.closePath();
    u.mesh.geometry.dispose(); u.mesh.geometry = new THREE.ShapeGeometry(sp);
  }
  g.position.set(x, 0.11, z); g.rotation.y = a + Math.PI;
  const full = k >= 1; u.mat.color.setHex(full ? 0xffd27a : 0xf2ead8);
  u.mat.opacity = full ? 0.6 + Math.sin(performance.now() / 70) * 0.2 : 0.3 + 0.35 * k;
};
R.bolt = function (x1, y1, z1, x2, y2, z2, color, width = 1) {
  const THREE = T3();
  const pts = []; const segs = 8;
  for (let i = 0; i <= segs; i++) {
    const k = i / segs; const j = (i === 0 || i === segs) ? 0 : 0.45;
    pts.push(new THREE.Vector3(x1 + (x2 - x1) * k + (Math.random() - .5) * j, y1 + (y2 - y1) * k + (Math.random() - .5) * j, z1 + (z2 - z1) * k + (Math.random() - .5) * j));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  R.fx.add(m); R.bolts.push({ m, t: 0, dur: 0.16 });
  for (let i = 1; i < pts.length - 1; i += 2) R.emit(pts[i].x, pts[i].y, pts[i].z, 0, 0.5, 0, 0.18, 0.5 * width, 0.1, color, 1, 0, 3);
};
R.flash = function (x, z, color, intensity = 3, dur = 0.18) {
  if (H.settings.quality === 'low') return;
  let f = R.flashLights.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
  f.l.color.setHex(color); f.l.position.set(x, 1.4, z); f.t = 0; f.dur = dur; f.i0 = intensity * (H.settings.reduceFlash ? 0.4 : 1); f.l.intensity = f.i0;
};
R.decal = function (x, z, color, r, dur, tex) {
  const THREE = T3();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: tex || R.texCrack, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 7; m.position.set(x, 0.04, z); R.fx.add(m);
  R.decals.push({ m, t: 0, dur });
};
R.updateFx = function (dt) {
  if (R.trail && R.trail.tickStreaks) R.trail.tickStreaks(dt);
  for (const r of R.rings) { if (!r.on) continue; r.t += dt; const k = r.t / r.dur; if (k >= 1) { r.on = false; r.m.visible = false; continue; } const e = 1 - Math.pow(1 - k, 3); const s = r.r0 + (r.r1 - r.r0) * e; r.m.scale.set(s, s, s); r.m.material.opacity = r.op * (1 - k); }
  for (let i = R.arcs.length - 1; i >= 0; i--) {
    const c = R.arcs[i]; c.t += dt; const THREE = T3();
    if (c.arrow) { const k = c.t / c.dur; c.mat.opacity = 0.7 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); if (c.t >= c.dur) { R.fx.remove(c.m); c.m.children[0].geometry.dispose(); c.mat.dispose(); R.arcs.splice(i, 1); } continue; }
    const u = c.m.material.uniforms;
    if (c.t < c.wipe + dt) u.uLen.value = Math.max(0.01, 2 * c.half * Math.min(1, c.t / c.wipe));
    const f = Math.max(0, (c.t - c.wipe) / (c.dur - c.wipe)); u.uOpacity.value = 0.85 * (1 - f); c.m.scale.setScalar(c.r1 * (1 + 0.08 * f));
    if (c.t >= c.dur) { c.m.visible = false; R.arcPool.push(c.m); R.arcs.splice(i, 1); }
  }
  for (let i = R.bolts.length - 1; i >= 0; i--) { const b = R.bolts[i]; b.t += dt; b.m.material.opacity = 1 - b.t / b.dur; if (b.t >= b.dur) { R.fx.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); R.bolts.splice(i, 1); } }
  for (let i = R.decals.length - 1; i >= 0; i--) { const d = R.decals[i]; d.t += dt; d.m.material.opacity = Math.min(1, (1 - d.t / d.dur) * 2) * 0.7; if (d.t >= d.dur) { R.fx.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); R.decals.splice(i, 1); } }
  for (const f of R.flashLights) { f.t += dt; f.l.intensity = f.t < f.dur ? f.i0 * (1 - f.t / f.dur) : 0; }
};

/* ---------------- Telegraphs ---------------- */
R.initTelegraphMat = function () {
  const THREE = T3();
  R.tgGeoC = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const gr = new THREE.PlaneGeometry(1, 1); gr.translate(0, 0.5, 0); gr.rotateX(-Math.PI / 2); R.tgGeoR = gr;
  R.tgShader = {
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uProg; uniform float uAlpha; uniform float uShape; uniform float uAngle; uniform float uInner; uniform float uHi; uniform float uTime; uniform vec2 uSize; varying vec2 vUv;
      void main(){
        float inside=0.0, edge=0.0, fill=0.0;
        if(uShape<1.5){ vec2 p=vUv*2.0-1.0; float d=length(p); float ang=abs(atan(p.x,p.y));
          float inCone = uShape>0.5 ? step(ang,uAngle) : 1.0;
          inside = step(d,1.0)*step(uInner,d)*inCone;
          float ew = 0.05 + uHi*0.03;
          edge = inside*(smoothstep(1.0-ew,1.0,d) + (uInner>0.0? 1.0-smoothstep(uInner,uInner+ew,d):0.0));
          if(uShape>0.5){ float ea = (uAngle-ang)*d; edge = max(edge, inside*(1.0-smoothstep(0.0,0.06,ea))); }
          fill = inside*step(d, uInner + (1.0-uInner)*uProg);
        } else {
          vec2 p=vUv; inside=1.0; float ex = 0.05/max(uSize.x,0.5)*2.0*(1.0+uHi); float ey=0.05/max(uSize.y,0.5)*2.0*(1.0+uHi);
          edge = max(1.0-smoothstep(0.0,ex,p.x), smoothstep(1.0-ex,1.0,p.x)); edge=max(edge, max(1.0-smoothstep(0.0,ey,p.y), smoothstep(1.0-ey,1.0,p.y)));
          fill = step(p.y,uProg);
        }
        if(inside<0.5) discard;
        float stripes = uHi>0.5 ? step(0.5, fract((vUv.x+vUv.y)*10.0 - uTime*1.5))*0.25 : 0.0;
        float a = edge*0.95 + fill*(0.32+stripes) + 0.1 + stripes*0.3;
        vec3 col = uColor*(1.0+edge*0.6) + fill*0.08;
        if(uProg>0.97) { col += 0.35; a += 0.15; }
        gl_FragColor=vec4(col, a*uAlpha);
      }`
  };
};
R.makeTelegraph = function (shape, o) {
  const THREE = T3();
  const shapeId = shape === 'circle' ? 0 : shape === 'cone' ? 1 : 2;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(o.color || 0xff2e55) }, uProg: { value: 0 }, uAlpha: { value: 1 }, uShape: { value: shapeId }, uAngle: { value: o.angle || 0.6 }, uInner: { value: o.inner || 0 }, uHi: { value: H.settings.hiTelegraph ? 1 : 0 }, uTime: { value: 0 }, uSize: { value: new THREE.Vector2(o.w || 1, o.len || 1) } },
    vertexShader: R.tgShader.vertexShader, fragmentShader: R.tgShader.fragmentShader, transparent: true, depthWrite: false, blending: H.settings.hiTelegraph ? THREE.NormalBlending : THREE.AdditiveBlending
  });
  const m = new THREE.Mesh(shapeId === 2 ? R.tgGeoR : R.tgGeoC, mat);
  if (shapeId === 2) m.scale.set(o.w, 1, o.len); else m.scale.set(o.r * 2, 1, o.r * 2);
  m.position.set(o.x, 0.05 + (o.yOff || 0), o.z);
  if (o.dx != null) m.rotation.y = Math.atan2(-o.dx, -o.dz);
  m.renderOrder = 2;
  R.fx.add(m);
  return m;
};
R.removeMesh = function (m) { if (!m) return; if (m.parent) m.parent.remove(m); m.traverse && m.traverse(o => { if (o.geometry && o.geometry !== R.tgGeoC && o.geometry !== R.tgGeoR && !o.geometry.shared) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(mm => mm.dispose()); else if (!o.material.shared) { if (o.material.map && o.material.map._own) o.material.map.dispose(); o.material.dispose(); } } }); };

/* ---------------- Materials ---------------- */
const MAT = {};
R.mat = function (key, make) { if (!MAT[key]) { MAT[key] = make(); MAT[key].shared = true; } return MAT[key]; };
R.std = (color, o = {}) => new (T3().MeshStandardMaterial)(Object.assign({ color, roughness: 0.85, metalness: 0.05, flatShading: true }, o));
R.basic = (color, o = {}) => new (T3().MeshBasicMaterial)(Object.assign({ color }, o));
R.glowSprite = function (color, size, tex) {
  const THREE = T3();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex || R.texGlow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.set(size, size, size); return s;
};

/* ---------------- Chamber construction ---------------- */
R.clearChamber = function () {
  while (R.chamber.children.length) { const c = R.chamber.children[0]; R.removeMesh(c); }
  R.doorObjs = []; R.braziers = []; R.props = [];
  for (const l of R.brazierLights || []) l.intensity = 0;
  if (R.brazier) R.brazier.clear();
};
/* UV-scaled box so tiling textures keep their real-world size on every face */
R.boxUV = function (w, h, d, s) {
  const g = new (T3().BoxGeometry)(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] * s, uv.getY(i) * dims[f][1] * s); }
  uv.needsUpdate = true; return g;
};
/* Procedural gray brick pavers (running bond, bevels, chips, cracks, grime). 1 texture = 8 m. */
R.makeBrickTextures = function () {
  const N = 1024, COLS = 12, ROWS = 24, bw = N / COLS, bh = N / ROWS, gr = 4;
  const col = document.createElement('canvas'); col.width = col.height = N; const c = col.getContext('2d');
  const hgt = document.createElement('canvas'); hgt.width = hgt.height = N; const h = hgt.getContext('2d');
  c.fillStyle = '#26252a'; c.fillRect(0, 0, N, N); h.fillStyle = '#000'; h.fillRect(0, 0, N, N);
  const rr = (ctx, x, y, w, hh, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh); ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); };
  for (let r = 0; r < ROWS; r++) {
    const off = (r % 2) * bw / 2;
    for (let k = -1; k < COLS; k++) {
      const x0 = k * bw + off, y0 = r * bh;
      const jx = (Math.random() - .5) * 2, jy = (Math.random() - .5) * 1.5;
      const x = x0 + gr / 2 + jx, y = y0 + gr / 2 + jy, w = bw - gr - Math.random() * 2, hh = bh - gr - Math.random() * 1.5;
      const g = 92 + Math.random() * 46 | 0, warm = (Math.random() - .5) * 10;
      const base = `rgb(${g + warm + 4 | 0},${g + 2 | 0},${g - warm + 6 | 0})`;
      for (const dx of [0, N]) {
        if (x + dx > N + 4) continue;
        rr(c, x + dx - (dx ? N : 0), y, w, hh, 5); c.fillStyle = base; c.fill();
        // bevel: light top/left, dark bottom/right
        c.save(); c.clip();
        c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(x + dx - (dx ? N : 0), y, w, 3); c.fillRect(x + dx - (dx ? N : 0), y, 3, hh);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + dx - (dx ? N : 0), y + hh - 4, w, 4); c.fillRect(x + dx - (dx ? N : 0) + w - 4, y, 4, hh);
        // speckle
        for (let q = 0; q < 40; q++) { c.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.08)'; c.fillRect(x + dx - (dx ? N : 0) + Math.random() * w, y + Math.random() * hh, 1 + Math.random() * 2, 1 + Math.random() * 2); }
        // worn center / stain
        if (Math.random() < .3) { const sg = c.createRadialGradient(x + dx - (dx ? N : 0) + w * Math.random(), y + hh / 2, 0, x + dx - (dx ? N : 0) + w / 2, y + hh / 2, w * 0.6); sg.addColorStop(0, 'rgba(20,18,22,.35)'); sg.addColorStop(1, 'rgba(20,18,22,0)'); c.fillStyle = sg; c.fillRect(x + dx - (dx ? N : 0), y, w, hh); }
        // crack
        if (Math.random() < .12) { c.strokeStyle = 'rgba(15,14,16,.8)'; c.lineWidth = 1.2; c.beginPath(); let px = x + dx - (dx ? N : 0) + w * (0.2 + Math.random() * .6), py = y; c.moveTo(px, py); while (py < y + hh) { px += (Math.random() - .5) * 8; py += 3 + Math.random() * 5; c.lineTo(px, py); } c.stroke(); }
        // chipped corner
        if (Math.random() < .15) { c.fillStyle = '#2a292e'; c.beginPath(); const cx = x + dx - (dx ? N : 0) + (Math.random() < .5 ? 0 : w), cy = y + (Math.random() < .5 ? 0 : hh); c.arc(cx, cy, 4 + Math.random() * 6, 0, 7); c.fill(); }
        c.restore();
        // height map
        const hg = h.createLinearGradient(0, y, 0, y + hh); const lv = 170 + Math.random() * 60 | 0; hg.addColorStop(0, `rgb(${lv},${lv},${lv})`); hg.addColorStop(1, `rgb(${lv - 30},${lv - 30},${lv - 30})`);
        rr(h, x + dx - (dx ? N : 0), y, w, hh, 6); h.fillStyle = hg; h.fill();
      }
    }
  }
  // large-scale grime and damp patches (wrapped)
  for (let q = 0; q < 26; q++) {
    const x = Math.random() * N, y = Math.random() * N, r = 40 + Math.random() * 160, a = 0.08 + Math.random() * 0.16, tone = Math.random() < .75 ? '12,10,14' : '70,80,70';
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, `rgba(${tone},${a})`); g.addColorStop(1, `rgba(${tone},0)`); c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
  }
  const THREE = T3();
  const map = new THREE.CanvasTexture(col); map.encoding = THREE.sRGBEncoding;
  const bump = new THREE.CanvasTexture(hgt);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 6.5, 1 / 6.5); t.anisotropy = Math.min(8, R.renderer.capabilities.getMaxAnisotropy()); }
  return { map, bump };
};
/* Floor: large grey stone slabs (1×1 to 3×2 m) laid on a 1 m grid, with worn bevels, cracks and chipped
   corners. One 8×8 m texture tile; slabs never cross the tile edge, so it repeats seamlessly. */
R.makeSlabTextures = function () {
  // small square slate tiles (0.8 m), bevelled, a few cracked or chipped, moss in some joints; one 8×8 m tile, seamless
  const N = 1024, TN = 10, TS = N / TN, rnd = R.mulberry(0x5eed51ab), Rr = (a, b) => a + rnd() * (b - a);
  const col = document.createElement('canvas'); col.width = col.height = N; const c = col.getContext('2d');
  const hgt = document.createElement('canvas'); hgt.width = hgt.height = N; const h = hgt.getContext('2d');
  c.fillStyle = '#0a0f0e'; c.fillRect(0, 0, N, N); h.fillStyle = '#000'; h.fillRect(0, 0, N, N);
  const crack = (x, y, len, ang, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < len; k++) { ang += Rr(-0.5, 0.5); x += Math.cos(ang) * Rr(4, 10); y += Math.sin(ang) * Rr(4, 10); c.lineTo(x, y); } c.stroke(); };
  for (let ty = 0; ty < TN; ty++) for (let tx = 0; tx < TN; tx++) {
    const X = tx * TS + 3, Y = ty * TS + 3, W = TS - 6, Ht = TS - 6;
    const v = Rr(-9, 9), cool = Rr(-4, 4); c.fillStyle = `rgb(${38 + v | 0},${50 + v + cool | 0},${48 + v | 0})`; c.fillRect(X, Y, W, Ht);
    c.save(); c.beginPath(); c.rect(X, Y, W, Ht); c.clip();
    for (let k = 0; k < 9; k++) { c.globalAlpha = Rr(0.05, 0.14); c.fillStyle = rnd() < 0.5 ? '#6a7e78' : '#141c1a'; c.beginPath(); c.ellipse(Rr(X, X + W), Rr(Y, Y + Ht), Rr(10, 34), Rr(4, 12), Rr(0, 3), 0, 7); c.fill(); }
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(210,235,225,.10)'; c.fillRect(X, Y, W, 4); c.fillRect(X, Y, 4, Ht);
    c.fillStyle = 'rgba(0,0,0,.42)'; c.fillRect(X, Y + Ht - 5, W, 5); c.fillRect(X + W - 5, Y, 5, Ht);
    if (rnd() < 0.14) { c.strokeStyle = 'rgba(4,8,6,.9)'; crack(Rr(X, X + W), Y + 2, 7, Math.PI / 2 + Rr(-0.6, 0.6), 1.6); }
    if (rnd() < 0.1) { c.fillStyle = '#0c1210'; c.beginPath(); c.arc(X + (rnd() < .5 ? 0 : W), Y + (rnd() < .5 ? 0 : Ht), Rr(4, 9), 0, 7); c.fill(); }
    c.restore();
    const lv = Rr(170, 225) | 0; h.fillStyle = `rgb(${lv},${lv},${lv})`; h.fillRect(X + 2, Y + 2, W - 4, Ht - 4);
  }
  for (let k = 0; k < 22; k++) { const x = Rr(0, N), y = Rr(0, N), r = Rr(20, 70); for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, 'rgba(40,90,50,.26)'); g.addColorStop(1, 'rgba(40,90,50,0)'); c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
  const THREE = T3();
  const map = new THREE.CanvasTexture(col); map.encoding = THREE.sRGBEncoding;
  const bump = new THREE.CanvasTexture(hgt);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 8, 1 / 8); t.anisotropy = Math.min(8, R.renderer.capabilities.getMaxAnisotropy()); }
  return { map, bump };
};
/* Floor (painted / illustrated looks): big hand-painted flagstones of mixed sizes (1–2.5 m) with chipped,
   irregular edges, dark grout, cracks and brush strokes, plus a few patches of small bricks. Original design.
   Besides the colour it bakes a normal map (from a height map) and a roughness map: the slabs are worn
   smooth (they catch the braziers' and the hero's light as soft highlights), the joints stay rough and dark.
   One seamless 8×8 m tile (slabs never cross its edge). */
R.makeFlagstoneTextures = function () {
  const N = 1024, PX = N / 8, CELL = PX / 2, GN = 16, rnd = R.mulberry(0xf1a95705), Rr = (a, b) => a + rnd() * (b - a);
  const mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = N; return cv; };
  const col = mk(), hgt = mk(), rgh = mk(); const c = col.getContext('2d'), h = hgt.getContext('2d'), g = rgh.getContext('2d');
  c.fillStyle = '#070b0a'; c.fillRect(0, 0, N, N); h.fillStyle = '#000'; h.fillRect(0, 0, N, N); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
  // 1) lay out slabs on a 0.5 m grid (greedy, random sizes) and a few small-brick patches
  const used = Array.from({ length: GN }, () => new Array(GN).fill(false)), rects = [];
  const free = (x, y, w, hh) => { if (x + w > GN || y + hh > GN) return false; for (let j = y; j < y + hh; j++) for (let i = x; i < x + w; i++) if (used[j][i]) return false; return true; };
  const take = (x, y, w, hh, kind) => { for (let j = y; j < y + hh; j++) for (let i = x; i < x + w; i++) used[j][i] = true; rects.push({ x, y, w, h: hh, kind }); };
  for (let k = 0; k < 1; k++) { const w = 4 + (rnd() * 2 | 0), hh = 3 + (rnd() * 2 | 0), x = rnd() * (GN - w) | 0, y = rnd() * (GN - hh) | 0; if (free(x, y, w, hh)) take(x, y, w, hh, 'bricks'); }
  for (let y = 0; y < GN; y++) for (let x = 0; x < GN; x++) {
    if (used[y][x]) continue;
    let w = 3 + (rnd() * 4 | 0), hh = 3 + (rnd() * 3 | 0); if (rnd() < 0.5) [w, hh] = [hh, w];
    while (w > 1 && !free(x, y, w, 1)) w--; while (hh > 1 && !free(x, y, w, hh)) hh--;
    take(x, y, w, hh, 'slab');
  }
  // an irregular outline: corners pulled in, edges broken into short jittered segments (chipped stone)
  const outline = (x0, y0, x1, y1, j) => {
    const pts = [], seg = (ax, ay, bx, by) => { const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 22)); for (let k = 0; k < n; k++) { const t = k / n; const nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny) || 1; const d = (rnd() < 0.12 ? Rr(2, j * 2.2) : Rr(0, j)); pts.push([ax + (bx - ax) * t + nx / L * d, ay + (by - ay) * t + ny / L * d]); } };
    const cc = () => Rr(2, j * 1.6);
    seg(x0 + cc(), y0 + cc(), x1 - cc(), y0 + cc()); seg(x1 - cc(), y0 + cc(), x1 - cc(), y1 - cc()); seg(x1 - cc(), y1 - cc(), x0 + cc(), y1 - cc()); seg(x0 + cc(), y1 - cc(), x0 + cc(), y0 + cc());
    return pts;
  };
  const path = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
  const crack = (x, y, ang, len, w) => { const pts = [[x, y]]; for (let k = 0; k < len; k++) { ang += Rr(-0.55, 0.55); x += Math.cos(ang) * Rr(6, 14); y += Math.sin(ang) * Rr(6, 14); pts.push([x, y]); }
    for (const [ctx, st] of [[c, 'rgba(4,8,7,.85)'], [h, 'rgb(40,40,40)'], [g, '#fff']]) { ctx.strokeStyle = st; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.stroke(); }
    c.strokeStyle = 'rgba(150,175,165,.16)'; c.lineWidth = 1; c.beginPath(); c.moveTo(pts[0][0] + 1.5, pts[0][1] + 1.5); for (const q of pts) c.lineTo(q[0] + 1.5, q[1] + 1.5); c.stroke(); };
  const stone = (pts, X, Y, W, Hh, big) => {
    const v = Rr(-10, 10), gr = Rr(-3, 5);
    path(c, pts); c.fillStyle = `rgb(${62 + v | 0},${73 + v + gr | 0},${68 + v | 0})`; c.fill();
    c.save(); path(c, pts); c.clip();
    // brush strokes along the slab's long side, light and dark (painted look)
    const horiz = W >= Hh;
    for (let k = 0; k < (big ? 30 : 8); k++) { c.globalAlpha = Rr(0.04, 0.1); c.fillStyle = rnd() < 0.55 ? '#8fa39a' : '#1a2421'; c.beginPath(); c.ellipse(Rr(X, X + W), Rr(Y, Y + Hh), horiz ? Rr(18, 70) : Rr(4, 14), horiz ? Rr(4, 14) : Rr(18, 70), Rr(-0.15, 0.15), 0, 7); c.fill(); }
    // worn, lighter centre and darker rim (feet wear the middle smooth)
    c.globalAlpha = 1; const wg = c.createRadialGradient(X + W * Rr(0.35, 0.65), Y + Hh * Rr(0.35, 0.65), 0, X + W / 2, Y + Hh / 2, Math.max(W, Hh) * 0.75);
    wg.addColorStop(0, 'rgba(160,185,175,.10)'); wg.addColorStop(0.6, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(0,0,0,.28)'); c.fillStyle = wg; c.fillRect(X - 10, Y - 10, W + 20, Hh + 20);
    // painted bevel: a light lip on the top/left edges, shadow on the bottom/right
    c.lineWidth = big ? 5 : 3; c.strokeStyle = 'rgba(190,215,205,.16)'; c.beginPath(); c.moveTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); for (let i = 0; i < pts.length; i++) { const q = pts[i]; if (q[1] < Y + 8 || q[0] < X + 8) c.lineTo(q[0] + 2, q[1] + 2); else c.moveTo(q[0], q[1]); } c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.38)'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) { if (q[1] > Y + Hh - 8 || q[0] > X + W - 8) c.lineTo(q[0] - 2, q[1] - 2); else c.moveTo(q[0], q[1]); } c.stroke();
    c.restore();
    // height: a gently domed top, lower at the edges; roughness: polished middle, rough rim
    const lv = Rr(205, 230) | 0; path(h, pts); h.fillStyle = `rgb(${lv},${lv},${lv})`; h.fill(); h.save(); path(h, pts); h.clip(); h.lineWidth = big ? 9 : 5; h.strokeStyle = `rgb(${lv - 70},${lv - 70},${lv - 70})`; path(h, pts); h.stroke(); h.lineWidth = big ? 4 : 2; h.strokeStyle = `rgb(${lv - 120},${lv - 120},${lv - 120})`; path(h, pts); h.stroke(); h.restore();
    path(g, pts); const rg = g.createRadialGradient(X + W / 2, Y + Hh / 2, 0, X + W / 2, Y + Hh / 2, Math.max(W, Hh) * 0.65); const rv = big ? Rr(60, 85) | 0 : Rr(100, 130) | 0; rg.addColorStop(0, `rgb(${rv},${rv},${rv})`); rg.addColorStop(1, `rgb(${rv + 90},${rv + 90},${rv + 90})`); g.fillStyle = rg; g.fill();
  };
  for (const r of rects) {
    const X = r.x * CELL, Y = r.y * CELL, W = r.w * CELL, Hh = r.h * CELL;
    if (r.kind === 'bricks') {
      // small bricks (0.25 × 0.5 m), running bond, smaller chips
      const bw = CELL * 2, bh = CELL;
      for (let yy = 0; yy < Hh / bh; yy++) for (let xx = -1; xx < W / bw; xx++) {
        const x0 = X + xx * bw + (yy % 2) * bw / 2, y0 = Y + yy * bh, x1 = Math.min(X + W, x0 + bw), xs = Math.max(X, x0); if (x1 - xs < 12) continue;
        stone(outline(xs + 3, y0 + 3, x1 - 3, y0 + bh - 3, 2.5), xs, y0, x1 - xs, bh, false);
      }
      continue;
    }
    const pts = outline(X + 4, Y + 4, X + W - 4, Y + Hh - 4, 5); stone(pts, X, Y, W, Hh, true);
    if (rnd() < 0.35) { c.save(); path(c, pts); c.clip(); h.save(); path(h, pts); h.clip(); g.save(); path(g, pts); g.clip(); const side = rnd() < 0.5; crack(side ? X + 4 : Rr(X + W * 0.2, X + W * 0.8), side ? Rr(Y + Hh * 0.2, Y + Hh * 0.8) : Y + 4, side ? Rr(-0.4, 0.4) : Math.PI / 2 + Rr(-0.4, 0.4), 6 + (rnd() * 8 | 0), Rr(1.4, 2.4)); c.restore(); h.restore(); g.restore(); }
  }
  // damp moss in some joints and a little grime, wrapped so the tile stays seamless
  for (let k = 0; k < 18; k++) { const x = Rr(0, N), y = Rr(0, N), r = Rr(16, 60), moss = rnd() < 0.6; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const gg = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gg.addColorStop(0, moss ? 'rgba(40,96,58,.22)' : 'rgba(6,10,9,.3)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
  // 2) normal map from the height map (Sobel, wrapped)
  const hd = h.getImageData(0, 0, N, N).data, nc = mk(), nx = nc.getContext('2d'), out = nx.createImageData(N, N), od = out.data, S = 2.2;
  const H0 = (x, y) => hd[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H0(x + 1, y - 1) + 2 * H0(x + 1, y) + H0(x + 1, y + 1)) - (H0(x - 1, y - 1) + 2 * H0(x - 1, y) + H0(x - 1, y + 1));
    const dy = (H0(x - 1, y + 1) + 2 * H0(x, y + 1) + H0(x + 1, y + 1)) - (H0(x - 1, y - 1) + 2 * H0(x, y - 1) + H0(x + 1, y - 1));
    let vx = -dx * S, vy = dy * S, vz = 1; const L = Math.hypot(vx, vy, vz); vx /= L; vy /= L; vz /= L;
    const i = (y * N + x) * 4; od[i] = (vx * 0.5 + 0.5) * 255; od[i + 1] = (vy * 0.5 + 0.5) * 255; od[i + 2] = (vz * 0.5 + 0.5) * 255; od[i + 3] = 255;
  }
  nx.putImageData(out, 0, 0);
  const THREE = T3();
  const map = new THREE.CanvasTexture(col); map.encoding = THREE.sRGBEncoding;
  const normal = new THREE.CanvasTexture(nc), rough = new THREE.CanvasTexture(rgh);
  for (const t of [map, normal, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 8, 1 / 8); t.anisotropy = Math.min(8, R.renderer.capabilities.getMaxAnisotropy()); }
  return { map, normal, rough };
};
/* Greek-key (meander) band drawn along a horizontal strip: used on floor panels and column bands */
R.drawMeander = function (c, x, y, len, hh, color, lw) {
  const u = hh; const n = Math.max(1, Math.round(len / u)); const uw = len / n;
  c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'miter'; c.beginPath();
  for (let i = 0; i < n; i++) {
    const X = x + i * uw, a = uw * 0.15, b = hh * 0.15;
    c.moveTo(X, y + hh - b); c.lineTo(X + uw * 0.85, y + hh - b); c.lineTo(X + uw * 0.85, y + b); c.lineTo(X + a, y + b); c.lineTo(X + a, y + hh * 0.62); c.lineTo(X + uw * 0.55, y + hh * 0.62); c.lineTo(X + uw * 0.55, y + hh * 0.4);
  }
  c.stroke();
  c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + len, y + 1); c.moveTo(x, y + hh - 1); c.lineTo(x + len, y + hh - 1); c.stroke();
};
R.softDisc = function () { return R._softDisc || (R._softDisc = R.canvasTex(128, 128, c => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); })); };
R.panelTexture = function () {
  if (R._panelTex) return R._panelTex;
  return (R._panelTex = R.canvasTex(512, 512, c => {
    const N = 512; c.fillStyle = '#868d89'; c.fillRect(0, 0, N, N);
    for (let q = 0; q < 2200; q++) { c.fillStyle = R.drand() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.06)'; c.fillRect(R.drand() * N, R.drand() * N, 2, 2); }
    c.strokeStyle = 'rgba(20,26,23,.85)'; c.lineWidth = 8; c.strokeRect(10, 10, N - 20, N - 20);
    for (let side = 0; side < 4; side++) { c.save(); c.translate(N / 2, N / 2); c.rotate(side * Math.PI / 2); c.translate(-N / 2, -N / 2); R.drawMeander(c, 40, 30, N - 80, 46, 'rgba(24,30,27,.9)', 6); c.restore(); }
    c.strokeStyle = 'rgba(24,30,27,.8)'; c.lineWidth = 5; c.strokeRect(96, 96, N - 192, N - 192);
    c.beginPath(); c.arc(N / 2, N / 2, 70, 0, 7); c.stroke(); c.beginPath(); c.arc(N / 2, N / 2, 34, 0, 7); c.stroke();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.beginPath(); c.moveTo(N / 2 + Math.cos(a) * 34, N / 2 + Math.sin(a) * 34); c.lineTo(N / 2 + Math.cos(a) * 70, N / 2 + Math.sin(a) * 70); c.stroke(); }
    const eg = c.createRadialGradient(N / 2, N / 2, N * 0.2, N / 2, N / 2, N * 0.75); eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = eg; c.fillRect(0, 0, N, N);
  }));
};
R.bandTexture = function () {
  if (R._bandTex) return R._bandTex;
  const t = R.canvasTex(512, 64, c => { c.fillStyle = '#8a918d'; c.fillRect(0, 0, 512, 64); R.drawMeander(c, 0, 8, 512, 48, 'rgba(22,28,25,.95)', 5); });
  t.wrapS = T3().RepeatWrapping; return (R._bandTex = t);
};
R.floorMaterial = function (tint) {
  if (!R.brickTex && H.settings.look === 'classic') R.brickTex = R.makeBrickTextures();
  else if (!R.brickTex) R.brickTex = {};
  const T = R.brickTex;
  // flagstones: normal + roughness maps, so lights leave soft sheens on the worn slabs and the joints stay dark
  if (H.settings.look !== 'classic') return R.mixFloorMaterial(tint);
  if (T.normal) return new (T3().MeshStandardMaterial)({ color: tint, map: T.map, normalMap: T.normal, normalScale: new (T3().Vector2)(0.9, 0.9), roughnessMap: T.rough, roughness: 1, metalness: 0.05 });
  return new (T3().MeshStandardMaterial)({ color: tint, map: T.map, bumpMap: T.bump, bumpScale: 0.035, roughness: 0.92, metalness: 0.02 });
};
/* Rough-cut wall stone: larger irregular blocks, darker; tiles every 2 m */
R.monolithTexture = function () {
  if (R._monoTex) return R._monoTex;
  const N = 512, rnd = R.mulberry(0x3a11), Rr = (a, b) => a + rnd() * (b - a);
  const t = R.canvasTex(N, N, c => {
    c.fillStyle = '#9aa29e'; c.fillRect(0, 0, N, N);
    for (let i = 0; i < 220; i++) { c.globalAlpha = Rr(0.04, 0.14); c.fillStyle = rnd() < 0.5 ? '#d0d8d4' : '#3a4440'; c.beginPath(); c.ellipse(Rr(0, N), Rr(0, N), Rr(30, 120), Rr(8, 30), Rr(-0.3, 0.3), 0, 7); c.fill(); }
    c.globalAlpha = 1;
    const e1 = c.createLinearGradient(0, 0, 0, N); e1.addColorStop(0, 'rgba(255,255,255,.18)'); e1.addColorStop(0.06, 'rgba(255,255,255,0)'); e1.addColorStop(0.9, 'rgba(0,0,0,0)'); e1.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = e1; c.fillRect(0, 0, N, N);
    const e2 = c.createLinearGradient(0, 0, N, 0); e2.addColorStop(0, 'rgba(0,0,0,.35)'); e2.addColorStop(0.05, 'rgba(0,0,0,0)'); e2.addColorStop(0.95, 'rgba(0,0,0,0)'); e2.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = e2; c.fillRect(0, 0, N, N);
  });
  t.wrapS = t.wrapT = T3().RepeatWrapping; return (R._monoTex = t);
};
/* ---- Room materials: rock walls (Poly Haven "Dark Rock 02", CC0), marble floors (procedural), style per room ---- */
R.MAT = {
  rock: { dir: 'public/textures/dark_rock_02/', size: 2.5, normal: 1.0 },          // one repeat of the rock every 2.5 m
  marble: { tile: 1, texM: 4, px: 1024, roughness: 0.62, normal: 0.6 },              // 1 m tiles; one texture = 4×4 tiles
  marbleTint: { beige: 0x4a4438, grey: 0x3c4244 },                                  // multiplied into the texture: dungeon-dim marble
  rockLight: 1.9                                                                       // the scan is very dark: lift it so the strata read
};
// loaded once, shared by every room
R.rockTextures = function () {
  if (R._rock) return R._rock;
  const THREE = T3(), L = new THREE.TextureLoader(), d = R.MAT.rock.dir, an = Math.min(8, R.renderer.capabilities.getMaxAnisotropy());
  const ld = (f, srgb) => { const t = L.load(d + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = an; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
  return (R._rock = { map: ld('diff_1k.jpg', true), normal: ld('nor_gl_1k.jpg'), rough: ld('rough_1k.jpg') });
};
// a box whose UVs come from world coordinates (u, v in metres / size), so neighbouring blocks continue the same rock
R.worldBoxUV = function (w, h, d, cx, cy, cz, size) {
  const g = new (T3().BoxGeometry)(w, h, d), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, k = 1 / size;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i) + cx, y = P.getY(i) + cy, z = P.getZ(i) + cz, ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i));
    if (ax > 0.5) U.setXY(i, z * k, y * k); else if (ay > 0.5) U.setXY(i, x * k, z * k); else U.setXY(i, x * k, y * k); }
  U.needsUpdate = true; return g;
};
// marble tiles: veins (turbulent bands, each tile cut at its own angle), tone per tile, grout joints; colour + normal + roughness
R.marbleTextures = function (variant) {
  R._marble = R._marble || {}; if (R._marble[variant]) return R._marble[variant];
  const THREE = T3(), M = R.MAT.marble, S = M.px, T = M.texM / M.tile, TS = S / T, rnd = R.mulberry(variant === 'grey' ? 0x6a7b1e : 0xbe19e0);
  // tileable value noise
  const G = 64, lat = new Float32Array(G * G).map(() => rnd()); const sm = t => t * t * (3 - 2 * t);
  const vn = (x, y, f) => { const X = x * f, Y = y * f, xi = Math.floor(X), yi = Math.floor(Y), tx = sm(X - xi), ty = sm(Y - yi), P = f; const at = (a, b) => lat[((((b % P) + P) % P) % G) * G + ((((a % P) + P) % P) % G)];
    return (at(xi, yi) * (1 - tx) + at(xi + 1, yi) * tx) * (1 - ty) + (at(xi, yi + 1) * (1 - tx) + at(xi + 1, yi + 1) * tx) * ty; };
  const fbm = (x, y) => vn(x, y, 4) * 0.5 + vn(x, y, 8) * 0.25 + vn(x, y, 16) * 0.15 + vn(x, y, 32) * 0.1;
  const base = variant === 'grey' ? [214, 216, 214] : [232, 220, 196], vein = variant === 'grey' ? [88, 92, 98] : [146, 122, 92], vein2 = variant === 'grey' ? [150, 154, 158] : [196, 176, 140];
  const tiles = []; for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) tiles.push({ a: rnd() * Math.PI, f: 0.55 + rnd() * 0.8, o: rnd() * 10, tone: 0.9 + rnd() * 0.14 });
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const cc = mk(), rc = mk(), hc = mk(); const cd = cc.getContext('2d').createImageData(S, S), rd = rc.getContext('2d').createImageData(S, S), hd = new Float32Array(S * S);
  const J = Math.max(2, Math.round(S / 256)), bev = J * 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ti = Math.floor(x / TS), tj = Math.floor(y / TS), t = tiles[tj * T + ti], lx = x - ti * TS, ly = y - tj * TS, u = x / S, v = y / S;
    const edge = Math.min(lx, ly, TS - 1 - lx, TS - 1 - ly);
    const n = fbm(u, v), d = (Math.cos(t.a) * lx + Math.sin(t.a) * ly) / TS;
    const band = Math.abs(Math.sin((d * t.f + t.o + n * 2.6) * Math.PI)), veinK = Math.pow(1 - band, 9) * 0.8 + Math.pow(1 - band, 2.5) * 0.1, fine = Math.pow(1 - Math.abs(Math.sin((u * 5 + v * 3 + n * 9) * Math.PI)), 60) * 0.3;
    const cloud = 0.92 + (fbm(u + 3.1, v + 1.7) - 0.5) * 0.16;
    let r = 0, g = 0, b = 0; for (let k = 0; k < 3; k++) { let val = base[k] * cloud * t.tone; val = val * (1 - veinK) + vein[k] * veinK; val = val * (1 - fine) + vein2[k] * fine; if (k === 0) r = val; else if (k === 1) g = val; else b = val; }
    let h = 1, rough = M.roughness + veinK * 0.12;
    if (edge < J) { r = r * 0.28; g = g * 0.28; b = b * 0.28; h = 0.15; rough = 0.95; }          // grout
    else if (edge < J + bev) { const k = (edge - J) / bev; h = 0.7 + 0.3 * k; r *= 0.86 + 0.14 * k; g *= 0.86 + 0.14 * k; b *= 0.86 + 0.14 * k; }   // worn bevel
    const i4 = (y * S + x) * 4; cd.data[i4] = r; cd.data[i4 + 1] = g; cd.data[i4 + 2] = b; cd.data[i4 + 3] = 255; const rv = Math.min(255, rough * 255); rd.data[i4] = rv; rd.data[i4 + 1] = rv; rd.data[i4 + 2] = rv; rd.data[i4 + 3] = 255; hd[y * S + x] = h;
  }
  cc.getContext('2d').putImageData(cd, 0, 0); rc.getContext('2d').putImageData(rd, 0, 0);
  const nd = hc.getContext('2d').createImageData(S, S), H0 = (x, y) => hd[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = H0(x + 1, y) - H0(x - 1, y), dy = H0(x, y + 1) - H0(x, y - 1); let vx = -dx * 2, vy = dy * 2, vz = 1; const L = Math.hypot(vx, vy, vz); const i4 = (y * S + x) * 4; nd.data[i4] = (vx / L * 0.5 + 0.5) * 255; nd.data[i4 + 1] = (vy / L * 0.5 + 0.5) * 255; nd.data[i4 + 2] = (vz / L * 0.5 + 0.5) * 255; nd.data[i4 + 3] = 255; }
  hc.getContext('2d').putImageData(nd, 0, 0);
  const an = Math.min(8, R.renderer.capabilities.getMaxAnisotropy()), tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / M.texM, 1 / M.texM); t.anisotropy = an; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
  return (R._marble[variant] = { map: tex(cc, true), normal: tex(hc), rough: tex(rc) });
};
R.marbleMaterial = function (variant) {
  R._marbleMat = R._marbleMat || {}; if (R._marbleMat[variant]) return R._marbleMat[variant];
  const THREE = T3(), t = R.marbleTextures(variant), M = R.MAT.marble;
  const m = new THREE.MeshStandardMaterial({ color: R.MAT.marbleTint[variant], map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(M.normal, M.normal), roughnessMap: t.rough, roughness: 1, metalness: 0 });
  m.shared = true; return (R._marbleMat[variant] = m);
};
/* Floor style per room, from the room's own seed (the same room always looks the same):
   stone = the worn flagstones · marble = beige or grey marble tiles · mixed = stone with a marble nave (temples, bosses) */
R.roomStyle = function (room) {
  if (room._style) return room._style;
  if (H.settings.look === 'classic') return (room._style = { floor: 'stone' });
  const rnd = R.decorRng(room); rnd(); const v = rnd() < 0.5 ? 'beige' : 'grey', k = rnd();
  const t = room.type;
  let floor = 'stone';
  if (H.G && H.G.run && H.G.run.forceStyle) floor = H.G.run.forceStyle;
  else if (t === 'warden' || t === 'arena') floor = 'mixed';
  else if (['shrine', 'treasure', 'rest', 'merchant', 'mystery'].includes(t)) floor = k < 0.6 ? 'marble' : 'mixed';
  else if (t === 'challenge') floor = k < 0.5 ? 'mixed' : 'marble';
  else floor = k < 0.6 ? 'stone' : k < 0.8 ? 'marble' : 'mixed';
  return (room._style = { floor, marble: v });
};
/* Stone floor: three CC0 scans (grey cartago slabs, rock 06, rock face 03) cut into 1×1 / 2×1 / 2×2 m tiles with
   joints, grouped in patches of one material with loose tiles mixed in. Baked offline (tools/floor_mix.py) into one
   seamless 16×16 m texture set; loaded once and shared. The room's light colours it slightly. */
R.MAT.mix = { dir: 'public/textures/floor_mix/', size: 16, normal: 0.9 };
R.mixFloorMaterial = function (tint) {
  const THREE = T3();
  if (!R._mixTex) { const L = new THREE.TextureLoader(), d = R.MAT.mix.dir, an = Math.min(8, R.renderer.capabilities.getMaxAnisotropy());
    const ld = (f, srgb) => { const t = L.load(d + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / R.MAT.mix.size, 1 / R.MAT.mix.size); t.anisotropy = an; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
    R._mixTex = { map: ld('color_2k.jpg', true), normal: ld('nor_gl_2k.jpg'), rough: ld('rough_1k.jpg') }; }
  const T = R._mixTex, c = new THREE.Color(0xffffff).lerp(tint || new THREE.Color(0xffffff), 0.12);
  return new THREE.MeshStandardMaterial({ color: c, map: T.map, normalMap: T.normal, normalScale: new THREE.Vector2(R.MAT.mix.normal, R.MAT.mix.normal), roughnessMap: T.rough, roughness: 1, metalness: 0 });
};
/* ---- Columns: a black-rock base, cracked-rock drums with a gold block, a black-rock capital on top ----
   Black rock, rock 06 and rock face 03 are CC0 scans (public/textures/pillar/, 512 px); the gold is a polished metal.
   Several models (PILLAR_MODELS: the order of the middle blocks, from the bottom up); paired columns share one. */
R.PILLAR_MODELS = [
  ['face03', 'rock06', 'gold'],              // the sketch: two cracked drums, gold under the capital
  ['rock06', 'gold', 'face03'],              // gold in the middle
  ['face03', 'rock06', 'face03', 'gold'],    // tall: three drums
  ['gold', 'rock06', 'face03']               // gold low, just above the base
];
R.pillarMats = function () {
  if (R._pillarMats) return R._pillarMats;
  const THREE = T3(), L = new THREE.TextureLoader(), d = 'public/textures/pillar/', an = Math.min(8, R.renderer.capabilities.getMaxAnisotropy());
  const ld = (f, srgb) => { const t = L.load(d + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = an; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
  const rock = (n, col, k) => { const m = new THREE.MeshStandardMaterial({ color: col, map: ld(n + '_diff.jpg', true), normalMap: ld(n + '_nor.jpg'), normalScale: new THREE.Vector2(k, k), roughnessMap: ld(n + '_rough.jpg'), roughness: 1, metalness: 0 }); m.shared = true; return m; };
  // polished gold: metallic enough to catch the light, with some diffuse left so it still reads as gold in the painted look
  const gold = new THREE.MeshStandardMaterial({ color: 0x8c6216, metalness: 0.8, roughness: 0.28 }); R.metalize(gold, 1.15); gold.shared = true;
  return (R._pillarMats = { black: rock('black', 0xb8b8b8, 1.1), rock06: rock('rock06', 0x9c9488, 1.0), face03: rock('face03', 0xa29a8e, 1.0), gold });
};
// a drum with UVs in metres (u around, v up; one repeat every `size` m) and its own random offset, so drums never match
R.drumGeo = function (rTop, rBot, h, size, rnd) {
  const g = new (T3().CylinderGeometry)(rTop, rBot, h, 8, 1), U = g.attributes.uv, circ = Math.PI * (rTop + rBot), ou = rnd(), ov = rnd();
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * circ / size + ou, U.getY(i) * h / size + ov);
  U.needsUpdate = true; return g;
};
R.buildBlockPillar = function (p, theme) {
  const THREE = T3(), M = R.pillarMats(), rnd = R.drand, oct = rr => rr / ((1 + Math.cos(Math.PI / 8)) / 2);
  const g = new THREE.Group();
  // paired columns (mirrored across the hall) get the same model
  const model = R.PILLAR_MODELS[Math.abs(Math.round(Math.abs(p.x) * 7 + p.z * 13)) % R.PILLAR_MODELS.length];
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.y = (rnd() - 0.5) * 0.25; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  // base: black rock, wider, two steps
  add(R.drumGeo(oct(p.r * 1.12), oct(p.r * 1.2), 0.32, 1.6, rnd), M.black, 0.06);
  add(R.drumGeo(oct(p.r * 1.02), oct(p.r * 1.06), 0.42, 1.6, rnd), M.black, 0.43);
  let y = 0.64;
  for (const k of model) {
    const isGold = k === 'gold', hh = isGold ? 0.42 + rnd() * 0.12 : 0.8 + rnd() * 0.35, rr = p.r * (isGold ? 1.04 : 0.95 + rnd() * 0.05);
    add(R.drumGeo(oct(rr), oct(rr), hh, isGold ? 3 : 1.6, rnd), M[k], y + hh / 2);
    if (isGold) { add(R.drumGeo(oct(rr * 1.05), oct(rr * 1.05), 0.06, 3, rnd), M.gold, y + 0.03); add(R.drumGeo(oct(rr * 1.05), oct(rr * 1.05), 0.06, 3, rnd), M.gold, y + hh - 0.03); }   // rims
    y += hh + 0.02;
  }
  // capital: black rock, flaring outward (the support), and a thin slab on top
  add(R.drumGeo(oct(p.r * 1.24), oct(p.r * 0.98), 0.5, 1.6, rnd), M.black, y + 0.25); y += 0.5;
  add(R.drumGeo(oct(p.r * 1.3), oct(p.r * 1.3), 0.16, 1.6, rnd), M.black, y + 0.08); y += 0.16;
  // the depth's magic stays: a cluster of glowing crystals on top
  const crysM = R.mat('crystal_' + theme.rune, () => new THREE.MeshBasicMaterial({ color: theme.rune, toneMapped: false }));
  for (let k = 0; k < 5; k++) { const cr = new THREE.Mesh(new THREE.ConeGeometry(0.1 + rnd() * 0.1, 0.5 + rnd() * 0.7, 5), crysM); cr.position.set((rnd() - .5) * p.r, y + 0.25, (rnd() - .5) * p.r); cr.rotation.set((rnd() - .5) * 0.8, 0, (rnd() - .5) * 0.8); g.add(cr); }
  const cg = R.glowSprite(theme.rune, 2.4); cg.position.y = y + 0.6; cg.material.opacity = 0.35; g.add(cg);
  g.rotation.y = rnd() * Math.PI / 4;
  g.position.set(p.x, 0, p.z); R.chamber.add(g); g.userData = { pillar: true, x: p.x, z: p.z, r: p.r, h: y, fade: 1, model: model.join('-') };
};
R.wallMaterial = function (tint) {
  if (H.settings.look !== 'classic') {
    // rock walls: colour, OpenGL normal and roughness from the CC0 scan; the depth's tint stays light so the rock reads
    const T = R.rockTextures(), THREE = T3();
    const c = new THREE.Color(0xffffff).lerp(tint || new THREE.Color(0xffffff), 0.3).multiplyScalar(R.MAT.rockLight);
    return new THREE.MeshStandardMaterial({ color: c, map: T.map, normalMap: T.normal, normalScale: new THREE.Vector2(R.MAT.rock.normal, R.MAT.rock.normal), roughnessMap: T.rough, roughness: 1, metalness: 0 });
  }
  if (!R.wallTex) {
    const N = 512; const cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d');
    c.fillStyle = '#1c1b1f'; c.fillRect(0, 0, N, N);
    const rows = 6, rh = N / rows;
    for (let r = 0; r < rows; r++) { let x = -(r % 2) * 60; while (x < N) { const w = 90 + Math.random() * 90; const g = 70 + Math.random() * 45 | 0; for (const dx of [0, N]) { c.fillStyle = `rgb(${g + 3},${g},${g + 5})`; c.fillRect(x + 3 - dx, r * rh + 3, w - 6, rh - 6); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x + 3 - dx, r * rh + 3, w - 6, 4); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 3 - dx, r * rh + rh - 9, w - 6, 6); for (let q = 0; q < 50; q++) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x - dx + Math.random() * w, r * rh + Math.random() * rh, 2, 2); } } x += w; } }
    const t = new (T3().CanvasTexture)(cv); t.encoding = T3().sRGBEncoding; t.wrapS = t.wrapT = T3().RepeatWrapping; R.wallTex = t;
  }
  return new (T3().MeshStandardMaterial)({ color: tint, map: R.wallTex, roughness: 1, metalness: 0 });
};
/* Room outline on a 2 m lattice: cells inside the walkable area, and the ring of cells right around it (walls). */
R.roomGrid = function (room) {
  const b = room.bounds, x0 = b.minX - 4, z0 = b.minZ - 4, nx = Math.round((b.maxX - b.minX) / 2) + 4, nz = Math.round((b.maxZ - b.minZ) / 2) + 4;
  const ins = []; for (let j = 0; j < nz; j++) { ins.push([]); for (let i = 0; i < nx; i++) ins[j].push(H.G.inRoom(x0 + i * 2 + 1, z0 + j * 2 + 1, 0, room)); }
  const inside = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && ins[j][i];
  const ring = (i, j) => !inside(i, j) && [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(([a, c]) => inside(i + a, j + c));
  return { x0, z0, nx, nz, inside, ring, cx: i => x0 + i * 2 + 1, cz: j => z0 + j * 2 + 1 };
};
// wall blocks: every ring cell, with the side of the floor it faces
R.wallCells = function (g) {
  const out = [];
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) { if (!g.ring(i, j)) continue;
    const dir = g.inside(i, j + 1) ? 'n' : g.inside(i + 1, j) ? 'w' : g.inside(i - 1, j) ? 'e' : g.inside(i, j - 1) ? 's' : (g.inside(i - 1, j + 1) || g.inside(i + 1, j + 1)) ? 'n' : 's';
    out.push({ x: g.cx(i), z: g.cz(j), dir }); }
  return out;
};
// outline loop (world x, z corners) of a set of lattice cells
R.cellOutline = function (g, inSet) {
  const next = new Map(), key = (a, b) => a + ',' + b;
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) { if (!inSet(i, j)) continue;
    const X0 = g.x0 + i * 2, X1 = X0 + 2, Z0 = g.z0 + j * 2, Z1 = Z0 + 2;
    if (!inSet(i, j - 1)) next.set(key(X0, Z0), [X1, Z0]); if (!inSet(i + 1, j)) next.set(key(X1, Z0), [X1, Z1]);
    if (!inSet(i, j + 1)) next.set(key(X1, Z1), [X0, Z1]); if (!inSet(i - 1, j)) next.set(key(X0, Z1), [X0, Z0]); }
  const [k0] = next.keys(); if (!k0) return [];
  const pts = []; let k = k0, guard = 0; do { const [x, z] = k.split(',').map(Number); pts.push([x, z]); const n = next.get(k); if (!n) break; k = key(n[0], n[1]); } while (k !== k0 && guard++ < 10000);
  // drop the points in the middle of straight runs
  return pts.filter((p, i) => { const a = pts[(i - 1 + pts.length) % pts.length], c = pts[(i + 1) % pts.length]; return (p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0]) !== 0; });
};
R.buildChamber = function (room, theme) {
  const THREE = T3();
  R.clearChamber();
  R.theme = theme; R.drand = R.decorRng(room);
  R.scene.background.setHex(theme.fog); R.scene.fog.color.setHex(theme.fog);
  R.hemi.color.setHex(theme.light);
  const b = room.bounds;
  const W = b.maxX - b.minX, D = b.maxZ - b.minZ;
  // floor: one continuous paver surface (gray brick, running bond) with real holes for pits
  const tint = H.settings.look === 'classic' ? new THREE.Color(0xffffff).lerp(new THREE.Color(theme.light), 0.12).multiplyScalar(0.7) : new THREE.Color(0xffffff).lerp(new THREE.Color(theme.rune), 0.14).multiplyScalar(0.6);
  const style = R.roomStyle(room);
  const floorMat = style.floor === 'marble' ? R.marbleMaterial(style.marble) : R.floorMaterial(tint);
  const grid = R.roomGrid(room); room._grid = grid;
  const shape = new THREE.Shape(); const loop = R.cellOutline(grid, (i, j) => grid.inside(i, j) || grid.ring(i, j));
  loop.forEach(([x, z], k) => k ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  for (const p of room.pits) { const hole = new THREE.Path(); hole.absarc(p.x, -p.z, p.r + 0.05, 0, Math.PI * 2, true); shape.holes.push(hole); }
  const fgeo = new THREE.ShapeGeometry(shape, 24); fgeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(fgeo, floorMat); floor.receiveShadow = true; floor.position.y = 0; R.chamber.add(floor);
  // mixed: a marble nave down the middle of the hall (whole tiles, holes for pits), stone all around
  if (style.floor === 'mixed') {
    const mh = room.main || b, tl = R.MAT.marble.tile, m = 4, x0 = Math.ceil((mh.minX + m) / tl) * tl, x1 = Math.floor((mh.maxX - m) / tl) * tl, z0 = Math.ceil((mh.minZ + m) / tl) * tl, z1 = Math.floor((mh.maxZ - 2) / tl) * tl;
    const nave = Math.min(x1 - x0, Math.max(8, Math.round((x1 - x0) * 0.45 / tl) * tl)), nx0 = Math.round(((x0 + x1) / 2 - nave / 2) / tl) * tl;
    const sh = new THREE.Shape(); sh.moveTo(nx0, -z1); sh.lineTo(nx0 + nave, -z1); sh.lineTo(nx0 + nave, -z0); sh.lineTo(nx0, -z0); sh.lineTo(nx0, -z1);
    for (const p of room.pits) if (p.x + p.r > nx0 && p.x - p.r < nx0 + nave && p.z + p.r > z0 && p.z - p.r < z1) { const hole = new THREE.Path(); hole.absarc(p.x, -p.z, p.r + 0.05, 0, Math.PI * 2, true); sh.holes.push(hole); }
    const ng = new THREE.ShapeGeometry(sh, 24); ng.rotateX(-Math.PI / 2);
    const nv = new THREE.Mesh(ng, R.marbleMaterial(style.marble)); nv.receiveShadow = true; nv.position.y = 0.006; R.chamber.add(nv);
    room._nave = { x0: nx0, x1: nx0 + nave, z0, z1 };
  }
  // soft dark vignette toward the walls so the room edge reads without a hard grid
  const vg = new THREE.Mesh(new THREE.PlaneGeometry(W + 4.4, D + 4.4), new THREE.MeshBasicMaterial({ map: R.texVignette || (R.texVignette = R.canvasTex(256, 256, c => { const g = c.createRadialGradient(128, 128, 60, 128, 128, 182); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); })), transparent: true, depthWrite: false }));
  vg.rotation.x = -Math.PI / 2; vg.position.set((b.minX + b.maxX) / 2, 0.012, (b.minZ + b.maxZ) / 2); R.chamber.add(vg);
  // a soft pool of the depth's light in the middle of the floor: the fight area reads brighter than the edges
  if (H.settings.look !== 'classic') {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.1, D * 1.1), new THREE.MeshBasicMaterial({ map: R.texPool || (R.texPool = R.canvasTex(256, 256, c => { const g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); })), color: theme.rune, transparent: true, opacity: H.settings.look === 'painted' ? 0.06 : 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set((b.minX + b.maxX) / 2, 0.014, (b.minZ + b.maxZ) / 2); R.chamber.add(pool);
  }
  // pit walls (short brick collars going down)
  for (const p of room.pits) { const col = new THREE.Mesh(new THREE.CylinderGeometry(p.r + 0.05, p.r + 0.05, 1.2, 32, 1, true), R.std(0x1a181c, { side: THREE.BackSide, roughness: 1 })); col.position.set(p.x, -0.6, p.z); R.chamber.add(col); }
  // rune circles on floor
  for (let k = 0; k < 3; k++) {
    const r = 1.5 + R.drand() * 2.5; let x = R.drandRange(b.minX + 3, b.maxX - 3), z = R.drandRange(b.minZ + 3, b.maxZ - 3); for (let t = 0; t < 8 && !H.G.inRoom(x, z, r * 0.6, room); t++) { x = R.drandRange(b.minX + 3, b.maxX - 3); z = R.drandRange(b.minZ + 3, b.maxZ - 3); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: R.texRune, color: theme.rune, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = R.drand() * 6; m.position.set(x, 0.03, z); R.chamber.add(m);
  }
  // walls
  const wallMat = R.wallMaterial(H.settings.look === 'classic' ? new THREE.Color(0xffffff).lerp(new THREE.Color(theme.light), 0.1).multiplyScalar(0.5) : new THREE.Color(0xffffff).lerp(new THREE.Color(theme.rune), 0.18).multiplyScalar(0.36));
  const runeMat = R.basic(theme.rune);
  const wallTops = [];
  const addBlock = (x, z, w, h, d, low, east, side) => {
    if (!low && side) wallTops.push({ x, z, w, d, top: h - 0.3, side });
    const m = new THREE.Mesh(H.settings.look !== 'classic' ? R.worldBoxUV(w, h, d, x, h / 2 - 0.3, z, R.MAT.rock.size) : R.boxUV(w, h, d, 0.5), wallMat); m.position.set(x, h / 2 - 0.3, z); m.castShadow = !low; m.receiveShadow = true; R.chamber.add(m);
    if (east) { m.userData.eastWall = true; m.userData.h = h; }
    if (!low && R.drand() < 0.35) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.08, d * 1.02), runeMat); s.position.set(x, h * (0.3 + R.drand() * 0.5), z); R.chamber.add(s); if (east) { s.userData.eastWall = true; s.userData.rune = true; } }
  };
  const doorXs = room.doors.map(d => d.x);
  // one 2×2 m block on every cell of the ring around the floor: north faces tall (doors cut a low gate),
  // west/east faces tall and fading toward the south, south faces low so the camera sees in
  room._faces = [];
  for (const w of R.wallCells(grid)) {
    const { x, z, dir } = w, side = 2.4 + R.drand() * 2 * (1 - (z - b.minZ) / D);
    if (dir === 'n') { const gate = room.doors.some(d => Math.abs(d.x - x) < 2.2 && Math.abs(d.z - (z + 0.4)) < 1.2); if (gate) addBlock(x, z - 0.6, 2, 0.5, 0.8, true); else { addBlock(x, z, 2, 3 + R.drand() * 2.5, 2, false, false, 'n'); room._faces.push({ x, z: z + 1.1, ry: 0 }); } }
    else if (dir === 'w') { addBlock(x, z, 2, side, 2, false, false, 'w'); room._faces.push({ x: x + 1.1, z, ry: Math.PI / 2 }); }
    else if (dir === 'e') addBlock(x, z, 2, side, 2, false, true);
    else addBlock(x, z, 2, 0.5, 2, true);
  }
  // pillars: stacks of big, solid stone blocks
  if (!R.blockTex) {
    const N = 256; const cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d');
    c.fillStyle = '#7a7680'; c.fillRect(0, 0, N, N);
    for (let q = 0; q < 1400; q++) { const g = 90 + R.drand() * 70 | 0; c.fillStyle = `rgba(${g},${g - 2},${g + 4},${0.15 + R.drand() * 0.25})`; const r = 1 + R.drand() * 5; c.beginPath(); c.arc(R.drand() * N, R.drand() * N, r, 0, 7); c.fill(); }
    for (let q = 0; q < 6; q++) { c.strokeStyle = 'rgba(30,26,34,.55)'; c.lineWidth = 1 + R.drand(); c.beginPath(); let x = R.drand() * N, y = R.drand() * N; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R.drand() - .5) * 40; y += (R.drand() - .5) * 40; c.lineTo(x, y); } c.stroke(); }
    const eg = c.createLinearGradient(0, 0, 0, N); eg.addColorStop(0, 'rgba(255,255,255,.12)'); eg.addColorStop(.08, 'rgba(255,255,255,0)'); eg.addColorStop(.9, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = eg; c.fillRect(0, 0, N, N);
    const eg2 = c.createLinearGradient(0, 0, N, 0); eg2.addColorStop(0, 'rgba(0,0,0,.25)'); eg2.addColorStop(.07, 'rgba(0,0,0,0)'); eg2.addColorStop(.93, 'rgba(0,0,0,0)'); eg2.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = eg2; c.fillRect(0, 0, N, N);
    R.blockTex = new THREE.CanvasTexture(cv); R.blockTex.encoding = THREE.sRGBEncoding;
  }
  const stoneTint = new THREE.Color(0xffffff).lerp(new THREE.Color(theme.light), 0.12).multiplyScalar(0.72);
  const blockMats = [0.95, 1.05, 1.15].map(k => new THREE.MeshStandardMaterial({ map: R.blockTex, color: stoneTint.clone().multiplyScalar(k), roughness: 0.95, metalness: 0, flatShading: true }));
  // pillars: stacked octagonal stone drums. The drums sit on the collision circle (flat faces just
  // inside, corners just outside), so what you see is what blocks you; only the capstone, above head
  // height, overhangs.
  const oct = rr => rr / ((1 + Math.cos(Math.PI / 8)) / 2);   // circumradius whose mean edge sits at rr
  for (const p of room.pillars) {
    if (H.settings.look !== 'classic') { R.buildBlockPillar(p, theme); continue; }
    const g = new THREE.Group();
    const h = 3.4 + R.drand() * 1.4;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(oct(p.r * 1.0), oct(p.r * 1.02), 0.4, 8), blockMats[0]); plinth.position.y = -0.1; plinth.castShadow = plinth.receiveShadow = true; g.add(plinth);
    let y = 0.1; const n = 3 + (R.drand() < 0.5 ? 1 : 0); const bh = (h - 0.8) / n;
    for (let k = 0; k < n; k++) {
      const rr = p.r * (0.96 + R.drand() * 0.04), hh = bh - 0.05;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(oct(rr), oct(rr), hh, 8), blockMats[(k + 1) % 3]);
      b.position.set(0, y + hh / 2, 0); b.rotation.y = (R.drand() - .5) * 0.2;
      b.castShadow = b.receiveShadow = true; g.add(b); y += bh;
      // chipped edge on some drums
      if (R.drand() < 0.4) { const ca = R.drand() * Math.PI * 2; const chip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), R.basic(0x0e0c12)); chip.position.set(Math.cos(ca) * rr * 0.86, b.position.y + hh / 2 - 0.05, Math.sin(ca) * rr * 0.86); chip.rotation.set(0.6, 0.7, 0); g.add(chip); }
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(oct(p.r * 1.16), oct(p.r * 1.02), 0.5, 8), blockMats[2]); cap.position.y = y + 0.25; cap.castShadow = true; g.add(cap);
    // faint rune seam between two drums
    const band = new THREE.Mesh(new THREE.CylinderGeometry(oct(p.r * 0.985), oct(p.r * 0.985), 0.06, 8), runeMat); band.position.y = 0.1 + bh * (1 + (R.drand() < .5 ? 1 : 0)) - 0.025; g.add(band);
    if (H.settings.look !== 'classic') {
      // carved greek-key band just under the capital, and a cluster of glowing crystals on top
      const bandM = R.mat('meanderBand_' + theme.light, () => new THREE.MeshStandardMaterial({ map: R.bandTexture(), color: stoneTint.clone().multiplyScalar(1.25), roughness: 0.9, metalness: 0 }));
      const mb = new THREE.Mesh(new THREE.CylinderGeometry(oct(p.r * 1.012), oct(p.r * 1.012), 0.42, 8, 1, true), bandM); mb.geometry.attributes.uv.array.forEach((v, k, a) => { if (k % 2 === 0) a[k] = v * 4; }); mb.position.y = y - 0.3; g.add(mb);
      const crysM = R.mat('crystal_' + theme.rune, () => new THREE.MeshBasicMaterial({ color: theme.rune, toneMapped: false }));
      for (let k = 0; k < 5; k++) { const cr = new THREE.Mesh(new THREE.ConeGeometry(0.1 + R.drand() * 0.1, 0.5 + R.drand() * 0.7, 5), crysM); cr.position.set((R.drand() - .5) * p.r, y + 0.5 + 0.25, (R.drand() - .5) * p.r); cr.rotation.set((R.drand() - .5) * 0.8, 0, (R.drand() - .5) * 0.8); g.add(cr); }
      const cg = R.glowSprite(theme.rune, 2.4); cg.position.y = y + 1.0; cg.material.opacity = 0.35; g.add(cg);
    }
    g.rotation.y = R.drand() * Math.PI / 4;
    g.position.set(p.x, 0, p.z); R.chamber.add(g); g.userData = { pillar: true, x: p.x, z: p.z, r: p.r, h, fade: 1 };
  }
  // pits
  for (const p of room.pits) {
    const pit = new THREE.Mesh(new THREE.CircleGeometry(p.r + 0.5, 32), R.basic(0x000000)); pit.rotation.x = -Math.PI / 2; pit.position.set(p.x, -0.6, p.z); R.chamber.add(pit);
    const rim = new THREE.Mesh(new THREE.RingGeometry(p.r - 0.05, p.r + 0.15, 40), new THREE.MeshBasicMaterial({ color: theme.rune, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, 0.02, p.z); R.chamber.add(rim);
    const glow = R.glowSprite(theme.rune, p.r * 3.2); glow.position.set(p.x, -1.2, p.z); glow.material.opacity = 0.35; R.chamber.add(glow);
  }
  // vents
  for (const v of room.vents) {
    const g = new THREE.Group();
    const grate = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r * 1.05, 0.1, 8), R.std(0x1a1414, { metalness: 0.6, roughness: 0.4 })); grate.position.y = 0.02; g.add(grate);
    const core = new THREE.Mesh(new THREE.CircleGeometry(v.r * 0.75, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.4 })); core.rotation.x = -Math.PI / 2; core.position.y = 0.08; g.add(core);
    g.position.set(v.x, 0, v.z); R.chamber.add(g); v.mesh = core;
  }
  // braziers along side walls
  const mh = room.main || b, MD = mh.maxZ - mh.minZ, brz = [];
  for (const k of [0.3, 0.8]) for (const sx of [-1, 1]) { const x = sx < 0 ? mh.minX + 0.6 : mh.maxX - 0.6; let z = null;
    for (const t of [k, k - 0.12, k + 0.12, k - 0.24, k + 0.24, 0.12, 0.92]) { const zz = mh.minZ + MD * t; if (!H.G.inRoom(x + sx * 1.6, zz, 0, room)) { z = zz; break; } }   // a real wall behind it, not an opening
    if (z != null) brz.push([x, z]); }
  // each one a cup brazier with a painted fire (js/brazier.js); the first two take the fixed pool's lights
  brz.forEach((p, i) => R.braziers.push(R.brazier.build(p[0], p[1], theme, room, i)));
  // doors
  for (const d of room.doors) R.buildDoor(d, theme);
  // prop
  if (room.prop) R.buildProp(room.prop, theme);
  // scenery kit for this depth: wall tops, wall faces, flat scatter by the walls (nothing that blocks)
  if (H.settings.look !== 'classic') R.buildDecor(room, theme, wallTops, doorXs);
  // key light/shadow fits room: the shadow camera covers just this room, so its texels stay sharp
  R.key.position.set(b.minX + W * 0.3, 18, b.minZ + D * 0.7); R.key.target.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  { const sc = R.key.shadow.camera, ext = Math.hypot(W, D) / 2 + 3; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
  if (R.rim) R.rim.intensity = H.settings.look === 'classic' ? 0 : 0.45;
  // the key light takes some of the depth's colour (the classic look keeps its warm torchlight)
  R.key.color.setHex(0xffd9b0); R.key.intensity = 0.6; if (H.settings.look !== 'classic') { R.key.color.setHex(0xd8e8e0).lerp(new THREE.Color(theme.rune), 0.25); R.key.intensity = 0.5; }
  // painted look: a neutral stone-grey key, so the greys stay grey and the green comes from the fires
  if (H.settings.look === 'painted') { R.key.color.setHex(0xd6d2ca); R.key.intensity = 0.62; R.hemi.color.setHex(0x9aa4a6); }
  if (R.rim) R.rim.color.setHex(H.settings.look === 'classic' ? 0x8fa8ff : 0x7fe0d0);
  // fewer draw calls: walls, rune strips and other loose static pieces become a few meshes; each pillar
  // and brazier is merged inside its own group (pillars must stay separate to fade on their own)
  if (H.settings.bake !== false) {
    R.bakeChildren(R.chamber);
    for (const g of R.chamber.children) if (g.isGroup && (g.userData.pillar || g.userData.brazier)) R.bakeChildren(g);
  }
  R.applyWallCut();
  R._warmPending = Math.max(1, H.DEPTHS.indexOf(theme));   // done on the next frame, once the heroes (and their lights) exist
};
R.makeWoodTexture = function () {
  const W = 256, Hh = 512; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
  const planks = 4, pw = W / planks;
  for (let k = 0; k < planks; k++) {
    const base = [96 + R.drand() * 22, 64 + R.drand() * 14, 40 + R.drand() * 10].map(v => v | 0);
    c.fillStyle = `rgb(${base})`; c.fillRect(k * pw, 0, pw, Hh);
    for (let q = 0; q < 26; q++) { const x = k * pw + R.drand() * pw; c.strokeStyle = `rgba(${R.drand() < .5 ? '40,24,12' : '150,110,70'},${0.15 + R.drand() * 0.25})`; c.lineWidth = 0.6 + R.drand() * 1.6; c.beginPath(); c.moveTo(x, 0); let xx = x; for (let y = 0; y <= Hh; y += 16) { xx += (R.drand() - .5) * 1.6; c.lineTo(Math.max(k * pw + 1, Math.min((k + 1) * pw - 1, xx)), y); } c.stroke(); }
    for (let q = 0; q < 2; q++) if (R.drand() < .7) { const kx = k * pw + pw * (0.25 + R.drand() * .5), ky = R.drand() * Hh; c.fillStyle = 'rgba(45,26,14,.75)'; c.beginPath(); c.ellipse(kx, ky, 4 + R.drand() * 3, 8 + R.drand() * 6, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(45,26,14,.35)'; c.beginPath(); c.ellipse(kx, ky, 9, 18, 0, 0, 7); c.stroke(); }
    c.fillStyle = 'rgba(20,10,4,.85)'; c.fillRect(k * pw, 0, 3, Hh); c.fillStyle = 'rgba(255,220,170,.08)'; c.fillRect(k * pw + 3, 0, 2, Hh);
  }
  const g = c.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(0,0,0,.1)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,6,2,.45)'); c.fillStyle = g; c.fillRect(0, 0, W, Hh);
  const t = new (T3().CanvasTexture)(cv); t.encoding = T3().sRGBEncoding; return t;
};
R.makeDoorLeaves = function () {
  const THREE = T3();
  if (!R.woodTex) R.woodTex = R.makeWoodTexture();
  const wood = R.mat('doorWood', () => new THREE.MeshStandardMaterial({ map: R.woodTex, color: 0xc9b6a2, roughness: 0.9, metalness: 0 }));
  const iron = R.mat('doorIron', () => new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.55, metalness: 0.75, flatShading: true }));
  const out = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 1.2, 0, 0.1);
    const leaf = new THREE.Group(); leaf.position.x = -side * 0.6; pivot.add(leaf);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.18, 3.6, 0.16), wood); slab.position.y = 1.8; slab.castShadow = true; leaf.add(slab);
    for (const y of [0.7, 2.9]) { const band = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.2), iron); band.position.set(0, y, 0.02); leaf.add(band); for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.06), iron); st.position.set(-0.45 + k * 0.3, y, 0.13); leaf.add(st); } }
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), iron); hinge.position.set(side * 0.58, 1.8, 0); leaf.add(hinge);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 5, 12), iron); ring.position.set(-side * 0.42, 1.75, 0.12); leaf.add(ring);
    pivot.userData.side = side; out.push(pivot);
  }
  return out;
};
R.buildDoor = function (d, theme) {
  const THREE = T3();
  const info = H.NODES[d.type] || H.NODES.combat;
  const g = new THREE.Group();
  const stone = R.wallMaterial(new THREE.Color(0xffffff).lerp(new THREE.Color(theme.light), 0.1).multiplyScalar(0.62));
  for (const s of [-1, 1]) { const p = new THREE.Mesh(R.boxUV(0.7, 4.2, 0.9, 0.5), stone); p.position.set(s * 1.55, 1.8, 0); p.castShadow = true; g.add(p); }
  const top = new THREE.Mesh(R.boxUV(4, 0.8, 1, 0.5), stone); top.position.set(0, 4.1, 0); g.add(top);
  const step = new THREE.Mesh(R.boxUV(3.2, 0.14, 1.1, 0.5), stone); step.position.set(0, 0.07, 0.35); g.add(step);
  const color = new THREE.Color(info.css);
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uOpen: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; uniform float uOpen; varying vec2 vUv; void main(){ vec2 p=vUv-vec2(0.5,0.35); float r=length(p*vec2(1.0,0.75)); float a=atan(p.y,p.x); float sw=sin(a*5.0+r*18.0-uTime*3.0)*0.5+0.5; float v=(1.0-smoothstep(0.0,0.65,r)); vec3 c=mix(uColor*0.25,uColor*1.6,sw*v); float alpha=(0.25+0.75*uOpen)*v + 0.15; gl_FragColor=vec4(c*(0.35+0.65*uOpen), alpha);}'
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.7), portalMat); portal.position.set(0, 1.7, 0.05); g.add(portal);
  // rustic double wooden doors, hinged on the stone jambs; they swing into the room when it is cleared
  const leaves = R.makeDoorLeaves(); leaves.forEach(l => g.add(l));
  if (H.settings.bake !== false) { R.bakeChildren(g); leaves.forEach(l => l.children.forEach(leaf => R.bakeChildren(leaf))); }
  const bars = { position: { y: 0 } };
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.glyphTexture(info.glyph, info.css, info.name), transparent: true, depthWrite: false }));
  icon.material.map._own = true;   // made for this door only: freed with it
  icon.scale.set(2.6, 2.6, 2.6); icon.position.set(0, 5.9, 0.2); g.add(icon);
  g.position.set(d.x, 0, d.z);
  R.chamber.add(g);
  R.doorObjs.push({ d, g, portalMat, bars, leaves, icon, open: 0, dust: false });
};
R.buildProp = function (prop, theme) {
  const THREE = T3();
  const g = new THREE.Group(); const k = prop.kind; const stone = R.std(theme.stone, { roughness: 0.9 });
  let glowColor = 0xffffff;
  if (k === 'altar') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.2), stone); slab.position.y = 0.4; g.add(slab);
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3 + R.drand() * 0.3, 5), R.std(0xe8dcc0)); c.position.set(-0.8 + i * 0.4, 1.05, (R.drand() - .5) * 0.6); g.add(c); const f = R.glowSprite(0xff3d5e, 0.5); f.position.set(c.position.x, 1.35, c.position.z); g.add(f); }
    glowColor = 0xff3d5e;
  } else if (k === 'hearth') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.3, 5, 8), stone); ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 5), R.std(0x3a2618)); l.rotation.z = Math.PI / 2; l.rotation.y = i * Math.PI / 4; l.position.y = 0.25; g.add(l); }
    glowColor = 0xff9a52; prop.fire = true;
  } else if (k === 'shrine') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 0.8, 6), stone); base.position.y = 0.3; g.add(base);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: 0xc39bff, emissive: 0x7a3cff, emissiveIntensity: 1.2, flatShading: true })); gem.position.y = 1.9; g.add(gem); prop.spin = gem;
    glowColor = 0xa070ff;
  } else if (k === 'chest') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1), R.std(0x5a3a22)); body.position.y = 0.45; g.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 8, 1, false, 0, Math.PI), R.std(0x6a4528)); lid.rotation.z = Math.PI / 2; lid.position.y = 0.9; g.add(lid); prop.lid = lid;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 1.05), R.std(0xd9a441, { metalness: 0.8, roughness: 0.3 })); band.position.y = 0.7; g.add(band);
    glowColor = 0xffd27a;
  } else if (k === 'eye') {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 6, 16), R.std(0x2a2a2a, { metalness: .7, roughness: .3 })); frame.position.y = 2.1; g.add(frame);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color: 0x0a1418 })); iris.position.y = 2.1; g.add(iris);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), new THREE.MeshBasicMaterial({ color: 0x86e8d6 })); pupil.position.set(0, 2.1, 0.02); g.add(pupil); prop.pupil = pupil;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 1.2, 6), stone); stand.position.y = 0.5; g.add(stand);
    glowColor = 0x86e8d6;
  } else if (k === 'merchant') {
    // a hooded travelling trader with an overloaded pack, a lantern and a rug of wares
    const robe = R.std(0x4a5a3a), hoodM = R.std(0x3a4a2e), skin = R.std(0x2a1e18), leather = R.std(0x6a4a2a), cloth = R.std(0x8a3a2a);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 1.5), R.std(0x7a2a2a)); rug.position.set(0, 0.02, 0.9); g.add(rug);
    const rugB = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.045, 1.2), R.std(0xb08a3a)); rugB.position.set(0, 0.025, 0.9); g.add(rugB);
    const npc = new THREE.Group(); g.add(npc); prop.npc = npc;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.72, 1.7, 8), robe); body.position.y = 0.85; npc.add(body);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.12, 8), leather); belt.position.y = 1.05; npc.add(belt);
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.12), leather); pouch.position.set(0.3, 0.95, 0.42); npc.add(pouch);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.9, 8), hoodM); hood.position.y = 2.05; npc.add(hood);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), skin); face.position.set(0, 1.85, 0.12); npc.add(face);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), eyeM); e.position.set(s * 0.1, 1.9, 0.4); npc.add(e); }
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.09, 5, 10), cloth); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.62; npc.add(scarf);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.8, 6), robe); arm.position.set(s * 0.5, 1.25, 0.18); arm.rotation.x = -0.7; arm.rotation.z = s * 0.25; npc.add(arm); }
    // pack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.65), leather); pack.position.set(0, 1.45, -0.6); npc.add(pack);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8), cloth); roll.rotation.z = Math.PI / 2; roll.position.set(0, 2.2, -0.6); npc.add(roll);
    const potM = [R.std(0x3a6aa0), R.std(0xa04a2a), R.std(0x5a8a3a)];
    for (let i = 0; i < 3; i++) { const pot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), potM[i]); pot.position.set(-0.45 + i * 0.45, 0.85, -0.95); npc.add(pot); }
    // lantern pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 5), leather); pole.position.set(1.15, 1.3, -0.2); g.add(pole);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), leather); arm2.position.set(1.0, 2.55, -0.2); g.add(arm2);
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: 0xffd27a })); lantern.position.set(0.8, 2.35, -0.2); g.add(lantern);
    const lg = R.glowSprite(0xffc060, 2.2); lg.position.copy(lantern.position); g.add(lg); prop.lantern = lg;
    // wares on the rug (one per rarity); hidden when sold
    prop.wares = ['#c9bfae', '#7fd18b', '#6fb2ff'].map((c, i) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, flatShading: true })); m.position.set(-0.9 + i * 0.9, 0.45, 1.0); g.add(m); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.18, 6), R.std(0x3a2a20)); st.position.set(-0.9 + i * 0.9, 0.1, 1.0); g.add(st); return m; });
    glowColor = 0x9be07a;
  } else if (k === 'descent') {
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: R.texRune, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; g.add(disc); prop.spin = disc;
    glowColor = 0xffd27a; prop.column = true;
  }
  const glow = R.glowSprite(glowColor, 4); glow.position.y = 1.4; glow.material.opacity = 0.5; g.add(glow);
  R.toonify(g, prop, { outline: false });
  g.position.set(prop.x, 0, prop.z); R.chamber.add(g);
  prop.g = g; prop.glow = glow; prop.glowColor = glowColor; R.props.push(prop);
};
/* ---- Scenery kits ----
   Static dressing per depth, merged into one mesh per material so a room adds a handful of draw calls.
   It sits on wall tops, hangs on the north and west wall faces (the ones the isometric camera sees) or
   lies flat on the floor by the walls: nothing stands where it could be mistaken for an obstacle. */
R.mergeGeos = function (list, keep, withColor) {
  const THREE = T3(); let n = 0;
  const parts = list.map(({ geo, mx }) => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (!keep && !geo.shared) geo.dispose(); g.applyMatrix4(mx); n += g.attributes.position.count; return g; });
  const withUV = parts.every(g => g.attributes.uv);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = withUV ? new Float32Array(n * 2) : null, col = withColor ? new Float32Array(n * 3) : null; let o = 0;
  parts.forEach((g, i) => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (uv) uv.set(g.attributes.uv.array, o * 2); if (col) { const k = list[i].color; for (let v = 0; v < c; v++) { col[(o + v) * 3] = k.r; col[(o + v) * 3 + 1] = k.g; col[(o + v) * 3 + 2] = k.b; } } o += c; g.dispose(); });
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3)); return out;
};
/* Merge the static direct children of a group that look alike (same material apart from colour, same
   shadow flags) into one mesh each; colours become vertex colours. Used for the room's walls, pillars
   and braziers, which never move once built. */
R.bakeChildren = function (parent, accept) {
  const THREE = T3(); const groups = new Map();
  for (const c of parent.children) {
    if (!c.isMesh || c.isSkinnedMesh || c.children.length || !c.visible || Object.keys(c.userData).length || (accept && !accept(c))) continue;
    const mt = c.material; if (!mt || Array.isArray(mt) || mt.transparent || mt.blending !== 1 || mt.isShaderMaterial || mt.vertexColors || !c.geometry.attributes.normal) continue;
    const key = [mt.type, mt.map ? mt.map.uuid : '', mt.emissive ? mt.emissive.getHex() : '', mt.side, mt.flatShading, mt.roughness, mt.metalness, mt.gradientMap ? 1 : 0, c.castShadow, c.receiveShadow].join('|');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const same = list.every(c => c.material.color.equals(list[0].material.color));
    const items = list.map(c => { c.updateMatrix(); return { geo: c.geometry, mx: c.matrix.clone(), color: c.material.color }; });
    let mat = list[0].material; if (!same) { mat = mat.clone(); mat.color.setRGB(1, 1, 1); mat.vertexColors = true; }
    const mesh = new THREE.Mesh(R.mergeGeos(items, false, !same), mat); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    for (const c of list) { parent.remove(c); if (c.material !== mat && !c.material.shared && list.every(o => o === c || o.material !== c.material)) c.material.dispose(); }
    parent.add(mesh);
  }
};
/* Bake: inside each rigid piece of a model (its body, and every part the animation moves), merge the
   static meshes that share a material into one mesh. The pieces the animation touches stay as they
   are, so poses, flashes and fades work unchanged; a husk goes from ~17 draw calls to a handful. */
R.bakeModel = function (m) {
  if (!m || !m.body || H.settings.bake === false) return;
  const THREE = T3();
  const refs = new Set(); const seen = new Set();
  const collect = v => { if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v); if (v.isObject3D) { refs.add(v); return; } if (v.isMaterial || v.isTexture || v.isAnimationMixer || v.mixer) return; if (Array.isArray(v)) v.forEach(collect); else if (v.constructor === Object) Object.values(v).forEach(collect); };
  // everything the model keeps a handle on (its fields, arrays of parts, and handles stored in userData) may move,
  // hide or change later, so it stays a separate piece
  for (const [k, v] of Object.entries(m)) if (k !== 'mats' && k !== 'anim' && k !== 'glbInst') collect(v);
  m.root.traverse(o => { for (const v of Object.values(o.userData || {})) { seen.delete(v); collect(v); } });
  if ((m.parts && m.parts.glb) || m.glb) return;               // .glb models are already authored; leave them alone
  const anchors = new Set(refs); anchors.add(m.body);
  m.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4();
  for (const A of anchors) {
    if (A !== m.body && !isUnder(A, m.body)) continue;
    const groups = new Map();
    const walk = o => { for (const c of o.children) { if (anchors.has(c) || !c.visible) continue; if (c.isMesh && !c.isSkinnedMesh && !c.children.length && okMat(c.material) && c.geometry && c.geometry.attributes.normal && !c.userData.outline) { const key = matKey(c.material); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); } walk(c); } };
    walk(A);
    inv.copy(A.matrixWorld).invert();
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const items = list.map(c => ({ geo: c.geometry, mx: new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld), color: c.material.color }));
      const sameColor = list.every(c => c.material.color.equals(list[0].material.color));
      let mat = list[0].material;
      if (!sameColor) {
        // one material for all of them: white base colour, each piece keeps its colour as vertex colour
        mat = list[0].material.clone(); mat.color.setRGB(1, 1, 1); mat.vertexColors = true; mat.userData = Object.assign({}, list[0].material.userData);
        const gone = new Set(list.map(c => c.material));
        if (m.mats) { m.mats = m.mats.filter(x => !gone.has(x) || stillUsed(x, list)); m.mats.push(mat); }
      }
      const mesh = new THREE.Mesh(R.mergeGeos(items, false, !sameColor), mat);
      mesh.castShadow = list.some(c => c.castShadow); mesh.receiveShadow = list.some(c => c.receiveShadow); mesh.userData.baked = list.length;
      for (const c of list) c.parent.remove(c);
      A.add(mesh);
    }
  }
  function isUnder(o, top) { for (let q = o.parent; q; q = q.parent) if (q === top) return true; return false; }
  function matKey(mt) { return [mt.type, mt.map ? mt.map.uuid : '', mt.emissive ? mt.emissive.getHex() : '', mt.emissiveIntensity, mt.side, mt.flatShading, mt.roughness, mt.metalness, mt.envMap ? mt.envMap.uuid : '', mt.gradientMap ? mt.gradientMap.uuid : '', mt.depthWrite, mt.alphaTest, mt.fog].join('|'); }
  function stillUsed(mt, merged) { let used = false; m.root.traverse(o => { if (o.material === mt && merged.indexOf(o) < 0) used = true; }); return used; }
  function okMat(mt) { return mt && !Array.isArray(mt) && !mt.transparent && mt.blending === 1 && !mt.isShaderMaterial && !mt.vertexColors; }
};
R.buildDecor = function (room, theme, wallTops, doorXs) {
  const THREE = T3(), rnd = R.drand, b = room.bounds;
  const depth = Math.max(1, H.DEPTHS.indexOf(theme));
  const buckets = {};
  const mats = {
    stone: () => R.std(new THREE.Color(theme.stone).multiplyScalar(1.6).getHex(), { roughness: 0.95 }),
    bone: () => R.std(0xd9cfb8, { roughness: 0.8 }),
    iron: () => R.std(0x3a363e, { roughness: 0.5, metalness: 0.4 }),
    clay: () => R.std(0x8a4a2c, { roughness: 0.9 }),
    slag: () => R.std(0x241c1a, { roughness: 1 }),
    cloth: () => R.std(new THREE.Color(theme.rune).multiplyScalar(0.45).getHex(), { roughness: 1, side: THREE.DoubleSide }),
    glow: () => R.basic(theme.rune, { toneMapped: false }),
    ember: () => R.basic(theme.rune),
    rail: () => R.std(new THREE.Color(theme.stone).lerp(new THREE.Color(0x9aa39e), 0.55).getHex(), { roughness: 0.9 }),
    glowpatch: () => new THREE.MeshBasicMaterial({ map: R.softDisc(), color: theme.rune, transparent: true, opacity: H.settings.look === 'painted' ? 0.16 : 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    patch: () => new THREE.MeshBasicMaterial({ map: R.softDisc(), color: 0x08140c, transparent: true, opacity: 0.7, depthWrite: false })
  };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const put = (key, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    (buckets[key] || (buckets[key] = [])).push({ geo, mx: _m.clone() });
  };
  const nearDoor = x => doorXs.some(dx => Math.abs(dx - x) < 2.6);
  // ---- pieces ----
  const skull = (x, y, z, ry) => { put('bone', new THREE.SphereGeometry(0.14, 7, 5), x, y + 0.12, z, 0, ry, 0, 1, 0.9, 1.1); put('slag', new THREE.BoxGeometry(0.05, 0.05, 0.03), x + Math.cos(ry) * 0.05, y + 0.14, z - 0.13, 0, ry); put('slag', new THREE.BoxGeometry(0.05, 0.05, 0.03), x - Math.cos(ry) * 0.05, y + 0.14, z - 0.13, 0, ry); };
  const boneBit = (x, z) => put('bone', new THREE.CylinderGeometry(0.03, 0.035, 0.3 + rnd() * 0.25, 5), x, 0.035, z, Math.PI / 2, rnd() * 6.28, 0);
  const chain = (x, z, y0, len, ry) => { const n = Math.round(len / 0.11); for (let k = 0; k < n; k++) put('iron', new THREE.TorusGeometry(0.055, 0.017, 4, 8), x, y0 - k * 0.11, z, 0, ry + (k % 2 ? Math.PI / 2 : 0), 0, 1, 1.35, 1); put('iron', new THREE.TorusGeometry(0.13, 0.025, 4, 10), x, y0 - n * 0.11 - 0.1, z, 0, ry, 0); };
  const rock = (key, x, y, z, s) => put(key, new THREE.DodecahedronGeometry(s, 0), x, y + s * 0.6, z, rnd() * 3, rnd() * 3, rnd() * 3, 1, 0.7 + rnd() * 0.4, 1);
  const jar = (x, y, z, s) => { const pts = [[0, 0], [0.16, 0.02], [0.22, 0.2], [0.19, 0.38], [0.09, 0.46], [0.1, 0.52]].map(([a, c]) => new THREE.Vector2(a * s, c * s)); put('clay', new THREE.LatheGeometry(pts, 8), x, y, z); };
  const patch = (x, z, r, key = 'patch') => { const g = new THREE.CircleGeometry(r, 9); const pa = g.attributes.position; for (let k = 1; k < pa.count; k++) { const f = 0.7 + rnd() * 0.5; pa.setXY(k, pa.getX(k) * f, pa.getY(k) * f); } put(key, g, x, key === 'glowpatch' ? 0.009 : 0.006, z, -Math.PI / 2, 0, rnd() * 6.28); };
  const crystal = (x, y, z) => { for (let k = 0; k < 3 + (rnd() * 3 | 0); k++) put('glow', new THREE.ConeGeometry(0.07 + rnd() * 0.06, 0.4 + rnd() * 0.6, 5), x + (rnd() - .5) * 0.5, y + 0.2, z + (rnd() - .5) * 0.5, (rnd() - .5) * 0.7, 0, (rnd() - .5) * 0.7); };
  const bust = (x, y, z, ry, fallen) => { put('stone', new THREE.BoxGeometry(0.5, 0.35, 0.5), x, y + 0.17, z, 0, ry); if (fallen) { put('stone', new THREE.BoxGeometry(0.45, 0.6, 0.3), x + 0.5, y + 0.15, z, 0, ry, Math.PI / 2); put('stone', new THREE.SphereGeometry(0.2, 7, 5), x + 0.9, y + 0.2, z + 0.3); } else { put('stone', new THREE.BoxGeometry(0.45, 0.6, 0.3), x, y + 0.65, z, 0, ry); put('stone', new THREE.SphereGeometry(0.2, 7, 5), x, y + 1.1, z); } };
  const banner = (x, z, ry, top) => { const g = new THREE.PlaneGeometry(0.9, 2.0, 1, 4); const pa = g.attributes.position; for (let k = 0; k < pa.count; k++) if (pa.getY(k) < -0.9) pa.setY(k, pa.getY(k) + rnd() * 0.5); put('cloth', g, x, top - 1.1, z, 0, ry); put('iron', new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), x, top - 0.05, z, 0, ry, Math.PI / 2); };
  const cage = (x, y, z) => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; put('iron', new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4), x + Math.cos(a) * 0.3, y + 0.45, z + Math.sin(a) * 0.3); } put('iron', new THREE.TorusGeometry(0.3, 0.03, 4, 12), x, y + 0.9, z, Math.PI / 2); put('iron', new THREE.TorusGeometry(0.3, 0.03, 4, 12), x, y + 0.02, z, Math.PI / 2); };
  // ---- wall tops ----
  for (const t of wallTops) {
    if (rnd() < 0.45) continue;
    const x = t.x + (rnd() - .5) * t.w * 0.5, z = t.z + (rnd() - .5) * t.d * 0.5, y = t.top;
    const k = rnd();
    if (depth === 1) { if (k < 0.5) { const n = 2 + (rnd() * 4 | 0); for (let i = 0; i < n; i++) skull(x + (rnd() - .5) * 0.8, y, z + (rnd() - .5) * 0.8, rnd() * 6.28); } else if (k < 0.75) cage(x, y, z); else rock('stone', x, y, z, 0.3); }
    else if (depth === 2) { if (k < 0.45) { for (let i = 0; i < 3; i++) rock('slag', x + (rnd() - .5) * 0.9, y, z + (rnd() - .5) * 0.9, 0.18 + rnd() * 0.2); for (let i = 0; i < 4; i++) put('ember', new THREE.BoxGeometry(0.08, 0.08, 0.08), x + (rnd() - .5) * 0.8, y + 0.12, z + (rnd() - .5) * 0.8, rnd() * 3, rnd() * 3); } else jar(x, y, z, 0.9 + rnd() * 0.6); }
    else { if (k < 0.45) bust(x, y, z, rnd() * 6.28, rnd() < 0.4); else if (k < 0.8) crystal(x, y, z); else rock('stone', x, y, z, 0.3); }
  }
  // ---- wall faces (north and west) ----
  const faces = (room._faces || []).filter(f => !nearDoor(f.x) || f.ry);
  for (const f of faces) {
    if (rnd() < 0.6) continue;
    if (depth === 1) chain(f.x, f.z, 2.6, 0.8 + rnd() * 0.9, f.ry);
    else if (depth === 3) banner(f.x, f.z, f.ry, 2.9);
    else put('ember', new THREE.BoxGeometry(0.5, 0.06, 0.04), f.x, 0.9 + rnd() * 1.2, f.z, 0, f.ry, (rnd() - .5) * 0.6);   // glowing cracks in the kiln brick
  }
  // ---- flat scatter by the walls (inside a 1.2 m band, never higher than a few centimetres) ----
  const band = () => { const side = rnd() * 4 | 0, u = rnd(); const d = 0.3 + rnd() * 0.9;
    if (side === 0) return [b.minX + 1 + u * (b.maxX - b.minX - 2), b.minZ + d]; if (side === 1) return [b.minX + d, b.minZ + 1 + u * (b.maxZ - b.minZ - 2)];
    if (side === 2) return [b.maxX - d, b.minZ + 1 + u * (b.maxZ - b.minZ - 2)]; return [b.minX + 1 + u * (b.maxX - b.minX - 2), b.maxZ - d]; };
  const clearOf = (x, z) => H.G.inRoom(x, z, 0.3, room) && !room.pits.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 0.8) && !room.doors.some(d => Math.abs(d.x - x) < 2) && !(room.prop && Math.hypot(room.prop.x - x, room.prop.z - z) < 2.5);
  for (let i = 0; i < 14; i++) { const [x, z] = band(); if (!clearOf(x, z)) continue; if (depth === 1 && i % 2) boneBit(x, z); else patch(x, z, 0.4 + rnd() * 0.7); }
  // glowing moss and slime across the floor: a dark stain with a faint glow of the depth's colour on top
  for (let i = 0; i < 12; i++) { const x = b.minX + 1 + rnd() * (b.maxX - b.minX - 2), z = b.minZ + 1 + rnd() * (b.maxZ - b.minZ - 2); if (!clearOf(x, z)) continue; const r = 0.5 + rnd() * 1.1; patch(x, z, r * 1.15); patch(x, z, r, 'glowpatch'); }
  // ---- carved floor panels (greek-key border), flat, in open floor ----
  const freeFor = (x, z, half) => H.G.inRoom(x, z, half + 1, room) && !room.pits.some(p => Math.hypot(p.x - x, p.z - z) < p.r + half * 1.5) && !room.pillars.some(p => Math.hypot(p.x - x, p.z - z) < p.r + half * 1.5) && !room.doors.some(d => Math.abs(d.x - x) < 2.5 && Math.abs(b.minZ - z) < 3.5) && !(room.prop && Math.hypot(room.prop.x - x, room.prop.z - z) < 3);
  const panels = []; const tries = [[(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2]];
  for (let k = 0; k < 10; k++) tries.push([b.minX + 3 + rnd() * (b.maxX - b.minX - 6), b.minZ + 3 + rnd() * (b.maxZ - b.minZ - 6)]);
  for (const [x, z] of tries) { if (panels.length >= 2) break; const sx = Math.round(x), sz = Math.round(z); if (freeFor(sx, sz, 1.4) && panels.every(([px, pz]) => Math.hypot(px - sx, pz - sz) > 5)) panels.push([sx, sz]); }
  if (panels.length) {
    const pm = R.mat('panel_' + theme.light, () => new THREE.MeshStandardMaterial({ map: R.panelTexture(), color: new THREE.Color(0xffffff).lerp(new THREE.Color(theme.light), 0.15).multiplyScalar(0.85), roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const geos = panels.map(([x, z]) => { const g2 = new THREE.PlaneGeometry(2.8, 2.8); g2.rotateX(-Math.PI / 2); g2.translate(x, 0.018, z); return { geo: g2, mx: new THREE.Matrix4() }; });
    const pmesh = new THREE.Mesh(R.mergeGeos(geos), pm); pmesh.receiveShadow = true; pmesh.userData.panels = panels.length; R.chamber.add(pmesh);
  }
  // ---- balustrades on the low south edge, and on the east edge where the isometric view cuts the wall ----
  const rail = (key, x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.6)), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; put(key, new THREE.CylinderGeometry(0.06, 0.085, 0.62, 6), x, 0.2 + 0.33, z); put(key, new THREE.BoxGeometry(0.2, 0.08, 0.2), x, 0.24, z); }
    put(key, new THREE.BoxGeometry(0.24, 0.12, len + 0.2), (x0 + x1) / 2, 0.2 + 0.7, (z0 + z1) / 2, 0, ry);
    for (const t of [0, 1]) put(key, new THREE.BoxGeometry(0.34, 0.95, 0.34), x0 + (x1 - x0) * t, 0.2 + 0.45, z0 + (z1 - z0) * t);
  };
  rail('rail', b.minX - 1.6, b.maxZ + 0.5, b.maxX + 1.6, b.maxZ + 0.5);
  rail('eastRail', b.maxX + 0.5, b.minZ - 1.6, b.maxX + 0.5, b.maxZ + 0.5);
  // ---- one mesh per material ----
  const g = new THREE.Group(); g.userData.decor = true;
  for (const [key, list] of Object.entries(buckets)) {
    const mesh = new THREE.Mesh(R.mergeGeos(list), mats[key === 'eastRail' ? 'rail' : key]());
    if (key === 'eastRail') { mesh.castShadow = true; mesh.receiveShadow = true; R.toonify(mesh, null, { outline: false }); mesh.userData.eastRail = true; R.chamber.add(mesh); continue; } mesh.castShadow = key !== 'patch' && key !== 'glow' && key !== 'ember'; mesh.receiveShadow = key !== 'patch';
    if (key === 'patch' || key === 'glowpatch') { mesh.renderOrder = -1; mesh.castShadow = mesh.receiveShadow = false; }
    g.add(mesh);
  }
  R.toonify(g, null, { outline: false });
  R.chamber.add(g); R.decor = g;
};
R.updateChamber = function (dt) {
  const t = R.t;
  if (R.brazier) R.brazier.tick(dt, t);   // the braziers' fire, light and fragments (js/brazier.js)
  for (const d of R.doorObjs || []) {
    const target = d.d.open ? 1 : 0; d.open = target > d.open ? Math.min(1, d.open + dt * 0.9) : Math.max(0, d.open - dt * 1.5);
    d.portalMat.uniforms.uTime.value = t; d.portalMat.uniforms.uOpen.value = d.open;
    const sw = d.open < 0.5 ? 2 * d.open * d.open : 1 - Math.pow(-2 * d.open + 2, 2) / 2;
    for (const L of d.leaves) L.rotation.y = L.userData.side * sw * 1.85;
    if (d.d.open && !d.dust) { d.dust = true; R.burst(d.d.x, 0.3, d.d.z + 0.6, 0x8a8078, 26, 2.5, 0.9, 0.5, { flat: true }); R.shake(0.08); }
    if (!d.d.open) d.dust = false;
    d.icon.position.y = 5.9 + Math.sin(t * 2 + d.d.x) * 0.15;
    d.icon.material.opacity = 0.45 + d.open * 0.55;
    if (d.open > 0.5 && Math.random() < dt * 10) R.emit(d.d.x + (Math.random() - .5) * 2, 0.2, d.d.z + 0.4, 0, 1.5, 0.3, 1, 0.25, 0, new (T3().Color)(H.NODES[d.d.type].css).getHex(), 0.8, -0.3, 1);
  }
  for (const p of R.props || []) {
    if (p.spin) p.spin.rotation.y += dt * (p.kind === 'descent' ? 0 : 1.2), p.kind === 'descent' && (p.spin.rotation.z += dt * 0.6);
    if (p.fire && Math.random() < dt * 30 && !p.used) R.emit(p.x + (Math.random() - .5) * .8, 0.4, p.z + (Math.random() - .5) * .8, 0, 2 + Math.random() * 2, 0, 0.8, 0.5, 0.05, H.pick([0xff9a52, 0xffd27a, 0xff5a1f]), 1, -1, 1.5);
    if (p.column && Math.random() < dt * 40) { const a = Math.random() * 7; R.emit(p.x + Math.cos(a) * 2, 0.1, p.z + Math.sin(a) * 2, 0, 3 + Math.random() * 3, 0, 1.2, 0.3, 0, 0xffd27a, 1, 0, 0.5); }
    if (p.pupil && H.G && H.G.players && H.G.players[0]) { const pl = H.G.players[0]; const [dx, dz] = H.norm(pl.x - p.x, pl.z - p.z); p.pupil.position.x = dx * 0.4; p.pupil.position.y = 2.1 - dz * 0.2; }
    if (p.glow) p.glow.material.opacity = p.used ? 0.12 : 0.4 + Math.sin(R.t * 3) * 0.1;
    if (p.npc) { p.npc.position.y = Math.sin(R.t * 1.6) * 0.04; p.npc.rotation.y = Math.sin(R.t * 0.5) * 0.12; }
    if (p.lantern) { const f = 0.85 + Math.sin(R.t * 11) * 0.08 + Math.sin(R.t * 27) * 0.05; p.lantern.scale.set(2.2 * f, 2.2 * f, 1); }
    if (p.wares) p.wares.forEach((w, i) => { const sold = p.stock && p.stock[i] && p.stock[i].sold; w.visible = !sold; w.rotation.y += dt * 1.5; w.position.y = 0.48 + Math.sin(R.t * 2 + i) * 0.06; });
  }
  for (const v of (H.G && H.G.room && H.G.room.vents) || []) { if (v.mesh) { v.mesh.material.opacity = v.state === 'warn' ? 0.5 + Math.sin(R.t * 30) * 0.4 : v.state === 'fire' ? 1 : 0.25; v.mesh.material.color.setHex(v.state === 'fire' ? 0xffd27a : 0xff5a1f); } }
};

/* ---------------- Models ---------------- */
function part(geo, mat, x, y, z, parent) { const m = new (T3().Mesh)(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (parent) parent.add(m); return m; }
/* The Wanderer: stylized hooded spell-rogue. Long A-line cloak with a lowered hood and brooch,
   crossed-wrap tunic, wide belt with a hanging strap, wrapped bracers and chunky strapped boots. */
R.makeRogue = function (accent, cloakColor) {
  const THREE = T3();
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const cloth = R.std(cloakColor || 0x34303b, { roughness: 0.95, side: THREE.DoubleSide });
  const tunicM = R.std(0x55505c, { roughness: 0.9 });
  const tunicD = R.std(0x423d48, { roughness: 0.9 });
  const pantsM = R.std(0x2b2830, { roughness: 0.9 });
  const leather = R.std(0x5e4130, { roughness: 0.7 });
  const leatherD = R.std(0x46301f, { roughness: 0.75 });
  const metal = R.std(accent, { emissive: accent, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.7 });
  const skin = R.std(0xd9a984, { roughness: 0.75, flatShading: false });
  const hairM = R.std(0x2c180c, { roughness: 0.95, flatShading: false });
  // Percy's base look: bare limbs and feet, a single ragged brown tunic tied with rope.
  const tunicB = R.std(0x6b4a2e, { roughness: 1, flatShading: false });       // worn brown
  const tunicP = R.std(0x55391f, { roughness: 1, flatShading: false });       // darker patches
  const rope = R.std(0xb79a6a, { roughness: 1, flatShading: false });
  const skinD = R.std(0xc99a76, { roughness: 0.8, flatShading: false });
  const legs = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.11, 0.66, 0); body.add(piv);
    part(new THREE.CylinderGeometry(0.075, 0.064, 0.32, 14), skin, 0, -0.16, 0, piv);
    part(new THREE.CylinderGeometry(0.063, 0.048, 0.34, 14), skin, 0, -0.43, 0, piv);
    part(new THREE.SphereGeometry(0.062, 12, 8), skin, 0, -0.29, -0.01, piv);                  // knee
    const foot = part(new THREE.SphereGeometry(0.075, 12, 8), skinD, 0, -0.63, -0.08, piv); foot.scale.set(0.85, 0.5, 1.75); piv.userData.boot = foot;
    part(new THREE.SphereGeometry(0.05, 10, 6), skinD, 0, -0.6, 0.02, piv); // heel
    legs.push(piv);
  }
  // ragged tunic: a skirt whose hem is torn into uneven tatters
  const skirtGeo = new THREE.CylinderGeometry(0.235, 0.34, 0.7, 40, 6, true);
  { const a = skirtGeo.attributes.position.array; for (let i2 = 0; i2 < a.length; i2 += 3) { if (a[i2 + 1] < -0.3) { const ang = Math.atan2(a[i2], a[i2 + 2]); a[i2 + 1] -= 0.04 + 0.09 * Math.abs(Math.sin(ang * 5.3)) + 0.05 * Math.abs(Math.sin(ang * 13.1)); } { const ang = Math.atan2(a[i2], a[i2 + 2]); const fold = 1 + 0.045 * Math.sin(ang * 9) * (0.35 - a[i2 + 1]); a[i2] *= fold; a[i2 + 2] *= fold; } } skirtGeo.computeVertexNormals(); }
  const skirtM = R.std(0x6b4a2e, { roughness: 1, side: THREE.DoubleSide, flatShading: false });
  part(skirtGeo, skirtM, 0, 0.74, 0, body);
  { const tg = new THREE.CylinderGeometry(0.25, 0.215, 0.56, 32, 6); const a = tg.attributes.position.array; for (let i2 = 0; i2 < a.length; i2 += 3) { const ang = Math.atan2(a[i2], a[i2 + 2]); const f = 1 + 0.03 * Math.sin(ang * 7 + a[i2 + 1] * 9); a[i2] *= f; a[i2 + 2] *= f * 0.88; if (a[i2 + 1] > 0.2) { a[i2] *= 0.92; } } tg.computeVertexNormals(); part(tg, tunicB, 0, 1.31, 0, body); }
  for (const sx of [-1, 1]) part(new THREE.SphereGeometry(0.11, 16, 10), tunicB, sx * 0.24, 1.52, 0, body).scale.set(1, 0.75, 0.9); // shoulders
  // rough neckline, patches and stitches
  const neck = part(new THREE.TorusGeometry(0.12, 0.028, 8, 20), tunicP, 0, 1.585, -0.01, body); neck.rotation.x = Math.PI / 2;
  part(new THREE.BoxGeometry(0.12, 0.12, 0.02), tunicP, -0.1, 1.25, -0.24, body).rotation.z = 0.2;
  part(new THREE.BoxGeometry(0.1, 0.09, 0.02), tunicP, 0.14, 0.72, -0.31, body).rotation.z = -0.3;
  part(new THREE.BoxGeometry(0.11, 0.1, 0.02), tunicP, 0.08, 1.38, 0.24, body).rotation.z = 0.4;
  const tear = part(new THREE.BoxGeometry(0.035, 0.16, 0.02), R.basic(0x2a1a0e), -0.13, 0.55, -0.31, body); tear.rotation.z = 0.15;
  // rope belt with a dangling knot
  part(new THREE.TorusGeometry(0.228, 0.02, 8, 32), rope, 0, 1.06, 0, body).rotation.x = Math.PI / 2;
  const strap = part(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), rope, 0.09, 0.9, -0.24, body);
  part(new THREE.SphereGeometry(0.035, 10, 8), rope, 0.09, 0.75, -0.24, body);
  // head: oversized and simplified
  const head = new THREE.Group(); head.position.set(0, 1.8, 0); body.add(head);
  part(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 14), skin, 0, -0.2, 0, head);                                  // neck
  const skull = part(new THREE.SphereGeometry(0.22, 24, 18), skin, 0, 0, 0, head); skull.scale.set(0.95, 1.08, 1.0);
  for (const sx of [-1, 1]) part(new THREE.SphereGeometry(0.045, 10, 8), skin, sx * 0.205, 0, 0.02, head).scale.set(0.5, 1, 0.8); // ears
  const nose = part(new THREE.SphereGeometry(0.04, 12, 8), skinD, 0, -0.01, -0.215, head); nose.scale.set(0.85, 1.1, 1.1);
  // eyes: white, iris, highlight
  const white = R.std(0xf2ece0, { roughness: 0.4, flatShading: false }), irisM = R.basic(0x3a2a1a), shine = R.basic(0xffffff);
  const eyeL = new THREE.Group(), eyeR = new THREE.Group();
  [[eyeL, -1], [eyeR, 1]].forEach(([g, sx]) => { g.position.set(sx * 0.075, 0.035, -0.19); head.add(g); const w = part(new THREE.SphereGeometry(0.034, 14, 10), white, 0, 0, 0, g); w.scale.set(1.2, 0.9, 0.6); part(new THREE.SphereGeometry(0.019, 12, 8), irisM, 0, 0, -0.018, g); part(new THREE.SphereGeometry(0.006, 6, 4), shine, 0.007, 0.008, -0.034, g); });
  const e1 = eyeL, e2 = eyeR;
  for (const sx of [-1, 1]) { const b = part(new THREE.BoxGeometry(0.075, 0.016, 0.02), hairM, sx * 0.075, 0.085, -0.2, head); b.rotation.z = sx * -0.15; }
  // hair: a tousled cap plus a few locks
  const hair = part(new THREE.SphereGeometry(0.232, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0, 0.025, 0.015, head); hair.scale.set(1, 1.15, 1.05); hair.rotation.x = 0.25;
  part(new THREE.SphereGeometry(0.2, 18, 12), hairM, 0, -0.02, 0.08, head).scale.set(1.05, 1.0, 0.9);
  for (let k = 0; k < 4; k++) { const lock = part(new THREE.ConeGeometry(0.045, 0.13, 8), hairM, -0.1 + k * 0.066, 0.13, -0.17, head); lock.rotation.set(-2.6, 0, (k - 1.5) * 0.25); }
  // beard and moustache
  const beardGeo = new THREE.SphereGeometry(0.17, 20, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
  { const a = beardGeo.attributes.position.array; for (let i2 = 0; i2 < a.length; i2 += 3) { if (a[i2 + 2] < 0) a[i2 + 1] -= 0.06 * Math.max(0, -a[i2 + 1] / 0.17); } beardGeo.computeVertexNormals(); }
  const beard = part(beardGeo, hairM, 0, -0.045, -0.045, head); beard.scale.set(1.12, 1.25, 1.05);
  const chin = part(new THREE.SphereGeometry(0.09, 14, 10), hairM, 0, -0.2, -0.13, head); chin.scale.set(1.1, 1.1, 0.8);
  for (const sx of [-1, 1]) { const mo = part(new THREE.SphereGeometry(0.035, 10, 6), hairM, sx * 0.035, -0.06, -0.205, head); mo.scale.set(1.5, 0.5, 0.7); mo.rotation.z = sx * 0.3; }
  const mouth = part(new THREE.BoxGeometry(0.05, 0.01, 0.01), R.basic(0x3a1e14), 0, -0.095, -0.205, head);
  // lowered hood: a heavy cowl resting on the shoulders, peaking behind the head
  const hood = part(new THREE.SphereGeometry(0.36, 9, 6, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.5), cloth, 0, 1.6, 0.14, body);
  hood.scale.set(0.85, 0.8, 0.9); hood.rotation.x = 0.5;
  const peak = part(new THREE.ConeGeometry(0.12, 0.28, 5), cloth, 0, 1.5, 0.42, body); peak.rotation.x = 2.75;
  hood.visible = false; peak.visible = false;
  // mantle with brooch, then the long A-line cloak (open at the front)
  const mantle = part(new THREE.CylinderGeometry(0.26, 0.46, 0.4, 14, 1, true, Math.PI + 0.36, Math.PI * 2 - 0.72), cloth, 0, 1.44, 0.01, body);
  const brooch = new THREE.Group(); brooch.position.set(0, 1.52, -0.27); body.add(brooch);
  part(new THREE.TorusGeometry(0.075, 0.022, 5, 12), metal, 0, 0, 0, brooch);
  part(new THREE.CircleGeometry(0.06, 8), metal, 0, 0, -0.01, brooch).rotation.y = Math.PI;
  const bGlow = R.glowSprite(accent, 0.35); brooch.add(bGlow);
  mantle.visible = false; brooch.visible = false;
  // cape hangs from the shoulders down the back: a curved sheet with pleats, not a cone around the body
  const cloakGeo = new THREE.CylinderGeometry(0.27, 0.5, 1.5, 28, 10, true, -1.62, 3.24);
  { const a = cloakGeo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      const y = a[i + 1], h = (0.75 - y) / 1.5, ang = Math.atan2(a[i], a[i + 2]);
      const pleat = 1 + 0.09 * Math.sin(ang * 7) * h;
      a[i] *= pleat * (0.92 - 0.1 * h); a[i + 2] = a[i + 2] * pleat * 0.75 + 0.05 + h * 0.2;
      a[i + 1] = y - Math.abs(Math.sin(ang)) * h * 0.08;
    } cloakGeo.computeVertexNormals(); }
  const capeMat = new THREE.MeshStandardMaterial({ color: cloakColor || 0x34303b, roughness: 0.95, side: THREE.DoubleSide });
  const cloak = part(cloakGeo, capeMat, 0, 0.87, 0.02, body); cloak.visible = false;
  const base = cloakGeo.attributes.position.array.slice();
  // arms on shoulder pivots, aimed at the floating spell hands each frame
  const handMat = new THREE.MeshBasicMaterial({ color: accent });
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.29, 1.5, 0); body.add(piv);
    const sleeve = part(new THREE.CylinderGeometry(0.05, 0.062, 1, 14), skin, 0, -0.5, 0, piv);
    { const sg = new THREE.CylinderGeometry(0.085, 0.105, 0.26, 20, 2, true); const a = sg.attributes.position.array; for (let i2 = 0; i2 < a.length; i2 += 3) if (a[i2 + 1] < 0) a[i2 + 1] -= 0.04 * Math.abs(Math.sin(Math.atan2(a[i2], a[i2 + 2]) * 3)); sg.computeVertexNormals(); part(sg, skirtM, 0, -0.1, 0, piv); }
    const bracer = part(new THREE.CylinderGeometry(0.055, 0.05, 0.2, 14), skin, 0, -0.84, 0, piv);
    const wrap = part(new THREE.TorusGeometry(0.06, 0.012, 3, 8), skinD, 0, -0.84, 0, piv); wrap.rotation.x = Math.PI / 2 + 0.4; wrap.visible = false;
    arms.push({ piv, sleeve, bracer, wrap, s });
  }
  const hL = part(new THREE.SphereGeometry(0.08, 14, 10), handMat, -0.4, 1.05, -0.2, body);
  const hR = part(new THREE.SphereGeometry(0.08, 14, 10), handMat.clone(), 0.4, 1.05, -0.2, body);
  const gL = R.glowSprite(accent, 0.7); hL.add(gL); const gR = R.glowSprite(accent, 0.7); hR.add(gR);
  const aL = R.glowSprite(accent, 0.8, R.texStar); aL.material.opacity = 0.32; hL.add(aL); const aR = R.glowSprite(accent, 0.8, R.texStar); aR.material.opacity = 0.32; hR.add(aR);
  // floating grimoire
  const book = new THREE.Group(); part(new THREE.BoxGeometry(0.42, 0.08, 0.32), R.std(0x4a2230), 0, 0, 0, book); part(new THREE.BoxGeometry(0.38, 0.1, 0.28), R.std(0xe8dcc0), 0.02, 0, 0, book); part(new THREE.BoxGeometry(0.06, 0.1, 0.1), metal, 0.21, 0, 0, book);
  book.position.set(0.55, 1.95, 0.35); root.add(book); book.visible = false;
  // sigil, shadow, light, defensive shells
  const sig = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: R.texRune, color: accent, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  sig.rotation.x = -Math.PI / 2; sig.position.y = 0.05; root.add(sig);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; root.add(shadow);
  const light = new THREE.PointLight(accent, 1.6, 10, 2); light.position.set(0, 2.3, 0); root.add(light);
  const ward = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3aa8d8, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, flatShading: true, depthWrite: false }));
  ward.position.y = 1.0; ward.visible = false; root.add(ward);
  const bastion = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), new THREE.MeshStandardMaterial({ color: 0xd99b5f, emissive: 0x6a3a10, emissiveIntensity: 0.5, transparent: true, opacity: 0.5, flatShading: true, depthWrite: false }));
  bastion.position.y = 1.0; bastion.visible = false; root.add(bastion);
  const mirror = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 4, 32), new THREE.MeshBasicMaterial({ color: 0xbb80ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })); mirror.rotation.x = Math.PI / 2; mirror.position.y = 1; mirror.visible = false; root.add(mirror);
  R.ents.add(root);
  hL.userData.bare = []; hR.userData.bare = [];
  return { rig: { torsoR: 0.25, shoulderX: 0.29, shoulderY: 1.5, waistY: 1.06 }, hideWithHelm: head.children.slice(1), peak, tunicMat: tunicB, capeMat, cloakBase: cloakColor || 0x34303b, root, body, cloak, cloakGeo, base, aL, aR, auraCol: accent, mantle, hood, head, legs, arms, strap, brooch, bGlow, hL, hR, gL, gR, book, sig, light, ward, bastion, mirror, accent, eyes: [e1, e2], cloth: tunicB, castT: 0, castSide: 1, t: Math.random() * 10, walk: 0, lvx: 0, lvz: 0 };
};
/* ================= The Veteran (knight) =================
   Same rig contract as R.makeRogue (root/body/legs/arms/hands/cloak/sig/ward…) so R.animateRogue,
   R.setRogueElement and the combat code drive it unchanged. Visual pieces live under m.look,
   grouped by region (helm, torso, pauldrons, belt+tabard, arms, legs) for easy replacement.
   If public/models/characters/knight.glb is enabled and loaded, it replaces m.look. */
R.knightTextures = function () {
  if (R._kTex) return R._kTex;
  const THREE = T3(); const N = 256;
  const mk = (draw) => { const cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'); draw(c); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const speck = (c, n, cols, rmax) => { for (let i = 0; i < n; i++) { c.fillStyle = cols[(Math.random() * cols.length) | 0]; c.beginPath(); c.arc(Math.random() * N, Math.random() * N, Math.random() * rmax, 0, 7); c.fill(); } };
  // aged steel: grey base, mottling, rust blooms, scratches and dents
  const steel = mk(c => {
    c.fillStyle = '#8a8e93'; c.fillRect(0, 0, N, N);
    speck(c, 900, ['rgba(60,62,66,.25)', 'rgba(150,154,160,.18)', 'rgba(40,40,44,.2)'], 6);
    for (let i = 0; i < 9; i++) { const x = Math.random() * N, y = Math.random() * N, r = 10 + Math.random() * 34; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(122,62,28,.75)'); g.addColorStop(.5, 'rgba(96,52,26,.4)'); g.addColorStop(1, 'rgba(96,52,26,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 40; i++) { c.strokeStyle = Math.random() < .5 ? 'rgba(210,214,220,.45)' : 'rgba(30,30,34,.45)'; c.lineWidth = 0.6 + Math.random(); c.beginPath(); const x = Math.random() * N, y = Math.random() * N, a = Math.random() * 6.3, l = 8 + Math.random() * 40; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    for (let i = 0; i < 6; i++) { const x = Math.random() * N, y = Math.random() * N, r = 6 + Math.random() * 10; const g = c.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(.7, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  const leather = mk(c => { c.fillStyle = '#5a3e28'; c.fillRect(0, 0, N, N); speck(c, 1200, ['rgba(30,18,10,.25)', 'rgba(120,86,56,.18)'], 3); for (let i = 0; i < 25; i++) { c.strokeStyle = 'rgba(28,16,8,.35)'; c.lineWidth = 1; c.beginPath(); const y = Math.random() * N; c.moveTo(0, y); c.bezierCurveTo(N * .3, y + 6, N * .6, y - 6, N, y + Math.random() * 6); c.stroke(); } });
  const cloth = mk(c => { c.fillStyle = '#34302c'; c.fillRect(0, 0, N, N); for (let y = 0; y < N; y += 3) { c.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.08})`; c.fillRect(0, y, N, 1); } for (let x = 0; x < N; x += 3) { c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(x, 0, 1, N); } speck(c, 30, ['rgba(20,16,12,.5)', 'rgba(90,70,50,.25)'], 14); });
  const mail = mk(c => { c.fillStyle = '#3a3c40'; c.fillRect(0, 0, N, N); for (let y = 0; y < N; y += 8) for (let x = (y / 8) % 2 * 4; x < N; x += 8) { c.strokeStyle = 'rgba(150,154,160,.55)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, 3.3, 0, 7); c.stroke(); } });
  mail.repeat.set(3, 3);
  return (R._kTex = { steel, leather, cloth, mail });
};
/* Shared materials for the Veteran's armour set (also used when Percy wears it). */
/* Metal needs something to reflect: without an environment map, metallic surfaces render almost black on many
   GPUs (it looked fine in some browsers and vanished in others). A small painted equirect "room" gives armour and
   blades a consistent sheen in every renderer (main view and the inventory preview). */
R.metalEnv = function () {
  if (R._metalEnv) return R._metalEnv;
  const THREE = T3(); const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#f0e6d4'); g.addColorStop(0.35, '#b8aa96'); g.addColorStop(0.5, '#6e645a'); g.addColorStop(0.75, '#3a332e'); g.addColorStop(1, '#1e1a18'); c.fillStyle = g; c.fillRect(0, 0, 256, 128);
  for (const [x, y, r, a] of [[60, 26, 22, .9], [190, 34, 16, .6], [128, 18, 30, .5]]) { const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,248,232,${a})`); rg.addColorStop(1, 'rgba(255,248,232,0)'); c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
  return (R._metalEnv = t);
};
R.metalize = function (m, k = 1) { if (!m || !m.isMeshStandardMaterial) return m; m.envMap = R.metalEnv(); m.envMapIntensity = k; m.needsUpdate = true; return m; };
R.vetMats = function () {
  if (R._vetM) return R._vetM;
  const THREE = T3(); const TX = R.knightTextures();
  const M = {
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9fa6, map: TX.steel, roughness: 0.58, metalness: 0.28, flatShading: true }),
    steelD: new THREE.MeshStandardMaterial({ color: 0x70747a, map: TX.steel, roughness: 0.65, metalness: 0.25, flatShading: true }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.7, metalness: 0.25, flatShading: true }),
    leather: new THREE.MeshStandardMaterial({ color: 0x8a6a50, map: TX.leather, roughness: 0.9, metalness: 0, flatShading: true }),
    leatherD: new THREE.MeshStandardMaterial({ color: 0x5c4434, map: TX.leather, roughness: 0.92, metalness: 0, flatShading: true }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x8a8078, map: TX.cloth, roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true }),
    mail: new THREE.MeshStandardMaterial({ color: 0xb0b4ba, map: TX.mail, roughness: 0.6, metalness: 0.25, flatShading: true }),
    black: new THREE.MeshBasicMaterial({ color: 0x050506 })
  };
  for (const k of ['steel', 'steelD', 'iron', 'mail']) R.metalize(M[k], 1.1); for (const k of ['leather', 'leatherD', 'cloth']) R.metalize(M[k], 0.35);
  for (const k in M) M[k].shared = true;
  return (R._vetM = M);
};
/* The Veteran's armour, one builder per equipment slot. Each attaches to the rig's anchors
   (m.head, m.body, m.legs, m.arms, hands) using the rig's measurements (m.rig), so it fits both
   the Veteran and Percy. Returns the created objects so R.dressRogue can remove them later. */
R.vetArmor = {
  head(m) {
    const THREE = T3(), M = R.vetMats(), out = [], h = m.head;
    const add = (geo, mat, x, y, z) => { const o = part(geo, mat, x, y, z, h); out.push(o); return o; };
    add(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 7), M.mail, 0, -0.2, 0);
    add(new THREE.CylinderGeometry(0.215, 0.23, 0.42, 8), M.steel, 0, 0.0, 0);
    const dome = add(new THREE.SphereGeometry(0.215, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, 0, 0.21, 0); dome.scale.y = 0.45;
    add(new THREE.BoxGeometry(0.03, 0.44, 0.06), M.steelD, 0, 0.05, -0.21);
    add(new THREE.BoxGeometry(0.35, 0.035, 0.05), M.black, 0, 0.06, -0.215);
    add(new THREE.BoxGeometry(0.37, 0.022, 0.03), M.steelD, 0, 0.09, -0.22);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.015, 0.05, 0.03), M.black, (k - 1) * 0.045 + 0.08, -0.07 - r * 0.07, -0.22);
    add(new THREE.TorusGeometry(0.22, 0.014, 4, 10), M.steelD, 0, -0.18, 0).rotation.x = Math.PI / 2;
    (m.hideWithHelm || []).forEach(o => { o.visible = false; });
    return out;
  },
  chest(m) {
    const THREE = T3(), M = R.vetMats(), out = [], b = m.body, r = m.rig;
    const add = (geo, mat, x, y, z, par) => { const o = part(geo, mat, x, y, z, par || b); out.push(o); return o; };
    const k = r.torsoR / 0.3, cy = r.shoulderY - 0.37;
    const chest = add(new THREE.SphereGeometry(0.33 * k, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.62), M.steel, 0, cy, 0); chest.scale.set(1.0, 1.25, 0.82);
    const upper = add(new THREE.CylinderGeometry(0.33 * k, 0.315 * k, 0.48, 8), M.steel, 0, cy + 0.2, 0); upper.scale.z = 0.9; upper.rotation.y = Math.PI / 8;
    add(new THREE.BoxGeometry(0.035, 0.46, 0.04), M.steelD, 0, cy + 0.2, -0.3 * k);
    for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry((0.29 + i * 0.015) * k, (0.31 + i * 0.02) * k, 0.09, 9, 1, true), M.steelD, 0, cy - 0.15 - i * 0.075, 0);
    add(new THREE.CylinderGeometry(0.15, 0.24 * k, 0.12, 9), M.steelD, 0, r.shoulderY + 0.08, 0);
    const sx = r.shoulderX;
    for (let i = 0; i < 3; i++) { const l = add(new THREE.SphereGeometry(0.2 - i * 0.025, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), i ? M.steelD : M.steel, -sx, r.shoulderY + 0.06 - i * 0.09, 0); l.scale.set(1.25, 0.7, 1.15); l.rotation.z = 0.35 + i * 0.08; }
    add(new THREE.BoxGeometry(0.05, 0.12, 0.2), M.steel, -sx + 0.12, r.shoulderY + 0.14, 0).rotation.z = 0.2;
    const rp = add(new THREE.SphereGeometry(0.155, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), M.steelD, sx - 0.01, r.shoulderY + 0.03, 0); rp.scale.set(1.1, 0.75, 1.05); rp.rotation.z = -0.35;
    add(new THREE.BoxGeometry(0.1, 0.03, 0.1), M.leatherD, sx - 0.09, r.shoulderY + 0.08, -0.1);
    // mail sleeves (scale with the arm), steel vambraces and gauntlets
    for (const a of m.arms) {
      out.push(part(new THREE.CylinderGeometry(0.08, 0.09, 1, 7), M.mail, 0, 0, 0, a.sleeve));
      out.push(part(new THREE.CylinderGeometry(0.09, 0.08, 0.22, 7), M.steel, 0, 0, 0, a.bracer));
    }
    for (const [hd, s] of [[m.hL, -1], [m.hR, 1]]) {
      const g = part(new THREE.BoxGeometry(0.13, 0.12, 0.15), M.steelD, 0, 0, 0, hd); g.rotation.x = 0.2; out.push(g);
      out.push(part(new THREE.BoxGeometry(0.135, 0.05, 0.06), M.steel, 0, 0.04, -0.08, hd), part(new THREE.BoxGeometry(0.05, 0.05, 0.06), M.steelD, s * -0.07, -0.01, -0.03, hd));
      (hd.userData.bare || []).forEach(o => o.visible = false);
    }
    return out;
  },
  legs(m) {
    const THREE = T3(), M = R.vetMats(), out = [], b = m.body, r = m.rig;
    const add = (geo, mat, x, y, z, par) => { const o = part(geo, mat, x, y, z, par || b); out.push(o); return o; };
    for (const piv of m.legs) {
      add(new THREE.CylinderGeometry(0.1, 0.085, 0.34, 7), M.mail, 0, -0.17, 0, piv);
      const kn = add(new THREE.SphereGeometry(0.085, 7, 5), M.steel, 0, -0.33, -0.04, piv); kn.scale.set(1, 0.9, 0.8);
      add(new THREE.ConeGeometry(0.05, 0.1, 5), M.steelD, 0, -0.33, -0.11, piv).rotation.x = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.085, 0.075, 0.3, 7), M.steel, 0, -0.5, -0.005, piv);
      add(new THREE.BoxGeometry(0.04, 0.26, 0.02), M.steelD, 0, -0.5, -0.08, piv);
    }
    // worn belt, buckle, pouch and the short ragged tabard
    const w = r.waistY, tr = r.torsoR * 1.03;
    add(new THREE.CylinderGeometry(tr, tr, 0.08, 10), M.leatherD, 0, w, 0);
    add(new THREE.BoxGeometry(0.1, 0.09, 0.03), M.iron, 0.05, w, -tr);
    const pouch = add(new THREE.BoxGeometry(0.14, 0.14, 0.08), M.leather, -tr * 0.8, w - 0.07, -tr * 0.6); pouch.rotation.y = 0.5;
    const tabGeo = (ww, hh) => { const g = new THREE.PlaneGeometry(ww, hh, 6, 4); const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 3) if (a[i + 1] < -hh / 2 + 0.01) a[i + 1] += 0.06 * Math.abs(Math.sin(a[i] * 37)) + 0.02; g.translate(0, -hh / 2, 0); return g; };
    const tf = add(tabGeo(0.34, 0.5), M.cloth, 0, w - 0.03, -tr - 0.02); tf.rotation.x = 0.06;
    const tb = add(tabGeo(0.42, 0.55), M.cloth, 0, w - 0.03, tr); tb.rotation.x = -0.08;
    return out;
  },
  feet(m) {
    const THREE = T3(), M = R.vetMats(), out = [];
    for (const piv of m.legs) {
      const add = (geo, mat, x, y, z) => { const o = part(geo, mat, x, y, z, piv); out.push(o); return o; };
      add(new THREE.BoxGeometry(0.17, 0.14, 0.32), M.leatherD, 0, -0.64, -0.06);
      add(new THREE.BoxGeometry(0.18, 0.04, 0.34), M.iron, 0, -0.7, -0.06);
      add(new THREE.BoxGeometry(0.15, 0.06, 0.12), M.steelD, 0, -0.6, -0.17);
      add(new THREE.CylinderGeometry(0.075, 0.08, 0.16, 7), M.leatherD, 0, -0.55, 0);
      if (piv.userData.boot) piv.userData.boot.visible = false; (piv.userData.bare || []).forEach(o => o.visible = false);
    }
    return out;
  }
};
/* The Veteran: a scarred, grey-bearded soldier, wearing only a plain tunic and trousers.
   His armour is a set of items (vet_*) drawn on him by R.dressRogue. */
/* The Veteran: a stylised, chunky armoured knight (after the colour render): steel-teal plate over dark mail,
   gold trims, a red tabard with a brown belt, a great helm with a red crest, brown gloves, gold sabatons, and
   a red kite shield with a gold cross on the left arm. Two-bone arms (shoulder → elbow → hand) and knees. */
R.makeKnight = function (accent) {
  const THREE = T3();
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const look = new THREE.Group(); body.add(look);
  const plate = R.std(0x5f8590, { roughness: 0.55, metalness: 0.15 }), plateD = R.std(0x46666f, { roughness: 0.6, metalness: 0.15 });
  const mail = R.std(0x3c5860, { roughness: 0.8, metalness: 0.1 }), gold = R.std(0xe6ad22, { roughness: 0.45, metalness: 0.2 });
  const red = R.std(0xb52a2c, { roughness: 0.9 }), redD = R.std(0x8e1f22, { roughness: 0.9 }), leather = R.std(0x8a5532, { roughness: 0.9 });
  const glove = R.std(0x8a4f3a, { roughness: 0.9 }), slit = R.basic(0x0c1214), plume = R.std(0xd62a24, { roughness: 0.8 });
  const add = (geo, mat, x, y, z, parent) => part(geo, mat, x, y, z, parent || look);
  const ring = (r, t, mat, x, y, z, parent, sz = 1) => { const o = add(new THREE.TorusGeometry(r, t, 5, 14), mat, x, y, z, parent); o.rotation.x = Math.PI / 2; o.scale.y = sz; return o; };
  // ---- legs: hip pivot → thigh (mail) → knee (gold cop) → shin (greave) → gold sabaton ----
  const legs = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.15, 0.72, 0); body.add(piv);
    add(new THREE.CylinderGeometry(0.11, 0.095, 0.38, 8), mail, 0, -0.17, 0, piv);
    const knee = new THREE.Group(); knee.position.set(0, -0.36, 0); piv.add(knee);
    add(new THREE.SphereGeometry(0.085, 8, 6), gold, 0, 0.0, -0.06, knee).scale.set(1, 0.9, 0.8);
    add(new THREE.CylinderGeometry(0.1, 0.085, 0.28, 8), plate, 0, -0.16, 0, knee);
    ring(0.098, 0.018, gold, 0, -0.03, 0, knee);
    const boot = add(new THREE.BoxGeometry(0.17, 0.12, 0.3), gold, 0, -0.31, -0.05, knee); boot.scale.set(1, 1, 1);
    add(new THREE.BoxGeometry(0.15, 0.06, 0.12), gold, 0, -0.29, -0.2, knee).rotation.x = 0.35;
    piv.userData.knee = knee; piv.userData.bare = [];
    legs.push(piv);
  }
  // ---- hips and waist: plate skirt, mail belly, brown belt with a gold buckle ----
  add(new THREE.CylinderGeometry(0.29, 0.34, 0.24, 8, 1, true), plateD, 0, 0.78, 0);
  add(new THREE.CylinderGeometry(0.27, 0.29, 0.22, 8), mail, 0, 1.0, 0).scale.z = 0.85;
  ring(0.3, 0.04, leather, 0, 0.94, 0, look, 1); look.children[look.children.length - 1].scale.set(1, 1, 0.82);
  add(new THREE.BoxGeometry(0.12, 0.1, 0.04), gold, 0, 0.94, -0.265);
  // ---- chest: broad plate, the red tabard over it (upper part on the chest, the skirt flap swings with the legs) ----
  { const cg = new THREE.CylinderGeometry(0.34, 0.28, 0.5, 8); add(cg, plate, 0, 1.33, 0).scale.set(1, 1, 0.78); }
  add(new THREE.BoxGeometry(0.4, 0.42, 0.03), red, 0, 1.18, -0.255).rotation.x = -0.12;
  add(new THREE.BoxGeometry(0.4, 0.42, 0.03), red, 0, 1.18, 0.245).rotation.x = 0.1;
  const flapF = new THREE.Group(); flapF.position.set(0, 0.95, -0.27); body.add(flapF);
  add(new THREE.BoxGeometry(0.34, 0.5, 0.025), red, 0, -0.25, 0, flapF); add(new THREE.BoxGeometry(0.34, 0.05, 0.03), gold, 0, -0.5, 0, flapF);
  const flapB = new THREE.Group(); flapB.position.set(0, 0.95, 0.26); body.add(flapB);
  add(new THREE.BoxGeometry(0.34, 0.48, 0.025), redD, 0, -0.24, 0, flapB);
  // ---- gorget and pauldrons (big, gold-rimmed) ----
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8), plateD, 0, 1.62, 0);
  for (const sx of [-1, 1]) {
    const pd = add(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), plate, sx * 0.4, 1.53, 0); pd.scale.set(1.15, 0.85, 1.05); pd.rotation.z = -sx * 0.35;
    const rim = ring(0.19, 0.03, gold, sx * 0.44, 1.5, 0); rim.scale.set(1.12, 0.9, 1); rim.rotation.y = -sx * 0.35;
    const lame = add(new THREE.SphereGeometry(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), plateD, sx * 0.47, 1.38, 0); lame.scale.set(1, 0.6, 1); lame.rotation.z = -sx * 0.6;
  }
  // ---- head: great helm with an eye slit, gold rims and a red crest ----
  const head = new THREE.Group(); head.position.set(0, 1.88, 0); body.add(head);
  head.position.y = 1.84;
  add(new THREE.CylinderGeometry(0.215, 0.23, 0.36, 10), plate, 0, 0.0, 0, head);
  add(new THREE.CylinderGeometry(0.17, 0.215, 0.06, 10), plate, 0, 0.21, 0, head);
  ring(0.232, 0.026, gold, 0, -0.17, 0, head); ring(0.217, 0.022, gold, 0, 0.18, 0, head);
  add(new THREE.BoxGeometry(0.32, 0.045, 0.06), slit, 0, 0.04, -0.2, head);
  add(new THREE.BoxGeometry(0.035, 0.17, 0.05), gold, 0, -0.08, -0.215, head);
  for (let k = 0; k < 3; k++) { const c = add(new THREE.ConeGeometry(0.05 - k * 0.008, 0.22 - k * 0.03, 5), plume, 0, 0.31 + k * 0.03, 0.02 + k * 0.07, head); c.rotation.x = 0.25 + k * 0.35; }
  // ---- arms: upper arm (mail) and forearm (plate bracer with gold rims) are posed by two-bone IK each frame ----
  const UA = 0.32, FA = 0.33, arms = [];
  for (const sx of [-1, 1]) {
    const upper = new THREE.Group(); upper.position.set(sx * 0.4, 1.5, 0); body.add(upper);
    add(new THREE.CylinderGeometry(0.085, 0.075, UA, 8), mail, 0, -UA / 2, 0, upper);
    add(new THREE.SphereGeometry(0.08, 8, 6), plateD, 0, -UA, 0, upper);
    const fore = new THREE.Group(); body.add(fore);
    add(new THREE.CylinderGeometry(0.095, 0.08, 0.24, 8), plate, 0, -0.13, 0, fore);
    ring(0.093, 0.02, gold, 0, -0.02, 0, fore); ring(0.082, 0.018, gold, 0, -0.25, 0, fore);
    arms.push({ piv: upper, upper, fore, s: sx, UA, FA, sleeve: null });
  }
  const handMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 });
  const mkHand = sx => { const h = part(new THREE.SphereGeometry(0.09, 6, 4), handMat.clone(), sx * 0.45, 1.0, -0.2, body); const f = add(new THREE.BoxGeometry(0.11, 0.12, 0.13), glove, 0, 0, 0, h); f.rotation.y = 0.2; h.userData.bare = []; return h; };
  const hL = mkHand(-1), hR = mkHand(1);
  const gL = R.glowSprite(accent, 0.5); gL.material.opacity = 0.0; hL.add(gL); const gR = R.glowSprite(accent, 0.5); gR.material.opacity = 0.0; hR.add(gR);
  // ---- kite shield on the left arm: red face, steel rim, gold cross ----
  const shield = new THREE.Group(); hL.add(shield);
  { const sh = new THREE.Shape(); sh.moveTo(-0.26, 0.3); sh.lineTo(0.26, 0.3); sh.lineTo(0.27, 0.0); sh.quadraticCurveTo(0.22, -0.28, 0, -0.46); sh.quadraticCurveTo(-0.22, -0.28, -0.27, 0.0); sh.closePath();
    const face = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 }), red); face.castShadow = true; shield.add(face);
    const rimG = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }); const rm = new THREE.Mesh(rimG, plate); rm.scale.set(1.12, 1.1, 1); rm.position.set(0, -0.005, -0.02); shield.add(rm);
    // a broad cross with flared ends
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.03), gold); cv.position.set(0, -0.03, 0.055); shield.add(cv);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.03), gold); ch.position.set(0, 0.03, 0.055); shield.add(ch);
    for (const [x, y, w, h] of [[0, 0.17, 0.17, 0.05], [0, -0.23, 0.17, 0.05], [0.17, 0.03, 0.05, 0.17], [-0.17, 0.03, 0.05, 0.17]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), gold); t.position.set(x, y, 0.055); shield.add(t); }
  }
  shield.position.set(-0.07, 0.02, -0.04); shield.rotation.set(0, Math.PI + 0.55, 0);
  // ---- optional cloak (only when a cloak item is equipped) ----
  const cloakGeo = new THREE.CylinderGeometry(0.36, 0.56, 1.4, 24, 8, true, -1.62, 3.24);
  { const a = cloakGeo.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const y = a[i + 1], h = (0.7 - y) / 1.4, ang = Math.atan2(a[i], a[i + 2]); a[i] *= 0.98; a[i + 2] = a[i + 2] * 0.75 + 0.14 + h * 0.2; a[i + 1] = y - Math.abs(Math.sin(ang)) * h * 0.06; } cloakGeo.computeVertexNormals(); }
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x2c2826, roughness: 1, side: THREE.DoubleSide });
  const cloak = part(cloakGeo, capeMat, 0, 0.92, 0.06, body); cloak.visible = false;
  const base = cloakGeo.attributes.position.array.slice();
  const mantle = part(new THREE.CylinderGeometry(0.3, 0.5, 0.3, 12, 1, true, Math.PI + 0.36, Math.PI * 2 - 0.72), capeMat.clone(), 0, 1.55, 0.02, body); mantle.visible = false;
  const brooch = new THREE.Group(); body.add(brooch); brooch.visible = false;
  // ---- shared rig extras ----
  const book = new THREE.Group(); root.add(book); book.visible = false;
  const sig = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: R.texRune, color: accent, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  sig.rotation.x = -Math.PI / 2; sig.position.y = 0.05; root.add(sig);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; root.add(shadow);
  const light = new THREE.PointLight(accent, 1.2, 9, 2); light.position.set(0, 2.3, 0); root.add(light);
  const ward = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3aa8d8, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, flatShading: true, depthWrite: false })); ward.position.y = 1.0; ward.visible = false; root.add(ward);
  const bastion = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0xd99b5f, emissive: 0x6a3a10, emissiveIntensity: 0.5, transparent: true, opacity: 0.5, flatShading: true, depthWrite: false })); bastion.position.y = 1.0; bastion.visible = false; root.add(bastion);
  const mirror = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 4, 32), new THREE.MeshBasicMaterial({ color: 0xbb80ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })); mirror.rotation.x = Math.PI / 2; mirror.position.y = 1; mirror.visible = false; root.add(mirror);
  body.scale.setScalar(1.04);
  R.ents.add(root);
  const m = { kind: 'knight', armoured: true, hideWithChest: [], look, rig: { torsoR: 0.34, shoulderX: 0.4, shoulderY: 1.5, waistY: 0.95 }, hideWithHelm: [], capeMat, cloakBase: 0x2c2826, root, body, cloak, cloakGeo, base, aL: null, aR: null, auraCol: accent, mantle, hood: null, head, legs, arms, strap: null, brooch, bGlow: null, hL, hR, gL, gR, book, sig, light, ward, bastion, mirror, accent, eyes: [], cloth: red, shield, flapF, flapB, castT: 0, castSide: 1, t: Math.random() * 10, walk: 0, lvx: 0, lvz: 0 };
  R.attachHeroGLB(m);
  return m;
};
/* Character catalogue (looks only; every hero shares the same stats, controls and combat). */
H.CHARACTERS = {
  percy: { name: 'Percy', desc: 'A ragged wanderer in a torn brown tunic. Barefoot, bearded, stubborn.', make: accent => R.makeRogue(accent) },
  knight: { name: 'The Veteran', desc: 'A scarred, grey-bearded soldier who has survived more wars than he remembers. His old armour can be found on the way down.', make: accent => R.makeKnight(accent) }
};
R.makeHero = function (charId, accent, cloakColor) { const c = H.CHARACTERS[charId] || H.CHARACTERS.percy; return charId === 'knight' ? R.makeKnight(accent) : R.makeRogue(accent, cloakColor); };
/* Equipment on the model: simple attachments per item so the hero looks like what they wear. */
R.dressRogue = function (m, equip) {
  const THREE = T3(); equip = equip || {};
  const key = JSON.stringify(equip); if (m._dressKey === key) return; m._dressKey = key;
  for (const o of m.gearObjs || []) { if (o.parent) o.parent.remove(o); }
  m.gearObjs = [];
  // restore anything a previous armour piece hid
  (m.hideWithHelm || []).forEach(o => o.visible = true); (m.hideWithChest || []).forEach(o => o.visible = true);
  for (const piv of m.legs || []) { if (piv.userData.boot && m.kind !== 'knight') piv.userData.boot.visible = true; (piv.userData.bare || []).forEach(o => o.visible = true); }
  for (const hd of [m.hL, m.hR]) (hd && hd.userData.bare || []).forEach(o => o.visible = true);
  // the armoured Veteran already wears his full harness: armour items change his stats, not his look
  const vet = (slot) => { if (m.armoured) return true; const it = equip[slot] && H.ITEMS[equip[slot]]; if (it && it.vet && R.vetArmor[slot]) { (m.gearObjs = m.gearObjs || []).push(...R.vetArmor[slot](m)); return true; } return false; };
  const vH = vet('head'), vC = vet('chest'), vL = vet('legs'), vF = vet('feet');
  if (vC) (m.hideWithChest || []).forEach(o => o.visible = false);
  const add = (parent, mesh) => { parent.add(mesh); mesh.castShadow = true; m.gearObjs.push(mesh); return mesh; };
  const mat = (col, metal) => R.metalize(new THREE.MeshStandardMaterial({ color: col, roughness: metal ? 0.42 : 0.85, metalness: metal ? 0.6 : 0.05, flatShading: true }), metal ? 1.1 : 0.35);
  const it = s => equip[s] && H.ITEMS[equip[s]];
  const head = it('head');
  if (head && !vH && !m.armoured) {
    const c = new THREE.Color(head.col).getHex();
    if (head.icon === 'it_helm') { const mm = mat(0x9aa0aa, true); add(m.head, new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52), mm)).position.y = 0.04; const br = add(m.head, new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 4, 14), mm)); br.rotation.x = Math.PI / 2; br.position.y = 0.04; add(m.head, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), mm)).position.set(0, -0.02, -0.28); }
    else if (head.icon === 'it_hat') { const mm = mat(c); const brim = add(m.head, new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.035, 16), mm)); brim.position.y = 0.2; const cone = add(m.head, new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 10), mm)); cone.position.set(0, 0.52, 0.06); cone.rotation.x = 0.35; const band = add(m.head, new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.24, 0.07, 12), mat(0xd9a441, true))); band.position.y = 0.26; }
    else { const mm = mat(c); mm.side = THREE.DoubleSide; const h = add(m.head, new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mm)); h.position.set(0, 0.03, 0.03); h.rotation.x = 0.35; const pk = add(m.head, new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), mm)); pk.position.set(0, 0.25, 0.27); pk.rotation.x = 2.4; }
  }
  const chest = it('chest');
  // generic armour is sized from the rig, so it fits both Percy's narrow frame and the Veteran's broad one
  const rg = m.rig || { torsoR: 0.25, shoulderX: 0.29, shoulderY: 1.5, waistY: 1.06 }, tk = rg.torsoR / 0.25;
  if (chest && !vC && !m.armoured) {
    const c = new THREE.Color(chest.col).getHex();
    if (chest.icon === 'it_robe') { const rb = add(m.body, new THREE.Mesh(new THREE.CylinderGeometry(0.265 * tk * 1.06, 0.4 * tk, 1.05, 12), mat(c))); rb.position.y = 1.0; const tr = add(m.body, new THREE.Mesh(new THREE.TorusGeometry(0.4 * tk, 0.025, 4, 16), mat(0xd9a441, true))); tr.rotation.x = Math.PI / 2; tr.position.y = 0.48; }
    else {
      const mm = mat(chest.icon === 'it_scale' ? 0xb8401e : 0x9aa0aa, true); if (chest.icon === 'it_scale') { mm.emissive = new THREE.Color(0x5a1a08); mm.emissiveIntensity = 0.6; }
      const h = rg.shoulderY - rg.waistY + 0.12;
      const cu = add(m.body, new THREE.Mesh(new THREE.CylinderGeometry(0.275 * tk * 1.1, 0.24 * tk * 1.1, h, 12), mm)); cu.position.y = (rg.shoulderY + rg.waistY) / 2 - 0.02;
      for (const sx of [-1, 1]) { const pd = add(m.body, new THREE.Mesh(new THREE.SphereGeometry(0.14 * tk * 1.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mm)); pd.position.set(sx * rg.shoulderX * 1.02, rg.shoulderY + 0.01, 0); }
    }
    // the Veteran's tunic would poke through: hide its upper pieces under any chest armour
    (m.hideWithChest || []).forEach(o => o.visible = false);
  }
  const lk = m.kind === 'knight' ? 1.3 : 1, g0 = m.gearObjs.length;
  const legsIt = it('legs');
  if (legsIt && !vL && !m.armoured) for (const piv of m.legs) {
    if (legsIt.icon === 'it_greaves') { const mm = mat(0x9aa0aa, true); add(piv, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.34, 6), mm)).position.y = -0.43; add(piv, new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), mm)).position.set(0, -0.27, -0.06); }
    else add(piv, new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.078, 0.34, 6), mat(new THREE.Color(legsIt.col).getHex()))).position.y = -0.16;
  }
  const feet = it('feet');
  if (feet && !vF && !m.armoured) for (const piv of m.legs) { const b = add(piv, new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.15, 0.35), mat(new THREE.Color(feet.col).getHex(), feet.id === 'hobnail_boots'))); b.position.set(0, -0.6, -0.07); if (feet.id === 'strider_boots') { b.material.emissive = new THREE.Color(0x1a6a8a); b.material.emissiveIntensity = 0.4; } }
  // main weapon in the right hand (only the Veteran can wield them)
  m.sword = null;
  const wpn = it('weapon');
  m.twoHand = false;
  if (wpn && wpn.weapon && H.WEAPON_KITS[wpn.weapon] && m.hR && (!wpn.hero || m.kind === wpn.hero)) { m.sword = R.makeSword(m, wpn); m.twoHand = !!H.WEAPON_KITS[wpn.weapon].twoHand; m.weaponKind = wpn.weapon; }
  if (lk !== 1) for (const o of m.gearObjs.slice(g0)) if (o.parent && m.legs.includes(o.parent)) { const foot = o.position.y < -0.55; o.scale.x *= foot ? 1.12 : lk; o.scale.z *= foot ? 1.0 : lk; }
  const cloak = it('cloak');
  const cc = cloak ? new THREE.Color({ eagle_cloak: 0xe8dcc0, ember_mantle: 0xa0381a, shadow_cloak: 0x2a2040, wool_cloak: 0x6a5a48 }[cloak.id] || cloak.col) : new THREE.Color(m.cloakBase);
  if (m.capeMat) m.capeMat.color.copy(cc); if (m.mantle) m.mantle.material.color.copy(cc);
  if (m.cloak) m.cloak.visible = !!cloak; if (m.mantle) m.mantle.visible = !!cloak; if (m.brooch) m.brooch.visible = !!cloak;
  if (m.kind === 'knight' && m.mantle) m.mantle.visible = false;
  if (m.shield) m.shield.visible = !m.twoHand;
  for (const g of m.gearObjs) R.toonify(g);
  if (m.heroGLB) R.hideProcedural(m);
  if (m.capeMat) { m.capeMat.emissive = new THREE.Color(cloak && cloak.id === 'ember_mantle' ? 0x4a1004 : 0x000000); }
};
/* Steel sword: blade along +Y of `inner`; `outer` sits in the right hand and carries the sweep. */
/* Weapon meshes. Built along +Y of `inner`; `outer` sits in the right hand and carries the sweep. */
R.buildWeapon = function (wpn) {
  const THREE = T3();
  const tier = { common: 0, uncommon: 1, rare: 2, legendary: 3 }[wpn.rarity] || 0, t3 = Math.min(2, tier);
  const steel = new THREE.MeshStandardMaterial({ color: [0xa9afb8, 0xc9d0da, 0xdfe6ee, 0xd8dde4][tier], roughness: [0.42, 0.3, 0.22, 0.2][tier], metalness: 0.85, flatShading: true });
  if (tier >= 2) steel.emissive = new THREE.Color(0x26323e);
  const guardM = new THREE.MeshStandardMaterial({ color: [0x4a4744, 0x8a6a3a, 0xd9a441, 0x2a2228][tier], roughness: 0.4, metalness: 0.8, flatShading: true });
  const gripM = new THREE.MeshStandardMaterial({ color: tier === 3 ? 0x1c1418 : 0x3a2618, roughness: 0.9, flatShading: true });
  const wood = new THREE.MeshStandardMaterial({ color: [0x7a5a3a, 0x5e4430, 0x2a1e18, 0x2a1e18][tier], roughness: 0.85, flatShading: true });
  R.metalize(steel, 1.2); R.metalize(guardM, 1.0);
  // the plain sword family follows the Veteran's painted look: pale-blue blade, gold guard and pommel, brown leather grip
  if (wpn.weapon === 'sword') { steel.color.setHex([0xa8d4e4, 0xbde2ef, 0xd4eef7, 0xd4eef7][tier]); steel.metalness = 0.25; steel.roughness = 0.35; guardM.color.setHex(tier === 2 ? 0xf2c23a : 0xe6ad22); guardM.metalness = 0.2; gripM.color.setHex(0x6b3f22); }
  const outer = new THREE.Group(), inner = new THREE.Group(); outer.add(inner);
  const glb = wpn.model && R.weaponGLB[wpn.model];
  if (glb) { inner.add(glb.fit.clone(true)); inner.rotation.x = -1.25; outer.userData.inner = inner; outer.userData.bladeY0 = glb.cfg.bladeY0; outer.userData.bladeLen = glb.cfg.bladeLen; outer.userData.glb = wpn.model; return outer; }
  const mk = (geo, mat, y, x = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; inner.add(o); return o; };
  const kind = wpn.weapon;
  if (kind === 'axe') {
    // long haft, bearded head on the leading (-x) side, a short spike behind
    mk(new THREE.CylinderGeometry(0.03, 0.036, 1.12, 7), wood, 0.28);
    for (const y of [-0.12, -0.02]) mk(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 7), gripM, y);
    const hs = new THREE.Shape(); hs.moveTo(0, 0.1); hs.lineTo(-0.12, 0.14); hs.quadraticCurveTo(-0.3, 0.16, -0.36, 0.04); hs.lineTo(-0.34, -0.2); hs.quadraticCurveTo(-0.24, -0.16, -0.12, -0.1); hs.lineTo(0, -0.06); hs.closePath();
    const head = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1 }), steel); head.position.set(0, 0.74, -0.015); head.castShadow = true; inner.add(head);
    mk(new THREE.BoxGeometry(0.08, 0.16, 0.06), guardM, 0.76, 0.0);
    const sp = mk(new THREE.ConeGeometry(0.03, 0.14, 4), steel, 0.76, 0.1); sp.rotation.z = -Math.PI / 2;
    if (tier >= 2) mk(new THREE.BoxGeometry(0.012, 0.3, 0.035), guardM, 0.74, -0.33);
  } else {
    const big = kind === 'bastard', L = big ? 1.15 : 0.86, W = big ? 0.085 : 0.075;
    mk(new THREE.BoxGeometry(W, L, 0.02), steel, 0.1 + L / 2);
    const tip = mk(new THREE.ConeGeometry(W * 0.71, 0.16, 4), steel, 0.1 + L + 0.08); tip.rotation.y = Math.PI / 4; tip.scale.z = 0.35;
    const ful = mk(new THREE.BoxGeometry(0.016, L * 0.8, 0.024), guardM.clone(), 0.1 + L * 0.42);
    if (tier === 3) { ful.material = new THREE.MeshBasicMaterial({ color: 0xff8a2a }); } else ful.material.color.setHex([0x7c828a, 0x9aa3ae, 0xb8c4d0][t3]);
    mk(new THREE.BoxGeometry(big ? 0.4 : (tier === 2 ? 0.32 : 0.26), 0.05, 0.06), guardM, 0.08);
    if (big) for (const sx of [-1, 1]) mk(new THREE.SphereGeometry(0.03, 6, 4), guardM, 0.08, sx * 0.2);
    if (tier >= 2) { const gem = mk(new THREE.OctahedronGeometry(0.03), new THREE.MeshStandardMaterial({ color: tier === 3 ? 0xff7a2a : 0x3d7dff, emissive: tier === 3 ? 0x9a3a08 : 0x1a3d9a, roughness: 0.2, metalness: 0.3 }), 0.08, 0, 0.035); gem.scale.set(1, 1, 0.6); }
    mk(new THREE.CylinderGeometry(0.026, 0.03, big ? 0.34 : 0.2, 6), gripM, big ? -0.11 : -0.04);
    mk(new THREE.SphereGeometry(big ? 0.048 : 0.042, 6, 5), guardM, big ? -0.3 : -0.16);
  }
  // the sword family's blade glows faintly: seen edge-on from the iso camera it would otherwise vanish under the
  // painted look's ink lines, and the energy arcs read as coming out of it
  if (kind !== 'axe') { steel.emissive = new THREE.Color(kind === 'bastard' ? 0x2c3a44 : 0x2a5a66); steel.emissiveIntensity = 0.9; }
  inner.rotation.x = -1.25; outer.userData.inner = inner;
  // blade span along +Y of inner, read by the energy arcs (swordtrail.js)
  if (kind === 'axe') { outer.userData.bladeY0 = 0.3; outer.userData.bladeLen = 0.5; } else { outer.userData.bladeY0 = 0.1; outer.userData.bladeLen = kind === 'bastard' ? 1.15 : 0.86; }
  return outer;
};
/* Weapon .glb models. An item with model: '<key>' uses the file once it has loaded; until then (or if the
   file is missing) it keeps its procedural mesh. fit puts the model in the same frame as the procedural blade
   (+Y of `inner` from the grip to the tip, flat side facing ±Z), so every swing, the energy arcs and the hand
   pose work unchanged: rotX turns the file's axis onto +Y, then scale and lift place the grip in the hand. */
R.WEAPON_MODELS = {
  // "Paladin Longsword" by Efarys (sketchfab.com/Efarys), CC-BY-SA-4.0 — textures resized to 512 px
  longsword: { url: 'public/models/weapons/longsword.glb', rotX: -Math.PI / 2, scale: 0.68, thick: [2.1, 2.0], // stylised: 2.1× wider, 2× thicker than the realistic file
     lift: 0.436, bladeY0: 0.1, bladeLen: 0.86, glow: { mat: 'None_001', color: 0x2f6474, k: 1.0 } }
};
R.weaponGLB = {};
R.loadWeaponModels = function () {
  const THREE = T3(); if (!THREE.GLTFLoader) return;
  for (const [key, cfg] of Object.entries(R.WEAPON_MODELS)) {
    const loader = new THREE.GLTFLoader();
    const onLoad = gltf => {
      const fit = new THREE.Group(); fit.add(gltf.scene); fit.rotation.x = cfg.rotX || 0; const sc = cfg.scale || 1, th = cfg.thick || [1, 1]; fit.scale.set(sc * th[0], sc * th[1], sc); // file axes: X width, Y thickness, Z length fit.position.y = cfg.lift || 0;
      fit.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.geometry.shared = true; const mt = o.material; mt.shared = true;
        if (mt.isMeshStandardMaterial) R.metalize(mt, 0.9);
        if (cfg.glow && mt.name === cfg.glow.mat) { mt.emissive = new THREE.Color(cfg.glow.color); mt.emissiveIntensity = cfg.glow.k; } });
      R.weaponGLB[key] = { fit, cfg };
      // heroes already dressed swap their procedural blade for the model
      for (const p of (H.G && H.G.players) || []) if (p.model && p.equip && p.equip.weapon && H.ITEMS[p.equip.weapon] && H.ITEMS[p.equip.weapon].model === key) { p.model._dressKey = null; R.dressRogue(p.model, p.equip); }
    };
    const give_up = () => console.warn('[weapons] ' + cfg.url + ' not loaded; keeping the procedural blade');
    // hosts that don't serve .glb files get the same model embedded in '<url>.js' (base64 in H.EMBED[url])
    const fromB64 = b64 => { const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); loader.parse(buf.buffer, '', onLoad, give_up); };
    if (H.EMBED && H.EMBED[cfg.url]) { fromB64(H.EMBED[cfg.url]); continue; }   // already embedded by the page: no request
    const embedded = () => { const sc = document.createElement('script'); sc.src = cfg.url + '.js';
      sc.onload = () => { const b64 = H.EMBED && H.EMBED[cfg.url]; if (!b64) return give_up(); fromB64(b64); };
      sc.onerror = give_up; document.head.appendChild(sc); };
    loader.load(cfg.url, onLoad, undefined, embedded);
  }
};
R.makeSword = function (m, wpn) {
  const outer = R.buildWeapon(wpn);
  R.toonify(outer); m.hR.add(outer); (m.gearObjs = m.gearObjs || []).push(outer);
  return outer;
};
R.makeThrownWeapon = function (wpn) { const g = R.buildWeapon(wpn); R.toonify(g); R.fx.add(g); return g; };
R.animateSword = function (m, p, dt) {
  const sw = m.sword; if (!sw) return; const inner = sw.userData.inner;
  const t = 1 - (m.swingT || 0), e = t * t * (3 - 2 * t), on = (m.swingT || 0) > 0;
  let ox = 0, oy = 0, ix = m.weaponKind === 'axe' ? -0.55 : -1.25;
  if (p.charge) { ix = -1.57; oy = 0.12; }
  else if (p.spinT > 0 || m.twirlT > 0) { oy = -1.5; ix = -1.57; }
  else if (on && m.swing === 'slash') { oy = -1.4 + 2.8 * e; ix = -1.45; }
  else if (on && m.swing === 'thrust') { ix = -1.57; }
  else if (on && m.swing === 'chop') { const up = t < 0.35 ? t / 0.35 : 0, cut = t < 0.35 ? 0 : Math.min(1, (t - 0.35) / 0.25), ce = cut * cut * (3 - 2 * cut); ix = t < 0.35 ? -1.25 + 2.45 * up : 1.2 - 3.1 * ce; }
  else if (on && m.swing === 'smash') { const up = t < 0.5 ? t / 0.5 : 0, slam = t < 0.5 ? 0 : Math.min(1, (t - 0.5) / 0.15); ix = t < 0.5 ? -1.25 + 2.35 * up : 1.1 - 3.1 * slam; }
  else if (on && m.swing === 'backhand') { const cut = t < 0.42 ? 0 : Math.min(1, (t - 0.42) / 0.25), ce = cut * cut * (3 - 2 * cut); oy = -1.5 + 2.9 * ce; ix = -1.5; }
  else if (on && m.swing === 'throw') { const wind = t < 0.3 ? t / 0.3 : 0; ix = -1.25 + 2.0 * wind; }
  else if (on && m.swing === 'cleave') { const wind = t < 0.3 ? t / 0.3 : 1, cut = t < 0.3 ? 0 : Math.min(1, (t - 0.3) / 0.22), ce = cut * cut * (3 - 2 * cut); oy = -1.7 * wind + 2.9 * ce; ix = -0.5 * wind - 0.95 * ce - (1 - wind) * 0.75; }
  sw.rotation.set(ox, oy, 0); inner.rotation.x = ix;
};
/* ---- Illustrated look: 3-tone toon shading and ink outlines for characters, gear and props ---- */
R.toonGradient = function () {
  if (R._toonGrad) return R._toonGrad;
  const THREE = T3(); // toon samples the ramp at dot(N,L)*0.5+0.5: faces turned away from a light get none of it (like Lambert),
  // lit faces split into a mid tone and a full tone with a hard edge between them
  const d = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 125, 125, 125, 255, 235, 235, 235, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return (R._toonGrad = t);
};
R._toonCache = new WeakMap();
R.toonMaterial = function (src) {
  if (!src || !(src.isMeshStandardMaterial || src.isMeshPhongMaterial || src.isMeshLambertMaterial)) return src;
  if (src.shared && R._toonCache.has(src)) return R._toonCache.get(src);
  const THREE = T3();
  const t = new THREE.MeshToonMaterial({ color: src.color, map: src.map || null, gradientMap: R.toonGradient(), emissive: src.emissive || new THREE.Color(0), emissiveIntensity: src.emissiveIntensity != null ? src.emissiveIntensity : 1, emissiveMap: src.emissiveMap || null,
    transparent: src.transparent, opacity: src.opacity, side: src.side, depthWrite: src.depthWrite, blending: src.blending, vertexColors: src.vertexColors, skinning: !!src.skinning, alphaTest: src.alphaTest });
  // metal read dark through the environment map; toon has none, so carry that darkness into the base colour
  const metal = src.metalness || 0; if (metal > 0) t.color.multiplyScalar(1 - 0.8 * metal);
  t.name = src.name; t.userData = Object.assign({}, src.userData, { from: src.type });
  if (src.shared) { t.shared = true; R._toonCache.set(src, t); }
  return t;
};
R.outlineMaterial = function (skinned) {
  const key = skinned ? '_olS' : '_ol'; if (R[key]) return R[key];
  const THREE = T3(); const m = new THREE.MeshBasicMaterial({ color: 0x0b0710, side: THREE.BackSide, skinning: !!skinned });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.045;'); };
  m.shared = true; return (R[key] = m);
};
/* Convert every lit material under `root` to toon, keep the model's own material references (mats, cloth,
   capeMat…) pointing at the new ones, and (high quality) add a back-face ink hull to each solid mesh. */
R.toonify = function (root, model, o = {}) {
  if (!root || H.settings.look !== 'toon') return;   // the painted look shades in a post pass; classic keeps the old materials
  const swap = new Map();
  root.traverse(obj => {
    if (!obj.isMesh || obj.userData.outline) return;
    const m = obj.material; if (Array.isArray(m)) return;
    if (!swap.has(m)) swap.set(m, R.toonMaterial(m));
    obj.material = swap.get(m);
  });
  const remap = obj => { for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && v.isMaterial && swap.has(v)) model[k] = swap.get(v);
    else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) if (v[i] && v[i].isMaterial && swap.has(v[i])) v[i] = swap.get(v[i]);
  } };
  if (model) { remap(model); if (model.parts) remap(model.parts); }
  if (o.outline !== false && H.settings.quality === 'high') R.addOutline(root);
};
R.addOutline = function (root, minR = 0.16) {
  const add = [];
  root.traverse(obj => {
    if (!obj.isMesh || obj.userData.outline || obj.userData.hasOutline || !obj.geometry || !obj.geometry.attributes.normal) return;
    const m = obj.material; if (!m || Array.isArray(m) || m.transparent || m.blending !== 1 || !m.isMeshToonMaterial) return;
    // only the parts that make the silhouette: small trims, buckles, eyes and fingers cost a draw call each and read as noise
    const g = obj.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    const sc = obj.scale; if (g.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) < minR) return;
    add.push(obj);
  });
  for (const obj of add) {
    const h = obj.isSkinnedMesh ? new (T3().SkinnedMesh)(obj.geometry, R.outlineMaterial(true)) : new (T3().Mesh)(obj.geometry, R.outlineMaterial(false));
    if (obj.isSkinnedMesh) h.bind(obj.skeleton, obj.bindMatrix);
    h.userData.outline = true; h.castShadow = false; h.receiveShadow = false; h.raycast = () => {};
    obj.add(h); obj.userData.hasOutline = true;
  }
};

/* ---- View operations the game asks for (the game never writes model fields directly) ---- */
R.setModelVisible = function (m, v) { if (m && m.root) m.root.visible = v; };
// a thrown weapon leaves the hand: the hero's held weapon follows p.throwing
R.syncHeroWeapon = function (m, p) { if (m && m.sword) m.sword.visible = !p.throwing; };
// read the game's animation state (p.anim) into the model's own animation timers
R.readHeroAnim = function (m, p) {
  const A = p.anim; if (!A) return;
  if (m._castN === undefined) { m._castN = A.castN; m._swingN = A.swingN; m._twirlN = A.twirlN; m._el = A.el; } // a fresh model starts in sync, without replaying old events
  if (A.castN !== m._castN) { m._castN = A.castN; m.castT = 1; }
  m.castSide = A.castSide;
  if (A.swingN !== m._swingN) { m._swingN = A.swingN; m.swing = A.swing; m.swingT = 1; m.swingBig = A.bigN === A.swingN; m.swingArc = A.arcN === A.swingN ? A.arc : null; m.swingRate = A.arcN === A.swingN ? A.rate : 0; } // swingBig: a combo finisher (bigger energy arc)
  if (A.twirlN !== m._twirlN) { m._twirlN = A.twirlN; m.twirlT = 0.26; m.swingT = 0; }
  m.chargeK = A.chargeK;
  if (A.el !== m._el) { m._el = A.el; if (A.el) R.setRogueElement(m, A.el); }
  R.syncHeroWeapon(m, p);
};
// how long a dead enemy should stay for its death clip (procedural models: 0)
R.enemyDeathHold = function (m) { if (m && m.anim && m.anim.actions.death) { if (m.mark) m.mark.visible = false; return 0.9; } return 0; };
// what the corpse looks like right after dying: hidden, or kept for the fall into a pit
R.enemyDeathVisual = function (m, plunge) { if (m && m.root) m.root.visible = !!plunge || !!(m.anim && m.anim.actions.death); };
// height of the health bar above an enemy's feet: from the model registry for a .glb, else per procedural type
R.enemyBarHeight = function (e) {
  const g = e.model && e.model.glbInst && e.model.glbInst.barH;
  const h = g || (e.type === 'brute' ? 3.4 : e.type === 'shieldbearer' ? 2.6 : 2.4);
  return h * (e.elite ? 1.3 : 1);
};
R.animateDying = function (m, e, dt) { if (m && m.anim) R.animateEnemy(m, e, dt); };
// spirits turning ethereal: see-through copies of the model's own materials
R.setGhost = function (m, on) {
  if (!m || !m.root) return;
  if (!m._ghostMats) { m._ghostMats = []; m.root.traverse(o => { if (o.userData.outline) return; if (o.isMesh && o.material && !Array.isArray(o.material)) { o.material = o.material.clone(); m._ghostMats.push([o.material, o.material.opacity, o.material.transparent]); } }); }
  m.root.traverse(o => { if (o.userData.outline) o.visible = !on; });
  for (const [mt, op, tr] of m._ghostMats) { mt.transparent = on ? true : tr; mt.opacity = on ? Math.min(op, 0.28) : op; mt.needsUpdate = true; }
};
const _q = { a: null, b: null, up: null };
R.animateRogue = function (m, p, dt) {
  const THREE = T3();
  R.readHeroAnim(m, p);
  m.t += dt;
  const speed = Math.hypot(p.vx, p.vz);
  const moving = speed > 0.5;
  m.root.position.set(p.x, 0, p.z);
  // smoothed facing: the body turns into the aim instead of snapping
  if (m.vf == null) m.vf = p.faceAng;
  m.vf += H.angDiff(p.faceAng, m.vf) * (1 - Math.exp(-dt * 45)); // near-instant turn, just enough to hide a one-frame pop
  const face = m.vf;
  // local-space velocity (forward is -z), smoothed, plus a little acceleration for weight
  const c = Math.cos(face), s = Math.sin(face);
  const lx = p.vx * c - p.vz * s, lz = p.vx * s + p.vz * c;
  const k = 1 - Math.exp(-dt * 25); const plz = m.lvz;
  m.lvx += (lx - m.lvx) * k; m.lvz += (lz - m.lvz) * k;
  m.acc = (m.acc || 0) + (((m.lvz - plz) / Math.max(dt, 1e-3)) - (m.acc || 0)) * (1 - Math.exp(-dt * 6));
  // walk blend: strides fade in and out instead of switching on/off
  m.mk = (m.mk || 0) + (Math.min(1, speed / 6) - (m.mk || 0)) * (1 - Math.exp(-dt * 22));
  const mk = m.mk;
  // the armoured Veteran's stride follows his ground speed, so his feet don't skate
  m.walk += dt * (m.armoured ? Math.min(22, 3 + speed * 2.4) : Math.min(13, 5.5 + speed * 1.1)) * Math.min(1, mk * 1.6);
  const ph = m.walk, stride = Math.sin(ph) * mk;
  // attack / action pose (all additive, smoothed so nothing pops)
  const ct0 = m.castT || 0;
  m.swingT = Math.max(0, (m.swingT || 0) - dt * R.swingRate(m));
  const sw = m.swingT > 0 ? m.swing : null, st = 1 - m.swingT, se = st * st * (3 - 2 * st), arc = Math.sin(Math.PI * st);
  const T = { yaw: 0, pitch: 0, dip: 0, roll: 0, l0: 0, l1: 0 };
  if (p.spinT > 0) { T.pitch = -0.08; T.dip = -0.06; T.l0 = 0.25; T.l1 = -0.25; }
  else if (sw === 'slash') { T.yaw = -0.45 + 0.9 * se; T.pitch = -0.1; T.dip = -0.03; T.l0 = 0.2; T.l1 = -0.15; }
  else if (sw === 'thrust') { T.yaw = -0.3; T.pitch = -0.28 * arc; T.dip = -0.08 * arc; T.l0 = 0.6 * arc; T.l1 = -0.45 * arc; }
  else if (sw === 'cleave') { const wind = st < 0.3 ? st / 0.3 : 1, cut = st < 0.3 ? 0 : Math.min(1, (st - 0.3) / 0.22), ce = cut * cut * (3 - 2 * cut); T.yaw = -0.6 * wind + 1.15 * ce; T.pitch = 0.06 * (1 - cut) - 0.3 * ce; T.dip = -0.14 * ce; T.l0 = 0.5 * ce; T.l1 = -0.4 * ce; T.roll = 0.06 * ce; }
  else if (sw === 'chop') { const up = st < 0.35 ? st / 0.35 : 0, cut = st < 0.35 ? 0 : Math.min(1, (st - 0.35) / 0.25); T.pitch = 0.12 * up - 0.34 * cut; T.dip = -0.04 * up - 0.14 * cut; T.l0 = 0.45 * cut; T.l1 = -0.35 * cut; T.yaw = -0.1 * up; }
  else if (sw === 'smash') { const up = st < 0.5 ? st / 0.5 : 0, slam = st < 0.5 ? 0 : Math.min(1, (st - 0.5) / 0.15); T.pitch = 0.14 * up - 0.38 * slam; T.dip = -0.05 * up - 0.2 * slam; T.l0 = 0.5 * slam; T.l1 = -0.4 * slam; }
  else if (sw === 'backhand') { const cut = st < 0.42 ? 0 : Math.min(1, (st - 0.42) / 0.25); T.yaw = 0.5 * cut; T.pitch = -0.25 * cut; T.dip = -0.1 - 0.06 * cut; T.l0 = 0.45; T.l1 = -0.35; }
  else if (sw === 'throw') { const wind = st < 0.3 ? st / 0.3 : 0, rel = st < 0.3 ? 0 : Math.min(1, (st - 0.3) / 0.2); T.yaw = -0.5 * wind + 0.35 * rel; T.pitch = 0.08 * wind - 0.2 * rel; T.l0 = 0.4 * rel; T.l1 = -0.3 * rel; }
  else if (ct0 > 0) { const side = m.castSide || 1; if (m.kind === 'knight') { T.yaw = side * 0.32 * ct0; T.pitch = -0.14 * ct0; T.dip = -0.04 * ct0; T.l0 = 0.25 * ct0; T.l1 = -0.2 * ct0; } else { T.pitch = -0.07 * ct0; T.yaw = side * 0.08 * ct0; } }
  const ck = m.chargeK || 0;
  if (ck > 0 || (p.charge && m.sword)) { const kk = Math.max(0.35, ck), tr = ck >= 1 ? Math.sin(m.t * 40) * 0.015 : 0; T.yaw = -0.5 * kk + tr; T.pitch = 0.08 * kk; T.dip = -0.13 * kk; T.l0 = 0.42 * kk; T.l1 = -0.3 * kk; T.roll = -0.04 * kk; }
  if (p.dashT > 0) { T.pitch -= 0.22; T.dip -= 0.05; T.l0 = 0.55; T.l1 = -0.65; }
  // landing out of a dash: a short dip that eases back (only for the armoured rig)
  if (m.armoured) { if (m._dashing && !(p.dashT > 0)) m.landT = 0.22; m._dashing = p.dashT > 0; if (m.landT > 0) { m.landT = Math.max(0, m.landT - dt); const k = m.landT / 0.22; T.dip -= 0.09 * k; T.pitch -= 0.08 * k; } }
  if (p.hurtT > 0) { T.pitch += 0.22; T.roll += 0.06; }
  m.ap = m.ap || { yaw: 0, pitch: 0, dip: 0, roll: 0, l0: 0, l1: 0 };
  const ka = 1 - Math.exp(-dt * 22); for (const kk in T) m.ap[kk] += (T[kk] - m.ap[kk]) * ka;
  const A = m.ap;
  // body: hip twist and roll with each step, lean into speed and acceleration, breathe when idle
  if (m.twirlT > 0) m.twirlT = Math.max(0, m.twirlT - dt);
  let twirl = m.twirlT > 0 ? (1 - m.twirlT / 0.26) * Math.PI * 2 : 0;
  if (sw === 'backhand') { const k = Math.min(1, st / 0.42), ke = 1 - (1 - k) * (1 - k); twirl += Math.PI * (ke - 1); }
  m.body.rotation.y = face + (p.spinAng || 0) + twirl + Math.sin(ph) * 0.07 * mk + A.yaw;
  const bob = (1 - Math.abs(Math.sin(ph))) * 0.055 * mk - 0.025 * mk + Math.sin(m.t * 2.2) * 0.012 * (1 - mk);
  m.body.position.y = bob + A.dip + (p.downed ? -0.6 : 0);
  const fwdLean = H.clamp(m.lvz * 0.02, -0.2, 0.12);
  m.body.rotation.x = fwdLean + A.pitch + (m.armoured ? H.clamp((m.acc || 0) * 0.004, -0.1, 0.1) : 0);
  m.body.rotation.z = H.clamp(-m.lvx * 0.02, -0.16, 0.16) + Math.sin(ph) * 0.035 * mk + A.roll;
  if (p.downed) m.body.rotation.x = 1.2;
  // legs: swing, plus a knee-lift on the leg that is travelling forward; blend toward stance poses
  if (m.legs) {
    for (let i = 0; i < 2; i++) {
      const L = m.legs[i]; if (L.userData.y0 == null) L.userData.y0 = L.position.y;
      const sgn = i === 0 ? 1 : -1, sw2 = Math.sin(ph) * sgn;
      const lift = Math.max(0, Math.cos(ph) * sgn) * 0.07 * mk;
      L.rotation.x = sw2 * 0.6 * mk + (i === 0 ? A.l0 : A.l1);
      L.position.y = L.userData.y0 + lift;
      // knee: bends while the leg travels forward, stays soft at rest, folds deeper in a dash
      const kn = L.userData.knee;
      if (kn) { const fwd = Math.max(0, Math.cos(ph) * sgn); const bend = 0.08 + (0.15 + 0.9 * fwd) * 0.95 * mk + (p.dashT > 0 ? (i === 0 ? 0.55 : 0.85) : 0) + Math.max(0, -(i === 0 ? A.l0 : A.l1)) * 0.6;
        kn.userData.b = (kn.userData.b || 0) + (bend - (kn.userData.b || 0)) * (1 - Math.exp(-dt * 30)); kn.rotation.x = -kn.userData.b; }
    }
  }
  // cloak cloth: trails opposite movement, flares on dashes, ripples at the hem
  if (m.cloakGeo) {
    const pos = m.cloakGeo.attributes.position; const a = pos.array, b = m.base;
    const dash = p.dashT > 0 ? 1 : 0;
    // lagging trail vector (the cape follows the body a beat late)
    const tgx = -m.lvx * 0.1 * (1 + dash * 0.8), tgz = -m.lvz * 0.1 * (1 + dash * 0.8);
    const kk = 1 - Math.exp(-dt * 5); m.ctx = (m.ctx || 0) + (tgx - (m.ctx || 0)) * kk; m.ctz = (m.ctz || 0) + (tgz - (m.ctz || 0)) * kk;
    const tx = m.ctx, tz = m.ctz; const mag = Math.hypot(tx, tz);
    for (let i = 0; i < a.length; i += 3) {
      const y = b[i + 1]; const h = H.clamp((0.75 - y) / 1.5, 0, 1); const h2 = h * h;
      const ang = Math.atan2(b[i], b[i + 2]);
      const wave = Math.sin(m.t * (moving ? 9 : 2.2) - h * 4 + ang * 2) * (0.02 + Math.min(0.06, mag * 0.08)) * h;
      a[i] = b[i] + tx * h2 * 1.2 + wave * 0.6;
      a[i + 1] = y + h2 * Math.min(0.55, mag * 0.6) - wave * 0.3;
      a[i + 2] = b[i + 2] + tz * h2 * 1.2 + Math.min(0.5, mag * 0.5) * h + wave;
    }
    pos.needsUpdate = true; m.cloakGeo.computeVertexNormals();
  }
  // tabard flaps: pushed by the legs, trailing a little behind
  if (m.flapF) { const l0 = m.legs[0].rotation.x, l1 = m.legs[1].rotation.x; const tf = Math.max(0, l0, l1) * 0.85 + H.clamp(m.lvz * 0.012, -0.05, 0.25), tb = Math.min(0, l0, l1) * 0.45 - H.clamp(-m.lvz * 0.01, -0.05, 0.12);
    const kf = 1 - Math.exp(-dt * 14); m.flapF.rotation.x += (tf - m.flapF.rotation.x) * kf; m.flapB.rotation.x += (tb - m.flapB.rotation.x) * kf; }
  if (m.strap) m.strap.rotation.x = H.clamp(m.lvz * 0.05, -0.5, 0.5) + stride * 0.08;
  if (m.head) m.head.rotation.y = Math.sin(m.t * 0.7) * 0.08;
  // hands: idle float or cast thrust
  m.castT = Math.max(0, m.castT - dt * 4);
  const ct = m.castT, side = m.castSide;
  const hx = 0.42 - 0.03 * mk, fwd = -0.25 - ct * 0.55, hy = 1.0 - 0.06 * mk, arm = 0.22 * mk;
  const idleL = Math.sin(m.t * 3) * 0.05 * (1 - mk), idleR = Math.sin(m.t * 3 + 1) * 0.05 * (1 - mk);
  m.hL.position.set(-hx + (side < 0 ? ct * 0.3 : 0), hy + idleL + Math.max(0, -Math.sin(ph)) * 0.05 * mk + (side < 0 ? ct * 0.25 : 0), side < 0 ? fwd : -0.18 + Math.sin(ph) * arm);
  m.hR.position.set(hx - (side > 0 ? ct * 0.3 : 0), hy + idleR + Math.max(0, Math.sin(ph)) * 0.05 * mk + (side > 0 ? ct * 0.25 : 0), side > 0 ? fwd : -0.18 - Math.sin(ph) * arm);
  // weapon hand follows the blade: across the body on a slash, overhead on a mighty blow, out wide while spinning
  if (m.sword) {
    if (p.charge) { const kk = Math.max(0.35, m.chargeK || 0); m.hR.position.set(0.36, 1.0 - 0.06 * kk, -0.1 + 0.42 * kk); m.hL.position.set(-0.12, 1.02, -0.32 - 0.05 * kk); }
    else if (p.spinT > 0 || m.twirlT > 0) m.hR.position.set(0.62, 1.12, -0.12);
    else if (sw === 'slash') m.hR.position.set(0.5 - 0.75 * se, 1.08, -0.42 - 0.12 * arc);
    else if (sw === 'thrust') m.hR.position.set(0.24, 1.08, -0.3 - 0.55 * arc);
    else if (sw === 'cleave') { const wind = st < 0.3 ? st / 0.3 : 1, cut = st < 0.3 ? 0 : Math.min(1, (st - 0.3) / 0.22), ce = cut * cut * (3 - 2 * cut); const x = 0.5 * wind - 0.9 * ce, y = 1.0 + 0.45 * wind - 0.5 * ce, z = -0.1 - 0.15 * wind - 0.35 * ce; m.hR.position.set(x, y, z); m.hL.position.set(x - 0.14, y - 0.05, z + 0.05); }
  }
  if (m.sword) {
    if (sw === 'chop') { const up = st < 0.35 ? st / 0.35 : 0, cut = st < 0.35 ? 0 : Math.min(1, (st - 0.35) / 0.25); m.hR.position.set(0.18 - 0.06 * cut, 1.0 + 0.75 * up - 0.12 * cut + (cut > 0 ? 0.75 * (1 - cut) : 0), -0.25 + 0.15 * up - 0.4 * cut); }
    else if (sw === 'smash') { const up = st < 0.5 ? st / 0.5 : 0, slam = st < 0.5 ? 0 : Math.min(1, (st - 0.5) / 0.15); m.hR.position.set(0.12, 1.0 + 0.8 * up - 0.15 * slam, -0.2 + 0.2 * up - 0.45 * slam); }
    else if (sw === 'backhand') { const cut = st < 0.42 ? 0 : Math.min(1, (st - 0.42) / 0.25), ce = cut * cut * (3 - 2 * cut); m.hR.position.set(0.6 - 1.0 * ce, 1.1 - 0.1 * ce, -0.15 - 0.35 * ce); }
    else if (sw === 'throw') { const wind = st < 0.3 ? st / 0.3 : 0, rel = st < 0.3 ? 0 : Math.min(1, (st - 0.3) / 0.2); m.hR.position.set(0.45 - 0.2 * rel, 1.1 + 0.3 * wind, -0.2 + 0.4 * wind - 0.6 * rel); }
    else if (m.twoHand && !sw && !p.charge && !(p.spinT > 0) && !(m.twirlT > 0)) { const bob = Math.sin(m.t * 3) * 0.02 * (1 - mk); m.hR.position.set(0.24, 1.0 + bob, -0.3 - 0.06 * mk); }
    // two-handed weapons: the left hand stays on the grip, just below the right
    if (m.twoHand && !p.throwing) m.hL.position.set(m.hR.position.x - 0.13, m.hR.position.y - 0.07, m.hR.position.z + 0.05);
  }
  const g = 0.5 + ct * 1.1; m.gL.scale.set(g, g, g); m.gR.scale.set(g, g, g);
  if (m.sword) R.animateSword(m, p, dt);
  if (m.aL) {
    const pulse = 0.75 + Math.sin(m.t * 6) * 0.1 + ct * 0.6;
    m.aL.scale.set(pulse, pulse, pulse); m.aR.scale.set(pulse * 0.95, pulse * 0.95, pulse * 0.95);
    m.aL.material.rotation += dt * 2; m.aR.material.rotation -= dt * 2;
    if (!_q.w) _q.w = new THREE.Vector3();
    for (const hd of [m.hL, m.hR]) {
      if (R.vrand() < dt * (14 + ct * 40) && m.root.visible) { hd.getWorldPosition(_q.w); R.emit(_q.w.x + (R.vrand() - .5) * 0.12, _q.w.y, _q.w.z + (R.vrand() - .5) * 0.12, (R.vrand() - .5) * 0.6, 0.6 + R.vrand() * 0.8, (R.vrand() - .5) * 0.6, 0.45 + R.vrand() * 0.3, 0.18, 0.02, m.auraCol, 0.9, -0.5, 1.5); }
    }
  }
  // arms reach toward the hands
  if (m.arms) {
    if (!_q.a) { _q.a = new THREE.Vector3(); _q.b = new THREE.Vector3(0, -1, 0); _q.up = new THREE.Vector3(); }
    for (const arm of m.arms) {
      const hand = arm.s < 0 ? m.hL : m.hR;
      if (arm.fore) { R.armIK(arm, hand.position); continue; }
      _q.a.set(hand.position.x - arm.piv.position.x, hand.position.y - arm.piv.position.y, hand.position.z - arm.piv.position.z);
      const len = Math.max(0.3, _q.a.length() - 0.08); _q.a.normalize();
      arm.piv.quaternion.setFromUnitVectors(_q.b, _q.a);
      arm.sleeve.scale.y = len * 0.75; arm.sleeve.position.y = -len * 0.375;
      arm.bracer.position.y = -len * 0.86; arm.wrap.position.y = -len * 0.86;
    }
  }
  // book orbit
  const ba = m.t * 0.9; m.book.position.set(Math.cos(ba) * 0.75, 1.95 + Math.sin(m.t * 2) * 0.1, Math.sin(ba) * 0.75);
  m.book.rotation.y = -ba;
  m.sig.rotation.z += dt * 0.6; m.sig.material.opacity = 0.35 + (p.iframes > 0 ? 0.4 : 0) + Math.sin(m.t * 4) * 0.08;
  if (m.bGlow) { const bs = 0.35 + ct * 0.5 + Math.sin(m.t * 3) * 0.04; m.bGlow.scale.set(bs, bs, bs); }
  m.ward.visible = !!(p.ward && p.ward.t > 0); if (m.ward.visible) { m.ward.rotation.y += dt; m.ward.material.opacity = 0.25 + 0.2 * (p.ward.hp / p.ward.max); }
  m.bastion.visible = p.bastionT > 0; if (m.bastion.visible) m.bastion.rotation.y -= dt * 0.7;
  m.mirror.visible = p.mirrorT > 0; if (m.mirror.visible) { m.mirror.rotation.z += dt * 6; m.mirror.scale.setScalar(1 + Math.sin(m.t * 20) * 0.04); }
  const hurt = p.hurtT > 0;
  m.cloth.emissive && m.cloth.emissive.setHex(hurt ? 0x661020 : 0x000000);
  m.root.visible = !(p.invulnBlink > 0 && Math.floor(m.t * 20) % 2 === 0);
  m.light.intensity = 1.0 + ct * 2;
  if (!m.glb && m.kind === 'knight' && H.models && H.models.has('knight')) R.attachHeroGLB(m);   // the .glb finished loading after this hero was built
  if (m.anim && H.models) R.animateHeroGLB(m, p, dt, moving, speed);
  // energy arc along the blade during the cutting phase of each swing (after the arm and sword are posed)
  if (R.trail) R.trail.update(m, p, dt);
  // Theron's painted slash: fires on the same cutting phase and replaces the ribbon on the swings it covers
  if (R.slashFx) R.slashFx.update(m, p, dt);
  // Theron's painted dash trail (js/dashfx.js)
  if (R.dashFx) R.dashFx.update(m, p, dt);
};
/* ---- Hero .glb (the Veteran as Theron): the procedural rig keeps running unseen and still drives the sword hand;
   the model plays its clips and its arm reaches for that hand with IK, so the swing paths stay the game's own. */
R.SWING_RATE = { cleave: 2.6, smash: 2.2, throw: 3.2, backhand: 2.4, chop: 4.0 };
R.swingRate = m => m.swingRate || R.SWING_RATE[m.swing] || 3.6;
R.attachHeroGLB = function (m) {
  if (m.glb || !H.models || !H.models.has('knight')) return;
  const inst = H.models.acquire('knight'); if (!inst) return;
  m.body.add(inst.obj); m.glb = inst; m.glbInst = inst; m.anim = inst.anim; m.heroGLB = true;
  const cfg = H.models.cfg('knight') || {}, ik = cfg.armIK || {};
  m.ik = {}; for (const side of ['R', 'L']) { const names = ik[side]; const bones = names && names.map(n => inst.obj.getObjectByName(n)); if (bones && bones.every(Boolean)) m.ik[side] = bones; }
  m.gripR = inst.obj.getObjectByName('hand_R'); m.gripL = inst.obj.getObjectByName('hand_L');
  R.hideProcedural(m);
};
// hide the procedural body (it keeps animating, unseen); the model and the held weapon stay
R.hideProcedural = function (m) {
  if (!m.heroGLB) return;
  const keep = new Set(); m.glb.obj.traverse(o => keep.add(o)); for (const g of m.gearObjs || []) g.traverse(o => keep.add(o));
  m.body.traverse(o => { if (o.isMesh && !keep.has(o) && o !== m.hL && o !== m.hR) o.visible = false; });
  for (const s of [m.gL, m.gR]) if (s) s.visible = false;
};
R.animateHeroGLB = function (m, p, dt, moving, speed) {
  const A = m.anim, P = H.models.play, dur = k => (A.actions[k] ? A.actions[k].getClip().duration : 1);
  let clip, restart = false, rate = 1;
  const sw = m.swingT > 0 && m.swing && A.actions[m.swing] ? m.swing : (m.twirlT > 0 && A.actions.slash ? 'slash' : null);
  const swingKey = sw && (m.twirlT > 0 ? 'tw' + m._twirlN : 'sw' + m._swingN);
  const dashing = p.dashT > 0; if (dashing && !m._glbDash) restart = true; m._glbDash = dashing;
  if (p.dead || p.downed) clip = 'death';
  else if (p.hurtT > 0) clip = 'hurt';
  else if (dashing) { clip = 'dash'; rate = dur('dash') / 0.36; }
  else if (sw) { clip = sw; if (swingKey !== m._glbSwing) { restart = true; m._glbSwing = swingKey; } rate = dur(sw) * (m.twirlT > 0 ? 1 / 0.26 : R.swingRate(m)); }
  else if (p.callT > 0) { clip = 'cast'; if (!m._glbCall) restart = true; rate = dur('cast') / 3; }
  else if (moving) { clip = 'run'; const cfg = H.models.cfg('knight') || {}; rate = H.clamp(speed / (cfg.runSpeed || (H.MOVE && H.MOVE.speed) || 7.2), 0.6, 1.75); }
  else clip = H.G && H.G.enemies && H.G.enemies.some(e => !e.dead && e.spawnK >= 1) ? 'idle' : 'calm';
  m._glbCall = p.callT > 0;
  P(A, clip, 0.12, restart, rate); A.mixer.update(dt);
  // running with nothing else going on: the sword stays in front, point forward, bobbing with the stride
  if (clip === 'run' && m.sword && !(m.chargeK > 0) && !p.charge && !(p.spinT > 0)) {
    const act = A.actions.run, ph = act ? (act.time / act.getClip().duration) * Math.PI * 4 : 0, k = H.clamp(speed / 3, 0, 1);
    const hx = m.twoHand ? 0.16 : 0.27, hy = 1.0 + Math.sin(ph) * 0.03, hz = -0.42 - Math.cos(ph) * 0.03;
    m.hR.position.x += (hx - m.hR.position.x) * k; m.hR.position.y += (hy - m.hR.position.y) * k; m.hR.position.z += (hz - m.hR.position.z) * k;
    const inner = m.sword.userData.inner; inner.rotation.x += (-1.42 - inner.rotation.x) * k; m.sword.rotation.y += (0.22 - m.sword.rotation.y) * k; m.sword.rotation.x += (-0.08 - m.sword.rotation.x) * k;
    if (m.twoHand) m.hL.position.set(m.hR.position.x - 0.13, m.hR.position.y - 0.07, m.hR.position.z + 0.05);
  }
  // arms: reach for the procedural hands (the sword hand always; the other one on two-handed weapons)
  m.root.updateMatrixWorld(true);
  if (m.sword) R.heroArmIK(m, 'R');
  if (m.twoHand && !p.throwing) R.heroArmIK(m, 'L');
};
// two-bone IK in world space: rotate upper arm and forearm so the grip lands on the procedural hand
R.heroArmIK = function (m, side) {
  const bones = m.ik && m.ik[side]; if (!bones) return; const [up, low, hand] = bones, tgt = side === 'R' ? m.hR : m.hL, grip = side === 'R' ? m.gripR : m.gripL;
  const THREE = T3(); const v = R._hik || (R._hik = { S: new THREE.Vector3(), E: new THREE.Vector3(), W: new THREE.Vector3(), T: new THREE.Vector3(), G: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), bq: new THREE.Quaternion(), pq: new THREE.Quaternion() });
  up.getWorldPosition(v.S); low.getWorldPosition(v.E); hand.getWorldPosition(v.W); tgt.getWorldPosition(v.T);
  if (grip) { grip.getWorldPosition(v.G); v.T.sub(v.G.sub(v.W)); }   // aim the wrist so the grip (not the wrist) meets the hand
  const a = v.S.distanceTo(v.E), b = v.E.distanceTo(v.W); if (a < 1e-4 || b < 1e-4) return;
  v.d.subVectors(v.T, v.S); const dist = H.clamp(v.d.length(), 0.05, a + b - 0.002); v.d.normalize();
  const s = side === 'R' ? 1 : -1; v.p.set(s * 0.9, -0.35, 0.55).transformDirection(m.body.matrixWorld); v.p.addScaledVector(v.d, -v.p.dot(v.d)); if (v.p.lengthSq() < 1e-6) v.p.set(0, -1, 0); v.p.normalize();
  const x = (a * a - b * b + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, a * a - x * x));
  v.e.copy(v.S).addScaledVector(v.d, x).addScaledVector(v.p, h);
  const turn = (bone, from, to) => { v.q.setFromUnitVectors(from.normalize(), to.normalize()); bone.getWorldQuaternion(v.bq); bone.parent.getWorldQuaternion(v.pq); v.bq.premultiply(v.q); bone.quaternion.copy(v.pq.invert().multiply(v.bq)); bone.updateMatrixWorld(true); };
  turn(up, v.a.subVectors(v.E, v.S), v.b.subVectors(v.e, v.S));
  low.getWorldPosition(v.E); hand.getWorldPosition(v.W); v.T.copy(v.d).multiplyScalar(dist).add(v.S);
  turn(low, v.a.subVectors(v.W, v.E), v.b.subVectors(v.T, v.E));
};
/* Two-bone arm: shoulder (upper.position) → elbow → hand target, elbow pushed out and back. All in body space. */
R.armIK = function (arm, target) {
  const THREE = T3(); const q = R._ik || (R._ik = { d: new THREE.Vector3(), pole: new THREE.Vector3(), e: new THREE.Vector3(), u: new THREE.Vector3(), down: new THREE.Vector3(0, -1, 0) });
  const S = arm.upper.position, a = arm.UA, b = arm.FA;
  q.d.subVectors(target, S); let d = q.d.length(); q.d.normalize();
  const reach = Math.min(d, a + b - 0.002), x = (a * a - b * b + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, a * a - x * x));
  q.pole.set(arm.s * 0.9, -0.35, 0.55); q.pole.addScaledVector(q.d, -q.pole.dot(q.d)); if (q.pole.lengthSq() < 1e-6) q.pole.set(arm.s, 0, 0); q.pole.normalize();
  q.e.copy(S).addScaledVector(q.d, x).addScaledVector(q.pole, h);
  q.u.subVectors(q.e, S).normalize(); arm.upper.quaternion.setFromUnitVectors(q.down, q.u);
  arm.fore.position.copy(q.e); q.u.subVectors(target, q.e); const fl = q.u.length(); q.u.normalize(); arm.fore.quaternion.setFromUnitVectors(q.down, q.u);
  arm.fore.scale.y = Math.max(0.85, Math.min(1.25, fl / b));
};
R.setRogueElement = function (m, el) {
  const c = H.EL[el] ? H.EL[el].color : m.accent;
  if (m.bGlow) m.bGlow.material.color.setHex(c);
  if (m.aL) { m.aL.material.color.setHex(c); m.aR.material.color.setHex(c); m.auraCol = c; }
  m.hL.material.color.setHex(c); m.hR.material.color.setHex(c); m.gL.material.color.setHex(c); m.gR.material.color.setHex(c); m.light.color.setHex(c);
};

/* Enemy models */
R.makeEnemy = function (type, elite) {
  const THREE = T3();
  const def = H.ENEMIES[type];
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const flesh = R.std(def.color, { roughness: 0.8 }); const dark = R.std(0x15111a); const mats = [flesh, dark];
  const eye = R.basic(0xff2e55); const parts = {};
  const S = elite ? 1.3 : 1;
  const glbInst = H.models && H.models.acquire ? H.models.acquire(type) : null;
  if (glbInst) {
    // external .glb (public/models/), animated with an AnimationMixer; returned to the pool on release
    body.add(glbInst.obj); parts.glb = glbInst.obj; parts.anim = glbInst.anim; glbInst.mats.forEach(mm => mats.push(mm));
  } else if (type === 'husk') {
    const torso = part(new THREE.BoxGeometry(0.75, 0.9, 0.55), flesh, 0, 1.0, 0.05, body); torso.rotation.x = -0.45;
    part(new THREE.SphereGeometry(0.26, 7, 5), flesh, 0, 1.45, -0.32, body);
    part(new THREE.BoxGeometry(0.28, 0.06, 0.05), eye, 0, 1.47, -0.56, body);
    parts.aL = part(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 5), flesh, -0.48, 0.75, -0.25, body); parts.aR = part(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 5), flesh, 0.48, 0.75, -0.25, body);
    part(new THREE.CylinderGeometry(0.12, 0.1, 0.6, 5), dark, -0.2, 0.3, 0, body); part(new THREE.CylinderGeometry(0.12, 0.1, 0.6, 5), dark, 0.2, 0.3, 0, body);
    const chain = part(new THREE.TorusGeometry(0.42, 0.04, 4, 10), R.std(0x55504a, { metalness: .8, roughness: .3 }), 0, 1.1, 0, body); chain.rotation.x = 1.2;
  } else if (type === 'spitter') {
    parts.sac = part(new THREE.SphereGeometry(0.62, 9, 7), flesh, 0, 0.95, 0, body);
    part(new THREE.TorusGeometry(0.2, 0.08, 5, 10), R.basic(0xc6ff4a), 0, 1.0, -0.6, body);
    const glow = R.glowSprite(0xc6ff4a, 0.9); glow.position.set(0, 1.0, -0.62); body.add(glow); parts.mouth = glow;
    for (let i = 0; i < 4; i++) { const l = part(new THREE.ConeGeometry(0.1, 0.6, 4), dark, Math.cos(i * 1.57 + .78) * 0.45, 0.25, Math.sin(i * 1.57 + .78) * 0.45, body); l.rotation.z = Math.cos(i * 1.57 + .78) * 0.5; l.rotation.x = -Math.sin(i * 1.57 + .78) * 0.5; }
    part(new THREE.SphereGeometry(0.07, 5, 4), eye, -0.2, 1.35, -0.48, body); part(new THREE.SphereGeometry(0.07, 5, 4), eye, 0.2, 1.35, -0.48, body);
  } else if (type === 'wisp') {
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff4d7a }); mats.push(coreMat);
    parts.core = part(new THREE.IcosahedronGeometry(0.3, 0), coreMat, 0, 1.1, 0, body);
    parts.shell = part(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xff2e55, wireframe: true }), 0, 1.1, 0, body);
    const g = R.glowSprite(0xff2e55, 1.8); g.position.y = 1.1; body.add(g); parts.glow = g;
  } else if (type === 'hexcaster') {
    part(new THREE.ConeGeometry(0.5, 1.7, 7), flesh, 0, 0.85, 0, body);
    part(new THREE.BoxGeometry(0.34, 0.42, 0.24), R.std(0xd8ccb0), 0, 1.8, -0.05, body);
    part(new THREE.SphereGeometry(0.06, 5, 4), eye, 0, 1.85, -0.18, body);
    parts.halo = part(new THREE.TorusGeometry(0.45, 0.04, 4, 20), R.basic(0xb36bff), 0, 2.35, 0, body); parts.halo.rotation.x = Math.PI / 2;
    parts.hL = part(new THREE.SphereGeometry(0.1, 6, 4), R.basic(0xb36bff), -0.5, 1.2, -0.25, body); parts.hR = part(new THREE.SphereGeometry(0.1, 6, 4), R.basic(0xb36bff), 0.5, 1.2, -0.25, body);
  } else if (type === 'shieldbearer') {
    part(new THREE.CylinderGeometry(0.45, 0.55, 1.3, 7), flesh, 0, 0.8, 0.15, body);
    part(new THREE.BoxGeometry(0.5, 0.5, 0.5), R.std(0x55504a, { metalness: .7, roughness: .35 }), 0, 1.7, 0.15, body);
    part(new THREE.BoxGeometry(0.36, 0.05, 0.05), eye, 0, 1.72, -0.11, body);
    parts.shield = part(new THREE.BoxGeometry(1.5, 1.7, 0.2), R.std(0x5d5348, { metalness: 0.5, roughness: 0.5 }), 0, 0.95, -0.6, body);
    for (let i = 0; i < 4; i++) part(new THREE.SphereGeometry(0.07, 4, 3), R.std(0xd9a441, { metalness: .8 }), (i % 2 - 0.5) * 1.1, 0.95 + (i < 2 ? .6 : -.6), -0.72, body);
    const rune = part(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: R.texRune, color: 0xff2e55, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.95, -0.72, body); rune.rotation.y = Math.PI;
  } else if (type === 'brute') {
    part(new THREE.BoxGeometry(1.5, 1.5, 1.1), flesh, 0, 1.25, 0, body).rotation.x = -0.2;
    part(new THREE.BoxGeometry(0.7, 0.6, 0.6), flesh, 0, 2.05, -0.45, body);
    part(new THREE.ConeGeometry(0.15, 0.6, 5), R.std(0xe8dcc0), -0.4, 2.4, -0.45, body).rotation.z = 0.5;
    part(new THREE.ConeGeometry(0.15, 0.6, 5), R.std(0xe8dcc0), 0.4, 2.4, -0.45, body).rotation.z = -0.5;
    part(new THREE.BoxGeometry(0.4, 0.08, 0.05), eye, 0, 2.1, -0.76, body);
    parts.aL = part(new THREE.CylinderGeometry(0.22, 0.28, 1.3, 6), flesh, -0.95, 1.0, -0.1, body); parts.aR = part(new THREE.CylinderGeometry(0.22, 0.28, 1.3, 6), flesh, 0.95, 1.0, -0.1, body);
    part(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 6), dark, -0.4, 0.35, 0, body); part(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 6), dark, 0.4, 0.35, 0, body);
  } else if (type === 'summoner') {
    part(new THREE.ConeGeometry(0.55, 1.6, 8), R.std(0x2a2430), 0, 1.0, 0, body);
    part(new THREE.SphereGeometry(0.28, 8, 6), R.std(0xd8c58e), 0, 1.95, 0, body);
    part(new THREE.ConeGeometry(0.38, 0.7, 8), flesh, 0, 2.25, 0, body);
    parts.candles = [];
    for (let i = 0; i < 3; i++) { const c = new THREE.Group(); part(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 5), R.std(0xe8dcc0), 0, 0, 0, c); const f = R.glowSprite(0xff9a52, 0.5); f.position.y = 0.28; c.add(f); body.add(c); parts.candles.push(c); }
  } else if (type === 'dummy' || type === 'turret') {
    part(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 5), R.std(0x4a3524), 0, 0.9, 0, body);
    part(new THREE.SphereGeometry(0.45, 7, 6), R.std(0xb39a60), 0, 1.3, 0, body);
    part(new THREE.BoxGeometry(1.2, 0.12, 0.12), R.std(0x4a3524), 0, 1.25, 0, body);
    if (type === 'turret') { part(new THREE.CylinderGeometry(0.3, 0.2, 0.3, 6), R.std(0x3a2a20), 0, 1.85, 0, body); const g = R.glowSprite(0xff2e55, 0.9); g.position.y = 2.0; body.add(g); }
  } else if (type === 'bone_stalker') {
    // prototype: a low, four-legged skeleton hound — skull, spine, ribcage, bone legs and a tail
    const bone = R.std(0xd9cfb8, { roughness: 0.7, flatShading: false }), boneD = R.std(0xa89c84, { roughness: 0.8, flatShading: false }); mats.push(bone, boneD);
    const glowE = R.basic(0xff3a4a);
    const spine = new THREE.Group(); spine.position.y = 0.85; body.add(spine); parts.spine = spine;
    for (let i = 0; i < 7; i++) { const v = part(new THREE.SphereGeometry(0.09 - i * 0.004, 10, 8), bone, 0, Math.sin(i * 0.5) * 0.04, -0.45 + i * 0.15, spine); v.scale.set(1, 0.8, 1.1); part(new THREE.ConeGeometry(0.035, 0.14, 6), boneD, 0, 0.1, -0.45 + i * 0.15, spine); }
    for (let i = 0; i < 5; i++) { for (const sx of [-1, 1]) { const rib = part(new THREE.TorusGeometry(0.2 - i * 0.015, 0.022, 6, 14, Math.PI * 0.9), bone, sx * 0.02, -0.03, -0.35 + i * 0.11, spine); rib.rotation.set(0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI / 2 + 0.15); } }
    part(new THREE.SphereGeometry(0.16, 12, 10), bone, 0, -0.02, 0.6, spine).scale.set(1.3, 0.8, 0.9);    // pelvis
    const head = new THREE.Group(); head.position.set(0, 0.12, -0.72); spine.add(head); parts.head = head;
    part(new THREE.SphereGeometry(0.2, 16, 12), bone, 0, 0.04, 0, head).scale.set(0.95, 0.85, 1.1);
    const snout = part(new THREE.CylinderGeometry(0.08, 0.12, 0.32, 10), bone, 0, -0.03, -0.25, head); snout.rotation.x = Math.PI / 2;
    const jaw = part(new THREE.BoxGeometry(0.16, 0.05, 0.3), boneD, 0, -0.14, -0.18, head); parts.jaw = jaw;
    for (let k = 0; k < 4; k++) part(new THREE.ConeGeometry(0.018, 0.07, 4), bone, -0.06 + k * 0.04, -0.1, -0.33, head).rotation.x = Math.PI;
    for (const sx of [-1, 1]) { const so = part(new THREE.SphereGeometry(0.055, 10, 8), R.basic(0x0a0608), sx * 0.08, 0.07, -0.15, head); so.scale.z = 0.5; part(new THREE.SphereGeometry(0.028, 8, 6), glowE, sx * 0.08, 0.07, -0.18, head); const horn = part(new THREE.ConeGeometry(0.04, 0.24, 8), boneD, sx * 0.12, 0.2, 0.05, head); horn.rotation.set(0.6, 0, sx * -0.4); }
    const eg = R.glowSprite(0xff2e55, 0.6); eg.position.set(0, 0.07, -0.2); head.add(eg);
    parts.legs = [];
    for (const [lx, lz] of [[-0.18, -0.35], [0.18, -0.35], [-0.18, 0.45], [0.18, 0.45]]) {
      const hip = new THREE.Group(); hip.position.set(lx, 0, lz); spine.add(hip);
      part(new THREE.SphereGeometry(0.06, 8, 6), boneD, 0, 0, 0, hip);
      const up = part(new THREE.CylinderGeometry(0.035, 0.03, 0.45, 8), bone, 0, -0.2, -0.05, hip); up.rotation.x = 0.25;
      const knee = new THREE.Group(); knee.position.set(0, -0.42, -0.1); hip.add(knee); part(new THREE.SphereGeometry(0.045, 8, 6), boneD, 0, 0, 0, knee);
      const low = part(new THREE.CylinderGeometry(0.028, 0.02, 0.42, 8), bone, 0, -0.2, 0.06, knee); low.rotation.x = -0.35;
      for (let c = -1; c <= 1; c++) { const cl = part(new THREE.ConeGeometry(0.018, 0.1, 5), boneD, c * 0.03, -0.42, 0.0, knee); cl.rotation.x = -Math.PI / 2; }
      parts.legs.push({ hip, knee, ph: (lx < 0 ? 0 : Math.PI) + (lz > 0 ? Math.PI : 0) });
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.02, 0.7); spine.add(tail); parts.tail = [];
    let tp = tail; for (let i = 0; i < 6; i++) { const seg = new THREE.Group(); seg.position.z = i ? 0.11 : 0; tp.add(seg); part(new THREE.SphereGeometry(0.045 - i * 0.005, 8, 6), bone, 0, 0, 0, seg); parts.tail.push(seg); tp = seg; }
  } else if (type === 'regent_echo') {
    const m = R.std(def.color, { transparent: true, opacity: 0.6, emissive: 0x2a2060 }); mats.push(m);
    part(new THREE.ConeGeometry(0.7, 2.0, 7), m, 0, 1.1, 0, body);
    part(new THREE.SphereGeometry(0.36, 8, 6), R.basic(0x05040a), 0, 2.3, 0, body);
    for (let i = 0; i < 5; i++) part(new THREE.ConeGeometry(0.06, 0.35, 4), R.basic(0x6ff0e0), Math.cos(i / 5 * 6.28) * 0.36, 2.75, Math.sin(i / 5 * 6.28) * 0.36, body);
  }
  body.scale.setScalar(S);
  // hostile ground marker
  const ringC = elite ? 0xf0bd4f : 0xff2e55;
  const mark = new THREE.Mesh(new THREE.RingGeometry(def.r * S * 0.95, def.r * S * 1.15, 24), new THREE.MeshBasicMaterial({ color: ringC, transparent: true, opacity: 0.7, depthWrite: false })); mark.rotation.x = -Math.PI / 2; mark.position.y = 0.045; root.add(mark);
  // the ring and the contact shadow of every enemy are drawn together, two draw calls for all of them
  // (R.updateGroundMarks); the ring mesh stays as the on/off switch the game already uses
  mark.material.visible = false; root.userData.ground = { r: def.r * S, c: ringC };
  if (elite) { const crown = new THREE.Group(); for (let i = 0; i < 5; i++) { const c = part(new THREE.ConeGeometry(0.07, 0.3, 4), R.basic(0xf0bd4f), Math.cos(i / 5 * 6.28) * 0.3, 0, Math.sin(i / 5 * 6.28) * 0.3, crown); } crown.position.y = (type === 'brute' ? 3.4 : 2.7); root.add(crown); parts.crown = crown; }
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(def.r * S * 1.5, 0), new THREE.MeshStandardMaterial({ color: 0xbff6ff, emissive: 0x3aa8d8, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, flatShading: true })); ice.position.y = def.r * S * 1.2; ice.visible = false; root.add(ice);
  for (const mm of mats) mm.userData.em = mm.emissive ? mm.emissive.getHex() : 0;
  R.ents.add(root);
  return { root, body, parts, mats, mark, ice, anim: parts.anim || null, glbInst, t: Math.random() * 10, flashT: 0, type };
};
R.makeBoss = function (type) {
  const THREE = T3();
  const def = H.ENEMIES[type];
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const flesh = R.std(def.color, { roughness: 0.75 }); const dark = R.std(0x120e16); const mats = [flesh, dark]; const parts = {};
  const metal = R.std(0x4c4640, { metalness: 0.8, roughness: 0.35 });
  if (type === 'gaolwright') {
    part(new THREE.BoxGeometry(2.2, 2.3, 1.6), flesh, 0, 1.9, 0, body).rotation.x = -0.25;
    part(new THREE.BoxGeometry(2.6, 0.5, 1.9), metal, 0, 2.9, 0.1, body);
    const head = new THREE.Group(); head.position.set(0, 3.5, -0.55); body.add(head);
    part(new THREE.SphereGeometry(0.55, 8, 6), dark, 0, 0, 0, head);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 4), metal, Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, head); }
    part(new THREE.TorusGeometry(0.62, 0.05, 4, 16), metal, 0, 0.7, 0, head).rotation.x = Math.PI / 2;
    part(new THREE.SphereGeometry(0.1, 5, 4), R.basic(0xff2e55), -0.18, 0.05, -0.5, head); part(new THREE.SphereGeometry(0.1, 5, 4), R.basic(0xff2e55), 0.18, 0.05, -0.5, head);
    parts.aL = part(new THREE.CylinderGeometry(0.3, 0.4, 2.0, 6), flesh, -1.4, 1.8, -0.2, body); parts.aR = part(new THREE.CylinderGeometry(0.3, 0.4, 2.0, 6), flesh, 1.4, 1.8, -0.2, body);
    parts.chain = new THREE.Group(); body.add(parts.chain);
    for (let i = 0; i < 9; i++) { const l = part(new THREE.TorusGeometry(0.22, 0.07, 4, 8), metal, 0, 0, -i * 0.38, parts.chain); l.rotation.y = i % 2 ? Math.PI / 2 : 0; }
    const ball = part(new THREE.DodecahedronGeometry(0.55, 0), metal, 0, 0, -3.6, parts.chain);
    parts.chain.position.set(1.5, 0.9, -0.3);
    for (let i = 0; i < 5; i++) part(new THREE.TorusGeometry(0.16, 0.035, 4, 8), R.std(0xd9a441, { metalness: .9, roughness: .3 }), -0.8 + i * 0.35, 1.0, -0.8, body).rotation.y = 0.3 * i;
    part(new THREE.CylinderGeometry(0.55, 0.6, 1.0, 6), dark, -0.6, 0.5, 0, body); part(new THREE.CylinderGeometry(0.55, 0.6, 1.0, 6), dark, 0.6, 0.5, 0, body);
    const g = R.glowSprite(0xff2e55, 3); g.position.set(0, 3.5, -0.6); body.add(g);
  } else if (type === 'kiln_saint') {
    part(new THREE.ConeGeometry(1.5, 3.6, 9), flesh, 0, 1.8, 0, body);
    const lava = new THREE.MeshBasicMaterial({ color: 0xff7a2e }); mats.push(lava);
    for (let i = 0; i < 6; i++) { const c = part(new THREE.BoxGeometry(0.08, 1.6, 0.08), lava, Math.cos(i) * 0.95, 1.2, Math.sin(i) * 0.95, body); c.rotation.z = (Math.random() - .5) * 0.6; }
    part(new THREE.SphereGeometry(0.5, 8, 6), R.std(0x1a0e0a), 0, 3.85, 0, body);
    part(new THREE.ConeGeometry(0.55, 0.9, 8, 1, true), flesh, 0, 4.1, 0.05, body);
    parts.halo = part(new THREE.TorusGeometry(1.1, 0.1, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffa040 }), 0, 4.0, 0.5, body);
    const hg = R.glowSprite(0xff7a2e, 4.5); hg.position.set(0, 4, 0.5); body.add(hg); parts.haloGlow = hg;
    parts.aL = part(new THREE.CylinderGeometry(0.15, 0.25, 2.2, 6), flesh, -1.4, 2.8, -0.2, body); parts.aL.rotation.z = 1.0;
    parts.aR = part(new THREE.CylinderGeometry(0.15, 0.25, 2.2, 6), flesh, 1.4, 2.8, -0.2, body); parts.aR.rotation.z = -1.0;
    const fL = R.glowSprite(0xff9a52, 1.4); fL.position.set(-2.3, 3.4, -0.2); body.add(fL); const fR = R.glowSprite(0xff9a52, 1.4); fR.position.set(2.3, 3.4, -0.2); body.add(fR);
    part(new THREE.SphereGeometry(0.08, 5, 4), R.basic(0xffe0a0), -0.16, 3.9, -0.45, body); part(new THREE.SphereGeometry(0.08, 5, 4), R.basic(0xffe0a0), 0.16, 3.9, -0.45, body);
  } else if (type === 'hollow_regent') {
    const cape = R.std(def.color, { roughness: 0.6, side: THREE.DoubleSide }); mats.push(cape);
    part(new THREE.ConeGeometry(1.3, 3.4, 8, 1, true), cape, 0, 2.0, 0, body);
    part(new THREE.CylinderGeometry(0.5, 0.7, 1.4, 8), dark, 0, 3.1, 0, body);
    const voidHead = part(new THREE.SphereGeometry(0.55, 12, 9), R.basic(0x020205), 0, 4.2, 0, body);
    const rim = part(new THREE.TorusGeometry(0.58, 0.04, 6, 30), R.basic(0x6ff0e0), 0, 4.2, 0, body); rim.rotation.y = Math.PI / 2; parts.rim = rim;
    parts.crown = new THREE.Group(); parts.crown.position.y = 5.1; body.add(parts.crown);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; part(new THREE.ConeGeometry(0.09, 0.6, 4), R.std(0xd9a441, { metalness: 0.9, roughness: 0.2, emissive: 0x6a4410 }), Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55, parts.crown); }
    part(new THREE.TorusGeometry(0.55, 0.05, 4, 20), R.std(0xd9a441, { metalness: .9, roughness: .2 }), 0, -0.25, 0, parts.crown).rotation.x = Math.PI / 2;
    parts.shards = [];
    for (let i = 0; i < 6; i++) { const s = part(new THREE.OctahedronGeometry(0.25, 0), R.std(0x2a2a40, { emissive: 0x3a2a80, emissiveIntensity: 1 }), 0, 0, 0, body); parts.shards.push(s); }
    const g = R.glowSprite(0x6ff0e0, 3.5); g.position.set(0, 4.2, 0); body.add(g);
  }
  const mark = new THREE.Mesh(new THREE.RingGeometry(def.r * 0.95, def.r * 1.12, 40), new THREE.MeshBasicMaterial({ color: 0xff2e55, transparent: true, opacity: 0.8, depthWrite: false })); mark.rotation.x = -Math.PI / 2; mark.position.y = 0.045; root.add(mark);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(def.r * 1.1, 24), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; root.add(shadow);
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(def.r * 1.6, 0), new THREE.MeshStandardMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.4, flatShading: true })); ice.position.y = 2; ice.visible = false; root.add(ice);
  for (const mm of mats) mm.userData.em = mm.emissive ? mm.emissive.getHex() : 0;
  R.ents.add(root);
  return { root, body, parts, mats, mark, ice, t: 0, flashT: 0, type, boss: true };
};
R.animateEnemy = function (m, e, dt) {
  m.t += dt; const t = m.t;
  m.root.position.set(e.x, e.fallY || 0, e.z);
  m.body.rotation.y = e.faceAng;
  const moving = Math.hypot(e.vx, e.vz) > 0.4 && !e.stunT && !e.frozenT;
  const P = m.parts; const wind = e.windupK || 0;
  const typ = m.type;
  if (m.anim) {
    // .glb: pick a clip from the AI state (windup from the telegraph, attack/hit as one-shots), then advance the mixer
    if (e.animEvt) { m.oneShot = e.animEvt; m.oneShotT = e.animEvt === 'attack' ? 0.6 : 99; e.animEvt = null; }
    if (m.flashT > 0.06 && !e.dead && !m.oneShot) { m.oneShot = 'hit'; m.oneShotT = 0.3; }
    // types without explicit events: the AI state drives it (windup while telegraphing, attack as it ends)
    const st = e.ai ? e.ai.state : null;
    if (m._aiSt === 'windup' && st !== 'windup' && !e.dead && !m.oneShot) { m.oneShot = 'attack'; m.oneShotT = 0.6; }
    m._aiSt = st;
    if (m.oneShot) { m.oneShotT -= dt; if (m.oneShotT <= 0 || (m.oneShot === 'windup' && st !== 'windup')) m.oneShot = null; }
    const clip = e.dead ? 'death' : m.oneShot || (st === 'windup' ? 'windup' : moving ? 'run' : 'idle');
    H.models.play(m.anim, clip); m.anim.mixer.update(dt);
  } else if (typ === 'husk' || typ === 'brute') {
    const sw = moving ? Math.sin(t * 9) * 0.4 : 0;
    if (P.aL) { P.aL.rotation.x = sw - wind * 1.4; P.aR.rotation.x = -sw - wind * 1.4; }
    m.body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.08 : 0;
    m.body.rotation.x = wind * -0.3;
  } else if (typ === 'spitter') { const s = 1 + Math.sin(t * 4) * 0.04 + wind * 0.25; P.sac.scale.set(s, 1 + (s - 1) * 1.4, s); P.mouth.scale.setScalar(0.9 + wind * 1.6); }
  else if (typ === 'wisp') { P.core.rotation.y += dt * 4; P.shell.rotation.x += dt * 2; P.shell.rotation.y -= dt * 3; const s = 1 + wind * 0.8 + Math.sin(t * 30) * wind * 0.2; P.shell.scale.setScalar(s); P.glow.scale.setScalar(1.8 + wind * 2); m.body.position.y = Math.sin(t * 3) * 0.15; if (R.vrand() < dt * 20) R.emit(e.x, 1.1, e.z, 0, 0.3, 0, 0.4, 0.3, 0, 0xff2e55, 0.8, -1, 1); }
  else if (typ === 'hexcaster') { P.halo.rotation.z += dt * (1 + wind * 8); P.halo.scale.setScalar(1 + wind * 0.6); m.body.position.y = 0.1 + Math.sin(t * 2) * 0.08; P.hL.position.y = 1.2 + wind * 0.8; P.hR.position.y = 1.2 + wind * 0.8; }
  else if (typ === 'shieldbearer') { P.shield.position.z = -0.6 - wind * 0.5; m.body.position.y = moving ? Math.abs(Math.sin(t * 7)) * 0.05 : 0; P.shield.rotation.x = (e.shieldDown ? 0.9 : 0); }
  else if (typ === 'summoner') { m.body.position.y = 0.3 + Math.sin(t * 2) * 0.15; P.candles.forEach((c, i) => { const a = t * (1 + wind * 3) + i * 2.09; c.position.set(Math.cos(a) * 1.0, 1.6 + Math.sin(t * 3 + i) * 0.2, Math.sin(a) * 1.0); }); }
  else if (typ === 'regent_echo') { m.body.position.y = 0.3 + Math.sin(t * 2) * 0.2; }
  else if (typ === 'bone_stalker') {
    // prototype: trotting gait, crouch while winding up, a short leap squash after the pounce
    if (e.animEvt === 'attack') { m.leapT = 0.35; e.animEvt = null; } else if (e.animEvt) e.animEvt = null;
    m.leapT = Math.max(0, (m.leapT || 0) - dt);
    const run = moving ? 1 : 0, f = t * 14;
    P.legs.forEach(l => { const s = Math.sin(f + l.ph) * 0.55 * run; l.hip.rotation.x = s - wind * 0.5; l.knee.rotation.x = Math.max(0, -Math.sin(f + l.ph)) * 0.8 * run + wind * 0.9; });
    P.spine.position.y = 0.85 - wind * 0.3 + (run ? Math.abs(Math.sin(f)) * 0.05 : Math.sin(t * 2) * 0.015) + Math.sin(m.leapT / 0.35 * Math.PI) * 0.6;
    P.spine.rotation.x = -wind * 0.15 + m.leapT * 0.6;
    P.head.rotation.x = wind * 0.3 + Math.sin(t * 3) * 0.05; P.jaw.rotation.x = wind * 0.5 + (m.leapT > 0 ? 0.6 : 0);
    P.tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 6 - i * 0.6) * (0.25 + run * 0.15); s.rotation.x = 0.15 + wind * 0.2; });
  }
  else if (typ === 'gaolwright') {
    if (P.chain) { P.chain.rotation.y = e.chainSpin != null ? e.chainSpin : Math.sin(t * 1.5) * 0.4; P.chain.rotation.x = -0.6 - wind * 0.4; }
    P.aL.rotation.x = -wind * 1.2; P.aR.rotation.x = Math.sin(t * 2) * 0.2 - wind * 0.8;
    m.body.position.y = moving ? Math.abs(Math.sin(t * 4)) * 0.12 : 0; m.body.rotation.x = -wind * 0.15;
  } else if (typ === 'kiln_saint') { m.body.position.y = 0.25 + Math.sin(t * 1.4) * 0.15; P.halo.rotation.z += dt * (0.8 + wind * 6); P.haloGlow.scale.setScalar(4.5 + wind * 2 + Math.sin(t * 6) * 0.3); P.aL.rotation.x = -wind; P.aR.rotation.x = -wind; }
  else if (typ === 'hollow_regent') { m.body.position.y = 0.4 + Math.sin(t * 1.2) * 0.2; P.crown.rotation.y += dt * 0.8; P.crown.position.y = 5.1 + Math.sin(t * 2) * 0.1 + wind * 0.4; P.shards.forEach((s, i) => { const a = t * 1.5 + i * 1.047; const rr = 2.0 + wind * 1.0; s.position.set(Math.cos(a) * rr, 2.5 + Math.sin(t * 2 + i) * 0.4, Math.sin(a) * rr); s.rotation.y += dt * 3; }); }
  if (P.crown && !m.boss) { P.crown.rotation.y += dt; }
  // hit flash
  if (m.flashT > 0) { m.flashT -= dt; const on = m.flashT > 0; for (const mm of m.mats) if (mm.emissive) { mm.emissive.setHex(on ? 0xffffff : mm.userData.em); mm.emissiveIntensity = on ? 0.9 : 1; } }
  m.ice.visible = e.frozenT > 0;
  // spawn-in scale
  const sp = e.spawnK != null ? e.spawnK : 1; m.root.scale.setScalar(0.2 + 0.8 * sp);
  if (e.stunT > 0 && R.vrand() < dt * 6) R.emit(e.x + (R.vrand() - .5), 2.2 * (m.boss ? 2 : 1), e.z + (R.vrand() - .5), 0, 0.5, 0, 0.5, 0.25, 0, 0xffe45c, 1, 0, 1);
};
R.flashEnemy = function (m) { m.flashT = 0.07; for (const mm of m.mats) if (mm.emissive) mm.emissive.setHex(0xffffff); };

/* Projectile / summon visuals */
R.makeProjMesh = function (color, hostile, size) {
  const THREE = T3(); const g = new THREE.Group();
  if (hostile) {
    const s = R.glowSprite(0xff2e55, size * 3.2, R.texStar); g.add(s); g.userData.spin = s;
    const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 8, 6), R.basic(0xffe0e8)); g.add(core);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(size * 0.9, 12), new THREE.MeshBasicMaterial({ color: 0xff2e55, transparent: true, opacity: 0.35, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = -0.95; g.add(sh);
  } else {
    const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 8, 6), R.basic(color)); g.add(core);
    const s = R.glowSprite(color, size * 4.2); g.add(s);
  }
  R.ents.add(g); return g;
};
R.makeTotem = function () {
  const THREE = T3(); const g = new THREE.Group();
  part(new THREE.CylinderGeometry(0.18, 0.3, 1.8, 6), R.std(0x3a3226), 0, 0.9, 0, g);
  const orb = part(new THREE.OctahedronGeometry(0.3, 0), R.basic(0xffe45c), 0, 2.1, 0, g); g.userData.orb = orb;
  const gl = R.glowSprite(0xffe45c, 2); gl.position.y = 2.1; g.add(gl);
  R.ents.add(g); return g;
};
R.makeTornado = function (rad) {
  const THREE = T3(); const g = new THREE.Group();
  if (!R.texSwirl) { R.texSwirl = R.canvasTex(128, 128, (c) => { c.clearRect(0, 0, 128, 128); for (let k = 0; k < 7; k++) { const y = k * 18 + 4; const gr = c.createLinearGradient(0, -7, 0, 7); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.save(); c.translate(64, y + 6); c.rotate(-0.35); c.fillRect(-100, -7, 200, 14); c.restore(); } }); R.texSwirl.wrapS = R.texSwirl.wrapT = THREE.RepeatWrapping; R.texSwirl.repeat.set(3, 1.5); R.texSwirl.needsUpdate = true; }
  const cols = [0xff3a10, 0xff6a20, 0xffa040];
  for (let k = 0; k < 3; k++) {
    const h = 3.4 - k * 0.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * (1.0 - 0.22 * k), rad * (0.3 - 0.06 * k), h, 20, 1, true), new THREE.MeshBasicMaterial({ color: cols[k], map: R.texSwirl, transparent: true, opacity: 0.62 - k * 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.y = h / 2; g.add(m);
  }
  const glow = R.glowSprite(0xff6a2b, rad * 1.5); glow.position.y = 0.6; glow.material.opacity = 0.6; g.add(glow);
  R.fx.add(g); return g;
};
R.makeFlameCone = function (angHalf, dirAng) {
  const THREE = T3(); const g = new THREE.Group();
  if (!R.texFan) R.texFan = R.canvasTex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.15)'); gr.addColorStop(0.45, 'rgba(255,255,255,.85)'); gr.addColorStop(0.8, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 260; i++) { c.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.5) + ')'; const a = Math.random() * 6.28, r = Math.random() * 64; c.beginPath(); c.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2 + Math.random() * 5, 0, 6.28); c.fill(); } });
  [[0xff4a14, 1, 0.9], [0xffb050, 0.72, 0.7]].forEach(([col, sc, op]) => {
    const geo = new THREE.CircleGeometry(1, 28, -angHalf, angHalf * 2); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, map: R.texFan, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.scale.setScalar(sc); m.userData.op = op; g.add(m);
  });
  g.rotation.y = dirAng - Math.PI / 2; R.fx.add(g); return g;
};
R.makeMeteor = function () {
  const THREE = T3(); const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: 0x2a140c, emissive: 0xff5a1a, emissiveIntensity: 0.6, roughness: 0.9, flatShading: true })));
  g.add(R.glowSprite(0xff6a2b, 3.4)); g.add(R.glowSprite(0xffe0a0, 1.6));
  R.fx.add(g); return g;
};
R.makeZoneMesh = function (color, r, opacity = 0.35) {
  const THREE = T3();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: R.texRune, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; R.fx.add(m); return m;
};

/* ---------------- Camera & projection ---------------- */
R.shake = function (amt) { R.shakeT = Math.min(1, R.shakeT + amt * H.settings.shake); };
R.kickCam = function (dx, dz, amt) { R.kick.x += dx * amt * H.settings.shake; R.kick.z += dz * amt * H.settings.shake; };
/* Camera modes: 'classic' (perspective, from the south) and 'iso' (orthographic isometric). The game only
   ever talks to the camera through follow/zoom, toScreen and screenToGround, so both modes work everywhere. */
R.ISO = { yaw: Math.PI / 4, pitch: 40 * Math.PI / 180, dist: 40, halfH: 9.4 };
R.setCameraMode = function (mode) {
  R.camMode = mode === 'classic' ? 'classic' : 'iso';
  R.camera = R.camMode === 'iso' ? R.orthoCam : R.persCam;
  R.camYaw = R.camMode === 'iso' ? R.ISO.yaw : 0; // movement input is rotated by this so "up" stays up on screen
  if (R.pMat) R.pMat.uniforms.uOrtho.value = R.camMode === 'iso' ? 1 : 0;
  if (R.scene.fog) { if (R.camMode === 'iso') { R.scene.fog.near = R.ISO.dist + 6; R.scene.fog.far = R.ISO.dist + 48; } else { R.scene.fog.near = 24; R.scene.fog.far = 58; } }
  R.applyWallCut();
  if (R.vw) { R.resize(); R.updateCamera(0, true); }
};
/* In the isometric view the near-right (east) wall would hide the room: lower it to a ledge like the south wall. */
R.applyWallCut = function () {
  const iso = R.camMode === 'iso';
  for (const m of R.chamber ? R.chamber.children : []) {
    const u = m.userData; if (u.eastRail) { m.visible = iso; continue; } if (!u.eastWall) continue;
    if (u.rune) { m.visible = !iso; continue; }
    m.scale.y = iso ? 0.5 / u.h : 1; m.position.y = iso ? 0.25 - 0.3 : u.h / 2 - 0.3;
  }
};
R.updateCamera = function (dt, snap) {
  const f = R.follow; const cam = R.camera;
  if (R.camMode === 'iso') return R.updateIsoCamera(dt, snap);
  const aspect = R.vw / R.vh;
  const zoom = f.zoom * (aspect < 1.3 ? 1.25 : aspect > 2 ? 0.95 : 1) * (R.mobileZoom || 1);
  const target = new (T3().Vector3)(f.x, 0, f.z);
  const desired = new (T3().Vector3)(f.x, 19 * zoom, f.z + 12.5 * zoom);
  const k = snap ? 1 : 1 - Math.exp(-dt * ((H.MOVE && H.MOVE.camFollow) || 6));
  R.camPos.lerp(desired, k); R.camLook.lerp(target, k);
  R.kick.x *= Math.exp(-dt * 12); R.kick.z *= Math.exp(-dt * 12);
  R.shakeT = Math.max(0, R.shakeT - dt * 1.6);
  const s = R.shakeT * R.shakeT * 0.9; const tt = R.t * 40;
  const ox = (Math.sin(tt * 1.3) + Math.sin(tt * 2.9) * 0.5) * s, oy = (Math.sin(tt * 1.7 + 1) * 0.5) * s, oz = (Math.sin(tt * 2.1 + 2) + Math.sin(tt * 3.7) * 0.4) * s;
  cam.position.set(R.camPos.x + ox + R.kick.x, R.camPos.y + oy, R.camPos.z + oz + R.kick.z);
  cam.lookAt(R.camLook.x + ox * 0.5 + R.kick.x, 0, R.camLook.z - 1 + R.kick.z);
};
/* Isometric view: a pillar standing between the camera and a hero or enemy fades so nobody is hidden behind it. */
R.updateOcclusion = function (dt) {
  const G = H.G; if (!R.chamber) return;
  const iso = R.camMode === 'iso' && G && G.active;
  const fx = -Math.sin(R.ISO.yaw), fz = -Math.cos(R.ISO.yaw), reach = 1 / Math.tan(R.ISO.pitch);
  for (const g of R.chamber.children) {
    const u = g.userData; if (!u.pillar) continue;
    let hide = false;
    if (iso) {
      const ents = G.players.filter(p => !p.dead).concat(G.enemies.filter(e => !e.dead));
      for (const e of ents) {
        const dx = e.x - u.x, dz = e.z - u.z, depth = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        if (depth > 0 && depth < u.h * reach + 0.6 && side < u.r * 1.3 + (e.r || 0.5)) { hide = true; break; }
      }
    }
    const target = hide ? 0.3 : 1; if (u.fade === target && !u.fading) continue;
    u.fade += (target - u.fade) * (1 - Math.exp(-dt * 10)); if (Math.abs(u.fade - target) < 0.01) u.fade = target;
    if (!u.mats) { u.mats = []; g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); u.mats.push(o.material); } }); }
    for (const m of u.mats) { m.transparent = u.fade < 0.999; m.opacity = u.fade; m.depthWrite = u.fade >= 0.999; }
    u.fading = u.fade !== target;
  }
};
R.updateIsoCamera = function (dt, snap) {
  const f = R.follow, cam = R.orthoCam, I = R.ISO;
  const aspect = R.vw / R.vh;
  const zoom = f.zoom * (aspect < 1.3 ? 1.25 : aspect > 2 ? 0.95 : 1) * (R.mobileZoom || 1);
  const k = snap ? 1 : 1 - Math.exp(-dt * ((H.MOVE && H.MOVE.camFollow) || 6));
  // camLook follows the action; camPos.y carries the view height so zoom changes ease in like before
  R.camLook.x += (f.x - R.camLook.x) * k; R.camLook.z += (f.z - R.camLook.z) * k;
  R.camPos.y += (I.halfH * zoom - R.camPos.y) * k; if (snap || !(R.camPos.y > 0)) R.camPos.y = I.halfH * zoom;
  const halfH = R.camPos.y, halfW = halfH * aspect;
  if (cam.top !== halfH || cam.right !== halfW) { cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH; cam.updateProjectionMatrix(); }
  if (R.pMat) R.pMat.uniforms.uScale.value = (R.bufH || R.vh) / (2 * halfH);
  R.kick.x *= Math.exp(-dt * 12); R.kick.z *= Math.exp(-dt * 12);
  R.shakeT = Math.max(0, R.shakeT - dt * 1.6);
  const s = R.shakeT * R.shakeT * 0.9; const tt = R.t * 40;
  const ox = (Math.sin(tt * 1.3) + Math.sin(tt * 2.9) * 0.5) * s, oz = (Math.sin(tt * 2.1 + 2) + Math.sin(tt * 3.7) * 0.4) * s;
  const lx = R.camLook.x + ox * 0.5 + R.kick.x, lz = R.camLook.z + oz * 0.5 + R.kick.z;
  const c = Math.cos(I.pitch);
  cam.position.set(lx + Math.sin(I.yaw) * c * I.dist, Math.sin(I.pitch) * I.dist, lz + Math.cos(I.yaw) * c * I.dist);
  cam.lookAt(lx, 0, lz);
};
R.screenToGround = function (sx, sy) {
  const THREE = T3();
  const ndc = new THREE.Vector2(sx / R.vw * 2 - 1, -(sy / R.vh) * 2 + 1);
  R.raycaster.setFromCamera(ndc, R.camera);
  const out = new THREE.Vector3();
  if (!R.raycaster.ray.intersectPlane(R.groundPlane, out)) return null;
  return { x: out.x, z: out.z };
};
const _v = { x: 0, y: 0, vis: false };
R.toScreen = function (x, y, z) {
  const THREE = T3(); if (!R._tv) R._tv = new THREE.Vector3();
  const v = R._tv.set(x, y, z).project(R.camera);
  _v.x = (v.x * 0.5 + 0.5) * R.vw; _v.y = (-v.y * 0.5 + 0.5) * R.vh; _v.vis = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
  return _v;
};

/* Ambient dust */
R.updateAmbient = function (dt) {
  if (!R.theme) return; const f = R.follow;
  const rate = H.settings.quality === 'low' ? 6 : 16;
  if (Math.random() < dt * rate) R.emit(f.x + (Math.random() - .5) * 30, Math.random() * 4, f.z + (Math.random() - .5) * 22, (Math.random() - .5) * .3, 0.15, (Math.random() - .5) * .3, 5, 0.12, 0.05, R.theme.rune, 0.45, 0, 0.1);
};

/* Warm-up: when a depth starts (or the quality or art style changes), build one of every enemy that can
   appear there, plus an elite and the depth's warden, and compile their shaders right away. The first
   wave then never waits for a shader. The warm models are kept (not drawn) so their programs stay alive. */
R.prewarm = function (depth) {
  const key = depth + '|' + H.settings.quality + '|' + H.settings.look + '|' + H.settings.camera;
  if (R._warmKey === key || !R.renderer) return; R._warmKey = key;
  for (const m of R._warm || []) { if (m.glbInst && H.models) H.models.release(m.glbInst); R.removeMesh(m.root); }
  for (const o of R._warmFx || []) R.removeMesh(o); R._warmFx = [];
  R._warm = [];
  const types = Object.keys(H.ENEMIES).filter(t => { const d = H.ENEMIES[t]; return !d.boss && d.minDepth <= depth; });
  const boss = H.DEPTHS[depth] && H.DEPTHS[depth].boss;
  const mr = Math.random; Math.random = R.vrand;   // building models must not touch the game's random sequence
  const holder = new (T3().Group)();
  try {
    for (const t of types) R._warm.push(R.makeEnemy(t, false));
    if (types[0]) R._warm.push(R.makeEnemy(types[0], true));
    if (boss && R.makeBoss) R._warm.push(R.makeBoss(boss));
    for (const m of R._warm) { if (m.root.parent) m.root.parent.remove(m.root); m.root.position.set(0, -50, 0); holder.add(m.root); }
    // and what fights throw around: projectiles, telegraphs, zones
    const fx = []; const grab = o => { if (o) { if (o.parent) o.parent.remove(o); o.position.y -= 50; holder.add(o); fx.push(o); } };
    try { grab(R.makeProjMesh(0xff8a3a, true, 0.3)); grab(R.makeProjMesh(0xff8a3a, false, 0.3)); for (const sh of ['circle', 'cone', 'rect']) grab(R.makeTelegraph(sh, { x: 0, z: 0, r: 1, w: 1, len: 2, angle: 0.6 })); grab(R.makeZoneMesh(0xffffff, 1)); } catch (e) { }
    try { R.ring(0, 0, 0xffffff, 0.1, 0.2, 0.001, -50); R.groundArrow(0, 0, 0, 1, 0.5, 0xffffff, 0.001); R.arcs[R.arcs.length - 1].m.position.y = -50; R.decal(0, 0, 0xffffff, 0.5, 0.001); R.decals[R.decals.length - 1].m.position.y = -50; } catch (e) { }
    R._warmFx = fx;
    // parts that only show up later (hands while casting, ice, crowns) must be compiled too
    const hidden = []; holder.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    R.scene.add(holder);
    try { R.renderer.compile(R.scene, R.camera); } catch (e) { /* a hint only */ }
    hidden.forEach(o => { o.visible = false; });
  } finally { Math.random = mr; R.scene.remove(holder); for (const m of R._warm) holder.remove(m.root); for (const o of R._warmFx || []) holder.remove(o); }
};
R.initGroundMarks = function () {
  const THREE = T3(), N = 160;
  const disc = new THREE.CircleGeometry(1, 16); disc.rotateX(-Math.PI / 2);
  const ring = new THREE.RingGeometry(0.95, 1.15, 24); ring.rotateX(-Math.PI / 2);
  const sh = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }), N);
  const rg = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), N);
  for (let i = 0; i < N; i++) rg.setColorAt(i, new THREE.Color(0xff2e55));
  for (const m of [sh, rg]) { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); R.scene.add(m); }
  sh.renderOrder = -2; rg.renderOrder = -1;
  R.ground = { sh, rg, N, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() };
};
R.updateGroundMarks = function () {
  const g = R.ground; if (!g) return; let ns = 0, nr = 0;
  const G = H.G;
  if (G && G.active) for (const e of G.enemies) {
    const m = e.model; if (!m || !m.root || !m.root.visible || !m.root.userData.ground) continue;
    const u = m.root.userData.ground, sc = m.root.scale.x * u.r, y = m.root.position.y;
    if (ns < g.N) { g.m4.compose(g.p.set(m.root.position.x, y + 0.04, m.root.position.z), g.q, g.s.set(sc, 1, sc)); g.sh.setMatrixAt(ns++, g.m4); }
    if (m.mark && m.mark.visible && nr < g.N) { g.m4.compose(g.p.set(m.root.position.x, y + 0.045, m.root.position.z), g.q, g.s.set(sc, 1, sc)); g.rg.setMatrixAt(nr, g.m4); g.rg.setColorAt(nr, g.c.setHex(u.c)); nr++; }
  }
  g.sh.count = ns; g.rg.count = nr; g.sh.instanceMatrix.needsUpdate = true; g.rg.instanceMatrix.needsUpdate = true; if (g.rg.instanceColor) g.rg.instanceColor.needsUpdate = true;
};
R.update = function (dt, gameDt) {
  R.t += dt;
  R.updateParticles(gameDt);
  R.updateFx(gameDt);
  R.updateChamber(dt);
  R.updateAmbient(dt);
  R.updateCamera(dt);
  R.updateOcclusion(dt);
  R.updateGroundMarks();
  if (R._warmPending) { const d = R._warmPending; R._warmPending = 0; R.prewarm(d); }
  if (R.pMat) { /* keep uniform current */ }
  for (const m of R.fx.children) if (m.material && m.material.uniforms && m.material.uniforms.uTime) m.material.uniforms.uTime.value = R.t;
};
R.render = function () { if (R.paint && R.paint.enabled()) R.paint.render(); else R.renderer.render(R.scene, R.camera); };

/* Characters get the illustrated look as they are built (heroes, enemies, bosses, menu and inventory previews). */
for (const k of ['makeHero', 'makeEnemy', 'makeBoss']) { const base = R[k]; R[k] = function () { const m = base.apply(R, arguments); R.toonify(m.root, m, { outline: false }); if (k !== 'makeHero' || m.armoured) R.bakeModel(m); if (H.settings.quality === 'high' && H.settings.look === 'toon') R.addOutline(m.root, k === 'makeHero' ? 0.16 : 0.3); return m; }; }

