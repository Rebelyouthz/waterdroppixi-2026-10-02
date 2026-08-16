import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StarRaidGame, STAGES, SHIP_UPGRADES, upgradeCost, SHIPS } from '../game/starRaidEngine';
import { StarRaidRenderer } from '../game/starRaidRenderer';
import { SHIP_COLORS } from '../game/data_ext';
import { rollRune } from '../game/runes';
import { raidHullMult } from '../game/base';
import { todayIdx } from '../store';
import GameIcon from './GameIcon';
import { Audio } from '../game/audio';

// Keep this the same length as STAGES (starRaidEngine.js) — a stage past
// index 2 silently reuses 'meteor' rather than erroring, since there's
// nothing at render time to flag a missing entry.
// One per stage in starRaidEngine's STAGES. Kept the same length as STAGES —
// when it grew from 3 to 7 this was left behind, so stages 4-7 all fell to the
// `|| 'meteor'` fallback and four of the seven cards were visually identical.
const STAGE_ICON = ['meteor', 'bolt', 'orb', 'shockwave', 'flare', 'bone', 'voidpulse'];
const MODE_ACCENT = { artifact: '#ffb84d', rune: '#b362ff', endless: '#4dffd4' };

// Endless mode: one artifact token per this many in-run levels, capped per
// day. A per-run cap would still reward restarting; a daily one means the
// only way to earn more is to get FURTHER, which is the point.
const ENDLESS_LEVELS_PER_TOKEN = 6;
const ENDLESS_DAILY_CAP = 3;

// Readable names for the hull modifier keys shown in the hangar.
const MOD_LABELS = {
  speed: 'thrust', fireRate: 'fire rate', maxHp: 'hull',
  dmg: 'damage', magnetR: 'pickup range', loot: 'scrap',
};

// ═══════════════════════════════════════════════════════════════════════
// STAR RAID — "Patrol minigame" from spec (named to avoid colliding with
// the existing idle-mission PATROL tab). Deliberately scoped v1:
//   BUILT now: fly + autofire + dodge, orb pickup -> Scrap, permanent ship
//   upgrades (6 stats, leveled), 3 stages within one map/theme, a boss per
//   stage, clearing the final stage awards a Gacha Token for the Artifact
//   Gacha Machine, procedural ship/enemy rendering with real engine-glow
//   lighting (waterdrop-lighting skill's pooled-sprite technique).
//   DEFERRED to a later pass (explicitly, not silently dropped): a
//   dedicated radial skill-tree UI for the upgrades above (the progression
//   itself is fully live, just via a plain upgrade list for now), the 3
//   distinct equippable ship-mod slots (homing missiles/mega bomb/
//   minigun), the companion-ship system, expansion from 3 stages to 5,
//   and raster ship/enemy sprite art (no image-generation tool available
//   in this environment — see waterdrop-lighting skill's "no hand-authored
//   art" note; ship banking left/right is delivered via rotation instead
//   of frame-swapped images, same felt effect).
// ═══════════════════════════════════════════════════════════════════════

export default function StarRaidScreen({ save, setSave, onExit }) {
  const [screen, setScreen] = useState('menu'); // 'menu' | 'shop' | 'playing' | 'result'
  const [stageIdx, setStageIdx] = useState(save.starRaid?.stageUnlocked || 0);
  // Two modes, same ship/stages/upgrades — only the final-stage-clear
  // reward differs. Per spec: "ett läge där man får runes och ett där man
  // får artifacts".
  const [mode, setMode] = useState('artifact'); // 'artifact' | 'rune'
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const rendererRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const inputRef = useRef({ x: 0, y: 0 });
  const dragAnchor = useRef(null);

  const sr = save.starRaid || { levels: {}, scrap: 0, stageUnlocked: 0 };

  // The Atlas gets its own track for as long as the screen is open, and hands
  // the menu track back on the way out. Without the cleanup the map's music
  // would follow you back into the camp.
  useEffect(() => {
    Audio.swapToAtlasMusic();
    return () => Audio.swapToMenuMusic();
  }, []);

  const startRun = useCallback(() => {
    Audio.atlasWarp();
    setScreen('playing');
  }, []);

  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    const game = new StarRaidGame(canvas, {
      shipLevels: sr.levels,
      shipId: sr.shipId || 'skiff',
      hullMult: raidHullMult(save),   // Hangar building
      endless: mode === 'endless',
      stageIdx,
      shipColor: SHIP_COLORS.find(c => c.id === save.profile?.shipColor)?.color || '#5fd6ff',
      callbacks: {
        onTick: (s) => setSnap(s),
        onGameOver: (s) => {
          const scrapEarned = s.scrap;
          const newSr = { ...sr, scrap: (sr.scrap || 0) + scrapEarned };
          let gotToken = false, gotRune = null;
          if (s.cleared) {
            const nextUnlocked = Math.max(newSr.stageUnlocked || 0, stageIdx + 1);
            newSr.stageUnlocked = Math.min(STAGES.length - 1, nextUnlocked);
            // A reward for EVERY boss cleared, not only the last stage.
            //
            // This used to require `stageIdx === STAGES.length - 1`. That was
            // survivable when there were three stages; when the roster grew to
            // seven the single rune moved from "clear stage 3" to "clear stage
            // 7" and became all but unreachable — which is exactly the "I only
            // ever get scrap" report. My own expansion caused it.
            //
            // Each stage's guardian is a checkpoint now, and later stages pay
            // better: the rune roll gets the accumulated stage index as luck,
            // so pushing deep is what buys rarity rather than just repetition.
            if (mode === 'rune') gotRune = rollRune(stageIdx * 1.5);
            else gotToken = true;
            newSr._clearedStage = stageIdx + 1;
          }
          // Endless: the deeper you get, the more you bring back — but the
          // count is capped PER DAY, not per run. Uncapped it would just be a
          // matter of replaying the same first two minutes over and over,
          // which is exactly the farm the whole mode is supposed to avoid.
          if (mode === 'endless') {
            const today = todayIdx();
            const day = newSr.endlessDay === today ? newSr : { ...newSr, endlessDay: today, endlessTokens: 0 };
            const earned = Math.floor(s.level / ENDLESS_LEVELS_PER_TOKEN);
            const room = Math.max(0, ENDLESS_DAILY_CAP - (day.endlessTokens || 0));
            const give = Math.min(earned, room);
            Object.assign(newSr, day, { endlessTokens: (day.endlessTokens || 0) + give });
            if (give > 0) gotToken = true;
            newSr._endlessGiven = give;
          }
          const newSave = {
            ...save, starRaid: newSr,
            gachaTokens: (save.gachaTokens || 0)
              + (mode === 'endless' ? (newSr._endlessGiven || 0) : (gotToken ? 1 : 0)),
            runeInventory: gotRune ? [...(save.runeInventory || []), gotRune] : (save.runeInventory || []),
          };
          setSave(newSave);
          setResult({ ...s, scrapEarned, gotToken, gotRune });
          setScreen('result');
        },
      },
    });
    const renderer = new StarRaidRenderer(canvas);
    game.renderer = renderer;
    gameRef.current = game;
    rendererRef.current = renderer;

    const onResize = () => {
      game.W = canvas.clientWidth; game.H = canvas.clientHeight;
      renderer.resize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', onResize);
    onResize();

    // Input: drag-anywhere joystick (touch) + WASD/arrows (desktop) — a
    // single control scheme, per spec "styr med 1 tumme".
    const keys = {};
    const onKeyDown = (e) => { keys[e.key.toLowerCase()] = true; };
    const onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
    const kbLoop = setInterval(() => {
      if (dragAnchor.current) return;
      let x = 0, y = 0;
      if (keys['a'] || keys['arrowleft']) x -= 1;
      if (keys['d'] || keys['arrowright']) x += 1;
      if (keys['w'] || keys['arrowup']) y -= 1;
      if (keys['s'] || keys['arrowdown']) y += 1;
      inputRef.current = { x, y };
      game.setInput(x, y);
    }, 16);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const toLocal = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    // Direct finger-follow: the ship chases wherever the finger/cursor is
    // (with an "arrive" ease handled engine-side, see setChaseTarget) rather
    // than a virtual-joystick anchor-drag — matches Sky Force Reloaded's
    // "hold your thumb down, the ship trails toward it" feel, and fixes the
    // old scheme's awkward backward/upward drag behavior (dragging back
    // toward the anchor point used to fight the joystick's deadzone).
    const onPointerDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      dragAnchor.current = true;
      const cur = toLocal(pt.clientX, pt.clientY);
      game.setChaseTarget(cur.x, cur.y);
    };
    const onPointerMove = (e) => {
      if (!dragAnchor.current) return;
      const pt = e.touches ? e.touches[0] : e;
      const cur = toLocal(pt.clientX, pt.clientY);
      game.setChaseTarget(cur.x, cur.y);
    };
    const onPointerUp = () => { dragAnchor.current = null; game.clearChaseTarget(); game.setInput(0, 0); };
    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    canvas.addEventListener('touchmove', onPointerMove, { passive: true });
    canvas.addEventListener('touchend', onPointerUp);
    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    return () => {
      clearInterval(kbLoop);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      canvas.removeEventListener('touchmove', onPointerMove);
      canvas.removeEventListener('touchend', onPointerUp);
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      game.destroy();
      renderer.destroy();
    };
  }, [screen, stageIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const buyUpgrade = (id) => {
    const lvl = sr.levels[id] || 0;
    const u = SHIP_UPGRADES[id];
    if (lvl >= u.max) return;
    const cost = upgradeCost(id, lvl);
    if ((sr.scrap || 0) < cost) return;
    setSave({ ...save, starRaid: { ...sr, scrap: sr.scrap - cost, levels: { ...sr.levels, [id]: lvl + 1 } } });
  };

  // Buying a hull also flies it — nobody buys a ship and then leaves it in
  // the hangar, and making that a second click is friction for its own sake.
  const buyShip = (s) => {
    if ((sr.scrap || 0) < s.cost) return;
    setSave({
      ...save,
      starRaid: { ...sr, scrap: sr.scrap - s.cost, ships: { ...(sr.ships || {}), [s.id]: true }, shipId: s.id },
    });
  };
  const selectShip = (id) => { Audio.atlasMove(); setSave({ ...save, starRaid: { ...sr, shipId: id } }); };

  if (screen === 'menu') {
    const curShip = SHIPS[sr.shipId || 'skiff'];
    return (
      <div className="modal-overlay">
        <div className="raid-menu" data-testid="starraid-menu">
          <div className="raid-menu-head">
            <div className="raid-menu-title"><GameIcon name="ui_rocket" size={18} /> STAR RAID</div>
            <div className="raid-menu-sub">One-thumb space raid — autofire, dodge, collect Scrap.</div>
            <div className="raid-menu-ship" style={{ '--sc': SHIP_COLORS.find(c => c.id === save.profile?.shipColor)?.color || '#5fd6ff' }}>
              Flying: <b>{curShip?.name || 'Skiff'}</b>
            </div>
          </div>

          <div className="raid-currency-row">
            {/* '⚙', not a coin icon — Scrap uses this glyph everywhere else on
                this screen (run HUD, upgrade cost, hull cost), and 'coin' is
                already Gold's icon elsewhere in the game (see GameIcon.jsx). */}
            <span className="raid-currency-chip">⚙ {sr.scrap || 0} Scrap</span>
          </div>

          <div className="raid-section-label">STAGE</div>
          <div className="raid-stage-grid">
            {STAGES.map((s, i) => {
              const locked = i > (sr.stageUnlocked || 0);
              const sel = stageIdx === i;
              return (
                <button key={s.id} disabled={locked}
                  className={`raid-stage-card${sel ? ' sel' : ''}${locked ? ' locked' : ''}`}
                  onClick={() => { if (locked) return; Audio.atlasSelect(); setStageIdx(i); }} data-testid={`starraid-stage-${i}`}>
                  {locked
                    ? <span className="raid-stage-lock"><GameIcon name="ui_lock" size={20} /></span>
                    : <GameIcon name={STAGE_ICON[i] || 'meteor'} size={22} tone={sel ? '#ffd166' : '#7cd6ff'} />}
                  <span className="raid-stage-name">{s.name}</span>
                  <span className="raid-stage-boss">{s.bossName}</span>
                </button>
              );
            })}
          </div>

          <div className="raid-section-label">MODE</div>
          <div className="raid-modes">
            {[
              ['artifact', 'gem', 'Artifact Run'],
              ['rune', 'rune', 'Rune Run'],
              ['endless', 'star', 'Endless'],
            ].map(([m, ic, label]) => (
              <button key={m} className={`raid-mode${mode === m ? ' active' : ''}`}
                      style={{ '--mc': MODE_ACCENT[m] }}
                      onClick={() => { Audio.atlasMove(); setMode(m); }} data-testid={`starraid-mode-${m}`}>
                <span className="raid-mode-icon"><GameIcon name={ic} size={20} tone={MODE_ACCENT[m]} /></span>
                <span className="raid-mode-label">{label}</span>
              </button>
            ))}
          </div>
          <div className="raid-mode-desc">
            {mode === 'endless' ? (
              <>
                No stage end — fly until you die. One artifact token per {ENDLESS_LEVELS_PER_TOKEN} levels
                reached, up to {ENDLESS_DAILY_CAP} per day
                {' '}({sr.endlessDay === todayIdx() ? (sr.endlessTokens || 0) : 0}/{ENDLESS_DAILY_CAP} claimed today).
                Getting further is the only way to earn more.
              </>
            ) : (
              <>
                Every guardian you put down awards {mode === 'rune' ? 'a Rune' : 'a Gacha Token'}.
                Deeper stages roll better.
              </>
            )}
          </div>

          <div className="raid-menu-actions">
            <button className="prosp-btn ghost" onClick={onExit} data-testid="starraid-exit">↩ Camp</button>
            <button className="prosp-btn" onClick={() => setScreen('shop')} data-testid="starraid-shop"><GameIcon name="ui_cog" size={14} /> Hangar</button>
            <button className="prosp-btn go" onClick={startRun} data-testid="starraid-launch"><GameIcon name="ui_rocket" size={14} /> LAUNCH</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'shop') {
    return (
      <div className="modal-overlay">
        <div className="raid-menu raid-shop" data-testid="starraid-shop-panel">
          <div className="raid-menu-head">
            <div className="raid-menu-title"><GameIcon name="ui_cog" size={18} /> HANGAR</div>
          </div>
          <div className="raid-currency-row">
            {/* '⚙', not a coin icon — Scrap uses this glyph everywhere else on
                this screen (run HUD, upgrade cost, hull cost), and 'coin' is
                already Gold's icon elsewhere in the game (see GameIcon.jsx). */}
            <span className="raid-currency-chip">⚙ {sr.scrap || 0} Scrap</span>
          </div>

          {/* Hull roster. Upgrades below apply to whichever hull is flown, so
              switching never throws away what you have spent. */}
          <div className="raid-section-label">HULLS</div>
          <div className="raid-hangar">
            {Object.values(SHIPS).map(s => {
              const owned = s.cost === 0 || (sr.ships || {})[s.id];
              const active = (sr.shipId || 'skiff') === s.id;
              const afford = (sr.scrap || 0) >= s.cost;
              return (
                <div key={s.id} className={`raid-hull${active ? ' active' : ''}${owned ? '' : ' locked'}`}>
                  <div className="raid-hull-name">{s.name}</div>
                  <div className="raid-hull-desc">{s.desc}</div>
                  <div className="raid-hull-mods">
                    {Object.entries(s.mods).length === 0
                      ? <span className="mod-neutral">baseline</span>
                      : Object.entries(s.mods).map(([k, v]) => (
                        <span key={k} className={k === 'guns' || v > 1 ? 'mod-up' : 'mod-down'}>
                          {k === 'guns' ? `+${v} cannon` : `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}% ${MOD_LABELS[k] || k}`}
                        </span>
                      ))}
                  </div>
                  {owned ? (
                    <button className="gear-btn equip" disabled={active} onClick={() => selectShip(s.id)}>
                      {active ? '✓ IN USE' : 'FLY THIS'}
                    </button>
                  ) : (
                    <button className="gear-btn equip" disabled={!afford} style={{ opacity: afford ? 1 : 0.4 }}
                            onClick={() => buyShip(s)}>BUY ({s.cost} ⚙)</button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="raid-section-label">UPGRADES</div>
          <div className="raid-upgrade-grid">
            {Object.entries(SHIP_UPGRADES).map(([id, u]) => {
              const lvl = sr.levels[id] || 0;
              const maxed = lvl >= u.max;
              const cost = upgradeCost(id, lvl);
              const canAfford = (sr.scrap || 0) >= cost;
              return (
                <div key={id} className={`raid-upgrade-card${maxed ? ' maxed' : ''}`}>
                  <div className="raid-upgrade-top">
                    <span className="raid-upgrade-icon">{u.icon}</span>
                    <span className="raid-upgrade-name">{u.name}</span>
                    <span className="raid-upgrade-lvl">{lvl}<i>/{u.max}</i></span>
                  </div>
                  <div className="raid-upgrade-pips">
                    {Array.from({ length: u.max }).map((_, i) => (<i key={i} className={i < lvl ? 'on' : ''} />))}
                  </div>
                  {!maxed ? (
                    <button className="prosp-btn buy" disabled={!canAfford} onClick={() => buyUpgrade(id)}>
                      ⚙ {cost}
                    </button>
                  ) : (
                    <span className="raid-upgrade-max">MAX</span>
                  )}
                </div>
              );
            })}
          </div>
          <button className="prosp-btn ghost" style={{ marginTop: 14, width: '100%' }} onClick={() => setScreen('menu')}>↩ Back</button>
        </div>
      </div>
    );
  }

  if (screen === 'result') {
    return (
      <div className="modal-overlay">
        <div className="gameover go-modern" data-testid="starraid-result">
          <div className="go-title">{result?.cleared ? 'STAGE CLEARED' : 'SHIP LOST'}</div>
          <div className="go-sub">{result?.cleared ? 'The Hull Breaker is down.' : 'Ejected. Scrap recovered from the wreck.'}</div>
          <div className="go-stats-grid">
            <div className="go-stat"><span>SCRAP</span><b>+{result?.scrapEarned || 0}</b></div>
            <div className="go-stat"><span>STAGE</span><b>{STAGES[stageIdx].name}</b></div>
          </div>
          {result?.gotToken && (
            <div className="go-badges"><div className="go-badge"><GameIcon name="cur_slot" size={16} /><b>GACHA TOKEN EARNED</b></div></div>
          )}
          {result?.gotRune && (
            <div className="go-badges"><div className="go-badge"><GameIcon name={result.gotRune.icon} size={16} /><b>{result.gotRune.name.toUpperCase()} EARNED</b></div></div>
          )}
          <div className="go-actions">
            <button className="go-btn go-btn-ghost" onClick={onExit}>↩ Camp</button>
            <button className="go-btn go-btn-camp" onClick={() => setScreen('shop')}><GameIcon name="ui_cog" size={14} /> Upgrade</button>
            <button className="go-btn go-btn-retry" onClick={() => setScreen('playing')}>↻ RETRY</button>
          </div>
        </div>
      </div>
    );
  }

  // 'playing' — reuse the main game's proven fullscreen canvas convention
  // (.game-stage is position:fixed;inset:0) instead of .app-shell, which is
  // a flex-centering wrapper meant for the menu forms and was collapsing
  // this canvas down to a small viewport.
  return (
    <div className="game-stage">
      <canvas ref={canvasRef} className="starraid-canvas" style={{ touchAction: 'none' }} />
      <div className="raid-run-hud">
        <span className="raid-run-scrap">⚙ {snap?.scrap || 0}</span>
        <span className="raid-run-lvl">LV {snap?.level || 1}</span>
      </div>
      <button className="go-btn go-btn-ghost" style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px' }}
        onClick={() => { gameRef.current && gameRef.current.destroy(); setScreen('menu'); }}>✕</button>

      {/* In-run level-up cards. The engine gates its own sim on levelUpQueue,
          so this is a real pause — the modal is not something you get shot
          through. */}
      {snap?.levelUpChoices && (
        <div className="raid-lvlup">
          <div className="raid-lvlup-head">
            <span className="raid-lvlup-kicker">SYSTEMS ONLINE</span>
            <span className="raid-lvlup-title">LEVEL {snap.level}</span>
          </div>
          <div className="raid-lvlup-cards">
            {snap.levelUpChoices.map((c) => (
              <button key={c.id} className="raid-card"
                onClick={() => { gameRef.current && gameRef.current.pickCard(c.id); }}>
                <span className="raid-card-icon">{c.icon}</span>
                <span className="raid-card-name">{c.name}</span>
                <span className="raid-card-desc">{c.desc}</span>
                <span className="raid-card-lvl">
                  {Array.from({ length: c.max }).map((_, i) => (
                    <i key={i} className={i < c.level ? 'on' : ''} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
