/* =====================================================================
 * dice3d.js – Realistiske 3D-terninger på et trebord.
 *
 * Hver terning er en CSS-kube med seks sider. Ved kast ruller de inn
 * fra venstre side av bordet, snurrer i flere omdreininger og stopper
 * på hver sin tid. Holdte terninger blir liggende.
 *
 * API:
 *   FFF.dice.mount(element, onTap)   – kobler bordet til et element
 *   FFF.dice.show(values, held, opts) – tegner terningene uten animasjon
 *   FFF.dice.roll(values, held)       – animerer kastet, gir et Promise
 * ===================================================================== */
(function (FFF) {
  'use strict';

  /* Kubens rotasjon [X, Y] som viser hver verdi rett opp mot oss.
   * Sidene er plassert slik at motstående sider summerer til 7. */
  const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

  /* Pips i et 3×3-rutenett (posisjon 1–9). */
  const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

  let table = null, tapHandler = null, layout = [];
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function faceHTML(v) {
    const on = new Set(PIPS[v]);
    let h = '';
    for (let i = 1; i <= 9; i++) h += `<i class="${on.has(i) ? 'pip' : ''}"></i>`;
    return `<div class="face f${v}">${h}</div>`;
  }

  function cubeTransform(v) {
    const [x, y] = FACE_ROT[v] || [0, 0];
    return `rotateX(${x}deg) rotateY(${y}deg)`;
  }

  /** Lager en litt tilfeldig plassering per terning i et rutenett. */
  function makeLayout(n) {
    const cols = n <= 6 ? 3 : 4, rowsN = Math.ceil(n / cols);
    layout = Array.from({ length: n }, (_, i) => ({
      left: ((i % cols) + 0.5) / cols * 100,
      top: (Math.floor(i / cols) + 0.5) / rowsN * 100,
      dx: (Math.random() - 0.5) * 14,
      dy: (Math.random() - 0.5) * 10,
      rz: (Math.random() - 0.5) * 28
    }));
  }

  function restTransform(i) {
    const L = layout[i];
    return `translate(-50%,-50%) translate(${L.dx}px,${L.dy}px) rotate(${L.rz}deg)`;
  }

  /** Tegner alle terningene i ro. */
  function show(values, held, opts) {
    if (!table) return;
    opts = opts || {};
    if (layout.length !== values.length) makeLayout(values.length);
    table.dataset.count = values.length;
    table.innerHTML = values.map((v, i) => {
      const blank = !v, L = layout[i];
      return `<button class="die${held[i] ? ' held' : ''}${blank ? ' blank' : ''}" data-i="${i}"
        style="left:${L.left}%;top:${L.top}%;transform:${restTransform(i)}"
        aria-label="${blank ? 'Terning ' + (i + 1) + ', ikke kastet' : 'Terning ' + (i + 1) + ' viser ' + v + (held[i] ? ', holdt' : '')}"
        ${opts.disabled ? 'disabled' : ''}>
        <span class="shadow"></span>
        <span class="cube" style="transform:${cubeTransform(v || 1)}">${[1, 2, 3, 4, 5, 6].map(faceHTML).join('')}</span>
        ${held[i] ? '<span class="tag">Holdt</span>' : ''}
      </button>`;
    }).join('');
  }

  /** Animerer et kast. values = nye verdier, held = hvilke som lå i ro. */
  function roll(values, held, onLand) {
    show(values, held, { disabled: true });
    if (reduceMotion()) return Promise.resolve();
    const w = table.clientWidth, h = table.clientHeight;
    const jobs = [];
    table.querySelectorAll('.die').forEach(el => {
      const i = +el.dataset.i;
      if (held[i]) return;
      // Ny tilfeldig hvileposisjon for terningene som kastes.
      layout[i].dx = (Math.random() - 0.5) * 14;
      layout[i].dy = (Math.random() - 0.5) * 10;
      layout[i].rz = (Math.random() - 0.5) * 28;
      const end = restTransform(i);
      const startX = -(w * (0.55 + Math.random() * 0.3)) - layout[i].left / 100 * w;
      const startY = (Math.random() - 0.5) * h * 0.8;
      const dur = 850 + Math.random() * 900;           // stopper på ulik tid
      const turns = 2 + Math.floor(Math.random() * 3);
      const [fx, fy] = FACE_ROT[values[i]];
      const spinX = fx + 360 * turns * (Math.random() < 0.5 ? 1 : -1);
      const spinY = fy + 360 * (turns - 1) * (Math.random() < 0.5 ? 1 : -1);
      const cube = el.querySelector('.cube');
      el.style.transform = end;
      cube.style.transform = cubeTransform(values[i]);

      const a1 = el.animate([
        { transform: `translate(-50%,-50%) translate(${startX}px,${startY}px) rotate(${-200 - Math.random() * 300}deg)` },
        { transform: `translate(-50%,-50%) translate(${layout[i].dx + 10}px,${layout[i].dy - 4}px) rotate(${layout[i].rz + 8}deg)`, offset: 0.85 },
        { transform: end }
      ], { duration: dur, easing: 'cubic-bezier(.18,.72,.28,1)' });
      const a2 = cube.animate([
        { transform: `rotateX(${spinX}deg) rotateY(${spinY}deg)` },
        { transform: cubeTransform(values[i]) }
      ], { duration: dur * 0.92, easing: 'cubic-bezier(.12,.75,.3,1)' });
      jobs.push(a1.finished.then(() => { el.classList.add('landed'); if (onLand) onLand(i); }).catch(() => {}));
      jobs.push(a2.finished.catch(() => {}));
    });
    return Promise.all(jobs);
  }

  FFF.dice = {
    mount(el, onTap) {
      table = el;
      tapHandler = onTap;
      el.addEventListener('click', e => {
        const b = e.target.closest('.die');
        if (b && !b.disabled && tapHandler) tapHandler(+b.dataset.i);
      });
    },
    show,
    roll,
    /** Ny plassering, for eksempel når antall terninger endres. */
    reshuffle: n => makeLayout(n)
  };
})(window.FFF);
