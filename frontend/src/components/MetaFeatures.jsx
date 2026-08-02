import React, { useState, useEffect } from 'react';
import { ENEMIES } from '../game/data';
import { STARTER_WEAPONS, ACHIEVEMENTS } from '../game/data_ext2';
import { rollGearDrop } from '../game/gear';

// ─── Eye of Horus badge SVG ───────────────────
export function EyeBadge({ size = 14 }) {
  return (
    <span className="eye-badge" title="New!">
      <svg viewBox="0 0 26 16" width={size} height={Math.round(size * 0.62)} aria-hidden="true">
        {/* Kohl liner — lower lash */}
        <path d="M13 14 C7 14 2 10 1 8.5" stroke="#ffd700" strokeWidth="0.8" fill="none" opacity="0.5"/>
        {/* Outer eye */}
        <path d="M13 1.5 C5 1.5 1 8 1 8 C1 8 5 14.5 13 14.5 C21 14.5 25 8 25 8 C25 8 21 1.5 13 1.5 Z"
          fill="#050010" stroke="#ffd700" strokeWidth="1.4"/>
        {/* Iris */}
        <circle cx="13" cy="8" r="4.2" fill="#12083a" stroke="#ffd700" strokeWidth="0.9"/>
        {/* Pupil */}
        <circle cx="13" cy="8" r="2.1" fill="#000005"/>
        {/* Shine */}
        <circle cx="14.4" cy="6.6" r="1" fill="#ffd70060"/>
        {/* Ra's tear drop (Eye of Horus marker) */}
        <path d="M13 12.8 L14.8 15.5 L13 14.5 L11.2 15.5 Z" fill="#ffd700" opacity="0.7"/>
      </svg>
    </span>
  );
}

// ─── PATROL SYSTEM ────────────────────────────
const PATROL_DEFS = [
  { id:'scavenge', name:'Scavenge',  icon:'🔍', dur:60*60*1000,   rwd:{ gold:800 },            desc:'1h — Search ruins for gold & supplies.' },
  { id:'explore',  name:'Explore',   icon:'🗺', dur:2*60*60*1000, rwd:{ gems:5 },              desc:'2h — Venture deep for rare gems.' },
  { id:'hunt',     name:'Hunt',      icon:'⚔',  dur:3*60*60*1000, rwd:{ gear:true },            desc:'3h — Track enemies and return with gear.' },
  { id:'void',     name:'Void Raid', icon:'💀', dur:4*60*60*1000, rwd:{ sp:8, gems:8, xp:400 }, desc:'4h — Raid the void — SP, gems & XP.' },
];
const MAX_PATROL = 3;

function fmtTimeLeft(startMs, durMs) {
  const rem = Math.max(0, startMs + durMs - Date.now());
  if (rem === 0) return 'COMPLETE';
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function pctDone(startMs, durMs) {
  return Math.min(100, ((Date.now() - startMs) / durMs) * 100);
}

export function PatrolPanel({ save, setSave }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 8000);
    return () => clearInterval(t);
  }, []);

  const missions = save.patrol?.missions || [];
  const active = missions.filter(m => m.status !== 'claimed');
  const canAdd  = active.length < MAX_PATROL;
  const hasPet  = (save.pets || []).some(p => p.active);
  const petMult = hasPet ? 1.2 : 1;

  // Auto-complete missions whose time has elapsed
  const checkComplete = () => {
    let changed = false;
    const updated = missions.map(m => {
      if (m.status === 'active' && now - m.startMs >= m.durationMs) {
        changed = true;
        return { ...m, status: 'complete' };
      }
      return m;
    });
    if (changed) setSave({ ...save, patrol: { missions: updated } });
    return updated;
  };
  const liveMissions = missions.map(m =>
    (m.status === 'active' && now - m.startMs >= m.durationMs) ? { ...m, status: 'complete' } : m
  );

  const sendMission = (defId) => {
    if (!canAdd) return;
    const def = PATROL_DEFS.find(d => d.id === defId);
    const newM = {
      id: `p_${Date.now().toString(36)}`,
      defId, startMs: Date.now(), durationMs: def.dur, status: 'active'
    };
    setSave({ ...save, patrol: { missions: [...missions, newM] } });
  };

  const claimMission = (mId) => {
    const m = liveMissions.find(x => x.id === mId);
    if (!m || m.status !== 'complete') return;
    const def = PATROL_DEFS.find(d => d.id === m.defId);
    let ns = { ...save };
    const rwd = def.rwd;
    if (rwd.gold)  ns.gold  = (ns.gold  || 0) + Math.round(rwd.gold  * petMult);
    if (rwd.gems)  ns.gems  = (ns.gems  || 0) + Math.round(rwd.gems  * petMult);
    if (rwd.sp)    ns.sp    = (ns.sp    || 0) + Math.round(rwd.sp    * petMult);
    if (rwd.xp)    ns.profile = { ...ns.profile, xp: (ns.profile?.xp || 0) + Math.round(rwd.xp * petMult) };
    if (rwd.gear) {
      const item = rollGearDrop(m.durationMs / 1000);
      ns.gearInventory = [...(ns.gearInventory || []), item];
    }
    ns.patrol = { missions: liveMissions.map(x => x.id === mId ? { ...x, status: 'claimed' } : x) };
    setSave(ns);
  };

  const cancelMission = (mId) => {
    setSave({ ...save, patrol: { missions: missions.filter(x => x.id !== mId) } });
  };

  return (
    <div className="patrol-panel" data-testid="patrol-panel">
      <div className="patrol-header">
        <span className="patrol-title">PATROL MISSIONS</span>
        <span className="patrol-slots">{active.length}/{MAX_PATROL} slots</span>
        {hasPet && <span className="patrol-pet-bonus">🐾 +20% reward (pet active)</span>}
      </div>

      {/* Active missions */}
      {liveMissions.filter(m => m.status !== 'claimed').map(m => {
        const def = PATROL_DEFS.find(d => d.id === m.defId);
        const done = m.status === 'complete';
        const pct  = pctDone(m.startMs, m.durationMs);
        const left = fmtTimeLeft(m.startMs, m.durationMs);
        return (
          <div key={m.id} className={`patrol-mission ${done ? 'done' : 'active'}`} data-testid={`patrol-m-${m.defId}`}>
            <span className="patrol-m-icon">{def.icon}</span>
            <div className="patrol-m-info">
              <span className="patrol-m-name">{def.name}</span>
              <span className="patrol-m-status">{done ? '✓ COMPLETE — CLAIM NOW' : left}</span>
              {!done && <div className="patrol-bar"><div className="patrol-bar-fill" style={{ width: pct + '%' }}/></div>}
            </div>
            {done && (
              <button className="patrol-btn claim" onClick={() => claimMission(m.id)} data-testid={`patrol-claim-${m.defId}`}>
                CLAIM{rwd_preview(def, petMult)}
              </button>
            )}
            {!done && (
              <button className="patrol-btn cancel" onClick={() => cancelMission(m.id)}>✕</button>
            )}
          </div>
        );
      })}

      {/* Send mission */}
      {canAdd && (
        <div className="patrol-send-section">
          <div className="patrol-send-title">SEND ON MISSION</div>
          <div className="patrol-defs">
            {PATROL_DEFS.map(def => {
              const already = liveMissions.some(m => m.status !== 'claimed' && m.defId === def.id);
              return (
                <div key={def.id} className={`patrol-def ${already ? 'running' : ''}`} data-testid={`patrol-def-${def.id}`}>
                  <span className="patrol-def-icon">{def.icon}</span>
                  <div className="patrol-def-info">
                    <span className="patrol-def-name">{def.name}</span>
                    <span className="patrol-def-desc">{def.desc}</span>
                    <span className="patrol-def-rwd">{rwd_preview(def, petMult)}</span>
                  </div>
                  <button
                    className="patrol-btn send"
                    onClick={() => sendMission(def.id)}
                    disabled={already}
                    data-testid={`patrol-send-${def.id}`}
                  >
                    {already ? 'ON PATROL' : 'SEND'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!canAdd && liveMissions.every(m => m.status === 'active') && (
        <div className="patrol-full">All patrol slots in use. Return when missions complete.</div>
      )}
    </div>
  );
}

function rwd_preview(def, mult = 1) {
  const r = def.rwd;
  const parts = [];
  if (r.gold)  parts.push(`${Math.round(r.gold  * mult)}★`);
  if (r.gems)  parts.push(`${Math.round(r.gems  * mult)}💎`);
  if (r.sp)    parts.push(`${Math.round(r.sp    * mult)}SP`);
  if (r.xp)    parts.push(`${Math.round(r.xp    * mult)}XP`);
  if (r.gear)  parts.push(`1 Gear`);
  return ' — ' + parts.join(', ');
}

// ─── BATTLE PASS ─────────────────────────────────────────
const BP_REWARDS = Array.from({ length: 40 }, (_, i) => {
  const n = i + 1;
  if (n % 20 === 0) return { type:'gem',    amount:20,          icon:'💎', label:`${20} Gems` };
  if (n % 10 === 0) return { type:'shard',  amount:1,           icon:'🔮', label:`Shard` };
  if (n % 5  === 0) return { type:'slot',   amount:3,           icon:'🎰', label:`3 Coins` };
  if (n % 4  === 0) return { type:'gold',   amount:500+n*50,    icon:'💰', label:`${500+n*50}★` };
  if (n % 3  === 0) return { type:'gem',    amount:5,           icon:'💎', label:`5 Gems` };
  if (n % 2  === 0) return { type:'talent', amount:5,           icon:'◆',  label:`5 TP` };
  return              { type:'gold',   amount:200+n*20,    icon:'💰', label:`${200+n*20}★` };
});
const XP_PER_NODE = 200;

export function BattlePassPanel({ save, setSave }) {
  const claimed     = save.battlePass?.claimed || [];
  const profileXp   = save.profile?.xp || 0;
  const reachedNode = Math.floor(profileXp / XP_PER_NODE);
  const unclaimed   = BP_REWARDS.filter((_, i) => i <= reachedNode && !claimed.includes(i)).length;

  const claim = (i) => {
    if (i > reachedNode || claimed.includes(i)) return;
    const rwd = BP_REWARDS[i];
    let ns = { ...save, battlePass: { claimed: [...claimed, i] } };
    if (rwd.type === 'gold')   ns.gold         = (ns.gold         || 0) + rwd.amount;
    if (rwd.type === 'gem')    ns.gems         = (ns.gems         || 0) + rwd.amount;
    if (rwd.type === 'slot')   ns.slotCoins    = (ns.slotCoins    || 0) + rwd.amount;
    if (rwd.type === 'talent') ns.talentPoints = (ns.talentPoints || 0) + rwd.amount;
    if (rwd.type === 'shard')  ns.character    = { ...ns.character, shards: (ns.character?.shards || 0) + rwd.amount };
    setSave(ns);
  };

  return (
    <div className="bp-panel" data-testid="bp-panel">
      <div className="bp-header">
        <span className="bp-title">SEASON PASS</span>
        <span className="bp-progress">XP: {profileXp} / {40 * XP_PER_NODE}</span>
        {unclaimed > 0 && <span className="bp-unclaimed">{unclaimed} rewards ready!</span>}
      </div>
      <div className="bp-desc">Earn XP from runs. Each {XP_PER_NODE} XP = 1 reward node.</div>
      <div className="bp-track" data-testid="bp-track">
        {BP_REWARDS.map((rwd, i) => {
          const reached   = i <= reachedNode;
          const isClaimed = claimed.includes(i);
          const canClaim  = reached && !isClaimed;
          return (
            <div key={i} className={`bp-node ${reached?'reached':''} ${isClaimed?'claimed':''} ${canClaim?'claimable':''}`}
              onClick={() => canClaim && claim(i)} data-testid={`bp-node-${i}`}>
              <span className="bp-node-icon">{rwd.icon}</span>
              <span className="bp-node-label">{rwd.label}</span>
              {isClaimed && <span className="bp-check">✓</span>}
              {canClaim  && <span className="bp-glow-ring"/>}
              <span className="bp-node-num">{i+1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CODEX ────────────────────────────────────────────────
const ENEMY_LORE = {
  slime:'A gelatinous organism mutated by Lake contamination. Weak, but legion.',
  bat:'Voidbat — phase-shifted creature drawn to dimensional rifts. Fast and unpredictable.',
  brute:'Mutant humanoid reinforced by crystallized water. Slow but devastating.',
  ranger:'A corrupted soldier armed with liquid-nitrogen projectile launchers.',
  charger:'Void-energy overload turns this creature into a living battering ram.',
  ghoul:'Undead water-walker. Killed before — won\'t stay dead.',
  necron:'Necron: survived multiple extinction cycles. Treat with respect.',
  crystalite:'Crystal-armored insectoid. Energy attacks bounce off.',
  soulshard:'Fragmented consciousness crystallized into razor-sharp shards. Immune to knockback.',
  bonewalker:'Animated skeletal structure that regenerates faster than you can break it.',
  voidspawn:'Born from a void fracture. Rapid, vicious, no negotiation.',
  steelbrute:'Bio-mechanical juggernaut. Failed experiments on Brutes.',
  lightningbug:'Overcharged insectoid. When it dies, it discharges. Distance recommended.',
  techsoldier:'Military-grade automaton. Fires tracking rounds. Priority target.',
  nanoswarm:'Microscopic killer-bots organized into a lethal swarm.',
  bossOcular:'The Eye of Horus — an ancient surveillance construct awakened by the Lake.',
  bossNecromancer:'Nekromansen — a failed immortality experiment that feeds on death itself.',
  bossVoidTitan:'The Void Titan. Presence alone warps spacetime. The Lake is its egg.',
  bossAida:'A.I.D.A. — Adaptive Intelligence Defense Array. Created to protect. Has other plans.',
};

function getAchMetric(save, k) {
  if (k === 'skillsLearned') return Object.values(save.skills || {}).reduce((a,b)=>a+b,0);
  if (k === 'activeSkillsCount') return (save.equippedActives||[]).filter(Boolean).length;
  if (k === 'weaponsCrafted') return Object.keys(save.craftedWeapons||{}).length;
  if (k === 'challengesCompleted') return Object.keys(save.challengesDone||{}).length;
  if (k === 'dailyStreak') return save.daily?.streak || 0;
  if (k === 'legendaryPartsFound') return save.legendaryPartsFound || 0;
  if (k === 'chestsOpened') return save.chestsOpened || 0;
  if (k === 'lifetimeGold') return save.lifetimeGold || save.gold || 0;
  if (k === 'noHitRuns') return save.noHitRuns || 0;
  if (k === 'necroSlain') return save.necroSlain || 0;
  if (k === 'voidSlain') return save.voidSlain || 0;
  if (k === 'horusSlain') return save.horusSlain || 0;
  if (k === 'endlessReached') return save.endlessReached || 0;
  return save[k] || 0;
}

const ALL_ENEMY_IDS = Object.keys(ENEMIES).filter(id => !ENEMIES[id].boss);
const ALL_BOSS_IDS  = Object.keys(ENEMIES).filter(id =>  ENEMIES[id].boss);

export function CodexPanel({ save, setSave }) {
  const [tab, setTabC] = useState('enemies');
  const codex  = save.codex || {};
  const killed  = codex.enemies   || {};
  const weapons = codex.weapons   || {};
  const claimed = codex.claimedDiscoveries || [];
  const achClaimed = save.achClaimed || {};

  const totalDiscovered = Object.keys(killed).length + Object.keys(weapons).length;
  const totalClaimable  = [...Object.keys(killed), ...Object.keys(weapons)].filter(id => !claimed.includes(id)).length;

  const claimDiscovery = (id) => {
    if (claimed.includes(id)) return;
    setSave({
      ...save,
      gems: (save.gems || 0) + 1,
      codex: { ...save.codex, claimedDiscoveries: [...claimed, id] }
    });
  };

  const claimAch = (a) => {
    if (achClaimed[a.id]) return;
    if (getAchMetric(save, a.metric) < a.goal) return;
    let ns = { ...save, achClaimed: { ...achClaimed, [a.id]: true } };
    if (a.rwd.gold) ns.gold = (ns.gold || 0) + a.rwd.gold;
    if (a.rwd.sp)   ns.sp   = (ns.sp   || 0) + a.rwd.sp;
    if (a.rwd.gems) ns.gems = (ns.gems || 0) + a.rwd.gems;
    setSave(ns);
  };

  const achDone     = ACHIEVEMENTS.filter(a => getAchMetric(save, a.metric) >= a.goal).length;
  const achUnclaimed= ACHIEVEMENTS.filter(a => getAchMetric(save, a.metric) >= a.goal && !achClaimed[a.id]).length;

  return (
    <div className="codex-panel" data-testid="codex-panel">
      <div className="codex-header">
        <span className="codex-title">CODEX</span>
        <span className="codex-count">{totalDiscovered} entries</span>
        {totalClaimable > 0 && (
          <span className="codex-claim-hint">
            {totalClaimable} unclaimed 💎
          </span>
        )}
      </div>

      <div className="codex-tabs">
        {[
          ['enemies',  'ENEMIES'],
          ['bosses',   'BOSSES'],
          ['weapons',  'WEAPONS'],
          ['ach',      `ACHIEVEMENTS${achUnclaimed > 0 ? ` (${achUnclaimed})` : ''}`],
        ].map(([k,l])=>(
          <button key={k} className={`codex-tab ${tab===k?'active':''}`} onClick={() => setTabC(k)}
            style={k==='ach' && achUnclaimed > 0 ? {color:'#ffd700', borderColor:'#ffd70055'} : {}}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'enemies' && (
        <div className="codex-grid">
          {ALL_ENEMY_IDS.map(id => {
            const e = ENEMIES[id];
            const disc = (killed[id]?.count || 0) > 0;
            const alrClaimed = claimed.includes(id);
            return (
              <div key={id} className={`codex-entry ${disc?'found':'unknown'}`} data-testid={`codex-enemy-${id}`}>
                <div className="codex-entry-icon" style={{color: disc ? e.color : '#2a1a4e'}}>●</div>
                <div className="codex-entry-info">
                  <div className="codex-entry-name">{disc ? e.name : '???'}</div>
                  <div className="codex-entry-lore">{disc ? (ENEMY_LORE[id]||'Unknown entity.') : 'Kill this enemy to reveal.'}</div>
                  {disc && <div className="codex-entry-kills">Kills: {killed[id]?.count||0}×</div>}
                </div>
                {disc && !alrClaimed && (
                  <button className="codex-claim-btn" onClick={() => claimDiscovery(id)} data-testid={`codex-claim-${id}`}>
                    💎 +1
                  </button>
                )}
                {disc && alrClaimed && <span className="codex-claimed-badge">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'bosses' && (
        <div className="codex-grid">
          {ALL_BOSS_IDS.map(id => {
            const e = ENEMIES[id];
            const disc = (killed[id]?.count || 0) > 0;
            const alrClaimed = claimed.includes(id);
            return (
              <div key={id} className={`codex-entry boss ${disc?'found':'unknown'}`} data-testid={`codex-boss-${id}`}>
                <div className="codex-entry-icon" style={{color: disc ? e.color : '#2a1a4e', fontSize:22}}>◉</div>
                <div className="codex-entry-info">
                  <div className="codex-entry-name">{disc ? e.name : '???'}</div>
                  <div className="codex-entry-lore">{disc ? (ENEMY_LORE[id]||'A dangerous entity.') : 'Defeat this boss to reveal lore.'}</div>
                  {disc && <div className="codex-entry-kills" style={{color:'#ff3146'}}>Defeats: {killed[id]?.count||0}×</div>}
                </div>
                {disc && !alrClaimed && (
                  <button className="codex-claim-btn boss-claim" onClick={() => claimDiscovery(id)} data-testid={`codex-claim-${id}`}>
                    💎 +1
                  </button>
                )}
                {disc && alrClaimed && <span className="codex-claimed-badge">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'weapons' && (
        <div className="codex-grid">
          {Object.entries(STARTER_WEAPONS || {}).map(([wid, w]) => {
            const disc = (weapons[wid]?.count || 0) > 0;
            const alrClaimed = claimed.includes(wid);
            return (
              <div key={wid} className={`codex-entry ${disc?'found':'unknown'}`} data-testid={`codex-weapon-${wid}`}>
                <div className="codex-entry-icon" style={{color: disc ? '#ffd166' : '#2a1a4e', fontSize:20}}>⚙</div>
                <div className="codex-entry-info">
                  <div className="codex-entry-name">{disc ? (w.name||wid) : '???'}</div>
                  <div className="codex-entry-lore">{disc ? (w.desc||'A weapon of the Lake.') : 'Use this weapon in a run.'}</div>
                  {disc && <div className="codex-entry-kills" style={{color:'#ffd166'}}>Runs: {weapons[wid]?.count||0}×</div>}
                </div>
                {disc && !alrClaimed && (
                  <button className="codex-claim-btn" onClick={() => claimDiscovery(wid)} data-testid={`codex-claim-${wid}`}>
                    💎 +1
                  </button>
                )}
                {disc && alrClaimed && <span className="codex-claimed-badge">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'ach' && (
        <div className="codex-grid">
          <div className="codex-ach-summary">
            {achDone} / {ACHIEVEMENTS.length} completed · {achUnclaimed} rewards pending
          </div>
          {ACHIEVEMENTS.map(a => {
            const v    = getAchMetric(save, a.metric);
            const done = v >= a.goal;
            const cls  = achClaimed[a.id];
            const pct  = Math.min(100, (v / a.goal) * 100);
            return (
              <div key={a.id} className={`codex-entry ach-entry ${done?'found':''} ${cls?'claimed-ach':''}`}
                data-testid={`codex-ach-${a.id}`}>
                <div className="codex-entry-icon" style={{fontSize:20}}>{a.icon}</div>
                <div className="codex-entry-info">
                  <div className="codex-entry-name" style={{color: done ? '#e0d0ff' : '#5a4a7e'}}>{a.name}</div>
                  <div className="codex-entry-lore">{a.desc}</div>
                  <div style={{height:4, background:'#1a0a2e', borderRadius:2, margin:'4px 0', overflow:'hidden'}}>
                    <div style={{width:pct+'%', height:'100%', background: done ? '#ffd700' : '#b362ff', transition:'width .3s'}}/>
                  </div>
                  <div style={{fontSize:10, color:'#4a3a6e'}}>{Math.min(v,a.goal)} / {a.goal}</div>
                  <div className="codex-ach-rwd">
                    {a.rwd.gold && <span>★ {a.rwd.gold}</span>}
                    {a.rwd.sp   && <span>◆ {a.rwd.sp} SP</span>}
                    {a.rwd.gems && <span>💎 {a.rwd.gems}</span>}
                  </div>
                </div>
                {done && !cls && (
                  <button className="codex-claim-btn" onClick={() => claimAch(a)} data-testid={`codex-claim-ach-${a.id}`}>
                    CLAIM
                  </button>
                )}
                {cls && <span className="codex-claimed-badge">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
