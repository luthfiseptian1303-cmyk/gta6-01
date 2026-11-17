// The HUD and the menus: money and health, wanted stars, speed, the minimap,
// the mission panel, banners, and the title / pause / busted / complete screens.
// Everything is drawn on the same canvas as the world, in screen space.

import { VIEW, WORLD, PALETTE, FONT, GAME_NAME, CITY_NAME, HERO_NAME, MISSIONS } from './config.js';
import { clamp } from './random.js';
import { playerCar } from './world.js';
import { missionObjectiveText, missionDistance } from './missions.js';

export function createHud(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
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

  function plain(value, x, y, size, color, align, baseline) {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    context.font = fonts.get('p' + size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.hudPanel;
    context.beginPath();
    context.roundRect(x, y, w, h, 10);
    context.fill();
  }

  function drawStars(state) {
    const x0 = VIEW.width - 230;
    const y0 = 18;
    panel(x0 - 10, y0 - 6, 220, 44);
    for (let i = 0; i < 5; i += 1) {
      drawStar(x0 + 14 + i * 40, y0 + 16, 13, i < state.wanted ? '#ffd166' : 'rgba(255,255,255,0.22)');
    }
    if (state.wanted > 0) {
      text('WANTED', x0 + 14, y0 + 34, 11, '#ff8a7a', 'left', 'top');
    } else {
      text('CLEAN', x0 + 14, y0 + 34, 11, PALETTE.hudGreen, 'left', 'top');
    }
  }

  function drawStar(cx, cy, r, color) {
    context.fillStyle = color;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  }

  function drawMoneyHealth(state) {
    panel(14, 14, 250, 64);
    text('$' + state.player.money.toLocaleString('en-US'), 28, 42, 26, PALETTE.hudGold);
    plain('Cash', 28, 64, 12, PALETTE.hudMuted);
    // Health bar.
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(150, 30, 100, 12);
    context.fillStyle = state.player.hp > 40 ? PALETTE.hudGreen : PALETTE.hudRed;
    context.fillRect(150, 30, 100 * clamp(state.player.hp / 100, 0, 1), 12);
    plain('HP ' + Math.ceil(state.player.hp), 150, 58, 12, PALETTE.hudText);
    if (state.player.ammo !== undefined && !state.player.inCar) {
      plain('Ammo ' + state.player.ammo, 28, 92, 12, PALETTE.hudMuted);
    }
  }

  function drawMinimap(state) {
    const w = 216;
    const h = 152;
    const x0 = 14;
    const y0 = VIEW.height - h - 14;
    panel(x0 - 6, y0 - 6, w + 12, h + 12);
    context.save();
    context.beginPath();
    context.rect(x0, y0, w, h);
    context.clip();
    context.fillStyle = '#243024';
    context.fillRect(x0, y0, w, h);
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    context.fillStyle = '#4a4d58';
    for (const rx of state.city.lines.xs) context.fillRect(x0 + rx * sx - 2, y0, 4, h);
    for (const ry of state.city.lines.ys) context.fillRect(x0, y0 + ry * sy, w, 4);
    // Objective.
    const mission = state.mission;
    if (mission && mission.state === 'active' && mission.target) {
      context.fillStyle = PALETTE.objective;
      context.beginPath();
      context.arc(x0 + mission.target.x * sx, y0 + mission.target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Police.
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      context.fillStyle = '#2f7bff';
      context.fillRect(x0 + car.x * sx - 3, y0 + car.y * sy - 3, 6, 6);
    }
    // Traffic.
    context.fillStyle = 'rgba(255,255,255,0.6)';
    for (const car of state.cars) {
      if (car.driver === 'police' || car.driver === 'player') continue;
      context.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
    }
    // Hero.
    const p = state.player;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 3.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    plain(CITY_NAME.toUpperCase(), x0, y0 - 10, 11, PALETTE.hudMuted);
  }

  function drawMissionPanel(state) {
    const mission = state.mission;
    const x0 = VIEW.width / 2 - 260;
    const y0 = 14;
    panel(x0, y0, 520, 62);
    if (!mission) {
      text('No job yet — press Enter to start the story.', x0 + 16, y0 + 26, 15, PALETTE.hudText);
      return;
    }
    text(mission.def.title, x0 + 16, y0 + 24, 17, PALETTE.hudGold);
    plain(missionObjectiveText(state), x0 + 16, y0 + 46, 13, PALETTE.hudText);
    if (mission.state === 'active') {
      const d = missionDistance(state);
      text(d + ' m', x0 + 504, y0 + 24, 15, PALETTE.hudText, 'right');
      if (state.missionTimer > 0) {
        text(Math.ceil(state.missionTimer) + 's', x0 + 504, y0 + 46, 15, state.missionTimer < 15 ? PALETTE.hudRed : PALETTE.hudText, 'right');
      }
    }
  }

  function drawSpeed(state) {
    const car = playerCar(state);
    if (!car) return;
    const x0 = VIEW.width - 150;
    const y0 = VIEW.height - 70;
    panel(x0, y0, 136, 56);
    const kmh = Math.round(Math.abs(car.speed) * 0.45);
    text(kmh + '', x0 + 68, y0 + 32, 28, PALETTE.hudText, 'center');
    plain('km/h  ' + car.kind.toUpperCase(), x0 + 68, y0 + 48, 11, PALETTE.hudMuted, 'center');
  }

  function drawBanner(state) {
    if (!state.missionBanner || state.missionBannerTimer <= 0) return;
    const alpha = Math.min(1, state.missionBannerTimer);
    context.globalAlpha = alpha;
    const w = 760;
    const x0 = VIEW.width / 2 - w / 2;
    const y0 = 96;
    panel(x0, y0, w, 86);
    text(state.missionBanner.title, VIEW.width / 2, y0 + 32, 26, PALETTE.hudGold, 'center');
    plain(state.missionBanner.text, VIEW.width / 2, y0 + 60, 14, PALETTE.hudText, 'center');
    context.globalAlpha = 1;
  }

  function drawMessage(state) {
    if (!state.message || state.messageTimer <= 0) return;
    context.globalAlpha = Math.min(1, state.messageTimer);
    panel(VIEW.width / 2 - 320, VIEW.height - 56, 640, 36);
    plain(state.message, VIEW.width / 2, VIEW.height - 32, 14, PALETTE.hudText, 'center');
    context.globalAlpha = 1;
  }

  function drawBustWarning(state) {
    if (state.bustTimer <= 0 || state.player.inCar) return;
    const frac = clamp(state.bustTimer / 1.4, 0, 1);
    panel(VIEW.width / 2 - 180, 190, 360, 40);
    text('THE POLICE ARE GRABBING YOU!', VIEW.width / 2, 206, 15, PALETTE.hudRed, 'center');
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(VIEW.width / 2 - 160, 216, 320, 8);
    context.fillStyle = PALETTE.hudRed;
    context.fillRect(VIEW.width / 2 - 160, 216, 320 * frac, 8);
  }

  function drawControlsHint(state) {
    if (state.time > 14) return;
    panel(14, 92, 300, 132);
    plain('WASD / arrows — walk & drive', 28, 114, 13, PALETTE.hudText);
    plain('E — steal / exit car', 28, 136, 13, PALETTE.hudText);
    plain('Space / click — punch', 28, 158, 13, PALETTE.hudText);
    plain('F / right-click — shoot', 28, 180, 13, PALETTE.hudText);
    plain('Shift — run   P — pause   M — mute', 28, 202, 13, PALETTE.hudText);
  }

  /** Draw the whole HUD over the world. */
  function drawHud(state) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawMoneyHealth(state);
    drawStars(state);
    drawMissionPanel(state);
    drawMinimap(state);
    drawSpeed(state);
    drawBanner(state);
    drawMessage(state);
    drawBustWarning(state);
    drawControlsHint(state);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawScreenPanel(title, lines, prompt, accent) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.fillStyle = 'rgba(8, 12, 20, 0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const w = 720;
    const h = 150 + lines.length * 30 + 70;
    const x0 = VIEW.width / 2 - w / 2;
    const y0 = VIEW.height / 2 - h / 2;
    panel(x0, y0, w, h);
    text(title, VIEW.width / 2, y0 + 62, 44, accent || PALETTE.hudText, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      plain(lines[i], VIEW.width / 2, y0 + 104 + i * 30, 16, PALETTE.hudMuted, 'center');
    }
    text(prompt, VIEW.width / 2, y0 + h - 28, 18, PALETTE.hudGold, 'center');
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawTitle(state, best, hasSave) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.fillStyle = 'rgba(8, 12, 20, 0.6)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text(GAME_NAME, VIEW.width / 2, 190, 84, PALETTE.hudGold, 'center');
    text('An open-world crime story in ' + CITY_NAME, VIEW.width / 2, 236, 22, PALETTE.hudText, 'center');
    plain(HERO_NAME + ' owes the wrong people money. Five jobs stand between him and freedom.', VIEW.width / 2, 276, 16, PALETTE.hudMuted, 'center');
    const lines = [
      'Steal cars, outrun the Solmar PD, and finish all 5 missions.',
      'WASD walk & drive · E steal / exit car · Space punch · F shoot',
      'Shift run · P pause · M mute · progress saves automatically',
      hasSave ? 'Save found — press Enter to continue your story.' : 'Press Enter or click to start the story.',
      best > 0 ? 'Best cash earned: $' + best.toLocaleString('en-US') : '',
    ].filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      plain(lines[i], VIEW.width / 2, 330 + i * 30, 16, i === 3 ? PALETTE.hudGold : PALETTE.hudText, 'center');
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawPaused() {
    drawScreenPanel('Paused', ['The city waits for no one — except now.', 'Your progress is saved.'], 'Press P or Enter to keep playing');
  }

  function drawOver(state) {
    drawScreenPanel('Wasted', [
      'Rico Vega went down in ' + CITY_NAME + '.',
      'Missions done: ' + state.stats.missionsDone + ' of ' + MISSIONS.length + ' · Cash: $' + state.player.money,
    ], 'Press Enter to try again', PALETTE.hudRed);
  }

  function drawBusted(state) {
    drawScreenPanel('Busted', [
      'The Solmar PD caught Rico Vega.',
      'You lose $100 in bail. Missions done: ' + state.stats.missionsDone + ' of ' + MISSIONS.length + '.',
    ], 'Press Enter to get back on the street', PALETTE.hudRed);
  }

  function drawComplete(state) {
    drawScreenPanel('The Big Score — Complete!', [
      'All five jobs done. Rico Vega is free, and ' + CITY_NAME + ' is his.',
      'Cash earned: $' + state.stats.moneyEarned.toLocaleString('en-US') + ' · Cars stolen: ' + state.stats.carsStolen,
      'Free roam continues — keep driving, the city is yours.',
    ], 'Press Enter to keep playing', PALETTE.hudGold);
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawHud, drawTitle, drawPaused, drawOver, drawBusted, drawComplete, resize };
}
