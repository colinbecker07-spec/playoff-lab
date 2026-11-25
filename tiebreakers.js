/*
 * tiebreakers.js — NFL official tiebreaking procedures (nfl.com/standings/tie-breaking-procedures).
 *
 * Division, 2 clubs : h2h, division record, common games, conference record, SOV, SOS,
 *                     conf rank (PF+PA), all rank (PF+PA), net pts common, net pts all, net TDs, coin.
 * Division, 3+ clubs: h2h sweep, then same steps.
 * Wild card, 2 clubs: h2h, conference record, common games (min 4), SOV, SOS, conf rank, all rank,
 *                     net pts conference, net pts all, net TDs, coin.
 * Wild card, 3+ clubs: reduce to the best club per division first, then h2h sweep, then same steps.
 *
 * Rules implemented:
 *  - Only one club advances per procedure; when clubs are eliminated and two remain, the
 *    procedure restarts at step 1 of the two-club format. With three or more remaining, it continues.
 *  - To rank multiple spots, the best club is removed and the procedure restarts for the rest.
 *  - Ties count as half a win.
 * Simplification: "net touchdowns" is not tracked; that step is skipped (falls through to the coin toss).
 *
 * All functions operate on the state object from league.js (finalize() must have been called).
 */
(function (root) {
  'use strict';

  function create(L) {
    var S = null;

    function setState(s) { S = s; }

    /* ---------- low-level game aggregation ---------- */
    // Aggregate team t's games for which keep(g, opp) is true -> [halfWins, games, pointDiff]
    function agg(t, keep) {
      var w2 = 0, n = 0, diff = 0, tg = L.teamGames[t];
      for (var k = 0; k < tg.length; k++) {
        var g = tg[k], away = L.away[g] === t;
        if (S.mask && !S.mask[g]) continue;
        var opp = away ? L.home[g] : L.away[g];
        if (keep && !keep(g, opp)) continue;
        var pf = away ? S.ap[g] : S.hp[g], pa = away ? S.hp[g] : S.ap[g];
        w2 += pf > pa ? 2 : (pf === pa ? 1 : 0);
        diff += pf - pa; n++;
      }
      return [w2, n, diff];
    }

    function oppSet(t) {
      var set = {}, tg = L.teamGames[t];
      for (var k = 0; k < tg.length; k++) {
        var g = tg[k];
        if (S.mask && !S.mask[g]) continue;
        set[L.away[g] === t ? L.home[g] : L.away[g]] = 1;
      }
      return set;
    }

    function pct(w2, n) { return n ? w2 / (2 * n) : 0; }

    /* Keep only entries of g whose value equals the maximum. */
    function keepMax(g, vals) {
      var best = -Infinity, i, out = [];
      for (i = 0; i < vals.length; i++) if (vals[i] > best + 1e-12) best = vals[i];
      for (i = 0; i < g.length; i++) if (vals[i] >= best - 1e-12) out.push(g[i]);
      return out;
    }

    /* ---------- lazily computed per-sim metrics ---------- */
    function sovOf(t) {
      if (S.sov[t] >= 0) return S.sov[t];
      var num = 0, den = 0, tg = L.teamGames[t];
      for (var k = 0; k < tg.length; k++) {
        var g = tg[k], away = L.away[g] === t;
        if (S.mask && !S.mask[g]) continue;
        var pf = away ? S.ap[g] : S.hp[g], pa = away ? S.hp[g] : S.ap[g];
        if (pf > pa) { var o = away ? L.home[g] : L.away[g]; num += S.w2[o]; den += 2 * S.gp[o]; }
      }
      return (S.sov[t] = den ? num / den : 0);
    }
    function sosOf(t) {
      if (S.sos[t] >= 0) return S.sos[t];
      var num = 0, den = 0, tg = L.teamGames[t];
      for (var k = 0; k < tg.length; k++) {
        var g = tg[k], o = L.away[g] === t ? L.home[g] : L.away[g];
        if (S.mask && !S.mask[g]) continue;
        num += S.w2[o]; den += 2 * S.gp[o];
      }
      return (S.sos[t] = den ? num / den : 0);
    }

    // Competition ranking of PF (high is good) and PA (low is good) within `pool`.
    function computeRanks(pool, out) {
      var pfRank = {}, paRank = {}, i, j;
      for (i = 0; i < pool.length; i++) {
        var a = pool[i], r1 = 1, r2 = 1;
        for (j = 0; j < pool.length; j++) {
          var b = pool[j];
          if (S.pf[b] > S.pf[a]) r1++;
          if (S.pa[b] < S.pa[a]) r2++;
        }
        out[a] = r1 + r2;
      }
    }
    function rankConfOf(t) {
      var c = L.conf[t];
      if (!S.rankConfDone[c]) { computeRanks(L.confTeams[c], S.rankConf); S.rankConfDone[c] = 1; }
      return S.rankConf[t];
    }
    var ALL = null;
    function rankAllOf(t) {
      if (!S.rankAllDone) {
        if (!ALL) { ALL = []; for (var i = 0; i < L.n; i++) ALL.push(i); }
        computeRanks(ALL, S.rankAll); S.rankAllDone = 1;
      }
      return S.rankAll[t];
    }

    /* ---------- steps: each takes a group (array of team idx) and returns survivors ---------- */
    function stepH2H(g) {
      var i, j, t;
      if (g.length === 2) {
        var a = g[0], b = g[1];
        var r = agg(a, function (_, o) { return o === b; });
        if (r[1] === 0 || r[0] === r[1]) return g;
        return r[0] > r[1] ? [a] : [b];
      }
      // 3+ clubs: sweep rule. A club wins the step only if it beat every other club;
      // clubs that lost to every other club are eliminated. Everyone must have played everyone.
      var inGroup = {};
      for (i = 0; i < g.length; i++) inGroup[g[i]] = 1;
      var sweepWin = [], sweepLose = [];
      for (i = 0; i < g.length; i++) {
        t = g[i];
        var opps = oppSet(t), played = true;
        for (j = 0; j < g.length; j++) if (g[j] !== t && !opps[g[j]]) played = false;
        if (!played) continue;
        var rr = agg(t, function (_, o) { return inGroup[o] === 1; });
        if (rr[1] > 0 && rr[0] === 2 * rr[1]) sweepWin.push(t);
        else if (rr[1] > 0 && rr[0] === 0) sweepLose.push(t);
      }
      if (sweepWin.length === 1) return sweepWin;
      if (sweepLose.length) {
        var rest = g.filter(function (x) { return sweepLose.indexOf(x) < 0; });
        if (rest.length) return rest;
      }
      return g;
    }

    function stepDivRecord(g) {
      return keepMax(g, g.map(function (t) { return pct(S.divw2[t], S.divg[t]); }));
    }
    function stepConfRecord(g) {
      return keepMax(g, g.map(function (t) { return pct(S.confw2[t], S.confg[t]); }));
    }

    function commonOpps(g) {
      var inGroup = {}, i, k, common = null;
      for (i = 0; i < g.length; i++) inGroup[g[i]] = 1;
      for (i = 0; i < g.length; i++) {
        var s = oppSet(g[i]), next = {};
        for (k in s) if (!inGroup[k] && (common === null || common[k])) next[k] = 1;
        common = next;
      }
      return common || {};
    }
    function stepCommon(min) {
      return function (g) {
        var common = commonOpps(g);
        var res = g.map(function (t) { return agg(t, function (_, o) { return common[o] === 1; }); });
        // minimum number of common games (counted for the first club; all clubs share common opponents)
        if (res[0][1] < min || res[0][1] === 0) return g;
        for (var i = 0; i < res.length; i++) if (res[i][1] === 0) return g;
        return keepMax(g, res.map(function (r) { return pct(r[0], r[1]); }));
      };
    }
    function stepSOV(g) { return keepMax(g, g.map(sovOf)); }
    function stepSOS(g) { return keepMax(g, g.map(sosOf)); }
    function stepRankConf(g) { return keepMax(g, g.map(function (t) { return -rankConfOf(t); })); }
    function stepRankAll(g) { return keepMax(g, g.map(function (t) { return -rankAllOf(t); })); }
    function stepNetCommon(g) {
      var common = commonOpps(g);
      return keepMax(g, g.map(function (t) { return agg(t, function (_, o) { return common[o] === 1; })[2]; }));
    }
    function stepNetConf(g) {
      return keepMax(g, g.map(function (t) { return agg(t, function (gi) { return L.isConf[gi] === 1; })[2]; }));
    }
    function stepNetAll(g) { return keepMax(g, g.map(function (t) { return S.pf[t] - S.pa[t]; })); }
    function stepCoin(g) {
      var best = -1, pick = g[0];
      for (var i = 0; i < g.length; i++) { var r = S.coin(); if (r > best) { best = r; pick = g[i]; } }
      return [pick];
    }

    function named(name, fn) { fn.stepName = name; return fn; }
    named('Head-to-head', stepH2H); named('Division record', stepDivRecord); named('Conference record', stepConfRecord);
    named('Strength of victory', stepSOV); named('Strength of schedule', stepSOS);
    named('Conference rank (points scored + allowed)', stepRankConf); named('League rank (points scored + allowed)', stepRankAll);
    named('Net points in common games', stepNetCommon); named('Net points in conference games', stepNetConf);
    named('Net points in all games', stepNetAll); named('Coin toss', stepCoin);
    var common0 = named('Common games', stepCommon(0)), common4 = named('Common games (min. 4)', stepCommon(4));
    var DIV_STEPS = [stepH2H, stepDivRecord, common0, stepConfRecord, stepSOV, stepSOS,
      stepRankConf, stepRankAll, stepNetCommon, stepNetAll, stepCoin];
    var WC_STEPS = [stepH2H, stepConfRecord, common4, stepSOV, stepSOS,
      stepRankConf, stepRankAll, stepNetConf, stepNetAll, stepCoin];

    var lastStep = '';
    function runSteps(group, steps) {
      var g = group.slice(), i = 0;
      while (g.length > 1 && i < steps.length) {
        var prev = g.length;
        g = steps[i](g);
        lastStep = steps[i].stepName;
        i++;
        if (g.length > 1 && g.length < prev && g.length === 2) i = 0; // revert to two-club procedure
      }
      return g[0];
    }

    /* Best club of a tied group. kind: 'div' or 'wc'. */
    function pickBest(group, kind) {
      if (group.length === 1) return group[0];
      if (kind === 'div') return runSteps(group, DIV_STEPS);
      // Wild card: first reduce to the best club of each division.
      var byDiv = {}, order = [], i;
      for (i = 0; i < group.length; i++) {
        var d = L.div[group[i]];
        if (!byDiv[d]) { byDiv[d] = []; order.push(d); }
        byDiv[d].push(group[i]);
      }
      var reduced = order.map(function (d) { return pickBest(byDiv[d], 'div'); });
      return runSteps(reduced, WC_STEPS);
    }

    /*
     * Order `teams` by record, resolving ties with the given procedure.
     * Stops once `need` clubs have been placed (default: all).
     */
    function pctOf(t) { return S.gp[t] ? S.w2[t] / (2 * S.gp[t]) : 0; }
    function samePct(a, b) { return S.w2[a] * S.gp[b] === S.w2[b] * S.gp[a]; }
    function orderTeams(teams, kind, need, reasons) {
      var sorted = teams.slice().sort(function (a, b) { return pctOf(b) - pctOf(a); });
      var out = [], i = 0;
      need = need || sorted.length;
      while (i < sorted.length && out.length < need) {
        var j = i;
        while (j < sorted.length && samePct(sorted[j], sorted[i])) j++;
        var rem = sorted.slice(i, j);
        while (rem.length && out.length < need) {
          lastStep = '';
          var b = pickBest(rem, kind);
          if (reasons && rem.length > 1) reasons[b] = { step: lastStep, over: rem.filter(function (x) { return x !== b; }) };
          out.push(b);
          rem.splice(rem.indexOf(b), 1);
        }
        i = j;
      }
      return out;
    }

    /*
     * Playoff seeding for one conference.
     * Returns { seeds: [t1..t7], divWinners: [t..] } (team indexes).
     */
    function seedConference(c, full) {
      var divs = [], d;
      for (d = 0; d < L.divTeams.length; d++) {
        if (L.conf[L.divTeams[d][0]] === c) divs.push(L.divTeams[d]);
      }
      var divReasons = {}, seedReasons = {};
      var winners = divs.map(function (dt) { return orderTeams(dt, 'div', 1, divReasons)[0]; });
      var isWinner = {};
      winners.forEach(function (w) { isWinner[w] = 1; });
      var seeded = orderTeams(winners, 'wc', 0, seedReasons);
      var pool = L.confTeams[c].filter(function (t) { return !isWinner[t]; });
      var wild = orderTeams(pool, 'wc', full ? 0 : 3, seedReasons);
      var res = { seeds: seeded.slice(0, 4).concat(wild.slice(0, 3)), divWinners: winners };
      if (full) { res.out = wild.slice(3); res.divReasons = divReasons; res.seedReasons = seedReasons; }
      return res;
    }

    return {
      setState: setState, pickBest: pickBest, orderTeams: orderTeams, seedConference: seedConference
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.NFL = root.NFL || {}).Tiebreakers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
