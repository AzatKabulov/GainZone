import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { FlatList, ScrollView, View, type ListRenderItem } from 'react-native';

import { muscleBreakdown, searchExercises, type ExerciseDef } from '@/data/exercises';
import { EQUIP_NAME } from '@/data/exerciseTypes';
import { GROUPS, MUSCLES, type GroupId } from '@/data/muscles';
import { exAltName, useAllExercises, useExName } from '@/lib/exercise';
import { finishedWorkouts } from '@/lib/stats';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { alpha, useTheme } from '@/theme';
import { ExerciseThumb } from './kit';
import { Chip, Input, Press, Txt } from './ui';

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
  const lang = useSettings((s) => s.exLang);
  const workouts = useData((s) => s.workouts);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<GroupId | 'all' | 'recent'>('all');

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    const list = finishedWorkouts(workouts);
    list.forEach((w, wi) => w.exercises.forEach((we) => m.set(we.exercise_id, Math.max(m.get(we.exercise_id) ?? 0, list.length - wi))));
    return m;
  }, [workouts]);

  const items = useMemo<Item[]>(() => {
    let list = q ? searchExercises(all, q) : all;
    if (group === 'recent') list = list.filter((e) => usage.has(e.id)).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
    else if (group !== 'all') list = list.filter((e) => e.group === group);
    if (q || group === 'recent') return list.map((ex) => ({ kind: 'ex' as const, key: ex.id, ex }));
    const out: Item[] = [];
    for (const g of GROUPS) {
      const inG = list.filter((e) => e.group === g.id);
      if (!inG.length) continue;
      out.push({ kind: 'header', key: `h-${g.id}`, label: g.name.toUpperCase(), count: inG.length });
      for (const ex of inG) out.push({ kind: 'ex', key: ex.id, ex });
    }
    return out;
  }, [all, q, group, usage]);

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
      <Row ex={item.ex} selected={sel.has(item.ex.id)} onPress={onPress} lang={lang} accent={accent} />
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
              <Input value={q} onChangeText={setQ} placeholder="Search: жим, pulldown, молитва…" autoCorrect={false} style={{ paddingLeft: 40 }} />
              <Ionicons name="search" size={17} color={c.textFaint} style={{ position: 'absolute', left: 14, top: 15 }} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 12 }}>
            <Chip label="ALL" active={group === 'all'} onPress={() => setGroup('all')} />
            {usage.size ? <Chip label="RECENT" icon="time-outline" active={group === 'recent'} onPress={() => setGroup('recent')} /> : null}
            {GROUPS.map((g) => (
              <Chip key={g.id} label={g.name.toUpperCase()} active={group === g.id} onPress={() => setGroup(g.id)} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', padding: 30 }}>
          <Txt variant="small" color={c.textDim}>
            Nothing found. Create it as a custom exercise.
          </Txt>
        </View>
      }
    />
  );
}

const Row = memo(function Row({ ex, selected, onPress, lang, accent }: { ex: ExerciseDef; selected: boolean; onPress: (e: ExerciseDef) => void; lang: 'en' | 'ru'; accent: string }) {
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
        <Txt variant="small" color={c.textDim} numberOfLines={1}>
          {exAltName(ex, lang)}
        </Txt>
        <Txt variant="label" color={c.textFaint} numberOfLines={1} style={{ fontSize: 9, marginTop: 3 }}>
          {(prim || '—').toUpperCase()} · {EQUIP_NAME[ex.equip].toUpperCase()}
          {ex.custom ? ' · CUSTOM' : ''}
        </Txt>
      </View>
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
