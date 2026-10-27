'use strict';
/* HEXWRIGHT — external 3D models (.glb): one registry for every hero, enemy and boss.
   Files live next to the game in public/models/. They are loaded once at boot with the bundled
   GLTFLoader (js/vendor, no network service). Any type whose file is disabled, missing or broken
   keeps its procedural model from render.js ("fallback: 'procedural'"), so the game always works.
   views.js asks this registry for an instance; instances are pooled and given back on release. */
(function () {
  const M = H.models = { cache: {}, status: {}, report: {}, pool: {} };

  /* Registry entry fields (all optional except url):
     enabled    true once the file exists. A missing or broken file falls back, it never breaks a run.
     fallback   'procedural' (the only one today): what to build when the .glb is not ready.
     height     fit the model to this height in metres (from its bounding box). Wins over scale.
     scale      fixed scale when no height is given (1 unit = 1 m).
     rotY       turn so the model faces −Z (the game's forward).
     yOffset    extra lift after the feet are put on the ground.
     barH       height of the health bar above the feet (m); elites multiply it by 1.3.
     sockets    { hand_R, hand_L, head, spine }: node or bone names where weapons and armour hang.
     anims      game state → clip name. Enemies: idle, run, windup, attack, hit, death.
                Heroes: idle, run, cast, dash, hurt, death (+ slash, thrust, cleave, smash, throw, backhand).
                Any missing clip is skipped; the registry reports which ones it did not find.
     tint       colour multiplied into the materials (null keeps the file's colours).
     pool       instances kept ready (built and shader-compiled at load, reused after deaths). */
  H.ENEMY_MODELS = {
    bone_stalker: { url: 'public/models/enemies/bone_stalker.glb', enabled: false, fallback: 'procedural', height: 1.2, rotY: 0, yOffset: 0, barH: 1.9, tint: null, pool: 4,
      sockets: { head: 'head', spine: 'spine' },
      anims: { idle: 'Idle', run: 'Run', windup: 'Crouch', attack: 'Pounce', hit: 'Hit', death: 'Death' } }
  };
  /* The Veteran: "Theron" (rigged, 8 clips). The right arm (and the left on two-handed weapons) is driven by IK
     toward the game's own swing path (render.js, R.heroArmIK), so the sword and the three combo hits stay
     exactly as designed; the clips move the body, legs and the free arm. subclips: name → [clip, from s, to s]. */
  H.PLAYER_MODELS = {
    knight: { url: 'public/models/characters/theron.glb', enabled: true, fallback: 'procedural', height: 1.9, rotY: Math.PI, yOffset: 0, tint: null, pool: 1,
      sockets: { hand_R: 'hand_R', hand_L: 'hand_L', head: 'Head', spine: 'Spine' },
      armIK: { R: ['RightUpperArm', 'RightLowerArm', 'RightHand'], L: ['LeftUpperArm', 'LeftLowerArm', 'LeftHand'] },
      // extra clips made for this rig (JSON, THREE.AnimationClip format); runSpeed: ground speed (m/s) the run clip was made for
      extraClips: ['public/models/characters/theron_run.json'], runSpeed: 4.07,
      subclips: { combo1: ['Attack_Combo', 0.3, 0.68], combo2: ['Attack_Combo', 0.62, 0.98], combo3: ['Attack_Combo', 0.92, 1.4], slam: ['Special_Slam', 0.12, 1.25] },
      anims: { idle: 'Combat_Idle', calm: 'Idle', run: 'Run_Std', dash: 'Dash', hurt: 'Hit', cast: 'Ultimate', slash: 'combo1', chop: 'combo2', thrust: 'combo3', smash: 'slam' } }
  };
  /* Theron's physique (proportions only; same rig, clips, textures and materials), made by tools/theron_physique.py
     from theron.glb, which stays untouched: 'A' athletic (wider shoulders, V torso), 'B' robust (more of it).
     null = the original. height keeps the body the same size: the bigger head makes the model a little taller. */
  H.THERON_PHYSIQUE = null;
  H.THERON_VARIANTS = {
    A: { url: 'public/models/characters/theron_A.glb', height: 1.914 },
    B: { url: 'public/models/characters/theron_B.glb', height: 1.92 }
  };
  if (H.THERON_VARIANTS[H.THERON_PHYSIQUE]) Object.assign(H.PLAYER_MODELS.knight, H.THERON_VARIANTS[H.THERON_PHYSIQUE]);
  H.BOSS_MODELS = {};
  const groups = () => [H.ENEMY_MODELS, H.PLAYER_MODELS, H.BOSS_MODELS];
  M.cfg = type => { for (const g of groups()) if (g[type]) return g[type]; return null; };
  M.entries = () => { const out = []; for (const g of groups()) for (const [type, cfg] of Object.entries(g)) out.push([type, cfg]); return out; };

  // Common bone names from exporters (Mixamo, Blender rigify, plain) tried after the configured one.
  const SOCKET_ALIASES = {
    hand_R: ['hand_R', 'hand.R', 'RightHand', 'mixamorigRightHand', 'Hand_R', 'hand_r'],
    hand_L: ['hand_L', 'hand.L', 'LeftHand', 'mixamorigLeftHand', 'Hand_L', 'hand_l'],
    head: ['head', 'Head', 'mixamorigHead'],
    spine: ['spine', 'Spine', 'spine_02', 'mixamorigSpine1', 'mixamorigSpine']
  };

  M.load = function () {
    if (!window.THREE || !THREE.GLTFLoader) return Promise.resolve();
    const loader = new THREE.GLTFLoader();
    const jobs = M.entries().filter(([, c]) => c.enabled).map(([type, cfg]) => new Promise(res => {
      M.status[type] = 'loading';
      const fail = why => { M.status[type] = 'missing'; M.report[type] = { error: why }; console.warn('[models] ' + cfg.url + ' not used (' + why + '); keeping the procedural model.'); res(); };
      try {
        const extra = []; // clips loaded from JSON before the model is finished
        const onGltf = gltf => {
          try {
            const scene = gltf.scene; if (!scene) return fail('no scene');
            // mark geometry as shared so removing one instance never disposes the template
            let meshes = 0;
            scene.traverse(o => { if (o.isMesh) { meshes++; o.castShadow = true; o.receiveShadow = true; if (o.geometry) o.geometry.shared = true; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.shared = true; if (cfg.tint != null && m.color) m.color.multiply(new THREE.Color(cfg.tint)); }); } });
            if (!meshes) return fail('no meshes');
            // fit: height from the bounding box, feet on the ground
            scene.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(scene); const h = box.max.y - box.min.y;
            if (!(h > 1e-4) || !isFinite(h)) return fail('empty bounding box');
            const scale = cfg.height ? cfg.height / h : (cfg.scale || 1);
            const fit = { scale, lift: -box.min.y * scale + (cfg.yOffset || 0), height: h * scale };
            const clips = (gltf.animations || []).slice().concat(extra);
            // sub-clips cut from longer clips (e.g. one hit of a combo)
            for (const [name, [from, a, b]] of Object.entries(cfg.subclips || {})) { const src = THREE.AnimationClip.findByName(clips, from); if (src && THREE.AnimationUtils.subclip) clips.push(THREE.AnimationUtils.subclip(src, name, Math.round(a * 60), Math.round(b * 60), 60)); }
            const missing = Object.entries(cfg.anims || {}).filter(([, n]) => !THREE.AnimationClip.findByName(clips, n)).map(([k]) => k);
            const sockets = {}; for (const k of Object.keys(SOCKET_ALIASES)) { const n = findSocketName(scene, cfg, k); if (n) sockets[k] = n; }
            M.cache[type] = { scene, clips, fit, sockets };
            M.report[type] = { height: +fit.height.toFixed(2), clips: clips.map(c => c.name), missingClips: missing, sockets: Object.keys(sockets) };
            M.status[type] = 'ready';
            res();
          } catch (err) { fail(err && err.message || 'bad file'); }
        };
        // hosts that don't serve .glb files: the page can embed the model as base64 in H.EMBED[url]
        const go = () => {
        const emb = H.EMBED && H.EMBED[cfg.url];
        if (emb) { const bin = atob(emb), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); loader.parse(buf.buffer, '', onGltf, err => fail(err && err.message || 'bad embedded file')); }
        else loader.load(cfg.url, onGltf, undefined, err => fail(err && err.message || 'not found'));
        };
        // extra clips (a missing one is skipped; the model still loads)
        Promise.all((cfg.extraClips || []).map(u => fetch(u).then(r => r.ok ? r.json() : null).then(j => { if (j) extra.push(THREE.AnimationClip.parse(j)); }).catch(() => console.warn('[models] ' + u + ' not loaded')))).then(go);
      } catch (err) { fail(err && err.message || 'loader error'); }
    }));
    return Promise.all(jobs).then(() => M.warm());
  };
  function findSocketName(scene, cfg, key) {
    const names = [].concat((cfg.sockets || {})[key] || [], SOCKET_ALIASES[key] || []);
    for (const n of names) if (scene.getObjectByName(n)) return n;
    return null;
  }

  M.has = type => !!M.cache[type];

  /* Build a fresh instance: clone (skinned meshes need SkeletonUtils), own materials, mixer. */
  function build(type) {
    const c = M.cache[type], cfg = M.cfg(type) || {};
    const obj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(c.scene) : c.scene.clone(true);
    const fitG = new THREE.Group(); fitG.add(obj); obj.scale.setScalar(c.fit.scale); obj.position.y = c.fit.lift; fitG.rotation.y = cfg.rotY || 0;
    fitG.userData.glbType = type;
    obj.traverse(o => { if (o.isMesh) { if (Array.isArray(o.material)) o.material = o.material.map(m => { const cm = m.clone(); cm.shared = false; return cm; }); else { const cm = o.material.clone(); cm.shared = false; o.material = cm; } } });
    let anim = null;
    if (c.clips.length) {
      const mixer = new THREE.AnimationMixer(obj); const actions = {};
      for (const [key, name] of Object.entries(cfg.anims || {})) { const clip = THREE.AnimationClip.findByName(c.clips, name); if (clip) actions[key] = mixer.clipAction(clip); }
      for (const k of ['attack', 'hit', 'hurt', 'death', 'slash', 'chop', 'thrust', 'cleave', 'smash', 'throw', 'backhand', 'cast', 'dash']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
      anim = { mixer, actions, cur: null };
    }
    const sockets = {}; for (const [k, n] of Object.entries(c.sockets)) sockets[k] = obj.getObjectByName(n) || null;
    return { type, obj: fitG, inner: obj, mats: [], anim, sockets, barH: cfg.barH, height: c.fit.height };
  }
  // the materials the meshes carry right now (toon conversion may have swapped them)
  function collectMats(inst) { const mats = []; inst.obj.traverse(o => { if (o.isMesh && !o.userData.outline) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (mats.indexOf(m) < 0) mats.push(m); }); }); inst.mats = mats; return mats; }

  /* Take an instance: a pooled one if any, otherwise a new one. null when the type has no .glb ready. */
  M.acquire = function (type) {
    if (!M.cache[type]) return null;
    const p = M.pool[type] || (M.pool[type] = []);
    const inst = p.length ? p.pop() : build(type);
    inst.obj.visible = true; inst.obj.position.set(0, 0, 0);
    if (inst.anim) { inst.anim.mixer.stopAllAction(); inst.anim.mixer.setTime(0); inst.anim.cur = null; }
    collectMats(inst);
    for (const m of inst.mats) { if (m.emissive && m.userData.em == null) m.userData.em = m.emissive.getHex(); if (m.emissive) m.emissive.setHex(m.userData.em); if (m.userData.op == null) { m.userData.op = m.opacity; m.userData.tr = m.transparent; } m.opacity = m.userData.op; m.transparent = m.userData.tr; }
    inst.inUse = true; M.stats.acquired++;
    return inst;
  };
  /* Give an instance back: detached from its model, actions stopped, kept for the next spawn. */
  M.release = function (inst) {
    if (!inst || !inst.inUse) return;
    inst.inUse = false; if (inst.obj.parent) inst.obj.parent.remove(inst.obj);
    if (inst.anim) inst.anim.mixer.stopAllAction();
    const cfg = M.cfg(inst.type) || {}; const p = M.pool[inst.type] || (M.pool[inst.type] = []);
    if (p.length < Math.max(cfg.pool || 2, 2) * 2) p.push(inst); M.stats.released++;
  };
  M.stats = { acquired: 0, released: 0, warmed: 0 };
  // old name kept for callers that only need a one-off instance
  M.instance = M.acquire;

  /* Warm-up: build the pool and compile its shaders now, so the first spawn in a fight never stalls. */
  M.warm = function () {
    const R = H.R; if (!R || !R.renderer || !R.scene) return;
    const holder = new THREE.Group(); holder.position.set(0, -500, 0);
    for (const [type, cfg] of M.entries()) {
      if (!M.cache[type]) continue;
      const p = M.pool[type] || (M.pool[type] = []);
      while (p.length < (cfg.pool || 2)) { const inst = build(type); if (R.toonify) R.toonify(inst.obj); p.push(inst); }
      p.forEach(i => holder.add(i.obj));
    }
    if (!holder.children.length) return;
    R.scene.add(holder);
    try { R.renderer.compile(R.scene, R.camera); M.stats.warmed++; } catch (e) { /* compile is a hint; never fatal */ }
    R.scene.remove(holder); for (const c of holder.children.slice()) holder.remove(c);
  };

  M.socket = (inst, key) => (inst && inst.sockets && inst.sockets[key]) || null;
  M.barHeight = type => { const c = M.cfg(type); return M.cache[type] && c && c.barH ? c.barH : null; };

  /* Cross-fade to a clip by key; one-shot clips restart. Unknown keys fall back to idle. */
  M.play = function (anim, key, fade = 0.15, restart = false, speed = 1) {
    if (!anim) return;
    if (!anim.actions[key]) key = anim.actions.idle ? 'idle' : null;
    if (!key) return;
    const next = anim.actions[key];
    next.timeScale = speed;
    if (anim.cur === key && !restart) return;
    const prev = anim.cur && anim.actions[anim.cur];
    if (prev && prev !== next) prev.fadeOut(fade);
    next.reset().setEffectiveWeight(1).fadeIn(prev === next ? 0.04 : fade).play();
    anim.cur = key;
  };
})();
