import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { ActivityCalendar, RecoveryStrip } from '@/components/ActivityCalendar';
import { Button, Empty, IconBtn, Press, Screen, ScreenTitle, Section, TAB_BAR_SPACE, Txt } from '@/components/ui';
import { ExerciseThumb } from '@/components/kit';
import { dateKey, diffDays, relativeLabel, todayKey } from '@/lib/date';
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
import { alpha, useTheme } from '@/theme';

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
        <ActivityCalendar list={history} goal={goal} />
        <RecoveryStrip list={history} />

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
          <Empty icon="barbell-outline" title="NO ROUTINES YET" action="CREATE ROUTINE" onAction={() => router.push('/routine/new')} />
        ) : (
          <View style={{ gap: 10 }}>
            {list.map((t, i) => (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 50).duration(380)} layout={LinearTransition.springify().damping(18)}>
                <RoutineCard t={t} onStart={() => begin(t.id)} />
              </Animated.View>
            ))}
          </View>
        )}

        {list.length === 0 ? <Starters existing={[]} /> : null}

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

function RoutineCard({ t, onStart }: { t: Template; onStart: () => void }) {
  const { c } = useTheme();
  const exName = useExName();
  const sets = t.exercises.reduce((a, e) => a + e.sets.length, 0);
  const lastDays = t.last_used_at ? diffDays(dateKey(new Date(t.last_used_at)), todayKey()) : null;
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
      </View>
      {t.exercises.length ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          {t.exercises.slice(0, 6).map((e) => (
            <ExerciseThumb key={e.id} ex={getExercise(e.exercise_id)} size={40} />
          ))}
        </View>
      ) : null}
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
