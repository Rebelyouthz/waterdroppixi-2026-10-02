import React, { useEffect, useRef, useState } from 'react';
import { subscribeToast } from '../game/toastBus';
import GameIcon from './GameIcon';

// Long enough to read a name plus a rarity, short enough that a loot-heavy
// moment does not queue up a backlog. The roll-out/roll-up beats are on top
// of this (see the CSS), so the total on-screen life is ~4.3s.
const LIFE_MS = 3400;

// Rarity → the colour the banner is trimmed and lit with. Toasts carry a
// `tone` that is either a rarity id or a semantic category; both resolve
// here so a loot drop, an achievement and a challenge each read differently
// at a glance without anyone having to read the words.
const TONES = {
  common:    { c: '#9a8fa6', label: 'COMMON' },
  magic:     { c: '#4dc4ff', label: 'MAGIC' },
  uncommon:  { c: '#4dff91', label: 'UNCOMMON' },
  rare:      { c: '#ffd166', label: 'RARE' },
  epic:      { c: '#b362ff', label: 'EPIC' },
  legendary: { c: '#ff7a1a', label: 'LEGENDARY' },
  mythical:  { c: '#ff3146', label: 'MYTHICAL' },
  gold:      { c: '#ffd166' },
  gem:       { c: '#4dffd4' },
  achievement: { c: '#ffd166' },
  challenge: { c: '#ff7a1a' },
  quest:     { c: '#4dc4ff' },
  default:   { c: '#4dffd4' },
};

// A drawn emblem per category, so the banner announces WHAT KIND of thing
// happened before you have read a single word. Kept as inline SVG rather than
// emoji for the same reason GameIcon exists — emoji render differently on
// every platform and carry no colour of their own.
function ToastEmblem({ kind, color }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' };
  if (kind === 'achievement') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M8 3h8v6a4 4 0 01-8 0z" {...common} />
        <path d="M8 4H5v2a3 3 0 003 3M16 4h3v2a3 3 0 01-3 3" {...common} />
        <path d="M10 13h4v3h-4zM8 20h8" {...common} />
      </svg>
    );
  }
  if (kind === 'challenge') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 4l7 7M20 4l-7 7M12 12l-3 8h6z" {...common} />
        <circle cx="12" cy="11" r="2.4" {...common} />
      </svg>
    );
  }
  if (kind === 'quest') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M6 3h12v18l-6-4-6 4z" {...common} />
        <path d="M9 8h6M9 12h4" {...common} />
      </svg>
    );
  }
  // Loot: a gem, filled in the rarity colour so the drop reads as its tier.
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M7 3h10l4 6-9 12L3 9z" fill={color} opacity="0.28" />
      <path d="M7 3h10l4 6-9 12L3 9z" {...common} />
      <path d="M3 9h18M12 21L7 3M12 21l5-18" {...common} strokeWidth="1.1" opacity="0.7" />
    </svg>
  );
}

// Mounted once, at the top of the app (see App.js) — sits above everything,
// including modals, since a reward can happen while a modal is open.
//
// Position and motion were both wrong before: it sat bottom-centre, directly
// across the combo meter and BOTH joysticks — the three things a player is
// actually looking at and touching. It now lives under the score in the
// top-right and behaves like a hanging banner: it slides out from the right
// edge already rolled up, unrolls downward, holds, rolls back up, and
// retracts the way it came.
export default function ToastHost() {
  const [items, setItems] = useState([]);
  const timers = useRef({});

  useEffect(() => {
    return subscribeToast((t) => {
      setItems(cur => [...cur.slice(-3), t]); // at most 4 hanging at once
      timers.current[t.id] = setTimeout(() => {
        setItems(cur => cur.map(x => (x.id === t.id ? { ...x, leaving: true } : x)));
        setTimeout(() => setItems(cur => cur.filter(x => x.id !== t.id)), 620);
      }, LIFE_MS);
    });
  }, []);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  if (!items.length) return null;
  return (
    <div className="toast-host" data-testid="toast-host">
      {items.map(t => {
        const tone = TONES[t.tone] || TONES.default;
        const kind = TONES[t.tone] && TONES[t.tone].label ? 'loot' : (t.tone || 'default');
        const rarityLabel = tone.label || null;
        return (
          <div
            key={t.id}
            className={`toast-banner t-${t.tone}${t.leaving ? ' leaving' : ''}`}
            style={{ '--tc': tone.c }}
            data-testid={`toast-${t.tone}`}
          >
            <div className="toast-cloth">
              <span className="toast-emblem">
                {t.icon && t.icon.length > 2
                  ? <GameIcon name={t.icon} size={22} tone={tone.c} />
                  : <ToastEmblem kind={kind} color={tone.c} />}
              </span>
              <div className="toast-body">
                <div className="toast-title">{t.title}</div>
                {rarityLabel && <div className="toast-rarity">{rarityLabel}</div>}
                {/* Suppressed when it would just repeat the rarity line — loot
                    toasts pass the rarity as their text, so both rendered and
                    the banner said "MAGIC" twice. */}
                {t.text && t.text.toUpperCase() !== (rarityLabel || '') && (
                  <div className="toast-text">{t.text}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
