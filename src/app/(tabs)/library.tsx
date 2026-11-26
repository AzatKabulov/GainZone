import { router } from 'expo-router';
import { View } from 'react-native';

import { ExerciseList } from '@/components/ExerciseList';
import { IconBtn, Screen, ScreenTitle, TAB_BAR_SPACE } from '@/components/ui';
import { useAllExercises } from '@/lib/exercise';
import { useActive } from '@/store/active';

export default function LibraryScreen() {
  const all = useAllExercises();
  const live = useActive((s) => !!s.workout);
  return (
    <Screen>
      <ExerciseList
        bottomPad={TAB_BAR_SPACE + (live ? 70 : 0)}
        onPress={(ex) => router.push(`/exercise/${ex.id}`)}
        header={
          <View style={{ paddingHorizontal: 20 }}>
            <ScreenTitle kicker={`${all.length} EXERCISES`} title="LIBRARY" right={<IconBtn icon="add" accentFill onPress={() => router.push('/exercise-new')} />} />
          </View>
        }
      />
    </Screen>
  );
}
