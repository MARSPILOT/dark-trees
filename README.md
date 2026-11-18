# Dark Trees — Beasts of the North

A first-person 3D survival hunt in an ancient Norse forest under a blood-red moon, built with Three.js + React Three Fiber.

Creatures rest in their habitats; roughly every 2 minutes one catches your scent and hunts you (tune `FIRST_HUNT` / `HUNT_INTERVAL` in `src/monsters/brain.js`). Walking right up to a creature or shooting it rouses it too.

```bash
npm install
npm run dev        # then open http://localhost:5173
```

Open `http://localhost:5173/?gallery` to inspect every creature model in the bestiary viewer — click ♪ call / ♪ attack under a creature to hear its voice.

## Creature voices
Every creature has its own synthesized call, attack, hurt and death sounds (`src/monsters/sounds.js`, assigned per species via `voice` in `species.js`). Each voice is modelled on the real animal behind the myth — raven croaks, sea-eagle barking calls, cattle moos, wolf howls, deer barks and stag roars with falling formants, boar grunts and squeals, trilled goat bleats, squirrel rattles, humpback moans, viper-like hisses, a fox's scream — and the saga creatures get voices from their legends (Garm baying before Gnipahellir, the merman's three laughs). Sounds are positioned in stereo, muffled with distance, and resting beasts call out now and then in the night.

## Controls
WASD move · Shift sprint · Space jump/swim · Mouse look · Hold left-click to draw, release to shoot · E open chest · Esc pause

## Layout
- `src/world/` — terrain height function (hills, mountain ring, rivers, lakes, waterfall cliff) and deterministic placement of trees, boulders, chests
- `src/components/` — terrain/water/waterfall/sky rendering, vegetation, player + bow, arrows, chests, projectiles, particles
- `src/monsters/` — `species.js` (all 30 creatures: stats + habitat), `models.jsx` (procedural low-poly models), `brain.js` (chase AI per movement type, attacks, hit detection), `Monsters.jsx` (rendering)
