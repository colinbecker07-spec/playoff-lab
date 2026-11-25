/*
 * simulator.js — Monte Carlo engine.
 *
 * run(league, cfg) -> Promise<Results>
 *   cfg.pHome[j]  : home win % (0-100) of remaining game j; away = 100 - home - tie
 *   cfg.locks[j]  : 0 none, 1 away win, 2 tie, 3 home win
 *   cfg.tie       : tie probability for every unlocked game (0-1)
 *   cfg.n         : number of simulated seasons
 *   cfg.seed      : integer seed; the same seed gives the same random draws for baseline and
 *                   scenario runs (common random numbers) so differences come from the locks.
 *   cfg.onProgress(fraction)
 *
 * Results: { n, teams: [ { playoffs, division, bye, seeds: [p1..p7] } ] } indexed by team idx (fractions 0-1)
 */
(function (root) {
  'use strict';
  var Lg = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./league.js') : root.NFL.League;
  var Tb = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./tiebreakers.js') : root.NFL.Tiebreakers;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(u1, u2) { return Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2); }

  var MARGIN_SD = 14, TOTAL_MEAN = 45, TOTAL_SD = 10;

  function createSession(L, cfg) {
    var S = Lg.newState(L), tb = Tb.create(L);
    tb.setState(S);
    var rem = L.remaining, R = rem.length;
    var pA = new Float64Array(R), pT = new Float64Array(R), lock = new Uint8Array(R);
    for (var j = 0; j < R; j++) {
      var tie = cfg.tie || 0, h = (cfg.pHome[j] === undefined ? (100 - tie * 100) / 2 : cfg.pHome[j]) / 100;
      pT[j] = tie; pA[j] = Math.max(0, 1 - h - tie);
      lock[j] = (cfg.locks && cfg.locks[j]) || 0;
    }
    var n = L.n;
    var acc = {
      playoffs: new Float64Array(n), division: new Float64Array(n), bye: new Float64Array(n),
      seeds: new Float64Array(n * 7), done: 0
    };

    function oneSeason(i) {
      var rnd = mulberry32((cfg.seed | 0) ^ Math.imul(i + 1, 0x9E3779B1));
      S.coin = mulberry32(((cfg.seed | 0) + 0x51ED27) ^ Math.imul(i + 1, 0x85EBCA6B));
      S.ap.set(L.ap0); S.hp.set(L.hp0);
      for (var k = 0; k < R; k++) {
        // Always draw 5 randoms per game so streams stay aligned whatever the lock.
        var u0 = rnd(), u1 = rnd(), u2 = rnd(), u3 = rnd(), u4 = rnd();
        var o = lock[k];
        if (!o) o = u0 < pA[k] ? 1 : (u0 < pA[k] + pT[k] ? 2 : 3);
        var g = rem[k], ap, hp;
        if (o === 2) {
          ap = hp = Math.max(3, Math.round((TOTAL_MEAN + TOTAL_SD * gauss(u3, u4)) / 2));
        } else {
          var m = Math.max(1, Math.round(Math.abs(gauss(u1, u2)) * MARGIN_SD));
          var T = TOTAL_MEAN + TOTAL_SD * gauss(u3, u4);
          var win = Math.max(m, Math.round((T + m) / 2)), lose = win - m;
          if (o === 1) { ap = win; hp = lose; } else { ap = lose; hp = win; }
        }
        S.ap[g] = ap; S.hp[g] = hp;
      }
      Lg.finalize(L, S);
      for (var c = 0; c < 2; c++) {
        var res = tb.seedConference(c), s;
        for (s = 0; s < 7; s++) {
          var t = res.seeds[s];
          acc.playoffs[t]++; acc.seeds[t * 7 + s]++;
          if (s === 0) acc.bye[t]++;
        }
        for (s = 0; s < res.divWinners.length; s++) acc.division[res.divWinners[s]]++;
      }
    }

    function result() {
      var N = acc.done || 1, out = { n: acc.done, teams: [] };
      for (var t = 0; t < n; t++) {
        var seeds = [];
        for (var s = 0; s < 7; s++) seeds.push(acc.seeds[t * 7 + s] / N);
        out.teams.push({
          playoffs: acc.playoffs[t] / N, division: acc.division[t] / N,
          bye: acc.bye[t] / N, seeds: seeds
        });
      }
      return out;
    }
    return { oneSeason: oneSeason, acc: acc, result: result, state: S, tb: tb };
  }

  function runSync(L, cfg) {
    var s = createSession(L, cfg);
    for (var i = 0; i < cfg.n; i++) { s.oneSeason(i); s.acc.done++; }
    return s.result();
  }

  function run(L, cfg) {
    return new Promise(function (resolve) {
      var s = createSession(L, cfg), i = 0, CHUNK = 250;
      function step() {
        var end = Math.min(cfg.n, i + CHUNK);
        for (; i < end; i++) { s.oneSeason(i); s.acc.done++; }
        if (cfg.onProgress) cfg.onProgress(i / cfg.n);
        if (i < cfg.n && !(cfg.cancelled && cfg.cancelled())) setTimeout(step, 0);
        else resolve(s.result());
      }
      step();
    });
  }

  /*
   * Playoff picture "right now": played games plus the locked results; unlocked games are ignored.
   * Locked games have no score, so points-based tiebreakers use a nominal score (24-17 for a win, 20-20 tie).
   * Returns { conf: [afc, nfc], rec: [[w,l,t]...] } where each conf = { seeds, out, divWinners, divReasons, seedReasons }.
   */
  function picture(L, locks) {
    var S = Lg.newState(L), tb = Tb.create(L), rem = L.remaining, j, g;
    S.coin = mulberry32(777); tb.setState(S);
    S.mask = new Uint8Array(L.played);
    S.ap.set(L.ap0); S.hp.set(L.hp0);
    for (j = 0; j < rem.length; j++) {
      var o = locks && locks[j]; if (!o) continue;
      g = rem[j]; S.mask[g] = 1;
      if (o === 1) { S.ap[g] = 24; S.hp[g] = 17; } else if (o === 3) { S.ap[g] = 17; S.hp[g] = 24; } else { S.ap[g] = S.hp[g] = 20; }
    }
    Lg.finalize(L, S);
    var rec = [];
    for (var t = 0; t < L.n; t++) { var w = Math.floor(S.w2[t] / 2), ti = S.w2[t] % 2, gp = S.gp[t]; rec.push([w, gp - w - ti, ti]); }
    // ties come in pairs of half-wins, so recompute exactly
    var exact = L.ids.map(function () { return [0, 0, 0]; });
    for (g = 0; g < L.G; g++) {
      if (!S.mask[g]) continue;
      var a = L.away[g], h = L.home[g];
      if (S.ap[g] > S.hp[g]) { exact[a][0]++; exact[h][1]++; } else if (S.ap[g] < S.hp[g]) { exact[h][0]++; exact[a][1]++; } else { exact[a][2]++; exact[h][2]++; }
    }
    return { conf: [tb.seedConference(0, true), tb.seedConference(1, true)], rec: exact };
  }

  /*
   * Mathematical certainty, proven from win counts alone (conservative: it only claims a guarantee
   * or an impossibility when no combination of the unlocked remaining games could change it).
   * Anything not provable stays "unknown" and the UI shows >99.9% / <0.1% instead of 100% / 0%.
   * Returns, per team: { po, div, seed:[7] } with values 'in' (guaranteed), 'out' (impossible) or null.
   */
  function certainty(L, locks) {
    var n = L.n, minW = new Int16Array(n), maxW = new Int16Array(n), j, g, t;
    var free = new Int16Array(n);
    for (g = 0; g < L.G; g++) {
      var a = L.away[g], h = L.home[g];
      if (L.played[g]) {
        var wa = L.ap0[g] > L.hp0[g] ? 2 : (L.ap0[g] === L.hp0[g] ? 1 : 0); minW[a] += wa; minW[h] += 2 - wa;
      }
    }
    for (j = 0; j < L.remaining.length; j++) {
      g = L.remaining[j]; var o = locks && locks[j];
      if (o === 1) minW[L.away[g]] += 2; else if (o === 3) minW[L.home[g]] += 2;
      else if (o === 2) { minW[L.away[g]] += 1; minW[L.home[g]] += 1; }
      else { free[L.away[g]]++; free[L.home[g]]++; }
    }
    for (t = 0; t < n; t++) maxW[t] = minW[t] + 2 * free[t];
    var out = [];
    for (t = 0; t < n; t++) {
      var conf = L.conf[t], mates = L.confTeams[conf].filter(function (x) { return x !== t; });
      var rivals = L.divTeams[L.div[t]].filter(function (x) { return x !== t; });
      var divOut = rivals.some(function (r) { return minW[r] > maxW[t]; });
      var divIn = rivals.every(function (r) { return minW[t] > maxW[r]; });
      var A = mates.filter(function (x) { return minW[x] > maxW[t]; });
      var perDiv = {}; A.forEach(function (x) { perDiv[L.div[x]] = (perDiv[L.div[x]] || 0) + 1; });
      var nonWinnersAhead = 0, m = 0;
      Object.keys(perDiv).forEach(function (d) { nonWinnersAhead += Math.max(0, perDiv[d] - 1); if (+d !== L.div[t]) m++; });
      var B = mates.filter(function (x) { return maxW[x] >= minW[t]; });
      var poOut = divOut && nonWinnersAhead >= 3;
      var poIn = divIn || B.length <= 2;
      var top = mates.every(function (x) { return minW[t] > maxW[x]; });
      var seed = [null, null, null, null, null, null, null];
      for (var k = 0; k < 7; k++) {
        if (poOut) seed[k] = 'out';
        else if (k < 4 && (divOut || k < m)) seed[k] = 'out';
        else if (k >= 4 && divIn) seed[k] = 'out';
      }
      if (top) seed[0] = 'in';
      out.push({ po: poOut ? 'out' : (poIn ? 'in' : null), div: divOut ? 'out' : (divIn ? 'in' : null), seed: seed });
    }
    return out;
  }

  var api = { certainty: certainty, picture: picture, run: run, runSync: runSync, createSession: createSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.NFL = root.NFL || {}).Simulator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
