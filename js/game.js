/* =====================================================================
 * game.js – Spilltilstand og regler for tur, kast og innføring.
 *
 * Ingen DOM her. Alt som skjer i spillet går gjennom funksjonene under,
 * og de returnerer «hendelser» (f.eks. 'bonus', 'zero') som main.js
 * bruker til lyd og feiring.
 *
 * En spiller ser slik ut:
 *   { slot, nm, b: brett[], d: terninger[], h: holdt[], t: kast brukt,
 *     manual: fysiske terninger?, on: tilkoblet?, dev, tok }
 * ===================================================================== */
(function (FFF) {
  'use strict';
  const C = FFF.config, SC = FFF.scoring;

  const G = {
    players: {},        // slot -> spiller
    mySlots: [],        // plasser som styres fra denne mobilen
    role: null,         // 'host' | 'client' | null
    code: ''
  };

  const P = slot => G.players[slot];
  const roster = () => Object.values(G.players).sort((a, b) => a.slot - b.slot);
  const round = p => Math.min(SC.filled(p.b) + 1, C.rounds);
  const finished = p => SC.filled(p.b) >= C.rounds;
  const diceCount = p => C.diceForRound(round(p), C.rounds);

  /** Ny spiller med tomt brett. */
  function newPlayer(slot, nm, extra) {
    return Object.assign({ slot, nm, b: SC.blankBoard(), d: [], h: [], t: 0, manual: false, on: true }, extra || {});
  }

  /** Første ledige plass (1–4), eller 0 hvis fullt. */
  function freeSlot() {
    for (let s = 1; s <= C.maxPlayers; s++) if (!P(s)) return s;
    return 0;
  }

  /** Hvem sin tur: tilkoblet spiller med færrest fylte ruter, lavest plass ved likt. */
  function turnSlot() {
    const act = roster().filter(p => p.on && !finished(p));
    if (!act.length) return 0;
    act.sort((a, b) => SC.filled(a.b) - SC.filled(b.b) || a.slot - b.slot);
    return act[0].slot;
  }

  const isMyTurn = () => G.mySlots.includes(turnSlot());
  /** Spilleren som vises på denne mobilen: den som har tur, ellers den første. */
  const activeSlot = () => (isMyTurn() ? turnSlot() : G.mySlots[0]);
  const me = () => P(activeSlot());
  const gameOver = () => roster().length > 0 && roster().every(finished);

  /** Sørger for riktig antall terninger før første kast i en omgang. */
  function prepareDice(p) {
    const n = diceCount(p);
    if (p.t === 0 && p.d.length !== n) {
      p.d = Array(n).fill(p.manual ? 1 : 0);
      p.h = Array(n).fill(false);
    }
  }

  /** Kaster terningene som ikke holdes. Returnerer hvilke som ble kastet. */
  function roll(p) {
    if (turnSlot() !== p.slot || p.t >= C.maxThrows || p.manual) return null;
    prepareDice(p);
    if (p.t === 0) p.h = p.d.map(() => false);
    const rolled = [];
    p.d = p.d.map((v, i) => {
      if (p.h[i] && v) return v;
      rolled.push(i);
      return 1 + Math.floor(Math.random() * 6);
    });
    p.t++;
    return rolled;
  }

  /** Holder eller slipper en terning. */
  function toggleHold(p, i) {
    if (turnSlot() !== p.slot || p.manual || p.t === 0 || p.t >= C.maxThrows || !p.d[i]) return false;
    p.h[i] = !p.h[i];
    return true;
  }

  /** Fysiske terninger: trykk teller verdien opp 1–6. */
  function cycleManual(p, i) {
    if (turnSlot() !== p.slot || !p.manual) return false;
    p.d[i] = (p.d[i] % 6) + 1;
    p.t = 1;
    return true;
  }

  function setManual(p, on) {
    p.manual = !!on;
    p.t = 0;
    p.d = [];
    prepareDice(p);
  }

  /** Kan spilleren føre inn nå? */
  function canPlace(p) {
    if (!p || turnSlot() !== p.slot) return false;
    return p.manual ? p.d.length > 0 && p.d.every(v => v > 0) : p.t > 0;
  }

  /** Fører inn poeng i en rute. Returnerer { value, events[] } eller null. */
  function place(p, cell) {
    if (!canPlace(p) || p.b[cell] >= 0) return null;
    const cat = SC.catOf(cell), row = SC.rowOf(cell);
    const bonusBefore = SC.columnTotals(p.b, row).bonus;
    const value = SC.score(cat, p.d);
    p.b[cell] = value;
    const events = [];
    if (value === 0) events.push('zero');
    else if (value >= FFF.categories[cat].max * C.highScoreShare) events.push('highScore');
    if (!bonusBefore && SC.columnTotals(p.b, row).bonus) events.push('bonus');
    if (FFF.categories[cat].allSame && value > 0) events.push('allSame');
    p.t = 0; p.d = []; p.h = [];
    prepareDice(p);
    if (finished(p)) events.push('finished');
    return { value, events };
  }

  /** Spillerdata som deles med andre (uten hemmelige felt). */
  const publicPlayer = p => ({ slot: p.slot, nm: p.nm, b: p.b, d: p.d, h: p.h, t: p.t, on: !!p.on });

  /** Enkel validering av data fra nettet. */
  function validBoard(b) {
    return Array.isArray(b) && b.length === C.rounds && b.every(v => Number.isInteger(v) && v >= -1 && v <= 100);
  }
  function validDice(d) {
    return Array.isArray(d) && d.length <= 8 && d.every(v => Number.isInteger(v) && v >= 0 && v <= 6);
  }

  /* ---------- lagring på denne mobilen ---------- */
  const KEY = C.storageKey;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(KEY + ':' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(KEY + ':' + k, JSON.stringify(v)); } catch (e) { /* */ } }
  };

  FFF.game = {
    G, P, roster, round, finished, diceCount, newPlayer, freeSlot,
    turnSlot, isMyTurn, activeSlot, me, gameOver,
    prepareDice, roll, toggleHold, cycleManual, setManual, canPlace, place,
    publicPlayer, validBoard, validDice, store,
    /** Ny tilfeldig spillkode på 4 tegn uten forvekslbare tegn. */
    newCode() {
      const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let s = '';
      for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
      return s;
    },
    randomToken: () => Math.random().toString(36).slice(2, 12)
  };
})(window.FFF);
