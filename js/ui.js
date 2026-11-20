/* =====================================================================
 * ui.js – Tegner skjermen ut fra spilltilstanden. Ingen spillregler her.
 *
 *   FFF.ui.render()          – tegner alt på nytt
 *   FFF.ui.state             – rent visningsvalg (valgt rute, sett brett)
 * ===================================================================== */
(function (FFF) {
  'use strict';
  const C = FFF.config, SC = FFF.scoring, GM = FFF.game, G = GM.G, CATS = FFF.categories;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Visningsvalg som ikke er en del av spillet. */
  const view = { selected: null, viewSlot: null, rolling: false };

  /* ---------- banner: hvem sin tur ---------- */
  function renderBanner() {
    const el = $('banner'), ts = GM.turnSlot(), tp = GM.P(ts), mine = GM.isMyTurn();
    el.classList.toggle('mine', !!mine);
    if (!GM.roster().length) { el.textContent = 'Venter på spillet …'; return; }
    if (GM.gameOver()) {
      const best = GM.roster().slice().sort((a, b) => SC.grandTotal(b.b) - SC.grandTotal(a.b))[0];
      el.innerHTML = `<span>Spillet er ferdig! <b>${esc(best.nm)}</b> vant med ${SC.grandTotal(best.b)} poeng.</span>`;
      return;
    }
    if (!ts) { el.textContent = 'Venter på at spillerne kobler seg til igjen …'; return; }
    el.innerHTML = mine
      ? `<span>${G.mySlots.length > 1 ? 'Tur for' : 'Din tur,'} <b>${esc(tp.nm)}</b>!</span><span class="r">Omgang ${GM.round(tp)} av ${C.rounds}</span>`
      : `<span>Venter på <b>${esc(tp.nm)}</b></span><span class="r">Omgang ${GM.round(tp)}</span>`;
  }

  /* ---------- terningbordet og knappene under ---------- */
  function renderDice() {
    const p = GM.me();
    if (!p) { FFF.dice.show([], []); $('trayinfo').textContent = 'Venter på plass fra verten …'; $('roll').disabled = true; return; }
    GM.prepareDice(p);
    const mine = GM.turnSlot() === p.slot, done = GM.finished(p);
    if (!view.rolling) FFF.dice.show(p.d, p.h, { disabled: !mine || (!p.manual && (p.t === 0 || p.t >= C.maxThrows)) });
    const n = p.d.length;
    $('trayinfo').textContent = done ? 'Brettet ditt er fullt. Godt spilt!'
      : p.manual ? `Omgang ${GM.round(p)} · ${n} terninger · trykk på en terning for å stille inn verdien`
      : `Omgang ${GM.round(p)} av ${C.rounds} · ${n} terninger · kast ${p.t} av ${C.maxThrows}` + (p.t > 0 && p.t < C.maxThrows ? ' · trykk for å holde' : '');
    const rb = $('roll');
    rb.hidden = !!p.manual;
    rb.disabled = done || !mine || p.t >= C.maxThrows || view.rolling;
    rb.textContent = p.t === 0 ? 'Kast terningene' : p.t >= C.maxThrows ? 'Velg en rute' : `Kast igjen (${C.maxThrows - p.t} igjen)`;
    $('manual').checked = !!p.manual;
  }

  /* ---------- poengkortet ---------- */
  function renderBoard() {
    const own = GM.me();
    const viewing = view.viewSlot && !G.mySlots.includes(view.viewSlot);
    const p = viewing ? GM.P(view.viewSlot) : own;
    const b = p ? p.b : SC.blankBoard();
    const canPlace = !viewing && !view.rolling && GM.canPlace(p);
    const preview = canPlace ? CATS.map((_, k) => SC.score(k, p.d)) : null;
    const totals = Array.from({ length: C.rows }, (_, r) => SC.columnTotals(b, r));
    const head = Array.from({ length: C.rows }, (_, r) => `<th>× ${C.multiplier(r)}</th>`).join('');

    let h = `<caption><div class="capin"><span>${esc(p ? p.nm : 'Du')} har</span><b class="num">${SC.grandTotal(b)}</b><span>poeng med gangetall</span></div></caption>`;
    h += `<thead><tr><th class="cat">Kategori</th><th class="mx">Mulig</th>${head}</tr></thead><tbody>`;
    const row = k => {
      h += `<tr><th class="cat" scope="row">${CATS[k].label}</th><td class="mx">${CATS[k].max}</td>`;
      for (let r = 0; r < C.rows; r++) {
        const i = SC.cellIndex(k, r), v = b[i];
        if (v >= 0) h += `<td class="c">${v}</td>`;
        else if (preview) h += `<td class="c open${view.selected === i ? ' sel' : ''}"><button data-cell="${i}" aria-label="${CATS[k].label}, rekke ${r + 1}: ${preview[k]} poeng"><span class="${preview[k] ? 'hi' : 'lo'}">${preview[k] || '–'}</span></button></td>`;
        else h += '<td class="c"></td>';
      }
      h += '</tr>';
    };
    const upperCount = CATS.filter(c => c.section === 'upper').length;
    for (let k = 0; k < upperCount; k++) row(k);
    h += `<tr class="sum"><th class="cat">SUM (${C.upperBonus.threshold})</th><td class="mx">${SC.maxUpper()}</td>${totals.map(t => `<td class="c">${t.upper}</td>`).join('')}</tr>`;
    h += `<tr class="sum"><th class="cat">Bonus (≥${C.upperBonus.threshold})</th><td class="mx">${C.upperBonus.value}</td>${totals.map(t => `<td class="c${t.bonus ? ' gold' : ''}">${t.bonus || ''}</td>`).join('')}</tr>`;
    for (let k = upperCount; k < CATS.length; k++) row(k);
    h += `<tr class="tot"><th class="cat">TOTALT</th><td class="mx">${SC.maxColumn()}</td>${totals.map(t => `<td class="c">${t.total}</td>`).join('')}</tr>`;
    h += `<tr class="sum"><th class="cat">Med gangetall</th><td class="mx"></td>${totals.map((t, r) => `<td class="c">${t.total * C.multiplier(r)}</td>`).join('')}</tr></tbody>`;
    $('board').innerHTML = h;

    $('viewing').hidden = !viewing;
    if (viewing) $('viewTxt').textContent = 'Du ser brettet til ' + (p ? p.nm : '');
    const bar = $('place');
    if (view.selected !== null && canPlace && b[view.selected] < 0) {
      const k = SC.catOf(view.selected), r = SC.rowOf(view.selected), v = preview[k];
      bar.hidden = false;
      $('placeTxt').textContent = `${CATS[k].label} i Rekke × ${C.multiplier(r)}: ${v} poeng` + (v ? ` (= ${v * C.multiplier(r)} med gangetall)` : ', ruten strykes');
    } else { bar.hidden = true; if (!canPlace) view.selected = null; }
  }

  /* ---------- poengtavlen: alle spillere, sortert etter poeng ---------- */
  function renderScoreboard() {
    const ts = GM.turnSlot();
    const list = GM.roster().slice().sort((a, b) => SC.grandTotal(b.b) - SC.grandTotal(a.b) || a.slot - b.slot);
    const rows = list.map((p, idx) => {
      const live = ts === p.slot && !G.mySlots.includes(p.slot) && p.d.some(v => v > 0);
      const per = Array.from({ length: C.rows }, (_, r) => SC.columnTotals(p.b, r).total * C.multiplier(r));
      return `<li class="pl${ts === p.slot ? ' turn' : ''}${p.on ? '' : ' off'}">
        <button data-slot="${p.slot}">
          <span class="rank">${idx + 1}</span>
          <span class="who"><b>${esc(p.nm)}</b>${G.mySlots.includes(p.slot) ? ' <em>(denne mobilen)</em>' : ''}
            <small>${SC.filled(p.b)} av ${C.rounds} ruter${p.on ? '' : ' · ikke tilkoblet'}${ts === p.slot ? ' · har tur' : ''}</small>
            <span class="per">${per.map((v, r) => `<i>×${C.multiplier(r)} <b>${v}</b></i>`).join('')}</span>
            ${live ? '<span class="mini">' + p.d.map((v, i) => `<i class="${p.h[i] ? 'h' : ''}">${v || ''}</i>`).join('') + '</span>' : ''}
          </span>
          <span class="pts num">${SC.grandTotal(p.b)}</span>
        </button></li>`;
    }).join('');
    const free = C.maxPlayers - list.length;
    $('scoreboard').innerHTML = rows + (free > 0 && G.role ? `<li class="pl empty"><span class="who">${free} ledig${free > 1 ? 'e' : ''} plass${free > 1 ? 'er' : ''}. ${G.role === 'host' ? 'Del koden ' + esc(G.code) + ' eller legg til spillere på denne mobilen.' : ''}</span></li>` : '');
    $('addLocal').hidden = !(G.role === 'host' && GM.freeSlot());
  }

  function render() {
    if (!G.role) return;
    $('codeBig').textContent = G.code;
    const p = GM.me();
    $('whoami').textContent = p ? p.nm + ' · plass ' + p.slot : '';
    renderBanner(); renderDice(); renderBoard(); renderScoreboard();
  }

  FFF.ui = { view, render, renderBoard, renderDice, esc, $ };
})(window.FFF);
