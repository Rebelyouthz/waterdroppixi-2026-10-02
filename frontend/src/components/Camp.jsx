import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { META_UPGRADES, metaCost, WEAPONS } from '../game/data';
import { MILESTONES, AVATARS, CHESTS, rollChest, getRank, RANK_TITLES, PROFILE_FRAMES, NAME_COLORS, HEADBANDS, SHIP_COLORS, CIGAR_UNLOCK_RANK, accountXpToNext } from '../game/data_ext';
import ProfilePanel from './ProfilePanel';
import { META_UNLOCK_REQS, POE_INDEX, POE_ATTRS } from '../game/poe_tree';
import { applyReward, DEFAULT_SAVE, saveLocal } from '../store';
import SkillTree from './SkillTree';
import Weaponsmith from './Weaponsmith';
import Shop from './Shop';
import CharacterPanel from './CharacterPanel';
import TalentTree from './TalentTree';
import CampaignPanel from './CampaignPanel';
import PetPanel from './PetPanel';
import ProspectorScreen from './ProspectorScreen';
import { nextCampaignNode, isCampTabLocked, campUnlockHint, campUnlockStage } from '../game/campaign';
import { currentStep } from '../game/path';
import ClickerScreen from './ClickerScreen';
import BasePanel from './BasePanel';
import BaseDefenceScreen from './BaseDefenceScreen';
import PathPanel from './PathPanel';
import TcgScreen from './TcgScreen';
import ExplorationScreen from './ExplorationScreen';
import { pendingMilestones } from '../game/clicker';
import GearPanel from './GearPanel';
import { BattlePassPanel, CodexPanel, PatrolPanel, EyeBadge } from './MetaFeatures';
import { ACHIEVEMENTS, resolveStartWeapon } from '../game/data_ext2';
import { MissionsPanel, ChallengesPanel, AchievementsPanel, CardShopModal, ActiveLoadoutPanel, SettingsPanel, MapsPanel } from './CampPanels';
import { Audio } from '../game/audio';
import BadgeSlots, { BadgePicker } from './BadgeSlots';
import QuestTracker from './QuestTracker';
import GameIcon from './GameIcon';

// Display name + icon for every tab the unlock cascade can reveal — read by
// both the tab bar (locked tabs are hidden, not dimmed, per Timmy: "bara base
// ska finnas där") and the big reveal banner BasePanel's `onUnlock` triggers.
const CAMP_TAB_META = {
  cards:      { label: 'META UPGRADES', icon: 'ui_gem' },
  skills:     { label: 'SKILLTREE',     icon: 'ui_skills' },
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
  0: {
    kicker: 'SITREP',
    title: 'So. This is the camp.',
    lines: [
      "Half a hull, some crates, and whatever didn't melt on the way down. This is the camp.",
      "Somewhere in that wreck is a black box with a location burned into it. Somebody wrote that down on purpose.",
      "Nirvana to this. There's a joke in there and you're too wet to laugh at it.",
      "Nav array's dead. Lights are dead. Everything here is dead except you, technically.",
      "Fix that first. Bleed on some things, bring back what they drop, get the camp running.",
      "Then go ask your new friends some very pointed questions.",
    ],
    cta: 'FIRST DROPS ▸',
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
};

export default function Camp({ save, setSave, onBack, onStart, onMission, onStory, onStarRaid }) {
  const storyNode = nextCampaignNode(save);
  // Shown once per stage — never re-fires once dismissed for that stage.
  // Never blocks: both buttons dismiss it, one of them just also starts
  // the mission. Old saves may carry the pre-migration boolean
  // `campBriefingSeen: true`; treated as "stage 0 already seen".
  const briefSeen = typeof save.campBriefingSeen === 'object' && save.campBriefingSeen
    ? save.campBriefingSeen
    : (save.campBriefingSeen ? { 0: true } : {});
  const briefStage = campUnlockStage(save);
  const briefing = CAMP_BRIEFINGS[briefStage];
  const showBriefing = !!briefing && !briefSeen[briefStage];
  const dismissBriefing = (thenStory) => {
    setSave({ ...save, campBriefingSeen: { ...briefSeen, [briefStage]: true } });
    if (thenStory && onStory) onStory();
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
  const queueUnlocks = (tabIds) => setUnlockQueue(q => [...q, ...tabIds.filter(id => !q.includes(id))]);
  // Pop the next queued unlock the moment nothing is showing.
  useEffect(() => {
    if (unlockShown || unlockQueue.length === 0) return;
    const [next, ...rest] = unlockQueue;
    setUnlockQueue(rest);
    setUnlockShown(next);
    Audio.claimPing();
  }, [unlockQueue, unlockShown]);
  // Clear the currently-shown one after its dwell. Kept as its OWN effect,
  // keyed only on `unlockShown` — folding this into the pop effect above
  // meant popping the next item (which changes unlockQueue) re-ran that
  // effect, whose cleanup cancelled this very timer before it ever fired,
  // so the banner got stuck on the first unlock forever.
  useEffect(() => {
    if (!unlockShown) return;
    const t = setTimeout(() => setUnlockShown(null), 2200);
    return () => clearTimeout(t);
  }, [unlockShown]);

  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('campaign');
  const [shopOpen, setShopOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [forgeOpen, setForgeOpen] = useState(false);
  // Which Weaponsmith sub-tab to land on. The smith holds three unrelated
  // systems, so "go to the smith" is not a destination on its own — the
  // katana quest sends you to BLUEPRINTS, the tuning steps to TUNING.
  const [forgeSub, setForgeSub] = useState('parts');
  const [chestOpen, setChestOpen] = useState(false);
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popCard, setPopCard] = useState(null);

  const [characterOpen, setCharacterOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);
  const [petOpen, setPetOpen] = useState(false);
  const [tcgOpen, setTcgOpen] = useState(false);
  const [explorationOpen, setExplorationOpen] = useState(false);
  const [prospectorOpen, setProspectorOpen] = useState(false);
  const [clickerOpen, setClickerOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const [defenceOpen, setDefenceOpen] = useState(false);
  // Entering a building opens the system it houses, so the base is the way
  // into everything rather than a sixth place that duplicates them.
  const enterBuilding = (id) => {
    setBaseOpen(false);
    if (id === 'hangar') { onStarRaid && onStarRaid(); return; }
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
      case 'base':     setBaseOpen(true); break;
      case 'defence':  setDefenceOpen(true); break;
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
      // Daily quests live on the Welcome screen, not in the camp — the only
      // honest destination for this step is back out the front door.
      case 'daily':     onBack && onBack(); break;
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
    const freeAttr = Math.max(0, (save.profile?.level || 1) - 1 - Object.values(save.attrs || {}).reduce((a, b) => a + b, 0));
    if (freeAttr <= 0) return;
    const cur = (save.attrs || {})[attrId] || 0;
    setSave({ ...save, attrs: { ...(save.attrs || {}), [attrId]: cur + 1 } });
    Audio.click();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.meta]);

  const claimMilestone = (m) => {
    if (save.milestones.claimed[m.id]) return;
    const val = save[m.metric] || 0;
    if (val < m.goal) return;
    const ns = { ...save, milestones: { ...save.milestones, claimed: { ...save.milestones.claimed, [m.id]: true } } };
    applyReward(ns, m.reward, openChest);
    setSave(ns); Audio.levelUp(); Audio.waterDrop();
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
  const _now = Date.now();
  const _discovered = Object.keys(save.codex?.enemies||{}).length + Object.keys(save.codex?.weapons||{}).length;
  const _claimed    = (save.codex?.claimedDiscoveries||[]).length;
  const codexNew    = _discovered > _claimed;

  const _reached    = Math.floor((save.profile?.xp||0) / 200);
  const _passClaim  = (save.battlePass?.claimed||[]).length;
  const passNew     = _reached > _passClaim;

  const _pMissions  = save.patrol?.missions || [];
  const patrolNew   = _pMissions.some(m => m.status === 'complete' || (m.status === 'active' && _now - m.startMs >= m.durationMs));

  const _achDone    = ACHIEVEMENTS.filter(a => {
    if (a.metric === 'skillsLearned') return Object.values(save.skills||{}).reduce((x,y)=>x+y,0) >= a.goal;
    return (save[a.metric]||0) >= a.goal;
  }).length;
  const _achClaim   = Object.keys(save.achClaimed||{}).length;
  const achNew      = _achDone > _achClaim;

  return (
    <div className="app-shell">
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
        {unlockShown && createPortal(
          <div className="camp-unlock-banner" key={unlockShown} data-testid="camp-unlock-banner">
            <div className="cub-tag">UNLOCKED</div>
            <div className="cub-icon"><GameIcon name={CAMP_TAB_META[unlockShown]?.icon || 'ui_lock'} size={110} /></div>
            <div className="cub-name">{CAMP_TAB_META[unlockShown]?.label || unlockShown}</div>
          </div>,
          document.body
        )}
        <div className="camp-sidebar">
          <div className="camp-profile-bar camp-profile-bar-framed" ref={profileBarRef}>
            <div className="camp-profile-id" onClick={() => setProfileOpen(true)} data-testid="camp-profile-open">
              <span className="camp-avatar-frame" style={{
                '--frame-css': PROFILE_FRAMES.find(f => f.id === save.profile.frame)?.css || 'none',
                boxShadow: PROFILE_FRAMES.find(f => f.id === save.profile.frame)?.glow || 'none',
              }}><span className="camp-avatar-icon"><GameIcon name={avatar.icon} size={22} /></span></span>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 800,
                  color: (() => { const nc = NAME_COLORS.find(c => c.id === save.profile.nameColor); return nc && nc.color !== 'rainbow' ? nc.color : 'var(--ink)'; })(),
                }}>{save.profile.name || 'Wanderer'}</div>
                <div style={{ fontSize: 11, color: 'var(--rune)', letterSpacing: '0.15em' }}>{RANK_TITLES[getRank(save.profile.level)]} · Lv {save.profile.level}</div>
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
                    <div className="camp-rank-bar" data-testid="camp-rank-progress">
                      <div className="camp-rank-fill" style={{ width: `${(have / need) * 100}%` }} />
                      <span className="camp-rank-bar-label">{have}/{need}</span>
                    </div>
                  );
                })()}
                {/* Badges live INSIDE the identity stack, directly under the
                    level bar and left-aligned with the name. As a separate
                    sibling row they were a small centred cluster floating in
                    the middle of the plaque with nothing to align to — which
                    is what read as "weird". Here they are visibly part of the
                    same block as the avatar, name and rank: one profile card,
                    not three stranded rows. */}
                <BadgeSlots save={save} onOpen={(e) => { e?.stopPropagation?.(); Audio.click(); setBadgeOpen(true); }} />
              </div>
            </div>
            {/* All currencies on ONE row — the row scrolls sideways rather
                than wrapping, so the banner keeps a fixed height. */}
            <div className="camp-currency-row">
              {/* Drawn icons, not emoji. The row used to be ★ 💎 🎰 🌿 ◆ 🎫 🔑
                  — seven unrelated art styles that render differently on every
                  phone, and 💎/🔷 and 🎰/🎫 read as the same thing at this
                  size, so you could not tell what you had without counting. */}
              <span className="camp-currency-chip"><GameIcon name="cur_gold" size={18} /> <CountUp value={save.gold} /></span>
              <span className="camp-currency-chip" style={{ color: '#4dffd4' }}><GameIcon name="cur_gems" size={18} /> <CountUp value={save.gems || 0} /></span>
              <span className="camp-currency-chip" style={{ color: '#ffcc00' }}><GameIcon name="cur_slot" size={18} /> <CountUp value={save.slotCoins || 0} /></span>
              <span className="camp-currency-chip" style={{ color: '#7ad96b' }}><GameIcon name="cur_tp" size={18} /> <CountUp value={save.talentPoints || 0} /></span>
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
                <div className="char-attr-desc">Earned 1 per profile level (RANK). Permanent bonuses.</div>
                <div className="poe-attr-grid">
                  {POE_ATTRS.map(a => {
                    const cur = (save.attrs || {})[a.id] || 0;
                    const canAdd = attrFreePts > 0;
                    return (
                      <div key={a.id} className="poe-attr-row" data-testid={`attr-${a.id}`}>
                        <span className="poe-attr-icon" style={{ color: a.color }}><GameIcon name={a.icon} size={18} tone={a.color} /></span>
                        <div className="poe-attr-info">
                          <span className="poe-attr-name">{a.name}{a.curve ? ` (${cur}/${a.max})` : ''}</span>
                          <span className="poe-attr-desc2">{a.desc}</span>
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
              <button className="camp-story-btn" onClick={onStory} data-testid="continue-story">
                <span className="camp-story-kicker">CONTINUE STORY</span>
                <span className="camp-story-node"><GameIcon name={storyNode.mapIcon} size={13} /> {storyNode.mapName} — {storyNode.name}</span>
                <span className="camp-story-go">▸</span>
              </button>
            )}
            <button className={`camp-tab ${tab==='campaign'?'active':''}`} onClick={() => setTab('campaign')} data-testid="tab-campaign" style={{position:'relative'}}><GameIcon name="ui_scroll" size={15} /> CAMPAIGN {pathReady && <EyeBadge/>}</button>
            <button className={`camp-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')} data-testid="tab-stats"><GameIcon name="ui_chart" size={15} /> STATS</button>
            {/* THE BASE is the one tab that's always PRESENT — dimmed until
                pond_1 clears, per Timmy: "bara base ska finnas där ... även
                den va greyed out först". Every other gated tab below is
                fully absent from the bar (not dimmed) until its unlock
                batch fires, so the early tab bar reads as "one thing to do"
                rather than a wall of locks. */}
            <button {...(lockedProps('base') || { className: 'camp-tab' })} onClick={lockGuard('base', () => setBaseOpen(true))} data-testid="tab-base"><GameIcon name={isCampTabLocked('base', save) ? 'ui_lock' : 'ui_base'} size={15} /> THE BASE</button>
            {!isCampTabLocked('starraid', save) && (
              <button className={`camp-tab ${tab === 'starraid' ? 'active' : ''}`} onClick={() => setTab('starraid')} data-testid="tab-starraid"><GameIcon name="ui_rocket" size={15} /> STAR RAID</button>
            )}
            {!isCampTabLocked('prospector', save) && (
              <button className="camp-tab" onClick={() => setProspectorOpen(true)} data-testid="tab-prospector"><GameIcon name="ui_pickaxe" size={15} /> LOOTMINE</button>
            )}
            {!isCampTabLocked('clicker', save) && (
              <button className="camp-tab" onClick={() => setClickerOpen(true)} data-testid="tab-clicker" style={{ position: 'relative' }}>
                <GameIcon name="ui_waterdrop" size={15} /> THE WELL {clickerReady > 0 && <EyeBadge />}
              </button>
            )}
            <div className="camp-tab-divider" />
            {!isCampTabLocked('character', save) && (
              <button className="camp-tab" onClick={() => setCharacterOpen(true)} data-testid="tab-character"><GameIcon name="ui_character" size={15} /> CHARACTER</button>
            )}
            {!isCampTabLocked('pets', save) && (
              <button className="camp-tab" onClick={() => setPetOpen(true)} data-testid="tab-pets"><GameIcon name="ui_pets" size={15} /> PETS</button>
            )}
            {!isCampTabLocked('talent', save) && (
              <button className="camp-tab" onClick={() => setTalentOpen(true)} data-testid="tab-talent"><GameIcon name="ui_leaf" size={15} /> TALENTS</button>
            )}
            {!isCampTabLocked('skills', save) && (
              <button className="camp-tab" onClick={() => setSkillOpen(true)} data-testid="open-skills"><GameIcon name="ui_skills" size={15} /> SKILLS</button>
            )}
            {!isCampTabLocked('cards', save) && (
              <button className={`camp-tab ${tab==='cards'?'active':''}`} onClick={() => setTab('cards')} data-testid="tab-cards"><GameIcon name="ui_gem" size={15} /> META</button>
            )}
            {!isCampTabLocked('gear', save) && (
              <button className={`camp-tab ${tab==='gear'?'active':''}`} onClick={() => setTab('gear')} data-testid="tab-gear"><GameIcon name="gear" size={15} /> GEAR</button>
            )}
            {!isCampTabLocked('pass', save) && (
              <button className={`camp-tab ${tab==='pass'?'active':''}`} style={{position:'relative'}} onClick={() => setTab('pass')} data-testid="tab-pass"><GameIcon name="ui_medal" size={15} /> SEASON PASS {passNew && <EyeBadge/>}</button>
            )}
            {!isCampTabLocked('patrol', save) && (
              <button className={`camp-tab ${tab==='patrol'?'active':''}`} style={{position:'relative'}} onClick={() => setTab('patrol')} data-testid="tab-patrol"><GameIcon name="ui_map" size={15} /> PATROL {patrolNew && <EyeBadge/>}</button>
            )}
            {!isCampTabLocked('codex', save) && (
              <button className={`camp-tab ${tab==='codex'?'active':''}`} style={{position:'relative'}} onClick={() => setTab('codex')} data-testid="tab-codex"><GameIcon name="ui_codex" size={15} /> CODEX {(codexNew || achNew) && <EyeBadge/>}</button>
            )}
            <div className="camp-tab-divider" />
            {!isCampTabLocked('shop', save) && (
              <button className="camp-tab" onClick={() => setShopOpen(true)} data-testid="open-card-shop"><GameIcon name="ui_token" size={15} /> CARD SHOP</button>
            )}
            {!isCampTabLocked('forge', save) && (
              <button className="camp-tab" onClick={() => setForgeOpen(true)} data-testid="open-forge"><GameIcon name="ui_smith" size={15} /> SMITH</button>
            )}
            {!isCampTabLocked('chest', save) && (
              <button className="camp-tab" onClick={() => setChestOpen(true)} data-testid="open-chest"><GameIcon name="ui_chest" size={15} /> CHESTS</button>
            )}
            {!isCampTabLocked('loadout', save) && (
              <button className="camp-tab" onClick={() => setLoadoutOpen(true)} data-testid="open-loadout"><GameIcon name="ui_loadout" size={15} /> LOADOUT</button>
            )}
            <button className="camp-tab" onClick={() => setSettingsOpen(true)} data-testid="open-settings"><GameIcon name="ui_cog" size={15} /> SETTINGS</button>
          </div>
        </div>

        <div className="camp-main">
          {/* The guided chain lives in the scrolling main column, not in the
              sidebar. The sidebar is a fixed-height band on phones and putting
              anything else in it pushed the tab strip out of view entirely —
              and a stub of a tracker that only shows half a row is worse than
              none. Here it gets full width on every screen size. */}
          <QuestTracker save={save} onGo={pathGo} />
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
                          {Array.from({ length: upg.max }, (_, i) => <span key={i} className={'pip ' + (i < lvl ? 'on' : '')} />)}
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
              <div className="gear-tabs" style={{ marginBottom: 12 }}>
                <button className={`gear-tab ${campaignSub === 'campaign' ? 'active' : ''}`} onClick={() => setCampaignSub('campaign')} data-testid="tab-campaign-story"><GameIcon name="ui_scroll" size={14} /> STORY</button>
                <button className={`gear-tab ${campaignSub === 'maps' ? 'active' : ''}`} onClick={() => setCampaignSub('maps')} data-testid="tab-maps"><GameIcon name="ui_map" size={14} /> MAPS</button>
                <button className={`gear-tab ${campaignSub === 'missions' ? 'active' : ''}`} onClick={() => setCampaignSub('missions')} data-testid="tab-missions"><GameIcon name="ui_scroll" size={14} /> MISSIONS</button>
                <button className={`gear-tab ${campaignSub === 'challenges' ? 'active' : ''}`} onClick={() => setCampaignSub('challenges')} data-testid="tab-challenges"><GameIcon name="ui_trophy" size={14} /> CHALLENGES</button>
              </div>
              {campaignSub === 'campaign' && <CampaignPanel save={save} setSave={setSave} />}
              {campaignSub === 'maps' && <MapsPanel save={save} setSave={setSave} onStart={(cfg) => onMission(cfg)} />}
              {/* THE PATH lives under MISSIONS, not STORY. It is a chain of
                  claimable objectives with rewards — the same kind of thing
                  MissionsPanel lists — so having it sit on the STORY tab
                  meant the player had claims in two unrelated places and no
                  reason to expect it. STORY is now just the node map. */}
              {campaignSub === 'missions' && <PathPanel save={save} setSave={setSave} onGo={pathGo} />}
              {campaignSub === 'missions' && <MissionsPanel save={save} setSave={setSave} onStart={onMission} />}
              {campaignSub === 'challenges' && <ChallengesPanel save={save} setSave={setSave} onStart={(c) => onMission({ ...c, isChallenge: true })} />}
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
              <div className="camp-header"><h1>Equipment</h1><div className="camp-header-sub">Find gear in runs · Forge 3 of same into higher rarity</div></div>
              <GearPanel save={save} setSave={setSave} />
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
                <button className={`gear-tab ${codexSub === 'codex' ? 'active' : ''}`} onClick={() => setCodexSub('codex')} data-testid="tab-codex-sub"><GameIcon name="ui_codex" size={14} /> CODEX</button>
                <button className={`gear-tab ${codexSub === 'achievements' ? 'active' : ''}`} onClick={() => setCodexSub('achievements')} data-testid="tab-ach" style={{ position: 'relative' }}><GameIcon name="ui_medal" size={14} /> ACHIEVEMENTS {achNew && <EyeBadge />}</button>
                <button className={`gear-tab ${codexSub === 'milestones' ? 'active' : ''}`} onClick={() => setCodexSub('milestones')} data-testid="tab-milestones">⭐ MILESTONES</button>
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
                            <button onClick={() => claimMilestone(m)} disabled={!done}>{done ? '✓ CLAIM' : 'LOCKED'}</button>}
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
              <div className="stats-grid">
                <Stat label="A.I.D.A. Slain" val={save.aidaSlain} />
                <Stat label="Necromancer Slain" val={save.necroSlain || 0} />
                <Stat label="Void Titan Slain" val={save.voidSlain || 0} />
                <Stat label="Eye of Horus Slain" val={save.horusSlain || 0} />
              </div>

              <div className="stats-sec-h">Resources &amp; Progression</div>
              <div className="stats-grid">
                <Stat label="Account Rank" val={save.profile.level} />
                <Stat label="Skill Points" val={save.sp} />
                <Stat label="Gold Hoarded" val={save.gold} />
                <Stat label="Daily Streak" val={(save.daily.streak || 0) + ' days'} />
              </div>

              <div className="stats-sec-h">Arsenal &amp; Collection</div>
              <div className="stats-grid">
                <Stat label="Equipment" val={(save.inventory || []).length} />
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
            <button onClick={onBack} data-testid="camp-back">◂ Back</button>
            {/* What you are about to walk in carrying, shown at the moment you
                commit. Without this the selection is only visible three taps
                deep in the smith: a player who picks the katana for the story
                quest and forgets would find every later run mysteriously
                gunless and blame the game. Tapping it goes straight back to
                the shelf that sets it. */}
            <button
              className="camp-carry-chip"
              data-testid="camp-carry"
              onClick={() => pathGo('smithBlueprints')}
              title="Change your start weapon"
            >
              <span className="ccc-icon"><GameIcon name={resolveStartWeapon(save)} size={20} /></span>
              <span className="ccc-name">{(WEAPONS[resolveStartWeapon(save)] || {}).name || 'Hydro Pistol'}</span>
            </button>
            <button onClick={onStart} data-testid="camp-fight"
              style={{ borderColor: '#ff7a1a', boxShadow: 'var(--pixel-edge), 0 6px 0 #000, 0 0 28px #ff7a1a66' }}>▸ FIGHT</button>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
      {shopOpen && <CardShopModal save={save} setSave={setSave} onClose={() => setShopOpen(false)} />}
      {skillOpen && <SkillTree save={save} setSave={setSave} onClose={() => setSkillOpen(false)} />}
      {forgeOpen && <Weaponsmith save={save} setSave={setSave} initialSub={forgeSub} onClose={() => setForgeOpen(false)} />}
      {chestOpen && <Shop save={save} setSave={setSave} onClose={() => setChestOpen(false)} />}
      {loadoutOpen && <ActiveLoadoutPanel save={save} setSave={setSave} onClose={() => setLoadoutOpen(false)} />}
      {settingsOpen && <SettingsPanel save={save} setSave={setSave} onClose={() => setSettingsOpen(false)} onReset={handleReset} />}
      {characterOpen && <CharacterPanel save={save} setSave={setSave} onClose={() => setCharacterOpen(false)} />}
      {talentOpen && <TalentTree save={save} setSave={setSave} onClose={() => setTalentOpen(false)} />}
      {petOpen && <PetPanel save={save} setSave={setSave} onClose={() => setPetOpen(false)} onOpenTcg={() => setTcgOpen(true)} />}
      {tcgOpen && <TcgScreen save={save} setSave={setSave} onClose={() => setTcgOpen(false)} />}
      {explorationOpen && <ExplorationScreen save={save} setSave={setSave} onClose={() => setExplorationOpen(false)} />}
      {prospectorOpen && <ProspectorScreen save={save} setSave={setSave} onClose={() => setProspectorOpen(false)} />}
      {clickerOpen && <ClickerScreen save={save} setSave={setSave} onClose={() => setClickerOpen(false)} />}
      {baseOpen && <BasePanel save={save} setSave={setSave} onOpen={enterBuilding} onClose={() => setBaseOpen(false)} onUnlock={queueUnlocks} />}
      {defenceOpen && <BaseDefenceScreen save={save} setSave={setSave} onClose={() => setDefenceOpen(false)} />}
      {profileOpen && <ProfilePanel save={save} setSave={setSave} onClose={() => setProfileOpen(false)} onBadges={() => { setProfileOpen(false); setBadgeOpen(true); }} />}
      {badgeOpen && <BadgePicker save={save} setSave={setSave} onClose={() => setBadgeOpen(false)} />}
      {/* Held back until the base's first unlock batch (Meta/Skilltree/
          Talents) has actually revealed — Timmy: showing this the instant
          you walk into camp buries "you got talent points + skill points"
          under a screen you can't act on yet. Once 'cards' (the first batch)
          is open and no reveal banner is mid-flight, it shows normally —
          for every level-up past the bootstrap window this is always true,
          so ordinary play is unaffected. */}
      {save.pendingLevelUp && !isCampTabLocked('cards', save) && !unlockShown && unlockQueue.length === 0 && (
        <LevelUpOverlay save={save} onCollect={() => {
          const r = save.pendingLevelUp;
          const char = save.character || DEFAULT_SAVE.character;
          setSave({
            ...save,
            pendingLevelUp: null,
            gold: (save.gold || 0) + r.gold,
            sp:   (save.sp   || 0) + r.sp,
            gems: (save.gems || 0) + (r.gems || 0),
            slotCoins: (save.slotCoins || 0) + (r.slotCoins || 0),
            talentPoints: (save.talentPoints || 0) + (r.talentPoints || 0),
            freeShopSpins: (save.freeShopSpins || 0) + (r.freeSpin ? 1 : 0),
            character: { ...char, pieces: (char.pieces || 0) + (r.pieces || 0), shards: (char.shards || 0) + (r.shards || 0) },
          });
          Audio.claimPing();
        }} />
      )}
    </div>
  );
}

function Stat({ label, val }) {
  return (<div className="stat-cell"><div className="stat-lbl">{label}</div><div className="stat-val">{val}</div></div>);
}
function fmtTime(t) { if (!t) return '00:00'; const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

const _CF = [
  {l:6,d:0,c:'#ff3146'},{l:14,d:.4,c:'#ffd166'},{l:23,d:.8,c:'#4dffd4'},
  {l:33,d:.2,c:'#b362ff'},{l:44,d:1.1,c:'#ff8c00'},{l:55,d:.6,c:'#4dc4ff'},
  {l:66,d:1.5,c:'#ffd700'},{l:76,d:.3,c:'#ff3146'},{l:85,d:.9,c:'#4dffd4'},
  {l:93,d:.1,c:'#b362ff'},{l:10,d:1.8,c:'#ffd166'},{l:29,d:1.3,c:'#ff8c00'},
  {l:50,d:1.0,c:'#4dc4ff'},{l:70,d:1.7,c:'#ff3146'},{l:88,d:.5,c:'#ffd700'},
  {l:19,d:1.4,c:'#4dffd4'},
];
const _LASERS = [0,45,90,135,180,225,270,315];

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
  const rewards = React.useMemo(() => {
    // `icon` is a GameIcon id, not an emoji — the same art the currency row in
    // the banner uses, so what you are paid looks like what you then own. They
    // used to be two unrelated sets of emoji and a player could reasonably not
    // connect "🔷 Char. Pieces" here with anything at all.
    const out = [
      { key: 'gold', icon: 'cur_gold', label: 'Gold', amount: r.gold, color: '#ffd166' },
      { key: 'sp', icon: 'cur_sp', label: 'SP', amount: r.sp, color: '#8fe6ff' },
      { key: 'tp', icon: 'cur_tp', label: 'TP', amount: r.talentPoints, color: '#7ad96b' },
      { key: 'gems', icon: 'cur_gems', label: 'Gems', amount: r.gems, color: '#4dffd4' },
      { key: 'coins', icon: 'cur_slot', label: `Slot Coin${r.slotCoins > 1 ? 's' : ''}`, amount: r.slotCoins, color: '#ffcc00' },
      { key: 'pieces', icon: 'cur_pieces', label: 'Char. Pieces', amount: r.pieces, color: '#b362ff' },
      { key: 'shards', icon: 'cur_shards', label: 'Evo. Shards', amount: r.shards, color: '#ff7a1a' },
    ].filter(x => (x.amount || 0) > 0);
    if (r.freeSpin) out.push({ key: 'spin', icon: 'cur_slot', label: 'Free Shop Spin!', amount: null, color: '#4dffd4' });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What this rank actually opened. All three reference sheets carry a
  // "NEW FEATURE UNLOCKS" block, and the game already has real rank-gated
  // content to put in it — profile frames, headbands, name colours, ship
  // colours and the cigar — which until now unlocked completely silently. A
  // player could hit rank 5 and own a Bronze Ring without ever being told.
  const unlocks = React.useMemo(() => {
    if (!isRankUp) return [];
    const out = [];
    const at = (list, label) => {
      for (const x of list) if (x.rank === newRank) out.push({ label, name: x.name });
    };
    at(PROFILE_FRAMES, 'Profile frame');
    at(HEADBANDS, 'Headband');
    at(NAME_COLORS, 'Name colour');
    at(SHIP_COLORS, 'Ship colour');
    if (newRank === CIGAR_UNLOCK_RANK) out.push({ label: 'Cosmetic', name: 'The cigar' });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // How many have landed. Each one flies in, lands on the portrait and only
  // then does the next start — "so you see and feel exactly what you get, when
  // you get it" rather than a wall of numbers appearing at once.
  const [shown, setShown] = useState(0);
  const [struck, setStruck] = useState(null);   // the key currently hitting
  const doneAll = shown >= rewards.length;

  useEffect(() => {
    if (isRankUp) Audio.rankUp();
    else Audio.levelUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const skipOrCollect = () => {
    if (!doneAll) { setShown(rewards.length); setStruck(null); return; }
    onCollect();
  };

  return (
    <div className="lu-overlay" data-testid="levelup-overlay" onClick={skipOrCollect}>
      {_CF.map((c,i) => <div key={i} className="lu-confetti" style={{left:`${c.l}%`,animationDelay:`${c.d}s`,background:c.c}} />)}
      {_LASERS.map(a => <div key={a} className="lu-laser" style={{transform:`translate(-50%,-50%) rotate(${a}deg)`}} />)}
      {/* The outer frame is a WRAPPER, not a pseudo-element on the card.
          Two reasons, both found by looking at a screenshot of it:
            - `.lu-card` has a clip-path for its bevelled corners, and a
              clip-path clips its own pseudo-elements too, so a frame drawn at
              `inset:-16px` was cut away entirely and never appeared.
            - a positioned ::before paints ABOVE non-positioned siblings, so
              the frame was covering "★ LEVEL n ★" and the XP bar — they were
              rendering the whole time, behind it.
          Also NOT `oil-live`: one element has exactly one ::before, so two
          frame classes overwrite rather than layer. */}
      <div className="lu-frame" onClick={(e) => e.stopPropagation()}>
      <div className="lu-card">
        {/* Title banner. All three reference sheets lead with a crimson plate
            carrying the headline, and it is the first thing your eye lands on
            — the old layout led with a portrait and buried the actual news
            underneath it. */}
        <div className={`lu-banner${isRankUp ? ' is-rank' : ''}`}>
          <span className="lu-banner-l" aria-hidden="true" />
          <span className="lu-banner-txt">
            {isRankUp ? `RANK UP — ${RANK_TITLES[newRank]}!` : `NEW ACCOUNT LEVEL: ${r.level}!`}
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
          {/* Layered bezel, back to front: a spinning black/crimson band, a
              counter-spinning silver filigree, four holder claws gripping the
              picture, then the glass. Two rings turning opposite ways is what
              stops it reading as one flat spinning disc. */}
          <span className="lu-bezel-outer" aria-hidden="true" />
          <span className="lu-bezel-band" aria-hidden="true" />
          <span className="lu-bezel-fili" aria-hidden="true" />
          <span className="lu-portrait-sheen" aria-hidden="true" />
          {[0, 1, 2, 3].map(i => <span key={i} className={`lu-claw c${i}`} aria-hidden="true" />)}
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
            <div className="lu-profxp">+{r.xpGained || 0} Account XP</div>
          </div>
        </div>

        {/* What is still ahead, kept as one quiet line under the row rather
            than as a heading — it is context, not news. */}
        {!isRankUp && (
          <div className="lu-next-rank">
            {(() => {
              const toNext = (newRank + 1) * 4 - r.level;
              return toNext > 0 && newRank < RANK_TITLES.length - 1
                ? `${toNext} more level${toNext > 1 ? 's' : ''} to RANK ${newRank + 1} — ${RANK_TITLES[newRank + 1]}`
                : null;
            })()}
          </div>
        )}
        {/* The one currently in flight, drawn OVER the card so it can travel
            from the portrait outward without being clipped by the list. */}
        {struck && (() => {
          const it = rewards.find(x => x.key === struck);
          return it ? (
            <div className="lu-strike" style={{ '--rc': it.color }} aria-hidden="true">
              <span className="lu-strike-icon"><GameIcon name={it.icon} tone={it.color} size={44} /></span>
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
              <span className="lu-tile-amt">{it.amount != null ? `+${it.amount}` : '✦'}</span>
              <span className="lu-tile-lbl">{it.label}</span>
            </div>
          ))}
          {r.streakBonus && doneAll && (
            <div className="lu-rwd" style={{color:'#ffd700',textShadow:'0 0 16px #ffd700aa',fontSize:15,letterSpacing:'0.15em',marginTop:6,border:'1px solid #ffd70066',padding:'4px 10px',background:'#1a1200'}}>
              ★ 2× STREAK BONUS! ★
              <div style={{fontSize:11,opacity:0.7,letterSpacing:'0.1em'}}>3 rank-ups today</div>
            </div>
          )}
        </div>
        {/* Only on a rank-up, and only when the rank actually opened something
            — an empty "NEW UNLOCKS" heading is worse than none. */}
        {doneAll && unlocks.length > 0 && (
          <div className="lu-unlocks">
            <div className="lu-unlocks-head">NEW UNLOCKS</div>
            {unlocks.map((u, i) => (
              <div className="lu-unlock" key={i} style={{ animationDelay: `${i * 110}ms` }}>
                <span className="lu-unlock-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="11" height="11">
                    <path d="M3 8.4l3.2 3.2L13 4.8" fill="none" stroke="#07160c"
                      strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <b>{u.name}</b>
                <i>{u.label}</i>
              </div>
            ))}
          </div>
        )}

        {/* Label follows state: while things are still landing this is a skip,
            not a collect, and saying so is the difference between "I chose to
            hurry it" and "did that button just eat my rewards?" */}
        <button className="lu-collect" onClick={skipOrCollect} data-testid="levelup-collect">
          {doneAll ? 'COLLECT ▸' : 'SKIP ▸'}
        </button>
      </div>
      </div>
    </div>
  );
}
