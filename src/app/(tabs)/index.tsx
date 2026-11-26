import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { HeaderBar } from '@/components/HeaderBar';
import { Button, Empty, IconBtn, Press, Screen, ScreenTitle, Section, TAB_BAR_SPACE, Txt } from '@/components/ui';
import { BodyMap } from '@/components/BodyMap';
import { addDays, dateKey, diffDays, relativeLabel, startOfWeek, todayKey } from '@/lib/date';
import { getExercise, useExName } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { confirm, openMenu } from '@/lib/menu';
import { addStarter, STARTERS } from '@/lib/starters';
import { finishedWorkouts, fmtDur, fmtVolume } from '@/lib/stats';
import { duplicateTemplate, startWorkout } from '@/lib/workout';
import { useActive } from '@/store/active';
import { useData, type Template } from '@/store/data';
import { useFx } from '@/store/fx';
import { useSettings } from '@/store/settings';
import { alpha, fonts, useTheme } from '@/theme';
import type { MuscleId } from '@/data/muscles';

export default function TrainScreen() {
  const { c, accent } = useTheme();
  const templates = useData((s) => s.templates);
  const workouts = useData((s) => s.workouts);
  const profile = useData((s) => Object.values(s.profile).find((p) => !p.deleted));
  const live = useActive((s) => s.workout);
  const name = useSettings((s) => s.name);

  const list = useMemo(
    () => Object.values(templates).filter((t) => !t.deleted).sort((a, b) => a.sort_order - b.sort_order),
    [templates],
  );
  const history = useMemo(() => finishedWorkouts(workouts), [workouts]);
  const weekStart = startOfWeek(todayKey());
  const thisWeek = history.filter((w) => dateKey(new Date(w.started_at)) >= weekStart);
  const goal = profile?.weekly_goal ?? 4;

  const begin = (templateId: string | null) => {
    if (live) {
      router.push('/workout');
      return;
    }
    startWorkout(templateId);
    router.push('/workout');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_SPACE + (live ? 70 : 0) }} showsVerticalScrollIndicator={false}>
        <ScreenTitle
          kicker={`${relativeLabel(todayKey())}${name ? ` · ${name.toUpperCase()}` : ''}`}
          title="TRAIN"
          right={
            <>
              <IconBtn icon="stats-chart-outline" onPress={() => router.push('/stats')} />
              <IconBtn icon="add" accentFill onPress={() => router.push('/routine/new')} />
            </>
          }
        />
        <HeaderBar
          label="THIS WEEK"
          detail={`${thisWeek.length} of ${goal} workouts · ${fmtVolume(thisWeek.reduce((a, w) => a + w.volume, 0))} kg`}
          value={Math.min(1, thisWeek.length / Math.max(1, goal))}
        />

        <WeekStrip doneDays={new Set(thisWeek.map((w) => dateKey(new Date(w.started_at))))} />

        {live ? (
          <Animated.View entering={FadeInDown.duration(380)}>
            <Press
              scaleTo={0.985}
              onPress={() => router.push('/workout')}
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 16,
                backgroundColor: alpha(accent, 0.1),
                borderWidth: 1,
                borderColor: alpha(accent, 0.55),
              }}
            >
              <Txt variant="label" color={accent}>
                NOW · IN PROGRESS
              </Txt>
              <Txt variant="h2" style={{ marginTop: 6 }}>
                {live.name.toUpperCase()}
              </Txt>
              <Txt variant="mono" color={c.textDim} style={{ marginTop: 4 }}>
                {live.exercises.length} EXERCISES · {live.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)} SETS DONE
              </Txt>
            </Press>
          </Animated.View>
        ) : (
          <Button label="START EMPTY WORKOUT" icon="flash" onPress={() => begin(null)} style={{ marginTop: 18 }} />
        )}

        <Section label="ROUTINES" count={list.length} action="+ NEW" onAction={() => router.push('/routine/new')} style={{ marginTop: 26, marginBottom: 12 }} />

        {list.length === 0 ? (
          <Empty
            icon="barbell-outline"
            title="NO ROUTINES YET"
            text="Build your Day 1, Day 2… once. Start any of them in one tap."
            action="CREATE ROUTINE"
            onAction={() => router.push('/routine/new')}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {list.map((t, i) => (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 50).duration(380)} layout={LinearTransition.springify().damping(18)}>
                <RoutineCard t={t} onStart={() => begin(t.id)} />
              </Animated.View>
            ))}
          </View>
        )}

        <Starters existing={list.map((t) => t.name)} />

        {history.length ? (
          <>
            <Section label="RECENT" count={Math.min(3, history.length)} action="ALL →" onAction={() => router.push('/history')} style={{ marginTop: 26, marginBottom: 12 }} />
            <View style={{ gap: 8 }}>
              {history.slice(0, 3).map((w) => (
                <Press
                  key={w.id}
                  scaleTo={0.985}
                  onPress={() => router.push(`/session/${w.id}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
                >
                  <View style={{ flex: 1 }}>
                    <Txt variant="title" numberOfLines={1}>
                      {w.name}
                    </Txt>
                    <Txt variant="small" color={c.textDim} numberOfLines={1}>
                      {relativeLabel(dateKey(new Date(w.started_at))).toLowerCase()} · {w.sets_count} sets · {fmtVolume(w.volume)} kg
                      {w.prs_count ? ` · ${w.prs_count} PR` : ''}
                    </Txt>
                  </View>
                  <Txt variant="mono" color={c.textDim}>
                    {fmtDur(w.duration_sec)}
                  </Txt>
                  <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                </Press>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function WeekStrip({ doneDays }: { doneDays: Set<string> }) {
  const { c, accent, onAccent } = useTheme();
  const start = startOfWeek(todayKey());
  const today = todayKey();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
        const key = addDays(start, i);
        const done = doneDays.has(key);
        const isToday = key === today;
        const future = key > today;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 10,
              backgroundColor: done ? accent : c.surface,
              borderWidth: isToday && !done ? 1.5 : 1,
              borderColor: isToday && !done ? accent : done ? accent : c.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: future ? 0.35 : 1,
            }}
          >
            <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.2, color: done ? onAccent : c.textDim }}>{d}</Text>
            {done ? <Ionicons name="checkmark-sharp" size={14} color={onAccent} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.textFaint }}>·</Text>}
          </View>
        );
      })}
    </View>
  );
}

function RoutineCard({ t, onStart }: { t: Template; onStart: () => void }) {
  const { c, accent } = useTheme();
  const exName = useExName();
  const sets = t.exercises.reduce((a, e) => a + e.sets.length, 0);
  const lastDays = t.last_used_at ? diffDays(dateKey(new Date(t.last_used_at)), todayKey()) : null;
  const muscles: Partial<Record<MuscleId, string>> = {};
  for (const te of t.exercises) {
    for (const [m, v] of Object.entries(getExercise(te.exercise_id).m) as [MuscleId, number][]) {
      if (v >= 25) muscles[m] = accent;
      else if (v >= 10 && !muscles[m]) muscles[m] = alpha(accent, 0.4);
    }
  }
  const menu = () =>
    openMenu(t.name, [
      { label: 'Edit routine', onPress: () => router.push(`/routine/${t.id}`) },
      { label: 'Duplicate', onPress: () => duplicateTemplate(t.id) },
      {
        label: 'Delete',
        destructive: true,
        onPress: () =>
          confirm('Delete routine?', 'Your workout history stays. Only the routine is removed.', 'Delete', () => {
            useData.getState().remove('templates', t.id);
            haptic.warning();
            useFx.getState().info('ROUTINE DELETED', t.name, { icon: 'undo', onPress: () => useData.getState().restore('templates', t.id) });
          }),
      },
    ]);
  return (
    <Press scaleTo={0.985} onPress={() => router.push(`/routine/${t.id}`)} onLongPress={menu} style={{ padding: 16, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="h2" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>
            {t.name.toUpperCase() || 'ROUTINE'}
          </Txt>
          <Txt variant="small" color={c.textDim} numberOfLines={2} style={{ marginTop: 4 }}>
            {t.exercises.map((e) => exName(getExercise(e.exercise_id))).join(' · ') || 'No exercises yet'}
          </Txt>
          <Txt variant="label" color={c.textFaint} style={{ marginTop: 10 }}>
            {String(t.exercises.length).padStart(2, '0')} EXERCISES · {sets} SETS
            {lastDays !== null ? ` · ${lastDays === 0 ? 'TODAY' : `${lastDays}D AGO`}` : ''}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 2, opacity: 0.95 }}>
          <BodyMap colors={muscles} view="front" height={74} />
          <BodyMap colors={muscles} view="back" height={74} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Button label="START" icon="play" small onPress={onStart} style={{ flex: 1 }} />
        <IconBtn icon="ellipsis-horizontal" onPress={menu} />
      </View>
    </Press>
  );
}

function Starters({ existing }: { existing: string[] }) {
  const { c } = useTheme();
  const left = STARTERS.filter((s) => !existing.includes(s.name));
  if (!left.length) return null;
  return (
    <>
      <Section label="STARTER ROUTINES" count={left.length} style={{ marginTop: 26, marginBottom: 12 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -20 }} contentInset={{ left: 20, right: 20 }} contentOffset={{ x: -20, y: 0 }}>
        <View style={{ width: 10 }} />
        {left.map((s) => (
          <Press
            key={s.key}
            scaleTo={0.97}
            onPress={() => {
              const id = addStarter(s.key);
              haptic.success();
              useFx.getState().info('ROUTINE ADDED', `${s.name} — edit it any time.`);
              if (id) router.push(`/routine/${id}`);
            }}
            style={{ width: 196, padding: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' }}
          >
            <Txt variant="h2">{s.name.toUpperCase()}</Txt>
            <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }} numberOfLines={2}>
              {s.note}
            </Txt>
            <Txt variant="label" color={c.textFaint} style={{ marginTop: 10 }}>
              {String(s.rows.length).padStart(2, '0')} EXERCISES · + ADD
            </Txt>
          </Press>
        ))}
        <View style={{ width: 10 }} />
      </ScrollView>
    </>
  );
}
