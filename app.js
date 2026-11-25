/*
 * app.js — UI: week tabs, result picking, playoff picture, odds tables, tiebreaker dialog, theme.
 * Odds, final scores and settings come from updates.js (plain text, edited by the site admin).
 */
(function () {
  'use strict';
  var NFL = window.NFL, SEASON;
  try { SEASON = NFL.Updates.parse(window.UPDATES, window.NFLData); }
  catch (e) { SEASON = NFL.Updates.parse('', window.NFLData); SEASON.problems.push({ line: 0, text: '', msg: 'updates.js could not be read: ' + e.message }); }
  var L = NFL.League.build(window.NFLData, SEASON);
  var ODDS = SEASON, COLORS = window.NFLColors, RULES = window.NFLRules;
  var R = L.remaining.length;
  var STORE = 'nflPlayoffLab.v2';

  var TIE = ODDS.TIE_PCT;
  var pHome = L.remaining.map(function (g) {
    var v = ODDS.HOME_WIN_PCT[L.week[g] + '-' + L.ids[L.away[g]] + '-' + L.ids[L.home[g]]];
    return typeof v === 'number' ? v : ODDS.PLACEHOLDER;
  });
  function pAwayOf(j) { return Math.round((100 - pHome[j] - TIE) * 100) / 100; }
  function fmtP(v) { return (Math.round(v * 100) / 100).toString(); }
  var WEEKS = [];
  L.remaining.forEach(function (g) { if (WEEKS.indexOf(L.week[g]) < 0) WEEKS.push(L.week[g]); });

  var state = { locks: pHome.map(function () { return 0; }), week: WEEKS[0], showDelta: true, theme: null, sortKey: null, sortDir: -1, full: false, order: [null, null] };
  var baseline = null, scenario = null, runId = 0, timer = null, oddsStale = false;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nick(t) { return L.names[t].split(' ').pop(); }
  /* 100 and 0 are shown only when mathematically proven (st === 'in' / 'out'); otherwise >99.9 and <0.1. */
  function pctStr(p, st) {
    if (st === 'in') return '100';
    if (st === 'out') return '0';
    var v = p * 100;
    if (v < 0.1) return '<0.1';
    if (v >= 99.95) return '>99.9';
    return v.toFixed(1);
  }
  function statusFor(col, t) {
    var c = cert[t]; if (!c) return null;
    return col.key === 'playoffs' ? c.po : col.key === 'division' ? c.div : col.key === 'bye' ? c.seed[0] : c.seed[+col.key.slice(1)];
  }
  var cert = [];
  function lockCount(week) { var n = 0; L.remaining.forEach(function (g, j) { if (state.locks[j] && (!week || L.week[g] === week)) n++; }); return n; }
  function recText(t) { var r = pic.rec[t]; return r[0] + '-' + r[1] + (r[2] ? '-' + r[2] : ''); }
  var pic = null;

  /* ---------- persistence ---------- */
  /* Picks are stored by game key, so they survive games going final and weeks dropping off. */
  function load() {
    var s = null; try { s = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) {}
    if (!s) return;
    if (s.locks && typeof s.locks === 'object') {
      L.remaining.forEach(function (g, j) { var v = s.locks[L.keys[g]]; if (v === 1 || v === 2 || v === 3) state.locks[j] = v; });
    }
    state.showDelta = s.showDelta !== false;
    if (WEEKS.indexOf(s.week) >= 0) state.week = s.week;
    state.theme = s.theme || null; state.full = !!s.full;
  }
  function save() {
    var locks = {};
    L.remaining.forEach(function (g, j) { if (state.locks[j]) locks[L.keys[g]] = state.locks[j]; });
    try { localStorage.setItem(STORE, JSON.stringify({ locks: locks, week: state.week, showDelta: state.showDelta, theme: state.theme, full: state.full })); } catch (e) {}
  }

  /* ---------- colors ---------- */
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lum(c) { var a = c.map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function isLight(c) { return lum(c) > .36; }
  function onColor(c) { return isLight(c) ? '#0c1220' : '#ffffff'; }
  function css(c) { return 'rgb(' + c.map(Math.round).join(',') + ')'; }
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function panelRgb() { return isDark() ? [18, 22, 28] : [255, 255, 255]; }
  var accentCache = {};
  function accent(t) { // team color readable against the panel (for heat shading)
    var key = t + (isDark() ? 'd' : 'l');
    if (accentCache[key]) return accentCache[key];
    var cs = COLORS[L.ids[t]], bg = panelRgb(), a = hex(cs[0]), b = hex(cs[1]);
    return (accentCache[key] = contrast(a, bg) >= 1.6 ? a : (contrast(b, bg) >= 1.6 ? b : [140, 150, 168]));
  }
  function blend(c, bg, a) { return [0, 1, 2].map(function (i) { return bg[i] + (c[i] - bg[i]) * a; }); }
  /* paint an element as a team color block: primary fill, secondary stripe, readable text */
  function paint(node, t) {
    var cs = COLORS[L.ids[t]], p = hex(cs[0]);
    node.style.setProperty('--bc', cs[0]); node.style.setProperty('--bs', cs[1]); node.style.setProperty('--bt', onColor(p));
    if (isLight(p)) node.classList.add('light');
  }

  /* ---------- week tabs ---------- */
  function selectWeek(w, focus) {
    state.week = w; save(); renderTabs(); renderCards(); if (focus) $('tab-' + w).focus();
  }
  function renderTabs() {
    var host = $('tabs'); host.innerHTML = '';
    WEEKS.forEach(function (w, i) {
      var b = el('button', 'tab'); b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'tab-' + w;
      b.setAttribute('aria-selected', String(w === state.week)); b.tabIndex = w === state.week ? 0 : -1;
      b.appendChild(el('span', '', 'Wk')); b.appendChild(el('b', '', String(w)));
      var n = lockCount(w); if (n) b.appendChild(el('i', 'count', String(n)));
      b.addEventListener('click', function () { selectWeek(w); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); selectWeek(WEEKS[(i + d + WEEKS.length) % WEEKS.length], true); }
      });
      host.appendChild(b);
    });
  }

  /* ---------- game cards ---------- */
  function side(j, which, t, p) {
    var o = which === 'away' ? 1 : 3, lk = state.locks[j];
    var b = el('button', 'side' + (lk === o ? ' win' : lk ? ' lose' : '')); b.type = 'button';
    b.setAttribute('aria-pressed', String(lk === o)); b.title = L.names[t] + ' win (click again to clear)';
    paint(b, t);
    if (which === 'home') b.appendChild(el('em', '', '@'));
    b.appendChild(el('b', '', L.ids[t]));
    var pc;
    if (lk === o) pc = el('span', 'pct', 'WINS');
    else { pc = el('span', 'pct', fmtP(p)); pc.appendChild(el('i', '', '%')); }
    b.appendChild(pc);
    b.appendChild(el('span', 'ring', lk === o ? '✓' : ''));
    b.addEventListener('click', function () { toggle(j, o); });
    return b;
  }
  /* a finished game: same card, but not clickable, showing the final score */
  function finalSide(which, t, mine, theirs) {
    var b = el('div', 'side final' + (mine < theirs ? ' loser' : '')); paint(b, t);
    if (which === 'home') b.appendChild(el('em', '', '@'));
    b.appendChild(el('b', '', L.ids[t]));
    b.appendChild(el('span', 'pct', String(mine)));
    return b;
  }
  function finalCard(g) {
    var a = L.away[g], h = L.home[g], x = L.ap0[g], y = L.hp0[g];
    var card = el('div', 'game done'); card.title = 'Final — this result is locked';
    card.appendChild(finalSide('away', a, x, y)); card.appendChild(finalSide('home', h, y, x));
    card.appendChild(el('div', 'tie finalbar', x === y ? 'FINAL · TIE' : 'FINAL'));
    return card;
  }
  var lastWeekShown = null;
  function renderCards() {
    var host = $('cards'), keep = lastWeekShown === state.week ? host.scrollLeft : 0;
    host.innerHTML = ''; var playing = {}, finals = [];
    for (var g = 0; g < L.G; g++) {
      if (L.week[g] !== state.week) continue;
      var a = L.away[g], h = L.home[g]; playing[a] = playing[h] = 1;
      if (L.played[g]) { finals.push(g); continue; }
      var j = L.remIndex[g], lk = state.locks[j];
      var card = el('div', 'game' + (lk ? ' locked' : ''));
      card.appendChild(side(j, 'away', a, pAwayOf(j)));
      card.appendChild(side(j, 'home', h, pHome[j]));
      var tb = el('button', 'tie' + (lk === 2 ? ' on' : ''), 'TIE ' + fmtP(TIE) + '%'); tb.type = 'button';
      tb.setAttribute('aria-pressed', String(lk === 2)); tb.title = 'Lock: tie (click again to clear)';
      tb.addEventListener('click', function (jj) { return function () { toggle(jj, 2); }; }(j));
      card.appendChild(tb); host.appendChild(card);
    }
    finals.forEach(function (fg) { host.appendChild(finalCard(fg)); });
    var byes = L.ids.filter(function (_, t) { return !playing[t]; });
    if (byes.length) { var bi = el('div', 'byeinfo'); bi.appendChild(el('b', '', 'Bye week')); bi.appendChild(document.createTextNode(byes.join(', '))); host.appendChild(bi); }
    host.scrollLeft = keep; lastWeekShown = state.week; updateNav();
  }
  function updateNav() {
    var h = $('cards'), max = h.scrollWidth - h.clientWidth;
    $('stripPrev').disabled = h.scrollLeft <= 1; $('stripNext').disabled = h.scrollLeft >= max - 1;
  }
  function toggle(j, o) { state.locks[j] = state.locks[j] === o ? 0 : o; changed(); }

  /* ---------- scenario summary (banner) ---------- */
  function renderScenario() {
    var n = lockCount();
    $('scenarioTitle').textContent = n ? 'Your scenario' : 'Current standings';
    $('scenarioSub').textContent = n ? n + ' result' + (n > 1 ? 's' : '') + ' picked' : '';
    $('btnClear').hidden = !n;
  }

  /* ---------- results: picture + odds per conference ---------- */
  var COLS = [
    { key: 'playoffs', label: 'Playoffs', get: function (r) { return r.playoffs; } },
    { key: 'division', label: 'Div', get: function (r) { return r.division; } },
    { key: 'bye', label: 'Bye', get: function (r) { return r.bye; } }
  ];
  for (var q = 0; q < 7; q++) (function (s) { COLS.push({ key: 's' + s, label: String(s + 1), get: function (r) { return r.seeds[s]; }, edge: s === 0 }); })(q);

  function noteFor(t, c, isWinner) {
    var parts = [], dr = c.divReasons[t], sr = c.seedReasons[t];
    if (isWinner && dr) parts.push('Won division over ' + dr.over.map(function (x) { return L.ids[x]; }).join(', ') + ': ' + dr.step);
    if (sr) parts.push('Edges ' + sr.over.map(function (x) { return L.ids[x]; }).join(', ') + ': ' + sr.step);
    return parts.join(' · ');
  }
  function seedRow(t, n, divWinner, note) {
    var row = el('div', 'seed blk' + (n === 1 ? ' bye' : '')); paint(row, t);
    row.appendChild(el('span', 'n', String(n)));
    var tt = el('div', 't'); tt.appendChild(el('b', '', nick(t)));
    if (divWinner) tt.appendChild(el('span', 'tag', 'Div'));
    if (n === 1) tt.appendChild(el('span', 'tag', 'Bye'));
    if (note) { var sm = el('small', '', note); sm.title = note; tt.appendChild(sm); }
    row.appendChild(tt); row.appendChild(el('span', 'rec', recText(t)));
    return row;
  }

  function renderResults() {
    pic = NFL.Simulator.picture(L, state.locks); cert = NFL.Simulator.certainty(L, state.locks);
    var n = lockCount(), host = $('results'); host.innerHTML = '';
    [0, 1].forEach(function (c) {
      var panel = el('section', 'panel conf'), cf = pic.conf[c];
      var head = el('div', 'conf-head'); head.appendChild(el('h2', '', c ? 'NFC' : 'AFC'));
      var meta = el('div', 'meta'); meta.appendChild(el('small', '', n ? 'If your ' + n + ' result' + (n > 1 ? 's' : '') + ' happen' : 'Right now'));
      var fb = el('button', 'btn small', state.full ? 'Hide full standings' : 'Show full standings'); fb.type = 'button'; fb.setAttribute('aria-expanded', String(state.full));
      fb.addEventListener('click', function () { state.full = !state.full; save(); renderResults(); });
      meta.appendChild(fb); head.appendChild(meta); panel.appendChild(head);
      var wins = {}; cf.divWinners.forEach(function (w) { wins[w] = 1; });
      cf.seeds.forEach(function (t, i) {
        panel.appendChild(seedRow(t, i + 1, !!wins[t], noteFor(t, cf, !!wins[t])));
        if (i === 6) panel.appendChild(el('div', 'cut', 'Cut line'));
      });
      if (state.full) {
        cf.out.forEach(function (t, i) { var r = seedRow(t, i + 8, false, noteFor(t, cf, false)); r.classList.add('outrow'); panel.appendChild(r); });
      } else {
        var no = el('div', 'nextout'); no.appendChild(document.createTextNode('Next out: '));
        cf.out.slice(0, 3).forEach(function (t, i) { if (i) no.appendChild(document.createTextNode(', ')); no.appendChild(el('b', '', L.ids[t])); no.appendChild(document.createTextNode(' ' + recText(t))); });
        panel.appendChild(no);
      }
      var sub = el('div', 'sub'); sub.appendChild(el('span', '', 'Playoff odds'));
      if (c === 0) {
        var lb = el('label'), cb = el('input'); cb.type = 'checkbox'; cb.checked = state.showDelta; cb.disabled = !n;
        cb.addEventListener('change', function () { state.showDelta = cb.checked; save(); renderResults(); });
        lb.appendChild(cb); lb.appendChild(document.createTextNode('Show change vs. no locks')); sub.appendChild(lb);
      }
      panel.appendChild(sub);
      var box = el('div', 'oddsbox' + (oddsStale ? ' stale' : '')); box.appendChild(oddsTable(c)); panel.appendChild(box);
      host.appendChild(panel);
    });
  }

  /* Row order is fixed (initially the no-pick standings order) and only changes when a header is clicked. */
  function sortBy(c, col) {
    var cur = scenario || baseline; if (!cur) return;
    state.sortDir = state.sortKey === col.key ? -state.sortDir : -1; state.sortKey = col.key;
    var dir = state.sortDir;
    state.order[c] = state.order[c].slice().sort(function (x, y) {
      return dir * (col.get(cur.teams[x]) - col.get(cur.teams[y])) || cur.teams[y].playoffs - cur.teams[x].playoffs || x - y;
    });
    renderResults();
  }
  function initialOrder() {
    var p0 = NFL.Simulator.picture(L, L.remaining.map(function () { return 0; }));
    state.order = p0.conf.map(function (cf) { return cf.seeds.concat(cf.out); });
  }

  function oddsTable(c) {
    var cur = scenario || baseline;
    if (!cur) return el('div', 'pending', 'Simulating…');
    var delta = state.showDelta && scenario && baseline, bg = panelRgb();
    var tbl = el('table', 'odds'), cg = document.createElement('colgroup');
    cg.appendChild(el('col', 'c-team')); for (var i = 0; i < COLS.length; i++) cg.appendChild(el('col')); tbl.appendChild(cg);
    var thead = el('thead'), g1 = el('tr'); g1.appendChild(el('th', 'first', ''));
    var a = el('th', 'grp', 'Chance to'); a.colSpan = 3; g1.appendChild(a);
    var b = el('th', 'grp', 'Chance of landing seed'); b.colSpan = 7; g1.appendChild(b); thead.appendChild(g1);
    var hr = el('tr'); hr.appendChild(el('th', 'first', ''));
    COLS.forEach(function (col) {
      var th = el('th', 'sortable', col.label); th.title = 'Click to sort by ' + col.label + ' (click again to reverse). Order stays put until you sort again.';
      th.addEventListener('click', function () { sortBy(c, col); }); hr.appendChild(th);
    });
    thead.appendChild(hr); tbl.appendChild(thead);
    var teams = state.order[c];
    var tb = el('tbody');
    teams.forEach(function (t) {
      var tr = el('tr'), td = el('td', 'team blk'); paint(td, t); td.title = L.names[t] + ' (' + recText(t) + ')';
      td.appendChild(document.createTextNode(L.ids[t])); td.appendChild(el('small', '', recText(t))); tr.appendChild(td);
      COLS.forEach(function (col, ci) {
        var v = col.get(cur.teams[t]), st = statusFor(col, t), cell = el('td', 'cell' + (col.edge ? ' edge' : '') + (ci === COLS.length - 1 ? ' last' : ''));
        if (st === 'in') v = 1; else if (st === 'out') v = 0;
        var al = v < .0005 ? 0 : Math.min(.92, .12 + .8 * Math.sqrt(v)), fill = al ? blend(accent(t), bg, al * .9) : null;
        cell.style.background = fill ? css(fill) : 'var(--soft)';
        if (fill) { cell.style.color = onColor(fill); if (al > .4) cell.classList.add('hot'); }
        else cell.style.color = 'var(--muted)';
        cell.appendChild(el('span', 'v', pctStr(v, st)));
        if (delta) {
          var d = (v - col.get(baseline.teams[t])) * 100;
          if (Math.abs(d) >= 0.2) cell.appendChild(el('span', 'd ' + (d > 0 ? 'up' : 'down'), (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1)));
        }
        tr.appendChild(cell);
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); return tbl;
  }

  /* ---------- simulation orchestration ---------- */
  function cfgFor(locks) { return { pHome: pHome, locks: locks, tie: TIE / 100, n: ODDS.SIMS, seed: ODDS.SEED }; }
  function schedule() { clearTimeout(timer); timer = setTimeout(recompute, 250); }
  function recompute() {
    var id = ++runId, needScenario = lockCount() > 0, steps = (needScenario ? 1 : 0) + (baseline ? 0 : 1), done = 0;
    function cancelled() { return id !== runId; }
    function mk(locks) {
      var c = cfgFor(locks); c.cancelled = cancelled;
      c.onProgress = function (f) { $('progressBar').style.width = ((done + f) / Math.max(steps, 1) * 100) + '%'; }; return c;
    }
    function finish() { $('progressBar').style.width = '0'; oddsStale = false; renderResults(); }
    function scen() {
      if (!needScenario) { scenario = null; return finish(); }
      return NFL.Simulator.run(L, mk(state.locks.slice())).then(function (s) { if (cancelled()) return; scenario = s; finish(); });
    }
    if (baseline) return scen();
    NFL.Simulator.run(L, mk(L.remaining.map(function () { return 0; }))).then(function (b) {
      if (cancelled()) return; baseline = b; done = 1; if (!needScenario) renderResults(); return scen();
    });
  }
  function changed() {
    save(); if (!lockCount()) scenario = null; else oddsStale = true;
    renderTabs(); renderCards(); renderScenario(); renderResults(); schedule();
  }

  /* ---------- theme, dialog, init ---------- */
  function applyTheme() {
    var t = state.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    $('btnTheme').textContent = t === 'dark' ? '☀' : '☾';
  }
  function rerenderAll() { renderTabs(); renderCards(); renderScenario(); renderResults(); }
  function buildRules() {
    var body = $('rulesBody'); body.innerHTML = '';
    RULES.sections.forEach(function (s) {
      body.appendChild(el('h3', '', s.title));
      if (s.intro) body.appendChild(el('p', 'intro', s.intro));
      var ol = el('ol'); s.steps.forEach(function (x) { ol.appendChild(el('li', '', x)); }); body.appendChild(ol);
    });
    body.appendChild(el('h3', '', 'How this site applies them'));
    var ul = el('ul', 'notes'); RULES.notes.forEach(function (n) { ul.appendChild(el('li', '', n)); }); body.appendChild(ul);
  }

  /* index.html?check — shows how updates.js was read, including lines that were skipped */
  function renderCheck() {
    if (!/[?&]check\b/.test(location.search)) return;
    var box = el('section', 'panel checkbar'), bad = SEASON.problems.length;
    box.appendChild(el('h2', '', bad ? bad + ' line' + (bad > 1 ? 's' : '') + ' in updates.js could not be used' : 'updates.js read correctly ✓'));
    box.appendChild(el('p', 'muted', SEASON.counts.odds + ' odds entered · ' + SEASON.counts.finals + ' final scores · tie chance ' + SEASON.TIE_PCT + '% · ' + SEASON.SIMS.toLocaleString() + ' seasons'));
    var ul = el('ul'); SEASON.problems.forEach(function (p) {
      var li = el('li', 'bad'); li.appendChild(el('b', '', p.week ? 'Under WEEK ' + p.week + ': ' : ''));
      if (p.text) li.appendChild(el('code', '', p.text)); li.appendChild(document.createTextNode(' — ' + p.msg)); ul.appendChild(li);
    });
    SEASON.notes.forEach(function (n) { ul.appendChild(el('li', 'note', n)); });
    box.appendChild(ul); document.querySelector('.page').insertBefore(box, $('results'));
  }

  function init() {
    load(); applyTheme();
    $('asOf').textContent = '2026 NFL playoff odds · ' + SEASON.counts.finals + ' of ' + SEASON.totalOpen + ' games final since Week 11';
    $('footnote').textContent = 'Win probabilities are ESPN’s, entered by the site admin. ' + ODDS.SIMS.toLocaleString() +
      ' simulated seasons. Away win % = 100 − home win % − ' + TIE + '% tie chance. Seeds use the NFL’s official tiebreakers; net touchdowns is skipped (coin toss instead).';
    $('btnClear').addEventListener('click', function () { state.locks = state.locks.map(function () { return 0; }); changed(); });
    $('btnTheme').addEventListener('click', function () { state.theme = isDark() ? 'light' : 'dark'; save(); applyTheme(); rerenderAll(); });
    $('btnRules').addEventListener('click', function () { $('rulesDialog').showModal(); });
    $('btnRulesClose').addEventListener('click', function () { $('rulesDialog').close(); });
    $('rulesDialog').addEventListener('click', function (e) { if (e.target === this) this.close(); });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (!state.theme) { applyTheme(); rerenderAll(); } });
    $('stripPrev').addEventListener('click', function () { $('cards').scrollBy({ left: -480, behavior: 'smooth' }); });
    $('stripNext').addEventListener('click', function () { $('cards').scrollBy({ left: 480, behavior: 'smooth' }); });
    $('cards').addEventListener('scroll', updateNav); window.addEventListener('resize', updateNav);
    buildRules(); renderCheck();
    pic = NFL.Simulator.picture(L, state.locks); initialOrder();
    rerenderAll(); recompute();
  }
  init();
})();
