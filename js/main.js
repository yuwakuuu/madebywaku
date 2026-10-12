import { projects } from './projects.js';

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
const sound = (() => {
  let ctx = null, master = null, on = false, lastHover = 0;
  try { on = localStorage.getItem('mbw-sound') === 'on'; } catch { /* storage blocked */ }

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
  function tone({ f = 600, f2 = 0, d = 0.08, type = 'sine', g = 0.05, delay = 0 }) {
    if (!on) return;
    const c = audio();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const gain = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(g, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gain).connect(master);
    o.start(t);
    o.stop(t + d + 0.03);
  }
  return {
    get on() { return on; },
    set(v) {
      on = v;
      try { localStorage.setItem('mbw-sound', v ? 'on' : 'off'); } catch { /* ignore */ }
    },
    hover() {
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      tone({ f: 1500, d: 0.035, g: 0.012, type: 'triangle' });
    },
    click() { tone({ f: 380, f2: 760, d: 0.09, g: 0.05 }); },
    open() { [523, 659, 784].forEach((f, i) => tone({ f, d: 0.22, g: 0.035, type: 'triangle', delay: i * 0.045 })); },
    close() { tone({ f: 660, f2: 330, d: 0.12, g: 0.04, type: 'triangle' }); },
    pulse() { tone({ f: 120, f2: 48, d: 0.45, g: 0.14 }); tone({ f: 900, f2: 1800, d: 0.2, g: 0.025, type: 'triangle', delay: 0.02 }); },
    on_() { tone({ f: 660, d: 0.08, g: 0.045, type: 'triangle' }); tone({ f: 990, d: 0.12, g: 0.04, type: 'triangle', delay: 0.07 }); },
  };
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
  btn.addEventListener('click', () => {
    sound.set(!sound.on);
    sync();
    if (sound.on) sound.on_();
    toast(sound.on ? 'Sound on' : 'Sound off');
  });
  const hoverables = 'a, button, .chip, [data-sound]';
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !sound.on) return;
    const el = e.target.closest(hoverables);
    if (el && !el.contains(e.relatedTarget)) sound.hover();
  });
}

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

  // letters animate in right away; the scramble waits for fonts so locked widths are right
  chars.forEach((s) => s.classList.add('in'));
  const run = () => chars.forEach((s, i) => setTimeout(() => scramble(s, 8 + ((i * 3) % 9)), i * 45));
  // never wait longer than 1.2s
  Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(run);

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
    sound.click();
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
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('in');
      io.unobserve(en.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => io.observe(el));
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
  ['services', 'work', 'about', 'process', 'contact'].forEach((id) => io.observe(document.getElementById(id)));
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
    sound.click();
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
setupModal();
setupContact();
