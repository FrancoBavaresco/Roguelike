'use strict';
/* HEXWRIGHT — content data: elements, statuses, reactions, spells, charms, boons, enemies, nodes, depths, milestones */

H.EL = {
  ember: { name: 'Ember', color: 0xff6a2b, css: '#ff7a3d', status: 'burn', blurb: 'Burns over time. Pairs violently with Frost and Venom.' },
  frost: { name: 'Frost', color: 0x7fe3ff, css: '#8fe8ff', status: 'chill', blurb: 'Frostbite drains life; three stacks freeze a foe solid.' },
  volt: { name: 'Volt', color: 0xffe14a, css: '#ffe45c', status: 'shock', blurb: 'Leaves foes Vulnerable: they take more damage and conduct reactions.' },
  venom: { name: 'Venom', color: 0x8fe64e, css: '#9de85d', status: 'poison', blurb: 'Stacking poison. Rewards sustained pressure.' },
  gale: { name: 'Gale', color: 0xc9fff0, css: '#c8f7ea', status: 'gust', blurb: 'Knockback and interrupts. Spreads other statuses.' },
  stone: { name: 'Stone', color: 0xd99b5f, css: '#dca16a', status: 'sunder', blurb: 'Breaks foes: slows them 60%, drops shields, shatters the frozen.' },
  void: { name: 'Void', color: 0xb36bff, css: '#bb80ff', status: 'hex', blurb: 'Pulls foes together. Curses lower max life; Cursed collapses any other status.' }
};
H.EL_ORDER = ['ember', 'frost', 'volt', 'venom', 'gale', 'stone', 'void'];

H.STATUS = {
  // elemental statuses (spells apply them; some foes inflict them on you too)
  burn: { name: 'Burn', el: 'ember', dur: 3, max: 3, dot: 2.4, pdot: 2, desc: 'Life drains a little at a time. Stacks, lasts 3 s.' },
  chill: { name: 'Frostbite', el: 'frost', dur: 6, max: 3, dot: 1.4, pdot: 1.5, desc: 'Life drains a little at a time. Stacks, lasts 6 s. Three stacks freeze a foe solid.' },
  shock: { name: 'Vulnerable', el: 'volt', dur: 4, max: 1, vuln: 0.2, desc: 'Takes 20% more damage.' },
  poison: { name: 'Poison', el: 'venom', dur: 5, max: 8, dot: 1.2, pdot: 1, desc: 'Life drains a little at a time. Stacks, lasts 5 s.' },
  gust: { name: 'Buffeted', el: 'gale', dur: 1.6, max: 1, desc: 'Knocked off balance; shields drop.' },
  sunder: { name: 'Broken', el: 'stone', dur: 4, max: 1, slow: 0.6, desc: 'Moves 60% slower. Shields drop.' },
  hex: { name: 'Cursed', el: 'void', dur: 4.5, max: 1, cap: 0.15, desc: 'Max life reduced by 15%, plus one random extra effect.' },
  // effects without an element
  bleed: { name: 'Bleeding', dur: 10, max: 5, dot: 0.5, pdot: 0.5, color: 0xc0182c, css: '#e0303f', glyph: 'st_bleed', inert: true, desc: 'Life drains a little at a time. Stacks, lasts 10 s.' },
  daze: { name: 'Dazed', dur: 2, max: 1, slow: 0.7, color: 0xf2e6a0, css: '#f0e3a0', glyph: 'st_daze', inert: true, desc: 'Moves 70% slower.' },
  flay: { name: 'Flayed', dur: 6, max: 1, cap: 0.4, color: 0x9a2a3a, css: '#c8485a', glyph: 'st_flay', inert: true, desc: 'Max life heavily reduced (40%).' },
  regen: { name: 'Mending', dur: 5, max: 3, buff: true, color: 0x7ee08a, css: '#86e892', glyph: 'st_regen', inert: true, desc: 'Life rises a little at a time.' },
  heal: { name: 'Healing', instant: true, buff: true, color: 0xffd27a, css: '#ffd27a', glyph: 'st_heal', inert: true, desc: 'Instantly restores a percentage of max life.' }
};
H.statusCss = k => { const d = H.STATUS[k]; return d.css || (H.EL[d.el] ? H.EL[d.el].css : '#fff'); };
H.statusColor = k => { const d = H.STATUS[k]; return d.color != null ? d.color : (H.EL[d.el] ? H.EL[d.el].color : 0xffffff); };
H.statusGlyph = k => { const d = H.STATUS[k]; return d.glyph || d.el; };

H.REACTIONS = {
  steam: { name: 'Steamburst', a: 'burn', b: 'chill', color: 0xfff0d8, desc: 'Burn + Frostbite. A scalding blast hits everything nearby.' },
  conduct: { name: 'Conduction', a: 'chill', b: 'shock', color: 0xbff6ff, desc: 'Frostbite + Vulnerable. Lightning arcs to 3 nearby foes and stuns them.' },
  blight: { name: 'Blight Flare', a: 'burn', b: 'poison', color: 0xd8ff6a, desc: 'Burn + Poison. Explodes and spreads poison to neighbours.' },
  paralysis: { name: 'Paralysis', a: 'poison', b: 'shock', color: 0xe6ff7a, desc: 'Poison + Vulnerable. Locks the target in place for 2 seconds.' },
  overload: { name: 'Overload', a: 'burn', b: 'shock', color: 0xffc860, desc: 'Burn + Vulnerable. Concussive blast that hurls foes away.' },
  shatter: { name: 'Shatter', a: 'chill', b: 'sunder', color: 0xe8f8ff, desc: 'Frostbite or Freeze + Broken. Massive single-target damage.' },
  tempest: { name: 'Tempest', a: 'gust', b: '*', color: 0xe0fff6, desc: 'Gale + any elemental status. Copies that status onto every foe nearby.' },
  collapse: { name: 'Collapse', a: 'hex', b: '*', color: 0xd7a6ff, desc: 'Cursed + any elemental status. Drags foes inward and detonates all statuses.' }
};
H.reactionFor = function (s1, s2) {
  if (s1 === s2) return null;
  if ((H.STATUS[s1] && H.STATUS[s1].inert) || (H.STATUS[s2] && H.STATUS[s2].inert)) return null;
  if (s1 === 'hex' || s2 === 'hex') return 'collapse';
  if (s1 === 'gust' || s2 === 'gust') return 'tempest';
  const k = [s1, s2].sort().join('+');
  return { 'burn+chill': 'steam', 'chill+shock': 'conduct', 'burn+poison': 'blight', 'poison+shock': 'paralysis', 'burn+shock': 'overload', 'chill+sunder': 'shatter' }[k] || null;
};

/* Spells. kind decides behaviour in game.js. Numbers are rank I. */
H.SPELLS = {
  cinder_bolt: { name: 'Cinder Bolt', el: 'ember', role: 'attack', kind: 'projectile', cd: 0.42, cost: 0, range: 16, dmg: 13, speed: 30, pierce: 0, status: 'burn', stacks: 1, start: true,
    desc: s => `Fast bolt dealing ${s.dmg} and applying Burn. Free to cast.` },
  pyre_nova: { name: 'Pyre Nova', el: 'ember', role: 'attack', kind: 'nova', cd: 6, cost: 30, range: 4.2, dmg: 30, status: 'burn', stacks: 2, knock: 9, embers: 40,
    desc: s => `Erupt in a ${s.area.toFixed(1)}m ring of fire for ${s.dmg}, Burn ×2 and knockback.` },
  flame_wake: { name: 'Flame Wake', el: 'ember', role: 'movement', kind: 'dashTrail', cd: 5, cost: 15, range: 8, dmg: 9, status: 'burn', stacks: 1, milestone: 'warden1',
    desc: s => `Surge ${s.range.toFixed(0)}m, untouchable, leaving fire that deals ${s.dmg}/s and Burns.` },
  rime_shard: { name: 'Rime Shard', el: 'frost', role: 'attack', kind: 'projectile', cd: 0.7, cost: 6, range: 15, dmg: 11, speed: 24, pierce: 3, status: 'chill', stacks: 1, start: true,
    desc: s => `Piercing shard: ${s.dmg} to every foe in a line. Applies Frostbite.` },
  glacier_ward: { name: 'Glacier Ward', el: 'frost', role: 'defense', kind: 'ward', cd: 10, cost: 25, range: 0, dmg: 12, absorb: 45, dur: 5, status: 'chill', stacks: 2, start: true,
    desc: s => `Ice shell absorbs ${Math.round(s.absorb)} damage for 5s. When it breaks or ends it bursts for ${s.dmg} and Frostbite ×2.` },
  frost_snare: { name: 'Frost Snare', el: 'frost', role: 'control', kind: 'snare', cd: 7, cost: 25, range: 12, dmg: 12, status: 'chill', stacks: 3, interrupt: true, milestone: 'interrupts20',
    desc: s => `Rune at the target freezes everything inside after 0.45s (${s.dmg} dmg). Interrupts.` },
  arc_lash: { name: 'Arc Lash', el: 'volt', role: 'attack', kind: 'chain', cd: 0.95, cost: 9, range: 10, dmg: 11, jumps: 3, status: 'shock', stacks: 1, start: true,
    desc: s => `Lightning locks on and leaps between ${s.jumps + 1} foes for ${s.dmg} each. Shocks.` },
  blink_volt: { name: 'Blink Volt', el: 'volt', role: 'movement', kind: 'blink', cd: 4.5, cost: 20, range: 9, dmg: 14, status: 'shock', stacks: 1, embers: 35,
    desc: s => `Teleport up to ${s.range.toFixed(0)}m. Both ends discharge for ${s.dmg} and Vulnerable.` },
  storm_totem: { name: 'Storm Totem', el: 'volt', role: 'control', kind: 'totem', cd: 12, cost: 35, range: 10, dmg: 8, dur: 6, status: 'shock', stacks: 1, milestone: 'reactions50',
    desc: s => `Plant a totem for 6s that zaps the nearest foe every 0.5s for ${s.dmg}. Foes target it.` },
  hex_spit: { name: 'Hex Spit', el: 'venom', role: 'attack', kind: 'cone', cd: 0.75, cost: 5, range: 6.5, dmg: 7, angle: 50, status: 'poison', stacks: 2, start: true,
    desc: s => `Short spray: ${s.dmg} and Poison ×2 to all foes in a cone.` },
  miasma: { name: 'Miasma', el: 'venom', role: 'control', kind: 'cloud', cd: 10, cost: 30, range: 11, dmg: 4, dur: 5, status: 'poison', stacks: 1, milestone: 'arena10',
    desc: s => `A choking cloud for 5s. Slows foes and stacks Poison twice per second.` },
  gust_fan: { name: 'Gust Fan', el: 'gale', role: 'control', kind: 'cone', cd: 3.2, cost: 14, range: 7.5, dmg: 6, angle: 75, knock: 16, interrupt: true, deflect: true, status: 'gust', stacks: 1, start: true,
    desc: s => `Blast foes back, interrupt casts and erase hostile bolts in a wide cone.` },
  zephyr_step: { name: 'Zephyr Step', el: 'gale', role: 'movement', kind: 'dash', cd: 5.5, cost: 10, range: 10, dmg: 5, status: 'gust', stacks: 1, start: true,
    desc: s => `Long untouchable dash (${s.range.toFixed(0)}m). Refunds a dash charge; buffets foes you pass.` },
  cyclone: { name: 'Cyclone', el: 'gale', role: 'control', kind: 'cyclone', cd: 9, cost: 30, range: 12, dmg: 5, dur: 2.6, status: 'gust', stacks: 1, milestone: 'coopwin', embers: 60,
    desc: s => `A drifting twister drags foes along for 2.6s, ${s.dmg} per tick. Spreads statuses.` },
  quake_spike: { name: 'Quake Spike', el: 'stone', role: 'control', kind: 'line', cd: 5, cost: 20, range: 10, dmg: 18, status: 'sunder', stacks: 1, stun: 0.8, interrupt: true, start: true,
    desc: s => `Spikes erupt in a line: ${s.dmg} damage, brief stun, Broken. Interrupts.` },
  bastion: { name: 'Bastion', el: 'stone', role: 'defense', kind: 'bastion', cd: 12, cost: 25, range: 0, dmg: 8, dur: 3.5, status: 'sunder', stacks: 1, embers: 30,
    desc: s => `Stone skin for 3.5s: take 65% less damage, ignore knockback, Broken attackers.` },
  boulder: { name: 'Hurled Cairn', el: 'stone', role: 'attack', kind: 'projectile', cd: 2.6, cost: 18, range: 14, dmg: 30, speed: 17, pierce: 0, radius: 0.75, knock: 12, interrupt: true, status: 'sunder', stacks: 1, milestone: 'depth2',
    desc: s => `Heavy stone: ${s.dmg} damage, knockback and Broken. Interrupts.` },
  rift_orb: { name: 'Rift Orb', el: 'void', role: 'attack', kind: 'orb', cd: 6, cost: 28, range: 12, dmg: 22, speed: 7.5, status: 'hex', stacks: 1, start: true,
    desc: s => `Slow orb that drags foes in, then collapses for ${s.dmg} and Cursed.` },
  null_mirror: { name: 'Null Mirror', el: 'void', role: 'defense', kind: 'mirror', cd: 8, cost: 20, range: 0, dmg: 16, dur: 1.6, status: 'hex', stacks: 1, milestone: 'warden2', embers: 50,
    desc: s => `For 1.6s, hostile bolts touching you are flung back as ${s.dmg}-damage Cursed bolts.` },
  gravity_well: { name: 'Gravity Well', el: 'void', role: 'control', kind: 'well', cd: 11, cost: 35, range: 11, dmg: 26, dur: 2.2, status: 'hex', stacks: 1, interrupt: true, milestone: 'warden2b', embers: 70,
    desc: s => `Pull foes into a point for 2.2s, then implode for ${s.dmg}. Interrupts.` }
};
for (const k in H.SPELLS) H.SPELLS[k].id = k;
H.ROLE_INFO = {
  attack: { name: 'Attack', css: '#e9dfc8' },
  movement: { name: 'Movement', css: '#a8f0dc' },
  defense: { name: 'Defense', css: '#9cc8ff' },
  control: { name: 'Control', css: '#e0b0ff' }
};
H.MAX_RANK = 4;
H.spellStats = function (id, rank, owner) {
  const d = H.SPELLS[id]; const br = !!(d.kit || d.ups); const r = br ? 1 : (rank || 1);
  const u = (br && d.ups && owner && owner.ups && owner.ups[id]) || {};
  let dmg = d.dmg * (1 + 0.24 * (r - 1));
  let cd = d.cd * (1 - 0.085 * (r - 1));
  const area = (d.range || 0) * (d.kind === 'nova' ? 1 + 0.1 * (r - 1) : 1);
  let cost = d.cost;
  const ch = owner && owner.charms;
  if (ch) {
    if (ch.has('quicksilver')) cd *= 0.88;
    if (ch.has('glass_edge')) dmg *= 1.25;
  }
  const gr = owner && owner.gear; if (gr) { dmg *= 1 + (gr.spell || 0) + (d.el === 'ember' ? gr.fire || 0 : 0); cd *= 1 - Math.min(0.4, gr.cdr || 0); }
  if (d.ups) { dmg *= 1 + (d.ups.dmg || 0) * (u.dmg || 0); cd *= 1 - (d.ups.cd || 0) * (u.cd || 0); }
  if (d.hero && owner && owner.attrs && owner.attrs.battle_rhythm && d.cd >= 1) cd *= 1 - 0.06 * owner.attrs.battle_rhythm;
  if (d.weapon && gr) dmg *= 1 + (gr.wdmg || 0);
  const radius = (d.radius || 0) + ((d.ups && d.ups.area) || 0) * (u.area || 0);
  const dur = (d.dur || 0) + ((d.ups && d.ups.dur) || 0) * (u.dur || 0);
  const kitRange = d.ups ? (d.ups.range || 0) * (u.range || 0) : 0;
  const haste = (d.haste || 0) + ((d.ups && d.ups.haste) || 0) * (u.haste || 0);
  const bounces = (d.bounces || 0) + ((d.ups && d.ups.bounce) || 0) * (u.bounce || 0);
  return { bounces, haste, radius, dur, dmg: Math.round(dmg), cd, cost, range: kitRange + d.range * (d.kind === 'blink' || d.kind === 'dash' || d.kind === 'dashTrail' ? 1 + 0.06 * (r - 1) : 1), area, jumps: (d.jumps || 0) + (r >= 3 ? 1 : 0) + (ch && ch.has('coil') ? 1 : 0), absorb: (d.absorb || 0) * (1 + 0.2 * (r - 1)), rank: r };
};

/* Charms: passive relics found during a run */
H.CHARMS = {
  kindling: { name: 'Kindling Heart', el: 'ember', desc: 'Burn deals 60% more damage and lasts 1s longer.' },
  hoarfrost: { name: 'Hoarfrost Crown', el: 'frost', desc: 'Foes freeze at 2 Frostbite stacks instead of 3.' },
  static_sigil: { name: 'Static Sigil', el: 'volt', desc: 'Hitting a Vulnerable foe arcs 6 damage to a neighbour.' },
  spare_breath: { name: 'Spare Breath', el: 'gale', desc: '+1 dash charge.' },
  quicksilver: { name: 'Quicksilver Veins', el: 'volt', desc: 'All spell cooldowns 12% shorter.' },
  deep_well: { name: 'Deep Well', el: 'void', desc: '+30 max mana and 25% faster mana regeneration.' },
  blood_ward: { name: 'Blood Ward', el: 'venom', desc: 'Heal 3 HP whenever you trigger a reaction.' },
  catalyst: { name: 'Catalyst Ring', el: 'void', desc: 'Reaction damage +45%.' },
  glass_edge: { name: 'Glass Edge', el: 'ember', desc: 'Spells deal 25% more damage. Max HP -15.' },
  ironbark: { name: 'Ironbark Knot', el: 'stone', desc: '+25 max HP.' },
  rift_heel: { name: 'Rift-Touched Heel', el: 'void', desc: 'Dashing tears the air: 10 damage and Cursed along your path.' },
  venom_ink: { name: 'Venomous Ink', el: 'venom', desc: 'Attack spells also apply 1 Poison.' },
  second_wind: { name: 'Second Wind', el: 'gale', desc: 'Once per chamber, a lethal blow leaves you at 1 HP instead.' },
  tempo_loop: { name: 'Tempo Loop', el: 'gale', desc: 'The first spell within 1.5s of a dash recovers 40% faster.' },
  hunters_mark: { name: "Hunter's Mark", el: 'stone', desc: 'Elites and Wardens take 18% more damage.' },
  coil: { name: 'Conductive Coil', el: 'volt', desc: 'Chain spells jump once more; projectiles fly 15% faster.' },
  ember_bloom: { name: 'Ember Bloom', el: 'ember', desc: 'Foes that die while Burning explode for 14 damage.' },
  cold_blood: { name: 'Cold Blood', el: 'frost', desc: 'Taking damage chills nearby foes.' }
};
for (const k in H.CHARMS) H.CHARMS[k].id = k;
H.CHARM_LOCKED = { ember_bloom: { embers: 30 }, cold_blood: { embers: 30 }, tempo_loop: { milestone: 'elite10' }, rift_heel: { embers: 45 } };

H.BOONS = {
  none: { name: 'Bare Hands', desc: 'No boon. Pure run.' },
  ironbark: { name: 'Ironbark Seed', desc: 'Start with +15 max HP.' },
  spare_breath: { name: 'Spare Breath', desc: 'Start with +1 dash charge.', milestone: 'first_steps' },
  attuned: { name: 'Attuned Start', desc: 'Your slot I spell starts at rank II.', embers: 40 },
  scholar: { name: "Scholar's Eye", desc: 'Reward choices show 4 options instead of 3.', embers: 60 },
  ember_purse: { name: 'Gold Purse', desc: 'Earn 25% more gold coins this run.', milestone: 'depth2' },
  regent_ash: { name: "Regent's Ash", desc: 'Once per run, revive at 50% HP.', milestone: 'victory' }
};

/* Enemies. Behaviour lives in enemies.js */
H.ENEMIES = {
  husk: { cls: 'undead', name: 'Husk', hp: 44, speed: 3.6, r: 0.55, mass: 1, cost: 1, minDepth: 1, dmg: 11, color: 0x8a7a92, desc: 'Lunges after a short wind-up.' },
  spitter: { cls: 'aberration', inflict: 'poison', name: 'Bile Spitter', hp: 32, speed: 2.8, r: 0.55, mass: 0.9, cost: 1.2, minDepth: 1, dmg: 10, color: 0x7a8f52, desc: 'Keeps its distance and spits bile in a line.' },
  wisp: { cls: 'elemental', el: 'ember', name: 'Cinder Wisp', hp: 15, speed: 6.2, r: 0.4, mass: 0.5, cost: 0.6, minDepth: 1, minLayer: 1, dmg: 14, color: 0xff5a7a, desc: 'Rushes in and detonates.' },
  hexcaster: { cls: 'caster', inflict: 'hex', name: 'Hexcaster', hp: 52, speed: 2.3, r: 0.55, mass: 1, cost: 1.7, minDepth: 1, minLayer: 2, dmg: 15, color: 0x6b4fa0, desc: 'Channels curse circles. Interrupt the channel.' },
  shieldbearer: { cls: 'humanoid', name: 'Gaol Warden', hp: 82, speed: 2.7, r: 0.75, mass: 2.2, cost: 1.9, minDepth: 2, dmg: 14, color: 0x7c6e66, desc: 'Its slab shield blocks bolts from the front. Flank, stun or sunder it.' },
  brute: { cls: 'giant', name: 'Chain Brute', hp: 155, speed: 2.4, r: 1.0, mass: 4, cost: 2.6, minDepth: 2, dmg: 22, color: 0x8e5b4d, desc: 'Charges in a line. Make it hit a pillar to stun it.' },
  bone_stalker: { cls: 'undead', inflict: 'bleed', name: 'Bone Stalker', hp: 46, speed: 5.0, r: 0.6, mass: 1.2, cost: 1.4, minDepth: 1, minLayer: 2, dmg: 16, color: 0xcfc4ae, desc: 'Circles you, then pounces where you stand. Dash out of the landing circle.' },
  summoner: { cls: 'caster', name: 'Candle Abbess', hp: 70, speed: 2.4, r: 0.6, mass: 1, cost: 2.2, minDepth: 3, dmg: 0, color: 0xd8c58e, desc: 'Channels to summon wisps. Interrupt her.' },
  dummy: { name: 'Training Effigy', hp: 9999, speed: 0, r: 0.6, mass: 99, cost: 0, minDepth: 99, dmg: 0, color: 0x9c8c70 },
  turret: { name: 'Effigy Thrower', hp: 9999, speed: 0, r: 0.6, mass: 99, cost: 0, minDepth: 99, dmg: 8, color: 0x9c8c70 },
  gaolwright: { cls: 'giant', name: 'The Gaolwright', title: 'Keeper of the Lower Cells', hp: 1050, speed: 2.6, r: 1.6, mass: 30, boss: true, dmg: 18, color: 0x6e6170 },
  kiln_saint: { cls: 'demon', name: 'The Kiln Saint', title: 'Mother of Cinders', hp: 1750, speed: 2.2, r: 1.5, mass: 30, boss: true, dmg: 16, color: 0xa65a38 },
  hollow_regent: { cls: 'spirit', name: 'The Hollow Regent', title: 'Who Wears the Empty Crown', hp: 2800, speed: 3, r: 1.4, mass: 30, boss: true, dmg: 18, color: 0x3e3a5c },
  regent_echo: { cls: 'spirit', name: 'Hollow Echo', hp: 140, speed: 3, r: 1.1, mass: 6, dmg: 9, color: 0x2e2a4a }
};
/* Enemy classes (families). Traits/weaknesses marked with mods are live; the rest are reference for future foes. */
H.CLASSES = {
  undead: { name: 'Undead', desc: 'Creatures that came back from death.', ex: 'Zombie, skeleton, mummy', trait: 'May rise again once after dying.', weak: 'Low life. Take more blunt damage (fists, maces, Stone spells). Silver swords: double damage and no rising.', css: '#cfc4ae', revive: 0.3, blunt: 1.5 },
  beast: { name: 'Beast', desc: 'Wild animals.', ex: 'Wolf, bear', trait: 'Medium magic resistance, high cold resistance, medium speed. Heavy hits that can cause Bleeding.', weak: 'Fire, piercing weapons (spears) and ranged weapons (bows, crossbows).', css: '#b98a5a' },
  construct: { name: 'Construct', desc: 'Beings made with magic or machinery.', ex: 'Stone golem, iron golem, clockwork automaton', trait: 'High magic and physical resistance. Immune to arrows and bolts. Heavy area slams.', weak: 'Slow movement. Long attack cooldown.', css: '#9aa3ad' },
  elemental: { name: 'Elemental', desc: 'Beings formed by raw forces: fire, ice, plant, air, water.', ex: 'Fire, ice, plant, air, water, magma or acid elemental', trait: 'Their hits leave their element\'s effect on you.', weak: 'Short reach. Fire fears water; ice and plant fear fire; air and water fear magic.', css: '#ff8a4a', inflict: true },
  humanoid: { name: 'Humanoid', desc: 'Human-like anatomy and behaviour.', ex: 'Bandit, mercenary, fallen knight', trait: 'Physical damage, medium speed. Some dash out of attacks or carry equipment.', weak: 'Effects deal them double damage. Hurt badly by physical and magic damage when unarmoured.', css: '#d6b98a', dotMul: 2 },
  aberration: { name: 'Aberration', desc: 'Strange, deformed, unnatural creatures.', ex: 'Mutant, spawn, tentacled horror', trait: 'High magic resistance (spells deal 25% less). Fast, moderate attacks.', weak: 'Piercing weapons and silver swords.', css: '#9de85d', magicRes: 0.25, pierce: 1.5 },
  dragon: { name: 'Dragon', desc: 'Mythic reptiles and draconic beasts.', ex: 'Dragon, wyvern', trait: 'Immune to physical attacks. Medium magic resistance.', weak: 'None.', css: '#e05a3a' },
  plant: { name: 'Plant', desc: 'Hostile vegetation.', ex: 'Carnivorous vine, forest spirit, pea shooter', trait: 'Regenerates life every so often.', weak: 'Takes huge damage from fire. Hurt badly by blades (swords, axes).', css: '#6fbf5a' },
  spirit: { name: 'Spirit', desc: 'Incorporeal or magical entities.', ex: 'Ghost, wraith, lost soul', trait: 'Turns ethereal every so often (immune while ethereal).', weak: 'Blessed weapons deal double damage (coming later).', css: '#8fd8e8', ethereal: true },
  giant: { name: 'Giant', desc: 'Huge creatures of brute strength.', ex: 'Ogre, troll', trait: 'Heavy area damage. Their slams can leave you Dazed.', weak: 'Slow movement. Long attack cooldown.', css: '#c8805a', daze: true },
  insectoid: { name: 'Insectoid', desc: 'Giant insects and arthropods.', ex: 'Armoured beetle, giant mantis', trait: 'Very mobile, fast attacks that are hard to dodge.', weak: 'Magic and fire.', css: '#b4c84a' },
  demon: { name: 'Demon', desc: 'Supernatural, infernal creatures.', ex: 'Fire demon, hellguard, imp', trait: 'Cursed attacks (Cursed: lower max life plus a random effect). May summon fire elementals.', weak: 'White magic; blessed weapons.', css: '#ff4a5a', curse: true },
  caster: { name: 'Summoner', desc: 'Beings with magical gifts.', ex: 'Hexcaster, Candle Abbess', trait: 'Channel spells that can be interrupted.', weak: 'Interrupts.', css: '#bb80ff' }
};
H.CLASS_ORDER = ['undead', 'beast', 'construct', 'elemental', 'humanoid', 'aberration', 'dragon', 'plant', 'spirit', 'giant', 'insectoid', 'demon', 'caster'];
H.classOf = e => { const c = (e.def || H.ENEMIES[e.type] || {}).cls; return c ? H.CLASSES[c] : null; };

H.ELITE_AFFIXES = {
  hasted: { name: 'Hasted', desc: 'Moves and winds up faster.' },
  warded: { name: 'Warded', desc: 'Regenerates if left alone.' },
  volatile: { name: 'Volatile', desc: 'Bursts into bolts on death.' },
  splitting: { name: 'Splitting', desc: 'Splits in two on death.' },
  vampiric: { name: 'Leeching', desc: 'Heals when it hurts you.' }
};

H.NODES = {
  combat: { name: 'Chamber', glyph: 'combat', css: '#e8dcc4', desc: 'A fight. Choose a reward after.' },
  elite: { name: 'Elite Chamber', glyph: 'elite', css: '#f0bd4f', desc: 'A dangerous foe. Rewards a charm.' },
  challenge: { name: 'Trial', glyph: 'challenge', css: '#ff5c7c', desc: 'Accept a cursed trial for a rich reward, or walk past.' },
  rest: { name: 'Hearth', glyph: 'rest', css: '#ff9a62', desc: 'Heal, attune a spell, or fortify.' },
  shrine: { name: 'Forge Shrine', glyph: 'shrine', css: '#c39bff', desc: 'Upgrade a spell.' },
  treasure: { name: 'Reliquary', glyph: 'treasure', css: '#ffd27a', desc: 'Treasure and gold coins.' },
  mystery: { name: 'Unknown', glyph: 'mystery', css: '#86e8d6', desc: 'Something waits. It may help.' },
  merchant: { name: 'Merchant', glyph: 'merchant', css: '#9be07a', desc: 'A wandering trader. Buy equipment with gold coins.' },
  warden: { name: 'Warden', glyph: 'warden', css: '#ff3d5e', desc: 'The keeper of this depth.' }
};

H.DEPTHS = [
  null,
  { name: 'The Gaol Undercroft', stone: 0x26302c, stone2: 0x18201d, rune: 0x0cff3a, fog: 0x07110d, light: 0x9dffc0, accent: '#4dff8a', boss: 'gaolwright', layers: 6 },
  { name: 'The Kiln Halls', stone: 0x2c2e22, stone2: 0x1d1f15, rune: 0x6cff08, fog: 0x0c0f06, light: 0xd8ffa0, accent: '#b6ff3a', boss: 'kiln_saint', layers: 7 },
  { name: 'The Hollow Court', stone: 0x1f2e2e, stone2: 0x142020, rune: 0x06ffa0, fog: 0x051110, light: 0x9ffff0, accent: '#3fffd0', boss: 'hollow_regent', layers: 7 }
];

H.MILESTONES = {
  first_steps: { name: 'First Sigils', desc: 'Finish the primer.', reward: 'Boon: Spare Breath' },
  depth2: { name: 'Into the Kiln', desc: 'Reach Depth II.', reward: 'Spell: Hurled Cairn · Boon: Gold Purse' },
  warden1: { name: 'Chainbreaker', desc: 'Defeat the Gaolwright.', reward: 'Spell: Flame Wake' },
  warden2: { name: 'Ash Walker', desc: 'Defeat the Kiln Saint.', reward: 'Spell: Null Mirror' },
  warden2b: { name: 'Second Ember', desc: 'Defeat the Kiln Saint twice.', reward: 'Spell: Gravity Well' },
  victory: { name: 'Crown of Nothing', desc: 'Defeat the Hollow Regent.', reward: "Boon: Regent's Ash" },
  reactions50: { name: 'Alchemist', desc: 'Trigger 50 reactions across runs.', reward: 'Spell: Storm Totem' },
  interrupts20: { name: 'Silencer', desc: 'Interrupt 20 casts across runs.', reward: 'Spell: Frost Snare' },
  arena10: { name: 'Pit Champion', desc: 'Reach wave 10 in Arena Siege.', reward: 'Spell: Miasma' },
  coopwin: { name: 'Bound Pair', desc: 'Clear a Depth in co-op.', reward: 'Spell: Cyclone' },
  elite10: { name: 'Crownbreaker', desc: 'Slay 10 elites across runs.', reward: 'Charm: Tempo Loop' }
};

H.PRESETS = [
  { name: 'Cinder & Rime', note: 'Burn + Frostbite = Steamburst', spells: ['cinder_bolt', 'rime_shard', 'gust_fan', 'glacier_ward'] },
  { name: 'Stormcaller', note: 'Frostbite + Vulnerable = Conduction', spells: ['arc_lash', 'rime_shard', 'zephyr_step', 'quake_spike'] },
  { name: 'Rotweaver', note: 'Poison + Burn = Blight Flare', spells: ['hex_spit', 'cinder_bolt', 'rift_orb', 'zephyr_step'] },
  { name: 'Stoneheart', note: 'Frostbite + Broken = Shatter', spells: ['rime_shard', 'quake_spike', 'glacier_ward', 'gust_fan'] }
];

H.MYSTERY_EVENTS = ['mirror', 'pilgrim', 'font', 'grimoire', 'brazier', 'satchel', 'loom', 'echo'];

/* Primary attacks: the only choice before a run. Everything else is earned in the depths. */
H.PRIMARY = ['cinder_bolt', 'rime_shard', 'arc_lash', 'hex_spit', 'boulder'];
for (const id of H.PRIMARY) H.SPELLS[id].dmg = Math.round(H.SPELLS[id].dmg * 1.2);
/* ---- The Veteran's arsenal (hero: 'knight'). Only he can use these; he cannot use Percy's spells. ----
   kind 'melee': a short frontal arc. Hitting during a dash, or right after one, turns it into a
   charged blow that hits all around him (charge.*). */
/* Weapon kits: a main weapon replaces the primary (slot I) and fills slots II–IV with its attacks. */
H.WEAPON_KITS = {
  sword: { name: 'Sword', primary: 'sword_slash', special: 'sword_quake', skills: ['sword_thrust', 'sword_cleave', 'sword_spin'] },
  axe: { name: 'Two-handed Axe', primary: 'axe_chop', skills: ['axe_sweep', 'axe_smash', 'axe_backhand'], ult: 'axe_throw', twoHand: true, trait: 'Its blows cut straight through shields.' },
  bastard: { name: 'Bastard Sword', primary: 'bastard_slash', special: 'bastard_quake', skills: ['bastard_thrust', 'bastard_cleave', 'bastard_spin'], ult: 'bastard_execute', twoHand: true, trait: 'Every blow leaves Bleeding.' }
};
H.SPELLS.sword_slash = { id: 'sword_slash', stam: 7, ups: { range: 0.3, dmg: 0.2 }, weapon: 'sword', dtype: 'slash', hero: 'knight', name: 'Sword Slash', el: 'stone', role: 'attack', kind: 'melee', glyph: 'k_slash', cd: 0.3, cost: 0, range: 2.9, dmg: 7, angle: 100, knock: 1.5, swing: 'slash', sfx: 'sword',
  // the charged whirl out of a dash is switched off for now (chargeOff); its Quick Attack is a fast 45° cut straight ahead
  chargeOff: { window: 0.35, dmgMul: 1.9, radius: 2.8, knock: 6 }, quick: { angle: 45, rangeMul: 1.1 },
  // ground combo: two fast slashes, then a slower, heavier cut straight ahead (45°); after it, a short pause
  // hold the button: after the tap's slash, keep holding to wind up a full-circle Charged Whirl
  hold: { start: 0.22, time: 0.55, dmgMul: 2.4, radius: 3.1, knock: 8, stamMul: 1.6, cd: 0.45 },
  combo: { gap: 0.1, window: 0.6, recover: 0.6, finisher: { dmgMul: 1.8, angle: 45, rangeMul: 1.1, delay: 0.24, knock: 5 } },
  desc: s => `Quick, light slash in front of you: ${s.dmg} damage. Combo: two fast slashes, then a heavier cut straight ahead, 45° (${Math.round(s.dmg * 1.8)}). Slash during a dash, or right after it, for up to 3 quick cuts straight ahead (45°): ${Math.round(s.dmg * 1.4)} damage each. Hold the button to wind up a Charged Whirl all around you: ${Math.round(s.dmg * 2.4)} damage.` };
H.SPELLS.sword_thrust = { id: 'sword_thrust', stam: 22, ups: { range: 0.6, dmg: 0.25 , cd: 0.12 }, weapon: 'sword', dtype: 'pierce', hero: 'knight', name: 'Thrust', el: 'stone', role: 'attack', kind: 'thrust', glyph: 'k_thrust', cd: 5, cost: 0, range: 3.6, dmg: 16, width: 0.7, status: 'bleed', stacks: 2, lunge: { min: 2.0, max: 6.6, tip: 1.2, speed: 25, fullSpeed: 32 }, chargeable: { time: 0.8, hold: 1.2, fullMul: 1.3 },
  desc: s => `Hold to wind up: the arrow on the floor shows exactly how far you will dash. Release to lunge along it, piercing every foe on the way for ${s.dmg} damage and Bleeding. Fully charged: faster and +30% damage.` };
H.SPELLS.sword_cleave = { id: 'sword_cleave', stam: 30, ups: { range: 0.4, dmg: 0.25 , cd: 0.12 }, weapon: 'sword', dtype: 'slash', hero: 'knight', name: 'Mighty Blow', el: 'stone', role: 'attack', kind: 'cleave', glyph: 'k_cleave', cd: 10, cost: 0, range: 3.2, dmg: 32, angle: 90, knock: 7,
  desc: s => `A heavy forward cut across a 90° arc in front of you (not around you): ${s.dmg} damage and knockback. Long cooldown.` };
H.SPELLS.sword_spin = { id: 'sword_spin', stam: 35, haste: 0.35, ups: { range: 0.35, dmg: 0.25, cd: 0.12, haste: 0.1 }, weapon: 'sword', dtype: 'slash', hero: 'knight', name: 'Whirling Blow', el: 'stone', role: 'attack', kind: 'spin', glyph: 'k_spin', cd: 12, cost: 0, range: 2.5, dmg: 5, dur: 2, tick: 0.2, turns: 7,
  desc: s => `Spin fast for ${s.dur.toFixed(0)} s, cutting everything close around you: ${s.dmg} damage every 0.2 s. You move ${Math.round(s.haste * 100)}% faster while spinning.` };
/* ---- Two-handed Axe: every blow ignores shields ---- */
H.SPELLS.axe_chop = { id: 'axe_chop', stam: 10, ups: { range: 0.3, dmg: 0.2 }, weapon: 'axe', dtype: 'slash', ignoreShield: true, hero: 'knight', name: 'Axe Chop', el: 'stone', role: 'attack', kind: 'melee', glyph: 'k_axe', cd: 0.55, cost: 0, range: 2.7, dmg: 12, angle: 100, knock: 2.5, swing: 'slash', sfx: 'axe',
  desc: s => `A heavy chop in front of you: ${s.dmg} damage. Goes through shields.` };
H.SPELLS.axe_sweep = { id: 'axe_sweep', stam: 30, ups: { range: 0.4, dmg: 0.25, cd: 0.12 }, weapon: 'axe', dtype: 'slash', ignoreShield: true, hero: 'knight', name: 'Axe Sweep', el: 'stone', role: 'attack', kind: 'cleave', glyph: 'k_sweep', cd: 9, cost: 0, range: 3.3, dmg: 26, angle: 180, knock: 5, status: 'bleed', stacks: 1, sfx: 'axe',
  desc: s => `Sweep the axe right to left across the whole half-circle in front of you: ${s.dmg} damage and Bleeding (level 1). Long cooldown.` };
H.SPELLS.axe_smash = { id: 'axe_smash', stam: 28, ups: { range: 0.3, dmg: 0.25, cd: 0.12 }, weapon: 'axe', dtype: 'blunt', ignoreShield: true, hero: 'knight', name: 'Crushing Blow', el: 'stone', role: 'attack', kind: 'smash', glyph: 'k_smash', cd: 8, cost: 0, range: 3.2, dmg: 58, status: 'sunder', stacks: 1, swing: 'smash', sfx: 'axe',
  desc: s => `Raise the axe overhead with both hands and bring it down on a single foe: ${s.dmg} damage and Broken. Hits only one enemy.` };
H.SPELLS.axe_backhand = { id: 'axe_backhand', stam: 36, ups: { range: 0.35, dmg: 0.25, cd: 0.12 }, weapon: 'axe', dtype: 'slash', ignoreShield: true, hero: 'knight', name: 'Backhand', el: 'stone', role: 'attack', kind: 'backhand', glyph: 'k_backhand', cd: 7, cost: 0, range: 3.2, dmg: 22, angle: 130, knock: 10, status: 'daze', stacks: 1, swing: 'backhand', sfx: 'axe',
  desc: s => `Whirl half a turn and swing the axe hard across the front: ${s.dmg} damage in an area, a heavy shove and Dazed.` };
H.SPELLS.axe_throw = { id: 'axe_throw', stam: 40, ups: { dmg: 0.25, bounce: 1 }, weapon: 'axe', dtype: 'slash', ignoreShield: true, hero: 'knight', name: 'Axe Throw', el: 'stone', role: 'attack', kind: 'axethrow', glyph: 'k_axethrow', ult: true, cd: 16, cost: 0, range: 14, dmg: 48, bounces: 2, hopRange: 9, swing: 'throw', sfx: 'axe',
  desc: s => `ULTIMATE. Hurl the axe at a foe: ${s.dmg} damage, then it bounces to ${s.bounces} more enemies and flies back to your hands.` };
/* ---- Bastard Sword: the steel sword's moves with 1.7× reach; every blow leaves Bleeding ---- */
H.SPELLS.bastard_slash = { id: 'bastard_slash', stam: 12, ups: { range: 0.3, dmg: 0.2 }, weapon: 'bastard', dtype: 'slash', hero: 'knight', name: 'Bastard Slash', el: 'stone', role: 'attack', kind: 'melee', glyph: 'k_slash', cd: 0.65, cost: 0, range: 3.4, dmg: 16, angle: 110, knock: 2.5, swing: 'slash', sfx: 'sword', status: 'bleed', stacks: 1, charge: { window: 0.35, dmgMul: 1.8, radius: 3.6, knock: 7 },
  desc: s => `A slow, heavy slash: ${s.dmg} damage and Bleeding. Slash out of a dash for a rushing whirl: ${Math.round(s.dmg * 1.8)} damage all around you.` };
for (const [src, id, name] of [['sword_thrust', 'bastard_thrust', 'Long Thrust'], ['sword_cleave', 'bastard_cleave', 'Great Cut'], ['sword_spin', 'bastard_spin', 'Great Whirl']]) {
  const b = H.SPELLS[src], R = 1.7;
  H.SPELLS[id] = Object.assign({}, b, { id, name, weapon: 'bastard', range: +(b.range * R).toFixed(2), stam: Math.round(b.stam * 1.1), status: 'bleed', stacks: b.stacks || 1, ups: Object.assign({}, b.ups) });
  if (b.lunge) H.SPELLS[id].lunge = Object.assign({}, b.lunge, { max: +(b.lunge.max * R).toFixed(1), tip: +(b.lunge.tip * R).toFixed(1) });
}
H.SPELLS.bastard_execute = { id: 'bastard_execute', stam: 30, ups: { dmg: 0.25, cd: 0.12 }, weapon: 'bastard', dtype: 'slash', hero: 'knight', name: 'Execution', el: 'stone', role: 'attack', kind: 'execute', glyph: 'k_execute', ult: true, cd: 14, charges: 3, cost: 0, range: 3.8, dmg: 95, angle: 80, swing: 'slash', sfx: 'sword',
  desc: s => `ULTIMATE · 3 charges. A devastating cut on one foe: ${s.dmg} damage, Broken and Bleeding. If it kills in one hit, the charge comes straight back.` };
/* ---- The hero's three starting abilities: basic attack (click, some weapons add a hold attack), the weapon's
   Special (Q) and the Ultimate (R), which needs the Aid blessing. The weapons' old skills (slots II–IV) are off. */
H.WEAPON_SKILLS_OFF = true;
H.SPECIAL_SLOT = 2;   // slot III = Q
H.SPELLS.sword_quake = { id: 'sword_quake', stam: 18, ups: { range: 0.35, dmg: 0.25, cd: 0.12 }, weapon: 'sword', special: true, dtype: 'blunt', hero: 'knight', name: 'Seismic Strike', el: 'stone', role: 'attack', kind: 'quake', glyph: 'k_nova', cd: 2.2, cost: 0, range: 3.4, dmg: 16, knock: 10, stun: 0.35, delay: 300, swing: 'smash', sfx: 'sword',
  desc: s => `SPECIAL. Raise the sword and drive it into the floor: a shockwave all around you (${s.range.toFixed(1)} m) for ${s.dmg} damage that hurls foes back, interrupts them and wipes out enemy projectiles. Slow.` };
H.SPELLS.bastard_quake = Object.assign({}, H.SPELLS.sword_quake, { id: 'bastard_quake', weapon: 'bastard', name: 'Great Quake', range: 4.2, dmg: 22, stam: 22, status: 'bleed', stacks: 1, ups: { range: 0.35, dmg: 0.25, cd: 0.12 } });
/* Divine Bar: fills when the hero deals and takes damage (only with the Aid blessing). One segment = a Call;
   a full bar, held, = a Greater Call that spends all of it. */
H.DIVINE = { seg: 100, segs: 3, dealt: 0.5, dealtCap: 12, taken: 2.2, holdT: 0.4 };
H.SPELLS.aid_call = { id: 'aid_call', call: true, hero: 'knight', name: 'Call of the Seal', el: 'venom', role: 'attack', kind: 'call', glyph: 'k_nova', ult: true, cd: 0, cost: 0, range: 0,
  dmg: 40, radius: 4.8, knock: 12, gDmg: 45, gRadius: 7, gPulses: 5, gFinal: 120, gInv: 3,
  desc: s => `AID BLESSING · ULTIMATE (R). Hitting foes and taking hits fills the Divine Bar (3 segments). Spend one segment for a Call: a burst of green fire around you, ${s.dmg} damage, a big shove, and enemy shots wiped out. With the bar full, hold R for a Greater Call: you can't be hurt for ${s.gInv} s while ${s.gPulses} waves of ${s.gDmg} damage roll out, then a final blast of ${s.gFinal}.` };
/* Quick Attack: the basic attack used during a dash or right after it (weapons with a dash strike of their own use it) */
H.QUICK_ATTACK = { dmgMul: 1.4, max: 3, cd: 0.08, window: 0.35 };
H.SPELLS.fist_strike = { id: 'fist_strike', stam: 6, ups: { range: 0.25, dmg: 0.2 }, dtype: 'blunt', hero: 'knight', name: 'Fist Strike', el: 'stone', role: 'attack', kind: 'melee', glyph: 'k_fist', cd: 0.38, cost: 0, range: 1.9, dmg: 9, angle: 110, knock: 2.5,
  charge: { window: 0.35, dmgMul: 1.9, radius: 2.6, knock: 7 },
  desc: s => `A quick punch: ${s.dmg} damage to foes right in front of you. Strike while dashing, or just after, for a charged blow: ${Math.round(s.dmg * 1.9)} damage all around you.` };
/* Heroes: who can use what. 'primaries' are offered at the start of a run; 'kit' feeds level-up offers.
   weaponPrimary: when a main weapon is equipped, its item can name a 'primary' spell that replaces the default. */
/* Weapons switched off for now: their items never drop, are not sold and can't be equipped (owned ones wait in
   the bag). With the fists off, the Veteran always holds a weapon and starts with a plain steel sword. */
H.DISABLED_WEAPONS = { axe: true, fists: true };
H.DEFAULT_WEAPON = { knight: 'steel_sword' };
H.HEROES = {
  percy: { primaries: H.PRIMARY, defaultPrimary: 'cinder_bolt', kit: null },
  knight: H.DISABLED_WEAPONS.fists ? { primaries: ['sword_slash'], defaultPrimary: 'sword_slash', kit: 'veteran' } : { primaries: ['fist_strike'], defaultPrimary: 'fist_strike', kit: 'veteran' }
};

/* Stackable upgrades to the primary attack (slot I). kinds = primary spell kinds that can roll it. */
H.MODS = {
  multishot: { name: 'Twin Shot', max: 2, kinds: ['projectile', 'chain', 'cone'],
    desc: k => k === 'chain' ? 'Your primary attack starts one more lightning chain on a different foe.' : k === 'cone' ? 'Your primary spray widens by 35% and hits harder at the edges.' : 'Your primary attack fires one more projectile in a fan. Each deals 80% damage.' },
  pierce: { name: 'Piercing Shot', max: 2, kinds: ['projectile', 'chain', 'cone'],
    desc: k => k === 'chain' ? 'Your primary lightning leaps to one more foe.' : k === 'cone' ? 'Your primary spray reaches 1.5 m further.' : 'Your primary projectiles pass through 2 more foes.' },
  ricochet: { name: 'Ricochet', max: 2, kinds: ['projectile'],
    desc: k => 'When a primary projectile would stop, it bounces to the nearest other foe instead.' },
  explosive: { name: 'Burst Round', max: 2, kinds: ['projectile'],
    desc: k => 'Primary projectiles explode where they stop, dealing 50% damage around them.' },
  rapid: { name: 'Rapid Casting', max: 3, kinds: ['projectile', 'chain', 'cone'],
    desc: k => 'Your primary attack recovers 15% faster.' },
  heavy: { name: 'Heavy Shot', max: 2, kinds: ['projectile', 'chain', 'cone'],
    desc: k => 'Your primary attack deals 25% more damage; projectiles grow larger and fly a little slower.' },
  surge: { name: 'Elemental Charge', max: 2, kinds: ['projectile', 'chain', 'cone'],
    desc: k => 'Each primary hit applies one more stack of its status.' }
};
for (const k in H.MODS) H.MODS[k].id = k;

/* Element kits: when the primary attack belongs to an element with a kit, every new ability offered comes from it. */
H.SPELLS.flamethrower = { id: 'flamethrower', name: 'Flamethrower', el: 'ember', role: 'attack', kind: 'flamethrower', glyph: 'k_flame', cd: 6, cost: 26, range: 7.5, dmg: 7, dur: 2.5, tick: 0.2, angle: 45, knock: 0, status: 'burn', stacks: 1, kit: 'ember', start: true,
  ups: { range: 1.2, dmg: 0.25, dur: 0.6 }, desc: s => `Breathe a 45° stream of fire in front of you for ${s.dur.toFixed(1)} s. It follows your aim, reaches ${s.range.toFixed(1)} m and deals ${s.dmg} damage 5 times a second, applying Burn.` };
H.SPELLS.meteor = { id: 'meteor', name: 'Meteor', el: 'ember', role: 'attack', kind: 'meteor', glyph: 'k_meteor', cd: 7, cost: 30, range: 13, dmg: 42, radius: 2.6, status: 'burn', stacks: 2, kit: 'ember', start: true,
  ups: { area: 0.55, dmg: 0.25 }, desc: s => `Call a meteor down where you aim: ${s.dmg} impact damage in a ${s.radius.toFixed(1)} m radius, then the ground burns.` };
H.SPELLS.firestorm = { id: 'firestorm', name: 'Fire Whirl', el: 'ember', role: 'control', kind: 'firestorm', glyph: 'k_storm', cd: 11, cost: 32, range: 11, dmg: 9, radius: 2.3, dur: 4, status: 'burn', stacks: 1, kit: 'ember', start: true,
  ups: { dur: 1.25, dmg: 0.25 }, desc: s => `Summon a stationary fire tornado for ${s.dur.toFixed(1)} s. It drags foes in and deals ${s.dmg} several times a second.` };
H.PASSIVES = {
  fire_dash: { id: 'fire_dash', name: 'Fire Dash', el: 'ember', dmg: 8, dur: 2.5, ups: { dmg: 0.3, dur: 1.0 },
    desc: s => `Dashing leaves a trail of fire for ${s.dur.toFixed(1)} s that deals ${s.dmg} per tick to foes in it.` }
};
H.passiveStats = function (id, owner) {
  const d = H.PASSIVES[id]; const u = (owner && owner.ups && owner.ups[id]) || {};
  return { dmg: Math.round(d.dmg * (1 + d.ups.dmg * (u.dmg || 0))), dur: d.dur + d.ups.dur * (u.dur || 0) };
};
H.SPELLS.pyre_supernova = { id: 'pyre_supernova', name: 'Pyre Supernova', el: 'ember', role: 'attack', kind: 'supernova', glyph: 'k_nova', ult: true, cd: 40, cost: 0, range: 0, dmg: 120, radius: 7.5, knock: 14, status: 'burn', stacks: 3, kit: 'ember',
  ups: { area: 1.0, dmg: 0.25 }, desc: s => `ULTIMATE. Gather fire for an instant, then explode: ${s.dmg} damage and Burn ×3 to everything within ${s.radius.toFixed(1)} m, burning enemy shots and leaving a ring of fire.` };
H.ULT_LEVEL = 5;
H.KITS = { veteran: { spells: [], passives: [], charms: ['ironbark', 'spare_breath', 'quicksilver'], ult: null }, ember: { ult: 'pyre_supernova', spells: ['flamethrower', 'meteor', 'firestorm'], passives: ['fire_dash'], charms: ['kindling', 'ember_bloom', 'glass_edge'] } };
H.BRANCH_MAX = 4;
H.BRANCH_LABEL = {
  range: { name: 'More range', fmt: (a, b) => `Range ${a.range.toFixed(1)} m → ${b.range.toFixed(1)} m` },
  dmg: { name: 'More damage', fmt: (a, b) => `Damage ${a.dmg} → ${b.dmg}` },
  area: { name: 'Bigger impact area', fmt: (a, b) => `Radius ${a.radius.toFixed(1)} m → ${b.radius.toFixed(1)} m` },
  dur: { name: 'Longer duration', fmt: (a, b) => `Duration ${a.dur.toFixed(1)} s → ${b.dur.toFixed(1)} s` },
  cd: { name: 'Faster cooldown', fmt: (a, b) => `Cooldown ${a.cd.toFixed(1)} s → ${b.cd.toFixed(1)} s` },
  bounce: { name: 'More bounces', fmt: (a, b) => `Bounces ${a.bounces} → ${b.bounces}` },
  haste: { name: 'Faster while spinning', fmt: (a, b) => `Move speed while spinning +${Math.round(a.haste * 100)}% → +${Math.round(b.haste * 100)}%` }
};
/* Veteran attribute cards (level-ups). Each level stacks; max = levels. */
H.ATTRS = {
  vigor: { name: 'Vigor', icon: 'attack', col: '#ffd77a', max: 4, per: 15, desc: n => `+15 max stamina (${100 + 15 * n} → ${100 + 15 * (n + 1)}).` },
  second_breath: { name: 'Second Breath', icon: 'st_regen', col: '#e8c46a', max: 4, per: 0.2, desc: n => `Stamina refills ${Math.round(20)}% faster (+${Math.round(20 * n)}% → +${Math.round(20 * (n + 1))}%).` },
  thick_skin: { name: 'Thick Skin', icon: 'defense', col: '#dca16a', max: 4, per: 12, desc: n => `+12 max HP for the rest of the run.` },
  footwork: { name: 'Footwork', icon: 'movement', col: '#8fe8c4', max: 3, per: 0.05, desc: n => `+5% move speed (+${5 * n}% → +${5 * (n + 1)}%).` },
  battle_rhythm: { name: 'Battle Rhythm', icon: 'k_spin', col: '#5fb0ff', max: 3, per: 0.06, desc: n => `All your skills recharge 6% faster (−${6 * n}% → −${6 * (n + 1)}%).` }
};

/* Equipment: slots exist now; items will be added later. */
H.EQUIP_SLOTS = [
  { id: 'head', name: 'Head', hint: 'A helmet or a hat.', glyph: 'eq_head' },
  { id: 'chest', name: 'Body', hint: 'A tunic or a chestplate.', glyph: 'eq_chest' },
  { id: 'legs', name: 'Legs', hint: 'Trousers or greaves.', glyph: 'eq_legs' },
  { id: 'feet', name: 'Feet', hint: 'Boots.', glyph: 'eq_feet' },
  { id: 'cloak', name: 'Cloak', hint: 'A cape or a mantle. Cloaks often make you faster.', glyph: 'eq_cloak' },
  { id: 'weapon', name: 'Main weapon', hint: 'A staff, a spellbook, a wand or a sword.', glyph: 'eq_weapon' },
  { id: 'ring1', name: 'Ring I', hint: 'Rings empower you.', glyph: 'eq_ring' },
  { id: 'ring2', name: 'Ring II', hint: 'Rings empower you.', glyph: 'eq_ring' }
];
H.BAG_SIZE = 24;
/* Stats an item can carry. pct = shown as a percentage. */
H.ITEM_STATS = {
  hp: { name: 'Max HP', fmt: v => `+${v}` },
  mana: { name: 'Max mana', fmt: v => `+${v}` },
  armor: { name: 'Damage taken', fmt: v => `−${Math.round(v * 100)}%` },
  speed: { name: 'Move speed', fmt: v => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%` },
  spell: { name: 'Spell damage', fmt: v => `+${Math.round(v * 100)}%` },
  fire: { name: 'Ember damage', fmt: v => `+${Math.round(v * 100)}%` },
  cdr: { name: 'Cooldowns', fmt: v => `−${Math.round(v * 100)}%` },
  regen: { name: 'Mana regeneration', fmt: v => `+${Math.round(v * 100)}%` },
  dash: { name: 'Dash recharge', fmt: v => `+${Math.round(v * 100)}%` },
  iframes: { name: 'Dash invulnerability', fmt: v => `+${v.toFixed(2)} s` },
  wdmg: { name: 'Weapon damage', fmt: v => `+${Math.round(v * 100)}%` }
};
H.RARITY = { common: { name: 'Common', css: '#c9bfae', w: 60 }, uncommon: { name: 'Uncommon', css: '#7fd18b', w: 30 }, rare: { name: 'Rare', css: '#6fb2ff', w: 10 }, legendary: { name: 'Legendary', css: '#ff9a3c', w: 3 } };
/* icon: glyph + main colour (material) */
H.ITEMS = {
  iron_helm: { name: 'Iron Helm', slot: 'head', rarity: 'common', icon: 'it_helm', col: '#a9adb5', stats: { hp: 15, armor: 0.05, speed: -0.03 }, desc: 'Dented, heavy and reassuring.' },
  witch_hat: { name: "Witch's Hat", slot: 'head', rarity: 'uncommon', icon: 'it_hat', col: '#8c5cff', stats: { mana: 20, spell: 0.1 }, desc: 'A tall, crooked hat that hums when you cast.' },
  ash_hood: { name: 'Ash Hood', slot: 'head', rarity: 'rare', icon: 'it_hood', col: '#ff8a4a', stats: { cdr: 0.08, regen: 0.1 }, desc: 'Woven from cloth that never quite stops smouldering.' },
  iron_cuirass: { name: 'Iron Cuirass', slot: 'chest', rarity: 'common', icon: 'it_cuirass', col: '#a9adb5', stats: { hp: 30, armor: 0.12, speed: -0.06 }, desc: 'Solid plate. You will feel every step.' },
  apprentice_robe: { name: "Apprentice's Robe", slot: 'chest', rarity: 'common', icon: 'it_robe', col: '#6b7dff', stats: { mana: 25, regen: 0.15 }, desc: 'Ink stains on the sleeves, sigils on the hem.' },
  ember_scale: { name: 'Emberscale Mail', slot: 'chest', rarity: 'rare', icon: 'it_scale', col: '#ff6a2b', stats: { hp: 20, armor: 0.08, fire: 0.15 }, desc: 'Scales shed by something that lived in the Kiln.' },
  iron_greaves: { name: 'Iron Greaves', slot: 'legs', rarity: 'common', icon: 'it_greaves', col: '#a9adb5', stats: { hp: 15, armor: 0.08, speed: -0.04 }, desc: 'Shin plates riveted to leather.' },
  traveler_pants: { name: "Traveller's Trousers", slot: 'legs', rarity: 'common', icon: 'it_pants', col: '#a8835a', stats: { speed: 0.06, dash: 0.1 }, desc: 'Light, patched, and made for running.' },
  runesilk_leggings: { name: 'Runesilk Leggings', slot: 'legs', rarity: 'uncommon', icon: 'it_pants', col: '#c39bff', stats: { mana: 15, cdr: 0.06 }, desc: 'Silk embroidered with quickening runes.' },
  leather_boots: { name: 'Leather Boots', slot: 'feet', rarity: 'common', icon: 'it_boots', col: '#a8835a', stats: { speed: 0.08 }, desc: 'Soft soles. Quiet steps.' },
  hobnail_boots: { name: 'Hobnail Boots', slot: 'feet', rarity: 'common', icon: 'it_boots', col: '#a9adb5', stats: { hp: 10, armor: 0.05 }, desc: 'Iron studs that grip the crypt stone.' },
  strider_boots: { name: 'Strider Boots', slot: 'feet', rarity: 'rare', icon: 'it_boots', col: '#7fe3ff', stats: { speed: 0.12, dash: 0.15 }, desc: 'Every stride lands a little further than it should.' },
  wool_cloak: { name: "Traveller's Cloak", slot: 'cloak', rarity: 'common', icon: 'it_cloak', col: '#8a7a6a', stats: { hp: 10, speed: 0.05 }, desc: 'Warm wool, frayed at the edges.' },
  eagle_cloak: { name: 'Eagle Feather Cloak', slot: 'cloak', rarity: 'rare', icon: 'it_feather', col: '#f2e6c9', stats: { speed: 0.2 }, desc: 'Sewn from the feathers of a great eagle. You feel light.' },
  ember_mantle: { name: 'Ember Mantle', slot: 'cloak', rarity: 'uncommon', icon: 'it_cloak', col: '#ff6a2b', stats: { speed: 0.08, fire: 0.1 }, desc: 'Its hem trails sparks behind you.' },
  shadow_cloak: { name: 'Shadow Cloak', slot: 'cloak', rarity: 'uncommon', icon: 'it_cloak', col: '#5a4a7a', stats: { speed: 0.08, iframes: 0.12 }, desc: 'Hard to hit what is barely there.' }
};
/* The Veteran's armour set: worn, rusted plate. Drawn as real armour on any hero (R.vetArmor). */
Object.assign(H.ITEMS, {
  vet_helm: { name: "Veteran's Great Helm", slot: 'head', rarity: 'rare', vet: 'head', icon: 'it_ghelm', col: '#9aa0a8', stats: { hp: 20, armor: 0.08, speed: -0.03 }, desc: 'A closed helm with a narrow eye slit. Dented by more blows than anyone counted.' },
  vet_cuirass: { name: "Veteran's Plate", slot: 'chest', rarity: 'rare', vet: 'chest', icon: 'it_cuirass', col: '#9aa0a8', stats: { hp: 40, armor: 0.16, speed: -0.07 }, desc: 'Rusted breastplate, mismatched pauldrons, mail sleeves and battered gauntlets.' },
  vet_greaves: { name: "Veteran's Greaves", slot: 'legs', rarity: 'uncommon', vet: 'legs', icon: 'it_greaves', col: '#9aa0a8', stats: { hp: 20, armor: 0.09, speed: -0.04 }, desc: 'Mail chausses, steel greaves, a worn belt and a torn tabard.' },
  vet_sabatons: { name: "Veteran's Sabatons", slot: 'feet', rarity: 'uncommon', vet: 'feet', icon: 'it_boots', col: '#9aa0a8', stats: { hp: 10, armor: 0.05, speed: -0.01 }, desc: 'Heavy leather boots with iron soles and steel toe plates.' },
  // Main weapons (hero-locked). weapon: the attack set it grants; wdmg scales every attack of that set.
  steel_sword: { name: 'Steel Sword', slot: 'weapon', rarity: 'common', hero: 'knight', weapon: 'sword', icon: 'it_sword', col: '#b8bec8', stats: { wdmg: 0 }, desc: 'Plain, honest steel. Sharpened more times than anyone counted.' },
  tempered_sword: { name: 'Tempered Steel Sword', slot: 'weapon', rarity: 'uncommon', hero: 'knight', weapon: 'sword', icon: 'it_sword', col: '#d6dce4', stats: { wdmg: 0.2 }, desc: 'Quenched twice in cold oil. It holds an edge.' },
  master_sword: { name: 'Masterwork Steel Sword', slot: 'weapon', rarity: 'rare', hero: 'knight', weapon: 'sword', icon: 'it_sword', col: '#e8c46a', stats: { wdmg: 0.45 }, desc: 'A smith\'s finest work, with a gilded guard and a balance that feels alive.' },
  woodcutter_axe: { name: "Woodcutter's Axe", slot: 'weapon', rarity: 'common', hero: 'knight', weapon: 'axe', icon: 'it_axe', col: '#9a8a74', stats: { wdmg: 0 }, desc: 'Made for oak, not men. It does not seem to mind the difference.' },
  war_axe: { name: 'War Axe', slot: 'weapon', rarity: 'uncommon', hero: 'knight', weapon: 'axe', icon: 'it_axe', col: '#c4ccd6', stats: { wdmg: 0.2 }, desc: 'A long haft and a bearded head, built to bite through shields.' },
  headsman_axe: { name: "Headsman's Axe", slot: 'weapon', rarity: 'rare', hero: 'knight', weapon: 'axe', icon: 'it_axe', col: '#d9a441', stats: { wdmg: 0.45 }, desc: 'Heavy, black-hafted, its edge never quite dry.' },
  bastard_sword: { name: 'Bastard Sword', slot: 'weapon', rarity: 'rare', hero: 'knight', weapon: 'bastard', icon: 'it_bastard', col: '#cfd6de', stats: { wdmg: 0.15 }, desc: 'A hand-and-a-half blade: long, slow and merciless.' },
  oathbreaker: { name: 'Oathbreaker', slot: 'weapon', rarity: 'legendary', hero: 'knight', weapon: 'bastard', icon: 'it_bastard', col: '#ff9a3c', stats: { wdmg: 0.5 }, desc: 'Forged for a vow that was broken. The runes along the fuller still burn.' },
});
for (const id in H.ITEMS) H.ITEMS[id].id = id;

/* Enemy aggression tuning */
/* Stamina (the Veteran only): attacks spend it, it refills after a short pause in attacking. */
H.STAMINA = { max: 100, regen: 45, delay: 0.3, chargedMul: 1.6 };
H.ENEMY_DMG_MUL = 1.35;     // direct hits
H.ENEMY_DOT_MUL = 1.15;     // burning ground, poison clouds…
H.ENEMY_PROJ_SPEED = 1.35;  // hostile projectiles
H.ENEMY_TEMPO = 0.8;        // wind-up, recovery and cooldown of attacks (lower = faster)
