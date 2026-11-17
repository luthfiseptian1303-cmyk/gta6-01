// The wanted system and the Solmar Police Department.
//
// Crimes raise the wanted level (1 to 5 stars). The higher the level, the more
// police cars spawn and the faster they are. Police chase the hero, ram his car,
// and try to bust him on foot: stand too close to a police car while on foot for
// too long and the run ends in handcuffs. Break line of sight and stay hidden and
// the stars fade one at a time.

import { WANTED, WORLD, PALETTE } from './config.js';
import { clamp, distance, angleDelta, randomPick } from './random.js';
import { makeCar, randomRoadPoint, burst, playerCar } from './world.js';
import { hurtPlayer } from './player.js';
import { panicNearbyPeds } from './traffic.js';

/** Raise the wanted level by `stars`, capped at 5, and scare the street. */
export function addWanted(state, stars, reason) {
  if (stars <= 0) return;
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  state.wantedHeat = 1;
  state.wantedHiddenTimer = 0;
  if (state.wanted > before && reason) {
    state.message = reason + ` — wanted level ${state.wanted}.`;
    state.messageTimer = 3;
  }
  panicNearbyPeds(state, state.player.x, state.player.y, 320);
}

/** Set the wanted level directly (missions use this to script the heat). */
export function setWanted(state, stars) {
  state.wanted = clamp(stars, 0, WANTED.max);
  state.wantedHeat = stars > 0 ? 1 : 0;
  state.wantedHiddenTimer = 0;
}

function policeCars(state) {
  const out = [];
  for (const car of state.cars) if (car.driver === 'police') out.push(car);
  return out;
}

/** Spawn police to match the wanted level, chase the hero, and fade the heat. */
export function updatePolice(state, dt, random) {
  const p = state.player;
  const police = policeCars(state);
  const wantCount = Math.min(WANTED.maxPolice, state.wanted * WANTED.policePerStar);
  if (police.length < wantCount) {
    const spot = randomRoadPoint(state, random, 650);
    const car = makeCar(spot.x, spot.y, spot.angle, '#f2f2f2', 'police', 'police');
    car.speed = 200;
    state.cars.push(car);
  } else if (police.length > wantCount) {
    // Too many cruisers: the farthest one gives up and drives off.
    let farthest = police[0];
    let farD = 0;
    for (const car of police) {
      const d = distance(car.x, car.y, p.x, p.y);
      if (d > farD) {
        farD = d;
        farthest = car;
      }
    }
    farthest.driver = 'ai';
    farthest.color = randomPick(random, PALETTE.carColors);
  }

  let nearestPolice = Infinity;
  for (const car of policeCars(state)) {
    const d = distance(car.x, car.y, p.x, p.y);
    if (d < nearestPolice) nearestPolice = d;
    chaseHero(state, car, dt);
    ramPlayerCar(state, car, dt);
  }

  // Busted: on foot, too close to a cruiser for too long.
  if (state.wanted > 0 && !p.inCar && nearestPolice < WANTED.bustDistance) {
    state.bustTimer += dt;
    if (state.bustTimer > WANTED.bustTime) {
      state.events |= 2; // EVENT_BUSTED
    }
  } else {
    state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
  }

  // Heat fades when no cruiser can see the hero for a while.
  if (state.wanted > 0) {
    if (nearestPolice > 520) {
      state.wantedHiddenTimer += dt;
      if (state.wantedHiddenTimer > WANTED.decayDelay) {
        state.wantedHiddenTimer = 0;
        state.wanted -= 1;
        if (state.wanted === 0) {
          state.message = 'You lost them. The heat is off.';
          state.messageTimer = 3;
          state.stats.arrestsDodged += 1;
        }
      }
    } else {
      state.wantedHiddenTimer = 0;
    }
  }
}

/** Steer a police car toward the hero, faster at higher wanted levels. */
function chaseHero(state, car, dt) {
  const p = state.player;
  const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
  const diff = angleDelta(car.angle, targetAngle);
  const topSpeed = 300 + state.wanted * 55;
  car.speed += clamp(topSpeed - car.speed, -320 * dt, 260 * dt);
  car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.siren += dt;
  const clamped = {
    x: clamp(car.x, 30, WORLD.width - 30),
    y: clamp(car.y, 30, WORLD.height - 30),
  };
  car.x = clamped.x;
  car.y = clamped.y;
}

/** A police car ramming the hero's car damages it and slows the hero down. */
function ramPlayerCar(state, car, dt) {
  const p = state.player;
  if (!p.inCar) return;
  const mine = playerCar(state);
  if (!mine) return;
  const d = distance(car.x, car.y, mine.x, mine.y);
  if (d < 52 && Math.abs(car.speed) > 60) {
    car.speed *= 0.5;
    mine.speed *= 0.7;
    mine.hp -= 6;
    burst(state, (car.x + mine.x) / 2, (car.y + mine.y) / 2, '#ffd166', 8, 200);
    if (mine.hp <= 0) {
      mine.hp = 0;
      mine.speed = 0;
      state.message = 'Your car is wrecked! Bail out!';
      state.messageTimer = 3;
    }
  }
  void dt;
}

/** Police cars also hurt the hero on foot when they clip him. */
export function policeTouchPlayer(state) {
  const p = state.player;
  if (p.inCar || p.invulnerable > 0) return false;
  for (const car of policeCars(state)) {
    if (distance(car.x, car.y, p.x, p.y) < 40) {
      return hurtPlayer(state, 12);
    }
  }
  return false;
}
