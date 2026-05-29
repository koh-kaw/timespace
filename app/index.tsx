import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Link } from 'expo-router';
import { CircularCalendar } from '../components/CircularCalendar';
import { TaskFormModal } from '../components/TaskFormModal';
import { ZoomControls } from '../components/ZoomControls';
import {
  getScaleRange,
  sliceToTimeRange,
  zoomIn,
  zoomOut,
  drillRangeFromTask,
  type ScaleRange,
} from '../lib/time';
import { useSessionStore, useViewStore } from '../lib/store';
import { fetchTasksInRange, fetchChildTasks, createTask, deleteTask, updateTask } from '../lib/tasks';
import type { Task } from '../lib/supabase';

export default function Home() {
  const userId = useSessionStore((s) => s.userId);
  const {
    scaleKind,
    anchorDate,
    drillStack,
    selectedSlice,
    setScale,
    pushDrill,
    popDrill,
    setSelectedSlice,
  } = useViewStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const range: ScaleRange = useMemo(() => {
    if (drillStack.length === 0) return getScaleRange(scaleKind, anchorDate);
    const top = drillStack[drillStack.length - 1];
    return drillRangeFromTask(
      new Date(top.start_at),
      new Date(top.end_at),
      top.title,
    );
  }, [scaleKind, anchorDate, drillStack]);

  const loadTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (drillStack.length === 0) {
        const data = await fetchTasksInRange(userId, range.start, range.end, null);
        setTasks(data);
      } else {
        const parent = drillStack[drillStack.length - 1];
        const data = await fetchChildTasks(parent.id);
        setTasks(data);
      }
    } catch (err) {
      console.error('[loadTasks]', err);
    } finally {
      setLoading(false);
    }
  }, [userId, drillStack, range.start, range.end]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (userId === null) {
    return <Redirect href="/signin" />;
  }

  const screenWidth = Dimensions.get('window').width;
  const canvasSize = Math.min(screenWidth - 16, 400);

  const sliceTime =
    selectedSlice != null ? sliceToTimeRange(selectedSlice, range) : null;

  const closeModal = () => {
    setModalOpen(false);
    setEditingTask(null);
    setSelectedSlice(null);
  };

  const onSlicePress = (i: number) => {
    setSelectedSlice(i);
    setEditingTask(null);
    setModalOpen(true);
  };

  const onTaskPress = (task: Task) => {
    setSelectedSlice(null);
    setEditingTask(task);
    setModalOpen(true);
  };

  const onSubmitTask = async (payload: {
    title: string;
    notes: string | null;
    notification_minutes_before: number | null;
    recurrence_rule: string | null;
    start_at: Date;
    end_at: Date;
  }) => {
    if (!userId) return;
    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          title: payload.title,
          notes: payload.notes,
          notification_minutes_before: payload.notification_minutes_before,
          recurrence_rule: payload.recurrence_rule,
          start_at: payload.start_at,
          end_at: payload.end_at,
        });
      } else {
        const parentId = drillStack.length
          ? drillStack[drillStack.length - 1].id
          : null;
        await createTask(userId, {
          title: payload.title,
          notes: payload.notes,
          notification_minutes_before: payload.notification_minutes_before,
          recurrence_rule: payload.recurrence_rule,
          start_at: payload.start_at,
          end_at: payload.end_at,
          parent_id: parentId,
        });
      }
      closeModal();
      await loadTasks();
    } catch (err) {
      console.error('[onSubmitTask]', err);
    }
  };

  const onDeleteTask = async () => {
    if (!editingTask) return;
    try {
      await deleteTask(editingTask.id);
      closeModal();
      await loadTasks();
    } catch (err) {
      console.error('[onDeleteTask]', err);
    }
  };

  const onDrillIn = () => {
    if (!editingTask) return;
    pushDrill(editingTask);
    closeModal();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ZoomControls
        scaleKind={scaleKind}
        scaleLabel={range.label}
        scaleSubLabel={range.subLabel}
        breadcrumb={[
          drillStack.length === 0 ? range.label : range.label,
          ...drillStack.map((t) => t.title),
        ]}
        canZoomUp={!!zoomOut(scaleKind) || drillStack.length > 0}
        canZoomDown={!!zoomIn(scaleKind) && drillStack.length === 0}
        onZoomUp={() => {
          if (drillStack.length) popDrill();
          else {
            const next = zoomOut(scaleKind);
            if (next) setScale(next);
          }
        }}
        onZoomDown={() => {
          const next = zoomIn(scaleKind);
          if (next) setScale(next);
        }}
      />

      <View style={styles.canvas}>
        <CircularCalendar
          size={canvasSize}
          range={range}
          tasks={tasks}
          selectedSlice={selectedSlice}
          onSlicePress={onSlicePress}
          onTaskPress={onTaskPress}
        />
        {loading && (
          <ActivityIndicator style={StyleSheet.absoluteFillObject} color="#7F77DD" />
        )}
      </View>

      <View style={styles.footer}>
        <Link href="/goals" asChild>
          <Pressable style={styles.footerBtn}>
            <Text style={styles.footerBtnText}>🎯 目標</Text>
          </Pressable>
        </Link>
        <Link href="/settings" asChild>
          <Pressable style={styles.footerBtn}>
            <Text style={styles.footerBtnText}>⚙ 設定</Text>
          </Pressable>
        </Link>
      </View>

      <TaskFormModal
        visible={modalOpen}
        startAt={
          sliceTime?.start ?? (editingTask ? new Date(editingTask.start_at) : new Date())
        }
        endAt={
          sliceTime?.end ?? (editingTask ? new Date(editingTask.end_at) : new Date())
        }
        initialTitle={editingTask?.title ?? ''}
        initialNotes={editingTask?.notes ?? ''}
        initialNotificationMinutesBefore={editingTask?.notification_minutes_before ?? null}
        initialRecurrence={editingTask?.recurrence_rule ?? null}
        isEditing={!!editingTask}
        onClose={closeModal}
        onSubmit={onSubmitTask}
        onDelete={editingTask ? onDeleteTask : undefined}
        onDrillIn={editingTask ? onDrillIn : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E2E0D8',
    backgroundColor: '#FFFFFF',
  },
  footerBtn: { paddingVertical: 8, paddingHorizontal: 24 },
  footerBtnText: { color: '#444441', fontSize: 14 },
});
