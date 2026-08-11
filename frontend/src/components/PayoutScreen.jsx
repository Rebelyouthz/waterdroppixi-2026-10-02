import React, { useEffect, useMemo, useRef, useState } from 'react';
import { REWARD_TIERS } from '../game/campaign';
import { Audio } from '../game/audio';

// =============================================
// PAYOUT SCREEN — what the run actually paid
// =============================================
// Two problems with what this replaced.
//
// 1. **It under-reported.** It listed the chest contents and nothing else,
//    while talent points, SP, gems, profile XP, artifacts and eggs were being
//    granted silently elsewhere in the same function. The player was shown
//    maybe half of what they had just earned and the rest simply appeared in
//    the currency row later with no explanation of where it came from. It now
//    renders the full ledger the run built (see App.js's `give`).
//
// 2. **It was an empty box.** The single biggest dopamine beat in the loop —
//    the moment a node pays out — was a bordered rectangle with a text list.
//    Everything below (the ray sweep, the chest pops, the confetti, the
//    counting numbers) exists to make that moment land.
//
// Everything is CSS/DOM. This is a menu, not the game canvas, so the
// waterdrop-lighting rules do not apply here — no PixiJS is involved.

const ITEM_META = {
  gold:         { icon: '★',  name: 'Gold',          tone: 'gold' },
  gems:         { icon: '💎', name: 'Gems',          tone: 'gem' },
  sp:           { icon: '◆',  name: 'Skill Points',  tone: 'rune' },
  talentPoints: { icon: '🌿', name: 'Talent Points', tone: 'green' },
  gearParts:    { icon: '🔩', name: 'Gear Parts',    tone: 'steel' },
  petFood:      { icon: '🍖', name: 'Pet Food',      tone: 'warm' },
  slotCoins:    { icon: '🎰', name: 'Slot Coins',    tone: 'gold' },
  gachaTokens:  { icon: '🎫', name: 'Gacha Tokens',  tone: 'warm' },
  xp:           { icon: '🌟', name: 'Profile XP',    tone: 'rune' },
  gear:         { icon: '🪖', name: 'Equipment',     tone: 'epic', unit: true },
  rune:         { icon: '🔮', name: 'Runes',         tone: 'epic', unit: true },
  artifact:     { icon: '🏺', name: 'Artifacts',     tone: 'epic', unit: true },
  egg:          { icon: '🥚', name: 'Pet Eggs',      tone: 'epic', unit: true },
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

export default function PayoutScreen({ payout, onClose }) {
  const { tier, node, ledger } = payout;
  const rows = useMemo(
    () => ORDER.filter(k => (ledger || {})[k] > 0).map(k => ({ k, v: ledger[k], ...ITEM_META[k] })),
    [ledger],
  );
  const cleared = tier >= 3;

  // Confetti is generated once and positioned by CSS custom properties, so the
  // browser animates it on the compositor instead of React re-rendering ~60
  // elements per frame.
  const confetti = useMemo(() => {
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
  }, [cleared]);

  useEffect(() => {
    if (tier >= 2) Audio.rewardFanfare?.(); else Audio.claimPing?.();
  }, [tier]);

  return (
    <div className="modal-overlay payout-overlay" data-testid="campaign-payout">
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

      <div className={`payout-panel${cleared ? ' is-cleared' : ''}`}>
        {/* A sweep of light that crosses the panel once on open. */}
        <span className="payout-sweep" aria-hidden="true" />

        <div className="payout-head">
          <span className="payout-node" style={{ color: node.mapColor }}>
            {node.mapIcon} {node.mapName} — {node.name}
          </span>
          <h2 className={`payout-tier t${tier}`}>{REWARD_TIERS[tier].label}</h2>
        </div>

        <div className="payout-chests">
          {[0, 1, 2].map(i => (
            <div key={i} className={`payout-chest${i < tier ? ' won' : ''}`}
              style={{ '--pop-delay': `${0.12 + i * 0.16}s` }}>
              <span>{i < tier ? '🎁' : '🔒'}</span>
            </div>
          ))}
        </div>

        {rows.length > 0 ? (
          <div className="payout-rows">
            {rows.map((r, i) => (
              <div key={r.k} className={`payout-row tone-${r.tone}`}
                style={{ animationDelay: `${0.35 + i * 0.09}s` }}
                data-testid={`payout-${r.k}`}>
                <span className="payout-row-icon">{r.icon}</span>
                <span className="payout-row-name">{r.name}</span>
                <span className="payout-row-val">
                  +<CountTo value={r.v} delay={380 + i * 90} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="payout-empty">Nothing recovered — but the attempt still counts.</div>
        )}

        <button className="payout-continue" onClick={onClose} data-testid="payout-continue">
          CONTINUE
        </button>
      </div>
    </div>
  );
}
