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
import { loadSave, saveLocal, syncSave, postRunResult, DEFAULT_SAVE, getPlayerId, addAccountXp } from './store';
import { rollMissionRewards, MISSION_DEFS, CHALLENGES, ACHIEVEMENTS } from './game/data_ext2';
import { AuthProvider, StripeReturnHandler, AuthCallback, useAuth } from './auth';
import { Audio } from './game/audio';
import { rollArtifact } from './game/artifacts';
import { PET_TYPES } from './components/PetPanel';

function AppInner() {
  const [view, setView] = useState(null);
  const [save, setSaveState] = useState(loadSave());
  const [booted, setBooted] = useState(false);
  const [activeMission, setActiveMission] = useState(null);
  const [missionReward, setMissionReward] = useState(null);
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

  const setSave = (newSave) => {
    setSaveState(newSave);
    saveLocal(newSave);
    syncSave(newSave);
  };

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
