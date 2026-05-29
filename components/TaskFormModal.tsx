import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { theme } from '../lib/theme';

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
  { label: '1日前', value: 1440 },
];

const RECURRENCE_OPTIONS = [
  { label: '繰り返しなし', value: null },
  { label: '毎日', value: 'FREQ=DAILY' },
  { label: '平日', value: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR' },
  { label: '毎週', value: 'FREQ=WEEKLY' },
  { label: '毎月', value: 'FREQ=MONTHLY' },
];

function roundToStep(min: number, step: number): number {
  return Math.round(min / step) * step % 60;
}

export function TaskFormModal({
  visible, initialTitle = '', initialNotes = '',
  initialNotificationMinutesBefore = null, initialRecurrence = null,
  startAt, endAt, isEditing, onClose, onSubmit, onDelete, onDrillIn,
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
      setTitle(initialTitle); setNotes(initialNotes);
      setNotif(initialNotificationMinutesBefore); setRecur(initialRecurrence);
      setStartH(startAt.getHours()); setStartM(roundToStep(startAt.getMinutes(), 5));
      setEndH(endAt.getHours()); setEndM(roundToStep(endAt.getMinutes(), 5));
    }
  }, [visible, initialTitle, initialNotes, initialNotificationMinutesBefore, initialRecurrence, startAt, endAt]);

  const totalMin = (endH * 60 + endM) - (startH * 60 + startM);
  const durationLabel = totalMin > 0
    ? totalMin >= 60
      ? `${Math.floor(totalMin / 60)}h${totalMin % 60 ? (totalMin % 60) + 'm' : ''}`
      : `${totalMin}m`
    : '⚠';

  const buildStart = () => {
    // Always use startAt's date, but override the hours/minutes with picker values
    const d = new Date(startAt);
    d.setHours(startH, startM, 0, 0);
    return d;
  };
  const buildEnd = () => {
    // Use startAt's date (same day), but with end hours/minutes
    // If endH < startH, it wraps to next day — handle that
    const d = new Date(startAt);
    d.setHours(endH, endM, 0, 0);
    if (d <= buildStart()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.dateLabel}>
                {startAt.getFullYear()}/{startAt.getMonth()+1}/{startAt.getDate()}
              </Text>
              {isEditing && onDrillIn && (
                <Pressable onPress={onDrillIn} style={styles.drillBtn}>
                  <Text style={styles.drillBtnText}>奥行きへ ↓</Text>
                </Pressable>
              )}
            </View>

            {/* Time picker */}
            <View style={styles.timePicker}>
              <TimeBlock label="開始" h={startH} m={startM}
                onH={(v) => { setStartH(v); if (v * 60 + startM >= endH * 60 + endM) setEndH(v + 1 < 24 ? v + 1 : v); }}
                onM={(v) => setStartM(v)} />
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{durationLabel}</Text>
              </View>
              <TimeBlock label="終了" h={endH} m={endM} onH={setEndH} onM={setEndM} />
            </View>

            {/* Title */}
            <Text style={styles.label}>件名</Text>
            <TextInput value={title} onChangeText={setTitle}
              placeholder="例：家の掃除" placeholderTextColor="rgba(255,255,255,0.25)"
              style={styles.input} autoFocus={!isEditing} />

            {/* Notes */}
            <Text style={styles.label}>メモ</Text>
            <TextInput value={notes} onChangeText={setNotes}
              placeholder="" placeholderTextColor="rgba(255,255,255,0.25)"
              multiline numberOfLines={3} style={[styles.input, styles.textarea]} />

            {/* Notification */}
            <Text style={styles.label}>通知</Text>
            <View style={styles.chips}>
              {NOTIFICATION_OPTIONS.map((opt) => (
                <Pressable key={String(opt.value)} onPress={() => setNotif(opt.value)}
                  style={[styles.chip, notif === opt.value && styles.chipSelected]}>
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
                <Pressable key={opt.label} onPress={() => setRecur(opt.value)}
                  style={[styles.chip, recur === opt.value && styles.chipSelected]}>
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
                  if (!title.trim() || totalMin <= 0) return;
                  onSubmit({ title: title.trim(), notes: notes.trim() || null,
                    notification_minutes_before: notif, recurrence_rule: recur,
                    start_at: buildStart(), end_at: buildEnd() });
                }}
                style={[styles.btn, styles.btnPrimary, totalMin <= 0 && { opacity: 0.4 }]}>
                <Text style={styles.btnPrimaryText}>保存</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TimeBlock({ label, h, m, onH, onM }: {
  label: string; h: number; m: number;
  onH: (v: number) => void; onM: (v: number) => void;
}) {
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeBlockLabel}>{label}</Text>
      <View style={styles.timeSelectors}>
        <TimeScroller values={HOURS} selected={h} onSelect={onH}
          format={(v) => String(v).padStart(2, '0')} unit="時" />
        <Text style={styles.timeSep}>:</Text>
        <TimeScroller values={MINUTES} selected={m} onSelect={onM}
          format={(v) => String(v).padStart(2, '0')} unit="分" />
      </View>
    </View>
  );
}

function TimeScroller({ values, selected, onSelect, format, unit }: {
  values: number[]; selected: number; onSelect: (v: number) => void;
  format: (v: number) => string; unit: string;
}) {
  return (
    <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollerContent}
      showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {values.map((v) => (
        <Pressable key={v} onPress={() => onSelect(v)}
          style={[styles.scrollerItem, v === selected && styles.scrollerItemSelected]}>
          <Text style={[styles.scrollerText, v === selected && styles.scrollerTextSelected]}>
            {format(v)}<Text style={{ fontSize: 9 }}>{unit}</Text>
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#12103A',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%',
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  body: { padding: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dateLabel: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  drillBtn: { backgroundColor: 'rgba(139,127,255,0.3)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(139,127,255,0.6)' },
  drillBtnText: { color: '#A89CFF', fontSize: 12, fontWeight: '600' },
  timePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  timeBlock: { alignItems: 'center', flex: 1 },
  timeBlockLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  timeSelectors: { flexDirection: 'row', alignItems: 'center' },
  timeSep: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginHorizontal: 2 },
  durationBadge: { backgroundColor: 'rgba(139,127,255,0.2)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(139,127,255,0.4)' },
  durationText: { fontSize: 12, color: '#A89CFF', fontWeight: '700', textAlign: 'center' },
  scroller: { height: 120, width: 48 },
  scrollerContent: { alignItems: 'center', paddingVertical: 4 },
  scrollerItem: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, marginVertical: 1, minWidth: 44, alignItems: 'center' },
  scrollerItemSelected: { backgroundColor: 'rgba(139,127,255,0.4)' },
  scrollerText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '400' },
  scrollerTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600',
    marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.06)', color: '#FFFFFF' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)' },
  chipSelected: { backgroundColor: 'rgba(139,127,255,0.3)', borderColor: 'rgba(139,127,255,0.6)' },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  chipTextSelected: { color: '#A89CFF', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  btnPrimary: { backgroundColor: 'rgba(139,127,255,0.8)' },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
  btnSecondaryText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  btnDanger: { backgroundColor: 'rgba(255,107,107,0.15)', marginRight: 'auto',
    borderWidth: 0.5, borderColor: 'rgba(255,107,107,0.3)' },
  btnDangerText: { color: '#FF6B6B', fontSize: 14 },
});
