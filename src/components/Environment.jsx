import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  heightAt,
  riverX,
  TERRAIN_SIZE,
  WATER_LEVEL,
  UPPER_WATER_LEVEL,
  FALL_X,
  FALL_TOP_Z,
  FALL_BOTTOM_Z,
  WORLD_HALF,
} from '../world/terrain'
import { fbm } from '../world/noise'
import { G } from '../store'

// The blood moon hangs low over the southern mountains (the player starts facing it)
export const SUN_DIR = new THREE.Vector3(0.3, 0.66, 0.81).normalize()
export const MOON_DIR = SUN_DIR
export const FOG_COLOR = '#1c1420'
const MOON_RADIUS = 0.16 // radians (~9°): a huge moon

// ------------------------------------------------------------ Terrain
export function Terrain() {
  const geometry = useMemo(() => {
    const seg = 320
    const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, heightAt(x, z))
    }
    g.computeVertexNormals()
    const nrm = g.attributes.normal
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const grass = new THREE.Color('#3d5a2a')
    const grass2 = new THREE.Color('#5b6b2f')
    const moss = new THREE.Color('#2c4524')
    const dirt = new THREE.Color('#5a4630')
    const sand = new THREE.Color('#8a7a5c')
    const bed = new THREE.Color('#3b3a30')
    const rock = new THREE.Color('#6b6862')
    const rockDark = new THREE.Color('#47474a')
    const snow = new THREE.Color('#e8eef4')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const ny = nrm.getY(i)
      const n1 = fbm(x * 0.05, z * 0.05, 3)
      const n2 = fbm(x * 0.2 + 7, z * 0.2, 2)
      c.copy(grass).lerp(grass2, THREE.MathUtils.clamp(n1 * 0.8 + 0.4, 0, 1))
      c.lerp(moss, THREE.MathUtils.clamp(-n2, 0, 0.6))
      if (n2 > 0.45) c.lerp(dirt, 0.5)
      const upper = z < FALL_TOP_Z + 1 && Math.abs(x - FALL_X) < 90
      const wl = upper ? UPPER_WATER_LEVEL : WATER_LEVEL
      if (y < wl + 1.1) c.lerp(sand, THREE.MathUtils.clamp((wl + 1.1 - y) / 1.2, 0, 1))
      if (y < wl - 0.6) c.lerp(bed, 0.7)
      // rocky slopes
      const steep = THREE.MathUtils.smoothstep(1 - ny, 0.22, 0.42)
      c.lerp(n1 > 0 ? rock : rockDark, steep)
      // high altitude rock + snow
      if (y > 34) c.lerp(rock, THREE.MathUtils.clamp((y - 34) / 14, 0, 0.85))
      const snowLine = 58 + n1 * 8
      if (y > snowLine && ny > 0.55) c.lerp(snow, THREE.MathUtils.clamp((y - snowLine) / 6, 0, 1))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  )
}

// ------------------------------------------------------------ Water
const waterVert = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`
const waterFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform vec3 uGlint;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;
    float a1 = p.x * 0.35 + t * 1.3;
    float a2 = p.y * 0.42 - t * 1.1;
    float a3 = (p.x + p.y) * 0.9 + t * 2.0;
    float a4 = (p.x - p.y) * 1.7 - t * 2.6;
    float w = sin(a1) * 0.5 + sin(a2) * 0.5 + sin(a3) * 0.25;
    vec3 n = normalize(vec3(
      cos(a1) * 0.12 + cos(a3) * 0.08 + cos(a4) * 0.05,
      1.0,
      cos(a2) * 0.12 + cos(a3) * 0.08 - cos(a4) * 0.05));
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    vec3 col = mix(uDeep, uShallow, 0.4 + 0.18 * w);
    col = mix(col, uSky, clamp(fres * 0.85, 0.0, 1.0));
    vec3 H = normalize(uSun + V);
    float spec = pow(max(dot(n, H), 0.0), 90.0) * 2.0;
    col += spec * uGlint;
    gl_FragColor = vec4(col, 0.86);
    #include <fog_fragment>
  }
`

function makeWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#03060a') },
        uShallow: { value: new THREE.Color('#0d1820') },
        uSky: { value: new THREE.Color('#3a1a1e') },
        uGlint: { value: new THREE.Color('#ff6a40') },
        uSun: { value: SUN_DIR.clone() },
      },
    ]),
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    transparent: true,
    fog: true,
    depthWrite: false,
  })
}

export function Water() {
  const mat = useMemo(makeWaterMaterial, [])
  useFrame((_, dt) => (mat.uniforms.uTime.value += dt))
  const upperLen = FALL_TOP_Z + WORLD_HALF
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_LEVEL} material={mat} renderOrder={1}>
        <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE, 1, 1]} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[FALL_X, UPPER_WATER_LEVEL, (FALL_TOP_Z - WORLD_HALF) / 2]}
        material={mat}
        renderOrder={1}
      >
        <planeGeometry args={[176, upperLen, 1, 1]} />
      </mesh>
    </group>
  )
}

// ------------------------------------------------------------ Waterfall
const fallFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 uv = vUv;
    float streak = noise(vec2(uv.x * 38.0, uv.y * 3.0 - uTime * 2.6));
    streak += noise(vec2(uv.x * 80.0, uv.y * 6.0 - uTime * 4.1)) * 0.6;
    streak /= 1.6;
    vec3 deep = vec3(0.07, 0.1, 0.14);
    vec3 foam = vec3(0.62, 0.5, 0.52);
    vec3 col = mix(deep, foam, smoothstep(0.35, 0.8, streak));
    col = mix(col, foam, smoothstep(0.75, 1.0, uv.y) * 0.7);
    float edge = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
    gl_FragColor = vec4(col, (0.75 + streak * 0.25) * edge);
    #include <fog_fragment>
  }
`
const fallVert = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

export function Waterfall() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
        vertexShader: fallVert,
        fragmentShader: fallFrag,
        transparent: true,
        fog: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  )
  const geometry = useMemo(() => {
    const rows = 40
    const cols = 12
    const width = 13
    const z0 = FALL_TOP_Z - 0.5
    const z1 = FALL_BOTTOM_Z + 2
    const verts = []
    const uvs = []
    const idx = []
    for (let i = 0; i <= rows; i++) {
      const t = i / rows
      const z = THREE.MathUtils.lerp(z0, z1, Math.pow(t, 0.7))
      let y = THREE.MathUtils.lerp(UPPER_WATER_LEVEL + 0.1, WATER_LEVEL + 0.1, t * t * 0.4 + t * 0.6)
      const cx = riverX(z)
      for (let j = 0; j <= cols; j++) {
        const s = j / cols
        const x = cx + (s - 0.5) * width
        const ground = heightAt(x, z) + 0.45
        const yy = Math.max(y, ground)
        verts.push(x, yy, z)
        uvs.push(s, 1 - t)
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j
        const b = a + cols + 1
        idx.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])

  // mist puffs at the base
  const mist = useRef()
  const puffs = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        x: riverX(FALL_BOTTOM_Z + 2) + (Math.random() - 0.5) * 14,
        z: FALL_BOTTOM_Z + 2 + Math.random() * 8,
        phase: Math.random() * 10,
        s: 1.5 + Math.random() * 2.5,
      })),
    []
  )
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
    if (!mist.current) return
    const t = mat.uniforms.uTime.value
    mist.current.children.forEach((m, i) => {
      const p = puffs[i]
      const k = (t * 0.25 + p.phase) % 1
      m.position.set(p.x + Math.sin(t + p.phase) * 0.6, 0.5 + k * 6, p.z + k * 4)
      m.scale.setScalar(p.s * (0.6 + k))
      m.material.opacity = 0.16 * (1 - k)
    })
  })

  return (
    <group>
      <mesh geometry={geometry} material={mat} renderOrder={2} />
      <group ref={mist}>
        {puffs.map((p, i) => (
          <mesh key={i} renderOrder={3}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#6d5560" transparent opacity={0.3} depthWrite={false} fog={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ------------------------------------------------------------ Night sky with a huge blood-red moon
export function Sky() {
  const mat = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const u = new THREE.Vector3().crossVectors(MOON_DIR, up).normalize()
    const v = new THREE.Vector3().crossVectors(u, MOON_DIR).normalize()
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uMoon: { value: MOON_DIR.clone() },
        uU: { value: u },
        uV: { value: v },
        uRadius: { value: Math.sin(MOON_RADIUS) },
        uFog: { value: new THREE.Color(FOG_COLOR).convertLinearToSRGB() },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uMoon, uU, uV, uFog;
        uniform float uRadius, uTime;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float s = max(dot(d, uMoon), 0.0);
          // night gradient, warmer near the horizon under the moon
          vec3 zenith = vec3(0.012, 0.012, 0.035);
          vec3 mid = vec3(0.045, 0.025, 0.06);
          vec3 horizon = vec3(0.2, 0.06, 0.07);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
          col = mix(col, zenith, smoothstep(0.25, 0.8, h));
          col = mix(uFog, col, smoothstep(-0.03, 0.14, h));
          // stars
          vec2 sp = vec2(atan(d.z, d.x) * 120.0, h * 240.0);
          vec2 cell = floor(sp);
          float star = step(0.992, hash(cell)) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5));
          float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 7.0) * 30.0);
          col += vec3(0.9, 0.85, 1.0) * star * twinkle * smoothstep(0.05, 0.3, h) * (1.0 - smoothstep(0.7, 0.95, s));
          // red halo
          col += vec3(0.9, 0.18, 0.08) * pow(s, 18.0) * 0.55;
          col += vec3(0.6, 0.1, 0.05) * pow(s, 4.0) * 0.12;
          // the moon disc
          vec2 m = vec2(dot(d, uU), dot(d, uV)) / uRadius;
          float r = length(m);
          if (dot(d, uMoon) > 0.0 && r < 1.0) {
            float maria = vnoise(m * 1.7 + 4.0) * 0.55 + vnoise(m * 3.6 + 9.0) * 0.3 + vnoise(m * 8.0) * 0.15;
            float craters = smoothstep(0.6, 0.75, vnoise(m * 11.0 + 2.0)) * 0.6;
            float limb = sqrt(1.0 - r * r);
            vec3 base = mix(vec3(1.0, 0.36, 0.18), vec3(0.62, 0.12, 0.07), smoothstep(0.3, 0.8, maria));
            base -= craters * 0.08;
            vec3 moon = base * (0.55 + 0.6 * limb);
            float edge = smoothstep(1.0, 0.97, r);
            col = mix(col, moon, edge);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  }, [])
  const ref = useRef()
  useFrame(({ camera }, dt) => {
    mat.uniforms.uTime.value += dt
    if (ref.current) ref.current.position.copy(camera.position)
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 48, 24]} />
    </mesh>
  )
}

// ------------------------------------------------------------ Lights: red moonlight (shadows follow the player) + a lantern glow
export function Lights() {
  const moon = useRef()
  const lantern = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ camera }) => {
    const p = G.player.pos
    if (moon.current) moon.current.position.set(p.x + SUN_DIR.x * 120, p.y + SUN_DIR.y * 120, p.z + SUN_DIR.z * 120)
    target.position.set(p.x, p.y, p.z)
    target.updateMatrixWorld()
    if (lantern.current) lantern.current.position.set(camera.position.x, camera.position.y + 0.3, camera.position.z)
  })
  return (
    <>
      <hemisphereLight args={['#5a4c82', '#1c100c', 1.15]} />
      <ambientLight color="#3a2a40" intensity={0.35} />
      <primitive object={target} />
      <directionalLight
        ref={moon}
        target={target}
        color="#ff7a5c"
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={300}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
      {/* faint warm glow around the hunter so the nearby ground stays readable */}
      <pointLight ref={lantern} color="#ffb070" intensity={14} distance={18} decay={1.6} />
    </>
  )
}
