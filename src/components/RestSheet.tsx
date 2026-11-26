import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Button, Txt } from './ui';
import { WheelPicker } from './WheelPicker';

export const REST_VALUES = Array.from({ length: 61 }, (_, i) => i * 5);

/** 0 → 'off', 45 → '45s', 120 → '2min 0s' */
export function fmtRestLong(s: number): string {
  if (!s) return 'off';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min ${s % 60}s`;
}

/** Bottom sheet with a wheel to pick a rest time (Hevy-style). */
export function RestSheet({
  visible,
  title,
  subtitle,
  value,
  action = 'DONE',
  onDone,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  value: number;
  action?: string;
  onDone: (seconds: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? <Body title={title} subtitle={subtitle} value={value} action={action} onDone={onDone} onClose={onClose} /> : null}
    </Modal>
  );
}

function Body({ title, subtitle, value, action, onDone, onClose }: { title: string; subtitle?: string; value: number; action: string; onDone: (s: number) => void; onClose: () => void }) {
  const { c, accent } = useTheme();
  const insets = useSafeAreaInsets();
  const [v, setV] = useState(REST_VALUES.includes(value) ? value : 120);
  return (
    <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} />
      <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 14 }} />
        <View style={{ alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border, marginHorizontal: -20 }}>
          <Txt variant="label" color={accent}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="title" numberOfLines={1} style={{ marginTop: 4, paddingHorizontal: 20 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        <View style={{ marginTop: 16 }}>
          <WheelPicker items={REST_VALUES} value={v} onChange={setV} format={fmtRestLong} />
        </View>
        <Button label={action} onPress={() => onDone(v)} style={{ marginTop: 16 }} />
      </View>
    </KeyboardAvoidingView>
  );
}
