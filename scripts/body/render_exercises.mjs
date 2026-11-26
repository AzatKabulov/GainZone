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
  return { id: e.id, colors, back: isBack, lower: isLower, full };
});

// 2. render in Chromium
const html = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c" width="256" height="256"></canvas>
<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
const M = window.MESH;
const bin = Uint8Array.from(atob(M.data), (c) => c.charCodeAt(0)).buffer;
let off = 0; const take = (C, n, size) => { const a = new C(bin, off, n); off += size; return a; };
const V = M.vertexCount, T = M.indexCount;
const pos = take(Int16Array, V * 3, M.sizes[0]), nor = take(Int8Array, V * 3, M.sizes[1]), lab = take(Uint8Array, V, M.sizes[2]), lab2 = take(Uint8Array, V, M.sizes[3]), bl = take(Uint8Array, V, M.sizes[4]);
const ind = M.bigIndex ? take(Uint32Array, T, M.sizes[5]) : take(Uint16Array, T, M.sizes[5]);
const P = new Float32Array(V * 3), N = new Float32Array(V * 3), COL = new Float32Array(V * 3);
for (let i = 0; i < V; i++) for (let a = 0; a < 3; a++) { P[i*3+a] = M.min[a] + (pos[i*3+a] + 32768) / 65535 * (M.max[a] - M.min[a]); N[i*3+a] = nor[i*3+a] / 127; }
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
const colAttr = new THREE.BufferAttribute(COL, 3); geo.setAttribute('color', colAttr);
geo.setIndex(new THREE.BufferAttribute(ind, 1));
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 });
mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', \`#include <dithering_fragment>
  float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
  gl_FragColor.rgb += fres * vec3(0.14, 0.15, 0.18);\`); };
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setClearColor(0x000000, 0);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#f2eee6', '#141416', 1.0));
const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(1.5, 2.5, 3); scene.add(key);
const fill = new THREE.DirectionalLight('#bcc8ff', 0.7); fill.position.set(-2.5, 0.8, 1.5); scene.add(fill);
const rim = new THREE.DirectionalLight('#ffffff', 2.0); rim.position.set(-0.5, 1.8, -3); scene.add(rim);
const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
const ACC = new THREE.Color('#C9F03F'), IDLE = new THREE.Color('#4c4c55'), SKIN = new THREE.Color('#26262b'), UNDER = new THREE.Color('#121215');
const c1 = new THREE.Color(), c2 = new THREE.Color();
function colOf(l, colors, out) {
  if (l === 255) return out.copy(SKIN);
  if (l === 254) return out.copy(UNDER);
  if (l === 253) return out.copy(IDLE);
  const k = colors[M.muscles[l]] || 0;
  return out.copy(IDLE).lerp(ACC, k);
}
window.renderJob = (job) => {
  for (let i = 0; i < V; i++) { colOf(lab[i], job.colors, c1); colOf(lab2[i], job.colors, c2); c1.lerp(c2, bl[i] / 255 * 0.5); COL[i*3] = c1.r; COL[i*3+1] = c1.g; COL[i*3+2] = c1.b; }
  colAttr.needsUpdate = true;
  const ang = (job.back ? Math.PI : 0) + (job.back ? -0.35 : 0.35);
  mesh.rotation.y = ang;
  let ty, dist;
  if (job.full) { ty = 0.88; dist = 4.0; } else if (job.lower) { ty = 0.62; dist = 2.15; } else { ty = 1.28; dist = 1.55; }
  cam.position.set(0, ty + 0.04, dist); cam.lookAt(0, ty, 0);
  r.render(scene, cam);
  return document.getElementById('c').toDataURL('image/webp', 0.86);
};
document.title = 'ready';
</script></body></html>`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
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
