/**
 * Renders a 3D thumbnail for every built-in exercise from the GainZone anatomy mesh:
 * the working muscles lit in VOLT (primary) / dimmed VOLT (secondary), framed on the
 * part of the body that does the work. Output: assets/ex3d/<id>.webp + src/data/exerciseImages.ts
 *
 * Needs the pre-installed Playwright Chromium. Usage: node scripts/body/render_exercises.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = path.join(ROOT, 'node_modules/.cache/gainzone-render');
const OUT = path.join(ROOT, 'assets/ex3d');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. load exercise data (transpile the TS data modules)
for (const f of ['exerciseTypes', 'muscles', 'ex_upper', 'ex_arms', 'ex_lower', 'bodyMesh']) {
  const src = fs.readFileSync(path.join(ROOT, 'src/data', `${f}.ts`), 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  js = js.replace(/from '\.\/(\w+)'/g, "from './$1.mjs'");
  fs.writeFileSync(path.join(CACHE, `${f}.mjs`), js);
}
const imp = (f) => import(pathToFileURL(path.join(CACHE, `${f}.mjs`)).href);
const [{ CHEST, BACK, SHOULDERS, TRAPS }, { BICEPS, TRICEPS, FOREARMS }, { ABS, LEGS, CARDIO }, { BODY_MESH }] = await Promise.all([
  imp('ex_upper'),
  imp('ex_arms'),
  imp('ex_lower'),
  imp('bodyMesh'),
]);
const all = [...CHEST, ...BACK, ...SHOULDERS, ...TRAPS, ...BICEPS, ...TRICEPS, ...FOREARMS, ...ABS, ...LEGS, ...CARDIO];

const BACK_SIDE = new Set(['lats', 'upper_back', 'lower_back', 'triceps', 'delts_rear', 'glutes', 'hamstrings', 'traps', 'calves']);
const LOWER = new Set(['glutes', 'quads', 'hamstrings', 'adductors', 'calves']);
const jobs = all.map((e) => {
  const tot = Object.values(e.m).reduce((a, b) => a + b, 0) || 1;
  let back = 0, lower = 0;
  const colors = {};
  for (const [m, v0] of Object.entries(e.m)) {
    const v = (v0 / tot) * 100;
    if (BACK_SIDE.has(m)) back += v;
    if (LOWER.has(m)) lower += v;
    colors[m] = v >= 25 ? 1 : v >= 10 ? 0.5 : 0.22;
  }
  const isBack = back > 50;
  const isLower = lower > 50;
  const full = e.group === 'cardio';
  const angle = (isBack ? Math.PI : 0) + (isBack ? -0.35 : 0.35);
  const [ty, dist] = full ? [0.88, 4.0] : isLower ? [0.62, 2.15] : [1.28, 1.55];
  return { id: e.id, colors, angle, ty, dist, size: 256 };
});

// muscle-group filter icons (exercise picker)
const ICONS = [
  ['chest', ['chest_upper', 'chest_mid', 'chest_lower'], 'front', 'upper'],
  ['shoulders', ['delts_front', 'delts_side', 'delts_rear'], 'side', 'upper'],
  ['biceps', ['biceps'], 'front', 'upper'],
  ['triceps', ['triceps'], 'back', 'upper'],
  ['forearms', ['forearms'], 'front', 'arms'],
  ['traps', ['traps'], 'back', 'upper'],
  ['upper_back', ['upper_back'], 'back', 'upper'],
  ['lats', ['lats'], 'back', 'upper'],
  ['abs', ['abs'], 'front', 'core'],
  ['obliques', ['obliques'], 'front', 'core'],
  ['lower_back', ['lower_back'], 'back', 'core'],
  ['glutes', ['glutes'], 'back', 'lower'],
  ['quads', ['quads'], 'front', 'lower'],
  ['hamstrings', ['hamstrings'], 'back', 'lower'],
  ['adductors', ['adductors'], 'front', 'lower'],
  ['calves', ['calves'], 'back', 'calf'],
  ['full', [], 'front', 'full'],
];
const FRAME = { upper: [1.3, 1.45], arms: [1.05, 1.7], core: [1.05, 1.45], lower: [0.62, 2.0], calf: [0.42, 1.6], full: [0.88, 4.0] };
const ANGLE = { front: 0.3, back: Math.PI - 0.3, side: 0.75 };
const iconJobs = ICONS.map(([id, ms, side, frame]) => ({
  id,
  colors: Object.fromEntries(ms.map((m) => [m, 1])),
  angle: ANGLE[side],
  ty: FRAME[frame][0],
  dist: FRAME[frame][1],
  size: 160,
}));

// 2. render in Chromium — same faceted look as src/components/Body3D.tsx
const html = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c" width="256" height="256"></canvas>
<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
const M = window.MESH;
const bin = Uint8Array.from(atob(M.data), (c) => c.charCodeAt(0)).buffer;
let off = 0; const take = (C, n, size) => { const a = new C(bin, off, n); off += size; return a; };
const V = M.vertexCount, T = M.indexCount;
const pos = take(Int16Array, V * 3, M.sizes[0]); take(Int8Array, V * 3, M.sizes[1]); const lab = take(Uint8Array, V, M.sizes[2]); take(Uint8Array, V, M.sizes[3]); take(Uint8Array, V, M.sizes[4]);
const ind = M.bigIndex ? take(Uint32Array, T, M.sizes[5]) : take(Uint16Array, T, M.sizes[5]);
const P = new Float32Array(V * 3);
for (let i = 0; i < V; i++) for (let a = 0; a < 3; a++) P[i*3+a] = M.min[a] + (pos[i*3+a] + 32768) / 65535 * (M.max[a] - M.min[a]);
const F = T / 3, fp = new Float32Array(F * 9), fn = new Float32Array(F * 9), COL = new Float32Array(F * 9), faceLab = new Uint8Array(F);
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
for (let f = 0; f < F; f++) {
  const a = ind[f*3], b = ind[f*3+1], c = ind[f*3+2];
  faceLab[f] = lab[b] === lab[c] ? lab[b] : lab[a];
  va.fromArray(P, a*3); vb.fromArray(P, b*3); vc.fromArray(P, c*3);
  n.crossVectors(u.subVectors(vb, va), w.subVectors(vc, va)).normalize();
  [va, vb, vc].forEach((v, k) => { v.toArray(fp, f*9 + k*3); n.toArray(fn, f*9 + k*3); });
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
geo.setAttribute('normal', new THREE.BufferAttribute(fn, 3));
const colAttr = new THREE.BufferAttribute(COL, 3); geo.setAttribute('color', colAttr);
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', \`#include <dithering_fragment>
  vec3 base = vColor.rgb;
  float sat = max(base.r, max(base.g, base.b)) - min(base.r, min(base.g, base.b));
  gl_FragColor.rgb += base * sat * 0.15;
  float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
  gl_FragColor.rgb += fres * mix(vec3(0.10, 0.11, 0.14), base, sat);
  if (!gl_FrontFacing) gl_FragColor.rgb = vec3(0.09, 0.09, 0.105);\`); };
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setClearColor(0x000000, 0);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#e8ecf5', '#101014', 0.9));
const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(1.2, 2.2, 3); scene.add(key);
const rim = new THREE.DirectionalLight('#9fb4ff', 1.6); rim.position.set(-1.5, 1.5, -2.5); scene.add(rim);
const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
const ACC = new THREE.Color('#C9F03F'), IDLE = new THREE.Color('#6A6A75'), SKIN = new THREE.Color('#55555F');
const c1 = new THREE.Color();
window.renderJob = (job) => {
  const cv = document.getElementById('c');
  if (cv.width !== job.size) { cv.width = cv.height = job.size; r.setSize(job.size, job.size, false); }
  for (let f = 0; f < F; f++) {
    const l = faceLab[f];
    if (l >= 254) c1.copy(SKIN); else if (l === 253 || l >= M.muscles.length) c1.copy(IDLE); else c1.copy(IDLE).lerp(ACC, job.colors[M.muscles[l]] || 0);
    for (let k = 0; k < 9; k += 3) { COL[f*9+k] = c1.r; COL[f*9+k+1] = c1.g; COL[f*9+k+2] = c1.b; }
  }
  colAttr.needsUpdate = true;
  mesh.rotation.y = job.angle;
  cam.position.set(0, job.ty + 0.04, job.dist); cam.lookAt(0, job.ty, 0);
  r.render(scene, cam);
  return cv.toDataURL('image/webp', 0.86);
};
document.title = 'ready';
</script></body></html>`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
page.on('pageerror', (e) => console.log('page error', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 300)));
page.on('requestfailed', (r) => console.log('failed', r.url()));
await page.route('http://render.local/**', (route) => {
  const u = new URL(route.request().url()).pathname;
  if (u.endsWith('.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'node_modules/three/build', path.basename(u))) });
  return route.fulfill({ contentType: 'text/html', body: html });
});
await page.addInitScript((mesh) => {
  window.MESH = mesh;
}, BODY_MESH);
await page.goto('http://render.local/index.html');
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 });

for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
let bytes = 0;
for (const job of jobs) {
  const url = await page.evaluate((j) => window.renderJob(j), job);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  bytes += buf.length;
  fs.writeFileSync(path.join(OUT, `${job.id}.webp`), buf);
}
const ICON_OUT = path.join(ROOT, 'assets/muscles');
fs.mkdirSync(ICON_OUT, { recursive: true });
for (const job of iconJobs) {
  const url = await page.evaluate((j) => window.renderJob(j), job);
  fs.writeFileSync(path.join(ICON_OUT, `${job.id}.webp`), Buffer.from(url.split(',')[1], 'base64'));
}
fs.writeFileSync(
  path.join(ROOT, 'src/data/muscleIcons.ts'),
  [
    '// AUTO-GENERATED by scripts/body/render_exercises.mjs — muscle-group icons for the exercise filter.',
    'export const MUSCLE_ICONS: Record<string, number> = {',
    ...iconJobs.map((j) => `  ${j.id}: require('../../assets/muscles/${j.id}.webp'),`),
    '};',
    '',
  ].join('\n'),
);
await browser.close();

const lines = [
  '// AUTO-GENERATED by scripts/body/render_exercises.mjs — 3D muscle thumbnails (anatomy: BodyParts3D © DBCLS, CC BY 4.0).',
  'export const EXERCISE_IMAGES: Record<string, number> = {',
  ...jobs.map((j) => `  '${j.id}': require('../../assets/ex3d/${j.id}.webp'),`),
  '};',
  '',
];
fs.writeFileSync(path.join(ROOT, 'src/data/exerciseImages.ts'), lines.join('\n'));
console.log('rendered', jobs.length, 'thumbnails,', (bytes / 1024).toFixed(0) + 'KB');
