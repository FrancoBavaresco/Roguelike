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
  H.PLAYER_MODELS = {
    knight: { url: 'public/models/characters/knight.glb', enabled: false, fallback: 'procedural', height: 1.9, rotY: 0, yOffset: 0, tint: null, pool: 1,
      sockets: { hand_R: 'hand_R', hand_L: 'hand_L', head: 'head', spine: 'spine' },
      anims: { idle: 'Idle', run: 'Run', cast: 'Cast', dash: 'Dash', hurt: 'Hit', death: 'Death' } }
  };
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
        loader.load(cfg.url, gltf => {
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
            const clips = gltf.animations || [];
            const missing = Object.entries(cfg.anims || {}).filter(([, n]) => !THREE.AnimationClip.findByName(clips, n)).map(([k]) => k);
            const sockets = {}; for (const k of Object.keys(SOCKET_ALIASES)) { const n = findSocketName(scene, cfg, k); if (n) sockets[k] = n; }
            M.cache[type] = { scene, clips, fit, sockets };
            M.report[type] = { height: +fit.height.toFixed(2), clips: clips.map(c => c.name), missingClips: missing, sockets: Object.keys(sockets) };
            M.status[type] = 'ready';
            res();
          } catch (err) { fail(err && err.message || 'bad file'); }
        }, undefined, err => fail(err && err.message || 'not found'));
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
      for (const k of ['attack', 'hit', 'hurt', 'death', 'slash', 'thrust', 'cleave', 'smash', 'throw', 'backhand']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
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
  M.play = function (anim, key, fade = 0.15) {
    if (!anim) return;
    if (!anim.actions[key]) key = anim.actions.idle ? 'idle' : null;
    if (!key || anim.cur === key) return;
    const next = anim.actions[key], prev = anim.cur && anim.actions[anim.cur];
    next.reset().setEffectiveWeight(1).fadeIn(fade).play(); if (prev) prev.fadeOut(fade);
    anim.cur = key;
  };
})();
