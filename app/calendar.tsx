import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpaceBackground } from '../components/SpaceBackground';
import { useSessionStore, useViewStore } from '../lib/store';
import { fetchTasksInRange } from '../lib/tasks';
import type { Task } from '../lib/supabase';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const TASK_COLORS = ['#A78BFA','#34D399','#F472B6','#60A5FA','#FBBF24','#F87171'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

export default function CalendarPage() {
  const userId = useSessionStore(s => s.userId);
  const { setAnchor, setScale } = useViewStore();
  const [anchor, setAnchor] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const router = useRouter();
  const lastTap = useRef<{date: string, time: number}>({ date: '', time: 0 });

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const today = new Date();

  const load = useCallback(async () => {
    if (!userId) return;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    const ts = await fetchTasksInRange(userId, start, end, null);
    setTasks(ts);
  }, [userId, year, month]);

  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      const d = new Date(t.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  const selectedTasks = useMemo(() => {
    const key = `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`;
    return taskMap.get(key) ?? [];
  }, [selected, taskMap]);

  return (
    <View style={styles.root}>
      <SpaceBackground />
      <SafeAreaView style={styles.inner} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => { const d = new Date(anchor); d.setMonth(d.getMonth()-1); setAnchor(d); }} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{year}年 {MONTHS[month]}</Text>
          <Pressable onPress={() => { const d = new Date(anchor); d.setMonth(d.getMonth()+1); setAnchor(d); }} style={styles.navBtn}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        {/* Weekday row */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={w} style={[styles.weekday, i===0&&styles.sun, i===6&&styles.sat]}>{w}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {Array.from({length: days.length/7}, (_,w) => (
            <View key={w} style={styles.gridRow}>
              {days.slice(w*7, w*7+7).map((day, i) => {
                if (!day) return <View key={i} style={styles.cell} />;
                const isToday = sameDay(day, today);
                const isSel = sameDay(day, selected);
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                const dayTasks = taskMap.get(key) ?? [];
                return (
                  <Pressable key={i} style={styles.cell} onPress={() => {
                    const key = day.toDateString();
                    const now = Date.now();
                    if (lastTap.current.date === key && now - lastTap.current.time < 400) {
                      // Double tap → go to day view for this date
                      setAnchor(day);
                      setScale('day');
                      router.push('/');
                    } else {
                      lastTap.current = { date: key, time: now };
                      setSelected(day);
                    }
                  }}>
                    <View style={[styles.dayCircle, isToday && styles.todayCircle, isSel && !isToday && styles.selCircle]}>
                      <Text style={[styles.dayNum, i===0&&styles.sun, i===6&&styles.sat, (isToday||isSel)&&styles.selText]}>
                        {day.getDate()}
                      </Text>
                    </View>
                    {/* Task dots */}
                    <View style={styles.dots}>
                      {dayTasks.slice(0,3).map((_, j) => (
                        <View key={j} style={[styles.dot, {backgroundColor: TASK_COLORS[j % TASK_COLORS.length]}]} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Selected day tasks */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderText}>
            {selected.getMonth()+1}/{selected.getDate()}（{WEEKDAYS[selected.getDay()]}）
          </Text>
          {sameDay(selected, today) && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>今日</Text></View>}
        </View>

        <ScrollView style={styles.taskList} contentContainerStyle={{paddingBottom: 20}}>
          {selectedTasks.length === 0 ? (
            <Text style={styles.empty}>タスクなし</Text>
          ) : selectedTasks.map((t, i) => {
            const s = new Date(t.start_at), e = new Date(t.end_at);
            const sh = String(s.getHours()).padStart(2,'0'), sm = String(s.getMinutes()).padStart(2,'0');
            const eh = String(e.getHours()).padStart(2,'0'), em = String(e.getMinutes()).padStart(2,'0');
            const color = TASK_COLORS[i % TASK_COLORS.length];
            return (
              <View key={t.id} style={[styles.taskRow, {borderLeftColor: color}]}>
                <Text style={styles.taskTime}>{sh}:{sm} – {eh}:{em}</Text>
                <Text style={styles.taskTitle}>{t.title}</Text>
              </View>
            );
          })}
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 28, color: 'rgba(255,255,255,0.6)', fontWeight: '200' },
  monthLabel: { fontSize: 18, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  weekRow: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '300' },
  sun: { color: 'rgba(255,100,100,0.7)' },
  sat: { color: 'rgba(100,150,255,0.7)' },
  grid: { paddingHorizontal: 4 },
  gridRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: '#E8C56A' },
  selCircle: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  dayNum: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '300' },
  selText: { color: '#000', fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 },
  dayHeaderText: { fontSize: 15, fontWeight: '300', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
  todayBadge: { backgroundColor: 'rgba(232,197,106,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(232,197,106,0.4)' },
  todayBadgeText: { fontSize: 10, color: '#E8C56A', fontWeight: '500' },
  taskList: { flex: 1, paddingHorizontal: 16 },
  taskRow: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 10, marginBottom: 8, borderRadius: 4 },
  taskTime: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2, fontWeight: '300' },
  taskTitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '300' },
  empty: { color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
