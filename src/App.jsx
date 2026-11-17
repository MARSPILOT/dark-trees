import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, G } from './store'
import { Terrain, Water, Waterfall, Sky, Lights, FOG_COLOR } from './components/Environment'
import { Vegetation } from './components/Vegetation'
import { Chests } from './components/Chests'
import { Player } from './components/Player'
import { Arrows } from './components/Arrows'
import { Projectiles, clearProjectiles } from './components/Projectiles'
import { Particles } from './components/Particles'
import { Monsters } from './monsters/Monsters'
import { HUD } from './HUD'

// everything that resets when a new hunt begins
function Round() {
  useEffect(() => {
    G.arrows.length = 0
    clearProjectiles()
  }, [])
  return (
    <>
      <Monsters />
      <Chests />
      <Player />
    </>
  )
}

export default function App() {
  const gameId = useGame((s) => s.gameId)
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 72, near: 0.08, far: 1100, position: [0, 10, 0] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      >
        <color attach="background" args={[FOG_COLOR]} />
        <fog attach="fog" args={[FOG_COLOR, 20, 230]} />
        <Suspense fallback={null}>
          <Sky />
          <Lights />
          <Terrain />
          <Water />
          <Waterfall />
          <Vegetation />
          <Round key={gameId} />
          <Arrows />
          <Projectiles />
          <Particles />
        </Suspense>
      </Canvas>
      <HUD />
    </>
  )
}
