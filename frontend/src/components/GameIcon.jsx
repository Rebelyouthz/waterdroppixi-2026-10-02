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
// The floor of the metal gradient. NOT `DARK` — that is #0d141f, within a few
// points of the card panel behind it, so the bottom of every metal shape
// dissolved into the background. Outlines still use DARK; this is fill only.
const STEEL_LO = '#26323f';

// Shared defs: one gradient per icon instance keyed by id, so two icons with
// different tones on the same screen do not fight over a shared gradient.
function Defs({ uid, tone }) {
  return (
    <defs>
      <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={STEEL_HI} />
        <stop offset="55%" stopColor={STEEL} />
        <stop offset="100%" stopColor={STEEL_LO} />
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
  // ---- Gear base types ----------------------------------------------------
  // Five per equipment slot, 35 in all. Each slot's five share a silhouette
  // family so a helmet always reads as a helmet at 32px, but differ in the
  // detail that matches what the base is FOR: a Greathelm is heavy and closed,
  // a Circlet is barely there, Magboots have coils, Finblades have edges.
  //
  // Ids match GEAR_BASES[slot][n].icon in game/gear.js. icons.test.mjs asserts
  // every base id resolves to a glyph here, so adding a base without art fails
  // the build rather than silently falling back to a pistol.

  // Helmets
  gbVisor: (u) => (<>
    <path d="M5 17a11 9 0 0122 0v4H5z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M6 15h20v4H6z" fill={`url(#${u}-live)`} opacity="0.9" />
    <path d="M6 15h20v4H6z" fill="none" stroke={DARK} strokeWidth="1" />
  </>),
  gbGreathelm: (u) => (<>
    <path d="M6 14a10 11 0 0120 0v11H6z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="14.6" y="12" width="2.8" height="13" fill={DARK} />
    <path d="M9 16h4v5H9zM19 16h4v5h-4z" fill={`url(#${u}-live)`} />
  </>),
  gbCrown: (u) => (<>
    <path d="M5 22l-1-12 6 5 6-8 6 8 6-5-1 12z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="5" y="22" width="22" height="4" fill={DARK} />
    <circle cx="16" cy="15" r="2.2" fill={`url(#${u}-live)`} />
  </>),
  gbDiveHood: (u) => (<>
    <path d="M6 16a10 10 0 0120 0v6a10 8 0 01-20 0z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="17" r="6" fill={`url(#${u}-live)`} opacity="0.75" />
    <circle cx="16" cy="17" r="6" fill="none" stroke={DARK} strokeWidth="1.4" />
    <path d="M12 14a5 5 0 013-2" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.8" />
  </>),
  gbCirclet: (u) => (<>
    <path d="M4 18a12 6 0 0024 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.6" />
    <path d="M4 18a12 6 0 0024 0" fill="none" stroke={DARK} strokeWidth="0.8" />
    <path d="M16 8l3 6h-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="16" r="4" fill={`url(#${u}-glow)`} />
  </>),

  // Chest
  gbBulwark: (u) => (<>
    <path d="M16 3l11 4v9c0 7-5 11-11 13C10 27 5 23 5 16V7z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 8l6 2v6c0 4-3 6-6 7-3-1-6-3-6-7v-6z" fill={`url(#${u}-live)`} opacity="0.8" />
  </>),
  gbDuelist: (u) => (<>
    <path d="M16 3l10 4v8c0 8-5 12-10 14C11 27 6 23 6 15V7z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 4v25" stroke={DARK} strokeWidth="1.4" />
    <path d="M10 11l6 4 6-4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" />
  </>),
  gbCarapace: (u) => (<>
    <path d="M16 3l11 4v9c0 7-5 11-11 13C10 27 5 23 5 16V7z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M6 12h20M7 18h18M9 23h14" stroke={DARK} strokeWidth="1.5" />
    <path d="M6 12h20" stroke={`url(#${u}-live)`} strokeWidth="1" />
  </>),
  gbDrownVest: (u) => (<>
    <path d="M16 3l11 4v9c0 7-5 11-11 13C10 27 5 23 5 16V7z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 10c3 3 4 5 4 7a4 4 0 01-8 0c0-2 1-4 4-7z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
  </>),
  gbAegis: (u) => (<>
    <path d="M16 2l12 5v9c0 8-6 12-12 14C10 28 4 24 4 16V7z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.4" />
    <circle cx="16" cy="15" r="6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" />
    <circle cx="16" cy="15" r="2.4" fill={`url(#${u}-live)`} />
  </>),

  // Arms
  gbGauntlet: (u) => (<>
    <path d="M9 6h11l3 4v11l-3 4H9z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M9 11h14M9 16h14M9 21h14" stroke={DARK} strokeWidth="1.4" />
    <rect x="20" y="13" width="6" height="6" rx="1" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
  </>),
  gbWraps: (u) => (<>
    <path d="M10 7h12v18H10z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M9 10l14 3M9 15l14 3M9 20l14 3" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  gbClaws: (u) => (<>
    <path d="M10 14h12v10H10z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M11 14L9 4M16 14l0-11M21 14l2-10" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
  </>),
  gbPistons: (u) => (<>
    <path d="M9 9h10v14H9z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="19" y="12" width="9" height="3" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
    <rect x="19" y="18" width="6" height="3" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
    <circle cx="14" cy="16" r="3" fill={DARK} />
  </>),
  gbFlowcuffs: (u) => (<>
    <path d="M10 8h12v16H10z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M8 12c4 2 12-2 16 0M8 17c4 2 12-2 16 0M8 22c4 2 12-2 16 0"
      fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" />
  </>),

  // Legs
  gbGreaves: (u) => (<>
    <path d="M11 4h10l-1 12-2 12h-4l-2-12z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M11 10h10M12 17h8" stroke={DARK} strokeWidth="1.4" />
    <path d="M11 4h10l-.4 4h-9.2z" fill={`url(#${u}-live)`} />
  </>),
  gbStriders: (u) => (<>
    <path d="M12 4h8l-1 11-2 13h-3l-2-13z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M22 8l5-3M23 14l6-2M22 20l5 2" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  gbPhase: (u) => (<>
    <path d="M11 4h10l-1 12-2 12h-4l-2-12z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" opacity="0.75" />
    <path d="M14 4h10l-1 12-2 12h-4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" opacity="0.85" />
    <circle cx="16" cy="16" r="7" fill={`url(#${u}-glow)`} />
  </>),
  gbTideguard: (u) => (<>
    <path d="M11 4h10l-1 12-2 12h-4l-2-12z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M10 12c3 2 9-2 12 0M10 19c3 2 9-2 12 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" />
  </>),
  gbSlipleg: (u) => (<>
    <path d="M12 4h8l-1 12-2 12h-3l-2-12z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M8 9l6 3-6 3M24 15l-6 3 6 3" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" />
  </>),

  // Boots
  gbTreads: (u) => (<>
    <path d="M10 4h7v14l8 4v5H10z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="9" y="24" width="17" height="3.5" fill={DARK} />
    <path d="M11 25.6h13" stroke={`url(#${u}-live)`} strokeWidth="1.2" />
  </>),
  gbSkimmers: (u) => (<>
    <path d="M11 5h6v13l8 4v5H11z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M6 20h6M4 24h8" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  gbMagboots: (u) => (<>
    <path d="M10 4h7v14l8 4v5H10z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="14" cy="25" r="2.2" fill={`url(#${u}-live)`} />
    <circle cx="21" cy="25" r="2.2" fill={`url(#${u}-live)`} />
    <circle cx="17.5" cy="25" r="7" fill={`url(#${u}-glow)`} />
  </>),
  gbFinblades: (u) => (<>
    <path d="M11 5h6v13l8 4v5H11z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M17 8l7-4 1 5-8 3zM17 15l8-2v4l-8 1z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
  </>),
  gbAnchors: (u) => (<>
    <path d="M10 4h7v14l8 4v5H10z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M17.5 14v9M13 20a4.5 4.5 0 009 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="17.5" cy="12" r="2" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" />
  </>),

  // Rings
  gbBand: (u) => (<>
    <circle cx="16" cy="17" r="9" fill="none" stroke={`url(#${u}-body)`} strokeWidth="4" />
    <circle cx="16" cy="17" r="9" fill="none" stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="7" r="3.2" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
  </>),
  gbSignet: (u) => (<>
    <circle cx="16" cy="18" r="8.5" fill="none" stroke={`url(#${u}-body)`} strokeWidth="4" />
    <rect x="10" y="3" width="12" height="9" rx="1.5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M13 7.5h6" stroke={DARK} strokeWidth="1.6" />
  </>),
  gbLoop: (u) => (<>
    <ellipse cx="16" cy="16" rx="7" ry="11" fill="none" stroke={`url(#${u}-body)`} strokeWidth="3.4" />
    <ellipse cx="16" cy="16" rx="7" ry="11" fill="none" stroke={DARK} strokeWidth="0.9" />
    <circle cx="16" cy="16" r="2.4" fill={`url(#${u}-live)`} />
  </>),
  gbCoil: (u) => (<>
    <path d="M10 8c8-3 12 1 12 4s-10 2-12 5 4 7 12 4" fill="none"
      stroke={`url(#${u}-body)`} strokeWidth="3.2" strokeLinecap="round" />
    <path d="M10 8c8-3 12 1 12 4s-10 2-12 5 4 7 12 4" fill="none"
      stroke={`url(#${u}-live)`} strokeWidth="1.1" strokeLinecap="round" />
  </>),
  gbSeal: (u) => (<>
    <circle cx="16" cy="18" r="8.5" fill="none" stroke={`url(#${u}-body)`} strokeWidth="4" />
    <path d="M16 3l4.5 3v5.5L16 15l-4.5-3.5V6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="9" r="1.6" fill={DARK} />
  </>),

  // Amulets
  gbPendant: (u) => (<>
    <path d="M7 5a12 8 0 0018 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.4" />
    <path d="M16 12l5 6-5 8-5-8z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
  </>),
  gbSigil: (u) => (<>
    <path d="M7 5a12 8 0 0018 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.4" />
    <rect x="10" y="12" width="12" height="12" rx="1.5" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M13 18h6M16 15v6" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
  </>),
  gbOrb: (u) => (<>
    <path d="M7 5a12 8 0 0018 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.4" />
    <circle cx="16" cy="19" r="7" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="13.6" cy="16.6" r="2" fill="#fff" opacity="0.75" />
  </>),
  gbTear: (u) => (<>
    <path d="M7 5a12 8 0 0018 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.4" />
    <path d="M16 11c4 5 6 8 6 10.5a6 6 0 01-12 0C10 19 12 16 16 11z"
      fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <ellipse cx="13.8" cy="20" rx="1.4" ry="2.2" fill="#fff" opacity="0.6" />
  </>),
  gbCompass: (u) => (<>
    <path d="M7 5a12 8 0 0018 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.4" />
    <circle cx="16" cy="19" r="7.5" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M19.5 15.5l-2 5-5 2 2-5z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.8" />
  </>),

  // Katana: a single clean edge. Deliberately the least ornamented glyph in
  // the set — the weapon's whole identity is one line, so the icon is too.
  // ---- Stat-card glyphs ---------------------------------------------------
  // The five that had no honest match among the weapon icons. Each says its
  // stat by SHAPE, so it reads at 58px on a card without a label.

  // Regen: a drop refilling a vessel — the cross says heal, the drop says it
  // comes back over time rather than all at once.
  // ---- CARD CATEGORY BADGES -----------------------------------------------
  // The small square logo the reference sheet puts at the top-left of every
  // card, beside the rarity word. It answers "what KIND of thing is this"
  // before you have read anything — and that is the question you ask first,
  // because a weapon and a passive are played completely differently.
  //
  // Drawn as marks rather than pictures: at 16px inside a badge, a detailed
  // illustration turns to mud. Each is one idea.

  // Manual weapon: a trigger finger. YOU aim this.
  catManual: (u) => (<>
    <circle cx="16" cy="16" r="10.5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="3.2" />
    <path d="M16 1v7M16 24v7M1 16h7M24 16h7" stroke={`url(#${u}-live)`} strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="3.4" fill={`url(#${u}-live)`} />
    <circle cx="16" cy="16" r="10.5" fill="none" stroke={DARK} strokeWidth="1" opacity="0.6" />
  </>),
  // Auto weapon: a barrel with a cycling arrow. It fires itself.
  catAuto: (u) => (<>
    <path d="M16 1.5l3 2.2 3.6-.8 1.6 3.3 3.6 1-.3 3.7 2.6 2.6-2.1 3.1 1 3.6-3.4 1.5-1.3 3.5-3.7-.3-2.9 2.3-2.9-2.3-3.7.3-1.3-3.5L5 20.2l1-3.6L3.9 13.5 6.5 11l-.3-3.7 3.6-1L11.4 3l3.6.8z"
          fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="16" cy="14.5" r="6.4" fill={DARK} />
    <path d="M18.5 6.5 12 17h4l-2 8.5 7-11h-4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
  </>),
  // Passive skill: a ring around a core. It happens to you, always on.
  catPassive: (u) => (<>
    <circle cx="16" cy="16" r="14" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeDasharray="4 4" opacity="0.55" />
    <path d="M16 2 27 6.5v9c0 7-4.6 12-11 14.5C9.6 27.5 5 22.5 5 15.5v-9z"
          fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M16 5.5 24 9v6.5c0 5.4-3.4 9.3-8 11.4z" fill={DARK} opacity="0.35" />
    <path d="M10.5 15.5l4 4 7.5-8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  // Stat boost: three rising bars and an upward arrow — a number going up,
  // not an always-on effect. Used to share catPassive's shield-and-check
  // with every passive-skill card, which made "PASSIVE SKILL" and "STAT
  // BOOST" badges identical even though the type label under them differs —
  // its own glyph now.
  catStatBoost: (u) => (<>
    <rect x="4" y="20" width="6" height="9" rx="1" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="13" y="14" width="6" height="15" rx="1" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="22" y="7" width="6" height="22" rx="1" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M5 12 13 5l6 4 8-7" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 2h6v6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  // Auto skill: the same ring, with a bolt through it — fires on its own.
  catAutoSkill: (u) => (<>
    <circle cx="16" cy="16" r="13" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeDasharray="5 4" opacity="0.7" />
    <path d="M16 3.5l3.2 8.1 8.3 1.2-6 5.9 1.5 8.3-7-4-7 4 1.5-8.3-6-5.9 8.3-1.2z"
          fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="2.6" fill={DARK} opacity="0.45" />
  </>),

  // ---- PASSIVE CARDS ------------------------------------------------------
  // Sixty passives shipped with emoji as their art. Two of them (Damage Aura
  // and Burn) were both a flame, so the deck contained cards that were
  // literally indistinguishable from each other.
  //
  // Each of these is built to read as a SILHOUETTE at 58px, because that is
  // the size the level-up card draws it at and colour alone does not survive
  // being one of three cards glanced at under pressure. The rule used
  // throughout: the shape says WHAT HAPPENS, the tone says whose it is.

  pLightning: (u) => (<>
    <path d="M18 2L7 18h6l-3 12 12-17h-6l4-11z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="24" cy="7" r="2" fill="#fff" opacity="0.8" />
  </>),
  pAura: (u) => (<>
    <circle cx="16" cy="16" r="5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    {[10, 13.5].map((r2, i) => (
      <circle key={i} cx="16" cy="16" r={r2} fill="none" stroke={`url(#${u}-live)`}
        strokeWidth="1.8" opacity={0.7 - i * 0.28} strokeDasharray={i ? '3 4' : '5 3'} />
    ))}
  </>),
  pVamp: (u) => (<>
    <path d="M16 4c5 7 8 10 8 13.4A8 8 0 0116 25a8 8 0 01-8-7.6C8 14 11 11 16 4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M11 25l2 5 2-4 2 4 2-5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
    <ellipse cx="13" cy="15" rx="2" ry="3.4" fill="#fff" opacity="0.5" />
  </>),
  pChain: (u) => (<>
    <rect x="4" y="12" width="11" height="8" rx="4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" />
    <rect x="17" y="12" width="11" height="8" rx="4" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.6" />
    <path d="M14 16h4" stroke="#fff" strokeWidth="2" opacity="0.75" />
  </>),
  pSlow: (u) => (<>
    <circle cx="16" cy="16" r="11" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M16 16V8M16 16l6 4" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M5 26c4-3 5-8 3-12" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" opacity="0.6" />
  </>),
  pBurn: (u) => (<>
    <path d="M16 3c1 6-5 7-5 13a5 5 0 0010 0c0-3-2-4-2-7 3 2 6 5 6 9a9 9 0 11-18 0C7 11 14 10 16 3z"
      fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 20a3 3 0 003-3c0-2-2-3-3-5-1 2-3 3-3 5a3 3 0 003 3z" fill="#fff" opacity="0.55" />
  </>),
  pPoison: (u) => (<>
    <ellipse cx="16" cy="20" rx="11" ry="7" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <ellipse cx="10" cy="16" rx="5" ry="4" fill={`url(#${u}-live)`} opacity="0.85" />
    <ellipse cx="22" cy="16" rx="6" ry="4.6" fill={`url(#${u}-live)`} opacity="0.85" />
    <circle cx="12" cy="20" r="1.5" fill={DARK} /><circle cx="20" cy="20" r="1.5" fill={DARK} />
  </>),
  pGlass: (u) => (<>
    <path d="M8 4h16l-2 10 4 14H6l4-14z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M16 4v24M10 14h12" stroke={DARK} strokeWidth="1.2" opacity="0.8" />
    <path d="M19 7l-4 8 5 3-3 8" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.6" />
  </>),
  pReflect: (u) => (<>
    <path d="M16 3l11 5v9c0 6-5 10-11 12-6-2-11-6-11-12V8z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M16 3v26" stroke="#fff" strokeWidth="1.4" opacity="0.5" />
    <path d="M20 10l5-3M21 15l6-2M20 20l6 1" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  pExplode: (u) => (<>
    <path d="M16 2l3.4 7.2L27 6l-3 7.6 7 3.4-7 3 3 7.6-7.6-3.2L16 31l-3.4-7.6L5 26.6l3-7.6-7-3 7-3.4L5 6l7.6 3.2z"
      fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="4" fill="#fff" opacity="0.65" />
  </>),
  pLifeline: (u) => (<>
    <circle cx="16" cy="16" r="11" fill="none" stroke={`url(#${u}-live)`} strokeWidth="4.4" />
    <circle cx="16" cy="16" r="11" fill="none" stroke={DARK} strokeWidth="1" opacity="0.6" />
    <path d="M16 5v6M16 21v6M5 16h6M21 16h6" stroke="#f2fbff" strokeWidth="3" />
    <circle cx="16" cy="16" r="5.6" fill={`url(#${u}-body)`} />
  </>),
  pMirror: (u) => (<>
    <path d="M11 6c4 6 4 14 0 20" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M20 6c4 6 4 14 0 20" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
    <circle cx="11" cy="16" r="3.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <circle cx="20" cy="16" r="3.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" opacity="0.55" />
  </>),
  pKnock: (u) => (<>
    <path d="M6 10c6-4 14-4 20 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M6 17c6-4 14-4 20 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
    <path d="M6 24c6-4 14-4 20 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
  </>),
  pStarBurst: (u) => (<>
    <path d="M16 3l3.2 9.4L29 16l-9.8 3.6L16 29l-3.2-9.4L3 16l9.8-3.6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="2.6" fill="#fff" opacity="0.85" />
  </>),
  pDoubleHit: (u) => (<>
    <path d="M25 4l3 3L12 24l-3-3z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <path d="M7 4L4 7l16 17 3-3z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="16" cy="15" r="2" fill="#fff" opacity="0.8" />
  </>),
  pGrit: (u) => (<>
    <path d="M6 22l4-13 8-4 9 6-2 12-10 4z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M10 9l7 6-3 12M17 15l10-2" fill="none" stroke={DARK} strokeWidth="1.2" opacity="0.7" />
    <path d="M10 9l8-4" stroke="#fff" strokeWidth="1.4" opacity="0.4" />
  </>),
  pVision: (u) => (<>
    <ellipse cx="16" cy="16" rx="13" ry="8" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <circle cx="16" cy="16" r="5.4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="16" cy="16" r="2.2" fill={DARK} />
    <circle cx="14" cy="14" r="1.3" fill="#fff" opacity="0.9" />
  </>),
  pSharp: (u) => (<>
    <path d="M26 3l3 3-16 16-4-2 2-4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <path d="M9 20l-5 8 8-5z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <path d="M24 5l3 3" stroke="#fff" strokeWidth="1.6" opacity="0.85" />
  </>),
  pRush: (u) => (<>
    <path d="M4 11h14M2 17h12M6 23h11" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M18 6l10 10-10 10-3-4 5-6H14l1-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
  </>),
  pMagnet: (u) => (<>
    <path d="M8 24V14a8 8 0 0116 0v10h-6V14a2 2 0 00-4 0v10z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <rect x="8" y="24" width="6" height="5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <rect x="18" y="24" width="6" height="5" fill="#e2e8f0" stroke={DARK} strokeWidth="1.1" />
  </>),
  pIce: (u) => (<>
    <ellipse cx="16" cy="24" rx="13" ry="6" fill={`url(#${u}-glow)`} />
    <path d="M4.5 26 7 15l3.2 11z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" strokeLinejoin="round" />
    <path d="M7 15 5.9 26h-1.4z" fill="#ffffff" opacity="0.45" />
    <path d="M26.5 26 24 14l-3.4 12z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" strokeLinejoin="round" />
    <path d="M24 14l1.2 12h1.3z" fill={DARK} opacity="0.35" />
    <path d="M9 27 12 6.5 15.2 27z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" strokeLinejoin="round" />
    <path d="M12 6.5 10.6 27H9z" fill="#ffffff" opacity="0.5" />
    <path d="M23 27 20 8.5 16.8 27z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" strokeLinejoin="round" />
    <path d="M20 8.5 21.4 27H23z" fill={DARK} opacity="0.32" />
    <path d="M12.6 28 16 2l3.4 26z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M16 2 14.4 28h-1.8z" fill="#ffffff" opacity="0.62" />
    <path d="M16 2l1.7 26h1.7z" fill={DARK} opacity="0.28" />
    <path d="M16 9.5l2.2 5.5-2.2 1.6-2.2-1.6z" fill="#ffffff" opacity="0.4" />
    <ellipse cx="16" cy="28" rx="12" ry="2.2" fill={DARK} opacity="0.55" />
    <path d="M27 6v3M25.5 7.5h3" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
    <path d="M6 9v2.4M4.8 10.2h2.4" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
    <circle cx="22.5" cy="4" r="1" fill="#ffffff" opacity="0.8" />
  </>),
  pHoly: (u) => (<>
    <path d="M16 4c4 6 7 9 7 12.5A7 7 0 019 16.5C9 13 12 10 16 4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M16 9v8M13 12.5h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
    <ellipse cx="16" cy="26" rx="9" ry="2.6" fill={`url(#${u}-live)`} opacity="0.35" />
  </>),
  pSpikes: (u) => (<>
    <rect x="3" y="20" width="26" height="6" rx="1.5" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    {[6, 12, 18, 24].map((x, i) => (
      <path key={i} d={`M${x} 20l3-11 3 11z`} fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    ))}
  </>),
  pOvercharge: (u) => (<>
    <rect x="8" y="5" width="16" height="22" rx="3" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <rect x="12" y="2" width="8" height="4" rx="1" fill={DARK} />
    <path d="M17 9l-5 8h4l-1 7 6-9h-4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" strokeLinejoin="round" />
  </>),
  pRail: (u) => (<>
    <circle cx="16" cy="16" r="12" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" />
    <circle cx="16" cy="16" r="6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" opacity="0.7" />
    <path d="M16 1v7M16 24v7M1 16h7M24 16h7" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="2" fill="#fff" />
  </>),
  pJugg: (u) => (<>
    <path d="M6 12c0-3 3-5 6-4l4 1 4-1c3-1 6 1 6 4 0 4-3 5-5 5l1 8h-4l-1-6h-2l-1 6H10l1-8c-2 0-5-1-5-5z"
      fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M12 9l4 1 4-1" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  pElectric: (u) => (<>
    <rect x="12" y="6" width="8" height="16" rx="3" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 22v6" stroke={`url(#${u}-body)`} strokeWidth="2.4" />
    <path d="M17 8l-3 6h3l-2 5 5-7h-3z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.8" />
    <path d="M6 14l4 2-4 2M26 14l-4 2 4 2" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" />
  </>),
  pWhirl: (u) => (<>
    <path d="M16 4a12 12 0 11-8.5 20.5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.8" strokeLinecap="round" />
    <path d="M16 10a6 6 0 10 4.2 10.2" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
    <path d="M4 22l4 3 3-4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
  </>),
  pWrench: (u) => (<>
    <path d="M22 4a7 7 0 00-8 9L5 22l5 5 9-9a7 7 0 009-8l-4 4-4-1-1-4z"
      fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="9" cy="23" r="1.8" fill={`url(#${u}-live)`} />
  </>),
  pRicochet: (u) => (<>
    <path d="M4 8l10 8-6 5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 16l14-6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="4 3" />
    <path d="M24 6l5 3-4 4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="14" cy="16" r="2.4" fill="#fff" opacity="0.8" />
  </>),

  // ---- PASSIVE CARDS, second batch ----------------------------------------
  pFrost: (u) => (<>
    <path d="M16 3l4 6h-8zM16 29l-4-6h8z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <path d="M16 6v20" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M8 11l16 10M24 11L8 21" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="16" cy="16" r="3" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
  </>),
  pWire: (u) => (<>
    <path d="M3 20c4 0 4-8 8-8s4 8 8 8 4-8 8-8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" />
    <rect x="12" y="22" width="8" height="6" rx="1.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M14 22v-3M18 22v-3" stroke={`url(#${u}-body)`} strokeWidth="1.8" />
  </>),
  pTwinUp: (u) => (<>
    <path d="M10 20l6-8 6 8h-4v6h-4v-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M10 12l6-8 6 8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
  </>),
  pRadiation: (u) => (<>
    <circle cx="16" cy="16" r="3.4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    {[0, 120, 240].map((a, i) => (
      <path key={i} d="M16 12.4L11 4a13 13 0 0110 0z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9"
        transform={`rotate(${a} 16 16)`} />
    ))}
  </>),
  pStorm: (u) => (<>
    <path d="M5 12a10 10 0 0119 3" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M9 17c3 3 3 7 0 10M16 17c3 3 3 7 0 10M23 17c3 3 3 7 0 10"
      fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
  </>),
  pExecute: (u) => (<>
    <path d="M6 5l10 10-4 4L2 9z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M14 17l12 12" stroke={`url(#${u}-body)`} strokeWidth="3" strokeLinecap="round" />
    <path d="M20 6l6 2-2 6-6-2z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
  </>),
  pSoul: (u) => (<>
    <path d="M16 4a9 9 0 00-9 9c0 4 3 5 3 8v3h12v-3c0-3 3-4 3-8a9 9 0 00-9-9z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <circle cx="12.5" cy="14" r="2.4" fill={`url(#${u}-live)`} /><circle cx="19.5" cy="14" r="2.4" fill={`url(#${u}-live)`} />
    <path d="M11 27h10M12 30h8" stroke={DARK} strokeWidth="1.6" strokeLinecap="round" />
  </>),
  pQuick: (u) => (<>
    <path d="M20 3l-9 13h6l-3 13 10-15h-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M3 9h6M2 16h5M4 23h5" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" opacity="0.75" />
  </>),
  pThorns: (u) => (<>
    <circle cx="16" cy="16" r="6" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
      <path key={i} d="M16 9.6L13.6 4h4.8z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.8"
        transform={`rotate(${a} 16 16)`} />
    ))}
  </>),
  pBerserk: (u) => (<>
    <path d="M16 3c1 5-4 6-4 11a4 4 0 008 0c0-2-1-3-2-5 3 2 7 5 7 10a9 9 0 11-18 0C7 12 14 10 16 3z"
      fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M11 17l3 4M21 17l-3 4" stroke={DARK} strokeWidth="2" strokeLinecap="round" />
  </>),
  pDeathMark: (u) => (<>
    <circle cx="16" cy="16" r="11" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeDasharray="4 3" />
    <path d="M11 11l10 10M21 11L11 21" stroke={`url(#${u}-live)`} strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="16" cy="16" r="2.4" fill={DARK} />
  </>),
  pWave: (u) => (<>
    <path d="M2 20c4-6 9-6 13 0s9 6 15 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="3" strokeLinecap="round" />
    <path d="M2 26c4-5 9-5 13 0s9 5 15 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    <path d="M20 4c4 3 6 7 5 11-3-2-7-2-9 1-1-5 0-9 4-12z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
  </>),
  pStaticChain: (u) => (<>
    <path d="M4 16h7l3-6 4 12 3-6h7" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="4" cy="16" r="2.2" fill={`url(#${u}-body)`} /><circle cx="28" cy="16" r="2.2" fill={`url(#${u}-body)`} />
  </>),
  pSecondWind: (u) => (<>
    <path d="M3 11h13a4 4 0 10-4-4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M3 18h18a4 4 0 11-4 4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
    <path d="M3 25h9" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
  </>),
  pGravity: (u) => (<>
    <circle cx="16" cy="16" r="5" fill={DARK} stroke={`url(#${u}-live)`} strokeWidth="1.6" />
    {[0, 60, 120].map((a, i) => (
      <ellipse key={i} cx="16" cy="16" rx="13" ry="5" fill="none" stroke={`url(#${u}-live)`}
        strokeWidth="1.5" opacity="0.6" transform={`rotate(${a} 16 16)`} />
    ))}
  </>),
  pVenom: (u) => (<>
    <path d="M9 3c1 6 3 9 3 13a4 4 0 008 0c0-4 2-7 3-13-3 3-5 4-7 4s-4-1-7-4z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M12 19l-2 9M20 19l2 9" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="10" cy="29" r="1.6" fill={`url(#${u}-live)`} /><circle cx="22" cy="29" r="1.6" fill={`url(#${u}-live)`} />
  </>),
  pBarrel: (u) => (<>
    <rect x="4" y="13" width="22" height="6" rx="1.6" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M8 13v6M13 13v6M18 13v6M23 13v6" stroke={DARK} strokeWidth="1" opacity="0.75" />
    <path d="M26 16h4" stroke={`url(#${u}-live)`} strokeWidth="3" strokeLinecap="round" />
  </>),
  pTrigger: (u) => (<>
    <path d="M6 10h16l4 5-4 5H6z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M12 20v3a3 3 0 003 3" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M20 6l2-4 2 4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  pServo: (u) => (<>
    <circle cx="16" cy="16" r="6" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    {[0, 60, 120, 180, 240, 300].map((a, i) => (
      <rect key={i} x="14.6" y="2.5" width="2.8" height="5" rx="0.8" fill={`url(#${u}-live)`}
        transform={`rotate(${a} 16 16)`} />
    ))}
    <circle cx="16" cy="16" r="2.2" fill={DARK} />
  </>),
  pCell: (u) => (<>
    <rect x="9" y="6" width="14" height="21" rx="2.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <rect x="13" y="3" width="6" height="4" rx="1" fill={DARK} />
    <rect x="12" y="18" width="8" height="6" rx="1" fill={`url(#${u}-live)`} />
    <rect x="12" y="11" width="8" height="5" rx="1" fill={`url(#${u}-live)`} opacity="0.45" />
  </>),
  pDish: (u) => (<>
    <path d="M5 22a13 13 0 0118-18z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="12" cy="15" r="2.2" fill={`url(#${u}-live)`} />
    <path d="M14 20l8 9M18 29h8" stroke={`url(#${u}-body)`} strokeWidth="2.4" strokeLinecap="round" />
  </>),
  pPrism: (u) => (<>
    <path d="M16 4l11 20H5z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M2 14h9" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 15l12-3M19 18l12 1M20 21l11 5" stroke={`url(#${u}-live)`} strokeWidth="1.7" strokeLinecap="round" />
  </>),
  pTempo: (u) => (<>
    <path d="M11 28l4-24 4 24z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M15 6l9 12" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <rect x="12.5" y="14" width="5" height="3" rx="0.8" fill={`url(#${u}-live)`} />
  </>),
  pSingularity: (u) => (<>
    <circle cx="16" cy="16" r="6" fill="#05070c" stroke={`url(#${u}-live)`} strokeWidth="1.4" />
    <ellipse cx="16" cy="16" rx="14" ry="4.6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" opacity="0.8" />
    <ellipse cx="16" cy="16" rx="10" ry="3" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.4" opacity="0.5" transform="rotate(24 16 16)" />
  </>),
  pEcho: (u) => (<>
    <path d="M6 12h5l6-5v18l-6-5H6z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M21 11a7 7 0 010 10" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M25 7a13 13 0 010 18" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
  </>),
  pCoreOverload: (u) => (<>
    <circle cx="16" cy="16" r="7" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" />
    <circle cx="16" cy="16" r="11.5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeDasharray="3 3" />
    <path d="M16 1v4M16 27v4M1 16h4M27 16h4" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="3" fill="#fff" opacity="0.7" />
  </>),
  pConductive: (u) => (<>
    <rect x="11" y="8" width="10" height="14" rx="2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 11l-2.6 5H16l-1.4 5 4.4-6H16z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.8" />
    <path d="M11 12H5M11 18H5M21 12h6M21 18h6" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  pIronHide: (u) => (<>
    <path d="M16 3l11 4v10c0 6-5 10-11 12-6-2-11-6-11-12V7z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M16 8v14M10 13h12" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="8" cy="9" r="1.2" fill="#e2e8f0" /><circle cx="24" cy="9" r="1.2" fill="#e2e8f0" />
  </>),
  pBulletstorm: (u) => (<>
    <path d="M16 3a13 13 0 11-9 22" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={11 + i * 5} y={13 + i * 2} width="3" height="7" rx="1.5" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="0.9" />
    ))}
  </>),

  // ---- CURRENCIES ---------------------------------------------------------
  // Every currency was an emoji: ★ 💎 🎰 🌿 ◆ 🎫 🔑. Seven different art
  // styles in one row, rendering differently on every phone, and two of them
  // (💎 gems and 🔷 char pieces, 🎰 slot coins and 🎫 gacha tokens) read as
  // the same thing at chip size — you could not tell at a glance what you had.
  //
  // Drawn to the reference sheets' language: struck metal with a bevel, a
  // gemstone or an engraving as the live part, and a dark seat under it. NOT
  // neon — these sit in a UI made of brass and steel, and a glowing outline
  // would look like a different game pasted in.
  //
  // Each is legible as a SILHOUETTE first: a stack, a brilliant, a notched
  // token, a leaf, a shard cluster, a ticket, a key, a broken medallion, a
  // sliver. That is what lets them work at 18px in the top bar.

  // Gold: three struck coins seen slightly from above, the face bearing a
  // star. Depth comes from the two behind it, not from a shadow.
  curGold: (u) => (<>
    <ellipse cx="14" cy="22" rx="10" ry="4.2" fill="#6b4a12" />
    <ellipse cx="17" cy="19.5" rx="10" ry="4.2" fill="#8a5f18" />
    <circle cx="16" cy="14" r="10" fill={`url(#${u}-body)`} />
    <circle cx="16" cy="14" r="10" fill="#c9922b" />
    <circle cx="16" cy="14" r="10" fill="none" stroke="#5a3c0d" strokeWidth="1.4" />
    <circle cx="16" cy="14" r="7.4" fill="none" stroke="#f0c766" strokeWidth="1.1" opacity="0.85" />
    <path d="M16 8.6l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z"
      fill="#fbe4a0" stroke="#5a3c0d" strokeWidth="0.8" />
    <path d="M9 10a10 10 0 014-3.6" fill="none" stroke="#ffeec2" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
  </>),

  // Gems: one big brilliant with a proper table and pavilion, plus two small
  // ones. Facets are drawn as flat panels of different value — a gem reads as
  // a gem because of the hard edges between them, not because of sparkle.
  curGems: (u) => (<>
    <path d="M6 12h20l-10 15z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M6 12l4-6h12l4 6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" opacity="0.92" />
    <path d="M10 6l-4 6 10 15 10-15-4-6" fill="none" stroke={DARK} strokeWidth="1.1" />
    <path d="M10 6l2 6-2 0zM22 6l-2 6 2 0z" fill="#ffffff" opacity="0.28" />
    <path d="M12 12h8l-4 12z" fill="#ffffff" opacity="0.30" />
    <path d="M6 12h20" stroke={DARK} strokeWidth="1.1" />
    <path d="M11 9.5l1.6 1.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
  </>),

  // Slot coins: a casino token, not a coin — an octagonal rim with inset
  // edge marks and a triple-seven face. The notched outline is what tells it
  // apart from gold at chip size, before any colour is read.
  curSlot: (u) => (<>
    <path d="M16 3l7 3 3 7-3 7-7 3-7-3-3-7 3-7z" fill="#7a1420" stroke="#2a070c" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M16 3l7 3 3 7-3 7-7 3-7-3-3-7 3-7z" fill="none" stroke="#e8d9a8" strokeWidth="1" opacity="0.55" />
    <circle cx="16" cy="16" r="7" fill="#f2e3b4" stroke="#2a070c" strokeWidth="1.2" />
    <g fill="#8a1220" fontFamily="monospace">
      <path d="M11.5 12.5h3l-1.6 6h-1.4l1.4-4.6h-1.4z" />
      <path d="M14.6 12.5h3l-1.6 6h-1.4l1.4-4.6h-1.4z" />
      <path d="M17.7 12.5h3l-1.6 6h-1.4l1.4-4.6h-1.4z" />
    </g>
    {[[16, 3.4], [26, 13], [16, 28.6], [6, 13]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="1.1" fill="#e8d9a8" opacity="0.8" />
    ))}
  </>),

  // Talent points: a leaf with a raised gold midrib and veins. The only
  // organic shape in the set, deliberately — talents are the "growth" track
  // and nothing else in the row is alive.
  curTalent: (u) => (<>
    <path d="M25 5c-11 0-18 6-18 14 0 3 1 5.5 2.6 7.3C12 22 17 17 24 14c-5.5 4.4-9.4 9.2-11.4 14.2 2 1 4.3 1.2 6.4.6C27 26.6 27.6 14 25 5z"
      fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M25 5C18 12 14 20 12 28.8" fill="none" stroke="#d8b45a" strokeWidth="1.7" strokeLinecap="round" />
    <g stroke="#d8b45a" strokeWidth="1" strokeLinecap="round" opacity="0.8">
      <path d="M22 8.5l-5 .5M20 12.5l-5.5 1M17.5 17l-5 1.6M15 21.5l-4.4 2" />
    </g>
    <path d="M25 5c-6 1.5-10.5 4.5-13 8" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
  </>),

  // Skill points: three crystal shards rising from a common base. Distinct
  // from the gem by being ANGULAR and multiple — gems are wealth, SP is
  // something you spend on yourself.
  curSkill: (u) => (<>
    <path d="M16 2l5 11-5 6-5-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M16 2l5 11-5 6z" fill="#ffffff" opacity="0.22" />
    <path d="M7.5 9l4.5 7-3 6-4-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" opacity="0.9" />
    <path d="M24.5 9l-4.5 7 3 6 4-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" opacity="0.9" />
    <path d="M6 23h20l-2.5 6h-15z" fill="#3a2a12" stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M6 23h20" stroke="#d8b45a" strokeWidth="1.3" />
    <path d="M13 4.5l1.6 5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
  </>),

  // Gacha tokens: a punched ticket. The two bitten edges are the whole read —
  // nothing else in the set has a concave outline.
  curToken: (u) => (<>
    <path d="M4 9h24v5a2.6 2.6 0 000 5.2V25H4v-5.8a2.6 2.6 0 000-5.2z"
      fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M4 9h24v5a2.6 2.6 0 000 5.2V25H4v-5.8a2.6 2.6 0 000-5.2z"
      fill="#8a5f18" opacity="0.55" />
    <path d="M9 11.5v11" stroke="#f0c766" strokeWidth="1.2" strokeDasharray="2 2.2" opacity="0.9" />
    <path d="M18 12.2l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z"
      fill="#fbe4a0" stroke={DARK} strokeWidth="0.8" />
    <path d="M5 10.5h3" stroke="#ffeec2" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
  </>),

  // Probe keys: a heavy ward key. Bow, shaft, two bits — the bits are what
  // stop it reading as a generic keyhole glyph.
  curKey: (u) => (<>
    <circle cx="10" cy="10" r="6.5" fill="none" stroke={`url(#${u}-body)`} strokeWidth="3.4" />
    <circle cx="10" cy="10" r="6.5" fill="none" stroke={DARK} strokeWidth="1" opacity="0.7" />
    <circle cx="10" cy="10" r="2.6" fill={DARK} />
    <path d="M14.4 14.4L27 27" stroke={`url(#${u}-body)`} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M14.4 14.4L27 27" stroke={DARK} strokeWidth="1" opacity="0.55" />
    <path d="M21.5 21.5l-3.4 3.4M24.6 24.6l-2.6 2.6" stroke={`url(#${u}-body)`} strokeWidth="3" strokeLinecap="round" />
    <path d="M6.5 6.5a6.5 6.5 0 013.5-2" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
  </>),

  // Character pieces: a fragment of a struck medallion, with the break drawn
  // as a jagged edge and the intact rim still visible on the other side. It
  // has to look like PART of something, or it is just a shape.
  curPiece: (u) => (<>
    <path d="M16 3a13 13 0 0113 13 13 13 0 01-6 10.9l-3.6-5.4 2.4-4.6-4.6-2.2 1.4-5.2-5.2-1.1z"
      fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M16 3a13 13 0 00-13 13 13 13 0 006 10.9"
      fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" opacity="0.55" strokeDasharray="3 3.4" />
    <path d="M16 3l-1.6 7.4 5.2 1.1-1.4 5.2 4.6 2.2-2.4 4.6 3.6 5.4"
      fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.4" />
    <circle cx="19" cy="14" r="2.4" fill={DARK} opacity="0.55" />
  </>),

  // Evolution shards: a sliver of something that used to be whole, with two
  // splinters beside it. Thin and pointed, so it never reads as a gem.
  curShard: (u) => (<>
    <path d="M18 2l6 12-4 16-6-11z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M18 2l6 12-6 3z" fill="#ffffff" opacity="0.30" />
    <path d="M9 8l3.5 8-2.5 9-3-9z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" opacity="0.75" />
    <path d="M26 11l2.6 6-3.4 7-1-7z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" opacity="0.6" />
    <path d="M18 2l-4 17" fill="none" stroke={DARK} strokeWidth="1" opacity="0.6" />
  </>),

  regen: (u) => (<>
    <path d="M16 5c5 7 8 10.5 8 14a8 8 0 01-16 0c0-3.5 3-7 8-14z"
      fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M16 13v8M12 17h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
    <path d="M9 26c3 2 11 2 14 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.2" strokeLinecap="round" />
  </>),

  // Dodge: an afterimage. Two ghosted silhouettes trailing a solid one —
  // motion left behind is the only way to draw "was not there when it hit".
  dodge: (u) => (<>
    <ellipse cx="8" cy="16" rx="4" ry="7" fill={`url(#${u}-body)`} opacity="0.25" />
    <ellipse cx="14" cy="16" rx="4.5" ry="7.5" fill={`url(#${u}-body)`} opacity="0.5" />
    <ellipse cx="21" cy="16" rx="5" ry="8" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M26 9l3-3M27 16h4M26 23l3 3" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
  </>),

  // Reload: a magazine seating into a well, with the cycle arrow around it.
  reload: (u) => (<>
    <path d="M22 6a11 11 0 10 4 8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M27 5v6h-6z" fill={`url(#${u}-live)`} />
    <rect x="12" y="14" width="8" height="13" rx="1.5" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M13 18h6M13 21h6M13 24h6" stroke={DARK} strokeWidth="1.1" />
  </>),

  // Magazine: a taller box with rounds stacked visibly inside it. Distinct
  // from the reload glyph by having no arrow and by showing what is IN it.
  mag: (u) => (<>
    <rect x="10" y="5" width="12" height="22" rx="2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <rect x="9" y="3" width="14" height="4" rx="1" fill={DARK} />
    {[10, 14.5, 19, 23.5].map((y, i) => (
      <rect key={i} x="12.5" y={y} width="7" height="3" rx="1.2" fill={`url(#${u}-live)`} />
    ))}
  </>),

  // Skill cooldown: a dial with a swept sector and a hand — a clock says time,
  // the swept wedge says "part of it has already run down".
  skillcd: (u) => (<>
    <circle cx="16" cy="16" r="11" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <path d="M16 16 L16 6 A10 10 0 0 1 24.7 21 Z" fill={`url(#${u}-live)`} opacity="0.85" />
    <circle cx="16" cy="16" r="11" fill="none" stroke={DARK} strokeWidth="1.3" />
    <path d="M16 16V9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M16 16l5 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
    <circle cx="16" cy="16" r="1.8" fill={DARK} />
  </>),

  katana: (u) => (<>
    {/* blade */}
    <path d="M27 3l1.6 1.6L10 24l-3.2-3.2z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    {/* the edge catches the light */}
    <path d="M27 3l1.6 1.6L10 24" fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
    {/* tsuba (guard) */}
    <path d="M6.4 20.4l5.2 5.2-2 2-5.2-5.2z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    {/* wrapped hilt */}
    <path d="M4.2 22.8l5 5-2.6 2.6-5-5z" fill={DARK} />
    <path d="M5 25.4l3 3M6.6 23.8l3 3" stroke={STEEL_HI} strokeWidth="0.9" opacity="0.8" />
  </>),
  pistol: (u) => (<>
    <path d="M3 11h16l3 1.5v4H12l-1.4 4H8.6l-1-4H3z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <rect x="5" y="12.4" width="7" height="1.8" rx="0.9" fill={DARK} opacity="0.75" />
    <path d="M7.6 20.6 6 29h4.4l2.4-8.4z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M8 22.6l3-0.8M7.6 24.6l3-0.8M7.2 26.6l3-0.8" stroke={STEEL_HI} strokeWidth="0.9" opacity="0.85" />
    <path d="M12.6 20.6a5 5 0 0 0 4.4 3.4" fill="none" stroke={STEEL} strokeWidth="1.6" strokeLinecap="round" />
    <rect x="19" y="12" width="6" height="4.6" rx="1.2" fill={STEEL_HI} stroke={DARK} strokeWidth="1" />
    <circle cx="27" cy="14.3" r="6" fill={`url(#${u}-glow)`} />
    <path d="M25 14.3c2-1.6 3.4-1.6 5.4 0-1.6 1.2-3.6 1.2-5.4 0z" fill={`url(#${u}-live)`} />
    <circle cx="30.4" cy="11.6" r="1.3" fill={`url(#${u}-live)`} opacity="0.9" />
    <circle cx="29.6" cy="17.4" r="1" fill={`url(#${u}-live)`} opacity="0.7" />
  </>),
  cannon: (u) => (<>
    <path d="M2 11h20v6H12l-1.6 4.4H7.8L6.2 17H2z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <rect x="3" y="12" width="18" height="1.6" fill={STEEL_HI} opacity="0.7" />
    <rect x="4.5" y="14.4" width="5" height="1.6" rx="0.8" fill={DARK} opacity="0.8" />
    <path d="M7.4 22 6 30h4.6l2.2-8z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M7.8 24l3-0.8M7.4 26l3-0.8" stroke={STEEL_HI} strokeWidth="0.9" opacity="0.8" />
    <path d="M12.8 22a5 5 0 0 0 4.2 3.2" fill="none" stroke={STEEL} strokeWidth="1.6" strokeLinecap="round" />
    <rect x="22" y="11.6" width="6.5" height="5" rx="0.8" fill={STEEL_HI} stroke={DARK} strokeWidth="1" />
    <rect x="23.4" y="12.6" width="1.4" height="3" fill={DARK} />
    <rect x="26" y="12.6" width="1.4" height="3" fill={DARK} />
    <circle cx="30" cy="14" r="7" fill={`url(#${u}-glow)`} />
    <path d="M28.6 14 32 10.6l-1 3.4 1 3.4z" fill={`url(#${u}-live)`} opacity="0.95" />
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
    <path d="M29 3c-12 0-21 7-22 18 3-9 11-14 22-14z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M29 3c-10 0-18 5-21 13" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
    <path d="M7 21 22 29" stroke={`url(#${u}-body)`} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M7 21 22 29" stroke={STEEL_HI} strokeWidth="1" opacity="0.5" strokeLinecap="round" />
    <rect x="16" y="23.4" width="5" height="2.6" rx="1.2" transform="rotate(28 18.5 24.7)" fill={DARK} />
    <path d="M28.6 4.2c1 2 0.6 3.4-1 4.6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="27.4" cy="10.6" r="1.5" fill={`url(#${u}-live)`} />
    <circle cx="26.4" cy="14.4" r="1" fill={`url(#${u}-live)`} opacity="0.75" />
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
    <circle cx="16" cy="16" r="13" fill={`url(#${u}-glow)`} opacity="0.55" />
    <path d="M19 1 8 17h5.4l-2 6.4 4.6-5.2-1.6 4.2 4-5.4h-4.6L19 9h-4.4z"
          fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M18 3.4 10.6 15.4h4.8l-2.2 5.4" fill="none" stroke="#ffffff" strokeWidth="1.3" opacity="0.85" strokeLinejoin="round" />
    <path d="M13.4 17.4 9 22.6l3.4-1.2-1.6 4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    <path d="M14 28.6 12 31M18 28.6 20 31M16 29.4V32" stroke={`url(#${u}-live)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <circle cx="16" cy="27.4" r="2.6" fill="#ffffff" opacity="0.55" />
  </>),
  orb: (u) => (<>
    <circle cx="16" cy="16" r="13" fill={`url(#${u}-glow)`} />
    <circle cx="16" cy="16" r="8" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="12.5" cy="12.5" r="2.6" fill="#ffffff" opacity="0.75" />
    <ellipse cx="16" cy="16" rx="14" ry="5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.2" opacity="0.6" />
  </>),
  beam: (u) => (<>
    <path d="M1 10.5h9.5v11H1z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="2.6" y="12.6" width="5" height="2.4" rx="0.8" fill={`url(#${u}-live)`} />
    <rect x="2.6" y="17" width="5" height="2.4" rx="0.8" fill={DARK} opacity="0.7" />
    <path d="M10.5 9.5 14 12v8l-3.5 2.5z" fill={STEEL_HI} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M14 12.6h18v6.8H14z" fill="#07030f" />
    <path d="M14 12.6h18M14 19.4h18" stroke={`url(#${u}-live)`} strokeWidth="1.8" />
    <path d="M14 16h18" stroke="#ffffff" strokeWidth="1" opacity="0.55" />
    <circle cx="14" cy="16" r="7" fill={`url(#${u}-glow)`} />
    <circle cx="24" cy="9.6" r="1.3" fill={`url(#${u}-live)`} opacity="0.8" />
    <circle cx="29" cy="23" r="1.1" fill={`url(#${u}-live)`} opacity="0.65" />
    <circle cx="19" cy="24" r="0.9" fill={`url(#${u}-live)`} opacity="0.5" />
  </>),
  meteor: (u) => (<>
    <path d="M2 31 9 24l2.6 2.6L4.6 33z" fill={`url(#${u}-live)`} opacity="0.28" />
    <path d="M1 27 12 16l3.4 3.4L4.4 30.4z" fill={`url(#${u}-live)`} opacity="0.45" />
    <path d="M4 30 16 18l2.4 2.4L6.4 32.4z" fill="#fff3d0" opacity="0.30" />
    <path d="M9 25 20 14c2 2 3 4 2.6 6L12 30z" fill={`url(#${u}-live)`} opacity="0.75" />
    <circle cx="22" cy="11" r="11" fill={`url(#${u}-glow)`} />
    <circle cx="22" cy="11" r="7" fill={STEEL} stroke={DARK} strokeWidth="1.2" />
    <path d="M22 4a7 7 0 0 1 6.4 4.1A7 7 0 0 0 22 4z" fill="#fff3d0" opacity="0.9" />
    <path d="M15.6 13A7 7 0 0 0 22 18a7 7 0 0 0 6.4-4.2c-2 3-4 4-6.4 4-2.6 0-4.8-1.4-6.4-4.8z"
          fill={`url(#${u}-live)`} opacity="0.95" />
    <circle cx="19.6" cy="9.2" r="1.7" fill={DARK} opacity="0.7" />
    <circle cx="24" cy="13" r="1.2" fill={DARK} opacity="0.55" />
    <circle cx="24.6" cy="8" r="0.9" fill={DARK} opacity="0.45" />
    <path d="M28 5.6 31 3M27 16l3 2.4M17 3.6 15.6 1" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    <circle cx="8" cy="21" r="1.4" fill="#fff3d0" opacity="0.8" />
    <circle cx="13" cy="27" r="1" fill={`url(#${u}-live)`} opacity="0.7" />
  </>),
  drone: (u) => (<>
    <ellipse cx="16" cy="6.5" rx="9" ry="1.8" fill={`url(#${u}-live)`} opacity="0.6" />
    <path d="M16 8.5 22 14l-6 5.5L10 14z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <circle cx="16" cy="14" r="2.6" fill={`url(#${u}-live)`} />
    <circle cx="16" cy="14" r="7" fill={`url(#${u}-glow)`} opacity="0.55" />
    <ellipse cx="6" cy="20" rx="5.4" ry="1.2" fill={`url(#${u}-live)`} opacity="0.45" />
    <path d="M6 21.4 9.4 24.6 6 27.8 2.6 24.6z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="6" cy="24.6" r="1.5" fill={`url(#${u}-live)`} />
    <ellipse cx="26" cy="20" rx="5.4" ry="1.2" fill={`url(#${u}-live)`} opacity="0.45" />
    <path d="M26 21.4 29.4 24.6 26 27.8 22.6 24.6z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="26" cy="24.6" r="1.5" fill={`url(#${u}-live)`} />
  </>),
  whip: (u) => (<>
    <path d="M2 28c7 2 11-2 12-7s3-9 8-10 8 2 8 6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="4" strokeLinecap="round" />
    <path d="M2 28c7 2 11-2 12-7s3-9 8-10" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.55" strokeLinecap="round" />
    <path d="M30 17c0 3-2 5-5 5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M25 22c-2 0-3-1-3.4-2.4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
    <path d="M2 28 1 31" stroke={`url(#${u}-body)`} strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="27" cy="8" r="2.4" fill="#ffffff" opacity="0.9" />
    <circle cx="21" cy="26" r="1.6" fill={`url(#${u}-live)`} opacity="0.85" />
    <circle cx="14" cy="8" r="1.3" fill={`url(#${u}-live)`} opacity="0.6" />
    <circle cx="8" cy="18" r="1.1" fill={`url(#${u}-live)`} opacity="0.5" />
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

  // ---- General UI glyphs ---------------------------------------------------
  // Replacing the sweep of literal emoji left in tab labels, toasts and reward
  // rows across Camp/Shop/Pets/Prospector/Weaponsmith — see no-emoji-rule.
  // Same 32x32 box, same Defs gradients, so they sit on the same shelf as
  // every weapon/passive/currency glyph above rather than reading as a
  // second, cheaper art style bolted on for "just UI".
  lock: (u) => (<>
    <path d="M10 14V10a6 6 0 0 1 12 0v4" fill="none" stroke={`url(#${u}-body)`} strokeWidth="3" />
    <rect x="6" y="14" width="20" height="14" rx="2.5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="20" r="2.2" fill={DARK} />
    <rect x="15" y="20" width="2" height="4" fill={DARK} />
  </>),
  chest: (u) => (<>
    <path d="M4 14a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v11H4z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M4 15h24" stroke={DARK} strokeWidth="1.4" />
    <path d="M4 15h24v2H4z" fill={`url(#${u}-live)`} opacity="0.85" />
    <circle cx="16" cy="17" r="2" fill={STEEL_LO} stroke={DARK} strokeWidth="0.9" />
  </>),
  scroll: (u) => (<>
    <rect x="7" y="6" width="18" height="20" fill={`url(#${u}-live)`} opacity="0.9" />
    <ellipse cx="7" cy="6" rx="3" ry="3" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <ellipse cx="25" cy="26" rx="3" ry="3" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <path d="M11 12h11M11 16h11M11 20h7" stroke={DARK} strokeWidth="1.1" opacity="0.55" strokeLinecap="round" />
  </>),
  map: (u) => (<>
    <path d="M4 7l9-3 9 3 6-2v20l-6 2-9-3-9 3z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M13 4v20M22 7v20" stroke={DARK} strokeWidth="0.9" opacity="0.4" />
    <path d="M8 11l6 6 8-5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="22" cy="12" r="2" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.8" />
  </>),
  compass: (u) => (<>
    <circle cx="16" cy="16" r="13" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.3" />
    <circle cx="16" cy="16" r="13" fill="none" stroke={STEEL_HI} strokeWidth="1" opacity="0.4" />
    <path d="M16 8l4 8-4 8-4-8z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="16" r="1.6" fill="#ffffff" opacity="0.8" />
  </>),
  rocket: (u) => (<>
    <path d="M16 3c5 4 6 10 6 15l-6 4-6-4c0-5 1-11 6-15z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="13" r="3" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
    <path d="M10 18l-4 6 6-2M22 18l4 6-6-2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <path d="M13 22l3 8 3-8z" fill={`url(#${u}-live)`} opacity="0.9" />
  </>),
  pillars: (u) => (<>
    <path d="M4 9 16 3 28 9v3H4z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="6" y="13" width="4" height="14" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <rect x="14" y="13" width="4" height="14" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <rect x="22" y="13" width="4" height="14" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <rect x="4" y="27" width="24" height="3" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
  </>),
  person: (u) => (<>
    <circle cx="16" cy="10" r="6" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M5 28c1-7 6-11 11-11s10 4 11 11z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
  </>),
  paw: (u) => (<>
    <ellipse cx="16" cy="21" rx="8" ry="6.5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <ellipse cx="7" cy="11" rx="3" ry="4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <ellipse cx="14" cy="7" rx="3" ry="4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <ellipse cx="21" cy="7" rx="3" ry="4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <ellipse cx="27" cy="12" rx="2.8" ry="3.6" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
  </>),
  brain: (u) => (<>
    <path d="M11 5a5 5 0 0 0-4 8 5 5 0 0 0 1 9 5 5 0 0 0 8 3 5 5 0 0 0 8-3 5 5 0 0 0 1-9 5 5 0 0 0-4-8 5 5 0 0 0-5 2 5 5 0 0 0-5-2z"
      fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 6v20M11 10c2 1 3 3 2 5M22 10c-2 1-3 3-2 5M10 18c2 0 3 1 4 3M23 18c-2 0-3 1-4 3"
      stroke={`url(#${u}-live)`} strokeWidth="1.3" fill="none" opacity="0.8" strokeLinecap="round" />
  </>),
  hammer: (u) => (<>
    <rect x="13.2" y="12" width="3.6" height="17" rx="1.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <path d="M6 4h16l4 5-4 5H6l-4-5z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
  </>),
  reticle: (u) => (<>
    <circle cx="16" cy="16" r="12" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.4" />
    <circle cx="16" cy="16" r="5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <path d="M16 1v6M16 25v6M1 16h6M25 16h6" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
  </>),
  book: (u) => (<>
    <path d="M16 8c-3-2-8-3-12-2v18c4-1 9 0 12 2z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 8c3-2 8-3 12-2v18c-4-1-9 0-12 2z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 8v18" stroke={DARK} strokeWidth="1" opacity="0.5" />
  </>),
  magnifier: (u) => (<>
    <circle cx="14" cy="14" r="9" fill={`url(#${u}-live)`} opacity="0.35" stroke={`url(#${u}-body)`} strokeWidth="2.6" />
    <path d="M21 21l7 7" stroke={`url(#${u}-body)`} strokeWidth="3.2" strokeLinecap="round" />
  </>),
  skull: (u) => (<>
    <path d="M16 4a10 10 0 0 0-10 10c0 4 2 6 3 8h14c1-2 3-4 3-8A10 10 0 0 0 16 4z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <ellipse cx="12" cy="15" rx="2.6" ry="3.2" fill={DARK} />
    <ellipse cx="20" cy="15" rx="2.6" ry="3.2" fill={DARK} />
    <path d="M14 22h1l1 2 1-2h1l1 2 1-2h1" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.3" />
  </>),
  boltPart: (u) => (<>
    <path d="M16 3l11 6v14l-11 6-11-6V9z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="16" r="6.5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="16" r="2.4" fill={DARK} />
  </>),
  egg: (u) => (<>
    <path d="M16 4C10 4 6 15 6 21a10 8 0 0 0 20 0c0-6-4-17-10-17z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M11 15l3 3-2 3 4 4" fill="none" stroke="#ffffff" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
  </>),
  hatchling: (u) => (<>
    <path d="M16 6C11 6 8 14 8 19a8 7 0 0 0 16 0c0-5-3-13-8-13z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 6l-4-4 6 1z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <circle cx="19" cy="14" r="1.3" fill={DARK} />
  </>),
  ghost: (u) => (<>
    <path d="M8 27V14a8 8 0 0 1 16 0v13l-3-3-2.5 3-2.5-3-2.5 3-2.5-3z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" opacity="0.92" />
    <ellipse cx="12.5" cy="14" rx="1.7" ry="2.2" fill={DARK} />
    <ellipse cx="19.5" cy="14" rx="1.7" ry="2.2" fill={DARK} />
  </>),
  orb: (u) => (<>
    <circle cx="16" cy="17" r="10" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" opacity="0.92" />
    <ellipse cx="12.5" cy="13" rx="3" ry="2" fill="#ffffff" opacity="0.5" />
    <rect x="10" y="27" width="12" height="3" rx="1.2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
  </>),
  ticket: (u) => (<>
    <rect x="3" y="10" width="26" height="12" rx="2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="3" cy="16" r="3" fill="#0d141f" />
    <circle cx="29" cy="16" r="3" fill="#0d141f" />
    <path d="M18 10v12" stroke={DARK} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
    <path d="M6 16h9" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
  </>),
  moneybag: (u) => (<>
    <path d="M13 6h6l2 4c3 2 5 5 5 9a10 8 0 0 1-20 0c0-4 2-7 5-9z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M12 6c0-2 2-3 4-3s4 1 4 3" fill="none" stroke={STEEL} strokeWidth="1.6" />
    <path d="M16 15v9M13.5 17a3 3 0 0 1 5 2c0 2-2 2.5-2.5 2.5" fill="none" stroke={DARK} strokeWidth="1.2" opacity="0.6" />
  </>),
  trash: (u) => (<>
    <path d="M8 10h16l-2 17a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M5 10h22M12 6h8l1.5 4h-11z" fill="none" stroke={DARK} strokeWidth="1.4" />
    <path d="M13 14v10M16 14v10M19 14v10" stroke={`url(#${u}-live)`} strokeWidth="1.4" strokeLinecap="round" />
  </>),
  trident: (u) => (<>
    <path d="M16 4v24" stroke={`url(#${u}-body)`} strokeWidth="2.6" />
    <path d="M9 4v9M9 4h6M16 4h-1M23 4v9M23 4h-6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M9 13l7 8 7-8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
  </>),
  tornado: (u) => (<>
    <path d="M4 7h24M7 14h18M10 21h12M13 28h6" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
    <path d="M4 7h24" stroke={DARK} strokeWidth="0.8" opacity="0.4" />
  </>),
  waterdrop: (u) => (<>
    <path d="M16 3c6 8 10 14 10 19a10 10 0 0 1-20 0c0-5 4-11 10-19z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <ellipse cx="12.5" cy="18" rx="2.2" ry="3.2" fill="#ffffff" opacity="0.4" />
  </>),
  pickaxe: (u) => (<>
    <path d="M4 12c6-8 18-8 24 0-8-2-16-2-24 0z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="14.5" y="10" width="3" height="19" rx="1.3" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" transform="rotate(8 16 20)" />
  </>),
  leaf: (u) => (<>
    <path d="M6 26C4 14 12 5 26 4c1 14-8 22-20 22z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M8 24C10 15 16 9 23 6" fill="none" stroke={DARK} strokeWidth="1.1" opacity="0.5" />
  </>),
  medal: (u) => (<>
    <path d="M11 3h10l-3 11h-4z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="20" r="9" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M16 15l2.4 4.6 5.1.7-3.7 3.6.9 5.1-4.7-2.5-4.7 2.5.9-5.1-3.7-3.6 5.1-.7z" fill="#ffffff" opacity="0.35" />
  </>),
  cog: (u) => (<>
    <path d="M16 4l2 3.4 3.8-1.2 1 3.9 4 .4-1 3.9 3 2.6-3 2.6 1 3.9-4 .4-1 3.9-3.8-1.2L16 28l-2-3.4-3.8 1.2-1-3.9-4-.4 1-3.9-3-2.6 3-2.6-1-3.9 4-.4 1-3.9 3.8 1.2z"
      fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="16" r="6" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
  </>),
  chart: (u) => (<>
    <path d="M4 28V6M4 28h24" stroke={DARK} strokeWidth="1.6" />
    <rect x="8" y="18" width="4" height="10" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <rect x="15" y="12" width="4" height="16" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <rect x="22" y="8" width="4" height="20" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
  </>),

  // ---- Weapon-part slot glyphs (Weaponsmith / Forge) -----------------------
  // Five slots keyed 1:1 to PART_SLOT_INFO in game/data_ext2.js. `sight`
  // reuses `reticle` and `magazine` reuses `mag` above rather than redrawing.
  partBarrel: (u) => (<>
    <rect x="4" y="13" width="22" height="6" rx="1.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="24" y="12" width="5" height="8" rx="1" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="27" cy="16" r="1.6" fill={DARK} />
    <path d="M4 14h20" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
  </>),
  partMuzzle: (u) => (<>
    <circle cx="16" cy="16" r="11" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="16" r="5.5" fill="#05070d" stroke={DARK} strokeWidth="1" />
    {[0, 60, 120, 180, 240, 300].map(a => (
      <rect key={a} x="15" y="4" width="2" height="5" fill={`url(#${u}-live)`} transform={`rotate(${a} 16 16)`} />
    ))}
  </>),
  partStock: (u) => (<>
    <path d="M5 12h9v4h6l4-3v10l-4-3h-6v4H5z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M14 12v12" stroke={DARK} strokeWidth="1" opacity="0.4" />
    <path d="M20 16h4" stroke={`url(#${u}-live)`} strokeWidth="1.6" />
  </>),
  partBullet: (u) => (<>
    <path d="M11 6h6l3 6v14H8V12z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M8 16h12" stroke={DARK} strokeWidth="1" opacity="0.5" />
    <path d="M11 6h6l2 4h-10z" fill={`url(#${u}-live)`} />
  </>),
  partGrip: (u) => (<>
    <path d="M10 4h9v10l4 4v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7H9a2 2 0 0 1-2-2V9a5 5 0 0 1 3-5z"
      fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <path d="M10 12h9" stroke={`url(#${u}-live)`} strokeWidth="1.6" opacity="0.85" />
  </>),

  clock: (u) => (<>
    <circle cx="16" cy="17" r="12" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="17" r="12" fill="none" stroke={STEEL_HI} strokeWidth="1" opacity="0.4" />
    <path d="M16 9v8l6 4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <rect x="13" y="2" width="6" height="3" rx="1" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
  </>),
  infinity: (u) => (<>
    <path d="M9 16a5 5 0 1 0 5 5c0-6 4-10 9-10a5 5 0 1 1-5 5c0 6-4 10-9 10a5 5 0 0 1 0-10z"
      fill="none" stroke={`url(#${u}-body)`} strokeWidth="4" strokeLinecap="round" />
    <path d="M9 16a5 5 0 1 0 5 5c0-6 4-10 9-10a5 5 0 1 1-5 5c0 6-4 10-9 10a5 5 0 0 1 0-10z"
      fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" />
  </>),
  eye: (u) => (<>
    <path d="M2 16c4-7 10-10 14-10s10 3 14 10c-4 7-10 10-14 10S6 23 2 16z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="16" r="7" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="16" cy="16" r="3" fill={DARK} />
    <circle cx="14" cy="14" r="1.2" fill="#ffffff" opacity="0.7" />
  </>),
  calendar: (u) => (<>
    <rect x="4" y="6" width="24" height="22" rx="2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="4" y="6" width="24" height="6" fill={`url(#${u}-live)`} />
    <rect x="9" y="2" width="2.6" height="7" rx="1" fill={STEEL_HI} />
    <rect x="20.4" y="2" width="2.6" height="7" rx="1" fill={STEEL_HI} />
    {[[9,17],[15,17],[21,17],[9,22],[15,22],[21,22]].map(([x,y],i) => (
      <rect key={i} x={x} y={y} width="4" height="3.4" fill={i===0 ? `url(#${u}-live)` : STEEL_LO} stroke={DARK} strokeWidth="0.6" />
    ))}
  </>),
  cards: (u) => (<>
    <rect x="4" y="10" width="16" height="20" rx="2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" transform="rotate(-8 12 20)" />
    <rect x="12" y="8" width="16" height="20" rx="2" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="20" cy="14" r="2.4" fill="#ffffff" opacity="0.55" />
  </>),
};

// ---- Second glyph set ------------------------------------------------------
// Added because the map below only covered 23 ids while the game ships 38
// weapons, and GameIcon falls back to `pistol` for anything unmapped — so
// twenty-one different weapons all drew the same handgun. On top of that,
// `bolt` was doing duty for five separate weapons and `orb` for three, and
// one key (`bloodScythe`) didn't even match its weapon id (`bloodscythe`), so
// that one silently fell back too. The rack read as one weapon repeated.
//
// Each of these is a distinct silhouette — the shape has to carry the
// identity at 26px on a phone, where colour alone does not.
Object.assign(GLYPHS, {
  // Static emplacement: squat base, short barrel, sighting ring.
  turret: (u) => (<>
    <path d="M7 24h18l-2-5H9z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="14" y="9" width="4" height="11" rx="1" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="16" cy="8" r="3.4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="8" r="6.5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="0.9" opacity="0.5" />
    <circle cx="16" cy="8" r="6" fill={`url(#${u}-glow)`} />
  </>),
  // Proximity mine: disc with radial spikes and a live core.
  mine: (u) => (<>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <rect key={a} x="15.2" y="2.5" width="1.6" height="6" fill={STEEL}
        transform={`rotate(${a} 16 16)`} />
    ))}
    <circle cx="16" cy="16" r="8.5" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="16" r="3.4" fill={`url(#${u}-live)`} />
    <circle cx="16" cy="16" r="9" fill={`url(#${u}-glow)`} />
  </>),
  // Solar flare: hot core with an asymmetric corona.
  flare: (u) => (<>
    <circle cx="16" cy="16" r="15" fill={`url(#${u}-glow)`} />
    <path d="M16 1c1.4 4 2.6 5.4 5.6 6.6C18.4 7.4 17 8.6 16 12c-1-3.4-2.4-4.6-5.6-4.4C13.4 6.4 14.6 5 16 1z" fill={`url(#${u}-live)`} opacity="0.9" />
    <path d="M31 16c-4 1.4-5.4 2.6-6.6 5.6C24.6 18.4 23.4 17 20 16c3.4-1 4.6-2.4 4.4-5.6C25.6 13.4 27 14.6 31 16z" fill={`url(#${u}-live)`} opacity="0.9" />
    <path d="M16 31c-1.4-4-2.6-5.4-5.6-6.6C13.6 24.6 15 23.4 16 20c1 3.4 2.4 4.6 5.6 4.4C18.6 25.6 17.4 27 16 31z" fill={`url(#${u}-live)`} opacity="0.9" />
    <path d="M1 16c4-1.4 5.4-2.6 6.6-5.6C7.4 13.6 8.6 15 12 16c-3.4 1-4.6 2.4-4.4 5.6C6.4 18.6 5 17.4 1 16z" fill={`url(#${u}-live)`} opacity="0.9" />
    <circle cx="16" cy="16" r="9" fill={`url(#${u}-live)`} opacity="0.55" />
    <circle cx="16" cy="16" r="6.4" fill="#ffe9a3" />
    <circle cx="16" cy="16" r="4" fill="#ffffff" />
    <path d="M9.6 16a6.4 6.4 0 0 1 4-5.9 6.4 6.4 0 0 0 0 11.8 6.4 6.4 0 0 1-4-5.9z" fill="#ffffff" opacity="0.5" />
    <circle cx="26" cy="7" r="1.3" fill="#ffe9a3" opacity="0.9" />
    <circle cx="6" cy="25" r="1.1" fill="#ffe9a3" opacity="0.8" />
    <circle cx="27" cy="24" r="0.9" fill="#ffffff" opacity="0.75" />
    <circle cx="5.5" cy="6" r="0.8" fill="#ffffff" opacity="0.65" />
  </>),
  // Railgun: long rails with an accelerating slug between them.
  railgun: (u) => (<>
    <rect x="3" y="11" width="26" height="2.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="0.9" />
    <rect x="3" y="18.6" width="26" height="2.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="0.9" />
    <rect x="6" y="9" width="4" height="14" fill={STEEL} stroke={DARK} strokeWidth="1" />
    <rect x="17" y="14" width="7" height="4" fill={`url(#${u}-live)`} />
    <circle cx="27" cy="16" r="6" fill={`url(#${u}-glow)`} />
  </>),
  // Harpoon: barbed head on a line.
  harpoon: (u) => (<>
    <path d="M3 22 L20 9" stroke={STEEL_HI} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M20 9 L27 4 L25 12 L18 14 Z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <path d="M17 12 L13 11 M19 15 L18 19" stroke={STEEL} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="25" cy="8" r="5" fill={`url(#${u}-glow)`} />
  </>),
  // Twin revolvers: two crossed frames, unmistakably a pair.
  revolvers: (u) => (<>
    <path d="M2 8h10.4v3.2H8.6l-1.2 3.4H5.2L4 11.2H2z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="10.4" cy="9.6" r="2.9" fill={STEEL} stroke={DARK} strokeWidth="1.1" />
    <circle cx="10.4" cy="9.6" r="0.9" fill={DARK} />
    <circle cx="10.4" cy="7.4" r="0.7" fill={STEEL_HI} />
    <circle cx="12.4" cy="10.6" r="0.7" fill={STEEL_HI} />
    <rect x="13" y="8.2" width="9.5" height="2.7" rx="0.6" fill={STEEL_HI} stroke={DARK} strokeWidth="0.9" />
    <rect x="13" y="7.4" width="8" height="1" fill={STEEL} />
    <circle cx="25" cy="9.6" r="4.4" fill={`url(#${u}-glow)`} />
    <path d="M30 24H19.6v-3.2h3.8l1.2-3.4h2.2L28 20.8h2z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="21.6" cy="22.4" r="2.9" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="21.6" cy="22.4" r="0.9" fill={DARK} />
    <circle cx="21.6" cy="24.6" r="0.7" fill={STEEL_HI} />
    <rect x="9.5" y="21.1" width="9.5" height="2.7" rx="0.6" fill={STEEL_HI} stroke={DARK} strokeWidth="0.9" />
    <rect x="11" y="23.8" width="8" height="1" fill={STEEL} />
    <circle cx="7" cy="22.4" r="4.4" fill={`url(#${u}-glow)`} />
  </>),
  // Scattergun: a cone of pellets leaving a wide muzzle.
  scatter: (u) => (<>
    <path d="M3 13h12l3 3h-3l-2 3H5z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    {[[21, 8], [26, 11], [30, 8], [22, 16], [27, 17], [23, 23], [29, 23]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={i % 2 ? 1.9 : 1.4} fill={`url(#${u}-live)`} />
    ))}
    <circle cx="25" cy="16" r="8" fill={`url(#${u}-glow)`} />
  </>),
  // Arc caster: a hand-held focus with a crackling arc.
  caster: (u) => (<>
    <path d="M6 21 L13 14 L11 22 L18 15" fill="none" stroke={`url(#${u}-live)`}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 15 l6-6 4 4 -6 6z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="22" cy="13" r="2.4" fill={`url(#${u}-live)`} />
    <circle cx="22" cy="13" r="7" fill={`url(#${u}-glow)`} />
  </>),
  // Comet: a head with a swept double tail (distinct from `meteor`).
  comet: (u) => (<>
    <path d="M2 27 C10 24 14 19 19 12" stroke={`url(#${u}-live)`} strokeWidth="2.6"
      strokeLinecap="round" fill="none" opacity="0.85" />
    <path d="M7 29 C13 26 16 22 20 16" stroke={`url(#${u}-live)`} strokeWidth="1.6"
      strokeLinecap="round" fill="none" opacity="0.5" />
    <circle cx="23" cy="9" r="5.2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="21.4" cy="7.6" r="1.8" fill="#fff" opacity="0.8" />
    <circle cx="23" cy="9" r="9" fill={`url(#${u}-glow)`} />
  </>),
  // Shockwave: concentric expanding rings from a low origin.
  shockwave: (u) => (<>
    {[6, 10.5, 15].map((r, i) => (
      <path key={r} d={`M${16 - r} 22 A ${r} ${r * 0.72} 0 0 1 ${16 + r} 22`}
        fill="none" stroke={`url(#${u}-live)`} strokeWidth={2.4 - i * 0.6}
        opacity={0.95 - i * 0.28} strokeLinecap="round" />
    ))}
    <ellipse cx="16" cy="23" rx="4" ry="2.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="16" cy="22" r="9" fill={`url(#${u}-glow)`} />
  </>),
  // Acid sprayer: nozzle with a corrosive droplet plume.
  acid: (u) => (<>
    <rect x="2" y="12" width="8" height="12" rx="2.4" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" />
    <rect x="3.6" y="14" width="2.2" height="8" rx="1.1" fill={`url(#${u}-live)`} opacity="0.8" />
    <path d="M10 15h5l3 2.4v3L15 23h-5z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M18 17.4 22 16v8l-4-1.4z" fill={STEEL_HI} stroke={DARK} strokeWidth="1" strokeLinejoin="round" />
    <circle cx="26" cy="16" r="9" fill={`url(#${u}-glow)`} />
    <circle cx="25.4" cy="13.4" r="3.4" fill={`url(#${u}-live)`} />
    <circle cx="29" cy="18" r="2.4" fill={`url(#${u}-live)`} opacity="0.9" />
    <circle cx="24" cy="20.6" r="2" fill={`url(#${u}-live)`} opacity="0.8" />
    <path d="M27 24.6c0 1.6-1 2.6-1 3.6a1.4 1.4 0 0 0 2.8 0c0-1-1-2-1.8-3.6z" fill={`url(#${u}-live)`} />
    <path d="M22 26c0 1.2-0.8 2-0.8 2.8a1.1 1.1 0 0 0 2.2 0c0-0.8-0.8-1.6-1.4-2.8z" fill={`url(#${u}-live)`} opacity="0.8" />
  </>),
  // Bone shards: splintered fragments, not a skull. Written out rather than
  // mapped — the offline icon sheets extract glyphs by regex and cannot
  // evaluate a .map(), so this one silently rendered blank in every preview.
  bone: (u) => (<>
    <g transform="rotate(-28 12 9)">
      <rect x="8" y="6" width="9" height="3" rx="1.5" fill={STEEL_HI} stroke={DARK} strokeWidth="0.9" />
      <circle cx="8" cy="7.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
      <circle cx="17" cy="7.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    </g>
    <g transform="rotate(14 22 7)">
      <rect x="18" y="4" width="9" height="3" rx="1.5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
      <circle cx="18" cy="5.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
      <circle cx="27" cy="5.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    </g>
    <g transform="rotate(38 10 21)">
      <rect x="6" y="18" width="9" height="3" rx="1.5" fill={STEEL_HI} stroke={DARK} strokeWidth="0.9" />
      <circle cx="6" cy="19.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
      <circle cx="15" cy="19.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    </g>
    <g transform="rotate(-12 24 20)">
      <rect x="20" y="17" width="9" height="3" rx="1.5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
      <circle cx="20" cy="18.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
      <circle cx="29" cy="18.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    </g>
    <g transform="rotate(62 17 27)">
      <rect x="13" y="24" width="9" height="3" rx="1.5" fill={STEEL_HI} stroke={DARK} strokeWidth="0.9" />
      <circle cx="13" cy="25.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
      <circle cx="22" cy="25.5" r="1.9" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    </g>
  </>),
  // Void pulse: a dark core with an inverted halo — reads as absence, which
  // is what separates it from `orb`.
  // ---- Weapon art, one picture per weapon ---------------------------------
  // Drawn to the weapon's NAME and behaviour, so the card tells you what you
  // are picking before you read it. No .map() in here on purpose: these get
  // rasterised to textures for the Pixi cards through a plain regex extract,
  // and an expression it cannot resolve silently produces an empty glyph.

  // Torrent Cannon — the Hydro Pistol grown into a two-handed water cannon.
  // Same slide-and-grip silhouette, twice the body, twin pressure tanks.
  torrentCannon: (u) => (<>
    <path d="M2 12h17l4-3 8 3v8l-8 3-4-3H8l-3 6H2l2-8z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <rect x="5" y="7" width="12" height="4.5" rx="2.2" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="8" cy="9.2" r="1.1" fill="#ffffff" opacity="0.8" />
    <path d="M23 12v8" stroke={DARK} strokeWidth="1.4" />
    <circle cx="28" cy="16" r="7" fill={`url(#${u}-glow)`} />
    <path d="M30 16c-2-2-2-4 0-6 3 3 3 7 0 10-3-2-3-3 0-4z" fill={`url(#${u}-live)`} opacity="0.9" />
  </>),

  // Soul Reaper — the Blood Scythe with a second blade and a soul on the haft.
  soulReaper: (u) => (<>
    <path d="M30 2c-12 0-21 7-22 18 3-9 11-14 22-14z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M2 12c9-1 15 5 16 14-3-8-9-11-16-11z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" opacity="0.9" />
    <path d="M30 2c-10 0-18 5-21 13" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.55" />
    <path d="M8 20 24 30" stroke={`url(#${u}-body)`} strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="15" cy="17" r="6" fill={`url(#${u}-glow)`} />
    <path d="M15 12.6c2.6 0 4.4 2 4.4 4.6 0 2.2-1.2 3.4-1.2 5l-1.6-1.4-1.6 1.6-1.6-1.6-1.6 1.4c0-1.6-1.2-2.8-1.2-5 0-2.6 1.8-4.6 4.4-4.6z"
          fill="#ffffff" opacity="0.85" />
    <circle cx="13.4" cy="16.6" r="0.9" fill={DARK} />
    <circle cx="16.6" cy="16.6" r="0.9" fill={DARK} />
  </>),

  // Rune Bolts — a single etched bolt, head-first.
  runeBolt: (u) => (<>
    <circle cx="24" cy="8" r="8" fill={`url(#${u}-glow)`} />
    <path d="M30 2 21 11l-3.4-3.4L26.6-1.4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" transform="translate(0 1)" />
    <path d="M27 4.6l-3 3M28.4 7l-2 2" stroke={DARK} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    <path d="M19.6 10.4 6.4 23.6" stroke={`url(#${u}-body)`} strokeWidth="3.2" strokeLinecap="round" />
    <path d="M16.4 13.6l2.4 2.4M13 17l2.4 2.4M9.6 20.4l2.4 2.4" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M6.4 23.6 2 28M6.4 23.6 2.2 22.6M6.4 23.6 7.4 27.8" stroke={STEEL_HI} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="16" cy="14" r="4.6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.3" opacity="0.5" strokeDasharray="2.4 2.6" />
  </>),

  // Storm Array — three bolts loosed at once, arcing between each other.
  stormArray: (u) => (<>
    <path d="M31 2 24 9l-2.8-2.8L28.2-0.8z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" strokeLinejoin="round" transform="translate(0 1.5)" />
    <path d="M22.6 8.6 14 17.2" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M14 17.2 11 18.4M14 17.2l1.2 3" stroke={STEEL_HI} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M31 15.6 25 21.6l-2.4-2.4 6-6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" strokeLinejoin="round" />
    <path d="M23.6 20.6 16 28.2" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M16 28.2 13 29.4M16 28.2l1.2 3" stroke={STEEL_HI} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M18.6 1.4 13 7l-2.4-2.4 5.6-5.6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" strokeLinejoin="round" transform="translate(0 2)" />
    <path d="M11.6 8 4 15.6" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M4 15.6 1 16.8M4 15.6l1.2 3" stroke={STEEL_HI} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13.6 12.6l4.6 1.4-2.6 2.6 4.4 1.6" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.6 12.6l4.6 1.4-2.6 2.6 4.4 1.6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="3.2" opacity="0.35" strokeLinecap="round" strokeLinejoin="round" />
  </>),

  // Ember Orbs — three burning motes on one orbit.
  emberOrbs: (u) => (<>
    <ellipse cx="16" cy="16" rx="13" ry="8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.3" opacity="0.45" />
    <circle cx="16" cy="16" r="11" fill={`url(#${u}-glow)`} opacity="0.55" />
    <circle cx="28" cy="14" r="4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="27" cy="12.6" r="1.3" fill="#fff3d0" />
    <circle cx="8" cy="21" r="3.2" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="13" cy="8" r="2.6" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" opacity="0.9" />
  </>),

  // Inferno Ring — the orbs fused into one closed ring of fire.
  infernoRing: (u) => (<>
    <circle cx="16" cy="16" r="13" fill={`url(#${u}-glow)`} />
    <circle cx="16" cy="16" r="9.5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="4.5" />
    <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff3d0" strokeWidth="1.4" opacity="0.75" />
    <path d="M16 3.5c1.6 2.4 3 3.2 3 5.2a3 3 0 0 1-6 0c0-2 1.4-2.8 3-5.2z" fill="#fff3d0" opacity="0.9" />
    <path d="M6 22.5c1.4 1.8 2.6 2.4 2.6 4a2.6 2.6 0 0 1-5.2 0c0-1.6 1.2-2.2 2.6-4z" fill={`url(#${u}-live)`} />
    <path d="M26 22.5c1.4 1.8 2.6 2.4 2.6 4a2.6 2.6 0 0 1-5.2 0c0-1.6 1.2-2.2 2.6-4z" fill={`url(#${u}-live)`} />
  </>),

  // Frost Orb — one frozen sphere, rimed and spiked.
  frostOrb: (u) => (<>
    <circle cx="16" cy="17" r="12" fill={`url(#${u}-glow)`} opacity="0.7" />
    <circle cx="16" cy="17" r="8" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="12.8" cy="13.8" r="2.4" fill="#ffffff" opacity="0.8" />
    <path d="M16 9V2M16 25v5M8 17H2M24 17h6" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
    <path d="M16 4l-2-2M16 4l2-2M10 11 7 8M22 11l3-3" stroke="#eafaff" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
  </>),

  // Blizzard — the orb come apart into driven snow.
  blizzard: (u) => (<>
    <path d="M2 8c7-3 13 0 12 4M1 16c9-4 17-1 17 4M4 25c7-3 12-1 13 2"
          fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <circle cx="22" cy="14" r="10" fill={`url(#${u}-glow)`} />
    <path d="M22 4v20M13.4 9l17.2 10M30.6 9 13.4 19" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M22 8l-2.6-2.6M22 8l2.6-2.6M22 20l-2.6 2.6M22 20l2.6 2.6" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
    <circle cx="22" cy="14" r="2.6" fill="#eafaff" />
    <circle cx="7" cy="6" r="1.4" fill="#ffffff" opacity="0.8" />
    <circle cx="6" cy="28" r="1.2" fill="#ffffff" opacity="0.65" />
  </>),

  // Annunaki Pulse — a winged disc throwing rings. Named for a relic, so it
  // gets a relic, not another shockwave.
  annunakiDisc: (u) => (<>
    <circle cx="16" cy="16" r="14" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.4" opacity="0.35" />
    <circle cx="16" cy="16" r="10.5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" opacity="0.6" />
    <path d="M2 16c4-4 8-5 11-5M30 16c-4-4-8-5-11-5" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="16" cy="16" r="6" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="16" r="2.4" fill={DARK} />
    <circle cx="16" cy="16" r="9" fill={`url(#${u}-glow)`} opacity="0.6" />
  </>),

  // Void Beam — an emitter and a continuous dark lance with a lit rim.
  voidBeam: (u) => (<>
    <rect x="1" y="11" width="11" height="10" rx="2" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <rect x="3.5" y="14" width="6" height="4" rx="1" fill={`url(#${u}-live)`} />
    <path d="M12 13h19v6H12z" fill="#0a0512" />
    <path d="M12 13h19M12 19h19" stroke={`url(#${u}-live)`} strokeWidth="1.6" />
    <path d="M12 16h19" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
    <circle cx="30" cy="16" r="6" fill={`url(#${u}-glow)`} />
  </>),

  // Sniper Drop — the shot comes from above: reticle, falling round, impact.
  sniperDrop: (u) => (<>
    <circle cx="16" cy="20" r="9" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" opacity="0.8" />
    <path d="M16 9v5M16 26v5M5 20h5M22 20h5" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="16" cy="20" r="2" fill={`url(#${u}-live)`} />
    <path d="M16 1l2.4 4v5h-4.8V5z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M14.6 12h2.8v2.4h-2.8z" fill={STEEL_HI} opacity="0.8" />
    <circle cx="16" cy="20" r="8" fill={`url(#${u}-glow)`} opacity="0.5" />
  </>),

  // Arc Tesla — a coil tower with a terminal sphere and live arcs.
  arcTesla: (u) => (<>
    <path d="M11 30h10l-2-6h-6z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <rect x="12.5" y="13" width="7" height="11" rx="1" fill={STEEL} stroke={DARK} strokeWidth="1.1" />
    <path d="M12.5 15.5h7M12.5 18h7M12.5 20.5h7" stroke={STEEL_HI} strokeWidth="1.2" opacity="0.9" />
    <circle cx="16" cy="9" r="5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="14.2" cy="7.4" r="1.5" fill="#ffffff" opacity="0.8" />
    <path d="M11 6 5 2l3 5-4 1M21 6l6-4-3 5 4 1" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="16" cy="9" r="9" fill={`url(#${u}-glow)`} opacity="0.55" />
  </>),

  // Storm Lance — a thrown spear with lightning running the shaft.
  stormLance: (u) => (<>
    <path d="M29 2 22 11l-3-2.4L26.5.5z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M22 11 5 28" stroke={`url(#${u}-body)`} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M20.5 9.5 3.5 26.5" stroke={STEEL_HI} strokeWidth="1" opacity="0.65" />
    <path d="M20 12l-4 1 3 3-5 2 3 3-4 1" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 11l3 3" stroke={DARK} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="25" cy="6" r="6" fill={`url(#${u}-glow)`} />
  </>),

  // Tidal Harpoon — barbed head, taut line, a curl of water behind it.
  tidalHarpoon: (u) => (<>
    <path d="M30 2 20 12l-2.5-2.5L27.5-.5z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M22 4l-5 1 4 4M26 8l-1 5-4-4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M20 12 8 24" stroke={`url(#${u}-body)`} strokeWidth="3" strokeLinecap="round" />
    <path d="M8 24c-3 0-5 2-5 5" fill="none" stroke={STEEL_HI} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
    <path d="M2 20c4-1 6 2 10 1" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    <path d="M3 26c3-1 5 1 8 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
  </>),

  // Chain Lightning — three struck points and the forks between them.
  chainLightning: (u) => (<>
    <path d="M4 5l5 5-3 2.6 7 3.4-3.6 2.6 8 4-4 2.4 8 3"
          fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 5l5 5-3 2.6 7 3.4-3.6 2.6 8 4-4 2.4 8 3"
          fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.8" strokeLinejoin="round" />
    <circle cx="4" cy="5" r="4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="16" cy="17" r="3.6" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="28" cy="28" r="4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="2.6" cy="3.6" r="1.3" fill="#ffffff" opacity="0.85" />
    <circle cx="26.6" cy="26.6" r="1.3" fill="#ffffff" opacity="0.85" />
  </>),

  // Arc Caster — a held emitter with the arc jumping between two prongs.
  arcCaster: (u) => (<>
    <path d="M4 26l6-8 4 3-6 8z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M10 18l6-7 5 4-6 6z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M21 15 29 5" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M16 11 24 2" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M24 2l1 4-4 1 4 3" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="26" cy="5" r="6.5" fill={`url(#${u}-glow)`} />
  </>),

  // Whirlwind — a vortex with blades caught in it.
  whirlwind: (u) => (<>
    <path d="M3 5h26M5 10h22M8 15h16M11 20h11M13.5 25h6" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M3 5h26" stroke="#ffffff" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
    <path d="M8 15h16" stroke="#ffffff" strokeWidth="0.9" opacity="0.35" strokeLinecap="round" />
    <path d="M14 29c2-1 3-1 5 0" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
    <path d="M24 2.6 30 1l-2.4 5.4z" fill={STEEL_HI} stroke={DARK} strokeWidth="0.9" strokeLinejoin="round" />
    <path d="M8 8.6 2 7l2.4 5.4z" fill={STEEL_HI} stroke={DARK} strokeWidth="0.9" strokeLinejoin="round" />
    <path d="M22 18.6 27 18l-2.4 4.4z" fill={STEEL} stroke={DARK} strokeWidth="0.9" strokeLinejoin="round" />
    <circle cx="16" cy="14" r="12" fill={`url(#${u}-glow)`} opacity="0.35" />
  </>),

  // Dagger Fan — three thrown blades in a spread.
  daggerFan: (u) => (<>
    <path d="M17 2 20 5 9 18 6.5 15.5z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <path d="M6.5 15.5 4 18l4 4 2-2.5z" fill={STEEL} stroke={DARK} strokeWidth="0.9" />
    <path d="M28 6l2.5 2.5L19 20l-2.2-2.2z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" opacity="0.95" />
    <path d="M16.8 17.8 14.5 20l3.6 3.6 2.2-2.2z" fill={STEEL} stroke={DARK} strokeWidth="0.9" />
    <path d="M29 18l2 2-8 8-2-2z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" opacity="0.85" />
    <path d="M14 5l4 4" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
  </>),

  // Blade Storm — the fan gone circular, blades all the way round.
  bladeStorm: (u) => (<>
    <circle cx="16" cy="16" r="11" fill={`url(#${u}-glow)`} opacity="0.5" />
    <path d="M16 1l2.2 6h-4.4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
    <path d="M31 16l-6 2.2v-4.4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
    <path d="M16 31l-2.2-6h4.4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
    <path d="M1 16l6-2.2v4.4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" />
    <path d="M26.6 5.4 22 10.6l-1.6-1.6z" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    <path d="M26.6 26.6 21.4 22l1.6-1.6z" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    <path d="M5.4 26.6 10.6 22l1.6 1.6z" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    <path d="M5.4 5.4 10.6 10l-1.6 1.6z" fill={STEEL_HI} stroke={DARK} strokeWidth="0.8" />
    <circle cx="16" cy="16" r="4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
  </>),

  // Ice Spike — one shard driven up out of the ground.
  iceSpike: (u) => (<>
    <path d="M17 1 24 22l-7 4-7-4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M17 1 17 26" stroke="#ffffff" strokeWidth="1.4" opacity="0.7" />
    <path d="M17 1 10 22l7 4" fill="#0d2233" opacity="0.35" />
    <path d="M6 27c4-2 18-2 22 0" fill="none" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M8 22 4 26M26 21l4 4" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    <circle cx="17" cy="14" r="9" fill={`url(#${u}-glow)`} opacity="0.5" />
  </>),

  // Static Field — a flat disc of charge lying on the ground.
  staticField: (u) => (<>
    <ellipse cx="16" cy="21" rx="15" ry="8" fill={`url(#${u}-glow)`} />
    <ellipse cx="16" cy="21" rx="14" ry="7" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" />
    <ellipse cx="16" cy="21" rx="8" ry="3.8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" opacity="0.8" />
    <path d="M14 2l-5 11h5l-3 9 9-12h-5l4-8z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M4 19l3-4M28 19l-3-4M9 25l2-3M23 25l-2-3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
  </>),

  // Shrapnel Mine — a spiked casing with a live trigger light.
  shrapnelMine: (u) => (<>
    <path d="M16 1v5M16 26v5M1 16h5M26 16h5M5.4 5.4l3.6 3.6M23 23l3.6 3.6M26.6 5.4 23 9M9 23l-3.6 3.6" stroke={`url(#${u}-body)`} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="16" cy="16" r="9" fill={STEEL} stroke={DARK} strokeWidth="1.3" />
    <path d="M9 13a9 9 0 0 1 8-4" fill="none" stroke={STEEL_HI} strokeWidth="1.6" opacity="0.85" />
    <circle cx="16" cy="16" r="3.4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="16" cy="16" r="7" fill={`url(#${u}-glow)`} opacity="0.6" />
  </>),

  // Railgun Array — paired rails with a slug already between them.
  railgunArray: (u) => (<>
    <rect x="1" y="7.5" width="25" height="4" rx="1.2" fill={STEEL_HI} stroke={DARK} strokeWidth="1" />
    <rect x="1" y="20.5" width="25" height="4" rx="1.2" fill={STEEL_HI} stroke={DARK} strokeWidth="1" />
    <rect x="1" y="11.5" width="6.5" height="9" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" />
    <path d="M9 11.5 11 16l-2 4.5M13 11.5 15 16l-2 4.5M17 11.5 19 16l-2 4.5"
          fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 11.5 11 16l-2 4.5" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.8" strokeLinejoin="round" />
    <path d="M21 12.4 29 16l-8 3.6 2-3.6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" strokeLinejoin="round" />
    <path d="M26 10.6 31 8M26 21.4 31 24" stroke={`url(#${u}-live)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <circle cx="29" cy="16" r="6.5" fill={`url(#${u}-glow)`} />
  </>),

  // Twin Revolvers — two of them, crossed.
  twinRevolvers: (u) => (<>
    <path d="M2 8h11v3.6H8l-3 6H2.4l2.2-6H2z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <rect x="12.6" y="7.2" width="4.4" height="5.2" rx="1" fill={STEEL} stroke={DARK} strokeWidth="1" />
    <path d="M17 8.6h10v2.6H17z" fill={STEEL_HI} stroke={DARK} strokeWidth="1" />
    <circle cx="29" cy="9.9" r="3.6" fill={`url(#${u}-glow)`} />
    <path d="M30 24H19v-3.6h5l3-6h2.6l-2.2 6H30z" fill={STEEL} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <rect x="15" y="19.6" width="4.4" height="5.2" rx="1" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1" />
    <path d="M5 20.8h10v2.6H5z" fill={STEEL_HI} stroke={DARK} strokeWidth="1" />
    <circle cx="3" cy="22.1" r="3.6" fill={`url(#${u}-glow)`} />
  </>),

  // Void Scattergun — a stubby shotgun throwing a cone of dark pellets.
  voidScatter: (u) => (<>
    <path d="M2 15h14v5H8l-3 6H2l2-6H1z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <rect x="14" y="14" width="6" height="7" rx="1.4" fill={STEEL} stroke={DARK} strokeWidth="1" />
    <path d="M20 17.5 31 8v19z" fill={`url(#${u}-glow)`} opacity="0.7" />
    <circle cx="26" cy="12" r="2.2" fill={`url(#${u}-live)`} />
    <circle cx="29" cy="17.5" r="1.8" fill={`url(#${u}-live)`} />
    <circle cx="25" cy="22" r="2" fill={`url(#${u}-live)`} opacity="0.9" />
    <circle cx="30" cy="24" r="1.3" fill={`url(#${u}-live)`} opacity="0.7" />
  </>),

  // Comet Launcher — a shouldered tube with the comet already away.
  cometLauncher: (u) => (<>
    <path d="M1 20h14l2-3 3 2-2 4H6l-2 4H1l2-4z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <rect x="4" y="21.4" width="9" height="1.6" fill={DARK} opacity="0.8" />
    <circle cx="24" cy="9" r="10" fill={`url(#${u}-glow)`} />
    <circle cx="24" cy="9" r="5" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="22.4" cy="7.4" r="1.4" fill="#ffffff" opacity="0.8" />
    <path d="M19 14 12 21M21 16l-5 5" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
  </>),
  // Cosmic Devastation: a world taking a swarm, not a single rock. Kept
  // separate from `meteor` (one falling stone, used by Meteor Strike) so the
  // two never draw the same picture.
  cosmicRain: (u) => (<>
    <circle cx="17" cy="18" r="14" fill={`url(#${u}-glow)`} opacity="0.75" />
    <circle cx="17" cy="18" r="9.5" fill="#1b1420" stroke={DARK} strokeWidth="1.1" />
    <path d="M8.4 21.6A9.5 9.5 0 0 1 17 8.5a9.5 9.5 0 0 0-3.4 18.4 9.5 9.5 0 0 1-5.2-5.3z" fill={STEEL} opacity="0.4" />
    <path d="M26.5 18a9.5 9.5 0 0 1-6.6 9 9.5 9.5 0 0 0 4.8-13.6 9.5 9.5 0 0 1 1.8 4.6z" fill={`url(#${u}-live)`} opacity="0.45" />
    <circle cx="20.4" cy="14.4" r="2.8" fill={`url(#${u}-live)`} />
    <circle cx="20.4" cy="14.4" r="1.3" fill="#fff3d0" />
    <circle cx="12.6" cy="21.4" r="1.5" fill={DARK} opacity="0.75" />
    <circle cx="16" cy="25" r="1" fill={DARK} opacity="0.6" />
    <circle cx="13.4" cy="14" r="0.9" fill={DARK} opacity="0.5" />
    <path d="M1 3 7.5 9.5" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
    <path d="M3.5 2.4 8 6.9" stroke="#fff3d0" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
    <circle cx="8.6" cy="10.6" r="2" fill={`url(#${u}-live)`} />
    <circle cx="8.2" cy="10.2" r="0.9" fill="#ffffff" />
    <path d="M26 1.5 29.5 5" stroke={`url(#${u}-live)`} strokeWidth="1.7" strokeLinecap="round" opacity="0.5" />
    <circle cx="30.2" cy="5.8" r="1.4" fill={`url(#${u}-live)`} />
    <path d="M2 26 5 29" stroke={`url(#${u}-live)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    <circle cx="5.8" cy="29.8" r="1.1" fill={`url(#${u}-live)`} />
    <circle cx="29" cy="27" r="0.9" fill="#ffffff" opacity="0.6" />
    <circle cx="24" cy="30" r="0.7" fill="#ffffff" opacity="0.45" />
  </>),
  // ---- Passive cards that were drawing the fallback pistol -----------------
  // Each is drawn to what the card DOES, not just to its name — the effect is
  // what you are choosing between at three cards under time pressure.

  // Frostbite: chilled foes take more. A cracked ice plate with the crack lit.
  pFrostbite: (u) => (<>
    <path d="M16 3 27 10v13l-11 7-11-7V10z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M16 3 27 10v13l-11 7z" fill={DARK} opacity="0.28" />
    <path d="M16 3v27M5 10l22 13M27 10 5 23" stroke="#ffffff" strokeWidth="1.5" opacity="0.85" />
    <path d="M11 8l3 4-4 2" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
    <circle cx="16" cy="16" r="3" fill="#ffffff" opacity="0.9" />
  </>),
  // Live Wire: manual weapons chain. A bare cable arcing to a second contact.
  pLiveWire: (u) => (<>
    <path d="M2 22c5 2 8-1 9-5s4-7 9-6" fill="none" stroke={STEEL} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M2 22c5 2 8-1 9-5" fill="none" stroke={STEEL_HI} strokeWidth="1.1" opacity="0.7" strokeLinecap="round" />
    <path d="M20 11l4 3-3 2 5 3-4 2" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 11l4 3-3 2 5 3" fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" strokeLinejoin="round" />
    <circle cx="27" cy="22" r="3" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" />
    <circle cx="2" cy="22" r="2.4" fill={STEEL_HI} stroke={DARK} strokeWidth="1" />
  </>),
  // Twin Ascend: one upgrade lifts two weapons. Two chevrons rising together.
  pTwinAscend: (u) => (<>
    <path d="M10 26 4 20l6-6 6 6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M22 26l-6-6 6-6 6 6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" opacity="0.85" />
    <path d="M10 16 4 10l6-6 6 6z" fill={STEEL_HI} stroke={DARK} strokeWidth="1" strokeLinejoin="round" opacity="0.8" />
    <path d="M22 16l-6-6 6-6 6 6z" fill={STEEL_HI} stroke={DARK} strokeWidth="1" strokeLinejoin="round" opacity="0.65" />
  </>),
  // Overload Core: every 10th kill detonates. A reactor at critical.
  pOverloadCore: (u) => (<>
    <circle cx="16" cy="16" r="13" fill={`url(#${u}-glow)`} />
    <circle cx="16" cy="16" r="9" fill="none" stroke={STEEL} strokeWidth="2.6" strokeDasharray="4 3" />
    <circle cx="16" cy="16" r="5.6" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" />
    <circle cx="16" cy="16" r="2.4" fill="#ffffff" />
    <path d="M16 1v5M16 26v5M1 16h5M26 16h5" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M6.5 6.5 10 10M25.5 25.5 22 22M25.5 6.5 22 10M6.5 25.5 10 22" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
  </>),
  // Executioner: foes under 15% die outright. A headsman's axe over a mark.
  pExecutioner: (u) => (<>
    <path d="M6 5c7-2 12 1 13 7-5-3-9-3-13 1z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M6 5c6-1.6 10.4 0.6 12 5.6" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
    <path d="M16 9 12 27" stroke={`url(#${u}-body)`} strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="23" cy="21" r="6" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.6" opacity="0.7" />
    <path d="M20 18l6 6M26 18l-6 6" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" />
  </>),
  // Soul Harvest: kills restore HP. A wisp drawn into a heart.
  pSoulHarvest: (u) => (<>
    <path d="M16 29S5 21.5 5 13.5A5.5 5.5 0 0 1 16 11a5.5 5.5 0 0 1 11 2.5C27 21.5 16 29 16 29z"
          fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M10.4 12.4a3 3 0 0 1 4.2-1.2" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.75" strokeLinecap="round" />
    <path d="M24 6c0 2-1.6 3-1.6 4.4a1.6 1.6 0 0 0 3.2 0C25.6 9 24 8 24 6z" fill="#ffffff" opacity="0.85" />
    <circle cx="8" cy="6" r="1.6" fill="#ffffff" opacity="0.7" />
    <circle cx="28" cy="15" r="1.2" fill="#ffffff" opacity="0.55" />
  </>),
  // Quickstep: speed after a hit. A boot with motion lines.
  pQuickstep: (u) => (<>
    <path d="M12 5h5v13l7 4v5H12z" fill={`url(#${u}-body)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M12 24h12v3H12z" fill={DARK} opacity="0.8" />
    <path d="M13 7h3v9h-3z" fill={STEEL_HI} opacity="0.6" />
    <path d="M2 9h7M1 15h8M3 21h6" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M2 9h7" stroke="#ffffff" strokeWidth="0.9" opacity="0.7" strokeLinecap="round" />
  </>),
  // Berserker: below 30% HP, faster. A cracked heart with a rage flare.
  pBerserker: (u) => (<>
    <path d="M16 29S5 21.5 5 13.5A5.5 5.5 0 0 1 16 11a5.5 5.5 0 0 1 11 2.5C27 21.5 16 29 16 29z"
          fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M17 11 13 18h4l-3 8 7-9h-4z" fill="#ffffff" opacity="0.9" />
    <path d="M6 4l3 3M26 4l-3 3M2 12l3 1M30 12l-3 1" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
  </>),
  // Tidal Wave: a periodic wave knocks foes back. A breaking crest.
  pTidalWave: (u) => (<>
    <path d="M1 24c6 0 6-12 14-12 6 0 7 5 12 5v11H1z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M1 24c6 0 6-12 14-12 6 0 7 5 12 5" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.8" />
    <path d="M15 12c3-3 8-3 10 0-3-1-6-1-10 0z" fill="#ffffff" opacity="0.75" />
    <circle cx="26" cy="9" r="1.6" fill="#ffffff" opacity="0.8" />
    <circle cx="21" cy="7" r="1.1" fill="#ffffff" opacity="0.6" />
  </>),
  // Static Chain: kills chain to two more. Three nodes, two arcs.
  pStaticChain: (u) => (<>
    <path d="M5 7l5 6-3 1 6 5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 20l6 2-3 3 6 3" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="5" cy="7" r="3.4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="15" cy="19" r="2.8" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="26" cy="27" r="3.4" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" />
    <circle cx="4" cy="6" r="1.1" fill="#ffffff" opacity="0.85" />
  </>),
  // Gravity Charge: pulls foes in. Arrows converging on a well.
  pGravityPull: (u) => (<>
    <circle cx="16" cy="16" r="12" fill={`url(#${u}-glow)`} opacity="0.7" />
    <circle cx="16" cy="16" r="4.6" fill="#05030a" stroke={`url(#${u}-live)`} strokeWidth="1.8" />
    <path d="M16 1v6l-2.4-2.4M16 7l2.4-2.4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 31v-6l-2.4 2.4M16 25l2.4 2.4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 16h6l-2.4-2.4M7 16l-2.4 2.4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M31 16h-6l2.4-2.4M25 16l2.4 2.4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  // Venom Bite: touching you poisons. A fang with a drip.
  pVenomBite: (u) => (<>
    <path d="M9 3c3 6 4 11 4 15a4 4 0 0 1-8 0c0-4 1-9 4-15z" fill={STEEL_HI} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M23 3c3 6 4 11 4 15a4 4 0 0 1-8 0c0-4 1-9 4-15z" fill={STEEL_HI} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M9 5c2 5 2.6 9 2.6 12" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
    <path d="M9 23c0 2.4-1.6 3.6-1.6 5.2a1.8 1.8 0 0 0 3.6 0C11 26.6 9 25.4 9 23z" fill={`url(#${u}-live)`} />
    <circle cx="23" cy="25" r="2.2" fill={`url(#${u}-live)`} />
    <circle cx="16" cy="29" r="1.4" fill={`url(#${u}-live)`} opacity="0.75" />
  </>),
  // Prism Core: shots split on first hit. A prism fanning one beam into two.
  pPrismCore: (u) => (<>
    <path d="M14 4 25 24H3z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.2" strokeLinejoin="round" opacity="0.85" />
    <path d="M14 4 25 24H14z" fill={DARK} opacity="0.25" />
    <path d="M1 14h11" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M17 15 31 9M17 17l14 6" stroke={`url(#${u}-live)`} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M17 15 31 9" stroke="#ffffff" strokeWidth="0.9" opacity="0.7" strokeLinecap="round" />
  </>),
  // Tempo Engine: stacking fire rate. A gauge climbing past its stops.
  pTempoEngine: (u) => (<>
    <path d="M3 24a13 13 0 0 1 26 0" fill="none" stroke={STEEL} strokeWidth="3.2" strokeLinecap="round" />
    <path d="M3 24a13 13 0 0 1 18-12.4" fill="none" stroke={`url(#${u}-live)`} strokeWidth="3.2" strokeLinecap="round" />
    <path d="M16 24 25 13" stroke={`url(#${u}-live)`} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="16" cy="24" r="2.8" fill={STEEL_HI} stroke={DARK} strokeWidth="1.1" />
    <path d="M6 20l2 1M9 14l2 1.4M16 11v2.4M23 14l-2 1.4" stroke={STEEL_HI} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
  </>),
  // Singularity Rounds: kills collapse into a vortex. An in-spiral.
  pSingularity: (u) => (<>
    <circle cx="16" cy="16" r="13" fill={`url(#${u}-glow)`} opacity="0.6" />
    <path d="M16 2c8 0 13 5 13 11 0 5-4 8-8 8-3.4 0-6-2-6-5 0-2.4 1.8-4 4-4 1.8 0 3 1.2 3 2.6"
          fill="none" stroke={`url(#${u}-live)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M16 30c-8 0-13-5-13-11 0-5 4-8 8-8" fill="none" stroke={`url(#${u}-live)`} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <circle cx="19" cy="16" r="2.6" fill="#05030a" stroke={`url(#${u}-live)`} strokeWidth="1.4" />
  </>),
  // Echo Chamber: every 5th shot fires twice. A round with its ghost behind.
  pEchoChamber: (u) => (<>
    <path d="M22 12.6 30 16l-8 3.4 1.6-3.4z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M13 13.4 19.4 16 13 18.6l1.3-2.6z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
    <path d="M5 14.2 10 16l-5 1.8 1-1.8z" fill={`url(#${u}-live)`} stroke={DARK} strokeWidth="0.9" strokeLinejoin="round" opacity="0.3" />
    <path d="M3 8c3 4 3 12 0 16" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
    <path d="M7 10c2 3 2 9 0 12" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
  </>),
  voidpulse: (u) => (<>
    <circle cx="16" cy="16" r="12" fill={`url(#${u}-glow)`} />
    <circle cx="16" cy="16" r="9.5" fill="none" stroke={`url(#${u}-live)`} strokeWidth="1.5" opacity="0.75" />
    <circle cx="16" cy="16" r="6.5" fill="#05030a" stroke={`url(#${u}-live)`} strokeWidth="1.8" />
    <circle cx="13.4" cy="13" r="1.5" fill={`url(#${u}-live)`} opacity="0.85" />
  </>),
});

// ---- Public map ------------------------------------------------------------
// Weapon/skill/prize id -> glyph + its own accent colour. Anything unmapped
// falls back to the pistol so nothing renders blank.
//
// EVERY weapon id in game/data.js is listed here — verified by
// test/icons.test.mjs, which fails if the two ever drift apart. That test
// exists because the previous gap was invisible: an unmapped weapon doesn't
// error, it just quietly draws a handgun.
//
// Evolved weapons deliberately keep their base silhouette and shift colour:
// an evolution IS the same weapon, and giving it an unrelated shape would
// break the one visual thread telling you what it grew from.
export const ICONS = {

  // ---- Passive cards that were rendering the fallback pistol -------------
  // Twenty-one flags in ADVANCED_CARDS had no entry here, so GameIcon fell
  // through to `pistol`. Five already had art drawn and were simply never
  // wired; the rest are new. wiring.test.mjs now fails if this gap reopens.
  bulletstorm:        ['pBulletstorm', '#ffb347'],
  thorns:             ['pThorns', '#7ad96b'],
  deathMark:          ['pDeathMark', '#ff5c7a'],
  secondWind:         ['pSecondWind', '#8fe6ff'],
  coreOverload:       ['pCoreOverload', '#ffd166'],
  frostbite:          ['pFrostbite', '#9fe8ff'],
  liveWire:           ['pLiveWire', '#ffe066'],
  twinAscend:         ['pTwinAscend', '#b8a6ff'],
  overloadCore:       ['pOverloadCore', '#ff9a3c'],
  executioner:        ['pExecutioner', '#ff6b6b'],
  soulHarvest:        ['pSoulHarvest', '#ff7aa8'],
  quickstep:          ['pQuickstep', '#7dffd0'],
  berserkerMode:      ['pBerserker', '#ff4d4d'],
  tidalWave:          ['pTidalWave', '#4fc3ff'],
  staticChainKill:    ['pStaticChain', '#ffe066'],
  gravityPull:        ['pGravityPull', '#b362ff'],
  venomBite:          ['pVenomBite', '#8bd94f'],
  prismCore:          ['pPrismCore', '#ff9ff3'],
  tempoEngine:        ['pTempoEngine', '#ffc857'],
  singularityRounds:  ['pSingularity', '#9a7cff'],
  echoChamber:        ['pEchoChamber', '#7de8ff'],
  // ---- Card category badges -----------------------------------------------
  // Tone is deliberately NOT the rarity colour: the badge answers "what kind
  // of thing", and the frame already answers "how rare". Two signals in one
  // colour is one signal.
  cat_manual:    ['catManual',    '#e2e8f0'],
  cat_auto:      ['catAuto',      '#8fe6ff'],
  cat_passive:   ['catPassive',   '#7ad96b'],
  cat_stat:      ['catStatBoost', '#4dc4ff'],
  cat_autoskill: ['catAutoSkill', '#ffd166'],

  // ---- Passive cards ------------------------------------------------------
  // Keyed by the card's `flag`, which is what LevelUpModal looks up. Sixty of
  // these shipped as emoji; these are the first thirty drawn. Tones come from
  // what the effect IS — fire warm, frost cold, blood red — so a deck of them
  // reads as a set rather than as thirty unrelated pictures.
  lightningOnCrit: ['pLightning', '#fff44d'],
  damageAura:      ['pAura',      '#ff7a1a'],
  vampire:         ['pVamp',      '#ff3146'],
  chainOnKill:     ['pChain',     '#8fe6ff'],
  slowField:       ['pSlow',      '#8fd8ff'],
  burnDoT:         ['pBurn',      '#ff8c2b'],
  poisonOnKill:    ['pPoison',    '#7ad96b'],
  glassCannon:     ['pGlass',     '#ff5a5a'],
  reflect:         ['pReflect',   '#b9f0ff'],
  explosiveDeath:  ['pExplode',   '#ff9033'],
  lifeline:        ['pLifeline',  '#4dff91'],
  mirrorAura:      ['pMirror',    '#b362ff'],
  knockbackWave:   ['pKnock',     '#a8d8ff'],
  starBurst:       ['pStarBurst', '#ffd166'],
  doubleHit:       ['pDoubleHit', '#ff5a5a'],
  grit:            ['pGrit',      '#b9a48a'],
  vision:          ['pVision',    '#8fe6ff'],
  sharpSteel:      ['pSharp',     '#e2e8f0'],
  bloodrush:       ['pRush',      '#ff3146'],
  ironPull:        ['pMagnet',    '#ff6b6b'],
  thunderCult:     ['pLightning', '#b362ff'],
  iceShards:       ['pIce',       '#8fe6ff'],
  holyWater:       ['pHoly',      '#ffe9a8'],
  spikePlates:     ['pSpikes',    '#c8ccd4'],
  overcharge:      ['pOvercharge','#fff44d'],
  railStance:      ['pRail',      '#4dc4ff'],
  juggernaut:      ['pJugg',      '#ffb066'],
  electricRounds:  ['pElectric',  '#fff44d'],
  meleeSpeed:      ['pWhirl',     '#4dffd4'],
  manualCooldown:  ['pWrench',    '#c8ccd4'],
  ricochet:        ['pRicochet',  '#ffd166'],

  // ---- Currencies ---------------------------------------------------------
  // Tones are taken from the game's OWN palette (dark navy ground, mint/teal
  // accents, thin warm gold) rather than from the ornate reference sheets —
  // the frame is what those sheets are for. Every currency reads as a
  // different MATERIAL as well as a different colour: struck gold, cut
  // gemstone, casino clay, leaf, raw crystal, card stock, iron, fired enamel.
  // Colour alone fails the moment two of them sit side by side on a chip.
  cur_gold:   ['curGold',   '#ffd166'],
  cur_gems:   ['curGems',   '#4dffd4'],
  cur_slot:   ['curSlot',   '#ffcc00'],
  cur_tp:     ['curTalent', '#7ad96b'],
  cur_sp:     ['curSkill',  '#8fe6ff'],
  cur_token:  ['curToken',  '#ff9933'],
  cur_key:    ['curKey',    '#e0c98a'],
  cur_pieces: ['curPiece',  '#b362ff'],
  cur_shards: ['curShard',  '#ff7a1a'],

  // -- base weapons (all 38 ids from game/data.js) --
  // ---- Stat / passive level-up cards --------------------------------------
  // Weapon cards drew hand-built glyphs while stat and passive cards fell back
  // to the emoji on their data entry, so half the deck rendered differently on
  // every device — exactly what the weapon icon pass existed to stop. Keyed by
  // the card's `stat`, so a card only needs an entry here to stop being emoji.
  //
  // Only confident matches are listed. A forced mapping (a boot for "dodge")
  // is worse than an emoji, because it reads as the wrong thing rather than as
  // a placeholder. The rest are called out in the summary as still needing art.
  damageMult:     ['blade',     '#ff5a5a'],
  fireRateMult:   ['bolt',      '#ffd166'],
  moveMult:       ['boot',      '#4dff91'],
  maxHp:          ['heart',     '#ff3146'],
  heal:           ['heart',     '#4dff91'],
  armor:          ['shield',    '#9fb4c8'],
  crit:           ['star',      '#ffd166'],
  critDmgMult:    ['star',      '#ff7a1a'],
  areaMult:       ['shockwave', '#b362ff'],
  projBonus:      ['scatter',   '#7cd6ff'],
  pickupMult:     ['gem',       '#4dffd4'],
  xpMult:         ['rune',      '#b362ff'],
  goldMult:       ['coin',      '#ffd166'],
  pierceBonus:    ['harpoon',   '#dfe8ff'],
  projSpeedMult:  ['comet',     '#7cd6ff'],
  projRangeMult:  ['railgun',   '#ffd166'],
  luck:           ['token',     '#4dff91'],
  regen:          ['regen',     '#4dff91'],
  dodge:          ['dodge',     '#dfe8ff'],
  reloadMult:     ['reload',    '#7cd6ff'],
  magBonus:       ['mag',       '#ffd166'],
  skillCdMult:    ['skillcd',   '#b362ff'],

  // Two more the sweep caught with no entry at all — both rendered as pistols.
  iceLance:       ['frost',     '#9fe0ff'],
  meteorRain:     ['cosmicRain',    '#ff7a1a'],
  katana:         ['katana',    '#dff4ff'],
  hydropistol:    ['pistol',    '#6cb4ff'],
  // The four blueprint starters. They had no ICONS entry at all, so every one
  // of them fell through to the pistol glyph — the Weaponsmith's blueprint
  // shelf showed four different weapons as four identical handguns, which is
  // exactly the problem the 38-weapon icon pass was meant to end. Found by the
  // dead-config sweep, not by looking.
  twinSMG:        ['revolvers', '#4dffd4'],
  tidalShotgun:   ['scatter',   '#ff7a1a'],
  runicRifle:     ['railgun',   '#ffd166'],
  plasmaLance:    ['caster',    '#b362ff'],
  bloodscythe:    ['scythe',    '#b51d28'],
  runebolts:      ['runeBolt',      '#b362ff'],
  emberOrbs:      ['emberOrbs',       '#ff7a1a'],
  shockwave:      ['annunakiDisc', '#9fe8c8'],
  voidBeam:       ['voidBeam',      '#b362ff'],
  arcTesla:       ['arcTesla',      '#a0e4ff'],
  stormLance:     ['stormLance',   '#fff44d'],
  desertEagle:    ['cannon',    '#ffd166'],
  bow:            ['bow',       '#c8f0a0'],
  tideWhip:       ['whip',      '#4fd8ff'],
  chainlightning: ['chainLightning',    '#ffe44d'],
  whirlwind:      ['whirlwind',     '#9fe8c8'],
  boneshards:     ['bone',      '#e8e0cf'],
  daggers:        ['daggerFan',     '#b9f0ff'],
  flameburst:     ['flame',     '#ff7a1a'],
  icespike:       ['iceSpike',     '#8fe6ff'],
  staticField:    ['staticField',      '#c8f8ff'],
  frostOrb:       ['frostOrb',       '#8fe6ff'],
  voidPulse:      ['voidpulse', '#b362ff'],
  sniperDrop:     ['sniperDrop',      '#4dffd4'],
  acidSprayer:    ['acid',      '#9cff4d'],
  droneSquad:     ['drone',     '#4dc4ff'],
  plasmaTurret:   ['turret',    '#ff5ad6'],
  shrapnelMine:   ['shrapnelMine',      '#ffa64d'],
  solarFlare:     ['flare',     '#ffd166'],
  railgunArray:   ['railgunArray',   '#7cd6ff'],
  tidalHarpoon:   ['tidalHarpoon',   '#4fd8ff'],
  twinRevolvers:  ['twinRevolvers', '#ffd166'],
  voidScatter:    ['voidScatter',   '#b362ff'],
  arcCaster:      ['arcCaster',    '#a0e4ff'],
  cometLauncher:  ['cometLauncher',     '#ff9a5a'],

  // -- evolutions: same silhouette, hotter colour --
  hydropistol_evo: ['torrentCannon', '#b9f0ff'],
  bloodscythe_evo: ['soulReaper', '#ff3146'],
  emberOrbs_evo:   ['infernoRing',    '#ffd166'],
  runebolts_evo:   ['stormArray',   '#e0a6ff'],
  frostOrb_evo:    ['blizzard',    '#ffffff'],
  daggers_evo:     ['bladeStorm',  '#ffffff'],

  // -- legacy aliases kept so older saves / skills that reference these
  //    names keep their art instead of silently falling back to the pistol --
  shotgun:      ['scatter', '#ffd166'],
  autoBolts:    ['bolt',    '#4dffd4'],
  meteorStrike: ['meteor',  '#ff7a1a'],
  annunakiPulse:['annunakiDisc', '#b362ff'],
  swarmAura:    ['swarm',   '#ffe44d'],

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

  // ---- General UI glyphs ---------------------------------------------------
  // Tab labels, toasts, locked-state tags and reward-row icons that were
  // still literal emoji (📦🔒🗺🚀🏛👤🐾🧠🔨🎯📚🔍💀🔩🥚👻🔮🎫💰🗑🔱🌪️),
  // found by the no-emoji sweep. A handful reuse glyphs already built above
  // (flame, star, shield, gem, coin, token, bolt, blade, rune, trophy) rather
  // than redraw the same shape twice.
  ui_lock:      ['lock',      '#ff5a5a'],
  ui_chest:     ['chest',     '#ffb066'],
  ui_scroll:    ['scroll',    '#e0c98a'],
  ui_map:       ['map',       '#7ad9c8'],
  ui_compass:   ['compass',   '#8fe6ff'],
  ui_rocket:    ['rocket',    '#7cd6ff'],
  ui_base:      ['pillars',   '#c8ccd4'],
  ui_character: ['person',    '#8fe6ff'],
  ui_pets:      ['paw',       '#ffb066'],
  ui_skills:    ['brain',     '#b362ff'],
  ui_smith:     ['hammer',    '#ffb066'],
  ui_loadout:   ['reticle',   '#ff9a3c'],
  ui_codex:     ['book',      '#e0c98a'],
  ui_search:    ['magnifier', '#8fe6ff'],
  ui_void:      ['skull',     '#b362ff'],
  ui_part:      ['boltPart',  '#c8ccd4'],
  ui_egg:       ['egg',       '#ffd9a0'],
  ui_hatchling: ['hatchling', '#ffd9a0'],
  ui_ghost:     ['ghost',     '#c8b8ff'],
  ui_orb:       ['orb',       '#b362ff'],
  ui_ticket:    ['ticket',    '#ff9933'],
  ui_moneybag:  ['moneybag',  '#ffd166'],
  ui_trash:     ['trash',     '#ff5a5a'],
  ui_trident:   ['trident',   '#7cd6ff'],
  ui_tornado:   ['tornado',   '#9fe8c8'],
  ui_waterdrop: ['waterdrop', '#4dc4ff'],
  ui_flame:     ['flame',     '#ff7a1a'],
  ui_star:      ['star',      '#ffd166'],
  ui_shield:    ['shield',    '#9fb4c8'],
  ui_blade:     ['blade',     '#ff5a5a'],
  ui_bolt:      ['bolt',      '#fff44d'],
  ui_gem:       ['gem',       '#4dffd4'],
  ui_coin:      ['coin',      '#ffd166'],
  ui_token:     ['token',     '#ffcc00'],
  ui_trophy:    ['trophy',    '#ffd166'],
  ui_daggers:   ['daggerFan', '#b9f0ff'],
  ui_pickaxe:   ['pickaxe',   '#e0c98a'],
  ui_leaf:      ['leaf',      '#7ad96b'],
  ui_medal:     ['medal',     '#ffd166'],
  ui_cog:       ['cog',       '#c8ccd4'],
  ui_chart:     ['chart',     '#8fe6ff'],
  part_barrel:  ['partBarrel', '#c8ccd4'],
  part_magazine:['mag',        '#ffd166'],
  part_sight:   ['reticle',    '#8fe6ff'],
  part_muzzle:  ['partMuzzle', '#ff9a3c'],
  part_stock:   ['partStock',  '#e0c98a'],
  part_bullets: ['partBullet', '#ff7a1a'],
  part_grip:    ['partGrip',   '#b9a48a'],
  ui_clock:     ['clock',      '#8fe6ff'],
  ui_infinity:  ['infinity',   '#b362ff'],
  ui_eye:       ['eye',        '#b362ff'],
  ui_calendar:  ['calendar',   '#7ad9c8'],
  ui_cards:     ['cards',      '#ff9a3c'],
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
