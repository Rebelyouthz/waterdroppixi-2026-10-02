/* THE MAIN HALL — floor-plan and routing guards.
 *
 * The room is drawn by PixiJS, which this suite cannot load, so none of it can
 * be checked by running it. What CAN be checked is the arithmetic and the
 * wiring, and those are where the failures that actually cost time live:
 *
 *   · a door drawn on top of the viewport — invisible in code review, obvious
 *     and unfixable-looking on screen
 *   · two stations close enough that the prompt flickers between them as you
 *     stand still
 *   · an anchor outside the walkable floor, i.e. a door you can never reach
 *     because the hero is clamped away from it
 *   · A DOOR THAT ROUTES NOWHERE. This is the one that matters. Every door
 *     names a module id, Camp.jsx's `enterBuilding` switch turns that id into
 *     a panel, and a door naming an id that switch does not handle opens
 *     absolutely nothing and never throws. That is this project's dominant bug
 *     — content that is declared, renders, and is read by nobody — and it is
 *     exactly how a whole gear system once ate player loot in silence.
 *
 * Every check below was proved to go red by injecting the fault before it was
 * trusted. A green check that has never failed proves nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FLOOR, FLOOR_W, FLOOR_H, STAGE_W, STAGE_H, HERO_R, REACH, WINDOW,
  BACK_FACE, EMBLEM, STATIONS, anchorOf, plateOf,
  furniturePose, hallCozy01, windowRect, sheetKeyForStation, RESTORE_ZONES,
} from '../src/game/stationLayout.js';
import { HANGAR_STATIONS, hangarAnchor } from '../src/game/hangarLayout.js';
import { BUILDINGS, tryBuyBuilding } from '../src/game/base.js';
import { storyBeat } from '../src/game/campaign.js';
import { cannotAffordStationQuest, getActiveBuildQuest } from '../src/game/stationQuests.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
/** The same file with every comment removed.
 *
 * Needed because the first version of the GlowFilter guard below went red on
 * the COMMENT in stationRoom.js that says GlowFilter is forbidden. Funny, but
 * it is the same defect in both directions: a guard that reads prose can be
 * tripped by prose and, worse, could be silenced by rewording it. These checks
 * are about what the code does, so they read code. */
const code = (f) => read(f)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    const why = fn();
    if (why) fails.push(`${name}\n    ${why}`);
    else pass++;
  } catch (e) {
    fails.push(`${name}\n    threw: ${e.message}`);
  }
}

// ── 1. The room fits on the stage ───────────────────────────────────
check('the walkable floor sits inside the authored stage', () => {
  if (FLOOR.x0 < 0 || FLOOR.y0 < 0 || FLOOR.x1 > STAGE_W || FLOOR.y1 > STAGE_H)
    return `floor ${JSON.stringify(FLOOR)} escapes ${STAGE_W}x${STAGE_H}`;
  // The back wall's face is drawn ABOVE the floor and must still be on stage.
  if (FLOOR.y0 - BACK_FACE < 0) return 'the back wall face is off the top of the stage';
  return null;
});

check('the floor is big enough to be worth walking across', () => {
  // Under about six hero-widths in either direction and the room reads as a
  // corridor, not a hall — you arrive at the far wall before the walk cycle
  // has finished a step.
  if (FLOOR_W < HERO_R * 12) return `floor is only ${FLOOR_W} wide`;
  if (FLOOR_H < HERO_R * 8) return `floor is only ${FLOOR_H} tall`;
  return null;
});

// ── 2. Every station is reachable ───────────────────────────────────
check('every station anchor is inside the hero clamp', () => {
  // The hero is clamped to the floor inset by his own radius. An anchor
  // outside that box can never be reached, so the door never arms and the
  // system behind it is unreachable from the room.
  const bad = [];
  for (const st of STATIONS) {
    const a = anchorOf(st);
    if (a.x < FLOOR.x0 + HERO_R || a.x > FLOOR.x1 - HERO_R ||
        a.y < FLOOR.y0 + HERO_R || a.y > FLOOR.y1 - HERO_R) {
      bad.push(`${st.id} at (${a.x.toFixed(0)},${a.y.toFixed(0)})`);
    }
  }
  return bad.length ? `unreachable: ${bad.join(', ')}` : null;
});

check('no two stations arm at the same time', () => {
  // The prompt names ONE station. Two anchors closer than the reach radius
  // means standing between them flickers the prompt as the hero breathes.
  const bad = [];
  for (let i = 0; i < STATIONS.length; i++) {
    for (let j = i + 1; j < STATIONS.length; j++) {
      const a = anchorOf(STATIONS[i]), b = anchorOf(STATIONS[j]);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < REACH) bad.push(`${STATIONS[i].id}/${STATIONS[j].id} are ${d.toFixed(0)} apart (reach ${REACH})`);
    }
  }
  return bad.length ? bad.join('; ') : null;
});

// ── 3. Nothing is drawn on top of anything else ─────────────────────
check('no back-wall door overlaps the viewport', () => {
  // The window is the composition's centre. A door plate drawn through it is
  // the kind of thing that looks like a rendering bug rather than a layout
  // mistake, and it is pure arithmetic to prevent.
  const winL = WINDOW.cx - WINDOW.hw - 6, winR = WINDOW.cx + WINDOW.hw + 6;
  const bad = [];
  for (const st of STATIONS) {
    if (st.side !== 'top') continue;
    const p = plateOf(st);
    const l = p.x - p.w / 2, r = p.x + p.w / 2;
    if (r > winL && l < winR) bad.push(`${st.id} (${l.toFixed(0)}..${r.toFixed(0)}) crosses the window (${winL}..${winR})`);
  }
  return bad.length ? bad.join('; ') : null;
});

check('no two plates on the same wall overlap', () => {
  const bad = [];
  const bySide = {};
  for (const st of STATIONS) (bySide[st.side] ||= []).push(st);
  for (const [side, list] of Object.entries(bySide)) {
    if (side === 'centre') continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = plateOf(list[i]), b = plateOf(list[j]);
        const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
        const overlapY = Math.abs(a.y - b.y) < (a.h + b.h) / 2;
        if (overlapX && overlapY) bad.push(`${list[i].id}/${list[j].id} on the ${side} wall`);
      }
    }
  }
  return bad.length ? bad.join('; ') : null;
});

check('nothing stands on the inlaid floor emblem', () => {
  // The first build put the A.I.D.A. core at dead centre, which is exactly
  // where the emblem is inlaid: the plinth covered the drop glyph and the
  // armed-station ring landed concentric inside the emblem's own ring. It
  // looked like a rendering fault. It was two features at one coordinate, and
  // only looking at the screen found it — so it becomes a check.
  const bad = [];
  for (const st of STATIONS) {
    const a = anchorOf(st);
    const d = Math.hypot(a.x - EMBLEM.cx, a.y - EMBLEM.cy);
    if (d < EMBLEM.r) bad.push(`${st.id} stands ${d.toFixed(0)} from the emblem centre (r ${EMBLEM.r})`);
  }
  return bad.length ? bad.join('; ') : null;
});

check('the emblem is on the floor, not under a wall', () => {
  if (EMBLEM.cy - EMBLEM.r < FLOOR.y0 || EMBLEM.cy + EMBLEM.r > FLOOR.y1)
    return `emblem at ${EMBLEM.cy} r${EMBLEM.r} runs past the floor (${FLOOR.y0}..${FLOOR.y1})`;
  return null;
});

check('the hull is the room, so it never gets a furniture sprite', () => {
  const hull = STATIONS.find(s => s.id === 'hull');
  if (!hull) return 'no hull station';
  if (sheetKeyForStation(hull)) return 'hull still maps to a sheet';
  if (furniturePose(hull)) return 'hull still has a furniture pose';
  return null;
});

check('furniture sits in the lounge, not as wall-plate stickers', () => {
  const bad = [];
  for (const st of STATIONS) {
    if (st.id === 'hull') continue;
    const pose = furniturePose(st);
    if (!pose) { bad.push(`${st.id} has no pose`); continue; }
    if (pose.h > 90) bad.push(`${st.id} is ${pose.h}px tall — that is a blob, not furniture`);
    if (pose.x < 0 || pose.x > STAGE_W || pose.y < 0 || pose.y > STAGE_H)
      bad.push(`${st.id} pose ${pose.x},${pose.y} is off the stage`);
  }
  const recl = furniturePose(STATIONS.find(s => s.id === 'recl'));
  const bio = furniturePose(STATIONS.find(s => s.id === 'bio'));
  if (recl.x > STAGE_W / 2) bad.push('couches / well must sit in the left lounge');
  if (bio.x < STAGE_W / 2) bad.push('lab must sit in the right lounge');
  if (recl.x <= FLOOR.x0 + 18) bad.push('couches are still glued to the left wall plate');
  if (bio.x >= FLOOR.x1 - 18) bad.push('lab is still glued to the right wall plate');
  return bad.length ? bad.join('; ') : null;
});

check('Earth in the window is the window rect, not a stage backdrop', () => {
  const r = windowRect();
  if (r.w > WINDOW.hw * 2 + 1 || r.h > BACK_FACE)
    return `windowRect ${JSON.stringify(r)} is larger than the bay`;
  if (r.x + r.w < WINDOW.cx || r.x > WINDOW.cx)
    return 'windowRect does not contain the window centre';
  if (r.y + r.h < FLOOR.y0 - BACK_FACE || r.y > FLOOR.y0)
    return 'windowRect is not on the back wall';
  return null;
});

check('the hall reads as a wreck until you restore it', () => {
  const mods = STATIONS.filter(s => s.module).length;
  if (hallCozy01(false, 0, mods) !== 0) return 'an unrepaired hall is not cozy 0';
  if (hallCozy01(true, 0, mods) < 0.15 || hallCozy01(true, 0, mods) > 0.35)
    return 'repair alone should be powered-and-empty, not a finished home';
  if (hallCozy01(true, mods, mods) < 0.99) return 'a fully built hall should be cozy 1';
  return null;
});

// ── 4. THE DEAD-CONFIG GUARD — the one that matters ─────────────────
check('every station names a module that exists in BUILDINGS', () => {
  const bad = STATIONS.filter(s => s.module && !BUILDINGS[s.module]).map(s => `${s.id} -> ${s.module}`);
  return bad.length ? `unknown module: ${bad.join(', ')}` : null;
});

check('every station module ROUTES somewhere in Camp.jsx enterBuilding', () => {
  // Read the real switch rather than restating it. A door whose module id is
  // not handled there opens nothing at all, silently — the exact failure this
  // codebase keeps paying for.
  const camp = code('components/Camp.jsx');
  const fn = camp.slice(camp.indexOf('const enterBuilding'));
  const body = fn.slice(0, fn.indexOf('\n  };'));
  if (!body || body.length < 40) return 'could not locate enterBuilding — the guard is looking at nothing';
  const bad = [];
  const modules = [
    ...STATIONS.filter(s => s.module).map(s => ({ id: s.id, module: s.module })),
    ...HANGAR_STATIONS.filter(s => s.module).map(s => ({ id: s.id, module: s.module })),
  ];
  for (const st of modules) {
    if (!new RegExp(`id === '${st.module}'`).test(body)) bad.push(`${st.id} -> ${st.module}`);
  }
  return bad.length ? `no route for: ${bad.join(', ')}` : null;
});

check('the exit and the core need no module and must never gain one', () => {
  // Both are room fixtures, not systems. Giving either a module id would send
  // it through enterBuilding and out of the room, which is precisely what the
  // exit must not do.
  const bad = STATIONS.filter(s => (s.id === 'exit' || s.id === 'core') && s.module).map(s => s.id);
  return bad.length ? `${bad.join(', ')} gained a module` : null;
});

check('there is exactly one exit, and it is on the floor you spawn on', () => {
  const exits = STATIONS.filter(s => s.id === 'exit');
  if (exits.length !== 1) return `${exits.length} exits`;
  const a = anchorOf(exits[0]);
  // Spawn is bottom-centre (see stationRoom.js's constructor). The way out has
  // to be visible from where you arrive, or the room can feel like a trap on a
  // first visit even though Escape works.
  if (a.y < FLOOR.y0 + FLOOR_H * 0.5) return 'the exit is in the far half of the room';
  return null;
});

// ── 5. The room and the module list cannot drift apart ──────────────
check('every buildable module is present as a door or a fixture', () => {
  // `hull` is the structure itself — there is no room to walk into, it IS the
  // room — so it is the one deliberate exception, the same exception
  // BasePanel already makes when it withholds ENTER from the hull.
  // THE DRAIN lives in the hangar, not the Main Hall. Hall ∪ hangar is the
  // full set of walkable doors; a building in neither is a dead buy.
  const offered = new Set([
    ...STATIONS.map(s => s.module).filter(Boolean),
    ...HANGAR_STATIONS.map(s => s.module).filter(Boolean),
  ]);
  const missing = Object.keys(BUILDINGS).filter(id => id !== 'hull' && !offered.has(id));
  return missing.length ? `no way into: ${missing.join(', ')}` : null;
});

check('the room reads the save through game/base.js, not its own copy', () => {
  const room = code('game/stationRoom.js');
  if (!/from '\.\/base'/.test(room)) return 'stationRoom.js does not import game/base';
  // A second literal cost/level table in the room is how the module list and
  // the room start disagreeing about what is built.
  if (/costGold\s*:/.test(room)) return 'stationRoom.js declares its own building costs';
  return null;
});

check('the repair is ONE function, called by both surfaces', () => {
  const base = code('game/base.js');
  if (!/export function repairStation/.test(base)) return 'game/base.js has no repairStation';
  const panel = code('components/BasePanel.jsx');
  const room = code('components/StationRoom.jsx');
  if (!/repairStation\(/.test(panel)) return 'BasePanel.jsx does not call repairStation';
  if (!/repairStation\(/.test(room)) return 'StationRoom.jsx does not call repairStation';
  // The literal flag-set is what a second copy looks like.
  const raw = /stationRepaired\s*:\s*true/;
  if (raw.test(panel)) return 'BasePanel.jsx still sets stationRepaired directly';
  if (raw.test(room)) return 'StationRoom.jsx still sets stationRepaired directly';
  return null;
});

// ── 6. The lighting mandate ─────────────────────────────────────────
check('the room lights through the shared technique, never a GlowFilter', () => {
  const room = code('game/stationRoom.js');
  if (/GlowFilter/.test(room)) return 'GlowFilter is forbidden in the game layer';
  if (!/from '\.\/litShading'/.test(room)) return 'the room does not use the shared lighting module';
  if (!/makeLitFilter|updateLitUniforms/.test(room)) return 'nothing in the room is normal-mapped lit';
  return null;
});

check('the shader exists in exactly ONE place', () => {
  // Two copies of the fragment string is how a lighting tune lands in the run
  // and not in the station. The renderer must reference it, not restate it.
  const lit = code('game/litShading.js');
  if (!/uNormalTexture/.test(lit)) return 'litShading.js does not carry the shader';
  const rend = code('game/pixiRenderer.js');
  if (/uniform sampler2D uNormalTexture/.test(rend))
    return 'pixiRenderer.js has grown its own copy of the lit fragment shader';
  if (!/from '\.\/litShading'/.test(rend)) return 'pixiRenderer.js no longer imports the shared module';
  return null;
});

// ── 7. The way out can never be styled away ─────────────────────────
check('Aida and the awaken quest read stationRepaired, not a dead baseRepaired field', () => {
  const dialogue = code('game/aidaDialogue.js');
  const quests = code('game/stationQuests.js');
  if (/baseRepaired/.test(dialogue)) return 'aidaDialogue.js still reads baseRepaired — repair never sets that';
  if (/baseRepaired/.test(quests)) return 'stationQuests.js still reads baseRepaired — the awaken quest can never complete';
  if (!/isStationRepaired/.test(dialogue)) return 'aidaDialogue.js does not use isStationRepaired';
  if (!/isStationRepaired/.test(quests)) return 'stationQuests.js does not use isStationRepaired';
  if (!/export function applyAidaChoice/.test(dialogue)) return 'dialogue choices are never written to the save';
  return null;
});

check('the full-room shell does not hide the hardcoded hall or paint extra people', () => {
  const room = code('game/stationRoom.js');
  if (/gStatic\.visible\s*=\s*false/.test(room)) return 'shell still hides gStatic — the derelict room never shows';
  const sheets = code('game/stationSprites.js');
  if (/station-mainhall-shell/.test(sheets)) return 'CAMP_SHEETS still loads the NPC-filled room painting';
  if (!/station-mainhall-restored-2x/.test(sheets)) return 'people-free lounge painting is missing from CAMP_SHEETS';
  if (!/station-mainhall-wreck-2x/.test(sheets)) return 'wreck painting is missing from CAMP_SHEETS';
  if (!/station-earth-window-loop-16/.test(sheets)) return 'Earth belongs in the bay window sheet, and it is missing from CAMP_SHEETS';
  if (!/station-ambient-lights-16/.test(sheets)) return 'ceiling lamp sheets are missing from CAMP_SHEETS';
  if (!/furniturePose\(/.test(room)) return 'furniture sheets are not placed via furniturePose — they will sit in the middle of the floor again';
  if (/vistaSprite\.width = STAGE_W/.test(room)) return 'vista jpg still covers the whole stage instead of the window';
  return null;
});

check('tryBuyBuilding is the one purchase, and it refuses a dark station', () => {
  const dark = tryBuyBuilding({ gold: 9999, gearParts: 99, base: {} }, 'hull');
  if (dark.ok) return 'hull can be bought before the core is inserted';
  const lit = tryBuyBuilding({ gold: 9999, gearParts: 99, base: {}, stationRepaired: true }, 'hull');
  if (!lit.ok) return `hull should buy after repair: ${lit.title}`;
  if ((lit.save.base || {}).hull !== 1) return 'hull level did not become 1';
  if (lit.save.gold !== 9999 - BUILDINGS.hull.costGold) return 'gold was not charged';
  const hangar = tryBuyBuilding(lit.save, 'hangar');
  if (!hangar.ok) return 'hangar should unlock once the hull is sealed';
  return null;
});

check('THE BASE opens the hall, and you buy modules in place', () => {
  const camp = code('components/Camp.jsx');
  if (/onClick=\{lockGuard\('base', \(\) => setBaseOpen\(true\)\)\}/.test(camp))
    return 'THE BASE tab still opens BasePanel instead of the hall';
  if (!/lockGuard\('base',\s*\(\)\s*=>\s*\{[^}]*setStationOpen\(true\)/.test(camp))
    return 'THE BASE tab does not open StationRoom';
  if (/setStationOpen\(false\);\s*setBaseOpen\(true\)/.test(camp))
    return 'leaving or building still dumps the player on the module list';
  const room = code('components/StationRoom.jsx');
  if (!/tryBuyBuilding\(/.test(room)) return 'StationRoom does not buy through tryBuyBuilding';
  const base = code('game/base.js');
  if (!/export function tryBuyBuilding/.test(base)) return 'game/base.js has no tryBuyBuilding';
  const panel = code('components/BasePanel.jsx');
  if (/data-testid=\{`base-up-\$\{b\.id\}`\}/.test(panel))
    return 'BasePanel still has upgrade buttons — building belongs in the hall';
  return null;
});

check('blast shutters follow the Main Hall, not a dead interior field', () => {
  const room = code('game/stationRoom.js');
  if (/buildingLevel\(this\.save, 'interior'\)/.test(room))
    return 'shutters still read a building that does not exist';
  if (!/buildingLevel\(this\.save, 'rampart'\)/.test(room))
    return 'shutters do not open from rampart / Main Hall';
  return null;
});

check('evac from the wreck still pays hull-money', () => {
  const gs = code('components/GameScreen.jsx');
  if (!/BUILDINGS\.hull\.costGold/.test(gs))
    return 'evac no longer pays the hull cost — a failed first run traps you in a dark hall';
  if (/r\.gold = 0/.test(gs))
    return 'evac still zeroes gold';
  return null;
});

check('the wreck stays empty until you power it', () => {
  const room = code('game/stationRoom.js');
  if (!/buildingLevel\(this\.save, 'rampart'\) < 1/.test(room))
    return 'vista jpg can still load into a sealed window';
  if (!/const live = built && this\._repaired/.test(room))
    return 'furniture visibility is not gated on repair';
  if (!/sp\.visible = (live|show)/.test(room))
    return 'furniture sprites are not hidden until a module is live';
  return null;
});

check('unbuilt lounge corners stay wreck, not black boxes', () => {
  const room = code('game/stationRoom.js');
  if (/\.fill\(\{ color: 0x04080c,\s*alpha: a \}\)/.test(room))
    return 'restore zones still paint black rectangles over the hall';
  // Punch-through sprite masks left four lit rectangles on a black void when
  // the wreck sheet was missing. Unbuilt modules are a dark VEIL over a
  // fully painted lounge, not holes in the picture.
  if (!/_syncHallMask/.test(room) || !/restoreVeil/.test(room))
    return 'lounge dimming is not a veil over unlit zones';
  if (/restored\.mask = mask/.test(room))
    return 'punch-through restore mask is back — that is the four-corner black hall';
  if (!/addChild\(this\.restoreVeil\)/.test(room))
    return 'restore veil is not a sibling of the painting — it will drift off the core';
  if (/restoreMask\.renderable = false/.test(room))
    return 'restore mask renderable=false skips the stencil draw and hides the lounge';
  return null;
});

check('restore zones cover the lounge, not the old wall plates', () => {
  const recl = RESTORE_ZONES.recl;
  const bio = RESTORE_ZONES.bio;
  const def = RESTORE_ZONES.def;
  if (!recl || !bio || !def) return 'missing couch, lab, or window restore zone';
  if (recl.x + recl.w / 2 > STAGE_W / 2) return 'couch zone is not on the left';
  if (bio.x < STAGE_W / 2) return 'lab zone is not on the right';
  if (def.x > WINDOW.cx || def.x + def.w < WINDOW.cx) return 'window zone misses the Earth bay';
  return null;
});

check('Escape closes the room', () => {
  const room = code('components/StationRoom.jsx');
  if (!/Escape/.test(room)) return 'no Escape handler — the room could trap a desktop player';
  return null;
});

check('the first hour is hall then gather, never a skip to pond_1', () => {
  const fresh = { gold: 0, gearParts: 0, base: {}, mapProgress: {}, profile: { level: 1 } };
  const approach = storyBeat(fresh);
  if (approach.kind !== 'mission' || approach.node.id !== 'orbit_find') {
    return `fresh save should hold the wreck, got ${approach.kind}/${approach.node && approach.node.id}`;
  }
  const diedOnWreck = { ...fresh, runsCompleted: 1 };
  const afterDeath = storyBeat(diedOnWreck);
  if (afterDeath.kind !== 'hall' || afterDeath.why !== 'insert') {
    return `dying on the wreck must still walk the hall, got ${afterDeath.kind}/${afterDeath.why}`;
  }
  const found = { ...fresh, mapProgress: { orbit_find: true }, gold: 650 };
  const insert = storyBeat(found);
  if (insert.kind !== 'hall' || insert.why !== 'insert') {
    return `after the wreck CONTINUE STORY must open the hall, got ${insert.kind}/${insert.why}`;
  }
  const lit = { ...found, stationRepaired: true };
  const hullBeat = storyBeat(lit);
  if (hullBeat.kind !== 'hall' || hullBeat.why !== 'hull') {
    return `powered but unsealed must send you to the hull, got ${hullBeat.kind}/${hullBeat.why}`;
  }
  const hulledBroke = {
    gold: 40, gearParts: 0, base: { hull: 1 }, stationRepaired: true,
    mapProgress: { orbit_find: true }, profile: { level: 1 },
  };
  const gather = storyBeat(hulledBroke);
  if (gather.kind !== 'mission' || gather.why !== 'gather' || gather.node.id !== 'pond_1') {
    return `empty stores after the hull must launch First Drops, got ${gather.kind}/${gather.why}/${gather.node && gather.node.id}`;
  }
  const hulledRich = { ...hulledBroke, gold: 9999, gearParts: 99 };
  const build = storyBeat(hulledRich);
  if (build.kind !== 'hall' || build.why !== 'build') {
    return `with gold after the hull you walk to the next module, got ${build.kind}/${build.why}`;
  }
  const q = getActiveBuildQuest(hulledBroke);
  if (!q || q.module !== 'rampart') return `current build quest after hull should be Main Hall, got ${q && q.id}`;
  const short = cannotAffordStationQuest(hulledBroke);
  if (!short || !short.goldShort) return 'broke after hull should report a gold short';
  const hangared = {
    gold: 0, gearParts: 0, base: { hull: 1, hangar: 1 }, stationRepaired: true,
    mapProgress: { orbit_find: true, pond_1: true }, profile: { level: 1 },
  };
  // Hangar built: maps/endless open. Remaining station quests may still
  // send you to gather if you cannot afford the next module.
  if (storyBeat(hangared).kind === 'hall' && storyBeat(hangared).why === 'insert') {
    return 'hangar save still thinks AIDA is missing';
  }
  return null;
});

check('CONTINUE STORY in camp follows storyBeat, and a broke buy offers GO GATHER', () => {
  const camp = code('components/Camp.jsx');
  if (!/followStory/.test(camp)) return 'Camp has no followStory — CONTINUE STORY still dumps you into pond_1';
  if (/camp-story-btn" onClick=\{onStory\}/.test(camp)) return 'CONTINUE STORY still calls onStory raw';
  if (!/onGather=/.test(camp)) return 'Camp does not hand StationRoom a gather callback';
  const room = code('components/StationRoom.jsx');
  if (!/reason === 'gold'/.test(room)) return 'broke buys in the hall do not open a gather prompt';
  if (!/station-gather-go/.test(room)) return 'the gather prompt has no GO GATHER button';
  const over = code('components/GameOverScreen.jsx');
  if (!/YOU FOUND THE WRECK/.test(over)) return 'orbit clear still titles itself A.I.D.A. SLAIN';
  if (!/WALK THE HALL/.test(over)) return 'first home screen has no WALK THE HALL button';
  if (!/runDebrief/.test(over)) return 'death screen no longer keys the next door off storyBeat';
  return null;
});

check('the prompt keeps a real touch target', () => {
  const css = read('overhaul.css');
  const block = css.slice(css.indexOf('.sr-use {'));
  const rule = block.slice(0, block.indexOf('}'));
  const m = /min-height:\s*(\d+)px/.exec(rule);
  if (!m) return '.sr-use has no min-height';
  if (Number(m[1]) < 44) return `.sr-use is ${m[1]}px, under the 44px touch floor`;
  return null;
});

// ── THE HANGAR BAY + THE DRAIN ──────────────────────────────────────
check('every hangar station is inside the hero clamp', () => {
  const bad = [];
  for (const st of HANGAR_STATIONS) {
    const a = hangarAnchor(st);
    if (a.x < FLOOR.x0 + HERO_R || a.x > FLOOR.x1 - HERO_R ||
        a.y < FLOOR.y0 + HERO_R || a.y > FLOOR.y1 - HERO_R) {
      bad.push(`${st.id} at (${a.x.toFixed(0)},${a.y.toFixed(0)})`);
    }
  }
  return bad.length ? `unreachable in hangar: ${bad.join(', ')}` : null;
});

check('no two hangar stations arm at the same time', () => {
  const bad = [];
  for (let i = 0; i < HANGAR_STATIONS.length; i++) {
    for (let j = i + 1; j < HANGAR_STATIONS.length; j++) {
      const a = hangarAnchor(HANGAR_STATIONS[i]), b = hangarAnchor(HANGAR_STATIONS[j]);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < REACH) bad.push(`${HANGAR_STATIONS[i].id}/${HANGAR_STATIONS[j].id} are ${d.toFixed(0)} apart`);
    }
  }
  return bad.length ? bad.join('; ') : null;
});

check('the hangar door opens HangarRoom, not Star Raid', () => {
  const camp = code('components/Camp.jsx');
  const fn = camp.slice(camp.indexOf('const enterBuilding'));
  const body = fn.slice(0, fn.indexOf('\n  };'));
  if (!body || body.length < 40) return 'could not locate enterBuilding';
  if (/onStarRaid/.test(body)) return 'hangar still skips to Star Raid — the bay never opens';
  if (!/id === 'hangar'/.test(body)) return 'hangar is missing from enterBuilding';
  if (!/setHangarOpen\(true\)/.test(body)) return 'hangar does not open HangarRoom';
  if (!/id === 'drain'/.test(body)) return 'drain is missing from enterBuilding';
  return null;
});

check('drain is not in CAMP_UNLOCK_BATCHES', () => {
  const campn = code('game/campaign.js');
  const block = campn.slice(campn.indexOf('CAMP_UNLOCK_BATCHES'), campn.indexOf('export function campTabsUnlockedAt'));
  if (/'drain'/.test(block) || /'shaft'/.test(block)) {
    return 'drain in CAMP_UNLOCK_BATCHES would fire the banner while the grate is still bolted';
  }
  const hangar = code('components/HangarRoom.jsx');
  if (!/onUnlock\(\['drain'\]\)/.test(hangar)) return 'HangarRoom never queues the THE DRAIN banner';
  return null;
});

check('the clicker still owns the name THE WELL', () => {
  const camp = read('components/Camp.jsx');
  if (!/clicker:\s*\{\s*label: 'THE WELL'/.test(camp)) {
    return 'clicker lost THE WELL — do not rename it to free the string for the descent';
  }
  if (!/drain:\s*\{\s*label: 'THE DRAIN'/.test(camp)) return 'drain banner label is missing';
  return null;
});

check('HangarRoom is canvas 2d with hall sprites, not a second Pixi app', () => {
  const hangar = code('components/HangarRoom.jsx');
  if (/from 'pixi|from \"pixi|GlowFilter/.test(hangar)) {
    return 'HangarRoom imported Pixi or GlowFilter — the hall unmounts while this is open on purpose';
  }
  if (!/getContext\('2d'\)/.test(hangar)) return 'HangarRoom is not a canvas 2d walk';
  if (!/loadHangarBitmaps/.test(hangar)) return 'HangarRoom never loads the camp floor/door sheets';
  if (!/heroHalfPoints/.test(hangar)) return 'HangarRoom draws a second drop instead of heroHalfPoints';
  return null;
});

check('the drain grate is gated on the hangar, not the hull alone', () => {
  const sealed = tryBuyBuilding({ gold: 9999, gearParts: 99, stationRepaired: true, base: { hull: 1 } }, 'drain');
  if (sealed.ok) return 'drain bought without a hangar';
  const ok = tryBuyBuilding({ gold: 9999, gearParts: 99, stationRepaired: true, base: { hull: 1, hangar: 1 } }, 'drain');
  if (!ok.ok) return `drain refused with hangar online: ${ok.reason}`;
  return null;
});

// ── Report ──────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n  station.test.mjs: ${pass} passed, ${fails.length} failed\n`);
  for (const f of fails) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`  station.test.mjs: ${pass} passed, 0 failed`);
