import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G } from '../store'

const MAX = 700
const dummy = new THREE.Object3D()
const col = new THREE.Color()

// pooled instanced particles for blood, sparks, splashes and dust
export function Particles() {
  const ref = useRef()
  const parts = useMemo(
    () =>
      Array.from({ length: MAX }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        life: 0,
        max: 1,
        size: 0.1,
        g: 9,
      })),
    []
  )
  const cursor = useRef(0)

  useEffect(() => {
    G.fx = {
      emit(pos, color, count = 10, speed = 4, opts = {}) {
        const mesh = ref.current
        if (!mesh) return
        col.set(color)
        for (let i = 0; i < count; i++) {
          const idx = cursor.current
          cursor.current = (cursor.current + 1) % MAX
          const pt = parts[idx]
          pt.p.copy(pos)
          pt.v.set((Math.random() - 0.5) * 2, Math.random() * 1.2 + 0.2, (Math.random() - 0.5) * 2).multiplyScalar(speed * (0.4 + Math.random() * 0.6))
          pt.max = pt.life = (opts.life || 0.9) * (0.6 + Math.random() * 0.6)
          pt.size = (opts.size || 0.12) * (0.6 + Math.random() * 0.8)
          pt.g = opts.gravity ?? 9
          mesh.setColorAt(idx, col)
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      },
    }
    return () => (G.fx = null)
  }, [])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < MAX; i++) {
      const pt = parts[i]
      if (pt.life > 0) {
        pt.life -= dt
        pt.v.y -= pt.g * dt
        pt.p.addScaledVector(pt.v, dt)
        dummy.position.copy(pt.p)
        dummy.scale.setScalar(Math.max(0, pt.life / pt.max) * pt.size)
      } else {
        dummy.scale.setScalar(0)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[null, null, MAX]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  )
}
