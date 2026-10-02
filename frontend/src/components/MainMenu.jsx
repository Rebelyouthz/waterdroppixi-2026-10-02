import React from 'react';
import GameIcon from './GameIcon';
import { AVATARS } from '../game/data_ext';

export default function MainMenu({ save, onStart, onCamp, onReset }) {
  const avatar = AVATARS.find(a => a.id === save?.profile?.avatar) || AVATARS[0];
  const photo = save?.profile?.photo || null;
  const rank = save?.profile?.level ? Math.floor((save.profile.level - 1) / 4) + 1 : 1;
  const name = save?.profile?.name || 'Wanderer';

  return (
    <div className="app-shell menu-shell" data-testid="main-menu">
      {/* Pure CSS ambient bioluminescent light motes — Zero canvas */}
      <div className="menu-motes" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="menu-mote"
            style={{
              '--left': `${(i * 5.8 + 3) % 96}%`,
              '--dur': `${4.5 + (i % 5) * 1.8}s`,
              '--delay': `${(i * 0.45) % 4}s`,
              '--size': `${3 + (i % 4) * 2.5}px`,
              '--alpha': `${0.35 + (i % 3) * 0.25}`,
            }}
          />
        ))}
      </div>

      <div className="menu-card">
        {/* Bioluminescent Waterdrop Crest */}
        <div className="menu-crest">
          <div className="menu-crest-glow" aria-hidden="true" />
          <div className="menu-crest-ring" aria-hidden="true" />
          <div className="menu-crest-icon">
            <GameIcon name="ui_waterdrop" size={48} tone="#4dffd4" />
          </div>
        </div>

        {/* Title Header */}
        <div className="menu-brand">
          <h1 className="menu-title">WATERDROP</h1>
          <div className="menu-subtitle">S U R V I V O R</div>
          <div className="menu-tagline">
            A.I.D.A. WATCHES &nbsp;·&nbsp; THE LAKE REMEMBERS
          </div>
        </div>

        {/* Profile Card Quick Summary */}
        <div className="menu-profile-pill">
          <div className="menu-profile-avatar">
            {photo ? (
              <img src={photo} alt="" className="menu-avatar-img" />
            ) : (
              <GameIcon name={avatar?.icon || 'ui_waterdrop'} size={24} tone="#4dffd4" />
            )}
          </div>
          <div className="menu-profile-info">
            <div className="menu-profile-name">{name}</div>
            <div className="menu-profile-rank">RANK {rank} &nbsp;·&nbsp; LVL {save?.profile?.level || 1}</div>
          </div>
          <div className="menu-profile-stats">
            <span className="menu-cur-gold">★ {save?.gold || 0}</span>
            <span className="menu-cur-sp">◆ {save?.sp || 0} SP</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="menu-actions">
          <button className="menu-btn-play" data-testid="play-button" onClick={onStart}>
            <span className="menu-btn-shine" aria-hidden="true" />
            <span className="menu-btn-text">▸ BEGIN EXPEDITION</span>
          </button>

          <button className="menu-btn-camp" data-testid="camp-button" onClick={onCamp}>
            <GameIcon name="ui_base" size={16} tone="#ffd166" />
            <span>ENTER THE CAMP</span>
          </button>

          <button className="menu-btn-reset" data-testid="reset-button" onClick={onReset}>
            Erase Save Data
          </button>
        </div>

        {/* Footer info & Controls */}
        <div className="menu-footer-stats">
          <span>RUNS: <b>{save?.runsCompleted || 0}</b></span>
          <span className="menu-dot">·</span>
          <span>BEST SURVIVAL: <b>{fmt(save?.bestRunTime)}</b></span>
        </div>

        <div className="menu-controls-bar">
          <span>WASD / Stick: Move</span>
          <span>·</span>
          <span>Mouse / Aim: Aim & Attack</span>
          <span>·</span>
          <span>R: Reload</span>
          <span>·</span>
          <span>ESC: Pause</span>
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
