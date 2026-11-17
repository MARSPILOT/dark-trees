import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { G, useGame, MAX_HEALTH } from '../store'
import { heightAt, waterLevelAt, PLAY_RADIUS } from '../world/terrain'
import { resolveCollisions, PLAYER_SPAWN } from '../world/placement'
import { fireArrow, arrowGeometry } from './Arrows'
import { openChest } from './Chests'
import { sfx } from '../audio'
import { MOON_DIR } from './Environment'

const EYE = 1.65
const DRAW_TIME = 0.85
const RELOAD = 0.35
const keys = {}
const mouse = { down: false, pressed: false } // pressed latches quick taps between frames
const look = { yaw: Math.PI * 0.9, pitch: 0 }

const fwd = new THREE.Vector3()
const right = new THREE.Vector3()
const wish = new THREE.Vector3()
const camDir = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)

// Mouse input state. Pointer lock is preferred; if the browser refuses it (embedded browsers,
// iframes, privacy settings, or re-locking too soon after Esc) we fall back to "free look":
// raw mouse movement turns the camera, and pushing the hidden cursor to a screen edge keeps turning.
export const input = { fallback: false, inside: false, x: 0, y: 0, lastFail: 0 }

function setFallback(on) {
  if (input.fallback === on) return
  input.fallback = on
  useGame.getState().setMouseMode(on ? 'free' : 'lock')
}

export function requestLock() {
  sfx.unlock()
  const canvas = document.querySelector('canvas')
  if (!canvas || !canvas.requestPointerLock) {
    setFallback(true)
    return
  }
  if (document.pointerLockElement) return
  try {
    const p = canvas.requestPointerLock()
    if (p && p.catch) p.catch(onLockFail)
  } catch (e) {
    onLockFail()
  }
}

function onLockFail() {
  input.lastFail = performance.now()
  setFallback(true)
  // the player asked to play; don't leave them stuck on the pause screen
  const g = useGame.getState()
  if (g.phase === 'paused') g.setPhase('playing')
}

// resume from the pause screen (works with or without pointer lock)
export function resumeGame() {
  const g = useGame.getState()
  if (g.phase !== 'paused') return
  requestLock()
  if (input.fallback) g.setPhase('playing')
}

const LOOK_SPEED = 0.0022
const EDGE = 0.06 // fraction of the screen that acts as a "keep turning" zone in free-look

export function Player() {
  const { camera, gl } = useThree()
  const bow = useRef()
  const stringTop = useRef()
  const stringBot = useRef()
  const nocked = useRef()
  const state = useRef({ charge: 0, drawing: false, reload: 0, bob: 0, lastCharge: -1, regenT: 0 })

  // dev-only hook for automated testing
  useEffect(() => {
    if (import.meta.env.DEV) window.__dt = { look, G, keys, mouse, useGame, gl, input }
  }, [])

  // spawn
  useEffect(() => {
    const P = G.player
    P.pos.set(PLAYER_SPAWN.x, heightAt(PLAYER_SPAWN.x, PLAYER_SPAWN.z), PLAYER_SPAWN.z)
    P.vel.set(0, 0, 0)
    // start facing the blood moon
    look.yaw = Math.atan2(-MOON_DIR.x, -MOON_DIR.z)
    look.pitch = 0.28
  }, [])

  // input
  useEffect(() => {
    const onKey = (e, v) => {
      keys[e.code] = v
      if (v && e.code === 'KeyE') tryOpenChest()
      if (v && e.code === 'Space') e.preventDefault()
    }
    const kd = (e) => onKey(e, true)
    const ku = (e) => onKey(e, false)
    const mm = (e) => {
      input.x = e.clientX
      input.y = e.clientY
      input.inside = true
      if (useGame.getState().phase !== 'playing') return
      const locked = !!document.pointerLockElement
      if (!locked && !input.fallback) return
      let dx = e.movementX || 0
      let dy = e.movementY || 0
      // some browsers emit a huge spurious jump right after locking
      if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return
      look.yaw -= dx * LOOK_SPEED
      look.pitch -= dy * LOOK_SPEED
      look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch))
    }
    const md = (e) => {
      if (e.button !== 0) return
      const phase = useGame.getState().phase
      if (phase === 'paused') {
        resumeGame()
        return
      }
      if (phase !== 'playing') return
      if (!document.pointerLockElement) {
        // retry the lock now and then (e.g. Chrome refuses re-locking for ~1s after Esc)
        if (!input.fallback || performance.now() - input.lastFail > 3000) requestLock()
        if (!input.fallback) return
      }
      mouse.down = true
      mouse.pressed = true
    }
    const mu = (e) => {
      if (e.button === 0) mouse.down = false
    }
    const plc = () => {
      const g = useGame.getState()
      const locked = !!document.pointerLockElement
      if (locked) {
        setFallback(false)
        if (g.phase === 'paused') g.setPhase('playing')
      } else if (g.phase === 'playing' && !input.fallback) {
        g.setPhase('paused') // Esc released the lock
      }
      mouse.down = false
    }
    const ple = () => onLockFail()
    const escKey = (e) => {
      // in free-look there is no lock for Esc to release, so handle pausing ourselves
      if ((e.code === 'Escape' || e.code === 'KeyP') && !document.pointerLockElement) {
        const g = useGame.getState()
        if (g.phase === 'playing') g.setPhase('paused')
        else if (g.phase === 'paused' && e.code === 'KeyP') resumeGame()
      }
    }
    const leave = () => (input.inside = false)
    const noMenu = (e) => {
      if (useGame.getState().phase === 'playing') e.preventDefault()
    }
    const blur = () => {
      for (const k in keys) keys[k] = false
      mouse.down = false
      input.inside = false
    }
    document.addEventListener('pointerlockerror', ple)
    document.addEventListener('mouseleave', leave)
    window.addEventListener('keydown', escKey)
    window.addEventListener('contextmenu', noMenu)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('mousemove', mm)
    window.addEventListener('mousedown', md)
    window.addEventListener('mouseup', mu)
    window.addEventListener('blur', blur)
    document.addEventListener('pointerlockchange', plc)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mousedown', md)
      window.removeEventListener('mouseup', mu)
      window.removeEventListener('blur', blur)
      document.removeEventListener('pointerlockchange', plc)
      document.removeEventListener('pointerlockerror', ple)
      document.removeEventListener('mouseleave', leave)
      window.removeEventListener('keydown', escKey)
      window.removeEventListener('contextmenu', noMenu)
    }
  }, [])

  function nearestChest() {
    const P = G.player.pos
    let best = null
    let bd = 2.8
    for (const c of G.chests) {
      if (c.opened) continue
      const d = Math.hypot(c.x - P.x, c.z - P.z)
      if (d < bd && Math.abs(c.y - P.y) < 2.5) {
        bd = d
        best = c
      }
    }
    return best
  }
  function tryOpenChest() {
    if (useGame.getState().phase !== 'playing') return
    const c = nearestChest()
    if (c) openChest(c)
  }

  const arrowGeo = useMemo(arrowGeometry, [])

  useFrame((_, delta) => {
    const game = useGame.getState()
    const P = G.player
    const S = state.current
    const dt = Math.min(delta, 0.05)
    const playing = game.phase === 'playing'
    G.time += playing ? dt : 0

    // ---------------- free-look: hide cursor, keep turning while it rests at a screen edge
    const free = playing && input.fallback && !document.pointerLockElement
    if (free !== S.free) {
      S.free = free
      document.body.classList.toggle('free-look', free)
    }
    if (free && input.inside) {
      const ex = input.x / window.innerWidth
      const ey = input.y / window.innerHeight
      if (ex < EDGE) look.yaw += ((EDGE - ex) / EDGE) * 2.4 * dt
      else if (ex > 1 - EDGE) look.yaw -= ((ex - (1 - EDGE)) / EDGE) * 2.4 * dt
      if (ey < EDGE) look.pitch += ((EDGE - ey) / EDGE) * 1.4 * dt
      else if (ey > 1 - EDGE) look.pitch -= ((ey - (1 - EDGE)) / EDGE) * 1.4 * dt
      look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch))
    }

    if (playing) {
      // ---------------- movement
      fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw))
      right.set(-fwd.z, 0, fwd.x)
      let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0)
      let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
      wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, s)
      if (wish.lengthSq() > 0) wish.normalize()
      const ground0 = heightAt(P.pos.x, P.pos.z)
      const wl = waterLevelAt(P.pos.x, P.pos.z)
      const depth = wl - ground0
      const swimming = depth > 1.25 && P.pos.y < wl - 0.6
      P.inWater = depth > 0.3
      const sprint = (keys.ShiftLeft || keys.ShiftRight) && f > 0 && !S.drawing
      let speed = sprint ? 10.5 : 6.2
      if (P.inWater) speed *= swimming ? 0.5 : 0.7
      if (S.drawing) speed *= 0.55
      const accel = P.onGround || swimming ? 12 : 2.5
      const k = 1 - Math.exp(-dt * accel)
      P.vel.x += (wish.x * speed - P.vel.x) * k
      P.vel.z += (wish.z * speed - P.vel.z) * k

      if (swimming) {
        const target = wl - 1.2
        P.vel.y += (target - P.pos.y) * 6 * dt - P.vel.y * 3 * dt
        if (keys.Space) P.vel.y += 8 * dt
      } else {
        P.vel.y -= 22 * dt
      }
      if (keys.Space && P.onGround) {
        P.vel.y = 7.5
        P.onGround = false
      }

      const ox = P.pos.x
      const oz = P.pos.z
      P.pos.x += P.vel.x * dt
      P.pos.z += P.vel.z * dt
      resolveCollisions(P.pos, 0.45)
      // steep cliffs cannot be climbed
      const ground1 = heightAt(P.pos.x, P.pos.z)
      const horiz = Math.hypot(P.pos.x - ox, P.pos.z - oz)
      if (P.onGround && ground1 - ground0 > horiz * 1.6 + 0.02) {
        P.pos.x = ox
        P.pos.z = oz
      }
      const r = Math.hypot(P.pos.x, P.pos.z)
      if (r > PLAY_RADIUS) {
        P.pos.x *= PLAY_RADIUS / r
        P.pos.z *= PLAY_RADIUS / r
      }
      P.pos.y += P.vel.y * dt
      const g = heightAt(P.pos.x, P.pos.z)
      if (P.pos.y <= g) {
        P.pos.y = g
        if (P.vel.y < 0) P.vel.y = 0
        P.onGround = true
      } else if (P.pos.y > g + 0.15) {
        P.onGround = false
      }
      if (P.onGround && P.pos.y - g < 0.4) P.pos.y = g

      // ---------------- bow
      S.reload -= dt
      if ((mouse.down || mouse.pressed) && !S.drawing && S.reload <= 0) {
        mouse.pressed = false
        if (game.arrows > 0) {
          S.drawing = true
          S.charge = 0
          sfx.draw()
        } else {
          mouse.down = false
          sfx.empty()
          game.message('Your quiver is empty — search the forest for chests!')
        }
      }
      if (S.drawing) {
        S.charge = Math.min(1, S.charge + dt / DRAW_TIME)
        if (!mouse.down) {
          if (game.useArrow()) {
            camera.getWorldDirection(camDir)
            const origin = camera.position.clone().addScaledVector(camDir, 0.6)
            origin.y -= 0.05
            fireArrow(origin, camDir, S.charge)
            sfx.shoot(S.charge)
          }
          S.drawing = false
          S.charge = 0
          S.reload = RELOAD
        }
      }
      const rounded = Math.round(S.charge * 20) / 20
      if (rounded !== S.lastCharge) {
        S.lastCharge = rounded
        game.setCharge(rounded)
      }

      // ---------------- chest prompt
      const c = nearestChest()
      game.setPrompt(c ? 'Press E to open the chest' : null)

      // ---------------- slow health regeneration when out of combat
      if (game.health < MAX_HEALTH && performance.now() - game.hurtAt > 8000) {
        S.regenT += dt
        if (S.regenT > 1) {
          S.regenT = 0
          game.heal(2)
        }
      }

      S.bob += Math.hypot(P.vel.x, P.vel.z) * dt * (P.onGround ? 1.4 : 0)
    } else {
      mouse.down = false
      mouse.pressed = false
      S.drawing = false
      S.charge = 0
    }

    // ---------------- camera
    P.shake = Math.max(0, P.shake - dt * 1.5)
    const shake = P.shake * P.shake
    const dead = game.phase === 'dead'
    camera.position.set(
      P.pos.x + (Math.random() - 0.5) * shake,
      P.pos.y + (dead ? 0.4 : EYE) + Math.sin(S.bob * 2) * 0.05 + (Math.random() - 0.5) * shake,
      P.pos.z + (Math.random() - 0.5) * shake
    )
    camera.rotation.set(look.pitch, look.yaw, dead ? 0.6 : 0, 'YXZ')
    const targetFov = 72 - S.charge * 14
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10)
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
    G.player.yaw = look.yaw

    // ---------------- bow view model follows the camera
    const b = bow.current
    if (b) {
      b.visible = !dead
      b.position.copy(camera.position)
      b.quaternion.copy(camera.quaternion)
      const ch = S.charge
      const sway = Math.sin(S.bob * 1) * 0.015
      b.translateX(THREE.MathUtils.lerp(0.3, 0.1, ch) + sway)
      b.translateY(THREE.MathUtils.lerp(-0.26, -0.13, ch) + Math.abs(Math.sin(S.bob)) * 0.01)
      b.translateZ(-0.55)
      b.rotateZ(THREE.MathUtils.lerp(0.35, 0.12, ch))
      b.scale.setScalar(0.78)
      // string
      const tipY = BOW_R * Math.sin(BOW_ARC / 2)
      const tipZ = -BOW_R * Math.cos(BOW_ARC / 2)
      const nockZ = tipZ + 0.06 + ch * 0.42
      placeString(stringTop.current, 0, tipY, tipZ, 0, 0, nockZ)
      placeString(stringBot.current, 0, -tipY, tipZ, 0, 0, nockZ)
      if (nocked.current) {
        nocked.current.visible = game.arrows > 0 && S.reload <= 0
        nocked.current.position.set(0.02, 0, nockZ - 0.5)
      }
    }
  })

  return (
    <group ref={bow}>
      <mesh rotation={[0, Math.PI / 2, -BOW_ARC / 2]}>
        <torusGeometry args={[BOW_R, 0.022, 5, 20, BOW_ARC]} />
        <meshStandardMaterial color="#5a3b22" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, -BOW_R]}>
        <boxGeometry args={[0.05, 0.16, 0.06]} />
        <meshStandardMaterial color="#2b1d12" roughness={0.9} />
      </mesh>
      <mesh ref={stringTop}>
        <cylinderGeometry args={[0.004, 0.004, 1, 3]} />
        <meshBasicMaterial color="#d8d2c4" />
      </mesh>
      <mesh ref={stringBot}>
        <cylinderGeometry args={[0.004, 0.004, 1, 3]} />
        <meshBasicMaterial color="#d8d2c4" />
      </mesh>
      <mesh ref={nocked} geometry={arrowGeo} rotation-y={Math.PI}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
    </group>
  )
}

const BOW_R = 0.55
const BOW_ARC = Math.PI * 0.62
const sA = new THREE.Vector3()
const sB = new THREE.Vector3()
const sD = new THREE.Vector3()
function placeString(mesh, ax, ay, az, bx, by, bz) {
  if (!mesh) return
  sA.set(ax, ay, az)
  sB.set(bx, by, bz)
  sD.subVectors(sB, sA)
  const len = sD.length()
  mesh.position.copy(sA).addScaledVector(sD, 0.5)
  mesh.scale.set(1, len, 1)
  mesh.quaternion.setFromUnitVectors(up, sD.normalize())
}
