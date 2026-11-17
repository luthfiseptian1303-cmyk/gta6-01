// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer and
// HUD paint what is there. The game moves between title, play, paused, wasted,
// busted and complete screens.
//
// ?seed=N fixes the city. ?shot=cover|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?selftest=1 runs a scripted playthrough
// (walk, steal a car, drive, wanted, police, mission) and writes the result into
// #testout, so a headless browser can prove the systems work.

import { STEP, SAVE_KEY, BEST_KEY, MISSIONS, GAME_NAME } from './config.js';
import { createRandom } from './random.js';
import { createGameState, populateStreets, playerCar } from './world.js';
import { updateOnFoot, updateDriving, tryEnterCar, punch, shoot, hurtPlayer, regenPlayer } from './player.js';
import { updateTraffic } from './traffic.js';
import { updatePolice, policeTouchPlayer } from './police.js';
import { startMission, updateMission, updateTargetCar, failMission } from './missions.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED, SCREEN_COMPLETE } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_SHOOT, ACTION_MUTE, ACTION_RETRY, createInput } from './input.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const testout = document.getElementById('testout');
const random = createRandom(seed);
const state = createGameState(seed, random);
populateStreets(state, random);
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
const input = createInput(canvas);

window.addEventListener('error', (event) => {
  const err = document.getElementById('err');
  if (err) err.textContent = 'ERROR: ' + (event.message || event.error);
});

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.player.money,
      missionIndex: state.missionIndex,
      missionsDone: state.stats.missionsDone,
      moneyEarned: state.stats.moneyEarned,
      carsStolen: state.stats.carsStolen,
      x: state.player.x,
      y: state.player.y,
    }));
  } catch {
    // Storage can be off (private windows): the game still plays.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best score then lasts this visit only.
  }
}

function applySave(save) {
  state.player.money = save.money || 150;
  state.stats.moneyEarned = save.moneyEarned || 0;
  state.stats.carsStolen = save.carsStolen || 0;
  state.stats.missionsDone = save.missionsDone || 0;
  state.missionIndex = Math.min(save.missionIndex || 0, MISSIONS.length - 1);
  if (save.x && save.y) {
    state.player.x = save.x;
    state.player.y = save.y;
  }
}

/** One fixed simulation step: player, traffic, police, mission, particles. */
export function stepGame(dt) {
  state.time += dt;
  const p = state.player;
  // Aim on foot with the mouse: the hero faces the cursor.
  if (!p.inCar) {
    const mouse = input.mouse();
    const rect = canvas.getBoundingClientRect();
    const sx = (mouse.x - rect.left) / rect.width * 1280;
    const sy = (mouse.y - rect.top) / rect.height * 720;
    const wx = state.camera.x - 640 + sx;
    const wy = state.camera.y - 360 + sy;
    if (Math.hypot(wx - p.x, wy - p.y) > 60) {
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
  }
  if (p.inCar) {
    const drive = input.drive();
    updateDriving(state, drive.gas, drive.steer, dt);
  } else {
    updateOnFoot(state, input.move(), input.running(), dt);
  }
  updateTraffic(state, dt, random);
  updatePolice(state, dt, random);
  updateTargetCar(state, dt, random);
  const missionEvents = updateMission(state, dt, random);
  if (missionEvents & 4) {
    audio.missionDone();
    writeSave();
  } else if (missionEvents & 8) {
    audio.missionFailed();
  }
  if (policeTouchPlayer(state)) {
    // Hurt on foot by a cruiser; death is handled below.
  }
  if (p.hp <= 0) {
    state.events |= 1;
  }
  regenPlayer(state, dt);
  // Particles.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  if (state.missionBannerTimer > 0) state.missionBannerTimer -= dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  // Camera follows the hero, clamped to the city.
  const targetX = Math.max(640, Math.min(4200 - 640, p.x));
  const targetY = Math.max(360, Math.min(3000 - 360, p.y));
  state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);
  // Audio follows the game.
  const car = playerCar(state);
  audio.engine(car ? car.speed : 0, !!car);
  audio.siren(state.wanted);
  return state.events;
}

function runShot(name) {
  const scene = stageShot(name, state, random);
  let painted = 0;
  function paint() {
    renderer.drawWorld(state);
    hud.drawHud(state);
    painted += 1;
    if (painted === 2) window.__shotReady = true;
    requestAnimationFrame(paint); // Keep repainting: a resize (or a metrics override) repaints too.
  }
  requestAnimationFrame(paint);
}

/** Scripted playthrough that proves every system works, run headless. */
function runSelftest() {
  const results = [];
  const check = (name, ok) => results.push((ok ? 'PASS' : 'FAIL') + ' ' + name);
  // 1. Walk on foot.
  const x0 = state.player.x;
  const y0 = state.player.y;
  input.press('KeyD');
  for (let i = 0; i < 60; i += 1) stepGame(STEP);
  input.release('KeyD');
  check('walk moves player', Math.abs(state.player.x - x0) > 50);
  // 2. Steal a parked car: teleport next to one, enter it.
  let parked = null;
  for (const car of state.cars) if (car.driver === 'parked') { parked = car; break; }
  check('parked car exists', !!parked);
  if (parked) {
    state.player.x = parked.x + 10;
    state.player.y = parked.y;
    const msg = tryEnterCar(state);
    check('enter car', state.player.inCar && msg !== null);
    check('stealing raises wanted', state.wanted >= 1);
    // 3. Drive.
    input.press('KeyW');
    const startX = parked.x;
    const startY = parked.y;
    for (let i = 0; i < 120; i += 1) stepGame(STEP);
    input.release('KeyW');
    const car = playerCar(state);
    check('drive accelerates', !!car && Math.abs(car.speed) > 100);
    check('drive moves car', !!car && Math.hypot(car.x - startX, car.y - startY) > 100);
    // 4. Police spawn at wanted >= 1.
    let policeCount = 0;
    for (const c of state.cars) if (c.driver === 'police') policeCount += 1;
    check('police spawn on wanted', policeCount >= 1);
    // 5. Punch on foot: exit, punch a nearby ped.
    tryEnterCar(state);
    check('exit car', !state.player.inCar);
    const ped = state.peds[0];
    state.player.x = ped.x - 30;
    state.player.y = ped.y;
    state.player.angle = 0;
    punch(state);
    check('punch knocks ped down', ped.state === 'down');
    // 6. Mission 1 completes by driving to the garage.
    startMission(state, 0, random);
    state.player.money = 150;
    const L = state.landmarks;
    // Stage 0 needs the hero in a car.
    const car2 = state.cars.find((c) => c.driver === 'parked');
    if (car2) {
      state.player.x = car2.x;
      state.player.y = car2.y;
      tryEnterCar(state);
    }
    for (let i = 0; i < 30; i += 1) stepGame(STEP);
    check('mission 1 stage advances in car', state.mission.stage === 1);
    state.player.x = L.garage.x;
    state.player.y = L.garage.y;
    const carNow = playerCar(state);
    if (carNow) { carNow.x = L.garage.x; carNow.y = L.garage.y; }
    for (let i = 0; i < 30; i += 1) stepGame(STEP);
    check('mission 1 completes at garage', state.mission.state === 'done');
    check('mission 1 pays out', state.player.money >= 150 + 300);
    // 7. Wanted decays when hidden (teleport far from police, wanted 1).
    state.wanted = 1;
    for (const c of state.cars) if (c.driver === 'police') { c.x = 100; c.y = 100; }
    state.player.x = 4000;
    state.player.y = 2800;
    const car3 = playerCar(state);
    if (car3) { car3.x = 4000; car3.y = 2800; }
    for (let i = 0; i < 60 * 20; i += 1) stepGame(STEP);
    check('wanted decays when hidden', state.wanted === 0);
    // 8. Shooting consumes ammo.
    const ammo0 = state.player.ammo;
    if (state.player.inCar) tryEnterCar(state);
    shoot(state);
    check('shoot consumes ammo', state.player.ammo === ammo0 - 1);
    const passed = results.filter((r) => r.startsWith('PASS')).length;
    const text = `SELFTEST ${passed}/${results.length}\n` + results.join('\n');
    if (testout) testout.textContent = text;
    document.title = passed === results.length ? 'SELFTEST PASS' : 'SELFTEST FAIL';
    window.__selftestDone = true;
  }
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  const save = readSave();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh || !save) {
      state.player.money = 150;
      state.missionIndex = 0;
      state.stats.missionsDone = 0;
      state.stats.moneyEarned = 0;
    } else {
      applySave(save);
    }
    startMission(state, state.missionIndex, random);
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Playing. Mission ' + (state.missionIndex + 1) + ' of ' + MISSIONS.length + '.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
        return;
      }
      if (actions & ACTION_ENTER_CAR) {
        const msg = tryEnterCar(state);
        if (msg) {
          state.message = msg;
          state.messageTimer = 3;
          audio.click();
        }
      }
      if (actions & ACTION_PUNCH) {
        if (punch(state)) audio.punch();
      }
      if (actions & ACTION_SHOOT) {
        if (shoot(state)) audio.gunshot();
      }
      if (actions & ACTION_RETRY && state.mission && state.mission.state === 'failed') {
        startMission(state, state.missionIndex, random);
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        // Respawn: fresh health, same mission, small penalty for a bust.
        state.player.hp = 100;
        state.player.x = state.landmarks.hideout.x;
        state.player.y = state.landmarks.hideout.y;
        state.player.inCar = false;
        state.player.carId = null;
        state.wanted = 0;
        state.bustTimer = 0;
        state.events = 0;
        if (screen === SCREEN_BUSTED) state.player.money = Math.max(0, state.player.money - 100);
        startMission(state, state.missionIndex, random);
        screen = SCREEN_PLAY;
        announce('Back on the street.');
      }
      return;
    }
    if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        state.gameComplete = false;
        announce('Free roam. The city is yours.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(STEP);
        accumulator -= STEP;
        if (state.events & 1) {
          screen = SCREEN_OVER;
          if (state.stats.moneyEarned > best) {
            best = state.stats.moneyEarned;
            saveBest(best);
          }
          announce('Wasted. Rico went down.');
          state.events = 0;
          break;
        }
        if (state.events & 2) {
          screen = SCREEN_BUSTED;
          announce('Busted by the Solmar PD.');
          state.events = 0;
          break;
        }
        if (state.gameComplete && screen === SCREEN_PLAY) {
          screen = SCREEN_COMPLETE;
          writeSave();
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    // Paint.
    if (screen === SCREEN_TITLE) {
      renderer.drawWorld(state);
      hud.drawTitle(state, best, !!save);
    } else {
      renderer.drawWorld(state);
      hud.drawHud(state);
      if (screen === SCREEN_PAUSED) hud.drawPaused();
      else if (screen === SCREEN_OVER) hud.drawOver(state);
      else if (screen === SCREEN_BUSTED) hud.drawBusted(state);
      else if (screen === SCREEN_COMPLETE) hud.drawComplete(state);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce(GAME_NAME + '. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (selftest) {
  // Run the scripted playthrough synchronously, then paint once.
  runSelftest();
  renderer.drawWorld(state);
  hud.drawHud(state);
} else if (shot) {
  runShot(shot);
} else {
  runGame();
}
