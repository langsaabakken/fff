/* =====================================================================
 * sound.js – Lydeffekter laget med Web Audio API (ingen lydfiler).
 *
 * Bruk:  FFF.sound.play('cuckoo')
 * Nye lyder: legg en funksjon i SOUNDS som får (ctx, ut, t0) og
 * spiller lyden mot noden «ut». Navnet kan så brukes i config.sounds.
 *
 * Mobil-nettlesere krever at lyd startes av et trykk, så unlock()
 * kalles fra første trykk på siden (se main.js).
 * ===================================================================== */
(function (FFF) {
  'use strict';
  const KEY = FFF.config.storageKey + ':muted';
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* privat modus */ }

  /** Lager AudioContext ved første behov. */
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Hvit støy, laget én gang og gjenbrukt. */
  function noise(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }

  /** Volumkurve: rask start, så nedtoning. */
  function envelope(c, t0, attack, hold, release, peak) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    return g;
  }

  /** En tone med frekvens som glir fra f0 til f1. */
  function tone(c, out, t0, type, f0, f1, dur, peak) {
    const o = c.createOscillator(), g = envelope(c, t0, 0.01, dur * 0.4, dur * 0.6, peak);
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /* ---------- lydbiblioteket ---------- */
  const SOUNDS = {
    /** Fuglekvitter: raske, stigende pip i to fraser. */
    chirp(c, out, t) {
      [0, 0.09, 0.18, 0.5, 0.58].forEach((dt, i) =>
        tone(c, out, t + dt, 'sine', 2600 + i * 120, 4300 + i * 150, 0.07, 0.25));
    },

    /** Gjøken galer: «ku-kko», synkende tone, to ganger. */
    cuckoo(c, out, t) {
      [0, 0.75].forEach(dt => {
        [[698, 0.22], [587, 0.36]].forEach(([f, d], j) => {
          const s = t + dt + j * 0.3;
          const o = c.createOscillator(), o2 = c.createOscillator(), g = envelope(c, s, 0.03, d * 0.5, d * 0.5, 0.32);
          o.type = 'sine'; o2.type = 'triangle';
          o.frequency.value = f; o2.frequency.value = f;
          const g2 = c.createGain(); g2.gain.value = 0.25;
          o.connect(g); o2.connect(g2).connect(g); g.connect(out);
          o.start(s); o2.start(s); o.stop(s + d + 0.1); o2.stop(s + d + 0.1);
        });
      });
    },

    /** Sauen breker: «mææh» med skjelvende tremolo. */
    bleat(c, out, t) {
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = envelope(c, t, 0.06, 0.45, 0.4, 0.35);
      const lfo = c.createOscillator(), depth = c.createGain(), am = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(470, t);
      o.frequency.linearRampToValueAtTime(520, t + 0.15);
      o.frequency.linearRampToValueAtTime(430, t + 0.9);
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2.5;
      lfo.frequency.value = 23; depth.gain.value = 0.45; am.gain.value = 0.55;
      lfo.connect(depth).connect(am.gain);
      o.connect(f).connect(am).connect(g).connect(out);
      o.start(t); lfo.start(t); o.stop(t + 1); lfo.stop(t + 1);
    },

    /** Kua rauter: lav, lang «mmøøø» der filteret åpner seg. */
    moo(c, out, t) {
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = envelope(c, t, 0.25, 0.7, 0.6, 0.5);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t);
      o.frequency.linearRampToValueAtTime(118, t + 0.6);
      o.frequency.linearRampToValueAtTime(96, t + 1.5);
      f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(250, t);
      f.frequency.linearRampToValueAtTime(900, t + 0.5);
      f.frequency.linearRampToValueAtTime(380, t + 1.5);
      o.connect(f).connect(g).connect(out);
      o.start(t); o.stop(t + 1.6);
    },

    /** Fisken vaker: plopp, plask og noen dråper. */
    splash(c, out, t) {
      tone(c, out, t, 'sine', 900, 160, 0.16, 0.4);
      const n = noise(c), f = c.createBiquadFilter(), g = envelope(c, t + 0.05, 0.01, 0.05, 0.45, 0.35);
      f.type = 'bandpass'; f.Q.value = 0.8;
      f.frequency.setValueAtTime(1800, t + 0.05);
      f.frequency.exponentialRampToValueAtTime(500, t + 0.5);
      n.connect(f).connect(g).connect(out);
      n.start(t + 0.05); n.stop(t + 0.6);
      [0.35, 0.47, 0.62].forEach(dt => tone(c, out, t + dt, 'sine', 1400 + Math.random() * 900, 2400, 0.05, 0.12));
    },

    /** Terningrasling i begeret: korte, tilfeldige klikk. */
    rattle(c, out, t) {
      for (let i = 0; i < 12; i++) {
        const s = t + i * 0.035 + Math.random() * 0.02;
        const n = noise(c), f = c.createBiquadFilter(), g = envelope(c, s, 0.002, 0.004, 0.03, 0.25);
        f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 1600; f.Q.value = 4;
        n.connect(f).connect(g).connect(out);
        n.start(s); n.stop(s + 0.05);
      }
    },

    /** En terning lander på trebordet: kort, dempet «tok». */
    knock(c, out, t) {
      tone(c, out, t, 'triangle', 240, 120, 0.07, 0.3);
      const n = noise(c), f = c.createBiquadFilter(), g = envelope(c, t, 0.001, 0.003, 0.04, 0.18);
      f.type = 'lowpass'; f.frequency.value = 1400;
      n.connect(f).connect(g).connect(out);
      n.start(t); n.stop(t + 0.06);
    }
  };

  FFF.sound = {
    /** Spiller lyden med dette navnet (stille hvis lyd er av). */
    play(name, delay) {
      if (muted || !SOUNDS[name]) return;
      const c = audio();
      if (!c) return;
      try { SOUNDS[name](c, master, c.currentTime + 0.01 + (delay || 0)); } catch (e) { /* ignorer lydfeil */ }
    },
    /** Spiller lyden som hører til en hendelse i config.sounds. */
    event(evt, delay) { this.play(FFF.config.sounds[evt], delay); },
    /** Kalles fra første trykk, så iOS tillater lyd. */
    unlock() { if (!muted) audio(); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* */ }
      if (!muted) { audio(); this.play('chirp'); }
      return muted;
    },
    names: Object.keys(SOUNDS)
  };
})(window.FFF);
