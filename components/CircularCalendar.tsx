import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, G } from 'react-native-svg';
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

const PADDING = 20;

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
  const rInner = rOuter * 0.28;

  const slices = useMemo(() => {
    const result: { index: number; d: string; midAngle: number; label: string }[] = [];
    const labelEveryNth = range.divisions > 24 ? Math.ceil(range.divisions / 12) : 1;
    for (let i = 0; i < range.divisions; i++) {
      const a1 = (i / range.divisions) * 2 * Math.PI - Math.PI / 2;
      const a2 = ((i + 1) / range.divisions) * 2 * Math.PI - Math.PI / 2;
      const showLabel = i % labelEveryNth === 0;
      result.push({
        index: i,
        d: arcPath(cx, cy, rOuter, rInner, a1, a2),
        midAngle: (a1 + a2) / 2,
        label: showLabel ? labelForSlice(range, i) : '',
      });
    }
    return result;
  }, [range, cx, cy, rOuter, rInner]);

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
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tasks, range, cx, cy, rOuter, rInner]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={rOuter} fill="#F1EFE8" />

        <G>
          {slices.map((s) => (
            <Path
              key={`slice-${s.index}`}
              d={s.d}
              fill={selectedSlice === s.index ? '#CECBF6' : '#FFFFFF'}
              stroke="#D3D1C7"
              strokeWidth={0.5}
              onPress={() => onSlicePress(s.index)}
            />
          ))}
        </G>

        <G>
          {taskArcs.map((t) => (
            <G key={`task-${t.task.id}`}>
              <Path
                d={t.d}
                fill={t.task.color || '#7F77DD'}
                fillOpacity={0.55}
                stroke={t.task.color || '#7F77DD'}
                strokeWidth={1}
                onPress={() => onTaskPress(t.task)}
              />
              <SvgText
                x={t.labelX}
                y={t.labelY + 3}
                fontSize={10}
                fontWeight="500"
                fill="#26215C"
                textAnchor="middle"
                pointerEvents="none"
              >
                {truncate(t.task.title, 6)}
              </SvgText>
            </G>
          ))}
        </G>

        <G>
          {slices.map((s) => {
            if (!s.label) return null;
            const lr = rOuter + 10;
            const lx = cx + lr * Math.cos(s.midAngle);
            const ly = cy + lr * Math.sin(s.midAngle);
            return (
              <SvgText
                key={`lbl-${s.index}`}
                x={lx}
                y={ly + 3}
                fontSize={9}
                fill="#5F5E5A"
                textAnchor="middle"
              >
                {s.label}
              </SvgText>
            );
          })}
        </G>

        <Circle cx={cx} cy={cy} r={rInner} fill="#FFFFFF" stroke="#D3D1C7" strokeWidth={0.5} />
        <SvgText x={cx} y={cy - 2} fontSize={11} fill="#5F5E5A" textAnchor="middle">
          {range.label}
        </SvgText>
        <SvgText x={cx} y={cy + 12} fontSize={9} fill="#888780" textAnchor="middle">
          {range.subLabel}
        </SvgText>
      </Svg>
    </View>
  );
}

function labelForSlice(range: ScaleRange, i: number): string {
  switch (range.kind) {
    case 'decade':
      return `${range.start.getFullYear() + i}`;
    case 'year':
      return `${i + 1}月`;
    case 'month':
      return `${i + 1}`;
    case 'week':
      return ['月', '火', '水', '木', '金', '土', '日'][i];
    case 'day':
      return `${i}`;
    default:
      return '';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
});
