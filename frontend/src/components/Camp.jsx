import React, { useState, useRef, useEffect } from 'react';
import { META_UPGRADES, metaCost } from '../game/data';
import { MILESTONES, AVATARS, CHESTS, rollChest, getRank, RANK_TITLES, PROFILE_FRAMES, NAME_COLORS } from '../game/data_ext';
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
import { nextCampaignNode } from '../game/campaign';
import GearPanel from './GearPanel';
import { BattlePassPanel, CodexPanel, PatrolPanel, EyeBadge } from './MetaFeatures';
import { ACHIEVEMENTS } from '../game/data_ext2';
import { MissionsPanel, ChallengesPanel, AchievementsPanel, CardShopModal, ActiveLoadoutPanel, SettingsPanel, MapsPanel } from './CampPanels';
import { Audio } from '../game/audio';

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
  return (
    <span className={`countup${dir > 0 ? ' is-up' : dir < 0 ? ' is-down' : ''}${className ? ' ' + className : ''}`}>
      {shown.toLocaleString('sv-SE')}
      {dir !== 0 && <i className="countup-arrow">{dir > 0 ? '▲' : '▼'}</i>}
    </span>
  );
}

const openChest = (chestId) => {
  const c = CHESTS.find(x => x.id === chestId);
  return c ? rollChest(c, 0.5) : [];
};

export default function Camp({ save, setSave, onBack, onStart, onMission, onStory, onStarRaid }) {
  const storyNode = nextCampaignNode(save);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('cards');
  const [shopOpen, setShopOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popCard, setPopCard] = useState(null);

  const [characterOpen, setCharacterOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);
  const [petOpen, setPetOpen] = useState(false);
  const [prospectorOpen, setProspectorOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
      const width = Math.min(340, window.innerWidth - 16);
      setAttrPanelStyle({
        position: 'fixed',
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
        top: r.bottom - 2,
        width,
        maxHeight: Math.max(180, window.innerHeight - r.bottom - 20),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
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
  const burstMeta = (upg, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Math.random().toString(36).slice(2);
    setMetaBurst({ id, x: rect.left + rect.width / 2, y: rect.top, icon: upg.icon, gain: fmtMetaGain(upg) });
    setTimeout(() => setMetaBurst(cur => (cur && cur.id === id ? null : cur)), 1100);
    setCampShake(true); setTimeout(() => setCampShake(false), 260);
    Audio.claimPing();
  };

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
      setToast(`🔒 Requires Skill Tree: ${reqNode?.name || reqNodeId}`);
      setTimeout(() => setToast(''), 2000);
      return;
    }
    const cost = metaCost(upg, cur);
    if (save.gold < cost) { setToast('NOT ENOUGH GOLD'); setTimeout(() => setToast(''), 1200); return; }
    setSave({ ...save, gold: save.gold - cost, meta: { ...save.meta, [upg.id]: cur + 1 } });
    popFeedback(upg.id);
    if (e) burstMeta(upg, e); else Audio.click();
  };

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
        {metaBurst && (
          <div className="meta-burst" style={{ left: metaBurst.x, top: metaBurst.y }} data-testid="meta-burst">
            <div className="meta-burst-icon">{metaBurst.icon}</div>
            <div className="meta-burst-gain">▲ {metaBurst.gain}</div>
          </div>
        )}
        <div className="camp-sidebar">
          <div className="camp-profile-bar camp-profile-bar-framed" ref={profileBarRef}>
            <div className="camp-profile-id" onClick={() => setProfileOpen(true)} data-testid="camp-profile-open">
              <span className="camp-avatar-frame" style={{
                '--frame-css': PROFILE_FRAMES.find(f => f.id === save.profile.frame)?.css || 'none',
                boxShadow: PROFILE_FRAMES.find(f => f.id === save.profile.frame)?.glow || 'none',
              }}><span className="camp-avatar-icon">{avatar.icon}</span></span>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 800,
                  color: (() => { const nc = NAME_COLORS.find(c => c.id === save.profile.nameColor); return nc && nc.color !== 'rainbow' ? nc.color : 'var(--ink)'; })(),
                }}>{save.profile.name || 'Wanderer'}</div>
                <div style={{ fontSize: 11, color: 'var(--rune)', letterSpacing: '0.15em' }}>{RANK_TITLES[getRank(save.profile.level)]} · Lv {save.profile.level}</div>
                <div className="camp-rank-bar" data-testid="camp-rank-progress">
                  <div className="camp-rank-fill" style={{ width: `${((save.profile?.xp || 0) % 200) / 200 * 100}%` }} />
                  <span className="camp-rank-bar-label">{(save.profile?.xp || 0) % 200}/200</span>
                </div>
              </div>
            </div>
            {/* All currencies on ONE row — the row scrolls sideways rather
                than wrapping, so the banner keeps a fixed height. */}
            <div className="camp-currency-row">
              <span className="camp-currency-chip">★ <CountUp value={save.gold} /></span>
              <span className="camp-currency-chip" style={{ color: '#4dffd4' }}>💎 <CountUp value={save.gems || 0} /></span>
              <span className="camp-currency-chip" style={{ color: '#ffcc00' }}>🎰 <CountUp value={save.slotCoins || 0} /></span>
              <span className="camp-currency-chip" style={{ color: '#4dff91' }}>🌿 <CountUp value={save.talentPoints || 0} /></span>
              <span className="camp-currency-chip">◆ <CountUp value={save.sp} /></span>
              <span className="camp-currency-chip" style={{ color: '#ff9900' }}>🎫 <CountUp value={save.gachaTokens || 0} /></span>
            </div>
            <button
              className={`camp-attr-toggle ${attrOpen ? 'open' : ''} ${attrFreePts > 0 ? 'camp-attr-pulse' : ''}`}
              data-testid="camp-attr-points" onClick={() => setAttrOpen(o => !o)}>
              ⚡ {attrFreePts} ATTR <span className="camp-attr-caret">{attrOpen ? '▲' : '▼'}</span>
            </button>

            {/* The panel expands the banner in-flow instead of floating above
                it. As an absolutely-positioned dropdown it was being clipped
                by .camp-sidebar's overflow:hidden, which is why only the top
                sliver of it was ever visible. */}
            {attrOpen && (
              <div className="camp-attr-panel" data-testid="camp-attr-dropdown" style={attrPanelStyle}>
                <div className="char-attr-header">
                  <span>⚡ ATTRIBUTES</span>
                  <span className={`char-attr-free ${attrFreePts > 0 ? 'has' : ''}`}>{attrFreePts} pt{attrFreePts === 1 ? '' : 's'} free</span>
                </div>
                <div className="char-attr-desc">Earned 1 per profile level (RANK). Permanent bonuses.</div>
                <div className="poe-attr-grid">
                  {POE_ATTRS.map(a => {
                    const cur = (save.attrs || {})[a.id] || 0;
                    const canAdd = attrFreePts > 0;
                    return (
                      <div key={a.id} className="poe-attr-row" data-testid={`attr-${a.id}`}>
                        <span className="poe-attr-icon" style={{ color: a.color }}>{a.icon}</span>
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
            )}
          </div>
          <div className="camp-scroll-hint">↓ scroll for more ↓</div>
          <div className="camp-tabs-scroll">
            {/* The story is the default way to play, so it gets a real
                call-to-action rather than being one tab among fifteen. */}
            {storyNode && (
              <button className="camp-story-btn" onClick={onStory} data-testid="continue-story">
                <span className="camp-story-kicker">CONTINUE STORY</span>
                <span className="camp-story-node">{storyNode.mapIcon} {storyNode.mapName} — {storyNode.name}</span>
                <span className="camp-story-go">▸</span>
              </button>
            )}
            <button className={`camp-tab ${tab==='campaign'?'active':''}`} onClick={() => setTab('campaign')} data-testid="tab-campaign">📜 CAMPAIGN</button>
            <button className={`camp-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')} data-testid="tab-stats">📊 STATS</button>
            <button className={`camp-tab ${tab === 'starraid' ? 'active' : ''}`} onClick={() => setTab('starraid')} data-testid="tab-starraid">🚀 STAR RAID</button>
            <button className="camp-tab" onClick={() => setProspectorOpen(true)} data-testid="tab-prospector">⛏ PROSPECTOR</button>
            <div className="camp-tab-divider" />
            <button className="camp-tab" onClick={() => setCharacterOpen(true)} data-testid="tab-character">👤 CHARACTER</button>
            <button className="camp-tab" onClick={() => setPetOpen(true)} data-testid="tab-pets">🐾 PETS</button>
            <button className="camp-tab" onClick={() => setTalentOpen(true)} data-testid="tab-talent">🌿 TALENTS</button>
            <button className="camp-tab" onClick={() => setSkillOpen(true)} data-testid="open-skills">🧠 SKILLS</button>
            <button className={`camp-tab ${tab==='cards'?'active':''}`} onClick={() => setTab('cards')} data-testid="tab-cards">💠 META</button>
            <button className={`camp-tab ${tab==='gear'?'active':''}`} onClick={() => setTab('gear')} data-testid="tab-gear">🪖 GEAR</button>
            <button className={`camp-tab ${tab==='pass'?'active':''}`} onClick={() => setTab('pass')} data-testid="tab-pass" style={{position:'relative'}}>🎖 SEASON PASS {passNew && <EyeBadge/>}</button>
            <button className={`camp-tab ${tab==='patrol'?'active':''}`} onClick={() => setTab('patrol')} data-testid="tab-patrol" style={{position:'relative'}}>🗺 PATROL {patrolNew && <EyeBadge/>}</button>
            <button className={`camp-tab ${tab==='codex'?'active':''}`} onClick={() => setTab('codex')} data-testid="tab-codex" style={{position:'relative'}}>📚 CODEX {(codexNew || achNew) && <EyeBadge/>}</button>
            <div className="camp-tab-divider" />
            <button className="camp-tab" onClick={() => setShopOpen(true)} data-testid="open-card-shop">🎰 CARD SHOP</button>
            <button className="camp-tab" onClick={() => setForgeOpen(true)} data-testid="open-forge">🔨 SMITH</button>
            <button className="camp-tab" onClick={() => setChestOpen(true)} data-testid="open-chest">📦 CHESTS</button>
            <button className="camp-tab" onClick={() => setLoadoutOpen(true)} data-testid="open-loadout">🎯 LOADOUT</button>
            <button className="camp-tab" onClick={() => setSettingsOpen(true)} data-testid="open-settings">⚙ SETTINGS</button>
          </div>
        </div>

        <div className="camp-main">
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
                        <div className="name">{upg.icon} {upg.name}</div>
                        <div className="lvl">{lvl}/{upg.max}</div>
                      </div>
                      {upg.max > 20 ? (
                        <div style={{ height:5, background:'#1a0a2e', borderRadius:3, overflow:'hidden', margin:'4px 0' }}>
                          <div style={{ width:`${(lvl/upg.max)*100}%`, height:'100%', background: maxed ? '#ffd700' : isLocked ? '#3a2a5e' : 'var(--rune)', transition:'width 0.3s' }} />
                        </div>
                      ) : (
                        <div className="pips">
                          {Array.from({ length: upg.max }, (_, i) => <span key={i} className={'pip ' + (i < lvl ? 'on' : '')} />)}
                        </div>
                      )}
                      <div className="desc">{upg.desc}</div>
                      {isLocked ? (
                        <div className="meta-lock-msg" data-testid={`meta-lock-${upg.id}`}>
                          🔒 Unlock in Skill Tree: <em>{reqNodeName}</em>
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
                <button className={`gear-tab ${campaignSub === 'campaign' ? 'active' : ''}`} onClick={() => setCampaignSub('campaign')} data-testid="tab-campaign-story">📜 STORY</button>
                <button className={`gear-tab ${campaignSub === 'maps' ? 'active' : ''}`} onClick={() => setCampaignSub('maps')} data-testid="tab-maps">🗺 MAPS</button>
                <button className={`gear-tab ${campaignSub === 'missions' ? 'active' : ''}`} onClick={() => setCampaignSub('missions')} data-testid="tab-missions">📋 MISSIONS</button>
                <button className={`gear-tab ${campaignSub === 'challenges' ? 'active' : ''}`} onClick={() => setCampaignSub('challenges')} data-testid="tab-challenges">🏆 CHALLENGES</button>
              </div>
              {campaignSub === 'campaign' && <CampaignPanel save={save} setSave={setSave} />}
              {campaignSub === 'maps' && <MapsPanel save={save} setSave={setSave} onStart={(cfg) => onMission(cfg)} />}
              {campaignSub === 'missions' && <MissionsPanel save={save} setSave={setSave} onStart={onMission} />}
              {campaignSub === 'challenges' && <ChallengesPanel save={save} setSave={setSave} onStart={(c) => onMission({ ...c, isChallenge: true })} />}
            </>
          )}

          {tab === 'patrol' && (
            <>
              <div className="camp-header"><h1>Patrol</h1><div className="camp-header-sub">Send on missions while you're away · Active pet gives +20% reward</div></div>
              <PatrolPanel save={save} setSave={setSave} />
            </>
          )}

          {tab === 'starraid' && (
            <>
              <div className="camp-header"><h1>Star Raid</h1><div className="camp-header-sub">One-thumb space raid — earn Scrap for ship upgrades and Gacha Tokens for artifacts</div></div>
              <div style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}>🚀</div>
                <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', marginBottom: 16 }}>
                  Fly, autofire, and dodge through 3 stages. Clear the final stage for a Gacha Token.
                </div>
                <button className="go-btn go-btn-retry" onClick={onStarRaid} data-testid="starraid-launch-camp">🚀 LAUNCH STAR RAID</button>
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
                <button className={`gear-tab ${codexSub === 'codex' ? 'active' : ''}`} onClick={() => setCodexSub('codex')} data-testid="tab-codex-sub">📚 CODEX</button>
                <button className={`gear-tab ${codexSub === 'achievements' ? 'active' : ''}`} onClick={() => setCodexSub('achievements')} data-testid="tab-ach" style={{ position: 'relative' }}>🎖 ACHIEVEMENTS {achNew && <EyeBadge />}</button>
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
                          <div className="name">🏆 {m.name}</div>
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
              <div className="stats-grid">
                <Stat label="Runs Completed" val={save.runsCompleted} />
                <Stat label="Total Kills" val={save.totalKills} />
                <Stat label="Best Run Time" val={fmtTime(save.bestRunTime)} />
                <Stat label="Best Run Level" val={save.bestKills} />
                <Stat label="A.I.D.A. Slain" val={save.aidaSlain} />
                <Stat label="Necromancer Slain" val={save.necroSlain || 0} />
                <Stat label="Void Titan Slain" val={save.voidSlain || 0} />
                <Stat label="Eye of Horus Slain" val={save.horusSlain || 0} />
                <Stat label="Endless Mode Reached" val={save.endlessReached || 0} />
                <Stat label="Account Rank" val={save.profile.level} />
                <Stat label="Skill Points" val={save.sp} />
                <Stat label="Gold Hoarded" val={save.gold} />
                <Stat label="Equipment" val={(save.inventory || []).length} />
                <Stat label="Parts" val={(save.parts || []).length} />
                <Stat label="Weapons Crafted" val={Object.keys(save.craftedWeapons || {}).length} />
                <Stat label="Skills Learned" val={Object.values(save.skills || {}).reduce((a, b) => a + b, 0)} />
                <Stat label="Meta Cards" val={Object.values(save.meta || {}).reduce((a, b) => a + b, 0)} />
                <Stat label="Daily Streak" val={(save.daily.streak || 0) + ' days'} />
                <Stat label="Shop Pulls" val={save.shopPulls || 0} />
                <Stat label="Chests Opened" val={save.chestsOpened || 0} />
                <Stat label="No-Hit Runs" val={save.noHitRuns || 0} />
                <Stat label="Legendary Parts" val={save.legendaryPartsFound || 0} />
              </div>
            </>
          )}

          <div className="camp-actions">
            <button onClick={onBack} data-testid="camp-back">◂ Back</button>
            <button onClick={onStart} data-testid="camp-fight"
              style={{ borderColor: '#ff7a1a', boxShadow: 'var(--pixel-edge), 0 6px 0 #000, 0 0 28px #ff7a1a66' }}>▸ FIGHT</button>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
      {shopOpen && <CardShopModal save={save} setSave={setSave} onClose={() => setShopOpen(false)} />}
      {skillOpen && <SkillTree save={save} setSave={setSave} onClose={() => setSkillOpen(false)} />}
      {forgeOpen && <Weaponsmith save={save} setSave={setSave} onClose={() => setForgeOpen(false)} />}
      {chestOpen && <Shop save={save} setSave={setSave} onClose={() => setChestOpen(false)} />}
      {loadoutOpen && <ActiveLoadoutPanel save={save} setSave={setSave} onClose={() => setLoadoutOpen(false)} />}
      {settingsOpen && <SettingsPanel save={save} setSave={setSave} onClose={() => setSettingsOpen(false)} onReset={handleReset} />}
      {characterOpen && <CharacterPanel save={save} setSave={setSave} onClose={() => setCharacterOpen(false)} />}
      {talentOpen && <TalentTree save={save} setSave={setSave} onClose={() => setTalentOpen(false)} />}
      {petOpen && <PetPanel save={save} setSave={setSave} onClose={() => setPetOpen(false)} />}
      {prospectorOpen && <ProspectorScreen save={save} setSave={setSave} onClose={() => setProspectorOpen(false)} />}
      {profileOpen && <ProfilePanel save={save} setSave={setSave} onClose={() => setProfileOpen(false)} />}
      {save.pendingLevelUp && (
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
  const av = AVATARS[save.profile.avatar] || AVATARS[0];
  return (
    <div className="lu-overlay" data-testid="levelup-overlay">
      {_CF.map((c,i) => <div key={i} className="lu-confetti" style={{left:`${c.l}%`,animationDelay:`${c.d}s`,background:c.c}} />)}
      {_LASERS.map(a => <div key={a} className="lu-laser" style={{transform:`translate(-50%,-50%) rotate(${a}deg)`}} />)}
      <div className="lu-card">
        <div className="lu-avatar">{av.icon}</div>
        <div className="lu-title">RANK UP!</div>
        <div className="lu-rank">★ RANK {r.level} ★</div>
        <div className="lu-xp"><div className="lu-xp-fill" /></div>
          <div className="lu-rewards">
          <div className="lu-rwd">★ +{r.gold} Gold</div>
          <div className="lu-rwd">◆ +{r.sp} SP</div>
          {r.talentPoints > 0 && <div className="lu-rwd" style={{color:'#4dff91'}}>🌿 +{r.talentPoints} TP</div>}
          {r.gems > 0 && <div className="lu-rwd" style={{color:'#4dffd4'}}>💎 +{r.gems} Gems</div>}
          {r.slotCoins > 0 && <div className="lu-rwd" style={{color:'#ffcc00'}}>🎰 +{r.slotCoins} Slot Coin{r.slotCoins > 1 ? 's' : ''}!</div>}
          {r.freeSpin && <div className="lu-rwd" style={{color:'#4dffd4',textShadow:'0 0 10px #4dffd4'}}>🎰 Free Shop Spin!</div>}
          {r.pieces > 0 && <div className="lu-rwd" style={{color:'#b362ff',textShadow:'0 0 10px #b362ff88'}}>🔷 +{r.pieces} Char. Pieces</div>}
          {r.shards > 0 && <div className="lu-rwd" style={{color:'#ff7a1a',textShadow:'0 0 10px #ff7a1a88'}}>💎 +{r.shards} Evo. Shards</div>}
          {r.streakBonus && (
            <div className="lu-rwd" style={{color:'#ffd700',textShadow:'0 0 16px #ffd700aa',fontSize:15,letterSpacing:'0.15em',marginTop:6,border:'1px solid #ffd70066',padding:'4px 10px',background:'#1a1200'}}>
              ★ 2× STREAK BONUS! ★
              <div style={{fontSize:11,opacity:0.7,letterSpacing:'0.1em'}}>3 rank-ups today</div>
            </div>
          )}
        </div>
        <button className="lu-collect" onClick={onCollect} data-testid="levelup-collect">COLLECT ▸</button>
      </div>
    </div>
  );
}
