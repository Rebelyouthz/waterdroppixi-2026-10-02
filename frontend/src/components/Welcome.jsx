import React, { useState, useEffect } from 'react';
import { AVATARS, DAILY_REWARDS, accountXpToNext, dailyQuests, CHESTS, rollChest, weeklyQuests, weekIdx, rollSpinWheel, SPIN_WHEEL_SLICES } from '../game/data_ext';
import { todayIdx, applyReward } from '../store';
import { useAuth } from '../auth';
import LeaderboardPanel from './LeaderboardPanel';
import GameIcon from './GameIcon';
import { Audio } from '../game/audio';
import QuestTracker from './QuestTracker';
import BadgeSlots, { BadgePicker } from './BadgeSlots';

const openChest = (chestId) => {
  const chest = CHESTS.find(c => c.id === chestId);
  return chest ? rollChest(chest, 0.5) : [];
};

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

export default function Welcome({ save, setSave, onContinue, onCamp }) {
  const [step, setStep] = useState(save.profile.name ? 'home' : 'create');
  const [name, setName] = useState(save.profile.name || '');
  const [avatar, setAvatar] = useState(save.profile.avatar || 'drop');
  const [claimedRewards, setClaimedRewards] = useState([]);
  const [showLb, setShowLb] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);

  // Custom avatar photo.
  //
  // The image is DOWNSCALED to 128x128 and re-encoded before it is stored, and
  // that is not a nicety — the save lives in localStorage, which is a ~5MB
  // budget for the entire profile. A modern phone photo is 3-8MB, and as a
  // base64 data URL it grows another third. Storing one raw would blow the
  // quota and every subsequent save would silently fail: the player would lose
  // their whole run history because they picked a picture.
  //
  // 128px square at JPEG 0.82 lands around 6-10KB, which is nothing, and the
  // avatar is never displayed larger than 80px so nothing is lost visually.
  const onPickPhoto = (file, ev) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const S = 128;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const ctx = c.getContext('2d');
        // Cover-crop to a square: scale by the LARGER ratio and centre, so a
        // portrait photo is cropped rather than squashed.
        const scale = Math.max(S / img.width, S / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        let url;
        try { url = c.toDataURL('image/jpeg', 0.82); } catch (e) { return; }
        // Refuse anything still unreasonably large rather than risk the quota.
        if (url.length > 120000) return;
        setSave(cur => ({ ...cur, profile: { ...cur.profile, photo: url } }));
        Audio.click();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    // Let the same file be picked again after a change of mind.
    if (ev && ev.target) ev.target.value = '';
  };
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [spinAngle, setSpinAngle] = useState(0);
  const [winIdx, setWinIdx] = useState(null);

  const today = todayIdx();
  // Daily/weekly quest progress is keyed by quest id and never expired —
  // since the quest pool is small (5 of 8 daily, 3 of 5 weekly), the same
  // id reliably reappears on a later day/week and, without this reset,
  // would show up permanently "already claimed" from the first time it was
  // ever completed. Reset completed/claimed the moment the day/week index
  // actually changes (checked once, not on every render).
  useEffect(() => {
    const day = todayIdx(); const wk = weekIdx();
    let changed = false;
    const ns = { ...save };
    if (save.quests.day !== day) { ns.quests = { day, completed: {}, claimed: {} }; changed = true; }
    if (save.weeklyQuests.week !== wk) { ns.weeklyQuests = { week: wk, completed: {}, claimed: {} }; changed = true; }
    if (changed) setSave(ns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const canClaim = save.daily.lastClaim !== today;
  const streakDay = (canClaim ? (save.daily.streak || 0) % 7 : ((save.daily.streak || 1) - 1) % 7) + 1;
  const claimableReward = DAILY_REWARDS[(streakDay - 1) % 7];

  const create = () => {
    if (!name.trim()) return;
    const ns = { ...save, profile: { ...save.profile, name: name.trim(), avatar } };
    setSave(ns);
    setStep('home');
  };

  const claimDaily = () => {
    if (!canClaim) return;
    const ns = {
      ...save,
      daily: { ...save.daily, lastClaim: today, streak: (save.daily.streak || 0) + 1 },
    };
    applyReward(ns, claimableReward, openChest);
    setSave(ns);
    setClaimedRewards(prev => [...prev, claimableReward.label]);
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

  // home/welcome screen with profile, daily, quests
  const xpNext = accountXpToNext(save.profile.level);
  const xpPct = (save.profile.xp / xpNext) * 100;
  const quests = dailyQuests(today);
  const week = weekIdx();
  const wquests = weeklyQuests(week);
  const canSpin = save.dailySpin?.day !== today;
  const SLICE_N = SPIN_WHEEL_SLICES.length;
  const SLICE_DEG = 360 / SLICE_N;

  // The prize used to be decided independently of where the wheel stopped,
  // so the pointer routinely came to rest on a slice that was not the one
  // awarded. Roll first, then drive the rotation to land that exact slice
  // under the pointer.
  const doSpin = () => {
    if (!canSpin || spinning) return;
    const { index, slice } = rollSpinWheel();
    // Slice i is centred at (i + 0.5) * SLICE_DEG clockwise from the top, so
    // bringing it under the top pointer means rotating by the negative of
    // that. Always add whole turns on top of the current angle so the wheel
    // only ever accelerates forward, never snaps backwards.
    const target = -((index + 0.5) * SLICE_DEG);
    const turns = 5 + Math.floor(Math.random() * 2);
    const next = spinAngle + turns * 360 + (((target - spinAngle) % 360) + 360) % 360;
    setSpinAngle(next);
    setSpinResult(null);
    setSpinning(true);
    setWinIdx(index);

    // Award only once the wheel has actually stopped — matches the animation
    // duration in .spin-wheel-face.
    setTimeout(() => {
      const ns = { ...save, dailySpin: { day: today, spun: true } };
      if (slice.type === 'jackpot') { ns.gold = (ns.gold || 0) + 1500; ns.gems = (ns.gems || 0) + 10; }
      else if (slice.type === 'gold') ns.gold = (ns.gold || 0) + slice.amount;
      else if (slice.type === 'gems') ns.gems = (ns.gems || 0) + slice.amount;
      else if (slice.type === 'slotCoins') ns.slotCoins = (ns.slotCoins || 0) + slice.amount;
      else if (slice.type === 'petFood') ns.petFood = (ns.petFood || 0) + slice.amount;
      else if (slice.type === 'sp') ns.sp = (ns.sp || 0) + slice.amount;
      setSave(ns);
      setSpinResult(slice);
      setSpinning(false);
    }, 3400);
  };

  return (
    <div className="app-shell" style={{ alignItems: 'flex-start' }}>
      <AccountWidget openLb={() => setShowLb(true)} />
      <div className="welcome" data-testid="welcome-home">
        <div className="welcome-header">
          <div className="profile-card" data-testid="profile-card">
            {/* Your own photo, or the chosen glyph. The frame is a real frame
                now — see .profile-avatar: the flat square with a hard black
                border read as a placeholder box rather than as a portrait. */}
            <label className="profile-avatar" title="Tap to use your own picture">
              {save.profile.photo
                ? <img className="profile-avatar-img" src={save.profile.photo} alt="" />
                : <span className="profile-avatar-glyph"><GameIcon name={AVATARS.find(a => a.id === save.profile.avatar)?.icon || 'ui_waterdrop'} size={26} /></span>}
              <span className="profile-avatar-ring" aria-hidden />
              <span className="profile-avatar-edit" aria-hidden><GameIcon name="ui_camera" size={13} /></span>
              <input
                type="file"
                accept="image/*"
                className="profile-avatar-input"
                data-testid="avatar-upload"
                onChange={(e) => onPickPhoto(e.target.files && e.target.files[0], e)}
              />
            </label>
            <div style={{ flex: 1 }}>
              <div className="profile-name">{save.profile.name || 'Wanderer'}</div>
              <div className="profile-level">RANK {save.profile.level}</div>
              <div className="profile-xp">
                <div className="profile-xp-fill" style={{ width: xpPct + '%' }} />
              </div>
              <div className="profile-xp-text">{save.profile.xp} / {xpNext} XP</div>
            </div>
            <div className="profile-curr">
              <div><span style={{ color: 'var(--accent-2)' }}>★</span> {save.gold}</div>
              <div><span style={{ color: 'var(--rune)' }}>◆</span> {save.sp} SP</div>
            </div>
            {/* The badges you chose to display, right on the profile card —
                this is the screen a player lands on, so it is the screen the
                trophy case has to be visible from. */}
            <BadgeSlots save={save} size={24} onOpen={() => setBadgesOpen(true)} />
          </div>
        </div>

        {/* Guidance follows the player out of the camp. The home screen is
            exactly where "what was I doing?" gets asked, so the same two open
            steps are here, tapping through to the camp rather than nowhere. */}
        <QuestTracker save={save} onGo={() => onCamp && onCamp()} />

        <div className="welcome-grid">
          {/* Daily Reward */}
          <div className="panel">
            <div className="panel-title">DAILY REWARD</div>
            <div className="daily-row">
              {DAILY_REWARDS.map((r, i) => {
                const claimed = i + 1 < streakDay;
                const current = i + 1 === streakDay && canClaim;
                return (
                  <div key={r.day} className={`daily-cell ${claimed ? 'claimed' : ''} ${current ? 'current' : ''}`}>
                    <div className="daily-day">D{r.day}</div>
                    <div className="daily-icon"><GameIcon name={r.icon} size={26} /></div>
                    <div className="daily-label">{r.label}</div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={claimDaily}
              disabled={!canClaim}
              data-testid="claim-daily"
              style={{ marginTop: 12, width: '100%' }}
            >
              {canClaim ? `▸ CLAIM DAY ${streakDay}` : '✓ Already Claimed'}
            </button>
          </div>

          {/* Daily Quests */}
          <div className="panel">
            <div className="panel-title">DAILY QUESTS</div>
            <div className="quest-list">
              {quests.map(q => {
                const prog = save.quests.completed[q.id] || 0;
                const claimed = save.quests.claimed[q.id];
                const done = prog >= q.goal;
                return (
                  <div key={q.id} className={`quest-row ${done ? 'done' : ''}`} data-testid={`quest-${q.id}`}>
                    <div className="quest-icon"><GameIcon name={q.icon} size={22} /></div>
                    <div className="quest-body">
                      <div className="quest-name">{q.name}</div>
                      <div className="quest-desc">{q.desc}</div>
                      <div className="quest-bar">
                        <div className="quest-bar-fill" style={{ width: Math.min(100, (prog / q.goal) * 100) + '%' }} />
                      </div>
                      <div className="quest-prog">{Math.min(prog, q.goal)} / {q.goal}</div>
                    </div>
                    <div className="quest-reward">
                      {q.reward.gold && <div>★ {q.reward.gold}</div>}
                      {q.reward.sp && <div>◆ {q.reward.sp} SP</div>}
                      {q.reward.gems && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_gems" size={12} /> {q.reward.gems}</div>}
                      {q.reward.slotCoins && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_slot" size={12} /> {q.reward.slotCoins}</div>}
                      {q.reward.petFood && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="petFood" size={12} /> {q.reward.petFood}</div>}
                      {done && !claimed && (
            <button
              onClick={() => {
                const ns = {
                  ...save,
                  quests: {
                    ...save.quests,
                    claimed: { ...save.quests.claimed, [q.id]: true },
                  },
                };
                applyReward(ns, q.reward, openChest);
                setSave(ns);
              }}
              data-testid={`claim-${q.id}`}
              className="claim-burst"
              style={{ padding: '4px 10px', fontSize: 11, marginTop: 4, background: 'linear-gradient(180deg,#1a2b1a,#0e1a0e)', borderColor: '#4dffd4', color: '#4dffd4' }}
            >
              ★ CLAIM
            </button>
                      )}
                      {claimed && <div style={{ color: 'var(--accent-2)' }}>✓</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Quests */}
          <div className="panel">
            <div className="panel-title">WEEKLY QUESTS</div>
            <div className="quest-list">
              {wquests.map(q => {
                const prog = save.weeklyQuests.completed[q.id] || 0;
                const claimed = save.weeklyQuests.claimed[q.id];
                const done = prog >= q.goal;
                return (
                  <div key={q.id} className={`quest-row ${done ? 'done' : ''}`} data-testid={`wquest-${q.id}`}>
                    <div className="quest-icon"><GameIcon name={q.icon} size={22} /></div>
                    <div className="quest-body">
                      <div className="quest-name">{q.name}</div>
                      <div className="quest-desc">{q.desc}</div>
                      <div className="quest-bar">
                        <div className="quest-bar-fill" style={{ width: Math.min(100, (prog / q.goal) * 100) + '%' }} />
                      </div>
                      <div className="quest-prog">{Math.min(prog, q.goal)} / {q.goal}</div>
                    </div>
                    <div className="quest-reward">
                      {q.reward.gold && <div>★ {q.reward.gold}</div>}
                      {q.reward.gems && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_gems" size={12} /> {q.reward.gems}</div>}
                      {q.reward.slotCoins && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_slot" size={12} /> {q.reward.slotCoins}</div>}
                      {q.reward.talentPoints && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="ui_leaf" size={12} /> {q.reward.talentPoints} TP</div>}
                      {q.reward.petFood && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="petFood" size={12} /> {q.reward.petFood}</div>}
                      {done && !claimed && (
                        <button
                          onClick={() => {
                            const ns = { ...save, weeklyQuests: { ...save.weeklyQuests, claimed: { ...save.weeklyQuests.claimed, [q.id]: true } } };
                            applyReward(ns, q.reward, openChest);
                            setSave(ns);
                          }}
                          data-testid={`wclaim-${q.id}`}
                          className="claim-burst"
                          style={{ padding: '4px 10px', fontSize: 11, marginTop: 4, background: 'linear-gradient(180deg,#1a2b1a,#0e1a0e)', borderColor: '#4dffd4', color: '#4dffd4' }}
                        >★ CLAIM</button>
                      )}
                      {claimed && <div style={{ color: 'var(--accent-2)' }}>✓</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Lucky Spin Wheel */}
          <div className="panel">
            <div className="panel-title">DAILY SPIN</div>
            <div className="spin-stage" data-testid="spin-wheel">
              <div className="spin-pointer" aria-hidden />
              <div className="spin-wheel-rim">
                {/* rim lamps */}
                {Array.from({ length: SLICE_N * 2 }).map((_, i) => (
                  <span key={i} className={`spin-lamp ${spinning ? 'lit' : ''}`}
                        style={{ transform: `rotate(${(i / (SLICE_N * 2)) * 360}deg) translateY(-92px)`, animationDelay: `${i * 0.06}s` }} />
                ))}
                <div
                  className="spin-wheel-face"
                  style={{
                    transform: `rotate(${spinAngle}deg)`,
                    background: `conic-gradient(${SPIN_WHEEL_SLICES.map((s, i) => {
                      const from = i * SLICE_DEG, to = (i + 1) * SLICE_DEG;
                      const c = s.type === 'jackpot' ? '#4a2c00'
                        : s.type === 'gems' ? '#0e3340'
                        : s.type === 'gold' ? '#3a2a08'
                        : s.type === 'sp' ? '#241a3a'
                        : i % 2 ? '#1a1228' : '#120c1e';
                      return `${c} ${from}deg ${to}deg`;
                    }).join(', ')})`,
                  }}
                >
                  {/* spokes */}
                  {SPIN_WHEEL_SLICES.map((s, i) => (
                    <span key={`sp-${s.id}`} className="spin-spoke" style={{ transform: `rotate(${i * SLICE_DEG}deg)` }} />
                  ))}
                  {/* slice contents, centred in each wedge and kept upright */}
                  {SPIN_WHEEL_SLICES.map((s, i) => (
                    <div
                      key={s.id}
                      className={`spin-slice ${winIdx === i && !spinning && spinResult ? 'won' : ''} ${s.type === 'jackpot' ? 'jackpot' : ''}`}
                      style={{ transform: `rotate(${(i + 0.5) * SLICE_DEG}deg)` }}
                    >
                      <span className="spin-slice-inner" style={{ transform: `rotate(${-(i + 0.5) * SLICE_DEG}deg)` }}>
                        <GameIcon name={s.type === 'jackpot' ? 'jackpot' : s.type} size={22} />
                        <span className="spin-slice-amt">
                          {s.type === 'jackpot' ? 'JACKPOT' : s.amount}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="spin-wheel-hub"><GameIcon name="ui_token" size={20} /></div>
              </div>
            </div>
            <button
              onClick={doSpin}
              disabled={!canSpin || spinning}
              data-testid="spin-btn"
              className="claim-burst"
              style={{ width: '100%', marginTop: 8 }}
            >
              {spinning ? 'Spinning…' : canSpin ? '▸ SPIN THE WHEEL' : '✓ Spun Today'}
            </button>
            {spinResult && !spinning && (
              <div className={`spin-result ${spinResult.type === 'jackpot' ? 'jackpot' : ''}`} data-testid="spin-result">
                <span className="spin-result-icon">
                  <GameIcon name={spinResult.type === 'jackpot' ? 'jackpot' : spinResult.type} size={30} />
                </span>
                <span className="spin-result-label">
                  {spinResult.type === 'jackpot' ? 'JACKPOT — 1500★ + 10 Gems' : spinResult.label}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="welcome-actions">
          <button onClick={onCamp} data-testid="welcome-camp"><GameIcon name="ui_base" size={15} /> The Camp</button>
          <button onClick={onContinue} data-testid="welcome-fight"
            style={{ borderColor: '#ff7a1a', boxShadow: 'var(--pixel-edge), 0 6px 0 #000, 0 0 28px #ff7a1a66' }}>
            ▸ ENTER THE LAKE
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
      {badgesOpen && <BadgePicker save={save} setSave={setSave} onClose={() => setBadgesOpen(false)} />}
    </div>
  );
}
