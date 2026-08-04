import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  TOWERS, LANES, buildWave, waveReward, towerStats, towerUpgradeCost, defenceBuff,
} from '../game/basedefence';
import { defenceStart } from '../game/base';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

// Base Defence. Canvas-drawn because it is a real-time sim with dozens of
// moving things — the same reason the main game is not DOM. Kept in one
// component since none of it is reusable elsewhere.
export default function BaseDefenceScreen({ save, setSave, onClose }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [ui, setUi] = useState({ wave: 0, scrap: 0, coreHp: 100, running: false, over: false, held: 0 });
  const [picked, setPicked] = useState('spitter');
  const [selected, setSelected] = useState(null);

  // The Rampart feeds the defence: a levelled base literally starts the fight
  // better resourced, which is what ties the two systems together.
  const start = defenceStart(save);
  const { scrap: startScrap, coreMax, freeTowers } = start;

  const reset = useCallback(() => {
    // Free towers from the Rampart stand in the middle lanes at the choke,
    // which is where a player would put their first two anyway.
    const towers = [];
    for (let i = 0; i < freeTowers; i++) {
      towers.push({ type: 'spitter', lane: 1 + i, x: 0.42, xRel: true, lvl: 0, cd: 0 });
    }
    stateRef.current = {
      wave: 0, scrap: startScrap, coreHp: coreMax, coreMax,
      towers, foes: [], shots: [], spawnQueue: [], spawnT: 0,
      running: false, over: false, held: 0, t: 0,
    };
    setUi({ wave: 0, scrap: startScrap, coreHp: coreMax, running: false, over: false, held: 0 });
    // `selected` holds a reference INTO the old tower array — keeping it
    // would leave the upgrade button spending scrap on a tower that is no
    // longer on the field.
    setSelected(null);
  }, [startScrap, coreMax, freeTowers]);

  useEffect(() => { reset(); }, [reset]);

  // --- main loop ---
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    let raf = 0, last = performance.now();

    const laneY = (i, H) => H * (0.18 + i * 0.21);

    const step = (dt, W, H) => {
      const s = stateRef.current;
      if (!s || s.over) return;
      s.t += dt;

      // Free towers are placed before the canvas has been measured, so their
      // x is a 0..1 fraction until the first frame resolves it.
      for (const tw of s.towers) {
        if (tw.xRel) { tw.x = W * tw.x; tw.xRel = false; }
      }

      // spawn
      if (s.running && s.spawnQueue.length) {
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = 0.42;
          const f = s.spawnQueue.shift();
          s.foes.push({ ...f, lane: (Math.random() * LANES) | 0, x: W + 20, slow: 0 });
        }
      }
      if (s.running && !s.spawnQueue.length && !s.foes.length) {
        // wave cleared
        s.running = false;
        s.held = s.wave;
        const r = waveReward(s.wave);
        s.scrap += r.scrap;
      }

      // foes walk left toward the core
      for (let i = s.foes.length - 1; i >= 0; i--) {
        const f = s.foes[i];
        f.slow = Math.max(0, f.slow - dt);
        const spd = f.speed * (f.slow > 0 ? 0.45 : 1);
        f.x -= spd * dt;
        if (f.x <= W * 0.10) {
          s.coreHp -= f.kind === 'brute' ? 12 : f.kind === 'swarm' ? 2 : 5;
          s.foes.splice(i, 1);
          if (s.coreHp <= 0) { s.coreHp = 0; s.over = true; s.running = false; }
        }
      }

      // towers fire
      for (const tw of s.towers) {
        const st = towerStats(TOWERS[tw.type], tw.lvl);
        tw.cd -= dt;
        if (tw.cd > 0) continue;
        const ty = laneY(tw.lane, H), tx = tw.x;
        let best = null, bd = st.range * st.range;
        for (const f of s.foes) {
          const fy = laneY(f.lane, H);
          const d = (f.x - tx) ** 2 + (fy - ty) ** 2;
          if (d < bd) { bd = d; best = f; }
        }
        if (!best) continue;
        tw.cd = 1 / st.rate;
        s.shots.push({ x: tx, y: ty, tx: best.x, ty: laneY(best.lane, H), t: 0.12, color: TOWERS[tw.type].accent });
        const hit = (f, mult = 1) => {
          f.hp -= st.dmg * mult;
          if (st.slow) f.slow = 1.2;
        };
        hit(best);
        if (st.splash) {
          for (const f of s.foes) {
            if (f === best) continue;
            const fy = laneY(f.lane, H);
            if ((f.x - best.x) ** 2 + (fy - laneY(best.lane, H)) ** 2 < st.splash * st.splash) hit(f, 0.6);
          }
        }
        if (st.chain) {
          let jumps = st.chain, from = best;
          const done = new Set([best]);
          while (jumps-- > 0) {
            let next = null, nd = 120 * 120;
            for (const f of s.foes) {
              if (done.has(f)) continue;
              const fy = laneY(f.lane, H);
              const d = (f.x - from.x) ** 2 + (fy - laneY(from.lane, H)) ** 2;
              if (d < nd) { nd = d; next = f; }
            }
            if (!next) break;
            done.add(next); hit(next, 0.7);
            s.shots.push({ x: from.x, y: laneY(from.lane, H), tx: next.x, ty: laneY(next.lane, H), t: 0.1, color: '#fff44d' });
            from = next;
          }
        }
      }

      // deaths
      for (let i = s.foes.length - 1; i >= 0; i--) {
        if (s.foes[i].hp <= 0) { s.scrap += s.foes[i].reward; s.foes.splice(i, 1); }
      }
      for (let i = s.shots.length - 1; i >= 0; i--) {
        s.shots[i].t -= dt;
        if (s.shots[i].t <= 0) s.shots.splice(i, 1);
      }
    };

    const draw = (W, H) => {
      const s = stateRef.current;
      if (!s) return;
      ctx.clearRect(0, 0, W, H);
      // ground
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1420'); g.addColorStop(1, '#05080e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // lanes
      for (let i = 0; i < LANES; i++) {
        const y = laneY(i, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 34;
        ctx.beginPath(); ctx.moveTo(W * 0.10, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // core
      const chp = s.coreHp / s.coreMax;
      ctx.fillStyle = '#0d2a3a';
      ctx.fillRect(0, 0, W * 0.10, H);
      ctx.fillStyle = chp > 0.4 ? '#4dffd4' : '#ff5566';
      ctx.fillRect(0, H * (1 - chp), W * 0.10, H * chp);
      ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, W * 0.10, H);

      // towers
      for (const tw of s.towers) {
        const def = TOWERS[tw.type];
        const y = laneY(tw.lane, H);
        ctx.fillStyle = '#16222e';
        ctx.beginPath(); ctx.arc(tw.x, y, 15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = def.accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = def.accent;
        ctx.beginPath(); ctx.arc(tw.x, y, 5 + tw.lvl, 0, Math.PI * 2); ctx.fill();
        if (selected === tw) {
          const st = towerStats(def, tw.lvl);
          ctx.strokeStyle = `${def.accent}55`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(tw.x, y, st.range, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // shots
      for (const sh of s.shots) {
        ctx.strokeStyle = sh.color; ctx.lineWidth = 2; ctx.globalAlpha = sh.t / 0.12;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.tx, sh.ty); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // foes
      const COL = { grunt: '#7ad96b', runner: '#8affc8', brute: '#c58aff', swarm: '#ffb347' };
      for (const f of s.foes) {
        const y = laneY(f.lane, H);
        const r = f.kind === 'brute' ? 15 : f.kind === 'swarm' ? 6 : 10;
        ctx.fillStyle = f.slow > 0 ? '#bfe8ff' : COL[f.kind];
        ctx.beginPath(); ctx.arc(f.x, y, r, 0, Math.PI * 2); ctx.fill();
        if (f.hp < f.maxHp) {
          ctx.fillStyle = '#000'; ctx.fillRect(f.x - r, y - r - 7, r * 2, 3);
          ctx.fillStyle = '#ff5566'; ctx.fillRect(f.x - r, y - r - 7, r * 2 * (f.hp / f.maxHp), 3);
        }
      }
    };

    // The header is React, the field is canvas. Pushing state every frame
    // would re-render the whole panel at 60fps for numbers nobody can read
    // that fast, so the readout ticks eight times a second instead — except
    // for `over`, which must land the same frame it happens.
    let uiT = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const W = cv.width = cv.clientWidth;
      const H = cv.height = cv.clientHeight;
      const wasOver = stateRef.current && stateRef.current.over;
      step(dt, W, H);
      draw(W, H);
      const s = stateRef.current;
      uiT -= dt;
      if (s && (uiT <= 0 || s.over !== wasOver)) {
        uiT = 0.125;
        setUi({ wave: s.wave, scrap: Math.floor(s.scrap), coreHp: Math.ceil(s.coreHp), running: s.running, over: s.over, held: s.held });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  const placeAt = (e) => {
    const s = stateRef.current;
    if (!s || s.over) return;
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const lane = Math.round((y / r.height - 0.18) / 0.21);
    if (lane < 0 || lane >= LANES) return;
    if (x < r.width * 0.14) return;

    // Tapping an existing tower selects it (for upgrade/sell) rather than
    // stacking a second one on top.
    const hit = s.towers.find(t => t.lane === lane && Math.abs(t.x - x) < 26);
    if (hit) { setSelected(sel => (sel === hit ? null : hit)); return; }

    const def = TOWERS[picked];
    if (s.scrap < def.cost) return;
    s.scrap -= def.cost;
    s.towers.push({ type: picked, lane, x, lvl: 0, cd: 0 });
    Audio.click();
  };

  const startWave = () => {
    const s = stateRef.current;
    if (!s || s.running || s.over) return;
    s.wave += 1;
    s.spawnQueue = buildWave(s.wave);
    s.running = true;
    Audio.claimPing();
  };

  const upgradeSelected = () => {
    const s = stateRef.current;
    if (!s || !selected) return;
    const cost = towerUpgradeCost(TOWERS[selected.type], selected.lvl);
    if (s.scrap < cost) return;
    s.scrap -= cost;
    selected.lvl += 1;
    Audio.claimPing();
  };

  const finish = () => {
    const s = stateRef.current;
    const held = s ? s.held : 0;
    const buff = defenceBuff(held);
    if (held > 0) {
      const r = waveReward(held);
      // The better of the two buffs is kept: coming back and holding fewer
      // waves should never downgrade a buff you have not spent yet.
      const prev = save.defenceBuff;
      const keep = prev && prev.waves >= held ? prev : buff;
      setSave({
        ...save,
        gold: (save.gold || 0) + r.gold,
        gearParts: (save.gearParts || 0) + Math.floor(held / 2),
        defenceBest: Math.max(save.defenceBest || 0, held),
        defenceBuff: keep || null,
      });
    }
    onClose();
  };

  const selCost = selected ? towerUpgradeCost(TOWERS[selected.type], selected.lvl) : 0;

  return (
    <div className="modal-overlay" data-testid="base-defence">
      <div className="bd-panel">
        <div className="bd-head">
          <div className="bd-title">🛡 BASE DEFENCE</div>
          <span className="bd-stat">WAVE <b>{ui.wave}</b></span>
          <span className="bd-stat">CORE <b className={ui.coreHp < coreMax * 0.4 ? 'crit' : ''}>{ui.coreHp}</b></span>
          <span className="bd-stat">⚙ <b>{ui.scrap}</b></span>
          <button className="prosp-close" onClick={finish}>✕</button>
        </div>

        <canvas ref={canvasRef} className="bd-canvas" onClick={placeAt} data-testid="bd-canvas" />

        {ui.over && (
          <div className="bd-over">
            <div className="bd-over-title">THE CORE IS DOWN</div>
            <div className="bd-over-sub">
              {defenceBuff(ui.held)
                ? `Held ${ui.held} waves — ${defenceBuff(ui.held).label} on your next run.`
                : 'Held nothing worth carrying home.'}
            </div>
            <div className="bd-over-actions">
              <button className="prosp-btn go" onClick={reset}>↻ AGAIN</button>
              <button className="prosp-btn bank" onClick={finish}>✓ TAKE THE BUFF</button>
            </div>
          </div>
        )}

        <div className="bd-bar">
          {Object.values(TOWERS).map(t => (
            <button key={t.id} className={`bd-tower${picked === t.id ? ' on' : ''}`}
                    style={{ '--tc': t.accent }} onClick={() => { setPicked(t.id); setSelected(null); }}
                    data-testid={`bd-tower-${t.id}`}>
              <GameIcon name={t.icon} tone={t.accent} size={24} />
              <span className="bd-tower-name">{t.name}</span>
              <span className="bd-tower-cost">⚙ {t.cost}</span>
              <span className="bd-tower-desc">{t.desc}</span>
            </button>
          ))}
        </div>

        <div className="bd-actions">
          {selected ? (
            <>
              <span className="bd-sel">{TOWERS[selected.type].name} · Lv {selected.lvl + 1}</span>
              <button className="prosp-btn" disabled={ui.scrap < selCost} onClick={upgradeSelected}>▲ UPGRADE (⚙ {selCost})</button>
              <button className="prosp-btn ghost" onClick={() => setSelected(null)}>Deselect</button>
            </>
          ) : (
            <button className="prosp-btn dig" disabled={ui.running || ui.over} onClick={startWave} data-testid="bd-start">
              {ui.running ? 'WAVE INCOMING…' : `▶ SEND WAVE ${ui.wave + 1}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
