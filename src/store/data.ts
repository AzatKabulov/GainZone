import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Equip, LogType } from '@/data/exerciseTypes';
import type { GroupId, MuscleId } from '@/data/muscles';
import { nowIso, todayKey } from '@/lib/date';

/**
 * Local-first data store (same architecture as GrindZone).
 * Everything is written to the device instantly (AsyncStorage) and marked "dirty";
 * the sync engine (sync.ts) pushes dirty rows to Supabase and pulls remote changes.
 * Deletes are soft (tombstones) — nothing is ever erased, on the device or in the cloud.
 */

export type TableName = 'profile' | 'exercises' | 'templates' | 'workouts' | 'metrics';
export const TABLES: TableName[] = ['profile', 'exercises', 'templates', 'workouts', 'metrics'];
/** Table names in Supabase (the backend is shared with GrindZone, so GainZone tables are prefixed). */
export const REMOTE: Record<TableName, string> = {
  profile: 'gain_profile',
  exercises: 'gain_exercises',
  templates: 'gain_templates',
  workouts: 'gain_workouts',
  metrics: 'gain_metrics',
};

interface Base {
  id: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

/* ───────────── workout content (stored as jsonb) ───────────── */

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type PRKind = 'e1rm' | 'weight' | 'volume' | 'reps';

export interface SetEntry {
  id: string;
  type: SetType;
  /** kg (+kg for bodyweight moves, −kg of assistance for the assisted machine) */
  weight: number | null;
  /** reps (left side when the exercise is logged per side) */
  reps: number | null;
  /** right side reps (one-arm / one-leg exercises) */
  reps_r?: number | null;
  /** seconds (time) or minutes (cardio) */
  time?: number | null;
  /** km (cardio) */
  dist?: number | null;
  done: boolean;
  rpe?: number | null;
  /** value was prefilled from last time and not touched yet */
  auto?: boolean;
  pr?: PRKind[];
  done_at?: string | null;
}

export interface WorkoutExercise {
  id: string;
  exercise_id: string;
  rest: number;
  /** note for this exercise in this session */
  note: string;
  /** log left / right reps separately */
  split?: boolean;
  sets: SetEntry[];
}

export interface TemplateSet {
  type: SetType;
  weight: number | null;
  reps: number | null;
  reps_r?: number | null;
  time?: number | null;
  dist?: number | null;
}

export interface TemplateExercise {
  id: string;
  exercise_id: string;
  rest: number;
  /** pinned note, shown every session */
  note: string;
  split?: boolean;
  sets: TemplateSet[];
}

/* ─────────────────────────── rows ─────────────────────────── */

export interface Workout extends Base {
  template_id: string | null;
  name: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  exercises: WorkoutExercise[];
  note: string;
  /** how you felt, 1–5 */
  feeling: number | null;
  /** energy, 1–5 */
  energy: number | null;
  bodyweight: number | null;
  volume: number;
  sets_count: number;
  prs_count: number;
}

export interface Template extends Base {
  name: string;
  note: string;
  exercises: TemplateExercise[];
  sort_order: number;
  last_used_at: string | null;
}

export interface Metric extends Base {
  /** YYYY-MM-DD */
  date: string;
  weight: number | null;
  body_fat: number | null;
  waist: number | null;
  note: string;
}

export interface CustomExercise extends Base {
  name: string;
  name_ru: string;
  grp: GroupId;
  equip: Equip;
  log_type: LogType;
  muscles: Partial<Record<MuscleId, number>>;
  rest: number;
  notes: string;
}

export interface Profile extends Base {
  name: string;
  height_cm: number | null;
  birth_year: number | null;
  sex: 'm' | 'f' | null;
  goal: 'mass' | 'strength' | 'cut' | 'fit' | null;
  weekly_goal: number;
}

export interface RowMap {
  profile: Profile;
  exercises: CustomExercise;
  templates: Template;
  workouts: Workout;
  metrics: Metric;
}

type Fields<K extends TableName> = Omit<RowMap[K], keyof Base>;

const FIELDS: { [K in TableName]: () => Fields<K> } = {
  profile: () => ({ name: '', height_cm: null, birth_year: null, sex: null, goal: null, weekly_goal: 4 }),
  exercises: () => ({
    name: '',
    name_ru: '',
    grp: 'chest',
    equip: 'other',
    log_type: 'weight_reps',
    muscles: {},
    rest: 120,
    notes: '',
  }),
  templates: () => ({ name: '', note: '', exercises: [], sort_order: Date.now(), last_used_at: null }),
  workouts: () => ({
    template_id: null,
    name: '',
    started_at: nowIso(),
    ended_at: null,
    duration_sec: 0,
    exercises: [],
    note: '',
    feeling: null,
    energy: null,
    bodyweight: null,
    volume: 0,
    sets_count: 0,
    prs_count: 0,
  }),
  metrics: () => ({ date: todayKey(), weight: null, body_fat: null, waist: null, note: '' }),
};

type TablesState = { [K in TableName]: Record<string, RowMap[K]> };

interface DataState extends TablesState {
  /** `${table}:${id}` of rows not yet pushed to the server. */
  dirty: Record<string, true>;
  /** Pull cursors (raw server_updated_at of the newest row seen), per table. */
  cursors: Partial<Record<TableName, string>>;
  /** Supabase user id this local data belongs to. null = guest / not signed in yet. */
  ownerId: string | null;
  hydrated: boolean;

  create: <K extends TableName>(table: K, fields?: Partial<Fields<K>>, id?: string) => RowMap[K];
  patch: <K extends TableName>(table: K, id: string, patch: Partial<Fields<K>>) => void;
  remove: (table: TableName, id: string) => void;
  restore: (table: TableName, id: string) => void;

  mergeRemote: (table: TableName, rows: Record<string, unknown>[]) => void;
  markClean: (table: TableName, items: { id: string; updated_at: string }[]) => void;
  setCursor: (table: TableName, cursor: string) => void;
  resetFor: (ownerId: string | null) => void;
  adopt: (ownerId: string) => void;
  /** Replace everything with a backup (all rows are marked dirty so they upload). */
  importAll: (tables: Partial<TablesState>) => void;
}

const emptyTables = (): TablesState => ({ profile: {}, exercises: {}, templates: {}, workouts: {}, metrics: {} });

/** Server timestamps look like 2026-11-24T14:31:55.79129+00:00 — normalise to JS ISO. */
function normTs(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return v;
  const frac = (m[3] ?? '.000').slice(0, 4).padEnd(4, '0');
  const tz = !m[4] || m[4] === '+00:00' || m[4] === '+0000' ? 'Z' : m[4];
  return `${m[1]}T${m[2]}${frac}${tz}`;
}

const TS_FIELDS = new Set(['created_at', 'updated_at', 'started_at', 'ended_at', 'last_used_at']);
const NUM_FIELDS = new Set(['weight', 'body_fat', 'waist', 'bodyweight', 'volume', 'height_cm']);

function fromRemote<K extends TableName>(table: K, row: Record<string, unknown>): RowMap[K] {
  const out: Record<string, unknown> = { id: row.id, deleted: !!row.deleted };
  const keys = [...Object.keys(FIELDS[table]()), 'created_at', 'updated_at'];
  for (const k of keys) {
    if (!(k in row)) continue;
    let v = row[k];
    if (TS_FIELDS.has(k)) v = normTs(v);
    else if (NUM_FIELDS.has(k) && v !== null && v !== undefined) v = Number(v);
    out[k] = v;
  }
  return { ...FIELDS[table](), ...out } as unknown as RowMap[K];
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

export const uuid = () => Crypto.randomUUID();

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      ...emptyTables(),
      dirty: {},
      cursors: {},
      ownerId: null,
      hydrated: false,

      create: (table, fields, id) => {
        const now = nowIso();
        const row = {
          ...FIELDS[table](),
          ...fields,
          id: id ?? uuid(),
          created_at: now,
          updated_at: now,
          deleted: false,
        } as RowMap[typeof table];
        set((s) => ({
          [table]: { ...s[table], [row.id]: row },
          dirty: { ...s.dirty, [`${table}:${row.id}`]: true },
        }) as Partial<DataState>);
        return row;
      },

      patch: (table, id, patch) => {
        const cur = get()[table][id];
        if (!cur) return;
        // Guarantee updated_at strictly increases (last-write-wins relies on it).
        const now = Math.max(Date.now(), ms(cur.updated_at) + 1);
        const row = { ...cur, ...patch, updated_at: new Date(now).toISOString() };
        set((s) => ({
          [table]: { ...s[table], [id]: row },
          dirty: { ...s.dirty, [`${table}:${id}`]: true },
        }) as Partial<DataState>);
      },

      remove: (table, id) => {
        const cur = get()[table][id];
        if (!cur) return;
        const now = Math.max(Date.now(), ms(cur.updated_at) + 1);
        set((s) => ({
          [table]: { ...s[table], [id]: { ...cur, deleted: true, updated_at: new Date(now).toISOString() } },
          dirty: { ...s.dirty, [`${table}:${id}`]: true },
        }) as Partial<DataState>);
      },

      restore: (table, id) => {
        const cur = get()[table][id];
        if (!cur || !cur.deleted) return;
        const now = Math.max(Date.now(), ms(cur.updated_at) + 1);
        set((s) => ({
          [table]: { ...s[table], [id]: { ...cur, deleted: false, updated_at: new Date(now).toISOString() } },
          dirty: { ...s.dirty, [`${table}:${id}`]: true },
        }) as Partial<DataState>);
      },

      mergeRemote: (table, rows) => {
        if (!rows.length) return;
        set((s) => {
          const next = { ...s[table] } as Record<string, RowMap[TableName]>;
          const dirty = { ...s.dirty };
          for (const raw of rows) {
            const remote = fromRemote(table, raw);
            const key = `${table}:${remote.id}`;
            const local = next[remote.id];
            if (local && dirty[key] && ms(local.updated_at) > ms(remote.updated_at)) continue;
            if (local && ms(local.updated_at) > ms(remote.updated_at)) {
              // our copy is newer but somehow not dirty: make sure it goes up
              dirty[key] = true;
              continue;
            }
            next[remote.id] = remote;
            delete dirty[key];
          }
          return { [table]: next, dirty } as Partial<DataState>;
        });
      },

      markClean: (table, items) => {
        set((s) => {
          const dirty = { ...s.dirty };
          for (const { id, updated_at } of items) {
            if (s[table][id]?.updated_at === updated_at) delete dirty[`${table}:${id}`];
          }
          return { dirty };
        });
      },

      setCursor: (table, cursor) => set((s) => ({ cursors: { ...s.cursors, [table]: cursor } })),

      resetFor: (ownerId) => set({ ...emptyTables(), dirty: {}, cursors: {}, ownerId }),

      adopt: (ownerId) =>
        set((s) => {
          const dirty: Record<string, true> = {};
          for (const t of TABLES) for (const id of Object.keys(s[t])) dirty[`${t}:${id}`] = true;
          return { ownerId, dirty, cursors: {} };
        }),

      importAll: (tables) =>
        set((s) => {
          const dirty: Record<string, true> = { ...s.dirty };
          const patch: Partial<TablesState> = {};
          for (const t of TABLES) {
            const incoming = tables[t] as Record<string, RowMap[TableName]> | undefined;
            if (!incoming) continue;
            const next = { ...s[t] } as Record<string, RowMap[TableName]>;
            for (const [id, row] of Object.entries(incoming)) {
              const local = next[id];
              if (local && ms(local.updated_at) >= ms(row.updated_at)) continue;
              next[id] = { ...FIELDS[t](), ...row } as RowMap[TableName];
              dirty[`${t}:${id}`] = true;
            }
            (patch as Record<string, unknown>)[t] = next;
          }
          return { ...patch, dirty } as Partial<DataState>;
        }),
    }),
    {
      name: 'gain-data',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        exercises: s.exercises,
        templates: s.templates,
        workouts: s.workouts,
        metrics: s.metrics,
        dirty: s.dirty,
        cursors: s.cursors,
        ownerId: s.ownerId,
      }),
      onRehydrateStorage: () => () => {
        useData.setState({ hydrated: true });
      },
    },
  ),
);
