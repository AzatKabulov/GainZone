import { uuid, useData, type TemplateExercise, type TemplateSet } from '@/store/data';
import { getExercise } from './exercise';

/** Ready-made routines. The first one mirrors the user's current Chest + Back day. */

type Row = [exerciseId: string, sets: [number | null, number | null][], rest?: number];

const S = (w: number | null, r: number | null): [number | null, number | null] => [w, r];

export const STARTERS: { key: string; name: string; note: string; rows: Row[] }[] = [
  {
    key: 'chest_back',
    name: 'Chest + Back',
    note: 'Push & pull in one session.',
    rows: [
      ['decline_machine_press', [S(90, 9), S(100, 5)], 150],
      ['incline_db_press', [S(25, 5), S(25, 6), S(22.5, 7)], 150],
      ['machine_fly', [S(86, 7), S(86, 7)], 120],
      ['lat_pulldown_wide', [S(68, 8), S(68, 6)], 90],
      ['seated_row_v', [S(64, 6), S(64, 6)], 120],
      ['chest_supported_db_row', [S(20, 4), S(17.5, 6)], 90],
    ],
  },
  {
    key: 'arms',
    name: 'Arms',
    note: 'Biceps, triceps, forearms.',
    rows: [
      ['incline_db_curl', [S(null, 10), S(null, 10), S(null, 10)], 90],
      ['rope_pushdown', [S(null, 12), S(null, 12), S(null, 12)], 90],
      ['prone_incline_curl', [S(null, 10), S(null, 10)], 75],
      ['overhead_rope_ext', [S(null, 12), S(null, 12)], 75],
      ['rope_hammer_curl', [S(null, 12), S(null, 12)], 75],
      ['french_press', [S(null, 10), S(null, 10)], 90],
    ],
  },
  {
    key: 'legs',
    name: 'Legs + Abs',
    note: 'Quads, glutes, hamstrings, core.',
    rows: [
      ['squat', [S(null, 8), S(null, 8), S(null, 8)], 180],
      ['bulgarian_split_squat', [S(null, 10), S(null, 10)], 120],
      ['rdl', [S(null, 10), S(null, 10)], 150],
      ['db_lunges', [S(null, 12), S(null, 12)], 120],
      ['standing_calf_raise', [S(null, 12), S(null, 12)], 60],
      ['cable_crunch', [S(null, 15), S(null, 15), S(null, 15)], 60],
    ],
  },
  {
    key: 'shoulders',
    name: 'Shoulders + Traps',
    note: 'All three delt heads, then traps.',
    rows: [
      ['db_shoulder_press', [S(null, 8), S(null, 8), S(null, 8)], 150],
      ['lateral_raise', [S(null, 14), S(null, 14), S(null, 14)], 75],
      ['reverse_pec_deck', [S(null, 14), S(null, 14)], 75],
      ['face_pull', [S(null, 15), S(null, 15)], 75],
      ['db_shrug', [S(null, 12), S(null, 12), S(null, 12)], 90],
    ],
  },
];

export function addStarter(key: string): string | null {
  const st = STARTERS.find((s) => s.key === key);
  if (!st) return null;
  const exercises: TemplateExercise[] = st.rows.map(([id, sets, rest]) => ({
    id: uuid(),
    exercise_id: id,
    rest: rest ?? getExercise(id).rest,
    note: '',
    sets: sets.map(([weight, reps]): TemplateSet => ({ type: 'normal', weight, reps })),
  }));
  const row = useData.getState().create('templates', { name: st.name, note: st.note, exercises, sort_order: Date.now() });
  return row.id;
}
