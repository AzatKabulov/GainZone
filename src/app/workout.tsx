import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseBlock, KB_ACCESSORY } from '@/components/ExerciseBlock';
import { NoteSheet } from '@/components/NoteSheet';
import { RestDock } from '@/components/RestTimer';
import { Button, Empty, Press, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/menu';
import { setPickHandler } from '@/lib/pick';
import { ensureNotificationPermission } from '@/lib/rest';
import { fmtElapsed, fmtVolume, workoutTotals } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { addExercises, discardWorkout, finishCheck, finishWorkout, renameWorkout } from '@/lib/workout';
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
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Press tapHaptic scaleTo={0.9} onPress={back} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={22} color={c.text} />
          </Press>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: c.text, letterSpacing: 0.8 }}>{fmtElapsed(elapsed)}</Text>
          </View>
          <Button label="FINISH" small onPress={finish} style={{ paddingHorizontal: 18 }} />
        </View>
        {editingName ? (
          <TextInput
            autoFocus
            value={w.name}
            onChangeText={renameWorkout}
            onBlur={() => setEditingName(false)}
            onSubmitEditing={() => setEditingName(false)}
            selectionColor={accent}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            style={{ fontFamily: fonts.display, fontSize: 32, color: c.text, padding: 0, marginTop: 12 }}
          />
        ) : (
          <Press onPress={() => setEditingName(true)} scaleTo={0.99} style={{ marginTop: 12 }}>
            <Txt variant="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>
              {w.name.toUpperCase()}
              <Text style={{ color: accent }}>.</Text>
            </Txt>
          </Press>
        )}
        <Txt variant="mono" color={c.textDim} style={{ marginTop: 2 }}>
          {fmtVolume(totals.volume)} KG · {totals.sets} SETS{totals.prs ? ` · ${totals.prs} PR` : ''}
        </Txt>
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
            <ExerciseBlock we={we} workoutId={w.id} templateId={w.template_id} index={i} count={w.exercises.length} onNote={setNoteFor} />
          </Animated.View>
        ))}

        <View style={{ paddingHorizontal: 12, marginTop: 16, gap: 10 }}>
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
