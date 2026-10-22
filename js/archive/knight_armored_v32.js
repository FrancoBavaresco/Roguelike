/* Archived: the fully-armoured Veteran model from version 32 (kept for reference; not loaded). */
R.makeKnight = function (accent) {
  const THREE = T3(); const TX = R.knightTextures();
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const look = new THREE.Group(); body.add(look);
  // materials: muted, rough (no plastic shine); low-poly flat shading on metal
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9fa6, map: TX.steel, roughness: 0.58, metalness: 0.28, flatShading: true });
  const steelD = new THREE.MeshStandardMaterial({ color: 0x70747a, map: TX.steel, roughness: 0.65, metalness: 0.25, flatShading: true });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.7, metalness: 0.25, flatShading: true });
  const leather = new THREE.MeshStandardMaterial({ color: 0x8a6a50, map: TX.leather, roughness: 0.9, metalness: 0, flatShading: true });
  const leatherD = new THREE.MeshStandardMaterial({ color: 0x5c4434, map: TX.leather, roughness: 0.92, metalness: 0, flatShading: true });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x8a8078, map: TX.cloth, roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true });
  const mail = new THREE.MeshStandardMaterial({ color: 0xb0b4ba, map: TX.mail, roughness: 0.6, metalness: 0.25, flatShading: true });
  const black = R.basic(0x050506);
  const add = (geo, mat, x, y, z, parent) => part(geo, mat, x, y, z, parent || look);
  const regions = {};
  // ---- legs: mail thighs, knee cops, greaves, boots ----
  const legs = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.14, 0.7, 0); body.add(piv);
    add(new THREE.CylinderGeometry(0.1, 0.085, 0.34, 7), mail, 0, -0.17, 0, piv);
    const knee = add(new THREE.SphereGeometry(0.085, 7, 5), steel, 0, -0.33, -0.04, piv); knee.scale.set(1, 0.9, 0.8);
    add(new THREE.ConeGeometry(0.05, 0.1, 5), steelD, 0, -0.33, -0.11, piv).rotation.x = -Math.PI / 2;
    const greave = add(new THREE.CylinderGeometry(0.085, 0.075, 0.3, 7), steel, 0, -0.5, -0.005, piv);
    add(new THREE.BoxGeometry(0.04, 0.26, 0.02), steelD, 0, -0.5, -0.08, piv);                       // greave ridge
    const boot = add(new THREE.BoxGeometry(0.17, 0.14, 0.32), leatherD, 0, -0.64, -0.06, piv); piv.userData.boot = boot;
    add(new THREE.BoxGeometry(0.18, 0.04, 0.34), iron, 0, -0.7, -0.06, piv);                          // sole
    add(new THREE.BoxGeometry(0.15, 0.06, 0.12), steelD, 0, -0.6, -0.17, piv);                        // sabaton toe plate
    legs.push(piv);
  }
  regions.legs = legs;
  // ---- torso: gambeson under a dented breastplate, backplate, faulds ----
  const torso = new THREE.Group(); look.add(torso); regions.torso = torso;
  add(new THREE.CylinderGeometry(0.3, 0.27, 0.62, 9), cloth, 0, 1.28, 0, torso);                       // padded gambeson
  const chest = add(new THREE.SphereGeometry(0.33, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.62), steel, 0, 1.15, 0, torso);
  chest.scale.set(1.0, 1.25, 0.82);                                                                  // breastplate (front+back shell)
  { const a = chest.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) if (a[i + 2] < -0.05 && Math.random() < 0.18) { a[i] *= 0.95; a[i + 1] *= 0.97; a[i + 2] *= 0.9; } chest.geometry.computeVertexNormals(); } // dents
  add(new THREE.BoxGeometry(0.035, 0.42, 0.04), steelD, 0, 1.33, -0.27, torso);                       // centre ridge
  for (let i = 0; i < 3; i++) { const f = add(new THREE.CylinderGeometry(0.29 + i * 0.015, 0.31 + i * 0.02, 0.09, 9, 1, true), steelD, 0, 1.0 - i * 0.075, 0, torso); f.material = steelD; }   // faulds
  const gorget = add(new THREE.CylinderGeometry(0.15, 0.24, 0.12, 9), steelD, 0, 1.6, 0, torso);       // gorget
  // ---- pauldrons: asymmetric (big layered left, smaller right) ----
  const pauldrons = new THREE.Group(); look.add(pauldrons); regions.pauldrons = pauldrons;
  for (let i = 0; i < 3; i++) { const l = add(new THREE.SphereGeometry(0.2 - i * 0.025, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), i ? steelD : steel, -0.36, 1.58 - i * 0.09, 0, pauldrons); l.scale.set(1.25, 0.7, 1.15); l.rotation.z = 0.35 + i * 0.08; }
  add(new THREE.BoxGeometry(0.05, 0.12, 0.2), steel, -0.24, 1.66, 0, pauldrons).rotation.z = 0.2;      // haute-piece
  const rp = add(new THREE.SphereGeometry(0.155, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), steelD, 0.35, 1.55, 0, pauldrons); rp.scale.set(1.1, 0.75, 1.05); rp.rotation.z = -0.35;
  add(new THREE.BoxGeometry(0.1, 0.03, 0.1), leatherD, 0.27, 1.6, -0.1, pauldrons);                    // strap
  // ---- belt + short ragged tabard ----
  const belt = new THREE.Group(); look.add(belt); regions.belt = belt;
  add(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 10), leatherD, 0, 0.93, 0, belt);
  add(new THREE.BoxGeometry(0.1, 0.09, 0.03), iron, 0.05, 0.93, -0.31, belt);
  add(new THREE.BoxGeometry(0.06, 0.06, 0.035), black, 0.05, 0.93, -0.32, belt);
  const pouch = add(new THREE.BoxGeometry(0.14, 0.14, 0.08), leather, -0.24, 0.86, -0.18, belt); pouch.rotation.y = 0.5;
  const tabGeo = (w, h) => { const g = new THREE.PlaneGeometry(w, h, 6, 4); const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 3) if (a[i + 1] < -h / 2 + 0.01) a[i + 1] += 0.06 * Math.abs(Math.sin(a[i] * 37)) + 0.03 * Math.random(); g.translate(0, -h / 2, 0); return g; };
  const tabF = add(tabGeo(0.34, 0.5), cloth, 0, 0.9, -0.33, belt); tabF.rotation.x = 0.06;
  const tabB = add(tabGeo(0.42, 0.55), cloth, 0, 0.9, 0.31, belt); tabB.rotation.x = -0.08;
  regions.tabard = [tabF, tabB];
  // ---- helm: great helm with a narrow eye slit and breaths ----
  const head = new THREE.Group(); head.position.set(0, 1.86, 0); body.add(head); regions.helm = head;
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 7), mail, 0, -0.2, 0, head);                         // mail coif at the neck
  const helm = add(new THREE.CylinderGeometry(0.205, 0.22, 0.4, 8), steel, 0, 0.0, 0, head);
  const dome = add(new THREE.SphereGeometry(0.205, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 0.2, 0, head); dome.scale.y = 0.45;
  add(new THREE.BoxGeometry(0.03, 0.42, 0.06), steelD, 0, 0.05, -0.2, head);                          // nose ridge
  add(new THREE.BoxGeometry(0.34, 0.035, 0.05), black, 0, 0.06, -0.205, head);                        // eye slit
  add(new THREE.BoxGeometry(0.36, 0.022, 0.03), steelD, 0, 0.09, -0.21, head);                        // brow lip
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.015, 0.05, 0.03), black, (k - 1) * 0.045 + 0.08, -0.07 - r * 0.07, -0.21, head); // breaths
  add(new THREE.TorusGeometry(0.21, 0.014, 4, 10), steelD, 0, -0.17, 0, head).rotation.x = Math.PI / 2;
  // dull eyes inside the slit (kept for the rig contract; barely visible)
  const eyeMat = R.basic(0x2a2622);
  const e1 = add(new THREE.BoxGeometry(0.04, 0.012, 0.01), eyeMat, -0.07, 0.06, -0.2, head), e2 = add(new THREE.BoxGeometry(0.04, 0.012, 0.01), eyeMat, 0.07, 0.06, -0.2, head);
  // ---- arms: leather/mail sleeve (scaled to reach), steel vambrace, gauntlet cuff ----
  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.36, 1.52, 0); body.add(piv);
    const sleeve = add(new THREE.CylinderGeometry(0.075, 0.085, 1, 7), mail, 0, -0.5, 0, piv);
    const bracer = add(new THREE.CylinderGeometry(0.085, 0.075, 0.22, 7), steel, 0, -0.84, 0, piv);
    const wrap = add(new THREE.TorusGeometry(0.085, 0.02, 4, 8), leatherD, 0, -0.84, 0, piv); wrap.rotation.x = Math.PI / 2;
    arms.push({ piv, sleeve, bracer, wrap, s: sx });
  }
  // hands: the rig keeps glowing "spell hands"; the visible part is an armoured gauntlet
  const handMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0 });
  const mkHand = (sx) => { const h = part(new THREE.SphereGeometry(0.09, 6, 4), handMat.clone(), sx * 0.45, 1.05, -0.2, body); const g = add(new THREE.BoxGeometry(0.13, 0.12, 0.15), steelD, 0, 0, 0, h); g.rotation.x = 0.2; add(new THREE.BoxGeometry(0.135, 0.05, 0.06), steel, 0, 0.04, -0.08, h); add(new THREE.BoxGeometry(0.05, 0.05, 0.06), steelD, sx * -0.07, -0.01, -0.03, h); return h; };
  const hL = mkHand(-1), hR = mkHand(1);
  const gL = R.glowSprite(accent, 0.5); gL.material.opacity = 0.55; hL.add(gL); const gR = R.glowSprite(accent, 0.5); gR.material.opacity = 0.55; hR.add(gR);
  // ---- optional cloak (only when a cloak item is equipped) ----
  const cloakGeo = new THREE.CylinderGeometry(0.34, 0.56, 1.45, 24, 8, true, -1.62, 3.24);
  { const a = cloakGeo.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const y = a[i + 1], h = (0.725 - y) / 1.45, ang = Math.atan2(a[i], a[i + 2]); a[i] *= 0.95; a[i + 2] = a[i + 2] * 0.75 + 0.1 + h * 0.2; a[i + 1] = y - Math.abs(Math.sin(ang)) * h * 0.06; } cloakGeo.computeVertexNormals(); }
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x2c2826, roughness: 1, side: THREE.DoubleSide });
  const cloak = part(cloakGeo, capeMat, 0, 0.9, 0.06, body); cloak.visible = false;
  const base = cloakGeo.attributes.position.array.slice();
  const mantle = part(new THREE.CylinderGeometry(0.3, 0.5, 0.3, 12, 1, true, Math.PI + 0.36, Math.PI * 2 - 0.72), capeMat, 0, 1.55, 0.02, body); mantle.visible = false;
  const brooch = new THREE.Group(); body.add(brooch); brooch.visible = false;
  // ---- shared rig extras (sigil, shadow, light, defensive shells) ----
  const book = new THREE.Group(); root.add(book); book.visible = false;
  const sig = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: R.texRune, color: accent, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  sig.rotation.x = -Math.PI / 2; sig.position.y = 0.05; root.add(sig);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; root.add(shadow);
  const light = new THREE.PointLight(accent, 1.2, 9, 2); light.position.set(0, 2.3, 0); root.add(light);
  const ward = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3aa8d8, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, flatShading: true, depthWrite: false })); ward.position.y = 1.0; ward.visible = false; root.add(ward);
  const bastion = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0xd99b5f, emissive: 0x6a3a10, emissiveIntensity: 0.5, transparent: true, opacity: 0.5, flatShading: true, depthWrite: false })); bastion.position.y = 1.0; bastion.visible = false; root.add(bastion);
  const mirror = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 4, 32), new THREE.MeshBasicMaterial({ color: 0xbb80ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })); mirror.rotation.x = Math.PI / 2; mirror.position.y = 1; mirror.visible = false; root.add(mirror);
  body.scale.setScalar(1.06);                                                                     // medium-tall, robust
  R.ents.add(root);
  const m = { kind: 'knight', look, regions, capeMat, cloakBase: 0x2c2826, root, body, cloak, cloakGeo, base, aL: null, aR: null, auraCol: accent, mantle, hood: null, head, legs, arms, strap: tabF, brooch, bGlow: null, hL, hR, gL, gR, book, sig, light, ward, bastion, mirror, accent, eyes: [e1, e2], cloth: cloth, castT: 0, castSide: 1, t: Math.random() * 10, walk: 0, lvx: 0, lvz: 0 };
  // external model: swap the procedural look for the .glb, keep the rig
  if (H.models && H.models.has('knight')) { const inst = H.models.instance('knight'); if (inst) { look.visible = false; legs.forEach(l => l.children.forEach(c => c.visible = false)); arms.forEach(a => a.piv.children.forEach(c => c.visible = false)); head.children.forEach(c => c.visible = false); [hL, hR].forEach(h => h.children.forEach(c => { if (c.isMesh) c.visible = false; })); body.add(inst.obj); m.glb = inst; m.anim = inst.anim; } }
  return m;
};
