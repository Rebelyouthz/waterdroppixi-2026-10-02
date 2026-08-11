import React, { useState, useEffect, useRef } from 'react';
import {
  CLICKER_BUILDINGS, buildingCost, clickUpgradeCost,
  dropsPerSec, dropsPerClick, pendingMilestones, nextMilestone,
  CLICKER_MILESTONES, fmtDrops,
  prestigeGain, prestigeMult, doPrestige, SPRING_BONUS,
} from '../game/clicker';
import { rollRune } from '../game/runes';
import { rollPartsDrop, addParts } from '../game/gear';
import { rollCard } from '../game/petTcg';
import { clickerRateMult } from '../game/base';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';

export default function ClickerScreen({ save, setSave, onClose }) {
  useEffect(() => {
    // The clicker keeps waterdrop.mp3, the menu track. The 3-track run playlist
    // is reserved for an actual run -- it made a slow idle game feel like combat.
    Audio.swapToMenuMusic();
    return () => Audio.swapToMenuMusic();
  }, []);

  const cl = save.clicker || { drops: 0, total: 0, buildings: {}, clickLvl: 0, claimed: {} };
  // The Well building multiplies production. Applied here rather than baked
  // into the stored rate so levelling the building takes effect immediately
  // on existing condensers.
  const wellMult = clickerRateMult(save);
  const rate = dropsPerSec(cl) * wellMult;
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
        const g = dropsPerSec(c) * wellMult * (el / 1000);
        return { ...cur, clicker: { ...c, drops: (c.drops || 0) + g, total: (c.total || 0) + g, lastMs: now } };
      });
    }, 250);
    return () => clearInterval(t);
  }, [rate, setSave]);

  const tap = (e) => {
    const gain = perClick;
    // Functional update, and it is the whole reason fast tapping works.
    // `setSave({ ...save, ... })` reads `save` and `cl` from THIS render's
    // closure, so several taps landing inside one React batch all computed
    // from the same stale drop count and every one but the last was silently
    // thrown away — which reads exactly as "tapping fast does nothing".
    setSave(cur => {
      const c = cur.clicker || {};
      return {
        ...cur,
        clicker: { ...c, drops: (c.drops || 0) + gain, total: (c.total || 0) + gain },
      };
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
    Audio.clickerTap();
  };

  const buy = (def) => {
    // Same stale-closure trap as `tap`: buying several in a row inside one
    // batch would each read the same drop count and the same owned count, so
    // you would pay once and get one building for three clicks. The updater
    // recomputes both from the live state, which also means the price rises
    // correctly across a rapid sequence.
    setSave(cur => {
      const c = cur.clicker || {};
      const owned = c.buildings?.[def.id] || 0;
      const cost = buildingCost(def, owned);
      if ((c.drops || 0) < cost) return cur;
      return {
        ...cur,
        clicker: { ...c, drops: c.drops - cost, buildings: { ...(c.buildings || {}), [def.id]: owned + 1 } },
      };
    });
    // Machinery engaging, not a UI click — buying a producer is a different
    // KIND of event from confirming a menu action and should not share a voice.
    Audio.clickerBuy();
  };

  const buyClick = () => {
    setSave(cur => {
      const c = cur.clicker || {};
      const cost = clickUpgradeCost(c.clickLvl || 0);
      if ((c.drops || 0) < cost) return cur;
      return { ...cur, clicker: { ...c, drops: c.drops - cost, clickLvl: (c.clickLvl || 0) + 1 } };
    });
    Audio.clickerBuy();
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
      // Every milestone also pays a slot part. The clicker is a place players
      // leave running, so it is the steadiest trickle of the new currency --
      // small per hit, meaningful over a session.
      {
        const p = rollPartsDrop(1);
        ns.gearSlotParts = addParts(ns, p.slot, p.amount);
      }
      if (r.flux) ns.flux = (ns.flux || 0) + r.flux;
      if (r.rune) {
        const runes = [...(ns.runeInventory || [])];
        for (let i = 0; i < r.rune; i++) runes.push(rollRune(ns.attrs?.luck || 0));
        ns.runeInventory = runes;
      }
      if (r.tcgCard) {
        const cards = [...(ns.tcgCardInventory || [])];
        for (let i = 0; i < r.tcgCard; i++) cards.push(rollCard(ns.attrs?.luck || 0));
        ns.tcgCardInventory = cards;
      }
      claimed[m.at] = true;
    }
    ns.clicker = { ...cl, claimed };
    setSave(ns);
    pushToast({ tone: 'gold', icon: 'gem', title: `${pending.length} milestone${pending.length > 1 ? 's' : ''} claimed`, text: pending.map(m => m.label).join('  ·  ') });
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

        {/* ---- Springs (prestige) --------------------------------------
            The loop that turns this from a curve that flattens into a
            game. Only shown once it can actually pay, because an always-
            visible button reading '0 Springs' teaches nothing. */}
        {(() => {
          const gain = prestigeGain(cl);
          const mult = prestigeMult(cl);
          const springs = cl.springs || 0;
          if (springs <= 0 && gain <= 0) return null;
          return (
            <div className="clk-spring" data-testid="clk-spring">
              <div className="clk-spring-head">
                <span className="clk-spring-title">✧ SPRINGS</span>
                <span className="clk-spring-mult">
                  {springs} banked · ×{mult.toFixed(2)} production
                </span>
              </div>
              {gain > 0 ? (
                <>
                  <div className="clk-spring-desc">
                    Reset the well to bank <b>+{gain}</b> Spring{gain > 1 ? 's' : ''}.
                    Buildings and taps go back to zero — lifetime total,
                    claimed milestones and banked Springs all stay.
                  </div>
                  <button className="clk-spring-btn" data-testid="clk-prestige"
                    onClick={() => {
                      const ns = { ...save, clicker: doPrestige(cl) };
                      setSave(ns); Audio.rankUp && Audio.rankUp();
                      pushToast('✧ +' + gain + ' Spring' + (gain > 1 ? 's' : '') +
                        ' — production ×' + prestigeMult(ns.clicker).toFixed(2));
                    }}>
                    ✧ DRAW THE SPRING · +{gain}
                  </button>
                </>
              ) : (
                <div className="clk-spring-desc">
                  Each Spring is +{Math.round(SPRING_BONUS * 100)}% forever.
                  Keep producing — the next one is earned from lifetime drops.
                </div>
              )}
            </div>
          );
        })()}

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
