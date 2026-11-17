// The screenshot scenes behind ?shot=cover|drive|chase|mission. Each one stages the
// real game state directly — a car on a road, police in pursuit, a mission in
// progress — then the renderer paints exactly what a player would see, so the
// frame is a true render of the game's own code and the same seed always gives the
// same frame.

import { CAR, PALETTE } from './config.js';
import { makeCar, makePed, playerCar } from './world.js';
import { startMission } from './missions.js';
import { setWanted } from './police.js';

const SCREEN_PLAY = 'play';

/** Put the hero in a car on a road, facing along it, with traffic around. */
function stageDriving(state, random, opts) {
  const { lines } = state.city;
  const roadX = lines.xs[5];
  const roadY = lines.ys[3];
  const car = makeCar(roadX, roadY - 26, 0, opts.carColor || '#d94f3d', 'player', opts.kind || 'sport');
  car.speed = opts.speed || 320;
  state.cars.push(car);
  state.player.inCar = true;
  state.player.carId = car.id;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = 0;
  state.camera.x = car.x + 60;
  state.camera.y = car.y;
  // Traffic ahead and behind on the same road, never on the hero's exact spot.
  const colors = PALETTE.carColors;
  const offsets = [-520, -260, 260, 520, 780];
  for (let i = 0; i < 5; i += 1) {
    const ahead = makeCar(roadX + (i % 2 === 0 ? 26 : -26), roadY - 26 + offsets[i], i % 2 === 0 ? 0 : Math.PI, colors[(i + 2) % colors.length], 'ai', 'sedan');
    ahead.speed = 150 + i * 12;
    state.cars.push(ahead);
  }
  // Pedestrians on the sidewalk.
  for (let i = 0; i < 6; i += 1) {
    state.peds.push(makePed(random, roadX + 120 + i * 40, roadY + 90 + (i % 3) * 26));
  }
  return car;
}

function stagePolice(state, count, distanceBehind) {
  const mine = playerCar(state);
  if (!mine) return;
  for (let i = 0; i < count; i += 1) {
    const lane = i % 2 === 0 ? -26 : 26;
    const cop = makeCar(mine.x - distanceBehind - i * 130, mine.y + lane, 0, '#f2f2f2', 'police', 'police');
    cop.speed = 380 + i * 20;
    cop.siren = i * 0.7;
    state.cars.push(cop);
  }
}

/**
 * Set the game state to the named scene (cover, drive, chase or mission) and
 * return the screen to draw over it.
 */
export function stageShot(name, state, random) {
  state.screen = 'play';
  state.time = 12;
  if (name === 'drive') {
    stageDriving(state, random, { carColor: '#3d7bd9', kind: 'sport', speed: 420 });
    startMission(state, 1, random);
    state.mission.target = { x: state.landmarks.motel.x, y: state.landmarks.motel.y, label: 'Deliver to the Sunset Motel' };
    state.mission.stage = 1;
    state.missionTimer = 64;
  } else if (name === 'chase') {
    stageDriving(state, random, { carColor: '#e8a13d', kind: 'sport', speed: 480 });
    startMission(state, 3, random);
    setWanted(state, 4);
    stagePolice(state, 4, 220);
    state.mission.target = { x: state.player.x, y: state.player.y, label: 'Lose the heat — 4 stars' };
    state.missionTimer = 41;
    state.message = 'The whole Solmar PD is on you — lose them!';
    state.messageTimer = 10;
  } else if (name === 'mission') {
    // On foot, grabbing a cash bag, with the hideout ahead and one star of heat.
    const L = state.landmarks;
    state.player.x = L.market.x + 40;
    state.player.y = L.market.y + 30;
    state.player.angle = Math.PI / 4;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    startMission(state, 4, random);
    state.pickups = [
      { x: L.market.x + 40, y: L.market.y + 30, kind: 'cash', taken: false },
      { x: L.beach.x, y: L.beach.y, kind: 'cash', taken: false },
      { x: L.motel.x, y: L.motel.y, kind: 'cash', taken: true },
    ];
    state.mission.collected = 1;
    state.mission.target = { x: L.beach.x, y: L.beach.y, label: 'Cash bag 2 of 3' };
    setWanted(state, 1);
    const cop = makeCar(L.market.x - 420, L.market.y - 26, 0, '#f2f2f2', 'police', 'police');
    cop.speed = 300;
    cop.siren = 0.4;
    state.cars.push(cop);
    state.player.money = 1250;
    // A parked car nearby, ready to steal.
    const parked = makeCar(L.market.x - 90, L.market.y - 26, 0, '#4da66e', 'parked', 'sedan');
    state.cars.push(parked);
    for (let i = 0; i < 5; i += 1) {
      state.peds.push(makePed(random, L.market.x + 120 + i * 36, L.market.y + 80));
    }
  } else {
    // Cover: the hero in a red sport car at a busy intersection, two stars of
    // heat, two cruisers closing in, and the first mission's objective ahead.
    const car = stageDriving(state, random, { carColor: '#d94f3d', kind: 'sport', speed: 260 });
    car.x = state.city.lines.xs[5];
    car.y = state.city.lines.ys[3] - 26;
    state.player.x = car.x;
    state.player.y = car.y;
    state.camera.x = car.x + 40;
    state.camera.y = car.y;
    setWanted(state, 2);
    stagePolice(state, 2, 260);
    startMission(state, 0, random);
    state.mission.stage = 1;
    state.mission.target = { x: state.landmarks.garage.x, y: state.landmarks.garage.y, label: 'Take it to the garage — Palm Row' };
    state.player.money = 450;
    state.message = 'Hot Wheels — take the car to the garage on Palm Row.';
    state.messageTimer = 10;
  }
  return { screen: SCREEN_PLAY };
}
