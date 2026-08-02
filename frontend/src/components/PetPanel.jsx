import React, { useState } from 'react';
import { Audio } from '../game/audio';

// ─── Pet Definitions ─────────────────────────────────────────────────────────
export const PET_TYPES = [
  {
    id: 'aquaSprite', name: 'Aqua Sprite', icon: '💧', type: 'Attack',
    desc: 'Fires a water bolt at the nearest enemy every 3s.',
    stat: 'dmg', statPerLevel: 0.001, // +0.1% dmg per level
    eggCosts: { common: 50, uncommon: 120, rare: 300, epic: 700, legendary: 1500 },
  },
  {
    id: 'shadowWisp', name: 'Shadow Wisp', icon: '👻', type: 'Defend',
    desc: 'Reduces incoming damage (increases dodge).',
    stat: 'dodge', statPerLevel: 0.001,
    eggCosts: { common: 50, uncommon: 120, rare: 300, epic: 700, legendary: 1500 },
  },
  {
    id: 'emberFairy', name: 'Ember Fairy', icon: '🔥', type: 'Crit',
    desc: 'Boosts your critical hit chance.',
    stat: 'crit', statPerLevel: 0.001,
    eggCosts: { common: 60, uncommon: 140, rare: 350, epic: 800, legendary: 1800 },
  },
  {
    id: 'stormHawk', name: 'Storm Hawk', icon: '⚡', type: 'Super',
    desc: 'Launches a super strike every 10s dealing massive AoE damage.',
    stat: 'superCrit', statPerLevel: 0.002,
    eggCosts: { common: 80, uncommon: 180, rare: 450, epic: 1000, legendary: 2000 },
  },
  {
    id: 'lifeSprite', name: 'Life Sprite', icon: '🌿', type: 'Heal',
    desc: 'Regenerates your HP over time.',
    stat: 'regen', statPerLevel: 0.01, // +0.01 HP/s per level
    eggCosts: { common: 60, uncommon: 140, rare: 350, epic: 800, legendary: 1800 },
  },
];

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_COLORS = {
  common: '#9a8fa6', uncommon: '#4dff91', rare: '#4dc4ff',
  epic: '#b362ff', legendary: '#ff7a1a',
};

const STAGES = [
  { name: 'Newborn',  minLvl: 1,  icon: '🥚', sizeClass: 'pet-xs' },
  { name: 'Child',    minLvl: 6,  icon: '🐣', sizeClass: 'pet-sm' },
  { name: 'Young',    minLvl: 16, icon: '🐥', sizeClass: 'pet-md' },
  { name: 'Adult',    minLvl: 31, icon: '✨', sizeClass: 'pet-lg' },
  { name: 'Veteran',  minLvl: 51, icon: '⭐', sizeClass: 'pet-xl' },
  { name: 'Elder',    minLvl: 76, icon: '🌟', sizeClass: 'pet-xl' },
  { name: 'Max',      minLvl: 100, icon: '💫', sizeClass: 'pet-max' },
];

function getStage(level) {
  return [...STAGES].reverse().find(s => level >= s.minLvl) || STAGES[0];
}

function xpToLevel(level) {
  return Math.round(100 + 20 * Math.pow(level, 1.15));
}

// 3 eggs of same rarity → 1 of next rarity
function canMergeEggs(eggs, rarity) {
  return (eggs.filter(e => e.rarity === rarity).length) >= 3;
}

function mergeEggs(eggs, rarity, petType) {
  const nextIdx = RARITIES.indexOf(rarity) + 1;
  if (nextIdx >= RARITIES.length) return eggs;
  const newEggs = [...eggs];
  let removed = 0;
  for (let i = newEggs.length - 1; i >= 0 && removed < 3; i--) {
    if (newEggs[i].rarity === rarity && newEggs[i].type === petType) { newEggs.splice(i, 1); removed++; }
  }
  newEggs.push({ rarity: RARITIES[nextIdx], type: petType, id: Date.now() + '' });
  return newEggs;
}

export default function PetPanel({ save, setSave, onClose }) {
  const [view, setView] = useState('my_pets'); // 'my_pets' | 'shop' | 'eggs'

  const pets = save.pets || [];
  const eggs = save.petEggs || [];
  const gems = save.gems || 0;
  const petFood = save.petFood || 0;

  // ----- Hatch egg -----
  const hatchEgg = (egg) => {
    const petDef = PET_TYPES.find(p => p.id === egg.type);
    if (!petDef) return;
    const name = `${petDef.name} (${egg.rarity})`;
    const newPet = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2),
      type: egg.type,
      rarity: egg.rarity,
      level: 1,
      xp: 0,
      stage: 'Newborn',
      active: pets.length === 0,
      name,
    };
    const newEggs = eggs.filter(e => e.id !== egg.id);
    setSave({ ...save, pets: [...pets, newPet], petEggs: newEggs });
    Audio.levelUp();
  };

  // ----- Feed pet -----
  const feedPet = (pet) => {
    if (petFood <= 0) return;
    const xpGain = 150 + pet.level * 10;
    let newXp = pet.xp + xpGain;
    let newLevel = pet.level;
    while (newLevel < 100 && newXp >= xpToLevel(newLevel)) {
      newXp -= xpToLevel(newLevel);
      newLevel++;
      Audio.claimPing();
    }
    const stage = getStage(newLevel);
    const updPets = pets.map(p => p.id === pet.id ? { ...p, xp: newXp, level: newLevel, stage: stage.name } : p);
    setSave({ ...save, pets: updPets, petFood: petFood - 1 });
    Audio.click();
  };

  // ----- Toggle active -----
  const toggleActive = (pet) => {
    const updPets = pets.map(p => ({ ...p, active: p.id === pet.id ? !p.active : false }));
    setSave({ ...save, pets: updPets });
    Audio.click();
  };

  // ----- Buy egg -----
  const buyEgg = (type, rarity) => {
    const def = PET_TYPES.find(p => p.id === type);
    if (!def) return;
    const cost = def.eggCosts[rarity];
    if (gems < cost) return;
    const newEgg = { id: Date.now() + '', type, rarity };
    setSave({ ...save, gems: gems - cost, petEggs: [...eggs, newEgg] });
    Audio.click();
  };

  // ----- Merge eggs -----
  const doMerge = (rarity, type) => {
    if (!canMergeEggs(eggs.filter(e => e.type === type), rarity)) return;
    setSave({ ...save, petEggs: mergeEggs(eggs, rarity, type) });
    Audio.levelUp();
  };

  // ----- Buy pet food -----
  const buyFood = () => {
    if (gems < 50) return;
    setSave({ ...save, gems: gems - 50, petFood: petFood + 5 });
    Audio.click();
  };

  return (
    <div className="modal-overlay" data-testid="pet-panel" onClick={(e) => {
      if (e.target.classList.contains('modal-overlay')) onClose();
    }}>
      <div className="forge-panel" style={{ maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="forge-header">
          <div className="forge-title">🐾 PETS</div>
          <div style={{ fontFamily:'VT323', fontSize:14, color:'var(--ink-dim)', display:'flex', gap:12, alignItems:'center' }}>
            <span style={{ color:'#4dffd4' }}>💎 {gems}</span>
            <span style={{ color:'#ff9955' }}>🍖 {petFood}</span>
          </div>
          <button onClick={onClose} style={{ padding:'6px 12px', fontSize:12 }}>✕</button>
        </div>

        {/* Nav */}
        <div style={{ display:'flex', gap:4, padding:'8px 12px', background:'#060410', borderBottom:'1px solid #1a0a2e' }}>
          {['my_pets','eggs','shop'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ fontFamily:'VT323', fontSize:14, letterSpacing:'0.15em', padding:'4px 14px',
                background: view === v ? 'var(--rune)' : 'transparent',
                border: `1px solid ${view===v?'var(--rune)':'#1a0a2e'}`, color: view===v?'#000':'var(--ink-dim)', borderRadius:2, cursor:'pointer' }}>
              {v==='my_pets'?'MY PETS':v==='eggs'?`EGGS (${eggs.length})`:'SHOP'}
            </button>
          ))}
          <div style={{ marginLeft:'auto' }}>
            <button onClick={buyFood} disabled={gems < 50} style={{ fontFamily:'VT323', fontSize:13, padding:'4px 12px',
              background:'#1a0a2e', border:'1px solid #4dffd455', color:'#4dffd4', cursor:'pointer' }}>
              💎50 → 🍖×5
            </button>
          </div>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:12 }}>
          {/* ── MY PETS ── */}
          {view === 'my_pets' && (
            <>
              {pets.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--ink-dim)', fontFamily:'VT323', fontSize:16, padding:40 }}>
                  No pets yet. Buy an egg from the SHOP and hatch it!
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
                  {pets.map(pet => {
                    const def = PET_TYPES.find(p => p.id === pet.type);
                    const stage = getStage(pet.level);
                    const xpNeeded = xpToLevel(pet.level);
                    const pct = Math.min(100, (pet.xp / xpNeeded) * 100);
                    const rarityColor = RARITY_COLORS[pet.rarity] || '#9a8fa6';
                    return (
                      <div key={pet.id} style={{
                        background: '#0a0520', border: `1px solid ${pet.active?rarityColor:'#1a0a2e'}`,
                        borderRadius:6, padding:12, boxShadow: pet.active ? `0 0 12px ${rarityColor}44` : 'none',
                      }} data-testid={`pet-${pet.id}`}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div style={{ fontSize:28 }}>{def?.icon || '🐾'}</div>
                          <div style={{ fontFamily:'VT323', fontSize:11, color:rarityColor, textTransform:'uppercase' }}>{pet.rarity}</div>
                        </div>
                        <div style={{ fontFamily:'VT323', fontSize:16, color:'var(--ink)', marginTop:4 }}>{pet.name}</div>
                        <div style={{ fontFamily:'VT323', fontSize:12, color:'var(--ink-dim)', marginBottom:4 }}>
                          {stage.icon} {stage.name} · Lv {pet.level}
                        </div>
                        {/* XP bar */}
                        <div style={{ height:4, background:'#1a0a2e', borderRadius:2, overflow:'hidden', marginBottom:6 }}>
                          <div style={{ width:`${pct}%`, height:'100%', background: rarityColor, transition:'width 0.3s' }} />
                        </div>
                        <div style={{ fontFamily:'VT323', fontSize:11, color:'var(--ink-dim)', marginBottom:8 }}>
                          XP: {pet.xp}/{xpNeeded} · {def?.type}
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => feedPet(pet)} disabled={petFood <= 0 || pet.level >= 100}
                            style={{ flex:1, fontFamily:'VT323', fontSize:13, padding:'4px 8px',
                              background:'#1a0a2e', border:'1px solid #ff995544', color: petFood > 0 ? '#ff9955' : '#666', cursor:'pointer' }}>
                            🍖 FEED
                          </button>
                          <button onClick={() => toggleActive(pet)}
                            style={{ flex:1, fontFamily:'VT323', fontSize:13, padding:'4px 8px',
                              background: pet.active ? rarityColor : '#1a0a2e',
                              border:`1px solid ${rarityColor}`, color: pet.active ? '#000' : rarityColor, cursor:'pointer' }}>
                            {pet.active ? '✓ ACTIVE' : 'SET'}
                          </button>
                        </div>
                        {pet.active && def && (
                          <div style={{ fontFamily:'VT323', fontSize:11, color:'#4dffd4', marginTop:4 }}>
                            +{(def.statPerLevel * pet.level * 100).toFixed(1)}% {def.stat}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── EGGS ── */}
          {view === 'eggs' && (
            <>
              {eggs.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--ink-dim)', fontFamily:'VT323', fontSize:16, padding:40 }}>
                  No eggs. Visit the SHOP to buy some!
                </div>
              ) : (
                <>
                  <div style={{ fontFamily:'VT323', color:'var(--ink-dim)', fontSize:14, marginBottom:12 }}>
                    Click to hatch. Merge 3 of same rarity → higher rarity!
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                    {eggs.map(egg => {
                      const def = PET_TYPES.find(p => p.id === egg.type);
                      const rc = RARITY_COLORS[egg.rarity] || '#9a8fa6';
                      const sameTypeEggs = eggs.filter(e => e.type === egg.type && e.rarity === egg.rarity);
                      return (
                        <div key={egg.id} data-testid={`egg-${egg.id}`}
                          style={{ background:'#0a0520', border:`1px solid ${rc}`, borderRadius:6, padding:10, textAlign:'center', cursor:'pointer' }}
                          onClick={() => hatchEgg(egg)}>
                          <div style={{ fontSize:30 }}>🥚</div>
                          <div style={{ fontFamily:'VT323', fontSize:13, color:rc }}>{egg.rarity}</div>
                          <div style={{ fontFamily:'VT323', fontSize:12, color:'var(--ink-dim)' }}>{def?.icon} {def?.name}</div>
                          <div style={{ fontFamily:'VT323', fontSize:11, color:'#4dffd4', marginTop:4 }}>TAP TO HATCH</div>
                          {sameTypeEggs.length >= 3 && (
                            <button onClick={(e) => { e.stopPropagation(); doMerge(egg.rarity, egg.type); }}
                              style={{ marginTop:4, fontFamily:'VT323', fontSize:11, padding:'2px 8px',
                                background:'#b362ff22', border:'1px solid #b362ff', color:'#b362ff', cursor:'pointer' }}>
                              MERGE ×3
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── SHOP ── */}
          {view === 'shop' && (
            <>
              <div style={{ fontFamily:'VT323', color:'var(--ink-dim)', fontSize:14, marginBottom:12 }}>
                Buy pet eggs with 💎 Gems. Higher rarity = stronger pet & higher base stats.
              </div>
              {PET_TYPES.map(petDef => (
                <div key={petDef.id} style={{ background:'#0a0520', border:'1px solid #1a0a2e', borderRadius:6, padding:12, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:28 }}>{petDef.icon}</span>
                    <div>
                      <div style={{ fontFamily:'VT323', fontSize:16, color:'var(--ink)' }}>{petDef.name}</div>
                      <div style={{ fontFamily:'VT323', fontSize:12, color:'var(--ink-dim)' }}>{petDef.type} · {petDef.desc}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {RARITIES.map(r => {
                      const cost = petDef.eggCosts[r];
                      const canAfford = gems >= cost;
                      return (
                        <button key={r} onClick={() => buyEgg(petDef.id, r)} disabled={!canAfford}
                          data-testid={`buy-egg-${petDef.id}-${r}`}
                          style={{ fontFamily:'VT323', fontSize:12, padding:'4px 10px',
                            background: canAfford ? '#0a0520' : '#06030e',
                            border:`1px solid ${RARITY_COLORS[r]}${canAfford?'':'44'}`,
                            color: canAfford ? RARITY_COLORS[r] : '#444', cursor: canAfford ? 'pointer' : 'default' }}>
                          {r.toUpperCase()}<br/>💎{cost}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
