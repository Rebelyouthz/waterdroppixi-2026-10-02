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
} from '../src/game/stationLayout.js';
import { BUILDINGS } from '../src/game/base.js';

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
  for (const st of STATIONS) {
    if (!st.module) continue;
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
  const offered = new Set(STATIONS.map(s => s.module).filter(Boolean));
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
check('Escape closes the room', () => {
  const room = code('components/StationRoom.jsx');
  if (!/Escape/.test(room)) return 'no Escape handler — the room could trap a desktop player';
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

// ── Report ──────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n  station.test.mjs: ${pass} passed, ${fails.length} failed\n`);
  for (const f of fails) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`  station.test.mjs: ${pass} passed, 0 failed`);
