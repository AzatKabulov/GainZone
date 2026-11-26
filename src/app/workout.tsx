import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseBlock, KB_ACCESSORY } from '@/components/ExerciseBlock';
import { FxHost } from '@/components/FxHost';
import { Stat } from '@/components/kit';
import { Button, Empty, Press, ProgressBar, Txt } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/menu';
import { setPickHandler } from '@/lib/pick';
import { adjustRest, ensureNotificationPermission, skipRest } from '@/lib/rest';
import { fmtElapsed, fmtVolume, workoutTotals } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { addExercises, discardWorkout, finishCheck, finishWorkout, renameWorkout, setWorkoutNote } from '@/lib/workout';
import { useActive } from '@/store/active';
import { useFx } from '@/store/fx';
import { alpha, fonts, useTheme } from '@/theme';

export default function WorkoutScreen() {
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const w = useActive((s) => s.workout);
  const rest = useActive((s) => s.rest);
  const now = useNow(1000);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  if (!w) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgElevated, paddingTop: 40 }}>
        <Empty icon="barbell-outline" title="NO LIVE WORKOUT" text="Start one from the TRAIN tab." action="CLOSE" onAction={() => router.back()} />
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
      confirm('Nothing logged yet', 'Tick at least one set to save this workout. Discard it instead?', 'Discard', () => {
        discardWorkout();
        router.back();
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
    if (chk.unfinished > 0) {
      confirm(
        'Finish workout?',
        `${chk.unfinished} set${chk.unfinished > 1 ? 's are' : ' is'} not ticked and will be dropped.`,
        'Finish',
        go,
        false,
      );
    } else go();
  };

  const discard = () =>
    confirm('Discard workout?', 'Everything logged in this session will be thrown away.', 'Discard', () => {
      discardWorkout();
      router.back();
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, gap: 10 }}>
        <Press
          tapHaptic
          scaleTo={0.9}
          onPress={() => router.back()}
          hitSlop={8}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-down" size={20} color={c.text} />
        </Press>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color={accent}>
            LIVE · {fmtElapsed(elapsed)}
          </Txt>
          {editingName ? (
            <TextInput
              autoFocus
              value={w.name}
              onChangeText={renameWorkout}
              onBlur={() => setEditingName(false)}
              onSubmitEditing={() => setEditingName(false)}
              selectionColor={accent}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              style={{ fontFamily: fonts.display, fontSize: 28, color: c.text, padding: 0, marginTop: 2 }}
            />
          ) : (
            <Press onPress={() => setEditingName(true)} scaleTo={0.98}>
              <Txt variant="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45} style={{ fontSize: 28, marginTop: 2 }}>
                {w.name.toUpperCase()}
              </Txt>
            </Press>
          )}
        </View>
        <Button label="FINISH" small onPress={finish} />
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Stat label="DURATION" value={fmtElapsed(elapsed)} />
        <Stat label="VOLUME" value={fmtVolume(totals.volume)} unit="KG" />
        <Stat label="SETS" value={String(totals.sets)} />
        <Stat label="PR" value={String(totals.prs)} color={totals.prs ? '#F5C542' : undefined} />
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + (rest ? 190 : 60) }}
      >
        {w.exercises.length === 0 ? (
          <Empty icon="add-circle-outline" title="EMPTY WORKOUT" text="Add the first exercise and start lifting." />
        ) : null}
        {w.exercises.map((we, i) => (
          <Animated.View key={we.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(380)} layout={LinearTransition.springify().damping(18)}>
            <ExerciseBlock we={we} workoutId={w.id} templateId={w.template_id} index={i} count={w.exercises.length} />
          </Animated.View>
        ))}

        <View style={{ paddingHorizontal: 20, marginTop: 26, gap: 10 }}>
          <Button label="ADD EXERCISE" icon="add" onPress={add} />
          <TextInput
            value={w.note}
            onChangeText={setWorkoutNote}
            placeholder="Workout note (how it went, sleep, energy…)"
            placeholderTextColor={c.textFaint}
            selectionColor={accent}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            multiline
            style={{
              backgroundColor: c.surface2,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontFamily: fonts.body,
              fontSize: 15,
              color: c.text,
              minHeight: 50,
            }}
          />
          <Button label="DISCARD WORKOUT" variant="danger" small onPress={discard} />
        </View>
      </ScrollView>

      {rest ? <RestPanel /> : null}

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={KB_ACCESSORY} backgroundColor={isDark ? '#1A1A1D' : '#EAE6DD'}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
            <Press tapHaptic onPress={() => Keyboard.dismiss()} style={{ height: 34, paddingHorizontal: 16, borderRadius: 9, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 17, letterSpacing: 1.2, color: isDark ? '#0A0A0B' : '#FFFFFF', marginTop: 2 }}>DONE</Text>
            </Press>
          </View>
        </InputAccessoryView>
      ) : null}
      <FxHost inSheet />
    </View>
  );
}

function RestPanel() {
  const { c, accent, onAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const rest = useActive((s) => s.rest);
  const now = useNow(250);
  if (!rest) return null;
  const left = Math.max(0, (rest.endsAt - now) / 1000);
  const progress = 1 - left / Math.max(1, rest.total);
  return (
    <Animated.View
      entering={FadeInUp.duration(280)}
      exiting={FadeOutDown.duration(200)}
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 10,
        padding: 14,
        borderRadius: 20,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: alpha(accent, 0.5),
        shadowColor: accent,
        shadowOpacity: 0.3,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color={accent} numberOfLines={1}>
            REST · {rest.label.toUpperCase()}
          </Txt>
          <Text style={{ fontFamily: fonts.display, fontSize: 54, lineHeight: 54, color: c.text, letterSpacing: 1, marginTop: 4 }}>
            {fmtElapsed(Math.ceil(left))}
          </Text>
        </View>
        <RestBtn label="−15" onPress={() => adjustRest(-15)} />
        <RestBtn label="+15" onPress={() => adjustRest(15)} />
        <Press
          tapHaptic
          onPress={skipRest}
          style={{ height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 18, letterSpacing: 1.3, color: onAccent, marginTop: 2 }}>SKIP</Text>
        </Press>
      </View>
      <ProgressBar value={progress} height={6} style={{ marginTop: 10 }} />
    </Animated.View>
  );
}

function RestBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press
      tapHaptic
      scaleTo={0.9}
      onPress={onPress}
      style={{ width: 48, height: 44, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: c.text }}>{label}</Text>
    </Press>
  );
}
