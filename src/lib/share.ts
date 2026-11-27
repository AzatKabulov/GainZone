import { Share } from 'react-native';

import type { Workout } from '@/store/data';
import { exName, getExercise } from './exercise';
import { fmtDur, fmtSetValue, fmtVolume, isWorking } from './stats';

/** Plain-text summary of a workout for the iOS share sheet (Messages, Telegram, notes…). */
export function workoutText(w: Workout): string {
  const d = new Date(w.started_at);
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const lines = [`🏋️ ${w.name} — ${date}`, `${fmtDur(w.duration_sec).toLowerCase()} · ${fmtVolume(w.volume)} kg · ${w.sets_count} sets${w.prs_count ? ` · ${w.prs_count} PR 🏆` : ''}`, ''];
  for (const we of w.exercises) {
    const ex = getExercise(we.exercise_id);
    const sets = we.sets.filter(isWorking);
    if (!sets.length) continue;
    lines.push(`${exName(ex)}`);
    lines.push(`  ${sets.map((s) => fmtSetValue(s, ex.type) + (s.pr?.length ? ' 🏆' : '')).join(', ')}`);
  }
  if (w.note) lines.push('', w.note);
  lines.push('', '— GainZone');
  return lines.join('\n');
}

export async function shareWorkout(w: Workout) {
  try {
    await Share.share({ message: workoutText(w) });
  } catch {
    // user cancelled / not available
  }
}
