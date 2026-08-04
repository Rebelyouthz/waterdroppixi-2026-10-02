import React, { useEffect, useState } from 'react';
import axios from 'axios';
import MainMenu from './components/MainMenu';
import Welcome from './components/Welcome';
import IntroDialogue from './components/IntroDialogue';
import Camp from './components/Camp';
import GameScreen from './components/GameScreen';
import StarRaidScreen from './components/StarRaidScreen';
import MissionReveal from './components/MissionReveal';
import PaywallModal from './components/PaywallModal';
import { loadSave, saveLocal, syncSave, postRunResult, DEFAULT_SAVE, getPlayerId, addAccountXp, tickIdle } from './store';
import { rollMissionRewards, MISSION_DEFS, CHALLENGES, ACHIEVEMENTS } from './game/data_ext2';
import { AuthProvider, StripeReturnHandler, AuthCallback, useAuth } from './auth';
import { Audio } from './game/audio';
import { rollArtifact } from './game/artifacts';
import { rollGearDrop } from './game/gear';
import { rollRune } from './game/runes';
import { rewardTier, rollCampaignChest, nextCampaignNode, nodeToMission, REWARD_TIERS } from './game/campaign';
import { PET_TYPES } from './components/PetPanel';

function AppInner() {
  const [view, setView] = useState(null);
  const [save, setSaveState] = useState(loadSave());
  const [booted, setBooted] = useState(false);
  const [activeMission, setActiveMission] = useState(null);
  const [missionReward, setMissionReward] = useState(null);
  const [campaignPayout, setCampaignPayout] = useState(null);
  const [runKey, setRunKey] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const { paid, loading: authLoading, user } = useAuth();

  // Start menu music on first user interaction (browsers block autoplay).
  // Keeps playing across views; only the GameScreen will swap music on game start.
  useEffect(() => {
    const start = () => { try { Audio.startMusic(); } catch (e) {} };
    document.addEventListener('pointerdown', start, { once: true });
    document.addEventListener('keydown', start, { once: true });
    document.addEventListener('touchstart', start, { once: true });
    return () => {
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
      document.removeEventListener('touchstart', start);
    };
  }, []);

  useEffect(() => {
    getPlayerId();
    setTimeout(() => {
      setBooted(true);
      if (!save.profile.name) setView('welcome');
      else if (!save.introSeen) setView('intro');
      else setView('welcome');
    }, 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'game') document.body.classList.add('in-game');
    else document.body.classList.remove('in-game');
    return () => document.body.classList.remove('in-game');
  }, [view]);

  // Accepts either a save object or a React-style updater function. The
  // updater form matters wherever a caller must not clobber changes made
  // between render and commit (e.g. GameScreen burning a one-run buff on
  // mount) — passing a function straight through to saveLocal used to
  // persist the function itself.
  const setSave = (next) => {
    setSaveState(cur => {
      const ns = typeof next === 'function' ? next(cur) : next;
      saveLocal(ns);
      syncSave(ns);
      return ns;
    });
  };

  // Settle every time-based system (patrol, incubator, and later the clicker)
  // from one place, on load and then periodically. tickIdle returns the same
  // reference when nothing moved, so this cannot loop.
  useEffect(() => {
    const settle = () => {
      setSaveState(cur => {
        const next = tickIdle(cur, Date.now());
        if (next !== cur) saveLocal(next);
        return next;
      });
    };
    settle();
    const t = setInterval(settle, 10000);
    // iOS Safari ignores user-scalable=no in the viewport meta, so a pinch or
    // a double-tap still zooms the whole page — which during a run means the
    // canvas scales out from under the joysticks. These are the only two
    // paths left, and neither is ever a wanted gesture here.
    const killGesture = (e) => e.preventDefault();
    let lastTap = 0;
    const killDoubleTap = (e) => {
      const now = Date.now();
      if (now - lastTap < 320) e.preventDefault();
      lastTap = now;
    };
    document.addEventListener('gesturestart', killGesture, { passive: false });
    document.addEventListener('gesturechange', killGesture, { passive: false });
    document.addEventListener('dblclick', killGesture, { passive: false });
    document.addEventListener('touchend', killDoubleTap, { passive: false });
    // Coming back from a backgrounded tab is exactly when a lot of offline
    // time has just elapsed, so settle immediately rather than waiting out
    // the interval.
    const onVis = () => { if (!document.hidden) settle(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('gesturestart', killGesture);
      document.removeEventListener('gesturechange', killGesture);
      document.removeEventListener('dblclick', killGesture);
      document.removeEventListener('touchend', killDoubleTap);
    };
  }, []);

  const onRunEnd = (result, newSave, mission) => {
    const ns = { ...newSave };
    ns.quests = { ...ns.quests, completed: { ...ns.quests.completed } };
    const bump = (id, v) => { const q = ns.quests.completed; q[id] = Math.max(q[id] || 0, v); };
    bump('q_kill_100', result.kills); bump('q_kill_300', result.kills); bump('q_kill_500', result.kills);
    bump('q_surv_3', result.time); bump('q_surv_5', result.time); bump('q_surv_8', result.time);
    bump('q_lvl_10', result.level); bump('q_lvl_20', result.level); bump('q_lvl_30', result.level);
    bump('q_gold_500', result.gold); bump('q_gold_1000', result.gold);
    if (result.victory) { bump('q_boss', 1); }
    if (result.noHit && result.victory) { bump('q_nohit', 1); }
    if (result.maxCombo) { bump('q_combo_50', result.maxCombo); }
    // runs quest: count today's completed runs
    ns.quests.completed['q_runs_3'] = (ns.quests.completed['q_runs_3'] || 0) + 1;

    // Gear Parts banked from the run — the currency that levels equipment.
    if (result.gearParts) ns.gearParts = (ns.gearParts || 0) + result.gearParts;

    // Weekly quests accumulate (sum) across runs all week, unlike daily
    // quests above (which track the best single run via Math.max).
    ns.weeklyQuests = { ...ns.weeklyQuests, completed: { ...ns.weeklyQuests.completed } };
    const wsum = (id, v) => { const q = ns.weeklyQuests.completed; q[id] = (q[id] || 0) + v; };
    wsum('wq_runs_15', 1);
    wsum('wq_kills_1000', result.kills || 0);
    wsum('wq_boss_5', result.victory ? 1 : 0);
    wsum('wq_lvl_100', result.level || 0);
    wsum('wq_gold_5000', result.gold || 0);
    // ---- Campaign node payout ----
    // Tiered by how far you got, so a failed attempt is still worth something
    // — a node you nearly cleared should not pay the same as one you walked
    // out of after thirty seconds.
    if (mission && mission.isCampaign && mission.node) {
      const tier = rewardTier(result, mission.node);
      const chests = [];
      for (let i = 0; i < tier; i++) chests.push(rollCampaignChest(mission.node, i === tier - 1 && result.victory));
      for (const chest of chests) {
        for (const item of chest) {
          if (item.type === 'gold') { ns.gold = (ns.gold || 0) + item.amount; ns.lifetimeGold = (ns.lifetimeGold || 0) + item.amount; }
          else if (item.type === 'gearParts') ns.gearParts = (ns.gearParts || 0) + item.amount;
          else if (item.type === 'gems') ns.gems = (ns.gems || 0) + item.amount;
          else if (item.type === 'sp') ns.sp = (ns.sp || 0) + item.amount;
          else if (item.type === 'petFood') ns.petFood = (ns.petFood || 0) + item.amount;
          else if (item.type === 'gear') ns.gearInventory = [...(ns.gearInventory || []), rollGearDrop(result.time, true)];
          else if (item.type === 'rune') ns.runeInventory = [...(ns.runeInventory || []), rollRune(ns.attrs?.luck || 0)];
        }
      }
      if (result.victory) ns.mapProgress = { ...(ns.mapProgress || {}), [mission.node.id]: true };
      setCampaignPayout({ tier, node: mission.node, chests });
    }

    if (result.victory && mission && mission.id && mission.id.startsWith('m_')) {
      // Mission success — roll rewards
      const md = MISSION_DEFS.find(m => m.id === mission.id);
      if (md) {
        const rwd = rollMissionRewards(md.reward);
        const ns2 = { ...ns };
        ns2.gold = (ns2.gold || 0) + (rwd.gold || 0);
        ns2.lifetimeGold = (ns2.lifetimeGold || 0) + (rwd.gold || 0);
        // shards
        const bs = { ...(ns2.blueprintShards || {}) };
        for (const [k, v] of Object.entries(rwd.blueprintShards || {})) bs[k] = (bs[k] || 0) + v;
        ns2.blueprintShards = bs;
        // parts
        const inv = [...(ns2.parts || []), ...(rwd.parts || [])];
        ns2.parts = inv;
        // track legendary
        const legCount = (rwd.parts || []).filter(p => p.rarity === 'legendary').length;
        if (legCount > 0) ns2.legendaryPartsFound = (ns2.legendaryPartsFound || 0) + legCount;
        setSaveState(ns2); saveLocal(ns2); syncSave(ns2);
        setMissionReward(rwd);
        postRunResult({ duration: result.time, level: result.level, kills: result.kills, gold: result.gold, wave: Math.ceil(result.time / 30) });
        return;
      }
    }
    if (mission && mission.isChallenge && result.victory) {
      const c = CHALLENGES.find(x => x.id === mission.id);
      if (c) {
        ns.challengesDone = { ...(ns.challengesDone || {}), [c.id]: true };
        ns.gold = (ns.gold || 0) + c.rwd.gold;
        ns.sp = (ns.sp || 0) + c.rwd.sp;
      }
    }
    if (result.victory) ns.aidaSlain = (ns.aidaSlain || 0) + 1;
    if (result.necroKilled) ns.necroSlain = (ns.necroSlain || 0) + 1;
    if (result.voidKilled)  ns.voidSlain  = (ns.voidSlain  || 0) + 1;
    if (result.horusKilled) ns.horusSlain = (ns.horusSlain || 0) + 1;
    if (result.endless)     ns.endlessReached = (ns.endlessReached || 0) + 1;
    if (mission && mission.isDailyChallenge && result.victory && mission.doneKey) {
      ns.dailyChallengesDone = { ...(ns.dailyChallengesDone || {}), [mission.doneKey]: true };
      ns.gold = (ns.gold || 0) + (mission.rwd?.gold || 0);
      ns.sp   = (ns.sp   || 0) + (mission.rwd?.sp   || 0);
    }
    if (mission && mission.isMap && result.victory && mission.mapNodeId) {
      ns.mapProgress = { ...(ns.mapProgress || {}), [mission.mapNodeId]: true };
      ns.gold = (ns.gold || 0) + (mission.rwd?.gold || 0);
      ns.sp   = (ns.sp   || 0) + (mission.rwd?.sp   || 0);
      // Map completion gives gems + possibly a slot coin
      ns.gems = (ns.gems || 0) + 5;
      if (Math.random() < 0.25) ns.slotCoins = (ns.slotCoins || 0) + 1;
    }
    // Tutorial completion: mark done (keep earnings)
    if (mission && mission.isTutorial) {
      ns.tutorialDone = true;
    }
    // Gems from kills (1 gem per 50 kills)
    ns.gems = (ns.gems || 0) + Math.floor((result.kills || 0) / 50);
    // Boss kills give extra gems
    if (result.necroKilled) ns.gems = (ns.gems || 0) + 10;
    if (result.voidKilled)  ns.gems = (ns.gems || 0) + 10;
    if (result.horusKilled) ns.gems = (ns.gems || 0) + 8;
    if (result.victory)     ns.gems = (ns.gems || 0) + 15;

    // Post-boss variation: each boss grants something distinct beyond gear
    // drops + gems, so beating one doesn't always feel like the same
    // reward. Eye of Horus -> guaranteed artifact; Void Titan -> Gacha
    // Token (feeds the Artifact Gacha Machine); Necromancer -> a free pet
    // egg; A.I.D.A. (the run-ending victory) -> a bigger artifact pull +
    // extra Gacha Tokens, since it's the campaign's actual finale.
    if (result.horusKilled) {
      ns.artifactInventory = [...(ns.artifactInventory || []), rollArtifact(1)];
    }
    if (result.voidKilled) {
      ns.gachaTokens = (ns.gachaTokens || 0) + 1;
    }
    if (result.necroKilled) {
      const petType = PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)];
      ns.petEggs = [...(ns.petEggs || []), { id: Date.now() + '_necroegg', type: petType.id, rarity: 'rare' }];
    }
    if (result.victory) {
      ns.artifactInventory = [...(ns.artifactInventory || []), rollArtifact(3)];
      ns.gachaTokens = (ns.gachaTokens || 0) + 2;
    }
    // Talent Points: +5 per run, +2 bonus if 1000+ kills
    ns.talentPoints = (ns.talentPoints || 0) + 5;
    if ((result.kills || 0) >= 1000) ns.talentPoints += 2;
    addAccountXp(ns, result.kills * 2 + result.level * 5 + (result.victory ? 200 : 0) + Math.floor(result.time / 6));
    ns.sp = (ns.sp || 0) + 1 + Math.floor(result.level / 5);
    setSave(ns);
    postRunResult({ duration: result.time, level: result.level, kills: result.kills, gold: result.gold, wave: Math.ceil(result.time / 30) });
    // Submit to leaderboard (fire-and-forget; backend ignores if not authenticated)
    if (user) {
      const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';
      axios.post(`${API}/leaderboard/submit`, {
        time: result.time, level: result.level, kills: result.kills,
        victory: !!result.victory, no_hit: !!result.noHit,
      }, { withCredentials: true }).catch(() => {});
    }
  };

  const onMission = (mission) => {
    setActiveMission(mission);
    setRunKey(k => k + 1);
    setView('game');
  };

  const reset = () => {
    if (!window.confirm('Erase your save? All progress will be lost.')) return;
    const fresh = { ...DEFAULT_SAVE };
    setSaveState(fresh); saveLocal(fresh);
    setView('welcome');
  };

  // Tutorial: first time fight → start tutorial mission
  const TUTORIAL_MISSION = {
    isTutorial: true,
    id: 'tutorial',
    name: 'Tutorial',
    duration: 240, // 4 minutes
    tutorialMode: true,
    startMeta: { maxHp: 25, dmg: 0.3, mspd: 0.25, crit: 0.05 },
    startWeapons: ['hydropistol', 'runebolts'],
    startCards: ['power_i', 'vital_i', 'swift_i'],
  };

  // Gate function: try to start gameplay. Show paywall if not entitled.
  const tryStartGame = (proceed, missionOverride) => {
    if (paid) { proceed(missionOverride); return; }
    const starts = save.runStarts || 0;
    if (starts < 3) {
      setSave({ ...save, runStarts: starts + 1 });
      proceed(missionOverride);
      return;
    }
    setShowPaywall(true);
  };

  const startNormalGame = () => {
    tryStartGame(() => { setActiveMission(null); setRunKey(k => k + 1); setView('game'); });
  };

  const startTutorialIfNeeded = () => {
    if (!save.tutorialDone) {
      // First ever run: launch tutorial
      tryStartGame(() => { setActiveMission(TUTORIAL_MISSION); setRunKey(k => k + 1); setView('game'); });
    } else {
      startNormalGame();
    }
  };

  if (!booted || !view || authLoading) {
    return (<div className="boot"><div className="boot-spin" /><div>WATERDROP SURVIVOR</div></div>);
  }

  if (view === 'welcome') {
    return (<>
      <Welcome save={save} setSave={setSave}
        onContinue={() => { if (!save.introSeen) { setView('intro'); } else { startTutorialIfNeeded(); } }}
        onCamp={() => setView('camp')} />
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </>);
  }
  if (view === 'intro') {
    return (<IntroDialogue onDone={() => { setSave({ ...save, introSeen: true }); startTutorialIfNeeded(); }} />);
  }
  if (view === 'menu') {
    return (<MainMenu save={save} onStart={() => startTutorialIfNeeded()} onCamp={() => setView('camp')} onReset={reset} />);
  }
  if (view === 'camp') {
    return (<>
      <Camp save={save} setSave={setSave}
        onBack={() => setView('welcome')}
        onStart={() => startTutorialIfNeeded()}
        onMission={(m) => tryStartGame(() => onMission(m), m)}
        onStory={() => {
          // "Continue story" resumes at the first node not yet cleared.
          const node = nextCampaignNode(save);
          if (!node) return;
          const m = nodeToMission(node);
          tryStartGame(() => onMission(m), m);
        }}
        onStarRaid={() => setView('starraid')} />
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </>);
  }
  if (view === 'starraid') {
    return (<StarRaidScreen save={save} setSave={setSave} onExit={() => setView('camp')} />);
  }
  if (view === 'game') {
    return (<>
      <GameScreen key={runKey} save={save} setSave={setSave} mission={activeMission}
        onRunEnd={onRunEnd}
        onExit={(where) => {
          if (where === 'retry') { setRunKey(k => k + 1); }
          else if (where === 'menu') setView('welcome');
          else setView(where);
        }} />
      {missionReward && <MissionReveal rewards={missionReward} onClose={() => { setMissionReward(null); setView('camp'); }} />}
      {campaignPayout && (
        <div className="modal-overlay" data-testid="campaign-payout">
          <div className="camp-payout">
            <div className="camp-payout-node">{campaignPayout.node.mapIcon} {campaignPayout.node.mapName} — {campaignPayout.node.name}</div>
            <div className={`camp-payout-tier t${campaignPayout.tier}`}>
              {REWARD_TIERS[campaignPayout.tier].label}
            </div>
            <div className="camp-payout-chests">
              {[0, 1, 2].map(i => (
                <div key={i} className={`camp-chest${i < campaignPayout.tier ? ' won' : ''}`}>
                  {i < campaignPayout.tier ? '🎁' : '🔒'}
                </div>
              ))}
            </div>
            <div className="camp-payout-list">
              {campaignPayout.chests.flat().map((it, i) => (
                <span key={i} className="camp-payout-item">
                  {it.type === 'gold' ? `★ ${it.amount}`
                    : it.type === 'gearParts' ? `🔩 ${it.amount}`
                    : it.type === 'gems' ? `💎 ${it.amount}`
                    : it.type === 'sp' ? `◆ ${it.amount}`
                    : it.type === 'petFood' ? `🍖 ${it.amount}`
                    : it.type === 'gear' ? '🪖 Equipment'
                    : '🔮 Rune'}
                </span>
              ))}
            </div>
            <button className="prosp-btn go" onClick={() => { setCampaignPayout(null); setView('camp'); }}>Continue</button>
          </div>
        </div>
      )}
    </>);
  }
  return null;
}

export default function App() {
  // OAuth callback: detect session_id in URL fragment SYNCHRONOUSLY during render
  // (NOT inside useEffect — that runs after first render, too late to prevent
  // the rest of the app from trying to render with no auth).
  const hash = (typeof window !== 'undefined') ? window.location.hash : '';
  if (hash && hash.indexOf('session_id=') !== -1) {
    return (
      <AuthProvider>
        <AuthCallback />
      </AuthProvider>
    );
  }
  return (
    <AuthProvider>
      <StripeReturnHandler>
        <AppInner />
      </StripeReturnHandler>
    </AuthProvider>
  );
}
