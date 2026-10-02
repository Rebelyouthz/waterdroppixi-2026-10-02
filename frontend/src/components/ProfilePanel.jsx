import React, { useState } from 'react';
import { AVATARS, getRank, RANK_TITLES, MAX_RANK, PROFILE_FRAMES, HEADBANDS, NAME_COLORS, SHIP_COLORS, CIGAR_UNLOCK_RANK, STATION_VISTAS } from '../game/data_ext';
import { Audio } from '../game/audio';
import BadgeIcon from './BadgeIcon';
import GameIcon from './GameIcon';
import { BadgePicker } from './BadgeSlots';
import { BADGES, equippedBadges, isEarned } from '../game/badges';

// Clicking the avatar/name in Camp's sidebar opens this — avatar/name
// editing (previously only settable once, at first-run onboarding) plus
// the full rank ladder and every cosmetic unlocked so far.
export default function ProfilePanel({ save, setSave, onClose, onBadges }) {
  const [nameEdit, setNameEdit] = useState(save.profile.name || '');
  const [ownPicker, setOwnPicker] = useState(false);
  const eq = equippedBadges(save);
  const earnedCount = BADGES.filter(b => isEarned(save, b.id)).length;
  // The camp hands down an `onBadges` that swaps this panel for the picker.
  // Opened from anywhere else (or by a future caller that does not pass one)
  // the panel owns its own picker rather than the button doing nothing.
  const openBadges = () => { Audio.click(); if (onBadges) onBadges(); else setOwnPicker(true); };
  const level = save.profile?.level || 1;
  const rank = getRank(level);
  const nextRankLevel = Math.min(100, (rank + 1) * 4);
  const rankProgress = rank >= MAX_RANK ? 1 : Math.min(1, (level % 4) / 4);

  const setAvatar = (id) => setSave({ ...save, profile: { ...save.profile, avatar: id } });
  const saveName = () => {
    const n = nameEdit.trim().slice(0, 16);
    if (n) setSave({ ...save, profile: { ...save.profile, name: n } });
  };
  const pick = (key, id) => { setSave({ ...save, profile: { ...save.profile, [key]: id } }); Audio.click(); };
  const toggleCigar = () => { setSave({ ...save, profile: { ...save.profile, cigarOn: !save.profile.cigarOn } }); Audio.click(); };

  const Row = ({ title, items, current, onPick }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: 'VT323', fontSize: 13, color: 'var(--accent-2)', letterSpacing: '0.15em', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map(it => {
          const unlocked = rank >= it.rank;
          const active = current === it.id;
          return (
            <button
              key={it.id}
              onClick={() => unlocked && onPick(it.id)}
              disabled={!unlocked}
              data-testid={`profile-pick-${it.id}`}
              style={{
                fontSize: 11, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                opacity: unlocked ? 1 : 0.35,
                borderColor: active ? (it.color && it.color !== 'rainbow' ? it.color : 'var(--rune)') : undefined,
                boxShadow: active ? `0 0 10px ${it.color && it.color !== 'rainbow' ? it.color : 'var(--rune)'}88` : 'none',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                background: it.color === 'rainbow' ? 'linear-gradient(90deg,#ff3146,#ffd166,#4dffd4,#4dc4ff,#b362ff)' : (it.color || 'transparent'),
                border: it.css || (it.color ? 'none' : '2px dashed #555'),
                boxShadow: it.glow || 'none',
              }} />
              <span>{it.name}</span>
              {!unlocked && <span style={{ color: '#ff5566' }}>Rank {it.rank}</span>}
              {active && <span style={{ color: 'var(--rune)' }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" data-testid="profile-panel" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel forge-panel-scrollable profile-panel" style={{ maxWidth: 560 }}>
        <div className="forge-header">
          <div className="forge-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GameIcon name="ui_character" size={16} /> PROFILE</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ filter: 'drop-shadow(0 0 10px #4dffd499)', display: 'flex', justifyContent: 'center' }}>
            <GameIcon name={AVATARS.find(a => a.id === save.profile.avatar)?.icon || 'ui_waterdrop'} size={46} />
          </div>
          <div style={{ fontFamily: 'VT323', fontSize: 15, color: 'var(--rune)', letterSpacing: '0.2em', marginTop: 4 }}>
            RANK {rank} — {RANK_TITLES[rank]}
          </div>
          <div className="camp-rank-bar" style={{ maxWidth: 260, margin: '6px auto' }}>
            <div className="camp-rank-fill" style={{ width: `${rankProgress * 100}%` }} />
            <span className="camp-rank-bar-label">{rank >= MAX_RANK ? 'MAX RANK' : `Lv ${level} → Lv ${nextRankLevel}`}</span>
          </div>

          {/* Badges get their own row above the cosmetics rather than being a
              sixth cosmetic option — a frame colour and a proof of clearing
              Nightmare are not the same kind of thing, and putting them in one
              list would say they are. */}
          <div className="profile-badge-row">
            <div className="profile-badge-head">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="ui_medal" size={14} /> BADGES</span>
              <span className="profile-badge-count">{earnedCount}/{BADGES.length} earned</span>
            </div>
            <div className="profile-badge-slots">
              {eq.map((b, i) => (
                <button key={i} className={`profile-badge-slot${b ? ' filled' : ''}`}
                  data-testid={`profile-badge-${i}`} onClick={openBadges} title={b ? `${b.name} — ${b.desc}` : 'Empty slot'}>
                  <BadgeIcon badge={b} size={44} />
                  <span>{b ? b.name : 'Empty'}</span>
                </button>
              ))}
            </div>
            <button className="profile-badge-manage" onClick={openBadges} data-testid="profile-open-badges">
              MANAGE BADGES ▸
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={nameEdit}
            onChange={(e) => setNameEdit(e.target.value)}
            onBlur={saveName}
            maxLength={16}
            placeholder="Your name"
            data-testid="profile-name-input"
            style={{ flex: 1, fontFamily: 'VT323', fontSize: 15, padding: '8px 10px', background: '#0a0420', border: '2px solid #2a1a4e', color: 'var(--ink)' }}
          />
        </div>

        <Row title="AVATAR" items={AVATARS.map(a => ({ id: a.id, name: a.name, rank: 0, color: null }))} current={save.profile.avatar} onPick={setAvatar} />
        <Row title="PROFILE FRAME" items={PROFILE_FRAMES} current={save.profile.frame} onPick={(id) => pick('frame', id)} />
        <Row title="NAME COLOR" items={NAME_COLORS} current={save.profile.nameColor} onPick={(id) => pick('nameColor', id)} />
        <Row title="HEADBAND" items={HEADBANDS} current={save.profile.headband} onPick={(id) => pick('headband', id)} />
        <Row title="SHIP COLOR (Star Raid)" items={SHIP_COLORS} current={save.profile.shipColor} onPick={(id) => pick('shipColor', id)} />

        {/* 5 Choosable Station Bay Window Panoramic Vistas */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'VT323', fontSize: 13, color: 'var(--accent-2)', letterSpacing: '0.15em', marginBottom: 6 }}>
            ORBITAL VISTA BAY WINDOW (5 THEMES)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
            {STATION_VISTAS.map(v => {
              const active = (save.profile.stationVista || 'earth') === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => pick('stationVista', v.id)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 6,
                    overflow: 'hidden',
                    border: active ? `2px solid ${v.color}` : '1px solid #2a1a4e',
                    boxShadow: active ? `0 0 10px ${v.color}88` : 'none',
                    background: '#0a0420',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: '100%',
                      height: 48,
                      background: `radial-gradient(circle at 50% 70%, ${v.color}66, #05020e 70%)`,
                    }}
                  />
                  <div style={{ padding: '3px 4px', textAlign: 'center', background: 'rgba(5,2,14,0.9)' }}>
                    <div style={{ fontFamily: 'VT323', fontSize: 12, color: active ? v.color : '#e0d8c0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.name} {active && '✓'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: 'VT323', fontSize: 13, color: 'var(--accent-2)', letterSpacing: '0.15em', marginBottom: 6 }}>IDLE CIGAR</div>
          {rank >= CIGAR_UNLOCK_RANK ? (
            <button onClick={toggleCigar} data-testid="profile-cigar-toggle" style={{ fontSize: 12, padding: '6px 12px' }}>
              {save.profile.cigarOn ? 'ON — smoking when idle' : 'OFF — click to enable'}
            </button>
          ) : (
            <div style={{ color: '#ff5566', fontFamily: 'VT323', fontSize: 12 }}>Unlocks at Rank {CIGAR_UNLOCK_RANK}</div>
          )}
        </div>
      </div>
      {ownPicker && <BadgePicker save={save} setSave={setSave} onClose={() => setOwnPicker(false)} />}
    </div>
  );
}
