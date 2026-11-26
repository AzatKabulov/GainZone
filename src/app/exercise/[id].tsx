import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BodyMapPair } from '@/components/BodyMap';
import { LineChart } from '@/components/charts';
import { FxHost } from '@/components/FxHost';
import { SheetHeader, Stat, Tag } from '@/components/kit';
import { Button, Card, Chip, ProgressBar, Section, Txt } from '@/components/ui';
import { muscleBreakdown } from '@/data/exercises';
import { EQUIP_NAME } from '@/data/exerciseTypes';
import { GROUP_NAME, MUSCLES, type MuscleId } from '@/data/muscles';
import { exAltName, exImages, useExercise, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/menu';
import { bestSet, e1rm, exerciseRecords, exerciseSessions, finishedWorkouts, fmtKg, fmtSetValue, fmtVolume, isWorking } from '@/lib/stats';
import { useData } from '@/store/data';
import { useFx } from '@/store/fx';
import { alpha, fonts, useTheme } from '@/theme';

type Metric = 'e1rm' | 'weight' | 'volume' | 'reps';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, accent } = useTheme();
  const insets = useSafeAreaInsets();
  const ex = useExercise(id);
  const exName = useExName();
  const workouts = useData((s) => s.workouts);
  const sessions = useMemo(() => exerciseSessions(finishedWorkouts(workouts), id), [workouts, id]);
  const rec = useMemo(() => exerciseRecords(sessions, ex.type), [sessions, ex.type]);
  const breakdown = muscleBreakdown(ex);
  const imgs = exImages(ex.id);
  const [frame, setFrame] = useState(0);
  const weighted = ex.type === 'weight_reps' || ex.type === 'bw_reps';
  const [metric, setMetric] = useState<Metric>(weighted ? 'e1rm' : 'reps');

  useEffect(() => {
    if (!imgs) return;
    const t = setInterval(() => setFrame((f) => 1 - f), 1300);
    return () => clearInterval(t);
  }, [imgs]);

  const colors: Partial<Record<MuscleId, string>> = {};
  for (const m of breakdown) {
    if (m.role === 'primary') colors[m.id] = accent;
    else if (m.role === 'secondary') colors[m.id] = alpha(accent, 0.45);
    else colors[m.id] = alpha(accent, 0.2);
  }

  const chart = useMemo(() => {
    return [...sessions]
      .reverse()
      .map(({ workout, we }) => {
        const work = we.sets.filter(isWorking);
        let v = 0;
        if (metric === 'e1rm') v = Math.max(0, ...work.map((s) => e1rm(s.weight, s.reps)));
        else if (metric === 'weight') v = Math.max(0, ...work.map((s) => s.weight ?? 0));
        else if (metric === 'reps') v = Math.max(0, ...work.map((s) => s.reps ?? s.time ?? 0));
        else v = work.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);
        const d = new Date(workout.started_at);
        return { label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, value: Math.round(v * 10) / 10 };
      })
      .filter((p) => p.value > 0);
  }, [sessions, metric]);

  const allNotes = sessions.filter((s) => s.we.note.trim()).slice(0, 10);
  const primary = breakdown.filter((m) => m.role === 'primary');

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker={`${GROUP_NAME[ex.group].toUpperCase()} · ${EQUIP_NAME[ex.equip].toUpperCase()}`} title={exName(ex).toUpperCase()} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
        <Txt variant="small" color={c.textDim} style={{ marginTop: -6, marginBottom: 14 }}>
          {exAltName(ex)}
        </Txt>

        {imgs ? (
          <Animated.View entering={FadeIn.duration(300)} style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.border, aspectRatio: 1.5, backgroundColor: c.surface }}>
            <Image source={imgs[0]} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
            <Image source={imgs[1]} style={{ position: 'absolute', width: '100%', height: '100%', opacity: frame }} contentFit="cover" transition={0} />
            <View style={{ position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 6 }}>
              <Tag label={frame ? 'END' : 'START'} color={accent} />
            </View>
          </Animated.View>
        ) : null}

        <Section label="MUSCLES" count={breakdown.length} style={{ marginTop: 20, marginBottom: 12 }} />
        <Card>
          <BodyMapPair colors={colors} height={200} />
          <View style={{ marginTop: 16, gap: 12 }}>
            {breakdown.map((m, i) => (
              <Animated.View key={m.id} entering={FadeInDown.delay(i * 50).duration(350)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Txt variant="title" style={{ fontSize: 14.5 }}>
                    {MUSCLES[m.id].en}
                  </Txt>
                  <Txt variant="small" color={c.textFaint}>
                    {MUSCLES[m.id].name}
                  </Txt>
                  <View style={{ flex: 1 }} />
                  <Tag label={m.role === 'primary' ? 'PRIMARY' : m.role === 'secondary' ? 'SECONDARY' : 'ASSIST'} color={m.role === 'primary' ? accent : c.textDim} />
                  <Text style={{ fontFamily: fonts.display, fontSize: 20, color: c.text, width: 44, textAlign: 'right' }}>{m.pct}%</Text>
                </View>
                <ProgressBar value={m.pct / 100} color={m.role === 'primary' ? accent : alpha(accent, 0.5)} />
              </Animated.View>
            ))}
          </View>
          <Txt variant="small" color={c.textFaint} style={{ marginTop: 14 }}>
            Approximate share of the work (EMG studies + biomechanics). A set counts as 1 set for primary muscles and ½ for secondary.
          </Txt>
        </Card>

        {primary.length ? (
          <Card style={{ marginTop: 12 }}>
            {primary.map((m, i) => (
              <View key={m.id} style={{ marginTop: i ? 12 : 0 }}>
                <Txt variant="label" color={accent}>
                  {MUSCLES[m.id].en.toUpperCase()} · {MUSCLES[m.id].latin}
                </Txt>
                <Txt variant="small" style={{ marginTop: 4 }}>
                  {MUSCLES[m.id].about}
                </Txt>
              </View>
            ))}
          </Card>
        ) : null}

        {ex.tips.length ? (
          <>
            <Section label="TECHNIQUE" count={ex.tips.length} style={{ marginTop: 22, marginBottom: 10 }} />
            <Card style={{ gap: 10 }}>
              {ex.tips.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 18, color: accent, width: 16 }}>{i + 1}</Text>
                  <Txt variant="body" style={{ flex: 1 }}>
                    {t}
                  </Txt>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Section label="YOUR HISTORY" count={sessions.length} style={{ marginTop: 22, marginBottom: 10 }} />
        {sessions.length === 0 ? (
          <Card>
            <Txt variant="small" color={c.textDim}>
              No sets logged yet. Records, charts and your notes appear here after the first session.
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
                  <Stat label="BEST SET VOL" value={fmtVolume(rec.setVolume)} unit="KG" />
                  <Stat label="BEST SESSION" value={fmtVolume(rec.sessionVolume)} unit="KG" />
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
                <LineChart data={chart} format={(v) => (metric === 'reps' ? String(v) : `${fmtKg(v)}`)} />
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
                  </View>
                );
              })}
            </Card>

            {allNotes.length ? (
              <>
                <Section label="YOUR NOTES" count={allNotes.length} style={{ marginTop: 22, marginBottom: 10 }} />
                <Card style={{ gap: 10 }}>
                  {allNotes.map(({ workout, we }) => (
                    <View key={we.id} style={{ flexDirection: 'row', gap: 10 }}>
                      <Ionicons name="create-outline" size={14} color={c.textDim} style={{ marginTop: 3 }} />
                      <View style={{ flex: 1 }}>
                        <Txt variant="label" style={{ fontSize: 9 }}>
                          {new Date(workout.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                        </Txt>
                        <Txt variant="small">{we.note}</Txt>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}

        {ex.custom ? (
          <Button
            label="DELETE CUSTOM EXERCISE"
            icon="trash-outline"
            variant="danger"
            small
            style={{ marginTop: 22 }}
            onPress={() =>
              confirm('Delete exercise?', 'Past workouts keep their sets.', 'Delete', () => {
                useData.getState().remove('exercises', ex.id);
                haptic.warning();
                useFx.getState().info('EXERCISE DELETED', exName(ex), { icon: 'undo', onPress: () => useData.getState().restore('exercises', ex.id) });
                router.back();
              })
            }
          />
        ) : null}
      </ScrollView>
      <FxHost inSheet />
    </View>
  );
}
