import React, { useState, useEffect } from 'react';
import {
  PROBE_UPGRADES, probeCost, probeStats, PROSPECT_CARDS,
  hazardChance, rollLayer, oreYield, rollCardBonus,
} from '../game/prospector';
import { rollCard } from '../game/petTcg';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';
import { fireClaimFx } from './ClaimFx';

// Astro Prospector. A dive is entirely client-side state — only banking
// writes to the save, which is also what makes "lose it all" mean something.
export default function ProspectorScreen({ save, setSave, onClose }) {
  // Same in-game/Star Atlas playlist as a run — swapped back to menu music
  // on close, same convention GameScreen uses.
  useEffect(() => {
    // Menu track, not the run playlist.
    Audio.swapToMenuMusic();
    return () => Audio.swapToMenuMusic();
  }, []);

  const [tab, setTab] = useState('dive'); // 'dive' | 'probe' | 'cards'
  const levels = save.probe || {};
  const stats = probeStats(levels);

  const unlocked = save.prospectCards || [];
  const lockedCards = PROSPECT_CARDS.filter(c => !unlocked.includes(c.id));

  // ---- Dive state ----
  const [dive, setDive] = useState(null);
  // { depth, hull, cores, flux, blueprints, log: [], next: layer|null, over }

  // Launching costs a Probe Key. Without a cost the mine was unlimited free
  // income, which made every other economy in the game optional.
  const keys = save.probeKeys || 0;
  const startDive = () => {
    if (keys <= 0) return;
    // Functional so a double-tap on LAUNCH cannot spend two keys for one dive
    // — the same stale-closure trap the clicker and the meta board both had.
    setSave(cur => {
      if ((cur.probeKeys || 0) <= 0) return cur;
      const next = { ...cur, probeKeys: cur.probeKeys - 1 };
      // Dropping below the cap starts the refill clock now, rather than from
      // whenever the save last happened to be under it. tickIdle deliberately
      // leaves this alone while capped — see the comment there.
      if (cur.probeKeys >= 3) next.probeKeyAt = Date.now();
      return next;
    });
    setDive({
      depth: 0, hull: stats.hull, cores: 0, flux: 0, blueprints: 0, tcgCards: [],
      log: [], next: null, over: false, spilled: false,
    });
    Audio.click();
  };

  const peek = (d) => {
    // Deep Scanner shows the next layer before you commit to it. Rolled here
    // and stored, so the shown layer IS the one you get — a preview that
    // re-rolled on descent would be a lie.
    if (stats.scannerDepth <= 0) return null;
    return rollLayer(d + 1, lockedCards.length > 0);
  };

  const descend = () => {
    if (!dive || dive.over) return;
    const depth = dive.depth + 1;
    const layer = dive.next || rollLayer(depth, lockedCards.length > 0);
    const next = { ...dive, depth, next: null };
    let entry;

    if (layer.type === 'hazard') {
      next.hull -= 1;
      entry = { d: depth, icon: 'pExplode', text: layer.label, cls: 'bad' };
      if (next.hull <= 0) {
        next.over = true;
        entry.text = `${layer.label} — probe lost`;
      }
      Audio.hazardAlarm();
    } else if (layer.type === 'flux') {
      next.flux += layer.amount;
      entry = { d: depth, icon: 'cur_shards', text: `${layer.label} +${layer.amount} Flux`, cls: 'good' };
      Audio.oreFound();
    } else if (layer.type === 'blueprint') {
      next.blueprints += 1;
      entry = { d: depth, icon: 'ui_gem', text: 'Sealed data core recovered', cls: 'great' };
      Audio.levelUp();
    } else {
      const raw = oreYield(depth, stats.drillMult);
      const room = Math.max(0, stats.cargo - next.cores);
      const got = Math.min(raw, room);
      next.cores += got;
      if (got < raw) next.spilled = true;
      entry = {
        d: depth, icon: 'ui_pickaxe',
        text: got < raw ? `${layer.label} +${got} Cores (bay full, ${raw - got} spilled)` : `${layer.label} +${got} Cores`,
        cls: got < raw ? 'warn' : 'good',
      };
      Audio.dig();
    }

    let logEntries = [entry, ...dive.log];
    // A card can turn up ALONGSIDE ore/flux/a relic — only a hazard blocks
    // it, since a cave-in is the one outcome that pre-empts everything else
    // this layer could have held.
    if (layer.type !== 'hazard' && rollCardBonus(depth)) {
      const card = rollCard(save.attrs?.luck || 0);
      next.tcgCards = [...next.tcgCards, card];
      logEntries = [{ d: depth, icon: 'ui_cards', text: 'A sealed card case — logged for later', cls: 'great' }, ...logEntries];
    }
    next.log = logEntries.slice(0, 40);
    if (!next.over) next.next = peek(depth);
    setDive(next);
  };

  const bank = (e) => {
    if (!dive) return;
    const ns = {
      ...save,
      cores: (save.cores || 0) + dive.cores,
      flux: (save.flux || 0) + dive.flux,
      prospectBlueprints: (save.prospectBlueprints || 0) + dive.blueprints,
      tcgCardInventory: [...(save.tcgCardInventory || []), ...dive.tcgCards],
      prospectorDives: (save.prospectorDives || 0) + 1,
    };
    setSave(ns);
    const bits = [
      dive.cores && `◈ ${dive.cores}`,
      dive.flux && `Flux ${dive.flux}`,
      dive.blueprints && `Data ${dive.blueprints}`,
      dive.tcgCards.length && `Cards ${dive.tcgCards.length}`,
    ].filter(Boolean).join('  ·  ');
    pushToast({ tone: 'gem', icon: 'orb', title: `Dive banked — depth ${dive.depth}`, text: bits });
    if (e && e.currentTarget) {
      fireClaimFx(e.currentTarget, { cores: dive.cores, flux: dive.flux });
    }
    setDive(null);
    Audio.levelUp(); Audio.claimPing();
  };

  const abandon = () => { setDive(null); Audio.click(); };

  // ---- Probe upgrades ----
  const buyProbe = (id) => {
    const lvl = levels[id] || 0;
    if (lvl >= PROBE_UPGRADES[id].max) return;
    const cost = probeCost(id, lvl);
    if ((save.cores || 0) < cost) return;
    setSave({ ...save, cores: save.cores - cost, probe: { ...levels, [id]: lvl + 1 } });
    Audio.claimPing();
  };

  // ---- Card unlocks ----
  // Blueprints are the gate, Cores are the price. Both, so a card is neither
  // pure grind nor pure luck.
  const unlockCard = (card) => {
    if (unlocked.includes(card.id)) return;
    if ((save.prospectBlueprints || 0) < 1) return;
    if ((save.cores || 0) < card.cost) return;
    setSave({
      ...save,
      cores: save.cores - card.cost,
      prospectBlueprints: save.prospectBlueprints - 1,
      prospectCards: [...unlocked, card.id],
    });
    Audio.levelUp();
  };

  const nextHazard = dive ? Math.round(hazardChance(dive.depth + 1) * 100) : 0;

  return (
    <div className="modal-overlay" data-testid="prospector" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="prosp-panel">
        <div className="prosp-header">
          <div className="prosp-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GameIcon name="ui_pickaxe" size={18} /> LOOTMINE</div>
          <div className="prosp-wallet">
            <span className="prosp-cur cores">◈ {save.cores || 0}</span>
            <span className="prosp-cur flux" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_shards" size={13} /> {save.flux || 0}</span>
            <span className="prosp-cur bp" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="ui_gem" size={13} /> {save.prospectBlueprints || 0}</span>
          </div>
          <button className="prosp-close" onClick={onClose}>✕</button>
        </div>

        <div className="prosp-tabs">
          {[['dive', 'ui_pickaxe', 'DIVE'], ['probe', 'ui_smith', 'PROBE'], ['cards', 'ui_gem', 'CARDS']].map(([k, ic, l]) => (
            <button key={k} className={`prosp-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
              <GameIcon name={ic} size={14} /> {l}
            </button>
          ))}
        </div>

        {/* ── DIVE ── */}
        {tab === 'dive' && (
          <div className="prosp-body">
            {!dive ? (
              <div className="prosp-idle">
                <div className="prosp-rock"><GameIcon name="ui_pickaxe" size={40} /></div>
                <div className="prosp-idle-txt">
                  Drop a probe and dig. Every layer down pays better and is more
                  likely to end the dive. Bank whenever you like — everything you
                  are still carrying is lost if the probe dies.
                </div>
                <div className="prosp-probe-line" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <GameIcon name="ui_shield" size={14} /> {stats.hull} hull · <GameIcon name="ui_pickaxe" size={14} /> ×{stats.drillMult.toFixed(2)} · <GameIcon name="ui_chest" size={14} /> {stats.cargo} bay
                  {stats.scannerDepth > 0 && <> · <GameIcon name="ui_compass" size={14} /> scanner online</>}
                </div>
                <div className="prosp-keys" data-testid="prosp-keys">
                  <span className="prosp-key-icon"><GameIcon name="cur_key" size={20} /></span>
                  <b className={keys <= 0 ? 'out' : ''}>{keys}</b>
                  <span className="prosp-key-label">PROBE {keys === 1 ? 'KEY' : 'KEYS'}</span>
                </div>
                <button
                  className="prosp-btn go"
                  onClick={startDive}
                  disabled={keys <= 0}
                  data-testid="prosp-start"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}
                >
                  {keys > 0 ? <>▸ LAUNCH PROBE · <GameIcon name="cur_key" size={13} /> 1</> : 'NO PROBE KEYS'}
                </button>
                {keys <= 0 && (
                  <div className="prosp-key-hint">
                    Keys come from run rewards, rank-ups and milestones — and one
                    refills on its own every 20 minutes.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="prosp-status">
                  <div className="prosp-stat"><span>DEPTH</span><b>{dive.depth}</b></div>
                  <div className="prosp-stat"><span>HULL</span><b className={dive.hull <= 1 ? 'crit' : ''}>{'▮'.repeat(Math.max(0, dive.hull))}{'▯'.repeat(Math.max(0, stats.hull - dive.hull))}</b></div>
                  <div className="prosp-stat"><span>CARRYING</span><b style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    ◈ {dive.cores}
                    {dive.flux > 0 && <> · <GameIcon name="cur_shards" size={13} /> {dive.flux}</>}
                    {dive.blueprints > 0 && <> · <GameIcon name="ui_gem" size={13} /> {dive.blueprints}</>}
                    {dive.tcgCards.length > 0 && <> · <GameIcon name="ui_cards" size={13} /> {dive.tcgCards.length}</>}
                  </b></div>
                </div>

                <div className="prosp-bay">
                  <div className="prosp-bay-fill" style={{ width: `${Math.min(100, (dive.cores / stats.cargo) * 100)}%` }} />
                  <span className="prosp-bay-txt">{dive.cores}/{stats.cargo} cargo</span>
                </div>

                {dive.over ? (
                  <div className="prosp-lost">
                    <div className="prosp-lost-title">PROBE LOST</div>
                    <div className="prosp-lost-sub">Everything it was carrying went down with it.</div>
                    <button className="prosp-btn go" onClick={() => setDive(null)}>↩ Back to the surface</button>
                  </div>
                ) : (
                  <>
                    {dive.next && (
                      <div className={`prosp-peek t-${dive.next.type}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <GameIcon name="ui_compass" size={14} /> SCANNER — next layer reads as <b>{dive.next.label}</b>
                      </div>
                    )}
                    <div className="prosp-actions">
                      <button className="prosp-btn dig" onClick={descend} data-testid="prosp-dig" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                        <GameIcon name="ui_pickaxe" size={15} /> DIG DEEPER
                        <span className="prosp-risk">{nextHazard}% hazard</span>
                      </button>
                      <button className="prosp-btn bank" onClick={bank} disabled={dive.cores + dive.flux + dive.blueprints + dive.tcgCards.length === 0} data-testid="prosp-bank">
                        ✓ BANK HAUL
                      </button>
                      <button className="prosp-btn ghost" onClick={abandon}>Abandon</button>
                    </div>
                  </>
                )}

                <div className="prosp-log">
                  {dive.log.map((l, i) => (
                    <div key={i} className={`prosp-log-row ${l.cls}`}>
                      <span className="prosp-log-d">L{l.d}</span>
                      <span className="prosp-log-i"><GameIcon name={l.icon} size={16} /></span>
                      <span className="prosp-log-t">{l.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PROBE ── */}
        {tab === 'probe' && (
          <div className="prosp-body">
            <div className="prosp-grid">
              {Object.entries(PROBE_UPGRADES).map(([id, u]) => {
                const lvl = levels[id] || 0;
                const maxed = lvl >= u.max;
                const cost = probeCost(id, lvl);
                const afford = (save.cores || 0) >= cost;
                return (
                  <div key={id} className={`prosp-card${maxed ? ' maxed' : ''}`}>
                    <div className="prosp-card-top">
                      <span className="prosp-card-icon"><GameIcon name={u.icon} size={26} /></span>
                      <span className="prosp-card-name">{u.name}</span>
                      <span className="prosp-card-lvl">{lvl}/{u.max}</span>
                    </div>
                    <div className="prosp-card-desc">{u.desc}</div>
                    <div className="prosp-pips">
                      {Array.from({ length: u.max }).map((_, i) => (
                        <i key={i} className={i < lvl ? 'on' : ''} />
                      ))}
                    </div>
                    <button className="prosp-btn buy" disabled={maxed || !afford} onClick={() => buyProbe(id)}>
                      {maxed ? 'MAX' : `◈ ${cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CARDS ── */}
        {tab === 'cards' && (
          <div className="prosp-body">
            <div className="prosp-note">
              Sealed data cores come up as relics on a dive. Cracking one open
              adds its card to the pool you can be offered in a run — these are
              the only place they come from.
            </div>
            <div className="prosp-grid">
              {PROSPECT_CARDS.map(c => {
                const has = unlocked.includes(c.id);
                const canBuy = !has && (save.prospectBlueprints || 0) >= 1 && (save.cores || 0) >= c.cost;
                return (
                  <div key={c.id} className={`prosp-card unique${has ? ' owned' : ''}`}>
                    <div className="prosp-card-top">
                      <span className="prosp-card-icon"><GameIcon name={c.icon} size={26} /></span>
                      <span className="prosp-card-name">{c.name}</span>
                    </div>
                    <div className="prosp-card-desc">{c.desc}</div>
                    <div className="prosp-lore">{c.lore}</div>
                    <button className="prosp-btn buy" disabled={has || !canBuy} onClick={() => unlockCard(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      {has ? '✓ UNLOCKED' : <><GameIcon name="ui_gem" size={13} /> 1 + ◈ {c.cost}</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
