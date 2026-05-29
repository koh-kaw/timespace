import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import {
  Canvas, Path, Circle, Skia, BlurMask, Group,
} from '@shopify/react-native-skia';
import type { Task } from '../lib/supabase';
import type { ScaleRange } from '../lib/time';

type Props = {
  size: number;
  range: ScaleRange;
  tasks: Task[];
  selectedSlice: number | null;
  onSlicePress: (index: number) => void;
  onTaskPress: (task: Task) => void;
};

const N = 24;

function fracToRad(f: number) {
  return f * Math.PI * 2 - Math.PI / 2;
}

function polarXY(cx: number, cy: number, r: number, rad: number) {
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function makeArcPath(cx: number, cy: number, r: number, startFrac: number, endFrac: number) {
  const path = Skia.Path.Make();
  const startDeg = startFrac * 360 - 90;
  const sweepDeg = (endFrac - startFrac) * 360;
  path.addArc({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, startDeg, sweepDeg);
  return path;
}

function makeFullCircle(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  path.addArc({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, 0, 360);
  return path;
}

function positionInRange(date: Date, range: ScaleRange): number {
  const total = range.end.getTime() - range.start.getTime();
  const pos = date.getTime() - range.start.getTime();
  return Math.max(0, Math.min(1, pos / total));
}

// Glow arc: 4 layers like web version
function GlowArc({
  path, color, alpha,
}: {
  path: ReturnType<typeof Skia.Path.Make>;
  color: string;
  alpha: number;
}) {
  return (
    <Group>
      {/* Layer 1: wide soft glow */}
      <Path path={path} style="stroke" strokeWidth={24} color={color} opacity={alpha * 0.12} strokeCap="round">
        <BlurMask blur={14} style="normal" />
      </Path>
      {/* Layer 2: mid glow */}
      <Path path={path} style="stroke" strokeWidth={14} color={color} opacity={alpha * 0.22} strokeCap="round">
        <BlurMask blur={7} style="normal" />
      </Path>
      {/* Layer 3: tight glow */}
      <Path path={path} style="stroke" strokeWidth={6} color={color} opacity={alpha * 0.5} strokeCap="round">
        <BlurMask blur={3} style="normal" />
      </Path>
      {/* Layer 4: sharp core */}
      <Path path={path} style="stroke" strokeWidth={2} color={color} opacity={alpha} strokeCap="round" />
    </Group>
  );
}

export function CircularCalendar({
  size, range, tasks, selectedSlice, onSlicePress, onTaskPress,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rGold = size * 0.415;
  const rBlue = size * 0.345;
  const rCenter = size * 0.185;

  const nowFrac = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    return (now.getTime() - range.start.getTime()) /
      (range.end.getTime() - range.start.getTime());
  }, [range]);

  const goldPath = useMemo(() =>
    nowFrac != null && nowFrac > 0.001 ? makeArcPath(cx, cy, rGold, 0, nowFrac) : null,
    [cx, cy, rGold, nowFrac]);

  const bluePath = useMemo(() => {
    const s = nowFrac ?? 0;
    return s < 0.999 ? makeArcPath(cx, cy, rBlue, s, 1) : null;
  }, [cx, cy, rBlue, nowFrac]);

  const baseGold = useMemo(() => makeFullCircle(cx, cy, rGold), [cx, cy, rGold]);
  const baseBlue = useMemo(() => makeFullCircle(cx, cy, rBlue), [cx, cy, rBlue]);

  const tickPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < N; i++) {
      const a = fracToRad(i / N);
      const r1 = rGold + 5;
      const r2 = rGold + (i % 6 === 0 ? 18 : 10);
      p.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      p.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    }
    return p;
  }, [cx, cy, rGold]);

  const taskPaths = useMemo(() => tasks.map(task => {
    const s = new Date(task.start_at), e = new Date(task.end_at);
    if (e <= range.start || s >= range.end) return null;
    const p1 = positionInRange(s, range), p2 = positionInRange(e, range);
    const rMid = (rGold + rBlue) / 2;
    return { task, path: makeArcPath(cx, cy, rMid, p1, p2) };
  }).filter(Boolean) as { task: Task; path: ReturnType<typeof Skia.Path.Make> }[],
    [tasks, range, cx, cy, rGold, rBlue]);

  const nowGold = nowFrac != null ? polarXY(cx, cy, rGold, fracToRad(nowFrac)) : null;
  const nowBlue = nowFrac != null ? polarXY(cx, cy, rBlue, fracToRad(nowFrac)) : null;

  const hourLabels = useMemo(() => Array.from({ length: N / 2 }, (_, i) => {
    const hr = i * 2;
    const a = fracToRad((hr + 0.5) / N);
    const lr = rGold + 26;
    return { hr, x: cx + lr * Math.cos(a), y: cy + lr * Math.sin(a), big: hr % 6 === 0 };
  }), [cx, cy, rGold]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Canvas style={StyleSheet.absoluteFill}>

        {/* Base guide circles */}
        <Path path={baseGold} style="stroke" strokeWidth={0.6} color="rgba(255,255,255,0.07)" />
        <Path path={baseBlue} style="stroke" strokeWidth={0.6} color="rgba(255,255,255,0.06)" />

        {/* Task arcs */}
        {taskPaths.map((t, i) => (
          <Group key={i}>
            <Path path={t.path} style="stroke" strokeWidth={10} color="rgba(255,255,255,0.08)" strokeCap="round">
              <BlurMask blur={4} style="normal" />
            </Path>
            <Path path={t.path} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.4)" strokeCap="round" />
          </Group>
        ))}

        {/* Gold arc */}
        {goldPath && <GlowArc path={goldPath} color="#E8C56A" alpha={1} />}

        {/* Blue arc */}
        {bluePath && <GlowArc path={bluePath} color="#5A9BE8" alpha={1} />}

        {/* Ticks */}
        <Path path={tickPath} style="stroke" strokeWidth={0.8} color="rgba(255,255,255,0.25)" />

        {/* Now gold dot */}
        {nowGold && (
          <Group>
            <Circle cx={nowGold.x} cy={nowGold.y} r={16} color="#E8C56A" opacity={0.15}>
              <BlurMask blur={10} style="normal" />
            </Circle>
            <Circle cx={nowGold.x} cy={nowGold.y} r={5} color="#E8C56A" opacity={0.6}>
              <BlurMask blur={3} style="normal" />
            </Circle>
            <Circle cx={nowGold.x} cy={nowGold.y} r={3} color="#FFE49A" />
          </Group>
        )}

        {/* Now blue dot */}
        {nowBlue && (
          <Group>
            <Circle cx={nowBlue.x} cy={nowBlue.y} r={14} color="#5A9BE8" opacity={0.15}>
              <BlurMask blur={8} style="normal" />
            </Circle>
            <Circle cx={nowBlue.x} cy={nowBlue.y} r={4} color="#5A9BE8" opacity={0.6}>
              <BlurMask blur={3} style="normal" />
            </Circle>
            <Circle cx={nowBlue.x} cy={nowBlue.y} r={2.5} color="#8DC4FF" />
          </Group>
        )}

        {/* Center disk shadow */}
        <Circle cx={cx} cy={cy + 5} r={rCenter + 4} color="rgba(0,0,0,0.5)">
          <BlurMask blur={12} style="normal" />
        </Circle>

        {/* Center disk base */}
        <Circle cx={cx} cy={cy} r={rCenter} color="#080618" />

        {/* Center disk glass overlay */}
        <Circle cx={cx} cy={cy} r={rCenter} color="rgba(255,255,255,0.04)" />

        {/* Center rim */}
        <Circle cx={cx} cy={cy} r={rCenter} style="stroke" strokeWidth={0.7} color="rgba(255,255,255,0.22)" />

        {/* Shimmer highlight */}
        <Circle cx={cx - rCenter * 0.22} cy={cy - rCenter * 0.3} r={rCenter * 0.4} color="rgba(255,255,255,0.08)">
          <BlurMask blur={6} style="normal" />
        </Circle>

      </Canvas>

      {/* Hour labels */}
      {hourLabels.map((l) => (
        <Text
          key={l.hr}
          style={[
            styles.hour,
            { left: l.x - 14, top: l.y - 9 },
            l.big ? styles.hourBig : styles.hourSm,
          ]}
        >
          {l.hr}
        </Text>
      ))}

      {/* Center label */}
      <View style={[styles.centerWrap, { top: cy - 24, width: size }]}>
        <Text style={styles.centerTitle}>{range.label}</Text>
        <Text style={styles.centerSub}>{range.subLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  hour: { position: 'absolute', textAlign: 'center', width: 28 },
  hourBig: { fontSize: 11, fontWeight: '200', color: 'rgba(255,255,255,0.52)' },
  hourSm:  { fontSize: 9,  fontWeight: '200', color: 'rgba(255,255,255,0.22)' },
  centerWrap: { position: 'absolute', alignItems: 'center' },
  centerTitle: { fontSize: 26, fontWeight: '200', color: 'rgba(255,255,255,0.9)', letterSpacing: 3 },
  centerSub:   { fontSize: 10, fontWeight: '200', color: 'rgba(255,255,255,0.28)', letterSpacing: 1.5, marginTop: 5 },
});
