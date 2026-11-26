import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useTheme } from '@/theme';
import { Button, Txt } from './ui';
import { WheelPicker } from './WheelPicker';

const HOURS = Array.from({ length: 7 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Bottom sheet to set a workout's duration with two wheels (hours · minutes). */
export function DurationSheet({
  visible,
  seconds,
  startedAt,
  onDone,
  onClose,
}: {
  visible: boolean;
  seconds: number;
  /** start time, to show "started at …" (live workouts) */
  startedAt?: 'live' | null;
  onDone: (seconds: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? <Body seconds={seconds} live={startedAt === 'live'} onDone={onDone} onClose={onClose} /> : null}
    </Modal>
  );
}

function Body({ seconds, live, onDone, onClose }: { seconds: number; live: boolean; onDone: (s: number) => void; onClose: () => void }) {
  const { c, accent } = useTheme();
  const insets = useSafeAreaInsets();
  const total = Math.max(0, Math.round(seconds / 60));
  const [h, setH] = useState(Math.min(6, Math.floor(total / 60)));
  const [m, setM] = useState(total % 60);
  const [opened] = useState(() => Date.now());
  const start = new Date(opened - (h * 60 + m) * 60000);
  const hhmm = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} />
      <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 14 }} />
        <View style={{ alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border, marginHorizontal: -20 }}>
          <Txt variant="label" color={accent}>
            DURATION
          </Txt>
          <Txt variant="title" style={{ marginTop: 4 }}>
            {live ? `Started at ${hhmm}` : `${h ? `${h}h ` : ''}${m}min`}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <WheelPicker items={HOURS} value={h} onChange={setH} format={(v) => String(v)} />
          </View>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.4, color: c.textDim, width: 24 }}>H</Text>
          <View style={{ flex: 1 }}>
            <WheelPicker items={MINUTES} value={m} onChange={setM} format={(v) => String(v).padStart(2, '0')} />
          </View>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.4, color: c.textDim, width: 34 }}>MIN</Text>
        </View>
        <Button label="DONE" onPress={() => onDone((h * 60 + m) * 60)} style={{ marginTop: 16 }} />
      </View>
    </View>
  );
}
