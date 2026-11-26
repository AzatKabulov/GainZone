export type MuscleId =
  | 'chest_upper'
  | 'chest_mid'
  | 'chest_lower'
  | 'delts_front'
  | 'delts_side'
  | 'delts_rear'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'traps'
  | 'upper_back'
  | 'lats'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export type GroupId =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'traps'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'legs'
  | 'cardio';

export interface MuscleInfo {
  id: MuscleId;
  /** English label (UI) */
  en: string;
  /** Russian name */
  name: string;
  short: string;
  latin: string;
  group: GroupId;
  /** recommended hard sets per week for hypertrophy [min, max] */
  weekly: [number, number];
  about: string;
}

export const MUSCLES: Record<MuscleId, MuscleInfo> = {
  chest_upper: {
    id: 'chest_upper',
    en: 'Upper Chest',
    name: 'Верх груди',
    short: 'Верх груди',
    latin: 'Pectoralis major, pars clavicularis',
    group: 'chest',
    weekly: [6, 12],
    about: 'Clavicular head of the pec. Best hit by 15–30° incline presses and low-to-high flyes.',
  },
  chest_mid: {
    id: 'chest_mid',
    en: 'Mid Chest',
    name: 'Середина груди',
    short: 'Грудь',
    latin: 'Pectoralis major, pars sternocostalis',
    group: 'chest',
    weekly: [8, 16],
    about: 'Sternal head — most of the chest mass. Flat presses, pec deck, mid-height cable flyes.',
  },
  chest_lower: {
    id: 'chest_lower',
    en: 'Lower Chest',
    name: 'Низ груди',
    short: 'Низ груди',
    latin: 'Pectoralis major, pars abdominalis',
    group: 'chest',
    weekly: [4, 10],
    about: 'Lower fibres of the pec. Dips, decline presses, high-to-low crossovers.',
  },
  delts_front: {
    id: 'delts_front',
    en: 'Front Delts',
    name: 'Передняя дельта',
    short: 'Пер. дельта',
    latin: 'Deltoideus, pars clavicularis',
    group: 'shoulders',
    weekly: [4, 12],
    about: 'Works hard in every chest and overhead press — rarely needs extra isolation.',
  },
  delts_side: {
    id: 'delts_side',
    en: 'Side Delts',
    name: 'Средняя дельта',
    short: 'Ср. дельта',
    latin: 'Deltoideus, pars acromialis',
    group: 'shoulders',
    weekly: [8, 20],
    about: 'Gives shoulder width. Lateral raises (dumbbell, cable, machine), upright rows.',
  },
  delts_rear: {
    id: 'delts_rear',
    en: 'Rear Delts',
    name: 'Задняя дельта',
    short: 'Зад. дельта',
    latin: 'Deltoideus, pars spinalis',
    group: 'shoulders',
    weekly: [6, 16],
    about: 'Rear of the shoulder and joint health. Reverse pec deck, rear-delt flyes, face pulls.',
  },
  biceps: {
    id: 'biceps',
    en: 'Biceps',
    name: 'Бицепс',
    short: 'Бицепс',
    latin: 'Biceps brachii + brachialis',
    group: 'biceps',
    weekly: [8, 18],
    about: 'Biceps brachii + brachialis. Curls, hammer curls and every pulling movement.',
  },
  triceps: {
    id: 'triceps',
    en: 'Triceps',
    name: 'Трицепс',
    short: 'Трицепс',
    latin: 'Triceps brachii',
    group: 'triceps',
    weekly: [6, 16],
    about: 'Two thirds of the upper arm. The long head grows best with overhead extensions.',
  },
  forearms: {
    id: 'forearms',
    en: 'Forearms',
    name: 'Предплечья',
    short: 'Предпл.',
    latin: 'Brachioradialis, flexors / extensors',
    group: 'forearms',
    weekly: [4, 12],
    about: 'Brachioradialis and wrist flexors / extensors. Hammer and reverse curls, grip in every pull.',
  },
  traps: {
    id: 'traps',
    en: 'Traps',
    name: 'Трапеции',
    short: 'Трапеции',
    latin: 'Trapezius, pars descendens',
    group: 'traps',
    weekly: [4, 14],
    about: 'Upper trapezius. Shrugs, upright rows, deadlifts.',
  },
  upper_back: {
    id: 'upper_back',
    en: 'Upper Back',
    name: 'Верх спины',
    short: 'Верх спины',
    latin: 'Rhomboids + middle trapezius',
    group: 'back',
    weekly: [8, 16],
    about: 'Rhomboids, middle & lower traps, rotator cuff — back thickness. Wide-grip rows to the chest.',
  },
  lats: {
    id: 'lats',
    en: 'Lats',
    name: 'Широчайшие',
    short: 'Широчайшие',
    latin: 'Latissimus dorsi',
    group: 'back',
    weekly: [10, 20],
    about: 'Back width (the V-taper). Pulldowns, pull-ups, rows to the hip.',
  },
  lower_back: {
    id: 'lower_back',
    en: 'Lower Back',
    name: 'Поясница',
    short: 'Поясница',
    latin: 'Erector spinae',
    group: 'back',
    weekly: [3, 10],
    about: 'Spinal erectors. Deadlifts, back extensions, good mornings.',
  },
  abs: {
    id: 'abs',
    en: 'Abs',
    name: 'Пресс',
    short: 'Пресс',
    latin: 'Rectus abdominis',
    group: 'abs',
    weekly: [6, 16],
    about: 'Rectus abdominis. Cable crunches, crunches, leg raises.',
  },
  obliques: {
    id: 'obliques',
    en: 'Obliques',
    name: 'Косые',
    short: 'Косые',
    latin: 'Obliquus externus / internus',
    group: 'abs',
    weekly: [4, 12],
    about: 'Obliques — rotation and side bending of the trunk.',
  },
  glutes: {
    id: 'glutes',
    en: 'Glutes',
    name: 'Ягодицы',
    short: 'Ягодицы',
    latin: 'Gluteus maximus / medius',
    group: 'legs',
    weekly: [6, 16],
    about: 'Glute max & medius. Squats, lunges, hip thrusts, Romanian deadlifts.',
  },
  quads: {
    id: 'quads',
    en: 'Quads',
    name: 'Квадрицепсы',
    short: 'Квадр.',
    latin: 'Quadriceps femoris',
    group: 'legs',
    weekly: [8, 18],
    about: 'Front of the thigh. Squats, leg press, lunges, leg extensions.',
  },
  hamstrings: {
    id: 'hamstrings',
    en: 'Hamstrings',
    name: 'Бицепс бедра',
    short: 'Бицепс бедра',
    latin: 'Biceps femoris, semitendinosus',
    group: 'legs',
    weekly: [6, 16],
    about: 'Back of the thigh. Romanian deadlifts, leg curls.',
  },
  adductors: {
    id: 'adductors',
    en: 'Adductors',
    name: 'Приводящие',
    short: 'Привод.',
    latin: 'Adductor magnus / longus',
    group: 'legs',
    weekly: [3, 10],
    about: 'Inner thigh. Deep squats, sumo stance, adduction machine.',
  },
  calves: {
    id: 'calves',
    en: 'Calves',
    name: 'Икры',
    short: 'Икры',
    latin: 'Gastrocnemius + soleus',
    group: 'legs',
    weekly: [6, 16],
    about: 'Gastrocnemius (standing raises) and soleus (seated raises).',
  },
};

export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];

export const GROUPS: { id: GroupId; name: string; ru: string; muscles: MuscleId[] }[] = [
  { id: 'chest', name: 'Chest', ru: 'Грудь', muscles: ['chest_upper', 'chest_mid', 'chest_lower'] },
  { id: 'back', name: 'Back', ru: 'Спина', muscles: ['lats', 'upper_back', 'lower_back'] },
  { id: 'shoulders', name: 'Shoulders', ru: 'Плечи', muscles: ['delts_front', 'delts_side', 'delts_rear'] },
  { id: 'traps', name: 'Traps', ru: 'Трапеции', muscles: ['traps'] },
  { id: 'biceps', name: 'Biceps', ru: 'Бицепс', muscles: ['biceps'] },
  { id: 'triceps', name: 'Triceps', ru: 'Трицепс', muscles: ['triceps'] },
  { id: 'forearms', name: 'Forearms', ru: 'Предплечья', muscles: ['forearms'] },
  { id: 'abs', name: 'Abs', ru: 'Пресс', muscles: ['abs', 'obliques'] },
  { id: 'legs', name: 'Legs', ru: 'Ноги', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'] },
  { id: 'cardio', name: 'Cardio', ru: 'Кардио', muscles: [] },
];

export const GROUP_NAME: Record<GroupId, string> = Object.fromEntries(
  GROUPS.map((g) => [g.id, g.name]),
) as Record<GroupId, string>;

/** Set credit for a muscle by its share in an exercise. */
export function setCredit(share: number): number {
  if (share >= 25) return 1;
  if (share >= 10) return 0.5;
  return 0;
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** Weekly-normalized sets → heat level. */
export function heatLevel(weeklySets: number): HeatLevel {
  if (weeklySets <= 0.01) return 0;
  if (weeklySets < 6) return 1;
  if (weeklySets < 10) return 2;
  if (weeklySets <= 20) return 3;
  return 4;
}

export const HEAT_LABEL: Record<HeatLevel, string> = {
  0: 'NOT TRAINED',
  1: 'LOW',
  2: 'MODERATE',
  3: 'WELL TRAINED',
  4: 'VERY HIGH',
};

/** Heat colours: grey (none) → green (low) → orange (moderate) → red (well trained) → deep red (very high). */
export const HEAT_COLORS: Record<HeatLevel, string> = {
  0: '#2A2A2E',
  1: '#22C55E',
  2: '#F59E0B',
  3: '#EF4444',
  4: '#B3122A',
};
export const HEAT_COLORS_LIGHT: Record<HeatLevel, string> = {
  0: '#D6D1C6',
  1: '#16A34A',
  2: '#D97706',
  3: '#DC2626',
  4: '#991B1B',
};
