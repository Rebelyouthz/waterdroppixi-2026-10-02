import React from 'react';

const fmt = (t) => {
  const m = Math.floor(t / 60); const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function GameOver({ result, extras, onCamp, onRetry, onMenu }) {
  const ex = extras || {};
  const rewards = [
    { icon: '💰', label: 'Gold earned',     val: '+' + (result.gold || 0) },
    { icon: '🌟', label: 'Account XP',      val: '+' + (ex.xpGained || 0) },
    { icon: '🔮', label: 'Skill Points',    val: '+' + (ex.spGained || 0) },
  ];
  const badges = [];
  if (ex.isBestTime)   badges.push({ icon: '🏆', label: 'NEW BEST TIME' });
  if (ex.isBestKills)  badges.push({ icon: '⚡', label: 'NEW LEVEL RECORD' });
  if (ex.noHit)        badges.push({ icon: '💎', label: 'FLAWLESS RUN' });
  if (result.victory || result.aidaKilled) badges.push({ icon: '👑', label: 'A.I.D.A. SLAIN' });
  if (result.endless)  badges.push({ icon: '∞', label: 'ENDLESS SURVIVOR' });
  if (ex.challengeBonus) badges.push({ icon: '🎯', label: 'CHALLENGE CLEARED' });

  return (
    <div className="modal-overlay">
      <div className={'gameover go-modern' + (result.victory || result.aidaKilled ? ' is-victory' : '')} data-testid="game-over">
        <div className="go-title">{result.endless ? '∞ ENDLESS MODE' : (result.victory || result.aidaKilled ? 'A.I.D.A. SLAIN' : 'YOU FELL')}</div>
        <div className="go-sub">
          {result.endless ? 'Aida is gone. The void remains. How long can you last?' : (result.victory || result.aidaKilled ? 'The lake awakens. The collective remembers your name.' : 'The lake mourns. Return stronger.')}
        </div>

        <div className="go-stats-grid">
          <div className="go-stat"><span>TIME</span><b>{fmt(result.time)}</b></div>
          <div className="go-stat"><span>LEVEL</span><b>{result.level}</b></div>
          <div className="go-stat"><span>KILLS</span><b>{result.kills}</b></div>
          <div className="go-stat"><span>WAVE</span><b>{Math.max(1, Math.ceil((result.time||0)/30))}</b></div>
        </div>

        <div className="go-section-title">REWARDS COLLECTED</div>
        <div className="go-rewards">
          {rewards.map((r, i) => (
            <div key={i} className="go-reward-row" data-testid={`reward-${i}`}>
              <span className="go-reward-icon">{r.icon}</span>
              <span className="go-reward-label">{r.label}</span>
              <span className="go-reward-val">{r.val}</span>
            </div>
          ))}
        </div>

        {badges.length > 0 && (
          <div className="go-badges">
            {badges.map((b, i) => (
              <div key={i} className="go-badge" data-testid={`badge-${i}`}>
                <span>{b.icon}</span><b>{b.label}</b>
              </div>
            ))}
          </div>
        )}

        <div className="go-actions">
          <button onClick={onMenu} data-testid="go-menu" className="go-btn go-btn-ghost">↩ Menu</button>
          <button onClick={onCamp} data-testid="go-camp" className="go-btn go-btn-camp">⛺ Camp</button>
          <button onClick={onRetry} data-testid="go-retry" className="go-btn go-btn-retry">↻ RETRY</button>
        </div>
      </div>
    </div>
  );
}
