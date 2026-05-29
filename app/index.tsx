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
    return {
      kind: 'day',
      start: new Date(top.start_at),
      end: new Date(top.end_at),
      divisions: 8,
      label: top.title,
      subLabel: '奥行き',
    };
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
  const canvasSize = Math.min(screenWidth - 24, 380);

  const sliceTime =
    selectedSlice != null ? sliceToTimeRange(selectedSlice, range) : null;

  const onSlicePress = (i: number) => {
    setSelectedSlice(i);
    setEditingTask(null);
    setModalOpen(true);
  };

  const onTaskPress = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const onSubmitTask = async (payload: {
    title: string;
    notes: string | null;
    notification_minutes_before: number | null;
    recurrence_rule: string | null;
  }) => {
    if (!userId) return;
    try {
      if (editingTask) {
        await updateTask(editingTask.id, payload);
      } else if (sliceTime) {
        const parentId = drillStack.length
          ? drillStack[drillStack.length - 1].id
          : null;
        await createTask(userId, {
          ...payload,
          start_at: sliceTime.start,
          end_at: sliceTime.end,
          parent_id: parentId,
        });
      }
      setModalOpen(false);
      setEditingTask(null);
      setSelectedSlice(null);
      await loadTasks();
    } catch (err) {
      console.error('[onSubmitTask]', err);
    }
  };

  const onDeleteTask = async () => {
    if (!editingTask) return;
    try {
      await deleteTask(editingTask.id);
      setModalOpen(false);
      setEditingTask(null);
      await loadTasks();
    } catch (err) {
      console.error('[onDeleteTask]', err);
    }
  };

  const onDrillIn = () => {
    if (editingTask) {
      pushDrill(editingTask);
      setModalOpen(false);
      setEditingTask(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ZoomControls
        scaleKind={scaleKind}
        scaleLabel={range.label}
        scaleSubLabel={range.subLabel}
        breadcrumb={[
          range.kind === 'day' && drillStack.length === 0 ? '1日' : range.label,
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
        {loading ? (
          <ActivityIndicator style={styles.loader} color="#7F77DD" />
        ) : null}
      </View>

      <View style={styles.footer}>
        <Link href="/goals" asChild>
          <Pressable style={styles.footerBtn}>
            <Text style={styles.footerBtnText}>目標</Text>
          </Pressable>
        </Link>
        <Link href="/settings" asChild>
          <Pressable style={styles.footerBtn}>
            <Text style={styles.footerBtnText}>設定</Text>
          </Pressable>
        </Link>
      </View>

      <TaskFormModal
        visible={modalOpen}
        startAt={sliceTime?.start || (editingTask ? new Date(editingTask.start_at) : new Date())}
        endAt={sliceTime?.end || (editingTask ? new Date(editingTask.end_at) : new Date())}
        initialTitle={editingTask?.title || ''}
        initialNotes={editingTask?.notes || ''}
        initialNotificationMinutesBefore={editingTask?.notification_minutes_before ?? null}
        initialRecurrence={editingTask?.recurrence_rule ?? null}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
          setSelectedSlice(null);
        }}
        onSubmit={onSubmitTask}
        onDelete={editingTask ? onDeleteTask : undefined}
      />

      {editingTask ? (
        <Pressable style={styles.drillFab} onPress={onDrillIn}>
          <Text style={styles.drillFabText}>奥行きへ ↓</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  loader: { position: 'absolute', top: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#D3D1C7',
  },
  footerBtn: { paddingVertical: 8, paddingHorizontal: 24 },
  footerBtnText: { color: '#444441', fontSize: 14 },
  drillFab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    backgroundColor: '#7F77DD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  drillFabText: { color: '#FFF', fontWeight: '500' },
});
