import React from 'react';
import { SET_INDEX } from '../game/data_ext2';
import { nodeObjectives } from '../game/campaign';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';

const fmt = (t) => { const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };

// ---------------------------------------------------------------------------
// In-run objective list. Same visual grammar as the camp's quest tracker — a
// checkbox that ticks and a line that draws itself through the text — because
// "a thing you were told to do is now done" should look identical whether it
// happened out here or in there. Learning one animation should cover both.
//
// Kept to the node's three objectives (kill count, hold-out, guardian) rather
// than mirroring the whole quest chain: mid-run is not where a player reads a
// list, it is where they glance. Three lines is a glance.
function ObjectiveList({ snap, node }) {
  if (!node) return null;
  const objs = nodeObjectives(node);
  const valueFor = (o) => {
    if (o.metric === 'kills') return snap.kills || 0;
    if (o.metric === 'time') return snap.time || 0;
    // The guardian objective flips only on the actual kill. `campaignBossUp`
    // means it is ALIVE and on screen, so it is explicitly not the same
    // question — reading it as done would tick the box on arrival.
    return snap.campaignBossDown ? 1 : 0;
  };
  return (
    <div className="hud-objectives" data-testid="hud-objectives">
      {objs.map(o => {
        const v = valueFor(o);
        const done = v >= o.goal;
        const pct = Math.max(0, Math.min(1, v / o.goal));
        return (
          <div key={o.id} className={`hud-obj${done ? ' done' : ''}`} data-testid={`hud-obj-${o.id}`}>
            <span className={`qt-check${done ? ' checked' : ''}`} style={{ '--qt-color': '#ffd166' }}>
              <svg viewBox="0 0 20 20" width="11" height="11">
                <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" className="qt-tick" />
              </svg>
            </span>
            <span className="hud-obj-label">{o.label}</span>
            {!done && o.metric !== 'bossKilled' && (
              <span className="hud-obj-count">
                {o.metric === 'time' ? `${Math.floor(v)}/${o.goal}s` : `${Math.floor(v)}/${o.goal}`}
              </span>
            )}
            {!done && <span className="hud-obj-bar"><i style={{ width: `${pct * 100}%` }} /></span>}
          </div>
        );
      })}
    </div>
  );
}

// Tutorial text that appears at specific time milestones. Retimed against the
// reworked wave curve, and rewritten to teach the two rules that actually
// decide whether a new player survives: keep moving, and level 4 is when the
// build starts. The last line sets the expectation the whole difficulty pass
// depends on — the first guardian is meant to beat you, several times.
const TUTORIAL_TIPS = [
  { at: 3,   text: 'Move with WASD, aim with the mouse, click to fire. Never stop moving — standing still draws them in faster.' },
  { at: 20,  text: 'XP orbs level you up and every level is a card. Cards are where your build comes from, not gear.' },
  { at: 45,  text: 'Gold is spent at CAMP between runs. Hearts heal. Both are worth stepping out of position for.' },
  { at: 75,  text: 'Level 4 opens a second weapon slot. Every fourth level after that opens another one.' },
  { at: 110, text: 'Dying is not failure here — a run that reaches the guardian still pays out two chests.' },
  { at: 150, text: 'The guardian is here, and it is stronger than you. Learn its pattern. Come back with the camp behind you.' },
];

// =============================================
// VESSEL GAUGE — one XP meter, one HP meter, built together
// =============================================
// Replaces three overlapping readouts (a wide XP bar across the top, an
// HP/XP/score strip between the sticks, and a red HP bar at the very bottom)
// with a single object: a waterdrop that fills with XP, and an HP arc bent
// around it.
//
// The drop is the game's own identity, so making it the vessel means the one
// thing you stare at all run is also the one thing that says what the game is.
// It fills, the surface sloshes with a real travelling wave, and on level-up
// it overflows with a splash — so a level is something you SEE happen down
// here rather than a number changing somewhere else.
//
// SVG rather than DOM boxes: the wave is a path that has to be re-generated
// per frame, and the HP arc is a stroked arc with a dash offset. Neither is
// expressible as a rectangle.
function VesselGauge({ hp, maxHp, xpPct, level }) {
  const [t, setT] = React.useState(0);
  const [splash, setSplash] = React.useState(0);
  const prevLevel = React.useRef(level);
  const raf = React.useRef(0);

  // The waterline animates every frame. It used to do that by calling
  // setT(performance.now()) inside requestAnimationFrame, which re-rendered
  // this component AND reconciled its ~40-node SVG sixty times a second, for
  // the entire duration of a run, on top of the snapshot-driven HUD renders.
  // On a phone that is a measurable share of the frame budget spent redrawing
  // a decorative wave.
  //
  // The wave path is now written straight to the DOM through a ref. React
  // renders this component only when the props that matter actually change
  // (fill, hp, level). The geometry the tick needs is kept on a ref so the
  // loop does not need to be torn down and recreated on every render.
  const waveRef = React.useRef(null);
  const geoRef = React.useRef(null);

  React.useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const g = geoRef.current;
      const el = waveRef.current;
      if (g && el) {
        const now = performance.now() / 1000;
        const pts = [];
        for (let i = 0; i <= 18; i++) {
          const x = g.x0 + (i / 18) * g.span;
          const y = g.waterY
            + Math.sin(i * 0.62 + now * 2.6) * g.amp
            + Math.sin(i * 0.31 - now * 1.7) * g.amp * 0.55;
          pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        el.setAttribute('d', `M ${g.x0},${g.botY + 6} L ${pts.join(' L ')} L ${g.x1},${g.botY + 6} Z`);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf.current); };
  }, []);

  // Level-up splash. Keyed off the level CHANGING rather than the fill
  // reaching 100%, because the fill resets to near-zero the same frame and a
  // "is it full?" test would miss it entirely.
  React.useEffect(() => {
    if (level > prevLevel.current) {
      setSplash(performance.now() / 1000);
    }
    prevLevel.current = level;
  }, [level]);

  // Advance `t` ONLY while a splash is playing. This used to run for the whole
  // run; the splash lasts 0.9s and happens once per level, so the loop is now
  // idle almost all of the time instead of almost none of it.
  React.useEffect(() => {
    if (!splash) return undefined;
    let alive = true;
    let id = 0;
    const tick = () => {
      if (!alive) return;
      const now = performance.now() / 1000;
      setT(now);
      if (now - splash < 0.95) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(id); };
  }, [splash]);

  const W = 132, H = 132;
  const cx = W / 2, cy = 74;          // drop centre
  const R = 30;                        // drop body radius
  const fill = Math.max(0, Math.min(1, xpPct / 100));
  const hpFrac = Math.max(0, Math.min(1, (hp || 0) / (maxHp || 1)));

  // Waterline, with the wave riding on it. Sits at the bottom when empty and
  // just over the tip when full.
  const topY = cy - R * 1.28, botY = cy + R;
  const waterY = botY - fill * (botY - topY);
  const amp = 1.6 + fill * 1.6;
  // Handed to the rAF loop above, which redraws the wave without re-rendering.
  // Written during render on purpose: it is derived state for an imperative
  // animation, not something React should reconcile.
  geoRef.current = { x0: cx - R - 4, x1: cx + R + 4, span: R * 2 + 8, waterY, botY, amp };
  // Static first frame, so the gauge is correct before the first tick lands.
  const wave = [];
  for (let i = 0; i <= 18; i++) {
    const x = cx - R - 4 + (i / 18) * (R * 2 + 8);
    wave.push(`${x.toFixed(1)},${waterY.toFixed(1)}`);
  }
  const waterPath = `M ${cx - R - 4},${botY + 6} L ${wave.join(' L ')} L ${cx + R + 4},${botY + 6} Z`;

  // The teardrop, matching the character's own silhouette (game/heroShape.js
  // uses the same control points) so the gauge and the hero read as the same
  // creature.
  const dropPath =
    `M ${cx},${cy - R * 1.28} C ${cx + R * 1.05},${cy - R * 0.4} ${cx + R * 1.05},${cy + R * 0.65} ${cx},${cy + R}` +
    ` C ${cx - R * 1.05},${cy + R * 0.65} ${cx - R * 1.05},${cy - R * 0.4} ${cx},${cy - R * 1.28} Z`;

  // HP arc: a U bent under and around the drop, opening at the top. Drawn as
  // a circle path with a dash pattern so the fill is a simple offset.
  const AR = R + 17;
  const arcLen = Math.PI * AR * 1.42;        // ~255° of sweep
  const hpDash = arcLen * hpFrac;
  const arcPath =
    `M ${cx - AR * 0.87},${cy - AR * 0.5} A ${AR} ${AR} 0 1 0 ${cx + AR * 0.87},${cy - AR * 0.5}`;

  // The level-up splash is a 0.9s one-shot, so it gets its own short-lived
  // ticker (see below) rather than keeping a frame loop alive for the whole
  // run just so this one value advances.
  const splashAge = splash ? t - splash : 99;
  const splashing = splashAge >= 0 && splashAge < 0.9;

  // Health reads RED. It was cycling green→amber→red by fraction, which meant
  // a healthy player had a green arc and no part of the HUD was the colour
  // health has always been in this game. It only brightens toward white-hot as
  // it gets critical, so the change still reads as danger.
  const hpColor = hpFrac > 0.3 ? '#e8203a' : '#ff5a5a';

  return (
    <div className="vessel-gauge" data-testid="vessel-gauge">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <clipPath id="vg-drop"><path d={dropPath} /></clipPath>
          <linearGradient id="vg-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9fe8ff" />
            <stop offset="55%" stopColor="#3aa8e0" />
            <stop offset="100%" stopColor="#1a5f96" />
          </linearGradient>
        </defs>

        {/* HP arc — track then fill */}
        <path d={arcPath} fill="none" stroke="#0a0714" strokeWidth="11" strokeLinecap="round" />
        <path d={arcPath} fill="none" stroke="#ffffff14" strokeWidth="9" strokeLinecap="round" />
        <path d={arcPath} fill="none" stroke={hpColor} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${hpDash} ${arcLen}`}
          style={{ filter: `drop-shadow(0 0 6px ${hpColor}aa)`, transition: 'stroke 240ms' }} />

        {/* Vessel */}
        <path d={dropPath} fill="#06111c" stroke="#0b1c2b" strokeWidth="3" />
        <g clipPath="url(#vg-drop)">
          <path ref={waveRef} d={waterPath} fill="url(#vg-water)" />
          {/* Crest highlight riding the same wave */}
          <polyline points={wave.join(' ')} fill="none" stroke="#dffbff" strokeWidth="1.6" opacity="0.75" />
        </g>
        <path d={dropPath} fill="none" stroke="#6fd8ff" strokeWidth="2" opacity="0.9"
          style={{ filter: 'drop-shadow(0 0 5px #4dc4ff88)' }} />
        {/* Meniscus glint */}
        <ellipse cx={cx - R * 0.34} cy={cy - R * 0.42} rx="3" ry="5" fill="#ffffff" opacity="0.5" />

        {/* "HP" bent along the top of the arc, and "XP" set into the drop
            itself in black — the two meters name themselves rather than
            needing a legend somewhere else. */}
        {/* "HP" straight across the top of the arc. The curved textPath version
            rendered off to the left — `startOffset` on a path that short is not
            worth the fragility for two characters. */}
        <text className="vg-hp-label" x={cx} y={cy - AR + 4} textAnchor="middle" fill={hpColor}>HP</text>
        <text className="vg-xp-label" x={cx} y={cy + R * 0.34} textAnchor="middle">XP</text>

        {/* Level-up splash: droplets thrown off the rim */}
        {splashing && Array.from({ length: 9 }).map((_, i) => {
          const a = -Math.PI / 2 + (i - 4) * 0.34;
          const p = splashAge / 0.9;
          const d = p * 40;
          const r = 3.2 * (1 - p);
          return (
            <circle key={i}
              cx={cx + Math.cos(a) * d}
              cy={cy - R * 1.1 + Math.sin(a) * d + p * p * 34}
              r={Math.max(0, r)} fill="#bff0ff" opacity={1 - p} />
          );
        })}
      </svg>

      {/* Level only. The raw HP number is gone — the arc already says how much
          health there is, and a second numeric readout underneath was the last
          thing still crowding the bottom edge. */}
      <div className="vg-readout">
        <span className="vg-lvl">LV {level}</span>
      </div>
    </div>
  );
}

export default function HUD({ snap, isTutorial, mission, levelUpOpen = false }) {
  // Tutorial tips go to the shared toast queue as their time arrives, rather
  // than a bubble pinned over the controls.
  //
  // Declared ABOVE the `if (!snap)` bail-out on purpose: hooks must run in
  // the same order on every render, and a hook placed after an early return
  // runs only on some of them. The effect body handles the null case instead.
  //
  // `tipsFired` is what makes this safe to drive from a per-frame value: the
  // HUD re-renders continuously during a run, so without a fired-set the same
  // tip would be re-pushed sixty times a second once its timestamp passed.
  const tipsFired = React.useRef(new Set());
  const tutTime = snap ? snap.time : 0;
  React.useEffect(() => {
    if (!isTutorial) return;
    for (const tip of TUTORIAL_TIPS) {
      if (tutTime >= tip.at && !tipsFired.current.has(tip.at)) {
        tipsFired.current.add(tip.at);
        pushToast({ tone: 'default', icon: '✦', title: 'TUTORIAL', text: tip.text });
      }
    }
  }, [tutTime, isTutorial]);

  if (!snap) return null;
  const xpPct = (snap.xp / snap.xpToNext) * 100;
  const missionTimeLeft = snap.targetDuration && snap.targetDuration < 999 ? Math.max(0, snap.targetDuration - snap.time) : null;
  const activeSets = (snap.sets || []).map(id => SET_INDEX[id]).filter(Boolean);


  // Campaign: how long until the guardian arrives. Once it is up the boss bar
  // below says everything, so the countdown gets out of the way.
  const guardianIn = snap.campaignBossAt && !snap.campaignBossUp
    ? Math.max(0, snap.campaignBossAt - snap.time)
    : null;

  const WEATHER_INFO = {
    rain:    { name: 'RAINFALL',  color: '#5fb8ff', desc: '+25% fire rate · reduced visibility' },
    drought: { name: 'DROUGHT',   color: '#ffb04d', desc: 'They move faster · gold runs richer' },
    storm:   { name: 'ION STORM', color: '#c8a0ff', desc: 'Lightning strikes at random' },
  };
  const wx = snap.weather ? WEATHER_INFO[snap.weather] : null;

  return (
    <>
      {/* Front announcement, then a small persistent tag while it lasts. */}
      {wx && snap.weatherBanner > 0 && (
        <div className="hud-weather-banner" style={{ '--wc': wx.color }} data-testid="hud-weather-banner">
          <span className="hud-wx-name">{wx.name}</span>
          <span className="hud-wx-desc">{wx.desc}</span>
        </div>
      )}
      {wx && snap.weatherBanner <= 0 && (
        <div className="hud-weather-tag" style={{ '--wc': wx.color }}>
          {wx.name} · {Math.ceil(snap.weatherT)}s
        </div>
      )}
      {/* Both hide while the level-up card modal is open. Neither is
          click-through-blocked by it (they sit above the game view, the
          modal sits above them too) so left unmodified they collide with the
          modal's own title and card row instead of dimming behind it. */}
      {!levelUpOpen && mission && mission.isCampaign && mission.node && (
        <ObjectiveList snap={snap} node={mission.node} />
      )}
      {/* All four below hide with the rest of the run HUD while the level-up
          modal is open, same reason as the mission/guardian gate above — none
          of them are click-through-blocked by the modal (they sit above the
          game view, the modal sits above them too), and the sim is fully
          paused during a level-up anyway (engine.js's update loop skips while
          levelUpQueue > 0), so nothing here is even changing underneath. */}
      {!levelUpOpen && activeSets.length > 0 && (
        <div className="hud-sets" data-testid="hud-sets">
          {activeSets.map(s => (
            <span key={s.id} className="hud-set" style={{ '--sc': s.accent }} title={`${s.name} — ${s.desc}`}>
              <i><GameIcon name={s.icon} size={14} /></i>{s.name}
            </span>
          ))}
        </div>
      )}
      {/* Stagnation warning. The engine punishes standing still by raising
          spawn rate and enemy speed (see engine.js updateStagnation); an
          unexplained difficulty spike reads as the game cheating, so it is
          shown, with the fix written on it. Only appears once the ramp is
          actually biting — a flicker every time you pause to reload would be
          noise. */}
      {!levelUpOpen && (snap.stagnation || 0) > 0.25 && (
        <div className={`hud-stagnation${snap.stagnation > 0.7 ? ' critical' : ''}`} data-testid="hud-stagnation">
          <span className="hud-stag-label">THEY ARE CLOSING IN</span>
          <div className="hud-stag-bar"><i style={{ width: `${snap.stagnation * 100}%` }} /></div>
          <span className="hud-stag-hint">KEEP MOVING</span>
        </div>
      )}
      {!levelUpOpen && snap.diffId && snap.diffId !== 'normal' && (
        <div className="hud-diff-tag" style={{ '--dc': snap.diffColor }} data-testid="hud-diff">
          {(snap.diffName || '').toUpperCase()}
        </div>
      )}
      {!levelUpOpen && guardianIn !== null && (
        <div className={`hud-guardian${guardianIn <= 20 ? ' imminent' : ''}`} data-testid="hud-guardian">
          <span className="hud-guardian-label">GUARDIAN IN</span>
          <span className="hud-guardian-time">
            {Math.floor(guardianIn / 60)}:{Math.floor(guardianIn % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}
      {!levelUpOpen && snap.companionNpc && (
        <div className={`hud-companion${!snap.companionNpc.alive ? ' down' : ''}`} data-testid="hud-companion">
          <span className="hud-companion-label">{snap.companionNpc.alive ? `PROTECT ${snap.companionNpc.name.toUpperCase()}` : `${snap.companionNpc.name.toUpperCase()} DOWN`}</span>
          <div className="hud-companion-bar"><i style={{ width: `${Math.max(0, (snap.companionNpc.hp / snap.companionNpc.maxHp) * 100)}%` }} /></div>
        </div>
      )}
      {/* Boss bar ABOVE the main hud — fixed, full width centered at very top */}
      {snap.bossActive && (
        <div className="hud-boss-bar" data-testid="hud-boss-bar">
          <div className="hud-boss-name">⚠ {snap.bossName} ⚠</div>
          <div className="hud-boss-bar-track">
            <div className="hud-boss-bar-fill" style={{ width: ((snap.bossHp / snap.bossMaxHp) * 100) + '%' }} />
          </div>
        </div>
      )}

      <div className={`hud-top${snap.bossActive ? ' boss-active' : ''}`}>
        {/* Amber under a minute, red-and-pulsing under fifteen seconds — but
            only when there is a mission clock actually counting DOWN. A free
            run's timer counts up, and colouring that red would be telling the
            player they are running out of something they are not. */}
        <div
          className={`hud-timer${missionTimeLeft != null && missionTimeLeft <= 15 ? ' is-critical'
            : missionTimeLeft != null && missionTimeLeft <= 60 ? ' is-urgent' : ''}`}
          data-testid="hud-timer"
        >
          {missionTimeLeft != null ? fmt(missionTimeLeft) : fmt(snap.time)}
        </div>
        <div className="hud-wave">
          {snap.killGoal > 0 ? `KILLS ${snap.kills} / ${snap.killGoal}` : `WAVE ${Math.ceil(snap.time / 30)}`} · KILLS {snap.kills} · ★ {snap.gold}
          {snap.challenge && <span style={{ color: 'var(--accent)', marginLeft: 10 }}>· {snap.challenge.name}</span>}
        </div>
      </div>

      {/* Score, top-centre under the wave line. The wide XP bar that used to
          run across here is gone — there is exactly one XP meter now and it
          is the droplet at the bottom. Sits below `.hud-top`, which the boss
          bar already pushes down, so a boss fight never covers it. */}
      <div className="hud-score" data-testid="hud-score">
        <span className="hud-score-label">SCORE</span>
        <span className="hud-score-value">{(snap.score || 0).toLocaleString()}</span>
      </div>

      {/* Combo meter + multiplier ladder */}
      {snap.combo > 1 && (
        <div className="combo-display" style={{ opacity: Math.min(1, snap.comboTimer) }}>
          <div className="combo-count" style={{ fontSize: snap.combo >= 20 ? 32 : snap.combo >= 10 ? 26 : 22 }}>×{snap.combo}</div>
          <div className="combo-label">COMBO</div>
          <div className="combo-bar">
            <div className="combo-fill" style={{ width: (snap.comboTimer / 1.8 * 100).toFixed(1) + '%' }} />
          </div>
          {snap.multiplier > 1 && (
            <div className="combo-multiplier" data-testid="hud-multiplier">{snap.multiplier.toFixed(1)}x SCORE</div>
          )}
        </div>
      )}

      {/* Fixed bottom-centre, right where the level-up card row sits — it has
          to hide with the rest of the run HUD (mission banner, guardian timer
          above) or its droplet and "LV"/"HP" text bleed through the modal
          backdrop and visually collide with the cards' own bottom text. */}
      {!levelUpOpen && <VesselGauge hp={snap.hp} maxHp={snap.maxHp} xpPct={xpPct} level={snap.level} />}

      <div className="weapon-strip">
        <div style={{ display: 'flex', gap: 8 }}>
          {snap.weapons.map(w => (
            <div className="weapon-chip" key={w.id} title={w.name}><GameIcon name={w.id} size={20} /><span className="lv">Lv{w.lvl}</span></div>
          ))}
        </div>
        {snap.passiveIcons && snap.passiveIcons.length > 0 && (
          <div className="passive-strip">
            {snap.passiveIcons.map((p, i) => (
              <div key={i} className="passive-chip" title={p.name}><GameIcon name={p.icon} size={18} /></div>
            ))}
          </div>
        )}
      </div>

      {/* Active skills used to live here as a floating right-hand column.
          They now live exclusively as pods seated into the joystick bezels
          (MobileControls.jsx) so the thumb never leaves the stick — having
          them in two places meant the HUD copy was the one you could reach
          least and it crowded the top of the screen. */}

      {/* The NO-HIT run badge, up with the other run state.
          Everything that used to live down here is gone. The wide red HP bar
          went first (the vessel gauge is the one and only HP readout, and two
          differently-styled bars disagreeing about the same number is worse
          than one). The RELOADING line went next — the character already
          shows its reload above its own head. The MAG count is the last to
          go: it sat bottom-centre, which is exactly where the vessel gauge
          is, so it printed straight across the gauge on a phone. The
          magazine is already legible from the character's own reload
          animation, so the readout was costing the most valuable strip of
          screen to repeat something you can already see.
          NO-HIT is different — it is a run-defining state you can lose in an
          instant, so it keeps a readout, just not one lying on top of the
          health gauge. */}
      {snap.noHit && (
        <div className="hud-nohit" data-testid="hud-nohit">👻 NO-HIT</div>
      )}
      <div className="hud-bottom-stack">
        <div className="hud-stats">
          <div className="hud-stat" data-testid="fps-counter"><span className="lbl">FPS</span><span className="val">{Math.round(snap.fps)}</span></div>
        </div>
      </div>

      <div className="help">
        <b>WASD</b> move · <b>MOUSE</b> aim · <b>CLICK</b> fire<br />
        <b>R</b> reload · <b>SPACE</b> dash · <b>1-4</b> skills · <b>ESC</b> pause
      </div>

      {/* The tutorial bubble that used to live here is gone. It was pinned at
          bottom-centre, which on a phone is exactly where the joysticks and
          the vessel gauge are — so the game's own teaching text covered the
          controls it was teaching you to use, during the only run where you
          do not yet know where anything is.
          Tips now go through the shared toast queue (see the effect above):
          same words, delivered where every other notification in the game
          already appears, and out of the thumbs' way. */}

      {/* Tier escalation banner — fires once per boss kill, see engine.js _tierBannerT */}
      {snap.tierBannerT > 0 && (
        <div className="tier-banner" style={{ opacity: Math.min(1, snap.tierBannerT) }} data-testid="tier-banner">
          <div className="tier-banner-num">TIER {snap.enemyTier}</div>
          <div className="tier-banner-sub">NOW ACTIVATED — enemies level up. It's getting harder. Be ready.</div>
        </div>
      )}

      {/* Tutorial banner */}
      {isTutorial && (
        <div style={{
          position:'fixed', top:8, left:'50%', transform:'translateX(-50%)',
          background:'#4dffd411', border:'1px solid #4dffd444', borderRadius:4,
          padding:'2px 14px', fontFamily:'VT323', fontSize:13, color:'#4dffd4',
          letterSpacing:'0.15em', zIndex:1500, pointerEvents:'none',
        }}>
          ✦ TUTORIAL RUN ✦
        </div>
      )}
    </>
  );
}
