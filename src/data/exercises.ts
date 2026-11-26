import { CHEST, BACK, SHOULDERS, TRAPS } from './ex_upper';
import { BICEPS, TRICEPS, FOREARMS } from './ex_arms';
import { ABS, LEGS, CARDIO } from './ex_lower';
import type { ExerciseDef } from './exerciseTypes';
import { MUSCLES, MuscleId, setCredit } from './muscles';

export * from './exerciseTypes';

function normalize(e: ExerciseDef): ExerciseDef {
  const total = Object.values(e.m).reduce<number>((a, b) => a + (b ?? 0), 0);
  if (!total || Math.abs(total - 100) < 0.5) return e;
  const m: ExerciseDef['m'] = {};
  for (const [k, v] of Object.entries(e.m)) m[k as MuscleId] = Math.round(((v ?? 0) / total) * 100);
  return { ...e, m };
}

export const BUILTIN_EXERCISES: ExerciseDef[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...TRAPS,
  ...BICEPS,
  ...TRICEPS,
  ...FOREARMS,
  ...ABS,
  ...LEGS,
  ...CARDIO,
].map(normalize);

export const BUILTIN_BY_ID: Record<string, ExerciseDef> = Object.fromEntries(
  BUILTIN_EXERCISES.map((e) => [e.id, e]),
);

/** Muscles sorted by share, with role. */
export function muscleBreakdown(e: ExerciseDef) {
  return (Object.entries(e.m) as [MuscleId, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, pct]) => ({
      id,
      pct,
      name: MUSCLES[id].name,
      role: setCredit(pct) === 1 ? ('primary' as const) : setCredit(pct) > 0 ? ('secondary' as const) : ('stabilizer' as const),
    }));
}

export function primaryMuscles(e: ExerciseDef): MuscleId[] {
  return muscleBreakdown(e).filter((m) => m.role === 'primary').map((m) => m.id);
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function searchExercises(list: ExerciseDef[], q: string): ExerciseDef[] {
  const nq = norm(q);
  if (!nq) return list;
  const words = nq.split(' ');
  const scored = list
    .map((e) => {
      const hay = norm([e.name, e.en, ...(e.aka ?? [])].join(' | '));
      let score = 0;
      if (norm(e.name).startsWith(nq)) score += 5;
      if ((e.aka ?? []).some((a) => norm(a).startsWith(nq))) score += 4;
      if (hay.includes(nq)) score += 3;
      const allWords = words.every((w) => hay.includes(w));
      if (allWords) score += 2;
      return { e, score: allWords || hay.includes(nq) ? score : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.e);
}
