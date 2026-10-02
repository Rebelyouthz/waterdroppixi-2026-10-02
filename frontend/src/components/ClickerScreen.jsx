import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CLICKER_BUILDINGS, CLICKER_MANAGERS, isBuildingAutomated,
  CLICKER_MAPS, CLICKER_RESEARCH_TREE,
  buildingCost, clickUpgradeCost,
  dropsPerSec, dropsPerClick, pendingMilestones, nextMilestone,
  CLICKER_MILESTONES, fmtDrops,
  prestigeGain, prestigeMult, doPrestige,
  currentChapter, headlinesForChapter, unlockedDossiers, rollEvent,
  CONSPIRACY_CHAPTERS, getEquippedShipDetails
} from '../game/clicker';
import { rollRune } from '../game/runes';
import { rollPartsDrop, addParts } from '../game/gear';
import { rollCard } from '../game/petTcg';
import { clickerRateMult } from '../game/base';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';
import { fireClaimFx } from './ClaimFx';
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
    () => save.clicker || { drops: 0, total: 0, buildings: {}, clickLvl: 0, claimed: {}, springs: 0, prestiges: 0, managers: {}, tech: {}, metaInsight: 0, shipScrap: 0, shipParts: {} },
    [save.clicker],
  );
  const wellMult = clickerRateMult(save);
  
  const chapter = currentChapter(cl);
  const chapterIdx = CONSPIRACY_CHAPTERS.findIndex(c => c.id === chapter.id);
  const headlines = headlinesForChapter(cl);
  const dossiers = unlockedDossiers(cl);
  
  // Selected Map Expedition
  const [selectedMap, setSelectedMap] = useState('pyramid');

  // Event State
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventTimeLeft, setEventTimeLeft] = useState(0);
  const [eventTapsLeft, setEventTapsLeft] = useState(0);

  // Tactical Anomaly Choice Modal State
  const [choiceEvent, setChoiceEvent] = useState(null);

  // Shop navigation tab: 'buildings' | 'managers' | 'research' | 'expeditions'
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

  const [dossierOpen, setDossierOpen] = useState(false);
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [showRevelation, setShowRevelation] = useState(false);
  const [buyMode, setBuyMode] = useState(1); // 1, 10, 100, 'max'
  const [combo, setCombo] = useState(0);
  const comboTimer = useRef(null);
  const [ratePop, setRatePop] = useState(false);
  const [gainText, setGainText] = useState('');
  const popRef = useRef(null);
  const tapBag = useRef(0);
  const tapFlush = useRef(null);
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
    return () => {
      clickerActive.current = false;
      if (tapFlush.current) clearTimeout(tapFlush.current);
    };
  }, []);

  const [worldReady, setWorldReady] = useState(false);
  const [worldFailed, setWorldFailed] = useState(false);

  // ── PixiJS conspiracy world canvas ──────────────────────────────
  const canvasRef = useRef(null);
  const worldRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const world = new ClickerWorld(canvasRef.current, {
      mapId: selectedMap,
      theme: chapter.theme,
      chapter: chapterIdx,
      onTapWell: (x, y) => {
        tapFromCanvas(x, y);
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
          return {
            ...cur,
            clicker: {
              ...c,
              drops: (c.drops || 0) + gain,
              total: (c.total || 0) + gain,
              metaInsight: (c.metaInsight || 0) + 1,
            },
          };
        });
        pushToast({ tone: 'gold', icon: 'bolt', title: `${(en.kind || 'TARGET').toUpperCase()} DESTROYED!`, text: `+${fmtDrops(gain)} Drops & +1 Insight!` });
        Audio.clickerTap && Audio.clickerTap();
      },
      onChestUnlocked: () => {
        const gain = Math.max(200, Math.floor(dropsPerSec(cl) * 35 + 100));
        setSave(cur => {
          const c = cur.clicker || {};
          return {
            ...cur,
            clicker: {
              ...c,
              drops: (c.drops || 0) + gain,
              total: (c.total || 0) + gain,
              metaInsight: (c.metaInsight || 0) + 5,
              shipScrap: (c.shipScrap || 0) + 3,
            },
          };
        });
        pushToast({ tone: 'legendary', icon: 'ui_chest', title: 'TREASURE CHEST CRACKED!', text: `+${fmtDrops(gain)} Drops, +5 Insight & +3 Ship Scraps!` });
        Audio.rewardFanfare && Audio.rewardFanfare();
      },
      onArnoldTapped: () => {
        const bonus = Math.max(300, dropsPerSec(cl) * 40 + perClick * 25);
        setSave(cur => {
          const c = cur.clicker || {};
          return {
            ...cur,
            clicker: {
              ...c,
              drops: (c.drops || 0) + bonus,
              total: (c.total || 0) + bonus,
              metaInsight: (c.metaInsight || 0) + 10,
            },
          };
        });
        pushToast({ tone: 'gold', icon: 'pVamp', title: 'ARMOLD ENERGIZED!', text: `Armold flexes on his miniature pony! +${fmtDrops(bonus)} Drops!` });
        Audio.levelUp && Audio.levelUp();
      },
      onPresidentDumbTapped: () => {
        const bonus = Math.max(500, dropsPerSec(cl) * 50);
        setSave(cur => {
          const c = cur.clicker || {};
          return {
            ...cur,
            clicker: {
              ...c,
              drops: (c.drops || 0) + bonus,
              total: (c.total || 0) + bonus,
            },
          };
        });
        pushToast({ tone: 'gold', icon: 'beam', title: 'PRESIDENT DUMB SPEAKS!', text: `"TREMENDOUS WATER!" +${fmtDrops(bonus)} Drops!` });
        Audio.rewardFanfare && Audio.rewardFanfare();
      },
      onHeroLevelUp: (newLvl) => {
        pushToast({ tone: 'legendary', icon: 'bolt', title: 'HERO LEVEL UP!', text: `Waterdrop Hero reached Level ${newLvl}! Production boosted!` });
        Audio.levelUp && Audio.levelUp();
      },
      onDaySurvived: () => {
        setSave(cur => {
          const c = cur.clicker || {};
          return {
            ...cur,
            clicker: {
              ...c,
              metaInsight: (c.metaInsight || 0) + 50,
              shipScrap: (c.shipScrap || 0) + 10,
            },
          };
        });
        pushToast({ tone: 'legendary', icon: 'gem', title: '24-HOUR CYCLE SURVIVED!', text: `+50 Cosmic Insight & +10 Star-Atlas Ship Scraps!` });
        Audio.rewardFanfare && Audio.rewardFanfare();
      },
      onLootDiscovered: (lootId) => {
        setSave(cur => {
          const c = cur.clicker || {};
          const lootGain = Math.max(100, dropsPerSec(c) * 20);
          return {
            ...cur,
            clicker: {
              ...c,
              drops: (c.drops || 0) + lootGain,
              total: (c.total || 0) + lootGain,
            },
          };
        });
        pushToast({ tone: 'legendary', icon: 'gem', title: 'SECRET LOOT UNEARTHED!', text: `Extracted ancient harmonic cache!` });
        Audio.rewardFanfare && Audio.rewardFanfare();
      },
    });

    world.init()
      .then(() => { if (!world.destroyed) setWorldReady(true); })
      .catch((err) => { console.error(err); setWorldFailed(true); });
    worldRef.current = world;

    return () => {
      world.destroy();
      worldRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync hero stats with click level & prestiges
  useEffect(() => {
    if (!worldRef.current) return;
    const tier = (cl.prestiges > 2 || (cl.clickLvl || 0) >= 50) ? 4
      : (cl.prestiges > 0 || (cl.clickLvl || 0) >= 25) ? 3
      : (cl.clickLvl || 0) >= 10 ? 2 : 1;
    worldRef.current.updateHeroStats({
      lvl: (cl.clickLvl || 0) + 1,
      tier,
    });
  }, [cl.clickLvl, cl.prestiges]);

  // Handle map switch with Star-Atlas spaceship hyperspace sequence
  const switchMap = (newMapId) => {
    if (selectedMap === newMapId) return;
    const shipDetails = getEquippedShipDetails(save);
    if (worldRef.current && worldRef.current.startHyperspaceTravel) {
      worldRef.current.startHyperspaceTravel(newMapId, () => {
        setSelectedMap(newMapId);
      }, shipDetails);
    } else {
      setSelectedMap(newMapId);
    }
  };

  // Handle world entity interactions (Stonehenge, Göbekli)
  const handleWorldInteraction = useCallback((id) => {
    if (id === 'stonehenge' || id === 'crop_circle') {
      const gain = Math.max(10, perClick * 3);
      setSave(cur => {
        const c = cur.clicker || {};
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain } };
      });
      pushToast({ tone: 'dim', icon: 'bolt', title: 'SOLSTICE HARMONIC', text: `Stonehenge resonates! +${fmtDrops(gain)} Drops` });
      Audio.clickerTap && Audio.clickerTap();
    } else if (id === 'gobekli' || id === 'gobekli_sanctuary') {
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

        // Income is dropsPerSec, once. This loop only paints the cycle bar.
        // Paying b.rate again here stacked a second economy on the idle tick
        // and called setSave ten times a second, which re-rendered all of camp.
        void autoGainTotal;
        return next;
      });
    }, 400);

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

  // Unlock Research Node
  const unlockResearch = (node) => {
    const cost = node.cost;
    const currentInsight = cl.metaInsight || 0;
    if (currentInsight < cost || (cl.tech || {})[node.id]) return;

    setSave(cur => {
      const c = cur.clicker || {};
      return {
        ...cur,
        clicker: {
          ...c,
          metaInsight: currentInsight - cost,
          tech: { ...(c.tech || {}), [node.id]: true },
        },
      };
    });

    pushToast({
      tone: 'gold',
      icon: 'bolt',
      title: `${node.name.toUpperCase()} RESEARCHED!`,
      text: node.desc,
    });
    Audio.levelUp && Audio.levelUp();
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
  const splashGain = (text) => {
    const host = popRef.current;
    if (!host) return;
    const s = document.createElement('span');
    s.textContent = text;
    host.appendChild(s);
    setTimeout(() => s.remove(), 700);
  };

  const tapFromCanvas = useCallback((x, y) => {
    const gain = perClick;
    tapBag.current += gain;
    splashGain(`+${fmtDrops(gain)}`);
    if (!tapFlush.current) {
      tapFlush.current = setTimeout(() => {
        tapFlush.current = null;
        const banked = tapBag.current;
        tapBag.current = 0;
        if (banked <= 0) return;
        setSave(cur => {
          const c = cur.clicker || {};
          return { ...cur, clicker: { ...c, drops: (c.drops || 0) + banked, total: (c.total || 0) + banked } };
        });
      }, 90);
    }
    if (activeEvent?.taps && eventTapsLeft > 0) {
      setEventTapsLeft(t => { if (t <= 1) setActiveEvent(null); return t - 1; });
    }
    setCombo(c => c + 1);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setCombo(0), 850);
    Audio.clickerTap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perClick, activeEvent, eventTapsLeft, setSave]);

  useEffect(() => {
    const w = worldRef.current;
    if (!w) return;
    w.onTapWell = tapFromCanvas;
  }, [tapFromCanvas]);

  // Handle Tactical Anomaly Choice Resolution
  const resolveChoice = (opt) => {
    if (opt.action === 'burst') {
      const burstAmount = Math.max(500, dropsPerSec(cl) * 45);
      setSave(cur => {
        const c = cur.clicker || {};
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + burstAmount, total: (c.total || 0) + burstAmount } };
      });
      pushToast({ tone: 'gold', icon: 'gem', title: 'SIGNAL DECLASSIFIED', text: `+${fmtDrops(burstAmount)} Drops banked!` });
    } else if (opt.action === 'tapBuff') {
      setActiveEvent({
        id: 'tapBuffChoice',
        name: 'HARNESSED FREQUENCY',
        desc: '×3 Tap Power active',
        tapMult: 3,
        taps: 30,
        icon: 'beam',
      });
      setEventTapsLeft(30);
      pushToast({ tone: 'gold', icon: 'beam', title: 'FREQUENCY HARNESSED', text: '×3 Tap Power for next 30 taps!' });
    }
    setChoiceEvent(null);
  };

  // Passive production tick
  useEffect(() => {
    const t = setInterval(() => {
      if (rate <= 0) return;
      const gain = rate * 0.2;
      setSave(cur => {
        const c = cur.clicker || {};
        return {
          ...cur,
          clicker: {
            ...c,
            drops: (c.drops || 0) + gain,
            total: (c.total || 0) + gain,
            lastMs: Date.now(),
          },
        };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rate, setSave]);

  // Buy building helper
  const buy = (def) => {
    const owned = cl.buildings?.[def.id] || 0;
    let count = 1;
    let cost = 0;

    if (buyMode === 'max') {
      const maxRes = maxAffordable(def, owned, cl.drops || 0);
      if (maxRes.count <= 0) return;
      count = maxRes.count;
      cost = maxRes.cost;
    } else {
      count = buyMode;
      cost = bulkCost(def, owned, count);
      if ((cl.drops || 0) < cost) return;
    }

    setSave(cur => {
      const c = cur.clicker || {};
      const b = { ...(c.buildings || {}) };
      b[def.id] = (b[def.id] || 0) + count;
      return {
        ...cur,
        clicker: {
          ...c,
          drops: (c.drops || 0) - cost,
          buildings: b,
        },
      };
    });
    Audio.clickerBuy();
    setRatePop(true);
    setGainText(`+${fmtDrops((def.rate || 0) * count)}/s`);
    setTimeout(() => { setRatePop(false); setGainText(''); }, 900);
  };

  // Buy click upgrade
  const buyClick = () => {
    const cost = clickUpgradeCost(cl.clickLvl || 0);
    if ((cl.drops || 0) < cost) return;
    setSave(cur => {
      const c = cur.clicker || {};
      return {
        ...cur,
        clicker: {
          ...c,
          drops: (c.drops || 0) - cost,
          clickLvl: (c.clickLvl || 0) + 1,
        },
      };
    });
    Audio.clickerBuy();
    setGainText('+1 per tap');
    setTimeout(() => setGainText(''), 900);
  };

  // Claim milestone helper
  const claim = (idx, e) => {
    const m = CLICKER_MILESTONES[idx];
    if (!m) return;
    if ((cl.claimed || {})[idx]) return;
    if ((cl.total || 0) < m.threshold) return;

    setSave(cur => {
      const c = cur.clicker || {};
      const claimed = { ...(c.claimed || {}), [idx]: true };
      let newSave = { ...cur, clicker: { ...c, claimed } };

      if (m.reward.gold) newSave = { ...newSave, gold: (newSave.gold || 0) + m.reward.gold };
      if (m.reward.gems) newSave = { ...newSave, gems: (newSave.gems || 0) + m.reward.gems };
      if (m.reward.runeTier) {
        const rune = rollRune(m.reward.runeTier);
        newSave = { ...newSave, runes: [...(newSave.runes || []), rune] };
      }
      if (m.reward.petCard) {
        const card = rollCard(m.reward.petCard);
        newSave = { ...newSave, petCards: [...(newSave.petCards || []), card] };
      }
      if (m.reward.gearTier) {
        const part = rollPartsDrop(m.reward.gearTier);
        newSave = addParts(newSave, part);
      }
      return newSave;
    });

    Audio.levelUp();
    if (e && e.currentTarget) fireClaimFx(e.currentTarget, m.reward);
    const meta = MILESTONE_META[idx] || { name: `Tier ${idx + 1}`, chestType: 'bronze' };
    pushToast({
      tone: 'legendary',
      icon: 'ui_chest',
      title: `${meta.name} UNLOCKED!`,
      text: `Dossier declassified! Rewards secured.`,
    });
  };

  const claimAll = (e) => {
    if (pending.length === 0) return;

    let totalGold = 0, totalGems = 0;
    const newRunes = [], newCards = [];
    let curSave = save;

    const newClaimed = { ...(cl.claimed || {}) };
    pending.forEach(({ index, milestone }) => {
      newClaimed[index] = true;
      if (milestone.reward.gold) totalGold += milestone.reward.gold;
      if (milestone.reward.gems) totalGems += milestone.reward.gems;
      if (milestone.reward.runeTier) newRunes.push(rollRune(milestone.reward.runeTier));
      if (milestone.reward.petCard) newCards.push(rollCard(milestone.reward.petCard));
      if (milestone.reward.gearTier) {
        const part = rollPartsDrop(milestone.reward.gearTier);
        curSave = addParts(curSave, part);
      }
    });

    if (e && e.currentTarget) fireClaimFx(e.currentTarget, { gold: totalGold, gems: totalGems, gear: newRunes.length + newCards.length });

    setSave({
      ...curSave,
      gold: (curSave.gold || 0) + totalGold,
      gems: (curSave.gems || 0) + totalGems,
      runes: [...(curSave.runes || []), ...newRunes],
      petCards: [...(curSave.petCards || []), ...newCards],
      clicker: { ...cl, claimed: newClaimed },
    });

    Audio.levelUp();
    pushToast({
      tone: 'legendary',
      icon: 'ui_chest',
      title: `DECLASSIFIED ${pending.length} FILES!`,
      text: `+${totalGold} Gold, +${totalGems} Gems and artifacts secured!`,
    });
  };

  const getBuyInfo = (def) => {
    const owned = cl.buildings?.[def.id] || 0;
    let cost = 0, count = 1, afford = false;
    if (buyMode === 'max') {
      const res = maxAffordable(def, owned, cl.drops || 0);
      count = Math.max(1, res.count);
      cost = res.cost > 0 ? res.cost : buildingCost(def, owned);
      afford = res.count > 0;
    } else {
      count = buyMode;
      cost = bulkCost(def, owned, count);
      afford = (cl.drops || 0) >= cost;
    }
    const progress = cost > 0 ? Math.min(1, (cl.drops || 0) / cost) : 1;
    return { cost, count, afford, progress };
  };

  const clickCost = clickUpgradeCost(cl.clickLvl || 0);
  const clickAfford = (cl.drops || 0) >= clickCost;
  const clickProgress = clickCost > 0 ? Math.min(1, (cl.drops || 0) / clickCost) : 1;

  const equippedShip = getEquippedShipDetails(save);

  return createPortal(
    <div
      className="modal-overlay"
      data-testid="clicker"
      onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}
    >
      <div
        className={`clk-panel clk-theme-${chapter.theme} illuminati-clicker-panel`}
      >
        {/* The Conspiracy Board Background */}
        <div className="clk-conspiracy-board" />
        
        <div className="clk-head" style={{ zIndex: 10 }}>
          <div className="clk-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ffd166', textShadow: '0 0 10px rgba(0,0,0,1)' }}>
            <GameIcon name="ui_eye" size={18} tone="#ffd166" />
            <span>THE WELL</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: 'VT323', color: '#ffd166', fontSize: 16 }}>
              INSIGHT {cl.metaInsight || 0}
            </span>
            <span style={{ fontFamily: 'VT323', color: '#4dffd4', fontSize: 16 }}>
              SCRAP {cl.shipScrap || 0}
            </span>
            <button className="prosp-close" onClick={onClose}>CLOSE</button>
          </div>
        </div>

        {/* ── Expedition Map Selector Bar ─────────────────────────── */}
        <div className="clk-map-selector" style={{ zIndex: 10 }}>
          {CLICKER_MAPS.map(m => (
            <button
              key={m.id}
              className={`clk-map-pill ${selectedMap === m.id ? 'active' : ''}`}
              onClick={() => switchMap(m.id)}
            >
              <span>{m.name}</span>
            </button>
          ))}
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
          {gainText && <div className="clk-gain" data-testid="clk-gain">{gainText}</div>}
          {combo > 2 && (
            <div className="clk-combo">COMBO ×{combo}</div>
          )}
        </div>

        {/* ── PixiJS Survivor Arena World Canvas (Prominent & Responsive) ── */}
        <div className="clk-world-wrap">
          <canvas ref={canvasRef} className="clk-world-canvas" />
          <div className="clk-pop" ref={popRef} aria-hidden="true" />
          {(worldFailed || !worldReady) && (
            <button
              type="button"
              className="clk-well"
              data-testid="clk-well-fallback"
              onClick={() => tapFromCanvas(400, 220)}
              style={{ position: worldFailed ? 'relative' : 'absolute', inset: worldFailed ? 'auto' : 0, zIndex: 2, opacity: worldFailed ? 1 : 0, pointerEvents: worldFailed ? 'auto' : 'none' }}
              aria-label="Tap for drops"
            />
          )}
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

        {/* ── Redacted Milestone Dossiers ─────────────────────────── */}
        <div className="clk-milestones-carousel" style={{ zIndex: 10 }}>
          <div className="clk-milestones-track">
            {CLICKER_MILESTONES.map((m, idx) => {
              const claimed = !!(cl.claimed || {})[idx];
              const unlocked = (cl.total || 0) >= m.threshold;
              const meta = MILESTONE_META[idx] || { name: `FILE #${idx + 1}`, flavor: 'Redacted by order of the Committee.', chestType: 'bronze' };
              const chest = CHEST_VISUALS[meta.chestType] || CHEST_VISUALS.bronze;
              const isNext = next && next.index === idx;

              return (
                <div
                  key={idx}
                  className={`clk-dossier-card ${claimed ? 'claimed' : unlocked ? 'unlocked' : 'redacted'} ${isNext ? 'next-target' : ''}`}
                  onClick={() => setMilestoneDetail(idx)}
                >
                  <div className="clk-card-stamp">{claimed ? 'DECLASSIFIED' : unlocked ? 'READY' : 'TOP SECRET'}</div>
                  
                  <div className="clk-card-icon-wrap" style={{ color: chest.accent }}>
                    <GameIcon name={chest.icon} size={36} tone={chest.accent} />
                  </div>

                  <div className="clk-card-body">
                    <div className="clk-card-title">{meta.name}</div>
                    <div className="clk-card-threshold">{fmtDrops(m.threshold)} DROPS</div>
                    <div className="clk-card-flavor">"{meta.flavor}"</div>
                  </div>

                  {unlocked && !claimed && (
                    <button
                      className="clk-card-claim-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        claim(idx, e);
                      }}
                    >
                      DECLASSIFY
                    </button>
                  )}

                  {milestoneDetail === idx && (
                    <div className="clk-dossier-modal" onClick={e => e.stopPropagation()}>
                      <div className="clk-dossier-modal-title">{meta.name}</div>
                      <div className="clk-dossier-modal-meta">THRESHOLD: {fmtDrops(m.threshold)} H2O</div>
                      <div className="clk-dossier-modal-flavor">{meta.flavor}</div>
                      <div className="clk-dossier-rewards-list">
                        {m.reward.gold && <div>✦ +{m.reward.gold} Gold</div>}
                        {m.reward.gems && <div>✦ +{m.reward.gems} Gems</div>}
                        {m.reward.runeTier && <div>✦ Tier {m.reward.runeTier} Ancient Rune</div>}
                        {m.reward.petCard && <div>✦ Tier {m.reward.petCard} Conspiracy Pet Card</div>}
                        {m.reward.gearTier && <div>✦ Tier {m.reward.gearTier} Black-Ops Gear Parts</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {unlocked && !claimed && (
                          <button className="clk-card-claim-btn" onClick={(e) => { claim(idx, e); setMilestoneDetail(null); }}>
                            CLAIM REWARDS
                          </button>
                        )}
                        <button className="clk-dossier-close-btn" onClick={() => setMilestoneDetail(null)}>CLOSE</button>
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

        <div className="clk-shop-dock">
        <div className="clk-tabs-bar">
          <button
            className={`clk-tab-btn ${shopTab === 'buildings' ? 'active' : ''}`}
            onClick={() => setShopTab('buildings')}
          >
            UPGRADES
          </button>
          <button
            className={`clk-tab-btn ${shopTab === 'managers' ? 'active' : ''}`}
            onClick={() => setShopTab('managers')}
          >
            MANAGERS ({Object.keys(cl.managers || {}).length}/{CLICKER_MANAGERS.length})
          </button>
          <button
            className={`clk-tab-btn ${shopTab === 'research' ? 'active' : ''}`}
            onClick={() => setShopTab('research')}
          >
            RESEARCH MATRIX
          </button>
          <button
            className={`clk-tab-btn ${shopTab === 'expeditions' ? 'active' : ''}`}
            onClick={() => setShopTab('expeditions')}
          >
            EXPEDITIONS & PRESTIGE
          </button>
        </div>

        {shopTab === 'buildings' && (
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
                  <span className="clk-buy-name">Stronger Hydro Aim <i>Lv {cl.clickLvl || 0}</i></span>
                  <span className="clk-buy-desc">+1 drop per tap & faster laser velocity</span>
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
        )}

        {shopTab === 'managers' && (
          /* ── Elite Celebrity Managers Tab ──────────────────────── */
          <div className="clk-managers-list">
            <div className="clk-mgr-intro">
              Hire elite celebrity puppets, governators & world leaders to automate production!
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

        {shopTab === 'research' && (
          /* ── Research Matrix Skill Tree Tab ────────────────────── */
          <div className="clk-research-list">
            <div className="clk-mgr-intro">
              Spend Cosmic Insight earned from monster kills & 24h survival to unlock multiplicative building boosts!
            </div>
            {CLICKER_RESEARCH_TREE.map(node => {
              const researched = !!(cl.tech || {})[node.id];
              const afford = (cl.metaInsight || 0) >= node.cost;

              return (
                <div key={node.id} className={`clk-research-card ${researched ? 'done' : afford ? 'ready' : 'locked'}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="clk-research-name">{node.name}</div>
                      <div className="clk-research-desc">{node.desc}</div>
                    </div>
                    {researched ? (
                      <span className="clk-mgr-badge hired">RESEARCHED</span>
                    ) : (
                      <button
                        className={`clk-mgr-hire-btn ${afford ? 'can-afford' : ''}`}
                        disabled={!afford}
                        onClick={() => unlockResearch(node)}
                      >
                        RESEARCH ({node.cost} Insight)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {shopTab === 'expeditions' && (
          /* ── Expeditions & Star-Atlas Ship Prestige Tab ────────────── */
          <div className="clk-expeditions-list">
            <div className="clk-mgr-intro">
              Deploy your Star-Atlas Cruiser (<span style={{ color: equippedShip.shipColor, fontWeight: 'bold' }}>{equippedShip.shipId.toUpperCase()}</span>) on planetary expeditions and draw ancient Springs!
            </div>

            {/* Expedition Maps */}
            <div className="clk-maps-grid">
              {CLICKER_MAPS.map(m => {
                const isCurrent = selectedMap === m.id;
                return (
                  <div key={m.id} className={`clk-map-card ${isCurrent ? 'active' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: isCurrent ? '#4dffd4' : '#ffd166' }}>{m.name}</div>
                      {isCurrent ? (
                        <span className="clk-mgr-badge hired">CURRENT ARENA</span>
                      ) : (
                        <button className="clk-warp-btn" onClick={() => switchMap(m.id)}>
                          WARP SHIP ✈
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{m.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* Springs Prestige Section */}
            {(() => {
              const gain = prestigeGain(cl);
              const mult = prestigeMult(cl);
              const springs = cl.springs || 0;
              return (
                <div className="clk-spring" data-testid="clk-spring" style={{ marginTop: 16 }}>
                  <div className="clk-spring-head">
                    <span className="clk-spring-title">✧ ANCIENT SPRINGS PRESTIGE</span>
                    <span className="clk-spring-mult">
                      {springs > 0 && Array.from({ length: Math.min(springs, 8) }).map((_, i) => (
                        <span key={i} className="clk-spring-icon">💧</span>
                      ))}
                      {' '}×{mult.toFixed(2)} MULTIPLIER
                    </span>
                  </div>
                  <div className="clk-spring-desc">
                    Reset the well to bank <b>+{gain}</b> Spring{gain > 1 ? 's' : ''}.
                    Your Star-Atlas spaceship will warp through hyperspace, resetting well buildings while preserving permanent insight, milestones and multipliers!
                  </div>
                  {gain > 0 ? (
                    <button
                      className="clk-spring-btn"
                      data-testid="clk-prestige"
                      style={{ position: 'relative', overflow: 'hidden' }}
                      onClick={() => {
                        const shipDetails = getEquippedShipDetails(save);
                        if (worldRef.current && worldRef.current.startHyperspaceTravel) {
                          worldRef.current.startHyperspaceTravel('pyramid', () => {
                            const ns = { ...save, clicker: doPrestige(cl) };
                            setSave(ns);
                            Audio.rankUp && Audio.rankUp();
                            pushToast({
                              tone: 'legendary',
                              icon: 'gem',
                              title: 'SPRING DRAWN!',
                              text: `+${gain} Springs! Production boosted ×${prestigeMult(ns.clicker).toFixed(2)}`,
                            });
                          }, shipDetails);
                        } else {
                          const ns = { ...save, clicker: doPrestige(cl) };
                          setSave(ns);
                          Audio.rankUp && Audio.rankUp();
                          pushToast({
                            tone: 'legendary',
                            icon: 'gem',
                            title: 'SPRING DRAWN!',
                            text: `+${gain} Springs! Production boosted ×${prestigeMult(ns.clicker).toFixed(2)}`,
                          });
                        }
                      }}
                    >
                      ✧ DRAW THE SPRING · +{gain} SPRINGS
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '8px 0' }}>
                      Gather more total drops to unlock the next Spring Prestige tier.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
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
    </div>,
    document.body,
  );
}
