import React, { useState } from 'react';
import { BUILDINGS, buildingLevel, buildingCost } from '../game/base';
import { COMPANION_LIST, isRescued } from '../game/companions';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

// The base. Each building opens the system it houses and can be levelled to
// improve that system — see game/base.js for why levels only ever improve
// their own system.
export default function BasePanel({ save, setSave, onOpen, onClose }) {
  const [toast, setToast] = useState('');
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2400); };

  const upgrade = (id) => {
    const lvl = buildingLevel(save, id);
    const b = BUILDINGS[id];
    if (lvl >= b.max) return;
    const cost = buildingCost(id, lvl);
    if ((save.gold || 0) < cost.gold) { say('Not enough gold'); return; }
    if ((save.gearParts || 0) < cost.parts) { say(`Need ${cost.parts} gear parts`); return; }
    setSave({
      ...save,
      gold: save.gold - cost.gold,
      gearParts: save.gearParts - cost.parts,
      base: { ...(save.base || {}), [id]: lvl + 1 },
    });
    Audio.claimPing();
    say(`${b.name} is now level ${lvl + 1}`);
  };

  const totalLevels = Object.keys(BUILDINGS).reduce((a, id) => a + buildingLevel(save, id), 0);

  return (
    <div className="modal-overlay" data-testid="base-panel" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="base-panel">
        <div className="base-head">
          <div className="base-title">🏛 THE BASE</div>
          <span className="base-sum">{totalLevels} levels built</span>
          <button className="prosp-close" onClick={onClose}>✕</button>
        </div>
        {toast && <div className="base-toast">{toast}</div>}

        {/* Companions found in the storyline stand here once rescued —
            silent otherwise, since a slot for someone you haven't met yet
            would just read as a locked feature rather than a person. */}
        <div className="base-companions" data-testid="base-companions">
          {COMPANION_LIST.map(c => {
            const has = isRescued(save, c.id);
            return (
              <div key={c.id} className={`base-comp${has ? ' here' : ''}`} style={{ '--cc': c.color }}
                   title={has ? c.bio : 'Not yet found.'}>
                <span className="base-comp-dot" />
                <span className="base-comp-name">{has ? c.name : '???'}</span>
                <span className="base-comp-role">{has ? c.title : 'somewhere in the story'}</span>
              </div>
            );
          })}
        </div>

        <div className="base-grid">
          {Object.values(BUILDINGS).map(b => {
            const lvl = buildingLevel(save, b.id);
            const maxed = lvl >= b.max;
            const cost = buildingCost(b.id, lvl);
            const afford = (save.gold || 0) >= cost.gold && (save.gearParts || 0) >= cost.parts;
            return (
              <div key={b.id} className={`base-card${maxed ? ' maxed' : ''}`} style={{ '--bc': b.accent }}>
                <div className="base-card-top">
                  <GameIcon name={b.icon} tone={b.accent} size={30} />
                  <div>
                    <div className="base-card-name">{b.name}</div>
                    <div className="base-card-blurb">{b.blurb}</div>
                  </div>
                  <span className="base-card-lvl">{lvl}<i>/{b.max}</i></span>
                </div>

                <div className="base-card-effect">
                  {lvl > 0 ? b.effect(lvl) : <span className="base-card-none">not built yet</span>}
                  {!maxed && lvl > 0 && <span className="base-card-next"> → {b.effect(lvl + 1)}</span>}
                </div>

                <div className="base-pips">
                  {Array.from({ length: b.max }).map((_, i) => (
                    <i key={i} className={i < lvl ? 'on' : ''} />
                  ))}
                </div>

                <div className="base-card-actions">
                  <button className="base-btn open" onClick={() => onOpen(b.id)}>ENTER</button>
                  {maxed ? (
                    <span className="base-btn maxlbl">MAX</span>
                  ) : (
                    <button className="base-btn buy" disabled={!afford} onClick={() => upgrade(b.id)}
                            data-testid={`base-up-${b.id}`}>
                      ★ {cost.gold} · 🔩 {cost.parts}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
