import { mulberry32, fbm } from './noise'
import {
  heightAt,
  waterDepth,
  slopeAt,
  WORLD_HALF,
  ASH_TREE,
  LAKES,
  riverX,
  FALL_X,
} from './terrain'

export const PLAYER_SPAWN = { x: -38, z: 118 }
// azimuth (atan2(x, z)) of the moon direction in Environment.jsx
export const MOON_AZIMUTH = Math.atan2(0.3, 0.81)
export const MEADOW = { x: -10, z: -45, r: 24 } // Audumbla's clearing

const rng = mulberry32(42)
const rand = (a, b) => a + rng() * (b - a)

// ---------- collision grid ----------
const CELL = 8
const grid = new Map()
const key = (cx, cz) => cx * 10007 + cz
export function addCollider(x, z, r) {
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  const k = key(cx, cz)
  if (!grid.has(k)) grid.set(k, [])
  grid.get(k).push({ x, z, r })
}
// push a circle out of all static colliders; mutates and returns pos
export function resolveCollisions(pos, radius) {
  const cx = Math.floor(pos.x / CELL)
  const cz = Math.floor(pos.z / CELL)
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = grid.get(key(cx + i, cz + j))
      if (!list) continue
      for (let n = 0; n < list.length; n++) {
        const c = list[n]
        const dx = pos.x - c.x
        const dz = pos.z - c.z
        const min = c.r + radius
        const d2 = dx * dx + dz * dz
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2)
          const push = (min - d) / d
          pos.x += dx * push
          pos.z += dz * push
        }
      }
    }
  }
  return pos
}
// is a point inside any collider (used for arrows hitting trunks/rocks)
export function pointBlocked(x, z, extra = 0) {
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = grid.get(key(cx + i, cz + j))
      if (!list) continue
      for (let n = 0; n < list.length; n++) {
        const c = list[n]
        const dx = x - c.x
        const dz = z - c.z
        const rr = c.r * 0.8 + extra
        if (dx * dx + dz * dz < rr * rr) return c
      }
    }
  }
  return null
}

function nearRiverOrLake(x, z, margin) {
  return waterDepth(x, z) > -margin
}

function inClearing(x, z) {
  if (Math.hypot(x - ASH_TREE.x, z - ASH_TREE.z) < 24) return true
  if (Math.hypot(x - MEADOW.x, z - MEADOW.z) < MEADOW.r) return true
  const sx = x - PLAYER_SPAWN.x
  const sz = z - PLAYER_SPAWN.z
  const sd = Math.hypot(sx, sz)
  if (sd < 9) return true
  // keep a gap in the trees so the player starts with a view of the blood moon (it rises to the south)
  if (sd < 70) {
    let da = Math.atan2(sx, sz) - MOON_AZIMUTH
    da = Math.atan2(Math.sin(da), Math.cos(da))
    if (Math.abs(da) < 0.22) return true
  }
  return false
}

// ---------- trees ----------
export const pines = []
export const birches = []
export const deadTrees = []
{
  const step = 3.6
  for (let x = -WORLD_HALF + 4; x < WORLD_HALF - 4; x += step) {
    for (let z = -WORLD_HALF + 4; z < WORLD_HALF - 4; z += step) {
      const px = x + rand(-1.6, 1.6)
      const pz = z + rand(-1.6, 1.6)
      const r = Math.hypot(px, pz)
      if (r > WORLD_HALF - 6) continue
      const h = heightAt(px, pz)
      if (h < 0.8 || h > 62) continue
      if (nearRiverOrLake(px, pz, 2.5)) continue
      if (inClearing(px, pz)) continue
      const s = slopeAt(px, pz)
      if (s > 1.15) continue
      const density = fbm(px * 0.012 + 50, pz * 0.012)
      const altFade = h > 38 ? (62 - h) / 24 : 1
      if (density < -0.3 || rng() > (0.62 + density * 0.55) * altFade) continue
      const scale = rand(0.75, 1.45) * (h > 35 ? 0.8 : 1)
      const rot = rand(0, Math.PI * 2)
      const pick = rng()
      if (pick < 0.12 && h < 25) {
        birches.push({ x: px, y: h, z: pz, s: scale * 0.9, rot })
        addCollider(px, pz, 0.35 * scale)
      } else if (pick < 0.16) {
        deadTrees.push({ x: px, y: h, z: pz, s: scale, rot })
        addCollider(px, pz, 0.35 * scale)
      } else {
        pines.push({ x: px, y: h, z: pz, s: scale, rot })
        addCollider(px, pz, 0.5 * scale)
      }
    }
  }
}

// ---------- boulders ----------
export const rocks = []
{
  let tries = 0
  while (rocks.length < 520 && tries < 20000) {
    tries++
    const px = rand(-WORLD_HALF + 8, WORLD_HALF - 8)
    const pz = rand(-WORLD_HALF + 8, WORLD_HALF - 8)
    if (Math.hypot(px, pz) > WORLD_HALF - 8) continue
    const h = heightAt(px, pz)
    const depth = waterDepth(px, pz)
    const nearWater = depth > -3 && depth < 1.5
    // favour river banks and mountain slopes
    const weight = nearWater ? 0.9 : h > 20 ? 0.55 : 0.22
    if (rng() > weight) continue
    if (Math.hypot(px - PLAYER_SPAWN.x, pz - PLAYER_SPAWN.z) < 7) continue
    const big = rng() < 0.18
    const s = big ? rand(2.2, 5) : rand(0.5, 1.8)
    rocks.push({
      x: px,
      y: h - s * 0.25,
      z: pz,
      s,
      sy: rand(0.55, 1),
      rot: rand(0, Math.PI * 2),
      tilt: rand(-0.25, 0.25),
      variant: Math.floor(rng() * 3),
    })
    if (s > 0.9 && depth < 0.4) addCollider(px, pz, s * 0.85)
  }
}

// ---------- undergrowth ----------
export const ferns = []
{
  let tries = 0
  while (ferns.length < 3200 && tries < 30000) {
    tries++
    const px = rand(-WORLD_HALF + 5, WORLD_HALF - 5)
    const pz = rand(-WORLD_HALF + 5, WORLD_HALF - 5)
    const h = heightAt(px, pz)
    if (h < 0.6 || h > 30) continue
    if (nearRiverOrLake(px, pz, 0.8)) continue
    if (slopeAt(px, pz) > 0.8) continue
    ferns.push({ x: px, y: h, z: pz, s: rand(0.5, 1.3), rot: rand(0, Math.PI * 2), kind: rng() < 0.6 ? 0 : 1 })
  }
}

// ---------- treasure chests ----------
export const chestSpots = []
{
  const okSpot = (px, pz) => {
    const h = heightAt(px, pz)
    if (h < 0.8 || h > 40) return false
    if (nearRiverOrLake(px, pz, 1.2)) return false
    if (slopeAt(px, pz) > 0.55) return false
    if (Math.hypot(px, pz) > WORLD_HALF - 25) return false
    for (const c of chestSpots) if (Math.hypot(c.x - px, c.z - pz) < 32) return false
    return true
  }
  // a first chest close to the start so the player learns how chests work
  chestSpots.push({ x: PLAYER_SPAWN.x + 9, z: PLAYER_SPAWN.z - 14 })
  // hidden behind big boulders
  for (const r of rocks) {
    if (chestSpots.length >= 14) break
    if (r.s < 2.4) continue
    const a = rng() * Math.PI * 2
    const px = r.x + Math.cos(a) * (r.s * 0.95 + 1.2)
    const pz = r.z + Math.sin(a) * (r.s * 0.95 + 1.2)
    if (okSpot(px, pz)) chestSpots.push({ x: px, z: pz })
  }
  // hidden between trees
  for (const t of pines) {
    if (chestSpots.length >= 26) break
    if (rng() > 0.03) continue
    const px = t.x + 1.4
    const pz = t.z + 0.6
    if (okSpot(px, pz)) chestSpots.push({ x: px, z: pz })
  }
  // special spots: near the plunge pool and on the plateau above the waterfall
  chestSpots.push({ x: FALL_X - 20, z: -104 })
  chestSpots.push({ x: FALL_X + 30, z: -150 })
  for (const c of chestSpots) {
    c.y = heightAt(c.x, c.z)
    c.rot = rand(0, Math.PI * 2)
    c.arrows = Math.floor(rand(6, 11))
    c.mead = rng() < 0.35
  }
}

// ---------- monster spawn finder ----------
export function findSpot(predicate, near = null, radius = 60, tries = 3000) {
  for (let i = 0; i < tries; i++) {
    let x, z
    if (near) {
      const a = rng() * Math.PI * 2
      const d = Math.sqrt(rng()) * radius
      x = near.x + Math.cos(a) * d
      z = near.z + Math.sin(a) * d
    } else {
      x = rand(-WORLD_HALF + 20, WORLD_HALF - 20)
      z = rand(-WORLD_HALF + 20, WORLD_HALF - 20)
    }
    if (Math.hypot(x, z) > WORLD_HALF - 20) continue
    if (Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z) < 70) continue
    if (predicate(x, z, heightAt(x, z))) return { x, z }
  }
  return near ? { x: near.x, z: near.z } : { x: 0, z: 0 }
}

export const spawnRand = rand
export { LAKES, riverX }
