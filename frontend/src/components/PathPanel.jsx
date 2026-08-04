import React from 'react';
import { PATH_STEPS, currentStep, pathProgress } from '../game/path';
import { applyReward } from '../store';
import { Audio } from '../game/audio';

// The Path, rendered as a single lit rung with the finished ones stacked
// behind it. Only the current step is expanded — the whole point is that the
// player is looking at one thing to do, not at a checklist.
export default function PathPanel({ save, setSave, onGo }) {
  const done = save.pathClaimed || {};
  const step = currentStep(save);
  const doneCount = pathProgress(save);
  const ready = step ? step.check(save) : false;

  const claim = () => {
    if (!step || !ready) return;
    const ns = { ...save, pathClaimed: { ...done, [step.id]: true } };
    applyReward(ns, step.rwd, null);
    setSave(ns);
    Audio.levelUp();
  };

  const rwdBits = (r) => [
    r.gold && `★ ${r.gold}`,
    r.gearParts && `🔩 ${r.gearParts}`,
    r.gems && `💎 ${r.gems}`,
    r.sp && `◆ ${r.sp}`,
    r.flux && `✦ ${r.flux}`,
    r.petFood && `🍖 ${r.petFood}`,
  ].filter(Boolean);

  return (
    <div className="path-wrap" data-testid="path-panel">
      <div className="path-head">
        <span className="path-title">🧭 THE PATH</span>
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
            <span className="path-step-icon">{step.icon}</span>
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
            <span className="path-rwd">{rwdBits(step.rwd).join('  ')}</span>
            {ready
              ? <button className="path-btn claim" onClick={claim} data-testid="path-claim">✓ COLLECT</button>
              : <button className="path-btn go" onClick={() => onGo(step.go)} data-testid="path-go">TAKE ME THERE →</button>}
          </div>
        </div>
      )}

      {doneCount > 0 && (
        <div className="path-trail">
          {PATH_STEPS.filter(s => done[s.id]).map(s => (
            <span key={s.id} className="path-trail-dot" title={s.title}>{s.icon}</span>
          ))}
        </div>
      )}
    </div>
  );
}
