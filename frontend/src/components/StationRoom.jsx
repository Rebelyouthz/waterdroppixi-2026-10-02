import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StationRoom as Room, STATIONS } from '../game/stationRoom';
import { BUILDINGS, buildingLevel, isStationRepaired, repairStation } from '../game/base';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

// THE MAIN HALL — the walkable station, as a screen.
//
// The split is the same one GameScreen already uses and the same one the
// walkable-station plan settled on: PixiJS draws the room, React draws
// everything you read. That keeps the prompt legible at any DPI, keeps focus
// and touch targets in the DOM where the accessibility work already lives, and
// means the room never has to grow its own text renderer.
//
// The one rule this screen must never break: it can NEVER trap the player away
// from something they need. The exit is a door two steps from where you spawn,
// Escape closes it, and every door in here also exists in the module list you
// came from. Walking is the pleasure, not the tax.

// Her voice: flat, patient, faintly disappointed. A customer-service AI
// explaining a refund policy to a houseplant. She never uses more words than
// the picture would have needed. (docs/STORY-BIBLE.md section 2.)
const AIDA_LINES = [
  'The core is warm. That is not the same as working.',
  'You are standing in the room. Well done.',
  'Every module you power on makes you stronger. That is the whole reason.',
  'I have routed the current. Do not look at the cable.',
  'There is more station than this. You have not paid for it yet.',
];

export default function StationRoom({ save, setSave, onOpen, onBuild, onClose }) {
  const canvasRef = useRef(null);
  const roomRef = useRef(null);
  const [near, setNear] = useState(null);
  const [aida, setAida] = useState(null);
  const [repaired, setRepaired] = useState(isStationRepaired(save));

  // The save is read by the Pixi scene every frame, so it is handed over on a
  // ref rather than through the effect's dependency list — re-initialising the
  // whole room on a currency change would restart the scene mid-walk.
  const saveRef = useRef(save);
  saveRef.current = save;

  const handleEnter = useCallback((st) => {
    if (st.id === 'exit') { onClose(); return; }
    if (st.id === 'core') {
      if (!isStationRepaired(saveRef.current)) return;   // the room does the repair itself
      setAida(AIDA_LINES[Math.floor(Math.random() * AIDA_LINES.length)]);
      return;
    }
    const built = st.module ? buildingLevel(saveRef.current, st.module) > 0 : true;
    // A locked door is not a dead end. It hands you to the module list with
    // that module in front of you — the thing you actually came to do.
    if (!built) { onBuild(st.module); return; }
    onOpen(st.module);
  }, [onOpen, onBuild, onClose]);

  useEffect(() => {
    let room = null;
    let cancelled = false;
    (async () => {
      room = new Room(canvasRef.current, {
        save: saveRef.current,
        onNear: (st) => setNear(st),
        onEnter: handleEnter,
        onRepair: () => {
          // ONE repair, shared with the module list. game/base.js owns the
          // transform; nobody re-implements "set the flag and hope".
          setSave(s => repairStation(s));
          setRepaired(true);
        },
      });
      await room.init();
      if (cancelled) { room.destroy(); return; }
      roomRef.current = room;
    })();
    return () => {
      cancelled = true;
      if (roomRef.current) { roomRef.current.destroy(); roomRef.current = null; }
      else if (room) room.destroy();
    };
    // Deliberately mounted ONCE. handleEnter is stable via useCallback and the
    // save arrives through saveRef, so nothing here should re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push save changes into the live scene instead of remounting it.
  useEffect(() => {
    if (roomRef.current) roomRef.current.setSave(save);
    setRepaired(isStationRepaired(save));
  }, [save]);

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      const r = roomRef.current;
      if (!r) return;
      if (e.code === 'Escape') { onClose(); return; }
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        if (aida) { setAida(null); return; }
        r.interact();
        return;
      }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) {
        e.preventDefault();
        r.keyDown(e.code);
      }
    };
    const up = (e) => { const r = roomRef.current; if (r) r.keyUp(e.code); };
    // A window that loses focus mid-stride keeps the key "held" forever and
    // the hero walks into a wall until you come back and press it again.
    const blur = () => { const r = roomRef.current; if (r) r.clearKeys(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [onClose, aida]);

  // ── Pointer: tap the floor to walk there ──────────────────────────
  const onPointer = (e) => {
    const r = roomRef.current;
    if (!r || aida) return;
    const rect = canvasRef.current.getBoundingClientRect();
    r.pointTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const total = Object.keys(BUILDINGS).reduce((n, id) => n + buildingLevel(save, id), 0);
  const built = near && near.module ? buildingLevel(save, near.module) > 0 : true;
  const accent = near && near.module && BUILDINGS[near.module]
    ? BUILDINGS[near.module].accent
    : near && near.id === 'exit' ? '#4dff91' : '#7cd6ff';

  // The one thing that must be unmissable before the station works.
  const repairPrompt = !repaired;

  return (
    <div className="sr-overlay" data-testid="station-room">
      <canvas
        ref={canvasRef}
        className="sr-canvas"
        onPointerDown={onPointer}
      />

      <div className="sr-head">
        <div className="sr-title">
          <GameIcon name="ui_base" size={18} /> MAIN HALL
        </div>
        <span className="sr-sub">
          {repaired ? `${total} module${total === 1 ? '' : 's'} online` : 'derelict — nothing is powered'}
        </span>
        <button className="sr-close" onClick={onClose} aria-label="Leave the station">✕</button>
      </div>

      {/* The controls, said once, quietly. A player who already knows stops
          reading it; a player who does not is never left guessing. */}
      <div className="sr-keys">
        <span><b>WASD</b> / tap the floor to walk</span>
        <span><b>E</b> to use</span>
        <span><b>ESC</b> to leave</span>
      </div>

      {/* ── The prompt ───────────────────────────────────────────────
          Only the ARMED station is named. A permanent list of every door
          would turn the room back into the menu it is supposed to replace. */}
      {near && !aida && (
        <div className={`sr-prompt${built ? '' : ' locked'}`} style={{ '--sr-accent': accent }}>
          <div className="sr-prompt-copy">
            <div className="sr-prompt-name">
              {repairPrompt && near.id === 'core' ? 'CLEAN & REPAIR STATION' : near.name}
              {!built && near.module && <span className="sr-lock"><GameIcon name="ui_lock" size={12} /> not built</span>}
            </div>
            <div className="sr-prompt-hint">
              {repairPrompt && near.id === 'core'
                ? 'Whoever lived here left in a hurry. Costs nothing but the afternoon.'
                : !built && near.module
                  ? `Raise ${BUILDINGS[near.module] ? BUILDINGS[near.module].name : 'this module'} in the module list to open this door.`
                  : near.hint}
            </div>
          </div>
          <button
            className="sr-use"
            onClick={() => roomRef.current && roomRef.current.interact()}
            data-testid="station-use"
          >
            {repairPrompt && near.id === 'core' ? '▸ REPAIR'
              : !built && near.module ? 'BUILD IT'
                : near.id === 'exit' ? 'LEAVE' : 'ENTER'}
          </button>
        </div>
      )}

      {/* ── A.I.D.A. ─────────────────────────────────────────────────
          She never gets a text box in the fiction — she draws you a
          condescending picture. This is the plate that picture sits on; the
          slideshow itself is its own build (story bible, build order 6). */}
      {aida && (
        <div className="sr-aida" onClick={() => { setAida(null); if (Audio.menuBack) Audio.menuBack(); }}>
          <div className="sr-aida-plate">
            <div className="sr-aida-eye"><i /></div>
            <div className="sr-aida-text">{aida}</div>
            <div className="sr-aida-dismiss">tap to dismiss</div>
          </div>
        </div>
      )}
    </div>
  );
}

export { STATIONS };
