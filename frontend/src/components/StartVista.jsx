import React from 'react';
import { heroBodyPath, HERO_COLORS } from '../game/heroShape';

// Hardcoded start-menu backdrop. Camp on the ridge, moon, Stonehenge, Tesla
// coils, the Annunaki craft, and THE SAME drop silhouette the run draws.
// No shipped PNG — Timmy asked for a sprite, the project rule is code-built.

export default function StartVista() {
  const body = heroBodyPath(42, 0, 0);
  return (
    <svg
      className="start-vista"
      viewBox="0 0 960 540"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="sv-moon" cx="38%" cy="32%" r="55%">
          <stop offset="0%" stopColor="#f4f0e4" />
          <stop offset="55%" stopColor="#c9d4e0" />
          <stop offset="100%" stopColor="#6a7a8c" />
        </radialGradient>
        <radialGradient id="sv-moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#dce8f8" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#8aa4c8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#8aa4c8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sv-ridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2838" />
          <stop offset="100%" stopColor="#070b12" />
        </linearGradient>
        <linearGradient id="sv-camp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2a1c" />
          <stop offset="100%" stopColor="#120c08" />
        </linearGradient>
        <linearGradient id="sv-tesla" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8ec8e8" />
          <stop offset="40%" stopColor="#4a88b0" />
          <stop offset="100%" stopColor="#1a3040" />
        </linearGradient>
        <linearGradient id="sv-craft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9ad0c8" />
          <stop offset="45%" stopColor="#3a6868" />
          <stop offset="100%" stopColor="#0e1c1c" />
        </linearGradient>
        <filter id="sv-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      <circle cx="760" cy="92" r="78" fill="url(#sv-moon-glow)" />
      <circle cx="760" cy="92" r="38" fill="url(#sv-moon)" />
      <circle cx="748" cy="80" r="7" fill="#9aa8b4" opacity="0.45" />
      <circle cx="772" cy="98" r="5" fill="#8a96a4" opacity="0.4" />
      <circle cx="754" cy="104" r="3.5" fill="#7a8894" opacity="0.35" />

      {/* Annunaki disc — hanging off the moon, not a second sun */}
      <g transform="translate(210 78)">
        <ellipse cx="0" cy="6" rx="92" ry="16" fill="url(#sv-craft)" />
        <ellipse cx="0" cy="2" rx="46" ry="18" fill="#1c3a3a" />
        <ellipse cx="0" cy="-4" rx="22" ry="10" fill="#6fd0c8" opacity="0.85" />
        <ellipse cx="0" cy="18" rx="28" ry="6" fill="#4dffd4" opacity="0.35" />
        {[-54, -28, 0, 28, 54].map((x) => (
          <circle key={x} cx={x} cy="8" r="3.2" fill="#7fe8d4" opacity="0.9" />
        ))}
      </g>

      {/* Far ridge — polygon, not a cubic teardrop (wiring.test watches those). */}
      <path d="M-20 340 L 180 292 L 400 310 L 640 280 L 880 300 L 980 270 L 980 540 L -20 540 Z" fill="#101820" />

      {/* Stonehenge — three trilithons on the left ridge */}
      <g fill="#2a3340" stroke="#0a1016" strokeWidth="1.5">
        <rect x="86" y="268" width="18" height="72" rx="2" />
        <rect x="128" y="262" width="18" height="78" rx="2" />
        <rect x="84" y="254" width="64" height="14" rx="2" />
        <rect x="168" y="278" width="16" height="62" rx="2" />
        <rect x="204" y="274" width="16" height="66" rx="2" />
        <rect x="166" y="266" width="56" height="12" rx="2" />
        <rect x="118" y="300" width="14" height="48" rx="2" opacity="0.7" />
      </g>
      <g fill="#3a4654" opacity="0.55">
        <rect x="88" y="270" width="6" height="50" />
        <rect x="170" y="280" width="5" height="44" />
      </g>

      {/* Tesla coils — right of camp, arcing toward the moon */}
      <g transform="translate(620 248)">
        <rect x="-8" y="40" width="16" height="86" fill="#243040" />
        <rect x="-18" y="108" width="36" height="10" fill="#1a242e" />
        <ellipse cx="0" cy="28" rx="28" ry="10" fill="url(#sv-tesla)" />
        <ellipse cx="0" cy="18" rx="18" ry="7" fill="#c8e8f8" opacity="0.55" />
        <circle cx="0" cy="18" r="6" fill="#e8fbff" />
        <path d="M8 16 C 40 -8, 70 10, 96 -6" fill="none" stroke="#9ee8ff" strokeWidth="1.6" opacity="0.75" />
        <path d="M6 22 C 28 4, 58 28, 88 8" fill="none" stroke="#4dffd4" strokeWidth="1.1" opacity="0.55" />
      </g>
      <g transform="translate(708 268)">
        <rect x="-6" y="36" width="12" height="70" fill="#1e2a36" />
        <ellipse cx="0" cy="26" rx="20" ry="8" fill="url(#sv-tesla)" />
        <circle cx="0" cy="18" r="4.5" fill="#d4f4ff" />
        <path d="M6 16 C 22 0, 40 18, 58 4" fill="none" stroke="#7fd8ff" strokeWidth="1.2" opacity="0.6" />
      </g>

      {/* Camp — tents, fire, hull wreck as home */}
      <g transform="translate(390 300)">
        <path d="M-90 86 L 90 86 L 70 40 L -70 40 Z" fill="url(#sv-ridge)" />
        <path d="M-48 78 L -8 22 L 32 78 Z" fill="url(#sv-camp)" />
        <path d="M8 78 L 44 34 L 78 78 Z" fill="#2a1c12" />
        <rect x="-16" y="54" width="14" height="24" fill="#0c0806" />
        <rect x="36" y="58" width="10" height="20" fill="#0c0806" />
        <circle cx="10" cy="80" r="10" fill="#ff7a1a" opacity="0.55" />
        <circle cx="10" cy="78" r="5" fill="#ffd166" opacity="0.85" />
        <rect x="-70" y="62" width="22" height="26" fill="#243040" />
        <rect x="-64" y="48" width="10" height="16" fill="#4dffd4" opacity="0.35" />
      </g>

      {/* Character — real drop path, standing the camp fire */}
      <g transform="translate(430 392)">
        <ellipse cx="0" cy="46" rx="28" ry="8" fill="#000" opacity="0.45" />
        <path d={body} fill={HERO_COLORS.bodyDeep} />
        <path d={body} fill={HERO_COLORS.body} opacity="0.92" transform="translate(-2 -2)" />
        <ellipse cx="-8" cy="-6" rx="10" ry="7" fill={HERO_COLORS.gloss} opacity="0.28" />
        <circle cx="-7" cy="2" r="4.2" fill="#06121e" />
        <circle cx="8" cy="2" r="4.2" fill="#06121e" />
        <circle cx="-6" cy="1" r="1.4" fill="#fff" />
        <circle cx="9" cy="1" r="1.4" fill="#fff" />
      </g>

      {/* Ground fade so the menu plate can sit on it */}
      <rect x="0" y="460" width="960" height="80" fill="#020508" opacity="0.55" />
    </svg>
  );
}
