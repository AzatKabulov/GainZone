import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body3D } from '@/components/Body3D';
import { FxHost } from '@/components/FxHost';
import { FieldLabel, heatColors, SheetHeader, Stat, useBodyPalette } from '@/components/kit';
import { Button, Card, Empty, Input, Press, Section, Txt } from '@/components/ui';
import { MUSCLE_IDS, type MuscleId } from '@/data/muscles';
import { dateKey, relativeLabel } from '@/lib/date';
import { getExercise, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/menu';
import { addExerciseToMuscles, emptyMuscleStats, FEELINGS, fmtDur, fmtSetValue, fmtVolume } from '@/lib/stats';
import { startWorkoutFrom, templateFromExercises } from '@/lib/workout';
import { useActive } from '@/store/active';
import { useData } from '@/store/data';
import { useFx } from '@/store/fx';
import { alpha, fonts, useTheme } from '@/theme';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, accent, isDark } = useTheme();
  const palette = useBodyPalette();
  const [scrollOn, setScrollOn] = useState(true);
  const insets = useSafeAreaInsets();
  const w = useData((s) => s.workouts[id]);
  const exName = useExName();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(w?.name ?? '');
  const [note, setNote] = useState(w?.note ?? '');

  const colors = useMemo(() => {
    const out: Partial<Record<MuscleId, string>> = {};
    if (!w) return out;
    const st = emptyMuscleStats();
    for (const we of w.exercises) addExerciseToMuscles(st, we, w.started_at);
    const heat = heatColors(isDark);
    for (const m of MUSCLE_IDS) {
      const n = st[m].sets;
      if (n > 0) out[m] = heat[n < 3 ? 1 : n < 6 ? 2 : 3];
    }
    return out;
  }, [w, isDark]);

  if (!w || w.deleted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
        <SheetHeader kicker="WORKOUT" title="NOT FOUND" onClose={() => router.back()} />
        <Empty icon="alert-circle-outline" title="GONE" text="This workout was deleted." />
      </View>
    );
  }

  const d = new Date(w.started_at);
  const feel = FEELINGS.find((f) => f.v === w.feeling);

  const saveEdit = () => {
    useData.getState().patch('workouts', w.id, { name: name.trim() || w.name, note });
    setEditing(false);
    haptic.success();
  };

  const repeat = () => {
    if (useActive.getState().workout) {
      useFx.getState().info('WORKOUT IN PROGRESS', 'Finish or discard the current one first.');
      return;
    }
    startWorkoutFrom(w.name, templateFromExercises(w.exercises));
    router.replace('/workout');
  };

  const saveAsRoutine = () => {
    const t = useData.getState().create('templates', { name: w.name, exercises: templateFromExercises(w.exercises), sort_order: Date.now() });
    haptic.success();
    useFx.getState().info('ROUTINE CREATED', t.name);
  };

  const del = () =>
    confirm('Delete workout?', 'It disappears from your log and stats. You can undo right after.', 'Delete', () => {
      useData.getState().remove('workouts', w.id);
      haptic.warning();
      useFx.getState().info('WORKOUT DELETED', w.name, { icon: 'undo', onPress: () => useData.getState().restore('workouts', w.id) });
      router.back();
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader
        kicker={`${relativeLabel(dateKey(d))} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`}
        title={w.name.toUpperCase()}
        onClose={() => router.back()}
        right={
          <Press tapHaptic onPress={() => (editing ? saveEdit() : setEditing(true))} style={{ paddingHorizontal: 10, height: 36, justifyContent: 'center' }}>
            <Txt variant="label" color={accent}>
              {editing ? 'SAVE' : 'EDIT'}
            </Txt>
          </Press>
        }
      />
      <ScrollView scrollEnabled={scrollOn} automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
        {editing ? (
          <View style={{ marginBottom: 16 }}>
            <FieldLabel>NAME</FieldLabel>
            <Input value={name} onChangeText={setName} />
            <FieldLabel style={{ marginTop: 14 }}>NOTE</FieldLabel>
            <Input value={note} onChangeText={setNote} multiline placeholder="How it went" />
            <FieldLabel style={{ marginTop: 14 }}>FEELING</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FEELINGS.map((f) => (
                <Press
                  key={f.v}
                  tapHaptic
                  onPress={() => useData.getState().patch('workouts', w.id, { feeling: w.feeling === f.v ? null : f.v })}
                  style={{ flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: w.feeling === f.v ? alpha(accent, 0.14) : c.surface, borderWidth: 1, borderColor: w.feeling === f.v ? accent : c.border }}
                >
                  <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
                </Press>
              ))}
            </View>
          </View>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="TIME" value={fmtDur(w.duration_sec)} />
            <Stat label="VOLUME" value={fmtVolume(w.volume)} unit="KG" />
            <Stat label="SETS" value={String(w.sets_count)} />
          </View>
          {feel || w.energy || w.bodyweight ? (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, alignItems: 'center' }}>
              {feel ? (
                <Txt variant="mono">
                  {feel.emoji} {feel.label}
                </Txt>
              ) : null}
              {w.energy ? <Txt variant="mono">⚡ {w.energy}/5</Txt> : null}
              {w.bodyweight ? <Txt variant="mono">{w.bodyweight} KG BW</Txt> : null}
            </View>
          ) : null}
          {w.note && !editing ? (
            <Txt variant="body" color={c.textDim} style={{ marginTop: 12 }}>
              {w.note}
            </Txt>
          ) : null}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <View style={{ height: 300, marginHorizontal: -16, marginVertical: -16, borderRadius: 16, overflow: 'hidden' }}>
              <Body3D colors={colors} palette={palette} background={c.surface} autoRotate onInteract={(a) => setScrollOn(!a)} style={{ flex: 1 }} />
            </View>
        </Card>

        <Section label="EXERCISES" count={w.exercises.length} style={{ marginTop: 22, marginBottom: 10 }} />
        <View style={{ gap: 10 }}>
          {w.exercises.map((we) => {
            const ex = getExercise(we.exercise_id);
            let n = 0;
            return (
              <Card key={we.id} style={{ padding: 14 }}>
                <Press onPress={() => router.push(`/exercise/${ex.id}`)} scaleTo={0.98}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: accent }} numberOfLines={1}>
                    {exName(ex)}
                  </Text>
                </Press>
                <View style={{ marginTop: 8, gap: 2 }}>
                  {we.sets.map((s) => {
                    const lbl = s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : String(++n);
                    return (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                        <Text style={{ width: 22, fontFamily: fonts.display, fontSize: 16, color: s.type === 'normal' ? c.textDim : '#F59E0B' }}>{lbl}</Text>
                        <Txt variant="mono" style={{ flex: 1 }}>
                          {fmtSetValue(s, ex.type)}
                        </Txt>
                        {s.pr?.length ? <Ionicons name="trophy" size={14} color="#F5C542" /> : null}
                      </View>
                    );
                  })}
                </View>
                {we.note ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border }}>
                    <Ionicons name="create-outline" size={14} color={c.textDim} style={{ marginTop: 2 }} />
                    <Txt variant="small" color={c.textDim} style={{ flex: 1 }}>
                      {we.note}
                    </Txt>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>

        <Button label="REPEAT WORKOUT" icon="repeat" onPress={repeat} style={{ marginTop: 22 }} />
        <Button label="SAVE AS ROUTINE" icon="bookmark-outline" variant="outline" onPress={saveAsRoutine} style={{ marginTop: 10 }} />
        <Button label="DELETE WORKOUT" icon="trash-outline" variant="danger" small onPress={del} style={{ marginTop: 18 }} />
      </ScrollView>
      <FxHost inSheet />
    </View>
  );
}
