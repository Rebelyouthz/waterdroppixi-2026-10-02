import React, { useState, useEffect, useRef } from 'react';
import {
  CLICKER_BUILDINGS, buildingCost, clickUpgradeCost,
  dropsPerSec, dropsPerClick, pendingMilestones, nextMilestone,
  CLICKER_MILESTONES, fmtDrops,
} from '../game/clicker';
import { rollRune } from '../game/runes';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

export default function ClickerScreen({ save, setSave, onClose }) {
  const cl = save.clicker || { drops: 0, total: 0, buildings: {}, clickLvl: 0, claimed: {} };
  const rate = dropsPerSec(cl);
  const perClick = dropsPerClick(cl);
  const pending = pendingMilestones(cl);
  const next = nextMilestone(cl);

  // Splash droplets thrown by a tap. Kept in local state and capped, since
  // this is pure feedback and has no business being persisted.
  const [splashes, setSplashes] = useState([]);
  const splashId = useRef(0);

  // While the screen is open, credit production continuously rather than
  // waiting for the 10s global idle tick — a counter that jumps in visible
  // steps reads as broken.
  useEffect(() => {
    if (rate <= 0) return undefined;
    const t = setInterval(() => {
      setSave(cur => {
        const c = cur.clicker || {};
        const now = Date.now();
        const el = Math.max(0, Math.min(5000, now - (c.lastMs || now)));
        if (el < 200) return cur;
        const g = dropsPerSec(c) * (el / 1000);
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + g, total: (c.total || 0) + g, lastMs: now } };
      });
    }, 250);
    return () => clearInterval(t);
  }, [rate, setSave]);

  const tap = (e) => {
    const gain = perClick;
    setSave({
      ...save,
      clicker: { ...cl, drops: (cl.drops || 0) + gain, total: (cl.total || 0) + gain },
    });
    const rect = e.currentTarget.getBoundingClientRect();
    const id = splashId.current++;
    setSplashes(s => [...s.slice(-9), {
      id,
      x: (e.clientX ?? rect.left + rect.width / 2) - rect.left,
      y: (e.clientY ?? rect.top + rect.height / 2) - rect.top,
      gain,
    }]);
    setTimeout(() => setSplashes(s => s.filter(x => x.id !== id)), 780);
    Audio.click();
  };

  const buy = (def) => {
    const owned = cl.buildings?.[def.id] || 0;
    const cost = buildingCost(def, owned);
    if ((cl.drops || 0) < cost) return;
    setSave({
      ...save,
      clicker: { ...cl, drops: cl.drops - cost, buildings: { ...(cl.buildings || {}), [def.id]: owned + 1 } },
    });
    Audio.claimPing();
  };

  const buyClick = () => {
    const cost = clickUpgradeCost(cl.clickLvl || 0);
    if ((cl.drops || 0) < cost) return;
    setSave({ ...save, clicker: { ...cl, drops: cl.drops - cost, clickLvl: (cl.clickLvl || 0) + 1 } });
    Audio.claimPing();
  };

  const claimAll = () => {
    if (!pending.length) return;
    const ns = { ...save };
    const claimed = { ...(cl.claimed || {}) };
    for (const m of pending) {
      const r = m.reward;
      if (r.gold) { ns.gold = (ns.gold || 0) + r.gold; ns.lifetimeGold = (ns.lifetimeGold || 0) + r.gold; }
      if (r.gems) ns.gems = (ns.gems || 0) + r.gems;
      if (r.sp) ns.sp = (ns.sp || 0) + r.sp;
      if (r.slotCoins) ns.slotCoins = (ns.slotCoins || 0) + r.slotCoins;
      if (r.gachaTokens) ns.gachaTokens = (ns.gachaTokens || 0) + r.gachaTokens;
      if (r.gearParts) ns.gearParts = (ns.gearParts || 0) + r.gearParts;
      if (r.flux) ns.flux = (ns.flux || 0) + r.flux;
      if (r.rune) {
        const runes = [...(ns.runeInventory || [])];
        for (let i = 0; i < r.rune; i++) runes.push(rollRune(ns.attrs?.luck || 0));
        ns.runeInventory = runes;
      }
      claimed[m.at] = true;
    }
    ns.clicker = { ...cl, claimed };
    setSave(ns);
    Audio.levelUp();
  };

  const nextPct = next
    ? Math.max(0, Math.min(1, (cl.total || 0) / next.at))
    : 1;

  return (
    <div className="modal-overlay" data-testid="clicker" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="clk-panel">
        <div className="clk-head">
          <div className="clk-title">💧 THE WELL</div>
          <button className="prosp-close" onClick={onClose}>✕</button>
        </div>

        <div className="clk-readout">
          <div className="clk-drops">{fmtDrops(cl.drops || 0)}<span>drops</span></div>
          <div className="clk-rate">{fmtDrops(rate)}/s · {fmtDrops(perClick)} per tap</div>
        </div>

        {/* The well itself */}
        <div className="clk-well" onClick={tap} data-testid="clk-well">
          <div className="clk-well-ring" />
          <div className="clk-well-water"><i /><i /><i /></div>
          <div className="clk-well-drop">💧</div>
          {splashes.map(s => (
            <span key={s.id} className="clk-splash" style={{ left: s.x, top: s.y }}>+{fmtDrops(s.gain)}</span>
          ))}
        </div>

        {/* Milestone ladder — the only bridge out of the clicker */}
        <div className="clk-mile">
          <div className="clk-mile-head">
            <span>LIFETIME {fmtDrops(cl.total || 0)}</span>
            {next
              ? <span className="clk-mile-next">next at {fmtDrops(next.at)} — {next.label}</span>
              : <span className="clk-mile-next">all milestones claimed</span>}
          </div>
          <div className="clk-mile-track"><div className="clk-mile-fill" style={{ width: `${nextPct * 100}%` }} /></div>
          {pending.length > 0 && (
            <button className="clk-claim" onClick={claimAll} data-testid="clk-claim">
              ✦ CLAIM {pending.length} REWARD{pending.length > 1 ? 'S' : ''}
            </button>
          )}
          <div className="clk-mile-list">
            {CLICKER_MILESTONES.map(m => {
              const done = !!(cl.claimed || {})[m.at];
              const ready = !done && (cl.total || 0) >= m.at;
              return (
                <span key={m.at} className={`clk-mile-pip${done ? ' done' : ready ? ' ready' : ''}`} title={m.label}>
                  {done ? '✓' : ready ? '!' : ''}
                </span>
              );
            })}
          </div>
        </div>

        {/* Upgrades */}
        <div className="clk-shop">
          <button className="clk-buy clk-buy-tap" disabled={(cl.drops || 0) < clickUpgradeCost(cl.clickLvl || 0)} onClick={buyClick}>
            <span className="clk-buy-name">Stronger Pull <i>Lv {cl.clickLvl || 0}</i></span>
            <span className="clk-buy-desc">+1 drop per tap</span>
            <span className="clk-buy-cost">{fmtDrops(clickUpgradeCost(cl.clickLvl || 0))}</span>
          </button>
          {CLICKER_BUILDINGS.map(def => {
            const owned = cl.buildings?.[def.id] || 0;
            const cost = buildingCost(def, owned);
            const afford = (cl.drops || 0) >= cost;
            // Anything you cannot yet afford at all is still shown, but the
            // ones far out of reach are dimmed rather than hidden — seeing the
            // ladder is most of what makes the next rung worth climbing.
            const far = cost > (cl.drops || 0) * 12;
            return (
              <button key={def.id} className={`clk-buy${far ? ' far' : ''}`} disabled={!afford} onClick={() => buy(def)}
                      data-testid={`clk-buy-${def.id}`}>
                <GameIcon name={def.icon} size={26} />
                <span className="clk-buy-name">{def.name} {owned > 0 && <i>×{owned}</i>}</span>
                <span className="clk-buy-desc">{def.desc}</span>
                <span className="clk-buy-rate">+{fmtDrops(def.rate)}/s</span>
                <span className="clk-buy-cost">{fmtDrops(cost)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
