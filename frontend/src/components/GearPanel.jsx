import React, { useState } from 'react';
import {
  GEAR_SLOTS, GEAR_SLOT_ICONS, GEAR_SLOT_NAMES,
  GEAR_RARITIES, GEAR_RARITY_COLORS, getMergeGroups, mergeItems, generateGearItem
} from '../game/gear';

const STAT_LABELS = {
  maxHp:'Max HP', armor:'Armor', dmg:'ATK %', atks:'Atk Spd', mspd:'Move Spd',
  dodge:'Dodge', pickup:'Pickup', crit:'Crit%', critd:'Crit DMG', xp:'XP Gain', gold:'Gold Find',
};

function fmtVal(stat, val) {
  const pct = ['dmg','atks','mspd','dodge','pickup','crit','critd','xp','gold'].includes(stat);
  return pct ? `+${(val * 100).toFixed(1)}%` : `+${val}`;
}

export default function GearPanel({ save, setSave }) {
  const [selected, setSelected] = useState(null);
  const [mergeSlot, setMergeSlot] = useState(null);
  const [tab, setTab] = useState('equip'); // 'equip' | 'inventory' | 'merge'
  const [toast, setToast] = useState('');

  const inv = save.gearInventory || [];
  const eq  = save.gearEquipped  || {};

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1600); };

  const equipItem = (item) => {
    setSave({ ...save, gearEquipped: { ...eq, [item.slot]: item.id } });
    showToast(`Equipped: ${item.name}`);
    setSelected(null);
  };

  const unequipSlot = (slot) => {
    const newEq = { ...eq };
    delete newEq[slot];
    setSave({ ...save, gearEquipped: newEq });
  };

  const tryMerge = (slot, rarity) => {
    const candidates = inv.filter(x => x.slot === slot && x.rarity === rarity);
    if (candidates.length < 3) return;
    const { inventory: newInv, newItem } = mergeItems(inv, candidates.slice(0, 3).map(x => x.id));
    setSave({ ...save, gearInventory: newInv });
    showToast(`Merged → ${newItem?.name} [${newItem?.rarity?.toUpperCase()}]`);
  };

  // DEBUG: grant a random item
  const debugGrant = () => {
    const slots = GEAR_SLOTS;
    const rarities = GEAR_RARITIES;
    const item = generateGearItem(slots[Math.floor(Math.random()*slots.length)], rarities[Math.floor(Math.random()*rarities.length)]);
    setSave({ ...save, gearInventory: [...inv, item] });
    showToast(`Got: ${item.name}`);
  };

  const mergeGroups = getMergeGroups(inv);

  return (
    <div className="gear-panel" data-testid="gear-panel">
      {toast && <div className="gear-toast">{toast}</div>}

      {/* Tabs */}
      <div className="gear-tabs">
        {[['equip','PAPERDOLL'],['inventory','INVENTORY'],['merge','FORGE']].map(([k,l])=>(
          <button key={k} className={`gear-tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
        {inv.length === 0 && (
          <button className="gear-tab" onClick={debugGrant} style={{marginLeft:'auto',opacity:0.5,fontSize:11}}>+ Grant Item</button>
        )}
      </div>

      {/* ── PAPERDOLL TAB ── */}
      {tab === 'equip' && (
        <div className="gear-paperdoll">
          <div className="gear-doll-bg">
            <div className="gear-doll-char">💧</div>
            {GEAR_SLOTS.map(slot => {
              const itemId = eq[slot];
              const item = inv.find(x => x.id === itemId);
              return (
                <div
                  key={slot}
                  className={`gear-slot gear-slot-${slot} ${item ? 'filled' : 'empty'}`}
                  style={{ '--rc': item ? GEAR_RARITY_COLORS[item.rarity] : '#2a1a4e' }}
                  onClick={() => item ? (setSelected(item), setTab('inventory')) : null}
                  data-testid={`gear-slot-${slot}`}
                >
                  {item ? (
                    <>
                      <span className="gear-slot-icon" style={{ color: GEAR_RARITY_COLORS[item.rarity] }}>
                        {GEAR_SLOT_ICONS[slot]}
                      </span>
                      <span className="gear-slot-stat">{fmtVal(item.stat, item.val)}</span>
                    </>
                  ) : (
                    <span className="gear-slot-empty-icon" style={{ opacity: 0.25 }}>
                      {GEAR_SLOT_ICONS[slot]}
                    </span>
                  )}
                  <span className="gear-slot-label">{GEAR_SLOT_NAMES[slot]}</span>
                </div>
              );
            })}
          </div>

          {/* Stats summary */}
          <div className="gear-stats-summary">
            <div className="gear-stats-title">EQUIPPED BONUSES</div>
            {GEAR_SLOTS.map(slot => {
              const item = inv.find(x => x.id === eq[slot]);
              if (!item) return null;
              return (
                <div key={slot} className="gear-stat-row" style={{ color: GEAR_RARITY_COLORS[item.rarity] }}>
                  <span>{GEAR_SLOT_ICONS[slot]}</span>
                  <span>{item.name}</span>
                  <span>{fmtVal(item.stat, item.val)} {STAT_LABELS[item.stat]}</span>
                </div>
              );
            })}
            {Object.keys(eq).length === 0 && (
              <div style={{ color:'#4a3a6e', fontSize:11, marginTop:8 }}>No items equipped. Find gear during runs!</div>
            )}
          </div>
        </div>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div className="gear-inventory">
          {inv.length === 0 && (
            <div className="gear-empty">
              <div style={{ fontSize: 40 }}>🎒</div>
              <div style={{ fontFamily:'VT323', fontSize:16, color:'#4a3a6e', marginTop:8 }}>
                Defeat enemies to find gear!
              </div>
              <div style={{ fontSize:10, color:'#3a2a5e', marginTop:6 }}>
                8% chance per kill. Higher enemy HP = better drops.
              </div>
            </div>
          )}
          <div className="gear-inv-grid">
            {inv.map(item => {
              const isEquipped = eq[item.slot] === item.id;
              const isSel = selected?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`gear-item ${isSel ? 'sel' : ''} ${isEquipped ? 'equipped' : ''}`}
                  style={{ '--rc': GEAR_RARITY_COLORS[item.rarity] }}
                  onClick={() => setSelected(isSel ? null : item)}
                  data-testid={`gear-item-${item.slot}-${item.rarity}`}
                >
                  <div className="gear-item-icon">{GEAR_SLOT_ICONS[item.slot]}</div>
                  <div className="gear-item-info">
                    <span className="gear-item-name" style={{ color: GEAR_RARITY_COLORS[item.rarity] }}>
                      {item.name}
                    </span>
                    <span className="gear-item-stat">{fmtVal(item.stat, item.val)} {STAT_LABELS[item.stat]}</span>
                    {isEquipped && <span className="gear-equipped-badge">EQ</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Item detail / equip */}
          {selected && (
            <div className="gear-detail" style={{ '--rc': GEAR_RARITY_COLORS[selected.rarity] }}>
              <div className="gear-detail-name">{GEAR_SLOT_ICONS[selected.slot]} {selected.name}</div>
              <div className="gear-detail-rarity" style={{ color: GEAR_RARITY_COLORS[selected.rarity] }}>
                {selected.rarity.toUpperCase()} {GEAR_SLOT_NAMES[selected.slot]}
              </div>
              <div className="gear-detail-stat">{fmtVal(selected.stat, selected.val)} {STAT_LABELS[selected.stat]}</div>
              <div className="gear-detail-btns">
                {eq[selected.slot] !== selected.id && (
                  <button className="gear-btn equip" onClick={() => equipItem(selected)} data-testid="gear-equip-btn">
                    EQUIP
                  </button>
                )}
                {eq[selected.slot] === selected.id && (
                  <button className="gear-btn unequip" onClick={() => { unequipSlot(selected.slot); setSelected(null); }}>
                    UNEQUIP
                  </button>
                )}
                <button className="gear-btn drop" onClick={() => {
                  setSave({ ...save, gearInventory: inv.filter(x => x.id !== selected.id) });
                  setSelected(null);
                }}>
                  DISCARD
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FORGE (MERGE) TAB ── */}
      {tab === 'merge' && (
        <div className="gear-forge">
          <div className="gear-forge-title">FORGE — Merge 3 of same type & rarity → Higher rarity</div>
          {mergeGroups.length === 0 ? (
            <div className="gear-empty">
              <div style={{ fontSize:36 }}>🔨</div>
              <div style={{ fontFamily:'VT323', color:'#4a3a6e', fontSize:15, marginTop:8 }}>
                Collect 3 of the same item to forge
              </div>
            </div>
          ) : (
            <div className="gear-merge-list">
              {mergeGroups.map(group => {
                const base = group[0];
                const nextRar = GEAR_RARITIES[GEAR_RARITIES.indexOf(base.rarity) + 1];
                return (
                  <div key={`${base.slot}_${base.rarity}`} className="gear-merge-row">
                    <div className="gear-merge-info">
                      <span style={{ color: GEAR_RARITY_COLORS[base.rarity] }}>{GEAR_SLOT_ICONS[base.slot]}</span>
                      <span style={{ color: GEAR_RARITY_COLORS[base.rarity] }}>{base.rarity.toUpperCase()} {GEAR_SLOT_NAMES[base.slot]}</span>
                      <span style={{ color:'#4a3a6e', fontSize:10 }}>×{group.length}</span>
                    </div>
                    {nextRar && (
                      <button
                        className="gear-btn forge"
                        onClick={() => tryMerge(base.slot, base.rarity)}
                        data-testid={`forge-${base.slot}-${base.rarity}`}
                      >
                        FORGE → {nextRar.toUpperCase()}
                      </button>
                    )}
                    {!nextRar && <span style={{ color:'#ffd700', fontFamily:'VT323' }}>LEGENDARY MAX</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
