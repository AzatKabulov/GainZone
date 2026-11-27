/**
 * Prompt builder for the exercise illustrations (generated with Figma AI, model gemini-3.1-flash-image).
 * Usage: node scripts/illustrations/prompts.mjs id1 id2 …   → prints "id<TAB>prompt" lines
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const scenes = JSON.parse(fs.readFileSync(path.join(DIR, 'scenes.json'), 'utf8'));
const src = ['ex_upper', 'ex_arms', 'ex_lower'].map((f) => fs.readFileSync(path.join(ROOT, 'src/data', `${f}.ts`), 'utf8')).join('\n');
const muscles = {};
for (const m of src.matchAll(/ex\('(\w+)', '[^']*', '[^']*', '\w+', '\w+',\s*\{([^}]*)\}/g)) {
  muscles[m[1]] = Object.fromEntries(m[2].split(',').filter(Boolean).map((kv) => kv.trim().split(':').map((x) => x.trim())).map(([k, v]) => [k, Number(v)]));
}
const NAME = {
  chest_upper: 'upper chest', chest_mid: 'chest', chest_lower: 'lower chest', delts_front: 'front deltoids', delts_side: 'side deltoids',
  delts_rear: 'rear deltoids', biceps: 'biceps', triceps: 'triceps', forearms: 'forearms', traps: 'upper trapezius',
  upper_back: 'upper back (rhomboids and middle trapezius)', lats: 'latissimus dorsi', lower_back: 'lower back (spinal erectors)',
  abs: 'abdominals', obliques: 'obliques', glutes: 'glutes', quads: 'quadriceps', hamstrings: 'hamstrings', adductors: 'inner thighs (adductors)', calves: 'calves',
};
const BACK = new Set(['lats', 'upper_back', 'lower_back', 'delts_rear', 'glutes', 'hamstrings', 'traps', 'calves']);

export function prompt(id) {
  const m = muscles[id] ?? {};
  const tot = Object.values(m).reduce((a, b) => a + b, 0) || 1;
  const prim = Object.entries(m).filter(([, v]) => (v / tot) * 100 >= 25).map(([k]) => NAME[k]);
  const sec = Object.entries(m).filter(([, v]) => (v / tot) * 100 >= 10 && (v / tot) * 100 < 25).map(([k]) => NAME[k]);
  const back = Object.entries(m).reduce((a, [k, v]) => a + (BACK.has(k) ? v : 0), 0) / tot > 0.5;
  const view = back ? 'Three-quarter rear view so the back of the body is clearly visible' : 'Three-quarter side view';
  return (
    `Fitness app exercise illustration: a fit muscular male athlete performing ${scenes[id]}. ` +
    'Clean smooth 3D render, matte light-grey anatomical figure with visible muscle definition, black shorts and black training shoes, gym equipment in dark grey metal. ' +
    `The working muscles are highlighted: ${prim.join(', ')} in vivid red-orange (#FF5A1F)` +
    (sec.length ? `, and ${sec.join(', ')} in a lighter orange (#FFA07A)` : '') +
    `. ${view}, full body and all of the equipment visible, centered with generous margins. ` +
    'Plain solid off-white background (#F2EEE6), soft studio lighting, subtle contact shadow. No text, no logos, no watermark.'
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const id of process.argv.slice(2)) console.log(`${id}\t${prompt(id)}`);
}
