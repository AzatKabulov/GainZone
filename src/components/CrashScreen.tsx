import { Ionicons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useTheme } from '@/theme';
import { Button } from './ui';

/** Shown instead of a white crash when a screen throws while rendering. Your data is untouched. */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const { c, accent } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 40, paddingHorizontal: 24 }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="bandage-outline" size={26} color={accent} />
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: c.text, marginTop: 20 }}>
        SOMETHING BROKE<Text style={{ color: accent }}>.</Text>
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: c.textDim, marginTop: 10 }}>
        This screen hit an error. Your workouts and the live session are safe — tap below to reload it.
      </Text>
      <Text numberOfLines={4} style={{ fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: c.textFaint, marginTop: 16 }}>
        {error.message}
      </Text>
      <Button label="TRY AGAIN" icon="refresh" onPress={retry} style={{ marginTop: 24 }} />
    </View>
  );
}
