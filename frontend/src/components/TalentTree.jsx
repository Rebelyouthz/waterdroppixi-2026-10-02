import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  TALENTS, TALENT_BRANCHES, talentsFor, isTalentAvailable, talentPointsSpent,
} from '../game/talents';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

// =============================================
// TALENTS — the three-branch ladder
// =============================================
// Timmy, 2026-08-23: "de ska brancha sig i 3st ... de ska börja me 1 finisher
// längst ner vänd på den så de börjar neråt ... finishers i mitten större så
// linjer emellan som en hö gaffel ... de branchar upp live när man trycker å
// animera de lixom lite så de kommer ut linjer som glowar å ut åt sidorna
// vinklar upp 90c å åker upp å så blåser den upp små ikoner"
//
// THE LAYOUT, and why it is this shape:
//
//   step 15   [combo]      (FINISHER)      [effect]     <- top, the keystones
//      ...       |         /        \         |
//   step 2    [combo] ---- (FINISHER) ---- [effect]
//   step 1    [combo] ---- (FINISHER) ---- [effect]     <- bottom, where you start
//
// The FINISHER column is the spine: bigger tiles, dead centre, one per step.
// Each one throws a bracket out sideways and then straight up — the "hay fork"
// he described — and a small tile sits on each prong. So one step is three
// talents and reads as one decision, and the whole thing climbs upward from the
// single finisher you begin with.
//
// Scrolls to the BOTTOM on open, because that is where a new player's only
// available purchase is. Opening at the top of a 15-step ladder would show
// fifteen locked keystones and nothing to do.
//
// Class names are all `tt3-`. Deliberate: `.talent-node`, `.talent-line` and
// friends already exist in index.css AND overhaul.css from the old grid, and
// this project's measured worst bug is two CSS blocks fighting over one
// selector. A new prefix cannot collide with any of them.

const ROW_H = 108;          // vertical pitch between steps
const SPINE_W = 96;         // finisher tile
const PRONG_W = 62;         // side tile
const SIDE_GAP = 118;       // centre -> side tile distance

export default function TalentTree({ save, setSave, onClose }) {
  const owned = save.talent || {};
  const tp = save.talentPoints || 0;
  const [flash, setFlash] = useState(null);     // id that just lit up
  const [detail, setDetail] = useState(null);
  const scrollRef = useRef(null);

  const steps = talentsFor('finishers').length;

  // Open at the bottom — the ladder is climbed upward.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const isOwned = (t) => !!owned[t.id];
  const canBuy = (t) =>
    !t.pending && !isOwned(t) && isTalentAvailable(save, t) && tp >= t.cost;

  const buy = (t) => {
    if (!canBuy(t)) return;
    setSave({
      ...save,
      talentPoints: tp - t.cost,
      talent: { ...owned, [t.id]: true },
    });
    if (Audio.unlockReveal) Audio.unlockReveal(); else Audio.claimPing();
    // Drives the branch-out animation: the wires grow, then the tile pops.
    setFlash(t.id);
    setTimeout(() => setFlash(null), 900);
  };

  const spent = talentPointsSpent(save);
  const ownedCount = TALENTS.filter(isOwned).length;

  // One row = one step across all three branches.
  const rows = [];
  for (let s = steps; s >= 1; s--) {
    rows.push({
      step: s,
      finisher: talentsFor('finishers').find(t => t.step === s),
      combo: talentsFor('combos').find(t => t.step === s),
      effect: talentsFor('effects').find(t => t.step === s),
    });
  }

  const branchOf = (id) => TALENT_BRANCHES.find(b => b.id === id);

  const Tile = ({ t, big }) => {
    if (!t) return null;
    const has = isOwned(t);
    const avail = !t.pending && !has && isTalentAvailable(save, t);
    const afford = avail && tp >= t.cost;
    const b = branchOf(t.branch);
    const cls = [
      'tt3-tile',
      big ? 'tt3-spine' : 'tt3-prong',
      has ? 'is-owned' : '',
      avail ? 'is-avail' : '',
      afford ? 'is-afford' : '',
      t.pending ? 'is-pending' : '',
      !has && !avail ? 'is-locked' : '',
      t.keystone ? 'is-keystone' : '',
      flash === t.id ? 'is-flash' : '',
    ].filter(Boolean).join(' ');
    return (
      <button
        className={cls}
        style={{ '--tt-c': b.color, width: big ? SPINE_W : PRONG_W, height: big ? SPINE_W : PRONG_W }}
        data-testid={`talent-${t.id}`}
        onClick={() => (afford ? buy(t) : setDetail(t))}
        onContextMenu={(e) => { e.preventDefault(); setDetail(t); }}
        title={t.name}
      >
        <span className="tt3-halo" aria-hidden />
        <span className="tt3-face">
          <GameIcon name={t.icon} size={big ? 34 : 24} tone={b.color} />
        </span>
        {t.keystone && <span className="tt3-crown" aria-hidden />}
        {has && <span className="tt3-check" aria-hidden>✓</span>}
        {t.pending && <span className="tt3-soon">SOON</span>}
        {!has && !t.pending && avail && (
          <span className={`tt3-cost${afford ? ' ok' : ''}`}>{t.cost}</span>
        )}
        {!has && !avail && !t.pending && (
          <span className="tt3-lockicon" aria-hidden><GameIcon name="ui_lock" size={12} /></span>
        )}
      </button>
    );
  };

  return createPortal(
    <div className="modal-overlay tt3-overlay" data-testid="talent-tree"
      onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="tt3-panel">

        <div className="tt3-head">
          <div className="tt3-title"><GameIcon name="ui_leaf" size={18} /> TALENTS</div>
          <div className="tt3-count">{ownedCount}/{TALENTS.length}</div>
          <div className="tt3-tp"><GameIcon name="cur_tp" size={15} /> {tp}</div>
          <button className="tt3-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Branch legend — three columns, matching the ladder underneath. */}
        <div className="tt3-legend">
          {['combos', 'finishers', 'effects'].map(id => {
            const b = branchOf(id);
            const list = talentsFor(id);
            const got = list.filter(isOwned).length;
            return (
              <div key={id} className={`tt3-leg${id === 'finishers' ? ' mid' : ''}`} style={{ '--tt-c': b.color }}>
                <GameIcon name={b.icon} size={14} tone={b.color} />
                <span className="tt3-leg-name">{b.name}</span>
                <span className="tt3-leg-n">{got}/{list.length}</span>
              </div>
            );
          })}
        </div>

        <div className="tt3-scroll" ref={scrollRef}>
          <div className="tt3-ladder" style={{ height: rows.length * ROW_H + 60 }}>
            {rows.map((r, i) => {
              const finOwned = !!(r.finisher && isOwned(r.finisher));
              // A spine segment is lit once the step BELOW is owned, because
              // that is what opened this one.
              const below = rows[i + 1];
              const spineLit = below ? isOwned(below.finisher) : true;
              const growing = flash === r.finisher?.id;
              return (
                <div className="tt3-row" key={r.step} style={{ top: i * ROW_H }}>
                  {/* The hay fork: a bracket out to each side, then straight up. */}
                  <svg className="tt3-wires" viewBox={`0 0 ${SIDE_GAP * 2 + PRONG_W * 2} ${ROW_H}`}
                    preserveAspectRatio="none" aria-hidden>
                    <path className={`tt3-wire${finOwned ? ' lit' : ''}${growing ? ' grow' : ''}`}
                      d={`M ${SIDE_GAP + PRONG_W} ${ROW_H / 2} H ${PRONG_W + 14} V ${ROW_H / 2 - 26}`} />
                    <path className={`tt3-wire${finOwned ? ' lit' : ''}${growing ? ' grow' : ''}`}
                      d={`M ${SIDE_GAP + PRONG_W} ${ROW_H / 2} H ${SIDE_GAP * 2 + PRONG_W - 14} V ${ROW_H / 2 - 26}`} />
                    <path className={`tt3-spinewire${spineLit ? ' lit' : ''}`}
                      d={`M ${SIDE_GAP + PRONG_W} ${ROW_H} V 0`} />
                  </svg>
                  <div className="tt3-slot left"><Tile t={r.combo} /></div>
                  <div className="tt3-slot mid"><Tile t={r.finisher} big /></div>
                  <div className="tt3-slot right"><Tile t={r.effect} /></div>
                  <span className="tt3-step">{r.step}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tt3-foot">
          {spent} spent · earn talent points by clearing maps
        </div>
      </div>

      {detail && (
        <div className="tt3-sheet-wrap" onClick={() => setDetail(null)}>
          <div className="tt3-sheet" style={{ '--tt-c': branchOf(detail.branch).color }}
            onClick={(e) => e.stopPropagation()} data-testid="talent-detail">
            <div className="tt3-sheet-branch">
              {branchOf(detail.branch).name} · STEP {detail.step}
            </div>
            <div className="tt3-sheet-head">
              <span className="tt3-sheet-icon">
                <GameIcon name={detail.icon} size={30} tone={branchOf(detail.branch).color} />
              </span>
              <h3>{detail.name}</h3>
            </div>
            <p className="tt3-sheet-desc">{detail.desc}</p>
            {detail.pending ? (
              <div className="tt3-sheet-pending">
                Designed, not wired yet. It will not be sold until it works.
              </div>
            ) : isOwned(detail) ? (
              <div className="tt3-sheet-owned">✓ ACTIVE</div>
            ) : !isTalentAvailable(save, detail) ? (
              <div className="tt3-sheet-locked">
                <GameIcon name="ui_lock" size={13} /> Take step {detail.step - 1} first
              </div>
            ) : (
              <button className="tt3-sheet-buy" disabled={tp < detail.cost}
                onClick={() => { buy(detail); setDetail(null); }}>
                <GameIcon name="cur_tp" size={14} /> {detail.cost} — LEARN
              </button>
            )}
            <button className="tt3-sheet-back" onClick={() => setDetail(null)}>◂ BACK</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
