import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { pines, birches, deadTrees, rocks, ferns, addCollider, MEADOW } from '../world/placement'
import { heightAt, ASH_TREE } from '../world/terrain'
import { fbm, mulberry32 } from '../world/noise'

const tmp = new THREE.Object3D()
const tmpColor = new THREE.Color()

function Instanced({ geometry, material, items, colorFn, castShadow = true, receiveShadow = true, transform }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    items.forEach((it, i) => {
      if (transform) transform(tmp, it)
      else {
        tmp.position.set(it.x, it.y, it.z)
        tmp.rotation.set(0, it.rot, 0)
        tmp.scale.setScalar(it.s)
      }
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
      if (colorFn) {
        colorFn(tmpColor, it, i)
        mesh.setColorAt(i, tmpColor)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
    />
  )
}

const prepare = (g) => {
  const ng = g.index ? g.toNonIndexed() : g
  ng.deleteAttribute('uv')
  return ng
}

function useGeometries() {
  return useMemo(() => {
    // pine
    const pineTrunk = new THREE.CylinderGeometry(0.16, 0.34, 3.2, 6)
    pineTrunk.translate(0, 1.6, 0)
    const layers = [
      [2.3, 3.6, 3.0],
      [1.8, 3.1, 4.8],
      [1.25, 2.7, 6.5],
      [0.7, 2.0, 8.0],
    ].map(([r, h, y]) => {
      const c = new THREE.ConeGeometry(r, h, 7, 1)
      c.translate(0, y, 0)
      return prepare(c)
    })
    const pineFoliage = mergeGeometries(layers)
    pineFoliage.computeVertexNormals()

    // birch
    const birchTrunk = new THREE.CylinderGeometry(0.11, 0.19, 6.2, 6)
    birchTrunk.translate(0, 3.1, 0)
    const blobs = [
      [1.6, 0, 5.4, 0],
      [1.2, 0.7, 6.6, 0.3],
      [1.1, -0.6, 6.2, -0.4],
      [0.9, 0.1, 7.6, 0],
    ].map(([r, x, y, z]) => {
      const b = new THREE.IcosahedronGeometry(r, 0)
      b.translate(x, y, z)
      return prepare(b)
    })
    const birchFoliage = mergeGeometries(blobs)
    birchFoliage.computeVertexNormals()

    // dead tree (trunk + bare branches)
    const parts = []
    const t = new THREE.CylinderGeometry(0.12, 0.3, 5.5, 5)
    t.translate(0, 2.75, 0)
    parts.push(prepare(t))
    ;[
      [3.2, 0.9, 0],
      [4.0, -0.8, 1.4],
      [2.4, 0.7, 2.6],
      [4.6, -0.6, 4.1],
    ].forEach(([y, tilt, ry]) => {
      const b = new THREE.CylinderGeometry(0.05, 0.1, 2, 4)
      b.translate(0, 1, 0)
      b.rotateZ(tilt)
      b.rotateY(ry)
      b.translate(0, y, 0)
      parts.push(prepare(b))
    })
    const dead = mergeGeometries(parts)
    dead.computeVertexNormals()

    // rocks (3 variants, deformed by noise keyed on position so faces stay closed)
    const rockGeos = [0, 1, 2].map((v) => {
      const g = new THREE.IcosahedronGeometry(1, 1)
      const p = g.attributes.position
      const vtx = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        vtx.fromBufferAttribute(p, i)
        const n = fbm(vtx.x * 1.3 + v * 10, vtx.z * 1.3 + vtx.y * 0.7, 2)
        vtx.multiplyScalar(1 + n * 0.35)
        p.setXYZ(i, vtx.x, vtx.y, vtx.z)
      }
      g.computeVertexNormals()
      return g
    })

    // fern / grass tuft: a few thin blades leaning outwards
    const blades = []
    for (let i = 0; i < 6; i++) {
      const b = new THREE.ConeGeometry(0.12, 1.0, 3, 1)
      b.translate(0, 0.5, 0)
      b.rotateX(0.55 + (i % 2) * 0.25)
      b.rotateY((i / 6) * Math.PI * 2)
      blades.push(prepare(b))
    }
    const fern = mergeGeometries(blades)
    fern.computeVertexNormals()
    const bush = new THREE.IcosahedronGeometry(0.7, 0)
    bush.scale(1, 0.7, 1)
    bush.translate(0, 0.35, 0)

    return { pineTrunk, pineFoliage, birchTrunk, birchFoliage, dead, rockGeos, fern, bush }
  }, [])
}

function useMaterials() {
  return useMemo(
    () => ({
      bark: new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 }),
      pine: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }),
      birchBark: new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.9 }),
      birchLeaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
      deadWood: new THREE.MeshStandardMaterial({ color: '#5c5249', roughness: 1, flatShading: true }),
      rock: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, flatShading: true }),
      plant: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }),
    }),
    []
  )
}

const rockGroups = [0, 1, 2].map((v) => rocks.filter((r) => r.variant === v))
const fernGroups = [ferns.filter((f) => f.kind === 0), ferns.filter((f) => f.kind === 1)]

export function Vegetation() {
  const geo = useGeometries()
  const mat = useMaterials()

  const pineColor = (c, it, i) => {
    const n = ((i * 9301 + 49297) % 233280) / 233280
    c.setHSL(0.3 + n * 0.06, 0.38 + n * 0.15, 0.13 + n * 0.08 + (it.y > 35 ? 0.03 : 0))
  }
  const birchColor = (c, it, i) => {
    const n = ((i * 7919) % 1000) / 1000
    c.setHSL(0.17 + n * 0.08, 0.55, 0.32 + n * 0.1)
  }
  const rockColor = (c, it, i) => {
    const n = ((i * 4271) % 1000) / 1000
    c.setHSL(0.08 + n * 0.05, 0.06 + n * 0.05, 0.3 + n * 0.14)
  }
  const plantColor = (c, it, i) => {
    const n = ((i * 1543) % 1000) / 1000
    c.setHSL(0.22 + n * 0.1, 0.45, 0.17 + n * 0.1)
  }
  const rockTransform = (o, r) => {
    o.position.set(r.x, r.y, r.z)
    o.rotation.set(r.tilt, r.rot, r.tilt * 0.5)
    o.scale.set(r.s, r.s * r.sy, r.s * (0.8 + r.sy * 0.3))
  }

  return (
    <group>
      <Instanced geometry={geo.pineTrunk} material={mat.bark} items={pines} />
      <Instanced geometry={geo.pineFoliage} material={mat.pine} items={pines} colorFn={pineColor} />
      <Instanced geometry={geo.birchTrunk} material={mat.birchBark} items={birches} />
      <Instanced geometry={geo.birchFoliage} material={mat.birchLeaf} items={birches} colorFn={birchColor} />
      <Instanced geometry={geo.dead} material={mat.deadWood} items={deadTrees} />
      {rockGroups.map((g, i) => (
        <Instanced
          key={i}
          geometry={geo.rockGeos[i]}
          material={mat.rock}
          items={g}
          colorFn={rockColor}
          transform={rockTransform}
        />
      ))}
      <Instanced geometry={geo.fern} material={mat.plant} items={fernGroups[0]} colorFn={plantColor} castShadow={false} />
      <Instanced geometry={geo.bush} material={mat.plant} items={fernGroups[1]} colorFn={plantColor} castShadow={false} />
      <AncientAsh />
      <RuneStones />
    </group>
  )
}

// ------------------------------------------------------------ The ancient ash (landmark)
addCollider(ASH_TREE.x, ASH_TREE.z, 5.2)

function AncientAsh() {
  const y = heightAt(ASH_TREE.x, ASH_TREE.z)
  const { roots, blobs, branches } = useMemo(() => {
    const r = mulberry32(7)
    const roots = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + r() * 0.3
      return { a, len: 7 + r() * 5, tilt: 1.1 + r() * 0.25 }
    })
    const branches = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + r()
      return { a, y: 20 + r() * 9, len: 9 + r() * 6, tilt: 0.9 + r() * 0.4 }
    })
    const blobs = Array.from({ length: 22 }, () => {
      const a = r() * Math.PI * 2
      const d = 4 + r() * 13
      return { x: Math.cos(a) * d, y: 30 + r() * 12 - d * 0.25, z: Math.sin(a) * d, s: 5 + r() * 4 }
    })
    return { roots, blobs, branches }
  }, [])
  return (
    <group position={[ASH_TREE.x, y, ASH_TREE.z]}>
      <mesh castShadow receiveShadow position-y={15}>
        <cylinderGeometry args={[2.6, 4.6, 32, 10]} />
        <meshStandardMaterial color="#4b3b2e" roughness={1} flatShading />
      </mesh>
      {roots.map((rt, i) => (
        <group key={i} rotation-y={rt.a}>
          <mesh castShadow position={[rt.len * 0.45, 0.6, 0]} rotation-z={rt.tilt}>
            <cylinderGeometry args={[0.5, 1.6, rt.len, 6]} />
            <meshStandardMaterial color="#45362a" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      {branches.map((b, i) => (
        <group key={i} rotation-y={b.a} position-y={b.y}>
          <mesh castShadow position={[b.len * 0.42, b.len * 0.3, 0]} rotation-z={-b.tilt}>
            <cylinderGeometry args={[0.4, 1.1, b.len, 6]} />
            <meshStandardMaterial color="#4b3b2e" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      {blobs.map((b, i) => (
        <mesh key={i} castShadow position={[b.x, b.y, b.z]} scale={b.s}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={i % 3 ? '#3e5f2c' : '#56732f'} roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// ------------------------------------------------------------ Standing stones around the meadow
const STONES = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2
  const x = MEADOW.x + Math.cos(a) * (MEADOW.r - 6)
  const z = MEADOW.z + Math.sin(a) * (MEADOW.r - 6)
  addCollider(x, z, 0.9)
  return { x, z, y: heightAt(x, z), a, h: 3 + (i % 3) * 0.8 }
})

function RuneStones() {
  return (
    <group>
      {STONES.map((s, i) => (
        <group key={i} position={[s.x, s.y, s.z]} rotation-y={-s.a}>
          <mesh castShadow receiveShadow position-y={s.h / 2 - 0.3}>
            <boxGeometry args={[0.6, s.h, 1.4]} />
            <meshStandardMaterial color="#77736b" roughness={1} flatShading />
          </mesh>
          <mesh position={[-0.31, s.h / 2, 0]}>
            <boxGeometry args={[0.02, s.h * 0.7, 0.12]} />
            <meshBasicMaterial color="#5fd3c4" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
