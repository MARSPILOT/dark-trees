import * as THREE from 'three'

// Low-poly building blocks used by every creature model
export function Mat({ c = '#888888', e, ei = 1, o, metal = 0, rough = 0.85, side, flat = true }) {
  return (
    <meshStandardMaterial
      color={c}
      emissive={e || '#000000'}
      emissiveIntensity={e ? ei : 1}
      transparent={o != null}
      opacity={o ?? 1}
      depthWrite={o == null}
      roughness={rough}
      metalness={metal}
      flatShading={flat}
      side={side ? THREE.DoubleSide : THREE.FrontSide}
    />
  )
}

const GEOS = {
  box: (a) => <boxGeometry args={a} />,
  ico: (a) => <icosahedronGeometry args={a} />,
  sph: (a) => <sphereGeometry args={a} />,
  cyl: (a) => <cylinderGeometry args={a} />,
  cone: (a) => <coneGeometry args={a} />,
  tor: (a) => <torusGeometry args={a} />,
  oct: (a) => <octahedronGeometry args={a} />,
  tet: (a) => <tetrahedronGeometry args={a} />,
  plane: (a) => <planeGeometry args={a} />,
  dod: (a) => <dodecahedronGeometry args={a} />,
}

const DEFAULT_ARGS = {
  box: [1, 1, 1],
  ico: [1, 1],
  sph: [1, 10, 8],
  cyl: [1, 1, 1, 7],
  cone: [1, 1, 7],
  tor: [1, 0.3, 6, 12],
  oct: [1, 0],
  tet: [1, 0],
  plane: [1, 1],
  dod: [1, 0],
}

// <P g="box" a={[w,h,d]} c="#color" e="#emissive" o={opacity} position=... rotation=... scale=... />
export function P({ g = 'box', a, c, e, ei, o, metal, rough, side, children, shadow = true, ...props }) {
  return (
    <mesh castShadow={shadow && o == null} {...props}>
      {GEOS[g](a || DEFAULT_ARGS[g])}
      <Mat c={c} e={e} ei={ei} o={o} metal={metal} rough={rough} side={side || g === 'plane'} />
      {children}
    </mesh>
  )
}

// a pair of glowing eyes
export function Eyes({ x = 0.12, y = 0, z = 0, r = 0.05, color = '#ff3b1f', ei = 3 }) {
  return (
    <>
      <P g="sph" a={[r, 6, 5]} c="#000" e={color} ei={ei} position={[x, y, z]} shadow={false} />
      <P g="sph" a={[r, 6, 5]} c="#000" e={color} ei={ei} position={[-x, y, z]} shadow={false} />
    </>
  )
}

// 0 → 1 → 0 bump over an attack (attackT counts up in seconds, -1 when idle)
export function attackCurve(m) {
  if (m.attackT < 0) return 0
  const k = m.attackT / m.def.attackTime
  if (k >= 1) return 0
  return Math.sin(k * Math.PI)
}

// bat-like wing membrane lying in the XZ plane, root at origin, spreading along +X (side=1) or -X (side=-1),
// trailing edge towards -Z (models face +Z)
const wingCache = new Map()
function wingGeometry(len) {
  if (wingCache.has(len)) return wingCache.get(len)
  const L = len
  const s = new THREE.Shape()
  s.moveTo(0, 0.15 * L)
  s.lineTo(0.45 * L, 0.22 * L)
  s.lineTo(L, 0.05 * L)
  s.lineTo(0.78 * L, -0.28 * L)
  s.lineTo(0.62 * L, -0.2 * L)
  s.lineTo(0.48 * L, -0.42 * L)
  s.lineTo(0.3 * L, -0.3 * L)
  s.lineTo(0.12 * L, -0.48 * L)
  s.lineTo(0, -0.3 * L)
  s.lineTo(0, 0.15 * L)
  const g = new THREE.ShapeGeometry(s)
  g.rotateX(-Math.PI / 2) // shape +y → world -z ... flip so the scallops trail behind
  g.scale(1, 1, -1)
  wingCache.set(len, g)
  return g
}
export function Wing({ len = 3, side = 1, c = '#3a2a30', bone = '#222' }) {
  const geo = wingGeometry(len)
  return (
    <group scale={[side, 1, 1]}>
      <mesh geometry={geo} castShadow>
        <Mat c={c} side />
      </mesh>
      <mesh position={[len * 0.5, 0.02, 0.18 * len]} rotation-z={Math.PI / 2} rotation-y={-0.15}>
        <cylinderGeometry args={[0.03 * len, 0.04 * len, len, 5]} />
        <Mat c={bone} />
      </mesh>
    </group>
  )
}
