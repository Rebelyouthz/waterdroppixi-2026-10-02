# The Polish Pass — full-game visual and feel overhaul

Written down rather than left in chat so it survives between sessions, and so
nothing gets quietly skipped. Ordered the way the work was requested: in-game
first, then the HUD, then menus, then the side games.

Each phase is independently shippable. A phase is DONE only when every item
under it is done — no partial ticks.

---

## ⇢ MANDATORY: read this before touching anything, every session

Timmy's own words on why this block exists: *"när kontex är fullt de inte
kul när de blir summering varje ggr de måste stå exakt va nästa agent måste
gå igenom för å bli helt uppdaterad analysera hela spelet se helheten de
gömmer den alltid ba hoppar in å ska fortsätta me de man är precis i men
utan å veta helheten så de blir helt fel oftast"* — a context-compaction
summary hands you the narrow thing the previous session was mid-task on,
not the whole game, and jumping straight into that narrow thing without the
big picture produces wrong work more often than not. This section is the
fix: concrete steps, not just prose to skim.

**Do these, in order, before resuming or starting any task:**

1. **Read this file's structure first, not just the last section.** Run
   `grep -n "^#" docs/POLISH-PASS.md` to see every phase/session heading,
   then actually read the last 2-3 session entries in full (search for the
   most recent `## Session` / dated headings) — the tail of the file is
   this session's work in detail, but the phases above it are the standing
   spec for the whole game and are still load-bearing.
2. **Read the Claude memory index** at
   `C:\Users\timmi\.claude\projects\C--Users-timmi-WaterdropPixi\memory\MEMORY.md`
   and open every file it links to. This is where deferred feature
   requests live — `waterdrop-backlog-index.md` in particular is a list of
   named, numbered backlog items (TCG depth, Prospector visuals, Star
   Atlas depth, Forge merge minigame, gore/wound variety per projectile,
   Base Defender minigame, wave-pacing/map-backdrop rework, desktop/mobile
   parity) that are NOT in this file and that Timmy has explicitly asked
   to be left alone until he raises them again. Do not start any of them
   unprompted; do not lose track of them either.
3. **Check `git log --oneline -20` and `git status`.** This file records
   intent and reasoning; git records what actually landed. They can drift —
   trust git for "is X actually in the code" and this file for "why was X
   built that way."
4. **Launch the real game and click through it yourself** before writing
   any code — see the `run` skill / `START-SPELET.bat`, or the CDP harness
   pattern in `scratchpad/cdp.mjs` + `scratchpad/real_levelup_loop.mjs` for
   headless verification. At minimum open: the Camp screen and its full
   tab bar, a level-up card row (force one via
   `window.__game.addXp(500000)` in devtools), Weaponsmith, and whichever
   screen the task at hand actually touches. A screenshot you took
   yourself beats a paragraph of memory every time — this file says that
   about six different ways below because it kept being true.
5. **Only then** decide what to work on — either the specific thing Timmy
   just asked for, or if he said "keep going" / "kör på" with no specific
   target, the next reasonable item from step 1-2's combined picture.

**What NOT to do:** don't assume the narrow task visible in a compacted
summary is the whole state of the project. Don't skip the memory files
because "I remember roughly what they say" — they get corrected and
superseded, and a stale claim asserted as current fact is worse than
admitting you haven't checked. Don't re-litigate settled decisions (the
PixiJS card rebuild, the blood-red color rule, the common-tier gears) —
search this file for them first if something looks like it might already
be a decided question.

---

## Phase 1 — The character  ✅ DONE

The waterdrop is the thing the player looks at for the entire run. It got a
real rig.

- [x] **`heroAnim.js`** — one module that derives the whole animation state
      from player state each frame. Pure function, no drawing, no game logic.
- [x] **Directional facing** — moving up shows his back, moving down shows his
      front, moving sideways shows a profile. Facing turns are `lerp`ed, never
      snapped.
- [x] **Aim-vs-move decoupling** — aiming right while running left reads as a
      backpedal; aiming and moving the same way reads as a run. Strafe angle
      drives lean.
- [x] **Glide / slide** — a hard direction reversal at speed skids before it
      takes the new heading, with the body leaning back into the slide and a
      spray of droplets off the contact edge.
- [x] **Six face expressions** — calm, focused, happy, hurt, angry, rage.
      Driven by HP, combo, damage taken, reload and kill streak.
- [x] **Eye blinking** — irregular, with the occasional double-blink.
- [x] **Idle animation** — breathing, sway, surface ripple, an idle "settle"
      wobble that builds the longer you stand still.
- [x] **Body recoil** — firing kicks the whole body back and wobbles it, not
      just the gun.
- [x] **Water feel** — squash/stretch on accel, surface wobble springs,
      jiggle that carries momentum, a meniscus rim highlight and internal
      refraction band.

## Phase 2 — The HUD  ⬜ NEXT

- [ ] One HP meter and one XP meter, built into a single ornate frame.
- [ ] XP as a waterdrop that sloshes and fills, resetting on level-up.
- [ ] HP as a U-shaped arc wrapping the droplet.
- [ ] The frame between them rendered as coiling oil/smoke.
- [ ] Combo meter back down between the joysticks, with the multiplier on it.
- [ ] Total score up top.
- [ ] Active weapon + skill icons organised into one readable cluster.
- [ ] The long horizontal HP bar removed.

## Reported during play — outstanding  ⬜ TODO

Raised while testing; not yet done. Listed here so they are not lost.

- [x] **Reward screen dopamine** — new `PayoutScreen.jsx`: rotating light rays,
      confetti, a diagonal sweep across the panel, chests that pop in sequence,
      numbers that count up, per-currency colour coding.
- [x] **Story-mission claim must SHOW the payout** — a ledger now records every
      grant as it happens and the screen renders all of it.
- [x] **Background** — galaxy and planet moved to opposite diagonals (they were
      ~200px apart with the galaxy's 190px halo reaching into the planet).
- [x] **Galaxy detail** — dust lanes on the inner arm edges, outer wisps, HII
      star-forming regions, a warmer core gradient and a central bar.
- [x] **Planet detail** — DONE, and the note above was stale: it already had real orthographic continents, ocean depth banding, cloud cells, a cyclone, a terminator, city lights on the night side and an occluded sun behind it. Added the one genuinely missing thing: a specular sun-glint on the ocean.
- [x] **Dwarf star detail** — DONE. Was eight concentric circles, a white dot and four straight lines; now a chromatic corona, 46 uneven coronal rays, limb brightening, tapered diffraction spikes, an anamorphic streak and a lens-ghost chain.

## Phase 3 — Lighting  🟨 IN PROGRESS

Per the `waterdrop-lighting` skill — no generic glow filters.

- [ ] Muzzle flash lights the character's front face specifically.
- [ ] Muzzle flash reaches enemies within ~2.5–3 enemy-widths, and no further.
- [x] Projectile light carries that projectile's own colour onto enemies it
      passes, within ~2–3 enemy-widths — reach 5×→7× size, mix cap 0.46→0.62,
      falloff eased instead of squared.
- [x] Strong projectile light blows out toward white rather than staying a
      flat saturated hue, so the hot core reads white-green and the tint only
      shows at the edge of the pool. This is what kills the harsh
      colour-on-colour contrast.
- [ ] Light bounce/falloff tuned per surface.

## Phase 4 — Particles, damage and death  ⬜ TODO

- [ ] Blood: sprays, droplets, running streaks, ground pools that persist.
- [ ] Sparks and splashes differentiated per projectile type.
- [ ] Enemy damage state: bullet holes, burn marks, frost, ignition.
- [ ] Progressive dismemberment — parts blown off piece by piece.
- [ ] Death animations varied by what killed them.

## Phase 5 — Space background  ⬜ TODO

- [ ] Planets, galaxies, nebulae upgraded.
- [ ] Star parallax depth layers polished.

## Phase 6 — Menus  ⬜ TODO

Every menu, every submenu, every reward moment.

- [ ] Storyline as a real node MAP with a background, not a list of buttons.
- [ ] Difficulty emblems that grow more dangerous per tier.
- [x] **Level-up cards** — rebuilt in `overhaul.css` (`LEVEL-UP CARD v2`):
      - Rarity name moved off the bevelled corner onto a full plate inset
        26px from the top, where no rarity silhouette can reach it. This was
        a real defect, not a taste call: "UNCOMMON" rendered as "NCOMMON"
        and "RARE" as "ARE" in play.
      - Pointer-tracked tilt + specular sheen, driven from
        `--tilt-x/--tilt-y/--spec-x/--spec-y` written by `onPointerMove` in
        `LevelUpModal.jsx`. No `preserve-3d` — `.card` carries `overflow:
        hidden` and a `clip-path`, either of which flattens the context.
      - Faceted gem bezel around the portrait, turning on its own timer.
      - Rarity pips on the plate, so tier reads as a count as well as a
        colour (hidden below 560px, where they'd push the word out).
      - Hover sound (`Audio.cardHover`, pitched by rarity), real press
        response, and a hover rule that can't freeze the pick-out animation.
      - **Before → after row**: `engine.statCompare()` resolves the pick
        against the live run, so a card reads `320% → 325%` instead of only
        `+5%`. Covered by `cards.test.mjs` (12 checks).
      - Fixed while here: every negative-amount card rendered its sign twice
        (`--19% reload time`), and reload/skill-cooldown gains would have
        been coloured red as losses.
- [ ] Weaponsmith before/after comparison with coloured stat bars.
- [ ] Per-weapon upgrade names — no shared generic names across weapons.
- [ ] Skill tree.
- [ ] Lucky wheel.
- [ ] Reward screens.
- [ ] Dopamine feedback on every purchase, claim and unlock.

## Phase 7 — Side games  ⬜ TODO

- [ ] Star Raid, Prospector, Clicker, Base Defence, TCG, Patrol, Exploration —
      visual polish and feel on each, plus their menus.

---

## Reference — what the HUD borrows from, and why

Surveyed the genre and pulled from three, rather than inventing from nothing:

| Source | What was taken | Why it fits here |
|---|---|---|
| **Dead Cells** | Ornate metal frame with the resource *inside* the frame, not beside it | The camp UI is already Dead-Cells-flavoured; the HUD was the one place that wasn't |
| **Hollow Knight** | A vessel that visibly fills with liquid, and empties in discrete units | Matches the waterdrop premise exactly — the XP droplet IS the vessel |
| **Hades** | Combo/heat readout kept low-centre and close to the hands | Keeps the multiplier in the thumb's field of view without stealing the top bar |

The rejected option was a conventional top-left bar stack: it reads as a
generic action game, wastes the one piece of visual identity the game has
(the drop), and the user had already said the long bar was the problem.

## Known bugs found during the polish pass — NOT yet fixed

- [ ] **Rank-up celebration can never fire.** `save.pendingLevelUp` is read and
      cleared in `Camp.jsx` (it drives `LevelUpOverlay`, the "RANK UP!" screen
      with confetti, lasers and the reward list) but it is **never written**
      anywhere in the codebase. The `pendingLevelUp` at `engine.js:685` is an
      unrelated in-run boolean for the level-up *card* modal. `store.js:473`
      grants profile XP and increments `profile.level` without ever setting
      the pending payload, so the entire overlay is unreachable — the player
      has never seen it once.
      Two things to fix together when picked up:
      1. Write `pendingLevelUp` in the store when `profile.level` increases.
      2. The overlay is titled "RANK UP!" and prints `RANK {r.level}`, but
         `r.level` is the PROFILE level, not the rank. Rank only changes every
         4 levels (`getRank = floor(level/4)`), so as written it would claim a
         rank-up on every profile level and print the wrong number.

## Later (user-directed, not started)

- [ ] Astro Prospector — user says this should be an entirely separate game.
- [ ] Clicker needs more depth and a reason to engage.
- [ ] Achievements + Maps: sort menus and sub-menus better.
- [ ] Star Atlas — user is happy with it as-is.

---

# THEME PASS — remaining work (user-directed, in order)

Rule established with the user: **adapt the reference images to this game,
never clone them.** Where a mockup shows something illogical for Waterdrop
Survivor (its robot hero, its fantasy-loot gold, its fake telemetry charts),
do what is logical for THIS game instead.

Mechanism: every panel shares one shell and sets a single `--pt` R,G,B
variable; the shell derives glow, frame, texture, title band and headings
from it. Adding a screen is one line. See `PANEL THEMES` in overhaul.css.

## Menus — done
- [x] Level-up cards (reference: "dessa är bäst" / "också bästa")
- [x] Weaponsmith frame + all 38 weapon icons (21 were drawing the same pistol)
- [x] Character sheet + waterdrop portrait (NOT the reference's robot)
- [x] Meta upgrades — circuit board, slider knob on the fill
- [x] Talent tree — rune scroll, medallion nodes
- [x] Deep statistics — grouped into 4 named sections
- [x] Death screen — neon stat instruments, rank medallion, coin rewards
- [x] Pets — neon-outline treatment (the one screen that stays outline, not fill)
- [x] Global dopamine layer — hover lift, press push, inert disabled state
- [x] Per-panel themes: profile, talents, tcg, mission, loadout, craft, parts,
      settings, badges

## Menus — still to do
- [ ] **Attributes panel** (home screen) — user wants this treatment applied to
      EVERY screen in the game, so it is the template to finish first.
- [ ] Reward screen / PayoutScreen — user called this out twice.
- [ ] Profile level-up + rank-up overlay — wiring fixed, visuals still plain.
- [ ] Skill tree
- [ ] Lucky wheel / card shop
- [ ] Gear + equipment
- [ ] Maps / storyline node map (should be a real map, not a button list)
- [ ] Achievements + Codex
- [ ] Season pass, Patrol, Daily/Weekly quests
- [ ] Star Raid menus (user: the Star Atlas itself is already good)
- [ ] Base Defence, TCG contents, Exploration
- [ ] Clicker — user wants more DEPTH and a reason to engage, not just polish

## After the menus
- [ ] UI pass (HUD — Phase 2 above is still open)
- [ ] In-game pass (Phases 3-5: lighting, particles/damage/death, background)

## Deferred by the user
- [ ] Astro Prospector — user says it should be an entirely separate game.
- [ ] Sort menus and sub-menus into a better information hierarchy.

## Theme pass — session 2 progress

- [x] Attributes panel — built as the TEMPLATE for the whole game. House rule
      it establishes: recessed board -> seated modules -> medallion icons ->
      ONE accent hue per screen -> only the actionable thing moves.
- [x] Reward / Payout — the fix was SEQUENCING, not more effects. Panel lands,
      rows arrive staggered, each value strikes on arrival, CTA appears last.
- [x] Skill tree — deep-space chart (the one screen where "seated modules" is
      wrong, because it pans). Buy button is the only pulse.
- [x] Gear / artifacts — empty slots dashed and inviting, filled slots seated.
- [x] Chest / card shop — chest rattles during the pull (the ONLY shake in the
      game, so it reads unambiguously), result reveals with a punch.
- [x] Codex / achievements — undiscovered entries drained but never hidden.
- [x] Season pass — track with a visible "next", claimed states dimmed behind.
- [x] Clicker — economy made legible (well responds, rate is the loudest
      element, each purchase shows the rate it adds, next milestone visible).

### Clicker: DEPTH still owed (design, not styling)
The user's actual note was that the Clicker has no REASON to engage. Styling
cannot fix that. Open design work:
- [ ] A reason to return: offline accrual that visibly banks while away.
- [ ] A second currency or prestige loop so the numbers mean something.
- [ ] Tie its output into the main game economy so it is not a closed box.

## Menus still to theme
- [ ] Maps / storyline node map (should be a real map, not a button list)
- [ ] Patrol, Daily/Weekly quests
- [ ] Star Raid menus (Atlas itself already good per user)
- [ ] Base Defence, TCG contents, Exploration
- [ ] Lucky wheel

## Theme pass — session 3

- [x] Maps / storyline — treated as a ROUTE: cleared nodes read as behind you,
      the takeable node is the only pulsing thing, locked stages stay visible
      but dark (a hidden route teaches nothing). Deliberately did NOT fake a
      hand-drawn parchment continent — that needs real art, and gradients
      pretending to be one look worse than an honest chart.
- [x] Patrol — the running bar is the hero (it is the only screen about time
      passing rather than a choice now); idle slots stay quiet, claimable is loud.
- [x] Exploration — the walker is the only moving thing; risky stakes look
      like a gamble rather than another option. Green accent because nothing
      is fighting here and the combat palette would set a wrong expectation.
- [x] Star Raid — card/shop furniture only. The Atlas is untouched, per the
      user saying it is already good.
- [x] CLICKER DEPTH — Springs (prestige). sqrt(lifetime/1e6) gain, +5% per
      Spring, permanent. Reset clears buildings/drops/clickLvl but KEEPS
      lifetime total, claimed milestones and banked Springs. 22 tests in
      test/clicker.test.mjs pin the exploit (double-reset pays nothing) and
      the no-punish rule.
- [x] Renamed Astro Prospector -> LOOTMINE in display strings only.
      Identifiers, data-testids, filenames and imports intentionally left as
      `prospector` — renaming those breaks routing/tests for no visible gain.
      Finish the rename properly when the real Astro Prospector is built.

## Still owed
- [ ] Clicker: offline accrual you can SEE banking on return; tie output into
      the main economy so it is not a closed box.
- [ ] Lucky wheel / daily spin.
- [ ] Base Defence, TCG contents.
- [ ] Then: UI/HUD pass (Phase 2), then in-game (Phases 3-5).

## Theme pass — session 4 (menus COMPLETE)

- [x] Lucky wheel — chasing rim lamps, pointer that flaps as slices strike it,
      result lands with a punch instead of fading in. Gold-on-black on purpose:
      a wheel sharing the palette behind it reads as a diagram, not a machine.
- [x] Pet TCG — cards borrow the LEVEL-UP CARD vocabulary (cost top-left, kind
      as small caps, power struck bottom-right) rather than inventing a second
      card language the player has to learn twice.
- [x] The Base — stone and lamplight; the one warm, built room in a game
      otherwise set in cold water and space. Companions use the shared
      medallion vocabulary.
- [x] Base Defence — deliberately the LEAST decorated screen: high contrast,
      no ambient motion, wave bar loudest. Under pressure the player has no
      attention to spare for decoration.

### HUD (Phase 2) — started
- [x] MAG readout removed. It sat bottom-centre, which is exactly where the
      vessel gauge lives, so it printed across the gauge on a phone — the user
      reported this. The magazine is already legible from the character's own
      reload animation, so it was spending the most valuable strip of screen
      to repeat something already visible.
- [x] NO-HIT moved up under the score with the rest of the run state. It is a
      run-defining status that can be lost in an instant, so it keeps a
      readout — just not one lying on top of the health gauge.
- [ ] Frame between HP and XP rendered as coiling oil/smoke (still open).
- [ ] Weapon + skill icons into one readable cluster (still open).

## TODO — Combat juice: camera + kill callouts (user spec, DO NOT build yet)

User was explicit that this goes on the list rather than being built now, and
was equally explicit about the constraints. The constraints ARE the feature —
build it without them and it becomes screen spam.

### Camera
- [ ] Slight lean / follow — camera drifts with aim and movement rather than
      being rigidly centred.
- [ ] Shake on: headshot, super crit, mega crit. (NOT on ordinary hits.)

### Kill callouts — "SUPER KILL / FANTASTIC / GODLIKE"
- [ ] Trigger ONLY on multi-kill: several enemies dying at once with one
      weapon. Never per-kill.
- [ ] Deliberately RARE. The user's words: it should "really feel good when it
      finally comes". Frequency is the whole design — if it fires often it is
      worthless. Err far on the side of too seldom.
- [ ] NOT tied to combo. Combo already has its own meter and its own escalation
      (see the new `rampage` expression at combo 60). A very occasional combo
      callout is allowed, but it must be rare even by these standards.
- [ ] Must not sit in the way of play. Placement has to dodge the vessel gauge,
      the joysticks and the score — the same trap the MAG readout fell into.

### Headshot text
- [ ] Styled like the existing DODGE popup: red on black. Reuse that component
      rather than inventing a second floating-text style.

### Why this is not built yet
Rarity tuning needs the game playable on the phone to judge. Shipping it
blind would mean picking thresholds by guesswork, and the one thing that
would ruin it is firing too often.

## TODO — Joysticks as instrument clusters (user spec, do AFTER current work)

The core idea: the top of each dial should read like a CAR SPEEDOMETER, with
the active-skill pod built INTO the bezel rather than sitting on top of it.
Keep the pod roughly where it is — the change is that it becomes part of the
instrument, not a chip parked on the rim.

- [ ] Skill pod recessed into the upper bezel like a dashboard binnacle.
      (Current CSS approximates this; needs a real notch cut into the SVG
      bezel path so the housing is genuinely part of the dial.)
- [ ] The engraved H2O mark should read more clearly — it is currently the
      dimmest thing on a dial that is otherwise busy.
- [ ] LEFT dial = DASH cooldown, shown as colour/light on the dial itself:
      lit when ready, greyed while charging.
- [ ] RIGHT dial = the second active skill's cooldown, same language.
      (Both dials already stroke a charge arc — this is about making the
      WHOLE dial read as charged/uncharged, not just the ring.)
- [ ] Swipe the left stick to dash in the swiped direction.
      NOTE: this already exists (MobileControls dashStart -> onDashDir ->
      engine.tryDash) and is already gated on the skill-tree unlock
      (`if (!s.dash) return` in tryDash). What is missing is the VISUAL: a
      locked dash must look locked on the dial, not silently do nothing.
- [ ] General polish pass on joysticks and buttons.

## TODO — HP / XP gauge: make it alive (user spec)

- [ ] The gauge should look like it is RUNNING: liquid flowing, dripping,
      with fog / oil / mist rather than a static fill.
- [ ] User supplied a reference sketch for the HP and XP bars.
- Current state: the vessel gauge already slosh-fills with a travelling wave
  and splashes on level-up. What is missing is the between-states life —
  drips off the rim, mist at the surface, the HP arc reading as fluid rather
  than as a stroked path.

## Session: overflow + daily spin (2026-08-09)

### Fixed

**Daily spin wheel invisible — my regression.** My wheel-theming block in
`overhaul.css` set `position: relative` on `.spin-wheel-rim`. `index.css` sizes
that rim with `position: absolute; inset: 0`, and `inset` only sizes an
*absolutely* positioned box — so the rim collapsed to zero and took the face
(`inset: 7px`) with it. Only the pointer and the lamps, which position
themselves with their own transforms, still rendered. The override is now
purely additive (colour/glow); all geometry is left to `index.css`.

I had previously told the user "my wheel CSS only touched colour and glow, not
rotation" — that was wrong, and this was the cause.

Also fixed in the same area: `spinFlap` keyframes set `transform: rotate(...)`,
which replaced the base `translateX(-50%)` and shoved the pointer half its width
right for the duration of every spin. Keyframes now repeat the centring.

**Menus hanging off the right edge of the screen** (meta upgrades, weaponsmith
tabs). Two distinct causes, both now fixed and guarded:

1. `grid-template-columns: 1fr` is shorthand for `minmax(auto, 1fr)`, and that
   `auto` floor is the item's **min-content width** — a track can never render
   narrower. Two meta upgrades have `max: 20`, and `.pips` draws one 14px pip per
   level in a non-wrapping flex row: 20x16px + 19x3px gap = **377px** of
   min-content against a ~327px column on a 393px phone. Swept all 42 track
   definitions across both sheets to `minmax(0, 1fr)`, and fixed px floors to
   `minmax(min(220px, 100%), 1fr)`. This only ever *removes* a floor, so it
   cannot change a layout that already fit. Pips additionally flex down from
   14px to 4px so they compress in one row rather than wrapping ragged.
2. `.gear-tabs` was a bare non-wrapping flex row; four labels (TUNING /
   PARTS & RUNES / BLUEPRINTS / SYNERGY) exceeded the width and got sliced
   mid-word. Now wraps to two even rows. Shared by weaponsmith, campaign, gear
   and TCG screens.

New `frontend/test/layout.test.mjs` (4 checks, wired into `npm run test:logic`,
now 92 total) guards both: it rejects any bare `fr` track on `.upgrade-grid` and
recomputes the worst-case pip row width from `data.js`, so adding a wider meta
upgrade fails the build rather than the phone. **Verified the guard actually
fails on the pre-fix CSS** — a green test that never goes red proves nothing.

### Still open (next session)

- Hero eye detaches from the head silhouette when aiming/moving right (screenshot IMG_0141)
- Enemies — notably the small purple ones — lock onto the player and stay glued until death
- Parallax backdrop polish: earth, galaxies, sun, stars
- Blood/gib/particle polish: ground splash, spray along the shot vector, bullet holes only from gunshots
- Per-weapon muzzle flashes, bullet visuals, distinct reload animations (audio done, visuals not)
- Samurai katana melee weapon; lightning-from-heaven rework (must not start at max level)
- Joystick instrument-cluster rework; living HP/XP gauge
- Camera lean/shake + rare multi-kill callouts (recorded, deliberately not built yet)

## Gear parts overhaul + enemy faces — spec (2026-08-09)

Verbatim intent from the user, recorded before implementation so nothing is lost.

### Gear parts / blueprints economy
- New currency line: **gear parts, one type per slot** — boots parts, helmet
  parts, armor parts, etc. Not one generic part.
- Parts **level up equipment**, and levelling can carry an item all the way to
  **mythic+** rarity (a new tier above the current top).
- Levelling happens **on the equipped item**.
- Parts drop **everywhere**: in-run, clicker, Star Atlas, exploration, card
  game, every mini game. "lite här å var" — a trickle from each source.

### Drop rebalance
- **Halve** the current equipment/gear drop rate.
- Move equipment drops onto **boss cleared** — a boss kill should drop
  equipment; outside that it should be **very rare**.

### Content
- **3 new kinds of every equipment type** (boots, helmet, armor, ...).
- **3 new artifacts.**
- **More stages in Star Atlas.**

### Gear UI
- Tapping a slot (filled or empty) currently opens a panel pinned to the
  BOTTOM. It should open **beside the slot that was tapped** instead.
- The bottom area then holds the **inventory, sorted best -> worst**, with
  equipped items shown there too.

### Enemy faces — DROPPED
Proposed (hero-style eyes on the green enemies, expressions, going red/bulging
just before death) and then cancelled by the user the same session: "Skit i
ögonen". Not to be built. Recorded only so it does not get re-proposed.

### Also outstanding
Deeper stats and upgrade systems generally -- my own proposals welcome.
Code review deferred until the whole list is done.

### Gear overhaul — built so far (2026-08-09)

Done and covered by `frontend/test/gear.test.mjs` (19 checks):

- **Per-slot parts.** `save.parts = { helmet, chest, arms, legs, boots, ring,
  amulet }`. The old generic `gearParts` is deliberately KEPT rather than
  replaced -- the base builder and base defence already spend it, and it now
  doubles as a wildcard that tops up any slot at 2:1 (`WILDCARD_PART_RATE`).
  That means every existing save keeps working with no migration: a player
  holding only generic parts can still level anything.
  `gearLevelPayment()` owns the "slot parts first, wildcards for the
  shortfall" rule so the button's enabled state and the actual spend cannot
  disagree.
- **Mythic+**, a 7th rarity above mythical. Explicitly NOT on the drop table
  (proved by a 300k-roll test) -- the only way to hold one is to forge three
  maxed mythicals, which makes it the one rarity that is earned rather than
  found. `MERGE_ODDS` gained an explicit final entry (0.09); without it the
  last step fell through to a `?? 0.18` default and was no harder than the
  step before it.
- **5 base types per slot, 35 total**, each with its own icon id and a stat
  `weight` that biases the roll plus a `mult` that trades stat size against
  that bias. The base supplies the item's noun, so names read "Etched
  Magboots" rather than a generic slot word. Generation-side only -- items
  still store a plain `stat`/`val`, so nothing downstream had to change.
- **Drop rebalance.** `gearDropHappens(isBoss)`: a boss ALWAYS drops
  equipment, otherwise ~6%. Everything that used to be an equipment drop and
  no longer is now pays parts instead, so a pickup never turns into nothing.
- **Parts drop everywhere**: in-run kills, clicker milestones, exploration
  loot nodes.
- **3 new artifact affixes**: Evasion (dodge), Providence (luck),
  Marksmanship (headshot). Deliberately NOT projSpeed/projRange -- artifacts
  apply additively onto `result[stat]`, and those two are multipliers
  defaulting to 1, so an artifact rolling 0.05 would have cut projectile
  speed to a twentieth instead of adding 5%.
- **Star Atlas: 3 stages -> 7** (Shattered Ring, Solar Furnace, Nebula
  Graveyard, Event Horizon), continuing the existing curve shape rather than
  spiking.

Still to do on this brief:
- Gear slot UI: popover beside the tapped slot instead of the bottom panel;
  inventory sorted best -> worst underneath.
- Custom SVG glyphs for the 35 base-type icons (ids are wired, art is not).
- Parts drops from the card game and the remaining mini games.

### Rune sockets by rarity (2026-08-09)

**Runes already worked** end to end -- `rollRune` -> `runeInventory` ->
socket -> `applyRunesToStats`, which `GameScreen.jsx` calls into the live
run. Two real defects were found while checking, both now fixed:

1. **Sockets were shown on gear that could never be socketed.** The item list
   drew a socket pip from `gearHasSocket(item)`, which was true for anything
   that rolled `socket: true`, but the socketing UI was gated on
   `RUNE_GEAR_SLOTS.includes(slot)` -- ring and amulet only. An epic helmet
   with a socket advertised it and had nowhere to put a rune.
2. **Runes belonged to the SLOT, not the item.** `gearRunes` was
   `{ ring: runeId }`, so swapping your ring left the rune on the finger.

Now:
- Socket count is rolled per item from `SOCKET_ODDS`, weighted by rarity:
  common never, magic 15% of one, rare ~55% of one, epic up to 2, legendary
  1-3, mythical mostly 2-3, mythic+ always 2-3. Rarity sets the ODDS rather
  than a flat number, so two legendaries are not interchangeable.
- Rings and amulets keep a floor of one socket.
- `gearRunes` is keyed by ITEM id with an array, so runes travel with the
  piece and up to three fit.
- Only runes in EQUIPPED gear pay out, and the same rune can never be counted
  twice.
- **No save migration.** `gearSocketCount` reads legacy items through (old
  boolean `socket` = 1, legacy rings keep their implicit socket) and
  `applyRunesToStats` still honours old slot-keyed entries, so nobody loses
  runes they already earned.

Covered by 7 new checks in `gear.test.mjs` (26 total).

### Two real bugs found and fixed (2026-08-09)

**Enemies glued to the player.** `updateEnemies` had a `// separation - mild`
comment with NO CODE under it — nothing ever stopped an enemy walking into the
player. The chase normal recomputes toward the player every frame, so once a
fast enemy arrived it drove into the hitbox, overshot, flipped, and jittered on
the spot while contact damage retriggered on its 0.32s cooldown. Simulated:
**588 of 600 frames at distance 0.00** — literally inside the player. Anything
faster than you was unshakeable.
Non-boss enemies are now pushed back onto the contact ring. They still touch
and still deal damage (the check is `d < sumR + 4`), but can no longer occupy
you. Bosses are exempt — being shoved off one would read as it backing away.

**"The eye goes weird when aiming and running right."** It was the BROW, not
the eye. The face is laid out as if the head were a circle, but the body is a
teardrop that narrows to a point. Sweeping every angle: the sclera was fine
(0.004r), but a raised brow in a hard profile landed at y = -1.14r — where the
drop is **0.009r wide** — while still reaching to 0.70r. It overflowed the
silhouette by **0.693r**, nearly a whole body radius, hanging in open space.
Fixed with two clamps, and both are needed: a ceiling on brow height, AND a
clamp of the tilted ends, because a hard tilt still lifted the inner end past
the tip where there is no width to clamp against. New `heroHalfWidthAt()` in
heroShape.js (LUT, built once) is the single source of truth for the
silhouette's width at any height. Verified over **336,200 angle combinations:
zero overflow**.

New `test/physics.test.mjs` (11 checks) guards both, and each has a CONTROL
check asserting the original bug still reproduces without the fix — a green
test that can never go red proves nothing.

Suite now 134 checks.

### Blood, wounds and ground decals (2026-08-09)

**The "bullet holes in the ground blood" was a black circle.** `_drawDecals`
painted `#000000` at half the pool's radius as a "clotted core" — pure black
punched through every pool and read as a hole shot in the blood. It is now a
darkened shade of the pool's OWN colour, pushed off-centre so it reads as
thicker liquid settling to one side.

**Bullet holes were stamped for every non-fire/ice hit** — a katana slash, a
laser beam and a shockwave all punched identical neat round holes. Wound kind
now comes from the weapon's behaviour (`_curWeaponBehaviour`, set alongside
`_curWeaponColor`), with element still winning when there is one:

| behaviour | wound | look |
|---|---|---|
| projectile / shotgun | `hole` | punch-through, torn lip on the entry side, bruise ring |
| melee / orbit | `gash` | open cut ACROSS the blow, parted lips, wet interior |
| beam | `sear` | cauterised streak along the beam, glowing core, no cavity |
| chain | `arc` | Lichtenberg burn with branching veins |
| aoe / meteor | `blunt` | bruise that darkens inward, skin split in short tears |
| (fire / ice element) | `burn` / `frost` | unchanged |

Directional wounds carry the impact angle, so a slash reads as a slash.

**Ground pools** are now irregular polygons (two octaves of deterministic
noise seeded from the decal's position, so a pool keeps its shape for life
and no two match), with a soak halo, and settle differently by kind: blood
clots, fire leaves live embers breathing in scorched ground, ice freezes to a
shard crust, poison bubbles and pops, electricity keeps snapping arcs. Kind
is derived in `pushBloodDecal` — the one funnel every decal passes through —
rather than at each call site.

**Spatter is directional.** It used to fire at `Math.random() * TAU`,
identical whether you shot them from the left or dropped a meteor on them.
Now: a forward cone along the shot, exit spatter landing as a smear on the
ground BEYOND the body, and back-spatter thrown toward the shooter. One
droplet in five still goes anywhere at all — a perfectly obedient cone looks
generated.

**Three grades of droplet**, and they differ in more than size: mist smears
into long thin streaks (light and fast), ordinary spatter behaves normally,
and fat drops barely deform and land near-opaque. That difference in STRETCH
is what makes them read as different substances.

**Arterial bleed**: enemies past 35% damage pump in rhythmic spurts from
their worst wound, pulse rate rising as they weaken. One timer per enemy,
only on enemies actually hurt.

### Weapon progression rebalance + card level dots (2026-08-09)

**Every weapon now has 10–12 levels** (was 6–8) and starts weak.

- Single-shot weapons start at **1 projectile**; shotguns and chains start at
  **3**. Deliberate: a shotgun firing one pellet is not a weak shotgun, it is
  a bad pistol — the spread IS the weapon. The user agreed ("hagel måste ha
  några såklart").
- Projectile gains are **spaced out, not every level**. Spread weapons gain
  sooner and more often (reaching 6–9); single-shot weapons gain rarely
  (reaching 2–3), so their levels are mostly damage and handling.
- The levels between projectile gains rotate through the genre's usual mix:
  damage, fire rate, reload, **area**, projectile speed, projectile size,
  crit — offset by weapon id so two weapons of the same behaviour don't end
  up with identical trees.
- Starting damage was raised where a weapon lost most of its output (a
  9-pellet scatter dropping to 3 would otherwise do a third of its damage),
  capped at 2.6x so it still starts weaker than before.

Measured over the full tree: **average 2.55x damage**, plus projectile growth.
Not overkill. One outlier to watch: `sniperDrop` at 4.38x.

**Level dots on cards.** Taking the same card again levels the pick, but the
card never showed how far along it was. Weapon cards already carried
`lvl`/`maxLvl`; **passives had no stack record at all** — a card stacked four
times looked identical to one never seen. Added `run.cardStacks`, incremented
in `applyCardChoice`, and both card kinds now render a row of dots: lit dots
glow in the card's rarity colour, and the NEXT dot pulses so the pick reads at
a glance without reading text. Dots shrink on narrow screens so a 12-level
tree cannot widen the card, and the pulse respects `prefers-reduced-motion`.

`CARD_MAX_STACKS = 10` matches the weapon trees so both card kinds read on the
same scale.

### Tidecutter Katana (2026-08-09)

The game's first true melee weapon, and the first user of the `melee`
behaviour — which the wound system already mapped to a `gash` (an open cut
across the blow) rather than a bullet hole, so it slots straight in.

Reads deliberately differently from the scythe: a **~78° arc** against the
scythe's ~198°, so it is a weapon you aim rather than one that clears a room.
No magazine, no reload, no projectile. In exchange it hits hard (88 base,
0.16 crit) and takes a short step INTO the cut on a hit — carried on velocity
so it decays rather than teleporting the player. Swing direction alternates so
consecutive strikes read as a combo.

**Kills split the body in two.** Only on a clean kill, never on a boss —
bisecting something that survives would look absurd. The two halves slide
apart PERPENDICULAR to the cut (which is what makes the cut line readable),
toppling as they go, with a dark raw cut face along the flat edge. A white
line flashes through where the body was, and blood sprays both ways along
the cut.

The blade always swings, hit or miss: a swing that only animates on contact
makes the weapon feel broken when you whiff.

10 levels, alternating damage / fire rate / reach / crit.

**`icons.test.mjs` caught the katana shipping with no icon** — it would have
silently rendered as a pistol. Glyph added: a single clean edge, the least
ornamented in the set, because the weapon's identity is one line.

STILL TO DO on this item: it is reachable from the normal new-weapon pool
(no `requireUnlock`), but it is NOT yet offered as a storyline choice, and
not yet forced for one run. That part of the brief is outstanding.

### Katana cleave variants + storyline (2026-08-09)

**Five ways a body comes apart**, rolled per kill, because one clean bisect
every time turned the katana's best moment into wallpaper within a minute:

| variant | weight | what happens |
|---|---|---|
| `halves`   | 38% | straight through, two pieces slide apart |
| `quarters` | 22% | a second cut across the first — four pieces, two cut lines |
| `topoff`   | 16% | shallow cut, a small piece leaves fast, the rest drops |
| `fan`      | 14% | three wedges opening away from the cut |
| `burst`    | 10% | cut through AND blown apart, plus a shower of chunks |

Every variant respects the blade's actual travel angle — the whole point is
that it reads as YOUR cut. A random split angle would look like the body
exploded rather than like it was cut. Pieces are offset along the cut line so
they do not all start stacked on one point, which is what made an early
version read as one object twitching. Piece size is driven by `t.size`, so a
big body throws big pieces rather than confetti.

Applies to every ordinary enemy. **Bosses excluded** — they run their own
death sequence and a bisect on top would fight with it. (Briefly included at
the user's request, then removed on their follow-up.)

**Storyline.** New quest `s_katana` — "Put the gun down" — at step 4 of 22,
after "Grow teeth" and before the first node: late enough to have felt the
pistol, early enough that swapping is a lesson not an interruption. It grants
nothing (the katana is already an unlocked starter); it asks the player to
choose it for one run.

Nearly shipped a silent dead end here: the detector first read
`r.ownedWeapons` from the game-over result, a field that does not exist —
`snapshot()` exposes `weapons: [{ id, ... }]`. The quest would have been
permanently uncompletable with no error anywhere. Four new checks in
`physics.test.mjs` lock the chain, including one that fails outright if
anyone reintroduces `r.ownedWeapons`.

Suite: 136 checks.

### Code review findings — all resolved (2026-08-09)

A paid multi-agent review found 12 issues. Every one was verified against the
source before acting; all were real. The two that mattered most were mine.

**Lightning threw on every cast.** `this.enemies.items` — `Pool` exposes
`free` / `active` / `forEach`, there is no `items`. The skill spent its
cooldown, fired the first bolt, then threw `TypeError` mid-cast: no splash, no
further bolts.

**Sixteen level-up cards did nothing.** Ten were mine; I had reported them
done and verified. I checked that the cards existed, that shop unlock ids
matched their gated cards, and that `applyCardChoice` wrote
`run.stats.flags[flagId]` — and never checked whether the engine read the flag
back. It didn't. The guard I then wrote (`test/flags.test.mjs`) turned up
**six more that predated this work entirely**: Lightning Crit, Poison Cloud,
Star Burst, Spike Plates, Thorns, Death Mark. All sixteen are implemented now.

**Performance — the lag.** `VesselGauge` called `setT(performance.now())`
inside `requestAnimationFrame`, re-rendering the component and reconciling its
~40-node SVG (19-point wave path regenerated每 frame) sixty times a second for
the whole run, on top of snapshot-driven HUD renders. The wave is now written
straight to the DOM through a ref; the level-up splash got its own ticker that
lives 0.9s instead of the entire run.

**Mid-run saves were reverted.** `initialSaveRef` snapshots at mount and is
never refreshed, while App's 10s `tickIdle` and `settleProgression` keep
writing to the real save throughout. Writing that snapshot back wholesale at
game over discarded everything they did — a quest could complete mid-run,
toast, pay gold, then silently un-complete on death and complete AGAIN on the
next settle. Game over now merges only the four run-owned fields onto the
current save functionally.

**`lootMult` was added to a luck bonus.** It returns 1.0 / 1.55 / 2.4 — a
multiplier — while `rollRune` uses its argument as `luckBonus * 0.02`. Normal
silently granted +1 luck; Nightmare's advertised ×2.4 moved the roll by 0.048,
i.e. inert exactly where it should matter. Converted to `(lootMult - 1) * 4`.

**Meta upgrades `m_projspd` / `m_projrange` never applied.** engine.js seeds
the multipliers from `meta.projspd` / `meta.projrange`; `buildMetaEffects`
never wrote those keys, so 80 levels of Swift Rounds did nothing — while the
in-run stat cards worked, making the meta versions look randomly broken.

Also: Star Atlas rendered the same meteor icon for stages 4-7 (`STAGE_ICON`
was left at 3 entries when STAGES grew to 7); the Weaponsmith promised "choose
one to begin a run with" for a selector that does not exist; meta purchase
feedback fired even on rejected clicks (the verdict cannot be read back out of
a React updater — it now records to a ref and an effect fires after commit);
`b_evolved` progress could reach 1.67 and overflow its bar.

Suite: 142 checks.

### Base Defence as the camp's payoff — DESIGNED, NOT BUILT

Timmy's idea, and the right structural instinct. Recorded here rather than
half-built: I started wiring it, he said to hold off, and leaving computed
values that nothing reads is precisely the bug class that cost a day this
session (16 dead card flags, dead meta upgrades). `defenceStart` was reverted
to its original shape — the design below is the whole of what was written.

**The finding that matters:** every building ALREADY has a real effect —
Hangar into Star Raid, Incubator into hatching, Patrol Post into patrol
rewards, Well into the clicker, Forge into merge odds, Rampart into Base
Defence. Building did not feel useless because it was; it felt useless
because each effect lands in a *different distant mode*, so an evening of
upgrading is never visible in one place.

**The fix:** make the whole camp turn out for its own defence. Each building
keeps its distant job and also contributes something visible on the wall:

| Building | Contribution to defence |
|---|---|
| Rampart | core HP, starting scrap, free towers (as today) |
| Well | +starting scrap AND scrap income per wave — build during a wave |
| Hangar | an air-support drone working the lanes on its own |
| Forge | towers upgradable mid-defence, cheaper per level |
| Patrol Post | 1–2 lanes guarded automatically |
| Incubator | your pet fights beside you |

`defenceStart` should also return a `contributions` list so the screen can
SHOW the camp turning out, rather than leaving the player to infer it.

**Second half, and the more important one:** put it in the storyline. Today
Base Defence must be found. A story step — "they come tonight, hold them" —
makes it something that happens to you rather than a menu you happen to open.
Plus the "slime castle" attack variant Timmy described.

### Dead-config sweep — `test/wiring.test.mjs` (2026-08-09)

The most expensive bug class in this project, by a wide margin, is content
that is **declared but never read**. It never throws, never logs, never shows
up in a screenshot — it silently does nothing. The tally this session:

- 16 level-up cards declared `flag:` values the engine never looked at
- meta upgrades `m_projspd` / `m_projrange` wrote keys nothing consumed
- meta upgrades `m_lvlBoomDmg` / `m_lvlBoomKB` — same, 20 gold-bought levels each
- the katana shipped with an icon id that had no glyph
- 4 blueprint starters (twinSMG, tidalShotgun, runicRifle, plasmaLance) had no
  ICONS entry at all and rendered as identical handguns
- The Deep Current had no boss, so the last map was uncompletable
- a story quest read `r.ownedWeapons`, a field that does not exist

**Every one was found by Timmy playing, or by a paid review. None by a test** —
because the tests all checked that the DECLARATION was well-formed. The new
suite checks the other end: that something, somewhere, actually reads it.

Six checks, wired into `npm run test:logic`:
- every meta upgrade writes a stat something reads
- every stat card writes a stat something reads
- every active skill is handled by castSkill
- every campaign map has a boss, and that boss id is a real enemy
- no weapon falls back to the placeholder pistol glyph
- every `this.meta.X` the engine reads is written by buildMetaEffects
  (artifact affixes are matched against the affix table, since they write
  `result[stat]` dynamically and never appear by name)

It found the lvlBoom pair and the four starter icons on its first run.

**Suite: 156 checks.**

### Wiring sweep, widened — 13 checks (2026-08-09)

Extended `test/wiring.test.mjs` from 6 checks to 13. It found one more live
bug immediately:

**The reward screen was hiding most of what you earned.** `rewardItems`
filters on `REWARD_ICONS`, so any payout with no entry is silently DROPPED.
That was true of every item reward — finish a run, earn gear, a rune, an
artifact and an egg, and the screen listed none of them. You got the things
and were never told. Six entries added.

New checks, each verified to go red on a real break:
- every enemy a map's `enemyMix` names actually exists (a typo just makes the
  wave roll `undefined`)
- every weapon `behaviour` has a case in the dispatch switch (an unhandled
  behaviour means the weapon silently never fires)
- every rune stat and every artifact affix stat is read by the engine
- every quest metric is a real save field
- every reward key has an icon, checked against ALL THREE payout routes

**A caution worth recording.** The first version of the reward-icon check was
GREEN on the exact bug it was written for. Deleting the probeKeys icon did not
fail it, because it only read quest reward bags and never App.js's `give()`
ledger — where run rewards are actually granted. A test that cannot fail on its
own motivating example is worse than no test: it reads as coverage.

That is the second time today one of my own guards was green on the bug it
existed to catch (the first was `layout.test.mjs` and `\bfr\b`). Every guard
here is now verified by reintroducing the break and watching it fail.

**Suite: 159 checks.**

### Session end state (2026-08-09, before restart)

Everything below is committed to disk, builds clean, and the suite is green
(160 checks). Safe to restart the machine.

**Fixed late in the session, after the code review:**
- Rune Run only paid on the FINAL stage — my own Star Atlas expansion (3 -> 7
  stages) moved that from "clear stage 3" to "clear stage 7" and made runes
  all but unreachable. Every guardian now pays, and deeper stages roll better
  rarity (mythical 1% at stage 1 -> 19% at stage 7).
- Rapid tapping did nothing ANYWHERE: a global `touchend` listener called
  preventDefault on any tap within 320ms of the previous one, which cancels
  the synthetic click as well as the zoom. Interactive elements are now
  exempt. The per-screen stale-closure fixes before it were real bugs, but
  they were not the bug being reported — two unrelated screens with identical
  symptoms should have pointed at something global far sooner.
- "LEVEL UP!" rendered as a solid beige bar: I put a `mask-image` on an
  element that paints through `background-clip: text`, and the two are
  incompatible — the browser paints the background box instead of the letters.
- The Character portrait vanished: declaring a second `animation` on
  `.char-portrait-drop` replaced the float it already ran. Folded the breath
  into the existing keyframes instead. **NOTE: the user reports he is STILL
  not visible. The CSS fix did land, so the cause is something else and is
  still unfound — start here next session with devtools open.**
- Headband and cigar removed from the in-game render (menus only). At ~34px
  across, none of that detail can resolve; thinning it did not help because
  the problem is pixel count, not density.
- runebolts projSize 8 -> 5. It is one of two tutorial weapons, fires 2.8/s
  automatically, and at size 8 (larger than the manual pistol's 6) it was the
  biggest thing on a beginner's screen while doing the least damage.
- Oil frame halved (26px -> 13px) with a much larger sag; the level-up drips
  shortened and moved behind the cards.
- Meta bar knob sits ON the track instead of hanging off its left end.

---

## Session 2026-08-09 (after the reboot)

### Start-weapon selector — DONE

The `s_katana` quest asked the player to open a run with the blade while
`GameScreen` hardcoded `startWeapons: ['hydropistol']`. The quest was
uncompletable, and nothing anywhere said so — the quest itself was
well-formed, which is why every test passed.

Built end to end:

- `save.startWeapon`, defaulting to `hydropistol` (store.js).
- `resolveStartWeapon(save)` and `isStarterUnlocked(save, id)` in
  **data_ext2.js**, and both the selector and GameScreen call it. One
  definition on purpose: two copies of "which weapon are we carrying" is
  exactly how the highlighted card and the actual run end up disagreeing.
- The validation inside it is load-bearing, not decoration. `engine.snapshot()`
  reads `WEAPONS[id].icon` for every carried weapon **every frame**, so a save
  holding a retired or un-crafted id would throw sixty times a second. Anything
  that is not a currently unlocked starter resolves back to the pistol.
- Weaponsmith → BLUEPRINTS → START WEAPONS is now a real selector: **CARRY
  THIS** on each unlocked starter, **◈ CARRIED INTO THE RUN** on the chosen
  one. Gold rather than teal, because every card in that band is already
  `bp-owned` teal — "owned" cannot also mean "selected".
- The quest points at a new `smithBlueprints` destination that opens the smith
  **on the blueprint shelf**. Landing on TUNING and letting the player hunt for
  the control is how a two-tap task becomes a dead end.
- A chip beside **FIGHT** shows what you are carrying and opens the shelf when
  tapped. Without it the choice is only visible three taps deep, and a player
  who picks the katana for the quest and forgets would find every later run
  mysteriously gunless and blame the game.
- The pistol's `desc` now falls back to `WEAPONS[id].desc`. Its starter entry
  only puts it on the shelf, so its card rendered a blank line where every
  sibling explains itself — invisible until the band became a selector players
  are sent to.

Two new guards in `wiring.test.mjs`, **both verified to go red** by
reintroducing the exact bug (a hardcoded `startWeapons`, and a removed
`smithBlueprints` case):

- *every quest destination lands somewhere in pathGo* — parses the real switch
  out of Camp.jsx and checks every `go:` in STORY_QUESTS, CAMP_QUESTS and
  PATH_STEPS against it.
- *the start weapon a run opens with is resolved, not hardcoded* — checks both
  ends of the wiring and exercises `resolveStartWeapon` against an unknown id,
  an un-crafted starter, the katana, a crafted starter and an empty save.

`logic.test.mjs` had its own hardcoded copy of the destination list. That is
this project's favourite bug wearing a test's clothes — the list and the switch
drift, and the test then certifies a button that goes nowhere. Deleted; there
is one list now and it is the one the game runs. Suite: 162 checks green.

### Character portrait — one suspect eliminated, still open

Ruled out: `rarColor` being undefined. `loadSave()` deep-merges `character`
(store.js:204), so `rarity` is always present and the gradient stops always get
a colour. Had that been the bug it would have been perfect — undefined `--rar`
kills `color-mix()`, and `stopColor={undefined}` paints black on black. It is
not the bug.

Built `scratchpad/build-portrait.js`, which lifts the SVG straight out of
CharacterPanel.jsx and renders it in the real `.char-portrait` container with
index.css + overhaul.css applied verbatim, one tile per rarity plus a control
tile with no app CSS. It splits the question in two: if it draws there, the
artwork is fine and the cascade is hiding it; if it does not, the bug is in the
markup. Sent to Timmy — **awaiting his read.**

Then measured the bandage against the head it sits on, by solving the body
path's cubic for x at each wrap's y rather than eyeballing it. It was not a
headband, it was a **plank**:

| y  | head spans | band rect spans | overhang per side |
|----|-----------|-----------------|-------------------|
| 34 | x34.1..65.9 | x17..83 | **17.1px** |
| 45 | x27.7..72.3 | x16..84 | **11.7px** |
| 52 | x24.1..75.9 | x19..81 | **5.1px** |

On top of that the band's bottom edge (y=55) sat *below* the brows (y=53) and
below the top of the eyes (y=55.5) — and `.ch-band` is painted last, so it
covered them. The first tail ran to x=104 inside a viewBox 100 wide and was cut
off mid-cloth. A beige slab across the face with the eyes buried under it is a
very good match for "han syns inte".

Fixed by clipping the wraps to the body's own silhouette (`<clipPath
id="chDropClip">` reusing the teardrop path), so a rect that cannot taper now
ends exactly where the head does at every height. Wraps moved to y 29-49
(3px of clearance above the brows, was -2px), knot re-anchored to x=70 where
the silhouette actually is at y=41 (measured: 70.1), tails brought inside the
viewBox with 6px to spare. `.ch-band`'s `transform-origin` followed the wraps
up to `50px 40px`.

`scratchpad/build-portrait.js` had two traps of its own worth remembering if it
is reused: `clipPath` is a JSX *attribute* that must become `clip-path` in raw
HTML while `<clipPath>` the *element* keeps its case; and seven portraits on
one page means seven copies of every `id`, where `url(#chDropBody)` resolves to
the first match — every tile would have painted in the first tile's colour and
it would have looked like rarity tinting was broken.

### The eyes — found by playing, fixed by measuring

Timmy: *"ögonen glider ut, blir 2"* when walking and aiming right; a little to
the left, much worse to the right; and an eye still showing while walking away.

Swept the real layout through all 360° (`test/eye-measure.mjs`, now in the
suite). Two defects, both measured:

1. **The near eye walked off the body.** `ex = cx + side*eyeDX*persp` — `cx`
   pushed the whole face outward while `persp` only narrowed the spread, so the
   near eye MIGRATED outward as he turned: 0.010r outside the silhouette at
   rest, **0.127r outside at a full profile**. The brows had been given a
   `heroHalfWidthAt` clamp after a report with this exact shape; the eyes never
   got one.
2. **The wrong eye vanished.** Turning right it kept the RIGHT eye at full
   width out at the rim and shrank the LEFT one. A head turning right does the
   opposite. So instead of a profile you got a big eye off the edge plus a
   shrunken one near the middle — two disconnected blobs, not a face.

`faceX`/`faceY` are the normalised aim vector, so they ARE the sine and cosine
of the head's turn. Eyes now sit at a fixed angle either side of forward on a
cylinder whose radius is the drop's own half-width at eye height; position and
foreshortening both fall out of where that angle has rotated to, and the
correct eye hides itself. Crucially `atan2(faceX, faceY)` is **not** clamped to
the front hemisphere — past 90° both eyes fall behind the head on their own,
which is what makes "walking up shows no eyes" true without a special case.

Result across the sweep: worst overhang **0.127r → 0.000r**; eyes drawn while
facing away **6 → 0**.

### The white blob — Timmy's observation beat my reasoning

After the eye fix he still saw a white spot, and reported the decisive detail
himself: *present aiming right, absent aiming left, and the pupil goes straight
into it when aiming down-left*.

That asymmetry is what identified it. The body's specular glint was drawn at
`(-0.35r, -0.50r)` — always on the LEFT — at **2.6 x 4.2 of pure white, alpha
0.85**, while the eyes are 3.3 x 3.8 of #f2fbff. Eye-sized, eye-coloured, and
sitting INSIDE the eye band. It rotates with `bodyAng` only, not with the head
turn: aim left and an eye lands on top of it and they merge (nothing looks
wrong); aim right and both eyes swing away, stranding it as a lone white blob.

Now lifted to y -0.74r (clear of the eyes), shrunk to 1.7 x 2.6, tinted, and
faded to **nothing** by a 3/4 turn rather than merely dimmed — leaving even a
faint one there was what let it keep reading as an eye.

Muzzle flash, same report (*"en ljus fläck som inte går bort"*): the core
sprite was 34-60px of additive white beside a ~28px character and never decayed
under sustained fire. Core 20-33px at alpha 0.5. Then, on request, another
**20% off the reach**: light radius 38 → 30 and starburst 0.50 → 0.40 (both,
because the starburst is what you read as the flash's length).

### One character, drawn once — `HeroFigure.jsx`

Timmy: *"introt har inte rätt karaktär å inte equipment å character meny heller
… de är en bugg alltså som gör det."* He was right.

`heroShape.js` opens with "ONE SOURCE OF TRUTH" because the in-game hero and
the paperdoll had already drifted into two unrelated drawings. Then **five**
copies existed:

| where | body | cigar | headband |
|---|---|---|---|
| in-game (Pixi) | heroShape rig | yes | removed on purpose |
| paperdoll | heroShape rig | yes | yes |
| Character panel | its own hand-written SVG | yes | yes |
| intro | a *different* teardrop | no | no |
| game loader | the intro's blob, copy-pasted | no | no |

`components/HeroFigure.jsx` is now the one drawing for every non-gameplay view.
In-game stays separate on purpose — it renders at ~30px across where none of
this detail resolves. Gradient and clip ids come from `useId`, because
`url(#id)` resolves to the first match in the document and two figures on one
screen would otherwise silently share the first one's colours (a trap I hit for
real in the probe harness).

Wired into the Character panel, the intro (with the rarity colour threaded
through from App.js) and the loader. The intro's `.intro-brow` / `.intro-eye`
CSS pointed at elements that no longer exist, so the resolve beat would have
kept "working" while changing nothing — re-pointed at `.ch-brow` / `.ch-eyes`.

**New guard, and it went red on its first run:** *no panel hand-rolls its own
drawing of the character*. It found the fifth copy in GameScreen immediately.
Scans for large teardrop paths outside HeroFigure/GearPanel; sized so an icon
glyph (MetaFeatures' eye badge, in a 16-unit viewBox) is not a false positive.
Verified red again with the tightened rule.

Intro space rebuilt while in there: three drifting nebula layers, a dim
rotating spiral, a planet with a real terminator and a lit limb, a fourth
twinkling star layer, near-camera dust streaks and two shooting stars on
offset cycles. All gradients — the intro covers the canvas load, so it cannot
wait on an asset.

### Profile level-up — rebuilt

The bug behind *"låt den visa profil bild istället"*:

```js
const av = AVATARS[save.profile.avatar] || AVATARS[0];
```

`AVATARS` is an **array** and `profile.avatar` is a string id, so this was
`undefined` every single time and the screen has **never** shown a player their
own avatar. Line 365 of the same file already did it right with `.find()`.

Rebuilt to Timmy's brief:
- Shows `profile.photo` (the Welcome-screen upload) if present, else the
  correctly-resolved avatar, on a lit 3D disc with a rotating bezel and sheen.
- **Rewards land one at a time.** They are built as a data list first — you
  cannot sequence JSX you have already spread across the card. Each flies in
  scaled-up, slams onto the portrait with a shockwave and a recoil, then the
  next. Skippable, and the button says SKIP until they are done, so it can
  never read as "did that just eat my rewards?".
- **Audio:** `xpTick(t)` pitches up with the bar (a flat tick nine times reads
  as a loading spinner; a rising one reads as progress), `xpArrive()` is two
  detuned saws swept up plus a bright triad, `rewardLand(t)` climbs across the
  sequence so five payouts form a rising run instead of the same thud five
  times.

### `.oil-live` — the frame that actually moves

Reported as *"för mycket"* and *"de rörde sig inte"*. New class, ~18px (the
0.5cm asked for), applied with no markup changes: the sheet's beads crawl along
the edge on co-prime widths (104/137/89, so the rows never line up into a
visible repeat), and the runs lengthen and slide on a separate cycle. On the
level-up card first, per Timmy: *"vi måste få se snyggt först"* before it goes
everywhere.

### Weapon upgrades are now per-weapon — `weaponTracks()` / `trackInfo()`

Timmy: *"anpassa namn å typ på upgradering utefter varje vapen … några är så
men gör de för var å en"*.

Every weapon was offered the same six tracks. The katana was sold an Extended
Magazine and AP Bullets; a beam was sold a Barrel Length. `WEAPON_PART_OVERRIDES`
could rename them per weapon, but the SET was fixed, so the screen always
described a rifle. Only 14 of 45 weapons even had names written, and **5 of
those 14 named a weapon that does not exist**:

- `runeBolts` and `scythe` were plain typos of `runebolts` / `bloodscythe` —
  those weapons were *meant* to be tailored and silently got generic names.
- `meteor` and `shotgun` were keyed to the **behaviour**, not to a weapon id.
  That intent is exactly what the new archetype table serves, for every weapon
  of that behaviour rather than one id that resolves to nothing.
- `tidal` was written for the Tidal Shotgun; retargeted to `tidalShotgun`.

(I first counted 8 dead and re-checked: `twinSMG` and `runicRifle` only enter
`WEAPONS` once `data_ext2` is imported, which my probe had not done. Real
figure 5.)

`ARCHETYPES` in data_ext.js now derives the track SET from `behaviour` —
melee/beam/orbit/chain/aoe/shotgun/meteor/drone/projectile — each with its own
names and tier ladders. A weapon added tomorrow is sensible immediately instead
of whenever someone remembers to write an override. Three layers resolve, most
specific last: base mechanic → archetype → per-weapon override. `rarity` and
`element` stay universal because they are the only two tracks that mean the
same thing on every weapon.

Guard: *every weapon gets upgrade tracks that suit it* — no override naming a
missing weapon, no magazine on something that carries no rounds, no ammunition
on a melee weapon, and every track resolving to a real name and icon. It went
red on all five dead overrides.

### Level-up frame — metal, not oil

Timmy after seeing it: thicker, spinning, *"svart röd svart silver kanske lite
guld mest svart å röd"*, 3D, claws holding the picture, a fat frame around the
whole thing, and a sweep.

- Portrait 106 → 132px, in a layered bezel: a machined outer body, a
  hard-segmented crimson band spinning one way, a fine silver-and-gold filigree
  counter-spinning. Two rings turning opposite ways is the whole trick — one
  spinning disc reads flat however it is shaded. Segments are hard-edged
  because a soft sweep at this size just shimmers.
- Four holder claws gripping the picture like a stone in a ring; they do NOT
  rotate, because they are the frame the rings turn inside.
- Card: bevelled (clip-path, not radius — a cut corner reads as machined metal,
  a radius reads as a web panel), an outer border standing off at `inset:-16px`,
  and a slow light sweep across it.

**Collision worth remembering:** the card briefly had both `lu-card` and
`oil-live`. An element has exactly ONE `::before` and ONE `::after` — two frame
classes do not layer, they overwrite, and which wins is source order. Dropped
`oil-live` here; it stays available for panels that want the dripping look.

### Currencies are drawn now — and "no emoji" is a standing rule

Reference sheets live in `C:\Users\timmi\WaterdropPixi\bilder referrens\`. Three
are ornate metal-and-gem frames; the fourth is the game's OWN palette (dark
navy, mint/teal, thin warm gold) and is the one to match for colour — Timmy:
*"dom färgerna e shysst men coolare ram lixom"*. Explicitly **no neon glowing
frames**.

Nine currency glyphs added to GameIcon: gold (struck coin stack), gems (cut
brilliant), slot coins (notched casino token), TP (leaf with a gold midrib), SP
(crystal shards on a base), gacha tokens (punched ticket), probe keys (ward
key), char pieces (broken medallion), evo shards (sliver). Each reads as a
different MATERIAL, not just a different colour — colour alone fails the moment
two sit side by side on a chip, which is exactly how gems/char-pieces and slot
coins/gacha tokens had become indistinguishable.

Wired into the banner row and the level-up payout list, so what you are paid
looks like what you then own — they were previously two unrelated sets of emoji.

Guard: *the currency row and reward payouts use drawn icons, not emoji*.
Verified red by putting one emoji back. It strips comments first — a note
explaining which emoji were REMOVED is not a shipped emoji, and a guard that
cannot tell the difference punishes documentation.

**Scope note, measured not guessed: 477 emoji are still rendered across 35
component files.** Biggest: CampPanels (63), Camp (48), MetaFeatures (48),
PetPanel (33), ProspectorScreen (27), Welcome (27), Weaponsmith (24). The
currency set is done; the rule is not yet satisfied game-wide.

### Lootmine — nothing was broken, the hull was

Timmy: *"man verkar inte få korten från probe miner"*.

Traced every wire first, and they were all sound: `dive.blueprints` is
initialised and incremented, `bank()` writes `prospectBlueprints` and
`tcgCardInventory`, both keys have real readers, and all 5 `PROSPECT_CARDS`
match an `ADVANCED_CARDS` entry gated on the same `prospectId` — so an unlocked
card really does reach the run pool. No dead config anywhere.

The problem was `probeStats()` returning **`hull: 1`**. The first hazard ended
the dive, and `hazardChance` starts at 10% and climbs 4.5% a layer. Simulated
20k dives per strategy:

| bank at | cores/dive | blueprints/dive | dive lost |
|---|---|---|---|
| d1 | 2.4 | 0.031 | 10% |
| d5 (best) | 8.8 | 0.076 | **66%** |

Best possible play lost two dives in three and needed **14 dives per unlockable
card**. Base hull is 2 now — the first hazard is a warning you get to act on
rather than a coin flip with no counterplay. The upgrade ladder is untouched
and still adds 5 on top.

| bank at | cores/dive | blueprints/dive | dive lost |
|---|---|---|---|
| d3 | 10.2 | 0.097 | 6% |
| d6 (best) | 18.6 | 0.145 | 39% |

Cores 2.1x, blueprints 1.9x, **14 dives per card → 7**, and depths 1-3 are now
near-safe so there is a ladder of risk instead of a cliff. Guarded in
logic.test.mjs (shallow dives must be survivable, deep ones must still be a
gamble, blueprint rate must clear the card gate); verified red by restoring
`hull: 1`.

**Worth remembering:** the report was "I don't get the cards", which sounds
like broken wiring, and the wiring is where I looked first. It was economy.
Measuring the yield is what found it — reading the code could not have.

### Level-up cards now escalate with rarity

Reference: `bilder referrens/dessa är bäst tror ja.jpg` — the one Timmy rates
highest, and the only sheet showing all six rarities side by side. Reading it
properly mattered: I first built a **crest** sitting on the top edge (from
`level up kort.jpg`, where a plain bird becomes a phoenix becomes a jewelled
hourglass). Wrong. What actually separates the six in the sheet he prefers is
the **silhouette and the halo** — a common is a plain plate; by mythical the
top corners have grown scalloped shoulders and the whole card is haloed.

The crest also forced `overflow: visible` on `.card`, which would have broken
the shine sweep that depends on the clip. The silhouette version uses the
clip-path instead, so the sweep still works, and the halo is a `box-shadow` on
the card itself — painted OUTSIDE its own clip, which is the only reason it can
glow while staying `overflow: hidden`.

Five knobs, one line per tier, so the ladder is readable and tunable in one
place: `--cf-w` (frame thickness), `--cf-cut` (shoulder depth), `--cf-halo`
(outer glow), `--cf-inlay` (inner filigree), `--cf-orn` (corner ornaments),
`--cf-ember` (drifting embers, legendary+). Each tier adds exactly one thing to
the one below it.

**And a real bug fixed on the way.** The cards carried both `card` and
`oil-frame`. `.card::after` is the rarity aura; `.oil-frame::after` is the drip
sheet. One element has one `::after`, so the later rule replaced the earlier —
**the rarity aura had not rendered on any card at all**, and the drips that
replaced it were then clipped away by `.card`'s own `overflow: hidden`, which
is exactly why Timmy reported *"de rörde sig inte"*. Same collision class as the
profile level-up frame earlier today; that is twice in one session, so the
frame is built from real child layers now rather than pseudo-elements.

### Cards, icons, talents, profile level-up — 2026-08-09 late

**30 of the 60 emoji passives are now drawn** (GameIcon `pLightning` … `pRicochet`)
and registered by their `flag` key, which is what LevelUpModal looks up. Damage
Aura and Burn were both a flame — the deck literally contained two
indistinguishable cards.

**The rarity ladder for level-up cards** is built from child layers, not
pseudo-elements: `--cf-w` (frame), `--cf-cut` (shoulder), `--cf-halo` (glow),
`--cf-inlay`, `--cf-orn`, `--cf-ember`. Shape also varies by TYPE
(`card-k-weapon|flag|stat`), so a rare weapon and a rare passive are not the
same object recoloured.

**Two real bugs found by rendering it rather than by reading it:**

1. `.card-framed > *:not([aria-hidden])` handed `position: relative` to
   anything WITHOUT the attribute, overriding the decorations' `absolute`.
   Forget one `aria-hidden` and four corner brackets drop into the flow,
   pushing a blank band above the rarity tab. It worked in the app only
   because the attribute happened to be there. Now the CONTENT is named
   explicitly, so a missing attribute costs an a11y nicety, not the layout.
2. The art panel was a near-black box with its own border and corners, eating
   the top half of the card and competing with the frame for the same job.
   Timmy's reference has **no art panel at all** — the illustration sits on the
   card's ground with a soft rarity bloom. The fix was a subtraction. Type now
   shows in the shape of that bloom instead.

`scratchpad/build-cards.js` renders all six rarities in a row from the real
markup, CSS and glyphs. That row view is the only way to judge the ladder —
which is why the reference sheet is laid out the same way.

**Talents**: the 30 nodes were emoji, and repeating ones (the heart on five
nodes, crossed swords on four). Nearly every node is a tier of a concept that
already has drawn art, so `TALENT_ART` maps rather than draws — keyed on the
node NAME with the tier numeral stripped, since `tn01`..`tn30` say nothing.
Checking every family against the table (instead of trusting the list I wrote
from memory) caught three that were silently falling through to a star:
Cruelty, Thunderstrike, Transcendence.

**Profile level-up** gained a "NEW UNLOCKS" block, per all three reference
sheets. It reads REAL rank-gated content — profile frames, headbands, name
colours, ship colours, the cigar — which until now unlocked completely
silently. A player could reach rank 5 and own a Bronze Ring without ever being
told. Only shown on an actual rank-up, and only when that rank opened
something.

## ⇢ DIRECTION CHANGE: LEVEL-UP CARDS MOVE TO PIXI

Timmy's call, 2026-08-10, after seeing the corrected CSS render:
*"du måste byta skit o canvas, kör i pixi istället"*. He is right, and the
reasoning is worth keeping.

The rarity ladder needs each tier to be a different MATERIAL growing out of the
frame — vines, ice shards, engraved scroll, flame, cracks — extending outward
AND inward past the border. In CSS every one of those is a fight: four
pseudo-elements per card, already contended (`.card::after` is the aura,
`.oil-frame::after` was the drips, `.cf-bezel` the ring), plus clip-paths that
cannot be outlined by box-shadow, plus border-radius that pseudo-elements only
follow if they inherit it. Three separate bugs this session came from exactly
that stack. Arbitrary organic shapes are not what CSS borders are for.

In PixiJS they are ordinary `Graphics` paths drawn around a rounded rect, they
animate for free on the existing ticker, and the renderer is already running.
There is also a reference the user saved for this:
`bilder referrens/level up kort görs i pixi de ser kornigt pixligt ut lite.jpg`
— note the caveat in its own filename: a Pixi card looked slightly grainy /
pixelated, so resolution and `autoDensity` need attention.

**What survives the move** (do not redo it):
- All 150 GameIcon glyphs, including all 60 passives and the four category
  badges — these are SVG and can be rasterised to textures, or kept as an HTML
  overlay for the icon only.
- `cardCategory()` in LevelUpModal (MANUAL/AUTO/PASSIVE from the weapon
  definition, not the card slot).
- The rarity ladder VALUES as a design spec, even though the CSS implementing
  them goes away.

**What to build:** a Pixi container per card — rounded plate, one crisp rarity
outline, an outer glow, a per-tier material path around the edge, the icon, and
HTML text on top (or BitmapText). Keep the two-register layout: name/type,
art, divider, description, level dots.

## ⇢ THE BUG THAT WASTED THE SESSION — read this first

Six renders were sent to Timmy, all named `cards-probe.html`. **His viewer
caches by filename, so every one of them showed him the FIRST version.** He
said "exakt lika" three times and was correct; my own screenshots showed the
changes and were also correct. We spent most of a session looking at different
files and each concluding the other was mistaken.

He worked it out, not me: *"du måste byta sätt å göra dom, de blir nå fel så de
blir inte de du gör"* — the right diagnosis, and the fault was in delivery, not
in the code.

**Rule: every preview gets a timestamped filename.** `kort-$(date +%H%M%S).html`.
Never reuse a name for a file the user is asked to look at.

## ⇢ START HERE NEXT SESSION (saved 2026-08-10, mid-task)

**Do these three things in this order, before anything else:**

1. **Screenshot the probe and look at it.** Command is below. This is not
   optional — six blind CSS guesses cost most of a session and the first
   screenshot found what all six missed.
   ```
   cd frontend
   node <scratchpad>/build-cards.js <scratchpad>/cards-probe.html
   "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
     --screenshot=<scratchpad>/shot.png --window-size=1500,520 --hide-scrollbars \
     --virtual-time-budget=2500 "file:///<ABSOLUTE>/cards-probe.html"
   ```
   Then `Read` shot.png.

2. **Finish the frame MATERIALS.** They exist in overhaul.css but only as
   corner-sized hints, and Timmy's verdict on that render was that the effect
   is far too timid: *"de blir lika ba avskalat ner å mer, de ska tvärs om mer
   och mer både utåt å innåt — de moln, kristaller, de träd"*. The material
   must run along the WHOLE edge and break past the border on both sides, not
   sit in four corners. Current state: `.card-framed.r-* .cf-corner::before/
   ::after` are repurposed per tier (vines / ice / scroll / flame / cracks).
   That is the right idea at the wrong scale.

3. ~~Split the card into two panels~~ — **DONE and screenshot-verified.**
   Comparing the two renders side by side showed the frame was never the main
   gap: the SHAPE was. The reference cards are tall and narrow with big art and
   big text in two registers; mine were short and cramped with a tiny glyph and
   12px prose, so no amount of frame work could have closed it.
   Now: `min-height: 330px`, flex column with explicit `order` (head → art →
   divider → desc → dots → foot), glyph scaled 1.55x, name 17px, desc 13px, and
   a rarity-coloured divider drawn on `.card-desc::before`.
   Still short of the reference: the art needs to be bigger again, and the
   materials must run the whole edge (item 2).

Everything else in this file is history and reasoning; those three are the
live thread.

### THE LOOP IS BROKEN — I CAN SEE THE RENDER NOW

```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
  --screenshot=OUT.png --window-size=1500,560 --hide-scrollbars \
  --virtual-time-budget=3000 "file:///ABSOLUTE/PATH/TO/probe.html"
```

Then `Read` the PNG. It works, it is fast, and it ends the guess-and-ask cycle
that cost most of a session. **Do this after every visual change.** It found a
bug in one look that had survived five blind fixes: `.cf-embers` sat at
`inset: -6px`, i.e. a box 6px larger than the card carrying the card's own
border-radius, so at legendary and mythical (the only tiers where its opacity
is above 0) it rendered as a second card outline offset behind the first. That
was the "broken silhouette" Timmy kept pointing at. Fixed to `inset: 0`, and
verified by screenshot rather than by argument.

### THE REAL DESIGN NOTE — read the zoomed reference again

Timmy's frames do not escalate by THICKNESS. They escalate by **material**:

| tier | what the frame is made of |
|---|---|
| common | plain metal, a simple double line |
| uncommon | **overgrown** — leaves and vines along the border |
| rare | **ice crystals** growing out of the corners |
| epic | **engraved filigree** cut into the band |
| legendary | **on fire** — flames licking the edge, embers |
| mythical | **shattered**, cosmic energy through the cracks |

Mine vary width, glow and radius — which is why six tiers read as "exakt lika,
bara olika färg". His become a different OBJECT each step. That is the work
still to do, and it is a bigger idea than anything attempted so far: each tier
needs its own decoration layer (SVG or CSS), not another number in the ladder.

Layout detail from the same zoom: the LOGO badge sits at the left edge with the
rarity word to its right, and the card is split into TWO panels — art above, a
divider, description below — not one continuous column.

### STOP. READ THIS BEFORE TOUCHING CARD FRAMES.

Six changes were made to the card frame in one sitting, each one a guess, each
one sent to Timmy to look at because **I cannot see the render**. He ended up
acting as my eyes for the whole loop and said, correctly, "3 ggr exakt lika".

Causes found and fixed along the way, all real:
1. `clip-path` shaped the card but `box-shadow` cannot follow a clip, so every
   cut corner had no outline. Replaced with `border-radius`.
2. The frame being judged was never the frame being changed: `.card` in
   index.css owns `border: 2px solid #000` with `border-left: 3px solid
   var(--rar)`, so the only coloured edge was a stripe down the LEFT, identical
   on all six tiers. Everything built in overhaul.css was drawn inside it as
   faint inset shadows. This is why six rarities rendered "exakt lika".
3. Two competing outlines — the card border (following the radius) and
   `.cf-bezel`'s inset rings (drawn on the padding box) — diverged at the
   corners into visible notches, worse the higher the rarity.
4. `.cf-corner` brackets are inset a fixed 3px while the radius grows to 17px,
   so at legendary/mythical they poke outside the curve. Offset now tracks
   `--cf-cut`.
5. Frame width was pushed to 5-15px on a misread of "fylliga tjocka". The
   reference is a 2-3px crisp outline with a HEAVY glow; the weight is light,
   not band width. Reverted, glow now carries the ladder (6px → 68px).

**What is still unknown:** whether any of that got Timmy what he wants. He has
not confirmed a single one as an improvement.

**Do not iterate blind again.** The next session must either get a screenshot
after every single change, or find a way to rasterise the probe locally
(headless Chrome via `npx puppeteer` was never tried and would end this
problem outright). Changing CSS and asking a human to look is not a workable
loop at this rate.

### CARD FRAMES — UNRESOLVED, pick this up first

Timmy's verdict on the latest render: the frames still look wrong, and
crucially they get **worse** as rarity climbs — *"inte bli ynkligare å mer
konstigt ju närmare man kommer"*. That is backwards from the whole point.

**One cause found and fixed:** the silhouette used `clip-path` while the frame
was drawn with `box-shadow`, and a box-shadow cannot follow a clip — it is
painted as a rectangle and then sliced, so every cut corner had **no outline at
all**. The deeper the cut, the more edge missing, which is exactly why mythical
(19px cut) looked the most broken. Replaced with `border-radius`, which the
outline, halo and running highlight all follow. Verified present in the
delivered probe: three `.card-framed` rules, no `clip-path` remaining.

**But Timmy still reports it wrong after that fix.** Either he was looking at
the cached earlier file (same filename), or there is a second cause. Do NOT
iterate blind again — get a screenshot of the newest render first.

**Suspects not yet ruled out, in order:**
1. `.card-framed { animation: cfBreathe }` sets `box-shadow` in its keyframes,
   which OVERRIDES the static `box-shadow` on the rule above it for the whole
   duration. If the static one carried anything the keyframes omit, it is gone.
2. `.card` in index.css carries its own `border: 2px solid` and `border-radius`
   — two outlines on one element, from two files.
3. Three separate `.card-framed` rules now exist across the file; source order
   decides who wins, which is fragile by construction.

**The real handicap, stated plainly:** I cannot see the render. Two frames now
have shipped that were correct in code and wrong on screen, and Timmy found
both. Build the probe, get a screenshot, THEN change something.

### Icons

60 of 60 passives are now drawn (`pLightning`…`pBulletstorm`). Category badges
added: `cat_manual` / `cat_auto` / `cat_passive` / `cat_autoskill` — the small
top-left logo the reference sheet uses, deliberately NOT in the rarity colour
because the frame already carries rarity.

`scratchpad/build-sheet.js` renders every registered icon as a contact sheet,
grouped so shared art is impossible to miss. At last count: **126 ids, 86
distinct pictures, 60 truly unique** — the rest still share, e.g. `blade`,
`scatter`, `rune` and `orb` cover four cards each, so `emberOrbs`, `frostOrb`
and both their evolutions draw the same picture.

**Still open, in priority order** (renumbered — successive appends had left
three items all numbered "2"):

**From the 2026-08-09 screenshot batch, not yet started:**

1. **Katana feel and gore.** Blade is too LONG. Wants several distinct slash
   arcs ("swish"), a cleave that shows the enemy's INSIDE and drops the two
   halves separately, and roughly a third of the body coming away on a single
   hit. Open wound should pump — cone spray, pulses — not a single burst.
   Bodies lie ~1s longer before fading. Globally: **smaller particles, more
   blood**, on everything, not just the katana.
2. **Death screen rank bubble.** The RANK n disc sits half off the left end of
   the XP bar instead of on it, and does not appear to move as the bar fills.
3. **Main menu** — flatly not good enough now that the rest has lifted.
   Timmy: *"ser de klent ut där"*.
4. **Character menu** — same, *"ser ut sådär"*.
5. ~~Level-up cards get richer with rarity~~ — **DONE**, see below.
5b. **Card ART must be unique per weapon.** Measured: 91 ICONS entries resolve
   to only **52 distinct glyphs — 64 ids share art with something else**.
   `emberOrbs`, `frostOrb` and both their evolutions all draw the same orb;
   `runebolts`, `runebolts_evo` and the generic `rune` are identical; four ids
   share `blade`, four share `scatter`. The rarity frame now makes a legendary
   look legendary, but two different legendaries can still look like the same
   card.

**Carried over:**

6. The remaining 477 emoji (count measured, see above).
7. **Clicker needs a game in it**: a waterdrop character that advances,
   attacks, jumps and ducks obstacles; chests; boosts; more levels; something
   that visibly HAPPENS on level and on upgrade. Reference: Clicker Heroes.
8. Weaponsmith TUNING + PARTS still need MERGING into one workbench — the
   per-weapon tracks landed, the two-menu split has not. Timmy: *"så behöver
   inte 2 menyer göra den saken"*.
9. Equipment slots: more 3D / recessed, with `Slot+` and `New+` badges.
10. Unique weapon logos.
11. Character portrait — bandage geometry fixed and measured; probe sent,
    verdict never came back.
12. Talents screen — untouched.
13. Intro: arms, the flip-off gesture, cigar smoke. (Space itself is done.)
14. Level-up gesture in the Character panel.
15. Pet/TCG cards with art, HP and attack; deeper card battler.
16. Base Defence as the camp's payoff — designed in full above, not built.
17. Enemy conga-line fix is unproven — my own simulation showed 94px spread
    both with and without separation. Needs a playtest verdict.

**To restart everything after a reboot:** double-click `START-SPELET.bat` in
the project root. It starts the dev server if it is not already up, fetches
cloudflared once, and prints the tunnel URL for the phone.

---

## LEVEL-UP CARDS — REBUILT IN PIXI AND WIRED IN (2026-08-10)

The CSS implementation is gone. `components/LevelUpModal.jsx` keeps the exact
props it always had (`choices`, `onPick`, `playerLevel`) so `GameScreen.jsx`
did not change, but its body is now a canvas driven by `game/cardRenderer.js`.

### Why the move was necessary

Three separate bugs in the CSS version all came from the same stack:
an element has one `::before` and one `::after` (two "frame" classes on one
node overwrite rather than layer), `box-shadow` cannot follow a `clip-path`,
and children only honour a parent's `border-radius` if they inherit it. The
rarity frames need a MATERIAL that runs the whole border and breaks past it
both outward and inward — dozens of independently placed, independently
animated shapes. That is a loop in Pixi and a fight in CSS.

### The two-layer render — this is the load-bearing idea

```
pixelRoot -> RenderTexture at 0.5 scale -> Sprite upscaled 2x, NEAREST
    frames, materials, body plates, art, glow, sheen, level dots
textRoot  -> straight to the screen at full device resolution
    every glyph of type
```

Text CANNOT live in the pixel layer. The final framebuffer resolution caps
everything drawn into it, so a `Text` with its own high `resolution` still
lands in a half-res buffer and comes out just as chunky. The reference has
crisp type over pixel art and this is the only way to get both. Timmy asked
for the graininess explicitly — *"ja vill ha dom korniga"* — it is produced
on purpose by the pixel layer, not by starving the canvas.

Both layers hold one container per card at the SAME logical coordinates, so
reveal / hover / pick transforms are applied to the pair and cannot drift.

### `game/cardArt.js` — the materials

Everything is drawn against a PERIMETER: a sampled walk around the card's
rounded rect where every sample carries its outward normal, with cumulative
arc length so ornaments do not bunch in the corners. That one abstraction is
why "vines along the frame" and "flames licking the edge" are the same twenty
lines with a different shape function.

| Tier | Material |
|---|---|
| common | machined bezel, no growth — deliberately the floor |
| uncommon | vines: snaking stem, leaves alternating out/in, pollen motes |
| rare | ice: faceted crystal shards out, shorter ones in, frost fractures |
| epic | arcane: worked band, engraved notches, corner filigree with gems, light spikes in a travelling wave |
| legendary | flame: 64 tongues, three stacked tones each, embers |
| mythical | cracked stone: faceted rock band, fissures as trenches with light at the bottom, spalled shards |

Two redraws were needed after screenshotting: epic's first draft used
unwinding spirals that read as pale question marks, and mythical's fissures
floated free of the border and read as scribble — a crack is only a crack if
there is something for it to be a crack IN, so the rock band is laid down
first and every fissure lives inside it.

### 3D pass

Cast shadow (stacked offset plates, not a blur — this layer is downsampled and
a blur would be blurred twice), bevels with ONE consistent light direction
(panels sunk, badge box proud), and a specular sweep offset per card and
faster under the pointer.

### Weapon art — 39 unique pictures

27 weapons were sharing a glyph with another weapon or a stat card. All 39 now
have their own, drawn to the weapon's name. Evolutions keep the base
silhouette and change what is done to it. Seven were redrawn a second time
after a contact sheet showed they were unique but did not READ — Storm Array
was drawing its arrowheads at y = -0.2, outside the 32px box.
`scratchpad/build-weapons.js` renders the sheet and fails loudly on duplicates.

Category badges redrawn bold: MANUAL a reticle, AUTO a cog with a round
through it, PASSIVE a shield with an aura, AUTO SKILL a spark on a timer.

### THE EVOLUTION BUG — found by auditing, not by looking

Only **6** weapons have an evolved form. **30** others carry `evolve: true` on
their final level-up, and `engine.js` keyed the card name on that flag alone:

```js
name: def.name + (upg?.evolve ? ` — EVOLVE!${evoText}` : ...)
rarity: upg?.evolve ? 'epic' : ...
isEvolve: !!(upg && upg.evolve)
```

So thirty weapons offered an **epic** card reading "X — EVOLVE!" with the
evolution badge, and taking it applied a damage multiplier and transformed
nothing. `describeWeaponUpgrade` called it an "Awakened form" as well.

Fixed: every decision now resolves `WEAPON_EVO_MAP` first. `hasEvo` means a
target exists; the flag alone now means MASTERY (rare, "final upgrade"). Also
closed a silent gap — gate open but this weapon's evo not bought was
previously indistinguishable from one that could evolve.

The chain itself was never broken. All four links verified working:
`poe_awk0` (Awakening Gate) -> `save.skills` -> Card Shop EVOLUTIONS pull ->
`save.unlockedEvos` -> `WEAPON_EVO_MAP`. **Do not add more evolutions** —
Timmy: *"there are only 6 by now that can be evo so far"*.

### Evolution recipe strip

Cards with a real evolution draw a strip above the level row: base art, arrow,
evolved art, and READY / LOCKED. Locked is shown greyed rather than hidden —
knowing the weapon CAN evolve is what makes buying the unlock worth doing.
Card height went 520 -> 560 to carve out that band (also closer to the
reference's proportions), and the rule text is now centred in whatever band is
left rather than pinned under the divider.

### Guards

`wiring.test.mjs` is at 21 checks. Two new, both verified red by reintroducing
the exact bug:
- a card only promises an evolution that exists
- every weapon evolution is reachable end to end (tree -> shop -> map -> art)

### Tooling that made this possible

**Headless Chrome renders PixiJS via SwiftShader.** This ends blind iteration
on anything drawn in WebGL:

```
node scratchpad/build-probe.js $(date +%H%M%S) 2.4      # writes kort-HHMMSS.html
node scratchpad/serve.js &                               # :8778, also serves /src
chrome --headless --disable-gpu --enable-unsafe-swiftshader \
  --enable-logging=stderr --log-level=0 \
  --screenshot=out.png --window-size=2400,940 \
  --virtual-time-budget=7000 http://127.0.0.1:8778/kort-HHMMSS.html
```

Three things learned the hard way:
- The probe imports the REAL `src/game/*.js` through an **import map**, so what
  is screenshotted is the code that ships. `./cardArt` has no extension —
  webpack resolves it, a browser does not — so the map needs an explicit entry.
- `--enable-logging=stderr --log-level=0` prints page console output. Without
  it a failing module is a silently blank canvas.
- Stop the ticker and tick once by hand for the still, or virtual time never
  expires and Chrome hangs.

### Still open on the cards

- Not yet seen running in the actual game — the build compiles and the probe
  exercises the same renderer with the same model shape, but nobody has
  levelled up in a real run with this code.
- `boneshards` renders blank in the probe only: it uses `.map()`, which the
  probe's regex extractor strips. The app path is
  `renderToStaticMarkup(<GameIcon/>)` and handles it.
- Passive/stat card art still shares glyphs in places (weapons are all unique
  now; the 60 passives were drawn earlier, the stat cards reuse generics).

### Card art coverage — the pistol bug (2026-08-10)

Counted rather than remembered, after an earlier note in this file claimed
"60 of 60 passives are now drawn" and I repeated it. The real pools:

| pool | count | had art before | now |
|---|---|---|---|
| WEAPONS | 39 | 39 | 39 (13 with procedural scenes) |
| ADVANCED_CARDS flags | **53** | 32 | 53 |
| STAT_CARDS | 22 | 22 | 22 |

**21 passive cards had no `ICONS` entry at all.** `GameIcon` falls through to
`pistol` when a name resolves to neither an ICONS entry nor a GLYPHS key, so
sixteen passives — Frostbite, Live Wire, Executioner, Soul Harvest, Gravity
Charge, Venom Bite and ten more — drew a **water pistol** on the level-up
screen. Five others (`bulletstorm`, `thorns`, `deathMark`, `secondWind`,
`coreOverload`) had a glyph already drawn that was never registered.

Signature bug class for this project: declared, never read, never throws.

Fixed: 16 new glyphs drawn to what the card DOES (Executioner is an axe over a
marked target, Quickstep a boot with speed lines, Echo Chamber a round with its
ghost trailing it), 5 registered. `wiring.test.mjs` check 22 —
**"every level-up card has its own art"** — resolves every flag and every stat
to a glyph that exists, verified red by deleting one entry.

### Procedural card scenes — `game/cardScenes.js`

Card art is now drawn as Pixi Graphics scenes, not rasterised 32-unit SVG
glyphs. The quality bar is `_drawDistantWorld` in pixiRenderer.js; the shared
helpers (`sphere`, `glint`, `corona`, `meteor`, `arc`, `blade`, `tube`) are
lifted from it so the cards and the game agree on what light does.

13 done: cosmicRain, pIce, flare, frostOrb, arcTesla, railgunArray, pistol,
blade, scythe, emberOrbs, katana, flame, voidpulse. Painted ONCE at build —
Pixi caches the geometry, so a scene of a few hundred shapes is free per frame.

Two bugs worth remembering:
- `arc()` took a stroke-width MULTIPLIER and arcTesla passed it `R * 0.9`, so
  the halo pass was a 440px stroke and the card went solid white. Widths are
  absolute px now.
- `sphere()`'s three stacked shadow discs beat its day side, so every orb was
  near-black. The lit cap has to win on the lit half.

**26 weapons still use the SVG glyph** rather than a scene. They are the
detailed redraws, not the old icons, so they hold up — but they are visibly a
tier below the scenes.

### All 39 weapons have a procedural scene (2026-08-10)

41 scenes in `game/cardScenes.js`, covering every weapon in `WEAPONS`.
Verified by resolving each weapon id through ICONS to its glyph and checking
that a scene (or an alias) exists for it — 39/39.

**The alias table matters.** Twelve scenes were written under the older generic
glyph names (`beam`, `revolvers`, `scatter`, `mine`, `caster`, `blade`,
`harpoon`) but those weapons had been repointed to their own glyph ids in the
uniqueness pass. The scenes existed and were simply never reached — the same
dead-config shape this project keeps producing, this time in art. `ALIASES` in
cardScenes.js closes it and `hasScene`/`paintScene` both consult it.

Nothing about card BEHAVIOUR changed in any of this work. `LevelUpModal` keeps
the props it always had and `GameScreen.jsx` is untouched; which cards appear,
what they do and how they are picked is the same code as before. The one
deliberate behaviour change was the EVOLVE correction (30 weapons were
promising a transform that did not exist), which Timmy confirmed.

`no-unused-expressions` caught a stray `g.roundRect(...).setStrokeStyle;` left
in the bone scene — CI=false still runs eslint as an error, so the build is a
real check, not a formality.

### Frames: structural band + per-tier material (2026-08-10)

The thing I had wrong for several rounds: **every rarity has a solid frame BAND
underneath, and the material grows ON it.** My materials floated around a thin
outline, which is why legendary was the only tier that worked — fire does not
need a band to sit on. `paintBand()` now draws a real border for every tier
(dark outer lip, lit face, dark inner lip, corner blocks) and `paintFrame()`
lays it down before calling the material.

Band width climbs 11 → 22px with the tier, so a mythical frame is physically
heavier than a common one before any material is added.

**The materials, as Timmy named them:**

| tier | material | outward | inward | motion |
|---|---|---|---|---|
| common | **steel** — bolted plates, bolts, a cold sheen creeping the band | 0.34 | 0.34 | 0.35 |
| uncommon | **leaves** — broad, midrib, lit half / shadowed half | 0.52 | 0.62 | 0.6 |
| rare | **ice** — chunky BLOCKS with cleaved tops, not spikes | 0.72 | 0.85 | 0.8 |
| epic | **arcane** — worked band, notches, filigree, inward spikes | 0.92 | 1.05 | 1.0 |
| legendary | **flame** — 64 tongues, three tones each, embers | 1.18 | 1.30 | 1.3 |
| mythical | **clouds** — billowing storm with light buried inside | 1.50 | 1.60 | 1.6 |

"Common har ingen alls" meant no *growth like the others*, not a bare card —
grey's material is steel. And mythical is CLOUD, not rock, which is why it
never read right however dark I made the stone.

Corrections made along the way, all from Timmy looking at the reference:
- rivets along the band were wrong — what sits on those frames is the material,
  not hardware. Removed.
- ice as needles read as a comb; it is slabs with flat faces catching light.
- vines as narrow slivers read as thorns; a leaf is broad and has a midrib.
- inward growth was far too timid. Both the per-tier budget and each painter's
  inward multiplier went up, and ice is corner-weighted because the reference
  piles its heaviest growth where the perimeter turns.

Backlight is two halos on different cycles — a wide soft one reading as light
from BEHIND the card, and a tighter one hugging the frame. One sprite alone
reads as a rim light on the card, not as something lit from behind.

### The stage, and the scene-overflow bug (2026-08-10)

**28 of 41 card scenes drew outside their box; 11 spilled past the card edge
entirely.** `revolvers` reached 199px from centre against a 116px half-card,
`torrentCannon` 161, `pistol` 145. Timmy spotted one of them ("pistolen är
utanför på grå") — measuring found the rest.

Fixed at the system level rather than per-painter: `_buildCard` paints the
scene about the ORIGIN, reads `getLocalBounds()`, and scales it to the art box,
recentring on the drawing's actual middle rather than on the origin (several
scenes are deliberately off-axis — the comet leaves its launcher, the meteor
swarm comes in from one side). Hand-tuning 28 painters would have fixed it once
and let it drift back the first time anyone added a scene.

The measuring harness is `scratchpad/bounds.html` — it paints every scene and
prints anything past the limit.

**The stage.** The cards now stand on a plate with its own frame in the game's
palette — black ground, dark-red wash, gold ornament, silver top edge. The
plate is sized to what it holds (title block, then cards) plus ~1cm, computed
from the real layout rather than hardcoded, so it stays a frame around the
moment instead of becoming a background.

- title `LEVEL UP` / `CHOOSE AN UPGRADE`, centred, gold glow
- the marks beside the title are four-point stars drawn in Pixi and pulsing —
  the standing no-emoji rule applies to decoration too
- a light pool behind each card in its own rarity colour, a halo thrown onto
  the plate, and colour spilling onto the plate's frame directly above and
  below each card
- a short mirrored smear on the plate under each card; a full mirror reads as
  ice rather than as polish
- cards rise onto the plate with a back-out overshoot and settle. A card that
  fades in has no weight; one that lands does

### Silver stage frame + title plaque (2026-08-10)

Rebuilt from five mockups Timmy sent. What they all share and mine was missing:
the frame is **bright brushed steel and thick**, the title is a **separate
plaque bolted to the top rail** rather than text inside the panel, and each
card throws a **large radial burst** in its own colour onto a near-black
interior — that burst is most of what makes the row feel like a moment.

- `paintStagePlate` — 30px steel band in four stacked passes (dark outer lip,
  mid face, bright highlight band, dark inner lip), brushed grain, corner
  blocks with an angled cut and a lit stud, chevron-and-gem ornaments centred
  on the top and bottom rails
- `paintTitlePlaque` — chamfered tablet, four bolts, lit top edge. No wings:
  Timmy pointed at the mockup without them
- card bursts: a 12-step radial plus 14 rays that drift, so the glow has
  structure instead of being a smooth blob

**One bug worth remembering.** The title carried its own `y` while the plaque
carried another, and the moment the plaque moved the text stayed behind — it
rendered outside the canvas. Both now derive from a single `_titleY` anchor
computed where the plaque is drawn. Two positions for one thing is always the
bug waiting to happen.

Not built, and deliberately: the pipes, gauges, buttons, ice, smoke and
greenery from the most elaborate mockup. Timmy: *"knappar å så behöver du inte
göra"*.

## Session 2026-08-15 — card materials finished, three real bugs, the no-emoji sweep

Long session, several distinct threads. Two git checkpoints landed:
`cc785b0` (level-up card overhaul + first bug-hunt pass) and `9c3b23d`
(no-emoji sweep part 2 + level-up card zoom + regression fixes). Read
[[waterdrop-lighting]], [[dead-config-sweep]] and [[no-emoji-rule]] memories
alongside this section — all three got real updates this session.

### Level-up cards: common-tier motion, badges, glow (continuation of the Pixi rebuild above)

- **Common tier got motion.** It was deliberately inert ("no growth, no
  ornament, no motion" by design) and Timmy called that dead next to vines
  swaying / ice growing / flame flickering on every other tier. Fixed with
  mechanical motion instead of organic: `paintPlate` in `cardArt.js` now
  turns four small cogs (`drawGear`) at slightly different deterministic
  speeds around the band. First pass had shadow/highlight/shine detail too
  small to read at the ~4px gear radius under the half-res pixel scale —
  recalibrated with a fixed-position drop shadow, an up-left key-light
  glow, per-tooth highlight dots on the lit arc, and a specular pin on the
  hole rim.
- **Rarity text and level-progress dot now glow in a real color.** Both
  used to fall back to the raw rarity color, which washes to near-grey for
  common. `BACK_TINT` (a saturated per-rarity color map, already used for
  the backlight halo) is now also used for `styleLabelGlow`'s drop-shadow
  on the rarity word, and for the level-dot fill/ring in
  `cardRenderer.js`'s `_paintDots`.
- **Badges/logos gone through card-type by card-type**, starting with
  passive (worst art per Timmy) then stat: `catStatBoost` is a new glyph
  (rising bars + arrow) so STAT BOOST cards stop sharing PASSIVE SKILL's
  shield+check badge — see `GameIcon.jsx`'s `cat_stat` entry and
  `LevelUpModal.jsx`'s `cardCategory()`.

### Weaponsmith: part names were generic firearm defaults for every weapon

Real bug, not a polish nit. The upgrade-part screen never called the
already-built `weaponTracks()`/`trackInfo()` archetype system in
`data_ext.js` — it read `WEAPON_PART_OVERRIDES` directly and fell through
to raw firearm defaults (Sight/Magazine, with a scope icon) on every
weapon regardless of type. Katana showed a scope. Fixed: `Weaponsmith.jsx`
now derives `partTracks` from `weaponTracks(wid, w)` and filters the
render loop to only the tracks a given weapon actually has.

### Level-up choice generation: weapon cards were starved to <10% of picks

Also a real bug, found from Timmy reporting "det är endast passiva kort
som kommer inget manual å inget auto vapen" and confirmed by logging real
picks: 0/8 upgrade cards and 1/8 new-weapon cards across ten real
level-ups before the fix. Root cause: `buildLevelUpChoices()` in
`engine.js` picked 3 cards by flat uniform random over a pool where
flag/stat cards vastly outnumbered weapon cards. Fixed by guaranteeing one
of the three picks is always a weapon card (`weapon-upgrade`/`weapon-new`/
`weapon-fork`) when the pool has one, before the remaining two are picked
normally.

### Blood is always red now — this OVERRIDES the previous documented rule

The old rule (still written in some skill docs before this session, now
corrected in [[waterdrop-lighting]]): gore/blood color = the enemy's own
`t.color`, always, to stop weapon color dominating. Timmy explicitly
reversed this for blood specifically, keeping it for chunks: *"blod ska
alltid va blod röd... partiklar chunks sönder trasig fiende ska va samma
färg som fiende"* then *"kolla in slash of sword blodet där är exakt så de
ska va"* (referring to the cut-wound blood as the correct reference for
ALL blood going forward, not just swords).

**Current rule:** `BLOOD_RED = '#b51d28'` (engine.js) for all blood/liquid
— spray, splatter, bullet-hole wounds, arterial fans on kill hits, the
ongoing bleed pulse, floor blood pools/decals. **Chunks/gibs
(`type: 'chunk'` particles) keep the enemy's own color**, unchanged. One
deliberate exception: slime "ooze" stays slime-green — it was never blood
to begin with. Touched: `spawnBrutalKill`, `spawnPunctureHit`,
`spawnArterialCone` (color param now vestigial, kept for caller
compatibility), `_updateBleed`, `spawnBlood`, `dealDamage`'s kill-decal
push. Verified live via a force-kill headless test: red blood mixed with
enemy-colored chunks in the same burst.

**Still open (task #37 in the backlog memory, not started):** Timmy wants
this taken much further — per-projectile-type wound variety (freeze, burn
that continues, electrocute-then-burnt, punched holes, blown-off limbs up
to half/quarter body, meteor = pulp, shotgun = big hole + angled side
wounds, explosives = 15-20 scattered chunks, more cut-angle variety on
blades). The color rule above is done and should NOT be redone — this
next piece is shape/variety/persistence layered on top.

### HUD elements bleeding through the level-up modal — a whole bug CLASS, not one bug

`Hud.jsx` had `!levelUpOpen &&` gates on the mission banner and guardian
timer specifically because those sit above the game view via high z-index
and the modal backdrop isn't fully opaque (a radial-gradient at ~80-87%
alpha, by design, for atmosphere). Five more elements had the exact same
positioning problem but were missed from the gate: the VesselGauge
(bottom-center HP/XP droplet — the highest-visibility one, confirmed via a
live screenshot showing it rendering directly on top of a card's stat
text), `hud-sets`, `hud-stagnation`, `hud-diff-tag`, and (separately, via
`SET_INDEX`) the weapon-set-bonus tags. All now gated the same way. Since
the sim is fully paused during a level-up (`engine.js`'s update loop skips
while `levelUpQueue > 0`), none of this data was even changing underneath
— hiding it costs nothing functionally.

### Level-up cards: displayed WAY too big vs. the old CSS cards

Not a card-geometry problem — `CARD.W`/`CARD.H` in `cardRenderer.js`
already carry an explicit comment from an earlier session not to re-shrink
them without being asked. This was purely `overhaul.css`'s `.lu-canvas`
display size: `max-width` dropped from 1180px to 820px, a pure CSS zoom
with zero changes to `cardArt.js`/`cardRenderer.js`. Bonus effect Timmy
predicted correctly: displaying the same chunky half-res art smaller makes
individual pixels less visible, since more source pixels land in each
screen pixel.

*(Separately confirmed as NOT a bug, don't "fix" it again: the level-up
card row can still need an internal scroll on a short viewport. This is a
carried-forward deliberate decision from the old CSS-card era —
`overhaul.css`'s `.levelup { overflow-y: auto }` comment says explicitly
"a card that cannot be read in full is worse than a screen you have to
nudge." Still true for the Pixi cards.)*

### The no-emoji sweep — huge scope, and the exact bug class it produces when done carelessly

[[no-emoji-rule]] ("no emoji anywhere, every icon is hand-built SVG") had
**251+ literal emoji characters still in JSX across ~32 component files**,
plus emoji baked directly into `game/data_ext2.js`'s content tables
(STAT_CARDS, ADVANCED_CARDS, META_UPGRADES, MISSION_DEFS, ACHIEVEMENTS,
STAGES, CHALLENGES, ACTIVE_SKILLS, SHOP_CARD_POOL, DAILY_CHALLENGE_POOL,
WEAPON_FORK_TEMPLATES, MAP_STAGES, TALENT_NODES, CAMPAIGN_QUESTS,
WEAPON_SET_BONUSES, ELEMENTS, PART_SLOT_INFO, and more). This session did
a large first pass, not the whole thing (task #36 in the backlog memory
tracks what's left — `data_ext.js` alone still has ~141 instances,
unaudited).

**Added to `GameIcon.jsx`:** ~40 new hand-built glyphs (lock, chest,
scroll, map, compass, rocket, pillars, person, paw, brain, hammer,
reticle, book, magnifier, skull, boltPart, egg, hatchling, ghost, orb,
ticket, moneybag, trash, trident, tornado, waterdrop, pickaxe, leaf,
medal, cog, chart, clock, infinity, eye, calendar, cards, plus five
weapon-part-slot glyphs) and their `ui_*`/`part_*` ICONS entries. Most of
the DATA-table fixes turned out to be nearly free: almost every table's
`icon:` field had a sibling `stat:`/`flag:`/`unlockWeapon:` key that
*already* matched an existing ICONS entry exactly (e.g. STAT_CARDS'
`stat: 'damageMult'` → `icon: 'damageMult'`, reusing the level-up card's
own blade glyph instead of drawing a new one) — check for that reuse
opportunity before drawing anything new.

**The bug class this produces if you fix the data but not every render
site:** a data table's `icon` field going from an emoji character to a
GameIcon *key string* is invisible until you actually look — a component
that renders `{x.icon}` as raw text instead of `<GameIcon name={x.icon}>`
now shows the literal key ("ui_blade", "moveMult", "damageMult") as text
instead of a picture, which reads as MORE broken than the emoji it
replaced, not less. **This bit us for real, mid-session** — Timmy sent
live phone screenshots and caught it in the wild: the Campaign "CONTINUE
STORY" button, the Campaign quest list, the Codex Achievements tab, the
run-payout screen's map banner, a chest-drop's part icon, Weaponsmith's
synergy tab and element picker, the HUD's active-set tags, and a
purchase-confirmation "burst" animation (worst one — `.meta-burst-icon`
was CSS-tuned for a single emoji glyph at 26px; an 8-character identifier
like "moveMult" at that size overflowed the whole card). All found and
fixed this session, but **do not trust a data-table icon fix is complete
until you've grepped every file that imports that table and confirmed
each render site uses `<GameIcon>`.** `grep -rn "\.icon\}"` across
`components/` is the fast check; cross-reference against which table each
hit's data actually comes from before assuming it's fine.

One incidental fix that fell out of this: the meta-upgrade purchase burst
(`Camp.jsx`'s `metaBurst`) got redesigned per direct feedback while fixing
its icon leak — small fixed-size icon instead of raw text, and the
upgrade's real NAME (previously completely unstyled) is now the visually
prominent element, per *"bättre förstora namnet som är under lite grann
bara å skriv stats"*.

### Deferred feature requests captured this session — all in Claude memory, not started

The `TaskCreate`/`TaskUpdate`/`TaskList` tools were used for a while this
session (created tasks #30-38) then **disconnected mid-session and never
reconnected.** Everything after that point, and a consolidated index of
the earlier task numbers, was written to the Claude memory system instead
— see `waterdrop-backlog-index.md`, `waterdrop-desktop-mobile-parity.md`,
and `waterdrop-wave-pacing-and-maps.md` in
`C:\Users\timmi\.claude\projects\C--Users-timmi-WaterdropPixi\memory\`.
Check `MEMORY.md` there for the full current index — it may have grown
since this paragraph was written. Summary of what's queued, none of it
started:

- Real TCG depth for Patrol/Pets (HP/Attack stats, a player-character
  profile with abilities, an actual board) — `game/petTcg.js` +
  `TcgBoard.jsx` already exist and are the likely base, `game/cardbattle.js`
  is the shallower system currently used by Patrol.
- Astro Prospector: a visual descent (today it's pure numeric dive state),
  more interactivity/alt-paths.
- Star Atlas: more depth/variation generally, no concrete spec yet — bring
  concept options before building.
- Forge merge minigame: replace the flat pass/fail merge roll
  (`game/forge.js`) with an actual minigame whose skill determines a
  quality grade (C/B/A/S/SS/SSS/SSS+) layered on top of the rarity tier.
- Base Defender ("Slime Castle Defender", merge-based towers) —
  `BaseDefenceScreen.jsx` + `BasePanel.jsx` already exist, read first.
- Per-projectile-type gore/wound variety (see the blood-red section above).
- Campaign/Endless wave pacing: too hard too fast at the very start on
  both; wants a real one-enemy-at-a-time on-ramp and Endless build-up.
  Distinct planet backdrop per campaign map (currently they don't read as
  different locations).
- Desktop/mobile parity: PC feels slower than phone in-game; specific
  reported symptom is meteor/UFO-type animations freezing mid-animation on
  desktop only, not reproduced yet.

### Verification this session

`npm run test:logic` and `CI=false npx react-scripts build` both run
clean after every batch of changes described above — run both again
before trusting any of this is still in a working state, per usual. Live
verification used the existing `scratchpad/cdp.mjs` headless-Chrome
harness (contrary to the old note above that "browser automation has
never worked here" — it has, extensively, this session and the one before
it; that note is stale, the harness works, keep using it) plus, for the
bugs that only showed up on a real device, Timmy's own phone screenshots
over the Cloudflare quick-tunnel (`START-SPELET.bat` / `tunnel.txt` — note
the URL changes every time the tunnel restarts, don't trust a remembered
one, see `waterdrop-project` memory for why).

## Session 2026-08-16/17 — camp unlock cascade rebuilt, tutorial retired, two real missions, one death screen

Same session as above, continued after context compaction (see the memory
files under `waterdrop-*` for the full blow-by-blow — this is the summary).

**Camp unlock cascade, take two.** The first pass (pond-node-gated, tabs
shown-but-dimmed) was superseded same-day: Timmy wanted locking tied to
BUILDING at the base, not which node cleared, and only THE BASE tab visible
at all (fully hidden, not dimmed) until unlocked. `campaign.js`'s
`CAMP_UNLOCK_BATCHES` gates on `totalBuildingLevels(save)` — buying any
level of any building cracks open the next batch, revealed one tab at a
time via a big center-screen banner (`Camp.jsx`'s `unlockQueue`, `.camp-
unlock-banner` in index.css). Found and fixed a real bug along the way: the
first implementation's queue-pop effect had its own cleanup cancel its
dwell timer on every re-render, so the banner got stuck on the first
unlock forever even though the tab-bar side worked. Batches were retimed
late in the session from 1/3/5/7/9 total building levels to 1/2/3/4/5 so
the two actual scripted missions (below) each fund exactly one unlock wave.

**Combat tutorial retired.** `App.js`'s `startTutorialIfNeeded` no longer
auto-launches `TUTORIAL_MISSION` for a fresh save — routes straight to camp
instead, where the unlock cascade already does the teaching. Camp.jsx
gained a one-time SITREP popup per stage (`CAMP_BRIEFINGS`, English, dry
gallows humor continuing `IntroDialogue.jsx`'s "THE DROP" voice) explaining
why to build instead of fight, shown before the first unlock batch and
again before the second.

**Two real scripted missions**, pond_1 ("First Drops") and pond_2
("Ripples"): `mission.forceBaseline` (new, threaded through GameScreen.jsx)
strips meta/attrs/pet/skills entirely and forces the katana, so the fight
is always the same shape regardless of what the player has actually
bought — the point being these are pond_1/pond_2's own hand-tuned intro
fights, not generic scaled content. New enemies in `data.js` tuned against
the katana's raw 88 damage and the engine's own `spawnEnemy` HP formula
(runtime HP ≈ table hp × 3 at t=0): `sludgeling` (3 hits), `sludgeWarden`
(8-hit guardian, pond_1), `briner`/`bogHusk`/`theDredger` (2/4/12 hits,
pond_2, its own guardian rather than the shared bossOcular which would
need ~80 hits at this baseline). pond_1's `bossGateTime` retimed to ~180s,
pond_2's to ~300s (Timmy's "3 min" / "5 min sen boss"). Gold rewards bumped
(120→700, 240→900) so each mission's payout alone always affords the next
building purchase, no chest RNG needed. A static "WATERDROP CAMP" sign
(`pixiRenderer.js`'s `_buildCampSign`, world-space, built once) marks
pond_1 as the camp's own backyard without touching the map itself — Timmy
explicitly did not want the map redone, just signed.

**One death screen, not two.** `PayoutScreen.jsx` (campaign node
tier/chests/ledger) used to render completely on top of `GameOverScreen.jsx`
(stats/badges/next-step) for every campaign run — the first screen's
content was always fully hidden. Merged: `GameOverScreen` now takes a
`payout` prop and shows the confetti/rays/chest-row/counting-ledger inline
around its existing stat grid when present; `PayoutScreen.jsx` is deleted.

**Profile Level-Up screen overhaul.** Three real bugs fixed: the XP bar
(`.lu-bar-run`) only ever animated 0%→100% and stopped, permanently
claiming the bar was full regardless of actual progress — now a three-
phase fill/reset/carry-to-real-% animation reading live off
`save.profile.xp`. The portrait's per-reward `scale(1.07)` bump read as the
whole screen shaking (Timmy: "rewardsen ska röra sig, inte hela skärmen")
— replaced with a non-displacing ring-flash. The whole card was a
crimson/silver trophy-plaque palette left over from an earlier pass, tried
purple first (rejected: "gillade inte de lila riktigt heller"), landed on
dark red/black per Timmy's explicit steer toward the daily-spin screen's
tone — exact reference element still not conclusively located, may need a
follow-up round. The popup itself is now held back until the unlock
cascade's current batch finishes revealing, so "you got talent points"
lands right as Talents becomes clickable instead of burying it.

**Blood/gore.** Audited the existing system before touching anything — it
already has arterial cone spray, rhythmic pumping, directional per-hit gash
marks and ground pooling, all genuinely sophisticated. Added exactly one
gap: a small permanent drip decal per bleed pulse (NOT a body-sized pool —
that was tried before and explicitly rejected, see the code comment on
`killEnemy`'s decal), so a wounded enemy now leaves a dripping trail as it
moves rather than only airborne spray that never lands.

**No-emoji sweep, more of it.** `GameOverScreen.jsx` and (now-deleted)
`PayoutScreen.jsx` were still full of raw emoji — highest-visibility
screens in the game, every run ends on one of them. Fixed, reusing the same
GameIcon keys the Level-Up screen already uses for the same currencies.
`RewardScreen.jsx`'s `e.icon`/`it.icon` deliberately left alone — those
come from many different `bankReward` call sites, not owned locally, so
converting the render without auditing every writer risks showing broken
icons for whichever still pass raw emoji.

**Standing "superpolish" mandate, logged not built.** Late in the session
Timmy asked for three large builds — a real tower-defense/merge Base
Defender ("Slime Castle" + survivor level-up cards + idle-clicker, framed
as the space-station defense, NPC helpers from rescued companions), a
much deeper Clicker game, and a full space-shooter rebuild of Probe/Star
Atlas — plus a cross-game milestone/rewards track. Explicitly framed as
"jätte projekt" (huge projects), asked to research reference games first.
None of these were started this session — see `waterdrop-backlog-index`
memory (#38-#41) for the full spec. They need a proper scoping/plan pass,
not blind construction, especially with no feedback loop while Timmy is
away — do not start building any of them without discussing scope first.
