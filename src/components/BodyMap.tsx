import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import type { MuscleId } from '@/data/muscles';
import { useTheme } from '@/theme';
import { BACK, FRONT, SILHOUETTE_HALF, type View as Side } from './bodyPaths';

/**
 * 2D muscle map (front / back). Muscles without a colour are drawn in the neutral body tone.
 * `onPress` makes muscles tappable.
 */
export function BodyMap({
  colors,
  view,
  height = 220,
  base,
  onPress,
  selected,
}: {
  colors: Partial<Record<MuscleId, string>>;
  view: Side;
  height?: number;
  base?: string;
  onPress?: (m: MuscleId) => void;
  selected?: MuscleId | null;
}) {
  const { c, isDark } = useTheme();
  const body = base ?? (isDark ? '#1C1C20' : '#E4DFD5');
  const idle = isDark ? '#2A2A2F' : '#D3CDC1';
  const shapes = view === 'front' ? FRONT : BACK;
  const w = (height * 100) / 220;
  const half = (mirror: boolean) =>
    shapes.map((s, i) => (
      <Path
        key={`${mirror ? 'r' : 'l'}${i}`}
        d={s.d}
        fill={colors[s.m] ?? idle}
        stroke={selected === s.m ? c.text : c.bg}
        strokeWidth={selected === s.m ? 0.9 : 0.6}
        onPress={onPress ? () => onPress(s.m) : undefined}
      />
    ));
  return (
    <View style={{ width: w, height }}>
      <Svg width={w} height={height} viewBox="0 0 100 220">
        <Path d={SILHOUETTE_HALF} fill={body} />
        <G transform="translate(100,0) scale(-1,1)">
          <Path d={SILHOUETTE_HALF} fill={body} />
        </G>
        {half(false)}
        <G transform="translate(100,0) scale(-1,1)">{half(true)}</G>
      </Svg>
    </View>
  );
}

export function BodyMapPair({
  colors,
  height = 220,
  onPress,
  selected,
}: {
  colors: Partial<Record<MuscleId, string>>;
  height?: number;
  onPress?: (m: MuscleId) => void;
  selected?: MuscleId | null;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: height * 0.08 }}>
      <BodyMap colors={colors} view="front" height={height} onPress={onPress} selected={selected} />
      <BodyMap colors={colors} view="back" height={height} onPress={onPress} selected={selected} />
    </View>
  );
}
