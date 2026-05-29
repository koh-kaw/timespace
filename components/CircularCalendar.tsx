import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, G, Line } from 'react-native-svg';
import {
  arcPath,
  positionInRange,
  positionToAngle,
  type ScaleRange,
} from '../lib/time';
import type { Task } from '../lib/supabase';

type Props = {
  size: number;
  range: ScaleRange;
  tasks: Task[];
  selectedSlice: number | null;
  onSlicePress: (index: number) => void;
  onTaskPress: (task: Task) => void;
};

const PADDING = 28;
const COLORS = {
  bg: '#F7F6F2',
  slice: '#FFFFFF',
  sliceSelected: '#EEEDFE',
  sliceBorder: '#E2E0D8',
  centerBg: '#FFFFFF',
  centerBorder: '#E2E0D8',
  labelText: '#999895',
  centerLabel: '#2C2C2A',
  centerSub: '#AAAAAA',
  nowLine: '#FF4D4D',
  taskFill: '#7F77DD',
  taskStroke: '#534AB7',
  taskText: '#26215C',
};

export function CircularCalendar({
  size,
  range,
  tasks,
  selectedSlice,
  onSlicePress,
  onTaskPress,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - PADDING;
  const rInner = rOuter * 0.26;

  // Current time indicator angle
  const nowAngle = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    const pos = (now.getTime() - range.start.getTime()) /
      (range.end.getTime() - range.start.getTime());
    return pos * 2 * Math.PI - Math.PI / 2;
  }, [range]);

  const slices = useMemo(() => {
    const result: {
      index: number;
      d: string;
      midAngle: number;
      label: string;
      isNow: boolean;
    }[] = [];
    const labelEveryNth = range.divisions > 12 ? Math.ceil(range.divisions / 12) : 1;
    const nowIdx = nowAngle != null
      ? Math.floor(((nowAngle + Math.PI / 2) / (2 * Math.PI)) * range.divisions)
      : -1;
    for (let i = 0; i < range.divisions; i++) {
      const a1 = (i / range.divisions) * 2 * Math.PI - Math.PI / 2;
      const a2 = ((i + 1) / range.divisions) * 2 * Math.PI - Math.PI / 2;
      result.push({
        index: i,
        d: arcPath(cx, cy, rOuter, rInner, a1, a2),
        midAngle: (a1 + a2) / 2,
        label: i % labelEveryNth === 0 ? labelForSlice(range, i) : '',
        isNow: i === nowIdx,
      });
    }
    return result;
  }, [range, cx, cy, rOuter, rInner, nowAngle]);

  const taskArcs = useMemo(() => {
    return tasks
      .map((task) => {
        const start = new Date(task.start_at);
        const end = new Date(task.end_at);
        if (end <= range.start || start >= range.end) return null;
        const p1 = positionInRange(start, range);
        const p2 = positionInRange(end, range);
        const a1 = positionToAngle(p1);
        const a2 = positionToAngle(p2);
        const midA = (a1 + a2) / 2;
        const midR = (rOuter + rInner) / 2;
        return {
          task,
          d: arcPath(cx, cy, rOuter, rInner, a1, a2),
          labelX: cx + midR * Math.cos(midA),
          labelY: cy + midR * Math.sin(midA),
          midAngle: midA,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tasks, range, cx, cy, rOuter, rInner]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle cx={cx} cy={cy} r={rOuter} fill={COLORS.bg} />

        {/* Slices */}
        <G>
          {slices.map((s) => (
            <Path
              key={`slice-${s.index}`}
              d={s.d}
              fill={
                selectedSlice === s.index
                  ? COLORS.sliceSelected
                  : s.isNow
                  ? '#FFF5F5'
                  : COLORS.slice
              }
              stroke={COLORS.sliceBorder}
              strokeWidth={0.5}
              onPress={() => onSlicePress(s.index)}
            />
          ))}
        </G>

        {/* Task arcs */}
        <G>
          {taskArcs.map((t) => (
            <G key={`task-${t.task.id}`}>
              <Path
                d={t.d}
                fill={t.task.color || COLORS.taskFill}
                fillOpacity={0.6}
                stroke={t.task.color || COLORS.taskStroke}
                strokeWidth={1}
                onPress={() => onTaskPress(t.task)}
              />
              <SvgText
                x={t.labelX}
                y={t.labelY + 4}
                fontSize={10}
                fontWeight="600"
                fill={COLORS.taskText}
                textAnchor="middle"
                pointerEvents="none"
              >
                {truncate(t.task.title, 5)}
              </SvgText>
            </G>
          ))}
        </G>

        {/* Slice labels */}
        <G>
          {slices.map((s) => {
            if (!s.label) return null;
            const lr = rOuter + 14;
            const lx = cx + lr * Math.cos(s.midAngle);
            const ly = cy + lr * Math.sin(s.midAngle);
            return (
              <SvgText
                key={`lbl-${s.index}`}
                x={lx}
                y={ly + 4}
                fontSize={10}
                fill={COLORS.labelText}
                textAnchor="middle"
                fontWeight="400"
              >
                {s.label}
              </SvgText>
            );
          })}
        </G>

        {/* Now indicator line */}
        {nowAngle != null && (
          <Line
            x1={cx + rInner * Math.cos(nowAngle)}
            y1={cy + rInner * Math.sin(nowAngle)}
            x2={cx + rOuter * Math.cos(nowAngle)}
            y2={cy + rOuter * Math.sin(nowAngle)}
            stroke={COLORS.nowLine}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}

        {/* Center */}
        <Circle
          cx={cx}
          cy={cy}
          r={rInner}
          fill={COLORS.centerBg}
          stroke={COLORS.centerBorder}
          strokeWidth={0.5}
        />
        <SvgText
          x={cx}
          y={cy - 4}
          fontSize={13}
          fontWeight="500"
          fill={COLORS.centerLabel}
          textAnchor="middle"
        >
          {range.label}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 12}
          fontSize={10}
          fill={COLORS.centerSub}
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
    case 'day': return `${i}`;
    default: return '';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
});
