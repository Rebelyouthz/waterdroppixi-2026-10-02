import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  HANGAR_STATIONS, hangarAnchor, FLOOR, FLOOR_W, FLOOR_H, HERO_R, WALK_SPEED, REACH, STAGE_W, STAGE_H,
} from '../game/hangarLayout';
import { BUILDINGS, buildingLevel, buildingCost, isModuleAvailable, tryBuyBuilding } from '../game/base';
import { loadHangarBitmaps } from '../game/hangarBitmaps';
import { heroHalfPoints, HERO_COLORS } from '../game/heroShape';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';

// THE HANGAR — walkable bay next to the Main Hall.
// Same method as the hall: camp sprite sheets (floor tileset + hangar-door
// strip) plus hardcoded bay / ship / turrets / hatch / drop. Canvas 2d on
// purpose — a second live Pixi Application next to StationRoom is how the
// tab used to wedge. The hall unmounts while this is open.
// Claude: do not "upgrade" this to Pixi unless StationRoom is unmounted
// (Camp already does that) AND you load waterdrop-lighting first.

const TAU = Math.PI * 2;

export default function HangarRoom({ save, setSave, onUnlock, onStarRaid, onDefence, onDrain, onClose, escEnabled = true }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const escRef = useRef(escEnabled);
  escRef.current = escEnabled;
  const bitmapsRef = useRef({ floor: { img: null }, door: { img: null } });
  const [near, setNear] = useState(null);

  const drainBuilt = buildingLevel(save, 'drain') >= 1;

  const interact = useCallback((st) => {
    if (!st) return;
    if (st.id === 'hall') {
      if (Audio.stationInteract) Audio.stationInteract('exit');
      onClose();
      return;
    }
    if (st.id === 'ship') {
      if (Audio.stationInteract) Audio.stationInteract('hangar');
      onStarRaid && onStarRaid();
      return;
    }
    if (st.id === 'turrets') {
      if (Audio.stationInteract) Audio.stationInteract('rampart');
      onDefence && onDefence();
      return;
    }
    if (st.id === 'hatch') {
      if (buildingLevel(saveRef.current, 'drain') < 1) {
        const bought = tryBuyBuilding(saveRef.current, 'drain');
        if (!bought.ok) {
          pushToast({ tone: 'default', icon: 'ui_lock', title: bought.title, text: bought.text });
          if (Audio.skillDenied) Audio.skillDenied();
          return;
        }
        setSave(bought.save);
        if (onUnlock) onUnlock(['drain']);
        if (stateRef.current) {
          stateRef.current.hatch = 0.01;
          spawnBolts(stateRef.current);
        }
        if (Audio.shutterSlide) Audio.shutterSlide();
        if (Audio.stationBuild) Audio.stationBuild();
        if (Audio.campSteam) Audio.campSteam();
        pushToast({
          tone: 'legendary',
          icon: 'ui_hatch',
          title: 'HATCH UNSCREWED',
          text: 'The grate opens onto THE DRAIN under the hangar.',
          key: 'station:drain:1',
          once: true,
        });
        return;
      }
      if (Audio.stationInteract) Audio.stationInteract('drain');
      onDrain && onDrain();
    }
  }, [onClose, onStarRaid, onDefence, onDrain, onUnlock, setSave]);

  const interactRef = useRef(interact);
  interactRef.current = interact;

  useEffect(() => {
    let live = true;
    loadHangarBitmaps().then((b) => { if (live) bitmapsRef.current = b; });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const keys = new Set();
    const st = {
      px: FLOOR.x0 + FLOOR_W * 0.18,
      py: FLOOR.y1 - 70,
      vx: 0, vy: 0,
      nearest: null,
      t: 0,
      hatch: 0,
      step: 0,
      ripples: [],
      bolts: [],
      steam: [],
    };
    stateRef.current = st;

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      st.sw = r.width; st.sh = r.height; st.dpr = dpr;
    };
    fit();
    const onResize = () => fit();
    window.addEventListener('resize', onResize);

    const toStage = (cx, cy) => {
      const scale = Math.min(st.sw / STAGE_W, st.sh / STAGE_H);
      const ox = (st.sw - STAGE_W * scale) / 2;
      const oy = (st.sh - STAGE_H * scale) / 2;
      return { x: (cx - ox) / scale, y: (cy - oy) / scale };
    };

    const down = (e) => {
      if (e.code === 'Escape') {
        if (escRef.current) onCloseRef.current();
        return;
      }
      if (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        if (st.nearest) interactRef.current(st.nearest);
        return;
      }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) {
        e.preventDefault();
        keys.add(e.code);
      }
    };
    const up = (e) => { keys.delete(e.code); };
    const blur = () => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);

    const pointer = (e) => {
      const r = canvas.getBoundingClientRect();
      const p = toStage(e.clientX - r.left, e.clientY - r.top);
      if (p.x < FLOOR.x0 || p.x > FLOOR.x1 || p.y < FLOOR.y0 || p.y > FLOOR.y1) return;
      st.tx = p.x; st.ty = p.y;
    };
    canvas.addEventListener('pointerdown', pointer);

    let last = performance.now();
    let raf = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st.t += dt;
      if (st.hatch > 0 && st.hatch < 1) st.hatch = Math.min(1, st.hatch + dt / 0.9);

      let mx = 0, my = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (mx || my) {
        const l = Math.hypot(mx, my) || 1;
        st.vx = (mx / l) * WALK_SPEED;
        st.vy = (my / l) * WALK_SPEED;
        st.tx = st.ty = null;
      } else if (st.tx != null) {
        const dx = st.tx - st.px, dy = st.ty - st.py;
        const d = Math.hypot(dx, dy);
        if (d < 6) { st.tx = st.ty = null; st.vx = st.vy = 0; }
        else { st.vx = (dx / d) * WALK_SPEED; st.vy = (dy / d) * WALK_SPEED; }
      } else {
        st.vx = 0; st.vy = 0;
      }
      st.px = Math.max(FLOOR.x0 + HERO_R, Math.min(FLOOR.x1 - HERO_R, st.px + st.vx * dt));
      st.py = Math.max(FLOOR.y0 + HERO_R, Math.min(FLOOR.y1 - HERO_R, st.py + st.vy * dt));

      const spd = Math.hypot(st.vx, st.vy);
      if (spd > 8) {
        st.step += spd * dt;
        if (st.step > 34) {
          st.step = 0;
          st.ripples.push({ x: st.px, y: st.py + HERO_R * 0.9, t: 0 });
          if (Audio.campFootstep) Audio.campFootstep();
        }
      }
      for (let i = st.ripples.length - 1; i >= 0; i--) {
        st.ripples[i].t += dt;
        if (st.ripples[i].t > 0.55) st.ripples.splice(i, 1);
      }
      for (let i = st.bolts.length - 1; i >= 0; i--) {
        const b = st.bolts[i];
        b.vy += 420 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.spin * dt;
        b.life -= dt;
        if (b.life <= 0 || b.y > FLOOR.y1 + 20) st.bolts.splice(i, 1);
      }
      const hatchOpen = st.hatch >= 1 || buildingLevel(saveRef.current, 'drain') >= 1;
      if (hatchOpen && Math.random() < dt * 8) {
        const hatch = HANGAR_STATIONS.find(s => s.id === 'hatch');
        st.steam.push({
          x: hatch.x + (Math.random() - 0.5) * 18,
          y: hatch.y,
          vx: (Math.random() - 0.5) * 12,
          vy: -28 - Math.random() * 22,
          life: 0.9 + Math.random() * 0.5,
          max: 1.2,
        });
      }
      for (let i = st.steam.length - 1; i >= 0; i--) {
        const p = st.steam[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= 0.98;
        p.life -= dt;
        if (p.life <= 0) st.steam.splice(i, 1);
      }

      let best = null, bestD = REACH;
      for (const s of HANGAR_STATIONS) {
        const a = hangarAnchor(s);
        const d = Math.hypot(a.x - st.px, a.y - st.py);
        if (d < bestD) { bestD = d; best = s; }
      }
      if ((best && best.id) !== (st.nearest && st.nearest.id)) {
        st.nearest = best;
        setNear(best);
        if (best && Audio.skillHover) Audio.skillHover('minor');
      }

      draw(ctx, st, saveRef.current, bitmapsRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', pointer);
    };
  }, []);

  useEffect(() => {
    if (drainBuilt && stateRef.current && stateRef.current.hatch < 1) {
      stateRef.current.hatch = 1;
    }
  }, [drainBuilt]);

  const built = near && near.module ? buildingLevel(save, near.module) > 0 : true;
  const cost = near && near.module && !built
    ? buildingCost(near.module, buildingLevel(save, near.module))
    : null;
  const open = near && near.module ? isModuleAvailable(save, near.module) : true;
  const accent = near && near.module && BUILDINGS[near.module]
    ? BUILDINGS[near.module].accent
    : near && near.id === 'hall' ? '#4dff91' : '#5fd6ff';

  const useLabel = !near ? 'ENTER'
    : near.id === 'hall' ? 'LEAVE'
      : near.id === 'hatch' && !built ? (open ? 'UNSCREW HATCH' : 'LOCKED')
        : near.id === 'hatch' ? 'DESCEND'
          : near.id === 'ship' ? 'STAR RAID'
            : near.id === 'turrets' ? 'DEFENCE' : 'ENTER';

  return (
    <div className="sr-overlay" data-testid="hangar-room">
      <canvas ref={canvasRef} className="sr-canvas" />
      <div className="sr-head">
        <div className="sr-title">
          <GameIcon name="ui_rocket" size={18} /> HANGAR BAY
        </div>
        <span className="sr-sub">
          {drainBuilt ? 'hatch open · THE DRAIN underneath' : 'abandoned · tarp on the ship · grate bolted'}
        </span>
        <button className="sr-close" onClick={onClose} aria-label="Back to the hall">x</button>
      </div>
      <div className="sr-keys">
        <span><b>WASD</b> / tap floor to walk</span>
        <span><b>E</b> to use</span>
        <span><b>ESC</b> back to hall</span>
      </div>
      {near && (
        <div className={`sr-prompt${built ? '' : ' locked'}`} style={{ '--sr-accent': accent }}>
          <div className="sr-prompt-copy">
            <div className="sr-prompt-name">
              {near.name}
              {!built && near.module && <span className="sr-lock"><GameIcon name="ui_lock" size={12} /> bolted</span>}
            </div>
            <div className="sr-prompt-hint">
              {!built && near.module
                ? (open
                  ? `Unscrew the grate.${cost ? ` ${cost.gold} gold${cost.parts ? ` · ${cost.parts} parts` : ''}.` : ''}`
                  : 'The hangar has to be online first.')
                : near.hint}
            </div>
          </div>
          <button
            className="sr-use"
            onClick={() => interact(near)}
            data-testid="hangar-use"
          >
            {useLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function spawnBolts(st) {
  const hatch = HANGAR_STATIONS.find(s => s.id === 'hatch');
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    st.bolts.push({
      x: hatch.x + Math.cos(a) * 22,
      y: hatch.y + Math.sin(a) * 22,
      vx: Math.cos(a) * (70 + Math.random() * 40),
      vy: -90 - Math.random() * 50,
      rot: a,
      spin: (Math.random() - 0.5) * 10,
      life: 1.1,
    });
  }
}

function draw(ctx, st, save, bitmaps) {
  const { sw, sh, dpr } = st;
  if (!sw || !sh) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, sw, sh);
  const scale = Math.min(sw / STAGE_W, sh / STAGE_H);
  const ox = (sw - STAGE_W * scale) / 2;
  const oy = (sh - STAGE_H * scale) / 2;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, sw, sh);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  drawBayShell(ctx);
  drawFloor(ctx, bitmaps);
  drawLightPools(ctx, st.t);
  drawRipples(ctx, st.ripples);

  const ship = HANGAR_STATIONS.find(s => s.id === 'ship');
  drawShip(ctx, ship.x, ship.y, st.t);
  const tur = HANGAR_STATIONS.find(s => s.id === 'turrets');
  drawTurrets(ctx, tur.x, tur.y, st.t);
  const hatch = HANGAR_STATIONS.find(s => s.id === 'hatch');
  const open = buildingLevel(save, 'drain') >= 1 || st.hatch > 0;
  const hatchT = open ? Math.max(st.hatch, buildingLevel(save, 'drain') >= 1 ? 1 : st.hatch) : 0;
  drawHatch(ctx, hatch.x, hatch.y, hatchT, st.t);
  drawSteam(ctx, st.steam);
  drawBolts(ctx, st.bolts);
  const hall = HANGAR_STATIONS.find(s => s.id === 'hall');
  drawHallDoor(ctx, hall.x, hall.y, bitmaps);

  // Cable toward the hall — A.I.D.A.'s transmitter twist, planted visually.
  ctx.save();
  ctx.strokeStyle = `rgba(95, 214, 255, ${0.22 + Math.sin(st.t * 2.2) * 0.08})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(hatch.x + 10, hatch.y - 4);
  ctx.bezierCurveTo(hatch.x + 80, hatch.y + 40, hall.x + 90, hall.y - 50, hall.x + 18, hall.y - 8);
  ctx.stroke();
  ctx.restore();

  const moving = Math.hypot(st.vx, st.vy) > 8;
  drawDrop(ctx, st.px, st.py, moving, st.t);

  ctx.restore();
}

function drawBayShell(ctx) {
  ctx.fillStyle = '#10131a';
  ctx.beginPath();
  ctx.rect(0, 0, STAGE_W, STAGE_H);
  ctx.fill();

  ctx.fillStyle = '#161018';
  ctx.beginPath();
  ctx.rect(FLOOR.x0 - 48, FLOOR.y0 - 72, FLOOR_W + 96, FLOOR_H + 118);
  ctx.fill();

  // Ceiling ribs — paths, not a grid of squares.
  ctx.strokeStyle = 'rgba(70, 78, 90, 0.55)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 6; i++) {
    const x = FLOOR.x0 + 40 + i * ((FLOOR_W - 80) / 5);
    ctx.beginPath();
    ctx.moveTo(x, FLOOR.y0 - 70);
    ctx.lineTo(x - 12, FLOOR.y0 - 8);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40, 44, 52, 0.9)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(FLOOR.x0 - 20, FLOOR.y0 - 64);
  ctx.lineTo(FLOOR.x1 + 20, FLOOR.y0 - 64);
  ctx.stroke();
}

function drawFloor(ctx, bitmaps) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(FLOOR.x0, FLOOR.y0, FLOOR_W, FLOOR_H);
  ctx.clip();
  const img = bitmaps && bitmaps.floor && bitmaps.floor.img;
  if (img) {
    ctx.drawImage(img, FLOOR.x0, FLOOR.y0, FLOOR_W, FLOOR_H);
  } else {
    const g = ctx.createLinearGradient(FLOOR.x0, FLOOR.y0, FLOOR.x0, FLOOR.y1);
    g.addColorStop(0, '#2a241c');
    g.addColorStop(1, '#16120e');
    ctx.fillStyle = g;
    ctx.fill();
  }
  const wash = ctx.createLinearGradient(FLOOR.x0, FLOOR.y0, FLOOR.x0, FLOOR.y1);
  wash.addColorStop(0, 'rgba(22, 16, 12, 0.22)');
  wash.addColorStop(1, 'rgba(6, 8, 12, 0.42)');
  ctx.fillStyle = wash;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(210, 190, 150, 0.07)';
  ctx.lineWidth = 1;
  ctx.strokeRect(FLOOR.x0 + 0.5, FLOOR.y0 + 0.5, FLOOR_W - 1, FLOOR_H - 1);
}

function drawLightPools(ctx, t) {
  const pulse = 0.78 + Math.sin(t * 1.4) * 0.08;
  const spots = [
    { x: FLOOR.x0 + FLOOR_W * 0.22, y: FLOOR.y0 + FLOOR_H * 0.38, c: '80, 90, 110' },
    { x: FLOOR.x0 + FLOOR_W * 0.50, y: FLOOR.y0 + FLOOR_H * 0.28, c: '90, 100, 120' },
    { x: FLOOR.x0 + FLOOR_W * 0.78, y: FLOOR.y0 + FLOOR_H * 0.38, c: '80, 90, 110' },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of spots) {
    const g = ctx.createRadialGradient(s.x, s.y, 8, s.x, s.y, 120);
    g.addColorStop(0, `rgba(${s.c}, ${0.16 * pulse})`);
    g.addColorStop(0.55, `rgba(${s.c}, ${0.05 * pulse})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 120, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  ctx.fillStyle = 'rgba(210,190,150,0.11)';
  for (let i = 0; i < 22; i++) {
    const x = FLOOR.x0 + ((i * 97 + t * 14) % FLOOR_W);
    const y = FLOOR.y0 + ((i * 53 + Math.sin(t * 0.4 + i) * 22 + FLOOR_H) % FLOOR_H);
    ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill();
  }
}

function drawRipples(ctx, ripples) {
  for (const rp of ripples) {
    const u = rp.t / 0.55;
    ctx.strokeStyle = `rgba(180, 210, 220, ${0.22 * (1 - u)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.y, 10 + u * 16, 4 + u * 6, 0, 0, TAU);
    ctx.stroke();
  }
}

function drawShip(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(8, 28, 78, 12, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#2a3038';
  ctx.beginPath();
  ctx.moveTo(-78, 12);
  ctx.lineTo(88, 2);
  ctx.lineTo(72, 30);
  ctx.lineTo(-62, 34);
  ctx.closePath();
  ctx.fill();

  const hull = ctx.createLinearGradient(0, -28, 0, 28);
  hull.addColorStop(0, '#6a6458');
  hull.addColorStop(0.45, '#3a3428');
  hull.addColorStop(1, '#1c1812');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-72, 10);
  ctx.quadraticCurveTo(8, -42, 84, 6);
  ctx.lineTo(76, 20);
  ctx.lineTo(-64, 22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(90,80,60,0.62)';
  ctx.beginPath();
  ctx.moveTo(-48, -6);
  ctx.lineTo(70, -2);
  ctx.lineTo(66, 10);
  ctx.lineTo(-44, 8);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(40, 34, 28, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-30, -4); ctx.lineTo(-26, 8);
  ctx.moveTo(10, -6); ctx.lineTo(14, 8);
  ctx.moveTo(46, -4); ctx.lineTo(48, 8);
  ctx.stroke();

  const wink = 0.15 + Math.sin(t * 1.7) * 0.08;
  ctx.fillStyle = `rgba(255, 196, 90, ${wink})`;
  ctx.beginPath(); ctx.arc(-52, 8, 3.2, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawTurrets(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.ellipse(0, 18, 42, 8, 0, 0, TAU); ctx.fill();

  for (let i = 0; i < 3; i++) {
    const tx = -28 + i * 28;
    const sway = Math.sin(t * 0.8 + i) * 0.04;
    ctx.save();
    ctx.translate(tx, 0);
    ctx.rotate(sway);
    ctx.fillStyle = '#2a3038';
    ctx.beginPath();
    ctx.moveTo(-10, 16); ctx.lineTo(10, 16); ctx.lineTo(8, -4); ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();
    const metal = ctx.createLinearGradient(-4, -28, 4, 8);
    metal.addColorStop(0, '#9aa6b0');
    metal.addColorStop(1, '#3a4048');
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.moveTo(-3.2, -28); ctx.lineTo(3.2, -28); ctx.lineTo(4, 6); ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8b090';
    ctx.beginPath(); ctx.arc(0, 8, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#3a3428';
  ctx.beginPath();
  ctx.moveTo(36, 10); ctx.lineTo(52, 10); ctx.lineTo(50, 20); ctx.lineTo(34, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHatch(ctx, x, y, t, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 4, 40, 16, 0, 0, TAU); ctx.fill();

  ctx.fillStyle = '#0a0c10';
  ctx.beginPath(); ctx.ellipse(0, 0, 36, 16, 0, 0, TAU); ctx.fill();

  if (t < 1) {
    ctx.save();
    ctx.rotate(-t * 1.15);
    const lid = ctx.createRadialGradient(-6, -4, 2, 0, 0, 34);
    lid.addColorStop(0, '#6a5c4c');
    lid.addColorStop(1, '#2a241c');
    ctx.fillStyle = lid;
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a1610';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-16, -7); ctx.lineTo(16, 7); ctx.moveTo(16, -7); ctx.lineTo(-16, 7); ctx.stroke();
    const bolt = 1 - t;
    ctx.fillStyle = '#c8b090';
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 22, Math.sin(a) * 9, 3.1 * bolt, 2.2 * bolt, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  } else {
    const glow = 0.28 + Math.sin(time * 2.1) * 0.10;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    g.addColorStop(0, `rgba(180, 245, 255, ${0.55 + glow})`);
    g.addColorStop(0.4, `rgba(80, 210, 255, ${0.28 + glow * 0.4})`);
    g.addColorStop(1, 'rgba(80, 210, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.strokeStyle = 'rgba(180,240,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 13, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawSteam(ctx, steam) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of steam) {
    const u = 1 - p.life / (p.max || 1.2);
    ctx.fillStyle = `rgba(160, 230, 255, ${0.16 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + u * 8, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawBolts(ctx, bolts) {
  ctx.fillStyle = '#c8b090';
  for (const b of bolts) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawHallDoor(ctx, x, y, bitmaps) {
  const cell = bitmaps && bitmaps.door;
  if (cell && cell.img) {
    const s = 110;
    ctx.drawImage(cell.img, 0, 0, cell.fw, cell.fh, x - s / 2, y - s * 0.78, s, s);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#243038';
  ctx.beginPath();
  ctx.moveTo(-28, -10); ctx.lineTo(28, -10); ctx.lineTo(24, 10); ctx.lineTo(-24, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4dff91';
  ctx.beginPath();
  ctx.moveTo(-20, -2); ctx.lineTo(20, -2); ctx.lineTo(18, 4); ctx.lineTo(-18, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDrop(ctx, x, y, moving, t) {
  const r = HERO_R;
  const bob = moving ? Math.sin(t * 11) * 2.1 : 0;
  const sqx = moving ? 1.07 : 1;
  const sqy = moving ? 0.93 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, r * 1.08, r * 0.92, r * 0.28, 0, 0, TAU);
  ctx.fill();

  const half = heroHalfPoints(r, 14);
  ctx.beginPath();
  ctx.moveTo(half[0] * sqx, half[1] * sqy - bob);
  for (let i = 2; i < half.length; i += 2) ctx.lineTo(half[i] * sqx, half[i + 1] * sqy - bob);
  for (let i = half.length - 4; i >= 0; i -= 2) ctx.lineTo(-half[i] * sqx, half[i + 1] * sqy - bob);
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.28, -r * 0.42 - bob, r * 0.08, 0, -bob, r * 1.15);
  g.addColorStop(0, '#e3f8ff');
  g.addColorStop(0.32, HERO_COLORS.body);
  g.addColorStop(0.78, HERO_COLORS.bodyDeep);
  g.addColorStop(1, '#0c4a7a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = HERO_COLORS.outline;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.48 - bob, r * 0.16, r * 0.22, -0.5, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#0a1820';
  ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.16 - bob, r * 0.09, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.16 - bob, r * 0.09, 0, TAU); ctx.fill();
  ctx.restore();
}
