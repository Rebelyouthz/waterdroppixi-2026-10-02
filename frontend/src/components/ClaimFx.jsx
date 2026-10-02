import React, { useEffect, useRef, useState } from 'react';
import GameIcon from './GameIcon';
import { rewardItems } from '../game/progression';
import { Audio } from '../game/audio';

// CLAIM JUICE — the payout you can SEE.
//
// Timmy: "när man claimar ska de va juice alltid juice på claim dopamin de ska
// visas va man fick å animeras in i currencys".
//
// Before this, claiming anything played a button pop and silently changed a
// number somewhere else on screen. The player was paid and never shown it —
// the cheapest piece of dopamine in the genre, and the one this game was
// missing on every claimable surface.
//
// ── WHY A BUS RATHER THAN LOCAL STATE ───────────────────────────────
// Every claimable surface is a different component (daily reward, daily/weekly
// quests, codex, season pass, patrol, campaign). Giving each its own burst
// means six implementations drifting apart — the exact failure documented in
// dead-config-sweep. One host, one fire() call, same juice everywhere. Same
// shape as game/toastBus.js, deliberately.
//
// ── WHY NOT A PER-FRAME LOOP ────────────────────────────────────────
// The flight is two CSS transforms with a transition between them, not a rAF
// loop writing state. React re-rendering a chip sixty times a second is what
// made VesselGauge the measured cause of in-run lag once already.

let _seq = 0;
const _subs = new Set();

/**
 * Fire the claim burst.
 *
 * @param {HTMLElement|null} anchor   the thing that was clicked; the burst
 *                                    originates from its centre
 * @param {object} reward             a reward bag ({ gold, sp, gems, ... }),
 *                                    read through progression.js's own table so
 *                                    this can never show a currency the reward
 *                                    screen would silently drop
 * @param {{ flyTo?: string }} [opts] CSS selector for a currency readout to fly
 *                                    into. Omit and the chips simply rise and
 *                                    fade — what the Welcome screen wants
 *                                    ("inte på start skärmen dock").
 */
export function fireClaimFx(anchor, reward, opts = {}) {
  const items = opts.items && opts.items.length ? opts.items : rewardItems(reward);
  if (!items.length) return;
  // Measured DURING the event. React nulls currentTarget once the handler
  // returns, and reading a rect in a later effect gives the post-layout
  // position — both have already cost time in this codebase.
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
  const origin = r
    ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  const burst = { id: ++_seq, origin, items, flyTo: opts.flyTo || null };
  _subs.forEach((fn) => fn(burst));
}

// Dev handle, same pattern as window.__game and window.__cine. A claim burst
// can otherwise only be seen by actually having something claimable, which for
// the daily reward means waiting until tomorrow — so reviewing it costs a day.
//   __claimFx(document.querySelector('[data-testid="claim-daily"]'), { gold: 400, sp: 2 })
if (typeof window !== 'undefined') window.__claimFx = fireClaimFx;

/** Camp header currency chips — fly claimed loot into the total you can see. */
export const CAMP_CLAIM_FLY = '.camp-currency-row .camp-currency-chip';

/** Mount ONCE per screen. Renders nothing until something is claimed. */
export default function ClaimFx() {
  const [bursts, setBursts] = useState([]);
  const timers = useRef([]);

  useEffect(() => {
    const onBurst = (b) => {
      setBursts((cur) => [...cur, { ...b, phase: 'pop' }]);
      Audio.claimPing && Audio.claimPing();

      // pop -> fly/rise -> gone. Both timers are cleaned up on unmount so a
      // screen change mid-animation cannot setState on a dead component.
      const t1 = setTimeout(() => {
        setBursts((cur) => cur.map((x) => {
          if (x.id !== b.id) return x;
          // Resolve the flight target NOW, not at fire time: if the screen
          // scrolled between the click and the flight, a delta computed early
          // lands the chip in empty space.
          let dest = null;
          if (b.flyTo) {
            const el = document.querySelector(b.flyTo);
            if (el) {
              const rr = el.getBoundingClientRect();
              dest = { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 };
              el.classList.remove('cfx-target-hit');
              // Force a reflow so re-adding the class restarts the animation
              // when two claims land in quick succession.
              void el.offsetWidth;
              el.classList.add('cfx-target-hit');
              setTimeout(() => el.classList.remove('cfx-target-hit'), 620);
            }
          }
          return { ...x, phase: dest ? 'fly' : 'rise', dest };
        }));
      }, 760);

      const t2 = setTimeout(() => {
        setBursts((cur) => cur.filter((x) => x.id !== b.id));
      }, 1700);

      timers.current.push(t1, t2);
    };

    _subs.add(onBurst);
    return () => {
      _subs.delete(onBurst);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  if (!bursts.length) return null;

  return (
    <div className="cfx-layer" aria-hidden>
      {bursts.map((b) => (
        <div
          key={b.id}
          className="cfx-burst"
          style={{ left: b.origin.x + 'px', top: b.origin.y + 'px' }}
        >
          {/* Two staggered shockwave rings. One ring reads as a blip; two
              travelling outward at different speeds read as an impact. */}
          <span className="cfx-ring" />
          <span className="cfx-ring cfx-ring-2" />
          {b.items.map((it, i) => {
            // Fan the chips across an arc ABOVE the button rather than a circle
            // around it — a circle puts half the payout behind the thing you
            // just pressed.
            const n = b.items.length;
            const spread = Math.min(150, 52 * n);
            const dx = n === 1 ? 0 : -spread / 2 + (spread / (n - 1)) * i;
            const dy = -46 - Math.abs(dx) * 0.10;
            const style = {
              '--cfx-dx': dx.toFixed(1) + 'px',
              '--cfx-dy': dy.toFixed(1) + 'px',
              '--cfx-delay': (i * 55) + 'ms',
            };
            if (b.dest) {
              style['--cfx-fx'] = (b.dest.x - b.origin.x).toFixed(1) + 'px';
              style['--cfx-fy'] = (b.dest.y - b.origin.y).toFixed(1) + 'px';
            }
            return (
              <span key={it.key} className={`cfx-chip cfx-${b.phase}`} style={style}>
                <span className="cfx-chip-ico"><GameIcon name={it.icon} size={22} /></span>
                <span className="cfx-chip-amt">{typeof it.amount === 'number' ? '+' + it.amount : String(it.amount)}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
