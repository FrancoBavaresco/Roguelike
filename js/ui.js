'use strict';
/* HEXWRIGHT — UI: screens, navigation (mouse/keyboard/gamepad/touch), HUD, world labels, modals */
const UI = H.UI = { layers: [], focus: null, navByPointer: true };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = H.esc;
const elCss = el => H.EL[el] ? H.EL[el].css : '#fff';
UI.stChip = (k, n, big) => { const c = H.statusCss(k); return `<span title="${esc(H.STATUS[k].name)}" style="border:1px solid ${c}">${H.glyphSVG(H.statusGlyph(k), c, big ? 14 : 11)}${n > 1 ? `<em>${n}</em>` : ''}</span>`; };
const sfx = n => H.audio.play(n);

/* ---------------- Layers & navigation ---------------- */
UI.open = function (id, html, o = {}) {
  UI.close(id, true);
  const s = document.createElement('section');
  s.className = 'screen ' + (o.page && id !== 'scr-hub' ? 'page ' : '') + (o.cls || ''); s.id = id; s.innerHTML = html;
  $('#ui').appendChild(s);
  const layer = { id, el: s, back: o.back, onTab: o.onTab, onKey: o.onKey, page: !!o.page, onUpdate: o.onUpdate };
  UI.layers.push(layer);
  if (o.x !== false && !o.page && /\bdim\b/.test(o.cls || '') && o.back) { const md = s.querySelector('.modal'); if (md) { const xb = document.createElement('button'); xb.className = 'xbtn'; xb.type = 'button'; xb.setAttribute('aria-label', H.t('Close')); xb.innerHTML = '&times;'; xb.onclick = e => { e.stopPropagation(); sfx('ui_back'); layer.back && layer.back(); }; md.prepend(xb); } }
  s.addEventListener('mouseover', ev => { const t = ev.target.closest('button, [data-nav]'); if (t && s.contains(t) && !t.disabled) UI.setFocus(t, false); });
  s.addEventListener('click', ev => { const t = ev.target.closest('button'); if (t && !t.dataset.silent) sfx(t.classList.contains('primary') ? 'ui_ok' : 'ui_move'); });
  UI.focus = null;
  requestAnimationFrame(() => { if (UI.top() === layer) { const af = s.querySelector('[data-autofocus]'); if (af && H.input.lastDevice !== 'touch') UI.setFocus(af, true); } });
  return s;
};
UI.close = function (id, silent) {
  const i = UI.layers.findIndex(l => l.id === id); if (i < 0) return;
  const l = UI.layers[i]; if (l.onClose) { try { l.onClose(); } catch (e) { } } l.el.remove(); UI.layers.splice(i, 1);
  if (UI.focus && !document.body.contains(UI.focus)) UI.focus = null;
};
UI.closePages = function () { for (const l of UI.layers.slice()) UI.close(l.id); };
UI.top = () => UI.layers[UI.layers.length - 1];
UI.setFocus = function (el, scroll) {
  if (UI.focus === el) return;
  if (UI.focus) UI.focus.classList.remove('focus');
  UI.focus = el; if (!el) return;
  el.classList.add('focus');
  if (scroll && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};
UI.focusables = el => $$('button:not([disabled]), [data-nav]', el).filter(b => b.offsetParent !== null && !b.closest('[hidden]'));
UI.updateNav = function (dt) {
  const I = H.input; I.updateMenu(dt);
  const top = UI.top(); if (!top) return;
  if (top.onUpdate) top.onUpdate(dt);
  const m = I.menu;
  if (top.onKey) { for (const c of I.keysPressed) top.onKey(c); }
  if (m.back) { if (top.back) { sfx('ui_back'); top.back(); } return; }
  if (m.tabL && top.onTab) { top.onTab(-1); sfx('ui_move'); }
  if (m.tabR && top.onTab) { top.onTab(1); sfx('ui_move'); }
  const list = UI.focusables(top.el); if (!list.length) return;
  const moved = m.up || m.down || m.left || m.right;
  if (!UI.focus || !top.el.contains(UI.focus)) { if (moved || m.confirm) { UI.setFocus(top.el.querySelector('[data-autofocus]') || list[0], true); sfx('ui_move'); } return; }
  if ((m.left || m.right) && UI.focus.dataset.adjust != null) { UI.focus.dispatchEvent(new CustomEvent('adjust', { detail: m.left ? -1 : 1 })); sfx('ui_move'); return; }
  if (moved) {
    const dir = m.up ? [0, -1] : m.down ? [0, 1] : m.left ? [-1, 0] : [1, 0];
    const a = UI.focus.getBoundingClientRect(); const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = 1e9;
    for (const b of list) {
      if (b === UI.focus) continue; const r = b.getBoundingClientRect(); const bx = r.left + r.width / 2, by = r.top + r.height / 2;
      const dx = bx - ax, dy = by - ay; const along = dx * dir[0] + dy * dir[1]; if (along <= 4) continue;
      const perp = Math.abs(dx * dir[1] - dy * dir[0]); const s = along + perp * 2.2; if (s < bs) { bs = s; best = b; }
    }
    if (best) { UI.setFocus(best, true); sfx('ui_move'); }
  }
  if (m.confirm && UI.focus) { UI.focus.click(); }
};

/* ---------------- Helpers ---------------- */
UI.banner = function (b1, b2, cls) { const b = $('#banner'); b.className = ''; void b.offsetWidth; b.querySelector('.b1').textContent = b1; b.querySelector('.b2').textContent = b2 || ''; b.className = 'show ' + (cls || ''); };
UI.toast = function (text) { const t = document.createElement('div'); t.className = 't'; t.textContent = text; $('#toast').appendChild(t); setTimeout(() => t.remove(), 3300); };
UI.fade = function (on) { $('#fade').classList.toggle('on', !!on); };
UI.confirm = function (title, text, yes, no, yesLabel = 'Confirm', noLabel = 'Cancel') {
  title = H.t(title); text = H.t(text); yesLabel = H.t(yesLabel); noLabel = H.t(noLabel);
  const s = UI.open('scr-confirm', `<div class="modal plate" style="width:min(520px,100%)"><h2>${esc(title)}</h2><div class="sub">${esc(text)}</div><div class="row"><button class="btn primary" data-autofocus id="cf-yes">${esc(yesLabel)}</button><button class="btn" id="cf-no">${esc(noLabel)}</button></div></div>`, { cls: 'dim', back: () => { UI.close('scr-confirm'); no && no(); } });
  $('#cf-yes', s).onclick = () => { UI.close('scr-confirm'); yes && yes(); };
  $('#cf-no', s).onclick = () => { UI.close('scr-confirm'); no && no(); };
};
UI.spellIcon = (id, size = 28) => { const d = H.SPELLS[id]; return H.glyphSVG(d.glyph || d.el, elCss(d.el), size); };
UI.statLine = function (id, rank, owner) {
  const d = H.SPELLS[id], s = H.spellStats(id, rank, owner);
  const parts = [`<span>${H.t('CD {c}s', { c: s.cd < 1 ? s.cd.toFixed(2) : s.cd.toFixed(1) })}</span>`, `<span>${H.t('Cost {c}', { c: s.cost })}</span>`];
  if (d.dmg) parts.push(`<span>${H.t('Dmg {d}', { d: s.dmg })}</span>`);
  if (d.range) parts.push(`<span>${H.t('Range {r}m', { r: Math.round(s.range) })}</span>`);
  return parts.join(' · ');
};
UI.srcLabel = function (src) { if (!src || src === 'auto') src = H.input.lastDevice === 'pad' ? 'pad' : H.input.lastDevice === 'touch' ? 'touch' : 'kbm'; return src; };
UI.keyFor = (action, src) => H.input.label(action, UI.srcLabel(src));
UI.romanRank = r => ['', 'I', 'II', 'III', 'IV'][r] || r;
UI.resolveAuto = function () { const I = H.input; if (I.lastDevice === 'pad' && I.pads.length) return 'pad:' + (I.lastPad != null && I.padByIndex(I.lastPad) ? I.lastPad : I.pads[0].index); if (I.lastDevice === 'touch') return 'touch'; return 'kbm'; };

/* ---------------- Menu background scene ---------------- */
UI.menuScene = function () {
  if (UI.showcase) return;
  const room = { bounds: { minX: -12, maxX: 12, minZ: -9, maxZ: 9 }, pillars: [{ x: -6, z: -3, r: 1.1 }, { x: 6, z: -3, r: 1.1 }, { x: -8, z: 4, r: 0.9 }, { x: 8, z: 4, r: 0.9 }], pits: [], vents: [], doors: [], prop: { kind: 'hearth', x: 0, z: 1.6 }, W: 24, D: 18 };
  H.R.buildChamber(room, H.DEPTHS[1]);
  const m = H.R.makeHero(H.save.meta.character || 'percy', 0xd9a441);
  UI.showcase = { m, p: { x: 0, z: -0.4, vx: 0, vz: 0, faceAng: Math.PI, iframes: 0, dashT: 0, bastionT: 0, mirrorT: 0, hurtT: 0, invulnBlink: 0 }, t: 0 };
  H.R.follow.x = 0; H.R.follow.z = 0; H.R.follow.zoom = 0.62; H.R.updateCamera(0, true);
};
UI.clearShowcase = function () { if (UI.showcase) { H.R.removeMesh(UI.showcase.m.root); UI.showcase = null; } };
UI.updateShowcase = function (dt) {
  const s = UI.showcase; if (!s) return; s.t += dt;
  H.R.animateRogue(s.m, s.p, dt);
  if (Math.random() < dt * 0.6) { s.m.castT = 1; s.m.castSide *= -1; const el = H.pick(H.EL_ORDER); H.R.setRogueElement(s.m, el); H.R.burst(s.p.x + (s.m.castSide) * 0.5, 1.1, s.p.z + 0.3, H.EL[el].color, 14, 3, 0.5, 0.35, { up: 1 }); }
  H.R.follow.x = Math.sin(s.t * 0.12) * 2.2; H.R.follow.z = 0.6 + Math.cos(s.t * 0.09) * 0.8; H.R.follow.zoom = 0.62;
};

/* ---------------- Title ---------------- */
UI.showTitle = function () {
  UI.menuScene();
  H.audio.setTheme('title');
  const s = UI.open('scr-title', `
    <svg class="sigil-bg" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="#d9a441" stroke-width="1.2"><circle cx="100" cy="100" r="96"/><circle cx="100" cy="100" r="82"/><path d="M100 18 L171 141 L29 141 Z"/><path d="M100 182 L29 59 L171 59 Z"/><circle cx="100" cy="100" r="30"/></g></svg>
    <div class="logo">Hexwright</div>
    <div class="tagline">forge volatile spells · descend · do it again</div>
    <div class="press" id="press">press any key</div>
    <div class="title-foot">Keyboard &amp; mouse · Gamepad · Touch (landscape) &nbsp;·&nbsp; Original game, music and art</div>`, { cls: '' });
  $('#press', s).textContent = H.input.isTouchDevice ? 'tap to begin' : 'press any key';
  const go = () => { H.input.anyPressedHook = null; H.audio.init(); sfx('ui_start'); UI.close('scr-title'); UI.showHub(); };
  H.input.anyPressedHook = () => setTimeout(go, 0);
  s.addEventListener('click', () => { if (H.input.anyPressedHook) go(); });
};

/* ---------------- Hub ---------------- */
UI.showHub = function () {
  UI.closePages(); UI.menuScene(); H.audio.setTheme('hub');
  $('#hud').hidden = true; $('#touch').hidden = true; $('#world-ui').innerHTML = ''; UI.wui = null;
  const m = H.save.meta, st = m.stats;
  const s = UI.open('scr-hub', `
    <div class="hub-left">
      <div class="eyebrow">the waystone</div>
      <div class="hub-logo">Hexwright</div>
      <div class="muted" style="max-width:34ch;line-height:1.45">Start with a single attack. Earn new spells and upgrades on the way down. Break the Wardens of the undercroft, one more chamber at a time.</div>
      <div class="hub-menu">
        <button class="btn primary" id="h-play" data-autofocus>Descend <small>choose a mode</small></button>
        <button class="btn" id="h-inv">${H.t('Inventory')} <small>${H.t('equipment & stats')}</small></button>
        <button class="btn" id="h-shop">${H.t('Shop')} <small>${H.t('buy & sell equipment')}</small></button>
        <button class="btn" id="h-grim">Grimoire <small>unlock spells &amp; boons</small></button>
        <button class="btn" id="h-rec">Records <small>milestones &amp; stats</small></button>
        <button class="btn" id="h-how">How to play <small>controls &amp; reactions</small></button>
        <button class="btn" id="h-set">Settings <small>audio, controls, access</small></button>
      </div>
    </div>
    <div class="hub-right">
      ${H.fs.supported() ? `<button class="btn ghost" id="h-fs" style="min-height:36px">${UI.fsIcon()} ${H.t('Fullscreen')}</button>` : ''}
      <button class="btn ghost" id="h-lang" style="min-height:36px">${H.glyphSVG('mystery', '#d9a441', 16)} ${H.lang === 'es' ? 'Idioma: Español' : 'Language: English'}</button>
      <div class="plate embers"><span class="ember-dot"></span><span class="num">${m.embers}</span> ${H.t('gold coins')}</div>
      <div class="plate hub-card">
        <div class="eyebrow">best descent</div>
        <div class="display" style="font-size:26px;margin:2px 0 6px">${st.bestDepth ? H.t('Depth {d}', { d: H.roman(st.bestDepth) }) + ' · ' + (H.DEPTHS[st.bestDepth] || {}).name : H.t('Not yet descended')}</div>
        <div class="muted tiny num">${H.t('{runs} runs · {wins} victories · {w} wardens unmade · {r} reactions', { runs: st.runs, wins: st.wins, w: st.wardens, r: st.reactions })}</div>
      </div>
    </div>`, { page: true, back: () => { } });
  $('#h-play', s).onclick = () => UI.showModes();
  $('#h-inv', s).onclick = () => UI.showInventoryMenu();
  $('#h-shop', s).onclick = () => UI.showStore();
  const hfs2 = $('#h-fs', s); if (hfs2) hfs2.onclick = () => H.fs.toggle();
  $('#h-grim', s).onclick = () => UI.showGrimoire();
  $('#h-rec', s).onclick = () => UI.showRecords();
  $('#h-how', s).onclick = () => UI.showHowTo();
  $('#h-set', s).onclick = () => UI.showSettings(false);
  $('#h-lang', s).onclick = () => { H.settings.lang = H.lang === 'es' ? 'en' : 'es'; H.setLang(H.settings.lang); H.saveNow(); UI.showHub(); };
};

/* ---------------- Mode select ---------------- */
UI.modeState = { arenaRule: 'siege', arenaPlayers: 1, p1: 'auto', p2: null };
UI.showModes = function () {
  UI.closePages();
  const ms = UI.modeState;
  const glyphRow = els => els.map(e => H.glyphSVG(e, elCss(e), 34)).join('');
  const s = UI.open('scr-modes', `
    <div class="page-head"><div><div class="eyebrow">choose your descent</div><h2>Modes</h2></div><div class="grow"></div><button class="btn ghost" id="m-back">Back <span class="k">Esc</span></button></div>
    <div class="modes">
      <div class="mode plate" id="m-solo">
        <div class="art">${glyphRow(['ember', 'frost', 'volt'])}</div>
        <div class="eyebrow">one rogue</div><h3>Solo Descent</h3>
        <p>Three depths of cursed chambers. Branching routes, elites, trials, hearths and three Wardens. One life.</p>
        <div class="opts"><button class="btn primary" id="m-solo-go" data-autofocus>Begin descent</button></div>
      </div>
      <div class="mode plate" id="m-coop">
        <div class="art">${H.glyphSVG('void', '#d9a441', 34)}${H.glyphSVG('void', '#46e0c8', 34)}</div>
        <div class="eyebrow">two rogues · local</div><h3>Bound Pair</h3>
        <p>Share a screen and a fate. Downed rogues can be revived by standing beside them. Foes are hardier.</p>
        <div class="opts"><div id="m-seats"></div><button class="btn primary" id="m-coop-go">Descend together</button></div>
      </div>
      <div class="mode plate" id="m-arena">
        <div class="art">${glyphRow(['warden'].map(x => x))}</div>
        <div class="eyebrow">score attack</div><h3>The Pit</h3>
        <p id="m-arena-desc"></p>
        <div class="opts">
          <div class="seg" id="m-rule" data-nav data-adjust><button data-v="siege">Siege · waves</button><button data-v="vigil">Vigil · survive</button></div>
          <div class="seg" id="m-pl" data-nav data-adjust><button data-v="1">1 rogue</button><button data-v="2">2 rogues</button></div>
          <button class="btn primary" id="m-arena-go">Enter the Pit</button>
        </div>
      </div>
    </div>`, { page: true, back: () => UI.showHub() });
  $('#m-back', s).onclick = () => UI.showHub();
  const refresh = () => {
    $$('#m-rule button', s).forEach(b => b.classList.toggle('on', b.dataset.v === ms.arenaRule));
    $$('#m-pl button', s).forEach(b => b.classList.toggle('on', +b.dataset.v === ms.arenaPlayers));
    const st = H.save.meta.stats;
    $('#m-arena-desc', s).textContent = ms.arenaRule === 'siege' ? H.t('Escalating waves with a gift every third. Kill quickly to build a combo multiplier. Best: wave {w}, {s} points.', { w: st.arenaBestWave, s: st.arenaBestScore }) : H.t('Foes never stop coming. Survive as long as you can. Best: {t}.', { t: H.fmtTime(st.vigilBest) });
    UI.renderSeats($('#m-seats', s));
  };
  const segAdj = (el, key, vals) => { el.addEventListener('adjust', e => { const i = vals.indexOf(ms[key]); ms[key] = vals[H.clamp(i + e.detail, 0, vals.length - 1)]; refresh(); }); el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ms[key] = typeof vals[0] === 'number' ? +b.dataset.v : b.dataset.v; refresh(); } }); };
  segAdj($('#m-rule', s), 'arenaRule', ['siege', 'vigil']);
  segAdj($('#m-pl', s), 'arenaPlayers', [1, 2]);
  $('#m-solo-go', s).onclick = () => UI.startFlow({ mode: 'solo', seats: [{ src: 'auto' }] });
  $('#m-coop-go', s).onclick = () => { const seats = UI.coopSeats(); if (!seats) { UI.toast(H.t('Connect a gamepad and press A on it to add Rogue II')); sfx('ui_deny'); return; } UI.startFlow({ mode: 'coop', seats }); };
  $('#m-arena-go', s).onclick = () => { if (ms.arenaPlayers === 2) { const seats = UI.coopSeats(); if (!seats) { UI.toast(H.t('Connect a gamepad and press A on it to add Rogue II')); sfx('ui_deny'); return; } UI.startFlow({ mode: 'arena', arenaRule: ms.arenaRule, seats }); } else UI.startFlow({ mode: 'arena', arenaRule: ms.arenaRule, seats: [{ src: 'auto' }] }); };
  refresh();
  UI.top().onUpdate = () => { // join detection for P2
    const I = H.input; for (const gp of I.pads) { if (I.padButtonPressed(gp, 0) || I.padButtonPressed(gp, 9)) { const p1 = ms.p1 === 'auto' ? 'kbm' : ms.p1; if ('pad:' + gp.index !== p1 && ms.p2 !== 'pad:' + gp.index) { ms.p2 = 'pad:' + gp.index; refresh(); UI.toast(H.t('Rogue II joined on gamepad {n}', { n: gp.index + 1 })); sfx('ui_ok'); } } }
    if (ms.p2 && !I.padByIndex(+ms.p2.split(':')[1])) { ms.p2 = null; refresh(); }
    if (UI._seatT === undefined || UI._seatPads !== I.pads.length) { UI._seatPads = I.pads.length; refresh(); }
  };
};
UI.renderSeats = function (el) {
  const ms = UI.modeState; const I = H.input;
  const p1Opts = ['kbm'].concat(I.pads.map(p => 'pad:' + p.index)).filter(x => x !== ms.p2);
  if (ms.p1 === 'auto' || !p1Opts.includes(ms.p1)) ms.p1 = p1Opts[0];
  const nm = src => src === 'kbm' ? H.t('Keyboard & mouse') : src && src.startsWith('pad') ? H.t('Gamepad {n}', { n: +src.split(':')[1] + 1 }) : '';
  el.innerHTML = `<div class="col" style="gap:6px">
    <button class="seat btn ghost" id="seat1" style="justify-content:flex-start"><span class="who">Rogue I</span><span class="grow" style="text-align:left">${esc(nm(ms.p1))}</span><span class="muted tiny">change</span></button>
    <div class="seat p2 ${ms.p2 ? '' : 'wait'}"><span class="who">Rogue II</span><span class="grow">${ms.p2 ? esc(nm(ms.p2)) : (I.isTouchDevice && !I.pads.length ? 'Needs a gamepad' : 'Press A on a gamepad to join')}</span></div></div>`;
  $('#seat1', el).onclick = () => { const i = p1Opts.indexOf(ms.p1); ms.p1 = p1Opts[(i + 1) % p1Opts.length]; UI.renderSeats(el); };
};
UI.coopSeats = function () { const ms = UI.modeState; if (!ms.p2) return null; return [{ src: ms.p1 === 'auto' ? 'kbm' : ms.p1 }, { src: ms.p2 }]; };
UI.startFlow = function (cfg) {
  if (!H.save.tutorialDone && cfg.mode !== 'tutorial') {
    UI.confirm('First descent?', 'A short primer teaches moving, casting, dashing through danger, interrupting and elemental reactions. It takes about two minutes.', () => UI.startTutorial(cfg), () => { H.save.tutorialDone = true; H.saveNow(); UI.showBuild(cfg); }, 'Take the primer', 'Skip it');
    return;
  }
  UI.showBuild(cfg);
};
UI.startTutorial = function (after) {
  UI.afterTutorial = after;
  UI.launch({ mode: 'tutorial', seats: [{ src: 'auto', build: ['cinder_bolt', 'gust_fan', 'rime_shard', 'glacier_ward'], boon: 'none' }] });
};

/* ---------------- Build: choose a single primary attack ---------------- */
UI.showBuild = function (cfg) {
  UI.closePages();
  const meta = H.save.meta;
  const avail = H.G.availableSpells();
  const primsOf = ch => (H.HEROES[ch] || H.HEROES.percy).primaries;
  let prims = H.PRIMARY;
  const okPrim = id => avail.includes(id) || !!(H.SPELLS[id] && H.SPELLS[id].hero);
  const last = meta.lastBuild && okPrim(meta.lastBuild[0]) && prims.includes(meta.lastBuild[0]) ? meta.lastBuild[0] : 'cinder_bolt';
  const seats = cfg.seats.map((seat, i) => ({ prim: (seat.build && seat.build[0]) || (i === 0 ? last : 'rime_shard'), boon: seat.boon || (i === 0 && H.G.boonUnlocked(meta.lastBoon) ? meta.lastBoon : 'none') }));
  let cur = 0;
  const s = UI.open('scr-build', `
    <div class="page-head"><div><div class="eyebrow" id="b-eye"></div><h2>Choose your primary attack</h2></div><div class="grow"></div>
      <div class="row" id="b-tabs"></div>
      <button class="btn ghost" id="b-back">Back <span class="k">Esc</span></button></div>
    <div class="sub muted" style="max-width:80ch;line-height:1.45">You start with one attack on your primary button. Every chamber you clear lets you choose more: new spells for the empty slots, upgrades such as Twin Shot or Piercing Shot, or charms.</div>
    <div class="prim-grid scroll" id="b-prims" style="flex:1;min-height:0"></div>
    <div class="row"><span class="eyebrow">${H.t('hero')}</span><div class="seg" id="b-char" data-nav data-adjust></div><span class="eyebrow">boon</span><div class="seg" id="b-boon" data-nav data-adjust></div><div class="grow"></div><button class="btn primary" id="b-go" data-autofocus>Descend</button></div>`,
    { page: true, back: () => UI.showModes(), onTab: d => { if (seats.length > 1) { cur = (cur + d + seats.length) % seats.length; render(); } } });
  $('#b-back', s).onclick = () => UI.showModes();
  const render = () => {
    const seat = seats[cur]; const src = cfg.seats[cur].src;
    if (!seat.character) seat.character = cur === 0 ? (H.save.meta.character || 'percy') : 'percy';
    prims = primsOf(seat.character); if (!prims.includes(seat.prim)) seat.prim = (H.HEROES[seat.character] || H.HEROES.percy).defaultPrimary;
    $('#b-eye', s).textContent = (cfg.mode === 'arena' ? H.t('the pit') + ' · ' + H.t(cfg.arenaRule === 'siege' ? 'siege' : 'vigil') : H.t(cfg.mode === 'coop' ? 'bound pair' : 'solo descent')) + (seats.length > 1 ? ' · ' + H.t(cur ? 'rogue II' : 'rogue I') : '');
    $('#b-tabs', s).innerHTML = seats.length > 1 ? seats.map((_, i) => `<button class="btn ${i === cur ? 'primary' : ''}" data-i="${i}">${H.t(i ? 'Rogue II' : 'Rogue I')}</button>`).join('') + '<span class="k muted tiny">LB / RB</span>' : '';
    $$('#b-tabs button', s).forEach(b => b.onclick = () => { cur = +b.dataset.i; render(); });
    $('#b-prims', s).innerHTML = prims.map(id => {
      const d = H.SPELLS[id]; const st = H.spellStats(id, 1); const un = okPrim(id); const on = seat.prim === id;
      let lock = ''; if (!un) { if (d.milestone) lock = H.t('Unlock: milestone “{m}” — {d}', { m: H.MILESTONES[d.milestone].name, d: H.MILESTONES[d.milestone].desc }); if (d.embers) lock += H.t(lock ? ' or ' : 'Unlock: ') + H.t('{n} gold coins in the Grimoire.', { n: d.embers }); }
      const mods = Object.values(H.MODS).filter(m => m.kinds.includes(d.kind)).map(m => esc(m.name)).join(' · ');
      return `<div class="card plate prim ${on ? 'sel' : ''} ${un ? '' : 'locked'}" data-nav data-id="${id}" style="border-color:${elCss(d.el)}">
        <div class="row">${UI.spellIcon(id, 36)}<div class="grow"><div class="tag" style="color:${elCss(d.el)}">${esc(H.EL[d.el].name)} · ${esc(UI.keyFor('cast1', src))}</div><h3>${esc(d.name)}</h3></div>${on ? `<span class="chip" style="color:var(--brass-hi)">${H.t('chosen')}</span>` : ''}</div>
        <p>${esc(d.desc(st))}</p>
        <div class="foot"><span class="chip">${UI.statLine(id, 1)}</span>${d.status ? `<span class="chip">${H.glyphSVG(d.el, elCss(d.el), 12)} ${esc(H.t('applies {s}', { s: H.STATUS[d.status].name }))}</span>` : `<span class="chip">${H.t('melee')}</span>`}</div>
        ${un ? (mods ? `<div class="tiny muted">${esc(H.t('Upgrades it can roll: {m}', { m: mods }))}</div>` : '') : `<div class="warn">${esc(lock)}</div>`}
        ${un && H.KITS[d.el] ? `<div class="tiny" style="color:${elCss(d.el)}">${esc(H.t('Element abilities: {m}', { m: H.KITS[d.el].spells.map(k => H.SPELLS[k].name).concat(H.KITS[d.el].passives.map(k => H.PASSIVES[k].name)).join(' · ') }))}</div>` : ''}
        ${un && H.KITS[d.el] && H.KITS[d.el].ult ? `<div class="tiny" style="color:#ffcf6a">${esc(H.t('Ultimate: {m}', { m: H.SPELLS[H.KITS[d.el].ult].name }))} · ${esc(H.t('level {n}', { n: H.ULT_LEVEL }))}</div>` : ''}
      </div>`;
    }).join('');
    $$('#b-prims .prim', s).forEach(c => c.onclick = () => { const id = c.dataset.id; if (!okPrim(id)) { sfx('ui_deny'); return; } seat.prim = id; sfx('ui_ok'); render(); const f = $(`#b-prims [data-id="${id}"]`, s); if (f) UI.setFocus(f, false); });
    const boons = Object.keys(H.BOONS).filter(H.G.boonUnlocked);
    { const ids = Object.keys(H.CHARACTERS); if (!ids.includes(seat.character)) seat.character = cur === 0 ? (H.save.meta.character || 'percy') : 'percy';
      const cEl = $('#b-char', s); cEl.innerHTML = ids.map(c => `<button data-v="${c}" class="${seat.character === c ? 'on' : ''}" title="${esc(H.t(H.CHARACTERS[c].desc))}">${esc(H.t(H.CHARACTERS[c].name))}</button>`).join('');
      const pick = c => { seat.character = c; if (cur === 0) { H.save.meta.character = c; H.saveNow(); UI.clearShowcase(); UI.menuScene(); } render(); UI.toast(H.t(H.CHARACTERS[c].name) + ': ' + H.t(H.CHARACTERS[c].desc)); };
      cEl.onclick = e => { const b = e.target.closest('button'); if (b) pick(b.dataset.v); };
      cEl._adj && cEl.removeEventListener('adjust', cEl._adj); cEl._adj = e => { const i = ids.indexOf(seat.character); pick(ids[(i + e.detail + ids.length) % ids.length]); }; cEl.addEventListener('adjust', cEl._adj); }
    if (!boons.includes(seat.boon)) seat.boon = 'none';
    const bEl = $('#b-boon', s);
    bEl.innerHTML = boons.map(b => `<button data-v="${b}" class="${seat.boon === b ? 'on' : ''}" title="${esc(H.BOONS[b].desc)}">${esc(H.BOONS[b].name)}</button>`).join('');
    bEl.onclick = e => { const b = e.target.closest('button'); if (b) { seat.boon = b.dataset.v; render(); UI.toast(H.BOONS[seat.boon].name + ': ' + H.BOONS[seat.boon].desc); } };
    bEl._adj && bEl.removeEventListener('adjust', bEl._adj); bEl._adj = e => { const i = boons.indexOf(seat.boon); seat.boon = boons[(i + e.detail + boons.length) % boons.length]; render(); UI.toast(H.BOONS[seat.boon].name + ': ' + H.BOONS[seat.boon].desc); }; bEl.addEventListener('adjust', bEl._adj);
    $('#b-go', s).textContent = H.t(seats.length > 1 && cur === 0 ? 'Next: Rogue II' : 'Descend');
  };
  $('#b-go', s).onclick = () => {
    if (cur < seats.length - 1) { cur++; render(); return; }
    UI.launch(Object.assign({}, cfg, { seats: cfg.seats.map((seat, i) => ({ src: seat.src, build: [seats[i].prim], boon: seats[i].boon, character: seats[i].character })) }));
  };
  render();
};

/* ---------------- Launch / results ---------------- */
UI.launch = function (cfg) {
  UI.lastCfg = cfg;
  UI.closePages(); UI.clearShowcase();
  UI.fade(true);
  setTimeout(() => {
    H.G.newRun(cfg);
    UI.fade(false);
  }, 260);
};
UI.showResults = function (run, victory) {
  UI.closePages(); $('#toast').innerHTML = ''; $('#hud').hidden = true; $('#touch').hidden = true; $('#world-ui').innerHTML = ''; UI.wui = null;
  H.audio.setTheme('results');
  if (run.mode === 'tutorial') {
    H.G.quit();
    const after = UI.afterTutorial;
    const s = UI.open('scr-results', `<div class="modal plate" style="width:min(620px,100%)"><div class="eyebrow">primer complete</div><h2>You know the forms.</h2>
      <div class="sub">Every chamber after this one is cursed for real. Remember: telegraphs fill before they strike, channels can be broken, and two statuses on one foe make a reaction.</div>
      <div class="unlock">${H.glyphSVG('shrine', '#d9a441', 22)}<div><b>Milestone: First Sigils</b><div class="tiny muted">Unlocked the boon Spare Breath (+1 dash charge).</div></div></div>
      <div class="row"><button class="btn primary" id="r-go" data-autofocus>${after ? 'Bind your spells' : 'Return to the Waystone'}</button></div></div>`, { cls: 'dim', back: () => { } });
    $('#r-go', s).onclick = () => { UI.close('scr-results'); UI.afterTutorial = null; if (after) UI.showBuild(after); else UI.showHub(); };
    UI.menuScene();
    return;
  }
  const arena = run.mode === 'arena';
  const title = H.t(victory ? 'The Crown Falls' : arena ? 'The Pit Claims You' : 'Fallen');
  const c = run.deathCause;
  let cause = '';
  if (victory) cause = H.t('You unmade the Hollow Regent and walked out of the undercroft. Few rogues ever do.');
  else if (c && c.name === 'abandon') cause = H.t('You abandoned the descent.');
  else if (c) cause = esc(arena ? H.t(run.arenaRule === 'vigil' ? 'Slain by {who} on wave {w} after {t}.' : 'Slain by {who} on wave {w}.', { who: H.t(c.name), w: run.wave, t: H.fmtTime(run.arenaT) }) : H.t('Slain by {who} in Depth {d}, chamber {c} of {n}.', { who: H.t(c.name), d: H.roman(c.depth), c: c.layer + 1, n: H.DEPTHS[c.depth].layers }));
  const best = H.t(run.score > (run.prevBest || 0) && !arena ? 'New best score' : (arena && run.score > (run.prevBest || 0) ? 'New best' : ''));
  const kv = arena ? [['Score', run.score], ['Level', run.level], ['Wave', run.wave], ['Time', H.fmtTime(run.arenaT || run.time)], ['Kills', run.kills], ['Best combo', run.bestCombo], ['Reactions', run.reactions]]
    : [['Score', run.score], ['Level', run.level], ['Depth', H.roman(run.depth)], ['Chambers', run.rooms], ['Time', H.fmtTime(run.time)], ['Kills', run.kills], ['Reactions', run.reactions], ['Interrupts', run.interrupts], ['Dodges', run.dodges], ['Hits taken', run.hitsTaken]];
  const dmg = Object.entries(run.dmgBySpell).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxD = dmg.length ? dmg[0][1] : 1;
  const totalD = dmg.reduce((a, b) => a + b[1], 0) || 1;
  const nameOf = k => { if (H.SPELLS[k]) return H.SPELLS[k].name; if (H.PASSIVES[k]) return H.PASSIVES[k].name; if (k.startsWith('reaction:')) return H.REACTIONS[k.slice(9)].name; if (k.startsWith('status:')) return H.t('{s} ticks', { s: H.STATUS[k.slice(7)].name }); if (H.CHARMS[k]) return H.CHARMS[k].name; return { vent: 'Fire vents' }[k] || k; };
  const colOf = k => H.SPELLS[k] ? elCss(H.SPELLS[k].el) : k.startsWith('reaction:') ? '#fff3c4' : k.startsWith('status:') ? elCss(H.STATUS[k.slice(7)].el) : '#aaa';
  const ms = run.milestonesNew.map(k => `<div class="unlock">${H.glyphSVG('shrine', '#d9a441', 22)}<div><b>${esc(H.t('Milestone: {n}', { n: H.MILESTONES[k].name }))}</b><div class="tiny muted">${esc(H.t('{d} Unlocked: {r}', { d: H.MILESTONES[k].desc, r: H.MILESTONES[k].reward }))}</div></div></div>`).join('');
  const reacts = Object.entries(run.reactionsBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip">${esc(H.REACTIONS[k].name)} ×${v}</span>`).join('');
  const parts = arena ? '' : `<div class="tiny muted num">${H.t('Score: chambers {r}×100 · reactions {x}×15 · interrupts {i}×20 · Wardens {w} · the rest from foes slain.', { r: run.rooms, x: run.reactions, i: run.interrupts, w: run.wardens })}</div>`;
  const nextUnlock = UI.nextUnlockHint();
  const s = UI.open('scr-results', `<div class="modal plate scroll" style="width:min(1100px,100%)">
    <div class="res">
      <div class="col">
        <div class="eyebrow">${arena ? H.t('the pit') + ' · ' + H.t(run.arenaRule) : H.t(run.cfg.seats.length > 1 ? 'bound pair' : 'solo descent')}${best ? ' · ' + best : ''}</div>
        <h2 class="big" style="color:${victory ? 'var(--brass-hi)' : '#ff8a9a'}">${title}</h2>
        <div class="cause">${cause}</div>
        <div class="kv">${kv.map(([k, v]) => `<div><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join('')}</div>
        ${parts}
        <div class="row"><span class="plate embers"><span class="ember-dot"></span>${H.t('+{n} gold coins', { n: run.embersEarned || 0 })}</span><span class="muted tiny">${H.t('{n} in your purse.', { n: H.save.meta.embers })} ${esc(nextUnlock)}</span></div>
        ${ms}
      </div>
      <div class="col">
        <div class="eyebrow">build performance</div>
        ${run.finalPlayers.map(p => `<div><div class="tiny" style="color:${p.color};font-weight:800">${esc(p.name)}</div><div class="row" style="gap:6px;margin-top:4px">${p.spells.map(sp => `<span class="chip">${UI.spellIcon(sp.id, 14)} ${esc(H.SPELLS[sp.id].name)} ${UI.romanRank(sp.rank)} · ${H.t('{n} casts', { n: run.castsBySpell[sp.id] || 0 })}</span>`).join('')}</div>${p.mods && p.mods.length ? `<div class="row tiny" style="gap:6px;margin-top:4px;color:var(--brass-hi)">${p.mods.map(([k, v]) => esc(H.MODS[k].name) + (v > 1 ? ' ×' + v : '')).join(' · ')}</div>` : ''}${p.charms.length ? `<div class="row tiny muted" style="gap:6px;margin-top:4px">${p.charms.map(c => esc(H.CHARMS[c].name)).join(' · ')}</div>` : ''}</div>`).join('')}
        <div class="col" style="gap:5px">${dmg.length ? dmg.map(([k, v]) => `<div class="dbar"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nameOf(k))}</span><span class="tr"><i style="width:${(v / maxD * 100).toFixed(1)}%;background:${colOf(k)}"></i></span><span class="v">${Math.round(v / totalD * 100)}%</span></div>`).join('') : '<div class="muted">No damage dealt.</div>'}</div>
        <div class="row" style="gap:6px">${reacts || '<span class="muted tiny">No reactions this run. Pair two statuses on one foe to trigger one.</span>'}</div>
      </div>
    </div>
    <div class="row"><button class="btn primary" id="r-retry" data-autofocus>Retry <span class="k">${H.input.lastDevice === 'pad' ? 'Y' : 'R'}</span></button><button class="btn" id="r-build">Change build</button><button class="btn" id="r-hub">Waystone</button></div>
  </div>`, { cls: 'dim', back: () => toHub(), onKey: k => { if (k === 'KeyR') retry(); } , onUpdate: () => { for (const gp of H.input.pads) if (H.input.padButtonPressed(gp, 3)) retry(); } });
  const retry = () => { if (UI._retrying) return; UI._retrying = true; setTimeout(() => UI._retrying = false, 600); H.G.quit(); UI.launch(UI.lastCfg); };
  const toHub = () => { H.G.quit(); UI.showcase = null; UI.showHub(); };
  $('#r-retry', s).onclick = retry;
  $('#r-build', s).onclick = () => { H.G.quit(); UI.menuScene(); UI.showBuild(UI.lastCfg); };
  $('#r-hub', s).onclick = toHub;
};
UI.nextUnlockHint = function () {
  const m = H.save.meta; const items = [];
  for (const id in H.SPELLS) { const d = H.SPELLS[id]; if (!H.G.spellUnlocked(id) && d.embers) items.push([d.embers, d.name]); }
  for (const id in H.BOONS) { const b = H.BOONS[id]; if (!H.G.boonUnlocked(id) && b.embers) items.push([b.embers, H.BOONS[id].name]); }
  for (const id in H.CHARM_LOCKED) { const l = H.CHARM_LOCKED[id]; if (!H.G.charmUnlocked(id) && l.embers) items.push([l.embers, H.CHARMS[id].name]); }
  items.sort((a, b) => a[0] - b[0]);
  if (!items.length) return H.t('Everything purchasable is unlocked.');
  const [c, n] = items[0];
  return m.embers >= c ? H.t('You can afford {n} in the Grimoire.', { n }) : H.t('{c} more for {n}.', { c: c - m.embers, n });
};

/* ---------------- Shop (main menu): buy equipment, sell anything in a hero's bag ---------------- */
UI.STORE_PRICE = { common: 30, uncommon: 70, rare: 140, legendary: 320 };
UI.SELL_RATE = 0.4; // the merchant's purse is bottomless: sell as much as you like
UI.sellPrice = id => Math.max(1, Math.round((UI.STORE_PRICE[H.ITEMS[id].rarity] || 30) * UI.SELL_RATE));
UI.showStore = function (opt = {}) {
  UI.closePages();
  const me = H.save.meta; let hero = opt.hero || me.character || 'percy'; let tab = opt.tab || 'buy'; let filt = opt.filt || 'all';
  const s = UI.open('scr-store', `<div class="page-head"><div><div class="eyebrow">${H.t('the merchant\'s stall')}</div><h2>${H.t('Shop')}</h2></div><div class="grow"></div><span class="plate embers" id="st-w"></span><button class="btn ghost" id="st-back">${H.t('Back')} <span class="k">Esc</span></button></div>
    <div class="row store-bar" style="gap:8px;flex-wrap:wrap;align-items:center"><div class="tabs" id="st-tab"></div><div class="grow"></div><span class="muted tiny">${H.t('Hero')}</span><div class="row" style="gap:6px" id="st-hero"></div></div>
    <div class="sub muted tiny" id="st-sub" style="margin:6px 0"></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px" id="st-filt"></div>
    <div class="scroll" style="flex:1;min-height:0" id="st-body"></div>`, { page: true, back: () => leave(), onTab: d => { tab = tab === 'buy' ? 'sell' : 'buy'; render(); } });
  const leave = () => { H.saveNow(); UI.showHub(); };
  $('#st-back', s).onclick = leave;
  const heroName = c => H.t(H.CHARACTERS[c].name);
  const card = (id, btn, extra) => { const it = H.ITEMS[id]; const sl = H.EQUIP_SLOTS.find(x => x.id === it.slot); return `<div class="gitem sitem" style="border-color:${H.RARITY[it.rarity].css}55">${UI.itemIcon(id, 30)}<div class="grow"><b>${esc(it.name)}</b><div class="tiny" style="color:${H.RARITY[it.rarity].css}">${esc(H.t(H.RARITY[it.rarity].name))} · ${esc(H.t(sl.name))}${extra || ''}</div><div class="istats">${UI.itemStatsHtml(it)}</div></div>${btn}</div>`; };
  const coin = n => `<span class="ember-dot"></span>${n}`;
  const render = () => {
    $('#st-w', s).innerHTML = `<span class="ember-dot"></span><span class="num">${me.embers}</span> ${H.t('gold coins')}`;
    $('#st-tab', s).innerHTML = [['buy', H.t('Buy')], ['sell', H.t('Sell')]].map(([k, n]) => `<button class="btn ${tab === k ? "on" : ""}" data-tab="${k}">${n}</button>`).join('');
    $('#st-hero', s).innerHTML = Object.keys(H.CHARACTERS).map(c => `<button class="btn ${c === hero ? 'primary' : 'ghost'}" data-hero="${c}">${esc(heroName(c))}</button>`).join('');
    const g = H.G.heroGear(hero);
    const cats = [['all', H.t('All')]].concat(H.EQUIP_SLOTS.filter(sl => Object.values(H.ITEMS).some(it => it.slot === sl.id)).map(sl => [sl.id, H.t(sl.name)]));
    $('#st-filt', s).innerHTML = cats.map(([k, n]) => `<button class="chip fchip ${filt === k ? 'on' : ''}" data-f="${k}">${esc(n)}</button>`).join('');
    const free = gg => gg.bag.filter(x => !x).length;
    let h = '';
    if (tab === 'buy') {
      $('#st-sub', s).textContent = H.t('Purchases go straight to the bag of the hero who can use them: weapons to the Veteran, armour to the hero selected above ({n}).', { n: heroName(hero) }) + ' ' + H.t('Free space: {n}', { n: free(g) });
      const ids = Object.keys(H.ITEMS).filter(id => filt === 'all' || H.ITEMS[id].slot === filt).sort((a, b) => H.EQUIP_SLOTS.findIndex(x => x.id === H.ITEMS[a].slot) - H.EQUIP_SLOTS.findIndex(x => x.id === H.ITEMS[b].slot) || ['common', 'uncommon', 'rare', 'legendary'].indexOf(H.ITEMS[a].rarity) - ['common', 'uncommon', 'rare', 'legendary'].indexOf(H.ITEMS[b].rarity));
      h = '<div class="grid2">' + ids.map(id => { const it = H.ITEMS[id]; const to = it.hero || hero; const price = UI.STORE_PRICE[it.rarity]; const ok = me.embers >= price; const note = it.hero ? ` · <span style="color:#e8c46a">${esc(H.t('for {n}', { n: heroName(to) }))}</span>` : ''; return card(id, `<button class="btn ${ok ? 'primary' : ''}" data-buy="${id}">${coin(price)}</button>`, note); }).join('') + '</div>';
    } else {
      const items = g.bag.map((id, i) => [id, i]).filter(([id]) => id && H.ITEMS[id] && (filt === 'all' || H.ITEMS[id].slot === filt));
      $('#st-sub', s).textContent = H.t("The merchant's purse is bottomless: sell as much as you like. Only items in the bag can be sold; unequip in the Inventory first.") ;
      h = items.length ? '<div class="grid2">' + items.map(([id, i]) => card(id, `<button class="btn primary" data-sell="${i}">+${coin(UI.sellPrice(id))}</button>`)).join('') + '</div>' : `<div class="muted" style="padding:20px 0">${esc(H.t("{n}'s bag is empty.", { n: heroName(hero) }))}</div>`;
    }
    $('#st-body', s).innerHTML = h;
    s.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; sfx('ui_move'); render(); });
    s.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => { hero = b.dataset.hero; sfx('ui_move'); render(); });
    s.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filt = b.dataset.f; sfx('ui_move'); render(); });
    s.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const id = b.dataset.buy, it = H.ITEMS[id], price = UI.STORE_PRICE[it.rarity], to = it.hero || hero, gg = H.G.heroGear(to);
      if (me.embers < price) { sfx('ui_deny'); UI.toast(H.t('Need {n} more gold coins', { n: price - me.embers })); return; }
      const slot = gg.bag.findIndex(x => !x); if (slot < 0) { sfx('ui_deny'); UI.toast(H.t("{n}'s bag is full", { n: heroName(to) })); return; }
      me.embers -= price; gg.bag[slot] = id; H.saveNow(); sfx('reward');
      UI.toast(H.t('Bought {i} → {n}\'s bag', { i: it.name, n: heroName(to) })); render();
    });
    s.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
      const i = +b.dataset.sell, id = g.bag[i]; if (!id) return; const v = UI.sellPrice(id);
      g.bag[i] = null; me.embers += v; H.saveNow(); sfx('reward'); UI.toast(H.t('Sold {i} for {v}', { i: H.ITEMS[id].name, v }) + ' ' + H.t('gold coins')); render();
    });
  };
  render();
};

/* ---------------- Grimoire ---------------- */
UI.showGrimoire = function () {
  UI.closePages();
  const s = UI.open('scr-grim', `<div class="page-head"><div><div class="eyebrow">unlocks widen your options, never your stats</div><h2>Grimoire</h2></div><div class="grow"></div><span class="plate embers" id="g-emb"></span><button class="btn ghost" id="g-back">Back <span class="k">Esc</span></button></div>
    <div class="scroll" style="flex:1;min-height:0" id="g-body"></div>`, { page: true, back: () => UI.showHub() });
  $('#g-back', s).onclick = () => UI.showHub();
  const render = () => {
    const m = H.save.meta;
    $('#g-emb', s).innerHTML = `<span class="ember-dot"></span><span class="num">${m.embers}</span> ${H.t('gold coins')}`;
    const item = (icon, name, desc, un, how, cost, kind, id) => `<div class="gitem ${un ? '' : 'locked'}">${icon}<div class="grow"><b>${esc(name)}</b><p>${esc(desc)}</p>${un ? '' : `<div class="how">${esc(how)}</div>`}</div>${!un && cost ? `<button class="btn ${m.embers >= cost ? 'primary' : ''}" data-buy="${kind}:${id}" ${m.embers >= cost ? '' : 'data-poor="1"'}>${cost}</button>` : (un ? '<span class="chip">known</span>' : '')}</div>`;
    let h = '<div class="eyebrow" style="margin:6px 0">spells</div><div class="grid2">';
    for (const el of H.EL_ORDER) for (const id in H.SPELLS) { const d = H.SPELLS[id]; if (d.el !== el) continue; const un = H.G.spellUnlocked(id); const how = d.milestone ? H.t('Milestone: {n} — {d}', { n: H.MILESTONES[d.milestone].name, d: H.MILESTONES[d.milestone].desc }) : ''; h += item(UI.spellIcon(id, 26), d.name, d.desc(H.spellStats(id, 1)), un, how + (d.embers ? H.t(how ? ' Or buy:' : 'Buy with gold coins.') : ''), d.embers, 'spell', id); }
    h += '</div><div class="eyebrow" style="margin:14px 0 6px">boons (one per run)</div><div class="grid2">';
    for (const id in H.BOONS) { const b = H.BOONS[id]; const un = H.G.boonUnlocked(id); h += item(H.glyphSVG('shrine', '#d9a441', 24), b.name, b.desc, un, b.milestone ? H.t('Milestone: {n} — {d}', { n: H.MILESTONES[b.milestone].name, d: H.MILESTONES[b.milestone].desc }) : H.t('Buy with gold coins.'), b.embers, 'boon', id); }
    h += '</div><div class="eyebrow" style="margin:14px 0 6px">charms (found in runs)</div><div class="grid2">';
    for (const id in H.CHARMS) { const c = H.CHARMS[id]; const l = H.CHARM_LOCKED[id]; const un = H.G.charmUnlocked(id); h += item(H.glyphSVG(c.el, elCss(c.el), 22), c.name, c.desc, un, l && l.milestone ? H.t('Milestone: {n} — {d}', { n: H.MILESTONES[l.milestone].name, d: H.MILESTONES[l.milestone].desc }) : H.t('Buy with gold coins to add it to the charm pool.'), l && l.embers, 'charm', id); }
    $('#g-body', s).innerHTML = h + '</div>';
    $$('[data-buy]', s).forEach(b => b.onclick = () => {
      const [kind, id] = b.dataset.buy.split(':'); const cost = kind === 'spell' ? H.SPELLS[id].embers : kind === 'boon' ? H.BOONS[id].embers : H.CHARM_LOCKED[id].embers;
      if (m.embers < cost) { sfx('ui_deny'); UI.toast(H.t('Need {n} more gold coins', { n: cost - m.embers })); return; }
      m.embers -= cost; const arr = m.unlocked[kind === 'spell' ? 'spells' : kind === 'boon' ? 'boons' : 'charms']; if (!arr.includes(id)) arr.push(id);
      H.saveNow(); sfx('reward'); UI.toast(H.t('Unlocked {x}', { x: kind === 'spell' ? H.SPELLS[id].name : kind === 'boon' ? H.BOONS[id].name : H.CHARMS[id].name })); render();
    });
  };
  render();
};

/* ---------------- Records ---------------- */
UI.showRecords = function () {
  UI.closePages();
  const m = H.save.meta, st = m.stats;
  const rows = [['Runs', st.runs], ['Victories', st.wins], ['Deepest', st.bestDepth ? H.t('Depth {d}', { d: H.roman(st.bestDepth) }) : '—'], ['Best score', st.bestScore], ['Chambers cleared', st.rooms], ['Foes slain', st.kills], ['Reactions', st.reactions], ['Interrupts', st.interrupts], ['Elites slain', st.elites], ['Wardens unmade', st.wardens], ['Siege best', H.t('wave {w} · {s}', { w: st.arenaBestWave, s: st.arenaBestScore })], ['Vigil best', H.fmtTime(st.vigilBest)], ['Time below', H.fmtTime(st.playtime)], ['Gold earned', m.totalEmbers]];
  const s = UI.open('scr-rec', `<div class="page-head"><div><div class="eyebrow">what the undercroft remembers</div><h2>Records</h2></div><div class="grow"></div><button class="btn ghost" id="rc-back">Back <span class="k">Esc</span></button></div>
    <div class="scroll" style="flex:1;min-height:0"><div class="kv" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${rows.map(([k, v]) => `<div><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join('')}</div>
    <div class="eyebrow" style="margin:14px 0 6px">milestones</div><div class="grid2">${Object.keys(H.MILESTONES).map(k => { const ms = H.MILESTONES[k]; const done = !!m.milestones[k]; return `<div class="gitem ${done ? '' : 'locked'}">${H.glyphSVG(done ? 'shrine' : 'mystery', done ? '#d9a441' : '#746b80', 24)}<div class="grow"><b>${esc(ms.name)}</b><p>${esc(ms.desc)}</p><div class="how" style="color:${done ? 'var(--good)' : '#ffb36b'}">${esc(H.t(done ? 'Unlocked: {r}' : 'Reward: {r}', { r: ms.reward }))}</div></div></div>`; }).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn" id="rc-primer">Replay the primer</button><button class="btn danger" id="rc-wipe">Erase all progress</button></div></div>`, { page: true, back: () => UI.showHub() });
  $('#rc-back', s).onclick = () => UI.showHub();
  $('#rc-primer', s).onclick = () => UI.startTutorial(null);
  $('#rc-wipe', s).onclick = () => UI.confirm('Erase all progress?', 'Gold coins, unlocks, milestones and records will be gone. Settings and controls are kept.', () => { const set = H.save.settings, b = H.save.bindings; H.resetSave(); H.save.settings = set; H.settings = set; H.save.bindings = b; H.saveNow(); UI.toast(H.t('Progress erased')); UI.showRecords(); }, null, 'Erase', 'Keep it');
};

/* ---------------- How to play ---------------- */
UI.showHowTo = function (fromPause) {
  if (!fromPause) UI.closePages();
  const kb = a => esc(H.keyName(H.save.bindings.kb[a][0]));
  const pd = a => esc(H.padName(H.save.bindings.pad[a]));
  const s = UI.open('scr-how', `<div class="page-head"><div><div class="eyebrow">the forms</div><h2>How to play</h2></div><div class="grow"></div><button class="btn ghost" id="hw-back">Back <span class="k">Esc</span></button></div>
    <div class="scroll" style="flex:1;min-height:0">
      <div class="ctrl-grid">
        <div class="plate"><div class="eyebrow">keyboard &amp; mouse</div><table>
          <tr><td>Move</td><td><span class="kbd">${kb('up')}</span><span class="kbd">${kb('left')}</span><span class="kbd">${kb('down')}</span><span class="kbd">${kb('right')}</span></td></tr><tr><td>Aim</td><td>Mouse</td></tr>
          <tr><td>Spells I–IV</td><td><span class="kbd">${kb('cast1')}</span> <span class="kbd">${kb('cast2')}</span> <span class="kbd">${kb('cast3')}</span> <span class="kbd">${kb('cast4')}</span></td></tr>
          <tr><td>Ultimate</td><td><span class="kbd">${kb('ult')}</span></td></tr><tr><td>Dash</td><td><span class="kbd">${kb('dash')}</span></td></tr><tr><td>Interact</td><td><span class="kbd">${kb('interact')}</span></td></tr><tr><td>Inventory</td><td><span class="kbd">${kb('inventory')}</span></td></tr><tr><td>Map · Pause</td><td><span class="kbd">${kb('map')}</span> <span class="kbd">${kb('pause')}</span></td></tr></table></div>
        <div class="plate"><div class="eyebrow">gamepad</div><table>
          <tr><td>Move · Aim</td><td>Left stick · Right stick</td></tr><tr><td>Spells I–IV</td><td><span class="kbd">${pd('cast1')}</span> <span class="kbd">${pd('cast2')}</span> <span class="kbd">${pd('cast3')}</span> <span class="kbd">${pd('cast4')}</span></td></tr>
          <tr><td>Ultimate</td><td><span class="kbd">${pd('ult')}</span></td></tr><tr><td>Dash</td><td><span class="kbd">${pd('dash')}</span></td></tr><tr><td>Interact</td><td><span class="kbd">${pd('interact')}</span></td></tr><tr><td>Inventory</td><td><span class="kbd">${pd('inventory')}</span></td></tr><tr><td>Map · Pause</td><td><span class="kbd">${pd('map')}</span> <span class="kbd">${pd('pause')}</span></td></tr>
          <tr><td colspan="2" class="muted tiny">With the right stick idle, spells auto-target the nearest foe (toggle in Settings).</td></tr></table></div>
        <div class="plate"><div class="eyebrow">touch (landscape)</div><table>
          <tr><td>Move</td><td>Drag the left half</td></tr><tr><td>Cast</td><td>Tap a spell: auto-aim</td></tr><tr><td>Aimed cast</td><td>Drag from a spell, release</td></tr><tr><td>Dash</td><td>Big button</td></tr><tr><td>Interact</td><td>Hand button when near</td></tr></table></div>
      </div>
      <div class="eyebrow" style="margin:14px 0 6px">reading danger</div>
      <div class="codex"><div><b>Telegraphs</b><br>Crimson shapes on the floor fill up before they strike. When full, they hit. Leave, or dash through: you are untouchable mid-dash.</div>
        <div><b>Channels</b><br>A striped bar over a foe means it is channeling. Break it with any interrupting spell (Gust Fan, Quake Spike, Frost Snare, Hurled Cairn, Gravity Well) or enough damage.</div>
        <div><b>Wardens</b><br>Each Warden has phases, arena hazards and a yellow stagger bar. Fill it with damage, reactions and interrupts to stun them.</div>
        <div><b>Hostile bolts</b><br>Spiky crimson stars with a ground shadow belong to foes. Your spells glow in their element color.</div></div>
      <div class="eyebrow" style="margin:14px 0 6px">elements &amp; statuses</div>
      <div class="codex">${H.EL_ORDER.map(e => `<div>${H.glyphSVG(e, elCss(e), 18)} <b style="color:${elCss(e)}">${H.EL[e].name}</b> → ${esc(H.STATUS[H.EL[e].status].name)}<br>${esc(H.EL[e].blurb)}</div>`).join('')}</div>
      <div class="eyebrow" style="margin:14px 0 6px">${H.t('effects')}</div>
      <div class="codex">${Object.keys(H.STATUS).map(k => `<div>${H.glyphSVG(H.statusGlyph(k), H.statusCss(k), 18)} <b style="color:${H.statusCss(k)}">${esc(H.STATUS[k].name)}</b><br>${esc(H.STATUS[k].desc || '')}</div>`).join('')}</div>
      <div class="eyebrow" style="margin:14px 0 6px">${H.t('enemy classes')}</div>
      <div class="codex">${H.CLASS_ORDER.map(c => { const C = H.CLASSES[c]; const foes = Object.keys(H.ENEMIES).filter(t => H.ENEMIES[t].cls === c).map(t => H.ENEMIES[t].name); return `<div>${H.glyphSVG('cls', C.css, 18)} <b style="color:${C.css}">${esc(C.name)}</b> <span class="muted tiny">${esc(C.desc)}</span><br><span class="muted tiny">${esc(H.t('Examples'))}: ${esc(C.ex)}</span><br><b>${esc(H.t('Trait'))}:</b> ${esc(C.trait)}<br><b>${esc(H.t('Weakness'))}:</b> ${esc(C.weak)}${foes.length ? `<br><span style="color:${C.css}">${esc(H.t('In the undercroft'))}: ${esc(foes.join(', '))}</span>` : ''}</div>`; }).join('')}</div>
      <div class="eyebrow" style="margin:14px 0 6px">reactions</div>
      <div class="codex">${Object.values(H.REACTIONS).map(r => `<div><b>${esc(r.name)}</b><br>${esc(r.desc)}</div>`).join('')}</div>
      <div class="eyebrow" style="margin:14px 0 6px">the descent</div>
      <div class="codex">${Object.values(H.NODES).map(n => `<div>${H.glyphSVG(n.glyph, n.css, 18)} <b style="color:${n.css}">${esc(n.name)}</b><br>${esc(n.desc)}</div>`).join('')}</div>
    </div>`, { page: !fromPause, cls: fromPause ? 'dim' : '', back: () => fromPause ? UI.close('scr-how') : UI.showHub() });
  $('#hw-back', s).onclick = () => fromPause ? UI.close('scr-how') : UI.showHub();
};

/* ---------------- Settings ---------------- */
UI.showSettings = function (fromPause) {
  if (!fromPause) UI.closePages();
  let tab = UI._setTab || 'audio';
  const tabs = [['audio', 'Audio'], ['video', 'Video'], ['controls', 'Controls'], ['access', 'Accessibility'], ['game', 'Gameplay']];
  const s = UI.open('scr-set', `<div class="${fromPause ? 'modal plate' : ''}" style="${fromPause ? '' : 'display:flex;flex-direction:column;gap:14px;flex:1;min-height:0'};${fromPause ? 'height:100%' : ''}">
    <div class="page-head"><div><div class="eyebrow">tune the undercroft</div><h2 class="${fromPause ? '' : ''}" style="font-family:var(--f-display);font-size:calc(40px * var(--ts))">Settings</h2></div><div class="grow"></div><div class="tabs" id="st-tabs"></div><button class="btn ghost" id="st-back">Back <span class="k">Esc</span></button></div>
    <div class="scroll" style="flex:1;min-height:0" id="st-body"></div></div>`, { page: !fromPause, cls: fromPause ? 'dim' : '', back: () => close(), onTab: d => { const i = tabs.findIndex(t => t[0] === tab); tab = tabs[(i + d + tabs.length) % tabs.length][0]; UI._setTab = tab; render(); } });
  const close = () => { H.saveNow(); if (fromPause) UI.close('scr-set'); else UI.showHub(); };
  $('#st-back', s).onclick = close;
  const S = H.settings;
  const apply = () => { H.audio.applyVolumes(); H.applyTextScale(); $('#fps').hidden = !S.showFps; H.saveNow(); };
  const slider = (key, label, sub, min, max, step, fmt, after) => ({ key, label, sub, kind: 'slider', min, max, step, fmt, after });
  const seg = (key, label, sub, opts, after) => ({ key, label, sub, kind: 'seg', opts, after });
  const tog = (key, label, sub, after) => ({ key, label, sub, kind: 'seg', opts: [[false, 'Off'], [true, 'On']], after });
  const pct = v => Math.round(v * 100) + '%';
  const defs = {
    audio: [slider('master', 'Master volume', '', 0, 1, 0.05, pct), slider('music', 'Music', 'Adaptive score that rises with danger.', 0, 1, 0.05, pct), slider('sfx', 'Sound effects', '', 0, 1, 0.05, pct)],
    video: [seg('quality', 'Quality', 'Low lowers resolution, shadows and particles for phones.', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], () => H.R.applyQuality()), slider('shake', 'Screen shake', '0% turns it off.', 0, 1.5, 0.1, pct), tog('dmgNumbers', 'Damage numbers', ''), tog('showFps', 'Show frame rate', '')],
    controls: [seg('aimAssist', 'Aim assistance', 'Gamepad and touch aiming bends toward foes.', [['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]), tog('padAutoAim', 'Gamepad auto-target', 'With the right stick idle, aim at the nearest foe.'), tog('mouseAssist', 'Mouse magnetism', 'Snap to a foe under the cursor.'), tog('autoRepeat', 'Hold to repeat attacks', 'Holding an attack spell re-casts it when ready.'), tog('rumble', 'Gamepad vibration', ''), slider('touchScale', 'Touch control size', '', 0.8, 1.4, 0.05, pct, () => UI.buildTouch())],
    access: [seg('textScale', 'Text size', '', [[0.9, '90%'], [1, '100%'], [1.15, '115%'], [1.3, '130%']]), seg('gameSpeed', 'Game speed', 'Slows the whole game for more reaction time.', [[0.6, '60%'], [0.8, '80%'], [1, '100%']]), tog('hiTelegraph', 'High-contrast telegraphs', 'Opaque striped danger zones instead of glowing ones.'), tog('reduceFlash', 'Reduce flashing', 'Dims light bursts from impacts.'), tog('statusGlyphs', 'Status badges on foes', 'Shape-coded icons, readable without color.'), slider('allyFx', 'Ally effect intensity', 'Co-op: dims Rogue II particles to cut clutter.', 0.2, 1, 0.05, pct)],
    game: [seg('lang', 'Language', 'English or Latin American Spanish.', [['en', 'English'], ['es', 'Español (Latinoamérica)']], () => { H.setLang(S.lang); UI._setTab = 'game'; UI.close('scr-set'); UI.showSettings(fromPause); })]
  };
  const render = () => {
    $('#st-tabs', s).innerHTML = tabs.map(([k, n]) => `<button class="btn ${k === tab ? 'on' : ''}" data-t="${k}">${n}</button>`).join('') + '<span class="k muted tiny">LB / RB</span>';
    $$('#st-tabs button', s).forEach(b => b.onclick = () => { tab = b.dataset.t; UI._setTab = tab; render(); });
    const body = $('#st-body', s);
    let h = '<div class="setlist">';
    for (const d of defs[tab]) {
      h += `<div class="set" data-nav data-adjust data-k="${d.key}"><div class="lab">${esc(d.label)}${d.sub ? `<small>${esc(d.sub)}</small>` : ''}</div>`;
      if (d.kind === 'slider') h += `<div class="slider"><input type="range" id="st-${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${S[d.key]}" tabindex="-1"><output>${d.fmt(S[d.key])}</output></div>`;
      else h += `<div class="seg">${d.opts.map(([v, n]) => `<button tabindex="-1" data-v="${String(v)}" class="${S[d.key] === v ? 'on' : ''}">${n}</button>`).join('')}</div>`;
      h += '</div>';
    }
    h += '</div>';
    if (tab === 'controls') {
      h += `<div class="eyebrow" style="margin:14px 0 6px">remap · select a binding, then press the new key or button (Esc cancels)</div><div style="overflow-x:auto"><table class="binds"><tr><th>Action</th><th>Key</th><th>Alt key</th><th>Gamepad</th></tr>`;
      for (const a of H.ACTIONS) { const kb = H.save.bindings.kb[a] || []; const pd = H.save.bindings.pad[a]; h += `<tr><td>${esc(H.ACTION_NAMES[a])}</td><td><button class="bind" data-nocapture data-b="kb:${a}:0">${esc(H.keyName(kb[0]))}</button></td><td><button class="bind" data-nocapture data-b="kb:${a}:1">${esc(H.keyName(kb[1]))}</button></td><td>${pd != null || !['up', 'down', 'left', 'right'].includes(a) ? `<button class="bind" data-nocapture data-b="pad:${a}">${pd != null ? esc(H.padName(pd)) : '—'}</button>` : '<span class="muted tiny">left stick</span>'}</td></tr>`; }
      h += `</table></div><div class="row" style="margin-top:10px"><button class="btn" id="st-reset">Reset to defaults</button></div>`;
    }
    if (tab === 'game') h += `<div class="setlist"><div class="set"><div class="lab">Replay the primer<small>The two-minute controls tutorial.</small></div><button class="btn" id="st-primer">Start primer</button></div><div class="set"><div class="lab">Reset all settings<small>Audio, video, accessibility and controls.</small></div><button class="btn" id="st-resetall">Reset settings</button></div></div>`;
    body.innerHTML = h;
    for (const d of defs[tab]) {
      const row = $(`.set[data-k="${d.key}"]`, body);
      const set = v => { S[d.key] = v; apply(); d.after && d.after(); };
      if (d.kind === 'slider') {
        const inp = $('input', row), out = $('output', row);
        inp.oninput = () => { set(+inp.value); out.textContent = d.fmt(+inp.value); };
        row.addEventListener('adjust', e => { const v = H.clamp(+(S[d.key] + e.detail * d.step).toFixed(3), d.min, d.max); inp.value = v; set(v); out.textContent = d.fmt(v); });
      } else {
        const btns = $$('.seg button', row);
        const pickV = str => d.opts.find(o => String(o[0]) === str)[0];
        btns.forEach(b => b.onclick = () => { set(pickV(b.dataset.v)); btns.forEach(x => x.classList.toggle('on', x === b)); });
        row.addEventListener('adjust', e => { const i = d.opts.findIndex(o => o[0] === S[d.key]); const j = H.clamp(i + e.detail, 0, d.opts.length - 1); set(d.opts[j][0]); btns.forEach((x, k) => x.classList.toggle('on', k === j)); });
      }
    }
    $$('.bind', body).forEach(b => b.onclick = () => {
      const [kind, a, idx] = b.dataset.b.split(':');
      b.classList.add('wait'); b.textContent = kind === 'pad' ? 'press button' : 'press key';
      setTimeout(() => {
        H.input.captureHook = ev => {
          if (ev.type === 'key' && ev.code === 'Escape' && kind === 'kb') { H.input.captureHook = null; render(); return; }
          if (kind === 'kb' && ev.type === 'key') {
            const kbB = H.save.bindings.kb; for (const k in kbB) kbB[k] = kbB[k].map(c => c === ev.code ? null : c);
            kbB[a][+idx] = ev.code; H.input.captureHook = null; H.saveNow(); sfx('ui_ok'); render();
          } else if (kind === 'pad' && ev.type === 'pad') {
            const pb = H.save.bindings.pad; for (const k in pb) if (pb[k] === ev.button && k !== a) pb[k] = null; pb[a] = ev.button; H.input.captureHook = null; H.saveNow(); sfx('ui_ok'); render();
          } else if (kind === 'pad' && ev.type === 'key' && ev.code === 'Escape') { H.input.captureHook = null; render(); }
        };
      }, 50);
    });
    const rs = $('#st-reset', body); if (rs) rs.onclick = () => { H.save.bindings = H.defaultBindings(); H.saveNow(); UI.toast(H.t('Controls reset')); render(); };
    const pr = $('#st-primer', body); if (pr) pr.onclick = () => { if (fromPause) { UI.toast(H.t('Finish or abandon this run first')); return; } UI.startTutorial(null); };
    const ra = $('#st-resetall', body); if (ra) ra.onclick = () => { Object.assign(S, H.defaultSettings()); H.save.bindings = H.defaultBindings(); apply(); H.R.applyQuality(); UI.toast(H.t('Settings reset')); render(); };
  };
  render();
};

/* ---------------- Pause ---------------- */
UI.skipTutorial = function () {
  const G = H.G; UI.closePages(); G.paused = false; G.modal = null; H.save.tutorialDone = true; H.saveNow(); G.quit(); UI.tutMin = false;
  const after = UI.afterTutorial; UI.afterTutorial = null; UI.menuScene(); $('#hud').hidden = true; $('#touch').hidden = true; $('#world-ui').innerHTML = ''; UI.wui = null;
  if (after) UI.showBuild(after); else UI.showHub();
};
/* Fullscreen (mainly for phones). Not every browser/iframe allows it; we say so if it fails. */
H.fs = {
  el: () => document.fullscreenElement || document.webkitFullscreenElement,
  supported: () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled),
  toggle() {
    const de = document.documentElement;
    if (H.fs.el()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    if (!req) { UI.toast(H.t('Fullscreen is not available here')); return; }
    try { const p = req.call(de, { navigationUI: 'hide' }); const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }; if (p && p.then) p.then(lock).catch(() => UI.toast(H.t('Fullscreen is not available here'))); else lock(); } catch (e) { UI.toast(H.t('Fullscreen is not available here')); }
  }
};
UI.fsIcon = () => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#ece4d2" stroke-width="2"><path d="M2 6V2h4M12 2h4v4M16 12v4h-4M6 16H2v-4"/></svg>`;
UI.showPause = function () {
  const G = H.G; if (!G.active || G.modal || UI.layers.some(l => l.id === 'scr-pause')) return;
  G.paused = true; sfx('ui_back');
  const run = G.run; const tut = run.mode === 'tutorial';
  const p = G.players[0];
  const s = UI.open('scr-pause', `<div class="modal plate" style="width:min(760px,100%)">
    <div class="eyebrow">${tut ? H.t('the primer') : H.t('Lv {n}', { n: run.level }) + ' · ' + (run.mode === 'arena' ? H.t('the pit · wave {w}', { w: run.wave }) : esc(H.t('depth {d} · {n}', { d: H.roman(run.depth), n: H.DEPTHS[run.depth].name })))}</div><h2>Paused</h2>
    <div class="row" style="gap:6px">${G.players.map(pl => pl.spells.concat([pl.ult]).filter(Boolean).map(sp => `<span class="chip">${UI.spellIcon(sp.id, 14)} ${esc(H.SPELLS[sp.id].name)} ${UI.romanRank(sp.rank)}</span>`).join('') + Object.entries(pl.mods || {}).map(([k, v]) => `<span class="chip" style="color:var(--brass-hi)">${H.glyphSVG('attack', '#f4d58a', 12)} ${esc(H.MODS[k].name)}${v > 1 ? ' ×' + v : ''}</span>`).join('') + Object.keys(pl.passives || {}).map(k => `<span class="chip" style="color:${elCss(H.PASSIVES[k].el)}">${H.glyphSVG('movement', elCss(H.PASSIVES[k].el), 12)} ${esc(H.PASSIVES[k].name)}</span>`).join('')).join('<span class="muted">·</span>')}</div>
    ${p && p.charms.size ? `<div class="tiny muted">${[...p.charms].map(c => `<b style="color:var(--bone)">${esc(H.CHARMS[c].name)}</b>: ${esc(H.CHARMS[c].desc)}`).join('<br>')}</div>` : ''}
    <div class="col" style="max-width:320px">
      <button class="btn primary" id="p-res" data-autofocus>Resume</button>
      <button class="btn" id="p-inv">Inventory</button>
      ${H.fs.supported() ? '<button class="btn" id="p-fs">' + H.t('Fullscreen') + '</button>' : ''}
      ${!tut && run.mode !== 'arena' ? '<button class="btn" id="p-map">Chamber map</button>' : ''}
      <button class="btn" id="p-how">Controls &amp; reactions</button>
      <button class="btn" id="p-set">Settings</button>
      <button class="btn danger" id="p-quit">${tut ? 'Skip the primer' : 'Abandon run'}</button>
    </div></div>`, { cls: 'dim', back: () => resume() });
  const resume = () => { UI.close('scr-pause'); G.paused = false; };
  $('#p-res', s).onclick = resume;
  const mp = $('#p-map', s); if (mp) mp.onclick = () => UI.showMap();
  $('#p-inv', s).onclick = () => UI.showInventory();
  const pfs = $('#p-fs', s); if (pfs) pfs.onclick = () => H.fs.toggle();
  $('#p-how', s).onclick = () => UI.showHowTo(true);
  $('#p-set', s).onclick = () => UI.showSettings(true);
  $('#p-quit', s).onclick = () => {
    if (tut) { UI.close('scr-pause'); UI.skipTutorial(); return; }
    UI.confirm('Abandon this run?', 'It ends now and counts as a defeat. Gold coins earned so far are kept.', () => { UI.close('scr-pause'); G.paused = false; run.deathCause = { name: 'abandon' }; G.endRun(false); }, null, 'Abandon', 'Keep going');
  };
};

/* ---------------- Map ---------------- */
UI.showMap = function () {
  const G = H.G; const run = G.run; if (!run || !run.map) { UI.toast(H.t('No map here')); return; }
  const wasPaused = G.paused; G.paused = true;
  const L = run.map.layers; const W = 640, Hh = 420, pad = 40;
  const pos = n => { const row = L[n.layer]; const x = row.length === 1 ? W / 2 : pad + 60 + (W - 2 * pad - 120) * n.col / (row.length - 1); const y = Hh - pad - (Hh - 2 * pad) * n.layer / (L.length - 1); return [x, y]; };
  let lines = '', nodes = '';
  const cur = run.node;
  for (const row of L) for (const n of row) for (const m of n.next) { const [x1, y1] = pos(n), [x2, y2] = pos(m); const hot = n === cur; lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${hot ? '#f4d58a' : n.visited && m.visited ? '#9a8a6a' : '#3a3344'}" stroke-width="${hot ? 3 : 2}" stroke-dasharray="${hot ? '6 5' : ''}"/>`; }
  for (const row of L) for (const n of row) {
    const [x, y] = pos(n); const info = H.NODES[n.type]; const isCur = n === cur; const reach = cur && cur.next.includes(n);
    nodes += `<g transform="translate(${x},${y})"><circle r="${n.type === 'warden' ? 26 : 20}" fill="${isCur ? '#3a2e1a' : n.visited ? '#241e2c' : '#15111b'}" stroke="${isCur ? '#f4d58a' : reach ? info.css : '#4a4055'}" stroke-width="${isCur || reach ? 3 : 1.5}">${reach ? '<animate attributeName="stroke-opacity" values="1;.3;1" dur="1.4s" repeatCount="indefinite"/>' : ''}</circle><g transform="translate(-12,-12)" opacity="${n.visited && !isCur ? .45 : 1}"><path d="${H.GLYPH[info.glyph].d}" fill="${H.GLYPH[info.glyph].fill ? info.css : 'none'}" stroke="${info.css}" stroke-width="${H.GLYPH[info.glyph].fill ? .6 : 1.8}" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd"/></g></g>`;
  }
  const s = UI.open('scr-map', `<div class="modal plate" style="width:min(980px,100%);height:100%">
    <div class="page-head"><div><div class="eyebrow">${H.t('depth {d} of III', { d: H.roman(run.depth) })}</div><h2>${esc(H.DEPTHS[run.depth].name)}</h2></div><div class="grow"></div><button class="btn" id="mp-close" data-autofocus>Close <span class="k">${esc(UI.keyFor('map'))}</span></button></div>
    <div class="mapwrap"><svg class="mapsvg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="xMidYMid meet">${lines}${nodes}</svg>
    <div class="legend">${Object.values(H.NODES).map(n => `<div>${H.glyphSVG(n.glyph, n.css, 18)}<span><b>${esc(n.name)}</b><br><span class="muted tiny">${esc(n.desc)}</span></span></div>`).join('')}</div></div>
    <div class="tiny muted">You are at the gold ring. Pulsing rings are the doors ahead. Wardens wait at the top.</div></div>`, { cls: 'dim', x: false, back: () => close() });
  const close = () => { UI.close('scr-map'); G.paused = wasPaused; };
  $('#mp-close', s).onclick = close;
  UI.top().onKey = k => { if ((H.save.bindings.kb.map || []).includes(k)) close(); };
  UI.top().onUpdate = () => { for (const gp of H.input.pads) if (H.input.padButtonPressed(gp, H.save.bindings.pad.map)) close(); };
};

/* ---------------- Reward / swap / event modals ---------------- */
/* Gold "new ability" emblem: ringed circle with four spikes, a sword behind a bold cross, sparkles. */
UI._emb = 0;
UI.emblemNew = function (size = 56) {
  const k = 'em' + (UI._emb++);
  return `<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><defs>
    <linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".35" stop-color="#ffd24a"/><stop offset=".75" stop-color="#e09a12"/><stop offset="1" stop-color="#9a5a08"/></linearGradient>
    <radialGradient id="${k}r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcc33" stop-opacity=".55"/><stop offset="1" stop-color="#ffcc33" stop-opacity="0"/></radialGradient>
    <filter id="${k}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <circle cx="50" cy="50" r="46" fill="url(#${k}r)"/>
    <g filter="url(#${k}f)" fill="url(#${k}g)" stroke="#7a4a06" stroke-width=".8">
      <circle cx="50" cy="50" r="36" fill="none" stroke="url(#${k}g)" stroke-width="3"/>
      <path d="M50 6l4 8-4 4-4-4zM50 94l4-8-4-4-4 4zM6 50l8-4 4 4-4 4zM94 50l-8-4-4 4 4 4z"/>
      <path d="M18 82L21.9 73.9 59.9 35.9 64.1 40.1 26.1 78.1z"/>
      <path d="M65.4 39.4L62.6 36.6 73.6 25.6 76.4 28.4z" fill="#5a3a1e"/>
      <path d="M56.4 29.6L53.6 32.4 69.6 48.4 72.4 45.6z"/><path d="M63 34.5l4.5 4.5-4.5 4.5-4.5-4.5z"/>
      <path d="M78.5 19l4.5 4.5-4.5 4.5-4.5-4.5z"/>
      <path d="M27 63a25 25 0 0 1 5-28" fill="none" stroke="url(#${k}g)" stroke-width="2.4" stroke-linecap="round"/><path d="M73 37a25 25 0 0 1-5 28" fill="none" stroke="url(#${k}g)" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M43 30h14v13h13v14H57v13H43V57H30V43h13z"/>
      <path d="M26 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6zM74 68l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" stroke="none"/>
    </g></svg>`;
};
/* Silver "upgrade" emblem: ringed circle with four spikes, an anvil with a glowing cross, a hammer and sparks. */
UI.emblemUp = function (size = 56) {
  const k = 'eu' + (UI._emb++);
  return `<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><defs>
    <linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#c9d2de"/><stop offset=".8" stop-color="#7d8794"/><stop offset="1" stop-color="#4a525c"/></linearGradient>
    <linearGradient id="${k}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c0ca"/><stop offset=".5" stop-color="#6d7580"/><stop offset="1" stop-color="#3a4048"/></linearGradient>
    <radialGradient id="${k}r" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#bfe0ff" stop-opacity=".45"/><stop offset="1" stop-color="#bfe0ff" stop-opacity="0"/></radialGradient>
    <filter id="${k}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <circle cx="50" cy="50" r="46" fill="url(#${k}r)"/>
    <g stroke="#2a2f36" stroke-width=".8">
      <circle cx="50" cy="50" r="36" fill="none" stroke="url(#${k}g)" stroke-width="3"/>
      <path fill="url(#${k}g)" d="M50 6l4 8-4 4-4-4zM50 94l4-8-4-4-4 4zM6 50l8-4 4 4-4 4zM94 50l-8-4-4 4 4 4z"/>
      <g fill="#e8f2ff" stroke="none" opacity=".9"><path d="M27 33l9 6-1 1z"/><path d="M24 48l10 2v1z"/><path d="M28 63l8-5 .6.8z"/><path d="M73 36l-8 6-.6-.8z"/><path d="M76 61l-9-4 .4-.9z"/><path d="M40 24l3 10-1 .3z"/></g>
      <g transform="rotate(-38 60 31)"><rect x="66" y="28.5" width="22" height="5" rx="1.5" fill="#5a3a24"/><path d="M70 28.5v5M74 28.5v5M78 28.5v5M82 28.5v5" stroke="#2e1c10" stroke-width=".9"/><rect x="87" y="27" width="4" height="8" rx="1" fill="url(#${k}g)"/><rect x="49" y="23" width="18" height="16" rx="1.5" fill="url(#${k}a)"/><rect x="49" y="23" width="18" height="4" fill="#d4dae2" stroke="none" opacity=".6"/></g>
      <path fill="url(#${k}a)" d="M13 47L24 44H81L79 53L67 56L61 62L65 68L73 70L75 78H27L29 70L37 68L41 62L35 56L27 54Q19 52 13 47Z"/>
      <path fill="#dfe6ee" stroke="none" opacity=".55" d="M24 44.6H80.5L80 47H24z"/>
      <path filter="url(#${k}f)" fill="#ffffff" stroke="#9fc8ff" stroke-width="1" d="M45.5 47h9v7h7v9h-7v7h-9v-7h-7v-9h7z"/>
    </g></svg>`;
};
UI.CARD_KIND = { attr: 'k-attr', spell: 'k-new', ult: 'k-ult', branch: 'k-up', rank: 'k-up', mod: 'k-mod', passive: 'k-pass', charm: 'k-charm', heal: 'k-heal', fortify: 'k-heal', rankpick: 'k-up' };
UI.offerCard = function (o, owner, i) {
  let tag = '', col = 'var(--brass)', title = '', body = '', foot = '', icon = '';
  if (o.type === 'spell') { const d = H.SPELLS[o.id]; col = '#f5c542'; const es = H.G.freeSlotFor ? H.G.freeSlotFor(owner, o.id) : owner.spells.findIndex((x, k) => k > 0 && !x); tag = es > 0 ? H.t('new spell · slot {s}', { s: ['I', 'II', 'III', 'IV'][es] }) : H.t('new spell · rank {r}', { r: UI.romanRank(o.rank || 1) }); title = d.name; icon = UI.spellIcon(o.id, 34); body = d.desc(H.spellStats(o.id, o.rank || 1, owner)); foot = `<span class="chip">${esc(H.EL[d.el].name)}</span><span class="chip">${esc(H.ROLE_INFO[d.role].name)}</span><span class="chip">${UI.statLine(o.id, o.rank || 1, owner)}</span>`; }
  else if (o.type === 'rank') { const s = owner.spells.find(x => x.id === o.id); const d = H.SPELLS[o.id]; col = elCss(d.el); tag = 'rank up'; title = `${d.name} ${UI.romanRank(s.rank)} → ${UI.romanRank(s.rank + 1)}`; icon = UI.spellIcon(o.id, 34); const a = H.spellStats(o.id, s.rank, owner), b = H.spellStats(o.id, s.rank + 1, owner); body = H.t('Damage {a} → {b}. Cooldown {c}s → {d}s.', { a: a.dmg, b: b.dmg, c: a.cd.toFixed(2), d: b.cd.toFixed(2) }) + (s.rank + 1 === 3 && (d.jumps || d.pierce) ? H.t(d.jumps ? ' Rank III adds an extra jump.' : ' Rank III adds an extra pierce.') : ''); }
  else if (o.type === 'mod') { const m = H.MODS[o.id]; const lv = (owner.mods[o.id] || 0); const pk = owner.spells[0] ? H.SPELLS[owner.spells[0].id] : null; col = '#f4d58a'; tag = H.t('primary upgrade') + (lv ? ' · ' + H.t('level {n}', { n: UI.romanRank(lv + 1) }) : ''); title = m.name; icon = H.glyphSVG('attack', '#f4d58a', 34); body = m.desc(pk ? pk.kind : 'projectile'); if (pk) foot = `<span class="chip">${UI.spellIcon(pk.id, 14)} ${esc(pk.name)}</span>`; }
  else if (o.type === 'branch') { const d = H.SPELLS[o.id] || H.PASSIVES[o.id]; const isP = !H.SPELLS[o.id]; col = elCss(d.el); const lv = ((owner.ups[o.id] || {})[o.stat] || 0); const after = Object.assign({}, owner, { ups: Object.assign({}, owner.ups, { [o.id]: Object.assign({}, owner.ups[o.id] || {}, { [o.stat]: lv + 1 }) }) }); const st = isP ? H.passiveStats : (id, ow) => H.spellStats(id, 1, ow); const a = st(o.id, owner), b = st(o.id, after); const bl = H.BRANCH_LABEL[o.stat]; tag = H.t('upgrade · level {n}/{m}', { n: lv + 1, m: H.BRANCH_MAX }); title = `${d.name}: ${H.t(bl.name)}`; icon = isP ? H.glyphSVG('movement', col, 34) : UI.spellIcon(o.id, 34); body = bl.fmt(a, b); foot = `<span class="chip">${esc(d.hero ? H.t(d.weapon ? 'Weapon' : 'Melee') : H.EL[d.el].name)}</span><span class="chip">${esc(d.name)}</span>`; }
  else if (o.type === 'ult') { const d = H.SPELLS[o.id]; col = '#ffcf6a'; tag = H.t('ultimate · unique'); title = d.name; icon = H.glyphSVG(d.glyph || d.el, '#ffe27a', 40); body = d.desc(H.spellStats(o.id, 1, owner)); foot = `<span class="chip">${esc(H.EL[d.el].name)}</span><span class="chip">${esc(UI.keyFor('ult', owner.src))}</span><span class="chip">${H.t('CD {c}s', { c: d.cd })}</span>`; }
  else if (o.type === 'passive') { const d = H.PASSIVES[o.id]; col = elCss(d.el); tag = H.t('dash passive'); title = d.name; icon = H.glyphSVG('movement', col, 34); body = d.desc(H.passiveStats(o.id, owner)); foot = `<span class="chip">${esc(H.EL[d.el].name)}</span><span class="chip">${esc(UI.keyFor('dash', owner.src))}</span>`; }
  else if (o.type === 'attr') { const A = H.ATTRS[o.id]; const lv = (owner.attrs || {})[o.id] || 0; col = A.col; tag = H.t('attribute · level {n}/{m}', { n: lv + 1, m: A.max }); title = A.name; icon = H.glyphSVG(A.icon, A.col, 34); body = A.desc(lv); foot = `<span class="chip">${esc(H.t('Veteran'))}</span>`; }
  else if (o.type === 'charm') { const c = H.CHARMS[o.id]; col = elCss(c.el); tag = 'charm'; title = c.name; icon = H.glyphSVG(c.el, col, 34); body = c.desc; }
  else if (o.type === 'heal') { col = 'var(--good)'; tag = 'mend'; title = H.t(o.label || 'Mend wounds'); icon = H.glyphSVG('rest', '#8fe39a', 34); body = H.t('Restore {n} HP. You have {h} of {m}.', { n: o.amt, h: Math.round(owner.hp), m: owner.maxHp }); }
  else if (o.type === 'fortify') { col = '#dca16a'; tag = 'fortify'; title = H.t(o.label || 'Fortify'); icon = H.glyphSVG('defense', '#dca16a', 34); body = H.t('+{n} max HP for the rest of the run.', { n: o.amt }); }
  else if (o.type === 'rankpick') { col = '#c39bff'; tag = 'attune'; title = o.label || 'Attune'; icon = H.glyphSVG('shrine', '#c39bff', 34); body = 'Raise one spell of your choice by a rank.'; }
  else if (o.type === 'accept') { col = '#ff5c7c'; tag = 'risk'; title = o.label; icon = H.glyphSVG('challenge', '#ff5c7c', 34); body = 'The doors seal until the trial ends.'; }
  else if (o.type === 'decline') { col = 'var(--ash)'; tag = 'safe'; title = o.label; icon = H.glyphSVG('movement', '#aaa1b6', 34); body = 'Leave the altar untouched.'; }
  if (o.type === 'spell') icon = `<span class="emb-wrap">${UI.emblemNew(70)}<span class="emb-badge">${UI.spellIcon(o.id, 20)}</span></span>`;
  if (['branch', 'rank', 'rankpick', 'mod'].includes(o.type)) { const sub = o.type === 'mod' ? (owner.spells[0] ? UI.spellIcon(owner.spells[0].id, 20) : '') : o.type === 'rankpick' ? H.glyphSVG('shrine', '#c39bff', 18) : (H.SPELLS[o.id] ? UI.spellIcon(o.id, 20) : H.glyphSVG('movement', '#ff7a3d', 18)); icon = `<span class="emb-wrap up">${UI.emblemUp(70)}<span class="emb-badge">${sub}</span></span>`; }
  const kind = UI.CARD_KIND[o.type] || '';
  if (kind && o.type !== 'spell') col = { 'k-ult': '#ffd24a', 'k-up': '#5fb0ff', 'k-mod': '#b98cff', 'k-pass': '#6fdc8c', 'k-charm': '#ff8ad0', 'k-heal': '#ff6b6b', 'k-attr': '#ffb547' }[kind];
  const html = `<div class="card plate ${kind}${o.type === 'ult' ? ' ultcard' : ''}" data-nav data-i="${i}" style="border-color:${col};--kc:${col}"><span class="num-key kbd">${i + 1}</span><div class="row">${icon}<div class="tag" style="color:${col}">${esc(tag)}</div></div><h3>${esc(H.t(title))}</h3><p>${esc(body)}</p><div class="foot">${foot}</div></div>`;
  return o.type === 'ult' ? `<div class="ultwrap">${html}</div>` : html;
};
UI.ownerTag = (owner, multi) => multi ? `<span class="owner" style="color:${owner.accentCss}">${esc(H.t('{name} chooses', { name: H.t(owner.name) }))}</span>` : '';
UI.showChoice = function (spec, cb) {
  if (H.botMode) { const sp = spec.owner && spec.owner.spells && spec.owner.spells.some(x => !x) ? spec.offers.find(o => o.type === 'spell') : null; const pick = sp || spec.offers[Math.floor(Math.random() * spec.offers.length)]; setTimeout(() => cb(pick), 0); return; }
  sfx('reward');
  const s = UI.open('scr-choice', `<div class="modal plate scroll"><div class="row">${UI.ownerTag(spec.owner, spec.multi)}</div><h2>${esc(H.t(spec.title))}</h2><div class="sub">${esc(H.t(spec.sub || ''))}</div>
    <div class="cards">${spec.offers.map((o, i) => UI.offerCard(o, spec.owner, i)).join('')}</div>
    ${spec.noSkip ? '' : '<div class="row"><button class="btn ghost" id="ch-skip">Take nothing</button></div>'}</div>`, { cls: 'dim', x: !spec.noSkip, back: () => { if (!spec.noSkip) done(null); }, onKey: k => { const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[k]; if (n != null && spec.offers[n]) done(spec.offers[n]); } });
  let closed = false;
  const done = o => { if (closed) return; closed = true; UI.close('scr-choice'); cb(o); };
  $$('.card', s).forEach(c => c.onclick = () => done(spec.offers[+c.dataset.i]));
  const sk = $('#ch-skip', s); if (sk) sk.onclick = () => done(null);
  requestAnimationFrame(() => { const f = $('.card', s); if (f && H.input.lastDevice !== 'touch') UI.setFocus(f, false); });
};
UI.showSwap = function (spec, cb) {
  if (H.botMode) { setTimeout(() => cb(1 + Math.floor(Math.random() * 3)), 0); return; }
  const p = spec.owner; const nd = H.SPELLS[spec.id]; const ns = H.spellStats(spec.id, spec.rank, p);
  const cmp = (a, b, lowGood) => a === b ? '' : ((lowGood ? b < a : b > a) ? 'up' : 'dn');
  const s = UI.open('scr-swap', `<div class="modal plate scroll"><div class="row">${UI.ownerTag(p, H.G.players.length > 1)}</div><div class="eyebrow">new spell · replace one slot</div>
    <div class="row">${UI.spellIcon(spec.id, 44)}<div class="grow"><h2>${esc(nd.name)} <span class="display" style="color:var(--brass-hi);font-size:.7em">${UI.romanRank(spec.rank)}</span></h2><div class="sub">${esc(nd.desc(ns))}</div></div></div>
    <div class="tiny muted">The replaced spell is lost. The new spell keeps the higher of its own rank or the old rank minus one. Your primary attack stays.</div>
    <div class="swap-row">${p.spells.map((sp, i) => { if (i === 0 || !sp) return ''; const d = H.SPELLS[sp.id]; const os = H.spellStats(sp.id, sp.rank, p); const r = Math.max(spec.rank, sp.rank - 1); const ns2 = H.spellStats(spec.id, r, p); return `<div class="card plate" data-nav data-i="${i}" style="min-height:0"><div class="row"><span class="kbd">${esc(UI.keyFor('cast' + (i + 1), p.src))}</span>${UI.spellIcon(sp.id, 22)}<b>${esc(d.name)} ${UI.romanRank(sp.rank)}</b></div><div class="cmp">${H.t('Cooldown {a}s → ', { a: os.cd.toFixed(2) })}<span class="${cmp(os.cd, ns2.cd, true)}">${ns2.cd.toFixed(2)}s</span><br>${H.t('Mana {a} → ', { a: os.cost })}<span class="${cmp(os.cost, ns2.cost, true)}">${ns2.cost}</span><br>${H.t('Damage {a} → ', { a: d.dmg ? os.dmg : '—' })}<span class="${cmp(os.dmg, ns2.dmg)}">${nd.dmg ? ns2.dmg : '—'}</span><br>${esc(H.t('Role {a} → {b}', { a: H.ROLE_INFO[d.role].name, b: H.ROLE_INFO[nd.role].name }))}<br>${H.t('Becomes rank {r}', { r: UI.romanRank(r) })}</div><div class="tag" style="color:#ff8a9a">replace</div></div>`; }).join('')}</div>
    <div class="row"><button class="btn" id="sw-keep">Keep my four</button></div></div>`, { cls: 'dim', back: () => done(null), onKey: k => { const n = { Digit2: 1, Digit3: 2, Digit4: 3 }[k]; if (n != null) done(n); } });
  let closed = false;
  const done = i => { if (closed) return; closed = true; UI.close('scr-swap'); cb(i); };
  $$('.card', s).forEach(c => c.onclick = () => done(+c.dataset.i));
  $('#sw-keep', s).onclick = () => done(null);
};
UI.showSlotPick = function (spec, cb) {
  if (H.botMode) { const c = spec.owner.spells.map((s, i) => i).filter(i => spec.owner.spells[i] && (!spec.filter || spec.filter(spec.owner.spells[i]))); setTimeout(() => cb(c.length ? c[0] : null), 0); return; }
  const p = spec.owner;
  const s = UI.open('scr-slot', `<div class="modal plate"><h2>${esc(H.t(spec.title))}</h2><div class="sub">${esc(H.t(spec.sub || ''))}</div><div class="swap-row">${p.spells.map((sp, i) => { if (!sp) return `<div class="card plate" style="min-height:0;opacity:.35"><div class="muted">${H.t('Empty slot')}</div></div>`; const ok = !spec.filter || spec.filter(sp); return `<div class="card plate" data-nav data-i="${i}" style="min-height:0;${ok ? '' : 'opacity:.4'}"><div class="row">${UI.spellIcon(sp.id, 26)}<b>${esc(H.SPELLS[sp.id].name)}</b></div><div class="tiny muted">${H.t('Rank {r}', { r: UI.romanRank(sp.rank) })}${sp.rank >= H.MAX_RANK ? H.t(' · max') : ''}</div></div>`; }).join('')}</div><div class="row"><button class="btn ghost" id="sl-cancel">Cancel</button></div></div>`, { cls: 'dim', back: () => done(null) });
  let closed = false; const done = i => { if (closed) return; closed = true; UI.close('scr-slot'); cb(i); };
  $$('.card[data-i]', s).forEach(c => c.onclick = () => { const i = +c.dataset.i; if (spec.filter && !spec.filter(p.spells[i])) { sfx('ui_deny'); return; } done(i); });
  $('#sl-cancel', s).onclick = () => done(null);
};
UI.showEvent = function (ev, cb) {
  if (H.botMode) { const o = ev.options[Math.floor(Math.random() * ev.options.length)]; setTimeout(() => cb(o), 0); return; }
  sfx('cast_void');
  const s = UI.open('scr-event', `<div class="modal plate" style="width:min(680px,100%)"><div class="eyebrow">something waits</div><h2>${esc(H.t(ev.title))}</h2><div class="sub" style="font-size:calc(17px * var(--ts));color:var(--bone)">${esc(H.t(ev.text))}</div>
    <div class="col">${ev.options.map((o, i) => `<button class="btn ev-opt" data-i="${i}" ${i === 0 ? 'data-autofocus' : ''}><b>${esc(H.t(o.label))}</b><span>${esc(H.t(o.hint || ''))}</span></button>`).join('')}</div></div>`, { cls: 'dim', back: () => done(null) });
  let closed = false; const done = o => { if (closed) return; closed = true; UI.close('scr-event'); cb(o); };
  $$('.ev-opt', s).forEach(b => b.onclick = () => done(ev.options[+b.dataset.i]));
};


/* ---------------- Level-up cinematic ---------------- */
UI.showLevelUp = function (level, done) {
  const bn = $('#banner'); bn.className = ''; $('#toast').innerHTML = '';
  const quick = H.settings.reduceFlash || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = quick ? 0.45 : 1;
  const shards = Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * Math.PI * 2 + Math.random() * 0.2; const d = 180 + Math.random() * 260; return `<i style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d * 0.7).toFixed(0)}px;--rot:${(Math.random() * 720 - 360).toFixed(0)}deg;--w:${(6 + Math.random() * 22).toFixed(0)}px;--delay:${(Math.random() * 60).toFixed(0)}ms"></i>`; }).join('');
  const s = UI.open('scr-lvl', `<div class="lv-wrap">
      <div class="lv-rays"></div>
      <div class="lv-bar"><div class="lv-fill"></div><div class="lv-glint"></div><div class="lv-cap l"></div><div class="lv-cap r"></div><span class="lv-num">${H.t('Lv {n}', { n: level - 1 })} → ${H.t('Lv {n}', { n: level })}</span></div>
      <div class="lv-shards">${shards}</div>
      <div class="lv-ring"></div><div class="lv-ring two"></div>
      <div class="lv-title">${H.t('LEVEL UP!')}</div>
      <div class="lv-sub">${H.t('Level {n}', { n: level })}</div>
      <div class="lv-skip">${H.t('Press any key to continue')}</div>
    </div><div class="lv-flash"></div>`, { cls: 'lvlup' + (quick ? ' quick' : ''), back: () => skip() });
  s.style.setProperty('--fill', (1000 * T) + 'ms');
  let stage = 0; const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms * T));
  const burst = () => { if (stage >= 1) return; stage = 1; s.classList.add('burst'); H.audio.play('lvl_burst'); H.R.shake(quick ? 0.15 : 0.55); };
  const title = () => { if (stage >= 2) return; burst(); stage = 2; s.classList.add('title'); };
  let finished = false;
  const finish = () => { if (finished) return; finished = true; timers.forEach(clearTimeout); s.classList.add('out'); setTimeout(() => { UI.close('scr-lvl'); done && done(); }, 220); };
  const skip = () => { if (stage < 2) { timers.forEach(clearTimeout); title(); timers.length = 0; at(500, finish); } else finish(); };
  UI._lvl = { burst, title, finish, skip, timers };
  H.audio.play('lvl_charge');
  requestAnimationFrame(() => s.classList.add('go'));
  at(1000, burst); at(1150, title); at(2600, finish);
  const t0 = performance.now();
  UI.top().onUpdate = () => {
    const I = H.input; if (performance.now() - t0 < 350) return;
    const any = I.keysPressed.size > 0 || I.mouse.pressed.size > 0 || I.pads.some(gp => I.padPressed[gp.index] && I.padPressed[gp.index].some(Boolean));
    if (any) skip();
  };
  s.addEventListener('pointerdown', () => { if (performance.now() - t0 > 350) skip(); });
};
/* ---------------- HUD ---------------- */
UI.buildHud = function () {
  const G = H.G; const hud = $('#hud'); hud.hidden = false;
  const touch = G.players.some(p => p.seatSrc === 'touch' || p.src === 'touch') || (H.input.lastDevice === 'touch');
  hud.className = touch ? 'touchmode' : '';
  const solo = G.players.length === 1;
  hud.innerHTML = `<div class="hud-top"><div class="where"><div class="d" id="hd-d"></div><div class="o" id="hd-o"></div></div><div class="grow"></div><div class="score" id="hd-score"></div><div class="hemb" id="hd-emb" title="${H.t('Gold coins')}"></div><div class="hud-tr">${touch && H.fs.supported() ? `<button class="icon-btn" id="hd-fs" title="${H.t('Fullscreen')}" data-silent="1">${UI.fsIcon()}</button>` : ''}<button class="icon-btn" id="hd-inv" title="${H.t('Inventory')}" data-silent="1">${H.glyphSVG('eq_bag', '#ece4d2', 22)}</button><button class="icon-btn" id="hd-map" title="Map" data-silent="1">${H.glyphSVG('mystery', '#ece4d2', 22)}</button><button class="icon-btn" id="hd-pause" title="Pause" data-silent="1"><svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="2" width="4" height="14" fill="#ece4d2"/><rect x="11" y="2" width="4" height="14" fill="#ece4d2"/></svg></button></div></div>
    <div class="objective" id="hd-obj"></div>
    <div class="bossbar" id="hd-boss" hidden><div class="nm" id="hb-n"></div><div class="ti" id="hb-t"></div><div class="bar"><i class="ghost" id="hb-g"></i><i class="fill" id="hb-f"></i></div><div class="bar stg"><i class="fill" id="hb-s"></i></div><div class="phase" id="hb-p"></div></div>
    <div class="tutbox plate" id="hd-tut" hidden></div>
    ${G.players.map((p, i) => `<div class="cluster ${solo ? 'solo' : 'p' + (i + 1)}" id="cl-${i}">
      <div class="vitals"><div class="nm" style="color:${p.accentCss}">${esc(p.name)}</div><div class="bar hp"><i class="ghost"></i><i class="fill"></i><i class="lost"></i><span class="tx"></span></div><div class="bar mp ${p.useStam ? 'stam' : ''}" title="${p.useStam ? esc(H.t('Stamina')) : esc(H.t('Mana'))}"><i class="fill"></i><span class="tx"></span></div>${G.run.mode !== 'tutorial' ? '<div class="bar xp"><i class="fill"></i><span class="tx"></span></div>' : ''}<div class="row" style="gap:8px"><div class="dashes"></div><div class="charms-row"></div></div><div class="pst st"></div></div>
      <div class="sbar">${[0, 1, 2, 3, 4].map(k => `<div class="sslot${k === 4 ? ' ult' : ''}" data-k="${k}"${k === 4 ? ' hidden data-lbl="' + H.t('ULT') + '"' : ''}><span class="ic"></span><span class="cdw"></span><span class="cdn"></span><span class="key"></span><span class="cost"></span><span class="rank"></span></div>`).join('')}</div></div>`).join('')}`;
  $('#hd-pause').onclick = () => UI.showPause();
  $('#hd-map').onclick = () => UI.toggleMap();
  $('#hd-inv').onclick = () => UI.toggleInventory();
  const hfs = $('#hd-fs'); if (hfs) hfs.onclick = () => H.fs.toggle();
  if (touch) { const st = document.createElement('style'); st.id = 'touchhud'; }
  UI.hudCache = {};
  UI.wui = { ft: [], bars: new Map(), arrows: [], prompt: null, revive: new Map() };
  $('#world-ui').innerHTML = '';
  UI.buildTouch();
};
UI.toggleMap = function () {
  const G = H.G; if (!G.active) return;
  if (UI.layers.some(l => l.id === 'scr-map')) { UI.close('scr-map'); if (!UI.layers.some(l => l.id === 'scr-pause')) G.paused = false; return; }
  if (G.modal || G.paused) return;
  if (!G.run.map) { UI.toast(H.t(G.run.mode === 'arena' ? 'The Pit has no map. Only the next wave.' : 'No map in the primer')); return; }
  UI.showMap();
  // closing via map key resumes
  const l = UI.top(); const origBack = l.back; l.back = () => { UI.close('scr-map'); G.paused = false; };
  $('#mp-close', l.el).onclick = () => l.back();
  l.onKey = k => { if ((H.save.bindings.kb.map || []).includes(k)) l.back(); };
  l.onUpdate = () => { for (const gp of H.input.pads) if (H.input.padButtonPressed(gp, H.save.bindings.pad.map)) l.back(); };
};
const setW = (el, k) => { const v = 'scaleX(' + H.clamp(k, 0, 1).toFixed(3) + ')'; if (el._v !== v) { el.style.transform = v; el._v = v; } };
const setT = (el, t) => { if (el._t !== t) { el.textContent = t; el._t = t; } };
UI.updateHud = function (dt) {
  const G = H.G; if (!G.run || $('#hud').hidden) return;
  const run = G.run, room = G.room; if (!room) return;
  // where
  let d = '', o = '';
  if (run.mode === 'arena') { d = H.t(run.arenaRule === 'siege' ? 'The Pit · Siege' : 'The Pit · Vigil'); o = run.arenaRule === 'siege' ? H.t('Wave {w}', { w: run.wave }) : H.t('Endured {t}', { t: H.fmtTime(run.arenaT) }); }
  else if (run.mode === 'tutorial') { d = H.t('The Primer'); o = H.t('Learn the forms'); }
  else { d = H.t('Depth {d} · {n}', { d: H.roman(run.depth), n: H.DEPTHS[run.depth].name }); o = H.t('Chamber {c} of {n} · {t}', { c: room.layer + 1, n: H.DEPTHS[run.depth].layers, t: H.NODES[run.node.type] ? H.NODES[run.node.type].name : '' }); }
  setT($('#hd-d'), d); setT($('#hd-o'), o);
  const sc = $('#hd-score');
  const scHtml = run.mode === 'tutorial' ? '' : `<span class="num">${run.score}</span>${run.mode === 'arena' && run.combo > 1 ? `<span class="combo">${H.t('combo ×{m}', { m: (1 + Math.min(run.combo, 20) * 0.1).toFixed(1) })}</span>` : ''}`;
  if (sc._h !== scHtml) { sc.innerHTML = scHtml; sc._h = scHtml; }
  { const eh = run.mode === 'tutorial' ? '' : `<span class="ember-dot"></span><span class="num">${G.wallet()}</span>`; const ee = $('#hd-emb'); if (ee && ee._h !== eh) { ee.innerHTML = eh; ee._h = eh; } }
  // objective
  let obj = '';
  const alive = G.enemies.filter(e => !e.dead && e.type !== 'dummy' && e.type !== 'turret').length;
  if (G.tut) obj = '';
  else if (run.mode === 'arena') obj = run.arenaRule === 'siege' ? (alive ? H.t('<b>{n}</b> foes remain', { n: alive }) : H.t('Next wave approaches…')) : H.t('Survive. <b>{n}</b> foes in the pit', { n: alive });
  else if (room.isBoss && !room.cleared) obj = '';
  else if (room.prop && room.prop.kind === 'descent') obj = room.prop.ready ? (run.depth >= 3 ? H.t('Step onto the golden sigil to leave the undercroft') : H.t('Step onto the golden sigil to descend to Depth {d}', { d: H.roman(run.depth + 1) })) : '';
  else if (room.waves.length && !room.cleared) { const c = room.challenge; obj = H.t('Clear the chamber · wave <b>{w}</b> of {n} · <b>{a}</b> foes', { w: Math.max(1, room.waveIdx + 1), n: room.waves.length, a: alive }); if (c && c.id === 'haste') obj = H.t('<b>{c}</b> · {s}s left · ', { c: H.t(c.name), s: Math.ceil(c.t) }) + obj; if (c && c.id === 'grace') obj = H.t('<b>{c}</b> · hits {h} of 3 · ', { c: H.t(c.name), h: run.hitsTaken - c.hits0 }) + obj; if (c && c.id === 'blood') obj = `<b>${H.t(c.name)}</b> · ` + obj; }
  else if (room.prop && !room.prop.used) obj = H.t({ merchant: 'Trade with the Merchant, or move on', hearth: 'Rest at the Hearth, or move on', shrine: 'Temper a spell at the Forge Shrine', chest: 'Open the Reliquary', eye: 'Approach the watching Eye', altar: 'The altar offers a Trial. Accept it, or walk past' }[room.prop.kind]) + ` · <span class="kbd">${esc(UI.keyFor('interact', G.players[0].src))}</span>`;
  else if (room.doors.some(dd => dd.open)) obj = `${H.t('Choose a door: ')}${room.doors.map(dd => `<b style="color:${H.NODES[dd.type].css}">${esc(H.NODES[dd.type].name)}</b>`).join(' · ')} <span class="muted">${esc(H.t('(map: {k})', { k: UI.keyFor('map', G.players[0].src) }))}</span>`;
  const oe = $('#hd-obj'); if (oe._h !== obj) { oe.innerHTML = obj; oe._h = obj; }
  // boss
  const be = $('#hd-boss'); const b = G.boss;
  if (b && !b.dead) {
    if (be.hidden || be._uid !== b.uid) { be.hidden = false; be._uid = b.uid; setT($('#hb-n'), b.def.name); setT($('#hb-t'), b.def.title || ''); }
    setW($('#hb-f'), b.hp / b.maxHp); setW($('#hb-g'), b.hp / b.maxHp); setW($('#hb-s'), b.staggered ? b.staggerT / 3 : b.stagger / b.staggerMax);
    const nph = H.AI && b.type === 'gaolwright' ? 2 : 3; const ph = `${Array.from({ length: nph }, (_, i) => `<b class="${i < b.phase ? 'on' : ''}"></b>`).join('')}`; const pe = $('#hb-p'); if (pe._h !== ph) { pe.innerHTML = ph; pe._h = ph; }
  } else if (!be.hidden) be.hidden = true;
  // players
  G.players.forEach((p, i) => {
    const cl = $('#cl-' + i); if (!cl) return;
    const hpk = p.hp / p.maxHp;
    const fills = cl.querySelectorAll('.bar.hp i'); setW(fills[1], hpk); setW(fills[0], hpk);
    setT(cl.querySelector('.bar.hp .tx'), p.downed ? H.t('DOWNED') : `${Math.ceil(p.hp)} / ${p.maxHp}`);
    { const lo = cl.querySelector('.bar.hp .lost'); if (lo) setW(lo, 1 - G.lifeCap(p)); const pe = cl.querySelector('.pst'); if (pe) { const ks = Object.keys(p.statuses || {}).filter(k => H.STATUS[k]); const key = ks.map(k => k + p.statuses[k].n).join(','); if (pe._k !== key) { pe._k = key; pe.innerHTML = ks.map(k => UI.stChip(k, p.statuses[k].n, true)).join(''); } } }
    const xb = cl.querySelector('.bar.xp'); if (xb) { setW(xb.querySelector('.fill'), run.xp / run.xpNext); setT(xb.querySelector('.tx'), H.t('Lv {n} · {x}/{m} XP', { n: run.level, x: Math.floor(run.xp), m: run.xpNext })); }
    if (p.useStam) { const mb = cl.querySelector('.bar.mp'); setW(mb.querySelector('.fill'), p.stam / p.maxStam); setT(mb.querySelector('.tx'), `${H.t('Stamina')} ${Math.floor(p.stam)}`); p.stamFlash = Math.max(0, (p.stamFlash || 0) - dt); const fl = p.stamFlash > 0, rg = p.stamT <= 0 && p.stam < p.maxStam; if (mb._f !== fl) { mb._f = fl; mb.classList.toggle('flash', fl); } if (mb._r !== rg) { mb._r = rg; mb.classList.toggle('regen', rg); } }
    else { setW(cl.querySelector('.bar.mp .fill'), p.mana / p.maxMana); setT(cl.querySelector('.bar.mp .tx'), `${Math.floor(p.mana)}`); }
    const dh = Array.from({ length: p.dashMax }, (_, k) => `<b class="${k < p.dashCharges ? 'on' : ''}"></b>`).join(''); const de = cl.querySelector('.dashes'); if (de._h !== dh) { de.innerHTML = dh; de._h = dh; }
    const chh = Object.entries(p.mods || {}).map(([k, v]) => `<span title="${esc(H.MODS[k].name + (v > 1 ? ' ×' + v : '') + ': ' + H.MODS[k].desc(p.spells[0] ? H.SPELLS[p.spells[0].id].kind : 'projectile'))}" style="color:#f4d58a;font-size:10px;font-weight:800">${H.glyphSVG('attack', '#f4d58a', 11)}</span>`).join('') + [...p.charms].map(c => `<span title="${esc(H.CHARMS[c].name + ': ' + H.CHARMS[c].desc)}">${H.glyphSVG(H.CHARMS[c].el, elCss(H.CHARMS[c].el), 12)}</span>`).join('') + Object.keys(p.passives || {}).map(k => `<span title="${esc(H.PASSIVES[k].name)}">${H.glyphSVG('movement', elCss(H.PASSIVES[k].el), 12)}</span>`).join(''); const ce = cl.querySelector('.charms-row'); if (ce._h !== chh) { ce.innerHTML = chh; ce._h = chh; }
    cl.querySelectorAll('.sslot').forEach((sl, k) => {
      const sp = k === 4 ? p.ult : p.spells[k]; const act = k === 4 ? 'ult' : 'cast' + (k + 1);
      if (k === 4) { if (sl.hidden !== !sp) sl.hidden = !sp; if (!sp) return; }
      if (!sp) { if (sl._id !== 'empty') { sl._id = 'empty'; sl.classList.add('empty'); sl.classList.remove('ready', 'nomana'); sl.querySelector('.ic').innerHTML = '<span class="plus">+</span>'; ['.rank', '.cost', '.cdn'].forEach(q => setT(sl.querySelector(q), '')); sl.style.setProperty('--cd', '0%'); sl._cd = '0%'; sl.title = H.t('Empty slot: clear chambers to earn spells'); } setT(sl.querySelector('.key'), UI.keyFor(act, p.src)); sl._ready = undefined; return; }
      sl.classList.remove('empty');
      const def = H.SPELLS[sp.id]; const st = H.spellStats(sp.id, sp.rank, p);
      if (sl._id !== sp.id + sp.rank) { sl._id = sp.id + sp.rank; sl.querySelector('.ic').innerHTML = UI.spellIcon(sp.id, 30); sl.style.setProperty('--elc', elCss(def.el)); setT(sl.querySelector('.rank'), UI.romanRank(sp.rank)); sl.title = def.name; sl._ch = null; }
      if (def.charges) { const ch = '×' + (sp.charges || 0); if (sl._ch !== ch) { sl._ch = ch; setT(sl.querySelector('.rank'), ch); } }
      setT(sl.querySelector('.key'), UI.keyFor(act, p.src));
      const sc = H.G.stamCost(p, H.SPELLS[sp.id]); setT(sl.querySelector('.cost'), st.cost ? String(st.cost) : sc ? String(sc) : ''); if (sl._stc !== !!sc) { sl._stc = !!sc; sl.querySelector('.cost').classList.toggle('stc', !!sc); }
      const frac = sp.cd > 0 && sp.maxCd ? sp.cd / sp.maxCd : 0;
      const cdv = (frac * 100).toFixed(1) + '%'; if (sl._cd !== cdv) { sl.style.setProperty('--cd', cdv); sl._cd = cdv; }
      setT(sl.querySelector('.cdn'), sp.cd > 0.05 ? (sp.cd < 1 ? sp.cd.toFixed(1) : Math.ceil(sp.cd)) : '');
      const nm = p.mana < st.cost || sc > p.stam; if (sl._nm !== nm) { sl.classList.toggle('nomana', nm); sl._nm = nm; }
      const ready = sp.cd <= 0 && !nm; if (ready && sl._ready === false) { sl.classList.remove('flash'); void sl.offsetWidth; sl.classList.add('flash'); } sl._ready = ready; sl.classList.toggle('ready', ready);
    });
  });
  // low hp vignette
  const lowest = Math.min(...G.players.filter(p => !p.dead).map(p => p.hp / p.maxHp), 1);
  $('#lowhp').style.opacity = lowest < 0.3 ? (0.5 + Math.sin(performance.now() / 180) * 0.25 * (H.settings.reduceFlash ? 0.3 : 1)).toFixed(2) : '0';
  UI.updateWorld(dt);
  UI.updateTouch();
};

/* ---------------- World-space UI ---------------- */
UI.floatText = function (x, y, z, text, cls) {
  if (!UI.wui) return;
  if (!H.settings.dmgNumbers && /^\d+$/.test(text)) return;
  const pool = UI.wui.ft; let f = pool.find(q => !q.on);
  if (!f) { if (pool.length > 70) { f = pool.reduce((a, b) => a.t > b.t ? a : b); } else { const el = document.createElement('div'); el.className = 'ft'; $('#world-ui').appendChild(el); f = { el }; pool.push(f); } }
  f.on = true; f.x = x; f.y = y; f.z = z; f.t = 0; f.dur = /big|react|interrupt/.test(cls || '') ? 1.3 : 0.75; f.vx = (Math.random() - .5) * 0.6;
  f.el.className = 'ft ' + (cls || ''); f.el.textContent = text; f.el.style.display = '';
};
UI.updateWorld = function (dt) {
  const W = UI.wui; if (!W) return; const G = H.G; const R = H.R;
  for (const f of W.ft) {
    if (!f.on) continue; f.t += dt; if (f.t >= f.dur) { f.on = false; f.el.style.display = 'none'; continue; }
    const k = f.t / f.dur; const sp = R.toScreen(f.x + f.vx * k, f.y + k * 1.2, f.z);
    const sc = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
    f.el.style.transform = `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px) translate(-50%,-50%) scale(${sc.toFixed(2)})`; f.el.style.opacity = k > 0.7 ? ((1 - k) / 0.3).toFixed(2) : '1';
  }
  // enemy bars
  const seen = new Set();
  for (const e of G.enemies) {
    if (e.dead || e.boss || e.spawnK < 1) continue;
    const ch = e.ai && e.ai.state === 'windup' && e.ai.atk && e.ai.atk.channel;
    const st = Object.keys(e.statuses);
    const show = e.hp < e.maxHp || e.elite || ch || st.length || e.frozenT > 0;
    if (!show) continue;
    seen.add(e.uid);
    let b = W.bars.get(e.uid);
    if (!b) { const el = document.createElement('div'); el.className = 'eb' + (e.elite ? ' elite' : ''); el.innerHTML = `${e.elite ? `<div class="en">${esc(H.t('{a} {n}', { a: H.ELITE_AFFIXES[e.elite].name, n: e.def.name }))}</div>` : ''}<div class="hp"><i></i></div><div class="st"></div><div class="chw" hidden><div class="chl">interrupt</div><div class="ch"><i></i></div></div>`; $('#world-ui').appendChild(el); b = { el, hp: el.querySelector('.hp i'), st: el.querySelector('.st'), chw: el.querySelector('.chw'), ch: el.querySelector('.ch i') }; W.bars.set(e.uid, b); }
    const h = e.type === 'brute' ? 3.4 : e.type === 'shieldbearer' ? 2.6 : 2.4;
    const sp = R.toScreen(e.x, h * (e.elite ? 1.3 : 1), e.z);
    b.el.style.display = sp.vis ? '' : 'none';
    b.el.style.transform = `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px) translate(-50%,-100%)`;
    setW(b.hp, e.hp / e.maxHp);
    const key = (e.frozenT > 0 ? 'frozen,' : '') + st.map(k => k + e.statuses[k].n).join(',');
    if (b.st._k !== key) { b.st._k = key; b.st.innerHTML = (e.frozenT > 0 ? `<span style="background:#3aa8d8">${H.glyphSVG('frost', '#fff', 11)}</span>` : '') + (H.settings.statusGlyphs ? st.map(k => UI.stChip(k, e.statuses[k].n)).join('') : st.map(k => `<span style="background:${H.statusCss(k)}"></span>`).join('')); }
    if (ch) { b.chw.hidden = false; setW(b.ch, e.windupK); } else if (!b.chw.hidden) b.chw.hidden = true;
  }
  // boss channel bar
  if (G.boss && !G.boss.dead) {
    const e = G.boss; const ch = e.ai && e.ai.state === 'windup' && e.ai.atk && e.ai.atk.channel;
    let b = W.bars.get('boss');
    if (!b) { const el = document.createElement('div'); el.className = 'eb'; el.style.width = '140px'; el.innerHTML = `<div class="st"></div><div class="chw" hidden><div class="chl">interrupt</div><div class="ch" style="width:140px"><i></i></div></div>`; $('#world-ui').appendChild(el); b = { el, st: el.querySelector('.st'), chw: el.querySelector('.chw'), ch: el.querySelector('.ch i') }; W.bars.set('boss', b); }
    seen.add('boss');
    const sp = R.toScreen(e.x, 6.2, e.z); b.el.style.transform = `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px) translate(-50%,-100%)`; b.el.style.display = sp.vis ? '' : 'none';
    const st = Object.keys(e.statuses); const key = st.map(k => k + e.statuses[k].n).join(',');
    if (b.st._k !== key) { b.st._k = key; b.st.innerHTML = st.map(k => UI.stChip(k, e.statuses[k].n)).join(''); }
    if (ch) { b.chw.hidden = false; setW(b.ch, e.windupK); } else if (!b.chw.hidden) b.chw.hidden = true;
  }
  for (const [k, b] of W.bars) if (!seen.has(k)) { b.el.remove(); W.bars.delete(k); }
  // off-screen threat arrows
  let ai = 0;
  for (const e of G.enemies) {
    if (e.dead || e.spawnK < 1 || e.type === 'dummy') continue;
    const sp = R.toScreen(e.x, 1, e.z); if (sp.vis && sp.x > 10 && sp.x < R.vw - 10 && sp.y > 10 && sp.y < R.vh - 10) continue;
    if (ai >= 10) break;
    let a = W.arrows[ai]; if (!a) { a = document.createElement('div'); a.className = 'offarrow'; $('#world-ui').appendChild(a); W.arrows.push(a); }
    const cx = R.vw / 2, cy = R.vh / 2; let dx = sp.x - cx, dy = sp.y - cy; const ang = Math.atan2(dy, dx);
    const mx = R.vw / 2 - 26, my = R.vh / 2 - 26; const t = Math.min(mx / Math.abs(Math.cos(ang) || 1e-6), my / Math.abs(Math.sin(ang) || 1e-6));
    a.style.display = ''; a.style.transform = `translate(${(cx + Math.cos(ang) * t - 9).toFixed(0)}px, ${(cy + Math.sin(ang) * t - 8).toFixed(0)}px) rotate(${(ang + Math.PI / 2).toFixed(2)}rad)`;
    a.classList.toggle('hot', e.ai && e.ai.state === 'windup');
    ai++;
  }
  for (let k = ai; k < W.arrows.length; k++) W.arrows[k].style.display = 'none';
  // interact prompt
  const near = G.players.find(p => p.nearProp && !p.nearProp.used && !G.modal);
  if (near) {
    const pr = near.nearProp;
    if (!W.prompt) { W.prompt = document.createElement('div'); W.prompt.className = 'prompt'; $('#world-ui').appendChild(W.prompt); W.prompt.addEventListener('pointerdown', e => { e.stopPropagation(); const b = H.input.touch.btn.interact || (H.input.touch.btn.interact = {}); b.pressed = true; }); }
    const verb = (H.lang === 'es' ? { merchant: 'Hablar con el Mercader', hearth: 'Descansar en el Hogar', shrine: 'Usar el Santuario de Forja', chest: 'Abrir el Relicario', eye: 'Enfrentar al Ojo', altar: 'Leer la Prueba' } : { merchant: 'Talk to the Merchant', hearth: 'Rest at the Hearth', shrine: 'Use the Forge Shrine', chest: 'Open the Reliquary', eye: 'Meet the Eye', altar: 'Read the Trial' })[pr.kind];
    const html = `<span class="kbd">${esc(UI.keyFor('interact', near.src))}</span> ${esc(verb)}`; if (W.prompt._h !== html) { W.prompt.innerHTML = html; W.prompt._h = html; }
    const sp = R.toScreen(pr.x, 3.2, pr.z); W.prompt.style.left = sp.x + 'px'; W.prompt.style.top = sp.y + 'px'; W.prompt.style.display = '';
  } else if (W.prompt) W.prompt.style.display = 'none';
  // revive bars
  for (const p of G.players) {
    let rb = W.revive.get(p.idx);
    if (p.downed) { if (!rb) { rb = document.createElement('div'); rb.className = 'revive'; rb.innerHTML = '<i></i>'; $('#world-ui').appendChild(rb); W.revive.set(p.idx, rb); } const sp = R.toScreen(p.x, 1.6, p.z); rb.style.left = sp.x + 'px'; rb.style.top = sp.y + 'px'; setW(rb.firstChild, p.reviveK); rb.style.display = ''; }
    else if (rb) rb.style.display = 'none';
  }
};

/* ---------------- Touch controls ---------------- */
UI.buildTouch = function () {
  const G = H.G; const t = $('#touch');
  const on = G.active && G.players.some(p => (p.seatSrc || p.src) === 'touch' || ((p.seatSrc || p.src) === 'auto' && H.input.lastDevice === 'touch'));
  t.hidden = !on; if (!on) { t.innerHTML = ''; return; }
  const sz = H.settings.touchScale; t.style.setProperty('--tsz', sz);
  const B = (id, x, y, r, label) => `<div class="tb" data-a="${id}" style="right:calc(${x}px + env(safe-area-inset-right, 0px));bottom:calc(${y}px + env(safe-area-inset-bottom, 0px));width:${r * 2 * sz}px;height:${r * 2 * sz}px"><span class="ic"></span><span class="cdw"></span><span class="cdn"></span><span class="lbl">${label}</span></div>`;
  const s = sz;
  t.innerHTML = `<div class="zone"></div><div class="stick" hidden><div class="knob"></div></div>
    ${B('dash', 28 * s, 26 * s, 44, 'dash')}
    ${B('cast1', 130 * s, 22 * s, 36, 'I')}${B('cast2', 118 * s, 104 * s, 34, 'II')}${B('cast3', 42 * s, 128 * s, 34, 'III')}${B('cast4', 192 * s, 92 * s, 30, 'IV')}${B('ult', 30 * s, 210 * s, 32, 'ULT')}
    <div class="tb" data-a="interact" style="right:calc(${120 * s}px + env(safe-area-inset-right,0px));bottom:calc(${200 * s}px + env(safe-area-inset-bottom,0px));width:${56 * s}px;height:${56 * s}px" hidden>${H.glyphSVG('defense', '#f4d58a', 24)}</div>`;
  const I = H.input; I.touch.btn = {}; I.touch.stick = null;
  for (const a of ['dash', 'cast1', 'cast2', 'cast3', 'cast4', 'ult', 'interact']) I.touch.btn[a] = { held: false, pressed: false, released: false, dragging: false, ax: 0, az: 0 };
  const zone = $('.zone', t), stick = $('.stick', t), knob = $('.knob', t);
  let sid = null, ox = 0, oy = 0;
  zone.addEventListener('pointerdown', e => { if (sid != null) return; sid = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch (err) { } ox = e.clientX; oy = e.clientY; stick.hidden = false; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; knob.style.transform = 'translate(-50%,-50%)'; I.touch.stick = { vx: 0, vy: 0 }; I.lastDevice = 'touch'; e.preventDefault(); });
  zone.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; const R0 = 50 * sz; let dx = e.clientX - ox, dy = e.clientY - oy; const m = Math.hypot(dx, dy); if (m > R0) { ox += dx - dx / m * R0; oy += dy - dy / m * R0; dx = dx / m * R0; dy = dy / m * R0; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; } knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; const k = Math.min(1, m / R0); const l = Math.hypot(dx, dy) || 1; I.touch.stick = { vx: dx / l * (k < 0.15 ? 0 : k), vy: dy / l * (k < 0.15 ? 0 : k) }; });
  const endStick = e => { if (e.pointerId !== sid) return; sid = null; stick.hidden = true; I.touch.stick = null; };
  zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
  $$('.tb', t).forEach(el => {
    const a = el.dataset.a; const b = I.touch.btn[a]; let pid = null, sx = 0, sy = 0;
    el.addEventListener('pointerdown', e => { e.preventDefault(); if (pid != null) return; pid = e.pointerId; try { el.setPointerCapture(pid); } catch (err) { } sx = e.clientX; sy = e.clientY; b.held = true; b.pressed = true; b.dragging = false; b.ax = b.az = 0; b.relAim = null; el.classList.add('held'); I.lastDevice = 'touch'; });
    el.addEventListener('pointermove', e => { if (e.pointerId !== pid || a === 'dash' || a === 'interact') return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 18) { b.dragging = true; const l = Math.hypot(dx, dy); b.ax = dx / l; b.az = dy / l; } });
    const up = e => { if (e.pointerId !== pid) return; pid = null; b.held = false; b.released = true; b.relAim = b.dragging ? [b.ax, b.az] : null; b.dragging = false; el.classList.remove('held'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
};
UI.updateTouch = function () {
  const t = $('#touch'); if (t.hidden) return; const G = H.G;
  const p = G.players.find(q => q.src === 'touch') || G.players[0]; if (!p) return;
  $$('.tb', t).forEach(el => {
    const a = el.dataset.a;
    if (a === 'interact') { const show = !!(p.nearProp && !p.nearProp.used); if (el.hidden === show) el.hidden = !show; return; }
    if (a === 'dash') { setT(el.querySelector('.cdn'), String(p.dashCharges)); const f = p.dashCharges < p.dashMax ? (1 - p.dashRecharge / 1.35) : 0; el.style.setProperty('--cd', (p.dashCharges === 0 ? f * 100 : 0).toFixed(1) + '%'); if (!el._ic) { el._ic = 1; el.querySelector('.ic').innerHTML = H.glyphSVG('movement', '#e8f8ff', 26); } return; }
    const sp = a === 'ult' ? p.ult : p.spells[+a.slice(4) - 1]; if (el.hidden !== !sp) el.hidden = !sp; if (!sp) return; const st = H.spellStats(sp.id, sp.rank, p);
    if (el._id !== sp.id) { el._id = sp.id; el.querySelector('.ic').innerHTML = UI.spellIcon(sp.id, 26); el.style.borderColor = elCss(H.SPELLS[sp.id].el); }
    el.style.setProperty('--cd', (sp.cd > 0 && sp.maxCd ? sp.cd / sp.maxCd * 100 : 0).toFixed(1) + '%');
    setT(el.querySelector('.cdn'), sp.cd > 0.05 ? (sp.cd < 1 ? sp.cd.toFixed(1) : Math.ceil(sp.cd)) : '');
    el.classList.toggle('nomana', p.mana < st.cost);
  });
  // aim preview while dragging a spell
  const I = H.input; let drag = null; for (const a of ['cast1', 'cast2', 'cast3', 'cast4']) if (I.touch.btn[a] && I.touch.btn[a].dragging) drag = I.touch.btn[a];
  if (drag && H.R.reticle) { H.R.reticle.visible = true; H.R.reticle.position.x = p.x + drag.ax * 6; H.R.reticle.position.z = p.z + drag.az * 6; }
  else if (p.src === 'touch' && H.R.reticle) H.R.reticle.visible = false;
};

/* ---------------- Game events ---------------- */
UI.onGame = function (name, d) {
  const G = H.G; const run = G.run;
  switch (name) {
    case 'runStart': UI.closePages(); UI.buildHud(); break;
    case 'runReady': if (run.mode === 'arena') UI.banner(H.t(run.arenaRule === 'siege' ? 'The Pit' : 'The Vigil'), H.t(run.arenaRule === 'siege' ? 'survive the waves' : 'survive as long as you can')); break;
    case 'roomStart': {
      if (run.mode === 'tutorial' || run.mode === 'arena') break;
      const t = d.type;
      const names = { combat: ['Cursed Chamber', H.DEPTHS[run.depth].name], elite: ['Elite Chamber', 'a crowned foe waits'], rest: ['The Hearth', 'a moment of warmth'], shrine: ['Forge Shrine', 'temper your craft'], treasure: ['Reliquary', 'spoils of the fallen'], mystery: ['Unknown', 'something is watching'], challenge: ['The Trial Altar', 'risk for reward'] };
      if (names[t]) UI.banner(H.t(names[t][0]), H.t(names[t][1]));
      break;
    }
    case 'depth': UI.banner(H.t('Depth {d}', { d: H.roman(d.depth) }), H.DEPTHS[d.depth].name, 'boss'); break;
    case 'roomClear': UI.banner(H.t('Cleared'), run.mode === 'arena' ? '' : H.t('the chamber is quiet')); break;
    case 'wave': if (d.arena) UI.banner(H.t('Wave {w}', { w: d.wave }), d.wave % 5 === 0 ? H.t('an elite approaches') : ''); break;
    case 'bossIntro': UI.banner(d.e.def.name, d.e.def.title, 'boss'); break;
    case 'bossPhase': UI.banner(H.t(d.text), H.t('phase {p}', { p: H.roman(d.phase) }), 'boss'); break;
    case 'bossStagger': UI.toast(H.t('Staggered! Strike now')); break;
    case 'bossDown': UI.banner(H.t('Warden Unmade'), H.t('{n} falls', { n: d.e.def.name })); break;
    case 'descentReady': UI.toast(H.t(d.last ? 'The way out opens' : 'A descent sigil opens')); break;
    case 'challenge': UI.banner(H.t(d.name), H.t('the doors seal'), 'bad'); break;
    case 'challengeFail': UI.banner(H.t('Trial Failed'), H.t('the altar takes its price'), 'bad'); break;
    case 'hurt': { const h = $('#hurt'); h.style.transition = 'none'; h.style.opacity = H.settings.reduceFlash ? '0.25' : '0.6'; requestAnimationFrame(() => { h.style.transition = 'opacity .45s'; h.style.opacity = '0'; }); break; }
    case 'downed': UI.toast(H.t('{n} is down. Stand beside them to revive', { n: H.t(d.p.name) })); break;
    case 'revive': UI.toast(H.t('{n} is back on their feet', { n: H.t(d.p.name) })); break;
    case 'playerDeath': UI.banner(H.t(run.mode === 'arena' ? 'The Pit Wins' : 'Fallen'), H.t('slain by {x}', { x: H.t(d.cause ? d.cause.name : 'the dark') }), 'bad'); break;
    case 'runEnd': setTimeout(() => UI.showResults(d.run, d.victory), d.run.mode === 'tutorial' ? 300 : 700); break;
    case 'milestone': UI.toast(H.t('Milestone: {n} · {r}', { n: H.MILESTONES[d.key].name, r: H.MILESTONES[d.key].reward })); break;
    case 'transition': UI.fade(true); setTimeout(() => UI.fade(false), d.to === 'descent' ? 700 : 450); break;
    case 'deny': { const cl = $('#cl-' + d.p.idx); if (cl) { const sl = cl.querySelectorAll('.sslot')[d.slot]; if (sl) { sl.classList.remove('deny'); void sl.offsetWidth; sl.classList.add('deny'); } } break; }
    case 'tutorial': {
      const st = G.TUT_STEPS[d.step]; const p = G.players[0]; const src = UI.srcLabel(p.seatSrc === 'auto' ? null : p.src);
      const mv = src === 'kbm' ? H.t('Use {keys}.', { keys: ['up', 'left', 'down', 'right'].map(a => H.keyName(H.save.bindings.kb[a][0])).join(' ') }) : H.t(src === 'touch' ? 'Drag on the left half of the screen.' : 'Use the left stick.');
      const a = { move: mv, cast1: UI.keyFor('cast1', src), cast2: UI.keyFor('cast2', src), cast3: UI.keyFor('cast3', src), dash: UI.keyFor('dash', src) };
      if (src === 'touch') { a.cast1 = H.t('the I button'); a.cast2 = H.t('the II button'); a.cast3 = H.t('the III button'); a.dash = H.t('the dash button'); }
      const tb = $('#hd-tut'); tb.hidden = false; tb.classList.toggle('min', !!UI.tutMin); tb.innerHTML = `<button class="xbtn" id="tut-x" aria-label="${H.t('Close')}">${UI.tutMin ? '+' : '&times;'}</button><div class="eyebrow">${H.t('primer · {n} of {m}', { n: d.step + 1, m: G.TUT_STEPS.length })}</div><div class="t">${esc(st.title)}</div><div class="x">${esc(st.text(a))}</div><div class="tut-act"><button class="btn ghost" id="tut-skip">${H.t('Skip tutorial')}</button></div>`;
      $('#tut-x').onclick = () => { UI.tutMin = !UI.tutMin; tb.classList.toggle('min', UI.tutMin); $('#tut-x').innerHTML = UI.tutMin ? '+' : '&times;'; };
      $('#tut-skip').onclick = () => UI.confirm(H.t('Skip the tutorial?'), H.t('You can replay it later from Settings.'), () => UI.skipTutorial(), null, H.t('Skip'), H.t('Keep learning'));
      break;
    }
    case 'levelUp': { const b = $$('.bar.xp'); b.forEach(x => { x.classList.remove('lvl'); void x.offsetWidth; x.classList.add('lvl'); }); break; }
    case 'tutorialOk': { const tb = $('#hd-tut'); tb.classList.remove('ok'); void tb.offsetWidth; tb.classList.add('ok'); UI.toast(H.t('Well done')); break; }
  }
};

/* ---------------- Inventory (equipment slots + bag; items come later) ---------------- */
UI.toggleInventory = function () {
  const G = H.G; if (!G.active) return;
  if (UI.layers.some(l => l.id === 'scr-inv')) { UI.layers.find(l => l.id === 'scr-inv').back(); return; }
  if (G.modal || G.paused) return;
  UI.showInventory();
};
UI.itemIcon = (id, size = 26) => { const it = H.ITEMS[id]; return it ? H.glyphSVG(it.icon, it.col, size) : ''; };
UI.itemStatsHtml = (it, cmp) => Object.entries(it.stats).filter(([k, v]) => v || k !== 'wdmg').map(([k, v]) => { const d = H.ITEM_STATS[k]; const good = k === 'speed' ? v > 0 : true; return `<div class="istat ${good ? 'up' : 'down'}"><span>${esc(H.t(d.name))}</span><b>${esc(d.fmt(v))}</b></div>`; }).join('') + UI.weaponHtml(it);
UI.weaponHtml = it => {
  let h = '';
  if (it.hero) { const c = H.CHARACTERS[it.hero]; h += `<div class="istat ${''}" style="color:#e8c46a"><span>${esc(H.t('Only'))}</span><b>${esc(H.t(c ? c.name : it.hero))}</b></div>`; }
  const k = it.weapon && H.WEAPON_KITS[it.weapon];
  if (k) h += `<div class="wkit">${k.trait ? `<div class="tiny" style="color:#e8c46a">${esc(H.t(k.trait))}</div>` : ''}${[k.primary].concat(k.skills).map((id, i) => `<div class="wsk">${UI.spellIcon(id, 18)}<b>${esc(H.SPELLS[id].name)}</b><span class="muted">${esc(i ? H.t('slot {n}', { n: H.roman(i + 1) }) : H.t('basic attack'))}</span></div>`).join('')}${k.ult ? `<div class="wsk">${UI.spellIcon(k.ult, 18)}<b style="color:#ffd24a">${esc(H.SPELLS[k.ult].name)}</b><span class="muted">${esc(H.t('ultimate'))}</span></div>` : ''}</div>`;
  return h;
};
UI.lockedToast = it => { const c = it && it.hero && H.CHARACTERS[it.hero]; sfx('ui_deny'); UI.toast(H.t('Only {n} can wield this.', { n: c ? H.t(c.name) : "?" })); };
UI.showShop = function (p, prop, done) {
  const G = H.G;
  if (H.botMode) { const i = prop.stock.findIndex(s => !s.sold && G.wallet() >= G.shopPrice(s.rarity)); if (i >= 0) G.buyItem(p, prop, i); setTimeout(done, 0); return; }
  const lines = H.lang === 'es' ? ['Ah, un cliente. Todo lo que ves, lo saqué de gente que bajó más que vos.', 'Las Monedas de Oro no se gastan solas, ¿no?', 'Elegí rápido, que algo se mueve en la oscuridad.'] : ['Ah, a customer. Everything here came off people who went deeper than you.', "Embers don't spend themselves, do they?", 'Choose quickly. Something moves in the dark.'];
  const line = lines[Math.floor(Math.random() * lines.length)];
  const s = UI.open('scr-shop', `<div class="modal plate shop" style="width:min(900px,100%)">
    <div class="row" style="align-items:flex-end;gap:14px"><div class="grow"><div class="eyebrow">${H.t('Merchant')}</div><h2>${H.t('Wandering Merchant')}</h2><div class="sub" style="font-style:italic">“${esc(line)}”</div></div>
    <div class="plate embers" style="padding:6px 12px"><span class="ember-dot"></span><span class="num" id="sh-w"></span> ${H.t('gold coins')}</div></div>
    <div class="cards" id="sh-cards"></div>
    <div class="row"><button class="btn" id="sh-leave" data-autofocus>${H.t('Leave')}</button><span class="tiny muted">${H.t('Prices rise with every purchase this run.')}</span></div></div>`, { cls: 'dim', back: () => leave() });
  const leave = () => { UI.close('scr-shop'); done(); };
  $('#sh-leave', s).onclick = leave;
  const render = () => {
    $('#sh-w', s).textContent = G.wallet();
    const full = !p.bag.some(x => !x);
    $('#sh-cards', s).innerHTML = prop.stock.map((st, i) => {
      const it = H.ITEMS[st.id]; const rr = H.RARITY[it.rarity]; const price = G.shopPrice(st.rarity); const poor = G.wallet() < price;
      const btn = st.sold ? `<button class="btn" disabled>${H.t('Sold')}</button>` : full ? `<button class="btn" disabled>${H.t('Bag full')}</button>` : `<button class="btn ${poor ? '' : 'primary'}" data-buy="${i}" ${poor ? 'disabled' : ''}><span class="ember-dot" style="display:inline-block;width:10px;height:10px;margin-right:6px"></span>${price} · ${H.t('Buy')}</button>`;
      return `<div class="card plate ${st.sold ? 'sold' : ''}" style="border-color:${rr.css}"><div class="row">${UI.itemIcon(it.id, 34)}<div class="tag" style="color:${rr.css}">${esc(H.t(rr.name))} · ${esc(H.t(H.EQUIP_SLOTS.find(x => x.id === it.slot).name))}</div></div><h3>${esc(it.name)}</h3><div class="istats">${UI.itemStatsHtml(it)}</div><p class="tiny muted" style="font-style:italic">${esc(it.desc)}</p><div class="foot">${btn}</div></div>`;
    }).join('');
    $$('[data-buy]', s).forEach(b => b.onclick = () => { const r = G.buyItem(p, prop, +b.dataset.buy); if (r === 'poor') UI.toast(H.t('Not enough gold coins')); else if (r === 'full') UI.toast(H.t('Your bag is full')); render(); });
  };
  render();
};
/* Inventory panel shared by the in-run screen and the main-menu page.
   p: a player, or a "meta" pseudo-player ({ equip, bag, persist }) when opened from the menu. */
UI.mountInventory = function (root, p, opts = {}) {
  const G = H.G;
  const itemOf = id => (id && H.ITEMS[id]) || null;
  const rarCss = it => H.RARITY[it.rarity].css;
  let sel = null, hbSel = null;
  const pct = v => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
  const stat = (k, v, cls) => `<div class="ivstat ${cls || ''}"><span>${esc(H.t(k))}</span><b>${v}</b></div>`;
  const doll = opts.preview ? '<div class="doll3d" id="iv-3d"></div>' : `<svg class="doll" viewBox="0 0 120 220" aria-hidden="true"><path d="M60 14c-17 0-27 15-27 31 0 9 3 15 7 20l-12 10c-7 6-10 14-11 22l-4 95c22 12 72 12 94 0l-4-95c-1-8-4-16-11-22l-12-10c4-5 7-11 7-20 0-16-10-31-27-31z" fill="rgba(140,92,255,.07)" stroke="rgba(236,228,210,.18)" stroke-width="1.5"/></svg>`;
  root.innerHTML = `<div class="invwrap ${opts.menu ? 'menu' : ''}">
      <div class="equip"><div class="eqgrid" id="iv-eq"><div id="iv-slots" style="display:contents"></div>${doll}</div>
        ${opts.menu ? '' : '<div class="ivstats" id="iv-st"></div>'}
        ${opts.hotbar ? `<div class="hotbar"><div class="eyebrow">${H.t('Spell bar')}</div><div class="hb-row" id="iv-hb"></div><div class="tiny muted">${H.t('Tap two slots to swap them. Each spell remembers its slot for future runs.')}</div></div>` : ''}</div>
      <div class="bagside">
        ${opts.menu ? `<div class="plate statcard"><div class="eyebrow">${H.t('Character')}</div><div class="ivstats wide" id="iv-st"></div></div>` : ''}
        <div class="eyebrow" id="iv-bh"></div>
        <div class="bag" id="iv-bag"></div>
        <div class="ivinfo plate" id="iv-info"></div>
      </div></div>`;
  const $r = q => root.querySelector(q);
  const info = $r('#iv-info');
  let doAction = () => { };
  const itemInfo = (it, action, label) => {
    const cur = action === 'equip' ? itemOf(p.equip[it.slot]) : null;
    info.innerHTML = `<div class="row" style="gap:10px;align-items:center">${UI.itemIcon(it.id, 34)}<div><b>${esc(it.name)}</b><div class="tiny" style="color:${rarCss(it)}">${esc(H.t(H.RARITY[it.rarity].name))} · ${esc(H.t(H.EQUIP_SLOTS.find(x => x.id === it.slot).name))}</div></div></div>
      <div class="istats">${UI.itemStatsHtml(it)}</div><div class="muted tiny" style="font-style:italic">${esc(it.desc)}</div>
      ${cur ? `<div class="tiny muted">${H.t('Replaces')}: <b style="color:${rarCss(cur)}">${esc(cur.name)}</b></div>` : ''}
      ${action ? `<div class="row"><button class="btn primary" id="iv-act">${esc(label)}</button></div>` : ''}`;
    const b = info.querySelector('#iv-act'); if (b) b.onclick = () => doAction();
  };
  const showSel = () => {
    if (!sel) { info.innerHTML = `<b>${H.t('Equipment')}</b><div class="muted tiny">${H.t('Tap an item to see it. Equip armour on your head, body, legs, feet and back. Cloaks make you faster; iron makes you tougher but slower.')}</div>`; return; }
    if (sel.kind === 'bag') { const it = itemOf(p.bag[sel.key]); if (!it) { info.innerHTML = `<b>${H.t('Bag')} · ${sel.key + 1}</b><div class="muted tiny">${H.t('Empty space.')}</div>`; return; } doAction = () => { if (G.equipItem(p, sel.key) === 'locked') { UI.lockedToast(it); return; } sel = { kind: 'slot', key: it.slot }; render(); }; itemInfo(it, 'equip', H.t('Equip')); }
    else { const sl = H.EQUIP_SLOTS.find(x => x.id === sel.key); const it = itemOf(p.equip[sel.key]); if (!it) { info.innerHTML = `<b>${esc(H.t(sl.name))}</b><div class="tiny" style="color:var(--brass-hi)">${H.t('Empty')}</div><div class="muted tiny">${esc(H.t(sl.hint))}</div>`; return; } doAction = () => { if (!G.unequipItem(p, sel.key)) { UI.toast(H.t('Your bag is full')); return; } sel = null; render(); }; itemInfo(it, 'unequip', H.t('Unequip')); }
  };
  const statsHtml = () => {
    const g = G.gearStats(p);
    const hp = p.kind === 'player' ? `${Math.round(p.hp)} / ${p.maxHp}` : String(100 + (g.hp || 0));
    const mp = p.kind === 'player' ? `${Math.floor(p.mana)} / ${p.maxMana}` : String(100 + (g.mana || 0));
    const rows = [stat('HP', hp), stat('Mana', mp), stat('Move speed', pct(Math.max(-0.3, Math.min(0.45, g.speed || 0)))), stat('Damage taken', g.armor ? '−' + Math.round(Math.min(0.5, g.armor) * 100) + '%' : '0%'), stat('Spell damage', pct(g.spell || 0)), stat('Cooldowns', g.cdr ? '−' + Math.round(g.cdr * 100) + '%' : '0%')];
    if (opts.menu) rows.push(stat('Ember damage', pct(g.fire || 0)), stat('Mana regeneration', pct(g.regen || 0)), stat('Dash recharge', pct(g.dash || 0)), stat('Dash invulnerability', '+' + (g.iframes || 0).toFixed(2) + ' s'));
    return rows.join('');
  };
  const renderHotbar = () => {
    const hb = $r('#iv-hb'); if (!hb) return; const act = ['cast1', 'cast2', 'cast3', 'cast4'];
    hb.innerHTML = [0, 1, 2, 3].map(i => { const sp = p.spells[i]; const d = sp && H.SPELLS[sp.id]; return `<button class="hbslot ${i === 0 ? 'locked' : ''} ${hbSel === i ? 'sel' : ''}" data-hb="${i}" title="${d ? esc(d.name) : esc(H.t('Empty slot'))}"><span class="k">${esc(UI.keyFor(act[i], p.src))}</span>${d ? UI.spellIcon(sp.id, 24) : '<span class="plus">+</span>'}<span class="nm">${d ? esc(d.name) : ''}</span></button>`; }).join('');
    hb.querySelectorAll('.hbslot').forEach(b => b.onclick = () => { const i = +b.dataset.hb; if (i === 0) { UI.toast(H.t('Your primary attack always stays on slot I')); return; } if (hbSel == null) hbSel = i; else if (hbSel === i) hbSel = null; else { G.swapSlots(p, hbSel, i); hbSel = null; sfx('ui_ok'); } renderHotbar(); });
  };
  const slotHtml = sl => { const it = itemOf(p.equip[sl.id]); return `<button class="eqslot ${it ? 'full' : ''} ${sel && sel.kind === 'slot' && sel.key === sl.id ? 'sel' : ''}" data-nav data-slot="${sl.id}" style="grid-area:${sl.id};${it ? 'border-color:' + rarCss(it) : ''}">${it ? UI.itemIcon(it.id, 34) : H.glyphSVG(sl.glyph, '#6d6478', 30)}<span class="lbl">${esc(it ? it.name : H.t(sl.name))}</span></button>`; };
  const render = () => {
    renderHotbar();
    $r('#iv-slots').innerHTML = H.EQUIP_SLOTS.map(slotHtml).join('');
    $r('#iv-bag').innerHTML = p.bag.map((id, i) => { const it = itemOf(id); return `<button class="bagcell ${it ? 'full' : ''} ${sel && sel.kind === 'bag' && sel.key === i ? 'sel' : ''}" data-nav data-bag="${i}" ${it ? `style="border-color:${rarCss(it)}" title="${esc(it.name)}"` : ''}>${it ? UI.itemIcon(id, 26) : ''}</button>`; }).join('');
    $r('#iv-bh').innerHTML = `${H.glyphSVG('eq_bag', '#c9bfae', 14)} ${H.t('Bag')} · ${p.bag.filter(Boolean).length}/${H.BAG_SIZE}`;
    $r('#iv-st').innerHTML = statsHtml();
    showSel();
    if (opts.onChange) opts.onChange();
    root.querySelectorAll('.eqslot').forEach(b => { b.onclick = () => { sel = { kind: 'slot', key: b.dataset.slot }; render(); }; b.ondblclick = () => { if (p.equip[b.dataset.slot]) { G.unequipItem(p, b.dataset.slot); sel = null; render(); } }; b.addEventListener('mouseenter', () => { if (!sel) { const it = itemOf(p.equip[b.dataset.slot]); if (it) itemInfo(it); } }); });
    root.querySelectorAll('.bagcell').forEach(b => { const i = +b.dataset.bag; b.onclick = () => { sel = { kind: 'bag', key: i }; render(); }; b.ondblclick = () => { if (p.bag[i]) { const it = itemOf(p.bag[i]); if (G.equipItem(p, i) === 'locked') { UI.lockedToast(it); return; } sel = { kind: 'slot', key: it.slot }; render(); } }; b.addEventListener('mouseenter', () => { if (!sel) { const it = itemOf(p.bag[i]); if (it) itemInfo(it); } }); });
  };
  render();
  return { render };
};
UI.showInventory = function (pi = 0) {
  const G = H.G; if (!G.active || !G.players.length) return;
  const wasPaused = G.paused; G.paused = true; sfx('ui_ok');
  const p = G.players[Math.min(pi, G.players.length - 1)];
  const tabs = G.players.length > 1 ? `<div class="row">${G.players.map((q, i) => `<button class="btn ${q === p ? 'primary' : ''}" data-pt="${i}">${esc(H.t(q.name))}</button>`).join('')}</div>` : '';
  const s = UI.open('scr-inv', `<div class="modal plate inv" style="width:min(1000px,100%)">
    <div class="page-head"><div><div class="eyebrow">${esc(H.t('Lv {n}', { n: G.run.level }))} · ${esc(H.t(p.name))}</div><h2>${H.t('Inventory')}</h2></div><div class="grow"></div>${tabs}<button class="btn" id="iv-close" data-autofocus>${H.t('Close')} <span class="k">${esc(UI.keyFor('inventory', p.src))}</span></button></div>
    <div id="iv-root" style="display:contents"></div></div>`, { cls: 'dim', x: false, back: () => close() });
  const close = () => { UI.close('scr-inv'); G.paused = wasPaused; sfx('ui_back'); };
  $('#iv-close', s).onclick = close;
  $$('[data-pt]', s).forEach(b => b.onclick = () => { UI.close('scr-inv'); G.paused = wasPaused; UI.showInventory(+b.dataset.pt); });
  UI.mountInventory($('#iv-root', s), p, { hotbar: true });
  UI.top().onKey = k => { if ((H.save.bindings.kb.inventory || []).includes(k)) close(); };
  UI.top().onUpdate = () => { for (const gp of H.input.pads) if (H.input.padButtonPressed(gp, H.save.bindings.pad.inventory)) close(); };
};
/* ---- Real-time 3D preview of the hero (own small renderer) ---- */
UI.CharPreview = function (host, hero) {
  const THREE = window.THREE; const R = H.R;
  const canvas = document.createElement('canvas'); host.appendChild(canvas);
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { host.innerHTML = '<div class="muted tiny">3D</div>'; return { update() { }, destroy() { } }; }
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xd8ccff, 0x1a1420, 0.3));
  const key = new THREE.DirectionalLight(0xfff0d8, 0.55); key.position.set(-2, 4, -3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8c5cff, 0.6); rim.position.set(2, 2.5, 3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ map: R.texRune, color: 0xd9a441, transparent: true, opacity: 0.35, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; scene.add(floor);
  const m = R.makeHero(hero || H.save.meta.character || 'percy', 0xd9a441); if (m.root.parent) m.root.parent.remove(m.root); scene.add(m.root);
  if (m.sig) m.sig.visible = false; if (m.light) m.light.intensity = 0; [m.gL, m.gR, m.aL, m.aR].forEach(g => { if (g) g.material.opacity = 0.15; });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.7;
  const tall = m.kind === 'knight';
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, tall ? 1.55 : 1.45, tall ? -5.0 : -4.6); cam.lookAt(0, tall ? 1.08 : 1.0, 0);
  const fp = { x: 0, z: 0, vx: 0, vz: 0, faceAng: 0, iframes: 0, dashT: 0, bastionT: 0, mirrorT: 0, hurtT: 0, invulnBlink: 0 };
  let ang = 0.5, auto = true, drag = null, last = performance.now(), raf = 0, dead = false;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, a: ang }; auto = false; try { canvas.setPointerCapture(e.pointerId); } catch (err) { } });
  canvas.addEventListener('pointermove', e => { if (drag) ang = drag.a + (e.clientX - drag.x) * 0.012; });
  const up = () => { drag = null; setTimeout(() => { auto = true; }, 2500); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const size = () => { const w = host.clientWidth || 200, h = host.clientHeight || 300; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const loop = now => {
    if (dead) return; raf = requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (auto) ang += dt * 0.5; fp.faceAng = ang;
    R.animateRogue(m, fp, dt); m.root.position.set(0, 0, 0);
    if (canvas.width !== Math.round((host.clientWidth || 200) * renderer.getPixelRatio())) size();
    renderer.render(scene, cam);
  };
  size(); raf = requestAnimationFrame(loop);
  return {
    update(equip) { R.dressRogue(m, equip); },
    destroy() { dead = true; cancelAnimationFrame(raf); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { } }
  };
};
/* ---- Main-menu Inventory page: persistent equipment ---- */
UI.showInventoryMenu = function (hero) {
  const me = H.save.meta; hero = hero || me.character || 'percy';
  const gear = H.G.heroGear(hero);
  UI.closePages();
  const pm = { kind: 'meta', persist: true, charId: hero, equip: Object.assign({}, gear.equip), bag: gear.bag.slice(), charms: new Set() };
  const tabs = Object.keys(H.CHARACTERS).map(c => `<button class="btn ${c === hero ? 'primary' : 'ghost'}" data-hero="${c}">${esc(H.t(H.CHARACTERS[c].name))}</button>`).join('');
  const s = UI.open('scr-invm', `<div class="page-head"><div><div class="eyebrow">${H.t('the waystone')}</div><h2>${H.t('Inventory')}</h2></div><div class="grow"></div><div class="row" style="gap:6px">${tabs}</div><button class="btn ghost" id="im-back">${H.t('Back')} <span class="k">Esc</span></button></div>
    <div class="sub muted invm-sub">${H.t('Each hero keeps their own equipment and bag. Everything a hero loots is kept between runs.')}</div>
    <div class="scroll invm-scroll" id="im-root"></div>`, { page: true, back: () => leave() });
  let prev = null;
  const leave = () => { if (prev) prev.destroy(); prev = null; H.saveNow(); UI.showHub(); };
  $('#im-back', s).onclick = leave;
  s.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => { if (b.dataset.hero === hero) return; if (prev) prev.destroy(); prev = null; H.saveNow(); sfx('ui_ok'); UI.showInventoryMenu(b.dataset.hero); });
  const api = UI.mountInventory($('#im-root', s), pm, { menu: true, preview: true, onChange: () => { H.G.syncGear(pm); if (prev) prev.update(pm.equip); } });
  const host = $('#iv-3d', s); if (host) { prev = UI.CharPreview(host, hero); prev.update(pm.equip); }
  UI.top().onClose = () => { if (prev) prev.destroy(); prev = null; };
};
