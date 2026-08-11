import React, { useId } from 'react';

// =============================================
// THE CHARACTER, DRAWN ONCE
// =============================================
// `heroShape.js` opens with "ONE SOURCE OF TRUTH" because the in-game hero and
// the equipment paperdoll had drifted into two unrelated drawings. Then the
// Character panel and the intro were each written with a third and fourth
// drawing of their own, and drifted exactly the same way:
//
//   in-game     — heroShape rig, cigar, headband deliberately removed
//   paperdoll   — heroShape rig, cigar + headband
//   Character   — its own hand-written SVG, its own coordinates
//   intro       — a DIFFERENT teardrop entirely, no cigar, no headband,
//                 no rarity colour: a plain blue blob
//
// Timmy called it a bug, and it is one: the intro is supposed to introduce the
// character it does not show. Every non-gameplay view now renders THIS, so
// "everything except in-game has the cigar and a rarity-coloured headband" is
// a property of one component instead of a thing three files have to remember.
//
// In-game stays separate on purpose — it is drawn in PixiJS Graphics at ~30px
// across, where none of this detail resolves.
//
// Animated in CSS (`.ch-*` rules in overhaul.css) rather than with a frame
// loop: these panels sit open while the player reads them, and a rAF running
// the whole time to blink an eye is not worth it.

export default function HeroFigure({
  // Rarity tint for the body and the glow.
  rarColor = '#4dc4ff',
  // The bandage. Defaults to the rarity colour so evolving visibly re-wraps
  // him — the same field the in-game renderer reads, so the views agree.
  bandColor,
  cigar = true,
  band = true,
  className = '',
  style,
  ...rest
}) {
  // Gradients and clip paths are referenced by `url(#id)`, which resolves to
  // the FIRST match in the document. Two of these on one screen — an intro
  // drop behind a panel, say — would silently make the second one paint in the
  // first one's colours. `useId` is per-instance, so they cannot collide.
  const uid = useId().replace(/:/g, '');
  const idBody = `hfBody${uid}`;
  const idGlow = `hfGlow${uid}`;
  const idClip = `hfClip${uid}`;
  const bc = bandColor || rarColor;

  // The body outline, written once and reused as the clip path. The bandage is
  // clipped to it so a rectangle that cannot taper still ends exactly where the
  // head does at every height — without this the wraps hung 17px off each side
  // at the top and read as a plank driven through him.
  const BODY = 'M50 10 C50 10 84 56 84 78 A34 34 0 0 1 16 78 C16 56 50 10 50 10 Z';

  return (
    <svg className={`hero-figure ${className}`} viewBox="0 0 100 128" style={style} aria-hidden="true" {...rest}>
      <defs>
        <linearGradient id={idBody} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="38%" stopColor={rarColor} />
          <stop offset="100%" stopColor="#06121e" />
        </linearGradient>
        <radialGradient id={idGlow} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor={rarColor} stopOpacity="0.75" />
          <stop offset="100%" stopColor={rarColor} stopOpacity="0" />
        </radialGradient>
        <clipPath id={idClip}><path d={BODY} /></clipPath>
      </defs>

      <ellipse cx="50" cy="62" rx="46" ry="50" fill={`url(#${idGlow})`} />
      <path d={BODY} fill={`url(#${idBody})`} stroke="#06121e" strokeWidth="2.5" />
      {/* Meniscus rim + internal refraction, the read that makes him look full
          of water rather than like a coloured shell. */}
      <path d="M50 14 C50 14 80 57 80 78 A30 30 0 0 1 20 78 C20 57 50 14 50 14 Z"
        fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.4" />
      <ellipse cx="38" cy="58" rx="9" ry="14" fill="#ffffff" opacity="0.5" transform="rotate(-18 38 58)" />
      <ellipse cx="50" cy="92" rx="26" ry="7" fill="#ffffff" opacity="0.12" />

      {/* Angry brows — the single most characterful line on him, which is why
          the bandage is kept clear of them. */}
      {/* Classed so callers can act with them — the intro angles these on its
          resolve beat. Without the class that beat would silently do nothing,
          which is exactly what happened to the old `.intro-brow` rules when
          this component replaced the intro's own drawing. */}
      <g className="ch-brows" stroke="#08202e" strokeWidth="3.4" strokeLinecap="round">
        <line className="ch-brow l" x1="30" y1="53" x2="44" y2="58" />
        <line className="ch-brow r" x1="70" y1="53" x2="56" y2="58" />
      </g>

      <g className="ch-eyes">
        <ellipse cx="38" cy="64" rx="7.5" ry="8.5" fill="#f2fbff" />
        <ellipse cx="62" cy="64" rx="7.5" ry="8.5" fill="#f2fbff" />
        <circle cx="39" cy="65" r="4.6" fill="#e0202e" />
        <circle cx="63" cy="65" r="4.6" fill="#e0202e" />
        <circle cx="37.4" cy="63" r="1.6" fill="#fff" opacity="0.9" />
        <circle cx="61.4" cy="63" r="1.6" fill="#fff" opacity="0.9" />
      </g>
      {/* Lids close from the TOP down by animating `height`; a scaleY would
          close toward the rect's own centre and expose the eye underneath. */}
      <g className="ch-lids" fill="#1a6f96">
        <rect x="30" y="55" width="16" height="0" rx="2" />
        <rect x="54" y="55" width="16" height="0" rx="2" />
      </g>

      <path d="M42 80 Q50 77 60 79" fill="none" stroke="#08202e" strokeWidth="3" strokeLinecap="round" />

      {cigar && (<>
        <g className="ch-cigar" transform="rotate(14 60 79)">
          <rect x="60" y="75.5" width="26" height="5.5" fill="#6b5230" />
          <rect x="66" y="75.5" width="3.4" height="5.5" fill="#b8873a" />
          <circle className="ch-ember" cx="86.5" cy="78.2" r="2.6" fill="#ffb347" />
        </g>
        <g className="ch-smoke" fill="#dddddd">
          <circle cx="88" cy="74" r="2.2" />
          <circle cx="90" cy="68" r="3" />
          <circle cx="87" cy="61" r="3.8" />
        </g>
      </>)}

      {band && (
        <g className="ch-band">
          {/* Wraps clipped to the body; knot and tails hang off it, so they
              stay outside the clip. The knot sits at x=70 because that is
              where the silhouette actually is at y=41 — at the old x=84 it
              floated in empty space beside his head. */}
          <g clipPath={`url(#${idClip})`}>
            <rect x="10" y="29" width="80" height="7" rx="1.5" fill={bc} transform="rotate(-3 50 32)" />
            <rect x="10" y="36" width="80" height="8" rx="1.5" fill={bc} transform="rotate(2 50 40)" />
            <rect x="10" y="44" width="80" height="6" rx="1.5" fill={bc} transform="rotate(-1 50 47)" />
            <g stroke="#000" strokeOpacity="0.26" strokeWidth="1">
              <line x1="10" y1="36" x2="90" y2="35" />
              <line x1="10" y1="44" x2="90" y2="45" />
            </g>
          </g>
          <circle cx="70" cy="41" r="5.5" fill={bc} stroke="#000" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M70 37 L94 52 L92 57 L70 44 Z" fill={bc} opacity="0.92" />
          <path d="M70 41 L88 61 L84 64 L69 47 Z" fill={bc} opacity="0.82" />
        </g>
      )}
    </svg>
  );
}
