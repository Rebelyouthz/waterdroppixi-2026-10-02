// =============================================
// PROCEDURAL WEBAUDIO SFX BANK — no assets, everything synthesized
// =============================================
// The old version of this file had one shoot() for every weapon in the
// game and no sound at all for five of the eight weapon behaviours
// (shockwave/scythe/orbit/beam/meteor never played anything). This version
// gives every weapon ARCHETYPE its own layered recipe — multiple
// oscillators, filtered noise, envelopes, and a little pitch shaping — and
// every one of the 38 weapons is mapped to a recipe plus a small pitch/
// timbre offset so weapons sharing an archetype still sound like
// themselves, not like copies of each other.
//
// "Real" here does not mean sampled audio — everything is still synthesis,
// same as before, just built from layered, shaped primitives instead of a
// single tone(). That's what actually reads as "not MIDI beeps": envelopes,
// noise shaped through real filters, and short layered transients, not
// bare sine/square waves.

let _ctx = null;
let _master = null;
let _muted = false;
let _sfxVol = 1.0;
let _musicVol = 0.28;
let _musicNode = null;
// Which of the three track sets is currently playing ('menu' | 'game' | 'atlas'),
// so a swap to the track that is already on can be skipped instead of restarting
// it. Null means nothing is playing.
let _musicTrack = null;
let _xpPingLastT = 0;
let _impactLastT = 0;
let _noiseBufCache = new Map();

function ctx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _master = _ctx.createGain();
      _master.gain.value = _sfxVol;
      _master.connect(_ctx.destination);
    } catch (e) { /* unsupported */ }
  }
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// Deterministic 0..1 from a string — gives every weapon id a stable little
// pitch/timbre fingerprint so two weapons sharing a recipe don't sound
// identical, without needing a hand-tuned number for each of the 38.
function hashUnit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

// ---- primitives -------------------------------------------------------

// A shaped oscillator: attack ramp, optional pitch sweep, exponential
// decay. Every tonal sound in this file is one or more of these stacked.
function osc({ type = 'sine', freq, dur, vol = 0.2, sweepTo = null, attack = 0.008, detune = 0 }) {
  const c = ctx(); if (!c || _muted) return;
  const now = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, now);
  o.detune.value = detune;
  if (sweepTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * _sfxVol), now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(_master);
  o.start(now); o.stop(now + dur + 0.02);
  return o;
}

// Filtered noise burst — the material every "crack", "hiss" and "crunch"
// in this file is built from. Cached buffer per duration since regenerating
// a noise buffer every call is the one place this system could get
// expensive with weapons firing several times a second.
function noiseBurst({ dur = 0.1, vol = 0.15, filterType = 'lowpass', freq = 1200, Q = 1, sweepTo = null, attack = 0.002 }) {
  const c = ctx(); if (!c || _muted) return;
  const now = c.currentTime;
  const key = Math.round(dur * 1000);
  let buffer = _noiseBufCache.get(key);
  if (!buffer) {
    const size = Math.max(1, Math.floor(c.sampleRate * dur));
    buffer = c.createBuffer(1, size, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    if (_noiseBufCache.size > 24) _noiseBufCache.clear(); // cheap unbounded-growth guard
    _noiseBufCache.set(key, buffer);
  }
  const src = c.createBufferSource(); src.buffer = buffer;
  const f = c.createBiquadFilter(); f.type = filterType; f.Q.value = Q;
  f.frequency.setValueAtTime(freq, now);
  if (sweepTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), now + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * _sfxVol), now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f).connect(g).connect(_master);
  src.start(now);
}

// Soft clip / drive — what makes the rank-up and big-reward fanfares read
// as "distortion" rather than a clean synth tone, per spec ("wooaaakathing"
// needs real grit, not a clean sine sweep).
function driveCurve(amount) {
  const n = 256; const curve = new Float32Array(n);
  const k = amount * 60 + 1;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}
function drivenTone({ type = 'sawtooth', freq, sweepTo, dur, vol = 0.2, drive = 0.5, attack = 0.01 }) {
  const c = ctx(); if (!c || _muted) return;
  const now = c.currentTime;
  const o = c.createOscillator(); const shaper = c.createWaveShaper(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, now);
  if (sweepTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), now + dur);
  shaper.curve = driveCurve(drive);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * _sfxVol), now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(shaper).connect(g).connect(_master);
  o.start(now); o.stop(now + dur + 0.02);
}

function chord(freqs, dur, type, vol) {
  freqs.forEach((f, i) => osc({ type, freq: f, dur, vol: vol / Math.sqrt(freqs.length), attack: 0.006 + i * 0.01 }));
}

// ---- weapon fire recipes ------------------------------------------------
// Each takes a 0..1 unit (from hashUnit(wid)) so every weapon using the
// recipe gets its own small, stable pitch/character offset instead of
// sounding identical to its siblings.

function pistolCrack(u, colorHint) {
  const p = 1 + (u - 0.5) * 0.22;
  osc({ type: 'square', freq: 640 * p, dur: 0.07, vol: 0.11, sweepTo: 300 * p, attack: 0.002 });
  noiseBurst({ dur: 0.045, vol: 0.09, filterType: 'highpass', freq: 1800, sweepTo: 3200 });
}
function revolverBoom(u) {
  const p = 1 + (u - 0.5) * 0.15;
  osc({ type: 'square', freq: 200 * p, dur: 0.12, vol: 0.16, sweepTo: 70 * p, attack: 0.002 });
  noiseBurst({ dur: 0.12, vol: 0.16, filterType: 'lowpass', freq: 1400, sweepTo: 250 });
}
function boltTwang(u) {
  const p = 1 + (u - 0.5) * 0.3;
  osc({ type: 'triangle', freq: 900 * p, dur: 0.16, vol: 0.13, sweepTo: 420 * p, attack: 0.003 });
  noiseBurst({ dur: 0.03, vol: 0.05, filterType: 'highpass', freq: 3000 });
}
function crystalPing(u) {
  const p = 1 + (u - 0.5) * 0.25;
  osc({ type: 'sine', freq: 1500 * p, dur: 0.14, vol: 0.10, attack: 0.004 });
  osc({ type: 'sine', freq: 2250 * p, dur: 0.10, vol: 0.05, attack: 0.006 });
  noiseBurst({ dur: 0.05, vol: 0.04, filterType: 'highpass', freq: 4000 });
}
function sniperCrack(u) {
  const p = 1 + (u - 0.5) * 0.12;
  noiseBurst({ dur: 0.05, vol: 0.20, filterType: 'highpass', freq: 2600, sweepTo: 5200 });
  osc({ type: 'sawtooth', freq: 140 * p, dur: 0.28, vol: 0.14, sweepTo: 40 * p, attack: 0.004 });
}
function harpoonThunk(u) {
  const p = 1 + (u - 0.5) * 0.2;
  osc({ type: 'sine', freq: 180 * p, dur: 0.18, vol: 0.16, sweepTo: 60 * p, attack: 0.003 });
  noiseBurst({ dur: 0.14, vol: 0.10, filterType: 'lowpass', freq: 900, sweepTo: 200 });
}
function energyBolt(u) {
  const p = 1 + (u - 0.5) * 0.25;
  osc({ type: 'square', freq: 320 * p, dur: 0.09, vol: 0.10, sweepTo: 1100 * p, attack: 0.003 });
  noiseBurst({ dur: 0.06, vol: 0.06, filterType: 'bandpass', freq: 2200, Q: 4 });
}
function shotgunBlast(u) {
  const p = 1 + (u - 0.5) * 0.15;
  noiseBurst({ dur: 0.16, vol: 0.22, filterType: 'lowpass', freq: 3200, sweepTo: 400 });
  osc({ type: 'square', freq: 140 * p, dur: 0.10, vol: 0.13, sweepTo: 50 * p, attack: 0.002 });
}
function bladeSlash(u) {
  const p = 1 + (u - 0.5) * 0.2;
  noiseBurst({ dur: 0.09, vol: 0.12, filterType: 'bandpass', freq: 2600 * p, Q: 2.2, sweepTo: 900 });
  osc({ type: 'triangle', freq: 700 * p, dur: 0.04, vol: 0.05, attack: 0.002 });
}
function pulseWhump(u) {
  const p = 1 + (u - 0.5) * 0.25;
  osc({ type: 'sine', freq: 110 * p, dur: 0.24, vol: 0.15, sweepTo: 45 * p, attack: 0.004 });
  noiseBurst({ dur: 0.20, vol: 0.10, filterType: 'lowpass', freq: 1000, sweepTo: 250 });
}
function droneBlip(u) {
  const p = 1 + (u - 0.5) * 0.3;
  osc({ type: 'square', freq: 1000 * p, dur: 0.045, vol: 0.07, sweepTo: 1600 * p, attack: 0.002 });
}
// The whistle plays now; the boom lands 860ms later to match the
// meteorMark particle's own 0.9s life in engine.js (both the meteor
// WEAPON and the meteor ACTIVE SKILL use that same life value) — so the
// sound and the visual impact land together instead of drifting apart.
function meteorWhistleBoom(u) {
  const p = 1 + (u - 0.5) * 0.15;
  osc({ type: 'sine', freq: 1800 * p, dur: 0.9, vol: 0.06, sweepTo: 340 * p, attack: 0.05 });
  setTimeout(() => {
    noiseBurst({ dur: 0.28, vol: 0.22, filterType: 'lowpass', freq: 900, sweepTo: 120 });
    osc({ type: 'sawtooth', freq: 90 * p, dur: 0.3, vol: 0.16, sweepTo: 30 * p, attack: 0.003 });
  }, 860);
}
function lightningCrack(u) {
  const p = 1 + (u - 0.5) * 0.2;
  noiseBurst({ dur: 0.08, vol: 0.16, filterType: 'highpass', freq: 3400, sweepTo: 6000 });
  osc({ type: 'square', freq: 2400 * p, dur: 0.06, vol: 0.08, sweepTo: 400 * p, attack: 0.001 });
  osc({ type: 'sawtooth', freq: 90 * p, dur: 0.1, vol: 0.06, sweepTo: 40 * p, attack: 0.002 });
}
function beamLock(u) {
  const p = 1 + (u - 0.5) * 0.2;
  osc({ type: 'sawtooth', freq: 500 * p, dur: 0.14, vol: 0.07, sweepTo: 900 * p, attack: 0.01 });
  noiseBurst({ dur: 0.1, vol: 0.04, filterType: 'bandpass', freq: 3000, Q: 6 });
}

// wid -> { recipe, pitch } for genuine per-weapon identity. Unlisted ids
// (evolved forms, forks, anything added later) fall back to a sensible
// default by behaviour instead of being silent — see shootFallback below.
const WID_RECIPE = {
  hydropistol: pistolCrack, hydropistol_evo: pistolCrack,
  desertEagle: revolverBoom, twinRevolvers: revolverBoom,
  bow: boltTwang,
  daggers: bladeSlash, daggers_evo: shotgunBlast,
  icespike: crystalPing, frostOrb: crystalPing, frostOrb_evo: crystalPing,
  sniperDrop: sniperCrack, stormLance: lightningCrack,
  tidalHarpoon: harpoonThunk,
  arcCaster: energyBolt, cometLauncher: meteorWhistleBoom,
  flameburst: shotgunBlast, acidSprayer: shotgunBlast, voidScatter: shotgunBlast, boneshards: shotgunBlast,
  runebolts: energyBolt, runebolts_evo: energyBolt,
  bloodscythe: pulseWhump, bloodscythe_evo: pulseWhump,
  tideWhip: bladeSlash,
  voidPulse: pulseWhump, plasmaTurret: pulseWhump, solarFlare: pulseWhump,
  emberOrbs: crystalPing, emberOrbs_evo: crystalPing, whirlwind: bladeSlash,
  voidBeam: beamLock, railgunArray: beamLock, chainlightning: lightningCrack,
  arcTesla: lightningCrack, staticField: lightningCrack,
  shrapnelMine: meteorWhistleBoom,
  droneSquad: droneBlip,
};
const BEHAVIOUR_FALLBACK = {
  projectile: pistolCrack, shotgun: shotgunBlast, aoe: pulseWhump,
  beam: beamLock, meteor: meteorWhistleBoom, chain: lightningCrack,
  orbit: crystalPing, drone: droneBlip,
};

export const Audio = {
  setMuted(m) { _muted = m; },
  setSfxVol(v) { _sfxVol = v; if (_master) _master.gain.value = v; },
  setMusicVol(v) { _musicVol = v; if (_musicNode) _musicNode.gain.value = v * 0.4; },

  // ---- weapons ----
  // wid picks the exact recipe; behaviour is only the fallback for an
  // unmapped id, so nothing added later goes silent by accident.
  shoot(wid, behaviour) {
    const c = ctx(); if (!c || _muted) return;
    const fn = (wid && WID_RECIPE[wid]) || BEHAVIOUR_FALLBACK[behaviour] || pistolCrack;
    fn(wid ? hashUnit(wid) : 0.5);
  },
  // Beam weapons don't "fire" once — they tick many times a second while
  // attached to a target, so playing a sound every tick would be a wall of
  // noise. Called only when the beam ACQUIRES a new target (engine.js
  // compares against the previous p._beamTarget), which reads as a lock-on
  // zap instead.
  beamAcquire(wid) {
    const fn = (wid && WID_RECIPE[wid]) || beamLock;
    fn(wid ? hashUnit(wid) : 0.5);
  },
  // A hit LANDING — every non-crit, non-silent damage tick used to make no
  // sound at all. Throttled hard: an AoE hitting a dozen enemies in one
  // frame must not become a wall of overlapping clicks.
  impact(behaviour) {
    const c = ctx(); if (!c || _muted) return;
    const now = c.currentTime;
    if (now - _impactLastT < 0.035) return;
    _impactLastT = now;
    const heavy = behaviour === 'aoe' || behaviour === 'meteor' || behaviour === 'chain';
    noiseBurst({ dur: heavy ? 0.05 : 0.03, vol: heavy ? 0.06 : 0.045, filterType: 'bandpass', freq: heavy ? 900 : 1800, Q: 3 });
  },
  hit()   { // player takes contact damage
    osc({ type: 'square', freq: 220, dur: 0.07, vol: 0.11, sweepTo: 110 });
    noiseBurst({ dur: 0.05, vol: 0.06, filterType: 'lowpass', freq: 700 });
  },
  // Enemy death — small/large/boss read as genuinely different weight
  // classes instead of one generic splat for everything that dies.
  kill(size = 20, isBoss = false) {
    if (isBoss) {
      noiseBurst({ dur: 0.5, vol: 0.22, filterType: 'lowpass', freq: 1200, sweepTo: 150 });
      osc({ type: 'sawtooth', freq: 130, dur: 0.5, vol: 0.16, sweepTo: 35, attack: 0.01 });
      setTimeout(() => chord([220, 165, 110], 0.5, 'triangle', 0.12), 120);
      return;
    }
    const big = size >= 30;
    noiseBurst({ dur: big ? 0.22 : 0.11, vol: big ? 0.16 : 0.11, filterType: 'lowpass', freq: big ? 900 : 1400, sweepTo: big ? 150 : 400 });
    osc({ type: 'sawtooth', freq: big ? 110 : 190, dur: big ? 0.18 : 0.09, vol: big ? 0.10 : 0.07, sweepTo: big ? 40 : 60 });
  },
  // A real multi-beat reload instead of one generic beep — scheduled
  // against the SAME phase fractions pixiRenderer's _reloadPose animates
  // against (mag drops at 0.20, fresh mag seats at 0.66, the rack runs
  // 0.66-0.86), so every beat lands on the motion that's actually
  // happening on screen at that moment.
  reloadSequence(durMs) {
    const c = ctx(); if (!c || _muted) return;
    setTimeout(() => { // B: spent mag drops free — a knock and a light rattle
      osc({ type: 'triangle', freq: 170, dur: 0.05, vol: 0.05, sweepTo: 85 });
      noiseBurst({ dur: 0.07, vol: 0.05, filterType: 'lowpass', freq: 550, sweepTo: 220 });
    }, durMs * 0.20);
    setTimeout(() => { // C→D: fresh mag seats — a sharp snap
      noiseBurst({ dur: 0.03, vol: 0.09, filterType: 'bandpass', freq: 2200, Q: 3 });
      osc({ type: 'square', freq: 520, dur: 0.04, vol: 0.05 });
    }, durMs * 0.66);
    setTimeout(() => { // D: slide racks forward — first metallic clack
      noiseBurst({ dur: 0.03, vol: 0.10, filterType: 'highpass', freq: 2600, sweepTo: 4200 });
      osc({ type: 'square', freq: 900, dur: 0.03, vol: 0.06, sweepTo: 380 });
    }, durMs * 0.75);
    setTimeout(() => { // D: slide racks back — second, slightly duller clack
      noiseBurst({ dur: 0.035, vol: 0.11, filterType: 'highpass', freq: 2300, sweepTo: 3400 });
      osc({ type: 'square', freq: 700, dur: 0.035, vol: 0.07, sweepTo: 280 });
    }, durMs * 0.86);
  },
  // A spent casing settling on the ground — small, bright, randomly
  // pitched so a rapid-fire rattle of them doesn't sound like one sample
  // repeating.
  casingLand() {
    const p = 0.85 + Math.random() * 0.4;
    noiseBurst({ dur: 0.025, vol: 0.035, filterType: 'bandpass', freq: 3200 * p, Q: 4 });
  },
  dash()  { osc({ type: 'square', freq: 1200, dur: 0.10, vol: 0.08, sweepTo: 200 }); noiseBurst({ dur: 0.08, vol: 0.05, filterType: 'highpass', freq: 2000 }); },

  // ---- elemental / status ----
  lightning() { lightningCrack(Math.random()); },
  whipCrack() { bladeSlash(0.5 + Math.random() * 0.2); noiseBurst({ dur: 0.03, vol: 0.08, filterType: 'highpass', freq: 4500 }); },
  freeze() {
    osc({ type: 'sine', freq: 1900, dur: 0.12, vol: 0.07, sweepTo: 1200, attack: 0.005 });
    osc({ type: 'sine', freq: 2600, dur: 0.09, vol: 0.04, attack: 0.008 });
  },
  burn() { noiseBurst({ dur: 0.09, vol: 0.06, filterType: 'bandpass', freq: 1600, Q: 1.5 }); },

  // ---- active skills, per id, with a sane default for anything unlisted ----
  active(id) {
    if (id === 'lightning' || id === 'chainLightning' || id === 'staticField') lightningCrack(0.5);
    else if (id === 'meteor' || id === 'meteorStrike') meteorWhistleBoom(0.5);
    else if (id === 'aegis' || id === 'shield') { chord([380, 540], 0.22, 'triangle', 0.12); }
    else if (id === 'tidalWave' || id === 'wave') { noiseBurst({ dur: 0.4, vol: 0.14, filterType: 'lowpass', freq: 700, sweepTo: 200 }); osc({ type: 'sine', freq: 140, dur: 0.4, vol: 0.1, sweepTo: 60 }); }
    else if (id === 'blink' || id === 'dash') { osc({ type: 'sine', freq: 1600, dur: 0.1, vol: 0.08, sweepTo: 400 }); }
    else { osc({ type: 'square', freq: 660, dur: 0.10, vol: 0.10, sweepTo: 900 }); noiseBurst({ dur: 0.06, vol: 0.05, filterType: 'highpass', freq: 2400 }); }
  },
  crit()  { osc({ type: 'square', freq: 1100, dur: 0.12, vol: 0.12, sweepTo: 1800 }); noiseBurst({ dur: 0.04, vol: 0.05, filterType: 'highpass', freq: 3000 }); },
  boss()  { osc({ type: 'sawtooth', freq: 80, dur: 0.6, vol: 0.15, sweepTo: 40 }); noiseBurst({ dur: 0.4, vol: 0.10, filterType: 'lowpass', freq: 400 }); },

  // ---- pickups ----
  // XP orbs scale with the orb's own size — a big drop should read as a
  // bigger moment than a trickle of small ones.
  xpPing(progress = 0, size = 1) {
    const c = ctx(); if (!c || _muted) return;
    const now = c.currentTime;
    if (now - _xpPingLastT < 0.09) return;
    _xpPingLastT = now;
    const vol = Math.min(0.32, 0.16 + size * 0.05);
    const freq = 480 + progress * 1400;
    osc({ type: 'sine', freq, dur: 0.09, vol, sweepTo: freq * 1.06, attack: 0.003 });
    if (size > 1.4) osc({ type: 'sine', freq: freq * 1.5, dur: 0.07, vol: vol * 0.4, attack: 0.005 });
  },
  gold(amount = 1) {
    const n = Math.min(3, 1 + Math.floor(amount / 40));
    for (let i = 0; i < n; i++) {
      setTimeout(() => osc({ type: 'triangle', freq: 1400 + i * 90, dur: 0.09, vol: 0.09, sweepTo: 1000, attack: 0.002 }), i * 35);
    }
  },
  heartPickup() { osc({ type: 'sine', freq: 600, dur: 0.06, vol: 0.14, sweepTo: 900 }); setTimeout(() => osc({ type: 'sine', freq: 900, dur: 0.10, vol: 0.10, sweepTo: 1200 }), 60); },
  pickup(){ osc({ type: 'sine', freq: 1320, dur: 0.06, vol: 0.08, sweepTo: 1760 }); },

  // ---- UI ----
  click() { osc({ type: 'square', freq: 880, dur: 0.05, vol: 0.08 }); },
  // Level-up card hover. Deliberately much quieter and shorter than click():
  // it fires every time the pointer crosses a card, so anything with body to
  // it turns into a rattle while you compare three of them. `rank` (0..1) is
  // the card's rarity, which pitches the tick up — a legendary announces
  // itself before you have read the plate.
  cardHover(rank = 0) {
    osc({ type: 'triangle', freq: 620 + rank * 460, dur: 0.035, vol: 0.035, attack: 0.002 });
  },
  blueprint() { osc({ type: 'triangle', freq: 523, dur: 0.10, vol: 0.10 }); setTimeout(() => osc({ type: 'triangle', freq: 1046, dur: 0.18, vol: 0.12 }), 80); },

  // ---- Profile level-up ----
  // The XP bar filling. `t` is 0..1 along the bar and pitches the tick up with
  // it, so the bar is audibly climbing rather than just rattling. A flat tick
  // repeated nine times reads as a loading spinner; a rising one reads as
  // progress, and that difference is most of the feeling.
  xpTick(t = 0) {
    osc({ type: 'square', freq: 380 + t * t * 900, dur: 0.045, vol: 0.055, attack: 0.002 });
  },
  // The bar hitting the end. Deliberately the biggest sound on the screen —
  // this is the moment the level actually happens.
  xpArrive() {
    const c = ctx(); if (!c || _muted) return;
    const now = c.currentTime;
    // Two detuned saws swept up together, then a bright triad on top. The
    // detune is what gives it width; a single oscillator sweep sounds thin no
    // matter how loud it is.
    for (const det of [0, 7]) {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(_master);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180 + det, now);
      o.frequency.exponentialRampToValueAtTime(720 + det * 4, now + 0.42);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(_sfxVol * 0.30, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
      o.start(now); o.stop(now + 0.64);
    }
    setTimeout(() => chord([659, 880, 1319], 0.34, 'triangle', 0.14), 300);
  },
  // A reward striking the portrait. Pitch climbs across the sequence so five
  // payouts in a row form a rising run instead of the same thud five times.
  rewardLand(t = 0) {
    osc({ type: 'triangle', freq: 520 + t * 520, dur: 0.09, vol: 0.13, attack: 0.002 });
    // The impact under it — short, low, no pitch content, so it reads as
    // weight rather than as a second note.
    osc({ type: 'sine', freq: 150, dur: 0.10, vol: 0.16, sweepTo: 60 });
  },
  levelUp(){ chord([523, 659, 784], 0.20, 'triangle', 0.16); },
  claimPing() {
    const c = ctx(); if (!c || _muted) return;
    const now = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(_master);
    o.type = 'sine';
    o.frequency.setValueAtTime(480, now);
    o.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    o.frequency.exponentialRampToValueAtTime(860, now + 0.26);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(_sfxVol * 0.68, now + 0.02);
    g.gain.linearRampToValueAtTime(_sfxVol * 0.5, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    o.start(now); o.stop(now + 0.32);
  },
  waterDrop() {
    osc({ type: 'sine', freq: 1800, dur: 0.22, vol: 0.16, sweepTo: 600, attack: 0.004 });
    setTimeout(() => osc({ type: 'sine', freq: 900, dur: 0.14, vol: 0.07, sweepTo: 400 }), 40);
  },

  // ---- Reload variants ------------------------------------------------------
  // One reload sound for every weapon made them all feel like the same gun.
  // Each family below is a different MECHANISM, not the same sound retuned:
  // a magazine swap, shells fed one at a time, a power cell spinning up, a
  // bowstring drawn. `reloadSequence` picks by weapon so a player switching
  // weapons hears the change before they see it.
  reloadShells(durMs) {
    const c = ctx(); if (!c || _muted) return;
    // Four shells thumbed in, unevenly spaced — a pump gun is loaded by hand
    // and a metronome would sound like a machine.
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = durMs * (0.12 + (i / n) * 0.6) + Math.random() * 40;
      setTimeout(() => {
        const p = 0.9 + Math.random() * 0.25;
        noiseBurst({ dur: 0.035, vol: 0.07, filterType: 'bandpass', freq: 1500 * p, Q: 2.5 });
        osc({ type: 'triangle', freq: 300 * p, dur: 0.04, vol: 0.05, sweepTo: 160 * p });
      }, t);
    }
    setTimeout(() => { // the pump: two heavy strokes
      noiseBurst({ dur: 0.06, vol: 0.13, filterType: 'lowpass', freq: 1800, sweepTo: 400 });
      osc({ type: 'square', freq: 220, dur: 0.05, vol: 0.09, sweepTo: 90 });
    }, durMs * 0.80);
    setTimeout(() => {
      noiseBurst({ dur: 0.055, vol: 0.12, filterType: 'lowpass', freq: 1500, sweepTo: 320 });
      osc({ type: 'square', freq: 180, dur: 0.05, vol: 0.08, sweepTo: 70 });
    }, durMs * 0.92);
  },
  reloadEnergy(durMs) {
    const c = ctx(); if (!c || _muted) return;
    setTimeout(() => { // spent cell ejects — a hiss of vented pressure
      noiseBurst({ dur: 0.16, vol: 0.07, filterType: 'highpass', freq: 2400, sweepTo: 5200 });
    }, durMs * 0.18);
    setTimeout(() => { // fresh cell seats
      osc({ type: 'square', freq: 380, dur: 0.05, vol: 0.06, sweepTo: 180 });
    }, durMs * 0.55);
    // Spin-up: a rising tone is the clearest possible "not ready ... ready".
    setTimeout(() => {
      osc({ type: 'sawtooth', freq: 180, dur: 0.30, vol: 0.07, sweepTo: 900, attack: 0.02 });
      setTimeout(() => osc({ type: 'sine', freq: 1400, dur: 0.10, vol: 0.06, sweepTo: 1900 }), 260);
    }, durMs * 0.62);
  },
  reloadBow(durMs) {
    const c = ctx(); if (!c || _muted) return;
    setTimeout(() => { // arrow drawn from the quiver
      noiseBurst({ dur: 0.09, vol: 0.05, filterType: 'bandpass', freq: 3600, Q: 1.6, sweepTo: 2200 });
    }, durMs * 0.16);
    setTimeout(() => { // nocked
      osc({ type: 'triangle', freq: 900, dur: 0.03, vol: 0.05, sweepTo: 500 });
    }, durMs * 0.52);
    setTimeout(() => { // string drawn back — creak rising in tension
      osc({ type: 'sawtooth', freq: 90, dur: 0.26, vol: 0.05, sweepTo: 170, attack: 0.04 });
      noiseBurst({ dur: 0.20, vol: 0.03, filterType: 'lowpass', freq: 700, sweepTo: 1100 });
    }, durMs * 0.62);
  },
  // Chooses a mechanism from the weapon id. Anything unrecognised keeps the
  // original magazine sound, so a new weapon is never silent.
  reloadFor(wid, durMs) {
    const id = String(wid || '');
    if (/shotgun|scatter|boneshards|flameburst|acidSprayer/i.test(id)) return this.reloadShells(durMs);
    if (/plasma|railgun|arcCaster|voidBeam|tesla|static|solarFlare|runebolts/i.test(id)) return this.reloadEnergy(durMs);
    if (/bow|harpoon|stormLance/i.test(id)) return this.reloadBow(durMs);
    return this.reloadSequence(durMs);
  },

  // ---- Toast -----------------------------------------------------------------
  // ONE notification sound for the whole game — menus and in-game alike — so
  // "something good just happened" always sounds the same wherever you are.
  // Played from pushToast() rather than from each call site, which is what
  // guarantees no reward moment can ever be silently added without it.
  //
  // Kept short and consonant on purpose: this fires often, and anything with
  // a tail or a dissonance becomes irritating by the twentieth time. A rising
  // major third is about the cheapest sound that reliably reads as "good".
  toast(tone = 'default') {
    const c = ctx(); if (!c || _muted) return;
    if (tone === 'bad' || tone === 'warn') {
      // Falls instead of rising. Same family, unmistakably not a reward.
      osc({ type: 'triangle', freq: 520, dur: 0.09, vol: 0.07, sweepTo: 380, attack: 0.003 });
      setTimeout(() => osc({ type: 'triangle', freq: 380, dur: 0.12, vol: 0.05, sweepTo: 280 }), 70);
      return;
    }
    // Gold gets a third note on top — the same phrase, more of it, so a big
    // reward is audibly bigger without being a different sound.
    const gold = tone === 'gold' || tone === 'legendary';
    osc({ type: 'triangle', freq: 660, dur: 0.10, vol: 0.075, attack: 0.003 });
    setTimeout(() => osc({ type: 'triangle', freq: 880, dur: 0.13, vol: 0.065, attack: 0.003 }), 62);
    if (gold) setTimeout(() => osc({ type: 'sine', freq: 1320, dur: 0.20, vol: 0.055, attack: 0.006 }), 130);
    // A whisper of high sparkle. Barely audible alone, but it is what makes
    // the chime feel like a reward rather than a UI beep.
    setTimeout(() => noiseBurst({ dur: 0.05, vol: 0.022, filterType: 'highpass', freq: 5200 }), 58);
  },

  // ---- Clicker ---------------------------------------------------------------
  // The well is tapped thousands of times, so the tap sound has three jobs:
  // be short, never fatigue, and never sound like the same sample twice.
  // Randomised pitch plus a randomised second plip does both cheaply.
  clickWell() {
    const p = 0.82 + Math.random() * 0.46;
    osc({ type: 'sine', freq: 1500 * p, dur: 0.07, vol: 0.075, sweepTo: 620 * p, attack: 0.002 });
    if (Math.random() < 0.55) {
      setTimeout(() => osc({ type: 'sine', freq: 900 * p, dur: 0.05, vol: 0.035, sweepTo: 420 * p }), 26);
    }
  },
  // Buying a producer should sound like machinery engaging, not like the UI
  // click — it is a different KIND of event and deserves its own voice.
  clickerBuy() {
    osc({ type: 'triangle', freq: 240, dur: 0.09, vol: 0.09, sweepTo: 420, attack: 0.003 });
    noiseBurst({ dur: 0.05, vol: 0.05, filterType: 'bandpass', freq: 1400, Q: 2 });
    setTimeout(() => osc({ type: 'sine', freq: 720, dur: 0.10, vol: 0.06, sweepTo: 1080 }), 70);
  },
  clickerMilestone() {
    chord([392, 523, 659], 0.28, 'triangle', 0.13);
    setTimeout(() => chord([523, 659, 784], 0.34, 'sine', 0.11), 150);
  },

  // ---- Star Atlas ------------------------------------------------------------
  // Cold, wide and synthetic, so the Atlas does not sound like the camp.
  atlasMove() {
    const p = 0.9 + Math.random() * 0.2;
    osc({ type: 'sine', freq: 620 * p, dur: 0.05, vol: 0.045, sweepTo: 880 * p, attack: 0.002 });
  },
  atlasSelect() {
    osc({ type: 'sine', freq: 880, dur: 0.10, vol: 0.07, sweepTo: 1320, attack: 0.003 });
    setTimeout(() => osc({ type: 'sine', freq: 1320, dur: 0.14, vol: 0.05, sweepTo: 1760 }), 60);
  },
  atlasWarp() {
    osc({ type: 'sawtooth', freq: 120, dur: 0.55, vol: 0.09, sweepTo: 1500, attack: 0.05 });
    noiseBurst({ dur: 0.5, vol: 0.07, filterType: 'highpass', freq: 800, sweepTo: 6000 });
    setTimeout(() => noiseBurst({ dur: 0.18, vol: 0.09, filterType: 'lowpass', freq: 2400, sweepTo: 300 }), 480);
  },

  // ---- Forge merge -----------------------------------------------------------
  // A merge destroys three things to make one, so it gets a sound with a
  // before and an after: metal drawn together, a strike, then the ring of the
  // result. Distinct from a purchase on purpose — you are consuming, not buying.
  mergeForge(success = true) {
    noiseBurst({ dur: 0.22, vol: 0.07, filterType: 'bandpass', freq: 900, Q: 1.2, sweepTo: 2400 });
    osc({ type: 'sawtooth', freq: 90, dur: 0.24, vol: 0.07, sweepTo: 220, attack: 0.03 });
    setTimeout(() => { // the strike
      noiseBurst({ dur: 0.09, vol: 0.18, filterType: 'bandpass', freq: 2600, Q: 2.2, sweepTo: 1200 });
      osc({ type: 'square', freq: 320, dur: 0.07, vol: 0.11, sweepTo: 120 });
    }, 250);
    setTimeout(() => {
      if (success) chord([523, 784, 1046], 0.45, 'triangle', 0.12);
      // A failed merge falls instead of rising — you must be able to tell
      // without reading the screen.
      else osc({ type: 'sawtooth', freq: 300, dur: 0.4, vol: 0.10, sweepTo: 90, attack: 0.01 });
    }, 340);
  },

  // ---- cards (Patrol encounters + Pet TCG) ----
  // A riffle: a burst of quick, randomly-timed ticks rather than one noise
  // swell — that stutter is what reads as individual cards, not a shaker.
  cardShuffle() {
    const c = ctx(); if (!c || _muted) return;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => noiseBurst({ dur: 0.02, vol: 0.05, filterType: 'bandpass', freq: 2400 + Math.random() * 1200, Q: 3 }), i * (18 + Math.random() * 14));
    }
  },
  cardLay() {
    noiseBurst({ dur: 0.03, vol: 0.07, filterType: 'bandpass', freq: 1400, Q: 2 });
    osc({ type: 'triangle', freq: 180, dur: 0.05, vol: 0.05, sweepTo: 90 });
  },
  cardFlip() { noiseBurst({ dur: 0.05, vol: 0.06, filterType: 'highpass', freq: 2000, sweepTo: 3500 }); },

  // ---- Clicker ----
  clickerTap() {
    osc({ type: 'sine', freq: 900, dur: 0.07, vol: 0.10, sweepTo: 500, attack: 0.002 });
    noiseBurst({ dur: 0.04, vol: 0.03, filterType: 'highpass', freq: 3000 });
  },

  // ---- Astro Prospector ----
  dig() { noiseBurst({ dur: 0.14, vol: 0.10, filterType: 'lowpass', freq: 800, sweepTo: 300 }); osc({ type: 'sawtooth', freq: 90, dur: 0.1, vol: 0.05, sweepTo: 50 }); },
  oreFound() { chord([700, 1050], 0.14, 'triangle', 0.12); },
  hazardAlarm() { osc({ type: 'square', freq: 220, dur: 0.16, vol: 0.13, sweepTo: 140 }); noiseBurst({ dur: 0.12, vol: 0.08, filterType: 'lowpass', freq: 500 }); },

  // ---- big dopamine moments ----
  // Profile/rank level-up: low, dips, then rises with real grit — the
  // "wooaaakathing" — not a clean sweep.
  rankUp() {
    const c = ctx(); if (!c || _muted) return;
    drivenTone({ type: 'sawtooth', freq: 90, sweepTo: 70, dur: 0.18, vol: 0.14, drive: 0.35, attack: 0.02 });
    setTimeout(() => drivenTone({ type: 'sawtooth', freq: 70, sweepTo: 900, dur: 0.55, vol: 0.20, drive: 0.55, attack: 0.03 }), 150);
    setTimeout(() => chord([523, 659, 784, 1046], 0.45, 'triangle', 0.16), 620);
    setTimeout(() => noiseBurst({ dur: 0.3, vol: 0.08, filterType: 'highpass', freq: 3000 }), 620);
  },
  // Big claim/clear moment: boss down, map stage cleared, storyline beat —
  // a short rising crash-swell, the "reward braaashing".
  rewardFanfare() {
    const c = ctx(); if (!c || _muted) return;
    drivenTone({ type: 'sawtooth', freq: 160, sweepTo: 700, dur: 0.32, vol: 0.18, drive: 0.4, attack: 0.01 });
    noiseBurst({ dur: 0.35, vol: 0.14, filterType: 'lowpass', freq: 2200, sweepTo: 600 });
    setTimeout(() => chord([392, 494, 587, 784], 0.5, 'triangle', 0.16), 220);
  },
  achievement() { chord([660, 880, 990], 0.28, 'triangle', 0.14); setTimeout(() => osc({ type: 'sine', freq: 1320, dur: 0.14, vol: 0.08, sweepTo: 1760 }), 140); },

  // ---- music (real tracks, not synthesis) ----
  _stopMusicNode() {
    if (_musicNode) {
      try { _musicNode.disconnect && _musicNode.disconnect(); } catch (e) {}
      _musicNode = null;
    }
  },
  _playUrl(url) {
    try {
      const a = new window.Audio(url);
      a.loop = true;
      a.volume = Math.max(0, Math.min(1, (_musicVol || 0.15) * 1.6));
      a.play().catch(() => {});
      _musicNode = { disconnect: () => { try { a.pause(); a.currentTime = 0; } catch (e) {} }, _mp3: a, gain: { value: a.volume } };
    } catch (e) { console.warn('[Audio] play failed', e); }
  },
  // A sequenced playlist rather than one looping track: each track plays
  // once and hands off to the next on `ended`, and the whole sequence loops
  // back to the start once it reaches the end. Used for in-game/Star Atlas
  // music — the guitar-bagpipe track first, then the two uplifting tracks,
  // same tempo, meant to follow it rather than interrupt it.
  _playPlaylist(urls) {
    if (!urls.length) return;
    let i = 0;
    const playNext = () => {
      try {
        const a = new window.Audio(urls[i]);
        a.volume = Math.max(0, Math.min(1, (_musicVol || 0.15) * 1.6));
        a.onended = () => { i = (i + 1) % urls.length; playNext(); };
        a.play().catch(() => {});
        _musicNode = {
          disconnect: () => { try { a.onended = null; a.pause(); a.currentTime = 0; } catch (e) {} },
          _mp3: a, gain: { value: a.volume },
        };
      } catch (e) { console.warn('[Audio] playlist failed', e); }
    };
    playNext();
  },
  // ---- Track assignments ----------------------------------------------------
  // Three distinct places, three distinct moods:
  //   menus     -> waterdrop.mp3, looped. Calm, and it is the game's own
  //                signature track, so the place you spend the most time
  //                sounds like the game rather than like a menu.
  //   in-game   -> a 3-track playlist. The guitar-bagpipe piece leads, then
  //                the two uplifting tracks at the same tempo follow it
  //                rather than interrupt it, and the sequence loops.
  //   Star Atlas-> menu-music.mp3, which is wide and synthetic and suits a
  //                star map far better than it suited a menu.
  MUSIC: {
    menu:  '/waterdrop.mp3',
    atlas: '/menu-music.mp3',
    game:  [
      'https://customer-assets.emergentagent.com/job_progression-warrior/artifacts/hyp8e5j4_guitarbagpipe-synapse.mp3',
      '/game-music-1.mp3',
      '/game-music-2.mp3',
    ],
  },
  startMusic() {
    const c = ctx(); if (!c || _musicNode) return;
    _musicTrack = 'menu';
    this._playUrl(this.MUSIC.menu);
  },
  swapToGameMusic() {
    if (_musicTrack === 'game' && _musicNode) return;
    _musicTrack = 'game';
    this._stopMusicNode();
    this._playPlaylist(this.MUSIC.game);
  },
  // Idempotent on purpose. The side games call this on mount so the track they
  // want is guaranteed, but they are almost always entered straight from the
  // camp where waterdrop.mp3 is already playing -- restarting it from zero on
  // every screen change made the menu music stutter back to the top constantly.
  // Guarding on the current track means "make sure this is playing" instead of
  // "start this again".
  swapToMenuMusic() {
    if (_musicTrack === 'menu' && _musicNode) return;
    _musicTrack = 'menu';
    this._stopMusicNode();
    this._playUrl(this.MUSIC.menu);
  },
  // Star Atlas gets its own call rather than borrowing the game playlist, so
  // the map has a fixed identity instead of whatever track the run happened
  // to leave playing.
  swapToAtlasMusic() {
    if (_musicTrack === 'atlas' && _musicNode) return;
    _musicTrack = 'atlas';
    this._stopMusicNode();
    this._playUrl(this.MUSIC.atlas);
  },
  stopMusic() {
    _musicTrack = null;
    if (_musicNode) { try { _musicNode.disconnect(); } catch (e) {} _musicNode = null; }
  },
};
