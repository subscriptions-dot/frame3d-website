import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { initOrbit } from './orbit-hero.js?v=20261117131029';

const F = window.F3D, reduce = F.reduce;
const $ = s => document.querySelector(s);
const clamp01 = v => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });   // the phone address bar showing/hiding must not re-measure the page mid-scroll

/* ---------------- smooth scroll ---------------- */
let lenis = null;
const touchDev = !matchMedia('(hover: hover)').matches;
// Touch screens always get the controlled scroll (even with reduce-motion on): otherwise the phone's own fling throws the page to the end in one swipe.
if (window.Lenis && (!reduce || touchDev)){
  lenis = new Lenis({ lerp: .09, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: .91, syncTouch: true, syncTouchLerp: .07, touchInertiaMultiplier: 7.8 });   // touch too: page and 3D move in the same frame   // speed follows the wheel, no fixed duration
  lenis.on('scroll', e => { F.vel = e.velocity * 60; F.velT = performance.now(); ScrollTrigger.update(); });
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop(); F.lenis = lenis;
}
const BUILD = '20261117131029';
const scrollToEl = (t, dur = 1.6) => lenis ? lenis.scrollTo(t, { duration: dur, easing: easeIO }) : (typeof t === 'number' ? scrollTo(0, t) : t.scrollIntoView());
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const t = document.querySelector(a.getAttribute('href')); if (t){ e.preventDefault(); scrollToEl(t); } }));

let lastY = 0; const hdr = $('#hdr');
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: self => { const y = self.scroll(); hdr.classList.toggle('hide', y > 160 && y > lastY && !document.body.classList.contains('menu-open')); lastY = y; } });

/* ---------------- renderer + views ---------------- */
const canvas = $('#gl');
const mobile = !matchMedia('(hover: hover)').matches || innerWidth < 720;
let PR = Math.min(devicePixelRatio, mobile ? 1 : 1.5);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;

const GROUND_LIGHT = '#EEF1F5', GROUND_DARK = '#05060B', themeGround = () => document.documentElement.classList.contains('dark') ? GROUND_DARK : GROUND_LIGHT;
const GROUND = new THREE.Color(themeGround()), NIGHT = new THREE.Color('#05060B'), clearCol = GROUND.clone();
addEventListener('f3d-theme', () => GROUND.set(themeGround()));   // the switch in the header
const views = [];
function addView(el, scene, camera, update, opts = {}){ const v = { el, scene, camera, update, rect: null, visible: false, ready: true, ...opts }; views.push(v); return v; }
class ViewsPass extends Pass {
  constructor(){ super(); this.needsSwap = false; }
  render(r, writeBuffer, readBuffer){
    r.setRenderTarget(readBuffer); r.setClearColor(clearCol, 1); r.clear();
    const H = innerHeight, ac = r.autoClear; r.autoClear = false;   // views share one buffer: never wipe it per view
    for (const v of views){
      if (!v.on) continue;
      const b = v.rect, x = b.left * PR, y = (H - b.bottom) * PR, w = b.width * PR, h = b.height * PR;
      const cx = Math.max(0, x), cy = Math.max(0, y), cw = Math.min(readBuffer.width, x + w) - cx, ch = Math.min(readBuffer.height, y + h) - cy;
      if (cw <= 0 || ch <= 0) continue;
      readBuffer.viewport.set(x, y, w, h); readBuffer.scissor.set(cx, cy, cw, ch); readBuffer.scissorTest = true; r.setRenderTarget(readBuffer);
      if (v.uRect) v.uRect.value.set(x, y, w, h);
      r.clearDepth();
      r.render(v.scene, v.camera);
      if (v.after){ r.clearDepth(); r.render(v.after, v.camera); }
    }
    readBuffer.viewport.set(0, 0, readBuffer.width, readBuffer.height); readBuffer.scissor.set(0, 0, readBuffer.width, readBuffer.height); readBuffer.scissorTest = false;
    r.autoClear = ac;
  }
}
const composer = new EffectComposer(renderer);
composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight);
composer.addPass(new ViewsPass());
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .45, .5, 1.0);
composer.addPass(bloom);
const ca = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt; varying vec2 vUv;
    void main(){ vec2 d = (vUv - .5); float k = uAmt * dot(d, d) * 4.;
      vec2 a = clamp(vUv + d * k, .002, .998), b = clamp(vUv - d * k, .002, .998);   // never pull colour from past the edge
      gl_FragColor = vec4(texture2D(tDiffuse, a).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, b).b, 1.); }` });
ca.enabled = false; composer.addPass(ca);
composer.addPass(new OutputPass());
const smaa = mobile ? null : new SMAAPass(innerWidth * PR, innerHeight * PR); if (smaa) composer.addPass(smaa);
const grain = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: .04 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAmt; varying vec2 vUv;
    float h(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float n = h(gl_FragCoord.xy + fract(uTime) * 97.) - .5;
      float l = dot(c.rgb, vec3(.299,.587,.114)); c.rgb += n * uAmt * (1. - l * .6) + (h(gl_FragCoord.yx * 1.7) - .5) / 255.; gl_FragColor = c; }`
});
composer.addPass(grain);
// Phones: no film grain (invisible at that size, a full-screen pass every frame) and a quarter-size bloom.
const BLOOM_DIV = mobile ? 4 : 2;
if (mobile){ grain.enabled = false; bloom.setSize(innerWidth / BLOOM_DIV, innerHeight / BLOOM_DIV); }

/* ---------------- loading ---------------- */
const manager = new THREE.LoadingManager();
const loN = $('#lo-n'), loBar = $('#lo-bar'); let shown = 0, target = 0;
manager.onProgress = (u, done, total) => { target = done / total; };
const loTick = () => { shown += (target - shown) * .12; loN.textContent = Math.round(shown * 100); loBar.style.transform = `scaleX(${shown})`; };
gsap.ticker.add(loTick);
let finished = false;
// Shader warm-up, one scene per idle slot after the page is up (it used to block the loader for seconds on phones).
const idle = f => window.requestIdleCallback ? requestIdleCallback(f, { timeout: 500 }) : setTimeout(f, 60);
function warmLater(){
  const jobs = [() => { try { renderTunnel(screenRT); } catch (e){ console.warn(e); } }, () => warm(tunScene, tunCam), () => warm(tunLogo, tunCam)];
  views.forEach(v => { jobs.push(() => warm(v.scene, v.camera)); if (v.after) jobs.push(() => warm(v.after, v.camera)); });
  const next = () => { const j = jobs.shift(); if (!j) return; j(); idle(next); };
  idle(next);
}
function finishLoader(){
  if (finished) return; finished = true; target = 1;
  setTimeout(() => {
    gsap.ticker.remove(loTick); loN.textContent = '100'; loBar.style.transform = 'scaleX(1)';
    $('#loader').classList.add('done'); lenis && lenis.start(); scrollTo(0, 0);
    setTimeout(() => orbit.start(), 350);
    // the two heavy models: desktop fetches them behind the banner; phones only when the monitor section gets close
    if (!mobile){ setTimeout(() => loadShatter(), 600); setTimeout(loadDeferred, 2500); }
    else {   // an IntersectionObserver, not a ScrollTrigger: a trigger created this late and killing itself broke ScrollTrigger on fast jumps
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)){ io.disconnect(); loadShatter(); loadDeferred(); } }, { rootMargin: '150% 0px 150% 0px' });
      io.observe($('#dive-stage'));
    }
    setTimeout(() => $('#loader').remove(), 1300);
    ScrollTrigger.refresh();
    setTimeout(warmLater, 1600);   // after the banner intro has started
  }, 200);
}
// The loader no longer waits for every picture: it lifts once the fonts are in (2.5 s at most) and the
// textures keep streaming in behind the page. Each 3D view waits for its own pictures.
Promise.all([document.fonts ? document.fonts.ready : 0, new Promise(r => setTimeout(r, 500))]).then(finishLoader);
setTimeout(finishLoader, 2500);
const texLoader = new THREE.TextureLoader(manager), lazyGltf = new GLTFLoader();
const tex = url => { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
// A texture whose picture is fetched later (loadDeferred): the material and its shader exist from the start, the image fills in.
const deferred = [], imgLoader = new THREE.ImageLoader();
const texLater = url => { const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; deferred.push([t, url]); return t; };
function loadDeferred(){ deferred.splice(0).forEach(([t, u]) => imgLoader.load(u, img => { t.image = img; t.needsUpdate = true; })); }
const pmrem = new THREE.PMREMGenerator(renderer);
// Upload every texture and shader of a scene once, off screen, so the first time a section scrolls in it does not stall.
const warmRT = new THREE.WebGLRenderTarget(64, 64);
function warm(scene, cam){
  try {
    scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { for (const k in m){ const v = m[k]; if (v && v.isTexture) renderer.initTexture(v); }
        if (m.uniforms) for (const k in m.uniforms){ const v = m.uniforms[k].value; if (v && v.isTexture) renderer.initTexture(v); } }); });
    // compile() skips hidden objects, so show everything for a moment (shards, light core, web) and put it back
    const hid = []; scene.traverse(o => { if (!o.visible){ hid.push(o); o.visible = true; } });
    renderer.compile(scene, cam);
    const prev = renderer.getRenderTarget(); renderer.setRenderTarget(warmRT); renderer.render(scene, cam); renderer.setRenderTarget(prev);
    hid.forEach(o => o.visible = false);
  } catch (e){ console.warn(e); }
}
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;

function gradMat(c0, c1, opts = {}){
  const m = new THREE.MeshPhysicalMaterial({ roughness: opts.rough ?? .18, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.1, iridescence: .15, iridescenceIOR: 1.3 });
  m.onBeforeCompile = s => {
    s.uniforms.c0 = { value: new THREE.Color(c0) }; s.uniforms.c1 = { value: new THREE.Color(c1) };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform vec3 c0, c1;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( mix(c0, c1, clamp((vOP.x - vOP.y) * ${(opts.k ?? .35).toFixed(2)} + .5, 0., 1.)), opacity );`);
  };
  return m;
}
function fitCam(cam, rect, baseFov){
  const a = rect.width / rect.height, base = 16 / 9; cam.aspect = a;
  cam.fov = a < base ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * base / a)) : baseFov;
  cam.updateProjectionMatrix();
}
const QUAD = new THREE.PlaneGeometry(2, 2);
function backdrop(uRect, radius, c0, c1){
  const m = new THREE.ShaderMaterial({
    uniforms: { uRect, uR: { value: radius * PR, r: radius }, c0: { value: new THREE.Color(c0) }, c1: { value: new THREE.Color(c1) } },
    depthWrite: false, depthTest: false, transparent: false,   // opaque so it draws first, under the objects
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, .999, 1.); }',
    fragmentShader: `uniform vec4 uRect; uniform float uR; uniform vec3 c0, c1; varying vec2 vUv;
      void main(){ vec2 p = gl_FragCoord.xy - (uRect.xy + uRect.zw * .5); vec2 q = abs(p) - uRect.zw * .5 + uR;
        float sd = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uR;
        vec3 c = mix(c1, c0, smoothstep(0., 1.2, 1. - length((vUv - vec2(.5, .62)) * vec2(1., 1.3))));
        if (sd > .5) discard; gl_FragColor = vec4(c, 1.); }`
  });
  const mesh = new THREE.Mesh(QUAD, m); mesh.frustumCulled = false; mesh.renderOrder = -10; return mesh;
}

/* ================= HERO: the orbit band runs its own renderer (js/orbit-hero.js) ================= */
const rr = (s, w, h, r) => { s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; };
const roundAlpha = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 288; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 288); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(0, 0, 512, 288, 18); g.fill(); const t = new THREE.CanvasTexture(c); return t; })();
const ltex = url => { const t = tex(url); t.generateMipmaps = true; return t; };
function rrGeo(w, h, r){ const g = new THREE.ShapeGeometry(rr(new THREE.Shape(), w, h, r), 8); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5); return g; }
function canvasTex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const redraw = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; }; redraw(); document.fonts && document.fonts.ready.then(redraw); return t; }
const orbit = initOrbit($('#top')); window.F3D_ORBIT = orbit;   // debug handle (step frames when the tab is in the background)


/* ================= STATEMENT words converge + REEL card bends and grows ================= */
const stWords = [...document.querySelectorAll('#st-h .w')];
stWords.forEach(w => w.style.transform = reduce ? 'none' : `translate3d(${w.dataset.dir * 28}vw,0,0)`);
if (!reduce) ScrollTrigger.create({ trigger: '#st-h', start: 'top bottom', end: 'center 55%', scrub: .6, onUpdate: s => {
  const q = 1 - ease(s.progress); stWords.forEach(w => w.style.transform = `translate3d(${w.dataset.dir * q * 28}vw,0,0)`);
}});

const lounge = tex(mobile ? 'assets/images/lounge_m.webp' : 'assets/images/lounge.webp'), aurora = tex(mobile ? 'assets/images/aurora_m.webp' : 'assets/images/aurora.webp');   // phones: 960 px copies
const reelU = {
  uTex: { value: lounge }, uTex2: { value: aurora }, uMix: { value: 0 }, uAspect: { value: 16 / 9 },
  uBox: { value: new THREE.Vector4(0, 0, 100, 100) }, uView: { value: new THREE.Vector2(innerWidth, innerHeight) },
  uBend: { value: 0 }, uR: { value: 20 }, uZoom: { value: 1.15 }
};
const reelMat = new THREE.ShaderMaterial({
  uniforms: reelU, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `uniform vec4 uBox; uniform vec2 uView; uniform float uBend; varying vec2 vUv; varying vec2 vPx;
    void main(){ vUv = uv; vec2 p = position.xy;
      vec2 px = uBox.xy + vec2(p.x, -p.y) * uBox.zw;
      float cx = p.x * 2.;
      px.y += uBend * uBox.w * (.22 * (1. - cx * cx) - .12 * cx);
      px.x += uBend * uBox.z * .05 * sin(p.y * 3.14159);
      vPx = vec2(p.x + .5, .5 - p.y) * uBox.zw;
      gl_Position = vec4(px.x / uView.x * 2. - 1., 1. - px.y / uView.y * 2., 0., 1.); }`,
  fragmentShader: `uniform sampler2D uTex, uTex2; uniform float uMix, uAspect, uR, uZoom; uniform vec4 uBox; varying vec2 vUv; varying vec2 vPx;
    vec2 cover(vec2 uv){ float ra = uBox.z / uBox.w; vec2 s = ra > uAspect ? vec2(1., uAspect / ra) : vec2(ra / uAspect, 1.); return (uv - .5) * s / uZoom + .5; }
    void main(){ vec2 uv = cover(vUv);
      vec3 c = mix(texture2D(uTex, uv).rgb, texture2D(uTex2, uv).rgb, uMix);
      vec2 q = abs(vPx - uBox.zw * .5) - uBox.zw * .5 + uR; float sd = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uR;
      gl_FragColor = vec4(c, clamp(.5 - sd, 0., 1.)); }`
});
const reelScene = new THREE.Scene(); const reelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 24), reelMat); reelMesh.frustumCulled = false; reelScene.add(reelMesh);
const fullEl = { getBoundingClientRect: () => ({ left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight }) };
const reel = { p: 0, s: 0 };
const reelCard = $('#reel-card'), reelTarget = $('#reel-target'), reelUI = $('#reel-ui'), stCopy = $('.st-copy');
const reelView = addView(fullEl, reelScene, new THREE.Camera(), function(t, dt){
  this.vis = () => reelMesh.visible;
  reel.s += (reel.p - reel.s) * Math.min(1, dt * 14);
  const a = reelCard.getBoundingClientRect(), b = reelTarget.getBoundingClientRect();
  const e = reduce ? 1 : easeIO(reel.s);
  const L = a.left + (b.left - a.left) * e, T = a.top + (b.top - a.top) * e, W = a.width + (b.width - a.width) * e, H = a.height + (b.height - a.height) * e;
  reelU.uBox.value.set(L + W / 2, T + H / 2, W, H); reelU.uView.value.set(innerWidth, innerHeight);
  reelU.uBend.value = reduce ? 0 : Math.sin(Math.PI * e) * .55;
  reelU.uR.value = 20 + 8 * e; reelU.uZoom.value = 1.15 - .13 * e;
  reelUI.classList.toggle('on', e > .97);
  // phones stack the text under the card: fade it out as the growing card reaches it, so they never overlap
  const cr = stCopy.getBoundingClientRect(), ov = Math.min(T + H, cr.bottom) - Math.max(T, cr.top);
  stCopy.style.opacity = e > .001 && ov > 0 && L < cr.right && L + W > cr.left ? Math.max(0, 1 - ov / 50).toFixed(3) : '';
  reelMesh.visible = T < innerHeight + H * .3 && T + H > -H * .3;
});
ScrollTrigger.create({ trigger: '#reel', start: 'top bottom', end: 'top top', scrub: true, onUpdate: s => reel.p = s.progress });
const SP = { lounge: { mix: 0, desc: 'A calm sunset lounge with a round sofa and soft light. Your windows float in it while you browse.' }, aurora: { mix: 1, desc: 'An open meadow under the northern lights, with a tree and a far-off castle.' } };
let spaceNow = 'lounge';
let swapRot = 0;
function pickSpace(k){ if (k === spaceNow) return; spaceNow = k; swapRot += 180; $('#swap').style.setProperty('--rot', swapRot + 'deg'); reelUI.dataset.space = k; $('#sp-num').textContent = k === 'lounge' ? '01' : '02'; $('#sp-name').textContent = k === 'lounge' ? 'Lounge' : 'Aurora';
  const d = $('#space-desc'); d.classList.add('out'); setTimeout(() => { d.textContent = SP[k].desc; d.classList.remove('out'); }, 380);
  gsap.to(reelU.uMix, { value: SP[k].mix, duration: 1.1, ease: 'power3.inOut' }); $('#w-lounge').setAttribute('aria-pressed', k === 'lounge'); $('#w-aurora').setAttribute('aria-pressed', k === 'aurora'); }
$('#w-lounge').addEventListener('click', () => pickSpace('lounge'));
$('#w-aurora').addEventListener('click', () => pickSpace('aurora'));
$('#swap').addEventListener('click', () => pickSpace(spaceNow === 'lounge' ? 'aurora' : 'lounge'));
// nobody clicks? the space changes by itself every 3.5 s while the card is open; the ring round the button
// and the bar by the counter fill up to show it. A click holds it for 6 s, then it carries on.
{
  const AUTO = 3.5, ring = $('#swap'), bar = $('#sp-bar');
  let tAuto = 0, hold = 0;
  ['#swap', '#w-lounge', '#w-aurora'].forEach(s => $(s).addEventListener('click', () => { tAuto = 0; hold = 6; }));
  gsap.ticker.add((time, dms) => {
    const dt = Math.min(.1, dms / 1000);
    if (!reelUI.classList.contains('on') || reduce){ tAuto = 0; ring.style.setProperty('--t', 0); bar.style.setProperty('--t', 0); return; }
    if (hold > 0){ hold -= dt; ring.style.setProperty('--t', 0); bar.style.setProperty('--t', 0); return; }
    tAuto += dt;
    if (tAuto >= AUTO){ tAuto = 0; pickSpace(spaceNow === 'lounge' ? 'aurora' : 'lounge'); }
    ring.style.setProperty('--t', (tAuto / AUTO).toFixed(3)); bar.style.setProperty('--t', (tAuto / AUTO).toFixed(3));
  });
}

/* ================= DIVE: monitor zoom -> light tunnel with the mark -> the mark breaks the glass ================= */
const dive = { p: 0, s: 0 };
const oof = { mixer: null, dur: 1, root: null };
F.dbg = { oof };
const oofScene = new THREE.Scene(); oofScene.environment = envTex;
const oofCam = new THREE.PerspectiveCamera(30, 16 / 9, .05, 100);
const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(-4, 5, 6); oofScene.add(key);
const rimR = new THREE.PointLight('#F05A5A', 30, 0, 1.6); rimR.position.set(-4, 1, -2); oofScene.add(rimR);
const rimC = new THREE.PointLight('#4CC9F0', 30, 0, 1.6); rimC.position.set(4, 2, -2); oofScene.add(rimC);
oofScene.add(new THREE.AmbientLight('#ffffff', .35));
// Inside the screen: a glossy corridor in the brand blues, lined with glowing blocks, a soft
// mirror floor, our mark floating ahead. Later it twists into a vortex. Everything streams
// past on the GPU (one uniform per frame), and the same corridor is drawn on the monitor
// and on every broken shard.
const TUN = { L: 96, W: 3.6, H: 2.4, gap: 2.4 };
const tunScene = new THREE.Scene(); tunScene.environment = envTex;
const tunBG = new THREE.Color('#070B26'); tunScene.background = tunBG; tunScene.fog = new THREE.Fog('#070B26', 4, 34);
const tunCam = new THREE.PerspectiveCamera(34, 16 / 9, .05, 90);
const box = new THREE.BoxGeometry(1, 1, 1), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const STREAM = { uTravel: { value: 0 }, uTwist: { value: 0 }, uL: { value: TUN.L } };
function streamed(mat){
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, STREAM);
    sh.vertexShader = 'uniform float uTravel, uTwist, uL;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.);
      #ifdef USE_INSTANCING
        vec3 ib = instanceMatrix[3].xyz;
        vec3 lo = (instanceMatrix * mvPosition).xyz - ib;
        float zz = mod(ib.z + uTravel, uL) - uL + 4.;
        vec3 wp = vec3(ib.xy, zz) + lo;
        float ang = uTwist * (-(zz + lo.z)) * .045; float cs = cos(ang), sn = sin(ang);   // per vertex: long struts bend with the twist instead of breaking
        wp.xy = mat2(cs, sn, -sn, cs) * wp.xy;
        mvPosition = vec4(wp, 1.);
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}
const NFR = Math.ceil(TUN.L / TUN.gap);
const beamMat = streamed(new THREE.MeshPhysicalMaterial({ color: '#8C95FF', metalness: .9, roughness: .18, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.4, transparent: true }));
const beams = new THREE.InstancedMesh(box, beamMat, NFR * 4); beams.frustumCulled = false; tunScene.add(beams);
for (let k = 0; k < NFR; k++){
  [[0, TUN.H / 2, TUN.W + .03, .03], [0, -TUN.H / 2, TUN.W + .03, .03], [-TUN.W / 2, 0, .03, TUN.H], [TUN.W / 2, 0, .03, TUN.H]].forEach(([x, y, sx, sy], j) =>
    beams.setMatrixAt(k * 4 + j, _m.compose(_v.set(x, y, k * TUN.gap), _q.identity(), _s.set(sx, sy, .03))));
}
const rails = new THREE.Group(); tunScene.add(rails);
const railMat = new THREE.MeshPhysicalMaterial({ color: '#8C95FF', metalness: .9, roughness: .18, clearcoat: 1, envMapIntensity: 1.4 });
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const r = new THREE.Mesh(box, railMat); r.scale.set(.03, .03, TUN.L); r.position.set(sx * TUN.W / 2, sy * TUN.H / 2, -TUN.L / 2 + 4); rails.add(r); });
// walls of data: small blocks in grid-snapped clusters, a few of them lit
const snap = (v, g) => Math.round(v / g) * g;
const NCL = mobile ? 170 : 420, vox = [];
for (let c = 0; c < NCL; c++){
  const wall = Math.floor(Math.random() * 4), z0 = rnd(0, TUN.L), along = rnd(-.45, .45), n = 4 + Math.floor(Math.random() * 9), lit = Math.random() < .5;
  for (let i = 0; i < n; i++){
    const w = snap(rnd(.04, .24), .02) + .02, h = snap(rnd(.02, .06), .01) + .01, d = snap(rnd(.04, .42), .02) + .02;
    const off = snap(rnd(-.35, .35), .06), out = snap(rnd(-.06, .18), .03), z = z0 + snap(rnd(-.6, .6), .08);
    let x, y, sx, sy;
    if (wall < 2){ x = (wall ? 1 : -1) * (TUN.W / 2 + out); y = THREE.MathUtils.clamp(along * TUN.H + off, -TUN.H / 2, TUN.H / 2); sx = h; sy = w; }
    else { y = (wall === 2 ? 1 : -1) * (TUN.H / 2 + out); x = THREE.MathUtils.clamp(along * TUN.W + off, -TUN.W / 2, TUN.W / 2); sx = w; sy = h; }
    const g = Math.random();
    vox.push({ x, y, z, sx, sy, d, kind: lit && g < .22 ? 1 + Math.floor(Math.random() * 4) : 0 });
  }
}
const darkVox = vox.filter(v => !v.kind), glowVox = vox.filter(v => v.kind);
const voxDark = new THREE.InstancedMesh(box, streamed(new THREE.MeshStandardMaterial({ color: '#060920', metalness: 0, roughness: 1, envMapIntensity: .05 })), darkVox.length);
const voxGlow = new THREE.InstancedMesh(box, streamed(new THREE.MeshBasicMaterial({ toneMapped: false })), glowVox.length);
const GC = [null, new THREE.Color('#2F80FF').multiplyScalar(2), new THREE.Color('#8B3DDF').multiplyScalar(2), new THREE.Color('#4CC9F0').multiplyScalar(1.8), new THREE.Color('#ffffff').multiplyScalar(1.6)];
darkVox.forEach((v, i) => voxDark.setMatrixAt(i, _m.compose(_v.set(v.x, v.y, v.z), _q.identity(), _s.set(v.sx, v.sy, v.d))));
glowVox.forEach((v, i) => { voxGlow.setMatrixAt(i, _m.compose(_v.set(v.x, v.y, v.z), _q.identity(), _s.set(v.sx, v.sy, v.d))); voxGlow.setColorAt(i, GC[v.kind]); });
[voxDark, voxGlow].forEach(m => { m.frustumCulled = false; tunScene.add(m); });
F.dbg.vox = { voxDark, voxGlow, beams, tunScene };
// pages on the walls: the site's own pictures hang along both sides, so the corridor reads as "inside the web"
{
  const pics = mobile ? ['assets/images/car_m.webp', 'assets/images/galaxy_m.webp', 'assets/images/lounge_m.webp', 'assets/images/games_m.webp', 'assets/images/addons_m.webp', 'assets/images/voice_m.webp', 'assets/images/aurora_m.webp', 'assets/images/reef_m.webp']
    : ['assets/images/car.webp', 'assets/images/galaxy.webp', 'assets/images/lounge.webp', 'assets/images/games.webp', 'assets/images/addons.webp', 'assets/images/voice.webp', 'assets/images/aurora.webp', 'assets/images/reef.webp'];
  const pg = new THREE.PlaneGeometry(1, 1), PER = mobile ? 2 : 3, N = pics.length * PER, step = TUN.L / N;
  const frames = new THREE.InstancedMesh(pg, streamed(new THREE.MeshBasicMaterial({ color: new THREE.Color('#6E7BFF').multiplyScalar(1.5), toneMapped: false })), N);
  frames.frustumCulled = false; tunScene.add(frames);
  const _e = new THREE.Euler(); let n = 0;
  pics.forEach((u, pi) => {
    const im = new THREE.InstancedMesh(pg, streamed(new THREE.MeshBasicMaterial({ map: texLater(u), toneMapped: false })), PER);
    im.frustumCulled = false; tunScene.add(im);
    for (let k = 0; k < PER; k++, n++){
      const slot = (k * pics.length + pi), side = slot % 2 ? 1 : -1, z = slot * step + rnd(-.4, .4), h = rnd(.95, 1.35), w = h * 1.5, y = rnd(-.3, .3);
      _q.setFromEuler(_e.set(0, -side * Math.PI / 2, 0));
      im.setMatrixAt(k, _m.compose(_v.set(side * (TUN.W / 2 - .05), y, z), _q, _s.set(w, h, 1)));
      frames.setMatrixAt(n, _m.compose(_v.set(side * (TUN.W / 2 - .04), y, z), _q, _s.set(w + .05, h + .05, 1)));
    }
  });
}
// the vortex: octagon rings joined by diagonal struts, glowing pink and cyan, fading in as the corridor twists
const RN = 40, RS = 8, RR = 1.5, RGAP = TUN.L / RN;
const webMat = streamed(new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
const web = new THREE.InstancedMesh(box, webMat, RN * RS * 2); web.frustumCulled = false; tunScene.add(web);
{
  const P = (k, i) => { const a = (i + (k % 2) * .5) / RS * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * RR, Math.sin(a) * RR, k * RGAP); };
  const up = new THREE.Vector3(0, 0, 1), cPink = new THREE.Color('#FF4FB8').multiplyScalar(1.6), cCyan = new THREE.Color('#4CC9F0').multiplyScalar(1.6);
  let n = 0;
  for (let k = 0; k < RN; k++) for (let i = 0; i < RS; i++){
    [[P(k, i), P(k, i + 1)], [P(k, i), P(k + 1, i)]].forEach(([p0, p1], j) => {
      const dir = p1.clone().sub(p0), len = dir.length();
      _q.setFromUnitVectors(up, dir.normalize());
      web.setMatrixAt(n, _m.compose(p0.clone().add(p1).multiplyScalar(.5), _q, _s.set(.025, .025, len + .05)));
      web.setColorAt(n, (i + j) % 3 ? cPink : cCyan); n++;
    });
  }
}
// a soft mirror floor (desktop): the corridor reflects in it
let mirror = null;
if (!mobile){
  mirror = new THREE.Group(); tunScene.add(mirror);
  const mk = (gw, gh, rot, pos, tint, res) => { const m = new Reflector(new THREE.PlaneGeometry(gw, gh), { textureWidth: res, textureHeight: res, color: tint }); m.rotation.set(...rot); m.position.set(...pos); mirror.add(m); };
  mk(TUN.W - .05, TUN.L, [-Math.PI / 2, 0, 0], [0, -TUN.H / 2 + .005, -TUN.L / 2 + 4], 0x5560A8, 512);   // floor
  mk(TUN.W - .05, TUN.L, [Math.PI / 2, 0, 0], [0, TUN.H / 2 - .005, -TUN.L / 2 + 4], 0x2E3570, 256);     // ceiling
  mk(TUN.L, TUN.H - .05, [0, Math.PI / 2, 0], [-TUN.W / 2 + .005, 0, -TUN.L / 2 + 4], 0x2E3570, 256);   // left wall
  mk(TUN.L, TUN.H - .05, [0, -Math.PI / 2, 0], [TUN.W / 2 - .005, 0, -TUN.L / 2 + 4], 0x2E3570, 256);  // right wall
}
// the mark is drawn in its own pass on top of the corridor, lit from the front, so frames and blocks never cut into it
const tunLogo = new THREE.Scene(); tunLogo.environment = envTex;
const tunPivot = new THREE.Group(); tunPivot.position.set(0, 0, -6); tunLogo.add(tunPivot);
const lk1 = new THREE.DirectionalLight('#ffffff', 2.2); lk1.position.set(-1.5, 2.5, 4);
const lk2 = new THREE.PointLight('#4CC9F0', 10, 0, 1.6); lk2.position.set(2.5, -.5, -4);
const lk3 = new THREE.PointLight('#8B3DDF', 10, 0, 1.6); lk3.position.set(-2.5, .5, -4.5);
tunLogo.add(lk1, lk2, lk3, new THREE.AmbientLight('#b8c4ff', .55));
// its soft shadow on the floor, only underneath
const shadowTex = canvasTex(128, 128, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 5; tunScene.add(shadow);
const tl1 = new THREE.PointLight('#5D58FB', 4, 0, 1.6), tl2 = new THREE.PointLight('#4CC9F0', 3.5, 0, 1.6), tl3 = new THREE.DirectionalLight('#ffffff', .22), tlP = new THREE.PointLight('#FF4FB8', 0, 0, 1.4);
tl3.position.set(0, 2, 3); tlP.position.set(0, 0, -20); tunScene.add(tl1, tl2, tl3, tlP, new THREE.AmbientLight('#8fa0ff', .08));
const haloTex = canvasTex(128, 128, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(120,140,255,.9)'); gr.addColorStop(.45, 'rgba(110,70,240,.3)'); gr.addColorStop(1, 'rgba(60,40,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false })); halo.renderOrder = 6; tunScene.add(halo);
const FOG0 = new THREE.Color('#070B26'), FOG1 = new THREE.Color('#12061E'), FOG2 = new THREE.Color('#7B6BFF');
// third look: the vortex opens into light. A bright core far down the corridor that everything melts into.
const coreTex = canvasTex(128, 128, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(240,228,255,.95)'); gr.addColorStop(.5, 'rgba(160,120,255,.55)'); gr.addColorStop(1, 'rgba(99,162,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false, opacity: 0 })); core.position.set(0, 0, -30); core.renderOrder = 4; tunScene.add(core);
let tunMirrorOn = true;
function placeTunnel(travel, twist, warp = 0){
  STREAM.uTravel.value = travel; STREAM.uTwist.value = twist;
  rails.visible = twist < .05; if (mirror) mirror.visible = twist < .35 && tunMirrorOn;
  beamMat.opacity = 1 - twist * .85;
  web.visible = twist > .02; webMat.opacity = twist;
  tunBG.copy(FOG0).lerp(FOG1, twist).lerp(FOG2, warp); tunScene.fog.color.copy(tunBG); tunScene.fog.near = 4 - warp * 2.5; tunScene.fog.far = 34 - warp * 16;
  core.visible = warp > .01; core.material.opacity = warp; core.scale.setScalar(14 + warp * 34);
  tlP.intensity = 16 * twist;
}
function renderTunnel(target){
  renderer.setRenderTarget(target); renderer.render(tunScene, tunCam);
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(tunLogo, tunCam); renderer.autoClear = ac;
  renderer.setRenderTarget(null);
}
const screenRT = new THREE.WebGLRenderTarget(1024, 640, { samples: mobile ? 0 : 4 });
screenRT.texture.repeat.set(1, -1); screenRT.texture.offset.set(0, 1);   // glTF UVs run top-down
let screenAsp = 1.6;
const DISP = { x: 1.34, y: 1.14 };          // a larger, wider display than the baked one
// loaded after the first screen is up (not counted by the loader), so the page opens fast
function loadShatter(){ lazyGltf.load('assets/models/shatter.gltf.json', g => {
  oof.root = g.scene; oofScene.add(g.scene);
  const SCREEN = new THREE.MeshBasicMaterial({ map: screenRT.texture, toneMapped: false });
  const MF = gradMat('#5D58FB', '#2F80FF'), MT = gradMat('#3F86FF', '#8B3DDF', { rough: .12 }), MS = gradMat('#2B3FB8', '#3A1F86', { rough: .3 });
  const shardBox = new THREE.Box3();
  const BEZEL = new THREE.MeshStandardMaterial({ color: '#040408', metalness: .1, roughness: .55, envMapIntensity: .15 });
  g.scene.traverse(o => {
    if (!o.isMesh) return; const n = o.material.name;
    if (n === 'mark_frame') o.material = MF; else if (n === 'mark_tile') o.material = MT; else if (n === 'mark_side') o.material = MS;
    else if (n === 'shard_page' || n === 'page') o.material = SCREEN;
    else if (n === 'glass_edge') o.material = new THREE.MeshPhysicalMaterial({ color: '#CFEAFF', roughness: .05, clearcoat: 1, envMapIntensity: 2 });
    else if (n === 'bezel') o.material = BEZEL;
  });
  ['foot', 'neck', 'browser_bar', 'dot0', 'dot1', 'dot2'].forEach(k => { const o = g.scene.getObjectByName(k); if (o) o.visible = false; });
  const disp = new THREE.Group(); disp.scale.set(DISP.x, DISP.y, 1); g.scene.add(disp);
  [...g.scene.children].forEach(o => { if (o.name === 'Monitor' || o.name.startsWith('shard_')) disp.add(o); });
  g.scene.updateMatrixWorld(true);
  disp.traverse(o => { if (o.isMesh && o.material === SCREEN && o.name.startsWith('shard')) shardBox.expandByObject(o); });
  const sz = shardBox.getSize(new THREE.Vector3()); if (sz.y > 0) screenAsp = sz.x / sz.y;
  screenRT.setSize(1024, Math.round(1024 / screenAsp));
  // a copy of the mark floats inside the tunnel; before it breaks out it settles exactly where the real one waits behind the glass
  const mk = g.scene.getObjectByName('Mark');
  if (mk){ oof.mark = mk; const boost = new THREE.Group(); mk.parent.add(boost); boost.add(mk); oof.boost = boost; const c = mk.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); tunPivot.add(c); oof.tmark = c;
    const bb = new THREE.Box3().setFromObject(c); oof.mctr = bb.getCenter(new THREE.Vector3()); const bs = bb.getSize(new THREE.Vector3()); oof.msize = Math.max(bs.x, bs.y, bs.z); }
  oof.mixer = new THREE.AnimationMixer(g.scene);
  g.animations.forEach(c => { const a = oof.mixer.clipAction(c); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a.play(); oof.dur = Math.max(oof.dur, c.duration); });
  oof.mixer.setTime(0);
  warm(oofScene, oofCam); loadQuest();
}); }
const SCR_H = 2 * DISP.y, FILL_Z = SCR_H / 2 / Math.tan(THREE.MathUtils.degToRad(15)), TD = 6, _hv = 2 * TD * Math.tan(THREE.MathUtils.degToRad(17));   // monitor screen is 2 units tall; tunnel camera sees _hv at the mark's depth
const PULL = 5.7;   // camera distance after pulling out: the monitor fills about three quarters of the height
const _tiltE = new THREE.Euler(), _tiltQ = new THREE.Quaternion();
const markTilt = t => _tiltQ.setFromEuler(_tiltE.set(.14 + .05 * Math.sin(t * .8), -.26 + .12 * Math.sin(t * .55), .05 * Math.sin(t * .6)));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qi = new THREE.Quaternion();
function tunnelPose(t, travel, look, twist, settle, warp = 0){
  placeTunnel(travel, twist, warp);
  const c = oof.tmark; if (!c) return;
  // free float in the corridor
  const free = 1.5 / (oof.msize || 2.5);                         // ~1 unit across: well inside the 3.6 x 2.4 corridor
  _a.set(look.x * .3 + Math.sin(t * .6) * .12, -.22 + look.y * .2 + Math.sin(t * .8) * .08, -TD);
  _qa.setFromEuler(new THREE.Euler(.1 + Math.sin(t * .5) * .16 + look.y * .2, -.3 + Math.sin(t * .45 + travel * .04) * .55 + look.x * .25, Math.sin(t * .35) * .1));
  // rest pose = where the real mark is, seen through the glass (screen -> tunnel camera units)
  const k = _hv / SCR_H, m = oof.mark;
  const mz = m ? m.position.z : -.5, ms = m ? m.scale.x : .42, grow = PULL / Math.max(1, PULL - (mz + .5));
  _b.set((m ? m.position.x : .55) * k, (m ? m.position.y : .15) * k, -TD);
  _qb.copy(markTilt(t)).multiply(m ? m.quaternion : _qi);
  const e = easeIO(settle);
  c.position.lerpVectors(_a, _b, e);
  c.quaternion.slerpQuaternions(_qa, _qb, e);
  c.scale.setScalar(THREE.MathUtils.lerp(free, ms * k * grow, e));
  if (e < 1) c.position.sub(_v.copy(oof.mctr).multiplyScalar(c.scale.x * (1 - e)));   // spin round its own middle while free
  shadow.position.set(c.position.x, -TUN.H / 2 + .012, c.position.z); shadow.scale.setScalar(1.3 * c.scale.x * (oof.msize || 2.5)); shadow.material.opacity = (1 - e) * .9 * (1 - twist);
  halo.position.set(c.position.x + (1 - e) * 0, c.position.y, c.position.z - .6); halo.scale.setScalar(4.2); halo.material.opacity = (1 - e) * .75;
  tl1.position.set(Math.cos(t) * 2.5 - 1, Math.sin(t) * 1.5, -4.5); tl2.position.set(-Math.cos(t) * 2.5 + 1, -Math.sin(t) * 1.5, -4.5);
  const lk = 1 - e;
  tunCam.position.set(look.x * .25 * lk, look.y * .15 * lk, 0); tunCam.lookAt(look.x * .08 * lk, look.y * .05 * lk, -10);
  tunCam.rotation.z += twist * Math.sin(t * .6) * .08 * lk;
}
const dwords = [...document.querySelectorAll('#dive-words .w')];
const fadeK = $('#fade-k'), fadeW = $('#fade-w'), cap = $('#dive-cap'), dlabel = $('#dive-label');
const tLook = new THREE.Vector2();
let wasBroke = false, breakT = -9;
const easeO3 = x => 1 - Math.pow(1 - x, 3);
// behind the monitor: a blue-violet glow instead of flat black
const backGlow = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(84,96,255,.85)'); gr.addColorStop(.4, 'rgba(96,48,210,.38)'); gr.addColorStop(1, 'rgba(20,10,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
backGlow.position.set(0, 0, -3.2); oofScene.add(backGlow);
// extra glass: small bright splinters that burst from the screen and fly past the camera
const NSP = mobile ? 90 : 220, spl = [];
const splGeo = new THREE.BufferGeometry(); splGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.3, 0, .5, -.12, 0, -.08, .5, 0], 3));
const splMesh = new THREE.InstancedMesh(splGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#BFD0FF').multiplyScalar(1.4), transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), NSP);
splMesh.frustumCulled = false; splMesh.visible = false; oofScene.add(splMesh);
for (let i = 0; i < NSP; i++){ const a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()); spl.push({ x: Math.cos(a) * r * 1.2, y: Math.sin(a) * r * .95, dx: Math.cos(a) * rnd(.6, 3.6), dy: Math.sin(a) * rnd(.5, 2.6) + rnd(-.3, .5), dz: rnd(1.2, 8.5), s: rnd(.03, .15), rx: rnd(-6, 6), ry: rnd(-6, 6), ph: rnd(0, 6) }); }
const _se = new THREE.Euler();
function glassBurst(k, t){
  splMesh.visible = k > 0 && k < .995; if (!splMesh.visible) return;
  splMesh.material.opacity = .85 * (1 - seg(k, .7, 1));
  for (let i = 0; i < NSP; i++){ const q = spl[i];
    _q.setFromEuler(_se.set(q.ph + q.rx * k + t * .4, q.ph * 2 + q.ry * k, q.ph));
    splMesh.setMatrixAt(i, _m.compose(_v.set(q.x + q.dx * k, q.y + q.dy * k - k * k * .5, .05 + q.dz * k), _q, _s.setScalar(q.s)));
  }
  splMesh.instanceMatrix.needsUpdate = true;
}
addView($('#dive-stage'), oofScene, oofCam, function(t, dt){
  dive.s += (dive.p - dive.s) * Math.min(1, dt * 14);
  // the stage is full-bleed: cover the scrollbar strip too, so no light edge shows (and no colour fringe on it)
  if (this.rect.width > innerWidth - 40) this.rect = { left: 0, right: innerWidth, top: this.rect.top, bottom: this.rect.bottom, width: innerWidth, height: this.rect.height };
  const p = reduce ? .97 : dive.s, b = this.rect;
  // A zoom into the screen · B fly down the light tunnel with the mark · C pull back out · D the mark breaks the glass
  const A = seg(p, 0, .16), Bf = seg(p, .16, .66), C = seg(p, .66, .74), Dd = seg(p, .74, .96), Wd = seg(p, .2, .4);
  tLook.lerp(new THREE.Vector2(F.mouse.nx || 0, F.mouse.ny || 0), .05);
  const twist = seg(Bf, .4, .7), warp = easeIO(seg(Bf, .74, .99));   // box corridor, then vortex, then the vortex opens into light and stays that way on the monitor
  if (oof.mixer && p > .66) oof.mixer.setTime(easeIO(Dd) * oof.dur * .999);
  tunnelPose(t, easeIO(Bf) * 70 + warp * warp * 30 + t * 1.4, tLook, twist, seg(p, .64, .73), warp);
  ca.uniforms.uAmt.value = p > .16 && p < .66 ? .003 + twist * .012 : 0; ca.enabled = ca.uniforms.uAmt.value > 0;
  // hand-off: the copy in the screen disappears the moment the real mark reaches the glass
  // hand-off at the instant the glass breaks: the copy in the screen before, the real mark after (the burst hides the swap)
  const broke = p > .74 && oof.mixer && oof.mixer.time >= 1.45;
  if (oof.tmark) oof.tmark.visible = !broke; if (oof.boost) oof.boost.visible = broke || p <= .16;
  if (broke && !wasBroke) breakT = t; wasBroke = !!broke;
  const since = t - breakT, shk = broke ? Math.exp(-since * 5) : 0;
  glassBurst(broke ? easeO3(seg(Dd, .28, 1)) : 0, t);
  backGlow.material.opacity = seg(p, .68, .78) * .8 + shk * .6;
  const inside = p > .16 && p < .66;
  tunMirrorOn = p > .06 && p < .66;          // the screen shows the mirror too, so the hand-over into the corridor matches
  if (inside){
    this.scene = tunScene; this.camera = tunCam; this.after = tunLogo;
    tunCam.aspect = b.width / b.height; tunCam.fov = 34; tunCam.updateProjectionMatrix();
  } else {
    // the screen shows the same tunnel, live
    tunCam.aspect = screenAsp; tunCam.updateProjectionMatrix();
    renderTunnel(screenRT);
    this.scene = oofScene; this.camera = oofCam; this.after = null; fitCam(oofCam, b, 30);
    const Z0 = b.width < b.height ? 7 : 9.6;   // phones: start closer so the monitor is not a small box in empty space
    if (p <= .16){ oofCam.position.set(.35 * (1 - A), .15 * (1 - A), Z0 - easeIO(A) * (Z0 - FILL_Z)); oofCam.lookAt(0, 0, 0); if (oof.mixer) oof.mixer.setTime(0); if (oof.root) oof.root.rotation.set(0, 0, 0); }
    else {
      const c = easeIO(C), dz = easeIO(seg(Dd, .35, 1));
      oofCam.position.set(.15 * c + shk * Math.sin(t * 71) * .05, .05 * c + dz * .2 + shk * Math.sin(t * 93) * .04, FILL_Z + (PULL - FILL_Z) * c + dz * .7); oofCam.lookAt(.08 * c, dz * .25, 0);
      if (oof.boost){   // the mark turns about its own centre with the same tilt as in the screen, then settles centred, a touch closer
        const g = easeIO(seg(Dd, .45, 1)), m = oof.mark, S = 1 - g * .4, q = markTilt(t);
        oof.boost.quaternion.copy(q); oof.boost.scale.setScalar(S);
        _v.copy(m.position).multiplyScalar(S).applyQuaternion(q);
        oof.boost.position.set(m.position.x * S * (1 - .7 * g) - _v.x, m.position.y * S * (1 - .7 * g) - _v.y + .18 * g, m.position.z * S + .2 * g - _v.z);
      }
      if (oof.root && C >= 1){ oof.root.rotation.y += ((F.mouse.nx * .05) - oof.root.rotation.y) * .05; oof.root.rotation.x += ((-F.mouse.ny * .025) - oof.root.rotation.x) * .05; }
    }
  }
  fadeK.style.opacity = 0;
  fadeW.style.opacity = (Math.max(0, 1 - Math.abs(p - .16) / .014) * .45 + Math.max(0, 1 - Math.abs(p - .66) / .02) * .9 + (broke ? Math.exp(-since * 7) * .7 : 0)).toFixed(3);
  // the whole line arrives once, out of the depth above the mark, holds, and flies past the camera
  dwords.forEach((w, i) => {
    const u = seg(p, .185, .37), a = ease(seg(u, 0, .22)), o = seg(u, .7, 1);
    w.style.opacity = (a * (1 - o)).toFixed(3);
    w.style.transform = `translate3d(-50%,-50%,0) translate3d(0,${(-o * o * 9).toFixed(2)}vh,0) scale(${(.55 + a * .45 + Math.pow(o, 2.4) * 3.2).toFixed(3)})`;
  });
  cap.classList.toggle('on', p > .9);
  dlabel.style.opacity = p < .1 ? 1 : 0;
});
ScrollTrigger.create({ trigger: '#dive', start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: s => dive.p = s.progress });

/* ================= FINALE: Quest turntable + sticker burst ================= */
const fin = { y0: -.45, p: 0, s: 0, mixer: null, dur: 1, root: null, drag: 0, dragV: 0, baseFov: 30 };
const qScene = new THREE.Scene(); qScene.environment = envTex;
const qCam = new THREE.PerspectiveCamera(30, 16 / 9, .1, 100);
const qView = addView($('#quest-stage'), qScene, qCam, function(t, dt){
  fin.s += (fin.p - fin.s) * Math.min(1, dt * 12); fin.drag += fin.dragV; fin.dragV *= .92;
  if (fin.mixer) fin.mixer.setTime(clamp01(fin.s * 1.25) * fin.dur * .999);
  if (fin.root){
    fin.root.rotation.y = fin.drag + F.mouse.nx * .18 + Math.sin(t * .35) * .22; fin.root.rotation.x = -F.mouse.ny * .08 + Math.sin(t * .5) * .03;   // a slow sway so it never sits still
    fin.root.position.y = fin.y0 + Math.sin(t * .9) * .04;
    fin.root.scale.setScalar((.62 + Math.min(1, fin.s * 2) * .1) * (this.rect.width < 720 ? 1.45 : 1));
  }
  fitCam(qCam, this.rect, fin.baseFov);
}, { ready: false });
const ql1 = new THREE.DirectionalLight('#ffffff', .45); ql1.position.set(-3, 4, 6); qScene.add(ql1);
const ql2 = new THREE.PointLight('#F05A5A', 34, 0, 1.4); ql2.position.set(-5, .8, -2); qScene.add(ql2);
const ql3 = new THREE.PointLight('#4CC9F0', 34, 0, 1.4); ql3.position.set(5, .8, -2); qScene.add(ql3);
const ql4 = new THREE.PointLight('#5D58FB', 6, 0, 1.4); ql4.position.set(0, -4, 3); qScene.add(ql4);
// loaded after the first screen is up (not counted by the loader), so the page opens fast
function loadQuest(){ lazyGltf.load('assets/models/quest.gltf.json', g => {
  const pivot = new THREE.Group(); pivot.add(g.scene); qScene.add(pivot); fin.root = pivot;
  if (g.cameras[0]){ const c = g.cameras[0]; qCam.position.copy(c.getWorldPosition(new THREE.Vector3())); qCam.quaternion.copy(c.getWorldQuaternion(new THREE.Quaternion())); fin.baseFov = c.fov; }
  g.scene.traverse(o => { if (o.isMesh && o.material){ o.material.envMapIntensity = .2; if (o.material.color && o.material.color.getHSL({}).l > .7) o.material.color.multiplyScalar(.62); if ('clearcoat' in o.material){ o.material.clearcoat = Math.max(o.material.clearcoat, .8); o.material.clearcoatRoughness = .05; } } });
  fin.mixer = new THREE.AnimationMixer(g.scene);
  g.animations.forEach(c => { fin.mixer.clipAction(c).play(); fin.dur = Math.max(fin.dur, c.duration); });
  qView.ready = true;
  warm(qScene, qCam);
}); }
ScrollTrigger.create({ trigger: '#get', start: 'top bottom', end: 'bottom bottom', scrub: true, onUpdate: s => fin.p = s.progress });
let dragging = false, px0 = 0; const qs = $('#quest-stage');
qs.addEventListener('pointerdown', e => { dragging = true; px0 = e.clientX; qs.setPointerCapture(e.pointerId); });
qs.addEventListener('pointermove', e => { if (!dragging) return; fin.dragV = (e.clientX - px0) * .004; px0 = e.clientX; });
qs.addEventListener('pointerup', () => dragging = false);
const stks = [...document.querySelectorAll('.stk')];
const narrow = innerWidth < 720;
// phones: fewer stickers, kept to the side margins beside the headset so none sits on the copy
const spots = narrow ? [[-.42, -.13], [.42, -.17], [-.43, .03], [.43, .02], [-.4, .15], [.41, .14]]
  : [[-.38, -.26], [.36, -.28], [-.44, .06], [.43, .03], [-.3, .3], [.3, .32], [-.13, -.36], [.15, .38], [.46, -.12], [-.47, .22]];
if (narrow) stks.forEach((s, i) => { if (i >= spots.length) s.style.display = 'none'; });
stks.forEach((s, i) => { if (!spots[i]) return; s.dataset.x = spots[i][0]; s.dataset.y = spots[i][1]; s.dataset.r = rnd(-24, 24); s.dataset.d = rnd(.4, 1.2); gsap.set(s, { xPercent: -50, yPercent: -50, scale: 0 }); });
let stkShown = false;
function burst(on){
  if (on === stkShown) return; stkShown = on;
  stks.forEach((s, i) => gsap.to(s, on ? { scale: 1, rotation: +s.dataset.r, duration: 1.1, ease: 'elastic.out(1,.55)', delay: i * .045, overwrite: 'auto' } : { scale: 0, rotation: 0, duration: .4, ease: 'power2.in', overwrite: 'auto' }));
}
ScrollTrigger.create({ trigger: '#get', start: 'top 20%', end: 'bottom 60%', onToggle: s => burst(s.isActive) });
const stkPos = stks.map(() => ({ x: 0, y: 0 }));
// only work while the finale is near the screen; move with `translate` (no layout), never left/top
let stkNear = false; ScrollTrigger.create({ trigger: '#get', start: 'top bottom', end: 'bottom top', onToggle: s => stkNear = s.isActive });
gsap.ticker.add(() => {
  if (!stkNear && !stkShown) return;
  const W = innerWidth, H = innerHeight;
  stks.forEach((s, i) => { const d = +s.dataset.d, o = stkPos[i], tx = stkShown ? s.dataset.x * W + F.mouse.nx * 24 * d : 0, ty = stkShown ? s.dataset.y * H - F.mouse.ny * 18 * d : 0;
    const nar = W < 720; const tx2 = nar ? Math.sign(tx) * Math.max(Math.abs(tx), W * .4) : tx; o.x += (tx2 - o.x) * .08; o.y += (ty - o.y) * .08;
    const tt = performance.now() / 1000, bob = stkShown ? Math.sin(tt * (.7 + d * .5) + i * 1.7) * 10 * d : 0, lean = stkShown ? Math.max(-14, Math.min(14, (F.vel || 0) / 120)) * d : 0;
    s.style.translate = `${o.x.toFixed(1)}px ${(o.y + bob - lean).toFixed(1)}px`; s.style.rotate = stkShown ? `${(Math.sin(tt * .6 + i) * 4 * d).toFixed(2)}deg` : '0deg'; });
});
if (reduce) burst(true);

/* ground: light -> night as the dive's screen fills the view, light panel again at the footer */
const dark = { k: 0 };
const diveLen = () => document.getElementById('dive').offsetHeight - innerHeight;
ScrollTrigger.create({ trigger: '#dive', start: () => 'top+=' + diveLen() * .5 + ' top', end: () => 'top+=' + diveLen() * .56 + ' top', scrub: true, onUpdate: s => dark.k = s.progress });
const setDark = () => { const fr = $('#footer').getBoundingClientRect().top, dv = $('#dive').getBoundingClientRect().top; document.body.classList.toggle('is-dark', (dark.k > .5 && dv < 0 && fr > 70) || $('#top').getBoundingClientRect().bottom > 60); };
setDark();
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: setDark });

/* ---------------- reveals, odometers, ribbons, loop ---------------- */
document.querySelectorAll('.rl').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('in') }));
document.querySelectorAll('[data-odo]').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => el.querySelectorAll('.col').forEach(c => c.style.transform = `translateY(${-c.dataset.d}em)`) }));
if (!reduce){
  gsap.utils.toArray('.work').forEach((c, i) => {
    const im = c.querySelector('.img'), pic = c.querySelector('.img img'), txt = c.querySelectorAll('.tags, h3, p');
    const st = im._gl = { reveal: 0, zoom: 1.35 };   // read by the WebGL card (works bend below)
    const tl = gsap.timeline({ scrollTrigger: { trigger: c, start: 'top 92%', once: true }, delay: (i % 2) * .12 });
    tl.from(c, { y: 70, duration: 1.4, ease: 'expo.out' }, 0)
      .fromTo(im, { clipPath: 'inset(100% 0% 0% 0% round 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.3, ease: 'expo.out', clearProps: 'clipPath' }, 0)
      .from(pic, { scale: 1.35, duration: 1.8, ease: 'expo.out', clearProps: 'scale' }, 0)
      .to(st, { reveal: 1, duration: 1.3, ease: 'expo.out' }, 0).to(st, { zoom: 1, duration: 1.8, ease: 'expo.out' }, 0)
      .from(txt, { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: .06 }, .25);
  });
  gsap.utils.toArray('.stat').forEach((c, i) => gsap.from(c, { y: 60, duration: 1.1, ease: 'expo.out', delay: i * .07, scrollTrigger: { trigger: c, start: 'top 95%', once: true } }));
}
// Brand ribbons, drawn in WebGL so they pass BEHIND the page text and the cards (DOM sits above the canvas).
const ribScene = new THREE.Scene();
const ribView = addView(fullEl, ribScene, new THREE.Camera(), function(){});
ribView.vis = () => ribScene.children.some(m => m.visible);
views.splice(views.indexOf(ribView), 1); views.unshift(ribView);      // draw first, under every other view
function ribbon(host, build){
  const key = host.dataset.ribbon;
  const stops = key === 'a' ? ['#3F7BFF', '#5D58FB'] : ['#4CC9F0', '#2F9BF0'];
  const U = { uOff: { value: new THREE.Vector2() }, uView: { value: new THREE.Vector2(innerWidth, innerHeight) }, uProg: { value: reduce ? 1 : 0 },
    uLen: { value: 1 }, uHW: { value: 20 }, c0: { value: new THREE.Color(stops[0]) }, c1: { value: new THREE.Color(stops[1]) } };
  // a flat band of even width with round ends, the way a marker line reads
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `attribute float aL; attribute float aS; uniform vec2 uOff, uView; varying float vL, vS;
      void main(){ vec2 px = position.xy + uOff; vL = aL; vS = aS; gl_Position = vec4(px.x / uView.x * 2. - 1., 1. - px.y / uView.y * 2., 0., 1.); }`,
    fragmentShader: `uniform float uProg, uLen, uHW; uniform vec3 c0, c1; varying float vL, vS;
      void main(){
        float head = uProg * uLen;                      // the line grows from its start
        float along = vL, across = vS * uHW;
        float dEdge = abs(across);
        if (along > head - uHW) dEdge = length(vec2(along - (head - uHW), across));   // round tip
        if (along < uHW) dEdge = length(vec2(uHW - along, across));                   // round tail
        float aa = fwidth(dEdge) * 1.2 + .5;
        float a = 1. - smoothstep(uHW - aa, uHW, dEdge);
        if (a <= 0.) discard;
        gl_FragColor = vec4(mix(c0, c1, smoothstep(0., uLen, along)), a);
      }` });
  const dom = false;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); mesh.frustumCulled = false; mesh.visible = false; if (!dom) ribScene.add(mesh);
  let dPath = null, dLen = 1;
  const make = () => {
    const w = host.clientWidth, h = host.clientHeight, th = innerWidth < 720 ? 22 : 36, ext = th;   // strip is a bit wider than the line for the round ends
    const P = build(w, h, host);
    let d = `M${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++){ const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`; }
    const svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg'), path = document.createElementNS(svgNS, 'path');
    if (dom){
      host.innerHTML = ''; host.style.zIndex = '-1';   // behind the section text, above the canvas
      const gid = 'rg-' + key;
      host.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0"><stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient></defs><path fill="none" stroke="url(#${gid})" stroke-width="${th}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      dPath = host.querySelector('path'); dPath.setAttribute('d', d); dLen = dPath.getTotalLength();
      dPath.style.strokeDasharray = `${dLen} ${dLen + th * 2}`; dPath.style.strokeDashoffset = dLen * (1 - U.uProg.value);
      return;
    }
    path.setAttribute('d', d); svg.appendChild(path); svg.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden'; document.body.appendChild(svg);
    const L = path.getTotalLength(), N = Math.min(3000, Math.max(800, Math.round(L / 2))), pos = [], aL = [], aS = [], idx = [];
    for (let i = 0; i < N; i++){
      const l = L * i / (N - 1), q = path.getPointAtLength(l), q2 = path.getPointAtLength(Math.min(L, l + 2)), q1 = path.getPointAtLength(Math.max(0, l - 2));
      let tx = q2.x - q1.x, ty = q2.y - q1.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = -ty * ext / 2, ny = tx * ext / 2;
      pos.push(q.x + nx, q.y + ny, 0, q.x - nx, q.y - ny, 0); aL.push(l, l); aS.push(1, -1);
      if (i < N - 1){ const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    svg.remove();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); g.setIndex(idx);
    mesh.geometry.dispose(); mesh.geometry = g; U.uLen.value = L; U.uHW.value = th / 2;
  };
  if (!dom) host.innerHTML = '';
  make();
  if (!dom) gsap.ticker.add(() => { const r = host.getBoundingClientRect(); U.uOff.value.set(r.left, r.top); U.uView.value.set(innerWidth, innerHeight); mesh.visible = r.bottom > -200 && r.top < innerHeight + 200; });
  const setProg = v => { U.uProg.value = v; if (dPath) dPath.style.strokeDashoffset = dLen * (1 - v); };
  if (!reduce) ScrollTrigger.create({ trigger: host.parentElement, start: 'top 80%', end: 'bottom 35%', scrub: dom ? true : 1, onUpdate: s => setProg(s.progress) });
  let rw = innerWidth; addEventListener('resize', () => { if (innerWidth === rw) return; rw = innerWidth; make(); ScrollTrigger.refresh(); });   // phone address bar changes only the height: ignore it
}
// a: enters from the left edge, makes one loop round the card, then leaves to the right in a long S
ribbon($('[data-ribbon="a"]'), (w, h, host) => {
  const hb = host.getBoundingClientRect(), c = reelCard.getBoundingClientRect();
  const L = c.left - hb.left, T = c.top - hb.top, R = L + c.width, B = T + c.height, H = c.height;
  return [[-120, T - H * .55], [w * .22, T - H * .5], [L + c.width * .5, T - 60], [L - 70, T + H * .45], [L + c.width * .3, B + 60], [R + 50, B - H * .05], [w * .8, B + H * .18], [w + 120, B - H * .05]];
});
// b: one calm arc from the left edge to the right edge
ribbon($('[data-ribbon="b"]'), (w, h) => [[-120, h * .82], [w * .22, h * .55], [w * .48, h * .2], [w * .78, h * .2], [w + 120, h * .42]]);

/* ---------------- WORKS: the six photos are drawn in WebGL and bend with scroll speed ----------------
   Lusion-style "wheel": the faster you scroll, the more the cards curve as if wrapped on a drum: points far
   from the middle of the screen lag behind, so the outer edges bow. At rest they are flat and still. */
{
  const wScene = new THREE.Scene(), wCam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  const geo = new THREE.PlaneGeometry(1, 1, 32, 20); geo.translate(.5, -.5, 0);   // x 0..1, y 0..-1 (top-left origin)
  const cards = [...document.querySelectorAll('.work .img')].map(el => {
    const img = el.querySelector('img');
    const u = { uTex: { value: null }, uImg: { value: new THREE.Vector2(16, 11) }, uPos: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(1, 1) },
      uScreen: { value: new THREE.Vector2(1, 1) }, uVel: { value: 0 }, uReveal: { value: 1 }, uZoom: { value: 1 }, uR: { value: 18 } };
    const tx = new THREE.Texture(); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; u.uTex.value = tx;
    const load = () => imgLoader.load((mobile && img.dataset.m) || img.getAttribute('src'), im => {
      tx.image = im; tx.needsUpdate = true; u.uImg.value.set(im.width, im.height); card.ready = true; el.classList.add('gl'); });
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: `uniform vec2 uPos, uSize, uScreen; uniform float uVel; varying vec2 vL;
        void main(){
          vL = vec2(position.x, -position.y);                               // 0..1, y down
          // the card shrinks a little toward its own centre while moving (so it never leaves its slot),
          // then the half far from the middle of the screen sinks: a slight drum tilt with a soft bow
          vec2 c = uPos + uSize * .5;
          vec2 px = c + (vL - .5) * uSize * (1. - .075 * abs(uVel));
          float xs = (px.x - uScreen.x * .5) / (uScreen.x * .5);           // -1..1 across the screen
          px.y += uVel * xs * xs * uScreen.y * .024;
          gl_Position = projectionMatrix * viewMatrix * vec4(px.x, -px.y, 0., 1.);
        }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec2 uImg, uSize; uniform float uReveal, uZoom, uR; varying vec2 vL;
        void main(){
          // rounded rectangle, revealed from the bottom up
          vec2 p = vL * uSize; float top = (1. - uReveal) * uSize.y;
          vec2 c = vec2(uSize.x * .5, (top + uSize.y) * .5), h = vec2(uSize.x * .5, (uSize.y - top) * .5);
          vec2 q = abs(p - c) - h + uR; float sd = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uR;
          float a = 1. - smoothstep(-.75, .75, sd);
          if (a <= 0.) discard;
          // object-fit: cover, with the reveal zoom
          float ra = uSize.x / uSize.y, ia = uImg.x / uImg.y;
          vec2 s = ra > ia ? vec2(1., ia / ra) : vec2(ra / ia, 1.);
          vec2 uv = (vec2(vL.x, 1. - vL.y) - .5) * s / uZoom + .5;
          gl_FragColor = vec4(texture2D(uTex, uv).rgb, a);
        }` });
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; wScene.add(mesh);
    const card = { el, u, mesh, load, asked: false, ready: false };
    return card;
  });
  // spring: the curve builds while you scroll, then settles back with a soft overshoot (not an instant snap)
  let vel = 0, vv = 0, lastT = performance.now();
  addView(fullEl, wScene, wCam, function(){
    this.vis = () => cards.some(c => c.mesh.visible);
    const W = innerWidth, H = innerHeight;
    wCam.right = W; wCam.bottom = -H; wCam.updateProjectionMatrix();
    const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    const fresh = !lenis || now - (F.velT || 0) < 90;   // no scroll event lately = standing still
    const target = fresh ? Math.max(-1, Math.min(1, (F.vel || 0) / 1400)) : 0;
    vv += ((target - vel) * 38 - vv * 10) * dt; vel += vv * dt;
    if (reduce) vel = 0;
    for (const c of cards){
      const r = c.el.getBoundingClientRect(), on = c.ready && r.bottom > -120 && r.top < H + 120;
      if (!c.asked && r.top < H * 3){ c.asked = true; c.load(); }   // lazy: fetch when two screens away
      c.mesh.visible = on; if (!on) continue;
      const st = c.el._gl || { reveal: 1, zoom: 1 };
      c.u.uPos.value.set(r.left, r.top); c.u.uSize.value.set(r.width, r.height); c.u.uScreen.value.set(W, H);
      c.u.uVel.value = vel; c.u.uReveal.value = st.reveal; c.u.uZoom.value = st.zoom;
    }
  });
  document.documentElement.classList.add('gl-works');
}

/* ---------------- more motion: magnetic pills ---------------- */
if (!reduce && F.fine){
  document.querySelectorAll('.pill').forEach(b => {
    b.classList.add('mag');
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .3, y: (e.clientY - r.top - r.height / 2) * .35, duration: .5, ease: 'power3.out' }); });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.4)' }));
  });
}

/* ---------------- main loop ---------------- */
document.documentElement.classList.add('gl-ready');
const clock = new THREE.Clock();
gsap.ticker.add(() => { try { frame(); } catch (e){ if (!window.__f3dErr){ window.__f3dErr = String(e && e.stack || e); console.error(e); } } });
function frame(){
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  if (!lenis) F.vel *= .9;
  for (const v of views){
    v.rect = v.el.getBoundingClientRect();
    v.visible = v.rect.bottom > 0 && v.rect.top < innerHeight && v.rect.width > 0;
    if (v.visible && v.ready){ v.update.call(v, t, dt); v.on = v.vis ? v.vis() : true; } else v.on = false;
  }
  clearCol.copy(GROUND).lerp(NIGHT, dark.k);
  grain.uniforms.uTime.value = t;
  if (!views.some(v => v.on)){   // only the plain ground shows: skip bloom, SMAA and grain
    renderer.setRenderTarget(null); renderer.setClearColor(clearCol, 1); renderer.clear(); return;
  }
  composer.render(dt);
  adapt(dt);
}
// Slow machine: step quality down once frames stay slow (SMAA off, pixel ratio 1, then no bloom).
let qLevel = 0, slowN = 0, sampN = 0;
function adapt(dt){
  if (!finished || qLevel >= 2 || document.hidden) return;
  sampN++; if (dt > 1 / 40) slowN++;
  const SAMP = mobile ? 45 : 90;
  if (sampN < SAMP) return;
  if (slowN > SAMP / 2){
    qLevel++;
    if (qLevel === 1){ if (smaa) smaa.enabled = false; PR = 1; renderer.setPixelRatio(1); composer.setPixelRatio(1); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth / BLOOM_DIV, innerHeight / BLOOM_DIV);
      views.forEach(v => v.scene.traverse(o => { const u = o.material && o.material.uniforms && o.material.uniforms.uR; if (u && u.r != null) u.value = u.r; })); }
    else { bloom.enabled = false; grain.enabled = false; }
  }
  sampN = slowN = 0;
}
// Resize the GL buffers at once when the width changes; height-only changes (phone address bar) wait until scrolling settles.
let gw = innerWidth, gTo = 0;
const glSize = () => { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth / BLOOM_DIV, innerHeight / BLOOM_DIV); };
addEventListener('resize', () => { clearTimeout(gTo); if (innerWidth !== gw){ gw = innerWidth; glSize(); } else gTo = setTimeout(glSize, 400); });
