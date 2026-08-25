import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  POE_TREE_NODES, POE_BRANCHES, POE_RADIAL_NODES, POE_RADIAL_INDEX, BRANCH_ANGLES, MAX_TIER, MAX_TIER_RADIUS, RADIAL_CENTER, RING_BASE,
  POE_H2O_NODES, POE_H2O_INDEX, POE_H2O_BRANCH, isTreeFullyMaxed,
} from '../game/poe_tree';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';
import { StatText } from './ToastHost';

// ─── helpers ───────────────────────────────────
// Bumped up from {18,27,40} — against the now much thicker frame + bolder
// wedges, the old sizes read as small/thin. The reference's nodes are
// chunky, substantial shapes, not fine dots on a big wheel.
const nodeRadius = { minor: 22, notable: 33, keystone: 48 };

// Looks in both the normal 65-node tree AND the hidden H2O cluster — the
// cluster's nodes live in a separate index (see poe_tree.js) since they
// aren't routed through the branch/tier layout the main tree uses.
function lookupNode(nodeId) {
  return POE_RADIAL_INDEX[nodeId] || POE_H2O_INDEX[nodeId];
}

function isUnlocked(nodeId, skills) {
  const n = lookupNode(nodeId);
  if (!n) return false;
  if (!n.req || n.req.length === 0) return true;
  return n.req.every(r => (skills[r] || 0) >= 1);
}

function branchOf(node) {
  return node.branch === 'h2o' ? POE_H2O_BRANCH : POE_BRANCHES[node.branch];
}

// ─── TreeIcon ─────────────────────────────────────
// GameIcon's glyphs are drawn as STEEL objects with the accent colour used
// only on their "live" parts — a shield is a grey shield with a coloured
// rune, a skull is bone. That is right everywhere else in the game, but on
// the skill tree it produced exactly what Timmy reported: "de har inga
// färger svart grått ibland de va därför ja sa gör färg". Passing a `tone`
// alone cannot fix it, because most of each glyph never reads the tone.
//
// So the colour is applied as a LAYER instead: a solid rect over the glyph
// in `mix-blend-mode: color`, which takes hue and saturation from the rect
// and luminance from the glyph underneath. The bevels, highlights and
// shading all survive — a steel shield becomes a *steel-blue* shield, not
// a flat blue silhouette. `isolation: isolate` on the wrapper keeps the
// blend from reaching the orb behind it.
//
// The black outline (`poe-icon-ink*`) goes on the OUTER group so it traces
// the finished, recoloured shape.
//
// FIRST ATTEMPT, AND WHY IT FAILED — worth keeping, it is a trap: a solid
// <rect> over the glyph in `mix-blend-mode: color` inside an
// `isolation: isolate` group. The blend is correct where the glyph is
// opaque, but `isolate` makes the group's own backdrop transparent, so
// everywhere the glyph is EMPTY the rect blends against nothing and paints
// itself at full strength. Every icon rendered as a coloured square tile.
// Blend modes composite against a backdrop; they do not respect the
// sibling's alpha.
//
// What works instead is a FILTER chain, because filters do respect alpha:
// flatten to grey, push through sepia to get a single known hue (~40°),
// then rotate that hue to the target and restore saturation. Luminance —
// every bevel, highlight and shadow the glyph was drawn with — survives.
// The black outline is appended to the same chain so it traces the
// finished, recoloured shape and costs no extra filter region.
function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function TreeIcon({ name, size, tone, big }) {
  const ink = big ? 1.6 : 1;
  const outline =
    `drop-shadow(${ink}px 0 0 #000) drop-shadow(-${ink}px 0 0 #000) ` +
    `drop-shadow(0 ${ink}px 0 #000) drop-shadow(0 -${ink}px 0 #000)`;
  let filter = outline;
  if (tone) {
    const [h, s] = hexToHsl(tone);
    // sepia lands the whole image near 40°; rotate from there to the target.
    const rot = Math.round(h - 40);
    // Saturation below ~0.35 (bone, steel-white) should stay desaturated,
    // or a near-white icon turns into a vivid one.
    const sat = (1.1 + s * 2.6).toFixed(2);
    filter = `grayscale(1) brightness(1.05) sepia(1) hue-rotate(${rot}deg) saturate(${sat}) ${outline}`;
  }
  return (
    <g style={{ pointerEvents: 'none', filter }}>
      <GameIcon name={name} size={size} tone={tone} />
    </g>
  );
}

// ─── Branch label position (outer ring, along the branch's base angle) ──
const RING_LABEL_R = MAX_TIER_RADIUS + 100;
const branchLabelPos = {};
for (const [key] of Object.entries(POE_BRANCHES)) {
  const a = BRANCH_ANGLES[key];
  branchLabelPos[key] = { x: RADIAL_CENTER + RING_LABEL_R * Math.cos(a), y: RADIAL_CENTER + RING_LABEL_R * Math.sin(a), angle: a };
}

// ─── Smooth background color ring ───────────────
// Timmy: the old per-branch background was 10 flat, hard-edged pie
// wedges — "de ser ut som ett lycky wheel" (looks like a lucky wheel).
// This bakes a fine-grained ring of thin slices whose color LERPS
// between each branch's own color and its neighbors', so the background
// reads as one continuous aurora-like gradient sweeping around the
// circle instead of a spin-wheel's hard segment seams. Each branch's
// pure color still lands exactly at that branch's own angle (same
// position `BRANCH_ANGLES` already uses) — this only smooths the
// TRANSITION between them, it doesn't move anything.
const hexToRgb = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const lerpColor = (c1, c2, t) => {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const shade = (hex, t) => lerpColor(hex, '#000000', t);
const tint  = (hex, t) => lerpColor(hex, '#ffffff', t);

// ─── Tree-local icon palette ──────────────────────
// Timmy, 2026-08-17: "de ska va unikt i skillträdet loggorna är annorlunda
// där ... du använder dom som är men ändra färg på dom men inte så de
// ändras överallt lixom om de används på fler ställen", and earlier:
// "hjärtat ska ha svart ram å va rött ... löven gröna ... alla loggor ska
// ha färg som passar loggan å som inte är samma som lyset å bakgrunden".
//
// GameIcon resolves its colour as `tone || ICONS[name][1]`, so passing a
// tone here overrides the icon's global colour for THIS SCREEN ONLY —
// every other screen keeps the shared table untouched. That is the whole
// reason this is a local map and not an edit to GameIcon.jsx.
//
// Two rules behind the values:
//   1. The colour has to suit the GLYPH, not the branch — a heart is red
//      wherever it appears, a leaf is green, a skull is bone.
//   2. Twelve of these had no ICONS entry at all and were falling back to
//      GameIcon's default blue (#6cb4ff), so Earthshaker's explosion,
//      the trident, the boot and the tornado were all rendering the same
//      generic blue. They are given real colours here for the first time.
const TREE_ICON_TONE = {
  // organic / life
  heart:        '#ff3146',
  ui_leaf:      '#7ad96b',
  pVamp:        '#ff5c8a',
  ui_pets:      '#ffb066',
  // light / energy
  ui_star:      '#fff3b0',
  starBurst:    '#ffe27a',
  pHoly:        '#fff4c2',
  fireRateMult: '#ffe08a',
  ui_flame:     '#ff7a1a',
  pExplode:     '#ff8a2a',
  areaMult:     '#c98bff',
  ui_orb:       '#c08bff',
  doubleHit:    '#ff7a6b',
  // metal / weapons
  ui_blade:     '#dce8f5',
  trident:      '#ffb84d',
  harpoon:      '#a8dcff',
  ui_shield:    '#c2d8f0',
  part_sight:   '#bdf0ff',
  // water / air / motion
  ui_waterdrop: '#5ecdff',
  pWave:        '#5fb8ff',
  tornado:      '#b6dcff',
  pQuick:       '#8dffe6',
  boot:         '#d2ae7e',
  ui_ghost:     '#d8caff',
  // dark / arcane
  ui_void:      '#b98bff',
  ui_skull:     '#e8e2d2',
  ui_eye:       '#ffd6ea',
  // treasure / utility
  gold:         '#ffe27a',
  gbCrown:      '#ffd75e',
  ui_chest:     '#ffc389',
  ui_gem:       '#5cffe0',
  ui_clock:     '#9fe8ff',
  ui_codex:     '#e8d49a',
  pMagnet:      '#ff7a5c',
};

// Perceptual-ish distance, weighted the way the eye actually weighs the
// channels (green carries most of the luminance). Cheap, and good enough
// to answer the only question asked of it: "would these two read as the
// same colour sitting on top of each other?"
function colorGap(a, b) {
  const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2);
}

// The same icon key appears on several branches — `ui_star` is used eight
// times — so a fixed colour per icon cannot know what it will sit on. This
// resolves that at render: keep the glyph's own colour unless it is too
// close to the orb underneath it, and only then push it apart. Timmy's
// example was exactly this case: "stjärnorna tex gör dom en annan gul än
// de gula bakom".
//
// Pushing toward white rather than toward a hue keeps the icon reading as
// itself — a lighter yellow star is still a yellow star; a blue one is a
// different icon.
function iconToneFor(iconKey, branchColor) {
  const base = TREE_ICON_TONE[iconKey];
  if (!base) return undefined;               // fall through to GameIcon's own
  const gap = colorGap(base, branchColor);
  if (gap > 150) return base;
  // 0 gap → full lift, 150 → none.
  return tint(base, 0.60 * (1 - gap / 150));
}

// ─── "You got stronger" readout ───────────────────
// Timmy: buying a node should show the gain the way Meta Upgrades does
// (green arrow, stat name, number) but with the Skill Tree's OWN
// presentation, not a copy of it.
//
// Every stat id actually used in poe_tree.js is covered. Anything not
// listed falls through to the node's own name, which is always correct
// even if it is less specific — better a right label than a wrong one.
// The FLAT set exists because `val` alone cannot tell you the unit:
// `maxHp: 3` is three hit points, `dmg: 0.02` is two percent, and both
// are just numbers.
const STAT_FLAT = new Set(['pierce', 'proj', 'maxHp', 'armor', 'regen', 'shield', 'revive']);
const STAT_LABEL = {
  dmg: 'DAMAGE', crit: 'CRIT CHANCE', critd: 'CRIT DAMAGE', pierce: 'PIERCE',
  proj: 'PROJECTILES', mspd: 'MOVE SPEED', dodge: 'DODGE', dashcd: 'DASH COOLDOWN',
  maxHp: 'MAX HP', armor: 'ARMOR', regen: 'REGEN', shield: 'SHIELD', revive: 'REVIVE',
  gold: 'GOLD FIND', xp: 'XP GAIN', pickup: 'PICKUP RANGE', luck: 'LUCK',
  atks: 'ATTACK SPEED', area: 'AREA', bossDmg: 'BOSS DAMAGE',
  elementalDmg: 'ELEMENTAL DAMAGE', headshot: 'HEADSHOT CHANCE',
  superCrit: 'SUPER CRIT', megaCrit: 'MEGA CRIT',
  // Flags/unlocks — these grant a capability, not a number.
  dash: 'DASH', swipeAttack: 'SWIPE STRIKE', blink: 'BLINK', berserk: 'BERSERKER',
  chestSense: 'CHEST SENSE', voidBurst: 'VOID BURST', forksUnlocked: 'FORKED SHOTS',
  undertowDash: 'UNDERTOW DASH', riptideMastery: 'RIPTIDE MASTERY',
  secondWind: 'SECOND WIND', autoProjectile: 'AUTO PROJECTILES',
  deluge: 'DELUGE', undyingTide: 'UNDYING TIDE', dualGuns: 'DUAL GUNS',
};
// `dashcd` is the one inverted stat in the tree: its value is a REDUCTION,
// so "-10% dash cooldown" is a gain and must still read green. Getting this
// backwards is exactly the bug the level-up cards already had once.
const STAT_INVERTED = new Set(['dashcd']);
function statGainText(node) {
  const label = STAT_LABEL[node.stat] || node.name.toUpperCase();
  if (node.val == null) return { label, amount: 'UNLOCKED' };
  if (STAT_FLAT.has(node.stat)) {
    const v = node.val;
    return { label, amount: `+${v % 1 === 0 ? v : v.toFixed(2).replace(/0$/, '')}` };
  }
  if (node.val >= 1) return { label, amount: 'UNLOCKED' };
  const pct = Math.round(node.val * 1000) / 10;
  return { label, amount: `${STAT_INVERTED.has(node.stat) ? '-' : '+'}${pct}%` };
}

const _branchKeyList = Object.keys(POE_BRANCHES);

// ─── Orb palette ──────────────────────────────────
// Every node's glass body, halo and dead/locked state is a gradient looked
// up by branch key. SVG gradients can't take a colour parameter, so the
// full set is baked once per branch instead of once per node — 82 nodes
// share 33 defs. `h2o` is folded in here because the hidden capstone
// cluster is deliberately not a member of POE_BRANCHES (adding it there
// would reflow every branch's angle — see poe_tree.js).
const ORB_PALETTE = [
  ...Object.entries(POE_BRANCHES).map(([k, b]) => [k, b.color]),
  ['h2o', POE_H2O_BRANCH.color],
];
// ─── Starfield ────────────────────────────────────
// Timmy's reference: a deep cosmic nebula/starfield BEHIND the wheel
// (from the "bakgrunden är bra" reference image — explicitly just its
// background, not its fire-ring or wheel style). Fixed random set,
// generated once at module load so stars don't jump around on re-render.
// `d`/`t` drive a per-star twinkle (duration / phase offset) so the field
// breathes instead of sitting dead — the cheapest possible "the background
// is alive" cue, since it animates opacity only and touches no layout.
const STARFIELD = Array.from({ length: 160 }).map(() => ({
  x: Math.random() * 3600 - 300,
  y: Math.random() * 3600 - 300,
  r: Math.random() * 1.6 + 0.4,
  o: Math.random() * 0.55 + 0.15,
  d: 2.6 + Math.random() * 5.5,
  t: -Math.random() * 8,
}));

// ─── Living background: light shafts ──────────────
// Two or three tapered beams inside each branch wedge, sweeping outward
// from the core. Fixed pseudo-random offsets baked at module load (not
// re-rolled per render) so they never jump between frames.
const WEDGE_SHAFTS = Object.keys(POE_BRANCHES).flatMap((key, bi) =>
  Array.from({ length: 3 }).map((_, i) => ({
    key, bi, i,
    off: (i - 1) * 0.34 + (((bi * 7 + i * 13) % 10) / 10 - 0.5) * 0.22,
    w: 0.020 + (((bi * 3 + i * 5) % 7) / 7) * 0.03,
    delay: -((bi * 1.7 + i * 2.9) % 9),
  }))
);

// ─── Living background: core corona rays ──────────
// The wheel's core is the light source every node's shading implies — so
// it has to actually emit something, or the top-left lighting on 82 orbs
// reads as arbitrary. 30 tapered rays, rotating as one group.
const CORE_RAYS = Array.from({ length: 30 }).map((_, i) => ({
  a: (i / 30) * Math.PI * 2,
  len: 46 + ((i * 37) % 40),
  w: 0.008 + ((i * 11) % 5) * 0.004,
}));

// ─── Ornate frame ring accents ────────────────────
// ─── The wheel's frame: wood, metal, vegetation ───
// Timmy: "hjulet ska också ha ram men på sitt vis de ska va metal trä å
// växtlighet kolla referensbilderna."
//
// Built as: two metal hoops (outer + inner) holding a wide WOOD band
// between them, bolted at intervals, with a vine creeping over the whole
// thing. Nothing here is a texture — this project ships no image assets —
// so the wood is grain arcs at jittered radii, and the vine is a single
// polar sine path with leaves hung off its crests. All of it is generated
// once at module load, never per render.
const FRAME_R  = MAX_TIER_RADIUS + 86;   // band centreline
const FRAME_BW = 64;                     // total band width

// Grain: thin arcs at jittered radii inside the band, each covering a
// random span of the circle. Real wood grain is long and roughly parallel
// to the edge, with occasional breaks — that is exactly what a set of
// partial arcs at slightly different radii looks like.
const WOOD_GRAIN = Array.from({ length: 64 }).map((_, i) => {
  const s = (i * 2654435761) >>> 0;              // cheap deterministic hash
  const f1 = ((s >>> 8) & 1023) / 1023;
  const f2 = ((s >>> 18) & 1023) / 1023;
  const f3 = ((s >>> 3) & 255) / 255;
  return {
    r: FRAME_R + (f1 - 0.5) * (FRAME_BW * 0.72),
    a0: f2 * Math.PI * 2,
    span: 0.25 + f3 * 1.5,
    w: 0.8 + f3 * 2.4,
    o: 0.10 + f1 * 0.26,
  };
});

// Bolts holding the metal hoops onto the wood. Two per position, one on
// each hoop, so the hoops read as fastened rather than painted on.
const FRAME_BOLTS = Array.from({ length: 40 }).map((_, i) => (i / 40) * Math.PI * 2);

// The vine: one continuous path weaving across the band, plus leaves at
// its crests. `WAVES` must be a whole number or the path will not close.
const VINE_WAVES = 9;
const VINE_AMP = FRAME_BW * 0.40;
const VINE_PATH = (() => {
  const pts = [];
  const N = 540;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const th = t * Math.PI * 2;
    const r = FRAME_R + Math.sin(th * VINE_WAVES) * VINE_AMP;
    pts.push(`${(RADIAL_CENTER + r * Math.cos(th)).toFixed(1)},${(RADIAL_CENTER + r * Math.sin(th)).toFixed(1)}`);
  }
  return 'M ' + pts.join(' L ') + ' Z';
})();
// Leaves sit where the vine is furthest from the centreline — the crests —
// alternating inside and outside, which is what stops it reading as a
// mechanical zig-zag.
const VINE_LEAVES = Array.from({ length: VINE_WAVES * 2 }).map((_, i) => {
  const th = ((i + 0.5) / (VINE_WAVES * 2)) * Math.PI * 2;
  const out = i % 2 === 0;
  const r = FRAME_R + (out ? VINE_AMP : -VINE_AMP);
  return {
    x: RADIAL_CENTER + r * Math.cos(th),
    y: RADIAL_CENTER + r * Math.sin(th),
    rot: (th * 180) / Math.PI + (out ? 26 : -154),
    s: 0.82 + ((i * 37) % 10) / 22,
  };
});

// ─── Connection list ────────────────────────────
const CONNECTIONS = [];
for (const node of POE_TREE_NODES) {
  for (const reqId of (node.req || [])) {
    CONNECTIONS.push({ from: reqId, to: node.id, branch: node.branch });
  }
}
// Same shape, just for the 4 ring→core edges of the H2O cluster — kept
// separate so it can be left out of the render entirely while hidden.
const H2O_CONNECTIONS = [];
for (const node of POE_H2O_NODES) {
  for (const reqId of (node.req || [])) {
    H2O_CONNECTIONS.push({ from: reqId, to: node.id, branch: 'h2o' });
  }
}

// ══════════════════════════════════════════════════════
export default function SkillTree({ save, setSave, onClose }) {
  const containerRef = useRef();
  const [scale, setScale] = useState(0.38);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  // Purchase feedback: `buyFx` is the single node currently playing its
  // seat animation; `gains` is the (usually 0-1, occasionally 2-3 on fast
  // clicking) list of floating stat readouts in flight.
  // Canvas size, for the parallax maths. Measured rather than assumed —
  // the panel is a flex child whose width changes when the inspect card
  // opens, so a one-off read on mount would go stale.
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [buyFx, setBuyFx] = useState(null);
  const [gains, setGains] = useState([]);
  const fxKey = useRef(1);
  const dragState = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false });
  const initialized = useRef(false);

  const skills = save.skills || {};

  // ── Framing on open ──────────────────────────────
  // Two different jobs depending on the screen.
  //
  // Desktop: fit the whole 360° wheel, because you can see it and a mouse
  // can hit a 12px node.
  //
  // Phone: DON'T. A circle can never be wider than the viewport, so on a
  // 390px-wide phone the fit-everything scale lands around 0.12 — which
  // makes a minor node about 5px across and leaves two big dead bands
  // above and below the wheel. That is the concrete form of the doubt
  // Timmy raised ("de får inte plats på telefon alls"): the wheel does
  // fit, it just isn't usable once it does. So on a narrow viewport this
  // opens zoomed to a real touch target instead, centred on the FRONTIER —
  // the average position of the nodes you can actually buy right now,
  // which is where a returning player wants to be. `fitAll` below is the
  // way back out to the overview.
  const fitAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;
    const diameter = (MAX_TIER_RADIUS + 170) * 2;
    const s = Math.max(0.08, Math.min(0.85, Math.min(rect.width, rect.height) * 0.94 / diameter));
    setScale(s);
    setPan({ x: rect.width / 2 - RADIAL_CENTER * s, y: rect.height / 2 - RADIAL_CENTER * s });
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return; // not laid out yet, retry
    const diameter = (MAX_TIER_RADIUS + 170) * 2;
    const fitScale = Math.min(rect.width, rect.height) * 0.94 / diameter;
    const isNarrow = rect.width < 620;

    // 44px is the standard minimum touch target; a minor node is r=22 in
    // world units, so scale 1.0 is exactly 44px across. 0.72 lands a minor
    // at ~32px and a keystone at ~69px — tappable without so much zoom
    // that you lose all sense of which branch you're in.
    const initScale = isNarrow
      ? 0.72
      : Math.max(0.12, Math.min(0.85, fitScale));

    let fx = RADIAL_CENTER, fy = RADIAL_CENTER;
    if (isNarrow) {
      const frontier = POE_RADIAL_NODES.filter(n =>
        isUnlocked(n.id, skills) && (skills[n.id] || 0) < n.max);
      if (frontier.length) {
        fx = frontier.reduce((a, n) => a + n.rx, 0) / frontier.length;
        fy = frontier.reduce((a, n) => a + n.ry, 0) / frontier.length;
      }
    }
    setPan({ x: rect.width / 2 - fx * initScale, y: rect.height / 2 - fy * initScale });
    setScale(initScale);
    initialized.current = true;
    // `skills` is read once to pick the opening frame; re-running this on
    // every purchase would yank the view out from under the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wheel zoom ───────────────────────────────────
  // Throttled to at most one state update per animation frame — the SVG
  // has ~65 nodes plus glow filters, and firing a full re-render on every
  // single wheel tick (a fast scroll can fire 20+ in one gesture) was
  // heavy enough to freeze/crash the tab. rAF-batching + a CSS transform
  // (instead of the SVG transform attribute, which forces a full filter
  // repaint every change) fixes that.
  const wheelPending = useRef(null);
  // Separate from wheelPending itself — the pending object gets REPLACED
  // (not mutated) on every wheel tick to accumulate delta, so a "scheduled"
  // flag stored on that object is lost whenever a second tick arrives
  // before the rAF fires, letting a second rAF get scheduled. When both
  // then fire, the first one nulls out wheelPending.current and the second
  // crashes destructuring null. A fast scroll burst (the comment below says
  // 20+ ticks in one gesture) hits this reliably, and with no ErrorBoundary
  // anywhere in the app an uncaught error here unmounts the whole game, not
  // just this screen. A dedicated ref that isn't tied to the pending
  // object's identity closes the race.
  const wheelRafScheduled = useRef(false);
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.12 : 0.9;
    wheelPending.current = { mx, my, delta: (wheelPending.current?.delta || 1) * delta };
    if (wheelRafScheduled.current) return;
    wheelRafScheduled.current = true;
    requestAnimationFrame(() => {
      wheelRafScheduled.current = false;
      const pending = wheelPending.current;
      wheelPending.current = null;
      if (!pending) return;
      const { mx: fmx, my: fmy, delta: fdelta } = pending;
      setScale(prev => {
        const ns = Math.max(0.08, Math.min(2.6, prev * fdelta));
        const ratio = ns / prev;
        setPan(p => ({ x: fmx - ratio * (fmx - p.x), y: fmy - ratio * (fmy - p.y) }));
        return ns;
      });
    });
  }, []);

  // ── Touch pan + pinch-zoom ────────────────────────
  // No touch handlers existed before — on mobile the browser's native
  // touch scroll / pull-to-refresh gesture took over the drag/pinch,
  // which is what was reloading the page. touchAction:'none' (CSS) +
  // preventDefault() here fully suppress that native behavior.
  // NOTE: calling preventDefault() on touchstart/move also kills the
  // browser's normal synthetic "click" it fires after a tap — that's why
  // nodes stopped being selectable/buyable on touch. Fixed below by
  // manually dispatching a real click on tap instead of relying on it.
  const touchState = useRef({ mode: null, lastX: 0, lastY: 0, lastDist: 0, startX: 0, startY: 0 });
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const { clientX, clientY } = e.touches[0];
      touchState.current = { mode: 'pan', lastX: clientX, lastY: clientY, startX: clientX, startY: clientY };
    } else if (e.touches.length === 2) {
      touchState.current = { mode: 'pinch', lastDist: dist(e.touches[0], e.touches[1]) };
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    const ts = touchState.current;
    if (ts.mode === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - ts.lastX;
      const dy = e.touches[0].clientY - ts.lastY;
      ts.lastX = e.touches[0].clientX; ts.lastY = e.touches[0].clientY;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (ts.mode === 'pinch' && e.touches.length === 2) {
      const nd = dist(e.touches[0], e.touches[1]);
      const ratio = nd / (ts.lastDist || nd);
      ts.lastDist = nd;
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const mx = rect ? (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left : 0;
      const my = rect ? (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top : 0;
      setScale(prev => {
        const ns = Math.max(0.08, Math.min(2.6, prev * ratio));
        const r = ns / prev;
        setPan(p => ({ x: mx - r * (mx - p.x), y: my - r * (my - p.y) }));
        return ns;
      });
    }
  }, []);

  const onTouchEnd = useCallback((e) => {
    e.preventDefault();
    const ts = touchState.current;
    if (ts.mode === 'pan' && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const moved = Math.hypot(t.clientX - ts.startX, t.clientY - ts.startY);
      // A real tap (barely moved) — the browser won't fire its own click
      // because we preventDefault()'d the touch, so fire one ourselves at
      // the exact tap point. This is what lets nodes be selected/bought.
      if (moved < 8) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY }));
      }
    }
    if (e.touches.length === 0) touchState.current = { mode: null };
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    c.addEventListener('touchstart', onTouchStart, { passive: false });
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    c.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      c.removeEventListener('wheel', handleWheel);
      c.removeEventListener('touchstart', onTouchStart);
      c.removeEventListener('touchmove', onTouchMove);
      c.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleWheel, onTouchStart, onTouchMove, onTouchEnd]);

  // ── Mouse pan ────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    dragState.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
  };
  const onMouseMove = (e) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragState.current.moved = true;
    setPan({ x: dragState.current.startPanX + dx, y: dragState.current.startPanY + dy });
  };
  const onMouseUp = () => { dragState.current.active = false; };

  // ── Buy node ─────────────────────────────────────
  // Timmy's brief for this moment, verbatim: "när man köper node ett unikt
  // dopamin juice ljud å animering de ska animera lite på noden även
  // tändas så man vet man köpt den men en snabb typ lyft och sätt ner i
  // sloten noden sitter i ... de ska va dopamin å kännas som man verkligen
  // växer för var node".
  //
  // So one purchase fires four things at once, and they are deliberately
  // staged rather than simultaneous:
  //   · the SOUND leads (seat thunk, then a rising run) — audio arriving
  //     first is what makes a UI feel responsive rather than laggy;
  //   · the ORB lifts out of its socket and drops back in, lighting as it
  //     lands (`.poe-node-seat`, ~620ms);
  //   · the STAT rises off the node in green with an arrow;
  //   · a SHOCKWAVE ring pushes out through the connectors, so the gain
  //     visibly travels into the branch rather than stopping at the node.
  const buyNode = (node) => {
    if (!isUnlocked(node.id, skills)) { Audio?.skillDenied?.(); return; }
    const lvl = skills[node.id] || 0;
    if (lvl >= node.max) return;
    if (save.sp < node.c) { Audio?.skillDenied?.(); showToast('NOT ENOUGH SP'); return; }

    const nextLvl = lvl + 1;
    const willMax = nextLvl >= node.max;
    const next = { ...save, sp: save.sp - node.c, skills: { ...save.skills, [node.id]: nextLvl } };
    // A node carrying `unlockSkill` hands the player an ACTIVE_SKILL —
    // something you learn and then press, not another passive number.
    // Written into the SAME `save.unlockedActives` map the card shop uses
    // (CampPanels.jsx reads it to build the equip list), so the ability
    // shows up in the existing loadout UI with no parallel system.
    if (node.unlockSkill) {
      next.unlockedActives = { ...(save.unlockedActives || {}), [node.unlockSkill]: true };
    }
    setSave(next);
    Audio?.skillBuy?.(node.type, willMax);

    // `key` (not just the id) so buying the same node twice in a row
    // re-triggers the CSS animation — React reuses the element otherwise and
    // an identical className change does not restart it.
    setBuyFx({ id: node.id, key: fxKey.current++ });
    const { label, amount } = statGainText(node);
    const gain = {
      key: fxKey.current++, x: node.rx, y: node.ry,
      label, amount, color: branchOf(node).color, maxed: willMax,
    };
    setGains(g => [...g, gain]);
    // 1500ms matches the CSS float duration; anything shorter cuts the text
    // off mid-rise.
    setTimeout(() => setGains(g => g.filter(e => e.key !== gain.key)), 1500);
    setTimeout(() => setBuyFx(b => (b && b.id === node.id ? null : b)), 700);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1400);
  };

  // ── Node click ───────────────────────────────────
  const onNodeClick = (e, node) => {
    e.stopPropagation();
    if (dragState.current.moved) return;
    // Deselecting is a "back" action and gets the back sound; selecting a
    // node gets the tier-pitched tick. Same reasoning as the menu pair —
    // direction of travel is what the sound is for.
    if (selected?.id === node.id) Audio?.menuBack?.();
    else Audio?.skillHover?.(node.type);
    setSelected(prev => prev?.id === node.id ? null : node);
  };

  // ── Screen enter / leave sounds ──────────────────
  // Opening the tree is "going in", closing it is "going back" — the pair
  // Timmy asked to hear across every menu. Wired here rather than in
  // Camp.jsx so the sound belongs to the screen that owns the transition.
  useEffect(() => { Audio?.menuOpen?.(); }, []);

  // Keep the parallax maths fed with the real canvas size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const read = () => {
      const r = el.getBoundingClientRect();
      setVp(prev => (prev.w === r.width && prev.h === r.height
        ? prev                       // same size — skip the re-render
        : { w: r.width, h: r.height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const closeTree = useCallback(() => { Audio?.menuBack?.(); onClose(); }, [onClose]);

  // ── Parallax ─────────────────────────────────────
  // A background layer at depth `d` (0 = pinned to the screen, 1 = welded
  // to the wheel) zooms less AND drifts less than the tree.
  //
  // The pan cannot simply be `pan * d`. The layer has to stay REGISTERED
  // to the wheel — its centre must track the wheel's centre, just at a
  // reduced rate — otherwise the starfield slides out from behind the
  // wheel entirely after a few drags. So solve for the translation that
  // puts this layer's RADIAL_CENTER where we want it on screen:
  //
  //   wheelCentreOnScreen = pan + RADIAL_CENTER * scale
  //   wantOnScreen        = viewportCentre + (wheelCentreOnScreen - viewportCentre) * d
  //   layerPan            = wantOnScreen - RADIAL_CENTER * layerScale
  //
  // `vp` is measured, not assumed: with a zero fallback the first paint
  // before the ResizeObserver fires still lands the layers sensibly
  // rather than throwing the field off-screen.
  const parallax = useCallback((d) => {
    const layerScale = scale * (0.62 + 0.38 * d);   // far layers zoom less
    const vcx = vp.w / 2, vcy = vp.h / 2;
    const wx = pan.x + RADIAL_CENTER * scale;
    const wy = pan.y + RADIAL_CENTER * scale;
    const lx = vcx + (wx - vcx) * d - RADIAL_CENTER * layerScale;
    const ly = vcy + (wy - vcy) * d - RADIAL_CENTER * layerScale;
    return `translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px) scale(${layerScale.toFixed(4)})`;
  }, [pan.x, pan.y, scale, vp.w, vp.h]);

  const selNode = selected ? lookupNode(selected.id) : null;
  const selLvl  = selNode ? (skills[selNode.id] || 0) : 0;
  const selBranch = selNode ? branchOf(selNode) : null;
  const selCanBuy = selNode && isUnlocked(selNode.id, skills) && selLvl < selNode.max && save.sp >= selNode.c;
  const selLocked = selNode && !isUnlocked(selNode.id, skills);
  // Every node in the main tree is at max level — the H2O cluster reveals.
  const h2oUnlocked = isTreeFullyMaxed(skills);

  return (
    <div className="poe-overlay" data-testid="skill-tree" onClick={(e) => { if (e.target === e.currentTarget) closeTree(); }}>
      <div className="poe-panel">

        {/* ── Top Bar ── */}
        <div className="poe-topbar">
          <div className="poe-topbar-left">
            <span className="poe-title">SKILL TREE</span>
            <span className="poe-sp">◆ {save.sp} SP</span>
            <span className="poe-hint">Drag to pan · Scroll to zoom · Click to inspect</span>
          </div>
          <div className="poe-topbar-right">
            <button className="poe-close-btn" onClick={closeTree} data-testid="st-close">✕</button>
          </div>
        </div>

        {/* ── Main body ── */}
        <div className="poe-body">

          {/* ── SVG Canvas ── */}
          <div
            ref={containerRef}
            className="poe-canvas"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ cursor: dragState.current.active ? 'grabbing' : 'grab' }}
          >
            <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <filter id="poe-glow">
                  <feGaussianBlur stdDeviation="6" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="poe-glow-hard">
                  <feGaussianBlur stdDeviation="8" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                {/* ══ NODE MATERIAL SYSTEM ═══════════════════════════
                    Built against Timmy's zoomed reference ("inzoomad
                    skilträd ... så du ska se frame å nodes å slots till
                    nodes bättre"): every node is a GLASS ORB seated in a
                    METAL BEZEL, which sits in a CRATER carved into the
                    surface. Three materials, three different lighting
                    rules — getting those rules right is the whole job:

                      · sphere — lit from the top-left, so the hot spot is
                        top-left and the terminator runs bottom-right. The
                        tell that separates glass from a flat disc is that
                        the very edge brightens BACK UP past the terminator
                        (light bouncing in off the surroundings). Every
                        `orb-*` gradient below ends on a lighter stop than
                        the one before it for exactly that reason.
                      · crater — a hole lit from the top-left is the
                        INVERSE of a sphere: the far (bottom-right) wall
                        catches the light, the near (top-left) lip is in
                        shadow. The previous version lit the socket from
                        the top-left like the orb, which is why it read as
                        a bump rather than a hollow. Fixed here.
                      · bezel — a torus, so it needs a diagonal sweep with
                        TWO bright bands: the direct highlight top-left and
                        a weaker bounce on the underside, with the darkest
                        band between them.

                    No per-node filters. The old build hung a
                    feGaussianBlur `poe-glow` on every one of ~82 node
                    groups; each of those allocates its own offscreen
                    buffer and repaints on every pan/zoom frame, which is
                    the bulk of what made this screen heavy. The glow is a
                    plain radial-gradient halo circle instead — no buffer,
                    no repaint cost, and it actually falls off more
                    naturally than a Gaussian blur of a hard-edged disc. */}
                {ORB_PALETTE.map(([k, color]) => (
                  <React.Fragment key={`orbdef-${k}`}>
                    {/* Live glass: white-hot core → branch colour →
                        terminator → rim bounce. */}
                    <radialGradient id={`orb-${k}`} cx="33%" cy="27%" r="76%">
                      <stop offset="0%"   stopColor="#ffffff" />
                      <stop offset="14%"  stopColor={tint(color, 0.62)} />
                      <stop offset="38%"  stopColor={tint(color, 0.12)} />
                      <stop offset="66%"  stopColor={shade(color, 0.34)} />
                      <stop offset="88%"  stopColor={shade(color, 0.74)} />
                      <stop offset="100%" stopColor={shade(color, 0.42)} />
                    </radialGradient>
                    {/* Unlit glass — same sphere, no internal light. Still
                        a gem with a readable hue, NOT a black hole: the
                        reference's locked nodes are visibly dark stones in
                        iron rings, and the previous near-black fill at 0.4
                        group opacity made half the wheel disappear. */}
                    <radialGradient id={`orbdead-${k}`} cx="33%" cy="27%" r="76%">
                      <stop offset="0%"   stopColor={shade(color, 0.42)} />
                      <stop offset="40%"  stopColor={shade(color, 0.66)} />
                      <stop offset="82%"  stopColor={shade(color, 0.87)} />
                      <stop offset="100%" stopColor={shade(color, 0.58)} />
                    </radialGradient>
                    {/* Halo — the filter-free replacement for poe-glow. */}
                    <radialGradient id={`halo-${k}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%"   stopColor={tint(color, 0.3)} stopOpacity="0.55" />
                      <stop offset="30%"  stopColor={color} stopOpacity="0.34" />
                      <stop offset="62%"  stopColor={color} stopOpacity="0.11" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </radialGradient>
                  </React.Fragment>
                ))}
                {/* Bezel metal. objectBoundingBox units, so each node's own
                    circle re-orients this to its own box — one def, 82
                    correctly-lit rings. */}
                <linearGradient id="poe-bezel" x1="14%" y1="0%" x2="86%" y2="100%">
                  <stop offset="0%"   stopColor="#f2e4c0" />
                  <stop offset="16%"  stopColor="#c9a463" />
                  <stop offset="38%"  stopColor="#6d5230" />
                  <stop offset="58%"  stopColor="#2e2113" />
                  <stop offset="80%"  stopColor="#8a6c40" />
                  <stop offset="100%" stopColor="#241a0e" />
                </linearGradient>
                {/* Locked = cold, unpolished iron. Deliberately much darker
                    than the bronze: at the first live check these two read
                    as almost equally prominent, so a locked node competed
                    for attention with a node you can actually buy. Metal
                    VALUE is what separates them, not just hue. */}
                <linearGradient id="poe-bezel-dead" x1="14%" y1="0%" x2="86%" y2="100%">
                  <stop offset="0%"   stopColor="#4d5262" />
                  <stop offset="18%"  stopColor="#2b3040" />
                  <stop offset="42%"  stopColor="#171b26" />
                  <stop offset="62%"  stopColor="#0b0d14" />
                  <stop offset="82%"  stopColor="#232838" />
                  <stop offset="100%" stopColor="#06070b" />
                </linearGradient>
                {/* Wood for the frame plank. Deliberately much darker and
                    browner than `poe-bezel` — if the wood and the metal sit
                    in the same value range they merge into one material and
                    the whole "wood band held by metal hoops" read is lost.
                    Same top-left light direction as everything else. */}
                <linearGradient id="poe-wood" x1="14%" y1="0%" x2="86%" y2="100%">
                  <stop offset="0%"   stopColor="#8a6136" />
                  <stop offset="18%"  stopColor="#5f4022" />
                  <stop offset="45%"  stopColor="#3a2612" />
                  <stop offset="66%"  stopColor="#1e1308" />
                  <stop offset="86%"  stopColor="#4a3119" />
                  <stop offset="100%" stopColor="#150c04" />
                </linearGradient>
                {/* Living growth over the frame. Lit from the same side, so
                    the leaves catch light on their upper-left edge like
                    every other surface here. */}
                <linearGradient id="poe-vine" x1="10%" y1="0%" x2="90%" y2="100%">
                  <stop offset="0%"   stopColor="#9fe86a" />
                  <stop offset="35%"  stopColor="#57a83e" />
                  <stop offset="72%"  stopColor="#2c6425" />
                  <stop offset="100%" stopColor="#143a17" />
                </linearGradient>
                <linearGradient id="poe-bezel-gold" x1="14%" y1="0%" x2="86%" y2="100%">
                  <stop offset="0%"   stopColor="#fffdf0" />
                  <stop offset="15%"  stopColor="#ffe89a" />
                  <stop offset="38%"  stopColor="#c69320" />
                  <stop offset="58%"  stopColor="#5c410a" />
                  <stop offset="80%"  stopColor="#ffd970" />
                  <stop offset="100%" stopColor="#463005" />
                </linearGradient>
                {/* Crater — lit bottom-right (see the note above). */}
                <radialGradient id="poe-crater" cx="68%" cy="74%" r="80%">
                  <stop offset="0%"   stopColor="#5b4a82" stopOpacity="0.38" />
                  <stop offset="30%"  stopColor="#1d1436" stopOpacity="0.72" />
                  <stop offset="70%"  stopColor="#070414" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.97" />
                </radialGradient>
                {/* The crater's raised outer LIP is a rim facing the light,
                    so it runs the opposite way to the hollow it surrounds:
                    bright top-left, shadowed bottom-right — same direction
                    as the bezel. Those two opposed sweeps are what make the
                    socket read as a hole with a raised edge. */}
                <linearGradient id="poe-lip" x1="14%" y1="0%" x2="86%" y2="100%">
                  <stop offset="0%"   stopColor="#8b78c0" stopOpacity="0.5" />
                  <stop offset="34%"  stopColor="#2a1f4c" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.9" />
                </linearGradient>
                {/* Specular catch-light — soft-edged, not a hard white
                    ellipse. Sharpest in the middle, gone by the rim. */}
                <radialGradient id="poe-spec" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="45%"  stopColor="#ffffff" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>

                {/* ══ LIVING BACKGROUND ═══════════════════════════════
                    Timmy: "gör så bakgrund lever och även ljus och skugga
                    och effecter juice ska de va". Four layers, all of them
                    animating opacity or transform ONLY — those are the two
                    properties a browser can composite without re-running
                    layout or repainting the 82-node scene under them, which
                    matters here because this SVG is already large. Nothing
                    below uses an SVG filter for the same reason. */}
                <radialGradient id="poe-aurora-a" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#6a2fa8" stopOpacity="0.30" />
                  <stop offset="45%"  stopColor="#3a1a6e" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#12061f" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="poe-aurora-b" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#1a5fa8" stopOpacity="0.26" />
                  <stop offset="45%"  stopColor="#0f2a6e" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#06101f" stopOpacity="0" />
                </radialGradient>
                {/* A shaft is bright where it leaves the core and gone by
                    the rim — light losing energy with distance.
                    `gradientUnits="userSpaceOnUse"` anchored on the wheel's
                    centre is the trick that makes ONE def serve all 30
                    shafts and all 30 corona rays regardless of their angle:
                    in the default objectBoundingBox units each triangle
                    would fade relative to its own box and the falloff would
                    point a different way for every ray. White, so each
                    shaft lightens whichever branch colour it crosses
                    instead of fighting it. */}
                <radialGradient id="poe-ray-fade" gradientUnits="userSpaceOnUse"
                  cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={MAX_TIER_RADIUS + 40}>
                  <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.42" />
                  <stop offset="16%"  stopColor="#ffffff" stopOpacity="0.24" />
                  <stop offset="52%"  stopColor="#ffffff" stopOpacity="0.09" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="poe-corona-fade" gradientUnits="userSpaceOnUse"
                  cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={230}>
                  <stop offset="0%"   stopColor="#f0e0ff" stopOpacity="0.85" />
                  <stop offset="30%"  stopColor="#c78dff" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#b362ff" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="poe-core-flare" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="12%"  stopColor="#e6d0ff" stopOpacity="0.6" />
                  <stop offset="34%"  stopColor="#b362ff" stopOpacity="0.26" />
                  <stop offset="68%"  stopColor="#6a2fa8" stopOpacity="0.09" />
                  <stop offset="100%" stopColor="#b362ff" stopOpacity="0" />
                </radialGradient>
                {/* Vignette — pulls the eye to the wheel and gives the
                    whole screen a single implied light source. Drawn over
                    the wedges, under the nodes. */}
                <radialGradient id="poe-vignette" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#000000" stopOpacity="0" />
                  <stop offset="58%"  stopColor="#000000" stopOpacity="0" />
                  <stop offset="80%"  stopColor="#04020a" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#020106" stopOpacity="0.72" />
                </radialGradient>
                {/* Organic mottling — a handful of large, soft, irregular
                    tints rather than a uniform gradient, so the field under
                    the veins reads as tissue rather than a UI panel. */}
                <radialGradient id="poe-tissue-a" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#4a1a5e" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#4a1a5e" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="poe-tissue-b" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1a2f5e" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#1a2f5e" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="poe-tissue-c" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#5e1a2a" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#5e1a2a" stopOpacity="0" />
                </radialGradient>
                {/* Ornate frame ring — stands in for the reference's carved-
                    wood-and-vine border (that's a photoreal illustration;
                    this project hand-builds art in SVG/CSS, no image
                    assets, so a bronze/gold bevel ring is the code-only
                    equivalent of "the wheel has a real edge/frame", not a
                    literal wood-grain match). Warm bronze radial arc,
                    bright on the lit (top-left) side, dark on the shadow
                    side, same top-left light direction every other bevel
                    on this screen already uses. */}
                <linearGradient id="poe-frame-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d9a85c" />
                  <stop offset="25%" stopColor="#8a5f2e" />
                  <stop offset="55%" stopColor="#3e2712" />
                  <stop offset="100%" stopColor="#160c05" />
                </linearGradient>
              </defs>

              {/* ══ PARALLAX BACKGROUND LAYERS ═══════════════════════════
                  Timmy: "du får gärna göra så de är lager lixom så de blir
                  paralax effekt när man zoomar å flyttar".

                  These sit OUTSIDE the world <g> and take their own, weaker
                  transform from `parallax(d)` — see the helper for why the
                  pan has to be solved for rather than just multiplied.
                  Starfield is the most distant; aurora sits between it and
                  the wheel. ── */}
              <g style={{ transform: parallax(0.30), transformOrigin: '0px 0px' }}>
                {STARFIELD.map((s, i) => (
                  <circle key={`star-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#dce6ff"
                    className="poe-twinkle"
                    style={{ '--o': s.o, animationDuration: `${s.d}s`, animationDelay: `${s.t}s` }} />
                ))}
              </g>

              {/* Deep aurora, counter-rotating against the corona so the
                  field never looks like one rigid turning disc. */}
              <g style={{ transform: parallax(0.58), transformOrigin: '0px 0px' }}>
                <g className="poe-aurora" style={{ transformOrigin: `${RADIAL_CENTER}px ${RADIAL_CENTER}px` }}>
                  <ellipse cx={RADIAL_CENTER - 260} cy={RADIAL_CENTER - 160} rx={1250} ry={880}
                    fill="url(#poe-aurora-a)" />
                  <ellipse cx={RADIAL_CENTER + 320} cy={RADIAL_CENTER + 240} rx={1150} ry={950}
                    fill="url(#poe-aurora-b)" />
                </g>
              </g>

              <g style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: '0px 0px' }}>

                {/* ── Branch wedges — bold, distinct, saturated colors with
                    a GLOWING colored edge line on every wedge boundary.
                    Timmy's reference ("skillträd DENNA BILD ÄR BÄST") has
                    clearly separated neon-bordered color sectors, not a
                    smooth blend — the earlier smooth-gradient version
                    (WEDGE_RING, still defined above, no longer used here)
                    over-corrected the "lucky wheel" complaint in the wrong
                    direction. The fix for "cheap flat wedge" isn't "no
                    wedges" — it's richer, glowing, higher-saturation ones. ── */}
                {Object.entries(POE_BRANCHES).map(([key, b]) => {
                  const half = (Math.PI / _branchKeyList.length) * 0.72;
                  const a0 = BRANCH_ANGLES[key] - half, a1 = BRANCH_ANGLES[key] + half;
                  const R = MAX_TIER_RADIUS + 40;
                  const x0 = RADIAL_CENTER + R * Math.cos(a0), y0 = RADIAL_CENTER + R * Math.sin(a0);
                  const x1 = RADIAL_CENTER + R * Math.cos(a1), y1 = RADIAL_CENTER + R * Math.sin(a1);
                  const d = `M ${RADIAL_CENTER} ${RADIAL_CENTER} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
                  return (
                    <g key={`wedge-${key}`}>
                      <path d={d} fill={b.color} opacity={0.16} />
                      <path d={d} fill="none" stroke={b.color} strokeWidth={2}
                        opacity={0.8} filter="url(#poe-glow)" />
                    </g>
                  );
                })}

                {/* ── Light shafts. Three per wedge, each a narrow triangle
                    from the core out to the rim, fading with distance via
                    the shared user-space gradient. Every one runs the same
                    breathe animation on a different negative delay, so the
                    wheel shimmers continuously instead of pulsing in
                    lockstep. ── */}
                {WEDGE_SHAFTS.map(s => {
                  const half = (Math.PI / _branchKeyList.length) * 0.72;
                  const a = BRANCH_ANGLES[s.key] + s.off * half;
                  const R = MAX_TIER_RADIUS + 34;
                  const x0 = RADIAL_CENTER + R * Math.cos(a - s.w), y0 = RADIAL_CENTER + R * Math.sin(a - s.w);
                  const x1 = RADIAL_CENTER + R * Math.cos(a + s.w), y1 = RADIAL_CENTER + R * Math.sin(a + s.w);
                  return (
                    <path key={`shaft-${s.key}-${s.i}`}
                      d={`M ${RADIAL_CENTER} ${RADIAL_CENTER} L ${x0} ${y0} L ${x1} ${y1} Z`}
                      fill="url(#poe-ray-fade)" className="poe-shaft-breathe"
                      style={{ animationDelay: `${s.delay}s`, pointerEvents: 'none' }} />
                  );
                })}

                {/* ── The core, made an actual light source. Every node on
                    this screen is shaded as if lit from the upper-left,
                    which is a convention that only holds together if the
                    wheel visibly emits something of its own. Rotating
                    corona + a slow breathing flare. ── */}
                <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={230}
                  fill="url(#poe-core-flare)" className="poe-core-breathe"
                  style={{ transformOrigin: `${RADIAL_CENTER}px ${RADIAL_CENTER}px`, pointerEvents: 'none' }} />
                <g className="poe-corona-spin"
                  style={{ transformOrigin: `${RADIAL_CENTER}px ${RADIAL_CENTER}px`, pointerEvents: 'none' }}>
                  {CORE_RAYS.map((ray, i) => {
                    const x0 = RADIAL_CENTER + ray.len * Math.cos(ray.a - ray.w);
                    const y0 = RADIAL_CENTER + ray.len * Math.sin(ray.a - ray.w);
                    const x1 = RADIAL_CENTER + ray.len * 3.4 * Math.cos(ray.a);
                    const y1 = RADIAL_CENTER + ray.len * 3.4 * Math.sin(ray.a);
                    const x2 = RADIAL_CENTER + ray.len * Math.cos(ray.a + ray.w);
                    const y2 = RADIAL_CENTER + ray.len * Math.sin(ray.a + ray.w);
                    return <path key={`ray-${i}`} d={`M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} Z`}
                      fill="url(#poe-corona-fade)" />;
                  })}
                </g>
                <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={26}
                  fill="url(#poe-core-flare)" className="poe-core-pulse"
                  style={{ transformOrigin: `${RADIAL_CENTER}px ${RADIAL_CENTER}px`, pointerEvents: 'none' }} />

                {/* ── Ornate frame ring — the wheel's outer edge, bronze
                    bevel + a small gem accent at every branch angle.
                    Was way too thin relative to the reference (16px
                    against a ~1200px radius reads as a hairline, the
                    reference's frame is a real proportion of the wheel's
                    width) — thickened substantially. ── */}
                {(() => {
                  const FR = FRAME_R;
                  const BW = FRAME_BW;
                  const HOOP = 11;                      // metal hoop width
                  const rOut = FR + BW / 2 - HOOP / 2;  // outer hoop centreline
                  const rIn  = FR - BW / 2 + HOOP / 2;  // inner hoop centreline
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* ══ WOOD + METAL + VEGETATION ═════════════════════
                          Timmy: "hjulet ska också ha ram men på sitt vis de
                          ska va metal trä å växtlighet". Two bronze hoops
                          clamping a wide WOOD band, bolted through, with a
                          vine growing over the whole thing.

                          None of it is a texture — this project ships no
                          image assets. The wood is grain arcs at jittered
                          radii; the vine is one polar sine path with leaves
                          hung off its crests. Both are generated once at
                          module load, so the per-frame cost is just the
                          paths themselves. ── */}

                      {/* Cast shadow onto the starfield. Without it the ring
                          floats; with it the wheel is an object lying on
                          something. Offset away from the light. */}
                      <circle cx={RADIAL_CENTER + 10} cy={RADIAL_CENTER + 13} r={FR}
                        fill="none" stroke="#000000" strokeOpacity={0.55} strokeWidth={BW + 30} />
                      <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={FR}
                        fill="none" stroke="#000000" strokeOpacity={0.9} strokeWidth={BW + 12} />

                      {/* WOOD. Warmer and much darker than the bronze so
                          the two materials never read as one — that was the
                          failure of the previous all-bronze band. */}
                      <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={FR}
                        fill="none" stroke="url(#poe-wood)" strokeWidth={BW} />

                      {/* Grain. Long partial arcs at jittered radii, which
                          is what grain actually looks like: roughly parallel
                          to the edge, with breaks. */}
                      {WOOD_GRAIN.map((g, i) => (
                        <circle key={`grain-${i}`} cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={g.r}
                          fill="none" stroke="#1c0f05" strokeOpacity={g.o} strokeWidth={g.w}
                          strokeLinecap="round"
                          strokeDasharray={`${g.span * g.r} ${2 * Math.PI * g.r}`}
                          transform={`rotate(${(g.a0 * 180) / Math.PI} ${RADIAL_CENTER} ${RADIAL_CENTER})`} />
                      ))}
                      {/* A soft darkening toward both edges of the plank,
                          so the wood reads as rounded rather than flat. */}
                      <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={FR + BW * 0.40}
                        fill="none" stroke="#0f0803" strokeOpacity={0.45} strokeWidth={BW * 0.22} />
                      <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={FR - BW * 0.40}
                        fill="none" stroke="#0f0803" strokeOpacity={0.38} strokeWidth={BW * 0.22} />

                      {/* THE VINE, under the metal hoops so it looks threaded
                          through the frame rather than painted on top of it.
                          Dark understroke first, then the live stem. */}
                      {/* Sized against a ~1450px frame radius, not against
                          the code — at the first live check a 4px stem and
                          40px leaves were sub-pixel specks at the 24% zoom
                          the wheel actually opens at. Everything here is
                          roughly tripled so it reads at fit-to-screen. */}
                      <path d={VINE_PATH} fill="none" stroke="#06120a" strokeOpacity={0.8} strokeWidth={17} />
                      <path d={VINE_PATH} fill="none" stroke="url(#poe-vine)" strokeWidth={10}
                        className="poe-vine-live" />
                      <path d={VINE_PATH} fill="none" stroke="#b8f58a" strokeOpacity={0.35} strokeWidth={2.5} />
                      {VINE_LEAVES.map((lf, i) => (
                        <g key={`leaf-${i}`}
                          transform={`translate(${lf.x} ${lf.y}) rotate(${lf.rot}) scale(${lf.s * 3.8})`}
                          className="poe-vine-leaf"
                          style={{ animationDelay: `${-(i * 0.47).toFixed(2)}s` }}>
                          {/* Drawn in a 20-unit box and scaled up, not in a
                              40-unit box at half the scale. Identical on
                              screen, but it keeps every coordinate under
                              wiring.test.mjs's 30-unit threshold for "this
                              is a hand-drawn hero body, not an icon glyph".
                              The alternative — adding SkillTree.jsx to that
                              guard's ALLOWED set — would blind it to a real
                              sixth copy of the character appearing here
                              later, which is exactly what it exists to
                              catch. A leaf is not a waterdrop; staying
                              inside the glyph size band says so honestly. */}
                          <path d="M0,0 C 5,-6.5 15,-7.5 20,-1.5 C 15,4.5 5,5.5 0,0 Z"
                            fill="url(#poe-vine)" stroke="#06120a" strokeWidth={1.3} />
                          <path d="M1,0 C 7,-2 14,-2.5 19,-1.5" fill="none"
                            stroke="#0a1c0e" strokeOpacity={0.7} strokeWidth={0.8} />
                        </g>
                      ))}

                      {/* METAL HOOPS clamping the plank top and bottom. */}
                      {[rOut, rIn].map((rr, i) => (
                        <React.Fragment key={`hoop-${i}`}>
                          <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={rr}
                            fill="none" stroke="#000000" strokeOpacity={0.8} strokeWidth={HOOP + 3} />
                          <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={rr}
                            fill="none" stroke="url(#poe-bezel)" strokeWidth={HOOP} />
                          <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={rr - HOOP * 0.28}
                            fill="none" stroke="#ffe6b0" strokeOpacity={0.28} strokeWidth={1.2} />
                        </React.Fragment>
                      ))}

                      {/* BOLTS through both hoops — the fasteners are what
                          make it read as assembled rather than drawn. */}
                      {FRAME_BOLTS.map((a, i) => (
                        <React.Fragment key={`bolt-${i}`}>
                          {[rOut, rIn].map((rr, j) => {
                            const bx = RADIAL_CENTER + rr * Math.cos(a);
                            const by = RADIAL_CENTER + rr * Math.sin(a);
                            return (
                              <g key={j}>
                                <circle cx={bx} cy={by} r={HOOP * 0.34} fill="url(#poe-bezel)"
                                  stroke="#0a0603" strokeWidth={1.2} />
                                <circle cx={bx - HOOP * 0.1} cy={by - HOOP * 0.1} r={HOOP * 0.12}
                                  fill="#ffeec2" opacity={0.5} />
                              </g>
                            );
                          })}
                        </React.Fragment>
                      ))}

                      {/* Outermost dark lip, so the whole assembly has a
                          crisp silhouette against the background. */}
                      <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={FR + BW / 2 + 2}
                        fill="none" stroke="#050201" strokeOpacity={0.9} strokeWidth={4} />

                      {/* One gem MOUNT per branch, built exactly like a node
                          — crater, bezel, glass, specular — in that branch's
                          own colour. This is the payoff of having a single
                          material system: the frame's gems and the tree's
                          nodes are visibly the same craft, and the frame
                          tells you which branch is where before you have
                          read a single label. */}
                      {Object.entries(POE_BRANCHES).map(([key, br], i) => {
                        const a = BRANCH_ANGLES[key];
                        const gx = RADIAL_CENTER + FR * Math.cos(a), gy = RADIAL_CENTER + FR * Math.sin(a);
                        const gr = 17;
                        return (
                          <g key={`frame-gem-${key}`}>
                            <circle cx={gx} cy={gy} r={gr * 2.6} fill={`url(#halo-${key})`} opacity={0.5} />
                            <circle cx={gx} cy={gy} r={gr + 9} fill="#0b0602" />
                            <circle cx={gx} cy={gy} r={gr + 5} fill="none"
                              stroke="url(#poe-bezel)" strokeWidth={8} />
                            <circle cx={gx} cy={gy} r={gr + 9} fill="none"
                              stroke="#000000" strokeOpacity={0.8} strokeWidth={2} />
                            <circle cx={gx} cy={gy} r={gr} fill={`url(#orb-${key})`} />
                            <ellipse cx={gx - gr * 0.34} cy={gy - gr * 0.42}
                              rx={gr * 0.3} ry={gr * 0.19} fill="url(#poe-spec)" opacity={0.85}
                              transform={`rotate(-34 ${gx - gr * 0.34} ${gy - gr * 0.42})`} />
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}

                {/* ── Organic tissue mottling — large soft irregular tints
                    under everything, so the field reads as a surface rather
                    than a flat UI wash. Fixed, hand-placed blobs rather than
                    a noise filter: cheap, and the placement can be art-
                    directed instead of left to chance. ── */}
                {/* Each drifts on its own long, prime-ish period so the
                    four never resynchronise into one visible throb. */}
                <ellipse cx={RADIAL_CENTER - 500} cy={RADIAL_CENTER - 300} rx={900} ry={700} fill="url(#poe-tissue-a)"
                  className="poe-cloud" style={{ animationDuration: '19s', animationDelay: '0s', transformOrigin: `${RADIAL_CENTER - 500}px ${RADIAL_CENTER - 300}px` }} />
                <ellipse cx={RADIAL_CENTER + 600} cy={RADIAL_CENTER + 200} rx={950} ry={750} fill="url(#poe-tissue-b)"
                  className="poe-cloud" style={{ animationDuration: '23s', animationDelay: '-6s', transformOrigin: `${RADIAL_CENTER + 600}px ${RADIAL_CENTER + 200}px` }} />
                <ellipse cx={RADIAL_CENTER - 200} cy={RADIAL_CENTER + 650} rx={800} ry={600} fill="url(#poe-tissue-c)"
                  className="poe-cloud" style={{ animationDuration: '29s', animationDelay: '-13s', transformOrigin: `${RADIAL_CENTER - 200}px ${RADIAL_CENTER + 650}px` }} />
                <ellipse cx={RADIAL_CENTER + 300} cy={RADIAL_CENTER - 700} rx={700} ry={650} fill="url(#poe-tissue-b)"
                  className="poe-cloud" style={{ animationDuration: '31s', animationDelay: '-21s', transformOrigin: `${RADIAL_CENTER + 300}px ${RADIAL_CENTER - 700}px` }} />

                {/* Vignette — over every background layer, under the nodes,
                    so it deepens the field without ever dimming a node. */}
                <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={MAX_TIER_RADIUS + 240}
                  fill="url(#poe-vignette)" style={{ pointerEvents: 'none' }} />

                {/* ── Node sockets carved into the surface — one per node,
                    drawn BEFORE the node itself and before connections, so a
                    vein visibly runs INTO a hollow rather than under a disc.
                    Same hollow whether the node is locked or owned; the node
                    circle is what changes, not its seat. ── */}
                {[...POE_RADIAL_NODES, ...(h2oUnlocked ? POE_H2O_NODES : [])].map(n => {
                  const nr = nodeRadius[n.type] || 22;
                  const r = nr + Math.max(9, nr * 0.42);   // crater is wider than the orb it holds
                  return (
                    <g key={`socket-${n.id}`}>
                      {/* Raised lip, lit top-left */}
                      <circle cx={n.rx} cy={n.ry} r={r} fill="none"
                        stroke="url(#poe-lip)" strokeWidth={Math.max(3, nr * 0.20)} />
                      {/* Hollow floor, lit bottom-right — the inverse sweep */}
                      <circle cx={n.rx} cy={n.ry} r={r - 1} fill="url(#poe-crater)" />
                      {/* Contact-occlusion: the darkest line in the whole
                          node sits where the bezel meets the crater wall.
                          Without it the orb floats above the hole instead
                          of sitting down inside it. */}
                      <circle cx={n.rx} cy={n.ry} r={nr + 3.5} fill="none"
                        stroke="#000000" strokeOpacity={0.72} strokeWidth={Math.max(2.5, nr * 0.16)} />
                    </g>
                  );
                })}

                {/* ── Concentric ring grid (depth) + radial sector spokes ── */}
                {Array.from({ length: MAX_TIER + 1 }).map((_, i) => (
                  <circle key={`ring${i}`} cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={175 + i * 140}
                    fill="none" stroke="#1a0f30" strokeWidth={1} opacity={0.35} />
                ))}
                {Object.entries(POE_BRANCHES).map(([key], i) => {
                  const gapA = BRANCH_ANGLES[key] - Math.PI / Object.keys(POE_BRANCHES).length;
                  const x2 = RADIAL_CENTER + (MAX_TIER_RADIUS + 60) * Math.cos(gapA);
                  const y2 = RADIAL_CENTER + (MAX_TIER_RADIUS + 60) * Math.sin(gapA);
                  return <line key={`spoke${key}`} x1={RADIAL_CENTER} y1={RADIAL_CENTER} x2={x2} y2={y2} stroke="#1a0f30" strokeWidth={1} opacity={0.4} />;
                })}

                {/* ── Branch labels — outer ring (full name) AND inner ring
                    (near the root node, so you always know which branch
                    you're looking at whether you're zoomed to the core or
                    the rim). ── */}
                {Object.entries(POE_BRANCHES).map(([key, b]) => {
                  const pos = branchLabelPos[key];
                  const cosA = Math.cos(pos.angle);
                  const anchor = cosA > 0.35 ? 'start' : cosA < -0.35 ? 'end' : 'middle';
                  // Sits just inside the first node ring. Was hard-coded at
                  // 115 against the old RING_BASE of 175; now derived, so
                  // moving the rings can never leave these behind again.
                  const innerR = RING_BASE - 74;
                  const ix = RADIAL_CENTER + innerR * Math.cos(pos.angle);
                  const iy = RADIAL_CENTER + innerR * Math.sin(pos.angle);
                  const isz = 46;
                  const tone = iconToneFor(b.icon, b.color) || b.color;
                  return (
                    <React.Fragment key={`lbl-${key}`}>
                      {/* Outer branch name. Timmy: "texterna längst ut gör
                          de mer synligt större". Was 22px at 0.8 opacity on
                          a ~2700px-wide wheel — invisible at any zoom that
                          showed the whole tree. Now 54px, full opacity, on
                          a dark stroke so it survives crossing a lit wedge. */}
                      <text x={pos.x} y={pos.y} textAnchor={anchor} dominantBaseline="middle"
                        fill={tint(b.color, 0.35)} fontSize={54} fontFamily="VT323"
                        stroke="#05030e" strokeWidth={7} paintOrder="stroke"
                        letterSpacing={6}>
                        {b.name}
                      </text>
                      {/* Inner branch emblem, seated in its own bronze mount
                          so the hub reads as a legend rather than as loose
                          glyphs. Was 22px — "loggorna längt in måste va
                          större de lixom helt fel storlek". */}
                      <g style={{ pointerEvents: 'none' }}>
                        <circle cx={ix} cy={iy} r={isz * 0.78} fill="url(#poe-crater)" />
                        <circle cx={ix} cy={iy} r={isz * 0.72} fill="none"
                          stroke="url(#poe-bezel)" strokeWidth={5} />
                        <circle cx={ix} cy={iy} r={isz * 0.78} fill="none"
                          stroke="#000000" strokeOpacity={0.75} strokeWidth={2} />
                        <g transform={`translate(${ix - isz / 2}, ${iy - isz / 2})`}>
                          <TreeIcon name={b.icon} size={isz} tone={tone} big />
                        </g>
                      </g>
                    </React.Fragment>
                  );
                })}

                {/* ── Connection lines ── */}
                {[...CONNECTIONS, ...(h2oUnlocked ? H2O_CONNECTIONS : [])].map(({ from, to, branch: br }) => {
                  const fnNode = lookupNode(from);
                  const toNode = lookupNode(to);
                  if (!fnNode || !toNode) return null;
                  const bCol = br === 'h2o' ? POE_H2O_BRANCH.color : (POE_BRANCHES[br]?.color || '#3a2a6e');
                  const ownedFrom = (skills[from] || 0) >= 1;
                  const ownedTo   = (skills[to]   || 0) >= 1;
                  const active    = ownedFrom && ownedTo;
                  const partial   = ownedFrom && !ownedTo;
                  return (
                    <g key={`ln-${from}-${to}`}>
                      {/* Glow underlay for active connections — pulses
                          slowly so the veins read as carrying something
                          live, not just lit. Widened + brightened to match
                          the reference's thick glowing light-beam
                          connectors (was a thin 9px halo maxing at 0.32
                          opacity — read as barely-lit next to the
                          reference's saturated beams). */}
                      {active && (
                        <line className="poe-vein-pulse" x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                          stroke={bCol} strokeWidth={16} strokeLinecap="round" filter="url(#poe-glow)" />
                      )}
                      {/* A dark groove under every line — even the faint,
                          unowned ones — so it reads as a channel cut into the
                          panel instead of a line drawn on top of it. */}
                      <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                        stroke="#000000" strokeWidth={(active ? 4.5 : 2) + 1.6}
                        opacity={active ? 0.5 : partial ? 0.3 : 0.18} strokeLinecap="round" />
                      <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                        stroke={bCol}
                        strokeWidth={active ? 4.5 : 2}
                        opacity={active ? 1 : partial ? 0.34 : 0.14}
                        strokeLinecap="round"
                      />
                      {/* ── PARTIAL: owned at one end, buyable at the other.
                          Timmy: "gör linjerna på nått vis så de känns som
                          det är dom som connectar å tänder lixom aktiverar
                          så man KAN köpa noden."

                          So this is not decoration — it is the game telling
                          you where your points can go next, and it has to
                          read directionally. Charge visibly FLOWS from the
                          node you own into the node you don't: the line is
                          drawn from `from` (owned) to `to` (buyable), and
                          walking stroke-dashoffset negative marches the
                          dashes along that direction. Flip the sign and the
                          tree looks like it is draining into the node you
                          already bought, which reads as exactly the wrong
                          thing.

                          A soft wide underlay carries the glow, a bright
                          thin core carries the motion, and the buyable end
                          gets an arrival flare so the eye lands on the node
                          rather than on the wire. ── */}
                      {partial && (
                        <>
                          <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                            stroke={bCol} strokeWidth={9} strokeLinecap="round"
                            className="poe-vein-charge" style={{ pointerEvents: 'none' }} />
                          <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                            stroke={tint(bCol, 0.55)} strokeWidth={2.6} strokeLinecap="round"
                            strokeDasharray="16 26"
                            className="poe-vein-flow" style={{ pointerEvents: 'none' }} />
                        </>
                      )}
                      {/* A bright core down the middle of ACTIVE lines only
                          — the "energy running through it" read the
                          reference asked for, without adding one on every
                          faint unowned line where it would just look noisy. */}
                      {active && (
                        <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                          stroke="#ffffff" strokeWidth={1.6} opacity={0.85} strokeLinecap="round" />
                      )}
                    </g>
                  );
                })}

                {/* ── Nodes ── */}
                {[...POE_RADIAL_NODES, ...(h2oUnlocked ? POE_H2O_NODES : [])].map(node => {
                  const b    = branchOf(node);
                  const lvl  = skills[node.id] || 0;
                  const unlk = isUnlocked(node.id, skills);
                  const maxd = lvl >= node.max;
                  const purd = lvl > 0;
                  const isSel = selected?.id === node.id;
                  const r    = nodeRadius[node.type] || 18;
                  const nx = node.rx, ny = node.ry;
                  const pk = node.branch === 'h2o' ? 'h2o' : node.branch;

                  // ── Material selection ──────────────────────────────
                  // Four states, and each one is a MATERIAL change, not
                  // just an opacity change. The old build faded locked
                  // nodes to 0.4 group opacity over a near-black fill,
                  // which erased them — half the wheel read as empty. The
                  // reference keeps every node fully present and lets the
                  // material carry the state: dead stone in an iron ring
                  // vs. lit glass in bronze vs. lit glass in gold.
                  const bezelFill = maxd ? 'url(#poe-bezel-gold)'
                    : unlk ? 'url(#poe-bezel)' : 'url(#poe-bezel-dead)';
                  const bw = Math.max(4.5, r * 0.26);          // bezel thickness
                  const br = r + bw / 2;                        // bezel centreline radius
                  const lit = purd || maxd;                     // orb is powered
                  const rivets = node.type === 'keystone' ? 8 : node.type === 'notable' ? 6 : 0;
                  const groupOpacity = unlk ? 1 : 0.78;

                  // The seat animation. Including the fx key in React's `key`
                  // remounts this one node, which is what actually restarts
                  // the CSS animation — re-applying an identical className to
                  // a live element does nothing, so buying the same node
                  // twice in a row would otherwise play the animation once.
                  // One node remount per purchase is free.
                  const seating = buyFx?.id === node.id;
                  // The hidden capstone cluster does not just appear — it
                  // BLOOMS out of the hub. Timmy: "gör de innåt gömt så de
                  // animerar öppnar innåt". Scaling from RADIAL_CENTER (not
                  // from each node's own centre) is what makes the four ring
                  // nodes travel outward from the core instead of each
                  // popping in place, and the stagger by clock hour makes
                  // them unfurl one after another.
                  const isH2O = node.branch === 'h2o';
                  const h2oIdx = isH2O ? POE_H2O_NODES.findIndex(h => h.id === node.id) : 0;
                  return (
                    <g key={seating ? `${node.id}-fx${buyFx.key}` : node.id} opacity={groupOpacity}
                      className={[seating && 'poe-node-seat', isH2O && !seating && 'poe-h2o-bloom']
                        .filter(Boolean).join(' ') || undefined}
                      onClick={(e) => onNodeClick(e, node)}
                      style={{
                        cursor: 'pointer',
                        transformOrigin: isH2O && !seating
                          ? `${RADIAL_CENTER}px ${RADIAL_CENTER}px`
                          : `${nx}px ${ny}px`,
                        animationDelay: isH2O && !seating ? `${0.25 + h2oIdx * 0.16}s` : undefined,
                      }}>

                      {/* Purchase shockwave — a ring expanding out past the
                          bezel, so the gain visibly leaves the node and
                          travels into the branch instead of stopping at its
                          own edge. Drawn first so it passes UNDER the orb. */}
                      {seating && (
                        <circle cx={nx} cy={ny} r={br} fill="none"
                          stroke={tint(b.color, 0.5)} strokeWidth={4}
                          className="poe-node-shock" style={{ pointerEvents: 'none' }} />
                      )}

                      {/* ── Halo. Gradient, not a blur filter — see the
                          defs note. Scales with importance so a keystone
                          throws visibly more light than a minor node,
                          which is the "size = how much this matters"
                          signal Timmy asked for, carried by the LIGHT and
                          not just the radius. ── */}
                      {(lit || isSel) && (
                        <circle cx={nx} cy={ny} r={br * (maxd ? 2.9 : isSel ? 2.7 : 2.3)}
                          fill={`url(#halo-${pk})`}
                          opacity={maxd ? 0.95 : isSel ? 0.9 : 0.7}
                          style={{ pointerEvents: 'none' }} />
                      )}

                      {/* ── "You can buy this" beacon. The other half of the
                          charging connectors: the wire delivers power, this
                          is the socket accepting it. Only on nodes that are
                          reachable AND unbought AND affordable — a pulse on
                          something you cannot actually purchase is a lie,
                          and this screen has ~80 nodes, so lighting all the
                          unreachable ones would be pure noise. ── */}
                      {unlk && !lit && save.sp >= node.c && (
                        <circle cx={nx} cy={ny} r={br + bw * 0.8} fill="none"
                          stroke={tint(b.color, 0.4)} strokeWidth={2.4}
                          className="poe-node-ready"
                          style={{ pointerEvents: 'none', transformOrigin: `${nx}px ${ny}px` }} />
                      )}

                      {/* ── The glass orb ──
                          Body first, then a second inner sphere at 82%
                          radius: real glass has a visible internal volume,
                          and one gradient alone flattens out. The inner
                          copy is offset toward the light, which is what
                          reads as depth rather than a painted disc. */}
                      <circle cx={nx} cy={ny} r={r} fill={`url(#orb${lit ? '' : 'dead'}-${pk})`} />
                      {lit && (
                        <circle cx={nx - r * 0.06} cy={ny - r * 0.08} r={r * 0.82}
                          fill={`url(#orb-${pk})`} opacity={0.55}
                          style={{ pointerEvents: 'none' }} />
                      )}
                      {/* Reachable-but-unbought: the glass is fitted but
                          unlit — a dim ghost of its live colour so the
                          player can see what they're buying. */}
                      {unlk && !lit && (
                        <circle cx={nx} cy={ny} r={r} fill={`url(#orb-${pk})`} opacity={0.3}
                          style={{ pointerEvents: 'none' }} />
                      )}

                      {/* ── Bezel: dark seat, metal band, then a bright
                          inner lip and a dark outer lip. The two thin
                          lines are what make the band read as a rounded
                          torus instead of a flat washer. ── */}
                      <circle cx={nx} cy={ny} r={br} fill="none" stroke="#000000"
                        strokeOpacity={0.85} strokeWidth={bw + 2.5} />
                      <circle cx={nx} cy={ny} r={br} fill="none" stroke={bezelFill} strokeWidth={bw} />
                      <circle cx={nx} cy={ny} r={r + 0.6} fill="none"
                        stroke="#ffffff" strokeOpacity={maxd ? 0.5 : 0.26} strokeWidth={1} />
                      <circle cx={nx} cy={ny} r={r + bw} fill="none"
                        stroke="#000000" strokeOpacity={0.6} strokeWidth={1.2} />

                      {/* Rivets — the reference's bezels are visibly
                          engineered objects, and rivet count is a second
                          silent rank signal (keystone 8 / notable 6 /
                          minor none) on top of size. */}
                      {rivets > 0 && Array.from({ length: rivets }).map((_, i) => {
                        const a = (i / rivets) * Math.PI * 2 - Math.PI / 2;
                        const rx2 = nx + br * Math.cos(a), ry2 = ny + br * Math.sin(a);
                        const rr = bw * 0.3;
                        return (
                          <g key={`rv-${i}`} style={{ pointerEvents: 'none' }}>
                            <circle cx={rx2} cy={ry2} r={rr} fill={bezelFill} stroke="#000000"
                              strokeOpacity={0.7} strokeWidth={0.8} />
                            <circle cx={rx2 - rr * 0.3} cy={ry2 - rr * 0.3} r={rr * 0.38}
                              fill="#ffffff" opacity={maxd ? 0.6 : 0.34} />
                          </g>
                        );
                      })}

                      {/* ── Level progress, drawn ON the bezel as a lit
                          arc rather than as a pie wedge over the glass.
                          The wedge covered the orb it was reporting on;
                          a gauge around the rim reads at a glance and
                          leaves the material intact. ── */}
                      {purd && !maxd && node.max > 1 && (() => {
                        const C = 2 * Math.PI * br;
                        return (
                          <circle cx={nx} cy={ny} r={br} fill="none"
                            stroke={tint(b.color, 0.45)} strokeWidth={bw * 0.42}
                            strokeLinecap="round"
                            strokeDasharray={`${(lvl / node.max) * C} ${C}`}
                            transform={`rotate(-90 ${nx} ${ny})`}
                            opacity={0.95} style={{ pointerEvents: 'none' }} />
                        );
                      })()}

                      {/* Icon sits INSIDE the glass, so it goes under the
                          specular — light reflecting off the surface must
                          pass over whatever is suspended in it. */}
                      {unlk && (() => {
                        const isz = node.type === 'keystone' ? 34 : node.type === 'notable' ? 25 : 18;
                        // Own colour per glyph, not the branch's — a heart
                        // is red on every branch. `poe-icon-ink` puts the
                        // black outline around it (see overhaul.css); an
                        // unlit node keeps the outline but drains the fill.
                        const tone = iconToneFor(node.icon, b.color);
                        return (
                          <g transform={`translate(${nx - isz / 2}, ${ny - isz / 2})`}
                            opacity={lit ? 1 : 0.62}>
                            <TreeIcon name={node.icon} size={isz}
                              big={node.type !== 'minor'}
                              tone={lit ? tone : (tone ? shade(tone, 0.4) : undefined)} />
                          </g>
                        );
                      })()}

                      {/* ── Specular: the primary catch-light plus a small
                          secondary pinpoint. Two highlights of different
                          size is the single cheapest cue that a surface is
                          curved glass rather than matte. ── */}
                      <ellipse cx={nx - r * 0.34} cy={ny - r * 0.42} rx={r * 0.30} ry={r * 0.19}
                        fill="url(#poe-spec)" opacity={lit ? 0.9 : unlk ? 0.5 : 0.22}
                        style={{ pointerEvents: 'none' }}
                        transform={`rotate(-34 ${nx - r * 0.34} ${ny - r * 0.42})`} />
                      <circle cx={nx + r * 0.30} cy={ny + r * 0.40} r={r * 0.09}
                        fill="#ffffff" opacity={lit ? 0.34 : unlk ? 0.18 : 0.07}
                        style={{ pointerEvents: 'none' }} />

                      {/* Selection: a bright ring OUTSIDE the bezel so it
                          never sits on the material it is marking. */}
                      {isSel && (
                        <>
                          <circle cx={nx} cy={ny} r={br + bw * 0.9} fill="none"
                            stroke="#ffffff" strokeOpacity={0.9} strokeWidth={2.5} />
                          <circle cx={nx} cy={ny} r={br + bw * 1.9} fill="none"
                            stroke={b.color} strokeWidth={2} opacity={0.75}
                            strokeDasharray="10 6" className="poe-sel-spin" />
                        </>
                      )}

                      {/* Level badge — a struck metal tag on the rim, not
                          bare 9px text floating on the glass (that was
                          unreadable at anything below 100% zoom). */}
                      {purd && node.max > 1 && (() => {
                        const bx = nx + br * 0.72, by = ny - br * 0.72;
                        const bR = Math.max(8, r * 0.34);
                        return (
                          <g style={{ pointerEvents: 'none' }}>
                            <circle cx={bx} cy={by} r={bR} fill="#0b0713" stroke={maxd ? '#ffd700' : b.color}
                              strokeWidth={1.6} />
                            <text x={bx} y={by + bR * 0.36} textAnchor="middle"
                              fontSize={bR * 1.25} fill={maxd ? '#ffe89a' : '#ffffff'} fontFamily="VT323">
                              {lvl}
                            </text>
                          </g>
                        );
                      })()}

                      {/* "START" pulse on unlocked start-nodes (no req) */}
                      {!node.req?.length && !purd && (
                        <>
                          <circle cx={nx} cy={ny} r={r + 6}
                            fill="none" stroke={b.color} strokeWidth={1.5} opacity={0.4}
                            className="poe-start-pulse" />
                          <text x={nx} y={ny + r + 18} textAnchor="middle"
                            fontSize={11} fill={b.color} fontFamily="VT323" opacity={0.8}
                            style={{ pointerEvents: 'none' }}>
                            ▼ START
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* ── H2O capstone reveal ────────────────────────────
                    Fires the moment every node in the 77-node tree is
                    maxed. Nothing here is visible before that — the
                    cluster is absent from the DOM, not dimmed, which is
                    the whole point of "gömt så man inte tänker på de".
                    Two shockwave rings and the label complete the "it
                    opens inward" gesture the nodes' own bloom starts. ── */}
                {h2oUnlocked && (
                  <g style={{ pointerEvents: 'none', transformOrigin: `${RADIAL_CENTER}px ${RADIAL_CENTER}px` }}>
                    {/* The chamber. The cluster has to read as its own
                        sealed room at the heart of the wheel, not as five
                        more nodes crowded into the hub — a darkened floor
                        inside a bronze rim does that in four elements, and
                        it reuses the same crater and bezel gradients
                        everything else on this screen is built from. */}
                    <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={206} fill="url(#poe-crater)" opacity={0.93} />
                    <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={206} fill="none"
                      stroke="url(#poe-bezel)" strokeWidth={14} />
                    <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={198} fill="none"
                      stroke={POE_H2O_BRANCH.color} strokeOpacity={0.45} strokeWidth={2} />
                    <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={213} fill="none"
                      stroke="#000000" strokeOpacity={0.8} strokeWidth={3} />
                    <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={110} fill="none"
                      stroke={POE_H2O_BRANCH.color} strokeWidth={4}
                      className="poe-h2o-ring"
                      style={{ transformOrigin: `${RADIAL_CENTER}px ${RADIAL_CENTER}px` }} />
                    <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={110} fill="none"
                      stroke="#ffffff" strokeWidth={2}
                      className="poe-h2o-ring"
                      style={{ transformOrigin: `${RADIAL_CENTER}px ${RADIAL_CENTER}px`, animationDelay: '0.45s' }} />
                    <text x={RADIAL_CENTER} y={RADIAL_CENTER + 262} textAnchor="middle"
                      fontFamily="Cinzel, serif" fontWeight="800" fontSize={44}
                      fill={tint(POE_H2O_BRANCH.color, 0.35)}
                      stroke="#02121a" strokeWidth={6} paintOrder="stroke"
                      letterSpacing={10} className="poe-h2o-label">
                      H2O
                    </text>
                  </g>
                )}

                {/* ── "NOW YOU ARE STRONGER" ─────────────────────────
                    Timmy wanted the Meta Upgrades feeling — green arrow,
                    stat name, number — but explicitly its own version, not
                    a copy: "Skilltree behöver sin egna sån juice som visar
                    men inte likadan nått unikt."

                    Meta Upgrades pops a chip in place. This instead SURGES
                    UP OUT OF THE NODE on a beam of that branch's own light
                    and dissolves — which fits a tree where the thing you
                    just powered is a lit orb in the ground, and reads as
                    energy leaving it rather than a number appearing beside
                    it. Rendered inside the pan/zoom <g> on purpose so it
                    stays welded to its node if the wheel is dragged
                    mid-animation.

                    The number is always green: every value in this tree is
                    a gain, including `dashcd`, whose value is a reduction
                    (see STAT_INVERTED — a smaller cooldown is not a loss,
                    and colouring it red is the exact bug the level-up cards
                    shipped with once). ── */}
                {gains.map(g => (
                  <g key={g.key} className="poe-gain" style={{ pointerEvents: 'none', transformOrigin: `${g.x}px ${g.y}px` }}>
                    {/* the beam the text rides out on */}
                    <rect x={g.x - 2.5} y={g.y - 96} width={5} height={96}
                      fill={g.color} opacity={0.5} className="poe-gain-beam" />
                    <text x={g.x} y={g.y - 104} textAnchor="middle"
                      fontFamily="VT323" fontSize={40} fill="#5cff9d"
                      stroke="#04240f" strokeWidth={5} paintOrder="stroke"
                      letterSpacing={1}>
                      ▲ {g.amount}
                    </text>
                    <text x={g.x} y={g.y - 76} textAnchor="middle"
                      fontFamily="VT323" fontSize={23} fill={tint(g.color, 0.45)}
                      stroke="#05030f" strokeWidth={4} paintOrder="stroke"
                      letterSpacing={2.5}>
                      {g.label}
                    </text>
                    {g.maxed && (
                      <text x={g.x} y={g.y - 132} textAnchor="middle"
                        fontFamily="VT323" fontSize={26} fill="#ffd700"
                        stroke="#2a1a00" strokeWidth={4} paintOrder="stroke"
                        letterSpacing={3}>
                        MAXED
                      </text>
                    )}
                  </g>
                ))}

              </g>
            </svg>

            {/* Zoom readout + the way back to the overview. Essential on
                phone, where the tree now opens zoomed in — without this
                there is no one-tap route back to seeing the whole wheel. */}
            <div className="poe-zoom-hint">
              {Math.round(scale * 100)}%
            </div>
            <button className="poe-fit-btn" onClick={fitAll} title="Fit whole tree"
              data-testid="st-fit">
              <GameIcon name="ui_eye" size={15} tone="#b9a8e8" />
              <span>FIT</span>
            </button>
          </div>

          {/* ── Preview Panel ── */}
          <div className={`poe-preview ${selNode ? 'open' : ''}`}
            style={{ '--bc': selBranch?.color || '#b362ff' }}>
            {selNode ? (
              <>
                <div className="poe-prev-branch" style={{ color: selBranch?.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GameIcon name={selBranch?.icon} size={16} tone={selBranch?.color} /> {selBranch?.name}
                </div>
                {/* The node itself, rendered as the SAME glass orb in the
                    same socket the wheel uses — not a flat icon disc. SVG
                    ids are document-global, so `url(#orb-combat)` resolves
                    here even though the gradient is defined inside the
                    tree's own <svg>. That is the whole reason the material
                    system is worth having: the thing you are inspecting
                    looks like the thing you clicked. */}
                {(() => {
                  const pk = selNode.branch === 'h2o' ? 'h2o' : selNode.branch;
                  // Sized so the whole box (orb + halo) clears the 280px
                  // desktop panel's 248px of usable width with room to
                  // breathe, and does not eat the mobile bottom sheet's
                  // 62vh. First attempt at R=40 produced a 214px box.
                  const R = 31, BW = 9, BR = R + BW / 2;
                  const isz = 28;
                  // The halo has to fit INSIDE the viewBox. At the first
                  // live check it was drawn at r=105 in a 124px box, and
                  // SVG clipped the gradient to the box — which showed up
                  // as a hard red square behind the orb. Box sized off the
                  // halo now, not the other way round.
                  const HALO = BR * 2.3;
                  const S = Math.ceil(HALO * 2) + 4, C = S / 2;
                  return (
                    <div className="poe-prev-orb" style={{ width: S, height: S }}>
                      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
                        <circle cx={C} cy={C} r={HALO} fill={`url(#halo-${pk})`} opacity={0.75} />
                        <circle cx={C} cy={C} r={BR + 9} fill="url(#poe-crater)" />
                        <circle cx={C} cy={C} r={R} fill={`url(#orb${selLvl > 0 ? '' : 'dead'}-${pk})`} />
                        {selLvl === 0 && <circle cx={C} cy={C} r={R} fill={`url(#orb-${pk})`} opacity={0.3} />}
                        <circle cx={C} cy={C} r={BR} fill="none" stroke="#000" strokeOpacity={0.85} strokeWidth={BW + 2.5} />
                        <circle cx={C} cy={C} r={BR} fill="none"
                          stroke={`url(#poe-bezel${selLvl >= selNode.max ? '-gold' : selLocked ? '-dead' : ''})`} strokeWidth={BW} />
                        <circle cx={C} cy={C} r={R + 0.6} fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={1} />
                        <ellipse cx={C - R * 0.34} cy={C - R * 0.42} rx={R * 0.3} ry={R * 0.19}
                          fill="url(#poe-spec)" opacity={0.9}
                          transform={`rotate(-34 ${C - R * 0.34} ${C - R * 0.42})`} />
                      </svg>
                      <div className="poe-prev-orb-icon">
                        <GameIcon name={selNode.icon} size={isz} tone={tint(selBranch?.color || '#fff', 0.6)} />
                      </div>
                    </div>
                  );
                })()}
                <div className="poe-prev-name">{selNode.name}</div>
                <div className="poe-prev-type" style={{ color: selBranch?.color }}>
                  {selNode.type.toUpperCase()}
                  {selNode.active && ' · ACTIVE SKILL'}
                </div>

                {/* The gain, as its own coloured line rather than only as
                    prose. The original brief asked for "colored stats" and
                    the last pass could only tint whatever digits happened
                    to be inline in each node's sentence. This reads the
                    node's actual `stat`/`val`, so it is right even for
                    nodes whose description never spells the number out. */}
                {(() => {
                  const { label, amount } = statGainText(selNode);
                  return (
                    <div className="poe-prev-stat">
                      <span className="poe-prev-stat-label">{label}</span>
                      <span className="poe-prev-stat-val">{amount}{selNode.max > 1 && amount !== 'UNLOCKED' ? ' / lvl' : ''}</span>
                    </div>
                  );
                })()}

                <div className="poe-prev-desc"><StatText text={selNode.desc} /></div>

                {/* Levels as a segmented bar. Pips alone stopped scaling
                    once nodes could hold three levels and the row started
                    wrapping on a phone; segments always fill the width. */}
                <div className="poe-prev-level">
                  <div className="poe-lvl-bar">
                    {Array.from({ length: selNode.max }).map((_, i) => (
                      <span key={i} className={`poe-lvl-seg ${i < selLvl ? 'on' : ''}`}
                        style={{ '--pc': selBranch?.color }} />
                    ))}
                  </div>
                  <span className="poe-lvl-text">{selLvl} / {selNode.max}</span>
                </div>
                <div className="poe-prev-cost">
                  <GameIcon name="ui_gem" size={12} tone="#4dffd4" />
                  <strong>{selNode.c}</strong> SP{selNode.max > 1 ? ' per level' : ''}
                </div>

                {selLocked && (() => {
                  const reqNode = selNode.req?.[0] ? lookupNode(selNode.req[0]) : null;
                  return (
                    <div className="poe-prev-locked" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GameIcon name="ui_lock" size={13} /> Requires: {reqNode?.name || selNode.req?.[0]}
                    </div>
                  );
                })()}

                {!selLocked && selLvl >= selNode.max && (
                  <div className="poe-prev-maxed">MAXED ✓</div>
                )}

                {!selLocked && selLvl < selNode.max && (
                  <button
                    className={`poe-buy-btn ${selCanBuy ? 'can' : 'cant'}`}
                    onClick={() => buyNode(selNode)}
                    disabled={!selCanBuy}
                    data-testid={`buy-poe-${selNode.id}`}
                  >
                    {selCanBuy ? `BUY — ◆ ${selNode.c} SP` : save.sp < selNode.c ? `NEED ◆ ${selNode.c} SP` : 'UNLOCK TREE FIRST'}
                  </button>
                )}

                <button className="poe-desel-btn" onClick={() => setSelected(null)}>← Back</button>
              </>
            ) : (
              <div className="poe-prev-empty">
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><GameIcon name="voidPulse" size={40} /></div>
                <div style={{ fontFamily: 'VT323', fontSize: 18, color: '#4a3a6e', letterSpacing: 2 }}>
                  SELECT A NODE
                </div>
                <div style={{ fontSize: 12, color: '#3a2a5e', marginTop: 8, lineHeight: 1.6 }}>
                  Click any node<br/>to inspect & buy
                </div>
                <div style={{ marginTop: 24, fontSize: 11, color: '#3a2a4e', lineHeight: 1.8 }}>
                  ◆ {save.sp} SP available
                </div>
                {Object.entries(POE_BRANCHES).map(([key, b]) => {
                  const bNodes = POE_TREE_NODES.filter(n => n.branch === key);
                  const owned = bNodes.filter(n => (skills[n.id] || 0) >= 1).length;
                  return (
                    <div key={key} className="poe-branch-summary" style={{ '--bc': b.color }}>
                      <span>{b.icon} {b.name}</span>
                      <span>{owned}/{bNodes.length}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Toast ── */}
        {toast && <div className="poe-toast">{toast}</div>}

      </div>
    </div>
  );
}
