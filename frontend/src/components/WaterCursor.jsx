import React, { useEffect, useId, useRef, useState } from 'react';
import { followStep, shouldHideOnLeave, isTextTarget } from '../game/waterCursor';

// =============================================
// WATER CURSOR — the pointer is a waterdrop
// =============================================
// Timmy, 2026-08-17: "handen pilen på musen ska inte va en ful hand ...
// kan ha en vattendroppe som animeras när man trycker å som rör sig å
// skvalpar å när den tänker så töms den å fylls ... men den vassa delen
// är där man klickar.. fast gör den itne vass men mysig nästan vass".
//
// 2026-09-20: the drop felt heavy, vanished while scrolling camp panels,
// and sometimes sat in the corner. Named causes:
//   - FOLLOW 0.34/frame (~50ms lag)
//   - window `pointerleave` parks at -200 on Chrome overflow-scroll
//   - classList.toggle every rAF forced style recalc
// Maths live in game/waterCursor.js.

const MAX_LEAN = 22;
const MAX_STRETCH = 0.22;

function cursorSupported() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function WaterCursor() {
  const [enabled] = useState(cursorSupported);
  const rootRef = useRef(null);
  const dropRef = useRef(null);
  const uid = useId().replace(/:/g, '');

  const s = useRef({
    tx: -200, ty: -200,
    x: -200, y: -200,
    vx: 0, vy: 0,
    lean: 0, stretch: 0,
    press: 0,
    away: true,
    overText: false,
    raf: 0,
    last: 0,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const st = s.current;
    document.body.classList.add('wc-on');

    const onMove = (e) => {
      st.tx = e.clientX;
      st.ty = e.clientY;
      st.away = false;
      st.overText = isTextTarget(e.target);
    };
    const onDown = () => { st.press = 1; };
    const onOut = (e) => {
      if (shouldHideOnLeave(e.relatedTarget)) st.away = true;
    };
    const onOver = (e) => {
      st.away = false;
      st.overText = isTextTarget(e.target);
    };

    document.addEventListener('pointermove', onMove, { passive: true, capture: true });
    document.addEventListener('pointerrawupdate', onMove, { passive: true, capture: true });
    document.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    document.addEventListener('mouseover', onOver, { passive: true, capture: true });
    document.addEventListener('mouseout', onOut, { passive: true, capture: true });

    const tick = (now) => {
      const n = s.current;
      const dt = n.last ? Math.min(0.05, (now - n.last) / 1000) : 0.016;
      n.last = now;

      if (n.away) {
        n.x = n.tx;
        n.y = n.ty;
      } else {
        n.x = followStep(n.x, n.tx, dt);
        n.y = followStep(n.y, n.ty, dt);
      }

      const dx = n.tx - n.x, dy = n.ty - n.y;
      n.vx += (dx - n.vx) * 0.28;
      n.vy += (dy - n.vy) * 0.28;

      const speed = Math.hypot(n.vx, n.vy);
      const targetLean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -n.vx * 0.7));
      n.lean += (targetLean - n.lean) * 0.22;
      const targetStretch = Math.min(MAX_STRETCH, speed * 0.01);
      n.stretch += (targetStretch - n.stretch) * 0.24;
      n.press *= 0.84;

      const sx = (1 + n.stretch) * (1 - n.press * 0.26);
      const sy = (1 - n.stretch * 0.55) * (1 + n.press * 0.2);
      const hidden = n.away || n.overText;
      const pressing = n.press > 0.45;

      const drop = dropRef.current;
      const root = rootRef.current;
      if (drop) {
        drop.style.transform =
          `rotate(${n.lean.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      }
      if (root) {
        root.style.transform = `translate3d(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px, 0)`;
        if (root._hid !== hidden) {
          root._hid = hidden;
          root.classList.toggle('is-hidden', hidden);
        }
        if (root._prs !== pressing) {
          root._prs = pressing;
          root.classList.toggle('wc-press', pressing);
        }
      }
      n.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(st.raf);
      document.body.classList.remove('wc-on');
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerrawupdate', onMove, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  const body = `wc-body-${uid}`;
  const fill = `wc-fill-${uid}`;
  const clip = `wc-clip-${uid}`;

  return (
    <div className="wc-root is-hidden" ref={rootRef} aria-hidden>
      <svg className="wc-drop" ref={dropRef} width="42" height="42" viewBox="0 0 42 42">
        <defs>
          <radialGradient id={body} cx="34%" cy="30%" r="78%">
            <stop offset="0%"   stopColor="#e8fbff" stopOpacity="0.95" />
            <stop offset="26%"  stopColor="#7fdcff" stopOpacity="0.92" />
            <stop offset="62%"  stopColor="#2f9ee0" stopOpacity="0.90" />
            <stop offset="88%"  stopColor="#15568f" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#6fd0ff" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#bff0ff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#2aa0e6" stopOpacity="0.50" />
          </linearGradient>
          <clipPath id={clip}>
            <path d="M 4 4 L 26.8 11.6 A 12 12 0 1 1 11.6 26.8 Z" />
          </clipPath>
        </defs>

        <path
          className="wc-shape"
          d="M 4 4 L 26.8 11.6 A 12 12 0 1 1 11.6 26.8 Z"
          fill={`url(#${body})`}
          stroke="#06263f"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        <g clipPath={`url(#${clip})`}>
          <rect className="wc-level" x="-4" y="10" width="50" height="44"
            fill={`url(#${fill})`} />
        </g>

        <ellipse className="wc-spec" cx="18" cy="17" rx="5.2" ry="3.4"
          fill="#ffffff" opacity="0.75" transform="rotate(-38 18 17)" />
        <circle cx="28.5" cy="29" r="1.9" fill="#ffffff" opacity="0.4" />

        <circle className="wc-ripple" cx="23" cy="23" r="12"
          fill="none" stroke="#bff0ff" strokeWidth="2" />
      </svg>
    </div>
  );
}
