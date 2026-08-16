// Mission reward reveal modal — used after completing a daily mission.
import React, { useEffect } from 'react';
import { PART_RARITY_COLORS } from '../game/data_ext2';
import { STARTER_WEAPONS } from '../game/data_ext2';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

export default function MissionReveal({ rewards, onClose }) {
  useEffect(() => { Audio.levelUp(); }, []);
  return (
    <div className="modal-overlay" data-testid="mission-reveal">
      <div className="forge-panel mission-panel" style={{ maxWidth: 620, textAlign: 'center' }}>
        <div className="forge-title" style={{ fontSize: 28 }}>✓ MISSION COMPLETE</div>
        <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', letterSpacing: '0.3em', margin: '10px 0' }}>REWARDS</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', margin: '14px 0' }}>
          {rewards.gold > 0 && (
            <div className="reveal-cell">
              <div style={{ fontSize: 38, display: 'flex', justifyContent: 'center' }}><GameIcon name="gold" size={36} /></div>
              <div style={{ color: 'var(--accent-2)', fontSize: 22 }}>★ {rewards.gold}</div>
            </div>
          )}
          {Object.entries(rewards.blueprintShards || {}).map(([id, n]) => (
            <div className="reveal-cell" key={id}>
              <div style={{ fontSize: 38, display: 'flex', justifyContent: 'center' }}><GameIcon name="ui_scroll" size={36} /></div>
              <div style={{ fontSize: 12 }}>{STARTER_WEAPONS[id] ? STARTER_WEAPONS[id].name : id}</div>
              <div style={{ color: 'var(--rune)' }}>+{n} shards</div>
            </div>
          ))}
          {(rewards.parts || []).map(p => (
            <div className="reveal-cell" key={p.id} style={{ borderColor: PART_RARITY_COLORS[p.rarity] }}>
              <div style={{ fontSize: 30, display: 'flex', justifyContent: 'center' }}>
                <GameIcon name={{ barrel: 'part_barrel', magazine: 'part_magazine', sight: 'part_sight', muzzle: 'part_muzzle', stock: 'part_stock', bullets: 'part_bullets' }[p.slot] || 'part_grip'} size={28} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: PART_RARITY_COLORS[p.rarity], letterSpacing: '0.15em' }}>{p.rarity.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} data-testid="reveal-close" style={{ width: '100%', marginTop: 18 }}>CONTINUE</button>
      </div>
    </div>
  );
}
