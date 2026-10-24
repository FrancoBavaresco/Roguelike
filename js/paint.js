'use strict';
/* HEXWRIGHT — painted look (Ajustes › Estilo gráfico › Pintado).
   The scene is drawn in four passes and composed like a hand-painted texture:
   1 base maps: lights off (flat base colour); ambient occlusion and curvature from the depth and normal buffers
   2 colour layers: the real light reduced to bands; shadows as a Multiply layer (cool), highlights as an Overlay
     layer in the light's own colour
   3 line art: ink where depth or surface direction breaks, and a dark terminator stroke where light turns to shadow
   4 effects on top: fires, cracks, runes, particles and their glow
   Nothing here touches the game: it only changes how R.render draws the frame. */
(function () {
  const R = H.R;
  const P = R.paint = {};
  let ready = false, rtLit, rtAlb, rtNrm, rtFx, rtShade, quadScene, shadeScene, quadCam, U, nrmMat, black;
  const albCache = new WeakMap(), fxCache = new WeakMap();
  const solids = [], fx = [], fxVis = [];

  P.enabled = () => H.settings.look === 'painted' && H.settings.quality !== 'low';

  function init() {
    const THREE = window.THREE;
    const mkRT = depth => { const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); if (depth) { rt.depthTexture = new THREE.DepthTexture(1, 1); rt.depthTexture.type = THREE.UnsignedIntType; } return rt; };
    rtLit = mkRT(true); rtAlb = mkRT(false); rtNrm = mkRT(false); rtFx = mkRT(false); rtShade = mkRT(false);
    nrmMat = new THREE.MeshNormalMaterial(); black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    U = {
      tLit: { value: rtLit.texture }, tAlb: { value: rtAlb.texture }, tNrm: { value: rtNrm.texture }, tFx: { value: rtFx.texture }, tDepth: { value: rtLit.depthTexture }, tShade: { value: rtShade.texture },
      uPx: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.5 }, uFar: { value: 200 }, uHalf: { value: new THREE.Vector2(10, 10) }, uOrtho: { value: 1 }, uMode: { value: 0 },
      uShadowTint: { value: new THREE.Color(0x3c4a58) }, uTermTint: { value: new THREE.Color(0x24503e) }, uInk: { value: new THREE.Color(0x070b0a) }, uExposure: { value: 0.72 }, uSky: { value: new THREE.Color(0x0a1210) }
    };
    const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const frag = `
      uniform sampler2D tLit, tAlb, tNrm, tFx, tDepth, tShade; uniform vec2 uPx, uHalf; uniform float uNear, uFar, uExposure, uOrtho; uniform int uMode;
      uniform vec3 uShadowTint, uTermTint, uInk, uSky; varying vec2 vUv;
      float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).x;
        return uOrtho > 0.5 ? uNear + d * (uFar - uNear) : (uNear * uFar) / (uFar - d * (uFar - uNear)); }
      vec3 nrmAt(vec2 uv) { return texture2D(tNrm, uv).xyz * 2.0 - 1.0; }
      vec3 posAt(vec2 uv) { float z = viewZ(uv); vec2 s = (uv * 2.0 - 1.0) * uHalf; return vec3(uOrtho > 0.5 ? s : s * z, -z); }
      float shadeAt(vec2 uv) { return texture2D(tShade, uv).r; }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      vec3 overlay(vec3 b, vec3 s) { return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b)); }
      void main() {
        vec2 uv = vUv; vec3 alb = texture2D(tAlb, uv).rgb, lit = texture2D(tLit, uv).rgb, n = nrmAt(uv), fxc = texture2D(tFx, uv).rgb;
        bool sky = texture2D(tDepth, uv).x > 0.99999;
        vec3 P0 = posAt(uv);
        // ambient occlusion: normal-oriented samples around the point
        float ao = 0.0; float rad = 0.8;
        for (int i = 0; i < 10; i++) { float a = float(i) * 2.399 + hash(uv * 512.0) * 6.28; float r = (float(i) + 1.0) / 10.0;
          vec2 o = vec2(cos(a), sin(a)) * r * rad / (uOrtho > 0.5 ? uHalf : uHalf * max(-P0.z, 1.0)) * 0.5;
          vec3 S = posAt(uv + o); vec3 v = S - P0; float dist = length(v); ao += max(dot(v / max(dist, 1e-3), n) - 0.08, 0.0) * smoothstep(2.0, 0.35, dist); }
        ao = clamp(1.0 - ao / 10.0 * 2.4, 0.0, 1.0);
        // curvature from the normal buffer: convex edges lighter, creases darker
        vec2 e = uPx * 1.5;
        float curv = (nrmAt(uv + vec2(e.x, 0.0)).x - nrmAt(uv - vec2(e.x, 0.0)).x) + (nrmAt(uv + vec2(0.0, e.y)).y - nrmAt(uv - vec2(0.0, e.y)).y);
        float convex = clamp(curv * 1.4, 0.0, 1.0), concave = clamp(-curv * 1.4, 0.0, 1.0);
        // light as bands
        vec3 lightRGB = lit / max(alb, vec3(0.02)); float s = shadeAt(uv);
        vec3 lightHue = lightRGB / max(max(lightRGB.r, max(lightRGB.g, lightRGB.b)), 1e-3);
        float shadowM = 1.0 - smoothstep(0.30, 0.38, s);
        float midM = 1.0 - smoothstep(0.85, 0.95, s);
        float hiM = smoothstep(1.25, 1.45, s);
        vec3 base = alb * 1.02;
        vec3 col = base * mix(vec3(1.0), lightHue, 0.42);
        col *= mix(vec3(1.0), uShadowTint * 1.6, shadowM);
        col *= mix(1.0, 0.82, midM * (1.0 - shadowM));
        col = mix(col, overlay(clamp(col, 0.0, 1.0), clamp(0.5 + lightHue * 0.45, 0.0, 1.0)), hiM * 0.85);
        col *= mix(0.55, 1.0, ao);
        col *= 1.0 - concave * 0.35; col += convex * 0.14 * (0.4 + 0.6 * (1.0 - shadowM)) * vec3(0.82, 0.88, 0.85);
        // terminator: only where the light really turns
        float sR = shadeAt(uv + vec2(uPx.x * 2.0, 0.0)), sU = shadeAt(uv + vec2(0.0, uPx.y * 2.0));
        float gX = abs(shadeAt(uv + vec2(uPx.x * 8.0, 0.0)) - shadeAt(uv - vec2(uPx.x * 8.0, 0.0))), gY = abs(shadeAt(uv + vec2(0.0, uPx.y * 8.0)) - shadeAt(uv - vec2(0.0, uPx.y * 8.0)));
        float term = ((step(0.34, s) != step(0.34, sR) && gX > 0.35) || (step(0.34, s) != step(0.34, sU) && gY > 0.35)) ? 1.0 : 0.0;
        col = mix(col, uTermTint * (0.3 + lum(base) * 1.2), term * 0.35);
        // ink
        float z0 = viewZ(uv), dz = 0.0, dn = 0.0;
        for (int k = 0; k < 4; k++) { vec2 o = k == 0 ? vec2(e.x, 0.0) : k == 1 ? vec2(-e.x, 0.0) : k == 2 ? vec2(0.0, e.y) : vec2(0.0, -e.y);
          dz = max(dz, abs(viewZ(uv + o) - z0)); dn = max(dn, 1.0 - dot(nrmAt(uv + o), n)); }
        float zs = uOrtho > 0.5 ? 1.0 : max(z0 * 0.04, 0.4);
        float ink = clamp(smoothstep(0.35 * zs, 0.9 * zs, dz) + smoothstep(0.25, 0.6, dn), 0.0, 1.0);
        col = mix(col, uInk, ink * 0.9);
        // glow of the effects
        vec3 glow = vec3(0.0); for (int k = 0; k < 8; k++) { float a = float(k) * 0.785; glow += texture2D(tFx, uv + vec2(cos(a), sin(a)) * uPx * 9.0).rgb + texture2D(tFx, uv + vec2(cos(a), sin(a)) * uPx * 22.0).rgb; }
        glow /= 16.0;
        vec3 outc;
        if (uMode == 1) outc = base;
        else if (uMode == 2) outc = vec3(ao * (1.0 - concave * 0.5) + convex * 0.4);
        else if (uMode == 3) outc = mix(vec3(0.92, 0.9, 0.86), uInk, ink);
        else outc = col + fxc * 0.75 + glow * 0.3;
        if (sky) outc = uSky + fxc * 0.6 + glow * 0.25;
        gl_FragColor = vec4(pow(aces(outc * uExposure), vec3(1.0 / 2.2)), 1.0);
      }`;
    quadScene = new THREE.Scene(); quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false, toneMapped: false })));
    // light ratio (lit / base colour), softened, at half resolution
    shadeScene = new THREE.Scene(); shadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, depthTest: false, depthWrite: false, toneMapped: false,
      fragmentShader: `uniform sampler2D tLit, tAlb; uniform vec2 uPx; varying vec2 vUv;
        float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
        float s1(vec2 uv) { return lum(texture2D(tLit, uv).rgb) / max(lum(texture2D(tAlb, uv).rgb), 0.03); }
        void main() { vec2 r = uPx * 5.0; float t = s1(vUv) * 2.0 + s1(vUv + vec2(r.x, r.y)) + s1(vUv - vec2(r.x, r.y)) + s1(vUv + vec2(r.x, -r.y)) + s1(vUv - vec2(r.x, -r.y)) + s1(vUv + vec2(r.x * 1.4, 0.0)) + s1(vUv - vec2(r.x * 1.4, 0.0));
          gl_FragColor = vec4(3.0 * t / 8.0, 0.0, 0.0, 1.0); }` })));
    ready = true;
  }

  const albOf = m => {
    let b = albCache.get(m);
    if (!b) { b = new THREE.MeshBasicMaterial({ color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1), map: m.map || null, vertexColors: !!m.vertexColors, side: m.side, skinning: !!m.skinning }); albCache.set(m, b); }
    else if (m.color) b.color.copy(m.color);
    return b;
  };
  // what glows by itself: basic materials and emissive surfaces (colour follows the live emissive, e.g. hit flashes)
  const fxOf = m => {
    if (m.isMeshBasicMaterial) return m;
    let f = fxCache.get(m);
    if (f === undefined) { f = (m.emissive && (m.emissiveMap || m.emissive.getHex() > 0)) || (m.emissive && m.userData && m.userData.em != null) ? new THREE.MeshBasicMaterial({ map: m.emissiveMap || null, side: m.side, skinning: !!m.skinning }) : null; fxCache.set(m, f); }
    if (!f) return black;
    f.color.copy(m.emissive).multiplyScalar(m.emissiveIntensity != null ? m.emissiveIntensity : 1); return f;
  };
  const opaque = m => m && !m.transparent && m.blending === THREE.NormalBlending && !m.isShaderMaterial && !m.isPointsMaterial && !m.isSpriteMaterial;
  function classify(scene) {
    solids.length = 0; fx.length = 0;
    scene.traverseVisible(o => {
      if (o.isSprite || o.isPoints || o.isLine) { fx.push(o); return; }
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (ms.every(opaque)) solids.push(o); else fx.push(o);
    });
  }
  const swap = fn => { for (const o of solids) { o.userData._pm = o.material; o.material = Array.isArray(o.material) ? o.material.map(fn) : fn(o.material); } };
  const unswap = () => { for (const o of solids) { o.material = o.userData._pm; o.userData._pm = null; } };
  const hideFx = () => { fxVis.length = 0; for (const o of fx) { fxVis.push(o.visible); o.visible = false; } };
  const showFx = () => { fx.forEach((o, i) => { o.visible = fxVis[i]; }); };

  P.setMode = m => { if (U) U.uMode.value = m; };
  P.render = function () {
    const THREE = window.THREE, renderer = R.renderer, scene = R.scene, cam = R.camera;
    if (!ready) init();
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (rtLit.width !== size.x || rtLit.height !== size.y) { for (const rt of [rtLit, rtAlb, rtNrm, rtFx]) rt.setSize(size.x, size.y); rtShade.setSize(Math.ceil(size.x / 2), Math.ceil(size.y / 2)); }
    U.uPx.value.set(1 / size.x, 1 / size.y); U.uNear.value = cam.near; U.uFar.value = cam.far;
    if (cam.isOrthographicCamera) { U.uOrtho.value = 1; U.uHalf.value.set((cam.right - cam.left) / 2 / cam.zoom, (cam.top - cam.bottom) / 2 / cam.zoom); }
    else { U.uOrtho.value = 0; const t = Math.tan(cam.fov * Math.PI / 360); U.uHalf.value.set(t * cam.aspect, t); }
    U.uExposure.value = renderer.toneMappingExposure * 0.8;
    if (scene.background && scene.background.isColor) U.uSky.value.copy(scene.background).multiplyScalar(0.6);
    classify(scene);
    const bg = scene.background, auto = renderer.shadowMap.autoUpdate;
    // 1 lit: solids only, with shadows
    hideFx(); renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(rtLit); renderer.render(scene, cam);
    // 2 base colour: lights off
    swap(albOf); renderer.setRenderTarget(rtAlb); renderer.render(scene, cam); unswap();
    // 3 normals
    scene.overrideMaterial = nrmMat; scene.background = null; renderer.setClearColor(0x8080ff, 1); renderer.setRenderTarget(rtNrm); renderer.render(scene, cam); scene.overrideMaterial = null;
    // 4 effects: glowing surfaces + sprites, particles, telegraphs, flames
    renderer.setClearColor(0x000000, 1); swap(fxOf); showFx(); renderer.setRenderTarget(rtFx); renderer.render(scene, cam); unswap();
    scene.background = bg; renderer.shadowMap.autoUpdate = auto;
    // compose
    renderer.setRenderTarget(rtShade); renderer.render(shadeScene, quadCam);
    renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
  };
})();
