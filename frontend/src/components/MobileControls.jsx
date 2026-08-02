import React, { useEffect, useRef, useState } from 'react';

// Static twin joysticks — fixed position, always visible.
// Touch listeners on document with passive:false → prevents browser zoom/scroll.
// Skill buttons at top of each ring trigger active skills.
// Left ring color changes with dash cooldown state.

const MAX_D = 44;
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

export default function MobileControls({
  onUpdate, onDashDir, dashCD = 0, dashReady = true, fireOnAim = true,
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
  const cbRef     = useRef({ onUpdate, onDashDir });
  cbRef.current   = { onUpdate, onDashDir };

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

  // Dash state classes for left ring
  const dashCls = dashReady ? ' dash-ready' : dashCD > 0 ? ' dash-cd' : '';

  const renderSkillBtn = (skillIdx, side) => {
    const sk = activeSkills[skillIdx];
    if (!sk || !onActiveSkill) return null;
    const ready = sk.cd <= 0;
    const pct = sk.maxCd > 0 ? Math.max(0, Math.min(100, (sk.cd / sk.maxCd) * 100)) : 0;
    return (
      <button
        key={side}
        className={`joy-skill-btn joy-skill-${side}${ready ? ' ready' : ''}`}
        data-joy-skill={skillIdx}
        data-testid={`joy-skill-${skillIdx}`}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onActiveSkill(skillIdx); }}
      >
        <span className="joy-skill-icon">{sk.icon || skillIdx + 1}</span>
        {!ready && <div className="joy-skill-cd-mask" style={{ height: `${pct}%` }} />}
        {!ready && <span className="joy-skill-cd-txt">{Math.ceil(sk.cd)}</span>}
      </button>
    );
  };

  return (
    <>
      {/* Static ring — always visible, glow matches state */}
      <div className={`static-ring static-ring-left${leftVis.active ? ' active' : ''}${dashCls}`}  data-testid="joy-ring-left" />
      <div className={`static-ring static-ring-right${rightVis.active ? ' active' : ''}`} data-testid="joy-ring-right" />

      {/* Knobs */}
      <div className="static-knob static-knob-left"  data-testid="joy-knob-left"  style={{ transform: `translate(${leftVis.vx * MAX_D}px, ${leftVis.vy * MAX_D}px)` }} />
      <div className="static-knob static-knob-right" data-testid="joy-knob-right" style={{ transform: `translate(${rightVis.vx * MAX_D}px, ${rightVis.vy * MAX_D}px)` }} />

      {/* Active skill buttons at top of each ring */}
      {renderSkillBtn(0, 'left')}
      {renderSkillBtn(1, 'right')}

      {/* Labels — minimal, no "SWIPE" text */}
      <div className="joy-lbl joy-lbl-left">MOVE</div>
      <div className="joy-lbl joy-lbl-right">AIM</div>
    </>
  );
}
