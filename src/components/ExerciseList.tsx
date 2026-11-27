import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { FlatList, View, type ListRenderItem } from 'react-native';

import { muscleBreakdown, searchExercises, type ExerciseDef } from '@/data/exercises';
import { EQUIP_NAME, type Equip } from '@/data/exerciseTypes';
import { GROUPS, MUSCLES } from '@/data/muscles';
import { useAllExercises, useExName } from '@/lib/exercise';
import { bestSet, finishedWorkouts, fmtKg, topReps } from '@/lib/stats';
import { useData } from '@/store/data';
import { alpha, useTheme } from '@/theme';
import { EquipSheet, FilterButton, matchEquip, matchMuscle, MUSCLE_FILTERS, MuscleSheet } from './ExerciseFilters';
import { ExerciseThumb } from './kit';
import { Button, Input, Press, Txt } from './ui';

type Item = { kind: 'header'; key: string; label: string; count: number } | { kind: 'ex'; key: string; ex: ExerciseDef };

/** Searchable, grouped exercise list (used by the library tab and the picker). */
export function ExerciseList({
  selected,
  onPress,
  header,
  bottomPad = 0,
}: {
  selected?: string[];
  onPress: (ex: ExerciseDef) => void;
  header?: React.ReactElement;
  bottomPad?: number;
}) {
  const { c, accent } = useTheme();
  const all = useAllExercises();
  const workouts = useData((s) => s.workouts);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equip, setEquip] = useState<Equip | null>(null);
  const [sheet, setSheet] = useState<'muscle' | 'equip' | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    const list = finishedWorkouts(workouts);
    list.forEach((w, wi) => w.exercises.forEach((we) => m.set(we.exercise_id, Math.max(m.get(we.exercise_id) ?? 0, list.length - wi))));
    return m;
  }, [workouts]);

  // last top set per exercise ("60×10"), newest session wins
  const lastTop = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of finishedWorkouts(workouts))
      for (const we of w.exercises) {
        if (m.has(we.exercise_id)) continue;
        const b = bestSet(we);
        if (b) m.set(we.exercise_id, b.weight ? `${fmtKg(b.weight)}×${topReps(b)}` : b.time ? `${b.time}s` : `${topReps(b)} reps`);
      }
    return m;
  }, [workouts]);

  const searched = useMemo(() => (q ? searchExercises(all, q) : all), [all, q]);

  const items = useMemo<Item[]>(() => {
    const list = searched.filter((e) => matchMuscle(e, muscle) && matchEquip(e, equip));
    if (q || muscle || equip) {
      if (!list.length) return [];
      return [{ kind: 'header' as const, key: 'h-res', label: 'RESULTS', count: list.length }, ...list.map((ex) => ({ kind: 'ex' as const, key: ex.id, ex }))];
    }
    const out: Item[] = [];
    const recent = list.filter((e) => usage.has(e.id)).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)).slice(0, 6);
    if (recent.length) {
      out.push({ kind: 'header', key: 'h-recent', label: 'RECENT', count: recent.length });
      for (const ex of recent) out.push({ kind: 'ex', key: `r-${ex.id}`, ex });
    }
    for (const g of GROUPS) {
      const inG = list.filter((e) => e.group === g.id);
      if (!inG.length) continue;
      out.push({ kind: 'header', key: `h-${g.id}`, label: g.name.toUpperCase(), count: inG.length });
      for (const ex of inG) out.push({ kind: 'ex', key: ex.id, ex });
    }
    return out;
  }, [searched, q, muscle, equip, usage]);

  const muscleCount = (id: string | null) => searched.filter((e) => matchMuscle(e, id) && matchEquip(e, equip)).length;
  const equipCount = (e: Equip | null) => searched.filter((x) => matchMuscle(x, muscle) && matchEquip(x, e)).length;
  const muscleLabel = MUSCLE_FILTERS.find((f) => f.id === muscle)?.label;

  const sel = useMemo(() => new Set(selected ?? []), [selected]);

  const renderItem: ListRenderItem<Item> = ({ item }) =>
    item.kind === 'header' ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
        <Txt variant="label" color={c.text}>
          {item.label}
        </Txt>
        <Txt variant="label" color={c.textFaint}>
          {String(item.count).padStart(2, '0')}
        </Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>
    ) : (
      <Row ex={item.ex} selected={sel.has(item.ex.id)} onPress={onPress} accent={accent} last={lastTop.get(item.ex.id)} />
    );

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={18}
      windowSize={9}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      ListHeaderComponent={
        <View>
          {header}
          <View style={{ paddingHorizontal: 20 }}>
            <View>
              <Input value={q} onChangeText={setQ} placeholder="Search exercises" autoCorrect={false} style={{ paddingLeft: 40 }} />
              <Ionicons name="search" size={17} color={c.textFaint} style={{ position: 'absolute', left: 14, top: 15 }} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 10 }}>
            <FilterButton label={equip ? EQUIP_NAME[equip] : 'All Equipment'} active={!!equip} onPress={() => setSheet('equip')} onClear={() => setEquip(null)} />
            <FilterButton label={muscleLabel ?? 'All Muscles'} active={!!muscle} onPress={() => setSheet('muscle')} onClear={() => setMuscle(null)} />
          </View>
          <MuscleSheet
            visible={sheet === 'muscle'}
            value={muscle}
            countFor={muscleCount}
            onClose={() => setSheet(null)}
            onApply={(id) => {
              setMuscle(id);
              setSheet(null);
            }}
          />
          <EquipSheet
            visible={sheet === 'equip'}
            value={equip}
            countFor={equipCount}
            onClose={() => setSheet(null)}
            onApply={(e) => {
              setEquip(e);
              setSheet(null);
            }}
          />
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', padding: 30, gap: 12 }}>
          <Txt variant="small" color={c.textDim}>
            Nothing found.
          </Txt>
          {q.trim() ? <Button label={`CREATE “${q.trim()}”`} icon="add" small variant="outline" onPress={() => router.push(`/exercise-new?name=${encodeURIComponent(q.trim())}`)} /> : null}
        </View>
      }
    />
  );
}

const Row = memo(function Row({ ex, selected, onPress, accent, last }: { ex: ExerciseDef; selected: boolean; onPress: (e: ExerciseDef) => void; accent: string; last?: string }) {
  const { c } = useTheme();
  const exName = useExName();
  const prim = muscleBreakdown(ex)
    .filter((m) => m.role === 'primary')
    .map((m) => MUSCLES[m.id].en)
    .join(', ');
  return (
    <Press
      scaleTo={0.985}
      onPress={() => onPress(ex)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: 20,
        marginBottom: 8,
        padding: 10,
        borderRadius: 14,
        backgroundColor: selected ? alpha(accent, 0.1) : c.surface,
        borderWidth: 1,
        borderColor: selected ? alpha(accent, 0.55) : c.border,
      }}
    >
      <ExerciseThumb ex={ex} size={50} />
      <View style={{ flex: 1 }}>
        <Txt variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {exName(ex)}
        </Txt>
        <Txt variant="label" color={c.textFaint} numberOfLines={1} style={{ fontSize: 9, marginTop: 4 }}>
          {(prim || '—').toUpperCase()} · {EQUIP_NAME[ex.equip].toUpperCase()}
          {ex.custom ? ' · CUSTOM' : ''}
        </Txt>
      </View>
      {last && !selected ? (
        <Txt variant="mono" color={c.textDim} style={{ fontSize: 12 }}>
          {last}
        </Txt>
      ) : null}
      {selected ? (
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-sharp" size={18} color={c.bg} />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
      )}
    </Press>
  );
});
