import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StationRoom as Room, STATIONS } from '../game/stationRoom';
import { BUILDINGS, buildingLevel, buildingCost, isStationRepaired, isModuleAvailable, repairStation, tryBuyBuilding } from '../game/base';
import { totalBuildingLevels, campNewlyUnlocked, storyBeat } from '../game/campaign';
import { getActiveAidaNode, applyAidaChoice } from '../game/aidaDialogue';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';
import AidaDialogueModal from './AidaDialogueModal';
import StationQuestBanner from './StationQuestBanner';

export default function StationRoom({ save, setSave, onOpen, onUnlock, onClose, onGather }) {
  const canvasRef = useRef(null);
  const roomRef = useRef(null);
  const [near, setNear] = useState(null);
  const [aidaNodeKey, setAidaNodeKey] = useState(null);
  const [repaired, setRepaired] = useState(isStationRepaired(save));
  const [gather, setGather] = useState(null);

  const saveRef = useRef(save);
  saveRef.current = save;

  const applyChoice = useCallback((choice) => {
    if (!choice) return;
    setSave(s => applyAidaChoice(s, choice));
  }, [setSave]);

  const handleEnter = useCallback((st) => {
    if (st.id === 'exit') { onClose(); return; }
    if (st.id === 'core') {
      if (!isStationRepaired(saveRef.current)) return;
      const activeNode = getActiveAidaNode(saveRef.current, { repairedNow: true });
      setAidaNodeKey(activeNode.id);
      return;
    }
    const built = st.module ? buildingLevel(saveRef.current, st.module) > 0 : true;
    if (!built) {
      const before = totalBuildingLevels(saveRef.current);
      const bought = tryBuyBuilding(saveRef.current, st.module);
      if (!bought.ok) {
        if (bought.reason === 'gold' || bought.reason === 'parts') {
          const beat = storyBeat(saveRef.current);
          setGather({ title: bought.title, text: bought.text, beat });
        }
        pushToast({ tone: 'default', icon: 'ui_lock', title: bought.title, text: bought.text });
        return;
      }
      setSave(bought.save);
      const newly = campNewlyUnlocked(before, before + 1);
      if (newly.length && onUnlock) onUnlock(newly);
      if (roomRef.current && roomRef.current.cheer) roomRef.current.cheer(1.6);
      if (Audio.stationBuild) Audio.stationBuild();
      else if (Audio.claimPing) Audio.claimPing();
      const hullFirst = st.module === 'hull' && (bought.save.base || {}).hull === 1;
      const hangarFirst = st.module === 'hangar' && (bought.save.base || {}).hangar === 1;
      pushToast({
        tone: 'legendary',
        icon: hullFirst || hangarFirst ? 'ui_rocket' : 'ui_base',
        title: hangarFirst
          ? 'HANGAR ONLINE — SHIP AND MAPS OPEN'
          : hullFirst
            ? 'HULL SEALED'
            : `${bought.title} ONLINE`,
        text: hangarFirst
          ? 'ENDLESS and MAPS are on the rail. CONTINUE STORY is the next planet.'
          : hullFirst
            ? 'The hall holds air. Walk the next hole, or go gather if the stores are empty.'
            : bought.text,
        key: `station:${st.module}:${(bought.save.base || {})[st.module] || 1}`,
        once: true,
      });
      return;
    }
    if (st.module === 'hull') {
      return;
    }
    onOpen(st.module);
  }, [onOpen, onUnlock, onClose]);

  useEffect(() => {
    let room = null;
    let cancelled = false;
    (async () => {
      room = new Room(canvasRef.current, {
        save: saveRef.current,
        onNear: (st) => setNear(st),
        onEnter: handleEnter,
        onRepair: () => {
          setSave(s => repairStation(s));
          setRepaired(true);
          // Trigger awakening dialogue immediately upon power restoration!
          setTimeout(() => {
            setAidaNodeKey('awakening_intro');
          }, 300);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (roomRef.current) roomRef.current.setSave(save);
    setRepaired(isStationRepaired(save));
  }, [save]);

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      const r = roomRef.current;
      if (!r) return;
      if (e.code === 'Escape') {
        if (aidaNodeKey) { setAidaNodeKey(null); return; }
        if (gather) { setGather(null); return; }
        onClose();
        return;
      }
      // While Aida is talking, the modal owns E / Space / Enter.
      if (aidaNodeKey) return;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        r.dash();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (r.nearest) r.interact();
        else r.dash();
        return;
      }
      if (e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        r.interact();
        return;
      }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) {
        e.preventDefault();
        r.keyDown(e.code);
      }
    };
    const up = (e) => { const r = roomRef.current; if (r) r.keyUp(e.code); };
    const blur = () => { const r = roomRef.current; if (r) r.clearKeys(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [onClose, aidaNodeKey, gather]);

  const onPointer = (e) => {
    const r = roomRef.current;
    if (!r || aidaNodeKey) return;
    const rect = canvasRef.current.getBoundingClientRect();
    r.pointTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const total = Object.keys(BUILDINGS).reduce((n, id) => n + buildingLevel(save, id), 0);
  const built = near && near.module ? buildingLevel(save, near.module) > 0 : true;
  const accent = near && near.module && BUILDINGS[near.module]
    ? BUILDINGS[near.module].accent
    : near && near.id === 'exit' ? '#4dff91' : '#7cd6ff';

  const repairPrompt = !repaired;
  const nearCost = near && near.module && !built
    ? buildingCost(near.module, buildingLevel(save, near.module))
    : null;
  const nearOpen = near && near.module ? isModuleAvailable(save, near.module) : true;

  return (
    <div className="sr-overlay" data-testid="station-room">
      <canvas
        ref={canvasRef}
        className="sr-canvas"
        onPointerDown={onPointer}
      />

      <div className="sr-head">
        <div className="sr-title">
          <GameIcon name="ui_base" size={18} /> ORBITAL SANCTUARY (HOME CAMP)
        </div>
        <span className="sr-sub">
          {repaired ? `${total} module${total === 1 ? '' : 's'} online · life support active` : 'derelict — unpowered'}
        </span>
        <button className="sr-close" onClick={onClose} aria-label="Leave the station">✕</button>
      </div>

      {/* Station Storyline Quest Banner */}
      <StationQuestBanner
        save={save}
        setSave={setSave}
        onTalkAida={(key) => setAidaNodeKey(key || 'ambient_greeting')}
        onCheer={() => roomRef.current && roomRef.current.cheer(1.5)}
        onGather={onGather}
      />

      {/* The controls guide */}
      <div className="sr-keys">
        <span><b>WASD</b> / tap floor to walk</span>
        <span><b>SHIFT / SPACE</b> to dash</span>
        <span><b>E</b> to use</span>
        <span><b>ESC</b> to leave</span>
      </div>

      {/* Interactive Station Action Prompt */}
      {near && !aidaNodeKey && !gather && (
        <div className={`sr-prompt${built ? '' : ' locked'}`} style={{ '--sr-accent': accent }}>
          <div className="sr-prompt-copy">
            <div className="sr-prompt-name">
              {repairPrompt && near.id === 'core' ? 'INSERT A.I.D.A. CORE & AWAKEN STATION' : near.name}
              {!built && near.module && <span className="sr-lock"><GameIcon name="ui_lock" size={12} /> not built</span>}
            </div>
            <div className="sr-prompt-hint">
              {repairPrompt && near.id === 'core'
                ? 'Central console is unpowered. Place the core to start clean and repair sequence.'
                : !built && near.module
                  ? (nearOpen
                    ? `Install ${BUILDINGS[near.module] ? BUILDINGS[near.module].name : 'this module'} right here.${nearCost ? ` ${nearCost.gold} gold${nearCost.parts ? ` · ${nearCost.parts} parts` : ''}.` : ''}`
                    : (repaired ? 'Seal the hull breaches first. Walk to the left wall.' : 'Insert the A.I.D.A. core in the middle of the hall.'))
                  : near.hint}
            </div>
          </div>
          <button
            className="sr-use"
            onClick={() => roomRef.current && roomRef.current.interact()}
            data-testid="station-use"
          >
            {repairPrompt && near.id === 'core' ? '▸ INSERT CORE & AWAKEN'
              : !built && near.module ? (nearOpen ? 'BUILD IT HERE' : 'LOCKED')
                : near.id === 'exit' ? 'LEAVE' : 'ENTER'}
          </button>
        </div>
      )}

      {gather && !aidaNodeKey && (
        <div className="sr-prompt locked" style={{ '--sr-accent': '#ffd166' }} data-testid="station-gather">
          <div className="sr-prompt-copy">
            <div className="sr-prompt-name">{gather.title}</div>
            <div className="sr-prompt-hint">
              {gather.text}
              {' '}Go out, bring salvage back, then build.
            </div>
          </div>
          {onGather ? (
            <button
              className="sr-use"
              onClick={() => onGather()}
              data-testid="station-gather-go"
            >
              ▸ GO GATHER
            </button>
          ) : (
            <button className="sr-use" onClick={() => setGather(null)}>GOT IT</button>
          )}
        </div>
      )}

      {/* Holographic A.I.D.A. NPC Dialogue Modal */}
      {aidaNodeKey && (
        <AidaDialogueModal
          nodeKey={aidaNodeKey}
          onClose={(choice) => {
            applyChoice(choice);
            setAidaNodeKey(null);
          }}
          onSelectChoice={(nextKey, choice) => {
            applyChoice(choice);
            setAidaNodeKey(nextKey);
          }}
        />
      )}
    </div>
  );
}

export { STATIONS };

