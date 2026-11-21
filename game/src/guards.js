// guards.js — patrols, vision cones, suspicion, alarm, investigation.
// Detection gives the player a chance to recover: suspicion fills while seen
// and drains while hidden; a full meter raises the alarm, but breaking line
// of sight lets guards calm down, investigate the last seen spot, and go
// back to their patrol.

import { angleDifference, clamp, distance, hasLineOfSight, resolveCircleRect } from './geometry.js';
import { SOLIDS, pointInShadow, pointInLampLight } from './level.js';

export const GUARD_RADIUS = 14;
export const CONE_RANGE = 195;
export const CONE_HALF_ANGLE = Math.PI / 5; // 36 degrees each side
export const PATROL_SPEED = 68;
export const CHASE_SPEED = 152;
export const INVESTIGATE_SPEED = 108;
export const CATCH_RADIUS = 22;
export const SUSPICION_MAX = 100;
export const ALARM_HOLD_SECONDS = 6;

const DETECT_GAIN = 58; // suspicion per second, fully visible in the open
const SUSPICION_DECAY = 26;

export function createGuards(routes) {
  return routes.map((route) => {
    const start = route.waypoints[0];
    const next = route.waypoints[1];
    return {
      name: route.name,
      waypoints: route.waypoints,
      pauseSeconds: route.pauseSeconds,
      x: start.x,
      y: start.y,
      facing: Math.atan2(next.y - start.y, next.x - start.x),
      waypointIndex: 1,
      pauseLeft: 0,
      state: 'patrol', // patrol | investigate | chase | return
      suspicion: 0,
      seesPlayer: false,
      investigateX: start.x,
      investigateY: start.y,
      lookTimer: 0,
      lastSeenX: start.x,
      lastSeenY: start.y,
      calmTimer: 0,
    };
  });
}

// Can this guard see the player right now? Cone + range + line of sight.
export function guardCanSee(guard, player, sneaking) {
  const dist = distance(guard.x, guard.y, player.x, player.y);
  const range = sneaking ? CONE_RANGE * 0.82 : CONE_RANGE;
  if (dist > range) return false;
  const angleToPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (angleDifference(angleToPlayer, guard.facing) > CONE_HALF_ANGLE) return false;
  return hasLineOfSight(guard.x, guard.y, player.x, player.y, SOLIDS);
}

// How fast suspicion grows while the player is visible: closer, lit and
// running are easier to spot; sneaking and shadow make it much slower.
export function detectionRate(guard, player) {
  const dist = distance(guard.x, guard.y, player.x, player.y);
  let rate = DETECT_GAIN * (1.25 - (dist / CONE_RANGE) * 0.7);
  if (player.sneaking) rate *= 0.5;
  if (player.running) rate *= 1.35;
  if (pointInShadow(player.x, player.y)) rate *= 0.42;
  if (pointInLampLight(player.x, player.y)) rate *= 1.15;
  return rate;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  let nx = guard.x + (dx / dist) * step;
  let ny = guard.y + (dy / dist) * step;
  for (const solid of SOLIDS) {
    const fixed = resolveCircleRect(nx, ny, GUARD_RADIUS, solid);
    nx = fixed.x;
    ny = fixed.y;
  }
  guard.x = nx;
  guard.y = ny;
  guard.facing = Math.atan2(dy, dx);
  return dist - step < 2;
}

function advancePatrol(guard, dt) {
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    // Idle look-around at a waypoint: a slow scan, so patrols feel alive.
    guard.lookTimer += dt;
    guard.facing += Math.sin(guard.lookTimer * 1.4) * 0.35 * dt;
    return;
  }
  const target = guard.waypoints[guard.waypointIndex];
  if (moveToward(guard, target.x, target.y, PATROL_SPEED, dt)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = guard.pauseSeconds;
    guard.lookTimer = 0;
  }
}

// A pebble clatter or a glimpse pulls the nearest guards to a point.
export function distractGuards(guards, x, y) {
  for (const guard of guards) {
    if (guard.state === 'chase') continue;
    if (distance(guard.x, guard.y, x, y) > 340) continue;
    guard.state = 'investigate';
    guard.investigateX = x;
    guard.investigateY = y;
    guard.suspicion = Math.max(guard.suspicion, 35);
  }
}

// One frame of guard AI. Returns events for sound + HUD:
// { alarmRaised, caught, heardNoise }.
export function updateGuards(guards, player, dt, alarm) {
  const events = { alarmRaised: false, caught: false };
  for (const guard of guards) {
    guard.seesPlayer = guardCanSee(guard, player, player.sneaking);

    if (guard.seesPlayer) {
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      guard.suspicion = clamp(
        guard.suspicion + detectionRate(guard, player) * dt,
        0,
        SUSPICION_MAX,
      );
      guard.calmTimer = ALARM_HOLD_SECONDS;
    } else {
      guard.suspicion = clamp(guard.suspicion - SUSPICION_DECAY * dt, 0, SUSPICION_MAX);
      guard.calmTimer -= dt;
    }

    if (guard.suspicion >= SUSPICION_MAX && !alarm.active) {
      alarm.active = true;
      alarm.timer = ALARM_HOLD_SECONDS;
      events.alarmRaised = true;
    }

    if (alarm.active) {
      // Chase the last seen spot; a fresh sighting refreshes it.
      guard.state = 'chase';
      const arrived = moveToward(guard, guard.lastSeenX, guard.lastSeenY, CHASE_SPEED, dt);
      if (arrived && !guard.seesPlayer) {
        // Lost the trail: sweep the area, then give up.
        guard.state = 'investigate';
        guard.investigateX = guard.lastSeenX;
        guard.investigateY = guard.lastSeenY;
      }
      if (distance(guard.x, guard.y, player.x, player.y) < CATCH_RADIUS) {
        events.caught = true;
      }
    } else if (guard.state === 'investigate') {
      const arrived = moveToward(
        guard,
        guard.investigateX,
        guard.investigateY,
        INVESTIGATE_SPEED,
        dt,
      );
      if (arrived) {
        guard.pauseLeft = 1.4;
        guard.state = 'return';
      }
    } else if (guard.state === 'return') {
      if (guard.pauseLeft > 0) {
        guard.pauseLeft -= dt;
      } else {
        // Walk back to the nearest waypoint, then resume the patrol.
        let nearest = 0;
        let nearestDist = Infinity;
        guard.waypoints.forEach((wp, i) => {
          const d = distance(guard.x, guard.y, wp.x, wp.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = i;
          }
        });
        guard.waypointIndex = nearest;
        guard.state = 'patrol';
      }
    } else {
      advancePatrol(guard, dt);
    }
  }

  if (alarm.active) {
    alarm.timer -= dt;
    const anySees = guards.some((g) => g.seesPlayer);
    if (!anySees && alarm.timer <= 0) {
      alarm.active = false;
      // The alarm fades: guards investigate where they last saw the player.
      for (const guard of guards) {
        guard.state = 'investigate';
        guard.investigateX = guard.lastSeenX;
        guard.investigateY = guard.lastSeenY;
        guard.suspicion = Math.min(guard.suspicion, 55);
      }
    } else if (anySees) {
      alarm.timer = ALARM_HOLD_SECONDS;
    }
  }

  return events;
}

// The loudest suspicion across guards — the HUD's detection meter.
export function highestSuspicion(guards) {
  return guards.reduce((max, g) => Math.max(max, g.suspicion), 0);
}
