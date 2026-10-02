import React from 'react';
import { PATH_STEPS, currentStep, pathProgress } from '../game/path';
import { applyReward } from '../store';
import GameIcon from './GameIcon';
import { fireClaimFx, CAMP_CLAIM_FLY } from './ClaimFx';

// The Path, rendered as a single lit rung with the finished ones stacked
// behind it. Only the current step is expanded — the whole point is that the
// player is looking at one thing to do, not at a checklist.
export default function PathPanel({ save, setSave, onGo }) {
  const done = save.pathClaimed || {};
  const step = currentStep(save);
  const doneCount = pathProgress(save);
  const ready = step ? step.check(save) : false;

  const claim = (e) => {
    if (!step || !ready) return;
    const ns = { ...save, pathClaimed: { ...done, [step.id]: true } };
    applyReward(ns, step.rwd, null);
    setSave(ns);
    fireClaimFx(e?.currentTarget, step.rwd, { flyTo: CAMP_CLAIM_FLY });
  };

  const rwdBits = (r) => [
    r.gold && { sym: '★', v: r.gold },
    r.gearParts && { icon: 'ui_part', v: r.gearParts },
    r.gems && { icon: 'gems', v: r.gems },
    r.sp && { sym: '◆', v: r.sp },
    r.flux && { icon: 'cur_shards', v: r.flux },
    r.petFood && { icon: 'petFood', v: r.petFood },
  ].filter(Boolean);

  return (
    <div className="path-wrap" data-testid="path-panel">
      <div className="path-head">
        <span className="path-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><GameIcon name="ui_compass" size={15} /> THE PATH</span>
        <span className="path-count">{doneCount}/{PATH_STEPS.length}</span>
        <div className="path-bar"><i style={{ width: `${(doneCount / PATH_STEPS.length) * 100}%` }} /></div>
      </div>

      {!step && (
        <div className="path-done-all">
          Every system in the game has been through your hands. Nothing left to introduce.
        </div>
      )}

      {step && (
        <div className={`path-step${ready ? ' ready' : ''}`} data-testid={`path-step-${step.id}`}>
          <div className="path-step-top">
            <span className="path-step-icon"><GameIcon name={step.icon} size={22} /></span>
            <div className="path-step-text">
              <div className="path-step-title">{step.title}</div>
              <div className="path-step-why">{step.why}</div>
            </div>
          </div>
          <div className="path-step-goal">
            <span className={`path-tick${ready ? ' on' : ''}`}>{ready ? '✓' : '○'}</span>
            {step.goal}
          </div>
          <div className="path-step-foot">
            <span className="path-rwd" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {rwdBits(step.rwd).map((b, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {b.sym || <GameIcon name={b.icon} size={13} />} {b.v}
                </span>
              ))}
            </span>
            {ready
              ? <button className="path-btn claim" onClick={claim} data-testid="path-claim">✓ COLLECT</button>
              : <button className="path-btn go" onClick={() => onGo(step.go)} data-testid="path-go">TAKE ME THERE →</button>}
          </div>
        </div>
      )}

      {doneCount > 0 && (
        <div className="path-trail">
          {PATH_STEPS.filter(s => done[s.id]).map(s => (
            <span key={s.id} className="path-trail-dot" title={s.title}><GameIcon name={s.icon} size={14} /></span>
          ))}
        </div>
      )}
    </div>
  );
}
