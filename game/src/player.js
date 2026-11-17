// The hero on foot and behind the wheel: walking, running, punching and shooting,
// stealing a car, driving it with arcade physics, and getting out again.
//
// Driving is deliberately simple and forgiving: the car accelerates toward its top
// speed, steering scales with speed, and buildings push the car out instead of
// stopping it dead, so a chase never ends on a wall.

import { PLAYER, CAR, WORLD, WANTED } from './config.js';
import { clamp, distance, angleDelta } from './random.js';
import { collideBuildings, clampToWorld, nearestCar, playerCar, burst } from './world.js';
import { addWanted } from './police.js';

/** Move the hero on foot. `move` is {x, y} in [-1, 1]; `run` is the Shift key. */
export function updateOnFoot(state, move, run, dt) {
  const p = state.player;
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(move.x, move.y);
  p.moving = len > 0.05;
  p.running = p.moving && run;
  if (p.moving) {
    const nx = move.x / Math.max(1, len);
    const ny = move.y / Math.max(1, len);
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
    p.angle = Math.atan2(ny, nx);
  }
  const fixed = collideBuildings(state, p.x, p.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  const clamped = clampToWorld(p.x, p.y, PLAYER.radius + 4);
  p.x = clamped.x;
  p.y = clamped.y;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
}

/** Drive the player's car. `gas` in [-1, 1] (forward/back), `steer` in [-1, 1]. */
export function updateDriving(state, gas, steer, dt) {
  const car = playerCar(state);
  if (!car) return;
  const p = state.player;
  if (gas > 0) car.speed += CAR.accel * gas * dt;
  else if (gas < 0) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * gas * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerAmount = steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 160, 0, 1);
  car.angle += steerAmount * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(state, nx, ny, CAR.width * 0.7);
  if (fixed.hit) {
    car.speed *= 0.55;
    burst(state, nx, ny, '#e8e8e8', 4, 120);
  }
  car.x = fixed.x;
  car.y = fixed.y;
  const clamped = clampToWorld(car.x, car.y, CAR.length * 0.6);
  car.x = clamped.x;
  car.y = clamped.y;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (Math.abs(car.speed) > 300 && Math.abs(steer) > 0.6) {
    state.particles.push({
      x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20,
      vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#cfcfcf', size: 5,
    });
  }
  bumpPedestriansWithCar(state, car, dt);
}

/** A speeding car knocks pedestrians down (and the law notices). */
function bumpPedestriansWithCar(state, car, dt) {
  if (Math.abs(car.speed) < 120) return;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (distance(car.x, car.y, ped.x, ped.y) < 34) {
      ped.state = 'down';
      ped.panic = 3;
      ped.downTimer = 2.5;
      state.stats.pedsBumped += 1;
      burst(state, ped.x, ped.y, '#ff5a4e', 8, 160);
      addWanted(state, WANTED.hitPed, 'Hit a pedestrian');
      car.speed *= 0.85;
    }
  }
}

/** Try to get into the nearest car (E). Returns a message for the HUD, or null. */
export function tryEnterCar(state) {
  const p = state.player;
  if (p.inCar) return exitCar(state);
  const car = nearestCar(state, p.x, p.y, CAR.stealRange);
  if (!car) return 'No car close by — walk up to one and press E.';
  if (car.driver === 'police') return 'That car belongs to the police.';
  const wasParked = car.driver === 'parked';
  car.driver = 'player';
  p.inCar = true;
  p.carId = car.id;
  p.x = car.x;
  p.y = car.y;
  state.stats.carsStolen += 1;
  addWanted(state, WANTED.stealCar, 'Car stolen in broad daylight');
  if (wasParked) {
    return car.kind === 'sport' ? 'Nice ride — but the owner called it in. The PD is on its way.' : 'Engine on. Someone reported the theft — drive!';
  }
  return 'Car jacked! The Solmar PD has been tipped off.';
}

/** Get out of the car, stepping to its side. */
export function exitCar(state) {
  const p = state.player;
  const car = playerCar(state);
  if (!car) {
    p.inCar = false;
    p.carId = null;
    return null;
  }
  car.driver = 'parked';
  car.speed = 0;
  p.inCar = false;
  p.carId = null;
  const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
  const fixed = collideBuildings(state, side.x, side.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  return 'Out of the car.';
}

/** Punch the nearest person in front of the hero (Space or left click). */
export function punch(state) {
  const p = state.player;
  if (p.inCar || p.punchCooldown > 0) return false;
  p.punchCooldown = PLAYER.punchCooldown;
  p.punchAnim = 0.22;
  const reach = PLAYER.punchRange;
  let victim = null;
  let bestD = reach;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = distance(p.x, p.y, ped.x, ped.y);
    if (d >= bestD) continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    if (Math.abs(angleDelta(p.angle, ang)) > 1.2) continue;
    bestD = d;
    victim = ped;
  }
  if (!victim) return true;
  victim.state = 'down';
  victim.downTimer = 2.2;
  victim.panic = 3;
  victim.x += Math.cos(p.angle) * 18;
  victim.y += Math.sin(p.angle) * 18;
  burst(state, victim.x, victim.y, '#ffd166', 8, 180);
  addWanted(state, WANTED.punchSeen, 'Assault in public');
  return true;
}

/** Fire the pistol at the nearest target in the hero's facing direction (F / right click). */
export function shoot(state) {
  const p = state.player;
  if (p.inCar || p.shootCooldown > 0) return false;
  if (p.ammo <= 0) {
    state.message = 'Out of ammo — find an ammo pickup.';
    state.messageTimer = 2;
    return false;
  }
  p.shootCooldown = PLAYER.shootCooldown;
  p.ammo -= 1;
  p.punchAnim = 0.12;
  state.stats.shotsFired += 1;
  const range = PLAYER.shootRange;
  let target = null;
  let bestScore = Infinity;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = distance(p.x, p.y, ped.x, ped.y);
    if (d > range) continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    const off = Math.abs(angleDelta(p.angle, ang));
    const score = d + off * 400;
    if (score < bestScore) {
      bestScore = score;
      target = ped;
    }
  }
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    const d = distance(p.x, p.y, car.x, car.y);
    if (d > range) continue;
    const ang = Math.atan2(car.y - p.y, car.x - p.x);
    const off = Math.abs(angleDelta(p.angle, ang));
    const score = d + off * 400;
    if (score < bestScore) {
      bestScore = score;
      target = car;
    }
  }
  if (target) {
    burst(state, target.x, target.y, '#ff5a4e', 10, 200);
    if (target.state !== undefined) {
      target.state = 'down';
      target.downTimer = 3;
      target.panic = 3;
    } else {
      target.hp -= PLAYER.shootDamage;
      target.speed = Math.max(0, target.speed - 80);
    }
    addWanted(state, WANTED.shootSeen, 'Shots fired!');
  }
  return true;
}

/** Damage the hero; returns true when the hero dies. */
export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0) return false;
  p.hp -= amount;
  p.invulnerable = 0.5;
  if (p.hp <= 0) {
    p.hp = 0;
    return true;
  }
  return false;
}

/** Heal the hero slowly while the heat is off. */
export function regenPlayer(state, dt) {
  const p = state.player;
  if (state.wanted === 0 && p.hp > 0 && p.hp < PLAYER.hp) {
    p.hp = Math.min(PLAYER.hp, p.hp + 4 * dt);
  }
}
