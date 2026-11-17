// Solmar Heat — an original open-world crime game in the spirit of GTA 6.
// Every tuning number, colour and mission reward lives here, so the rest of the
// game reads like a rulebook instead of a pile of magic numbers.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city is one big top-down map; the camera shows a 1280x720 window of it. */
export const WORLD = { width: 4200, height: 3000, roadWidth: 120, blockGap: 420 };

export const PLAYER = {
  radius: 16,
  walkSpeed: 230,
  runSpeed: 330,
  hp: 100,
  punchRange: 58,
  punchDamage: 34,
  punchCooldown: 0.38,
  shootRange: 460,
  shootDamage: 40,
  shootCooldown: 0.3,
  startAmmo: 24,
  startMoney: 150,
};

export const CAR = {
  length: 54,
  width: 28,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  grip: 3.2,
  stealRange: 78,
  hp: 100,
};

export const TRAFFIC = { cars: 14, peds: 26, carSpeed: 170, pedSpeed: 55 };

export const WANTED = {
  max: 5,
  decayDelay: 7,
  decayInterval: 9,
  stealCar: 1,
  punchSeen: 1,
  shootSeen: 2,
  hitPed: 2,
  killPed: 2,
  policePerStar: 2,
  maxPolice: 8,
  bustDistance: 64,
  bustTime: 1.4,
};

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: '1 — Hot Wheels',
    brief: 'Rico needs wheels. Steal any car on the street, then bring it to the garage on Palm Row.',
    reward: 300,
  },
  {
    id: 'package-run',
    title: '2 — Package Run',
    brief: 'Pick up the package at the docks, then deliver it to the Sunset Motel before the timer runs out.',
    reward: 500,
    timeLimit: 90,
  },
  {
    id: 'tail-job',
    title: '3 — Tail Job',
    brief: 'A courier is moving product across town. Stay close behind his sedan until he panics, then ram him to a stop.',
    reward: 700,
  },
  {
    id: 'heat-wave',
    title: '4 — Heat Wave',
    brief: 'The Solmar PD is all over you. Lose the heat: break line of sight and stay hidden until the stars fade.',
    reward: 900,
    timeLimit: 75,
  },
  {
    id: 'big-score',
    title: '5 — The Big Score',
    brief: 'Three cash bags are stashed around the city. Grab them all and get back to the hideout. No mistakes.',
    reward: 1500,
  },
];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  park: '#5f9e4e',
  sidewalk: '#b9b3a4',
  road: '#3a3d46',
  roadLine: '#e8d44d',
  curb: '#8f887a',
  buildingRoof: ['#c96f4a', '#4a7fb5', '#b5a04a', '#7a5fb5', '#4ab58a', '#b54a6e', '#8a6f4d', '#5a7a8a'],
  buildingEdge: '#2c2c34',
  water: '#3f8fb5',
  sand: '#e0c98f',
  player: '#f2b705',
  playerJacket: '#e5484d',
  police: '#1c2733',
  policeLight: '#ff3b30',
  policeLight2: '#2f7bff',
  carColors: ['#d94f3d', '#3d7bd9', '#e8e8e8', '#2f2f38', '#e8a13d', '#4da66e', '#8a4db5', '#c9c9c9'],
  pedColors: ['#e07a5f', '#81b29a', '#f2cc8f', '#6d6875', '#e5989b', '#a7c957'],
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f2f4f6',
  hudMuted: '#aab3c0',
  hudGold: '#f2c94c',
  hudRed: '#ff5a4e',
  hudGreen: '#58d68d',
  objective: '#ffcf3d',
  minimapBg: 'rgba(10, 14, 22, 0.78)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (money, mission progress, best score) is kept between visits. */
export const SAVE_KEY = 'solmar-heat.save.v1';
export const BEST_KEY = 'solmar-heat.best';

export const GAME_NAME = 'SOLMAR HEAT';
export const CITY_NAME = 'Solmar Bay';
export const HERO_NAME = 'Rico Vega';
