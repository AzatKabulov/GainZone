import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body3D } from '@/components/Body3D';
import { DurationSheet } from '@/components/DurationSheet';
import { FxHost } from '@/components/FxHost';
import { FieldLabel, heatColors, SheetHeader, Stat, useBodyPalette } from '@/components/kit';
import { Button, Card, Empty, Input, Press, Section, Txt } from '@/components/ui';
import { MUSCLE_IDS, type MuscleId } from '@/data/muscles';
import { dateKey, relativeLabel } from '@/lib/date';
import { getExercise, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/menu';
import { addExerciseToMuscles, emptyMuscleStats, FEELINGS, fmtDur, fmtKg, fmtSetValue, fmtVolume, workoutTotals } from '@/lib/stats';
import { blankLoggedExercise, setSavedDuration, startOrAsk, startWorkoutFrom, templateFromExercises } from '@/lib/workout';
import { setPickHandler } from '@/lib/pick';
import { useData, uuid, type SetEntry, type WorkoutExercise } from '@/store/data';
import { useFx } from '@/store/fx';
import { alpha, fonts, useTheme } from '@/theme';
import { goBack } from '@/lib/nav';

export default function SessionScreen() {
  const { id, log } = useLocalSearchParams<{ id: string; log?: string }>();
  const { c, accent, isDark } = useTheme();
  const palette = useBodyPalette();
  const [scrollOn, setScrollOn] = useState(true);
  const [durOpen, setDurOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const w = useData((s) => s.workouts[id]);
  const exName = useExName();
  const logging = log === '1';
  const [editing, setEditing] = useState(logging);
  const [draft, setDraft] = useState<WorkoutExercise[] | null>(logging ? [] : null);
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
        <SheetHeader kicker="WORKOUT" title="NOT FOUND" onClose={() => goBack()} />
        <Empty icon="alert-circle-outline" title="GONE" text="This workout was deleted." />
      </View>
    );
  }

  const d = new Date(w.started_at);
  const feel = FEELINGS.find((f) => f.v === w.feeling);

  // a past workout that never got any exercises is thrown away on close
  const close = () => {
    const cur = useData.getState().workouts[w.id];
    if (cur && !cur.exercises.length) useData.getState().remove('workouts', w.id);
    goBack();
  };

  const addLogged = () => {
    setPickHandler((ids) => setDraft((d) => [...(d ?? []), ...ids.map(blankLoggedExercise)]), { multi: true, title: 'ADD EXERCISES' });
    router.push('/pick');
  };

  const startEdit = () => {
    setDraft(w.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })));
    setEditing(true);
  };

  const saveEdit = () => {
    const patch: Partial<typeof w> = { name: name.trim() || w.name, note };
    if (draft) {
      const exercises = draft
        .map((e) => ({ ...e, sets: e.sets.filter((x) => x.weight || x.reps || x.reps_r || x.time || x.dist) }))
        .filter((e) => e.sets.length);
      const t = workoutTotals(exercises);
      Object.assign(patch, { exercises, volume: t.volume, sets_count: t.sets, prs_count: t.prs });
    }
    useData.getState().patch('workouts', w.id, patch);
    setEditing(false);
    setDraft(null);
    haptic.success();
  };

  const repeat = () => startOrAsk(() => startWorkoutFrom(w.name, templateFromExercises(w.exercises)), { replace: true });

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
      goBack();
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader
        kicker={`${relativeLabel(dateKey(d))} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`}
        title={w.name.toUpperCase()}
        onClose={close}
        right={
          <Press tapHaptic onPress={() => (editing ? saveEdit() : startEdit())} style={{ paddingHorizontal: 10, height: 36, justifyContent: 'center' }}>
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
            <Stat label="TIME" value={fmtDur(w.duration_sec)} onPress={() => setDurOpen(true)} />
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
              <Body3D colors={colors} palette={palette} ring={accent} background={c.surface} autoRotate onInteract={(a) => setScrollOn(!a)} style={{ flex: 1 }} />
            </View>
        </Card>

        <Section label="EXERCISES" count={w.exercises.length} style={{ marginTop: 22, marginBottom: 10 }} />
        {editing && draft ? (
          <View style={{ gap: 10 }}>
            {draft.map((we, i) => (
              <EditExercise
                key={we.id}
                we={we}
                onChange={(fn) => setDraft((d) => (d ? d.map((x, k) => (k === i ? fn(x) : x)) : d))}
                onRemove={() => setDraft((d) => (d ? d.filter((_, k) => k !== i) : d))}
              />
            ))}
            <Button label="ADD EXERCISE" icon="add" variant="outline" onPress={addLogged} style={{ marginTop: 6 }} />
            <Button label="SAVE CHANGES" icon="checkmark" onPress={saveEdit} />
          </View>
        ) : null}
        <View style={{ gap: 10, display: editing ? 'none' : 'flex' }}>
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
      <DurationSheet
        visible={durOpen}
        seconds={w.duration_sec}
        onDone={(sec) => {
          setSavedDuration(w.id, sec);
          setDurOpen(false);
        }}
        onClose={() => setDurOpen(false)}
      />
      <FxHost inSheet />
    </View>
  );
}

/** Edit a logged exercise after the fact: fix numbers, add or delete sets. */
function EditExercise({ we, onChange, onRemove }: { we: WorkoutExercise; onChange: (fn: (we: WorkoutExercise) => WorkoutExercise) => void; onRemove: () => void }) {
  const { c, accent } = useTheme();
  const exName = useExName();
  const ex = getExercise(we.exercise_id);
  const fields: (keyof SetEntry)[] =
    ex.type === 'time' ? ['time'] : ex.type === 'cardio' ? ['time', 'dist'] : we.split ? ['weight', 'reps', 'reps_r'] : ['weight', 'reps'];
  const head: Record<string, string> = { weight: ex.type === 'assisted' ? '−KG' : ex.type === 'bw_reps' ? '+KG' : 'KG', reps: we.split ? 'L' : 'REPS', reps_r: 'R', time: ex.type === 'cardio' ? 'MIN' : 'SEC', dist: 'KM' };
  const setField = (id: string, f: keyof SetEntry, v: number | null) => onChange((x) => ({ ...x, sets: x.sets.map((st) => (st.id === id ? { ...st, [f]: v } : st)) }));
  let n = 0;
  return (
    <Card style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: accent }} numberOfLines={1}>
          {exName(ex)}
        </Text>
        <Press tapHaptic hitSlop={8} onPress={onRemove}>
          <Ionicons name="trash-outline" size={18} color={c.danger} />
        </Press>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 }}>
        <Txt variant="label" style={{ width: 26 }}>
          SET
        </Txt>
        {fields.map((f) => (
          <Txt key={f} variant="label" style={{ flex: 1, textAlign: 'center' }}>
            {head[f]}
          </Txt>
        ))}
        <View style={{ width: 26 }} />
      </View>
      {we.sets.map((st) => {
        const lbl = st.type === 'warmup' ? 'W' : st.type === 'drop' ? 'D' : st.type === 'failure' ? 'F' : String(++n);
        return (
          <View key={st.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
            <Text style={{ width: 26, fontFamily: fonts.display, fontSize: 17, color: st.type === 'normal' ? c.textDim : '#F59E0B' }}>{lbl}</Text>
            {fields.map((f) => (
              <EditNum key={f} value={(st[f] as number | null | undefined) ?? null} onChange={(v) => setField(st.id, f, v)} />
            ))}
            <Press tapHaptic hitSlop={8} onPress={() => onChange((x) => ({ ...x, sets: x.sets.filter((q) => q.id !== st.id) }))} style={{ width: 26, alignItems: 'center' }}>
              <Ionicons name="close" size={18} color={c.textFaint} />
            </Press>
          </View>
        );
      })}
      <Press
        tapHaptic
        onPress={() =>
          onChange((x) => {
            const last = x.sets[x.sets.length - 1];
            const add: SetEntry = { id: uuid(), type: 'normal', weight: last?.weight ?? null, reps: last?.reps ?? null, reps_r: last?.reps_r ?? null, time: last?.time ?? null, dist: last?.dist ?? null, done: true, done_at: last?.done_at ?? null, pr: [] };
            return { ...x, sets: [...x.sets, add] };
          })
        }
        style={{ marginTop: 8, height: 36, borderRadius: 10, backgroundColor: c.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Ionicons name="add" size={16} color={c.textDim} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: c.textDim }}>ADD SET</Text>
      </Press>
    </Card>
  );
}

function EditNum({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { c, accent, isDark } = useTheme();
  const [text, setText] = useState(value === null ? '' : fmtKg(value));
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(',', '.').replace(/[^0-9.]/g, '');
        setText(clean);
        const v = clean === '' ? null : Number(clean);
        if (clean === '' || Number.isFinite(v)) onChange(v);
      }}
      keyboardType="decimal-pad"
      keyboardAppearance={isDark ? 'dark' : 'light'}
      selectionColor={accent}
      selectTextOnFocus
      placeholder="—"
      placeholderTextColor={c.textFaint}
      style={{ flex: 1, width: 0, minWidth: 0, height: 38, borderRadius: 9, borderWidth: 1, borderColor: c.borderStrong, textAlign: 'center', fontFamily: fonts.medium, fontSize: 16, color: c.text, paddingVertical: 0 }}
    />
  );
}
