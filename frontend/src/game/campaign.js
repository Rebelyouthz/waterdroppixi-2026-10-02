// =============================================
// STORYLINE CAMPAIGN — the default way to play
// =============================================
// A campaign node runs like a Jotunnslayer stage: you survive a set stretch
// while objectives tick over, the gate opens, and a boss arrives. Killing it
// clears the node.
//
// The point of the structure is that a node has a SHAPE — a beginning where
// you are building, a middle where the objectives push you, and an ending you
// either reach or don't. A flat "survive N minutes" has none of that, which
// is why the old nodes all felt the same regardless of length.

import { MAP_STAGES } from './data_ext2';
import { companionForNode } from './companions';
import { progressFor, resolveDifficulty, difficultyMods, rewardMult } from './difficulty';
import { BUILDINGS, buildingLevel, isStationRepaired } from './base';
import { cannotAffordStationQuest, getActiveBuildQuest } from './stationQuests';

// Which boss closes each map. Ordered so a map's finale escalates with how
// far into the story it sits.
export const MAP_BOSS = {
  // Wiring requires every map id to name a real enemy even when the node
  // itself never spawns a guardian (orbit_find is a timed approach).
  orbit: 'sludgeWarden',
  // The Rain Pool closes on the same guardian the Lake does. Deliberately not
  // a new, weaker boss: meeting the Eye here at diff 0/1 scaling and then
  // meeting it again in the Lake at diff 1-3 teaches the player that a
  // guardian is a fight they can learn, which a one-off pushover would not.
  pond:  'bossOcular',
  lake:  'bossOcular',
  ruins: 'bossNecromancer',
  void:  'bossVoidTitan',
  ship:  'bossAida',
  sky:   'bossTidebreaker',
  gobekli: 'bossAnnunaki',
  // The Deep Current is the last map and had NO entry here at all, so its
  // nodes' "put the guardian down" objective could never be satisfied — the
  // final map of the campaign was uncompletable. The Hollow Queen is the one
  // boss not already spoken for, and a shape-shifting siege fight suits the
  // endless-mode capstone.
  deepcurrent: 'bossHollowQueen',
};

// How long you hold out before the boss gate opens.
//
// The old floor was 180s, which was ABOVE the derived gate for the first five
// nodes — so lake_1, lake_2, ruins_1 and ruins_2 all opened their gate at
// exactly three minutes regardless of their stated duration, and the whole
// early campaign read as one node repeated. The floor is now 150s (still a
// real middle) and the durations in MAP_STAGES have been spread far enough
// apart that the derived value is what actually decides, which is what the
// per-node duration was always supposed to mean.
export function bossGateTime(node) {
  const dur = node.duration || 300;
  // The floor has to stay BELOW the node's own length or the guardian can
  // never appear. At a flat 150 the new Rain Pool nodes (165s and 200s) would
  // have gated at 150s and 150s — the first one barely inside its own runtime,
  // and any shorter node would have been literally uncompletable. The floor is
  // now capped by the node itself, so a short intro node gates early and the
  // long ones are unchanged (lake_1 still 151s).
  const floor = Math.min(150, Math.round(dur * 0.6));
  return Math.max(floor, Math.min(600, Math.round(dur * 0.72)));
}

// Objectives for a node. Derived rather than authored per node: five maps of
// three nodes each is fifteen hand-written lists to keep in sync with the
// durations, and they would drift the first time a duration changed.
export function nodeObjectives(node) {
  if (node.noBoss) {
    const hold = node.duration || 120;
    const killGoal = 12;
    return [
      { id: 'clear',   icon: 'ui_blade', label: `Cut down ${killGoal} of them`, goal: killGoal, metric: 'kills' },
      { id: 'survive', icon: 'ui_clock', label: `Hold the wreck ${Math.round(hold / 60)} minutes`, goal: hold, metric: 'time' },
    ];
  }
  const gate = bossGateTime(node);
  const killGoal = 40 + node.diff * 45;
  return [
    { id: 'clear',   icon: 'ui_blade', label: `Cut down ${killGoal} of them`, goal: killGoal, metric: 'kills' },
    { id: 'survive', icon: 'ui_clock', label: `Hold out ${Math.round(gate / 60)} minutes`, goal: gate, metric: 'time' },
    { id: 'boss',    icon: 'ui_void', label: 'Put the guardian down', goal: 1, metric: 'bossKilled' },
  ];
}

// ---- Reward tiers ----------------------------------------------------------
// Three chests for clearing, two for reaching the boss, one for getting
// meaningfully into the node. Rewarding partial progress is what keeps a
// failed attempt from being wasted time.
export const REWARD_TIERS = [
  { chests: 0, label: 'Nothing recovered' },
  { chests: 1, label: 'Partial haul' },
  { chests: 2, label: 'Reached the guardian' },
  { chests: 3, label: 'Node cleared' },
];

export function rewardTier(result, node) {
  if (!node) return 0;
  // The approach node is binary: you find the wreck or you get pulled out
  // with nothing. Partial chests would teach the opposite of the toast.
  if (node.noBoss) return result.victory ? 3 : 0;
  const gate = bossGateTime(node);
  if (result.victory) return 3;
  if (result.time >= gate) return 2;
  if (result.time >= gate * 0.45) return 1;
  return 0;
}

// What a chest holds. Weighted toward the levelling currency, because gear
// parts are the steady progression and a whole item is the occasional event.
//
// `rm` is the difficulty reward multiplier (see game/difficulty.js). It scales
// the AMOUNTS and lifts the drop CHANCES, but the chance lift is capped — at
// Nightmare's ×2.4 an uncapped roll would put gear and runes at ~100%, which
// would turn the rarest outcome in the chest into the default one and flatten
// the whole loot table into "you always get everything".
export function rollCampaignChest(node, isFinal, rm = 1) {
  const diff = node?.diff || 1;
  const amt = (n) => Math.max(1, Math.round(n * rm));
  const chance = (p) => Math.min(0.85, p * (1 + (rm - 1) * 0.5));
  const out = [];
  out.push({ type: 'gold', amount: amt(220 * diff + Math.round(Math.random() * 180)) });
  out.push({ type: 'gearParts', amount: amt(8 + diff * 6 + Math.floor(Math.random() * 8)) });
  if (Math.random() < chance(0.42 + diff * 0.08)) out.push({ type: 'gear' });
  if (Math.random() < chance(0.18 + diff * 0.06)) out.push({ type: 'rune' });
  if (Math.random() < chance(0.22)) out.push({ type: 'gems', amount: amt(1 + Math.floor(Math.random() * 3)) });
  if (Math.random() < chance(0.30)) out.push({ type: 'petFood', amount: amt(1 + Math.floor(Math.random() * 3)) });
  // The last chest of a cleared node is the one worth chasing.
  if (isFinal) {
    out.push({ type: 'sp', amount: amt(1 + diff) });
    if (Math.random() < 0.5) out.push({ type: 'gearParts', amount: amt(20 + diff * 10) });
  }
  return out;
}

// Flattens MAP_STAGES into the ordered node list the campaign walks through,
// tagging each node with its map so the boss and story beat can be resolved
// from the node alone.
export function campaignNodes() {
  const out = [];
  for (const map of MAP_STAGES) {
    for (const node of map.nodes) {
      out.push({ ...node, mapId: map.id, mapName: map.name, mapIcon: map.icon, mapColor: map.color });
    }
  }
  return out;
}

// The next node the player has not cleared ON THE ACTIVE DIFFICULTY — what
// "Continue story" resumes. Switching to Hard therefore restarts the thread at
// the very first node, which is the intent: Hard is the story again, not the
// story's leftovers.
export function nextCampaignNode(save) {
  const progress = progressFor(save);
  return campaignNodes().find(n => !progress[n.id]) || null;
}

// ---- Camp unlock gating -----------------------------------------------------
// Timmy's intro pitch: the waterdrop washes up with nothing, the camp starts
// LOCKED, and he unlocks it panel by panel by going out from it and finding
// resources — which is just the story reason to play the three Rain Pool
// nodes that already existed as a deliberately gentle on-ramp (see
// paintCampaignNodes / MAP_STAGES's 'pond' entry: "the onramp... spawn rates
// start at 45% of normal"). No new mission type needed — reframe, don't
// rebuild. Always checked against NORMAL's mapProgress regardless of the
// player's selected difficulty, because the unlock is about having played
// the story beat at all, not about which difficulty tier it happened on —
// gating it to the active tier would re-lock the whole camp the moment
// someone switches to Hard, which is not the point of a Hard mode.
const CAMP_UNLOCK_NODES = ['pond_1', 'pond_2', 'pond_3'];
// The orbit approach sits in front of the Rain Pool. Clearing it is "you
// found the wreck", not "you finished a later map" — treating it as
// non-pond progress used to jump campUnlockStage straight to 3 and open
// every tab after the two-minute hold.
const APPROACH_NODES = ['orbit_find'];

// 0 = fresh save, nothing but the story cleared yet. 1/2/3 = that many Rain
// Pool nodes cleared. Stage 3 is "the camp is fully built" — normal play
// from here on.
//
// Grandfathers every existing save: this gate did not exist before it was
// added, so a save that is already past it (cleared a later map, or has
// simply played enough to reach account rank 3+) unlocks everything rather
// than being retroactively locked out of progress it already earned. The
// new-player locked intro only ever fires for a save that has never
// cleared a campaign node at all.
export function campUnlockStage(save) {
  const cleared = save.mapProgress || {};
  const clearedLater = campaignNodes().some(n =>
    !CAMP_UNLOCK_NODES.includes(n.id) && !APPROACH_NODES.includes(n.id) && cleared[n.id]
  );
  if (clearedLater || (save.profile?.level || 1) >= 3) return 3;
  let n = 0;
  for (const id of CAMP_UNLOCK_NODES) { if (cleared[id]) n++; else break; }
  return n;
}

// ---- Camp menu unlock cascade -----------------------------------------------
// Timmy's refinement on top of the pond gate above: locking isn't keyed to
// WHICH pond node you cleared, it's keyed to building at the base. THE BASE
// is the one tab visible from the very start (dimmed until pond_1 is clear
// and there's something to spend) — everything else is fully absent from the
// tab bar, not just dimmed, per "bara base ska finnas där" — until its batch
// unlocks. Buying a building's first level (or any level after) is the
// dopamine moment: it cracks open the next batch of menus, revealed one at a
// time with a banner (see Camp.jsx's unlock-reveal queue).
//
// Deliberately not 1:1 with any single building — Timmy: "de behöver inte va
// exakt de building, de kan låsa upp mer menyer än själva building." So the
// gate is total levels bought across every building, not which one.
export function totalBuildingLevels(save) {
  // THE DRAIN is a hangar fixture (max 1 grate). Counting it here would let
  // unscrewing the hatch fire CAMP_UNLOCK_BATCHES as if it were a camp module.
  // Its own banner is queued explicitly from HangarRoom.
  return Object.keys(BUILDINGS).reduce((a, id) => (
    id === 'drain' ? a : a + buildingLevel(save, id)
  ), 0);
}

// Batch 1 is "the first 3 houses" Timmy names explicitly: Meta Upgrades,
// Skilltree, Talents — unlocked by the very first building purchase.
// Batch 2 ("ta de viktigast efter 3 saker" — take the most important next)
// fires on the SECOND, matching pond_1 + pond_2's gold rewards (700g, then
// 900g) each affording exactly one more building — so the two scripted
// missions map onto two unlock waves, one per mission, rather than the
// second wave waiting on a third mission that doesn't exist yet. Every
// batch after that keeps the cascade going a level at a time so the rest of
// the camp opens smoothly as building continues, without gating on
// missions beyond the two that currently exist.
const CAMP_UNLOCK_BATCHES = [
  { at: 1, tabs: ['cards', 'skills', 'talent'] },
  { at: 2, tabs: ['gear', 'character', 'pets', 'prospector'] },
  { at: 3, tabs: ['starraid', 'patrol', 'clicker'] },
  { at: 4, tabs: ['forge', 'chest', 'shop'] },
  { at: 5, tabs: ['loadout', 'pass', 'codex'] },
];

export function campTabsUnlockedAt(levels) {
  const out = new Set();
  for (const b of CAMP_UNLOCK_BATCHES) if (levels >= b.at) for (const t of b.tabs) out.add(t);
  return out;
}

// Tabs that cross from locked to unlocked between two building-level totals —
// what BasePanel hands Camp.jsx to drive the reveal-banner cascade after a
// purchase.
export function campNewlyUnlocked(beforeLevels, afterLevels) {
  const before = campTabsUnlockedAt(beforeLevels);
  const after = campTabsUnlockedAt(afterLevels);
  return [...after].filter(t => !before.has(t));
}

// Always open, regardless of stage: 'campaign' (how you play at all),
// 'stats' and 'settings' (not game content). Anything not named by 'base' or
// a batch above is also always open — this is an allow-list of what to LOCK,
// so a future tab that forgets to be added here fails open rather than
// trapping the player behind an unwinnable gate.
export function isCampTabLocked(tabId, save) {
  // THE BASE opens after ONE run, won or lost.
  //
  // It used to require CLEARING pond_1, which was a hard progression stop.
  // pond_1 is 250s with its guardian gated at 180s (Timmy's own "typ 3
  // minuter") and it forces a baseline reset, so meta upgrades do not help
  // there — a new player is very unlikely to clear it early. Meanwhile the base
  // is the ONLY thing that unlocks the rest of the camp, so failing it locked
  // the player out of Meta, Skill Tree and Talents indefinitely. Timmy, on a
  // fresh save: "man kan inte komma in i base den ska va de enda typ man kommer
  // in i för å bygga campet då låses 3 menyer upp".
  //
  // His intended shape: "de ska va 1 run … man ska ut å leta resurser inget mer
  // första updraget å man ska ändå få lite guld så man även om man dör" — go out
  // once, expect to die, come back with enough gold to raise the first building.
  // So the gate is "you have been out there", not "you won".
  // `runsCompleted` counts finished runs regardless of outcome, and clearing a
  // pond node still satisfies it, which keeps every older save open.
  if (tabId === 'base') return (save.runsCompleted || 0) < 1 && campUnlockStage(save) < 1;
  if (!CAMP_UNLOCK_BATCHES.some(b => b.tabs.includes(tabId))) return false;
  return !campTabsUnlockedAt(totalBuildingLevels(save)).has(tabId);
}
// The CAMPAIGN tab's own sub-tabs (STORY / MAPS / MISSIONS / CHALLENGES).
//
// Timmy, 2026-08-18: "de ska va bara 1 story misson på sidan... inget ska kunna
// starta endless den ska vi låsa upp senare." A brand-new player should see one
// thing to do, not a four-way choice between systems none of which are
// explained yet — and MAPS is the door to free play, so hiding it is also what
// closes off Endless until it is deliberately opened.
//
// Gated on the same building-level cascade everything else uses rather than a
// new counter, so there is one progression clock in the camp and not two that
// can disagree. Two levels = the player has been out twice and built twice.
export function isCampSubTabLocked(subId, save) {
  if (subId === 'campaign') return false;          // STORY is always the one door
  // MAPS is free-play node picking. The first hour is hall → build → gather
  // runs via CONTINUE STORY. MAPS (and Endless) wait on the hangar, which is
  // when the tutorial camp is a ship you can leave in.
  if (subId === 'maps') {
    if (buildingLevel(save, 'hangar') >= 1) return false;
    if (campUnlockStage(save) >= 3) return false;
    return true;
  }
  // Missions and Challenges are extra doors. They wait until the camp has
  // two modules so the first hour stays Story → Base → gather.
  return totalBuildingLevels(save) < 2;
}

// Endless is the FIGHT button. It opens with the hangar — that is when the
// tutorial (find wreck, insert AIDA, seal, build, gather) is a home with a
// ship, and the real game can start. Hull-only used to light Endless and
// skip the gather loop. Grandfather: anyone already past the Rain Pool's
// on-ramp (later maps / rank 3 via campUnlockStage) keeps the button.
export function isEndlessUnlocked(save) {
  if (buildingLevel(save, 'hangar') >= 1) return true;
  return campUnlockStage(save) >= 3;
}

/**
 * What CONTINUE STORY / GO GATHER / WALK THE HALL should do right now.
 *
 * The first hour is one thread, not a menu: hold the wreck → walk in →
 * insert AIDA → seal the hull → buy the next module if you can afford it,
 * otherwise go back out. `nextCampaignNode` still names the next fight;
 * this function decides whether that fight is allowed yet.
 */
export function storyBeat(save) {
  const node = nextCampaignNode(save);
  if (!node) {
    return { kind: 'done', kicker: 'STORY COMPLETE', label: 'The maps are yours.' };
  }
  // The wreck is the first-hour classroom. Once they have been out once
  // (win or lose), CONTINUE STORY is the hall socket — not another orbit
  // attempt. Dying on Sanctuary used to keep this on HOLD THE WRECK, so
  // the death screen said WALK THE HALL and the camp button sent them back
  // into the node.
  if (node.id === 'orbit_find' && (save.runsCompleted || 0) < 1) {
    return {
      kind: 'mission', node, why: 'approach',
      kicker: 'HOLD THE WRECK',
      label: `${node.mapName} — ${node.name}`,
    };
  }
  if (!isStationRepaired(save)) {
    return { kind: 'hall', why: 'insert', kicker: 'WALK THE HALL', label: 'Insert the A.I.D.A. core' };
  }
  if (buildingLevel(save, 'hull') < 1) {
    return { kind: 'hall', why: 'hull', kicker: 'SEAL THE HULL', label: 'Patch the holes. Then you can go back out.' };
  }
  const quest = getActiveBuildQuest(save);
  const short = cannotAffordStationQuest(save);
  if (quest) {
    if (short) {
      return {
        kind: 'mission', node, why: 'gather', short, quest,
        kicker: 'GO GATHER',
        label: `${node.mapName} — ${node.name}`,
      };
    }
    return { kind: 'hall', why: 'build', quest, kicker: 'WALK THE HALL', label: quest.title };
  }
  return {
    kind: 'mission', node, why: 'story',
    kicker: 'CONTINUE STORY',
    label: `${node.mapName} — ${node.name}`,
  };
}

// Start-menu "Go to Camp" stays dark until the player has actually been out
// (or already lives in the hall). Fresh saves must not dump into a furnished
// hub before the wreck run.
export function isCampUnlocked(save) {
  return (save.runsCompleted || 0) >= 1
    || isStationRepaired(save)
    || campUnlockStage(save) >= 1;
}

// The wreck and the Rain Pool are the first-hour classroom. `mission.isTutorial`
// is a retired flag — orbit_find / pond_* are campaign nodes, so the HUD used
// to never coach them. Named ids, not campUnlockStage, so a later pond retry
// still gets the hold-swing line and a Lake run does not.
const FIRST_HOUR_NODE_IDS = new Set(['orbit_find', 'pond_1', 'pond_2', 'pond_3']);

export function isFirstHourRun(mission) {
  if (!mission) return false;
  if (mission.isTutorial) return true;
  const id = mission.node?.id;
  return !!(id && FIRST_HOUR_NODE_IDS.has(id));
}

export function firstHourTips(mission) {
  const id = mission?.node?.id;
  if (id === 'orbit_find') {
    return [
      { at: 3,  text: 'HOLD attack to swing the girder. It chains 3–4 hits if you keep it down. Keep moving.' },
      { at: 22, text: 'XP orbs are cards. Every level is a choice — that is the build, not the camp.' },
      { at: 48, text: 'Gold goes home with you. Dying still pays. This wreck is the rent.' },
      { at: 80, text: 'Twelve kills. Two minutes. Then you walk the hall and plug the chip in.' },
    ];
  }
  if (id === 'pond_1' || id === 'pond_2' || id === 'pond_3' || mission?.isTutorial) {
    return [
      { at: 3,   text: 'HOLD to swing. Combos you land yourself make the hold-string hit harder. Never stand still.' },
      { at: 25,  text: 'XP orbs level you up and every level is a card. Cards are the build.' },
      { at: 55,  text: 'Gold is spent at CAMP between runs. When the stores are empty, CONTINUE STORY is a gather run.' },
      { at: 95,  text: 'Level 4 opens a second weapon slot. Every fourth level after that opens another.' },
      { at: 140, text: 'The guardian is stronger than you. Learn the pattern. Come back with the camp behind you.' },
    ];
  }
  return [];
}

// Death-screen door while the first hour is still a hall / gather loop.
// Returns null once CONTINUE STORY is a normal node — GameOver then uses its
// own how-far-you-got copy.
export function runDebrief(save) {
  const beat = storyBeat(save);
  if (!(beat.kind === 'hall' || beat.why === 'gather')) return null;
  const body = {
    insert: 'The chip in your gut wants the socket in the middle of the hall. Insert A.I.D.A. Then patch the hull.',
    hull: 'Walk to a breach. Patch it. Until the hull holds air, nothing else in this ring will take a bolt.',
    build: `${beat.label}. If you cannot pay, CONTINUE STORY is a gather run.`,
    gather: 'CONTINUE STORY is a gather run now. Hold the Rain Pool. Bring the coins back. Install the next piece.',
  }[beat.why] || beat.label;
  return {
    head: `▸ ${beat.kicker}`,
    body,
    campLabel: beat.kicker,
    lockRetry: beat.why === 'insert',
  };
}

export function campUnlockHint(tabId, save) {
  // Matches the gate above: one run out, win or lose.
  if (tabId === 'base') return 'Head out once to unlock';
  const batch = CAMP_UNLOCK_BATCHES.find(b => b.tabs.includes(tabId));
  if (!batch) return null;
  return `Build at the base to unlock`;
}

// The difficulty numbers a run should actually use, with the selected tier
// clamped to what the player has earned. Lives here rather than in
// difficulty.js because it needs the node list, and difficulty.js is
// deliberately free of the data layer (campaign.js already imports it, so
// putting the dependency the other way would be a cycle).
//
// Every site that decides combat or payout should go through this rather than
// reading save.difficulty directly.
export function resolvedDifficultyMods(save) {
  const ids = campaignNodes().map(n => n.id);
  return difficultyMods({ ...save, difficulty: resolveDifficulty(save, ids) });
}

export function resolvedRewardMult(save) {
  const ids = campaignNodes().map(n => n.id);
  return rewardMult({ ...save, difficulty: resolveDifficulty(save, ids) });
}

// Turns a campaign node into the `mission` object GameScreen already knows
// how to start a run with.
export function nodeToMission(node) {
  if (!node) return null;
  const noBoss = !!node.noBoss;
  return {
    id: node.id,
    name: `${node.mapName} — ${node.name}`,
    isCampaign: true,
    mapId: node.mapId,
    diff: node.diff,
    // Timed approach nodes end on the clock. Every other node ends when the
    // guardian dies — duration 999 keeps that path from ever firing.
    duration: noBoss ? (node.duration || 120) : 999,
    bossAt: noBoss ? 0 : bossGateTime(node),
    // A node can name its own guardian (pond_1's 'sludgeWarden' — a real
    // threat at a fresh-save baseline, not the shared bossOcular scaled for
    // a much later, geared-up fight) before falling back to the map's usual
    // boss.
    bossId: noBoss ? null : (node.bossId || MAP_BOSS[node.mapId] || 'bossOcular'),
    spawnMult: node.spawnMult || 1,
    enemyMix: node.enemyMix,
    noBoss,
    cannotDie: !!node.cannotDie,
    campExterior: !!node.campExterior,
    harderAfter: node.harderAfter || 0,
    harderMult: node.harderMult || 1,
    // If this node is where a companion is found, the run spawns them as a
    // defendable second body — see engine.js's rescueCompanion.
    companion: companionForNode(node.id),
    // pond_1's baseline-reset + forced katana start — see GameScreen.jsx's
    // `forceBaseline` handling and data_ext2.js's pond_1 comment.
    forceBaseline: !!node.forceBaseline,
    startWeapons: node.startWeapons || null,
    node,
  };
}
