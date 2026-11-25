/*
 * updates-parser.js — reads the plain-text block in updates.js.
 *
 * Understands (case and extra spaces do not matter, "#" starts a comment):
 *   WEEK 12                    -> the lines below belong to week 12
 *   rams 67.2                  -> home team's win % for its game that week
 *   packers 24, rams 17        -> final score (either order, home or away)
 *   tie chance: 0.3            -> settings
 *   seasons: 20000
 * Anything it cannot read is skipped and listed in `problems` (shown by opening index.html?check).
 */
(function (root) {
  'use strict';

  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function buildLookup(teams) {
    var map = {}, cityCount = {};
    teams.forEach(function (t) { var c = norm(t.name.split(' ').slice(0, -1).join(' ')); cityCount[c] = (cityCount[c] || 0) + 1; });
    teams.forEach(function (t) {
      var parts = t.name.split(' '), nick = parts[parts.length - 1], city = norm(parts.slice(0, -1).join(' '));
      [t.id, t.name, nick].forEach(function (k) { map[norm(k)] = t.id; });
      if (cityCount[city] === 1 && !map[city]) map[city] = t.id;
    });
    map.washington = 'WSH'; map.niners = 'SF'; map.sf49ers = 'SF';
    return map;
  }

  function parse(text, data) {
    var TIE_DEFAULT = 0.3;
    var out = { TIE_PCT: TIE_DEFAULT, SIMS: 20000, SEED: 20261124, PLACEHOLDER: 0, HOME_WIN_PCT: {}, FINAL: {}, problems: [], notes: [], counts: { odds: 0, finals: 0 } };
    var lookup = buildLookup(data.TEAMS);
    var open = data.GAMES.filter(function (g) { return g[3] === null; });
    var tieSeen = null, week = null, weekOdds = {}, lines = String(text || '').split(/\r?\n/);

    function problem(n, raw, msg) { out.problems.push({ line: n, week: week, text: raw.trim(), msg: msg }); }
    function gamesIn(w) { return open.filter(function (g) { return g[0] === w; }); }

    lines.forEach(function (raw, i) {
      var n = i + 1, line = raw.replace(/#.*$/, '').trim();
      if (!line) return;
      var m;

      if ((m = line.match(/^(tie(?:\s*chance)?|seasons|simulations)\s*[:=]\s*(\d+(?:\.\d+)?)\s*%?$/i))) {
        var v = parseFloat(m[2]);
        if (/^tie/i.test(m[1])) { if (v >= 0 && v <= 5) tieSeen = v; else problem(n, raw, 'Tie chance must be between 0 and 5.'); }
        else if (v >= 1000) out.SIMS = Math.round(v); else problem(n, raw, 'Seasons must be at least 1000.');
        return;
      }

      if ((m = line.match(/^week\s*(\d+)\s*:?$/i))) {
        week = parseInt(m[1], 10);
        if (!gamesIn(week).length) problem(n, raw, 'Week ' + week + ' has no games left to enter.');
        weekOdds[week] = weekOdds[week] || {};
        return;
      }

      if (week === null) { problem(n, raw, 'Put a "WEEK 12"-style line above this one first.'); return; }
      var wg = gamesIn(week);

      // final score: "packers 24, rams 17"
      if ((m = line.match(/^(.+?)[\s:]+(\d+)\s*[,;]\s*(.+?)[\s:]+(\d+)\s*(?:\(.*\))?$/))) {
        var t1 = lookup[norm(m[1])], t2 = lookup[norm(m[3])];
        if (!t1) return problem(n, raw, 'Unknown team "' + m[1].trim() + '".');
        if (!t2) return problem(n, raw, 'Unknown team "' + m[3].trim() + '".');
        var g = wg.filter(function (x) { return (x[1] === t1 && x[2] === t2) || (x[1] === t2 && x[2] === t1); })[0];
        if (!g) return problem(n, raw, t1 + ' and ' + t2 + ' do not play each other in Week ' + week + '.');
        var s1 = parseInt(m[2], 10), s2 = parseInt(m[4], 10), key = g[0] + '-' + g[1] + '-' + g[2];
        if (out.FINAL[key]) problem(n, raw, 'This game already has a final score above; using this one.');
        out.FINAL[key] = g[1] === t1 ? [s1, s2] : [s2, s1];
        return;
      }

      // odds: "rams 67.2"
      if ((m = line.match(/^(.*?)[\s:=]+(\d+(?:\.\d+)?)\s*%?$/))) {
        var id = lookup[norm(m[1])];
        if (!id) return problem(n, raw, 'Unknown team "' + m[1].trim() + '".');
        var hg = wg.filter(function (x) { return x[2] === id; })[0];
        if (!hg) {
          var ag = wg.filter(function (x) { return x[1] === id; })[0];
          return problem(n, raw, ag ? id + ' is the AWAY team in Week ' + week + ' (at ' + ag[2] + '). Odds lines use the HOME team.' : id + ' has no game in Week ' + week + '.');
        }
        var val = parseFloat(m[2]), k2 = hg[0] + '-' + hg[1] + '-' + hg[2];
        if (val > 100) return problem(n, raw, 'Win % must be between 0 and 100.');
        if (weekOdds[week][k2] !== undefined) problem(n, raw, 'This game already has odds above; using this one.');
        weekOdds[week][k2] = val; out.HOME_WIN_PCT[k2] = val;
        return;
      }

      problem(n, raw, 'Could not read this line. Use "rams 67.2" for odds or "packers 24, rams 17" for a final.');
    });

    if (tieSeen !== null) out.TIE_PCT = tieSeen;
    out.PLACEHOLDER = (100 - out.TIE_PCT) / 2;
    // home win % must leave room for the tie chance
    Object.keys(out.HOME_WIN_PCT).forEach(function (k) {
      if (out.HOME_WIN_PCT[k] > 100 - out.TIE_PCT) { out.problems.push({ line: 0, text: k, msg: 'Home win % ' + out.HOME_WIN_PCT[k] + ' is too high with a ' + out.TIE_PCT + '% tie chance; using ' + (100 - out.TIE_PCT) + '.' }); out.HOME_WIN_PCT[k] = 100 - out.TIE_PCT; }
    });
    // notes: weeks with open games that still have no odds
    var byWeek = {};
    open.forEach(function (g) {
      var k = g[0] + '-' + g[1] + '-' + g[2];
      if (!out.FINAL[k] && out.HOME_WIN_PCT[k] === undefined) byWeek[g[0]] = (byWeek[g[0]] || 0) + 1;
    });
    Object.keys(byWeek).forEach(function (w) { out.notes.push('Week ' + w + ': ' + byWeek[w] + ' open game' + (byWeek[w] > 1 ? 's' : '') + ' with no odds yet (using an even split).'); });
    out.counts.odds = Object.keys(out.HOME_WIN_PCT).length; out.counts.finals = Object.keys(out.FINAL).length;
    out.totalOpen = open.length;
    return out;
  }

  var api = { parse: parse, buildLookup: buildLookup, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.NFL = root.NFL || {}).Updates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
