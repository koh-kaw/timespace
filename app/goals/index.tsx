import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSessionStore } from '../../lib/store';
import { buildGoalTree, createGoal, deleteGoal, fetchGoalTree, type GoalNode } from '../../lib/goals';

export default function Goals() {
  const userId = useSessionStore((s) => s.userId);
  const [tree, setTree] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const flat = await fetchGoalTree(userId);
      setTree(buildGoalTree(flat));
    } catch (err: any) {
      Alert.alert('エラー', err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.intro}>
        <Text style={styles.introTitle}>未来から逆算するロードマップ</Text>
        <Text style={styles.introBody}>
          大きな目標を小さな具体的なアクションへ分解します。各ゴールは子ゴールを持てます。
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#7F77DD" style={{ marginTop: 20 }} />
      ) : tree.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>目標がありません</Text>
          <Pressable onPress={() => setAdding({ parentId: null })} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>+ 最初の目標を作る</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {tree.map((g) => (
            <GoalRow
              key={g.id}
              node={g}
              level={0}
              onAddChild={(parentId) => setAdding({ parentId })}
              onDelete={async (id) => {
                await deleteGoal(id);
                load();
              }}
            />
          ))}
          <Pressable onPress={() => setAdding({ parentId: null })} style={styles.addRow}>
            <Text style={styles.addRowText}>+ 新しい目標</Text>
          </Pressable>
        </ScrollView>
      )}

      <GoalAddModal
        visible={!!adding}
        parentId={adding?.parentId ?? null}
        onClose={() => setAdding(null)}
        onSubmit={async (input) => {
          if (!userId) return;
          await createGoal(userId, input);
          setAdding(null);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function GoalRow({
  node,
  level,
  onAddChild,
  onDelete,
}: {
  node: GoalNode;
  level: number;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View>
      <View style={[styles.row, { marginLeft: level * 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{node.title}</Text>
          {node.target_value != null ? (
            <Text style={styles.rowMeta}>
              {node.current_value} / {node.target_value} {node.unit || ''}
              {node.target_date ? `  期限: ${node.target_date}` : ''}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => onAddChild(node.id)} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>+</Text>
        </Pressable>
        <Pressable onPress={() => onDelete(node.id)} style={styles.iconBtn}>
          <Text style={[styles.iconBtnText, { color: '#A32D2D' }]}>×</Text>
        </Pressable>
      </View>
      {node.children.map((c) => (
        <GoalRow key={c.id} node={c} level={level + 1} onAddChild={onAddChild} onDelete={onDelete} />
      ))}
    </View>
  );
}

function GoalAddModal({
  visible,
  parentId,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  parentId: string | null;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    parent_id: string | null;
    target_value: number | null;
    unit: string | null;
    target_date: Date | null;
    strategy_type: 'savings' | 'habit' | 'skill' | 'revenue' | 'custom';
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [strategy, setStrategy] = useState<'savings' | 'habit' | 'skill' | 'revenue' | 'custom'>('custom');

  useEffect(() => {
    if (visible) {
      setTitle('');
      setTarget('');
      setUnit('');
      setDateStr('');
      setStrategy('custom');
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{parentId ? 'サブ目標を追加' : '新しい目標'}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="例: 40歳までに1億円貯金"
            style={styles.input}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={target}
              onChangeText={setTarget}
              placeholder="目標数値 (例: 100000000)"
              keyboardType="numeric"
              style={[styles.input, { flex: 2 }]}
            />
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="単位"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <TextInput
            value={dateStr}
            onChangeText={setDateStr}
            placeholder="期限 (YYYY-MM-DD)"
            style={styles.input}
          />
          <View style={styles.chips}>
            {(['savings', 'habit', 'skill', 'revenue', 'custom'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setStrategy(s)}
                style={[styles.chip, strategy === s && styles.chipSelected]}
              >
                <Text style={[styles.chipText, strategy === s && styles.chipTextSelected]}>
                  {strategyLabel(s)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, styles.btnSecondary]}>
              <Text style={styles.btnSecondaryText}>キャンセル</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!title.trim()) return;
                onSubmit({
                  title: title.trim(),
                  parent_id: parentId,
                  target_value: target ? Number(target) : null,
                  unit: unit.trim() || null,
                  target_date: dateStr ? new Date(dateStr) : null,
                  strategy_type: strategy,
                });
              }}
              style={[styles.btn, styles.btnPrimary]}
            >
              <Text style={styles.btnPrimaryText}>保存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function strategyLabel(s: string): string {
  return (
    {
      savings: '貯金',
      habit: '習慣',
      skill: 'スキル',
      revenue: '売上',
      custom: 'その他',
    } as Record<string, string>
  )[s];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  intro: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#D3D1C7' },
  introTitle: { fontSize: 15, fontWeight: '500', color: '#2C2C2A' },
  introBody: { fontSize: 12, color: '#888780', marginTop: 4 },
  list: { padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1EFE8',
    marginBottom: 6,
  },
  rowTitle: { fontSize: 14, color: '#2C2C2A' },
  rowMeta: { fontSize: 11, color: '#888780', marginTop: 2 },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  iconBtnText: { fontSize: 18, color: '#7F77DD' },
  addRow: { padding: 12, alignItems: 'center', marginTop: 8 },
  addRowText: { color: '#7F77DD', fontSize: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: '#888780', marginBottom: 16 },
  primaryBtn: { backgroundColor: '#7F77DD', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  primaryBtnText: { color: '#FFF', fontWeight: '500' },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetTitle: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  input: {
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  chipSelected: { backgroundColor: '#CECBF6', borderColor: '#7F77DD' },
  chipText: { fontSize: 13, color: '#5F5E5A' },
  chipTextSelected: { color: '#26215C', fontWeight: '500' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnPrimary: { backgroundColor: '#7F77DD' },
  btnPrimaryText: { color: '#FFF', fontWeight: '500' },
  btnSecondary: { backgroundColor: '#F1EFE8' },
  btnSecondaryText: { color: '#444441' },
});
