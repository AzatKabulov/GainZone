import { Image } from 'expo-image';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BODY2D_BASE, BODY2D_MASKS } from '@/data/body2d';
import { MUSCLE_IDS, type MuscleId } from '@/data/muscles';
import { fonts, useTheme } from '@/theme';

type View2D = 'front' | 'back';

/**
 * Flat front / back body map: a pre-rendered figure with per-muscle masks tinted in place.
 * Cheap (no GL), so it is used for small previews and whenever the 3D view can't start.
 */
export function Body2D({
  colors,
  views = ['front', 'back'],
  labels = false,
  style,
}: {
  colors: Partial<Record<MuscleId, string>>;
  views?: View2D[];
  /** show FRONT / BACK captions under the figures */
  labels?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'center' }, style]}>
      {views.map((v) => (
        <View key={v} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flex: 1, aspectRatio: 0.5, maxWidth: '100%' }}>
            <Image source={BODY2D_BASE[v]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} contentFit="contain" />
            {MUSCLE_IDS.map((m) => {
              const src = BODY2D_MASKS[m]?.[v];
              const col = colors[m];
              if (!src || !col) return null;
              return <Image key={m} source={src} tintColor={col} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} contentFit="contain" />;
            })}
          </View>
          {labels ? <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.4, color: c.textFaint, marginTop: 4 }}>{v.toUpperCase()}</Text> : null}
        </View>
      ))}
    </View>
  );
}
