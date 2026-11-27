/**
 * Pre-renders the flat (2D) body map used when 3D is unavailable and for small previews:
 *   assets/body2d/front.webp, back.webp      — the idle figure
 *   assets/body2d/<muscle>_<view>.webp       — white alpha masks, tinted in the app (expo-image tintColor)
 * and writes src/data/body2d.ts. Same faceted look as Body3D. Usage: node scripts/body/render_flat.mjs
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
const OUT = path.join(ROOT, 'assets/body2d');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(path.join(ROOT, 'src/data/bodyMesh.ts'), 'utf8');
fs.writeFileSync(path.join(CACHE, 'bodyMesh.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { BODY_MESH } = await import(pathToFileURL(path.join(CACHE, 'bodyMesh.mjs')).href);
const W = 300;
const H = 600;

const html = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c" width="${W}" height="${H}"></canvas><canvas id="d" width="${W}" height="${H}"></canvas>
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
const look = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
look.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', \`#include <dithering_fragment>
  float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
  gl_FragColor.rgb += fres * vec3(0.10, 0.11, 0.14);
  if (!gl_FrontFacing) gl_FragColor.rgb = vec3(0.09, 0.09, 0.105);\`); };
const flat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
flat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', \`#include <dithering_fragment>
  if (!gl_FrontFacing) gl_FragColor.rgb = vec3(0.0);\`); };
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setClearColor(0x000000, 0);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#e8ecf5', '#101014', 0.9));
const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(1.2, 2.2, 3); scene.add(key);
const rim = new THREE.DirectionalLight('#9fb4ff', 1.6); rim.position.set(-1.5, 1.5, -2.5); scene.add(rim);
const mesh = new THREE.Mesh(geo, look); scene.add(mesh);
const cam = new THREE.PerspectiveCamera(28, ${W} / ${H}, 0.05, 20);
cam.position.set(0, 0.88, 3.75); cam.lookAt(0, 0.86, 0);
const IDLE = new THREE.Color('#6A6A75'), SKIN = new THREE.Color('#55555F'), WHITE = new THREE.Color('#ffffff'), BLACK = new THREE.Color('#000000');
function paint(fn) {
  for (let f = 0; f < F; f++) { const c = fn(faceLab[f]); for (let k = 0; k < 9; k += 3) { COL[f*9+k] = c.r; COL[f*9+k+1] = c.g; COL[f*9+k+2] = c.b; } }
  colAttr.needsUpdate = true;
}
window.renderBase = (angle) => {
  mesh.material = look; mesh.rotation.y = angle;
  paint((l) => (l >= 254 ? SKIN : IDLE));
  r.render(scene, cam);
  return document.getElementById('c').toDataURL('image/webp', 0.9);
};
window.renderMask = (angle, label) => {
  mesh.material = flat; mesh.rotation.y = angle;
  paint((l) => (l === label ? WHITE : BLACK));
  r.render(scene, cam);
  const d = document.getElementById('d').getContext('2d');
  d.clearRect(0, 0, ${W}, ${H});
  d.drawImage(document.getElementById('c'), 0, 0);
  const img = d.getImageData(0, 0, ${W}, ${H});
  let count = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255;
    const lum = a ? Math.max(img.data[i], img.data[i + 1], img.data[i + 2]) / 255 / a : 0;
    const alpha = lum < 0.04 ? 0 : Math.min(1, 0.45 + lum * 0.6) * a;
    if (alpha > 0.2) count++;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(alpha * 255);
  }
  d.putImageData(img, 0, 0);
  return { count, url: document.getElementById('d').toDataURL('image/webp', 0.85) };
};
document.title = 'ready';
</script></body></html>`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W * 2, height: H } });
page.on('pageerror', (e) => console.log('page error', e.message));
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
const save = (name, url) => fs.writeFileSync(path.join(OUT, `${name}.webp`), Buffer.from(url.split(',')[1], 'base64'));
const VIEWS = { front: 0, back: Math.PI };
const masks = {};
for (const [view, angle] of Object.entries(VIEWS)) {
  save(view, await page.evaluate((a) => window.renderBase(a), angle));
  for (const [i, m] of BODY_MESH.muscles.entries()) {
    const { count, url } = await page.evaluate(([a, l]) => window.renderMask(a, l), [angle, i]);
    if (count < 120) continue;
    save(`${m}_${view}`, url);
    (masks[m] ??= {})[view] = true;
  }
}
await browser.close();

const req = (n) => `require('../../assets/body2d/${n}.webp')`;
const lines = [
  '// AUTO-GENERATED by scripts/body/render_flat.mjs — flat body map (base figure + per-muscle masks).',
  "import type { MuscleId } from './muscles';",
  '',
  `export const BODY2D_SIZE = { w: ${W}, h: ${H} };`,
  `export const BODY2D_BASE = { front: ${req('front')}, back: ${req('back')} };`,
  'export const BODY2D_MASKS: Partial<Record<MuscleId, { front?: number; back?: number }>> = {',
  ...Object.entries(masks).map(([m, v]) => `  ${m}: { ${Object.keys(v).map((view) => `${view}: ${req(`${m}_${view}`)}`).join(', ')} },`),
  '};',
  '',
];
fs.writeFileSync(path.join(ROOT, 'src/data/body2d.ts'), lines.join('\n'));
console.log('masks', Object.keys(masks).length, 'files', fs.readdirSync(OUT).length, (fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1024).toFixed(0) + 'KB');
