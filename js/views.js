'use strict';
/* HEXWRIGHT — views: the only place where game entities meet their 3D models.
   create(entity) builds the model when a hero or enemy appears, release(entity) frees it, and
   sync(dt) poses every model once per rendered frame from the entity's state (position, ai state,
   p.anim, timers). The simulation never animates models; it runs at a fixed 1/60 s and the view
   follows at the screen's own rate. A type with a ready .glb in the model registry (models.js) gets a
   pooled instance inside its model; any other type keeps its procedural model from render.js. */
const V = H.views = {};

/* Build the model for a hero or an enemy. Called at spawn time (inside the simulation step) so the
   order of model building stays the same. */
V.create = function (ent, o = {}) {
  const R = H.R;
  if (ent.kind === 'player') ent.model = R.makeHero(ent.charId, o.accent, o.cloak);
  else ent.model = ent.def.boss ? R.makeBoss(ent.type) : R.makeEnemy(ent.type, !!ent.elite);
  return ent.model;
};

/* Free the model of an entity leaving the game (dead enemy removed, room or run cleared). */
V.release = function (ent) {
  if (!ent || !ent.model) return;
  // a pooled .glb goes back to the registry before the rest of the model is disposed
  if (ent.model.glbInst && H.models) { H.models.release(ent.model.glbInst); ent.model.glbInst = null; }
  H.R.removeMesh(ent.model.root);
  if (ent._carrow) { H.R.removeMesh(ent._carrow); ent._carrow = null; }
};

/* Pose every hero and enemy model. dt is the simulated time this frame (0 while paused or in hit-stop). */
V.sync = function (dt) {
  const G = H.G, R = H.R;
  if (!G.active) return;
  for (const p of G.players) {
    if (!p.model) continue;
    if (p.dead) { R.setModelVisible(p.model, false); if (R.trail) R.trail.clear(p.model); if (R.slashFx) R.slashFx.clear(p.model); continue; }
    R.animateRogue(p.model, p, dt);
  }
  for (const e of G.enemies) {
    if (!e.model) continue;
    if (e.dead) R.animateDying(e.model, e, dt);
    else R.animateEnemy(e.model, e, dt);
  }
};
