import React, { useEffect, useState } from 'react';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

const fmt = (t) => {
  const m = Math.floor(t / 60); const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Profile XP is a flat 200-per-rank ladder — same number the profile bar
// and the rank-up overlay both already use (see Camp.jsx) — so the bar
// drawn here always agrees with what those show, never a second formula
// that could drift from them.
const XP_PER_RANK = 200;

export default function GameOver({ result, extras, save, onCamp, onRetry, onMenu }) {
  const ex = extras || {};
  const beforeXp = (save?.profile?.xp || 0) % XP_PER_RANK;
  const gainedXp = ex.xpGained || 0;
  // Animates the bar filling from where the profile WAS to where it ends up
  // after this run's XP lands, instead of snapping straight to the result —
  // the fill itself is the "you earned this" moment.
  const [barPct, setBarPct] = useState((beforeXp / XP_PER_RANK) * 100);
  useEffect(() => {
    // If this run's XP crosses into a new rank, Camp's own LevelUpOverlay
    // owns that celebration once pendingLevelUp lands there — this bar
    // only ever shows the fill, capped at 100%, never a rank-up moment.
    const afterPct = (((beforeXp + gainedXp) % XP_PER_RANK) / XP_PER_RANK) * 100;
    const t = setTimeout(() => setBarPct(afterPct), 260);
    if (gainedXp > 0) Audio.rewardFanfare();
    return () => clearTimeout(t);
  }, [beforeXp, gainedXp]);

  const rewards = [
    { icon: 'cur_gold', label: 'Gold earned',  val: '+' + (result.gold || 0) },
    { icon: 'ui_star',  label: 'Account XP',   val: '+' + (ex.xpGained || 0) },
    { icon: 'cur_sp',   label: 'Skill Points', val: '+' + (ex.spGained || 0) },
  ];
  if (result.gearParts > 0) rewards.push({ icon: 'ui_cog', label: 'Gear Parts', val: '+' + result.gearParts });
  const badges = [];
  if (ex.isBestTime)   badges.push({ icon: 'ui_clock',    label: 'NEW BEST TIME' });
  if (ex.isBestKills)  badges.push({ icon: 'ui_bolt',     label: 'NEW LEVEL RECORD' });
  if (ex.isBestScore)  badges.push({ icon: 'ui_medal',    label: 'NEW BEST SCORE' });
  if (ex.noHit)        badges.push({ icon: 'ui_gem',      label: 'FLAWLESS RUN' });
  if (result.victory || result.aidaKilled) badges.push({ icon: 'ui_trophy', label: 'A.I.D.A. SLAIN' });
  if (result.endless)  badges.push({ icon: 'ui_infinity', label: 'ENDLESS SURVIVOR' });
  if (ex.challengeBonus) badges.push({ icon: 'ui_loadout', label: 'CHALLENGE CLEARED' });

  // Advice keyed off how the run actually ended, not off a generic template.
  // The tiers mirror campaign.js's rewardTier so the wording and the payout
  // can never disagree about how far "far enough" was.
  const nextStep = (() => {
    if (result.victory || result.aidaKilled) {
      return { head: '✓ NODE CLEARED', body: 'Three chests banked. The next node expects the gear these paid for — spend before you go.' };
    }
    const gate = ex.gateTime || 0;
    if (gate && result.time >= gate) {
      return {
        head: '◆ YOU REACHED THE GUARDIAN',
        body: 'Two chests banked. This is the fight the node was building to, and it is meant to take a few attempts — take the haul to the Camp and come back heavier.',
      };
    }
    if (gate && result.time >= gate * 0.45) {
      return {
        head: '◆ PARTIAL HAUL',
        body: 'One chest banked. Level 4 opens a second weapon slot — surviving to it is usually what turns an attempt around.',
      };
    }
    if ((result.level || 1) < 4) {
      return {
        head: '▸ KEEP MOVING',
        body: 'Standing still draws them in faster. Kite in wide circles, collect every orb, and reach level 4 for your second weapon.',
      };
    }
    return {
      head: '▸ SPEND WHAT YOU EARNED',
      body: 'Nothing in the Camp is saved for later. Gear, talents and meta all take effect on the very next run.',
    };
  })();

  return (
    <div className="modal-overlay">
      <div className={'gameover go-modern' + (result.victory || result.aidaKilled ? ' is-victory' : '')} data-testid="game-over">
        <div className="go-title">{result.endless ? '∞ ENDLESS MODE' : (result.victory || result.aidaKilled ? 'A.I.D.A. SLAIN' : 'YOU FELL')}</div>
        <div className="go-sub">
          {result.endless ? 'Aida is gone. The void remains. How long can you last?' : (result.victory || result.aidaKilled ? 'The lake awakens. The collective remembers your name.' : 'The lake mourns. Return stronger.')}
        </div>

        <div className="go-stats-grid">
          <div className="go-stat"><span>TIME</span><b>{fmt(result.time)}</b></div>
          <div className="go-stat"><span>LEVEL</span><b>{result.level}</b></div>
          <div className="go-stat"><span>KILLS</span><b>{result.kills}</b></div>
          <div className="go-stat"><span>WAVE</span><b>{Math.max(1, Math.ceil((result.time||0)/30))}</b></div>
          <div className="go-stat"><span>SCORE</span><b>{(result.score || 0).toLocaleString()}</b></div>
        </div>

        {save && (
          <div className="go-profile-xp" data-testid="go-profile-xp">
            <span className="go-profile-rank">RANK {save.profile?.level || 1}</span>
            <div className="go-profile-bar"><div className="go-profile-fill" style={{ width: `${barPct}%` }} /></div>
            <span className="go-profile-gain">+{gainedXp} XP</span>
          </div>
        )}

        <div className="go-section-title">REWARDS COLLECTED</div>
        <div className="go-rewards">
          {rewards.map((r, i) => (
            <div key={i} className="go-reward-row" data-testid={`reward-${i}`}>
              <span className="go-reward-icon"><GameIcon name={r.icon} size={20} /></span>
              <span className="go-reward-label">{r.label}</span>
              <span className="go-reward-val">{r.val}</span>
            </div>
          ))}
        </div>

        {badges.length > 0 && (
          <div className="go-badges">
            {badges.map((b, i) => (
              <div key={i} className="go-badge" data-testid={`badge-${i}`}>
                <GameIcon name={b.icon} size={18} /><b>{b.label}</b>
              </div>
            ))}
          </div>
        )}

        {/* ---- What to do next -----------------------------------------
            The whole difficulty pass rests on a node taking three to five
            attempts, and a death screen that only says "you fell" makes
            attempt two feel like a punishment rather than the plan. This
            names how far you got, what it paid, and the single most useful
            thing to go do — so a failed run ends with a direction rather
            than with a decision the player has no information for. */}
        {nextStep && (
          <div className="go-next" data-testid="go-next">
            <div className="go-next-head">{nextStep.head}</div>
            <div className="go-next-body">{nextStep.body}</div>
          </div>
        )}

        <div className="go-actions">
          <button onClick={onMenu} data-testid="go-menu" className="go-btn go-btn-ghost">↩ Menu</button>
          <button onClick={onCamp} data-testid="go-camp" className="go-btn go-btn-camp"><GameIcon name="ui_base" size={16} /> Camp</button>
          <button onClick={onRetry} data-testid="go-retry" className="go-btn go-btn-retry">↻ RETRY</button>
        </div>
      </div>
    </div>
  );
}
