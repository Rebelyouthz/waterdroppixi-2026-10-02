import React, { useState } from 'react';
import { CHAR_RARITIES, CHAR_RARITY_COLORS, CHAR_RARITY_NAMES, CHAR_SLOTS_BY_RARITY, CHAR_LEVEL_COST, CHAR_EVOLVE_COST, CHAR_MAX_LEVELS, charLevelStat, characterSlots } from '../game/data_ext2';
import { Audio } from '../game/audio';
import HeroFigure from './HeroFigure';
import GameIcon from './GameIcon';
import { fireClaimFx, CAMP_CLAIM_FLY } from './ClaimFx';

/* Which portrait the Character screen shows: the 16-frame idle sprite, or the
 * hand-built SVG drop. One word, so switching back costs nothing and neither
 * version has to be deleted to try the other. */
const PORTRAIT = 'hardcoded';   // 'sprite' | 'hardcoded' — character is never a sprite

export default function CharacterPanel({ save, setSave, onClose }) {
  const [popAnim, setPopAnim] = useState(false);
  const char = save.character || { rarity: 'common', level: 0, pieces: 0, shards: 0 };
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

  const levelUp = (e) => {
    const st = charLevelStat(char.level, char.rarity);
    let paid = false;
    setSave((s) => {
      const ch = s.character || { rarity: 'common', level: 0, pieces: 0, shards: 0 };
      const max = CHAR_MAX_LEVELS[ch.rarity] || 5;
      const cost = ch.level < max ? CHAR_LEVEL_COST(ch.rarity, ch.level) : null;
      if (!cost || (s.gold || 0) < cost.gold || (ch.pieces || 0) < cost.pieces) return s;
      const newLevel = ch.level + 1;
      const evo = CHAR_RARITIES.indexOf(ch.rarity) < CHAR_RARITIES.length - 1
        ? CHAR_EVOLVE_COST[ch.rarity] : null;
      paid = true;
      return {
        ...s,
        gold: (s.gold || 0) - cost.gold,
        character: {
          ...ch,
          level: newLevel,
          pieces: ch.pieces - cost.pieces,
          shards: (newLevel >= max && evo) ? (ch.shards || 0) + evo.shards : ch.shards,
        },
        charBonuses: { ...(s.charBonuses || {}), [st.stat]: ((s.charBonuses || {})[st.stat] || 0) + st.val },
      };
    });
    if (!paid) return;
    fireClaimFx(e?.currentTarget, null, {
      items: [{ key: st.stat, icon: st.icon, amount: st.isPct ? Math.round(st.val * 100) + '%' : st.val }],
      flyTo: CAMP_CLAIM_FLY,
    });
    Audio.click('buy'); Audio.levelUp(); pop();
  };

  const evolve = (e) => {
    let paid = false;
    let nextName = '';
    setSave((s) => {
      const ch = s.character || { rarity: 'common', level: 0, pieces: 0, shards: 0 };
      const idx = CHAR_RARITIES.indexOf(ch.rarity);
      const max = CHAR_MAX_LEVELS[ch.rarity] || 5;
      const evo = idx < CHAR_RARITIES.length - 1 ? CHAR_EVOLVE_COST[ch.rarity] : null;
      if (!evo || ch.level < max || (ch.shards || 0) < evo.shards) return s;
      const newRar = CHAR_RARITIES[idx + 1];
      nextName = CHAR_RARITY_NAMES[newRar];
      paid = true;
      return { ...s, character: { ...ch, rarity: newRar, level: 0, shards: ch.shards - evo.shards } };
    });
    if (!paid) return;
    fireClaimFx(e?.currentTarget, null, {
      items: [{ key: 'evo', icon: 'ui_star', amount: nextName }],
      flyTo: CAMP_CLAIM_FLY,
    });
    Audio.click('confirm'); Audio.levelUp(); pop();
  };

  // Collect all bonuses gained so far
  const earned = (save.charBonuses || {});

  // One shared rule (data_ext2's characterSlots) rather than a second copy of
  // the table — this panel only draws what the engine will actually run on.
  const sl = characterSlots(char.rarity, char.level);
  const curWeapons = sl.slots;
  const curSkills = sl.skillSlots;
  // The nearest level that opens EITHER slot type. Weapons come first (50% of
  // the rarity's levels), actives second (80%), so whichever is still ahead of
  // the current level is the one to name.
  //
  // Gated on `sl.cap > sl.floor` because Common has nothing below it — its
  // floor IS its cap, so no level inside Common opens anything. Without this
  // the panel would promise "Level 2 unlocks a weapon slot" to a starting
  // character and then quietly not deliver.
  // The bandage takes the rarity colour, so evolving visibly re-wraps him —
  // grey at common, up through the ladder. Same field the in-game renderer
  // reads, so the two never disagree.
  const bandColor = CHAR_RARITY_COLORS[char.rarity] || '#d9cba8';

  const nextSlotUnlock = sl.cap <= sl.floor ? null
    : char.level < sl.weaponAt ? { at: sl.weaponAt, kind: 'weapon' }
    : char.level < sl.skillAt ? { at: sl.skillAt, kind: 'skill' }
    : null;

  return (
    <div className="modal-overlay" data-testid="char-panel" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className={`forge-panel char-panel ${popAnim ? 'card-pop' : ''}`} style={{ maxWidth: 560 }}>
        <div className="forge-header">
          <div className="forge-title" style={{ color: rarColor }}>CHARACTER</div>
          <button type="button" onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>CLOSE</button>
        </div>

        {/* Hero portrait. The reference sheet makes the character the
            centrepiece and this panel had no portrait at all — it opened on a
            row of rarity chips, so the screen about your character never
            actually showed them. Drawn in SVG rather than dropped in as art
            so it takes the current rarity colour: the drop visibly changes as
            you evolve, which is the whole point of the screen. */}
        <div className="char-portrait" style={{ '--rar': rarColor }}>
          <span className="char-portrait-grid" aria-hidden="true" />
          {/* ── THE IDLE, AS A TEST ──────────────────────────────────
              Timmy asked to see the 16-frame idle sheet running here instead
              of the hand-drawn drop, to judge which one the character should
              become. Both are kept: flip PORTRAIT below and nothing is lost.

              The sprite is a TEST, not shipped art. This project's rule is
              zero image assets — everything hand-built — and the strip in
              public/sprites/ is here only so the two can be compared side by
              side. If the hardcoded version wins, the file goes.

              No canvas, no Pixi, no JS ticker: one strip and a CSS steps(16).
              That is the sharpest and cheapest way to run 16 frames in a DOM
              menu, and it cannot be clipped by anything. */}
          {PORTRAIT === 'sprite'
            ? <span
                className="char-portrait-sprite"
                aria-hidden="true"
                /* From here and not from the stylesheet: CRA resolves CSS
                   url() at build time and cannot see public/. */
                style={{ backgroundImage: `url(${process.env.PUBLIC_URL || ''}/sprites/waterdrop-idle-16.png)` }}
              />
            : <HeroFigure
                className="char-portrait-drop"
                rarColor={rarColor}
                bandColor={bandColor}
              />}
          {/* Holo pedestal the drop stands on. */}
          <span className="char-portrait-pad" aria-hidden="true" />
          <div className="char-portrait-name">
            <span className="char-portrait-rar">{CHAR_RARITY_NAMES[char.rarity]}</span>
            <span className="char-portrait-lvl">Lv {char.level} / {MAX_LVL}</span>
          </div>
        </div>

        {/* Rarity evolution path */}
        <div className="char-rar-bar">
          {CHAR_RARITIES.map((r, i) => (
            <div key={r} className={`char-rar-step${i === rarIdx ? ' cur' : ''}${i < rarIdx ? ' is-done' : ''}`} style={{
              background: i < rarIdx ? CHAR_RARITY_COLORS[r] + '44' : i === rarIdx ? CHAR_RARITY_COLORS[r] : '#1a1226',
              border: i === rarIdx ? `2px solid ${CHAR_RARITY_COLORS[r]}` : '2px solid #ffffff11',
              boxShadow: i === rarIdx ? `0 0 14px ${CHAR_RARITY_COLORS[r]}88` : 'none',
            }} title={CHAR_RARITY_NAMES[r]}>
              {i < rarIdx && <span className="char-rar-tick" aria-hidden="true" />}
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

        {/* ---- Slot unlocks -------------------------------------------------
            Rarity is the CEILING and level is the KEY (the rule itself lives
            in data_ext2's characterSlots — this only draws it). Showing the
            live numbers plus what the NEXT level opens is the whole reason
            character levelling now matters: before, a level was a stat
            trickle and this line only ever showed the rarity cap, so nothing
            on screen ever said "one more level and you carry another
            weapon". */}
        <div className="char-slot-badge" style={{ borderColor: rarColor, color: rarColor, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <GameIcon name="ui_blade" size={14} /> {curWeapons} weapon{curWeapons === 1 ? '' : 's'} · <GameIcon name="ui_skills" size={14} /> {curSkills} skill{curSkills === 1 ? '' : 's'} at once
          <span style={{ color: 'var(--ink-dim)', marginLeft: 6 }}>(cap {slots} at {CHAR_RARITY_NAMES[char.rarity]})</span>
        </div>
        {nextSlotUnlock && (
          <div className="char-slot-next" data-testid="char-slot-next">
            Level {nextSlotUnlock.at} unlocks a {nextSlotUnlock.kind} slot
            {nextSlotUnlock.at > MAX_LVL && ' — evolve first'}
          </div>
        )}

        {/* Currency row */}
        <div className="char-currency">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="cur_pieces" size={14} /> {char.pieces} <span style={{ color: 'var(--ink-dim)', fontSize: 11 }}>pieces</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="cur_shards" size={14} /> {char.shards} <span style={{ color: 'var(--ink-dim)', fontSize: 11 }}>shards</span></span>
        </div>

        {/* Next stat preview */}
        {char.level < MAX_LVL && (() => {
          const st = charLevelStat(char.level, char.rarity);
          const display = st.isPct ? `+${Math.round(st.val * 100)}%` : `+${st.val}`;
          const nowVal = earned[st.stat] || 0;
          const nowTxt = st.stat === 'maxHp' || st.stat === 'armor'
            ? String(nowVal)
            : `${Math.round(nowVal * 100)}%`;
          return (
            <div className="char-preview" data-testid="char-preview">
              <span>NOW {st.label} {nowTxt}</span>
              <span className="char-preview-arrow" aria-hidden="true" />
              <span>NEXT {display} {st.label}</span>
            </div>
          );
        })()}

        {/* Level up button */}
        {char.level < MAX_LVL && levelCost && (
          <button className={`char-btn ${canLvl ? '' : 'disabled'}`} onClick={levelUp} disabled={!canLvl}
            style={{ borderColor: rarColor, boxShadow: canLvl ? `0 0 12px ${rarColor}44` : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            LEVEL UP — <GameIcon name="cur_gold" size={13} /> {levelCost.gold} + <GameIcon name="cur_pieces" size={13} /> {levelCost.pieces}
          </button>
        )}

        {/* Evolve button */}
        {canEvolve && evolveReq && (
          <button className={`char-btn evolve ${canEvo ? '' : 'disabled'}`} onClick={evolve} disabled={!canEvo}
            style={{ borderColor: CHAR_RARITY_COLORS[CHAR_RARITIES[rarIdx + 1]], marginTop: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <GameIcon name="ui_star" size={14} /> EVOLVE → {CHAR_RARITY_NAMES[CHAR_RARITIES[rarIdx + 1]]} — <GameIcon name="cur_shards" size={13} /> {evolveReq.shards} shards
          </button>
        )}
        {char.level >= MAX_LVL && !canEvolve && (
          <div style={{ textAlign: 'center', color: '#ff3146', fontFamily: 'VT323', letterSpacing: '0.2em', marginTop: 12 }}>MAX RARITY REACHED — MYTHICAL</div>
        )}

        {/* Bonuses earned */}
        {Object.keys(earned).length > 0 && (
          <div className="char-bonuses">
            <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', fontSize: 13, letterSpacing: '0.2em', marginBottom: 6 }}>BONUSES EARNED</div>
            {Object.entries(earned).map(([k, v]) => {
              const pct = k === 'maxHp' || k === 'armor' ? Math.min(100, (v / 80) * 100) : Math.min(100, v * 100);
              const icon = k === 'maxHp' ? 'maxHp' : k === 'dmg' ? 'damageMult' : k === 'mspd' ? 'moveMult' : k === 'gold' ? 'goldMult' : k === 'xp' ? 'xpMult' : 'armor';
              return (
                <div key={k} className="char-bonus-row">
                  <GameIcon name={icon} size={13} />
                  <span className="char-bonus-track"><i style={{ width: `${pct}%`, background: rarColor }} /></span>
                  <span>{k === 'maxHp' || k === 'armor' ? `+${v}` : `+${Math.round(v * 100)}%`}</span>
                </div>
              );
            })}
          </div>
        )}


        {/* Rarity comparison */}
        <div className="char-rar-table" style={{ marginTop: 16 }}>
          {CHAR_RARITIES.map((r, i) => (
            <div key={r} className={`char-rar-row ${r === char.rarity ? 'cur' : ''}`}
              style={{ borderLeftColor: i <= rarIdx ? CHAR_RARITY_COLORS[r] : '#ffffff11', opacity: i > rarIdx ? 0.5 : 1 }}>
              <span style={{ color: CHAR_RARITY_COLORS[r], width: 80 }}>{CHAR_RARITY_NAMES[r]}</span>
              <span style={{ color: 'var(--ink-dim)' }}>{CHAR_SLOTS_BY_RARITY[r]} weapons + {CHAR_SLOTS_BY_RARITY[r]} skills</span>
              {i <= rarIdx && <span className="char-rar-tick" style={{ marginLeft: 'auto' }} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
