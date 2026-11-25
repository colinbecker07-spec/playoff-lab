# Playoff Lab

A static site: no build step and no server code. Open `index.html`.

## Updating during the season — edit ONE file: `updates.js`

It holds a block of plain text. Under each `WEEK n` line:

    rams 67.2              odds: the HOME team and its win %
    packers 24, rams 17    final score (either team first)

- Add a final-score line when a game ends. That game is locked for visitors and counts in the standings
  and tiebreakers. When every game in a week has a final line, that week's tab disappears.
- Fix a mistake by editing its line. Reopen a game by deleting its final line.
- Settings (`tie chance`, `seasons`) are at the top of the block.
- Open `index.html?check` to see whether every line was read, and which ones were skipped.

Upload the edited `updates.js` to your host. Visitors' saved picks are stored per game, so they survive updates.

## Files (all in one folder)

- `updates.js` – the only file you edit
- `updates-parser.js` – reads that text
- `data.js` – teams, Weeks 1–11 results, full schedule
- `league.js`, `tiebreakers.js`, `simulator.js` – engine
- `app.js`, `colors.js`, `rules.js`, `styles.css`, `index.html` – the site
