import React, { useState } from 'react';
import { CAMPAIGN_QUESTS } from '../game/data_ext2';
import { applyReward } from '../store';
import { Audio } from '../game/audio';

export default function CampaignPanel({ save, setSave }) {
  const [pop, setPop] = useState(null);
  const campaign = save.campaign || {};

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
