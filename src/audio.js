// Tiny synthesized sound kit (no audio files needed)
let ctx = null
let master = null
let windNode = null

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function env(gainNode, t, a, peak, dur) {
  gainNode.gain.setValueAtTime(0.0001, t)
  gainNode.gain.exponentialRampToValueAtTime(peak, t + a)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur)
}

function noiseHit({ dur = 0.2, freq = 1200, q = 1, peak = 0.5, type = 'bandpass', vol = 1 }) {
  if (!ensure()) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(dur + 0.05)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  env(g, t, 0.005, peak * vol, dur)
  src.connect(f).connect(g).connect(master)
  src.start(t)
  src.stop(t + dur + 0.05)
}

function tone({ f0 = 200, f1 = 100, dur = 0.3, type = 'sawtooth', peak = 0.3 }) {
  if (!ensure()) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = ctx.createGain()
  env(g, t, 0.01, peak, dur)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  o.connect(lp).connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

export const sfx = {
  unlock() {
    ensure()
    if (ctx && !windNode) {
      // gentle forest wind loop
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(4)
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 380
      const g = ctx.createGain()
      g.gain.value = 0.07
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.08
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.04
      lfo.connect(lfoGain).connect(g.gain)
      src.connect(f).connect(g).connect(master)
      src.start()
      lfo.start()
      windNode = src
    }
  },
  draw() {
    tone({ f0: 90, f1: 140, dur: 0.35, type: 'triangle', peak: 0.05 })
  },
  shoot(power = 1) {
    tone({ f0: 180 + power * 80, f1: 60, dur: 0.18, type: 'triangle', peak: 0.35 })
    noiseHit({ dur: 0.25, freq: 2400, q: 0.6, peak: 0.25 })
  },
  thunk() {
    noiseHit({ dur: 0.12, freq: 500, q: 2, peak: 0.4 })
  },
  hit() {
    noiseHit({ dur: 0.15, freq: 900, q: 1.2, peak: 0.6 })
    tone({ f0: 300, f1: 120, dur: 0.15, type: 'square', peak: 0.08 })
  },
  roar(big = false) {
    tone({ f0: big ? 110 : 220, f1: big ? 40 : 90, dur: big ? 0.9 : 0.45, type: 'sawtooth', peak: 0.16 })
    noiseHit({ dur: big ? 0.8 : 0.4, freq: big ? 300 : 700, q: 0.7, peak: 0.2 })
  },
  hurt() {
    tone({ f0: 160, f1: 70, dur: 0.3, type: 'square', peak: 0.15 })
    noiseHit({ dur: 0.2, freq: 400, q: 0.8, peak: 0.35 })
  },
  chest() {
    tone({ f0: 70, f1: 50, dur: 0.4, type: 'sawtooth', peak: 0.1 })
    setTimeout(() => tone({ f0: 660, f1: 990, dur: 0.35, type: 'sine', peak: 0.12 }), 250)
    setTimeout(() => tone({ f0: 880, f1: 1320, dur: 0.4, type: 'sine', peak: 0.1 }), 380)
  },
  splash() {
    noiseHit({ dur: 0.35, freq: 1500, q: 0.4, peak: 0.25 })
  },
  death() {
    tone({ f0: 180, f1: 30, dur: 1.2, type: 'sawtooth', peak: 0.18 })
  },
  empty() {
    tone({ f0: 300, f1: 250, dur: 0.08, type: 'square', peak: 0.06 })
  },
}
