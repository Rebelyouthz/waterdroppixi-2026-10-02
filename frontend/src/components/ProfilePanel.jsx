import React, { useState } from 'react';
import { AVATARS, getRank, RANK_TITLES, MAX_RANK, PROFILE_FRAMES, HEADBANDS, NAME_COLORS, SHIP_COLORS, CIGAR_UNLOCK_RANK } from '../game/data_ext';
import { Audio } from '../game/audio';

// Clicking the avatar/name in Camp's sidebar opens this — avatar/name
// editing (previously only settable once, at first-run onboarding) plus
// the full rank ladder and every cosmetic unlocked so far.
export default function ProfilePanel({ save, setSave, onClose }) {
  const [nameEdit, setNameEdit] = useState(save.profile.name || '');
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
      <div className="forge-panel forge-panel-scrollable" style={{ maxWidth: 560 }}>
        <div className="forge-header">
          <div className="forge-title">👤 PROFILE</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 46, filter: 'drop-shadow(0 0 10px #4dffd499)' }}>
            {AVATARS.find(a => a.id === save.profile.avatar)?.icon || '💧'}
          </div>
          <div style={{ fontFamily: 'VT323', fontSize: 15, color: 'var(--rune)', letterSpacing: '0.2em', marginTop: 4 }}>
            RANK {rank} — {RANK_TITLES[rank]}
          </div>
          <div className="camp-rank-bar" style={{ maxWidth: 260, margin: '6px auto' }}>
            <div className="camp-rank-fill" style={{ width: `${rankProgress * 100}%` }} />
            <span className="camp-rank-bar-label">{rank >= MAX_RANK ? 'MAX RANK' : `Lv ${level} → Lv ${nextRankLevel}`}</span>
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

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: 'VT323', fontSize: 13, color: 'var(--accent-2)', letterSpacing: '0.15em', marginBottom: 6 }}>IDLE CIGAR</div>
          {rank >= CIGAR_UNLOCK_RANK ? (
            <button onClick={toggleCigar} data-testid="profile-cigar-toggle" style={{ fontSize: 12, padding: '6px 12px' }}>
              {save.profile.cigarOn ? '🚬 ON — smoking when idle' : 'OFF — click to enable'}
            </button>
          ) : (
            <div style={{ color: '#ff5566', fontFamily: 'VT323', fontSize: 12 }}>Unlocks at Rank {CIGAR_UNLOCK_RANK}</div>
          )}
        </div>
      </div>
    </div>
  );
}
