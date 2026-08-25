import React, { useEffect, useRef, useState } from 'react';

// =============================================
// WATER CURSOR — the pointer is a waterdrop
// =============================================
// Timmy, 2026-08-17: "handen pilen på musen ska inte va en ful hand ...
// kan ha en vattendroppe som animerar när man trycker å som rör sig å
// skvalpar å när den tänker så töms den å fylls ... men den vassa delen
// är där man klickar.. fast gör den itne vass men mysig nästan vass".
//
// So: a teardrop standing on its point, tip up-left, and the tip IS the
// hotspot — whatever the tip touches is what a click hits. The apex is
// stroked with `stroke-linejoin: round`, which is what makes it read as
// "nästan vass" instead of as a needle.
//
// WHY A DOM ELEMENT AND NOT `cursor: url(...)`
// A CSS cursor image cannot animate, cannot lean into your movement, and
// cannot show a loading state. All three were asked for. The cost is that
// the real pointer has to be hidden (`cursor: none`) and ours has to keep
// up — so nothing here re-renders React. The rAF loop writes `transform`
// straight to the node: one element, one transform per frame, no layout.
//
// TOUCH DEVICES GET NOTHING. `(pointer: fine)` gates the whole feature —
// on a phone there is no pointer to replace and hiding the cursor would be
// pure cost for no effect. A laptop with a touchscreen still gets the drop,
// which is correct.

// `FOLLOW` is deliberately below 1: the drop lags the true pointer very
// slightly, and that lag is what produces the sway — with no lag there is
// no velocity to lean into and it looks glued on. Too low reads as broken
// input lag; 0.34 reads as weight.
const FOLLOW = 0.34;
const MAX_LEAN = 26;      // degrees
const MAX_STRETCH = 0.3;

// Decided at first render, not in an effect. That distinction is a real
// bug fix, not a style choice: when this lived only in the effect, the
// component still RENDERED its markup on touch devices, and with no rAF
// loop to position it the drop sat parked at (-4,-4) — a 42px waterdrop
// stuck in the top-left corner of every phone. Caught on an iPhone 16
// viewport; invisible on desktop, because there the loop starts and moves
// it immediately.
function cursorSupported() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function WaterCursor() {
  const [enabled] = useState(cursorSupported);
  const rootRef = useRef(null);
  const dropRef = useRef(null);

  // Everything the loop mutates lives in one ref, never in state — a
  // setState per frame would re-render the whole app 60 times a second.
  const s = useRef({
    tx: -200, ty: -200,    // target (true pointer)
    x: -200, y: -200,      // rendered position
    vx: 0, vy: 0,
    lean: 0, stretch: 0,
    press: 0,              // 0..1, decays after a click
    raf: 0,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const st = s.current;
    document.body.classList.add('wc-on');

    const onMove = (e) => { st.tx = e.clientX; st.ty = e.clientY; };
    const onDown = () => { st.press = 1; };
    // Leaving the window must park the drop off-screen, or it freezes
    // mid-air at the last known position like a stuck sprite.
    const onLeave = () => { st.tx = -200; st.ty = -200; };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });

    const tick = () => {
      const n = s.current;
      const dx = n.tx - n.x, dy = n.ty - n.y;
      n.x += dx * FOLLOW;
      n.y += dy * FOLLOW;
      // Smoothed velocity — raw frame deltas jitter enough that the drop
      // would twitch rather than sway.
      n.vx += (dx - n.vx) * 0.25;
      n.vy += (dy - n.vy) * 0.25;

      const speed = Math.hypot(n.vx, n.vy);
      // Lean AGAINST travel, the way liquid in a moving glass piles up on
      // the trailing side. Capped so a fast flick cannot spin it.
      const targetLean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -n.vx * 0.9));
      n.lean += (targetLean - n.lean) * 0.16;
      const targetStretch = Math.min(MAX_STRETCH, speed * 0.012);
      n.stretch += (targetStretch - n.stretch) * 0.2;

      n.press *= 0.86;

      // Click squash on top of the travel stretch.
      const sx = (1 + n.stretch) * (1 - n.press * 0.26);
      const sy = (1 - n.stretch * 0.55) * (1 + n.press * 0.2);

      if (dropRef.current) {
        dropRef.current.style.transform =
          `rotate(${n.lean.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      }
      if (rootRef.current) {
        rootRef.current.style.transform =
          `translate3d(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px, 0)`;
        rootRef.current.classList.toggle('wc-press', n.press > 0.45);
      }
      n.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(st.raf);
      document.body.classList.remove('wc-on');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  // Nothing at all on a touch device — not a hidden element, not an
  // unpositioned one. See cursorSupported() above.
  if (!enabled) return null;

  return (
    <div className="wc-root" ref={rootRef} aria-hidden>
      <svg className="wc-drop" ref={dropRef} width="42" height="42" viewBox="0 0 42 42">
        <defs>
          {/* Water body. Bright at the upper-left shoulder, deep at the
              lower-right — the same single light direction every other
              surface in this game uses. The last stop rises back up: that
              rim bounce is what makes it read as a volume, not a disc. */}
          <radialGradient id="wc-body" cx="34%" cy="30%" r="78%">
            <stop offset="0%"   stopColor="#e8fbff" stopOpacity="0.95" />
            <stop offset="26%"  stopColor="#7fdcff" stopOpacity="0.92" />
            <stop offset="62%"  stopColor="#2f9ee0" stopOpacity="0.90" />
            <stop offset="88%"  stopColor="#15568f" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#6fd0ff" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id="wc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#bff0ff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#2aa0e6" stopOpacity="0.50" />
          </linearGradient>
          {/* The silhouette, reused to clip the inner water level so the
              level can never spill outside the body. */}
          <clipPath id="wc-clip">
            <path d="M 4 4 L 26.8 11.6 A 12 12 0 1 1 11.6 26.8 Z" />
          </clipPath>
        </defs>

        {/* Tip at (4,4) = the hotspot. The two straight edges run from the
            tip to the bulb's TANGENT points, computed rather than eyeballed
            (tangent length 24.04 at ±26.5° off the centre line), so the cone
            meets the circle exactly instead of overlapping it. */}
        <path
          className="wc-shape"
          d="M 4 4 L 26.8 11.6 A 12 12 0 1 1 11.6 26.8 Z"
          fill="url(#wc-body)"
          stroke="#06263f"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* The water level. Sits full normally; drains and refills while
            the game is busy — `body.wc-busy` drives it. */}
        <g clipPath="url(#wc-clip)">
          <rect className="wc-level" x="-4" y="10" width="50" height="44"
            fill="url(#wc-fill)" />
        </g>

        {/* Two speculars of different size — the cheapest possible "curved
            and wet" cue. */}
        <ellipse className="wc-spec" cx="18" cy="17" rx="5.2" ry="3.4"
          fill="#ffffff" opacity="0.75" transform="rotate(-38 18 17)" />
        <circle cx="28.5" cy="29" r="1.9" fill="#ffffff" opacity="0.4" />

        {/* Ripple thrown off on click. Idle it is invisible and costs
            nothing; `.wc-press` on the root fires it. */}
        <circle className="wc-ripple" cx="23" cy="23" r="12"
          fill="none" stroke="#bff0ff" strokeWidth="2" />
      </svg>
    </div>
  );
}
