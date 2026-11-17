import * as THREE from 'three'
import { G, useGame } from '../store'
import { SPECIES } from './species'
import { heightAt, waterDepth, waterLevelAt, isWater, LAKES, ASH_TREE, PLAY_RADIUS, slopeAt, FALL_X } from '../world/terrain'
import { findSpot, resolveCollisions, MEADOW, spawnRand } from '../world/placement'
import { sfx } from '../audio'
import { spawnProjectile } from '../components/Projectiles'

// ------------------------------------------------------------------ spawning by habitat
const HABITATS = {
  forest: (x, z, h) => h > 1 && h < 22 && !isWater(x, z, -2) && slopeAt(x, z) < 0.7,
  deepforest: (x, z, h) => h > 1.5 && h < 20 && !isWater(x, z, -3) && slopeAt(x, z) < 0.7 && z < 60,
  mountain: (x, z, h) => h > 24 && h < 52 && slopeAt(x, z) < 1.2 && Math.hypot(x, z) > 120,
  mountainfoot: (x, z, h) => h > 8 && h < 22 && Math.hypot(x, z) > 110 && slopeAt(x, z) < 1.0,
  river: (x, z) => waterDepth(x, z) > 2.2 && z > -120 && Math.hypot(x - LAKES[0].x, z - LAKES[0].z) > LAKES[0].r + 10,
  lake: (x, z) => Math.hypot(x - LAKES[0].x, z - LAKES[0].z) < LAKES[0].r * 0.45 && waterDepth(x, z) > 3,
  sky: () => true,
}

function spawnPoint(def, index) {
  switch (def.habitat) {
    case 'ash':
      return findSpot((x, z, h) => h > 0.8 && !isWater(x, z, -1.5), ASH_TREE, 32)
    case 'meadow':
      return findSpot((x, z, h) => h > 0.8 && !isWater(x, z, -1.5), MEADOW, MEADOW.r)
    case 'pool': {
      const L = LAKES[1]
      return findSpot((x, z, h) => h > 0.8 && h < 8 && z > -122 && !isWater(x, z, -1) && Math.hypot(x - L.x, z - L.z) > L.r, L, L.r + 16)
    }
    case 'sky': {
      const p = findSpot((x, z) => Math.hypot(x, z) > 90 && Math.hypot(x, z) < 180)
      return p
    }
    default:
      return findSpot(HABITATS[def.habitat] || HABITATS.forest)
  }
}

export function createMonsters() {
  const list = []
  SPECIES.forEach((def, i) => {
    const p = spawnPoint(def, i)
    const m = {
      id: i,
      def,
      name: def.name,
      pos: new THREE.Vector3(p.x, 0, p.z),
      vel: new THREE.Vector3(),
      yaw: spawnRand(0, Math.PI * 2),
      pitch: 0,
      hp: def.hp,
      state: 'alive',
      attackT: -1,
      attackHit: false,
      cooldown: 1 + spawnRand(0, 2),
      rangedCd: 3 + spawnRand(0, 3),
      throwT: 0,
      breathT: 0,
      breathEmit: 0,
      hitFlash: 0,
      animT: spawnRand(0, 10),
      speedNow: 0,
      deathT: 0,
      sink: 0,
      seed: spawnRand(0, 100),
      noticed: false,
      hunting: false,
      home: { x: p.x, z: p.z },
      wander: { x: p.x, z: p.z, t: spawnRand(0, 6) },
      removed: false,
      spheres: [],
      trail: null,
      fly: null,
    }
    if (def.kind === 'water' || def.water) m.pos.y = waterLevelAt(p.x, p.z) - (def.sink || 0)
    else m.pos.y = heightAt(p.x, p.z)
    if (def.kind === 'fly') {
      m.fly = { mode: 'cruise', t: 0, alt: (def.alt || 22) + spawnRand(0, 8) }
      m.pos.y = heightAt(p.x, p.z) + m.fly.alt
    }
    if (def.kind === 'serpent') {
      m.trail = []
      for (let k = 0; k < def.opts.segments + 2; k++) {
        m.trail.push(new THREE.Vector3(p.x - k * def.opts.spacing * Math.sin(m.yaw), m.pos.y, p.z - k * def.opts.spacing * Math.cos(m.yaw)))
      }
    }
    // pre-allocate hit spheres
    const n = def.kind === 'serpent' ? Math.ceil(def.opts.segments / 2) + 1 : def.hit.length
    for (let k = 0; k < n; k++) m.spheres.push({ c: new THREE.Vector3(), r: 1 })
    list.push(m)
  })
  G.director = { t: FIRST_HUNT }
  return list
}

// ------------------------------------------------------------------ hunt pacing
// Creatures rest in their habitats until the "hunt director" sends one after the player:
// the first after FIRST_HUNT seconds, then roughly one every HUNT_INTERVAL seconds.
// A resting creature still attacks if the player wanders right up to it or shoots it.
export const FIRST_HUNT = 60
export const HUNT_INTERVAL = 120
const PROVOKE_RADIUS = 16

// ------------------------------------------------------------------ helpers
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()

function damagePlayer(m, dmg) {
  const P = G.player
  const g = useGame.getState()
  if (g.phase !== 'playing') return
  g.damage(dmg)
  sfx.hurt()
  tmp.set(P.pos.x - m.pos.x, 0, P.pos.z - m.pos.z).normalize()
  P.vel.x += tmp.x * 9
  P.vel.z += tmp.z * 9
  P.vel.y = Math.max(P.vel.y, 3.5)
  P.shake = 0.5
  if (G.fx) G.fx.emit(tmp2.set(P.pos.x, P.pos.y + 1.2, P.pos.z), '#9a0000', 14, 4)
}

export function updateSpheres(m) {
  const def = m.def
  const s = def.scale
  if (def.kind === 'serpent') {
    const r = def.opts.radius
    const sp = m.spheres
    // head
    const headY = def.water ? waterLevelAt(m.pos.x, m.pos.z) + r : heightAt(m.pos.x, m.pos.z) + r
    sp[0].c.set(m.pos.x + Math.sin(m.yaw) * r * 0.8, headY - m.sink, m.pos.z + Math.cos(m.yaw) * r * 0.8)
    sp[0].r = r * 1.4
    for (let k = 1; k < sp.length; k++) {
      const p = m.trail[Math.min(m.trail.length - 1, k * 2)]
      const taper = 1 - ((k * 2) / def.opts.segments) * 0.75
      const y = def.water ? waterLevelAt(p.x, p.z) + r * 0.3 : heightAt(p.x, p.z) + r * taper * 0.8
      sp[k].c.set(p.x, y - m.sink, p.z)
      sp[k].r = r * taper * 1.3
    }
    return
  }
  const sy = Math.sin(m.yaw)
  const cy = Math.cos(m.yaw)
  for (let k = 0; k < def.hit.length; k++) {
    const [f, u, r] = def.hit[k]
    m.spheres[k].c.set(m.pos.x + sy * f * s, m.pos.y + u * s, m.pos.z + cy * f * s)
    m.spheres[k].r = r * s
  }
}

export function hitMonster(m, dmg, point) {
  if (m.state !== 'alive') return
  m.hp -= dmg
  m.hitFlash = 0.18
  if (!m.hunting) wake(m, 'provoked')
  sfx.hit()
  if (G.fx) G.fx.emit(point, m.def.blood, 12, 5)
  if (m.hp <= 0) {
    m.hp = 0
    m.state = 'dying'
    m.deathT = 0
    m.attackT = -1
    sfx.death()
    if (G.fx) G.fx.emit(point, m.def.blood, 40, 8)
    useGame.getState().addKill(m.name)
  }
}

function startAttack(m) {
  m.attackT = 0
  m.attackHit = false
  m.cooldown = m.def.cooldown
}

function faceYaw(m, targetYaw, dt, rate = 6) {
  let d = targetYaw - m.yaw
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  m.yaw += d * Math.min(1, dt * rate)
}

function approachFactor(dist) {
  // monsters are always drawn to the player; they close in faster once they are near
  if (dist > 120) return 0.6
  if (dist > 60) return 0.8
  return 1
}

// ------------------------------------------------------------------ ranged attacks
function tryRanged(m, dist, dt) {
  const def = m.def
  const P = G.player
  if (def.ranged && m.rangedCd <= 0 && m.attackT < 0 && dist > 10 && dist < def.ranged.range) {
    m.rangedCd = def.ranged.cooldown + spawnRand(0, 1.5)
    if (def.ranged.type === 'rock') {
      m.throwT = 0.8
      m.throwFired = false
    } else if (def.ranged.type === 'poison') {
      m.breathT = 1.3
      m.breathEmit = 0
      sfx.roar(true)
    }
  }
  if (m.throwT > 0) {
    m.throwT -= dt
    if (!m.throwFired && m.throwT < 0.35) {
      m.throwFired = true
      const s = def.scale
      const start = tmp.set(m.pos.x + Math.sin(m.yaw) * 0.8 * s, m.pos.y + 3.2 * s, m.pos.z + Math.cos(m.yaw) * 0.8 * s)
      const T = Math.max(0.8, dist / 24)
      const g = 16
      const target = tmp2.set(P.pos.x + P.vel.x * T * 0.6, P.pos.y + 1, P.pos.z + P.vel.z * T * 0.6)
      const vel = new THREE.Vector3((target.x - start.x) / T, (target.y - start.y) / T + 0.5 * g * T, (target.z - start.z) / T)
      spawnProjectile({ type: 'rock', pos: start.clone(), vel, gravity: g, damage: def.ranged.damage, radius: 0.8 })
    }
  }
  if (m.breathT > 0) {
    m.breathT -= dt
    m.breathEmit -= dt
    if (m.breathEmit <= 0) {
      m.breathEmit = 0.16
      const s = def.scale
      const start = tmp.set(m.pos.x + Math.sin(m.yaw) * 3.4 * s, m.pos.y + 2.6 * s, m.pos.z + Math.cos(m.yaw) * 3.4 * s)
      const target = tmp2.set(P.pos.x + (Math.random() - 0.5) * 3, P.pos.y + 1, P.pos.z + (Math.random() - 0.5) * 3)
      const vel = target.sub(start).normalize().multiplyScalar(24)
      spawnProjectile({ type: 'poison', pos: start.clone(), vel: vel.clone(), gravity: 2, damage: def.ranged.damage, radius: 1.1 })
    }
  }
}

// ------------------------------------------------------------------ movement per kind
function moveGround(m, dt, dx, dz, dist, idle) {
  const def = m.def
  const spirit = def.kind === 'spirit'
  let speed = idle ? def.speed * 0.25 : def.speed * approachFactor(dist)
  if (m.attackT >= 0) speed *= 0.25
  if (m.throwT > 0 || m.breathT > 0) speed = 0
  const stop = idle ? 1.5 : def.attackRange * 0.75
  if (dist < stop) speed = 0
  let ix = dx / (dist || 1)
  let iz = dz / (dist || 1)
  // separation from other monsters
  for (const o of G.monsters) {
    if (o === m || o.state !== 'alive' || o.def.kind === 'fly') continue
    const ox = m.pos.x - o.pos.x
    const oz = m.pos.z - o.pos.z
    const min = m.def.radius + o.def.radius + 0.6
    const d2 = ox * ox + oz * oz
    if (d2 < min * min && d2 > 1e-4) {
      const d = Math.sqrt(d2)
      ix += (ox / d) * (1 - d / min) * 1.5
      iz += (oz / d) * (1 - d / min) * 1.5
    }
  }
  // unstick: if trees keep blocking us, sidestep for a moment
  if (m.sideT > 0) {
    m.sideT -= dt
    const sx = -iz * m.sideDir
    const sz = ix * m.sideDir
    ix = ix * 0.3 + sx
    iz = iz * 0.3 + sz
  }
  const len = Math.hypot(ix, iz) || 1
  ix /= len
  iz /= len
  const depth = waterDepth(m.pos.x, m.pos.z)
  const bx = m.pos.x
  const bz = m.pos.z
  if (!spirit && depth > 0.8) speed *= 0.55
  const k = 1 - Math.exp(-dt * 5)
  m.vel.x += (ix * speed - m.vel.x) * k
  m.vel.z += (iz * speed - m.vel.z) * k
  m.pos.x += m.vel.x * dt
  m.pos.z += m.vel.z * dt
  if (!spirit && def.radius < 1.05) resolveCollisions(m.pos, def.radius * 0.8)
  if (speed > 0.5 && dt > 0) {
    const moved = Math.hypot(m.pos.x - bx, m.pos.z - bz) / dt
    if (moved < speed * 0.3) m.stuckT = (m.stuckT || 0) + dt
    else m.stuckT = 0
    if (m.stuckT > 0.4 && !(m.sideT > 0)) {
      m.sideT = 0.8 + Math.random() * 0.8
      m.sideDir = Math.random() < 0.5 ? 1 : -1
      m.stuckT = 0
    }
  }
  // keep within the valley
  const r = Math.hypot(m.pos.x, m.pos.z)
  if (r > PLAY_RADIUS + 10) m.pos.multiplyScalar((PLAY_RADIUS + 10) / r)
  m.speedNow = Math.hypot(m.vel.x, m.vel.z)
  m.animT += m.speedNow * dt * (3.2 / def.scale)
  let y = heightAt(m.pos.x, m.pos.z)
  if (spirit) y += def.hover || 0
  else if (depth > 0) y = Math.max(y, waterLevelAt(m.pos.x, m.pos.z) - 0.8 * def.scale)
  m.pos.y += (y - m.pos.y) * (1 - Math.exp(-dt * 12))
  if (m.speedNow > 0.4) faceYaw(m, Math.atan2(m.vel.x, m.vel.z), dt)
  else faceYaw(m, Math.atan2(dx, dz), dt)
}

const ANGLES = [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 1.9, -1.9, 2.6, -2.6, Math.PI]
function moveWater(m, dt, dx, dz, dist, idle) {
  const def = m.def
  let speed = idle ? def.speed * 0.35 : def.speed * approachFactor(dist)
  if (m.attackT >= 0) speed *= 0.3
  if (dist < (idle ? 2 : def.attackRange * 0.7)) speed = 0
  const base = Math.atan2(dx, dz)
  let moved = false
  if (speed > 0) {
    const step = speed * dt
    const look = Math.max(step, def.minDepth * 1.5)
    for (const a of ANGLES) {
      const ang = base + a
      const nx = m.pos.x + Math.sin(ang) * look
      const nz = m.pos.z + Math.cos(ang) * look
      if (waterDepth(nx, nz) >= def.minDepth) {
        const tvx = Math.sin(ang) * speed
        const tvz = Math.cos(ang) * speed
        const k = 1 - Math.exp(-dt * 3)
        m.vel.x += (tvx - m.vel.x) * k
        m.vel.z += (tvz - m.vel.z) * k
        moved = true
        break
      }
    }
  }
  if (!moved) m.vel.multiplyScalar(Math.exp(-dt * 4))
  const nx = m.pos.x + m.vel.x * dt
  const nz = m.pos.z + m.vel.z * dt
  if (waterDepth(nx, nz) >= def.minDepth * 0.8) {
    m.pos.x = nx
    m.pos.z = nz
  } else {
    m.vel.multiplyScalar(0.5)
  }
  m.speedNow = Math.hypot(m.vel.x, m.vel.z)
  m.animT += m.speedNow * dt
  m.pos.y = waterLevelAt(m.pos.x, m.pos.z) - (def.sink || 0) - m.sink
  if (m.speedNow > 0.3 && (idle || dist > def.attackRange * 0.7)) faceYaw(m, Math.atan2(m.vel.x, m.vel.z), dt, 2.5)
  else faceYaw(m, base, dt, 2.5)
}

function moveFly(m, dt, dx, dz, dist, idle) {
  const def = m.def
  const P = G.player
  const f = m.fly
  f.t += dt
  let tx, ty, tz
  let speed = def.speed
  const ground = heightAt(m.pos.x, m.pos.z)
  if (idle) {
    f.mode = 'cruise'
    const a = G.time * (0.4 / def.scale) + m.seed
    tx = m.home.x + Math.cos(a) * 30
    tz = m.home.z + Math.sin(a) * 30
    ty = Math.max(ground, heightAt(tx, tz)) + f.alt
    speed *= 0.5
  } else if (f.mode === 'cruise') {
    speed *= approachFactor(dist)
    if (dist > 55) {
      tx = P.pos.x
      tz = P.pos.z
    } else {
      const a = G.time * (0.5 / def.scale) * 2 + m.seed
      tx = P.pos.x + Math.cos(a) * 26
      tz = P.pos.z + Math.sin(a) * 26
    }
    ty = Math.max(ground, heightAt(tx, tz)) + f.alt
    if (dist < 42 && m.cooldown <= 0 && f.t > 2) {
      f.mode = 'dive'
      f.t = 0
      sfx.roar(def.big)
    }
  } else if (f.mode === 'dive') {
    tx = P.pos.x
    ty = P.pos.y + 1.2
    tz = P.pos.z
    speed *= 1.45
    const d3 = Math.hypot(P.pos.x - m.pos.x, P.pos.y + 1.2 - m.pos.y, P.pos.z - m.pos.z)
    if (d3 < def.attackRange) {
      startAttack(m)
      damagePlayer(m, def.damage)
      m.attackHit = true
      f.mode = 'climb'
      f.t = 0
    } else if (f.t > 7) {
      f.mode = 'climb'
      f.t = 0
      m.cooldown = 1.5
    }
  } else {
    // climb away then circle again
    tx = m.pos.x + m.vel.x * 2
    tz = m.pos.z + m.vel.z * 2
    ty = ground + f.alt + 6
    if (f.t > 2.6) {
      f.mode = 'cruise'
      f.t = 0
    }
  }
  tmp.set(tx - m.pos.x, ty - m.pos.y, tz - m.pos.z)
  const len = tmp.length() || 1
  tmp.multiplyScalar(speed / len)
  const k = 1 - Math.exp(-dt * (f.mode === 'dive' ? 3.5 : 1.6))
  m.vel.lerp(tmp, k)
  m.pos.addScaledVector(m.vel, dt)
  const minY = heightAt(m.pos.x, m.pos.z) + (f.mode === 'dive' ? 1.0 : 6)
  if (m.pos.y < minY) {
    m.pos.y = minY
    if (m.vel.y < 0) m.vel.y = 0
  }
  m.speedNow = m.vel.length()
  m.animT += dt * def.flap
  const horiz = Math.hypot(m.vel.x, m.vel.z)
  faceYaw(m, Math.atan2(m.vel.x, m.vel.z), dt, 4)
  m.pitch = THREE.MathUtils.clamp(-Math.atan2(m.vel.y, horiz), -0.9, 0.9)
}

function updateTrail(m) {
  const sp = m.def.opts.spacing
  const t = m.trail
  if (t[0].distanceTo(m.pos) >= sp) {
    const last = t.pop()
    last.copy(m.pos)
    t.unshift(last)
  }
}

// ------------------------------------------------------------------ waking, wandering, the hunt director
function wake(m, reason) {
  if (m.hunting || m.state !== 'alive') return
  m.hunting = true
  m.noticed = true
  m.cooldown = Math.max(m.cooldown, 0.8)
  sfx.roar(m.def.big)
  const g = useGame.getState()
  if (g.phase === 'playing')
    g.message(reason === 'provoked' ? `You have roused ${m.name}!` : `${m.name} has caught your scent…`)
}

function pickWander(m) {
  const def = m.def
  const w = m.wander
  w.t = 6 + Math.random() * 9
  const waterBound = def.kind === 'water' || def.water
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 6 + Math.random() * (waterBound ? 28 : 24)
    const x = m.home.x + Math.sin(a) * r
    const z = m.home.z + Math.cos(a) * r
    if (Math.hypot(x, z) > PLAY_RADIUS) continue
    const depth = waterDepth(x, z)
    if (waterBound ? depth >= def.minDepth * 1.2 : def.kind === 'spirit' || def.kind === 'fly' || depth < 0.3) {
      w.x = x
      w.z = z
      return
    }
  }
  w.x = m.home.x
  w.z = m.home.z
}

export function updateDirector(dt) {
  const D = G.director
  if (!D) return
  D.t -= dt
  if (D.t > 0) return
  D.t = HUNT_INTERVAL * (0.9 + Math.random() * 0.2)
  const P = G.player.pos
  // only creatures that can actually reach the player; prefer nearby ones so the hunt arrives in time
  const candidates = G.monsters
    .filter((m) => m.state === 'alive' && !m.hunting)
    .filter((m) => !(m.def.kind === 'water' || m.def.water) || Math.hypot(m.pos.x - P.x, m.pos.z - P.z) < 60)
    .sort((a, b) => Math.hypot(a.pos.x - P.x, a.pos.z - P.z) - Math.hypot(b.pos.x - P.x, b.pos.z - P.z))
  if (!candidates.length) return
  const pick = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))]
  wake(pick, 'summoned')
}

export function huntingCount() {
  let n = 0
  for (const m of G.monsters) if (m.hunting && m.state === 'alive') n++
  return n
}

// ------------------------------------------------------------------ main update
export function updateMonster(m, dt) {
  const def = m.def
  const P = G.player
  if (m.removed) return
  if (m.state === 'dying') {
    m.deathT += dt
    if (def.kind === 'fly') {
      const g = heightAt(m.pos.x, m.pos.z) + 0.5
      if (m.pos.y > g) {
        m.vel.y -= 25 * dt
        m.vel.x *= 0.98
        m.vel.z *= 0.98
        m.pos.addScaledVector(m.vel, dt)
        if (m.pos.y < g) m.pos.y = g
      }
    } else if (def.kind === 'water' || def.water) {
      m.sink += dt * 1.2
      m.pos.y = waterLevelAt(m.pos.x, m.pos.z) - (def.sink || 0) - m.sink
    } else if (def.kind === 'serpent') {
      if (m.deathT > 1.5) m.sink += dt * 0.6
    } else if (m.deathT > 3) {
      m.pos.y -= dt * 0.5
    }
    if (m.deathT > 6) m.removed = true
    updateSpheres(m)
    return
  }

  m.cooldown -= dt
  m.rangedCd -= dt
  m.hitFlash -= dt
  const pdx = P.pos.x - m.pos.x
  const pdz = P.pos.z - m.pos.z
  const pdist = Math.hypot(pdx, pdz)
  const waterBound = def.kind === 'water' || def.water

  // a resting creature is roused if the player comes right up to it
  if (!m.hunting && useGame.getState().phase === 'playing') {
    const reach = waterBound ? def.attackRange + 4 : def.kind === 'fly' ? 20 : PROVOKE_RADIUS
    const dy = Math.abs(P.pos.y - m.pos.y)
    if (pdist < reach && (def.kind === 'fly' || dy < 12)) wake(m, 'provoked')
  }

  // hunters head for the player; resting creatures roam their habitat
  let dx = pdx
  let dz = pdz
  let dist = pdist
  const idle = !m.hunting
  if (idle) {
    const w = m.wander
    w.t -= dt
    if (w.t <= 0 || Math.hypot(w.x - m.pos.x, w.z - m.pos.z) < 2.5) pickWander(m)
    dx = w.x - m.pos.x
    dz = w.z - m.pos.z
    dist = Math.hypot(dx, dz)
  }

  // melee attack timing
  if (m.attackT >= 0) {
    m.attackT += dt
    if (!m.attackHit && m.attackT >= def.attackTime * 0.55) {
      m.attackHit = true
      const dy = Math.abs(P.pos.y - m.pos.y)
      if (pdist < def.attackRange * 1.3 + 0.6 && (dy < 3 * def.scale + 2 || waterBound)) damagePlayer(m, def.damage)
    }
    if (m.attackT >= def.attackTime) m.attackT = -1
  }

  if (def.kind === 'fly') moveFly(m, dt, dx, dz, dist, idle)
  else if (waterBound) moveWater(m, dt, dx, dz, dist, idle)
  else moveGround(m, dt, dx, dz, dist, idle)

  if (def.kind === 'serpent') updateTrail(m)

  if (m.hunting) {
    if (def.kind !== 'fly' && m.attackT < 0 && m.cooldown <= 0 && pdist < def.attackRange && useGame.getState().phase === 'playing') {
      startAttack(m)
      if (def.big) sfx.roar(true)
    }
    tryRanged(m, pdist, dt)
  }

  // the player cannot walk through a beast
  if (def.kind !== 'fly' && !(def.kind === 'water' || def.water)) {
    const min = def.radius + 0.5
    const ox = P.pos.x - m.pos.x
    const oz = P.pos.z - m.pos.z
    const d = Math.hypot(ox, oz)
    if (d < min && d > 1e-3 && Math.abs(P.pos.y - m.pos.y) < 3 * def.scale) {
      P.pos.x = m.pos.x + (ox / d) * min
      P.pos.z = m.pos.z + (oz / d) * min
    }
  }
  updateSpheres(m)
}

// ray vs monster spheres → closest hit monster (for the crosshair name)
export function rayPick(origin, dir, maxDist = 160) {
  let best = null
  let bestT = maxDist
  for (const m of G.monsters) {
    if (m.state !== 'alive') continue
    for (const s of m.spheres) {
      tmp.subVectors(s.c, origin)
      const t = tmp.dot(dir)
      if (t < 0 || t > bestT) continue
      const d2 = tmp.lengthSq() - t * t
      if (d2 < s.r * s.r * 1.4) {
        bestT = t
        best = m
      }
    }
  }
  return best
}

// segment p0→p1 vs monster spheres; returns {m, point}
export function segmentHit(p0, p1) {
  const seg = tmp.subVectors(p1, p0)
  const len = seg.length()
  if (len < 1e-5) return null
  const dir = seg.divideScalar(len)
  let best = null
  let bestT = len
  for (const m of G.monsters) {
    if (m.state !== 'alive') continue
    for (const s of m.spheres) {
      tmp2.subVectors(s.c, p0)
      const t = THREE.MathUtils.clamp(tmp2.dot(dir), 0, len)
      const cx = p0.x + dir.x * t - s.c.x
      const cy = p0.y + dir.y * t - s.c.y
      const cz = p0.z + dir.z * t - s.c.z
      if (cx * cx + cy * cy + cz * cz < s.r * s.r && t <= bestT) {
        bestT = t
        best = { m, point: new THREE.Vector3(p0.x + dir.x * t, p0.y + dir.y * t, p0.z + dir.z * t) }
      }
    }
  }
  return best
}
