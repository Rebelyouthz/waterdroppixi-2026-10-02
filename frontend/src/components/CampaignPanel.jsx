import React, { useState } from 'react';
import { CAMPAIGN_QUESTS, STORY_BEATS } from '../game/data_ext2';
import { applyReward } from '../store';
import { Audio } from '../game/audio';

export default function CampaignPanel({ save, setSave }) {
  const [pop, setPop] = useState(null);
  const [storyOpen, setStoryOpen] = useState(null);
  const campaign = save.campaign || {};
  const unlockedBeats = STORY_BEATS.filter(b => b.check(save));

  const claim = (q) => {
    if (!q.check(save) || campaign[q.id]) return;
    const ns = { ...save, campaign: { ...campaign, [q.id]: true } };
    applyReward(ns, q.rwd, null);
    setSave(ns);
    Audio.claimPing();
    setPop(q.id);
    setTimeout(() => setPop(null), 600);
  };

  const done = CAMPAIGN_QUESTS.filter(q => campaign[q.id]).length;

  return (
    <>
      <div className="camp-header">
        <h1>Campaign</h1>
        <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', fontSize: 16 }}>{done}/{CAMPAIGN_QUESTS.length} completed</div>
      </div>

      <div style={{ fontFamily: 'VT323', color: 'var(--accent-2)', letterSpacing: '0.15em', fontSize: 14, margin: '4px 0 8px' }}>
        📖 STORY — {unlockedBeats.length}/{STORY_BEATS.length} entries
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {STORY_BEATS.map(b => {
          const unlocked = b.check(save);
          const open = storyOpen === b.id;
          return (
            <div key={b.id}
              onClick={() => unlocked && setStoryOpen(open ? null : b.id)}
              data-testid={`story-${b.id}`}
              style={{
                background: '#0a0612', border: `1px solid ${unlocked ? '#4dffd455' : '#1a0a2e'}`,
                borderRadius: 4, padding: '8px 12px', cursor: unlocked ? 'pointer' : 'default',
                opacity: unlocked ? 1 : 0.5,
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'VT323', fontSize: 14, color: unlocked ? 'var(--ink)' : '#555' }}>
                <span>{unlocked ? b.title : '??? Locked Entry'}</span>
                {unlocked && <span style={{ color: 'var(--rune)' }}>{open ? '▲' : '▼'}</span>}
              </div>
              {unlocked && open && (
                <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', fontSize: 13, marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>
                  "{b.text}"
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: 'VT323', color: 'var(--accent-2)', letterSpacing: '0.15em', fontSize: 14, margin: '4px 0 8px' }}>🎯 QUESTS</div>
      <div className="upgrade-grid">
        {CAMPAIGN_QUESTS.map(q => {
          const ready = q.check(save);
          const claimed = !!campaign[q.id];
          return (
            <div key={q.id} className={`upgrade-card ${claimed ? 'maxed' : ''} ${pop === q.id ? 'card-pop' : ''}`} data-testid={`cq-${q.id}`}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{q.icon}</span>
                <div className="name" style={{ fontSize: 14 }}>{q.name}</div>
              </div>
              <div className="desc">{q.desc}</div>
              <div style={{ fontSize: 12, color: 'var(--accent-2)', marginTop: 6 }}>
                {q.rwd.gold && `★ ${q.rwd.gold} Gold`}{q.rwd.gold && q.rwd.sp ? '  ' : ''}{q.rwd.sp && `◆ ${q.rwd.sp} SP`}
              </div>
              {claimed
                ? <div style={{ color: 'var(--rune)', fontFamily: 'VT323', letterSpacing: '0.2em', marginTop: 8 }}>✓ CLAIMED</div>
                : <button onClick={() => claim(q)} disabled={!ready} style={{ marginTop: 8 }}>{ready ? '✓ CLAIM' : 'IN PROGRESS'}</button>}
            </div>
          );
        })}
      </div>
    </>
  );
}
