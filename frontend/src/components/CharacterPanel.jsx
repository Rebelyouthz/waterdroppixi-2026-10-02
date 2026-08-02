import React, { useState } from 'react';
import { CHAR_RARITIES, CHAR_RARITY_COLORS, CHAR_RARITY_NAMES, CHAR_SLOTS_BY_RARITY, CHAR_LEVEL_COST, CHAR_EVOLVE_COST, CHAR_MAX_LEVELS, charLevelStat } from '../game/data_ext2';
import { POE_ATTRS } from '../game/poe_tree';
import { Audio } from '../game/audio';

function availableAttrPoints(save) {
  const earned = Math.max(0, (save.profile?.level || 1) - 1);
  const spent = Object.values(save.attrs || {}).reduce((a, b) => a + b, 0);
  return earned - spent;
}

export default function CharacterPanel({ save, setSave, onClose }) {
  const [popAnim, setPopAnim] = useState(false);
  const char = save.character || { rarity: 'common', level: 0, pieces: 0, shards: 0 };
  const attrs = save.attrs || {};
  const freeAttr = availableAttrPoints(save);
  const rarIdx = CHAR_RARITIES.indexOf(char.rarity);
  const rarColor = CHAR_RARITY_COLORS[char.rarity];
  const slots = CHAR_SLOTS_BY_RARITY[char.rarity];
  const MAX_LVL = CHAR_MAX_LEVELS[char.rarity] || 5;

  const levelCost = char.level < MAX_LVL ? CHAR_LEVEL_COST(char.rarity, char.level) : null;
  const evolveReq = rarIdx < CHAR_RARITIES.length - 1 ? CHAR_EVOLVE_COST[char.rarity] : null;
  const canEvolve = char.level >= MAX_LVL && evolveReq;

  const canLvl = levelCost && (save.gold || 0) >= levelCost.gold && char.pieces >= levelCost.pieces;
  const canEvo = canEvolve && char.shards >= (evolveReq?.shards || 0);

  const pop = () => { setPopAnim(true); setTimeout(() => setPopAnim(false), 600); };

  const levelUp = () => {
    if (!canLvl) return;
    const st = charLevelStat(char.level, char.rarity);
    const newLevel = char.level + 1;
    const ns = {
      ...save,
      gold: save.gold - levelCost.gold,
      character: { ...char, level: newLevel, pieces: char.pieces - levelCost.pieces },
      charBonuses: { ...(save.charBonuses || {}), [st.stat]: ((save.charBonuses || {})[st.stat] || 0) + st.val },
    };
    // At max level, auto-grant the shard needed for rarity upgrade
    if (newLevel >= MAX_LVL && evolveReq) {
      ns.character.shards = (char.shards || 0) + evolveReq.shards;
    }
    setSave(ns); Audio.levelUp(); pop();
  };

  const evolve = () => {
    if (!canEvo) return;
    const newRar = CHAR_RARITIES[rarIdx + 1];
    setSave({ ...save, character: { ...char, rarity: newRar, level: 0, shards: char.shards - evolveReq.shards } });
    Audio.levelUp(); Audio.claimPing(); pop();
  };

  // ── Attributes ──────────────────────────────────
  const buyAttr = (attrId) => {
    if (freeAttr <= 0) return;
    const cur = attrs[attrId] || 0;
    setSave({ ...save, attrs: { ...save.attrs, [attrId]: cur + 1 } });
    Audio?.click?.();
  };

  // Collect all bonuses gained so far
  const earned = (save.charBonuses || {});

  return (
    <div className="modal-overlay" data-testid="char-panel" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className={`forge-panel char-panel ${popAnim ? 'card-pop' : ''}`} style={{ maxWidth: 560 }}>
        <div className="forge-header">
          <div className="forge-title" style={{ color: rarColor }}>CHARACTER</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        {/* Rarity evolution path */}
        <div className="char-rar-bar">
          {CHAR_RARITIES.map((r, i) => (
            <div key={r} className="char-rar-step" style={{
              background: i < rarIdx ? CHAR_RARITY_COLORS[r] + '44' : i === rarIdx ? CHAR_RARITY_COLORS[r] : '#1a1226',
              border: i === rarIdx ? `2px solid ${CHAR_RARITY_COLORS[r]}` : '2px solid #ffffff11',
              boxShadow: i === rarIdx ? `0 0 14px ${CHAR_RARITY_COLORS[r]}88` : 'none',
            }} title={CHAR_RARITY_NAMES[r]}>
              {i < rarIdx && '✓'}
              {i === rarIdx && <span style={{ fontFamily: 'VT323', fontSize: 11, color: CHAR_RARITY_COLORS[r] }}>{CHAR_RARITY_NAMES[r].slice(0,3).toUpperCase()}</span>}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: 'VT323', fontSize: 22, color: rarColor, letterSpacing: '0.3em' }}>
            {CHAR_RARITY_NAMES[char.rarity]} — Lv {char.level}/{MAX_LVL}
          </div>
          <div className="char-lvl-bar"><div className="char-lvl-fill" style={{ width: (char.level / MAX_LVL * 100) + '%', background: rarColor }} /></div>
        </div>

        {/* Slot unlock info */}
        <div className="char-slot-badge" style={{ borderColor: rarColor, color: rarColor }}>
          ⚔️ {slots} weapons · 🧠 {slots} skills active simultaneously
        </div>

        {/* Currency row */}
        <div className="char-currency">
          <span>🔷 {char.pieces} <span style={{ color: 'var(--ink-dim)', fontSize: 11 }}>pieces</span></span>
          <span>💎 {char.shards} <span style={{ color: 'var(--ink-dim)', fontSize: 11 }}>shards</span></span>
        </div>

        {/* Next stat preview */}
        {char.level < MAX_LVL && (() => {
          const st = charLevelStat(char.level, char.rarity);
          const display = st.isPct ? `+${Math.round(st.val * 100)}%` : `+${st.val}`;
          return <div className="char-next-stat">{st.icon} Next: {display} {st.label}</div>;
        })()}

        {/* Level up button */}
        {char.level < MAX_LVL && levelCost && (
          <button className={`char-btn ${canLvl ? '' : 'disabled'}`} onClick={levelUp} disabled={!canLvl}
            style={{ borderColor: rarColor, boxShadow: canLvl ? `0 0 12px ${rarColor}44` : 'none' }}>
            LEVEL UP — ★ {levelCost.gold} + 🔷 {levelCost.pieces}
          </button>
        )}

        {/* Evolve button */}
        {canEvolve && evolveReq && (
          <button className={`char-btn evolve ${canEvo ? '' : 'disabled'}`} onClick={evolve} disabled={!canEvo}
            style={{ borderColor: CHAR_RARITY_COLORS[CHAR_RARITIES[rarIdx + 1]], marginTop: 8 }}>
            ✨ EVOLVE → {CHAR_RARITY_NAMES[CHAR_RARITIES[rarIdx + 1]]} — 💎 {evolveReq.shards} shards
          </button>
        )}
        {char.level >= MAX_LVL && !canEvolve && (
          <div style={{ textAlign: 'center', color: '#ff3146', fontFamily: 'VT323', letterSpacing: '0.2em', marginTop: 12 }}>MAX RARITY REACHED — MYTHICAL</div>
        )}

        {/* Bonuses earned */}
        {Object.keys(earned).length > 0 && (
          <div className="char-bonuses">
            <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', fontSize: 13, letterSpacing: '0.2em', marginBottom: 6 }}>BONUSES EARNED</div>
            {Object.entries(earned).map(([k, v]) => (
              <div key={k} style={{ fontFamily: 'VT323', color: 'var(--rune)', fontSize: 14 }}>
                {k === 'maxHp' ? `❤️ +${v} Max HP` : `+${Math.round(v * 100)}% ${k}`}
              </div>
            ))}
          </div>
        )}

        {/* Attributes — moved here from the Skill Tree per player feedback */}
        <div className="char-attr-section" data-testid="char-attr-section">
          <div className="char-attr-header">
            <span>⚡ ATTRIBUTES</span>
            <span className={`char-attr-free ${freeAttr > 0 ? 'has' : ''}`}>{freeAttr} point{freeAttr === 1 ? '' : 's'} free</span>
          </div>
          <div className="char-attr-desc">Earned 1 per profile level (RANK). Permanent bonuses.</div>
          <div className="poe-attr-grid">
            {POE_ATTRS.map(a => {
              const cur = attrs[a.id] || 0;
              const canAdd = freeAttr > 0;
              return (
                <div key={a.id} className="poe-attr-row" data-testid={`attr-${a.id}`}>
                  <span className="poe-attr-icon" style={{ color: a.color }}>{a.icon}</span>
                  <div className="poe-attr-info">
                    <span className="poe-attr-name">{a.name}</span>
                    <span className="poe-attr-desc2">{a.desc}</span>
                  </div>
                  <div className="poe-attr-ctl">
                    <span className="poe-attr-val">{cur}</span>
                    <button
                      className={`poe-attr-add ${canAdd ? '' : 'disabled'}`}
                      onClick={() => buyAttr(a.id)}
                      disabled={!canAdd}
                      data-testid={`attr-add-${a.id}`}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rarity comparison */}
        <div className="char-rar-table" style={{ marginTop: 16 }}>
          {CHAR_RARITIES.map((r, i) => (
            <div key={r} className={`char-rar-row ${r === char.rarity ? 'cur' : ''}`}
              style={{ borderLeftColor: i <= rarIdx ? CHAR_RARITY_COLORS[r] : '#ffffff11', opacity: i > rarIdx ? 0.5 : 1 }}>
              <span style={{ color: CHAR_RARITY_COLORS[r], width: 80 }}>{CHAR_RARITY_NAMES[r]}</span>
              <span style={{ color: 'var(--ink-dim)' }}>{CHAR_SLOTS_BY_RARITY[r]} weapons + {CHAR_SLOTS_BY_RARITY[r]} skills</span>
              {i <= rarIdx && <span style={{ color: '#4dffd4', marginLeft: 'auto' }}>✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
