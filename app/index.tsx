import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Link } from 'expo-router';
import { CircularCalendar } from '../components/CircularCalendar';
import { TaskFormModal } from '../components/TaskFormModal';
import { ZoomControls } from '../components/ZoomControls';
import { SpaceBackground } from '../components/SpaceBackground';
import { getScaleRange, sliceToTimeRange, zoomIn, zoomOut, drillRangeFromTask, type ScaleRange } from '../lib/time';
import { useSessionStore, useViewStore } from '../lib/store';
import { fetchTasksInRange, fetchChildTasks, createTask, deleteTask, updateTask } from '../lib/tasks';
import type { Task } from '../lib/supabase';

export default function Home() {
  const userId = useSessionStore((s) => s.userId);
  const { scaleKind, anchorDate, drillStack, selectedSlice,
    setScale, pushDrill, popDrill, setSelectedSlice } = useViewStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
    } catch (err) { console.error('[loadTasks]', err); }
    finally { setLoading(false); }
  }, [userId, drillStack, range.start, range.end]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (userId === null) return <Redirect href="/signin" />;

  const screenWidth = Dimensions.get('window').width;
  const canvasSize = Math.min(screenWidth - 8, 420);
  const sliceTime = selectedSlice != null ? sliceToTimeRange(selectedSlice, range) : null;

  const closeModal = () => { setModalOpen(false); setEditingTask(null); setSelectedSlice(null); };

  return (
    <View style={styles.safe}>
      <SpaceBackground />
      <SafeAreaView style={styles.inner} edges={['top', 'bottom']}>
        <ZoomControls
          scaleKind={scaleKind}
          scaleLabel={range.label}
          scaleSubLabel={range.subLabel}
          breadcrumb={[range.label, ...drillStack.map((t) => t.title)]}
          canZoomUp={!!zoomOut(scaleKind) || drillStack.length > 0}
          canZoomDown={!!zoomIn(scaleKind) && drillStack.length === 0}
          onZoomUp={() => { if (drillStack.length) popDrill(); else { const n = zoomOut(scaleKind); if (n) setScale(n); } }}
          onZoomDown={() => { const n = zoomIn(scaleKind); if (n) setScale(n); }}
        />

        <View style={styles.canvas}>
          <CircularCalendar
            size={canvasSize} range={range} tasks={tasks}
            selectedSlice={selectedSlice}
            onSlicePress={(i) => { setSelectedSlice(i); setEditingTask(null); setModalOpen(true); }}
            onTaskPress={(t) => { setSelectedSlice(null); setEditingTask(t); setModalOpen(true); }}
          />
          {loading && <ActivityIndicator style={StyleSheet.absoluteFillObject} color="#8B7FFF" />}
        </View>

        <View style={styles.footer}>
          <Link href="/goals" asChild>
            <Pressable style={styles.footerBtn}>
              <Text style={styles.footerIcon}>🎯</Text>
              <Text style={styles.footerLabel}>目標</Text>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable style={styles.footerBtn}>
              <Text style={styles.footerIcon}>⚙</Text>
              <Text style={styles.footerLabel}>設定</Text>
            </Pressable>
          </Link>
        </View>

        <TaskFormModal
          visible={modalOpen}
          startAt={sliceTime?.start ?? (editingTask ? new Date(editingTask.start_at) : new Date())}
          endAt={sliceTime?.end ?? (editingTask ? new Date(editingTask.end_at) : new Date())}
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
  safe: { flex: 1, backgroundColor: '#080714' },
  inner: { flex: 1 },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(8,7,20,0.8)',
  },
  footerBtn: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 28 },
  footerIcon: { fontSize: 20 },
  footerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 },
});
