import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { G, useGame } from '../store'
import { createMonsters, updateMonster, rayPick, updateDirector, huntingCount } from './brain'
import { creatureSound } from './sounds'

const FLASH = new THREE.Color('#ff2020')
const camDir = new THREE.Vector3()

function HealthBar({ m }) {
  const g = useRef()
  const fg = useRef()
  const { camera } = useThree()
  const def = m.def
  const width = Math.min(4, 1.2 + def.scale * 0.6)
  const y = def.kind === 'serpent' ? def.opts.radius * 3.2 : def.kind === 'water' ? 3.2 * def.scale : def.kind === 'fly' ? 1.4 * def.scale : 2.6 * def.scale + 0.6
  useFrame(() => {
    if (!g.current) return
    const ratio = m.hp / def.hp
    const near = m.pos.distanceTo(G.player.pos) < 45
    g.current.visible = m.state === 'alive' && (ratio < 1 || near)
    if (!g.current.visible) return
    g.current.quaternion.copy(camera.quaternion)
    fg.current.scale.x = Math.max(0.001, ratio)
    fg.current.position.x = (-(1 - ratio) * width) / 2
  })
  return (
    <group ref={g} position-y={y}>
      <mesh renderOrder={10}>
        <planeGeometry args={[width + 0.08, 0.2]} />
        <meshBasicMaterial color="#120c0c" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh ref={fg} position-z={0.01} renderOrder={11}>
        <planeGeometry args={[width, 0.13]} />
        <meshBasicMaterial color="#d23a2a" transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

function MonsterView({ m }) {
  const root = useRef()
  const body = useRef()
  const mats = useRef([])
  const flashing = useRef(false)
  const def = m.def
  const Model = def.model
  const serpent = def.kind === 'serpent'
  const deathSide = useMemo(() => (Math.random() < 0.5 ? 1 : -1), [])

  useLayoutEffect(() => {
    const list = []
    body.current.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) {
        list.push({ mat: o.material, e: o.material.emissive.clone(), ei: o.material.emissiveIntensity })
      }
    })
    mats.current = list
  }, [])

  useFrame(() => {
    const r = root.current
    if (!r) return
    if (m.removed) {
      r.visible = false
      return
    }
    r.visible = m.pos.distanceToSquared(G.player.pos) < 260 * 260
    r.position.copy(m.pos)
    const b = body.current
    if (!serpent) {
      let roll = 0
      let scale = def.scale
      if (m.state === 'dying') {
        const k = Math.min(1, m.deathT * 1.8)
        if (def.kind === 'spirit') scale = def.scale * Math.max(0.001, 1 - m.deathT / 2)
        else if (def.kind !== 'water') roll = k * (Math.PI / 2) * deathSide
      }
      b.rotation.set(def.kind === 'fly' && m.state === 'alive' ? m.pitch : 0, m.yaw, roll, 'YXZ')
      b.scale.setScalar(scale)
    }
    // red flash when hit
    const want = m.hitFlash > 0
    if (want !== flashing.current) {
      flashing.current = want
      for (const it of mats.current) {
        if (want) {
          it.mat.emissive.copy(FLASH)
          it.mat.emissiveIntensity = 1.2
        } else {
          it.mat.emissive.copy(it.e)
          it.mat.emissiveIntensity = it.ei
        }
      }
    }
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <Model m={m} o={def.opts} />
      </group>
      <HealthBar m={m} />
    </group>
  )
}

export function Monsters() {
  const monsters = useMemo(() => createMonsters(), [])
  const setTotal = useGame((s) => s.setTotal)
  const setTarget = useGame((s) => s.setTarget)
  const { camera } = useThree()
  const ambient = useRef(8)

  useEffect(() => {
    G.monsters = monsters
    setTotal(monsters.length)
    return () => {
      G.monsters = []
    }
  }, [monsters])

  useFrame((_, delta) => {
    const phase = useGame.getState().phase
    if (phase !== 'playing' && phase !== 'dead') return
    const dt = Math.min(delta, 0.05)
    if (phase === 'playing') {
      updateDirector(dt)
      // the night is alive: now and then a resting beast somewhere nearby calls out
      ambient.current -= dt
      if (ambient.current <= 0) {
        ambient.current = 14 + Math.random() * 20
        const P = G.player.pos
        const near = monsters.filter((m) => m.state === 'alive' && !m.hunting && m.pos.distanceTo(P) < 140)
        if (near.length) creatureSound(near[Math.floor(Math.random() * near.length)], 'call')
      }
    }
    for (const m of monsters) updateMonster(m, dt)
    useGame.getState().setHunting(huntingCount())
    camera.getWorldDirection(camDir)
    const t = rayPick(camera.position, camDir)
    setTarget(t ? t.name : null)
  })

  return (
    <group>
      {monsters.map((m) => (
        <MonsterView key={m.id} m={m} />
      ))}
    </group>
  )
}
