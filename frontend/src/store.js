// Extended save store with profile, skills, equipment, quests, daily streak.
import axios from 'axios';
import { dailyQuests, accountXpToNext, weeklyQuests, weekIdx } from './game/data_ext';

const KEY = 'wds.save.v1';
const PID_KEY = 'wds.player_id';

export const DEFAULT_SAVE = {
  // legacy / core
  gold: 0,
  meta: {},
  runsCompleted: 0,
  bestRunTime: 0,
  bestKills: 0,
  bestScore: 0,
  totalKills: 0,
  introSeen: false,
  // NEW currencies
  gems: 0,        // 💎 for chests, pet eggs
  slotCoins: 0,   // 🎰 for card shop spins
  talentPoints: 0, // 🌿 for talent tree
  petFood: 0,     // 🍖 feed pets
  // profile
  profile: { name: '', avatar: 'drop', level: 1, xp: 0, frame: 'none', headband: 'none', nameColor: 'white', shipColor: 'teal', cigarOn: false },
  // skills
  sp: 0,
  skills: {}, // { skillId: level }
  // weapon parts
  weaponParts: {}, // { weaponId: { magazine: tier, sight: tier, barrel: tier, bullets: tier, rarity: tier } }
  // equipment
  inventory: [], // [{id, slot, name, rarity, level, stats}]
  equipped: {}, // { head, chest, boots, trinket }
  // artifacts (generic slots, not body-part typed — see game/artifacts.js)
  artifactInventory: [],
  artifactEquipped: {}, // { 0: artifactId, 1: artifactId, ... }
  gachaTokens: 0,
  // Star Raid minigame (permanent ship progression) — see game/starRaidEngine.js
  starRaid: { levels: {}, scrap: 0, stageUnlocked: 0 },
  // Elemental Rounds (Weaponsmith): { weaponId: [elementId, ...] }, cycles
  // shot-by-shot within the same magazine — see game/data_ext2.js ELEMENTS.
  weaponElements: {},
  // Runes — socketable into manual weapons + the ring/amulet gear slots.
  // See game/runes.js.
  runeInventory: [],
  gearRunes: {},   // { ring: runeId, amulet: runeId }
  weaponRunes: {}, // { weaponId: runeId }
  // daily
  daily: { lastClaim: 0, streak: 0 }, // unix day index
  quests: { day: 0, completed: {}, claimed: {} },
  // milestones
  milestones: { claimed: {} },
  // stats
  aidaSlain: 0,
  necroSlain: 0,
  voidSlain: 0,
  horusSlain: 0,
  endlessReached: 0,
  mapProgress: {},
  // level-up
  pendingLevelUp: null,
  freeShopSpins: 0,
  dailyChallengesDone: {},
  levelUpStreak: { day: 0, count: 0 },
  runStarts: 0,
  // tutorial
  tutorialDone: false,
  // character system
  character: { rarity: 'common', level: 0, pieces: 0, shards: 0 },
  charBonuses: {},
  // talent tree (now multi-level: { nodeId: levelCount })
  talent: {},
  talentBonuses: {},
  // unlocked weapons (from card shop)
  unlockedWeapons: [],
  // campaign quests
  campaign: {},
  // pets
  pets: [], // [{ id, type, rarity, level, xp, stage, active, name }]
  petEggs: [], // [{ rarity, type }] unhatched eggs
  // POE skill tree attributes
  attrs: {}, // { atk, dex, vit, mob, int, ele, mag } — points allocated
  // Gear system
  gearInventory: [], // [{ id, slot, rarity, stat, val, name }]
  gearEquipped:  {}, // { helmet: itemId, chest: itemId, ... }
  // Codex
  codex: { enemies: {}, weapons: {}, claimedDiscoveries: [] },
  // Battle Pass — 2 tracks (free + premium, both unlocked, no payment gate)
  battlePass: { claimed: { free: [], premium: [] } },
  // Weekly quests (separate from the existing daily `quests`)
  weeklyQuests: { week: 0, completed: {}, claimed: {} },
  // Daily lucky spin wheel (separate from the 7-day DAILY_REWARDS login streak)
  dailySpin: { day: 0, spun: false },
  // Patrol missions
  patrol: { missions: [] },
  missionEnergy: 0,
  // ---- Idle systems -------------------------------------------------------
  // Everything time-based settles through tickIdle() below, which is the one
  // place that decides how much time has passed. See docs/ROADMAP-modes.md.
  lastTickMs: 0,
  incubator: { slots: [] }, // [{ eggId, rarity, type, startMs, durMs, spentMs }]
  incubatorSlots: 2,        // grows with the Incubator building
  // New currencies (Astro Prospector). Kept to two on purpose — a currency
  // nobody can name is a currency that does nothing.
  cores: 0,
  flux: 0,

  // ---- Fields below were read (with `||` fallbacks) by various panels but
  // never actually declared here — added for documentation/consistency
  // during a code review pass; behavior is unchanged since every read site
  // already defended against them being undefined on a fresh save. ----
  equippedParts: {},   // { weaponId: { slot: partId } }
  equippedActives: [], // active-skill ids currently slotted (Loadout)
  parts: [],           // loose weapon-parts inventory
  settings: {},
  shopBonuses: {},
  blueprintShards: {}, // { weaponId: shardCount }
  craftedWeapons: [],
  milestoneBar: 0,
  achClaimed: {},      // { achievementId: true }
  challengesDone: {},
  chestsOpened: 0,
  legendaryPartsFound: 0,
  shopPulls: 0,
  noHitRuns: 0,
  unlockedActives: [], // ACTIVE_SKILLS ids unlocked via the card shop
  unlockedEvos: [],    // weapon ids with evolution unlocked
  lifetimeGold: 0,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const s = { ...DEFAULT_SAVE, ...JSON.parse(raw) };
    // merge defaults for new fields
    s.profile = { ...DEFAULT_SAVE.profile, ...(s.profile || {}) };
    s.daily = { ...DEFAULT_SAVE.daily, ...(s.daily || {}) };
    s.quests = { ...DEFAULT_SAVE.quests, ...(s.quests || {}) };
    s.milestones = { ...DEFAULT_SAVE.milestones, ...(s.milestones || {}) };
    s.skills = s.skills || {};
    s.weaponParts = s.weaponParts || {};
    s.inventory = s.inventory || [];
    s.equipped = s.equipped || {};
    s.mapProgress = s.mapProgress || {};
    s.levelUpStreak = { ...DEFAULT_SAVE.levelUpStreak, ...(s.levelUpStreak || {}) };
    s.character = { ...DEFAULT_SAVE.character, ...(s.character || {}) };
    s.charBonuses = s.charBonuses || {};
    s.talent = s.talent || {};
    s.talentBonuses = s.talentBonuses || {};
    s.unlockedWeapons = s.unlockedWeapons || [];
    s.campaign = s.campaign || {};
    s.gems = s.gems || 0;
    s.slotCoins = s.slotCoins || 0;
    s.talentPoints = s.talentPoints || 0;
    s.petFood = s.petFood || 0;
    s.pets = s.pets || [];
    s.petEggs = s.petEggs || [];
    if (s.tutorialDone === undefined) s.tutorialDone = false;
    // Battle Pass: migrate the old flat claimed-array shape to {free,premium}
    const bpClaimed = s.battlePass?.claimed;
    if (Array.isArray(bpClaimed)) s.battlePass = { claimed: { free: bpClaimed, premium: [] } };
    else s.battlePass = { ...(s.battlePass || {}), claimed: { free: [], premium: [], ...(bpClaimed || {}) } };
    s.weeklyQuests = { ...DEFAULT_SAVE.weeklyQuests, ...(s.weeklyQuests || {}) };
    s.dailySpin = { ...DEFAULT_SAVE.dailySpin, ...(s.dailySpin || {}) };
    s.incubator = { slots: [], ...(s.incubator || {}) };
    s.incubatorSlots = s.incubatorSlots || DEFAULT_SAVE.incubatorSlots;
    s.cores = s.cores || 0;
    s.flux = s.flux || 0;
    // A save written before idle systems existed has no lastTickMs. Seeding it
    // to "now" rather than 0 matters: an epoch-0 timestamp would look like
    // decades of offline time and immediately pay out the full 8h cap.
    if (!s.lastTickMs) s.lastTickMs = Date.now();
    // 'decoy' was retired in favour of 'steamvent'. Without this, an existing
    // save keeps a skill id the engine no longer knows: the slot renders as
    // "?" and pressing it silently does nothing.
    if (Array.isArray(s.equippedActives)) {
      s.equippedActives = s.equippedActives.map(id => (id === 'decoy' ? 'steamvent' : id));
    }
    if (s.unlockedActives && s.unlockedActives.decoy) {
      s.unlockedActives.steamvent = s.unlockedActives.decoy;
      delete s.unlockedActives.decoy;
    }
    if (s.skills && s.skills.sh_skill_decoy) {
      s.skills.sh_skill_steamvent = s.skills.sh_skill_decoy;
      delete s.skills.sh_skill_decoy;
    }
    return s;
  } catch { return { ...DEFAULT_SAVE }; }
}

// ---- Idle settling ---------------------------------------------------------
// One place decides how much time has passed, so every time-based system
// agrees. Called on load and on an interval while the app is open.
//
// Offline accrual is capped: uncapped idle income makes actually playing
// pointless, and it removes the payoff from setting the device clock forward.
// Elapsed time is also clamped at zero, because a clock moved BACKWARDS would
// otherwise hand out negative progress.
export const IDLE_CAP_MS = 8 * 60 * 60 * 1000;

export function idleElapsed(save, nowMs) {
  const last = save.lastTickMs || nowMs;
  return Math.max(0, Math.min(IDLE_CAP_MS, nowMs - last));
}

// Hatch durations by egg rarity. Ticks whether or not the game is open.
export const INCUBATOR_MS = {
  common: 15 * 60 * 1000,
  uncommon: 20 * 60 * 1000,
  rare: 30 * 60 * 1000,
  epic: 45 * 60 * 1000,
  legendary: 70 * 60 * 1000,
  mythical: 100 * 60 * 1000,
};

// Remaining incubation for a slot, in ms. `spentMs` is time bought with
// gold/gems, so speeding up and waiting are the same thing to this function.
export function incubatorRemaining(slot, nowMs) {
  if (!slot) return 0;
  const elapsed = (nowMs - (slot.startMs || nowMs)) + (slot.spentMs || 0);
  return Math.max(0, (slot.durMs || 0) - elapsed);
}

// Cost to finish a slot right now. Priced off remaining time, so a nearly-done
// egg is nearly free — the point is to skip a wait, not to buy the pet.
export function incubatorSpeedCost(slot, nowMs) {
  const remMin = incubatorRemaining(slot, nowMs) / 60000;
  if (remMin <= 0) return { gems: 0, gold: 0 };
  return {
    gems: Math.max(1, Math.ceil(remMin / 8)),
    gold: Math.max(50, Math.ceil(remMin) * 90),
  };
}

// Settles every idle system forward. Returns a NEW save when something
// changed, or the same reference when nothing did — so callers can safely
// `const ns = tickIdle(save, Date.now()); if (ns !== save) setSave(ns);`
// without causing a render loop.
export function tickIdle(save, nowMs = Date.now()) {
  const now = nowMs;
  let changed = false;
  let s = save;
  const touch = () => { if (!changed) { s = { ...save }; changed = true; } return s; };

  // Patrol missions are already stored with absolute start/duration, so they
  // settle simply by being re-evaluated against `now`.
  const missions = save.patrol?.missions || [];
  if (missions.some(m => m.status === 'active' && now - m.startMs >= m.durationMs)) {
    const ns = touch();
    ns.patrol = {
      ...save.patrol,
      missions: missions.map(m =>
        (m.status === 'active' && now - m.startMs >= m.durationMs) ? { ...m, status: 'complete' } : m),
    };
  }

  // Incubator slots mark themselves ready; the actual hatch is a deliberate
  // player action (the three-tap crack), not something that happens while
  // you are not looking.
  const slots = save.incubator?.slots || [];
  if (slots.some(sl => !sl.ready && incubatorRemaining(sl, now) <= 0)) {
    const ns = touch();
    ns.incubator = {
      ...save.incubator,
      slots: slots.map(sl => (!sl.ready && incubatorRemaining(sl, now) <= 0 ? { ...sl, ready: true } : sl)),
    };
  }

  if (changed || !save.lastTickMs) {
    const ns = touch();
    ns.lastTickMs = now;
  }
  return s;
}

export function saveLocal(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
}

export function getPlayerId() {
  let id = localStorage.getItem(PID_KEY);
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(PID_KEY, id);
  }
  return id;
}

const BASE = process.env.REACT_APP_BACKEND_URL;

export async function syncSave(data) {
  if (!BASE) return;
  try { await axios.post(`${BASE}/api/save`, { player_id: getPlayerId(), data }); }
  catch (e) { /* offline ok */ }
}

export async function postRunResult(result) {
  if (!BASE) return;
  try { await axios.post(`${BASE}/api/run-result`, { player_id: getPlayerId(), ...result }); }
  catch (e) { /* offline ok */ }
}

// ---------- helpers ----------
export function todayIdx() { return Math.floor(Date.now() / 86400000); }

export function ensureDailyQuests(save) {
  const day = todayIdx();
  if (save.quests.day !== day) {
    save.quests = { day, completed: {}, claimed: {} };
  }
  return dailyQuests(day);
}

export function ensureWeeklyQuests(save) {
  const week = weekIdx();
  if (save.weeklyQuests.week !== week) {
    save.weeklyQuests = { week, completed: {}, claimed: {} };
  }
  return weeklyQuests(week);
}

export function addAccountXp(save, amount) {
  const prevLevel = save.profile.level;
  save.profile.xp += amount;
  while (save.profile.xp >= accountXpToNext(save.profile.level)) {
    save.profile.xp -= accountXpToNext(save.profile.level);
    save.profile.level += 1;
  }
  if (save.profile.level > prevLevel) {
    const lv = save.profile.level;
    const today = Math.floor(Date.now() / 86400000);
    const ls = { ...(save.levelUpStreak || { day: 0, count: 0 }) };
    if (ls.day === today) { ls.count += 1; } else { ls.day = today; ls.count = 1; }
    save.levelUpStreak = ls;
    const mult = ls.count >= 3 ? 2 : 1;
    // Slot coins at milestones: every 5 levels = 1, every 10 = 2
    const slotBonus = (lv % 10 === 0) ? 2 : (lv % 5 === 0) ? 1 : 0;
    // Gems: 1 per level, bonus at 10
    const gemsBonus = Math.floor(lv / 10) + 1;
    save.pendingLevelUp = {
      level: lv,
      gold: (100 + lv * 40) * mult,
      sp: Math.max(1, Math.floor(lv / 3)) * mult,
      talentPoints: 2 * mult,
      gems: gemsBonus * mult,
      slotCoins: slotBonus,
      freeSpin: lv % 10 === 0,
      streakBonus: ls.count >= 3,
      streakCount: ls.count,
      pieces: Math.floor((5 + lv * 2) * mult),
      shards: lv % 5 === 0 ? Math.ceil(3 * mult) : 0,
    };
  }
}

// Apply a reward IN-PLACE on a save object (caller should pass a fresh copy).
// Note: chest rewards are NOT auto-opened here to avoid circular deps.
// Caller should pass an `openChest(chestId, save)` resolver if needed, or read
// _pendingChest and handle it. The Welcome screen handles chest rewards by
// calling rollChest separately.
export function applyReward(save, reward, openChest) {
  if (!reward) return;
  if (reward.gold)      save.gold      = (save.gold      || 0) + reward.gold;
  if (reward.sp)        save.sp        = (save.sp        || 0) + reward.sp;
  if (reward.gems)      save.gems      = (save.gems      || 0) + reward.gems;
  if (reward.slotCoins) save.slotCoins = (save.slotCoins || 0) + reward.slotCoins;
  if (reward.petFood)   save.petFood   = (save.petFood   || 0) + reward.petFood;
  if (reward.type === 'gold')  save.gold      = (save.gold      || 0) + reward.amount;
  if (reward.type === 'sp')    save.sp        = (save.sp        || 0) + reward.amount;
  if (reward.type === 'gems')  save.gems      = (save.gems      || 0) + reward.amount;
  if (reward.type === 'chest' && reward.chestId && openChest) {
    const drops = openChest(reward.chestId);
    if (drops && drops.length) save.inventory = [...(save.inventory || []), ...drops];
  }
}
