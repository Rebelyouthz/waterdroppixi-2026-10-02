import React, { useState } from 'react';
import {
  PROBE_UPGRADES, probeCost, probeStats, PROSPECT_CARDS,
  hazardChance, rollLayer, oreYield, rollCardBonus,
} from '../game/prospector';
import { rollCard } from '../game/petTcg';
import { Audio } from '../game/audio';

// Astro Prospector. A dive is entirely client-side state — only banking
// writes to the save, which is also what makes "lose it all" mean something.
export default function ProspectorScreen({ save, setSave, onClose }) {
  const [tab, setTab] = useState('dive'); // 'dive' | 'probe' | 'cards'
  const levels = save.probe || {};
  const stats = probeStats(levels);

  const unlocked = save.prospectCards || [];
  const lockedCards = PROSPECT_CARDS.filter(c => !unlocked.includes(c.id));

  // ---- Dive state ----
  const [dive, setDive] = useState(null);
  // { depth, hull, cores, flux, blueprints, log: [], next: layer|null, over }

  const startDive = () => {
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
      entry = { d: depth, icon: '💥', text: layer.label, cls: 'bad' };
      if (next.hull <= 0) {
        next.over = true;
        entry.text = `${layer.label} — probe lost`;
        Audio.hit();
      } else {
        Audio.hit();
      }
    } else if (layer.type === 'flux') {
      next.flux += layer.amount;
      entry = { d: depth, icon: '⚗', text: `${layer.label} +${layer.amount} Flux`, cls: 'good' };
      Audio.claimPing();
    } else if (layer.type === 'blueprint') {
      next.blueprints += 1;
      entry = { d: depth, icon: '💠', text: 'Sealed data core recovered', cls: 'great' };
      Audio.levelUp();
    } else {
      const raw = oreYield(depth, stats.drillMult);
      const room = Math.max(0, stats.cargo - next.cores);
      const got = Math.min(raw, room);
      next.cores += got;
      if (got < raw) next.spilled = true;
      entry = {
        d: depth, icon: '⛏',
        text: got < raw ? `${layer.label} +${got} Cores (bay full, ${raw - got} spilled)` : `${layer.label} +${got} Cores`,
        cls: got < raw ? 'warn' : 'good',
      };
      Audio.click();
    }

    let logEntries = [entry, ...dive.log];
    // A card can turn up ALONGSIDE ore/flux/a relic — only a hazard blocks
    // it, since a cave-in is the one outcome that pre-empts everything else
    // this layer could have held.
    if (layer.type !== 'hazard' && rollCardBonus(depth)) {
      const card = rollCard(save.attrs?.luck || 0);
      next.tcgCards = [...next.tcgCards, card];
      logEntries = [{ d: depth, icon: '🃏', text: 'A sealed card case — logged for later', cls: 'great' }, ...logEntries];
    }
    next.log = logEntries.slice(0, 40);
    if (!next.over) next.next = peek(depth);
    setDive(next);
  };

  const bank = () => {
    if (!dive) return;
    const ns = {
      ...save,
      cores: (save.cores || 0) + dive.cores,
      flux: (save.flux || 0) + dive.flux,
      prospectBlueprints: (save.prospectBlueprints || 0) + dive.blueprints,
      tcgCardInventory: [...(save.tcgCardInventory || []), ...dive.tcgCards],
    };
    setSave(ns);
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
          <div className="prosp-title">⛏ ASTRO PROSPECTOR</div>
          <div className="prosp-wallet">
            <span className="prosp-cur cores">◈ {save.cores || 0}</span>
            <span className="prosp-cur flux">⚗ {save.flux || 0}</span>
            <span className="prosp-cur bp">💠 {save.prospectBlueprints || 0}</span>
          </div>
          <button className="prosp-close" onClick={onClose}>✕</button>
        </div>

        <div className="prosp-tabs">
          {[['dive', '⛏ DIVE'], ['probe', '🛠 PROBE'], ['cards', '💠 CARDS']].map(([k, l]) => (
            <button key={k} className={`prosp-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* ── DIVE ── */}
        {tab === 'dive' && (
          <div className="prosp-body">
            {!dive ? (
              <div className="prosp-idle">
                <div className="prosp-rock">🪨</div>
                <div className="prosp-idle-txt">
                  Drop a probe and dig. Every layer down pays better and is more
                  likely to end the dive. Bank whenever you like — everything you
                  are still carrying is lost if the probe dies.
                </div>
                <div className="prosp-probe-line">
                  🛡 {stats.hull} hull · ⛏ ×{stats.drillMult.toFixed(2)} · 📦 {stats.cargo} bay
                  {stats.scannerDepth > 0 && ' · 📡 scanner online'}
                </div>
                <button className="prosp-btn go" onClick={startDive} data-testid="prosp-start">▸ LAUNCH PROBE</button>
              </div>
            ) : (
              <>
                <div className="prosp-status">
                  <div className="prosp-stat"><span>DEPTH</span><b>{dive.depth}</b></div>
                  <div className="prosp-stat"><span>HULL</span><b className={dive.hull <= 1 ? 'crit' : ''}>{'▮'.repeat(Math.max(0, dive.hull))}{'▯'.repeat(Math.max(0, stats.hull - dive.hull))}</b></div>
                  <div className="prosp-stat"><span>CARRYING</span><b>◈ {dive.cores}{dive.flux > 0 && ` · ⚗ ${dive.flux}`}{dive.blueprints > 0 && ` · 💠 ${dive.blueprints}`}{dive.tcgCards.length > 0 && ` · 🃏 ${dive.tcgCards.length}`}</b></div>
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
                      <div className={`prosp-peek t-${dive.next.type}`}>
                        📡 SCANNER — next layer reads as <b>{dive.next.label}</b>
                      </div>
                    )}
                    <div className="prosp-actions">
                      <button className="prosp-btn dig" onClick={descend} data-testid="prosp-dig">
                        ⛏ DIG DEEPER
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
                      <span className="prosp-log-i">{l.icon}</span>
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
                      <span className="prosp-card-icon">{u.icon}</span>
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
                      <span className="prosp-card-icon">{c.icon}</span>
                      <span className="prosp-card-name">{c.name}</span>
                    </div>
                    <div className="prosp-card-desc">{c.desc}</div>
                    <div className="prosp-lore">{c.lore}</div>
                    <button className="prosp-btn buy" disabled={has || !canBuy} onClick={() => unlockCard(c)}>
                      {has ? '✓ UNLOCKED' : `💠 1 + ◈ ${c.cost}`}
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
