import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path, Circle, Line, Text as SvgText, G, Defs,
  RadialGradient, Stop, Ellipse,
} from 'react-native-svg';
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
  return f * Math.PI * 2 - Math.PI / 2;
}

function polarToXY(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(
  cx: number, cy: number,
  rO: number, rI: number,
  a1: number, a2: number
): string {
  const x1o = cx + rO * Math.cos(a1), y1o = cy + rO * Math.sin(a1);
  const x2o = cx + rO * Math.cos(a2), y2o = cy + rO * Math.sin(a2);
  const x1i = cx + rI * Math.cos(a1), y1i = cy + rI * Math.sin(a1);
  const x2i = cx + rI * Math.cos(a2), y2i = cy + rI * Math.sin(a2);
  const lg = a2 - a1 > Math.PI ? 1 : 0;
  return `M${x1o} ${y1o}A${rO} ${rO} 0 ${lg} 1 ${x2o} ${y2o}L${x2i} ${y2i}A${rI} ${rI} 0 ${lg} 0 ${x1i} ${y1i}Z`;
}

// 光る円弧（外側：経過 / 内側：残り）
function glowArcPath(
  cx: number, cy: number, r: number,
  startFrac: number, endFrac: number
): string {
  const a1 = fracToAngle(startFrac);
  const a2 = fracToAngle(endFrac);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
  const lg = (endFrac - startFrac) > 0.5 ? 1 : 0;
  return `M${x1} ${y1}A${r} ${r} 0 ${lg} 1 ${x2} ${y2}`;
}

function positionInRange(date: Date, range: ScaleRange): number {
  const total = range.end.getTime() - range.start.getTime();
  const pos = date.getTime() - range.start.getTime();
  return Math.max(0, Math.min(1, pos / total));
}

export function CircularCalendar({
  size, range, tasks, selectedSlice, onSlicePress, onTaskPress,
}: Props) {
  const cx = size / 2, cy = size / 2;
  const rOuter = size * 0.42;
  const rInner = rOuter * 0.30;   // center disk radius
  const rGoldArc = rOuter + 4;    // outer gold arc
  const rBlueArc = rOuter - 10;   // inner blue arc

  const nowFrac = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    return (now.getTime() - range.start.getTime()) /
      (range.end.getTime() - range.start.getTime());
  }, [range]);

  const nowIdx = nowFrac != null ? Math.floor(nowFrac * N) : -1;

  // tick marks
  const ticks = useMemo(() => Array.from({ length: N }, (_, i) => {
    const a = fracToAngle(i / N);
    const r1 = rOuter + 8;
    const r2 = rOuter + (i % 6 === 0 ? 20 : 12);
    return {
      x1: cx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a),
      x2: cx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a),
      big: i % 6 === 0,
    };
  }), [cx, cy, rOuter]);

  // hour labels
  const labels = useMemo(() => Array.from({ length: N / 2 }, (_, i) => {
    const hr = i * 2;
    const a = fracToAngle((hr + 0.5) / N);
    const lr = rOuter + 28;
    return {
      hr,
      x: cx + lr * Math.cos(a),
      y: cy + lr * Math.sin(a),
      big: hr % 6 === 0,
    };
  }), [cx, cy, rOuter]);

  // task arcs
  const taskArcs = useMemo(() => tasks.map(task => {
    const start = new Date(task.start_at);
    const end = new Date(task.end_at);
    if (end <= range.start || start >= range.end) return null;
    const p1 = positionInRange(start, range);
    const p2 = positionInRange(end, range);
    const a1 = fracToAngle(p1), a2 = fracToAngle(p2);
    const midA = (a1 + a2) / 2;
    const midR = (rGoldArc + rBlueArc) / 2;
    return {
      task,
      d: arcPath(cx, cy, rGoldArc + 2, rBlueArc - 2, a1, a2),
      labelX: cx + midR * Math.cos(midA),
      labelY: cy + midR * Math.sin(midA),
    };
  }).filter(Boolean) as NonNullable<ReturnType<typeof tasks.map>[number]>[], [tasks, range, cx, cy, rGoldArc, rBlueArc]);

  const goldPath = nowFrac != null
    ? glowArcPath(cx, cy, rGoldArc, 0, nowFrac)
    : null;
  const bluePath = nowFrac != null
    ? glowArcPath(cx, cy, rBlueArc, nowFrac, 1)
    : glowArcPath(cx, cy, rBlueArc, 0, 1);

  const nowGoldXY = nowFrac != null
    ? polarToXY(cx, cy, rGoldArc, fracToAngle(nowFrac))
    : null;
  const nowBlueXY = nowFrac != null
    ? polarToXY(cx, cy, rBlueArc, fracToAngle(nowFrac))
    : null;

  return (
    <View style={[styles.wrap, { width: size, height: size + 60 }]}>
      <Svg width={size} height={size + 60} style={{ overflow: 'visible' }}>
        <Defs>
          <RadialGradient id="diskGrad" cx="38%" cy="28%" r="72%">
            <Stop offset="0%" stopColor="rgba(40,36,80,0.95)" />
            <Stop offset="60%" stopColor="rgba(14,12,35,0.92)" />
            <Stop offset="100%" stopColor="rgba(4,3,16,0.95)" />
          </RadialGradient>
        </Defs>

        {/* ── Base circles (dim guide rings) ── */}
        <Circle cx={cx} cy={cy} r={rGoldArc} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
        <Circle cx={cx} cy={cy} r={rBlueArc} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />

        {/* ── Slice highlight for selected / now ── */}
        {Array.from({ length: N }, (_, i) => {
          const a1 = fracToAngle(i / N);
          const a2 = fracToAngle((i + 1) / N);
          const isNow = i === nowIdx;
          const isSel = i === selectedSlice;
          if (!isNow && !isSel) return null;
          return (
            <Path
              key={i}
              d={arcPath(cx, cy, rGoldArc + 2, rBlueArc - 2, a1, a2)}
              fill={isSel ? 'rgba(255,255,255,0.06)' : 'rgba(255,107,157,0.06)'}
              onPress={() => onSlicePress(i)}
            />
          );
        })}

        {/* Transparent tap targets for slices */}
        {Array.from({ length: N }, (_, i) => {
          const a1 = fracToAngle(i / N);
          const a2 = fracToAngle((i + 1) / N);
          return (
            <Path
              key={`tap-${i}`}
              d={arcPath(cx, cy, rGoldArc + 2, rBlueArc - 2, a1, a2)}
              fill="transparent"
              onPress={() => onSlicePress(i)}
            />
          );
        })}

        {/* ── Task arcs ── */}
        {taskArcs.map((t) => (
          <G key={t.task.id}>
            <Path
              d={t.d}
              fill="rgba(255,255,255,0.12)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={0.8}
              onPress={() => onTaskPress(t.task)}
            />
            <SvgText
              x={t.labelX} y={t.labelY + 4}
              textAnchor="middle" fill="rgba(255,255,255,0.8)"
              fontSize={10} fontWeight="300"
            >
              {t.task.title.length > 5 ? t.task.title.slice(0, 5) + '…' : t.task.title}
            </SvgText>
          </G>
        ))}

        {/* ── Gold arc (elapsed) — glow layers ── */}
        {goldPath && <>
          <Path d={goldPath} fill="none" stroke="rgba(232,197,106,0.15)" strokeWidth={6} strokeLinecap="round" />
          <Path d={goldPath} fill="none" stroke="rgba(232,197,106,0.3)" strokeWidth={2.5} strokeLinecap="round" />
          <Path d={goldPath} fill="none" stroke="#E8C56A" strokeWidth={1.2} strokeLinecap="round" />
        </>}

        {/* ── Blue arc (remaining) — glow layers ── */}
        {bluePath && <>
          <Path d={bluePath} fill="none" stroke="rgba(90,155,232,0.15)" strokeWidth={6} strokeLinecap="round" />
          <Path d={bluePath} fill="none" stroke="rgba(90,155,232,0.3)" strokeWidth={2.5} strokeLinecap="round" />
          <Path d={bluePath} fill="none" stroke="#5A9BE8" strokeWidth={1.2} strokeLinecap="round" />
        </>}

        {/* ── Tick marks ── */}
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.big ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'}
            strokeWidth={t.big ? 0.8 : 0.5}
          />
        ))}

        {/* ── Hour labels ── */}
        {labels.map((l) => (
          <SvgText
            key={l.hr}
            x={l.x} y={l.y + 4}
            textAnchor="middle"
            fill={l.big ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'}
            fontSize={l.big ? 11 : 9}
            fontWeight="200"
          >
            {l.hr}
          </SvgText>
        ))}

        {/* ── Now dots ── */}
        {nowGoldXY && (
          <>
            <Circle cx={nowGoldXY.x} cy={nowGoldXY.y} r={7} fill="rgba(232,197,106,0.2)" />
            <Circle cx={nowGoldXY.x} cy={nowGoldXY.y} r={3.5} fill="#E8C56A" />
          </>
        )}
        {nowBlueXY && (
          <>
            <Circle cx={nowBlueXY.x} cy={nowBlueXY.y} r={6} fill="rgba(90,155,232,0.2)" />
            <Circle cx={nowBlueXY.x} cy={nowBlueXY.y} r={3} fill="#5A9BE8" />
          </>
        )}

        {/* ── Center disk ── */}
        {/* Shadow */}
        <Circle cx={cx} cy={cy + 4} r={rInner + 2} fill="rgba(0,0,0,0.4)" />
        {/* Base */}
        <Circle cx={cx} cy={cy} r={rInner} fill="url(#diskGrad)" stroke="rgba(255,255,255,0.18)" strokeWidth={0.6} />
        {/* Shimmer */}
        <Ellipse
          cx={cx - rInner * 0.2} cy={cy - rInner * 0.28}
          rx={rInner * 0.42} ry={rInner * 0.2}
          fill="rgba(255,255,255,0.1)"
        />
        {/* Labels */}
        <SvgText
          x={cx} y={cy - rInner * 0.08}
          textAnchor="middle" fill="rgba(255,255,255,0.88)"
          fontSize={rInner * 0.36} fontWeight="300"
        >
          {range.label}
        </SvgText>
        <SvgText
          x={cx} y={cy + rInner * 0.32}
          textAnchor="middle" fill="rgba(255,255,255,0.28)"
          fontSize={rInner * 0.2} fontWeight="200"
        >
          {range.subLabel}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
});
