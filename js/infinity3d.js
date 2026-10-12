import * as THREE from 'three';
import { createChromeStage, inertia } from './chrome-stage.js';

// Chrome infinity loop: a tube swept along a lemniscate of Bernoulli. The two strands are
// pushed apart in depth where they cross, so the loop weaves over itself instead of
// intersecting. It turns slowly on its own (lingering face-on), drags with inertia, tilts
// toward the pointer and pulses on click / Enter, all through the same stage as the hero.
const HALF_WIDTH = 2.45;   // world units at camera z 8.2
const RADIUS = 0.17;       // tube radius before scaling (unit lemniscate)
const WEAVE = 0.24;        // depth separation of the strands at the crossing
const SPIN = [0.22, 0.9];  // resting spin, rad/s: slow face-on, quicker through edge-on

export function initInfinity(canvas, { reduced = false, lite = false, onPulse = () => {} } = {}) {
  return createChromeStage(canvas, {
    reduced, lite, onPulse,
    build: buildLoop,
    initial: { rotY: reduced ? -0.35 : -2.4, rotX: 0.22 },
    fitAspect: 1.3,
    halo: 0.47,
    haloSize: 5.4, // stays inside the rectangular canvas so its edge never shows
    pose(s, t, dt) {
      inertia(s, dt, reduced ? 0 : SPIN[0] + (SPIN[1] - SPIN[0]) * Math.abs(Math.sin(s.rotY)));
      const bob = reduced ? 0.22 : 0.22 + Math.sin(t * 0.6) * 0.12;
      s.rotX += (bob - s.rotX) * (1 - Math.exp(-dt * 1.4));
      return Math.abs(s.rotX - bob) < 0.002;
    },
  });
}

function buildLoop({ lite }) {
  const pts = [];
  const n = 240;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const s = Math.sin(t), c = Math.cos(t);
    const d = 1 + s * s;
    pts.push(new THREE.Vector3(c / d, (1.5 * s * c) / d, WEAVE * s));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, lite ? 260 : 420, RADIUS, lite ? 28 : 44, true);
  geometry.scale(HALF_WIDTH, HALF_WIDTH, HALF_WIDTH);
  geometry.computeBoundingSphere();
  return { geometry, source: 'tube' };
}
