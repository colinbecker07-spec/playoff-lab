/*
 * rules.js — the NFL tiebreaker procedures shown in the "Tiebreaker rules" dialog.
 * Source: NFL.com "Tie-Breaking Procedures". Edit text here; the UI renders it as-is.
 */
(function (root) {
  'use strict';
  var api = {
    notes: [
      'Ties count as a half win and a half loss when computing percentages.',
      'Only one club advances at each step. When a step eliminates clubs and two remain, the procedure restarts at step 1 of the two-club list. If three or more remain, it continues with the next step.',
      'After a club wins a tie for a spot, the remaining tied clubs start the procedure over from step 1 for the next spot.',
      'Division winners are seeded #1–#4 by record, using the wild-card procedure for ties. Wild cards fill #5–#7 from non-division-winners. Only the #1 seed gets a first-round bye.',
      'This site does not track net touchdowns. When all earlier steps tie, that step is skipped and the coin toss decides.'
    ],
    sections: [
      {
        title: 'Division tie, two clubs',
        steps: [
          'Head-to-head (best won-lost-tied percentage in games between the clubs).',
          'Best won-lost-tied percentage in games played within the division.',
          'Best won-lost-tied percentage in common games.',
          'Best won-lost-tied percentage in games played within the conference.',
          'Strength of victory (combined record of all opponents beaten).',
          'Strength of schedule (combined record of all opponents played).',
          'Best combined ranking among conference teams in points scored and points allowed.',
          'Best combined ranking among all teams in points scored and points allowed.',
          'Best net points in common games.',
          'Best net points in all games.',
          'Best net touchdowns in all games.',
          'Coin toss.'
        ]
      },
      {
        title: 'Division tie, three or more clubs',
        steps: [
          'Head-to-head sweep. One club wins the step by beating all the others, or clubs are eliminated by losing to all the others. Applies only if every club played every other.',
          'Best won-lost-tied percentage in games played within the division.',
          'Best won-lost-tied percentage in common games.',
          'Best won-lost-tied percentage in games played within the conference.',
          'Strength of victory.',
          'Strength of schedule.',
          'Best combined ranking among conference teams in points scored and points allowed.',
          'Best combined ranking among all teams in points scored and points allowed.',
          'Best net points in common games.',
          'Best net points in all games.',
          'Best net touchdowns in all games.',
          'Coin toss.'
        ]
      },
      {
        title: 'Wild-card tie, two clubs',
        intro: 'If the clubs are from the same division, the division tiebreaker is used. Otherwise:',
        steps: [
          'Head-to-head, if applicable.',
          'Best won-lost-tied percentage in games played within the conference.',
          'Best won-lost-tied percentage in common games, minimum of four.',
          'Strength of victory.',
          'Strength of schedule.',
          'Best combined ranking among conference teams in points scored and points allowed.',
          'Best combined ranking among all teams in points scored and points allowed.',
          'Best net points in conference games.',
          'Best net points in all games.',
          'Best net touchdowns in all games.',
          'Coin toss.'
        ]
      },
      {
        title: 'Wild-card tie, three or more clubs',
        intro: 'First apply the division tiebreaker within each division to leave one club per division. Then:',
        steps: [
          'Head-to-head sweep, if applicable.',
          'Best won-lost-tied percentage in games played within the conference.',
          'Best won-lost-tied percentage in common games, minimum of four.',
          'Strength of victory.',
          'Strength of schedule.',
          'Best combined ranking among conference teams in points scored and points allowed.',
          'Best combined ranking among all teams in points scored and points allowed.',
          'Best net points in conference games.',
          'Best net points in all games.',
          'Best net touchdowns in all games.',
          'Coin toss.'
        ]
      }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NFLRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
