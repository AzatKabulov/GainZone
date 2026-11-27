import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body3D } from '@/components/Body3D';
import { DurationSheet } from '@/components/DurationSheet';
import { ExerciseBlock, KB_ACCESSORY } from '@/components/ExerciseBlock';
import { mix, useBodyPalette } from '@/components/kit';
import { NoteSheet } from '@/components/NoteSheet';
import { RestSheet } from '@/components/RestSheet';
import { RestDock } from '@/components/RestTimer';
import { MUSCLE_IDS, type MuscleId } from '@/data/muscles';
import { exName, getExercise } from '@/lib/exercise';
import { Button, Empty, Press, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/menu';
import { setPickHandler } from '@/lib/pick';
import { ensureNotificationPermission, startRest } from '@/lib/rest';
import { addExerciseToMuscles, emptyMuscleStats, fmtElapsed, fmtVolume, workoutTotals } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { addExercises, discardWorkout, finishCheck, finishWorkout, renameWorkout, setExerciseRest, setLiveDuration } from '@/lib/workout';
import { useActive } from '@/store/active';
import { useFx } from '@/store/fx';
import { fonts, useTheme } from '@/theme';

/** The live workout — its own full page. Back = minimise (the workout keeps running). */
export default function WorkoutScreen() {
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const w = useActive((s) => s.workout);
  const rest = useActive((s) => !!s.rest);
  const now = useNow(1000);
  const [editingName, setEditingName] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [durOpen, setDurOpen] = useState(false);
  const palette = useBodyPalette();
  // muscles worked so far (only changes when a set is ticked) → stable key for the mini figure
  const st = emptyMuscleStats();
  for (const we of w?.exercises ?? []) addExerciseToMuscles(st, we, '');
  const workedKey = MUSCLE_IDS.map((m) => (st[m].sets >= 1 ? 2 : st[m].sets > 0 ? 1 : 0)).join('');
  const worked = useMemo(() => {
    const out: Partial<Record<MuscleId, string>> = {};
    MUSCLE_IDS.forEach((m, i) => {
      if (workedKey[i] === '2') out[m] = accent;
      else if (workedKey[i] === '1') out[m] = mix(palette.idle, accent, 0.5);
    });
    return out;
  }, [workedKey, accent, palette.idle]);

  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!w) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 40 }}>
        <Empty icon="barbell-outline" title="NO LIVE WORKOUT" action="BACK" onAction={back} />
      </View>
    );
  }

  const totals = workoutTotals(w.exercises);
  const elapsed = (now - Date.parse(w.started_at)) / 1000;

  const add = () => {
    setPickHandler((ids) => addExercises(ids), { multi: true, title: 'ADD EXERCISES' });
    router.push('/pick');
  };

  const finish = () => {
    const chk = finishCheck();
    if (chk.doneSets === 0) {
      confirm('Nothing logged yet', 'Tick at least one set to save the workout.', 'Discard workout', () => {
        discardWorkout();
        back();
      });
      return;
    }
    const go = () => {
      const id = finishWorkout();
      if (!id) return;
      haptic.celebrate();
      useFx.getState().celebrate({ kind: 'workout', kicker: 'WORKOUT LOGGED', title: 'DONE.' });
      router.replace(`/finish/${id}`);
    };
    if (chk.unfinished > 0) confirm('Finish workout?', `${chk.unfinished} unticked set${chk.unfinished > 1 ? 's' : ''} will be dropped.`, 'Finish', go, false);
    else go();
  };

  const discard = () =>
    confirm('Discard workout?', 'Everything in this session will be lost.', 'Discard', () => {
      discardWorkout();
      back();
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* top bar */}
      <View style={{ paddingTop: insets.top + 6, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
          <Press tapHaptic scaleTo={0.9} onPress={back} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={22} color={c.text} />
          </Press>
          {editingName ? (
            <TextInput
              autoFocus
              value={w.name}
              onChangeText={renameWorkout}
              onBlur={() => setEditingName(false)}
              onSubmitEditing={() => setEditingName(false)}
              selectionColor={accent}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: c.text, padding: 0 }}
            />
          ) : (
            <Press onPress={() => setEditingName(true)} scaleTo={0.98} style={{ flex: 1 }}>
              <Txt variant="h2" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {w.name.toUpperCase()}
              </Txt>
            </Press>
          )}
          <Press tapHaptic scaleTo={0.9} onPress={() => setTimerOpen(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="alarm-outline" size={22} color={c.text} />
          </Press>
          <Button label="FINISH" small onPress={finish} style={{ paddingHorizontal: 18, height: 44 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
          <Metric label="DURATION" value={fmtElapsed(elapsed)} color={accent} onPress={() => setDurOpen(true)} />
          <Metric label="VOLUME" value={`${fmtVolume(totals.volume)} kg`} />
          <Metric label="SETS" value={String(totals.sets)} />
          <View style={{ width: 84, height: 70 }}>
            <Body3D colors={worked} palette={palette} ring={accent} background={c.bg} dual interactive={false} style={{ flex: 1 }} />
          </View>
        </View>
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + (rest ? 120 : 40) }}
      >
        {w.exercises.length === 0 ? <Empty icon="add-circle-outline" title="EMPTY WORKOUT" /> : null}
        {w.exercises.map((we, i) => (
          <Animated.View key={we.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(360)} layout={LinearTransition.springify().damping(18)}>
            <ExerciseBlock we={we} workoutId={w.id} templateId={w.template_id} index={i} count={w.exercises.length} onNote={setNoteFor} onRest={setRestFor} />
          </Animated.View>
        ))}

        <View style={{ paddingHorizontal: 16, marginTop: 22, gap: 10 }}>
          <Button label="ADD EXERCISE" icon="add" onPress={add} />
          <Press tapHaptic onPress={discard} style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 }}>
            <Txt variant="label" color={c.danger}>
              DISCARD WORKOUT
            </Txt>
          </Press>
        </View>
      </ScrollView>

      <RestDock />
      <NoteSheet weId={noteFor} onClose={() => setNoteFor(null)} />
      <RestSheet
        visible={!!restFor}
        title="REST TIMER"
        subtitle={restFor ? exName(getExercise(w.exercises.find((e) => e.id === restFor)?.exercise_id ?? '')) : undefined}
        value={w.exercises.find((e) => e.id === restFor)?.rest ?? 120}
        onDone={(v) => {
          if (restFor) setExerciseRest(restFor, v);
          setRestFor(null);
        }}
        onClose={() => setRestFor(null)}
      />
      <DurationSheet
        visible={durOpen}
        seconds={elapsed}
        startedAt="live"
        onDone={(sec) => {
          setLiveDuration(sec);
          setDurOpen(false);
        }}
        onClose={() => setDurOpen(false)}
      />
      <RestSheet
        visible={timerOpen}
        title="TIMER"
        subtitle="Start a rest countdown"
        value={90}
        action="START"
        onDone={(v) => {
          if (v) startRest(v, '', 'Timer');
          setTimerOpen(false);
        }}
        onClose={() => setTimerOpen(false)}
      />

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={KB_ACCESSORY} backgroundColor={isDark ? '#1A1A1D' : '#EAE6DD'}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
            <Press tapHaptic onPress={() => Keyboard.dismiss()} style={{ height: 34, paddingHorizontal: 16, borderRadius: 9, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 17, letterSpacing: 1.2, color: isDark ? '#0A0A0B' : '#FFFFFF', marginTop: 2 }}>DONE</Text>
            </Press>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

function Metric({ label, value, color, onPress }: { label: string; value: string; color?: string; onPress?: () => void }) {
  const { c } = useTheme();
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Txt variant="label" style={{ fontSize: 10 }}>
          {label}
        </Txt>
        {onPress ? <Ionicons name="pencil" size={10} color={c.textFaint} /> : null}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.semibold, fontSize: 19, color: color ?? c.text, marginTop: 4 }}>
        {value}
      </Text>
    </>
  );
  return onPress ? (
    <Press tapHaptic scaleTo={0.96} onPress={onPress} style={{ flex: 1 }} hitSlop={8}>
      {body}
    </Press>
  ) : (
    <View style={{ flex: 1 }}>{body}</View>
  );
}
