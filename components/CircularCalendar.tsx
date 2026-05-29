import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import type { Task } from '../lib/supabase';
import type { ScaleRange } from '../lib/time';

type Props = {
  size: number;
  range: ScaleRange;
  tasks: Task[];
  selectedSlice: number | null;
  onSlicePress: (index: number) => void;
  onTaskPress: (task: Task) => void;
};

const N = 24;
const R_GOLD = 0.88;
const R_BLUE = 0.73;
const R_CENTER = 0.22;

function fracToAngle(f: number) {
  return f * Math.PI * 2 - Math.PI / 2;
}

function makeArcPoints(startFrac: number, endFrac: number, r: number, segs = 180): THREE.Vector3[] {
  return Array.from({ length: segs + 1 }, (_, i) => {
    const a = fracToAngle(startFrac + (i / segs) * (endFrac - startFrac));
    return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0);
  });
}

function makeGlowLine(pts: THREE.Vector3[], color: THREE.Color, opacity: number): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return new THREE.Line(geo, mat);
}

function positionInRange(date: Date, range: ScaleRange): number {
  const total = range.end.getTime() - range.start.getTime();
  return Math.max(0, Math.min(1, (date.getTime() - range.start.getTime()) / total));
}

export function CircularCalendar({ size, range, tasks, selectedSlice, onSlicePress, onTaskPress }: Props) {
  const nowFrac = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    return (now.getTime() - range.start.getTime()) / (range.end.getTime() - range.start.getTime());
  }, [range]);

  const onContextCreate = useCallback((gl: any) => {
    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        clientHeight: gl.drawingBufferHeight,
        getContext: () => gl,
      } as any,
      context: gl,
    });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const camera = new THREE.OrthographicCamera(-1.3 * aspect, 1.3 * aspect, 1.3, -1.3, 0.1, 100);
    camera.position.z = 5;

    const gold = new THREE.Color('#E8C56A');
    const blue = new THREE.Color('#5A9BE8');
    const white = new THREE.Color('#ffffff');

    // Guide circles
    scene.add(makeGlowLine(makeArcPoints(0, 1, R_GOLD, 256), white, 0.07));
    scene.add(makeGlowLine(makeArcPoints(0, 1, R_BLUE, 256), white, 0.06));

    // Gold arc — 4 glow layers
    if (nowFrac != null && nowFrac > 0.002) {
      const pts = makeArcPoints(0, nowFrac, R_GOLD);
      scene.add(makeGlowLine(pts, gold, 0.08));
      scene.add(makeGlowLine(pts, gold, 0.18));
      scene.add(makeGlowLine(pts, gold, 0.45));
      scene.add(makeGlowLine(pts, gold, 1.0));
    }

    // Blue arc — 4 glow layers
    const blueStart = nowFrac ?? 0;
    if (blueStart < 0.998) {
      const pts = makeArcPoints(blueStart, 1, R_BLUE);
      scene.add(makeGlowLine(pts, blue, 0.08));
      scene.add(makeGlowLine(pts, blue, 0.18));
      scene.add(makeGlowLine(pts, blue, 0.45));
      scene.add(makeGlowLine(pts, blue, 1.0));
    }

    // Task arcs
    tasks.forEach(task => {
      const s = new Date(task.start_at), e = new Date(task.end_at);
      if (e <= range.start || s >= range.end) return;
      const p1 = positionInRange(s, range), p2 = positionInRange(e, range);
      const rMid = (R_GOLD + R_BLUE) / 2;
      const pts = makeArcPoints(p1, p2, rMid, 48);
      scene.add(makeGlowLine(pts, white, 0.25));
      scene.add(makeGlowLine(pts, white, 0.6));
    });

    // Tick marks
    for (let i = 0; i < N; i++) {
      const a = fracToAngle(i / N);
      const r1 = R_GOLD + 0.04, r2 = R_GOLD + (i % 6 === 0 ? 0.12 : 0.07);
      const pts = [
        new THREE.Vector3(r1 * Math.cos(a), r1 * Math.sin(a), 0),
        new THREE.Vector3(r2 * Math.cos(a), r2 * Math.sin(a), 0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: white, transparent: true, opacity: i % 6 === 0 ? 0.4 : 0.18,
      })));
    }

    // Now dots
    if (nowFrac != null) {
      const ga = fracToAngle(nowFrac), ba = fracToAngle(nowFrac);
      const gDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.028, 16),
        new THREE.MeshBasicMaterial({ color: gold })
      );
      gDot.position.set(R_GOLD * Math.cos(ga), R_GOLD * Math.sin(ga), 0.01);
      scene.add(gDot);

      const bDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.022, 16),
        new THREE.MeshBasicMaterial({ color: blue })
      );
      bDot.position.set(R_BLUE * Math.cos(ba), R_BLUE * Math.sin(ba), 0.01);
      scene.add(bDot);
    }

    // Center disk
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(R_CENTER, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#08061a') })
    );
    scene.add(disk);

    // Center rim
    scene.add(makeGlowLine(makeArcPoints(0, 1, R_CENTER, 128), white, 0.22));

    // Shimmer
    const shim = new THREE.Mesh(
      new THREE.CircleGeometry(R_CENTER * 0.42, 32),
      new THREE.MeshBasicMaterial({ color: white, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending })
    );
    shim.position.set(-R_CENTER * 0.2, R_CENTER * 0.28, 0.01);
    shim.scale.set(1, 0.55, 1);
    scene.add(shim);

    renderer.render(scene, camera);
    gl.endFrameEXP();
  }, [nowFrac, tasks, range]);

  // Hour label positions
  const hourLabels = useMemo(() => {
    const half = size / 2;
    const rPx = half * R_GOLD;
    return Array.from({ length: N / 2 }, (_, i) => {
      const hr = i * 2;
      const a = fracToAngle((hr + 0.5) / N);
      const lr = rPx + 24;
      return { hr, x: half + lr * Math.cos(a), y: half + lr * Math.sin(a), big: hr % 6 === 0 };
    });
  }, [size]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

      {hourLabels.map(l => (
        <Text key={l.hr} style={[styles.hour, { left: l.x - 14, top: l.y - 9 }, l.big ? styles.hourBig : styles.hourSm]}>
          {l.hr}
        </Text>
      ))}

      <View style={[styles.centerWrap, { top: size / 2 - 24, width: size }]}>
        <Text style={styles.centerTitle}>{range.label}</Text>
        <Text style={styles.centerSub}>{range.subLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  hour: { position: 'absolute', textAlign: 'center', width: 28 },
  hourBig: { fontSize: 11, fontWeight: '200', color: 'rgba(255,255,255,0.52)' },
  hourSm:  { fontSize: 9,  fontWeight: '200', color: 'rgba(255,255,255,0.22)' },
  centerWrap: { position: 'absolute', alignItems: 'center' },
  centerTitle: { fontSize: 26, fontWeight: '200', color: 'rgba(255,255,255,0.9)', letterSpacing: 3 },
  centerSub:   { fontSize: 10, fontWeight: '200', color: 'rgba(255,255,255,0.28)', letterSpacing: 1.5, marginTop: 5 },
});
