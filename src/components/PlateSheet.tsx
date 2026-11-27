import { useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtKg } from '@/lib/stats';
import { fonts, useTheme } from '@/theme';
import { Backdrop, SHEET_IN } from './Backdrop';
import { Chip, Txt } from './ui';

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
// competition colours
const PLATE_COLOR: Record<number, string> = { 25: '#E5484D', 20: '#3E7BFA', 15: '#F5C542', 10: '#30A46C', 5: '#EDEDED', 2.5: '#3A3A40', 1.25: '#9BA1A6' };
const BARS = [20, 15, 10];

/** Plates per side for a target barbell weight (greedy, standard plates). */
export function platesFor(target: number, bar: number): { plates: number[]; rest: number } {
  let left = Math.max(0, (target - bar) / 2);
  const plates: number[] = [];
  for (const p of PLATES)
    while (left >= p - 1e-9) {
      plates.push(p);
      left -= p;
    }
  return { plates, rest: Math.round(left * 2 * 100) / 100 };
}

/** Bottom sheet: which plates to load on each side of the bar. */
export function PlateSheet({ kg, onClose }: { kg: number | null; onClose: () => void }) {
  return (
    <Modal visible={kg !== null} transparent animationType="none" onRequestClose={onClose}>
      {kg !== null ? <Body initial={kg} onClose={onClose} /> : null}
    </Modal>
  );
}

function Body({ initial, onClose }: { initial: number; onClose: () => void }) {
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial ? fmtKg(initial) : '');
  const [bar, setBar] = useState(20);
  const target = Number(text.replace(',', '.')) || 0;
  const { plates, rest } = platesFor(target, bar);

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Backdrop onPress={onClose} />
      <Animated.View entering={SHEET_IN} style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 20 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 14 }} />
        <Txt variant="label" color={accent}>
          PLATE CALCULATOR
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 }}>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            keyboardAppearance={isDark ? 'dark' : 'light'}
            selectionColor={accent}
            placeholder="100"
            placeholderTextColor={c.textFaint}
            style={{ fontFamily: fonts.display, fontSize: 52, lineHeight: 56, color: c.text, width: 170, padding: 0 }}
          />
          <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: c.textDim, marginBottom: 10 }}>KG TOTAL</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {BARS.map((b) => (
            <Chip key={b} label={`BAR ${b}`} active={bar === b} onPress={() => setBar(b)} />
          ))}
        </View>

        {/* the bar, one side drawn */}
        <View style={{ height: 120, marginTop: 22, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 46, height: 14, borderRadius: 3, backgroundColor: c.textFaint }} />
          <View style={{ width: 10, height: 34, borderRadius: 2, backgroundColor: c.textDim }} />
          {plates.map((p, i) => (
            <View
              key={i}
              style={{
                width: p >= 10 ? 16 : 11,
                height: 40 + (p / 25) * 76,
                marginLeft: 2,
                borderRadius: 3,
                backgroundColor: PLATE_COLOR[p],
                borderWidth: p === 2.5 ? 1 : 0,
                borderColor: c.borderStrong,
              }}
            />
          ))}
          <View style={{ flex: 1, height: 14, marginLeft: 2, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: c.textFaint }} />
        </View>

        <Txt variant="label" style={{ marginTop: 16 }}>
          EACH SIDE
        </Txt>
        <Txt variant="h2" style={{ marginTop: 4 }}>
          {target <= bar ? 'JUST THE BAR' : plates.length ? plates.map(fmtKg).join(' + ') : '—'}
        </Txt>
        {rest > 0 ? (
          <Txt variant="small" color={c.danger} style={{ marginTop: 6 }}>
            {fmtKg(rest)} kg can&apos;t be made with standard plates.
          </Txt>
        ) : null}
      </Animated.View>
    </View>
  );
}
