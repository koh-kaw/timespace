import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'low' | 'medium' | 'high';
};

export function GlassCard({ children, style, intensity = 'medium' }: Props) {
  const bgOpacity = { low: 0.06, medium: 0.1, high: 0.16 }[intensity];
  const borderOpacity = { low: 0.12, medium: 0.2, high: 0.3 }[intensity];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: `rgba(255,255,255,${bgOpacity})`,
          borderColor: `rgba(255,255,255,${borderOpacity})`,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
});
