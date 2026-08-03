import React, { useEffect, useRef, useState } from 'react';

// =============================================================
// Twin joystick dials — bespoke to Waterdrop Survivor.
//
// Deliberately NOT a generic ring-in-a-box: each stick is a faceted
// instrument dial drawn as inline SVG (cut-corner outer plate, notched
// bezel, tick bar, engraved "H2O" mark) so it reads as this game's own
// hardware rather than a stock virtual pad. The old rectangular
// `.joy-frame` bracket is gone.
//
// The dial doubles as the cooldown readout — the whole thing sits dark
// and the accent light *builds up* around the bezel as the charge
// refills, reaching full brightness + a breathing pulse when ready:
//   left  dial = DASH   (flick the left stick to dash — movement + dash
//                        share one thumb, which is the layout this game
//                        is designed around)
//   right dial = SWIPE ATTACK (once unlocked; plain aim ring before that)
// Active skills are pods seated INTO each bezel (not floating buttons),
// each with its own arc that fills as its cooldown recovers.
//
// Touch listeners live on document with passive:false so the browser
// can't steal the gesture for zoom/scroll.
// =============================================================

const MAX_D = 44;
const BEZEL_R = 62;       // SVG radius the charge arc is stroked on (also the pod seat radius)
const BEZEL_C = 2 * Math.PI * BEZEL_R;

const ringCenter = (side) => ({
  x: side === 'left' ? 90 : window.innerWidth - 90,
  y: window.innerHeight - 133,
});
const computeVec = (side, touchX, touchY) => {
  const c = ringCenter(side);
  const dx = touchX - c.x;
  const dy = touchY - c.y;
  const dist = Math.hypot(dx, dy) || 1;
  const cl = Math.min(dist, MAX_D);
  return { vx: (dx / dist) * (cl / MAX_D), vy: (dy / dist) * (cl / MAX_D) };
};

// Cut-corner octagonal plate path, centred in the 176x176 viewBox. Drawn
// as a ring (outer octagon + inner circle hole, evenodd) so the plate is
// a bezel around the live stick area rather than a slab behind it.
function octagonPath(cx, cy, r, cut) {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i * Math.PI) / 4 - Math.PI / 8;
    const a1 = a0 + Math.PI / 4;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    // chamfer each vertex by `cut` px along both incident edges
    const ex = x1 - x0, ey = y1 - y0, el = Math.hypot(ex, ey) || 1;
    const ux = ex / el, uy = ey / el;
    p.push(`${i === 0 ? 'M' : 'L'}${(x0 + ux * cut).toFixed(1)},${(y0 + uy * cut).toFixed(1)}`);
    p.push(`L${(x1 - ux * cut).toFixed(1)},${(y1 - uy * cut).toFixed(1)}`);
  }
  return p.join(' ') + ' Z';
}

// 24 tick marks around the bezel; every 6th is a long "cardinal" tick.
const TICKS = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
  const long = i % 6 === 0;
  const r0 = long ? 68 : 71;
  const r1 = 76;
  return {
    x1: 88 + Math.cos(a) * r0, y1: 88 + Math.sin(a) * r0,
    x2: 88 + Math.cos(a) * r1, y2: 88 + Math.sin(a) * r1,
    long,
  };
});

/**
 * One dial. `charge` is 0..1 (1 = fully recharged / ready). `armed` means
 * the ability the dial reports actually exists — when false the dial stays
 * inert and shows no charge arc.
 */
function JoyDial({ side, accent, charge, armed, active }) {
  const cls = [
    'joy-dial', `joy-dial-${side}`,
    active ? 'is-active' : '',
    armed && charge >= 1 ? 'is-ready' : '',
    armed && charge < 1 ? 'is-charging' : '',
  ].filter(Boolean).join(' ');

  // Arc grows clockwise from 12 o'clock as the ability recharges.
  const dash = BEZEL_C * Math.max(0, Math.min(1, charge));

  return (
    <svg className={cls} viewBox="0 0 176 176" aria-hidden
         style={{ '--joy-accent': accent, '--joy-charge': charge }}>
      <defs>
        <radialGradient id={`joyWell-${side}`} cx="50%" cy="42%" r="62%">
          <stop offset="0%"   stopColor="#0d1a2a" stopOpacity="0.62" />
          <stop offset="70%"  stopColor="#050b14" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#02060c" stopOpacity="0.10" />
        </radialGradient>
        <linearGradient id={`joyPlate-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.20" />
          <stop offset="55%"  stopColor={accent} stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* recessed well the knob rides in */}
      <circle cx="88" cy="88" r="60" fill={`url(#joyWell-${side})`} />

      {/* faceted bezel plate — octagon outside, circular cutout inside */}
      <path
        d={`${octagonPath(88, 88, 84, 13)} M88,88 m-62,0 a62,62 0 1,0 124,0 a62,62 0 1,0 -124,0`}
        fillRule="evenodd"
        fill={`url(#joyPlate-${side})`}
        stroke={accent} strokeOpacity="0.22" strokeWidth="1.2"
      />

      {/* tick bar */}
      <g className="joy-ticks" stroke={accent}>
        {TICKS.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                strokeWidth={t.long ? 2 : 1}
                strokeOpacity={t.long ? 0.34 : 0.16} strokeLinecap="round" />
        ))}
      </g>

      {/* unlit bezel track */}
      <circle className="joy-track" cx="88" cy="88" r={BEZEL_R}
              fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="5" />

      {/* the charge light itself — this is the cooldown readout */}
      {armed && (
        <circle className="joy-charge" cx="88" cy="88" r={BEZEL_R}
                fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${dash} ${BEZEL_C}`}
                transform="rotate(-90 88 88)" />
      )}

      {/* engraved brand mark */}
      <text className="joy-mark" x="88" y="95" textAnchor="middle" fill={accent}>
        H<tspan className="joy-mark-sub" dy="5">2</tspan><tspan dy="-5">O</tspan>
      </text>

      {/* corner chevrons — small hardware detail on the diagonals */}
      <g stroke={accent} strokeOpacity="0.30" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M31,31 l0,9 M31,31 l9,0" />
        <path d="M145,31 l0,9 M145,31 l-9,0" />
        <path d="M31,145 l0,-9 M31,145 l9,0" />
        <path d="M145,145 l0,-9 M145,145 l-9,0" />
      </g>
    </svg>
  );
}

export default function MobileControls({
  onUpdate, onDashDir, onSwipeAttack, dashCD = 0, dashMaxCD = 2.4, dashReady = true, fireOnAim = true,
  swipeAttackUnlocked = false, swipeAttackCD = 0, swipeAttackMaxCD = 1.1,
  visible = true, activeSkills = [], onActiveSkill,
}) {
  const [show, setShow] = useState(false);
  const [leftVis,  setLeftVis]  = useState({ active: false, vx: 0, vy: 0 });
  const [rightVis, setRightVis] = useState({ active: false, vx: 0, vy: 0 });

  const leftVec   = useRef({ vx: 0, vy: 0 });
  const rightVec  = useRef({ vx: 0, vy: 0 });
  const tracking  = useRef({ left: null, right: null });
  const dashStart = useRef(null);
  const lastDash  = useRef(0);
  // Right stick (aim) gesture start — mirrors dashStart but fires a swipe
  // attack instead of a dash when flicked fast.
  const swipeStart = useRef(null);
  const lastSwipe   = useRef(0);
  const cbRef     = useRef({ onUpdate, onDashDir, onSwipeAttack });
  cbRef.current   = { onUpdate, onDashDir, onSwipeAttack };

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setShow(isTouch || window.innerWidth <= 900);
  }, []);

  useEffect(() => {
    if (!show || !visible) return;

    const sideOf = (cx) => cx < window.innerWidth / 2 ? 'left' : 'right';
    const pushUpdate = () => {
      const { vx: lx, vy: ly } = leftVec.current;
      const { vx: rx, vy: ry } = rightVec.current;
      const firing = fireOnAim && (Math.abs(rx) > 0.15 || Math.abs(ry) > 0.15);
      cbRef.current.onUpdate({ x: lx, y: ly }, { x: rx, y: ry }, firing);
    };

    const onTouchStart = (e) => {
      // Skip when UI overlays are open (level-up, pause, game-over, skill buttons)
      if (e.target.closest('[data-joy-skill]')) return;
      if (document.querySelector('.levelup-overlay, .modal-overlay, .pause-overlay, .gameover')) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        const side = sideOf(t.clientX);
        if (tracking.current[side] != null) continue;
        tracking.current[side] = t.identifier;
        if (side === 'left') dashStart.current = { x: t.clientX, y: t.clientY, time: performance.now(), fired: false };
        else swipeStart.current = { x: t.clientX, y: t.clientY, time: performance.now(), fired: false };
        const vec = computeVec(side, t.clientX, t.clientY);
        if (side === 'left') { leftVec.current = vec; setLeftVis({ active: true, ...vec }); }
        else                  { rightVec.current = vec; setRightVis({ active: true, ...vec }); }
        pushUpdate();
      }
    };

    const onTouchMove = (e) => {
      if (tracking.current.left !== null || tracking.current.right !== null) e.preventDefault();
      for (const t of e.changedTouches) {
        const side = tracking.current.left === t.identifier ? 'left'
                   : tracking.current.right === t.identifier ? 'right' : null;
        if (!side) continue;
        const vec = computeVec(side, t.clientX, t.clientY);
        if (side === 'left') { leftVec.current = vec; setLeftVis({ active: true, ...vec }); }
        else                  { rightVec.current = vec; setRightVis({ active: true, ...vec }); }
        pushUpdate();
        if (side === 'left' && dashStart.current && !dashStart.current.fired) {
          const elapsed = performance.now() - dashStart.current.time;
          const sx = t.clientX - dashStart.current.x;
          const sy = t.clientY - dashStart.current.y;
          const sLen = Math.hypot(sx, sy);
          if (elapsed < 200 && sLen > 38) {
            dashStart.current.fired = true;
            const now = performance.now();
            if (now - lastDash.current > 250) {
              lastDash.current = now;
              cbRef.current.onDashDir && cbRef.current.onDashDir(sx / sLen, sy / sLen);
            }
          }
        }
        if (side === 'right' && swipeStart.current && !swipeStart.current.fired) {
          const elapsed = performance.now() - swipeStart.current.time;
          const sx = t.clientX - swipeStart.current.x;
          const sy = t.clientY - swipeStart.current.y;
          const sLen = Math.hypot(sx, sy);
          if (elapsed < 200 && sLen > 30) {
            swipeStart.current.fired = true;
            const now = performance.now();
            if (now - lastSwipe.current > 250) {
              lastSwipe.current = now;
              cbRef.current.onSwipeAttack && cbRef.current.onSwipeAttack(sx / sLen, sy / sLen);
            }
          }
        }
      }
    };

    const onTouchEnd = (e) => {
      for (const t of e.changedTouches) {
        const side = tracking.current.left === t.identifier ? 'left'
                   : tracking.current.right === t.identifier ? 'right' : null;
        if (!side) continue;
        tracking.current[side] = null;
        if (side === 'left') {
          leftVec.current = { vx: 0, vy: 0 };
          setLeftVis({ active: false, vx: 0, vy: 0 });
          dashStart.current = null;
        } else {
          rightVec.current = { vx: 0, vy: 0 };
          setRightVis({ active: false, vx: 0, vy: 0 });
          swipeStart.current = null;
        }
        pushUpdate();
      }
    };

    document.addEventListener('touchstart',  onTouchStart,  { passive: false });
    document.addEventListener('touchmove',   onTouchMove,   { passive: false });
    document.addEventListener('touchend',    onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart',  onTouchStart);
      document.removeEventListener('touchmove',   onTouchMove);
      document.removeEventListener('touchend',    onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [show, visible, fireOnAim]);

  if (!show || !visible) return null;

  // Charge = how far the ability has recovered, 0..1. This is what drives
  // the dial's light: dark at 0, full brightness + pulse at 1.
  const dashCharge  = !dashReady ? 0
    : dashCD <= 0 ? 1
    : Math.max(0, Math.min(1, 1 - dashCD / (dashMaxCD || 2.4)));
  const swipeCharge = !swipeAttackUnlocked ? 0
    : swipeAttackCD <= 0 ? 1
    : Math.max(0, Math.min(1, 1 - swipeAttackCD / (swipeAttackMaxCD || 1.1)));

  // Skill pods seated into the bezels. Their arcs fill the same way the
  // dial's does, so "light building up" means the same thing everywhere on
  // the pad. Four equippable actives → two pods per dial, at 12 o'clock and
  // on the inward-facing diagonal (both inside thumb reach).
  //   slot 0,1 → left dial   slot 2,3 → right dial
  const POD_SLOTS = ['left-a', 'left-b', 'right-a', 'right-b'];
  const renderSkillPod = (skillIdx) => {
    const sk = activeSkills[skillIdx];
    if (!sk || !onActiveSkill) return null;
    const slot = POD_SLOTS[skillIdx];
    if (!slot) return null;
    const ready = sk.cd <= 0;
    const charge = ready ? 1 : Math.max(0, Math.min(1, 1 - sk.cd / (sk.maxCd || 1)));
    return (
      <button
        key={slot}
        className={`joy-pod joy-pod-${slot}${ready ? ' ready' : ''}`}
        data-joy-skill={skillIdx}
        data-testid={`joy-skill-${skillIdx}`}
        title={sk.name}
        style={{ '--pod-charge': `${charge * 360}deg` }}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onActiveSkill(skillIdx); }}
        onClick={(e) => { e.stopPropagation(); onActiveSkill(skillIdx); }}
      >
        <span className="joy-pod-arc" aria-hidden />
        <span className="joy-pod-face">
          <span className="joy-pod-icon">{sk.icon || skillIdx + 1}</span>
          {!ready && <span className="joy-pod-cd">{sk.cd >= 10 ? Math.ceil(sk.cd) : sk.cd.toFixed(1)}</span>}
        </span>
      </button>
    );
  };

  return (
    <>
      <JoyDial side="left"  accent="#4dffd4" charge={dashCharge}  armed={dashReady}            active={leftVis.active} />
      <JoyDial side="right" accent="#ff9632" charge={swipeCharge} armed={swipeAttackUnlocked}  active={rightVis.active} />

      {/* Knobs — droplet-shaped caps, tilt into the direction they're pushed */}
      <div className="static-knob static-knob-left"  data-testid="joy-knob-left"
           style={{ transform: `translate(${leftVis.vx * MAX_D}px, ${leftVis.vy * MAX_D}px)` }}>
        <span className="knob-gloss" />
      </div>
      <div className="static-knob static-knob-right" data-testid="joy-knob-right"
           style={{ transform: `translate(${rightVis.vx * MAX_D}px, ${rightVis.vy * MAX_D}px)` }}>
        <span className="knob-gloss" />
      </div>

      {/* Active skill pods, seated in each bezel */}
      {renderSkillPod(0)}
      {renderSkillPod(1)}
      {renderSkillPod(2)}
      {renderSkillPod(3)}

      <div className="joy-lbl joy-lbl-left">MOVE · FLICK TO DASH</div>
      <div className="joy-lbl joy-lbl-right">{swipeAttackUnlocked ? 'AIM · FLICK TO SWIPE' : 'AIM'}</div>
    </>
  );
}
