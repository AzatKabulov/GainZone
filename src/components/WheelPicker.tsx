import { useRef, useState } from 'react';
import { ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';

import { haptic } from '@/lib/haptics';
import { fonts, useTheme } from '@/theme';

const ITEM = 46;
const VISIBLE = 5;

/** iOS-style wheel: scroll, it snaps to the row in the middle band. */
export function WheelPicker<T>({
  items,
  value,
  onChange,
  format,
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  const { c } = useTheme();
  const idx = Math.max(0, items.indexOf(value));
  const last = useRef(idx);
  const [start] = useState(idx);
  const ref = useRef<ScrollViewInstance>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (i !== last.current) {
      last.current = i;
      haptic.tap();
      onChange(items[i]);
    }
  };

  return (
    <View style={{ height: ITEM * VISIBLE, justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: ITEM * Math.floor(VISIBLE / 2), height: ITEM, borderRadius: 14, backgroundColor: c.surface2 }}
      />
      <ScrollView
        ref={ref}
        onLayout={() => ref.current?.scrollTo({ y: start * ITEM, animated: false })}
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: start * ITEM }}
        snapToInterval={ITEM}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: ITEM * Math.floor(VISIBLE / 2) }}
      >
        {items.map((it, i) => {
          const d = Math.abs(i - idx);
          return (
            <View key={i} style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: d === 0 ? fonts.semibold : fonts.body, fontSize: d === 0 ? 22 : 19, color: d === 0 ? c.text : d === 1 ? c.textDim : c.textFaint }}>
                {format(it)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
