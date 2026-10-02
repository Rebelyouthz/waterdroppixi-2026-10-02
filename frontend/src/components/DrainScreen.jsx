import React, { useState, useEffect } from 'react';
import { DRAIN_STORY, DRAIN_FLOORS, DRAIN_BLOBS_PER_FLOOR, applyDrainPayout, drainClearReward } from '../game/drain';
import { buildingLevel } from '../game/base';
import { MUTATION_INDEX } from '../game/mutations';
import { Audio } from '../game/audio';
import { fireClaimFx } from './ClaimFx';
import GameIcon from './GameIcon';

// THE DRAIN — hangar hatch descent.
//
// CLAUDE: replace the STUB RUN below with the Dead Cells-like minigame.
// Keep this shell (story plate, locked state, applyDrainPayout, onClose).
// Do not rename the clicker (THE WELL). Read docs/THE-DRAIN.md first.

function nextMutation(save) {
  const have = save.mutationsUnlocked || [];
  if (!have.includes('mut_marrow')) return MUTATION_INDEX.mut_marrow;
  if (!have.includes('mut_film')) return MUTATION_INDEX.mut_film;
  return null;
}

export default function DrainScreen({ save, setSave, onClose }) {
  const open = buildingLevel(save, 'drain') >= 1;
  const tease = nextMutation(save);
  const [phase, setPhase] = useState(open ? 'ready' : 'locked');
  const [floor, setFloor] = useState(0);
  const [left, setLeft] = useState(DRAIN_BLOBS_PER_FLOOR);
  const [pop, setPop] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = () => {
    if (!open) return;
    setFloor(0);
    setLeft(DRAIN_BLOBS_PER_FLOOR);
    setResult(null);
    setPhase('run');
    if (Audio.menuOpen) Audio.menuOpen();
    if (Audio.campSteam) Audio.campSteam();
  };

  const smash = (e) => {
    if (phase !== 'run') return;
    const next = left - 1;
    setPop((n) => n + 1);
    if (Audio.clickerTap) Audio.clickerTap();
    if (next > 0) { setLeft(next); return; }
    const nextFloor = floor + 1;
    if (nextFloor >= DRAIN_FLOORS) {
      const before = save.mutationsUnlocked || [];
      const ns = applyDrainPayout({
        ...save,
        drainBestDepth: Math.max(save.drainBestDepth || 0, nextFloor),
      }, { depth: DRAIN_FLOORS });
      setSave(ns);
      const rwd = drainClearReward(DRAIN_FLOORS);
      fireClaimFx(e?.currentTarget, rwd);
      const added = (ns.mutationsUnlocked || []).find((id) => !before.includes(id));
      setResult({ rwd, mutation: added ? MUTATION_INDEX[added] : null });
      setPhase('clear');
      if (Audio.rewardFanfare) Audio.rewardFanfare();
      else if (Audio.levelUp) Audio.levelUp();
      return;
    }
    setSave((prev) => ({
      ...prev,
      drainBestDepth: Math.max(prev.drainBestDepth || 0, nextFloor),
    }));
    setFloor(nextFloor);
    setLeft(DRAIN_BLOBS_PER_FLOOR);
    if (Audio.campSteam) Audio.campSteam();
  };

  return (
    <div className="drain-overlay" data-testid="drain-screen" onClick={(e) => {
      if (e.target.classList.contains('drain-overlay')) onClose();
    }}>
      <div className="drain-panel">
        <div className="drain-head">
          <div className="drain-title"><GameIcon name="ui_hatch" size={22} /> {DRAIN_STORY.title}</div>
          <button className="sr-close" onClick={onClose} aria-label="Climb out">x</button>
        </div>

        {phase === 'locked' && (
          <div className="drain-body">
            <p className="drain-lie">{DRAIN_STORY.aidaLie}</p>
            <p>The grate is still bolted. Walk to it in the hangar and unscrew it.</p>
            <button className="drain-btn" onClick={onClose}>BACK TO HANGAR</button>
          </div>
        )}

        {phase === 'ready' && (
          <div className="drain-body">
            <p className="drain-lie">{DRAIN_STORY.aidaLie}</p>
            <p>{DRAIN_STORY.whyHeGoes}</p>
            <p className="drain-truth">{DRAIN_STORY.truth}</p>
            <p className="drain-note">Stub descent — three pipes. The real Drain goes here.</p>
            {tease && (
              <p className="drain-mut">
                <GameIcon name="ui_hatch" size={16} /> Waiting in the wet — {tease.name}
              </p>
            )}
            <button className="drain-btn" onClick={start} data-testid="drain-descend">DESCEND</button>
          </div>
        )}

        {phase === 'run' && (
          <div className="drain-body drain-run">
            <div className="drain-floor">PIPE {floor + 1} / {DRAIN_FLOORS}</div>
            <button className={`drain-well${pop ? ' hit' : ''}`} onClick={smash} data-testid="drain-smash">
              <span className="drain-well-core" key={pop} />
              <span className="drain-well-label">SMASH {left}</span>
            </button>
            <div className="drain-pips" aria-hidden>
              {Array.from({ length: DRAIN_BLOBS_PER_FLOOR }).map((_, i) => (
                <i key={i} className={i < left ? 'on' : ''} />
              ))}
            </div>
            <p>Tap the coolant. Clear the pipe. Keep going down.</p>
          </div>
        )}

        {phase === 'clear' && result && (
          <div className="drain-body">
            <div className="drain-floor">BOTTOM</div>
            <p>You climb out wetter than you went in.</p>
            <p>
              +{result.rwd.gold} gold · +{result.rwd.sp} SP · +{result.rwd.talentPoints} TP
              <br />First pipe pays a Combo Point into Talents.
            </p>
            {result.mutation ? (
              <p className="drain-mut">
                <GameIcon name="ui_hatch" size={16} /> MUTATION UNLOCKED — {result.mutation.name}
              </p>
            ) : (
              <p className="drain-note">You already drank what was down here. Gold still drips.</p>
            )}
            <button className="drain-btn" onClick={onClose}>CLIMB OUT</button>
          </div>
        )}
      </div>
    </div>
  );
}
