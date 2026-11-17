// Traffic and pedestrians: AI cars that follow the road grid and turn at
// intersections, and pedestrians who stroll the sidewalks and panic when a crime
// happens near them.
//
// Traffic cars keep to a lane (offset from the road centre), slow down for the car
// ahead, and pick a new direction at intersections. Pedestrians pick a sidewalk
// target, walk to it, then pick another.

import { WORLD, TRAFFIC } from './config.js';
import { clamp, distance, angleDelta } from './random.js';
import { isIntersection, randomRoadPoint, randomSidewalkPoint, collideBuildings, clampToWorld, makeCar, makePed } from './world.js';

/** Keep the streets full: respawn traffic that wandered too far from the hero. */
export function updateTraffic(state, dt, random) {
  updateAICars(state, dt, random);
  updatePeds(state, dt, random);
  respawnFarTraffic(state, random);
}

function updateAICars(state, dt, random) {
  const { lines } = state.city;
  for (const car of state.cars) {
    if (car.driver === 'player' || car.driver === 'police') continue;
    if (car.driver === 'parked') continue;
    const target = TRAFFIC.carSpeed * (0.85 + (car.id % 5) * 0.05);
    // Slow down for the car ahead on the same road.
    let ahead = null;
    let aheadD = 130;
    for (const other of state.cars) {
      if (other === car || other.driver === 'parked') continue;
      const d = distance(car.x, car.y, other.x, other.y);
      if (d < aheadD) {
        const ang = Math.atan2(other.y - car.y, other.x - car.x);
        if (Math.abs(angleDelta(car.angle, ang)) < 0.6) {
          aheadD = d;
          ahead = other;
        }
      }
    }
    const goal = ahead ? Math.max(0, target * (aheadD / 130 - 0.25)) : target;
    car.speed += clamp(goal - car.speed, -260 * dt, 180 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    if (isIntersection(car.x, car.y, lines) && random() < 0.012) {
      const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
      const turn = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.angle += turn;
      // Snap onto the new road's lane so the car does not drift off-road.
      if (vertical) car.y = nearestLine(car.y, lines.ys) + (random() < 0.5 ? -26 : 26);
      else car.x = nearestLine(car.x, lines.xs) + (random() < 0.5 ? -26 : 26);
    }
    // Nudge a car that drifted off its road back toward the nearest centre line.
    const onRoad = Math.abs(car.x - nearestLine(car.x, lines.xs)) < WORLD.roadWidth / 2
      || Math.abs(car.y - nearestLine(car.y, lines.ys)) < WORLD.roadWidth / 2;
    if (!onRoad) {
      const toX = nearestLine(car.x, lines.xs) - car.x;
      const toY = nearestLine(car.y, lines.ys) - car.y;
      if (Math.abs(toX) < Math.abs(toY)) car.x += Math.sign(toX) * 60 * dt;
      else car.y += Math.sign(toY) * 60 * dt;
    }
    const fixed = collideBuildings(state, car.x, car.y, 20);
    car.x = fixed.x;
    car.y = fixed.y;
    const clamped = clampToWorld(car.x, car.y, 40);
    car.x = clamped.x;
    car.y = clamped.y;
  }
}

function nearestLine(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

function updatePeds(state, dt, random) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) ped.state = 'walk';
      continue;
    }
    ped.retarget -= dt;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12 || ped.retarget <= 0) {
      const spot = randomSidewalkPoint(state, random);
      ped.targetX = spot.x;
      ped.targetY = spot.y;
      ped.retarget = 6 + random() * 8;
      continue;
    }
    const speed = ped.panic > 0 ? TRAFFIC.pedSpeed * 2.4 : TRAFFIC.pedSpeed;
    ped.panic = Math.max(0, ped.panic - dt);
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
    const fixed = collideBuildings(state, ped.x, ped.y, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    // A panicking pedestrian runs away from the hero.
    if (ped.panic > 0 && distance(ped.x, ped.y, p.x, p.y) < 120) {
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.targetX = ped.x + Math.cos(away) * 300;
      ped.targetY = ped.y + Math.sin(away) * 300;
    }
  }
}

/** Make every nearby pedestrian panic (called when a crime happens). */
export function panicNearbyPeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (distance(ped.x, ped.y, x, y) < radius) ped.panic = 3;
  }
}

function respawnFarTraffic(state, random) {
  const p = state.player;
  let aiCars = 0;
  for (const car of state.cars) if (car.driver === 'ai') aiCars += 1;
  for (const car of state.cars) {
    if (car.driver !== 'ai') continue;
    if (distance(car.x, car.y, p.x, p.y) > 1600) {
      const spot = randomRoadPoint(state, random, 600);
      car.x = spot.x;
      car.y = spot.y;
      car.angle = spot.angle;
      car.axis = spot.axis;
      car.speed = TRAFFIC.carSpeed;
    }
  }
  if (aiCars < TRAFFIC.cars) {
    const spot = randomRoadPoint(state, random, 600);
    const car = makeCar(spot.x, spot.y, spot.angle, '#d94f3d', 'ai', 'sedan');
    car.speed = TRAFFIC.carSpeed;
    state.cars.push(car);
  }
  for (const ped of state.peds) {
    if (distance(ped.x, ped.y, p.x, p.y) > 1500) {
      const spot = randomSidewalkPoint(state, random);
      ped.x = spot.x;
      ped.y = spot.y;
      ped.targetX = spot.x;
      ped.targetY = spot.y;
    }
  }
}
