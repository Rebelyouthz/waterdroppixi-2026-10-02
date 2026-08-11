import React, { useState, useRef, useCallback, useEffect } from 'react';
import { POE_TREE_NODES, POE_BRANCHES, POE_RADIAL_NODES, POE_RADIAL_INDEX, BRANCH_ANGLES, MAX_TIER, MAX_TIER_RADIUS, RADIAL_CENTER } from '../game/poe_tree';
import { Audio } from '../game/audio';

// ─── helpers ───────────────────────────────────
const nodeRadius = { minor: 18, notable: 27, keystone: 40 };

function isUnlocked(nodeId, skills) {
  const n = POE_RADIAL_INDEX[nodeId];
  if (!n) return false;
  if (!n.req || n.req.length === 0) return true;
  return n.req.every(r => (skills[r] || 0) >= 1);
}

// ─── Branch label position (outer ring, along the branch's base angle) ──
const RING_LABEL_R = MAX_TIER_RADIUS + 100;
const branchLabelPos = {};
for (const [key] of Object.entries(POE_BRANCHES)) {
  const a = BRANCH_ANGLES[key];
  branchLabelPos[key] = { x: RADIAL_CENTER + RING_LABEL_R * Math.cos(a), y: RADIAL_CENTER + RING_LABEL_R * Math.sin(a), angle: a };
}

// ─── Connection list ────────────────────────────
const CONNECTIONS = [];
for (const node of POE_TREE_NODES) {
  for (const reqId of (node.req || [])) {
    CONNECTIONS.push({ from: reqId, to: node.id, branch: node.branch });
  }
}

// ══════════════════════════════════════════════════════
export default function SkillTree({ save, setSave, onClose }) {
  const containerRef = useRef();
  const [scale, setScale] = useState(0.38);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const dragState = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false });
  const initialized = useRef(false);

  const skills = save.skills || {};

  // ── Center on the wheel's core, zoomed out to show the whole 360° tree ──
  useEffect(() => {
    if (initialized.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return; // not laid out yet, retry
    const diameter = (MAX_TIER_RADIUS + 170) * 2;
    const fitScale = Math.min(rect.width, rect.height) * 0.94 / diameter;
    const initScale = Math.max(0.12, Math.min(0.85, fitScale));
    setPan({ x: rect.width / 2 - RADIAL_CENTER * initScale, y: rect.height / 2 - RADIAL_CENTER * initScale });
    setScale(initScale);
    initialized.current = true;
  }, []);

  // ── Wheel zoom ───────────────────────────────────
  // Throttled to at most one state update per animation frame — the SVG
  // has ~65 nodes plus glow filters, and firing a full re-render on every
  // single wheel tick (a fast scroll can fire 20+ in one gesture) was
  // heavy enough to freeze/crash the tab. rAF-batching + a CSS transform
  // (instead of the SVG transform attribute, which forces a full filter
  // repaint every change) fixes that.
  const wheelPending = useRef(null);
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.12 : 0.9;
    wheelPending.current = { mx, my, delta: (wheelPending.current?.delta || 1) * delta };
    if (wheelPending.current._raf) return;
    wheelPending.current._raf = true;
    requestAnimationFrame(() => {
      const { mx: fmx, my: fmy, delta: fdelta } = wheelPending.current;
      wheelPending.current = null;
      setScale(prev => {
        const ns = Math.max(0.08, Math.min(2.6, prev * fdelta));
        const ratio = ns / prev;
        setPan(p => ({ x: fmx - ratio * (fmx - p.x), y: fmy - ratio * (fmy - p.y) }));
        return ns;
      });
    });
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    c.addEventListener('touchstart', onTouchStart, { passive: false });
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    c.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      c.removeEventListener('wheel', handleWheel);
      c.removeEventListener('touchstart', onTouchStart);
      c.removeEventListener('touchmove', onTouchMove);
      c.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleWheel]);

  // ── Mouse pan ────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    dragState.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
  };
  const onMouseMove = (e) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragState.current.moved = true;
    setPan({ x: dragState.current.startPanX + dx, y: dragState.current.startPanY + dy });
  };
  const onMouseUp = () => { dragState.current.active = false; };

  // ── Touch pan + pinch-zoom ────────────────────────
  // No touch handlers existed before — on mobile the browser's native
  // touch scroll / pull-to-refresh gesture took over the drag/pinch,
  // which is what was reloading the page. touchAction:'none' (CSS) +
  // preventDefault() here fully suppress that native behavior.
  // NOTE: calling preventDefault() on touchstart/move also kills the
  // browser's normal synthetic "click" it fires after a tap — that's why
  // nodes stopped being selectable/buyable on touch. Fixed below by
  // manually dispatching a real click on tap instead of relying on it.
  const touchState = useRef({ mode: null, lastX: 0, lastY: 0, lastDist: 0, startX: 0, startY: 0 });
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const onTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const { clientX, clientY } = e.touches[0];
      touchState.current = { mode: 'pan', lastX: clientX, lastY: clientY, startX: clientX, startY: clientY };
    } else if (e.touches.length === 2) {
      touchState.current = { mode: 'pinch', lastDist: dist(e.touches[0], e.touches[1]) };
    }
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    const ts = touchState.current;
    if (ts.mode === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - ts.lastX;
      const dy = e.touches[0].clientY - ts.lastY;
      ts.lastX = e.touches[0].clientX; ts.lastY = e.touches[0].clientY;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (ts.mode === 'pinch' && e.touches.length === 2) {
      const nd = dist(e.touches[0], e.touches[1]);
      const ratio = nd / (ts.lastDist || nd);
      ts.lastDist = nd;
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const mx = rect ? (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left : 0;
      const my = rect ? (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top : 0;
      setScale(prev => {
        const ns = Math.max(0.08, Math.min(2.6, prev * ratio));
        const r = ns / prev;
        setPan(p => ({ x: mx - r * (mx - p.x), y: my - r * (my - p.y) }));
        return ns;
      });
    }
  };
  const onTouchEnd = (e) => {
    e.preventDefault();
    const ts = touchState.current;
    if (ts.mode === 'pan' && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const moved = Math.hypot(t.clientX - ts.startX, t.clientY - ts.startY);
      // A real tap (barely moved) — the browser won't fire its own click
      // because we preventDefault()'d the touch, so fire one ourselves at
      // the exact tap point. This is what lets nodes be selected/bought.
      if (moved < 8) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY }));
      }
    }
    if (e.touches.length === 0) touchState.current = { mode: null };
  };

  // ── Buy node ─────────────────────────────────────
  const buyNode = (node) => {
    if (!isUnlocked(node.id, skills)) return;
    const lvl = skills[node.id] || 0;
    if (lvl >= node.max) return;
    if (save.sp < node.c) { showToast('NOT ENOUGH SP'); return; }
    setSave({ ...save, sp: save.sp - node.c, skills: { ...save.skills, [node.id]: lvl + 1 } });
    Audio?.click?.();
    showToast(`${node.name} Lv.${lvl + 1}`);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1400);
  };

  // ── Node click ───────────────────────────────────
  const onNodeClick = (e, node) => {
    e.stopPropagation();
    if (dragState.current.moved) return;
    setSelected(prev => prev?.id === node.id ? null : node);
  };

  const selNode = selected ? POE_RADIAL_INDEX[selected.id] : null;
  const selLvl  = selNode ? (skills[selNode.id] || 0) : 0;
  const selBranch = selNode ? POE_BRANCHES[selNode.branch] : null;
  const selCanBuy = selNode && isUnlocked(selNode.id, skills) && selLvl < selNode.max && save.sp >= selNode.c;
  const selLocked = selNode && !isUnlocked(selNode.id, skills);

  return (
    <div className="poe-overlay" data-testid="skill-tree" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="poe-panel">

        {/* ── Top Bar ── */}
        <div className="poe-topbar">
          <div className="poe-topbar-left">
            <span className="poe-title">SKILL TREE</span>
            <span className="poe-sp">◆ {save.sp} SP</span>
            <span className="poe-hint">Drag to pan · Scroll to zoom · Click to inspect</span>
          </div>
          <div className="poe-topbar-right">
            <button className="poe-close-btn" onClick={onClose} data-testid="st-close">✕</button>
          </div>
        </div>

        {/* ── Main body ── */}
        <div className="poe-body">

          {/* ── SVG Canvas ── */}
          <div
            ref={containerRef}
            className="poe-canvas"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ cursor: dragState.current.active ? 'grabbing' : 'grab' }}
          >
            <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <filter id="poe-glow">
                  <feGaussianBlur stdDeviation="4" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="poe-glow-hard">
                  <feGaussianBlur stdDeviation="8" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                {/* Timmy: nodes should feel carved/gem-set, not flat discs.
                    One shared "glass" shading overlay, layered on top of
                    every node's own flat colour fill regardless of branch —
                    a bright facet catching light near the top-left, falling
                    through to a dark socket shadow at the bottom-right. Only
                    a handful of defs for ~65 nodes rather than one gradient
                    per node keeps this cheap. */}
                <radialGradient id="poe-gem-shade" cx="32%" cy="26%" r="85%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                  <stop offset="38%" stopColor="#ffffff" stopOpacity="0.08" />
                  <stop offset="72%" stopColor="#000000" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.58" />
                </radialGradient>
                {/* The locked/unpurchased socket: an empty carved hollow
                    rather than a flat dim ring — dark at the rim, darker
                    still at the base, with the faint bevel doing the work
                    unlit nodes used to need a coloured stroke for. */}
                <radialGradient id="poe-socket-shade" cx="50%" cy="42%" r="75%">
                  <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                  <stop offset="60%" stopColor="#000000" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.62" />
                </radialGradient>
              </defs>

              <g style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: '0px 0px' }}>

                {/* ── Core hub glow ── */}
                <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={70} fill="rgba(179,98,255,0.06)" />
                <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={40} fill="none" stroke="#b362ff" strokeWidth={1.5} opacity={0.5} filter="url(#poe-glow)" />
                <circle cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={8} fill="#e8d0ff" opacity={0.8} />

                {/* ── Per-branch background wedge — a faint tint of each
                    branch's own color from center to edge, so the wheel's 9
                    sectors are recognizable at a glance even before anything
                    is unlocked ("better skill-tree background"). ── */}
                {Object.entries(POE_BRANCHES).map(([key, b]) => {
                  const half = (Math.PI / Object.keys(POE_BRANCHES).length) * 0.72;
                  const a0 = BRANCH_ANGLES[key] - half, a1 = BRANCH_ANGLES[key] + half;
                  const R = MAX_TIER_RADIUS + 40;
                  const x0 = RADIAL_CENTER + R * Math.cos(a0), y0 = RADIAL_CENTER + R * Math.sin(a0);
                  const x1 = RADIAL_CENTER + R * Math.cos(a1), y1 = RADIAL_CENTER + R * Math.sin(a1);
                  return (
                    <path key={`wedge-${key}`}
                      d={`M ${RADIAL_CENTER} ${RADIAL_CENTER} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`}
                      fill={b.color} opacity={0.045} />
                  );
                })}

                {/* ── Concentric ring grid (depth) + radial sector spokes ── */}
                {Array.from({ length: MAX_TIER + 1 }).map((_, i) => (
                  <circle key={`ring${i}`} cx={RADIAL_CENTER} cy={RADIAL_CENTER} r={175 + i * 140}
                    fill="none" stroke="#1a0f30" strokeWidth={1} opacity={0.35} />
                ))}
                {Object.entries(POE_BRANCHES).map(([key], i) => {
                  const gapA = BRANCH_ANGLES[key] - Math.PI / Object.keys(POE_BRANCHES).length;
                  const x2 = RADIAL_CENTER + (MAX_TIER_RADIUS + 60) * Math.cos(gapA);
                  const y2 = RADIAL_CENTER + (MAX_TIER_RADIUS + 60) * Math.sin(gapA);
                  return <line key={`spoke${key}`} x1={RADIAL_CENTER} y1={RADIAL_CENTER} x2={x2} y2={y2} stroke="#1a0f30" strokeWidth={1} opacity={0.4} />;
                })}

                {/* ── Branch labels — outer ring (full name) AND inner ring
                    (near the root node, so you always know which branch
                    you're looking at whether you're zoomed to the core or
                    the rim). ── */}
                {Object.entries(POE_BRANCHES).map(([key, b]) => {
                  const pos = branchLabelPos[key];
                  const cosA = Math.cos(pos.angle);
                  const anchor = cosA > 0.35 ? 'start' : cosA < -0.35 ? 'end' : 'middle';
                  const innerR = 115;
                  const ix = RADIAL_CENTER + innerR * Math.cos(pos.angle), iy = RADIAL_CENTER + innerR * Math.sin(pos.angle);
                  return (
                    <React.Fragment key={`lbl-${key}`}>
                      <text x={pos.x} y={pos.y} textAnchor={anchor} dominantBaseline="middle"
                        fill={b.color} fontSize={22} fontFamily="VT323" opacity={0.8} letterSpacing={2}>
                        {b.icon} {b.name}
                      </text>
                      <text x={ix} y={iy} textAnchor="middle" dominantBaseline="middle"
                        fill={b.color} fontSize={11} fontFamily="VT323" opacity={0.7} letterSpacing={1}>
                        {b.icon}
                      </text>
                    </React.Fragment>
                  );
                })}

                {/* ── Connection lines ── */}
                {CONNECTIONS.map(({ from, to, branch: br }) => {
                  const fnNode = POE_RADIAL_INDEX[from];
                  const toNode = POE_RADIAL_INDEX[to];
                  if (!fnNode || !toNode) return null;
                  const bCol = POE_BRANCHES[br]?.color || '#3a2a6e';
                  const ownedFrom = (skills[from] || 0) >= 1;
                  const ownedTo   = (skills[to]   || 0) >= 1;
                  const active    = ownedFrom && ownedTo;
                  const partial   = ownedFrom && !ownedTo;
                  return (
                    <g key={`ln-${from}-${to}`}>
                      {/* Glow underlay for active connections */}
                      {active && (
                        <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                          stroke={bCol} strokeWidth={8} opacity={0.15} strokeLinecap="round" />
                      )}
                      {/* A dark groove under every line — even the faint,
                          unowned ones — so it reads as a channel cut into the
                          panel instead of a line drawn on top of it. */}
                      <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                        stroke="#000000" strokeWidth={(active ? 3 : 2) + 1.6}
                        opacity={active ? 0.5 : partial ? 0.3 : 0.18} strokeLinecap="round" />
                      <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                        stroke={bCol}
                        strokeWidth={active ? 3 : 2}
                        opacity={active ? 0.85 : partial ? 0.4 : 0.16}
                        strokeLinecap="round"
                        strokeDasharray={partial ? '6 4' : undefined}
                      />
                      {/* A thin bright core down the middle of ACTIVE lines
                          only — the "energy running through it" read the
                          reference asked for, without adding one on every
                          faint unowned line where it would just look noisy. */}
                      {active && (
                        <line x1={fnNode.rx} y1={fnNode.ry} x2={toNode.rx} y2={toNode.ry}
                          stroke="#ffffff" strokeWidth={0.9} opacity={0.55} strokeLinecap="round" />
                      )}
                    </g>
                  );
                })}

                {/* ── Nodes ── */}
                {POE_RADIAL_NODES.map(node => {
                  const b    = POE_BRANCHES[node.branch];
                  const lvl  = skills[node.id] || 0;
                  const unlk = isUnlocked(node.id, skills);
                  const maxd = lvl >= node.max;
                  const purd = lvl > 0;
                  const isSel = selected?.id === node.id;
                  const r    = nodeRadius[node.type] || 18;
                  const nx = node.rx, ny = node.ry;

                  // Colors — locked nodes stay dim ("fogged") until they're
                  // reachable, but keep a faint hint of their branch color so
                  // the shape of the whole wheel is always readable — just
                  // not lit up like an unlocked/purchased node.
                  let fill   = 'rgba(8,5,16,0.4)';
                  let stroke = b.color;
                  let sw     = 1;
                  let glowFilter = undefined;
                  let groupOpacity = 0.4;

                  if (maxd) {
                    fill = '#2a1a00'; stroke = '#ffd700'; sw = 3;
                    glowFilter = 'url(#poe-glow)'; groupOpacity = 1;
                  } else if (purd) {
                    fill = b.color + '22'; stroke = b.color; sw = 2;
                    glowFilter = 'url(#poe-glow)'; groupOpacity = 1;
                  } else if (unlk) {
                    fill = '#12083a'; stroke = b.color; sw = 2;
                    glowFilter = 'url(#poe-glow)'; groupOpacity = 1;
                  }

                  if (isSel) { sw = 4; glowFilter = 'url(#poe-glow-hard)'; groupOpacity = 1; }

                  return (
                    <g key={node.id} filter={glowFilter} opacity={groupOpacity}
                      onClick={(e) => onNodeClick(e, node)}
                      style={{ cursor: 'pointer' }}>

                      {/* Selection ring */}
                      {isSel && (
                        <circle cx={nx} cy={ny} r={r + 12}
                          fill="none" stroke={b.color} strokeWidth={1.5} opacity={0.5}
                          strokeDasharray="8 4" />
                      )}

                      {/* Keystone diamond backdrop */}
                      {node.type === 'keystone' && (
                        <polygon
                          points={`${nx},${ny - r - 10} ${nx + r + 10},${ny} ${nx},${ny + r + 10} ${nx - r - 10},${ny}`}
                          fill={fill} stroke={stroke} strokeWidth={sw * 0.7} opacity={0.6}
                        />
                      )}

                      {/* Notable hex backdrop */}
                      {node.type === 'notable' && (() => {
                        const pts = Array.from({ length: 6 }).map((_, i) => {
                          const a = (i * 60 - 30) * Math.PI / 180;
                          return `${nx + (r + 5) * Math.cos(a)},${ny + (r + 5) * Math.sin(a)}`;
                        }).join(' ');
                        return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw * 0.5} opacity={0.4} />;
                      })()}

                      {/* Main circle: flat colour fill first, exactly as before... */}
                      <circle cx={nx} cy={ny} r={r} fill={fill} stroke="none" />
                      {/* ...then the carved/gem shading on top — an empty
                          socket while locked, a lit facet once something is
                          actually set into it — and a real bevel edge
                          (dark outer ring, bright inner ring) in place of
                          the old single flat stroke. */}
                      <circle cx={nx} cy={ny} r={r}
                        fill={`url(#${unlk ? 'poe-gem-shade' : 'poe-socket-shade'})`} stroke="none" />
                      <circle cx={nx} cy={ny} r={r} fill="none"
                        stroke="#000000" strokeOpacity={0.55} strokeWidth={sw + 1.4} />
                      <circle cx={nx} cy={ny} r={r - Math.max(1, sw * 0.35)} fill="none"
                        stroke={stroke} strokeWidth={sw} />
                      {unlk && (
                        <circle cx={nx} cy={ny} r={r - Math.max(1, sw * 0.35)} fill="none"
                          stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />
                      )}

                      {/* Filled arc to show level progress */}
                      {purd && !maxd && node.max > 1 && (() => {
                        const pct = lvl / node.max;
                        const startAngle = -Math.PI / 2;
                        const endAngle   = startAngle + pct * 2 * Math.PI;
                        const x1 = nx + r * Math.cos(startAngle);
                        const y1 = ny + r * Math.sin(startAngle);
                        const x2 = nx + r * Math.cos(endAngle);
                        const y2 = ny + r * Math.sin(endAngle);
                        const lg = pct > 0.5 ? 1 : 0;
                        return (
                          <path d={`M ${nx} ${ny} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`}
                            fill={b.color + '55'} stroke="none" />
                        );
                      })()}

                      {/* Maxed fill */}
                      {maxd && <circle cx={nx} cy={ny} r={r} fill="#ffd70040" stroke="none" />}

                      {/* Icon — hidden while locked/almost-invisible */}
                      {unlk && (
                        <text x={nx} y={ny + 6} textAnchor="middle"
                          fontSize={node.type === 'keystone' ? 22 : node.type === 'notable' ? 16 : 13}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}>
                          {node.icon}
                        </text>
                      )}

                      {/* Level badge */}
                      {purd && node.max > 1 && (
                        <text x={nx + r - 2} y={ny - r + 7} textAnchor="middle"
                          fontSize={9} fill={maxd ? '#ffd700' : '#fff'} fontFamily="VT323"
                          style={{ pointerEvents: 'none' }}>
                          {lvl}
                        </text>
                      )}

                      {/* "START" pulse on unlocked start-nodes (no req) */}
                      {!node.req?.length && !purd && (
                        <>
                          <circle cx={nx} cy={ny} r={r + 6}
                            fill="none" stroke={b.color} strokeWidth={1.5} opacity={0.4}
                            className="poe-start-pulse" />
                          <text x={nx} y={ny + r + 18} textAnchor="middle"
                            fontSize={11} fill={b.color} fontFamily="VT323" opacity={0.8}
                            style={{ pointerEvents: 'none' }}>
                            ▼ START
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

              </g>
            </svg>

            {/* Zoom hint */}
            <div className="poe-zoom-hint">
              {Math.round(scale * 100)}%
            </div>
          </div>

          {/* ── Preview Panel ── */}
          <div className={`poe-preview ${selNode ? 'open' : ''}`}>
            {selNode ? (
              <>
                <div className="poe-prev-branch" style={{ color: selBranch?.color }}>
                  {selBranch?.icon} {selBranch?.name}
                </div>
                <div className="poe-prev-icon" style={{ textShadow: `0 0 20px ${selBranch?.color}` }}>
                  {selNode.icon}
                </div>
                <div className="poe-prev-name">{selNode.name}</div>
                <div className="poe-prev-type" style={{ color: selBranch?.color }}>
                  {selNode.type.toUpperCase()}
                  {selNode.active && ' · ACTIVE SKILL'}
                </div>
                <div className="poe-prev-desc">{selNode.desc}</div>
                <div className="poe-prev-level">
                  {Array.from({ length: selNode.max }).map((_, i) => (
                    <span key={i} className={`poe-lvl-pip ${i < selLvl ? 'on' : ''}`}
                      style={{ '--pc': selBranch?.color }} />
                  ))}
                  <span className="poe-lvl-text">{selLvl} / {selNode.max}</span>
                </div>
                <div className="poe-prev-cost">◆ {selNode.c} SP per level</div>

                {selLocked && (() => {
                  const reqNode = selNode.req?.[0] ? POE_RADIAL_INDEX[selNode.req[0]] : null;
                  return (
                    <div className="poe-prev-locked">
                      🔒 Requires: {reqNode?.name || selNode.req?.[0]}
                    </div>
                  );
                })()}

                {!selLocked && selLvl >= selNode.max && (
                  <div className="poe-prev-maxed">MAXED ✓</div>
                )}

                {!selLocked && selLvl < selNode.max && (
                  <button
                    className={`poe-buy-btn ${selCanBuy ? 'can' : 'cant'}`}
                    onClick={() => buyNode(selNode)}
                    disabled={!selCanBuy}
                    data-testid={`buy-poe-${selNode.id}`}
                  >
                    {selCanBuy ? `BUY — ◆ ${selNode.c} SP` : save.sp < selNode.c ? `NEED ◆ ${selNode.c} SP` : 'UNLOCK TREE FIRST'}
                  </button>
                )}

                <button className="poe-desel-btn" onClick={() => setSelected(null)}>← Back</button>
              </>
            ) : (
              <div className="poe-prev-empty">
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌌</div>
                <div style={{ fontFamily: 'VT323', fontSize: 18, color: '#4a3a6e', letterSpacing: 2 }}>
                  SELECT A NODE
                </div>
                <div style={{ fontSize: 12, color: '#3a2a5e', marginTop: 8, lineHeight: 1.6 }}>
                  Click any node<br/>to inspect & buy
                </div>
                <div style={{ marginTop: 24, fontSize: 11, color: '#3a2a4e', lineHeight: 1.8 }}>
                  ◆ {save.sp} SP available
                </div>
                {Object.entries(POE_BRANCHES).map(([key, b]) => {
                  const bNodes = POE_TREE_NODES.filter(n => n.branch === key);
                  const owned = bNodes.filter(n => (skills[n.id] || 0) >= 1).length;
                  return (
                    <div key={key} className="poe-branch-summary" style={{ '--bc': b.color }}>
                      <span>{b.icon} {b.name}</span>
                      <span>{owned}/{bNodes.length}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Toast ── */}
        {toast && <div className="poe-toast">{toast}</div>}

      </div>
    </div>
  );
}
