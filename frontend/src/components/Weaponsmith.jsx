import React, { useState } from 'react';
import { WEAPONS } from '../game/data';
import { WEAPON_PARTS, WEAPON_PART_OVERRIDES } from '../game/data_ext';
import { ELEMENTS, STARTER_WEAPONS, PART_SLOTS, PART_SLOT_INFO, STAT_DISPLAY } from '../game/data_ext2';
import { Audio } from '../game/audio';

const PART_RAR_CLS = { common: 'r-common', uncommon: 'r-uncommon', rare: 'r-rare', epic: 'r-epic', legendary: 'r-legendary', mythical: 'r-mythical' };

// Consolidated weapon hub: upgrade parts + elemental rounds + blueprints +
// the loose-parts inventory/equip system used to all live in 3 separate
// top-level Camp menus (Smith/Parts/Blueprints) — merged here as sub-tabs
// per feedback ("too many menus"), same underlying save data, nothing
// about the mechanics themselves changed.
export default function Weaponsmith({ save, setSave, onClose }) {
  const [sub, setSub] = useState('parts'); // 'parts' | 'blueprints' | 'inventory'
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

  // ---- Parts inventory sub-tab state (its own weapon selector — scoped to
  // STARTER_WEAPONS, a different catalog than the full WEAPONS list above) ----
  const [invWid, setInvWid] = useState(Object.keys(STARTER_WEAPONS)[0]);
  const invParts = save.parts || [];
  const invEquipped = save.equippedParts || {};
  const cw = save.craftedWeapons || { hydropistol: true };
  const invWeaponList = Object.keys(STARTER_WEAPONS).filter(k => k === 'hydropistol' || cw[k]);
  const equipPart = (part) => {
    const cur = { ...(invEquipped[invWid] || {}) };
    cur[part.slot] = part.id;
    setSave({ ...save, equippedParts: { ...invEquipped, [invWid]: cur } });
    Audio.click();
  };
  const unequipSlot = (slot) => {
    const cur = { ...(invEquipped[invWid] || {}) };
    delete cur[slot];
    setSave({ ...save, equippedParts: { ...invEquipped, [invWid]: cur } });
  };
  const sellPart = (part) => {
    const val = ({ common: 20, uncommon: 60, rare: 200, epic: 800, legendary: 3000, mythical: 8000 })[part.rarity] || 10;
    const inv = invParts.filter(p => p.id !== part.id);
    const cleared = { ...invEquipped };
    for (const wk of Object.keys(cleared)) if (cleared[wk] && cleared[wk][part.slot] === part.id) delete cleared[wk][part.slot];
    setSave({ ...save, parts: inv, gold: (save.gold || 0) + val, equippedParts: cleared });
  };

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
          <button className={`gear-tab ${sub === 'parts' ? 'active' : ''}`} onClick={() => setSub('parts')} data-testid="smith-sub-parts">UPGRADE PARTS</button>
          <button className={`gear-tab ${sub === 'blueprints' ? 'active' : ''}`} onClick={() => setSub('blueprints')} data-testid="smith-sub-blueprints">📜 BLUEPRINTS</button>
          <button className={`gear-tab ${sub === 'inventory' ? 'active' : ''}`} onClick={() => setSub('inventory')} data-testid="smith-sub-inventory">🔧 PARTS INVENTORY</button>
        </div>

        {sub === 'parts' && (<>
          <div className="forge-weapons">
            {Object.keys(WEAPONS).map(id => (
              <div key={id} className={`forge-wch ${wid === id ? 'sel' : ''}`} onClick={() => setWid(id)} data-testid={`forge-weapon-${id}`}>
                <div style={{ fontSize: 28 }}>{WEAPONS[id].icon}</div>
                <div style={{ fontSize: 11 }}>{WEAPONS[id].name}</div>
              </div>
            ))}
          </div>
          <div className="forge-name">{w.icon} {w.name}</div>
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

        {sub === 'inventory' && (<>
          <div className="forge-weapons">
            {invWeaponList.map(id => (
              <div key={id} className={`forge-wch ${invWid === id ? 'sel' : ''}`} onClick={() => setInvWid(id)} data-testid={`pi-w-${id}`}>
                <div style={{ fontSize: 26 }}>{STARTER_WEAPONS[id].icon}</div>
                <div style={{ fontSize: 10 }}>{STARTER_WEAPONS[id].name}</div>
              </div>
            ))}
          </div>
          <div className="forge-name">{STARTER_WEAPONS[invWid].icon} {STARTER_WEAPONS[invWid].name}</div>
          <div style={{ marginTop: 10, marginBottom: 8, color: 'var(--accent-2)', letterSpacing: '0.2em', fontSize: 13 }}>EQUIPPED PARTS</div>
          <div className="parts-slots">
            {PART_SLOTS.map(slot => {
              const eqId = (invEquipped[invWid] || {})[slot];
              const part = invParts.find(p => p.id === eqId);
              return (
                <div key={slot} className="part-slot">
                  <div className="ps-name">{PART_SLOT_INFO[slot].icon} {slot}</div>
                  {part ? (
                    <div className={`part-chip ${PART_RAR_CLS[part.rarity]}`} onClick={() => unequipSlot(slot)}>
                      <div style={{ fontWeight: 800 }}>{part.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>+{Math.round(part.primary.val * 100) / 100} {STAT_DISPLAY[part.primary.stat] || part.primary.stat}</div>
                    </div>
                  ) : <div className="ps-empty">— empty —</div>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, color: 'var(--accent-2)', letterSpacing: '0.2em', fontSize: 13 }}>INVENTORY ({invParts.length})</div>
          {invParts.length === 0 && <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', padding: 10 }}>No parts yet. Run missions to find some.</div>}
          <div className="inv-row">
            {invParts.map(p => (
              <div className={`part-chip ${PART_RAR_CLS[p.rarity]}`} key={p.id} data-testid={`part-${p.id}`}>
                <div style={{ fontWeight: 800, fontSize: 11 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-dim)' }}>{p.slot}</div>
                <div style={{ fontSize: 10 }}>+{Math.round(p.primary.val * 100) / 100} {STAT_DISPLAY[p.primary.stat] || p.primary.stat}</div>
                {p.sub.map((s, i) => <div key={i} style={{ fontSize: 10, color: 'var(--ink-dim)' }}>+{Math.round(s.val * 100) / 100} {STAT_DISPLAY[s.stat] || s.stat}</div>)}
                <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                  <button onClick={() => equipPart(p)} style={{ padding: '3px 5px', fontSize: 10 }}>Equip</button>
                  <button onClick={() => sellPart(p)} style={{ padding: '3px 5px', fontSize: 10 }}>Sell</button>
                </div>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </div>
  );
}
