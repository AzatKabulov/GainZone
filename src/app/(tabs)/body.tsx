import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, FadeOutRight } from 'react-native-reanimated';

import { ANATOMY_CREDIT, Body3D } from '@/components/Body3D';
import { heatColors, HeatLegend, useBodyPalette } from '@/components/kit';
import { Chip, Press, ProgressBar, Screen, ScreenTitle, Section, TAB_BAR_SPACE, Txt } from '@/components/ui';
import { GROUPS, heatLevel, HEAT_LABEL, MUSCLE_IDS, MUSCLES, type MuscleId } from '@/data/muscles';
import { exName, getExercise } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { finishedWorkouts, fmtVolume, muscleStats, periodWeeks, type MuscleStat } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { useActive } from '@/store/active';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { alpha, fonts, useTheme } from '@/theme';

const PERIODS = [
  { d: 7, label: '7D' },
  { d: 30, label: '30D' },
  { d: 90, label: '90D' },
  { d: 0, label: 'ALL' },
];

export default function BodyScreen() {
  const { c, accent, isDark } = useTheme();
  const palette = useBodyPalette();
  const { height: winH } = useWindowDimensions();
  const workouts = useData((s) => s.workouts);
  const period = useSettings((s) => s.bodyPeriod);
  const setSettings = useSettings((s) => s.set);
  const live = useActive((s) => !!s.workout);
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const [facing, setFacing] = useState<{ angle: number; n: number }>({ angle: 0.32, n: 0 });
  const [scrollOn, setScrollOn] = useState(true);
  const [flip, setFlip] = useState(0);

  const list = useMemo(() => finishedWorkouts(workouts), [workouts]);
  const stats = useMemo(() => muscleStats(list, period), [list, period]);
  const weeks = periodWeeks(list, period);
  const heat = heatColors(isDark);

  const colors = useMemo(() => {
    const out: Partial<Record<MuscleId, string>> = {};
    for (const m of MUSCLE_IDS) {
      const l = heatLevel(stats[m].sets / weeks);
      if (l) out[m] = heat[l];
    }
    return out;
  }, [stats, weeks, heat]);

  const select = (m: MuscleId | null) => {
    if (m) haptic.tap();
    setSelected(m);
  };

  const modelH = Math.max(420, Math.min(600, winH * 0.6));

  return (
    <Screen>
      <ScrollView scrollEnabled={scrollOn} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + (live ? 70 : 0) }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20 }}>
          <ScreenTitle
            kicker="SETS PER WEEK"
            title="BODY"
            right={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {PERIODS.map((p) => (
                  <Chip key={p.d} label={p.label} active={period === p.d} onPress={() => setSettings({ bodyPeriod: p.d })} style={{ paddingHorizontal: 10 }} />
                ))}
              </View>
            }
          />
        </View>

        <View style={{ height: modelH }}>
          <Body3D
            colors={colors}
            palette={palette}
            background={c.bg}
            selected={selected}
            onSelect={select}
            shift={selected ? -0.45 : 0}
            facing={facing}
            flip={flip}
            ring={accent}
            autoRotate
            onInteract={(a) => setScrollOn(!a)}
            style={{ flex: 1 }}
          />
          {!selected ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, right: 20, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Chip label="FRONT" onPress={() => setFacing((f) => ({ angle: 0, n: f.n + 1 }))} />
              <Chip label="BACK" onPress={() => setFacing((f) => ({ angle: Math.PI, n: f.n + 1 }))} />
              <Chip icon="sync" label="TURN" onPress={() => setFlip((n) => n + 1)} />
              <View style={{ flex: 1 }} />
              <Ionicons name="hand-left-outline" size={13} color={c.textFaint} />
              <Txt variant="label" color={c.textFaint} style={{ fontSize: 9 }}>
                DRAG TO SPIN
              </Txt>
            </View>
          ) : null}
          {selected ? <MusclePanel id={selected} st={stats[selected]} weeks={weeks} color={colors[selected] ?? palette.idle} onClose={() => select(null)} height={modelH} /> : null}
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <HeatLegend compact />
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Section label="MUSCLES" style={{ marginTop: 24, marginBottom: 12 }} />
          <View style={{ gap: 8 }}>
            {GROUPS.filter((g) => g.muscles.length).map((g, gi) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(gi * 40).duration(350)} style={{ padding: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 10 }}>
                <Txt variant="label" color={c.text}>
                  {g.name.toUpperCase()}
                </Txt>
                {g.muscles.map((m) => {
                  const perWeek = stats[m].sets / weeks;
                  const [, hi] = MUSCLES[m].weekly;
                  return (
                    <Press key={m} scaleTo={0.985} onPress={() => select(m)} style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Txt variant="title" style={{ flex: 1, fontSize: 14.5 }}>
                          {MUSCLES[m].en}
                        </Txt>
                        <Txt variant="mono" color={c.textDim}>
                          {fmtSets(perWeek)} / WK
                        </Txt>
                      </View>
                      <ProgressBar value={perWeek / hi} color={colors[m] ?? palette.idle} height={5} />
                    </Press>
                  );
                })}
              </Animated.View>
            ))}
          </View>
          <Txt variant="label" color={c.textFaint} style={{ fontSize: 8.5, marginTop: 18, textAlign: 'center' }}>
            {ANATOMY_CREDIT.toUpperCase()}
          </Txt>
        </View>
      </ScrollView>
    </Screen>
  );
}

const fmtSets = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

function MusclePanel({ id, st, weeks, color, onClose, height }: { id: MuscleId; st: MuscleStat; weeks: number; color: string; onClose: () => void; height: number }) {
  const { c, accent, isDark } = useTheme();
  const info = MUSCLES[id];
  const perWeek = st.sets / weeks;
  const level = heatLevel(perWeek);
  const [lo, hi] = info.weekly;
  const now = useNow(60000);
  const days = st.lastAt ? Math.floor((now - Date.parse(st.lastAt)) / 86400000) : null;
  const top = Object.entries(st.byExercise)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const advice = perWeek <= 0.01 ? `Aim for ${lo}–${hi} sets a week.` : perWeek < lo ? `Add ~${Math.ceil(lo - perWeek)} sets a week.` : perWeek > hi ? 'High volume — recover well.' : 'In the growth zone.';

  return (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutRight.duration(200)}
      style={{
        position: 'absolute',
        right: 12,
        top: 8,
        width: '52%',
        maxHeight: height - 16,
        borderRadius: 18,
        backgroundColor: isDark ? alpha('#131315', 0.94) : alpha('#FBFAF7', 0.96),
        borderWidth: 1,
        borderColor: alpha(level ? color : c.borderStrong, 0.6),
        padding: 14,
      }}
    >
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="label" color={level ? color : c.textDim} style={{ fontSize: 9.5 }}>
              {HEAT_LABEL[level]}
            </Txt>
            <Txt variant="h2" style={{ marginTop: 4 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
              {info.en.toUpperCase()}
            </Txt>
          </View>
          <Press hitSlop={10} onPress={onClose} scaleTo={0.9} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={16} color={c.text} />
          </Press>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 56, lineHeight: 56, color: c.text }}>{fmtSets(perWeek)}</Text>
          <Txt variant="label">SETS / WK</Txt>
        </View>
        <ProgressBar value={perWeek / hi} color={level ? color : c.surface3} height={6} style={{ marginTop: 6 }} />
        <Txt variant="label" color={c.textFaint} style={{ marginTop: 6, fontSize: 9 }}>
          GROWTH ZONE {lo}–{hi}
        </Txt>

        <View style={{ marginTop: 12, gap: 6 }}>
          <Row k="DIRECT / ASSIST" v={`${st.direct} / ${st.indirect}`} />
          <Row k="REPS" v={String(Math.round(st.reps))} />
          <Row k="VOLUME" v={`${fmtVolume(st.volume)} KG`} />
          <Row k="LAST" v={days === null ? '—' : days === 0 ? 'TODAY' : `${days}D AGO`} color={days !== null && days >= 2 ? '#45D483' : undefined} />
        </View>

        <Txt variant="small" color={c.textDim} style={{ marginTop: 12 }}>
          {advice}
        </Txt>

        {top.length ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            {top.map(([eid, n]) => (
              <Press key={eid} onPress={() => router.push(`/exercise/${eid}`)} scaleTo={0.98} style={{ flexDirection: 'row', gap: 6 }}>
                <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>
                  {exName(getExercise(eid))}
                </Txt>
                <Txt variant="mono" color={accent}>
                  {n}
                </Txt>
              </Press>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Txt variant="label" style={{ flex: 1, fontSize: 9 }}>
        {k}
      </Txt>
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: color ?? c.text }}>{v}</Text>
    </View>
  );
}
