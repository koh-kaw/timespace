import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';
import type { ScaleKind } from '../lib/time';

type Props = {
  scaleKind: ScaleKind;
  scaleLabel: string;
  scaleSubLabel: string;
  breadcrumb: string[];
  canZoomUp: boolean;
  canZoomDown: boolean;
  onZoomUp: () => void;
  onZoomDown: () => void;
};

export function ZoomControls({
  scaleLabel, scaleSubLabel, breadcrumb,
  canZoomUp, canZoomDown, onZoomUp, onZoomDown,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onZoomUp} disabled={!canZoomUp}
          style={[styles.btn, !canZoomUp && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>↑ 上へ</Text>
        </Pressable>

        <View style={styles.center}>
          <Text style={styles.scaleLabel}>{scaleLabel}</Text>
          <Text style={styles.scaleSub}>{scaleSubLabel}</Text>
        </View>

        <Pressable
          onPress={onZoomDown} disabled={!canZoomDown}
          style={[styles.btn, !canZoomDown && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>下へ ↓</Text>
        </Pressable>
      </View>
      {breadcrumb.length > 1 && (
        <Text style={styles.crumb}>{breadcrumb.join(' › ')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  btnDisabled: { opacity: 0.3 },
  btnText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  center: { alignItems: 'center' },
  scaleLabel: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  scaleSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  crumb: { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 },
});
