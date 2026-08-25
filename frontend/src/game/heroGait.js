// =============================================
// THE GAIT — where the character's WEIGHT comes from
// =============================================
// Timmy, 2026-08-24: "de ska va 360 a realistiska rorelser a han ska ha idle
// animationer a han ska ha tyng i sig nar han gar de ska va rena rama assasins
// creed kannsla i han a de ska se verkligt ut".
//
// ── WHAT ACTUALLY MAKES A CHARACTER FEEL HEAVY ───────────────────────
// It is not the drawing. Every weightless 2D character in existence has the
// same single defect: the feet move WITH the body. That is skating, and no
// amount of shading fixes it. The one thing every animation with real weight
// does — Assassin's Creed included — is the opposite:
//
//   **A planted foot does not move. The body travels over it.**
//
// Everything else in this file is secondary to that. The rest of the list, in
// the order it matters:
//
//   1. FOOT PLANTING. A foot in stance is nailed to the ground and its offset
//      from the body slides backward by exactly the distance travelled. When it
//      has fallen far enough behind, it lifts, swings ahead, and re-plants.
//   2. DISTANCE-DRIVEN, NEVER TIME-DRIVEN. The cycle advances with metres
//      walked. Drive it from a clock and he moonwalks the moment he slows down
//      — the classic tell, and free to avoid.
//   3. VERTICAL BOB, PHASED CORRECTLY. The body is LOWEST at contact (both feet
//      down, knees absorbing) and HIGHEST at mid-stance (passing over the
//      straight support leg). Two rises per stride. Getting the phase wrong
//      makes him bounce like a ball instead of walking.
//   4. WEIGHT SHIFT. The mass leans over whichever foot is carrying it. One
//      sway per stride, not two.
//   5. COUNTER-ROTATION. Hips rotate toward the leading leg; shoulders rotate
//      against them. This is what stops a walk reading as a shop mannequin on
//      a conveyor.
//   6. THE BODY LEADS, THE FEET FOLLOW. On a direction change the mass turns
//      first and the feet re-plant to catch up. A rig that turns instantly is
//      a cursor with legs.
//
// ── WHY THIS FILE HAS NO PIXI IN IT ──────────────────────────────────
// Same reason stationLayout.js has none: it is all arithmetic, so the headless
// suite can prove the properties that matter — that a planted foot does not
// drift, that the cycle is frame-rate independent, that nothing goes NaN. A
// gait you can only check by eye is a gait nobody ever checks.
//
// It is also why this is a MODULE and not five copies. The character is drawn
// in five places (the run, the intro film, the paperdoll, the station room, the
// gear panel) and `wiring.test.mjs` exists specifically because a sixth
// hand-rolled copy has appeared before.

/** How much a screen-vertical movement is foreshortened for the limbs.
 *
 *  The camera looks down at an angle and the character is drawn front-on, so a
 *  step "away from camera" covers less screen distance than the same step taken
 *  sideways. Without this, walking up the screen throws his feet as far as
 *  walking left does and the perspective falls apart. */
export const PERSP_Y = 0.52;

/** Stride geometry, in multiples of the body radius `r`. Stubby legs: he is a
 *  drop, not a runway model, and the reference art has short thick limbs. */
export const GAIT = {
  // `stepLen` is the STRIDE — the distance the body covers in one full foot
  // cycle (two footfalls) — measured in body radii. A real person's stride is
  // roughly six body radii; his legs are 0.52r long and cartoon-stubby, so he
  // physically cannot reach that and takes more, shorter steps instead. That
  // is not a compromise, it is how every stubby character has ever been
  // animated, and it suits a small fast survivor.
  stepLen: 2.20,
  standWidth: 0.32,   // half the distance between the feet at rest
  lift: 0.22,         // peak height of a swinging foot
  bob: 0.075,         // body rise between contact and mid-stance
  sway: 0.070,        // lateral weight shift onto the support foot
  hipRot: 0.13,       // radians the hips counter-rotate
  legLen: 0.52,       // hip to foot at rest
};

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent approach. Never a raw lerp against dt. */
const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
/** Smooth 0..1 with zero derivative at both ends — a foot must not jerk as it
 *  leaves the ground or slam as it arrives. */
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * One character's gait.
 *
 * Feed it velocity in world units per second and the body radius; read the
 * pose back off the instance. It owns no drawing and no PixiJS.
 */
export class HeroGait {
  constructor() {
    this.travel = 0;        // total distance walked, in body radii
    this.speed01 = 0;       // 0..1 of walk speed
    // Set before first use, not on the first setRadius() call — `update` reads
    // it, and a division by undefined here produces NaN in `travel` on frame
    // one, which then poisons every derived value for the rest of the run.
    this._r = 1;
    this.dirX = 0; this.dirY = 1;   // smoothed facing, unit-ish
    this.moveX = 0; this.moveY = 0; // smoothed travel direction

    // Pose, all in multiples of r, relative to the body's ground point.
    this.feet = [
      { x: -GAIT.standWidth, y: 0, lift: 0, planted: true, phase: 0.0 },
      { x: GAIT.standWidth, y: 0, lift: 0, planted: true, phase: 0.5 },
    ];
    this.rise = 0;          // body vertical offset (negative = up the screen)
    this.shift = 0;         // lateral weight shift
    this.hip = 0;           // hip rotation, radians
    this.shoulder = 0;      // shoulder counter-rotation, radians
    this.lean = 0;          // whole-body lean into travel
    this.turn = 0;          // signed turn rate, for the "body leads" whip

    // Idle layers. Three cycles at deliberately unrelated periods so the
    // pattern never visibly repeats — the cheapest possible way to make a
    // standing character look alive rather than paused.
    this.breath = 0;      // the slow rise and fall of standing and breathing
    this.idleRock = 0;    // the steady rock from foot to foot
    this.idleShift = 0;   // the occasional weight change that has no rhythm
    this._nextShift = 3.5;  // seconds until he shifts his weight for no reason
    this._shiftT = 0;
    this._shiftDir = 1;

    this._t = 0;
  }

  /**
   * @param {number} vx  world units / second
   * @param {number} vy  world units / second
   * @param {number} maxSpeed  what counts as a full-speed walk
   * @param {number} dt  seconds, already clamped by the caller
   */
  update(vx, vy, maxSpeed, dt) {
    // Both ends clamped. A backgrounded tab hands back a huge deltaMS, and the
    // dampers below divide by it; one non-finite value reaching a Graphics call
    // takes the whole frame down rather than drawing one wrong pixel.
    const d = clamp(dt, 1 / 240, 0.05);
    this._t += d;

    const speed = Math.hypot(vx, vy);
    const prevDirX = this.dirX;
    this.speed01 = clamp(speed / (maxSpeed || 1), 0, 1);

    if (speed > 1e-3) {
      const nx = vx / speed, ny = vy / speed;
      // The MASS turns before the feet do. A rig that snaps to the input
      // direction reads as a cursor; the lag here is the whole difference.
      this.moveX = damp(this.moveX, nx, 11, d);
      this.moveY = damp(this.moveY, ny, 11, d);
      this.dirX = damp(this.dirX, nx, 8, d);
      this.dirY = damp(this.dirY, ny, 8, d);
    } else {
      this.moveX = damp(this.moveX, 0, 7, d);
      this.moveY = damp(this.moveY, 0, 7, d);
    }
    this.turn = damp(this.turn, (this.dirX - prevDirX) / d, 12, d);

    // ── THE CYCLE ADVANCES WITH DISTANCE ────────────────────────────
    // `travel` is in body radii, so the stride is the same shape whatever the
    // character is scaled to, and slowing down slows the legs exactly as much
    // as it slows him. This is the moonwalk fix and it is free.
    const rPerSec = speed / (this._r || 1);
    this.travel += rPerSec * d;

    // Steps taken, as a real number. One step = one foot cycle.
    const s = this.travel / GAIT.stepLen;

    // The projected forward and lateral axes. Screen-vertical movement is
    // foreshortened so a step away from camera does not cover as much ground
    // as a step across it.
    const fx = this.moveX, fy = this.moveY * PERSP_Y;
    // Lateral is perpendicular to travel, and it also collapses toward pure
    // horizontal as he turns to face up or down the screen — that is what
    // keeps his stance from looking like it has rotated out of the picture.
    const side = Math.hypot(this.moveX, this.moveY) > 0.05 ? -this.moveY : 1;
    const px = lerp(1, Math.abs(side), 0.35), py = this.moveX * PERSP_Y * 0.35;

    // ── FEET ────────────────────────────────────────────────────────
    for (const f of this.feet) {
      // u: 0..1 through this foot's own cycle. Half stance, half swing.
      const u = ((s + f.phase) % 1 + 1) % 1;
      const stance = u < 0.5;
      f.planted = stance && this.speed01 > 0.02;

      // Offset ALONG travel, in step lengths.
      //   stance: starts +1/2 ahead and slides to -1/2 behind. That slide is
      //           exactly the distance the body covers, which is what makes the
      //           foot appear nailed to the floor.
      //   swing:  eased back to +1/2, lifted on an arc.
      // `along` is in STRIDE units, and the +/-0.25 range is not a style
      // choice — it is the whole no-slip condition, and getting it wrong is
      // what skating IS.
      //
      // Over a stance (half a cycle) the body advances half a stride. So the
      // foot's offset from the body must fall by exactly half a stride in the
      // same time, or the difference is the distance it slides. Symmetric
      // about the body: +0.25 ahead at plant, -0.25 behind at lift-off.
      //
      // Worth writing down exactly, because I got it wrong twice in a row and
      // only the test knew. Let `u` be progress through the foot's cycle.
      //   d(footWorld) = d(bodyWorld) + d(along) * stride
      // and d(bodyWorld) = d(u) * stride. So zero slip requires
      //   d(along) = -d(u)  ->  along = 0.25 - u.
      // My first version used `0.5 - 2u` (foot moved a full stride while the
      // body moved half) and slid at exactly walking speed; the correction to
      // `0.25 - 0.5u` overshot the other way and slid at half. The test
      // measured 2.24 and then 1.14 world units per frame against a budget of
      // 0.35, which is how both were caught.
      let along, lift;
      if (stance) {
        along = 0.25 - u;                            // +0.25 -> -0.25, linear
        lift = 0;
      } else {
        const k = (u - 0.5) / 0.5;                   // 0..1 through the swing
        along = lerp(-0.25, 0.25, smooth(k));
        lift = Math.sin(k * Math.PI) * GAIT.lift;    // up and back down
      }

      // Blend the whole stride out as he stops, so the feet settle to their
      // standing positions instead of freezing mid-step.
      const w = this.speed01;
      const restX = f.phase < 0.25 ? -GAIT.standWidth : GAIT.standWidth;
      const stepX = along * GAIT.stepLen * fx + restX * px;
      const stepY = along * GAIT.stepLen * fy + restX * py;

      f.x = lerp(restX, stepX, w);
      f.y = lerp(0, stepY, w);
      f.lift = lift * w;
    }

    // ── BODY ────────────────────────────────────────────────────────
    // LOWEST at contact, HIGHEST at mid-stance, and BOTH the period and the
    // sign matter.
    //
    // The feet are half a cycle apart, so a footfall happens every HALF stride
    // — the bob therefore has period 0.5 in `s`, not 1.0. And negative is up
    // the screen, so contact must be POSITIVE (down, knees absorbing) and
    // mid-stance negative (up, passing over the straight support leg).
    // The first version had both wrong and the test caught it: it read as a
    // ball bouncing rather than a person walking.
    this.rise = Math.cos(s * TAU * 2) * GAIT.bob * this.speed01;

    // The mass leans over the foot carrying it. ONE sway per stride, so period
    // 1.0 in `s` — half as often as the bob. `sin(s*TAU)` is positive through
    // the left foot's stance and negative through the right's, which is
    // exactly the alternation wanted.
    this.shift = Math.sin(s * TAU) * GAIT.sway * this.speed01;

    // Hips lead, shoulders counter. Without this a walk reads as a mannequin
    // being pushed along.
    this.hip = Math.sin(s * TAU) * GAIT.hipRot * this.speed01;
    this.shoulder = -this.hip * 0.62;

    // Lean into travel, plus a kick from the turn rate so a hard change of
    // direction visibly costs him something.
    const leanTarget = this.moveX * 0.20 * this.speed01 + clamp(this.turn * 0.04, -0.16, 0.16);
    this.lean = damp(this.lean, leanTarget, 9, d);

    // ── IDLE, in three unrelated cycles ─────────────────────────────
    const idle = 1 - this.speed01;
    // Breathing. Slow, small, and it never stops — it just gets buried under
    // the walk.
    this.breath = Math.sin(this._t * 1.27) * 0.022 * idle;
    // A slow rock from foot to foot. The rate matters: at 0.63 against a
    // breath of 1.15 the two produced the SAME number of zero crossings over
    // fifteen seconds and would have lined up into one visible loop — the
    // exact failure this layering exists to avoid. 1.27 and 0.41 sit about
    // three to one apart and share no small factor.
    this.idleRock = Math.sin(this._t * 0.41) * 0.020 * idle;
    // And every few seconds he shifts his weight for no reason at all. That
    // one unpredictable beat is what separates "idle animation" from "idle
    // loop" — you cannot predict it, so you stop reading it as a cycle.
    this._nextShift -= d * idle;
    if (this._nextShift <= 0) {
      this._nextShift = 3.0 + (Math.abs(Math.sin(this._t * 12.9898)) * 4.0);
      this._shiftT = 1;
      this._shiftDir = -this._shiftDir;
    }
    // Kept in its OWN field rather than added into idleRock. They were summed,
    // and the consequence was that a fault injection which deleted the rock
    // entirely still passed every check — the random shift alone kept the
    // field moving. Two concepts in one number is untestable by construction;
    // the caller sums them, and each can now be guarded on its own.
    this.idleShift = 0;
    if (this._shiftT > 0) {
      this._shiftT = Math.max(0, this._shiftT - d * 1.4);
      const k = Math.sin((1 - this._shiftT) * Math.PI);
      this.idleShift = k * 0.045 * this._shiftDir * idle;
    }

    this._sanitize();
    return this;
  }

  /** The caller tells us how big he is, so `travel` can be in body radii. */
  setRadius(r) { this._r = r || 1; return this; }

  /** Last line of defence. Cheaper than auditing every branch above forever,
   *  and the failure it prevents is a hard freeze rather than a wrong pixel:
   *  one NaN reaching a Graphics call takes down the frame. */
  _sanitize() {
    const ok = (v, f = 0) => (Number.isFinite(v) ? v : f);
    this.travel = ok(this.travel);
    this.rise = ok(this.rise); this.shift = ok(this.shift);
    this.hip = ok(this.hip); this.shoulder = ok(this.shoulder);
    this.lean = ok(this.lean); this.turn = ok(this.turn);
    this.breath = ok(this.breath); this.idleRock = ok(this.idleRock);
    this.idleShift = ok(this.idleShift);
    this.moveX = ok(this.moveX); this.moveY = ok(this.moveY, 1);
    this.dirX = ok(this.dirX); this.dirY = ok(this.dirY, 1);
    this.speed01 = clamp(ok(this.speed01), 0, 1);
    for (const f of this.feet) {
      f.x = ok(f.x); f.y = ok(f.y); f.lift = ok(f.lift, 0);
    }
  }

  /** Where a foot actually is on screen, in multiples of r, relative to the
   *  body's ground point. Separated from `feet` because the LIFT must not move
   *  the shadow — the shadow is the ground truth that sells the plant. */
  footDraw(i) {
    const f = this.feet[i];
    return { x: f.x + this.shift * 0.35, y: f.y - f.lift, shadowY: f.y, lift: f.lift, planted: f.planted };
  }

  /** The body's own offset: bob, breath, weight shift and idle rock, combined. */
  bodyOffset() {
    return {
      x: this.shift,
      y: this.rise + this.breath,
      roll: this.idleRock + this.idleShift,
    };
  }
}
