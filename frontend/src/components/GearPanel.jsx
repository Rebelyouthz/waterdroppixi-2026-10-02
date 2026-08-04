import React, { useState } from 'react';
import {
  GEAR_SLOTS, GEAR_SLOT_ICONS, GEAR_SLOT_NAMES,
  GEAR_RARITIES, GEAR_RARITY_COLORS, getMergeGroups, getPendingMergeGroups, mergeItems, generateGearItem,
  GEAR_MAX_LEVEL, gearLevelCost, gearStatValue, gearHasSocket
} from '../game/gear';
import {
  ARTIFACT_SLOT_COUNT, ARTIFACT_RARITY_COLORS, rollArtifact
} from '../game/artifacts';
import { RUNE_GEAR_SLOTS, RUNE_RARITY_COLORS } from '../game/runes';
import { mergeChance, FLUX_PER_MERGE_MAX } from '../game/forge';
import { forgeBonus } from '../game/base';
import { Audio } from '../game/audio';
import { heroBodyPath, HERO_RIG, HERO_COLORS } from '../game/heroShape';

// The paperdoll figure. Same silhouette and rig as the in-game hero, drawn
// as SVG instead of into a canvas. R is in viewBox units.
function HeroDoll({ cosmetics }) {
  const R = 34;
  const [shx, shy] = HERO_RIG.shoulder;
  const [hrx, hry] = HERO_RIG.handRest;
  const hb = HERO_RIG.headband;
  const armPath = (side) =>
    `M ${side * shx * R},${shy * R} L ${side * hrx * R},${hry * R}`;
  return (
    <svg className="gear-doll-char" viewBox="-60 -60 120 130" aria-hidden>
      <defs>
        <radialGradient id="dollBody" cx="38%" cy="26%" r="70%">
          <stop offset="0%" stopColor="#d6f7ff" />
          <stop offset="42%" stopColor={HERO_COLORS.body} />
          <stop offset="100%" stopColor={HERO_COLORS.bodyDeep} />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="0" cy={R * 1.12} rx={R * 0.8} ry={R * 0.22} fill="#000" opacity="0.45" />

      {/* arms behind the body, so the shoulders read as attached */}
      <g stroke={HERO_COLORS.outline} strokeWidth="9" strokeLinecap="round" fill="none">
        <path d={armPath(1)} /><path d={armPath(-1)} />
      </g>
      <g stroke={HERO_COLORS.arm} strokeWidth="5.5" strokeLinecap="round" fill="none">
        <path d={armPath(1)} /><path d={armPath(-1)} />
      </g>

      {/* body */}
      <path d={heroBodyPath(R)} fill="url(#dollBody)" stroke={HERO_COLORS.outline} strokeWidth="3" />

      {/* wet-surface highlights, mirroring the in-game gloss droplets */}
      <ellipse cx={-R * 0.35} cy={-R * 0.5} rx="4.2" ry="6.6" fill="#fff" opacity="0.85" />
      <circle cx={R * 0.3} cy={R * 0.25} r="2.6" fill="#fff" opacity="0.45" />

      {/* hands */}
      <circle cx={hrx * R} cy={hry * R} r="4.2" fill={HERO_COLORS.arm} stroke={HERO_COLORS.outline} strokeWidth="1.6" />
      <circle cx={-hrx * R} cy={hry * R} r="4.2" fill={HERO_COLORS.arm} stroke={HERO_COLORS.outline} strokeWidth="1.6" />

      {/* rank-unlocked headband, same placement as in-game */}
      {cosmetics.headband && cosmetics.headbandColor && (
        <path
          d={`M ${-hb.halfW * R},${hb.y * R} L ${hb.halfW * R},${hb.y * R} L ${hb.halfW * R * 0.9},${(hb.y + hb.drop) * R} L ${-hb.halfW * R * 0.9},${(hb.y + hb.drop) * R} Z`}
          fill={cosmetics.headbandColor} stroke="#000" strokeOpacity="0.4" strokeWidth="1"
        />
      )}
    </svg>
  );
}

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
  const [fluxSpend, setFluxSpend] = useState(0);   // catalysts to burn on the next merge

  const inv = save.gearInventory || [];
  const eq  = save.gearEquipped  || {};
  const artInv = save.artifactInventory || [];
  const artEq  = save.artifactEquipped  || {};
  const runeInv = save.runeInventory || [];
  const gearRunes = save.gearRunes || {};
  const socketGearRune = (slot, runeId) => setSave({ ...save, gearRunes: { ...gearRunes, [slot]: runeId } });
  const unsocketGearRune = (slot) => { const gr = { ...gearRunes }; delete gr[slot]; setSave({ ...save, gearRunes: gr }); };

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

  // Merging is a gamble now (see game/forge.js). Flux catalysts raise the
  // odds and are spent whether or not the roll lands — that's what makes
  // deciding how many to burn an actual decision.
  // Level a piece with Gear Parts. Levels are what makes a drop grow into
  // something; rarity is a separate, much rarer axis on top.
  const levelUpGear = (item) => {
    const lvl = item.level || 1;
    if (lvl >= GEAR_MAX_LEVEL) return;
    const cost = gearLevelCost(lvl, item.rarity);
    if ((save.gearParts || 0) < cost) { showToast(`Need ${cost} gear parts`); return; }
    setSave({
      ...save,
      gearParts: save.gearParts - cost,
      gearInventory: inv.map(x => (x.id === item.id ? { ...x, level: lvl + 1 } : x)),
    });
    Audio.claimPing();
    if (lvl + 1 === GEAR_MAX_LEVEL) showToast(`${item.name} is finished — it can be forged now`);
  };

  const tryMerge = (slot, rarity, flux = 0) => {
    // Only finished pieces feed the forge (see getMergeGroups).
    const candidates = inv.filter(x => x.slot === slot && x.rarity === rarity && (x.level || 1) >= GEAR_MAX_LEVEL);
    if (candidates.length < 3) return;
    const spend = Math.max(0, Math.min(FLUX_PER_MERGE_MAX, flux, save.flux || 0));
    // The Forge building's contribution is a separate flat bonus, not extra
    // flux — flux is capped, so folding it in there would be clamped away.
    const { inventory: newInv, newItem, result } =
      mergeItems(inv, candidates.slice(0, 3).map(x => x.id), spend, forgeBonus(save));
    if (!result || result.atMax) return;
    setSave({ ...save, gearInventory: newInv, flux: (save.flux || 0) - spend });
    if (result.ok) {
      showToast(`✦ SUCCESS → ${newItem?.name} [${newItem?.rarity?.toUpperCase()}]`);
      Audio.levelUp();
    } else {
      showToast(`✖ MERGE FAILED — 2 lost, 1 left (${Math.round(result.chance * 100)}% chance)`);
      Audio.hit();
    }
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
  const pendingGroups = getPendingMergeGroups(inv);

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
            {/* The actual in-game character, not an approximation of it. The
                outline comes from game/heroShape.js, which pixiRenderer's
                _drawPlayer reads too — this used to be a stack of CSS divs
                (head, torso, arms, legs) and looked like a different
                character entirely. */}
            <HeroDoll cosmetics={save.profile || {}} />
            <div className="doll-glow" aria-hidden />
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
              {RUNE_GEAR_SLOTS.includes(popoverSlot) && (
                <div style={{ marginTop: 10, borderTop: '1px solid #2a1a4e', paddingTop: 8 }}>
                  <div style={{ fontFamily: 'VT323', fontSize: 12, color: 'var(--accent-2)', letterSpacing: '0.1em', marginBottom: 4 }}>🔮 SOCKETED RUNE</div>
                  {gearRunes[popoverSlot] ? (() => {
                    const r = runeInv.find(x => x.id === gearRunes[popoverSlot]);
                    if (!r) return null;
                    return (
                      <div className="gear-popover-row" style={{ '--rc': RUNE_RARITY_COLORS[r.rarity] }} onClick={() => unsocketGearRune(popoverSlot)}>
                        <span className="gear-popover-name">{r.icon} {r.name}</span>
                        <span className="gear-popover-stat">+{r.val} {STAT_LABELS[r.stat] || r.stat} (click to unsocket)</span>
                      </div>
                    );
                  })() : (
                    runeInv.length === 0
                      ? <div className="gear-popover-empty">No runes yet — play Star Raid's Rune Run.</div>
                      : runeInv.map(r => (
                        <div key={r.id} className="gear-popover-row" style={{ '--rc': RUNE_RARITY_COLORS[r.rarity] }} onClick={() => socketGearRune(popoverSlot, r.id)}>
                          <span className="gear-popover-name">{r.icon} {r.name}</span>
                          <span className="gear-popover-stat">+{r.val} {STAT_LABELS[r.stat] || r.stat}</span>
                        </div>
                      ))
                  )}
                </div>
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
          <div className="gear-parts-bar">
            <span className="gear-parts-label">🔩 GEAR PARTS</span>
            <span className="gear-parts-val">{save.gearParts || 0}</span>
            <span className="gear-parts-hint">Level a piece to {GEAR_MAX_LEVEL} before it can be forged up a rarity</span>
          </div>
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
                  <div className="gear-item-icon">
                    {GEAR_SLOT_ICONS[item.slot]}
                    {gearHasSocket(item) && <span className="gear-socket-dot" title="Rune socket">◈</span>}
                  </div>
                  <div className="gear-item-info">
                    <span className="gear-item-name" style={{ color: GEAR_RARITY_COLORS[item.rarity] }}>
                      {item.name}
                      <span className="gear-item-lvl">Lv{item.level || 1}</span>
                    </span>
                    <span className="gear-item-stat">{fmtVal(item.stat, gearStatValue(item))} {STAT_LABELS[item.stat]}</span>
                    {/* Level track: the piece's own progress toward being
                        forgeable, readable without opening anything. */}
                    <span className="gear-lvl-track">
                      {Array.from({ length: GEAR_MAX_LEVEL }).map((_, i) => (
                        <i key={i} className={i < (item.level || 1) ? 'on' : ''} />
                      ))}
                    </span>
                    {isEquipped && <span className="gear-equipped-badge">EQ</span>}
                  </div>
                  {(item.level || 1) < GEAR_MAX_LEVEL ? (
                    <button
                      className="gear-lvl-btn"
                      disabled={(save.gearParts || 0) < gearLevelCost(item.level || 1, item.rarity)}
                      onClick={(ev) => { ev.stopPropagation(); levelUpGear(item); }}
                      data-testid={`gear-lvl-${item.id}`}
                    >
                      ▲ 🔩{gearLevelCost(item.level || 1, item.rarity)}
                    </button>
                  ) : (
                    <span className="gear-lvl-max">MAX</span>
                  )}
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
          <div className="gear-forge-title">FORGE — Merge 3 of same type &amp; rarity → chance at higher rarity</div>
          <div className="forge-flux-bar">
            <span className="forge-flux-label">⚗ FLUX CATALYST</span>
            <div className="forge-flux-pips">
              {Array.from({ length: FLUX_PER_MERGE_MAX }).map((_, i) => (
                <button
                  key={i}
                  className={`forge-flux-pip${i < fluxSpend ? ' on' : ''}`}
                  disabled={i >= (save.flux || 0)}
                  onClick={() => setFluxSpend(i + 1 === fluxSpend ? i : i + 1)}
                  title={i >= (save.flux || 0) ? 'Not enough Flux' : `Use ${i + 1}`}
                >⚗</button>
              ))}
            </div>
            <span className="forge-flux-have">{save.flux || 0} held · +15% each</span>
          </div>
          <div className="forge-warn">
            A failed merge destroys 2 of the 3. Flux is spent either way.
          </div>
          {/* What you are waiting on. Without this the forge just looks empty
              while you have nine of something, and the level gate reads as a
              bug rather than as a rule. */}
          {pendingGroups.length > 0 && (
            <div className="forge-pending">
              {pendingGroups.map(g => {
                const b = g[0];
                const done = g.filter(i => (i.level || 1) >= GEAR_MAX_LEVEL).length;
                return (
                  <div key={`p_${b.slot}_${b.rarity}`} className="forge-pending-row">
                    <span style={{ color: GEAR_RARITY_COLORS[b.rarity] }}>
                      {GEAR_SLOT_ICONS[b.slot]} {b.rarity.toUpperCase()} {GEAR_SLOT_NAMES[b.slot]}
                    </span>
                    <span className="forge-pending-need">{done}/3 at Lv{GEAR_MAX_LEVEL}</span>
                  </div>
                );
              })}
            </div>
          )}
          {mergeGroups.length === 0 ? (
            <div className="gear-empty">
              <div style={{ fontSize:36 }}>🔨</div>
              <div style={{ fontFamily:'VT323', color:'#4a3a6e', fontSize:15, marginTop:8 }}>
                Three of the same piece, all at level {GEAR_MAX_LEVEL}
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
                        onClick={() => tryMerge(base.slot, base.rarity, fluxSpend)}
                        data-testid={`forge-${base.slot}-${base.rarity}`}
                      >
                        FORGE → {nextRar.toUpperCase()}
                        <span className="forge-odds">
                          {Math.round(mergeChance(GEAR_RARITIES.indexOf(base.rarity) + 1, Math.min(fluxSpend, save.flux || 0)) * 100)}%
                        </span>
                      </button>
                    )}
                    {!nextRar && <span style={{ color:'#ff3146', fontFamily:'VT323' }}>MYTHICAL MAX</span>}
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
