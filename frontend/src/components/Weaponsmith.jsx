import React, { useState } from 'react';
import { WEAPONS } from '../game/data';
import { WEAPON_PARTS, WEAPON_PART_OVERRIDES } from '../game/data_ext';
import { ELEMENTS, STARTER_WEAPONS, STAT_DISPLAY } from '../game/data_ext2';
import { RUNE_RARITY_COLORS, RUNE_RARITIES, getRuneMergeGroups, mergeRunes, rollRune } from '../game/runes';
import { mergeChance, FLUX_PER_MERGE_MAX } from '../game/forge';
import { Audio } from '../game/audio';
import GameIcon, { ICONS } from './GameIcon';
import { ATTACH_SLOTS, ATTACH_SLOT_INFO, ATTACH_RARITY_COLORS } from '../game/attachments';

// Short labels for the stats an attachment moves.
const ATC_STAT = {
  damage: 'damage', fireRate: 'fire rate', projSpeed: 'velocity',
  magazine: 'magazine', reload: 'reload time', accuracy: 'accuracy',
  crit: 'crit', knockback: 'knockback', spreadAdd: 'spread',
};

// (PART_RAR_CLS was only used by the retired loose-parts inventory.)

// Consolidated weapon hub: upgrade parts + elemental rounds + blueprints +
// the loose-parts inventory/equip system used to all live in 3 separate
// top-level Camp menus (Smith/Parts/Blueprints) — merged here as sub-tabs
// per feedback ("too many menus"), same underlying save data, nothing
// about the mechanics themselves changed.
export default function Weaponsmith({ save, setSave, onClose }) {
  const [sub, setSub] = useState('parts'); // 'parts' (tuning) | 'runes' (parts+runes) | 'blueprints'
  const [wid, setWid] = useState('hydropistol');
  const w = WEAPONS[wid];
  const parts = save.weaponParts[wid] || {};
  const overrides = WEAPON_PART_OVERRIDES[wid] || {};
  const elementSlots = WEAPON_PARTS.element.tiers[parts.element || 0].slots;
  const equippedElems = (save.weaponElements || {})[wid] || [];

  const toggleElement = (elId) => {
    const cur = equippedElems;
    const next = cur.includes(elId) ? cur.filter(x => x !== elId)
      : cur.length < elementSlots ? [...cur, elId] : cur;
    setSave({ ...save, weaponElements: { ...(save.weaponElements || {}), [wid]: next } });
  };

  // ---- Runes (socketable into manual weapons only, per spec) ----
  const runeInv = save.runeInventory || [];
  const weaponRunes = save.weaponRunes || {};
  const runeMergeGroups = getRuneMergeGroups(runeInv);
  const socketedRuneId = weaponRunes[wid];
  const socketRune = (runeId) => setSave({ ...save, weaponRunes: { ...weaponRunes, [wid]: runeId } });
  const unsocketRune = () => { const wr = { ...weaponRunes }; delete wr[wid]; setSave({ ...save, weaponRunes: wr }); };
  // Same gamble as gear (see game/forge.js): the merge can fail and takes 2
  // of the 3 with it. Flux is burned whether or not it lands.
  // ---- Attachments ----
  const attInv = save.attachInventory || [];
  const wAtt = (save.weaponAttach || {})[wid] || {};
  const [attSlot, setAttSlot] = useState(null);
  const fitAttachment = (slot, attId) => {
    const cur = { ...(save.weaponAttach || {}) };
    const forWeapon = { ...(cur[wid] || {}) };
    if (attId) forWeapon[slot] = attId; else delete forWeapon[slot];
    cur[wid] = forWeapon;
    setSave({ ...save, weaponAttach: cur });
    setAttSlot(null);
    Audio.claimPing();
  };

  const [runeFlux, setRuneFlux] = useState(0);
  const [forgeMsg, setForgeMsg] = useState('');
  const doMergeRunes = (stat, rarity) => {
    const ids = runeInv.filter(r => r.stat === stat && r.rarity === rarity).slice(0, 3).map(r => r.id);
    if (ids.length < 3) return;
    const spend = Math.max(0, Math.min(FLUX_PER_MERGE_MAX, runeFlux, save.flux || 0));
    const { inventory: newInv, newItem, result } = mergeRunes(runeInv, ids, spend);
    if (!result || result.atMax) return;
    setSave({ ...save, runeInventory: newInv, flux: (save.flux || 0) - spend });
    if (result.ok) {
      setForgeMsg(`✦ SUCCESS → ${newItem.name}`);
      Audio.levelUp();
    } else {
      setForgeMsg(`✖ FAILED at ${Math.round(result.chance * 100)}% — 2 runes lost`);
      Audio.hit();
    }
    setTimeout(() => setForgeMsg(''), 2600);
  };
  // DEBUG: grant a random rune (real acquisition is Star Raid's Rune Run mode)
  const debugGrantRune = () => {
    setSave({ ...save, runeInventory: [...runeInv, rollRune()] });
  };

  const buyTier = (partKey, tierIdx) => {
    const tier = WEAPON_PARTS[partKey].tiers[tierIdx];
    if (save.gold < tier.cost) return;
    const cur = parts[partKey] || 0;
    if (tierIdx <= cur) return;
    const ns = {
      ...save,
      gold: save.gold - tier.cost,
      weaponParts: { ...save.weaponParts, [wid]: { ...parts, [partKey]: tierIdx } },
    };
    setSave(ns);
  };

  // Get the display label for a slot using per-weapon override if available
  const labelFor = (pk, defaultName, defaultIcon) => {
    const o = overrides[pk];
    if (o) return { name: o.name || defaultName, icon: o.icon || defaultIcon };
    return { name: defaultName, icon: defaultIcon };
  };
  // Get the display tier name for a slot+tier
  const tierNameFor = (pk, tierIdx, defaultName) => {
    const o = overrides[pk];
    if (o && o.tierNames && o.tierNames[tierIdx]) return o.tierNames[tierIdx];
    return defaultName;
  };

  // ---- Blueprints sub-tab state ----
  const shards = save.blueprintShards || {};
  const crafted = save.craftedWeapons || {};
  const craft = (id) => {
    const def = STARTER_WEAPONS[id]; if (!def || crafted[id]) return;
    const have = shards[id] || 0;
    if (have < def.blueprintCost) return;
    setSave({ ...save, blueprintShards: { ...shards, [id]: have - def.blueprintCost }, craftedWeapons: { ...crafted, [id]: true } });
    Audio.blueprint();
  };
  const blueprintWeapons = Object.keys(STARTER_WEAPONS).filter(k => k !== 'hydropistol');

  // (The loose-parts inventory's state and handlers lived here. Removed with
  // the tab — attachments are the one found-part system now.)

  return (
    <div className="modal-overlay" data-testid="weaponsmith" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel forge-panel-scrollable">
        <div className="forge-scroll-hint" data-testid="forge-scroll-hint" aria-hidden="true">▾ scroll for more ▾</div>
        <div className="forge-header">
          <div className="forge-title">🔨 WEAPONSMITH</div>
          <div className="forge-gold">★ {save.gold}</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        <div className="gear-tabs" style={{ marginBottom: 12 }}>
          {/* Three axes, and they must not sound like each other:
              TUNING  — permanent per-weapon ladders bought with gold
              PARTS   — found attachments socketed into the five slots
              BLUEPRINTS — shards that craft whole new weapons
              The old "PARTS INVENTORY" tab was a fourth system doing the same
              job as attachments; it is gone, and its contents are migrated. */}
          <button className={`gear-tab ${sub === 'parts' ? 'active' : ''}`} onClick={() => setSub('parts')} data-testid="smith-sub-parts">⚙ TUNING</button>
          <button className={`gear-tab ${sub === 'runes' ? 'active' : ''}`} onClick={() => setSub('runes')} data-testid="smith-sub-runes">🔩 PARTS &amp; RUNES</button>
          <button className={`gear-tab ${sub === 'blueprints' ? 'active' : ''}`} onClick={() => setSub('blueprints')} data-testid="smith-sub-blueprints">📜 BLUEPRINTS</button>
        </div>

        {sub === 'parts' && (<>
          <div className="forge-weapons">
            {Object.keys(WEAPONS).map(id => (
              <div key={id} className={`forge-wch ${wid === id ? 'sel' : ''}`} onClick={() => setWid(id)} data-testid={`forge-weapon-${id}`}>
                {/* Drawn glyph in the weapon's own colour, so the picker
                    reads as a rack of distinct weapons rather than a row of
                    emoji that render differently on every device. */}
                {ICONS[id]
                  ? <GameIcon name={id} size={30} />
                  : <div style={{ fontSize: 28 }}>{WEAPONS[id].icon}</div>}
                <div style={{ fontSize: 11 }}>{WEAPONS[id].name}</div>
              </div>
            ))}
          </div>
          <div className="forge-name">
            {ICONS[wid] ? <GameIcon name={wid} size={26} /> : <span>{w.icon}</span>}
            <span>{w.name}</span>
          </div>
          <div className="forge-desc">{w.desc}</div>
          <div className="forge-parts">
            {Object.entries(WEAPON_PARTS).map(([pk, part]) => {
              const cur = parts[pk] || 0;
              const lbl = labelFor(pk, part.name, part.icon);
              const curTierName = tierNameFor(pk, cur, part.tiers[cur].name);
              return (
                <div className="forge-part" key={pk} data-testid={`part-${pk}`}>
                  <div className="forge-part-h">{lbl.icon} {lbl.name} — <span style={{ color: 'var(--accent-2)' }}>{curTierName}</span></div>
                  <div className="forge-tiers">
                    {part.tiers.map((t, i) => {
                      const owned = i <= cur;
                      const canBuy = i === cur + 1 && save.gold >= t.cost;
                      const tName = tierNameFor(pk, i, t.name);
                      return (
                        <button
                          key={i}
                          className={`forge-tier ${owned ? 'owned' : ''}`}
                          onClick={() => buyTier(pk, i)}
                          disabled={!owned && !canBuy}
                          data-testid={`tier-${pk}-${i}`}
                          style={{ fontSize: 11, padding: '6px 8px' }}
                        >
                          <div>{tName}</div>
                          {!owned && <div style={{ fontSize: 10, color: 'var(--accent-2)' }}>★ {t.cost}</div>}
                          {owned && <div style={{ fontSize: 10, color: 'var(--rune)' }}>✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {elementSlots > 0 && (
            <div className="forge-part" data-testid="forge-elements">
              <div className="forge-part-h">
                🔮 Elemental Rounds — <span style={{ color: 'var(--accent-2)' }}>{equippedElems.length}/{elementSlots} assigned</span>
              </div>
              <div className="forge-desc" style={{ marginBottom: 6 }}>
                Bullets cycle through assigned elements shot-by-shot within the same magazine.
              </div>
              <div className="forge-tiers">
                {ELEMENTS.map(el => {
                  const on = equippedElems.includes(el.id);
                  const full = !on && equippedElems.length >= elementSlots;
                  return (
                    <button
                      key={el.id}
                      className={`forge-tier ${on ? 'owned' : ''}`}
                      onClick={() => toggleElement(el.id)}
                      disabled={full}
                      data-testid={`element-${el.id}`}
                      style={{ fontSize: 11, padding: '6px 8px', borderColor: on ? el.color : undefined, opacity: full ? 0.4 : 1 }}
                      title={el.desc}
                    >
                      <div style={{ color: el.color }}>{el.icon} {el.name}</div>
                      {on && <div style={{ fontSize: 10, color: 'var(--rune)' }}>✓ active</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>)}

        {sub === 'blueprints' && (<>
          <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', marginBottom: 10, fontSize: 14 }}>Collect blueprint shards in missions. Craft starter weapons.</div>
          <div className="upgrade-grid">
            {blueprintWeapons.map(id => {
              const def = STARTER_WEAPONS[id];
              const have = shards[id] || 0;
              const c = crafted[id];
              const pct = Math.min(100, (have / def.blueprintCost) * 100);
              return (
                <div className="upgrade-card" key={id} data-testid={`craft-${id}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 32 }}>{def.icon}</div>
                    <div>
                      <div className="name">{def.name}</div>
                      <div className="lvl">{have} / {def.blueprintCost}</div>
                    </div>
                  </div>
                  <div className="desc">{def.desc}</div>
                  <div className="hud-xpbar"><div className="hud-xpbar-fill" style={{ width: pct + '%' }} /></div>
                  {c ? <div style={{ color: 'var(--accent-2)' }}>✓ CRAFTED</div> :
                    <button onClick={() => craft(id)} disabled={have < def.blueprintCost} data-testid={`btn-craft-${id}`}>FORGE</button>}
                </div>
              );
            })}
          </div>
        </>)}

        {/* (The loose 'parts inventory' lived here. It was a second
            found-part system doing the same job as attachments, so it is
            retired — see store.js's migration.) */}

        {sub === 'runes' && (<>
          <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', marginBottom: 10, fontSize: 14 }}>
            Runes only socket into <b>manual</b> weapons (and the Ring/Amulet gear slots, in Equipment). Earn them in Star Raid's "Rune Run" mode.
          </div>
          {w.type !== 'manual' ? (
            <div className="gear-empty">
              <div style={{ fontSize: 36 }}>🔮</div>
              <div style={{ fontFamily: 'VT323', color: '#4a3a6e', fontSize: 15, marginTop: 8 }}>
                {w.name} isn't a manual weapon — pick one from the row above to socket a rune.
              </div>
            </div>
          ) : (
            <div className="forge-part" data-testid="forge-rune-socket" style={{ marginBottom: 16 }}>
              <div className="forge-part-h">🔮 Socketed Rune — {w.name}</div>
              {socketedRuneId ? (() => {
                const r = runeInv.find(x => x.id === socketedRuneId);
                if (!r) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: RUNE_RARITY_COLORS[r.rarity] }}>{r.icon} {r.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>+{r.val} {STAT_DISPLAY[r.stat] || r.stat}</span>
                    <button onClick={unsocketRune} style={{ fontSize: 11, padding: '3px 8px' }}>Unsocket</button>
                  </div>
              );
              })() : <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', fontSize: 13 }}>— empty socket —</div>}
            </div>
          )}

          {/* Attachments — five sockets on every weapon, each a trade. */}
          <div className="atc-block">
            <div className="atc-head">
              <span>🔩 ATTACHMENTS</span>
              <span className="atc-sub">{attInv.length} in stock</span>
            </div>
            <div className="atc-slots">
              {ATTACH_SLOTS.map(slot => {
                const info = ATTACH_SLOT_INFO[slot];
                const fitted = attInv.find(a => a.id === (wAtt[slot]));
                return (
                  <button key={slot}
                          className={`atc-slot${fitted ? ' filled' : ''}${attSlot === slot ? ' open' : ''}`}
                          style={{ '--ac': fitted ? ATTACH_RARITY_COLORS[fitted.rarity] : '#ffffff22' }}
                          onClick={() => setAttSlot(attSlot === slot ? null : slot)}
                          data-testid={`atc-slot-${slot}`}>
                    <GameIcon name={info.icon} tone={fitted ? ATTACH_RARITY_COLORS[fitted.rarity] : '#5a6a7a'} size={22} />
                    <span className="atc-slot-name">{info.name}</span>
                    <span className="atc-slot-fit">{fitted ? fitted.name : '— empty —'}</span>
                  </button>
                );
              })}
            </div>

            {attSlot && (
              <div className="atc-picker">
                <div className="atc-picker-head">{ATTACH_SLOT_INFO[attSlot].desc}</div>
                {wAtt[attSlot] && (
                  <button className="atc-opt atc-clear" onClick={() => fitAttachment(attSlot, null)}>
                    ✕ Remove fitted part
                  </button>
                )}
                {attInv.filter(a => a.slot === attSlot).length === 0 && (
                  <div className="atc-empty">Nothing for this slot yet — they drop from patrols and the Prospector.</div>
                )}
                {attInv.filter(a => a.slot === attSlot).map(a => (
                  <button key={a.id} className="atc-opt" style={{ '--ac': ATTACH_RARITY_COLORS[a.rarity] }}
                          onClick={() => fitAttachment(attSlot, a.id)}>
                    <span className="atc-opt-name">{a.name}</span>
                    <span className="atc-opt-mods">
                      {Object.entries(a.mods).map(([k, v]) => (
                        <i key={k} className="up">+{Math.round(v * 100)}% {ATC_STAT[k] || k}</i>
                      ))}
                      {Object.entries(a.cost).map(([k, v]) => (
                        <i key={k} className="down">{k === 'reload' ? '+' : '−'}{Math.round(Math.abs(v) * 100)}% {ATC_STAT[k] || k}</i>
                      ))}
                      {a.element && <i className="elem">{a.element} rounds</i>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {runeMergeGroups.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'VT323', color: 'var(--accent-2)', fontSize: 13, letterSpacing: '0.15em', marginBottom: 6 }}>FORGE — 3 same, chance at next rarity</div>
              <div className="forge-flux-bar">
                <span className="forge-flux-label">⚗ FLUX</span>
                <div className="forge-flux-pips">
                  {Array.from({ length: FLUX_PER_MERGE_MAX }).map((_, i) => (
                    <button key={i} className={`forge-flux-pip${i < runeFlux ? ' on' : ''}`}
                            disabled={i >= (save.flux || 0)}
                            onClick={() => setRuneFlux(i + 1 === runeFlux ? i : i + 1)}>⚗</button>
                  ))}
                </div>
                <span className="forge-flux-have">{save.flux || 0} held · +15% each</span>
              </div>
              <div className="forge-warn">A failed merge destroys 2 of the 3. Flux is spent either way.</div>
              {forgeMsg && <div className="forge-warn" style={{ color: forgeMsg.startsWith('✦') ? '#6dff9e' : '#ff6a7a' }}>{forgeMsg}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {runeMergeGroups.map(group => {
                  const base = group[0];
                  const odds = Math.round(mergeChance(RUNE_RARITIES.indexOf(base.rarity) + 1, Math.min(runeFlux, save.flux || 0)) * 100);
                  return (
                    <div key={`${base.stat}_${base.rarity}`} className="gear-popover-row" style={{ '--rc': RUNE_RARITY_COLORS[base.rarity] }}>
                      <span className="gear-popover-name">{base.icon} {base.name} ×{group.length}</span>
                      <button className="gear-btn equip" onClick={() => doMergeRunes(base.stat, base.rarity)}>
                        FORGE <span className="forge-odds">{odds}%</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ fontFamily: 'VT323', color: 'var(--accent-2)', fontSize: 13, letterSpacing: '0.15em', marginBottom: 6 }}>
            RUNE INVENTORY ({runeInv.length}) <button onClick={debugGrantRune} style={{ marginLeft: 10, fontSize: 10, opacity: 0.5 }}>+ Grant Rune</button>
          </div>
          {runeInv.length === 0 ? (
            <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', fontSize: 13, padding: 10 }}>No runes yet. Play Star Raid's Rune Run mode.</div>
          ) : (
            <div className="inv-row">
              {runeInv.map(r => (
                <div key={r.id} className="part-chip" style={{ '--rar': RUNE_RARITY_COLORS[r.rarity], borderLeft: `3px solid ${RUNE_RARITY_COLORS[r.rarity]}` }}>
                  <div style={{ fontWeight: 800, fontSize: 11, color: RUNE_RARITY_COLORS[r.rarity] }}>{r.icon} {r.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-dim)' }}>+{r.val} {STAT_DISPLAY[r.stat] || r.stat}</div>
                  {w.type === 'manual' && socketedRuneId !== r.id && (
                    <button onClick={() => socketRune(r.id)} style={{ padding: '3px 5px', fontSize: 10, marginTop: 4 }}>Socket</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
