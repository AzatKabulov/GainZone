import type { LogType } from '@/data/exerciseTypes';
import { MUSCLE_IDS, setCredit, type MuscleId } from '@/data/muscles';
import { addDays, dateKey, startOfWeek, todayKey } from '@/lib/date';
import type { SetEntry, Workout, WorkoutExercise } from '@/store/data';
import { getExercise } from './exercise';

/* ─────────────────────────── basics ─────────────────────────── */

export const isWorking = (s: SetEntry) => s.done && s.type !== 'warmup';

/** Epley estimate of a one-rep max. */
export function e1rm(weight: number | null | undefined, reps: number | null | undefined): number {
  const w = weight ?? 0;
  const r = reps ?? 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

/** Reps of a set (left + right for one-side exercises). */
export const setReps = (s: SetEntry) => (s.reps ?? 0) + (s.reps_r ?? 0);
/** Best side's reps (used for 1RM / PRs). */
export const topReps = (s: SetEntry) => Math.max(s.reps ?? 0, s.reps_r ?? 0);

export function setVolume(s: SetEntry, type: LogType): number {
  if (!s.done || s.type === 'warmup') return 0;
  if (type === 'weight_reps' || type === 'bw_reps') return (s.weight ?? 0) * setReps(s);
  return 0;
}

export function exerciseTotals(we: WorkoutExercise) {
  const ex = getExercise(we.exercise_id);
  let sets = 0;
  let reps = 0;
  let volume = 0;
  for (const s of we.sets) {
    if (!isWorking(s)) continue;
    sets++;
    reps += setReps(s);
    volume += setVolume(s, ex.type);
  }
  return { sets, reps, volume };
}

export function workoutTotals(exercises: WorkoutExercise[]) {
  let sets = 0;
  let reps = 0;
  let volume = 0;
  let prs = 0;
  for (const we of exercises) {
    const t = exerciseTotals(we);
    sets += t.sets;
    reps += t.reps;
    volume += t.volume;
    prs += we.sets.filter((s) => s.done && s.pr?.length).length;
  }
  return { sets, reps, volume: Math.round(volume), prs };
}

/* ─────────────────────────── history ─────────────────────────── */

export function finishedWorkouts(all: Record<string, Workout>): Workout[] {
  return Object.values(all)
    .filter((w) => !w.deleted && w.ended_at && w.exercises.length > 0)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

export interface Session {
  workout: Workout;
  we: WorkoutExercise;
}

/**
 * Double progression: if every working set last time reached the target reps at the same top weight,
 * suggest the next weight step (2 kg for dumbbells, 2.5 kg otherwise).
 */
export function progressionHint(
  last: Session | null,
  ex: { type: LogType; equip: string },
  targetReps: number,
): { weight: number; from: number; sets: number; reps: number } | null {
  if (!last || ex.type !== 'weight_reps') return null;
  const work = last.we.sets.filter(isWorking);
  if (work.length < 2) return null;
  const top = Math.max(...work.map((s) => s.weight ?? 0));
  if (!top) return null;
  const atTop = work.filter((s) => (s.weight ?? 0) === top);
  if (atTop.length < 2) return null;
  const minReps = Math.min(...atTop.map((s) => Math.min(s.reps ?? 0, s.reps_r ?? s.reps ?? 0)));
  if (minReps < targetReps) return null;
  const step = ex.equip === 'dumbbell' ? 2 : 2.5;
  return { weight: Math.round((top + step) * 100) / 100, from: top, sets: atTop.length, reps: minReps };
}

/** Every session of one exercise, newest first. */
export function exerciseSessions(list: Workout[], exerciseId: string, excludeWorkoutId?: string): Session[] {
  const out: Session[] = [];
  for (const w of list) {
    if (w.id === excludeWorkoutId) continue;
    for (const we of w.exercises) {
      if (we.exercise_id === exerciseId && we.sets.some((s) => s.done)) out.push({ workout: w, we });
    }
  }
  return out;
}

export function lastSession(list: Workout[], exerciseId: string, excludeWorkoutId?: string): Session | null {
  return exerciseSessions(list, exerciseId, excludeWorkoutId)[0] ?? null;
}

/** Previous values for each set row: matched by position among sets of the same kind (warm-ups to warm-ups). */
export function previousForSets(prev: Session | null, sets: { type: SetEntry['type'] }[]): (SetEntry | null)[] {
  if (!prev) return sets.map(() => null);
  const done = prev.we.sets.filter((s) => s.done);
  const warm = done.filter((s) => s.type === 'warmup');
  const work = done.filter((s) => s.type !== 'warmup');
  let wi = 0;
  let ki = 0;
  return sets.map((s) => (s.type === 'warmup' ? (warm[wi++] ?? null) : (work[ki++] ?? null)));
}

export interface Records {
  e1rm: number;
  weight: number;
  reps: number;
  setVolume: number;
  sessionVolume: number;
  e1rmAt: string | null;
  weightAt: string | null;
}

export function exerciseRecords(sessions: Session[], type: LogType): Records {
  const r: Records = { e1rm: 0, weight: 0, reps: 0, setVolume: 0, sessionVolume: 0, e1rmAt: null, weightAt: null };
  for (const { workout, we } of sessions) {
    let vol = 0;
    for (const s of we.sets) {
      if (!isWorking(s)) continue;
      const e = e1rm(s.weight, topReps(s));
      if (e > r.e1rm) {
        r.e1rm = e;
        r.e1rmAt = workout.started_at;
      }
      if ((s.weight ?? 0) > r.weight && topReps(s) > 0) {
        r.weight = s.weight ?? 0;
        r.weightAt = workout.started_at;
      }
      if (topReps(s) > r.reps) r.reps = topReps(s);
      const v = setVolume(s, type);
      if (v > r.setVolume) r.setVolume = v;
      vol += v;
    }
    if (vol > r.sessionVolume) r.sessionVolume = vol;
  }
  return r;
}

export function recentNotes(sessions: Session[], n = 3): { date: string; text: string }[] {
  const out: { date: string; text: string }[] = [];
  for (const { workout, we } of sessions) {
    if (we.note.trim()) out.push({ date: workout.started_at, text: we.note.trim() });
    if (out.length >= n) break;
  }
  return out;
}

/** Best set of a session (by e1RM, falling back to reps/time). */
export function bestSet(we: WorkoutExercise): SetEntry | null {
  let best: SetEntry | null = null;
  let score = -1;
  for (const s of we.sets) {
    if (!isWorking(s)) continue;
    const v = e1rm(s.weight, topReps(s)) || topReps(s) || (s.time ?? 0);
    if (v > score) {
      score = v;
      best = s;
    }
  }
  return best;
}

/* ─────────────────────────── muscles ─────────────────────────── */

export interface MuscleStat {
  sets: number;
  direct: number;
  indirect: number;
  reps: number;
  volume: number;
  lastAt: string | null;
  byExercise: Record<string, number>;
}

export function emptyMuscleStats(): Record<MuscleId, MuscleStat> {
  return Object.fromEntries(
    MUSCLE_IDS.map((m) => [m, { sets: 0, direct: 0, indirect: 0, reps: 0, volume: 0, lastAt: null, byExercise: {} }]),
  ) as Record<MuscleId, MuscleStat>;
}

export function addExerciseToMuscles(stats: Record<MuscleId, MuscleStat>, we: WorkoutExercise, at: string) {
  const ex = getExercise(we.exercise_id);
  const working = we.sets.filter(isWorking);
  if (!working.length) return;
  for (const [mid, pct] of Object.entries(ex.m) as [MuscleId, number][]) {
    const credit = setCredit(pct);
    if (!credit) continue;
    const st = stats[mid];
    const n = working.length * credit;
    st.sets += n;
    if (credit === 1) st.direct += working.length;
    else st.indirect += working.length;
    for (const s of working) {
      st.reps += setReps(s) * credit;
      st.volume += setVolume(s, ex.type) * (pct / 100);
    }
    if (!st.lastAt || at > st.lastAt) st.lastAt = at;
    st.byExercise[we.exercise_id] = (st.byExercise[we.exercise_id] ?? 0) + working.length;
  }
}

/** Sets per muscle over the last `days` days (0 = all time). */
export function muscleStats(list: Workout[], days: number): Record<MuscleId, MuscleStat> {
  const stats = emptyMuscleStats();
  const since = days > 0 ? Date.now() - days * 86400000 : 0;
  for (const w of list) {
    if (Date.parse(w.started_at) < since) continue;
    for (const we of w.exercises) addExerciseToMuscles(stats, we, w.started_at);
  }
  return stats;
}

/** Number of weeks covered by a period (for weekly normalisation of the heat map). */
export function periodWeeks(list: Workout[], days: number): number {
  if (days > 0) return Math.max(1, days / 7);
  if (!list.length) return 1;
  const first = Date.parse(list[list.length - 1].started_at);
  return Math.max(1, (Date.now() - first) / (7 * 86400000));
}

/* ─────────────────────────── weeks & streaks ─────────────────────────── */

export interface WeekPoint {
  week: string;
  workouts: number;
  volume: number;
  sets: number;
  minutes: number;
}

export function weeklySeries(list: Workout[], weeks = 12): WeekPoint[] {
  const thisWeek = startOfWeek(todayKey());
  const points: WeekPoint[] = Array.from({ length: weeks }, (_, i) => ({
    week: addDays(thisWeek, -7 * (weeks - 1 - i)),
    workouts: 0,
    volume: 0,
    sets: 0,
    minutes: 0,
  }));
  const idx = new Map(points.map((p, i) => [p.week, i]));
  for (const w of list) {
    const wk = startOfWeek(dateKey(new Date(w.started_at)));
    const i = idx.get(wk);
    if (i === undefined) continue;
    points[i].workouts++;
    points[i].volume += w.volume;
    points[i].sets += w.sets_count;
    points[i].minutes += Math.round(w.duration_sec / 60);
  }
  return points;
}

/** Consecutive weeks (Monday-based) with at least one workout; this week counts once it has one. */
export function weekStreak(list: Workout[]): number {
  const weeks = new Set(list.map((w) => startOfWeek(dateKey(new Date(w.started_at)))));
  let wk = startOfWeek(todayKey());
  if (!weeks.has(wk)) wk = addDays(wk, -7);
  let n = 0;
  while (weeks.has(wk)) {
    n++;
    wk = addDays(wk, -7);
  }
  return n;
}

export function workoutsByDay(list: Workout[]): Record<string, Workout[]> {
  const out: Record<string, Workout[]> = {};
  for (const w of list) (out[dateKey(new Date(w.started_at))] ??= []).push(w);
  return out;
}

/* ─────────────────────────── formatting ─────────────────────────── */

export function fmtKg(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const r = Math.round(v * 100) / 100;
  return `${Number.isInteger(r) ? r : r.toFixed(r * 10 === Math.round(r * 10) ? 1 : 2)}`;
}

export function fmtVolume(v: number): string {
  if (v >= 100000) return `${Math.round(v / 1000)}K`;
  if (v >= 10000) return `${(v / 1000).toFixed(1)}K`;
  return `${Math.round(v).toLocaleString('en-US')}`;
}

/** 3725 → '1H 02M'; 59 → '0:59' */
export function fmtElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Workout length for labels: '1H 05M', '45M', '<1M'. */
export function fmtDur(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 1) return '<1M';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h) return `${h}H ${String(r).padStart(2, '0')}M`;
  return `${r}M`;
}

/** '9' or '9/10' (left/right). */
export function fmtReps(s: { reps: number | null; reps_r?: number | null }): string {
  return s.reps_r !== null && s.reps_r !== undefined ? `${s.reps ?? 0}/${s.reps_r}` : `${s.reps ?? 0}`;
}

export function fmtSetValue(s: SetEntry, type: LogType): string {
  if (type === 'time') return `${s.time ?? 0}s`;
  if (type === 'cardio') return `${s.time ?? 0} min${s.dist ? ` · ${fmtKg(s.dist)} km` : ''}`;
  if (type === 'bw_reps') return s.weight ? `+${fmtKg(s.weight)}kg × ${fmtReps(s)}` : `${fmtReps(s)} reps`;
  if (type === 'assisted') return `−${fmtKg(s.weight)}kg × ${fmtReps(s)}`;
  if (s.weight === null || s.weight === undefined) return `${fmtReps(s)} reps`;
  return `${fmtKg(s.weight)}kg × ${fmtReps(s)}`;
}

export const FEELINGS = [
  { v: 1, emoji: '😫', label: 'DEAD' },
  { v: 2, emoji: '😕', label: 'WEAK' },
  { v: 3, emoji: '😐', label: 'OK' },
  { v: 4, emoji: '💪', label: 'STRONG' },
  { v: 5, emoji: '🔥', label: 'BEAST' },
];
