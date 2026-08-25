import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CLICKER_BUILDINGS, buildingCost, clickUpgradeCost,
  dropsPerSec, dropsPerClick, pendingMilestones, nextMilestone,
  CLICKER_MILESTONES, fmtDrops,
  prestigeGain, prestigeMult, doPrestige, SPRING_BONUS,
  currentChapter, headlinesForChapter, unlockedDossiers, rollEvent
} from '../game/clicker';
import { rollRune } from '../game/runes';
import { rollPartsDrop, addParts } from '../game/gear';
import { rollCard } from '../game/petTcg';
import { clickerRateMult } from '../game/base';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';
import ClaimFx, { fireClaimFx } from './ClaimFx';
import { CHEST_VISUALS } from '../game/masterMilestones';

export default function ClickerScreen({ save, setSave, onClose }) {
  useEffect(() => {
    Audio.swapToMenuMusic();
    return () => Audio.swapToMenuMusic();
  }, []);

  // useMemo, because `cl` is a dependency of the tick effect below and the
  // `||` fallback allocates a NEW object on every render — which made that
  // effect tear down and re-subscribe its 10s interval on every frame.
  const cl = useMemo(
    () => save.clicker || { drops: 0, total: 0, buildings: {}, clickLvl: 0, claimed: {}, springs: 0, prestiges: 0 },
    [save.clicker],
  );
  const wellMult = clickerRateMult(save);
  
  // Chapter & Dossier progression
  const chapter = currentChapter(cl);
  const headlines = headlinesForChapter(cl);
  const dossiers = unlockedDossiers(cl);
  
  // Event State (Multiplier boosts)
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventTimeLeft, setEventTimeLeft] = useState(0);
  const [eventTapsLeft, setEventTapsLeft] = useState(0);

  // Apply event multipliers
  let currentRateMult = wellMult;
  let currentTapMult = 1;
  
  if (activeEvent) {
    if (activeEvent.mult) currentRateMult *= activeEvent.mult;
    if (activeEvent.tapMult && eventTapsLeft > 0) currentTapMult *= activeEvent.tapMult;
  }

  const rate = dropsPerSec(cl) * currentRateMult;
  const perClick = dropsPerClick(cl) * currentTapMult;
  
  const pending = pendingMilestones(cl);
  const next = nextMilestone(cl);

  const [splashes, setSplashes] = useState([]);
  const splashId = useRef(0);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [showRevelation, setShowRevelation] = useState(false);
  
  // Track chapter changes to show revelation cutscene
  const prevChapter = useRef(chapter.id);
  useEffect(() => {
    if (chapter.id !== prevChapter.current && clickerActive.current) {
      setShowRevelation(true);
      Audio.rewardFanfare && Audio.rewardFanfare();
      prevChapter.current = chapter.id;
    }
  }, [chapter.id]);

  const clickerActive = useRef(true);
  useEffect(() => {
    clickerActive.current = true;
    return () => { clickerActive.current = false; };
  }, []);

  // Idle tick & Event spawner
  useEffect(() => {
    if (rate <= 0) return undefined;
    const t = setInterval(() => {
      setSave(cur => {
        const c = cur.clicker || {};
        const now = Date.now();
        const el = Math.max(0, Math.min(5000, now - (c.lastMs || now)));
        if (el < 200) return cur;
        const g = dropsPerSec(c) * currentRateMult * (el / 1000);
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + g, total: (c.total || 0) + g, lastMs: now } };
      });
    }, 250);
    return () => clearInterval(t);
  }, [rate, currentRateMult, setSave]);

  // Event timer
  useEffect(() => {
    if (!activeEvent || activeEvent.taps) return;
    const t = setInterval(() => {
      setEventTimeLeft(sec => {
        if (sec <= 1) {
          setActiveEvent(null);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [activeEvent]);

  // Random event spawner
  useEffect(() => {
    const t = setInterval(() => {
      if (activeEvent) return;
      // Only roll if we have at least reached chapter 2
      if (chapter.threshold < 10000) return;
      
      // 15% chance every 10 seconds to spawn an event
      if (Math.random() < 0.15) {
        const ev = rollEvent(cl);
        if (ev) {
          setActiveEvent(ev);
          if (ev.duration) setEventTimeLeft(ev.duration);
          if (ev.taps) setEventTapsLeft(ev.taps);
          
          // Instant burst event
          if (ev.burstSec) {
            const burstAmount = dropsPerSec(cl) * wellMult * ev.burstSec;
            setSave(cur => {
              const c = cur.clicker || {};
              return { ...cur, clicker: { ...c, drops: (c.drops || 0) + burstAmount, total: (c.total || 0) + burstAmount } };
            });
            pushToast({ tone: 'gold', icon: ev.icon, title: ev.name, text: `Burst of +${fmtDrops(burstAmount)} drops!` });
            setTimeout(() => setActiveEvent(null), 3000); // just show banner briefly
          } else {
            pushToast({ tone: 'bad', icon: ev.icon, title: 'ANOMALY DETECTED', text: ev.name });
          }
          Audio.alert && Audio.alert();
        }
      }
    }, 10000);
    return () => clearInterval(t);
  }, [activeEvent, cl, chapter.threshold, wellMult, setSave]);

  const tap = (e) => {
    const gain = perClick;
    setSave(cur => {
      const c = cur.clicker || {};
      return {
        ...cur,
        clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain },
      };
    });
    
    // Decrease tap event counter
    if (activeEvent?.taps && eventTapsLeft > 0) {
      setEventTapsLeft(t => {
        if (t <= 1) setActiveEvent(null);
        return t - 1;
      });
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const id = splashId.current++;
    setSplashes(s => [...s.slice(-9), {
      id,
      x: (e.clientX ?? rect.left + rect.width / 2) - rect.left,
      y: (e.clientY ?? rect.top + rect.height / 2) - rect.top,
      gain,
    }]);
    setTimeout(() => setSplashes(s => s.filter(x => x.id !== id)), 780);
    Audio.clickerTap();
  };

  const buy = (def) => {
    setSave(cur => {
      const c = cur.clicker || {};
      const owned = c.buildings?.[def.id] || 0;
      const cost = buildingCost(def, owned);
      if ((c.drops || 0) < cost) return cur;
      return {
        ...cur,
        clicker: { ...c, drops: c.drops - cost, buildings: { ...(c.buildings || {}), [def.id]: owned + 1 } },
      };
    });
    Audio.clickerBuy();
  };

  const buyClick = () => {
    setSave(cur => {
      const c = cur.clicker || {};
      const cost = clickUpgradeCost(c.clickLvl || 0);
      if ((c.drops || 0) < cost) return cur;
      return { ...cur, clicker: { ...c, drops: c.drops - cost, clickLvl: (c.clickLvl || 0) + 1 } };
    });
    Audio.clickerBuy();
  };

  const [claimingMileIdx, setClaimingMileIdx] = useState(null);
  
  const claimAll = (e) => {
    if (!pending.length) return;
    // Measured DURING the event: React nulls currentTarget the moment this
    // handler returns, and fireClaimFx needs the rect to anchor the burst.
    const anchor = e && e.currentTarget ? e.currentTarget : null;
    // Everything claimed in one go, summed, so the burst shows ONE payout
    // rather than firing once per milestone on top of itself.
    const total = {};
    for (const m of pending) {
      for (const [k, v] of Object.entries(m.reward || {})) {
        if (typeof v === 'number') total[k] = (total[k] || 0) + v;
      }
    }
    const ns = { ...save };
    const claimed = { ...(cl.claimed || {}) };
    for (const m of pending) {
      const r = m.reward;
      if (r.gold) { ns.gold = (ns.gold || 0) + r.gold; ns.lifetimeGold = (ns.lifetimeGold || 0) + r.gold; }
      if (r.gems) ns.gems = (ns.gems || 0) + r.gems;
      if (r.sp) ns.sp = (ns.sp || 0) + r.sp;
      if (r.slotCoins) ns.slotCoins = (ns.slotCoins || 0) + r.slotCoins;
      if (r.gachaTokens) ns.gachaTokens = (ns.gachaTokens || 0) + r.gachaTokens;
      if (r.gearParts) ns.gearParts = (ns.gearParts || 0) + r.gearParts;
      {
        const p = rollPartsDrop(1);
        ns.gearSlotParts = addParts(ns, p.slot, p.amount);
      }
      if (r.flux) ns.flux = (ns.flux || 0) + r.flux;
      if (r.rune) {
        const runes = [...(ns.runeInventory || [])];
        for (let i = 0; i < r.rune; i++) runes.push(rollRune(ns.attrs?.luck || 0));
        ns.runeInventory = runes;
      }
      if (r.tcgCard) {
        const cards = [...(ns.tcgCardInventory || [])];
        for (let i = 0; i < r.tcgCard; i++) cards.push(rollCard(ns.attrs?.luck || 0));
        ns.tcgCardInventory = cards;
      }
      claimed[m.at] = true;
    }
    ns.clicker = { ...cl, claimed };
    setSave(ns);
    pushToast({ tone: 'gold', icon: 'gem', title: `${pending.length} milestone${pending.length > 1 ? 's' : ''} claimed`, text: pending.map(m => m.label).join('  ·  ') });
    // The shared claim burst — chips punch out, hold long enough to be read,
    // then fly to the currency row. Timmy's standing rule is that nothing may
    // change a number silently, and this is the one component for it: never
    // write a second.
    fireClaimFx(anchor, total);
    Audio.levelUp();
    
    // Visual burst on all pending chests
    setClaimingMileIdx('all');
    setTimeout(() => setClaimingMileIdx(null), 600);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      setHeadlineIdx(i => (i + 1) % headlines.length);
    }, 4500);
    return () => clearInterval(iv);
  }, [headlines.length]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height - 0.5) * 2));
    setEyePos({ x: nx, y: ny });
  };

  const nextPct = next
    ? Math.max(0, Math.min(1, (cl.total || 0) / next.at))
    : 1;

  // Find current milestone tier index for the chest track
  const currentMileIdx = CLICKER_MILESTONES.findIndex(m => (cl.total || 0) < m.at);

  return (
    <div className="modal-overlay" data-testid="clicker" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className={`clk-panel clk-theme-${chapter.theme} illuminati-clicker-panel`}>
        
        {/* The Conspiracy Board Background */}
        <div className="clk-conspiracy-board" />
        
        <div className="clk-head" style={{ zIndex: 10 }}>
          <div className="clk-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ffd166', textShadow: '0 0 10px rgba(0,0,0,1)' }}>
            <GameIcon name="ui_eye" size={18} tone="#ffd166" />
            <span>THE ILLUMINATI WELL</span>
          </div>
          <button className="prosp-close" onClick={onClose}>✕</button>
        </div>

        {/* Chapter Progress Bar */}
        <div className="clk-chapter-bar" style={{ zIndex: 10 }}>
          <span className="clk-chapter-num">{chapter.headline}</span>
          <span className="clk-chapter-title">— {chapter.name} —</span>
        </div>

        {/* Ticker banner */}
        <div className="clk-conspiracy-ticker" style={{ zIndex: 10, background: 'rgba(0,0,0,0.85)' }}>
          <span className="clk-ticker-icon"><GameIcon name="ui_eye" size={14} tone="#ffd166" /></span>
          <span className="clk-ticker-text" style={{ fontFamily: 'Courier New' }}>{headlines[headlineIdx]}</span>
        </div>

        {/* Multiplier Event Banner */}
        {activeEvent && (
          <div className="clk-event-banner">
            <div className="clk-event-info">
              <span className="clk-event-name">{activeEvent.name}</span>
              <span className="clk-event-desc">{activeEvent.desc}</span>
            </div>
            {activeEvent.taps ? (
              <div className="clk-event-timer">{eventTapsLeft} TAPS</div>
            ) : (
              <div className="clk-event-timer">00:{eventTimeLeft.toString().padStart(2, '0')}</div>
            )}
          </div>
        )}

        <div className="clk-readout" style={{ zIndex: 10, textShadow: '0 2px 4px rgba(0,0,0,1)' }}>
          <div className="clk-drops">{fmtDrops(cl.drops || 0)}<span>H2O Drops</span></div>
          <div className="clk-rate">
            <span style={{ color: activeEvent?.mult ? '#4dffd4' : 'inherit' }}>{fmtDrops(rate)}/s</span> · 
            <span style={{ color: activeEvent?.tapMult ? '#4dffd4' : 'inherit' }}> {fmtDrops(perClick)} per tap</span>
          </div>
        </div>

        {/* The Illuminati Pyramid Well itself with Eye Tracking */}
        <div className="clk-well clk-illuminati-well" onMouseMove={handleMouseMove} onClick={tap} data-testid="clk-well">
          <div className="clk-pyramid-bg" />
          <div className="clk-pyramid-rays" style={{ opacity: activeEvent ? 1 : 0.4, animationDuration: activeEvent ? '5s' : '20s' }} />
          <div className={`clk-illuminati-eye ${activeEvent?.id === 'eye_opens' ? 'wide-awake' : ''}`}>
            <svg viewBox="0 0 100 80" className="clk-eye-svg">
              {/* Outer Golden Pyramid Triangles */}
              <polygon points="50,5 95,75 5,75" fill="none" stroke={activeEvent ? "#4dffd4" : "#ffd166"} strokeWidth="3" opacity="0.9" />
              <polygon points="50,15 85,70 15,70" fill="#150f24" stroke={activeEvent ? "#ffaa00" : "#ffaa00"} strokeWidth="1.5" />
              {/* Sclera */}
              <ellipse cx="50" cy="48" rx="26" ry={activeEvent?.id === 'eye_opens' ? "22" : "16"} fill="#f0fbff" stroke="#ffd166" strokeWidth="2" />
              {/* Dynamic Pupil tracking mouse */}
              <circle
                cx={50 + eyePos.x * (activeEvent ? 14 : 10)}
                cy={48 + eyePos.y * (activeEvent ? 8 : 6)}
                r={activeEvent ? "11" : "9"}
                fill={activeEvent ? "#a02c2c" : "#0a0515"}
              />
              <circle
                cx={50 + eyePos.x * 10 - 2}
                cy={48 + eyePos.y * 6 - 2}
                r="3"
                fill="#4dffd4"
              />
            </svg>
          </div>
          {splashes.map(s => (
            <div key={s.id} className="clk-ripple" style={{ left: s.x, top: s.y }} />
          ))}
          {splashes.map(s => (
            <span key={s.id} className="clk-splash clk-conspiracy-splash" style={{ left: s.x, top: s.y }}>
              +{fmtDrops(s.gain)}
            </span>
          ))}
        </div>

        {/* Dossier Drawer (Classified Files) */}
        {dossiers.length > 0 && (
          <div className="clk-dossier-wrap">
            <div className="clk-dossier-header" onClick={() => setDossierOpen(!dossierOpen)}>
              <span className="clk-dossier-title">
                <GameIcon name="ui_scroll" size={14} tone="#e0d8c0" />
                CLASSIFIED FILES
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="clk-dossier-count">{dossiers.length} / 30</span>
                <span>{dossierOpen ? '▼' : '▲'}</span>
              </div>
            </div>
            {dossierOpen && (
              <div className="clk-dossier-list">
                {dossiers.map(d => (
                  <div key={d.id} className="clk-dossier-item">
                    <div className="clk-dossier-name">{d.title}</div>
                    {d.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- Springs (prestige) ---- */}
        {(() => {
          const gain = prestigeGain(cl);
          const mult = prestigeMult(cl);
          const springs = cl.springs || 0;
          if (springs <= 0 && gain <= 0) return null;
          return (
            <div className="clk-spring" data-testid="clk-spring" style={{ zIndex: 10 }}>
              <div className="clk-spring-head">
                <span className="clk-spring-title">✧ SPRINGS</span>
                <span className="clk-spring-mult">
                  {springs} banked · ×{mult.toFixed(2)} production
                </span>
              </div>
              {gain > 0 ? (
                <>
                  <div className="clk-spring-desc">
                    Reset the well to bank <b>+{gain}</b> Spring{gain > 1 ? 's' : ''}.
                    Buildings and taps go back to zero — lifetime total,
                    claimed milestones and banked Springs all stay.
                  </div>
                  <button className="clk-spring-btn" data-testid="clk-prestige" style={{ position: 'relative', overflow: 'hidden' }}
                    onClick={(e) => {
                      const ns = { ...save, clicker: doPrestige(cl) };
                      setSave(ns); Audio.rankUp && Audio.rankUp();
                      pushToast('✧ +' + gain + ' Spring' + (gain > 1 ? 's' : '') +
                        ' — production ×' + prestigeMult(ns.clicker).toFixed(2));
                      
                      // Trigger burst effect
                      const burst = document.createElement('div');
                      burst.className = 'clk-prestige-beam';
                      e.currentTarget.appendChild(burst);
                      setTimeout(() => burst.remove(), 1500);
                    }}>
                    ✧ DRAW THE SPRING · +{gain}
                  </button>
                </>
              ) : (
                <div className="clk-spring-desc">
                  Each Spring is +{Math.round(SPRING_BONUS * 100)}% forever.
                  Keep producing — the next one is earned from lifetime drops.
                </div>
              )}
            </div>
          );
        })()}

        {/* Milestone Chest Track */}
        <div className="clk-mile" style={{ padding: '16px 0', overflow: 'hidden' }}>
          <div className="clk-mile-head" style={{ padding: '0 16px', marginBottom: 12 }}>
            <span>LIFETIME {fmtDrops(cl.total || 0)}</span>
            {next
              ? <span className="clk-mile-next">next at {fmtDrops(next.at)}</span>
              : <span className="clk-mile-next">all milestones claimed</span>}
          </div>
          
          <div className="mastery-track-scroll">
            <div className="mastery-track-line">
              <div className="mastery-track-gold-line" />
              <div 
                className="mastery-track-gold-fill" 
                style={{ 
                  width: `${currentMileIdx >= 0 
                    ? ((currentMileIdx > 0 ? currentMileIdx - 1 : 0) / (CLICKER_MILESTONES.length - 1)) * 100 + nextPct * (100 / (CLICKER_MILESTONES.length - 1))
                    : 100}%` 
                }} 
              />
              
              {CLICKER_MILESTONES.map((m, idx) => {
                const done = !!(cl.claimed || {})[m.at];
                const ready = !done && (cl.total || 0) >= m.at;
                const pct = (idx / (CLICKER_MILESTONES.length - 1)) * 100;
                
                // Determine chest visual based on milestone tier (approximate mapping)
                let visType = 'bronze';
                if (idx > 1) visType = 'silver';
                if (idx > 3) visType = 'gold';
                if (idx > 5) visType = 'epic';
                if (idx > 8) visType = 'legend';
                if (idx > 10) visType = 'annunaki';
                if (idx > 11) visType = 'monolith';
                
                const vis = CHEST_VISUALS[m.chestType || visType] || CHEST_VISUALS.bronze;
                
                return (
                  <div
                    key={m.at}
                    className={`mastery-chest ${visType} ${done ? 'done' : ready ? 'ready' : 'locked'} ${claimingMileIdx === 'all' && ready ? 'claiming' : ''}`}
                    style={{ left: `${pct}%`, '--chest-glow': vis.glow }}
                    title={`${fmtDrops(m.at)} Drops
${m.label}`}
                  >
                    <div className="mastery-chest-icon">
                      <GameIcon name={vis.icon} size={done ? 22 : ready ? 28 : 20} tone={done ? '#666' : vis.glow} />
                    </div>
                    <div className="mastery-chest-threshold">{fmtDrops(m.at)}</div>
                    {done && <div className="mastery-chest-check"><GameIcon name="ui_check" size={12} tone="#4dffd4" /></div>}
                    {ready && <div className="mastery-chest-bang">!</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {pending.length > 0 && (
            <div style={{ padding: '0 16px', marginTop: 12 }}>
              <button className="clk-claim" onClick={claimAll} data-testid="clk-claim" style={{ width: '100%', margin: 0 }}>
                ✦ CLAIM {pending.length} REWARD{pending.length > 1 ? 'S' : ''}
              </button>
            </div>
          )}
        </div>

        {/* Upgrades */}
        <div className="clk-shop">
          <button className="clk-buy clk-buy-tap" disabled={(cl.drops || 0) < clickUpgradeCost(cl.clickLvl || 0)} onClick={buyClick}>
            <span className="clk-buy-name">Stronger Pull <i>Lv {cl.clickLvl || 0}</i></span>
            <span className="clk-buy-desc">+1 drop per tap</span>
            <span className="clk-buy-cost">{fmtDrops(clickUpgradeCost(cl.clickLvl || 0))}</span>
          </button>
          {CLICKER_BUILDINGS.map(def => {
            const owned = cl.buildings?.[def.id] || 0;
            const cost = buildingCost(def, owned);
            const afford = (cl.drops || 0) >= cost;
            const far = cost > (cl.drops || 0) * 12;
            return (
              <button key={def.id} className={`clk-buy ${far ? 'far' : ''}`} disabled={!afford} onClick={() => buy(def)}
                      data-testid={`clk-buy-${def.id}`}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <GameIcon name={def.icon} size={32} tone="#a02c2c" />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left' }}>
                    <span className="clk-buy-name">{def.name} {owned > 0 && <i>×{owned}</i>}</span>
                    <span className="clk-buy-desc">{def.desc}</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="clk-buy-rate" style={{ color: '#27a31e', fontWeight: 'bold' }}>+{fmtDrops(def.rate)}/s</span>
                      <span className="clk-buy-cost" style={{ fontWeight: 'bold' }}>{fmtDrops(cost)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Chapter Revelation Cutscene */}
      {showRevelation && (
        <div className="clk-revelation-overlay" onClick={() => setShowRevelation(false)}>
          <div className="clk-revelation-modal" onClick={e => e.stopPropagation()}>
            <div className="clk-revelation-title">{chapter.headline} UNLOCKED</div>
            <GameIcon name="ui_eye" size={48} tone="#ffd166" style={{ marginBottom: 16 }} />
            <div className="clk-revelation-text">
              The waterdrop's consciousness expands.<br/>
              <b>{chapter.name}</b><br/><br/>
              <i>New classified files and frequencies have been intercepted. The board grows clearer.</i>
            </div>
            <button className="clk-revelation-btn" onClick={() => setShowRevelation(false)}>
              CONTINUE INVESTIGATION
            </button>
          </div>
        </div>
      )}

      {/* The claim-burst host. fireClaimFx() publishes on a module bus and this
          is what listens — without it the call is a silent no-op, which is
          exactly the shape of bug this project keeps paying for. */}
      <ClaimFx />
    </div>
  );
}
