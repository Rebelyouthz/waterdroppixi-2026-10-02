import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import BadgeIcon from './BadgeIcon';
import GameIcon from './GameIcon';
import {
  BADGES, BADGE_CATS, BADGE_TIERS, MAX_EQUIPPED_BADGES,
  equippedBadges, isEarned, setBadgeSlot, toggleBadge,
} from '../game/badges';
import { Audio } from '../game/audio';

// =============================================
// BADGE SLOTS — three notches cut into the profile frame
// =============================================
// Placed against the bottom edge of the profile banner, overlapping it, so the
// three hexes read as *set into* the frame rather than as three more icons
// parked next to the currency row. An empty slot draws the same hexagon
// hollow and dashed: the shape itself says "something goes here", which is
// what makes the system discoverable without a tooltip.
//
// Clicking any slot opens the picker. The picker is the whole catalog —
// earned badges in colour, unearned ones drained with the requirement written
// under them — because a trophy case that hides what you have not won yet
// gives you nothing to aim at.

export function BadgeSlots({ save, onOpen, size = 26 }) {
  const eq = equippedBadges(save);
  return (
    // The event is forwarded because the slots now sit INSIDE the profile
    // identity block, which is itself a click target that opens the profile
    // modal. Without a stopPropagation at the call site, tapping a badge
    // would open the badge picker and the profile sheet at once.
    <div className="badge-slots" data-testid="badge-slots" onClick={(e) => onOpen && onOpen(e)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen && onOpen(e); } }}
      title="Equipped badges — click to change">
      {eq.map((b, i) => (
        <span key={i} className={`badge-slot${b ? ' filled' : ''}`} data-testid={`badge-slot-${i}`}>
          <BadgeIcon badge={b} size={size} />
        </span>
      ))}
    </div>
  );
}

export function BadgePicker({ save, setSave, onClose }) {
  const [cat, setCat] = useState('all');
  const [slot, setSlot] = useState(null); // targeted slot, or null = toggle mode
  const eq = equippedBadges(save);
  const earnedCount = BADGES.filter(b => isEarned(save, b.id)).length;

  const list = BADGES
    .filter(b => cat === 'all' || b.cat === cat)
    // Earned first, then by tier rank descending — the picker should open on
    // what you have, not on a wall of grey.
    .sort((a, bb) => {
      const ea = isEarned(save, a.id) ? 1 : 0, eb = isEarned(save, bb.id) ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return BADGE_TIERS[bb.tier].rank - BADGE_TIERS[a.tier].rank;
    });

  const pick = (b) => {
    if (!isEarned(save, b.id)) return;
    Audio.click?.();
    setSave(slot === null ? toggleBadge(save, b.id) : setBadgeSlot(save, slot, b.id));
    if (slot !== null) setSlot(null);
  };

  const clearSlot = (i) => { Audio.click?.(); setSave(setBadgeSlot(save, i, null)); };

  return createPortal(
    <div className="modal-overlay" data-testid="badge-picker"
      onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel forge-panel-scrollable badge-picker" style={{ maxWidth: 620 }}>
        <div className="forge-header">
          <div className="forge-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GameIcon name="ui_medal" size={16} /> BADGES</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        <div className="badge-picker-sub">
          {earnedCount}/{BADGES.length} earned · {MAX_EQUIPPED_BADGES} can be displayed
        </div>

        {/* The three live slots, big. Clicking one arms it, so the next badge
            you tap goes exactly where you meant rather than into whatever
            happened to be empty. */}
        <div className="badge-equip-row">
          {eq.map((b, i) => (
            <div key={i} className={`badge-equip-slot${slot === i ? ' armed' : ''}${b ? ' filled' : ''}`}
              data-testid={`badge-equip-${i}`}
              onClick={() => setSlot(slot === i ? null : i)}>
              <BadgeIcon badge={b} size={58} />
              <span className="badge-equip-label">{b ? b.name : slot === i ? 'Pick one →' : `Slot ${i + 1}`}</span>
              {b && (
                <button className="badge-equip-clear" data-testid={`badge-clear-${i}`}
                  onClick={(e) => { e.stopPropagation(); clearSlot(i); }}>✕</button>
              )}
            </div>
          ))}
        </div>

        <div className="badge-cat-row">
          <button className={cat === 'all' ? 'active' : ''} onClick={() => setCat('all')}>ALL</button>
          {BADGE_CATS.map(c => (
            <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <GameIcon name={c.icon} size={14} /> {c.name.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="badge-grid">
          {list.map(b => {
            const earned = isEarned(save, b.id);
            const worn = eq.some(x => x && x.id === b.id);
            const tier = BADGE_TIERS[b.tier];
            let pct = 0;
            try { pct = Math.max(0, Math.min(1, b.progress ? b.progress(save) : (earned ? 1 : 0))); } catch { pct = 0; }
            return (
              <div key={b.id}
                className={`badge-card${earned ? '' : ' locked'}${worn ? ' worn' : ''}`}
                data-testid={`badge-card-${b.id}`}
                onClick={() => pick(b)}
                style={{ '--badge-hue': b.hue, '--tier-ring': tier.ring }}>
                <BadgeIcon badge={b} size={52} locked={!earned} />
                <div className="badge-card-name">{b.name}</div>
                <div className="badge-card-tier" style={{ color: tier.ring }}>{tier.name}</div>
                <div className="badge-card-desc">{earned ? b.desc : b.hint}</div>
                {!earned && (
                  <div className="badge-card-bar"><span style={{ width: `${pct * 100}%` }} /></div>
                )}
                {worn && <div className="badge-card-worn">DISPLAYED</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BadgeSlots;
