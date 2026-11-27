import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtRest, REST_PRESETS } from '@/components/ExerciseBlock';
import { FxHost } from '@/components/FxHost';
import { SwipeDelete } from '@/components/SwipeDelete';
import { ExerciseThumb, FieldLabel, SheetHeader } from '@/components/kit';
import { Button, Empty, Input, Press, Txt } from '@/components/ui';
import { exName, getExercise, LOG_COLS } from '@/lib/exercise';
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
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const existing = useData((s) => (id && id !== 'new' ? s.templates[id] : undefined));
  const [name, setName] = useState(existing?.name ?? '');
  const [items, setItems] = useState<TemplateExercise[]>(existing?.exercises ?? []);
  const isNew = !existing;

  const patchItem = (iid: string, fn: (t: TemplateExercise) => TemplateExercise) => setItems((l) => l.map((t) => (t.id === iid ? fn(t) : t)));

  const addExercises = () => {
    setPickHandler(
      (ids) =>
        setItems((l) => [
          ...l,
          ...ids.map((eid) => {
            const ex = getExercise(eid);
            return {
              id: uuid(),
              exercise_id: eid,
              rest: ex.rest,
              note: '',
              split: !!ex.uni,
              sets: [0, 1, 2].map((): TemplateSet => ({ type: 'normal', weight: null, reps: null, reps_r: null })),
            };
          }),
        ]),
      { multi: true, title: 'ADD EXERCISES' },
    );
    router.push('/pick');
  };

  const save = (thenStart = false) => {
    const clean = name.trim() || 'New Routine';
    let tid = existing?.id;
    if (existing) useData.getState().patch('templates', existing.id, { name: clean, exercises: items });
    else tid = useData.getState().create('templates', { name: clean, exercises: items, sort_order: Date.now() }).id;
    haptic.success();
    useFx.getState().info(isNew ? 'ROUTINE CREATED' : 'ROUTINE SAVED', clean);
    if (thenStart && tid) {
      if (!useActive.getState().workout) startWorkout(tid);
      router.dismissAll();
      router.push('/workout');
    } else router.back();
  };

  const del = () =>
    existing &&
    confirm('Delete routine?', 'Your workout history stays.', 'Delete', () => {
      useData.getState().remove('templates', existing.id);
      haptic.warning();
      useFx.getState().info('ROUTINE DELETED', existing.name, { icon: 'undo', onPress: () => useData.getState().restore('templates', existing.id) });
      router.back();
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker={isNew ? 'NEW' : 'EDIT'} title="ROUTINE" onClose={() => router.back()} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }}>
        <FieldLabel>NAME</FieldLabel>
        <Input value={name} onChangeText={setName} placeholder="Chest + Back" autoFocus={isNew} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 4 }}>
          <Txt variant="label" color={c.text}>
            EXERCISES
          </Txt>
          <Txt variant="label" color={c.textFaint}>
            {String(items.length).padStart(2, '0')}
          </Txt>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        </View>

        {items.length === 0 ? <Empty icon="list-outline" title="NO EXERCISES" /> : null}

        {items.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.duration(300)} layout={LinearTransition.springify().damping(18)}>
            <RoutineExercise
              t={t}
              first={i === 0}
              last={i === items.length - 1}
              onChange={(fn) => patchItem(t.id, fn)}
              onMove={(dir) =>
                setItems((l) => {
                  const n = [...l];
                  [n[i], n[i + dir]] = [n[i + dir], n[i]];
                  return n;
                })
              }
              onRemove={() => setItems((l) => l.filter((x) => x.id !== t.id))}
            />
          </Animated.View>
        ))}

        <Button label="ADD EXERCISES" icon="add" variant="outline" onPress={addExercises} style={{ marginTop: 14 }} />
        <Button label={isNew ? 'CREATE ROUTINE' : 'SAVE'} icon="checkmark" onPress={() => save(false)} style={{ marginTop: 22 }} />
        {items.length ? <Button label="SAVE & START" icon="play" variant="outline" onPress={() => save(true)} style={{ marginTop: 10 }} /> : null}
        {!isNew ? (
          <Press tapHaptic onPress={del} style={{ alignSelf: 'center', paddingVertical: 14, marginTop: 8 }}>
            <Txt variant="label" color={c.danger}>
              DELETE ROUTINE
            </Txt>
          </Press>
        ) : null}
      </ScrollView>
      <FxHost inSheet />
    </View>
  );
}

function RoutineExercise({
  t,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  t: TemplateExercise;
  first: boolean;
  last: boolean;
  onChange: (fn: (t: TemplateExercise) => TemplateExercise) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { c, accent, isDark } = useTheme();
  const ex = getExercise(t.exercise_id);
  const cols = LOG_COLS[ex.type];
  const canSplit = ex.type === 'weight_reps' || ex.type === 'bw_reps' || ex.type === 'assisted';
  const split = (t.split ?? !!ex.uni) && canSplit;
  const timeOnly = ex.type === 'time';
  const [noteOpen, setNoteOpen] = useState(!!t.note);
  const setSet = (k: number, patch: Partial<TemplateSet>) => onChange((x) => ({ ...x, sets: x.sets.map((y, j) => (j === k ? { ...y, ...patch } : y)) }));

  const menu = () =>
    openMenu(exName(ex), [
      ...(canSplit ? [{ label: split ? 'One reps field' : 'Left / right reps', onPress: () => onChange((x) => ({ ...x, split: !split })) }] : []),
      ...(!first ? [{ label: 'Move up', onPress: () => onMove(-1) }] : []),
      ...(!last ? [{ label: 'Move down', onPress: () => onMove(1) }] : []),
      {
        label: 'Replace exercise',
        onPress: () => {
          setPickHandler((ids) => onChange((x) => ({ ...x, exercise_id: ids[0] })), { multi: false, title: 'REPLACE' });
          router.push('/pick');
        },
      },
      { label: 'Remove', destructive: true, onPress: onRemove },
    ]);

  let n = 0;
  return (
    <View style={{ marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ExerciseThumb ex={ex} size={40} />
        <Txt variant="title" style={{ flex: 1 }} numberOfLines={2}>
          {exName(ex)}
        </Txt>
        <Press hitSlop={6} scaleTo={0.9} onPress={menu} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color={c.text} />
        </Press>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pill
          icon="timer-outline"
          label={fmtRest(t.rest)}
          active={t.rest > 0}
          onPress={() => openMenu('Rest timer', REST_PRESETS.map((s) => ({ label: (s === 0 ? 'Off' : fmtRest(s)) + (s === t.rest ? '  ✓' : ''), onPress: () => onChange((x) => ({ ...x, rest: s })) })))}
        />
        <Pill icon={t.note ? 'pin' : 'pin-outline'} label="Note" active={!!t.note} onPress={() => setNoteOpen((v) => !v)} />
        {split ? <Pill icon="git-compare-outline" label="L / R" active onPress={() => onChange((x) => ({ ...x, split: false }))} /> : null}
      </View>
      {noteOpen ? (
        <Animated.View entering={FadeIn.duration(180)}>
          <TextInput
            value={t.note}
            onChangeText={(v) => onChange((x) => ({ ...x, note: v }))}
            placeholder="Pinned note"
            placeholderTextColor={c.textFaint}
            selectionColor={accent}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            style={{ marginTop: 10, height: 40, backgroundColor: c.surface2, borderRadius: 10, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 14, color: c.text }}
          />
        </Animated.View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 2 }}>
        <Head w={32}>SET</Head>
        {!timeOnly ? <Head flex>{cols[0]}</Head> : null}
        {split ? (
          <>
            <Head flex>L</Head>
            <Head flex>R</Head>
          </>
        ) : (
          <Head flex>{cols[1]}</Head>
        )}
      </View>
      {t.sets.map((s, k) => {
        const warm = s.type === 'warmup';
        if (!warm) n++;
        return (
          <Animated.View key={k} entering={FadeIn.duration(200)}>
           <SwipeDelete onDelete={() => onChange((x) => ({ ...x, sets: x.sets.filter((_, j) => j !== k) }))}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, backgroundColor: c.surface }}>
            <Press
              onPress={() => setSet(k, { type: warm ? 'normal' : 'warmup' })}
              style={{ width: 32, height: 36, borderRadius: 9, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 17, color: warm ? '#F59E0B' : c.text, marginTop: 2 }}>{warm ? 'W' : n}</Text>
            </Press>
            {!timeOnly ? (
              <Field value={ex.type === 'cardio' ? (s.time ?? null) : s.weight} onChange={(v) => setSet(k, ex.type === 'cardio' ? { time: v } : { weight: v })} />
            ) : null}
            {split ? (
              <>
                <Field value={s.reps} onChange={(v) => setSet(k, { reps: v })} />
                <Field value={s.reps_r ?? null} onChange={(v) => setSet(k, { reps_r: v })} />
              </>
            ) : (
              <Field
                value={ex.type === 'cardio' ? (s.dist ?? null) : timeOnly ? (s.time ?? null) : s.reps}
                onChange={(v) => setSet(k, ex.type === 'cardio' ? { dist: v } : timeOnly ? { time: v } : { reps: v })}
              />
            )}
           </View>
           </SwipeDelete>
          </Animated.View>
        );
      })}
      <Press
        tapHaptic
        onPress={() => onChange((x) => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { weight: null, reps: null, reps_r: null }), type: 'normal' }] }))}
        style={{ marginTop: 8, height: 38, borderRadius: 10, backgroundColor: c.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Ionicons name="add" size={16} color={c.textDim} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: c.textDim }}>ADD SET</Text>
      </Press>
    </View>
  );
}

function Head({ children, w, flex }: { children: string; w?: number; flex?: boolean }) {
  return (
    <Txt variant="label" style={{ width: w, flex: flex ? 1 : undefined, textAlign: w ? 'left' : 'center', fontSize: 9.5, letterSpacing: 1.2 }}>
      {children}
    </Txt>
  );
}

function Pill({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  const { c, accent } = useTheme();
  return (
    <Press tapHaptic onPress={onPress} style={{ height: 30, paddingHorizontal: 11, borderRadius: 9, backgroundColor: active ? alpha(accent, 0.12) : c.surface2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={13} color={active ? accent : c.textDim} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: active ? c.text : c.textDim }}>{label}</Text>
    </Press>
  );
}

function Field({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { c, accent, isDark } = useTheme();
  const [text, setText] = useState(value === null || value === undefined ? '' : fmtKg(value));
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
      style={{ flex: 1, width: 0, minWidth: 0, height: 36, borderRadius: 10, backgroundColor: c.surface2, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 16, color: c.text, paddingVertical: 0 }}
    />
  );
}
