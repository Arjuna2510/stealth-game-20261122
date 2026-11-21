// level.js — the Halcyon Museum at night: one hand-built floor plan.
// Walls and crates block movement and sight; shadow pools dampen detection;
// lamps mark the lit, dangerous floor. All coordinates are in the 960x640
// logical space the renderer scales to the window.

export const LEVEL_WIDTH = 960;
export const LEVEL_HEIGHT = 640;

// Solid rectangles. The outer shell is the room's edge (handled by bounds).
export const WALLS = [
  // Gallery divider, top: leaves a gap at the bottom.
  { x: 296, y: 64, w: 24, h: 208 },
  // Long divider, middle: gap on the left.
  { x: 448, y: 312, w: 312, h: 24 },
  // Vault wall, bottom right: gap on the left.
  { x: 648, y: 416, w: 24, h: 160 },
  // Short divider, top right.
  { x: 560, y: 64, w: 24, h: 120 },
];

// Crates block sight and movement too, but read as cover, not walls.
export const CRATES = [
  { x: 120, y: 200, w: 44, h: 44 },
  { x: 176, y: 200, w: 44, h: 44 },
  { x: 120, y: 256, w: 44, h: 44 },
  { x: 400, y: 120, w: 44, h: 44 },
  { x: 400, y: 176, w: 44, h: 44 },
  { x: 700, y: 200, w: 44, h: 44 },
  { x: 756, y: 200, w: 44, h: 44 },
  { x: 240, y: 420, w: 44, h: 44 },
  { x: 296, y: 420, w: 44, h: 44 },
  { x: 520, y: 480, w: 44, h: 44 },
  { x: 840, y: 380, w: 44, h: 44 },
  { x: 840, y: 436, w: 44, h: 44 },
];

export const SOLIDS = [...WALLS, ...CRATES];

// Shadow pools: standing inside one makes the player much harder to spot.
export const SHADOWS = [
  { x: 96, y: 400, w: 150, h: 110 },
  { x: 620, y: 84, w: 160, h: 90 },
  { x: 360, y: 480, w: 150, h: 100 },
  { x: 800, y: 500, w: 110, h: 90 },
];

// Warm lamp pools: lit floor where guards see clearly. Purely visual + a
// small detection bonus handled in guards.js via isLit().
export const LAMPS = [
  { x: 200, y: 120, r: 90 },
  { x: 480, y: 240, r: 100 },
  { x: 820, y: 120, r: 90 },
  { x: 360, y: 360, r: 90 },
  { x: 600, y: 540, r: 90 },
];

export const RELICS = [
  { id: 'moonstone', name: 'Moonstone', x: 856, y: 96, taken: false },
  { id: 'star-sapphire', name: 'Star Sapphire', x: 480, y: 560, taken: false },
  { id: 'eclipse-pearl', name: 'Eclipse Pearl', x: 120, y: 96, taken: false },
];

export const PLAYER_SPAWN = { x: 64, y: 576 };

// The skylight exit, bottom-right. Locked until every relic is taken.
export const EXIT = { x: 872, y: 544, w: 64, h: 64 };

// Guard patrol routes: named guards, waypoint loops, facing at spawn.
export const GUARD_ROUTES = [
  {
    name: 'Rook',
    waypoints: [
      { x: 160, y: 120 },
      { x: 520, y: 120 },
      { x: 520, y: 240 },
      { x: 160, y: 240 },
    ],
    pauseSeconds: 1.6,
  },
  {
    name: 'Bishop',
    waypoints: [
      { x: 480, y: 400 },
      { x: 480, y: 560 },
      { x: 600, y: 560 },
      { x: 600, y: 400 },
    ],
    pauseSeconds: 1.2,
  },
  {
    name: 'Knight',
    waypoints: [
      { x: 760, y: 300 },
      { x: 900, y: 300 },
      { x: 900, y: 480 },
      { x: 760, y: 480 },
    ],
    pauseSeconds: 2.0,
  },
];

export function pointInShadow(x, y) {
  return SHADOWS.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

export function pointInLampLight(x, y) {
  return LAMPS.some((lamp) => {
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    return dx * dx + dy * dy <= lamp.r * lamp.r;
  });
}

// Fresh, mutable copies for a new run (relics reset, guards respawn).
export function freshRelics() {
  return RELICS.map((r) => ({ ...r, taken: false }));
}
