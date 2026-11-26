import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtRest, REST_PRESETS } from '@/components/ExerciseBlock';
import { FxHost } from '@/components/FxHost';
import { ExerciseThumb, FieldLabel, SheetHeader } from '@/components/kit';
import { Button, Empty, Input, Press, Txt } from '@/components/ui';
import { exAltName, getExercise, LOG_COLS, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { confirm, openMenu } from '@/lib/menu';
import { setPickHandler } from '@/lib/pick';
import { fmtKg } from '@/lib/stats';
import { startWorkout } from '@/lib/workout';
import { useActive } from '@/store/active';
import { useData, uuid, type TemplateExercise, type TemplateSet } from '@/store/data';
import { useFx } from '@/store/fx';
import { alpha, fonts, useTheme } from '@/theme';

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const existing = useData((s) => (id && id !== 'new' ? s.templates[id] : undefined));
  const exName = useExName();
  const [name, setName] = useState(existing?.name ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [items, setItems] = useState<TemplateExercise[]>(existing?.exercises ?? []);
  const isNew = !existing;

  const patchItem = (iid: string, fn: (t: TemplateExercise) => TemplateExercise) => setItems((l) => l.map((t) => (t.id === iid ? fn(t) : t)));

  const addExercises = () => {
    setPickHandler(
      (ids) =>
        setItems((l) => [
          ...l,
          ...ids.map((eid) => ({
            id: uuid(),
            exercise_id: eid,
            rest: getExercise(eid).rest,
            note: '',
            sets: [0, 1, 2].map((): TemplateSet => ({ type: 'normal', weight: null, reps: null })),
          })),
        ]),
      { multi: true, title: 'ADD EXERCISES' },
    );
    router.push('/pick');
  };

  const save = (thenStart = false) => {
    const clean = name.trim() || 'New Routine';
    let tid = existing?.id;
    if (existing) {
      useData.getState().patch('templates', existing.id, { name: clean, note, exercises: items });
    } else {
      tid = useData.getState().create('templates', { name: clean, note, exercises: items, sort_order: Date.now() }).id;
    }
    haptic.success();
    useFx.getState().info(isNew ? 'ROUTINE CREATED' : 'ROUTINE SAVED', clean);
    if (thenStart && tid) {
      if (!useActive.getState().workout) startWorkout(tid);
      router.replace('/workout');
    } else router.back();
  };

  const del = () =>
    existing &&
    confirm('Delete routine?', 'Your workout history stays. Only the routine is removed.', 'Delete', () => {
      useData.getState().remove('templates', existing.id);
      haptic.warning();
      useFx.getState().info('ROUTINE DELETED', existing.name, { icon: 'undo', onPress: () => useData.getState().restore('templates', existing.id) });
      router.back();
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker={isNew ? 'NEW' : 'EDIT'} title="ROUTINE" onClose={() => router.back()} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
        <FieldLabel>NAME</FieldLabel>
        <Input value={name} onChangeText={setName} placeholder="Day 1 — Chest + Back" autoFocus={isNew} />
        <FieldLabel style={{ marginTop: 16 }}>NOTE</FieldLabel>
        <Input value={note} onChangeText={setNote} placeholder="Optional: focus, tempo, plan" multiline />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10 }}>
          <Txt variant="label" color={c.text}>
            EXERCISES
          </Txt>
          <Txt variant="label" color={c.textFaint}>
            {String(items.length).padStart(2, '0')}
          </Txt>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        </View>

        {items.length === 0 ? <Empty icon="list-outline" title="NO EXERCISES" text="Add exercises, sets and rest times. Targets are optional." /> : null}

        <View style={{ gap: 10 }}>
          {items.map((t, i) => {
            const ex = getExercise(t.exercise_id);
            const cols = LOG_COLS[ex.type];
            return (
              <Animated.View key={t.id} entering={FadeInDown.duration(300)} layout={LinearTransition.springify().damping(18)} style={{ padding: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <ExerciseThumb ex={ex} size={42} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {exName(ex)}
                    </Txt>
                    <Txt variant="small" color={c.textFaint} numberOfLines={1}>
                      {exAltName(ex)}
                    </Txt>
                  </View>
                  <Press
                    hitSlop={10}
                    scaleTo={0.9}
                    onPress={() =>
                      openMenu(exName(ex), [
                        ...(i > 0 ? [{ label: 'Move up', onPress: () => setItems((l) => swap(l, i, i - 1)) }] : []),
                        ...(i < items.length - 1 ? [{ label: 'Move down', onPress: () => setItems((l) => swap(l, i, i + 1)) }] : []),
                        {
                          label: 'Replace exercise',
                          onPress: () => {
                            setPickHandler((ids) => patchItem(t.id, (x) => ({ ...x, exercise_id: ids[0] })), { multi: false, title: 'REPLACE EXERCISE' });
                            router.push('/pick');
                          },
                        },
                        { label: 'Remove', destructive: true, onPress: () => setItems((l) => l.filter((x) => x.id !== t.id)) },
                      ])
                    }
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={c.textDim} />
                  </Press>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Press
                    tapHaptic
                    onPress={() =>
                      openMenu(
                        'Rest timer',
                        REST_PRESETS.map((s) => ({ label: s === 0 ? 'Off' : fmtRest(s) + (s === t.rest ? '  ✓' : ''), onPress: () => patchItem(t.id, (x) => ({ ...x, rest: s })) })),
                      )
                    }
                    style={{ height: 30, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: alpha(accent, 0.5), backgroundColor: alpha(accent, 0.1), flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons name="timer-outline" size={13} color={accent} />
                    <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: c.text }}>REST {fmtRest(t.rest)}</Text>
                  </Press>
                </View>

                <TextInput
                  value={t.note}
                  onChangeText={(v) => patchItem(t.id, (x) => ({ ...x, note: v }))}
                  placeholder="📌 Pinned note — shown every session (seat 4, cues…)"
                  placeholderTextColor={c.textFaint}
                  selectionColor={accent}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  multiline
                  style={{ marginTop: 10, backgroundColor: c.surface2, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 9, fontFamily: fonts.body, fontSize: 14, color: c.text }}
                />

                <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
                  <Txt variant="label" style={{ width: 44, fontSize: 9.5 }}>
                    SET
                  </Txt>
                  <View style={{ flex: 1 }} />
                  {ex.type !== 'time' ? (
                    <Txt variant="label" style={{ width: 76, textAlign: 'center', fontSize: 9.5 }}>
                      {cols[0]}
                    </Txt>
                  ) : null}
                  <Txt variant="label" style={{ width: 70, textAlign: 'center', fontSize: 9.5, marginLeft: 8 }}>
                    {cols[1]}
                  </Txt>
                  <View style={{ width: 34 }} />
                </View>
                {t.sets.map((s, si) => (
                  <Animated.View key={si} entering={FadeIn.duration(200)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                    <Press
                      onPress={() => patchItem(t.id, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === si ? { ...y, type: y.type === 'warmup' ? 'normal' : 'warmup' } : y)) }))}
                      style={{ width: 32, height: 30, borderRadius: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: s.type === 'warmup' ? '#F59E0B' : c.text, marginTop: 2 }}>
                        {s.type === 'warmup' ? 'W' : si + 1 - t.sets.slice(0, si).filter((y) => y.type === 'warmup').length}
                      </Text>
                    </Press>
                    <View style={{ flex: 1 }} />
                    {ex.type !== 'time' ? (
                      <TargetField
                        value={ex.type === 'cardio' ? (s.time ?? null) : s.weight}
                        onChange={(v) => patchItem(t.id, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === si ? (ex.type === 'cardio' ? { ...y, time: v } : { ...y, weight: v }) : y)) }))}
                        width={76}
                      />
                    ) : null}
                    <TargetField
                      value={ex.type === 'cardio' ? (s.dist ?? null) : ex.type === 'time' ? (s.time ?? null) : s.reps}
                      onChange={(v) =>
                        patchItem(t.id, (x) => ({
                          ...x,
                          sets: x.sets.map((y, k) => (k === si ? (ex.type === 'cardio' ? { ...y, dist: v } : ex.type === 'time' ? { ...y, time: v } : { ...y, reps: v }) : y)),
                        }))
                      }
                      width={70}
                      style={{ marginLeft: 8 }}
                    />
                    <Press hitSlop={8} onPress={() => patchItem(t.id, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== si) }))} style={{ width: 34, alignItems: 'flex-end' }}>
                      <Ionicons name="close" size={18} color={c.textFaint} />
                    </Press>
                  </Animated.View>
                ))}
                <Press
                  tapHaptic
                  onPress={() => patchItem(t.id, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { type: 'normal', weight: null, reps: null }), type: 'normal' }] }))}
                  style={{ marginTop: 8, height: 36, borderRadius: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Ionicons name="add" size={15} color={c.text} />
                  <Text style={{ fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.2, color: c.text, marginTop: 2 }}>ADD SET</Text>
                </Press>
              </Animated.View>
            );
          })}
        </View>

        <Button label="ADD EXERCISES" icon="add" variant="outline" onPress={addExercises} style={{ marginTop: 14 }} />
        <Button label={isNew ? 'CREATE ROUTINE' : 'SAVE ROUTINE'} icon="checkmark" onPress={() => save(false)} style={{ marginTop: 22 }} />
        {items.length ? <Button label="SAVE & START" icon="play" variant="outline" onPress={() => save(true)} style={{ marginTop: 10 }} /> : null}
        {!isNew ? <Button label="DELETE ROUTINE" icon="trash-outline" variant="danger" small onPress={del} style={{ marginTop: 18 }} /> : null}
      </ScrollView>
      <FxHost inSheet />
    </View>
  );
}

function swap<T>(l: T[], a: number, b: number): T[] {
  const n = [...l];
  [n[a], n[b]] = [n[b], n[a]];
  return n;
}

function TargetField({ value, onChange, width, style }: { value: number | null; onChange: (v: number | null) => void; width: number; style?: object }) {
  const { c, accent, isDark } = useTheme();
  const [text, setText] = useState(value === null ? '' : fmtKg(value));
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(',', '.').replace(/[^0-9.]/g, '');
        setText(clean);
        onChange(clean === '' ? null : Number(clean));
      }}
      keyboardType="decimal-pad"
      keyboardAppearance={isDark ? 'dark' : 'light'}
      selectionColor={accent}
      placeholder="—"
      placeholderTextColor={c.textFaint}
      style={[{ width, height: 34, borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: c.text, paddingVertical: 0 }, style]}
    />
  );
}
