# Solmar Heat — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/luthfiseptian1303-cmyk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/luthfiseptian1303-cmyk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Referral code:
**s00bb3np**.

You are **Rico Vega**, a driver new to **Solmar Bay** who owes the wrong people
money. Five jobs stand between him and freedom: steal a car and bring it to
the garage, run a package across town against the clock, tail a courier and
ram him off the road, lose a three-star police heat, and pull off the big
score — three cash bags, then back to the hideout.

## What is in the game

- **A city to explore** — a 4200×3000 road grid with buildings, parks, plazas
  and a beach, on foot and by car, with a camera that follows you.
- **Traffic and pedestrians** — AI cars that follow the roads and turn at
  intersections, and pedestrians who stroll the sidewalks and panic when a
  crime happens near them.
- **Cars to steal and drive** — walk up to any car, press E, and drive off.
  Arcade handling with acceleration, braking, reversing and steering.
- **A wanted level and police who respond** — 1 to 5 stars. Stealing cars,
  punching or shooting people, and hitting pedestrians raise the heat;
  cruisers spawn, chase and ram you, and standing too close to one on foot
  gets you busted. Break line of sight and stay hidden to lose the stars.
- **Missions and a story** — five jobs in a row with objective markers, a
  distance readout, timers where the story needs them, payouts, and a
  mission-complete / mission-failed flow with retry.
- **Combat** — punch up close (Space or click) and a pistol with ammo (F or
  right-click, aim with the mouse).
- **A HUD with a minimap** — money, health, ammo, wanted stars, speed,
  mission objective, and a live minimap showing roads, the objective, police
  and traffic.
- **Start screen, pause, and a save** — progress (money, mission, best cash)
  saves to localStorage automatically; a start screen, pause menu, wasted /
  busted screens, and a story-complete screen.
- **Sound, all synthesised** — engine hum that follows your speed, a
  two-tone police siren, punch / gunshot / pickup / crash effects, and a bass
  loop. No audio files. M mutes.

## How to play

Serve `game/` with any static server and open `index.html` in a desktop
browser (Chrome works), for example:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no accounts. Keyboard and mouse:

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk and drive |
| Shift | Run |
| E | Steal / exit car |
| Space / click | Punch |
| F / right-click | Shoot (aim with the mouse) |
| P / Esc | Pause |
| R | Retry a failed mission |
| M | Mute |

## How it is built

Plain static files under `game/` — one HTML page and ES modules, no library,
no build step. The source is split by job so the structure reads at a glance:

- `game/src/config.js` — every tuning number, colour and mission reward
- `game/src/world.js` — the city (roads, buildings, parks) and shared state
- `game/src/player.js` — walking, driving, stealing cars, punch and shoot
- `game/src/traffic.js` — AI cars and pedestrians
- `game/src/police.js` — the wanted level and police pursuit
- `game/src/missions.js` — the five story missions
- `game/src/render.js` — the camera and all drawing
- `game/src/hud.js` — HUD, minimap and menus
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/input.js` — keyboard, mouse and touch
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — the game loop, screens, save/load and self-test

Screenshot scenes are staged with `?shot=cover|drive|chase|mission&seed=7`;
`?selftest=1` runs a scripted playthrough (walk, steal, drive, wanted,
police, mission) and reports the result in the page.

## License

MIT — see `LICENSE`. Everything in this game (city, characters, vehicles,
names, story, art, sounds) is original.
