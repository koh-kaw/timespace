'use client'

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Stars, MeshTransmissionMaterial } from "@react-three/drei"
import * as THREE from "three"

const R_OUT = 2.8
const R_IN  = 2.55
const N = 24

function fracToAngle(f: number) {
  return f * Math.PI * 2 - Math.PI / 2
}

// 光る円弧ライン
function GlowArc({
  startFrac, endFrac, radius, color, opacity, lineWidth = 2,
}: {
  startFrac: number; endFrac: number; radius: number
  color: string; opacity: number; lineWidth?: number
}) {
  const geo = useMemo(() => {
    const segs = 200
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= segs; i++) {
      const f = startFrac + (i / segs) * (endFrac - startFrac)
      const a = fracToAngle(f)
      pts.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), 0))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [startFrac, endFrac, radius])

  return (
    <line geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </line>
  )
}

// 全円
function FullCircle({ radius, color, opacity }: { radius: number; color: string; opacity: number }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2
      pts.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), 0))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [radius])
  return (
    <line geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </line>
  )
}

function Scene() {
  const nowFrac = useMemo(() => {
    const n = new Date()
    return (n.getHours() * 60 + n.getMinutes()) / (24 * 60)
  }, [])

  // 経過時間の円弧（0 → nowFrac）
  // 外側: オレンジ/ゴールド（進捗）
  // 内側: ブルー（残り）

  const centerLabelTex = useMemo(() => {
    const DPR = window.devicePixelRatio || 2
    const W = 512 * DPR, H = 256 * DPR
    const cvs = document.createElement("canvas")
    cvs.width = W; cvs.height = H
    const c = cvs.getContext("2d")!
    c.scale(DPR, DPR)
    c.clearRect(0, 0, 512, 256)
    c.font = "300 72px -apple-system, 'Helvetica Neue', sans-serif"
    c.fillStyle = "rgba(255,255,255,0.88)"
    c.textAlign = "center"; c.textBaseline = "middle"
    c.fillText("1日", 256, 90)
    c.font = "200 30px -apple-system, 'Helvetica Neue', sans-serif"
    c.fillStyle = "rgba(255,255,255,0.32)"
    c.fillText("2026 / 5 / 29", 256, 170)
    const tex = new THREE.CanvasTexture(cvs)
    tex.anisotropy = 16
    return tex
  }, [])

  // Hour tick marks
  const ticksGeo = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < N; i++) {
      const a = fracToAngle(i / N)
      const r1 = R_OUT + 0.06
      const r2 = R_OUT + (i % 6 === 0 ? 0.22 : 0.12)
      pts.push(r1 * Math.cos(a), r1 * Math.sin(a), 0)
      pts.push(r2 * Math.cos(a), r2 * Math.sin(a), 0)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])

  // Hour number sprites
  const hourSprites = useMemo(() => {
    return Array.from({ length: N / 2 }, (_, i) => {
      const hr = i * 2
      const DPR = window.devicePixelRatio || 2
      const SZ = 80 * DPR
      const cvs = document.createElement("canvas")
      cvs.width = SZ; cvs.height = SZ
      const c = cvs.getContext("2d")!
      c.scale(DPR, DPR)
      c.font = `200 ${hr % 6 === 0 ? 28 : 22}px -apple-system, 'Helvetica Neue', sans-serif`
      c.fillStyle = hr % 6 === 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)"
      c.textAlign = "center"; c.textBaseline = "middle"
      c.fillText(String(hr), 40, 40)
      const tex = new THREE.CanvasTexture(cvs)
      tex.anisotropy = 8
      const a = fracToAngle((hr + 0.5) / N)
      return { tex, a }
    })
  }, [])

  return (
    <>
      {/* ── 外側円弧: 経過（ゴールド） */}
      <GlowArc startFrac={0} endFrac={nowFrac} radius={R_OUT} color="#E8C56A" opacity={0.95} />
      {/* グロー（太め半透明） */}
      <GlowArc startFrac={0} endFrac={nowFrac} radius={R_OUT + 0.01} color="#E8C56A" opacity={0.25} />
      <GlowArc startFrac={0} endFrac={nowFrac} radius={R_OUT - 0.01} color="#E8C56A" opacity={0.25} />

      {/* ── 内側円弧: 残り（ブルー） */}
      <GlowArc startFrac={nowFrac} endFrac={1} radius={R_IN} color="#5A9BE8" opacity={0.92} />
      <GlowArc startFrac={nowFrac} endFrac={1} radius={R_IN + 0.01} color="#5A9BE8" opacity={0.22} />
      <GlowArc startFrac={nowFrac} endFrac={1} radius={R_IN - 0.01} color="#5A9BE8" opacity={0.22} />

      {/* ── ベース円（薄い全円） */}
      <FullCircle radius={R_OUT} color="white" opacity={0.06} />
      <FullCircle radius={R_IN}  color="white" opacity={0.05} />

      {/* ── 中間の薄い円（ガイドリング） */}
      <FullCircle radius={(R_OUT + R_IN) / 2} color="white" opacity={0.03} />

      {/* ── Tick marks */}
      <lineSegments geometry={ticksGeo}>
        <lineBasicMaterial color="white" transparent opacity={0.2} depthWrite={false} />
      </lineSegments>

      {/* ── Hour labels */}
      {hourSprites.map((sp, i) => {
        const lr = R_OUT + 0.45
        return (
          <sprite key={i} position={[lr * Math.cos(sp.a), lr * Math.sin(sp.a), 0]} scale={[0.38, 0.38, 1]}>
            <spriteMaterial map={sp.tex} transparent depthWrite={false} />
          </sprite>
        )
      })}

      {/* ── Now dot: 交点（ゴールドとブルーの分岐点） */}
      <mesh position={[R_OUT * Math.cos(fracToAngle(nowFrac)), R_OUT * Math.sin(fracToAngle(nowFrac)), 0.02]}>
        <circleGeometry args={[0.055, 24]} />
        <meshBasicMaterial color="#FFD580" />
      </mesh>
      <mesh position={[R_IN * Math.cos(fracToAngle(nowFrac)), R_IN * Math.sin(fracToAngle(nowFrac)), 0.02]}>
        <circleGeometry args={[0.045, 24]} />
        <meshBasicMaterial color="#5A9BE8" />
      </mesh>

      {/* ── Center glass sphere */}
      <mesh>
        <sphereGeometry args={[R_IN * 0.55, 64, 64]} />
        <MeshTransmissionMaterial
          ior={1.25}
          thickness={0.6}
          chromaticAberration={0.015}
          roughness={0.05}
          distortion={0.1}
          distortionScale={0.08}
          temporalDistortion={0}
          transmission={0.97}
          color="#ffffff"
          backside
        />
      </mesh>

      {/* Center label */}
      <sprite position={[0, 0, R_IN * 0.6]} scale={[2.2, 1.1, 1]}>
        <spriteMaterial map={centerLabelTex} transparent depthWrite={false} />
      </sprite>
    </>
  )
}

export default function Page() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000008", position: "relative" }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 9.2], fov: 46 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#000008"]} />

        <ambientLight intensity={0.1} />
        <directionalLight position={[-3, 5, 4]} intensity={2.0} color="#aaaaff" />
        <pointLight position={[3, -2, 3]} intensity={1.0} color="#ffffff" distance={15} />

        <Stars radius={250} depth={80} count={8000} factor={5} saturation={0.6} fade speed={0} />

        <Scene />
      </Canvas>

      {/* UI */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "36px 32px 0", pointerEvents: "all" }}>
          <button style={btnStyle}>↑ 上へ</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 300, color: "rgba(255,255,255,0.8)", letterSpacing: 2 }}>1日</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 3, letterSpacing: 2 }}>2026 / 5 / 29</div>
          </div>
          <button style={btnStyle}>下へ ↓</button>
        </div>
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-around", padding: "10px 0 32px", borderTop: "0.5px solid rgba(255,255,255,0.05)", background: "rgba(0,0,8,0.8)", backdropFilter: "blur(20px)", pointerEvents: "all" }}>
          {[["🎯", "目標"], ["⚙", "設定"]].map(([icon, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 36px", cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", letterSpacing: 1 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 20,
  background: "rgba(255,255,255,0.05)",
  border: "0.5px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.55)", fontSize: 12,
  fontFamily: "inherit", fontWeight: 300, cursor: "pointer",
  letterSpacing: 1,
}
