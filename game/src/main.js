// main.js — entrypoint: boots the canvas, runs the game loop and owns the
// screen state (title → playing → caught / win). Screenshot presets live
// here too: ?shot=title|play|alarm|win freezes a staged frame so the
// screenshots show the game at its best.

import { createInput, watchPresses } from './input.js';
import { createPlayer, updatePlayer, throwPebble, resetPlayer } from './player.js';
import {
  createGuards,
  updateGuards,
  distractGuards,
  highestSuspicion,
} from './guards.js';
import {
  LEVEL_WIDTH,
  LEVEL_HEIGHT,
  GUARD_ROUTES,
  SOLIDS,
  EXIT,
  freshRelics,
  pointInShadow,
} from './level.js';
import { createAudio } from './audio.js';
import {
  drawWorld,
  drawHud,
  drawTitle,
  drawWin,
  drawCaught,
  drawAlarmVignette,
} from './render.js';
import { distance } from './geometry.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();

const state = {
  screen: 'title', // title | playing | caught | win
  time: 0,
  elapsed: 0,
  alarms: 0,
  player: createPlayer(),
  guards: createGuards(GUARD_ROUTES),
  relics: freshRelics(),
  alarm: { active: false, timer: 0 },
  maxSuspicion: 0,
  inShadow: false,
  pebbleMarks: [],
  frozen: false,
};

function resetRun() {
  state.elapsed = 0;
  state.alarms = 0;
  state.alarm = { active: false, timer: 0 };
  state.maxSuspicion = 0;
  state.pebbleMarks = [];
  resetPlayer(state.player);
  state.guards = createGuards(GUARD_ROUTES);
  state.relics = freshRelics();
  state.screen = 'playing';
  announce('The heist begins. Steal three relics and reach the exit unseen.');
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

watchPresses(input, (key) => {
  audio.unlock();
  if (key === 'enter' && state.screen === 'title') resetRun();
  if (key === 'r' && (state.screen === 'caught' || state.screen === 'win')) resetRun();
});

function fitCanvas() {
  const scale = Math.min(window.innerWidth / LEVEL_WIDTH, window.innerHeight / LEVEL_HEIGHT);
  const width = Math.floor(LEVEL_WIDTH * scale);
  const height = Math.floor(LEVEL_HEIGHT * scale);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ox = (window.innerWidth - width) / 2;
  const oy = (window.innerHeight - height) / 2;
  canvas.style.left = `${ox}px`;
  canvas.style.top = `${oy}px`;
  input.setViewTransform(scale, ox, oy);
  return { scale, ox, oy, dpr };
}

function update(dt) {
  state.time += dt;
  if (state.screen !== 'playing') return;
  state.elapsed += dt;

  const moved = updatePlayer(state.player, input, dt);
  if (moved) audio.step(state.player.sneaking, state.player.running);

  const click = input.takeClick();
  if (click) {
    const landing = throwPebble(state.player, click);
    if (landing) {
      audio.pebble();
      state.pebbleMarks.push({ x: landing.x, y: landing.y, at: state.time });
      distractGuards(state.guards, landing.x, landing.y);
    }
  }

  const hadAlarm = state.alarm.active;
  const events = updateGuards(state.guards, state.player, dt, state.alarm);
  if (events.alarmRaised) {
    state.alarms += 1;
    audio.alert();
    announce('Alarm raised! Break line of sight and hide.');
  }
  if (events.caught) {
    state.screen = 'caught';
    audio.caught();
    announce('Caught by a guard. Press R to try again.');
    return;
  }

  state.maxSuspicion = highestSuspicion(state.guards);
  state.inShadow = pointInShadow(state.player.x, state.player.y);

  // Pick up a relic by walking over it.
  for (const relic of state.relics) {
    if (!relic.taken && distance(state.player.x, state.player.y, relic.x, relic.y) < 26) {
      relic.taken = true;
      audio.pickup();
      const taken = state.relics.filter((r) => r.taken).length;
      announce(`Relic taken: ${relic.name}. ${taken} of 3.`);
      if (taken === 3) {
        audio.exitOpen();
        announce('All relics taken. The skylight exit is open.');
      }
    }
  }

  // Reach the open exit to win.
  const allTaken = state.relics.every((r) => r.taken);
  if (
    allTaken &&
    state.player.x > EXIT.x - 6 &&
    state.player.x < EXIT.x + EXIT.w + 6 &&
    state.player.y > EXIT.y - 6 &&
    state.player.y < EXIT.y + EXIT.h + 6
  ) {
    state.screen = 'win';
    audio.win();
    announce('Clean getaway! Press R to steal again.');
  }

  if (state.alarm.active && !hadAlarm) {
    // Alarm banner appears; the vignette handles the rest.
  }
  state.pebbleMarks = state.pebbleMarks.filter((m) => state.time - m.at < 2.5);
}

function render() {
  const { scale, ox, oy, dpr } = fitCanvas();
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  ctx.clearRect(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
  if (state.screen === 'title') {
    drawWorld(ctx, state, SOLIDS);
    drawTitle(ctx);
    return;
  }
  drawWorld(ctx, state, SOLIDS);
  drawHud(ctx, state);
  drawAlarmVignette(ctx, state);
  if (state.screen === 'win') drawWin(ctx, state);
  if (state.screen === 'caught') drawCaught(ctx, state);
}

// --- Screenshot presets ----------------------------------------------------
// ?shot=play stages a mid-heist frame: Wren slipping past the crates while
// Rook's cone sweeps the gallery and one relic is already pocketed.
// ?shot=alarm stages the near-miss: the alarm is live, Knight is closing in.
// ?shot=win shows the getaway screen. ?shot=title is the title screen.
// The frame is frozen so screenshots are stable.

function applyShot(shot) {
  if (shot === 'title') {
    state.screen = 'title';
  } else if (shot === 'play') {
    resetRun();
    state.player.x = 340;
    state.player.y = 400;
    state.player.facing = -Math.PI / 2;
    state.player.sneaking = true;
    state.relics[2].taken = true;
    state.guards[0].x = 250;
    state.guards[0].y = 120;
    state.guards[0].facing = 0;
    state.guards[0].suspicion = 48;
    state.guards[1].x = 480;
    state.guards[1].y = 470;
    state.guards[1].facing = Math.PI / 2;
    state.guards[2].x = 820;
    state.guards[2].y = 360;
    state.guards[2].facing = -Math.PI / 2;
    state.maxSuspicion = 48;
    state.elapsed = 74;
    state.time = 74;
    state.inShadow = false;
  } else if (shot === 'alarm') {
    resetRun();
    state.player.x = 520;
    state.player.y = 300;
    state.player.facing = Math.PI / 2;
    state.relics[0].taken = true;
    state.relics[2].taken = true;
    state.alarm.active = true;
    state.alarm.timer = 5;
    state.alarms = 1;
    state.guards[0].x = 480;
    state.guards[0].y = 190;
    state.guards[0].facing = Math.PI / 2;
    state.guards[0].state = 'chase';
    state.guards[0].suspicion = 100;
    state.guards[0].seesPlayer = true;
    state.guards[1].x = 480;
    state.guards[1].y = 430;
    state.guards[1].facing = -Math.PI / 2;
    state.guards[1].state = 'chase';
    state.guards[1].suspicion = 62;
    state.guards[2].x = 800;
    state.guards[2].y = 380;
    state.guards[2].facing = Math.PI;
    state.guards[2].state = 'chase';
    state.guards[2].suspicion = 40;
    state.maxSuspicion = 100;
    state.elapsed = 132;
    state.time = 132;
    state.pebbleMarks = [{ x: 640, y: 260, at: 131.2 }];
  } else if (shot === 'win') {
    resetRun();
    state.relics.forEach((r) => {
      r.taken = true;
    });
    state.player.x = 880;
    state.player.y = 560;
    state.elapsed = 214;
    state.time = 214;
    state.alarms = 0;
    state.screen = 'win';
  } else {
    return;
  }
  state.frozen = true;
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) applyShot(shot);

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!state.frozen) update(dt);
  render();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  if (state.frozen) render();
});
requestAnimationFrame(frame);
