// THE MAIN HALL — the floor plan, with no PixiJS in it.
//
// Split out of stationRoom.js on purpose: everything here is arithmetic and a
// table, so a plain-node test can reach it. stationRoom.js imports pixi.js,
// which the headless suite cannot load, and a room whose geometry is only
// checkable by eye is a room whose geometry is never checked.
//
// What that buys, concretely: `test/station.test.mjs` can prove that no door
// sits on top of the viewport, that no two stations arm at the same time, that
// every door names a module that actually exists, and — the one that matters
// most in this codebase — that every door routes somewhere real. A door that
// names a module `Camp.jsx`'s enterBuilding does not handle opens NOTHING, and
// it would never throw. That is this project's dominant bug wearing a hat.

export const STAGE_W = 960;
export const STAGE_H = 540;

/** The walkable floor. Everything else derives from it. */
export const FLOOR = { x0: 128, y0: 152, x1: 832, y1: 456 };
export const FLOOR_W = FLOOR.x1 - FLOOR.x0;
export const FLOOR_H = FLOOR.y1 - FLOOR.y0;

/** Visible height of the back wall's inner face, and the wall band's depth. */
export const BACK_FACE = 46;
export const WALL_T = 54;

// He is the biggest thing in the room after the core, and deliberately so.
// At 18 the emblem's inlaid drop was LARGER than the actual character, which
// read as a tiny head walking across a logo. The player's own body has to
// dominate the frame or the room is a picture with a cursor in it.
export const HERO_R = 26;
export const WALK_SPEED = 168;
/** How close you must stand for a station to arm. */
export const REACH = 62;

/** The viewport in the back wall: centre x and half-width, in stage units. */
export const WINDOW = { cx: 480, hw: 84 };

/** The emblem inlaid in the floor: centre, and its outer radius. Kept here
 *  rather than in the painter so the guard can prove nothing stands on it. */
export const EMBLEM = { cx: 480, cy: FLOOR.y0 + FLOOR_H * 0.56, r: 64 };

// ── The room's contents ──────────────────────────────────────────────
// `module` is the id in game/base.js. It decides whether a door is lit and
// enterable or dark and padlocked, and it is what Camp.jsx's enterBuilding()
// already knows how to route — so nothing here invents a second navigation.
//
// `side` + `at` place the thing on a wall; `at` is 0..1 along that wall.
export const STATIONS = [
  { id: 'nav',    module: 'patrolPost', side: 'top',    at: 0.24, name: 'NAVIGATION',  hint: 'Charts, routes, patrols' },
  { id: 'fab',    module: 'forge',      side: 'top',    at: 0.76, name: 'FABRICATION', hint: 'Gear, artifacts, crafting' },
  { id: 'recl',   module: 'well',       side: 'left',   at: 0.52, name: 'RECLAMATION', hint: 'The Well. Nobody asks how many times.' },
  // The hull is the room itself — four holes you walk up to and patch.
  // Kept off the back wall so it never sits on the Earth window, and far
  // enough from Reclamation that the prompt cannot flicker between them.
  { id: 'hull',   module: 'hull',       side: 'left',   at: 0.18, name: 'HULL BREACH', hint: 'Four holes. Air going the wrong way.', fixture: true },
  { id: 'bio',    module: 'incubator',  side: 'right',  at: 0.52, name: 'BIO LAB',     hint: 'Eggs, pets, mutations' },
  { id: 'hangar', module: 'hangar',     side: 'bottom', at: 0.78, name: 'HANGAR',      hint: 'The ship. Outside the ring.' },
  // Not a door — a console bolted to the wall of the room you are already in.
  // `rampart` IS the Main Hall, so its system lives here rather than behind a
  // doorway to somewhere else.
  { id: 'def',    module: 'rampart',    side: 'bottom', at: 0.50, name: 'DEFENCE',     hint: 'Core, towers, waves', fixture: true },
  { id: 'core',   module: null,         side: 'centre', at: 0,    name: 'A.I.D.A.',    hint: 'The data core' },
  { id: 'exit',   module: null,         side: 'bottom', at: 0.20, name: 'LEAVE',       hint: 'Back to camp' },
];

/** Where the player has to stand for a station to arm, in stage units. */
export function anchorOf(st) {
  const IN = 34;
  switch (st.side) {
    case 'top':    return { x: FLOOR.x0 + FLOOR_W * st.at, y: FLOOR.y0 + IN };
    case 'bottom': return { x: FLOOR.x0 + FLOOR_W * st.at, y: FLOOR.y1 - IN };
    case 'left':   return { x: FLOOR.x0 + IN,              y: FLOOR.y0 + FLOOR_H * st.at };
    case 'right':  return { x: FLOOR.x1 - IN,              y: FLOOR.y0 + FLOOR_H * st.at };
    // The core stands in the FRONT half of the room, not dead centre. Dead
    // centre is where the inlaid emblem is, and the two were drawn on top of
    // each other in the first version — the plinth covered the drop glyph and
    // the "armed" ring landed inside the emblem's own ring. Caught by looking
    // at it; no arithmetic check would have known they were different things.
    default:       return { x: (FLOOR.x0 + FLOOR.x1) / 2,  y: FLOOR.y0 + FLOOR_H * 0.30 };
  }
}

/** The doorway or console plate itself — where the ART goes, in the wall. */
export function plateOf(st) {
  const a = anchorOf(st);
  switch (st.side) {
    case 'top':    return { x: a.x, y: FLOOR.y0 - BACK_FACE / 2, w: 88, h: BACK_FACE, dir: 'v' };
    case 'bottom': return { x: a.x, y: FLOOR.y1 + 13, w: 88, h: 26, dir: 'v' };
    case 'left':   return { x: FLOOR.x0 - 15, y: a.y, w: 30, h: 92, dir: 'h' };
    case 'right':  return { x: FLOOR.x1 + 15, y: a.y, w: 30, h: 92, dir: 'h' };
    default:       return { x: a.x, y: a.y, w: 0, h: 0, dir: 'v' };
  }
}

/** Inner glass of the bay window, in stage units. Same rect `_paintWindow`
 *  and the live shutters use — a sprite of Earth belongs HERE, not stretched
 *  across the whole stage behind the hull. */
export function windowRect() {
  const hh = BACK_FACE - 10;
  return {
    x: WINDOW.cx - WINDOW.hw,
    y: FLOOR.y0 - BACK_FACE + (BACK_FACE - hh) / 2,
    w: WINDOW.hw * 2,
    h: hh,
  };
}

/** How finished the hall looks. 0 is the dusty wreck; 1 is every module
 *  installed. Repair alone is not "cosy" — it is just powered and empty. */
export function hallCozy01(repaired, builtModules, totalModules) {
  if (!repaired) return 0;
  const t = totalModules > 0 ? totalModules : 1;
  const v = 0.22 + (builtModules / t) * 0.78;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Which camp sheet belongs on a station. The hull is the room itself, so it
 *  never gets a furniture sprite — that was how a 128px icon ate half the
 *  left wall. */
export function sheetKeyForStation(st) {
  if (!st || st.id === 'hull') return null;
  if (st.id === 'core') return 'core';
  if (st.id === 'exit') return 'portal';
  return st.module || null;
}

/** Where a furniture sheet sits in the lounge painting (960x540).
 *  Walk anchors stay on the floor plan so the room still plays the same;
 *  the ART sits on the painted couches / lab / window console so a built
 *  module looks like it belongs in that room, not like a sticker on a wall. */
const LOUNGE_POSE = {
  nav:    { x: 98,  y: 210, ax: 0.5, ay: 1,   h: 50 },
  fab:    { x: 836, y: 200, ax: 0.5, ay: 1,   h: 52 },
  recl:   { x: 292, y: 338, ax: 0.5, ay: 1,   h: 70 },
  bio:    { x: 812, y: 318, ax: 0.5, ay: 1,   h: 64 },
  hangar: { x: 710, y: 470, ax: 0.5, ay: 1,   h: 46 },
  def:    { x: 480, y: 198, ax: 0.5, ay: 1,   h: 40 },
  core:   { x: 480, y: 258, ax: 0.5, ay: 1,   h: 70 },
  exit:   { x: 190, y: 478, ax: 0.5, ay: 0.5, h: 32 },
};

export function furniturePose(st) {
  if (!st || st.id === 'hull') return null;
  if (LOUNGE_POSE[st.id]) return LOUNGE_POSE[st.id];
  const p = plateOf(st);
  const a = anchorOf(st);
  if (st.side === 'centre') return { x: a.x, y: a.y + 22, ax: 0.5, ay: 1, h: 76 };
  if (st.id === 'exit') return { x: p.x, y: p.y, ax: 0.5, ay: 0.5, h: 34 };
  if (st.side === 'top') return { x: p.x, y: FLOOR.y0 + 8, ax: 0.5, ay: 1, h: BACK_FACE + 16 };
  if (st.side === 'bottom') return { x: p.x, y: FLOOR.y1 - 2, ax: 0.5, ay: 1, h: 48 };
  if (st.side === 'left') return { x: FLOOR.x0 + 6, y: a.y + 26, ax: 1, ay: 1, h: 68 };
  if (st.side === 'right') return { x: FLOOR.x1 - 6, y: a.y + 26, ax: 0, ay: 1, h: 68 };
  return { x: a.x, y: a.y, ax: 0.5, ay: 1, h: 56 };
}

/** Dark patches on the restored lounge painting. Unbuilt modules stay
 *  shadowed; buying one fades its patch so that corner of the picture
 *  comes alive. Stage units, aimed at the people-free hall painting
 *  (left couches, back Earth window, right lab) — not a second floor plan. */
export const RESTORE_ZONES = {
  nav:    { x: 40,  y: 70,  w: 220, h: 150 },
  fab:    { x: 700, y: 64,  w: 220, h: 180 },
  recl:   { x: 64,  y: 196, w: 310, h: 220 },
  hull:   { x: 16,  y: 108, w: 96,  h: 210 },
  bio:    { x: 686, y: 220, w: 250, h: 220 },
  hangar: { x: 620, y: 428, w: 250, h: 96 },
  def:    { x: 292, y: 44,  w: 376, h: 200 },
  core:   { x: 350, y: 248, w: 250, h: 160 },
  exit:   { x: 110, y: 438, w: 190, h: 86 },
};
