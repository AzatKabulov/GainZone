import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body3D } from '@/components/Body3D';
import { LineChart } from '@/components/charts';
import { FxHost } from '@/components/FxHost';
import { exerciseColors, SheetHeader, Stat, useBodyPalette } from '@/components/kit';
import { Card, Chip, ProgressBar, Section, Txt } from '@/components/ui';
import { muscleBreakdown } from '@/data/exercises';
import { EQUIP_NAME } from '@/data/exerciseTypes';
import { GROUP_NAME, MUSCLES, type MuscleId } from '@/data/muscles';
import { exIllustration, exName, useExercise } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/menu';
import { bestSet, e1rm, exerciseRecords, exerciseSessions, finishedWorkouts, fmtKg, fmtSetValue, fmtVolume, isWorking, setReps, topReps } from '@/lib/stats';
import { useData } from '@/store/data';
import { useFx } from '@/store/fx';
import { alpha, fonts, useTheme } from '@/theme';

type Metric = 'e1rm' | 'weight' | 'volume' | 'reps';

const BACK_SIDE: MuscleId[] = ['lats', 'upper_back', 'lower_back', 'triceps', 'delts_rear', 'glutes', 'hamstrings', 'traps', 'calves'];
const LOWER: MuscleId[] = ['glutes', 'quads', 'hamstrings', 'adductors', 'calves'];

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, accent } = useTheme();
  const palette = useBodyPalette();
  const insets = useSafeAreaInsets();
  const ex = useExercise(id);
  const illu = exIllustration(ex.id);
  const workouts = useData((s) => s.workouts);
  const sessions = useMemo(() => exerciseSessions(finishedWorkouts(workouts), id), [workouts, id]);
  const rec = useMemo(() => exerciseRecords(sessions, ex.type), [sessions, ex.type]);
  const breakdown = muscleBreakdown(ex);
  const weighted = ex.type === 'weight_reps' || ex.type === 'bw_reps';
  const [metric, setMetric] = useState<Metric>(weighted ? 'e1rm' : 'reps');
  const [scrollOn, setScrollOn] = useState(true);
  const [sel, setSel] = useState<MuscleId | null>(null);

  const colors = useMemo(() => exerciseColors(ex, accent, palette.idle), [ex, accent, palette.idle]);
  const back = breakdown.reduce((a, m) => a + (BACK_SIDE.includes(m.id) ? m.pct : 0), 0) > 50;
  const lower = breakdown.reduce((a, m) => a + (LOWER.includes(m.id) ? m.pct : 0), 0) > 50;
  const startAngle = back ? Math.PI - 0.35 : 0.35;

  const chart = useMemo(
    () =>
      [...sessions]
        .reverse()
        .map(({ workout, we }) => {
          const work = we.sets.filter(isWorking);
          let v = 0;
          if (metric === 'e1rm') v = Math.max(0, ...work.map((s) => e1rm(s.weight, topReps(s))));
          else if (metric === 'weight') v = Math.max(0, ...work.map((s) => s.weight ?? 0));
          else if (metric === 'reps') v = Math.max(0, ...work.map((s) => topReps(s) || (s.time ?? 0)));
          else v = work.reduce((a, s) => a + (s.weight ?? 0) * setReps(s), 0);
          const d = new Date(workout.started_at);
          return { label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, value: Math.round(v * 10) / 10 };
        })
        .filter((p) => p.value > 0),
    [sessions, metric],
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker={`${GROUP_NAME[ex.group].toUpperCase()} · ${EQUIP_NAME[ex.equip].toUpperCase()}`} title={exName(ex).toUpperCase()} onClose={() => router.back()} />
      <ScrollView scrollEnabled={scrollOn} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }}>
        {illu ? (
          <View style={{ aspectRatio: 1, maxHeight: 360, alignSelf: 'center', width: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: '#F2EEE6', marginBottom: 12 }}>
            <Image source={illu} style={{ flex: 1 }} contentFit="contain" transition={150} />
          </View>
        ) : null}
        <View style={{ height: illu ? 320 : 380, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <Body3D
            colors={colors}
            palette={palette}
            ring={accent}
            background={c.surface}
            selected={sel}
            onSelect={(m) => {
              if (m) haptic.tap();
              setSel(m && ex.m[m] ? m : null);
            }}
            initialAngle={startAngle}
            focus={ex.group === 'cardio' ? 'full' : lower ? 'lower' : 'upper'}
            onInteract={(a) => setScrollOn(!a)}
            style={{ flex: 1 }}
          />
          {sel ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: alpha(c.bg, 0.8) }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: c.text }}>
                {MUSCLES[sel].en.toUpperCase()} · {ex.m[sel]}%
              </Text>
            </View>
          ) : null}
        </View>

        <Section label="MUSCLES" count={breakdown.length} style={{ marginTop: 20, marginBottom: 12 }} />
        <Card style={{ gap: 12 }}>
          {breakdown.map((m, i) => (
            <Animated.View key={m.id} entering={FadeInDown.delay(i * 40).duration(320)}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
                <Txt variant="title" style={{ flex: 1, fontSize: 15 }}>
                  {MUSCLES[m.id].en}
                </Txt>
                <Txt variant="label" color={m.role === 'primary' ? accent : c.textFaint} style={{ marginRight: 10 }}>
                  {m.role === 'primary' ? 'PRIMARY' : m.role === 'secondary' ? 'SECONDARY' : 'ASSIST'}
                </Txt>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: c.text, width: 44, textAlign: 'right' }}>{m.pct}%</Text>
              </View>
              <ProgressBar value={m.pct / 100} color={m.role === 'primary' ? accent : alpha(accent, 0.45)} />
            </Animated.View>
          ))}
        </Card>

        <Section label="HISTORY" count={sessions.length} style={{ marginTop: 24, marginBottom: 12 }} />
        {sessions.length === 0 ? (
          <Card>
            <Txt variant="small" color={c.textDim}>
              No sets yet.
            </Txt>
          </Card>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row' }}>
                {weighted ? <Stat label="BEST 1RM" value={fmtKg(Math.round(rec.e1rm * 10) / 10)} unit="KG" /> : null}
                {weighted ? <Stat label="HEAVIEST" value={fmtKg(rec.weight)} unit="KG" /> : null}
                <Stat label="MAX REPS" value={String(rec.reps)} />
              </View>
              {weighted ? (
                <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }}>
                  <Stat label="BEST SET" value={fmtVolume(rec.setVolume)} unit="KG" />
                  <Stat label="BEST DAY" value={fmtVolume(rec.sessionVolume)} unit="KG" />
                  <Stat label="SESSIONS" value={String(sessions.length)} />
                </View>
              ) : null}
            </Card>

            {chart.length > 1 ? (
              <Card style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {(weighted ? (['e1rm', 'weight', 'volume', 'reps'] as Metric[]) : (['reps'] as Metric[])).map((m) => (
                    <Chip key={m} label={m === 'e1rm' ? '1RM' : m.toUpperCase()} active={metric === m} onPress={() => setMetric(m)} />
                  ))}
                </View>
                <LineChart data={chart} format={(v) => (metric === 'reps' ? String(v) : fmtKg(v))} />
              </Card>
            ) : null}

            <Card style={{ marginTop: 12, paddingVertical: 6 }}>
              {sessions.slice(0, 8).map(({ workout, we }, i) => {
                const best = bestSet(we);
                const d = new Date(workout.started_at);
                return (
                  <View key={workout.id + we.id} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Txt variant="label" style={{ flex: 1 }}>
                        {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}
                      </Txt>
                      {best ? (
                        <Txt variant="label" color={accent}>
                          BEST {fmtSetValue(best, ex.type).toUpperCase()}
                        </Txt>
                      ) : null}
                    </View>
                    <Txt variant="mono" style={{ marginTop: 4 }}>
                      {we.sets
                        .filter((s) => s.done)
                        .map((s) => fmtSetValue(s, ex.type).replace('kg', ''))
                        .join('  ·  ')}
                    </Txt>
                    {we.note ? (
                      <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }} numberOfLines={2}>
                        {we.note}
                      </Txt>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {ex.custom ? (
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <Txt
              variant="label"
              color={c.danger}
              style={{ paddingVertical: 10 }}
              onPress={() =>
                confirm('Delete exercise?', 'Past workouts keep their sets.', 'Delete', () => {
                  useData.getState().remove('exercises', ex.id);
                  haptic.warning();
                  useFx.getState().info('EXERCISE DELETED', exName(ex), { icon: 'undo', onPress: () => useData.getState().restore('exercises', ex.id) });
                  router.back();
                })
              }
            >
              DELETE EXERCISE
            </Txt>
          </View>
        ) : null}
      </ScrollView>
      <FxHost inSheet />
    </View>
  );
}
