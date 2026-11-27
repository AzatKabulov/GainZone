import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { fmtElapsed } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { useActive } from '@/store/active';
import { alpha, fonts, useTheme } from '@/theme';
import { StartSheet } from './StartSheet';
import type { IconName } from './ui';

const TABS: Record<string, { label: string; icon: IconName; iconOff: IconName }> = {
  index: { label: 'TRAIN', icon: 'barbell', iconOff: 'barbell-outline' },
  body: { label: 'BODY', icon: 'body', iconOff: 'body-outline' },
  library: { label: 'LIBRARY', icon: 'albums', iconOff: 'albums-outline' },
  profile: { label: 'YOU', icon: 'person', iconOff: 'person-outline' },
};

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useActive((s) => !!s.workout);
  const [startOpen, setStartOpen] = useState(false);

  return (
    <View pointerEvents="box-none" style={styles.outer}>
      {live ? <LiveBar /> : null}
      <View
        style={[
          styles.wrap,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopColor: c.border,
            backgroundColor: Platform.OS === 'ios' ? alpha(c.bg, 0.72) : alpha(c.bg, 0.97),
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const meta = TABS[route.name];
            if (!meta) return null;
            const center =
              route.name === 'library' ? (
                <WorkoutButton
                  key="workout"
                  live={live}
                  onPress={() => {
                    haptic.medium();
                    if (useActive.getState().workout) router.push('/workout');
                    else setStartOpen(true);
                  }}
                />
              ) : null;
            const focused = state.index === index;
            const onPress = () => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic.tap();
                navigateToTab(route.key);
              }
            };
            return [
              center,
              <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={4}>
                <Indicator active={focused} color={accent} />
                <Ionicons name={focused ? meta.icon : meta.iconOff} size={22} color={focused ? accent : c.textFaint} />
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 9,
                    letterSpacing: 1.3,
                    color: focused ? c.text : c.textFaint,
                    marginTop: 5,
                  }}
                >
                  {meta.label}
                </Text>
              </Pressable>,
            ];
          })}
        </View>
      </View>
      <StartSheet visible={startOpen} onClose={() => setStartOpen(false)} />
    </View>
  );
}

/** Raised accent button in the middle of the tab bar: start a workout, or jump back into the live one. */
function WorkoutButton({ live, onPress }: { live: boolean; onPress: () => void }) {
  const { c, accent, onAccent } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={4}>
      <View
        style={{
          marginTop: -6,
          width: 48,
          height: 34,
          borderRadius: 12,
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: accent,
          shadowOpacity: 0.45,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Ionicons name={live ? 'play' : 'add'} size={live ? 18 : 26} color={onAccent} />
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.3, color: live ? accent : c.text, marginTop: 5 }}>
        {live ? 'LIVE' : 'WORKOUT'}
      </Text>
    </Pressable>
  );
}

/** "Workout in progress" strip above the tab bar — tap to jump back in. */
function LiveBar() {
  const { c, accent, onAccent } = useTheme();
  const w = useActive((s) => s.workout);
  const rest = useActive((s) => s.rest);
  const now = useNow(1000);
  if (!w) return null;
  const elapsed = (now - Date.parse(w.started_at)) / 1000;
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(200)} style={styles.liveWrap}>
      <Pressable
        onPress={() => {
          haptic.light();
          router.push('/workout');
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          height: 56,
          borderRadius: 16,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: alpha(accent, 0.5),
          shadowColor: accent,
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.6, color: accent }}>
            {rest ? `REST · ${fmtElapsed(restLeft)}` : 'LIVE WORKOUT'}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: c.text, marginTop: 2 }}>
            {w.name}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: c.textDim, letterSpacing: 0.4 }}>{fmtElapsed(elapsed)}</Text>
        <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 9, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.2, color: onAccent, marginTop: 2 }}>RESUME</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Indicator({ active, color }: { active: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: withSpring(active ? 1 : 0),
    transform: [{ scaleX: withSpring(active ? 1 : 0.2, { damping: 14 }) }],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', top: -10, width: 22, height: 3, borderRadius: 2, backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  outer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  liveWrap: { paddingHorizontal: 12, paddingBottom: 8 },
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', paddingTop: 2 },
});
