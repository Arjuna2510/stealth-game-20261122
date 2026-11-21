// player.js — Wren, the thief: movement, sneaking, and the pebble toss.
// The player never decides what a guard sees; guards.js owns detection.

import { clamp, resolveCircleRect } from './geometry.js';
import { LEVEL_WIDTH, LEVEL_HEIGHT, SOLIDS, PLAYER_SPAWN } from './level.js';

export const PLAYER_RADIUS = 13;
export const WALK_SPEED = 168;
export const SNEAK_SPEED = 88;
export const PEBBLE_RANGE = 280;
export const PEBBLE_START_COUNT = 3;

export function createPlayer() {
  return {
    x: PLAYER_SPAWN.x,
    y: PLAYER_SPAWN.y,
    facing: 0, // radians; 0 = east
    moving: false,
    sneaking: false,
    running: false,
    pebbles: PEBBLE_START_COUNT,
    pebbleCooldown: 0,
    stepPhase: 0, // drives the footstep sound + walk bob
  };
}

export function resetPlayer(player) {
  const fresh = createPlayer();
  Object.assign(player, fresh);
}

// Move from input. Returns true when the player actually moved this frame.
export function updatePlayer(player, input, dt) {
  let dx = 0;
  let dy = 0;
  if (input.isDown('w', 'arrowup')) dy -= 1;
  if (input.isDown('s', 'arrowdown')) dy += 1;
  if (input.isDown('a', 'arrowleft')) dx -= 1;
  if (input.isDown('d', 'arrowright')) dx += 1;

  player.sneaking = input.isDown('shift');
  const speed = player.sneaking ? SNEAK_SPEED : WALK_SPEED;
  player.running = !player.sneaking && (dx !== 0 || dy !== 0);

  const len = Math.hypot(dx, dy);
  player.moving = len > 0;
  if (player.moving) {
    dx /= len;
    dy /= len;
    player.facing = Math.atan2(dy, dx);
    player.stepPhase += dt * (player.sneaking ? 5 : 9);
    let nx = player.x + dx * speed * dt;
    let ny = player.y + dy * speed * dt;
    nx = clamp(nx, PLAYER_RADIUS + 4, LEVEL_WIDTH - PLAYER_RADIUS - 4);
    ny = clamp(ny, PLAYER_RADIUS + 4, LEVEL_HEIGHT - PLAYER_RADIUS - 4);
    for (const solid of SOLIDS) {
      const fixed = resolveCircleRect(nx, ny, PLAYER_RADIUS, solid);
      nx = fixed.x;
      ny = fixed.y;
    }
    player.x = nx;
    player.y = ny;
  }

  if (player.pebbleCooldown > 0) player.pebbleCooldown -= dt;
  return player.moving;
}

// Throw a pebble toward the clicked point. Returns the landing point or null
// (no pebbles left, or still on cooldown).
export function throwPebble(player, click) {
  if (player.pebbles <= 0 || player.pebbleCooldown > 0) return null;
  const dx = click.x - player.x;
  const dy = click.y - player.y;
  const dist = Math.hypot(dx, dy);
  const reach = Math.min(dist, PEBBLE_RANGE);
  const landing = {
    x: player.x + (dist === 0 ? 0 : (dx / dist) * reach),
    y: player.y + (dist === 0 ? 0 : (dy / dist) * reach),
  };
  player.pebbles -= 1;
  player.pebbleCooldown = 0.8;
  return landing;
}
