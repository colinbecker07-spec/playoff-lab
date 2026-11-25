/*
 * colors.js — team colors [primary, secondary] as hex.
 * The UI picks whichever reads better against the current theme and computes readable text colors.
 */
(function (root) {
  'use strict';
  var api = {
    BUF: ['#00338D', '#C60C30'], MIA: ['#008E97', '#FC4C02'], NE:  ['#002244', '#C60C30'], NYJ: ['#125740', '#000000'],
    BAL: ['#241773', '#9E7C0C'], CIN: ['#FB4F14', '#000000'], CLE: ['#311D00', '#FF3C00'], PIT: ['#FFB612', '#101820'],
    HOU: ['#03202F', '#A71930'], IND: ['#002C5F', '#A2AAAD'], JAX: ['#006778', '#D7A22A'], TEN: ['#0C2340', '#4B92DB'],
    DEN: ['#FB4F14', '#002244'], KC:  ['#E31837', '#FFB81C'], LV:  ['#000000', '#A5ACAF'], LAC: ['#0080C6', '#FFC20E'],
    DAL: ['#003594', '#869397'], NYG: ['#0B2265', '#A71930'], PHI: ['#004C54', '#A5ACAF'], WSH: ['#5A1414', '#FFB612'],
    CHI: ['#0B162A', '#C83803'], DET: ['#0076B6', '#B0B7BC'], GB:  ['#203731', '#FFB612'], MIN: ['#4F2683', '#FFC62F'],
    ATL: ['#A71930', '#000000'], CAR: ['#0085CA', '#101820'], NO:  ['#D3BC8D', '#101820'], TB:  ['#D50A0A', '#FF7900'],
    ARI: ['#97233F', '#000000'], LAR: ['#003594', '#FFA300'], SF:  ['#AA0000', '#B3995D'], SEA: ['#002244', '#69BE28']
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NFLColors = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
