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
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    notes: string | null;
    notification_minutes_before: number | null;
    recurrence_rule: string | null;
  }) => void;
  onDelete?: () => void;
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
  onClose,
  onSubmit,
  onDelete,
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
            <Text style={styles.timeRange}>
              {formatRange(startAt, endAt)}
            </Text>

            <Text style={styles.label}>件名</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="家の掃除"
              style={styles.input}
              autoFocus
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
              {onDelete ? (
                <Pressable onPress={onDelete} style={[styles.btn, styles.btnDanger]}>
                  <Text style={styles.btnDangerText}>削除</Text>
                </Pressable>
              ) : null}
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
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${start.getMonth() + 1}/${start.getDate()} ${f(start)} - ${f(end)}`;
  return `${start.getMonth() + 1}/${start.getDate()} ${f(start)} - ${end.getMonth() + 1}/${end.getDate()} ${f(end)}`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D3D1C7',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  body: { padding: 20, paddingBottom: 40 },
  timeRange: { fontSize: 13, color: '#888780', marginBottom: 12 },
  label: { fontSize: 13, color: '#5F5E5A', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFF',
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    backgroundColor: '#FFF',
  },
  chipSelected: { backgroundColor: '#CECBF6', borderColor: '#7F77DD' },
  chipText: { fontSize: 13, color: '#5F5E5A' },
  chipTextSelected: { color: '#26215C', fontWeight: '500' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnPrimary: { backgroundColor: '#7F77DD' },
  btnPrimaryText: { color: '#FFF', fontWeight: '500' },
  btnSecondary: { backgroundColor: '#F1EFE8' },
  btnSecondaryText: { color: '#444441' },
  btnDanger: { backgroundColor: '#FCEBEB' },
  btnDangerText: { color: '#A32D2D' },
});
