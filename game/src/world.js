// The city of Solmar Bay: a road grid, the buildings and parks inside its blocks,
// and the shared game state every other module reads and updates.
//
// The map is a grid of roads every WORLD.blockGap pixels. Between four roads sits a
// block; each block holds one or two buildings, or a park, or a plaza. Cars drive on
// the roads, pedestrians walk on the sidewalks beside them, and buildings are solid.

import { WORLD, PLAYER, CAR, TRAFFIC, PALETTE } from './config.js';
import { randomInt, randomPick, clamp, distance } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_DEAD = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_MISSION_FAILED = 8;

/** Road centre lines, derived from the grid spacing. */
export function roadLines() {
  const xs = [];
  const ys = [];
  for (let x = 210; x < WORLD.width; x += WORLD.blockGap) xs.push(x);
  for (let y = 210; y < WORLD.height; y += WORLD.blockGap) ys.push(y);
  return { xs, ys };
}

function nearestRoad(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/** True when the point is on a road (within half the road width of a centre line). */
export function isOnRoad(x, y, lines) {
  const half = WORLD.roadWidth / 2;
  for (const line of lines.xs) if (Math.abs(x - line) <= half) return true;
  for (const line of lines.ys) if (Math.abs(y - line) <= half) return true;
  return false;
}

/** True when the point is on a road intersection. */
export function isIntersection(x, y, lines) {
  const half = WORLD.roadWidth / 2;
  let onX = false;
  let onY = false;
  for (const line of lines.xs) if (Math.abs(x - line) <= half) onX = true;
  for (const line of lines.ys) if (Math.abs(y - line) <= half) onY = true;
  return onX && onY;
}

/** Snap a point onto the nearest road centre line (used for spawning cars). */
export function snapToRoad(x, y, lines) {
  const rx = nearestRoad(x, lines.xs);
  const ry = nearestRoad(y, lines.ys);
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y, axis: 'v' };
  return { x, y: ry, axis: 'h' };
}

function makeBuilding(random, x, y, w, h) {
  return {
    x, y, w, h,
    color: randomPick(random, PALETTE.buildingRoof),
    floors: randomInt(random, 1, 4),
    windows: randomInt(random, 2, 5),
  };
}

function buildCity(random) {
  const lines = roadLines();
  const buildings = [];
  const parks = [];
  const plazas = [];
  const half = WORLD.roadWidth / 2;
  for (let bx = 0; bx < lines.xs.length - 1; bx += 1) {
    for (let by = 0; by < lines.ys.length - 1; by += 1) {
      const x0 = lines.xs[bx] + half + 14;
      const y0 = lines.ys[by] + half + 14;
      const x1 = lines.xs[bx + 1] - half - 14;
      const y1 = lines.ys[by + 1] - half - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      const roll = random();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w, h, trees: randomInt(random, 5, 9) });
        continue;
      }
      if (roll < 0.24) {
        plazas.push({ x: x0, y: y0, w, h });
        continue;
      }
      const split = random() < 0.5;
      if (split && w > 180) {
        const cut = x0 + w * (0.42 + random() * 0.16);
        buildings.push(makeBuilding(random, x0, y0, cut - x0 - 12, h));
        buildings.push(makeBuilding(random, cut + 12, y0, x1 - cut - 12, h));
      } else {
        buildings.push(makeBuilding(random, x0, y0, w, h));
      }
    }
  }
  return { lines, buildings, parks, plazas };
}

/** Named places the missions point at, all on roads or plazas. */
export function cityLandmarks(lines) {
  const at = (ix, iy) => ({ x: lines.xs[ix], y: lines.ys[iy] });
  return {
    garage: at(6, 2),
    docks: at(0, 6),
    motel: at(9, 1),
    hideout: at(1, 0),
    plaza: at(5, 3),
    market: at(8, 5),
    beach: at(9, 6),
  };
}

let nextCarId = 1;

/** A car entity. `driver` is 'player', 'ai', 'police' or 'parked'. */
export function makeCar(x, y, angle, color, driver, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    color,
    driver,
    kind: kind || 'sedan',
    hp: CAR.hp,
    axis: 'h',
    stuck: 0,
    siren: 0,
    smoke: 0,
  };
}

/** A pedestrian entity, wandering the sidewalks. */
export function makePed(random, x, y) {
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: 0,
    targetX: x,
    targetY: y,
    color: randomPick(random, PALETTE.pedColors),
    state: 'walk',
    panic: 0,
    retarget: 0,
  };
}

/** The whole mutable game state, fresh from a seed. */
export function createGameState(seed, random) {
  const city = buildCity(random);
  const landmarks = cityLandmarks(city.lines);
  const spawn = { x: city.lines.xs[4], y: city.lines.ys[3] };
  const state = {
    seed,
    time: 0,
    city,
    landmarks,
    player: {
      x: spawn.x, y: spawn.y, angle: -Math.PI / 2,
      vx: 0, vy: 0,
      hp: PLAYER.hp,
      money: PLAYER.startMoney,
      inCar: false,
      carId: null,
      punchCooldown: 0,
      shootCooldown: 0,
      ammo: PLAYER.startAmmo,
      punchAnim: 0,
      invulnerable: 0,
      moving: false,
      running: false,
    },
    cars: [],
    peds: [],
    particles: [],
    pickups: [],
    wanted: 0,
    wantedHeat: 0,
    wantedHiddenTimer: 0,
    bustTimer: 0,
    missionIndex: 0,
    mission: null,
    missionTimer: 0,
    missionBanner: null,
    missionBannerTimer: 0,
    message: null,
    messageTimer: 0,
    stats: {
      carsStolen: 0,
      missionsDone: 0,
      moneyEarned: 0,
      pedsBumped: 0,
      shotsFired: 0,
      arrestsDodged: 0,
    },
    camera: { x: spawn.x, y: spawn.y },
    screen: 'title',
    gameComplete: false,
    muted: false,
    events: EVENT_NONE,
  };
  return state;
}

/** Fill the streets with traffic cars and pedestrians around the hero. */
export function populateStreets(state, random) {
  const colors = PALETTE.carColors;
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const spot = randomRoadPoint(state, random, 500);
    const car = makeCar(spot.x, spot.y, spot.angle, randomPick(random, colors), 'ai', random() < 0.18 ? 'taxi' : 'sedan');
    car.speed = TRAFFIC.carSpeed * (0.8 + random() * 0.4);
    car.axis = spot.axis;
    state.cars.push(car);
  }
  for (let i = 0; i < 6; i += 1) {
    const spot = randomRoadPoint(state, random, 300);
    const car = makeCar(spot.x, spot.y, spot.angle, randomPick(random, colors), 'parked', random() < 0.25 ? 'sport' : 'sedan');
    state.cars.push(car);
  }
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const spot = randomSidewalkPoint(state, random);
    state.peds.push(makePed(random, spot.x, spot.y));
  }
}

export function randomRoadPoint(state, random, minFromHero) {
  const { lines } = state.city;
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = random() < 0.5;
    const line = vertical ? randomPick(random, lines.xs) : randomPick(random, lines.ys);
    const along = 140 + random() * (vertical ? WORLD.height - 280 : WORLD.width - 280);
    const x = vertical ? line + (random() < 0.5 ? -26 : 26) : along;
    const y = vertical ? along : line + (random() < 0.5 ? -26 : 26);
    if (distance(x, y, state.player.x, state.player.y) < minFromHero) continue;
    const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    return { x, y, angle, axis: vertical ? 'v' : 'h' };
  }
  return { x: lines.xs[5], y: lines.ys[2], angle: 0, axis: 'h' };
}

export function randomSidewalkPoint(state, random) {
  const { lines } = state.city;
  const vertical = random() < 0.5;
  const line = vertical ? randomPick(random, lines.xs) : randomPick(random, lines.ys);
  const along = 120 + random() * (vertical ? WORLD.height - 240 : WORLD.width - 240);
  const off = WORLD.roadWidth / 2 + 16 + random() * 10;
  const side = random() < 0.5 ? -off : off;
  return vertical ? { x: line + side, y: along } : { x: along, y: line + side };
}

/** Push a circle out of every building it overlaps; returns the corrected position. */
export function collideBuildings(state, x, y, radius) {
  let hit = false;
  for (const b of state.city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        y += dy * push;
      } else {
        x += radius;
      }
    }
  }
  return { x, y, hit };
}

/** Keep a point inside the city bounds. */
export function clampToWorld(x, y, margin) {
  return {
    x: clamp(x, margin, WORLD.width - margin),
    y: clamp(y, margin, WORLD.height - margin),
  };
}

/** The nearest car to a point, within `range`, or null. */
export function nearestCar(state, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    const d = distance(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** The car the player is currently driving, or null. */
export function playerCar(state) {
  if (!state.player.inCar) return null;
  for (const car of state.cars) if (car.id === state.player.carId) return car;
  return null;
}

/** Spawn a small burst of particles (sparks, smoke, cash). */
export function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.8,
      color,
      size: 2 + Math.random() * 4,
    });
  }
  if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
}
