import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown } from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** Dimmed backdrop behind a bottom sheet: fades in on its own (the sheet slides, the dim doesn't). */
export function Backdrop({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
      <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onPress} />
    </Animated.View>
  );
}

/** Entering animation for the sheet panel itself. */
export const SHEET_IN = SlideInDown.duration(300).easing(Easing.out(Easing.cubic));
