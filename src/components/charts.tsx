import { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { alpha, fonts, useTheme } from '@/theme';

/** One series, one colour. Thin rounded bars, hairline grid, selective labels (best + current). Tap a bar for its value. */
export function BarChart({
  data,
  height = 150,
  color,
  format = (v) => String(Math.round(v)),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const { c, accent } = useTheme();
  const col = color ?? accent;
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const best = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);
  const last = data.length - 1;
  const top = 18;
  const bottom = 18;
  const plotH = height - top - bottom;
  const slot = w / Math.max(1, data.length);
  const bw = Math.min(24, slot * 0.56);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 ? (
        <>
          <Svg width={w} height={height}>
            {[0, 0.5, 1].map((t) => (
              <Line key={t} x1={0} x2={w} y1={top + plotH * (1 - t)} y2={top + plotH * (1 - t)} stroke={c.border} strokeWidth={1} />
            ))}
            {data.map((d, i) => {
              const h = (d.value / max) * plotH;
              const x = i * slot + (slot - bw) / 2;
              const y = top + plotH - h;
              const r = Math.min(4, h);
              const active = sel === null ? true : sel === i;
              return h > 0 ? (
                <Path
                  key={i}
                  d={`M${x} ${y + plotH * 0 + h} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + bw - r} ${y} Q${x + bw} ${y} ${x + bw} ${y + r} L${x + bw} ${y + h} Z`}
                  fill={active ? col : alpha(col, 0.35)}
                />
              ) : (
                <Rect key={i} x={x} y={top + plotH - 1} width={bw} height={1} fill={c.surface3} />
              );
            })}
          </Svg>
          {/* labels: best + current (or the tapped bar) */}
          {[...new Set(sel !== null ? [sel] : [best, last])].map((i) => {
            const d = data[i];
            if (!d || (d.value <= 0 && i !== last)) return null;
            const h = (d.value / max) * plotH;
            return (
              <Text
                key={`v${i}`}
                style={{
                  position: 'absolute',
                  left: i * slot - 20,
                  width: slot + 40,
                  top: top + plotH - h - 15,
                  textAlign: 'center',
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  color: c.text,
                }}
              >
                {format(d.value)}
              </Text>
            );
          })}
          {data.map((d, i) =>
            (last - i) % Math.ceil(data.length / 6) === 0 ? (
              <Text
                key={`l${i}`}
                style={{
                  position: 'absolute',
                  left: i * slot - 10,
                  width: slot + 20,
                  bottom: 0,
                  textAlign: 'center',
                  fontFamily: fonts.mono,
                  fontSize: 9,
                  letterSpacing: 0.6,
                  color: c.textFaint,
                }}
              >
                {d.label}
              </Text>
            ) : null,
          )}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
            {data.map((_, i) => (
              <Pressable key={i} style={{ flex: 1 }} onPress={() => setSel(sel === i ? null : i)} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** A line over time, with a soft fill. Tap to read the nearest point. */
export function LineChart({
  data,
  height = 160,
  color,
  format = (v) => String(Math.round(v)),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const { c, accent } = useTheme();
  const col = color ?? accent;
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  if (data.length === 0) return <View style={{ height }} />;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.15 || Math.max(1, max * 0.05);
  const lo = min - pad;
  const hi = max + pad;
  const top = 20;
  const bottom = 18;
  const plotH = height - top - bottom;
  const x = (i: number) => (data.length === 1 ? w / 2 : 8 + (i / (data.length - 1)) * (w - 16));
  const y = (v: number) => top + plotH * (1 - (v - lo) / (hi - lo));
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1)} ${top + plotH} L${x(0)} ${top + plotH} Z`;
  const show = sel ?? data.length - 1;
  const bestI = vals.indexOf(max);

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        if (!w) return;
        const lx = e.nativeEvent.locationX;
        let bi = 0;
        let bd = Infinity;
        data.forEach((_, i) => {
          const d = Math.abs(x(i) - lx);
          if (d < bd) {
            bd = d;
            bi = i;
          }
        });
        setSel(sel === bi ? null : bi);
      }}
    >
      {w > 0 ? (
        <>
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={col} stopOpacity={0.28} />
                <Stop offset="1" stopColor={col} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0, 0.5, 1].map((t) => (
              <Line key={t} x1={0} x2={w} y1={top + plotH * t} y2={top + plotH * t} stroke={c.border} strokeWidth={1} />
            ))}
            <Path d={area} fill="url(#fill)" />
            <Path d={line} stroke={col} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {data.length <= 40
              ? data.map((d, i) => <Circle key={i} cx={x(i)} cy={y(d.value)} r={i === show ? 4.5 : 2.4} fill={i === show ? col : c.bg} stroke={col} strokeWidth={1.6} />)
              : <Circle cx={x(show)} cy={y(data[show].value)} r={4.5} fill={col} />}
          </Svg>
          <Text
            style={{
              position: 'absolute',
              left: Math.min(Math.max(0, x(show) - 50), w - 100),
              width: 100,
              top: Math.max(0, y(data[show].value) - 20),
              textAlign: 'center',
              fontFamily: fonts.mono,
              fontSize: 10.5,
              color: c.text,
            }}
          >
            {format(data[show].value)}
          </Text>
          {sel === null && bestI !== show && data.length > 2 ? (
            <Text
              style={{
                position: 'absolute',
                left: Math.min(Math.max(0, x(bestI) - 50), w - 100),
                width: 100,
                top: Math.max(0, y(max) - 20),
                textAlign: 'center',
                fontFamily: fonts.mono,
                fontSize: 10,
                color: c.textDim,
              }}
            >
              {format(max)}
            </Text>
          ) : null}
          <Text style={{ position: 'absolute', left: 0, bottom: 0, fontFamily: fonts.mono, fontSize: 9, color: c.textFaint, letterSpacing: 0.6 }}>
            {data[0].label}
          </Text>
          <Text style={{ position: 'absolute', right: 0, bottom: 0, fontFamily: fonts.mono, fontSize: 9, color: c.textFaint, letterSpacing: 0.6 }}>
            {data[data.length - 1].label}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** Change vs previous period: arrow coloured, text neutral. */
export function Delta({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  const { c, isDark } = useTheme();
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const col = up ? (isDark ? '#45D483' : '#1F9D57') : c.danger;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Text style={{ color: col, fontSize: 11 }}>{up ? '▲' : '▼'}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: c.textDim }}>
        {up ? '+' : '−'}
        {Math.abs(Math.round(value))}
        {suffix}
      </Text>
    </View>
  );
}
