import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MonthGrid, MonthHeader, shiftMonth, useCellSize } from '@/components/MonthCalendar';
import { WorkoutCard } from '@/components/WorkoutCard';
import { Stat } from '@/components/kit';
import { Card, Empty, IconBtn, Press, Screen, ScreenTitle, Section, TAB_BAR_SPACE } from '@/components/ui';
import { dateKey, dayNum, relativeLabel, todayKey } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { finishedWorkouts, fmtVolume, weekStreak, workoutsByDay } from '@/lib/stats';
import { useActive } from '@/store/active';
import { useData } from '@/store/data';
import { fonts, useTheme } from '@/theme';

export default function HistoryScreen() {
  const { c, accent, onAccent } = useTheme();
  const workouts = useData((s) => s.workouts);
  const live = useActive((s) => !!s.workout);
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [day, setDay] = useState<string | null>(null);
  const size = useCellSize(40);

  const list = useMemo(() => finishedWorkouts(workouts), [workouts]);
  const byDay = useMemo(() => workoutsByDay(list), [list]);
  const monthList = list.filter((w) => dateKey(new Date(w.started_at)).startsWith(month));
  const shown = day ? (byDay[day] ?? []) : monthList;
  const today = todayKey();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_SPACE + (live ? 70 : 0) }} showsVerticalScrollIndicator={false}>
        <ScreenTitle kicker={`${list.length} WORKOUTS LOGGED`} title="LOG" right={<IconBtn icon="stats-chart-outline" onPress={() => router.push('/stats')} />} />

        <Card style={{ flexDirection: 'row', marginBottom: 18 }}>
          <Stat label="THIS MONTH" value={String(monthList.length)} />
          <Stat label="VOLUME" value={fmtVolume(monthList.reduce((a, w) => a + w.volume, 0))} unit="KG" />
          <Stat label="STREAK" value={String(weekStreak(list))} unit="WK" />
        </Card>

        <Card>
          <MonthHeader
            month={month}
            onShift={(n) => {
              setMonth(shiftMonth(month, n));
              setDay(null);
            }}
            canNext={month < today.slice(0, 7)}
          />
          <View style={{ height: 14 }} />
          <MonthGrid
            month={month}
            size={size - 4}
            renderDay={(k) => {
              const n = byDay[k]?.length ?? 0;
              const isToday = k === today;
              const sel = day === k;
              const future = k > today;
              return (
                <Press
                  scaleTo={0.92}
                  onPress={() => {
                    haptic.tap();
                    setDay(sel ? null : k);
                  }}
                  style={{
                    width: size - 4,
                    height: size - 4,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: n ? accent : c.surface2,
                    borderWidth: sel ? 2 : isToday ? 1.5 : 1,
                    borderColor: sel ? c.text : isToday ? accent : n ? accent : c.border,
                    opacity: future ? 0.35 : 1,
                  }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: n ? onAccent : c.text }}>{dayNum(k)}</Text>
                  {n ? <Ionicons name="checkmark-sharp" size={11} color={onAccent} style={{ marginTop: -2 }} /> : null}
                </Press>
              );
            }}
          />
        </Card>

        <Section
          label={day ? relativeLabel(day) : 'THIS MONTH'}
          count={shown.length}
          action={day ? 'SHOW MONTH' : undefined}
          onAction={() => setDay(null)}
          style={{ marginTop: 24, marginBottom: 12 }}
        />
        {shown.length === 0 ? (
          <Empty icon="calendar-outline" title={day ? 'REST DAY' : 'NOTHING YET'} text={day ? 'No workout logged on this day.' : 'Finish a workout and it shows up here.'} />
        ) : (
          <View style={{ gap: 10 }}>
            {shown.map((w, i) => (
              <Animated.View key={w.id} entering={FadeInDown.delay(Math.min(i, 8) * 50).duration(380)}>
                <WorkoutCard w={w} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
