import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Press, Txt } from '@/components/ui';
import { dateKey, relativeLabel } from '@/lib/date';
import { getExercise, useExName } from '@/lib/exercise';
import { FEELINGS, fmtDur, fmtVolume } from '@/lib/stats';
import type { Workout } from '@/store/data';
import { alpha, useTheme } from '@/theme';

export function WorkoutCard({ w }: { w: Workout }) {
  const { c, accent } = useTheme();
  const exName = useExName();
  const feel = FEELINGS.find((f) => f.v === w.feeling);
  const d = new Date(w.started_at);
  return (
    <Press scaleTo={0.985} onPress={() => router.push(`/session/${w.id}`)} style={{ padding: 16, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color={accent}>
            {relativeLabel(dateKey(d))} · {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
          </Txt>
          <Txt variant="h2" style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>
            {w.name.toUpperCase()}
          </Txt>
        </View>
        {feel ? <Text style={{ fontSize: 22 }}>{feel.emoji}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
        <Txt variant="mono" color={c.textDim}>
          {fmtDur(w.duration_sec)}
        </Txt>
        <Txt variant="mono" color={c.textDim}>
          {fmtVolume(w.volume)} KG
        </Txt>
        <Txt variant="mono" color={c.textDim}>
          {w.sets_count} SETS
        </Txt>
        {w.prs_count ? (
          <Txt variant="mono" color="#F5C542">
            {w.prs_count} PR
          </Txt>
        ) : null}
      </View>
      <View style={{ marginTop: 10, gap: 3 }}>
        {w.exercises.slice(0, 4).map((we) => (
          <Txt key={we.id} variant="small" color={c.textDim} numberOfLines={1}>
            <Text style={{ color: c.textFaint }}>{we.sets.length} × </Text>
            {exName(getExercise(we.exercise_id))}
          </Txt>
        ))}
        {w.exercises.length > 4 ? (
          <Txt variant="small" color={c.textFaint}>
            + {w.exercises.length - 4} more
          </Txt>
        ) : null}
      </View>
      {w.note ? (
        <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: alpha(accent, 0.06), borderWidth: 1, borderColor: c.border }}>
          <Txt variant="small" numberOfLines={2}>
            {w.note}
          </Txt>
        </View>
      ) : null}
    </Press>
  );
}
