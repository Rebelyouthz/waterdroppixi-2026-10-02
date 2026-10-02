import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  TALENTS, TALENT_BRANCHES, TALENT_TOTAL_COST, talentsFor, isTalentAvailable,
  talentPointsSpent, talentCeremonyOf,
} from '../game/talents';
import {
  COMBO_NODES, comboNodeAtStep, comboFormOwned, comboNodeOwned,
  isComboAvailable, canBuyCombo, buyComboNode, comboCeremonyOf,
} from '../game/comboSchool';
import { Audio } from '../game/audio';
import { RIB_FORMS } from '../game/meleeCombo';
import GameIcon from './GameIcon';

// =============================================
// TALENTS — three-branch ladder + combo school
// =============================================
// Combos are LARGE skippable nodes on the left rail. They cost Combo Points
// from story finales / minigames / THE DRAIN, never TP, and they never gate
// a talent step. The school strip only shows forms you have unlocked.
// TALENTS stays at 45.

const ROW_H = 148;
const SPINE_W = 92;
const PRONG_W = 64;
const COMBO_W = 108;

export default function TalentTree({ save, setSave, onClose, onMoveUnlock }) {
  const owned = save.talent || {};
  const tp = save.talentPoints || 0;
  const cp = save.comboPoints || 0;
  const [flash, setFlash] = useState(null);
  const [picked, setPicked] = useState(null);
  const [intro, setIntro] = useState(true);
  const [boughtPulse, setBoughtPulse] = useState(false);
  const [tpPulse, setTpPulse] = useState(false);
  const [learned, setLearned] = useState(null);
  const [gains, setGains] = useState([]);
  const fxKey = useRef(0);
  const scrollRef = useRef(null);

  const steps = talentsFor('finishers').length;

  useEffect(() => {
    Audio.menuOpen?.();
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const t = setTimeout(() => setIntro(false), 900);
    return () => clearTimeout(t);
  }, []);

  const isOwned = (t) => !!owned[t.id];
  const canBuy = (t) =>
    !t.pending && !isOwned(t) && isTalentAvailable(save, t) && tp >= t.cost;

  const inspectTalent = (t) => {
    Audio.skillHover?.(t.keystone ? 'keystone' : t.step >= 8 ? 'notable' : 'minor');
    setPicked({ type: 'talent', t });
  };

  const inspectCombo = (n) => {
    Audio.skillHover?.('notable');
    setPicked({ type: 'combo', n });
  };

  const inspectForm = (f) => {
    Audio.click?.();
    setPicked({ type: 'form', f });
  };

  const buy = (t) => {
    if (!canBuy(t)) {
      Audio.skillDenied?.();
      return;
    }
    const b = TALENT_BRANCHES.find(x => x.id === t.branch);
    setSave(prev => ({
      ...prev,
      talentPoints: (prev.talentPoints || 0) - t.cost,
      talent: { ...(prev.talent || {}), [t.id]: true },
    }));
    Audio.skillBuy?.(t.keystone ? 'keystone' : t.step >= 8 ? 'notable' : 'minor', !!t.keystone);
    const ceremony = talentCeremonyOf(t);
    if (ceremony) {
      Audio.unlockReveal?.();
      onMoveUnlock?.(ceremony);
    } else if (t.keystone) {
      Audio.levelUp?.();
    }
    pulseLearn(t.id, t.name, b.color);
  };

  const buyCombo = (n) => {
    if (!canBuyCombo(save, n)) {
      Audio.skillDenied?.();
      return;
    }
    setSave(prev => buyComboNode(prev, n.id));
    Audio.skillBuy?.('keystone', true);
    const ceremony = comboCeremonyOf(n);
    Audio.unlockReveal?.();
    onMoveUnlock?.(ceremony);
    pulseLearn(n.id, n.name, '#ffb02e');
  };

  const pulseLearn = (id, name, color) => {
    setFlash(id);
    setBoughtPulse(true);
    setTpPulse(true);
    const key = fxKey.current++;
    setGains(g => [...g, { key, id, name, color }]);
    setLearned(name);
    setPicked(null);
    setTimeout(() => setFlash(null), 900);
    setTimeout(() => setBoughtPulse(false), 480);
    setTimeout(() => setTpPulse(false), 420);
    setTimeout(() => setGains(g => g.filter(e => e.key !== key)), 1400);
    setTimeout(() => setLearned(null), 1100);
  };

  const spent = talentPointsSpent(save);
  const ownedCount = TALENTS.filter(isOwned).length;
  const comboOwned = COMBO_NODES.filter(n => comboNodeOwned(save, n)).length;
  const meterPct = TALENT_TOTAL_COST ? Math.round((spent / TALENT_TOTAL_COST) * 100) : 0;
  const school = RIB_FORMS.filter(f => comboFormOwned(save, f.id));

  const rows = [];
  for (let s = steps; s >= 1; s--) {
    rows.push({
      step: s,
      finisher: talentsFor('finishers').find(t => t.step === s),
      combo: talentsFor('combos').find(t => t.step === s),
      effect: talentsFor('effects').find(t => t.step === s),
      rib: comboNodeAtStep(s),
    });
  }

  const branchOf = (id) => TALENT_BRANCHES.find(b => b.id === id);

  const Tile = ({ t, big }) => {
    if (!t) return null;
    const has = isOwned(t);
    const avail = !t.pending && !has && isTalentAvailable(save, t);
    const afford = avail && tp >= t.cost;
    const b = branchOf(t.branch);
    const size = t.keystone ? (big ? 108 : 78) : big ? SPINE_W : PRONG_W;
    const sel = picked?.type === 'talent' && picked.t.id === t.id;
    const cls = [
      'tt3-tile',
      big ? 'tt3-spine' : 'tt3-prong',
      has ? 'is-owned' : '',
      avail ? 'is-avail' : '',
      afford ? 'is-afford' : '',
      t.pending ? 'is-pending' : '',
      !has && !avail && !t.pending ? 'is-locked' : '',
      t.keystone ? 'is-keystone' : '',
      flash === t.id ? 'is-flash' : '',
      sel ? 'is-sel' : '',
    ].filter(Boolean).join(' ');
    return (
      <button
        className={cls}
        style={{ '--tt-c': b.color, width: size }}
        data-testid={`talent-${t.id}`}
        onClick={() => inspectTalent(t)}
        title={t.name}
      >
        <span className="tt3-plate" style={{ width: size, height: size }}>
          <span className="tt3-halo" aria-hidden />
          <span className="tt3-glass" aria-hidden />
          <span className="tt3-spec" aria-hidden />
          <span className="tt3-face">
            <GameIcon name={t.icon} size={big ? 34 : 22} tone={has || afford || sel ? b.color : '#6a7888'} />
          </span>
          {t.keystone && <span className="tt3-crown" aria-hidden />}
          {has && <span className="tt3-check" aria-hidden />}
          {flash === t.id && <span className="tt3-shock" aria-hidden />}
          {gains.filter(g => g.id === t.id).map(g => (
            <span key={g.key} className="tt3-gain" style={{ '--tt-c': g.color }}>{g.name}</span>
          ))}
          {t.pending && <span className="tt3-soon">SOON</span>}
          {!has && !t.pending && avail && (
            <span className={`tt3-cost${afford ? ' ok' : ''}`}>{t.cost}</span>
          )}
          {!has && !avail && !t.pending && (
            <span className="tt3-lockicon" aria-hidden><GameIcon name="ui_lock" size={12} /></span>
          )}
        </span>
        <span className="tt3-name">{t.name}</span>
      </button>
    );
  };

  const ComboTile = ({ n }) => {
    if (!n) return <span className="tt3-combo-gap" aria-hidden />;
    const has = comboNodeOwned(save, n);
    const avail = isComboAvailable(save, n);
    const afford = avail && cp >= n.cost;
    const sel = picked?.type === 'combo' && picked.n.id === n.id;
    const cls = [
      'tt3-tile', 'tt3-combo-node',
      has ? 'is-owned' : '',
      avail ? 'is-avail' : '',
      afford ? 'is-afford' : '',
      !has && !avail ? 'is-locked' : '',
      flash === n.id ? 'is-flash' : '',
      sel ? 'is-sel' : '',
    ].filter(Boolean).join(' ');
    return (
      <button
        className={cls}
        style={{ '--tt-c': '#ffb02e', width: COMBO_W }}
        data-testid={`combo-node-${n.id}`}
        onClick={() => inspectCombo(n)}
        title={n.name}
      >
        <span className="tt3-plate" style={{ width: COMBO_W, height: COMBO_W }}>
          <span className="tt3-halo" aria-hidden />
          <span className="tt3-glass" aria-hidden />
          <span className="tt3-spec" aria-hidden />
          <span className="tt3-face">
            <GameIcon name={n.icon} size={36} tone={has || afford || sel ? '#ffb02e' : '#6a7888'} />
          </span>
          {has && <span className="tt3-check" aria-hidden />}
          {flash === n.id && <span className="tt3-shock" aria-hidden />}
          {gains.filter(g => g.id === n.id).map(g => (
            <span key={g.key} className="tt3-gain" style={{ '--tt-c': g.color }}>{g.name}</span>
          ))}
          {!has && avail && (
            <span className={`tt3-cost${afford ? ' ok' : ''}`}>{n.cost}</span>
          )}
          {!has && !avail && (
            <span className="tt3-lockicon" aria-hidden><GameIcon name="ui_lock" size={12} /></span>
          )}
        </span>
        <span className="tt3-name">{n.name}</span>
      </button>
    );
  };

  const pickedTalent = picked?.type === 'talent' ? picked.t : null;
  const pickedCombo = picked?.type === 'combo' ? picked.n : null;
  const pickedForm = picked?.type === 'form' ? picked.f : null;
  const sheetColor = pickedTalent
    ? branchOf(pickedTalent.branch).color
    : '#ffb02e';

  return createPortal(
    <div className="modal-overlay tt3-overlay" data-testid="talent-tree"
      onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className={`tt3-panel${boughtPulse ? ' is-bought' : ''}`}>

        <div className="tt3-head">
          <div className="tt3-title"><GameIcon name="ui_leaf" size={18} /> TALENTS</div>
          <div className="tt3-count">{ownedCount}/{TALENTS.length}</div>
          <div className="tt3-spent-meter" aria-hidden>
            <span className="tt3-spent-fill" style={{ width: `${meterPct}%` }} />
          </div>
          <div className={`tt3-tp${tpPulse ? ' is-pulse' : ''}`}><GameIcon name="cur_tp" size={15} /> {tp}</div>
          <div className={`tt3-cp${tpPulse ? ' is-pulse' : ''}`} data-testid="combo-points">
            <GameIcon name="cur_cp" size={15} /> {cp}
          </div>
          <button className="tt3-close" onClick={onClose} aria-label="Close">CLOSE</button>
        </div>

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
                <span className="tt3-leg-bar" aria-hidden>
                  <span className="tt3-leg-fill" style={{ width: `${(got / list.length) * 100}%` }} />
                </span>
              </div>
            );
          })}
        </div>

        <div className="tt3-rib-forms" data-testid="rib-forms">
          <div className="tt3-rib-h">SNAPPED RIB · FORMS {comboOwned}/{COMBO_NODES.length}</div>
          {school.length === 0 ? (
            <div className="tt3-rib-empty">
              Large COMBOS nodes on the left. Combo Points come from story finales, minigames, and the first pipe of THE DRAIN.
            </div>
          ) : (
            <div className="tt3-rib-row">
              {school.map((f, i) => {
                const sel = pickedForm && pickedForm.id === f.id;
                return (
                  <React.Fragment key={f.id}>
                    {i > 0 && <span className="tt3-rib-link lit" aria-hidden />}
                    <button
                      type="button"
                      className={`tt3-rib-card is-open${sel ? ' is-sel' : ''}`}
                      onClick={() => inspectForm(f)}
                      data-testid={`rib-form-${f.id}`}
                    >
                      <b>{f.name}</b>
                      <i>{f.seq}</i>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="tt3-scroll" ref={scrollRef}>
          <div className="tt3-ladder" style={{ height: rows.length * ROW_H + 48 }}>
            {rows.map((r, i) => {
              const finOwned = !!(r.finisher && isOwned(r.finisher));
              const below = rows[i + 1];
              const spineLit = below ? isOwned(below.finisher) : true;
              const growing = flash === r.finisher?.id || (intro && r.step === 1);
              const stepOwned = [r.finisher, r.combo, r.effect].some(t => t && isOwned(t));
              const stepAvail = [r.finisher, r.combo, r.effect].some(t => t && canBuy(t));
              return (
                <div
                  className="tt3-row"
                  key={r.step}
                  style={{ top: i * ROW_H, '--tt-i': r.step - 1 }}
                >
                  <span className={`tt3-step${stepOwned ? ' on' : ''}${stepAvail ? ' go' : ''}`}>{r.step}</span>
                  <div className="tt3-combo-rail">
                    <ComboTile n={r.rib} />
                  </div>
                  <div className="tt3-fork">
                    <svg className="tt3-wires" viewBox="0 0 100 100"
                      preserveAspectRatio="none" aria-hidden>
                      <path pathLength="100"
                        className={`tt3-wire${finOwned ? ' lit' : ''}${growing ? ' grow' : ''}`}
                        d="M 50 50 H 14.9 V 22" />
                      <path pathLength="100"
                        className={`tt3-wire${finOwned ? ' lit' : ''}${growing ? ' grow' : ''}`}
                        d="M 50 50 H 85.1 V 22" />
                      <path pathLength="100"
                        className={`tt3-spinewire${spineLit ? ' lit' : ''}`}
                        d="M 50 100 V 0" />
                    </svg>
                    <div className="tt3-slot left"><Tile t={r.combo} /></div>
                    <div className="tt3-slot mid"><Tile t={r.finisher} big /></div>
                    <div className="tt3-slot right"><Tile t={r.effect} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {learned && <div className="tt3-learned" aria-live="polite">LEARNED — {learned}</div>}

        <div className="tt3-foot">
          {ownedCount}/{TALENTS.length} learned · {comboOwned}/{COMBO_NODES.length} strings · {spent} TP spent · Combo Points from story, minigames, THE DRAIN
        </div>
      </div>

      {pickedTalent && (
        <div className="tt3-sheet-wrap" onClick={() => setPicked(null)}>
          <div className="tt3-sheet" style={{ '--tt-c': sheetColor }}
            onClick={(e) => e.stopPropagation()} data-testid="talent-detail">
            <div className="tt3-sheet-branch">
              {branchOf(pickedTalent.branch).name} · STEP {pickedTalent.step}
              {pickedTalent.keystone ? ' · KEYSTONE' : ''}
            </div>
            <div className="tt3-sheet-head">
              <span className="tt3-sheet-icon">
                <GameIcon name={pickedTalent.icon} size={36} tone={sheetColor} />
              </span>
              <h3>{pickedTalent.name}</h3>
            </div>
            <p className="tt3-sheet-desc">{pickedTalent.desc}</p>
            {pickedTalent.pending ? (
              <div className="tt3-sheet-pending">
                Designed, not wired yet. It will not be sold until it works.
              </div>
            ) : isOwned(pickedTalent) ? (
              <div className="tt3-sheet-owned">ACTIVE</div>
            ) : !isTalentAvailable(save, pickedTalent) ? (
              <div className="tt3-sheet-locked">
                <GameIcon name="ui_lock" size={13} /> Take step {pickedTalent.step - 1} first
              </div>
            ) : (
              <button className="tt3-sheet-buy" disabled={tp < pickedTalent.cost}
                onClick={() => buy(pickedTalent)}>
                <GameIcon name="cur_tp" size={14} /> {pickedTalent.cost} — LEARN
              </button>
            )}
            <button className="tt3-sheet-back" onClick={() => setPicked(null)}>BACK</button>
          </div>
        </div>
      )}

      {pickedCombo && (
        <div className="tt3-sheet-wrap" onClick={() => setPicked(null)}>
          <div className="tt3-sheet" style={{ '--tt-c': '#ffb02e' }}
            onClick={(e) => e.stopPropagation()} data-testid="combo-detail">
            <div className="tt3-sheet-branch">
              SNAPPED RIB · LARGE NODE · {pickedCombo.cost} COMBO POINT{pickedCombo.cost === 1 ? '' : 'S'}
            </div>
            <div className="tt3-sheet-head">
              <span className="tt3-sheet-icon">
                <GameIcon name={pickedCombo.icon} size={36} tone="#ffb02e" />
              </span>
              <h3>{pickedCombo.name}</h3>
            </div>
            <p className="tt3-sheet-seq">{pickedCombo.seq}</p>
            <p className="tt3-sheet-desc">{pickedCombo.desc}</p>
            <p className="tt3-sheet-hint">{pickedCombo.hint}</p>
            {comboNodeOwned(save, pickedCombo) ? (
              <div className="tt3-sheet-owned">UNLOCKED IN THE SCHOOL</div>
            ) : !isComboAvailable(save, pickedCombo) ? (
              <div className="tt3-sheet-locked">
                <GameIcon name="ui_lock" size={13} /> Unlock the previous string first. This node does not block the talent ladder — walk past it.
              </div>
            ) : (
              <button className="tt3-sheet-buy" disabled={cp < pickedCombo.cost}
                onClick={() => buyCombo(pickedCombo)}>
                <GameIcon name="cur_cp" size={14} /> {pickedCombo.cost} — LEARN
              </button>
            )}
            {pickedCombo.needs && (
              <p className="tt3-sheet-hint">
                In a run this also needs {pickedCombo.needsName} on the Combos column.
              </p>
            )}
            <button className="tt3-sheet-back" onClick={() => setPicked(null)}>BACK</button>
          </div>
        </div>
      )}

      {pickedForm && (
        <div className="tt3-sheet-wrap" onClick={() => setPicked(null)}>
          <div className="tt3-sheet" style={{ '--tt-c': '#ffb02e' }}
            onClick={(e) => e.stopPropagation()} data-testid="rib-form-detail">
            <div className="tt3-sheet-branch">SNAPPED RIB · COMBO SCHOOL</div>
            <div className="tt3-sheet-head">
              <span className="tt3-sheet-icon">
                <GameIcon name="pRush" size={36} tone="#ffb02e" />
              </span>
              <h3>{pickedForm.name}</h3>
            </div>
            <p className="tt3-sheet-seq">{pickedForm.seq}</p>
            <p className="tt3-sheet-desc">{pickedForm.desc}</p>
            <p className="tt3-sheet-hint">{pickedForm.hint}</p>
            {pickedForm.needs && !owned[{ comboHaste: 't_cmb_speed', comboDmg: 't_cmb_dmg' }[pickedForm.needs]] && (
              <div className="tt3-sheet-locked">
                <GameIcon name="ui_lock" size={13} /> Buy {pickedForm.needsName} on the Combos column to open this string in a run
              </div>
            )}
            {pickedForm.needs && !!owned[{ comboHaste: 't_cmb_speed', comboDmg: 't_cmb_dmg' }[pickedForm.needs]] && (
              <div className="tt3-sheet-owned">OPEN — you own {pickedForm.needsName}</div>
            )}
            {!pickedForm.needs && (
              <div className="tt3-sheet-owned">BASE STRING — always ready</div>
            )}
            <button className="tt3-sheet-back" onClick={() => setPicked(null)}>BACK</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
