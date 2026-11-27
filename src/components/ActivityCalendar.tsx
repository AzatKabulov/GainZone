import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { GROUP_NAME, type GroupId, type MuscleId, MUSCLES } from '@/data/muscles';
import { addDays, dateKey, dayNum, diffDays, monthLong, relativeLabel, startOfWeek, todayKey } from '@/lib/date';
import { getExercise } from '@/lib/exercise';
import { haptic } from '@/lib/haptics';
import { fmtDur, fmtVolume, isWorking, weekStreak, workoutsByDay } from '@/lib/stats';
import type { Workout } from '@/store/data';
import { alpha, fonts, useTheme } from '@/theme';
import { monthCells, shiftMonth } from './MonthCalendar';
import { Card, Press, Txt } from './ui';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Main muscle groups a workout hit (primary movers only), most sets first. */
export function workoutGroups(w: Workout): GroupId[] {
  const sets: Partial<Record<GroupId, number>> = {};
  for (const we of w.exercises) {
    const n = we.sets.filter(isWorking).length;
    if (!n) continue;
    const ex = getExercise(we.exercise_id);
    const seen = new Set<GroupId>();
    for (const [m, pct] of Object.entries(ex.m) as [MuscleId, number][]) {
      if (pct < 25) continue;
      const g = MUSCLES[m].group;
      if (seen.has(g)) continue;
      seen.add(g);
      sets[g] = (sets[g] ?? 0) + n;
    }
  }
  return (Object.keys(sets) as GroupId[]).sort((a, b) => (sets[b] ?? 0) - (sets[a] ?? 0));
}

/**
 * Training calendar for the home screen: this week at a glance (tap the month to open the whole
 * month), day cells shaded by volume, and the selected day's workouts right underneath.
 */
export function ActivityCalendar({ list, goal }: { list: Workout[]; goal: number }) {
  const { c, accent, onAccent } = useTheme();
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);

  const byDay = useMemo(() => workoutsByDay(list), [list]);
  const maxVol = useMemo(() => {
    let m = 1;
    for (const k of Object.keys(byDay)) m = Math.max(m, byDay[k].reduce((a, w) => a + w.volume, 0));
    return m;
  }, [byDay]);
  const streak = useMemo(() => weekStreak(list), [list]);

  const weekStart = startOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekCount = weekDays.reduce((a, k) => a + (byDay[k]?.length ?? 0), 0);

  const rows: (string | null)[][] = [];
  if (open) {
    const cells = monthCells(month);
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  } else rows.push(weekDays);

  const monthCount = list.filter((w) => dateKey(new Date(w.started_at)).startsWith(month)).length;
  const [y, m] = (open ? month : today.slice(0, 7)).split('-').map(Number);
  const dayList = byDay[day] ?? [];

  const pick = (k: string) => {
    haptic.tap();
    setDay(k);
  };

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)}>
      <Card style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {open ? (
            <Press tapHaptic hitSlop={8} onPress={() => setMonth(shiftMonth(month, -1))} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={18} color={c.text} />
            </Press>
          ) : null}
          <Press
            tapHaptic
            scaleTo={0.97}
            onPress={() => {
              setOpen(!open);
              setMonth(today.slice(0, 7));
            }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Txt variant="h2">
              {monthLong(new Date(y, m - 1, 1)).toUpperCase()}
              {y !== Number(today.slice(0, 4)) ? ` ${y}` : ''}
            </Txt>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.textDim} />
          </Press>
          {open ? (
            <Press
              tapHaptic
              hitSlop={8}
              disabled={month >= today.slice(0, 7)}
              onPress={() => setMonth(shiftMonth(month, 1))}
              style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', opacity: month >= today.slice(0, 7) ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-forward" size={18} color={c.text} />
            </Press>
          ) : (
            <>
              <Pill label={`${weekCount}/${goal} WEEK`} color={weekCount >= goal ? accent : c.textDim} />
              {streak ? <Pill icon="flame" label={`${streak} WK`} color="#F59E0B" /> : null}
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 6 }}>
          {DOW.map((d, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.2, color: c.textFaint }}>
              {d}
            </Text>
          ))}
        </View>

        <View style={{ gap: 6 }}>
          {rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', gap: 6 }}>
              {row.map((k, i) => {
                if (!k) return <View key={`p${i}`} style={{ flex: 1, height: 40 }} />;
                const ws = byDay[k] ?? [];
                const vol = ws.reduce((a, w) => a + w.volume, 0);
                const t = ws.length ? 0.3 + 0.7 * Math.min(1, vol / maxVol) : 0;
                const sel = k === day;
                const isToday = k === today;
                const future = k > today;
                const strong = t >= 0.6;
                return (
                  <Press
                    key={k}
                    scaleTo={0.9}
                    disabled={future}
                    onPress={() => pick(k)}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: ws.length ? alpha(accent, t) : c.surface2,
                      borderWidth: sel ? 2 : 1,
                      borderColor: sel ? c.text : isToday ? accent : ws.length ? 'transparent' : c.border,
                      opacity: future ? 0.3 : 1,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: ws.length ? (strong ? onAccent : c.text) : isToday ? accent : c.textDim }}>
                      {dayNum(k)}
                    </Text>
                    {ws.length > 1 ? (
                      <View style={{ position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 }}>
                        {ws.slice(0, 3).map((w) => (
                          <View key={w.id} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: strong ? onAccent : c.text }} />
                        ))}
                      </View>
                    ) : null}
                  </Press>
                );
              })}
            </View>
          ))}
        </View>

        {open ? (
          <Txt variant="label" color={c.textFaint} style={{ marginTop: 10, textAlign: 'center' }}>
            {monthCount} WORKOUTS · DARKER = MORE VOLUME
          </Txt>
        ) : null}

        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }}>
          {dayList.length ? (
            <View style={{ gap: 8 }}>
              {dayList.map((w) => (
                <DayWorkout key={w.id} w={w} />
              ))}
            </View>
          ) : (
            <Animated.View key={day} entering={FadeIn.duration(180)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={day === today ? 'flash-outline' : 'moon-outline'} size={16} color={c.textFaint} />
              <Txt variant="small" color={c.textDim} style={{ flex: 1 }}>
                {day === today ? 'Nothing logged today yet.' : `${relativeLabel(day)} — rest day.`}
              </Txt>
            </Animated.View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

function DayWorkout({ w }: { w: Workout }) {
  const { c, accent } = useTheme();
  const groups = workoutGroups(w).slice(0, 4);
  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <Press scaleTo={0.98} onPress={() => router.push(`/session/${w.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
        <View style={{ flex: 1 }}>
          <Txt variant="title" numberOfLines={1}>
            {w.name}
          </Txt>
          <Txt variant="label" color={c.textDim} style={{ marginTop: 3 }} numberOfLines={1}>
            {fmtDur(w.duration_sec)} · {fmtVolume(w.volume)} KG · {w.sets_count} SETS
            {w.prs_count ? ` · ${w.prs_count} PR` : ''}
          </Txt>
          {groups.length ? (
            <Txt variant="small" color={c.textFaint} style={{ marginTop: 2 }} numberOfLines={1}>
              {groups.map((g) => GROUP_NAME[g]).join(' · ')}
            </Txt>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
      </Press>
    </Animated.View>
  );
}

function Pill({ label, color, icon }: { label: string; color: string; icon?: 'flame' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: alpha(color, 0.12), borderWidth: 1, borderColor: alpha(color, 0.35) }}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.1, color }}>{label}</Text>
    </View>
  );
}

/* ─────────────────────────── recovery ─────────────────────────── */

const RECOVERY: { id: string; label: string; groups: GroupId[] }[] = [
  { id: 'chest', label: 'CHEST', groups: ['chest'] },
  { id: 'back', label: 'BACK', groups: ['back', 'traps'] },
  { id: 'shoulders', label: 'SHOULDERS', groups: ['shoulders'] },
  { id: 'arms', label: 'ARMS', groups: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', label: 'LEGS', groups: ['legs'] },
  { id: 'core', label: 'CORE', groups: ['abs'] },
];

/**
 * Days since each body area was last trained as a primary mover. Freshly hit areas are still
 * recovering; the ones left longest float to the front as "due".
 */
export function RecoveryStrip({ list }: { list: Workout[] }) {
  const { c, accent } = useTheme();
  const today = todayKey();
  const items = useMemo(() => {
    const last: Record<string, string> = {};
    for (const w of list) {
      const k = dateKey(new Date(w.started_at));
      const gs = new Set(workoutGroups(w));
      for (const r of RECOVERY) if (r.groups.some((g) => gs.has(g)) && (!last[r.id] || k > last[r.id])) last[r.id] = k;
    }
    return RECOVERY.map((r) => ({ ...r, days: last[r.id] ? diffDays(last[r.id], today) : null })).sort(
      (a, b) => (b.days ?? 999) - (a.days ?? 999),
    );
  }, [list, today]);

  if (!list.length) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Txt variant="label" style={{ flex: 1 }}>
          RECOVERY · DAYS SINCE TRAINED
        </Txt>
        <Press tapHaptic hitSlop={8} onPress={() => router.push('/body')}>
          <Txt variant="label" color={accent}>
            BODY →
          </Txt>
        </Press>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {items.map((r) => {
          const fresh = r.days !== null && r.days <= 1;
          const due = r.days === null || r.days >= 5;
          const col = fresh ? '#EF4444' : due ? c.textDim : accent;
          return (
            <View key={r.id} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: fresh ? alpha(col, 0.4) : due ? c.border : alpha(col, 0.45), alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: col }}>{r.days === null ? '—' : r.days > 30 ? '30+' : `${r.days}D`}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.mono, fontSize: 8, letterSpacing: 0.8, color: c.textDim, marginTop: 2 }}>
                {r.label}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
        <Legend color="#EF4444" label="RECOVERING" />
        <Legend color={accent} label="READY" />
        <Legend color={c.textDim} label="DUE" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Txt variant="label" style={{ fontSize: 9 }}>
        {label}
      </Txt>
    </View>
  );
}
