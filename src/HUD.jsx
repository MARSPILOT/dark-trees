import { useEffect, useRef } from 'react'
import { useGame, G, MAX_HEALTH } from './store'
import { SPECIES } from './monsters/species'
import { requestLock } from './components/Player'

const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Compass() {
  const strip = useRef()
  useEffect(() => {
    let raf
    const loop = () => {
      const yaw = G.player.yaw || 0
      // heading in degrees, 0 = north (-Z)
      let deg = ((-yaw * 180) / Math.PI) % 360
      if (deg < 0) deg += 360
      if (strip.current) strip.current.style.transform = `translateX(${-deg * 2}px)`
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  const marks = []
  for (let d = -360; d <= 720; d += 15) {
    const n = ((d % 360) + 360) % 360
    const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n]
    marks.push(
      <span key={d} className={label ? 'cardinal' : 'tick'} style={{ left: d * 2 }}>
        {label || '·'}
      </span>
    )
  }
  return (
    <div className="compass">
      <div className="compass-strip" ref={strip}>
        {marks}
      </div>
      <div className="compass-needle" />
    </div>
  )
}

function Bestiary() {
  return (
    <div className="bestiary">
      {SPECIES.map((s) => (
        <span key={s.id} title={s.title}>
          {s.name}
        </span>
      ))}
    </div>
  )
}

export function HUD() {
  const phase = useGame((s) => s.phase)
  const health = useGame((s) => s.health)
  const arrows = useGame((s) => s.arrows)
  const kills = useGame((s) => s.kills)
  const total = useGame((s) => s.total)
  const hunting = useGame((s) => s.hunting)
  const charge = useGame((s) => s.charge)
  const target = useGame((s) => s.target)
  const prompt = useGame((s) => s.prompt)
  const messages = useGame((s) => s.messages)
  const hurtAt = useGame((s) => s.hurtAt)
  const startTime = useGame((s) => s.startTime)
  const endTime = useGame((s) => s.endTime)
  const restart = useGame((s) => s.restart)
  const start = useGame((s) => s.start)
  const mouseMode = useGame((s) => s.mouseMode)

  const vignette = useRef()
  useEffect(() => {
    if (!hurtAt || !vignette.current) return
    const el = vignette.current
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
  }, [hurtAt])

  const targetDef = target && SPECIES.find((s) => s.name === target)
  const hp = health / MAX_HEALTH
  const lowHealth = hp < 0.3

  const begin = () => {
    start()
    requestLock()
  }
  const again = () => {
    restart()
    requestLock()
  }

  return (
    <div className="hud">
      <div ref={vignette} className="vignette" />
      {lowHealth && phase === 'playing' && <div className="vignette low" />}

      {(phase === 'playing' || phase === 'paused') && (
        <>
          <Compass />
          <div className="crosshair">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="2" fill="#f4ead2" />
              <circle cx="32" cy="32" r="14" fill="none" stroke="rgba(244,234,210,0.25)" strokeWidth="2" />
              <circle
                cx="32"
                cy="32"
                r="14"
                fill="none"
                stroke={charge >= 1 ? '#ffd35a' : '#f4ead2'}
                strokeWidth="2.5"
                strokeDasharray={`${charge * 88} 88`}
                transform="rotate(-90 32 32)"
              />
            </svg>
          </div>
          {targetDef && (
            <div className="target">
              <div className="target-name">{targetDef.name}</div>
              <div className="target-title">{targetDef.title}</div>
            </div>
          )}
          <div className="stats">
            <div className="health">
              <div className="label">Health</div>
              <div className="bar">
                <div className="fill" style={{ width: `${hp * 100}%`, background: lowHealth ? '#e0412f' : '#b8322a' }} />
              </div>
            </div>
            <div className="arrows">
              <svg width="26" height="26" viewBox="0 0 26 26">
                <path d="M3 23 L20 6 M20 6 L14 7 M20 6 L19 12 M3 23 L3 18 M3 23 L8 23" stroke="#e9dcc0" strokeWidth="2" fill="none" />
              </svg>
              <span className={arrows === 0 ? 'empty' : ''}>{arrows}</span>
            </div>
          </div>
          <div className="kills">
            <span className="rune">ᛟ</span> Beasts slain <b>{kills}</b> / {total}
            {hunting > 0 && <div className="hunting">{hunting === 1 ? '1 beast hunts you' : `${hunting} beasts hunt you`}</div>}
          </div>
          {prompt && <div className="prompt">{prompt}</div>}
          {mouseMode === 'free' && phase === 'playing' && (
            <div className="mouse-note">Free-look mode: move the mouse to aim · rest it at a screen edge to keep turning · Esc pauses</div>
          )}
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className="msg">
                {m.text}
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'menu' && (
        <div className="screen menu">
          <div className="panel">
            <div className="eyebrow">An age before memory</div>
            <h1>Dark Trees</h1>
            <h2>Beasts of the North</h2>
            <p className="lore">
              Under a blood-red moon you wake alone in Myrkviðr, the dark wood between the mountains. Every creature of the old sagas has caught your scent — from
              the river-serpent to the ravens overhead — and as the night wears on, one after another they will come for you. Slay them all to leave the forest.
            </p>
            <div className="controls">
              <div><kbd>W A S D</kbd> move</div>
              <div><kbd>Shift</kbd> sprint</div>
              <div><kbd>Space</kbd> jump / swim up</div>
              <div><kbd>Mouse</kbd> look</div>
              <div><kbd>Hold click</kbd> draw bow, release to loose</div>
              <div><kbd>E</kbd> open chest</div>
            </div>
            <p className="hint">Arrows are few. Chests hidden among the boulders and pines hold more — and sometimes mead.</p>
            <button onClick={begin}>Enter the forest</button>
            <div className="bestiary-label">The hunters</div>
            <Bestiary />
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="screen dim">
          <div className="panel small">
            <h2>Paused</h2>
            <p>Click anywhere to return to the hunt.</p>
            {mouseMode === 'free' && <p className="hint">Your browser blocked mouse capture, so free-look is on.</p>}
          </div>
        </div>
      )}

      {phase === 'dead' && (
        <div className="screen dead">
          <div className="panel small">
            <h1>You have fallen</h1>
            <p>
              The forest claims another soul. You slew {kills} of {total} beasts and survived {fmtTime(endTime - startTime)}.
            </p>
            <button onClick={again}>Rise again</button>
          </div>
        </div>
      )}

      {phase === 'won' && (
        <div className="screen won">
          <div className="panel small">
            <h1>The forest is silent</h1>
            <p>
              All {total} beasts lie slain. The skalds will sing of this for a thousand winters. Time: {fmtTime(endTime - startTime)}.
            </p>
            <button onClick={again}>Hunt again</button>
          </div>
        </div>
      )}
    </div>
  )
}
