import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  FlatList, Animated, Dimensions, Platform,
  KeyboardAvoidingView, ScrollView, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpaceBackground } from '../components/SpaceBackground';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../lib/store';

const { width: SW } = Dimensions.get('window');
const GOLD = '#E8C56A';

type Priority = 'high' | 'medium' | 'low';
type Todo = {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  due_date: string | null;
  list_id: string | null;
  created_at: string;
};
type TodoList = { id: string; name: string; color: string };

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#F87171',
  medium: '#FBBF24',
  low: '#60A5FA',
};
const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高', medium: '中', low: '低',
};

const LIST_COLORS = ['#A78BFA','#34D399','#F472B6','#60A5FA','#FBBF24','#F87171','#E8C56A'];

// ─── Swipeable Todo Item ──────────────────────────────────────
function TodoItem({ todo, lists, onToggle, onDelete, onEdit }: {
  todo: Todo; lists: TodoList[];
  onToggle: () => void; onDelete: () => void; onEdit: () => void;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const touchStart = useRef<number | null>(null);

  const handleTouchStart = (e: any) => { touchStart.current = e.nativeEvent.pageX; };
  const handleTouchEnd = (e: any) => {
    if (touchStart.current === null) return;
    const dx = e.nativeEvent.pageX - touchStart.current;
    touchStart.current = null;
    if (dx < -60) {
      Animated.timing(tx, { toValue: -SW, duration: 200, useNativeDriver: true }).start(() => {
        tx.setValue(0); onDelete();
      });
    } else if (dx > 60) {
      Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      onEdit();
    } else {
      Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
    }
  };

  const list = lists.find(l => l.id === todo.list_id);
  const isOverdue = todo.due_date && !todo.done && new Date(todo.due_date) < new Date();

  return (
    <Animated.View style={{ transform: [{ translateX: tx }] }}>
      <View style={styles.deleteHint}><Text style={{ fontSize: 20 }}>🗑</Text></View>
      <View style={[styles.todoCard, todo.done && styles.todoCardDone]}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Priority bar */}
        <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLORS[todo.priority] }]} />

        <Pressable onPress={onToggle} style={styles.checkbox}>
          <View style={[styles.checkboxInner, todo.done && styles.checkboxDone]}>
            {todo.done && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[styles.todoTitle, todo.done && styles.todoTitleDone]} numberOfLines={2}>
            {todo.title}
          </Text>
          <View style={styles.todoMeta}>
            {list && (
              <View style={[styles.listTag, { backgroundColor: list.color + '33', borderColor: list.color + '66' }]}>
                <Text style={[styles.listTagText, { color: list.color }]}>{list.name}</Text>
              </View>
            )}
            {todo.due_date && (
              <Text style={[styles.dueDate, isOverdue && styles.dueDateOverdue]}>
                {isOverdue ? '⚠ ' : '📅 '}
                {new Date(todo.due_date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
              </Text>
            )}
            <Text style={styles.priorityLabel}>{PRIORITY_LABELS[todo.priority]}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Add/Edit modal ───────────────────────────────────────────
function TodoForm({ todo, lists, userId, onClose, onSaved }: {
  todo: Todo | null; lists: TodoList[]; userId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(todo?.title ?? '');
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 'medium');
  const [listId, setListId] = useState<string | null>(todo?.list_id ?? null);
  const [dueDate, setDueDate] = useState(todo?.due_date ? todo.due_date.slice(0, 10) : '');

  const save = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(), priority, list_id: listId,
      due_date: dueDate || null,
    };
    if (todo) {
      await supabase.from('todos').update(payload).eq('id', todo.id);
    } else {
      await supabase.from('todos').insert({ ...payload, user_id: userId, done: false });
    }
    onSaved();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.formOverlay}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={styles.formSheet}>
        <View style={styles.formHandle} />
        <Text style={styles.formTitle}>{todo ? 'TODOを編集' : 'TODOを追加'}</Text>

        <TextInput value={title} onChangeText={setTitle}
          placeholder="やること" placeholderTextColor="rgba(255,255,255,0.2)"
          style={styles.formInput} autoFocus={!todo} multiline />

        <Text style={styles.formLabel}>優先度</Text>
        <View style={styles.priorityRow}>
          {(['high','medium','low'] as Priority[]).map(p => (
            <Pressable key={p} onPress={() => setPriority(p)}
              style={[styles.priorityBtn, { borderColor: PRIORITY_COLORS[p] },
                priority === p && { backgroundColor: PRIORITY_COLORS[p] + '33' }]}>
              <Text style={[styles.priorityBtnText, { color: PRIORITY_COLORS[p] }]}>
                {PRIORITY_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        {lists.length > 0 && <>
          <Text style={styles.formLabel}>リスト</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            <Pressable onPress={() => setListId(null)}
              style={[styles.listChip, !listId && styles.listChipActive]}>
              <Text style={[styles.listChipText, !listId && { color: GOLD }]}>なし</Text>
            </Pressable>
            {lists.map(l => (
              <Pressable key={l.id} onPress={() => setListId(l.id)}
                style={[styles.listChip, listId === l.id && { backgroundColor: l.color + '33', borderColor: l.color }]}>
                <Text style={[styles.listChipText, listId === l.id && { color: l.color }]}>{l.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>}

        <Text style={styles.formLabel}>期限</Text>
        <DatePickerField value={dueDate} onChange={setDueDate} />

        <View style={styles.formActions}>
          <Pressable onPress={onClose} style={styles.formCancelBtn}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>キャンセル</Text>
          </Pressable>
          <Pressable onPress={save} style={styles.formSaveBtn}>
            <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>保存</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function TodosPage() {
  const userId = useSessionStore(s => s.userId) ?? '';
  const [todos, setTodos] = useState<Todo[]>([]);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('active');
  const [listFilter, setListFilter] = useState<string | null | 'all'>('all');
  const [editing, setEditing] = useState<Todo | null | 'new'>(null);
  const [showListManager, setShowListManager] = useState(false);
  const [newListName, setNewListName] = useState('');

  const load = useCallback(async () => {
    const [{ data: td }, { data: ls }] = await Promise.all([
      supabase.from('todos').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('todo_lists').select('*').eq('user_id', userId).order('created_at'),
    ]);
    if (td) setTodos(td as Todo[]);
    if (ls) setLists(ls as TodoList[]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (todo: Todo) => {
    await supabase.from('todos').update({ done: !todo.done }).eq('id', todo.id);
    load();
  };
  const deleteTodo = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id);
    load();
  };
  const addList = async () => {
    if (!newListName.trim()) return;
    const color = LIST_COLORS[lists.length % LIST_COLORS.length];
    await supabase.from('todo_lists').insert({ user_id: userId, name: newListName.trim(), color });
    setNewListName(''); load();
  };
  const deleteList = async (id: string) => {
    await supabase.from('todo_lists').delete().eq('id', id);
    load();
  };

  const filtered = todos.filter(t => {
    if (filter === 'active' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    if (listFilter !== 'all') {
      if (listFilter === null && t.list_id !== null) return false;
      if (listFilter !== null && t.list_id !== listFilter) return false;
    }
    return true;
  }).sort((a, b) => {
    // Sort: undone first, then by priority, then by due date
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pOrder = { high: 0, medium: 1, low: 2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const doneCount = todos.filter(t => t.done).length;
  const progress = todos.length > 0 ? doneCount / todos.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SpaceBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>TODO</Text>
            <Text style={styles.headerSub}>{doneCount}/{todos.length} 完了</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setShowListManager(v => !v)} style={styles.iconBtn}>
              <Text style={{ fontSize: 16 }}>📋</Text>
            </Pressable>
            <Pressable onPress={() => setEditing('new')} style={styles.iconBtn}>
              <Text style={{ fontSize: 20, color: GOLD, lineHeight: 22 }}>＋</Text>
            </Pressable>
          </View>
        </View>

        {/* Progress bar */}
        {todos.length > 0 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {(['all','active','done'] as const).map(f => (
            <Pressable key={f} onPress={() => setFilter(f)}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}>
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f === 'all' ? 'すべて' : f === 'active' ? '未完了' : '完了'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* List filter */}
        {lists.length > 0 && (
          <ScrollView horizontal style={{ maxHeight: 36 }}
            contentContainerStyle={styles.listFilterRow} showsHorizontalScrollIndicator={false}>
            {[{ id: 'all', name: 'すべて', color: GOLD }, ...lists].map(l => (
              <Pressable key={String(l.id)} onPress={() => setListFilter(l.id as any)}
                style={[styles.listFilterTab, listFilter === l.id && { backgroundColor: l.color + '22', borderColor: l.color }]}>
                <Text style={[styles.listFilterText, listFilter === l.id && { color: l.color }]}>
                  {l.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* List manager */}
        {showListManager && (
          <View style={styles.listManager}>
            <View style={styles.listManagerInput}>
              <TextInput value={newListName} onChangeText={setNewListName}
                placeholder="新しいリスト名" placeholderTextColor="rgba(255,255,255,0.2)"
                style={styles.listInput} />
              <Pressable onPress={addList} style={styles.listAddBtn}>
                <Text style={{ color: '#000', fontWeight: '600', fontSize: 12 }}>追加</Text>
              </Pressable>
            </View>
            {lists.map(l => (
              <View key={l.id} style={styles.listRow}>
                <View style={[styles.listDot, { backgroundColor: l.color }]} />
                <Text style={styles.listRowName}>{l.name}</Text>
                <Pressable onPress={() => deleteList(l.id)}>
                  <Text style={{ color: '#FF6B6B', fontSize: 16 }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Todo list */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>✅</Text>
            <Text style={styles.emptyText}>
              {filter === 'done' ? 'まだ完了したTODOがありません' :
               filter === 'active' ? 'TODOがありません！' : 'TODOを追加しましょう'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={t => t.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item }) => (
              <TodoItem
                todo={item} lists={lists}
                onToggle={() => toggle(item)}
                onDelete={() => deleteTodo(item.id)}
                onEdit={() => setEditing(item)}
              />
            )}
          />
        )}

        {/* Add/Edit form */}
        {editing !== null && (
          <TodoForm
            todo={editing === 'new' ? null : editing}
            lists={lists} userId={userId}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 22, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center' },

  progressWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 8, gap: 10 },
  progressBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GOLD, borderRadius: 2 },
  progressText: { fontSize: 11, color: GOLD, fontWeight: '500', width: 32, textAlign: 'right' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, paddingBottom: 6 },
  filterTab: { flex: 1, paddingVertical: 6, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  filterTabActive: { backgroundColor: 'rgba(232,197,106,0.15)', borderColor: 'rgba(232,197,106,0.5)' },
  filterTabText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '300' },
  filterTabTextActive: { color: GOLD, fontWeight: '500' },

  listFilterRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 6 },
  listFilterTab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  listFilterText: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  listManager: { marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  listManagerInput: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  listInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: '#fff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  listAddBtn: { backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  listDot: { width: 8, height: 8, borderRadius: 4 },
  listRowName: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  deleteHint: { position: 'absolute', right: 16, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center' },
  todoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  todoCardDone: { opacity: 0.5 },
  priorityBar: { width: 3, alignSelf: 'stretch' },
  checkbox: { padding: 14, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 16 },
  checkboxInner: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: GOLD, borderColor: GOLD },
  checkmark: { fontSize: 12, color: '#000', fontWeight: '700' },
  todoTitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 22,
    paddingTop: 12, paddingRight: 14, fontWeight: '300' },
  todoTitleDone: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.35)' },
  todoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10, paddingRight: 14, flexWrap: 'wrap', marginTop: 4 },
  listTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5 },
  listTagText: { fontSize: 10, fontWeight: '500' },
  dueDate: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  dueDateOverdue: { color: '#F87171' },
  priorityLabel: { fontSize: 10, color: 'rgba(255,255,255,0.25)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.3)', fontWeight: '300' },

  formOverlay: { position: 'absolute', inset: 0 as any, justifyContent: 'flex-end' },
  formSheet: { backgroundColor: '#0a0818', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
  formHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  formTitle: { fontSize: 18, fontWeight: '500', color: '#fff', marginBottom: 14 },
  formInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#fff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  formLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priorityBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    borderWidth: 1 },
  priorityBtnText: { fontSize: 13, fontWeight: '500' },
  listChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  listChipActive: { backgroundColor: 'rgba(232,197,106,0.15)', borderColor: 'rgba(232,197,106,0.5)' },
  listChipText: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  formCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  formSaveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    backgroundColor: GOLD },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)' },
  dateBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '300' },
  dateClearBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  datePickerSheet: { backgroundColor: '#0a0818', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, paddingBottom: 40,
    borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
});
