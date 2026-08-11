import React from 'react';
import { BADGE_TIERS } from '../game/badges';

// =============================================
// BADGE ICON — drawn, not an asset
// =============================================
// Same reasoning as GameIcon: emoji render differently on every platform and
// carry no tier information. A badge has to read as a *rank* at a glance from
// 22px in the camp frame and still hold up at 64px in the picker, which is
// what the Steam badge / Google Developer Program badge language does well:
//
//   - a fixed medallion silhouette shared by every badge (so they read as one
//     set), with
//   - a tier-coloured metal ring and rim light doing the ranking, and
//   - a single flat glyph in the middle carrying the meaning.
//
// The silhouette is a rounded hexagon rather than a circle so a row of them
// tessellates cleanly against the carved slots in the profile frame, and so an
// empty slot (same hexagon, hollow) is obviously the same shape waiting to be
// filled.

// 64x64 design box. The hexagon is drawn point-up with softened corners.
const HEX = 'M32 3 L56.1 17 L56.1 47 L32 61 L7.9 47 L7.9 17 Z';
const HEX_INNER = 'M32 10 L50 20.5 L50 43.5 L32 54 L14 43.5 L14 20.5 Z';

// Each glyph draws inside a 24x24 box centred at (32,32) — i.e. 20..44.
// Kept deliberately flat and single-colour: the tier ring is doing the
// decoration, and a busy glyph at 22px turns into a smudge.
function Glyph({ name, fill }) {
  const p = { fill, stroke: 'none' };
  switch (name) {
    case 'skull':
      return (
        <g {...p}>
          <path d="M32 20c-6.6 0-11 4.4-11 10.2 0 3.4 1.5 5.6 3.2 7.1v3.2c0 1 .8 1.8 1.8 1.8h12c1 0 1.8-.8 1.8-1.8v-3.2c1.7-1.5 3.2-3.7 3.2-7.1C43 24.4 38.6 20 32 20z" />
          <circle cx="27.6" cy="30.4" r="2.6" fill="#0b0716" />
          <circle cx="36.4" cy="30.4" r="2.6" fill="#0b0716" />
          <rect x="30.6" y="34.4" width="2.8" height="3.4" rx="1" fill="#0b0716" />
        </g>
      );
    case 'crown':
      return (
        <g {...p}>
          <path d="M21 40l-2-15 6.5 5L32 21l6.5 9 6.5-5-2 15z" />
          <rect x="21" y="41.4" width="22" height="3.4" rx="1.4" />
        </g>
      );
    case 'eye':
      return (
        <g {...p}>
          <path d="M32 22c-7 0-12.4 5-14 10 1.6 5 7 10 14 10s12.4-5 14-10c-1.6-5-7-10-14-10z" />
          <circle cx="32" cy="32" r="4.6" fill="#0b0716" />
          <circle cx="33.6" cy="30.4" r="1.5" fill={fill} />
        </g>
      );
    case 'infinity':
      return (
        <g fill="none" stroke={fill} strokeWidth="3.6" strokeLinecap="round">
          <path d="M26 32c0-3.3-2.4-5.6-5-5.6S16 28.7 16 32s2.4 5.6 5 5.6 5-2.3 5-5.6 2.4-5.6 5-5.6h2c2.6 0 5 2.3 5 5.6s-2.4 5.6-5 5.6-5-2.3-5-5.6" />
        </g>
      );
    case 'hourglass':
      return (
        <g {...p}>
          <rect x="22" y="20" width="20" height="3.2" rx="1.4" />
          <rect x="22" y="40.8" width="20" height="3.2" rx="1.4" />
          <path d="M25 23.2h14l-7 8.8zM25 40.8h14l-7-8.8z" />
        </g>
      );
    case 'star':
      return <path {...p} d="M32 19l4.2 8.9 9.8 1.3-7.2 6.8 1.9 9.7L32 41.1 23.3 45.7l1.9-9.7-7.2-6.8 9.8-1.3z" />;
    case 'chevron':
      return (
        <g {...p}>
          <path d="M32 18l11 9.5-3.4 3.6L32 24.4l-7.6 6.7L21 27.5z" />
          <path d="M32 30l11 9.5-3.4 3.6L32 36.4l-7.6 6.7L21 39.5z" />
        </g>
      );
    case 'compass':
      return (
        <g>
          <circle cx="32" cy="32" r="12.4" fill="none" stroke={fill} strokeWidth="3" />
          <path d="M37.6 26.4l-3.2 8.4-8.4 3.2 3.2-8.4z" fill={fill} />
        </g>
      );
    case 'trophy':
      return (
        <g {...p}>
          <path d="M25 19h14v7.2c0 4.4-3.1 7.8-7 7.8s-7-3.4-7-7.8z" />
          <path d="M22.4 20.4h-3.6v3c0 3.2 2 5.2 4.6 5.6zM41.6 20.4h3.6v3c0 3.2-2 5.2-4.6 5.6z" />
          <rect x="30" y="33.6" width="4" height="6" />
          <rect x="24.4" y="39.6" width="15.2" height="4.2" rx="1.6" />
        </g>
      );
    case 'gem':
      return (
        <g {...p}>
          <path d="M24 21h16l6 8-14 15-14-15z" opacity="0.92" />
          <path d="M24 21l-6 8h28l-6-8z" fill="#0b0716" opacity="0.28" />
        </g>
      );
    case 'leaf':
      return (
        <g {...p}>
          <path d="M43 20c-13 0-22 5.8-22 14.6 0 3.4 1.4 6.3 3.6 8.2C28 34.4 34 28.6 41 26c-5.6 3.6-10.4 9-12.6 17.6 1.2.3 2.4.4 3.6.4C40.4 44 43 32 43 20z" />
        </g>
      );
    case 'cards':
      return (
        <g {...p}>
          <rect x="20.4" y="24" width="13" height="18" rx="2" transform="rotate(-11 27 33)" />
          <rect x="30" y="22.4" width="13" height="18" rx="2" transform="rotate(9 36.5 31.4)" fill="#0b0716" opacity="0.35" />
          <rect x="30" y="22.4" width="13" height="18" rx="2" transform="rotate(9 36.5 31.4)" fill="none" stroke={fill} strokeWidth="2.4" />
        </g>
      );
    case 'coin':
      return (
        <g>
          <circle cx="32" cy="32" r="12" fill={fill} />
          <circle cx="32" cy="32" r="8.2" fill="none" stroke="#0b0716" strokeWidth="2" opacity="0.5" />
          <path d="M32 25.6v12.8M28.6 28.4h5.6a2.8 2.8 0 010 5.6h-4.4a2.8 2.8 0 000 5.6h5.6" fill="none" stroke="#0b0716" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
        </g>
      );
    case 'feather':
      return (
        <g {...p}>
          <path d="M43 19c-9 1-16.4 5.4-20 12.4-1.8 3.6-2 7-1.4 9.8l4.6-4.6h6.2l-4.4 4.4c4-.2 8.6-2.2 11.6-6C43.4 30.8 44.4 24.4 43 19z" />
          <path d="M22.6 41.2L19 44.8" stroke={fill} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case 'scroll':
    default:
      return (
        <g {...p}>
          <path d="M23 20h18v22a3 3 0 01-3 3H23z" />
          <path d="M23 20a3 3 0 00-3 3v2h3zM38 45a3 3 0 003-3v-2h-3z" opacity="0.6" />
          <g stroke="#0b0716" strokeWidth="1.8" strokeLinecap="round" opacity="0.55">
            <path d="M26.4 27h11M26.4 31.4h11M26.4 35.8h7" />
          </g>
        </g>
      );
  }
}

// `locked` draws the same silhouette drained of colour with the glyph as a
// silhouette only — so an unearned badge in the picker reads as "this exact
// badge, not yet" rather than as a generic placeholder.
export default function BadgeIcon({ badge, size = 40, locked = false, className = '' }) {
  if (!badge) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className={`badge-icon badge-empty ${className}`} aria-hidden="true">
        <path d={HEX} fill="#0b0716" stroke="#2a1a4e" strokeWidth="2.5" strokeDasharray="5 4" />
      </svg>
    );
  }
  const tier = BADGE_TIERS[badge.tier] || BADGE_TIERS.bronze;
  const uid = `bdg-${badge.id}-${locked ? 'l' : 'e'}`;
  const ring = locked ? '#3a3350' : tier.ring;
  const core = locked ? '#141024' : tier.core;
  const glyphFill = locked ? '#3d3556' : badge.hue;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64"
      className={`badge-icon badge-t-${badge.tier}${locked ? ' is-locked' : ''} ${className}`}
      role="img" aria-label={badge.name}>
      <defs>
        {/* Rim light runs top-left to bottom-right so a row of badges all
            catch the light from the same direction and read as struck metal
            rather than as flat stickers. */}
        <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={locked ? 0.25 : 0.95} />
          <stop offset="42%" stopColor={ring} />
          <stop offset="100%" stopColor="#0b0716" />
        </linearGradient>
        <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={core} stopOpacity={locked ? 0.10 : 0.30} />
          <stop offset="55%" stopColor="#0b0716" />
          <stop offset="100%" stopColor="#05030d" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor={badge.hue} stopOpacity={locked ? 0 : 0.42} />
          <stop offset="100%" stopColor={badge.hue} stopOpacity="0" />
        </radialGradient>
      </defs>

      <path d={HEX} fill={`url(#${uid}-ring)`} />
      <path d={HEX_INNER} fill={`url(#${uid}-face)`} stroke={ring} strokeWidth="1.4" strokeOpacity={locked ? 0.4 : 0.75} />
      <path d={HEX_INNER} fill={`url(#${uid}-glow)`} />
      <Glyph name={badge.glyph} fill={glyphFill} />

      {/* Prismatic is the only tier that gets extra treatment — four cut
          notches on the ring. It marks the handful of badges that represent
          the hardest things in the game, and it has to be visible at 22px. */}
      {badge.tier === 'prismatic' && !locked && (
        <g stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round">
          <path d="M32 4.6v4M32 55.4v4M9.6 18.5l3.4 2M51 43.5l3.4 2" />
        </g>
      )}
      {badge.tier === 'platinum' && !locked && (
        <g stroke={tier.core} strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round">
          <path d="M32 5.4v3.2M32 55.4v3.2" />
        </g>
      )}
    </svg>
  );
}
