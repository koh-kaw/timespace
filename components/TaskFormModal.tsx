import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';

type Props = {
  visible: boolean;
  initialTitle?: string;
  initialNotes?: string;
  initialNotificationMinutesBefore?: number | null;
  initialRecurrence?: string | null;
  startAt: Date;
  endAt: Date;
  /** If set, restricts the time pickers to this parent range */
  parentStart?: Date;
  parentEnd?: Date;
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
const NOTIF_OPTIONS = [
  { label: '通知なし', value: null },
  { label: '開始時', value: 0 },
  { label: '5分前', value: 5 },
  { label: '15分前', value: 15 },
  { label: '1時間前', value: 60 },
  { label: '1日前', value: 1440 },
];
const RECUR_OPTIONS = [
  { label: '繰り返しなし', value: null },
  { label: '毎日', value: 'FREQ=DAILY' },
  { label: '平日', value: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR' },
  { label: '毎週', value: 'FREQ=WEEKLY' },
  { label: '毎月', value: 'FREQ=MONTHLY' },
];

function roundMin(m: number) { return Math.round(m / 5) * 5 % 60; }

export function TaskFormModal({
  visible, initialTitle = '', initialNotes = '',
  initialNotificationMinutesBefore = null, initialRecurrence = null,
  startAt, endAt, parentStart, parentEnd, isEditing, onClose, onSubmit, onDelete, onDrillIn,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [notif, setNotif] = useState<number | null>(initialNotificationMinutesBefore);
  const [recur, setRecur] = useState<string | null>(initialRecurrence);
  const [startH, setStartH] = useState(startAt.getHours());
  const [startM, setStartM] = useState(roundMin(startAt.getMinutes()));
  const [endH, setEndH] = useState(endAt.getHours());
  const [endM, setEndM] = useState(roundMin(endAt.getMinutes()));

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle); setNotes(initialNotes);
      setNotif(initialNotificationMinutesBefore); setRecur(initialRecurrence);
      setStartH(startAt.getHours()); setStartM(roundMin(startAt.getMinutes()));
      setEndH(endAt.getHours()); setEndM(roundMin(endAt.getMinutes()));
    }
  }, [visible, initialTitle, initialNotes, initialNotificationMinutesBefore, initialRecurrence, startAt, endAt]);

  // Parent range constraints
  const minAllowedH = parentStart ? parentStart.getHours() : 0;
  const minAllowedM = parentStart ? parentStart.getMinutes() : 0;
  const maxAllowedH = parentEnd ? parentEnd.getHours() : 23;
  const maxAllowedM = parentEnd ? parentEnd.getMinutes() : 55;

  const HOURS_FILTERED = parentStart && parentEnd
    ? HOURS.filter(h => h >= minAllowedH && h <= maxAllowedH)
    : HOURS;
  const startMinutes_filtered = parentStart && parentEnd
    ? MINUTES.filter(m => {
        if (startH === minAllowedH && m < minAllowedM) return false;
        if (startH === maxAllowedH && m > maxAllowedM) return false;
        return true;
      })
    : MINUTES;
  const endMinutes_filtered = parentStart && parentEnd
    ? MINUTES.filter(m => {
        if (endH === minAllowedH && m < minAllowedM) return false;
        if (endH === maxAllowedH && m > maxAllowedM) return false;
        return true;
      })
    : MINUTES;

  const totalMin = (endH * 60 + endM) - (startH * 60 + startM);
  const durationLabel = totalMin > 0
    ? totalMin >= 60 ? `${Math.floor(totalMin/60)}h${totalMin%60 ? (totalMin%60)+'m' : ''}` : `${totalMin}m`
    : '⚠';

  const buildStart = () => { const d = new Date(startAt); d.setHours(startH, startM, 0, 0); return d; };
  const buildEnd = () => {
    const d = new Date(startAt); d.setHours(endH, endM, 0, 0);
    if (d <= buildStart()) d.setDate(d.getDate() + 1);
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
                hours={HOURS_FILTERED} minutes={startMinutes_filtered}
                onH={(v) => { setStartH(v); if (v * 60 + startM >= endH * 60 + endM) setEndH(v + 1 < 24 ? v + 1 : v); }}
                onM={(v) => setStartM(v)} />
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{durationLabel}</Text>
              </View>
              <TimeBlock label="終了" h={endH} m={endM}
                hours={HOURS_FILTERED} minutes={endMinutes_filtered}
                onH={setEndH} onM={setEndM} />
            </View>

            <Text style={styles.label}>件名</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="例：家の掃除"
              placeholderTextColor="rgba(255,255,255,0.2)" style={styles.input} autoFocus={!isEditing} />

            <Text style={styles.label}>メモ</Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder=""
              placeholderTextColor="rgba(255,255,255,0.2)" multiline numberOfLines={3}
              style={[styles.input, styles.textarea]} />

            <Text style={styles.label}>通知</Text>
            <View style={styles.chips}>
              {NOTIF_OPTIONS.map(opt => (
                <Pressable key={String(opt.value)} onPress={() => setNotif(opt.value)}
                  style={[styles.chip, notif === opt.value && styles.chipSel]}>
                  <Text style={[styles.chipText, notif === opt.value && styles.chipTextSel]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>繰り返し</Text>
            <View style={styles.chips}>
              {RECUR_OPTIONS.map(opt => (
                <Pressable key={opt.label} onPress={() => setRecur(opt.value)}
                  style={[styles.chip, recur === opt.value && styles.chipSel]}>
                  <Text style={[styles.chipText, recur === opt.value && styles.chipTextSel]}>{opt.label}</Text>
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
                <Text style={styles.btnSecText}>キャンセル</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!title.trim() || totalMin <= 0) return;
                  onSubmit({ title: title.trim(), notes: notes.trim() || null,
                    notification_minutes_before: notif, recurrence_rule: recur,
                    start_at: buildStart(), end_at: buildEnd() });
                }}
                style={[styles.btn, styles.btnPrimary, totalMin <= 0 && { opacity: 0.35 }]}>
                <Text style={styles.btnPrimText}>保存</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TimeBlock({ label, h, m, hours = HOURS, minutes = MINUTES, onH, onM }: {
  label: string; h: number; m: number;
  hours?: number[]; minutes?: number[];
  onH: (v: number) => void; onM: (v: number) => void;
}) {
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeBlockLabel}>{label}</Text>
      <View style={styles.timeSelectors}>
        <TimeScroller values={hours} selected={h} onSelect={onH} format={v => String(v).padStart(2,'0')} unit="時" />
        <Text style={styles.timeSep}>:</Text>
        <TimeScroller values={minutes} selected={m} onSelect={onM} format={v => String(v).padStart(2,'0')} unit="分" />
      </View>
    </View>
  );
}

function TimeScroller({ values, selected, onSelect, format, unit }: {
  values: number[]; selected: number; onSelect: (v: number) => void;
  format: (v: number) => string; unit: string;
}) {
  const idx = values.indexOf(selected);
  const prev = idx > 0 ? values[idx - 1] : null;
  const next = idx < values.length - 1 ? values[idx + 1] : null;
  return (
    <View style={styles.scroller}>
      <Pressable onPress={() => prev !== null && onSelect(prev)} style={styles.scrollBtn}>
        <Text style={styles.scrollArrow}>{prev !== null ? '▲' : ''}</Text>
        <Text style={styles.scrollSide}>{prev !== null ? format(prev) : ''}</Text>
      </Pressable>
      <View style={styles.scrollerItemSel}>
        <Text style={styles.scrollerTextSel}>
          {format(selected)}<Text style={{ fontSize: 9, fontWeight: '300' }}>{unit}</Text>
        </Text>
      </View>
      <Pressable onPress={() => next !== null && onSelect(next)} style={styles.scrollBtn}>
        <Text style={styles.scrollSide}>{next !== null ? format(next) : ''}</Text>
        <Text style={styles.scrollArrow}>{next !== null ? '▼' : ''}</Text>
      </Pressable>
    </View>
  );
}

const S = {
  bg: '#000000',
  sheet: '#0a0818',
  border: 'rgba(255,255,255,0.1)',
  borderBright: 'rgba(255,255,255,0.18)',
  text: 'rgba(255,255,255,0.85)',
  textDim: 'rgba(255,255,255,0.35)',
  gold: '#E8C56A',
  blue: '#5A9BE8',
  danger: '#FF6B6B',
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: S.sheet,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: S.borderBright,
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  body: { padding: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dateLabel: { fontSize: 13, color: S.textDim, fontWeight: '300', letterSpacing: 1 },
  drillBtn: { backgroundColor: 'rgba(232,197,106,0.15)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(232,197,106,0.4)' },
  drillBtnText: { color: S.gold, fontSize: 12, fontWeight: '500' },

  timePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14,
    borderWidth: 0.5, borderColor: S.border, marginBottom: 16 },
  timeBlock: { alignItems: 'center', flex: 1 },
  timeBlockLabel: { fontSize: 10, color: S.textDim, textTransform: 'uppercase',
    letterSpacing: 0.8, fontWeight: '500', marginBottom: 8 },
  timeSelectors: { flexDirection: 'row', alignItems: 'center' },
  timeSep: { fontSize: 18, fontWeight: '300', color: S.text, marginHorizontal: 2 },
  durationBadge: { backgroundColor: 'rgba(232,197,106,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(232,197,106,0.3)' },
  durationText: { fontSize: 12, color: S.gold, fontWeight: '600' },

  scroller: { height: 110, width: 52, alignItems: 'center', justifyContent: 'space-between' },
  scrollBtn: { alignItems: 'center', paddingVertical: 2, minHeight: 28, justifyContent: 'center' },
  scrollArrow: { fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 12 },
  scrollSide: { fontSize: 12, color: 'rgba(255,255,255,0.2)', fontWeight: '200' },
  scrollerContent: { alignItems: 'center', paddingVertical: 4 },
  scrollerItem: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8,
    marginVertical: 1, minWidth: 44, alignItems: 'center' },
  scrollerItemSel: { backgroundColor: 'rgba(232,197,106,0.18)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
  scrollerText: { fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: '300' },
  scrollerTextSel: { color: S.gold, fontWeight: '600', fontSize: 18 },

  label: { fontSize: 10, color: S.textDim, fontWeight: '500', marginTop: 16,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 0.5, borderColor: S.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.04)', color: S.text },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 0.5, borderColor: S.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  chipSel: { backgroundColor: 'rgba(232,197,106,0.15)', borderColor: 'rgba(232,197,106,0.5)' },
  chipText: { fontSize: 12, color: S.textDim },
  chipTextSel: { color: S.gold, fontWeight: '500' },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  btnPrimary: { backgroundColor: 'rgba(232,197,106,0.85)' },
  btnPrimText: { color: '#000', fontWeight: '600', fontSize: 14 },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5, borderColor: S.border },
  btnSecText: { color: S.textDim, fontSize: 14 },
  btnDanger: { backgroundColor: 'rgba(255,107,107,0.12)', marginRight: 'auto',
    borderWidth: 0.5, borderColor: 'rgba(255,107,107,0.25)' },
  btnDangerText: { color: S.danger, fontSize: 14 },
});
