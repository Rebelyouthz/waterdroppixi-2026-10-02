import React, { useState } from 'react';
import { WEAPONS } from '../game/data';
import { WEAPON_PARTS, weaponTracks, trackInfo } from '../game/data_ext';
import { ELEMENTS, STARTER_WEAPONS, STAT_DISPLAY, setProgress, resolveStartWeapon } from '../game/data_ext2';
import { RUNE_RARITY_COLORS, RUNE_RARITIES, getRuneMergeGroups, mergeRunes, rollRune } from '../game/runes';
import { mergeChance, FLUX_PER_MERGE_MAX } from '../game/forge';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon, { ICONS } from './GameIcon';
import { ATTACH_SLOTS, ATTACH_SLOT_INFO, ATTACH_RARITY_COLORS } from '../game/attachments';
import { COMPANIONS, isRescued } from '../game/companions';

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
// `initialSub` only seeds the opening tab — the player can move freely after
// that. It exists so a quest that points at the blueprint shelf lands on the
// blueprint shelf.
export default function Weaponsmith({ save, setSave, onClose, initialSub }) {
  const [sub, setSub] = useState(initialSub || 'parts'); // 'parts' (tuning) | 'runes' (parts+runes) | 'blueprints'
  const [wid, setWid] = useState('hydropistol');
  // The tier button just bought, so it can punch instead of silently
  // flipping to "owned" — cleared after the animation plays once.
  const [justBought, setJustBought] = useState(null);
  const w = WEAPONS[wid];
  const parts = save.weaponParts[wid] || {};
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
    setSave({
      ...save,
      runeInventory: newInv,
      flux: (save.flux || 0) - spend,
      pathMerges: (save.pathMerges || 0) + 1,
    });
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

  // Timmy: "dopamin ska flöda vid upgradera" — this silently swapped a
  // number in state before. Every other spend-gold-get-thing moment in the
  // game (blueprints, rune merges, camp rewards) already goes through the
  // shared toast bus for its confirmation chime + banner; this was the one
  // place that didn't, so buying a tier felt like nothing happened.
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
    const info = trackInfo(wid, w, partKey);
    const tName = (info.tierNames && info.tierNames[tierIdx]) || tier.name;
    pushToast({ tone: 'gold', title: `${info.name}: ${tName}`, text: w.name, icon: wid });
    setJustBought(`${partKey}-${tierIdx}`);
    setTimeout(() => setJustBought(cur => cur === `${partKey}-${tierIdx}` ? null : cur), 420);
  };

  // Timmy: "parts should fit the weapon — sight/scope on things that
  // shouldn't have one, some weapons get it and some don't". Both were
  // already true because this screen never actually asked `trackInfo`/
  // `weaponTracks` (below data_ext.js's own three-layer name system —
  // mechanic -> behaviour ARCHETYPE -> per-weapon override) for anything; it
  // read `WEAPON_PART_OVERRIDES` directly and fell straight back to the raw
  // firearm defaults ("Sight" / Iron-Red Dot-Tactical) for every weapon
  // without a hand-written override, and it never dropped Magazine for
  // weapons with no magazine at all. `trackInfo` already carries the
  // archetype layer (melee -> "Edge"/"Temper", beam -> "Aperture"/"Lens",
  // etc.) for every weapon whether or not a specific override exists, and
  // `weaponTracks` already knows which slots a given weapon should even
  // offer — both were built for this screen and simply never wired in.
  const { tracks: partTracks } = weaponTracks(wid, w);
  const labelFor = (pk) => trackInfo(wid, w, pk);
  const tierNameFor = (pk, tierIdx, defaultName) => {
    const info = trackInfo(wid, w, pk);
    return (info.tierNames && info.tierNames[tierIdx]) || defaultName;
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
  // Blueprints, grouped rather than dumped in one flat list. Three groups,
  // because they answer three different questions:
  //   START   — already yours, pick one to open a run with. No cost.
  //   MANUAL  — you aim these. Crafted with shards.
  //   AUTO    — these fire themselves. Crafted with shards.
  // A weapon with no blueprintCost is unlocked by definition (the katana),
  // which is also what keeps it out of the craft list.
  const blueprintWeapons = Object.keys(STARTER_WEAPONS).filter(k => k !== 'hydropistol');
  const isUnlockedStarter = (id) => {
    const d = STARTER_WEAPONS[id];
    return !d.blueprintCost || crafted[id];
  };
  const weaponKind = (id) => {
    const d = STARTER_WEAPONS[id];
    // STARTER_WEAPONS entries that only put a weapon on the shelf carry no
    // `type` of their own — fall back to the canonical definition in WEAPONS.
    return d.type || (WEAPONS[id] && WEAPONS[id].type) || 'manual';
  };
  // Which starter the next run opens with — resolved by the SAME function
  // GameScreen uses, so the highlighted card and the weapon that actually
  // spawns can never disagree. A stale id shows the pistol here because the
  // pistol is what the run would use.
  const startPick = resolveStartWeapon(save);
  const chooseStart = (id) => {
    if (id === startPick) return;
    setSave({ ...save, startWeapon: id });
    Audio.blueprint();
  };
  const BLUEPRINT_GROUPS = [
    {
      // This group is now a real selector: one of these is what you walk in
      // carrying. The `s_katana` story quest asks the player to open a run
      // with the blade, and this is the control that lets them.
      key: 'start', label: '◈ START WEAPONS', hint: 'Unlocked. Pick the one you walk in carrying — the rest can still be offered during a run.',
      ids: ['hydropistol', ...blueprintWeapons.filter(isUnlockedStarter)],
    },
    {
      key: 'manual', label: '✥ MANUAL — you aim these', hint: 'Crafted with blueprint shards.',
      ids: blueprintWeapons.filter(id => !isUnlockedStarter(id) && weaponKind(id) === 'manual'),
    },
    {
      key: 'auto', label: '✧ AUTO — these fire themselves', hint: 'Crafted with blueprint shards.',
      ids: blueprintWeapons.filter(id => !isUnlockedStarter(id) && weaponKind(id) === 'auto'),
    },
  ].filter(g => g.ids.length > 0);

  // (The loose-parts inventory's state and handlers lived here. Removed with
  // the tab — attachments are the one found-part system now.)

  // What the synergy list measures against: everything this profile could
  // bring into a run. A set whose weapons you have not unlocked yet still
  // shows, greyed — knowing a set exists is the reason to go unlock them.
  const ownedForSyn = [...new Set([
    'hydropistol',
    ...(save.unlockedWeapons || []),
    ...Object.keys(crafted).filter(k => crafted[k]),
  ])];

  return (
    <div className="modal-overlay" data-testid="weaponsmith" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel forge-panel-scrollable">
        <div className="forge-scroll-hint" data-testid="forge-scroll-hint" aria-hidden="true">▾ scroll for more ▾</div>
        <div className="forge-header">
          <div className="forge-title"><GameIcon name="ui_smith" size={18} /> WEAPONSMITH</div>
          <div className="forge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="gold" size={14} /> {save.gold}</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>
        {isRescued(save, 'finn') && (
          <div className="npc-host-line" style={{ '--nc': COMPANIONS.finn.color }}>
            "{COMPANIONS.finn.homeLine}" <i>— Finn</i>
          </div>
        )}

        <div className="gear-tabs" style={{ marginBottom: 12 }}>
          {/* Three axes, and they must not sound like each other:
              TUNING  — permanent per-weapon ladders bought with gold
              PARTS   — found attachments socketed into the five slots
              BLUEPRINTS — shards that craft whole new weapons
              The old "PARTS INVENTORY" tab was a fourth system doing the same
              job as attachments; it is gone, and its contents are migrated. */}
          <button className={`gear-tab ${sub === 'parts' ? 'active' : ''}`} onClick={() => setSub('parts')} data-testid="smith-sub-parts"><GameIcon name="ui_cog" size={13} /> TUNING</button>
          <button className={`gear-tab ${sub === 'runes' ? 'active' : ''}`} onClick={() => setSub('runes')} data-testid="smith-sub-runes"><GameIcon name="ui_cog" size={13} /> PARTS &amp; RUNES</button>
          <button className={`gear-tab ${sub === 'blueprints' ? 'active' : ''}`} onClick={() => setSub('blueprints')} data-testid="smith-sub-blueprints"><GameIcon name="ui_scroll" size={13} /> BLUEPRINTS</button>
          <button className={`gear-tab ${sub === 'synergy' ? 'active' : ''}`} onClick={() => setSub('synergy')} data-testid="smith-sub-synergy">✦ SYNERGY</button>
        </div>

        {sub === 'synergy' && (
          <div className="syn-wrap" data-testid="synergy-list">
            <div className="syn-intro">
              Weapon sets fire the moment you hold every weapon in them during a
              run — and once fired they stay for the rest of it, even if a
              weapon later evolves into something else. Nothing to equip here;
              this is the list, so you know what you are building toward.
            </div>
            {setProgress(ownedForSyn).map(({ set, missing, complete, matched }) => (
              <div key={set.id} className={`syn-row${complete ? ' done' : ''}`} style={{ '--sc': set.accent }}
                   data-testid={`syn-${set.id}`}>
                <span className="syn-icon"><GameIcon name={set.icon} size={20} /></span>
                <div className="syn-body">
                  <div className="syn-name">
                    {set.name}
                    {set.weapons.length > 2 && <i className="syn-trinity">TRINITY</i>}
                  </div>
                  <div className="syn-desc">{set.desc}</div>
                  <div className="syn-weapons">
                    {set.weapons.map(id => (
                      <span key={id} className={`syn-w${missing.includes(id) ? '' : ' have'}`}>
                        {(WEAPONS[id] && WEAPONS[id].name) || id}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="syn-count">{matched}/{set.weapons.length}</span>
              </div>
            ))}
          </div>
        )}

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
            {/* 'element' has its own specialised picker below (it toggles a
                set of elements rather than buying a linear tier), so it is
                excluded here to avoid rendering it twice. */}
            {partTracks.filter(pk => pk !== 'element').map(pk => {
              const part = WEAPON_PARTS[pk];
              const cur = parts[pk] || 0;
              const lbl = labelFor(pk);
              const curTierName = tierNameFor(pk, cur, part.tiers[cur].name);
              return (
                <div className="forge-part" key={pk} data-testid={`part-${pk}`}>
                  <div className="forge-part-h" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><GameIcon name={lbl.icon} size={15} /> {lbl.name} — <span style={{ color: 'var(--accent-2)' }}>{curTierName}</span></div>
                  <div className="forge-tiers">
                    {part.tiers.map((t, i) => {
                      const owned = i <= cur;
                      const canBuy = i === cur + 1 && save.gold >= t.cost;
                      const tName = tierNameFor(pk, i, t.name);
                      return (
                        <button
                          key={i}
                          className={`forge-tier ${owned ? 'owned' : ''}${justBought === `${pk}-${i}` ? ' just-bought' : ''}`}
                          onClick={() => buyTier(pk, i)}
                          disabled={!owned && !canBuy}
                          data-testid={`tier-${pk}-${i}`}
                          style={{ fontSize: 11, padding: '6px 8px' }}
                        >
                          <div>{tName}</div>
                          {!owned && <div style={{ fontSize: 10, color: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}><GameIcon name="gold" size={10} /> {t.cost}</div>}
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
              <div className="forge-part-h" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <GameIcon name="rune" size={14} /> Elemental Rounds — <span style={{ color: 'var(--accent-2)' }}>{equippedElems.length}/{elementSlots} assigned</span>
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
                      <div style={{ color: el.color, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><GameIcon name={el.icon} size={14} /> {el.name}</div>
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
          {BLUEPRINT_GROUPS.map(group => (
            <div key={group.key} className="bp-group">
              <div className="bp-group-head">
                <span className="bp-group-label">{group.label}</span>
                <span className="bp-group-rule" aria-hidden />
              </div>
              <div className="bp-group-hint">{group.hint}</div>
              <div className="upgrade-grid">
                {group.ids.map(id => {
                  const def = STARTER_WEAPONS[id];
                  const have = shards[id] || 0;
                  // A weapon with no shard cost is unlocked by definition.
                  // Rendering it as a craft gave a NaN progress bar and a
                  // FORGE button that "worked" because `0 < undefined` is false.
                  const free = !def.blueprintCost;
                  const c = free || crafted[id];
                  const pct = free ? 100 : Math.min(100, (have / def.blueprintCost) * 100);
                  // Only the START group is selectable — the other two hold
                  // weapons you have not unlocked yet.
                  const selectable = group.key === 'start';
                  const carried = selectable && id === startPick;
                  return (
                    <div
                      className={`upgrade-card${c ? ' bp-owned' : ''}${carried ? ' bp-carried' : ''}`}
                      key={id}
                      data-testid={`craft-${id}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 32 }}><GameIcon name={id} size={32} /></div>
                        <div>
                          <div className="name">{def.name}</div>
                          <div className="lvl">{free ? 'UNLOCKED' : `${have} / ${def.blueprintCost}`}</div>
                        </div>
                      </div>
                      {/* The pistol's starter entry only puts it on the shelf
                          — its text lives in WEAPONS like its stats do. Left
                          on `def.desc` the pistol card renders a blank line
                          where every sibling explains itself. */}
                      <div className="desc">{def.desc || (WEAPONS[id] && WEAPONS[id].desc) || ''}</div>
                      <div className="hud-xpbar"><div className="hud-xpbar-fill" style={{ width: pct + '%' }} /></div>
                      {selectable ? (
                        carried
                          ? <div className="bp-carried-tag" data-testid={`carried-${id}`}>◈ CARRIED INTO THE RUN</div>
                          : <button onClick={() => chooseStart(id)} data-testid={`btn-carry-${id}`}>CARRY THIS</button>
                      ) : (
                        c ? <div style={{ color: 'var(--accent-2)' }}>{free ? '✓ READY' : '✓ CRAFTED'}</div> :
                          <button onClick={() => craft(id)} disabled={have < def.blueprintCost} data-testid={`btn-craft-${id}`}>FORGE</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
              <div style={{ display: 'flex', justifyContent: 'center' }}><GameIcon name="rune" size={36} /></div>
              <div style={{ fontFamily: 'VT323', color: '#4a3a6e', fontSize: 15, marginTop: 8 }}>
                {w.name} isn't a manual weapon — pick one from the row above to socket a rune.
              </div>
            </div>
          ) : (
            <div className="forge-part" data-testid="forge-rune-socket" style={{ marginBottom: 16 }}>
              <div className="forge-part-h" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><GameIcon name="rune" size={14} /> Socketed Rune — {w.name}</div>
              {socketedRuneId ? (() => {
                const r = runeInv.find(x => x.id === socketedRuneId);
                if (!r) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: RUNE_RARITY_COLORS[r.rarity], display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name={r.icon} size={14} /> {r.name}</span>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="ui_cog" size={13} /> ATTACHMENTS</span>
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
                  <div className="atc-empty">Nothing for this slot yet — they drop from patrols and the Lootmine.</div>
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
                <span className="forge-flux-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="cur_shards" size={13} /> FLUX</span>
                <div className="forge-flux-pips">
                  {Array.from({ length: FLUX_PER_MERGE_MAX }).map((_, i) => (
                    <button key={i} className={`forge-flux-pip${i < runeFlux ? ' on' : ''}`}
                            disabled={i >= (save.flux || 0)}
                            onClick={() => setRuneFlux(i + 1 === runeFlux ? i : i + 1)}><GameIcon name="cur_shards" size={11} /></button>
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
                      <span className="gear-popover-name"><GameIcon name={base.icon} size={14} /> {base.name} ×{group.length}</span>
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
                  <div style={{ fontWeight: 800, fontSize: 11, color: RUNE_RARITY_COLORS[r.rarity], display: 'flex', alignItems: 'center', gap: 4 }}><GameIcon name={r.icon} size={13} /> {r.name}</div>
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
