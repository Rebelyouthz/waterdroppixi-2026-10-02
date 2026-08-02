import React, { useState } from 'react';
import {
  GEAR_SLOTS, GEAR_SLOT_ICONS, GEAR_SLOT_NAMES,
  GEAR_RARITIES, GEAR_RARITY_COLORS, getMergeGroups, mergeItems, generateGearItem
} from '../game/gear';
import {
  ARTIFACT_SLOT_COUNT, ARTIFACT_RARITY_COLORS, rollArtifact
} from '../game/artifacts';

const STAT_LABELS = {
  maxHp:'Max HP', armor:'Armor', dmg:'ATK %', atks:'Atk Spd', mspd:'Move Spd',
  dodge:'Dodge', pickup:'Pickup', crit:'Crit%', critd:'Crit DMG', xp:'XP Gain', gold:'Gold Find',
  area:'Area', pierce:'Pierce', proj:'+Projectiles', regen:'HP Regen', headshot:'Headshot %',
};
const ART_RARITY_ORDER = ['common','magic','rare','epic','legendary','mythical'];

function fmtVal(stat, val) {
  const pct = ['dmg','atks','mspd','dodge','pickup','crit','critd','xp','gold','headshot','area'].includes(stat);
  return pct ? `+${(val * 100).toFixed(1)}%` : `+${val}`;
}

// Same formatting but sign-aware — artifacts can roll negative (drawback) stats.
function fmtSigned(stat, val) {
  const pct = ['dmg','atks','mspd','dodge','pickup','crit','critd','xp','gold','area','pierce','proj','regen'].includes(stat);
  const sign = val >= 0 ? '+' : '';
  return pct ? `${sign}${(val * 100).toFixed(1)}%` : `${sign}${val}`;
}

export default function GearPanel({ save, setSave }) {
  const [selected, setSelected] = useState(null);
  const [mergeSlot, setMergeSlot] = useState(null);
  const [tab, setTab] = useState('equip'); // 'equip' | 'inventory' | 'merge' | 'artifacts'
  const [toast, setToast] = useState('');
  const [selectedArt, setSelectedArt] = useState(null);
  const [popoverSlot, setPopoverSlot] = useState(null);      // gear slot name, e.g. 'helmet'
  const [popoverArtSlot, setPopoverArtSlot] = useState(null); // artifact slot index
  const [gachaReveal, setGachaReveal] = useState(null);

  const inv = save.gearInventory || [];
  const eq  = save.gearEquipped  || {};
  const artInv = save.artifactInventory || [];
  const artEq  = save.artifactEquipped  || {};

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1600); };

  const equipItem = (item) => {
    setSave({ ...save, gearEquipped: { ...eq, [item.slot]: item.id } });
    showToast(`Equipped: ${item.name}`);
    setSelected(null);
    setPopoverSlot(null);
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

  // ---- Artifacts handlers ----
  const equipArtifact = (item, slotIdx) => {
    setSave({ ...save, artifactEquipped: { ...artEq, [slotIdx]: item.id } });
    showToast(`Equipped: ${item.name}`);
    setSelectedArt(null);
  };
  const unequipArtifactSlot = (slotIdx) => {
    const newEq = { ...artEq };
    delete newEq[slotIdx];
    setSave({ ...save, artifactEquipped: newEq });
  };
  const discardArtifact = (id) => {
    const newEq = { ...artEq };
    for (const k of Object.keys(newEq)) if (newEq[k] === id) delete newEq[k];
    setSave({ ...save, artifactInventory: artInv.filter(x => x.id !== id), artifactEquipped: newEq });
    setSelectedArt(null);
  };
  // DEBUG: grant a random artifact directly (bypasses tokens, for testing)
  const debugGrantArtifact = () => {
    const item = rollArtifact(save.attrs?.luck || 0);
    setSave({ ...save, artifactInventory: [...artInv, item] });
    showToast(`Found: ${item.name}`);
  };

  // Real acquisition path: spend a Gacha Token (earned by clearing Star
  // Raid's final stage) to pull one artifact.
  const gachaTokens = save.gachaTokens || 0;
  const pullGacha = () => {
    if (gachaTokens <= 0) return;
    const item = rollArtifact(save.attrs?.luck || 0);
    setSave({ ...save, gachaTokens: gachaTokens - 1, artifactInventory: [...artInv, item] });
    setGachaReveal(item);
  };

  return (
    <div className="gear-panel" data-testid="gear-panel">
      {toast && <div className="gear-toast">{toast}</div>}

      {/* Tabs */}
      <div className="gear-tabs">
        {[['equip','PAPERDOLL'],['inventory','INVENTORY'],['merge','FORGE'],['artifacts','ARTIFACTS']].map(([k,l])=>(
          <button key={k} className={`gear-tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
        {tab !== 'artifacts' && inv.length === 0 && (
          <button className="gear-tab" onClick={debugGrant} style={{marginLeft:'auto',opacity:0.5,fontSize:11}}>+ Grant Item</button>
        )}
        {tab === 'artifacts' && (
          <button className="gear-tab" onClick={debugGrantArtifact} style={{marginLeft:'auto',opacity:0.5,fontSize:11}}>+ Grant Artifact</button>
        )}
      </div>

      {/* ── PAPERDOLL TAB ── */}
      {tab === 'equip' && (
        <div className="gear-paperdoll">
          <div className="gear-doll-bg">
            {/* Procedural character silhouette matching the in-game water-drop
                body (teal-glow torso + head), not a bare floating emoji. */}
            <div className="gear-doll-char" aria-hidden>
              <div className="doll-head" />
              <div className="doll-torso" />
              <div className="doll-arm doll-arm-l" />
              <div className="doll-arm doll-arm-r" />
              <div className="doll-leg doll-leg-l" />
              <div className="doll-leg doll-leg-r" />
              <div className="doll-glow" />
            </div>
            {GEAR_SLOTS.map(slot => {
              const itemId = eq[slot];
              const item = inv.find(x => x.id === itemId);
              return (
                <div
                  key={slot}
                  className={`gear-slot gear-slot-${slot} ${item ? 'filled' : 'empty'}`}
                  style={{ '--rc': item ? GEAR_RARITY_COLORS[item.rarity] : '#2a1a4e' }}
                  onClick={() => setPopoverSlot(popoverSlot === slot ? null : slot)}
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

          {/* Quick equip popover — click any slot to see only items that fit
              it, best rarity first, equip inline without leaving the tab. */}
          {popoverSlot && (
            <div className="gear-popover" data-testid="gear-popover">
              <div className="gear-popover-head">
                <span>{GEAR_SLOT_ICONS[popoverSlot]} {GEAR_SLOT_NAMES[popoverSlot].toUpperCase()}</span>
                <button className="gear-popover-close" onClick={() => setPopoverSlot(null)}>✕</button>
              </div>
              <div className="gear-popover-list">
                {inv.filter(x => x.slot === popoverSlot).length === 0 && (
                  <div className="gear-popover-empty">No {GEAR_SLOT_NAMES[popoverSlot].toLowerCase()} found yet.</div>
                )}
                {inv.filter(x => x.slot === popoverSlot)
                  .sort((a, b) => GEAR_RARITIES.indexOf(b.rarity) - GEAR_RARITIES.indexOf(a.rarity)
                    || (b.secondary?.val || 0) - (a.secondary?.val || 0))
                  .map(item => (
                    <div key={item.id} className={`gear-popover-row ${eq[popoverSlot] === item.id ? 'eq' : ''}`}
                      style={{ '--rc': GEAR_RARITY_COLORS[item.rarity] }}
                      onClick={() => equipItem(item)}>
                      <span className="gear-popover-name">{item.name}</span>
                      <span className="gear-popover-stat">{fmtVal(item.stat, item.val)} {STAT_LABELS[item.stat]}</span>
                      {item.secondary && <span className="gear-popover-armor">+{item.secondary.val} armor</span>}
                      {eq[popoverSlot] === item.id && <span className="gear-popover-badge">EQ</span>}
                    </div>
                  ))}
              </div>
              {eq[popoverSlot] && (
                <button className="gear-btn unequip" style={{ width: '100%', marginTop: 8 }}
                  onClick={() => { unequipSlot(popoverSlot); }}>UNEQUIP</button>
              )}
            </div>
          )}

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

      {/* ── ARTIFACTS TAB ── */}
      {tab === 'artifacts' && (
        <div className="gear-inventory">
          {/* Gacha Machine — spend tokens earned from Star Raid to pull artifacts */}
          <div className="gacha-machine" data-testid="gacha-machine">
            <div className="gacha-machine-icon">🎰</div>
            <div className="gacha-machine-info">
              <div className="gacha-machine-title">ARTIFACT GACHA MACHINE</div>
              <div className="gacha-machine-sub">Clear Star Raid's final stage to earn tokens.</div>
            </div>
            <div className="gacha-machine-tokens">🎫 ×{gachaTokens}</div>
            <button className="gear-btn equip" disabled={gachaTokens <= 0}
              style={{ opacity: gachaTokens > 0 ? 1 : 0.4 }}
              onClick={pullGacha} data-testid="gacha-pull-btn">PULL</button>
          </div>

          {gachaReveal && (
            <div className="modal-overlay" onClick={() => setGachaReveal(null)}>
              <div className="gacha-reveal" style={{ '--rc': ARTIFACT_RARITY_COLORS[gachaReveal.rarity] }}
                onClick={(e) => e.stopPropagation()}>
                <div className="gacha-reveal-icon">🔶</div>
                <div className="gacha-reveal-rarity">{gachaReveal.rarity.toUpperCase()}</div>
                <div className="gacha-reveal-name">{gachaReveal.name}</div>
                {gachaReveal.stats.map((s, si) => (
                  <div key={si} className="gear-detail-stat" style={{ color: s.val >= 0 ? '#4dff91' : '#ff5566' }}>
                    {fmtSigned(s.stat, s.val)} {STAT_LABELS[s.stat] || s.stat}
                  </div>
                ))}
                <button className="gear-btn equip" style={{ marginTop: 12 }} onClick={() => setGachaReveal(null)}>NICE</button>
              </div>
            </div>
          )}

          <div className="artifact-slots-row">
            {Array.from({ length: ARTIFACT_SLOT_COUNT }).map((_, slotIdx) => {
              const item = artInv.find(x => x.id === artEq[slotIdx]);
              return (
                <div
                  key={slotIdx}
                  className={`artifact-slot ${item ? 'filled' : 'empty'}`}
                  style={{ '--rc': item ? ARTIFACT_RARITY_COLORS[item.rarity] : '#2a1a4e' }}
                  onClick={() => setPopoverArtSlot(popoverArtSlot === slotIdx ? null : slotIdx)}
                  data-testid={`artifact-slot-${slotIdx}`}
                >
                  {item ? (
                    <>
                      <span className="artifact-slot-icon">🔶</span>
                      <span className="artifact-slot-name">{item.name}</span>
                    </>
                  ) : (
                    <span className="artifact-slot-empty-icon">🔶</span>
                  )}
                  <span className="artifact-slot-label">Slot {slotIdx + 1}</span>
                </div>
              );
            })}
          </div>

          {/* Quick equip popover — same pattern as gear slots. */}
          {popoverArtSlot !== null && (
            <div className="gear-popover" data-testid="artifact-popover">
              <div className="gear-popover-head">
                <span>🔶 ARTIFACT SLOT {popoverArtSlot + 1}</span>
                <button className="gear-popover-close" onClick={() => setPopoverArtSlot(null)}>✕</button>
              </div>
              <div className="gear-popover-list">
                {artInv.length === 0 && <div className="gear-popover-empty">No artifacts found yet.</div>}
                {[...artInv]
                  .sort((a, b) => ART_RARITY_ORDER.indexOf(b.rarity) - ART_RARITY_ORDER.indexOf(a.rarity))
                  .map(item => {
                    const equippedHere = artEq[popoverArtSlot] === item.id;
                    const equippedElsewhere = !equippedHere && Object.values(artEq).includes(item.id);
                    return (
                      <div key={item.id} className={`gear-popover-row ${equippedHere ? 'eq' : ''} ${equippedElsewhere ? 'disabled' : ''}`}
                        style={{ '--rc': ARTIFACT_RARITY_COLORS[item.rarity] }}
                        onClick={() => !equippedElsewhere && (equipArtifact(item, popoverArtSlot), setPopoverArtSlot(null))}>
                        <span className="gear-popover-name">{item.name}</span>
                        {item.stats.map((s, si) => (
                          <span key={si} className="gear-popover-stat" style={{ color: s.val >= 0 ? '#4dff91' : '#ff5566' }}>
                            {fmtSigned(s.stat, s.val)} {STAT_LABELS[s.stat] || s.stat}
                          </span>
                        ))}
                        {equippedHere && <span className="gear-popover-badge">EQ</span>}
                        {equippedElsewhere && <span className="gear-popover-badge" style={{ background:'#4a3a6e' }}>IN USE</span>}
                      </div>
                    );
                  })}
              </div>
              {artEq[popoverArtSlot] && (
                <button className="gear-btn unequip" style={{ width: '100%', marginTop: 8 }}
                  onClick={() => { unequipArtifactSlot(popoverArtSlot); }}>UNEQUIP</button>
              )}
            </div>
          )}

          {artInv.length === 0 && (
            <div className="gear-empty">
              <div style={{ fontSize: 40 }}>🔶</div>
              <div style={{ fontFamily:'VT323', fontSize:16, color:'#4a3a6e', marginTop:8 }}>
                No artifacts yet.
              </div>
              <div style={{ fontSize:10, color:'#3a2a5e', marginTop:6 }}>
                Earn Gacha Tokens by clearing Patrol stages, then pull the Artifact Gacha Machine.
              </div>
            </div>
          )}

          <div className="gear-inv-grid">
            {artInv.map(item => {
              const equippedSlot = Object.keys(artEq).find(k => artEq[k] === item.id);
              const isSel = selectedArt?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`gear-item ${isSel ? 'sel' : ''} ${equippedSlot !== undefined ? 'equipped' : ''}`}
                  style={{ '--rc': ARTIFACT_RARITY_COLORS[item.rarity] }}
                  onClick={() => setSelectedArt(isSel ? null : item)}
                  data-testid={`artifact-item-${item.rarity}`}
                >
                  <div className="gear-item-icon">🔶</div>
                  <div className="gear-item-info">
                    <span className="gear-item-name" style={{ color: ARTIFACT_RARITY_COLORS[item.rarity] }}>
                      {item.name}
                    </span>
                    {item.stats.map((s, si) => (
                      <span key={si} className="gear-item-stat" style={{ color: s.val >= 0 ? '#4dff91' : '#ff5566' }}>
                        {fmtSigned(s.stat, s.val)} {STAT_LABELS[s.stat] || s.stat}
                      </span>
                    ))}
                    {equippedSlot !== undefined && <span className="gear-equipped-badge">EQ</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedArt && (
            <div className="gear-detail" style={{ '--rc': ARTIFACT_RARITY_COLORS[selectedArt.rarity] }}>
              <div className="gear-detail-name">🔶 {selectedArt.name}</div>
              <div className="gear-detail-rarity" style={{ color: ARTIFACT_RARITY_COLORS[selectedArt.rarity] }}>
                {selectedArt.rarity.toUpperCase()} ARTIFACT
              </div>
              {selectedArt.stats.map((s, si) => (
                <div key={si} className="gear-detail-stat" style={{ color: s.val >= 0 ? '#4dff91' : '#ff5566' }}>
                  {fmtSigned(s.stat, s.val)} {STAT_LABELS[s.stat] || s.stat}
                </div>
              ))}
              <div className="gear-detail-btns">
                {Object.values(artEq).includes(selectedArt.id) ? (
                  <button className="gear-btn unequip" onClick={() => {
                    const slotIdx = Object.keys(artEq).find(k => artEq[k] === selectedArt.id);
                    unequipArtifactSlot(slotIdx);
                  }}>UNEQUIP</button>
                ) : (
                  <>
                    {Array.from({ length: ARTIFACT_SLOT_COUNT }).map((_, slotIdx) => (
                      !artEq[slotIdx] && (
                        <button key={slotIdx} className="gear-btn equip" onClick={() => equipArtifact(selectedArt, slotIdx)}>
                          EQUIP SLOT {slotIdx + 1}
                        </button>
                      )
                    ))}
                    {ARTIFACT_SLOT_COUNT > 0 && Object.keys(artEq).length >= ARTIFACT_SLOT_COUNT && (
                      <button className="gear-btn equip" onClick={() => equipArtifact(selectedArt, 0)}>REPLACE SLOT 1</button>
                    )}
                  </>
                )}
                <button className="gear-btn drop" onClick={() => discardArtifact(selectedArt.id)}>DISCARD</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
