import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function SpaceBackground() {
  const stars = useMemo(() => Array.from({ length: 280 }, (_, i) => {
    const r = seededRandom(i * 3 + 2) * 1.1 + 0.15;
    const big = seededRandom(i * 11) < 0.06;
    return {
      x: seededRandom(i * 3) * width,
      y: seededRandom(i * 3 + 1) * height,
      r: big ? r * 1.8 : r,
      opacity: big
        ? seededRandom(i * 7) * 0.4 + 0.5
        : seededRandom(i * 7) * 0.35 + 0.1,
    };
  }), []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        {/* Pure black base */}
        <Rect x={0} y={0} width={width} height={height} fill="#000000" />

        {/* Very subtle blue-black gradient at top */}
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="40%" r="65%">
            <Stop offset="0%" stopColor="#0a0820" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />

        {/* Stars */}
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" fillOpacity={s.opacity} />
        ))}
      </Svg>
    </View>
  );
}
