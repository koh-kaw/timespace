import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
  scaleLabel,
  scaleSubLabel,
  breadcrumb,
  canZoomUp,
  canZoomDown,
  onZoomUp,
  onZoomDown,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onZoomUp}
          disabled={!canZoomUp}
          style={[styles.btn, !canZoomUp && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>↑ 上の階層</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.scale}>{scaleLabel}</Text>
          <Text style={styles.sub}>{scaleSubLabel}</Text>
        </View>
        <Pressable
          onPress={onZoomDown}
          disabled={!canZoomDown}
          style={[styles.btn, !canZoomDown && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>下の階層 ↓</Text>
        </Pressable>
      </View>
      {breadcrumb.length > 1 ? (
        <Text style={styles.crumb}>{breadcrumb.join(' › ')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 12, color: '#444441' },
  center: { alignItems: 'center' },
  scale: { fontSize: 16, fontWeight: '500', color: '#2C2C2A' },
  sub: { fontSize: 12, color: '#888780' },
  crumb: { textAlign: 'center', fontSize: 12, color: '#888780', marginTop: 8 },
});
