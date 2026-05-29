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
    start_at: Date;
    end_at: Date;
  }) => void;
  onDelete?: () => void;
  onDrillIn?: () => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

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

  const [startH, setStartH] = useState(startAt.getHours());
  const [startM, setStartM] = useState(roundToStep(startAt.getMinutes(), 5));
  const [endH, setEndH] = useState(endAt.getHours());
  const [endM, setEndM] = useState(roundToStep(endAt.getMinutes(), 5));

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setNotes(initialNotes);
      setNotif(initialNotificationMinutesBefore);
      setRecur(initialRecurrence);
      setStartH(startAt.getHours());
      setStartM(roundToStep(startAt.getMinutes(), 5));
      setEndH(endAt.getHours());
      setEndM(roundToStep(endAt.getMinutes(), 5));
    }
  }, [visible, initialTitle, initialNotes, initialNotificationMinutesBefore, initialRecurrence, startAt, endAt]);

  const buildStart = () => {
    const d = new Date(startAt);
    d.setHours(startH, startM, 0, 0);
    return d;
  };
  const buildEnd = () => {
    const d = new Date(endAt);
    d.setHours(endH, endM, 0, 0);
    return d;
  };

  const totalMin = (endH * 60 + endM) - (startH * 60 + startM);
  const durationLabel = totalMin > 0
    ? totalMin >= 60
      ? `${Math.floor(totalMin / 60)}時間${totalMin % 60 ? (totalMin % 60) + '分' : ''}`
      : `${totalMin}分`
    : totalMin === 0 ? '0分' : '⚠ 終了 ≤ 開始';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      onPress={onClose}
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.dateLabel}>{formatDate(startAt)}</Text>
              {isEditing && onDrillIn && (
                <Pressable onPress={onDrillIn} style={styles.drillBtn}>
                  <Text style={styles.drillBtnText}>奥行きへ ↓</Text>
                </Pressable>
              )}
            </View>

            {/* Time picker */}
            <View style={styles.timePickerRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeBlockLabel}>開始</Text>
                <View style={styles.timeSelectors}>
                  <TimeScroller
                    values={HOURS}
                    selected={startH}
                    onSelect={(v) => {
                      setStartH(v);
                      if (v * 60 + startM >= endH * 60 + endM) {
                        setEndH(v);
                        setEndM(startM + 30 <= 55 ? startM + 30 : 55);
                      }
                    }}
                    format={(v) => String(v).padStart(2, '0')}
                    unit="時"
                  />
                  <Text style={styles.timeSep}>:</Text>
                  <TimeScroller
                    values={MINUTES}
                    selected={startM}
                    onSelect={(v) => {
                      setStartM(v);
                      if (startH * 60 + v >= endH * 60 + endM) {
                        setEndM(v + 30 <= 55 ? v + 30 : 55);
                      }
                    }}
                    format={(v) => String(v).padStart(2, '0')}
                    unit="分"
                  />
                </View>
              </View>

              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{durationLabel}</Text>
              </View>

              <View style={styles.timeBlock}>
                <Text style={styles.timeBlockLabel}>終了</Text>
                <View style={styles.timeSelectors}>
                  <TimeScroller
                    values={HOURS}
                    selected={endH}
                    onSelect={setEndH}
                    format={(v) => String(v).padStart(2, '0')}
                    unit="時"
                  />
                  <Text style={styles.timeSep}>:</Text>
                  <TimeScroller
                    values={MINUTES}
                    selected={endM}
                    onSelect={setEndM}
                    format={(v) => String(v).padStart(2, '0')}
                    unit="分"
                  />
                </View>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.label}>件名</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="例：家の掃除"
              style={styles.input}
              autoFocus={!isEditing}
            />

            {/* Notes */}
            <Text style={styles.label}>メモ</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder=""
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textarea]}
            />

            {/* Notification */}
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

            {/* Recurrence */}
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

            {/* Actions */}
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
                  if (totalMin <= 0) return;
                  onSubmit({
                    title: title.trim(),
                    notes: notes.trim() || null,
                    notification_minutes_before: notif,
                    recurrence_rule: recur,
                    start_at: buildStart(),
                    end_at: buildEnd(),
                  });
                }}
                style={[styles.btn, styles.btnPrimary, totalMin <= 0 && { opacity: 0.4 }]}
              >
                <Text style={styles.btnPrimaryText}>保存</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── TimeScroller ────────────────────────────────────────────────────────────

function TimeScroller({
  values,
  selected,
  onSelect,
  format,
  unit,
}: {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  format: (v: number) => string;
  unit: string;
}) {
  return (
    <ScrollView
      style={styles.scroller}
      contentContainerStyle={styles.scrollerContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {values.map((v) => (
        <Pressable
          key={v}
          onPress={() => onSelect(v)}
          style={[styles.scrollerItem, v === selected && styles.scrollerItemSelected]}
        >
          <Text style={[styles.scrollerText, v === selected && styles.scrollerTextSelected]}>
            {format(v)}
            <Text style={styles.scrollerUnit}>{unit}</Text>
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundToStep(min: number, step: number): number {
  return Math.round(min / step) * step % 60;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    width: 36, height: 4, backgroundColor: '#D3D1C7',
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  body: { padding: 20, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  dateLabel: { fontSize: 14, color: '#888780', fontWeight: '500' },
  drillBtn: {
    backgroundColor: '#7F77DD', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 14,
  },
  drillBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Time picker
  timePickerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
    backgroundColor: '#F7F6F2', borderRadius: 16, padding: 12,
  },
  timeBlock: { alignItems: 'center', flex: 1 },
  timeBlockLabel: { fontSize: 11, color: '#888780', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  timeSelectors: { flexDirection: 'row', alignItems: 'center' },
  timeSep: { fontSize: 18, fontWeight: '700', color: '#2C2C2A', marginHorizontal: 2 },
  durationBadge: {
    backgroundColor: '#EEEDFE', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6,
    alignItems: 'center', marginHorizontal: 4,
  },
  durationText: { fontSize: 12, color: '#534AB7', fontWeight: '700', textAlign: 'center' },

  // Scroller
  scroller: { height: 120, width: 48 },
  scrollerContent: { alignItems: 'center', paddingVertical: 4 },
  scrollerItem: {
    paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 8, marginVertical: 1, minWidth: 44, alignItems: 'center',
  },
  scrollerItemSelected: { backgroundColor: '#7F77DD' },
  scrollerText: { fontSize: 15, color: '#5F5E5A', fontWeight: '400' },
  scrollerTextSelected: { color: '#FFF', fontWeight: '700' },
  scrollerUnit: { fontSize: 10, color: 'inherit' },

  label: {
    fontSize: 12, color: '#888780', fontWeight: '600',
    marginTop: 14, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1, borderColor: '#E8E6DF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, backgroundColor: '#FAFAF8', color: '#2C2C2A',
  },
  textarea: { minHeight: 76, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: '#E8E6DF', backgroundColor: '#FAFAF8',
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
