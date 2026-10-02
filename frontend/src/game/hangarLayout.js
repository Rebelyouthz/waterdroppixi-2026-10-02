// THE HANGAR BAY — floor plan, pixi-free, same contract as stationLayout.js.
//
// The Main Hall's southern door used to skip this room and jump straight into
// Star Raid. Timmy, 2026-09-18: the hangar is a room next door, dusty, with
// the ship, the turret rack for Base Defence, and a floor hatch down into
// THE DRAIN (Dead Cells-like). Geometry lives here so station.test.mjs can
// prove every station is reachable and that `drain` is not a dead building.
//
// Stage size matches the hall on purpose: one authored 960×540, fitted to
// the viewport, so a monitor does not grow extra bay.

import { FLOOR, FLOOR_W, FLOOR_H, HERO_R, WALK_SPEED, REACH, STAGE_W, STAGE_H } from './stationLayout';

export { FLOOR, FLOOR_W, FLOOR_H, HERO_R, WALK_SPEED, REACH, STAGE_W, STAGE_H };

/** Stations in the hangar. `module` is only set when the interact is a
 *  BUILDINGS buy (the hatch). Ship / turrets / hall-door are fixtures that
 *  HangarRoom.jsx routes itself — they must not reuse id `hangar`, or ENTER
 *  would recurse into this room forever. */
export const HANGAR_STATIONS = [
  { id: 'hall',    module: null,    x: FLOOR.x0 + FLOOR_W * 0.18, y: FLOOR.y1 - 36,              name: 'MAIN HALL',   hint: 'Back through the pressure door.' },
  { id: 'turrets', module: null,    x: FLOOR.x0 + FLOOR_W * 0.22, y: FLOOR.y0 + FLOOR_H * 0.42,  name: 'TURRET BAY',  hint: 'Guns for the hull outside. Base Defence arms here.' },
  { id: 'ship',    module: null,    x: FLOOR.x0 + FLOOR_W * 0.78, y: FLOOR.y0 + FLOOR_H * 0.42,  name: 'THE SHIP',    hint: 'Dusty, tarp still on. Star Raid launches from here.' },
  { id: 'hatch',   module: 'drain', x: FLOOR.x0 + FLOOR_W * 0.50, y: FLOOR.y0 + FLOOR_H * 0.62,  name: 'THE DRAIN',   hint: 'A bolted grate. A.I.D.A. calls it a drain. Something under it still sings.' },
];

export function hangarAnchor(st) {
  return { x: st.x, y: st.y };
}
