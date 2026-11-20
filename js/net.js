/* =====================================================================
 * net.js – Flere mobiler i samme spill via PeerJS (WebRTC).
 *
 * Modell: Mobilen som starter spillet er VERT og eier sannheten om alle
 * brett. Gjester kobler seg direkte til verten med spillkoden.
 * Ingen egen server: PeerJS sin gratis tjeneste brukes bare til å finne
 * hverandre, deretter går data rett mellom mobilene.
 *
 * Meldinger (felt «type»):
 *   gjest -> vert  hello   { nm, tok }                 vil bli med / koble til igjen
 *   gjest -> vert  update  { slot, b, d, h, throws }   min tilstand etter en handling
 *   vert  -> gjest welcome { slot, p }                 du har fått plass slot
 *   vert  -> gjest roster  { players: [...] }          alle spillere (etter hver endring)
 *   vert  -> gjest full    {}                          spillet er fullt
 * Nye meldingstyper legges til i onHostMessage / onClientMessage.
 * ===================================================================== */
(function (FFF) {
  'use strict';
  const C = FFF.config, GM = FFF.game, G = GM.G;

  let peer = null, hostConn = null, retryTimer = 0;
  const conns = new Map();
  let ui = { status() {}, changed() {}, welcomed() {} };   // settes av main.js

  const peerId = code => C.peerPrefix + code.toLowerCase();
  const available = () => typeof window.Peer !== 'undefined';

  /* ---------------- VERT ---------------- */

  /** Sender alle spillere til alle gjester og lagrer spillet. */
  function broadcast() {
    if (G.role !== 'host') return;
    GM.store.set('host:' + G.code, { players: G.players });
    const msg = { type: 'roster', players: GM.roster().map(GM.publicPlayer) };
    conns.forEach(c => { if (c.open) { try { c.send(msg); } catch (e) { /* */ } } });
  }

  function startHost(tries) {
    if (!available()) { ui.status('Fant ikke nettverksdelen. Dere kan spille på denne mobilen.', true); return; }
    ui.status('Kobler til …');
    peer = new window.Peer(peerId(G.code), { debug: 0 });
    peer.on('open', () => ui.status('Klar. Del koden ' + G.code + ' med de andre.'));
    peer.on('connection', c => {
      c.on('open', () => conns.set(c.peer, c));
      c.on('data', m => onHostMessage(c, m));
      c.on('close', () => {
        conns.delete(c.peer);
        GM.roster().forEach(p => { if (p.dev === c.peer) p.on = false; });
        broadcast(); ui.changed();
      });
      c.on('error', () => {});
    });
    peer.on('disconnected', () => { ui.status('Mistet nettet, prøver igjen …', true); setTimeout(() => { try { peer.reconnect(); } catch (e) { /* */ } }, 2000); });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') {
        // Koden er fortsatt «opptatt» fra forrige gang siden var åpen. Vent litt.
        peer.destroy();
        if ((tries || 0) < 6) { ui.status('Gjenoppretter spillet …'); setTimeout(() => startHost((tries || 0) + 1), 4000); }
        else ui.status('Koden ' + G.code + ' er i bruk. Er spillet åpent på en annen mobil?', true);
      } else if (['network', 'server-error', 'socket-error'].includes(e.type)) {
        ui.status('Får ikke kontakt med nettet. Prøver igjen …', true);
        setTimeout(() => { try { peer.reconnect(); } catch (x) { /* */ } }, 4000);
      }
    });
  }

  function onHostMessage(c, m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello') {
      const nm = String(m.nm || '').slice(0, 20) || 'Spiller';
      // Samme token = samme spiller som kobler til igjen.
      let p = GM.roster().find(x => x.tok && x.tok === m.tok && x.dev !== 'host');
      if (!p) {
        const s = GM.freeSlot();
        if (!s) { c.send({ type: 'full' }); return; }
        p = G.players[s] = GM.newPlayer(s, nm, { tok: String(m.tok || GM.randomToken()).slice(0, 24) });
      }
      p.dev = c.peer; p.on = true; p.nm = nm;
      c.send({ type: 'welcome', slot: p.slot, p: GM.publicPlayer(p) });
      broadcast(); ui.changed();
    } else if (m.type === 'update') {
      const p = GM.P(m.slot);
      if (!p || p.dev !== c.peer) return;                 // bare eieren får endre
      if (!GM.validBoard(m.b) || !GM.validDice(m.d) || !Array.isArray(m.h)) return;
      if (FFF.scoring.filled(m.b) < FFF.scoring.filled(p.b)) return;   // aldri bakover
      const before = FFF.scoring.filled(p.b);
      p.b = m.b; p.d = m.d; p.h = m.h.map(Boolean); p.t = Math.max(0, Math.min(C.maxThrows, m.throws | 0));
      broadcast(); ui.changed({ placedBy: FFF.scoring.filled(p.b) > before ? p.slot : 0, rolledBy: p.slot });
    }
  }

  /* ---------------- GJEST ---------------- */

  function startClient() {
    clearTimeout(retryTimer);
    if (!available()) { ui.status('Fant ikke nettverksdelen. Sjekk nettet og last inn siden på nytt.', true); return; }
    ui.status('Kobler til spillet ' + G.code + ' …');
    if (peer && !peer.destroyed) { dial(); return; }
    peer = new window.Peer({ debug: 0 });
    peer.on('open', dial);
    peer.on('error', e => {
      if (e.type === 'peer-unavailable') { ui.status('Fant ikke spillet ' + G.code + '. Sjekk koden, og at verten har spillet åpent. Prøver igjen …', true); retry(); }
      else if (['network', 'server-error', 'socket-error'].includes(e.type)) { ui.status('Får ikke kontakt med nettet. Prøver igjen …', true); retry(); }
    });
    peer.on('disconnected', () => setTimeout(() => { try { peer.reconnect(); } catch (x) { /* */ } }, 2000));
  }

  function retry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (G.role === 'client' && !(hostConn && hostConn.open)) dial(); }, 4000);
  }

  function dial() {
    if (!peer || peer.destroyed || !peer.open) return;
    try { if (hostConn) hostConn.close(); } catch (e) { /* */ }
    const c = peer.connect(peerId(G.code), { reliable: true });
    hostConn = c;
    c.on('open', () => {
      ui.status('Tilkoblet spillet ' + G.code + '.');
      const last = GM.store.get('last') || {};
      c.send({ type: 'hello', nm: last.name || 'Spiller', tok: last.tok });
    });
    c.on('data', onClientMessage);
    c.on('close', () => { ui.status('Mistet kontakten med verten. Prøver igjen …', true); retry(); });
    c.on('error', retry);
  }

  function onClientMessage(m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'full') { ui.status('Spillet er fullt (' + C.maxPlayers + ' spillere).', true); return; }
    if (m.type === 'welcome') {
      const s = m.slot | 0, q = m.p || {};
      G.mySlots = [s];
      if (!G.players[s]) G.players[s] = GM.newPlayer(s, q.nm || '', {
        b: GM.validBoard(q.b) ? q.b : FFF.scoring.blankBoard(), d: GM.validDice(q.d) ? q.d : [], h: Array.isArray(q.h) ? q.h : [], t: q.t | 0
      });
      ui.welcomed(); ui.changed();
      return;
    }
    if (m.type === 'roster' && Array.isArray(m.players)) {
      const mine = G.players[G.mySlots[0]];
      const next = {};
      m.players.forEach(p => {
        if (!p || p.slot < 1 || p.slot > C.maxPlayers || !GM.validBoard(p.b)) return;
        next[p.slot] = { slot: p.slot, nm: String(p.nm || ''), b: p.b, d: GM.validDice(p.d) ? p.d : [], h: Array.isArray(p.h) ? p.h : [], t: p.t | 0, on: !!p.on, manual: false };
      });
      // Min egen tilstand er alltid nyest lokalt (unngår hopp tilbake).
      if (mine && next[mine.slot]) {
        if (FFF.scoring.filled(next[mine.slot].b) <= FFF.scoring.filled(mine.b)) next[mine.slot] = Object.assign({}, next[mine.slot], { b: mine.b, d: mine.d, h: mine.h, t: mine.t });
        next[mine.slot].manual = mine.manual;
      }
      const prev = G.players;
      G.players = next;
      // Fortell main.js om noen andre har ført inn (for lyd).
      let placedBy = 0;
      Object.values(next).forEach(p => { if (prev[p.slot] && !G.mySlots.includes(p.slot) && FFF.scoring.filled(p.b) > FFF.scoring.filled(prev[p.slot].b)) placedBy = p.slot; });
      ui.changed({ placedBy });
    }
  }

  FFF.net = {
    /** main.js gir funksjoner for status og omtegning. */
    bind(handlers) { ui = Object.assign(ui, handlers); },
    host() { startHost(0); },
    join() { startClient(); },
    /** Sender min endring: verten deler med alle, gjesten sender til verten. */
    push(slot) {
      const p = GM.P(slot);
      if (!p) return;
      if (G.role === 'host') { broadcast(); return; }
      if (hostConn && hostConn.open) {
        try { hostConn.send({ type: 'update', slot, b: p.b, d: p.d, h: p.h, throws: p.t }); } catch (e) { /* */ }
      }
    },
    broadcast,
    close() {
      clearTimeout(retryTimer);
      try { if (peer) peer.destroy(); } catch (e) { /* */ }
      peer = null; hostConn = null; conns.clear();
    }
  };
})(window.FFF);
