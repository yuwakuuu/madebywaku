import * as THREE from 'three';

// Chrome "MBW" monogram for the hero. Extruded with TextGeometry + helvetiker bold from the
// CDN; if the addons or font can't load, hand-built extruded letter shapes stand in.
// It sways slowly, tilts toward the pointer, drags with inertia and settles back to face
// front; click / Enter fires a pulse (squash, ripple, shockwave and a full spin).
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples';
const FONT_URL = `${THREE_CDN}/fonts/helvetiker_bold.typeface.json`;
const FONT_TIMEOUT = 5000;
const TAU = Math.PI * 2;

export function initHero(canvas, { reduced = false, onPulse = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 8.2);

  // ---- studio environment: dark room + softboxes, prefiltered for reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = buildStudio();
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  envScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();

  // ---- shared uniforms for the pulse ripple. Displacement is driven by position only
  // (not normals) so the non-indexed extrusion never cracks open at its hard edges.
  const uniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };
  const displace = `
    float w = sin(position.x * 2.4 - uTime * 9.0) * 0.65 + sin(position.y * 3.1 + uTime * 7.0) * 0.35;
    transformed.z += w * uPulse * 0.28;
    transformed.xy *= 1.0 + w * uPulse * 0.035;`;

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.06,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6,
  });
  chrome.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uPulse = uniforms.uPulse;
    shader.vertexShader = 'uniform float uTime;\nuniform float uPulse;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + displace);
  };

  // fresnel rim glow, rendered as an additive overlay on the same geometry
  const rimUniforms = {
    ...uniforms,
    uC1: { value: new THREE.Color('#5eead4') },
    uC2: { value: new THREE.Color('#a78bfa') },
    uC3: { value: new THREE.Color('#f472b6') },
    uIntensity: { value: 0.9 },
  };
  const rim = new THREE.ShaderMaterial({
    uniforms: rimUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uPulse;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vec3 objectNormal = normal;
        vec3 transformed = position;
        ${displace}
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        vN = normalize(normalMatrix * objectNormal);
        vV = normalize(-mv.xyz);
        vW = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uIntensity;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.4);
        float t = vW.x * 0.5 + 0.5;
        vec3 col = mix(uC1, uC2, smoothstep(0.1, 0.7, t));
        col = mix(col, uC3, smoothstep(0.55, 1.0, vW.y * 0.5 + 0.5) * 0.6);
        gl_FragColor = vec4(col * f * uIntensity, 1.0);
      }`,
  });

  const fit = new THREE.Group();    // keeps the monogram inside the round canvas
  const tilt = new THREE.Group();   // pointer-follow tilt
  const spin = new THREE.Group();   // drag / sway
  const pop = new THREE.Group();    // pulse scale
  scene.add(fit); fit.add(tilt); tilt.add(spin); spin.add(pop);

  // coloured rim lights behind the letters + a soft key for the clearcoat
  const l1 = new THREE.DirectionalLight('#5eead4', 3.2); l1.position.set(-4, 1.5, -3);
  const l2 = new THREE.DirectionalLight('#a78bfa', 3.4); l2.position.set(4, -1, -3);
  const l3 = new THREE.DirectionalLight('#ffffff', 1.1); l3.position.set(1, 4, 5);
  scene.add(l1, l2, l3);

  // soft halo behind the monogram
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(), color: 0xa78bfa, transparent: true, opacity: 0.38,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.setScalar(6.5); halo.position.z = -2;
  scene.add(halo);

  // shockwave rings (pooled)
  const ringGeo = new THREE.RingGeometry(0.96, 1, 128);
  const rings = [];
  function shockwave() {
    let r = rings.find((x) => !x.active);
    if (!r) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0x9ef5e6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      scene.add(m);
      r = { mesh: m, active: false, t: 0 };
      rings.push(r);
    }
    r.active = true; r.t = 0; r.mesh.visible = true;
  }

  // ---- state
  const state = {
    rotX: 0, rotY: reduced ? 0 : -1.1, velX: 0, velY: 0,
    tiltX: 0, tiltY: 0, tTiltX: 0, tTiltY: 0,
    scale: reduced ? 1 : 0.35, scaleVel: 0, pulse: 0, glow: 0, squash: -1,
    dragging: false, visible: true, ready: false,
  };

  // ---- the monogram itself (async: font comes from the CDN)
  buildMonogram().then(({ geometry, source }) => {
    const mesh = new THREE.Mesh(geometry, chrome);
    const rimMesh = new THREE.Mesh(geometry, rim);
    rimMesh.renderOrder = 1;
    pop.add(mesh, rimMesh);
    canvas.dataset.monogram = source;
    state.ready = true;
    if (!reduced) { state.glow = 1; state.scaleVel = 2; }
    wake();
  });

  // ---- input
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    down = { lx: e.clientX, ly: e.clientY, lt: performance.now(), t: performance.now(), moved: 0 };
    state.dragging = true;
    wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const now = performance.now();
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
    const dt = Math.max(now - down.lt, 8) / 1000;
    down.moved += Math.abs(dx) + Math.abs(dy);
    state.rotY += dx * 0.008;
    state.rotX = clamp(state.rotX + dy * 0.006, -0.9, 0.9);
    state.velY = (dx * 0.008) / dt;
    state.velX = (dy * 0.006) / dt;
    down.lx = e.clientX; down.ly = e.clientY; down.lt = now;
  });
  const end = (e) => {
    if (!down) return;
    const quick = performance.now() - down.t < 350;
    if (down.moved < 8 && quick && e.type === 'pointerup') trigger();
    if (performance.now() - down.lt > 80) { state.velX = 0; state.velY = 0; }
    down = null; state.dragging = false;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', (e) => {
    wake();
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
    else if (e.key === 'ArrowLeft') { state.velY -= 3; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { state.velY += 3; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { state.velX -= 2; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { state.velX += 2; e.preventDefault(); }
  });

  const onPointer = (e) => {
    if (reduced || e.pointerType === 'touch') return;
    state.tTiltY = (e.clientX / window.innerWidth - 0.5) * 0.8;
    state.tTiltX = (e.clientY / window.innerHeight - 0.5) * 0.5;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function trigger() {
    if (state.squash >= 0 && state.squash < 0.12) return;
    state.squash = 0;
    state.glow = 1;
    if (!reduced) {
      state.pulse = 1;
      state.velY += TAU * 2.4 * (state.velY < 0 ? -1 : 1); // one full turn under the inertia damping
      shockwave();
    }
    onPulse();
    wake();
  }

  // ---- sizing: the canvas is clipped to a circle, so scale the monogram to its inscribed circle
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit.scale.setScalar(Math.min(1, camera.aspect));
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // pause when off-screen or tab hidden
  new IntersectionObserver(([en]) => { state.visible = en.isIntersecting; wake(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', wake);

  // ---- loop
  const clock = new THREE.Clock();
  let raf = 0;
  function wake() {
    if (state.visible && !document.hidden && !raf) { clock.getDelta(); raf = requestAnimationFrame(frame); }
  }

  function frame() {
    raf = 0;
    if (!state.visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    // drag inertia, then settle back to face front (nearest full turn) with a slow sway
    if (!state.dragging) {
      state.rotY += state.velY * dt;
      state.rotX += state.velX * dt;
      const damp = Math.exp(-dt * 2.4);
      state.velY *= damp; state.velX *= damp;
      if (Math.abs(state.velY) < 0.6) {
        const sway = reduced ? 0 : Math.sin(t * 0.35) * 0.42;
        const home = Math.round(state.rotY / TAU) * TAU + sway;
        state.rotY += (home - state.rotY) * (1 - Math.exp(-dt * 1.1));
      }
      const bob = reduced ? 0 : Math.sin(t * 0.5) * 0.07;
      state.rotX += (bob - state.rotX) * (1 - Math.exp(-dt * 1.4));
    }
    spin.rotation.set(state.rotX, state.rotY, 0);

    // pointer tilt + gentle float
    const k = 1 - Math.exp(-dt * 4);
    state.tiltX += (state.tTiltX - state.tiltX) * k;
    state.tiltY += (state.tTiltY - state.tiltY) * k;
    tilt.rotation.set(state.tiltX, state.tiltY, 0);
    tilt.position.y = reduced ? 0 : Math.sin(t * 1.1) * 0.06;

    // pulse: quick squash, then a springy rebound
    const squashTime = reduced ? 0.05 : 0.12;
    if (state.squash >= 0) {
      state.squash += dt;
      if (state.squash < squashTime) {
        const p = state.squash / squashTime;
        state.scale = 1 - (reduced ? 0.04 : 0.2) * p * p;
        state.scaleVel = 0;
      } else {
        if (state.squash - dt < squashTime) state.scaleVel = reduced ? 0 : 5;
        if (state.squash > squashTime + 1.6) state.squash = -1;
      }
    }
    if (state.squash < 0 || state.squash >= squashTime) {
      const acc = -140 * (state.scale - 1) - 9 * state.scaleVel;
      state.scaleVel += acc * dt;
      state.scale += state.scaleVel * dt;
    }
    pop.scale.setScalar(state.scale);

    state.pulse *= Math.exp(-dt * 2.6);
    state.glow *= Math.exp(-dt * 3);
    uniforms.uPulse.value = state.pulse;
    rimUniforms.uIntensity.value = 1.0 + state.glow * 2.4;
    halo.material.opacity = 0.3 + state.glow * 0.5 + (reduced ? 0 : Math.sin(t * 1.3) * 0.04);
    halo.material.color.setHSL((0.72 + (reduced ? 0 : Math.sin(t * 0.2) * 0.06)) % 1, 0.7, 0.65);

    for (const r of rings) {
      if (!r.active) continue;
      r.t += dt;
      const p = r.t / 1.1;
      r.mesh.scale.setScalar(1.2 + p * 3.4);
      r.mesh.material.opacity = Math.max(0, 1 - p) * 0.7;
      if (p >= 1) { r.active = false; r.mesh.visible = false; }
    }

    renderer.render(scene, camera);

    // with reduced motion, stop rendering once everything has settled
    const settled = reduced && state.ready && !state.dragging && state.squash < 0 && state.glow < 0.01 &&
      Math.abs(state.velY) < 0.01 && Math.abs(state.velX) < 0.01 && Math.abs(state.rotY - Math.round(state.rotY / TAU) * TAU) < 0.002;
    if (!settled) raf = requestAnimationFrame(frame);
  }
  wake();

  return { pulse: trigger };
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

// ---- environment -----------------------------------------------------------------------

function buildStudio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(20, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x0b0d14, side: THREE.BackSide }),
  );
  s.add(room);
  const panel = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.material.color.multiplyScalar(intensity);
    m.position.set(...pos);
    m.lookAt(...look);
    s.add(m);
  };
  panel(12, 3, 0xffffff, 5, [0, 8, 1], [0, 0, 0]);          // top softbox
  panel(2, 14, 0x5eead4, 4.5, [-8.5, 0, 2], [0, 0, 0]);     // teal strip left
  panel(2, 14, 0xa78bfa, 5, [8.5, 0, 1], [0, 0, 0]);        // violet strip right
  panel(6, 2, 0xf472b6, 3, [3, -6, -6], [0, 0, 0]);         // pink kicker
  panel(9, 1.2, 0x8ab4ff, 1.6, [0, -8, 2], [0, 0, 0]);      // cool floor bounce
  // strips behind the camera: the flat letter faces sweep across these as they sway
  panel(1.1, 12, 0xffffff, 4, [-5.5, 0, 8], [0, 0, 0]);
  panel(0.5, 12, 0xffffff, 6, [-2.2, 0, 9], [0, 0, 0]);
  panel(2.4, 12, 0xdfe7ff, 2.2, [1.4, 0, 9.5], [0, 0, 0]);
  panel(0.4, 12, 0x5eead4, 5, [4.2, 0, 8.6], [0, 0, 0]);
  panel(1.2, 12, 0xa78bfa, 3.5, [6.6, 0, 7], [0, 0, 0]);
  panel(14, 1.4, 0xffffff, 2.5, [0, 3.2, 9], [0, 0, 0]);    // horizon line
  for (let i = 0; i < 6; i++) {                             // sparkle points
    const a = (i / 6) * TAU;
    panel(0.5, 0.5, 0xffffff, 8, [Math.cos(a) * 9, Math.sin(a * 2) * 4, Math.sin(a) * 9], [0, 0, 0]);
  }
  return s;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
