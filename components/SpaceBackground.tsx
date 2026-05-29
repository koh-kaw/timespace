import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function SpaceBackground() {
  const stars = useMemo(() => Array.from({ length: 160 }, (_, i) => ({
    x: seededRandom(i * 3) * width,
    y: seededRandom(i * 3 + 1) * height,
    r: seededRandom(i * 3 + 2) * 1.2 + 0.2,
    opacity: seededRandom(i * 7) * 0.6 + 0.15,
  })), []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="35%" r="75%">
            <Stop offset="0%" stopColor="#0a0820" />
            <Stop offset="55%" stopColor="#060412" />
            <Stop offset="100%" stopColor="#000008" />
          </RadialGradient>
          <RadialGradient id="neb1" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#2a1a6e" stopOpacity={0.22} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="neb2" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0e2a5e" stopOpacity={0.18} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />

        {/* Nebulae */}
        <Circle cx={width * 0.2} cy={height * 0.18} r={200} fill="url(#neb1)" />
        <Circle cx={width * 0.85} cy={height * 0.45} r={160} fill="url(#neb2)" />

        {/* Stars */}
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" fillOpacity={s.opacity} />
        ))}
      </Svg>
    </View>
  );
}
