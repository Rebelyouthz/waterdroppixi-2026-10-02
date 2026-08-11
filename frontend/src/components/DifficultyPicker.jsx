import React from 'react';
import { DIFFICULTIES, difficultyUnlocked, progressFor, activeDifficulty } from '../game/difficulty';
import { campaignNodes } from '../game/campaign';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';

// =============================================
// DIFFICULTY PICKER — three cards, two of them locked
// =============================================
// Sits above the story map. A locked tier still shows its full numbers rather
// than hiding behind a padlock, because the numbers ARE the pitch: seeing
// "×2.2 enemy health, ×1.6 rewards" written on a tier you cannot select yet is
// what makes finishing the current one feel like it leads somewhere.
//
// Progress per tier is shown as nodes-cleared, since that is exactly what the
// gate reads — no player should have to guess what "finish the story" counted.

export default function DifficultyPicker({ save, setSave }) {
  const nodes = campaignNodes();
  const allIds = nodes.map(n => n.id);
  const active = activeDifficulty(save);

  const pick = (d) => {
    if (!difficultyUnlocked(save, d.id, allIds)) return;
    if (d.id === active) return;
    Audio.click();
    setSave({ ...save, difficulty: d.id });
    pushToast({
      tone: d.id === 'normal' ? 'default' : 'legendary',
      icon: d.icon,
      title: `${d.name} selected`,
      text: d.id === 'normal' ? 'The story runs at its own pace.' : 'The story restarts from the first node at this tier.',
    });
  };

  return (
    <div className="diff-picker" data-testid="difficulty-picker">
      <div className="diff-picker-head">
        <span className="diff-picker-title">DIFFICULTY</span>
        <span className="diff-picker-note">Each tier is the whole story again — progress is tracked separately.</span>
      </div>
      <div className="diff-picker-row">
        {DIFFICULTIES.map(d => {
          const unlocked = difficultyUnlocked(save, d.id, allIds);
          const isActive = active === d.id;
          const prog = progressFor(save, d.id);
          const cleared = allIds.filter(id => prog[id]).length;
          const complete = cleared >= allIds.length && allIds.length > 0;
          return (
            <button
              key={d.id}
              className={`diff-card${isActive ? ' active' : ''}${unlocked ? '' : ' locked'}${complete ? ' complete' : ''}`}
              style={{ '--dc': d.color }}
              data-testid={`diff-${d.id}`}
              onClick={() => pick(d)}
              disabled={!unlocked}
            >
              <span className="diff-card-icon">{d.icon}</span>
              <span className="diff-card-name">{d.name}</span>
              <span className="diff-card-desc">{d.desc}</span>
              <span className="diff-card-stats">
                <i>☠ ×{d.hpMult.toFixed(2).replace(/\.00$/, '')} HP</i>
                <i>⚔ ×{d.dmgMult.toFixed(2).replace(/\.00$/, '')} DMG</i>
                <i>★ ×{d.goldMult.toFixed(2).replace(/\.00$/, '')} REWARD</i>
              </span>
              <span className="diff-card-prog">
                <span className="diff-card-bar"><i style={{ width: `${allIds.length ? (cleared / allIds.length) * 100 : 0}%` }} /></span>
                {cleared}/{allIds.length} nodes
              </span>
              {!unlocked && <span className="diff-card-lock">🔒 {d.requiresLabel}</span>}
              {isActive && <span className="diff-card-active">▶ ACTIVE</span>}
              {complete && <span className="diff-card-done">✓ COMPLETE</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
