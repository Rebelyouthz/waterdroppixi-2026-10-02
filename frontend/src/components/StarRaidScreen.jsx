import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StarRaidGame, STAGES, SHIP_UPGRADES, upgradeCost, SHIPS } from '../game/starRaidEngine';
import { StarRaidRenderer } from '../game/starRaidRenderer';
import { SHIP_COLORS } from '../game/data_ext';
import { rollRune } from '../game/runes';
import { raidHullMult } from '../game/base';

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

  const startRun = useCallback(() => {
    setScreen('playing');
  }, []);

  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    const game = new StarRaidGame(canvas, {
      shipLevels: sr.levels,
      shipId: sr.shipId || 'skiff',
      hullMult: raidHullMult(save),   // Hangar building
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
            if (stageIdx === STAGES.length - 1) {
              if (mode === 'rune') gotRune = rollRune();
              else gotToken = true;
            }
          }
          const newSave = {
            ...save, starRaid: newSr,
            gachaTokens: (save.gachaTokens || 0) + (gotToken ? 1 : 0),
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
  const selectShip = (id) => setSave({ ...save, starRaid: { ...sr, shipId: id } });

  if (screen === 'menu') {
    return (
      <div className="modal-overlay">
        <div className="menu" style={{ maxWidth: 480, width: '92vw', padding: 24 }} data-testid="starraid-menu">
          <div className="title">🚀 STAR RAID</div>
          <div style={{ fontFamily: 'VT323', fontSize: 15, color: 'var(--ink-dim)', margin: '8px 0 16px' }}>
            One-thumb space raid. Autofire, dodge, collect Scrap, clear all 3 stages for a Gacha Token.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {STAGES.map((s, i) => {
              const locked = i > (sr.stageUnlocked || 0);
              return (
                <button key={s.id} disabled={locked}
                  className={`go-btn ${stageIdx === i ? 'go-btn-retry' : 'go-btn-ghost'}`}
                  style={{ opacity: locked ? 0.35 : 1, flex: '1 1 30%' }}
                  onClick={() => !locked && setStageIdx(i)}>
                  {locked ? '🔒' : '▶'} {s.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className={`go-btn ${mode === 'artifact' ? 'go-btn-retry' : 'go-btn-ghost'}`} style={{ flex: 1 }}
              onClick={() => setMode('artifact')} data-testid="starraid-mode-artifact">🔶 Artifact Run</button>
            <button className={`go-btn ${mode === 'rune' ? 'go-btn-retry' : 'go-btn-ghost'}`} style={{ flex: 1 }}
              onClick={() => setMode('rune')} data-testid="starraid-mode-rune">🔮 Rune Run</button>
          </div>
          <div style={{ fontFamily: 'VT323', color: 'var(--ink-dim)', fontSize: 12, marginBottom: 10 }}>
            Clearing the final stage in this mode awards {mode === 'rune' ? 'a Rune' : 'a Gacha Token'}.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="go-btn go-btn-ghost" onClick={onExit} data-testid="starraid-exit">↩ Camp</button>
            <button className="go-btn go-btn-camp" onClick={() => setScreen('shop')} data-testid="starraid-shop">🔧 Upgrade Ship</button>
            <button className="go-btn go-btn-retry" onClick={startRun} data-testid="starraid-launch">🚀 LAUNCH</button>
          </div>
          <div style={{ marginTop: 12, fontFamily: 'VT323', color: '#ffd166' }}>⚙ Scrap: {sr.scrap || 0}</div>
        </div>
      </div>
    );
  }

  if (screen === 'shop') {
    return (
      <div className="modal-overlay">
        <div className="menu" style={{ maxWidth: 520, width: '92vw', padding: 24 }} data-testid="starraid-shop-panel">
          <div className="title">🔧 HANGAR</div>
          <div style={{ fontFamily: 'VT323', color: '#ffd166', margin: '6px 0 14px' }}>⚙ Scrap: {sr.scrap || 0}</div>

          {/* Hull roster. Upgrades below apply to whichever hull is flown, so
              switching never throws away what you have spent. */}
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

          <div style={{ fontFamily: 'VT323', color: 'var(--accent-2)', letterSpacing: '0.16em', margin: '14px 0 6px' }}>UPGRADES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '34vh', overflowY: 'auto' }}>
            {Object.entries(SHIP_UPGRADES).map(([id, u]) => {
              const lvl = sr.levels[id] || 0;
              const maxed = lvl >= u.max;
              const cost = upgradeCost(id, lvl);
              const canAfford = (sr.scrap || 0) >= cost;
              return (
                <div key={id} className="gear-popover-row" style={{ '--rc': '#4dffd4', cursor: maxed ? 'default' : 'pointer' }}>
                  <span className="gear-popover-name">{u.icon} {u.name} — Lv {lvl}/{u.max}</span>
                  {!maxed ? (
                    <button className="gear-btn equip" disabled={!canAfford} style={{ opacity: canAfford ? 1 : 0.4 }}
                      onClick={() => buyUpgrade(id)}>UPGRADE ({cost} ⚙)</button>
                  ) : (
                    <span style={{ color: '#4dff91', fontFamily: 'VT323' }}>MAX</span>
                  )}
                </div>
              );
            })}
          </div>
          <button className="go-btn go-btn-ghost" style={{ marginTop: 16, width: '100%' }} onClick={() => setScreen('menu')}>↩ Back</button>
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
            <div className="go-badges"><div className="go-badge"><span>🎰</span><b>GACHA TOKEN EARNED</b></div></div>
          )}
          {result?.gotRune && (
            <div className="go-badges"><div className="go-badge"><span>{result.gotRune.icon}</span><b>{result.gotRune.name.toUpperCase()} EARNED</b></div></div>
          )}
          <div className="go-actions">
            <button className="go-btn go-btn-ghost" onClick={onExit}>↩ Camp</button>
            <button className="go-btn go-btn-camp" onClick={() => setScreen('shop')}>🔧 Upgrade</button>
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
