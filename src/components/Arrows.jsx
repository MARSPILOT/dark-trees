import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { G, useGame } from '../store'
import { heightAt, waterLevelAt } from '../world/terrain'
import { pointBlocked } from '../world/placement'
import { segmentHit, hitMonster } from '../monsters/brain'
import { sfx } from '../audio'

const MAX = 50
const GRAVITY = 9.8

export function fireArrow(origin, dir, power) {
  const speed = 32 + power * 58
  G.arrows.push({
    pos: origin.clone(),
    prev: origin.clone(),
    vel: dir.clone().multiplyScalar(speed),
    damage: 12 + power * 38,
    stuck: false,
    life: 25,
    quat: new THREE.Quaternion(),
  })
  if (G.arrows.length > MAX) G.arrows.shift()
}

export function arrowGeometry() {
  const shaft = new THREE.CylinderGeometry(0.018, 0.018, 1.0, 5)
  shaft.rotateX(Math.PI / 2)
  const head = new THREE.ConeGeometry(0.045, 0.14, 4)
  head.rotateX(Math.PI / 2)
  head.translate(0, 0, 0.56)
  const f1 = new THREE.BoxGeometry(0.005, 0.07, 0.16)
  f1.translate(0, 0.03, -0.42)
  const f2 = new THREE.BoxGeometry(0.07, 0.005, 0.16)
  f2.translate(0.03, 0, -0.42)
  const parts = [shaft, head, f1, f2].map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    n.deleteAttribute('uv')
    n.deleteAttribute('normal')
    return n
  })
  // vertex colours: wood shaft, iron head, white fletching
  const colors = ['#8a6a44', '#9aa0a6', '#e9e4da', '#e9e4da'].map((c) => new THREE.Color(c))
  parts.forEach((g, i) => {
    const arr = new Float32Array(g.attributes.position.count * 3)
    for (let k = 0; k < g.attributes.position.count; k++) {
      arr[k * 3] = colors[i].r
      arr[k * 3 + 1] = colors[i].g
      arr[k * 3 + 2] = colors[i].b
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  })
  const merged = mergeGeometries(parts)
  merged.computeVertexNormals()
  return merged
}

const dummy = new THREE.Object3D()
const fwd = new THREE.Vector3(0, 0, 1)
const tmpDir = new THREE.Vector3()

export function stepArrows(dt) {
  const list = G.arrows
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i]
    a.life -= dt
    if (a.life <= 0) {
      list.splice(i, 1)
      continue
    }
    if (a.stuck) continue
    // integrate in substeps so fast arrows can't tunnel through creatures
    const steps = 3
    let done = false
    for (let s = 0; s < steps && !done; s++) {
      const h = dt / steps
      a.prev.copy(a.pos)
      a.vel.y -= GRAVITY * h
      a.pos.addScaledVector(a.vel, h)
      const hit = segmentHit(a.prev, a.pos)
      if (hit) {
        hitMonster(hit.m, a.damage, hit.point)
        list.splice(i, 1)
        done = true
        break
      }
      const ground = heightAt(a.pos.x, a.pos.z)
      const water = waterLevelAt(a.pos.x, a.pos.z)
      if (a.pos.y < water && water > ground) {
        if (G.fx) G.fx.emit(a.pos, '#cfe6ee', 10, 3)
        sfx.splash()
        list.splice(i, 1)
        done = true
        break
      }
      if (a.pos.y < ground) {
        a.pos.y = ground + 0.05
        a.stuck = true
        a.life = Math.min(a.life, 12)
        if (G.fx) G.fx.emit(a.pos, '#5a4630', 6, 2)
        sfx.thunk()
        done = true
        break
      }
      // tree trunks and boulders (only near the ground where trunks are)
      if (a.pos.y - ground < 6) {
        const c = pointBlocked(a.pos.x, a.pos.z)
        if (c) {
          a.stuck = true
          a.life = Math.min(a.life, 12)
          sfx.thunk()
          done = true
          break
        }
      }
    }
    if (!done || (list[i] === a && a.stuck)) {
      if (!a.stuck) a.quat.setFromUnitVectors(fwd, tmpDir.copy(a.vel).normalize())
    }
  }
}

export function Arrows() {
  const ref = useRef()
  const geometry = useMemo(arrowGeometry, [])

  useFrame((_, delta) => {
    const phase = useGame.getState().phase
    const dt = phase === 'playing' || phase === 'dead' ? Math.min(delta, 0.05) : 0
    stepArrows(dt)
    const list = G.arrows
    const mesh = ref.current
    if (!mesh) return
    let n = 0
    for (const a of list) {
      dummy.position.copy(a.pos)
      dummy.quaternion.copy(a.quat)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(n++, dummy.matrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geometry, null, MAX + 5]} frustumCulled={false} castShadow>
      <meshStandardMaterial vertexColors roughness={0.7} />
    </instancedMesh>
  )
}
