import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import { SKILL_INDEX, WEAPON_PARTS } from '../game/data_ext';
import { STARTER_WEAPONS, PART_SLOT_INFO } from '../game/data_ext2';
import { HEADBANDS } from '../game/data_ext';
import { POE_INDEX, POE_ATTRS } from '../game/poe_tree';
import { rollGearDrop } from '../game/gear';
import { applyArtifactsToStats } from '../game/artifacts';
import { applyRunesToStats } from '../game/runes';
import { Audio } from '../game/audio';
import HUD from './HUD';
import LevelUpModal from './LevelUpModal';
import GameOver from './GameOverScreen';
import MobileControls from './MobileControls';

function buildMetaEffects(save) {
  const m = save.meta || {};
  const sk = save.skills || {};
  const eqList = Object.values(save.equipped || {});
  const shopB = save.shopBonuses || {};
  const cb = save.charBonuses || {};
  const tb = save.talentBonuses || {};
  const metaSum = (id, mult) => (m[id] || 0) * mult;

  const charRarity = save.character?.rarity || 'common';
  const SLOTS = { common:2, uncommon:3, rare:4, epic:5, legendary:6, mythical:7 };
  const slots = SLOTS[charRarity] || 2;

  const result = {
    maxHp:    metaSum('m_hp', 1)     + (shopB.maxHp || 0) + (cb.maxHp || 0) + (tb.maxHp || 0),
    dmg:      metaSum('m_dmg', 0.002) + (shopB.dmg || 0)  + (cb.dmg   || 0) + (tb.dmg   || 0),
    atks:     metaSum('m_atks', 0.002) + (shopB.atks || 0),
    mspd:     metaSum('m_spd', 0.002) + (shopB.mspd || 0) + (cb.mspd  || 0) + (tb.mspd  || 0),
    crit:     metaSum('m_crit', 0.001) + (shopB.crit || 0) + (cb.crit  || 0) + (tb.crit  || 0),
    critd:    metaSum('m_critd', 0.005) + (shopB.critd || 0) + (cb.critd || 0) + (tb.critd || 0),
    superCrit: metaSum('m_superCrit', 0.005),
    megaCrit:  metaSum('m_megaCrit',  0.002),
    armor:    metaSum('m_armor', 0.1) + (shopB.armor || 0) + (cb.armor  || 0) + (tb.armor  || 0),
    regen:    metaSum('m_regen', 0.02),
    pickup:   metaSum('m_pickup', 0.01) + (shopB.pickup || 0),
    xp:       metaSum('m_xp', 0.005) + (shopB.xp || 0)   + (cb.xp    || 0) + (tb.xp    || 0),
    gold:     metaSum('m_gold', 0.005) + (shopB.gold || 0) + (cb.gold  || 0) + (tb.gold  || 0),
    luck:     metaSum('m_luck', 0.05) + (shopB.luck || 0),
    dodge:    metaSum('m_dodge', 0.001),
    heartHeal: metaSum('m_heal', 0.5),
    zoom:     metaSum('m_zoom', 0.005),
    revive:   !!m.m_revive,
    startBoon:(m.m_start || 0),
    area: 0, proj: 0, pierce: 0,
    headshot: 0, berserk: false, dash: false, dashcd: 0, blink: false, shield: false, swipeAttack: false, bossDmg: 0, voidBurst: 0,
    flags: {},
    // Character system
    weaponSlots: slots,
    skillSlots: slots,
    unlockedWeapons: save.unlockedWeapons || [],
  };

  // Old SKILL_TREE nodes (sk_ prefix)
  Object.entries(sk).forEach(([id, lvl]) => {
    const s = SKILL_INDEX[id]; if (!s || lvl < 1) return;
    const amt = s.amount * lvl;
    if (['dmg','crit','critd','atks','mspd','armor','regen','pickup','xp','gold','luck','dodge','area','proj','pierce','headshot','dashcd','bossDmg','voidBurst','superCrit','megaCrit'].includes(s.stat)) {
      result[s.stat] = (result[s.stat] || 0) + amt;
    } else if (s.stat === 'maxhp') result.maxHp += amt;
    else if (s.stat === 'berserk') result.berserk = true;
    else if (s.stat === 'dash') result.dash = true;
    else if (s.stat === 'blink') result.blink = true;
    else if (s.stat === 'shield') result.shield = true;
    else if (s.stat === 'revive') result.revive = true;
  });

  // New POE tree nodes (poe_ prefix)
  const BOOLEAN_STATS = new Set(['berserk','dash','blink','shield','revive','chestSense','swipeAttack']);
  Object.entries(sk).forEach(([id, lvl]) => {
    const pn = POE_INDEX[id]; if (!pn || lvl < 1) return;
    const amt = pn.val * lvl;
    const st  = pn.stat;
    if (st === 'maxHp')    result.maxHp += amt;
    else if (BOOLEAN_STATS.has(st)) result[st] = true;
    else if (st === 'chestSense') result.flags.chestSense = true;
    else if (result[st] !== undefined) result[st] += amt;
    else result[st] = amt;
  });

  // Attribute point bonuses (save.attrs). mob (Agility) and aim (Aim) are
  // curve-based and applied directly in engine.js instead (see
  // agilityMult/aimSpreadMult) — skip them here so they don't also get a
  // flat bonus on top of the curve.
  const attrs = save.attrs || {};
  for (const a of POE_ATTRS) {
    if (a.curve) continue;
    const pts = attrs[a.id] || 0;
    if (pts <= 0) continue;
    const bonus = a.perPoint * pts;
    if (a.stat === 'maxHp') result.maxHp += bonus;
    else if (result[a.stat] !== undefined) result[a.stat] += bonus;
    else result[a.stat] = bonus;
  }

  for (const eq of eqList) {
    if (!eq) continue;
    for (const st of eq.stats) {
      if (st.stat === 'maxhp') result.maxHp += st.val;
      else if (st.stat === 'armor') result.armor += st.val;
      else if (st.stat === 'regen') result.regen += st.val;
      else if (result[st.stat] !== undefined) result[st.stat] += st.val;
    }
  }

  // Old weaponsmith tiers (kept for compatibility)
  const oldParts = save.weaponParts || {};
  const pistolParts = oldParts['hydropistol'] || {};
  if (pistolParts.barrel && WEAPON_PARTS.barrel) result.dmg += (WEAPON_PARTS.barrel.tiers[pistolParts.barrel] || {}).dmg || 0;
  if (pistolParts.sight && WEAPON_PARTS.sight)   result.crit += (WEAPON_PARTS.sight.tiers[pistolParts.sight] || {}).crit || 0;
  if (pistolParts.rarity && WEAPON_PARTS.rarity) result.dmg += ((WEAPON_PARTS.rarity.tiers[pistolParts.rarity] || {}).mult - 1) * 0.4 || 0;

  // NEW parts inventory equipped per starter weapon
  const parts = save.parts || [];
  const eqParts = save.equippedParts || {};
  for (const wid of Object.keys(eqParts)) {
    const slotMap = eqParts[wid] || {};
    for (const slot of Object.keys(slotMap)) {
      const p = parts.find(x => x.id === slotMap[slot]); if (!p) continue;
      const apply = (stat, val) => {
        if (stat === 'magBonus') result.maxHp += 0; // mag bonus = no HP effect
        else if (['damage','dmg'].includes(stat)) result.dmg += val;
        else if (stat === 'fireRate') result.atks += val;
        else if (stat === 'pierce') result.pierce += Math.floor(val);
        else if (stat === 'crit') result.crit += val;
        else if (stat === 'critd') result.critd += val;
        else if (stat === 'mspd') result.mspd += val;
        else if (stat === 'headshot') result.headshot += val;
        else if (stat === 'atks') result.atks += val;
        else if (stat === 'reloadMult') result.atks += val * 0.5;
        else if (stat === 'knockback') result.dmg += val * 0.2;
        else if (stat === 'spreadReduce') result.crit += val * 0.1;
        else if (stat === 'range' || stat === 'projSpeed') result.dmg += val * 0.1;
        else if (stat === 'burn' || stat === 'shock') { result.flags.burnDoT = true; }
      };
      apply(p.primary.stat, p.primary.val);
      for (const sub of p.sub) apply(sub.stat, sub.val);
    }
  }

  // Apply new gear system items
  const gearInv = save.gearInventory || [];
  const gearEq  = save.gearEquipped  || {};
  for (const slot of ['helmet','chest','arms','legs','boots','ring','amulet']) {
    const itemId = gearEq[slot];
    if (!itemId) continue;
    const item = gearInv.find(x => x.id === itemId);
    if (!item) continue;
    const { stat, val } = item;
    if (stat === 'maxHp') result.maxHp += val;
    else if (result[stat] !== undefined) result[stat] += val;
    else result[stat] = val;
    if (item.secondary) result.armor += item.secondary.val;
  }
  applyArtifactsToStats(save, result);
  applyRunesToStats(save, result);
  const activePet = (save.pets || []).find(p => p.active);
  if (activePet) {
    const PET_STAT_MAP = {
      aquaSprite: { stat: 'dmg',       perLevel: 0.001 },
      shadowWisp: { stat: 'dodge',     perLevel: 0.001 },
      emberFairy: { stat: 'crit',      perLevel: 0.001 },
      stormHawk:  { stat: 'superCrit', perLevel: 0.002 },
      lifeSprite: { stat: 'regen',     perLevel: 0.003  },
    };
    const ps = PET_STAT_MAP[activePet.type];
    if (ps) {
      const lvlMult = 1 + (activePet.level - 1) / 100;
      result[ps.stat] = (result[ps.stat] || 0) + ps.perLevel * activePet.level * lvlMult;
    }
  }

  return result;
}

export default function GameScreen({ save, setSave, onExit, onRunEnd, mission }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [levelUpChoices, setLevelUpChoices] = useState(null);
  const [gameOverResult, setGameOverResult] = useState(null);
  const [gameOverExtras, setGameOverExtras] = useState(null);
  const [paused, setPaused] = useState(false);
  const initialSaveRef = useRef(save);

  useEffect(() => {
    Audio.startMusic();
    Audio.swapToGameMusic();
    const canvas = canvasRef.current;
    const isTutorial = mission && mission.isTutorial;
    const meta = buildMetaEffects(save);
    // Tutorial missions start with pre-boosted meta
    if (isTutorial && mission.startMeta) {
      Object.assign(meta, mission.startMeta);
      meta.maxHp = (meta.maxHp || 0) + (mission.startMeta.maxHp || 0);
    }
    const opts = {
      meta,
      attrs: save.attrs || {},
      weaponElements: save.weaponElements || {},
      cosmetics: {
        headbandColor: HEADBANDS.find(h => h.id === save.profile?.headband)?.color || null,
        cigarOn: !!save.profile?.cigarOn,
      },
      activePet: (save.pets || []).find(p => p.active) || null,
      unlockedEvos: save.unlockedEvos || [],
      skills: save.skills || {},
      activeSkills: (save.equippedActives || []).filter(Boolean),
      startWeapons: (isTutorial && mission.startWeapons) ? mission.startWeapons : ['hydropistol'],
      missionDuration: mission ? mission.duration : null,
      spawnMult: mission ? (mission.spawnMult || 1.0) : 1.0,
      stage: mission ? null : null,
      challenge: mission && mission.isChallenge ? mission.mod : null,
      tutorialMode: isTutorial,
      callbacks: {
        onTick: (s) => {
          setSnap(s);
          // Process pending gear drops from engine
          if (gameRef.current && gameRef.current._pendingGearDrop) {
            const drop = gameRef.current._pendingGearDrop;
            gameRef.current._pendingGearDrop = null;
            const item = rollGearDrop(drop.timeInRun);
            const cur = initialSaveRef.current;
            initialSaveRef.current = { ...cur, gearInventory: [...(cur.gearInventory || []), item] };
          }
        },
        onGameOver: (r) => {
          setGameOverResult(r);
          // Calculate run rewards summary for death screen
          const isBest = r.time > (save.bestRunTime || 0);
          const xpGained = r.kills * 2 + r.level * 5 + (r.victory ? 200 : 0) + Math.floor(r.time / 6);
          const spGained = 1 + Math.floor(r.level / 5);
          setGameOverExtras({
            xpGained,
            spGained,
            isBestTime: isBest,
            isBestKills: r.kills > (save.bestKills || 0),
            isBestScore: (r.score || 0) > (save.bestScore || 0),
            noHit: !!r.noHit,
            challengeBonus: mission && mission.isChallenge && r.victory ? (mission.mod ? { gold: 500, sp: 5 } : null) : null,
          });
          const baseSave = initialSaveRef.current;
          const newSave = { ...baseSave, gold: baseSave.gold + r.gold, lifetimeGold: (baseSave.lifetimeGold || 0) + r.gold, runsCompleted: baseSave.runsCompleted + 1, bestRunTime: Math.max(baseSave.bestRunTime, r.time), bestKills: Math.max(baseSave.bestKills, r.level), bestScore: Math.max(baseSave.bestScore || 0, r.score || 0), totalKills: baseSave.totalKills + r.kills };
          if (r.noHit) newSave.noHitRuns = (newSave.noHitRuns || 0) + 1;
          setSave(newSave);
          onRunEnd && onRunEnd(r, newSave, mission);
        },
        onPauseToggle: () => setPaused(p => { const np = !p; g.setPaused(np); return np; }),
      },
    };
    const g = new Game(canvas, opts);
    // Gear drop + codex callbacks
    g.onCodexKill = (enemyId) => {
      const cur = initialSaveRef.current;
      const enemies = cur.codex?.enemies || {};
      const cnt = (enemies[enemyId]?.count || 0) + 1;
      initialSaveRef.current = { ...cur, codex: { ...cur.codex, enemies: { ...enemies, [enemyId]: { count: cnt } } } };
    };
    // Track weapon usage for Codex
    const weapId = opts.weapon?.id || opts.weaponId;
    if (weapId) {
      const cur = initialSaveRef.current;
      const w = cur.codex?.weapons || {};
      initialSaveRef.current = { ...cur, codex: { ...cur.codex, weapons: { ...w, [weapId]: { count: (w[weapId]?.count||0) + 1 } } } };
    }
    gameRef.current = g;
    if (typeof window !== 'undefined') window.__game = g;
    return () => { g.destroy(); Audio.swapToMenuMusic(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gameRef.current) return;
    // Read LIVE engine state (not stale snap) — snap is from previous frame and
    // would still say pendingLevelUp=true right after the user picks a card,
    // causing the modal to re-open in a loop.
    if (levelUpChoices || gameOverResult) return;
    if (gameRef.current.levelUpQueue > 0) {
      const c = gameRef.current.buildLevelUpChoices();
      if (c && c.length > 0) setLevelUpChoices(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, gameOverResult, levelUpChoices]);

  const pickCard = (c) => { gameRef.current.applyCardChoice(c); setLevelUpChoices(null); };
  const onMobileUpdate = useCallback((joyMove, joyAim, firing) => {
    if (gameRef.current) gameRef.current.setMobileInput(joyMove, joyAim, firing);
  }, []);
  const onMobileReload = () => gameRef.current && gameRef.current.tryReload();
  const onMobileDashDir = (nx, ny) => gameRef.current && gameRef.current.tryDash(nx, ny);
  const onMobileSwipeAttack = (nx, ny) => gameRef.current && gameRef.current.trySwipeAttack(nx, ny);
  const onActiveSkill = (i) => gameRef.current && gameRef.current.tryActiveSkill(i);

  return (
    <div className="game-stage">
      <canvas ref={canvasRef} id="game" data-testid="game-canvas" />
      {!gameOverResult && <HUD snap={snap} onActiveSkill={onActiveSkill} isTutorial={!!(mission && mission.isTutorial)} />}
      <MobileControls onUpdate={onMobileUpdate} onReload={onMobileReload} onDashDir={onMobileDashDir} onSwipeAttack={onMobileSwipeAttack} dashCD={snap ? snap.dashCD : 0} dashReady={snap ? snap.dashReady : false} swipeAttackUnlocked={snap ? snap.swipeAttackUnlocked : false} swipeAttackCD={snap ? snap.swipeAttackCD : 0} visible={!gameOverResult} activeSkills={snap ? snap.activeSkills : []} onActiveSkill={onActiveSkill} />
      {levelUpChoices && <LevelUpModal choices={levelUpChoices} onPick={pickCard} playerLevel={snap ? snap.level : 1} />}
      {paused && !gameOverResult && (
        <div className="pause-overlay">
          <div className="pause-box">
            <h2>PAUSED</h2>
            <button onClick={() => { setPaused(false); gameRef.current.setPaused(false); }} data-testid="resume">Resume</button>
            <button onClick={() => { gameRef.current.destroy(); onExit('menu'); }} data-testid="quit-menu">Menu</button>
            <button onClick={() => { gameRef.current.destroy(); onExit('camp'); }} data-testid="quit-camp">⛺ Camp</button>
          </div>
        </div>
      )}
      {gameOverResult && (
        <GameOver result={gameOverResult} extras={gameOverExtras} onMenu={() => onExit('menu')} onCamp={() => onExit('camp')} onRetry={() => onExit('retry')} />
      )}
    </div>
  );
}
