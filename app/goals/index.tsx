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
import {
  buildGoalTree,
  createGoal,
  deleteGoal,
  fetchGoalTree,
  updateGoal,
  type GoalNode,
} from '../../lib/goals';
import type { Goal } from '../../lib/supabase';

export default function Goals() {
  const userId = useSessionStore((s) => s.userId);
  const [tree, setTree] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null);
  const [decomposing, setDecomposing] = useState<GoalNode | null>(null);

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

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>未来から逆算するロードマップ</Text>
        <Text style={styles.headerSub}>
          大きな目標をAIが具体的なアクションへ自動分解します
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#7F77DD" style={{ marginTop: 40 }} />
      ) : tree.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyTitle}>目標がまだありません</Text>
          <Text style={styles.emptySub}>大きな夢から始めましょう</Text>
          <Pressable
            onPress={() => setAdding({ parentId: null })}
            style={styles.primaryBtn}
          >
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
              onDecompose={(node) => setDecomposing(node)}
              onDelete={async (id) => {
                Alert.alert('削除', 'この目標を削除しますか？', [
                  { text: 'キャンセル', style: 'cancel' },
                  {
                    text: '削除',
                    style: 'destructive',
                    onPress: async () => { await deleteGoal(id); load(); },
                  },
                ]);
              }}
            />
          ))}
          <Pressable
            onPress={() => setAdding({ parentId: null })}
            style={styles.addRow}
          >
            <Text style={styles.addRowText}>+ 新しい目標を追加</Text>
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

      {decomposing && (
        <DecomposeModal
          node={decomposing}
          userId={userId!}
          onClose={() => setDecomposing(null)}
          onDone={() => { setDecomposing(null); load(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Goal Row ───────────────────────────────────────────────────────────────

function GoalRow({
  node, level, onAddChild, onDecompose, onDelete,
}: {
  node: GoalNode;
  level: number;
  onAddChild: (parentId: string) => void;
  onDecompose: (node: GoalNode) => void;
  onDelete: (id: string) => void;
}) {
  const progress =
    node.target_value && node.target_value > 0
      ? Math.min(1, node.current_value / node.target_value)
      : 0;

  return (
    <View>
      <View style={[styles.row, { marginLeft: level * 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{node.title}</Text>
          {node.target_value != null && (
            <>
              <Text style={styles.rowMeta}>
                {node.current_value.toLocaleString()} / {node.target_value.toLocaleString()}{' '}
                {node.unit || ''}
                {node.target_date ? `  期限: ${node.target_date}` : ''}
              </Text>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            </>
          )}
          {node.children.length === 0 && (
            <Pressable
              onPress={() => onDecompose(node)}
              style={styles.aiBtn}
            >
              <Text style={styles.aiBtnText}>✨ AIで逆算分解</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.rowActions}>
          <Pressable onPress={() => onAddChild(node.id)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>＋</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(node.id)} style={styles.iconBtn}>
            <Text style={[styles.iconBtnText, { color: '#A32D2D' }]}>×</Text>
          </Pressable>
        </View>
      </View>
      {node.children.map((c) => (
        <GoalRow
          key={c.id}
          node={c}
          level={level + 1}
          onAddChild={onAddChild}
          onDecompose={onDecompose}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}

// ─── AI Decompose Modal ──────────────────────────────────────────────────────

function DecomposeModal({
  node, userId, onClose, onDone,
}: {
  node: GoalNode;
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecomposeResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    runDecompose();
  }, []);

  async function runDecompose() {
    setLoading(true);
    setError('');
    try {
      const prompt = buildPrompt(node);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `あなたは目標達成の専門家です。
ユーザーの目標を受け取り、それを階層的に分解してください。
必ずJSON形式のみで返してください。前置きや説明は不要です。
フォーマット:
{
  "subgoals": [
    {
      "title": "サブ目標名",
      "target_value": 数値または null,
      "unit": "単位または null",
      "horizon": "10年/5年/1年/6ヶ月/1ヶ月/1週間/今日",
      "strategy": "savings/habit/skill/revenue/custom",
      "children": [
        { "title": "...", "target_value": null, "unit": null, "horizon": "今日", "strategy": "custom", "children": [] }
      ]
    }
  ],
  "today_action": "今日すぐできる具体的な一歩（1行）"
}`,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed: DecomposeResult = JSON.parse(clean);
      setResult(parsed);
    } catch (e: any) {
      setError('分解に失敗しました: ' + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function saveSubgoals() {
    if (!result) return;
    setLoading(true);
    try {
      await saveGoalTree(userId, node.id, result.subgoals);
      onDone();
    } catch (e: any) {
      setError('保存に失敗しました: ' + (e?.message || String(e)));
      setLoading(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.decomposeBackdrop}>
        <View style={styles.decomposeSheet}>
          <View style={styles.handle} />
          <Text style={styles.decomposeTitle}>AIで逆算分解</Text>
          <Text style={styles.decomposeGoal}>「{node.title}」</Text>

          {loading && (
            <View style={styles.loadingArea}>
              <ActivityIndicator color="#7F77DD" size="large" />
              <Text style={styles.loadingText}>AIが逆算中…</Text>
            </View>
          )}

          {error ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: '#A32D2D', marginBottom: 12 }}>{error}</Text>
              <Pressable onPress={runDecompose} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>再試行</Text>
              </Pressable>
            </View>
          ) : null}

          {result && !loading && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {result.today_action && (
                <View style={styles.todayBox}>
                  <Text style={styles.todayLabel}>今日の一歩 ⚡</Text>
                  <Text style={styles.todayAction}>{result.today_action}</Text>
                </View>
              )}
              <Text style={styles.decomposeSectionLabel}>分解されたロードマップ</Text>
              {result.subgoals.map((sg, i) => (
                <SubgoalPreview key={i} subgoal={sg} level={0} />
              ))}
              <View style={styles.actions}>
                <Pressable onPress={onClose} style={[styles.btn, styles.btnSecondary]}>
                  <Text style={styles.btnSecondaryText}>キャンセル</Text>
                </Pressable>
                <Pressable onPress={saveSubgoals} style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnPrimaryText}>保存する</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SubgoalPreview({ subgoal, level }: { subgoal: SubgoalItem; level: number }) {
  return (
    <View>
      <View style={[styles.subgoalRow, { marginLeft: level * 12 }]}>
        <Text style={styles.subgoalHorizon}>{subgoal.horizon}</Text>
        <Text style={styles.subgoalTitle}>{subgoal.title}</Text>
        {subgoal.target_value != null && (
          <Text style={styles.subgoalValue}>
            {subgoal.target_value.toLocaleString()} {subgoal.unit || ''}
          </Text>
        )}
      </View>
      {subgoal.children?.map((c, i) => (
        <SubgoalPreview key={i} subgoal={c} level={level + 1} />
      ))}
    </View>
  );
}

// ─── Goal Add Modal ──────────────────────────────────────────────────────────

function GoalAddModal({
  visible, parentId, onClose, onSubmit,
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
    strategy_type: Goal['strategy_type'];
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [strategy, setStrategy] = useState<NonNullable<Goal['strategy_type']>>('custom');

  useEffect(() => {
    if (visible) { setTitle(''); setTarget(''); setUnit(''); setDateStr(''); setStrategy('custom'); }
  }, [visible]);

  const strategies: { label: string; value: NonNullable<Goal['strategy_type']> }[] = [
    { label: '💰 貯金', value: 'savings' },
    { label: '💪 習慣', value: 'habit' },
    { label: '📚 スキル', value: 'skill' },
    { label: '💼 売上', value: 'revenue' },
    { label: '✨ その他', value: 'custom' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.decomposeBackdrop}>
        <View style={styles.decomposeSheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.decomposeTitle}>
              {parentId ? 'サブ目標を追加' : '新しい目標'}
            </Text>
            <Text style={styles.label}>目標名</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="例: 40歳までに1億円貯金"
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>目標値</Text>
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  placeholder="100000000"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>単位</Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="円"
                  style={styles.input}
                />
              </View>
            </View>
            <Text style={styles.label}>期限</Text>
            <TextInput
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="2040-01-01"
              style={styles.input}
            />
            <Text style={styles.label}>カテゴリ</Text>
            <View style={styles.chips}>
              {strategies.map((s) => (
                <Pressable
                  key={s.value}
                  onPress={() => setStrategy(s.value)}
                  style={[styles.chip, strategy === s.value && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, strategy === s.value && styles.chipTextSelected]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.actions, { marginTop: 24 }]}>
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SubgoalItem = {
  title: string;
  target_value: number | null;
  unit: string | null;
  horizon: string;
  strategy: string;
  children: SubgoalItem[];
};

type DecomposeResult = {
  subgoals: SubgoalItem[];
  today_action: string;
};

function buildPrompt(node: GoalNode): string {
  const parts = [`目標: ${node.title}`];
  if (node.target_value) parts.push(`目標値: ${node.target_value.toLocaleString()} ${node.unit || ''}`);
  if (node.target_date) parts.push(`期限: ${node.target_date}`);
  if (node.strategy_type) parts.push(`カテゴリ: ${node.strategy_type}`);
  return parts.join('\n') + '\n\nこの目標を10年→1年→1ヶ月→1週間→今日の具体的アクションまで逆算で分解してください。';
}

async function saveGoalTree(
  userId: string,
  parentId: string,
  subgoals: SubgoalItem[],
) {
  const { createGoal } = await import('../../lib/goals');
  for (const sg of subgoals) {
    const created = await createGoal(userId, {
      title: sg.title,
      parent_id: parentId,
      target_value: sg.target_value,
      unit: sg.unit,
      strategy_type: (sg.strategy as Goal['strategy_type']) ?? 'custom',
    });
    if (sg.children?.length) {
      await saveGoalTree(userId, created.id, sg.children);
    }
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 16, paddingTop: 8, borderBottomWidth: 0.5, borderBottomColor: '#E2E0D8' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#2C2C2A' },
  headerSub: { fontSize: 12, color: '#888780', marginTop: 3 },
  list: { padding: 12, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#2C2C2A', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#888780', marginBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7F6F2',
    marginBottom: 8,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#2C2C2A', marginBottom: 4 },
  rowMeta: { fontSize: 12, color: '#888780', marginBottom: 6 },
  progressBg: { height: 4, backgroundColor: '#E2E0D8', borderRadius: 2, marginBottom: 8 },
  progressFill: { height: 4, backgroundColor: '#7F77DD', borderRadius: 2 },
  aiBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEEDFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CECBF6',
  },
  aiBtnText: { fontSize: 12, color: '#534AB7', fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 20, color: '#7F77DD', lineHeight: 24 },
  addRow: { padding: 14, alignItems: 'center' },
  addRowText: { color: '#7F77DD', fontSize: 14, fontWeight: '500' },

  // Decompose modal
  decomposeBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  decomposeSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: '#D3D1C7', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  decomposeTitle: { fontSize: 18, fontWeight: '700', color: '#2C2C2A', paddingHorizontal: 20, paddingTop: 16, marginBottom: 4 },
  decomposeGoal: { fontSize: 14, color: '#7F77DD', paddingHorizontal: 20, marginBottom: 12 },
  loadingArea: { alignItems: 'center', padding: 48, gap: 16 },
  loadingText: { fontSize: 14, color: '#888780' },
  todayBox: {
    backgroundColor: '#EEEDFE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#7F77DD',
  },
  todayLabel: { fontSize: 12, color: '#534AB7', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  todayAction: { fontSize: 15, color: '#26215C', fontWeight: '500', lineHeight: 22 },
  decomposeSectionLabel: { fontSize: 12, color: '#888780', fontWeight: '600', textTransform: 'uppercase', marginBottom: 10 },
  subgoalRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F7F6F2',
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subgoalHorizon: { fontSize: 11, color: '#7F77DD', fontWeight: '700', minWidth: 48 },
  subgoalTitle: { fontSize: 14, color: '#2C2C2A', flex: 1 },
  subgoalValue: { fontSize: 12, color: '#888780' },

  // Shared
  label: { fontSize: 12, color: '#888780', fontWeight: '600', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: '#E8E6DF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    backgroundColor: '#FAFAF8', color: '#2C2C2A',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#E8E6DF', backgroundColor: '#FAFAF8' },
  chipSelected: { backgroundColor: '#EEEDFE', borderColor: '#7F77DD' },
  chipText: { fontSize: 13, color: '#5F5E5A' },
  chipTextSelected: { color: '#26215C', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#7F77DD' },
  btnPrimaryText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  btnSecondary: { backgroundColor: '#F1EFE8' },
  btnSecondaryText: { color: '#444441', fontSize: 14 },
  primaryBtn: { backgroundColor: '#7F77DD', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  primaryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});
