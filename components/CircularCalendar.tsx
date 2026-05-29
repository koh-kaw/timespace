import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
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
const R_GOLD = 1.0;
const R_BLUE = 0.82;
const R_CENTER = 0.24;

function fracToAngle(f: number) {
  return f * Math.PI * 2 - Math.PI / 2;
}

function makeArcPoints(
  startFrac: number,
  endFrac: number,
  radius: number,
  segs = 180
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const f = startFrac + (i / segs) * (endFrac - startFrac);
    const a = fracToAngle(f);
    pts.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), 0));
  }
  return pts;
}

function makeGlowLine(
  pts: THREE.Vector3[],
  color: THREE.Color,
  opacity: number
): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.Line(geo, mat);
}

function makeFullCircle(radius: number, color: THREE.Color, opacity: number): THREE.Line {
  return makeGlowLine(makeArcPoints(0, 1, radius, 256), color, opacity);
}

function positionInRange(date: Date, range: ScaleRange): number {
  const total = range.end.getTime() - range.start.getTime();
  const pos = date.getTime() - range.start.getTime();
  return Math.max(0, Math.min(1, pos / total));
}

export function CircularCalendar({ size, range, tasks, selectedSlice, onSlicePress, onTaskPress }: Props) {
  const nowFrac = useMemo(() => {
    const now = new Date();
    if (now < range.start || now > range.end) return null;
    return (now.getTime() - range.start.getTime()) /
      (range.end.getTime() - range.start.getTime());
  }, [range]);

  const onContextCreate = useCallback(async (gl: any) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000008, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.4, 1.4, 1.4, -1.4, 0.1, 100);
    camera.position.z = 5;

    const gold = new THREE.Color('#E8C56A');
    const blue = new THREE.Color('#5A9BE8');
    const white = new THREE.Color('#ffffff');

    // ── Base guide circles ──
    scene.add(makeFullCircle(R_GOLD, white, 0.06));
    scene.add(makeFullCircle(R_BLUE, white, 0.05));

    // ── Gold arc (elapsed) ──
    if (nowFrac != null && nowFrac > 0) {
      const pts = makeArcPoints(0, nowFrac, R_GOLD);
      scene.add(makeGlowLine(pts, gold, 0.2));   // outer glow
      scene.add(makeGlowLine(pts, gold, 0.4));   // mid glow
      scene.add(makeGlowLine(pts, gold, 1.0));   // core
    }

    // ── Blue arc (remaining) ──
    const blueStart = nowFrac ?? 0;
    if (blueStart < 1) {
      const pts = makeArcPoints(blueStart, 1, R_BLUE);
      scene.add(makeGlowLine(pts, blue, 0.2));
      scene.add(makeGlowLine(pts, blue, 0.4));
      scene.add(makeGlowLine(pts, blue, 1.0));
    }

    // ── Tick marks ──
    for (let i = 0; i < N; i++) {
      const a = fracToAngle(i / N);
      const r1 = R_GOLD + 0.04;
      const r2 = R_GOLD + (i % 6 === 0 ? 0.12 : 0.07);
      const pts = [
        new THREE.Vector3(r1 * Math.cos(a), r1 * Math.sin(a), 0),
        new THREE.Vector3(r2 * Math.cos(a), r2 * Math.sin(a), 0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: white,
        transparent: true,
        opacity: i % 6 === 0 ? 0.35 : 0.15,
      });
      scene.add(new THREE.Line(geo, mat));
    }

    // ── Now dots ──
    if (nowFrac != null) {
      const goldA = fracToAngle(nowFrac);
      const blueA = fracToAngle(nowFrac);

      const dotGeo = new THREE.CircleGeometry(0.025, 16);

      const goldDot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: gold }));
      goldDot.position.set(R_GOLD * Math.cos(goldA), R_GOLD * Math.sin(goldA), 0.01);
      scene.add(goldDot);

      const blueDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.02, 16),
        new THREE.MeshBasicMaterial({ color: blue })
      );
      blueDot.position.set(R_BLUE * Math.cos(blueA), R_BLUE * Math.sin(blueA), 0.01);
      scene.add(blueDot);
    }

    // ── Task arcs ──
    tasks.forEach(task => {
      const start = new Date(task.start_at);
      const end = new Date(task.end_at);
      if (end <= range.start || start >= range.end) return;
      const p1 = positionInRange(start, range);
      const p2 = positionInRange(end, range);
      const rMid = (R_GOLD + R_BLUE) / 2;
      const pts = makeArcPoints(p1, p2, rMid, 48);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: white, transparent: true, opacity: 0.5 });
      scene.add(new THREE.Line(geo, mat));
    });

    // ── Center glass disk ──
    // Dark base
    const diskGeo = new THREE.CircleGeometry(R_CENTER, 64);
    const diskMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#0e0c23'),
      transparent: true,
      opacity: 0.92,
    });
    scene.add(new THREE.Mesh(diskGeo, diskMat));

    // Rim
    const rimPts = makeArcPoints(0, 1, R_CENTER, 128);
    scene.add(makeGlowLine(rimPts, white, 0.2));

    // Shimmer highlight
    const shimGeo = new THREE.CircleGeometry(R_CENTER * 0.45, 32);
    const shimMat = new THREE.MeshBasicMaterial({
      color: white,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
    });
    const shim = new THREE.Mesh(shimGeo, shimMat);
    shim.position.set(-R_CENTER * 0.2, R_CENTER * 0.28, 0.01);
    shim.scale.set(1, 0.5, 1);
    scene.add(shim);

    renderer.render(scene, camera);
    gl.endFrameEXP();
  }, [nowFrac, tasks, range]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

      {/* Hour labels (native Text — crisp on any DPR) */}
      {Array.from({ length: N / 2 }, (_, i) => {
        const hr = i * 2;
        const a = fracToAngle((hr + 0.5) / N);
        const lr = size / 2 * (1 + (R_GOLD + 0.22));
        const x = size / 2 + lr * Math.cos(a) - 12;
        const y = size / 2 + lr * Math.sin(a) - 8;
        return (
          <Text
            key={hr}
            style={[
              styles.hourLabel,
              { left: x, top: y },
              hr % 6 === 0 ? styles.hourLabelBig : styles.hourLabelSmall,
            ]}
          >
            {hr}
          </Text>
        );
      })}

      {/* Center label */}
      <View style={[styles.centerLabel, { width: size, top: size / 2 - 20 }]}>
        <Text style={styles.centerTitle}>{range.label}</Text>
        <Text style={styles.centerSub}>{range.subLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  hourLabel: {
    position: 'absolute',
    textAlign: 'center',
    width: 24,
  },
  hourLabelBig: {
    fontSize: 11,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.5)',
  },
  hourLabelSmall: {
    fontSize: 9,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.22)',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerTitle: {
    fontSize: 22,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 2,
  },
  centerSub: {
    fontSize: 10,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 1,
    marginTop: 4,
  },
});
