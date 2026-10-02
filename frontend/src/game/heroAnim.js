// =============================================
// HERO ANIMATION RIG — everything the drop does with its body
// =============================================
// The character had a squish value, a tilt value and a bob counter. That is
// enough to say "he is moving"; it is not enough to say WHO is moving, which
// direction he is facing, whether he is running or backpedalling, whether he
// just took a hit, or whether he is enjoying himself. All of that used to be
// invisible.
//
// This module owns exactly one job: turn the raw player state the engine
// produces (`dirX/dirY`, `aimX/aimY`, `recoil`, `hp`, combo) into a rich
// animation state the renderer can draw without doing any thinking. It holds
// its own springs and timers because animation has memory — a slide is only a
// slide because of where you were going a moment ago.
//
// Three rules:
//
// 1. **No drawing here, no game logic here.** Same split the rest of the
//    project keeps: engine.js decides what is true, pixiRenderer.js decides
//    what it looks like, and this decides how the body is *posed* in between.
//    Nothing in this file may read or write game state.
//
// 2. **Everything is a spring or a lerp, never a snap.** A value that jumps
//    reads as a bug. Every field below either eases toward a target or is
//    driven by a damped spring, so the body always has weight.
//
// 3. **He is made of water.** Acceleration squashes him, stopping makes him
//    wobble, turning makes him slosh, and the wobble carries momentum after
//    the input stops. If a choice is between "correct" and "liquid", pick
//    liquid.

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// Frame-rate-independent easing. `rate` is roughly "how many e-folds per
// second"; using this instead of a raw `t` multiplier means the animation
// looks identical at 30fps and 144fps.
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

// ---------------------------------------------------------------------------
// EXPRESSIONS
// ---------------------------------------------------------------------------
// Six, and they have to be distinguishable at 28 pixels tall — which rules out
// subtlety. Each is a set of shape parameters rather than a sprite, so they
// can blend into each other continuously instead of popping between frames.
//
//   browAng   — inner-corner angle. Negative = angled down toward the nose
//               (angry), positive = angled up (hurt/worried).
//   browY     — brow height. Lower = more intense.
//   eyeOpen   — 0 shut, 1 wide. Above 1 reads as manic.
//   pupil     — pupil scale. Small = focused/enraged, large = happy/afraid.
//   mouth     — -1 deep frown, 0 flat, +1 big grin.
//   mouthOpen — vertical opening. Drives a shout/gasp.
//   tintMix   — how far the body colour pushes toward `tint`.
export const EXPRESSIONS = {
  calm:    { browAng:  0.00, browY: 0.00, eyeOpen: 1.00, pupil: 1.00, mouth:  0.10, mouthOpen: 0.05, tint: null,      tintMix: 0.00 },
  focused: { browAng: -0.18, browY: 0.06, eyeOpen: 0.78, pupil: 0.82, mouth: -0.05, mouthOpen: 0.00, tint: '#8ad8ff', tintMix: 0.06 },
  happy:   { browAng:  0.10, browY:-0.05, eyeOpen: 0.62, pupil: 1.15, mouth:  0.95, mouthOpen: 0.35, tint: '#a8f0ff', tintMix: 0.10 },
  hurt:    { browAng:  0.42, browY: 0.10, eyeOpen: 0.42, pupil: 1.30, mouth: -0.75, mouthOpen: 0.45, tint: '#ff6b7a', tintMix: 0.30 },
  angry:   { browAng: -0.48, browY: 0.14, eyeOpen: 0.88, pupil: 0.72, mouth: -0.45, mouthOpen: 0.20, tint: '#ffb066', tintMix: 0.16 },
  rage:    { browAng: -0.70, browY: 0.20, eyeOpen: 1.22, pupil: 0.48, mouth: -0.30, mouthOpen: 0.80, tint: '#ff4d3d', tintMix: 0.34 },
  // RAMPAGE — the ceiling of the combo system. Everything is pushed past
  // rage rather than merely further along it: eyes wider than is comfortable,
  // pupils down to points, a full open-mouthed roar, and a tint hot enough
  // that it reads as glowing rather than tinted. It has to be obviously a
  // DIFFERENT state at a glance, not "rage but slightly more".
  rampage: { browAng: -0.88, browY: 0.26, eyeOpen: 1.45, pupil: 0.30, mouth: -0.10, mouthOpen: 1.00, tint: '#ffd23d', tintMix: 0.46 },
  // DIRE — about to die. The opposite direction from rage in every parameter:
  // brows up and pleading, eyes barely open, pupils blown wide, mouth open in
  // a gasp. Drained toward grey-blue rather than red, because red is already
  // doing the "you took a hit" job and the two must not be confused.
  dire:    { browAng:  0.62, browY: 0.16, eyeOpen: 0.28, pupil: 1.55, mouth: -0.90, mouthOpen: 0.62, tint: '#7fa6c8', tintMix: 0.52 },
};

const EXPRESSION_IDS = Object.keys(EXPRESSIONS);

// Blend two expression parameter sets. Because every expression is numbers
// rather than art, "halfway between focused and rage" is a real face and not
// a crossfade artefact.
function blendExpr(a, b, t) {
  return {
    browAng:   lerp(a.browAng,   b.browAng,   t),
    browY:     lerp(a.browY,     b.browY,     t),
    eyeOpen:   lerp(a.eyeOpen,   b.eyeOpen,   t),
    pupil:     lerp(a.pupil,     b.pupil,     t),
    mouth:     lerp(a.mouth,     b.mouth,     t),
    mouthOpen: lerp(a.mouthOpen, b.mouthOpen, t),
    tint:      t > 0.5 ? b.tint : a.tint,
    tintMix:   lerp(a.tintMix,   b.tintMix,   t),
  };
}

export class HeroAnim {
  constructor() {
    // ---- Facing ---------------------------------------------------------
    // Two independent axes rather than one angle, because the drawing needs
    // them separately: `faceY` picks front-vs-back art, `faceX` picks which
    // way the profile turns. Blending a single angle would swing the face
    // through the back of his head when crossing straight up.
    this.faceX = 0;      // -1 fully left profile .. +1 fully right profile
    this.faceY = 1;      // -1 fully facing away (back) .. +1 fully toward camera
    this.turn = 0;       // signed turn rate, drives the "whip" on a fast spin

    // ---- Gait -----------------------------------------------------------
    this.gait = 0;       // +1 running toward the aim, -1 backpedalling
    this.strafe = 0;     // -1 sliding left across the aim, +1 right
    this.speed = 0;      // 0..1 normalised movement magnitude

    // ---- Water body -----------------------------------------------------
    // Two damped springs. `wob*` is position (the visible offset), `wobV*` is
    // velocity. Driven by acceleration, so the mass inside him keeps going
    // when he stops — which is the entire "made of water" read.
    this.wobX = 0; this.wobY = 0;
    this.wobVX = 0; this.wobVY = 0;
    this.stretch = 0;    // >0 stretched along travel, <0 squashed
    this.jiggle = 0;     // high-frequency surface ripple amplitude
    this.jigglePh = 0;
    this.settle = 0;     // builds while standing still — the idle "sag"

    // ---- Slide ----------------------------------------------------------
    // `momX/momY` lags the input direction. When the player reverses, the
    // momentum vector is still pointing the old way, and the difference
    // between the two IS the skid. Nothing else needs to detect a "reversal".
    this.momX = 0; this.momY = 0;
    this.slide = 0;      // 0..1 how hard he is currently skidding
    this.slideX = 0; this.slideY = 0; // world-space skid direction

    // ---- Recoil ---------------------------------------------------------
    this.kick = 0;       // body displacement back along the aim
    this.kickV = 0;
    this.shakeT = 0;

    // ---- Face -----------------------------------------------------------
    this.expr = { ...EXPRESSIONS.calm };
    this.exprId = 'calm';
    this.blink = 0;          // 0 open .. 1 shut
    this._blinkT = 2.5;
    this._blinkPhase = 0;    // 0 idle, 1 closing, 2 opening
    this._doubleBlink = false;
    this.lookX = 0; this.lookY = 0; // pupil offset, tracks the aim

    // ---- Bookkeeping ----------------------------------------------------
    this._prevHp = null;
    this._hurtT = 0;
    this._happyT = 0;
    this._prevKills = 0;
    this._prevRecoil = 0;
    this.spray = [];     // slide-spray requests the renderer drains each frame
  }

  // The single entry point. Called once per frame from the renderer, before
  // anything is drawn.
  update(game, dt) {
    if (!game || !game.player) return this;
    // Floor as well as ceiling. The engine clamps its own dt to a 0.0001
    // minimum, and `_updateWater` divides by dt to get acceleration — at
    // 0.0001 that multiplies a direction change by ten thousand, which pushes
    // the spring past its stable region and it diverges. Once any spring goes
    // non-finite the NaN propagates into the body position and straight into
    // Graphics coordinates, and the renderer stops drawing.
    const d = clamp(dt, 1 / 240, 0.05);
    const p = game.player;
    const run = game.run || {};

    this._updateFacing(p, d);
    this._updateWater(p, d);
    this._updateSlide(p, d);
    this._updateRecoil(p, d);
    this._updateFace(game, p, run, d);
    // Last line of defence. Cheaper than auditing every branch above forever,
    // and the failure it prevents is a hard freeze rather than a wrong pixel:
    // one NaN reaching a Graphics call takes the whole frame down.
    this._sanitize();
    return this;
  }

  // Any non-finite value resets that spring to rest. A single frame of a
  // character snapping back to neutral is invisible; a NaN is fatal.
  _sanitize() {
    const F = ['faceX', 'faceY', 'turn', 'gait', 'strafe', 'speed', 'wobX', 'wobY',
      'wobVX', 'wobVY', 'stretch', 'jiggle', 'jigglePh', 'settle', 'momX', 'momY',
      'slide', 'slideX', 'slideY', 'kick', 'kickV', 'shakeT', 'blink', 'lookX', 'lookY'];
    for (const k of F) {
      if (!Number.isFinite(this[k])) this[k] = (k === 'faceY' ? 1 : 0);
    }
    for (const k of Object.keys(this.expr)) {
      if (typeof this.expr[k] === 'number' && !Number.isFinite(this.expr[k])) {
        this.expr[k] = EXPRESSIONS.calm[k];
      }
    }
    // The spray queue is drained by the renderer every frame. If a renderer
    // ever stops draining it (a paused or detached view), this would grow
    // without bound; capping it makes that a dropped effect instead of a leak.
    if (this.spray.length > 64) this.spray.length = 64;
  }

  // ---- Facing and gait ---------------------------------------------------
  _updateFacing(p, dt) {
    const aimLen = Math.hypot(p.aimX || 0, p.aimY || 0) || 1;
    const ax = (p.aimX || 0) / aimLen, ay = (p.aimY || 0) / aimLen;
    const mlen = Math.hypot(p.dirX || 0, p.dirY || 0);
    this.speed = clamp(mlen, 0, 1);

    // The body faces where the GUN points, because that is where his attention
    // is — the movement direction only decides the gait. Standing still, he
    // keeps whatever he was last looking at rather than snapping to a default.
    const targetX = ax;
    const targetY = ay;

    const prevX = this.faceX;
    // 11/s is fast enough to feel responsive on a flick and slow enough that a
    // full 180 visibly rotates through the profile instead of teleporting.
    this.faceX = damp(this.faceX, targetX, 11, dt);
    this.faceY = damp(this.faceY, targetY, 11, dt);
    // Signed turn rate, normalised to roughly -1..1 for a fast flick. Drives
    // the trailing "whip" on the body when he spins hard.
    this.turn = clamp((this.faceX - prevX) / (dt || 1) * 0.09, -1, 1);

    if (mlen > 0.02) {
      const mx = (p.dirX || 0) / mlen, my = (p.dirY || 0) / mlen;
      // dot: +1 running the way he is aiming, -1 walking backwards away from
      // the target. cross: which way he is sliding across his own sightline.
      this.gait   = damp(this.gait,   mx * ax + my * ay, 9, dt);
      this.strafe = damp(this.strafe, mx * ay - my * ax, 9, dt);
    } else {
      this.gait   = damp(this.gait, 0, 6, dt);
      this.strafe = damp(this.strafe, 0, 6, dt);
    }
  }

  // ---- The water body ----------------------------------------------------
  _updateWater(p, dt) {
    // Acceleration is what a liquid actually reacts to — not velocity. Taking
    // the derivative of dir rather than of position keeps this stable when the
    // camera or a knockback moves him.
    // Clamped: a single frame can change direction by at most 2 (full
    // reversal), so at the dt floor this quotient can reach several thousand.
    // Feeding that into the spring below overshoots its stable region in one
    // step and the oscillation diverges instead of settling.
    const AMAX = 40;
    const ax = clamp(((p.dirX || 0) - (this._lastDirX || 0)) / dt, -AMAX, AMAX);
    const ay = clamp(((p.dirY || 0) - (this._lastDirY || 0)) / dt, -AMAX, AMAX);
    this._lastDirX = p.dirX || 0; this._lastDirY = p.dirY || 0;

    // Damped spring: mass sloshes opposite the acceleration, then oscillates
    // back. STIFF sets the wobble frequency, DAMP how many bounces you get.
    const STIFF = 62, DAMPING = 7.4;
    this.wobVX += (-ax * 0.9 - this.wobX * STIFF - this.wobVX * DAMPING) * dt;
    this.wobVY += (-ay * 0.9 - this.wobY * STIFF - this.wobVY * DAMPING) * dt;
    this.wobX = clamp(this.wobX + this.wobVX * dt, -0.34, 0.34);
    this.wobY = clamp(this.wobY + this.wobVY * dt, -0.34, 0.34);

    // Stretch along the direction of travel — a moving drop elongates, a
    // stopping one pancakes. Signed so the renderer can do both from one value.
    const spd = this.speed;
    const accelMag = Math.hypot(ax, ay);
    const stretchTarget = spd * 0.22 - clamp(accelMag * 0.014, 0, 0.26);
    this.stretch = damp(this.stretch, stretchTarget, 10, dt);

    // Surface ripple. Frequency rises with speed so a sprint shimmers and a
    // standstill barely moves.
    this.jigglePh += dt * (7 + spd * 18);
    const jTarget = 0.42 + spd * 1.05 + Math.abs(this.wobVX) * 0.55 + Math.abs(this.wobVY) * 0.55;
    this.jiggle = damp(this.jiggle, jTarget, 8, dt);

    // The idle settle: stand still and he gradually relaxes downward, the way
    // an unsupported drop spreads. Moving resets it fast.
    this.settle = spd < 0.06
      ? damp(this.settle, 1, 0.9, dt)
      : damp(this.settle, 0, 9, dt);
  }

  // ---- Slide / glide -----------------------------------------------------
  _updateSlide(p, dt) {
    const mlen = Math.hypot(p.dirX || 0, p.dirY || 0);
    const mx = mlen > 0.02 ? (p.dirX || 0) / mlen : 0;
    const my = mlen > 0.02 ? (p.dirY || 0) / mlen : 0;

    // Momentum lags the input. 3.2/s is deliberately sluggish — this vector is
    // supposed to be "where he was already going", not "where he is going".
    this.momX = damp(this.momX, mx * mlen, 3.2, dt);
    this.momY = damp(this.momY, my * mlen, 3.2, dt);
    const momLen = Math.hypot(this.momX, this.momY);

    // Opposition: how directly the new input fights the existing momentum.
    // 1 = a full 180 at speed, which is exactly the case the user described.
    let opposition = 0;
    if (momLen > 0.25 && mlen > 0.25) {
      const dot = (this.momX / momLen) * mx + (this.momY / momLen) * my;
      opposition = clamp(-dot, 0, 1) * Math.min(momLen, 1) * mlen;
    }

    if (opposition > 0.48 && this.slide < 0.25) {
      // Skid starts. Direction is the OLD momentum — he keeps travelling the
      // way he was going while his body has already turned to the new heading.
      this.slide = 1;
      this.slideX = this.momX / (momLen || 1);
      this.slideY = this.momY / (momLen || 1);
      // Spray comes off the contact edge, thrown backward along the skid.
      for (let i = 0; i < 9; i++) {
        this.spray.push({
          ang: Math.atan2(this.slideY, this.slideX) + (Math.random() - 0.5) * 1.5,
          spd: 60 + Math.random() * 140,
          size: 1.2 + Math.random() * 2.4,
        });
      }
    }
    this.slide = damp(this.slide, 0, 3.4, dt);
    if (this.slide < 0.01) this.slide = 0;
  }

  // ---- Recoil ------------------------------------------------------------
  _updateRecoil(p, dt) {
    // A RISE in the engine's recoil value is a shot; the engine decays it
    // continuously, so watching for the rise is what isolates the moment of
    // firing without needing an event.
    const r = p.recoil || 0;
    if (r > this._prevRecoil + 0.02) {
      const impulse = Math.min(1, r) * 3.1;
      this.kickV += impulse;
      this.shakeT = Math.min(0.26, this.shakeT + 0.16);
      // Firing also sloshes him — the whole body takes the push, not the gun.
      this.wobVX += -(p.aimX || 0) * impulse * 0.5;
      this.wobVY += -(p.aimY || 0) * impulse * 0.5;
    }
    this._prevRecoil = r;

    // Kick spring: snaps back harder than it goes out, so a burst reads as
    // rapid punches rather than one long push.
    this.kickV += (-this.kick * 150 - this.kickV * 16) * dt;
    this.kick = Math.max(0, this.kick + this.kickV * dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
  }

  // ---- Face --------------------------------------------------------------
  _updateFace(game, p, run, dt) {
    // --- what happened recently ---
    const hp = p.hp || 0, maxHp = p.maxHp || 1;
    if (this._prevHp === null) this._prevHp = hp;
    if (hp < this._prevHp - 0.5) this._hurtT = 0.85;
    this._prevHp = hp;
    this._hurtT = Math.max(0, this._hurtT - dt);

    const kills = run.kills || 0;
    if (kills > this._prevKills) this._happyT = Math.min(0.6, this._happyT + 0.22);
    this._prevKills = kills;
    this._happyT = Math.max(0, this._happyT - dt * 0.8);

    const hpFrac = clamp(hp / maxHp, 0, 1);
    const combo = run.comboCount || 0;

    // --- pick the expression ---
    // Ordered by urgency, not by preference: being hit interrupts everything,
    // then near-death, then rage, then the pleasant states. A face that argues
    // with what just happened to it is worse than no face.
    let id = 'calm';
    if (this._hurtT > 0.25) id = 'hurt';
    // Below 10% is a different state from "hurt": you are about to die, and
    // the face should say so before the health gauge does. This is the one
    // read the player must never miss, so it outranks everything except the
    // instant of being hit.
    else if (hpFrac < 0.10) id = 'dire';
    else if (hpFrac < 0.22) id = 'hurt';
    // Rampage sits above rage. A combo that high is the best thing that
    // happens in a run and it previously topped out at the same face as a
    // combo of 25 — so the ceiling of the whole combo system had no visible
    // reward attached to it.
    else if (combo >= 60) id = 'rampage';
    else if (combo >= 25) id = 'rage';
    else if (combo >= 10) id = 'angry';
    else if (this._happyT > 0.18) id = 'happy';
    else if (p.reloading || (p.recoil || 0) > 0.15) id = 'focused';
    this.exprId = id;
    // Exposed so the renderer can escalate the whole character, not just the
    // face — a rampage should change how he BURNS, not only how he scowls.
    this.rampage = id === 'rampage' ? 1 : 0;
    this.dire = id === 'dire' ? 1 : 0;

    // Blend toward it rather than switching. 9/s crosses a full expression in
    // about a fifth of a second — fast enough to read as a reaction, slow
    // enough that the face is never a strobe during a firefight.
    this.expr = blendExpr(this.expr, EXPRESSIONS[id], 1 - Math.exp(-9 * dt));

    // --- blinking ---
    // Irregular by design. A blink on a fixed timer is immediately readable as
    // a machine; the occasional double-blink is what sells it as a creature.
    this._blinkT -= dt;
    if (this._blinkPhase === 0 && this._blinkT <= 0) {
      this._blinkPhase = 1;
      this._doubleBlink = Math.random() < 0.22;
    }
    if (this._blinkPhase === 1) {
      this.blink = Math.min(1, this.blink + dt * 18);
      if (this.blink >= 1) this._blinkPhase = 2;
    } else if (this._blinkPhase === 2) {
      this.blink = Math.max(0, this.blink - dt * 12);
      if (this.blink <= 0) {
        if (this._doubleBlink) { this._doubleBlink = false; this._blinkPhase = 1; }
        else { this._blinkPhase = 0; this._blinkT = 2.2 + Math.random() * 4.2; }
      }
    }
    // Rage holds the eyes open — a wide unblinking stare is most of why it
    // reads as unhinged rather than merely cross.
    if (id === 'rage') this.blink *= 0.25;

    // --- pupils track the aim ---
    const al = Math.hypot(p.aimX || 0, p.aimY || 0) || 1;
    this.lookX = damp(this.lookX, ((p.aimX || 0) / al) * 0.42, 14, dt);
    this.lookY = damp(this.lookY, ((p.aimY || 0) / al) * 0.34, 14, dt);
  }

  // Drains the slide-spray queue. The renderer asks for these once per frame
  // and turns them into real particles; keeping them as plain requests means
  // this module never has to know the particle system exists.
  takeSpray() {
    if (!this.spray.length) return null;
    const out = this.spray;
    this.spray = [];
    return out;
  }
}

export { EXPRESSION_IDS, lerp as animLerp, clamp as animClamp, damp as animDamp, TAU as ANIM_TAU };
