import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getExercise, useExName } from '@/lib/exercise';
import { startWorkout } from '@/lib/workout';
import { useData } from '@/store/data';
import { useTheme } from '@/theme';
import { Backdrop, SHEET_IN } from './Backdrop';
import { ExerciseThumb } from './kit';
import { Button, Press, Txt } from './ui';

/** Bottom sheet behind the tab bar's WORKOUT button: empty workout or one of the routines. */
export function StartSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {visible ? <Body onClose={onClose} /> : null}
    </Modal>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const { c, accent, onAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const exName = useExName();
  const templates = useData((s) => s.templates);
  const list = useMemo(
    () =>
      Object.values(templates)
        .filter((t) => !t.deleted)
        .sort((a, b) => (b.last_used_at ?? '').localeCompare(a.last_used_at ?? '') || a.sort_order - b.sort_order),
    [templates],
  );

  const go = (templateId: string | null) => {
    startWorkout(templateId);
    onClose();
    router.push('/workout');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Backdrop onPress={onClose} />
      <Animated.View entering={SHEET_IN}
        style={{
          maxHeight: '78%',
          backgroundColor: c.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          borderColor: c.border,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 14 }} />
        <View style={{ paddingHorizontal: 20 }}>
          <Txt variant="label" color={accent}>
            LET&apos;S GO
          </Txt>
          <Txt variant="h1" style={{ marginTop: 4 }}>
            START WORKOUT
          </Txt>
          <Button label="EMPTY WORKOUT" icon="flash" onPress={() => go(null)} style={{ marginTop: 16 }} />
          {list.length ? (
            <Txt variant="label" style={{ marginTop: 22, marginBottom: 10 }}>
              FROM A ROUTINE · {list.length}
            </Txt>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }} showsVerticalScrollIndicator={false}>
          {list.map((t) => (
            <Press
              key={t.id}
              scaleTo={0.98}
              onPress={() => go(t.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}
            >
              {t.exercises[0] ? <ExerciseThumb ex={getExercise(t.exercises[0].exercise_id)} size={42} /> : null}
              <View style={{ flex: 1 }}>
                <Txt variant="title" numberOfLines={1}>
                  {t.name || 'Routine'}
                </Txt>
                <Txt variant="small" color={c.textDim} numberOfLines={1}>
                  {t.exercises.map((e) => exName(getExercise(e.exercise_id))).join(' · ') || 'No exercises yet'}
                </Txt>
              </View>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="play" size={15} color={onAccent} />
              </View>
            </Press>
          ))}
          <Button
            label="NEW ROUTINE"
            icon="add"
            variant="outline"
            small
            onPress={() => {
              onClose();
              router.push('/routine/new');
            }}
            style={{ marginTop: 6 }}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}
