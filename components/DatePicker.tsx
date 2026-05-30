import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const GOLD = '#E8C56A';

type Props = {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  nullable?: boolean;
  placeholder?: string;
};

export function DatePicker({
  label, value, onChange, mode = 'date',
  minimumDate, maximumDate, nullable = true, placeholder = '日付を選択',
}: Props) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  const fmt = (d: Date) => {
    if (mode === 'time') {
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    if (mode === 'datetime') {
      return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  };

  if (Platform.OS === 'ios') {
    return (
      <View>
        {label && <Text style={s.label}>{label}</Text>}
        <Pressable onPress={() => setShow(true)} style={s.trigger}>
          <Text style={[s.triggerText, !value && s.placeholder]}>
            {value ? fmt(value) : placeholder}
          </Text>
          <Text style={s.arrow}>▼</Text>
        </Pressable>

        <Modal visible={show} transparent animationType="slide">
          <Pressable style={s.backdrop} onPress={() => setShow(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              {nullable && (
                <Pressable onPress={() => { onChange(null); setShow(false); }}>
                  <Text style={s.clearBtn}>クリア</Text>
                </Pressable>
              )}
              <Text style={s.sheetTitle}>{label ?? '日付を選択'}</Text>
              <Pressable onPress={() => { onChange(tempDate); setShow(false); }}>
                <Text style={s.doneBtn}>完了</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={tempDate}
              mode={mode}
              display="spinner"
              onChange={(_, d) => d && setTempDate(d)}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              locale="ja"
              style={{ backgroundColor: 'transparent' }}
              textColor="white"
            />
          </View>
        </Modal>
      </View>
    );
  }

  // Android
  return (
    <View>
      {label && <Text style={s.label}>{label}</Text>}
      <Pressable onPress={() => setShow(true)} style={s.trigger}>
        <Text style={[s.triggerText, !value && s.placeholder]}>
          {value ? fmt(value) : placeholder}
        </Text>
        <Text style={s.arrow}>▼</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          display="default"
          onChange={(_, d) => { setShow(false); if (d) onChange(d); }}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  triggerText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '300' },
  placeholder: { color: 'rgba(255,255,255,0.25)' },
  arrow: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#0a0818', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', paddingBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  sheetTitle: { fontSize: 15, fontWeight: '500', color: '#fff' },
  clearBtn: { fontSize: 14, color: '#FF6B6B' },
  doneBtn: { fontSize: 14, color: GOLD, fontWeight: '600' },
});
