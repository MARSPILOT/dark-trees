import { create } from 'zustand'
import * as THREE from 'three'

export const START_ARROWS = 25
export const MAX_HEALTH = 100

let msgId = 0

export const useGame = create((set, get) => ({
  phase: 'menu', // menu | playing | paused | dead | won
  mouseMode: 'lock', // lock | free (pointer lock refused by the browser)
  gameId: 0,
  health: MAX_HEALTH,
  arrows: START_ARROWS,
  kills: 0,
  total: 0,
  hunting: 0,
  charge: 0,
  target: null,
  prompt: null,
  hurtAt: 0,
  messages: [],
  slain: [],
  startTime: 0,
  endTime: 0,

  setPhase: (phase) => set({ phase }),
  setMouseMode: (mouseMode) => set({ mouseMode }),
  start: () => set({ phase: 'playing', startTime: get().startTime || performance.now() }),
  restart: () =>
    set((s) => ({
      phase: 'playing',
      gameId: s.gameId + 1,
      health: MAX_HEALTH,
      arrows: START_ARROWS,
      kills: 0,
      charge: 0,
      target: null,
      prompt: null,
      messages: [],
      slain: [],
      startTime: performance.now(),
      endTime: 0,
    })),
  setTotal: (total) => set({ total }),
  setHunting: (hunting) => get().hunting !== hunting && set({ hunting }),
  setCharge: (charge) => set({ charge }),
  setTarget: (target) => get().target !== target && set({ target }),
  setPrompt: (prompt) => get().prompt !== prompt && set({ prompt }),
  useArrow: () => {
    const a = get().arrows
    if (a <= 0) return false
    set({ arrows: a - 1 })
    return true
  },
  addArrows: (n) => set((s) => ({ arrows: s.arrows + n })),
  heal: (n) => set((s) => ({ health: Math.min(MAX_HEALTH, s.health + n) })),
  damage: (n) => {
    const s = get()
    if (s.phase !== 'playing') return
    const health = Math.max(0, s.health - n)
    set({ health, hurtAt: performance.now() })
    if (health <= 0) {
      set({ phase: 'dead', endTime: performance.now() })
      document.exitPointerLock?.()
    }
  },
  addKill: (name) => {
    const s = get()
    const kills = s.kills + 1
    set({ kills, slain: [...s.slain, name] })
    s.message(`${name} has been slain`)
    if (kills >= s.total && s.total > 0) {
      set({ phase: 'won', endTime: performance.now() })
      document.exitPointerLock?.()
    }
  },
  message: (text) => {
    const id = ++msgId
    set((s) => ({ messages: [...s.messages.slice(-3), { id, text }] }))
    setTimeout(() => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })), 3800)
  },
}))

// Mutable per-frame game state (kept out of React for performance)
export const G = {
  player: {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    onGround: false,
    shake: 0,
    inWater: false,
  },
  monsters: [],
  arrows: [],
  projectiles: [],
  chests: [],
  fx: null, // particle emitter, set by <Particles/>
  time: 0,
}
