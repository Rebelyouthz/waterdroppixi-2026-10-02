// =============================================
// THE GUIDED CHAIN — two tracks, one open step each
// =============================================
// The complaint this answers is the oldest one about this game: there is an
// enormous amount here and no thread through it. You finish a run, you land in
// a camp with nineteen tabs, and nothing tells you which one matters yet.
//
// So: two ordered tracks, and exactly ONE open step in each at any moment.
//
//   STORY  — what to do out there. Storyline nodes, guardians, run milestones.
//   CAMP   — what to do in here. Every system in the game, once, in the order
//            its dependencies allow.
//
// Running two tracks rather than one long list is deliberate. A single list
// forces an ordering between "clear the second map" and "socket a rune", and
// there isn't one — they are different kinds of thing done in different
// places, and a player waiting on a hard node should still have a camp step to
// make progress on. Two tracks means there is always something to do that is
// not the thing you are stuck on.
//
// Rules the chain follows:
//
// 1. **A step names one action and one place.** `goal` is imperative and
//    checkable; `go` is a real destination the camp can open. A step that
//    cannot say where to go is not a step.
//
// 2. **Teaching is in `why`, not in a popup.** One line, said once, explaining
//    why the system exists — not how to click it. The player is looking at
//    the UI already.
//
// 3. **Every camp step is satisfied by USING a system, never by owning it.**
//    Owning a building you never opened teaches nothing. (Inherited from
//    path.js, which this chain grew out of and now supersedes as the primary
//    guide — The Path panel remains as the browsable, claim-at-your-own-pace
//    view of the same idea.)
//
// 4. **The chain is a tutorial exactly once.** After the last camp step there
//    is nothing left to teach, and the track ends rather than turning into a
//    chore list.

import { MAP_STAGES } from './data_ext2';
import { DASH_NODE_ID } from './poe_tree';
import { buildingLevel, isStationRepaired } from './base';

const any = (o) => Object.keys(o || {}).length > 0;
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0);
const mapCleared = (s, mapId) => {
  const m = MAP_STAGES.find(x => x.id === mapId);
  const prog = s.mapProgress || {};
  return !!m && m.nodes.every(n => prog[n.id]);
};

// ---------------------------------------------------------------------------
// STORY TRACK
// ---------------------------------------------------------------------------
// Paced against the retuned difficulty curve: the first node is expected to
// take three to five attempts, so `s_survive` and `s_level5` sit BEFORE it and
// pay out on the failed attempts. Losing a run you were always going to lose
// still moves the chain, which is the difference between "hard" and
// "punishing".

export const STORY_QUESTS = [
  {
    id: 's_first_run', icon: 'ui_waterdrop', go: 'story',
    title: 'Into the water',
    goal: 'Finish one run — win or lose',
    why: 'Everything in the camp is paid for by what you carry out of a run. Dying still pays.',
    check: (s) => (s.runsCompleted || 0) >= 1,
    rwd: { gold: 300, gearParts: 8 },
  },
  {
    id: 's_insert', icon: 'ui_codex', go: 'base',
    title: 'Wake the wreck',
    goal: 'Walk the hall and insert the A.I.D.A. core',
    why: 'The chip wants the socket. She turns the lights on. Everything else in this ring waits on that.',
    check: (s) => isStationRepaired(s),
    rwd: { gold: 250, gearParts: 6 },
  },
  {
    id: 's_hull', icon: 'ui_base', go: 'base',
    title: 'Seal the hull',
    goal: 'Patch The Hull so the station holds air',
    why: 'Skills, talents and meta stay dusty until the first bolt. If you cannot pay, CONTINUE STORY is a gather run.',
    check: (s) => buildingLevel(s, 'hull') >= 1,
    rwd: { gold: 400, gearParts: 10 },
  },
  {
    id: 's_dash', icon: 'pQuick', go: 'skills',
    title: 'Unlock Shadow Dash',
    goal: 'Open the Skill Tree and buy the three teal Mobility nodes until Shadow Dash is yours',
    why: 'SHIFT on PC, swipe the left stick on phone. I-frames through a pack. The rest of the wheel waits until you can duck.',
    check: (s) => ((s.skills || {})[DASH_NODE_ID] || 0) >= 1,
    rwd: { gold: 250, sp: 2 },
  },
  {
    id: 's_survive', icon: 'ui_clock', go: 'story',
    title: 'Hold the line',
    goal: 'Survive 2 minutes in a single run',
    why: 'The opening minutes are the hardest part of the game. Everything after this you out-build.',
    check: (s) => (s.bestRunTime || 0) >= 120,
    rwd: { gold: 400, gearParts: 12 },
  },
  {
    id: 's_level5', icon: 'ui_star', go: 'story',
    title: 'Grow teeth',
    goal: 'Reach level 5 inside one run',
    why: 'Run levels are the only power that matters while you are out there — and every fourth one opens a weapon slot.',
    check: (s) => (s.bestLevel || 0) >= 5,
    rwd: { gold: 500, sp: 1 },
  },
  // Placed after 'grow teeth' and before the first node: late enough that the
  // player has felt how the pistol handles, early enough that being made to
  // drop it for a run is still a lesson rather than an interruption. The
  // katana is unlocked from the start (STARTER_WEAPONS), so this asks the
  // player to CHOOSE it rather than granting anything.
  {
    // Points at the blueprint shelf specifically, not at the smith's front
    // door — that is where the START WEAPONS selector lives, and this quest is
    // the reason a player first needs it.
    id: 's_katana', icon: 'katana', go: 'smithBlueprints',
    title: 'Put the gun down',
    goal: 'Finish one run carrying the Snapped Rib',
    why: 'Shooting is not the only answer, and the rib is the only thing you own that cuts a body clean in half. Weaponsmith → BLUEPRINTS → CARRY THIS. If you hate it, never again.',
    check: (s) => (s.katanaRuns || 0) >= 1,
    rwd: { gold: 600, gearParts: 16 },
  },
  {
    id: 's_node1', icon: 'ui_scroll', go: 'story',
    title: 'The Shallows',
    goal: 'Clear the first storyline node',
    why: 'A node ends on its guardian, not on a clock. That is the shape of every node after it.',
    // Points at the FIRST node of the campaign, which is now pond_1 (The Rain
    // Pool was added in front of The Lake as an onramp). Left on lake_1 this
    // quest would have asked a brand-new player to clear what is now the
    // fourth node.
    check: (s) => !!(s.mapProgress || {}).pond_1,
    rwd: { gold: 700, gearParts: 20, gems: 2 },
  },
  {
    id: 's_kills', icon: 'ui_blade', go: 'story',
    title: 'Thin them out',
    goal: 'Reach 500 total kills',
    why: 'Kill count is what the Codex, the badges and half the quests all read from.',
    check: (s) => (s.totalKills || 0) >= 500,
    rwd: { gold: 800, gearParts: 24 },
  },
  {
    id: 's_node2', icon: 'pWave', go: 'story',
    title: 'The Undertow',
    goal: 'Clear the second storyline node',
    why: 'This one expects the gear the first one paid for. If it feels impossible, it is telling you to go spend.',
    check: (s) => !!(s.mapProgress || {}).lake_2,
    rwd: { gold: 1100, gearParts: 30, gems: 3 },
  },
  {
    id: 's_horus', icon: 'ui_eye', go: 'story',
    title: 'Close the Eye',
    goal: 'Defeat the Eye of Horus',
    why: 'Every guardian drops something no other source gives. Horus pays in artifacts.',
    check: (s) => (s.horusSlain || 0) >= 1,
    rwd: { gold: 1400, sp: 2, gems: 4 },
  },
  {
    id: 's_map1', icon: 'ui_trophy', go: 'story',
    title: 'The Lake is yours',
    goal: 'Clear every node of The Lake',
    why: 'One map down. The next one unlocks on kills, not on permission.',
    check: (s) => mapCleared(s, 'lake'),
    rwd: { gold: 2000, sp: 3, gems: 6, gearParts: 40 },
  },
  {
    id: 's_level10', icon: 'ui_star', go: 'story',
    title: 'Deep enough to matter',
    goal: 'Reach level 10 inside one run',
    why: 'Level 10 is where a build stops being a pile of cards and starts being a plan.',
    check: (s) => (s.bestLevel || 0) >= 10,
    rwd: { gold: 1200, sp: 2 },
  },
  {
    id: 's_map2', icon: 'ui_base', go: 'story',
    title: 'The Sunken Ruins',
    goal: 'Clear every node of the Sunken Ruins',
    why: 'Ranged enemies change how you move. The Ruins is where kiting stops being optional.',
    check: (s) => mapCleared(s, 'ruins'),
    rwd: { gold: 3000, sp: 4, gems: 8, gearParts: 55 },
  },
  {
    id: 's_necro', icon: 'ui_void', go: 'story',
    title: 'Bone Collector',
    goal: 'Defeat the Necromancer',
    why: 'The Necromancer hands you a rare pet egg. Nothing else in the game does.',
    check: (s) => (s.necroSlain || 0) >= 1,
    rwd: { gold: 2200, sp: 3, petFood: 6 },
  },
  {
    id: 's_endless', icon: 'ui_infinity', go: 'story',
    title: 'Past the edge',
    goal: 'Reach Endless mode in a run',
    why: 'Endless is where the leaderboard lives. The curve there accelerates — it is meant to end.',
    check: (s) => (s.endlessReached || 0) >= 1,
    rwd: { gold: 2500, gems: 10, sp: 4 },
  },
  {
    id: 's_map3', icon: 'ui_void', go: 'story',
    title: 'The Void Lab',
    goal: 'Clear every node of the Void Lab',
    why: "A.I.D.A.'s old workshop. You were not her first attempt.",
    check: (s) => mapCleared(s, 'void'),
    rwd: { gold: 4200, sp: 6, gems: 10, gearParts: 70 },
  },
  {
    id: 's_void', icon: 'tornado', go: 'story',
    title: 'Titan Crusher',
    goal: 'Defeat the Void Titan',
    why: 'The Titan pays in Gacha Tokens — the only currency the Artifact machine takes.',
    check: (s) => (s.voidSlain || 0) >= 1,
    rwd: { gold: 3200, sp: 5, gachaTokens: 2 },
  },
  {
    id: 's_map4', icon: 'ui_void', go: 'story',
    title: 'The Annunaki Ship',
    goal: 'Clear every node of the Annunaki Ship',
    why: 'The ship is where the story was always going. A.I.D.A. is at the end of it.',
    check: (s) => mapCleared(s, 'ship'),
    rwd: { gold: 6000, sp: 8, gems: 14, gearParts: 90 },
  },
  {
    id: 's_aida', icon: 'gbCrown', go: 'story',
    title: 'The Reckoning',
    goal: 'Defeat A.I.D.A.',
    why: 'For a moment the Lake is quiet. It does not last.',
    check: (s) => (s.aidaSlain || 0) >= 1,
    rwd: { gold: 8000, sp: 10, gems: 20, gachaTokens: 3 },
  },
  {
    id: 's_map5', icon: 'staticField', go: 'story',
    title: 'The Drowned Sky',
    goal: 'Clear every node of the Drowned Sky',
    why: 'Storm-wracked and swarming. Bring area damage or bring speed.',
    check: (s) => mapCleared(s, 'sky'),
    rwd: { gold: 8000, sp: 10, gems: 16, gearParts: 110 },
  },
  {
    id: 's_map6', icon: 'tornado', go: 'story',
    title: 'The Deep Current',
    goal: 'Clear every node of the Deep Current',
    why: 'The void she opened never closed. This is the last thing in it.',
    check: (s) => mapCleared(s, 'deepcurrent'),
    rwd: { gold: 12000, sp: 14, gems: 24, gearParts: 150 },
  },
  {
    id: 's_normal_done', icon: 'ui_flame', go: 'story',
    title: 'Again, harder',
    goal: 'Clear the whole story on Normal — this opens Hard',
    why: 'Hard is not a slider. It is the same story built for the character Normal made you.',
    check: (s) => !!(s.diffCleared || {}).normal,
    rwd: { gold: 15000, sp: 20, gems: 30, gearParts: 200 },
  },
  {
    id: 's_hard_done', icon: 'ui_void', go: 'story',
    title: 'Against the current',
    goal: 'Clear the whole story on Hard — this opens Nightmare',
    why: 'Everything from here is a test of the build, not of the reflexes.',
    check: (s) => !!(s.diffCleared || {}).hard,
    rwd: { gold: 40000, sp: 40, gems: 60, gearParts: 400 },
  },
  {
    id: 's_nightmare_done', icon: 'ui_void', go: 'story',
    title: 'Nothing held back',
    goal: 'Clear the whole story on Nightmare',
    why: 'There is nothing above this. The Lake is yours.',
    check: (s) => !!(s.diffCleared || {}).nightmare,
    rwd: { gold: 120000, sp: 100, gems: 150, gearParts: 900 },
  },
];

// ---------------------------------------------------------------------------
// CAMP TRACK
// ---------------------------------------------------------------------------
// Ordered by dependency, not by payout: the thing you need in order to
// understand the next thing comes first. Attributes before meta because
// attributes are free and immediate; gear before gear levelling; the base
// before the four systems it houses.

export const CAMP_QUESTS = [
  {
    id: 'c_awaken', icon: 'ui_codex', go: 'base',
    title: 'Plug her in',
    goal: 'Insert A.I.D.A. into the hall socket',
    why: 'The camp is a dark ring until she is in. You walk there. You do not pick her from a list.',
    check: (s) => isStationRepaired(s),
    rwd: { gold: 200, gearParts: 4 },
  },
  {
    id: 'c_hull', icon: 'ui_base', go: 'base',
    title: 'Hold air',
    goal: 'Buy The Hull — the first building',
    why: 'That purchase is what opens Skills, Talents and Meta. Gold you cannot spend yet is a gather run, not a wall.',
    check: (s) => buildingLevel(s, 'hull') >= 1,
    rwd: { gold: 350, gearParts: 8 },
  },
  {
    id: 'c_attr', icon: 'ui_bolt', go: 'attrs',
    title: 'Spend a point',
    goal: 'Put one attribute point somewhere',
    why: 'You get one every profile level and they are permanent. There is no reason to sit on them.',
    check: (s) => sum(s.attrs) >= 1,
    rwd: { gold: 200 },
  },
  {
    id: 'c_meta', icon: 'ui_gem', go: 'meta',
    title: 'Buy something permanent',
    goal: 'Purchase one Meta upgrade',
    why: 'Meta increments are deliberately tiny. They are the floor under every run, not the build.',
    check: (s) => sum(s.meta) >= 1,
    rwd: { gold: 250, gearParts: 6 },
  },
  {
    id: 'c_gear', icon: 'gear_helmet', go: 'gear',
    title: 'Wear something',
    goal: 'Equip one piece of gear',
    why: 'Gear is the only stat source that is never spent — it stays on you between runs.',
    check: (s) => any(s.gearEquipped),
    rwd: { gold: 300, gearParts: 12 },
  },
  {
    id: 'c_gearlvl', icon: 'catStatBoost', go: 'gear',
    title: 'Level that piece',
    goal: 'Take one piece of gear to level 3',
    why: 'Gear starts weak on purpose. Levels are where it earns the slot — and rarity only opens at 10.',
    check: (s) => (s.gearInventory || []).some(g => (g?.level || 1) >= 3),
    rwd: { gold: 400, gearParts: 18 },
  },
  {
    id: 'c_skill', icon: 'ui_skills', go: 'skills',
    title: 'Learn something',
    goal: 'Buy three nodes in the Skill tree',
    why: 'The rest of the wheel is yours after dash. Combat, Defense, the others — spend what is left.',
    check: (s) => sum(s.skills) >= 3,
    rwd: { gold: 350, sp: 1 },
  },
  {
    id: 'c_talent', icon: 'ui_leaf', go: 'talents',
    title: 'Put down roots',
    goal: 'Buy 5 talents',
    why: 'Each talent is one behaviour change, bought once — not 300 percentage ticks. Climb up from the bottom.',
    check: (s) => Object.keys(s.talent || {}).length >= 5,
    rwd: { gold: 450, talentPoints: 6 },
  },
  {
    id: 'c_char', icon: 'ui_character', go: 'character',
    title: 'Level the character',
    goal: 'Level your character once',
    why: 'Character level opens weapon and skill slots. It is the single biggest lever on how a run plays.',
    check: (s) => (s.character?.level || 0) >= 1,
    rwd: { gold: 500, gearParts: 15 },
  },
  {
    id: 'c_loadout', icon: 'ui_loadout', go: 'loadout',
    title: 'Slot an active',
    goal: 'Equip one active skill',
    why: 'Actives are the only button you press deliberately in a run. Everything else fires itself.',
    check: (s) => (s.equippedActives || []).filter(Boolean).length >= 1,
    rwd: { gold: 400 },
  },
  {
    id: 'c_smith', icon: 'ui_smith', go: 'smith',
    title: 'Tune a weapon',
    goal: 'Buy one tuning tier at the Weaponsmith',
    why: 'The Weaponsmith improves ONE weapon rather than all of them — it is where a favourite becomes a build.',
    check: (s) => Object.values(s.weaponParts || {}).some(any),
    rwd: { gold: 500, gearParts: 14 },
  },
  {
    id: 'c_attach', icon: 'ui_part', go: 'smith',
    title: 'Bolt something on',
    goal: 'Socket one attachment',
    why: 'Every attachment is a trade, and every one of them is visible on the gun in your hands.',
    check: (s) => Object.values(s.weaponAttach || {}).some(any),
    rwd: { gold: 550, gearParts: 16 },
  },
  {
    id: 'c_rune', icon: 'rune', go: 'smith',
    title: 'Set a rune',
    goal: 'Socket one rune',
    why: 'Runes are the one slot that changes behaviour instead of numbers.',
    check: (s) => any(s.weaponRunes) || any(s.gearRunes),
    rwd: { gold: 600, gems: 2 },
  },
  {
    id: 'c_shop', icon: 'cur_slot', go: 'shop',
    title: 'Pull the lever',
    goal: 'Do one Card Shop pull',
    why: 'The Card Shop is where new weapons and cards enter the run pool. Slot coins are its only currency.',
    check: (s) => (s.shopPulls || 0) >= 1,
    rwd: { gold: 450, slotCoins: 2 },
  },
  {
    id: 'c_chest', icon: 'ui_chest', go: 'chests',
    title: 'Crack one open',
    goal: 'Open a chest',
    why: 'Chests are the fastest route to equipment you have not seen yet.',
    check: (s) => (s.chestsOpened || 0) >= 1,
    rwd: { gold: 400, gems: 2 },
  },
  {
    id: 'c_artifact', icon: 'ui_orb', go: 'gear',
    title: 'Bind an artifact',
    goal: 'Equip one artifact',
    why: 'Three artifact slots, no body-part restriction. They are the biggest single stat swing outside gear.',
    check: (s) => any(s.artifactEquipped),
    rwd: { gold: 700, gachaTokens: 1 },
  },
  {
    id: 'c_base', icon: 'ui_base', go: 'base',
    title: 'Raise a second module',
    goal: 'Build something after The Hull',
    why: 'The Hull opened the ring. The next bolt is a system — Hangar, Well, Bio Lab — not another stat.',
    check: (s) => sum(s.base) >= 2,
    rwd: { gold: 800, gearParts: 22 },
  },
  {
    id: 'c_well', icon: 'tornado', go: 'clicker',
    title: 'Sink The Well',
    goal: 'Draw 500 drops from The Well',
    why: 'The Well runs while you are gone. It is the only system that pays for time you did not spend.',
    check: (s) => ((s.clicker || {}).total || 0) >= 500,
    rwd: { gold: 650, gearParts: 20 },
  },
  {
    id: 'c_incubator', icon: 'ui_egg', go: 'pets',
    title: 'Warm an egg',
    goal: 'Hatch one pet',
    why: 'A pet grows through four stages and every one of them is a real multiplier, not a label.',
    check: (s) => (s.pets || []).length >= 1,
    rwd: { gold: 700, petFood: 8 },
  },
  {
    id: 'c_petlvl', icon: 'ui_pets', go: 'pets',
    title: 'Feed it',
    goal: 'Take a pet to level 5',
    why: 'An unfed pet is a cosmetic. A fed one is a second set of stats.',
    check: (s) => (s.pets || []).some(p => (p?.level || 0) >= 5),
    rwd: { gold: 800, petFood: 12 },
  },
  {
    id: 'c_tcg', icon: 'ui_cards', go: 'tcg',
    title: 'Build a deck',
    goal: 'Put 5 cards into one pet deck',
    why: 'Pet cards are how a patrol encounter is fought. A pet with no deck loses by default.',
    check: (s) => Object.values(s.tcgDecks || {}).some(d => (d || []).length >= 5),
    rwd: { gold: 900, gems: 3 },
  },
  {
    id: 'c_patrol', icon: 'ui_map', go: 'patrol',
    title: 'Send them out',
    goal: 'Run one patrol to completion',
    why: 'Patrols are how attachments, runes and food arrive without you playing for them.',
    check: (s) => (s.patrol?.missions || []).some(m => m.status === 'complete' || m.status === 'claimed'),
    rwd: { gold: 750, gearParts: 24 },
  },
  {
    id: 'c_forge', icon: 'ui_flame', go: 'gear',
    title: 'Risk a merge',
    goal: 'Attempt one Forge merge',
    why: 'Three of a kind become one better one — or two of them are gone. Flux is what buys down the risk.',
    check: (s) => (s.pathMerges || 0) >= 1,
    rwd: { gold: 850, flux: 2 },
  },
  {
    id: 'c_defence', icon: 'ui_shield', go: 'defence',
    title: 'Hold the line',
    goal: 'Survive 3 waves of Base Defence',
    why: 'Base Defence does not pay into itself — what you win there is a buff on your NEXT run.',
    check: (s) => (s.defenceBest || 0) >= 3,
    rwd: { gold: 900, gearParts: 28 },
  },
  {
    id: 'c_starraid', icon: 'ui_rocket', go: 'starraid',
    title: 'Fly a raid',
    goal: 'Finish one Star Raid stage',
    why: 'Star Raid is a different game on the same account — its scrap and artifacts come back here.',
    check: (s) => ((s.starRaid || {}).stageUnlocked || 0) >= 1,
    rwd: { gold: 950, gems: 4 },
  },
  {
    id: 'c_prospect', icon: 'ui_pickaxe', go: 'prospect',
    title: 'Go down, come back up',
    goal: 'Bank a Lootmine dive with at least one Core',
    why: 'Pure push-your-luck. Every layer deeper is worth more and likelier to take all of it.',
    check: (s) => (s.cores || 0) >= 1 || (s.prospectBlueprints || 0) >= 1,
    rwd: { gold: 900, flux: 3 },
  },
  {
    id: 'c_daily', icon: 'ui_calendar', go: 'daily',
    title: 'Claim a daily',
    goal: 'Claim one daily quest reward',
    why: 'Dailies reset every day and are the steadiest slot-coin income in the game.',
    check: (s) => any(s.quests?.claimed),
    rwd: { gold: 500, slotCoins: 2 },
  },
  {
    id: 'c_pass', icon: 'ui_medal', go: 'pass',
    title: 'Take a tier',
    goal: 'Claim one Season Pass reward',
    why: 'The pass tracks profile XP, which every run feeds whether you cleared anything or not.',
    check: (s) => ((s.battlePass?.claimed?.free || []).length + (s.battlePass?.claimed?.premium || []).length) >= 1,
    rwd: { gold: 700, gems: 3 },
  },
  {
    id: 'c_badge', icon: 'ui_medal', go: 'profile',
    title: 'Wear a badge',
    goal: 'Equip a badge to your profile',
    why: 'Three slots, carved into the frame. It is the only thing on your profile you chose rather than earned by accident.',
    check: (s) => (s.profile?.badges || []).some(Boolean),
    rwd: { gold: 600, gems: 3 },
  },
];

export const QUEST_TRACKS = [
  { id: 'story', name: 'STORYLINE', icon: 'ui_scroll', color: '#ffd166', steps: STORY_QUESTS },
  { id: 'camp',  name: 'CAMP',      icon: 'ui_base', color: '#4dffd4', steps: CAMP_QUESTS },
];

export const QUEST_INDEX = [...STORY_QUESTS, ...CAMP_QUESTS]
  .reduce((m, q) => { m[q.id] = q; return m; }, {});

// The open step of a track: the first one not yet PAID OUT. Note this is
// payout order, not check order — a step whose condition is already satisfied
// still has to be collected, so nothing is ever skipped silently and the
// player always sees what they just earned.
export function currentQuest(save, trackId) {
  const done = save.questsDone || {};
  const track = QUEST_TRACKS.find(t => t.id === trackId);
  if (!track) return null;
  return track.steps.find(q => !done[q.id]) || null;
}

// Both open steps, in display order, with their completion state resolved.
// This is what the tracker bar renders — it needs to know a step is DONE but
// not yet collected, because that is the state that draws the strike-through
// and the tick before the next step slides in.
export function activeQuests(save) {
  const out = [];
  for (const t of QUEST_TRACKS) {
    const q = currentQuest(save, t.id);
    if (!q) continue;
    let ready = false;
    try { ready = !!q.check(save); } catch { ready = false; }
    out.push({ ...q, track: t.id, trackName: t.name, trackColor: t.color, ready });
  }
  return out;
}

export function questProgress(save) {
  const done = save.questsDone || {};
  const all = STORY_QUESTS.length + CAMP_QUESTS.length;
  const n = Object.keys(done).filter(id => QUEST_INDEX[id]).length;
  return { done: n, total: all };
}

// Every quest whose condition is true but which has not been paid out yet.
// The caller (App.js / Camp) applies the rewards, banks a reward-screen entry
// and marks them done — this only answers "what just completed", so the same
// function serves the tracker bar, the camp entry screen and the toast host
// without any of them owning the payout rule.
export function completedUnpaid(save) {
  const done = save.questsDone || {};
  const out = [];
  for (const t of QUEST_TRACKS) {
    // Only the OPEN step of each track can complete — a later step being
    // incidentally true does not skip the ones before it. That is what keeps
    // the chain a chain instead of a checklist that empties itself.
    const q = t.steps.find(x => !done[x.id]);
    if (!q) continue;
    let ok = false;
    try { ok = !!q.check(save); } catch { ok = false; }
    if (ok) out.push({ ...q, track: t.id });
  }
  return out;
}
