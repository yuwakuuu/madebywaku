import * as THREE from 'three';

// Chrome sculpture for the hero. Drag to spin (with inertia), pointer tilts it,
// click / Enter morphs it into the next shape with a pulse + shockwave.
export function initHero(canvas, { reduced = false, onPulse = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 8.2);

  // ---- studio environment: dark room + coloured softboxes, prefiltered for reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = buildStudio();
  const envRT = pmrem.fromScene(envScene, 0.035);
  scene.environment = envRT.texture;
  envScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();

  // ---- shared uniforms for the pulse wobble
  const uniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };
  const displace = `
    float w = sin(position.x * 3.2 + uTime * 7.0) * sin(position.y * 3.4 + uTime * 6.0) * sin(position.z * 3.0 + uTime * 5.0);
    transformed += objectNormal * w * uPulse * 0.42;`;

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.35,
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
      uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uIntensity; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0);
        float t = vW.x * 0.5 + 0.5;
        vec3 col = mix(uC1, uC2, smoothstep(0.1, 0.7, t));
        col = mix(col, uC3, smoothstep(0.55, 1.0, vW.y * 0.5 + 0.5) * 0.6);
        gl_FragColor = vec4(col * f * uIntensity, 1.0);
      }`,
  });

  // ---- shapes to morph between
  const shapes = [
    () => new THREE.TorusKnotGeometry(1.05, 0.34, 360, 64, 2, 3),
    () => new THREE.IcosahedronGeometry(1.3, 0),
    () => new THREE.TorusKnotGeometry(1.0, 0.22, 420, 48, 3, 5),
    () => new THREE.IcosahedronGeometry(1.4, 24),
    () => new THREE.TorusGeometry(1.15, 0.42, 96, 200),
  ];
  const geoCache = [];
  const getGeo = (i) => (geoCache[i] ||= shapes[i]());
  let shapeIndex = 0;

  const spin = new THREE.Group();   // drag / auto-rotation
  const tilt = new THREE.Group();   // pointer-follow tilt
  const pop = new THREE.Group();    // pulse scale
  tilt.add(spin); spin.add(pop); scene.add(tilt);
  const mesh = new THREE.Mesh(getGeo(0), chrome);
  const rimMesh = new THREE.Mesh(getGeo(0), rim);
  rimMesh.renderOrder = 1;
  pop.add(mesh, rimMesh);

  // a few coloured rim lights for small specular kicks on the clearcoat
  const l1 = new THREE.DirectionalLight('#5eead4', 2.2); l1.position.set(-4, 1.5, -2);
  const l2 = new THREE.DirectionalLight('#a78bfa', 2.4); l2.position.set(4, -1, -2);
  const l3 = new THREE.DirectionalLight('#ffffff', 0.8); l3.position.set(0, 4, 4);
  scene.add(l1, l2, l3);

  // soft halo behind the object
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
    rotX: 0.3, rotY: 0, velX: 0, velY: 0,
    tiltX: 0, tiltY: 0, tTiltX: 0, tTiltY: 0,
    scale: 1, scaleVel: 0, pulse: 0, glow: 0,
    morph: -1, // seconds into a morph, -1 when idle
    dragging: false, running: true, visible: true,
  };
  const auto = reduced ? 0 : 0.18;

  // ---- input
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), t: performance.now(), moved: 0 };
    state.dragging = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const now = performance.now();
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
    const dt = Math.max(now - down.lt, 8) / 1000;
    down.moved += Math.abs(dx) + Math.abs(dy);
    state.rotY += dx * 0.008;
    state.rotX += dy * 0.008;
    state.velY = (dx * 0.008) / dt;
    state.velX = (dy * 0.008) / dt;
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
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
    else if (e.key === 'ArrowLeft') { state.velY -= 2.5; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { state.velY += 2.5; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { state.velX -= 2.5; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { state.velX += 2.5; e.preventDefault(); }
  });

  const onPointer = (e) => {
    if (reduced || e.pointerType === 'touch') return;
    state.tTiltY = (e.clientX / window.innerWidth - 0.5) * 0.7;
    state.tTiltX = (e.clientY / window.innerHeight - 0.5) * 0.5;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function trigger() {
    if (state.morph >= 0 && state.morph < 0.16) return;
    state.morph = 0;
    onPulse();
  }

  // ---- sizing
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
    const should = state.visible && !document.hidden;
    if (should && !raf) { clock.getDelta(); raf = requestAnimationFrame(frame); }
  }

  function frame() {
    raf = 0;
    if (!state.visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    // spin with inertia
    if (!state.dragging) {
      state.rotY += (state.velY + auto) * dt;
      state.rotX += state.velX * dt;
      const damp = Math.exp(-dt * 2.4);
      state.velY *= damp; state.velX *= damp;
      // ease X back toward a pleasing angle
      state.rotX += (0.3 + Math.sin(t * 0.4) * (reduced ? 0 : 0.12) - state.rotX) * (1 - Math.exp(-dt * 0.8));
    }
    spin.rotation.set(state.rotX, state.rotY, 0);

    // pointer tilt
    const k = 1 - Math.exp(-dt * 4);
    state.tiltX += (state.tTiltX - state.tiltX) * k;
    state.tiltY += (state.tTiltY - state.tiltY) * k;
    tilt.rotation.set(state.tiltX, state.tiltY, 0);
    tilt.position.y = reduced ? 0 : Math.sin(t * 1.1) * 0.08;

    // morph: squash in, swap shape, spring back out
    if (state.morph >= 0) {
      const squash = reduced ? 0.06 : 0.14;
      state.morph += dt;
      if (state.morph < squash) {
        const p = state.morph / squash;
        state.scale = 1 - 0.42 * p * p;
        state.scaleVel = 0;
      } else if (state.morph - dt < squash) {
        shapeIndex = (shapeIndex + 1) % shapes.length;
        mesh.geometry = rimMesh.geometry = getGeo(shapeIndex);
        state.scaleVel = reduced ? 0 : 6;
        state.pulse = reduced ? 0 : 1;
        state.glow = 1;
        if (!reduced) shockwave();
      }
      if (state.morph > squash + 1.6) state.morph = -1;
    }
    if (state.morph < 0 || state.morph >= (reduced ? 0.06 : 0.14)) {
      // damped spring toward 1
      const acc = -140 * (state.scale - 1) - 9 * state.scaleVel;
      state.scaleVel += acc * dt;
      state.scale += state.scaleVel * dt;
    }
    pop.scale.setScalar(state.scale);

    state.pulse *= Math.exp(-dt * 2.6);
    state.glow *= Math.exp(-dt * 3);
    uniforms.uPulse.value = state.pulse;
    rimUniforms.uIntensity.value = 0.9 + state.glow * 2.2;
    halo.material.opacity = 0.32 + state.glow * 0.5 + Math.sin(t * 1.3) * 0.04;
    halo.material.color.setHSL((0.72 + Math.sin(t * 0.2) * 0.06) % 1, 0.7, 0.65);

    for (const r of rings) {
      if (!r.active) continue;
      r.t += dt;
      const p = r.t / 1.1;
      r.mesh.scale.setScalar(1.2 + p * 3.4);
      r.mesh.material.opacity = Math.max(0, 1 - p) * 0.7;
      if (p >= 1) { r.active = false; r.mesh.visible = false; }
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  wake();

  return { pulse: trigger };
}

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
  panel(4, 4, 0xffffff, 2.2, [-3, 2, 9], [0, 0, 0]);        // front key
  panel(9, 1.2, 0x8ab4ff, 1.6, [0, -8, 2], [0, 0, 0]);      // cool floor bounce
  for (let i = 0; i < 6; i++) {                             // sparkle points
    const a = (i / 6) * Math.PI * 2;
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
