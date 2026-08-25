import React from 'react';

// =============================================================================
// CAMP FRAME — the chrome that HOLDS the menu
// =============================================================================
// Timmy, 2026-08-19, with two reference images:
//   "polera igen är inte nöjd måste va mer ramar å shyssta grejjer som håller
//    menyerna" ... "gör profilen å ramarna å bakgrunden bakom kör denna meny
//    gör den grym"
//
// Read off the reference rather than invented. Five things carry that look and
// NONE of them existed in the camp before this file:
//
//   1. A STARFIELD BEHIND the panel. The menu is an object floating in space,
//      not a full-bleed screen. Without the gap around it there is no frame to
//      speak of — a border that touches the viewport edge reads as a border,
//      a border with sky behind it reads as a machined plate.
//   2. A DOUBLE FRAME with chamfered (45°) corners, never rounded. The single
//      biggest tell in the picture; a rounded panel cannot look like that
//      however it is lit.
//   3. WOOD INLAY strips top and bottom, warm against the cold blue metal.
//   4. RIVETED CORNER PLATES, set in from the corner.
//   5. A CYAN GEM centred at the top of the frame — the one focal ornament.
//
// Plus the thing that makes it THIS game rather than a generic sci-fi frame:
//   6. VINES growing over the metal. Timmy's world is a waterdrop that woke up
//      in a lake; something living crawling over the derelict hardware is the
//      whole story in one image. Green foliage, plus glowing magenta and cyan
//      tendrils so the plants read as touched by the same thing he was.
//
// EVERYTHING HERE IS DECORATION. The whole tree is `pointer-events: none` and
// `aria-hidden` — it can never eat a click or land in the tab order. That is
// load-bearing: this layer sits ON TOP of the panel (the vines have to overlap
// the frame to look like they are growing over it, which means they overlap
// the content edge too).
//
// Performance: per `waterdrop-svg-materials`, no per-element `filter="url()"`.
// Glow is radial-gradient halos and at most a handful of CSS drop-shadows on
// hero elements. Everything that animates animates `transform`/`opacity` only.

// ─────────────────────────────────────────────────────────────────────────────
// COSMOS — the living background behind the panel
// ─────────────────────────────────────────────────────────────────────────────
// Four layers per the skill: static star sheets, counter-rotating nebulae,
// twinkling stars, and a faint drifting dust band.
//
// The static stars are THREE CSS radial-gradient sheets on ONE element rather
// than 200 DOM nodes — a star that never changes does not need to be an
// element. Only the 16 that actually twinkle are real nodes, each with its own
// duration and a NEGATIVE delay so they are already mid-cycle on the first
// frame and never blink in unison.
const TWINKLE = [
  { x: 6,  y: 12, s: 2.0, d: 3.1, w: -0.4 }, { x: 17, y: 63, s: 1.4, d: 4.6, w: -2.2 },
  { x: 27, y: 26, s: 2.4, d: 5.2, w: -1.1 }, { x: 34, y: 82, s: 1.6, d: 3.8, w: -3.0 },
  { x: 44, y: 8,  s: 1.8, d: 6.1, w: -0.7 }, { x: 52, y: 46, s: 1.3, d: 4.1, w: -2.6 },
  { x: 61, y: 91, s: 2.2, d: 5.7, w: -1.9 }, { x: 69, y: 20, s: 1.5, d: 3.4, w: -0.2 },
  { x: 76, y: 70, s: 2.6, d: 6.8, w: -4.1 }, { x: 83, y: 37, s: 1.7, d: 4.4, w: -1.5 },
  { x: 89, y: 84, s: 1.4, d: 5.0, w: -3.3 }, { x: 95, y: 15, s: 2.1, d: 3.6, w: -0.9 },
  { x: 12, y: 41, s: 1.2, d: 5.5, w: -2.8 }, { x: 39, y: 58, s: 1.9, d: 4.9, w: -1.3 },
  { x: 58, y: 74, s: 1.5, d: 3.9, w: -3.7 }, { x: 71, y: 52, s: 2.3, d: 6.4, w: -2.0 },
];

export function CampCosmos() {
  return (
    <div className="camp-cosmos" aria-hidden>
      <div className="cc-deep" />
      <div className="cc-neb cc-neb-a" />
      <div className="cc-neb cc-neb-b" />
      <div className="cc-dust" />
      <div className="cc-stars" />
      {TWINKLE.map((t, i) => (
        <span key={i} className="cc-tw" style={{
          left: `${t.x}%`, top: `${t.y}%`,
          width: t.s, height: t.s,
          animationDuration: `${t.d}s`,
          animationDelay: `${t.w}s`,
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VINES
// ─────────────────────────────────────────────────────────────────────────────
// Drawn as SVG with a TALL, NARROW viewBox and `preserveAspectRatio="xMidYMid
// meet"`, so the whole sprig scales uniformly at any panel height. The obvious
// alternative — stretching one SVG to fit with `none` — squashes every leaf
// into an oval and is instantly readable as wrong.
//
// Each leaf is TWO paths: the blade, and a lighter highlight covering its
// upper-left half. One flat green shape reads as a sticker; the split is what
// gives it a surface facing the light. Global light is upper-left, same as
// every other material in this project.

// A single leaf, drawn at the origin pointing right, then placed by transform.
function Leaf({ x, y, r, s = 1, dark = '#16401b', mid = '#2f7a2e', lit = '#69c45a' }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0 C 7 -9, 20 -10, 27 -2 C 20 7, 7 8, 0 0 Z" fill={dark} />
      <path d="M0 0 C 7 -9, 20 -10, 27 -2 C 18 0, 8 -2, 0 0 Z" fill={mid} />
      <path d="M1 -1 C 8 -8, 17 -8.6, 22 -3.4 C 15 -3.6, 7 -3.2, 1 -1 Z" fill={lit} opacity="0.55" />
      <path d="M0.5 0 C 9 -2, 18 -2.4, 26 -2" stroke="#0b2610" strokeWidth="0.7" fill="none" opacity="0.7" />
    </g>
  );
}

// A five-petal bloom. Two per side, no more — a flower is punctuation, and a
// frame covered in them stops reading as a machine that plants got into.
function Bloom({ x, y, s = 1, hue = '#f3e4bd' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map(a => (
        <ellipse key={a} cx="0" cy="-3.6" rx="2.1" ry="3.4" fill={hue}
          transform={`rotate(${a})`} opacity="0.92" />
      ))}
      <circle r="1.7" fill="#e8a83c" />
      <circle r="0.8" cx="-0.4" cy="-0.5" fill="#ffe6a8" />
    </g>
  );
}

// ONE tile of the edge vine. Fixed pixel height, stacked — see EdgeVine below.
function EdgeVineTile({ upsideDown }) {
  return (
    <svg className={`cv-strip${upsideDown ? ' cv-strip-inv' : ''}`} viewBox="0 0 120 760"
      preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
      {/* Main stem. Dark core first, lit edge on top and offset up-left. */}
      <path className="cv-stem"
        d="M62 -10 C 30 70, 92 140, 52 220 C 18 296, 88 356, 58 440 C 30 520, 90 578, 54 660 C 34 706, 60 742, 66 780"
        stroke="#12300f" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path
        d="M62 -10 C 30 70, 92 140, 52 220 C 18 296, 88 356, 58 440 C 30 520, 90 578, 54 660 C 34 706, 60 742, 66 780"
        stroke="#2c6a28" strokeWidth="3.4" fill="none" strokeLinecap="round"
        transform="translate(-1.2 -1.2)" />

      {/* A second, thinner runner crossing it — one stem alone looks planted,
          two crossing look grown. */}
      <path d="M40 30 C 78 96, 26 168, 70 250 C 96 300, 34 366, 74 452 C 100 512, 40 580, 72 668"
        stroke="#0f2a0d" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M40 30 C 78 96, 26 168, 70 250 C 96 300, 34 366, 74 452 C 100 512, 40 580, 72 668"
        stroke="#245c22" strokeWidth="1.8" fill="none" strokeLinecap="round"
        transform="translate(-1 -1)" opacity="0.9" />

      {/* Glowing tendrils — the thing that says this plant is not ordinary.
          Two only, and they carry the game's own accent pair. The CSS gives
          these a drop-shadow; keeping it to two elements is deliberate (see
          the filter trap in waterdrop-svg-materials). */}
      <path className="cv-glow cv-glow-a"
        d="M56 62 C 96 108, 22 152, 66 206 C 96 244, 40 282, 62 322"
        stroke="#c86bff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path className="cv-glow cv-glow-b"
        d="M58 402 C 24 448, 92 488, 56 540 C 30 578, 84 610, 64 656"
        stroke="#5fe8ff" strokeWidth="1.6" fill="none" strokeLinecap="round" />

      {/* Curled tips. A vine that just stops has been cut; a vine that curls
          is still growing. */}
      <path d="M66 780 C 74 796, 96 792, 94 776 C 93 766, 82 766, 84 776"
        stroke="#2c6a28" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M62 -10 C 54 -26, 32 -22, 34 -6 C 35 4, 46 4, 44 -6"
        stroke="#2c6a28" strokeWidth="2.6" fill="none" strokeLinecap="round" />

      <g className="cv-leaves">
        <Leaf x={58} y={36}  r={-38} s={1.05} />
        <Leaf x={72} y={96}  r={18} s={0.85} />
        <Leaf x={46} y={148} r={196} s={0.95} />
        <Leaf x={68} y={214} r={-24} s={1.1} />
        <Leaf x={38} y={272} r={168} s={0.8} />
        <Leaf x={74} y={330} r={12} s={1.0} />
        <Leaf x={50} y={392} r={202} s={0.9} />
        <Leaf x={70} y={456} r={-30} s={1.05} />
        <Leaf x={42} y={520} r={176} s={0.85} />
        <Leaf x={72} y={584} r={22} s={0.95} />
        <Leaf x={48} y={648} r={190} s={1.0} />
        <Leaf x={70} y={706} r={-18} s={0.85} />
      </g>

      <Bloom x={78} y={128} s={1.15} />
      <Bloom x={40} y={498} s={0.95} />
      <Bloom x={80} y={620} s={0.8} hue="#ffd9ef" />
    </svg>
  );
}

// The left/right edge vine, built by STACKING fixed-height tiles.
//
// The first version was one SVG with `height: 100%` and preserveAspectRatio
// "meet". Measured in the browser, that was wrong in a way that is invisible
// from reading the code: the camp panel is 1657px tall on the Campaign tab, so
// "meet" fitted the 120×760 viewBox to the NARROW axis (scale 0.867) and then
// centred the result — a 659px sprig floating in the middle of a 1657px edge,
// nowhere near the top of the screen where anyone would see it.
//
// "slice" is the obvious other answer and is worse: it scales to the TALL axis
// (2.18×), so the leaves would be enormous, and the size would change every
// time the panel's height changed — a leaf that is twice as big on CAMPAIGN as
// on STATS reads as a bug.
//
// Tiling fixes both. Each tile is a fixed 560px, so the leaves are the same
// size on every tab and at every window height, and enough tiles are stacked to
// outrun any realistic panel. Every other tile is flipped vertically so the
// repeat does not read as a repeat, and the stem's endpoints (x≈62 top, x≈66
// bottom) line up closely enough that the seams do not show.
const EDGE_TILES = 5;

function EdgeVine({ flip }) {
  return (
    <span className={`cv-edge${flip ? ' cv-flip' : ''}`} aria-hidden>
      {Array.from({ length: EDGE_TILES }).map((_, i) => (
        <EdgeVineTile key={i} upsideDown={i % 2 === 1} />
      ))}
    </span>
  );
}

// The top runner. Wide viewBox, same construction.
function TopVine() {
  return (
    <svg className="cv-svg cv-top" viewBox="0 0 900 90"
      preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
      <path d="M-10 34 C 90 8, 160 62, 268 32 C 360 6, 430 58, 540 30 C 640 6, 720 60, 830 30 C 870 20, 895 26, 910 36"
        stroke="#12300f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M-10 34 C 90 8, 160 62, 268 32 C 360 6, 430 58, 540 30 C 640 6, 720 60, 830 30 C 870 20, 895 26, 910 36"
        stroke="#2c6a28" strokeWidth="2.8" fill="none" strokeLinecap="round"
        transform="translate(-1 -1.4)" />
      <path className="cv-glow cv-glow-c"
        d="M120 40 C 220 14, 300 64, 400 36 C 500 10, 580 60, 690 34"
        stroke="#5fe8ff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <g className="cv-leaves">
        <Leaf x={70}  y={26} r={-52} s={0.8} />
        <Leaf x={182} y={44} r={38}  s={0.7} />
        <Leaf x={300} y={22} r={-44} s={0.85} />
        <Leaf x={412} y={46} r={30}  s={0.72} />
        <Leaf x={520} y={22} r={-50} s={0.8} />
        <Leaf x={638} y={46} r={34}  s={0.75} />
        <Leaf x={752} y={22} r={-46} s={0.85} />
        <Leaf x={846} y={44} r={26}  s={0.7} />
      </g>
      <Bloom x={244} y={30} s={0.85} />
      <Bloom x={596} y={30} s={0.75} hue="#ffd9ef" />
    </svg>
  );
}

// The bottom runner crawling along the lower border
function BottomVine() {
  return (
    <svg className="cv-svg cv-bot" viewBox="0 0 900 90"
      preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
      <path d="M-10 56 C 110 78, 220 28, 330 58 C 430 84, 520 32, 620 60 C 730 84, 820 30, 910 54"
        stroke="#12300f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M-10 56 C 110 78, 220 28, 330 58 C 430 84, 520 32, 620 60 C 730 84, 820 30, 910 54"
        stroke="#2c6a28" strokeWidth="2.8" fill="none" strokeLinecap="round"
        transform="translate(-1 1.4)" />
      <path className="cv-glow cv-glow-b"
        d="M140 50 C 240 76, 340 30, 460 58 C 560 82, 680 34, 780 56"
        stroke="#c86bff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <g className="cv-leaves">
        <Leaf x={90}  y={62} r={140} s={0.8} />
        <Leaf x={210} y={40} r={-30} s={0.7} />
        <Leaf x={320} y={64} r={148} s={0.85} />
        <Leaf x={440} y={42} r={-24} s={0.72} />
        <Leaf x={550} y={66} r={142} s={0.8} />
        <Leaf x={670} y={44} r={-32} s={0.75} />
        <Leaf x={780} y={64} r={146} s={0.85} />
        <Leaf x={870} y={46} r={-28} s={0.7} />
      </g>
      <Bloom x={280} y={54} s={0.85} />
      <Bloom x={610} y={56} s={0.75} hue="#ffd9ef" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THE FRAME
// ─────────────────────────────────────────────────────────────────────────────
// The metal itself is painted by CSS on `.camp` (chamfer + machined border);
// this component supplies only what CSS cannot express as a border: the wood
// inlays, the four riveted corner plates, and the gem.
//
// A rivet is a three-stop radial gradient — bright upper-left, dark lower-
// right, and a seat shadow — i.e. a tiny sphere, lit like every other sphere
// on screen. Four per plate. They are what turn a rectangle into a fabricated
// part, and they cost nothing.
function CornerPlate({ pos }) {
  return (
    <span className={`cf-plate cf-plate-${pos}`}>
      <i className="cf-rivet cf-r1" /><i className="cf-rivet cf-r2" />
      <i className="cf-rivet cf-r3" /><i className="cf-rivet cf-r4" />
    </span>
  );
}

export default function CampFrame() {
  return (
    <div className="camp-frame" aria-hidden>
      {/* Wood inlay bands. Warm grain against cold metal — the reference's
          quietest detail and the one that stops the frame reading as plastic. */}
      <span className="cf-wood cf-wood-top" />
      <span className="cf-wood cf-wood-bot" />

      {/* The machined inner rail, inset from the outer band, so the frame is a
          DOUBLE frame rather than one thick edge. */}
      <span className="cf-rail" />

      <CornerPlate pos="tl" /><CornerPlate pos="tr" />
      <CornerPlate pos="bl" /><CornerPlate pos="br" />

      {/* The gem. Its halo is a sibling behind it rather than a box-shadow on
          the gem itself, because the gem is clip-pathed into a diamond and a
          clipped element cannot paint outside its own shape — a trap this
          codebase has already been bitten by twice. */}
      <span className="cf-gem-halo" />
      <span className="cf-gem"><i /></span>

      {/* Vines LAST so they sit over everything metal. */}
      <div className="camp-vines">
        <TopVine />
        <BottomVine />
        <EdgeVine />
        <EdgeVine flip />
      </div>
    </div>
  );
}
