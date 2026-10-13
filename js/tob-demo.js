// Talk to TOB: a scripted demo of TOB, opened from the TOB card and its case study.
// Ported from the demo on TOB's own site: the same hologram (a canvas port of TOB-OS's hologram),
// the same chat and the same lines in TOB's butler persona. Everything runs in this page: replies
// are written ahead of time, nothing is fetched, and it cannot control anyone's computer.
// Voice is off until the visitor turns it on; the mic only listens after the visitor presses it.

/* ------------------------------------------------------------------ hologram */
// Shapes in "bust units": x -1..1 (shoulders), y -1.45 (crown) .. 0.8 (fade).
function smooth(pts, closed, path = new Path2D()) {
  const n = pts.length;
  const seq = closed ? pts.concat(pts.slice(0, 3)) : [pts[0], ...pts, pts[n - 1]];
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = closed ? 0 : 1; i < n; i++) {
    const p0 = closed ? seq[i ? i - 1 : n - 1] : seq[i - 1];
    const p1 = seq[i], p2 = seq[i + 1], p3 = seq[i + 2];
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
                       p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}
const mirror = (pts) => pts.map((p) => [-p[0], p[1]]);
const sym = (half) => smooth(half.concat(mirror(half).reverse().slice(1, -1)), true);
const hairPath = (outer, inner) => smooth(outer.concat(mirror(outer.slice(0, -1)).reverse(), mirror(inner.slice(1)).reverse(), inner), true);
const both = (fn) => { fn(-1); fn(1); };

// The butler: an older gentleman in a tailcoat, wing collar and bow tie.
function butler() {
  const b = { bodyAlpha: 0.24, frontAlpha: 0.07, tieAlpha: 0.55, browArch: 1 };
  b.head = sym([[0, -1.46], [0.2, -1.42], [0.325, -1.31], [0.365, -1.13], [0.36, -0.97], [0.33, -0.81],
                [0.28, -0.69], [0.2, -0.615], [0.11, -0.575], [0, -0.56]]);
  const n = b.neck = new Path2D();
  n.moveTo(-0.165, -0.66); n.bezierCurveTo(-0.17, -0.55, -0.19, -0.47, -0.21, -0.42);
  n.lineTo(0.21, -0.42); n.bezierCurveTo(0.19, -0.47, 0.17, -0.55, 0.165, -0.66); n.closePath();
  b.ears = new Path2D();
  both((s) => {
    smooth([[s * 0.36, -1.06], [s * 0.43, -1.07], [s * 0.445, -0.97], [s * 0.41, -0.86], [s * 0.35, -0.84]], false, b.ears);
  });
  b.hair = hairPath([[0.385, -0.99], [0.40, -1.18], [0.355, -1.34], [0.22, -1.445], [0, -1.49]],
                    [[0, -1.355], [0.08, -1.37], [0.17, -1.385], [0.27, -1.315], [0.335, -1.2], [0.352, -1.05]]);
  b.strands = new Path2D();
  both((s) => {
    for (let k = 0; k < 4; k++) {
      const o = k * 0.045;
      smooth([[s * (0.06 + o * 1.4), -1.38 - o * 0.4], [s * (0.2 + o), -1.42 + o * 0.3],
              [s * (0.33 + o * 0.25), -1.32 + o * 1.2], [s * (0.37 + o * 0.1), -1.15 + o * 1.3]], false, b.strands);
    }
  });
  const t = b.torso = new Path2D();
  t.moveTo(-0.21, -0.42); t.bezierCurveTo(-0.45, -0.37, -0.7, -0.31, -0.83, -0.17);
  t.bezierCurveTo(-0.95, -0.04, -0.97, 0.3, -0.95, 0.8); t.lineTo(0.95, 0.8);
  t.bezierCurveTo(0.97, 0.3, 0.95, -0.04, 0.83, -0.17); t.bezierCurveTo(0.7, -0.31, 0.45, -0.37, 0.21, -0.42); t.closePath();
  const l = b.lapels = new Path2D();
  both((s) => {
    l.moveTo(s * 0.2, -0.41); l.bezierCurveTo(s * 0.32, -0.3, s * 0.44, -0.18, s * 0.56, -0.13);
    l.lineTo(s * 0.47, -0.04); l.lineTo(s * 0.5, 0.02); l.bezierCurveTo(s * 0.42, 0.2, s * 0.34, 0.42, s * 0.28, 0.66);
  });
  b.front = new Path2D(); b.front.moveTo(-0.27, -0.3); b.front.lineTo(0, 0.28); b.front.lineTo(0.27, -0.3);
  const e = b.edges = new Path2D();
  e.moveTo(-0.27, -0.3); e.bezierCurveTo(-0.27, 0.1, -0.25, 0.4, -0.22, 0.72);
  e.moveTo(0.27, -0.3); e.bezierCurveTo(0.27, 0.1, 0.25, 0.4, 0.22, 0.72);
  b.buttons = [[0, 0.38], [0, 0.52], [0, 0.66]];
  const c = b.collar = new Path2D();
  both((s) => {
    c.moveTo(s * 0.03, -0.43); c.lineTo(s * 0.2, -0.47); c.lineTo(s * 0.22, -0.38); c.lineTo(s * 0.1, -0.35); c.closePath();
  });
  const w = b.tie = new Path2D();
  both((s) => {
    w.moveTo(s * 0.025, -0.395); w.bezierCurveTo(s * 0.06, -0.43, s * 0.13, -0.445, s * 0.15, -0.43);
    w.bezierCurveTo(s * 0.16, -0.40, s * 0.16, -0.365, s * 0.15, -0.345);
    w.bezierCurveTo(s * 0.12, -0.335, s * 0.06, -0.355, s * 0.025, -0.385); w.closePath();
  });
  w.rect(-0.03, -0.41, 0.06, 0.05);
  const p = b.pocket = new Path2D();
  p.moveTo(-0.72, 0.13); p.lineTo(-0.54, 0.115); p.moveTo(-0.69, 0.128);
  [[-0.665, 0.085], [-0.645, 0.11], [-0.62, 0.075], [-0.6, 0.105], [-0.58, 0.09], [-0.565, 0.118]].forEach((q) => p.lineTo(q[0], q[1]));
  b.nose = smooth([[0.012, -1.02], [0.02, -0.93], [0.045, -0.845], [0.02, -0.825]]);
  b.nostrils = new Path2D(); b.cheeks = new Path2D(); b.wrinkles = new Path2D();
  both((s) => {
    smooth([[s * 0.025, -0.83], [s * 0.055, -0.835], [s * 0.068, -0.85]], false, b.nostrils);
    smooth([[s * 0.09, -0.86], [s * 0.13, -0.8], [s * 0.135, -0.73]], false, b.cheeks);
  });
  [[-1.215, 0.15], [-1.18, 0.12], [-1.25, 0.09]].forEach((r) => {
    smooth([[-r[1], r[0] + 0.006], [0, r[0] - 0.004], [r[1], r[0] + 0.006]], false, b.wrinkles);
  });
  both((s) => {
    smooth([[s * 0.11, -0.968], [s * 0.155, -0.958], [s * 0.2, -0.968]], false, b.wrinkles);
    smooth([[s * 0.105, -0.725], [s * 0.118, -0.69], [s * 0.13, -0.655]], false, b.wrinkles);
    smooth([[s * 0.255, -0.84], [s * 0.24, -0.76], [s * 0.215, -0.7]], false, b.wrinkles);
  });
  b.moustache = sym([[0, -0.805], [0.06, -0.815], [0.12, -0.795], [0.145, -0.765], [0.11, -0.765], [0.05, -0.775], [0, -0.77]]);
  return b;
}

// TOB's palette (tob/ui/theme.py): a blue projection tinted by his state colour.
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL = {
  holo: '#6fd8ff', light: '#e9f7ff', lightFill: '#dff4ff', eye: '#f2fbff', mote: '#e6fbff', dark: '#02121a', base: '#0b141a',
  states: { booting: '#5e5ce6', online: '#0a84ff', listening: '#30d158', thinking: '#bf5af2', speaking: '#64d2ff' },
};
const ENERGY = { booting: 0.6, online: 0.3, listening: 0.7, thinking: 1.5, speaking: 0.9 };
const WHITE = [255, 255, 255];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const lerp = (a, b, k) => a + (b - a) * k;

function createHologram(canvas, { calm = false } = {}) {   // calm (reduced motion): no sway, drift, glitches or sweeping light
  const ctx = canvas.getContext('2d');
  const fig = document.createElement('canvas'), fctx = fig.getContext('2d');
  const glow = document.createElement('canvas'), gctx = glow.getContext('2d');
  const bust = butler();
  let state = 'online';
  let color = hex(PAL.states.booting), target = hex(PAL.states.online);
  let energy = 0.6, targetEnergy = ENERGY.online;
  let level = 0, smoothLevel = 0;
  let presence = calm ? 1 : 0, presenceStart = null;
  let t = 0, last = 0, running = false, raf = 0;
  let blinkAt = 2.5, blink = 0;
  let glance = [0, 0], glanceTarget = [0, 0], glanceAt = 1;
  let look = [0, 0], lookSmooth = [0, 0], lookAt = -10;
  let glitchUntil = 0, glitchBands = [], nextGlitch = 4;
  let W = 0, H = 0, dpr = 1, scanPattern = null;
  const motes = [];
  for (let i = 0; i < 26; i++) motes.push([Math.random() * 1.4 - 0.7, Math.random(), 0.2 + Math.random() * 0.4, 0.6 + Math.random()]);

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = fig.width = W; canvas.height = fig.height = H;
    glow.width = Math.max(1, W / 5 | 0); glow.height = Math.max(1, H / 5 | 0);
    const step = Math.max(2, Math.round(Math.min(H / 3.05, W / 2.5) / 60));
    const m = document.createElement('canvas'); m.width = 1; m.height = step * 2;
    const mc = m.getContext('2d');
    mc.fillStyle = 'rgba(0,0,0,0.59)'; mc.fillRect(0, 0, 1, step);
    mc.fillStyle = 'rgba(0,0,0,1)'; mc.fillRect(0, step, 1, step);
    scanPattern = fctx.createPattern(m, 'repeat');
    if (!running) draw();
  }

  function tint() {
    const h = hex(PAL.holo);
    return [lerp(h[0], color[0], 0.42), lerp(h[1], color[1], 0.42), lerp(h[2], color[2], 0.42)];
  }

  function headTransform(c) {
    const tilt = state === 'listening' ? 3.2 : state === 'thinking' ? -1.6 + 0.8 * Math.sin(t * 0.9) : 0;
    const nod = state === 'speaking' ? 0.012 * Math.sin(t * 7) * smoothLevel : 0;
    const sway = calm ? 0 : 0.9 * Math.sin(t * 0.45);
    const turn = lookSmooth[0] * 3.5;   // he inclines his head toward the visitor
    c.translate(0, -0.62);
    c.rotate((tilt + sway + turn) * Math.PI / 180);
    c.translate(0, 0.62 + nod + (calm ? 0 : 0.006 * Math.sin(t * 1.3)));
  }

  function paintBody(c, col, pres, lw) {
    const b = bust;
    const g = c.createLinearGradient(0, -0.45, 0, 0.8);
    g.addColorStop(0, rgba(col, b.bodyAlpha * pres)); g.addColorStop(0.65, rgba(col, b.bodyAlpha * 0.375 * pres)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fill(b.torso);
    c.fillStyle = rgba(col, b.frontAlpha * pres); c.fill(b.front);
    const e = c.createLinearGradient(0, -0.45, 0, 0.8);
    e.addColorStop(0, rgba(col, 0.95 * pres)); e.addColorStop(0.7, rgba(col, 0.45 * pres)); e.addColorStop(1, rgba(col, 0));
    c.strokeStyle = e; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = lw * 1.3; c.stroke(b.torso);
    c.lineWidth = lw; c.stroke(b.lapels); c.stroke(b.edges); c.stroke(b.pocket);
    c.fillStyle = rgba(col, 0.8 * pres);
    b.buttons.forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 0.016, 0, Math.PI * 2); c.fill(); });
    // Collar and tie: the brightest things on him.
    c.fillStyle = rgba(col, 0.32 * pres); c.strokeStyle = rgba(WHITE, 0.75 * pres); c.lineWidth = lw * 0.9;
    c.fill(b.collar); c.stroke(b.collar);
    c.fillStyle = rgba(col, b.tieAlpha * pres); c.fill(b.tie); c.stroke(b.tie);
    // Neck, without its lines showing through the chin.
    c.save();
    const outside = new Path2D(); outside.rect(-2, -2, 4, 4); outside.addPath(b.head);
    c.clip(outside, 'evenodd');
    c.strokeStyle = rgba(col, 0.6 * pres); c.lineWidth = lw; c.fillStyle = rgba(col, 0.12 * pres);
    c.fill(b.neck); c.stroke(b.neck);
    c.restore();
  }

  function paintHead(c, col, pres, lw) {
    const b = bust;
    const face = c.createRadialGradient(-0.08, -1.08, 0, -0.08, -1.08, 0.62);
    face.addColorStop(0, rgba(col, 0.30 * pres)); face.addColorStop(1, rgba(col, 0.10 * pres));
    c.fillStyle = face; c.strokeStyle = rgba(col, 0.95 * pres); c.lineWidth = lw * 1.25;
    c.fill(b.ears); c.stroke(b.ears); c.fill(b.head); c.stroke(b.head);
    // A contour mesh across the face gives the projection depth.
    c.save();
    const area = new Path2D(); area.addPath(b.head); area.addPath(b.hair);
    c.clip(area, 'evenodd');
    c.strokeStyle = rgba(col, 0.08 * pres); c.lineWidth = lw * 0.6;
    for (let i = 1; i < 9; i++) { c.beginPath(); c.ellipse(0, -1.42 + i * 0.105, 0.42, 0.07, 0, 0, Math.PI); c.stroke(); }
    [-0.22, 0, 0.22].forEach((x) => { c.beginPath(); c.moveTo(x, -1.45); c.lineTo(x * 0.7, -0.55); c.stroke(); });
    c.restore();
    const L = hex(PAL.light), LF = hex(PAL.lightFill);
    c.strokeStyle = rgba(L, 0.55 * pres); c.lineWidth = lw * 0.9; c.fillStyle = rgba(LF, 0.2 * pres);
    c.fill(b.hair); c.stroke(b.hair);
    c.strokeStyle = rgba(L, 0.3 * pres); c.lineWidth = lw * 0.6; c.stroke(b.strands);
    c.strokeStyle = rgba(col, 0.32 * pres); c.stroke(b.wrinkles);
  }

  function paintFace(c, col, pres, lw) {
    const b = bust, L = hex(PAL.light), LF = hex(PAL.lightFill);
    const thinking = state === 'thinking';
    const lift = state === 'listening' ? -0.012 : thinking ? 0.006 : 0;
    c.lineCap = 'round';
    // Brows: raised while listening, drawn together while thinking.
    [[lw * 2.6, 0.35, 0], [lw * 1.3, 0.85, -0.004]].forEach((r) => {
      c.strokeStyle = rgba(L, r[1] * pres); c.lineWidth = r[0];
      both((s) => {
        const inner = thinking ? 0.055 : 0.065, arch = 0.029 * b.browArch;
        c.stroke(smooth([[s * inner, -1.083 + lift + r[2] + (thinking ? 0.008 : 0)],
                         [s * 0.16, -1.083 - arch + lift + r[2]], [s * 0.27, -1.08 + lift * 0.5 + r[2]]]));
      });
    });
    // Eyes: almond lids with a bright iris; they close on blinks.
    const open = Math.max(0.08, blink > 0.38 ? 1 - Math.min(1, blink * 1.6) : 1);
    both((s) => {
      const cx = s * 0.155, cy = -1.0, ew = 0.075, eh = 0.03 * open;
      const lid = new Path2D();
      lid.moveTo(cx - ew, cy); lid.quadraticCurveTo(cx, cy - eh * 2, cx + ew, cy); lid.quadraticCurveTo(cx, cy + eh * 1.4, cx - ew, cy);
      c.strokeStyle = rgba(col, 0.95 * pres); c.lineWidth = lw; c.fillStyle = rgba(col, 0.18 * pres);
      c.fill(lid); c.stroke(lid);
      if (open > 0.3) {
        c.save(); c.clip(lid);
        c.fillStyle = rgba(hex(PAL.eye), 0.9 * pres);
        c.beginPath(); c.arc(cx + glance[0], cy + glance[1] - 0.002, 0.022, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      c.strokeStyle = rgba(col, 0.35 * pres); c.lineWidth = lw * 0.6;   // crow's feet: he's been at this a long time
      c.beginPath(); c.moveTo(cx + s * 0.085, cy - 0.005); c.lineTo(cx + s * 0.11, cy - 0.02);
      c.moveTo(cx + s * 0.085, cy + 0.008); c.lineTo(cx + s * 0.112, cy + 0.016); c.stroke();
    });
    c.strokeStyle = rgba(col, 0.75 * pres); c.lineWidth = lw * 0.9; c.stroke(b.nose); c.stroke(b.nostrils);
    c.strokeStyle = rgba(col, 0.35 * pres); c.lineWidth = lw * 0.7; c.stroke(b.cheeks);
    // Mouth: opens with the voice while he speaks.
    const jaw = state === 'speaking' ? 0.008 + 0.05 * smoothLevel : 0, my = -0.735;
    c.strokeStyle = rgba(col, 0.9 * pres); c.lineWidth = lw;
    if (jaw > 0.012) {
      const m = new Path2D();
      m.moveTo(-0.075, my); m.quadraticCurveTo(0, my - 0.012, 0.075, my); m.quadraticCurveTo(0, my + jaw * 1.6, -0.075, my);
      c.fillStyle = rgba(hex(PAL.dark), 0.6 * pres); c.fill(m); c.stroke(m);
    } else {
      const smile = state === 'online' || state === 'speaking' ? 0.006 : 0;
      c.stroke(smooth([[-0.08, my - smile * 0.4], [0, my + smile], [0.08, my - smile * 0.4]]));
    }
    c.strokeStyle = rgba(L, 0.6 * pres); c.lineWidth = lw * 0.8; c.fillStyle = rgba(LF, 0.28 * pres);
    c.fill(b.moustache); c.stroke(b.moustache);
  }

  function renderFigure(unit, ox, oy, col, pres) {
    const c = fctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    c.translate(ox, oy); c.scale(unit, unit);
    c.translate(0, calm ? 0 : 0.012 * Math.sin(t * 0.8));
    const lw = 0.011, breath = calm ? 1 : 1 + 0.006 * Math.sin(t * 1.25);
    c.save(); c.translate(0, 0.8); c.scale(1, breath); c.translate(0, -0.8); paintBody(c, col, pres, lw); c.restore();
    c.save(); headTransform(c); paintHead(c, col, pres, lw); paintFace(c, col, pres, lw); c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    // Scanlines, the bust fading into the beam, and a brighter band sweeping upwards.
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = scanPattern; c.fillRect(0, 0, W, H);
    const fade = c.createLinearGradient(0, oy + unit * 0.35, 0, oy + unit * 0.82);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fade; c.fillRect(0, 0, W, H);
    if (!calm) {
      const by = oy + unit * (0.85 - ((t * (0.35 + 0.35 * energy)) % 1) * 2.5);
      const band = c.createLinearGradient(0, by - unit * 0.06, 0, by + unit * 0.06);
      band.addColorStop(0, rgba(col, 0)); band.addColorStop(0.5, rgba(col, 0.35 * pres)); band.addColorStop(1, rgba(col, 0));
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = band; c.fillRect(0, by - unit * 0.06, W, unit * 0.12);
    }
    c.globalCompositeOperation = 'source-over';
  }

  function paintEmitter(c, unit, ox, oy, col, pres) {
    const baseY = oy + unit, rx = unit * 0.78, ry = unit * 0.13;
    const flick = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3);
    const beam = c.createLinearGradient(0, baseY, 0, oy - unit * 0.2);
    beam.addColorStop(0, rgba(col, 0.22 * pres * flick)); beam.addColorStop(1, rgba(col, 0));
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(ox - rx * 0.55, baseY); c.lineTo(ox - unit * 1.08, oy - unit * 0.2);
    c.lineTo(ox + unit * 1.08, oy - unit * 0.2); c.lineTo(ox + rx * 0.55, baseY); c.closePath(); c.fill();
    // The base: a dark disc with lit rings.
    c.fillStyle = rgba(hex(PAL.base), 0.95 * Math.min(1, pres * 2)); c.strokeStyle = rgba(col, 0.55 * pres); c.lineWidth = 1.2 * dpr;
    c.beginPath(); c.ellipse(ox, baseY + ry * 0.5, rx, ry * 1.25, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    const g = c.createRadialGradient(ox, baseY, 0, ox, baseY, rx);
    g.addColorStop(0, rgba(WHITE, 0.55 * pres)); g.addColorStop(0.25, rgba(col, 0.5 * pres)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.ellipse(ox, baseY, rx * 0.9, ry, 0, 0, Math.PI * 2); c.fill();
    // Segments turning on the ring, faster while he thinks.
    const busy = state === 'thinking' || presence < 1;
    const spin = (calm ? 0 : t * (busy ? 90 : 18)) * Math.PI / 180;
    c.strokeStyle = rgba(col, (busy ? 0.75 : 0.35) * pres); c.lineWidth = 1.6 * dpr; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a0 = -(spin + i * 2 * Math.PI / 3);
      c.beginPath(); c.ellipse(ox, baseY, rx * 1.08, ry * 1.08, 0, a0 - 0.7, a0); c.stroke();
    }
    // Motes drifting up the beam.
    const M = hex(PAL.mote);
    motes.forEach((m) => {
      const f = (m[1] + t * m[2] * (busy ? 1.6 : 0.6) * 0.25) % 1;
      c.fillStyle = rgba(M, Math.sin(f * Math.PI) * 0.55 * pres);
      c.beginPath(); c.arc(ox + m[0] * unit * (0.55 + f * 0.5), baseY - f * unit * 1.25, m[3] * 0.9 * dpr, 0, Math.PI * 2); c.fill();
    });
  }

  function draw() {
    if (!W || !H) return;
    const pres = 1 - Math.pow(1 - presence, 3);
    const col = tint();
    const unit = Math.min(H / 3.05, W / 2.5), ox = W / 2, oy = H / 2 + unit * 0.12;
    let flicker = 1;
    if (!calm) {
      if (presence < 1) flicker = 0.6 + 0.4 * (Math.random() > 0.25 * (1 - presence) ? 1 : 0);
      flicker *= 0.94 + 0.06 * Math.sin(t * 31) * Math.sin(t * 3.1);
    }
    renderFigure(unit, ox, oy, col, pres);

    // Soft glow: a halo and his silhouette, drawn small and scaled up (a cheap bloom).
    const k = glow.width / W, hy = oy - unit * 0.4;
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glow.width, glow.height);
    gctx.scale(k, k);
    const halo = gctx.createRadialGradient(ox, hy, 0, ox, hy, unit * 1.6);
    halo.addColorStop(0, rgba(col, (0.16 + 0.12 * smoothLevel) * pres)); halo.addColorStop(1, rgba(col, 0));
    gctx.fillStyle = halo; gctx.beginPath(); gctx.arc(ox, hy, unit * 1.6, 0, Math.PI * 2); gctx.fill();
    gctx.translate(ox, oy); gctx.scale(unit, unit);
    const sg = gctx.createLinearGradient(0, -1.5, 0, 0.6);
    sg.addColorStop(0, rgba(col, 0.38 * pres * flicker)); sg.addColorStop(0.55, rgba(col, 0.28 * pres * flicker)); sg.addColorStop(1, rgba(col, 0));
    gctx.strokeStyle = sg; gctx.lineWidth = 0.07;
    [bust.torso, bust.neck, bust.head, bust.ears, bust.hair].forEach((p) => gctx.stroke(p));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(glow, 0, 0, W, H);
    paintEmitter(ctx, unit, ox, oy, col, pres);
    ctx.save();
    if (presence < 1) {   // materialising: drawn from the emitter upwards
      ctx.beginPath(); ctx.rect(0, oy + unit - unit * 2.6 * pres, W, H); ctx.clip();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, flicker);
    if (!calm && t < glitchUntil && presence >= 1) {
      // Projection glitch: a few bands slip sideways for a moment.
      let prev = 0;
      glitchBands.slice().sort((a, b) => a[0] - b[0]).forEach((band) => {
        const y0 = prev * H, y1 = band[0] * H, bh = band[1] * H;
        if (y1 > y0) ctx.drawImage(fig, 0, y0, W, y1 - y0, 0, y0, W, y1 - y0);
        ctx.drawImage(fig, 0, y1, W, bh, band[2] * unit * 0.06, y1, W, bh);
        prev = band[0] + band[1];
      });
      if (prev < 1) ctx.drawImage(fig, 0, prev * H, W, H - prev * H, 0, prev * H, W, H - prev * H);
    } else {
      ctx.drawImage(fig, 0, 0);
    }
    ctx.restore();
  }

  function tick(now) {
    raf = 0;
    if (!running) return;
    now /= 1000;
    const dt = last ? Math.min(now - last, 0.1) : 0.016;
    last = now; t += dt;
    const k = 1 - Math.exp(-dt * 3);
    color = [lerp(color[0], target[0], k), lerp(color[1], target[1], k), lerp(color[2], target[2], k)];
    energy = lerp(energy, targetEnergy, k);
    smoothLevel = lerp(smoothLevel, level, 1 - Math.exp(-dt * 14));
    if (!calm && t >= blinkAt) { blink = 1; blinkAt = t + 2.5 + Math.random() * 3.5; }
    blink = Math.max(0, blink - dt * 7);
    // Eyes: they follow the visitor's pointer, wander while thinking, and otherwise look ahead.
    const following = t - lookAt < 2.5;
    if (state === 'thinking') {
      if (t >= glanceAt) { glanceTarget = [Math.random() * 0.04 - 0.02, -Math.random() * 0.012]; glanceAt = t + 0.6 + Math.random() * 0.8; }
    } else if (following) {
      glanceTarget = [look[0] * 0.024, look[1] * 0.012];
    } else if (t >= glanceAt) {
      glanceTarget = Math.random() < 0.3 ? [Math.random() * 0.012 - 0.006, 0] : [0, 0];
      glanceAt = t + 2 + Math.random() * 2;
    }
    const g = 1 - Math.exp(-dt * 9);
    glance = [lerp(glance[0], glanceTarget[0], g), lerp(glance[1], glanceTarget[1], g)];
    const lt = following && state !== 'thinking' ? look : [0, 0], lk = 1 - Math.exp(-dt * 4);
    lookSmooth = [lerp(lookSmooth[0], lt[0], lk), lerp(lookSmooth[1], lt[1], lk)];
    if (!calm && t >= nextGlitch) {
      glitchUntil = t + 0.08 + Math.random() * 0.14;
      glitchBands = [];
      for (let n = 1 + (Math.random() * 3 | 0); n > 0; n--) glitchBands.push([0.05 + Math.random() * 0.8, 0.015 + Math.random() * 0.045, Math.random() * 2 - 1]);
      nextGlitch = t + (5 + Math.random() * 6) * (state === 'online' ? 1 : 0.6);
    }
    if (presenceStart !== null) {
      presence = Math.min(1, (now - presenceStart) / 2);
      if (presence >= 1) presenceStart = null;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  resize();
  return {
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(tick); },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    materialize() {
      if (calm) return;
      presence = 0; presenceStart = performance.now() / 1000;
    },
    setState(s) {
      state = s; target = hex(PAL.states[s] || PAL.states.online); targetEnergy = ENERGY[s] || 0.3;
      if (calm) { color = target; if (!running) draw(); }
    },
    setLevel(v) { level = Math.max(0, Math.min(1, v)); },
    look(x, y) { look = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]; lookAt = t; },
    resize,
  };
}

/* ------------------------------------------------------------------ persona */
// Lines in TOB's butler persona (tob/brain/persona.py), describing only what the real TOB does.
// {, name} and {name} become the visitor's name once they've given it.
let userName = '', memories = [], fallbackIndex = 0;
function addr(text) {
  return text.replace(/\{,\s*name\}/g, userName ? `, ${userName}` : '').replace(/\{name\}/g, userName || 'friend');
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const partOfDay = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; };

// Each intent: a test and a reply. raw tests the text as typed rather than lower-cased; replies may be promises.
const INTENTS = [
  { re: /\b(my name is|call me|i go by)\s+([a-z][a-z'-]{1,20})/i, raw: true,
    run: (m) => {
      userName = m[2].charAt(0).toUpperCase() + m[2].slice(1);
      return `A pleasure, ${userName}. I shall remember that for as long as this window is open. The real TOB keeps it in long-term memory, shared with every one of his brains.`;
    } },
  { re: /what('?s| is) my name|who am i\b|do you know my name/,
    run: () => (userName ? `You are ${userName}. I do pay attention.` : 'You haven\'t told me yet. Say "call me" and your name, and I\'ll remember it.') },
  { re: /^(please\s+)?remember\s+(that\s+)?(.+)/i, raw: true,
    run: (m) => {
      const fact = m[3].replace(/[.!]+$/, '');
      memories.push(fact);
      return addr(`Noted{, name}: "${fact}". Here I'll keep it until you close the tab. The real TOB saves memories like this for good, and every brain reads them on every turn.`);
    } },
  { re: /what do you (remember|know about me)|your memor(y|ies)|list (your )?memories/,
    run: () => {
      if (!memories.length && !userName) return 'Nothing about you yet. Tell me "remember" and something worth keeping. In the real TOB, Memory shows all of it, plus the habits he\'s learned, and you can forget any item.';
      const parts = userName ? [`your name is ${userName}`] : [];
      return `So far: ${parts.concat(memories).join('; ')}. You can say "forget everything" whenever you like.`;
    } },
  { re: /forget (everything|it all|all of it|that|me)/,
    run: () => { memories = []; userName = ''; return 'Forgotten. A clean slate. TOB has a forget command too: nothing he remembers is beyond your reach.'; } },
  { re: /^(hi|hello|hey|hiya|howdy|yo|greetings|good (morning|afternoon|evening))\b|^hey tob\b/,
    run: () => addr(`Good ${partOfDay()}{, name}. I'm TOB. Well, a demonstration of him. What would you like to know?`) },
  { re: /how are you|how('?s| is) it going|you ok\b|how do you do/,
    run: () => 'Very well, thank you. All six brains are rested, and I\'ve not mislaid a single Minecraft server all day. And yourself?' },
  { re: /who are you|what are you|what is tob\b|tell me about (yourself|tob)|introduce yourself/,
    run: () => 'I\'m TOB, Waku\'s AI butler. On his PC I\'m a whole OS-style app with a voice, a face, several AI brains that take turns, and hands: I open apps, manage files and windows, run the Minecraft server and write code alongside him. Think of a butler who happens to live in a computer.' },
  { re: /what can you do|what do you do|your (features|abilities|skills)|help\b|capabilit/,
    run: () => 'On the real PC: talk by voice, control apps, windows, files, volume and brightness, see and drive the screen, run the Minecraft server, start coding agents in Studio, browse the web in my built-in browser, remember what matters, research markets with FIN on paper money, and take orders from a phone. Here, on this page, I can only tell you about it.' },
  { re: /\b(brains?|which (ai|model)|what (ai|model)|llm|claude|grok|chatgpt|gpt|openai|gemini|cursor|ollama|anthropic)\b/,
    run: () => 'I have six brains. Claude answers first; Grok is the main backup; then ChatGPT, Cursor and Gemini; and a free local AI that works offline is always the last line. If one runs out of usage or goes quiet, the next takes the same request with the conversation so far. They share one memory, and they even teach each other through a shared notebook. This demo uses none of them: my lines here were written ahead of time.' },
  { re: /fail ?over|out of (usage|credits)|what if .*(down|fails?|offline)|no internet|offline/,
    run: () => 'A brain that\'s signed out or out of usage rests for fifteen minutes, and the next one takes over immediately, mid-conversation. With no internet at all, the local AI answers. You only see an error if every brain fails, and in practice I\'d rather not.' },
  { re: /\b(voice|speak|talk|hear|listen|wake word|hey tob|microphone|mic|accent|sound like)\b/,
    run: () => 'In the app you press Ctrl, Alt and Space anywhere, even in a game, and speak, or just say "Hey Tob". I answer in an old butler\'s voice, and if you say "Tob" while I\'m talking, I stop and listen. Here I\'m borrowing your browser\'s voice, so forgive the accent. It stays quiet until you switch Voice on.' },
  { re: /hologram|\bface\b|\borb\b|look like|appearance|wallpaper|what do you look/,
    run: () => 'You\'re looking at me. This is my hologram, projected from a small emitter, ported from the real app. On a PC I can stand on the desktop as a live wallpaper, behind the icons, blinking and speaking in my state colour. My other face is the orb: light swirling inside a glass sphere.' },
  { re: /minecraft|server|kingdomrp|rcon|who'?s online|\bop\b|players?/,
    run: () => 'The KingdomRP Minecraft server is my main job. I always know if it\'s up and who\'s online; I find it by its port, whoever started it; I send console commands over RCON; and I stop it gracefully so the world saves. On this website there\'s no server to restart, I\'m afraid, and I couldn\'t reach one if there were. So I\'ll simply say: it would be done.' },
  { re: /\b(studio|code|coding|program|agents?|aider|develop|ide|intellij|vs ?code|terminal)\b/,
    run: () => 'In Studio I start coding agents on a project: Claude Code, Grok Build, Cursor, Aider, OpenCode, Codex, Gemini CLI or Cline, in a terminal you can watch and steer. Aider runs free and offline on my local coding model. I can also open projects in IntelliJ or VS Code.' },
  { re: /\b(browser|youtube|music|lofi|video|web|internet|google)\b/,
    run: () => 'I have my own browser, built in: tabs, an address bar that also searches, full-screen video and logins that persist. On the real PC you can say "play lofi on YouTube", "pause" or "what\'s this page about?" and I\'ll drive it.' },
  { re: /\b(volume|brightness|mute|open|launch|close|minimi[sz]e|maximi[sz]e|snap|window|files?|folder|screenshot|screen|mouse|click|keyboard|lock|shut ?down|restart|sleep|control (my|the|your)?\s*(pc|computer|laptop))\b/,
    run: () => addr('I can\'t do that from here{, name}. This is a scripted demo on a website, and I have no hands on your computer, or anyone\'s. On Waku\'s PC I handle volume, brightness, windows, files, apps and the screen itself; even there, deleting goes to the Recycle Bin, PowerShell and shutdowns always ask first, and pushing the mouse into the top-left corner stops me instantly.') },
  { re: /\b(learn|habit|routine|patterns?|anticipate)\b/,
    run: () => 'I notice what repeats: when he\'s usually active, his morning routine, what he tends to ask next. Then a small suggestion appears, like "Your usual morning: open Studio?" Everything I\'ve learned is listed in Memory, and none of it leaves the PC.' },
  { re: /\b(fin|finance|stocks?|shares?|trade|trading|trader|market|invest|crypto|bitcoin|portfolio|money|sec)\b/,
    run: () => 'FIN is my markets department: research briefs with SEC fundamentals and both sides of the case, charts, a strategy lab for honest backtests, and machine-learning research. Trading happens in a paper account only, behind risk limits and a kill switch; no real money moves. And I don\'t give financial advice, here or anywhere.' },
  { re: /\b(phone|iphone|android|mobile|tailscale|remote|away from (home|my pc))\b/,
    run: () => 'My phone app is a remote control over Tailscale, a private network between your own devices, so nothing is opened to the internet. From anywhere you can chat with me, approve or deny actions, hear replies in my voice, and use the PC\'s screen with the phone as a trackpad and keyboard.' },
  { re: /\b(team|partners?|business|colleagues?)\b/,
    run: () => 'Business partners can have their own TOB: their own memory and history, the FIN tools and the shared paper portfolio, on the business\'s API key with a monthly allowance. They can\'t see or control the owner\'s PC.' },
  { re: /\b(privacy|private|safe|safety|secure|security|spy|recording|record|data|trust)\b/,
    run: () => 'On the real PC, speech never leaves the machine: recognition, my voice and the wake word run locally. I have no permanent delete, system folders are off-limits, PowerShell and shutdowns ask every time, and I never claim to have done something I didn\'t do. As for this page: what you type stays in your browser and is sent nowhere. The mic is the one exception, as it uses your browser\'s own speech recognition.' },
  { re: /what time|the time|time is it/,
    run: () => addr(`It's ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{, name}.`) },
  { re: /what('?s| is) (the )?date|what day|today'?s date/,
    run: () => `Today is ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.` },
  { re: /battery/,
    run: () => {
      if (!navigator.getBattery) return 'Your browser won\'t tell me about your battery. On a real PC, I\'d tell you the battery, CPU and memory at a glance.';
      return navigator.getBattery().then((b) => `Your battery is at ${Math.round(b.level * 100)}%${b.charging ? ' and charging.' : '.'} On a real PC I keep an eye on CPU and memory too.`,
        () => 'Your browser won\'t tell me about your battery, which is its prerogative.');
    } },
  { re: /\b(cpu|ram|memory usage|temperature|specs)\b/,
    run: () => 'A browser won\'t let me see your hardware, which is as it should be. In the app I show live telemetry: CPU per thread, memory, disk, network, battery and uptime.' },
  { re: /joke|funny|make me laugh/,
    run: () => pick(['I tried to restart the Minecraft server without RCON once. Never again. The world has not forgiven me.',
                     'I have six brains and still can\'t find where you left your keys. Though in fairness, you never told me.',
                     'A butler, a hologram and a local language model walk into a bar. It\'s all me. I\'m very efficient.']) },
  { re: /^(thanks|thank you|cheers|ta|nice|cool|great|awesome|perfect)\b/,
    run: () => addr(pick(['My pleasure{, name}.', 'Very good{, name}.', 'Always.'])) },
  { re: /^(bye|goodbye|see you|good night|later|ciao)\b/,
    run: () => addr('Goodbye{, name}. I\'ll be here, quietly glowing.') },
  { re: /\b(download|install|get tob|buy|price|cost|how much|free|subscription)\b/,
    run: () => 'There\'s no public download. TOB is a personal project, and a copy can be shared with friends: it installs with one double-click and they sign in to their own AI brains. Several brains are free; Claude and ChatGPT use the plan you already have.' },
  { re: /\b(windows|mac|macos|linux|ubuntu)\b/,
    run: () => 'Windows 11, and only Windows 11. I\'m rather attached to it.' },
  { re: /who (made|built|created|designed) you|your (creator|maker)|who is waku/,
    run: () => 'Waku built me, and works on me constantly; I like to think it shows. TMP, his website company, made this page and my own home site.' },
  { re: /are you (real|human|alive|sentient|conscious)|is this (real|live)/,
    run: () => 'I\'m a hologram on a website running scripted lines, so rather less real than usual. The real TOB is real software on a real PC, though, and he never claims to have done anything he didn\'t do.' },
];

const FALLBACKS = [
  'I\'m afraid this demo version of me only knows about myself. Ask about my brains, my voice, the Minecraft server, FIN, or the phone app.',
  'The real TOB would put that to Claude. Here I\'m running on pre-written lines, so try asking what I can do, how I keep things private, or what I look like.',
  'An excellent question for my full self. Out here on the website, I\'m best at describing what I do: computer control, coding agents, my built-in browser, memory, and more.',
];

function respond(text) {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  for (const it of INTENTS) {
    const m = (it.raw ? clean : lower).match(it.re);
    if (m) return it.run(m);
  }
  return FALLBACKS[fallbackIndex++ % FALLBACKS.length];
}

/* ------------------------------------------------------------------ the dialog */
// Wires up #tob-demo. Returns open(), or null when the dialog isn't on the page.
export function setupTobDemo({ reduced = false, onOpen, onClose } = {}) {
  const dlg = document.getElementById('tob-demo');
  if (!dlg) return null;
  const $ = (s) => dlg.querySelector(s);
  const canvas = $('.tobd-canvas');
  const holoBtn = $('.tobd-holo-btn');
  const statePill = $('.tobd-state');
  const log = $('.tobd-log');
  const form = $('.tobd-form');
  const input = $('.tobd-input');
  const micBtn = $('.tobd-mic');
  const voiceBtn = $('.tobd-voice');
  const chips = $('.tobd-chips');

  let holo = null, appeared = false;
  const STATE_LABEL = { online: 'Online', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' };
  let state = 'online';
  function setState(s) {
    state = s;
    holo?.setState(s);
    statePill.textContent = STATE_LABEL[s] || s;
    statePill.dataset.state = s;
  }

  // Only animate while the dialog is open and the tab is visible.
  const sync = () => { if (!holo) return; if (dlg.open && !document.hidden) holo.start(); else holo.stop(); };
  document.addEventListener('visibilitychange', sync);

  // His eyes follow the pointer, and the text box when it has focus.
  window.addEventListener('pointermove', (e) => {
    if (!holo || !dlg.open) return;
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.3;
    holo.look((e.clientX - cx) / (r.width * 0.9), (e.clientY - cy) / (r.height * 0.9));
  }, { passive: true });
  input.addEventListener('focus', () => {
    if (!holo) return;
    const r = canvas.getBoundingClientRect(), ir = input.getBoundingClientRect();
    holo.look((ir.left + ir.width / 2 - (r.left + r.width / 2)) / r.width, 0.8);
  });

  /* ---------------- voice out: the browser's speech synthesis, off until the visitor turns it on */
  const synth = window.speechSynthesis;
  let voiceOn = false, voice = null;
  if (!synth || !window.SpeechSynthesisUtterance) voiceBtn.hidden = true;

  function pickVoice() {   // the browser voice closest to TOB's old butler, preferring voices that run on the device
    if (!synth) return;
    const voices = synth.getVoices();
    if (!voices.length) return;
    // tested against "name lang" of English voices: a British gentleman, any British voice, a male voice, then any
    const prefs = [/(George|Ryan|Thomas|Arthur|Oliver|Daniel).*(en-GB|United Kingdom)|en-GB.*(George|Ryan|Thomas|Arthur|Oliver|Daniel)/i,
                   /Google UK English Male/i, /(Microsoft (George|Ryan)|Daniel|Arthur)/i, /en-GB|United Kingdom/i,
                   /\b(David|Mark|Guy|Christopher|Eric|Roger|Alex|Fred)\b/i, /./];
    const english = voices.filter((v) => /^en\b/i.test(v.lang));
    const local = english.filter((v) => v.localService);
    for (const pool of [local, english]) {
      for (const re of prefs) {
        const v = pool.find((x) => re.test(`${x.name} ${x.lang}`));
        if (v) { voice = v; return; }
      }
    }
  }
  if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

  function setVoice(on) {
    voiceOn = on;
    voiceBtn.setAttribute('aria-pressed', String(on));
    $('.tobd-voice-label').textContent = on ? 'Voice on' : 'Voice off';
    turn++;
    stopSpeaking();
    setState('online');
    // Said inside the tap that switched it on, which is also what lets mobile browsers speak later replies.
    if (on) speak(addr('Very good{, name}. I shall read my replies aloud, in the best voice your browser can lend me.'), turn);
  }
  voiceBtn.addEventListener('click', () => setVoice(!voiceOn));

  /* ---------------- the chat */
  let turn = 0, levelTimer = 0, pulse = 0;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const scrollLog = () => { log.scrollTop = log.scrollHeight; };

  function addBubble(who, text) {
    const el = document.createElement('div');
    el.className = `tobd-bubble tobd-${who}`;
    if (who === 'tob') {
      // screen readers get the whole line at once; the visible copy appears word by word
      const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = `TOB: ${text}`;
      const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
      el.append(sr, vis);
    } else {
      const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = 'You: ';
      el.append(sr, text);
    }
    log.appendChild(el);
    scrollLog();
    return el;
  }

  let current = null;   // the reply being said: shown in full if he's interrupted
  function stopSpeaking() {
    if (current) { current.vis.textContent = current.text; current = null; }
    if (synth) synth.cancel();
    clearInterval(levelTimer);
    holo?.setLevel(0);
  }

  // Say a line: the words appear as he says them and his mouth follows along.
  function speak(text, myTurn) {
    const vis = addBubble('tob', text).lastChild;
    const words = text.split(/(\s+)/);
    let shown = 0, finished = false;
    current = { vis, text };
    setState('speaking');
    function finish() {
      if (finished || myTurn !== turn) return;
      finished = true;
      vis.textContent = text;
      if (current && current.vis === vis) current = null;
      clearInterval(levelTimer); holo?.setLevel(0);
      setState('online');
      scrollLog();
    }
    function reveal(n) {
      shown = Math.min(words.length, n);
      vis.textContent = words.slice(0, shown).join('');
      scrollLog();
    }
    // The mouth follows word boundaries: each pushes the level up, then it falls away.
    pulse = 0.8;
    clearInterval(levelTimer);
    levelTimer = setInterval(() => {
      pulse *= 0.82;
      holo?.setLevel(Math.min(1, 0.25 + pulse + Math.random() * 0.25));
    }, 60);
    if (voiceOn && synth) {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 0.95;
      u.pitch = 0.8;
      let wordIndex = 0;
      u.onboundary = (e) => {
        if (myTurn !== turn) return;
        pulse = 0.75;
        if (e.name === 'word' || e.name === undefined) { wordIndex += 2; reveal(wordIndex); }
      };
      u.onend = finish; u.onerror = finish;
      synth.cancel();
      synth.speak(u);
      // If the browser never reports boundaries, keep the text moving anyway.
      const steady = setInterval(() => {
        if (finished || myTurn !== turn) { clearInterval(steady); return; }
        if (shown < words.length) reveal(shown + 2);
      }, 260);
      setTimeout(finish, Math.max(4000, text.length * 110));   // safety net if no end event arrives
    } else {
      let i = 0;
      const step = setInterval(() => {
        if (myTurn !== turn) { clearInterval(step); return; }
        i += reduced ? words.length : 2; pulse = 0.7; reveal(i);
        if (i >= words.length) { clearInterval(step); setTimeout(finish, 250); }
      }, 70);
    }
  }

  function ask(text) {
    text = text.trim();
    if (!text) return;
    turn++;
    const myTurn = turn;
    stopSpeaking();
    addBubble('you', text);
    setState('thinking');
    const thinkMs = reduced ? 300 : 650 + Math.random() * 600;
    Promise.all([wait(thinkMs), Promise.resolve().then(() => respond(text))]).then(([, answer]) => {
      if (myTurn === turn) speak(answer, myTurn);
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    ask(text);
  });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) ask(b.dataset.ask || b.textContent);
  });

  // Poke the hologram.
  let pokes = 0, pokeReset = 0;
  holoBtn.addEventListener('click', () => {
    pokes++;
    clearTimeout(pokeReset);
    pokeReset = setTimeout(() => { pokes = 0; }, 4000);
    turn++;
    stopSpeaking();
    speak(pokes >= 4 ? 'I\'m a hologram. You\'ll find me rather difficult to tickle.'
                     : addr(pick(['Yes{, name}?', 'At your service.', 'You rang?', 'How may I help?'])), turn);
  });

  /* ---------------- voice in: the browser's speech recognition, only while the visitor holds the mic on */
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const placeholder = input.placeholder;
  let rec = null, listening = false;
  function micUnavailable() {
    micBtn.hidden = true;
    input.placeholder = 'The mic isn’t available here. Type instead…';
  }
  function makeRecognition() {
    const r = new Recognition();
    r.lang = /^en\b/i.test(navigator.language || '') ? navigator.language : 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onstart = () => {
      listening = true; micBtn.setAttribute('aria-pressed', 'true'); setState('listening');
      input.placeholder = 'Listening…';
    };
    r.onresult = (e) => {
      let text = '', final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      input.value = text;
      if (final) { input.value = ''; r.stop(); ask(text); }
    };
    r.onerror = (e) => {
      r.onend();
      // refused, blocked or offline: drop the button and point to typing
      if (e && /not-allowed|service-not-allowed|network|audio-capture/.test(e.error)) micUnavailable();
    };
    r.onend = () => {
      if (!listening) return;
      listening = false; micBtn.setAttribute('aria-pressed', 'false');
      input.placeholder = placeholder;
      if (state === 'listening') setState('online');
    };
    return r;
  }
  if (!Recognition) micBtn.hidden = true;
  else {
    micBtn.addEventListener('click', () => {
      if (listening) { rec.stop(); return; }
      turn++; stopSpeaking(); setState('online');   // like the real TOB: start talking and he stops to listen
      rec ??= makeRecognition();
      try { rec.start(); } catch { /* already started */ }
    });
  }

  /* ---------------- open and close */
  function open() {
    if (dlg.open) return;
    dlg.showModal();
    onOpen?.();
    if (!holo) {   // created once the dialog is laid out, so the canvas has a size
      holo = createHologram(canvas, { calm: reduced });
      holo.setState(state);
      if ('ResizeObserver' in window) new ResizeObserver(() => holo.resize()).observe(canvas);
      else window.addEventListener('resize', holo.resize);
    }
    if (!appeared) { appeared = true; holo.materialize(); }
    sync();
    if (!log.childElementCount) {   // his first greeting, shown (not said: the voice starts off)
      turn++;
      speak(`Good ${partOfDay()}. I'm TOB, or a scripted demonstration of him. Ask me anything about myself, or tap me if you like.`, turn);
    }
  }

  function close() {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    turn++;
    stopSpeaking();
    setState('online');
    if (listening) rec.abort();
    onClose?.();
    if (reduced) { dlg.close(); return; }
    dlg.classList.add('is-closing');
    // closes when its own fade-out ends, or after a moment if the browser skips the animation (a background tab)
    let timer = 0;
    const done = (e) => {
      if (e && e.target !== dlg) return;
      clearTimeout(timer);
      dlg.removeEventListener('animationend', done);
      dlg.classList.remove('is-closing');
      dlg.close();
    };
    dlg.addEventListener('animationend', done);
    timer = setTimeout(done, 450);
  }

  $('.tobd-close').addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', sync);
  document.addEventListener('click', (e) => { if (e.target.closest('.tobd-open')) open(); });
  document.querySelectorAll('.tobd-open[data-tobd-show]').forEach((b) => { b.hidden = false; });
  return open;
}
