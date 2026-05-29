import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
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
  path.addArc(
    { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
    startFrac * 360 - 90,
    (endFrac - startFrac) * 360
  );
  return path;
}

function makeFullCircle(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  path.addArc({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, 0, 360);
  return path;
}

function positionInRange(date: Date, range: ScaleRange): number {
  const total = range.end.getTime() - range.start.getTime();
  return Math.max(0, Math.min(1, (date.getTime() - range.start.getTime()) / total));
}

function GlowArc({ path, color }: { path: ReturnType<typeof Skia.Path.Make>; color: string }) {
  return (
    <Group>
      <Path path={path} style="stroke" strokeWidth={20} color={color} opacity={0.08} strokeCap="round">
        <BlurMask blur={20} style="outer" />
      </Path>
      <Path path={path} style="stroke" strokeWidth={6} color={color} opacity={0.2} strokeCap="round">
        <BlurMask blur={6} style="outer" />
      </Path>
      <Path path={path} style="stroke" strokeWidth={1.5} color={color} opacity={1.0} strokeCap="round" />
    </Group>
  );
}

function GlowDot({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <Group>
      <Circle cx={x} cy={y} r={r * 6} color={color} opacity={0.1}>
        <BlurMask blur={r * 4} style="outer" />
      </Circle>
      <Circle cx={x} cy={y} r={r} color={color} />
    </Group>
  );
}

// タッチ用: タップした角度からスライスindexを計算
function angleToSlice(x: number, y: number, cx: number, cy: number, n: number): number {
  const angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor((normalized / (Math.PI * 2)) * n);
}

// タップした座標がリング上にあるか
function isInRing(x: number, y: number, cx: number, cy: number, rOuter: number, rInner: number): boolean {
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  return dist >= rInner && dist <= rOuter;
}

// タップした座標に近いタスクを探す
function findTaskAtPoint(
  x: number, y: number, cx: number, cy: number,
  rOuter: number, rInner: number,
  tasks: Task[], range: ScaleRange
): Task | null {
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  if (dist < rInner || dist > rOuter) return null;
  const angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const frac = normalized / (Math.PI * 2);
  for (const task of tasks) {
    const s = positionInRange(new Date(task.start_at), range);
    const e = positionInRange(new Date(task.end_at), range);
    if (frac >= s && frac <= e) return task;
  }
  return null;
}

export function CircularCalendar({
  size, range, tasks, selectedSlice, onSlicePress, onTaskPress,
}: Props) {
  const cx = size / 2, cy = size / 2;
  const rGold = size * 0.415;
  const rBlue = size * 0.345;
  const rCenter = size * 0.185;
  const rTouchOuter = rGold + 24;
  const rTouchInner = rCenter + 4;

  const nowFrac = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    return (now.getTime() - range.start.getTime()) /
      (range.end.getTime() - range.start.getTime());
  }, [range]);

  const goldPath = useMemo(() =>
    nowFrac != null && nowFrac > 0.002 ? makeArcPath(cx, cy, rGold, 0, nowFrac) : null,
    [cx, cy, rGold, nowFrac]);

  const bluePath = useMemo(() => {
    const s = nowFrac ?? 0;
    return s < 0.998 ? makeArcPath(cx, cy, rBlue, s, 1) : null;
  }, [cx, cy, rBlue, nowFrac]);

  const baseGold = useMemo(() => makeFullCircle(cx, cy, rGold), [cx, cy, rGold]);
  const baseBlue = useMemo(() => makeFullCircle(cx, cy, rBlue), [cx, cy, rBlue]);

  const tickPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < N; i++) {
      const a = fracToRad(i / N);
      const r1 = rGold + 5, r2 = rGold + (i % 6 === 0 ? 18 : 10);
      p.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      p.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    }
    return p;
  }, [cx, cy, rGold]);

  // Selected slice highlight path
  const selectedPath = useMemo(() => {
    if (selectedSlice == null) return null;
    return makeArcPath(cx, cy, (rGold + rBlue) / 2, selectedSlice / N, (selectedSlice + 1) / N);
  }, [cx, cy, rGold, rBlue, selectedSlice]);

  const taskPaths = useMemo(() => tasks.map(task => {
    const s = new Date(task.start_at), e = new Date(task.end_at);
    if (e <= range.start || s >= range.end) return null;
    const p1 = positionInRange(s, range), p2 = positionInRange(e, range);
    return { task, path: makeArcPath(cx, cy, (rGold + rBlue) / 2, p1, p2) };
  }).filter(Boolean) as { task: Task; path: ReturnType<typeof Skia.Path.Make> }[],
    [tasks, range, cx, cy, rGold, rBlue]);

  const nowGold = nowFrac != null ? polarXY(cx, cy, rGold, fracToRad(nowFrac)) : null;
  const nowBlue = nowFrac != null ? polarXY(cx, cy, rBlue, fracToRad(nowFrac)) : null;

  const hourLabels = useMemo(() => Array.from({ length: N / 2 }, (_, i) => {
    const hr = i * 2;
    const a = fracToRad((hr + 0.5) / N);
    const lr = rGold + 28;
    return { hr, x: cx + lr * Math.cos(a), y: cy + lr * Math.sin(a), big: hr % 6 === 0 };
  }), [cx, cy, rGold]);

  const handleTouch = (x: number, y: number) => {
    // Check if tapped on a task first
    const task = findTaskAtPoint(x, y, cx, cy, rGold + 20, rBlue - 20, tasks, range);
    if (task) { onTaskPress(task); return; }
    // Otherwise register as slice tap
    if (isInRing(x, y, cx, cy, rTouchOuter, rTouchInner)) {
      const slice = angleToSlice(x, y, cx, cy, N);
      onSlicePress(slice);
    }
  };

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* Skia canvas — pointer events none so touches pass through */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">

        <Path path={baseGold} style="stroke" strokeWidth={0.5} color="rgba(255,255,255,0.05)" />
        <Path path={baseBlue} style="stroke" strokeWidth={0.5} color="rgba(255,255,255,0.04)" />

        {/* Selected slice highlight */}
        {selectedPath && (
          <Path path={selectedPath} style="stroke" strokeWidth={rGold - rBlue} color="rgba(255,255,255,0.07)" />
        )}

        {taskPaths.map((t, i) => (
          <Group key={i}>
            <Path path={t.path} style="stroke" strokeWidth={4} color="rgba(255,255,255,0.06)" strokeCap="round">
              <BlurMask blur={4} style="outer" />
            </Path>
            <Path path={t.path} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.5)" strokeCap="round" />
          </Group>
        ))}

        {goldPath && <GlowArc path={goldPath} color="#E8C56A" />}
        {bluePath && <GlowArc path={bluePath} color="#5A9BE8" />}

        <Path path={tickPath} style="stroke" strokeWidth={0.7} color="rgba(255,255,255,0.22)" />

        {nowGold && <GlowDot x={nowGold.x} y={nowGold.y} r={3.5} color="#E8C56A" />}
        {nowBlue && <GlowDot x={nowBlue.x} y={nowBlue.y} r={3} color="#5A9BE8" />}

        {/* Glass sphere */}
        <Circle cx={cx} cy={cy} r={rCenter} style="stroke" strokeWidth={rCenter * 0.06} color="rgba(120,50,30,0.35)">
          <BlurMask blur={rCenter * 0.08} style="outer" />
        </Circle>
        <Circle cx={cx} cy={cy} r={rCenter} color="#000000" />
        <Circle cx={cx} cy={cy} r={rCenter * 0.95} color="rgba(8,5,20,0.85)" />
        <Circle cx={cx - rCenter * 0.15} cy={cy - rCenter * 0.25} r={rCenter * 0.55} color="rgba(200,200,255,0.07)">
          <BlurMask blur={rCenter * 0.5} style="normal" />
        </Circle>
        <Circle cx={cx - rCenter * 0.2} cy={cy - rCenter * 0.3} r={rCenter * 0.3} color="rgba(255,255,255,0.12)">
          <BlurMask blur={rCenter * 0.25} style="normal" />
        </Circle>
        <Circle cx={cx - rCenter * 0.22} cy={cy - rCenter * 0.33} r={rCenter * 0.1} color="rgba(255,255,255,0.35)">
          <BlurMask blur={rCenter * 0.08} style="normal" />
        </Circle>
        <Circle cx={cx + rCenter * 0.05} cy={cy + rCenter * 0.35} r={rCenter * 0.6} color="rgba(0,0,0,0.5)">
          <BlurMask blur={rCenter * 0.3} style="normal" />
        </Circle>
        <Circle cx={cx + rCenter * 0.45} cy={cy + rCenter * 0.1} r={rCenter * 0.4} color="rgba(60,40,100,0.18)">
          <BlurMask blur={rCenter * 0.25} style="normal" />
        </Circle>
        <Circle cx={cx} cy={cy} r={rCenter - 1} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.06)" />

      </Canvas>

      {/* Transparent touch layer */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          handleTouch(locationX, locationY);
        }}
      />

      {/* Hour labels */}
      {hourLabels.map((l) => (
        <Text key={l.hr} style={[styles.hour, { left: l.x - 14, top: l.y - 9 }, l.big ? styles.hourBig : styles.hourSm]}>
          {l.hr}
        </Text>
      ))}

      {/* Center label */}
      <View style={[styles.centerWrap, { top: cy - 24, width: size }]} pointerEvents="none">
        <Text style={styles.centerTitle}>{range.label}</Text>
        <Text style={styles.centerSub}>{range.subLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  hour: { position: 'absolute', textAlign: 'center', width: 28 },
  hourBig: { fontSize: 11, fontWeight: '200', color: 'rgba(255,255,255,0.45)' },
  hourSm:  { fontSize: 9,  fontWeight: '200', color: 'rgba(255,255,255,0.18)' },
  centerWrap: { position: 'absolute', alignItems: 'center' },
  centerTitle: { fontSize: 26, fontWeight: '200', color: 'rgba(255,255,255,0.88)', letterSpacing: 3 },
  centerSub:   { fontSize: 10, fontWeight: '200', color: 'rgba(255,255,255,0.25)', letterSpacing: 1.5, marginTop: 5 },
});
