import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { StageProps } from '../Landing';
import { Arrow } from '../Landing';
import { city } from '../facts';
import './hero.css';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Hero({ active, go }: StageProps) {
  const mount = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const hubsRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<(on: boolean) => void>(() => {});
  const activeRef = useRef(active);
  const [noGL, setNoGL] = useState(false);
  const [paused, setPaused] = useState(false);
  const [still] = useState(reducedMotion);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const hud = (pct: number, hubs: number) => {
      if (pctRef.current) pctRef.current.textContent = `${Math.round(pct)}%`;
      if (barRef.current) barRef.current.style.transform = `scaleX(${pct / 100})`;
      if (hubsRef.current) hubsRef.current.textContent = `${hubs} / ${HUBS}`;
    };
    const s = createCity(el, still, hud);
    if (!s) { setNoGL(true); return; }
    runRef.current = s.setRunning;
    s.setRunning(activeRef.current);
    return () => { runRef.current = () => {}; s.dispose(); };
  }, [still]);

  useEffect(() => {
    activeRef.current = active;
    runRef.current(active && !paused);
  }, [active, paused]);

  return (
    <div className="hero">
      <div className="hero-scene" ref={mount} aria-hidden>
        {noGL && <div className="hero-fallback" />}
      </div>
      <div className="hero-scrim" aria-hidden />

      <div className="lp-wrap hero-wrap">
        <div className="hero-copy">
          <p className="lp-eyebrow lp-in" style={{ '--d': 0 } as React.CSSProperties}>Shipt Hacks · Birmingham, AL</p>
          <h1 className="lp-h1 hero-h1 lp-in" style={{ '--d': 1 } as React.CSSProperties}>
            Kids code the fix for <span className="hero-hot">their own city.</span>
          </h1>
          <p className="lp-lede lp-in" style={{ '--d': 2 } as React.CSSProperties}>
            Birmingham residents report real problems, and students solve them in Python on a 3D map of the city they live in.
          </p>
          <Stat active={active} still={still} />
          <div className="hero-ctas lp-in" style={{ '--d': 4 } as React.CSSProperties}>
            <button className="lp-btn primary" onClick={() => go('loop')}>See how it works <Arrow /></button>
            <button className="lp-btn ghost" onClick={() => go('play')}>Try a mission</button>
          </div>
        </div>

        <aside className="hero-hud lp-card lp-in" style={{ '--d': 6 } as React.CSSProperties} aria-label="Live demo: share of residents reached">
          <div className="hero-hud-top">
            <span className="hero-hud-k"><i className="hero-live" aria-hidden /> City lit</span>
            {!still && !noGL && (
              <button className="hero-hud-pause" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play animation' : 'Pause animation'}>
                {paused
                  ? <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 2l7 4-7 4z" fill="currentColor" /></svg>
                  : <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" /></svg>}
              </button>
            )}
          </div>
          <span className="hero-hud-pct lp-mono" ref={pctRef}>0%</span>
          <span className="hero-hud-bar" aria-hidden><span ref={barRef} /></span>
          <div className="hero-hud-row lp-mono">
            <span>Pickup hubs placed</span><span ref={hubsRef}>0 / {HUBS}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ active, still }: { active: boolean; still: boolean }) {
  const target = city.foodDesertShare;
  const [n, setN] = useState(still ? target : 0);
  useEffect(() => {
    if (!active || still) return;
    let raf = 0;
    const t0 = performance.now() + 700;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 1400));
      setN(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, still, target]);
  return (
    <p className="hero-stat lp-in" style={{ '--d': 3 } as React.CSSProperties} aria-label={`About ${target}% of Birmingham residents live in a food desert.`}>
      <span className="hero-stat-n lp-mono" aria-hidden>{n}%</span>
      <span aria-hidden>of Birmingham residents live in a food desert.</span>
    </p>
  );
}

/* ---------------- three.js city ---------------- */

const HUBS = 5;
const LOT = 2.6;
const GRID = 40;
const RADIUS = 52;
const HUB_R = 13;
const SPEED = 14; // ignite ripple, units/s
const FIRST = 1.2, EVERY = 3, HOLD = 4, FADE = 1.6;
const CYCLE = FIRST + (HUBS - 1) * EVERY + HOLD + FADE;
const NEVER = 1e6;

function createCity(el: HTMLElement, still: boolean, hud: (pct: number, hubs: number) => void) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x09090b);
  el.appendChild(renderer.domElement);

  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a0905, 70, 210);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900);

  // sky dome: furnace glow on the horizon, near-black overhead
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = normalize(vP).y;
        vec3 c = mix(vec3(0.239,0.078,0.024), vec3(0.035,0.035,0.043), smoothstep(-0.02, 0.32, h));
        c += vec3(0.25,0.08,0.02) * exp(-abs(h) * 28.);
        gl_FragColor = vec4(c, 1.); }`,
    }),
  ));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0x3a3a4c, 0x3d1406, 1.1));
  const rim = new THREE.DirectionalLight(0xff6a2a, 1.1);
  rim.position.set(-60, 18, -90);
  scene.add(rim);
  const moon = new THREE.DirectionalLight(0x7a82a6, 0.55);
  moon.position.set(50, 70, 40);
  scene.add(moon);

  // buildings
  const lots: { x: number; z: number; h: number }[] = [];
  const dt = new THREE.Vector2(6, -5); // downtown
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (i % 4 === 0 || j % 4 === 0) continue; // streets
    const x = (i - GRID / 2) * LOT, z = (j - GRID / 2) * LOT;
    const d = Math.hypot(x, z);
    if (d > RADIUS || rnd() < 0.08 + (d / RADIUS) ** 4 * 0.6) continue;
    const dd = Math.hypot(x - dt.x, z - dt.y);
    const h = 0.8 + rnd() * 1.8 + 30 * Math.exp(-(dd * dd) / 90) * (0.35 + rnd() * 0.65) + (rnd() < 0.03 ? 6 + rnd() * 6 : 0);
    lots.push({ x, z, h });
  }
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const bMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.15 });
  const buildings = new THREE.InstancedMesh(box, bMat, lots.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  lots.forEach((l, k) => {
    const w = LOT * (0.62 + rnd() * 0.22), dpt = LOT * (0.62 + rnd() * 0.22);
    m.compose(new THREE.Vector3(l.x, 0, l.z), new THREE.Quaternion(), new THREE.Vector3(w, l.h, dpt));
    buildings.setMatrixAt(k, m);
    const g = 0.085 + rnd() * 0.05;
    buildings.setColorAt(k, col.setRGB(g, g, g * 1.12));
  });
  scene.add(buildings);

  // residents, on the streets, denser toward the centre
  const roads: number[] = [];
  for (let i = 0; i < GRID; i += 4) roads.push((i - GRID / 2) * LOT);
  const pos: number[] = [];
  const N = 4200;
  while (pos.length < N * 3) {
    const along = (rnd() * 2 - 1) * RADIUS;
    const across = roads[Math.floor(rnd() * roads.length)] + (rnd() - 0.5) * LOT * 0.7;
    const [x, z] = rnd() < 0.5 ? [along, across] : [across, along];
    const d = Math.hypot(x, z);
    if (d > RADIUS - 2 || rnd() > Math.exp(-d / 30) + 0.12) continue;
    pos.push(x, 0.35, z);
  }
  const igniteAt = new Float32Array(N).fill(NEVER);
  const seeds = new Float32Array(N).map(() => rnd());
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const aT = new THREE.BufferAttribute(igniteAt, 1);
  pGeo.setAttribute('aT', aT);
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `
      uniform float uTime, uFade, uPR;
      attribute float aT, aSeed;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        float k = uTime - aT;
        float lit = clamp(k / .45, 0., 1.) * uFade;
        float flash = k > 0. ? exp(-k * 2.2) * uFade : 0.;
        vC = mix(vec3(.36,.36,.40), vec3(1.,.353,.122), lit) + vec3(1.,.722,.42) * flash;
        float tw = .8 + .2 * sin(uTime * 1.7 + aSeed * 40.);
        vA = mix(.75, 1., lit) * tw * smoothstep(230., 80., -mv.z);
        gl_PointSize = (2.6 + lit * 3.6 + flash * 7.) * uPR * (110. / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - .5);
        float a = smoothstep(.5, .0, d);
        gl_FragColor = vec4(vC, a * a * vA);
      }`,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  // hubs: beam + expanding ring + halo + light
  const halo = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,184,107,1)');
    gr.addColorStop(0.25, 'rgba(255,90,31,.55)');
    gr.addColorStop(1, 'rgba(255,90,31,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const BEAM_H = 70;
  const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, BEAM_H, 16, 1, true).translate(0, BEAM_H / 2, 0);
  const ringGeo = new THREE.RingGeometry(0.94, 1, 96).rotateX(-Math.PI / 2);
  const discGeo = new THREE.PlaneGeometry(HUB_R * 2.4, HUB_R * 2.4).rotateX(-Math.PI / 2);
  const hubs = Array.from({ length: HUBS }, () => {
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uI: { value: 0 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uI; varying vec2 vU; void main(){
        float a = pow(1. - vU.y, 1.6) * uI;
        gl_FragColor = vec4(mix(vec3(1.,.353,.122), vec3(1.,.722,.42), pow(1. - vU.y, 6.)), a); }`,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.2;
    const zoneMat = new THREE.MeshBasicMaterial({ map: halo, color: 0xff5a1f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const zone = new THREE.Mesh(discGeo, zoneMat);
    zone.position.y = 0.1;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0 }));
    sprite.position.y = 1.2;
    sprite.scale.setScalar(9);
    const light = new THREE.PointLight(0xff5a1f, 0, 34, 1.3);
    light.position.y = 4;
    const g = new THREE.Group();
    g.add(beam, ring, zone, sprite, light);
    g.visible = false;
    scene.add(g);
    return { g, beam, beamMat, ring, ringMat, zoneMat, sprite, light, t0: NEVER };
  });

  const pickSpots = () => {
    const spots: THREE.Vector2[] = [];
    for (let tries = 0; spots.length < HUBS && tries < 400; tries++) {
      const p = new THREE.Vector2(roads[Math.floor(rnd() * roads.length)], roads[Math.floor(rnd() * roads.length)]);
      if (p.length() > 34 || spots.some((s) => s.distanceTo(p) < 17 - tries / 40)) continue;
      spots.push(p);
    }
    return spots;
  };

  const drop = (k: number, at: number, spot: THREE.Vector2) => {
    const h = hubs[k];
    h.g.position.set(spot.x, 0, spot.y);
    h.g.visible = true;
    h.t0 = at;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(pos[i * 3] - spot.x, pos[i * 3 + 2] - spot.y);
      if (d < HUB_R) igniteAt[i] = Math.min(igniteAt[i], at + 0.35 + d / SPEED);
    }
    aT.needsUpdate = true;
  };

  let t = 0, cycleStart = 0, dropped = 0, spots = pickSpots();
  const resetCycle = () => {
    igniteAt.fill(NEVER);
    aT.needsUpdate = true;
    hubs.forEach((h) => { h.g.visible = false; h.t0 = NEVER; });
    dropped = 0;
    cycleStart = t;
    spots = pickSpots();
  };

  if (still) for (let k = 0; k < 3; k++) drop(k, -50, spots[k]);

  // camera
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPtr = (e: PointerEvent) => { ptr.tx = (e.clientX / innerWidth) * 2 - 1; ptr.ty = (e.clientY / innerHeight) * 2 - 1; };
  if (!still) addEventListener('pointermove', onPtr, { passive: true });
  let portrait = false;
  const look = new THREE.Vector3(0, 0, 0);
  const placeCamera = () => {
    const a = 0.7 + t * 0.045 + ptr.x * 0.22;
    const r = portrait ? 118 : 98;
    camera.position.set(Math.cos(a) * r, 40 - ptr.y * 7, Math.sin(a) * r);
    camera.lookAt(look);
  };

  let lastHud = '';
  const update = (dt: number) => {
    t += dt;
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 2);
    ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 2);
    const c = t - cycleStart;
    let fade = 1;
    if (!still) {
      if (c > CYCLE) resetCycle();
      while (dropped < HUBS && c >= FIRST + dropped * EVERY && spots[dropped]) { drop(dropped, cycleStart + FIRST + dropped * EVERY, spots[dropped]); dropped++; }
      const fadeAt = FIRST + (HUBS - 1) * EVERY + HOLD;
      fade = c > fadeAt ? Math.max(0, 1 - (c - fadeAt) / FADE) : 1;
    }
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uFade.value = fade;

    let shown = 0;
    for (const h of hubs) {
      if (!h.g.visible) continue;
      shown++;
      const k = t - h.t0;
      const land = Math.min(1, Math.max(0, k / 0.35));
      const e = 1 - (1 - land) ** 3;
      h.beam.scale.y = Math.max(0.001, e);
      h.beam.position.y = BEAM_H * (1 - e);
      const burst = land >= 1 ? Math.exp(-(k - 0.35) * 2) : 0;
      h.beamMat.uniforms.uI.value = (0.5 + burst * 1.2) * fade * (0.9 + 0.1 * Math.sin(t * 6 + h.t0));
      const rk = Math.max(0, k - 0.35);
      const rr = Math.min(HUB_R, rk * SPEED);
      h.ring.scale.setScalar(Math.max(0.01, rr));
      h.ringMat.opacity = land >= 1 ? (rr < HUB_R ? 0.9 : Math.max(0, 0.9 - (rk - HUB_R / SPEED) * 1.5)) * fade : 0;
      h.zoneMat.opacity = Math.min(1, rk * SPEED / HUB_R) * (0.45 + burst * 0.3) * fade;
      h.sprite.material.opacity = land * (0.7 + burst * 0.6) * fade;
      h.sprite.scale.setScalar(9 + burst * 8);
      h.light.intensity = land * (22 + burst * 40) * fade;
    }

    let lit = 0;
    for (let i = 0; i < N; i++) if (igniteAt[i] <= t) lit++;
    const pct = (lit / N) * 100 * fade;
    const key = `${Math.round(pct)}|${shown}`;
    if (key !== lastHud) { lastHud = key; hud(pct, fade > 0 ? shown : 0); }
    placeCamera();
  };

  const render = () => renderer.render(scene, camera);

  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    portrait = w / h < 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = portrait ? 52 : 40;
    // push the city away from the copy: right on wide screens, up on narrow ones
    if (w >= 900) camera.setViewOffset(w, h, -w * 0.16, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    camera.updateProjectionMatrix();
    if (still || !running) { update(0); render(); }
  };
  const ro = new ResizeObserver(resize);

  let raf = 0, running = false, last = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  };
  const setRunning = (on: boolean) => {
    if (still || on === running) return;
    running = on;
    if (on) { last = performance.now(); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  };
  ro.observe(el);

  const dispose = () => {
    cancelAnimationFrame(raf);
    running = false;
    ro.disconnect();
    removeEventListener('pointermove', onPtr);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach((mt) => mt.dispose());
    });
    halo.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { setRunning, dispose };
}
