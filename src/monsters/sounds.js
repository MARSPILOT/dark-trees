// =====================================================================================
// Creature voices — every beast has its own synthesized call, attack sound, hurt cry and
// death cry, built with the Web Audio API (no audio files). Each voice is modelled on the
// real animal behind the myth, using published descriptions of their calls:
//
//  • Ravens (Huginn, Muninn): deep, guttural "prruk"/"wonk" croaks, energy mostly just below
//    ~1 kHz (Audubon; wildechoes.org), plus the knocking calls ravens also make.
//  • Hræsvelgr: sea eagles give a deep barking "ra-ra-ra-raurau" (San Diego Zoo via
//    Center of the West) — pitched down for a giant.
//  • Auðumbla: cattle calls are low, ~80–145 Hz fundamentals (Padilla de la Torre et al. 2015),
//    a closed-mouth "mm" opening into "oo".
//  • Vargr: wolf howls have a 150–780 Hz fundamental with few harmonics (Passilongo et al.;
//    Palacios et al. 2007): a rising glide, a long steady tone, a falling tail.
//  • Garmr: "Garm bays loudly before Gnipahellir" (Völuspá 44). Large-dog barks sit in the
//    500–700 Hz band, and big dogs' growls have low formant spacing (~850 Hz) (Taylor et al.;
//    Pongrácz et al.).
//  • The four harts / Eikþyrnir: red deer give short alarm barks; stags roar with a low,
//    mostly tonal fundamental while the formants sweep DOWN as the larynx is pulled towards
//    the sternum (Reby & McComb; Frey et al. 2012).
//  • Boars (Hildisvíni, Gullinbursti, Sæhrímnir): wild boar calls are grunts, grunt-squeals,
//    squeals and trumpets (Garcia et al. 2016, Ethology).
//  • Goats (Heiðrún, Tanngrisnir, Tanngnjóstr): bleats ~450–570 Hz with a rapid vibrato-like
//    pitch trill (Charlton et al. 2017); Thor's goats are named "teeth-grinder" and
//    "teeth-barer", so they grind and snap their teeth too.
//  • Ratatoskr: red squirrels' territorial rattle/chatter plus the high "seet" alarm call
//    (Univ. of Lethbridge; Wilson et al. 2022).
//  • Lyngbakr: humpback-style moans (typical song 80–4000 Hz, National Geographic) and a blow.
//  • Serpents (Jörmungandr, Lindworm, Níðhöggr): snake hisses are unpatterned noise with no
//    harmonics; vipers' hisses are dominated by 200–400 Hz, grass snakes' by 5–10 kHz
//    (Young 2003; Aubret & Mangin 2014).
//  • Fylgja (fox-spirit): the red fox vixen's shriek-like scream and the stuttering "gekker".
//  • Marbendill: in the Icelandic tale the merman laughs three times ("þá hló marbendill").
//  • Creatures with no real-world animal (Kraken, Fáfnir, Troll, Brunnmigi, Vörðr,
//    Landvættir) get voices built from what they are: bubbles and sub-bass, a dragon roar
//    with venom hiss, a giant's bellow, a wet gurgle, a ghostly wail, an earth rumble with
//    rune-stone chimes.
// =====================================================================================
import { audioOut } from '../audio'
import { G } from '../store'

// ------------------------------------------------------------------ synth kit
const noiseCache = new WeakMap()
function noiseBuf(ctx) {
  let b = noiseCache.get(ctx)
  if (!b) {
    const len = ctx.sampleRate * 2
    b = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, b)
  }
  return b
}

// set a param along [[fraction, value], ...] over dur seconds (exponential, values > 0)
function curve(param, t, dur, pts) {
  if (typeof pts === 'number') {
    param.setValueAtTime(pts, t)
    return
  }
  param.setValueAtTime(Math.max(1e-4, pts[0][1]), t)
  for (let i = 1; i < pts.length; i++) param.exponentialRampToValueAtTime(Math.max(1e-4, pts[i][1]), t + pts[i][0] * dur)
}

// attack / sustain / release envelope on a gain node
function envelope(g, t, dur, peak, a = 0.02, r = 0.1) {
  const rr = Math.min(r, dur * 0.6)
  const aa = Math.min(a, dur * 0.4)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + aa)
  g.gain.setValueAtTime(peak, t + dur - rr)
  g.gain.linearRampToValueAtTime(0, t + dur)
}

function lfo(ctx, t, dur, rate, depth, target) {
  const o = ctx.createOscillator()
  o.frequency.value = rate
  const g = ctx.createGain()
  g.gain.value = depth
  o.connect(g).connect(target)
  o.start(t)
  o.stop(t + dur + 0.05)
}

// amplitude roughness (growls, croaks): multiplies the signal by (1 - depth/2) ± depth/2
function roughen(ctx, src, t, dur, am) {
  if (!am) return src
  const g = ctx.createGain()
  g.gain.value = 1 - am[1] / 2
  lfo(ctx, t, dur, am[0], am[1] / 2, g.gain)
  src.connect(g)
  return g
}

// route through parallel formant (vocal-tract resonance) filters
function formants(ctx, src, t, dur, list) {
  if (!list) return src
  const sum = ctx.createGain()
  for (const [f, q, gain] of list) {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    curve(bp.frequency, t, dur, f)
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain * Math.sqrt(q) // bandpass loses level as Q rises
    src.connect(bp).connect(g).connect(sum)
  }
  return sum
}

// a pitched voice: oscillator → roughness → formants → envelope
function tone(ctx, out, o) {
  const { t, dur } = o
  const osc = ctx.createOscillator()
  osc.type = o.type || 'sawtooth'
  curve(osc.frequency, t, dur, o.f)
  if (o.vib) lfo(ctx, t, dur, o.vib[0], o.vib[1], osc.frequency)
  let node = roughen(ctx, osc, t, dur, o.am)
  node = formants(ctx, node, t, dur, o.formants)
  if (o.lp) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    curve(lp.frequency, t, dur, o.lp)
    node.connect(lp)
    node = lp
  }
  const g = ctx.createGain()
  envelope(g, t, dur, o.gain ?? 0.3, o.a, o.r)
  node.connect(g).connect(o.wet ? out.wet : out)
  if (o.wet && o.dry !== false) g.connect(out)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

// filtered noise: breath, hiss, splash, crunch
function noise(ctx, out, o) {
  const { t, dur } = o
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx)
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = o.filter || 'bandpass'
  curve(f.frequency, t, dur, o.f ?? 1000)
  f.Q.value = o.q ?? 1
  const node = roughen(ctx, src.connect(f), t, dur, o.am)
  const g = ctx.createGain()
  envelope(g, t, dur, o.gain ?? 0.2, o.a ?? 0.01, o.r ?? 0.1)
  node.connect(g).connect(o.wet ? out.wet : out)
  if (o.wet) g.connect(out)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}

// struck metal / bell: inharmonic decaying partials
function bell(ctx, out, t, base, partials, gain = 0.12, decay = 1.2, wet = true) {
  partials.forEach((ratio, i) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = base * ratio
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain / (i + 1), t + 0.005)
    g.gain.exponentialRampToValueAtTime(1e-4, t + decay / (1 + i * 0.4))
    o.connect(g).connect(out)
    if (wet) g.connect(out.wet)
    o.start(t)
    o.stop(t + decay + 0.1)
  })
}

// a low thud (impacts, headbutts, booms)
function thump(ctx, out, t, f0 = 90, gain = 0.5, dur = 0.25) {
  tone(ctx, out, { t, dur, type: 'sine', f: [[0, f0], [1, f0 * 0.4]], gain, a: 0.003, r: dur * 0.8 })
}

// ------------------------------------------------------------------ building blocks shared by several beasts
const croak = (c, o, t, p, gain = 0.5) => {
  tone(c, o, { t, dur: 0.22, f: [[0, 380 * p], [0.3, 430 * p], [1, 290 * p]], gain, a: 0.012, r: 0.08, am: [58, 0.75], formants: [[[[0, 760 * p], [1, 620 * p]], 4, 1.1], [1500 * p, 5, 0.7], [2600 * p, 6, 0.25]] })
  noise(c, o, { t, dur: 0.18, f: 900 * p, q: 1.2, gain: 0.05 })
}
const grunt = (c, o, t, f0, gain = 0.45, dur = 0.2) => {
  tone(c, o, { t, dur, f: [[0, f0 * 1.15], [1, f0 * 0.8]], gain, a: 0.01, r: 0.08, am: [38, 0.85], formants: [[420, 3, 1], [1050, 4, 0.45]] })
  noise(c, o, { t, dur: dur * 0.8, filter: 'lowpass', f: 700, q: 0.7, gain: gain * 0.25 })
}
const squeal = (c, o, t, p = 1, gain = 0.35, dur = 0.6) => {
  tone(c, o, { t, dur, f: [[0, 850 * p], [0.3, 1350 * p], [1, 950 * p]], gain, a: 0.02, r: 0.15, am: [70, 0.35], formants: [[1500 * p, 3, 1], [3000 * p, 4, 0.6]] })
  noise(c, o, { t, dur, f: 2600 * p, q: 1.5, gain: gain * 0.35 })
}
const bleat = (c, o, t, f0, trill, dur = 1.0, gain = 0.32, rough = 0.25) => {
  tone(c, o, { t, dur, f: [[0, f0 * 0.95], [0.2, f0 * 1.08], [1, f0 * 0.88]], vib: [trill, f0 * 0.07], gain, a: 0.04, r: 0.25, am: [trill, rough], formants: [[[[0, 650], [1, 850]], 4, 1], [1800, 6, 0.55], [2700, 8, 0.25]] })
}
const hiss = (c, o, t, dur, center, gain = 0.3, am) => {
  noise(c, o, { t, dur, f: center, q: 0.8, gain, a: 0.06, r: dur * 0.4, am })
}
const bark = (c, o, t, f0, fmt, gain = 0.45, dur = 0.16) => {
  tone(c, o, { t, dur, f: [[0, f0 * 1.25], [0.25, f0 * 1.3], [1, f0 * 0.85]], gain, a: 0.006, r: 0.08, am: [45, 0.3], formants: fmt })
  noise(c, o, { t, dur: dur * 0.6, f: fmt[0][0], q: 1, gain: gain * 0.2 })
}
const growl = (c, o, t, f0, fmt, dur = 0.9, gain = 0.4) => {
  tone(c, o, { t, dur, f: [[0, f0], [0.5, f0 * 1.1], [1, f0 * 0.9]], gain, a: 0.08, r: 0.2, am: [26, 0.9], formants: fmt })
  noise(c, o, { t, dur, f: fmt[0][0], q: 1.5, gain: gain * 0.3, am: [26, 0.9], a: 0.08, r: 0.2 })
}
const bubbles = (c, o, t, n, spread, lo = 300, hi = 900, gain = 0.12) => {
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * spread
    const f = lo + Math.random() * (hi - lo)
    tone(c, o, { t: tt, dur: 0.06, type: 'sine', f: [[0, f], [1, f * 2.2]], gain, a: 0.003, r: 0.04 })
  }
}
const splash = (c, o, t, gain = 0.4, dur = 1) => {
  noise(c, o, { t, dur, filter: 'lowpass', f: [[0, 4000], [1, 300]], q: 0.5, gain, a: 0.005, r: dur * 0.8 })
}
const DOG = [[550, 4, 1], [1350, 5, 0.6], [2200, 6, 0.3]] // large-dog formants (~850 Hz spacing)

// ------------------------------------------------------------------ the voices (p = pitch multiplier)
// call: noticed you / on the hunt / roaming   attack: the strike   (hurt and death reuse them, re-pitched)
export const VOICES = {
  raven: {
    call: (c, o, t, p = 1) => [0, 0.34, 0.62].forEach((d) => croak(c, o, t + d, p)),
    attack: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 0.4, f: [[0, 700 * p], [0.3, 820 * p], [1, 520 * p]], gain: 0.5, a: 0.01, r: 0.15, am: [62, 0.6], formants: [[900 * p, 3, 1], [1900 * p, 4, 0.6]] })
    },
  },
  ravenMemory: {
    // Muninn: higher croaks and the hollow knocking call ravens also use
    call: (c, o, t, p = 1) => {
      croak(c, o, t, p * 1.15)
      croak(c, o, t + 0.42, p * 1.1)
      ;[0.9, 1.0, 1.1].forEach((d) => tone(c, o, { t: t + d, dur: 0.05, type: 'sine', f: [[0, 1050 * p], [1, 900 * p]], gain: 0.3, a: 0.002, r: 0.04 }))
    },
    attack: (c, o, t, p = 1) => VOICES.raven.attack(c, o, t, p * 1.15),
  },
  eagle: {
    // "ra-ra-ra-raurau": accelerating deep barks ending in a long falling note
    call: (c, o, t, p = 1) => {
      const times = [0, 0.2, 0.36, 0.5, 0.62]
      times.forEach((d, i) => tone(c, o, { t: t + d, dur: 0.11, f: [[0, 560 * p], [1, 470 * p]], gain: 0.4, a: 0.006, r: 0.05, am: [80, 0.3], formants: [[1100 * p, 3, 1], [2300 * p, 5, 0.5]] }))
      tone(c, o, { t: t + 0.76, dur: 0.6, f: [[0, 580 * p], [0.3, 600 * p], [1, 330 * p]], gain: 0.45, a: 0.01, r: 0.3, am: [80, 0.3], formants: [[1100 * p, 3, 1], [2300 * p, 5, 0.5]] })
    },
    attack: (c, o, t, p = 1) => {
      noise(c, o, { t, dur: 1.1, filter: 'bandpass', f: [[0, 250], [0.6, 1600], [1, 200]], q: 0.6, gain: 0.5, a: 0.3, r: 0.4 }) // wind of its wings
      tone(c, o, { t: t + 0.5, dur: 0.6, f: [[0, 900 * p], [0.2, 980 * p], [1, 480 * p]], gain: 0.45, a: 0.01, r: 0.3, am: [70, 0.4], formants: [[1300 * p, 3, 1], [2600 * p, 4, 0.5]] })
    },
  },
  cow: {
    // a long moo: closed "mm" (low formants) opening to "oo", ~95–135 Hz fundamental
    call: (c, o, t, p = 1) =>
      tone(c, o, { t, dur: 2.1, f: [[0, 95 * p], [0.25, 135 * p], [0.75, 128 * p], [1, 88 * p]], gain: 0.55, a: 0.15, r: 0.5, formants: [[[[0, 300], [0.3, 680], [1, 520]], 5, 1.2], [[[0, 600], [0.3, 1100], [1, 900]], 6, 0.6], [2400, 8, 0.15]] }),
    attack: (c, o, t, p = 1) => {
      noise(c, o, { t, dur: 0.35, f: 600, q: 0.8, gain: 0.35, a: 0.01, r: 0.2 }) // snort
      tone(c, o, { t: t + 0.25, dur: 0.9, f: [[0, 120 * p], [0.3, 165 * p], [1, 110 * p]], gain: 0.6, a: 0.04, r: 0.3, am: [30, 0.35], formants: [[700, 4, 1.2], [1200, 6, 0.6]] })
    },
  },
  wolf: {
    // howl: rising glide, long steady note with slight vibrato, falling tail
    call: (c, o, t, p = 1) =>
      tone(c, o, { t, dur: 2.8, f: [[0, 300 * p], [0.15, 470 * p], [0.75, 455 * p], [1, 340 * p]], vib: [5, 5], gain: 0.42, a: 0.25, r: 0.7, formants: [[[[0, 420 * p], [0.2, 900 * p], [1, 600 * p]], 3, 1], [1400 * p, 6, 0.2]], wet: true }),
    attack: (c, o, t, p = 1) => {
      growl(c, o, t, 120 * p, [[480, 3, 1], [1200, 5, 0.5]], 0.55, 0.45)
      noise(c, o, { t: t + 0.5, dur: 0.06, filter: 'highpass', f: 1800, q: 0.7, gain: 0.5, a: 0.002, r: 0.04 }) // jaw snap
    },
  },
  hound: {
    // Garmr bays: three deep barks then a long "a-roooo"
    call: (c, o, t, p = 1) => {
      ;[0, 0.32, 0.64].forEach((d) => bark(c, o, t + d, 250 * p, DOG, 0.55, 0.18))
      tone(c, o, { t: t + 1.0, dur: 1.7, f: [[0, 230 * p], [0.2, 330 * p], [1, 245 * p]], vib: [6, 4], gain: 0.5, a: 0.06, r: 0.5, am: [40, 0.2], formants: [[[[0, 550], [1, 420]], 4, 1], [1250, 5, 0.5], [2200, 6, 0.2]], wet: true })
    },
    attack: (c, o, t, p = 1) => {
      growl(c, o, t, 85 * p, DOG, 0.7, 0.55)
      bark(c, o, t + 0.6, 260 * p, DOG, 0.6, 0.2)
    },
  },
  hart: {
    // red-deer alarm barks
    call: (c, o, t, p = 1) => [0, 0.55].forEach((d) => bark(c, o, t + d, 290 * p, [[700 * p, 3, 1], [1500 * p, 4, 0.6]], 0.42, 0.24)),
    attack: (c, o, t, p = 1) => tone(c, o, { t, dur: 0.6, f: [[0, 170 * p], [1, 130 * p]], gain: 0.45, a: 0.03, r: 0.2, am: [30, 0.5], formants: [[[[0, 650], [1, 420]], 4, 1], [[[0, 1300], [1, 950]], 5, 0.5]] }),
  },
  stag: {
    // Eikþyrnir: a full rutting roar — tonal, with formants sweeping down — then two grunts;
    // a watery shimmer for the rivers that flow from its antlers
    call: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 2.2, f: [[0, 118 * p], [0.3, 135 * p], [1, 98 * p]], gain: 0.45, a: 0.25, r: 0.5, am: [22, 0.2], formants: [[[[0, 720], [1, 380]], 4, 1.2], [[[0, 1400], [1, 880]], 5, 0.6], [[[0, 2300], [1, 1700]], 6, 0.25]], wet: true })
      ;[2.45, 2.85].forEach((d) => grunt(c, o, t + d, 105 * p, 0.45, 0.22))
      for (let i = 0; i < 8; i++) tone(c, o, { t: t + 0.4 + i * 0.22, dur: 0.18, type: 'sine', f: [[0, 1800 + Math.random() * 1600], [1, 2600 + Math.random() * 1600]], gain: 0.04, a: 0.01, r: 0.1, wet: true })
    },
    attack: (c, o, t, p = 1) => {
      // a harsh roar: noisy, poorly defined fundamental
      tone(c, o, { t, dur: 0.9, f: [[0, 95 * p], [1, 80 * p]], gain: 0.5, a: 0.04, r: 0.3, am: [33, 0.8], formants: [[[[0, 650], [1, 420]], 3, 1], [[[0, 1300], [1, 900]], 4, 0.5]] })
      noise(c, o, { t, dur: 0.9, f: [[0, 700], [1, 450]], q: 2, gain: 0.3, a: 0.04, r: 0.3 })
    },
  },
  battleBoar: {
    // Hildisvíni: grunt series then a battle trumpet; armour clanks on the charge
    call: (c, o, t, p = 1) => {
      ;[0, 0.24, 0.46, 0.66].forEach((d) => grunt(c, o, t + d, 150 * p))
      tone(c, o, { t: t + 0.95, dur: 0.6, f: [[0, 480 * p], [0.3, 720 * p], [1, 600 * p]], gain: 0.4, a: 0.03, r: 0.2, am: [55, 0.3], formants: [[1200 * p, 3, 1], [2400, 5, 0.4]] })
    },
    attack: (c, o, t, p = 1) => {
      grunt(c, o, t, 160 * p, 0.5, 0.18)
      squeal(c, o, t + 0.16, p * 0.9, 0.35, 0.45)
      bell(c, o, t + 0.05, 523, [1, 2.5, 4.7], 0.08, 0.5, false) // armour plate
    },
  },
  goldenBoar: {
    // Gullinbursti: grunts with a golden shimmer from its glowing bristles
    call: (c, o, t, p = 1) => {
      ;[0, 0.22, 0.42].forEach((d) => grunt(c, o, t + d, 175 * p, 0.42))
      bell(c, o, t + 0.2, 1568, [1, 1.5, 2.0, 2.76], 0.06, 1.6)
    },
    attack: (c, o, t, p = 1) => {
      squeal(c, o, t, p, 0.38, 0.6)
      bell(c, o, t, 1318, [1, 2.0, 3.0], 0.06, 1.0)
    },
  },
  feastBoar: {
    // Sæhrímnir: slow, deep, heavy grunts
    call: (c, o, t, p = 1) => [0, 0.34, 0.64, 0.9, 1.3].forEach((d, i) => grunt(c, o, t + d, (105 - i * 3) * p, 0.55, 0.26)),
    attack: (c, o, t, p = 1) => {
      grunt(c, o, t, 110 * p, 0.55, 0.22)
      squeal(c, o, t + 0.2, p * 0.8, 0.4, 0.7)
    },
  },
  meadGoat: {
    // Heiðrún: a clear, trilled bleat
    call: (c, o, t, p = 1) => {
      bleat(c, o, t, 520 * p, 9, 1.0)
      bleat(c, o, t + 1.25, 500 * p, 9, 0.7)
    },
    attack: (c, o, t, p = 1) => {
      thump(c, o, t, 95, 0.55) // headbutt
      bleat(c, o, t + 0.1, 560 * p, 12, 0.45, 0.35, 0.4)
    },
  },
  grinderGoat: {
    // Tanngrisnir, "teeth-grinder": rough low bleat, then grinding teeth
    call: (c, o, t, p = 1) => {
      bleat(c, o, t, 360 * p, 14, 1.0, 0.32, 0.5)
      for (let i = 0; i < 9; i++) noise(c, o, { t: t + 1.15 + i * 0.075 + Math.random() * 0.03, dur: 0.035, filter: 'highpass', f: 2200, q: 0.8, gain: 0.25, a: 0.002, r: 0.02 })
    },
    attack: (c, o, t, p = 1) => {
      thump(c, o, t, 85, 0.6)
      bleat(c, o, t + 0.1, 400 * p, 15, 0.45, 0.35, 0.6)
    },
  },
  barerGoat: {
    // Tanngnjóstr, "teeth-barer": deeper bleat and sharp teeth snaps
    call: (c, o, t, p = 1) => {
      bleat(c, o, t, 310 * p, 11, 1.1, 0.34, 0.4)
      ;[1.25, 1.45].forEach((d) => noise(c, o, { t: t + d, dur: 0.05, filter: 'highpass', f: 3000, q: 1, gain: 0.45, a: 0.001, r: 0.03 }))
    },
    attack: (c, o, t, p = 1) => {
      thump(c, o, t, 80, 0.45)
      noise(c, o, { t: t + 0.12, dur: 0.05, filter: 'highpass', f: 3000, q: 1, gain: 0.35, a: 0.001, r: 0.03 })
    },
  },
  squirrel: {
    // Ratatoskr: the territorial rattle followed by a high "seet"
    call: (c, o, t, p = 1) => {
      for (let i = 0; i < 18; i++) {
        const tt = t + i * 0.062
        noise(c, o, { t: tt, dur: 0.028, f: 3200 * p, q: 3, gain: 0.6, a: 0.002, r: 0.02 })
        tone(c, o, { t: tt, dur: 0.028, type: 'square', f: [[0, 2300 * p], [1, 1900 * p]], gain: 0.12, a: 0.002, r: 0.02 })
      }
      tone(c, o, { t: t + 1.3, dur: 0.32, type: 'sine', f: [[0, 7200 * p], [1, 6600 * p]], gain: 0.22, a: 0.03, r: 0.12 })
    },
    attack: (c, o, t, p = 1) => [0, 0.09, 0.18].forEach((d) => tone(c, o, { t: t + d, dur: 0.06, type: 'square', f: [[0, 2600 * p], [1, 1700 * p]], gain: 0.32, a: 0.002, r: 0.04, formants: [[3000 * p, 2, 1]] })),
  },
  kraken: {
    // no voice: a sub-bass rumble from the deep and rising bubbles
    call: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 2.6, type: 'sine', f: [[0, 42 * p], [0.5, 55 * p], [1, 38 * p]], gain: 0.5, a: 0.4, r: 0.8 })
      tone(c, o, { t, dur: 2.6, f: [[0, 84 * p], [1, 70 * p]], gain: 0.25, a: 0.4, r: 0.8, lp: 220, am: [7, 0.6] })
      bubbles(c, o, t + 0.3, 16, 2.2)
    },
    attack: (c, o, t, p = 1) => {
      noise(c, o, { t, dur: 0.5, filter: 'bandpass', f: [[0, 300], [1, 1500]], q: 0.7, gain: 0.25, a: 0.2, r: 0.1 }) // tentacles rising out of the water
      thump(c, o, t + 0.55, 55, 0.7, 0.5)
      splash(c, o, t + 0.55, 0.5, 1.2)
    },
  },
  whale: {
    // Lyngbakr: a long humpback-style moan and the roar of its blowhole
    call: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 3.6, f: [[0, 105 * p], [0.35, 240 * p], [0.6, 205 * p], [1, 82 * p]], vib: [3, 4], gain: 0.5, a: 0.5, r: 1, formants: [[[[0, 320], [0.4, 600], [1, 300]], 3, 1], [900, 5, 0.35]], wet: true })
      noise(c, o, { t: t + 3.4, dur: 1.3, f: 900, q: 0.5, gain: 0.3, a: 0.05, r: 0.9 })
    },
    attack: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 1.0, f: [[0, 70 * p], [0.3, 95 * p], [1, 55 * p]], gain: 0.55, a: 0.05, r: 0.4, am: [18, 0.4], lp: 600 })
      splash(c, o, t + 0.4, 0.55, 1.4)
    },
  },
  seaSerpent: {
    // Jörmungandr: a vast, low, viper-like hiss (energy around 200–400 Hz) over a deep rumble
    call: (c, o, t, p = 1) => {
      hiss(c, o, t, 2.8, [[0, 340 * p], [1, 240 * p]], 0.6)
      hiss(c, o, t + 0.2, 2.4, 5500, 0.08)
      tone(c, o, { t, dur: 2.8, type: 'sine', f: [[0, 45], [1, 36]], gain: 0.5, a: 0.5, r: 0.8 })
    },
    attack: (c, o, t, p = 1) => {
      hiss(c, o, t, 0.7, [[0, 500 * p], [1, 280 * p]], 0.65)
      splash(c, o, t + 0.3, 0.5, 1)
    },
  },
  lindworm: {
    // a mid-pitched stuttering hiss over a low growl
    call: (c, o, t, p = 1) => {
      hiss(c, o, t, 1.6, 3400 * p, 0.32, [9, 0.6])
      growl(c, o, t + 0.2, 140 * p, [[500, 3, 1], [1100, 4, 0.4]], 1.2, 0.25)
    },
    attack: (c, o, t, p = 1) => {
      hiss(c, o, t, 0.45, 2600 * p, 0.45)
      noise(c, o, { t: t + 0.4, dur: 0.06, filter: 'highpass', f: 1500, q: 0.7, gain: 0.45, a: 0.002, r: 0.04 })
    },
  },
  nidhoggr: {
    // the root-gnawer: crunching bites, a low dragon rumble, leathery wingbeats
    call: (c, o, t, p = 1) => {
      for (let i = 0; i < 8; i++) noise(c, o, { t: t + i * 0.16 + Math.random() * 0.04, dur: 0.08, filter: 'lowpass', f: 1300, q: 1.5, gain: 0.5, a: 0.004, r: 0.05, am: [90, 0.8] })
      tone(c, o, { t: t + 0.9, dur: 1.6, f: [[0, 68 * p], [0.3, 82 * p], [1, 58 * p]], gain: 0.5, a: 0.2, r: 0.5, am: [24, 0.6], formants: [[[[0, 380], [1, 300]], 3, 1], [750, 5, 0.4]] })
      hiss(c, o, t + 1.2, 1.2, 1800 * p, 0.15)
      ;[2.6, 3.0].forEach((d) => noise(c, o, { t: t + d, dur: 0.22, filter: 'lowpass', f: [[0, 300], [1, 900]], q: 0.7, gain: 0.3, a: 0.05, r: 0.12 }))
    },
    attack: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 0.7, f: [[0, 380 * p], [0.3, 880 * p], [1, 300 * p]], gain: 0.4, a: 0.02, r: 0.25, am: [60, 0.5], formants: [[1200, 3, 1], [2500, 4, 0.5]] })
      hiss(c, o, t, 0.7, 2000, 0.25)
    },
  },
  dragon: {
    // Fáfnir: a deep, rough roar; the venom breath is a long seething hiss with gurgles
    call: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 2.3, f: [[0, 66 * p], [0.3, 92 * p], [1, 52 * p]], gain: 0.45, a: 0.12, r: 0.6, am: [25, 0.55], formants: [[[[0, 520], [1, 340]], 3, 1.2], [[[0, 1100], [1, 750]], 4, 0.6], [2400, 6, 0.2]], wet: true })
      noise(c, o, { t, dur: 2.3, f: [[0, 500], [1, 350]], q: 1.2, gain: 0.25, am: [25, 0.6], a: 0.12, r: 0.6 })
    },
    attack: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 0.8, f: [[0, 90 * p], [0.2, 120 * p], [1, 70 * p]], gain: 0.6, a: 0.03, r: 0.3, am: [30, 0.6], formants: [[600, 3, 1.2], [1300, 4, 0.5]] })
      noise(c, o, { t: t + 0.7, dur: 0.07, filter: 'highpass', f: 1200, q: 0.7, gain: 0.55, a: 0.002, r: 0.05 }) // jaws
    },
    special: (c, o, t, p = 1) => {
      hiss(c, o, t, 1.6, [[0, 1200], [1, 2600]], 0.45)
      bubbles(c, o, t, 10, 1.4, 200, 600, 0.08)
      tone(c, o, { t, dur: 1.5, f: [[0, 70], [1, 55]], gain: 0.35, a: 0.1, r: 0.5, am: [20, 0.6], lp: 400 })
    },
  },
  troll: {
    // a giant's bellow ("HOOARGH": male "o" vowel formants, very low pitch)
    call: (c, o, t, p = 1) => {
      noise(c, o, { t, dur: 0.3, f: 500, q: 0.6, gain: 0.25 }) // huff
      tone(c, o, { t: t + 0.25, dur: 1.5, f: [[0, 82 * p], [0.3, 102 * p], [1, 68 * p]], gain: 0.45, a: 0.06, r: 0.4, am: [19, 0.4], formants: [[[[0, 450], [1, 380]], 5, 1.2], [[[0, 820], [1, 700]], 6, 0.6], [2500, 8, 0.12]], wet: true })
    },
    attack: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 0.38, f: [[0, 110 * p], [1, 80 * p]], gain: 0.6, a: 0.01, r: 0.15, am: [22, 0.5], formants: [[600, 4, 1.2], [1000, 5, 0.6]] }) // "HUH!"
      noise(c, o, { t: t + 0.2, dur: 0.5, filter: 'bandpass', f: [[0, 300], [1, 1400]], q: 0.8, gain: 0.35, a: 0.2, r: 0.1 }) // club whoosh
    },
    special: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 0.5, f: [[0, 95 * p], [0.4, 125 * p], [1, 85 * p]], gain: 0.55, a: 0.03, r: 0.2, am: [20, 0.5], formants: [[550, 4, 1.2], [950, 5, 0.6]] })
      noise(c, o, { t: t + 0.35, dur: 0.6, filter: 'bandpass', f: [[0, 300], [1, 1000]], q: 0.8, gain: 0.3, a: 0.2, r: 0.2 })
    },
  },
  brunnmigi: {
    // wet, gurgling croak with bubbles; it retches when it strikes
    call: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 1.3, f: [[0, 150 * p], [0.5, 120 * p], [1, 135 * p]], gain: 0.45, a: 0.05, r: 0.3, am: [17, 0.95], formants: [[300, 3, 1], [900, 4, 0.5]] })
      bubbles(c, o, t + 0.1, 12, 1.2, 150, 450, 0.1)
    },
    attack: (c, o, t, p = 1) => [0, 0.18, 0.34].forEach((d) => noise(c, o, { t: t + d, dur: 0.14, f: 1100 * p, q: 1.3, gain: 0.95, a: 0.005, r: 0.08, am: [40, 0.8] })),
  },
  merman: {
    // "þá hló marbendill" — the merman laughs three times
    call: (c, o, t, p = 1) => {
      ;[0, 0.24, 0.5].forEach((d, i) => {
        const f0 = (235 - i * 15) * p
        const ha = { t: t + d, dur: 0.17, f: [[0, f0], [1, f0 * 0.85]], gain: 0.3, a: 0.01, r: 0.07, formants: [[750, 6, 1], [1200, 7, 0.7], [2600, 9, 0.2]], wet: true }
        tone(c, o, ha)
        tone(c, o, { ...ha, f: [[0, f0 * 1.012], [1, f0 * 0.86]], gain: 0.2 }) // watery doubling
        noise(c, o, { t: t + d, dur: 0.05, f: 1800, q: 1, gain: 0.12, a: 0.003, r: 0.03 }) // breathy "h"
      })
    },
    attack: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 0.3, f: [[0, 330 * p], [1, 250 * p]], gain: 0.4, a: 0.01, r: 0.1, am: [40, 0.5], formants: [[800, 5, 1], [1300, 6, 0.6]] })
      splash(c, o, t + 0.15, 0.35, 0.6)
    },
  },
  ghost: {
    // Vörðr: a thin wavering wail over breathy whispers
    call: (c, o, t, p = 1) => {
      tone(c, o, { t, dur: 3.0, type: 'sine', f: [[0, 320 * p], [0.4, 540 * p], [1, 270 * p]], vib: [4, 12], gain: 0.25, a: 0.6, r: 1, wet: true, dry: false })
      tone(c, o, { t, dur: 3.0, type: 'triangle', f: [[0, 322 * p], [0.4, 545 * p], [1, 268 * p]], vib: [4.4, 10], gain: 0.12, a: 0.6, r: 1, wet: true })
      noise(c, o, { t: t + 0.3, dur: 2.4, f: [[0, 400], [0.5, 900], [1, 350]], q: 4, gain: 0.12, a: 0.5, r: 0.8, wet: true })
    },
    attack: (c, o, t, p = 1) => {
      noise(c, o, { t, dur: 0.6, filter: 'highpass', f: [[0, 800], [1, 4000]], q: 0.7, gain: 0.2, a: 0.05, r: 0.3, wet: true })
      tone(c, o, { t, dur: 0.6, type: 'sine', f: [[0, 900 * p], [1, 1300 * p]], vib: [11, 30], gain: 0.13, a: 0.05, r: 0.3, wet: true })
    },
  },
  fox: {
    // Fylgja: the vixen's shriek, echoing like a spirit; the stuttering gekker when it bites
    call: (c, o, t, p = 1) =>
      tone(c, o, { t, dur: 0.95, f: [[0, 700 * p], [0.18, 1150 * p], [1, 780 * p]], a: 0.02, r: 0.3, am: [85, 0.35], formants: [[1200 * p, 3, 1], [2400 * p, 4, 0.6], [3600 * p, 6, 0.2]], wet: true, gain: 0.3 }),
    attack: (c, o, t, p = 1) => {
      for (let i = 0; i < 9; i++) tone(c, o, { t: t + i * 0.065, dur: 0.045, f: [[0, 950 * p], [1, 780 * p]], gain: 0.3, a: 0.003, r: 0.02, formants: [[1300, 3, 1], [2600, 4, 0.4]], wet: true })
    },
  },
  landSpirit: {
    // Landvættir: the earth rumbles and the rune-stone rings
    call: (c, o, t, p = 1) => {
      noise(c, o, { t, dur: 2.2, filter: 'lowpass', f: 130, q: 0.8, gain: 0.55, a: 0.5, r: 0.8, am: [6, 0.5] })
      bell(c, o, t + 0.5, 220 * p, [1, 2.76, 5.4, 8.93], 0.16, 3)
      bell(c, o, t + 1.3, 330 * p, [1, 2.76, 5.4], 0.1, 2.5)
    },
    attack: (c, o, t, p = 1) => {
      thump(c, o, t, 65, 0.5, 0.6)
      bell(c, o, t, 440 * p, [1, 2.76, 5.4], 0.12, 1.2)
    },
  },
}

// ------------------------------------------------------------------ the shared night "echo" for wet sounds
const echoCache = new WeakMap()
function echoBus(ctx, master) {
  let e = echoCache.get(ctx)
  if (e) return e
  e = ctx.createGain()
  const d1 = ctx.createDelay(1)
  const d2 = ctx.createDelay(1)
  d1.delayTime.value = 0.23
  d2.delayTime.value = 0.37
  const fb = ctx.createGain()
  fb.gain.value = 0.42
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2200
  const ret = ctx.createGain()
  ret.gain.value = 0.55
  e.connect(d1)
  e.connect(d2)
  d1.connect(lp)
  d2.connect(lp)
  lp.connect(fb).connect(d1)
  lp.connect(ret).connect(master)
  echoCache.set(ctx, e)
  return e
}

// ------------------------------------------------------------------ playing a creature's sound in the world
const MAX_HEAR = 160

function playVoice(voice, kind, p, gain = 1, pan = 0, muffle = 20000) {
  const out = audioOut()
  if (!out || !voice) return
  const { ctx, master } = out
  const fn = voice[kind] || voice.call
  const bus = ctx.createGain()
  bus.gain.value = gain
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = muffle
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  bus.connect(lp)
  if (panner) {
    panner.pan.value = pan
    lp.connect(panner).connect(master)
  } else lp.connect(master)
  const wet = ctx.createGain()
  wet.gain.value = gain
  wet.connect(echoBus(ctx, master))
  bus.wet = wet
  fn(ctx, bus, ctx.currentTime + 0.02, p)
}

// kind: 'call' | 'attack' | 'hurt' | 'death' | 'special'
export function creatureSound(m, kind = 'call') {
  const def = m.def
  const voice = VOICES[def.voice]
  if (!voice) return
  const now = performance.now()
  // don't let one creature talk over itself (hurt/death always get through)
  if (kind !== 'hurt' && kind !== 'death' && m.lastSound && now - m.lastSound < 1200) return
  m.lastSound = now
  const P = G.player.pos
  const dx = m.pos.x - P.x
  const dz = m.pos.z - P.z
  const d = Math.hypot(dx, dz, (m.pos.y - P.y) * 0.5)
  if (d > MAX_HEAR) return
  const near = 1 - d / MAX_HEAR
  const gain = Math.max(0.04, near * near) * (def.big ? 1.15 : 1)
  // stereo position relative to where the player is looking
  const yaw = G.player.yaw || 0
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  const pan = d > 0.5 ? Math.max(-0.85, Math.min(0.85, ((dx * rx + dz * rz) / d) * 0.85)) : 0
  const muffle = 600 + 19000 * near * near
  const base = def.pitch || 1
  let p = base
  let k = kind
  if (kind === 'hurt') {
    k = 'attack'
    p = base * 1.25
  } else if (kind === 'death') {
    k = 'call'
    p = base * 0.78
  }
  playVoice(voice, k, p, gain, pan, muffle)
}

// for the bestiary viewer: play a voice at full volume, centred
export function previewVoice(def, kind = 'call') {
  playVoice(VOICES[def.voice], kind, def.pitch || 1, 0.9, 0, 20000)
}
