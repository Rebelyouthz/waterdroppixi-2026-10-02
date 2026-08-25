import React, { useEffect, useRef, useState, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RARITY, WEAPONS } from '../game/data';
import GameIcon, { ICONS } from './GameIcon';
import { Audio } from '../game/audio';
import { CardRenderer, CARD, PICK_SEQ_MS } from '../game/cardRenderer';

// The level-up cards are drawn in PixiJS, not CSS.
//
// The frames need a rarity MATERIAL that runs the whole border and breaks past
// it in both directions — vines, ice, engraved metal, flame, cracked stone.
// That is dozens of independently placed, independently animated shapes. In
// CSS it was dozens of elements contending for one ::before and one ::after,
// with a clip-path that box-shadow cannot follow and a border-radius children
// only honour if they inherit it; three separate bugs came out of that stack
// and the frames never landed. In Pixi it is a path and a loop. See
// game/cardArt.js for the frame painters and game/cardRenderer.js for the
// two-layer render.
//
// This component keeps the exact props it always had — { choices, onPick,
// playerLevel } — so GameScreen did not change.

// The reference sheet puts a category line under the name — "AUTO WEAPON",
// "MANUAL WEAPON", "PASSIVE SKILL" — which does more work than a pill badge:
// it tells you what KIND of thing you are picking before you read a single
// stat. Derived from the weapon definition, so it cannot disagree with what
// the card actually does.
const TYPE_LINE = {
  'weapon-new': 'AUTO WEAPON',
  'weapon-upgrade': 'WEAPON UPGRADE',
  'weapon-fork': 'EVOLUTION PATH',
  flag: 'PASSIVE SKILL',
  stat: 'STAT BOOST',
};

export function cardCategory(c, weapons) {
  if (c.kind === 'flag') return { icon: 'cat_passive', label: 'PASSIVE SKILL' };
  if (c.kind === 'stat') return { icon: 'cat_stat', label: 'STAT BOOST' };
  const w = c.weaponId && weapons ? weapons[c.weaponId] : null;
  if (w && w.type === 'manual') return { icon: 'cat_manual', label: 'MANUAL WEAPON' };
  if (w) return { icon: 'cat_auto', label: 'AUTO WEAPON' };
  if (c.kind === 'weapon-fork') return { icon: 'cat_autoskill', label: 'EVOLUTION PATH' };
  return { icon: 'cat_auto', label: TYPE_LINE[c.kind] || 'BOON' };
}

// Weapon cards key on the weapon id; stat and passive cards key on the stat
// they change. Falls back to the category badge only when neither resolves, so
// a card without art is still a card rather than a hole.
function artKey(c) {
  return (c.weaponId && ICONS[c.weaponId] && c.weaponId)
    || (c.statRef && ICONS[c.statRef.stat] && c.statRef.stat)
    || (c.statId && ICONS[c.statId] && c.statId)
    || (c.flagId && ICONS[c.flagId] && c.flagId)
    || null;
}

const hex = (s) => {
  const n = parseInt(String(s || '').replace('#', ''), 16);
  return Number.isFinite(n) ? n : 0xb8c4d4;
};

// Pixi needs a texture, and the art is 150 hand-built React SVG glyphs. Rather
// than fork the icon set into a second format, each glyph is rendered to
// static markup once per card and rasterised through a data URI. It keeps ONE
// source of truth for the art — the same GameIcon the Weaponsmith and the
// gear panels draw from.
//
// NO `tone`. That is the point. The card's rarity owns the frame, the glow and
// the name colour; the picture owns its own. Passing the rarity colour down
// here repainted every glyph to match its frame, so Frost Orb was purple on an
// epic card and blue on a rare one — the same weapon in two colours, and six
// cards in a row that all looked like one palette each. Every entry in ICONS
// already carries the accent that belongs to that thing, and leaving `tone`
// off is what lets it through.
function glyphSvg(name) {
  if (!name) return null;
  return renderToStaticMarkup(<GameIcon name={name} size={64} />);
}

export default function LevelUpModal({ choices, onPick, playerLevel }) {
  const isFork = choices.length > 0 && choices[0].kind === 'weapon-fork';
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [pickedIdx, setPickedIdx] = useState(null);
  const pickTimer = useRef(null);

  // Built once per set of choices. renderToStaticMarkup on every render would
  // rasterise a dozen SVGs each time React re-runs this component.
  const models = useMemo(() => choices.map((c) => {
    const r = RARITY[c.rarity] || RARITY.common;
    const cat = cardCategory(c, WEAPONS);
    const tone = r.color || '#b8c4d4';
    const evoFrom = c.evoFromId && ICONS[c.evoFromId] ? c.evoFromId : null;
    const evoTo = c.evoToId && ICONS[c.evoToId] ? c.evoToId : null;
    return {
      name: c.name,
      typeLabel: cat.label,
      rarity: c.rarity || 'common',
      rarityName: c.isEvolve ? 'EVOLUTION' : (r.name || c.rarity || 'COMMON'),
      rarityColor: hex(tone),
      desc: c.desc || '',
      lvl: Number.isFinite(c.lvl) ? c.lvl : null,
      maxLvl: c.maxLvl > 0 ? c.maxLvl : 0,
      glyphSvg: glyphSvg(artKey(c) || cat.icon),
      catSvg: glyphSvg(cat.icon),
      // The picture's OWN accent, taken from the ICONS registry. The renderer
      // lights the art well with this instead of the rarity colour, so a
      // weapon sits on the same backdrop whatever rarity it rolled — which is
      // the requirement: any card can be any rarity, so no picture may depend
      // on which frame it happens to be inside today.
      artColor: hex((ICONS[artKey(c) || cat.icon] || [])[1] || '#6cb4ff'),
      // The GLYPH name, not the card id — procedural card scenes are keyed on
      // the same glyph the icon set uses, so a scene and an icon can never
      // disagree about which picture belongs to which card.
      artKey: (ICONS[artKey(c) || cat.icon] || [])[0] || null,
      // The recipe strip. Only the six weapons that actually have an evolved
      // form carry these, because the engine only sets evoFromId/evoToId when
      // WEAPON_EVO_MAP resolves — a card must never show a transform that
      // cannot happen.
      evoFromId: evoFrom, evoToId: evoTo,
      evoFromSvg: glyphSvg(evoFrom),
      evoToSvg: glyphSvg(evoTo),
      evoReady: !!c.evoReady,
    };
  }), [choices]);

  const handlePick = React.useCallback((i) => {
    if (pickedIdx !== null) return;          // ignore double-taps mid-animation
    const c = choices[i];
    if (!c) return;
    setPickedIdx(i);
    if (rendererRef.current) rendererRef.current.setPicked(i);
    // The confirmation has to be louder than the hover — this is a permanent
    // decision for the run and it should sound like one.
    Audio.claimPing?.();
    // RARITY has no rank field; `mult` is the ordering it does have, and 3.6
    // is epic, the point where a card is worth a fanfare.
    if ((RARITY[c.rarity]?.mult || 0) >= 3.6) Audio.rewardFanfare?.();
    // Hands off when the renderer's cleave has actually finished. This used to
    // be a hardcoded 480ms, which was the whole length of the old "lift it 14px"
    // acknowledgement; against the new zoom-hold-cleave it would have torn the
    // modal away mid-flight. Reading the renderer's own constant means one
    // duration lives in one place — the unlock banner already shipped the bug
    // where two files each held half of a timing and drifted apart.
    pickTimer.current = setTimeout(() => onPick(c), PICK_SEQ_MS);
  }, [choices, onPick, pickedIdx]);

  // Keep the latest handler reachable from the Pixi callback without tearing
  // the renderer down and rebuilding it every time the closure changes.
  const pickRef = useRef(handlePick);
  useEffect(() => { pickRef.current = handlePick; }, [handlePick]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    // Three cards at the showcase gap are ~950 logical px. On a phone that
    // scales down until the rule text is unreadable, so the gap shrinks with
    // the viewport instead of the type.
    const narrow = typeof window !== 'undefined' && window.innerWidth < 760;
    const r = new CardRenderer(canvas, { onPick: (i) => pickRef.current(i) });
    rendererRef.current = r;
    r.init(models.length, narrow ? 36 : CARD.GAP)
      .then(() => {
        if (cancelled) return undefined;
        // Publish the canvas's real aspect ratio so CSS can cap its WIDTH using
        // the available HEIGHT — see `.lu-canvas` in overhaul.css.
        //
        // Capping width alone was not enough: the canvas is 880 logical units
        // tall against ~944 wide, so even a 648px width cap still produced a
        // ~604px-tall canvas, and with the title/level/hint chrome above it the
        // modal ran off the bottom of a short window. You then see a cropped
        // middle of the row, which reads as "still zoomed in" even though the
        // width did come down. Timmy: "level upp koirten lika inzoomade".
        //
        // Read from the renderer rather than hard-coded, because the canvas
        // width depends on how many cards this level-up offered (and on the
        // narrow-viewport gap chosen above), so the ratio is not a constant.
        if (r.width && r.height) {
          canvas.style.setProperty('--lu-ar', String(r.width / r.height));
        }
        return r.setCards(models);
      })
      .catch(() => { /* a lost WebGL context must not take the run down */ });
    return () => {
      cancelled = true;
      rendererRef.current = null;
      r.destroy();
    };
  }, [models]);

  useEffect(() => () => { if (pickTimer.current) clearTimeout(pickTimer.current); }, []);

  useEffect(() => {
    // Goes through the shared Audio singleton. This used to construct a NEW
    // AudioContext on every level-up and never close it; browsers cap a page
    // at a handful, so from about the sixth level of a run the constructor
    // threw and every leaked context kept an audio thread alive.
    Audio.levelUp();
  }, []);

  // Number keys pick a card. The modal freezes the sim, so reaching for the
  // mouse mid-fight is the only moment in a run where the hands have to leave
  // the keyboard.
  useEffect(() => {
    const onKey = (e) => {
      const n = parseInt(e.key, 10);
      if (!n || n < 1 || n > choices.length) return;
      e.preventDefault();
      pickRef.current(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices.length]);

  return (
    <div className={`modal-overlay levelup-overlay${isFork ? ' is-fork' : ''}`} data-testid="levelup-modal">
      <div className="levelup levelup-pixi">
        <div className="lvl-burst" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="lvl-ray" style={{ transform: `rotate(${i * 22.5}deg)` }} />
          ))}
        </div>
        <div className="levelup-title" data-testid="levelup-title">{isFork ? 'WEAPON EVOLUTION!' : 'LEVEL UP!'}</div>
        {/* The water that runs out of the letters as they cool. Uneven widths,
            lengths and delays — a tidy row of identical streaks reads as a
            curtain rather than as something draining. Positions are stable per
            render so a run does not flicker between them mid-fall. */}
        <div className="lvl-drip-row" aria-hidden>
          {[8, 17, 26, 34, 43, 51, 58, 66, 74, 83, 91].map((left, i) => (
            <span
              key={i}
              className="lvl-drip"
              style={{
                left: `${left}%`,
                height: `${3.5 + ((i * 37) % 5)}vh`,
                width: `${2 + (i % 3)}px`,
                animationDelay: `${900 + ((i * 137) % 900)}ms`,
                opacity: 0.45 + ((i * 13) % 35) / 100,
              }}
            />
          ))}
        </div>
        <div className="levelup-mega">{isFork ? 'CHOOSE ITS PATH' : `LV ${playerLevel}`}</div>
        <div className="levelup-sub">
          {isFork ? 'CHOOSE ITS PATH — permanent for this run' : 'CHOOSE A CARD'}
        </div>
        <div className="levelup-hint">press <b>1</b>–<b>{choices.length}</b> or tap</div>
        <div className="lu-canvas-wrap">
          <canvas ref={canvasRef} className="lu-canvas" data-testid="levelup-canvas" />
        </div>
        {/* Keyboard and screen-reader path. The canvas carries the picture; the
            cards still have to be reachable without one, and this is also what
            the layout tests assert against. */}
        <div className="lu-a11y">
          {choices.map((c, i) => (
            <button
              key={i}
              type="button"
              data-testid={`card-${i}`}
              onClick={() => pickRef.current(i)}
              disabled={pickedIdx !== null}
            >
              {`${i + 1}. ${c.name} — ${(RARITY[c.rarity] || RARITY.common).name} — ${c.desc}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
