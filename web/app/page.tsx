'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Sparkles, MeshTransmissionMaterial, Float, Text } from '@react-three/drei'
import { useRef, useMemo, useCallback } from 'react'
import * as THREE from 'three'

// ─── Constants ───────────────────────────────────────────────
const N = 24
const R_OUT = 2.8
const R_IN = 0.85
const TASKS = [
  { start: 8 / 24, end: 9 / 24, label: '掃除' },
  { start: 13 / 24, end: 14.5 / 24, label: '会議' },
  { start: 19 / 24, end: 20 / 24, label: '筋トレ' },
]

// ─── Helpers ─────────────────────────────────────────────────
function fracToAngle(frac: number) {
  // 0 = top (12 o'clock), clockwise
  return frac * Math.PI * 2 - Math.PI / 2
}

function buildArcShape(a1: number, a2: number, rO: number, rI: number) {
  const shape = new THREE.Shape()
  const segs = Math.max(12, Math.ceil(((a2 - a1) / (Math.PI * 2)) * 72))
  for (let j = 0; j <= segs; j++) {
    const a = a1 + (j / segs) * (a2 - a1)
    const x = rO * Math.cos(a), y = rO * Math.sin(a)
    j === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  }
  for (let j = segs; j >= 0; j--) {
    const a = a1 + (j / segs) * (a2 - a1)
    shape.lineTo(rI * Math.cos(a), rI * Math.sin(a))
  }
  shape.closePath()
  return shape
}

// ─── Glass Ring ───────────────────────────────────────────────
function GlassRing() {
  const ref = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.position.y = Math.sin(t * 0.38) * 0.06
    ref.current.rotation.z = Math.sin(t * 0.22) * 0.008
  })

  const nowFrac = useMemo(() => {
    const n = new Date()
    return (n.getHours() * 60 + n.getMinutes()) / (24 * 60)
  }, [])

  const nowAngle = fracToAngle(nowFrac)

  // Torus geometry for the glass ring
  const midR = (R_OUT + R_IN) / 2
  const tubeR = (R_OUT - R_IN) / 2

  return (
    <group ref={ref}>
      {/* ── Main glass torus ── */}
      <Float speed={0.6} rotationIntensity={0} floatIntensity={0}>
        <mesh castShadow>
          <torusGeometry args={[midR, tubeR, 32, 160]} />
          <MeshTransmissionMaterial
            ior={1.28}
            thickness={0.5}
            chromaticAberration={0.015}
            roughness={0.08}
            anisotropicBlur={0.1}
            distortion={0.12}
            distortionScale={0.1}
            temporalDistortion={0.06}
            transmission={0.96}
            color="#ffffff"
            backside
          />
        </mesh>
      </Float>

      {/* ── Top highlight shimmer ── */}
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[R_IN, R_OUT, 64, 1, -Math.PI / 2 - Math.PI / 3, (Math.PI * 2) / 3]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.07}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Slice dividers ── */}
      {Array.from({ length: N }, (_, i) => {
        const a = fracToAngle(i / N)
        return (
          <line key={i}>
            <bufferGeometry
              ref={(geo) => {
                if (!geo) return
                const pts = new Float32Array([
                  R_IN * Math.cos(a), R_IN * Math.sin(a), 0.02,
                  R_OUT * Math.cos(a), R_OUT * Math.sin(a), 0.02,
                ])
                geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
              }}
            />
            <lineBasicMaterial color="white" transparent opacity={0.08} depthWrite={false} />
          </line>
        )
      })}

      {/* ── Hour labels ── */}
      {Array.from({ length: N }, (_, i) => {
        if (i % 2 !== 0) return null
        const a = fracToAngle((i + 0.5) / N)
        const lr = R_OUT + 0.38
        return (
          <Text
            key={i}
            position={[lr * Math.cos(a), lr * Math.sin(a), 0]}
            fontSize={0.18}
            color="rgba(255,255,255,0.35)"
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6z9mXgjU0.woff2"
          >
            {String(i)}
          </Text>
        )
      })}

      {/* ── Task arcs ── */}
      {TASKS.map((task, idx) => {
        const a1 = fracToAngle(task.start)
        const a2 = fracToAngle(task.end)
        const midA = (a1 + a2) / 2
        const midR2 = (R_OUT + R_IN) / 2
        const geo = new THREE.ShapeGeometry(buildArcShape(a1, a2, R_OUT, R_IN))
        return (
          <group key={idx}>
            {/* Glow */}
            <mesh geometry={new THREE.ShapeGeometry(buildArcShape(a1, a2, R_OUT + 0.15, R_IN - 0.15))} position={[0, 0, 0.005]}>
              <meshBasicMaterial color="white" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
            </mesh>
            {/* Main arc */}
            <mesh geometry={geo} position={[0, 0, 0.02]}>
              <meshBasicMaterial color="white" transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* Edge */}
            <mesh geometry={geo} position={[0, 0, 0.022]}>
              <meshBasicMaterial color="white" transparent opacity={0.4} depthWrite={false} wireframe={false} side={THREE.DoubleSide} />
            </mesh>
            {/* Label */}
            <Text
              position={[midR2 * Math.cos(midA), midR2 * Math.sin(midA), 0.08]}
              fontSize={0.2}
              color="rgba(255,255,255,0.88)"
              anchorX="center"
              anchorY="middle"
            >
              {task.label}
            </Text>
          </group>
        )
      })}

      {/* ── Now indicator ── */}
      <group>
        {/* Line */}
        <line>
          <bufferGeometry
            ref={(geo) => {
              if (!geo) return
              const pts = new Float32Array([
                R_IN * Math.cos(nowAngle), R_IN * Math.sin(nowAngle), 0.1,
                R_OUT * Math.cos(nowAngle), R_OUT * Math.sin(nowAngle), 0.1,
              ])
              geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
            }}
          />
          <lineBasicMaterial color="#FF6B9D" linewidth={2} />
        </line>
        {/* Dot */}
        <mesh position={[R_OUT * Math.cos(nowAngle), R_OUT * Math.sin(nowAngle), 0.12]}>
          <circleGeometry args={[0.06, 16]} />
          <meshBasicMaterial color="#FF6B9D" />
        </mesh>
        {/* Glow */}
        <pointLight
          position={[R_OUT * Math.cos(nowAngle) * 0.8, R_OUT * Math.sin(nowAngle) * 0.8, 1]}
          color="#FF6B9D"
          intensity={1.5}
          distance={3}
        />
      </group>

      {/* ── Center glass disk ── */}
      <Float speed={0.5} rotationIntensity={0} floatIntensity={0}>
        <mesh castShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[R_IN * 0.94, R_IN * 0.94, 0.22, 64]} rotation={[Math.PI / 2, 0, 0]} />
          <MeshTransmissionMaterial
            ior={1.4}
            thickness={0.4}
            chromaticAberration={0.02}
            roughness={0.04}
            distortion={0.08}
            distortionScale={0.08}
            temporalDistortion={0.04}
            transmission={0.9}
            color="#ccccff"
            backside
          />
        </mesh>
      </Float>

      {/* Center labels */}
      <Text
        position={[0, 0.12, 0.25]}
        fontSize={0.28}
        color="rgba(255,255,255,0.9)"
        anchorX="center"
        anchorY="middle"
        fontWeight={500}
      >
        1日
      </Text>
      <Text
        position={[0, -0.22, 0.25]}
        fontSize={0.16}
        color="rgba(255,255,255,0.3)"
        anchorX="center"
        anchorY="middle"
      >
        2026/5/29
      </Text>
    </group>
  )
}

// ─── UI Overlay ───────────────────────────────────────────────
function UI() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM Sans:wght@200;300;400;500;600&display=swap" rel="stylesheet" />

      {/* Zoom bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '56px 28px 0', pointerEvents: 'all' }}>
        <button style={btnStyle}>↑ 上へ</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>1日</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 3, letterSpacing: 1 }}>2026 / 5 / 29</div>
        </div>
        <button style={btnStyle}>下へ ↓</button>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        display: 'flex', justifyContent: 'space-around',
        padding: '12px 0 32px',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        background: 'rgba(4,3,12,0.75)',
        backdropFilter: 'blur(20px)',
        pointerEvents: 'all',
      }}>
        {[['🎯', '目標'], ['⚙', '設定']].map(([icon, label]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 36px', cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 20,
  background: 'rgba(255,255,255,0.06)',
  border: '0.5px solid rgba(255,255,255,0.13)',
  color: 'rgba(255,255,255,0.65)', fontSize: 12,
  fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer',
  backdropFilter: 'blur(16px)',
}

// ─── Page ─────────────────────────────────────────────────────
export default function Page() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#04030c' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        shadows
      >
        <color attach="background" args={['#04030c']} />

        {/* Lights */}
        <ambientLight intensity={0.15} />
        <directionalLight position={[-4, 6, 5]} intensity={2.8} color="#c0b0ff" castShadow />
        <directionalLight position={[5, -3, -2]} intensity={1.2} color="#8888ff" />
        <pointLight position={[-5, 3, 4]} intensity={1.6} color="#6655cc" distance={18} />

        {/* Stars */}
        <Stars radius={180} depth={80} count={5000} factor={6} saturation={0.8} fade speed={0.3} />

        {/* Sparkles */}
        <Sparkles
          count={180}
          scale={[28, 28, 28]}
          size={3.5}
          speed={0.2}
          noise={0.3}
          color="white"
        />

        {/* Glass Calendar Ring */}
        <GlassRing />
      </Canvas>

      <UI />
    </div>
  )
}
