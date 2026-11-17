import { createNoise2D } from 'simplex-noise'

// Deterministic seeded RNG so the world is identical every run
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const noise = createNoise2D(mulberry32(1337))

export function fbm(x, z, oct = 4) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    sum += noise(x * freq, z * freq) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

// sharp mountain ridges
export function ridge(x, z, oct = 5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise(x * freq + 31.7, z * freq - 12.3))
    sum += n * n * amp
    norm += amp
    amp *= 0.5
    freq *= 2.1
  }
  return sum / norm
}

export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export const lerp = (a, b, t) => a + (b - a) * t
