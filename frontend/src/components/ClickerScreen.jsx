import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  CLICKER_BUILDINGS, CLICKER_MANAGERS, isBuildingAutomated,
  buildingCost, clickUpgradeCost,
  dropsPerSec, dropsPerClick, pendingMilestones, nextMilestone,
  CLICKER_MILESTONES, fmtDrops,
  prestigeGain, prestigeMult, doPrestige, SPRING_BONUS,
  currentChapter, headlinesForChapter, unlockedDossiers, rollEvent,
  CONSPIRACY_CHAPTERS
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
import { ClickerWorld } from '../game/clickerWorld';

// ── Conspiracy milestone names and flavors ─────────────────────────
const MILESTONE_META = [
  { name: 'THE FIRST DRIP',       flavor: 'Every flood starts with a single suspicious drop.',                  chestType: 'bronze' },
  { name: 'FLUORIDE BRIEFCASE',   flavor: 'Contents: 3 teeth and a classified dental report.',                 chestType: 'bronze' },
  { name: 'REDACTED CACHE',       flavor: 'Mostly blacked out. The readable parts mention "dew point."',       chestType: 'silver' },
  { name: 'CONTRAIL CANISTER',    flavor: 'Stamped: DO NOT OPEN NEAR CLOUDS.',                                chestType: 'silver' },
  { name: 'HAARP SIGNAL BOX',     flavor: 'Still vibrating. The frequency matches a politician\'s heartbeat.', chestType: 'gold' },
  { name: 'BUNKER LEVEL 4 KEY',   flavor: 'The card was swiped 10,000 times. All by the same "janitor."',      chestType: 'gold' },
  { name: 'PYRAMID SHARD',        flavor: 'Warm to the touch. Hums when pointed at the moon.',                 chestType: 'epic' },
  { name: 'LIZARD SENATE DOCKET', flavor: 'Agenda item 1: "Approve humidity tax." Item 2: [HEAT LAMP BREAK]', chestType: 'epic' },
  { name: 'MOTHERSHIP MANIFEST',  flavor: 'Cargo listed: 4 billion litres of sparkling water (extra fizzy).',  chestType: 'legend' },
  { name: 'THE COSMIC BUCKET',    flavor: 'It has no bottom. Neither does the truth.',                         chestType: 'annunaki' },
  { name: 'VOID ARCHIVE KEY',     flavor: 'Unlocks a filing cabinet that exists in two dimensions.',           chestType: 'annunaki' },
  { name: 'MONOLITH FRAGMENT',    flavor: 'Smells like deep space and disappointment.',                        chestType: 'cosmic' },
  { name: 'THE FINAL SPLASH',     flavor: 'The last document. Or is it? (It isn\'t.)',                         chestType: 'monolith' },
];

// ── Bulk buy helpers ───────────────────────────────────────────────
function bulkCost(def, owned, count) {
  let total = 0;
  for (let i = 0; i < count; i++) total += buildingCost(def, owned + i);
  return total;
}
function maxAffordable(def, owned, budget) {
  let count = 0;
  let spent = 0;
  while (true) {
    const c = buildingCost(def, owned + count);
    if (spent + c > budget) break;
    spent += c;
    count++;
    if (count > 9999) break;
  }
  return { count, cost: spent };
}

export default function ClickerScreen({ save, setSave, onClose }) {
  useEffect(() => {
    Audio.swapToMenuMusic();
    return () => Audio.swapToMenuMusic();
  }, []);

  const cl = useMemo(
    () => save.clicker || { drops: 0, total: 0, buildings: {}, clickLvl: 0, claimed: {}, springs: 0, prestiges: 0, managers: {} },
    [save.clicker],
  );
  const wellMult = clickerRateMult(save);
  
  const chapter = currentChapter(cl);
  const chapterIdx = CONSPIRACY_CHAPTERS.findIndex(c => c.id === chapter.id);
  const headlines = headlinesForChapter(cl);
  const dossiers = unlockedDossiers(cl);
  
  // Event State
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventTimeLeft, setEventTimeLeft] = useState(0);
  const [eventTapsLeft, setEventTapsLeft] = useState(0);

  // Tactical Anomaly Choice Modal State
  const [choiceEvent, setChoiceEvent] = useState(null);

  // Shop navigation tab: 'buildings' | 'managers'
  const [shopTab, setShopTab] = useState('buildings');

  // Building Production Cycles state (progress: 0..1, ready: bool)
  const [buildingCycles, setBuildingCycles] = useState({});

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
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [showRevelation, setShowRevelation] = useState(false);
  const [buyMode, setBuyMode] = useState(1); // 1, 10, 100, 'max'
  const [combo, setCombo] = useState(0);
  const comboTimer = useRef(null);
  const [ratePop, setRatePop] = useState(false);
  const [milestoneDetail, setMilestoneDetail] = useState(null);

  // Track chapter changes
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

  // ── PixiJS conspiracy world canvas ──────────────────────────────
  const canvasRef = useRef(null);
  const worldRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const world = new ClickerWorld(canvasRef.current, {
      theme: chapter.theme,
      chapter: chapterIdx,
      onTapWell: () => {
        tapFromCanvas();
      },
      onTapObject: (id, obj) => {
        handleWorldInteraction(id, obj);
      },
      onCollectDrop: () => {
        const gain = Math.max(1, Math.floor(perClick * 0.4));
        setSave(cur => {
          const c = cur.clicker || {};
          return { ...cur, clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain } };
        });
      },
      onEnemyDefeated: (en) => {
        const gain = Math.max(25, Math.floor(dropsPerSec(cl) * 8 + perClick * 5));
        setSave(cur => {
          const c = cur.clicker || {};
          return { ...cur, clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain } };
        });
        pushToast({ tone: 'gold', icon: 'bolt', title: `${(en.kind || 'TARGET').toUpperCase()} DESTROYED!`, text: `+${fmtDrops(gain)} Drops salvaged!` });
        Audio.clickerTap && Audio.clickerTap();
      },
      onChestUnlocked: () => {
        const gain = Math.max(200, Math.floor(dropsPerSec(cl) * 35 + 100));
        setSave(cur => {
          const c = cur.clicker || {};
          return { ...cur, clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain } };
        });
        pushToast({ tone: 'legendary', icon: 'ui_chest', title: 'TREASURE CHEST CRACKED!', text: `+${fmtDrops(gain)} Drops & Secret Cache!` });
        Audio.rewardFanfare && Audio.rewardFanfare();
      },
      onArnoldTapped: () => {
        const bonus = Math.max(300, dropsPerSec(cl) * 40 + perClick * 25);
        setSave(cur => {
          const c = cur.clicker || {};
          return { ...cur, clicker: { ...c, drops: (c.drops || 0) + bonus, total: (c.total || 0) + bonus } };
        });
        pushToast({ tone: 'gold', icon: 'pVamp', title: 'ARNOLD ENERGIZED!', text: `The Governator flexes on his mini pony! +${fmtDrops(bonus)} Drops!` });
        Audio.levelUp && Audio.levelUp();
      },
    });

    world.init().then(() => {
      worldRef.current = world;
    });

    return () => {
      worldRef.current = null;
      world.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update theme when chapter changes
  useEffect(() => {
    if (worldRef.current) {
      worldRef.current.setTheme(chapter.theme, chapterIdx);
    }
  }, [chapter.theme, chapterIdx]);

  // Handle world entity interactions (Stonehenge, Göbekli)
  const handleWorldInteraction = useCallback((id) => {
    if (id === 'stonehenge') {
      const gain = Math.max(10, perClick * 3);
      setSave(cur => {
        const c = cur.clicker || {};
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain } };
      });
      pushToast({ tone: 'dim', icon: 'bolt', title: 'SOLSTICE HARMONIC', text: `Stonehenge resonates! +${fmtDrops(gain)} Drops` });
      Audio.clickerTap && Audio.clickerTap();
    } else if (id === 'gobekli') {
      const gain = Math.max(15, perClick * 4);
      setSave(cur => {
        const c = cur.clicker || {};
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain } };
      });
      pushToast({ tone: 'dim', icon: 'ui_eye', title: 'ANCIENT HUNTER WISDOM', text: `T-Pillars glow with ancient truth! +${fmtDrops(gain)} Drops` });
      Audio.clickerTap && Audio.clickerTap();
    }
  }, [perClick, setSave]);

  // ── Building Production Cycles & Automation Ticker ──────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setBuildingCycles(prev => {
        const next = { ...prev };
        let autoGainTotal = 0;
        const owned = cl.buildings || {};
        const mult = prestigeMult(cl) * currentRateMult;

        for (const b of CLICKER_BUILDINGS) {
          const count = owned[b.id] || 0;
          if (count <= 0) continue;

          const isAuto = isBuildingAutomated(cl, b.id);
          const mgr = CLICKER_MANAGERS.find(m => m.buildingId === b.id);
          const speed = (mgr && isAuto ? mgr.speedMult : 1.0);
          const cycleSec = (b.cycle || 1.0) / speed;
          const dt = 0.1; // 100ms
          const curProg = (next[b.id]?.progress || 0) + (dt / cycleSec);

          if (isAuto) {
            // Automated: continuous flow
            if (curProg >= 1.0) {
              const overflow = curProg - 1.0;
              next[b.id] = { progress: overflow % 1.0, ready: false };
              autoGainTotal += b.rate * count * mult;
            } else {
              next[b.id] = { progress: curProg, ready: false };
            }
          } else {
            // Manual: stops at 1.0 until player harvests
            if (curProg >= 1.0) {
              next[b.id] = { progress: 1.0, ready: true };
            } else {
              next[b.id] = { progress: curProg, ready: false };
            }
          }
        }

        if (autoGainTotal > 0) {
          setSave(cur => {
            const c = cur.clicker || {};
            return {
              ...cur,
              clicker: {
                ...c,
                drops: (c.drops || 0) + autoGainTotal,
                total: (c.total || 0) + autoGainTotal,
                lastMs: Date.now(),
              },
            };
          });
        }

        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [cl, currentRateMult, setSave]);

  // Harvest manual building cycle
  const harvestBuilding = (bId) => {
    const b = CLICKER_BUILDINGS.find(x => x.id === bId);
    if (!b) return;
    const count = (cl.buildings || {})[bId] || 0;
    if (count <= 0) return;

    const mult = prestigeMult(cl) * currentRateMult;
    const payout = Math.max(1, Math.round(b.rate * count * mult * (b.cycle || 1.0)));

    setSave(cur => {
      const c = cur.clicker || {};
      return {
        ...cur,
        clicker: {
          ...c,
          drops: (c.drops || 0) + payout,
          total: (c.total || 0) + payout,
        },
      };
    });

    setBuildingCycles(prev => ({
      ...prev,
      [bId]: { progress: 0, ready: false },
    }));

    pushToast({ tone: 'cyan', icon: b.icon, title: `${b.name} HARVESTED!`, text: `+${fmtDrops(payout)} Drops collected!` });
    Audio.clickerBuy && Audio.clickerBuy();
  };

  // Hire Celebrity Manager
  const hireManager = (mgr) => {
    const cost = mgr.cost;
    if ((cl.drops || 0) < cost || (cl.managers || {})[mgr.id]) return;

    setSave(cur => {
      const c = cur.clicker || {};
      return {
        ...cur,
        clicker: {
          ...c,
          drops: (c.drops || 0) - cost,
          managers: { ...(c.managers || {}), [mgr.id]: true },
        },
      };
    });

    pushToast({
      tone: 'legendary',
      icon: mgr.icon,
      title: `${mgr.name.toUpperCase()} HIRED!`,
      text: `${mgr.title} now automates production!`,
    });
    Audio.rankUp && Audio.rankUp();
  };

  // Event timer
  useEffect(() => {
    if (!activeEvent || activeEvent.taps) return;
    const t = setInterval(() => {
      setEventTimeLeft(sec => {
        if (sec <= 1) { setActiveEvent(null); return 0; }
        return sec - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [activeEvent]);

  // Random event & anomaly spawner
  useEffect(() => {
    const t = setInterval(() => {
      if (activeEvent || choiceEvent) return;
      if (chapter.threshold < 10000) return;
      
      const roll = Math.random();
      if (roll < 0.14) {
        const ev = rollEvent(cl);
        if (ev) {
          setActiveEvent(ev);
          if (ev.duration) setEventTimeLeft(ev.duration);
          if (ev.taps) setEventTapsLeft(ev.taps);
          if (ev.burstSec) {
            const burstAmount = dropsPerSec(cl) * wellMult * ev.burstSec;
            setSave(cur => {
              const c = cur.clicker || {};
              return { ...cur, clicker: { ...c, drops: (c.drops || 0) + burstAmount, total: (c.total || 0) + burstAmount } };
            });
            pushToast({ tone: 'gold', icon: ev.icon, title: ev.name, text: `Burst of +${fmtDrops(burstAmount)} drops!` });
            setTimeout(() => setActiveEvent(null), 3000);
          } else {
            pushToast({ tone: 'bad', icon: ev.icon, title: 'ANOMALY DETECTED', text: ev.name });
          }
          Audio.alert && Audio.alert();
        }
      } else if (roll < 0.20 && !choiceEvent && cl.total > 50000) {
        setChoiceEvent({
          title: 'UNIDENTIFIED TRANSMISSION',
          text: 'An encrypted radio pulse has penetrated the borehole shielding. How do you respond?',
          optA: { label: 'DECLASSIFY SIGNAL', desc: `+${fmtDrops(Math.max(500, dropsPerSec(cl) * 45))} Drops instantly`, action: 'burst' },
          optB: { label: 'HARNESS FREQUENCY', desc: '×3 Tap Power for 15 seconds', action: 'tapBuff' },
        });
        Audio.alert && Audio.alert();
      }
    }, 11000);
    return () => clearInterval(t);
  }, [activeEvent, choiceEvent, cl, chapter.threshold, wellMult, setSave]);

  // Headline rotator
  useEffect(() => {
    const iv = setInterval(() => {
      setHeadlineIdx(i => (i + 1) % headlines.length);
    }, 4500);
    return () => clearInterval(iv);
  }, [headlines.length]);

  // ── Tap handler ─────────────────────────────────────────────────
  const tapFromCanvas = useCallback(() => {
    const gain = perClick;
    setSave(cur => {
      const c = cur.clicker || {};
      return { ...cur, clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain } };
    });
    if (activeEvent?.taps && eventTapsLeft > 0) {
      setEventTapsLeft(t => { if (t <= 1) setActiveEvent(null); return t - 1; });
    }
    setCombo(c => c + 1);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setCombo(0), 850);
    Audio.clickerTap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perClick, activeEvent, eventTapsLeft]);

  const tap = (e) => {
    tapFromCanvas();
    const rect = e.currentTarget.getBoundingClientRect();
    const id = splashId.current++;
    const gain = perClick;
    setSplashes(s => [...s.slice(-9), {
      id,
      x: (e.clientX ?? rect.left + rect.width / 2) - rect.left,
      y: (e.clientY ?? rect.top + rect.height / 2) - rect.top,
      gain,
    }]);
    setTimeout(() => setSplashes(s => s.filter(x => x.id !== id)), 780);
    if (worldRef.current) worldRef.current.flashTap();
  };

  // ── Choice Event Resolver ───────────────────────────────────────
  const resolveChoice = (opt) => {
    if (!choiceEvent) return;
    if (opt.action === 'burst') {
      const burstAmount = Math.max(500, dropsPerSec(cl) * 45);
      setSave(cur => {
        const c = cur.clicker || {};
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + burstAmount, total: (c.total || 0) + burstAmount } };
      });
      pushToast({ tone: 'gold', icon: 'gem', title: 'TRANSMISSION DECLASSIFIED', text: `+${fmtDrops(burstAmount)} Drops added to cache!` });
    } else if (opt.action === 'tapBuff') {
      setActiveEvent({ id: 'freq_harness', name: 'FREQUENCY HARNESSED', tapMult: 3, duration: 15, icon: 'bolt', desc: '×3 Tap Power active!' });
      setEventTimeLeft(15);
      pushToast({ tone: 'cyan', icon: 'bolt', title: 'FREQUENCY HARNESSED', text: '×3 Tap Power active for 15s!' });
    }
    Audio.rankUp && Audio.rankUp();
    setChoiceEvent(null);
  };

  // ── Buy handler ─────────────────────────────────────────────────
  const buy = (def) => {
    setSave(cur => {
      const c = cur.clicker || {};
      const owned = c.buildings?.[def.id] || 0;
      const budget = c.drops || 0;
      let count, cost;
      if (buyMode === 'max') {
        const r = maxAffordable(def, owned, budget);
        count = r.count; cost = r.cost;
      } else {
        count = Math.min(buyMode, 9999);
        cost = bulkCost(def, owned, count);
      }
      if (count <= 0 || budget < cost) return cur;
      return {
        ...cur,
        clicker: { ...c, drops: budget - cost, buildings: { ...(c.buildings || {}), [def.id]: owned + count } },
      };
    });
    setRatePop(true);
    setTimeout(() => setRatePop(false), 250);
    Audio.clickerBuy();
  };

  const buyClick = () => {
    setSave(cur => {
      const c = cur.clicker || {};
      const cost = clickUpgradeCost(c.clickLvl || 0);
      if ((c.drops || 0) < cost) return cur;
      return { ...cur, clicker: { ...c, drops: c.drops - cost, clickLvl: (c.clickLvl || 0) + 1 } };
    });
    setRatePop(true);
    setTimeout(() => setRatePop(false), 250);
    Audio.clickerBuy();
  };

  // ── Claim ───────────────────────────────────────────────────────
  const [claimingMileIdx, setClaimingMileIdx] = useState(null);
  
  const claimAll = (e) => {
    if (!pending.length) return;
    const anchor = e && e.currentTarget ? e.currentTarget : null;
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
      { const p = rollPartsDrop(1); ns.gearSlotParts = addParts(ns, p.slot, p.amount); }
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
    fireClaimFx(anchor, total);
    Audio.levelUp();
    setClaimingMileIdx('all');
    setTimeout(() => setClaimingMileIdx(null), 600);
  };

  const getBuyInfo = (def) => {
    const owned = cl.buildings?.[def.id] || 0;
    const budget = cl.drops || 0;
    if (buyMode === 'max') {
      const r = maxAffordable(def, owned, budget);
      const prog = r.cost > 0 ? Math.min(1, budget / r.cost) : (budget > 0 ? 1 : 0);
      return { count: r.count, cost: r.cost, afford: r.count > 0, progress: prog };
    }
    const count = buyMode;
    const cost = bulkCost(def, owned, count);
    const prog = cost > 0 ? Math.min(1, budget / cost) : 1;
    return { count, cost, afford: budget >= cost, progress: prog };
  };

  const clickCost = clickUpgradeCost(cl.clickLvl || 0);
  const clickAfford = (cl.drops || 0) >= clickCost;
  const clickProgress = clickCost > 0 ? Math.min(1, (cl.drops || 0) / clickCost) : 1;

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

        {/* Event Banner with Alarm Treatment */}
        {activeEvent && (
          <div className="clk-event-banner clk-alarm-active">
            <div className="clk-event-scanline" />
            <div className="clk-event-info">
              <span className="clk-event-name"><GameIcon name={activeEvent.icon} size={16} tone="#ffd166" /> {activeEvent.name}</span>
              <span className="clk-event-desc">{activeEvent.desc}</span>
            </div>
            {activeEvent.taps ? (
              <div className="clk-event-timer">{eventTapsLeft} TAPS</div>
            ) : (
              <div className="clk-event-timer">00:{eventTimeLeft.toString().padStart(2, '0')}</div>
            )}
          </div>
        )}

        {/* Drop readout with rate pop */}
        <div className="clk-readout" style={{ zIndex: 10, textShadow: '0 2px 4px rgba(0,0,0,1)' }}>
          <div className="clk-drops">{fmtDrops(cl.drops || 0)}<span>H2O Drops</span></div>
          <div className={`clk-rate ${ratePop ? 'clk-rate-pop' : ''}`}>
            <span style={{ color: activeEvent?.mult ? '#4dffd4' : 'inherit' }}>{fmtDrops(rate)}/s</span> · 
            <span style={{ color: activeEvent?.tapMult ? '#4dffd4' : 'inherit' }}> {fmtDrops(perClick)} per tap</span>
          </div>
          {combo > 2 && (
            <div className="clk-combo">COMBO ×{combo}</div>
          )}
        </div>

        {/* ── PixiJS Survivor Arena World Canvas (Bigger & Interactive) ── */}
        <div className="clk-world-wrap" onClick={tap}>
          <canvas ref={canvasRef} className="clk-world-canvas" />
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

        {/* Springs (prestige) */}
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
                  {springs > 0 && Array.from({ length: Math.min(springs, 10) }).map((_, i) => (
                    <span key={i} className="clk-spring-icon">💧</span>
                  ))}
                  {springs > 10 && <span> +{springs - 10}</span>}
                  {' '}×{mult.toFixed(2)}
                </span>
              </div>
              {gain > 0 ? (
                <>
                  <div className="clk-spring-desc">
                    Reset the well to bank <b>+{gain}</b> Spring{gain > 1 ? 's' : ''}.
                    Buildings and taps reset — lifetime total and milestones stay.
                  </div>
                  <button className="clk-spring-btn" data-testid="clk-prestige" style={{ position: 'relative', overflow: 'hidden' }}
                    onClick={(e) => {
                      const ns = { ...save, clicker: doPrestige(cl) };
                      setSave(ns); Audio.rankUp && Audio.rankUp();
                      pushToast('✧ +' + gain + ' Spring' + (gain > 1 ? 's' : '') +
                        ' — production ×' + prestigeMult(ns.clicker).toFixed(2));
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
                  Keep producing — the next one comes from lifetime drops.
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Conspiracy Milestone Cards ──────────────────────────── */}
        <div className="clk-mile" style={{ padding: '16px 0', overflow: 'hidden' }}>
          <div className="clk-mile-head" style={{ padding: '0 16px', marginBottom: 12 }}>
            <span>LIFETIME {fmtDrops(cl.total || 0)}</span>
            {next
              ? <span className="clk-mile-next">next at {fmtDrops(next.at)}</span>
              : <span className="clk-mile-next">all milestones claimed</span>}
          </div>
          
          <div className="clk-milestone-scroll">
            {CLICKER_MILESTONES.map((m, idx) => {
              const done = !!(cl.claimed || {})[m.at];
              const ready = !done && (cl.total || 0) >= m.at;
              const locked = !done && !ready;
              const meta = MILESTONE_META[idx] || { name: 'UNKNOWN FILE', flavor: '???', chestType: 'bronze' };
              const vis = CHEST_VISUALS[meta.chestType] || CHEST_VISUALS.bronze;

              return (
                <div
                  key={m.at}
                  className={`clk-milestone-card ${meta.chestType} ${done ? 'done' : ready ? 'ready' : 'locked'} ${claimingMileIdx === 'all' && ready ? 'claiming' : ''}`}
                  style={{ '--chest-glow': vis.glow }}
                  onClick={() => !locked && setMilestoneDetail(milestoneDetail === idx ? null : idx)}
                >
                  <div className="clk-mc-icon">
                    <GameIcon name={vis.icon} size={done ? 20 : ready ? 26 : 18} tone={done ? '#666' : vis.glow} />
                  </div>
                  <div className="clk-mc-body">
                    <div className="clk-mc-name">{locked ? '██████████' : meta.name}</div>
                    <div className="clk-mc-threshold">{fmtDrops(m.at)} drops</div>
                    {!locked && <div className="clk-mc-reward">{m.label}</div>}
                  </div>
                  <div className="clk-mc-stamp">
                    {done && <span className="clk-stamp-done">DECLASSIFIED</span>}
                    {ready && <span className="clk-stamp-ready">CLASSIFIED</span>}
                    {locked && <span className="clk-stamp-locked">■■■</span>}
                  </div>
                  {done && <div className="clk-mc-check"><GameIcon name="ui_check" size={12} tone="#4dffd4" /></div>}
                  {ready && <div className="clk-mc-bang">!</div>}

                  {milestoneDetail === idx && !locked && (
                    <div className="clk-mc-detail">
                      <div className="clk-mc-flavor">"{meta.flavor}"</div>
                      <div className="clk-mc-rewards-list">
                        {Object.entries(m.reward || {}).map(([k, v]) => (
                          <span key={k} className="clk-mc-reward-chip">
                            <GameIcon name={k === 'gold' ? 'coin' : k === 'gems' ? 'gem' : k === 'sp' ? 'bolt' : 'orb'} size={12} tone={vis.glow} />
                            {v} {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {pending.length > 0 && (
            <div style={{ padding: '0 16px', marginTop: 12 }}>
              <button className="clk-claim" onClick={claimAll} data-testid="clk-claim" style={{ width: '100%', margin: 0 }}>
                ✦ DECLASSIFY {pending.length} FILE{pending.length > 1 ? 'S' : ''}
              </button>
            </div>
          )}
        </div>

        {/* ── Shop Section Tabs (Buildings vs Elite Managers) ─────── */}
        <div className="clk-tabs-bar">
          <button
            className={`clk-tab-btn ${shopTab === 'buildings' ? 'active' : ''}`}
            onClick={() => setShopTab('buildings')}
          >
            CONSPIRACY UPGRADES
          </button>
          <button
            className={`clk-tab-btn ${shopTab === 'managers' ? 'active' : ''}`}
            onClick={() => setShopTab('managers')}
          >
            ELITE MANAGERS ({Object.keys(cl.managers || {}).length}/{CLICKER_MANAGERS.length})
          </button>
        </div>

        {shopTab === 'buildings' ? (
          <>
            {/* ── Bulk Buy Toggle ─────────────────────────────────────── */}
            <div className="clk-bulk-bar">
              {[1, 10, 100, 'max'].map(mode => (
                <button
                  key={mode}
                  className={`clk-bulk-btn ${buyMode === mode ? 'active' : ''}`}
                  onClick={() => setBuyMode(mode)}
                >
                  {mode === 'max' ? 'MAX' : `×${mode}`}
                </button>
              ))}
            </div>

            {/* ── Upgrades with Production Cycle Progress & Manual Harvest ── */}
            <div className="clk-shop">
              <button
                className={`clk-buy clk-buy-tap ${clickAfford ? 'can-afford is-ready' : clickProgress >= 0.7 ? 'is-almost-ready' : ''}`}
                disabled={!clickAfford}
                onClick={buyClick}
              >
                <div className="clk-buy-fill" style={{ width: `${Math.round(clickProgress * 100)}%` }} />
                <div className="clk-buy-inner">
                  <span className="clk-buy-name">Stronger Pull <i>Lv {cl.clickLvl || 0}</i></span>
                  <span className="clk-buy-desc">+1 drop per tap</span>
                  <span className={`clk-buy-cost ${clickAfford ? 'cost-ready' : ''}`}>{fmtDrops(clickCost)}</span>
                </div>
              </button>

              {CLICKER_BUILDINGS.map(def => {
                const owned = cl.buildings?.[def.id] || 0;
                const info = getBuyInfo(def);
                const far = info.cost > (cl.drops || 0) * 12;
                const isAlmost = !info.afford && info.progress >= 0.70;
                const cycle = buildingCycles[def.id] || { progress: 0, ready: false };
                const isAuto = isBuildingAutomated(cl, def.id);
                const mgr = CLICKER_MANAGERS.find(m => m.buildingId === def.id);

                return (
                  <div key={def.id} className="clk-building-row">
                    <button
                      className={`clk-buy ${far ? 'far' : ''} ${info.afford ? 'can-afford is-ready' : isAlmost ? 'is-almost-ready' : ''}`}
                      disabled={!info.afford}
                      onClick={() => buy(def)}
                      data-testid={`clk-buy-${def.id}`}
                    >
                      <div className="clk-buy-fill" style={{ width: `${Math.round(info.progress * 100)}%` }} />
                      <div className="clk-buy-inner">
                        <div style={{ display: 'flex', gap: 12 }}>
                          <GameIcon name={def.icon} size={32} tone={info.afford ? '#ffd166' : '#a02c2c'} />
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left' }}>
                            <span className="clk-buy-name">{def.name} {owned > 0 && <i>×{owned}</i>}</span>
                            <span className="clk-buy-desc">{def.desc}</span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                              <span className="clk-buy-rate" style={{ color: info.afford ? '#4dffd4' : '#27a31e', fontWeight: 'bold' }}>
                                +{fmtDrops(def.rate * (buyMode === 'max' ? info.count : buyMode))}/s
                              </span>
                              <span className={`clk-buy-cost ${info.afford ? 'cost-ready' : ''}`} style={{ fontWeight: 'bold' }}>
                                {fmtDrops(info.cost)}
                                {(buyMode !== 1) && <i className="clk-buy-qty"> ×{info.count}</i>}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Production Cycle Gauge & Manual Harvest Bar */}
                    {owned > 0 && (
                      <div className={`clk-cycle-bar ${cycle.ready ? 'is-harvest-ready' : ''}`}
                           onClick={() => !isAuto && cycle.ready && harvestBuilding(def.id)}>
                        <div className="clk-cycle-fill" style={{ width: `${Math.round((cycle.progress || 0) * 100)}%` }} />
                        <div className="clk-cycle-label">
                          {isAuto ? (
                            <span style={{ color: '#4dffd4' }}>
                              ⚡ AUTO: {mgr?.name} ({def.cycle}s)
                            </span>
                          ) : cycle.ready ? (
                            <span className="clk-harvest-btn-text">
                              ✦ CLICK TO HARVEST +{fmtDrops(def.rate * owned * (def.cycle || 1))} H2O
                            </span>
                          ) : (
                            <span>
                              CHARGING: {Math.round((cycle.progress || 0) * 100)}% (Tap when full)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* ── Elite Celebrity Managers Tab ──────────────────────── */
          <div className="clk-managers-list">
            <div className="clk-mgr-intro">
              Hire elite celebrity puppets, occult leaders, and governators to automate your infrastructure and boost speed!
            </div>
            {CLICKER_MANAGERS.map(mgr => {
              const hired = !!(cl.managers || {})[mgr.id];
              const afford = (cl.drops || 0) >= mgr.cost;
              const targetB = CLICKER_BUILDINGS.find(b => b.id === mgr.buildingId);

              return (
                <div key={mgr.id} className={`clk-mgr-card ${hired ? 'hired' : afford ? 'ready' : 'locked'}`}>
                  <div className="clk-mgr-header">
                    <GameIcon name={mgr.icon} size={28} tone={hired ? '#4dffd4' : afford ? '#ffd166' : '#777'} />
                    <div style={{ flex: 1 }}>
                      <div className="clk-mgr-name">{mgr.name}</div>
                      <div className="clk-mgr-title">{mgr.title}</div>
                    </div>
                    {hired ? (
                      <span className="clk-mgr-badge hired">HIRED</span>
                    ) : (
                      <button
                        className={`clk-mgr-hire-btn ${afford ? 'can-afford' : ''}`}
                        disabled={!afford}
                        onClick={() => hireManager(mgr)}
                      >
                        HIRE ({fmtDrops(mgr.cost)})
                      </button>
                    )}
                  </div>
                  <div className="clk-mgr-bio">"{mgr.bio}"</div>
                  <div className="clk-mgr-perk">
                    ⚡ Automates <b>{targetB?.name}</b> {mgr.speedMult > 1 && <span style={{ color: '#4dffd4' }}>(+{Math.round((mgr.speedMult - 1) * 100)}% Speed)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* Tactical Anomaly Choice Modal */}
      {choiceEvent && (
        <div className="clk-revelation-overlay" onClick={() => setChoiceEvent(null)}>
          <div className="clk-revelation-modal clk-choice-modal" onClick={e => e.stopPropagation()}>
            <div className="clk-revelation-title" style={{ color: '#00e5ff' }}>{choiceEvent.title}</div>
            <GameIcon name="bolt" size={38} tone="#00e5ff" style={{ marginBottom: 12 }} />
            <div className="clk-revelation-text" style={{ marginBottom: 20 }}>
              {choiceEvent.text}
            </div>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button className="clk-choice-btn opt-a" onClick={() => resolveChoice(choiceEvent.optA)}>
                <div style={{ fontWeight: 'bold', color: '#ffd166' }}>{choiceEvent.optA.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{choiceEvent.optA.desc}</div>
              </button>
              <button className="clk-choice-btn opt-b" onClick={() => resolveChoice(choiceEvent.optB)}>
                <div style={{ fontWeight: 'bold', color: '#00e5ff' }}>{choiceEvent.optB.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{choiceEvent.optB.desc}</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {milestoneDetail !== null && (
        <div className="clk-milestone-detail-bg" onClick={() => setMilestoneDetail(null)} />
      )}

      <ClaimFx />
    </div>
  );
}
