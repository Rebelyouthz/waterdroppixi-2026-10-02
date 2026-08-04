import React from 'react';
import { SET_INDEX } from '../game/data_ext2';

const fmt = (t) => { const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };

// Tutorial text that appears at specific time milestones
const TUTORIAL_TIPS = [
  { at: 3,  text: 'Welcome! Move with WASD, aim with the mouse, and click to fire!' },
  { at: 18, text: 'Collect XP orbs to level up and choose new cards. Passive cards boost your stats!' },
  { at: 40, text: 'Pick up gold coins to spend at the CAMP. Rare heart drops heal you!' },
  { at: 70, text: 'Watch your combo meter — build it up for bonus damage!' },
  { at: 110, text: 'After this run, visit CAMP to upgrade your Meta, Talents, and unlock new gear!' },
  { at: 160, text: 'The boss is impossible this time — use this run to learn the mechanics. Good luck!' },
];

export default function HUD({ snap, isTutorial }) {
  if (!snap) return null;
  const xpPct = (snap.xp / snap.xpToNext) * 100;
  const hpPct = (snap.hp / snap.maxHp) * 100;
  const missionTimeLeft = snap.targetDuration && snap.targetDuration < 999 ? Math.max(0, snap.targetDuration - snap.time) : null;
  const activeSets = (snap.sets || []).map(id => SET_INDEX[id]).filter(Boolean);

  // Tutorial tip to show
  const tutTip = isTutorial ? [...TUTORIAL_TIPS].reverse().find(t => snap.time >= t.at) : null;

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
      {activeSets.length > 0 && (
        <div className="hud-sets" data-testid="hud-sets">
          {activeSets.map(s => (
            <span key={s.id} className="hud-set" style={{ '--sc': s.accent }} title={`${s.name} — ${s.desc}`}>
              <i>{s.icon}</i>{s.name}
            </span>
          ))}
        </div>
      )}
      {guardianIn !== null && (
        <div className={`hud-guardian${guardianIn <= 20 ? ' imminent' : ''}`} data-testid="hud-guardian">
          <span className="hud-guardian-label">GUARDIAN IN</span>
          <span className="hud-guardian-time">
            {Math.floor(guardianIn / 60)}:{Math.floor(guardianIn % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}
      {snap.companionNpc && (
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
        <div className="hud-timer" data-testid="hud-timer">{missionTimeLeft != null ? fmt(missionTimeLeft) : fmt(snap.time)}</div>
        <div className="hud-wave">
          {snap.killGoal > 0 ? `KILLS ${snap.kills} / ${snap.killGoal}` : `WAVE ${Math.ceil(snap.time / 30)}`} · KILLS {snap.kills} · ★ {snap.gold}
          {snap.challenge && <span style={{ color: 'var(--accent)', marginLeft: 10 }}>· {snap.challenge.name}</span>}
        </div>
        <div className="hud-xpbar">
          <div className="hud-xpbar-fill" style={{ width: xpPct + '%' }} />
          <div className="hud-level">LV {snap.level}</div>
        </div>
      </div>

      {/* Pinball-style score readout — always visible, ticks up on every kill */}
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

      {/* Compact HP/XP/score readout, styled and positioned like the combo
          meter above it — down where the thumbs and eyes already are during
          play, not just up in the corner header where it's easy to stop
          noticing once the action starts. */}
      <div className="joy-stats" data-testid="joy-stats">
        <div className="joy-stat hp">
          <span className="joy-stat-label">HP</span>
          <div className="joy-stat-bar"><i style={{ width: `${Math.max(0, hpPct)}%` }} /></div>
          <span className="joy-stat-val">{Math.ceil(snap.hp)}</span>
        </div>
        <div className="joy-stat xp">
          <span className="joy-stat-label">XP</span>
          <div className="joy-stat-bar"><i style={{ width: `${Math.max(0, xpPct)}%` }} /></div>
          <span className="joy-stat-val">Lv{snap.level}</span>
        </div>
        <div className="joy-stat score">
          <span className="joy-stat-label">SCORE</span>
          <span className="joy-stat-val big">{(snap.score || 0).toLocaleString()}</span>
        </div>
      </div>

      <div className="weapon-strip">
        <div style={{ display: 'flex', gap: 8 }}>
          {snap.weapons.map(w => (
            <div className="weapon-chip" key={w.id} title={w.name}>{w.icon}<span className="lv">Lv{w.lvl}</span></div>
          ))}
        </div>
        {snap.passiveIcons && snap.passiveIcons.length > 0 && (
          <div className="passive-strip">
            {snap.passiveIcons.map((p, i) => (
              <div key={i} className="passive-chip" title={p.name}>{p.icon}</div>
            ))}
          </div>
        )}
      </div>

      {/* Active skills used to live here as a floating right-hand column.
          They now live exclusively as pods seated into the joystick bezels
          (MobileControls.jsx) so the thumb never leaves the stick — having
          them in two places meant the HUD copy was the one you could reach
          least and it crowded the top of the screen. */}

      {/* Bottom area: MAG text + HP bar (NO center active skill button) */}
      <div className="hud-bottom-stack">
        <div className="hud-mag-text">
          {snap.reloading ? <span style={{ color: 'var(--accent-2)' }}>↻ RELOADING…</span> : `MAG ${snap.mag}`}
          {snap.noHit && <span style={{ marginLeft: 12, color: 'var(--rune)' }}>👻 NO-HIT</span>}
        </div>
        <div className="hud-hp">
          <div className="hud-hp-bar">
            <div className={`hud-hp-fill${hpPct < 30 ? ' low' : ''}`} style={{ width: hpPct + '%' }} />
            <div className="hud-hp-text">{Math.max(0, Math.floor(snap.hp))} / {Math.floor(snap.maxHp)}</div>
          </div>
        </div>
        <div className="hud-stats">
          <div className="hud-stat" data-testid="fps-counter"><span className="lbl">FPS</span><span className="val">{Math.round(snap.fps)}</span></div>
        </div>
      </div>

      <div className="help">
        <b>WASD</b> move · <b>MOUSE</b> aim · <b>CLICK</b> fire<br />
        <b>R</b> reload · <b>SPACE</b> dash · <b>1-4</b> skills · <b>ESC</b> pause
      </div>

      {/* Tutorial bubble */}
      {tutTip && (
        <div style={{
          position:'fixed', bottom:120, left:'50%', transform:'translateX(-50%)',
          background:'#060410ee', border:'2px solid #4dffd4', borderRadius:8,
          padding:'10px 18px', maxWidth:420, textAlign:'center',
          fontFamily:'VT323', fontSize:16, color:'#4dffd4', letterSpacing:'0.08em',
          boxShadow:'0 0 20px #4dffd444', zIndex:2000, pointerEvents:'none',
          animation:'tutBubble 0.3s ease',
        }}>
          <div style={{ fontSize:13, color:'#4dffd488', marginBottom:2 }}>TUTORIAL</div>
          {tutTip.text}
        </div>
      )}

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
