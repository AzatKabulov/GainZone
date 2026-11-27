import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body3D } from '@/components/Body3D';
import { DurationSheet } from '@/components/DurationSheet';
import { Delta } from '@/components/charts';
import { FxHost } from '@/components/FxHost';
import { FieldLabel, heatColors, Stat, useBodyPalette } from '@/components/kit';
import { Button, Card, Input, Press, Section, Txt } from '@/components/ui';
import { MUSCLE_IDS, MUSCLES, type MuscleId } from '@/data/muscles';
import { todayKey } from '@/lib/date';
import { getExercise, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import {
  addExerciseToMuscles,
  bestSet,
  emptyMuscleStats,
  FEELINGS,
  finishedWorkouts,
  fmtDur,
  fmtSetValue,
  fmtVolume,
  workoutTotals,
} from '@/lib/stats';
import { routineChanged, setSavedDuration, updateTemplateFromWorkout } from '@/lib/workout';
import { useData } from '@/store/data';
import { useFx } from '@/store/fx';
import { alpha, fonts, useTheme } from '@/theme';

/** Heat for a single session: 1–2 sets green, 3–5 orange, 6+ red. */
function sessionHeat(sets: number): 0 | 1 | 2 | 3 {
  if (sets <= 0) return 0;
  if (sets < 3) return 1;
  if (sets < 6) return 2;
  return 3;
}

export default function FinishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, accent, isDark } = useTheme();
  const palette = useBodyPalette();
  const [scrollOn, setScrollOn] = useState(true);
  const [durOpen, setDurOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const w = useData((s) => s.workouts[id]);
  const all = useData((s) => s.workouts);
  const tpl = useData((s) => (w?.template_id ? s.templates[w.template_id] : undefined));
  const exName = useExName();
  const [feeling, setFeeling] = useState<number | null>(w?.feeling ?? null);
  const [energy, setEnergy] = useState<number | null>(w?.energy ?? null);
  const [note, setNote] = useState(w?.note ?? '');
  const [bw, setBw] = useState('');
  const [updateRoutine, setUpdateRoutine] = useState(false);

  const data = useMemo(() => {
    if (!w) return null;
    const totals = workoutTotals(w.exercises);
    const muscles = emptyMuscleStats();
    for (const we of w.exercises) addExerciseToMuscles(muscles, we, w.started_at);
    const prev = w.template_id
      ? finishedWorkouts(all).find((x) => x.id !== w.id && x.template_id === w.template_id && x.started_at < w.started_at)
      : undefined;
    const prs = w.exercises.flatMap((we) => we.sets.filter((s) => s.pr?.length).map((s) => ({ we, s })));
    return { totals, muscles, prev, prs };
  }, [w, all]);

  if (!w || !data) return null;
  const heat = heatColors(isDark);
  const colors: Partial<Record<MuscleId, string>> = {};
  for (const m of MUSCLE_IDS) {
    const h = sessionHeat(data.muscles[m].sets);
    if (h) colors[m] = heat[h];
  }
  const worked = MUSCLE_IDS.filter((m) => data.muscles[m].sets > 0).sort((a, b) => data.muscles[b].sets - data.muscles[a].sets);
  const volDelta = data.prev && data.prev.volume > 0 ? ((w.volume - data.prev.volume) / data.prev.volume) * 100 : null;
  const changed = routineChanged(w.template_id, w.id);

  const save = () => {
    const weight = Number(bw.replace(',', '.'));
    useData.getState().patch('workouts', w.id, {
      feeling,
      energy,
      note: note.trim(),
      bodyweight: weight > 0 ? weight : w.bodyweight,
    });
    if (weight > 0) {
      const existing = Object.values(useData.getState().metrics).find((m) => !m.deleted && m.date === todayKey());
      if (existing) useData.getState().patch('metrics', existing.id, { weight });
      else useData.getState().create('metrics', { date: todayKey(), weight });
    }
    if (updateRoutine && w.template_id) updateTemplateFromWorkout(w.template_id, w.id);
    haptic.success();
    useFx.getState().cheer('WORKOUT SAVED');
    router.dismissAll();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView scrollEnabled={scrollOn} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 30 }}>
        <Animated.View entering={FadeInDown.duration(450)}>
          <Txt variant="label" color={accent}>
            WORKOUT COMPLETE
          </Txt>
          <Text adjustsFontSizeToFit numberOfLines={2} minimumFontScale={0.45} style={{ fontFamily: fonts.display, fontSize: 62, lineHeight: 60, letterSpacing: 0.5, color: c.text, marginTop: 8 }}>
            {w.name.toUpperCase()}
            <Text style={{ color: accent }}>.</Text>
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(450)}>
          <Card style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="TIME" value={fmtDur(w.duration_sec)} onPress={() => setDurOpen(true)} />
              <Stat label="VOLUME" value={fmtVolume(data.totals.volume)} unit="KG" />
            </View>
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
            <View style={{ flexDirection: 'row' }}>
              <Stat label="SETS" value={String(data.totals.sets)} />
              <Stat label="REPS" value={String(data.totals.reps)} />
              <Stat label="PRS" value={String(data.prs.length)} color={data.prs.length ? '#F5C542' : undefined} />
            </View>
            {volDelta !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <Txt variant="label">VS LAST TIME</Txt>
                <Delta value={volDelta} />
                <Txt variant="small" color={c.textDim}>
                  volume
                </Txt>
              </View>
            ) : null}
          </Card>
        </Animated.View>

        {data.prs.length ? (
          <Animated.View entering={FadeInDown.delay(140).duration(450)}>
            <Section label="PERSONAL RECORDS" count={data.prs.length} style={{ marginTop: 24, marginBottom: 10 }} />
            <View style={{ gap: 8 }}>
              {data.prs.map(({ we, s }) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: alpha('#F5C542', 0.08), borderWidth: 1, borderColor: alpha('#F5C542', 0.4) }}>
                  <Ionicons name="trophy" size={18} color="#F5C542" />
                  <Txt variant="title" style={{ flex: 1 }} numberOfLines={1}>
                    {exName(getExercise(we.exercise_id))}
                  </Txt>
                  <Txt variant="mono">{fmtSetValue(s, getExercise(we.exercise_id).type)}</Txt>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(200).duration(450)}>
          <Section label="MUSCLES WORKED" count={worked.length} style={{ marginTop: 24, marginBottom: 12 }} />
          <Card>
            <View style={{ height: 330, marginHorizontal: -16, marginVertical: -16, borderRadius: 16, overflow: 'hidden' }}>
              <Body3D colors={colors} palette={palette} ring={accent} background={c.surface} autoRotate onInteract={(a) => setScrollOn(!a)} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {worked.map((m) => (
                <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, height: 28, borderRadius: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: heat[sessionHeat(data.muscles[m].sets)] }} />
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1, color: c.text }}>
                    {MUSCLES[m].en.toUpperCase()} {Math.round(data.muscles[m].sets * 10) / 10}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        <Section label="EXERCISES" count={w.exercises.length} style={{ marginTop: 24, marginBottom: 10 }} />
        <Card style={{ paddingVertical: 6 }}>
          {w.exercises.map((we, i) => {
            const ex = getExercise(we.exercise_id);
            const best = bestSet(we);
            return (
              <View key={we.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, gap: 10 }}>
                <Txt variant="mono" color={c.textFaint} style={{ width: 28 }}>
                  {we.sets.length}×
                </Txt>
                <Txt variant="title" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
                  {exName(ex)}
                </Txt>
                {best ? <Txt variant="mono">{fmtSetValue(best, ex.type)}</Txt> : null}
              </View>
            );
          })}
        </Card>

        <FieldLabel style={{ marginTop: 26 }}>HOW DID YOU FEEL?</FieldLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FEELINGS.map((f) => {
            const on = feeling === f.v;
            return (
              <Press
                key={f.v}
                tapHaptic
                onPress={() => setFeeling(on ? null : f.v)}
                style={{ flex: 1, height: 66, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: on ? alpha(accent, 0.14) : c.surface, borderWidth: 1, borderColor: on ? accent : c.border }}
              >
                <Text style={{ fontSize: 24 }}>{f.emoji}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 8.5, letterSpacing: 1.2, color: on ? c.text : c.textDim }}>{f.label}</Text>
              </Press>
            );
          })}
        </View>

        <FieldLabel style={{ marginTop: 20 }}>ENERGY</FieldLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((v) => {
            const on = energy !== null && v <= energy;
            return (
              <Press
                key={v}
                tapHaptic
                onPress={() => setEnergy(energy === v ? null : v)}
                style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? accent : c.surface, borderWidth: 1, borderColor: on ? accent : c.border }}
              >
                <Ionicons name="flash" size={16} color={on ? c.bg : c.textFaint} />
              </Press>
            );
          })}
        </View>

        <FieldLabel style={{ marginTop: 20 }}>HOW DID IT GO?</FieldLabel>
        <Input value={note} onChangeText={setNote} placeholder="Strong day, slept 7h, shoulder felt tight…" multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />

        <FieldLabel style={{ marginTop: 20 }}>BODYWEIGHT TODAY (OPTIONAL)</FieldLabel>
        <Input value={bw} onChangeText={setBw} placeholder={w.bodyweight ? `${w.bodyweight} kg` : 'kg'} keyboardType="decimal-pad" />

        {changed && tpl ? (
          <Press
            tapHaptic
            onPress={() => setUpdateRoutine((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: updateRoutine ? accent : c.border }}
          >
            <Ionicons name={updateRoutine ? 'checkbox' : 'square-outline'} size={22} color={updateRoutine ? accent : c.textDim} />
            <View style={{ flex: 1 }}>
              <Txt variant="title" style={{ fontSize: 15 }}>
                Update “{tpl.name}”
              </Txt>
              <Txt variant="small" color={c.textDim}>
                Save today’s exercises and sets as the routine.
              </Txt>
            </View>
          </Press>
        ) : null}

        <Button label="SAVE WORKOUT" icon="checkmark" onPress={save} style={{ marginTop: 26 }} />
      </ScrollView>
      <DurationSheet
        visible={durOpen}
        seconds={w.duration_sec}
        onDone={(sec) => {
          setSavedDuration(w.id, sec);
          setDurOpen(false);
        }}
        onClose={() => setDurOpen(false)}
      />
      <FxHost />
    </View>
  );
}
