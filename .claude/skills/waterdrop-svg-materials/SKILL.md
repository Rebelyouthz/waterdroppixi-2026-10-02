---
name: waterdrop-svg-materials
description: >
  How to render convincing MATERIALS — glass orbs, metal bezels, carved
  sockets/craters, light shafts, living backgrounds — in hand-built SVG/CSS
  for Waterdrop Survivor's React screens (Skill Tree, Talents, gear panels,
  menus). Use whenever a menu element should read as a physical object
  (gem, orb, socket, plate, rivet, frame) rather than a flat coloured
  shape, or when a background needs to feel alive. This is the React/SVG
  side of the house — for anything drawn inside the PixiJS game canvas the
  `waterdrop-lighting` skill is mandatory instead and this one does not
  apply.
---

# Hand-built SVG materials

This project ships **zero image assets** (see the no-emoji / hand-built-SVG
convention). Every "premium" look is gradients, geometry and CSS. That is a
constraint, not a handicap — but only if the lighting rules are obeyed.
Ignore them and you get the flat-disc look Timmy keeps rejecting.

## The one rule everything else follows

**Pick a single global light direction and never break it.** This project
uses **upper-left**. Every material derives from that, and each material
type responds to it *differently*. Getting the difference right is the
whole job — it is what separates "a gem sitting in a hole" from "three
circles stacked on each other".

| Material | Bright where | Dark where | Why |
|---|---|---|---|
| **Sphere / orb** | upper-left | lower-right | Surface faces the light |
| **Crater / hole** | **lower-right** | **upper-left** | The far inner wall catches the light; the near lip shades itself |
| **Raised lip / rim** | upper-left | lower-right | It is a bump, so it behaves like a sphere |
| **Torus / bezel band** | **two** bright bands: strong upper-left, weaker lower-right bounce, darkest between | — | A ring curves away and back |

A crater lit like a sphere reads as a **bump**. That exact bug shipped in
this codebase (`poe-surface-socket` was lit from the top-left) and made
every skill node look like it was glued on top of the surface rather than
seated into it.

## Glass orb — the six-layer stack

Order matters; each layer is cheap, and no filters are used.

1. **Halo** (behind) — radial gradient circle at ~2.3× the bezel radius.
   *Never* a `feGaussianBlur`. See "Performance" below.
2. **Body** — radial gradient, `cx≈33% cy≈27% r≈76%`, stops:
   `#fff → tint(c,.62) → tint(c,.12) → shade(c,.34) → shade(c,.74) → shade(c,.42)`.
   **The last stop must go back UP in brightness.** That final rim-bounce
   is the single strongest "this is glass, not paint" cue — light entering
   the sphere from the environment and leaving at the silhouette edge.
   Drop it and the orb dies instantly.
3. **Inner volume** — a second copy of the same gradient at ~82% radius,
   offset a few percent toward the light, ~55% opacity. Real glass has
   depth; one gradient always flattens.
4. **Bezel** — see below.
5. **Icon** — drawn *under* the specular, because a reflection off the
   surface passes over anything suspended inside it.
6. **Specular** — a soft-edged tilted ellipse (a radial `spec` gradient,
   not flat white) upper-left, **plus a small sharp pinpoint lower-right**.
   Two highlights of different size is the cheapest possible curvature cue.

## Metal bezel

A `<circle>` with `fill="none"` and a thick `stroke` set to a
`linearGradient` in the **default `objectBoundingBox` units** — one def
then re-orients itself correctly for every node on screen, because each
circle has its own bbox. Six stops running `x1=14% y1=0% → x2=86% y2=100%`:

```
#f2e4c0 → #c9a463 → #6d5230 → #2e2113 → #8a6c40 → #241a0e
 bright     warm      mid       darkest   bounce    edge
```

Then three thin outline circles to make it a torus instead of a washer:
a near-black seat *under* the band (`strokeWidth = bw + 2.5`), a bright
inner lip at `r + 0.6`, a dark outer lip at `r + bw`.

**Rivets** around the band are worth the eight extra circles — they turn a
ring into an engineered object, and rivet count doubles as a silent rank
signal (keystone 8 / notable 6 / minor none).

## State = material, not opacity

The failure this replaced: locked nodes were faded to `opacity: 0.4` over a
near-black fill, which erased half the wheel. **Change the metal's VALUE
and the glass's internal light, keep the node fully present.**

- locked → dead-glass gradient + cold dark iron bezel
- reachable, unbought → dead glass with the live gradient at ~30% over it,
  bronze bezel (you can see what you're buying)
- owned → live glass + bronze + halo
- maxed → live glass + gold bezel + bigger, brighter halo

Tune the dead-glass gradient by eye in the browser — first attempt here
went too dark and locked nodes read as empty holes rather than dark gems.

## Progress and badges

Draw level progress as a **dashed arc on the bezel** (`strokeDasharray` of
`` `${pct*C} ${C}` ``, `rotate(-90)` around the node), never as a pie wedge
over the glass — a wedge covers the exact material it is reporting on.
Level numbers need a struck dark disc behind them; bare 9px text on glass
is unreadable below 100% zoom.

## Living backgrounds

Four layers, all animating **`opacity` or `transform` only**:

1. **Twinkling stars** — per-star `--o` custom property, per-star duration
   and *negative* delay so they never blink in unison.
2. **Counter-rotating nebulae** — two huge soft ellipses, ~150s, opposite
   directions, so the field never looks like one rigid turning disc.
3. **Light shafts** — narrow triangles from the core outward, faded with a
   `gradientUnits="userSpaceOnUse"` radial gradient anchored on the wheel
   centre. **This is the key trick**: one def serves every shaft at every
   angle, because the falloff is defined in world space. In the default
   bbox units each triangle would fade relative to its own box and point a
   different way. Make them white so they lighten whatever colour they
   cross instead of fighting it.
4. **A real core light source** — if 80 elements are shaded as if lit from
   somewhere, something on screen has to visibly emit. Rotating corona +
   two out-of-phase breathing flares.

Always end with `@media (prefers-reduced-motion: reduce) { animation: none }`.

## Performance — the filter trap

**Do not hang `filter="url(#glow)"` on many elements.** Each filtered
element allocates its own offscreen buffer and repaints on every pan/zoom
frame. The Skill Tree had one on all ~82 node groups and it was the bulk of
why that screen was heavy (and contributed to a real crash under fast
wheel-zoom).

Replace it with a **radial-gradient halo circle**. It is free, it
composites, and it falls off more naturally than a Gaussian blur of a
hard-edged disc. Reserve real filters for one or two hero elements at most.

Also: elements animated inside a pan/zoom-transformed `<g>` need an
explicit world-coordinate `transform-origin` from the JSX, or they rotate
around their own box and drift off-centre.

## Colour helpers

```js
const hexToRgb = hex => { const v = parseInt(hex.slice(1),16); return [(v>>16)&255,(v>>8)&255,v&255]; };
const lerpColor = (c1,c2,t) => '#' + hexToRgb(c1).map((v,i)=>Math.round(v+(hexToRgb(c2)[i]-v)*t).toString(16).padStart(2,'0')).join('');
const shade = (hex,t) => lerpColor(hex,'#000000',t);
const tint  = (hex,t) => lerpColor(hex,'#ffffff',t);
```

SVG gradients cannot take a colour parameter, so **bake one gradient set
per palette entry at module load** (e.g. 11 branches × 3 = 33 defs serving
82 nodes) rather than one per element.

## Verify it, always

Timmy judges by looking. A gradient that reads correctly in your head can
be invisible on screen — a near-opaque vignette once hid an entire
wood-grain layer here and nobody caught it until a zoomed screenshot.

Use the Chrome DevTools MCP: `new_page` → `emulate` viewport →
`take_screenshot` → actually `Read` the PNG. Then save it into
`WaterdropPixi\chat bilder\` with a dated descriptive name.

## THE TWO VIEWPORTS — both, every time, no exceptions

```
phone    393x852x3,mobile,touch     ← iPhone 16, Timmy's actual device
desktop  1440x860x1
```

**393×852 is iPhone 16's real logical size.** Not 390×844 — that is
iPhone 14/13/12, and it was used here by mistake for a while. iPhone 16 Pro
is 402×874, Plus 430×932, Pro Max 440×956; the plain 16 is the target.

Timmy, 2026-08-17: *"glöm inte öppna en telefon iphone 16 vanlig ruta också
för menyerna blir helt annorlunda där å de är det som är viktigast eller
lika viktigt de ska funka på både pc å data"*. **The phone is not the
secondary check.** He plays and reviews on it, menus lay out completely
differently there, and a screen is not finished until it has been looked at
on both.

Practical: keep two browser pages open, one emulating each, and screenshot
both before calling anything done. A material that reads at 25% zoom on
desktop can be mud at 72% on a phone, and the reverse — that has already
happened here more than once (the inspect panel's orb was 214px wide inside
a 280px desktop panel, and separately pushed BUY below the fold of the
phone's 62vh sheet).

Things that only ever break on the phone in this project: fixed pixel
widths, anything relying on `:hover`, touch targets under 44px, `62vh`
sheets whose content outgrows them, and safe-area insets at the bottom.

## Reference

Timmy's own images in `bilder referrens\` are the source of truth, not
generic "make it shiny". The current bar is
`inzoomad skilträd för du ska se frame å nodes å slots till nodes bättre osv.png`
(2026-08-17). Tell him plainly where a code-built SVG version can and
cannot match a painted reference — this project has never pretended to a
literal texture match, and he has never asked it to.
