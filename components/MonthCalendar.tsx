import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Task } from '../lib/supabase';

type Props = {
  anchor: Date;
  tasks: Task[];
  onDayPress: (date: Date) => void;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function MonthCalendar({ anchor, tasks, onDayPress }: Props) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const today = new Date();

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = first.getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // Task dates set
  const taskDates = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      const d = new Date(t.start_at);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [tasks]);

  return (
    <View style={styles.wrap}>
      {/* Weekday headers */}
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <Text key={d} style={[styles.weekday, i === 0 && styles.sun, i === 6 && styles.sat]}>{d}</Text>
        ))}
      </View>

      {/* Days grid */}
      {Array.from({ length: days.length / 7 }, (_, w) => (
        <View key={w} style={styles.row}>
          {days.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const isToday = day.getDate() === today.getDate() &&
              day.getMonth() === today.getMonth() &&
              day.getFullYear() === today.getFullYear();
            const hasTask = taskDates.has(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`);
            const isSun = i === 0, isSat = i === 6;
            return (
              <Pressable key={i} style={styles.cell} onPress={() => onDayPress(day)}>
                <View style={[styles.dayCircle, isToday && styles.todayCircle]}>
                  <Text style={[
                    styles.dayText,
                    isSun && styles.sun,
                    isSat && styles.sat,
                    isToday && styles.todayText,
                  ]}>
                    {day.getDate()}
                  </Text>
                </View>
                {hasTask && <View style={styles.dot} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8 },
  row: { flexDirection: 'row', marginBottom: 2 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', paddingBottom: 6, fontWeight: '300' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: '#E8C56A' },
  dayText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '300' },
  todayText: { color: '#000', fontWeight: '600' },
  sun: { color: 'rgba(255,100,100,0.7)' },
  sat: { color: 'rgba(100,150,255,0.7)' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#E8C56A', marginTop: 2 },
});
