import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Link } from 'expo-router';
import { CircularCalendar } from '../components/CircularCalendar';
import { MonthCalendar } from '../components/MonthCalendar';
import { TaskFormModal } from '../components/TaskFormModal';
import { SpaceBackground } from '../components/SpaceBackground';
import { getScaleRange, sliceToTimeRange, zoomIn, zoomOut, drillRangeFromTask, type ScaleRange } from '../lib/time';
import { useSessionStore, useViewStore } from '../lib/store';
import { fetchTasksInRange, fetchChildTasks, createTask, deleteTask, updateTask } from '../lib/tasks';
import type { Task } from '../lib/supabase';
import { SCALE_ORDER } from '../lib/time';

function CurrentTime() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return (
    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '200', letterSpacing: 2, fontVariant: ['tabular-nums'] }}>
      {h}:{m}:{s}
    </Text>
  );
}

function shiftAnchor(anchor: Date, kind: string, direction: number): Date {
  const d = new Date(anchor);
  switch(kind) {
    case 'day':   d.setDate(d.getDate() + direction); break;
    case 'week':  d.setDate(d.getDate() + direction * 7); break;
    case 'month': d.setMonth(d.getMonth() + direction); break;
    case 'year':  d.setFullYear(d.getFullYear() + direction); break;
    case 'decade':d.setFullYear(d.getFullYear() + direction * 10); break;
  }
  return d;
}

export default function Home() {
  const userId = useSessionStore((s) => s.userId);
  const { scaleKind, anchorDate, drillStack, selectedSlice,
    setScale, setAnchor, pushDrill, popDrill, setSelectedSlice } = useViewStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const swipeRef = React.useRef({ x0: 0, y0: 0 });
  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
    onPanResponderGrant: (_, g) => { swipeRef.current = { x0: g.x0, y0: g.y0 }; },
    onPanResponderRelease: (_, g) => {
      const dx = g.dx, dy = g.dy;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < 20 && ady < 20) return; // too small

      if (adx > ady) {
        // horizontal: prev/next day (or week/month)
        if (drillStack.length === 0) {
          setAnchor(shiftAnchor(anchorDate, scaleKind, dx < 0 ? 1 : -1));
        }
      } else {
        // vertical swipe
        if (dy < -40) {
          // swipe up → zoom in
          if (drillStack.length === 0) {
            const next = zoomIn(scaleKind);
            if (next) setScale(next);
          }
        } else if (dy > 40) {
          // swipe down
          if (drillStack.length > 0) {
            // in drill: go back up
            popDrill();
          } else if (scaleKind === 'day' && tasks.length > 0) {
            // day view: drill into nearest task to now
            const nowMs = Date.now();
            const nearest = tasks.reduce((best, t) => {
              const mid = (new Date(t.start_at).getTime() + new Date(t.end_at).getTime()) / 2;
              const bestMid = (new Date(best.start_at).getTime() + new Date(best.end_at).getTime()) / 2;
              return Math.abs(mid - nowMs) < Math.abs(bestMid - nowMs) ? t : best;
            });
            pushDrill(nearest);
          } else {
            const prev = zoomOut(scaleKind);
            if (prev) setScale(prev);
          }
        }
      }
    },
  }), [anchorDate, scaleKind, drillStack]);

  const range: ScaleRange = useMemo(() => {
    if (drillStack.length === 0) return getScaleRange(scaleKind, anchorDate);
    const top = drillStack[drillStack.length - 1];
    return drillRangeFromTask(new Date(top.start_at), new Date(top.end_at), top.title);
  }, [scaleKind, anchorDate, drillStack]);

  const loadTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (drillStack.length === 0) {
        setTasks(await fetchTasksInRange(userId, range.start, range.end, null));
      } else {
        setTasks(await fetchChildTasks(drillStack[drillStack.length - 1].id));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [userId, drillStack, range.start, range.end]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (userId === null) return <Redirect href="/signin" />;

  const W = Dimensions.get('window').width;
  const canvasSize = Math.min(W, 420);
  const sliceTime = selectedSlice != null ? sliceToTimeRange(selectedSlice, range) : null;
  const closeModal = () => { setModalOpen(false); setEditingTask(null); setSelectedSlice(null); };

  const canUp = !!zoomOut(scaleKind) || drillStack.length > 0;
  const canDown = !!zoomIn(scaleKind) && drillStack.length === 0;

  return (
    <View style={styles.root}>
      <SpaceBackground />
      <SafeAreaView style={styles.inner} edges={['top', 'bottom']}>

        {/* ── Zoom bar ── */}
        <View style={styles.zbar}>
          <Pressable
            onPress={() => {
              if (drillStack.length) popDrill();
              else { const n = zoomOut(scaleKind); if (n) setScale(n); }
            }}
            style={[styles.zbtn, !canUp && styles.zbtnOff]}
            disabled={!canUp}
          >
            <Text style={styles.zbtnTxt}>↑ 上へ</Text>
          </Pressable>

          <View style={styles.zcenter}>
            <Text style={styles.zlabel}>{range.label}</Text>
            <Text style={styles.zsub}>{range.subLabel}</Text>
            {drillStack.length > 0 && (
              <Text style={styles.zbreadcrumb}>
                {[getScaleRange(scaleKind, anchorDate).label, ...drillStack.map(t => t.title)].join(' › ')}
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => { const n = zoomIn(scaleKind); if (n) setScale(n); }}
            style={[styles.zbtn, !canDown && styles.zbtnOff]}
            disabled={!canDown}
          >
            <Text style={styles.zbtnTxt}>下へ ↓</Text>
          </Pressable>
        </View>

        {/* ── Legend + current time ── */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#E8C56A' }]} />
            <Text style={styles.legendText}>経過</Text>
          </View>
          <CurrentTime />
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#5A9BE8' }]} />
            <Text style={styles.legendText}>残り</Text>
          </View>
        </View>

        {/* ── Calendar ── */}
        <View style={styles.canvas} {...panResponder.panHandlers}>
          {(scaleKind === 'month' || scaleKind === 'year' || scaleKind === 'decade') && drillStack.length === 0 ? (
            <MonthCalendar
              anchor={anchorDate}
              tasks={tasks}
              onDayPress={(date) => {
                setAnchor(date);
                setScale('day');
              }}
            />
          ) : (
            <CircularCalendar
              size={canvasSize}
              range={range}
              tasks={tasks}
              selectedSlice={selectedSlice}
              onSlicePress={(i) => { setSelectedSlice(i); setEditingTask(null); setModalOpen(true); }}
              onTaskPress={(t) => { setSelectedSlice(null); setEditingTask(t); setModalOpen(true); }}
            />
          )}
          {loading && <ActivityIndicator style={StyleSheet.absoluteFillObject} color="#E8C56A" />}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Link href="/goals" asChild>
            <Pressable style={styles.fbtn}>
              <Text style={styles.ficon}>🎯</Text>
              <Text style={styles.flbl}>目標</Text>
            </Pressable>
          </Link>
          <Link href="/calendar" asChild>
            <Pressable style={styles.fbtn}>
              <Text style={styles.ficon}>📅</Text>
              <Text style={styles.flbl}>カレンダー</Text>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable style={styles.fbtn}>
              <Text style={styles.ficon}>⚙</Text>
              <Text style={styles.flbl}>設定</Text>
            </Pressable>
          </Link>
        </View>

        <TaskFormModal
          visible={modalOpen}
          startAt={sliceTime?.start ?? (editingTask ? new Date(editingTask.start_at) : new Date())}
          endAt={sliceTime?.end ?? (editingTask ? new Date(editingTask.end_at) : new Date())}
          parentStart={drillStack.length > 0 ? new Date(drillStack[drillStack.length-1].start_at) : undefined}
          parentEnd={drillStack.length > 0 ? new Date(drillStack[drillStack.length-1].end_at) : undefined}
          initialTitle={editingTask?.title ?? ''}
          initialNotes={editingTask?.notes ?? ''}
          initialNotificationMinutesBefore={editingTask?.notification_minutes_before ?? null}
          initialRecurrence={editingTask?.recurrence_rule ?? null}
          isEditing={!!editingTask}
          onClose={closeModal}
          onSubmit={async (payload) => {
            if (!userId) return;
            try {
              if (editingTask) {
                await updateTask(editingTask.id, payload);
              } else {
                await createTask(userId, {
                  ...payload,
                  parent_id: drillStack.length ? drillStack[drillStack.length - 1].id : null,
                });
              }
              closeModal();
              await loadTasks();
            } catch (err) { console.error(err); }
          }}
          onDelete={editingTask ? async () => {
            try { await deleteTask(editingTask.id); closeModal(); await loadTasks(); }
            catch (err) { console.error(err); }
          } : undefined}
          onDrillIn={editingTask ? () => { pushDrill(editingTask); closeModal(); } : undefined}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  inner: { flex: 1 },

  zbar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  zbtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  zbtnOff: { opacity: 0.3 },
  zbtnTxt: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '300', letterSpacing: 0.5 },
  zcenter: { alignItems: 'center' },
  zlabel: { fontSize: 18, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  zsub: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2, letterSpacing: 1 },
  zbreadcrumb: { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 3 },

  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '300', letterSpacing: 0.5 },

  footer: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 10, paddingBottom: 16,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,8,0.8)',
  },
  fbtn: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 32 },
  ficon: { fontSize: 20 },
  flbl: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3, letterSpacing: 1 },
});
