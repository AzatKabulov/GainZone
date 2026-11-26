import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { ExerciseDef } from '@/data/exerciseTypes';
import { LOG_COLS, exName, useExercise } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { openMenu } from '@/lib/menu';
import { setPickHandler } from '@/lib/pick';
import { exerciseSessions, finishedWorkouts, fmtKg, fmtReps, previousForSets, recentNotes } from '@/lib/stats';
import {
  addSet,
  moveExercise,
  pinnedNote,
  removeExercise,
  removeSet,
  replaceExercise,
  setExerciseRest,
  setSplit,
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
const W = { set: 32, kg: 62, reps: 54, side: 44, check: 34, gap: 6 };

/** One exercise in the live workout. */
export const ExerciseBlock = memo(function ExerciseBlock({
  we,
  workoutId,
  templateId,
  index,
  count,
  onNote,
}: {
  we: WorkoutExercise;
  workoutId: string;
  templateId: string | null;
  index: number;
  count: number;
  onNote: (weId: string) => void;
}) {
  const { c, accent } = useTheme();
  const ex = useExercise(we.exercise_id);
  const workouts = useData((s) => s.workouts);
  const sessions = useMemo(() => exerciseSessions(finishedWorkouts(workouts), we.exercise_id, workoutId), [workouts, we.exercise_id, workoutId]);
  const prevs = useMemo(() => previousForSets(sessions[0] ?? null, we.sets), [sessions, we.sets]);
  const lastNote = useMemo(() => recentNotes(sessions, 1)[0], [sessions]);
  const pinned = pinnedNote(templateId, we.exercise_id);
  const cols = LOG_COLS[ex.type];
  const single = ex.type === 'time';
  const canSplit = ex.type === 'weight_reps' || ex.type === 'bw_reps' || ex.type === 'assisted';
  const split = !!we.split && canSplit;
  let workIdx = 0;

  const menu = () =>
    openMenu(exName(ex), [
      { label: 'Exercise details', onPress: () => router.push(`/exercise/${ex.id}`) },
      ...(canSplit ? [{ label: split ? 'One reps field' : 'Left / right reps', onPress: () => setSplit(we.id, !split) }] : []),
      {
        label: 'Replace exercise',
        onPress: () => {
          setPickHandler((ids) => replaceExercise(we.id, ids[0]), { multi: false, title: 'REPLACE' });
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
      REST_PRESETS.map((s) => ({ label: (s === 0 ? 'Off' : fmtRest(s)) + (s === we.rest ? '  ✓' : ''), onPress: () => setExerciseRest(we.id, s) })),
    );

  const noteLine = we.note || pinned || lastNote?.text;
  const noteIcon = we.note ? 'create' : pinned ? 'pin' : 'time-outline';

  return (
    <View style={{ marginHorizontal: 12, marginTop: 12, paddingVertical: 14, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}>
        <Press scaleTo={0.94} onPress={() => router.push(`/exercise/${ex.id}`)}>
          <ExerciseThumb ex={ex} size={42} />
        </Press>
        <Press style={{ flex: 1 }} scaleTo={0.98} onPress={() => router.push(`/exercise/${ex.id}`)}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: c.text }}>
            {exName(ex)}
          </Text>
        </Press>
        <Press hitSlop={6} onPress={menu} scaleTo={0.9} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color={c.text} />
        </Press>
      </View>

      {/* small controls, Hevy-style */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 12 }}>
        <Pill icon="timer-outline" label={fmtRest(we.rest)} active={we.rest > 0} onPress={restMenu} />
        <Pill icon={we.note ? 'create' : 'create-outline'} label="Note" active={!!we.note} onPress={() => onNote(we.id)} />
        {split ? <Pill icon="git-compare-outline" label="L / R" active onPress={() => setSplit(we.id, false)} /> : null}
      </View>

      {noteLine ? (
        <Press onPress={() => onNote(we.id)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, marginTop: 10 }}>
          <Ionicons name={noteIcon} size={12} color={we.note ? accent : c.textFaint} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: we.note ? c.text : c.textDim }}>
            {noteLine}
          </Text>
        </Press>
      ) : null}

      {/* table header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginTop: 14, marginBottom: 4, gap: W.gap }}>
        <Head w={W.set}>SET</Head>
        <Head flex>PREVIOUS</Head>
        {!single ? <Head w={W.kg} center>{cols[0]}</Head> : null}
        {split ? (
          <>
            <Head w={W.side} center>
              L
            </Head>
            <Head w={W.side} center>
              R
            </Head>
          </>
        ) : (
          <Head w={W.reps} center>
            {cols[1]}
          </Head>
        )}
        <View style={{ width: W.check, alignItems: 'center' }}>
          <Ionicons name="checkmark" size={14} color={c.textFaint} />
        </View>
      </View>

      {we.sets.map((s, i) => {
        const label = s.type === 'normal' ? String(++workIdx) : SET_LABEL[s.type];
        return (
          <Animated.View key={s.id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition.springify().damping(18)}>
            <SetRow weId={we.id} s={s} label={label} prev={prevs[i]} ex={ex} split={split} />
          </Animated.View>
        );
      })}

      <Press
        tapHaptic
        scaleTo={0.98}
        onPress={() => addSet(we.id)}
        style={{ marginHorizontal: 14, marginTop: 10, height: 38, borderRadius: 10, backgroundColor: c.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Ionicons name="add" size={16} color={c.textDim} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: c.textDim }}>ADD SET</Text>
      </Press>
    </View>
  );
});

function Head({ children, w, flex, center }: { children: string; w?: number; flex?: boolean; center?: boolean }) {
  return (
    <Txt variant="label" style={{ width: w, flex: flex ? 1 : undefined, textAlign: center ? 'center' : 'left', fontSize: 9.5, letterSpacing: 1.2 }}>
      {children}
    </Txt>
  );
}

function Pill({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  const { c, accent } = useTheme();
  return (
    <Press
      tapHaptic
      onPress={onPress}
      style={{ height: 30, paddingHorizontal: 11, borderRadius: 9, backgroundColor: active ? alpha(accent, 0.12) : c.surface2, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Ionicons name={icon} size={13} color={active ? accent : c.textDim} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: active ? c.text : c.textDim }}>{label}</Text>
    </Press>
  );
}

function prevText(p: SetEntry | null, ex: ExerciseDef): string {
  if (!p) return '—';
  if (ex.type === 'time') return `${p.time ?? 0}s`;
  if (ex.type === 'cardio') return `${p.time ?? 0}′ · ${fmtKg(p.dist ?? 0)}km`;
  if (ex.type === 'bw_reps') return p.weight ? `+${fmtKg(p.weight)} × ${fmtReps(p)}` : `BW × ${fmtReps(p)}`;
  if (ex.type === 'assisted') return `−${fmtKg(p.weight)} × ${fmtReps(p)}`;
  return `${fmtKg(p.weight)} × ${fmtReps(p)}`;
}

const SetRow = memo(function SetRow({ weId, s, label, prev, ex, split }: { weId: string; s: SetEntry; label: string; prev: SetEntry | null; ex: ExerciseDef; split: boolean }) {
  const { c, accent } = useTheme();
  const single = ex.type === 'time';
  const isPR = !!s.pr?.length && s.done;
  const field1: keyof SetEntry = ex.type === 'cardio' ? 'time' : 'weight';
  const field2: keyof SetEntry = ex.type === 'cardio' ? 'dist' : ex.type === 'time' ? 'time' : 'reps';
  const typeColor = s.type === 'warmup' ? '#F59E0B' : s.type === 'drop' ? '#60A5FA' : s.type === 'failure' ? c.danger : c.text;

  const setMenu = () =>
    openMenu(`Set ${label}`, [
      { label: 'Normal', onPress: () => updateSet(weId, s.id, { type: 'normal' }) },
      { label: 'Warm-up', onPress: () => updateSet(weId, s.id, { type: 'warmup' }) },
      { label: 'Drop set', onPress: () => updateSet(weId, s.id, { type: 'drop' }) },
      { label: 'To failure', onPress: () => updateSet(weId, s.id, { type: 'failure' }) },
      { label: 'Delete set', destructive: true, onPress: () => removeSet(weId, s.id) },
    ]);

  const usePrev = () => {
    if (!prev || s.done) return;
    haptic.tap();
    updateSet(weId, s.id, {
      weight: prev.weight,
      reps: prev.reps,
      reps_r: split ? (prev.reps_r ?? prev.reps) : null,
      time: prev.time ?? null,
      dist: prev.dist ?? null,
    });
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 4, gap: W.gap, backgroundColor: s.done ? alpha(accent, 0.08) : 'transparent' }}>
      <Press
        onPress={setMenu}
        scaleTo={0.9}
        hitSlop={4}
        style={{
          width: W.set,
          height: 32,
          borderRadius: 9,
          backgroundColor: isPR ? alpha('#F5C542', 0.18) : c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPR ? <Ionicons name="trophy" size={14} color="#F5C542" /> : <Text style={{ fontFamily: fonts.display, fontSize: 17, color: typeColor, marginTop: 2 }}>{label}</Text>}
      </Press>
      <Press style={{ flex: 1, height: 36, justifyContent: 'center' }} onPress={usePrev} scaleTo={0.97}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: fonts.mono, fontSize: 12, color: c.textFaint }}>
          {prevText(prev, ex)}
        </Text>
      </Press>
      {!single ? <NumField value={s[field1] as number | null} auto={!!s.auto} done={s.done} decimal width={W.kg} onChange={(v) => updateSet(weId, s.id, { [field1]: v })} /> : null}
      {split ? (
        <>
          <NumField value={s.reps} auto={!!s.auto} done={s.done} width={W.side} onChange={(v) => updateSet(weId, s.id, { reps: v })} />
          <NumField value={s.reps_r ?? null} auto={!!s.auto} done={s.done} width={W.side} onChange={(v) => updateSet(weId, s.id, { reps_r: v })} />
        </>
      ) : (
        <NumField
          value={s[field2] as number | null}
          auto={!!s.auto}
          done={s.done}
          decimal={ex.type === 'cardio'}
          width={W.reps}
          onChange={(v) => updateSet(weId, s.id, { [field2]: v })}
        />
      )}
      <View style={{ width: W.check, alignItems: 'center' }}>
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
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  auto: boolean;
  done: boolean;
  decimal?: boolean;
  width: number;
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
      style={{
        width,
        height: 36,
        borderRadius: 10,
        backgroundColor: done ? 'transparent' : c.surface2,
        textAlign: 'center',
        fontFamily: fonts.semibold,
        fontSize: 16,
        color: auto && !done ? c.textDim : c.text,
        paddingVertical: 0,
      }}
    />
  );
}
