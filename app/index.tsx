import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Link } from 'expo-router';
import { CircularCalendar } from '../components/CircularCalendar';

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



function DrillSwipeOverlay({ size, onSwipeLeft, onSwipeRight, onSwipeDown }: {
  size: number;
  onSwipeLeft: ()=>void;
  onSwipeRight: ()=>void;
  onSwipeDown: ()=>void;
}) {
  const start = React.useRef<{x:number,y:number}|null>(null);
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        backgroundColor: 'transparent',
        zIndex: 10,
      }}
      onTouchStart={(e) => {
        const t = e.nativeEvent.touches[0];
        start.current = { x: t.pageX, y: t.pageY };
      }}
      onTouchEnd={(e) => {
        if (!start.current) return;
        const t = e.nativeEvent.changedTouches[0];
        const dx = t.pageX - start.current.x;
        const dy = t.pageY - start.current.y;
        start.current = null;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        if (adx < 20 && ady < 20) return;
        if (adx > ady) {
          if (dx < 0) onSwipeLeft(); else onSwipeRight();
        } else if (dy > 40) {
          onSwipeDown();
        }
      }}
    />
  );
}

function SwipeView({ children, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }: {
  children: React.ReactNode;
  onSwipeLeft: ()=>void; onSwipeRight: ()=>void;
  onSwipeUp: ()=>void; onSwipeDown: ()=>void;
}) {
  const start = React.useRef<{x:number,y:number}|null>(null);
  const moved = React.useRef(false);
  return (
    <View
      style={{flex:1}}
      onTouchStart={(e)=>{
        const t = e.nativeEvent.touches[0];
        start.current = { x: t.pageX, y: t.pageY };
        moved.current = false;
      }}
      onTouchMove={()=>{ moved.current = true; }}
      onTouchEnd={(e)=>{
        if(!start.current) return;
        const t = e.nativeEvent.changedTouches[0];
        const dx = t.pageX - start.current.x;
        const dy = t.pageY - start.current.y;
        start.current = null;
        const adx=Math.abs(dx), ady=Math.abs(dy);
        if(adx<20&&ady<20) return;
        if(adx>ady) { if(dx<0) onSwipeLeft(); else onSwipeRight(); }
        else { if(dy<0) onSwipeUp(); else onSwipeDown(); }
      }}
    >
      {children}
    </View>
  );
}

export default function Home() {
  const userId = useSessionStore((s) => s.userId);
  const { scaleKind, anchorDate, drillStack, selectedSlice,
    setScale, setAnchor, pushDrill, popDrill, setSelectedSlice } = useViewStore();

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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [userId, drillStack, range.start, range.end]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // if (userId === null) return <Redirect href="/signin" />;  // DEV: disabled

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
        <SwipeView
          onSwipeLeft={() => {
            if (drillStack.length > 0) {
              const tasks2 = tasks.slice().sort((a,b)=>new Date(a.start_at).getTime()-new Date(b.start_at).getTime());
              const idx = tasks2.findIndex(t=>t.id===drillStack[drillStack.length-1].id);
              if (idx !== -1 && idx < tasks2.length-1) { popDrill(); setTimeout(()=>pushDrill(tasks2[idx+1]),30); }
            } else {
              const d=new Date(anchorDate); d.setDate(d.getDate()+1); setAnchor(d);
            }
          }}
          onSwipeRight={() => {
            if (drillStack.length > 0) {
              const tasks2 = tasks.slice().sort((a,b)=>new Date(a.start_at).getTime()-new Date(b.start_at).getTime());
              const idx = tasks2.findIndex(t=>t.id===drillStack[drillStack.length-1].id);
              if (idx > 0) { popDrill(); setTimeout(()=>pushDrill(tasks2[idx-1]),30); }
            } else {
              const d=new Date(anchorDate); d.setDate(d.getDate()-1); setAnchor(d);
            }
          }}
          onSwipeUp={() => {
            if (drillStack.length === 0 && scaleKind === 'day' && tasks.length > 0) {
              const nowMs = Date.now();
              const nearest = tasks.reduce((b,t)=>{
                const mid=(new Date(t.start_at).getTime()+new Date(t.end_at).getTime())/2;
                const bMid=(new Date(b.start_at).getTime()+new Date(b.end_at).getTime())/2;
                return Math.abs(mid-nowMs)<Math.abs(bMid-nowMs)?t:b;
              });
              pushDrill(nearest);
            } else if (drillStack.length === 0) {
              const next=zoomIn(scaleKind); if(next) setScale(next);
            }
          }}
          onSwipeDown={() => {
            if (drillStack.length > 0) popDrill();
            else { const prev=zoomOut(scaleKind); if(prev) setScale(prev); }
          }}
        >
        <View style={styles.canvas}>
          <CircularCalendar
              size={canvasSize}
              range={range}
              tasks={tasks}
              selectedSlice={selectedSlice}
              onSlicePress={(i) => { setSelectedSlice(i); setEditingTask(null); setModalOpen(true); }}
              onTaskPress={(t) => { setSelectedSlice(null); setEditingTask(t); setModalOpen(true); }}
            />
          {/* Swipe overlay for drill mode — covers canvas to capture swipes */}
          {drillStack.length > 0 && (() => {
            const sortedTasks = [...tasks].sort((a,b)=>new Date(a.start_at).getTime()-new Date(b.start_at).getTime());
            const curId = drillStack[drillStack.length-1].id;
            const idx = sortedTasks.findIndex(t=>t.id===curId);
            return (
              <DrillSwipeOverlay
                size={canvasSize}
                onSwipeLeft={() => {
                  if (idx < sortedTasks.length-1) { popDrill(); setTimeout(()=>pushDrill(sortedTasks[idx+1]),40); }
                }}
                onSwipeRight={() => {
                  if (idx > 0) { popDrill(); setTimeout(()=>pushDrill(sortedTasks[idx-1]),40); }
                }}
                onSwipeDown={() => popDrill()}
              />
            );
          })()}
          {loading && <ActivityIndicator style={StyleSheet.absoluteFillObject} color="#E8C56A" />}
        </View>
        </SwipeView>

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
