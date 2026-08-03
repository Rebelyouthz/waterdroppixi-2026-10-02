import React, { useEffect, useState, useRef } from 'react';
import { RARITY } from '../game/data';

const TYPE_BADGE = {
  'weapon-new': { icon: '⚔️', label: 'NEW WEAPON' },
  'weapon-upgrade': { icon: '⬆️', label: 'WEAPON UP' },
  'weapon-fork': { icon: '🔀', label: 'EVOLUTION PATH' },
  'flag': { icon: '🔮', label: 'PASSIVE' },
  'stat': { icon: '📈', label: 'STAT BOOST' },
};

// Stat values are pulled out of the description and coloured by their sign,
// so the gain or loss is readable at a glance instead of every number
// rendering in the same rarity colour: explicitly signed values go green for
// a gain and red for a loss, and unsigned numbers stay neutral rarity-tinted
// so plain quantities ("3 projectiles") don't masquerade as deltas.
function highlightDesc(desc) {
  return desc.split('\n').map((line, li) => (
    <React.Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/([+-]\d+(?:\.\d+)?%?|\d+(?:\.\d+)?%?)/g).map((part, i) => {
        if (!/\d/.test(part)) return part;
        if (part.startsWith('+')) return <b key={i} className="sv-up">{part}</b>;
        if (part.startsWith('-')) return <b key={i} className="sv-down">{part}</b>;
        return <b key={i}>{part}</b>;
      })}
    </React.Fragment>
  ));
}

// Dopamine-heavy level up modal: FORCE text, slot-machine card reveal, particles.
export default function LevelUpModal({ choices, onPick, playerLevel }) {
  const isFork = choices.length > 0 && choices[0].kind === 'weapon-fork';
  // Cards used to vanish instantly on click (setLevelUpChoices(null) in the
  // parent unmounts this whole modal the same frame) — no exit beat at all.
  // Now the pick plays a short "chosen" animation (winner punches up +
  // glows, the rest fade/slide away) and only calls the real onPick after
  // it finishes, so there's an actual out-animation instead of a hard cut.
  const [pickedIdx, setPickedIdx] = useState(null);
  const pickTimer = useRef(null);
  const handlePick = (c, i) => {
    if (pickedIdx !== null) return; // ignore double-clicks mid-animation
    setPickedIdx(i);
    pickTimer.current = setTimeout(() => onPick(c), 480);
  };
  useEffect(() => () => { if (pickTimer.current) clearTimeout(pickTimer.current); }, []);
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
    <div className={`modal-overlay levelup-overlay${isFork ? ' is-fork' : ''}`} data-testid="levelup-modal">
      <div className="levelup">
        <div className="lvl-burst" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="lvl-ray" style={{ transform: `rotate(${i * 22.5}deg)` }} />
          ))}
        </div>
        <div className="levelup-title" data-testid="levelup-title">{isFork ? 'WEAPON EVOLUTION!' : 'LEVEL UP!'}</div>
        <div className="levelup-mega">{isFork ? '🔀 CHOOSE ITS PATH' : `LV ${playerLevel}`}</div>
        <div className="levelup-sub">{isFork ? '⚔️ this choice is permanent for the run — pick wisely ⚔️' : '⚡ choose your boon — luck shapes the offerings ⚡'}</div>
        <div className={`card-row${isFork ? ' card-row-fork' : ''}`}>
          {choices.map((c, i) => {
            const r = RARITY[c.rarity] || RARITY.common;
            const badge = TYPE_BADGE[c.kind] || TYPE_BADGE.stat;
            const showLvlDots = c.kind === 'weapon-upgrade' && !c.isEvolve && Number.isFinite(c.lvl);
            const dotCount = showLvlDots ? Math.min(8, Math.max(c.lvl + 1, c.maxLvl || 1)) : 0;
            const isPicked = pickedIdx === i;
            const isRejected = pickedIdx !== null && !isPicked;
            return (
              <div
                key={i}
                className={`card ${r.cls}${isFork ? ' card-fork' : ''}${isPicked ? ' card-chosen' : ''}${isRejected ? ' card-rejected' : ''}`}
                onClick={() => handlePick(c, i)}
                data-testid={`card-${i}`}
                style={{ animationDelay: pickedIdx === null ? (i * 90) + 'ms' : '0ms' }}
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
