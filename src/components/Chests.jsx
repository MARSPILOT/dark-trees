import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, useGame } from '../store'
import { chestSpots, addCollider } from '../world/placement'
import { sfx } from '../audio'

for (const c of chestSpots) addCollider(c.x, c.z, 0.7)

export function openChest(c) {
  if (c.opened) return
  c.opened = true
  c.openT = 0
  const g = useGame.getState()
  g.addArrows(c.arrows)
  let msg = `Found ${c.arrows} arrows`
  if (c.mead) {
    g.heal(35)
    msg += ' and a horn of mead (+35 health)'
  }
  g.message(msg)
  sfx.chest()
  if (G.fx) G.fx.emit(new THREE.Vector3(c.x, c.y + 0.9, c.z), '#ffd35a', 30, 3, { gravity: -1, life: 1.4, size: 0.08 })
}

function Chest({ c }) {
  const lid = useRef()
  const glint = useRef()
  useFrame((state, dt) => {
    if (c.opened && lid.current) {
      c.openT = Math.min(1, (c.openT || 0) + dt * 2)
      lid.current.rotation.x = -c.openT * 1.9
    }
    if (glint.current) {
      const t = state.clock.elapsedTime + c.x
      glint.current.visible = !c.opened
      const k = Math.max(0, Math.sin(t * 1.7)) ** 12
      glint.current.scale.setScalar(0.02 + k * 0.22)
    }
  })
  return (
    <group position={[c.x, c.y, c.z]} rotation-y={c.rot}>
      <mesh castShadow receiveShadow position-y={0.32}>
        <boxGeometry args={[1.1, 0.64, 0.7]} />
        <meshStandardMaterial color="#5b3a1f" roughness={0.9} />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.33, 0]}>
          <boxGeometry args={[0.08, 0.66, 0.72]} />
          <meshStandardMaterial color="#b08a3a" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <group ref={lid} position={[0, 0.64, -0.35]}>
        <mesh castShadow position={[0, 0.12, 0.35]}>
          <boxGeometry args={[1.12, 0.24, 0.72]} />
          <meshStandardMaterial color="#6a4524" roughness={0.9} />
        </mesh>
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} position={[x, 0.13, 0.35]}>
            <boxGeometry args={[0.08, 0.26, 0.74]} />
            <meshStandardMaterial color="#b08a3a" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0.72]}>
          <boxGeometry args={[0.16, 0.2, 0.05]} />
          <meshStandardMaterial color="#d6b04a" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      {/* faint sparkle so sharp eyes can spot it */}
      <mesh ref={glint} position={[0.3, 1.0, 0.36]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#fff2b0" toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Chests() {
  const chests = useMemo(() => chestSpots.map((c) => ({ ...c, opened: false, openT: 0 })), [])
  useEffect(() => {
    G.chests = chests
  }, [chests])
  return (
    <group>
      {chests.map((c, i) => (
        <Chest key={i} c={c} />
      ))}
    </group>
  )
}
