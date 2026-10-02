import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  TOWERS, LANES, buildWave, waveReward, towerStats, towerUpgradeCost, defenceBuff,
  goldForWavesHeld, sellRefund, wavePreview, bramHeroStats,
  pickFirst, applyCoolantDump, SPELLS,
} from '../game/basedefence';
import { defenceStart } from '../game/base';
import { COMPANIONS, isRescued } from '../game/companions';
import { heroHalfPoints, HERO_COLORS } from '../game/heroShape';
import { Audio } from '../game/audio';
import { fireClaimFx } from './ClaimFx';
import GameIcon from './GameIcon';

// Base Defence. Canvas 2d — a second Pixi app next to the hall is how the
// tab wedged. Hangar unmounts the hall before this opens. Superpolish of
// the EXISTING lane defence (Kingdom Rush bones), not the Slime-Castle
// merge rewrite (#38 still needs its own scoping pass).

const TAU = Math.PI * 2;
const COL = { grunt: '#7ad96b', runner: '#8affc8', brute: '#c58aff', swarm: '#ffb347' };

function statsFor(tw) {
  if (tw.hero) return bramHeroStats();
  return towerStats(TOWERS[tw.type], tw.lvl);
}

export default function BaseDefenceScreen({ save, setSave, onClose }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const selectedRef = useRef(null);
  const bankRef = useRef(null);
  const [ui, setUi] = useState({
    wave: 0, scrap: 0, coreHp: 100, running: false, over: false, held: 0, gold: 0,
    dumpCd: 0, ventCd: 0,
  });
  const [picked, setPicked] = useState('spitter');
  const [selected, setSelected] = useState(null);
  selectedRef.current = selected;

  const start = defenceStart(save);
  const { scrap: startScrap, coreMax, freeTowers } = start;
  const bramHome = isRescued(save, 'bram');

  const reset = useCallback(() => {
    const towers = [];
    for (let i = 0; i < freeTowers; i++) {
      towers.push({ type: 'spitter', lane: 1 + i, x: 0.42, xRel: true, lvl: 0, cd: 0 });
    }
    if (bramHome) {
      towers.push({ hero: true, type: 'bram', lane: 1, x: 0.16, xRel: true, lvl: 0, cd: 0 });
    }
    stateRef.current = {
      wave: 0, scrap: startScrap, coreHp: coreMax, coreMax,
      towers, foes: [], shots: [], fx: [], spawnQueue: [], spawnT: 0,
      blockers: [], spellCd: { dump: 0, vent: 0 },
      pendingDump: false, pendingVent: false,
      running: false, over: false, held: 0, goldEarned: 0, t: 0,
      banner: null, banked: null,
    };
    setUi({
      wave: 0, scrap: startScrap, coreHp: coreMax, running: false, over: false, held: 0, gold: 0,
      dumpCd: 0, ventCd: 0,
    });
    setSelected(null);
  }, [startScrap, coreMax, freeTowers, bramHome]);

  useEffect(() => { reset(); }, [reset]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const st = { sw: 0, sh: 0, dpr: 1 };
    let raf = 0, last = performance.now();

    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, r.width * dpr);
      cv.height = Math.max(1, r.height * dpr);
      st.sw = r.width; st.sh = r.height; st.dpr = dpr;
    };
    fit();
    window.addEventListener('resize', fit);

    const laneY = (i, H) => H * (0.18 + i * 0.21);

    const burst = (s, x, y, color) => {
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * TAU;
        s.fx.push({
          x, y, vx: Math.cos(a) * (40 + Math.random() * 80),
          vy: Math.sin(a) * (20 + Math.random() * 40) - 30,
          life: 0.35 + Math.random() * 0.2, color, r: 1.6 + Math.random() * 1.6,
        });
      }
    };

    const step = (dt, W, H) => {
      const s = stateRef.current;
      if (!s) return;
      if (s.banner) {
        s.banner.t -= dt;
        if (s.banner.t <= 0) s.banner = null;
      }
      if (s.over) return;
      s.t += dt;
      if (!s.spellCd) s.spellCd = { dump: 0, vent: 0 };
      if (!s.blockers) s.blockers = [];
      s.spellCd.dump = Math.max(0, (s.spellCd.dump || 0) - dt);
      s.spellCd.vent = Math.max(0, (s.spellCd.vent || 0) - dt);

      for (const tw of s.towers) {
        if (tw.xRel) { tw.x = W * tw.x; tw.xRel = false; }
      }

      if (s.pendingDump) {
        s.pendingDump = false;
        if (s.spellCd.dump <= 0) {
          applyCoolantDump(s.foes);
          s.spellCd.dump = SPELLS.dump.cd;
          for (const f of s.foes) burst(s, f.x, laneY(f.lane, H), '#8fe6ff');
          s.banner = { text: 'COOLANT DUMP', t: 0.7 };
          if (Audio.campSteam) Audio.campSteam();
        }
      }
      if (s.pendingVent) {
        s.pendingVent = false;
        if (s.spellCd.vent <= 0) {
          let lane = 1;
          let nearest = Infinity;
          for (const f of s.foes) {
            if (f.x < nearest) { nearest = f.x; lane = f.lane; }
          }
          s.blockers.push(
            { lane, x: W * 0.22, hp: SPELLS.vent.hp, maxHp: SPELLS.vent.hp, life: SPELLS.vent.life },
            { lane, x: W * 0.28, hp: SPELLS.vent.hp, maxHp: SPELLS.vent.hp, life: SPELLS.vent.life },
          );
          s.spellCd.vent = SPELLS.vent.cd;
          s.banner = { text: 'VENT BLOCK', sub: `lane ${lane + 1}`, t: 0.7 };
          if (Audio.stationBuild) Audio.stationBuild();
        }
      }

      if (s.running && s.spawnQueue.length) {
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = 0.42;
          const f = s.spawnQueue.shift();
          s.foes.push({ ...f, lane: (Math.random() * LANES) | 0, x: W + 20, slow: 0 });
        }
      }
      if (s.running && !s.spawnQueue.length && !s.foes.length) {
        s.running = false;
        s.held = s.wave;
        const r = waveReward(s.wave);
        s.scrap += r.scrap;
        s.goldEarned += r.gold;
        s.banner = { text: `WAVE ${s.wave} HELD`, sub: `+${r.scrap} scrap`, t: 1.35 };
        if (Audio.stationBuild) Audio.stationBuild();
        else if (Audio.claimPing) Audio.claimPing();
      }

      for (let i = (s.blockers || []).length - 1; i >= 0; i--) {
        const b = s.blockers[i];
        b.life -= dt;
        if (b.hp <= 0 || b.life <= 0) {
          burst(s, b.x, laneY(b.lane, H), '#c4a574');
          s.blockers.splice(i, 1);
        }
      }

      for (let i = s.foes.length - 1; i >= 0; i--) {
        const f = s.foes[i];
        f.slow = Math.max(0, f.slow - dt);
        const spd = f.speed * (f.slow > 0 ? 0.45 : 1);
        let blocked = null;
        for (const b of s.blockers || []) {
          if (b.lane === f.lane && f.x <= b.x + 14 && f.x >= b.x - 20) blocked = b;
        }
        if (blocked) {
          f.x = Math.max(f.x, blocked.x + 12);
          blocked.hp -= (f.kind === 'brute' ? 22 : f.kind === 'swarm' ? 6 : 10) * dt;
        } else {
          f.x -= spd * dt;
        }
        if (f.x <= W * 0.10) {
          s.coreHp -= f.kind === 'brute' ? 12 : f.kind === 'swarm' ? 2 : 5;
          burst(s, W * 0.10, laneY(f.lane, H), '#ff5566');
          s.foes.splice(i, 1);
          if (s.coreHp <= 0) {
            s.coreHp = 0;
            s.over = true;
            s.running = false;
            s.banked = {
              held: s.held,
              gold: s.goldEarned || goldForWavesHeld(s.held),
              parts: Math.floor(s.held / 2),
              buff: defenceBuff(s.held),
            };
            if (!bankRef.current || bankRef.current.held <= s.banked.held) bankRef.current = s.banked;
            s.banner = { text: 'THE CORE IS DOWN', t: 2 };
            if (Audio.skillDenied) Audio.skillDenied();
          }
        }
      }

      for (const tw of s.towers) {
        const stt = statsFor(tw);
        tw.cd -= dt;
        if (tw.cd > 0) continue;
        const ty = laneY(tw.lane, H), tx = tw.x;
        const best = pickFirst(s.foes, tx, ty, stt.range, (lane) => laneY(lane, H));
        if (!best) continue;
        tw.cd = 1 / stt.rate;
        tw.flash = 0.12;
        const color = tw.hero ? COMPANIONS.bram.color : TOWERS[tw.type].accent;
        s.shots.push({ x: tx, y: ty, tx: best.x, ty: laneY(best.lane, H), t: 0.12, color });
        const hit = (f, mult = 1) => {
          f.hp -= stt.dmg * mult;
          if (stt.slow) f.slow = 1.2;
        };
        hit(best);
        if (stt.splash) {
          for (const f of s.foes) {
            if (f === best) continue;
            const fy = laneY(f.lane, H);
            if ((f.x - best.x) ** 2 + (fy - laneY(best.lane, H)) ** 2 < stt.splash * stt.splash) hit(f, 0.6);
          }
        }
        if (stt.chain) {
          let jumps = stt.chain, from = best;
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

      for (const tw of s.towers) {
        if (tw.flash) tw.flash = Math.max(0, tw.flash - dt);
      }

      for (let i = s.foes.length - 1; i >= 0; i--) {
        if (s.foes[i].hp <= 0) {
          const f = s.foes[i];
          s.scrap += f.reward;
          burst(s, f.x, laneY(f.lane, H), COL[f.kind]);
          s.foes.splice(i, 1);
        }
      }
      for (let i = s.shots.length - 1; i >= 0; i--) {
        s.shots[i].t -= dt;
        if (s.shots[i].t <= 0) s.shots.splice(i, 1);
      }
      for (let i = s.fx.length - 1; i >= 0; i--) {
        const p = s.fx[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.life -= dt;
        if (p.life <= 0) s.fx.splice(i, 1);
      }
      if (s.fx.length > 90) s.fx.splice(0, s.fx.length - 90);
    };

    const draw = (W, H) => {
      const s = stateRef.current;
      if (!s) return;
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1420'); g.addColorStop(1, '#05080e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < LANES; i++) {
        const y = laneY(i, H);
        const strip = ctx.createLinearGradient(W * 0.10, y - 18, W, y + 18);
        strip.addColorStop(0, 'rgba(18, 28, 36, 0.95)');
        strip.addColorStop(0.5, 'rgba(10, 16, 22, 0.7)');
        strip.addColorStop(1, 'rgba(8, 12, 16, 0.4)');
        ctx.fillStyle = strip;
        ctx.fillRect(W * 0.10, y - 18, W * 0.90, 36);
        ctx.strokeStyle = 'rgba(95, 214, 255, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W * 0.10, y - 18); ctx.lineTo(W, y - 18); ctx.stroke();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath(); ctx.moveTo(W * 0.10, y + 18); ctx.lineTo(W, y + 18); ctx.stroke();
      }

      drawCore(ctx, W, H, s.coreHp / s.coreMax, s.t);

      const sel = selectedRef.current;
      for (const tw of s.towers) {
        const y = laneY(tw.lane, H);
        if (tw.hero) drawBram(ctx, tw.x, y, s.t);
        else drawTower(ctx, tw, y, sel === tw);
      }
      for (const b of s.blockers || []) {
        drawVent(ctx, b, laneY(b.lane, H));
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sh of s.shots) {
        ctx.strokeStyle = sh.color; ctx.lineWidth = 2.2; ctx.globalAlpha = sh.t / 0.12;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.tx, sh.ty); ctx.stroke();
      }
      ctx.restore();

      for (const f of s.foes) {
        const y = laneY(f.lane, H);
        drawFoe(ctx, f, y);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of s.fx) {
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
      ctx.restore();

      if (s.banner && s.banner.t > 0) {
        const a = Math.min(1, s.banner.t);
        ctx.fillStyle = `rgba(4, 8, 12, ${0.45 * a})`;
        ctx.fillRect(0, H * 0.38, W, H * 0.22);
        ctx.fillStyle = `rgba(255, 210, 160, ${a})`;
        ctx.font = '700 22px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.banner.text, W / 2, H * 0.50);
        if (s.banner.sub) {
          ctx.fillStyle = `rgba(255, 209, 102, ${a})`;
          ctx.font = '16px VT323, monospace';
          ctx.fillText(s.banner.sub, W / 2, H * 0.56);
        }
      }
    };

    let uiT = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (cv.clientWidth !== st.sw || cv.clientHeight !== st.sh) fit();
      const W = st.sw, H = st.sh;
      const wasOver = stateRef.current && stateRef.current.over;
      step(dt, W, H);
      draw(W, H);
      const s = stateRef.current;
      uiT -= dt;
      if (s && (uiT <= 0 || s.over !== wasOver)) {
        uiT = 0.125;
        setUi({
          wave: s.wave, scrap: Math.floor(s.scrap), coreHp: Math.ceil(s.coreHp),
          running: s.running, over: s.over, held: s.held, gold: s.goldEarned | 0,
          dumpCd: s.spellCd ? s.spellCd.dump : 0,
          ventCd: s.spellCd ? s.spellCd.vent : 0,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, []);

  const placeAt = (e) => {
    const s = stateRef.current;
    if (!s || s.over) return;
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const lane = Math.round((y / r.height - 0.18) / 0.21);
    if (lane < 0 || lane >= LANES) return;
    if (x < r.width * 0.14) return;

    const hit = s.towers.find(t => t.lane === lane && Math.abs(t.x - x) < 26);
    if (hit) { setSelected(sel => (sel === hit ? null : hit)); return; }

    const def = TOWERS[picked];
    if (s.scrap < def.cost) {
      if (Audio.skillDenied) Audio.skillDenied();
      return;
    }
    s.scrap -= def.cost;
    s.towers.push({ type: picked, lane, x, lvl: 0, cd: 0 });
    if (Audio.stationBuild) Audio.stationBuild();
    else Audio.click();
  };

  const startWave = () => {
    const s = stateRef.current;
    if (!s || s.running || s.over) return;
    s.wave += 1;
    s.spawnQueue = buildWave(s.wave);
    s.running = true;
    s.banner = { text: `WAVE ${s.wave}`, t: 0.9 };
    if (Audio.campSteam) Audio.campSteam();
    if (Audio.claimPing) Audio.claimPing();
  };

  const upgradeSelected = () => {
    const s = stateRef.current;
    if (!s || !selected || selected.hero) return;
    const cost = towerUpgradeCost(TOWERS[selected.type], selected.lvl);
    if (s.scrap < cost) {
      if (Audio.skillDenied) Audio.skillDenied();
      return;
    }
    s.scrap -= cost;
    selected.lvl += 1;
    if (Audio.claimPing) Audio.claimPing();
  };

  const dumpCoolant = () => {
    const s = stateRef.current;
    if (!s || s.over || ((s.spellCd && s.spellCd.dump) || 0) > 0) {
      if (Audio.skillDenied) Audio.skillDenied();
      return;
    }
    s.pendingDump = true;
  };

  const ventBlock = () => {
    const s = stateRef.current;
    if (!s || s.over || ((s.spellCd && s.spellCd.vent) || 0) > 0) {
      if (Audio.skillDenied) Audio.skillDenied();
      return;
    }
    s.pendingVent = true;
  };

  const sellSelected = () => {
    const s = stateRef.current;
    if (!s || !selected || selected.hero) return;
    const refund = sellRefund(TOWERS[selected.type], selected.lvl);
    s.scrap += refund;
    s.towers = s.towers.filter(t => t !== selected);
    setSelected(null);
    if (Audio.campSparks) Audio.campSparks();
  };

  const finish = (e) => {
    const s = stateRef.current;
    const current = s && s.held > 0 ? {
      held: s.held,
      gold: s.goldEarned || goldForWavesHeld(s.held),
      parts: Math.floor(s.held / 2),
      buff: defenceBuff(s.held),
    } : null;
    const bank = [bankRef.current, s && s.banked, current]
      .filter(Boolean)
      .sort((a, b) => b.held - a.held)[0];
    if (bank && bank.held > 0) {
      const prev = save.defenceBuff;
      const keep = prev && prev.waves >= bank.held ? prev : bank.buff;
      setSave({
        ...save,
        gold: (save.gold || 0) + bank.gold,
        gearParts: (save.gearParts || 0) + bank.parts,
        defenceBest: Math.max(save.defenceBest || 0, bank.held),
        defenceBuff: keep || null,
      });
      if (e && e.currentTarget) {
        fireClaimFx(e.currentTarget, { gold: bank.gold, gearParts: bank.parts });
      }
      if (Audio.rewardFanfare) Audio.rewardFanfare();
    }
    onClose();
  };

  const selCost = selected && !selected.hero ? towerUpgradeCost(TOWERS[selected.type], selected.lvl) : 0;
  const selSell = selected && !selected.hero ? sellRefund(TOWERS[selected.type], selected.lvl) : 0;
  const preview = wavePreview(ui.wave + 1);
  const previewBits = Object.entries(preview).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(' · ');

  return (
    <div className="modal-overlay" data-testid="base-defence">
      <div className="bd-panel">
        <div className="bd-head">
          <div className="bd-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GameIcon name="ui_shield" size={16} /> BASE DEFENCE</div>
          <span className="bd-stat">WAVE <b>{ui.wave}</b></span>
          <span className="bd-stat">CORE <b className={ui.coreHp < coreMax * 0.4 ? 'crit' : ''}>{ui.coreHp}</b></span>
          <span className="bd-stat" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="ui_cog" size={13} /> <b>{ui.scrap}</b></span>
          {ui.gold > 0 && <span className="bd-stat">BANK <b>{ui.gold}</b></span>}
          <button className="prosp-close" onClick={finish}>✕</button>
        </div>
        {bramHome && (
          <div className="npc-host-line" style={{ '--nc': COMPANIONS.bram.color }}>
            "{COMPANIONS.bram.homeLine}" <i>— Bram</i>
          </div>
        )}

        <canvas ref={canvasRef} className="bd-canvas" onClick={placeAt} data-testid="bd-canvas" />

        {ui.over && (
          <div className="bd-over">
            <div className="bd-over-title">THE CORE IS DOWN</div>
            <div className="bd-over-sub">
              {defenceBuff(ui.held)
                ? `Held ${ui.held} waves — ${defenceBuff(ui.held).label} on your next run.`
                : 'Held nothing worth carrying home.'}
              {ui.gold > 0 ? ` Bank ${ui.gold} gold.` : ''}
            </div>
            <div className="bd-over-actions">
              <button className="prosp-btn go" onClick={reset}>↻ AGAIN</button>
              <button className="prosp-btn bank" onClick={finish} data-testid="bd-take">✓ TAKE THE BUFF</button>
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
              <span className="bd-tower-cost" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon name="ui_cog" size={12} /> {t.cost}</span>
              <span className="bd-tower-desc">{t.desc}</span>
            </button>
          ))}
        </div>

        <div className="bd-spells">
          <button
            className="bd-spell"
            disabled={ui.over || ui.dumpCd > 0}
            onClick={dumpCoolant}
            data-testid="bd-dump"
          >
            DUMP COOLANT
            <i>{ui.dumpCd > 0 ? `${Math.ceil(ui.dumpCd)}s` : 'READY'}</i>
          </button>
          <button
            className="bd-spell"
            disabled={ui.over || ui.ventCd > 0}
            onClick={ventBlock}
            data-testid="bd-vent"
          >
            VENT BLOCK
            <i>{ui.ventCd > 0 ? `${Math.ceil(ui.ventCd)}s` : 'READY'}</i>
          </button>
        </div>

        <div className="bd-actions">
          {selected ? (
            <>
              <span className="bd-sel">
                {selected.hero ? 'BRAM · the wall' : `${TOWERS[selected.type].name} · Lv ${selected.lvl + 1}`}
              </span>
              {!selected.hero && (
                <>
                  <button className="prosp-btn" disabled={ui.scrap < selCost} onClick={upgradeSelected} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>▲ UPGRADE (<GameIcon name="ui_cog" size={12} /> {selCost})</button>
                  <button className="prosp-btn ghost" onClick={sellSelected}>SELL +{selSell}</button>
                </>
              )}
              <button className="prosp-btn ghost" onClick={() => setSelected(null)}>Deselect</button>
            </>
          ) : (
            <button className="prosp-btn dig" disabled={ui.running || ui.over} onClick={startWave} data-testid="bd-start">
              {ui.running ? 'WAVE INCOMING…' : `▶ SEND WAVE ${ui.wave + 1}`}
              {!ui.running && !ui.over && previewBits ? <i className="bd-preview">{previewBits}</i> : null}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function drawCore(ctx, W, H, chp, t) {
  const w = W * 0.10;
  ctx.fillStyle = '#071018';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, 8); ctx.lineTo(w, H - 8); ctx.lineTo(0, H);
  ctx.closePath(); ctx.fill();
  const fillH = H * chp;
  const cool = ctx.createLinearGradient(0, H - fillH, w, H);
  cool.addColorStop(0, chp > 0.4 ? 'rgba(77,255,212,0.55)' : 'rgba(255,85,102,0.55)');
  cool.addColorStop(1, chp > 0.4 ? 'rgba(20,80,90,0.9)' : 'rgba(80,10,20,0.9)');
  ctx.fillStyle = cool;
  ctx.beginPath();
  ctx.moveTo(2, H - fillH); ctx.lineTo(w - 4, H - fillH + 4); ctx.lineTo(w - 4, H - 4); ctx.lineTo(2, H);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w, 8); ctx.lineTo(w, H - 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(180, 200, 210, 0.35)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.arc(w - 6, 18 + i * ((H - 36) / 4), 2.2, 0, TAU); ctx.fill();
  }
  const pulse = 0.15 + Math.sin(t * 2) * 0.06;
  ctx.fillStyle = `rgba(95, 214, 255, ${pulse})`;
  ctx.beginPath(); ctx.arc(w * 0.45, H * 0.5, 7, 0, TAU); ctx.fill();
}

function drawTower(ctx, tw, y, lit) {
  const def = TOWERS[tw.type];
  const x = tw.x;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(x, y + 13, 17, 5, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(x - 12, y - 16, x + 12, y + 12);
  g.addColorStop(0, '#5a6a78');
  g.addColorStop(0.4, '#1c2630');
  g.addColorStop(1, '#070b10');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 9);
  ctx.lineTo(x - 8, y - 5);
  ctx.lineTo(x + 8, y - 5);
  ctx.lineTo(x + 12, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = def.accent;
  ctx.lineWidth = tw.flash ? 2.8 : 1.4;
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y - 3);
  ctx.fillStyle = def.accent;
  ctx.strokeStyle = def.accent;
  if (tw.type === 'mortar') {
    ctx.beginPath(); ctx.arc(0, -7, 6 + tw.lvl * 0.5, 0, TAU); ctx.fill();
    ctx.fillRect(-3.5, -5, 7, 11);
    ctx.fillStyle = '#1a1010';
    ctx.beginPath(); ctx.arc(0, -8, 2.4, 0, TAU); ctx.fill();
  } else if (tw.type === 'frost') {
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 3.5 + tw.lvl, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(0, 9);
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
    ctx.stroke();
  } else if (tw.type === 'tesla') {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-7, 5); ctx.lineTo(-2, -11); ctx.lineTo(1, 1); ctx.lineTo(7, -12);
    ctx.stroke();
    ctx.globalAlpha = tw.flash ? 1 : 0.7;
    ctx.beginPath(); ctx.arc(0, -4, 2.2 + tw.lvl * 0.4, 0, TAU); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-5, 5); ctx.lineTo(11 + tw.lvl, 0); ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e9f4ff';
    ctx.beginPath(); ctx.arc(8 + tw.lvl, 0, 1.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (lit) {
    const stt = towerStats(def, tw.lvl);
    ctx.strokeStyle = def.accent + '55'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, stt.range, 0, TAU); ctx.stroke();
  }
}

function drawVent(ctx, b, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(b.x, y + 10, 11, 4, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(b.x - 8, y - 10, b.x + 8, y + 8);
  g.addColorStop(0, '#d8c09a');
  g.addColorStop(0.5, '#6a4a32');
  g.addColorStop(1, '#1a100c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(b.x - 8, y + 7);
  ctx.lineTo(b.x - 6, y - 8);
  ctx.lineTo(b.x + 6, y - 8);
  ctx.lineTo(b.x + 8, y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.fillRect(b.x - 8, y - 14, 16, 3);
  ctx.fillStyle = '#ff5566';
  ctx.fillRect(b.x - 8, y - 14, 16 * Math.max(0, b.hp / b.maxHp), 3);
}

function drawBram(ctx, x, y, t) {
  const r = 13;
  const bob = Math.sin(t * 3) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.28, 0, 0, TAU); ctx.fill();
  const half = heroHalfPoints(r, 10);
  ctx.beginPath();
  ctx.moveTo(x + half[0], y + half[1] - bob);
  for (let i = 2; i < half.length; i += 2) ctx.lineTo(x + half[i], y + half[i + 1] - bob);
  for (let i = half.length - 4; i >= 0; i -= 2) ctx.lineTo(x - half[i], y + half[i + 1] - bob);
  ctx.closePath();
  const g = ctx.createRadialGradient(x - 4, y - 8 - bob, 2, x, y - bob, r * 1.1);
  g.addColorStop(0, '#d8f6ff');
  g.addColorStop(0.45, COMPANIONS.bram.color);
  g.addColorStop(1, COMPANIONS.bram.colorDeep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = HERO_COLORS.outline;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawFoe(ctx, f, y) {
  const r = f.kind === 'brute' ? 15 : f.kind === 'swarm' ? 6 : f.kind === 'runner' ? 8 : 10;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(f.x, y + r * 0.7, r, r * 0.32, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(f.x - r * 0.3, y - r * 0.4, r * 0.1, f.x, y, r);
  const c = f.slow > 0 ? '#bfe8ff' : COL[f.kind];
  g.addColorStop(0, '#fff');
  g.addColorStop(0.25, c);
  g.addColorStop(1, '#1a1020');
  ctx.fillStyle = g;
  ctx.beginPath();
  if (f.kind === 'brute') {
    ctx.moveTo(f.x, y - r); ctx.lineTo(f.x + r, y + r * 0.6); ctx.lineTo(f.x - r, y + r * 0.6);
    ctx.closePath();
  } else if (f.kind === 'runner') {
    ctx.ellipse(f.x, y, r * 1.35, r * 0.7, 0, 0, TAU);
  } else {
    ctx.arc(f.x, y, r, 0, TAU);
  }
  ctx.fill();
  if (f.hp < f.maxHp) {
    ctx.fillStyle = '#000'; ctx.fillRect(f.x - r, y - r - 7, r * 2, 3);
    ctx.fillStyle = '#ff5566'; ctx.fillRect(f.x - r, y - r - 7, r * 2 * (f.hp / f.maxHp), 3);
  }
}
