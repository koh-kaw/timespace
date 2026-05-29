'use client'

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Stars, Sparkles, MeshTransmissionMaterial, Float } from "@react-three/drei"
import * as THREE from "three"

const N = 24
const R_OUT = 2.6
const R_IN = 0.78
const TASKS = [
  { s: 8 / 24, e: 9 / 24, label: "掃除" },
  { s: 13 / 24, e: 14.5 / 24, label: "会議" },
  { s: 19 / 24, e: 20 / 24, label: "筋トレ" },
]

function fracToAngle(f: number) {
  return f * Math.PI * 2 - Math.PI / 2
}

function buildArcGeo(a1: number, a2: number, rO: number, rI: number) {
  const segs = Math.max(16, Math.ceil(((a2 - a1) / (Math.PI * 2)) * 96))
  const verts: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= segs; j++) {
    const a = a1 + (j / segs) * (a2 - a1)
    verts.push(rO * Math.cos(a), rO * Math.sin(a), 0)
    verts.push(rI * Math.cos(a), rI * Math.sin(a), 0)
  }
  for (let j = 0; j < segs; j++) {
    const b = j * 2
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function NowPulse({ nowA }: { nowA: number }) {
  const ref = useRef<THREE.PointLight>(null!)
  useFrame((s) => {
    ref.current.intensity = 2.0 + Math.sin(s.clock.elapsedTime * 2.5) * 0.7
  })
  return (
    <pointLight
      ref={ref}
      position={[R_OUT * Math.cos(nowA) * 0.7, R_OUT * Math.sin(nowA) * 0.7, 1.8]}
      color="#FF6B9D"
      distance={6}
    />
  )
}

function GlassRing() {
  const groupRef = useRef<THREE.Group>(null!)

  const nowFrac = useMemo(() => {
    const n = new Date()
    return (n.getHours() * 60 + n.getMinutes()) / (24 * 60)
  }, [])
  const nowA = fracToAngle(nowFrac)
  const nowIdx = Math.floor(nowFrac * N)
  const midR = (R_OUT + R_IN) / 2
  const tubeR = (R_OUT - R_IN) / 2

  useFrame((s) => {
    const t = s.clock.elapsedTime
    groupRef.current.position.y = Math.sin(t * 0.4) * 0.07
    groupRef.current.rotation.z = Math.sin(t * 0.25) * 0.009
  })

  // Divider lines geometry
  const dividersGeo = useMemo(() => {
    const verts: number[] = []
    for (let i = 0; i < N; i++) {
      const a = fracToAngle(i / N)
      verts.push(R_IN * Math.cos(a), R_IN * Math.sin(a), 0.01)
      verts.push(R_OUT * Math.cos(a), R_OUT * Math.sin(a), 0.01)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3))
    return geo
  }, [])

  // Now slice
  const nowSliceGeo = useMemo(() => {
    const a1 = fracToAngle(nowIdx / N)
    const a2 = fracToAngle((nowIdx + 1) / N)
    return buildArcGeo(a1, a2, R_OUT, R_IN)
  }, [nowIdx])

  // Now line geometry
  const nowLineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute([
      R_IN * Math.cos(nowA), R_IN * Math.sin(nowA), 0.12,
      R_OUT * Math.cos(nowA), R_OUT * Math.sin(nowA), 0.12,
    ], 3))
    return geo
  }, [nowA])

  // Task arcs
  const taskGeos = useMemo(() => TASKS.map(tk => {
    const a1 = fracToAngle(tk.s)
    const a2 = fracToAngle(tk.e)
    return {
      a1, a2,
      midA: (a1 + a2) / 2,
      label: tk.label,
      geo: buildArcGeo(a1, a2, R_OUT, R_IN),
      glowGeo: buildArcGeo(a1, a2, R_OUT + 0.1, R_IN - 0.1),
    }
  }), [])

  // Label sprites (canvas texture — no font loading needed)
  const labelSprites = useMemo(() => {
    return taskGeos.map(tk => {
      const cvs = document.createElement("canvas")
      cvs.width = 128; cvs.height = 64
      const c = cvs.getContext("2d")!
      c.font = "500 28px sans-serif"
      c.fillStyle = "rgba(255,255,255,0.88)"
      c.textAlign = "center"; c.textBaseline = "middle"
      c.fillText(tk.label, 64, 32)
      const tex = new THREE.CanvasTexture(cvs)
      return { tex, midA: tk.midA }
    })
  }, [taskGeos])

  const hourSprites = useMemo(() => {
    return Array.from({ length: N / 2 }, (_, i) => {
      const idx2 = i * 2
      const cvs = document.createElement("canvas")
      cvs.width = 64; cvs.height = 64
      const c = cvs.getContext("2d")!
      c.font = "300 22px sans-serif"
      c.fillStyle = "rgba(255,255,255,0.3)"
      c.textAlign = "center"; c.textBaseline = "middle"
      c.fillText(String(idx2), 32, 32)
      const tex = new THREE.CanvasTexture(cvs)
      const a = fracToAngle((idx2 + 0.5) / N)
      return { tex, a }
    })
  }, [])

  const centerLabelTex = useMemo(() => {
    const cvs = document.createElement("canvas")
    cvs.width = 256; cvs.height = 128
    const c = cvs.getContext("2d")!
    c.font = "500 52px sans-serif"
    c.fillStyle = "rgba(255,255,255,0.9)"
    c.textAlign = "center"; c.textBaseline = "middle"
    c.fillText("1日", 128, 42)
    c.font = "300 24px sans-serif"
    c.fillStyle = "rgba(255,255,255,0.3)"
    c.fillText("2026/5/29", 128, 90)
    return new THREE.CanvasTexture(cvs)
  }, [])

  return (
    <group ref={groupRef}>
      {/* ── Glass torus ── */}
      <mesh castShadow>
        <torusGeometry args={[midR, tubeR, 48, 200]} />
        <MeshTransmissionMaterial
          ior={1.25}
          thickness={0.55}
          chromaticAberration={0.018}
          roughness={0.06}
          anisotropicBlur={0.1}
          distortion={0.14}
          distortionScale={0.11}
          temporalDistortion={0.07}
          transmission={0.97}
          color="#ffffff"
          backside
        />
      </mesh>

      {/* Top highlight shimmer */}
      <mesh rotation={[0, 0, Math.PI * 0.38]}>
        <torusGeometry args={[midR, tubeR * 0.22, 8, 60, Math.PI * 0.55]} />
        <meshBasicMaterial color="white" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Slice dividers (all as one LineSegments) ── */}
      <lineSegments geometry={dividersGeo}>
        <lineBasicMaterial color="white" transparent opacity={0.07} depthWrite={false} />
      </lineSegments>

      {/* Now slice */}
      <mesh geometry={nowSliceGeo} position={[0, 0, 0.005]}>
        <meshBasicMaterial color="#FF6B9D" transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Task arcs ── */}
      {taskGeos.map((tk, i) => (
        <group key={i}>
          <mesh geometry={tk.glowGeo} position={[0, 0, 0.003]}>
            <meshBasicMaterial color="white" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={tk.geo} position={[0, 0, 0.015]}>
            <meshStandardMaterial color="white" transparent opacity={0.18} depthWrite={false} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Task labels (canvas sprites) */}
      {labelSprites.map((sp, i) => (
        <sprite key={i} position={[midR * Math.cos(sp.midA), midR * Math.sin(sp.midA), 0.1]} scale={[0.8, 0.4, 1]}>
          <spriteMaterial map={sp.tex} transparent depthWrite={false} />
        </sprite>
      ))}

      {/* Hour labels */}
      {hourSprites.map((sp, i) => {
        const lr = R_OUT + 0.38
        return (
          <sprite key={i} position={[lr * Math.cos(sp.a), lr * Math.sin(sp.a), 0]} scale={[0.36, 0.36, 1]}>
            <spriteMaterial map={sp.tex} transparent depthWrite={false} />
          </sprite>
        )
      })}

      {/* ── Now line ── */}
      <line geometry={nowLineGeo}>
        <lineBasicMaterial color="#FF6B9D" />
      </line>
      <mesh position={[R_OUT * Math.cos(nowA), R_OUT * Math.sin(nowA), 0.14]}>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color="#FF6B9D" />
      </mesh>
      <NowPulse nowA={nowA} />

      {/* ── Center glass disk ── */}
      <Float speed={0.5} rotationIntensity={0} floatIntensity={0}>
        <mesh castShadow>
          <cylinderGeometry args={[R_IN * 0.93, R_IN * 0.93, 0.2, 80]} />
          <MeshTransmissionMaterial
            ior={1.4}
            thickness={0.35}
            chromaticAberration={0.02}
            roughness={0.04}
            distortion={0.07}
            distortionScale={0.07}
            temporalDistortion={0.04}
            transmission={0.92}
            color="#aaaaee"
            backside
          />
        </mesh>
      </Float>

      {/* Center shimmer */}
      <mesh position={[-R_IN * 0.2, R_IN * 0.26, 0.14]}>
        <circleGeometry args={[R_IN * 0.38, 32]} />
        <meshBasicMaterial color="white" transparent opacity={0.13} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Center label */}
      <sprite position={[0, 0, 0.22]} scale={[1.4, 0.7, 1]}>
        <spriteMaterial map={centerLabelTex} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

export default function Page() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#04030c", position: "relative" }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 7.8], fov: 42 }} gl={{ antialias: true }} shadows>
        <color attach="background" args={["#04030c"]} />
        <ambientLight intensity={0.12} />
        <directionalLight position={[-4, 6, 5]} intensity={3.2} color="#c0b0ff" castShadow />
        <directionalLight position={[5, -3, -2]} intensity={1.4} color="#9999ff" />
        <pointLight position={[-5, 3, 4]} intensity={2.0} color="#6655cc" distance={20} />
        <Stars radius={200} depth={80} count={6000} factor={6.5} saturation={0.7} fade speed={0.25} />
        <Sparkles count={200} scale={[30, 30, 30]} size={4} speed={0.18} noise={0.3} color="white" />
        <GlassRing />
      </Canvas>

      {/* UI overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "40px 28px 0", pointerEvents: "all" }}>
          <button style={btnStyle}>↑ 上へ</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: "#fff" }}>1日</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 3, letterSpacing: 1 }}>2026 / 5 / 29</div>
          </div>
          <button style={btnStyle}>下へ ↓</button>
        </div>
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-around", padding: "10px 0 32px", borderTop: "0.5px solid rgba(255,255,255,0.05)", background: "rgba(4,3,12,0.75)", backdropFilter: "blur(20px)", pointerEvents: "all" }}>
          {[["🎯", "目標"], ["⚙", "設定"]].map(([icon, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 36px", cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: "7px 16px", borderRadius: 20,
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(255,255,255,0.13)",
  color: "rgba(255,255,255,0.65)", fontSize: 12,
  fontFamily: "inherit", fontWeight: 500, cursor: "pointer",
}
