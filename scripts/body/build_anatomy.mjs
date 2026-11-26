/**
 * Builds GainZone's 3D muscle figure from the open-anatomy-3d male model
 * (BodyParts3D © DBCLS, CC BY 4.0 — adapted by open-anatomy-3d, CC BY 4.0).
 *
 * - picks the skeletal-muscle structures, splits the coarse groups into the app's 20 regions
 *   (3 chest bands, 3 delt heads, biceps/triceps, abs/obliques, traps/upper back, lats…)
 * - welds + simplifies every mesh with meshoptimizer so the whole figure fits a phone
 * - adds the skin's head, hands and feet and a slightly shrunk dark "under-body" that fills gaps
 * - writes src/data/bodyMesh.ts (base64 binary) [+ a JSON copy for previews]
 *
 * Usage: node scripts/body/build_anatomy.mjs [jsonOut]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKG = path.dirname(require.resolve('open-anatomy-3d/package.json'));
const JSON_OUT = process.argv[2];

export const MUSCLES = [
  'chest_upper', 'chest_mid', 'chest_lower', 'delts_front', 'delts_side', 'delts_rear',
  'biceps', 'triceps', 'forearms', 'traps', 'upper_back', 'lats', 'lower_back', 'abs',
  'obliques', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves',
];
const L = Object.fromEntries(MUSCLES.map((m, i) => [m, i]));
const IDLE = 253; // muscle we don't track (neck, serratus, shins…)
const UNDER = 254; // dark body filling the gaps
const SKIN = 255; // head, hands, feet

await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(path.join(PKG, 'models/anatomy-male.glb'));
const catalog = JSON.parse(fs.readFileSync(path.join(PKG, 'catalog.json'), 'utf8'));
const anchor = Object.fromEntries(catalog.filter((c) => c.anchor).map((c) => [c.key, c.anchor]));

/* ───────── read meshes in world space ───────── */
const meshes = {};
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const M = node.getWorldMatrix();
  const P = [];
  const I = [];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const off = P.length / 3;
    const e = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, e);
      P.push(M[0] * e[0] + M[4] * e[1] + M[8] * e[2] + M[12], M[1] * e[0] + M[5] * e[1] + M[9] * e[2] + M[13], M[2] * e[0] + M[6] * e[1] + M[10] * e[2] + M[14]);
    }
    const ind = prim.getIndices();
    if (ind) for (let i = 0; i < ind.getCount(); i++) I.push(ind.getScalar(i) + off);
    else for (let i = 0; i < pos.getCount(); i++) I.push(i + off);
  }
  meshes[node.getName()] = { P, I };
}

/* ───────── helpers ───────── */
function weld({ P, I }, eps = 0.0002) {
  const map = new Map();
  const remap = new Int32Array(P.length / 3);
  const out = [];
  for (let i = 0; i < P.length / 3; i++) {
    const key = `${Math.round(P[i * 3] / eps)},${Math.round(P[i * 3 + 1] / eps)},${Math.round(P[i * 3 + 2] / eps)}`;
    let j = map.get(key);
    if (j === undefined) {
      j = out.length / 3;
      out.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      map.set(key, j);
    }
    remap[i] = j;
  }
  const idx = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = remap[I[t]], b = remap[I[t + 1]], c = remap[I[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { P: out, I: idx };
}

function simplify(m, ratio, err = 0.004) {
  if (ratio >= 1) return m;
  const pos = new Float32Array(m.P);
  const ind = new Uint32Array(m.I);
  const target = Math.max(3, Math.floor((ind.length * ratio) / 3) * 3);
  const [res] = MeshoptSimplifier.simplify(ind, pos, 3, target, err, ['LockBorder']);
  // compact unused vertices
  const used = new Int32Array(pos.length / 3).fill(-1);
  const P = [];
  const I = [];
  for (const v of res) {
    if (used[v] < 0) {
      used[v] = P.length / 3;
      P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    }
    I.push(used[v]);
  }
  return { P, I };
}

/** Make faces point outwards (positive signed volume). */
function orient(m) {
  let vol = 0;
  const { P, I } = m;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    vol +=
      P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) -
      P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) +
      P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  if (vol < 0) for (let t = 0; t < I.length; t += 3) [I[t + 1], I[t + 2]] = [I[t + 2], I[t + 1]];
  return m;
}

function normals({ P, I }) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      N[v * 3] += nx;
      N[v * 3 + 1] += ny;
      N[v * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
    N[i] /= l;
    N[i + 1] /= l;
    N[i + 2] /= l;
  }
  return N;
}

const parts = []; // { P, I, N, lab: Uint8Array }
const stats = [];
let lastName = '';
function addPart(m, labelFn, name = '') {
  stats.push([name || lastName, m.I.length / 3]);
  const N = normals(m);
  const lab = new Uint8Array(m.P.length / 3);
  for (let i = 0; i < lab.length; i++) lab[i] = labelFn([m.P[i * 3], m.P[i * 3 + 1], m.P[i * 3 + 2]], [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]]);
  parts.push({ ...m, N, lab });
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* ───────── muscles ───────── */
const SIMPLIFY = {
  back_muscles: 0.16, forearm_muscles: 0.26, neck_muscles: 0.25, shoulder_muscles: 0.3, abdominal_muscles: 0.3,
  calf: 0.6, shin_muscles: 0.35, gluteal: 0.7, adductors: 0.7, rotator_cuff: 0.7, trapezius: 0.8,
};

for (const side of ['l', 'r']) {
  const s = side === 'l' ? 1 : -1; // figure's left is +x
  const get = (k) => {
    lastName = `${k}_${side}`;
    const raw = meshes[`${k}_${side}`];
    const w = weld(raw);
    return orient(simplify(w, SIMPLIFY[k] ?? 1));
  };
  const sh = anchor[`shoulder_${side}`];
  const el = anchor[`elbow_${side}`];

  // chest — three bands by height
  {
    const m = get('chest_muscles');
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < m.P.length; i += 3) {
      y0 = Math.min(y0, m.P[i]);
      y1 = Math.max(y1, m.P[i]);
    }
    addPart(m, (p) => {
      const t = (p[1] - y0) / (y1 - y0);
      return t > 0.63 ? L.chest_upper : t > 0.3 ? L.chest_mid : L.chest_lower;
    });
  }
  // deltoid — heads by direction around the shoulder joint
  addPart(get('deltoid'), (p) => {
    const d = sub(p, sh);
    const a = Math.atan2(d[2], d[0] * s) * (180 / Math.PI);
    return a > 38 ? L.delts_front : a < -38 ? L.delts_rear : L.delts_side;
  });
  // upper arm — biceps in front of the humerus axis, triceps behind
  addPart(get('upper_arm_muscles'), (p) => {
    const ax = sub(el, sh);
    const t = Math.max(0, Math.min(1, dot(sub(p, sh), ax) / dot(ax, ax)));
    const c = [sh[0] + ax[0] * t, sh[1] + ax[1] * t, sh[2] + ax[2] * t];
    return p[2] - c[2] > -0.004 ? L.biceps : L.triceps;
  });
  addPart(get('forearm_muscles'), () => L.forearms);
  // trapezius — upper part = traps, middle/lower = upper back
  addPart(get('trapezius'), (p) => (p[1] > 1.37 ? L.traps : L.upper_back));
  // shoulder girdle — lats (back, low or wide), rhomboids/teres (back, high), serratus etc. (front/side)
  addPart(get('shoulder_muscles'), (p) => {
    if (p[2] < -0.035) return p[1] < 1.31 || Math.abs(p[0]) > 0.11 ? L.lats : L.upper_back;
    return IDLE;
  });
  addPart(get('rotator_cuff'), (p) => (p[2] < -0.03 ? L.upper_back : IDLE));
  addPart(get('back_muscles'), (p) => (p[1] < 1.42 ? L.lower_back : IDLE));
  addPart(get('gluteal'), () => L.glutes);
  addPart(get('quadriceps'), () => L.quads);
  addPart(get('hamstrings'), () => L.hamstrings);
  addPart(get('adductors'), () => L.adductors);
  addPart(get('calf'), () => L.calves);
  addPart(get('shin_muscles'), () => IDLE);
  addPart(get('neck_muscles'), () => IDLE);
}
// abdominal wall — rectus in the middle front, obliques elsewhere
lastName = 'abdominal_muscles';
addPart(orient(simplify(weld(meshes.abdominal_muscles), SIMPLIFY.abdominal_muscles)), (p) => (Math.abs(p[0]) < 0.07 && p[2] > 0.0 ? L.abs : L.obliques));

/* ───────── skin: head, hands, feet + dark under-body ───────── */
const skin = orient(simplify(weld(meshes.skin), 0.36, 0.002));
{
  const keep = (p) => p[1] > 1.5 || (p[1] < 0.905 && Math.abs(p[0]) > 0.19) || p[1] < 0.085;
  const I = [];
  for (let t = 0; t < skin.I.length; t += 3) {
    const vs = [skin.I[t], skin.I[t + 1], skin.I[t + 2]];
    if (vs.every((v) => keep([skin.P[v * 3], skin.P[v * 3 + 1], skin.P[v * 3 + 2]]))) I.push(...vs);
  }
  addPart({ P: skin.P, I }, () => SKIN, 'skin');
}
// skeleton in a dark tone fills the gaps between muscles (knees, elbows, ribs, spine…)
const BONES = {
  pelvis: 0.5, sternum: 1, spine_cervical: 0.12, spine_thoracic: 0.15, spine_lumbar: 0.15,
  ribs_l: 0.12, ribs_r: 0.12, clavicle_l: 1, clavicle_r: 1, scapula_l: 0.25, scapula_r: 0.25,
  humerus_l: 1, humerus_r: 1, forearm_l: 1, forearm_r: 1, femur_l: 1, femur_r: 1,
  patella_l: 1, patella_r: 1, lower_leg_l: 1, lower_leg_r: 1,
};
for (const [name, ratio] of Object.entries(BONES)) {
  if (!meshes[name]) continue;
  addPart(orient(simplify(weld(meshes[name]), ratio)), () => UNDER, name);
}

/* ───────── merge + soft region borders ───────── */
let V = 0;
let T = 0;
for (const p of parts) {
  V += p.P.length / 3;
  T += p.I.length;
}
const P = new Float32Array(V * 3);
const N = new Float32Array(V * 3);
const lab = new Uint8Array(V);
const lab2 = new Uint8Array(V);
const blend = new Uint8Array(V);
const ind = new Uint32Array(T);
let vo = 0;
let io2 = 0;
for (const p of parts) {
  P.set(p.P, vo * 3);
  N.set(p.N, vo * 3);
  lab.set(p.lab, vo);
  for (let i = 0; i < p.I.length; i++) ind[io2 + i] = p.I[i] + vo;
  vo += p.P.length / 3;
  io2 += p.I.length;
}
lab2.set(lab);
for (let t = 0; t < T; t += 3) {
  const [a, b, c] = [ind[t], ind[t + 1], ind[t + 2]];
  for (const [x, y] of [[a, b], [b, c], [c, a]]) {
    if (lab[x] !== lab[y] && lab[x] < 253 && lab[y] < 253) {
      lab2[x] = lab[y];
      blend[x] = 110;
      lab2[y] = lab[x];
      blend[y] = 110;
    }
  }
}

/* ───────── pack ───────── */
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < V; i++)
  for (let a = 0; a < 3; a++) {
    min[a] = Math.min(min[a], P[i * 3 + a]);
    max[a] = Math.max(max[a], P[i * 3 + a]);
  }
const posQ = new Int16Array(V * 3);
for (let i = 0; i < V; i++)
  for (let a = 0; a < 3; a++) posQ[i * 3 + a] = Math.round(((P[i * 3 + a] - min[a]) / (max[a] - min[a])) * 65535 - 32768);
const norQ = new Int8Array(V * 3);
for (let i = 0; i < V * 3; i++) norQ[i] = Math.round(N[i] * 127);
const big = V > 65535;
const indQ = big ? ind : Uint16Array.from(ind);
const pad4 = (n) => (n + 3) & ~3;
const arrays = [posQ, norQ, lab, lab2, blend, indQ];
const sizes = arrays.map((a) => pad4(a.byteLength));
const buf = Buffer.alloc(sizes.reduce((a, b) => a + b, 0));
let off = 0;
arrays.forEach((a, i) => {
  Buffer.from(a.buffer, a.byteOffset, a.byteLength).copy(buf, off);
  off += sizes[i];
});
const b64 = buf.toString('base64');
const r4 = (v) => Math.round(v * 10000) / 10000;
fs.writeFileSync(
  path.join(ROOT, 'src/data/bodyMesh.ts'),
  `// AUTO-GENERATED by scripts/body/build_anatomy.mjs — do not edit.
// Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0), adapted by open-anatomy-3d (CC BY 4.0);
// regions split, simplified and recoloured for GainZone.
export const BODY_MESH = {
  vertexCount: ${V},
  indexCount: ${T},
  bigIndex: ${big},
  min: [${min.map(r4).join(', ')}] as [number, number, number],
  max: [${max.map(r4).join(', ')}] as [number, number, number],
  sizes: [${sizes.join(', ')}],
  muscles: ${JSON.stringify(MUSCLES)},
  data: '${b64}',
};
`,
);
console.log(stats.sort((a, b) => b[1] - a[1]).slice(0, 25).map(([n, t]) => `${n}:${t}`).join(' '));
console.log('vertices', V, 'triangles', T / 3, 'base64', (b64.length / 1024).toFixed(0) + 'KB');
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ min, max, sizes, V, T, big, muscles: MUSCLES, data: b64 }));
