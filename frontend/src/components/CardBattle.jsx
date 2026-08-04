import React, { useState } from 'react';
import { CARD_TYPES, buildHand, buildFoe, resolveRound, lootShare } from '../game/cardbattle';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

// A patrol encounter. Three rounds, one card each, best record takes the
// biggest share of the loot. Resolves to a multiplier the caller applies to
// the patrol's reward.
export default function CardBattle({ pet, tier, onDone, onClose }) {
  const [hand, setHand] = useState(() => buildHand(pet, tier));
  const [foe] = useState(() => buildFoe(tier));
  const [round, setRound] = useState(0);
  const [won, setWon] = useState(0);
  const [lostLast, setLostLast] = useState(false);
  const [log, setLog] = useState([]);
  const [reveal, setReveal] = useState(null);   // { mine, theirs, won }

  const play = (card) => {
    if (reveal || round >= foe.length) return;
    const res = resolveRound(card, foe[round].power, { lostLast, petLevel: pet?.level || 0 });
    setReveal(res);
    Audio.click();
    setTimeout(() => {
      const nextWon = won + (res.won ? 1 : 0);
      setWon(nextWon);
      setLostLast(!res.won);
      setLog(l => [...l, { round: round + 1, ...res, type: card.type }]);
      setHand(h => h.filter(c => c.uid !== card.uid));
      setReveal(null);
      if (round + 1 >= foe.length) {
        Audio[nextWon >= 2 ? 'levelUp' : 'hit']?.();
        onDone(lootShare(nextWon), nextWon);
      } else {
        setRound(round + 1);
      }
    }, 950);
  };

  const done = round >= foe.length;

  return (
    <div className="modal-overlay" data-testid="card-battle">
      <div className="cb-panel">
        <div className="cb-head">
          <div className="cb-title">⚔ ENCOUNTER</div>
          <div className="cb-score">
            {[0, 1, 2].map(i => (
              <span key={i} className={`cb-pip${log[i] ? (log[i].won ? ' win' : ' loss') : ''}`} />
            ))}
          </div>
          <button className="prosp-close" onClick={onClose}>✕</button>
        </div>

        <div className="cb-board">
          <div className="cb-side cb-foe">
            <div className="cb-side-label">THEM</div>
            <div className={`cb-card cb-card-foe${reveal ? ' shown' : ''}`}>
              <span className="cb-power">{reveal ? reveal.theirs : '?'}</span>
            </div>
          </div>
          <div className="cb-vs">{reveal ? (reveal.won ? 'WIN' : 'LOSS') : `ROUND ${Math.min(round + 1, 3)}`}</div>
          <div className="cb-side cb-you">
            <div className="cb-side-label">{pet ? pet.name : 'YOU'}</div>
            <div className={`cb-card cb-card-you${reveal ? ' shown' : ''}`}>
              <span className="cb-power">{reveal ? reveal.mine : '—'}</span>
            </div>
          </div>
        </div>

        {!done && (
          <>
            <div className="cb-hint">
              {lostLast ? 'You lost the last round — Surge doubles.' : 'Pick a card. It is spent either way.'}
            </div>
            <div className="cb-hand">
              {hand.map(c => {
                const t = CARD_TYPES[c.type];
                return (
                  <button key={c.uid} className={`cb-hand-card t-${c.type}`} onClick={() => play(c)} disabled={!!reveal}
                          data-testid={`cb-card-${c.type}`}>
                    <GameIcon name={t.icon} size={22} />
                    <span className="cb-hand-name">{t.name}</span>
                    <span className="cb-hand-power">{c.power}</span>
                    <span className="cb-hand-desc">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
