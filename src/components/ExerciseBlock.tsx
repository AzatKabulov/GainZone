import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { ExerciseDef } from '@/data/exerciseTypes';
import { exAltName, LOG_COLS, useExercise, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { openMenu } from '@/lib/menu';
import { setPickHandler } from '@/lib/pick';
import {
  finishedWorkouts,
  fmtKg,
  previousForSets,
  progressionHint,
  recentNotes,
  exerciseSessions,
} from '@/lib/stats';
import {
  addSet,
  cycleSetType,
  moveExercise,
  pinnedNote,
  removeExercise,
  removeSet,
  replaceExercise,
  setExerciseNote,
  setExerciseRest,
  toggleSet,
  updateSet,
} from '@/lib/workout';
import { useData, type SetEntry, type WorkoutExercise } from '@/store/data';
import { alpha, fonts, useTheme } from '@/theme';
import { Checkbox } from './Checkbox';
import { ExerciseThumb } from './kit';
import { Press, Txt } from './ui';

export const KB_ACCESSORY = 'gain-kb';

export const REST_PRESETS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
export const fmtRest = (s: number) => (s === 0 ? 'OFF' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

const SET_LABEL: Record<SetEntry['type'], string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };

/** One exercise in the live workout: notes from last time, hint, the set table. */
export const ExerciseBlock = memo(function ExerciseBlock({
  we,
  workoutId,
  templateId,
  index,
  count,
}: {
  we: WorkoutExercise;
  workoutId: string;
  templateId: string | null;
  index: number;
  count: number;
}) {
  const { c, accent, isDark } = useTheme();
  const ex = useExercise(we.exercise_id);
  const exName = useExName();
  const workouts = useData((s) => s.workouts);
  const sessions = useMemo(() => exerciseSessions(finishedWorkouts(workouts), we.exercise_id, workoutId), [workouts, we.exercise_id, workoutId]);
  const prev = sessions[0] ?? null;
  const prevs = useMemo(() => previousForSets(prev, we.sets), [prev, we.sets]);
  const notes = useMemo(() => recentNotes(sessions, 3), [sessions]);
  const pinned = pinnedNote(templateId, we.exercise_id);
  const hint = progressionHint(prev, ex);
  const [noteOpen, setNoteOpen] = useState(!!we.note);
  const cols = LOG_COLS[ex.type];
  const single = ex.type === 'time';
  let workIdx = 0;

  const menu = () =>
    openMenu(exName(ex), [
      { label: 'Exercise details & history', onPress: () => router.push(`/exercise/${ex.id}`) },
      {
        label: 'Replace exercise',
        onPress: () => {
          setPickHandler((ids) => replaceExercise(we.id, ids[0]), { multi: false, title: 'REPLACE EXERCISE' });
          router.push('/pick');
        },
      },
      ...(index > 0 ? [{ label: 'Move up', onPress: () => moveExercise(we.id, -1) }] : []),
      ...(index < count - 1 ? [{ label: 'Move down', onPress: () => moveExercise(we.id, 1) }] : []),
      { label: 'Remove exercise', destructive: true, onPress: () => removeExercise(we.id) },
    ]);

  const restMenu = () =>
    openMenu(
      'Rest timer',
      REST_PRESETS.map((s) => ({ label: s === 0 ? 'Off' : fmtRest(s) + (s === we.rest ? '  ✓' : ''), onPress: () => setExerciseRest(we.id, s) })),
    );

  return (
    <View style={{ paddingTop: 18 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 }}>
        <Press scaleTo={0.94} onPress={() => router.push(`/exercise/${ex.id}`)}>
          <ExerciseThumb ex={ex} size={44} />
        </Press>
        <Press style={{ flex: 1 }} scaleTo={0.98} onPress={() => router.push(`/exercise/${ex.id}`)}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 21, color: accent }}>
            {exName(ex)}
          </Text>
          <Txt variant="small" color={c.textFaint} numberOfLines={1}>
            {exAltName(ex)}
          </Txt>
        </Press>
        <Press hitSlop={10} onPress={menu} scaleTo={0.9} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-vertical" size={20} color={c.textDim} />
        </Press>
      </View>

      {/* chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 12, flexWrap: 'wrap' }}>
        <MiniChip icon="timer-outline" label={`REST ${fmtRest(we.rest)}`} onPress={restMenu} active={we.rest > 0} />
        <MiniChip icon="create-outline" label={we.note ? 'NOTE ✓' : 'NOTE'} onPress={() => setNoteOpen((v) => !v)} active={!!we.note} />
      </View>

      {pinned ? (
        <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, backgroundColor: alpha(accent, 0.08), borderWidth: 1, borderColor: alpha(accent, 0.3) }}>
          <Ionicons name="pin" size={14} color={accent} style={{ marginTop: 2 }} />
          <Txt variant="small" style={{ flex: 1 }}>
            {pinned}
          </Txt>
        </View>
      ) : null}

      {notes.length ? (
        <View style={{ marginHorizontal: 20, marginTop: 10, gap: 6 }}>
          <Txt variant="label" style={{ fontSize: 9.5 }}>
            LAST NOTES
          </Txt>
          {notes.map((n, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Txt variant="mono" color={c.textFaint} style={{ fontSize: 11, width: 46 }}>
                {new Date(n.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ flex: 1 }}>
                {n.text}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {noteOpen ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ marginHorizontal: 20, marginTop: 10 }}>
          <TextInput
            value={we.note}
            onChangeText={(t) => setExerciseNote(we.id, t)}
            placeholder="How did it feel? Seat 4, grip, cues…"
            placeholderTextColor={c.textFaint}
            selectionColor={accent}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            multiline
            style={{
              backgroundColor: c.surface2,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontFamily: fonts.body,
              fontSize: 14.5,
              color: c.text,
              minHeight: 44,
            }}
          />
        </Animated.View>
      ) : null}

      {hint ? (
        <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="trending-up" size={14} color={accent} />
          <Txt variant="label" color={c.text} style={{ fontSize: 10 }}>
            {hint}
          </Txt>
        </View>
      ) : null}

      {/* table header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 14, marginBottom: 6 }}>
        <Txt variant="label" style={{ width: 40, fontSize: 9.5 }}>
          SET
        </Txt>
        <Txt variant="label" style={{ flex: 1, fontSize: 9.5 }}>
          PREVIOUS
        </Txt>
        {!single ? (
          <Txt variant="label" style={{ width: 74, textAlign: 'center', fontSize: 9.5 }}>
            {cols[0]}
          </Txt>
        ) : null}
        <Txt variant="label" style={{ width: 66, textAlign: 'center', fontSize: 9.5, marginLeft: 8 }}>
          {cols[1]}
        </Txt>
        <View style={{ width: 44, alignItems: 'flex-end' }}>
          <Ionicons name="checkmark" size={15} color={c.textFaint} />
        </View>
      </View>

      {we.sets.map((s, i) => {
        const label = s.type === 'normal' ? String(++workIdx) : SET_LABEL[s.type];
        return (
          <Animated.View key={s.id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition.springify().damping(18)}>
            <SetRow weId={we.id} s={s} label={label} prev={prevs[i]} ex={ex} />
          </Animated.View>
        );
      })}

      <Press
        tapHaptic
        scaleTo={0.98}
        onPress={() => addSet(we.id)}
        style={{ marginHorizontal: 20, marginTop: 8, height: 40, borderRadius: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Ionicons name="add" size={16} color={c.text} />
        <Text style={{ fontFamily: fonts.display, fontSize: 17, letterSpacing: 1.2, color: c.text, marginTop: 2 }}>ADD SET</Text>
      </Press>
    </View>
  );
});

function MiniChip({ icon, label, onPress, active }: { icon: 'timer-outline' | 'create-outline'; label: string; onPress: () => void; active?: boolean }) {
  const { c, accent } = useTheme();
  return (
    <Press
      tapHaptic
      onPress={onPress}
      style={{
        height: 30,
        paddingHorizontal: 10,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: active ? alpha(accent, 0.5) : c.border,
        backgroundColor: active ? alpha(accent, 0.1) : c.surface2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={13} color={active ? accent : c.textDim} />
      <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: active ? c.text : c.textDim }}>{label}</Text>
    </Press>
  );
}

function prevText(p: SetEntry | null, ex: ExerciseDef): string {
  if (!p) return '—';
  if (ex.type === 'time') return `${p.time ?? 0}s`;
  if (ex.type === 'cardio') return `${p.time ?? 0}′ · ${fmtKg(p.dist ?? 0)}km`;
  if (ex.type === 'bw_reps') return p.weight ? `+${fmtKg(p.weight)} × ${p.reps ?? 0}` : `BW × ${p.reps ?? 0}`;
  if (ex.type === 'assisted') return `−${fmtKg(p.weight)} × ${p.reps ?? 0}`;
  return `${fmtKg(p.weight)}kg × ${p.reps ?? 0}`;
}

const SetRow = memo(function SetRow({ weId, s, label, prev, ex }: { weId: string; s: SetEntry; label: string; prev: SetEntry | null; ex: ExerciseDef }) {
  const { c, accent } = useTheme();
  const single = ex.type === 'time';
  const isPR = !!s.pr?.length && s.done;
  const field1: keyof SetEntry = ex.type === 'cardio' ? 'time' : 'weight';
  const field2: keyof SetEntry = ex.type === 'cardio' ? 'dist' : ex.type === 'time' ? 'time' : 'reps';
  const typeColor = s.type === 'warmup' ? '#F59E0B' : s.type === 'drop' ? '#60A5FA' : s.type === 'failure' ? c.danger : c.text;

  const setMenu = () =>
    openMenu(`Set ${label}`, [
      { label: 'Normal set', onPress: () => updateSet(weId, s.id, { type: 'normal' }) },
      { label: 'Warm-up (W)', onPress: () => updateSet(weId, s.id, { type: 'warmup' }) },
      { label: 'Drop set (D)', onPress: () => updateSet(weId, s.id, { type: 'drop' }) },
      { label: 'To failure (F)', onPress: () => updateSet(weId, s.id, { type: 'failure' }) },
      { label: 'Delete set', destructive: true, onPress: () => removeSet(weId, s.id) },
    ]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 5,
        backgroundColor: s.done ? alpha(accent, 0.09) : 'transparent',
      }}
    >
      <Press
        onPress={() => {
          haptic.tap();
          cycleSetType(weId, s.id);
        }}
        onLongPress={setMenu}
        scaleTo={0.9}
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: isPR ? alpha('#F5C542', 0.18) : c.surface2,
          borderWidth: 1,
          borderColor: isPR ? '#F5C542' : c.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
        }}
      >
        {isPR ? (
          <Ionicons name="trophy" size={14} color="#F5C542" />
        ) : (
          <Text style={{ fontFamily: fonts.display, fontSize: 17, color: typeColor, marginTop: 2 }}>{label}</Text>
        )}
      </Press>
      <Press style={{ flex: 1 }} onPress={setMenu} scaleTo={1}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.mono, fontSize: 12, color: c.textFaint, letterSpacing: 0.2 }}>
          {prevText(prev, ex)}
        </Text>
      </Press>
      {!single ? (
        <NumField
          value={s[field1] as number | null}
          auto={!!s.auto}
          done={s.done}
          decimal
          step={ex.type === 'cardio' ? 1 : 2.5}
          onChange={(v) => updateSet(weId, s.id, { [field1]: v })}
          width={74}
        />
      ) : null}
      <NumField
        value={s[field2] as number | null}
        auto={!!s.auto}
        done={s.done}
        decimal={ex.type === 'cardio'}
        step={1}
        onChange={(v) => updateSet(weId, s.id, { [field2]: v })}
        width={66}
        style={{ marginLeft: 8 }}
      />
      <View style={{ width: 44, alignItems: 'flex-end' }}>
        <Checkbox checked={s.done} onToggle={() => toggleSet(weId, s.id)} size={30} />
      </View>
    </View>
  );
});

function NumField({
  value,
  onChange,
  auto,
  done,
  decimal,
  width,
  style,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  auto: boolean;
  done: boolean;
  decimal?: boolean;
  step: number;
  width: number;
  style?: object;
}) {
  const { c, accent, isDark } = useTheme();
  const [text, setText] = useState(value === null || value === undefined ? '' : fmtKg(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === null || value === undefined ? '' : fmtKg(value));
  }, [value]);
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(',', '.').replace(/[^0-9.]/g, '');
        setText(clean);
        const n = clean === '' ? null : Number(clean);
        if (clean === '' || Number.isFinite(n)) onChange(n);
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(value === null || value === undefined ? '' : fmtKg(value));
      }}
      selectTextOnFocus
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      keyboardAppearance={isDark ? 'dark' : 'light'}
      inputAccessoryViewID={Platform.OS === 'ios' ? KB_ACCESSORY : undefined}
      selectionColor={accent}
      placeholder="—"
      placeholderTextColor={c.textFaint}
      style={[
        {
          width,
          height: 38,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: done ? alpha(accent, 0.35) : c.border,
          backgroundColor: done ? 'transparent' : c.surface2,
          textAlign: 'center',
          fontFamily: fonts.semibold,
          fontSize: 16,
          color: auto && !done ? c.textDim : c.text,
          paddingVertical: 0,
        },
        style,
      ]}
    />
  );
}
