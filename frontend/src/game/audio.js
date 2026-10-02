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
let _activeAudioElements = new Set();
let _currentUrl = null;
// Which of the three track sets is currently playing ('menu' | 'game' | 'atlas'),
// so a swap to the track that is already on can be skipped instead of restarting
// it. Null means nothing is playing.
let _musicTrack = null;
let _xpPingLastT = 0;
let _impactLastT = 0;
let _shotSampleT = 0;
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

// ============================================================
// SAMPLE LAYER — Timmy's own recordings
// ============================================================
// Everything above this point is SYNTHESISED: oscillators, noise buffers, a
// waveshaper. That is why the game sounded like a chiptune of itself. Timmy put
// 38 real recordings in `Sounds/` and asked for them to be used — water drops,
// bubbles, a UI click, and ten sci-fi weapon takes.
//
// They play through `_master`, NOT through their own output, so the existing
// SFX slider already controls them and there is one gain stage rather than two
// that disagree. (The music path deliberately still uses HTMLAudio elements —
// streaming a 9MB track through WebAudio would decode the whole thing into
// memory first.)
//
// Three rules from the audio-design skill, all of which this project needed:
//   · rotate through a POOL, never replay one file — that is the "machine gun"
//     repeat that makes a click sound like a rattle after ten presses
//   · never pick the same take twice in a row, which random alone will do
//   · wobble the pitch a few percent, so even a repeat is not identical
//
// Loading is LAZY and failure is SILENT-BUT-SAFE: if a file is missing the
// caller falls back to the synth it used before, so a bad path degrades to the
// old sound rather than to nothing.
const SOUND_BASE = (process.env.PUBLIC_URL || '') + '/sounds/';
const SAMPLE_POOLS = {
  ui:     ['ui-1.mp3'],
  drop:   ['drop-1.mp3', 'drop-2.wav', 'drop-3.wav', 'drop-4.wav', 'drop-5.wav',
           'drop-6.wav', 'drop-7.wav', 'drop-8.wav', 'drop-9.wav', 'drop-10.wav',
           'drop-11.wav', 'drop-12.wav', 'drop-13.wav', 'drop-14.wav', 'drop-15.wav',
           'drop-16.wav', 'drop-17.wav', 'drop-18.wav'],
  bubble: ['bubble-1.wav', 'bubble-2.wav', 'bubble-3.wav'],
  weapon: ['weapon-1.wav', 'weapon-2.wav', 'weapon-3.wav', 'weapon-4.wav',
           'weapon-5.wav', 'weapon-6.wav', 'weapon-7.wav', 'weapon-8.wav',
           'weapon-9.wav', 'weapon-10.wav', 'weapon-11.wav', 'weapon-12.wav'],
  misc:   ['misc-1.wav', 'misc-2.wav', 'misc-3.wav'],
  campStep: ['camp-step-1.wav', 'camp-step-2.wav', 'camp-step-3.wav', 'camp-step-4.wav'],
  campNav:  ['camp-nav-radar.wav'],
  campForge:['camp-forge-strike.wav'],
  campAida: ['camp-aida-chime.wav'],
  campBio:  ['camp-biolab-bubble.wav'],
  campWell: ['camp-well-splash.wav'],
  campHangar:['camp-hangar-door.wav'],
  campDef:  ['camp-defense-lock.wav'],
  campPortal:['camp-portal-warp.wav'],
  campRelay:['camp-power-relay-1.wav', 'camp-power-relay-2.wav', 'camp-power-relay-3.wav'],
  campAidaVoice: ['camp-aida-voice-1.wav', 'camp-aida-voice-2.wav', 'camp-aida-voice-3.wav'],
  campShutter: ['camp-shutter-open.wav'],
  campBuild: ['camp-build-complete.wav'],
  campSparks: ['camp-sparks.wav'],
  campSteam: ['camp-steam-release.wav'],
};
const _buf = new Map();      // filename -> AudioBuffer | 'loading' | 'failed'
const _lastPick = new Map(); // pool -> last index played

function loadSample(name) {
  if (_buf.has(name)) return;
  const c = ctx();
  if (!c) return;
  _buf.set(name, 'loading');
  fetch(SOUND_BASE + name)
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then(ab => c.decodeAudioData(ab))
    .then(b => _buf.set(name, b))
    .catch(() => _buf.set(name, 'failed'));
}

/** Play one take from a pool. Returns false if nothing was ready, so the caller
 *  can fall back to its synth voice rather than going silent. */
function sample(pool, opts = {}) {
  const list = SAMPLE_POOLS[pool];
  if (!list || !list.length) return false;
  const c = ctx();
  if (!c) return false;
  // Warm the whole pool on first touch — one fetch each, then never again.
  for (const n of list) loadSample(n);

  // `pick` forces a specific take. Weapons use it so one gun always has one
  // voice — a rifle that draws a different sample every shot has no identity,
  // which is the opposite of what the per-weapon synth recipes are for.
  let idx;
  if (opts.pick != null) {
    idx = Math.abs(Math.round(opts.pick)) % list.length;
  } else {
    // Otherwise: random, but never the same take twice running. Pure random
    // repeats often enough to be heard as a stutter.
    idx = Math.floor(Math.random() * list.length);
    if (list.length > 1 && idx === _lastPick.get(pool)) idx = (idx + 1) % list.length;
    _lastPick.set(pool, idx);
  }

  const b = _buf.get(list[idx]);
  if (!b || b === 'loading' || b === 'failed') return false;

  const src = c.createBufferSource();
  src.buffer = b;
  const { vol = 0.5, pitch = 0.06, rate = 1 } = opts;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * pitch);
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(_master);
  src.start();
  // One-shots are freed by the graph once they end; disconnecting explicitly
  // stops the node hanging around if the tab is backgrounded mid-play.
  src.onended = () => { try { g.disconnect(); } catch (e) {} };
  return true;
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

const rawAudio = {
  setMuted(m) {
    _muted = m;
    const vol = m ? 0 : Math.max(0, Math.min(1, (_musicVol || 0.15) * 1.6));
    for (const a of _activeAudioElements) {
      try { a.volume = vol; } catch (e) {}
    }
    if (_master) _master.gain.value = m ? 0 : _sfxVol;
  },
  setSfxVol(v) { _sfxVol = v; if (_master) _master.gain.value = _muted ? 0 : v; },
  setMusicVol(v) {
    _musicVol = v;
    const vol = _muted ? 0 : Math.max(0, Math.min(1, (v || 0.15) * 1.6));
    for (const a of _activeAudioElements) {
      try { a.volume = vol; } catch (e) {}
    }
    if (_musicNode && _musicNode.gain) _musicNode.gain.value = vol;
  },

  // ---- weapons ----
  // wid picks the exact recipe; behaviour is only the fallback for an
  // unmapped id, so nothing added later goes silent by accident.
  shoot(wid, behaviour) {
    const c = ctx(); if (!c || _muted) return;
    const fn = (wid && WID_RECIPE[wid]) || BEHAVIOUR_FALLBACK[behaviour] || pistolCrack;
    fn(wid ? hashUnit(wid) : 0.5);
    // A real recording layered UNDER the synth, not instead of it. The synth
    // recipe is what gives each of the 39 weapons its own voice; the sample is
    // what gives it a body. `pick` is derived from the weapon id, so one gun
    // keeps one take forever while the pitch still wobbles per shot.
    //
    // RATE LIMITED, and it has to be: an SMG fires nine times a second and
    // nine overlapping recordings is a wall, not a weapon.
    const now = c.currentTime;
    if (now - _shotSampleT > 0.055) {
      _shotSampleT = now;
      sample('weapon', {
        vol: 0.20,
        pitch: 0.07,
        pick: wid ? Math.floor(hashUnit(wid) * 997) : 0,
      });
    }
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
    // +25%, Timmy 2026-08-19: "höjj volymen på ta xp kristaller me 25% så man
    // hör det bättre". Both the base AND the ceiling move, or a big orb would
    // hit the old 0.32 cap and the raise would apply only to small ones — which
    // is backwards, since the big pickups are the ones worth hearing.
    const vol = Math.min(0.40, 0.20 + size * 0.0625);
    const freq = 480 + progress * 1400;
    osc({ type: 'sine', freq, dur: 0.09, vol, sweepTo: freq * 1.06, attack: 0.003 });
    if (size > 1.4) osc({ type: 'sine', freq: freq * 1.5, dur: 0.07, vol: vol * 0.4, attack: 0.005 });
  },
  // Timmy asked for a coin "pling" on gold as if there were none. There WAS
  // one — it was just inaudible next to everything around it: a lone triangle
  // at vol 0.09, against xpPing's 0.20-0.40, under combat. So this is not a new
  // sound, it is the existing one made to actually read as metal.
  //
  // A coin is TWO things at once: a bright inharmonic strike, and a ringing
  // body that decays slower. One oscillator can only ever be a beep. The pair
  // an octave-and-a-fifth apart (x2.99) is what the ear hears as struck metal
  // rather than as a tone.
  gold(amount = 1) {
    const n = Math.min(3, 1 + Math.floor(amount / 40));
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const f = 1480 + i * 110;
        // The strike: short, bright, slightly detuned upward.
        osc({ type: 'triangle', freq: f, dur: 0.07, vol: 0.17, sweepTo: f * 0.72, attack: 0.001 });
        // The ring: quieter, higher, and it outlives the strike. This is the
        // part that makes it a coin instead of a click.
        osc({ type: 'sine', freq: f * 2.99, dur: 0.20, vol: 0.075, sweepTo: f * 2.7, attack: 0.002 });
      }, i * 42);
    }
  },
  heartPickup() { osc({ type: 'sine', freq: 600, dur: 0.06, vol: 0.14, sweepTo: 900 }); setTimeout(() => osc({ type: 'sine', freq: 900, dur: 0.10, vol: 0.10, sweepTo: 1200 }), 60); },
  pickup(){ osc({ type: 'sine', freq: 1320, dur: 0.06, vol: 0.08, sweepTo: 1760 }); },

  // ---- UI ----
  // Timmy's own bubbly UI take, with the synth blip as the fallback for the
  // first press or two while it decodes. Every button in the game goes through
  // here, so this one line is most of "ljud på varje meny".
  click(kind) {
    const K = {
      buy:     { rate: 1.18, freq: 1040, vol: 0.46 },
      back:    { rate: 0.82, freq: 620,  vol: 0.38 },
      danger:  { rate: 0.62, freq: 280,  vol: 0.50 },
      confirm: { rate: 1.08, freq: 980,  vol: 0.44 },
      heavy:   { rate: 0.70, freq: 360,  vol: 0.48 },
    };
    const k = K[kind] || { rate: 1, freq: 880, vol: 0.42 };
    if (!sample('ui', { vol: k.vol, pitch: 0.04, rate: k.rate })) {
      osc({ type: kind === 'danger' ? 'sawtooth' : 'square', freq: k.freq, dur: 0.05, vol: 0.08 });
    }
  },
  // Level-up card hover. Deliberately much quieter and shorter than click():
  // it fires every time the pointer crosses a card, so anything with body to
  // it turns into a rattle while you compare three of them. `rank` (0..1) is
  // the card's rarity, which pitches the tick up — a legendary announces
  // itself before you have read the plate.
  cardHover(rank = 0) {
    osc({ type: 'triangle', freq: 620 + rank * 460, dur: 0.035, vol: 0.035, attack: 0.002 });
  },
  blueprint() { osc({ type: 'triangle', freq: 523, dur: 0.10, vol: 0.10 }); setTimeout(() => osc({ type: 'triangle', freq: 1046, dur: 0.18, vol: 0.12 }), 80); },
  // ---- The comic-book intro -----------------------------------------------
  // A panel SLAMMING onto the page. Three layers, because one thud reads as a
  // UI click rather than as paper hitting a table: a low body you feel, a
  // mid-range crack that carries the edge of the frame, and a short paper
  // rustle on top. Pitched DOWN as the sequence advances (p falls with the
  // panel index) so six slams in a row build instead of repeating - the same
  // reason a drum fill descends.
  comicSlam(i = 0) {
    const p = Math.max(0.62, 1 - i * 0.075);
    osc({ type: 'sine', freq: 96 * p, dur: 0.30, vol: 0.20, sweepTo: 38 * p, attack: 0.002 });
    osc({ type: 'square', freq: 240 * p, dur: 0.07, vol: 0.09, sweepTo: 90 * p, attack: 0.001 });
    noiseBurst({ dur: 0.13, vol: 0.17, filterType: 'lowpass', freq: 2600, sweepTo: 320 });
    noiseBurst({ dur: 0.05, vol: 0.06, filterType: 'highpass', freq: 3800, sweepTo: 6200 });
  },
  // The title card landing. Heavier and slower than a panel: this one is the
  // full stop at the end of the sequence.
  comicTitle() {
    osc({ type: 'sine', freq: 70, dur: 0.70, vol: 0.24, sweepTo: 28, attack: 0.003 });
    noiseBurst({ dur: 0.34, vol: 0.18, filterType: 'lowpass', freq: 1800, sweepTo: 180 });
    setTimeout(() => chord([392, 523, 659], 0.55, 'triangle', 0.10), 120);
  },

  // ---- Menu navigation: the waterdrop, going two directions ----------------
  // Timmy, 2026-08-17: "standar ljud för klick på back i meny de ska höras på
  // pitchen i vattendroppen som ska låta att man går bakåt å när man går in i
  // menyer ska de va tvärs om höras att man får upp nå nytt".
  //
  // Both are built on `waterDrop()`'s timbre on purpose — sine, a fast pitch
  // sweep, a smaller second droplet trailing it — so the game's navigation
  // shares one voice and the DIRECTION of the sweep carries the meaning.
  // That is why this is two functions and not one with a sign flip: forward
  // has to be brighter and open OUT, back has to be darker, shorter and close
  // DOWN. A single sweep reversed just sounds like tape running backwards.

  // Going deeper / opening something. Rises and lands bright — "new thing".
  menuOpen() {
    osc({ type: 'sine', freq: 520, dur: 0.20, vol: 0.13, sweepTo: 1500, attack: 0.006 });
    // The satellite droplet, higher and later — this is what makes it read
    // as water rather than as a UI blip.
    setTimeout(() => osc({ type: 'sine', freq: 1200, dur: 0.13, vol: 0.06, sweepTo: 2050, attack: 0.004 }), 55);
    // Air on top: inaudible alone, obvious by its absence.
    setTimeout(() => noiseBurst({ dur: 0.09, vol: 0.028, filterType: 'highpass', freq: 3600, sweepTo: 6800 }), 40);
  },

  // Backing out. Falls, shorter, with a soft low settle under it — the drop
  // landing rather than lifting. Deliberately quieter than menuOpen: backing
  // out happens far more often, and a loud one becomes a nag.
  menuBack() {
    osc({ type: 'sine', freq: 1150, dur: 0.16, vol: 0.10, sweepTo: 360, attack: 0.003 });
    setTimeout(() => osc({ type: 'sine', freq: 520, dur: 0.12, vol: 0.05, sweepTo: 210, attack: 0.003 }), 45);
    // The settle — no pitch content, so it reads as weight, not a note.
    setTimeout(() => osc({ type: 'sine', freq: 150, dur: 0.11, vol: 0.07, sweepTo: 70 }), 60);
  },

  // ---- Menu / feature UNLOCKED ---------------------------------------------
  // Timmy, 2026-08-17: every "UNLOCKED" reveal shares one sound —
  // "shysst juice gärna me ljud samma på alla dom när dom visas".
  //
  // Deliberately the most ceremonial sound in the game, and deliberately
  // NOT levelUp() or achievement(): those fire many times per session, and
  // reusing one here would make opening a whole new part of the game feel
  // like picking up a coin. This is heard a handful of times per save.
  //
  // Structure: a low swell that arrives BEFORE the banner is readable
  // (anticipation), a bright triad on the beat the logo lands, then a long
  // shimmer so it rings out under the text instead of stopping dead.
  unlockReveal() {
    const c = ctx(); if (!c || _muted) return;
    const now = c.currentTime;

    // 1. the swell — two detuned saws rising. The detune gives it width;
    //    a single oscillator sounds thin no matter how loud it is.
    for (const det of [0, 9]) {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(_master);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110 + det, now);
      o.frequency.exponentialRampToValueAtTime(440 + det * 3, now + 0.5);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(_sfxVol * 0.20, now + 0.34);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      o.start(now); o.stop(now + 0.74);
    }
    // 2. the arrival — bright triad on the beat the logo lands.
    setTimeout(() => {
      chord([523, 659, 784, 1047], 0.75, 'triangle', 0.15);
      noiseBurst({ dur: 0.10, vol: 0.07, filterType: 'highpass', freq: 3000, sweepTo: 7000 });
      osc({ type: 'sine', freq: 160, dur: 0.22, vol: 0.15, sweepTo: 62, attack: 0.003 });
    }, 420);
    // 3. the tail — long and quiet, so the banner never sits in silence.
    setTimeout(() => noiseBurst({ dur: 0.9, vol: 0.028, filterType: 'highpass', freq: 4600, sweepTo: 11000 }), 560);
    setTimeout(() => chord([1047, 1319], 0.7, 'sine', 0.05), 700);
  },

  // ---- Skill tree ----------------------------------------------------------
  // Selecting a node. Pitched by importance so the wheel is audibly tiered —
  // you hear that you hit a keystone before the panel has rendered. Tiny on
  // purpose: this fires constantly while browsing.
  skillHover(type = 'minor') {
    const f = type === 'keystone' ? 1180 : type === 'notable' ? 880 : 660;
    osc({ type: 'triangle', freq: f, dur: 0.032, vol: 0.032, attack: 0.002 });
  },

  // BUYING a node — "ett unikt dopamin juice ljud", explicitly not a reuse of
  // levelUp()'s flat chord or claimPing().
  //
  // Three stacked events, in the order the eye sees the animation:
  //   1. a SEAT — the orb dropping into its socket. Filtered noise + a low
  //      sine thunk. The physical half; without it this is a menu beep.
  //   2. a RISING arpeggio, root pitched by node tier, so a keystone is
  //      audibly a bigger deal. The ascent is the actual dopamine carrier —
  //      a flat chord lands, a rising run promises.
  //   3. a shimmer tail so it rings out instead of stopping dead.
  // Finishing a node's last level adds a flourish a fifth above the run.
  skillBuy(type = 'minor', maxed = false) {
    const c = ctx(); if (!c || _muted) return;
    const root = type === 'keystone' ? 392 : type === 'notable' ? 494 : 587; // G4 / B4 / D5

    noiseBurst({ dur: 0.07, vol: 0.075, filterType: 'lowpass', freq: 1500, sweepTo: 380 });
    osc({ type: 'sine', freq: 190, dur: 0.13, vol: 0.13, sweepTo: 72, attack: 0.002 });

    // Major triad + octave, 55ms apart — fast enough to read as one gesture.
    [1, 1.25, 1.5, 2].forEach((mul, i) => {
      setTimeout(() => {
        osc({ type: 'triangle', freq: root * mul, dur: 0.16 + i * 0.03, vol: 0.11 - i * 0.012, attack: 0.003 });
        // A quiet sine an octave up adds sparkle without reading as a second
        // instrument.
        osc({ type: 'sine', freq: root * mul * 2, dur: 0.10, vol: 0.035, attack: 0.004 });
      }, 45 + i * 55);
    });

    setTimeout(() => noiseBurst({ dur: 0.24, vol: 0.032, filterType: 'highpass', freq: 4200, sweepTo: 9000 }), 200);
    if (maxed) setTimeout(() => chord([root * 3, root * 4, root * 5], 0.42, 'triangle', 0.10), 300);
  },

  // Can't afford / not reachable. A dull damped double-thud: the sound of
  // something not moving. Deliberately NOT a descending error buzz — those
  // read as the game scolding you, and this screen should never do that.
  skillDenied() {
    osc({ type: 'sine', freq: 210, dur: 0.09, vol: 0.09, sweepTo: 150, attack: 0.002 });
    setTimeout(() => osc({ type: 'sine', freq: 165, dur: 0.10, vol: 0.06, sweepTo: 120, attack: 0.002 }), 70);
    noiseBurst({ dur: 0.05, vol: 0.03, filterType: 'lowpass', freq: 600 });
  },

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
    osc({ type: 'sine', freq: 150, dur: 0.10, vol: 0.16, sweepTo: 60 });
  },
  reelTick() {
    osc({ type: 'square', freq: 220 + Math.random() * 80, dur: 0.028, vol: 0.03, attack: 0.001 });
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
    // A real drop UNDER the synth arc rather than instead of it: the rising
    // tone is what carries "you were paid", and the sample is what makes it
    // sound like this game. Layering beats replacing here.
    sample('drop', { vol: 0.30, pitch: 0.12, rate: 1.15 });
  },
  waterDrop() {
    // Nineteen real takes. A drop is the one sound in this game that a listener
    // has heard ten thousand times in real life, so a synthesised one is
    // obvious in a way a synthesised laser never is.
    if (sample('drop', { vol: 0.5, pitch: 0.10 })) return;
    osc({ type: 'sine', freq: 1800, dur: 0.22, vol: 0.16, sweepTo: 600, attack: 0.004 });
    setTimeout(() => osc({ type: 'sine', freq: 900, dur: 0.14, vol: 0.07, sweepTo: 400 }), 40);
  },

  /**
   * A songbird, for the intro film's lake ("kvittra fåglar").
   *
   * Built as a PHRASE, not a tone. A single chirp reads as a UI blip; what
   * makes an ear hear "bird" is a short run of 3-5 notes with an uneven rhythm,
   * each note sweeping in pitch. The note count, spacing and direction are
   * randomised per call so two calls are never the same phrase — sameness is
   * the one thing that would immediately give it away as a sound effect.
   *
   * @param {number} [distance] 0 = close by, 1 = far across the lake. Further
   *   away is quieter, duller and slightly lower — the cheap stand-in for air
   *   absorption, which is what actually makes distance audible.
   */
  birdChirp(distance = 0) {
    const c = ctx(); if (!c || _muted) return;
    const d = Math.max(0, Math.min(1, distance));
    const notes = 3 + Math.floor(Math.random() * 3);
    const vol = 0.075 * (1 - d * 0.62);
    // Higher birds carry further, so the far one is not simply the near one
    // turned down — it sits a little lower and loses its top end.
    const base = 2450 - d * 520;
    let at = 0;
    for (let i = 0; i < notes; i++) {
      const up = Math.random() < 0.62;          // most notes rise
      const f = base * (0.82 + Math.random() * 0.36);
      const span = (0.18 + Math.random() * 0.34) * (up ? 1 : -1);
      const dur = 0.05 + Math.random() * 0.05;
      setTimeout(() => osc({
        type: 'sine',
        freq: up ? f : f * (1 + Math.abs(span)),
        sweepTo: up ? f * (1 + span) : f,
        dur,
        vol: vol * (0.7 + Math.random() * 0.5),
        attack: 0.004,
      }), at * 1000);
      // Uneven gaps, with a longer one before the last note — birds phrase,
      // they do not tick.
      at += dur + 0.03 + Math.random() * 0.06 + (i === notes - 2 ? 0.09 : 0);
    }
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

  // ---- Walkable Camp SFX ----------------------------------------------------
  campFootstep() {
    if (sample('campStep', { vol: 0.28, pitch: 0.12 })) return;
    const p = 0.85 + Math.random() * 0.4;
    noiseBurst({ dur: 0.025, vol: 0.035, filterType: 'bandpass', freq: 3200 * p, Q: 4 });
  },

  stationInteract(id) {
    if (id === 'nav' || id === 'patrolPost') sample('campNav', { vol: 0.45 });
    else if (id === 'fab' || id === 'forge') sample('campForge', { vol: 0.50 });
    else if (id === 'core') sample('campAida', { vol: 0.50 });
    else if (id === 'bio' || id === 'incubator') sample('campBio', { vol: 0.45 });
    else if (id === 'recl' || id === 'well') sample('campWell', { vol: 0.45 });
    else if (id === 'hangar' || id === 'ship' || id === 'hatch' || id === 'drain') sample('campHangar', { vol: 0.50 });
    else if (id === 'def' || id === 'rampart') sample('campDef', { vol: 0.45 });
    else if (id === 'exit' || id === 'portal') sample('campPortal', { vol: 0.55 });
    else this.menuOpen();
  },

  aidaVoice(mood = 'calm') {
    const idx = mood === 'proud' || mood === 'happy' ? 1 : mood === 'sarcastic' || mood === 'alarmed' ? 2 : 0;
    if (sample('campAidaVoice', { vol: 0.45, index: idx })) return;
    chord([587, 880], 0.12, 'sine', 0.10);
  },

  powerRelay(stage = 0) {
    if (sample('campRelay', { vol: 0.55, index: stage % 3 })) return;
    drivenTone({ type: 'sawtooth', freq: 65 + stage * 20, sweepTo: 30, dur: 0.4, vol: 0.18, drive: 0.4 });
  },

  shutterSlide() {
    if (sample('campShutter', { vol: 0.50 })) return;
    noiseBurst({ dur: 0.6, vol: 0.12, filterType: 'lowpass', freq: 600, sweepTo: 180 });
  },

  stationBuild() {
    if (sample('campBuild', { vol: 0.55 })) return;
    chord([392, 523, 659, 784], 0.35, 'triangle', 0.18);
  },

  campSparks() {
    if (sample('campSparks', { vol: 0.35 })) return;
    noiseBurst({ dur: 0.08, vol: 0.06, filterType: 'highpass', freq: 3500 });
  },

  campSteam() {
    if (sample('campSteam', { vol: 0.40 })) return;
    noiseBurst({ dur: 0.25, vol: 0.07, filterType: 'bandpass', freq: 1200, Q: 2 });
  },

  // ---- Master Action & Combat SFX -------------------------------------------
  heroDash() {
    noiseBurst({ dur: 0.18, vol: 0.14, filterType: 'bandpass', freq: 1800, sweepTo: 350, Q: 1.5 });
    osc({ type: 'sine', freq: 280, dur: 0.15, vol: 0.10, sweepTo: 90, attack: 0.005 });
  },

  katanaSlash() {
    const p = 0.95 + Math.random() * 0.15;
    noiseBurst({ dur: 0.12, vol: 0.16, filterType: 'bandpass', freq: 3600 * p, sweepTo: 900, Q: 3.5 });
    osc({ type: 'sawtooth', freq: 880 * p, dur: 0.08, vol: 0.08, sweepTo: 220 });
  },

  katanaFinisher() {
    drivenTone({ type: 'sawtooth', freq: 140, sweepTo: 40, dur: 0.35, vol: 0.22, drive: 0.5 });
    noiseBurst({ dur: 0.22, vol: 0.24, filterType: 'highpass', freq: 2800, sweepTo: 600 });
    setTimeout(() => chord([587, 880, 1174], 0.38, 'triangle', 0.14), 60);
  },

  scytheSpin() {
    noiseBurst({ dur: 0.32, vol: 0.16, filterType: 'bandpass', freq: 1400, sweepTo: 2800, Q: 2.0 });
    osc({ type: 'sawtooth', freq: 220, dur: 0.28, vol: 0.09, sweepTo: 440 });
  },

  bowShoot() {
    osc({ type: 'triangle', freq: 660, dur: 0.06, vol: 0.12, sweepTo: 180, attack: 0.002 });
    noiseBurst({ dur: 0.08, vol: 0.10, filterType: 'highpass', freq: 4000 });
  },

  rageAwaken() {
    drivenTone({ type: 'sawtooth', freq: 80, sweepTo: 520, dur: 0.65, vol: 0.25, drive: 0.6, attack: 0.04 });
    noiseBurst({ dur: 0.55, vol: 0.18, filterType: 'lowpass', freq: 800, sweepTo: 4000 });
    setTimeout(() => chord([440, 554, 659, 880], 0.6, 'sawtooth', 0.15), 200);
  },

  clickerCrit() {
    chord([784, 1046, 1318], 0.22, 'sine', 0.14);
    setTimeout(() => osc({ type: 'triangle', freq: 1568, dur: 0.18, vol: 0.10, sweepTo: 2093 }), 50);
  },

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

  // ---- New minigame and feedback sounds ----
  clickerTap() {
    if (_muted) return;
    if (sample('drop', { vol: 0.35, pitch: 0.12 })) return;
    osc({ type: 'sine', freq: 700 + Math.random() * 200, dur: 0.04, vol: 0.08, sweepTo: 300 });
  },
  alert() {
    if (_muted) return;
    osc({ type: 'square', freq: 880, dur: 0.08, vol: 0.12 });
    setTimeout(() => osc({ type: 'square', freq: 880, dur: 0.08, vol: 0.12 }), 100);
  },
  dig() {
    if (_muted) return;
    noiseBurst({ dur: 0.09, vol: 0.15, filterType: 'bandpass', freq: 400, q: 2 });
    osc({ type: 'triangle', freq: 180, dur: 0.07, vol: 0.12, sweepTo: 60 });
  },
  hazardAlarm() {
    if (_muted) return;
    osc({ type: 'sawtooth', freq: 350, dur: 0.18, vol: 0.16, sweepTo: 220 });
  },
  oreFound() {
    if (_muted) return;
    chord([523, 659, 784, 1046], 0.22, 'triangle', 0.12);
  },
  dodgeRoll() {
    if (_muted) return;
    this.heroDash();
  },
  uiClick() {
    this.click();
  },

  // ---- music (real tracks, single-instance singleton) ----
  _stopMusicNode() {
    if (_musicNode) {
      try { _musicNode.disconnect && _musicNode.disconnect(); } catch (e) {}
      _musicNode = null;
    }
    for (const a of _activeAudioElements) {
      try {
        a.onended = null;
        a.onerror = null;
        a.pause();
        a.currentTime = 0;
        a.src = '';
      } catch (e) {}
    }
    _activeAudioElements.clear();
    _currentUrl = null;
  },
  _playUrl(url) {
    if (_currentUrl === url && _activeAudioElements.size > 0) {
      return; // Already playing this exact track cleanly
    }
    this._stopMusicNode();
    _currentUrl = url;
    try {
      const a = new window.Audio(url);
      a.loop = true;
      a.volume = _muted ? 0 : Math.max(0, Math.min(1, (_musicVol || 0.15) * 1.6));
      _activeAudioElements.add(a);
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      _musicNode = {
        disconnect: () => {
          try {
            a.pause();
            a.currentTime = 0;
            a.src = '';
            _activeAudioElements.delete(a);
          } catch (e) {}
        },
        _mp3: a,
        gain: { value: a.volume },
      };
    } catch (e) {
      console.warn('[Audio] play failed', e);
    }
  },
  _playPlaylist(urls) {
    if (!urls || !urls.length) return;
    this._stopMusicNode();
    let i = 0;
    let cancelled = false;
    const playNext = () => {
      if (cancelled) return;
      try {
        const nextUrl = urls[i];
        _currentUrl = nextUrl;
        const a = new window.Audio(nextUrl);
        a.volume = _muted ? 0 : Math.max(0, Math.min(1, (_musicVol || 0.15) * 1.6));
        _activeAudioElements.add(a);
        a.onended = () => {
          _activeAudioElements.delete(a);
          if (!cancelled) {
            i = (i + 1) % urls.length;
            playNext();
          }
        };
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
        _musicNode = {
          disconnect: () => {
            cancelled = true;
            try {
              a.onended = null;
              a.pause();
              a.currentTime = 0;
              a.src = '';
              _activeAudioElements.delete(a);
            } catch (e) {}
          },
          _mp3: a,
          gain: { value: a.volume },
        };
      } catch (e) {
        console.warn('[Audio] playlist failed', e);
      }
    };
    playNext();
  },
  // ---- Track assignments ----------------------------------------------------
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
    if (_musicTrack === 'menu' && _activeAudioElements.size > 0) return;
    const c = ctx(); if (!c) return;
    _musicTrack = 'menu';
    this._playUrl(this.MUSIC.menu);
  },
  swapToGameMusic() {
    if (_musicTrack === 'game' && _activeAudioElements.size > 0) return;
    _musicTrack = 'game';
    this._playPlaylist(this.MUSIC.game);
  },
  swapToMenuMusic() {
    if (_musicTrack === 'menu' && _activeAudioElements.size > 0) return;
    _musicTrack = 'menu';
    this._playUrl(this.MUSIC.menu);
  },
  swapToAtlasMusic() {
    if (_musicTrack === 'atlas' && _activeAudioElements.size > 0) return;
    _musicTrack = 'atlas';
    this._playUrl(this.MUSIC.atlas);
  },
  stopMusic() {
    _musicTrack = null;
    this._stopMusicNode();
  },
};

// Safe Proxy export so no unknown sound call will ever throw or crash
export const Audio = new Proxy(rawAudio, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    // Safe fallback no-op
    return () => {};
  },
});
