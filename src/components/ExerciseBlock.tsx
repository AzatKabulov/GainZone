import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { ExerciseDef } from '@/data/exerciseTypes';
import { LOG_COLS, exName, useExercise } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { openMenu } from '@/lib/menu';
import { setPickHandler } from '@/lib/pick';
import { exerciseSessions, finishedWorkouts, fmtKg, fmtReps, previousForSets, recentNotes } from '@/lib/stats';
import { addSet, moveExercise, pinnedNote, removeExercise, removeSet, replaceExercise, setSplit, toggleSet, updateSet } from '@/lib/workout';
import { useData, type SetEntry, type WorkoutExercise } from '@/store/data';
import { alpha, fonts, useTheme } from '@/theme';
import { fmtRestLong } from './RestSheet';
import { SwipeDelete } from './SwipeDelete';
import { ExerciseThumb, mix } from './kit';
import { Press, Txt } from './ui';

export const KB_ACCESSORY = 'gain-kb';
export const REST_PRESETS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
export const fmtRest = (s: number) => (s === 0 ? 'OFF' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

const SET_LABEL: Record<SetEntry['type'], string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };
const W = { set: 40, kg: 70, reps: 62, kgSplit: 62, side: 50, check: 40, gap: 8 };

/** One exercise in the live workout — laid out like Hevy, styled like the *ZONE apps. */
export const ExerciseBlock = memo(function ExerciseBlock({
  we,
  workoutId,
  templateId,
  index,
  count,
  onNote,
  onRest,
}: {
  we: WorkoutExercise;
  workoutId: string;
  templateId: string | null;
  index: number;
  count: number;
  onNote: (weId: string) => void;
  onRest: (weId: string) => void;
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

  const noteLine = we.note || pinned || lastNote?.text;

  return (
    <View style={{ paddingTop: 22, paddingBottom: 6 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <Press scaleTo={0.94} onPress={() => router.push(`/exercise/${ex.id}`)}>
          <ExerciseThumb ex={ex} size={46} />
        </Press>
        <Press style={{ flex: 1 }} scaleTo={0.98} onPress={() => router.push(`/exercise/${ex.id}`)}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 18, lineHeight: 23, color: accent }}>
            {exName(ex)}
          </Text>
        </Press>
        <Press hitSlop={8} onPress={menu} scaleTo={0.9} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="ellipsis-vertical" size={20} color={c.text} />
        </Press>
      </View>

      {/* Rest / Note buttons */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 }}>
        <Chip icon="timer-outline" label={`Rest: ${we.rest ? fmtRestLong(we.rest) : 'OFF'}`} active={we.rest > 0} onPress={() => onRest(we.id)} />
        <Chip icon={we.note ? 'document-text' : 'document-text-outline'} label="Note" active={!!we.note} onPress={() => onNote(we.id)} />
        {split ? <Chip icon="git-compare-outline" label="L / R" active onPress={() => setSplit(we.id, false)} /> : null}
      </View>

      {noteLine ? (
        <Press onPress={() => onNote(we.id)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginTop: 10 }}>
          <Ionicons name={we.note ? 'document-text' : pinned ? 'pin' : 'time-outline'} size={13} color={we.note ? accent : c.textFaint} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: we.note ? c.text : c.textDim }}>
            {noteLine}
          </Text>
        </Press>
      ) : null}

      {/* table header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 4, gap: W.gap }}>
        <Head w={W.set} center>
          SET
        </Head>
        <Head flex>PREVIOUS</Head>
        {!single ? (
          <View style={{ width: split ? W.kgSplit : W.kg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {ex.type === 'weight_reps' ? <Ionicons name="barbell" size={12} color={c.textDim} /> : null}
            <Txt variant="label" style={{ fontSize: 10, letterSpacing: 1.2 }}>
              {cols[0]}
            </Txt>
          </View>
        ) : null}
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
          <Ionicons name="checkmark" size={16} color={c.textDim} />
        </View>
      </View>

      {we.sets.map((s, i) => {
        const label = s.type === 'normal' ? String(++workIdx) : SET_LABEL[s.type];
        return (
          <Animated.View key={s.id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition.springify().damping(18)}>
            <SwipeDelete onDelete={() => removeSet(we.id, s.id)}>
              <SetRow weId={we.id} s={s} label={label} prev={prevs[i]} ex={ex} split={split} />
            </SwipeDelete>
          </Animated.View>
        );
      })}

      <Press
        tapHaptic
        scaleTo={0.98}
        onPress={() => addSet(we.id)}
        style={{ marginHorizontal: 16, marginTop: 10, height: 46, borderRadius: 12, backgroundColor: c.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Ionicons name="add" size={20} color={c.text} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: c.text }}>Add Set</Text>
      </Press>
    </View>
  );
});

function Head({ children, w, flex, center }: { children: string; w?: number; flex?: boolean; center?: boolean }) {
  return (
    <Txt variant="label" style={{ width: w, flex: flex ? 1 : undefined, textAlign: center ? 'center' : 'left', fontSize: 10, letterSpacing: 1.2 }}>
      {children}
    </Txt>
  );
}

function Chip({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  const { c, accent } = useTheme();
  return (
    <Press tapHaptic onPress={onPress} style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={17} color={active ? accent : c.textDim} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: active ? c.text : c.textDim }}>{label}</Text>
    </Press>
  );
}

function prevText(p: SetEntry | null, ex: ExerciseDef): string {
  if (!p) return '—';
  if (ex.type === 'time') return `${p.time ?? 0}s`;
  if (ex.type === 'cardio') return `${p.time ?? 0}min · ${fmtKg(p.dist ?? 0)}km`;
  if (ex.type === 'bw_reps') return p.weight ? `+${fmtKg(p.weight)}kg x ${fmtReps(p)}` : `${fmtReps(p)} reps`;
  if (ex.type === 'assisted') return `-${fmtKg(p.weight)}kg x ${fmtReps(p)}`;
  if (p.weight === null || p.weight === undefined) return `${fmtReps(p)} reps`;
  return `${fmtKg(p.weight)}kg x ${fmtReps(p)}`;
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
    updateSet(weId, s.id, { weight: prev.weight, reps: prev.reps, reps_r: split ? (prev.reps_r ?? prev.reps) : null, time: prev.time ?? null, dist: prev.dist ?? null });
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 5, gap: W.gap, backgroundColor: s.done ? mix(c.bg, accent, 0.12) : c.bg }}>
      <Press
        onPress={setMenu}
        scaleTo={0.9}
        style={{ width: W.set, height: 40, borderRadius: 10, backgroundColor: isPR ? alpha('#F5C542', 0.18) : s.done ? alpha(accent, 0.18) : c.surface2, alignItems: 'center', justifyContent: 'center' }}
      >
        {isPR ? <Ionicons name="trophy" size={17} color="#F5C542" /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: typeColor }}>{label}</Text>}
      </Press>
      <Press style={{ flex: 1, height: 40, justifyContent: 'center' }} onPress={usePrev} scaleTo={0.97}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: fonts.body, fontSize: 15.5, color: c.textFaint }}>
          {prevText(prev, ex)}
        </Text>
      </Press>
      {!single ? <NumField value={s[field1] as number | null} auto={!!s.auto} done={s.done} decimal width={split ? W.kgSplit : W.kg} onChange={(v) => updateSet(weId, s.id, { [field1]: v })} /> : null}
      {split ? (
        <>
          <NumField value={s.reps} auto={!!s.auto} done={s.done} width={W.side} onChange={(v) => updateSet(weId, s.id, { reps: v })} />
          <NumField value={s.reps_r ?? null} auto={!!s.auto} done={s.done} width={W.side} onChange={(v) => updateSet(weId, s.id, { reps_r: v })} />
        </>
      ) : (
        <NumField value={s[field2] as number | null} auto={!!s.auto} done={s.done} decimal={ex.type === 'cardio'} width={W.reps} onChange={(v) => updateSet(weId, s.id, { [field2]: v })} />
      )}
      <SetCheck done={s.done} onPress={() => toggleSet(weId, s.id)} />
    </View>
  );
});

/** Square check like Hevy: grey until done, then the accent with a pop. */
function SetCheck({ done, onPress }: { done: boolean; onPress: () => void }) {
  const { c, accent, onAccent } = useTheme();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.value = done ? withSequence(withTiming(0.78, { duration: 80 }), withSpring(1, { damping: 7, stiffness: 380 })) : withSequence(withTiming(0.9, { duration: 70 }), withSpring(1));
  }, [done, scale]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Press onPress={onPress} scaleTo={1} hitSlop={6}>
      <Animated.View style={[{ width: W.check, height: 40, borderRadius: 10, backgroundColor: done ? accent : c.surface2, alignItems: 'center', justifyContent: 'center' }, st]}>
        <Ionicons name="checkmark-sharp" size={22} color={done ? onAccent : c.textFaint} />
      </Animated.View>
    </Press>
  );
}

function NumField({ value, onChange, auto, done, decimal, width }: { value: number | null; onChange: (v: number | null) => void; auto: boolean; done: boolean; decimal?: boolean; width: number }) {
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
        height: 40,
        borderRadius: 10,
        borderWidth: done ? 0 : 1,
        borderColor: c.borderStrong,
        backgroundColor: 'transparent',
        textAlign: 'center',
        fontFamily: done ? fonts.semibold : fonts.medium,
        fontSize: 17,
        color: auto && !done ? c.textDim : c.text,
        paddingVertical: 0,
      }}
    />
  );
}
