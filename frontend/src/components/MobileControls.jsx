import React, { useEffect, useRef, useState } from 'react';
import GameIcon from './GameIcon';
// The swipe maths lives in game/gestures.js so the plain-node test suite can
// reach it — see test/gestures.test.mjs. Keeping a copy here as well is exactly
// how the thresholds would drift apart.
import { judgeSwipe, hasSettled, SWIPE_WIN_MS } from '../game/gestures';

// =============================================================
// Twin joystick dials — bespoke to Waterdrop Survivor.
//
// Deliberately NOT a generic ring-in-a-box: each stick is a faceted
// instrument dial drawn as inline SVG (cut-corner outer plate, notched
// bezel, tick bar, engraved "H2O" mark) so it reads as this game's own
// hardware rather than a stock virtual pad.
//
// ── THE INSTRUMENT PANEL (Timmy's spec) ───────────────────────────
// "de är joysticken inbyggt ikon å knapp" — and, when the first attempt
// still read as chips parked on the rim: "joystickarna [ska] faktiskt
// [va] byggda från grunden för å hålla just dom ikonerna inte lägga dom
// utanpå bygg in dom i ramen … de ska va ram runt joysticken ska ha som
// hål å ram för dom på olika vis".
//
// So the SOCKET IS PART OF THE DIAL. `JoyDial` draws a machined housing
// growing out of the plate's top edge with a hole milled through it, and
// the instrument is a small button seated in that hole. Both the hole and
// the button's box derive from one `SOCKET` entry via `socketBox()`, so
// they cannot drift apart — which is exactly how the previous floating
// pod ended up 12px above its own housing.
//
// The two sides get different sockets on purpose ("på olika vis"):
//
//   LEFT  = the one ACTIVE SKILL, in a CRESCENT bay curving with the
//           bezel ("gör den vänstra lite typ halv måne inbyggd").
//           The WHOLE left plate is also the DASH meter: it sits darkened
//           and light builds from the bottom up as the dash recharges.
//   RIGHT = the one ABILITY, in a RECTANGULAR window — the shape he
//           approved ("de bra form på högra"), a screen set into a car
//           headrest seen from the back seat.
//
// Both are ~half the size of the first attempt ("typ 50% mindre"), which
// is why the cooldown reads as LIGHT ON THE LOGO rather than as digits:
// "cooldown som visar me ljus eller mätare där på loggan". Each glyph
// comes from the equipped entry, so the marks follow the loadout.
//
// While an ability is RUNNING the readout switches from "recharging" to
// "time remaining" and drains instead of filling. That is why the engine
// reports activeT / activeMax per skill — the UI must never guess a
// duration.
//
// Touch listeners live on document with passive:false so the browser
// can't steal the gesture for zoom/scroll.
// =============================================================

const MAX_D = 35;         // 0.80 of the old 44, matching the DIAL rescale
// SVG viewBox size, so half of it is the layout radius. 20% down from 176:
// the dials were crowding the combo meter that sits between them, and the
// toast banner had nowhere to go at the bottom of the screen.
//
// Changed here rather than with a CSS transform on `.joy-dial` on purpose —
// the edge clamping, the home positions and the touch anchoring all derive
// from this constant, so scaling only the visual would leave the hit area at
// the old size and the two would silently disagree.
const DIAL = 141;
// EVERY number below this line that describes the dial's artwork is in
// viewBox units, and the viewBox is 176 wide however big the dial actually
// renders. So converting one to CSS pixels means multiplying by S. Mixing
// the two is what broke the pad after the rescale:
//
//   - the SVG was positioned at `origin - DIAL/2` (141) while its CSS box was
//     still 176 wide, so the dial drew 17.5px down-and-right of its own
//     centre while the knob sat correctly on the centre.
//   - the skill pod was seated at `BEZEL_R` (62) CSS px from the centre, but
//     the bezel it seats into is only 62 × S ≈ 50px out, so it floated 12px
//     above its housing.
//
// Both are derived, not restated, so the artwork and the layout cannot
// disagree again at any dial size.
const VIEWBOX = 176;
const S = DIAL / VIEWBOX;
// ── The binnacle: viewBox room ABOVE the plate ───────────────────────
// Timmy: "de ska va ram runt joysticken ska ha som hål å ram för dom på olika
// vis" and "joystickarna faktiskt är byggda från grunden för å hålla just dom
// ikonerna inte lägga dom utanpå". So the socket that holds each instrument is
// drawn INSIDE the dial's own SVG, as a housing growing out of the octagon's
// top edge with a HOLE milled through it — not a separate element positioned
// to overlap. That needs canvas above the plate, so the viewBox is extended
// upward by VB_TOP and the element is offset up by the same amount in CSS.
// The dial itself still sits at (88, 88) and its artwork is untouched.
const VB_TOP = 32;
const SVG_H = DIAL * (VIEWBOX + VB_TOP) / VIEWBOX;   // rendered height, CSS px
const SVG_UP = DIAL * VB_TOP / VIEWBOX;              // how far it reaches above the dial
const BEZEL_R = 62;       // SVG radius the charge arc is stroked on
const BEZEL_C = 2 * Math.PI * BEZEL_R;
// (There used to be a BEZEL_R_PX here, converting that radius into CSS pixels so
// the old floating skill pod could be positioned off it. The instruments are
// milled into the dial's own SVG now and derive their boxes from SOCKET via
// socketBox(), so nothing needs the CSS-pixel form any more. Deleted rather than
// left sitting unused — an unread constant is the first half of a dead-config bug.)
// Knob radius in CSS px. Load-bearing again: the knob's rendered size comes
// from this, so `KNOB_R + MAX_D` (the furthest the bead can travel from the
// centre) stays inside the plate at any dial size.
const KNOB_R = 21;
// ── The two sockets ─────────────────────────────────────────────────
// Described ONCE, in viewBox units, and everything else derives from it: the
// hole milled into the housing, the frame around the hole, and the CSS box of
// the button that sits in it. Two numbers in two files describing one socket is
// how the old pod ended up floating 12px above its housing.
//
// Roughly HALF the size of the first attempt ("typ 50% mindre"), which is what
// forced the cooldown onto the LOGO as light rather than as digits — Timmy:
// "cooldown som visar me ljus eller mätare där på loggan".
//
//   LEFT  — a CRESCENT window curving with the bezel, holding the ACTIVE
//           SKILL. "gör den vänstra lite typ halv måne inbyggd".
//   RIGHT — the rectangular window, shape kept because he liked it ("de bra
//           form på högra"), holding the ABILITY.
// THE RADII ARE LOAD-BEARING, and the first attempt got them wrong in a way
// that is worth writing down. The plate is an octagon of vertex-radius 84, so
// its top EDGE — a flat, not a vertex — sits at `84 × cos(π/8) = 77.6`, i.e.
// y = 10.4. A socket with `rIn: 84` therefore began 6 units ABOVE the plate and
// floated over it, which is exactly the "lagd utanpå" Timmy rejected. Both
// sockets now start well inside that 77.6 line so the hole is genuinely milled
// THROUGH the frame, overlapping the tick band on its way.
const SOCKET = {
  // Crescent: an annulus sector centred on the dial, so it is a slice of a ring
  // concentric with the bezel and cannot help but follow its curve.
  // rIn 68 → inner edge at y=20, inside the plate; rOut 96 → the bay bulges
  // 18 units proud of the top edge, which is the binnacle.
  left:  { kind: 'crescent', rOut: 96, rIn: 68, halfDeg: 27 },
  // Window: a rounded rectangle whose lower third overlaps the plate.
  right: { kind: 'window', w: 62, h: 34, cy: 2 },
};
// Derived CSS geometry per side: the button's box, and how far above the dial
// centre it sits.
const socketBox = (side) => {
  const s = SOCKET[side];
  if (s.kind === 'crescent') {
    const rMid = (s.rOut + s.rIn) / 2;
    // Inset the chord a little from the full sector so the button's corners
    // stay inside the curved hole instead of poking out past its ends.
    const half = (s.halfDeg - 4) * Math.PI / 180;
    return { w: 2 * rMid * Math.sin(half) * S, h: (s.rOut - s.rIn) * S, up: rMid * S };
  }
  return { w: s.w * S, h: s.h * S, up: (88 - s.cy) * S };
};

// ── Two-thumb double-tap: the ABILITY trigger ────────────────────────
// Timmy: release both sticks, then land both thumbs together twice. It fires
// on the SECOND landing. Requiring both thumbs is what keeps it off the
// dash/steer gestures entirely — no single-thumb motion can reach it.
const TAP_HOLD_MAX = 280;   // a "tap" must lift again within this
const TAP_GAP_MAX  = 320;   // ms allowed between lifting and landing again

// Resting position each dial returns to when untouched. The dials are
// dynamic — they relocate to wherever the thumb lands — but they still need
// a home so the pad is visible and readable before you touch anything.
const homeOrigin = () => ({
  left:  { x: 74, y: window.innerHeight - 133 },
  right: { x: window.innerWidth - 74, y: window.innerHeight - 133 },
});
// Keep a relocated dial fully on screen.
const clampOrigin = (x, y) => ({
  x: Math.max(DIAL / 2 + 4, Math.min(window.innerWidth - DIAL / 2 - 4, x)),
  y: Math.max(DIAL / 2 + 4, Math.min(window.innerHeight - DIAL / 2 - 4, y)),
});
const computeVec = (c, touchX, touchY) => {
  const dx = touchX - c.x;
  const dy = touchY - c.y;
  const dist = Math.hypot(dx, dy) || 1;
  const cl = Math.min(dist, MAX_D);
  return { vx: (dx / dist) * (cl / MAX_D), vy: (dy / dist) * (cl / MAX_D) };
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Cut-corner octagonal plate path, centred in the 176x176 viewBox. Drawn
// as a ring (outer octagon + inner circle hole, evenodd) so the plate is
// a bezel around the live stick area rather than a slab behind it.
function octagonPath(cx, cy, r, cut) {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i * Math.PI) / 4 - Math.PI / 8;
    const a1 = a0 + Math.PI / 4;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    // chamfer each vertex by `cut` px along both incident edges
    const ex = x1 - x0, ey = y1 - y0, el = Math.hypot(ex, ey) || 1;
    const ux = ex / el, uy = ey / el;
    p.push(`${i === 0 ? 'M' : 'L'}${(x0 + ux * cut).toFixed(1)},${(y0 + uy * cut).toFixed(1)}`);
    p.push(`L${(x1 - ux * cut).toFixed(1)},${(y1 - uy * cut).toFixed(1)}`);
  }
  return p.join(' ') + ' Z';
}

/**
 * An annulus sector centred on the dial — the crescent socket's shape. Angles
 * are measured from 12 o'clock so the maths reads the way the dial looks.
 */
function sectorPath(rOut, rIn, halfDeg, cx = 88, cy = 88) {
  const a = (halfDeg * Math.PI) / 180;
  const pt = (r, sign) => [cx + sign * r * Math.sin(a), cy - r * Math.cos(a)];
  const [oxL, oyL] = pt(rOut, -1), [oxR, oyR] = pt(rOut, 1);
  const [ixL, iyL] = pt(rIn, -1),  [ixR, iyR] = pt(rIn, 1);
  const f = (n) => n.toFixed(2);
  return `M${f(oxL)},${f(oyL)} A${rOut},${rOut} 0 0,1 ${f(oxR)},${f(oyR)}`
       + ` L${f(ixR)},${f(iyR)} A${rIn},${rIn} 0 0,0 ${f(ixL)},${f(iyL)} Z`;
}

/** The socket hole for one side, plus the housing it is milled into. */
function socketShapes(side) {
  const s = SOCKET[side];
  if (s.kind === 'crescent') {
    return {
      // Housing is the same sector, grown outward on every edge so a frame
      // of metal shows all the way round the hole.
      housing: sectorPath(s.rOut + 9, s.rIn - 9, s.halfDeg + 5),
      hole:    sectorPath(s.rOut, s.rIn, s.halfDeg),
      lip:     sectorPath(s.rOut + 3.5, s.rIn - 3.5, s.halfDeg + 2),
    };
  }
  return { kind: 'window' };
}

// 24 tick marks around the bezel; every 6th is a long "cardinal" tick.
const TICKS = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
  const long = i % 6 === 0;
  const r0 = long ? 68 : 71;
  const r1 = 76;
  return {
    x1: 88 + Math.cos(a) * r0, y1: 88 + Math.sin(a) * r0,
    x2: 88 + Math.cos(a) * r1, y2: 88 + Math.sin(a) * r1,
    long,
  };
});

/**
 * One dial. `charge` is 0..1 (1 = fully recharged / ready). `armed` means
 * the ability the dial reports actually exists — when false the dial stays
 * inert and shows no charge arc.
 */
function JoyDial({ side, accent, charge, armed, active, origin, dashFill, dashLocked, hasSocket }) {
  const cls = [
    'joy-dial', `joy-dial-${side}`,
    active ? 'is-active' : '',
    armed && charge >= 1 ? 'is-ready' : '',
    armed && charge < 1 ? 'is-charging' : '',
    // A dash you have not bought yet used to be completely silent: `tryDash`
    // returns at `if (!s.dash) return` and the stick gave no hint why nothing
    // happened. POLISH-PASS.md's joystick spec calls this out — "a locked dash
    // must look locked on the dial, not silently do nothing".
    dashLocked ? 'dash-locked' : '',
  ].filter(Boolean).join(' ');

  // Arc grows clockwise from 12 o'clock as the ability recharges.
  const dash = BEZEL_C * Math.max(0, Math.min(1, charge));
  const sock = socketShapes(side);
  const win = SOCKET[side];
  // The plate spans y 4..172 (octagon of r=84 about cy=88), so the dash light
  // fills that span from the bottom up and the un-recharged part above the
  // waterline is masked dark.
  const PLATE_TOP = 4, PLATE_SPAN = 168;
  const df = dashFill === undefined ? 1 : Math.max(0, Math.min(1, dashFill));
  const darkH = PLATE_SPAN * (1 - df);

  return (
    <svg className={cls} viewBox={`0 ${-VB_TOP} ${VIEWBOX} ${VIEWBOX + VB_TOP}`} aria-hidden
         style={{
           '--joy-accent': accent, '--joy-charge': charge,
           // Size set here, not in CSS. `left/top` centre the dial by
           // subtracting half its width, which is only true while the width
           // really is DIAL — so the two have to come from the same constant
           // or the dial drifts off its own centre the moment either changes.
           // The height is taller than the width now (the binnacle lives above
           // the plate), so `top` also backs off by SVG_UP or the whole dial
           // would sit VB_TOP units too low.
           width: `${DIAL}px`, height: `${SVG_H}px`,
           left: `${origin.x - DIAL / 2}px`, top: `${origin.y - DIAL / 2 - SVG_UP}px`,
         }}>
      <defs>
        <radialGradient id={`joyWell-${side}`} cx="50%" cy="42%" r="62%">
          <stop offset="0%"   stopColor="#0d1a2a" stopOpacity="0.62" />
          <stop offset="70%"  stopColor="#050b14" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#02060c" stopOpacity="0.10" />
        </radialGradient>
        <linearGradient id={`joyPlate-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.20" />
          <stop offset="55%"  stopColor={accent} stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
        {/* Machined housing: light from above, so the top edge catches and the
            underside falls into shadow where it meets the plate. */}
        <linearGradient id={`joyHouse-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7d90a3" />
          <stop offset="34%"  stopColor="#3a4a5c" />
          <stop offset="72%"  stopColor="#1a2431" />
          <stop offset="100%" stopColor="#0a1018" />
        </linearGradient>
        {/* The hole. Dark, with the shadow strongest under its top edge —
            that gradient is the whole reason it reads as depth and not paint. */}
        <linearGradient id={`joyHole-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#000000" stopOpacity="0.96" />
          <stop offset="45%"  stopColor="#050b14" stopOpacity="0.90" />
          <stop offset="100%" stopColor="#0d1826" stopOpacity="0.82" />
        </linearGradient>
        {/* Clip for the dash light, so it can darken the WHOLE stick without
            leaking outside the plate's chamfered silhouette. */}
        <clipPath id={`joyPlateClip-${side}`}>
          <path d={octagonPath(88, 88, 84, 13)} />
        </clipPath>
      </defs>

      {/* recessed well the knob rides in */}
      <circle cx="88" cy="88" r="60" fill={`url(#joyWell-${side})`} />

      {/* faceted bezel plate — octagon outside, circular cutout inside */}
      <path
        d={`${octagonPath(88, 88, 84, 13)} M88,88 m-62,0 a62,62 0 1,0 124,0 a62,62 0 1,0 -124,0`}
        fillRule="evenodd"
        fill={`url(#joyPlate-${side})`}
        stroke={accent} strokeOpacity="0.22" strokeWidth="1.2"
      />

      {/* tick bar */}
      <g className="joy-ticks" stroke={accent}>
        {TICKS.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                strokeWidth={t.long ? 2 : 1}
                strokeOpacity={t.long ? 0.34 : 0.16} strokeLinecap="round" />
        ))}
      </g>

      {/* unlit bezel track */}
      <circle className="joy-track" cx="88" cy="88" r={BEZEL_R}
              fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="5" />

      {/* the charge light itself — this is the cooldown readout */}
      {armed && (
        <circle className="joy-charge" cx="88" cy="88" r={BEZEL_R}
                fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${dash} ${BEZEL_C}`}
                transform="rotate(-90 88 88)" />
      )}

      {/* engraved brand mark */}
      <text className="joy-mark" x="88" y="95" textAnchor="middle" fill={accent}>
        H<tspan className="joy-mark-sub" dy="5">2</tspan><tspan dy="-5">O</tspan>
      </text>

      {/* corner chevrons — small hardware detail on the diagonals */}
      <g stroke={accent} strokeOpacity="0.30" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M31,31 l0,9 M31,31 l9,0" />
        <path d="M145,31 l0,9 M145,31 l-9,0" />
        <path d="M31,145 l0,-9 M31,145 l9,0" />
        <path d="M145,145 l0,-9 M145,145 l-9,0" />
      </g>

      {/* ══ DASH COOLDOWN — the WHOLE stick, filling bottom to top ══════
          Timmy: "hela vänstra joysticken visa ljus darked out underifrån ljus
          bygger up till max hela joysticken från botten å upp de är dash
          cooldown". Drawn as a dark mask over the part that has NOT recharged
          yet, clipped to the plate, and placed AFTER every piece of dial
          artwork so it dims all of it at once — but BEFORE the housing, which
          carries its own instrument and must stay legible while dash is down.
          Only the left stick has a dash. */}
      {dashFill !== undefined && (
        <g clipPath={`url(#joyPlateClip-${side})`}>
          {darkH > 0.5 && (
            <rect x="0" y={PLATE_TOP} width={VIEWBOX} height={darkH}
                  fill="#02060c" opacity="0.74" />
          )}
          {/* The waterline. Suppressed at both extremes: at full charge there
              is no surface, and at empty it would sit on the plate's rim. */}
          {df > 0.015 && df < 0.985 && (
            <rect x="0" y={PLATE_TOP + darkH - 1.8} width={VIEWBOX} height="1.8"
                  fill="#dffcff" opacity="0.8" />
          )}
          {/* DASH gets its own mark, so the light has an identity rather than
              being an unexplained glow — two chevrons pointing the way you
              travel, engraved low on the plate inside the lit zone.
              Timmy: "abilityn loggon ska ha dash också" — dash is a thing with
              a mark, not just a bar of light. */}
          {!dashLocked && (
            <g stroke={accent} strokeWidth="2.4" fill="none"
               strokeLinecap="round" strokeLinejoin="round"
               opacity={0.28 + df * 0.5}>
              <path d="M74,150 l7,7 l-7,7" />
              <path d="M85,150 l7,7 l-7,7" />
            </g>
          )}
          {/* LOCKED: a padlock in place of the chevrons. Without this, an
              unbought dash and a fully-drained dash look identical — both are
              just a dark plate — and the player has no way to tell "wait" from
              "you never bought this". */}
          {dashLocked && (
            <g className="joy-dash-lock" stroke="#7b8794" strokeWidth="2.2"
               fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="77" y="152" width="22" height="15" rx="2.5" fill="#0a1018" />
              <path d="M82,152 v-5 a6,6 0 0,1 12,0 v5" />
              <circle cx="88" cy="159" r="1.8" fill="#7b8794" stroke="none" />
            </g>
          )}
        </g>
      )}

      {/* ══ THE BINNACLE — housing + milled hole + frame ════════════════
          This is the "ram runt joysticken … hål å ram för dom": a machined
          housing growing out of the plate's top edge with a hole through it,
          drawn in the DIAL's own SVG so the instrument is genuinely set into
          the frame instead of laid over it. The two sides get different frames
          on purpose ("på olika vis") — a curved crescent bay on the left, a
          square-shouldered window on the right. */}
      {hasSocket && win.kind === 'crescent' && (
        <g>
          <path d={sock.housing} fill={`url(#joyHouse-${side})`}
                stroke="#000" strokeOpacity="0.75" strokeWidth="1.2" />
          {/* raised inner lip catching the light */}
          <path d={sock.lip} fill="none" stroke="#9fb2c4" strokeOpacity="0.34" strokeWidth="1.6" />
          <path d={sock.hole} fill={`url(#joyHole-${side})`}
                stroke="#000" strokeOpacity="0.9" strokeWidth="1.4" />
          {/* two bolts through the flanks of the bay */}
          <g>
            <circle cx="38" cy="24" r="2.4" fill="#8c9bab" stroke="#0a1018" strokeWidth="0.9" />
            <circle cx="138" cy="24" r="2.4" fill="#8c9bab" stroke="#0a1018" strokeWidth="0.9" />
          </g>
        </g>
      )}
      {hasSocket && win.kind === 'window' && (
        <g>
          {/* skirt: the housing flares down into the plate so it grows out of
              the dial rather than balancing on it */}
          <path d={`M${88 - win.w / 2 - 9},${win.cy - win.h / 2 - 8}
                    L${88 + win.w / 2 + 9},${win.cy - win.h / 2 - 8}
                    L${88 + win.w / 2 + 15},${win.cy + win.h / 2 + 14}
                    L${88 - win.w / 2 - 15},${win.cy + win.h / 2 + 14} Z`}
                fill={`url(#joyHouse-${side})`}
                stroke="#000" strokeOpacity="0.75" strokeWidth="1.2" />
          <rect x={88 - win.w / 2 - 3.5} y={win.cy - win.h / 2 - 3.5}
                width={win.w + 7} height={win.h + 7} rx="5"
                fill="none" stroke="#9fb2c4" strokeOpacity="0.34" strokeWidth="1.6" />
          <rect x={88 - win.w / 2} y={win.cy - win.h / 2}
                width={win.w} height={win.h} rx="3.5"
                fill={`url(#joyHole-${side})`}
                stroke="#000" strokeOpacity="0.9" strokeWidth="1.4" />
          <g>
            <circle cx={88 - win.w / 2 - 6} cy={win.cy - win.h / 2 + 1} r="2.2" fill="#8c9bab" stroke="#0a1018" strokeWidth="0.9" />
            <circle cx={88 + win.w / 2 + 6} cy={win.cy - win.h / 2 + 1} r="2.2" fill="#8c9bab" stroke="#0a1018" strokeWidth="0.9" />
            <circle cx={88 - win.w / 2 - 6} cy={win.cy + win.h / 2 - 1} r="2.2" fill="#8c9bab" stroke="#0a1018" strokeWidth="0.9" />
            <circle cx={88 + win.w / 2 + 6} cy={win.cy + win.h / 2 - 1} r="2.2" fill="#8c9bab" stroke="#0a1018" strokeWidth="0.9" />
          </g>
        </g>
      )}
    </svg>
  );
}

/**
 * The instrument that sits IN a socket. One component for both sides — the
 * socket's shape and frame belong to the dial (see JoyDial), so all this
 * carries is the readout: the logo, and its cooldown as light on that logo.
 *
 * Timmy: "cooldown som visar me ljus eller mätare där på loggan" — at this
 * size (roughly half the first attempt) digits alone would be unreadable, so
 * the primary readout is a ring meter drawn around the icon and the icon's own
 * brightness. The number is secondary, beside it.
 *
 * `mode` is 'active' while a buff is running (the ring DRAINS and goes gold),
 * otherwise 'charging' or 'ready'.
 */
function Instrument({ side, skill, mode, t, label, onFire, box }) {
  const ready = mode === 'ready';
  const running = mode === 'active';
  return (
    <button
      className={`joy-inst joy-inst-${side}${ready ? ' ready' : ''}${running ? ' running' : ''}`}
      data-joy-skill={side}
      data-testid={`joy-inst-${side}`}
      title={skill.name}
      style={{
        left: `${box.x}px`, top: `${box.y}px`,
        width: `${box.w}px`, height: `${box.h}px`,
        '--chg': t,
      }}
      onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onFire(); }}
      onClick={(e) => { e.stopPropagation(); onFire(); }}
    >
      {/* The logo, wearing its own cooldown as a ring of light. The icon comes
          from the equipped skill, so the mark changes with the loadout —
          "måste byta ikon logga utefter aktiv skill å högra byter efter vilken
          ability de är". */}
      <span className="joy-inst-logo" aria-hidden>
        <span className="joy-inst-ring" />
        <span className="joy-inst-icon"><GameIcon name={skill.icon} size={Math.round(box.h * 0.52)} /></span>
      </span>
      <span className={`joy-inst-read${running ? ' hot' : ''}`}>{label}</span>
      {/* Glass over the recess, lit from the upper left like everything else. */}
      <span className="joy-inst-glass" aria-hidden />
    </button>
  );
}


export default function MobileControls({
  onUpdate, onDashDir, onSwipeAttack, dashCD = 0, dashMaxCD = 2.4, dashReady = true, fireOnAim = true,
  swipeAttackUnlocked = false, swipeAttackCD = 0, swipeAttackMaxCD = 1.1,
  visible = true, activeSkills = [], onActiveSkill,
}) {
  const [show, setShow] = useState(false);
  const [leftVis,  setLeftVis]  = useState({ active: false, vx: 0, vy: 0 });
  const [rightVis, setRightVis] = useState({ active: false, vx: 0, vy: 0 });
  // Dials relocate to wherever the thumb lands and return home on release.
  // originRef is what the touch maths reads (synchronous, no render needed);
  // origin state exists only so the DOM follows.
  const [origin, setOrigin] = useState(homeOrigin);
  const originRef = useRef(origin);
  originRef.current = origin;

  const leftVec   = useRef({ vx: 0, vy: 0 });
  const rightVec  = useRef({ vx: 0, vy: 0 });
  const tracking  = useRef({ left: null, right: null });
  // Rolling gesture samples per side, judged by judgeSwipe(). `armed` goes
  // false after a gesture fires and comes back once the thumb settles, so one
  // long drag can produce a second dash — but only after actually slowing
  // down, never as a continuous stream.
  const swipeBuf   = useRef({ left: [], right: [] });
  const swipeArmed = useRef({ left: true, right: true });
  const lastDash   = useRef(0);
  const lastSwipe  = useRef(0);
  // Two-thumb double-tap state machine — see TAP_* above.
  const tap = useRef({ stage: 0, landT: 0, liftT: 0 });
  const cbRef     = useRef({ onUpdate, onDashDir, onSwipeAttack, onActiveSkill });
  cbRef.current   = { onUpdate, onDashDir, onSwipeAttack, onActiveSkill };
  // The ability's index in the engine's own activeSkills array, so the
  // gesture can fire it. A ref because the touch handler is bound once.
  const abilityIdxRef = useRef(-1);

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setShow(isTouch || window.innerWidth <= 900);
  }, []);

  // Home positions are viewport-relative, so they have to be recomputed on
  // rotate/resize or the right-hand dial ends up off screen.
  useEffect(() => {
    const onResize = () => setOrigin(homeOrigin());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    if (!show || !visible) return;

    const sideOf = (cx) => cx < window.innerWidth / 2 ? 'left' : 'right';
    const pushUpdate = () => {
      const { vx: lx, vy: ly } = leftVec.current;
      const { vx: rx, vy: ry } = rightVec.current;
      const firing = fireOnAim && (Math.abs(rx) > 0.15 || Math.abs(ry) > 0.15);
      cbRef.current.onUpdate({ x: lx, y: ly }, { x: rx, y: ry }, firing);
    };
    const bothDown = () => tracking.current.left != null && tracking.current.right != null;

    const onTouchStart = (e) => {
      // Skip when UI overlays are open (level-up, pause, game-over, instruments)
      if (e.target.closest('[data-joy-skill]')) return;
      if (document.querySelector('.levelup-overlay, .modal-overlay, .pause-overlay, .gameover')) return;
      e.preventDefault();
      const wasBoth = bothDown();
      for (const t of e.changedTouches) {
        const side = sideOf(t.clientX);
        if (tracking.current[side] != null) continue;
        tracking.current[side] = t.identifier;
        // The dial jumps to the thumb, so the stick always starts centred
        // under the finger no matter where on its half you grabbed.
        const c = clampOrigin(t.clientX, t.clientY);
        originRef.current = { ...originRef.current, [side]: c };
        setOrigin(originRef.current);
        swipeBuf.current[side] = [{ x: t.clientX, y: t.clientY, t: performance.now() }];
        swipeArmed.current[side] = true;
        const vec = computeVec(c, t.clientX, t.clientY);
        if (side === 'left') { leftVec.current = vec; setLeftVis({ active: true, ...vec }); }
        else                  { rightVec.current = vec; setRightVis({ active: true, ...vec }); }
        pushUpdate();
      }

      // ── ABILITY: both thumbs landing together, twice ──────────────
      // Evaluated only on the transition INTO both-down, so a thumb
      // re-seating while the other stays put can never advance it.
      if (!wasBoth && bothDown()) {
        const now = performance.now();
        const s = tap.current;
        if (s.stage === 1 && s.liftT > 0 && now - s.liftT < TAP_GAP_MAX) {
          s.stage = 0;
          const idx = abilityIdxRef.current;
          if (idx >= 0 && cbRef.current.onActiveSkill) cbRef.current.onActiveSkill(idx);
        } else {
          s.stage = 1; s.landT = now; s.liftT = 0;
        }
      }
    };

    const onTouchMove = (e) => {
      if (tracking.current.left !== null || tracking.current.right !== null) e.preventDefault();
      const now = performance.now();
      for (const t of e.changedTouches) {
        const side = tracking.current.left === t.identifier ? 'left'
                   : tracking.current.right === t.identifier ? 'right' : null;
        if (!side) continue;
        const vec = computeVec(originRef.current[side], t.clientX, t.clientY);
        if (side === 'left') { leftVec.current = vec; setLeftVis({ active: true, ...vec }); }
        else                  { rightVec.current = vec; setRightVis({ active: true, ...vec }); }
        pushUpdate();

        // Keep only the last SWIPE_WIN_MS of motion, but never fewer than
        // three samples — a 120Hz screen fills the window with 18 points and
        // a 30Hz one with 4, and the judgement has to hold on both.
        const buf = swipeBuf.current[side];
        buf.push({ x: t.clientX, y: t.clientY, t: now });
        while (buf.length > 3 && now - buf[0].t > SWIPE_WIN_MS) buf.shift();

        if (!swipeArmed.current[side]) {
          // Re-arm once the thumb has actually settled, so a single long drag
          // cannot machine-gun the gesture.
          if (hasSettled(buf)) swipeArmed.current[side] = true;
          continue;
        }
        const hit = judgeSwipe(buf);
        if (!hit) continue;

        if (side === 'left') {
          if (now - lastDash.current > 250) {
            lastDash.current = now;
            swipeArmed.current.left = false;
            cbRef.current.onDashDir && cbRef.current.onDashDir(hit.nx, hit.ny, hit.power);
          }
        } else if (now - lastSwipe.current > 250) {
          lastSwipe.current = now;
          swipeArmed.current.right = false;
          cbRef.current.onSwipeAttack && cbRef.current.onSwipeAttack(hit.nx, hit.ny);
        }
      }
    };

    const onTouchEnd = (e) => {
      const wasBoth = bothDown();
      for (const t of e.changedTouches) {
        const side = tracking.current.left === t.identifier ? 'left'
                   : tracking.current.right === t.identifier ? 'right' : null;
        if (!side) continue;
        tracking.current[side] = null;
        // Drift back to the resting position so the pad stays legible while
        // idle (the CSS transition does the easing).
        originRef.current = { ...originRef.current, [side]: homeOrigin()[side] };
        setOrigin(originRef.current);
        swipeBuf.current[side] = [];
        if (side === 'left') {
          leftVec.current = { vx: 0, vy: 0 };
          setLeftVis({ active: false, vx: 0, vy: 0 });
        } else {
          rightVec.current = { vx: 0, vy: 0 };
          setRightVis({ active: false, vx: 0, vy: 0 });
        }
        pushUpdate();
      }
      // Leaving both-down: it only stays a candidate double-tap if it was a
      // TAP. Holding the sticks — i.e. playing normally — drops it, which is
      // what keeps ordinary movement from ever reaching the trigger.
      if (wasBoth && !bothDown() && tap.current.stage === 1) {
        const now = performance.now();
        if (now - tap.current.landT < TAP_HOLD_MAX) tap.current.liftT = now;
        else tap.current.stage = 0;
      }
    };

    document.addEventListener('touchstart',  onTouchStart,  { passive: false });
    document.addEventListener('touchmove',   onTouchMove,   { passive: false });
    document.addEventListener('touchend',    onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart',  onTouchStart);
      document.removeEventListener('touchmove',   onTouchMove);
      document.removeEventListener('touchend',    onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [show, visible, fireOnAim]);

  // ── Which slot is which instrument ───────────────────────────────
  // Picked by the engine's own `ability` flag, NOT by array position. The
  // two files used to agree only by convention — GameScreen built
  // [skill, ability] while this one hard-wired slot 0 to the LEFT dial, so
  // the ability rendered on the right and the skill on the left, exactly
  // backwards from the spec. A flag cannot drift the way a shared index can.
  const abilityIdx = activeSkills.findIndex(s => s && s.ability);
  const skillIdx   = activeSkills.findIndex(s => s && !s.ability);
  abilityIdxRef.current = abilityIdx;
  const ability = abilityIdx >= 0 ? activeSkills[abilityIdx] : null;
  const skill   = skillIdx   >= 0 ? activeSkills[skillIdx]   : null;

  /**
   * One skill's readout state, shared by both instrument shapes.
   * While the buff RUNS the needle/bar reports time remaining and drains;
   * otherwise it reports the cooldown and fills. Timmy: "While an ability is
   * ACTIVE: show its icon with time remaining. While it is not: show the
   * cooldown on the same icon."
   */
  const readout = (sk) => {
    if (!sk) return null;
    if (sk.activeT > 0 && sk.activeMax > 0) {
      return {
        mode: 'active',
        t: clamp01(sk.activeT / sk.activeMax),
        label: sk.activeT >= 10 ? String(Math.ceil(sk.activeT)) : sk.activeT.toFixed(1),
      };
    }
    if (sk.cd > 0) {
      return {
        mode: 'charging',
        t: clamp01(1 - sk.cd / (sk.maxCd || 1)),
        label: sk.cd >= 10 ? String(Math.ceil(sk.cd)) : sk.cd.toFixed(1),
      };
    }
    return { mode: 'ready', t: 1, label: 'GO' };
  };

  // Charge = how far the ability has recovered, 0..1. This is what drives
  // the dial's light: dark at 0, full brightness + pulse at 1.
  // LEFT dial's ring = dash cooldown (dash fires off a left-stick swipe, so
  // its cooldown belongs on that dial). RIGHT dial's ring = the active
  // skill's cooldown, mirroring its LCD so the two read as one instrument.
  // Swipe-attack keeps the right ring as a fallback when no skill is
  // slotted — it has no other readout anywhere, so dropping it silently
  // would make it invisible.
  const dashCharge  = !dashReady ? 0
    : dashCD <= 0 ? 1
    : Math.max(0, Math.min(1, 1 - dashCD / (dashMaxCD || 2.4)));
  const skillCharge = skill
    ? (skill.cd <= 0 ? 1 : Math.max(0, Math.min(1, 1 - skill.cd / (skill.maxCd || 1))))
    : null;
  const swipeCharge = !swipeAttackUnlocked ? 0
    : swipeAttackCD <= 0 ? 1
    : Math.max(0, Math.min(1, 1 - swipeAttackCD / (swipeAttackMaxCD || 1.1)));
  const rightCharge = skillCharge !== null ? skillCharge : swipeCharge;
  const rightArmed  = skillCharge !== null ? true : swipeAttackUnlocked;

  const abilityRead = readout(ability);
  const skillRead   = readout(skill);
  // Knob fill mirrors the instrument seated on that side, so the stick still
  // reports its state while a thumb covers the socket. The LEFT plate carries
  // the dash light separately (JoyDial's dashFill) — the knob echoes the active
  // skill instead, so the two readouts on that stick stay distinct.
  const leftFill  = skillRead ? skillRead.t : dashCharge;
  const rightFill = abilityRead ? abilityRead.t : rightCharge;
  const lBox = socketBox('left');
  const rBox = socketBox('right');

  if (!show || !visible) return null;

  return (
    <>
      {/* The LEFT bezel ring follows the active skill in its socket; the whole
          left PLATE is the dash meter, filling bottom-to-top (dashFill). The
          right ring follows the ability, falling back to swipe-attack when no
          ability is equipped so that cooldown is never invisible. */}
      <JoyDial side="left"  accent="#4dffd4"
               charge={skillCharge !== null ? skillCharge : dashCharge}
               armed={skillCharge !== null ? true : dashReady}
               active={leftVis.active} origin={origin.left}
               dashFill={dashCharge} dashLocked={!dashReady} hasSocket={!!skill} />
      <JoyDial side="right" accent="#ff9632"
               charge={abilityRead ? abilityRead.t : rightCharge}
               armed={ability ? true : rightArmed}
               active={rightVis.active} origin={origin.right}
               hasSocket={!!ability} />

      {/* Knobs — water-bead caps that ride the dial they belong to. The
          `--knob-fill` fraction lights them from the bottom upward. */}
      <div className="static-knob static-knob-left"  data-testid="joy-knob-left"
           style={{
             width: `${KNOB_R * 2}px`, height: `${KNOB_R * 2}px`,
             left: `${origin.left.x}px`, top: `${origin.left.y}px`,
             '--knob-fill': leftFill,
             transform: `translate(-50%, -50%) translate(${leftVis.vx * MAX_D}px, ${leftVis.vy * MAX_D}px)`,
           }}>
        <span className="knob-fill" />
        <span className="knob-gloss" />
      </div>
      <div className="static-knob static-knob-right" data-testid="joy-knob-right"
           style={{
             width: `${KNOB_R * 2}px`, height: `${KNOB_R * 2}px`,
             left: `${origin.right.x}px`, top: `${origin.right.y}px`,
             '--knob-fill': rightFill,
             transform: `translate(-50%, -50%) translate(${rightVis.vx * MAX_D}px, ${rightVis.vy * MAX_D}px)`,
           }}>
        <span className="knob-fill" />
        <span className="knob-gloss" />
      </div>

      {/* ── The instruments, sitting IN the sockets ────────────────────
          Both boxes come from socketBox(), which derives them from the very
          same SOCKET entry that JoyDial mills the hole from — so the button
          and its hole cannot drift apart the way the old pod did (it was
          seated at BEZEL_R in CSS px against a bezel that renders at
          BEZEL_R × S, and floated 12px above its housing as a result).

          LEFT  = the one ACTIVE SKILL, in the crescent bay.
          RIGHT = the one ABILITY, in the rectangular window.
          Timmy: "måste byta ikon logga utefter aktiv skill å högra byter
          efter vilken ability de är" — the glyph comes from the equipped
          entry, so both marks change with the loadout. */}
      {skill && onActiveSkill && (
        <Instrument
          side="left" skill={skill} mode={skillRead.mode} t={skillRead.t} label={skillRead.label}
          onFire={() => onActiveSkill(skillIdx)}
          box={{ x: origin.left.x - lBox.w / 2, y: origin.left.y - lBox.up - lBox.h / 2, w: lBox.w, h: lBox.h }}
        />
      )}
      {ability && onActiveSkill && (
        <Instrument
          side="right" skill={ability} mode={abilityRead.mode} t={abilityRead.t} label={abilityRead.label}
          onFire={() => onActiveSkill(abilityIdx)}
          box={{ x: origin.right.x - rBox.w / 2, y: origin.right.y - rBox.up - rBox.h / 2, w: rBox.w, h: rBox.h }}
        />
      )}

      <div className="joy-lbl joy-lbl-left"  style={{ left: `${origin.left.x - 90}px`,  top: `${origin.left.y + 74}px` }}>MOVE · FLICK TO DASH</div>
      <div className="joy-lbl joy-lbl-right" style={{ left: `${origin.right.x - 90}px`, top: `${origin.right.y + 74}px` }}>{swipeAttackUnlocked ? 'AIM · FLICK TO SWIPE' : 'AIM'}</div>
    </>
  );
}
