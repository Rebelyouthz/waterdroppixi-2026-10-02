import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Audio } from '../game/audio';
import { REWARD_TIERS } from '../game/campaign';
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

// ---- Campaign payout ledger --------------------------------------------
// This used to be its own screen (PayoutScreen.jsx), stacked ON TOP of this
// one for every campaign run — Timmy: "vill det är en death screen ... inte
// flera men den som finns ska visa allt". One screen now. `ITEM_META`/
// `ORDER`/`CountTo` are what PayoutScreen used to own; folded in here since
// nothing else imported them.
const ITEM_META = {
  gold:         { icon: 'cur_gold', name: 'Gold',          tone: 'gold' },
  gems:         { icon: 'cur_gems', name: 'Gems',          tone: 'gem' },
  sp:           { icon: 'cur_sp',   name: 'Skill Points',  tone: 'rune' },
  talentPoints: { icon: 'cur_tp',   name: 'Talent Points', tone: 'green' },
  gearParts:    { icon: 'ui_cog',   name: 'Gear Parts',    tone: 'steel' },
  petFood:      { icon: 'petFood',  name: 'Pet Food',      tone: 'warm' },
  slotCoins:    { icon: 'cur_slot', name: 'Slot Coins',    tone: 'gold' },
  gachaTokens:  { icon: 'ui_ticket',name: 'Gacha Tokens',  tone: 'warm' },
  xp:           { icon: 'ui_star',  name: 'Profile XP',    tone: 'rune' },
  gear:         { icon: 'gear',     name: 'Equipment',     tone: 'epic', unit: true },
  rune:         { icon: 'rune',     name: 'Runes',         tone: 'epic', unit: true },
  artifact:     { icon: 'ui_orb',   name: 'Artifacts',     tone: 'epic', unit: true },
  egg:          { icon: 'ui_egg',   name: 'Pet Eggs',      tone: 'epic', unit: true },
};
// Display order: the currencies you spend most often first, the rare drops
// last so they are the ones still landing when the confetti peaks.
const ORDER = ['gold', 'xp', 'sp', 'talentPoints', 'gearParts', 'gems',
  'slotCoins', 'petFood', 'gachaTokens', 'gear', 'rune', 'artifact', 'egg'];

// A number that rolls up to its value. Counting is most of why a reward reads
// as bigger than the same number printed instantly.
function CountTo({ value, delay }) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    let start = 0;
    const dur = Math.min(900, 260 + value * 1.1);
    const tick = (now) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    const id = setTimeout(() => { raf.current = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf.current); };
  }, [value, delay]);
  return <>{n.toLocaleString('sv-SE')}</>;
}

export default function GameOver({ result, extras, save, payout, onCamp, onRetry, onMenu }) {
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
    return () => clearTimeout(t);
  }, [beforeXp, gainedXp]);

  const cleared = payout && payout.tier >= 3;

  // Fanfare fires once per screen — a campaign run with a payout gets the
  // payout's own cue below; a non-campaign run (Endless, Star Raid, etc.)
  // falls back to the plain XP fanfare it always had.
  useEffect(() => {
    if (payout) { if (payout.tier >= 2) Audio.rewardFanfare?.(); else Audio.claimPing?.(); }
    else if (gainedXp > 0) Audio.rewardFanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confetti is generated once and positioned by CSS custom properties, so the
  // browser animates it on the compositor instead of React re-rendering ~60
  // elements per frame. Only a campaign payout gets the celebration — a
  // generic death has nothing to celebrate.
  const confetti = useMemo(() => {
    if (!payout) return [];
    const COLORS = ['#ffd166', '#4dffd4', '#ff7a1a', '#b362ff', '#4dc4ff', '#4dff91'];
    const n = cleared ? 64 : 30;
    return Array.from({ length: n }, (_, i) => ({
      i,
      left: Math.random() * 100,
      delay: Math.random() * 0.7,
      dur: 1.9 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 180,
      spin: (Math.random() - 0.5) * 900,
      color: COLORS[i % COLORS.length],
      size: 5 + Math.random() * 7,
      round: Math.random() < 0.35,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payoutRows = useMemo(() => {
    if (!payout) return [];
    return ORDER.filter(k => (payout.ledger || {})[k] > 0).map(k => ({ k, v: payout.ledger[k], ...ITEM_META[k] }));
  }, [payout]);

  // Without a payout (non-campaign run), the reward list falls back to the
  // handful of totals GameScreen already computed — no ledger to read.
  const rewards = payout ? [] : [
    { icon: 'cur_gold', label: 'Gold earned',  val: '+' + (result.gold || 0) },
    { icon: 'ui_star',  label: 'Account XP',   val: '+' + (ex.xpGained || 0) },
    { icon: 'cur_sp',   label: 'Skill Points', val: '+' + (ex.spGained || 0) },
    ...(result.gearParts > 0 ? [{ icon: 'ui_cog', label: 'Gear Parts', val: '+' + result.gearParts }] : []),
  ];

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
    <div className="modal-overlay payout-overlay">
      {payout && (
        <>
          {/* Rays sit behind the panel and rotate slowly — the "something
              important happened here" light source. */}
          <div className={`payout-rays${cleared ? ' is-cleared' : ''}`} aria-hidden="true" />
          <div className="payout-confetti" aria-hidden="true">
            {confetti.map(c => (
              <i key={c.i} className={c.round ? 'is-round' : ''} style={{
                left: `${c.left}%`,
                background: c.color,
                width: c.size, height: c.size * (c.round ? 1 : 1.6),
                '--delay': `${c.delay}s`, '--dur': `${c.dur}s`,
                '--drift': `${c.drift}px`, '--spin': `${c.spin}deg`,
              }} />
            ))}
          </div>
        </>
      )}

      <div className={'gameover go-modern' + (result.victory || result.aidaKilled ? ' is-victory' : '') + (payout ? ' has-payout' : '')} data-testid="game-over">
        {payout && <span className="payout-sweep" aria-hidden="true" />}

        {/* A campaign run gets the node name and tier as the headline —
            it's a more specific, more useful "what just happened" than the
            generic victory/death line, which still shows underneath it. */}
        {payout && (
          <div className="payout-head">
            <span className="payout-node" style={{ color: payout.node.mapColor }}>
              <GameIcon name={payout.node.mapIcon} size={14} /> {payout.node.mapName} — {payout.node.name}
            </span>
            <h2 className={`payout-tier t${payout.tier}`}>{REWARD_TIERS[payout.tier].label}</h2>
          </div>
        )}

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

        {payout && (
          <div className="payout-chests">
            {[0, 1, 2].map(i => (
              <div key={i} className={`payout-chest${i < payout.tier ? ' won' : ''}`}
                style={{ '--pop-delay': `${0.12 + i * 0.16}s` }}>
                <span>{i < payout.tier ? <GameIcon name="ui_chest" size={26} /> : <GameIcon name="ui_lock" size={22} />}</span>
              </div>
            ))}
          </div>
        )}

        <div className="go-section-title">REWARDS COLLECTED</div>
        {payout ? (
          payoutRows.length > 0 ? (
            <div className="payout-rows">
              {payoutRows.map((r, i) => (
                <div key={r.k} className={`payout-row tone-${r.tone}`}
                  style={{ animationDelay: `${0.35 + i * 0.09}s` }}
                  data-testid={`payout-${r.k}`}>
                  <span className="payout-row-icon"><GameIcon name={r.icon} size={18} /></span>
                  <span className="payout-row-name">{r.name}</span>
                  <span className="payout-row-val">+<CountTo value={r.v} delay={380 + i * 90} /></span>
                </div>
              ))}
            </div>
          ) : (
            <div className="payout-empty">Nothing recovered — but the attempt still counts.</div>
          )
        ) : (
          <div className="go-rewards">
            {rewards.map((r, i) => (
              <div key={i} className="go-reward-row" data-testid={`reward-${i}`}>
                <span className="go-reward-icon"><GameIcon name={r.icon} size={20} /></span>
                <span className="go-reward-label">{r.label}</span>
                <span className="go-reward-val">{r.val}</span>
              </div>
            ))}
          </div>
        )}

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
