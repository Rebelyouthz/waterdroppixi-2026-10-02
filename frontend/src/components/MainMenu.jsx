import React from 'react';

export default function MainMenu({ save, onStart, onCamp, onReset }) {
  return (
    <div className="app-shell">
      <div className="menu" data-testid="main-menu">
        <div className="title">WATERDROP</div>
        <div className="subtitle">SURVIVOR</div>
        <div className="tagline">
          A.I.D.A. WATCHES. THE LAKE REMEMBERS.
          <br />
          KILL · GROW · RETURN · ASCEND
        </div>
        <div className="menu-actions">
          <button data-testid="play-button" onClick={onStart}>▸ Begin Run</button>
          <button data-testid="camp-button" onClick={onCamp}>⛺ The Camp</button>
          <button data-testid="reset-button" onClick={onReset} style={{ opacity: 0.6 }}>Erase Save</button>
        </div>
        <div className="menu-footer">
          GOLD: <b style={{ color: 'var(--accent-2)' }}>{save.gold}</b> &nbsp;·&nbsp;
          RUNS: <b style={{ color: 'var(--rune)' }}>{save.runsCompleted}</b> &nbsp;·&nbsp;
          BEST: <b style={{ color: 'var(--accent)' }}>{fmt(save.bestRunTime)}</b>
        </div>
        <div className="menu-footer" style={{ marginTop: 8 }}>
          WASD / Arrows · Mouse Aim · CLICK Shoot · R Reload · ESC Pause
        </div>
      </div>
    </div>
  );
}

function fmt(t) {
  if (!t) return '00:00';
  const m = Math.floor(t / 60); const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
