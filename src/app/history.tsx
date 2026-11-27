import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutCard } from '@/components/WorkoutCard';
import { SheetHeader, Stat } from '@/components/kit';
import { Card, Empty, Section } from '@/components/ui';
import { dateKey, monthLong } from '@/lib/date';
import { finishedWorkouts, fmtVolume, weekStreak } from '@/lib/stats';
import { useData, type Workout } from '@/store/data';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/nav';

/** Every finished workout, newest first, grouped by month. */
export default function HistoryScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const workouts = useData((s) => s.workouts);
  const list = useMemo(() => finishedWorkouts(workouts), [workouts]);
  const months = useMemo(() => {
    const out: { key: string; items: Workout[] }[] = [];
    for (const w of list) {
      const k = dateKey(new Date(w.started_at)).slice(0, 7);
      if (out[out.length - 1]?.key !== k) out.push({ key: k, items: [] });
      out[out.length - 1].items.push(w);
    }
    return out;
  }, [list]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker={`${list.length} WORKOUTS`} title="LOG" onClose={() => goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <Card style={{ flexDirection: 'row' }}>
          <Stat label="WORKOUTS" value={String(list.length)} />
          <Stat label="VOLUME" value={fmtVolume(list.reduce((a, w) => a + w.volume, 0))} unit="KG" />
          <Stat label="STREAK" value={String(weekStreak(list))} unit="WK" />
        </Card>
        {list.length === 0 ? <Empty icon="calendar-outline" title="NOTHING YET" text="Finish a workout and it shows up here." /> : null}
        {months.map((m) => {
          const [y, mo] = m.key.split('-').map(Number);
          return (
            <View key={m.key}>
              <Section label={`${monthLong(new Date(y, mo - 1, 1)).toUpperCase()} ${y}`} count={m.items.length} style={{ marginTop: 24, marginBottom: 12 }} />
              <View style={{ gap: 10 }}>
                {m.items.map((w, i) => (
                  <Animated.View key={w.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(320)}>
                    <WorkoutCard w={w} />
                  </Animated.View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
