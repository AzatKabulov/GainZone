import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, FadeOutRight } from 'react-native-reanimated';

import { Body3D } from '@/components/Body3D';
import { BodyMapPair } from '@/components/BodyMap';
import { heatColors, HeatLegend } from '@/components/kit';
import { Chip, IconBtn, Press, ProgressBar, Screen, ScreenTitle, Section, TAB_BAR_SPACE, Txt } from '@/components/ui';
import { GROUPS, heatLevel, HEAT_LABEL, MUSCLE_IDS, MUSCLES, type MuscleId } from '@/data/muscles';
import { getExercise, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { finishedWorkouts, fmtVolume, muscleStats, periodWeeks, type MuscleStat } from '@/lib/stats';
import { useNow } from '@/lib/useNow';
import { useActive } from '@/store/active';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { alpha, fonts, useTheme } from '@/theme';

const PERIODS = [
  { d: 7, label: '7 DAYS' },
  { d: 30, label: '30 DAYS' },
  { d: 90, label: '90 DAYS' },
  { d: 0, label: 'ALL TIME' },
];

export default function BodyScreen() {
  const { c, isDark } = useTheme();
  const { height: winH } = useWindowDimensions();
  const workouts = useData((s) => s.workouts);
  const period = useSettings((s) => s.bodyPeriod);
  const setSettings = useSettings((s) => s.set);
  const live = useActive((s) => !!s.workout);
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const [facing, setFacing] = useState<{ angle: number; n: number }>({ angle: 0.35, n: 0 });
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [scrollOn, setScrollOn] = useState(true);

  const list = useMemo(() => finishedWorkouts(workouts), [workouts]);
  const stats = useMemo(() => muscleStats(list, period), [list, period]);
  const weeks = periodWeeks(list, period);
  const heat = heatColors(isDark);

  const colors = useMemo(() => {
    const out = {} as Record<MuscleId, string>;
    for (const m of MUSCLE_IDS) out[m] = heat[heatLevel(stats[m].sets / weeks)];
    return out;
  }, [stats, weeks, heat]);

  const select = (m: MuscleId | null) => {
    if (m) haptic.tap();
    setSelected(m);
  };

  const modelH = Math.max(380, Math.min(560, winH * 0.56));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + (live ? 70 : 0) }} showsVerticalScrollIndicator={false} scrollEnabled={scrollOn}>
        <View style={{ paddingHorizontal: 20 }}>
          <ScreenTitle
            kicker={period ? `LAST ${period} DAYS · SETS / WEEK` : 'ALL TIME · SETS / WEEK'}
            title="BODY"
            right={<IconBtn icon={mode === '3d' ? 'grid-outline' : 'cube-outline'} onPress={() => setMode(mode === '3d' ? '2d' : '3d')} />}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PERIODS.map((p) => (
              <Chip key={p.d} label={p.label} active={period === p.d} onPress={() => setSettings({ bodyPeriod: p.d })} />
            ))}
          </ScrollView>
        </View>

        <View style={{ height: modelH, marginTop: 10 }}>
          {mode === '3d' ? (
            <Body3D
              colors={colors}
              base={isDark ? '#3A3A40' : '#CFC9BD'}
              background={c.bg}
              selected={selected}
              onSelect={select}
              shift={selected ? -0.42 : 0}
              facing={facing}
              onInteract={(a) => setScrollOn(!a)}
              style={{ flex: 1 }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: selected ? 'flex-start' : 'center', justifyContent: 'center', paddingLeft: selected ? 8 : 0 }}>
              <BodyMapPair colors={colors} height={selected ? modelH * 0.5 : modelH * 0.78} onPress={(m) => select(selected === m ? null : m)} selected={selected} />
            </View>
          )}

          {mode === '3d' && !selected ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, bottom: 8, flexDirection: 'row', gap: 8 }}>
              <Chip label="FRONT" icon="person-outline" onPress={() => setFacing((f) => ({ angle: 0, n: f.n + 1 }))} />
              <Chip label="BACK" icon="sync-outline" onPress={() => setFacing((f) => ({ angle: Math.PI, n: f.n + 1 }))} />
            </View>
          ) : null}
          {mode === '3d' && !selected ? (
            <View pointerEvents="none" style={{ position: 'absolute', right: 20, top: 4 }}>
              <Txt variant="label" color={c.textFaint} style={{ fontSize: 9 }}>
                DRAG TO ROTATE · TAP A MUSCLE
              </Txt>
            </View>
          ) : null}

          {selected ? <MusclePanel id={selected} st={stats[selected]} weeks={weeks} color={colors[selected]} onClose={() => select(null)} height={modelH} /> : null}
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <HeatLegend />
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Section label="BY MUSCLE GROUP" style={{ marginTop: 24, marginBottom: 12 }} />
          <View style={{ gap: 8 }}>
            {GROUPS.filter((g) => g.muscles.length).map((g, gi) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(gi * 40).duration(350)} style={{ padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                <Txt variant="label" color={c.text} style={{ marginBottom: 10 }}>
                  {g.name.toUpperCase()}
                </Txt>
                <View style={{ gap: 10 }}>
                  {g.muscles.map((m) => {
                    const perWeek = stats[m].sets / weeks;
                    const [lo, hi] = MUSCLES[m].weekly;
                    return (
                      <Press key={m} scaleTo={0.985} onPress={() => select(m)} style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors[m] }} />
                          <Txt variant="title" style={{ flex: 1, fontSize: 14.5 }}>
                            {MUSCLES[m].en}
                          </Txt>
                          <Txt variant="mono" color={c.textDim}>
                            {fmtSets(perWeek)} / WK · TARGET {lo}–{hi}
                          </Txt>
                        </View>
                        <ProgressBar value={perWeek / hi} color={colors[m]} height={5} />
                      </Press>
                    );
                  })}
                </View>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const fmtSets = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

function MusclePanel({ id, st, weeks, color, onClose, height }: { id: MuscleId; st: MuscleStat; weeks: number; color: string; onClose: () => void; height: number }) {
  const { c, accent, isDark } = useTheme();
  const exName = useExName();
  const info = MUSCLES[id];
  const perWeek = st.sets / weeks;
  const level = heatLevel(perWeek);
  const [lo, hi] = info.weekly;
  const now = useNow(60000);
  const days = st.lastAt ? Math.floor((now - Date.parse(st.lastAt)) / 86400000) : null;
  const top = Object.entries(st.byExercise)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const advice =
    perWeek <= 0.01
      ? `Not trained in this period. Aim for ${lo}–${hi} hard sets a week.`
      : perWeek < lo
        ? `Below the growth zone: add ~${Math.ceil(lo - perWeek)} sets a week.`
        : perWeek > hi
          ? 'Above the usual range — make sure you recover.'
          : 'In the growth zone. Keep pushing the weights up.';
  const recovered = days === null ? null : days >= 2 ? 'RECOVERED' : days === 1 ? 'RECOVERING' : 'FRESHLY TRAINED';

  return (
    <Animated.View
      entering={FadeInRight.duration(320)}
      exiting={FadeOutRight.duration(220)}
      style={{
        position: 'absolute',
        right: 12,
        top: 6,
        width: '54%',
        maxHeight: height - 12,
        borderRadius: 18,
        backgroundColor: isDark ? alpha('#131315', 0.94) : alpha('#FBFAF7', 0.96),
        borderWidth: 1,
        borderColor: alpha(color, 0.55),
        padding: 14,
        shadowColor: color,
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="label" color={color} style={{ fontSize: 9.5 }}>
              {HEAT_LABEL[level]}
            </Txt>
            <Txt variant="h2" style={{ marginTop: 4 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
              {info.en.toUpperCase()}
            </Txt>
            <Txt variant="small" color={c.textFaint}>
              {info.name}
            </Txt>
          </View>
          <Press hitSlop={10} onPress={onClose} scaleTo={0.9}>
            <Ionicons name="close" size={18} color={c.textDim} />
          </Press>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 54, lineHeight: 54, color: c.text }}>{fmtSets(perWeek)}</Text>
          <Txt variant="label">SETS / WEEK</Txt>
        </View>
        <ProgressBar value={perWeek / hi} color={color} height={6} style={{ marginTop: 6 }} />
        <Txt variant="label" color={c.textFaint} style={{ marginTop: 6, fontSize: 9 }}>
          GROWTH ZONE {lo}–{hi} SETS
        </Txt>

        <View style={{ marginTop: 12, gap: 6 }}>
          <Row k="TOTAL SETS" v={fmtSets(st.sets)} />
          <Row k="DIRECT · INDIRECT" v={`${st.direct} · ${st.indirect}`} />
          <Row k="REPS" v={String(Math.round(st.reps))} />
          <Row k="VOLUME" v={`${fmtVolume(st.volume)} KG`} />
          <Row k="LAST TRAINED" v={days === null ? '—' : days === 0 ? 'TODAY' : `${days}D AGO`} />
          {recovered ? <Row k="STATUS" v={recovered} color={days !== null && days >= 2 ? '#45D483' : '#F59E0B'} /> : null}
        </View>

        <Txt variant="small" color={c.textDim} style={{ marginTop: 12 }}>
          {advice}
        </Txt>

        {top.length ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            <Txt variant="label" style={{ fontSize: 9.5 }}>
              TOP EXERCISES
            </Txt>
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

        <Txt variant="small" color={c.textFaint} style={{ marginTop: 12 }}>
          {info.about}
        </Txt>
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
