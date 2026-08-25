import React, { useState } from 'react';
import {
  GEAR_SLOTS, GEAR_SLOT_ICONS, GEAR_SLOT_NAMES,
  GEAR_RARITIES, GEAR_RARITY_COLORS, getMergeGroups, getPendingMergeGroups, mergeItems,
  GEAR_MAX_LEVEL, gearLevelCost, gearStatValue, gearSocketCount,
  GEAR_SETS, GEAR_SET_IDS, itemSet, equippedSetCounts,
  PART_NAMES, WILDCARD_PART_RATE,
  slotPartsOf, gearLevelPayment, GEAR_BASE_INDEX,
  GEAR_STAT_LABELS as STAT_LABELS, fmtGearVal as fmtVal,
} from '../game/gear';
import GameIcon from './GameIcon';
import {
  ARTIFACT_SLOT_COUNT, ARTIFACT_RARITY_COLORS, rollArtifact
} from '../game/artifacts';
import { RUNE_RARITY_COLORS, gearRunesFor } from '../game/runes';
import { mergeChance, FLUX_PER_MERGE_MAX } from '../game/forge';
import { forgeBonus } from '../game/base';
import { Audio } from '../game/audio';
import { heroBodyPath, HERO_RIG, HERO_COLORS } from '../game/heroShape';
import { COMPANIONS, isRescued } from '../game/companions';

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

      {/* Headband and cigar, matching the in-game render. Both are the
          character's default look rather than rank unlocks — the paperdoll
          showing a bare blob while the same drop wore a bandage and smoked in
          play was the two views disagreeing about who the player is. The
          cosmetic field only overrides the colour. */}
      {(() => {
        const band = cosmetics.headbandColor || '#d9cba8';
        const bandY = hb.y * R * 0.87;
        const wraps = [
          { dy: -R * 0.11, h: R * 0.115 },
          { dy: 0, h: R * 0.135 },
          { dy: R * 0.10, h: R * 0.10 },
        ];
        return (
          <g>
            {wraps.map((w, i) => (
              <rect key={i}
                x={-hb.halfW * R} y={bandY + w.dy - w.h}
                width={hb.halfW * 2 * R} height={w.h * 2}
                fill={band} stroke="#000" strokeOpacity="0.28" strokeWidth="0.8"
                transform={`rotate(${i === 0 ? -3 : i === 1 ? 2 : -1} 0 ${bandY})`}
              />
            ))}
            {/* knot + tails on the right, same side as in-game */}
            <circle cx={hb.halfW * R} cy={bandY} r={R * 0.13} fill={band} stroke="#000" strokeOpacity="0.3" strokeWidth="0.8" />
            <path d={`M ${hb.halfW * R},${bandY - R * 0.05} L ${hb.halfW * R + R * 0.46},${bandY + R * 0.20} L ${hb.halfW * R + R * 0.44},${bandY + R * 0.30} L ${hb.halfW * R},${bandY + R * 0.07} Z`} fill={band} opacity="0.9" />
            <path d={`M ${hb.halfW * R},${bandY - R * 0.02} L ${hb.halfW * R + R * 0.28},${bandY + R * 0.34} L ${hb.halfW * R + R * 0.24},${bandY + R * 0.42} L ${hb.halfW * R},${bandY + R * 0.09} Z`} fill={band} opacity="0.8" />
            {/* cigar, jaw height, right side */}
            <g transform={`rotate(16 ${R * 0.30} ${-R * 0.10})`}>
              <rect x={R * 0.30} y={-R * 0.155} width={R * 0.62} height={R * 0.11} fill="#6b5230" />
              <rect x={R * 0.44} y={-R * 0.155} width={R * 0.075} height={R * 0.11} fill="#b8873a" />
              <circle cx={R * 0.92} cy={-R * 0.10} r={R * 0.055} fill="#ffb347" />
            </g>
          </g>
        );
      })()}
    </svg>
  );
}

const ART_RARITY_ORDER = ['common','magic','rare','epic','legendary','mythical'];

// Same formatting but sign-aware — artifacts can roll negative (drawback) stats.
function fmtSigned(stat, val) {
  const pct = ['dmg','atks','mspd','dodge','pickup','crit','critd','xp','gold','area','pierce','proj','regen'].includes(stat);
  const sign = val >= 0 ? '+' : '';
  return pct ? `${sign}${(val * 100).toFixed(1)}%` : `${sign}${val}`;
}

export default function GearPanel({ save, setSave, onFight, onBack }) {
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('equip'); // 'equip' | 'inventory' | 'merge' | 'artifacts'
  const [toast, setToast] = useState('');
  const [selectedArt, setSelectedArt] = useState(null);
  const [popoverSlot, setPopoverSlot] = useState(null);      // gear slot name, e.g. 'helmet'
  const [popoverAnchor, setPopoverAnchor] = useState(null);   // {left, top, side} in doll-space px
  const [popoverArtSlot, setPopoverArtSlot] = useState(null); // artifact slot index
  const [gachaReveal, setGachaReveal] = useState(null);
  const [fluxSpend, setFluxSpend] = useState(0);   // catalysts to burn on the next merge

  const inv = save.gearInventory || [];
  const eq  = save.gearEquipped  || {};
  const artInv = save.artifactInventory || [];
  const artEq  = save.artifactEquipped  || {};
  const runeInv = save.runeInventory || [];
  const gearRunes = save.gearRunes || {};
  // Runes are keyed by ITEM id, not by slot, so they travel with the piece they
  // were set into instead of staying behind when you swap gear.
  const socketGearRune = (item, runeId, socketIdx) => {
    if (!item) return;
    const cur = gearRunesFor(save, item);
    const next = cur.slice(0, gearSocketCount(item));
    next[socketIdx] = runeId;
    setSave({ ...save, gearRunes: { ...gearRunes, [item.id]: next } });
  };
  const unsocketGearRune = (item, socketIdx) => {
    if (!item) return;
    const next = gearRunesFor(save, item).slice();
    next[socketIdx] = null;
    setSave({ ...save, gearRunes: { ...gearRunes, [item.id]: next } });
  };

  const setCounts = equippedSetCounts(save);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1600); };

  const equipItem = (item) => {
    setSave({ ...save, gearEquipped: { ...eq, [item.slot]: item.id } });
    showToast(`Equipped: ${item.name}`);
    Audio.click();
    setSelected(null);
    setPopoverSlot(null);
  };

  const unequipSlot = (slot) => {
    const newEq = { ...eq };
    delete newEq[slot];
    setSave({ ...save, gearEquipped: newEq });
    Audio.click();
  };

  // Merging is a gamble now (see game/forge.js). Flux catalysts raise the
  // odds and are spent whether or not the roll lands — that's what makes
  // deciding how many to burn an actual decision.
  // Level a piece with Gear Parts. Levels are what makes a drop grow into
  // something; rarity is a separate, much rarer axis on top.
  // Work out where to float the quick-equip popover for the slot that was just
  // tapped. The popover used to render after the whole slot grid as a plain
  // block, so it always appeared at the BOTTOM no matter which slot you hit --
  // on a phone that meant tapping a helmet and having the menu open somewhere
  // off past your thumb.
  //
  // Positions are in the offsetParent's coordinate space (the slot grid, which
  // the stylesheet makes position: relative), so this stays correct while the
  // panel scrolls -- a viewport-space rect would drift the moment it moved.
  const POPOVER_W = 260;
  const anchorFor = (el) => {
    const parent = el.offsetParent;                     // .gear-doll-bg
    if (!parent || typeof window === 'undefined') return null;
    const gap = 10;

    // Clamping is done against the VIEWPORT, not against the parent. The doll
    // box is only 280px wide, so a 260px popover can never sit beside a slot
    // within it -- clamping to the parent would collapse every placement to
    // "below" and shove it to the same spot every time. The popover is allowed
    // to overflow the doll box; it just must not leave the screen.
    const prect = parent.getBoundingClientRect();
    const vw = window.innerWidth || 390;
    const margin = 8;
    const toViewport = (l) => prect.left + l;
    const fits = (l) => toViewport(l) >= margin && toViewport(l) + POPOVER_W <= vw - margin;

    const rightOf = el.offsetLeft + el.offsetWidth + gap;
    const leftOf  = el.offsetLeft - gap - POPOVER_W;

    let left; let side;
    if (fits(rightOf))     { left = rightOf; side = 'right'; }
    else if (fits(leftOf)) { left = leftOf;  side = 'left'; }
    else {
      // Nothing fits either side on a narrow screen, so sit it directly under
      // the slot -- still right where the finger landed, which is the point.
      // Never back down at the bottom of the page.
      const centred = el.offsetLeft + el.offsetWidth / 2 - POPOVER_W / 2;
      const clampedVp = Math.max(margin, Math.min(vw - margin - POPOVER_W, toViewport(centred)));
      left = clampedVp - prect.left;
      side = 'below';
    }
    const top = side === 'below'
      ? el.offsetTop + el.offsetHeight + gap
      : Math.max(0, el.offsetTop + el.offsetHeight / 2 - 90);
    return { left, top, side };
  };

  const levelUpGear = (item) => {
    const lvl = item.level || 1;
    if (lvl >= GEAR_MAX_LEVEL) return;
    const cost = gearLevelCost(lvl, item.rarity);
    // Slot parts first, generic parts as a 2:1 wildcard for the shortfall.
    // gearLevelPayment owns that rule so the button's enabled state and the
    // actual spend can never disagree about what is affordable.
    const pay = gearLevelPayment(save, item.slot, cost);
    if (!pay) {
      const short = cost - slotPartsOf(save, item.slot);
      showToast(`Need ${cost} ${PART_NAMES[item.slot]} — short ${short} (or ${short * WILDCARD_PART_RATE} generic parts)`);
      return;
    }
    setSave({
      ...save,
      gearSlotParts: { ...(save.gearSlotParts || {}), [item.slot]: slotPartsOf(save, item.slot) - pay.useSlot },
      gearParts: (save.gearParts || 0) - pay.useWild,
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
    // pathMerges counts ATTEMPTS, not successes — The Path's forge step asks
    // you to take the gamble, and losing it is the lesson.
    setSave({
      ...save,
      gearInventory: newInv,
      flux: (save.flux || 0) - spend,
      pathMerges: (save.pathMerges || 0) + 1,
    });
    if (result.ok) {
      showToast(`✦ SUCCESS → ${newItem?.name} [${newItem?.rarity?.toUpperCase()}]`);
      // A merge consumes three items to make one, so it gets its own voice
      // rather than borrowing the level-up chime: metal drawn together, a
      // strike, then the ring of the result. The failure case falls in pitch
      // instead of rising, so you can hear which happened without reading.
      Audio.mergeForge(true);
    } else {
      showToast(`✖ MERGE FAILED — 2 lost, 1 left (${Math.round(result.chance * 100)}% chance)`);
      Audio.mergeForge(false);
    }
  };

  // DEBUG: grant a random item

  const mergeGroups = getMergeGroups(inv);
  const pendingGroups = getPendingMergeGroups(inv);

  // ---- Artifacts handlers ----
  const equipArtifact = (item, slotIdx) => {
    setSave({ ...save, artifactEquipped: { ...artEq, [slotIdx]: item.id } });
    showToast(`Equipped: ${item.name}`);
    Audio.click();
    setSelectedArt(null);
  };
  const unequipArtifactSlot = (slotIdx) => {
    const newEq = { ...artEq };
    delete newEq[slotIdx];
    setSave({ ...save, artifactEquipped: newEq });
    Audio.click();
  };
  const discardArtifact = (id) => {
    const newEq = { ...artEq };
    for (const k of Object.keys(newEq)) if (newEq[k] === id) delete newEq[k];
    setSave({ ...save, artifactInventory: artInv.filter(x => x.id !== id), artifactEquipped: newEq });
    setSelectedArt(null);
    Audio.click();
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
        {/* Both `+ Grant Item` and `+ Grant Artifact` DEBUG buttons lived here
            and shipped to players. Their own comment said so: "bypasses tokens,
            for testing". Timmy, 2026-08-23: "trycker man pa knappen sa kommer
            de en artifact varje gang.. ska val inte ens va en knapp de ska ju
            vara sa man kor gacha eller star atlas".

            He is right, and there are THREE real sources the button was
            quietly making pointless:
              - Eye of Horus  -> a guaranteed artifact          (App.js)
              - campaign victory -> a bigger pull + 2 tokens    (App.js)
              - the Gacha Machine -> costs a Gacha Token, earned
                from Void Titan and Star Raid s final stage
            Replaced with the thing an empty shelf actually needs: where to go
            and get one. Same fix as the Weaponsmith s `+ Grant Rune`. */}
        {tab !== 'artifacts' && inv.length === 0 && (
          <span className="loot-source-hint">DROPS FROM RUNS &middot; CHESTS &middot; BOSSES</span>
        )}
        {tab === 'artifacts' && artInv.length === 0 && (
          <span className="loot-source-hint">EYE OF HORUS &middot; CAMPAIGN VICTORY &middot; GACHA</span>
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
                  onClick={(e) => {
                    if (popoverSlot === slot) { setPopoverSlot(null); return; }
                    setPopoverAnchor(anchorFor(e.currentTarget));
                    setPopoverSlot(slot);
                  }}
                  data-testid={`gear-slot-${slot}`}
                >
                  {item ? (
                    <>
                      {/* The base type's own glyph, tinted by rarity, rather
                          than one shared emoji per slot — five helmets used to
                          be five copies of the same picture. Falls back to the
                          slot emoji for items generated before base types
                          existed. */}
                      <span className="gear-slot-icon" style={{ color: GEAR_RARITY_COLORS[item.rarity] }}>
                        {GEAR_BASE_INDEX[item.base]
                          ? <GameIcon name={GEAR_BASE_INDEX[item.base].icon} tone={GEAR_RARITY_COLORS[item.rarity]} size={26} />
                          : <GameIcon name={GEAR_SLOT_ICONS[slot]} size={26} />}
                      </span>
                      <span className="gear-slot-stat">{fmtVal(item.stat, gearStatValue(item))}</span>
                    </>
                  ) : (
                    <span className="gear-slot-empty-icon" style={{ opacity: 0.25 }}>
                      <GameIcon name={GEAR_SLOT_ICONS[slot]} size={26} />
                    </span>
                  )}
                  <span className="gear-slot-label">{GEAR_SLOT_NAMES[slot]}</span>
                </div>
              );
            })}

          {/* Quick equip popover — opens BESIDE the slot that was tapped (see
              anchorFor). It lives inside .gear-doll-bg deliberately: the slots
              measure their offsets against that box, so the popover has to be
              positioned in the same coordinate space or the two would disagree
              and it would land somewhere arbitrary. */}
          {popoverSlot && (
            <div
              className={`gear-popover gear-popover-anchored${popoverAnchor && popoverAnchor.side === 'left' ? ' from-right' : ''}`}
              style={popoverAnchor ? { left: popoverAnchor.left, top: popoverAnchor.top } : undefined}
              data-testid="gear-popover">
              <div className="gear-popover-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><GameIcon name={GEAR_SLOT_ICONS[popoverSlot]} size={16} /> {GEAR_SLOT_NAMES[popoverSlot].toUpperCase()}</span>
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
                      <span className="gear-popover-name">
                        {item.name}
                        {/* The set tag is on the row you choose FROM — a set
                            list you can only read after equipping cannot
                            influence which piece you equip. */}
                        {(() => { const st = GEAR_SETS[itemSet(item)]; return st
                          ? <i className="gear-set-tag" style={{ '--sc': st.accent, display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name={st.icon} size={12} /> {st.name}</i>
                          : null; })()}
                      </span>
                      <span className="gear-popover-stat">{fmtVal(item.stat, gearStatValue(item))} {STAT_LABELS[item.stat]}</span>
                      {item.secondary && <span className="gear-popover-armor">+{item.secondary.val} armor</span>}
                      {eq[popoverSlot] === item.id && <span className="gear-popover-badge">EQ</span>}
                    </div>
                  ))}
              </div>
              {eq[popoverSlot] && (
                <button className="gear-btn unequip" style={{ width: '100%', marginTop: 8 }}
                  onClick={() => { unequipSlot(popoverSlot); }}>UNEQUIP</button>
              )}
              {/* Socketing is gated on the ITEM's socket count, not on which
                  slot it happens to be. The old gate was
                  RUNE_GEAR_SLOTS.includes(slot), so an epic helmet that rolled
                  a socket showed a socket pip in the list and then had no way
                  to ever put a rune in it. */}
              {(() => {
                const worn = inv.find(x => x.id === eq[popoverSlot]);
                const count = gearSocketCount(worn);
                if (!worn || count < 1) return null;
                const set = gearRunesFor(save, worn);
                const usedIds = new Set(set.filter(Boolean));
                return (
                  <div style={{ marginTop: 10, borderTop: '1px solid #2a1a4e', paddingTop: 8 }}>
                    <div style={{ fontFamily: 'VT323', fontSize: 12, color: 'var(--accent-2)', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GameIcon name="rune" size={13} /> RUNE SOCKETS ({set.filter(Boolean).length}/{count})
                    </div>
                    {Array.from({ length: count }, (_, i) => {
                      const rid = set[i];
                      const r = rid ? runeInv.find(x => x.id === rid) : null;
                      if (r) {
                        return (
                          <div key={i} className="gear-popover-row" style={{ '--rc': RUNE_RARITY_COLORS[r.rarity] }}
                               onClick={() => unsocketGearRune(worn, i)}>
                            <span className="gear-popover-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name={r.icon} size={13} /> {r.name}</span>
                            <span className="gear-popover-stat">+{r.val} {STAT_LABELS[r.stat] || r.stat} (click to unsocket)</span>
                          </div>
                        );
                      }
                      // An empty socket lists what could go into it. Runes
                      // already set into this piece are filtered out so the
                      // same rune cannot be placed in two sockets at once.
                      const free = runeInv.filter(x => !usedIds.has(x.id));
                      return (
                        <div key={i} style={{ marginBottom: 6 }}>
                          <div className="gear-popover-empty" style={{ padding: '4px 0', textAlign: 'left' }}>
                            ◈ Empty socket {i + 1}
                          </div>
                          {free.length === 0
                            ? <div className="gear-popover-empty">No spare runes — play Star Raid's Rune Run.</div>
                            : free.map(r2 => (
                              <div key={r2.id} className="gear-popover-row" style={{ '--rc': RUNE_RARITY_COLORS[r2.rarity] }}
                                   onClick={() => socketGearRune(worn, r2.id, i)}>
                                <span className="gear-popover-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name={r2.icon} size={13} /> {r2.name}</span>
                                <span className="gear-popover-stat">+{r2.val} {STAT_LABELS[r2.stat] || r2.stat}</span>
                              </div>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
          </div>

          {/* Stats summary matching Reference Image 1 */}
          <div className="gear-stats-summary">
            <div className="gear-stats-title">EQUIPPED BONUSES</div>
            <div className="gear-stats-grid-2col">
              {GEAR_SLOTS.map(slot => {
                const item = inv.find(x => x.id === eq[slot]);
                if (!item) return null;
                return (
                  <div key={slot} className="gear-stat-row" style={{ color: GEAR_RARITY_COLORS[item.rarity] }}>
                    <span className="gear-stat-icon"><GameIcon name={GEAR_SLOT_ICONS[slot]} size={16} /></span>
                    <span className="gear-stat-name">{item.name}</span>
                    <span className="gear-stat-val">+{fmtVal(item.stat, gearStatValue(item))} {STAT_LABELS[item.stat]}</span>
                  </div>
                );
              })}
            </div>
            {Object.keys(eq).length === 0 && (
              <div style={{ color:'#4a3a6e', fontSize:11, marginTop:8 }}>No items equipped. Find gear during runs!</div>
            )}
          </div>

          {/* Sets. Shown for every set you own a piece of, not only the ones
              already paying — the whole value of a set list is telling you
              you are one piece away. */}
          <div className="gear-sets" data-testid="gear-sets">
            <div className="gear-stats-title">SET BONUSES</div>
            {GEAR_SET_IDS.filter(id => (setCounts[id] || 0) > 0).length === 0 && (
              <div style={{ color:'#4a3a6e', fontSize:11, marginTop:6 }}>
                Every piece belongs to a set. Equip two of the same one to start it.
              </div>
            )}
            {GEAR_SET_IDS.map(id => {
              const n = setCounts[id] || 0;
              if (n === 0) return null;
              const set = GEAR_SETS[id];
              return (
                <div key={id} className="gset-row" style={{ '--sc': set.accent }}>
                  <span className="gset-icon"><GameIcon name={set.icon} size={18} /></span>
                  <span className="gset-name">{set.name}</span>
                  <span className="gset-count">{n}/4</span>
                  <div className="gset-tiers">
                    <div className={`gset-tier${n >= 2 ? ' on' : ''}`}><b>2</b> {set.t2.label}</div>
                    <div className={`gset-tier${n >= 4 ? ' on' : ''}`}><b>4</b> {set.t4.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div className="gear-inventory">
          <div className="gear-parts-bar">
            <span className="gear-parts-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="ui_cog" size={13} /> GEAR PARTS</span>
            <span className="gear-parts-val">{save.gearParts || 0}</span>
            <span className="gear-parts-hint">Level a piece to {GEAR_MAX_LEVEL} before it can be forged up a rarity</span>
          </div>
          {inv.length === 0 && (
            <div className="gear-empty">
              <div style={{ display: 'flex', justifyContent: 'center' }}><GameIcon name="gear" size={40} /></div>
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
                    {GEAR_BASE_INDEX[item.base]
                      ? <GameIcon name={GEAR_BASE_INDEX[item.base].icon} tone={GEAR_RARITY_COLORS[item.rarity]} size={28} />
                      : GEAR_SLOT_ICONS[item.slot]}
                    {gearSocketCount(item) > 0 && (
                      <span className="gear-socket-dot" title={`${gearSocketCount(item)} rune socket(s)`}>
                        {'◈'.repeat(gearSocketCount(item))}
                      </span>
                    )}
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
                      ▲ <GameIcon name="ui_cog" size={12} />{gearLevelCost(item.level || 1, item.rarity)}
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
              <div className="gear-detail-name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><GameIcon name={GEAR_SLOT_ICONS[selected.slot]} size={16} /> {selected.name}</div>
              <div className="gear-detail-rarity" style={{ color: GEAR_RARITY_COLORS[selected.rarity] }}>
                {selected.rarity.toUpperCase()} {GEAR_SLOT_NAMES[selected.slot]}
              </div>
              <div className="gear-detail-stat">{fmtVal(selected.stat, gearStatValue(selected))} {STAT_LABELS[selected.stat]}</div>
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
          {isRescued(save, 'mira') && (
            <div className="npc-host-line" style={{ '--nc': COMPANIONS.mira.color }}>
              "{COMPANIONS.mira.homeLine}" <i>— Mira</i>
            </div>
          )}
          <div className="forge-flux-bar">
            <span className="forge-flux-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="cur_shards" size={13} /> FLUX CATALYST</span>
            <div className="forge-flux-pips">
              {Array.from({ length: FLUX_PER_MERGE_MAX }).map((_, i) => (
                <button
                  key={i}
                  className={`forge-flux-pip${i < fluxSpend ? ' on' : ''}`}
                  disabled={i >= (save.flux || 0)}
                  onClick={() => setFluxSpend(i + 1 === fluxSpend ? i : i + 1)}
                  title={i >= (save.flux || 0) ? 'Not enough Flux' : `Use ${i + 1}`}
                ><GameIcon name="cur_shards" size={11} /></button>
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
                    <span style={{ color: GEAR_RARITY_COLORS[b.rarity], display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <GameIcon name={GEAR_SLOT_ICONS[b.slot]} size={14} /> {b.rarity.toUpperCase()} {GEAR_SLOT_NAMES[b.slot]}
                    </span>
                    <span className="forge-pending-need">{done}/3 at Lv{GEAR_MAX_LEVEL}</span>
                  </div>
                );
              })}
            </div>
          )}
          {mergeGroups.length === 0 ? (
            <div className="gear-empty">
              <div style={{ display: 'flex', justifyContent: 'center' }}><GameIcon name="ui_smith" size={36} /></div>
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
            <div className="gacha-machine-icon"><GameIcon name="cur_slot" size={30} /></div>
            <div className="gacha-machine-info">
              <div className="gacha-machine-title">ARTIFACT GACHA MACHINE</div>
              <div className="gacha-machine-sub">Clear Star Raid's final stage to earn tokens.</div>
            </div>
            <div className="gacha-machine-tokens" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="ui_ticket" size={15} /> ×{gachaTokens}</div>
            <button className="gear-btn equip" disabled={gachaTokens <= 0}
              style={{ opacity: gachaTokens > 0 ? 1 : 0.4 }}
              onClick={pullGacha} data-testid="gacha-pull-btn">PULL</button>
          </div>

          {gachaReveal && (
            <div className="modal-overlay" onClick={() => setGachaReveal(null)}>
              <div className="gacha-reveal" style={{ '--rc': ARTIFACT_RARITY_COLORS[gachaReveal.rarity] }}
                onClick={(e) => e.stopPropagation()}>
                <div className="gacha-reveal-icon"><GameIcon name="ui_orb" size={40} /></div>
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
                      <span className="artifact-slot-icon"><GameIcon name="ui_orb" size={24} /></span>
                      <span className="artifact-slot-name">{item.name}</span>
                    </>
                  ) : (
                    <span className="artifact-slot-empty-icon"><GameIcon name="ui_orb" size={24} /></span>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><GameIcon name="ui_orb" size={15} /> ARTIFACT SLOT {popoverArtSlot + 1}</span>
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
              <div style={{ display: 'flex', justifyContent: 'center' }}><GameIcon name="ui_orb" size={40} /></div>
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
                  <div className="gear-item-icon"><GameIcon name="ui_orb" size={28} /></div>
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
              <div className="gear-detail-name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><GameIcon name="ui_orb" size={16} /> {selectedArt.name}</div>
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

      {/* Bottom Action Bar matching Reference Image 1 */}
      {tab === 'equip' && (
        <div className="gear-bottom-actions">
          <button className="gear-action-btn back" onClick={onBack || (() => {})}>BACK</button>
          <button className="gear-action-btn fight" onClick={onFight || (() => {})}>FIGHT</button>
        </div>
      )}
    </div>
  );
}
