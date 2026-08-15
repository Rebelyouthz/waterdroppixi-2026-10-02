import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import { SKILL_INDEX, WEAPON_PARTS } from '../game/data_ext';
import { ACTIVE_SKILLS, characterSlots, resolveStartWeapon, CHAR_RARITY_COLORS } from '../game/data_ext2';
import { HEADBANDS } from '../game/data_ext';
import { POE_INDEX, POE_ATTRS } from '../game/poe_tree';
import { rollGearDrop, applyGearToStats, gearDropHappens, rollPartsDrop, addParts, PART_NAMES } from '../game/gear';
import { applyArtifactsToStats } from '../game/artifacts';
import { applyRunesToStats } from '../game/runes';
import { Audio } from '../game/audio';
import { petStageMult } from './PetPanel';
import { attachmentLooks } from '../game/attachments';
import { pushToast } from '../game/toastBus';
import { isRescued } from '../game/companions';
import { DIFF_INDEX } from '../game/difficulty';
import { resolvedDifficultyMods } from '../game/campaign';
import HUD from './Hud';
import LevelUpModal from './LevelUpModal';
import GameOver from './GameOverScreen';
import MobileControls from './MobileControls';
import HeroFigure from './HeroFigure';
import GameIcon from './GameIcon';

function buildMetaEffects(save) {
  const m = save.meta || {};
  const sk = save.skills || {};
  const eqList = Object.values(save.equipped || {});
  const shopB = save.shopBonuses || {};
  const cb = save.charBonuses || {};
  const tb = save.talentBonuses || {};
  const metaSum = (id, mult) => (m[id] || 0) * mult;

  // Weapon / active-skill slots. The rule lives in data_ext2's characterSlots
  // so this and the Character panel can never disagree about what a level
  // opens — they used to keep two copies of the table.
  const charRarity = save.character?.rarity || 'common';
  const charLvl = save.character?.level || 0;
  const { slots, skillSlots } = characterSlots(charRarity, charLvl);

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
    // engine.js seeds projSpeedMult/projRangeMult from `meta.projspd` and
    // `meta.projrange`. Those keys were never written here, so both stayed
    // undefined and every level of Swift Rounds / Long Barrel bought with gold
    // did nothing at all — while the in-run STAT_CARDS versions worked, which
    // made the meta ones look randomly broken rather than unimplemented.
    projspd:   metaSum('m_projspd', 0.0015),
    projrange: metaSum('m_projrange', 0.0012),
    // Same silent-gap bug as projspd, found by the dead-config sweep:
    // engine.js seeds the level-up blast from `meta.lvlBoomDmg` /
    // `meta.lvlBoomKB`, and nothing here wrote either key — so Shockwave
    // Mastery and Earthshaker, 20 gold-bought levels each, changed nothing.
    lvlBoomDmg: metaSum('m_lvlBoomDmg', 10),
    lvlBoomKB:  metaSum('m_lvlBoomKB', 20),
    revive:   !!m.m_revive,
    startBoon:(m.m_start || 0),
    area: 0, proj: 0, pierce: 0,
    headshot: 0, berserk: false, dash: false, dashcd: 0, blink: false, shield: false, swipeAttack: false, bossDmg: 0, voidBurst: 0,
    flags: {},
    // Character system
    weaponSlots: slots,
    skillSlots,
    unlockedWeapons: save.unlockedWeapons || [],
    // Unique Astro Prospector cards this profile has unlocked. Read by
    // buildLevelUpChoices, which skips every gated card not listed here.
    prospectCards: save.prospectCards || [],
    // Forwarded alongside prospectCards because engine.buildLevelUpChoices
    // gates on BOTH. Missing this would make every shop-unlocked card
    // permanently invisible with no error anywhere — the same silent-gap
    // failure the weapon icons had.
    shopCards: save.shopCards || [],
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
  const BOOLEAN_STATS = new Set(['berserk','dash','blink','shield','revive','chestSense','swipeAttack','forksUnlocked','undertowDash','riptideMastery']);
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

  // The loose-parts system (save.parts / save.equippedParts) used to be read
  // here. It was one of three overlapping weapon-part systems; attachments
  // won, old parts are migrated into attachInventory in store.js, and the
  // stat block that lived here is gone with them. Attachments apply at the
  // end of computeWeaponStats instead, per weapon, not as global meta.

  // Apply new gear system items
  // This used to be an inline copy of applyGearToStats that read `item.val`
  // directly — which meant gear LEVELS did nothing in a run. The whole gear
  // parts economy was being spent on a number the engine never saw.
  // applyGearToStats scales by level (gearStatValue) and applies set
  // bonuses, and it is the only place that knows how, so call it.
  applyGearToStats(save, result);
  applyArtifactsToStats(save, result);
  applyRunesToStats(save, result);

  // Base Defence pays out into the NEXT run, not into itself. The buff is
  // consumed by GameScreen when the run starts (see the effect below), so
  // holding waves is worth something even though the mode has no loot of
  // its own.
  const db = save.defenceBuff;
  if (db) {
    result.dmg   += db.dmg   || 0;
    result.armor += db.armor || 0;
    result.gold  += db.gold  || 0;
  }
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
      // Growth stage is a real multiplier now, not just a label — see
      // petStageMult in PetPanel, which the panel displays from the same
      // function so the two cannot drift apart.
      const stageMult = petStageMult(activePet.level);
      result[ps.stat] = (result[ps.stat] || 0) + ps.perLevel * activePet.level * lvlMult * stageMult;
    }
  }

  return result;
}

export default function GameScreen({ save, setSave, onExit, onRunEnd, mission, payout }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [snap, setSnap] = useState(null);
  // False until the Pixi renderer reports a live context. Drives the loader
  // that covers the black gap while Pixi downloads its browser chunk.
  const [rendererReady, setRendererReady] = useState(false);
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
    // pond_1's "First Drops": the player should be exactly as strong as a
    // brand-new save, every time it's played — no accumulated meta/attrs/
    // pets/skills bonuses — because the enemies in it (see data.js's
    // 'sludgeling'/'silthulk') are hand-tuned to die in a specific number of
    // katana swings AT that baseline. `meta`/`attrs` are simply skipped
    // rather than zeroed field-by-field: every consumer already treats a
    // missing key as "no bonus" (see buildMetaEffects's `m[id] || 0`
    // pattern), so `{}` is exactly "none of these apply".
    const forceBaseline = mission && mission.forceBaseline;
    const meta = forceBaseline ? {} : buildMetaEffects(save);
    // The Base Defence buff is one run only — it has been folded into `meta`
    // above, so burn it now rather than at run end, which never fires if the
    // player quits out mid-run.
    if (save.defenceBuff) setSave(s => ({ ...s, defenceBuff: null }));
    // Tutorial missions start with pre-boosted meta
    if (isTutorial && mission.startMeta) {
      Object.assign(meta, mission.startMeta);
      meta.maxHp = (meta.maxHp || 0) + (mission.startMeta.maxHp || 0);
    }
    const opts = {
      meta,
      attrs: forceBaseline ? {} : (save.attrs || {}),
      weaponElements: save.weaponElements || {},
      saveRef: save,   // weapon attachments read the socket map + inventory
      // Resolved once per run rather than per frame — attachments cannot
      // change mid-run, and the renderer should not be searching an inventory
      // sixty times a second.
      attachFor: (wid) => attachmentLooks(save, wid),
      cosmetics: {
        headbandColor: HEADBANDS.find(h => h.id === save.profile?.headband)?.color || null,
        cigarOn: !!save.profile?.cigarOn,
      },
      // A returning save replaying pond_1 shouldn't walk in with a pet/
      // skills/evolutions either — those are bonus power same as meta/attrs,
      // and would break the same 2/3/8-hit tuning the forced baseline exists
      // to guarantee. A truly fresh save has none of these yet anyway, so
      // this only ever matters on a replay.
      activePet: forceBaseline ? null : ((save.pets || []).find(p => p.active) || null),
      unlockedEvos: forceBaseline ? [] : (save.unlockedEvos || []),
      skills: forceBaseline ? {} : (save.skills || {}),
      // Two only — one pod per joystick dial. Unknown ids (a save carrying a
      // retired skill) are dropped rather than reaching the engine.
      activeSkills: forceBaseline ? [] : (save.equippedActives || []).filter(id => id && ACTIVE_SKILLS[id]).slice(0, 2),
      // The tutorial dictates its own loadout — it is teaching two specific
      // weapons. pond_1 dictates its own too — it's the katana, always,
      // regardless of what's equipped in the Weaponsmith's START group so
      // the enemy HP tuning holds. Every other run opens with whatever the
      // Weaponsmith's START group has selected, validated here: the
      // engine's `snapshot()` reads `WEAPONS[id].icon` every frame, so an
      // id it has no entry for would throw sixty times a second rather
      // than fail quietly.
      startWeapons: ((isTutorial || forceBaseline) && mission.startWeapons) ? mission.startWeapons : [resolveStartWeapon(save)],
      missionDuration: mission ? mission.duration : null,
      spawnMult: mission ? (mission.spawnMult || 1.0) : 1.0,
      // Difficulty tier. The tutorial is pinned to Normal regardless of what
      // the profile is set to — a returning player replaying the tutorial on
      // Nightmare would be taught the game by a fight they cannot win.
      diff: isTutorial ? DIFF_INDEX.normal : resolvedDifficultyMods(save),
      // Campaign node: hold-out time before the map's guardian arrives.
      bossAt: mission ? (mission.bossAt || 0) : 0,
      bossId: mission ? (mission.bossId || null) : null,
      // Only spawn the companion if this node has one AND they haven't
      // already been rescued — a node replayed after the fact is just the
      // node, not a repeat rescue.
      rescueCompanion: (mission && mission.companion && !isRescued(save, mission.companion.id)) ? mission.companion : null,
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
            const isBoss = !!drop.boss;
            const cur = initialSaveRef.current;
            if (gearDropHappens(isBoss)) {
              // Equipment: guaranteed from a boss, uncommon otherwise.
              const item = rollGearDrop(drop.timeInRun, isBoss);
              initialSaveRef.current = { ...cur, gearInventory: [...(cur.gearInventory || []), item] };
              pushToast({ tone: item.rarity, icon: 'shield', title: item.name, text: item.rarity.toUpperCase() });
            } else {
              // Everything that used to be an equipment drop and no longer is
              // pays parts instead, so the pickup never turns into nothing --
              // it just stops being another item to sort.
              const p = rollPartsDrop(isBoss ? 3 : 1);
              initialSaveRef.current = { ...cur, gearSlotParts: addParts(cur, p.slot, p.amount) };
              pushToast({ tone: 'magic', icon: 'shield', title: `+${p.amount} ${PART_NAMES[p.slot]}`, text: 'GEAR PARTS' });
            }
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
            // The hold-out time this node's reward tiers are measured against
            // — the death screen uses it to say which tier the run actually
            // earned rather than guessing from the clock.
            gateTime: mission && mission.isCampaign ? (mission.bossAt || 0) : 0,
          });
          // `initialSaveRef` is a snapshot taken when this screen MOUNTED, and
          // it is never refreshed. Meanwhile App's 10s `tickIdle` and its
          // `settleProgression` effect keep writing to the real save all the
          // way through the run — clicker production, quest completions, the
          // gold and pendingRewards they pay out.
          //
          // Writing `{ ...initialSaveRef.current, ... }` back wholesale threw
          // every one of those away: a quest could complete mid-run, toast,
          // credit gold, and then silently un-complete when you died — and
          // complete and toast AGAIN on the next settle.
          //
          // So the run's own fields are collected here, and merged onto the
          // CURRENT save functionally below. Only these four are owned by the
          // run; everything else must come from `cur`.
          const runOwned = initialSaveRef.current;
          // `bestKills` has always stored the best run LEVEL, not kills — the
          // achievement list reads it that way. Rather than break every save
          // that depends on it, `bestLevel` is written alongside as the field
          // that says what it means, and the quest chain reads that one.
          // Built inside the updater so every counter increments from whatever
          // the save is NOW, not from a snapshot taken minutes ago.
          const buildSave = (cur) => {
            const next = {
              ...cur,
              // --- fields the run owns, carried over from the accumulator ---
              gearInventory: runOwned.gearInventory,
              gearSlotParts: runOwned.gearSlotParts,
              codex: runOwned.codex,
              // --- run results, applied to the live values ---
              gold: (cur.gold || 0) + r.gold,
              lifetimeGold: (cur.lifetimeGold || 0) + r.gold,
              runsCompleted: (cur.runsCompleted || 0) + 1,
              bestRunTime: Math.max(cur.bestRunTime || 0, r.time),
              bestKills: Math.max(cur.bestKills || 0, r.level),
              bestLevel: Math.max(cur.bestLevel || 0, r.level),
              bestScore: Math.max(cur.bestScore || 0, r.score || 0),
              totalKills: (cur.totalKills || 0) + r.kills,
            };
            // Runs carried out with the katana, so the storyline can ask for
            // one and actually know whether it happened. `snapshot()` exposes
            // the carried weapons as `weapons: [{ id, name, lvl, icon }]` —
            // NOT as a bare `ownedWeapons` id list, which is what this first
            // reached for and would have made the whole quest permanently
            // uncompletable with no error anywhere.
            if ((r.weapons || []).some(w => w && w.id === 'katana')) {
              next.katanaRuns = (cur.katanaRuns || 0) + 1;
            }
            if (r.noHit) next.noHitRuns = (cur.noHitRuns || 0) + 1;
            return next;
          };
          setSave(buildSave);
          // onRunEnd wants the resulting save. Derive it from the accumulator
          // as a best-effort snapshot for the reward screen — the authoritative
          // write is the functional update above.
          onRunEnd && onRunEnd(r, buildSave(runOwned), mission);
        },
        onPauseToggle: () => setPaused(p => { const np = !p; g.setPaused(np); return np; }),
      },
    };
    const g = new Game(canvas, opts);

    // Hold a load screen up until the renderer has actually started.
    //
    // PixiJS's Application.init() dynamically imports a browser-environment
    // chunk, so starting a run fires a network request. Over a slow link that
    // is seconds of BLACK SCREEN with the music already playing — the game
    // looks hung when it is only downloading. `readyPromise` is the renderer's
    // own signal that it has a context and its layers built, so gate on that
    // rather than on a timer that would be wrong on every device.
    const rp = g.renderer && g.renderer.readyPromise;
    if (rp && typeof rp.then === 'function') {
      rp.then(() => setRendererReady(true))
        // A failed init already draws its own diagnostic panel (_fatal), so
        // clear the loader either way — leaving it up would hide the one
        // message that explains what went wrong.
        .catch(() => setRendererReady(true));
    } else {
      setRendererReady(true);
    }

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

      {/* Covers the gap between "music started" and "world visible". Without
          it the player gets a black screen with audio and no way to tell the
          game from a hang. Sits above the canvas and below everything else. */}
      {!rendererReady && (
        <div className="game-loader" data-testid="game-loader">
          <div className="game-loader-drop">
            {/* Was a fifth hand-drawn copy of the character — the same blue
                blob the intro used, with a different body curve from the real
                one and no face at all. Found by the guard in wiring.test.mjs
                the first time it ran. */}
            <HeroFigure rarColor={CHAR_RARITY_COLORS[save.character?.rarity] || CHAR_RARITY_COLORS.common} />
          </div>
          <div className="game-loader-bar"><i /></div>
          <div className="game-loader-text">CONDENSING…</div>
        </div>
      )}

      {!gameOverResult && <HUD snap={snap} onActiveSkill={onActiveSkill} isTutorial={!!(mission && mission.isTutorial)} mission={mission} levelUpOpen={!!levelUpChoices} />}
      <MobileControls onUpdate={onMobileUpdate} onReload={onMobileReload} onDashDir={onMobileDashDir} onSwipeAttack={onMobileSwipeAttack} dashCD={snap ? snap.dashCD : 0} dashMaxCD={snap ? snap.dashMaxCD : 2.4} dashReady={snap ? snap.dashReady : false} swipeAttackUnlocked={snap ? snap.swipeAttackUnlocked : false} swipeAttackCD={snap ? snap.swipeAttackCD : 0} swipeAttackMaxCD={snap ? snap.swipeAttackMaxCD : 1.1} visible={!gameOverResult} activeSkills={snap ? snap.activeSkills : []} onActiveSkill={onActiveSkill} />
      {levelUpChoices && <LevelUpModal choices={levelUpChoices} onPick={pickCard} playerLevel={snap ? snap.level : 1} />}
      {paused && !gameOverResult && (
        <div className="pause-overlay">
          <div className="pause-box">
            <h2>PAUSED</h2>
            <button onClick={() => { setPaused(false); gameRef.current.setPaused(false); }} data-testid="resume">Resume</button>
            <button onClick={() => { gameRef.current.destroy(); onExit('menu'); }} data-testid="quit-menu">Menu</button>
            <button onClick={() => { gameRef.current.destroy(); onExit('camp'); }} data-testid="quit-camp"><GameIcon name="ui_base" size={16} /> Camp</button>
          </div>
        </div>
      )}
      {gameOverResult && (
        <GameOver result={gameOverResult} extras={gameOverExtras} save={save} payout={payout} onMenu={() => onExit('menu')} onCamp={() => onExit('camp')} onRetry={() => onExit('retry')} />
      )}
    </div>
  );
}
