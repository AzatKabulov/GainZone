import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart, Delta, LineChart } from '@/components/charts';
import { SheetHeader, Stat } from '@/components/kit';
import { Card, Chip, Empty, Press, ProgressBar, Section, Txt } from '@/components/ui';
import { GROUPS } from '@/data/muscles';
import { getExercise, useExName } from '@/lib/exercise';
import { metricsSorted } from '@/lib/profile';
import { exerciseTotals, FEELINGS, finishedWorkouts, fmtKg, fmtVolume, muscleStats, weekStreak, weeklySeries } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { useData } from '@/store/data';
import { fonts, useTheme } from '@/theme';

type WeekMetric = 'volume' | 'workouts' | 'sets' | 'minutes';

export default function StatsScreen() {
  const { c, accent } = useTheme();
  const insets = useSafeAreaInsets();
  const workouts = useData((s) => s.workouts);
  const metrics = useData((s) => s.metrics);
  const exName = useExName();
  const [wm, setWm] = useState<WeekMetric>('volume');

  const list = useMemo(() => finishedWorkouts(workouts), [workouts]);
  const weeks = useMemo(() => weeklySeries(list, 12), [list]);
  const m30 = useMemo(() => muscleStats(list, 30), [list]);
  const groupSets = GROUPS.filter((g) => g.muscles.length).map((g) => ({ g, sets: g.muscles.reduce((a, m) => a + m30[m].sets, 0) }));
  const maxGroup = Math.max(1, ...groupSets.map((x) => x.sets));

  const now = useNow(60000);
  const topEx = useMemo(() => {
    const m = new Map<string, { sets: number; volume: number }>();
    for (const w of list.filter((w) => Date.parse(w.started_at) > now - 90 * 86400000))
      for (const we of w.exercises) {
        const t = exerciseTotals(we);
        const cur = m.get(we.exercise_id) ?? { sets: 0, volume: 0 };
        m.set(we.exercise_id, { sets: cur.sets + t.sets, volume: cur.volume + t.volume });
      }
    return [...m.entries()].sort((a, b) => b[1].sets - a[1].sets).slice(0, 8);
  }, [list, now]);

  const feelings = list
    .filter((w) => w.feeling)
    .slice(0, 30)
    .reverse()
    .map((w) => {
      const d = new Date(w.started_at);
      return { label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, value: w.feeling ?? 0 };
    });
  const weights = metricsSorted(metrics)
    .filter((m) => m.weight)
    .slice(-60)
    .map((m) => ({ label: m.date.slice(5).split('-').reverse().join('.'), value: m.weight ?? 0 }));

  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
  const avgPerWeek = weeks.slice(0, -1).reduce((a, w) => a + w.workouts, 0) / Math.max(1, weeks.length - 1);

  const data = weeks.map((w) => ({ label: w.week.slice(5).split('-').reverse().join('.'), value: w[wm] }));

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker="ANALYTICS" title="STATISTICS" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
        {list.length === 0 ? (
          <Empty icon="stats-chart-outline" title="NO DATA YET" text="Finish your first workout — charts build themselves from your log." />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row' }}>
                <Stat label="THIS WEEK" value={String(cur?.workouts ?? 0)} unit="WORKOUTS" />
                <Stat label="AVG / WEEK" value={String(Math.round(avgPerWeek * 10) / 10)} />
                <Stat label="STREAK" value={String(weekStreak(list))} unit="WK" />
              </View>
              {prev && (prev.volume > 0 || prev.sets > 0) ? (
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, alignItems: 'center' }}>
                  <Txt variant="label">VS LAST WEEK</Txt>
                  <Delta value={pct(cur?.volume ?? 0, prev?.volume ?? 0)} />
                  <Txt variant="small" color={c.textDim}>
                    volume
                  </Txt>
                  <Delta value={pct(cur?.sets ?? 0, prev?.sets ?? 0)} />
                  <Txt variant="small" color={c.textDim}>
                    sets
                  </Txt>
                </View>
              ) : null}
            </Card>

            <Section label="LAST 12 WEEKS" style={{ marginTop: 24, marginBottom: 12 }} />
            <Card>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {(['volume', 'workouts', 'sets', 'minutes'] as WeekMetric[]).map((m) => (
                  <Chip key={m} label={m.toUpperCase()} active={wm === m} onPress={() => setWm(m)} />
                ))}
              </View>
              <BarChart data={data} format={(v) => (wm === 'volume' ? fmtVolume(v) : String(Math.round(v)))} />
            </Card>

            <Section label="SETS BY MUSCLE · 30 DAYS" style={{ marginTop: 24, marginBottom: 12 }} />
            <Card style={{ gap: 12 }}>
              {groupSets.map(({ g, sets }) => (
                <View key={g.id}>
                  <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <Txt variant="title" style={{ flex: 1, fontSize: 14.5 }}>
                      {g.name}
                    </Txt>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: c.text }}>{Math.round(sets * 10) / 10}</Text>
                  </View>
                  <ProgressBar value={sets / maxGroup} />
                </View>
              ))}
            </Card>

            {topEx.length ? (
              <>
                <Section label="MOST TRAINED · 90 DAYS" count={topEx.length} style={{ marginTop: 24, marginBottom: 12 }} />
                <Card style={{ paddingVertical: 4 }}>
                  {topEx.map(([id, v], i) => (
                    <Press key={id} scaleTo={0.985} onPress={() => router.push(`/exercise/${id}`)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, gap: 10 }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: accent, width: 22 }}>{i + 1}</Text>
                      <Txt variant="title" style={{ flex: 1, fontSize: 14.5 }} numberOfLines={1}>
                        {exName(getExercise(id))}
                      </Txt>
                      <Txt variant="mono" color={c.textDim}>
                        {v.sets} SETS{v.volume ? ` · ${fmtVolume(v.volume)}` : ''}
                      </Txt>
                    </Press>
                  ))}
                </Card>
              </>
            ) : null}

            {feelings.length > 1 ? (
              <>
                <Section label="HOW YOU FELT" style={{ marginTop: 24, marginBottom: 12 }} />
                <Card>
                  <LineChart data={feelings} height={130} format={(v) => FEELINGS.find((f) => f.v === Math.round(v))?.emoji ?? String(v)} />
                </Card>
              </>
            ) : null}

            {weights.length > 1 ? (
              <>
                <Section label="BODYWEIGHT" style={{ marginTop: 24, marginBottom: 12 }} />
                <Card>
                  <LineChart data={weights} height={140} format={(v) => `${fmtKg(v)}`} />
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
