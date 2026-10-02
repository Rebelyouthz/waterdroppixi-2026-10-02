import React, { useState } from 'react';
import { CHESTS, rollChest } from '../game/data_ext';
import { PART_SLOTS, PART_SLOT_INFO, PART_RARITY_COLORS, rollPart } from '../game/data_ext2';
import { GEAR_SLOT_ICONS, GEAR_STAT_LABELS, fmtGearVal } from '../game/gear';
import { PET_TYPES } from './PetPanel';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import { fireClaimFx, CAMP_CLAIM_FLY } from './ClaimFx';
import GameIcon from './GameIcon';

// Best rarity among a set of drops decides the toast's tone — a chest with
// one epic buried in four commons should chime like an epic landed, not
// like the first item in the array did.
const RARITY_RANK = { common: 0, magic: 1, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythical: 5 };
const bestRarityTone = (drops) => drops.reduce((best, d) => {
  const r = d.rarity || 'common';
  return (RARITY_RANK[r] || 0) > (RARITY_RANK[best] || 0) ? r : best;
}, 'common');

// Card-frame CSS class + accent color per rarity (see .card.r-* in index.css).
// Chest tier tables and pet-egg/resource drops still use 'uncommon' for the
// second rung; real gear items generated via game/gear.js call that rung
// 'magic' (see GEAR_RARITIES) — both keys map to the same visuals here so
// every drop type in this screen reads consistently regardless of which
// naming its source data uses.
const RARITY_DISPLAY = {
  common:    { cls: 'r-common',    color: '#9a8fa6' },
  uncommon:  { cls: 'r-uncommon',  color: '#4dff91' },
  magic:     { cls: 'r-uncommon',  color: '#4dff91' },
  rare:      { cls: 'r-rare',      color: '#4dc4ff' },
  epic:      { cls: 'r-epic',      color: '#b362ff' },
  legendary: { cls: 'r-legendary', color: '#ff7a1a' },
  mythical:  { cls: 'r-mythical',  color: '#ff3146' },
  mythicplus:{ cls: 'r-mythical',  color: '#ff3146' },
};

export default function Shop({ save, setSave, onClose }) {
  const [openedDrops, setOpenedDrops] = useState(null);
  const [opening, setOpening] = useState(false);

  const luckSkillLvl = save.skills?.sk_luck || 0;
  const luck = (save.meta?.m_luck || 0) * 0.5 + luckSkillLvl * 0.5;
  const gems = save.gems || 0;

  const canAfford = (chest) => {
    const currency = chest.currency || 'gems';
    if (currency === 'gems') return gems >= chest.cost;
    return (save.gold || 0) >= chest.cost;
  };

  // Timmy: chest opening had zero sound anywhere — click to open, 900ms
  // wait, drops just appear. `pushToast` gives the reveal both a chime
  // (rarity-scaled via `Audio.toast(tone)`) and a banner for free, same
  // choke point the rest of the game's reward moments already go through.
  const announceDrops = (drops, label) => {
    pushToast({ tone: bestRarityTone(drops), title: label, text: drops.map(d => d.name).join(', ') });
  };

  const burstLoot = (anchor, bag) => {
    fireClaimFx(anchor, bag, { flyTo: CAMP_CLAIM_FLY });
  };

  const open = (chest, e) => {
    if (!canAfford(chest) || opening) return;
    const anchor = e?.currentTarget || null;
    setOpening(true);
    Audio.click();

    // Pet egg chests
    if (chest.petOnly) {
      const rarities = Object.keys(chest.rarityWeights);
      const total = Object.values(chest.rarityWeights).reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      let chosenRarity = rarities[0];
      for (const r of rarities) {
        roll -= chest.rarityWeights[r];
        if (roll <= 0) { chosenRarity = r; break; }
      }
      const petType = PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)];
      const newEgg = { id: Date.now() + '_egg', type: petType.id, rarity: chosenRarity };
      setTimeout(() => {
        const ns = {
          ...save,
          gems: gems - chest.cost,
          petEggs: [...(save.petEggs || []), newEgg],
        };
        setSave(ns);
        const drops = [{ isPetEgg: true, egg: newEgg, petType, icon: 'ui_egg', name: `${petType.name} Egg`, rarity: chosenRarity }];
        setOpenedDrops(drops);
        announceDrops(drops, chest.name || 'Chest opened');
        burstLoot(anchor, { egg: 1 });
        setOpening(false);
      }, 900);
      return;
    }

    // Parts Chest: was silently giving generic gear (rollEquip) despite its
    // name/odds promising weapon parts — real bug, not just a display
    // issue. Now actually rolls from the parts system (data_ext2.js).
    if (chest.partsOnly) {
      const newParts = [];
      for (let i = 0; i < chest.rolls; i++) {
        const slot = PART_SLOTS[Math.floor(Math.random() * PART_SLOTS.length)];
        newParts.push(rollPart(slot));
      }
      setTimeout(() => {
        setSave({ ...save, gems: gems - chest.cost, parts: [...(save.parts || []), ...newParts] });
        const drops = newParts.map(p => ({ ...p, isPart: true, icon: PART_SLOT_INFO[p.slot]?.icon || 'ui_part' }));
        setOpenedDrops(drops);
        announceDrops(drops, chest.name || 'Chest opened');
        burstLoot(anchor, { gearParts: newParts.length });
        setOpening(false);
      }, 900);
      return;
    }
    // Resource Cache: same bug — was giving gear instead of a currency
    // bundle. Now actually grants gold/gems.
    if (chest.resourceOnly) {
      const goldAmt = Math.round(80 + Math.random() * 120);
      const gemsAmt = Math.round(5 + Math.random() * 10);
      setTimeout(() => {
        setSave({ ...save, gems: gems - chest.cost + gemsAmt, gold: (save.gold || 0) + goldAmt });
        const drops = [
          { isResource: true, icon: 'gold', name: `${goldAmt} Gold`, rarity: 'common' },
          { isResource: true, icon: 'gems', name: `${gemsAmt} Gems`, rarity: 'common' },
        ];
        setOpenedDrops(drops);
        announceDrops(drops, chest.name || 'Chest opened');
        burstLoot(anchor, { gold: goldAmt, gems: gemsAmt });
        setOpening(false);
      }, 900);
      return;
    }

    // Gear drops route through the SAME save.gearInventory GearPanel reads
    // (via game/gear.js's generateGearItem) rather than a separate chest-only
    // inventory — a chest used to hand out loot only Shop.jsx itself could see.
    const drops = rollChest(chest, luck);
    setTimeout(() => {
      const ns = {
        ...save,
        gems: chest.currency === 'gems' ? gems - chest.cost : gems,
        gold: chest.currency === 'gold' ? (save.gold || 0) - chest.cost : (save.gold || 0),
        gearInventory: [...(save.gearInventory || []), ...drops],
      };
      setSave(ns);
      setOpenedDrops(drops);
      announceDrops(drops, chest.name || 'Chest opened');
      burstLoot(anchor, { gear: drops.length });
      setOpening(false);
    }, 900);
  };

  return (
    <div className="modal-overlay" data-testid="shop" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="shop-panel">
        <div className="forge-header">
          <div className="forge-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GameIcon name="ui_chest" size={18} /> CHEST SHOP</div>
          <div style={{ fontFamily: 'VT323', fontSize: 14, color: 'var(--ink-dim)', display: 'flex', gap: 12 }}>
            <span style={{ color: '#4dffd4', display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_gems" size={13} /> {gems}</span>
            <span>★ {save.gold || 0}</span>
          </div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        {opening && (
          <div className="chest-opening">
            <div className="chest-anim"><GameIcon name="ui_chest" size={48} /></div>
            <div className="chest-text">OPENING…</div>
          </div>
        )}

        {openedDrops && !opening && (
          <div className="chest-result">
            <div className="chest-result-title">YOU GOT</div>
            <div className="drop-row">
              {openedDrops.map((d, i) => {
                const r = d.isPart ? { cls: '', color: PART_RARITY_COLORS[d.rarity] } : RARITY_DISPLAY[d.rarity];
                const icon = d.icon || GEAR_SLOT_ICONS[d.slot];
                return (
                  <div key={i} className={`drop-item card ${r?.cls || ''}`} style={{ animationDelay: (i * 80) + 'ms' }}>
                    <div className="card-tag">{d.rarity?.toUpperCase()}</div>
                    <div className="card-icon"><GameIcon name={icon} size={32} /></div>
                    <div className="card-name">{d.name}</div>
                    {d.isPetEgg ? (
                      <div className="card-desc" style={{ color: r?.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="ui_egg" size={13} /> {d.petType?.type} pet</div>
                    ) : d.isResource ? (
                      <div className="card-desc" style={{ color: '#ffd166' }}>Added to your balance</div>
                    ) : d.isPart ? (
                      <div className="card-desc" style={{ color: r?.color }}>
                        <div>+{d.primary.val} {d.primary.stat}</div>
                        {(d.sub || []).map((s, j) => <div key={j}>+{s.val} {s.stat}</div>)}
                      </div>
                    ) : (
                      <div className="card-desc">
                        <div>{fmtGearVal(d.stat, d.val)} {GEAR_STAT_LABELS[d.stat] || d.stat}</div>
                        {d.secondary && <div>{fmtGearVal(d.secondary.stat, d.secondary.val)} {GEAR_STAT_LABELS[d.secondary.stat] || d.secondary.stat}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setOpenedDrops(null)} style={{ marginTop: 14 }}>Continue</button>
          </div>
        )}

        {!opening && !openedDrops && (
          <>
            <div className="chest-row">
              {CHESTS.map(c => (
                <div key={c.id} className="chest-card" data-testid={`chest-${c.id}`}>
                  <div className="chest-icon"><GameIcon name={c.icon} size={30} /></div>
                  <div className="chest-name">{c.name}</div>
                  <div className="chest-info">
                    {Object.entries(c.rarityWeights).map(([rar, w]) => {
                      const r = RARITY_DISPLAY[rar];
                      const total = Object.values(c.rarityWeights).reduce((a, b) => a + b, 0);
                      return <span key={rar} style={{ color: r?.color, marginRight: 6 }}>{rar} {Math.round(w / total * 100)}%</span>;
                    })}
                  </div>
                  <button onClick={(e) => open(c, e)} disabled={!canAfford(c)} data-testid={`open-${c.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    {c.currency === 'gems' ? <><GameIcon name="cur_gems" size={13} /> {c.cost}</> : <>★ {c.cost}</>}
                  </button>
                </div>
              ))}
            </div>

            {/* Gear drops land in the same inventory GearPanel reads — equip,
                level, and sell already have a home there, so this screen
                doesn't need its own duplicate of that UI. */}
            <div style={{ color: 'var(--ink-dim)', fontSize: 13, padding: '18px 4px 4px', textAlign: 'center' }}>
              Gear you open lands in your Gear inventory — equip and sell it there.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
