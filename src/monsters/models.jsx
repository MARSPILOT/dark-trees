import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { P, Eyes, attackCurve, Wing } from './parts'
import { heightAt, waterLevelAt } from '../world/terrain'

// =====================================================================================
// Four-legged beasts: wolves, boars, deer, goats, the cow, the hound, the squirrel...
// Model faces +Z, origin at the feet. Roughly 2 units long in "unit" scale.
// =====================================================================================
export function Quadruped({ m, o }) {
  const {
    body = '#666',
    belly,
    legC,
    headC,
    hornC = '#e8e0cc',
    eye = '#ff3b1f',
    bodyLen = 1.6,
    bodyW = 0.72,
    bodyH = 0.78,
    legLen = 0.8,
    legW = 0.18,
    neck = 0.35,
    headLen = 0.6,
    headW = 0.38,
    snout = 0.32,
    horns = null,
    hornSize = 1,
    ears = 'point',
    tail = 'thin',
    tusks = false,
    bristles = null,
    bristleGlow = null,
    beard = false,
    udder = null,
    armor = false,
    spirit = null,
    antlerGlow = null,
  } = o
  const sp = spirit ? { o: 0.5, e: spirit, ei: 0.9 } : {}
  const legs = [useRef(), useRef(), useRef(), useRef()]
  const head = useRef()
  const tailR = useRef()
  const torso = useRef()
  const yc = legLen + bodyH * 0.5
  const headBase = [0, yc + bodyH * 0.3, bodyLen * 0.42]

  useFrame((state) => {
    const ph = m.animT
    const amp = Math.min(1, m.speedNow / 2.5) * 0.75
    const offs = [0, Math.PI, Math.PI, 0]
    for (let i = 0; i < 4; i++) if (legs[i].current) legs[i].current.rotation.x = Math.sin(ph + offs[i]) * amp
    const lunge = attackCurve(m)
    if (torso.current) {
      torso.current.position.y = Math.abs(Math.sin(ph)) * 0.06 * amp
      torso.current.rotation.x = lunge * 0.18
    }
    if (head.current) {
      head.current.rotation.x = 0.1 + lunge * 0.7 + Math.sin(ph * 0.5) * 0.05
      head.current.position.z = headBase[2] + lunge * 0.3
    }
    if (tailR.current) tailR.current.rotation.y = Math.sin(state.clock.elapsedTime * 6 + m.seed) * 0.35
  })

  const legPos = [
    [bodyW * 0.32, bodyLen * 0.33],
    [-bodyW * 0.32, bodyLen * 0.33],
    [bodyW * 0.32, -bodyLen * 0.33],
    [-bodyW * 0.32, -bodyLen * 0.33],
  ]

  return (
    <group ref={torso}>
      {/* body */}
      <P g="sph" a={[1, 9, 7]} c={body} {...sp} position={[0, yc, 0]} scale={[bodyW / 2, bodyH / 2, bodyLen / 2]} />
      {belly && (
        <P g="sph" a={[1, 8, 6]} c={belly} {...sp} position={[0, yc - bodyH * 0.18, 0.05]} scale={[bodyW * 0.42, bodyH * 0.35, bodyLen * 0.42]} />
      )}
      {udder && <P g="sph" a={[0.16, 7, 6]} c={udder} position={[0, legLen - 0.02, -bodyLen * 0.18]} />}
      {armor && (
        <group position={[0, yc + bodyH * 0.38, 0]}>
          <P g="box" a={[bodyW * 1.02, 0.12, bodyLen * 0.6]} c="#6d6f75" metal={0.6} rough={0.4} />
          {[-0.2, 0, 0.2].map((z, i) => (
            <P key={i} g="sph" a={[0.05, 5, 4]} c="#c9a54a" metal={0.8} position={[0, 0.08, z * bodyLen]} />
          ))}
        </group>
      )}
      {/* spine bristles */}
      {bristles &&
        Array.from({ length: 7 }, (_, i) => {
          const t = i / 6
          return (
            <P
              key={i}
              g="cone"
              a={[0.07, 0.32 - Math.abs(t - 0.4) * 0.2, 4]}
              c={bristles}
              e={bristleGlow}
              ei={bristleGlow ? 2.2 : 1}
              position={[0, yc + bodyH * 0.48, (0.42 - t * 0.8) * bodyLen]}
              rotation-x={-0.35}
            />
          )
        })}
      {/* legs */}
      {legPos.map(([x, z], i) => (
        <group key={i} ref={legs[i]} position={[x, legLen + 0.05, z]}>
          <P g="box" a={[legW, legLen + 0.1, legW]} c={legC || body} {...sp} position={[0, -legLen / 2, 0]} />
          <P g="box" a={[legW * 1.1, 0.1, legW * 1.3]} c="#2a2420" position={[0, -legLen + 0.02, 0.02]} />
        </group>
      ))}
      {/* head */}
      <group ref={head} position={headBase}>
        <P g="box" a={[headW * 0.75, neck + 0.1, headW * 0.75]} c={body} {...sp} position={[0, neck * 0.35, neck * 0.25]} rotation-x={0.6} />
        <group position={[0, neck * 0.65, neck * 0.55 + headLen * 0.35]}>
          <P g="box" a={[headW, headW * 0.85, headLen]} c={headC || body} {...sp} />
          <P g="box" a={[headW * 0.66, headW * 0.5, snout]} c={headC || body} {...sp} position={[0, -headW * 0.15, headLen / 2 + snout / 2 - 0.02]} />
          <P g="box" a={[headW * 0.3, headW * 0.2, 0.05]} c="#1a1512" position={[0, -headW * 0.1, headLen / 2 + snout]} />
          <Eyes x={headW * 0.38} y={headW * 0.15} z={headLen * 0.25} r={0.045 + headW * 0.04} color={eye} />
          {ears === 'point' && (
            <>
              <P g="cone" a={[0.07, 0.22, 4]} c={headC || body} {...sp} position={[headW * 0.3, headW * 0.55, -headLen * 0.2]} />
              <P g="cone" a={[0.07, 0.22, 4]} c={headC || body} {...sp} position={[-headW * 0.3, headW * 0.55, -headLen * 0.2]} />
            </>
          )}
          {ears === 'flop' && (
            <>
              <P g="box" a={[0.2, 0.05, 0.12]} c={headC || body} position={[headW * 0.6, headW * 0.25, -headLen * 0.2]} rotation-z={-0.5} />
              <P g="box" a={[0.2, 0.05, 0.12]} c={headC || body} position={[-headW * 0.6, headW * 0.25, -headLen * 0.2]} rotation-z={0.5} />
            </>
          )}
          {tusks && (
            <>
              <P g="cone" a={[0.035, 0.2, 4]} c="#f2ead8" position={[headW * 0.28, -headW * 0.05, headLen / 2 + snout * 0.7]} rotation-x={-0.6} />
              <P g="cone" a={[0.035, 0.2, 4]} c="#f2ead8" position={[-headW * 0.28, -headW * 0.05, headLen / 2 + snout * 0.7]} rotation-x={-0.6} />
            </>
          )}
          {beard && <P g="cone" a={[0.07, 0.3, 4]} c={belly || '#ddd'} position={[0, -headW * 0.55, headLen * 0.3]} rotation-x={Math.PI} />}
          <Horns type={horns} size={hornSize} c={hornC} headW={headW} glow={antlerGlow} />
        </group>
      </group>
      {/* tail */}
      <group ref={tailR} position={[0, yc + bodyH * 0.15, -bodyLen * 0.48]}>
        <Tail type={tail} c={body} sp={sp} />
      </group>
    </group>
  )
}

function Horns({ type, size, c, headW, glow }) {
  if (!type) return null
  const s = size
  if (type === 'cow')
    return (
      <>
        {[1, -1].map((side) => (
          <group key={side} position={[side * headW * 0.45, headW * 0.42, -0.05]} rotation-z={-side * 1.25}>
            <P g="cone" a={[0.06 * s, 0.55 * s, 5]} c={c} position={[0, 0.27 * s, 0]} />
            <P g="cone" a={[0.035 * s, 0.25 * s, 5]} c="#2b2622" position={[0.06 * s * side * -1, 0.6 * s, 0]} rotation-z={side * 0.8} />
          </group>
        ))}
      </>
    )
  if (type === 'goat')
    return (
      <>
        {[1, -1].map((side) => (
          <group key={side} position={[side * headW * 0.3, headW * 0.45, -0.1]} rotation-y={side * 0.25}>
            <P g="tor" a={[0.2 * s, 0.055 * s, 5, 10, Math.PI * 1.3]} c={c} rotation={[0, Math.PI / 2, 0.6]} position={[0, 0.05, -0.12 * s]} />
          </group>
        ))}
      </>
    )
  if (type === 'antlers')
    return (
      <>
        {[1, -1].map((side) => (
          <group key={side} position={[side * headW * 0.3, headW * 0.45, -0.1]} rotation-z={-side * 0.45}>
            <P g="cyl" a={[0.025 * s, 0.04 * s, 0.9 * s, 4]} c={c} e={glow} ei={glow ? 1.8 : 1} position={[0, 0.45 * s, -0.1 * s]} rotation-x={-0.3} />
            {[0.3, 0.55, 0.8].map((h, i) => (
              <P
                key={i}
                g="cyl"
                a={[0.015 * s, 0.025 * s, 0.35 * s, 4]}
                c={c}
                e={glow}
                ei={glow ? 1.8 : 1}
                position={[side * 0.08 * s, h * s, (0.05 - i * 0.12) * s]}
                rotation={[0.6, 0, -side * 0.6]}
              />
            ))}
          </group>
        ))}
      </>
    )
  return null
}

function Tail({ type, c, sp }) {
  if (type === 'thin') return <P g="cyl" a={[0.02, 0.05, 0.6, 4]} c={c} {...sp} position={[0, -0.25, -0.15]} rotation-x={-0.5} />
  if (type === 'tuft')
    return (
      <>
        <P g="cyl" a={[0.02, 0.04, 0.6, 4]} c={c} position={[0, -0.25, -0.12]} rotation-x={-0.35} />
        <P g="ico" a={[0.08, 0]} c="#2a2420" position={[0, -0.55, -0.22]} />
      </>
    )
  if (type === 'bushy') return <P g="ico" a={[0.18, 1]} c={c} {...sp} scale={[0.8, 0.8, 2.6]} position={[0, 0.0, -0.4]} rotation-x={0.35} />
  if (type === 'curl') return <P g="tor" a={[0.06, 0.025, 4, 8]} c={c} position={[0, 0.05, -0.05]} rotation-y={Math.PI / 2} />
  if (type === 'squirrel')
    return (
      <group>
        <P g="ico" a={[0.3, 1]} c={c} scale={[0.8, 1.6, 0.8]} position={[0, 0.45, -0.2]} rotation-x={-0.25} />
        <P g="ico" a={[0.26, 1]} c={c} scale={[0.8, 1.2, 0.8]} position={[0, 0.95, 0.05]} rotation-x={0.6} />
      </group>
    )
  if (type === 'stub') return <P g="cone" a={[0.06, 0.15, 4]} c={c} position={[0, 0, -0.05]} rotation-x={-1.6} />
  return null
}

// =====================================================================================
// Birds: Huginn & Muninn, Hræsvelgr. Origin at the body centre.
// =====================================================================================
export function Bird({ m, o }) {
  const { body = '#111', head, beak = '#333', eye = '#9fe7ff', span = 1.1, tailC, talon = '#c9a227' } = o
  const lw = useRef()
  const rw = useRef()
  const lw2 = useRef()
  const rw2 = useRef()
  useFrame(() => {
    const diving = m.fly && m.fly.mode === 'dive'
    const flap = diving ? -0.25 : Math.sin(m.animT) * 0.65
    const outer = diving ? -0.9 : Math.sin(m.animT - 0.7) * 0.45
    const sweep = diving ? 0.9 : 0
    if (lw.current) lw.current.rotation.set(0, sweep, flap)
    if (rw.current) rw.current.rotation.set(0, -sweep, -flap)
    if (lw2.current) lw2.current.rotation.z = outer
    if (rw2.current) rw2.current.rotation.z = -outer
  })
  const wing = (ref, ref2, side) => (
    <group ref={ref} position={[side * 0.2, 0.08, 0.05]}>
      <P g="box" a={[span, 0.05, 0.75]} c={body} position={[side * span * 0.5, 0, 0]} />
      <group ref={ref2} position={[side * span, 0, 0]}>
        <P g="box" a={[span * 0.85, 0.04, 0.6]} c={body} position={[side * span * 0.42, 0, -0.05]} />
        {[0, 1, 2, 3].map((i) => (
          <P key={i} g="box" a={[0.12, 0.03, 0.55]} c={body} position={[side * (span * 0.85 + 0.02), 0, 0.15 - i * 0.18]} rotation-y={side * (0.2 + i * 0.15)} />
        ))}
      </group>
    </group>
  )
  return (
    <group>
      <P g="sph" a={[1, 8, 6]} c={body} scale={[0.32, 0.3, 0.75]} />
      <P g="sph" a={[0.24, 8, 6]} c={head || body} position={[0, 0.15, 0.72]} />
      <P g="cone" a={[0.08, 0.38, 4]} c={beak} position={[0, 0.1, 1.05]} rotation-x={Math.PI / 2} />
      <Eyes x={0.13} y={0.21} z={0.82} r={0.045} color={eye} />
      <P g="box" a={[0.5, 0.04, 0.55]} c={tailC || body} position={[0, 0, -0.85]} rotation-x={0.08} />
      <P g="cone" a={[0.04, 0.25, 4]} c={talon} position={[0.1, -0.3, 0.1]} rotation-x={Math.PI} />
      <P g="cone" a={[0.04, 0.25, 4]} c={talon} position={[-0.1, -0.3, 0.1]} rotation-x={Math.PI} />
      {wing(lw, lw2, 1)}
      {wing(rw, rw2, -1)}
    </group>
  )
}

// =====================================================================================
// Fáfnir — a winged, poison-breathing dragon. Origin at the feet, ~5 units long in unit scale.
// =====================================================================================
export function Dragon({ m, o }) {
  const { body = '#2f4a2a', belly = '#8a8a4a', wingC = '#4d3a2a', eye = '#ffd21f', horn = '#d8cfb4' } = o
  const legs = [useRef(), useRef(), useRef(), useRef()]
  const neck = useRef()
  const jaw = useRef()
  const lw = useRef()
  const rw = useRef()
  const tail = useRef()
  useFrame((state) => {
    const ph = m.animT
    const amp = Math.min(1, m.speedNow / 2) * 0.6
    const offs = [0, Math.PI, Math.PI, 0]
    for (let i = 0; i < 4; i++) if (legs[i].current) legs[i].current.rotation.x = Math.sin(ph + offs[i]) * amp
    const t = state.clock.elapsedTime
    const breath = m.breathT > 0 ? 1 : 0
    const lunge = attackCurve(m)
    if (neck.current) neck.current.rotation.x = -0.25 + lunge * 0.6 + breath * 0.25 + Math.sin(t * 1.3) * 0.05
    if (jaw.current) jaw.current.rotation.x = 0.1 + Math.max(lunge, breath) * 0.6
    const flap = Math.sin(t * 1.6 + m.seed) * 0.25 + (m.speedNow > 3 ? Math.sin(t * 5) * 0.35 : 0)
    if (lw.current) lw.current.rotation.z = 0.5 + flap
    if (rw.current) rw.current.rotation.z = -0.5 - flap
    if (tail.current) tail.current.children.forEach((c, i) => (c.rotation.y = Math.sin(t * 2 - i * 0.6) * 0.15))
  })
  const legPos = [
    [0.55, 0.9],
    [-0.55, 0.9],
    [0.55, -0.8],
    [-0.55, -0.8],
  ]
  return (
    <group>
      <P g="sph" a={[1, 10, 8]} c={body} position={[0, 1.35, 0]} scale={[0.85, 0.7, 1.55]} />
      <P g="sph" a={[1, 8, 6]} c={belly} position={[0, 1.1, 0.1]} scale={[0.6, 0.45, 1.2]} />
      {/* back spikes */}
      {Array.from({ length: 6 }, (_, i) => (
        <P key={i} g="cone" a={[0.12, 0.45, 4]} c={horn} position={[0, 2.0 - Math.abs(i - 2) * 0.05, 1.0 - i * 0.42]} rotation-x={-0.4} />
      ))}
      {legPos.map(([x, z], i) => (
        <group key={i} ref={legs[i]} position={[x, 1.1, z]}>
          <P g="cyl" a={[0.16, 0.22, 1.1, 6]} c={body} position={[0, -0.55, 0]} />
          {[-0.12, 0, 0.12].map((cx, j) => (
            <P key={j} g="cone" a={[0.05, 0.22, 4]} c={horn} position={[cx, -1.05, 0.2]} rotation-x={Math.PI / 2} />
          ))}
        </group>
      ))}
      {/* neck + head */}
      <group ref={neck} position={[0, 1.7, 1.3]}>
        <P g="cyl" a={[0.28, 0.42, 1.4, 7]} c={body} position={[0, 0.55, 0.45]} rotation-x={0.75} />
        <group position={[0, 1.1, 1.05]}>
          <P g="box" a={[0.6, 0.45, 0.9]} c={body} position={[0, 0, 0.2]} />
          <P g="box" a={[0.45, 0.25, 0.55]} c={body} position={[0, -0.03, 0.85]} />
          <group ref={jaw} position={[0, -0.2, 0.3]}>
            <P g="box" a={[0.42, 0.12, 0.95]} c={belly} position={[0, -0.04, 0.45]} />
          </group>
          <Eyes x={0.24} y={0.12} z={0.45} r={0.07} color={eye} ei={4} />
          <P g="cone" a={[0.07, 0.6, 5]} c={horn} position={[0.2, 0.35, -0.2]} rotation-x={-1.0} />
          <P g="cone" a={[0.07, 0.6, 5]} c={horn} position={[-0.2, 0.35, -0.2]} rotation-x={-1.0} />
          <P g="sph" a={[0.08, 6, 5]} c="#000" e="#7dff4a" ei={2} position={[0, -0.05, 1.12]} shadow={false} />
        </group>
      </group>
      {/* wings */}
      {[
        [lw, 1],
        [rw, -1],
      ].map(([ref, side]) => (
        <group key={side} ref={ref} position={[side * 0.55, 1.85, 0.5]}>
          <Wing len={3.4} side={side} c={wingC} bone={body} />
        </group>
      ))}
      {/* tail */}
      <group ref={tail} position={[0, 1.3, -1.4]}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[0, -i * 0.08, -i * 0.55]}>
            <P g="cone" a={[0.35 - i * 0.05, 0.7, 6]} c={body} rotation-x={-Math.PI / 2} />
          </group>
        ))}
      </group>
    </group>
  )
}

// =====================================================================================
// Serpents: Jörmungandr (water), Lindworm and Níðhöggr (land).
// Drawn in world space relative to the monster root, following m.trail.
// =====================================================================================
export function Serpent({ m, o }) {
  const { body = '#2c5a4a', belly = '#a59a6a', segments = 18, radius = 0.6, spacing = 0.9, eye = '#ffcc00', water = false, legs = false, wings = false, wingC = '#2a1b2e', horn = '#e0d6c0', fins = false } = o
  const headRef = useRef()
  const jaw = useRef()
  const segRefs = useMemo(() => Array.from({ length: segments }, () => React_createRef()), [segments])
  const wingRefs = [useRef(), useRef()]
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const trail = m.trail
    if (!trail || !trail.length) return
    const root = m.pos
    const lunge = attackCurve(m)
    // head
    if (headRef.current) {
      let y = 0
      if (water) y = waterLevelAt(root.x, root.z) + 0.8 * radius + lunge * 2.2 - root.y
      else y = radius * 0.9 + lunge * 0.8
      headRef.current.position.set(0, y - m.sink, 0)
      headRef.current.rotation.set(-lunge * 0.4, m.yaw, 0)
    }
    if (jaw.current) jaw.current.rotation.x = 0.1 + lunge * 0.8
    for (let i = 0; i < segments; i++) {
      const ref = segRefs[i].current
      if (!ref) continue
      const p = trail[Math.min(trail.length - 1, i + 1)]
      tmp.copy(p)
      const taper = 1 - (i / segments) * 0.75
      let y
      if (water) {
        const wl = waterLevelAt(p.x, p.z)
        y = wl + Math.sin(i * 0.55 - t * 2.2 + m.seed) * radius * 1.4 - radius * 0.3
      } else {
        y = heightAt(p.x, p.z) + radius * taper * 0.8 + Math.max(0, Math.sin(i * 0.7 - t * 3)) * 0.1
      }
      ref.position.set(p.x - root.x, y - root.y - m.sink, p.z - root.z)
      ref.scale.setScalar(taper)
      const q = trail[Math.min(trail.length - 1, i)]
      ref.rotation.y = Math.atan2(q.x - p.x, q.z - p.z)
    }
    const flap = Math.sin(t * 4 + m.seed) * 0.6
    if (wingRefs[0].current) wingRefs[0].current.rotation.z = 0.3 + flap
    if (wingRefs[1].current) wingRefs[1].current.rotation.z = -0.3 - flap
  })
  return (
    <group>
      <group ref={headRef}>
        <P g="box" a={[radius * 1.5, radius * 1.1, radius * 2.2]} c={body} position={[0, 0.1 * radius, radius * 0.6]} />
        <P g="box" a={[radius * 1.1, radius * 0.6, radius * 1.4]} c={body} position={[0, 0.15 * radius, radius * 2.2]} />
        <group ref={jaw} position={[0, -radius * 0.35, radius * 0.6]}>
          <P g="box" a={[radius * 1.1, radius * 0.3, radius * 2.6]} c={belly} position={[0, 0, radius * 1.2]} />
          {[-0.35, 0.35].map((x) => (
            <P key={x} g="cone" a={[radius * 0.08, radius * 0.4, 4]} c="#f5f1e6" position={[x * radius, radius * 0.3, radius * 2.3]} />
          ))}
        </group>
        <Eyes x={radius * 0.6} y={radius * 0.45} z={radius * 1.3} r={radius * 0.14} color={eye} ei={4} />
        <P g="cone" a={[radius * 0.15, radius * 1.1, 4]} c={horn} position={[radius * 0.45, radius * 0.75, -radius * 0.3]} rotation-x={-1.1} />
        <P g="cone" a={[radius * 0.15, radius * 1.1, 4]} c={horn} position={[-radius * 0.45, radius * 0.75, -radius * 0.3]} rotation-x={-1.1} />
        {fins && <P g="cone" a={[radius * 0.5, radius * 1.4, 3]} c={belly} position={[0, radius * 0.9, -radius * 0.2]} rotation-x={-1.3} />}
      </group>
      {segRefs.map((ref, i) => (
        <group key={i} ref={ref}>
          <P g="sph" a={[radius, 8, 6]} c={i % 2 ? body : belly} scale={[1, 0.9, 1.25]} />
          {i % 2 === 0 && <P g="cone" a={[radius * 0.25, radius * 0.7, 4]} c={horn} position={[0, radius * 0.9, 0]} />}
          {legs && (i === 1 || i === 2) && (
            <>
              <P g="cyl" a={[radius * 0.2, radius * 0.25, radius * 1.6, 5]} c={body} position={[radius * 1.0, -radius * 0.4, 0.2]} rotation-z={0.6} />
              <P g="cyl" a={[radius * 0.2, radius * 0.25, radius * 1.6, 5]} c={body} position={[-radius * 1.0, -radius * 0.4, 0.2]} rotation-z={-0.6} />
            </>
          )}
          {wings && i === 2 && (
            <>
              {[0, 1].map((k) => (
                <group key={k} ref={wingRefs[k]} position={[(k ? -1 : 1) * radius * 0.6, radius * 0.6, 0]}>
                  <Wing len={radius * 5} side={k ? -1 : 1} c={wingC} bone={body} />
                </group>
              ))}
            </>
          )}
        </group>
      ))}
    </group>
  )
}
// tiny helper so we can create refs inside useMemo
function React_createRef() {
  return { current: null }
}

// =====================================================================================
// Kraken — lurks in the lake; tentacles lash at anyone on the shore. Origin at water surface.
// =====================================================================================
export function Kraken({ m, o }) {
  const { body = '#6b2335', spots = '#a5455a', eye = '#ffe14d' } = o
  const N = 8
  const tentacles = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // attack: front tentacles rear up, then slam down towards the prey
    const p = m.attackT >= 0 ? Math.min(1, m.attackT / m.def.attackTime) : -1
    const slam = p < 0 ? 0 : p < 0.5 ? -0.9 * (p / 0.5) : -0.9 + 2.6 * ((p - 0.5) / 0.5)
    if (!tentacles.current) return
    tentacles.current.children.forEach((tent, i) => {
      const a = (i / N) * Math.PI * 2
      const front = Math.pow(Math.max(0, Math.cos(a)), 2)
      let seg = tent.children[0]
      let j = 0
      while (seg) {
        const base = j === 0 ? 0.45 + front * slam : 0.12 + front * Math.max(0, slam) * 0.08
        seg.rotation.x = base + Math.sin(t * 1.6 + i * 0.9 + j * 0.6) * 0.28
        seg = seg.children.find((c) => c.isGroup)
        j++
      }
    })
  })
  const tentacle = (depth, len, r) => {
    if (depth === 0) return null
    return (
      <group position={[0, len, 0]}>
        <P g="cyl" a={[r * 0.75, r, len, 6]} c={depth % 2 ? body : spots} position={[0, len / 2, 0]} />
        {tentacle(depth - 1, len * 0.92, r * 0.78)}
      </group>
    )
  }
  return (
    <group>
      <P g="sph" a={[1, 10, 8]} c={body} position={[0, 1.4, -0.3]} scale={[1.5, 2.0, 1.5]} rotation-x={-0.4} />
      {[0, 1, 2, 3, 4].map((i) => (
        <P key={i} g="sph" a={[0.22, 6, 5]} c={spots} position={[Math.sin(i * 2.1) * 1.1, 1.8 + (i % 3) * 0.45, -0.3 + Math.cos(i * 2.1) * 1.1]} />
      ))}
      <Eyes x={0.75} y={0.8} z={1.0} r={0.28} color={eye} ei={2.5} />
      <P g="box" a={[0.08, 0.3, 0.05]} c="#000" position={[0.75, 0.8, 1.27]} />
      <P g="box" a={[0.08, 0.3, 0.05]} c="#000" position={[-0.75, 0.8, 1.27]} />
      <group ref={tentacles} position={[0, 0.2, 0]}>
        {Array.from({ length: N }, (_, i) => {
          const a = (i / N) * Math.PI * 2
          return (
            <group key={i} position={[Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1]} rotation-y={a}>
              <group position={[0, -0.3, 0]}>{tentacle(7, 0.85, 0.3)}</group>
            </group>
          )
        })}
      </group>
    </group>
  )
}

// =====================================================================================
// Lyngbakr — a whale so vast it is mistaken for an island. Origin at water surface.
// =====================================================================================
export function Lyngbakr({ m }) {
  const flukes = useRef()
  const jaw = useRef()
  const body = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const lunge = attackCurve(m)
    if (flukes.current) flukes.current.rotation.x = Math.sin(t * 1.2) * 0.3
    if (jaw.current) jaw.current.rotation.x = 0.05 + lunge * 0.55
    if (body.current) {
      body.current.position.y = Math.sin(t * 0.5 + m.seed) * 0.25 + lunge * 1.2
      body.current.rotation.x = -lunge * 0.15
    }
  })
  return (
    <group ref={body}>
      <P g="sph" a={[1, 12, 9]} c="#2c3a46" position={[0, -0.6, 0]} scale={[2.6, 1.8, 6.5]} />
      <P g="sph" a={[1, 10, 8]} c="#8b9196" position={[0, -1.4, 0.8]} scale={[2.1, 1.0, 5.2]} />
      {/* island on its back */}
      <P g="ico" a={[1, 1]} c="#4d5e33" position={[0, 0.95, -0.4]} scale={[2.3, 0.55, 4.6]} />
      <P g="dod" a={[0.7, 0]} c="#6a6660" position={[0.8, 1.35, 1.2]} />
      <P g="dod" a={[0.5, 0]} c="#6a6660" position={[-0.9, 1.25, -2.3]} />
      {[
        [-0.6, 0.8],
        [0.7, -1.5],
        [0.1, -3.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 1.25, z]}>
          <P g="cyl" a={[0.08, 0.12, 0.8, 5]} c="#4a3526" position={[0, 0.4, 0]} />
          <P g="cone" a={[0.6, 1.6, 6]} c="#22391f" position={[0, 1.4, 0]} />
          <P g="cone" a={[0.4, 1.1, 6]} c="#22391f" position={[0, 2.1, 0]} />
        </group>
      ))}
      <Eyes x={2.15} y={-0.3} z={4.0} r={0.22} color="#ffd36b" ei={2} />
      <group ref={jaw} position={[0, -1.1, 4.0]}>
        <P g="box" a={[3.0, 0.4, 2.8]} c="#8b9196" position={[0, 0, 1.0]} />
        {[-1.1, -0.4, 0.4, 1.1].map((x) => (
          <P key={x} g="cone" a={[0.12, 0.45, 4]} c="#f1ece0" position={[x, 0.35, 2.1]} />
        ))}
      </group>
      <group ref={flukes} position={[0, -0.5, -6.3]}>
        <P g="box" a={[0.7, 0.6, 2.2]} c="#2c3a46" position={[0, 0, -0.9]} />
        <P g="box" a={[4.2, 0.18, 1.4]} c="#2c3a46" position={[0, 0, -2.0]} />
      </group>
    </group>
  )
}

// =====================================================================================
// Humanoids: Troll, Brunnmigi, Marbendill (merman), Vörðr (ghost)
// =====================================================================================
export function Troll({ m, o }) {
  const { skin = '#5d6b55', cloth = '#4a3a2a', eye = '#ffb02e', club = true } = o
  const la = useRef()
  const ra = useRef()
  const ll = useRef()
  const rl = useRef()
  const torso = useRef()
  useFrame(() => {
    const ph = m.animT
    const amp = Math.min(1, m.speedNow / 2) * 0.55
    const swing = attackCurve(m)
    const throwing = m.throwT > 0 ? Math.sin(Math.min(1, m.throwT / 0.8) * Math.PI) : 0
    if (ll.current) ll.current.rotation.x = Math.sin(ph) * amp
    if (rl.current) rl.current.rotation.x = -Math.sin(ph) * amp
    if (la.current) la.current.rotation.x = -Math.sin(ph) * amp * 0.8 - throwing * 2.4
    if (ra.current) ra.current.rotation.x = Math.sin(ph) * amp * 0.8 - swing * 2.6 - throwing * 0.3
    if (torso.current) torso.current.rotation.x = 0.25 + swing * 0.25
  })
  return (
    <group>
      {[
        [ll, 0.32],
        [rl, -0.32],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref} position={[x, 1.0, 0]}>
          <P g="cyl" a={[0.2, 0.26, 1.0, 6]} c={skin} position={[0, -0.5, 0]} />
          <P g="box" a={[0.35, 0.15, 0.5]} c={skin} position={[0, -0.98, 0.1]} />
        </group>
      ))}
      <group ref={torso} position={[0, 1.0, 0]}>
        <P g="sph" a={[1, 9, 7]} c={skin} position={[0, 0.7, 0]} scale={[0.72, 0.85, 0.55]} />
        <P g="cyl" a={[0.62, 0.66, 0.4, 8]} c={cloth} position={[0, 0.15, 0]} />
        {/* moss tufts on shoulders */}
        <P g="ico" a={[0.22, 0]} c="#3e5a2a" position={[0.55, 1.3, -0.1]} />
        <P g="ico" a={[0.18, 0]} c="#3e5a2a" position={[-0.5, 1.35, -0.15]} />
        {/* head */}
        <group position={[0, 1.55, 0.25]}>
          <P g="sph" a={[0.36, 8, 6]} c={skin} scale={[1, 0.9, 1]} />
          <P g="cone" a={[0.11, 0.55, 5]} c={skin} position={[0, -0.05, 0.5]} rotation-x={Math.PI / 2 + 0.3} />
          <Eyes x={0.14} y={0.1} z={0.3} r={0.05} color={eye} />
          <P g="cone" a={[0.08, 0.25, 4]} c={skin} position={[0.36, 0.08, 0]} rotation-z={-1.2} />
          <P g="cone" a={[0.08, 0.25, 4]} c={skin} position={[-0.36, 0.08, 0]} rotation-z={1.2} />
          <P g="cone" a={[0.04, 0.12, 4]} c="#e8e0cc" position={[0.12, -0.25, 0.3]} />
          <P g="cone" a={[0.04, 0.12, 4]} c="#e8e0cc" position={[-0.12, -0.25, 0.3]} />
          <P g="ico" a={[0.2, 0]} c="#2f3a24" position={[0, 0.32, -0.08]} scale={[1.4, 0.6, 1.2]} />
        </group>
        {/* arms */}
        {[
          [la, 0.78, false],
          [ra, -0.78, club],
        ].map(([ref, x, hasClub], i) => (
          <group key={i} ref={ref} position={[x, 1.15, 0]}>
            <P g="cyl" a={[0.15, 0.2, 0.85, 6]} c={skin} position={[0, -0.42, 0]} />
            <P g="cyl" a={[0.13, 0.16, 0.8, 6]} c={skin} position={[0, -1.15, 0.12]} rotation-x={-0.25} />
            <P g="ico" a={[0.2, 0]} c={skin} position={[0, -1.6, 0.25]} />
            {hasClub && (
              <group position={[0, -1.6, 0.3]} rotation-x={Math.PI / 2 - 0.3}>
                <P g="cyl" a={[0.12, 0.26, 1.6, 6]} c="#5a432c" position={[0, 0.7, 0]} />
                {[0, 1, 2].map((k) => (
                  <P key={k} g="cone" a={[0.05, 0.16, 4]} c="#888" position={[Math.sin(k * 2.1) * 0.25, 1.2, Math.cos(k * 2.1) * 0.25]} rotation={[Math.cos(k * 2.1), 0, -Math.sin(k * 2.1)]} />
                ))}
              </group>
            )}
          </group>
        ))}
      </group>
    </group>
  )
}

export function Brunnmigi({ m }) {
  const la = useRef()
  const ra = useRef()
  const ll = useRef()
  const rl = useRef()
  useFrame(() => {
    const ph = m.animT
    const amp = Math.min(1, m.speedNow / 2) * 0.7
    const swing = attackCurve(m)
    if (ll.current) ll.current.rotation.x = Math.sin(ph) * amp
    if (rl.current) rl.current.rotation.x = -Math.sin(ph) * amp
    if (la.current) la.current.rotation.x = -1.0 - Math.sin(ph) * amp * 0.5 - swing * 1.2
    if (ra.current) ra.current.rotation.x = -1.0 + Math.sin(ph) * amp * 0.5 - swing * 1.2
  })
  const skin = '#5c6b2e'
  return (
    <group>
      {[
        [ll, 0.2],
        [rl, -0.2],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref} position={[x, 0.95, 0]}>
          <P g="cyl" a={[0.08, 0.1, 0.55, 5]} c={skin} position={[0, -0.25, 0.12]} rotation-x={-0.5} />
          <P g="cyl" a={[0.07, 0.08, 0.55, 5]} c={skin} position={[0, -0.7, 0.12]} rotation-x={0.4} />
          <P g="box" a={[0.16, 0.06, 0.32]} c={skin} position={[0, -0.95, 0.2]} />
        </group>
      ))}
      <group position={[0, 0.95, 0]} rotation-x={0.75}>
        <P g="sph" a={[1, 8, 6]} c={skin} position={[0, 0.45, 0]} scale={[0.3, 0.55, 0.24]} />
        {/* ribs */}
        {[0.3, 0.45, 0.6].map((y) => (
          <P key={y} g="tor" a={[0.26, 0.02, 4, 10, Math.PI]} c="#3f4a1f" position={[0, y, 0.05]} rotation-y={Math.PI / 2} />
        ))}
        <group position={[0, 1.05, 0.1]} rotation-x={-0.6}>
          <P g="sph" a={[0.26, 8, 6]} c={skin} scale={[1, 1.15, 1]} />
          <Eyes x={0.1} y={0.05} z={0.22} r={0.06} color="#f2ff3a" ei={4} />
          <P g="box" a={[0.2, 0.05, 0.05]} c="#120c08" position={[0, -0.15, 0.24]} />
          <P g="cone" a={[0.05, 0.3, 4]} c={skin} position={[0.25, 0.1, 0]} rotation-z={-1.3} />
          <P g="cone" a={[0.05, 0.3, 4]} c={skin} position={[-0.25, 0.1, 0]} rotation-z={1.3} />
        </group>
        {[
          [la, 0.36],
          [ra, -0.36],
        ].map(([ref, x], i) => (
          <group key={i} ref={ref} position={[x, 0.8, 0]}>
            <P g="cyl" a={[0.06, 0.08, 0.8, 5]} c={skin} position={[0, -0.4, 0]} />
            <P g="cyl" a={[0.05, 0.06, 0.8, 5]} c={skin} position={[0, -1.15, 0]} />
            {[-0.06, 0, 0.06].map((cx) => (
              <P key={cx} g="cone" a={[0.025, 0.18, 4]} c="#d9d2b5" position={[cx, -1.6, 0]} rotation-x={Math.PI} />
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

export function Marmennill({ m }) {
  const tail = useRef()
  const arm = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const swing = attackCurve(m)
    if (tail.current) tail.current.children.forEach((c, i) => (c.rotation.x = Math.sin(t * 3 - i * 0.8) * 0.3))
    if (arm.current) arm.current.rotation.x = -0.6 - swing * 1.6
  })
  const skin = '#5f8f94'
  return (
    <group>
      <group ref={tail} position={[0, -0.2, 0]}>
        {Array.from({ length: 5 }, (_, i) => (
          <group key={i} position={[0, -0.1 - i * 0.05, -i * 0.38]}>
            <P g="sph" a={[0.32 - i * 0.05, 7, 5]} c={i % 2 ? '#2f6a63' : '#3e7d72'} scale={[1, 0.8, 1.4]} />
          </group>
        ))}
        <P g="box" a={[0.9, 0.06, 0.4]} c="#2f6a63" position={[0, -0.4, -2.0]} />
      </group>
      <P g="sph" a={[1, 8, 6]} c={skin} position={[0, 0.55, 0]} scale={[0.36, 0.52, 0.28]} />
      <group position={[0, 1.2, 0.05]}>
        <P g="sph" a={[0.24, 8, 6]} c={skin} />
        <Eyes x={0.09} y={0.05} z={0.2} r={0.04} color="#7dfbff" ei={3} />
        <P g="cone" a={[0.2, 0.55, 6]} c="#dcdcd2" position={[0, -0.32, 0.12]} rotation-x={Math.PI - 0.25} />
        <P g="cone" a={[0.26, 0.6, 6]} c="#a9b7a2" position={[0, 0.0, -0.25]} rotation-x={-2.3} />
      </group>
      <group position={[0.36, 0.85, 0]}>
        <P g="cyl" a={[0.07, 0.09, 0.7, 5]} c={skin} position={[0, -0.3, 0]} rotation-z={0.4} />
      </group>
      <group ref={arm} position={[-0.36, 0.85, 0]}>
        <P g="cyl" a={[0.07, 0.09, 0.7, 5]} c={skin} position={[0, -0.35, 0]} />
        <group position={[0, -0.7, 0]} rotation-x={Math.PI / 2}>
          <P g="cyl" a={[0.03, 0.03, 2.4, 4]} c="#6d5b3a" position={[0, 0.6, 0]} />
          {[-0.12, 0, 0.12].map((x) => (
            <P key={x} g="cone" a={[0.03, 0.25, 4]} c="#c8c8c8" metal={0.7} position={[x, 1.9, 0]} />
          ))}
        </group>
      </group>
    </group>
  )
}

export function Vordr({ m }) {
  const g = useRef()
  const arms = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const swing = attackCurve(m)
    if (g.current) g.current.position.y = Math.sin(t * 1.5 + m.seed) * 0.2
    if (arms.current) arms.current.rotation.x = -1.2 - swing * 0.6 + Math.sin(t * 2) * 0.1
  })
  const sp = { o: 0.62, e: '#1b0f2e', ei: 1 }
  return (
    <group ref={g}>
      <P g="cone" a={[0.75, 2.6, 9, 1, true]} c="#120d1a" {...sp} position={[0, 1.35, 0]} />
      <P g="sph" a={[0.26, 8, 6]} c="#1a1424" {...sp} position={[0, 2.85, 0]} />
      <P g="cone" a={[0.32, 1.6, 7]} c="#05030a" {...sp} position={[0, 2.25, -0.18]} rotation-x={0.12} />
      <Eyes x={0.09} y={2.88} z={0.2} r={0.05} color="#7ff6ff" ei={5} />
      <group ref={arms} position={[0, 2.3, 0.05]}>
        <P g="cyl" a={[0.04, 0.07, 1.4, 5]} c="#1a1424" {...sp} position={[0.3, -0.6, 0]} />
        <P g="cyl" a={[0.04, 0.07, 1.4, 5]} c="#1a1424" {...sp} position={[-0.3, -0.6, 0]} />
      </group>
      <pointLight color="#6fd8ff" intensity={4} distance={7} position={[0, 2.5, 0.4]} />
    </group>
  )
}

// =====================================================================================
// Spirits: Landvættir (rune-stone guardian with wisps)
// =====================================================================================
export function Landvaettir({ m }) {
  const g = useRef()
  const wisps = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pulse = attackCurve(m)
    if (g.current) {
      g.current.position.y = 1.6 + Math.sin(t * 1.2 + m.seed) * 0.25
      g.current.rotation.y = t * 0.6
      g.current.scale.setScalar(1 + pulse * 0.3)
    }
    if (wisps.current) wisps.current.rotation.y = -t * 2.2
  })
  return (
    <group>
      <group ref={g}>
        <P g="oct" a={[0.7, 0]} c="#7d7a72" scale={[0.9, 1.6, 0.7]} />
        {[0, 1, 2, 3].map((i) => (
          <P key={i} g="box" a={[0.04, 0.9, 0.04]} c="#000" e="#4af0d0" ei={3} position={[Math.sin((i * Math.PI) / 2) * 0.42, 0, Math.cos((i * Math.PI) / 2) * 0.33]} rotation-z={i % 2 ? 0.4 : -0.4} shadow={false} />
        ))}
        <P g="tor" a={[1.05, 0.04, 4, 24]} c="#000" e="#4af0d0" ei={2} rotation-x={Math.PI / 2} shadow={false} />
      </group>
      <group ref={wisps} position={[0, 1.6, 0]}>
        {[0, 1, 2].map((i) => (
          <P key={i} g="sph" a={[0.16, 8, 6]} c="#000" e="#a8fff0" ei={4} position={[Math.sin((i * Math.PI * 2) / 3) * 1.5, Math.sin(i) * 0.4, Math.cos((i * Math.PI * 2) / 3) * 1.5]} shadow={false} />
        ))}
      </group>
      <pointLight color="#4af0d0" intensity={5} distance={9} position={[0, 1.8, 0]} />
    </group>
  )
}
