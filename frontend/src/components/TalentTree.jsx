import React, { useState } from 'react';
import { TALENT_NODES } from '../game/data_ext2';
import { Audio } from '../game/audio';

export default function TalentTree({ save, setSave, onClose }) {
  const [popNode, setPopNode] = useState(null);
  const talent = save.talent || {};
  const tp = save.talentPoints || 0;

  const getLevel = (id) => talent[id] || 0;

  const canBuy = (node, idx) => {
    const lvl = getLevel(node.id);
    if (lvl >= node.maxLvl) return false;
    if (tp < node.costPerLvl) return false;
    if (idx === 0) return true;
    return getLevel(TALENT_NODES[idx - 1].id) >= 1;
  };

  const buy = (node, idx) => {
    if (!canBuy(node, idx)) return;
    const curLvl = getLevel(node.id);
    const tb = { ...(save.talentBonuses || {}) };
    if (node.stat === 'all') {
      ['maxHp', 'dmg', 'mspd', 'gold', 'xp', 'crit'].forEach(s => {
        tb[s] = (tb[s] || 0) + node.val;
      });
    } else {
      tb[node.stat] = (tb[node.stat] || 0) + node.val;
    }
    setSave({
      ...save,
      talentPoints: tp - node.costPerLvl,
      talent: { ...talent, [node.id]: curLvl + 1 },
      talentBonuses: tb,
    });
    Audio.click();
    setPopNode(node.id);
    setTimeout(() => setPopNode(null), 600);
  };

  const totalLevels = Object.values(talent).reduce((a, b) => a + (b || 0), 0);
  const maxPossible = TALENT_NODES.reduce((a, n) => a + n.maxLvl, 0);

  const fmt = (node, lvl) => {
    if (lvl === 0) return node.stat === 'all' ? '+all/lvl' : '';
    if (node.stat === 'all') return `+all ×${lvl}`;
    if (['maxHp', 'armor'].includes(node.stat)) return `+${(node.val * lvl).toFixed(1)}`;
    return `+${(node.val * lvl * 100).toFixed(1)}%`;
  };

  return (
    <div className="modal-overlay" data-testid="talent-tree" onClick={(e) => {
      if (e.target.classList.contains('modal-overlay')) onClose();
    }}>
      <div className="forge-panel" style={{ maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="forge-header">
          <div className="forge-title">🌿 TALENT TREE</div>
          <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', fontSize: 14, marginRight: 8 }}>
            {totalLevels}/{maxPossible} · 🌿 <span style={{ color: '#4dff91' }}>{tp} TP</span>
          </div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        <div style={{ padding: '6px 12px', background: '#060410', borderBottom: '1px solid #1a0a2e', fontSize: 12, color: 'var(--ink-dim)', letterSpacing: '0.1em' }}>
          Each node has 10 levels. Earn 🌿 TP by completing runs (+5 per run).
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 6px' }}>
          <div className="talent-grid">
            {TALENT_NODES.map((node, idx) => {
              const lvl = getLevel(node.id);
              const maxed = lvl >= node.maxLvl;
              const available = canBuy(node, idx);
              const locked = !maxed && !available;
              const prevHasLvl = idx === 0 || getLevel(TALENT_NODES[idx - 1].id) >= 1;
              const pct = (lvl / node.maxLvl) * 100;

              return (
                <div
                  key={node.id}
                  className={[
                    'talent-node',
                    maxed ? 'bought' : '',
                    available ? 'available' : '',
                    locked ? 'locked' : '',
                    node.milestone ? 'milestone' : '',
                    popNode === node.id ? 'card-pop' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => buy(node, idx)}
                  data-testid={`talent-${node.id}`}
                >
                  {idx > 0 && (
                    <div className={`talent-line ${prevHasLvl ? 'lit' : ''}`} />
                  )}
                  <div className="talent-icon">{node.icon}</div>
                  <div className="talent-name">{node.name}</div>

                  {/* Level progress bar */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, margin:'3px 0' }}>
                    <div style={{ flex:1, height:4, background:'#1a0a2e', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background: maxed ? '#ffd700' : '#4dff91', transition:'width 0.3s' }} />
                    </div>
                    <span style={{ fontFamily:'VT323', fontSize:12, color: maxed ? '#ffd700' : 'var(--ink-dim)', minWidth:28 }}>
                      {lvl}/{node.maxLvl}
                    </span>
                  </div>

                  <div className="talent-stat" style={{ fontSize:11, color: lvl > 0 ? '#4dffd4' : 'var(--ink-dim)' }}>
                    {fmt(node, lvl) || `+${node.val}${['maxHp','armor'].includes(node.stat) ? '' : '%'}/lvl`}
                  </div>

                  {!maxed && available && (
                    <div className="talent-cost" style={{ color: tp >= node.costPerLvl ? '#4dff91' : '#ff4444' }}>
                      🌿 {node.costPerLvl} TP
                    </div>
                  )}
                  {maxed && <div className="talent-done" style={{ color:'#ffd700', fontSize:11 }}>MAX ★</div>}
                  {locked && <div className="talent-locked">🔒</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
