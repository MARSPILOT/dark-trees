import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, useGame } from '../store'
import { heightAt } from '../world/terrain'
import { sfx } from '../audio'

const MAX = 40
const pool = []

// projectiles thrown at the player (troll boulders, Fáfnir's venom)
export function spawnProjectile(p) {
  if (pool.length >= MAX) pool.shift()
  pool.push({ ...p, life: 6, spin: Math.random() * 10 })
}

export function clearProjectiles() {
  pool.length = 0
}

const tmp = new THREE.Vector3()

export function Projectiles() {
  const rocks = useRef([])
  const globs = useRef([])

  useFrame((_, delta) => {
    const phase = useGame.getState().phase
    const dt = phase === 'playing' || phase === 'dead' ? Math.min(delta, 0.05) : 0
    const P = G.player
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i]
      p.life -= dt
      p.vel.y -= p.gravity * dt
      p.pos.addScaledVector(p.vel, dt)
      p.spin += dt * 6
      // hit player?
      tmp.set(P.pos.x, P.pos.y + 1, P.pos.z)
      if (phase === 'playing' && p.pos.distanceTo(tmp) < p.radius + 0.6) {
        useGame.getState().damage(p.damage)
        sfx.hurt()
        P.shake = 0.4
        if (G.fx) G.fx.emit(p.pos, p.type === 'rock' ? '#7a7066' : '#7dff4a', 14, 5)
        pool.splice(i, 1)
        continue
      }
      if (p.pos.y < heightAt(p.pos.x, p.pos.z) || p.life <= 0) {
        if (G.fx) G.fx.emit(p.pos, p.type === 'rock' ? '#6d655c' : '#6cff3a', 10, 4)
        if (p.type === 'rock') sfx.thunk()
        pool.splice(i, 1)
      }
    }
    let ri = 0
    let gi = 0
    for (const p of pool) {
      if (p.type === 'rock' && rocks.current[ri]) {
        const m = rocks.current[ri++]
        m.visible = true
        m.position.copy(p.pos)
        m.rotation.set(p.spin, p.spin * 0.7, 0)
      } else if (p.type === 'poison' && globs.current[gi]) {
        const m = globs.current[gi++]
        m.visible = true
        m.position.copy(p.pos)
        m.scale.setScalar(0.7 + Math.sin(p.spin * 3) * 0.15 + (6 - p.life) * 0.4)
      }
    }
    for (; ri < rocks.current.length; ri++) rocks.current[ri] && (rocks.current[ri].visible = false)
    for (; gi < globs.current.length; gi++) globs.current[gi] && (globs.current[gi].visible = false)
  })

  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={'r' + i} ref={(el) => (rocks.current[i] = el)} visible={false} castShadow>
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color="#6f675e" roughness={1} flatShading />
        </mesh>
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <mesh key={'g' + i} ref={(el) => (globs.current[i] = el)} visible={false}>
          <icosahedronGeometry args={[0.6, 1]} />
          <meshStandardMaterial color="#3aa020" emissive="#5dff2a" emissiveIntensity={1.6} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
