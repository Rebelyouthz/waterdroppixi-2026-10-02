---
name: waterdrop-pixi-pitfalls
description: "MANDATORY before writing any PixiJS v8 gradient, colour grade, filter, or timed visual sequence in Waterdrop Survivor. Five traps that each silently render WRONG rather than throwing — flat gradients, dropped alpha, a crushed picture, screen-vs-world pixel confusion, and unreviewable animation. Each has already cost real session time here. Triggers on: FillGradient, gradient, colorStops, textureSpace, ColorMatrixFilter, contrast, saturate, brightness, vignette, grade, bloom, AdvancedBloomFilter, cutscene, cinematic, intro, timeline, beat, animation review, flat color, washed out, too dark, no colour, inga färger, platt."
---

# PixiJS v8 traps in this project

Every item here **renders silently wrong instead of throwing**. That is what
makes them expensive: the code looks right, the build is green, and the picture
is subtly or completely broken. All five have already burned real time.

## 1. A gradient colour stop cannot carry alpha in its own field

A stop is `{ offset, color }` — **nothing else**. An `alpha` property beside it
is dropped without warning and you get a fully OPAQUE stop.

```js
// WRONG — alpha ignored, stop is opaque. A vignette written this way became a
// solid black sheet over an entire cinematic.
colorStops: [{ offset: 1, color: 0x000000, alpha: 0 }]

// RIGHT — ColorSource accepts CSS strings, so rgba() carries the transparency.
colorStops: [{ offset: 1, color: 'rgba(0,0,0,0)' }]
```

## 2. `FillGradient` defaults to LOCAL space — absolute coords collapse to one flat colour

`textureSpace` defaults to `'local'`, which normalises stop coordinates into the
shape's own **0..1** bounds. Pass absolute pixel coordinates and every stop falls
outside the range, so the whole fill renders as a **single flat colour**.

This is what a "no colours, no light, no shaders" report usually is. A lake
gradient rendered as a grey slab; a sun's glow rendered as a hard disc.

```js
new FillGradient({
  type: 'linear',
  textureSpace: 'global',            // ← REQUIRED when using absolute coords
  start: { x: 0, y: 250 }, end: { x: 0, y: 540 },
  colorStops: [...],
});
```

⚠ **`game/cardScenes.js` passes absolute coordinates WITHOUT this** (`radialHi`,
`sphere`, and friends). Nobody has checked whether its 41 weapon scenes are
quietly flat. Worth an audit — but look at a real card first, do not "fix" it
blind.

## 3. `ColorMatrixFilter` ranges are not what they look like

- `contrast(amount, multiply)` — `0..1`, and **0.5 is NEUTRAL**, not 0.
- `saturate(amount, multiply)` — `-1..1`, 0 is neutral.
- `brightness(b, multiply)` — a plain multiplier, 1 is neutral.

With `multiply: true` each call composes onto the previous matrix, so three
"small" adjustments stack into a large one. `contrast(0.58)` plus a 0.62-alpha
vignette crushed a whole scene to black except one band at the horizon.

Start from neutral, change ONE value, look, repeat. Values that work for a dusk
exterior: `brightness(1.04)`, `contrast(0.52)`, `saturate(0.30)`, vignette rim
alpha ≈ 0.30.

## 4. Screen pixels are not world pixels — and the phone hides it

`engine.js`'s `deviceZoomFor()` clamps at `Math.max(1, …)`, so **a phone gets
exactly 1.0 and is the only device where `game.W` equals a world extent.** Any
draw or spawn site using `game.W`/`game.H` as world units is correct on the
phone and wrong on every desktop.

Convert explicitly: `worldExtent = game.W * zoom`, `screenPos = (world - cam) / zoom`.
Anything under `zoomRoot` in the renderer — including the deep-space backdrop,
which reads like a screen-space layer — is in world units.

Guarded by `test/viewport-units.test.mjs`. Full history in the
`waterdrop-desktop-mobile-parity` memory. **Test both viewports, always.**

For a CINEMATIC, sidestep it entirely: author against one fixed stage size and
scale the root to fit. Composition should not depend on the viewport.

## 5. A timed visual you cannot freeze is a visual you cannot build

At 60fps a nine-second sequence is over before a screenshot round-trip
finishes. Reviewing it by reload-and-race wastes enormous time and hands you
frames you did not choose.

**Build the scrub handle before the art, not after.** The pattern already in
this project:

```js
if (typeof window !== 'undefined') window.__cine = this;   // cf. window.__game

seek(sec) { this.beatT = sec; this._fired = {}; this._tick({ deltaMS: 16.7 });
            this.app.ticker.stop(); return this; }
play()   { this.app.ticker.start(); return this; }
```

Then `__cine.seek(6.4)` holds the exact frame you want to judge.

## 6. A canvas has no overflow — anything past width/height is simply gone

The one Timmy has been reporting since the move to Pixi: *"de klipper av
kanterna ... du vet inte om de nar de hander"*. He is right that it is invisible
from the code — there is no error, no console warning, and the shape you drew
just ends at the canvas edge.

CSS `overflow: visible` on the `<canvas>` does **nothing** about this. Neither
does the container. The clip is the drawing surface itself.

It bites hardest on **frames, bands, glows and drop shadows**, because those are
drawn OUTSIDE the rectangle they belong to:

```js
// cardArt.js's paintStagePlate, drawn at (x, y, w, h):
//   · a 30px steel band CENTRED on the edge  -> 15px outside
//   · a cast shadow stepping out in 6 rings   -> ~35px outside
// so the plate needs ~50px of empty canvas beyond its own rect, on every side.
```

**The failure mode is a resize that looks unrelated.** Trimming a canvas's
padding to make its contents bigger is exactly the change that silently
amputates the frame — the contents get bigger and the border quietly loses its
outer half. That happened here on 2026-08-23: `CARD.TOP`/`CARD.BOTTOM_PAD` were
cut from 208/112 to 112/40, which put the plate's bottom edge 6px past the
canvas and its shadow ~56px past.

**The rule**: before shrinking any canvas dimension or padding, find every
draw call that paints outside its own rect and add up the overhang. Write the
clearance down as a named constant next to the numbers it constrains — this
project now has `PLATE_CLEARANCE` in `cardRenderer.js` and a test in
`cards.test.mjs` that fails if the plate stops fitting.

## Verifying, in this project

- The Chrome DevTools MCP connection **wedges regularly** here (protocol
  timeouts on evaluate/screenshot). When it does, confirm work landed by
  fetching `http://localhost:3000/static/js/bundle.js` and grepping it for a
  distinctive string from the change — that proves it compiled and shipped even
  when you cannot see the screen.
- Screenshot and **read the PNG**. Never report a visual result from a diff.
- Both viewports: `393x852x3,mobile,touch` and `1440x860`.

## Related

- `waterdrop-lighting` — MANDATORY and separate: how light itself is made here
  (pooled additive sprites off a baked texture, normal-mapped shading, never a
  community `GlowFilter`). This file is about the API traps around it.
- `waterdrop-svg-materials` — the React/SVG side, for menu chrome.
