import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Equip, ExerciseDef } from '@/data/exerciseTypes';
import { EQUIP_NAME } from '@/data/exerciseTypes';
import { MUSCLE_ICONS } from '@/data/muscleIcons';
import type { MuscleId } from '@/data/muscles';
import { alpha, fonts, useTheme } from '@/theme';
import { Button, Press, Txt, type IconName } from './ui';

/* ─────────────────────────── filter model ─────────────────────────── */

export interface MuscleFilter {
  id: string;
  label: string;
  section: 'UPPER BODY' | 'CORE' | 'LOWER BODY' | 'OTHER';
  muscles: MuscleId[];
  icon?: IconName;
}

export const MUSCLE_FILTERS: MuscleFilter[] = [
  { id: 'chest', label: 'Chest', section: 'UPPER BODY', muscles: ['chest_upper', 'chest_mid', 'chest_lower'] },
  { id: 'shoulders', label: 'Shoulders', section: 'UPPER BODY', muscles: ['delts_front', 'delts_side', 'delts_rear'] },
  { id: 'biceps', label: 'Biceps', section: 'UPPER BODY', muscles: ['biceps'] },
  { id: 'triceps', label: 'Triceps', section: 'UPPER BODY', muscles: ['triceps'] },
  { id: 'forearms', label: 'Forearms', section: 'UPPER BODY', muscles: ['forearms'] },
  { id: 'traps', label: 'Traps', section: 'UPPER BODY', muscles: ['traps'] },
  { id: 'upper_back', label: 'Upper Back', section: 'UPPER BODY', muscles: ['upper_back'] },
  { id: 'lats', label: 'Lats', section: 'UPPER BODY', muscles: ['lats'] },
  { id: 'abs', label: 'Abs', section: 'CORE', muscles: ['abs'] },
  { id: 'obliques', label: 'Obliques', section: 'CORE', muscles: ['obliques'] },
  { id: 'lower_back', label: 'Lower Back', section: 'CORE', muscles: ['lower_back'] },
  { id: 'glutes', label: 'Glutes', section: 'LOWER BODY', muscles: ['glutes'] },
  { id: 'quads', label: 'Quads', section: 'LOWER BODY', muscles: ['quads'] },
  { id: 'hamstrings', label: 'Hamstrings', section: 'LOWER BODY', muscles: ['hamstrings'] },
  { id: 'adductors', label: 'Adductors', section: 'LOWER BODY', muscles: ['adductors'] },
  { id: 'calves', label: 'Calves', section: 'LOWER BODY', muscles: ['calves'] },
  { id: 'cardio', label: 'Cardio', section: 'OTHER', muscles: [], icon: 'heart' },
];

const EQUIP_ICON: Partial<Record<Equip, IconName>> = {
  barbell: 'barbell',
  dumbbell: 'barbell-outline',
  cable: 'git-pull-request-outline',
  machine: 'cog-outline',
  smith: 'grid-outline',
  bodyweight: 'body-outline',
  ezbar: 'remove-outline',
  kettlebell: 'bag-handle-outline',
  band: 'infinite-outline',
  cardio: 'bicycle-outline',
  other: 'ellipsis-horizontal',
};
export const EQUIP_ORDER: Equip[] = ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'bodyweight', 'ezbar', 'kettlebell', 'band', 'cardio', 'other'];

export function matchMuscle(ex: ExerciseDef, f: string | null): boolean {
  if (!f) return true;
  if (f === 'cardio') return ex.group === 'cardio';
  const mf = MUSCLE_FILTERS.find((x) => x.id === f);
  if (!mf) return true;
  return mf.muscles.some((m) => (ex.m[m] ?? 0) >= 25);
}

export function matchEquip(ex: ExerciseDef, e: Equip | null): boolean {
  return !e || ex.equip === e;
}

/* ─────────────────────────── trigger buttons ─────────────────────────── */

export function FilterButton({ label, active, onPress, onClear }: { label: string; active: boolean; onPress: () => void; onClear: () => void }) {
  const { c, accent } = useTheme();
  return (
    <Press
      tapHaptic
      scaleTo={0.97}
      onPress={onPress}
      style={{
        flex: 1,
        height: 42,
        borderRadius: 12,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: active ? alpha(accent, 0.12) : c.surface2,
        borderWidth: 1,
        borderColor: active ? alpha(accent, 0.6) : c.border,
      }}
    >
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: active ? c.text : c.textDim }}>
        {label}
      </Text>
      {active ? (
        <Pressable hitSlop={10} onPress={onClear}>
          <Ionicons name="close-circle" size={17} color={accent} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-down" size={15} color={c.textDim} />
      )}
    </Press>
  );
}

/* ─────────────────────────── sheets ─────────────────────────── */

function Sheet({
  title,
  onClose,
  children,
  count,
  onClear,
  onShow,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  count: number;
  onClear: () => void;
  onShow: () => void;
}) {
  const { c, accent } = useTheme();
  const insets = useSafeAreaInsets();
  return (
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} />
        <View style={{ maxHeight: '86%', backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, paddingTop: 12 }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Txt variant="h2" style={{ flex: 1 }}>
              {title}
              <Text style={{ color: accent }}>.</Text>
            </Txt>
            <Press tapHaptic hitSlop={8} onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={18} color={c.text} />
            </Press>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: c.border }}>
            <Button label="CLEAR" variant="outline" onPress={onClear} style={{ flex: 1 }} />
            <Button label={`SHOW ${count} RESULT${count === 1 ? '' : 'S'}`} onPress={onShow} style={{ flex: 2 }} />
          </View>
        </View>
      </View>
  );
}

export function MuscleSheet({
  visible,
  value,
  countFor,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: string | null;
  countFor: (id: string | null) => number;
  onApply: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? <MuscleBody value={value} countFor={countFor} onApply={onApply} onClose={onClose} /> : null}
    </Modal>
  );
}

function MuscleBody({ value, countFor, onApply, onClose }: { value: string | null; countFor: (id: string | null) => number; onApply: (id: string | null) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<string | null>(value);
  const { width } = useWindowDimensions();
  const [gridW, setGridW] = useState(Math.min(width, 520) - 40);
  const tileW = Math.floor((gridW - 16) / 3) - 1;
  const sections = ['UPPER BODY', 'CORE', 'LOWER BODY', 'OTHER'] as const;
  return (
    <Sheet title="MUSCLE GROUP" onClose={onClose} count={countFor(draft)} onClear={() => setDraft(null)} onShow={() => onApply(draft)}>
      {sections.map((sec) => (
        <View key={sec}>
          <Txt variant="label" style={{ marginTop: 18, marginBottom: 10 }}>
            {sec}
          </Txt>
          <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MUSCLE_FILTERS.filter((f) => f.section === sec).map((f) => (
              <Tile key={f.id} f={f} width={tileW} active={draft === f.id} count={countFor(f.id)} onPress={() => setDraft(draft === f.id ? null : f.id)} />
            ))}
          </View>
        </View>
      ))}
    </Sheet>
  );
}

function Tile({ f, width, active, count, onPress }: { f: MuscleFilter; width: number; active: boolean; count: number; onPress: () => void }) {
  const { c, accent } = useTheme();
  const img = MUSCLE_ICONS[f.id];
  return (
    <Press
      tapHaptic
      scaleTo={0.95}
      onPress={onPress}
      style={{
        width,
        paddingVertical: 10,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: active ? alpha(accent, 0.12) : c.surface2,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? accent : c.border,
      }}
    >
      <View style={{ width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        {f.icon || !img ? <Ionicons name={f.icon ?? 'body-outline'} size={28} color={active ? accent : c.textDim} /> : <Image source={img} style={{ width: 64, height: 64 }} contentFit="cover" />}
      </View>
      <Text numberOfLines={1} style={{ marginTop: 8, fontFamily: fonts.semibold, fontSize: 13, color: active ? c.text : c.textDim }}>
        {f.label}
      </Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1, color: c.textFaint, marginTop: 2 }}>{count}</Text>
    </Press>
  );
}

export function EquipSheet({
  visible,
  value,
  countFor,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: Equip | null;
  countFor: (e: Equip | null) => number;
  onApply: (e: Equip | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? <EquipBody value={value} countFor={countFor} onApply={onApply} onClose={onClose} /> : null}
    </Modal>
  );
}

function EquipBody({ value, countFor, onApply, onClose }: { value: Equip | null; countFor: (e: Equip | null) => number; onApply: (e: Equip | null) => void; onClose: () => void }) {
  const { c, accent } = useTheme();
  const [draft, setDraft] = useState<Equip | null>(value);
  return (
    <Sheet title="EQUIPMENT" onClose={onClose} count={countFor(draft)} onClear={() => setDraft(null)} onShow={() => onApply(draft)}>
      <View style={{ marginTop: 10 }}>
        {EQUIP_ORDER.filter((e) => countFor(e) > 0).map((e) => {
          const on = draft === e;
          return (
            <Press
              key={e}
              tapHaptic
              scaleTo={0.98}
              onPress={() => setDraft(on ? null : e)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: on ? alpha(accent, 0.16) : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={EQUIP_ICON[e] ?? 'barbell-outline'} size={19} color={on ? accent : c.textDim} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15.5, color: c.text }}>{EQUIP_NAME[e]}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: c.textFaint }}>{countFor(e)}</Text>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? accent : c.borderStrong} />
            </Press>
          );
        })}
      </View>
    </Sheet>
  );
}
