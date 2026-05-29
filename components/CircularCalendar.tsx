import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path, Circle, Text as SvgText, G, Line, Defs,
  RadialGradient, Stop, Filter, FeGaussianBlur,
} from 'react-native-svg';
import { arcPath, positionInRange, positionToAngle, type ScaleRange } from '../lib/time';
import type { Task } from '../lib/supabase';
import { theme } from '../lib/theme';

type Props = {
  size: number;
  range: ScaleRange;
  tasks: Task[];
  selectedSlice: number | null;
  onSlicePress: (index: number) => void;
  onTaskPress: (task: Task) => void;
};

const PADDING = 32;

export function CircularCalendar({ size, range, tasks, selectedSlice, onSlicePress, onTaskPress }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - PADDING;
  const rInner = rOuter * 0.24;
  const rGlow = rOuter + 8;

  const nowAngle = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    const pos = (now.getTime() - range.start.getTime()) /
      (range.end.getTime() - range.start.getTime());
    return pos * 2 * Math.PI - Math.PI / 2;
  }, [range]);

  const slices = useMemo(() => {
    const labelEveryNth = range.divisions > 12 ? Math.ceil(range.divisions / 12) : 1;
    const nowIdx = nowAngle != null
      ? Math.floor(((nowAngle + Math.PI / 2) / (2 * Math.PI)) * range.divisions)
      : -1;
    return Array.from({ length: range.divisions }, (_, i) => {
      const a1 = (i / range.divisions) * 2 * Math.PI - Math.PI / 2;
      const a2 = ((i + 1) / range.divisions) * 2 * Math.PI - Math.PI / 2;
      return {
        index: i,
        d: arcPath(cx, cy, rOuter, rInner, a1, a2),
        midAngle: (a1 + a2) / 2,
        label: i % labelEveryNth === 0 ? labelForSlice(range, i) : '',
        isNow: i === nowIdx,
      };
    });
  }, [range, cx, cy, rOuter, rInner, nowAngle]);

  const taskArcs = useMemo(() => {
    return tasks.map((task) => {
      const start = new Date(task.start_at);
      const end = new Date(task.end_at);
      if (end <= range.start || start >= range.end) return null;
      const a1 = positionToAngle(positionInRange(start, range));
      const a2 = positionToAngle(positionInRange(end, range));
      const midA = (a1 + a2) / 2;
      const midR = (rOuter + rInner) / 2;
      return {
        task,
        d: arcPath(cx, cy, rOuter, rInner, a1, a2),
        glowD: arcPath(cx, cy, rOuter + 4, rInner - 4, a1, a2),
        labelX: cx + midR * Math.cos(midA),
        labelY: cy + midR * Math.sin(midA),
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tasks, range, cx, cy, rOuter, rInner]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1A1640" stopOpacity={0.95} />
            <Stop offset="100%" stopColor="#0D0B1E" stopOpacity={0.8} />
          </RadialGradient>
          <RadialGradient id="nowGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF6B9D" stopOpacity={0.6} />
            <Stop offset="100%" stopColor="#FF6B9D" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Outer glow ring */}
        <Circle
          cx={cx} cy={cy} r={rGlow}
          fill="none"
          stroke="rgba(139,127,255,0.15)"
          strokeWidth={12}
        />

        {/* Slices */}
        {slices.map((s) => (
          <Path
            key={`s${s.index}`}
            d={s.d}
            fill={
              selectedSlice === s.index
                ? 'rgba(139,127,255,0.25)'
                : s.isNow
                ? 'rgba(255,107,157,0.1)'
                : 'rgba(255,255,255,0.04)'
            }
            stroke={
              selectedSlice === s.index
                ? 'rgba(139,127,255,0.6)'
                : 'rgba(255,255,255,0.08)'
            }
            strokeWidth={selectedSlice === s.index ? 1 : 0.5}
            onPress={() => onSlicePress(s.index)}
          />
        ))}

        {/* Task arcs — glow layer */}
        {taskArcs.map((t) => (
          <Path
            key={`tg${t.task.id}`}
            d={t.glowD}
            fill="rgba(139,127,255,0.15)"
            stroke="none"
          />
        ))}

        {/* Task arcs — main layer */}
        {taskArcs.map((t) => (
          <G key={`t${t.task.id}`}>
            <Path
              d={t.d}
              fill="rgba(139,127,255,0.45)"
              stroke="rgba(168,156,255,0.8)"
              strokeWidth={1}
              onPress={() => onTaskPress(t.task)}
            />
            <SvgText
              x={t.labelX} y={t.labelY + 4}
              fontSize={10} fontWeight="600"
              fill="#FFFFFF" textAnchor="middle"
              pointerEvents="none"
            >
              {truncate(t.task.title, 5)}
            </SvgText>
          </G>
        ))}

        {/* Slice labels */}
        {slices.map((s) => {
          if (!s.label) return null;
          const lr = rOuter + 16;
          return (
            <SvgText
              key={`l${s.index}`}
              x={cx + lr * Math.cos(s.midAngle)}
              y={cy + lr * Math.sin(s.midAngle) + 4}
              fontSize={10} fill="rgba(255,255,255,0.45)"
              textAnchor="middle"
            >
              {s.label}
            </SvgText>
          );
        })}

        {/* Now indicator */}
        {nowAngle != null && (
          <>
            <Circle
              cx={cx + (rInner + 4) * Math.cos(nowAngle)}
              cy={cy + (rInner + 4) * Math.sin(nowAngle)}
              r={14} fill="rgba(255,107,157,0.2)"
            />
            <Line
              x1={cx + rInner * Math.cos(nowAngle)}
              y1={cy + rInner * Math.sin(nowAngle)}
              x2={cx + rOuter * Math.cos(nowAngle)}
              y2={cy + rOuter * Math.sin(nowAngle)}
              stroke="#FF6B9D" strokeWidth={2} strokeLinecap="round"
            />
            <Circle
              cx={cx + rOuter * Math.cos(nowAngle)}
              cy={cy + rOuter * Math.sin(nowAngle)}
              r={3} fill="#FF6B9D"
            />
          </>
        )}

        {/* Center glass */}
        <Circle cx={cx} cy={cy} r={rInner}
          fill="url(#centerGrad)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={0.5}
        />
        <SvgText x={cx} y={cy - 6}
          fontSize={13} fontWeight="600"
          fill="#FFFFFF" textAnchor="middle"
          opacity={0.9}
        >
          {range.label}
        </SvgText>
        <SvgText x={cx} y={cy + 10}
          fontSize={9} fill="rgba(255,255,255,0.45)"
          textAnchor="middle"
        >
          {range.subLabel}
        </SvgText>
      </Svg>
    </View>
  );
}

function labelForSlice(range: ScaleRange, i: number): string {
  switch (range.kind) {
    case 'decade': return `${range.start.getFullYear() + i}`;
    case 'year': return `${i + 1}月`;
    case 'month': return `${i + 1}`;
    case 'week': return ['月', '火', '水', '木', '金', '土', '日'][i];
    case 'day': {
      const totalMs = range.end.getTime() - range.start.getTime();
      const sliceMs = totalMs / range.divisions;
      const sliceStart = new Date(range.start.getTime() + i * sliceMs);
      const h = sliceStart.getHours();
      const m = sliceStart.getMinutes();
      const sliceMin = sliceMs / 60_000;
      if (sliceMin >= 60) return `${h}時`;
      return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, '0')}`;
    }
    default: return '';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const styles = StyleSheet.create({ wrap: { alignSelf: 'center' } });
