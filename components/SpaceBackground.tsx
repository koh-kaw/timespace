import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function SpaceBackground() {
  const stars = useMemo(() => {
    return Array.from({ length: 120 }, (_, i) => ({
      x: seededRandom(i * 3) * width,
      y: seededRandom(i * 3 + 1) * height,
      r: seededRandom(i * 3 + 2) * 1.5 + 0.3,
      opacity: seededRandom(i * 7) * 0.7 + 0.2,
    }));
  }, []);

  const nebulae = useMemo(() => [
    { cx: width * 0.2, cy: height * 0.15, r: 180, color1: '#4A3B8C', color2: 'transparent' },
    { cx: width * 0.85, cy: height * 0.4, r: 160, color1: '#1B3A6B', color2: 'transparent' },
    { cx: width * 0.5, cy: height * 0.75, r: 200, color1: '#2D1B5E', color2: 'transparent' },
  ], []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="bgGrad" cx="50%" cy="30%" r="80%">
            <Stop offset="0%" stopColor="#0D0B1E" />
            <Stop offset="50%" stopColor="#080714" />
            <Stop offset="100%" stopColor="#030308" />
          </RadialGradient>
          {nebulae.map((n, i) => (
            <RadialGradient key={i} id={`neb${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={n.color1} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={n.color2} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="url(#bgGrad)" />

        {nebulae.map((n, i) => (
          <Circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill={`url(#neb${i})`} />
        ))}

        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" fillOpacity={s.opacity} />
        ))}
      </Svg>
    </View>
  );
}
