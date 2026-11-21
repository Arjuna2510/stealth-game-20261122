// render.js — everything the player sees: the museum floor, lamp light and
// shadows, vision cones clipped by walls, the thief and the guards, the HUD
// and the title / win / caught screens. Canvas 2D only, no images.

import { distance } from './geometry.js';
import {
  LEVEL_WIDTH,
  LEVEL_HEIGHT,
  WALLS,
  CRATES,
  SHADOWS,
  LAMPS,
  EXIT,
} from './level.js';
import { CONE_RANGE, CONE_HALF_ANGLE, GUARD_RADIUS } from './guards.js';

const TILE = 40;

// Cast rays across the guard's cone; each ray stops at the first solid or at
// the cone's range, so walls and crates genuinely cut the visible cone.
function conePolygon(guard, solids) {
  const points = [{ x: guard.x, y: guard.y }];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const angle =
      guard.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / steps;
    const range = rayRange(guard.x, guard.y, angle, solids);
    points.push({
      x: guard.x + Math.cos(angle) * range,
      y: guard.y + Math.sin(angle) * range,
    });
  }
  return points;
}

function rayRange(x, y, angle, solids) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let r = 8; r <= CONE_RANGE; r += 6) {
    const px = x + dx * r;
    const py = y + dy * r;
    if (px < 0 || py < 0 || px > LEVEL_WIDTH || py > LEVEL_HEIGHT) return r;
    for (const solid of solids) {
      if (
        px >= solid.x &&
        px <= solid.x + solid.w &&
        py >= solid.y &&
        py <= solid.y + solid.h
      ) {
        return r;
      }
    }
  }
  return CONE_RANGE;
}

export function drawWorld(ctx, state, solids) {
  drawFloor(ctx);
  drawShadows(ctx);
  drawLampLight(ctx);
  drawExit(ctx, state);
  drawRelics(ctx, state);
  drawCrates(ctx);
  drawWalls(ctx);
  drawCones(ctx, state, solids);
  drawPlayer(ctx, state);
  drawGuards(ctx, state);
  drawPebbleMarks(ctx, state);
}

function drawFloor(ctx) {
  ctx.fillStyle = '#171a26';
  ctx.fillRect(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
  // Checkerboard marble tiles, faint enough to read as floor, not noise.
  for (let ty = 0; ty < LEVEL_HEIGHT / TILE; ty++) {
    for (let tx = 0; tx < LEVEL_WIDTH / TILE; tx++) {
      if ((tx + ty) % 2 === 0) {
        ctx.fillStyle = '#1b1f2e';
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= LEVEL_WIDTH; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LEVEL_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= LEVEL_HEIGHT; y += TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LEVEL_WIDTH, y);
    ctx.stroke();
  }
  // Outer wall trim.
  ctx.strokeStyle = '#3a3f55';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, LEVEL_WIDTH - 10, LEVEL_HEIGHT - 10);
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(11, 11, LEVEL_WIDTH - 22, LEVEL_HEIGHT - 22);
}

function drawShadows(ctx) {
  for (const s of SHADOWS) {
    ctx.fillStyle = 'rgba(2, 4, 12, 0.55)';
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 170, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(160, 190, 255, 0.35)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SHADOW — hard to spot here', s.x + s.w / 2, s.y + 16);
  }
}

function drawLampLight(ctx) {
  for (const lamp of LAMPS) {
    const glow = ctx.createRadialGradient(
      lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r,
    );
    glow.addColorStop(0, 'rgba(255, 214, 130, 0.20)');
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd682';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, state) {
  const open = state.relics.every((r) => r.taken);
  const pulse = open ? 0.5 + 0.3 * Math.sin(state.time * 3) : 0;
  ctx.fillStyle = open ? `rgba(80, 220, 140, ${0.25 + pulse})` : 'rgba(120, 120, 120, 0.25)';
  ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.strokeStyle = open ? '#4fe08c' : '#8a8f9d';
  ctx.lineWidth = 3;
  ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.fillStyle = open ? '#c9ffe0' : '#c8ccd8';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT OPEN' : 'EXIT — LOCKED', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 - 2);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(open ? 'slip out unseen' : `${state.relics.filter((r) => r.taken).length}/3 relics`, EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 14);
}

function drawRelics(ctx, state) {
  for (const relic of state.relics) {
    if (relic.taken) continue;
    const glow = 0.55 + 0.3 * Math.sin(state.time * 4 + relic.x);
    ctx.save();
    ctx.translate(relic.x, relic.y);
    const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    halo.addColorStop(0, `rgba(120, 230, 255, ${glow})`);
    halo.addColorStop(1, 'rgba(120, 230, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#8fe8ff';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#e8fbff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = '#bfefff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(relic.name, relic.x, relic.y + 30);
  }
}

function drawCrates(ctx) {
  for (const crate of CRATES) {
    ctx.fillStyle = '#4a3823';
    ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
    ctx.strokeStyle = '#2c2113';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x + 1, crate.y + 1, crate.w - 2, crate.h - 2);
    ctx.strokeStyle = '#6b5334';
    ctx.beginPath();
    ctx.moveTo(crate.x, crate.y);
    ctx.lineTo(crate.x + crate.w, crate.y + crate.h);
    ctx.moveTo(crate.x + crate.w, crate.y);
    ctx.lineTo(crate.x, crate.y + crate.h);
    ctx.stroke();
  }
}

function drawWalls(ctx) {
  for (const wall of WALLS) {
    ctx.fillStyle = '#2e3247';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
  }
}

function drawCones(ctx, state, solids) {
  for (const guard of state.guards) {
    const hot = guard.suspicion > 55 || state.alarm.active;
    const poly = conePolygon(guard, solids);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    const alpha = guard.seesPlayer ? 0.34 : hot ? 0.26 : 0.17;
    ctx.fillStyle = state.alarm.active || guard.state === 'chase'
      ? `rgba(255, 70, 70, ${alpha})`
      : `rgba(255, 214, 90, ${alpha})`;
    ctx.fill();
    ctx.strokeStyle = state.alarm.active ? 'rgba(255, 90, 90, 0.5)' : 'rgba(255, 214, 90, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  const bob = p.moving ? Math.sin(p.stepPhase) * 1.5 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.4);
  // Hooded cloak: a dark teal triangle pointing where Wren faces.
  ctx.rotate(p.facing);
  ctx.fillStyle = '#1f8f7a';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#27b39a';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b2e28';
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Sneak ring: a faint circle while hidden in shadow.
  if (state.inShadow) {
    ctx.strokeStyle = 'rgba(140, 190, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawGuards(ctx, state) {
  for (const guard of state.guards) {
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.facing);
    // Navy uniform body with a brass cap brim.
    ctx.fillStyle = '#2b3a67';
    ctx.beginPath();
    ctx.arc(0, 0, GUARD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = guard.state === 'chase' ? '#ff5a5a' : '#c9a86a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(6, -6, 9, 12);
    // Suspicion "?" above a guard who is onto something.
    ctx.restore();
    if (guard.suspicion > 25) {
      ctx.fillStyle = guard.suspicion > 80 ? '#ff6b6b' : '#ffd65a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const mark = guard.suspicion > 80 ? '!' : '?';
      ctx.fillText(mark, guard.x, guard.y - GUARD_RADIUS - 8);
    }
    ctx.fillStyle = '#dfe6ff';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(guard.name, guard.x, guard.y + GUARD_RADIUS + 12);
  }
}

function drawPebbleMarks(ctx, state) {
  for (const mark of state.pebbleMarks) {
    const age = state.time - mark.at;
    if (age > 2.5) continue;
    const alpha = 1 - age / 2.5;
    ctx.strokeStyle = `rgba(255, 220, 120, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, 6 + age * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 220, 120, ${alpha})`;
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- HUD and screens -------------------------------------------------------

export function drawHud(ctx, state) {
  ctx.fillStyle = 'rgba(5, 7, 14, 0.72)';
  ctx.fillRect(0, 0, LEVEL_WIDTH, 44);
  ctx.fillStyle = '#e8ecf7';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const taken = state.relics.filter((r) => r.taken).length;
  ctx.fillText(`MOONLIGHT VAULT   •   Relics ${taken}/3`, 14, 19);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#aab3cc';
  ctx.fillText(
    taken < 3 ? 'Steal all 3 relics, then reach the skylight exit.' : 'Exit open — slip out unseen!',
    14, 36,
  );

  // Detection meter (the loudest guard's suspicion).
  const sus = state.maxSuspicion;
  const meterX = 560;
  const meterW = 200;
  ctx.fillStyle = '#20242f';
  ctx.fillRect(meterX, 12, meterW, 14);
  ctx.fillStyle = sus > 80 ? '#ff5a5a' : sus > 40 ? '#ffb84d' : '#ffd65a';
  ctx.fillRect(meterX, 12, meterW * (sus / 100), 14);
  ctx.strokeStyle = '#4a5068';
  ctx.strokeRect(meterX, 12, meterW, 14);
  ctx.fillStyle = '#e8ecf7';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SPOTTED', meterX, 38);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8ecf7';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(formatTime(state.elapsed), LEVEL_WIDTH - 14, 19);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#aab3cc';
  ctx.fillText(`Pebbles ${state.player.pebbles}  •  Alarms ${state.alarms}`, LEVEL_WIDTH - 14, 36);
  ctx.textAlign = 'left';

  if (state.alarm.active) {
    ctx.fillStyle = 'rgba(180, 20, 20, 0.85)';
    ctx.fillRect(LEVEL_WIDTH / 2 - 130, 52, 260, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!! ALARM — BREAK LINE OF SIGHT !!', LEVEL_WIDTH / 2, 72);
    ctx.textAlign = 'left';
  }

  // Bottom hint bar.
  ctx.fillStyle = 'rgba(5, 7, 14, 0.6)';
  ctx.fillRect(0, LEVEL_HEIGHT - 26, LEVEL_WIDTH, 26);
  ctx.fillStyle = '#8b93ad';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(
    'WASD / arrows — move    SHIFT — sneak (slower, harder to spot)    CLICK — toss a pebble to distract a guard',
    14, LEVEL_HEIGHT - 9,
  );
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(4, 6, 12, ${alpha})`;
  ctx.fillRect(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
}

export function drawTitle(ctx) {
  overlay(ctx, 0.82);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd65a';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText('MOONLIGHT VAULT', LEVEL_WIDTH / 2, 190);
  ctx.fillStyle = '#c9d4f2';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('A stealth game in the Halcyon Museum', LEVEL_WIDTH / 2, 228);
  ctx.fillStyle = '#8fe8ff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('You are Wren, a thief after three moonstone relics.', LEVEL_WIDTH / 2, 282);
  ctx.fillStyle = '#e8ecf7';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Guards patrol with lantern cones — stay out of the light,', LEVEL_WIDTH / 2, 316);
  ctx.fillText('hide in shadows and behind crates, and slip out unseen.', LEVEL_WIDTH / 2, 338);
  ctx.fillStyle = '#aab3cc';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move  •  SHIFT sneak  •  CLICK toss a pebble (3)  •  collect 3 relics, then reach the EXIT', LEVEL_WIDTH / 2, 392);
  ctx.fillStyle = '#ffd65a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  const blink = 0.6 + 0.4 * Math.sin(Date.now() / 350);
  ctx.globalAlpha = blink;
  ctx.fillText('Press ENTER to begin', LEVEL_WIDTH / 2, 452);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawWin(ctx, state) {
  overlay(ctx, 0.78);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4fe08c';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('CLEAN GETAWAY', LEVEL_WIDTH / 2, 200);
  ctx.fillStyle = '#e8ecf7';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('All three relics, and not a single guard saw your face.', LEVEL_WIDTH / 2, 244);
  const rank = state.alarms === 0 ? 'GHOST — never spotted' : state.alarms === 1 ? 'SHADOW — one alarm' : 'LOUD — they knew someone was there';
  ctx.fillStyle = '#ffd65a';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(rank, LEVEL_WIDTH / 2, 300);
  ctx.fillStyle = '#c9d4f2';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(`Time ${formatTime(state.elapsed)}   •   Alarms raised ${state.alarms}`, LEVEL_WIDTH / 2, 340);
  ctx.fillStyle = '#aab3cc';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press R to steal again', LEVEL_WIDTH / 2, 400);
  ctx.textAlign = 'left';
}

export function drawCaught(ctx, state) {
  overlay(ctx, 0.78);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('CAUGHT!', LEVEL_WIDTH / 2, 200);
  ctx.fillStyle = '#e8ecf7';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('A guard laid hands on Wren under the skylight.', LEVEL_WIDTH / 2, 244);
  ctx.fillStyle = '#c9d4f2';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(
    `Relics ${state.relics.filter((r) => r.taken).length}/3   •   Time ${formatTime(state.elapsed)}`,
    LEVEL_WIDTH / 2, 300,
  );
  ctx.fillStyle = '#ffd65a';
  ctx.font = 'bold 18px system-ui, sans-serif';
  const blink = 0.6 + 0.4 * Math.sin(Date.now() / 350);
  ctx.globalAlpha = blink;
  ctx.fillText('Press R to try again', LEVEL_WIDTH / 2, 360);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// Red edge glow while the alarm is live — the near-miss feedback.
export function drawAlarmVignette(ctx, state) {
  if (!state.alarm.active) return;
  const pulse = 0.22 + 0.1 * Math.sin(state.time * 6);
  const grad = ctx.createRadialGradient(
    LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_HEIGHT * 0.42,
    LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_HEIGHT * 0.75,
  );
  grad.addColorStop(0, 'rgba(255, 40, 40, 0)');
  grad.addColorStop(1, `rgba(255, 40, 40, ${pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
}
