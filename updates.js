/*
 * updates.js — THE ONLY FILE YOU EDIT during the season.
 *
 * Everything between the two backticks ( ` ) below is plain text.
 *
 *   WEEK 12            Starts a week. Every line below it belongs to that week.
 *   rams 67.2          ODDS: the HOME team and its win %. (The away team gets 100 - home - tie chance.)
 *   packers 24, rams 17   FINAL SCORE: the two teams and their scores, in either order.
 *                      Add one when a game ends. That game is then locked for visitors, and when every
 *                      game in a week has a final line, that week's tab disappears.
 *   # anything         A line starting with # is a note to yourself and is ignored.
 *
 * Fix a mistake by editing its line. Reopen a game by deleting its final-score line.
 * Team names can be abbreviations (LAR), nicknames (rams) or full names (Los Angeles Rams).
 * Check your work by opening index.html?check (type ?check on the end of the page address). It lists
 * any line it could not read, and under which WEEK it was.
 */
var UPDATES = `

# ---------- Settings ----------
tie chance: 0.3
seasons: 20000

# ---------- Week 12 ----------
WEEK 12
rams 67.2
lions 55.3
cowboys 82.9
bills 53.1
steelers 38.4
texans 83.4
bengals 80.7
dolphins 30.4
vikings 80.2
colts 52.8
jaguars 89.4
chargers 59.3
49ers 68.3
cardinals 37.2
browns 67.5
buccaneers 67.3
# finals (add lines like  packers 24, rams 17  here)
packers 13, rams 26
bears 39, lions 35
eagles 39, cowboys 38
chiefs 10, bills 13
broncos 5, steelers 27

# ---------- Week 13 ----------
WEEK 13
rams 54.3
falcons 20.0
bears 47.4
browns 20.1
saints 35.4
giants 17.4
titans 36.8
buccaneers 69.6
cardinals 52.5
broncos 91.7
vikings 69.2
patriots 14.7
steelers 37
seahawks 59.5
# finals (add lines like  packers 24, rams 17  here)

# ---------- Week 14 ----------
WEEK 14
patriots 24.7
ravens 34.8
panthers 59.3
browns 57.3
lions 86
dolphins 14.5
jets 29.3
eagles 40.8
commanders 36
raiders 34.3
bengals 47.5
seahawks 76.8
49ers 60.3
packers 37.5
jaguars 77.3
# finals (add lines like  packers 24, rams 17  here)

# ---------- Week 15 ----------
WEEK 15
chargers 17.3
eagles 19.2
bills 62.9
panthers 29.8
packers 81.5
texans 45.7
giants 62.8
titans 41.3
steelers 62.4
buccaneers 71.3
commanders 68.2
cardinals 48.5
raiders 18.1
rams 67.7
vikings 49
chiefs 89.3
# finals (add lines like  packers 24, rams 17  here)

# ---------- Week 16 ----------
WEEK 16
eagles 22.3
bears 61.9
broncos 40.5
seahawks 45.9
ravens 57.9
dolphins 38.4
saints 65.6
jets 52.7
raiders 46.9
chiefs 46.9
cowboys 42.9
lions 76.3
falcons 27.1
colts 26.2
vikings 69.2
steelers 56.1
# finals (add lines like  packers 24, rams 17  here)

# ---------- Week 17 ----------
WEEK 17
bengals 81
falcons 44.6
panthers 31.6
browns 47
cowboys 71.7
jaguars 77.9
dolphins 13.5
patriots 30.1
jets 28.4
titans 34.7
chargers 22.6
buccaneers 36.6
cardinals 60.2
bears 54.4
49ers 92
packers 48.4
# finals (add lines like  packers 24, rams 17  here)

# ---------- Week 18 ----------
WEEK 18
bills 86.3
panthers 67.5
bengals 84.4
colts 24.6
cardinals 10.3
broncos 72.3
packers 45.2
texans 83.4
chiefs 92.4
vikings 49.4
saints 35.8
patriots 63.3
giants 66.9
rams 62
ravens 44.9
commanders 38
# finals (add lines like  packers 24, rams 17  here)
`;

/* (leave this line alone) */
if (typeof module !== 'undefined' && module.exports) module.exports = UPDATES;
