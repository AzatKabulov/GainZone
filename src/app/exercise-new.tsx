import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FieldLabel, SheetHeader } from '@/components/kit';
import { Button, Card, Chip, Input } from '@/components/ui';
import { EQUIP_NAME, type Equip, type LogType } from '@/data/exerciseTypes';
import { GROUPS, MUSCLE_IDS, MUSCLES, type GroupId, type MuscleId } from '@/data/muscles';
import { haptic } from '@/lib/haptics';
import { useData } from '@/store/data';
import { useFx } from '@/store/fx';
import { useTheme } from '@/theme';

const TYPES: { id: LogType; label: string }[] = [
  { id: 'weight_reps', label: 'KG × REPS' },
  { id: 'bw_reps', label: 'BODYWEIGHT +KG' },
  { id: 'assisted', label: 'ASSISTED −KG' },
  { id: 'time', label: 'TIME' },
  { id: 'cardio', label: 'CARDIO' },
];

export default function NewExercise() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<GroupId>('chest');
  const [equip, setEquip] = useState<Equip>('machine');
  const [type, setType] = useState<LogType>('weight_reps');
  const [primary, setPrimary] = useState<MuscleId[]>([]);
  const [secondary, setSecondary] = useState<MuscleId[]>([]);

  const toggle = (m: MuscleId) => {
    haptic.tap();
    if (primary.includes(m)) {
      setPrimary((p) => p.filter((x) => x !== m));
      setSecondary((s) => [...s, m]);
    } else if (secondary.includes(m)) setSecondary((s) => s.filter((x) => x !== m));
    else setPrimary((p) => [...p, m]);
  };

  const save = () => {
    if (!name.trim()) return haptic.warning();
    const muscles: Partial<Record<MuscleId, number>> = {};
    const pShare = secondary.length ? 70 : 100;
    primary.forEach((m) => (muscles[m] = Math.round(pShare / primary.length)));
    secondary.forEach((m) => (muscles[m] = Math.round((100 - (primary.length ? pShare : 0)) / secondary.length)));
    const row = useData.getState().create('exercises', {
      name: name.trim(),
      name_ru: '',
      grp: group,
      equip,
      log_type: type,
      muscles,
      rest: primary.length > 1 ? 150 : 90,
      notes: '',
    });
    haptic.success();
    useFx.getState().info('EXERCISE CREATED', row.name);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker="NEW" title="EXERCISE" onClose={() => router.back()} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
        <FieldLabel>NAME</FieldLabel>
        <Input value={name} onChangeText={setName} placeholder="Hammer Strength Row" autoFocus />

        <FieldLabel style={{ marginTop: 18 }}>CATEGORY</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GROUPS.map((g) => (
            <Chip key={g.id} label={g.name.toUpperCase()} active={group === g.id} onPress={() => setGroup(g.id)} />
          ))}
        </View>

        <FieldLabel style={{ marginTop: 18 }}>EQUIPMENT</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(EQUIP_NAME) as Equip[]).map((e) => (
            <Chip key={e} label={EQUIP_NAME[e].toUpperCase()} active={equip === e} onPress={() => setEquip(e)} />
          ))}
        </View>

        <FieldLabel style={{ marginTop: 18 }}>LOGGING</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map((t) => (
            <Chip key={t.id} label={t.label} active={type === t.id} onPress={() => setType(t.id)} />
          ))}
        </View>

        <FieldLabel style={{ marginTop: 18 }}>MUSCLES · TAP = MAIN · AGAIN = HELPER</FieldLabel>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MUSCLE_IDS.map((m) => (
              <Chip
                key={m}
                label={MUSCLES[m].en.toUpperCase()}
                active={primary.includes(m) || secondary.includes(m)}
                color={secondary.includes(m) ? c.textDim : undefined}
                onPress={() => toggle(m)}
              />
            ))}
          </View>
        </Card>

        <Button label="CREATE EXERCISE" icon="checkmark" onPress={save} style={{ marginTop: 22 }} disabled={!name.trim()} />
      </ScrollView>
    </View>
  );
}
