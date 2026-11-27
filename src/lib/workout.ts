import { router } from 'expo-router';

import type { ExerciseDef } from '@/data/exerciseTypes';
import { patchWorkout, useActive, type ActiveWorkout } from '@/store/active';
import {
  useData,
  uuid,
  type PRKind,
  type SetEntry,
  type SetType,
  type Template,
  type TemplateExercise,
  type WorkoutExercise,
} from '@/store/data';
import { useFx } from '@/store/fx';
import { useSettings } from '@/store/settings';
import { nowIso } from './date';
import { exName, getExercise } from './exercise';
import { haptic } from './haptics';
import { openMenu } from './menu';
import { linkWithNext, normalizeSupersets, unlink } from './superset';
import { skipRest, startRest, warmUpAudio } from './rest';
import {
  e1rm,
  exerciseRecords,
  exerciseSessions,
  finishedWorkouts,
  fmtKg,
  isWorking,
  lastSession,
  previousForSets,
  topReps,
  workoutTotals,
} from './stats';

const history = () => finishedWorkouts(useData.getState().workouts);

const blankSet = (type: SetType = 'normal'): SetEntry => ({
  id: uuid(),
  type,
  weight: null,
  reps: null,
  time: null,
  dist: null,
  done: false,
});

/** A fresh exercise block, prefilled with what you did last time (or the routine's targets). */
export function buildExercise(exerciseId: string, tpl?: TemplateExercise): WorkoutExercise {
  const ex = getExercise(exerciseId);
  const prefill = useSettings.getState().prefill;
  const prev = lastSession(history(), exerciseId);
  const shape: { type: SetType; t?: TemplateExercise['sets'][number] }[] = tpl?.sets.length
    ? tpl.sets.map((t) => ({ type: t.type, t }))
    : prev
      ? prev.we.sets.filter((s) => s.done).map((s) => ({ type: s.type }))
      : [{ type: 'normal' }, { type: 'normal' }, { type: 'normal' }];
  const prevs = previousForSets(prev, shape);
  const split = tpl?.split ?? prev?.we.split ?? !!ex.uni;
  const sets = shape.map(({ type, t }, i) => {
    const p = prevs[i];
    const s = blankSet(type);
    if (prefill && p) {
      s.weight = p.weight;
      s.reps = p.reps;
      s.reps_r = split ? (p.reps_r ?? p.reps) : null;
      s.time = p.time ?? null;
      s.dist = p.dist ?? null;
      s.auto = true;
    } else if (t) {
      s.weight = t.weight;
      s.reps = t.reps;
      s.reps_r = split ? (t.reps_r ?? t.reps) : null;
      s.time = t.time ?? null;
      s.dist = t.dist ?? null;
      s.auto = t.weight !== null || t.reps !== null;
    }
    return s;
  });
  return {
    id: uuid(),
    exercise_id: exerciseId,
    rest: tpl?.rest ?? (ex.rest || useSettings.getState().defaultRest),
    note: '',
    split,
    superset: tpl?.superset ?? null,
    sets,
  };
}

/** Start a new session with the same exercises as a past one ("repeat workout"). */
export function startWorkoutFrom(name: string, exercises: TemplateExercise[]): boolean {
  if (useActive.getState().workout) return false;
  useActive.setState({
    workout: {
      id: uuid(),
      template_id: null,
      name,
      started_at: nowIso(),
      exercises: exercises.map((te) => buildExercise(te.exercise_id, te)),
      note: '',
    },
    rest: null,
  });
  warmUpAudio();
  haptic.medium();
  return true;
}

export function startWorkout(templateId: string | null = null): boolean {
  if (useActive.getState().workout) return false;
  const tpl: Template | undefined = templateId ? useData.getState().templates[templateId] : undefined;
  const w: ActiveWorkout = {
    id: uuid(),
    template_id: tpl?.id ?? null,
    name: tpl?.name ?? defaultName(),
    started_at: nowIso(),
    exercises: tpl ? tpl.exercises.map((te) => buildExercise(te.exercise_id, te)) : [],
    note: '',
  };
  useActive.setState({ workout: w, rest: null });
  if (tpl) useData.getState().patch('templates', tpl.id, { last_used_at: w.started_at });
  warmUpAudio();
  haptic.medium();
  return true;
}

function defaultName(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

/* ─────────────────────────── edits ─────────────────────────── */

const mapEx = (weId: string, fn: (we: WorkoutExercise) => WorkoutExercise) =>
  patchWorkout((w) => ({ ...w, exercises: w.exercises.map((we) => (we.id === weId ? fn(we) : we)) }));

export const renameWorkout = (name: string) => patchWorkout((w) => ({ ...w, name }));

/** Set how long the live workout has been going (moves its start time). */
export function setLiveDuration(seconds: number) {
  patchWorkout((w) => ({ ...w, started_at: new Date(Date.now() - Math.max(0, seconds) * 1000).toISOString() }));
  haptic.light();
}

/** Fix the length of a saved workout (keeps its start, moves its end). */
export function setSavedDuration(workoutId: string, seconds: number) {
  const w = useData.getState().workouts[workoutId];
  if (!w) return;
  const sec = Math.max(60, seconds);
  useData.getState().patch('workouts', workoutId, {
    duration_sec: sec,
    ended_at: new Date(Date.parse(w.started_at) + sec * 1000).toISOString(),
  });
  haptic.light();
}
export const setWorkoutNote = (note: string) => patchWorkout((w) => ({ ...w, note }));

export function addExercises(ids: string[]) {
  patchWorkout((w) => ({ ...w, exercises: [...w.exercises, ...ids.map((id) => buildExercise(id))] }));
}

export function replaceExercise(weId: string, exerciseId: string) {
  mapEx(weId, (we) => {
    const fresh = buildExercise(exerciseId);
    return { ...fresh, id: we.id, note: we.note, sets: fresh.sets.length ? fresh.sets : we.sets };
  });
}

export function removeExercise(weId: string) {
  patchWorkout((w) => ({ ...w, exercises: normalizeSupersets(w.exercises.filter((we) => we.id !== weId)) }));
}

export function moveExercise(weId: string, dir: -1 | 1) {
  patchWorkout((w) => {
    const i = w.exercises.findIndex((we) => we.id === weId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= w.exercises.length) return w;
    const list = [...w.exercises];
    [list[i], list[j]] = [list[j], list[i]];
    return { ...w, exercises: normalizeSupersets(list) };
  });
}

/** Superset this exercise with the one below it (or leave its superset). */
export function setSuperset(weId: string, join: boolean) {
  patchWorkout((w) => {
    const i = w.exercises.findIndex((we) => we.id === weId);
    return { ...w, exercises: join ? linkWithNext(w.exercises, i) : unlink(w.exercises, i) };
  });
  haptic.tap();
}

export const setExerciseNote = (weId: string, note: string) => mapEx(weId, (we) => ({ ...we, note }));

/** Switch an exercise between one reps field and separate left / right reps. */
export function setSplit(weId: string, split: boolean) {
  mapEx(weId, (we) => ({
    ...we,
    split,
    sets: we.sets.map((s) => ({ ...s, reps_r: split ? (s.reps_r ?? s.reps) : null })),
  }));
}
export const setExerciseRest = (weId: string, rest: number) => mapEx(weId, (we) => ({ ...we, rest }));

export function addSet(weId: string) {
  mapEx(weId, (we) => {
    const last = we.sets[we.sets.length - 1];
    const s = blankSet(last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal'));
    if (last) {
      s.weight = last.weight;
      s.reps = last.reps;
      s.reps_r = we.split ? (last.reps_r ?? last.reps) : null;
      s.time = last.time ?? null;
      s.dist = last.dist ?? null;
      s.auto = true;
    }
    return { ...we, sets: [...we.sets, s] };
  });
  haptic.light();
}

export function removeSet(weId: string, setId: string) {
  const we = useActive.getState().workout?.exercises.find((x) => x.id === weId);
  const at = we?.sets.findIndex((s) => s.id === setId) ?? -1;
  if (!we || at < 0) return;
  const removed = we.sets[at];
  mapEx(weId, (x) => ({ ...x, sets: x.sets.filter((s) => s.id !== setId) }));
  haptic.warning();
  useFx.getState().info('SET DELETED', 'Tap to undo', {
    icon: 'undo',
    onPress: () =>
      mapEx(weId, (x) => (x.sets.some((s) => s.id === setId) ? x : { ...x, sets: [...x.sets.slice(0, at), removed, ...x.sets.slice(at)] })),
  });
}

export function updateSet(weId: string, setId: string, patch: Partial<SetEntry>) {
  mapEx(weId, (we) => ({
    ...we,
    sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch, auto: false } : s)),
  }));
}

const TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
export function cycleSetType(weId: string, setId: string) {
  mapEx(weId, (we) => ({
    ...we,
    sets: we.sets.map((s) =>
      s.id === setId ? { ...s, type: TYPE_CYCLE[(TYPE_CYCLE.indexOf(s.type) + 1) % TYPE_CYCLE.length] } : s,
    ),
  }));
}

/** Tick a set: records PRs, starts the rest timer, and rewards you. */
/** Tick one set (filling sensible defaults into empty fields) and work out its PRs. No haptics / rest. */
function markDone(weId: string, setId: string): { done: SetEntry; pr: string[] } | null {
  const w = useActive.getState().workout;
  const we = w?.exercises.find((x) => x.id === weId);
  const set = we?.sets.find((s) => s.id === setId);
  if (!w || !we || !set) return null;
  const ex = getExercise(we.exercise_id);
  // Empty fields: fall back to sensible values so a tap is always enough.
  const filled: Partial<SetEntry> = {};
  if (ex.type === 'time' || ex.type === 'cardio') {
    if (!set.time) filled.time = ex.type === 'time' ? 60 : 10;
  } else {
    if (!set.reps) filled.reps = set.reps_r || 10;
    if (we.split && !set.reps_r) filled.reps_r = filled.reps ?? set.reps ?? 10;
  }
  const done = { ...set, ...filled, done: true, done_at: nowIso() };
  const pr = detectPR(we.exercise_id, ex, done, w);
  mapEx(weId, (x) => ({ ...x, sets: x.sets.map((s) => (s.id === setId ? { ...done, pr, auto: false } : s)) }));
  return { done, pr };
}

const hasValue = (s: SetEntry) => !!(s.weight || s.reps || s.reps_r || s.time || s.dist);

/** Unticked sets the user typed numbers into (prefilled suggestions don't count). */
export function filledUnticked(): number {
  const w = useActive.getState().workout;
  return (w?.exercises ?? []).reduce((a, we) => a + we.sets.filter((s) => !s.done && !s.auto && hasValue(s)).length, 0);
}

/** Tick every set that has numbers typed in (used when finishing). */
export function completeFilledSets() {
  const w = useActive.getState().workout;
  for (const we of w?.exercises ?? []) for (const s of we.sets) if (!s.done && !s.auto && hasValue(s)) markDone(we.id, s.id);
}

export function toggleSet(weId: string, setId: string) {
  const w = useActive.getState().workout;
  const we = w?.exercises.find((x) => x.id === weId);
  const set = we?.sets.find((s) => s.id === setId);
  if (!w || !we || !set) return;
  const ex = getExercise(we.exercise_id);

  if (set.done) {
    mapEx(weId, (x) => ({ ...x, sets: x.sets.map((s) => (s.id === setId ? { ...s, done: false, pr: [], done_at: null } : s)) }));
    haptic.light();
    return;
  }

  const { done, pr } = markDone(weId, setId)!;

  if (pr.length) {
    haptic.celebrate();
    const best = e1rm(done.weight, topReps(done));
    useFx.getState().info(
      'NEW PERSONAL RECORD',
      pr.includes('e1rm')
        ? `${exName(ex)} — best 1RM ${fmtKg(Math.round(best * 100) / 100)} kg`
        : pr.includes('weight')
          ? `${exName(ex)} — heaviest set ${fmtKg(done.weight)} kg`
          : `${exName(ex)} — most reps: ${topReps(done)}`,
      { icon: 'trophy', ms: 3800 },
    );
  } else {
    haptic.success();
  }

  // rest timer — skip for the very last set of the last exercise, and between exercises of a superset
  const isLastSet = we.sets.every((s) => s.id === setId || s.done);
  const isLastEx = w.exercises[w.exercises.length - 1]?.id === weId;
  const idx = w.exercises.findIndex((x) => x.id === weId);
  const midSuperset = !!we.superset && w.exercises[idx + 1]?.superset === we.superset;
  if (midSuperset && done.type !== 'warmup') {
    // straight on to the next exercise of the superset
  } else if (!(isLastSet && isLastEx) && done.type !== 'warmup' && we.rest > 0) {
    startRest(we.rest, weId, exName(ex));
  } else if (done.type === 'warmup' && we.rest > 0) {
    startRest(Math.min(60, we.rest), weId, exName(ex));
  }
}

function detectPR(exerciseId: string, ex: ExerciseDef, s: SetEntry, w: ActiveWorkout): PRKind[] {
  if (s.type === 'warmup' || ex.type === 'time' || ex.type === 'cardio' || ex.type === 'assisted') return [];
  const sessions = exerciseSessions(history(), exerciseId, w.id);
  if (!sessions.length) return [];
  const rec = exerciseRecords(sessions, ex.type);
  // sets already done today count too
  for (const we of w.exercises) {
    if (we.exercise_id !== exerciseId) continue;
    for (const x of we.sets) {
      if (!isWorking(x) || x.id === s.id) continue;
      rec.e1rm = Math.max(rec.e1rm, e1rm(x.weight, topReps(x)));
      if (topReps(x) > 0) rec.weight = Math.max(rec.weight, x.weight ?? 0);
      rec.reps = Math.max(rec.reps, topReps(x));
    }
  }
  const out: PRKind[] = [];
  const e = e1rm(s.weight, topReps(s));
  if (ex.type === 'bw_reps' && !(s.weight ?? 0)) {
    if (topReps(s) > rec.reps && rec.reps > 0) out.push('reps');
    return out;
  }
  if (e > rec.e1rm + 0.01 && rec.e1rm > 0) out.push('e1rm');
  if ((s.weight ?? 0) > rec.weight && rec.weight > 0) out.push('weight');
  return out;
}

/* ─────────────────────────── finish ─────────────────────────── */

export interface FinishCheck {
  unfinished: number;
  doneSets: number;
}

export function finishCheck(): FinishCheck {
  const w = useActive.getState().workout;
  if (!w) return { unfinished: 0, doneSets: 0 };
  let unfinished = 0;
  let doneSets = 0;
  for (const we of w.exercises)
    for (const s of we.sets) {
      if (s.done) doneSets++;
      else unfinished++;
    }
  return { unfinished, doneSets };
}

/** Save the session to history (unticked sets are dropped). Returns the saved workout id. */
export function finishWorkout(): string | null {
  const w = useActive.getState().workout;
  if (!w) return null;
  const exercises = w.exercises
    .map((we) => ({ ...we, sets: we.sets.filter((s) => s.done).map(({ auto: _auto, ...s }) => s) }))
    .filter((we) => we.sets.length);
  const totals = workoutTotals(exercises);
  const ended = nowIso();
  const lastMetric = Object.values(useData.getState().metrics)
    .filter((m) => !m.deleted && m.weight)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  useData.getState().create(
    'workouts',
    {
      template_id: w.template_id,
      name: w.name.trim() || 'Workout',
      started_at: w.started_at,
      ended_at: ended,
      duration_sec: Math.round((Date.parse(ended) - Date.parse(w.started_at)) / 1000),
      exercises,
      note: w.note,
      volume: totals.volume,
      sets_count: totals.sets,
      prs_count: totals.prs,
      bodyweight: lastMetric?.weight ?? null,
    },
    w.id,
  );
  skipRest();
  useActive.setState({ workout: null, rest: null });
  return w.id;
}

/**
 * Start a workout and open it. If another one is still running, ask first: resume it, or discard it and
 * start the new one (never silently replace or silently resume).
 */
export function startOrAsk(start: () => void, opts: { replace?: boolean } = {}) {
  const live = useActive.getState().workout;
  const open = () => (opts.replace ? router.replace('/workout') : router.push('/workout'));
  const go = () => {
    start();
    open();
  };
  if (!live) return go();
  openMenu(`"${live.name}" is still running`, [
    { label: 'Resume it', onPress: open },
    {
      label: 'Discard it & start new',
      destructive: true,
      onPress: () => {
        discardWorkout();
        go();
      },
    },
  ]);
}

export function discardWorkout() {
  skipRest();
  useActive.setState({ workout: null, rest: null });
  haptic.warning();
}

/* ─────────────────────────── routines ─────────────────────────── */

export function templateFromExercises(list: WorkoutExercise[]): TemplateExercise[] {
  return list.map((we) => ({
    id: uuid(),
    exercise_id: we.exercise_id,
    rest: we.rest,
    note: '',
    split: we.split,
    superset: we.superset ?? null,
    sets: we.sets.map((s) => ({ type: s.type, weight: s.weight, reps: s.reps, reps_r: s.reps_r ?? null, time: s.time ?? null, dist: s.dist ?? null })),
  }));
}

/** Overwrite a routine's exercises/sets with what was just done (keeps pinned notes). */
export function updateTemplateFromWorkout(templateId: string, workoutId: string) {
  const t = useData.getState().templates[templateId];
  const w = useData.getState().workouts[workoutId];
  if (!t || !w) return;
  const notes = new Map(t.exercises.map((e) => [e.exercise_id, e.note]));
  const exercises = templateFromExercises(w.exercises).map((e) => ({ ...e, note: notes.get(e.exercise_id) ?? '' }));
  useData.getState().patch('templates', templateId, { exercises });
}

export function routineChanged(templateId: string | null, workoutId: string): boolean {
  if (!templateId) return false;
  const t = useData.getState().templates[templateId];
  const w = useData.getState().workouts[workoutId];
  if (!t || !w) return false;
  const a = t.exercises.map((e) => `${e.exercise_id}:${e.sets.length}`).join('|');
  const b = w.exercises.map((e) => `${e.exercise_id}:${e.sets.length}`).join('|');
  return a !== b;
}

export function duplicateTemplate(id: string) {
  const t = useData.getState().templates[id];
  if (!t) return;
  useData.getState().create('templates', {
    name: `${t.name} (copy)`,
    note: t.note,
    exercises: t.exercises.map((e) => ({ ...e, id: uuid() })),
    sort_order: Date.now(),
  });
}

export function pinnedNote(templateId: string | null, exerciseId: string): string {
  if (!templateId) return '';
  return useData.getState().templates[templateId]?.exercises.find((e) => e.exercise_id === exerciseId)?.note ?? '';
}
