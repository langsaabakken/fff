/* =====================================================================
 * main.js – Starter appen og kobler knapper til spillet.
 *
 * Flyt: lobby (navn, start eller bli med) -> spill. Hver handling
 * endrer tilstanden i FFF.game, sender den over nettet med FFF.net,
 * spiller lyd med FFF.sound og tegner på nytt med FFF.ui.
 * ===================================================================== */
(function (FFF) {
  'use strict';
  const C = FFF.config, GM = FFF.game, G = GM.G, SC = FFF.scoring, UI = FFF.ui, view = UI.view, $ = UI.$;

  let lastTurn = 0;   // for å merke når det blir min tur

  /* ---------- status og tegning ---------- */
  function setStatus(text, bad) {
    const n = $('netNote');
    n.textContent = text;
    n.classList.toggle('err', !!bad);
  }

  /** Tegner på nytt og spiller «din tur»-lyd når turen skifter til meg. */
  function refresh() {
    UI.render();
    const ts = GM.turnSlot();
    if (ts && ts !== lastTurn && GM.isMyTurn() && lastTurn !== 0) FFF.sound.event('yourTurn', 0.2);
    lastTurn = ts;
  }

  FFF.net.bind({
    status: setStatus,
    welcomed: () => saveLast(),
    changed(info) {
      if (info && info.placedBy) FFF.sound.event('land');
      refresh();
    }
  });

  function saveLast(extra) {
    const prev = GM.store.get('last') || {};
    GM.store.set('last', Object.assign(prev, { code: G.code, role: G.role, name: $('name').value.trim() }, extra || {}));
  }

  /* ---------- lobby ---------- */
  function initLobby() {
    const last = GM.store.get('last');
    if (last && last.name && !$('name').value) $('name').value = last.name;
    const resume = $('resume');
    if (last && last.code) {
      resume.hidden = false;
      resume.textContent = `Fortsett spillet ${last.code}` + (last.role === 'host' ? ' (du startet det)' : '');
    } else resume.hidden = true;
    const q = (location.search.match(/[?&]kode=([A-Za-z0-9]{4})/) || [])[1];
    if (q) $('code').value = q.toUpperCase();
    lobbyNote('');
  }

  function lobbyNote(t) { $('lobbyNote').textContent = t; $('lobbyNote').classList.toggle('err', !!t); }

  function needName() {
    if ($('name').value.trim()) return true;
    lobbyNote('Skriv navnet ditt først.');
    $('name').focus();
    return false;
  }

  function showGame() {
    $('lobby').hidden = true;
    $('game').hidden = false;
    view.selected = null; view.viewSlot = null;
    lastTurn = GM.turnSlot();
    refresh();
    window.scrollTo(0, 0);
  }

  /** Starter som vert. resume = hent lagrede brett for koden. */
  function startHost(code, resume) {
    G.code = code; G.role = 'host'; G.mySlots = []; G.players = {};
    const saved = resume ? GM.store.get('host:' + code) : null;
    if (saved && saved.players) {
      G.players = saved.players;
      GM.roster().forEach(p => { p.on = p.dev === 'host'; if (p.dev === 'host') G.mySlots.push(p.slot); });
    }
    if (!G.mySlots.length) {
      const s = GM.freeSlot();
      G.players[s] = GM.newPlayer(s, $('name').value.trim() || 'Spiller ' + s, { dev: 'host', tok: 'host' });
      G.mySlots = [s];
    }
    saveLast();
    FFF.net.broadcast();
    showGame();
    FFF.net.host();
  }

  /** Blir med i et spill som gjest. */
  function startClient(code) {
    const last = GM.store.get('last') || {};
    const tok = last.code === code && last.role === 'client' && last.tok ? last.tok : GM.randomToken();
    G.code = code; G.role = 'client'; G.mySlots = []; G.players = {};
    saveLast({ tok });
    showGame();
    FFF.net.join();
  }

  /* ---------- spillhandlinger ---------- */
  async function doRoll() {
    const p = GM.me();
    if (!p || view.rolling) return;
    const heldBefore = p.h.slice();
    const rolled = GM.roll(p);
    if (!rolled) return;
    view.selected = null;
    view.rolling = true;
    FFF.sound.event('roll');
    UI.render();
    FFF.net.push(p.slot);
    await FFF.dice.roll(p.d, heldBefore.map((h, i) => h && !rolled.includes(i)), () => FFF.sound.event('land'));
    view.rolling = false;
    if (SC.score(FFF.categories.findIndex(c => c.allSame), p.d) > 0) {
      FFF.sound.event('allSame');
      party('6 like!', 'Fridthjof For Faen er klar for 100 poeng.');
    }
    refresh();
  }

  function doPlace() {
    const p = GM.me();
    if (view.selected === null || !p) return;
    const res = GM.place(p, view.selected);
    if (!res) return;
    view.selected = null;
    // Lyd for hendelsene, i en hyggelig rekkefølge.
    let delay = 0;
    ['zero', 'highScore', 'bonus', 'allSame'].forEach(evt => {
      if (res.events.includes(evt)) { FFF.sound.event(evt, delay); delay += 0.9; }
    });
    if (res.events.includes('allSame')) party('Fridthjof For Faen!', '100 poeng i boks.');
    else if (res.events.includes('bonus')) party('Bonus!', '100 ekstra poeng i rekka.');
    if (GM.gameOver()) { FFF.sound.event('gameOver', delay); party('Spillet er ferdig!', 'Se poengtavla.'); }
    FFF.net.push(p.slot);
    refresh();
  }

  /** Feiring med konfetti (blader) og en figur. */
  function party(title, sub) {
    $('partyTitle').textContent = title;
    $('partySub').textContent = sub;
    const box = $('party');
    box.hidden = false;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const colors = ['#e8b23a', '#b53a2c', '#6f9e4b', '#f5efe0', '#3a6f99'];
      for (let i = 0; i < 36; i++) {
        const c = document.createElement('i');
        c.className = 'leaf';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.background = colors[i % colors.length];
        c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
        c.style.animationDelay = Math.random() * 0.4 + 's';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4200);
      }
    }
    clearTimeout(party.timer);
    party.timer = setTimeout(() => { box.hidden = true; }, 2800);
  }

  /* ---------- knapper og trykk ---------- */
  document.addEventListener('pointerdown', () => FFF.sound.unlock(), { once: true });

  $('host').addEventListener('click', () => { if (needName()) startHost(GM.newCode(), false); });
  $('join').addEventListener('click', () => {
    const code = $('code').value.trim().toUpperCase();
    if (!needName()) return;
    if (!/^[A-Z0-9]{4}$/.test(code)) { lobbyNote('Koden har 4 tegn.'); return; }
    startClient(code);
  });
  $('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
  $('resume').addEventListener('click', () => {
    const l = GM.store.get('last');
    if (!l) return;
    if (l.role === 'host') startHost(l.code, true); else startClient(l.code);
  });

  $('roll').addEventListener('click', doRoll);
  FFF.dice.mount($('table'), i => {
    const p = GM.me();
    if (!p || view.rolling) return;
    const ok = p.manual ? GM.cycleManual(p, i) : GM.toggleHold(p, i);
    if (!ok) return;
    if (!p.manual) FFF.sound.play('knock');
    view.selected = null;
    FFF.net.push(p.slot);
    refresh();
  });
  $('manual').addEventListener('change', e => {
    const p = GM.me();
    if (!p) return;
    GM.setManual(p, e.target.checked);
    FFF.dice.reshuffle(p.d.length);
    FFF.net.push(p.slot);
    refresh();
  });

  $('board').addEventListener('click', e => {
    const b = e.target.closest('button[data-cell]');
    if (!b) return;
    const i = +b.dataset.cell;
    view.selected = view.selected === i ? null : i;
    UI.renderBoard();
  });
  $('confirm').addEventListener('click', doPlace);
  $('cancel').addEventListener('click', () => { view.selected = null; UI.renderBoard(); });

  $('scoreboard').addEventListener('click', e => {
    const b = e.target.closest('button[data-slot]');
    if (!b) return;
    const s = +b.dataset.slot;
    view.viewSlot = G.mySlots.includes(s) ? null : s;
    view.selected = null;
    UI.renderBoard();
    $('board').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('back').addEventListener('click', () => { view.viewSlot = null; UI.renderBoard(); });

  $('addBtn').addEventListener('click', () => {
    const nm = $('localName').value.trim().slice(0, 20), s = GM.freeSlot();
    if (!nm || !s || G.role !== 'host') return;
    G.players[s] = GM.newPlayer(s, nm, { dev: 'host', tok: 'host' });
    G.mySlots.push(s);
    $('localName').value = '';
    FFF.net.broadcast();
    refresh();
  });

  $('share').addEventListener('click', () => {
    const url = location.href.split(/[?#]/)[0] + '?kode=' + G.code;
    const done = () => { $('share').textContent = 'Kopiert!'; setTimeout(() => { $('share').textContent = 'Kopier lenke'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => setStatus('Del denne lenken: ' + url));
    else setStatus('Del denne lenken: ' + url);
  });

  $('leave').addEventListener('click', () => {
    FFF.net.broadcast();
    FFF.net.close();
    G.role = null; G.mySlots = []; G.players = {};
    $('game').hidden = true;
    $('lobby').hidden = false;
    initLobby();
  });

  $('party').addEventListener('click', () => { $('party').hidden = true; });

  /* Lyd av / på. */
  function paintMute() {
    $('mute').setAttribute('aria-pressed', String(!FFF.sound.muted));
    $('mute').setAttribute('aria-label', FFF.sound.muted ? 'Slå på lyd' : 'Slå av lyd');
    $('mute').classList.toggle('off', FFF.sound.muted);
  }
  $('mute').addEventListener('click', () => { FFF.sound.toggle(); paintMute(); });

  /* Dyrene i fjellbildet lager lyd når du trykker på dem. */
  document.querySelectorAll('[data-sound]').forEach(el => {
    const go = () => {
      FFF.sound.play(el.dataset.sound);
      el.classList.remove('poke'); void el.getBoundingClientRect(); el.classList.add('poke');
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  paintMute();
  initLobby();
})(window.FFF);
