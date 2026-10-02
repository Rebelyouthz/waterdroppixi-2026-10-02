import React, { useState } from 'react';
import { AVATARS, DAILY_REWARDS } from '../game/data_ext';
import { todayIdx, applyReward, campHasClaimable } from '../store';
import { useAuth } from '../auth';
import LeaderboardPanel from './LeaderboardPanel';
import GameIcon from './GameIcon';
import { ClaimBadge } from './MetaFeatures';
import { Audio } from '../game/audio';
import { fireClaimFx } from './ClaimFx';
import { CampCosmos } from './CampFrame';
import { SettingsPanel } from './CampPanels';
import StartVista from './StartVista';
import { isCampUnlocked } from '../game/campaign';

function AccountWidget({ openLb }) {
  const { user, paid, login, logout, loading } = useAuth();
  if (loading) return null;
  return (
    <div className="account-widget" data-testid="account-widget">
      {user ? (
        <>
          {user.picture
            ? <img src={user.picture} alt="" className="acc-pic" />
            : <div className="acc-pic acc-pic-fb"><GameIcon name="ui_waterdrop" size={16} /></div>}
          <div className="acc-meta">
            <div className="acc-name">{user.name || user.email}</div>
            <div className="acc-sub">
              {paid
                ? <span className="acc-paid">✓ UNLOCKED</span>
                : <span className="acc-trial">DEMO MODE</span>}
            </div>
          </div>
          <button onClick={openLb} className="acc-btn" data-testid="open-leaderboard"><GameIcon name="ui_trophy" size={16} /></button>
          <button onClick={logout} className="acc-btn acc-btn-ghost" data-testid="account-logout">↩</button>
        </>
      ) : (
        <>
          <button onClick={openLb} className="acc-btn" data-testid="open-leaderboard"><GameIcon name="ui_trophy" size={14} /> Leaderboard</button>
          <button onClick={login} className="acc-btn acc-btn-google" data-testid="account-login">
            <span style={{ fontSize: 14, fontWeight: 800 }}>G</span> Sign in
          </button>
        </>
      )}
    </div>
  );
}

export default function Welcome({ save, setSave, onContinue, onCamp, onReset, onReplayIntro }) {
  const [step, setStep] = useState(save.profile.name ? 'home' : 'create');
  const [name, setName] = useState(save.profile.name || '');
  const [avatar, setAvatar] = useState(save.profile.avatar || 'drop');
  const [showLb, setShowLb] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const create = () => {
    if (!name.trim()) return;
    const ns = { ...save, profile: { ...save.profile, name: name.trim(), avatar } };
    setSave(ns);
    setStep('home');
  };

  if (step === 'create') {
    return (
      <div className="app-shell">
        <div className="menu" data-testid="welcome-create" style={{ width: 'min(720px, 92vw)' }}>
          <div className="title">CHOOSE YOUR FORM</div>
          <div className="subtitle">A.I.D.A. AWAKENS</div>
          <div className="avatar-grid">
            {AVATARS.map(a => (
              <div
                key={a.id}
                className={`avatar-card ${avatar === a.id ? 'sel' : ''}`}
                onClick={() => setAvatar(a.id)}
                data-testid={`avatar-${a.id}`}
              >
                <div className="avatar-icon"><GameIcon name={a.icon} size={30} /></div>
                <div className="avatar-name">{a.name}</div>
                <div className="avatar-desc">{a.desc}</div>
              </div>
            ))}
          </div>
          <input
            className="name-input"
            placeholder="Enter your name…"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            data-testid="name-input"
          />
          <button onClick={create} disabled={!name.trim()} data-testid="create-confirm" style={{ marginTop: 14 }}>
            ▸ Begin Journey
          </button>
        </div>
      </div>
    );
  }

  const today = todayIdx();
  const canClaim = save.daily.lastClaim !== today;
  const streakDay = (canClaim ? (save.daily.streak || 0) % 7 : ((save.daily.streak || 1) - 1) % 7) + 1;
  const claimableReward = DAILY_REWARDS[(streakDay - 1) % 7];
  const campOpen = isCampUnlocked(save);
  const campClaimable = campOpen && campHasClaimable(save);

  const claimDaily = (anchor) => {
    if (!canClaim) return;
    const ns = {
      ...save,
      daily: { ...save.daily, lastClaim: today, streak: (save.daily.streak || 0) + 1 },
    };
    applyReward(ns, claimableReward);
    setSave(ns);
    fireClaimFx(anchor, claimableReward);
  };

  return (
    <div className="app-shell welcome-shell-space" data-testid="welcome-home">
      <CampCosmos />
      <StartVista />
      <AccountWidget openLb={() => setShowLb(true)} />

      {canClaim && (
        <button
          className="start-daily"
          data-testid="start-daily"
          onClick={(e) => { Audio.click(); claimDaily(e.currentTarget); }}
        >
          <GameIcon name="ui_calendar" size={14} /> DAILY · DAY {streakDay}
        </button>
      )}

      <div className="welcome start-menu">
        <div className="start-title">WATERDROP SURVIVOR</div>
        <div className="start-kicker">{save.profile.name || 'Wanderer'}</div>
        <div className="welcome-actions">
          <button
            onClick={() => { Audio.menuOpen?.(); onContinue(); }}
            data-testid="welcome-fight"
          >
            ▸ START GAME
          </button>
          <button
            onClick={() => { Audio.click(); setSettingsOpen(true); }}
            data-testid="welcome-options"
          >
            <GameIcon name="ui_cog" size={15} /> OPTIONS
          </button>
          <button
            onClick={() => { Audio.click(); setCreditsOpen(true); }}
            data-testid="welcome-credits"
          >
            CREDITS
          </button>
          <button
            onClick={() => { if (!campOpen) return; Audio.click(); onCamp(); }}
            disabled={!campOpen}
            data-testid="welcome-camp"
            title={campOpen ? 'Enter the wreck' : 'Hold the wreck once to open the camp'}
          >
            <GameIcon name={campOpen ? 'ui_base' : 'ui_lock'} size={15} /> GO TO CAMP
            {campClaimable && <ClaimBadge />}
          </button>
        </div>
      </div>

      {showLb && (
        <div className="modal-overlay" onClick={() => setShowLb(false)} data-testid="lb-overlay">
          <div className="lb-modal" onClick={(e) => e.stopPropagation()}>
            <button className="lb-close" onClick={() => setShowLb(false)} data-testid="lb-close">✕</button>
            <LeaderboardPanel />
          </div>
        </div>
      )}
      {settingsOpen && (
        <SettingsPanel
          save={save}
          setSave={setSave}
          onClose={() => setSettingsOpen(false)}
          onReset={onReset}
          onReplayIntro={onReplayIntro}
        />
      )}
      {creditsOpen && (
        <div className="modal-overlay" data-testid="credits-overlay" onClick={() => setCreditsOpen(false)}>
          <div className="forge-panel settings-panel" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="forge-header">
              <div className="forge-title">CREDITS</div>
              <button onClick={() => setCreditsOpen(false)} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
            </div>
            <div className="start-credits-body">
              <p>WATERDROP SURVIVOR</p>
              <p>A lake. A wreck. A chip that wants a socket.</p>
              <p>Made by Timmy. Hand-built sprites, no stock packs.</p>
              <p>A.I.D.A. watches. The Annunaki left the door open.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
