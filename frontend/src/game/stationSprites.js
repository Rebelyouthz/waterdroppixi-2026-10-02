// THE CAMP'S SPRITE SHEETS — loading and playback.
//
// Timmy generated ten 16-frame sheets for the walkable camp and they map 1:1
// onto the STATIONS table this room already had: navigation, forge, well,
// biolab, hangar, defense, the A.I.D.A. core, the floor emblem, and the hero
// idling and walking. Nothing had to be renamed on either side.
//
// ── WHY THIS IS A SEPARATE FILE AND A SEPARATE LAYER ─────────────────
// This project's standing rule is zero image assets: everything is hand-built
// SVG or drawn in code. These sheets are a TEST of whether generated art is
// better than the vector room, and a test has to be reversible. So the vector
// stations are not deleted — `SPRITES_ON` in stationRoom.js switches between
// them, and if the drawn room wins, this file goes and nothing else changes.
//
// ── THE FORMAT, MEASURED ────────────────────────────────────────────
// Every sheet is 2048x128 RGBA: sixteen 128x128 frames in one horizontal
// strip, with real anti-aliased alpha (78-96% transparent, 3-18% soft edge).
// No cutting, no background removal, no per-frame trimming — which is the
// whole reason these are usable and the earlier hand-sliced sheet was not.
//
// Three of them (biolab, defense, hangar) are byte-identical across all
// sixteen frames. That is not a fault — a building does not animate — and it
// is worth detecting so those do not burn a texture swap every frame.
import { Assets, Texture, Rectangle, Sprite } from 'pixi.js';

const BASE = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
const DIR = BASE + '/sprites/camp/';

/** sheet key -> filename. Keys match the STATIONS table's `module` ids where
 *  one exists, so a lookup never needs a translation table that can drift. */
// Environment only. The character is never a sprite — stationRoom draws the
// same hardcoded drop as combat (face, arms, weapon). Hero sheets stay on
// disk unused so this test stays reversible without loading them.
//
// The mix is wreck + people-free lounge paintings ON TOP of the hardcoded
// hall (`gStatic` stays visible underneath). Furniture sheets sit on the
// painted couches / lab / window. The NPC-filled original is never loaded.
export const CAMP_FURNITURE = {
  patrolPost: 'camp-station-navigation-16.png',
  forge:      'camp-station-forge-16.png',
  well:       'camp-station-well-16.png',
  incubator:  'camp-station-biolab-16.png',
  hangar:     'camp-station-hangar-16.png',
  rampart:    'camp-station-defense-16.png',
  core:       'camp-core-aida-16.png',
  emblem:     'camp-floor-emblem-16.png',
  portal:     'camp-station-portal-exit-16.png',
};

/** People-free atmosphere. Wreck is the anxious empty shell; restored is
 *  the finished lounge (couches, Earth window, lab) with nobody in it.
 *  Earth / lamps / floor stay as extras when those paintings are absent.
 *  The NPC-filled original is not listed here on purpose. */
export const CAMP_ATMOSPHERE = {
  wreck:       'station-mainhall-wreck-2x.png',
  restored:    'station-mainhall-restored-2x.png',
  earthWindow: 'station-earth-window-loop-16.png',
  lights:      'station-ambient-lights-16.png',
  floor:       'station-floor-tileset-2x.png',
};

export const CAMP_SHEETS = { ...CAMP_FURNITURE, ...CAMP_ATMOSPHERE };

const FRAMES = 16;

/**
 * One loaded sheet, sliced into frame textures.
 *
 * Supports both multi-frame horizontal animation strips (w >= h * 2) and
 * single-frame background shells.
 */
class Sheet {
  constructor(tex) {
    this.base = tex;
    const w = tex.width, h = tex.height;
    const isStrip = w >= h * 2;
    this.numFrames = isStrip ? FRAMES : 1;
    this.fw = isStrip ? Math.round(w / FRAMES) : w;
    this.fh = h;
    this.frames = [];
    for (let i = 0; i < this.numFrames; i++) {
      this.frames.push(new Texture({
        source: tex.source,
        frame: new Rectangle(i * this.fw, 0, this.fw, this.fh),
      }));
    }
  }
  frame(i) {
    return this.frames[((i % this.numFrames) + this.numFrames) % this.numFrames];
  }
}

/**
 * Load every camp sheet. Resolves to a map of key -> Sheet, with any sheet
 * that failed simply absent.
 *
 * Failure is deliberately SILENT AND PARTIAL rather than fatal. A missing file
 * should drop that one thing back to its drawn version, not take the room
 * down — the room is how the player reaches half the game.
 */
export async function loadCampSheets() {
  const out = {};
  await Promise.all(Object.entries(CAMP_SHEETS).map(async ([key, file]) => {
    try {
      const tex = await Assets.load(DIR + file);
      if (tex && tex.width && tex.height) out[key] = new Sheet(tex);
    } catch (e) {
      // Left out of `out`; the caller falls back to drawing it.
    }
  }));
  return out;
}

/**
 * A sprite that plays a sheet.
 *
 * `fps` is per instance because these are not all the same kind of thing: a
 * breathing core and a walking character want different clocks, and a static
 * building wants none at all.
 */
export class SheetSprite extends Sprite {
  constructor(sheet, opts = {}) {
    super(sheet.frame(0));
    this.sheet = sheet;
    this.fps = opts.fps != null ? opts.fps : 10;
    this.anchor.set(opts.ax != null ? opts.ax : 0.5, opts.ay != null ? opts.ay : 0.5);
    this._t = 0;
    this._i = 0;
    // A sheet whose frames are all identical is a still image. Detecting it
    // here rather than hard-coding a list means a sheet that GAINS animation
    // later starts animating without anyone remembering to update a table.
    this.animated = opts.animated !== false;
  }
  advance(dt) {
    if (!this.animated || this.fps <= 0 || this.sheet.numFrames <= 1) return;
    this._t += dt;
    const step = 1 / this.fps;
    while (this._t >= step) {
      this._t -= step;
      this._i = (this._i + 1) % this.sheet.numFrames;
      this.texture = this.sheet.frame(this._i);
    }
  }
  /** Distance-driven playback, for anything whose motion is travel and not
   *  time — the same rule the hand-drawn gait follows, and the reason a
   *  sprite-based walk does not moonwalk when the character slows down. */
  setPhase(p) {
    const i = Math.floor(((p % 1) + 1) % 1 * FRAMES) % FRAMES;
    if (i !== this._i) { this._i = i; this.texture = this.sheet.frame(i); }
  }
}
