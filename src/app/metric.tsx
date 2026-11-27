import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FxHost } from '@/components/FxHost';
import { FieldLabel, SheetHeader } from '@/components/kit';
import { Button, Card, Input, Press, Section, Txt } from '@/components/ui';
import { addDays, relativeLabel, todayKey } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { metricsSorted } from '@/lib/profile';
import { fmtKg } from '@/lib/stats';
import { useData } from '@/store/data';
import { useFx } from '@/store/fx';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/nav';

export default function MetricScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const metrics = useData((s) => s.metrics);
  const list = useMemo(() => metricsSorted(metrics).reverse(), [metrics]);
  const [date, setDate] = useState(todayKey());
  const existing = list.find((m) => m.date === date);
  const [weight, setWeight] = useState(existing?.weight ? String(existing.weight) : '');
  const [fat, setFat] = useState(existing?.body_fat ? String(existing.body_fat) : '');
  const [waist, setWaist] = useState(existing?.waist ? String(existing.waist) : '');
  const [note, setNote] = useState(existing?.note ?? '');

  const num = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return n > 0 ? n : null;
  };

  const save = () => {
    const patch = { date, weight: num(weight), body_fat: num(fat), waist: num(waist), note: note.trim() };
    if (!patch.weight && !patch.body_fat && !patch.waist) return haptic.warning();
    if (existing) useData.getState().patch('metrics', existing.id, patch);
    else useData.getState().create('metrics', patch);
    haptic.success();
    useFx.getState().info('LOGGED', `${patch.weight ? `${fmtKg(patch.weight)} kg` : 'Measurements'} · ${relativeLabel(date).toLowerCase()}`);
    goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker="BODY" title="LOG WEIGHT" onClose={() => goBack()} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
        <FieldLabel>DAY</FieldLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Press tapHaptic onPress={() => setDate(addDays(date, -1))} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={18} color={c.text} />
          </Press>
          <Txt variant="h2" style={{ flex: 1, textAlign: 'center' }}>
            {relativeLabel(date)}
          </Txt>
          <Press
            tapHaptic
            disabled={date >= todayKey()}
            onPress={() => setDate(addDays(date, 1))}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', opacity: date >= todayKey() ? 0.35 : 1 }}
          >
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </Press>
        </View>

        <FieldLabel style={{ marginTop: 18 }}>BODYWEIGHT, KG</FieldLabel>
        <Input value={weight} onChangeText={setWeight} placeholder="82.5" keyboardType="decimal-pad" autoFocus style={{ fontSize: 22 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <FieldLabel>BODY FAT, %</FieldLabel>
            <Input value={fat} onChangeText={setFat} placeholder="optional" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>WAIST, CM</FieldLabel>
            <Input value={waist} onChangeText={setWaist} placeholder="optional" keyboardType="decimal-pad" />
          </View>
        </View>
        <FieldLabel style={{ marginTop: 14 }}>NOTE</FieldLabel>
        <Input value={note} onChangeText={setNote} placeholder="Morning, fasted…" />
        <Button label="SAVE" icon="checkmark" onPress={save} style={{ marginTop: 20 }} />

        {list.length ? (
          <>
            <Section label="HISTORY" count={list.length} style={{ marginTop: 26, marginBottom: 10 }} />
            <Card style={{ paddingVertical: 4 }}>
              {list.slice(0, 40).map((m, i) => (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, gap: 10 }}>
                  <Txt variant="label" style={{ width: 110 }}>
                    {relativeLabel(m.date)}
                  </Txt>
                  <Txt variant="mono" style={{ flex: 1 }}>
                    {m.weight ? `${fmtKg(m.weight)} KG` : ''}
                    {m.body_fat ? ` · ${fmtKg(m.body_fat)}%` : ''}
                    {m.waist ? ` · ${fmtKg(m.waist)} CM` : ''}
                  </Txt>
                  <Press
                    hitSlop={8}
                    onPress={() => {
                      useData.getState().remove('metrics', m.id);
                      haptic.warning();
                      useFx.getState().info('ENTRY DELETED', relativeLabel(m.date), { icon: 'undo', onPress: () => useData.getState().restore('metrics', m.id) });
                    }}
                  >
                    <Ionicons name="close" size={16} color={c.textFaint} />
                  </Press>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <FxHost inSheet />
    </View>
  );
}
