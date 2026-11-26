import type { GroupId, MuscleId } from './muscles';

export type Equip =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'smith'
  | 'bodyweight'
  | 'ezbar'
  | 'kettlebell'
  | 'band'
  | 'other'
  | 'cardio';

/**
 * weight_reps — кг × повторы
 * bw_reps     — собственный вес (+доп. кг) × повторы
 * assisted    — гравитрон (−кг помощи) × повторы
 * time        — секунды
 * cardio      — минуты + км
 */
export type LogType = 'weight_reps' | 'bw_reps' | 'assisted' | 'time' | 'cardio';

export interface ExerciseDef {
  id: string;
  name: string;
  en: string;
  group: GroupId;
  equip: Equip;
  type: LogType;
  mech: 'compound' | 'isolation';
  /** approximate share of the work by muscle, % (normalized to 100) */
  m: Partial<Record<MuscleId, number>>;
  /** default rest, seconds */
  rest: number;
  tips: string[];
  /** folder name in the public-domain free-exercise-db (for demo photos) */
  img?: string;
  aka?: string[];
  custom?: boolean;
}

export const EQUIP_NAME: Record<Equip, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  smith: 'Smith',
  bodyweight: 'Bodyweight',
  ezbar: 'EZ Bar',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
  cardio: 'Cardio',
};

type Def = Omit<ExerciseDef, 'id' | 'name' | 'en' | 'group' | 'equip' | 'm'> & {};

export function ex(
  id: string,
  name: string,
  en: string,
  group: GroupId,
  equip: Equip,
  m: Partial<Record<MuscleId, number>>,
  opts: Partial<Def> & { tips: string[] },
): ExerciseDef {
  const isolation = Object.values(m).filter((v) => (v ?? 0) >= 25).length <= 1;
  return {
    id,
    name,
    en,
    group,
    equip,
    m,
    type: opts.type ?? 'weight_reps',
    mech: opts.mech ?? (isolation ? 'isolation' : 'compound'),
    rest: opts.rest ?? (isolation ? 90 : 150),
    tips: opts.tips,
    img: opts.img,
    aka: opts.aka,
  };
}
