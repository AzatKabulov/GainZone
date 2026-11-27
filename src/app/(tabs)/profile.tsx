import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { Stat } from '@/components/kit';
import { BUILD } from '@/lib/build';
import { Button, Card, IconBtn, Press, Screen, ScreenTitle, Section, TAB_BAR_SPACE, Txt } from '@/components/ui';
import { getExercise, useExName } from '@/lib/exercise';
import { bmi, metricsSorted, useProfile } from '@/lib/profile';
import { e1rm, finishedWorkouts, fmtKg, fmtVolume, isWorking, weekStreak } from '@/lib/stats';
import { useActive } from '@/store/active';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { useSync } from '@/store/sync';
import { alpha, fonts, useTheme } from '@/theme';

export default function ProfileScreen() {
  const { c, accent, onAccent } = useTheme();
  const session = useAuth((s) => s.session);
  const name = useSettings((s) => s.name);
  const profile = useProfile();
  const workouts = useData((s) => s.workouts);
  const metrics = useData((s) => s.metrics);
  const dirty = useData((s) => Object.keys(s.dirty).length);
  const sync = useSync();
  const live = useActive((s) => !!s.workout);
  const exName = useExName();

  const list = useMemo(() => finishedWorkouts(workouts), [workouts]);
  const ms = useMemo(() => metricsSorted(metrics).filter((m) => m.weight), [metrics]);
  const latest = ms[ms.length - 1];
  const first = ms[0];
  const totals = useMemo(() => {
    let volume = 0;
    let sets = 0;
    let prs = 0;
    let sec = 0;
    const best = new Map<string, number>();
    for (const w of list) {
      volume += w.volume;
      sets += w.sets_count;
      prs += w.prs_count;
      sec += w.duration_sec;
      for (const we of w.exercises)
        for (const s of we.sets) {
          if (!isWorking(s)) continue;
          const e = e1rm(s.weight, s.reps);
          if (e > (best.get(we.exercise_id) ?? 0)) best.set(we.exercise_id, e);
        }
    }
    const lifts = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { volume, sets, prs, hours: sec / 3600, lifts };
  }, [list]);

  const displayName = profile?.name || name || session?.user.email?.split('@')[0] || 'Athlete';
  const initials = displayName.trim().charAt(0).toUpperCase();
  const b = bmi(latest?.weight, profile?.height_cm);
  const syncLabel = !session
    ? 'OFFLINE MODE · DATA ON THIS PHONE'
    : sync.status === 'syncing'
      ? 'SYNCING…'
      : sync.status === 'setup'
        ? `CLOUD NOT SET UP YET · ${dirty} SAVED ON PHONE`
        : sync.status === 'offline'
          ? `OFFLINE · ${dirty} WAITING`
          : sync.status === 'error'
            ? `SYNC ERROR · ${dirty} WAITING`
            : dirty
              ? `${dirty} WAITING TO SYNC`
              : 'BACKED UP TO CLOUD';
  const syncOk = !!session && sync.status === 'idle' && !dirty;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_SPACE + (live ? 70 : 0) }} showsVerticalScrollIndicator={false}>
        <ScreenTitle kicker={session?.user.email?.toUpperCase() ?? 'GUEST'} title="YOU" right={<IconBtn icon="settings-outline" onPress={() => router.push('/settings')} />} />

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 32, color: onAccent, marginTop: 4 }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="h2">{displayName.toUpperCase()}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Ionicons name={syncOk ? 'cloud-done-outline' : 'cloud-offline-outline'} size={13} color={syncOk ? '#45D483' : c.textDim} />
              <Txt variant="label" style={{ fontSize: 9 }} color={syncOk ? c.textDim : c.textDim}>
                {syncLabel}
              </Txt>
            </View>
          </View>
        </Card>

        <Section label="BODY" action="+ LOG WEIGHT" onAction={() => router.push('/metric')} style={{ marginTop: 24, marginBottom: 12 }} />
        <Card>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="WEIGHT" value={latest?.weight ? fmtKg(latest.weight) : '—'} unit="KG" />
            <Stat label="HEIGHT" value={profile?.height_cm ? String(profile.height_cm) : '—'} unit="CM" />
            <Stat label="BMI" value={b ? String(b) : '—'} />
          </View>
          {latest && first && latest.id !== first.id && latest.weight && first.weight ? (
            <Txt variant="mono" color={c.textDim} style={{ marginTop: 10 }}>
              {latest.weight - first.weight >= 0 ? '+' : '−'}
              {fmtKg(Math.abs(Math.round((latest.weight - first.weight) * 10) / 10))} KG SINCE {new Date(first.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
            </Txt>
          ) : null}
          {ms.length > 1 ? (
            <View style={{ marginTop: 12 }}>
              <LineChart data={ms.slice(-30).map((m) => ({ label: m.date.slice(5).split('-').reverse().join('.'), value: m.weight ?? 0 }))} height={130} format={(v) => `${fmtKg(v)}`} />
            </View>
          ) : null}
          {!profile?.height_cm || !latest ? (
            <Press onPress={() => router.push(latest ? '/settings' : '/metric')} style={{ marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(accent, 0.5) }}>
              <Txt variant="small">{!latest ? 'Log your weight to track it over time →' : 'Add your height in settings to see BMI →'}</Txt>
            </Press>
          ) : null}
        </Card>

        <Section label="LIFETIME" action="STATS →" onAction={() => router.push('/stats')} style={{ marginTop: 24, marginBottom: 12 }} />
        <Card>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="WORKOUTS" value={String(list.length)} />
            <Stat label="HOURS" value={String(Math.round(totals.hours))} />
            <Stat label="STREAK" value={String(weekStreak(list))} unit="WK" />
          </View>
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
          <View style={{ flexDirection: 'row' }}>
            <Stat label="VOLUME" value={fmtVolume(totals.volume)} unit="KG" />
            <Stat label="SETS" value={String(totals.sets)} />
            <Stat label="PRS" value={String(totals.prs)} color={totals.prs ? '#F5C542' : undefined} />
          </View>
        </Card>

        {totals.lifts.length ? (
          <>
            <Section label="BEST LIFTS · EST. 1RM" count={totals.lifts.length} style={{ marginTop: 24, marginBottom: 12 }} />
            <Card style={{ paddingVertical: 4 }}>
              {totals.lifts.map(([eid, v], i) => (
                <Press key={eid} scaleTo={0.985} onPress={() => router.push(`/exercise/${eid}`)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <Txt variant="title" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
                    {exName(getExercise(eid))}
                  </Txt>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, color: c.text }}>{fmtKg(Math.round(v * 10) / 10)}</Text>
                  <Txt variant="label" style={{ marginLeft: 4 }}>
                    KG
                  </Txt>
                </Press>
              ))}
            </Card>
          </>
        ) : null}

        <Button label="FULL STATISTICS" icon="stats-chart" variant="outline" onPress={() => router.push('/stats')} style={{ marginTop: 22 }} />
        <Txt variant="label" color={c.textFaint} style={{ textAlign: 'center', marginTop: 18, fontSize: 9 }}>
          GAINZONE · BUILD {BUILD}
        </Txt>
      </ScrollView>
    </Screen>
  );
}
