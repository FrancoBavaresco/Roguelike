'use strict';
/* HEXWRIGHT — Theron's painted dash trail (view only).
   Source: the artist's theron_dash_animacion_v2 (8 directions × 20 frames at 40 fps, drawn for the isometric view,
   "in place": the body stays centred and the game moves it). tools/dash_frames.py exports, from the Krita files, only
   the energy layers (cloth trail, flash, mist and drops, cut, low trail; for S: bubbles, mist, flash, flames): the
   painted body and its afterimages are left out because the game draws Theron in 3D, and a soft hole where the painted
   body was lets the model show through. Frames 02–19 (the anticipation 00–01 is the model's own) are packed per
   direction in public/textures/fx/dash/theron_dash_<DIR>.png (grid in CFG.dirs, from dash.json).

   Playback, in three stages of game time (dt):
     A start   — on the real dash (G.dash bumps p.anim.dashN) frames 02→11 play while the hero dashes: the impulse flash,
                 then the trail grows back from his body; it rides with him (anchored to his body centre) and eases in
                 with a little scale. A blocked or very short dash still plays at least CFG.minBuild seconds.
     B release — when the dash's movement ends, the trail lets go: it stays where it is in the world while frames
                 12→19 play (the trail tears off with a ragged edge and the mist and drops drift), so it separates
                 from Theron as he moves on.
     C end     — the last frames fade out on top of their own fade; then the mesh is hidden. Nothing stays behind.

   Direction: the painting has 8 screen directions (E 0°, NE −26.6°, N −90°, …, y down). Each frame the real motion
   of the hero (or the dash direction) is projected onto the screen, the nearest painted direction is used and the
   card is turned by the small remainder, so the trail always points back along the actual path, whatever the
   facing or the camera. The card faces the camera (it was painted for this view) and is moved a little toward the
   camera so the floor never cuts it; its size follows the length of the dash as seen on screen (uniform scale, no
   stretching), so the trail covers the path it left.

   In the painted look the trail is a "painted overlay" (paint.js): drawn with its real alpha over the picture.
   Resources: 8 textures loaded once, one plane geometry, one small shader addition (frame window in the sheet);
   a pool of 3 trails per hero (dash charges can overlap). Nothing is created per frame. Nothing here changes the
   dash's distance, speed, immunity, cooldown, collisions or movement. Tune it in R.dashCfg. */
(function () {
  const R = H.R, THREE = window.THREE;
  const CFG = R.dashCfg = {
    enabled: true,
    heroes: ['knight'],                 // Theron (the Veteran)
    dir: 'public/textures/fx/dash/',
    fps: 40,                            // the painting's own rate (frames 02–19 below are indices 0–17)
    build: [0, 9],                      // frames 02–11: impulse and growing trail, while the dash moves
    tail: [10, 17],                     // frames 12–19: tear-off and fade, after it
    minBuild: 0.12,                     // seconds the build-up lasts at least (short or blocked dashes stay readable)
    tailTime: 0.2,                      // seconds of the tail (the painting's own would be 0.2 s at 40 fps)
    fadeFrom: 0.55,                     // fraction of the tail where an extra fade starts
    opacity: 1.0,
    scaleIn: [0.82, 0.06],              // starting scale and how long (s) it takes to reach full size
    height: 0.95,                       // m: the painted body centre sits at the hero's body centre
    toCamera: 2.5,                      // m toward the camera, so the floor never cuts the card (no change on screen)
    trailPx: 215,                       // px (448-scale frames) from the body centre to the end of the trail at its peak
    lengthK: 0.85,                      // the trail covers this fraction of the dash length as seen on screen
    sizeClamp: [0.6, 1.25],             // limits of the size relative to a sideways dash
    // the painted directions: screen angle (degrees, y down) and each sheet's grid (from dash.json)
    dirs: {
      E:  { ang: 0, w: 309, h: 145, cols: 3, rows: 6, pivot: [224, 81] },
      NE: { ang: -26.565, w: 293, h: 221, cols: 4, rows: 5, pivot: [223, 84] },
      N:  { ang: -90, w: 145, h: 309, cols: 6, rows: 3, pivot: [81, 85] },
      NW: { ang: -153.435, w: 293, h: 221, cols: 4, rows: 5, pivot: [70, 84] },
      W:  { ang: 180, w: 309, h: 145, cols: 3, rows: 6, pivot: [85, 81] },
      SW: { ang: 153.435, w: 293, h: 221, cols: 4, rows: 5, pivot: [70, 137] },
      S:  { ang: 90, w: 235, h: 271, cols: 5, rows: 4, pivot: [104, 224] },
      SE: { ang: 26.565, w: 293, h: 221, cols: 4, rows: 5, pivot: [223, 137] }
    },
    sheetSize: { E: [927, 870], NE: [1172, 1105], N: [870, 927], NW: [1172, 1105], W: [927, 870], SW: [1172, 1105], S: [1175, 1084], SE: [1172, 1105] }
  };

  let texs = null, geo = null, loadErr = false;
  function textures() {
    if (texs || loadErr) return texs;
    const L = new THREE.TextureLoader(); texs = {};
    for (const d in CFG.dirs) {
      const t = L.load(CFG.dir + 'theron_dash_' + d + '.png', undefined, undefined, () => { loadErr = true; console.warn('[dashfx] could not load', d); });
      t.encoding = THREE.sRGBEncoding; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;   // sheets are not powers of two
      texs[d] = t;
    }
    return texs;
  }
  function geometry() { return geo || (geo = new THREE.PlaneGeometry(1, 1)); }
  // the frame window inside the sheet: vUv = uv * uScale + uOffset
  function onBeforeCompile(shader) {
    Object.assign(shader.uniforms, this.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uScale, uOffset;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = uv * uScale + uOffset;');
  }
  function material() {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, opacity: 0, toneMapped: false, fog: false });
    mat.userData.u = { uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) } };
    mat.onBeforeCompile = onBeforeCompile;
    return mat;
  }

  const POOL = 3;
  function make(m) {
    const items = [];
    for (let i = 0; i < POOL; i++) {
      const mat = material(), mesh = new THREE.Mesh(geometry(), mat), holder = new THREE.Group();
      mesh.castShadow = mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.userData.overlay = true;
      holder.add(mesh); holder.visible = false; R.fx.add(holder);
      items.push({ holder, mesh, mat, on: false });
    }
    return { items, next: 0, n: null, room: null };
  }
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _m3 = new THREE.Matrix3(), _sc = { ang: 0, len: 1 };
  // screen angle (degrees, y down) of a ground direction, and how long 1 m of it looks on screen (camera space: x right, y up)
  function onScreen(dx, dz) {
    _w.set(dx, 0, dz).applyMatrix3(_m3.setFromMatrix4(R.camera.matrixWorldInverse));
    _sc.ang = Math.atan2(-_w.y, _w.x) * 180 / Math.PI; _sc.len = Math.hypot(_w.x, _w.y); return _sc;
  }
  const angDiff = (a, b) => { let d = a - b; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };

  R.dashFx = {
    CFG,
    // is the painted dash in use for this hero? (game.js skips its generic dash burst then)
    active(charId) { return CFG.enabled && !loadErr && CFG.heroes.indexOf(charId) >= 0; },
    update(m, p, dt) {
      if (!m.root || !R.camera) return;
      let S = m.dash;
      const A = p.anim || {};
      if (S && S.room !== H.G.room) { R.dashFx.clear(m); S.room = H.G.room; }   // a new room: nothing left floating
      if (A.dashN != null && (!S || S.n !== A.dashN) && CFG.heroes.indexOf(m.kind) >= 0 && CFG.enabled && !loadErr) {
        if (!S) { S = m.dash = make(m); S.room = H.G.room; }
        const first = S.n == null; S.n = A.dashN;
        if (!first || p.dashT > 0) R.dashFx.fire(S, p);
      }
      if (S) R.dashFx.tick(S, p, dt);
    },
    fire(S, p) {
      textures();
      const o = S.items[S.next]; S.next = (S.next + 1) % S.items.length;
      o.on = true; o.t = 0; o.p = p; o.attached = true; o.buildEnd = null; o.lastX = p.x; o.lastZ = p.z;
      const dl = Math.hypot(p.dashDX || 0, p.dashDZ || 0); o.dx = dl > 1e-6 ? p.dashDX / dl : -Math.sin(p.faceAng || 0); o.dz = dl > 1e-6 ? p.dashDZ / dl : -Math.cos(p.faceAng || 0);
      o.x = p.x; o.z = p.z;
      // size: the dash's length as seen on screen, against the painted trail length (sideways dash = 1)
      const len = onScreen(o.dx, o.dz).len, dist = H.MOVE ? H.MOVE.dashDist : 4.8;
      o.mpp = Math.max(CFG.sizeClamp[0], Math.min(CFG.sizeClamp[1], len)) * dist * CFG.lengthK / CFG.trailPx;
      o.holder.visible = true;
      R.dashFx.pose(o);
    },
    tick(S, p, dt) {
      for (const o of S.items) {
        if (!o.on) continue;
        o.t += dt;
        // stage A → B: the build-up runs while the dash moves (at least minBuild), then the trail lets go of him
        if (o.attached) {
          const mv = Math.hypot(p.x - o.lastX, p.z - o.lastZ);
          if (mv > 1e-4) { o.dx = (p.x - o.lastX) / mv; o.dz = (p.z - o.lastZ) / mv; }   // the real motion
          o.lastX = p.x; o.lastZ = p.z; o.x = p.x; o.z = p.z;
          if ((!(p.dashT > 0) || p.dead) && o.t >= CFG.minBuild) { o.attached = false; o.buildEnd = o.t; }
        }
        const end = o.buildEnd == null ? null : o.buildEnd + CFG.tailTime;
        if (end != null && o.t >= end) { o.on = false; o.holder.visible = false; o.mat.opacity = 0; continue; }
        R.dashFx.pose(o);
      }
    },
    pose(o) {
      const cam = R.camera;
      // which frame: the build-up spread over the time it actually takes, the tail over tailTime
      let f, fade = 1;
      if (o.buildEnd == null) {
        const span = Math.max(CFG.minBuild, H.MOVE ? H.MOVE.dashTime : 0.14);
        f = CFG.build[0] + Math.min(1, o.t / span) * (CFG.build[1] - CFG.build[0]);
      } else {
        const k = Math.min(1, (o.t - o.buildEnd) / CFG.tailTime);
        f = CFG.tail[0] + k * (CFG.tail[1] - CFG.tail[0]);
        if (k > CFG.fadeFrom) fade = 1 - (k - CFG.fadeFrom) / (1 - CFG.fadeFrom);
      }
      f = Math.round(f);
      // direction: the nearest painted one, the card turned by the rest
      const sc = onScreen(o.dx, o.dz); let best = 'E', bd = 1e9;
      for (const d in CFG.dirs) { const a = Math.abs(angDiff(sc.ang, CFG.dirs[d].ang)); if (a < bd) { bd = a; best = d; } }
      const D = CFG.dirs[best], SZ = CFG.sheetSize[best];
      if (o.mat.map !== texs[best]) { o.mat.map = texs[best]; o.mat.needsUpdate = true; }
      const col = f % D.cols, row = Math.floor(f / D.cols);
      o.mat.userData.u.uScale.value.set(D.w / SZ[0], D.h / SZ[1]);
      o.mat.userData.u.uOffset.value.set(col * D.w / SZ[0], 1 - (row + 1) * D.h / SZ[1]);
      // size and pivot: the painted body centre on the anchor
      const sIn = CFG.scaleIn[0] + (1 - CFG.scaleIn[0]) * Math.min(1, o.t / CFG.scaleIn[1]);
      const W = D.w * o.mpp * sIn, Hh = D.h * o.mpp * sIn;
      o.mesh.scale.set(W, Hh, 1);
      o.mesh.position.set((0.5 - D.pivot[0] / D.w) * W, (D.pivot[1] / D.h - 0.5) * Hh, 0);
      // facing the camera, turned by the remainder (screen angles grow clockwise, the card's z turn anticlockwise)
      o.holder.quaternion.copy(cam.quaternion).multiply(_q.setFromAxisAngle(_z, -angDiff(sc.ang, D.ang) * Math.PI / 180));
      cam.getWorldDirection(_v);
      o.holder.position.set(o.x - _v.x * CFG.toCamera, CFG.height - _v.y * CFG.toCamera, o.z - _v.z * CFG.toCamera);
      o.mat.opacity = CFG.opacity * fade;
      o.dir = best; o.frame = f;
    },
    // hide every trail (death, room change); the meshes stay for reuse
    clear(m) { const S = m && m.dash; if (!S) return; for (const o of S.items) { o.on = false; o.holder.visible = false; o.mat.opacity = 0; } },
    preload() { if (CFG.enabled) textures(); }
  };
})();
