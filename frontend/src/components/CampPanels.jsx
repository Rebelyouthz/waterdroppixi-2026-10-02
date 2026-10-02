// Combined extended Camp panels in one file to save bundle weight.
import React, { useState, useEffect, useRef } from 'react';
import { MISSION_DEFS, MISSION_DAILY_LIMIT, MISSION_REGEN_MS, ACHIEVEMENTS, CHALLENGES, MILESTONE_BAR, rollShopPull3, applyShopPull, shopCardCost, shopSectionStats, SHOP_PITY_AFTER, ACTIVE_SKILLS, STARTER_WEAPONS, PART_RARITY_COLORS, PART_SLOTS, PART_SLOT_INFO, STAT_DISPLAY, MAP_STAGES, getDailyChallenges, achMetric, achievementFamily } from '../game/data_ext2';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import { progressFor } from '../game/difficulty';
import { applyReward } from '../store';
import { achievementsReady, openAchievementTier } from '../game/campClaims';
import DifficultyPicker from './DifficultyPicker';
import GameIcon from './GameIcon';
import { fireClaimFx, CAMP_CLAIM_FLY } from './ClaimFx';

const PART_RAR_CLS = { common: 'r-common', magic: 'r-magic', rare: 'r-rare', epic: 'r-epic', legendary: 'r-legendary', mythical: 'r-mythical' };

// ---------- Missions ----------
export function MissionsPanel({ save, setSave, onStart }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  // Regen energy by elapsed time
  useEffect(() => {
    const me = save.missionEnergy || { uses: 0, lastRegen: Date.now() };
    const now = Date.now();
    let uses = me.uses || 0; let last = me.lastRegen || now;
    while (uses > 0 && now - last >= MISSION_REGEN_MS) { uses -= 1; last += MISSION_REGEN_MS; }
    if (uses !== (me.uses || 0)) setSave({ ...save, missionEnergy: { uses, lastRegen: last } });
    // eslint-disable-next-line
  }, [tick]);
  const me = save.missionEnergy || { uses: 0, lastRegen: Date.now() };
  const energyLeft = MISSION_DAILY_LIMIT - (me.uses || 0);
  const nextRegen = me.uses > 0 ? Math.max(0, MISSION_REGEN_MS - (Date.now() - me.lastRegen)) : 0;

  const begin = (m) => {
    if (energyLeft <= 0) return;
    const ns = { ...save, missionEnergy: { uses: (me.uses || 0) + 1, lastRegen: me.uses === 0 ? Date.now() : me.lastRegen } };
    setSave(ns);
    Audio.click();
    onStart(m);
  };

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60;
    return `${h}h ${m}m ${ss}s`;
  };

  return (
    <>
      <div className="camp-header">
        <h1>Daily Missions</h1>
        <div className="camp-currency">
          <span style={{ color: 'var(--rune)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon name="ui_bolt" size={13} /> {energyLeft}/{MISSION_DAILY_LIMIT}</span>
          {energyLeft < MISSION_DAILY_LIMIT && <span style={{ color: 'var(--ink-dim)', fontSize: 14 }}>next in {fmt(nextRegen)}</span>}
        </div>
      </div>
      <div className="upgrade-grid">
        {MISSION_DEFS.map(m => (
          <div className="upgrade-card" key={m.id} data-testid={`mission-${m.id}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GameIcon name={m.icon} size={28} />
              <div>
                <div className="name">{m.name}</div>
                <div className="lvl">STAGE {m.stage} · {Math.floor(m.duration / 60)}m {m.duration % 60}s</div>
              </div>
            </div>
            <div className="desc">{m.desc}</div>
            <div style={{ fontSize: 13, color: 'var(--accent-2)' }}>
              <GameIcon name="ui_scroll" size={13} /> Blueprint shards × {m.reward.blueprintShards.count}<br />
              {Object.entries(m.reward.parts).map(([rar, n]) => <span key={rar} style={{ color: PART_RARITY_COLORS[rar], marginRight: 6 }}>{n}× {rar}</span>)}
              <br />★ {m.reward.gold} gold
            </div>
            <button onClick={() => begin(m)} disabled={energyLeft <= 0} data-testid={`begin-${m.id}`}>▸ DEPLOY</button>
          </div>
        ))}
      </div>

      {/* ---- DAILY CHALLENGES ---- */}
      <div className="camp-header" style={{ marginTop: 22 }}>
        <h1 style={{ color: '#ff7a1a' }}>Daily Challenges</h1>
        <div className="camp-currency" style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Resets at midnight</div>
      </div>
      <div className="upgrade-grid">
        {getDailyChallenges().map(dc => {
          const dayKey = Math.floor(Date.now() / 86400000);
          const doneKey = `${dayKey}_${dc.id}`;
          const done = !!(save.dailyChallengesDone || {})[doneKey];
          return (
            <div className={`upgrade-card daily-challenge-card ${done ? 'dc-done' : ''}`} key={dc.id} data-testid={`dc-${dc.id}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GameIcon name={dc.icon} size={28} />
                <div>
                  <div className="name" style={{ color: '#ff7a1a' }}>{dc.name}</div>
                  <div className="lvl">DAILY CHALLENGE</div>
                </div>
              </div>
              <div className="desc">{dc.desc}</div>
              <div style={{ fontSize: 13, color: '#ffd166' }}>★ {dc.rwd.gold} gold · ◆ {dc.rwd.sp} SP</div>
              {done
                ? <div style={{ color: '#4dffd4', fontFamily: 'VT323', letterSpacing: '0.2em', fontSize: 14 }}>✓ COMPLETED</div>
                : <button onClick={() => onStart({ ...dc, isDailyChallenge: true, dcId: dc.id, doneKey })} data-testid={`start-dc-${dc.id}`}>▸ ACCEPT</button>
              }
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- Challenges ----------
export function ChallengesPanel({ save, setSave, onStart }) {
  return (
    <>
      <div className="camp-header">
        <h1>Challenges</h1>
        <div className="camp-currency"><span className="gold">★ {save.gold}</span></div>
      </div>
      <div className="upgrade-grid">
        {CHALLENGES.map(c => {
          const completed = (save.challengesDone || {})[c.id];
          return (
            <div className="upgrade-card" key={c.id} data-testid={`ch-${c.id}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GameIcon name={c.icon} size={30} />
                <div className="name">{c.name}</div>
              </div>
              <div className="desc">{c.desc}</div>
              <div style={{ fontSize: 13, color: 'var(--accent-2)' }}>★ {c.rwd.gold} · ◆ {c.rwd.sp} SP</div>
              {completed && <div style={{ color: 'var(--rune)', fontSize: 11, letterSpacing: '0.2em' }}>✓ COMPLETED</div>}
              <button onClick={() => { Audio.click(); onStart(c); }} data-testid={`begin-ch-${c.id}`}>▸ ATTEMPT</button>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- Achievements ----------
// Timmy: there were two separate achievement UIs — this one (reached via
// Camp's own ACHIEVEMENTS tab, a sibling of CODEX and MILESTONES) and a
// near-duplicate tab built into CodexPanel itself (MetaFeatures.jsx),
// which could disagree with this one about whether an achievement was even
// complete (its metric-getter was missing several branches this one has)
// and dropped gem rewards entirely (no `a.rwd.gems` handling). Merged into
// this one — nothing removed, the more complete metric list and full
// reward handling both survive here, the redundant tab is gone.
export function AchievementsPanel({ save, setSave }) {
  const [burstId, setBurstId] = useState(null);
  const [filter, setFilter] = useState('open');
  const getMetric = (k) => achMetric(save, k);
  const ready = achievementsReady(save);

  const pay = (ns, a) => {
    ns.achClaimed = { ...(ns.achClaimed || {}), [a.id]: true };
    applyReward(ns, a.rwd);
  };

  const claim = (a, e) => {
    if ((save.achClaimed || {})[a.id]) return;
    if (getMetric(a.metric) < a.goal) return;
    const ns = { ...save };
    pay(ns, a);
    setSave(ns);
    Audio.claimPing?.();
    fireClaimFx(e?.currentTarget, a.rwd, { flyTo: CAMP_CLAIM_FLY });
    setBurstId(a.id);
    setTimeout(() => setBurstId((cur) => (cur === a.id ? null : cur)), 900);
  };

  const claimAll = (e) => {
    if (!ready.length) return;
    const ns = { ...save };
    const bag = {};
    for (const a of ready) {
      pay(ns, a);
      Object.entries(a.rwd || {}).forEach(([k, v]) => { bag[k] = (bag[k] || 0) + v; });
    }
    setSave(ns);
    Audio.claimPing?.();
    fireClaimFx(e?.currentTarget, bag, { flyTo: CAMP_CLAIM_FLY });
  };

  // One open tier per family (Hades / VS: you see the NEXT plaque, not the whole ladder).
  const families = [];
  const seen = new Set();
  for (const a of ACHIEVEMENTS) {
    const open = openAchievementTier(save, a) || a;
    if (seen.has(open.id) && filter !== 'done') continue;
    if (filter === 'open' && (save.achClaimed || {})[a.id]) continue;
    if (filter === 'open' && open.id !== a.id) continue;
    if (filter === 'ready' && !ready.some((x) => x.id === a.id)) continue;
    if (filter === 'done' && !(save.achClaimed || {})[a.id]) continue;
    if (filter !== 'done') seen.add(open.id);
    families.push(filter === 'done' ? a : open);
  }
  const list = filter === 'done' ? ACHIEVEMENTS.filter((a) => (save.achClaimed || {})[a.id]) : families;

  return (
    <>
      <div className="camp-header">
        <h1>Achievements</h1>
        <div className="camp-header-sub">{ready.length} ready · {Object.keys(save.achClaimed || {}).length}/{ACHIEVEMENTS.length} claimed</div>
      </div>
      <div className="gear-tabs" style={{ marginBottom: 12 }}>
        <button className={`gear-tab ${filter === 'open' ? 'active' : ''}`} onClick={() => setFilter('open')} data-testid="ach-filter-open">OPEN</button>
        <button className={`gear-tab ${filter === 'ready' ? 'active' : ''}`} onClick={() => setFilter('ready')} data-testid="ach-filter-ready">READY {ready.length > 0 && `(${ready.length})`}</button>
        <button className={`gear-tab ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')} data-testid="ach-filter-done">CLAIMED</button>
        {ready.length > 0 && (
          <button className="gear-tab" onClick={claimAll} data-testid="ach-claim-all">CLAIM ALL</button>
        )}
      </div>
      <div className="upgrade-grid">
        {list.map((a) => {
          const fam = achievementFamily(a);
          const tier = fam.findIndex((x) => x.id === a.id) + 1;
          const v = getMetric(a.metric);
          const done = v >= a.goal;
          const claimed = (save.achClaimed || {})[a.id];
          const pct = Math.min(100, (v / a.goal) * 100);
          return (
            <div className={`upgrade-card${claimed ? ' maxed' : ''}${done && !claimed ? ' card-pop' : ''}`} key={a.id} data-testid={`ach-${a.id}`} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GameIcon name={a.icon} size={26} />
                <div className="name">{a.name}</div>
                {fam.length > 1 && <div className="lvl"> {tier}/{fam.length}</div>}
              </div>
              <div className="desc">{a.desc}</div>
              <div className="hud-xpbar"><div className="hud-xpbar-fill" style={{ width: pct + '%' }} /></div>
              <div className="lvl">{Math.min(v, a.goal)} / {a.goal}</div>
              <div style={{ fontSize: 12, color: 'var(--accent-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.rwd.gold ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_gold" size={12} /> {a.rwd.gold}</span> : null}
                {a.rwd.sp ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_sp" size={12} /> {a.rwd.sp}</span> : null}
                {a.rwd.gems ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="cur_gems" size={12} /> {a.rwd.gems}</span> : null}
                {a.rwd.gearParts ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="ui_part" size={12} /> {a.rwd.gearParts}</span> : null}
              </div>
              {claimed ? <div style={{ color: 'var(--rune)', fontSize: 11 }}>CLAIMED</div> :
                <button onClick={(e) => claim(a, e)} disabled={!done} data-testid={`claim-ach-${a.id}`}>{done ? 'CLAIM' : 'LOCKED'}</button>}
              {burstId === a.id && (
                <span className="codex-claim-burst">
                  {a.rwd.gold ? <>+{a.rwd.gold} </> : null}
                  {a.rwd.sp ? <>+{a.rwd.sp} SP </> : null}
                  {a.rwd.gems ? <><GameIcon name="cur_gems" size={12} />+{a.rwd.gems}</> : null}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- Milestone Bar (account level rewards) ----------
export function MilestoneBar({ save, setSave }) {
  const level = save.profile.level;
  const claim = (m, e) => {
    const cl = save.milestoneBar || {};
    if (cl[m.atLevel] || level < m.atLevel) return;
    const ns = { ...save, milestoneBar: { ...cl, [m.atLevel]: true } };
    if (m.rwd.gold) ns.gold = (ns.gold || 0) + m.rwd.gold;
    if (m.rwd.sp) ns.sp = (ns.sp || 0) + m.rwd.sp;
    setSave(ns);
    fireClaimFx(e?.currentTarget, m.rwd, { flyTo: CAMP_CLAIM_FLY });
  };
  return (
    <div className="milestone-bar" data-testid="milestone-bar">
      {MILESTONE_BAR.map(m => {
        const reached = level >= m.atLevel;
        const claimed = (save.milestoneBar || {})[m.atLevel];
        return (
          <div key={m.atLevel} className={`ms-pip ${reached ? 'reached' : ''} ${claimed ? 'claimed' : ''}`} onClick={(e) => claim(m, e)} data-testid={`ms-${m.atLevel}`}>
            <div className="ms-lvl">LV{m.atLevel}</div>
            <div className="ms-rwd">{m.rwd.gold && `★${m.rwd.gold}`}<br />{m.rwd.sp && `◆${m.rwd.sp}`}{m.rwd.chest && <GameIcon name="ui_chest" size={12} />}</div>
            {claimed ? <div className="ms-status">✓</div> : reached && <div className="ms-status pulse">CLAIM</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Card Shop (Slot Machine) ----------
const REEL_ICONS = ['ui_waterdrop', 'ui_blade', 'ui_star', 'ui_gem', 'ui_token', 'starBurst', 'ui_orb', 'ui_bolt', 'ui_shield', 'heart'];
const REEL_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

export function CardShopModal({ save, setSave, onClose }) {
  const [section, setSection] = useState(null); // null = section select
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [jackpot, setJackpot] = useState(false);
  const [twoMatch, setTwoMatch] = useState(false);
  const [reels, setReels] = useState(['ui_waterdrop', 'ui_blade', 'ui_star']);
  const [reelResults, setReelResults] = useState([null, null, null]);
  const [stopped, setStopped] = useState([true, true, true]);
  const [reelRarity, setReelRarity] = useState('common');
  const timers = useRef([]);

  useEffect(() => () => { timers.current.forEach(clearInterval); timers.current.forEach(clearTimeout); }, []);

  const pullCount = save.shopPulls || 0;
  const luck = (save.meta?.m_luck || 0) * 0.5 + (save.skills?.sk_luck || 0) * 0.5;
  const freeSpins = save.freeShopSpins || 0;
  const slotCoins = save.slotCoins || 0;
  const isFree = freeSpins > 0;
  const hasCoin = slotCoins > 0;
  const goldCost = shopCardCost(pullCount);
  const dry = save.shopDry || 0;

  const SECTIONS = [
    { id: 'passive', label: 'PASSIVE',  icon: 'ui_shield', desc: 'Permanent stat boosts' },
    { id: 'active',  label: 'ACTIVE',   icon: 'ui_bolt', desc: 'Unlock active skills' },
    { id: 'auto',    label: 'AUTO',     icon: 'cat_auto', desc: 'Unlock auto-weapons' },
    { id: 'manual',  label: 'MANUAL',   icon: 'cat_manual', desc: 'Unlock manual weapons' },
    { id: 'evo',     label: 'EVOLUTIONS', icon: 'ui_trident', desc: 'Unlock weapon evolutions', locked: !(save.skills && save.skills.poe_awk0 >= 1) },
  ];

  const pull = (e) => {
    const canPull = isFree || hasCoin || (save.gold || 0) >= goldCost;
    if (!canPull || spinning || !section) return;
    const stats = shopSectionStats(save, section);
    if (stats.left <= 0) return;
    setSpinning(true); setResult(null); setJackpot(false); setTwoMatch(false);
    setStopped([false, false, false]);
    setReelRarity('common');
    Audio.click('buy');

    const pullResult = rollShopPull3(luck, section, save);
    const [c1, c2, c3] = pullResult.reels;
    let i = 0;
    const ri0 = setInterval(() => { setReels(p => [REEL_ICONS[(i++) % REEL_ICONS.length], p[1], p[2]]); }, 65);
    const ri1 = setInterval(() => { setReels(p => [p[0], REEL_ICONS[(i + 3) % REEL_ICONS.length], p[2]]); }, 80);
    const ri2 = setInterval(() => { setReels(p => [p[0], p[1], REEL_ICONS[(i + 7) % REEL_ICONS.length]]); }, 95);
    const rt  = setInterval(() => { setReelRarity(REEL_RARITIES[Math.floor(Math.random() * REEL_RARITIES.length)]); Audio.reelTick(); }, 130);
    timers.current = [ri0, ri1, ri2, rt];

    const stop0 = setTimeout(() => { clearInterval(ri0); setReels(p => [c1.icon, p[1], p[2]]); setStopped(s => [true, s[1], s[2]]); Audio.rewardLand(0); }, 900);
    const stop1 = setTimeout(() => { clearInterval(ri1); setReels(p => [p[0], c2.icon, p[2]]); setStopped(s => [s[0], true, s[2]]); Audio.rewardLand(0.4); }, 1500);
    const stop2 = setTimeout(() => {
      timers.current.forEach(clearInterval);
      setReels([c1.icon, c2.icon, c3.icon]);
      setReelResults([c1, c2, c3]);
      setStopped([true, true, true]);
      setReelRarity(pullResult.winner.rarity);
      setResult(pullResult.winner);
      setJackpot(pullResult.jackpot);
      setTwoMatch(pullResult.twoMatch);
      if (pullResult.jackpot) { Audio.levelUp(); setTimeout(() => Audio.claimPing(), 200); }
      else Audio.levelUp();

      const w = pullResult.winner;
      setSave((s) => applyShopPull(s, w, { isFree: (s.freeShopSpins || 0) > 0, hasCoin: (s.slotCoins || 0) > 0, goldCost: shopCardCost(s.shopPulls || 0) }));
      const bag = w.complete || w.effect?.gold
        ? { gold: w.effect?.gold || 250 }
        : null;
      fireClaimFx(e?.currentTarget, bag, bag ? { flyTo: CAMP_CLAIM_FLY } : {
        items: [{ key: 'win', icon: w.icon, amount: (w.name || '').replace(/^Unlock:\s*/, '') }],
        flyTo: CAMP_CLAIM_FLY,
      });
      setSpinning(false);
    }, 2100);
    timers.current.push(stop0, stop1, stop2);
  };

  const rarityCls = PART_RAR_CLS[reelRarity] || '';
  const RARITY_COLORS = { common:'#9a8fa6', uncommon:'#4dff91', rare:'#4dc4ff', epic:'#b362ff', legendary:'#ff7a1a', mythical:'#ff3146' };

  const describeResult = (w) => {
    if (!w) return '';
    const e = w.effect || {};
    if (w.complete || e.gold) return `Section complete — +${e.gold || 250} Gold`;
    if (e.unlockSkill) return `Unlock: ${ACTIVE_SKILLS[e.unlockSkill]?.name || e.unlockSkill}`;
    if (e.unlockWeapon) return `Unlock weapon: ${w.name.replace('Unlock: ','')}`;
    if (e.stat) return `+${w.finalEffect?.amount}${['maxHp','armor'].includes(e.stat)?'':' %'} ${e.stat}`;
    return w.name;
  };

  return (
    <div className="modal-overlay" data-testid="card-shop" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className={`forge-panel cs-modal ${jackpot ? 'cs-jackpot-flash' : ''}`} style={{ maxWidth: 680, textAlign: 'center' }}>
        <div className="forge-header">
          <div className="forge-title"><GameIcon name="ui_token" size={17} /> CARD SHOP</div>
          <div style={{ fontFamily:'VT323', fontSize:14, color:'var(--ink-dim)', display:'flex', gap:12, alignItems:'center' }}>
            {freeSpins > 0 && <span style={{color:'#4dffd4'}}>Free: {freeSpins}</span>}
            <span style={{color:'#ffcc00', display:'inline-flex', alignItems:'center', gap:4}}><GameIcon name="ui_token" size={14} /> {slotCoins}</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><GameIcon name="cur_gold" size={14} /> {save.gold}</span>
          </div>
          <button type="button" onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>CLOSE</button>
        </div>

        {/* Section selector */}
        {!section ? (
          <div style={{ padding: '20px 0' }}>
            <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', fontSize: 16, letterSpacing: '0.2em', marginBottom: 16 }}>CHOOSE YOUR PULL TYPE</div>
            <div className="section-chooser">
              {SECTIONS.map(s => {
                const st = shopSectionStats(save, s.id);
                const done = st.left <= 0;
                return (
                <button key={s.id} className={`section-btn${s.locked ? ' locked' : ''}${done ? ' done' : ''}`}
                  onClick={() => !s.locked && !done && setSection(s.id)}
                  data-testid={`section-${s.id}`}
                  style={s.locked || done ? { opacity: 0.45, cursor: 'not-allowed', position: 'relative' } : {}}
                  title={s.locked ? 'Unlock via Skill Tree: Awakening Gate (poe_awk0)' : done ? 'Every card in this section is owned' : ''}
                >
                  <GameIcon name={s.icon} size={28} />
                  <div style={{ fontFamily: 'VT323', fontSize: 18, letterSpacing: '0.1em', marginTop: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 2 }}>{s.desc}</div>
                  <div className="cs-owned">{st.owned}/{st.total} owned</div>
                  {s.locked && <div style={{ fontSize: 10, color: '#ff3146', marginTop: 2, fontFamily: 'VT323' }}><GameIcon name="ui_lock" size={10} /> UNLOCK IN SKILL TREE</div>}
                  {done && !s.locked && <div style={{ fontSize: 10, color: '#7fe8d0', marginTop: 2, fontFamily: 'VT323' }}>COMPLETE</div>}
                </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
              <button onClick={() => { setSection(null); setResult(null); }} style={{ padding: '4px 10px', fontSize: 12, background: '#0a0612' }}>← Back</button>
              <div style={{ fontFamily: 'VT323', color: 'var(--accent-2)', fontSize: 18, letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <GameIcon name={SECTIONS.find(s => s.id === section)?.icon} size={17} /> {SECTIONS.find(s => s.id === section)?.label} PULL
              </div>
              <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', fontSize: 14 }}>
                Pull #{pullCount + 1} · luck {luck.toFixed(1)}
                {freeSpins > 0 && <span style={{ color: '#4dffd4', marginLeft: 10 }}><GameIcon name="ui_token" size={12} /> {freeSpins} FREE</span>}
              </div>
            </div>

            {/* Jackpot / 2-match banners */}
            {jackpot && <div className="cs-jackpot-banner"><GameIcon name="ui_token" size={16} /> JACKPOT! RARITY UP × 2! <GameIcon name="ui_token" size={16} /></div>}
            {twoMatch && !jackpot && <div className="cs-match-banner">2 OF A KIND — RARITY BONUS</div>}

            {/* 3-reel slot */}
            <div className={`slot-frame ${rarityCls} ${spinning ? 'cs-shake' : ''}`}>
              <div className="slot-window">
                {[0, 1, 2].map(idx => {
                  const rr = reelResults[idx];
                  const cellRarColor = rr ? (RARITY_COLORS[rr.rarity] || '#fff') : '#fff';
                  return (
                    <div key={idx} className={`slot-cell ${stopped[idx] ? 'stopped' : 'spinning'}`}
                      style={{ boxShadow: (stopped[idx] && rr) ? `0 0 20px ${cellRarColor}66, inset 0 0 10px ${cellRarColor}22` : 'none' }}>
                      <div className="slot-icon"><GameIcon name={reels[idx]} size={52} /></div>
                      {stopped[idx] && rr && <div style={{ fontSize: 10, fontFamily: 'VT323', color: cellRarColor, letterSpacing: '0.1em', marginTop: 2 }}>{rr.rarity.toUpperCase()}</div>}
                    </div>
                  );
                })}
              </div>

              {result && (
                <div className={`cs-result ${jackpot ? 'jackpot' : twoMatch ? 'two-match' : ''}`} data-testid="cs-result">
                  <div className="card-tag" style={{ color: RARITY_COLORS[result.rarity] }}>{result.rarity.toUpperCase()}</div>
                  <div className="card-name" style={{ fontSize: 20, marginBottom: 4 }}>{result.name}</div>
                  <div className="card-desc">{describeResult(result)}</div>
                </div>
              )}
              {!result && spinning && <div className="cs-status"><span className="cs-suspense">SPINNING…</span></div>}
              {!result && !spinning && <div className="cs-status"><span>READY · PRESS PULL</span></div>}
            </div>

            <button type="button" onClick={pull} disabled={(!isFree && !hasCoin && (save.gold || 0) < goldCost) || spinning || shopSectionStats(save, section).left <= 0} style={{ marginTop: 18, width: '100%' }} data-testid="shop-pull">
              {shopSectionStats(save, section).left <= 0 ? 'SECTION COMPLETE'
                : isFree ? <><GameIcon name="ui_token" size={14} /> FREE PULL ({freeSpins} left)</>
                : hasCoin ? <><GameIcon name="ui_token" size={14} /> COIN SPIN ({slotCoins} left)</>
                : spinning ? 'PULLING…' : <span className="cs-pay"><GameIcon name="cur_gold" size={14} /> {goldCost} gold — PULL #{pullCount + 1}</span>}
            </button>
            <div className="cs-pity" data-testid="shop-pity">
              Pity {Math.min(dry, SHOP_PITY_AFTER)} / {SHOP_PITY_AFTER}
              {dry >= SHOP_PITY_AFTER ? ' — rare guaranteed' : ' — dry commons climb this'}
            </div>
          </>
        )}

        {save.shopBonuses && Object.keys(save.shopBonuses).length > 0 && (
          <div style={{ marginTop: 14, padding: 10, background: '#0e0816', border: '1px solid #000' }}>
            <div style={{ color: 'var(--accent-2)', fontSize: 11, letterSpacing: '0.2em' }}>PERMANENT BONUSES</div>
            <div style={{ fontFamily: 'VT323', fontSize: 13, color: 'var(--ink)', marginTop: 4, flexWrap: 'wrap', display: 'flex', gap: 8 }}>
              {Object.entries(save.shopBonuses).map(([k, v]) => (
                <span key={k} style={{ marginRight: 8 }}>+{Math.round(v * 100) / 100}{['maxHp','armor'].includes(k) ? '' : '%'} {k}</span>
              ))}
            </div>
          </div>
        )}
        {(save.unlockedWeapons || []).length > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: '#0a0612', border: '1px solid #b362ff44', fontSize: 12, color: '#b362ff' }}>
            <GameIcon name="ui_daggers" size={13} /> Unlocked weapons: {(save.unlockedWeapons || []).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Active Skill Loadout ----------
// Two slots, one per joystick dial — the pad seats exactly one skill pod in
// each bezel, so anything beyond two would be equipped but unreachable.
const ACTIVE_SLOTS = 2;

export function ActiveLoadoutPanel({ save, setSave, onClose }) {
  // Guard against ids the build no longer knows (a save that still lists a
  // retired skill would otherwise crash on ACTIVE_SKILLS[id].icon).
  const unlocked = Object.keys(save.unlockedActives || {}).filter(id => ACTIVE_SKILLS[id]);
  const equipped = Array.from({ length: ACTIVE_SLOTS }, (_, i) => {
    const id = (save.equippedActives || [])[i];
    return id && ACTIVE_SKILLS[id] ? id : null;
  });

  const equipAt = (slot, id) => {
    const eq = [...equipped];
    // A skill can only sit in one slot — moving it into a second one should
    // vacate the first rather than duplicating it.
    for (let i = 0; i < eq.length; i++) if (eq[i] === id) eq[i] = null;
    eq[slot] = equipped[slot] === id ? null : id;
    setSave({ ...save, equippedActives: eq });
  };

  return (
    <div className="modal-overlay" data-testid="loadout" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel loadout-panel" style={{ maxWidth: 720 }}>
        <div className="forge-header">
          <div className="forge-title"><GameIcon name="ui_loadout" size={17} /> ACTIVE SKILL LOADOUT</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>
        <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', marginBottom: 14, fontSize: 15 }}>
          Equip 2 active skills — one seated in each joystick dial. Keys 1-2 on desktop.
        </div>
        <div className="loadout-row">
          {equipped.map((id, i) => (
            <div key={i} className={`loadout-slot ${id ? 'eq' : ''}`}>
              <div className="ls-key">{i === 0 ? 'L' : 'R'}</div>
              {id ? <>
                <div className="ls-icon"><GameIcon name={ACTIVE_SKILLS[id].icon} size={24} /></div>
                <div className="ls-name">{ACTIVE_SKILLS[id].name}</div>
              </> : <div style={{ color: 'var(--ink-dim)' }}>empty</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, color: 'var(--accent-2)', letterSpacing: '0.2em', fontSize: 13 }}>UNLOCKED SKILLS</div>
        {unlocked.length === 0 && <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', padding: 12 }}>None yet — pull cards in the Card Shop to unlock active skills.</div>}
        <div className="upgrade-grid" style={{ marginTop: 8 }}>
          {unlocked.map(id => {
            const sk = ACTIVE_SKILLS[id];
            const eqSlot = equipped.indexOf(id);
            return (
              <div key={id} className="upgrade-card">
                <div className="name"><GameIcon name={sk.icon} size={15} /> {sk.name}</div>
                <div className="desc">{sk.desc}</div>
                <div className="lvl">CD {sk.cd}s</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Array.from({ length: ACTIVE_SLOTS }, (_, i) => (
                    <button key={i} onClick={() => equipAt(i, id)} style={{ padding: '4px 8px', fontSize: 11, borderColor: equipped[i] === id ? 'var(--accent)' : undefined }} data-testid={`equip-${id}-${i}`}>
                      {equipped[i] === id ? `✓ ${i === 0 ? 'Left' : 'Right'}` : `${i === 0 ? 'Left' : 'Right'} dial`}
                    </button>
                  ))}
                </div>
                {eqSlot >= 0 && <div style={{ color: 'var(--rune)', fontSize: 11, letterSpacing: '0.2em' }}>{eqSlot === 0 ? 'LEFT DIAL' : 'RIGHT DIAL'}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Blueprints / Weapons Crafting ----------
export function WeaponCrafting({ save, setSave, onClose }) {
  const shards = save.blueprintShards || {};
  const crafted = save.craftedWeapons || {};
  const craft = (id) => {
    const def = STARTER_WEAPONS[id]; if (!def || crafted[id]) return;
    const have = shards[id] || 0;
    if (have < def.blueprintCost) return;
    const ns = { ...save, blueprintShards: { ...shards, [id]: have - def.blueprintCost }, craftedWeapons: { ...crafted, [id]: true } };
    setSave(ns); Audio.blueprint();
  };
  // hydropistol is the default weapon and never appears here. Everything else
  // does — including the starters that need no blueprint at all, which render
  // as already unlocked rather than as a craft with a cost of `undefined`
  // (that produced a NaN progress bar and a FORGE button that "crafted" for
  // free, because `0 < undefined` is false).
  const weapons = Object.keys(STARTER_WEAPONS).filter(k => k !== 'hydropistol');
  const isFree = (def) => !def.blueprintCost;
  return (
    <div className="modal-overlay" data-testid="craft" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel craft-panel" style={{ maxWidth: 760 }}>
        <div className="forge-header">
          <div className="forge-title"><GameIcon name="ui_scroll" size={17} /> WEAPON BLUEPRINTS</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>
        <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', marginBottom: 10, fontSize: 14 }}>Collect blueprint shards in missions. Craft starter weapons.</div>
        <div className="upgrade-grid">
          {weapons.map(id => {
            const def = STARTER_WEAPONS[id];
            const have = shards[id] || 0;
            const free = isFree(def);
            const c = free || crafted[id];
            const pct = free ? 100 : Math.min(100, (have / def.blueprintCost) * 100);
            return (
              <div className={`upgrade-card${free ? ' is-free' : ''}`} key={id} data-testid={`craft-${id}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GameIcon name={id} size={32} />
                  <div>
                    <div className="name">{def.name}</div>
                    <div className="lvl">{free ? 'UNLOCKED' : `${have} / ${def.blueprintCost}`}</div>
                  </div>
                </div>
                <div className="desc">{def.desc}</div>
                <div className="hud-xpbar"><div className="hud-xpbar-fill" style={{ width: pct + '%' }} /></div>
                {c ? <div style={{ color: 'var(--accent-2)' }}>{free ? '✓ READY' : '✓ CRAFTED'}</div> :
                  <button onClick={() => craft(id)} disabled={have < def.blueprintCost} data-testid={`btn-craft-${id}`}>FORGE</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Settings ----------
export function SettingsPanel({ save, setSave, onClose, onReset, onReplayIntro }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (k, v) => setSave({ ...save, settings: { ...(save.settings || {}), [k]: v } });
  const s = save.settings || {};
  useEffect(() => { Audio.setSfxVol(s.sfx ?? 1.0); Audio.setMusicVol(s.music ?? 0.28); Audio.setMuted(s.muted ?? false); }, [s.sfx, s.music, s.muted]);
  return (
    <div className="modal-overlay" data-testid="settings" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel settings-panel" style={{ maxWidth: 480 }}>
        <div className="forge-header">
          <div className="forge-title"><GameIcon name="ui_cog" size={18} /> SETTINGS</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>
        <div className="setting-row"><span>SFX Volume</span><input type="range" min="0" max="1" step="0.05" value={s.sfx ?? 1.0} onChange={(e) => set('sfx', +e.target.value)} /></div>
        <div className="setting-row"><span>Music Volume</span><input type="range" min="0" max="1" step="0.05" value={s.music ?? 0.28} onChange={(e) => set('music', +e.target.value)} /></div>
        <div className="setting-row"><span>Mute All</span><input type="checkbox" checked={s.muted ?? false} onChange={(e) => set('muted', e.target.checked)} /></div>
        {/* REPLAY INTRO. The comic-book origin film only ever played once,
            gated on `save.introSeen`, and there was no way back to it - so
            once it had run, nobody (including whoever is building it) could
            watch it again without editing the save by hand. Clearing the flag
            sends the next boot through the film; nothing else in the save
            moves, and the film sets it back to true when it finishes. */}
        <div className="setting-row">
          <span>Replay Intro Film</span>
          <button
            data-testid="replay-intro"
            onClick={() => {
              Audio.click();
              setSave({ ...save, introSeen: false });
              onClose();
              if (onReplayIntro) onReplayIntro();
            }}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >WATCH AGAIN</button>
        </div>
        <div className="setting-row"><span>Screen Shake</span><input type="checkbox" checked={s.shake ?? true} onChange={(e) => set('shake', e.target.checked)} /></div>
        <div className="setting-row"><span>Particle Density</span>
          <select value={s.particles ?? 'high'} onChange={(e) => set('particles', e.target.value)}>
            <option value="low">Low (mobile)</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #b51d2855' }}>
          <div style={{ fontFamily: 'VT323, monospace', color: '#ff6675', fontSize: 12, letterSpacing: '0.2em', marginBottom: 8 }}>DANGER ZONE</div>
          {!confirmReset ? (
            <button
              data-testid="reset-progress-btn"
              onClick={() => setConfirmReset(true)}
              style={{ width: '100%', padding: '10px', borderColor: '#b51d28', color: '#ff6675', background: 'linear-gradient(180deg,#2a0a10,#10050a)' }}
            >
              <GameIcon name="ui_trash" size={14} /> RESET ALL PROGRESS
            </button>
          ) : (
            <div style={{ background: '#1a0508', border: '2px solid #b51d28', borderRadius: 4, padding: 14 }}>
              <div style={{ color: '#ff6675', fontFamily: 'VT323, monospace', fontSize: 14, letterSpacing: '0.15em', marginBottom: 10, textAlign: 'center' }}>
                ARE YOU SURE? Everything is wiped — gold, weapons, parts, achievements.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  data-testid="confirm-reset-btn"
                  onClick={() => { Audio.click('danger'); setConfirmReset(false); onReset?.(); onClose(); }}
                  style={{ flex: 1, padding: '10px', background: '#b51d28', borderColor: '#ff3146', color: '#fff', fontFamily: 'VT323, monospace', fontSize: 16 }}
                >
                  YES, RESET
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  style={{ flex: 1, padding: '10px', background: '#0a0612' }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#555', fontFamily: 'VT323, monospace', marginTop: 6, textAlign: 'center', letterSpacing: '0.1em' }}>
            Your purchase receipt is kept (tied to the Google account).
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Inventory / Parts equipper ----------
export function PartsInventory({ save, setSave, onClose }) {
  const parts = save.parts || [];
  const equipped = save.equippedParts || {}; // { weaponId: { slot: partId } }
  const [wid, setWid] = useState(Object.keys(STARTER_WEAPONS)[0]);
  const cw = save.craftedWeapons || { hydropistol: true };
  const weaponList = Object.keys(STARTER_WEAPONS).filter(k => k === 'hydropistol' || cw[k]);
  const equipPart = (part) => {
    const cur = { ...(equipped[wid] || {}) };
    cur[part.slot] = part.id;
    setSave({ ...save, equippedParts: { ...equipped, [wid]: cur } });
    Audio.click();
  };
  const unequipSlot = (slot) => {
    const cur = { ...(equipped[wid] || {}) };
    delete cur[slot];
    setSave({ ...save, equippedParts: { ...equipped, [wid]: cur } });
  };
  const sellPart = (part) => {
    const val = ({ common: 20, uncommon: 60, rare: 200, epic: 800, legendary: 3000, mythical: 8000 })[part.rarity] || 10;
    const inv = parts.filter(p => p.id !== part.id);
    const cleared = { ...equipped };
    for (const w of Object.keys(cleared)) if (cleared[w] && cleared[w][part.slot] === part.id) delete cleared[w][part.slot];
    setSave({ ...save, parts: inv, gold: (save.gold || 0) + val, equippedParts: cleared });
  };
  return (
    <div className="modal-overlay" data-testid="parts-inv" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel parts-panel">
        <div className="forge-header">
          <div className="forge-title"><GameIcon name="ui_cog" size={17} /> PARTS WORKSHOP</div>
          <div className="forge-gold">★ {save.gold}</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>
        <div className="forge-weapons">
          {weaponList.map(id => (
            <div key={id} className={`forge-wch ${wid === id ? 'sel' : ''}`} onClick={() => setWid(id)} data-testid={`pi-w-${id}`}>
              <GameIcon name={id} size={26} />
              <div style={{ fontSize: 10 }}>{STARTER_WEAPONS[id].name}</div>
            </div>
          ))}
        </div>
        <div className="forge-name"><GameIcon name={wid} size={18} /> {STARTER_WEAPONS[wid].name}</div>
        <div style={{ marginTop: 10, marginBottom: 8, color: 'var(--accent-2)', letterSpacing: '0.2em', fontSize: 13 }}>EQUIPPED PARTS</div>
        <div className="parts-slots">
          {PART_SLOTS.map(slot => {
            const eqId = (equipped[wid] || {})[slot];
            const part = parts.find(p => p.id === eqId);
            return (
              <div key={slot} className="part-slot">
                <div className="ps-name"><GameIcon name={PART_SLOT_INFO[slot].icon} size={16} /> {slot}</div>
                {part ? (
                  <div className={`part-chip ${PART_RAR_CLS[part.rarity]}`} onClick={() => unequipSlot(slot)}>
                    <div style={{ fontWeight: 800 }}>{part.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>+{Math.round(part.primary.val * 100) / 100} {STAT_DISPLAY[part.primary.stat] || part.primary.stat}</div>
                  </div>
                ) : <div className="ps-empty">— empty —</div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, color: 'var(--accent-2)', letterSpacing: '0.2em', fontSize: 13 }}>INVENTORY ({parts.length})</div>
        {parts.length === 0 && <div style={{ color: 'var(--ink-dim)', fontFamily: 'VT323', padding: 10 }}>No parts yet. Run missions to find some.</div>}
        <div className="inv-row">
          {parts.map(p => (
            <div className={`part-chip ${PART_RAR_CLS[p.rarity]}`} key={p.id} data-testid={`part-${p.id}`}>
              <div style={{ fontWeight: 800, fontSize: 11 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-dim)' }}>{p.slot}</div>
              <div style={{ fontSize: 10 }}>+{Math.round(p.primary.val * 100) / 100} {STAT_DISPLAY[p.primary.stat] || p.primary.stat}</div>
              {p.sub.map((s, i) => <div key={i} style={{ fontSize: 10, color: 'var(--ink-dim)' }}>+{Math.round(s.val * 100) / 100} {STAT_DISPLAY[s.stat] || s.stat}</div>)}
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                <button onClick={() => equipPart(p)} style={{ padding: '3px 5px', fontSize: 10 }}>Equip</button>
                <button onClick={() => sellPart(p)} style={{ padding: '3px 5px', fontSize: 10 }}>Sell</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


const DIFF_LABEL = ['INTRO', 'EASY', 'MEDIUM', 'HARD'];
const DIFF_COLOR = ['#7cd6ff', '#4dffd4', '#ffd166', '#ff7a1a'];

export function MapsPanel({ save, setSave, onStart }) {
  // Reads the ACTIVE tier's ledger, so switching to Hard shows a fresh map
  // with everything to do again rather than a wall of ✓ CLEARED from Normal.
  const progress = progressFor(save);

  const canUnlockStage = (stage) => {
    if (!stage.unlock) return true;
    const val = save[stage.unlock.metric] || 0;
    return val >= stage.unlock.goal;
  };

  const canStartNode = (stage, node) => {
    if (!canUnlockStage(stage)) return false;
    if (!node.unlockGoal) return true;
    return !!progress[node.unlockGoal];
  };

  const startNode = (stage, node) => {
    Audio.click('confirm');
    onStart({
      isMap: true,
      mapNodeId: node.id,
      duration: node.duration,
      spawnMult: node.spawnMult,
      stageId: stage.id,
      rwd: node.rwd,
      name: `${stage.name} — ${node.name}`,
    });
  };

  return (
    <>
      <div className="camp-header"><h1>World Map</h1></div>
      <DifficultyPicker save={save} setSave={setSave} />
      <div className="maps-grid">
        {MAP_STAGES.map(stage => {
          const unlocked = canUnlockStage(stage);
          const stageComplete = stage.nodes.every(n => progress[n.id]);
          return (
            <div className={`map-stage-card ${unlocked ? '' : 'locked'} ${stageComplete ? 'complete' : ''}`} key={stage.id} data-testid={`map-stage-${stage.id}`}
              style={{ borderColor: unlocked ? stage.color + '88' : '#333', boxShadow: unlocked ? `0 0 18px ${stage.color}22` : 'none' }}>
              <div className="map-stage-head" style={{ color: stage.color }}>
                <GameIcon name={stage.icon} size={22} />
                <span className="map-stage-name">{stage.name}</span>
                {stageComplete && <span className="map-stage-done">DONE</span>}
              </div>
              <div className="map-stage-desc">{stage.desc}</div>
              {!unlocked && stage.unlock && (
                <div className="map-stage-lock"><GameIcon name="ui_lock" size={12} /> Unlock: {stage.unlock.label} ({save[stage.unlock.metric] || 0}/{stage.unlock.goal})</div>
              )}
              {unlocked && (
                <div className="map-nodes">
                  {stage.nodes.map((node, idx) => {
                    const done = !!progress[node.id];
                    const canStart = canStartNode(stage, node);
                    const mins = Math.floor(node.duration / 60);
                    const secs = node.duration % 60;
                    const timeLabel = mins > 0 ? `${mins}m${secs > 0 ? secs + 's' : ''}` : `${secs}s`;
                    return (
                      <React.Fragment key={node.id}>
                        {idx > 0 && (
                          <div className="node-connector" aria-hidden />
                        )}
                      <div className={`map-node ${done ? 'done' : ''} ${canStart && !done ? 'available' : ''} ${!canStart && !done ? 'locked' : ''}`} key={node.id} data-testid={`map-node-${node.id}`}>
                        <div className="node-diff" style={{ color: DIFF_COLOR[node.diff] || DIFF_COLOR[0] }}>{DIFF_LABEL[node.diff] || DIFF_LABEL[0]}</div>
                        <div className="node-name">{node.name}</div>
                        <div className="node-meta">{timeLabel} · ×{node.spawnMult} spawn</div>
                        <div className="node-rwd">
                          {node.rwd.gold && <span className="node-rwd-item"><GameIcon name="cur_gold" size={12} /> {node.rwd.gold}</span>}
                          {node.rwd.sp   && <span className="node-rwd-item"><GameIcon name="cur_sp" size={12} /> {node.rwd.sp} SP</span>}
                        </div>
                        {done
                          ? <div className="map-node-cleared">CLEARED</div>
                          : <button disabled={!canStart} onClick={() => startNode(stage, node)}
                              style={{ borderColor: canStart ? stage.color : '#444', color: canStart ? stage.color : '#555' }}>
                              {canStart ? 'START' : <><GameIcon name="ui_lock" size={11} /> LOCKED</>}
                            </button>
                        }
                      </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- Daily Rewards Drawer (Image 3) ----------
export const DAILY_REWARDS_TABLE = [
  { day: 1, name: 'Gold Pack', icon: 'cur_gold', desc: '500 Gold', type: 'gold', val: 500, color: '#ffd166' },
  { day: 2, name: 'Material boxes', icon: 'gear', desc: '10 Gear Parts', type: 'gear', val: 10, color: '#9a8fa6' },
  { day: 3, name: 'Energy boxes', icon: 'ui_bolt', desc: '5 Mission Energy', type: 'energy', val: 5, color: '#4dc4ff' },
  { day: 4, name: 'Energy cache', icon: 'ui_bolt', desc: '2 Skill Points', type: 'sp', val: 2, color: '#4dffd4' },
  { day: 5, name: 'Material boxes', icon: 'gear', desc: '15 Gear Parts', type: 'gear', val: 15, color: '#b362ff' },
  { day: 6, name: 'Energy boxes', icon: 'ui_leaf', desc: '2 Talent Points', type: 'tp', val: 2, color: '#7ad96b' },
  { day: 7, name: 'Epic War Case', icon: 'ui_chest', desc: 'Legendary Chest & 1000g', type: 'epicCase', val: 1000, color: '#ff7a1a' },
];

export function DailyRewardsWidget({ save, setSave }) {
  const daily = save.daily || { lastClaim: 0, streak: 0 };
  const nowDay = Math.floor(Date.now() / 86400000);
  const lastDay = daily.lastClaim || 0;
  const isClaimable = nowDay > lastDay;
  const currentStreak = (daily.streak || 0) % 7; // 0 to 6

  const claimReward = (e) => {
    if (!isClaimable) return;
    const rwd = DAILY_REWARDS_TABLE[currentStreak];
    const newStreak = (daily.streak || 0) + 1;
    const ns = {
      ...save,
      daily: { lastClaim: nowDay, streak: newStreak },
    };

    const bag = {};
    if (rwd.type === 'gold') {
      ns.gold = (ns.gold || 0) + rwd.val;
      bag.gold = rwd.val;
    } else if (rwd.type === 'sp') {
      ns.sp = (ns.sp || 0) + rwd.val;
      bag.sp = rwd.val;
    } else if (rwd.type === 'tp') {
      ns.talentPoints = (ns.talentPoints || 0) + rwd.val;
      bag.talentPoints = rwd.val;
    } else if (rwd.type === 'gear') {
      ns.gearParts = (ns.gearParts || 0) + rwd.val;
      bag.gearParts = rwd.val;
    } else if (rwd.type === 'epicCase') {
      ns.gold = (ns.gold || 0) + rwd.val;
      ns.chests = { ...(ns.chests || {}), legendary: (ns.chests?.legendary || 0) + 1 };
      bag.gold = rwd.val;
      bag.gear = 1;
    }

    setSave(ns);
    fireClaimFx(e?.currentTarget, bag, { flyTo: CAMP_CLAIM_FLY });
    pushToast({
      key: `daily-widget:${nowDay}`, once: true,
      tone: 'gold', title: `DAY ${rwd.day} CLAIMED!`, text: rwd.name, icon: rwd.icon,
    });
  };

  const progressPct = Math.min(100, ((currentStreak + (isClaimable ? 0 : 1)) / 7) * 100);

  return (
    <div className="daily-rewards-widget" data-testid="daily-rewards-widget">
      <div className="dr-header">
        <div className="dr-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <GameIcon name="ui_calendar" size={16} tone="#ffd166" />
          <span>DAILY REWARDS</span>
        </div>
        <div className="dr-day7-preview" title="Day 7: Epic War Case">
          <GameIcon name="ui_chest" size={16} tone="#b362ff" />
        </div>
      </div>

      <div className="dr-cards-row">
        {DAILY_REWARDS_TABLE.map((r, idx) => {
          const isCurrent = idx === currentStreak;
          const isClaimed = idx < currentStreak || (idx === currentStreak && !isClaimable);
          return (
            <div
              key={r.day}
              className={`dr-card${isCurrent && isClaimable ? ' dr-card-active' : ''}${isClaimed ? ' dr-card-claimed' : ''}`}
              style={{ '--r-color': r.color }}
            >
              <div className="dr-card-day">DAY {r.day}</div>
              <div className="dr-card-icon">
                <GameIcon name={r.icon} size={22} tone={r.color} />
              </div>
              <div className="dr-card-name">{r.name}</div>
              {isClaimed && <span className="dr-check">✓</span>}
            </div>
          );
        })}
      </div>

      <div className="dr-action-bar">
        <button
          className={`dr-claim-btn${isClaimable ? ' dr-can-claim' : ''}`}
          onClick={claimReward}
          disabled={!isClaimable}
          data-testid="daily-claim-btn"
        >
          {isClaimable ? 'CLAIM REWARD' : 'CLAIMED TODAY'}
        </button>
        <div className="dr-progress-track">
          <div className="dr-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="dr-lock-icon">
          <GameIcon name={progressPct >= 100 ? 'ui_star' : 'ui_lock'} size={13} tone="#4dc4ff" />
        </span>
      </div>
    </div>
  );
}
