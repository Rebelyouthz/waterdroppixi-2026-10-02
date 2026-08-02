import React, { useEffect } from 'react';
import { RARITY } from '../game/data';

const TYPE_BADGE = {
  'weapon-new': { icon: '⚔️', label: 'NEW WEAPON' },
  'weapon-upgrade': { icon: '⬆️', label: 'WEAPON UP' },
  'flag': { icon: '🔮', label: 'PASSIVE' },
  'stat': { icon: '📈', label: 'STAT BOOST' },
};

// Wrap numeric tokens (+25%, +3, etc.) in <b> so stat values pop in the
// card's rarity color instead of blending into the description text.
function highlightDesc(desc) {
  return desc.split('\n').map((line, li) => (
    <React.Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\+?-?\d+(?:\.\d+)?%?)/g).map((part, i) => (
        /\d/.test(part) ? <b key={i}>{part}</b> : part
      ))}
    </React.Fragment>
  ));
}

// Dopamine-heavy level up modal: FORCE text, slot-machine card reveal, particles.
export default function LevelUpModal({ choices, onPick, playerLevel }) {
  useEffect(() => {
    // play a small "ding" via WebAudio (no asset)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 440;
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.connect(g).connect(ctx.destination);
      o.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.15);
      o.start(); o.stop(ctx.currentTime + 0.6);
    } catch {}
  }, []);

  return (
    <div className="modal-overlay levelup-overlay" data-testid="levelup-modal">
      <div className="levelup">
        <div className="lvl-burst" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="lvl-ray" style={{ transform: `rotate(${i * 22.5}deg)` }} />
          ))}
        </div>
        <div className="levelup-title" data-testid="levelup-title">LEVEL UP!</div>
        <div className="levelup-mega">LV {playerLevel}</div>
        <div className="levelup-sub">⚡ choose your boon — luck shapes the offerings ⚡</div>
        <div className="card-row">
          {choices.map((c, i) => {
            const r = RARITY[c.rarity] || RARITY.common;
            const badge = TYPE_BADGE[c.kind] || TYPE_BADGE.stat;
            const showLvlDots = c.kind === 'weapon-upgrade' && !c.isEvolve && Number.isFinite(c.lvl);
            const dotCount = showLvlDots ? Math.min(8, Math.max(c.lvl + 1, c.maxLvl || 1)) : 0;
            return (
              <div
                key={i}
                className={`card ${r.cls}`}
                onClick={() => onPick(c)}
                data-testid={`card-${i}`}
                style={{ animationDelay: (i * 90) + 'ms' }}
              >
                <div className="card-tag">{r.name}</div>
                {c.isEvolve && <div className="card-evo-badge">✦ EVOLUTION</div>}
                <div className="card-shine" />
                <div className="card-portrait">
                  <div className="card-icon">{c.icon}</div>
                </div>
                <div className="card-type-badge">
                  <span>{badge.icon}</span><span>{c.isEvolve ? 'EVOLVE' : badge.label}</span>
                </div>
                {showLvlDots && (
                  <div className="card-lvl-dots">
                    {Array.from({ length: dotCount }).map((_, di) => (
                      <span key={di} className={`card-lvl-dot ${di < c.lvl ? 'filled' : di === c.lvl ? 'next' : ''}`} />
                    ))}
                    <span className="card-lvl-text">Lv {c.lvl + 1}</span>
                  </div>
                )}
                <div className="card-name">{c.name}</div>
                <div className="card-desc">{highlightDesc(c.desc)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
