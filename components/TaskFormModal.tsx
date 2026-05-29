import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

type Props = {
  visible: boolean;
  initialTitle?: string;
  initialNotes?: string;
  initialNotificationMinutesBefore?: number | null;
  initialRecurrence?: string | null;
  startAt: Date;
  endAt: Date;
  isEditing: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    notes: string | null;
    notification_minutes_before: number | null;
    recurrence_rule: string | null;
  }) => void;
  onDelete?: () => void;
  onDrillIn?: () => void;
};

const NOTIFICATION_OPTIONS = [
  { label: '通知なし', value: null },
  { label: '開始時', value: 0 },
  { label: '5分前', value: 5 },
  { label: '15分前', value: 15 },
  { label: '1時間前', value: 60 },
  { label: '1日前', value: 60 * 24 },
];

const RECURRENCE_OPTIONS: { label: string; value: string | null }[] = [
  { label: '繰り返しなし', value: null },
  { label: '毎日', value: 'FREQ=DAILY' },
  { label: '平日', value: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR' },
  { label: '毎週', value: 'FREQ=WEEKLY' },
  { label: '毎月', value: 'FREQ=MONTHLY' },
];

export function TaskFormModal({
  visible,
  initialTitle = '',
  initialNotes = '',
  initialNotificationMinutesBefore = null,
  initialRecurrence = null,
  startAt,
  endAt,
  isEditing,
  onClose,
  onSubmit,
  onDelete,
  onDrillIn,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [notif, setNotif] = useState<number | null>(initialNotificationMinutesBefore);
  const [recur, setRecur] = useState<string | null>(initialRecurrence);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setNotes(initialNotes);
      setNotif(initialNotificationMinutesBefore);
      setRecur(initialRecurrence);
    }
  }, [visible, initialTitle, initialNotes, initialNotificationMinutesBefore, initialRecurrence]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <Text style={styles.timeRange}>{formatRange(startAt, endAt)}</Text>
              {isEditing && onDrillIn && (
                <Pressable onPress={onDrillIn} style={styles.drillBtn}>
                  <Text style={styles.drillBtnText}>奥行きへ ↓</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.label}>件名</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="例：家の掃除"
              style={styles.input}
              autoFocus={!isEditing}
            />

            <Text style={styles.label}>メモ</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder=""
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textarea]}
            />

            <Text style={styles.label}>通知</Text>
            <View style={styles.chips}>
              {NOTIFICATION_OPTIONS.map((opt) => (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => setNotif(opt.value)}
                  style={[styles.chip, notif === opt.value && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, notif === opt.value && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>繰り返し</Text>
            <View style={styles.chips}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => setRecur(opt.value)}
                  style={[styles.chip, recur === opt.value && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, recur === opt.value && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.actions}>
              {onDelete && (
                <Pressable onPress={onDelete} style={[styles.btn, styles.btnDanger]}>
                  <Text style={styles.btnDangerText}>削除</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={[styles.btn, styles.btnSecondary]}>
                <Text style={styles.btnSecondaryText}>キャンセル</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!title.trim()) return;
                  onSubmit({
                    title: title.trim(),
                    notes: notes.trim() || null,
                    notification_minutes_before: notif,
                    recurrence_rule: recur,
                  });
                }}
                style={[styles.btn, styles.btnPrimary]}
              >
                <Text style={styles.btnPrimaryText}>保存</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatRange(start: Date, end: Date): string {
  const f = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${start.getMonth() + 1}/${start.getDate()} ${f(start)} - ${f(end)}`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D3D1C7',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  body: { padding: 20, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  timeRange: { fontSize: 13, color: '#888780' },
  drillBtn: {
    backgroundColor: '#7F77DD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  drillBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, color: '#888780', marginTop: 14, marginBottom: 6, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#E8E6DF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#FAFAF8',
    color: '#2C2C2A',
  },
  textarea: { minHeight: 76, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DF',
    backgroundColor: '#FAFAF8',
  },
  chipSelected: { backgroundColor: '#EEEDFE', borderColor: '#7F77DD' },
  chipText: { fontSize: 13, color: '#5F5E5A' },
  chipTextSelected: { color: '#26215C', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#7F77DD' },
  btnPrimaryText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  btnSecondary: { backgroundColor: '#F1EFE8' },
  btnSecondaryText: { color: '#444441', fontSize: 14 },
  btnDanger: { backgroundColor: '#FCEBEB', marginRight: 'auto' },
  btnDangerText: { color: '#A32D2D', fontSize: 14 },
});
