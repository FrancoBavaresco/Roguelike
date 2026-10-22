'use strict';
/* HEXWRIGHT — external 3D models (.glb) for enemies.
   Files live next to the game in public/models/enemies/. They are loaded once at boot with the
   bundled GLTFLoader (js/vendor, no network service). If a file is missing or disabled, the enemy
   keeps its procedural prototype built in render.js, so the game always works. */
(function () {
  const M = H.models = { cache: {}, status: {} };
  /* One entry per enemy type that can use a .glb.
     enabled: set to true once the file exists in public/models/enemies/.
     scale / rotY / yOffset: fit the model to the game (1 unit = 1 m, the model should face −Z).
     anims: names of the clips inside the .glb (any missing one is simply skipped).
     tint: optional colour multiplied into the materials (null keeps the file's colours). */
  H.ENEMY_MODELS = {
    bone_stalker: { url: 'public/models/enemies/bone_stalker.glb', enabled: false, scale: 1, rotY: 0, yOffset: 0, tint: null,
      anims: { idle: 'Idle', run: 'Run', windup: 'Crouch', attack: 'Pounce', hit: 'Hit', death: 'Death' } }
  };
  /* Playable heroes that can use a .glb (public/models/characters/). Clips map to the hero's states. */
  H.PLAYER_MODELS = {
    knight: { url: 'public/models/characters/knight.glb', enabled: false, scale: 1, rotY: 0, yOffset: 0, tint: null,
      anims: { idle: 'Idle', run: 'Run', cast: 'Cast', dash: 'Dash', hurt: 'Hit', death: 'Death' } }
  };
  const cfgOf = type => H.ENEMY_MODELS[type] || H.PLAYER_MODELS[type];
  M.load = function () {
    if (!window.THREE || !THREE.GLTFLoader) return Promise.resolve();
    const loader = new THREE.GLTFLoader();
    const jobs = Object.entries(Object.assign({}, H.ENEMY_MODELS, H.PLAYER_MODELS)).filter(([, c]) => c.enabled).map(([type, cfg]) => new Promise(res => {
      M.status[type] = 'loading';
      loader.load(cfg.url, gltf => {
        // mark geometry/materials as shared so removing one enemy never disposes the template
        gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.geometry) o.geometry.shared = true; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (!m) return; m.shared = true; if (cfg.tint != null && m.color) m.color.multiply(new THREE.Color(cfg.tint)); }); } });
        M.cache[type] = { scene: gltf.scene, clips: gltf.animations || [] }; M.status[type] = 'ready'; res();
      }, undefined, err => { M.status[type] = 'missing'; console.warn('[models] ' + cfg.url + ' not loaded, using prototype.', err && err.message); res(); });
    }));
    return Promise.all(jobs);
  };
  M.has = type => !!M.cache[type];
  /* Clone the template (skinned meshes need SkeletonUtils) and set up an AnimationMixer. */
  M.instance = function (type) {
    const c = M.cache[type], cfg = cfgOf(type); if (!c) return null;
    const obj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(c.scene) : c.scene.clone(true);
    obj.scale.setScalar(cfg.scale || 1); obj.rotation.y = cfg.rotY || 0; obj.position.y = cfg.yOffset || 0;
    const mats = []; obj.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m, i) => { const cm = m.clone(); cm.shared = false; if (Array.isArray(o.material)) o.material[i] = cm; else o.material = cm; mats.push(cm); }); } });
    let anim = null;
    if (c.clips.length) {
      const mixer = new THREE.AnimationMixer(obj); const actions = {};
      for (const [key, name] of Object.entries(cfg.anims || {})) { const clip = THREE.AnimationClip.findByName(c.clips, name); if (clip) actions[key] = mixer.clipAction(clip); }
      for (const k of ['attack', 'hit', 'hurt', 'death']) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
      anim = { mixer, actions, cur: null };
    }
    return { obj, mats, anim };
  };
  /* Cross-fade to a clip by key; one-shot clips restart. */
  M.play = function (anim, key, fade = 0.15) {
    if (!anim || !anim.actions[key] || anim.cur === key) return;
    const next = anim.actions[key], prev = anim.cur && anim.actions[anim.cur];
    next.reset().setEffectiveWeight(1).fadeIn(fade).play(); if (prev) prev.fadeOut(fade);
    anim.cur = key;
  };
})();
