/* =====================================================================
 * scoring.js – Ren poengregning, ingen DOM.
 *
 * Brettet er en flat tabell: board[kategori * rows + rekke], -1 = tom rute.
 * Alle hjelpefunksjoner tar terningverdier (1–6) og bruker bare de
 * FFF.config.bestDice beste terningene der det betyr noe.
 * ===================================================================== */
(function (FFF) {
  'use strict';
  const C = FFF.config;
  const HIGH_FIRST = [6, 5, 4, 3, 2, 1];

  /** Antall av hver verdi: c[1] … c[6]. */
  function counts(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach(v => { if (v >= 1 && v <= 6) c[v]++; });
    return c;
  }

  /* ---------- hjelpere som kategoriene i config.js bruker ---------- */
  const S = {
    /** Sum av terninger som viser v (maks bestDice stk). */
    upper: (d, v) => Math.min(counts(d)[v], C.bestDice) * v,

    /** n forskjellige par, høyeste først (1 par, 2 par, 3 par). */
    pairs(d, n) {
      const c = counts(d), p = HIGH_FIRST.filter(v => c[v] >= 2);
      return p.length >= n ? 2 * p.slice(0, n).reduce((a, b) => a + b, 0) : 0;
    },

    /** n like, høyeste verdi. */
    ofAKind(d, n) {
      const c = counts(d), v = HIGH_FIRST.find(x => c[x] >= n);
      return v ? n * v : 0;
    },

    /** Fast poeng hvis alle verdiene i need finnes. */
    straight(d, need, value) {
      const c = counts(d);
      return need.every(v => c[v] > 0) ? value : 0;
    },

    /** To grupper med ulike verdier: na like + nb like (Stiftsgården, Værnes, Strandstua). */
    groups(d, na, nb) {
      const c = counts(d);
      let best = 0;
      HIGH_FIRST.forEach(a => {
        if (c[a] < na) return;
        HIGH_FIRST.forEach(b => { if (b !== a && c[b] >= nb) best = Math.max(best, na * a + nb * b); });
      });
      return best;
    },

    /** Sum av de beste terningene. */
    chance: d => d.filter(v => v > 0).sort((a, b) => b - a).slice(0, C.bestDice).reduce((a, b) => a + b, 0),

    /** n like av samme verdi gir fast poeng. */
    allSame: (d, n, value) => HIGH_FIRST.some(v => counts(d)[v] >= n) ? value : 0
  };

  /* ---------- brett og summer ---------- */
  const rows = C.rows, cats = FFF.categories;

  FFF.scoring = {
    helpers: S,
    counts,
    cellIndex: (cat, row) => cat * rows + row,
    catOf: i => Math.floor(i / rows),
    rowOf: i => i % rows,
    blankBoard: () => Array(cats.length * rows).fill(-1),

    /** Poeng i kategori cat for disse terningene. */
    score: (cat, dice) => cats[cat].score(dice, S),

    /** Antall fylte ruter. */
    filled: board => board.filter(v => v >= 0).length,

    /** Summer for én rekke: øvre del, bonus, total (uten gangetall). */
    columnTotals(board, row) {
      let upper = 0, lower = 0;
      cats.forEach((cat, k) => {
        const v = board[k * rows + row];
        if (v >= 0) { if (cat.section === 'upper') upper += v; else lower += v; }
      });
      const bonus = upper >= C.upperBonus.threshold ? C.upperBonus.value : 0;
      return { upper, bonus, total: upper + bonus + lower };
    },

    /** Totalsum med gangetall for alle rekker. */
    grandTotal(board) {
      let g = 0;
      for (let r = 0; r < rows; r++) g += this.columnTotals(board, r).total * C.multiplier(r);
      return g;
    },

    /** Maks i Mulig-kolonnen for øvre sum og total per rekke. */
    maxUpper: () => cats.filter(c => c.section === 'upper').reduce((a, c) => a + c.max, 0),
    maxColumn: () => cats.reduce((a, c) => a + c.max, 0) + C.upperBonus.value
  };
})(window.FFF);
