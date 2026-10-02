import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { META_UPGRADES, metaCost, metaMarkName, WEAPONS } from '../game/data';
import { MILESTONES, AVATARS, CHESTS, rollChest, getRank, RANK_TITLES, PROFILE_FRAMES, NAME_COLORS, accountXpToNext } from '../game/data_ext';
import { collectPendingLevelUp, pendingRewardBag, rankUnlocksBetween, nextRankPrize, rewardTiles } from '../game/profileLevelUp';
import ProfilePanel from './ProfilePanel';
import { META_UNLOCK_REQS, POE_INDEX, POE_ATTRS, attrCanAdd, attrNextLine, DASH_NODE_ID } from '../game/poe_tree';
import { skillMoveOf, unlockBannerFrom } from '../game/skillMoves';
import { applyReward, DEFAULT_SAVE, saveLocal } from '../store';
import SkillTree from './SkillTree';
import Weaponsmith from './Weaponsmith';
import Shop from './Shop';
import CharacterPanel from './CharacterPanel';
import TalentTree from './TalentTree';
import CampaignPanel from './CampaignPanel';
import PetPanel from './PetPanel';
import ProspectorScreen from './ProspectorScreen';
import { nextCampaignNode, isCampTabLocked, campUnlockHint, campUnlockStage, isCampSubTabLocked, isEndlessUnlocked, storyBeat } from '../game/campaign';
import { battlePassUnclaimedCount, patrolReadyCount, codexUnclaimedCount, achievementsReady } from '../game/campClaims';
import { isStationRepaired } from '../game/base';
import { currentStep } from '../game/path';
import ClickerScreen from './ClickerScreen';
import AssetStudioModal from './AssetStudioModal';
import BasePanel from './BasePanel';
import StationRoom from './StationRoom';
import HangarRoom from './HangarRoom';
import DrainScreen from './DrainScreen';
import BaseDefenceScreen from './BaseDefenceScreen';
import PathPanel from './PathPanel';
import TcgScreen from './TcgScreen';
import ExplorationScreen from './ExplorationScreen';
import { pendingMilestones } from '../game/clicker';
import GearPanel from './GearPanel';
import { BattlePassPanel, CodexPanel, PatrolPanel, ClaimBadge } from './MetaFeatures';
import { CAMPAIGN_QUESTS } from '../game/data_ext2';
import { MissionsPanel, ChallengesPanel, AchievementsPanel, CardShopModal, ActiveLoadoutPanel, SettingsPanel, MapsPanel, DailyRewardsWidget } from './CampPanels';
import { Audio } from '../game/audio';
import BadgeSlots, { BadgePicker } from './BadgeSlots';
import QuestTracker, { WhatsOnStrip } from './QuestTracker';
import GameIcon from './GameIcon';
import CampFrame, { CampCosmos } from './CampFrame';
import { fireClaimFx, CAMP_CLAIM_FLY } from './ClaimFx';

// Display name + icon for every tab the unlock cascade can reveal — read by
// both the tab bar (locked tabs are hidden, not dimmed, per Timmy: "bara base
// ska finnas där") and the big reveal banner BasePanel's `onUnlock` triggers.
const CAMP_TAB_META = {
  cards:      { label: 'META UPGRADES', icon: 'ui_gem' },
  skills:     { label: 'SKILL TREE', icon: 'ui_skills', sub: 'BUY SHADOW DASH — FOLLOW THE TEAL NODES' },
  talent:     { label: 'TALENTS',       icon: 'ui_leaf' },
  gear:       { label: 'GEAR',          icon: 'gear' },
  character:  { label: 'CHARACTER',     icon: 'ui_character' },
  pets:       { label: 'PETS',          icon: 'ui_pets' },
  prospector: { label: 'LOOTMINE',      icon: 'ui_pickaxe' },
  starraid:   { label: 'STAR RAID',     icon: 'ui_rocket' },
  patrol:     { label: 'PATROL',        icon: 'ui_map' },
  clicker:    { label: 'THE WELL',      icon: 'ui_waterdrop' },
  forge:      { label: 'SMITH',         icon: 'ui_smith' },
  chest:      { label: 'CHESTS',        icon: 'ui_chest' },
  shop:       { label: 'CARD SHOP',     icon: 'ui_token' },
  loadout:    { label: 'LOADOUT',       icon: 'ui_loadout' },
  pass:       { label: 'SEASON PASS',   icon: 'ui_medal' },
  codex:      { label: 'CODEX',         icon: 'ui_codex' },
  // Not a camp tab. Banner only — the hatch is in the hangar. Do not add
  // this to CAMP_UNLOCK_BATCHES (that fires on any Nth building level).
  drain:      { label: 'THE DRAIN',     icon: 'ui_hatch', sub: 'THE GRATE UNDER THE HANGAR' },
};

// A number that rolls from its current displayed value to the new one rather
// than snapping. Buying three upgrades in quick succession does NOT queue
// three separate animations — each new target simply re-aims the roll from
// wherever it currently is, so a burst of purchases reads as one continuous
// climb. Duration scales with the size of the jump so +5 doesn't take as long
// as +5000.
function CountUp({ value, className }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const raf = useRef(0);
  const [dir, setDir] = useState(0);
  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return undefined;
    setDir(value > from ? 1 : -1);
    const start = performance.now();
    const dur = Math.min(950, 240 + Math.abs(value - from) * 1.6);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (value - from) * eased);
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setTimeout(() => setDir(0), 320);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  // Compact from a thousand up: 2466 -> "2.5k". Seven currency chips share one
  // phone-width row, and "2 466" alone is wider than the share each chip gets
  // — a thousands-separated number is what forced the row to overflow and
  // scroll. Under 1000 the exact figure still shows, because that is the range
  // where a player is counting single coins.
  // Precision drops as the number grows, so the string stays about the same
  // WIDTH at every magnitude — that is what keeps the chips equal:
  //   2466   -> 2.46k      12345 -> 12.3k
  //   123456 -> 123k       2.4M  -> 2.4M
  // Trailing zeros are trimmed so it reads 3k rather than 3.00k.
  const fmt = (n) => {
    const trim = (s) => s.replace(/\.?0+$/, '');
    if (n >= 1e6) return trim((n / 1e6).toFixed(n >= 1e7 ? 0 : 1)) + 'M';
    if (n >= 1e5) return trim((n / 1e3).toFixed(0)) + 'k';
    if (n >= 1e4) return trim((n / 1e3).toFixed(1)) + 'k';
    // Truncated, not rounded: 2466 reads 2.46k. Rounding to 2.47k shows a
    // number the player does not have, which matters on a currency — you can
    // be shown less than you own, never more.
    if (n >= 1e3) return trim((Math.floor(n / 10) / 100).toFixed(2)) + 'k';
    return String(n);
  };
  return (
    <span className={`countup${dir > 0 ? ' is-up' : dir < 0 ? ' is-down' : ''}${className ? ' ' + className : ''}`}>
      {fmt(shown)}
      {dir !== 0 && <i className="countup-arrow">{dir > 0 ? '▲' : '▼'}</i>}
    </span>
  );
}

const openChest = (chestId) => {
  const c = CHESTS.find(x => x.id === chestId);
  return c ? rollChest(c, 0.5) : [];
};

// The one-time "why build the camp" briefings, one per pond stage. Timmy
// retired the combat tutorial — a fresh save now lands straight in the
// (mostly locked) camp, so each stage needs its own explanation for why
// there's more building to do before the next fight. English, continuing
// the dry, dark-humor voice AIDA_INTRO's "THE DROP" already speaks in
// (IntroDialogue.jsx) — this is the same character, one scene later each
// time. Keyed by `campUnlockStage(save)` — stage 0 (nothing cleared) shows
// the first, stage 1 (pond_1 cleared, pond_2 next) shows the second, and so
// on; a stage with no entry here just doesn't show a briefing.
const CAMP_BRIEFINGS = {
  insert: {
    kicker: 'SITREP',
    title: 'So. This is the wreck.',
    lines: [
      "You found it. A ring in the dark with nobody home and the windows shut.",
      "The chip in your gut wants the socket in the middle of the hall. Walk it there. That is A.I.D.A. She will lie later. Right now she turns the lights on.",
      "You do not build this place from a list. You walk up to the holes and you patch them, one room at a time.",
      "Until the hull holds air, everything else is locked and dusty. That is the point.",
      "When the stores are empty she sends you back out. That loop is the story until the hangar holds a ship.",
    ],
    cta: 'WALK THE HALL ▸',
  },
  hull: {
    kicker: 'SITREP // POWER',
    title: 'She is in. The lights are ugly.',
    lines: [
      "A.I.D.A. is talking. Ignore half of it. The holes in the left wall are the other half.",
      "Walk to a breach. Patch it. That is The Hull. Until it holds, nothing else in this ring will take a bolt.",
      "Then you go back out only when you cannot pay. The Rain Pool still remembers being clean.",
    ],
    cta: 'SEAL THE HULL ▸',
  },
  gather: {
    kicker: 'SITREP // STORES',
    title: 'The stores are empty.',
    lines: [
      "You saw the price. You do not have it. That is not a bug. That is the work.",
      "CONTINUE STORY is a gather run now. Hold the Rain Pool. Bring the wet coins back. Install the next piece.",
      "Do that until the hangar holds a ship. Then the maps open and the game starts for real.",
    ],
    cta: 'GO GATHER ▸',
  },
  1: {
    kicker: 'SITREP // UPDATE',
    title: 'Ripples. Someone noticed.',
    lines: [
      "Word travels through mud faster than it does through water. Whatever's out there heard the Warden go down.",
      "Good news: the nav array's got power now. Bad news: so does whatever's coming to check on it.",
      "Two more rooms to wire up before this camp does anything you'd call useful. Meta upgrades. Skills. Talents. Don't ask what half the buttons do yet.",
      "The company's gotten uglier, and something out there learned to duck.",
      "Five minutes this time. Try not to bleed out before the interesting part.",
    ],
    cta: 'RIPPLES ▸',
  },
  2: {
    kicker: 'SITREP // THE POOL',
    title: 'The rain still remembers being clean.',
    lines: [
      "You sealed the hull. The rest of this ring still wants parts you do not have.",
      "CONTINUE STORY is a gather run until the hangar holds a ship. Skills and talents opened with the first bolt. Spend them before you go.",
      "The second pool is longer. Same guardian. Learn it.",
    ],
    cta: 'HOLD THE POOL ▸',
  },
  3: {
    kicker: 'SITREP // HANGAR',
    title: 'A ship. Finally.',
    lines: [
      "The hangar holds something that still flies — or the Rain Pool is behind you. MAPS is open. Endless is open. The first hour is over.",
      "The Lake is next. It is not an onramp. Spend what you carried home.",
    ],
    cta: 'THE MAPS ARE YOURS ▸',
  },
};

export default function Camp({ save, setSave, onBack, onStart, onMission, onStory, onStarRaid }) {
  const storyNode = nextCampaignNode(save);
  const beat = storyBeat(save);
  // Shown once per beat — never re-fires once dismissed for that key.
  // Old saves may carry `campBriefingSeen: true` or `{ 0: true }`; both mean
  // the insert sitrep already played.
  const briefSeenRaw = typeof save.campBriefingSeen === 'object' && save.campBriefingSeen
    ? save.campBriefingSeen
    : (save.campBriefingSeen ? { 0: true } : {});
  const briefSeen = briefSeenRaw[0] ? { ...briefSeenRaw, insert: true } : briefSeenRaw;
  const briefStage = campUnlockStage(save);
  const briefKey = beat.why === 'insert' ? 'insert'
    : beat.why === 'hull' ? 'hull'
    : beat.why === 'gather' ? 'gather'
    : briefStage === 1 ? 1
    : briefStage === 2 ? 2
    : briefStage === 3 ? 3
    : null;
  const briefing = briefKey != null ? CAMP_BRIEFINGS[briefKey] : null;
  const showBriefing = !!briefing && !briefSeen[briefKey] && !save.pendingStationWalk;
  const followStory = () => {
    Audio.click();
    if (beat.kind === 'hall') { setStationOpen(true); return; }
    if (beat.kind === 'mission' && onStory) onStory();
  };
  const dismissBriefing = (thenGo) => {
    setSave({ ...save, campBriefingSeen: { ...briefSeen, [briefKey]: true } });
    if (!thenGo) return;
    followStory();
  };
  // Camp starts locked and opens up panel by panel as the Rain Pool nodes
  // clear — see campaign.js's campUnlockStage. `guard` wraps a tab's onClick
  // so a locked button is inert rather than needing every call site below to
  // remember to check; `lockedProps` supplies the dimmed styling + hover
  // hint in one spot so all ~15 gated buttons stay visually consistent.
  const lockGuard = (id, onClick) => () => { if (!isCampTabLocked(id, save)) onClick(); };
  const lockedProps = (id) => isCampTabLocked(id, save)
    ? { className: 'camp-tab locked', title: campUnlockHint(id, save) || 'Locked' }
    : null;

  // The unlock-reveal cascade: BasePanel hands a batch of newly-unlocked tab
  // ids to `queueUnlocks` the moment a building purchase cracks them open.
  // They are shown ONE AT A TIME, big, center screen — "META UPGRADES
  // UNLOCKED" with its logo, then it swaps to the next one — rather than all
  // at once, because the whole point (Timmy: "man ser va man har som en
  // unlock") is that each menu gets its own moment, not a wall of text.
  const [unlockQueue, setUnlockQueue] = useState([]);
  const [unlockShown, setUnlockShown] = useState(null);
  const pendingSkillTour = useRef(false);
  const queueUnlocks = (items) => setUnlockQueue(q => {
    const next = [...q];
    for (const raw of items || []) {
      const item = unlockBannerFrom(raw);
      if (!item?.id) continue;
      if (next.some(x => (typeof x === 'string' ? x : x.id) === item.id)) continue;
      next.push(item);
    }
    return next;
  });
  const onMoveUnlock = (move) => {
    const item = skillMoveOf(move) || unlockBannerFrom(move);
    if (item) queueUnlocks([item]);
  };
  // Pop the next queued unlock the moment nothing is showing.
  useEffect(() => {
    if (unlockShown || unlockQueue.length === 0) return;
    const [next, ...rest] = unlockQueue;
    setUnlockQueue(rest);
    setUnlockShown(next);
    // Was claimPing() — the same short blip a daily reward uses. Opening a
    // whole new part of the game deserves its own sound, and reusing the
    // reward blip made it feel like collecting a coin. `unlockReveal`'s
    // swell is timed so the bright arrival lands with the logo, not with
    // the first frame of the banner.
    Audio.unlockReveal?.();
  }, [unlockQueue, unlockShown]);
  // Clear the currently-shown one after its dwell. Kept as its OWN effect,
  // keyed only on `unlockShown` — folding this into the pop effect above
  // meant popping the next item (which changes unlockQueue) re-ran that
  // effect, whose cleanup cancelled this very timer before it ever fired,
  // so the banner got stuck on the first unlock forever.
  useEffect(() => {
    if (!unlockShown) return;
    // MUST stay in step with `.camp-unlock-banner`'s campUnlockOut in
    // index.css: it now starts fading at 2600ms and takes 450ms, so
    // unmounting at the old 2200ms cut the banner off before its own exit
    // animation began — it just vanished. If that CSS timing changes,
    // change this with it.
    const shown = unlockShown;
    const t = setTimeout(() => {
      const id = typeof shown === 'string' ? shown : shown.id;
      if (id === 'skills') pendingSkillTour.current = true;
      setUnlockShown(null);
    }, 3050);
    return () => clearTimeout(t);
  }, [unlockShown]);

  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('campaign');
  const goTab = (id) => { Audio.click(); setTab(id); };
  const tapOpen = (setFn) => () => { Audio.click(); setFn(true); };
  // ── INITIAL FOCUS ──────────────────────────────────────────────────────────
  // The camp had no focus handling of any kind: nothing focused on open, no
  // focus order, no visible ring. On a controller that is not "a bit awkward",
  // it is a screen you cannot enter at all — which matters, because Steam is
  // on the plan (see the gore/platform doctrine memory).
  //
  // `preventScroll` is load-bearing. Focusing an element normally scrolls it
  // into view, and on the phone the tab rail is a horizontally scrolling strip
  // — so without it, opening the camp would jerk the rail sideways on every
  // mount for no reason the player could understand.
  const firstTabRef = useRef(null);
  useEffect(() => {
    const el = firstTabRef.current;
    if (!el) return;
    // Only claim focus if nothing meaningful already has it. A modal opened by
    // a deep-link (or the level-up overlay) must not have focus stolen back.
    const a = document.activeElement;
    if (a && a !== document.body && el !== a) return;
    el.focus({ preventScroll: true });
  }, []);
  const [shopOpen, setShopOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  useEffect(() => {
    if (unlockShown || unlockQueue.length || skillOpen) return;
    if (!pendingSkillTour.current) return;
    pendingSkillTour.current = false;
    if (((save.skills || {})[DASH_NODE_ID] || 0) >= 1) return;
    setSkillOpen(true);
  }, [unlockShown, unlockQueue, skillOpen, save.skills]);
  const [forgeOpen, setForgeOpen] = useState(false);
  // Which Weaponsmith sub-tab to land on. The smith holds three unrelated
  // systems, so "go to the smith" is not a destination on its own — the
  // katana quest sends you to BLUEPRINTS, the tuning steps to TUNING.
  const [forgeSub, setForgeSub] = useState('parts');
  const [chestOpen, setChestOpen] = useState(false);
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [popCard, setPopCard] = useState(null);

  const [characterOpen, setCharacterOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);
  const [petOpen, setPetOpen] = useState(false);
  const [tcgOpen, setTcgOpen] = useState(false);
  const [explorationOpen, setExplorationOpen] = useState(false);
  const [prospectorOpen, setProspectorOpen] = useState(false);
  const [clickerOpen, setClickerOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const [stationOpen, setStationOpen] = useState(false);
  const [hangarOpen, setHangarOpen] = useState(false);
  const [drainOpen, setDrainOpen] = useState(false);
  const [defenceOpen, setDefenceOpen] = useState(false);
  useEffect(() => {
    if (!save.pendingStationWalk) return;
    if (isCampTabLocked('base', save)) return;
    setStationOpen(true);
  }, [save.pendingStationWalk, save.runsCompleted]);
  // Entering a building opens the system it houses, so the base is the way
  // into everything rather than a sixth place that duplicates them.
  const enterBuilding = (id) => {
    if (id === 'hull') return;
    setBaseOpen(false);
    // The walkable room's doors route through THIS function, not a second
    // switch of their own — a door in the Main Hall and a card in the module
    // list have to land in the same place forever, and the only way to
    // guarantee that is for there to be one mapping.
    // Hangar stays mounted under the Drain overlay so DESCEND/CLIMB OUT
    // does not dump you on the camp rail. The hall unmounts whenever the
    // hangar opens — two live Pixi apps is how the tab used to wedge.
    if (id !== 'drain') setStationOpen(false);
    if (id !== 'hangar' && id !== 'drain') setHangarOpen(false);
    if (id === 'hangar') { setHangarOpen(true); return; }
    if (id === 'drain') { setHangarOpen(true); setDrainOpen(true); return; }
    if (id === 'incubator') { setPetOpen(true); return; }
    if (id === 'well') { setClickerOpen(true); return; }
    if (id === 'forge') { setTab('gear'); return; }
    if (id === 'patrolPost') { setTab('patrol'); return; }
    if (id === 'rampart') { setDefenceOpen(true); return; }
  };
  // The Path's "take me there" button. Every destination it can name has to
  // land somewhere real — a step that sends you nowhere is worse than no
  // step at all — so this is deliberately exhaustive rather than defaulting.
  const pathGo = (dest) => {
    switch (dest) {
      case 'story':    if (storyNode && onStory) onStory(); break;
      case 'gear':     setTab('gear'); break;
      case 'smith':    setForgeSub('parts'); setForgeOpen(true); break;
      // Same panel, but landed on the blueprint shelf. The katana quest asks
      // you to pick a start weapon; dropping you on TUNING and letting you
      // hunt for the control is how a two-click task becomes a dead end.
      case 'smithBlueprints': setForgeSub('blueprints'); setForgeOpen(true); break;
      case 'base':     setStationOpen(true); break;
      case 'defence':  setDefenceOpen(true); break;
      case 'hangar':   setHangarOpen(true); break;
      case 'drain':    setHangarOpen(true); setDrainOpen(true); break;
      case 'prospect': setProspectorOpen(true); break;
      case 'patrol':   setTab('patrol'); break;
      case 'starraid': if (onStarRaid) onStarRaid(); break;
      // ---- Destinations the guided quest chain can name --------------------
      // Same rule as above, extended: every `go` value in storyQuests.js must
      // land somewhere real. A guided step whose button does nothing is worse
      // than no guidance at all, so this is exhaustive by construction — if a
      // quest names a destination, it is in this switch.
      case 'attrs':     setAttrOpen(true); break;
      case 'meta':      setTab('cards'); break;
      case 'skills':    setSkillOpen(true); break;
      case 'talents':   setTalentOpen(true); break;
      case 'character': setCharacterOpen(true); break;
      case 'loadout':   setLoadoutOpen(true); break;
      case 'shop':      setShopOpen(true); break;
      case 'chests':    setChestOpen(true); break;
      case 'clicker':   setClickerOpen(true); break;
      case 'pets':      setPetOpen(true); break;
      case 'tcg':       setTcgOpen(true); break;
      case 'pass':      setTab('pass'); break;
      case 'codex':     setTab('codex'); setCodexSub('codex'); break;
      case 'achievements': setTab('codex'); setCodexSub('achievements'); break;
      // Daily login lives in camp as the same widget that used to hide on
      // Welcome. Dumping TAKE ME THERE to the start menu was a dead door.
      case 'daily':     setDailyOpen(true); break;
      case 'profile':   setBadgeOpen(true); break;
      default: setTab('cards');
    }
  };
  const clickerReady = pendingMilestones(save.clicker).length;
  // Badge the Campaign tab when the current Path step is collectable — the
  // one thing the player is being guided toward should not need hunting for.
  const pathStep = currentStep(save);
  const pathReady = !!pathStep && pathStep.check(save);
  const [profileOpen, setProfileOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [attrOpen, setAttrOpen] = useState(false);
  // The attribute panel escapes the sidebar entirely. Both an absolutely
  // positioned dropdown AND an in-flow expanding block get clipped here —
  // .camp-sidebar sets overflow:hidden and the framed profile plaque is a
  // hard edge inside it — so the panel is position:fixed and measured off
  // the profile bar, letting it roll out IN FRONT of the frame.
  const profileBarRef = useRef(null);
  const [attrPanelStyle, setAttrPanelStyle] = useState(null);
  useEffect(() => {
    if (!attrOpen) return;
    const place = () => {
      const el = profileBarRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Exactly as wide as the profile plaque it drops out of, and aligned to
      // its left edge. It used to be a flat 340px regardless, which on a wider
      // sidebar left it overhanging the right side by a finger's width — the
      // panel looked bolted on rather than part of the menu. Measuring the
      // anchor means it stays symmetric at every sidebar width.
      setAttrPanelStyle({
        position: 'fixed',
        left: r.left,
        top: r.bottom - 2,
        width: r.width,
        maxHeight: Math.max(180, window.innerHeight - r.bottom - 20),
      });
    };
    place();
    // Third way out, for keyboard. The backdrop and the ✕ cover touch.
    const onKey = (e) => { if (e.key === 'Escape') setAttrOpen(false); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [attrOpen]);
  // Sub-tabs for the consolidated Campaign hub (was 4 separate top-level
  // tabs: Campaign/Maps/Missions/Challenges) and Codex hub (was Codex +
  // Achievements + Milestones) — fewer top-level menus per feedback.
  const [campaignSub, setCampaignSub] = useState('campaign');
  const [codexSub, setCodexSub] = useState('codex');

  const popFeedback = (id) => { setPopCard(id); setTimeout(() => setPopCard(null), 550); };


  // Position-anchored "cha-ching" burst for meta upgrade purchases — appears
  // right above the button that was clicked instead of a generic top-of-
  // screen banner, with a brief whole-panel shake for impact.
  const [metaBurst, setMetaBurst] = useState(null);
  const [campShake, setCampShake] = useState(false);
  const PCT_STATS = new Set(['dmg','atks','mspd','crit','critd','superCrit','megaCrit','pickup','xp','gold','luck']);
  const fmtMetaGain = (upg) => {
    const v = upg.amount;
    return PCT_STATS.has(upg.stat) ? `+${(v * 100).toFixed(2)}% ${upg.stat}` : `+${v} ${upg.stat}`;
  };
  // The burst ACCUMULATES while you keep buying the same upgrade instead of
  // being replaced. Buying five levels in a row used to spawn five bursts that
  // each overwrote the last, so a fast batch showed one flicker or — if the
  // clicks landed inside the same frame — nothing at all. Now it counts them
  // up, shows the level you came from and landed on, and only expires once you
  // actually stop.
  const burstTimer = useRef(null);
  // Set by the meta-purchase updater when a buy is actually committed, read by
  // the effect that fires the celebration. See `buy` below for why the verdict
  // cannot simply be returned.
  const buyFxRef = useRef(null);
  // Takes an already-measured `rect`, NOT the event.
  //
  // This used to take the event and call `e.currentTarget.getBoundingClientRect()`
  // itself. That was fine while it ran inside the click handler, but once the
  // call moved into an effect (so the celebration only fires for purchases that
  // actually committed) the event was long dead by then: React nulls
  // `currentTarget` as soon as the handler returns, so this threw
  // "null is not an object" on every meta purchase. The rect has to be
  // measured during the click and carried along.
  const burstMeta = (upg, rect, fromLvl) => {
    if (!rect) return;
    setMetaBurst(cur => {
      const same = cur && cur.upgId === upg.id;
      return {
        upgId: upg.id,
        x: rect.left + rect.width / 2,
        y: rect.top,
        icon: upg.icon,
        name: upg.name,
        gain: fmtMetaGain(upg),
        count: same ? cur.count + 1 : 1,
        // Keep the ORIGINAL starting level across a batch so the readout says
        // "Lv 3 → 8" rather than resetting to "Lv 7 → 8" on the last click.
        fromLvl: same ? cur.fromLvl : fromLvl,
      };
    });
    clearTimeout(burstTimer.current);
    // Roughly double the old dwell. There are four things to read here (name,
    // level range, stat gain, batch count) and 1.5s was not enough time to get
    // through them before it floated away.
    burstTimer.current = setTimeout(() => setMetaBurst(null), 3000);
    setCampShake(true); setTimeout(() => setCampShake(false), 260);
    Audio.claimPing();
  };
  useEffect(() => () => clearTimeout(burstTimer.current), []);

  const buyAttr = (attrId) => {
    const def = POE_ATTRS.find(a => a.id === attrId);
    let ok = false;
    setSave(s => {
      if (!attrCanAdd(s, def)) return s;
      const cur = (s.attrs || {})[attrId] || 0;
      ok = true;
      return { ...s, attrs: { ...(s.attrs || {}), [attrId]: cur + 1 } };
    });
    if (ok) Audio.click('buy');
    else Audio.click('back');
  };

  const buy = (upg, e) => {
    const cur = save.meta[upg.id] || 0;
    if (cur >= upg.max) return;
    // Meta lock gate: check if required POE node is unlocked
    const reqNodeId = META_UNLOCK_REQS[upg.id];
    if (reqNodeId && !(save.skills[reqNodeId] >= 1)) {
      const reqNode = POE_INDEX[reqNodeId];
      setToast(`Requires Skill Tree: ${reqNode?.name || reqNodeId}`);
      setTimeout(() => setToast(''), 2000);
      return;
    }
    const cost = metaCost(upg, cur);
    if (save.gold < cost) { setToast('NOT ENOUGH GOLD'); setTimeout(() => setToast(''), 1200); return; }
    // Functional update, not `{ ...save }`. Clicking fast enough to queue two
    // purchases inside one React batch made the second one read the SAME stale
    // `save` from this closure, so it recomputed the same level and the same
    // cost and the first purchase was silently thrown away — you paid once and
    // got one level for two clicks. Reading `s` from the updater means every
    // click composes on the real latest state.
    // The celebration used to fire unconditionally after the updater, so in
    // exactly the rapid-click race this functional update was added to fix, a
    // REJECTED click still played the chime and popped a "Lv N ▲ N+1" burst
    // for a purchase that never happened.
    //
    // The verdict cannot be read back out of the updater — React runs it at
    // render time, not synchronously here, so a flag set inside it is still
    // false on the next line. Instead the updater records the outcome on a ref
    // as it runs, and the effect below fires the feedback once React has
    // actually committed the new level.
    // Measure NOW, while the event is still live. React nulls `currentTarget`
    // the moment this handler returns, so the effect below cannot read it.
    const rect = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;
    setSave(s => {
      const lvl = s.meta[upg.id] || 0;
      if (lvl >= upg.max) return s;
      const c = metaCost(upg, lvl);
      if ((s.gold || 0) < c) return s;
      buyFxRef.current = { id: upg.id, upg, rect, from: lvl };
      return { ...s, gold: s.gold - c, meta: { ...s.meta, [upg.id]: lvl + 1 } };
    });
    return;
  };

  // Fires the purchase celebration only for buys that were actually committed.
  // Keyed on save.meta so it runs after the state lands, which is also the
  // only moment the burst's "to" value is guaranteed to match reality.
  useEffect(() => {
    const fx = buyFxRef.current;
    if (!fx) return;
    buyFxRef.current = null;
    popFeedback(fx.id);
    if (fx.rect) burstMeta(fx.upg, fx.rect, fx.from); else Audio.click();
    const to = (save.meta && save.meta[fx.id]) || 0;
    const mark = metaMarkName(fx.id, to);
    if (mark && fx.from < to) {
      setToast(mark.toUpperCase());
      setTimeout(() => setToast(''), 1800);
      Audio.levelUp?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.meta]);

  const claimMilestone = (m, e) => {
    if (save.milestones.claimed[m.id]) return;
    const val = save[m.metric] || 0;
    if (val < m.goal) return;
    const ns = { ...save, milestones: { ...save.milestones, claimed: { ...save.milestones.claimed, [m.id]: true } } };
    applyReward(ns, m.reward, openChest);
    setSave(ns);
    fireClaimFx(e?.currentTarget, m.reward, { flyTo: CAMP_CLAIM_FLY });
  };

  const handleReset = () => {
    const fresh = { ...DEFAULT_SAVE };
    setSave(fresh);
    saveLocal(fresh);
    onBack();
  };

  const avatar = AVATARS.find(a => a.id === save.profile.avatar) || AVATARS[0];
  const attrFreePts = Math.max(0, (save.profile?.level || 1) - 1 - Object.values(save.attrs || {}).reduce((a, b) => a + b, 0));

  // ── Notification computations ────────────────
  const codexNew    = codexUnclaimedCount(save) > 0;
  const passNew     = battlePassUnclaimedCount(save) > 0;
  const patrolNew   = patrolReadyCount(save) > 0;
  const achNew      = achievementsReady(save).length > 0;

  // Milestones (codexSub='milestones', a sibling of Codex/Achievements) had
  // no notification badge at all — a completed milestone sat unclaimed with
  // nothing telling the player it was there.
  const _msDone   = MILESTONES.filter(m => (save[m.metric] || 0) >= m.goal).length;
  const _msClaim  = Object.keys(save.milestones?.claimed || {}).length;
  const milestonesNew = _msDone > _msClaim;

  // Campaign tab: STORY (CampaignPanel's CAMPAIGN_QUESTS) was never counted
  // toward the CAMPAIGN tab's own badge — only the Missions sub-tab's
  // `pathReady` was. A claimable campaign quest sat with no indicator
  // anywhere. Computed per sub-tab so the badge can cascade correctly:
  // CAMPAIGN tab lights up if EITHER sub-tab has something, and each
  // sub-tab button shows which one actually does.
  const _cq = save.campaign || {};
  const campaignQuestNew = CAMPAIGN_QUESTS.some(q => q.check(save) && !_cq[q.id]);

  return (
    <div className="app-shell camp-shell-space">
      {/* The sky the station is parked in. Sits BEHIND the panel, which is what
          turns the camp's border into a frame — a border touching the viewport
          edge is just a border. Decoration only, never focusable. */}
      <CampCosmos />
      <div className={`camp ${campShake ? 'camp-shake' : ''}`} data-testid="camp-screen">
        {/* Portalled to <body> — NOT rendered inside .camp.
            The burst is position:fixed and placed from getBoundingClientRect(),
            i.e. viewport coordinates. Buying also puts `.camp-shake` on .camp
            for 260ms, and that animation sets a `transform`. A transformed
            ancestor becomes the containing block for its position:fixed
            descendants, so for those 260ms the burst measured `top` from
            .camp's box — scrolled far up the page — and drew near the top of
            the screen. The instant the shake ended the transform vanished, it
            re-anchored to the viewport, and it snapped down onto the card.
            Hence "it shows at the top first, then it comes down".
            Outside .camp there is no transformed ancestor and it lands right
            the first time. */}
        {metaBurst && createPortal(
          <div className={`meta-burst${metaBurst.count > 1 ? ' is-batch' : ''}`}
            key={`${metaBurst.upgId}-${metaBurst.count}`}
            style={{ left: metaBurst.x, top: metaBurst.y }} data-testid="meta-burst">
            <div className="meta-burst-icon"><GameIcon name={metaBurst.icon} size={26} /></div>
            <div className="meta-burst-name">{metaBurst.name}</div>
            {/* The end of the batch is read LIVE from the save, so it is right
                however many clicks landed before React committed. */}
            {/* Old value dimmed, new value green, with an explicit green
                arrow. Previously both numbers rendered in the same colour, so
                the readout said what changed but not which way — you had to
                compare two numbers to work out you had gained something,
                which is the one thing a purchase confirmation should never
                make you do. */}
            <div className="meta-burst-lvl">
              <span className="mb-from">Lv {metaBurst.fromLvl}</span>
              <b className="mb-arrow">▲</b>
              <span className="mb-to">{save.meta[metaBurst.upgId] || 0}</span>
            </div>
            <div className="meta-burst-gain"><b>▲</b> {metaBurst.gain}</div>
            {metaBurst.count > 1 && (
              <div className="meta-burst-count" data-testid="meta-burst-count">×{metaBurst.count}</div>
            )}
          </div>,
          document.body
        )}
        {showBriefing && createPortal(
          <div className="camp-brief-overlay" data-testid="camp-briefing">
            <div className="camp-brief-card">
              <div className="camp-brief-kicker">{briefing.kicker}</div>
              <div className="camp-brief-title">{briefing.title}</div>
              <div className="camp-brief-body">
                {briefing.lines.map((line, i) => <p key={i}>{line}</p>)}
              </div>
              <div className="camp-brief-actions">
                <button className="camp-brief-skip" onClick={() => dismissBriefing(false)} data-testid="camp-briefing-skip">Look around first</button>
                <button className="camp-brief-go" onClick={() => dismissBriefing(true)} data-testid="camp-briefing-go">{briefing.cta}</button>
              </div>
            </div>
          </div>,
          document.body
        )}
        {unlockShown && (() => {
          const shown = typeof unlockShown === 'string' ? { type: 'tab', id: unlockShown } : unlockShown;
          const meta = shown.type === 'move'
            ? shown
            : { type: 'tab', id: shown.id, ...(CAMP_TAB_META[shown.id] || {}) };
          const bannerId = shown.id || 'unlock';
          return createPortal(
            <div className="camp-unlock-banner" key={bannerId} data-testid="camp-unlock-banner" data-unlock-id={bannerId}>
              {/* Rotating light rays + two shockwave rings behind the logo.
                  The old banner scaled everything in at once, which read as
                  a single pop; staggering the parts (rays → rings → logo →
                  word → name) is what turns it into an EVENT. Purely
                  decorative, so aria-hidden and never blocking the pointer. */}
              <div className="cub-burst" aria-hidden>
                <span className="cub-rays" />
                <span className="cub-ring" />
                <span className="cub-ring cub-ring2" />
              </div>
              <div className="cub-tag">UNLOCKED</div>
              <div className="cub-icon"><GameIcon name={meta.icon || 'ui_lock'} size={110} /></div>
              <div className="cub-name">{meta.name || meta.label || bannerId}</div>
              <div className="cub-sub">{meta.sub || (shown.type === 'move' ? meta.how : 'NEW MENU AVAILABLE')}</div>
            </div>,
            document.body
          );
        })()}
        <div className="camp-sidebar">
          <div className="camp-profile-bar camp-profile-bar-framed cp-plaque" ref={profileBarRef}>
            {/* ── THE HOLO PORT ────────────────────────────────────────────
                Timmy's reference puts a big lit orb on a pedestal where the
                camp had a 44px ring with a 22px icon in it. That size gap is
                the whole difference between "a profile row" and "a profile".

                Built as the six-layer glass stack from `waterdrop-svg-materials`
                — halo, body, inner volume, bezel, icon, specular — because a
                single radial gradient always reads flat. The two details that
                actually sell it: the body gradient's LAST stop goes back UP in
                brightness (rim bounce, the one cue that says glass rather than
                paint), and there are TWO speculars of different sizes, big and
                soft upper-left, small and sharp lower-right.

                It is a <button>, not a clickable <div>: it is the way into the
                profile sheet, and this menu is going on Steam eventually, where
                a div is unreachable without a mouse. */}
            <div className="cp-top">
              <button
                className="cp-port"
                onClick={() => { Audio.click(); setProfileOpen(true); }}
                data-testid="camp-profile-open"
                aria-label="Open profile"
                style={{
                  '--frame-css': PROFILE_FRAMES.find(f => f.id === save.profile.frame)?.css || 'none',
                  '--frame-glow': PROFILE_FRAMES.find(f => f.id === save.profile.frame)?.glow || 'none',
                }}>
                <span className="cp-port-halo" aria-hidden />
                <span className="cp-port-bezel" aria-hidden />
                <span className="cp-port-glass" aria-hidden />
                <span className="cp-port-vol" aria-hidden />
                <span className="cp-port-icon"><GameIcon name={avatar.icon} size={38} /></span>
                <span className="cp-port-spec" aria-hidden />
                <span className="cp-port-pin" aria-hidden />
                <span className="cp-port-scan" aria-hidden />
              </button>
              <span className="cp-plinth" aria-hidden />
              <div className="cp-id">
                <div className="cp-name" style={{
                  color: (() => { const nc = NAME_COLORS.find(c => c.id === save.profile.nameColor); return nc && nc.color !== 'rainbow' ? nc.color : 'var(--ink)'; })(),
                }}>{save.profile.name || 'Wanderer'}</div>
                <div className="cp-rank">{RANK_TITLES[getRank(save.profile.level)]} · Lv {save.profile.level}</div>
                {/* Progress against the REAL threshold, not a hardcoded 200.
                    accountXpToNext() is 60 * 1.18^level — 70 XP at level 1,
                    not 200 — so this bar was showing 60/200 (30%) when the
                    player was actually at 60/70 (86%) and one run from a
                    level. It made profile progression look roughly three
                    times slower than it is, which is why levelling up (and
                    therefore the rank-up screen) seemed never to happen. */}
                {(() => {
                  const need = accountXpToNext(save.profile?.level || 1);
                  const have = Math.min(save.profile?.xp || 0, need);
                  return (
                    // The medallion cannot live INSIDE .camp-rank-bar: that bar
                    // carries a chamfer clip-path, and a clip-path clips its
                    // children, so anything riding the fill edge would be sliced
                    // off at the track. The wrapper exists purely to give it an
                    // unclipped positioning context. --xp-pct is where the fill
                    // currently ends, so the medallion marks real progress rather
                    // than sitting decoratively at the centre.
                    <div className="cp-xp-wrap" style={{ '--xp-pct': `${(have / need) * 100}%` }}>
                      <div className="camp-rank-bar" data-testid="camp-rank-progress">
                        <div className="camp-rank-fill" style={{ width: `${(have / need) * 100}%` }} />
                        <span className="camp-rank-bar-label">{have}/{need}</span>
                      </div>
                      <span className="cp-xp-medal" aria-hidden>XP</span>
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* ── BADGE SHELF ──────────────────────────────────────────────
                Out of the identity stack and onto its own full-width shelf.
                Squeezed in beside the name they were 22px trinkets; given the
                whole plaque width they become a trophy rail, which is what
                they are for.

                FIVE slots, and that number is not a layout choice — it is
                `MAX_EQUIPPED_BADGES` in game/badges.js, which already reads 5.
                Timmy on the reference: "de ska va 5 eller 3 badges inte 10 som
                på bilden". The picture shows ten; the code was already right.
                Recounted from source rather than trusted: 24 badges exist, 5
                can be worn. */}
            <div className="cp-shelf">
              <span className="cp-shelf-lbl">BADGES</span>
              <BadgeSlots save={save} size={24}
                onOpen={(e) => { e?.stopPropagation?.(); Audio.click(); setBadgeOpen(true); }} />
            </div>
            {/* Currencies in a GRID, not a scrolling strip.
                Seven chips at `flex: 1 1 0` in a 240px rail gave each one ~30px
                — which is how "2:", "1", "1" happened: the value was clipped and
                the row scrolled sideways to hide it. A grid gives every chip the
                same generous cell, wraps predictably, and nothing is ever
                off-screen. The reference does exactly this: two tidy rows, not
                one crushed one. */}
            <div className="camp-currency-row cp-cur">
              {/* Drawn icons, not emoji. The row used to be ★ 💎 🎰 🌿 ◆ 🎫 🔑
                  — seven unrelated art styles that render differently on every
                  phone, and 💎/🔷 and 🎰/🎫 read as the same thing at this
                  size, so you could not tell what you had without counting. */}
              <span className="camp-currency-chip"><GameIcon name="cur_gold" size={18} /> <CountUp value={save.gold} /></span>
              <span className="camp-currency-chip" style={{ color: '#4dffd4' }}><GameIcon name="cur_gems" size={18} /> <CountUp value={save.gems || 0} /></span>
              <span className="camp-currency-chip" style={{ color: '#ffcc00' }}><GameIcon name="cur_slot" size={18} /> <CountUp value={save.slotCoins || 0} /></span>
              <span className="camp-currency-chip" style={{ color: '#7ad96b' }}><GameIcon name="cur_tp" size={18} /> <CountUp value={save.talentPoints || 0} /></span>
              <span className="camp-currency-chip" style={{ color: '#ffb02e' }} data-testid="chip-combo-points">
                <GameIcon name="cur_cp" size={18} /> <CountUp value={save.comboPoints || 0} />
              </span>
              <span className="camp-currency-chip" style={{ color: '#8fe6ff' }}><GameIcon name="cur_sp" size={18} /> <CountUp value={save.sp} /></span>
              <span className="camp-currency-chip" style={{ color: '#ff9933' }}><GameIcon name="cur_token" size={18} /> <CountUp value={save.gachaTokens || 0} /></span>
              {/* Probe Keys gate Lootmine dives. Shown here with everything
                  else so the player can see they have one WITHOUT opening the
                  mine to find out — a gated mode you can only check from
                  inside is a mode you forget exists. */}
              <span className="camp-currency-chip" style={{ color: '#e0c98a' }} data-testid="chip-probe-keys">
                <GameIcon name="cur_key" size={18} /> <CountUp value={save.probeKeys || 0} />
              </span>
            </div>
            <button
              className={`camp-attr-toggle ${attrOpen ? 'open' : ''} ${attrFreePts > 0 ? 'camp-attr-pulse' : ''}`}
              data-testid="camp-attr-points" onClick={() => setAttrOpen(o => !o)}>
              <GameIcon name="ui_bolt" size={15} /> {attrFreePts} ATTR <span className="camp-attr-caret">{attrOpen ? '▲' : '▼'}</span>
            </button>

            {/* Third attempt at this panel, and the first two both failed for
                the same underlying reason despite trying opposite fixes.
                Absolute-dropdown and in-flow-block got clipped by
                .camp-sidebar's overflow:hidden. Plain position:fixed (attempt
                two) escapes that clip, but NOT the real cause: .camp-sidebar
                is a flex item with z-index:1, which makes it establish its
                own stacking context — and position:fixed does not exempt a
                descendant from its nearest ancestor's stacking context, only
                from normal layout/clipping. .camp-main is a SIBLING flex item
                with the same z-index:1 but later in DOM, so it paints over
                the ENTIRE .camp-sidebar stacking context, panel included, no
                matter how high the panel's own z-index is set — a z-index
                only wins fights against siblings within its own stacking
                context, and .camp-main was never in this one.
                The fix is to not be a descendant of .camp-sidebar at all:
                render straight into document.body via a portal, so no
                ancestor's stacking context (now or from any future CSS
                change in the sidebar) can trap it again. */}
            {attrOpen && createPortal(
              <>
                {/* The panel had no way out at all: portalled to <body> with no
                    close button, no backdrop and no Escape, while covering the
                    ATTR toggle that opened it. On a phone that is a dead end
                    — the only escape was reloading the page. Three exits now,
                    because on touch there is no Escape key and no hover. */}
                <div
                  className="camp-attr-backdrop"
                  data-testid="camp-attr-backdrop"
                  onClick={() => setAttrOpen(false)}
                  aria-hidden
                />
                <div className="camp-attr-panel" data-testid="camp-attr-dropdown" style={attrPanelStyle}>
                <div className="char-attr-header">
                  <span><GameIcon name="ui_bolt" size={14} /> ATTRIBUTES</span>
                  <span className={`char-attr-free ${attrFreePts > 0 ? 'has' : ''}`}>{attrFreePts} pt{attrFreePts === 1 ? '' : 's'} free</span>
                  <button
                    className="camp-attr-close"
                    onClick={() => setAttrOpen(false)}
                    data-testid="camp-attr-close"
                    aria-label="Close attributes"
                  >✕</button>
                </div>
                <div className="char-attr-desc">One point per profile rank. Permanent. Spend them — they do nothing in the bank.</div>
                <div className="poe-attr-grid">
                  {POE_ATTRS.map(a => {
                    const cur = (save.attrs || {})[a.id] || 0;
                    const canAdd = attrCanAdd(save, a);
                    const cap = a.curve ? a.max : Math.max(12, cur + Math.max(attrFreePts, 1));
                    const pct = Math.max(0, Math.min(100, (cur / cap) * 100));
                    return (
                      <div key={a.id} className="poe-attr-row" data-testid={`attr-${a.id}`}>
                        <span className="poe-attr-icon" style={{ color: a.color }}><GameIcon name={a.icon} size={18} tone={a.color} /></span>
                        <div className="poe-attr-info">
                          <span className="poe-attr-name">{a.name}{a.curve ? ` (${cur}/${a.max})` : ''}</span>
                          <span className="poe-attr-desc2">{a.desc}</span>
                          <span className="poe-attr-next">{attrNextLine(a, cur)}</span>
                          <span className="poe-attr-track" aria-hidden><i style={{ width: `${pct}%`, background: a.color }} /></span>
                        </div>
                        <div className="poe-attr-ctl">
                          <span className="poe-attr-val">{cur}</span>
                          <button className={`poe-attr-add ${canAdd ? '' : 'disabled'}`} onClick={() => buyAttr(a.id)}
                            disabled={!canAdd} data-testid={`attr-add-${a.id}`}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </>,
              document.body
            )}
          </div>
          <div className="camp-scroll-hint">↓ scroll for more ↓</div>
          <div className="camp-tabs-scroll">
            {/* The story is the default way to play, so it gets a real
                call-to-action rather than being one tab among fifteen. */}
            {storyNode && (
              <button className="camp-story-btn" onClick={followStory} data-testid="continue-story">
                <span className="camp-story-kicker">{beat.kicker || 'CONTINUE STORY'}</span>
                <span className="camp-story-node"><GameIcon name={storyNode.mapIcon} size={13} /> {beat.label || `${storyNode.mapName} — ${storyNode.name}`}</span>
                <span className="camp-story-go">▸</span>
              </button>
            )}
              {/* MOVED OUT OF .camp-main, 2026-08-23. The reference puts the
                  campaign's own sections in the LEFT RAIL, directly under
                  CONTINUE STORY - not as a strip floating above the panel
                  content. That strip was also where the "giant violet STORY
                  banner" came from: one unlocked tab in a `flex: 1 1 auto`
                  row grows to fill the whole width. As rail rows they are
                  always the rail's width, so the bug cannot come back. */}
              {tab === 'campaign' && (
                <div className="gear-tabs camp-subnav">
                  <button className={`gear-tab ${campaignSub === 'campaign' ? 'active' : ''}`} onClick={() => { Audio.click(); setCampaignSub('campaign'); }} data-testid="tab-campaign-story" style={{ position: 'relative' }}><GameIcon name="ui_scroll" size={14} /> STORY {campaignQuestNew && <ClaimBadge />}</button>
                  {/* MAPS, MISSIONS and CHALLENGES stay OUT of the bar until the
                      camp has been built up twice — not dimmed, absent, the same
                      rule the main tab rail follows. A new player gets exactly one
                      door. MAPS is also the way into free play, so hiding it is
                      what keeps Endless shut until we open it deliberately. */}
                  {!isCampSubTabLocked('maps', save) && (
                    <button className={`gear-tab ${campaignSub === 'maps' ? 'active' : ''}`} onClick={() => { Audio.click(); setCampaignSub('maps'); }} data-testid="tab-maps"><GameIcon name="ui_map" size={14} /> MAPS</button>
                  )}
                  {!isCampSubTabLocked('missions', save) && (
                    <button className={`gear-tab ${campaignSub === 'missions' ? 'active' : ''}`} onClick={() => { Audio.click(); setCampaignSub('missions'); }} data-testid="tab-missions" style={{ position: 'relative' }}><GameIcon name="ui_scroll" size={14} /> MISSIONS {pathReady && <ClaimBadge />}</button>
                  )}
                  {!isCampSubTabLocked('challenges', save) && (
                    <button className={`gear-tab ${campaignSub === 'challenges' ? 'active' : ''}`} onClick={() => { Audio.click(); setCampaignSub('challenges'); }} data-testid="tab-challenges"><GameIcon name="ui_trophy" size={14} /> CHALLENGES</button>
                  )}
                </div>
              )}
            <button ref={firstTabRef} className={`camp-tab ${tab==='campaign'?'active':''}`} onClick={() => goTab('campaign')} data-testid="tab-campaign" style={{position:'relative'}}><GameIcon name="ui_scroll" size={15} /> CAMPAIGN {(pathReady || campaignQuestNew) && <ClaimBadge/>}</button>
            <button className={`camp-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => goTab('stats')} data-testid="tab-stats"><GameIcon name="ui_chart" size={15} /> STATS</button>
            {/* THE BASE is the one tab that's always PRESENT — dimmed until
                pond_1 clears, per Timmy: "bara base ska finnas där ... även
                den va greyed out först". Every other gated tab below is
                fully absent from the bar (not dimmed) until its unlock
                batch fires, so the early tab bar reads as "one thing to do"
                rather than a wall of locks. */}
            <button
              {...(lockedProps('base') || { className: `camp-tab${!isStationRepaired(save) ? ' camp-attr-pulse' : ''}` })}
              onClick={lockGuard('base', () => { Audio.click(); setStationOpen(true); })}
              data-testid="tab-base"
            >
              <GameIcon name={isCampTabLocked('base', save) ? 'ui_lock' : 'ui_base'} size={15} /> THE BASE
            </button>
            {!isCampTabLocked('starraid', save) && (
              <button className={`camp-tab ${tab === 'starraid' ? 'active' : ''}`} onClick={() => goTab('starraid')} data-testid="tab-starraid"><GameIcon name="ui_rocket" size={15} /> STAR RAID</button>
            )}
            {!isCampTabLocked('prospector', save) && (
              <button className="camp-tab" onClick={tapOpen(setProspectorOpen)} data-testid="tab-prospector"><GameIcon name="ui_pickaxe" size={15} /> LOOTMINE</button>
            )}
            {!isCampTabLocked('clicker', save) && (
              <button className="camp-tab" onClick={tapOpen(setClickerOpen)} data-testid="tab-clicker" style={{ position: 'relative' }}>
                <GameIcon name="ui_waterdrop" size={15} /> THE WELL {clickerReady > 0 && <ClaimBadge />}
              </button>
            )}
            <div className="camp-tab-divider" />
            {!isCampTabLocked('character', save) && (
              <button className="camp-tab" onClick={tapOpen(setCharacterOpen)} data-testid="tab-character"><GameIcon name="ui_character" size={15} /> CHARACTER</button>
            )}
            {!isCampTabLocked('pets', save) && (
              <button className="camp-tab" onClick={tapOpen(setPetOpen)} data-testid="tab-pets"><GameIcon name="ui_pets" size={15} /> PETS</button>
            )}
            {!isCampTabLocked('talent', save) && (
              <button className="camp-tab" onClick={tapOpen(setTalentOpen)} data-testid="tab-talent"><GameIcon name="ui_leaf" size={15} /> TALENTS</button>
            )}
            {!isCampTabLocked('skills', save) && (
              <button className="camp-tab" onClick={tapOpen(setSkillOpen)} data-testid="open-skills"><GameIcon name="ui_skills" size={15} /> SKILLS</button>
            )}
            {!isCampTabLocked('cards', save) && (
              <button className={`camp-tab ${tab==='cards'?'active':''}`} onClick={() => goTab('cards')} data-testid="tab-cards"><GameIcon name="ui_gem" size={15} /> META</button>
            )}
            {!isCampTabLocked('gear', save) && (
              <button className={`camp-tab ${tab==='gear'?'active':''}`} onClick={() => goTab('gear')} data-testid="tab-gear"><GameIcon name="gear" size={15} /> GEAR</button>
            )}
            {!isCampTabLocked('pass', save) && (
              <button className={`camp-tab ${tab==='pass'?'active':''}`} style={{position:'relative'}} onClick={() => goTab('pass')} data-testid="tab-pass"><GameIcon name="ui_medal" size={15} /> SEASON PASS {passNew && <ClaimBadge/>}</button>
            )}
            {!isCampTabLocked('patrol', save) && (
              <button className={`camp-tab ${tab==='patrol'?'active':''}`} style={{position:'relative'}} onClick={() => goTab('patrol')} data-testid="tab-patrol"><GameIcon name="ui_map" size={15} /> PATROL {patrolNew && <ClaimBadge/>}</button>
            )}
            {!isCampTabLocked('codex', save) && (
              <button className={`camp-tab ${tab==='codex'?'active':''}`} style={{position:'relative'}} onClick={() => goTab('codex')} data-testid="tab-codex"><GameIcon name="ui_codex" size={15} /> CODEX {(codexNew || achNew || milestonesNew) && <ClaimBadge/>}</button>
            )}
            <div className="camp-tab-divider" />
            {!isCampTabLocked('shop', save) && (
              <button className="camp-tab" onClick={tapOpen(setShopOpen)} data-testid="open-card-shop"><GameIcon name="ui_token" size={15} /> CARD SHOP</button>
            )}
            {!isCampTabLocked('forge', save) && (
              <button className="camp-tab" onClick={tapOpen(setForgeOpen)} data-testid="open-forge"><GameIcon name="ui_smith" size={15} /> SMITH</button>
            )}
            {!isCampTabLocked('chest', save) && (
              <button className="camp-tab" onClick={tapOpen(setChestOpen)} data-testid="open-chest"><GameIcon name="ui_chest" size={15} /> CHESTS</button>
            )}
            {!isCampTabLocked('loadout', save) && (
              <button className="camp-tab" onClick={tapOpen(setLoadoutOpen)} data-testid="open-loadout"><GameIcon name="ui_loadout" size={15} /> LOADOUT</button>
            )}
            <button className="camp-tab" onClick={tapOpen(setSettingsOpen)} data-testid="open-settings"><GameIcon name="ui_cog" size={15} /> SETTINGS</button>
            <button
              className="camp-tab"
              onClick={() => { setStudioOpen(true); Audio.click?.(); }}
              data-testid="open-asset-studio"
              style={{
                background: '#190c2e', border: '1px solid #ffd166', color: '#ffd166',
                boxShadow: '0 0 10px rgba(255, 209, 102, 0.25)', fontWeight: 'bold'
              }}
            >
              🎨 ASSET STUDIO (5 STYLES)
            </button>
          </div>
        </div>

        <div className="camp-main">
          {/* Active Story Quests Section (Reference Image 2) */}
          <div className="camp-top-grid full-width">
            <QuestTracker save={save} onGo={pathGo} />
            <WhatsOnStrip save={save} onGo={pathGo} />
          </div>
          {tab === 'cards' && (
            <>
              <div className="camp-header">
                <h1>Forge Your Edge</h1>
                <div className="camp-currency">
                  <span className="gold" data-testid="camp-gold">★ {save.gold}</span>
                  <span className="essence">◆ {save.sp} SP</span>
                </div>
              </div>
              <div className="upgrade-grid">
                {META_UPGRADES.map(upg => {
                  const lvl = save.meta[upg.id] || 0;
                  const maxed = lvl >= upg.max;
                  const cost = maxed ? null : metaCost(upg, lvl);
                  const canAfford = !maxed && save.gold >= cost;
                  const reqNodeId = META_UNLOCK_REQS[upg.id];
                  const isLocked = reqNodeId && !(save.skills?.[reqNodeId] >= 1);
                  const reqNodeName = isLocked ? (POE_INDEX[reqNodeId]?.name || reqNodeId) : null;
                  return (
                    <div className={`upgrade-card ${maxed ? 'maxed' : ''} ${isLocked ? 'meta-locked' : ''} ${popCard === upg.id ? 'card-pop' : ''}`} key={upg.id} data-testid={`meta-${upg.id}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="name"><GameIcon name={upg.icon} size={15} /> {upg.name}</div>
                        <div className="lvl">{lvl}/{upg.max}</div>
                      </div>
                      {upg.max > 20 ? (
                        /* Classed rather than inline-styled so the track, the
                           fill and the slider knob at the fill's leading edge
                           can be styled together — an inline `overflow:hidden`
                           would have clipped the knob off, and inline styles
                           can't be overridden from the sheet without
                           !important everywhere. Only the dynamic width and
                           the state colour stay inline. */
                        <div className={`upg-bar${maxed ? ' is-max' : ''}${isLocked ? ' is-locked' : ''}`}>
                          <div className="upg-bar-fill"
                            style={{ width: `${(lvl / upg.max) * 100}%`,
                                     background: maxed ? '#ffd700' : isLocked ? '#3a2a5e' : 'var(--rune)' }} />
                        </div>
                      ) : (
                        <div className="pips">
                          {Array.from({ length: upg.max }, (_, i) => {
                            const on = i < lvl;
                            const mark = metaMarkName(upg.id, i + 1);
                            return <span key={i} className={'pip ' + (on ? 'on' : '') + (mark ? ' pip-mark' : '')} title={mark || undefined} />;
                          })}
                        </div>
                      )}
                      <div className="desc">{upg.desc}</div>
                      {isLocked ? (
                        <div className="meta-lock-msg" data-testid={`meta-lock-${upg.id}`}>
                          <GameIcon name="ui_lock" size={13} /> Unlock in Skill Tree: <em>{reqNodeName}</em>
                        </div>
                      ) : maxed ? (
                        <div style={{ color: 'var(--accent-2)', fontFamily: 'VT323', letterSpacing: '0.2em' }}>MAX</div>
                      ) : (
                        <button onClick={(e) => buy(upg, e)} disabled={!canAfford} data-testid={`buy-${upg.id}`}>★ {cost}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'campaign' && (
            <>
              {campaignSub === 'campaign' && <CampaignPanel save={save} setSave={setSave} beat={beat} onFollow={followStory} />}
              {campaignSub === 'maps' && !isCampSubTabLocked('maps', save) && <MapsPanel save={save} setSave={setSave} onStart={(cfg) => onMission(cfg)} />}
              {/* THE PATH lives under MISSIONS, not STORY. It is a chain of
                  claimable objectives with rewards — the same kind of thing
                  MissionsPanel lists — so having it sit on the STORY tab
                  meant the player had claims in two unrelated places and no
                  reason to expect it. STORY is now just the node map. */}
              {campaignSub === 'missions' && !isCampSubTabLocked('missions', save) && <PathPanel save={save} setSave={setSave} onGo={pathGo} />}
              {campaignSub === 'missions' && !isCampSubTabLocked('missions', save) && <MissionsPanel save={save} setSave={setSave} onStart={onMission} />}
              {campaignSub === 'challenges' && !isCampSubTabLocked('challenges', save) && <ChallengesPanel save={save} setSave={setSave} onStart={(c) => onMission({ ...c, isChallenge: true })} />}
            </>
          )}

          {tab === 'patrol' && (
            <>
              <div className="camp-header"><h1>Patrol</h1><div className="camp-header-sub">Send on missions while you're away · Active pet gives +20% reward</div></div>
              <button className="expl-launch" onClick={() => setExplorationOpen(true)} data-testid="explore-launch">
                <GameIcon name="ui_compass" size={15} /> EXPLORE — a short, active walk. Loot, a fight, and one trainer worth wagering on.
              </button>
              <PatrolPanel save={save} setSave={setSave} />
            </>
          )}

          {tab === 'starraid' && (
            <>
              <div className="camp-header"><h1>Star Raid</h1><div className="camp-header-sub">One-thumb space raid — earn Scrap for ship upgrades and Gacha Tokens for artifacts</div></div>
              <div style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><GameIcon name="ui_rocket" size={48} /></div>
                <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', marginBottom: 16 }}>
                  Fly, autofire, and dodge through 3 stages. Clear the final stage for a Gacha Token.
                </div>
                <button className="go-btn go-btn-retry" onClick={onStarRaid} data-testid="starraid-launch-camp"><GameIcon name="ui_rocket" size={15} /> LAUNCH STAR RAID</button>
              </div>
            </>
          )}

          {tab === 'gear' && (
            <>
              <div className="camp-header"><h1>EQUIPMENT</h1><div className="camp-header-sub">FUSE DUPLICATE ITEMS INTO HIGHER RARITY</div></div>
              <GearPanel save={save} setSave={setSave} onFight={onStart} onBack={onBack} />
            </>
          )}

          {tab === 'pass' && (
            <>
              <div className="camp-header"><h1>Season Pass</h1><div className="camp-header-sub">Earn XP from runs · Claim rewards as you level</div></div>
              <BattlePassPanel save={save} setSave={setSave} />
            </>
          )}

          {tab === 'codex' && (
            <>
              <div className="gear-tabs" style={{ marginBottom: 12 }}>
                <button className={`gear-tab ${codexSub === 'codex' ? 'active' : ''}`} onClick={() => setCodexSub('codex')} data-testid="tab-codex-sub" style={{ position: 'relative' }}><GameIcon name="ui_codex" size={14} /> CODEX {codexNew && <ClaimBadge />}</button>
                <button className={`gear-tab ${codexSub === 'achievements' ? 'active' : ''}`} onClick={() => setCodexSub('achievements')} data-testid="tab-ach" style={{ position: 'relative' }}><GameIcon name="ui_medal" size={14} /> ACHIEVEMENTS {achNew && <ClaimBadge />}</button>
                <button className={`gear-tab ${codexSub === 'milestones' ? 'active' : ''}`} onClick={() => setCodexSub('milestones')} data-testid="tab-milestones" style={{ position: 'relative' }}><GameIcon name="ui_star" size={14} /> MILESTONES {milestonesNew && <ClaimBadge />}</button>
              </div>
              {codexSub === 'codex' && (<>
                <div className="camp-header"><h1>Codex</h1><div className="camp-header-sub">Discover enemies, weapons, and lore</div></div>
                <CodexPanel save={save} setSave={setSave} />
              </>)}
              {codexSub === 'achievements' && <AchievementsPanel save={save} setSave={setSave} />}
              {codexSub === 'milestones' && (
                <>
                  <div className="camp-header"><h1>Milestones</h1></div>
                  <div className="upgrade-grid">
                    {MILESTONES.map(m => {
                      const val = save[m.metric] || 0;
                      const pct = Math.min(100, (val / m.goal) * 100);
                      const done = val >= m.goal;
                      const claimed = save.milestones.claimed[m.id];
                      return (
                        <div className="upgrade-card" key={m.id} data-testid={`ms-${m.id}`}>
                          <div className="name"><GameIcon name="ui_trophy" size={14} /> {m.name}</div>
                          <div className="desc">{m.desc}</div>
                          <div className="hud-xpbar" style={{ width: '100%' }}><div className="hud-xpbar-fill" style={{ width: pct + '%' }} /></div>
                          <div className="lvl">{Math.min(val, m.goal)} / {m.goal}</div>
                          <div style={{ fontSize: 12, color: 'var(--accent-2)' }}>{m.reward.gold && `★ ${m.reward.gold}`} {m.reward.sp && `◆ ${m.reward.sp} SP`}</div>
                          {claimed ? <div style={{ color: 'var(--rune)' }}>✓ CLAIMED</div> :
                            <button onClick={(e) => claimMilestone(m, e)} disabled={!done}>{done ? '✓ CLAIM' : 'LOCKED'}</button>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'stats' && (
            <>
              <div className="camp-header"><h1>Deep Statistics</h1></div>
              {/* Grouped into named sections rather than one flat run of 22
                  identical cells. The numbers were all there before, but with
                  no hierarchy the screen was a wall — you could not tell a
                  lifetime total from a boss record from a wallet balance
                  without reading every label. Sections give the eye somewhere
                  to land, which is the whole point of the reference sheet. */}
              <div className="stats-sec-h">Global Performance</div>
              <div className="stats-grid">
                <Stat label="Runs Completed" val={save.runsCompleted} />
                <Stat label="Total Kills" val={save.totalKills} />
                <Stat label="Best Run Time" val={fmtTime(save.bestRunTime)} />
                <Stat label="Best Run Level" val={save.bestKills} />
                <Stat label="Endless Mode Reached" val={save.endlessReached || 0} />
                <Stat label="No-Hit Runs" val={save.noHitRuns || 0} />
              </div>

              <div className="stats-sec-h">Enemy Intelligence &amp; Slayings</div>
              <div className="stats-bars" data-testid="stats-boss-bars">
                {(() => {
                  const bosses = [
                    { label: 'A.I.D.A.', val: save.aidaSlain || 0, color: '#4dffd4' },
                    { label: 'Necromancer', val: save.necroSlain || 0, color: '#b362ff' },
                    { label: 'Void Titan', val: save.voidSlain || 0, color: '#7a8cff' },
                    { label: 'Eye of Horus', val: save.horusSlain || 0, color: '#ffd166' },
                  ];
                  const max = Math.max(1, ...bosses.map(b => b.val));
                  return bosses.map(b => (
                    <StatBar key={b.label} label={b.label} val={b.val} max={max} color={b.color} />
                  ));
                })()}
              </div>

              <div className="stats-sec-h">Resources &amp; Progression</div>
              <div className="stats-bars" data-testid="stats-share-bars">
                {(() => {
                  const rows = [
                    { label: 'Runs', val: save.runsCompleted || 0, color: '#4dffd4' },
                    { label: 'Kills', val: save.totalKills || 0, color: '#ff7a1a' },
                    { label: 'Gold', val: save.gold || 0, color: '#ffd166' },
                    { label: 'Chests', val: save.chestsOpened || 0, color: '#b362ff' },
                  ];
                  const max = Math.max(1, ...rows.map(r => r.val));
                  return rows.map(r => (
                    <StatBar key={r.label} label={r.label} val={r.val} max={max} color={r.color} />
                  ));
                })()}
              </div>
              <div className="stats-grid">
                <Stat label="Account Rank" val={save.profile.level} />
                <Stat label="Skill Points" val={save.sp} />
                <Stat label="Gold Hoarded" val={save.gold} />
                <Stat label="Daily Streak" val={(save.daily.streak || 0) + ' days'} />
              </div>

              <div className="stats-sec-h">Arsenal &amp; Collection</div>
              <div className="stats-grid">
                <Stat label="Equipment" val={(save.gearInventory || []).length} />
                <Stat label="Parts" val={(save.parts || []).length} />
                <Stat label="Legendary Parts" val={save.legendaryPartsFound || 0} />
                <Stat label="Weapons Crafted" val={Object.keys(save.craftedWeapons || {}).length} />
                <Stat label="Skills Learned" val={Object.values(save.skills || {}).reduce((a, b) => a + b, 0)} />
                <Stat label="Meta Cards" val={Object.values(save.meta || {}).reduce((a, b) => a + b, 0)} />
                <Stat label="Shop Pulls" val={save.shopPulls || 0} />
                <Stat label="Chests Opened" val={save.chestsOpened || 0} />
              </div>
            </>
          )}

          <div className="camp-actions">
            <button onClick={onBack} data-testid="camp-back">◂ BACK</button>
            <button
              className="camp-weapon-btn"
              onClick={() => { Audio.click(); setForgeOpen(true); }}
              data-testid="camp-start-weapon"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'linear-gradient(180deg, #182230, #0c121a)', borderColor: '#4d88ff' }}
            >
              <GameIcon name={save.startWeapon || 'hydropistol'} size={15} />
              <span>{((WEAPONS[save.startWeapon || 'hydropistol'] || {}).name || 'HYDRO PISTOL').toUpperCase()}</span>
            </button>
            {isEndlessUnlocked(save) && (
              <button onClick={onStart} data-testid="camp-fight"
                style={{ borderColor: '#ff7a1a', boxShadow: 'var(--pixel-edge), 0 6px 0 #000, 0 0 28px #ff7a1a66' }}>▸ ENDLESS</button>
            )}
          </div>
        </div>
        {/* LAST in the DOM on purpose. The vines have to paint OVER the panel
            edge to look like they are growing across it, and `.camp-sidebar` /
            `.camp-main` are both z-index:1 flex items — so painting order, not
            z-index, is what puts this on top reliably. The whole subtree is
            pointer-events:none, so sitting over the content costs nothing. */}
        <CampFrame />
      </div>
      {toast && <div className="toast">{toast}</div>}
      {shopOpen && <CardShopModal save={save} setSave={setSave} onClose={() => setShopOpen(false)} />}
      {skillOpen && <SkillTree save={save} setSave={setSave} onClose={() => setSkillOpen(false)} onMoveUnlock={onMoveUnlock} />}
      {forgeOpen && <Weaponsmith save={save} setSave={setSave} initialSub={forgeSub} onClose={() => setForgeOpen(false)} />}
      {chestOpen && <Shop save={save} setSave={setSave} onClose={() => setChestOpen(false)} />}
      {loadoutOpen && <ActiveLoadoutPanel save={save} setSave={setSave} onClose={() => setLoadoutOpen(false)} />}
      {settingsOpen && <SettingsPanel save={save} setSave={setSave} onClose={() => setSettingsOpen(false)} onReset={handleReset} />}
      {dailyOpen && (
        <div className="modal-overlay" data-testid="camp-daily"
          onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setDailyOpen(false); }}>
          <DailyRewardsWidget save={save} setSave={setSave} />
        </div>
      )}
      {characterOpen && <CharacterPanel save={save} setSave={setSave} onClose={() => setCharacterOpen(false)} />}
      {talentOpen && <TalentTree save={save} setSave={setSave} onClose={() => setTalentOpen(false)} onMoveUnlock={onMoveUnlock} />}
      {petOpen && <PetPanel save={save} setSave={setSave} onClose={() => setPetOpen(false)} onOpenTcg={() => setTcgOpen(true)} />}
      {tcgOpen && <TcgScreen save={save} setSave={setSave} onClose={() => setTcgOpen(false)} />}
      {explorationOpen && <ExplorationScreen save={save} setSave={setSave} onClose={() => setExplorationOpen(false)} />}
      {prospectorOpen && <ProspectorScreen save={save} setSave={setSave} onClose={() => setProspectorOpen(false)} />}
      {clickerOpen && <ClickerScreen save={save} setSave={setSave} onClose={() => setClickerOpen(false)} />}
      {baseOpen && <BasePanel save={save} setSave={setSave} onOpen={enterBuilding} onClose={() => setBaseOpen(false)} onUnlock={queueUnlocks}
                              onWalk={() => { setBaseOpen(false); setStationOpen(true); }} />}
      {/* THE MAIN HALL — the station as a place. Leaving it drops you back
          in the camp tab list. You buy modules by walking up to them here,
          not from a shop list. */}
      {stationOpen && !hangarOpen && !clickerOpen && (
        <StationRoom
          save={save}
          setSave={setSave}
          onOpen={enterBuilding}
          onUnlock={queueUnlocks}
          onGather={() => {
            setStationOpen(false);
            if (save.pendingStationWalk) setSave(s => ({ ...s, pendingStationWalk: false }));
            if (onStory) onStory();
          }}
          onClose={() => {
            setStationOpen(false);
            if (save.pendingStationWalk) setSave(s => ({ ...s, pendingStationWalk: false }));
          }}
        />
      )}
      {hangarOpen && (
        <HangarRoom
          save={save}
          setSave={setSave}
          onUnlock={queueUnlocks}
          onStarRaid={onStarRaid}
          onDefence={() => setDefenceOpen(true)}
          onDrain={() => setDrainOpen(true)}
          escEnabled={!drainOpen}
          onClose={() => { setHangarOpen(false); setStationOpen(true); }}
        />
      )}
      {drainOpen && (
        <DrainScreen save={save} setSave={setSave} onClose={() => setDrainOpen(false)} />
      )}
      {defenceOpen && <BaseDefenceScreen save={save} setSave={setSave} onClose={() => setDefenceOpen(false)} />}
      {profileOpen && <ProfilePanel save={save} setSave={setSave} onClose={() => setProfileOpen(false)} onBadges={() => { setProfileOpen(false); setBadgeOpen(true); }} />}
      {badgeOpen && <BadgePicker save={save} setSave={setSave} onClose={() => setBadgeOpen(false)} />}
      {studioOpen && <AssetStudioModal onClose={() => setStudioOpen(false)} />}
      {/* Waits only for a reveal banner to finish, never for a TAB.
          It used to also require `!isCampTabLocked('cards', save)` — the idea
          being that showing this the instant you walk into camp buries "you got
          talent points + skill points" under a screen you cannot act on yet.
          The cost turned out to be far worse than the benefit: 'cards' needs a
          building bought, the base needed a pond clear, and `pendingLevelUp` is
          a single slot — so a new player levelled, had the payout deferred,
          levelled again, and the first bundle was silently deleted. They never
          received that gold, SP or talent point at all. Timmy, on a fresh save:
          "då får ja inte skillpoint å allt man ska få i level up".
          `addAccountXp` accumulates rather than overwrites now (store.js), so
          nothing is lost either way, and with the base open after one run there
          IS something to act on by the time this can fire. */}
      {save.pendingLevelUp && !unlockShown && unlockQueue.length === 0 && (
        <LevelUpOverlay save={save} onCollect={(e) => {
          const bag = pendingRewardBag(save.pendingLevelUp);
          fireClaimFx(e?.currentTarget, bag, { flyTo: CAMP_CLAIM_FLY });
          setSave((s) => collectPendingLevelUp(s));
          Audio.click('confirm');
        }} />
      )}
    </div>
  );
}

function Stat({ label, val }) {
  return (<div className="stat-cell"><div className="stat-lbl">{label}</div><div className="stat-val">{val}</div></div>);
}
function StatBar({ label, val, max, color }) {
  const pct = Math.max(0, Math.min(100, (val / Math.max(1, max)) * 100));
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-l">{label}</span>
      <span className="stat-bar-track"><i style={{ width: `${pct}%`, background: color }} /></span>
      <span className="stat-bar-n">{val}</span>
    </div>
  );
}
function fmtTime(t) { if (!t) return '00:00'; const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

const _CF = [
  {l:6,d:0,c:'#4dffd4'},{l:14,d:.4,c:'#ffd166'},{l:23,d:.8,c:'#4dc4ff'},
  {l:33,d:.2,c:'#b362ff'},{l:44,d:1.1,c:'#ff8c00'},{l:55,d:.6,c:'#7fe8d0'},
  {l:66,d:1.5,c:'#ffd700'},{l:76,d:.3,c:'#4dffd4'},{l:85,d:.9,c:'#c9f6ff'},
  {l:93,d:.1,c:'#b362ff'},{l:10,d:1.8,c:'#ffd166'},{l:29,d:1.3,c:'#ff8c00'},
  {l:50,d:1.0,c:'#4dc4ff'},{l:70,d:1.7,c:'#7fe8d0'},{l:88,d:.5,c:'#ffd700'},
  {l:19,d:1.4,c:'#4dffd4'},
];

function LevelUpOverlay({ save, onCollect }) {
  const r = save.pendingLevelUp;
  // `AVATARS` is an ARRAY and `profile.avatar` is a string id, so
  // `AVATARS[save.profile.avatar]` was always undefined and this screen has
  // never once shown the player their own avatar — it silently fell through to
  // AVATARS[0] every single time. Line 365 of this same file already does it
  // correctly with `.find()`; this copy did not. That is why the level-up
  // screen looked like a stock water drop no matter what the player had set.
  const av = AVATARS.find(a => a.id === save.profile.avatar) || AVATARS[0];
  const photo = save.profile.photo || null;
  // Did the RANK actually change, or is this "only" a profile level?
  // `fromLevel` is written by addAccountXp; older saves that were created
  // before it existed fall back to r.level - 1, which is right for the
  // single-level case and never claims a false rank-up.
  const newRank = getRank(r.level);
  const prevRank = getRank(Number.isFinite(r.fromLevel) ? r.fromLevel : r.level - 1);
  const isRankUp = newRank > prevRank;
  // How far into the level you're NOW at you already are — read live off
  // `save.profile`, not off `r`, since `r` only knows the level you landed
  // on, not the leftover XP carried into it. This is what the level bar
  // settles on after its fill-and-reset (see `.lu-bar-run` in overhaul.css):
  // Timmy's bug report was that it used to just fill to 100% and stop,
  // which claimed the bar was full/maxed regardless of real progress.
  const nextLvlXp = accountXpToNext(save.profile.level);
  const lvlPct = nextLvlXp > 0 ? Math.max(0, Math.min(1, (save.profile.xp || 0) / nextLvlXp)) : 0;
  // The rising, gritty fanfare is reserved for a real rank-up; a plain level
  // gets the lighter level-up chime, so the two are audibly different beats.
  // Every payout on this screen, in one ordered list rather than nine
  // conditional divs. Building it as data is what lets them be revealed one at
  // a time — you cannot sequence JSX you have already spread across the card.
  const rewards = React.useMemo(() => rewardTiles(r), [r]);
  // Every rank crossed in this uncollected jump — not only the last one.
  // A 19→25 bundle used to skip Bronze Ring (rank 5) because the list
  // keyed on `x.rank === newRank` alone.
  const unlocks = React.useMemo(
    () => rankUnlocksBetween(Number.isFinite(r.fromLevel) ? r.fromLevel : r.level - 1, r.level),
    [r],
  );
  const coming = nextRankPrize(r.level);

  // How many have landed. Each one flies in, lands on the portrait and only
  // then does the next start — "so you see and feel exactly what you get, when
  // you get it" rather than a wall of numbers appearing at once.
  const [shown, setShown] = useState(0);
  const [struck, setStruck] = useState(null);   // the key currently hitting
  const [xpShow, setXpShow] = useState(0);
  const doneAll = shown >= rewards.length;

  useEffect(() => {
    if (isRankUp) Audio.rankUp();
    else Audio.levelUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target = r.xpGained || 0;
    const start = Date.now();
    const dur = 920;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - (1 - t) * (1 - t);
      setXpShow(Math.round(target * eased));
      if (t >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [r.xpGained]);

  // The XP bar rises first, then the rewards land on top of it. Pitch climbs
  // with the fill so the bar is audibly going somewhere. The bar itself now
  // fills to 100%, resets, and fills again to the real carried-over % (see
  // `.lu-bar-run` in overhaul.css) — the second chime marks that second
  // fill settling, so the "dopamine reset" has an audible landing too.
  useEffect(() => {
    const ticks = [];
    for (let i = 0; i < 9; i++) {
      ticks.push(setTimeout(() => Audio.xpTick(i / 8), 120 + i * 82));
    }
    ticks.push(setTimeout(() => Audio.xpArrive(), 120 + 9 * 82));
    ticks.push(setTimeout(() => Audio.xpArrive(), 1850));
    return () => ticks.forEach(clearTimeout);
  }, []);

  // Reward cadence. Starts after the bar has finished so the two beats do not
  // talk over each other.
  useEffect(() => {
    if (doneAll) return undefined;
    const START = 980, GAP = 520;
    const t = setTimeout(() => {
      const item = rewards[shown];
      setStruck(item.key);
      Audio.rewardLand(shown / Math.max(1, rewards.length - 1));
      setShown(s => s + 1);
      setTimeout(() => setStruck(null), 320);
    }, shown === 0 ? START : GAP);
    return () => clearTimeout(t);
  }, [shown, doneAll, rewards]);

  // Let an impatient player skip straight to the end — a reveal you cannot
  // interrupt stops being a reward and becomes a wait.
  const skipOrCollect = (e) => {
    if (!doneAll) { setShown(rewards.length); setStruck(null); return; }
    onCollect(e);
  };

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        skipOrCollect();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        if (doneAll) onCollect();
        else { setShown(rewards.length); setStruck(null); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doneAll, rewards.length, onCollect]);

  return (
    <div className="lu-overlay" data-testid="levelup-overlay" onClick={skipOrCollect}>
      {_CF.map((c,i) => <div key={i} className="lu-confetti" style={{left:`${c.l}%`,animationDelay:`${c.d}s`,background:c.c}} />)}
      <div className="lu-frame" onClick={(e) => e.stopPropagation()}>
      <div className="lu-crest" aria-hidden="true">
        <GameIcon name="ui_waterdrop" size={52} />
      </div>
      <div className="lu-card">
        <div className={`lu-banner${isRankUp ? ' is-rank' : ''}`}>
          <span className="lu-banner-l" aria-hidden="true" />
          <span className="lu-banner-txt">
            {isRankUp ? `PROFILE LEVEL UP — RANK ${newRank} ${RANK_TITLES[newRank]}` : `PROFILE LEVEL UP — LV ${r.level}`}
          </span>
          <span className="lu-banner-r" aria-hidden="true" />
        </div>

        {/* Profile row: portrait beside the name and the bars, exactly as the
            sheets arrange it. Putting the portrait on its own line pushed the
            rewards below the fold on a phone. */}
        <div className="lu-profrow">
        {/* The portrait the rewards are struck onto. A player who uploaded a
            photo sees their photo; otherwise their chosen avatar. Either way
            it is THEIR profile rather than a generic drop. */}
        <div className={`lu-portrait${struck ? ' is-struck' : ''}`}>
          <span className="lu-bezel-outer" aria-hidden="true" />
          <span className="lu-bezel-band" aria-hidden="true" />
          <span className="lu-bezel-fili" aria-hidden="true" />
          <span className="lu-portrait-sheen" aria-hidden="true" />
          {photo
            ? <img className="lu-portrait-img" src={photo} alt="" />
            : <span className="lu-portrait-icon"><GameIcon name={av.icon} size={44} /></span>}
        </div>
        {/* A rank is every 4th profile level, so most level-ups are NOT rank
            ups. Shouting "RANK UP!" every time (and printing the profile
            level where the rank belongs) made the real milestone worthless —
            there was nothing left to escalate to when it actually happened. */}
          <div className="lu-profmeta">
            <div className="lu-profname">{save.profile?.name || 'Local Player'}</div>
            <div className="lu-profrank">
              {RANK_TITLES[newRank]} — Lv {r.level}
            </div>
            {/* Two bars, as in every reference: the rank track above, the
                level track below. One bar cannot show both, and which of the
                two just moved is the whole point of the screen. */}
            <div className="lu-bar rank"><i style={{ width: `${((r.level % 4) / 4) * 100}%` }} /></div>
            <div className="lu-bar lvl"><i className="lu-bar-run" style={{ '--pct': `${lvlPct * 100}%` }} /></div>
            <div className="lu-profxp">+{xpShow} Account XP</div>
          </div>
        </div>

        {/* What is still ahead, kept as one quiet line under the row rather
            than as a heading — it is context, not news. */}
        {coming && (
          <div className="lu-next-rank">
            {coming.levelsLeft} more level{coming.levelsLeft === 1 ? '' : 's'} to RANK {coming.rank} — {coming.title}
            {coming.unlocks.length > 0 ? ` · ${coming.unlocks.map((u) => u.name).join(', ')}` : ''}
          </div>
        )}
        {/* The one currently in flight, drawn OVER the card so it can travel
            from the portrait outward without being clipped by the list. */}
        {struck && (() => {
          const it = rewards.find(x => x.key === struck);
          return it ? (
            <div className="lu-strike lu-strike-glow" style={{ '--rc': it.color }} aria-hidden="true">
              <span className="lu-strike-ring" />
            </div>
          ) : null;
        })()}

        <div className="lu-rwd-head">REWARDS CLAIMED</div>
        <div className="lu-rewards">
          {/* Plaques in a row, as the sheets lay them out — a tile with the
              icon large, the amount under it and a struck checkmark, rather
              than a list of text lines. A row of objects reads as loot; a
              column of sentences reads as a receipt.
              ALL tiles mount immediately (not `.slice(0, shown)`) so the row's
              flex-wrap footprint is fixed from frame one — Timmy: revealing
              them one at a time by mounting each late made `justify-content:
              center` re-centre the whole row (and wrap a new line) on every
              reveal, so the WHOLE CARD visibly hopped each time a reward
              landed instead of just that reward. Unrevealed tiles stay in
              place, invisible and inert, and only animate in on their turn. */}
          {rewards.map((it, i) => (
            <div
              key={it.key}
              className={`lu-tile${i < shown ? ' lu-rwd-in' : ' lu-rwd-pending'}`}
              style={{ '--rc': it.color }}
              data-testid={`lu-rwd-${it.key}`}
            >
              <span className="lu-tile-check" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <path d="M3 8.4l3.2 3.2L13 4.8" fill="none" stroke="#07160c"
                    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="lu-tile-ic"><GameIcon name={it.icon} tone={it.color} size={38} /></span>
              <span className="lu-tile-amt">+{it.amount}</span>
              <span className="lu-tile-lbl">{it.label}</span>
            </div>
          ))}
          {r.streakBonus && doneAll && (
            <div className="lu-rwd lu-streak">
              1.5× STREAK BONUS
              <div className="lu-streak-sub">{r.streakCount || 3} account levels today</div>
            </div>
          )}
        </div>
        {/* Only on a rank-up, and only when the rank actually opened something
            — an empty "NEW UNLOCKS" heading is worse than none. */}
        {unlocks.length > 0 && (
          <div className="lu-unlocks">
            <div className="lu-unlocks-head">NEW FEATURE UNLOCKS!</div>
            {unlocks.map((u, i) => (
              <div className="lu-unlock" key={i} style={{ animationDelay: `${i * 110}ms` }}>
                <span className="lu-unlock-lock" aria-hidden="true"><GameIcon name="ui_lock" size={12} /></span>
                <span className="lu-unlock-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="11" height="11">
                    <path d="M3 8.4l3.2 3.2L13 4.8" fill="none" stroke="#07160c"
                      strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <b>{u.name}</b>
                <i>{u.label} Access</i>
              </div>
            ))}
          </div>
        )}

        <div className="lu-actions">
          <button type="button" className="base-btn lu-back" onClick={(e) => { Audio.click('back'); onCollect(e); }} data-testid="levelup-back">
            BACK TO BASE
          </button>
          <button type="button" className="lu-collect" onClick={skipOrCollect} data-testid="levelup-collect">
            {doneAll ? 'CLAIM & CONTINUE' : 'SKIP'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
