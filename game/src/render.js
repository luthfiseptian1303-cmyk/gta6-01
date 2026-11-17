// Drawing only: the city, the cars, the people and the particles, seen through a
// camera that follows the hero. The 1280x720 view is scaled to fit the window and
// centred. Flat shapes with strong colours and a warm sun-soaked palette — the
// game's look is a bright modern coastal city, drawn, never photographed.

import { VIEW, WORLD, PALETTE, FONT } from './config.js';
import { clamp } from './random.js';
import { playerCar } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function worldToScreen(x, y) {
    return {
      x: view.x + (x - stateCamera.x + VIEW.width / 2) * view.scale,
      y: view.y + (y - stateCamera.y + VIEW.height / 2) * view.scale,
    };
  }

  let stateCamera = { x: 0, y: 0 };

  function drawGround(state) {
    const cam = state.camera;
    const x0 = cam.x - VIEW.width / 2 - 40;
    const y0 = cam.y - VIEW.height / 2 - 40;
    const x1 = cam.x + VIEW.width / 2 + 40;
    const y1 = cam.y + VIEW.height / 2 + 40;
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Beach along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD.height - 130, WORLD.width, 130);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, WORLD.height - 60, WORLD.width, 60);
    // Parks.
    for (const park of state.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = '#3f7d33';
      for (let i = 0; i < park.trees; i += 1) {
        const tx = park.x + 30 + ((i * 67) % (park.w - 60));
        const ty = park.y + 30 + ((i * 53) % (park.h - 60));
        context.beginPath();
        context.arc(tx, ty, 14, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Plazas.
    for (const plaza of state.city.plazas) {
      if (plaza.x > x1 || plaza.x + plaza.w < x0 || plaza.y > y1 || plaza.y + plaza.h < y0) continue;
      context.fillStyle = '#c9bfa5';
      context.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    }
    drawRoads(state, x0, y0, x1, y1);
    // Buildings.
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 3;
      context.strokeRect(b.x, b.y, b.w, b.h);
      // Windows in rows.
      context.fillStyle = 'rgba(255,255,255,0.55)';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          context.fillRect(b.x + 14 + cx * 46, b.y + 14 + cy * 46, 20, 16);
        }
      }
      // Roof detail: a darker inner rectangle.
      context.fillStyle = 'rgba(0,0,0,0.12)';
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, 18);
    }
  }

  function drawRoads(state, x0, y0, x1, y1) {
    const { lines } = state.city;
    const half = WORLD.roadWidth / 2;
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of lines.xs) {
      if (rx < x0 - 100 || rx > x1 + 100) continue;
      context.fillRect(rx - half - 10, Math.max(0, y0), WORLD.roadWidth + 20, Math.min(WORLD.height, y1) - Math.max(0, y0));
    }
    for (const ry of lines.ys) {
      if (ry < y0 - 100 || ry > y1 + 100) continue;
      context.fillRect(Math.max(0, x0), ry - half - 10, Math.min(WORLD.width, x1) - Math.max(0, x0), WORLD.roadWidth + 20);
    }
    context.fillStyle = PALETTE.road;
    for (const rx of lines.xs) {
      if (rx < x0 - 100 || rx > x1 + 100) continue;
      context.fillRect(rx - half, Math.max(0, y0), WORLD.roadWidth, Math.min(WORLD.height, y1) - Math.max(0, y0));
    }
    for (const ry of lines.ys) {
      if (ry < y0 - 100 || ry > y1 + 100) continue;
      context.fillRect(Math.max(0, x0), ry - half, Math.min(WORLD.width, x1) - Math.max(0, x0), WORLD.roadWidth);
    }
    // Dashed centre lines.
    context.fillStyle = PALETTE.roadLine;
    for (const rx of lines.xs) {
      if (rx < x0 - 100 || rx > x1 + 100) continue;
      for (let y = Math.floor(Math.max(0, y0) / 48) * 48; y < Math.min(WORLD.height, y1); y += 48) {
        context.fillRect(rx - 3, y, 6, 24);
      }
    }
    for (const ry of lines.ys) {
      if (ry < y0 - 100 || ry > y1 + 100) continue;
      for (let x = Math.floor(Math.max(0, x0) / 48) * 48; x < Math.min(WORLD.width, x1); x += 48) {
        context.fillRect(x, ry - 3, 24, 6);
      }
    }
  }

  function drawCarShape(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const len = 54;
    const wid = 28;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-len / 2 + 4, -wid / 2 + 5, len, wid);
    context.fillStyle = car.color;
    roundRect(-len / 2, -wid / 2, len, wid, 8);
    context.fill();
    // Windshield and rear window.
    context.fillStyle = '#bfe3f2';
    context.fillRect(len * 0.12, -wid / 2 + 4, 12, wid - 8);
    context.fillRect(-len * 0.32, -wid / 2 + 4, 8, wid - 8);
    // Headlights.
    context.fillStyle = '#fff8c9';
    context.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
    context.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
    if (car.kind === 'police') {
      // White cruiser with a dark band, so it reads instantly against the road.
      context.fillStyle = '#1c2733';
      context.fillRect(-len * 0.1, -wid / 2 + 2, len * 0.2, wid - 4);
      const flash = Math.floor(car.siren * 4) % 2 === 0;
      context.fillStyle = flash ? PALETTE.policeLight : PALETTE.policeLight2;
      context.beginPath();
      context.arc(0, -wid / 2 - 2, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? PALETTE.policeLight2 : PALETTE.policeLight;
      context.beginPath();
      context.arc(0, wid / 2 + 2, 7, 0, Math.PI * 2);
      context.fill();
      text('PD', -len * 0.28, 5, 13, '#1c2733', 'left', 'middle');
    } else if (car.kind === 'taxi') {
      context.fillStyle = '#f2c94c';
      context.fillRect(-len * 0.18, -wid / 2, len * 0.36, 6);
      text('TAXI', -len * 0.3, 5, 11, '#1c2733', 'left', 'middle');
    }
    // Damage smoke.
    if (car.hp < 45) {
      context.fillStyle = 'rgba(120,120,120,0.7)';
      context.beginPath();
      context.arc(-len / 2, 0, 8 + Math.sin(car.siren * 9) * 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawPed(ped) {
    context.save();
    context.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      context.rotate(Math.PI / 2);
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.2)';
    context.beginPath();
    context.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
    context.fill();
    // Body and head, facing the walk direction.
    context.rotate(ped.angle);
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c89b';
    context.beginPath();
    context.arc(6, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    context.save();
    context.translate(p.x, p.y);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 4, 14, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(p.angle);
    // Rico Vega: red jacket, gold shirt, dark jeans.
    context.fillStyle = PALETTE.playerJacket;
    context.beginPath();
    context.arc(0, 0, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.fillRect(2, -6, 10, 12);
    context.fillStyle = '#f2c89b';
    context.beginPath();
    context.arc(9, 0, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2c2c34';
    context.beginPath();
    context.arc(9, -2, 7, Math.PI, Math.PI * 2);
    context.fill();
    // Punching fist.
    if (p.punchAnim > 0) {
      context.fillStyle = '#f2c89b';
      context.beginPath();
      context.arc(24, 0, 7, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    // Direction arrow when on foot.
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.beginPath();
    context.moveTo(24, 0);
    context.lineTo(16, -5);
    context.lineTo(16, 5);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(state.time * 4) * 3;
      context.save();
      context.translate(pickup.x, pickup.y + bob);
      context.fillStyle = '#f2c94c';
      context.fillRect(-12, -8, 24, 16);
      context.fillStyle = '#1c2733';
      context.fillRect(-12, -2, 24, 4);
      text('$', 0, 5, 14, '#1c2733', 'center', 'middle');
      context.restore();
      // Beacon column so the bag is visible from far away.
      context.fillStyle = 'rgba(242,201,76,0.25)';
      context.fillRect(pickup.x - 3, pickup.y - 130, 6, 130);
    }
  }

  function drawObjectiveBeacon(state) {
    const mission = state.mission;
    if (!mission || mission.state !== 'active' || !mission.target) return;
    const t = mission.target;
    const pulse = 1 + Math.sin(state.time * 3) * 0.12;
    context.save();
    context.translate(t.x, t.y);
    context.strokeStyle = PALETTE.objective;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255,207,61,0.18)';
    context.beginPath();
    context.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.objective;
    context.beginPath();
    context.moveTo(0, -52);
    context.lineTo(10, -34);
    context.lineTo(-10, -34);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  /** Paint the world for one frame, with the camera centred on the hero. */
  function drawWorld(state) {
    stateCamera = state.camera;
    const cam = state.camera;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#1c2733';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    context.setTransform(scale, 0, 0, scale, view.x - (cam.x - VIEW.width / 2) * scale, view.y - (cam.y - VIEW.height / 2) * scale);
    drawGround(state);
    drawObjectiveBeacon(state);
    drawPickups(state);
    for (const ped of state.peds) drawPed(ped);
    const cars = state.cars.slice().sort((a, b) => a.y - b.y);
    for (const car of cars) drawCarShape(car);
    drawPlayer(state);
    drawParticles(state);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawWorld, text, worldToScreen, view: () => view };
}
