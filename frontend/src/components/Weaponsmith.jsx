import React, { useState } from 'react';
import { WEAPONS } from '../game/data';
import { WEAPON_PARTS, WEAPON_PART_OVERRIDES } from '../game/data_ext';
import { ELEMENTS } from '../game/data_ext2';

export default function Weaponsmith({ save, setSave, onClose }) {
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

  return (
    <div className="modal-overlay" data-testid="weaponsmith" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel forge-panel-scrollable">
        <div className="forge-scroll-hint" data-testid="forge-scroll-hint" aria-hidden="true">▾ scroll for more ▾</div>
        <div className="forge-header">
          <div className="forge-title">🔨 WEAPONSMITH</div>
          <div className="forge-gold">★ {save.gold}</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>
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
      </div>
    </div>
  );
}
