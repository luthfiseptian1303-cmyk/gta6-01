// Missions and the story: five jobs in a row for Rico Vega, a driver new to Solmar
// Bay who owes the wrong people money. Each mission has an objective marker on the
// map and in the HUD, a timer where the story needs one, and a payout.
//
// The mission state machine: idle -> active (with stages) -> done | failed.
// Failing (death, busted, timer out) restarts the same mission, not the story.

import { MISSIONS } from './config.js';
import { distance } from './random.js';
import { makeCar, burst, playerCar } from './world.js';
import { setWanted } from './police.js';

/** Start (or restart) mission `index`. Returns the mission runtime object. */
export function startMission(state, index, random) {
  const def = MISSIONS[index];
  if (!def) return null;
  const mission = {
    index,
    def,
    stage: 0,
    target: null,
    targetCar: null,
    tailTime: 0,
    collected: 0,
    total: 0,
    state: 'active',
  };
  state.mission = mission;
  state.missionIndex = index;
  state.missionTimer = def.timeLimit || 0;
  state.pickups = [];
  const L = state.landmarks;
  if (def.id === 'hot-wheels') {
    mission.target = { x: L.garage.x, y: L.garage.y, label: 'Garage — Palm Row' };
  } else if (def.id === 'package-run') {
    mission.target = { x: L.docks.x, y: L.docks.y, label: 'Pick up the package — Docks' };
  } else if (def.id === 'tail-job') {
    const car = makeCar(L.plaza.x + 300, L.plaza.y, 0, '#2f2f38', 'target', 'sedan');
    car.speed = 150;
    state.cars.push(car);
    mission.targetCar = car;
    mission.target = { x: car.x, y: car.y, label: 'Tail the courier' };
  } else if (def.id === 'heat-wave') {
    setWanted(state, 3);
    mission.target = { x: state.player.x, y: state.player.y, label: 'Lose the heat' };
  } else if (def.id === 'big-score') {
    const spots = [L.market, L.beach, L.motel];
    mission.total = spots.length;
    for (const spot of spots) {
      state.pickups.push({ x: spot.x, y: spot.y, kind: 'cash', taken: false });
    }
    mission.target = { x: spots[0].x, y: spots[0].y, label: 'Cash bag 1 of 3' };
  }
  showBanner(state, def.title, def.brief);
  return mission;
}

function showBanner(state, title, text) {
  state.missionBanner = { title, text };
  state.missionBannerTimer = 4.5;
}

/** Pay out a finished mission and move the story on. */
function completeMission(state) {
  const mission = state.mission;
  const reward = mission.def.reward;
  state.player.money += reward;
  state.stats.moneyEarned += reward;
  state.stats.missionsDone += 1;
  mission.state = 'done';
  showBanner(state, 'Job done — $' + reward, mission.def.title + ' complete. The city is talking about Rico Vega.');
  state.missionIndex += 1;
  if (state.missionIndex >= MISSIONS.length) {
    state.gameComplete = true;
  }
  burst(state, state.player.x, state.player.y, '#f2c94c', 24, 260);
}

/** Fail the current mission; the story lets Rico try again. */
export function failMission(state, reason) {
  const mission = state.mission;
  if (!mission || mission.state !== 'active') return;
  mission.state = 'failed';
  showBanner(state, 'Job failed', reason + ' — try the job again.');
  if (mission.targetCar) {
    mission.targetCar.driver = 'ai';
    mission.targetCar = null;
  }
  state.pickups = state.pickups.filter((p) => p.kind !== 'cash');
  setWanted(state, 0);
}

/** Advance the active mission one step. Returns EVENT flags for the main loop. */
export function updateMission(state, dt, random) {
  const mission = state.mission;
  if (!mission || mission.state !== 'active') return 0;
  const p = state.player;
  if (state.missionTimer > 0) {
    state.missionTimer -= dt;
    if (state.missionTimer <= 0) {
      failMission(state, 'Out of time');
      return 8; // EVENT_MISSION_FAILED
    }
  }
  const L = state.landmarks;

  if (mission.def.id === 'hot-wheels') {
    if (mission.stage === 0) {
      if (p.inCar) {
        mission.stage = 1;
        mission.target = { x: L.garage.x, y: L.garage.y, label: 'Take it to the garage — Palm Row' };
        state.message = 'Good wheels. Now get it to the garage.';
        state.messageTimer = 3;
      }
    } else if (distance(p.x, p.y, L.garage.x, L.garage.y) < 110) {
      completeMission(state);
      return 4;
    }
  } else if (mission.def.id === 'package-run') {
    if (mission.stage === 0) {
      if (distance(p.x, p.y, L.docks.x, L.docks.y) < 110) {
        mission.stage = 1;
        mission.target = { x: L.motel.x, y: L.motel.y, label: 'Deliver to the Sunset Motel' };
        state.message = 'Package secured. Move — the clock is running.';
        state.messageTimer = 3;
      }
    } else if (distance(p.x, p.y, L.motel.x, L.motel.y) < 110) {
      completeMission(state);
      return 4;
    }
  } else if (mission.def.id === 'tail-job') {
    const target = mission.targetCar;
    if (!target || target.hp <= 0) {
      completeMission(state);
      return 4;
    }
    mission.target = { x: target.x, y: target.y, label: 'Tail the courier' };
    const d = distance(p.x, p.y, target.x, target.y);
    if (d < 280) {
      mission.tailTime += dt;
      if (mission.tailTime > 6) {
        // The courier panics and floors it; ramming him to a stop ends the job.
        target.speed = 320;
        mission.stage = 1;
        mission.target.label = 'Ram the courier to a stop!';
        state.message = 'He made you! Ram him off the road!';
        state.messageTimer = 3;
      }
    } else {
      mission.tailTime = Math.max(0, mission.tailTime - dt * 0.5);
    }
    if (mission.stage === 1) {
      // The courier's car takes damage from collisions with the hero's car.
      const mine = playerCar(state);
      if (mine && distance(mine.x, mine.y, target.x, target.y) < 58) {
        target.hp -= 30 * dt;
        target.speed = Math.max(60, target.speed - 120 * dt);
        burst(state, target.x, target.y, '#ffd166', 3, 140);
        if (target.hp <= 0) {
          target.speed = 0;
          completeMission(state);
          return 4;
        }
      }
      if (d > 900) {
        failMission(state, 'You lost the courier');
        return 8;
      }
    }
  } else if (mission.def.id === 'heat-wave') {
    if (state.wanted === 0) {
      completeMission(state);
      return 4;
    }
    mission.target = { x: p.x, y: p.y, label: 'Lose the heat — ' + state.wanted + ' stars' };
  } else if (mission.def.id === 'big-score') {
    for (const pickup of state.pickups) {
      if (pickup.kind === 'cash' && !pickup.taken && distance(p.x, p.y, pickup.x, pickup.y) < 46) {
        pickup.taken = true;
        mission.collected += 1;
        state.player.money += 100;
        burst(state, pickup.x, pickup.y, '#f2c94c', 16, 220);
        state.message = `Cash bag ${mission.collected} of ${mission.total} — $100 pocketed.`;
        state.messageTimer = 2.5;
        const next = state.pickups.find((q) => q.kind === 'cash' && !q.taken);
        if (next) {
          mission.target = { x: next.x, y: next.y, label: `Cash bag ${mission.collected + 1} of ${mission.total}` };
        } else {
          mission.target = { x: L.hideout.x, y: L.hideout.y, label: 'Back to the hideout!' };
        }
      }
    }
    if (mission.collected >= mission.total && distance(p.x, p.y, L.hideout.x, L.hideout.y) < 110) {
      completeMission(state);
      return 4;
    }
  }
  return 0;
}

/** The courier's getaway driving: follow the road grid in a loop. */
export function updateTargetCar(state, dt, random) {
  const mission = state.mission;
  if (!mission || !mission.targetCar) return;
  const car = mission.targetCar;
  if (car.hp <= 0) return;
  const { lines } = state.city;
  // Drive straight; at an intersection, turn at random like traffic does.
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const half = 60;
  let onX = false;
  let onY = false;
  for (const line of lines.xs) if (Math.abs(car.x - line) <= half) onX = true;
  for (const line of lines.ys) if (Math.abs(car.y - line) <= half) onY = true;
  if (onX && onY && random() < 0.02) {
    car.angle += random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  car.x = Math.max(60, Math.min(4140, car.x));
  car.y = Math.max(60, Math.min(2940, car.y));
}

/** One line describing the current objective, for the HUD. */
export function missionObjectiveText(state) {
  const mission = state.mission;
  if (!mission) return 'No job right now.';
  if (mission.state === 'done') return 'Job done.';
  if (mission.state === 'failed') return 'Job failed — press R to retry.';
  const t = mission.target;
  return t ? t.label : mission.def.title;
}

/** Distance in metres (1 px ≈ 0.5 m) to the current objective. */
export function missionDistance(state) {
  const mission = state.mission;
  if (!mission || !mission.target) return 0;
  return Math.round(distance(state.player.x, state.player.y, mission.target.x, mission.target.y) / 2);
}
