import * as THREE from 'three';
import { createChromeStage, inertia, TAU } from './chrome-stage.js';

// Chrome "MBW" monogram for the hero. Extruded with TextGeometry + helvetiker bold from the
// CDN; if the addons or font can't load, hand-built extruded letter shapes stand in.
// It sways slowly, tilts toward the pointer, drags with inertia and settles back to face
// front; click / Enter fires a pulse (squash, ripple, shockwave and a full spin).
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples';
const FONT_URL = `${THREE_CDN}/fonts/helvetiker_bold.typeface.json`;
const FONT_TIMEOUT = 5000;

export function initHero(canvas, { reduced = false, lite = false, onPulse = () => {} } = {}) {
  return createChromeStage(canvas, {
    reduced, lite, onPulse,
    build: buildMonogram,
    initial: { rotY: reduced ? 0 : -1.1 },
    halo: 0.72,
    // drag inertia, then settle back to face front (nearest full turn) with a slow sway
    pose(s, t, dt) {
      inertia(s, dt);
      let home = s.rotY;
      if (Math.abs(s.velY) < 0.6) {
        home = Math.round(s.rotY / TAU) * TAU + (reduced ? 0 : Math.sin(t * 0.35) * 0.42);
        s.rotY += (home - s.rotY) * (1 - Math.exp(-dt * 1.1));
      }
      const bob = reduced ? 0 : Math.sin(t * 0.5) * 0.07;
      s.rotX += (bob - s.rotX) * (1 - Math.exp(-dt * 1.4));
      return Math.abs(s.rotY - home) < 0.002 && Math.abs(s.rotX) < 0.002;
    },
  });
}

// ---- geometry --------------------------------------------------------------------------

const EXTRUDE = {
  depth: 0.34, curveSegments: 12,
  bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.04, bevelSegments: 8,
};
const TARGET_HALF_DIAGONAL = 1.75; // world units; fits inside the round canvas at camera z 8.2

async function buildMonogram() {
  let geometry, source = 'font', utils = null;
  try {
    const [{ FontLoader }, { TextGeometry }, u] = await Promise.all([
      import('three/addons/loaders/FontLoader.js'),
      import('three/addons/geometries/TextGeometry.js'),
      import('three/addons/utils/BufferGeometryUtils.js'),
    ]);
    utils = u;
    const font = await withTimeout(new FontLoader().loadAsync(FONT_URL), FONT_TIMEOUT);
    geometry = new TextGeometry('MBW', { font, size: 1, ...EXTRUDE });
  } catch (err) {
    console.info('MBW font unavailable, using built-in letter shapes.', err?.message || err);
    geometry = new THREE.ExtrudeGeometry(letterShapes(), EXTRUDE);
    source = 'shapes';
  }

  geometry.center();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  geometry.scale(...Array(3).fill(TARGET_HALF_DIAGONAL / Math.hypot(size.x / 2, size.y / 2)));
  // smooth the bevel steps while keeping the letter edges crisp
  if (utils?.toCreasedNormals && utils.mergeGeometries) {
    try { geometry = creaseSides(geometry, utils); } catch { /* keep flat normals */ }
  }
  geometry.computeBoundingSphere();
  return { geometry, source };
}

// Crease-smooth only the side + bevel walls (extrude group 1). The flat caps keep their own
// normals; averaging them with the bevel tints long cap triangles with visible wedges.
function creaseSides(geo, utils) {
  const parts = geo.groups.map(({ start, count, materialIndex }) => {
    const part = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      part.setAttribute(name, new THREE.BufferAttribute(geo.attributes[name].array.slice(start * 3, (start + count) * 3), 3));
    }
    return materialIndex === 1 ? utils.toCreasedNormals(part, Math.PI / 5) : part;
  });
  const merged = utils.mergeGeometries(parts);
  if (!merged) throw new Error('merge failed');
  return merged;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('font load timed out')), ms))]);
}

// Fallback letters: geometric M, B, W built from outlines, cap height 1.
function letterShapes() {
  const poly = (pts, ox) => {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x + ox, y) : s.moveTo(x + ox, y)));
    s.closePath();
    return s;
  };
  const mPts = [[0, 0], [0, 1], [0.22, 1], [0.46, 0.56], [0.7, 1], [0.92, 1], [0.92, 0], [0.72, 0],
    [0.72, 0.6], [0.52, 0.26], [0.4, 0.26], [0.2, 0.6], [0.2, 0]];
  const M = poly(mPts, 0);

  const bx = 1.06;
  const B = new THREE.Shape();
  B.moveTo(bx, 0); B.lineTo(bx, 1); B.lineTo(bx + 0.44, 1);
  B.absarc(bx + 0.44, 0.75, 0.25, Math.PI / 2, -Math.PI / 2, true);
  B.lineTo(bx + 0.5, 0.5);
  B.absarc(bx + 0.5, 0.25, 0.25, Math.PI / 2, -Math.PI / 2, true);
  B.lineTo(bx, 0);
  const hole = (y0, y1, cx) => {
    const r = (y1 - y0) / 2;
    const p = new THREE.Path();
    p.moveTo(bx + 0.2, y0); p.lineTo(bx + 0.2, y1); p.lineTo(cx, y1);
    p.absarc(cx, y0 + r, r, Math.PI / 2, -Math.PI / 2, true);
    p.lineTo(bx + 0.2, y0);
    return p;
  };
  B.holes.push(hole(0.62, 0.88, bx + 0.44), hole(0.12, 0.38, bx + 0.5));

  const wx = 1.98, ww = 1.04;
  const W = poly(mPts.map(([x, y]) => [x * (ww / 0.92), 1 - y]), wx);
  return [M, B, W];
}
