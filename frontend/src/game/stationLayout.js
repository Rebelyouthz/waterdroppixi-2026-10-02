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
  { id: 'bio',    module: 'incubator',  side: 'right',  at: 0.52, name: 'BIO LAB',     hint: 'Eggs, pets, mutations' },
  { id: 'hangar', module: 'hangar',     side: 'bottom', at: 0.78, name: 'HANGAR',      hint: 'The ship. Outside the ring.' },
  // Not a door — a console bolted to the wall of the room you are already in.
  // `rampart` IS the Main Hall, so its system lives here rather than behind a
  // doorway to somewhere else.
  { id: 'def',    module: 'rampart',    side: 'bottom', at: 0.50, name: 'DEFENCE',     hint: 'Core, towers, waves', fixture: true },
  { id: 'core',   module: null,         side: 'centre', at: 0,    name: 'A.I.D.A.',    hint: 'The data core' },
  { id: 'exit',   module: null,         side: 'bottom', at: 0.20, name: 'LEAVE',       hint: 'Back to the module list' },
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
