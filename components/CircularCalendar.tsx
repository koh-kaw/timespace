import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import {
  Canvas, Path, Circle, Skia, BlurMask, Group,
  Paint, vec,
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

function fracToAngle(f: number) {
  // 0 = top (12 o'clock), clockwise, in degrees for Skia arcs
  return f * 360 - 90;
}

function fracToRad(f: number) {
  return f * Math.PI * 2 - Math.PI / 2;
}

function polarXY(cx: number, cy: number, r: number, rad: number) {
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function makeArcPath(
  cx: number, cy: number,
  r: number,
  startFrac: number,
  endFrac: number
): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make();
  const startDeg = fracToAngle(startFrac);
  const sweepDeg = (endFrac - startFrac) * 360;
  path.addArc(
    { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
    startDeg,
    sweepDeg
  );
  return path;
}

function makeFullCirclePath(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  path.addArc({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, 0, 360);
  return path;
}

function positionInRange(date: Date, range: ScaleRange): number {
  const total = range.end.getTime() - range.start.getTime();
  const pos = date.getTime() - range.start.getTime();
  return Math.max(0, Math.min(1, pos / total));
}

export function CircularCalendar({
  size, range, tasks, selectedSlice, onSlicePress, onTaskPress,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rGold = size * 0.41;
  const rBlue = size * 0.34;
  const rCenter = size * 0.18;
  const rTick = rGold;

  const nowFrac = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    return (now.getTime() - range.start.getTime()) /
      (range.end.getTime() - range.start.getTime());
  }, [range]);

  // Precompute paths
  const goldArcPath = useMemo(() =>
    nowFrac != null && nowFrac > 0.001
      ? makeArcPath(cx, cy, rGold, 0, nowFrac)
      : null,
    [cx, cy, rGold, nowFrac]
  );

  const blueArcPath = useMemo(() => {
    const start = nowFrac ?? 0;
    return start < 0.999
      ? makeArcPath(cx, cy, rBlue, start, 1)
      : null;
  }, [cx, cy, rBlue, nowFrac]);

  const baseGoldPath = useMemo(() => makeFullCirclePath(cx, cy, rGold), [cx, cy, rGold]);
  const baseBluePath = useMemo(() => makeFullCirclePath(cx, cy, rBlue), [cx, cy, rBlue]);

  const centerPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(cx, cy, rCenter);
    return p;
  }, [cx, cy, rCenter]);

  // Tick marks path
  const tickPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < N; i++) {
      const a = fracToRad(i / N);
      const r1 = rTick + 4;
      const r2 = rTick + (i % 6 === 0 ? 14 : 8);
      p.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      p.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    }
    return p;
  }, [cx, cy, rTick]);

  // Task arc paths
  const taskPaths = useMemo(() => tasks.map(task => {
    const start = new Date(task.start_at);
    const end = new Date(task.end_at);
    if (end <= range.start || start >= range.end) return null;
    const p1 = positionInRange(start, range);
    const p2 = positionInRange(end, range);
    const rMid = (rGold + rBlue) / 2;
    return {
      task,
      path: makeArcPath(cx, cy, rMid, p1, p2),
    };
  }).filter(Boolean) as { task: Task; path: ReturnType<typeof Skia.Path.Make> }[],
    [tasks, range, cx, cy, rGold, rBlue]
  );

  const nowGoldPos = nowFrac != null ? polarXY(cx, cy, rGold, fracToRad(nowFrac)) : null;
  const nowBluePos = nowFrac != null ? polarXY(cx, cy, rBlue, fracToRad(nowFrac)) : null;

  // Hour label positions
  const hourLabels = useMemo(() => Array.from({ length: N / 2 }, (_, i) => {
    const hr = i * 2;
    const a = fracToRad((hr + 0.5) / N);
    const lr = rGold + 22;
    return { hr, x: cx + lr * Math.cos(a), y: cy + lr * Math.sin(a), big: hr % 6 === 0 };
  }), [cx, cy, rGold]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Canvas style={StyleSheet.absoluteFill}>

        {/* ── Base guide circles ── */}
        <Path path={baseGoldPath} style="stroke" strokeWidth={0.5} color="rgba(255,255,255,0.06)" />
        <Path path={baseBluePath} style="stroke" strokeWidth={0.5} color="rgba(255,255,255,0.05)" />

        {/* ── Task arcs ── */}
        {taskPaths.map((t, i) => (
          <Path key={i} path={t.path} style="stroke" strokeWidth={6} color="rgba(255,255,255,0.18)" strokeCap="round" />
        ))}

        {/* ── Gold arc — glow ── */}
        {goldArcPath && (
          <Group>
            <Path path={goldArcPath} style="stroke" strokeWidth={12} color="rgba(232,197,106,0.18)" strokeCap="round">
              <BlurMask blur={6} style="normal" />
            </Path>
            <Path path={goldArcPath} style="stroke" strokeWidth={4} color="rgba(232,197,106,0.45)" strokeCap="round">
              <BlurMask blur={2} style="normal" />
            </Path>
            <Path path={goldArcPath} style="stroke" strokeWidth={1.5} color="#E8C56A" strokeCap="round" />
          </Group>
        )}

        {/* ── Blue arc — glow ── */}
        {blueArcPath && (
          <Group>
            <Path path={blueArcPath} style="stroke" strokeWidth={12} color="rgba(90,155,232,0.18)" strokeCap="round">
              <BlurMask blur={6} style="normal" />
            </Path>
            <Path path={blueArcPath} style="stroke" strokeWidth={4} color="rgba(90,155,232,0.45)" strokeCap="round">
              <BlurMask blur={2} style="normal" />
            </Path>
            <Path path={blueArcPath} style="stroke" strokeWidth={1.5} color="#5A9BE8" strokeCap="round" />
          </Group>
        )}

        {/* ── Tick marks ── */}
        <Path path={tickPath} style="stroke" strokeWidth={0.8} color="rgba(255,255,255,0.22)" />

        {/* ── Now dots ── */}
        {nowGoldPos && (
          <Group>
            <Circle cx={nowGoldPos.x} cy={nowGoldPos.y} r={10} color="rgba(232,197,106,0.2)">
              <BlurMask blur={4} style="normal" />
            </Circle>
            <Circle cx={nowGoldPos.x} cy={nowGoldPos.y} r={3.5} color="#E8C56A" />
          </Group>
        )}
        {nowBluePos && (
          <Group>
            <Circle cx={nowBluePos.x} cy={nowBluePos.y} r={8} color="rgba(90,155,232,0.2)">
              <BlurMask blur={4} style="normal" />
            </Circle>
            <Circle cx={nowBluePos.x} cy={nowBluePos.y} r={3} color="#5A9BE8" />
          </Group>
        )}

        {/* ── Center disk ── */}
        <Circle cx={cx} cy={cy} r={rCenter + 2} color="rgba(0,0,0,0.35)">
          <BlurMask blur={8} style="normal" />
        </Circle>
        <Circle cx={cx} cy={cy} r={rCenter} color="#0c0a22" />
        <Circle cx={cx} cy={cy} r={rCenter} style="stroke" strokeWidth={0.6} color="rgba(255,255,255,0.2)" />
        {/* Shimmer */}
        <Circle cx={cx - rCenter * 0.22} cy={cy - rCenter * 0.3} r={rCenter * 0.42} color="rgba(255,255,255,0.07)" />

      </Canvas>

      {/* Hour labels — native Text for sharpness */}
      {hourLabels.map((l) => (
        <Text
          key={l.hr}
          style={[
            styles.hourLabel,
            { left: l.x - 14, top: l.y - 8 },
            l.big ? styles.hourBig : styles.hourSmall,
          ]}
        >
          {l.hr}
        </Text>
      ))}

      {/* Center label */}
      <View style={[styles.centerWrap, { top: cy - 22, width: size }]}>
        <Text style={styles.centerTitle}>{range.label}</Text>
        <Text style={styles.centerSub}>{range.subLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  hourLabel: { position: 'absolute', textAlign: 'center', width: 28 },
  hourBig: { fontSize: 11, fontWeight: '200', color: 'rgba(255,255,255,0.5)' },
  hourSmall: { fontSize: 9, fontWeight: '200', color: 'rgba(255,255,255,0.22)' },
  centerWrap: { position: 'absolute', alignItems: 'center' },
  centerTitle: { fontSize: 24, fontWeight: '300', color: 'rgba(255,255,255,0.9)', letterSpacing: 2 },
  centerSub: { fontSize: 10, fontWeight: '200', color: 'rgba(255,255,255,0.28)', letterSpacing: 1, marginTop: 4 },
});
