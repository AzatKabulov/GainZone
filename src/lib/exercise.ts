import { useMemo } from 'react';

import { BUILTIN_BY_ID, BUILTIN_EXERCISES, type ExerciseDef } from '@/data/exercises';
import { EXERCISE_IMAGES } from '@/data/exerciseImages';
import { useData, type CustomExercise } from '@/store/data';
import { useSettings } from '@/store/settings';

export function customToDef(c: CustomExercise): ExerciseDef {
  return {
    id: c.id,
    name: c.name_ru || c.name,
    en: c.name || c.name_ru,
    group: c.grp,
    equip: c.equip,
    type: c.log_type,
    mech: Object.values(c.muscles).filter((v) => (v ?? 0) >= 25).length > 1 ? 'compound' : 'isolation',
    m: c.muscles,
    rest: c.rest,
    tips: c.notes ? [c.notes] : [],
    custom: true,
  };
}

const UNKNOWN = (id: string): ExerciseDef => ({
  id,
  name: 'Упражнение',
  en: 'Exercise',
  group: 'chest',
  equip: 'other',
  type: 'weight_reps',
  mech: 'compound',
  m: {},
  rest: 120,
  tips: [],
});

export function getExercise(id: string): ExerciseDef {
  const b = BUILTIN_BY_ID[id];
  if (b) return b;
  const c = useData.getState().exercises[id];
  return c ? customToDef(c) : UNKNOWN(id);
}

export function useExercise(id: string): ExerciseDef {
  const custom = useData((s) => s.exercises[id]);
  return useMemo(() => BUILTIN_BY_ID[id] ?? (custom ? customToDef(custom) : UNKNOWN(id)), [id, custom]);
}

export function useAllExercises(): ExerciseDef[] {
  const custom = useData((s) => s.exercises);
  return useMemo(
    () => [
      ...Object.values(custom)
        .filter((c) => !c.deleted)
        .map(customToDef),
      ...BUILTIN_EXERCISES,
    ],
    [custom],
  );
}

/** Name in the chosen language (the other one is shown as a subtitle). */
export function exName(e: ExerciseDef, lang = useSettings.getState().exLang): string {
  return lang === 'ru' ? e.name : e.en;
}
export function exAltName(e: ExerciseDef, lang = useSettings.getState().exLang): string {
  return lang === 'ru' ? e.en : e.name;
}

export function useExName() {
  const lang = useSettings((s) => s.exLang);
  return (e: ExerciseDef) => exName(e, lang);
}

export function exImages(id: string): [number, number] | null {
  return EXERCISE_IMAGES[id] ?? null;
}

export const LOG_COLS: Record<ExerciseDef['type'], [string, string]> = {
  weight_reps: ['KG', 'REPS'],
  bw_reps: ['+KG', 'REPS'],
  assisted: ['−KG', 'REPS'],
  time: ['', 'SEC'],
  cardio: ['MIN', 'KM'],
};
