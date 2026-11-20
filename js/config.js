/* =====================================================================
 * config.js – Alle spilleregler samlet på ett sted.
 *
 * Vil du endre spillet, starter du her:
 *  - Legg til / fjern kategorier i FFF.categories (poengregelen er en
 *    funksjon som får terningene og returnerer poeng).
 *  - Endre antall rekker, gangetall, bonus eller terningplan i FFF.config.
 *  - Endre hvilke lyder som spilles ved hvilke hendelser i FFF.config.sounds.
 * Resten av koden leser bare herfra.
 * ===================================================================== */
(function (FFF) {
  'use strict';

  FFF.config = {
    name: 'Fridthjof For Faen',
    maxPlayers: 4,
    rows: 5,                       // antall rekker (kolonner) på kortet
    multiplier: r => r + 1,        // Rekke × 1, × 2 … × 5
    maxThrows: 3,                  // kast per omgang
    bestDice: 6,                   // bare de 6 beste terningene teller
    upperBonus: { threshold: 84, value: 100 },

    /** Antall terninger i en gitt omgang (1-basert). */
    diceForRound(round, totalRounds) {
      return (round <= 10 || round > totalRounds - 5) ? 8 : 6;
    },

    /** Lyd som spilles ved hver hendelse (navn fra FFF.sound). */
    sounds: {
      yourTurn: 'chirp',          // fuglekvitter når det blir din tur
      roll: 'rattle',             // terningrasling
      land: 'knock',              // en terning lander
      highScore: 'cuckoo',        // gjøken galer ved god score
      zero: 'bleat',              // sauen breker når en rute strykes
      bonus: 'moo',               // kua rauter ved bonus i en rekke
      allSame: 'splash',          // fisken vaker ved 6 like
      gameOver: 'cuckoo'
    },
    highScoreShare: 0.7,          // «god score» = minst 70 % av maks

    peerPrefix: 'fridthjof-for-faen-v3-',  // prefiks for nettverks-ID
    storageKey: 'fff3'                     // prefiks for lagring på mobilen
  };

  /* Kategoriene på kortet, i rekkefølge. section 'upper' teller mot bonus.
   * score(dice, S) får terningverdiene og hjelpefunksjonene i FFF.scoring. */
  FFF.categories = [
    { label: '1-ere', section: 'upper', max: 6,   score: (d, S) => S.upper(d, 1) },
    { label: '2-ere', section: 'upper', max: 12,  score: (d, S) => S.upper(d, 2) },
    { label: '3-ere', section: 'upper', max: 18,  score: (d, S) => S.upper(d, 3) },
    { label: '4-ere', section: 'upper', max: 24,  score: (d, S) => S.upper(d, 4) },
    { label: '5-ere', section: 'upper', max: 30,  score: (d, S) => S.upper(d, 5) },
    { label: '6-ere', section: 'upper', max: 36,  score: (d, S) => S.upper(d, 6) },
    { label: '1 par', max: 12, score: (d, S) => S.pairs(d, 1) },
    { label: '2 par', max: 22, score: (d, S) => S.pairs(d, 2) },
    { label: '3 par', max: 30, score: (d, S) => S.pairs(d, 3) },
    { label: '3 like', max: 18, score: (d, S) => S.ofAKind(d, 3) },
    { label: '4 like', max: 24, score: (d, S) => S.ofAKind(d, 4) },
    { label: '5 like', max: 30, score: (d, S) => S.ofAKind(d, 5) },
    { label: 'Liten straight (1-5)', max: 15, score: (d, S) => S.straight(d, [1, 2, 3, 4, 5], 15) },
    { label: 'Stor straight (2-6)',  max: 20, score: (d, S) => S.straight(d, [2, 3, 4, 5, 6], 20) },
    { label: 'Full straight (1-6)',  max: 21, score: (d, S) => S.straight(d, [1, 2, 3, 4, 5, 6], 21) },
    { label: 'Stiftsgården (3+3)', max: 33, score: (d, S) => S.groups(d, 3, 3) },
    { label: 'Værnes (4+2)',       max: 34, score: (d, S) => S.groups(d, 4, 2) },
    { label: 'Strandstua (3+2)',   max: 28, score: (d, S) => S.groups(d, 3, 2) },
    { label: 'Sjanse',             max: 36, score: (d, S) => S.chance(d) },
    { label: 'Fridthjof For Faen', max: 100, allSame: true, score: (d, S) => S.allSame(d, 6, 100) }
  ];

  /** Totalt antall omganger = alle ruter på kortet. */
  FFF.config.rounds = FFF.categories.length * FFF.config.rows;
})(window.FFF = window.FFF || {});
