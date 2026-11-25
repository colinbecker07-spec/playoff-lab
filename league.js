/*
 * league.js — turns the static data into index-based typed structures the
 * simulator and tiebreakers can use quickly.
 *
 * League:
 *   n, ids[], names[], conf[] (0=AFC,1=NFC), div[] (0..7 global division index)
 *   G games: away[], home[], week[], isDiv[], isConf[], ap0[], hp0[] (base scores, 0 if unplayed), played[]
 *   teamGames[t] -> array of game indexes
 *   remaining[] -> game indexes of unplayed games, in schedule order
 *   confTeams[c] -> team indexes of that conference
 *   divTeams[d]  -> team indexes of that division
 */
(function (root) {
  'use strict';

  function build(data, results) {
    var teams = data.TEAMS, games = data.GAMES, FINAL = (results && results.FINAL) || {};
    var n = teams.length, G = games.length;
    var idx = {}, i;
    var L = {
      n: n, G: G, ids: [], names: [], conf: [], div: [], idx: idx,
      away: new Int16Array(G), home: new Int16Array(G), week: new Int16Array(G),
      isDiv: new Uint8Array(G), isConf: new Uint8Array(G), played: new Uint8Array(G),
      ap0: new Int16Array(G), hp0: new Int16Array(G),
      teamGames: [], remaining: [], confTeams: [[], []], divTeams: [],
      divLabels: [], keys: [], remIndex: new Int16Array(G).fill(-1), final: new Uint8Array(G)
    };
    var divIndex = {};
    teams.forEach(function (t, k) {
      idx[t.id] = k;
      L.ids.push(t.id); L.names.push(t.name);
      var c = t.conf === 'AFC' ? 0 : 1;
      var key = t.conf + ' ' + t.div;
      if (!(key in divIndex)) { divIndex[key] = L.divTeams.length; L.divTeams.push([]); L.divLabels.push(key); }
      L.conf.push(c); L.div.push(divIndex[key]);
      L.confTeams[c].push(k); L.divTeams[divIndex[key]].push(k);
      L.teamGames.push([]);
    });
    for (i = 0; i < G; i++) {
      var g = games[i];
      var a = idx[g[1]], h = idx[g[2]];
      if (a === undefined || h === undefined) throw new Error('Unknown team in game ' + JSON.stringify(g));
      L.away[i] = a; L.home[i] = h; L.week[i] = g[0];
      L.isDiv[i] = L.div[a] === L.div[h] ? 1 : 0;
      L.isConf[i] = L.conf[a] === L.conf[h] ? 1 : 0;
      L.teamGames[a].push(i); L.teamGames[h].push(i);
      var key = g[0] + '-' + g[1] + '-' + g[2]; L.keys.push(key);
      var sc = (g[3] === null || g[3] === undefined) ? FINAL[key] : [g[3], g[4]];
      if (sc && typeof sc[0] === 'number' && typeof sc[1] === 'number') { L.played[i] = 1; L.ap0[i] = sc[0]; L.hp0[i] = sc[1]; if (g[3] === null || g[3] === undefined) L.final[i] = 1; }
      else { L.remIndex[i] = L.remaining.length; L.remaining.push(i); }
    }
    return L;
  }

  /* Fresh per-simulation state. */
  function newState(L) {
    var n = L.n;
    return {
      ap: new Int16Array(L.G), hp: new Int16Array(L.G),
      w2: new Int16Array(n), gp: new Int16Array(n),
      pf: new Int32Array(n), pa: new Int32Array(n),
      divw2: new Int16Array(n), divg: new Int16Array(n),
      confw2: new Int16Array(n), confg: new Int16Array(n),
      sov: new Float64Array(n), sos: new Float64Array(n),
      rankConf: new Int16Array(n), rankAll: new Int16Array(n),
      rankConfDone: [0, 0], rankAllDone: 0,
      coin: Math.random, mask: null
    };
  }

  /* Derive standings stats from S.ap/S.hp (every game must have a score). */
  function finalize(L, S) { var mask = S.mask;
    S.w2.fill(0); S.gp.fill(0); S.pf.fill(0); S.pa.fill(0);
    S.divw2.fill(0); S.divg.fill(0); S.confw2.fill(0); S.confg.fill(0);
    S.sov.fill(-1); S.sos.fill(-1);
    S.rankConfDone[0] = 0; S.rankConfDone[1] = 0; S.rankAllDone = 0;
    for (var g = 0; g < L.G; g++) {
      if (mask && !mask[g]) continue;
      var a = L.away[g], h = L.home[g], x = S.ap[g], y = S.hp[g];
      var wa = x > y ? 2 : (x === y ? 1 : 0), wh = 2 - wa;
      S.w2[a] += wa; S.w2[h] += wh; S.gp[a]++; S.gp[h]++;
      S.pf[a] += x; S.pa[a] += y; S.pf[h] += y; S.pa[h] += x;
      if (L.isDiv[g]) { S.divw2[a] += wa; S.divw2[h] += wh; S.divg[a]++; S.divg[h]++; }
      if (L.isConf[g]) { S.confw2[a] += wa; S.confw2[h] += wh; S.confg[a]++; S.confg[h]++; }
    }
  }

  var api = { build: build, newState: newState, finalize: finalize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.NFL = root.NFL || {}).League = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
