import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { exName, getExercise } from '@/lib/exercise';
import { adjustRest, skipRest } from '@/lib/rest';
import { fmtElapsed, fmtKg, fmtReps } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { useActive } from '@/store/active';
import { alpha, fonts, useTheme } from '@/theme';
import { ProgressRing } from './ProgressRing';
import { Press, Txt } from './ui';

/** What comes after the rest: the first unticked set (in the rested exercise, then the next ones). */
function useNextSet() {
  const w = useActive((s) => s.workout);
  const rest = useActive((s) => s.rest);
  if (!w || !rest) return null;
  let start = Math.max(0, w.exercises.findIndex((e) => e.id === rest.weId));
  // after a superset round, the next set is back at the first exercise of the group
  const group = w.exercises[start]?.superset;
  if (group) while (start > 0 && w.exercises[start - 1].superset === group) start--;
  for (let i = start; i < w.exercises.length; i++) {
    const we = w.exercises[i];
    let n = 0;
    for (const s of we.sets) {
      if (s.type !== 'warmup') n++;
      if (!s.done) {
        const ex = getExercise(we.exercise_id);
        return {
          name: exName(ex),
          set: s.type === 'warmup' ? 'WARM-UP' : `SET ${n}`,
          target: s.weight !== null && s.weight !== undefined ? `${fmtKg(s.weight)} KG × ${fmtReps(s)}` : s.reps ? `${fmtReps(s)} REPS` : '',
        };
      }
    }
  }
  return { name: 'Last set done', set: 'FINISH', target: '' };
}

/** Compact dock at the bottom of the workout. Tap it for the full-screen timer. */
export function RestDock() {
  const { c, accent, onAccent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const rest = useActive((s) => s.rest);
  const now = useNow(250);
  const next = useNextSet();
  const [openId, setOpenId] = useState<number | null>(null);
  if (!rest) return null;
  const open = openId !== null && openId === (rest.id ?? 0);
  const left = Math.max(0, (rest.endsAt - now) / 1000);
  const progress = left / Math.max(1, rest.total);

  return (
    <>
      <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(200)} style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 10 }}>
        <Press
          scaleTo={0.985}
          onPress={() => setOpenId(rest.id ?? 0)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 10,
            paddingRight: 8,
            height: 68,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: Platform.OS === 'ios' ? alpha(c.surface, 0.82) : c.surface,
            borderWidth: 1,
            borderColor: alpha(accent, 0.4),
          }}
        >
          {Platform.OS === 'ios' ? <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
          <ProgressRing value={progress} size={48} stroke={4}>
            <Ionicons name="timer-outline" size={18} color={accent} />
          </ProgressRing>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: c.text, letterSpacing: 0.6 }}>{fmtElapsed(Math.ceil(left))}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: c.textDim }}>
              {next ? `NEXT · ${next.set}${next.target ? ` · ${next.target}` : ''}` : 'REST'}
            </Text>
          </View>
          <SmallBtn label="+15" onPress={() => adjustRest(15)} />
          <Press
            tapHaptic
            onPress={skipRest}
            style={{ height: 44, paddingHorizontal: 14, borderRadius: 13, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 17, letterSpacing: 1.2, color: onAccent, marginTop: 2 }}>SKIP</Text>
          </Press>
        </Press>
      </Animated.View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpenId(null)}>
        <RestFull left={left} progress={progress} total={rest.total} next={next} onClose={() => setOpenId(null)} />
      </Modal>
    </>
  );
}

function RestFull({ left, progress, total, next, onClose }: { left: number; progress: number; total: number; next: ReturnType<typeof useNextSet>; onClose: () => void }) {
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
      {Platform.OS === 'ios' ? <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(5,5,6,0.9)' : 'rgba(241,238,231,0.94)' }]} />
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt variant="label" color={accent} style={{ flex: 1 }}>
            REST
          </Txt>
          <Press tapHaptic scaleTo={0.9} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={22} color={c.text} />
          </Press>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ProgressRing value={progress} size={290} stroke={12}>
            <Text style={{ fontFamily: fonts.display, fontSize: 104, lineHeight: 104, color: c.text, letterSpacing: 1 }}>{fmtElapsed(Math.ceil(left))}</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: c.textDim, marginTop: 4 }}>OF {fmtElapsed(total)}</Text>
          </ProgressRing>

          {next ? (
            <Animated.View entering={FadeInDown.delay(80).duration(320)} style={{ marginTop: 36, alignItems: 'center', gap: 6 }}>
              <Txt variant="label">UP NEXT</Txt>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.semibold, fontSize: 18, color: c.text }}>
                {next.name}
              </Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 28, color: accent, letterSpacing: 0.8 }}>
                {next.set}
                {next.target ? ` · ${next.target}` : ''}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <BigBtn label="−15S" onPress={() => adjustRest(-15)} />
          <BigBtn label="+15S" onPress={() => adjustRest(15)} />
          <Press
            tapHaptic
            onPress={() => {
              skipRest();
              onClose();
            }}
            style={{ flex: 1.4, height: 58, borderRadius: 14, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 22, letterSpacing: 1.4, color: isDark ? '#0A0A0B' : '#FFFFFF', marginTop: 2 }}>SKIP REST</Text>
          </Press>
        </View>
      </View>
    </Animated.View>
  );
}

function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press tapHaptic scaleTo={0.9} onPress={onPress} style={{ width: 48, height: 44, borderRadius: 13, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: c.text }}>{label}</Text>
    </Press>
  );
}

function BigBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press tapHaptic scaleTo={0.94} onPress={onPress} style={{ flex: 1, height: 58, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.2, color: c.text, marginTop: 2 }}>{label}</Text>
    </Press>
  );
}
