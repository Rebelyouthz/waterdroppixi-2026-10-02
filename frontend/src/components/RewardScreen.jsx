import React, { useEffect, useState } from 'react';
import BadgeIcon from './BadgeIcon';
import { BADGE_INDEX } from '../game/badges';
import { Audio } from '../game/audio';

// =============================================
// REWARD SCREEN — "here is what happened while you were out"
// =============================================
// Rewards used to land silently: a badge earned on the last kill of a run, a
// quest step that completed inside a modal, a tier that opened as the payout
// screen was closing. Each of those is the single best moment the system has,
// and each of them was a number quietly changing in a corner.
//
// So everything that pays out off-screen banks an entry (store.js's
// bankReward) and this drains the queue on the next camp entry — one card at a
// time, revealed on a stagger, because five things appearing at once is one
// event and five things appearing in sequence is five.

const NAMES = {
  gold: 'Gold', sp: 'SP', gems: 'Gems', slotCoins: 'Slot Coins',
  talentPoints: 'Talent Points', petFood: 'Pet Food', gearParts: 'Gear Parts',
  flux: 'Flux', cores: 'Cores', gachaTokens: 'Gacha Tokens',
};

export default function RewardScreen({ entries, onClose }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!entries || !entries.length) return undefined;
    Audio.rewardFanfare?.();
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i > 1) Audio.claimPing?.();
      if (i >= entries.length) clearInterval(t);
    }, 320);
    setShown(1);
    return () => clearInterval(t);
  }, [entries]);

  if (!entries || !entries.length) return null;
  const all = shown >= entries.length;

  return (
    <div className="modal-overlay reward-overlay" data-testid="reward-screen">
      <div className="reward-panel">
        <div className="reward-head">
          <span className="reward-kicker">WHILE YOU WERE OUT</span>
          <h2>{entries.length === 1 ? 'You earned something' : `${entries.length} things happened`}</h2>
        </div>

        <div className="reward-list">
          {entries.slice(0, shown).map((e, i) => {
            const badge = e.badgeId ? BADGE_INDEX[e.badgeId] : null;
            return (
              <div key={i} className={`reward-card${e.tone === 'legendary' ? ' is-legendary' : ''}`}
                style={{ animationDelay: `${i * 40}ms` }} data-testid="reward-card">
                <div className="reward-card-icon">
                  {badge ? <BadgeIcon badge={badge} size={44} /> : <span className="reward-emoji">{e.icon || '🎁'}</span>}
                </div>
                <div className="reward-card-body">
                  <div className="reward-card-title">{e.title}</div>
                  {e.text && <div className="reward-card-text">{e.text}</div>}
                  {!!(e.items || []).length && (
                    <div className="reward-card-items">
                      {e.items.map((it, j) => (
                        <span key={j} className="reward-item" title={NAMES[it.key] || it.key}>
                          <b>{it.icon}</b> {it.amount.toLocaleString('sv-SE')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button className="reward-continue" onClick={onClose} data-testid="reward-continue"
          disabled={!all} style={{ opacity: all ? 1 : 0.45 }}>
          {all ? 'CONTINUE' : '…'}
        </button>
      </div>
    </div>
  );
}
