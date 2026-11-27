import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseList } from '@/components/ExerciseList';
import { SheetHeader } from '@/components/kit';
import { Button, IconBtn } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { deliverPick, pickOptions } from '@/lib/pick';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/nav';

export default function PickScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const opts = pickOptions();
  const [sel, setSel] = useState<string[]>([]);

  const done = (ids: string[]) => {
    deliverPick(ids);
    haptic.success();
    goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader
        kicker="LIBRARY"
        title={opts.title}
        onClose={() => goBack()}
        right={<IconBtn icon="add" size={36} onPress={() => router.push('/exercise-new')} />}
      />
      <ExerciseList
        selected={sel}
        bottomPad={insets.bottom + 100}
        onPress={(ex) => {
          if (!opts.multi) return done([ex.id]);
          haptic.tap();
          setSel((s) => (s.includes(ex.id) ? s.filter((x) => x !== ex.id) : [...s, ex.id]));
        }}
      />
      {opts.multi && sel.length ? (
        <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutDown.duration(180)} style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 16 }}>
          <Button label={`ADD ${sel.length} EXERCISE${sel.length > 1 ? 'S' : ''}`} icon="add" onPress={() => done(sel)} />
        </Animated.View>
      ) : null}
    </View>
  );
}
