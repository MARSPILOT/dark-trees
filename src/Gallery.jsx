import { useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { SPECIES } from './monsters/species'
import { previewVoice } from './monsters/sounds'

// Bestiary viewer: open the game with ?gallery to inspect every creature model.
const COLS = 6
const GAP = 16

function makeDummy(def, i) {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const pos = new THREE.Vector3((col - (COLS - 1) / 2) * GAP, 0, row * GAP)
  const m = {
    def,
    pos,
    yaw: Math.PI - 0.6,
    animT: 0,
    speedNow: 3,
    attackT: -1,
    seed: i * 3.1,
    sink: 0,
    fly: def.kind === 'fly' ? { mode: 'cruise' } : null,
    trail: null,
  }
  if (def.kind === 'serpent') {
    m.trail = []
    for (let k = 0; k < def.opts.segments + 2; k++) {
      const a = k * 0.35
      m.trail.push(new THREE.Vector3(pos.x + Math.sin(a) * 3, 0, pos.z - k * def.opts.spacing * 0.6))
    }
  }
  return m
}

function Creature({ m, index }) {
  const Model = m.def.model
  useFrame((state, dt) => {
    m.animT += dt * (m.def.kind === 'fly' ? m.def.flap : 6 / m.def.scale)
    // show an attack every few seconds
    const t = (state.clock.elapsedTime + index * 0.37) % 4
    m.attackT = t < m.def.attackTime ? t : -1
  })
  const serpent = m.def.kind === 'serpent'
  const y = m.def.kind === 'fly' ? 4 : 0
  return (
    <group position={serpent ? [m.pos.x, 0, m.pos.z] : [m.pos.x, y, m.pos.z]}>
      <group rotation-y={serpent ? 0 : m.yaw} scale={serpent ? 1 : m.def.scale}>
        <Model m={m} o={m.def.opts} />
      </group>
      <Html position={[0, 0, -5]} center style={{ color: '#f4ead2', font: '600 12px Inter, sans-serif', whiteSpace: 'nowrap', textShadow: '0 1px 3px #000', textAlign: 'center' }}>
        <div>{m.def.name}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 3, justifyContent: 'center' }}>
          {['call', 'attack'].map((k) => (
            <button key={k} className="voice-btn" onClick={() => previewVoice(m.def, k)}>
              ♪ {k}
            </button>
          ))}
        </div>
      </Html>
    </group>
  )
}

function CamHook() {
  const { camera, controls } = useThree()
  window.__cam = camera
  window.__ctl = controls
  window.focusOn = (name, dist = 10, h = 4) => {
    const i = SPECIES.findIndex((s) => s.name === name)
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = (col - (COLS - 1) / 2) * GAP
    const z = row * GAP
    const ty = SPECIES[i].kind === 'fly' ? 4 : 1.5 * SPECIES[i].scale
    controls.target.set(x, ty, z)
    camera.position.set(x + dist * 0.5, ty + h, z - dist)
    controls.update()
  }
  return null
}

export function Gallery() {
  const dummies = useMemo(() => SPECIES.map(makeDummy), [])
  return (
    <Canvas shadows camera={{ position: [0, 30, -30], fov: 50 }}>
      <color attach="background" args={['#5d6b78']} />
      <hemisphereLight args={['#c9d6e6', '#3b3222', 1]} />
      <directionalLight position={[30, 50, -20]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.01, 30]}>
        <planeGeometry args={[140, 120]} />
        <meshStandardMaterial color="#3d5a2a" />
      </mesh>
      {dummies.map((m, i) => (
        <Creature key={i} m={m} index={i} />
      ))}
      <OrbitControls makeDefault target={[0, 0, 30]} />
      <CamHook />
    </Canvas>
  )
}
