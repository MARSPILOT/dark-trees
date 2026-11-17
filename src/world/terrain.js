import { fbm, ridge, smoothstep, lerp } from './noise'

export const WORLD_HALF = 230
export const TERRAIN_SIZE = WORLD_HALF * 2
export const WATER_LEVEL = 0
export const UPPER_WATER_LEVEL = 27.5
export const PLAY_RADIUS = 200

// Main river: flows from the northern plateau, over the waterfall, south through the forest
export function riverX(z) {
  return 22 * Math.sin(z * 0.017) + 9 * Math.sin(z * 0.043 + 1.3)
}
// Tributary: flows from the east and joins the main river
export function tributaryZ(x) {
  return 45 + 14 * Math.sin(x * 0.028 + 0.5)
}

export const FALL_X = riverX(-130)
export const FALL_TOP_Z = -134.5
export const FALL_BOTTOM_Z = -124
export const LAKES = [
  { x: -82, z: 38, r: 30, name: 'Myrkvatn' }, // big dark lake (Lyngbakr, Kraken)
  { x: FALL_X + 2, z: -112, r: 15, name: 'Fall pool' }, // waterfall plunge pool
]
// The ancient ash at the heart of the forest
export const ASH_TREE = { x: 70, z: -40 }

// 0 below the cliff, 1 on the northern plateau
function upperFactor(z) {
  return smoothstep(-126, -134, z)
}

export function heightAt(x, z) {
  // rolling forest hills
  let h = fbm(x * 0.006, z * 0.006) * 7 + fbm(x * 0.025 + 10, z * 0.025) * 1.8 + 3.5

  // ring of mountains around the valley
  const r = Math.hypot(x, z)
  const m = smoothstep(120, 205, r + fbm(x * 0.008 + 5, z * 0.008 - 3) * 30)
  h += m * m * (35 + ridge(x * 0.01, z * 0.01) * 75)

  // northern plateau with a cliff (waterfall)
  const pm = smoothstep(-125, -133, z) * (1 - smoothstep(92, 122, Math.abs(x - FALL_X)))
  h = lerp(h, Math.max(h, 30.5 + fbm(x * 0.05, z * 0.05) * 1.6), pm)

  const top = upperFactor(z)

  // main river
  const rx = riverX(z)
  const d1 = Math.abs(x - rx)
  const w1 = 6.5 + smoothstep(-130, 200, z) * 3
  const valley1 = (1 - smoothstep(w1, w1 + 38, d1)) * (1 - top)

  // tributary (east side only)
  const zb = tributaryZ(x)
  const d2 = Math.abs(z - zb)
  const east = smoothstep(riverX(zb) - 4, riverX(zb) + 6, x)
  const w2 = 4.8
  const valley2 = (1 - smoothstep(w2, w2 + 26, d2)) * east * (1 - top)

  const valley = Math.max(valley1, valley2)
  h = lerp(h, Math.min(h, 1.3 + fbm(x * 0.04, z * 0.04) * 0.6), valley * 0.88)

  // lakes
  for (let i = 0; i < LAKES.length; i++) {
    const L = LAKES[i]
    const d = Math.hypot(x - L.x, z - L.z)
    const shore = (1 - smoothstep(L.r, L.r + 26, d)) * (1 - top)
    h = lerp(h, Math.min(h, 1.2), shore * 0.8)
    const lk = 1 - smoothstep(L.r * 0.5, L.r * 1.05, d)
    h = lerp(h, -4.5, lk)
  }

  // carve river beds
  const bed = lerp(-3.2, UPPER_WATER_LEVEL - 2.2, top)
  const carve1 = 1 - smoothstep(w1 * 0.45, w1 * 1.45, d1)
  h = lerp(h, bed, carve1)
  const carve2 = (1 - smoothstep(w2 * 0.45, w2 * 1.45, d2)) * east * (1 - top)
  h = lerp(h, -2.6, carve2)

  return h
}

export function waterLevelAt(x, z) {
  if (z < FALL_TOP_Z && Math.abs(x - FALL_X) < 88) return UPPER_WATER_LEVEL
  return WATER_LEVEL
}

export function waterDepth(x, z) {
  return waterLevelAt(x, z) - heightAt(x, z)
}

export function isWater(x, z, minDepth = 0.6) {
  return waterDepth(x, z) > minDepth
}

export function slopeAt(x, z) {
  const e = 1
  const dx = heightAt(x + e, z) - heightAt(x - e, z)
  const dz = heightAt(x, z + e) - heightAt(x, z - e)
  return Math.hypot(dx, dz) / (2 * e)
}

// Ground height the player / creatures stand on (never below the river surface floor)
export function groundAt(x, z) {
  return heightAt(x, z)
}
