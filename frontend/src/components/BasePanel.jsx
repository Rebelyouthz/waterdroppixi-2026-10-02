import React, { useState } from 'react';
import { BUILDINGS, buildingLevel, buildingCost, isStationRepaired, isModuleAvailable, repairStation } from '../game/base';
import { totalBuildingLevels, campNewlyUnlocked } from '../game/campaign';
import { COMPANION_LIST, isRescued } from '../game/companions';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

// THE SPACE STATION — the camp, seen from inside it.
//
// Timmy: "lägg till så man är inne i den på nå vis i bakgrunden lixom så man ser
// innifrån en nu väldigt övergiven spacespation å repair å clean ska va första
// knappen man kan trycka på så få de se ut som de är förfallet först sen när man
// tryckt där så ska de städas upp å bli cozy hemma."
//
// So this panel has two states, and the difference between them is the point of
// the screen:
//
//   DERELICT — dark, dead lamps, a cracked viewport, dust in the air, cables
//              hanging, and everything except REPAIR untouchable.
//   REPAIRED — lamps warm, floor clean, the viewport clear onto Earth, and the
//              modules become things you can actually build.
//
// The repair is FREE and always available: it has to be, because it is the
// first thing a player touches after a run they were meant to lose.
//
// Buying a level is also the trigger for the camp unlock cascade — every
// purchase can crack open the next batch of camp menus (campaign.js's
// CAMP_UNLOCK_BATCHES), and `onUnlock` hands the newly-opened tab ids up to
// Camp.jsx so it can play the reveal banners.
export default function BasePanel({ save, setSave, onOpen, onClose, onUnlock, onWalk }) {
  const [toast, setToast] = useState('');
  const [sweeping, setSweeping] = useState(false);
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2400); };

  const repaired = isStationRepaired(save);

  const repair = () => {
    if (repaired || sweeping) return;
    // The sweep starts first and the state flips underneath it, so the interior
    // is already clean when the light passes over. The wipe REVEALS the change
    // rather than announcing one that happens after it.
    setSweeping(true);
    if (Audio.unlockReveal) Audio.unlockReveal(); else Audio.claimPing();
    setTimeout(() => {
      // The transform lives in game/base.js because the walkable room can do
      // this too (you can stand at the core and press REPAIR). One function,
      // two callers — not two copies of "set the flag and hope".
      setSave(s => repairStation(s));
      say('Station sealed. Lights are on.');
    }, 520);
    setTimeout(() => setSweeping(false), 1500);
  };

  const upgrade = (id) => {
    const lvl = buildingLevel(save, id);
    const b = BUILDINGS[id];
    if (lvl >= b.max) return;
    if (!isModuleAvailable(save, id)) return;
    const cost = buildingCost(id, lvl);
    if ((save.gold || 0) < cost.gold) { say('Not enough gold'); return; }
    if ((save.gearParts || 0) < cost.parts) { say(`Need ${cost.parts} gear parts`); return; }
    const beforeLevels = totalBuildingLevels(save);
    setSave({
      ...save,
      gold: save.gold - cost.gold,
      gearParts: save.gearParts - cost.parts,
      base: { ...(save.base || {}), [id]: lvl + 1 },
    });
    Audio.claimPing();
    say(`${b.name} is now level ${lvl + 1}`);
    const newly = campNewlyUnlocked(beforeLevels, beforeLevels + 1);
    if (newly.length && onUnlock) onUnlock(newly);
  };

  const totalLevels = totalBuildingLevels(save);

  return (
    <div className="modal-overlay" data-testid="base-panel" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className={`base-panel station${repaired ? ' repaired' : ' derelict'}${sweeping ? ' sweeping' : ''}`}>

        {/* ── THE INTERIOR ────────────────────────────────────────────
            Decoration only — the whole layer is pointer-events:none in CSS so
            it can never eat a click. Built from elements rather than one
            painted background because both states share the SAME geometry and
            only change material. That is what makes the sweep read as this room
            being cleaned, instead of a cut to a different picture. */}
        <div className="st-room" aria-hidden>
          <div className="st-backwall" />
          {/* Ribs receding toward the far end — four is enough for depth. */}
          {[0, 1, 2, 3].map(i => <div key={`r${i}`} className={`st-rib st-rib-${i}`} />)}
          {/* The viewport, with Earth in it: the planet he flew up from. */}
          <div className="st-window">
            <div className="st-stars" />
            <div className="st-earth" />
            <div className="st-glass" />
            <div className="st-crack" />
          </div>
          <div className="st-floor" />
          <div className="st-pipes" />
          {/* Derelict dressing. Kept in the DOM in both states so it can fade
              out in place rather than popping away. */}
          <div className="st-cables" />
          <div className="st-dust">
            {Array.from({ length: 14 }).map((_, i) => <i key={i} style={{ '--i': i }} />)}
          </div>
          <div className="st-lamp st-lamp-a" />
          <div className="st-lamp st-lamp-b" />
          {/* Repaired warmth: a lit strip, and a plant nobody expected to
              survive. One living thing does more for "cosy" than any amount of
              extra light. */}
          <div className="st-strip" />
          <div className="st-plant" />
          <div className="st-sweep" />
        </div>

        <div className="base-head">
          <div className="base-title"><GameIcon name="ui_base" size={22} /> SPACE STATION</div>
          <span className="base-sum">
            {repaired ? `${totalLevels} module${totalLevels === 1 ? '' : 's'} online` : 'derelict'}
          </span>
          <button className="prosp-close" onClick={onClose}>✕</button>
        </div>
        {toast && <div className="base-toast">{toast}</div>}

        {/* ── The way IN ──────────────────────────────────────────────
            This panel is the station's console. The button below is the
            station itself — the same modules, walked rather than listed.
            It is offered in BOTH states on purpose: while derelict, standing
            at the dead core and pressing REPAIR is a far better first action
            than pressing a row in a list, and it is the beat the story bible
            opens the hub with. */}
        {onWalk && (
          <button className="st-walk" onClick={onWalk} data-testid="station-walk">
            <span className="st-walk-icon"><GameIcon name="ui_base" size={18} /></span>
            <span className="st-walk-copy">
              <b>WALK THE STATION</b>
              <i>{repaired ? 'Every module you built, as a room you stand in.' : 'It is dark in there. Go and see.'}</i>
            </span>
            <span className="st-walk-go">▸</span>
          </button>
        )}

        {/* ── REPAIR — the first thing you can touch ─────────────────── */}
        <div className={`st-repair${repaired ? ' done' : ''}`}>
          {repaired ? (
            <div className="st-repair-done">
              <span className="st-ok">✓</span> Hull sealed, air holding, lights on.
            </div>
          ) : (
            <>
              <div className="st-repair-copy">
                <div className="st-repair-title">CLEAN &amp; REPAIR STATION</div>
                <div className="st-repair-sub">
                  Whoever lived here left in a hurry. Costs nothing but the afternoon.
                </div>
              </div>
              <button className="st-repair-btn" data-testid="station-repair" onClick={repair} disabled={sweeping}>
                {sweeping ? 'WORKING…' : '▸ REPAIR'}
              </button>
            </>
          )}
        </div>

        {/* Companions found in the storyline stand here once rescued — silent
            otherwise, since a slot for someone you have not met yet reads as a
            locked feature rather than a person. */}
        {repaired && (
          <div className="base-companions" data-testid="base-companions">
            {COMPANION_LIST.map(c => {
              const has = isRescued(save, c.id);
              return (
                <div key={c.id} className={`base-comp${has ? ' here' : ''}`} style={{ '--cc': c.color }}
                     title={has ? c.bio : 'Not yet found.'}>
                  <span className="base-comp-dot" />
                  <span className="base-comp-name">{has ? c.name : '???'}</span>
                  <span className="base-comp-role">{has ? c.title : 'somewhere in the story'}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="base-grid">
          {Object.values(BUILDINGS).map(b => {
            const lvl = buildingLevel(save, b.id);
            const maxed = lvl >= b.max;
            const cost = buildingCost(b.id, lvl);
            const open = isModuleAvailable(save, b.id);
            const afford = (save.gold || 0) >= cost.gold && (save.gearParts || 0) >= cost.parts;
            // The hull has no interior to walk into — it IS the interior — so it
            // never gets an ENTER. Camp.jsx's enterBuilding would otherwise fall
            // through its switch and open Meta instead, which is nonsense.
            const enterable = b.id !== 'hull' && lvl > 0;
            return (
              <div
                key={b.id}
                className={`base-card${maxed ? ' maxed' : ''}${open ? '' : ' sealed'}`}
                style={{ '--bc': b.accent }}
                data-testid={`base-card-${b.id}`}
              >
                <div className="base-card-top">
                  <GameIcon name={b.icon} tone={b.accent} size={30} />
                  <div>
                    <div className="base-card-name">{b.name}</div>
                    <div className="base-card-blurb">{b.blurb}</div>
                  </div>
                  <span className="base-card-lvl">{lvl}<i>/{b.max}</i></span>
                </div>

                <div className="base-card-effect">
                  {lvl > 0 ? b.effect(lvl) : <span className="base-card-none">not built yet</span>}
                  {!maxed && lvl > 0 && <span className="base-card-next"> → {b.effect(lvl + 1)}</span>}
                </div>

                {b.max > 1 && (
                  <div className="base-pips">
                    {Array.from({ length: b.max }).map((_, i) => (
                      <i key={i} className={i < lvl ? 'on' : ''} />
                    ))}
                  </div>
                )}

                <div className="base-card-actions">
                  {enterable && <button className="base-btn open" onClick={() => onOpen(b.id)}>ENTER</button>}
                  {maxed ? (
                    <span className="base-btn maxlbl">{b.id === 'hull' ? 'SEALED' : 'MAX'}</span>
                  ) : (
                    <button className="base-btn buy" disabled={!open || !afford} onClick={() => upgrade(b.id)}
                            data-testid={`base-up-${b.id}`}>
                      {open
                        ? <><GameIcon name="gold" size={13} /> {cost.gold}{cost.parts ? <> · <GameIcon name="ui_cog" size={13} /> {cost.parts}</> : null}</>
                        : <><GameIcon name="ui_lock" size={13} /> {repaired ? 'needs the hull' : 'station is derelict'}</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
