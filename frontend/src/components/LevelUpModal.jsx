import React, { useEffect } from 'react';
import { RARITY } from '../game/data';

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
            return (
              <div
                key={i}
                className={`card ${r.cls}`}
                onClick={() => onPick(c)}
                data-testid={`card-${i}`}
                style={{ animationDelay: (i * 90) + 'ms' }}
              >
                <div className="card-tag">{r.name}</div>
                <div className="card-shine" />
                <div className="card-icon">{c.icon}</div>
                <div className="card-rarity">{c.kind === 'weapon-new' ? 'NEW WEAPON' : c.kind === 'weapon-upgrade' ? 'WEAPON +' : c.kind === 'flag' ? 'PASSIVE' : 'STAT'}</div>
                <div className="card-name">{c.name}</div>
                <div className="card-desc">{c.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
