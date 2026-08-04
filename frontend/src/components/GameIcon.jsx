import React from 'react';

// =============================================
// GAME ICONS — hand-built SVG, not emoji
// =============================================
// Emoji were standing in for artwork everywhere: level-up cards, the
// Weaponsmith, the spin wheel. They render differently on every platform,
// they carry no rarity or element colour, and a pistol emoji is a water
// pistol on some systems and a revolver on others — so the same weapon
// looked like a different weapon depending on the device.
//
// These are drawn in code, so they take the colour of whatever they sit on
// (rarity, weapon element, prize tier) and read identically everywhere.
//
// Each icon draws in a 32x32 box. `tone` is the accent colour; every icon
// uses it for its live/energised parts and a shared dark for its body, so a
// set of them reads as one family.

const DARK = '#0d141f';
const STEEL = '#46586e';
const STEEL_HI = '#7d93ad';

// Shared defs: one gradient per icon instance keyed by id, so two icons with
// different tones on the same screen do not fight over a shared gradient.
function Defs({ uid, tone }) {
  return (
    <defs>
      <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={STEEL_HI} />
        <stop offset="55%" stopColor={STEEL} />
        <stop offset="100%" stopColor={DARK} />
      </linearGradient>
      <linearGradient id={`${uid}-live`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="35%" stopColor={tone} />
        <stop offset="100%" stopColor={tone} stopOpacity="0.55" />
      </linearGradient>
      <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={tone} stopOpacity="0.85" />
        <stop offset="100%" stopColor={tone} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

// ---- Individual glyphs -----------------------------------------------------
// Each takes (uid) and returns the shapes. Kept as plain functions rather than
// components so they compose into one <svg> without extra wrappers.
const GLYPHS = {
  pistol: (u) => (<>
    <path d="M4 12h18l4 3v3h-9l-2 4h-5l1-4H6z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="22" y="13" width="6" height="2.4" fill={`url(#${u}-live)`} />
    <circle cx="27" cy="16" r="4" fill={`url(#${u}-glow)`} />
  </>),
  cannon: (u) => (<>
    <path d="M3 13h15l3-2 8 2v6l-8 2-3-2H5l-2 4H1l1-6z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="21" y="13.5" width="9" height="1.6" fill={DARK} />
    <rect x="21" y="17" width="9" height="1.6" fill={DARK} />
    <circle cx="30" cy="16" r="5" fill={`url(#${u}-glow)`} />
  </>),
  bow: (u) => (<>
    <path d="M9 3c9 4 9 22 0 26" fill="none" stroke={`url(#${u}-body)`} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M9 3 26 16 9 29" fill="none" stroke="#e8e2d0" strokeWidth="1.1" opacity="0.9" />
    <path d="M4 16h22" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M26 16l-5-3v6z" fill={`url(#${u}-live)`} />
  </>),
  blade: (u) => (<>
    <path d="M6 27 24 5l3 3L9 30z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <path d="M4 24l5 5-4 1z" fill={STEEL} stroke={DARK} strokeWidth="1" />
    <path d="M20 6l6 6" stroke="#ffffff" strokeWidth="1.2" opacity="0.7" />
  </>),
  scythe: (u) => (<>
    <path d="M27 5C15 5 6 12 5 24" fill="none" stroke={`url(#${u}-live)`} strokeWidth="4" strokeLinecap="round" />
    <path d="M27 5c-9 1-16 7-18 17" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.55" />
    <path d="M8 24 22 29" stroke={`url(#${u}-body)`} strokeWidth="3.2" strokeLinecap="round" />
  </>),
  flame: (u) => (<>
    <path d="M16 2c5 7 9 9 9 15a9 9 0 0 1-18 0c0-5 3-6 5-10 1 3 3 4 3 6 1-4 1-7 1-11z"
          fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <path d="M16 14c2 3 3.5 4 3.5 7a3.5 3.5 0 0 1-7 0c0-3 2-4 3.5-7z" fill="#fff6d8" opacity="0.9" />
  </>),
  frost: (u) => (<>
    <g stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round">
      <path d="M16 3v26M5 9l22 14M27 9 5 23" />
    </g>
    <g stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.85">
      <path d="M16 8l-3-3M16 8l3-3M16 24l-3 3M16 24l3 3" />
    </g>
    <circle cx="16" cy="16" r="3" fill="#eafaff" />
  </>),
  bolt: (u) => (<>
    <path d="M18 2 7 18h6l-3 12 13-17h-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="12" fill={`url(#${u}-glow)`} opacity="0.5" />
  </>),
  orb: (u) => (<>
    <circle cx="16" cy="16" r="13" fill={`url(#${u}-glow)`} />
    <circle cx="16" cy="16" r="8" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="12.5" cy="12.5" r="2.6" fill="#ffffff" opacity="0.75" />
    <ellipse cx="16" cy="16" rx="14" ry="5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.2" opacity="0.6" />
  </>),
  beam: (u) => (<>
    <path d="M2 14h13l14-6v16l-14-6H2z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <rect x="2" y="12" width="10" height="8" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <circle cx="26" cy="16" r="7" fill={`url(#${u}-glow)`} />
  </>),
  meteor: (u) => (<>
    <path d="M2 30 12 20" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
    <path d="M7 30 15 22" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
    <circle cx="20" cy="12" r="10" fill={`url(#${u}-glow)`} />
    <circle cx="20" cy="12" r="6.5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="18" cy="10" r="1.6" fill={DARK} opacity="0.65" />
    <circle cx="22" cy="14" r="1.1" fill={DARK} opacity="0.5" />
  </>),
  drone: (u) => (<>
    <path d="M16 8 24 16 16 24 8 16z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <ellipse cx="16" cy="7" rx="10" ry="2" fill={`url(#${u}-live)`} opacity="0.75" />
    <circle cx="16" cy="16" r="3" fill={`url(#${u}-live)`} />
    <circle cx="16" cy="16" r="9" fill={`url(#${u}-glow)`} opacity="0.5" />
  </>),
  whip: (u) => (<>
    <path d="M3 26c8 2 14-2 17-8s6-9 9-8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="3" strokeLinecap="round" />
    <path d="M3 26c8 2 14-2 17-8" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
    <circle cx="29" cy="10" r="2.6" fill="#ffffff" />
    <circle cx="29" cy="10" r="6" fill={`url(#${u}-glow)`} />
  </>),
  shield: (u) => (<>
    <path d="M16 2 28 7v10c0 7-5 11-12 13C9 28 4 24 4 17V7z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 6 24 9v8c0 5-3.5 8-8 9.5V6z" fill={`url(#${u}-live)`} opacity="0.8" />
  </>),
  heart: (u) => (<>
    <path d="M16 29S3 20 3 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 13 3.5C29 20 16 29 16 29z"
          fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M9 11a4 4 0 0 1 4-2" stroke="#ffffff" strokeWidth="1.4" fill="none" opacity="0.7" strokeLinecap="round" />
  </>),
  boot: (u) => (<>
    <path d="M11 3h7v14l9 5v7H11z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M11 22h16" stroke={`url(#${u}-live)`} strokeWidth="2" />
  </>),
  coin: (u) => (<>
    <ellipse cx="16" cy="16" rx="12" ry="12" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" />
    <ellipse cx="16" cy="16" rx="7.5" ry="7.5" fill="none" stroke={DARK} strokeWidth="1.1" opacity="0.55" />
    <path d="M13 11h6l-6 10h6" stroke={DARK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </>),
  gem: (u) => (<>
    <path d="M16 3 29 12 16 29 3 12z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 3 16 29M3 12h26" stroke={DARK} strokeWidth="0.9" opacity="0.45" />
    <path d="M16 3 9 12l7 17z" fill="#ffffff" opacity="0.20" />
  </>),
  token: (u) => (<>
    <circle cx="16" cy="16" r="12" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <circle cx="16" cy="16" r="7" fill={`url(#${u}-live)`} />
    <circle cx="16" cy="16" r="2.6" fill={DARK} />
  </>),
  star: (u) => (<>
    <path d="M16 2 20 12l11 1-8 7 2.5 11L16 25 6.5 31 9 20 1 13l11-1z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
  </>),
  trophy: (u) => (<>
    <path d="M9 4h14v7a7 7 0 0 1-14 0z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M9 6H5v3a5 5 0 0 0 4 5M23 6h4v3a5 5 0 0 1-4 5" fill="none" stroke={STEEL} strokeWidth="1.8" />
    <rect x="14" y="18" width="4" height="6" fill={STEEL} />
    <rect x="9" y="24" width="14" height="4" rx="1" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
  </>),
  meat: (u) => (<>
    <path d="M9 22a8 8 0 1 1 12-10c3 2 5 4 5 7s-3 4-6 3-4 2-7 2-4-1-4-2z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M6 25l-3 4" stroke={STEEL_HI} strokeWidth="3" strokeLinecap="round" />
  </>),
  rune: (u) => (<>
    <path d="M16 2 28 9v14l-12 7L4 23V9z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M12 10v12M20 10v12M12 16h8" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
  </>),
  swarm: (u) => (<>
    {[[10, 10], [21, 9], [16, 17], [9, 22], [23, 21]].map(([x, y], i) => (
      <g key={i}>
        <ellipse cx={x} cy={y} rx="3.2" ry="2.2" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
        <path d={`M${x - 3} ${y - 2}h6`} stroke="#ffffff" strokeWidth="0.9" opacity="0.6" />
      </g>
    ))}
  </>),
};

// ---- Public map ------------------------------------------------------------
// Weapon/skill/prize id -> glyph + its own accent colour. Anything unmapped
// falls back to the pistol so nothing renders blank.
export const ICONS = {
  hydropistol: ['pistol', '#6cb4ff'],
  desertEagle: ['cannon', '#ffd166'],
  bow:         ['bow',    '#c8f0a0'],
  daggers:     ['blade',  '#b9f0ff'],
  flameburst:  ['flame',  '#ff7a1a'],
  icespike:    ['frost',  '#8fe6ff'],
  sniperDrop:  ['beam',   '#4dffd4'],
  stormLance:  ['bolt',   '#fff44d'],
  shotgun:     ['cannon', '#ffd166'],
  autoBolts:   ['bolt',   '#4dffd4'],
  bloodScythe: ['scythe', '#b51d28'],
  tideWhip:    ['whip',   '#4fd8ff'],
  emberOrbs:   ['orb',    '#ff7a1a'],
  frostOrb:    ['orb',    '#8fe6ff'],
  whirlwind:   ['blade',  '#9fe8c8'],
  voidBeam:    ['beam',   '#b362ff'],
  chainlightning: ['bolt', '#ffe44d'],
  arcTesla:    ['bolt',   '#a0e4ff'],
  staticField: ['bolt',   '#c8f8ff'],
  meteorStrike:['meteor', '#ff7a1a'],
  droneSquad:  ['drone',  '#4dc4ff'],
  annunakiPulse: ['orb',  '#b362ff'],
  swarmAura:   ['swarm',  '#ffe44d'],

  // prizes / currencies
  gold:      ['coin',   '#ffd166'],
  gems:      ['gem',    '#4dffd4'],
  slotCoins: ['token',  '#ffcc00'],
  sp:        ['star',   '#9fd8ff'],
  petFood:   ['meat',   '#ff9a6a'],
  jackpot:   ['trophy', '#ffd166'],
  rune:      ['rune',   '#b362ff'],
  gear:      ['shield', '#7cd6ff'],
  heart:     ['heart',  '#ff3146'],
  speed:     ['boot',   '#4dff91'],
};

let uidCounter = 0;

/**
 * @param {string} name  key into ICONS, or a glyph name directly
 * @param {string} tone  override accent colour (rarity tint, element, etc.)
 * @param {number} size  px
 */
export default function GameIcon({ name, tone, size = 32, className }) {
  const entry = ICONS[name];
  const glyphName = entry ? entry[0] : (GLYPHS[name] ? name : 'pistol');
  const accent = tone || (entry ? entry[1] : '#6cb4ff');
  // Gradient ids must be unique per rendered instance — two icons sharing an
  // id would both resolve to whichever definition the document found first,
  // so every icon on screen would take the first one's colour.
  const uid = React.useMemo(() => `gi${(uidCounter += 1)}`, []);
  const glyph = GLYPHS[glyphName] || GLYPHS.pistol;
  return (
    <svg
      className={`game-icon${className ? ' ' + className : ''}`}
      width={size} height={size} viewBox="0 0 32 32"
      aria-hidden focusable="false"
    >
      <Defs uid={uid} tone={accent} />
      {glyph(uid)}
    </svg>
  );
}
