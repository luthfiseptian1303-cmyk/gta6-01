// Keyboard, mouse and touch input. Held keys give movement and steering; one-shot
// presses (enter car, punch, shoot, pause, start, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted
// twice. Mouse aim: the hero faces the cursor when shooting on foot.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;
export const ACTION_RETRY = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const SHOOT = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const RETRY = new Set(['KeyR']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function down(event) {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (RUN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER_CAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER_CAR;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (SHOOT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SHOOT;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RETRY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RETRY;
    } else {
      return;
    }
    event.preventDefault();
  }

  function up(event) {
    held.delete(event.code);
  }

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (event.button === 2) actions |= ACTION_SHOOT;
    else actions |= ACTION_PUNCH;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  target.addEventListener('pointerup', () => { mouseDown = false; });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector in [-1, 1] from WASD / arrow keys. */
    move() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      return { x, y };
    },
    /** Steering: -1 left, 1 right. Gas: -1 brake/reverse, 1 accelerate. */
    drive() {
      return {
        steer: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        gas: (hasAny(UP) ? 1 : 0) - (hasAny(DOWN) ? 1 : 0),
      };
    },
    running() {
      return hasAny(RUN);
    },
    /** Cursor position in client pixels, for aiming on foot. */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test hook: pretend a key is held (used by the self-test). */
    press(code) { held.add(code); },
    release(code) { held.delete(code); },
    queue(action) { actions |= action; },
  };
}
