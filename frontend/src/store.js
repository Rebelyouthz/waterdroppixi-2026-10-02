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
  bestKills: 0,   // historical misnomer: stores the best run LEVEL, not kills
  bestLevel: 0,   // best run level, under a name that says so
  bestScore: 0,
  bestLeaderboardRank: 0, // best global placement seen, 1 = first
  totalKills: 0,
  introSeen: false,
  // NEW currencies
  gems: 0,        // 💎 for chests, pet eggs
  slotCoins: 0,   // 🎰 for card shop spins
  talentPoints: 0, // 🌿 for talent tree
  petFood: 0,     // 🍖 feed pets
  // profile. `badges` is the 3 equipped badge ids (see game/badges.js) —
  // fixed-length so the three carved slots in the camp frame always render,
  // with null meaning "empty slot" rather than the array simply being short.
  profile: { name: '', avatar: 'drop', level: 1, xp: 0, frame: 'none', headband: 'none', nameColor: 'white', shipColor: 'teal', cigarOn: false, badges: [null, null, null] },
  // Badges earned (see game/badges.js). `badgesEarned` is the award ledger;
  // profile.badges is only what is currently on display.
  badgesEarned: {},   // { badgeId: earnedAtMs }
  badgesTouched: false, // player has arranged their own slots — stop auto-filling
  // ---- Difficulty (see game/difficulty.js) --------------------------------
  // Normal is the only tier that exists on a fresh save. `mapProgress` stays
  // the Normal ledger for backwards compatibility; hard/nightmare live in
  // mapProgressByDiff so no existing campaign is lost.
  difficulty: 'normal',
  mapProgressByDiff: {},   // { hard: { nodeId: true }, nightmare: {...} }
  diffCleared: {},         // { normal: true, hard: true } — tier fully finished
  // Rewards banked while away from Camp, shown on the next camp entry.
  pendingRewards: [],      // [{ icon, title, text, items: [{type, amount}] }]
  // Guided quest chain (see game/storyQuests.js). Two tracks run at once.
  questsDone: {},          // { questId: true }  — chain steps already paid out
  questSeen: {},           // { questId: true }  — "new step" toast already shown
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
  // Probe Keys gate Lootmine dives -- one key per launch. Without a cost the
  // mine was infinite free income. Earned from run rewards, rank-ups and
  // milestones; also trickles back slowly so a player can never be hard-locked
  // out of the mode with zero keys and no way to get one (see tickIdle).
  probeKeys: 3,
  probeKeyAt: 0,   // ms timestamp the regen clock last paid out
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
  // Waterdrop Clicker. `drops` is spendable inside the clicker only; `total`
  // is lifetime production, which is what the milestone ladder pays against.
  clicker: { drops: 0, total: 0, buildings: {}, clickLvl: 0, claimed: {}, lastMs: 0, springs: 0, prestiges: 0 },
  attachInventory: [],       // found weapon attachments (see game/attachments.js)
  weaponAttach: {},          // { weaponId: { barrel|optic|magazine|underbarrel|coating: attachId } }
  base: {},                  // building id -> level (see game/base.js)
  // Base Defence. The mode itself is one session, so nothing about a layout
  // is persisted — only the record and the buff it earned, which the next
  // run consumes.
  defenceBest: 0,            // most waves ever held
  defenceBuff: null,         // { waves, dmg, armor, gold, label } | null
  // The Path — the guided walk through every system. See game/path.js.
  pathClaimed: {},           // stepId -> true
  pathMerges: 0,             // merge attempts, so a FAILED merge still counts
  // Pet TCG — found in Astro Prospector and the Clicker, decked out per pet
  // in PetPanel, fought in TcgBattleScreen. See game/petTcg.js.
  tcgCardInventory: [],      // owned card instances
  tcgDecks: {},              // { petId: [cardId, ...] } — up to DECK_SIZE each
  // Companions rescued in the storyline. See game/companions.js.
  companions: {},            // { companionId: { rescued: true } }
  gearParts: 0,              // spent to level equipment 1..10 (see game/gear.js)
  probe: {},                 // Astro Prospector probe upgrade levels
  prospectBlueprints: 0,     // sealed data cores, spent to unlock unique cards
  prospectCards: [],         // unlocked PROSPECT_CARDS ids -> enter the run pool
  shopCards: [],             // unlocked SHOP_CARD_POOL card ids -> enter the run pool

  // ---- Fields below were read (with `||` fallbacks) by various panels but
  // never actually declared here — added for documentation/consistency
  // during a code review pass; behavior is unchanged since every read site
  // already defended against them being undefined on a fresh save. ----
  equippedParts: {},   // { weaponId: { slot: partId } }
  equippedActives: [], // active-skill ids currently slotted (Loadout)
  parts: [],           // loose weapon-parts inventory (ARRAY - do not reuse this key)
  gearSlotParts: {},   // per-slot gear parts { helmet: n, boots: n, ... }
  settings: {},
  shopBonuses: {},
  blueprintShards: {}, // { weaponId: shardCount }
  craftedWeapons: [],
  // Which unlocked starter the next run opens with. Chosen in the
  // Weaponsmith's BLUEPRINTS tab; read by GameScreen. Never trust it blindly
  // — a save can carry an id whose weapon was retired, so the read site falls
  // back to the pistol rather than handing the engine an id WEAPONS has no
  // entry for (snapshot() reads WEAPONS[id].icon every frame and would throw).
  startWeapon: 'hydropistol',
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
    s.clicker = { ...DEFAULT_SAVE.clicker, ...(s.clicker || {}) };
    if (!s.clicker.lastMs) s.clicker.lastMs = Date.now();
    s.attachInventory = s.attachInventory || [];
    s.weaponAttach = s.weaponAttach || {};
    // The game had TWO found-weapon-part systems doing the same job: the
    // loose `parts` inventory and attachments. Attachments won — they socket
    // into five named slots and are visible on the drawn weapon. Old parts
    // are converted rather than deleted, so nobody loses a collection.
    if (Array.isArray(s.parts) && s.parts.length) {
      const SLOT_MAP = {
        barrel: 'barrel', muzzle: 'barrel',
        sight: 'optic',
        magazine: 'magazine',
        grip: 'underbarrel', stock: 'underbarrel',
        bullets: 'coating',
      };
      const DEF_BY_SLOT = {
        barrel: 'longBarrel', optic: 'redDot', magazine: 'drumMag',
        underbarrel: 'foregrip', coating: 'incendiary',
      };
      for (const p of s.parts) {
        const slot = SLOT_MAP[p.slot] || 'barrel';
        s.attachInventory.push({
          id: p.id || `a_mig_${Math.random().toString(36).slice(2, 8)}`,
          defId: DEF_BY_SLOT[slot],
          slot,
          rarity: p.rarity === 'uncommon' ? 'magic' : (p.rarity || 'common'),
          name: `Salvaged ${slot}`,
          mods: { damage: 0.08 },
          cost: {},
          element: slot === 'coating' ? 'fire' : null,
          look: slot === 'coating' ? 'coat' : DEF_BY_SLOT[slot] === 'longBarrel' ? 'long' : 'dot',
        });
      }
      s.parts = [];
      s.equippedParts = {};
    }
    s.base = s.base || {};
    s.gearParts = s.gearParts || 0;
    // Gear predating the levelling system has no level. Treating a missing
    // level as 1 in the readers would work, but writing it once here means
    // the forge's level-10 gate and the level-up UI both see a real number.
    if (Array.isArray(s.gearInventory)) {
      s.gearInventory = s.gearInventory.map(g => (g && g.level ? g : { ...g, level: 1 }));
    }
    s.probe = s.probe || {};
    s.prospectBlueprints = s.prospectBlueprints || 0;
    s.prospectCards = s.prospectCards || [];
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
    // ---- Difficulty / badges / quest chain ---------------------------------
    // A save written before these systems has none of them. Every field is
    // seeded rather than left undefined so the readers can index them without
    // a fallback each time, and profile.badges is normalised to exactly three
    // entries — a short array would render fewer than three carved slots.
    // `bestKills` has always stored the best run LEVEL despite its name, so it
    // is the only record an existing save has of that number. Backfilling
    // `bestLevel` from it matters: the story quest chain gates on bestLevel at
    // steps 3 and 9, and `completedUnpaid` only ever advances the OPEN step —
    // so without this a veteran with dozens of runs behind them would find
    // their whole story track frozen at "reach level 5" until they happened to
    // finish another run.
    s.bestLevel = s.bestLevel || s.bestKills || 0;
    s.difficulty = s.difficulty || 'normal';
    s.mapProgressByDiff = s.mapProgressByDiff || {};
    s.diffCleared = s.diffCleared || {};
    s.badgesEarned = s.badgesEarned || {};
    s.pendingRewards = Array.isArray(s.pendingRewards) ? s.pendingRewards : [];
    s.questsDone = s.questsDone || {};
    s.questSeen = s.questSeen || {};
    const b = Array.isArray(s.profile.badges) ? s.profile.badges.slice(0, 3) : [];
    while (b.length < 3) b.push(null);
    s.profile.badges = b;
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

  // Probe Keys refill slowly, up to a small cap. Keys are meant to LIMIT the
  // mine, not to lock a player out of it: without a trickle, someone who spent
  // their last key and had no run rewards pending would simply have the mode
  // taken away with no way to get it back. The cap is what keeps it a limit —
  // they do not stockpile while you are away.
  {
    const PROBE_KEY_MS = 20 * 60 * 1000;   // one every 20 minutes
    const PROBE_KEY_CAP = 3;
    const have = save.probeKeys || 0;
    const last = save.probeKeyAt || 0;
    if (have < PROBE_KEY_CAP) {
      if (!last) {
        // First ever tick: start the clock rather than granting immediately,
        // otherwise a fresh save banks a key the instant it loads.
        const ns = touch();
        ns.probeKeyAt = now;
      } else {
        const earned = Math.floor((now - last) / PROBE_KEY_MS);
        if (earned > 0) {
          const ns = touch();
          ns.probeKeys = Math.min(PROBE_KEY_CAP, have + earned);
          // Carry the remainder so partial progress is not thrown away on
          // every tick — otherwise the 10s interval would reset the clock
          // constantly and a key would never actually arrive.
          ns.probeKeyAt = last + earned * PROBE_KEY_MS;
        }
      }
    }
    // Deliberately nothing in the at-cap case. Writing `probeKeyAt = now`
    // here would mark the save changed on EVERY 10s tick forever, breaking
    // tickIdle's contract of returning the same reference when nothing moved
    // and forcing a save+sync round trip continuously. The clock is instead
    // restarted at the moment a key is spent (see ProspectorScreen.startDive),
    // which is the only time it actually matters.
  }

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

  // Waterdrop Clicker production. Uses its OWN lastMs rather than the shared
  // lastTickMs, because the clicker screen settles itself every frame while
  // open — sharing one timestamp would let one of the two consumers reset it
  // and silently swallow the other's elapsed time.
  const cl = save.clicker;
  if (cl) {
    const rate = clickerRate(cl);
    const last = cl.lastMs || now;
    const elapsed = Math.max(0, Math.min(IDLE_CAP_MS, now - last));
    if (rate > 0 && elapsed >= 1000) {
      const gained = rate * (elapsed / 1000);
      const ns = touch();
      ns.clicker = {
        ...cl,
        drops: (cl.drops || 0) + gained,
        total: (cl.total || 0) + gained,
        lastMs: now,
      };
    } else if (!cl.lastMs) {
      const ns = touch();
      ns.clicker = { ...cl, lastMs: now };
    }
  }

  if (changed || !save.lastTickMs) {
    const ns = touch();
    ns.lastTickMs = now;
  }
  return s;
}

// Duplicated deliberately from game/clicker.js's dropsPerSec: store.js is
// imported by nearly everything, and having it pull in a gameplay module for
// one loop would drag that module into every bundle that touches the save.
function clickerRate(cl) {
  const RATES = { condenser: 1, net: 5, trap: 22, aquifer: 100, coil: 480, engine: 2400 };
  let rate = 0;
  for (const [id, n] of Object.entries(cl.buildings || {})) rate += (RATES[id] || 0) * n;
  return rate;
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
    // The daily streak bonus was a flat ×2 on EVERYTHING, which made the
    // third level-up of a day worth as much as the first two combined and
    // turned the whole reward table into a login-timing puzzle. ×1.5, and it
    // no longer doubles the rarest currencies (gems, slot coins, shards) —
    // those stay on their own schedule so a streak is a nudge, not the
    // primary way to get them.
    const mult = ls.count >= 3 ? 1.5 : 1;
    const scale = (n) => Math.max(1, Math.round(n * mult));
    // Slot coins at milestones: every 5 levels = 1, every 10 = 2
    const slotBonus = (lv % 10 === 0) ? 2 : (lv % 5 === 0) ? 1 : 0;
    // Gems every FIFTH level rather than every level, plus a bump per 10.
    // Profile levels come steadily from every run, so one-per-level made
    // the level-up screen the single largest gem faucet in the game.
    const gemsBonus = (lv % 5 === 0 ? 2 : 0) + Math.floor(lv / 10);
    save.pendingLevelUp = {
      level: lv,
      // The level you came FROM, so the celebration can tell a plain profile
      // level-up apart from an actual rank-up. Rank only moves every 4 levels
      // (getRank = floor(level/4)); without this the overlay shouted
      // "RANK UP!" on every single level and printed the profile level where
      // the rank number should be.
      fromLevel: prevLevel,
      // The XP that actually triggered this — the overlay used to print
      // `r.xp` here, a field that was never set, so it silently fell back to
      // showing the GOLD reward mislabelled as "Account XP".
      xpGained: amount,
      gold: scale(100 + lv * 40),
      sp: scale(Math.max(1, Math.floor(lv / 4))),
      talentPoints: scale(2),
      gems: gemsBonus,
      slotCoins: slotBonus,
      freeSpin: lv % 10 === 0,
      streakBonus: ls.count >= 3,
      streakCount: ls.count,
      pieces: scale(4 + lv * 2),
      shards: lv % 5 === 0 ? 3 : 0,
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
  if (reward.gearParts) save.gearParts = (save.gearParts || 0) + reward.gearParts;
  if (reward.flux)      save.flux      = (save.flux      || 0) + reward.flux;
  if (reward.cores)     save.cores     = (save.cores     || 0) + reward.cores;
  // These two were missing, which meant any reward bag containing them paid
  // out everything EXCEPT them — silently. The guided quest chain pays
  // talentPoints (c_talent) and gachaTokens (c_artifact, s_void, s_aida), and
  // the reward screen listed both, so the player was shown currency that
  // never arrived. Every currency this function can be handed a key for must
  // have a branch here; there is no fallback.
  if (reward.talentPoints) save.talentPoints = (save.talentPoints || 0) + reward.talentPoints;
  if (reward.gachaTokens)  save.gachaTokens  = (save.gachaTokens  || 0) + reward.gachaTokens;
  if (reward.type === 'gold')  save.gold      = (save.gold      || 0) + reward.amount;
  if (reward.type === 'sp')    save.sp        = (save.sp        || 0) + reward.amount;
  if (reward.type === 'gems')  save.gems      = (save.gems      || 0) + reward.amount;
  if (reward.type === 'chest' && reward.chestId && openChest) {
    const drops = openChest(reward.chestId);
    if (drops && drops.length) save.inventory = [...(save.inventory || []), ...drops];
  }
}

// Queues a reward for the "welcome back" screen that fires on the next camp
// entry, IN ADDITION to applying it. The currency has already landed by the
// time the screen shows — the screen exists so a badge earned mid-run or a
// quest that completed while a modal was open still gets a moment, rather
// than a number silently ticking up in a corner nobody was looking at.
//
// Mutates in place, same contract as applyReward: pass a fresh copy.
export function bankReward(save, entry) {
  if (!entry) return;
  save.pendingRewards = [...(save.pendingRewards || []), entry].slice(-12);
}
