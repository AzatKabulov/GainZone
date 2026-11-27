import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ExerciseDef } from '@/data/exerciseTypes';
import { HEAT_COLORS, HEAT_COLORS_LIGHT, HEAT_LABEL, type HeatLevel, type MuscleId } from '@/data/muscles';
import { exImage, hasIllustration } from '@/lib/exercise';
import { alpha, fonts, useTheme } from '@/theme';
import { DARK_BODY, LIGHT_BODY } from './Body3D';
import { Press, Txt } from './ui';

export function SheetHeader({
  kicker,
  title,
  onClose,
  right,
  closeIcon = 'close',
}: {
  kicker: string;
  title: string;
  onClose: () => void;
  right?: ReactNode;
  closeIcon?: 'close' | 'chevron-down';
}) {
  const { c, accent } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt variant="label" color={accent}>
          {kicker}
        </Txt>
        <Txt variant="h1" style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>
          {title}
        </Txt>
      </View>
      {right}
      <Press
        tapHaptic
        scaleTo={0.9}
        onPress={onClose}
        hitSlop={8}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          marginLeft: 8,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={closeIcon} size={20} color={c.text} />
      </Press>
    </View>
  );
}

export function FieldLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Txt variant="label" style={{ marginBottom: 10 }}>
        {children}
      </Txt>
    </View>
  );
}

/** Big number + label, for stat rows. With onPress it shows a small pencil and is tappable. */
export function Stat({
  label,
  value,
  unit,
  align = 'left',
  color,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  align?: 'left' | 'center';
  color?: string;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Txt variant="label">{label}</Txt>
        {onPress ? <Ionicons name="pencil" size={10} color={c.textFaint} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: 0.6, color: color ?? c.text }}>{value}</Text>
        {unit ? <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: c.textDim }}>{unit}</Text> : null}
      </View>
    </>
  );
  const style = { flex: 1, alignItems: align === 'center' ? ('center' as const) : ('flex-start' as const) };
  return onPress ? (
    <Press tapHaptic scaleTo={0.96} hitSlop={8} onPress={onPress} style={style}>
      {body}
    </Press>
  ) : (
    <View style={style}>{body}</View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}

export function heatColors(isDark: boolean) {
  return isDark ? HEAT_COLORS : HEAT_COLORS_LIGHT;
}

export function HeatLegend({ compact }: { compact?: boolean }) {
  const { c, isDark } = useTheme();
  const cols = heatColors(isDark);
  const ranges: Record<HeatLevel, string> = { 0: '0', 1: '1–5', 2: '6–9', 3: '10–20', 4: '20+' };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 10 : 12 }}>
      {([0, 1, 2, 3, 4] as HeatLevel[]).map((l) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cols[l], borderWidth: l === 0 ? 1 : 0, borderColor: c.borderStrong }} />
          <Txt variant="label" style={{ fontSize: 9, letterSpacing: 1.2 }}>
            {compact ? ranges[l] : `${HEAT_LABEL[l]} · ${ranges[l]}`}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** Round exercise thumbnail: drawn illustration, or the 3D muscle render (custom exercises get an icon). */
export function ExerciseThumb({ ex, size = 48 }: { ex: ExerciseDef; size?: number }) {
  const { c } = useTheme();
  const img = exImage(ex.id);
  const drawn = hasIllustration(ex.id);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: drawn ? '#F2EEE6' : c.surface2,
        borderWidth: drawn ? 0 : 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {img ? (
        <Image source={img} style={{ width: size, height: size }} contentFit="cover" transition={100} />
      ) : (
        <Ionicons name="barbell-outline" size={size * 0.45} color={c.textFaint} />
      )}
    </View>
  );
}

/** Body colours for the 3D figure in the current theme. */
export function useBodyPalette() {
  const { isDark } = useTheme();
  return isDark ? DARK_BODY : LIGHT_BODY;
}

/** Primary muscles in the accent, secondary dimmed. */
export function exerciseColors(ex: ExerciseDef, accent: string, idle: string): Partial<Record<MuscleId, string>> {
  const out: Partial<Record<MuscleId, string>> = {};
  for (const [m, v] of Object.entries(ex.m) as [MuscleId, number][]) {
    if (v >= 25) out[m] = accent;
    else if (v >= 10) out[m] = mix(idle, accent, 0.5);
    else if (v > 0) out[m] = mix(idle, accent, 0.22);
  }
  return out;
}

export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Small coloured pill. */
export function Tag({ label, color }: { label: string; color?: string }) {
  const { c } = useTheme();
  const col = color ?? c.textDim;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        height: 22,
        borderRadius: 7,
        backgroundColor: alpha(col, 0.14),
        borderWidth: 1,
        borderColor: alpha(col, 0.4),
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.2, color: col }}>{label}</Text>
    </View>
  );
}
