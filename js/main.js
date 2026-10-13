import { projects, SITES } from './projects.js?v=8';
import { setupTobDemo } from './tob-demo.js?v=8';

window.__mbw = true;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const mq = (q) => window.matchMedia(q).matches;
const reduced = mq('(prefers-reduced-motion: reduce)');
const finePointer = mq('(hover: hover) and (pointer: fine)');
// touch or low-power hardware: fewer particles, lower canvas resolution, lighter 3D
const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!navigator.connection?.saveData;
const lite = !finePointer || lowPower;
if (lite) root.classList.add('lite');
const sda = window.CSS?.supports?.('animation-timeline: view()') ?? false;
if (sda) root.classList.add('sda');

let lastPointerType = 'mouse';
window.addEventListener('pointerdown', (e) => { lastPointerType = e.pointerType; }, { capture: true, passive: true });

/* ------------------------------------------------------------------ sound */
// Every sound is synthesized with Web Audio (oscillators, filtered noise and a small generated
// reverb); there are no audio files. Nothing is created until sound is switched on AND the
// visitor has interacted with the page, so browsers never block or warn about autoplay.
const sound = (() => {
  let ctx = null, master = null, wet = null, noiseBuf = null, on = false;
  const last = {};
  try { on = localStorage.getItem('mbw-sound') === 'on'; } catch { /* storage blocked */ }

  // user activation: the browser's own flag where it exists, else the first real input
  let gestured = false;
  const mark = (e) => { if (e.type !== 'pointerdown' || e.pointerType === 'mouse') gestured = true; };
  ['pointerdown', 'pointerup', 'keydown'].forEach((t) => window.addEventListener(t, mark, { capture: true, passive: true }));
  const activated = () => navigator.userActivation?.hasBeenActive ?? gestured;

  function impulse(c, sec) {   // a soft, darkening noise tail for the reverb
    const n = Math.floor(sec * c.sampleRate), ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.35; d[i] = lp * Math.pow(1 - i / n, 3.2); }
    }
    return ir;
  }
  function audio() {
    if (!on || !activated()) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(comp).connect(ctx.destination);
      const verb = ctx.createConvolver();
      verb.buffer = impulse(ctx, 1.6);
      wet = ctx.createGain();
      wet.gain.value = 0.3;
      wet.connect(verb).connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function out(c, node, verb) {
    node.connect(master);
    if (verb) { const send = c.createGain(); send.gain.value = verb; node.connect(send).connect(wet); }
  }
  // one enveloped oscillator; lp runs it through a lowpass so square/saw blips stay round, not harsh
  function tone({ f = 600, f2 = 0, d = 0.08, type = 'sine', g = 0.05, delay = 0, attack = 0.006, verb = 0, lp = 0 }) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.01 + delay;
    const o = c.createOscillator();
    const amp = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(g, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + d);
    if (lp) {
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lp;
      filt.Q.value = 0.7;
      o.connect(filt).connect(amp);
    } else o.connect(amp);
    out(c, amp, verb);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  // a dry, punchy menu blip: a lowpassed square with a fast attack and a tiny pitch drop for snap
  const blip = (f, { d = 0.05, g = 0.016, delay = 0, lp = 3200, type = 'square' } = {}) =>
    tone({ f, f2: f * 0.97, d, g, delay, type, attack: 0.002, lp });
  // band-passed noise sweeping f0 -> f1: whooshes, risers and (very short) transient clicks
  function air({ f0 = 500, f1 = 2500, d = 0.5, g = 0.03, q = 1.1, delay = 0, peak = 0.45, verb = 0 }) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.01 + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + d);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(g, t + d * peak);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(bp).connect(amp);
    out(c, amp, verb);
    src.start(t, Math.random() * 1.2);
    src.stop(t + d + 0.05);
  }
  // a filter-swept saw swell for the startup stinger: the cutoff opens as the pitch climbs
  function swell({ f, f2, d, g, delay = 0, cut0 = 300, cut1 = 4000, verb = 0.3, detune = 0 }) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.01 + delay;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + d);
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 2;
    filt.frequency.setValueAtTime(cut0, t);
    filt.frequency.exponentialRampToValueAtTime(cut1, t + d);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(g, t + d * 0.92);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.04);
    o.connect(filt).connect(amp);
    out(c, amp, verb);
    o.start(t);
    o.stop(t + d + 0.1);
  }
  const throttled = (key, ms) => {
    const now = performance.now();
    if (now - (last[key] ?? -1e9) < ms) return true;
    last[key] = now;
    return false;
  };

  // The palette is modelled on a classic console pause menu: dry, short, lowpassed square blips
  // with no reverb. A tick for moving between items, a lower two-tone accept, a soft falling
  // back/cancel and a bright three-step arpeggio for leaving to another site.
  let stung = false, stungAt = -1e9;
  const api = {
    get on() { return on; },
    set(v) {
      on = v;
      try { localStorage.setItem('mbw-sound', v ? 'on' : 'off'); } catch { /* ignore */ }
      if (!v && ctx) ctx.suspend().catch(() => {});
      document.dispatchEvent(new Event('mbw:sound'));
    },
    // moving the highlight (hover, keyboard focus): a crisp tick with a hint of noise transient
    hover(card) {
      if (throttled('hover', 70)) return;
      blip(card ? 1760 : 1480, { d: 0.032, g: 0.011, lp: 4200 });
      air({ f0: 5200, f1: 4800, d: 0.012, g: 0.005, q: 1.5, peak: 0.2 });
    },
    // a generic press: the same tick, a step lower and a touch longer
    click() { if (!throttled('click', 40)) blip(1175, { d: 0.045, g: 0.016, lp: 3600 }); },
    // in-page navigation: a select tick that hops up a fifth
    nav() {
      if (throttled('nav', 60)) return;
      blip(988, { d: 0.04, g: 0.016 });
      blip(1480, { d: 0.05, g: 0.014, delay: 0.045 });
    },
    // opening a project: accept into a sub-menu
    open() {
      blip(784, { d: 0.055, g: 0.02 });
      blip(1175, { d: 0.08, g: 0.018, delay: 0.06 });
      air({ f0: 900, f1: 2600, d: 0.14, g: 0.005, q: 1.2 });
    },
    // back / cancel: a soft two-step fall, triangle so it reads gentler than accept
    close() {
      tone({ f: 740, d: 0.06, g: 0.022, type: 'triangle', attack: 0.002, lp: 2600 });
      tone({ f: 494, f2: 466, d: 0.11, g: 0.02, type: 'triangle', attack: 0.002, lp: 2200, delay: 0.065 });
    },
    // left/right between projects: a double tick
    flip() {
      if (throttled('flip', 50)) return;
      blip(1319, { d: 0.035, g: 0.013 });
      blip(1319, { d: 0.03, g: 0.008, delay: 0.04 });
    },
    // accept: lower than the tick, two tones up a fourth
    confirm() {
      if (throttled('confirm', 250)) return;
      blip(587, { d: 0.06, g: 0.024, lp: 2800 });
      blip(784, { d: 0.11, g: 0.022, lp: 2800, delay: 0.07 });
    },
    // leaving for another site: a quick bright saw arpeggio with a short lift of air
    visit() {
      if (throttled('visit', 250)) return;
      [659, 988, 1319].forEach((f, i) => blip(f, { d: i === 2 ? 0.14 : 0.05, g: 0.018, delay: i * 0.05, lp: 4400, type: 'sawtooth' }));
      air({ f0: 1400, f1: 5200, d: 0.2, g: 0.006, q: 1.4, delay: 0.08 });
    },
    reveal() { if (!throttled('reveal', 1600)) air({ f0: 500, f1: 1600, d: 0.28, g: 0.008, q: 0.9, peak: 0.4 }); },
    toggleOn() { if (!api.startup()) api.confirm(); },
    // the load-up stinger (~1.3s): a noise riser and detuned saws climbing an octave as the filter
    // opens, landing on a short punchy E major stab with a sub thump. Once per page load, never
    // under reduced motion, and only when sound is on and the page has had a real gesture.
    startup() {
      if (stung || reduced || !audio()) return false;
      stung = true;
      stungAt = performance.now();
      air({ f0: 300, f1: 6000, d: 1.05, g: 0.016, q: 0.8, peak: 0.95, verb: 0.2 });
      swell({ f: 110, f2: 220, d: 1.05, g: 0.016, detune: -8 });
      swell({ f: 165, f2: 330, d: 1.05, g: 0.012, detune: 9 });
      const hit = 1.08;
      [329.63, 415.3, 493.88, 659.25].forEach((f) => tone({ f, d: 0.32, g: 0.012, type: 'sawtooth', delay: hit, attack: 0.004, lp: 3000, verb: 0.35 }));
      blip(1319, { d: 0.18, g: 0.012, delay: hit, lp: 5000 });
      tone({ f: 110, f2: 45, d: 0.3, g: 0.07, delay: hit, attack: 0.003 });
      air({ f0: 3000, f1: 1800, d: 0.05, g: 0.012, q: 0.7, delay: hit, peak: 0.1 });
      return true;
    },
    // the intro's "Tap for sound" button
    intro() { api.startup(); },
    // the intro hands over; skipped while the stinger is still ringing
    outro() { if (performance.now() - stungAt > 1400) air({ f0: 2400, f1: 400, d: 0.3, g: 0.01, q: 0.9, peak: 0.25 }); },
    pulse() {
      tone({ f: 120, f2: 48, d: 0.4, g: 0.1 });
      blip(988, { d: 0.05, g: 0.014, delay: 0.02 });
      blip(1480, { d: 0.07, g: 0.012, delay: 0.07 });
    },
  };

  // no intro this load (or it ended before sound could play): the stinger waits for the first real input
  const first = () => { if (stung || (on && activated() && api.startup())) off(); };
  const off = () => ['pointerup', 'keydown'].forEach((t) => window.removeEventListener(t, first, true));
  ['pointerup', 'keydown'].forEach((t) => window.addEventListener(t, first, { capture: true, passive: true }));
  return api;
})();

const buzz = (ms = 8) => {
  if (lastPointerType !== 'touch' || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch { /* unsupported */ }
};

function setupSoundToggle() {
  const btn = $('.sound-toggle');
  const sync = () => {
    btn.setAttribute('aria-pressed', String(sound.on));
    btn.setAttribute('aria-label', sound.on ? 'Sound effects on. Turn off' : 'Sound effects off. Turn on');
  };
  sync();
  document.addEventListener('mbw:sound', sync);
  btn.addEventListener('click', () => {
    sound.set(!sound.on);
    if (sound.on) sound.toggleOn();
    toast(sound.on ? 'Sound on' : 'Sound off');
  });
  const hoverables = 'a, button, .chip, [data-sound]';
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !sound.on) return;
    const el = e.target.closest(hoverables);
    if (el && !el.contains(e.relatedTarget)) sound.hover(el.classList.contains('card'));
  });
  // keyboard focus moving between items ticks like menu up/down
  let keyNavAt = -1e9;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow')) keyNavAt = performance.now();
  }, { capture: true, passive: true });
  document.addEventListener('focusin', (e) => {
    if (!sound.on || performance.now() - keyNavAt > 300) return;
    const el = e.target.closest?.(hoverables);
    if (el) sound.hover(el.classList.contains('card'));
  });
  // navigation, quote/contact and visit-site actions get their own sounds; other presses tick in setupPress
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button');
    if (!el || !sound.on) return;
    if (el.matches('[data-sound="confirm"]')) sound.confirm();
    else if (el.matches('[data-sound="visit"]')) sound.visit();
    else if (el.matches('.links a, .to-top, .scroll-cue, .skip')) sound.nav();
  });
}

/* ------------------------------------------------------------------ startup intro */
// The overlay is switched on in <head> (html.intro-on) before first paint, so there is no flash and
// no layout shift: the page renders and loads behind it. It hands over after ~2.4s, or at once on a
// click, tap, key, wheel or swipe. Resolves when the hand-over starts, so the hero animates in as
// the overlay fades.
const INTRO_MS = 2400;
const intro = (() => {
  const el = $('#intro');
  if (!el || !root.classList.contains('intro-on')) return Promise.resolve(false);
  try { sessionStorage.setItem('mbw-intro', '1'); } catch { /* storage blocked: it shows again next load */ }

  return new Promise((resolve) => {
    const btn = $('.intro-sound', el);
    let done = false;
    const timer = setTimeout(() => leave(false), INTRO_MS);

    // offer sound unless it is already on and audible
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !(sound.on && navigator.userActivation?.hasBeenActive)) btn.hidden = false;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!sound.on) sound.set(true);
      sound.intro();
      btn.classList.add('is-on');
      btn.lastElementChild.textContent = 'Sound on';
    });

    const skip = () => leave(true);
    const onKey = (e) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      if (e.target === btn && (e.key === 'Enter' || e.key === ' ')) return;
      leave(true);
    };
    el.addEventListener('click', skip);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('touchmove', skip, { passive: true });

    function leave(fast) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener('click', skip);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', skip);
      window.removeEventListener('touchmove', skip);
      // fly the mark toward the hero monogram so the two read as one object
      const mark = $('.intro-mark', el);
      const target = $('#hero3d')?.getBoundingClientRect();
      if (target && target.width && target.bottom > 0 && target.top < innerHeight) {
        const m = mark.getBoundingClientRect();
        mark.style.setProperty('--fx', `${(target.left + target.width / 2 - (m.left + m.width / 2)).toFixed(1)}px`);
        mark.style.setProperty('--fy', `${(target.top + target.height / 2 - (m.top + m.height / 2)).toFixed(1)}px`);
        mark.style.setProperty('--fs', (Math.min(target.width / m.width, 1.4)).toFixed(3));
      }
      if (el.contains(document.activeElement)) document.activeElement.blur();
      el.classList.toggle('is-fast', fast);
      root.classList.add('intro-out', 'hero-enter');
      if (!sound.startup()) sound.outro();
      resolve(true);
      setTimeout(() => { el.remove(); root.classList.remove('intro-on', 'intro-out'); }, fast ? 450 : 800);
    }
  });
})();

/* ------------------------------------------------------------------ toast */
let toastTimer = 0;
function toast(msg) {
  const t = $('.toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------------ cursor + trail */
function setupCursor() {
  if (!finePointer || reduced) return;
  root.classList.add('has-cursor');
  const cur = $('.cursor');
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  const label = $('.cursor-label');
  const trail = $('.cursor-trail');
  const g = trail.getContext('2d');
  let dpr = 1, raf = 0, last = performance.now();
  const m = { x: -100, y: -100 }, r = { x: -100, y: -100 };
  const pts = [];

  const size = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    trail.width = innerWidth * dpr;
    trail.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  window.addEventListener('resize', size);

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    m.x = e.clientX; m.y = e.clientY;
    pts.push({ x: m.x, y: m.y, t: performance.now() });
    dot.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
    cur.classList.remove('is-hidden');
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
  window.addEventListener('pointerdown', () => cur.classList.add('is-down'));
  window.addEventListener('pointerup', () => cur.classList.remove('is-down'));

  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest('[data-cursor]');
    const hot = e.target.closest('a, button, .chip, .chrome-canvas');
    cur.classList.toggle('is-label', !!labelled);
    cur.classList.toggle('is-hover', !!hot && !labelled);
    label.textContent = labelled ? labelled.dataset.cursor : '';
  });

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = 1 - Math.exp(-dt * 16);
    r.x += (m.x - r.x) * k;
    r.y += (m.y - r.y) * k;
    ring.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;

    const life = 260;
    while (pts.length && now - pts[0].t > life) pts.shift();
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const p = 1 - (now - b.t) / life;
      g.strokeStyle = `hsla(${168 + (1 - p) * 100}, 90%, 72%, ${p * 0.55})`;
      g.lineWidth = p * 3.2;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    const settled = Math.abs(m.x - r.x) < 0.1 && Math.abs(m.y - r.y) < 0.1 && !pts.length;
    raf = settled ? 0 : requestAnimationFrame(tick);
  }
}

/* ------------------------------------------------------------------ particles + click sparks */
// Typed arrays and pre-built colour strings, so a frame allocates nothing. Links are
// bucketed by alpha and stroked as one path per bucket instead of one path per pair.
const fx = (() => {
  const c = $('.particles');
  const g = c.getContext('2d');
  const mouseFx = finePointer;
  const MAX = 90, LINK = 9000, NEAR = 26000, BUCKETS = 4, SEG = 700;
  const px = new Float32Array(MAX), py = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX);
  const pr = new Float32Array(MAX), pz = new Float32Array(MAX), sy = new Float32Array(MAX);
  const fill = new Array(MAX);
  const segs = Array.from({ length: BUCKETS }, () => ({ xy: new Float32Array(SEG * 4), n: 0 }));
  const linkStyle = Array.from({ length: BUCKETS }, (_, b) => `rgba(167, 139, 250, ${(((b + 0.5) / BUCKETS) * 0.12).toFixed(3)})`);
  const nearStyle = Array.from({ length: BUCKETS }, (_, b) => `rgba(94, 234, 212, ${(((b + 0.5) / BUCKETS) * 0.3).toFixed(3)})`);
  const sparks = [];
  const mouse = { x: -9999, y: -9999 };
  let w = 0, h = 0, n = 0, raf = 0, last = 0, scrollY = window.scrollY, paused = false;
  // 30fps is plenty for slow drifting dots on phones and low-power machines
  const minFrame = lite ? 1000 / 31 : 0;

  function seed() {
    const cap = lite ? (finePointer ? 40 : 26) : 72;
    n = Math.round(Math.min(cap, (w * h) / (finePointer ? 16000 : 15000)));
    for (let i = 0; i < n; i++) {
      px[i] = Math.random() * w; py[i] = Math.random() * h;
      vx[i] = (Math.random() - 0.5) * 0.22; vy[i] = (Math.random() - 0.5) * 0.22;
      pz[i] = Math.random() * 0.8 + 0.2;
      pr[i] = (Math.random() * 1.3 + 0.4) * pz[i] + 0.3;
      fill[i] = `hsla(${Math.random() < 0.55 ? 168 : 258}, 85%, 75%, ${(0.25 + pz[i] * 0.45).toFixed(2)})`;
    }
  }
  function resize() {
    const nw = innerWidth, nh = innerHeight;
    const widthChanged = nw !== w;
    w = nw; h = nh;
    const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (widthChanged || !n) seed();
    if (reduced) draw();
  }

  function addSeg(strength, ax, ay, bx, by) {
    const s = segs[Math.min(BUCKETS - 1, (strength * BUCKETS) | 0)];
    if (s.n >= SEG) return;
    const o = s.n++ * 4;
    s.xy[o] = ax; s.xy[o + 1] = ay; s.xy[o + 2] = bx; s.xy[o + 3] = by;
  }
  function strokeSegs(styles) {
    for (let b = 0; b < BUCKETS; b++) {
      const s = segs[b];
      if (!s.n) continue;
      g.strokeStyle = styles[b];
      g.beginPath();
      for (let k = 0; k < s.n; k++) { const o = k * 4; g.moveTo(s.xy[o], s.xy[o + 1]); g.lineTo(s.xy[o + 2], s.xy[o + 3]); }
      g.stroke();
      s.n = 0;
    }
  }

  function draw() {
    g.clearRect(0, 0, w, h);
    const off = scrollY * 0.12;
    for (let i = 0; i < n; i++) {
      if (!reduced) {
        px[i] += vx[i]; py[i] += vy[i];
        if (mouseFx) {
          const dx = px[i] - mouse.x, dy = sy[i] - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 14000) { const f = ((1 - d2 / 14000) * 0.6) / Math.sqrt(d2 + 1); px[i] += dx * f; py[i] += dy * f; }
        }
        if (px[i] < -10) px[i] = w + 10; else if (px[i] > w + 10) px[i] = -10;
        if (py[i] < -10) py[i] = h + 10; else if (py[i] > h + 10) py[i] = -10;
      }
      sy[i] = (((py[i] - off * pz[i]) % h) + h) % h;
      g.fillStyle = fill[i];
      g.beginPath(); g.arc(px[i], sy[i], pr[i], 0, 6.2832); g.fill();
    }
    if (mouseFx) {
      g.lineWidth = 0.6;
      for (let i = 0; i < n; i++) {
        const ax = px[i], ay = sy[i];
        for (let j = i + 1; j < n; j++) {
          const dx = ax - px[j], dy = ay - sy[j], d2 = dx * dx + dy * dy;
          if (d2 < LINK) addSeg(1 - d2 / LINK, ax, ay, px[j], sy[j]);
        }
      }
      strokeSegs(linkStyle);
      for (let i = 0; i < n; i++) {
        const mx = px[i] - mouse.x, my = sy[i] - mouse.y, md = mx * mx + my * my;
        if (md < NEAR) addSeg(1 - md / NEAR, px[i], sy[i], mouse.x, mouse.y);
      }
      strokeSegs(nearStyle);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= 1 / 60;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.vx *= 0.95; s.vy = s.vy * 0.95 + 0.12;
      s.x += s.vx; s.y += s.vy;
      const a = s.life / s.max;
      g.strokeStyle = s.style;
      g.globalAlpha = a;
      g.lineWidth = 2 * a + 0.4;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 2.2, s.y - s.vy * 2.2); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function loop(now) {
    raf = 0;
    if (document.hidden || paused) return;
    raf = requestAnimationFrame(loop);
    if (now - last < minFrame) return;
    last = now;
    draw();
  }
  function start() { if (!reduced && !raf && !paused && !document.hidden) raf = requestAnimationFrame(loop); }

  resize();
  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); }, { passive: true });
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  if (mouseFx) {
    window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  }
  document.addEventListener('visibilitychange', start);
  start();

  return {
    burst(x, y, count = 14) {
      if (reduced) return;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const v = 2.5 + Math.random() * 4;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 0.7, max: 0.7, style: Math.random() < 0.5 ? 'hsl(168, 95%, 72%)' : 'hsl(270, 95%, 72%)' });
      }
      start();
    },
    // stop drawing while something covers the page (the project modal)
    pause(v) { paused = v; if (!v) start(); },
  };
})();

/* ------------------------------------------------------------------ hero title: split + scramble */
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=?<>/\\';
function setupTitle() {
  let ci = 0;
  const chars = [];
  $$('[data-split]').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      s.dataset.char = ch;
      s.style.setProperty('--ci', ci++);
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
      chars.push(s);
    }
    if (el.classList.contains('chrome-text')) el.classList.add('is-split');
  });
  if (reduced) { chars.forEach((s) => s.classList.add('in')); return; }

  const scramble = (s, frames = 14) => {
    const real = s.dataset.char;
    if (real === ' ' || s._busy) return;
    s._busy = true;
    s.style.width = `${s.getBoundingClientRect().width}px`;
    s.style.textAlign = 'center';
    s.classList.add('is-scrambling');
    let f = 0;
    const step = () => {
      if (f++ < frames) {
        s.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        setTimeout(step, 38);
      } else {
        s.textContent = real;
        s.classList.remove('is-scrambling');
        s.style.width = '';
        s.style.textAlign = '';
        s._busy = false;
      }
    };
    step();
  };

  // letters animate in once the intro hands over (right away without one); the scramble also
  // waits for fonts so locked widths are right, but never longer than 1.2s
  const run = () => chars.forEach((s, i) => setTimeout(() => scramble(s, 8 + ((i * 3) % 9)), i * 45));
  const fonts = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]);
  intro.then(() => {
    chars.forEach((s) => s.classList.add('in'));
    fonts.then(run);
  });

  chars.forEach((s) => s.addEventListener('pointerenter', () => { scramble(s, 8); }));
}

/* ------------------------------------------------------------------ magnetic elements */
function setupMagnetic() {
  if (!finePointer || reduced) return;
  const items = $$('.magnetic').map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
  let raf = 0;
  const tick = () => {
    let moving = false;
    for (const it of items) {
      it.x += (it.tx - it.x) * 0.18;
      it.y += (it.ty - it.y) * 0.18;
      if (Math.abs(it.tx - it.x) > 0.05 || Math.abs(it.ty - it.y) > 0.05) moving = true;
      it.el.style.translate = `${it.x.toFixed(2)}px ${it.y.toFixed(2)}px`;
    }
    raf = moving ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  for (const it of items) {
    const strength = it.el.classList.contains('contact-link') ? 0.12 : 0.32;
    let b = null;
    it.el.addEventListener('pointerenter', () => { b = it.el.getBoundingClientRect(); }, { passive: true });
    it.el.addEventListener('pointermove', (e) => {
      b ??= it.el.getBoundingClientRect();
      it.tx = (e.clientX - (b.left + b.width / 2)) * strength;
      it.ty = (e.clientY - (b.top + b.height / 2)) * strength;
      kick();
    }, { passive: true });
    it.el.addEventListener('pointerleave', () => { b = null; it.tx = 0; it.ty = 0; kick(); });
  }
}

/* ------------------------------------------------------------------ 3D tilt cards with glare */
function setupTilt() {
  if (!finePointer || reduced) return;
  $$('.card').forEach((card) => {
    card.dataset.cursor = 'Open';
    let frame = 0, b = null, ex = 0, ey = 0;
    card.addEventListener('pointerenter', () => { b = null; }, { passive: true });
    card.addEventListener('pointermove', (e) => {
      ex = e.clientX; ey = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        b ??= card.getBoundingClientRect();
        const px = (ex - b.left) / b.width;
        const py = (ey - b.top) / b.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
        card.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
        card.style.setProperty('--gx', `${px * 100}%`);
        card.style.setProperty('--gy', `${py * 100}%`);
        card.style.setProperty('--go', '1');
        card.style.setProperty('--tx', `${20 + px * 60}%`);
      });
    }, { passive: true });
    // the cached rect goes stale if the page scrolls under a hovered card
    window.addEventListener('scroll', () => { b = null; }, { passive: true });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame); frame = 0; b = null;
      card.classList.remove('is-tilting');
      ['--rx', '--ry', '--go', '--tx'].forEach((p) => card.style.removeProperty(p));
    });
  });
}

/* ------------------------------------------------------------------ ripple + press + sparks */
function setupPress() {
  const sel = '.btn, .card, .chip, .contact-link, .icon-btn, .logo';
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(sel);
    if (!el || e.button > 0) return;
    if (!reduced && !el.classList.contains('icon-btn') && !el.classList.contains('logo')) {
      const b = el.getBoundingClientRect();
      const rp = document.createElement('span');
      rp.className = 'ripple';
      rp.style.left = `${e.clientX - b.left}px`;
      rp.style.top = `${e.clientY - b.top}px`;
      rp.style.setProperty('--rs', String(Math.hypot(b.width, b.height) / 4));
      rp.addEventListener('animationend', () => rp.remove());
      el.appendChild(rp);
    }
    el.classList.remove('pressed');
    void el.offsetWidth;
    el.classList.add('pressed');
    if (!el.matches('[data-sound="confirm"], [data-sound="visit"], .sound-toggle')) sound.click();
    buzz(10);
  });
  document.addEventListener('animationend', (e) => { if (e.animationName === 'press') e.target.classList.remove('pressed'); });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.btn.primary, .chip, .contact-link');
    if (el && e.detail > 0) fx.burst(e.clientX, e.clientY, el.classList.contains('chip') ? 8 : 16);
  });
}

/* ------------------------------------------------------------------ reveals, about words */
function setupReveal() {
  const els = $$('.reveal');
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  // a soft whoosh as a new section scrolls in (section openers only, and throttled in sound.reveal)
  const opener = '.kicker, .why-title, .contact-card';
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('in');
      io.unobserve(en.target);
      if (scrollY > 40 && en.target.matches(opener)) sound.reveal();
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  // below-the-fold reveals wait for the intro so nothing plays unseen behind it
  intro.then(() => els.forEach((el) => io.observe(el)));
}

function setupAboutWords() {
  const p = $('[data-words]');
  const words = p.textContent.trim().split(/\s+/);
  p.textContent = '';
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    p.appendChild(s);
    if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
    return s;
  });
  if (sda || reduced) return;
  // JS fallback: light words as the paragraph scrolls through the viewport
  let ticking = false;
  const update = () => {
    ticking = false;
    const b = p.getBoundingClientRect();
    const prog = Math.min(Math.max((innerHeight * 0.85 - b.top) / (b.height + innerHeight * 0.35), 0), 1);
    const lit = Math.round(prog * spans.length);
    spans.forEach((s, i) => s.classList.toggle('lit', i < lit));
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ------------------------------------------------------------------ scroll: nav, progress, parallax, marquee skew */
function setupScroll() {
  const nav = $('#nav');
  const copy = $('.hero-copy');
  const stage = $('.hero-stage');
  const progress = $('.progress');
  const track = $('.marquee-track');
  const links = $('#links');
  let lastY = scrollY, skew = 0, raf = 0, max = 0;
  const measure = () => { max = document.documentElement.scrollHeight - innerHeight; };
  measure();
  new ResizeObserver(measure).observe(document.body);
  window.addEventListener('resize', measure, { passive: true });

  const loop = () => {
    raf = 0;
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    nav.classList.toggle('is-scrolled', y > 20);
    if (!links.classList.contains('is-open')) nav.classList.toggle('is-hidden', dy > 4 && y > 600);
    if (dy < -4 || y < 600) nav.classList.remove('is-hidden');

    if (!sda) {
      progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : '0');
      if (!reduced) {
        const k = Math.min(y / innerHeight, 1);
        copy.style.transform = `translateY(${-120 * k}px)`;
        copy.style.opacity = String(1 - k);
        stage.style.transform = `translateY(${80 * k}px) scale(${1 - 0.1 * k})`;
        stage.style.opacity = String(1 - 0.8 * k);
      }
    }
    if (!reduced) {
      skew += (Math.max(-8, Math.min(8, dy * 0.25)) - skew) * 0.2;
      track.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
      if (Math.abs(skew) > 0.02) raf = requestAnimationFrame(loop);
    }
  };
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
  loop();

  // active section in nav
  const navLinks = $$('[data-nav]');
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${en.target.id}`));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['services', 'work', 'featured', 'about', 'process', 'contact'].forEach((id) => io.observe(document.getElementById(id)));
  const hero = $('.hero');
  new IntersectionObserver(([en]) => { if (en.isIntersecting) navLinks.forEach((a) => a.classList.remove('is-active')); }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
}

function setupMenu() {
  const btn = $('.menu-toggle');
  const links = $('#links');
  const set = (open) => {
    links.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  btn.addEventListener('click', () => set(!links.classList.contains('is-open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && links.classList.contains('is-open')) { set(false); btn.focus(); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) set(false); });
}

function setupMarquee() {
  const track = $('.marquee-track');
  const group = $('.marquee-group', track);
  track.appendChild(group.cloneNode(true));
}

/* ------------------------------------------------------------------ view transitions helper */
function transition(update) {
  if (!document.startViewTransition || reduced) { update(); return Promise.resolve(); }
  const vt = document.startViewTransition(update);
  vt.ready.catch(() => {});
  vt.updateCallbackDone.catch(() => {});
  return vt.finished.catch(() => {});
}

/* ------------------------------------------------------------------ filters */
function setupFilters() {
  const chips = $$('.filters .chip');
  const wraps = $$('.card-wrap');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    if (chip.classList.contains('is-active')) return;
    const f = chip.dataset.filter;
    wraps.forEach((w) => { w.style.viewTransitionName = `card-${w.firstElementChild.dataset.project}`; });
    transition(() => {
      chips.forEach((c) => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      wraps.forEach((w) => {
        const show = f === 'all' || w.dataset.cat.split(' ').includes(f);
        w.classList.toggle('is-hidden', !show);
        if (show) w.classList.add('in');
      });
    }).then(() => wraps.forEach((w) => { w.style.viewTransitionName = ''; }));
  }));
}

/* ------------------------------------------------------------------ live sites */
// Visit site links for projects with a public display site (SITES in projects.js). Cards are
// <button>s, so each card's link sits beside it in the card-wrap rather than inside it.
function siteLink(url, label, className) {
  const a = document.createElement('a');
  a.className = className;
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.dataset.sound = 'visit';
  a.dataset.cursor = 'Visit';
  a.innerHTML = `<span>${label}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>`;
  return a;
}
function setupSites() {
  projects.forEach((p) => {
    if (!p.site) return;
    const a = siteLink(p.site, 'Visit site', 'btn ghost small card-visit');
    a.setAttribute('aria-label', `Visit the ${p.title} site (opens in a new tab)`);
    $(`.card[data-project="${p.id}"]`).after(a);
  });
  const box = $('.live-sites');
  const live = [['TOB', SITES.tob], ['FIN', SITES.fin], ['GAR', SITES.gar]].filter(([, url]) => url);
  live.forEach(([name, url]) => {
    const li = document.createElement('li');
    li.append(siteLink(url, name, 'btn ghost small live-site'));
    $('.live-sites-list', box).append(li);
  });
  box.hidden = !live.length;
}

/* ------------------------------------------------------------------ project modal */
function setupModal() {
  const dlg = $('#modal');
  const inner = $('.modal-inner', dlg);
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const order = projects.map((p) => p.id);
  const cardFor = (id) => $(`.card[data-project="${id}"]`);
  let current = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fill(id) {
    const p = byId[id];
    const card = cardFor(id);
    current = id;
    inner.style.setProperty('--h1', card.style.getPropertyValue('--h1'));
    inner.style.setProperty('--h2', card.style.getPropertyValue('--h2'));
    const icon = $('.modal-icon', dlg);
    const fresh = icon.cloneNode(false);
    fresh.innerHTML = $('.thumb-icon', card).innerHTML;
    icon.replaceWith(fresh);
    const idx = order.indexOf(id);
    $('.modal-num', dlg).textContent = `${String(idx + 1).padStart(2, '0')} / ${String(order.length).padStart(2, '0')}`;
    $('.modal-tag', dlg).textContent = p.tag;
    $('.modal-title', dlg).textContent = p.title;
    $('.modal-summary', dlg).textContent = p.summary;
    const visit = $('.modal-visit', dlg);
    visit.hidden = !p.site;
    if (p.site) {
      visit.href = p.site;
      visit.setAttribute('aria-label', `Visit the ${p.title} site (opens in a new tab)`);
    }
    $('.modal-demo', dlg).hidden = !(p.demo && demoReady);
    const items = p.items || [];
    $('.modal-items-title', dlg).hidden = !items.length;
    $('.modal-items', dlg).innerHTML = items.map((it, i) => `<li style="--i:${i}"><strong>${esc(it.name)}</strong><span>${esc(it.text)}</span></li>`).join('');
    $('.modal-features', dlg).innerHTML = p.features.map((f, i) => `<li style="--i:${i}">${esc(f)}</li>`).join('');
    $('.modal-tech', dlg).innerHTML = p.tech.map((t) => `<li>${esc(t)}</li>`).join('');
    $('.modal-facts', dlg).innerHTML = Object.entries(p.facts).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    const linksBox = $('.modal-links', dlg);
    $('.modal-links-title', dlg).hidden = !p.links.length;
    linksBox.innerHTML = p.links.map((l) => `<button type="button" class="chip" data-goto="${l}">${esc(byId[l].title)} &rarr;</button>`).join('');
    $('.modal-count', dlg).textContent = `Project ${idx + 1} of ${order.length}`;
    $('.modal-body', dlg).scrollTop = 0;
  }

  function open(id) {
    const thumb = $('.thumb', cardFor(id));
    sound.open();
    if (document.startViewTransition && !reduced) {
      thumb.style.viewTransitionName = 'project-hero';
      dlg.classList.add('no-anim');
      transition(() => {
        thumb.style.viewTransitionName = '';
        fill(id);
        dlg.showModal();
      }).then(() => dlg.classList.remove('no-anim'));
    } else {
      fill(id);
      dlg.showModal();
    }
    fx.pause(true);
  }

  function close() {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    sound.close();
    const thumb = current && $('.thumb', cardFor(current));
    const visible = thumb && thumb.getBoundingClientRect().width > 0;
    if (document.startViewTransition && !reduced && visible) {
      transition(() => {
        dlg.close();
        thumb.style.viewTransitionName = 'project-hero';
      }).then(() => { thumb.style.viewTransitionName = ''; });
    } else if (reduced) {
      dlg.close();
    } else {
      dlg.classList.add('is-closing');
      dlg.addEventListener('animationend', () => { dlg.classList.remove('is-closing'); dlg.close(); }, { once: true });
    }
  }

  function step(dir) {
    const i = (order.indexOf(current) + dir + order.length) % order.length;
    swap(order[i]);
  }
  function swap(id) {
    sound.flip();
    if (reduced) { fill(id); return; }
    inner.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 140, easing: 'ease-in' })
      .finished.then(() => {
        fill(id);
        inner.animate([{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }).catch(() => fill(id));
  }

  $$('.card').forEach((card) => card.addEventListener('click', () => open(card.dataset.project)));
  $('.modal-close', dlg).addEventListener('click', close);
  $('.modal-prev', dlg).addEventListener('click', () => step(-1));
  $('.modal-next', dlg).addEventListener('click', () => step(1));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('close', () => fx.pause(false));
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
    const go = e.target.closest('[data-goto]');
    if (go) swap(go.dataset.goto);
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });
}

/* ------------------------------------------------------------------ TOB demo */
// The scripted Talk to TOB dialog (js/tob-demo.js), opened from the TOB card and its case study.
// It can open on top of the project modal, so background effects stay paused while either is open.
let demoReady = false;
function setupDemo() {
  demoReady = !!setupTobDemo({
    reduced,
    onOpen: () => { sound.open(); fx.pause(true); },
    onClose: () => { sound.close(); fx.pause($('#modal').open); },
  });
}

/* ------------------------------------------------------------------ contact */
function setupContact() {
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied ${text}`);
    } catch {
      toast(text);
    }
  }));
}

/* ------------------------------------------------------------------ 3D: hero monogram + infinity loop */
let glOk = null;
function hasWebGL() {
  if (glOk === null) {
    try {
      const c = document.createElement('canvas');
      glOk = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { glOk = false; }
  }
  return glOk;
}

function mountStage(canvas, load) {
  const stage = canvas.closest('[data-stage]');
  canvas.dataset.cursor = 'Drag';
  if (!hasWebGL()) { stage.classList.add('no-webgl'); return; }
  let pulseTimer = 0;
  const onPulse = () => {
    sound.pulse();
    buzz(18);
    stage.classList.add('is-pulse');
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => stage.classList.remove('is-pulse'), 120);
  };
  load()
    .then((init) => init(canvas, { reduced, lite, onPulse }))
    .catch((err) => {
      console.warn('3D scene unavailable, using fallback.', err);
      stage.classList.add('no-webgl');
    });
}

function setupHero() {
  mountStage($('#hero3d'), () => import('./hero3d.js').then((m) => m.initHero));
}

// the infinity loop (and its WebGL context) only spins up once its section is near the viewport
function setupLoop() {
  const canvas = $('#loop3d');
  const go = () => mountStage(canvas, () => import('./infinity3d.js').then((m) => m.initInfinity));
  if (!('IntersectionObserver' in window)) { go(); return; }
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    go();
  }, { rootMargin: '600px 0px' });
  io.observe(canvas);
}

// pause decorative CSS animations in blocks that are off screen
function setupOffscreen() {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) en.target.classList.toggle('is-off', !en.isIntersecting);
  });
  $$('.hero, .marquee, .svc-grid, .svc-cta, .loop-stage, .contact-card, .grid').forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ featured video */
// The mix plays on the page in a youtube-nocookie embed driven by the IFrame API with our own controls.
// Nothing from YouTube loads until the first play. The player sits under an inert, cropped stage and a
// click-swallowing shield, so visitors can't reach YouTube's title, channel, logo or suggested videos,
// and playback stops just before the end so the end screen never shows.
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (loadYouTubeApi.p) return loadYouTubeApi.p;
  loadYouTubeApi.p = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { loadYouTubeApi.p = null; s.remove(); reject(new Error('YouTube API failed to load')); };
    document.head.append(s);
  });
  return loadYouTubeApi.p;
}

function setupFeatured() {
  const frame = $('[data-yt]');
  if (!frame) return;
  const poster = $('.feat-poster', frame);
  const shield = $('.feat-shield', frame);
  const status = $('.feat-status', frame);
  const controls = $('.feat-controls', frame);
  const playBtn = $('.fc-play', frame);
  const muteBtn = $('.fc-mute', frame);
  const seek = $('.fc-seek', frame);
  const vol = $('.fc-vol', frame);
  const curEl = $('.fc-cur', frame);
  const durEl = $('.fc-dur', frame);
  const END_GUARD = 0.5; // seconds before the end where playback is cut, ahead of YouTube's end cards
  let player = null;
  let ready = false;
  let playing = false;
  let seeking = false;
  let tick = 0;
  let idleTimer = 0;
  let autoplayCheck = 0;

  const fmt = (t) => {
    t = Math.max(0, Math.floor(t || 0));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  };
  const fill = (input) => input.style.setProperty('--p', `${(input.value / input.max) * 100}%`);
  const duration = () => (ready ? player.getDuration() || 0 : 0);
  const clampSeek = (t) => Math.max(0, Math.min(t, duration() - END_GUARD - 0.5));

  function setPaused(paused) {
    frame.classList.toggle('is-paused', paused);
    playBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    poster.setAttribute('aria-label', paused && frame.classList.contains('is-started') ? 'Resume HEAVEN GATES' : 'Play HEAVEN GATES, mixed by Waku');
    shield.dataset.cursor = paused ? 'Play' : 'Pause';
  }

  function syncMute() {
    const muted = player.isMuted() || player.getVolume() === 0;
    frame.classList.toggle('is-muted', muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    vol.value = muted ? 0 : player.getVolume();
    fill(vol);
  }

  function update() {
    if (!ready) return;
    const d = duration();
    const t = player.getCurrentTime() || 0;
    if (playing && d > 1 && t >= d - END_GUARD) { reset(); return; }
    durEl.textContent = fmt(d);
    if (!seeking) {
      curEl.textContent = fmt(t);
      seek.value = d ? Math.round((t / d) * 1000) : 0;
      seek.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(d)}`);
      fill(seek);
    }
  }

  // back to the poster: stop the player so YouTube's end screen and suggestions never render
  function reset() {
    const hadFocus = frame.contains(document.activeElement);
    playing = false;
    clearInterval(tick);
    clearTimeout(autoplayCheck);
    if (ready) player.stopVideo();
    frame.classList.remove('is-started', 'is-loading', 'is-idle');
    setPaused(true);
    controls.hidden = true;
    seek.value = 0; fill(seek);
    curEl.textContent = fmt(0);
    if (hadFocus) poster.focus({ preventScroll: true });
  }

  function onState(e) {
    const S = window.YT.PlayerState;
    if (e.data === S.PLAYING) {
      clearTimeout(autoplayCheck);
      playing = true;
      frame.classList.remove('is-loading');
      frame.classList.add('is-started');
      controls.hidden = false;
      setPaused(false);
      status.textContent = '';
      clearInterval(tick);
      tick = setInterval(update, 200);
      syncMute();
      update();
      poke();
    } else if (e.data === S.PAUSED) {
      playing = false;
      clearInterval(tick);
      setPaused(true);
      update();
    } else if (e.data === S.ENDED) {
      reset();
    }
  }

  function onError(e) {
    clearTimeout(autoplayCheck);
    frame.classList.remove('is-loading', 'is-started');
    controls.hidden = true;
    // 101 / 150: the owner turned off embedding
    status.textContent = e.data === 101 || e.data === 150
      ? 'This video canâ€™t be played here right now.'
      : 'The video didnâ€™t load. Try again.';
  }

  function start() {
    frame.classList.add('is-loading');
    status.textContent = '';
    player.playVideo();
    // phones may block playback with sound; fall back to muted play, the mute button turns sound on
    clearTimeout(autoplayCheck);
    autoplayCheck = setTimeout(() => {
      if (!playing && ready) { player.mute(); player.playVideo(); }
    }, 2500);
  }

  function play() {
    if (ready) {
      if (frame.classList.contains('is-started')) player.playVideo(); else start();
      return;
    }
    if (player || frame.classList.contains('is-loading')) return; // still loading
    frame.classList.add('is-loading');
    loadYouTubeApi().then((YT) => {
      player = new YT.Player($('.feat-player', frame), {
        host: 'https://www.youtube-nocookie.com',
        videoId: frame.dataset.yt,
        width: '100%',
        height: '100%',
        playerVars: {
          enablejsapi: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1,
          iv_load_policy: 3, playsinline: 1, cc_load_policy: 0, origin: location.origin,
        },
        events: {
          onReady: () => {
            ready = true;
            const f = player.getIframe();
            f.title = frame.dataset.ytTitle;
            f.tabIndex = -1;
            f.setAttribute('allow', 'autoplay; encrypted-media');
            f.removeAttribute('allowfullscreen');
            start();
          },
          onStateChange: onState,
          onError,
        },
      });
    }).catch(() => {
      frame.classList.remove('is-loading');
      status.textContent = 'The video didnâ€™t load. Check your connection and try again.';
    });
  }

  const toggle = () => (playing ? player.pauseVideo() : play());

  // hide the controls after a moment without pointer movement while playing
  function poke() {
    frame.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => frame.classList.add('is-idle'), 2600);
  }

  poster.addEventListener('click', play);
  // on touch, the first tap on a playing video brings the controls back instead of pausing
  let pointerType = 'mouse';
  shield.addEventListener('pointerdown', (e) => { pointerType = e.pointerType; });
  shield.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ready) return;
    if (pointerType === 'touch' && playing && frame.classList.contains('is-idle')) poke(); else toggle();
  });
  shield.addEventListener('auxclick', (e) => e.preventDefault());
  shield.addEventListener('contextmenu', (e) => e.preventDefault());
  frame.addEventListener('pointermove', poke);
  frame.addEventListener('focusin', poke);
  playBtn.addEventListener('click', toggle);
  muteBtn.addEventListener('click', () => {
    if (!ready) return;
    if (player.isMuted() || player.getVolume() === 0) {
      player.unMute();
      if (player.getVolume() === 0) player.setVolume(60);
    } else player.mute();
    setTimeout(syncMute, 80);
  });
  vol.addEventListener('input', () => {
    if (!ready) return;
    const v = Number(vol.value);
    player.setVolume(v);
    if (v > 0) player.unMute(); else player.mute();
    fill(vol);
    frame.classList.toggle('is-muted', v === 0);
    muteBtn.setAttribute('aria-pressed', String(v === 0));
    muteBtn.setAttribute('aria-label', v === 0 ? 'Unmute' : 'Mute');
  });
  seek.addEventListener('input', () => {
    seeking = true;
    const d = duration();
    const t = (seek.value / 1000) * d;
    curEl.textContent = fmt(t);
    seek.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(d)}`);
    fill(seek);
  });
  seek.addEventListener('change', () => {
    seeking = false;
    if (duration()) player.seekTo(clampSeek((seek.value / 1000) * duration()), true);
  });
  // k toggles play, j / l skip 10s, while focus is on the controls
  controls.addEventListener('keydown', (e) => {
    if (!ready || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'j' || e.key === 'l') {
      e.preventDefault();
      player.seekTo(clampSeek(player.getCurrentTime() + (e.key === 'l' ? 10 : -10)), true);
    }
  });
  // stop the music once the section scrolls out of view
  new IntersectionObserver(([en]) => { if (!en.isIntersecting && playing) player.pauseVideo(); }).observe(frame);
}

/* ------------------------------------------------------------------ boot */
$('#year').textContent = new Date().getFullYear();
setupSoundToggle();
setupTitle();
setupHero();
setupLoop();
setupOffscreen();
setupCursor();
setupMagnetic();
setupTilt();
setupPress();
setupReveal();
setupAboutWords();
setupMarquee();
setupScroll();
setupMenu();
setupFilters();
setupSites();
setupModal();
setupDemo();
setupContact();
setupFeatured();
