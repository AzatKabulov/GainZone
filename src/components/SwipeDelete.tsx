import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useRef } from 'react';
import { Pressable, Text } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { fonts, useTheme } from '@/theme';

const ACTION_W = 84;

/** Swipe a row left to reveal a red Delete button. */
export function SwipeDelete({ children, onDelete, enabled = true }: { children: ReactNode; onDelete: () => void; enabled?: boolean }) {
  const ref = useRef<SwipeableMethods>(null);
  const del = () => {
    haptic.warning();
    // close first: rows keyed by index get reused for the next item
    ref.current?.reset();
    onDelete();
  };
  return (
    <Swipeable
      ref={ref}
      enabled={enabled}
      friction={1.6}
      rightThreshold={36}
      overshootRight={false}
      dragOffsetFromRight={-10}
      renderRightActions={(progress, translation) => <Action progress={progress} translation={translation} onPress={del} />}
      onSwipeableWillOpen={() => haptic.tap()}
    >
      {children}
    </Swipeable>
  );
}

function Action({ progress, onPress }: { progress: SharedValue<number>; translation: SharedValue<number>; onPress: () => void }) {
  const { c } = useTheme();
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1], Extrapolation.CLAMP) }],
  }));
  return (
    <Pressable onPress={onPress} style={{ width: ACTION_W, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', gap: 2 }, st]}>
        <Ionicons name="trash" size={18} color="#fff" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#fff' }}>Delete</Text>
      </Animated.View>
    </Pressable>
  );
}
