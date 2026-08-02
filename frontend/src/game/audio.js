// Procedural WebAudio SFX bank — no asset, ~3KB.
let _ctx = null;
let _master = null;
let _muted = false;
let _sfxVol = 1.0;
let _musicVol = 0.28;
let _musicNode = null;
let _xpPingLastT = 0;

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

function tone(freq, dur, type = 'sine', vol = 0.2, sweepTo = null) {
  const c = ctx(); if (!c || _muted) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (sweepTo != null) o.frequency.linearRampToValueAtTime(sweepTo, c.currentTime + dur);
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(_master);
  o.start(); o.stop(c.currentTime + dur);
}
function noise(dur, vol = 0.2, filter = 1000) {
  const c = ctx(); if (!c || _muted) return;
  const bufferSize = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource(); src.buffer = buffer;
  const g = c.createGain(); g.gain.value = vol;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
  src.connect(f).connect(g).connect(_master);
  src.start();
}

export const Audio = {
  setMuted(m) { _muted = m; },
  setSfxVol(v) { _sfxVol = v; if (_master) _master.gain.value = v; },
  setMusicVol(v) { _musicVol = v; if (_musicNode) _musicNode.gain.value = v * 0.4; },
  shoot() { tone(720, 0.08, 'square', 0.10, 380); noise(0.06, 0.05, 2000); },
  hit()   { tone(220, 0.05, 'square', 0.10, 140); },
  kill()  { noise(0.12, 0.12, 800); tone(160, 0.10, 'sawtooth', 0.08, 60); },
  reload(){ tone(380, 0.08, 'square', 0.06, 540); },
  levelUp(){ tone(523, 0.10, 'triangle', 0.12); setTimeout(() => tone(659, 0.10, 'triangle', 0.12), 90); setTimeout(() => tone(784, 0.18, 'triangle', 0.14), 180); },
  // Water-drop claim: low start → dip → rises UP = positiv känsla
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
  xpPing(progress = 0) {
    const c = ctx(); if (!c || _muted) return;
    const now = c.currentTime;
    if (now - _xpPingLastT < 0.1) return;
    _xpPingLastT = now;
    const freq = 480 + progress * 1400; // 480 Hz (empty) → 1880 Hz (full)
    const g = c.createGain();
    g.gain.setValueAtTime(_sfxVol * 0.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
    g.connect(c.destination);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 1.06, c.currentTime + 0.06);
    o.type = 'sine';
    o.connect(g);
    o.start(c.currentTime); o.stop(c.currentTime + 0.09);
  },
  // Water drop — for skill point / mission reward collection
  waterDrop() {
    const c = ctx(); if (!c || _muted) return;
    const g = c.createGain();
    g.gain.setValueAtTime(_sfxVol * 0.35, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
    g.connect(c.destination);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(1800, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.18);
    o.type = 'sine';
    o.connect(g);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0, c.currentTime + 0.04);
    g2.gain.setValueAtTime(_sfxVol * 0.15, c.currentTime + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    g2.connect(c.destination);
    const o2 = c.createOscillator();
    o2.frequency.setValueAtTime(900, c.currentTime + 0.04);
    o2.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.18);
    o2.type = 'sine'; o2.connect(g2);
    o.start(c.currentTime); o.stop(c.currentTime + 0.22);
    o2.start(c.currentTime + 0.04); o2.stop(c.currentTime + 0.22);
  },
  click() { tone(880, 0.05, 'square', 0.08); },
  dash()  { tone(1200, 0.10, 'square', 0.08, 200); },
  heartPickup() { tone(600, 0.06, 'sine', 0.14, 900); setTimeout(() => tone(900, 0.10, 'sine', 0.10, 1200), 60); },
  boss()  { tone(80, 0.6, 'sawtooth', 0.15, 40); noise(0.4, 0.10, 400); },
  crit()  { tone(1100, 0.12, 'square', 0.12, 1800); },
  pickup(){ tone(1320, 0.06, 'sine', 0.08, 1760); },
  blueprint() { tone(523, 0.10, 'triangle', 0.10); setTimeout(() => tone(1046, 0.18, 'triangle', 0.12), 80); },
  active(name) {
    if (name === 'lightning') { tone(2200, 0.10, 'square', 0.15, 200); noise(0.15, 0.10, 4000); }
    else if (name === 'meteor') { tone(60, 0.4, 'sawtooth', 0.18, 30); noise(0.5, 0.20, 600); }
    else if (name === 'aegis') { tone(380, 0.20, 'triangle', 0.10); setTimeout(() => tone(540, 0.20, 'triangle', 0.10), 80); }
    else { tone(660, 0.10, 'square', 0.10); }
  },
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
  startMusic() {
    const c = ctx(); if (!c || _musicNode) return;
    // Menu/Camp music: user-uploaded waterdrop survivor track
    this._playUrl('/menu-music.mp3');
  },
  swapToGameMusic() {
    this._stopMusicNode();
    // In-game music: guitar-bagpipe synapse track
    this._playUrl('https://customer-assets.emergentagent.com/job_progression-warrior/artifacts/hyp8e5j4_guitarbagpipe-synapse.mp3');
  },
  swapToMenuMusic() {
    this._stopMusicNode();
    this._playUrl('/menu-music.mp3');
  },
  stopMusic() { if (_musicNode) { try { _musicNode.disconnect(); } catch (e) {} _musicNode = null; } },
};
