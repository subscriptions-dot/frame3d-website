/* Orbit hero: the glass Frame3D mark inside tilted glowing rings; six feature planets ride the rings and open a
   glass card with a leader line on hover (tap on touch). Own renderer + canvas inside the hero band, paused
   while the band is off screen. Used by index.html (top of the site). */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const ASSET = p => new URL(p, import.meta.url).href;

// Icons: Lucide-style outlines (ISC licence).
const PATHS = {
  depth: '<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7"/><path d="M12 11.5v10"/>',
  space: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2M20 18v2M12 4v9"/>',
  play: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.69-7.26A4 4 0 0 0 17.32 5z"/>',
  voice: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  playbtn: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>'
};
const mini = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[k]}</svg>`;

/* ---------- features (real Frame3D facts only): one small glass pill each, like a piece of the browser UI ---------- */
const wave = n => '<span class="ow-wave">' + Array.from({ length: n }, (_, k) => `<i style="--k:${k}"></i>`).join('') + '</span>';
export const FEAT = [
  { key: 'depth', col: '#4CE0F5', title: '2D to 3D, live',
    w: `<span class="ow-dot">${mini('depth')}</span><span class="ow-col"><span>2D to 3D, live</span><span class="ow-bar" style="--v:72%"><i></i></span></span>` },
  { key: 'ext', col: '#A78BFA', title: 'Firefox add-ons',
    w: `<span class="ow-ic">${mini('search')}</span><span class="ow-txt">Search Firefox add-ons</span><span class="ow-kbd">⌘K</span>` },
  { key: 'vr', col: '#E879F9', title: '180° and 360° video',
    w: `<span class="ow-dot">${mini('playbtn')}</span><span class="ow-col"><span>180° · 360° video</span><span class="ow-bar" style="--v:42%"><i></i></span></span>` },
  { key: 'space', col: '#60A5FA', title: 'Spaces',
    w: `<span class="ow-traffic"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i></span><span class="ow-tab"><i>${mini('space')}</i>Sunset Lounge</span><span class="ow-plus">+</span>` },
  { key: 'play', col: '#22D3EE', title: 'Gamepad and controllers',
    w: `<span class="ow-dot">${mini('play')}</span><span class="ow-txt">Gamepad &amp; controllers</span><span class="ow-key">A</span>` },
  { key: 'voice', col: '#C084FC', title: 'Voice',
    w: `<span class="ow-dot">${mini('voice')}</span><span class="ow-txt">Speak to search</span>${wave(9)}` }
];

/* ---------- materials ---------- */
function glowMat(c, a){
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(c) }, uA: { value: a } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - .5) * 2.; gl_FragColor = vec4(uC * uA * pow(max(0., 1. - d), 2.2), 1.); }' });
}
// thin target ring round each feature planet: a slow pulse says "you can point at me"
function ringMat(c){
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(c) }, uT: { value: 0 }, uH: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 uC; uniform float uT, uH; varying vec2 vUv;
      void main(){ float d = length(vUv - .5) * 3.2;
        float r0 = .62 + .06 * uH, w = .025;
        float ring = smoothstep(w, 0., abs(d - r0)) * (.55 + .45 * uH);
        float ph = fract(uT * .35); float pulse = smoothstep(w * 1.5, 0., abs(d - (r0 + ph * .9))) * (1. - ph) * .7 * (1. - uH);
        float a = atan(vUv.y - .5, vUv.x - .5); float dash = mix(1., step(.5, fract(a * 6.366 + uT * .2)), .5 * (1. - uH));
        gl_FragColor = vec4((uC * .8 + .3) * (ring * dash + pulse), 1.); }` });
}
// coloured glass for the mark: gradient body, soft inner glow, and a gentle rim.
// The rim is kept low and smoothed: a hard fresnel picked out the bevel's facets as a wavy line on the frame edge.
function glassMat(c0, c1, o = {}){
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .1, metalness: 0, transmission: o.tr ?? .35, thickness: 1.4, ior: 1.42,
    clearcoat: 1, clearcoatRoughness: .06, iridescence: .12, iridescenceIOR: 1.3, envMapIntensity: .45, attenuationColor: new THREE.Color(c1), attenuationDistance: 1.2 });
  m.onBeforeCompile = s => {
    s.uniforms.c0 = { value: new THREE.Color(c0) }; s.uniforms.c1 = { value: new THREE.Color(c1) }; s.uniforms.uGlow = { value: o.glow ?? .35 };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform vec3 c0, c1; uniform float uGlow;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec3 gcol = mix(c0, c1, clamp((vOP.x - vOP.y) * ${(o.k ?? .32).toFixed(2)} + .5, 0., 1.)); vec4 diffuseColor = vec4( gcol, opacity );`)
      .replace('#include <opaque_fragment>', `float nv = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0., 1.);
        float fr = smoothstep(.55, 0., nv);
        outgoingLight = outgoingLight * gcol * 1.6 + gcol * uGlow + mix(vec3(.25, .85, 1.), vec3(.7, .4, 1.), clamp(vOP.x * .3 + .5, 0., 1.)) * fr * .55;
        #include <opaque_fragment>`);
  };
  return m;
}

export function initOrbit(root, opts = {}){
  const $ = s => root.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const FAST = !!opts.fast;
  if (FAST) root.classList.add('fast');

  const canvas = $('.o-gl');
  const PR = Math.min(devicePixelRatio, fine ? 2 : 1.6);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(PR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 100); cam.position.set(0, 0, 11);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .6;

  // space plate (logo, ring and planets painted out of the owner's PSD); the glass refracts it
  const bgTex = new THREE.TextureLoader().load(ASSET('../assets/images/orbit_bg.webp')); bgTex.colorSpace = THREE.SRGBColorSpace;
  const BG_Z = -14, BG_ASP = 1779 / 884;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false, depthWrite: false }));
  bg.position.z = BG_Z; bg.renderOrder = -10; scene.add(bg);

  // sparse twinkling stars between the plate and the mark
  const stars = (() => {
    const n = 260, p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++){ p[i*3] = (Math.random() - .5) * 34; p[i*3+1] = (Math.random() - .5) * 18; p[i*3+2] = -6 - Math.random() * 6; s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uPR: { value: PR } },
      vertexShader: 'attribute float aS; uniform float uT, uPR; varying float vA; void main(){ vA = .25 + .75 * pow(.5 + .5 * sin(uT * (1. + aS * 2.) + aS * 40.), 3.); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = (1. + aS * 2.) * uPR; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.75, .85, 1.) * vA * smoothstep(.5, 0., d), 1.); }' });
    const o = new THREE.Points(g, m); scene.add(o); return o;
  })();

  const world = new THREE.Group(); scene.add(world);          // everything that leans with the pointer
  const glowA = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowMat('#1E9BFF', .55)); glowA.position.set(-1.4, .6, -3);
  const glowB = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), glowMat('#7E45FF', .28)); glowB.position.set(1.7, .5, -3.6);
  world.add(glowA, glowB);

  /* ---------- glass Frame3D mark ---------- */
  const ready = { mark: false };
  const markPivot = new THREE.Group(); world.add(markPivot);
  const markHold = new THREE.Group(); markPivot.add(markHold);
  // The mark is built here with dense, smooth bevels (same proportions as the brand mark / mark.gltf.json):
  // the exported mesh's corners were too coarse, and the glass rim showed every facet as a wavy line.
  {
    const MF = glassMat('#0A9CFF', '#5B2EFF', { glow: .55, k: .42, tr: .18 }), MT = glassMat('#4F6BFF', '#B03CF0', { glow: .42, tr: .25 }), MS = glassMat('#2050E0', '#5A22C0', { glow: .3 });
    const rrect = (path, h, r) => { path.moveTo(-h + r, -h); path.lineTo(h - r, -h); path.absarc(h - r, -h + r, r, -Math.PI / 2, 0); path.lineTo(h, h - r); path.absarc(h - r, h - r, r, 0, Math.PI / 2);
      path.lineTo(-h + r, h); path.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI); path.lineTo(-h, -h + r); path.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5); return path; };
    // closed outline without the repeated start point: a zero-length closing edge made the bevel fold into a notch
    const pts = (h, r) => { const q = rrect(new THREE.Path(), h, r).getPoints(24); while (q.length > 1 && q[0].distanceTo(q[q.length - 1]) < 1e-4) q.pop();
      return q.filter((v, i) => i === 0 || v.distanceTo(q[i - 1]) > 1e-4); };
    const ext = (shape, depth, bev) => { const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 10, curveSegments: 40 }); g.translate(0, 0, -(depth - bev * 2) / 2); return g; };
    const B = .12, TB = .15;   // deep, round bevels: the glass reads as soft tubes like the brand art
    const fs = new THREE.Shape(pts(1.02 - B, .5 - B)); fs.holes.push(new THREE.Path(pts(.66 + B, .2 + B).reverse()));   // holes wind the other way
    const frame = new THREE.Mesh(ext(fs, .3, B), MF);
    const tile = new THREE.Mesh(ext(new THREE.Shape(pts(.78 - TB, .38 - TB)), .5, TB), [MT, MT]);
    tile.position.set(.78, .84, .43);   // sits fully in front of the frame, so no frame corner pokes through its side
    const mk = new THREE.Group(); mk.add(frame, tile);
    const bb = new THREE.Box3().setFromObject(mk), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    mk.position.sub(c); markHold.add(mk); markHold.scale.setScalar(2.35 / Math.max(sz.x, sz.y));
    ready.mark = true; queueMicrotask(() => opts.onReady && opts.onReady());
  }

  const lc = new THREE.PointLight('#38B6FF', 26, 20, 1.6); lc.position.set(-4, 1.5, 3);
  const lv = new THREE.PointLight('#A855F7', 26, 20, 1.6); lv.position.set(4, 2.5, 2.5);
  const lw = new THREE.PointLight('#bcd4ff', 8, 20, 1.6); lw.position.set(0, 4, -2);
  world.add(lc, lv, lw, new THREE.AmbientLight('#4060ff', .25));

  /* ---------- orbit system ---------- */
  const orbit = new THREE.Group(); world.add(orbit);
  orbit.rotation.order = 'ZXY'; orbit.rotation.set(-1.36, 0, .2);   // ZXY: the z tilt happens in screen space, after the lay-back
  const spin = new THREE.Group(); orbit.add(spin);

  // glowing bands: flat rings in the orbit plane, colour sweeps round, brighter on the near side
  const BANDS = [[2.55, .02, .5, 1], [3.0, .03, .8, 1], [3.45, .32, 1.15, 0], [3.48, .035, 1.4, 1], [3.82, .025, .8, 1], [4.05, .02, .55, 1], [4.3, .015, .35, 1]];
  const bandMats = [];
  for (const [r, w, k, sharp] of BANDS){
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uR: { value: r }, uW: { value: w }, uK: { value: k }, uS: { value: sharp }, uIn: { value: 0 } },
      vertexShader: 'varying vec3 vP; varying float vZ; void main(){ vP = position; vec4 wp = modelMatrix * vec4(position, 1.); vZ = wp.z; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: `uniform float uT, uR, uW, uK, uS, uIn; varying vec3 vP; varying float vZ;
        void main(){
          float r = length(vP.xy), a = atan(vP.y, vP.x);
          float d = abs(r - uR) / uW;
          float prof = uS > .5 ? exp(-d * d * 2.5) : exp(-d * d * 1.2) * .55;
          float sw = .5 + .5 * sin(a - uT * .35);
          vec3 col = mix(vec3(.2, .62, 1.), vec3(.62, .35, 1.), sw);
          col = mix(col, vec3(.95, .45, .95), pow(max(0., sin(a * 2. + uT * .2)), 6.) * .6);
          float near = smoothstep(-3.5, 3., vZ);
          float streak = .75 + .25 * sin(a * 3. - uT * .9);
          gl_FragColor = vec4(col * prof * uK * (.35 + .9 * near) * streak * uIn, 1.);
        }` });
    bandMats.push(m);
    const mesh = new THREE.Mesh(new THREE.RingGeometry(r - w * 3, r + w * 3, 384, 1), m); mesh.renderOrder = 2; orbit.add(mesh);
  }

  // dust: dotted rings and fine particles riding the orbit
  const dustMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uPR: { value: PR }, uIn: { value: 0 } },
    vertexShader: `attribute float aS; attribute float aR; uniform float uT, uPR; varying float vA; varying float vS;
      void main(){ vec3 p = position; float ang = uT * (.5 / aR); float c = cos(ang), s = sin(ang); p.xy = mat2(c, s, -s, c) * p.xy;
        vec4 mv = modelViewMatrix * vec4(p, 1.); vA = .4 + .6 * pow(.5 + .5 * sin(uT * 2. + aS * 60.), 2.); vS = aS;
        gl_PointSize = (aS > .93 ? 3.2 : 1.4 + aS) * uPR * (11. / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform float uIn; varying float vA; varying float vS; void main(){ float d = length(gl_PointCoord - .5); vec3 c = mix(vec3(.55, .8, 1.), vec3(.8, .6, 1.), vS); gl_FragColor = vec4(c * vA * uIn * smoothstep(.5, .05, d), 1.); }' });
  {
    const pts = [];
    const ring = (r, n, jitter) => { for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2 + Math.random() * jitter; const rr = r + (Math.random() - .5) * jitter * .6; pts.push([Math.cos(a) * rr, Math.sin(a) * rr, (Math.random() - .5) * .02, Math.random(), r]); } };
    ring(2.78, 180, 0); ring(3.22, 260, 0); ring(3.62, 900, .5); ring(3.45, 600, .25); ring(4.15, 220, .05);
    const n = pts.length, p = new Float32Array(n * 3), s = new Float32Array(n), rr = new Float32Array(n);
    pts.forEach((q, i) => { p.set([q[0], q[1], q[2]], i * 3); s[i] = q[3]; rr[i] = q[4]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1)); g.setAttribute('aR', new THREE.BufferAttribute(rr, 1));
    const d = new THREE.Points(g, dustMat); d.renderOrder = 3; orbit.add(d);
  }

  // glass bubbles along the rings
  // Bubbles are see-through by alpha, not by transmission: a transmissive bubble in front of the (also
  // transmissive) mark refracts only the plate behind and punches a blue "hole" into the logo.
  const glassBall = new THREE.MeshPhysicalMaterial({ color: '#cfdcff', roughness: .05, metalness: 0, iridescence: .9, iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 520], clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.6, transparent: true, depthWrite: false });
  glassBall.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `float fr = pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
      outgoingLight = outgoingLight * .6 + mix(vec3(.35, .75, 1.), vec3(.8, .55, 1.), clamp(normal.x * .5 + .5, 0., 1.)) * fr * 1.5 + vec3(.05, .07, .16);
      diffuseColor.a = clamp(.16 + fr * .95 + max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b) * .25, 0., 1.);
      #include <opaque_fragment>`);
  };
  const BUB = 46;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 32, 20), glassBall, BUB);
  const bubData = [];
  for (let i = 0; i < BUB; i++){
    const r = [2.78, 3.0, 3.22, 3.48, 3.62, 3.82, 4.05][i % 7] + (Math.random() - .5) * .06;
    bubData.push({ r, a: Math.random() * Math.PI * 2, s: .03 + Math.pow(Math.random(), 2.5) * .1, z: (Math.random() - .5) * .08 });
  }
  spin.add(bubbles);

  // feature planets: bigger glass spheres with a coloured core, a halo and a target ring
  const planets = [];
  const hitGeo = new THREE.SphereGeometry(1, 12, 8), hitMat = new THREE.MeshBasicMaterial({ visible: false });
  FEAT.forEach((f, i) => {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), glassBall);
    const core = new THREE.Mesh(new THREE.SphereGeometry(.34, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(f.col).multiplyScalar(1.6), toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), glowMat(f.col, .55));
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), ringMat(f.col)); ring.renderOrder = 4;
    const hit = new THREE.Mesh(hitGeo, hitMat); hit.userData.i = i;
    g.add(halo, core, shell, ring, hit);
    const r = [3.48, 3.0, 3.82, 3.48, 3.22, 4.05][i];
    planets.push({ f, g, shell, core, halo, ring, hit, r, a: i / FEAT.length * Math.PI * 2 + .35, base: [.24, .21, .2, .23, .19, .21][i], hov: 0 });
    spin.add(g);
  });
  const hits = planets.map(p => p.hit);

  /* ---------- post: MSAA target so glass edges stay clean ---------- */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .7, .5, .7));
  composer.addPass(new OutputPass());

  /* ---------- layout ---------- */
  let W = 1, H = 1, mobile = false;
  function resize(){
    const r = root.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); mobile = W < 860;
    renderer.setSize(W, H, false); composer.setPixelRatio(PR); composer.setSize(W, H);
    cam.aspect = W / H;
    const needW = mobile ? 10.2 : 10.5;
    const vfov = 2 * Math.atan(Math.max(Math.tan(THREE.MathUtils.degToRad(15)), needW / 2 / cam.aspect / 11));
    cam.fov = THREE.MathUtils.radToDeg(vfov); cam.updateProjectionMatrix();
    world.position.set(mobile ? 0 : .35, mobile ? .55 : -.25, 0);
    const dist = cam.position.z - BG_Z, hh = 2 * dist * Math.tan(vfov / 2) * 1.08, ww = hh * cam.aspect;
    if (ww / hh > BG_ASP) bg.scale.set(ww, ww / BG_ASP, 1); else bg.scale.set(hh * BG_ASP, hh, 1);
  }
  new ResizeObserver(resize).observe(root); resize();

  /* ---------- interaction ---------- */
  const ptr = { x: 0, y: 0, in: false };
  const ray = new THREE.Raycaster(), nd = new THREE.Vector2();
  let hover = -1, active = -1, pinned = false, closeT = 0, overPop = false;
  const pop = $('.o-pop'), lead = $('.o-lead'), path = lead.querySelector('path'), dot = lead.querySelectorAll('circle');
  const dotsEl = $('.o-dots'), cnum = $('.o-cnum'), hint = $('.o-hint');
  FEAT.forEach((f, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', f.tag); b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => open(i, true)); dotsEl.append(b); });
  const dotBtns = [...dotsEl.children];
  if (hint) hint.querySelector('span').textContent = fine ? 'Point at a planet' : 'Tap a planet';
  const local = e => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function pick(x, y){
    nd.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(nd, cam);
    const h = ray.intersectObjects(hits, false); return h.length ? h[0].object.userData.i : -1;
  }
  function fill(i){
    const f = FEAT[i];
    pop.style.setProperty('--fc', f.col);
    pop.innerHTML = f.w;
    pop.setAttribute('aria-label', f.title);
  }
  function open(i, pin = false){
    clearTimeout(closeT);
    if (i !== active){
      if (active >= 0){ pop.classList.remove('on'); lead.classList.remove('on'); }
      active = i; fill(i); popPos.init = false; path.dataset.k = '';
      placePop(0); void pop.offsetWidth; pop.classList.add('on'); lead.classList.add('on');   // place first so the card fades in where it belongs
    }
    pinned = pin || pinned;
    cnum.textContent = String(i + 1).padStart(3, '0');
    dotBtns.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
    hint && hint.classList.add('off');
  }
  function close(){
    if (active < 0) return; pop.classList.remove('on'); lead.classList.remove('on'); active = -1; pinned = false;
    dotBtns.forEach(b => b.setAttribute('aria-pressed', 'false'));
  }
  function softClose(){ clearTimeout(closeT); closeT = setTimeout(() => { if (!overPop && hover < 0 && !pinned) close(); }, 280); }

  root.addEventListener('pointermove', e => {
    const [x, y] = local(e); ptr.x = x; ptr.y = y; ptr.in = true;
    if (e.pointerType !== 'mouse') return;
    if (pop.contains(e.target)) return;
    const i = pick(x, y);
    if (i !== hover){ hover = i; canvas.style.cursor = i >= 0 ? 'pointer' : ''; if (i >= 0){ pinned = false; open(i); } else softClose(); }
  }, { passive: true });
  root.addEventListener('pointerleave', () => { ptr.in = false; hover = -1; softClose(); });
  pop.addEventListener('pointerenter', () => { overPop = true; clearTimeout(closeT); });
  pop.addEventListener('pointerleave', () => { overPop = false; softClose(); });
  // touch / pen: tap a planet to open, tap empty space to close
  let down = null;
  root.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; }, { passive: true });
  root.addEventListener('pointerup', e => {
    if (!down || e.pointerType === 'mouse') return;
    const [x0, y0, t0] = down; down = null; if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10 || performance.now() - t0 > 500) return;
    if (pop.contains(e.target) || dotsEl.contains(e.target) || e.target.closest('a,button')) return;
    const [x, y] = local(e); const i = pick(x, y); if (i >= 0) open(i, true); else close();
  });
  root.addEventListener('click', e => { if (dotsEl.contains(e.target) || pop.contains(e.target)) return; if (pinned && hover < 0) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  /* ---------- card placement: on the planet's outer side, leader with one elbow ---------- */
  const popPos = { x: 0, y: 0, init: false };
  const _v = new THREE.Vector3(), _c = new THREE.Vector3();
  function placePop(dt){
    if (active < 0) return;
    const P = planets[active];
    P.g.getWorldPosition(_v); _v.project(cam);
    const px = (_v.x * .5 + .5) * W, py = (-_v.y * .5 + .5) * H;
    const pw = pop.offsetWidth, ph = pop.offsetHeight, m = 16;
    let tx, ty, ax, ay, straight = mobile;
    if (mobile){
      tx = (W - pw) / 2; ty = H - ph - 104;   // phone: card docks above the CTA, under the orbit
      ax = Math.max(tx + 24, Math.min(tx + pw - 24, px)); ay = ty > py ? ty : ty + ph;
    } else {
      // card goes on the planet's outer side (away from the mark); if that side has no room, it goes above
      // or below the planet, still leaning outward, so it never sits on top of the logo
      markPivot.getWorldPosition(_c); _c.project(cam); const mx = (_c.x * .5 + .5) * W;
      const outR = px >= mx;
      _c.set(1.45, 0, 0); markPivot.localToWorld(_c); _c.project(cam); const lhw = Math.abs((_c.x * .5 + .5) * W - mx);   // logo half-width on screen
      if (outR ? Math.max(px + 70, mx + lhw + 24) + pw <= W - m : Math.min(px - 70 - pw, mx - lhw - 24 - pw) >= m){
        tx = outR ? Math.max(px + 70, mx + lhw + 24) : Math.min(px - 70 - pw, mx - lhw - 24 - pw);   // clear of the planet and of the logo
        ty = py < H * .5 ? py + 34 : py - ph - 34;
        tx = Math.max(m, Math.min(W - pw - m, tx)); ty = Math.max(90, Math.min(H - ph - 100, ty));
        ax = outR ? tx : tx + pw; ay = ty > py ? ty + 26 : ty + ph - 26;
      } else {
        tx = outR ? px - 60 : px - pw + 60;
        tx = Math.max(m, Math.min(W - pw - m, tx));
        ty = py - ph - 56 >= 90 ? py - ph - 56 : py + 56;
        ty = Math.max(90, Math.min(H - ph - 100, ty));
        ax = Math.max(tx + 28, Math.min(tx + pw - 28, px)); ay = ty > py ? ty : ty + ph; straight = true;
      }
    }
    const k = popPos.init ? 1 - Math.exp(-dt * 10) : 1; popPos.init = true;
    popPos.x += (tx - popPos.x) * k; popPos.y += (ty - popPos.y) * k;
    pop.style.setProperty('--x', popPos.x.toFixed(1) + 'px'); pop.style.setProperty('--y', popPos.y.toFixed(1) + 'px');
    ax += popPos.x - tx; ay += popPos.y - ty;
    const dx = ax - px, dy = ay - py, L = Math.hypot(dx, dy) || 1;
    const sx = px + dx / L * 30, sy = py + dy / L * 30;
    const ex = ax + (ax > px ? -28 : 28);
    path.setAttribute('d', straight ? `M${sx.toFixed(1)},${sy.toFixed(1)} L${ax.toFixed(1)},${ay.toFixed(1)}` : `M${sx.toFixed(1)},${sy.toFixed(1)} L${ex.toFixed(1)},${ay.toFixed(1)} L${ax.toFixed(1)},${ay.toFixed(1)}`);
    if (path.dataset.k !== String(active)){ lead.style.setProperty('--len', Math.ceil(path.getTotalLength()) + 40); path.dataset.k = active; }
    dot[0].setAttribute('cx', sx); dot[0].setAttribute('cy', sy); dot[1].setAttribute('cx', ax); dot[1].setAttribute('cy', ay);
  }

  /* ---------- loop (only while the band is on screen) ---------- */
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pv = new THREE.Vector3();
  const dbg = { freeze: false };
  let last = performance.now(), t = 0, spinA = 0, speed = .1, intro = 0, leanX = 0, leanY = 0, onScreen = true, raf = 0, started = false;
  function frame(now, manual){
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
    if (ready.mark && started) intro = FAST ? 1 : Math.min(1, intro + dt / 2.4);
    const ei = 1 - Math.pow(1 - intro, 4);
    const target = (active >= 0 ? .006 : .085) * (reduce ? .3 : 1);
    speed += (target - speed) * (1 - Math.exp(-dt * 3));
    spinA += speed * dt;
    const nx = ptr.in ? ptr.x / W * 2 - 1 : 0, ny = ptr.in ? ptr.y / H * 2 - 1 : 0;
    const kl = 1 - Math.exp(-dt * 2.5); leanX += (nx - leanX) * kl; leanY += (ny - leanY) * kl;
    world.rotation.set(leanY * .08, leanX * .12, 0);
    bg.position.set(-leanX * .5, leanY * .3, BG_Z);
    if (!dbg.freeze) markPivot.scale.setScalar(.75 + .25 * ei);
    if (!dbg.freeze) markPivot.rotation.set(-.12 + Math.sin(t * .5) * .06, .32 + Math.sin(t * .35) * .18 - (1 - ei) * 1.6, -.05 + Math.sin(t * .42) * .03);
    markPivot.position.y = .1 + Math.sin(t * .7) * .06;
    orbit.scale.setScalar(.82 + .18 * ei);
    orbit.rotation.z = .2 + Math.sin(t * .12) * .025; orbit.rotation.x = -1.36 + Math.sin(t * .09) * .02;
    bandMats.forEach(m => { m.uniforms.uT.value = t + spinA * 6; m.uniforms.uIn.value = ei; });
    dustMat.uniforms.uT.value = spinA * 7; dustMat.uniforms.uIn.value = ei;
    stars.material.uniforms.uT.value = t;
    for (let i = 0; i < BUB; i++){
      const b = bubData[i], a = b.a + spinA * (3.4 / b.r);
      Pv.set(Math.cos(a) * b.r, Math.sin(a) * b.r, b.z); S.setScalar(b.s * (.6 + .4 * ei));
      M.compose(Pv, Q, S); bubbles.setMatrixAt(i, M);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    planets.forEach((P, i) => {
      P.hov += ((i === active ? 1 : 0) - P.hov) * (1 - Math.exp(-dt * 6));
      const a = P.a + spinA * (3.4 / P.r);
      P.g.position.set(Math.cos(a) * P.r, Math.sin(a) * P.r, 0);
      P.g.quaternion.copy(orbit.quaternion).invert();               // halo + ring face the camera
      const s = P.base * (1 + P.hov * .45) * (.5 + .5 * ei) * (1 + Math.sin(t * 1.3 + i) * .03);
      P.shell.scale.setScalar(s); P.core.scale.setScalar(s * (1 + Math.sin(t * 2 + i * 2) * .08));
      P.halo.scale.setScalar(s * (1 + P.hov * .6)); P.halo.material.uniforms.uA.value = .45 + P.hov * .6;
      P.ring.scale.setScalar(s); P.ring.material.uniforms.uT.value = t + i * .7; P.ring.material.uniforms.uH.value = P.hov;
      P.hit.scale.setScalar(Math.max(s * 2, .38));
    });
    composer.render();
    placePop(dt);
    if (!manual && onScreen) raf = requestAnimationFrame(frame);
  }
  const loop = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
  new IntersectionObserver(es => { const v = es[0].isIntersecting; if (v && !onScreen){ onScreen = true; loop(); } else if (!v){ onScreen = false; cancelAnimationFrame(raf); close(); } }, { threshold: 0 }).observe(root);
  loop();

  const api = {
    planets, open, close, cam, world, markPivot, orbit, dbg,
    start(){ started = true; root.classList.add('in'); },   // play the intro (the page calls this after its loader)
    step(n = 1, ms = 16.7){ for (let i = 0; i < n; i++) frame(last + ms, true); },   // debug: step frames when rAF is paused
    get speed(){ return speed; }
  };
  return api;
}
