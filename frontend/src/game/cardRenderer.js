// Level-up cards, rendered in PixiJS.
//
// Replaces the CSS implementation. The reason for the move is recorded in
// cardArt.js: the frames need dozens of independently animated shapes running
// the whole border and breaking past it in both directions, which is a loop
// here and a fight with pseudo-element budgets there.
//
// TWO LAYERS, and the split is the whole trick:
//
//   pixelRoot -> a RenderTexture at half scale -> Sprite upscaled 2x, NEAREST
//       Frames, materials, body plates, art. Deliberately chunky: Timmy built
//       the reference in Pixi at low resolution and asked for that look
//       specifically ("ja vill ha dom korniga").
//
//   textRoot -> drawn straight to the screen at full device resolution
//       Every glyph of type. Text CANNOT live in the pixel layer: the final
//       framebuffer resolution caps everything drawn into it, so a Text with
//       its own high resolution still lands in a half-res buffer and comes out
//       just as chunky. The reference has crisp type over pixel art, and this
//       is the only way to get both.
//
// Both layers hold one container per card at the SAME logical coordinates, so
// hover lift, reveal and pick animations are applied identically to the pair
// and the two layers can never drift apart.

import { Application, Container, Graphics, Sprite, Text, TextStyle, RenderTexture, Rectangle, Texture, FillGradient } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { makePerimeter, paintFrame, paintBody, paintSheen, bevel, paintStar, paintStagePlate, paintTitlePlaque, MATERIALS, hash } from './cardArt';
import { hasScene, paintScene } from './cardScenes';

// --- geometry --------------------------------------------------------------
// Exported so the probe harness and the layout test measure the same card the
// game draws, instead of a copy that can drift.
// Tried shrinking these toward the old CSS card's 240x320 footprint at one
// point — Timmy's read on the result was that the cards themselves were
// fine, the actual bug was the CANVAS being zoomed/overflowing the viewport
// (fixed separately in overhaul.css's .lu-canvas sizing). So this is back to
// the size that was already right; don't re-shrink it without being asked.
export const CARD = {
  W: 232, H: 560, R: 10, GAP: 52,
  PAD: 9,                       // inset from card edge to the panels
  TOP_H: 40,                    // badge + rarity strip
  UPPER_H: 300,                 // name, type, art
  BADGE: 40,
};

const PIXEL_SCALE = 0.5;        // the graininess. 0.5 = each drawn pixel is 2 screen px
const SANS = '"Segoe UI", Inter, Roboto, system-ui, sans-serif';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

// Glow strength climbs with the tier — the halo is what carries rarity from
// across the screen, before any material detail is resolvable.
// Common used to sit at 0.35 — nearly 12x weaker than mythical's 4.2 — which
// on a real phone screen (dimmer, smaller than a desktop monitor) read as no
// glow at all rather than as "the subtle end of the ladder". Every tier
// should be visibly glowing; only the CLIMB should say which tier is which.
const GLOW = { common: 0.9, uncommon: 1.3, rare: 1.8, epic: 2.5, legendary: 3.2, mythical: 4.2 };
// The wide backlight's own colour. mat.hot (the material's pale highlight
// tone) and rarityColor both wash out to near-grey for common, which reads
// as "no glow at all" no matter how high the alpha goes — grey light on a
// black card is still grey. These are saturated on purpose so the backlight
// always has a visible hue, common included.
const BACK_TINT = {
  common: 0x5fc9ff, uncommon: 0x5affa0, rare: 0x5ac8ff,
  epic: 0xc884ff, legendary: 0xff9a3a, mythical: 0xff4d63,
};

function styleName(color, size) {
  return new TextStyle({
    fontFamily: SANS, fontSize: size, fontWeight: '800', fill: color,
    align: 'center', wordWrap: true, wordWrapWidth: CARD.W - 34, lineHeight: size * 1.12,
    // A dark stroke, not just a shadow. Legendary and mythical put a bright
    // frame right behind the name, and a shadow alone leaves it swimming.
    stroke: { color: 0x05070d, width: 3.5, join: 'round' },
    dropShadow: { color: 0x000000, blur: 4, distance: 2, angle: Math.PI / 2, alpha: 0.85 },
  });
}
function styleLabel(color, size, weight = '700') {
  return new TextStyle({
    fontFamily: SANS, fontSize: size, fontWeight: weight, fill: color,
    align: 'center', letterSpacing: 1.1,
    dropShadow: { color: 0x000000, blur: 3, distance: 1, angle: Math.PI / 2, alpha: 0.8 },
  });
}
// Timmy: "text på rarity skulle kunna glowa i nån tydlig färg" — the
// rarity label specifically, not every small label on the card (the level
// progress text etc. stay on the plain styleLabel above; a glow on every
// caption would just be noise). A dark stroke keeps it legible over bright
// material backgrounds now that the drop shadow is doing colour, not
// contrast.
function styleLabelGlow(color, glowColor, size, weight = '700') {
  return new TextStyle({
    fontFamily: SANS, fontSize: size, fontWeight: weight, fill: color,
    align: 'center', letterSpacing: 1.1,
    stroke: { color: 0x05070d, width: 2, join: 'round' },
    dropShadow: { color: glowColor, blur: 7, distance: 0, alpha: 0.85 },
  });
}
// Gains green, losses red, plain quantities neutral. Pixi parses tags only
// when `tagStyles` has entries, so these three must stay in step with
// markupDesc() below — an unlisted tag renders as literal angle brackets.
const UP = 0x6ee27a, DOWN = 0xff6b6b;

function styleDesc(size, tone) {
  return new TextStyle({
    fontFamily: SANS, fontSize: size, fontWeight: '600', fill: 0xe9eef7,
    align: 'center', wordWrap: true, wordWrapWidth: CARD.W - 34, lineHeight: size * 1.3,
    dropShadow: { color: 0x000000, blur: 3, distance: 1, angle: Math.PI / 2, alpha: 0.9 },
    tagStyles: {
      up: { fill: UP, fontWeight: '800' },
      down: { fill: DOWN, fontWeight: '800' },
      // An unsigned number is a quantity ("3 projectiles"), not a delta. It
      // gets weight so it is findable, and the card's own colour so it never
      // masquerades as a gain.
      num: { fill: tone, fontWeight: '800' },
    },
  });
}

/**
 * Wrap numeric tokens for `tagStyles`. Explicitly signed values are deltas;
 * everything else is a quantity. Angle brackets already in the text are
 * escaped first, or a stray "<" would silently eat the rest of the line.
 */
function markupDesc(desc) {
  return String(desc || '')
    .replace(/[<>]/g, ' ')
    .replace(/([+-]\d+(?:\.\d+)?%?)/g, (m) => (m[0] === '+' ? `<up>${m}</up>` : `<down>${m}</down>`))
    .replace(/(?<![>\d.])(\d+(?:\.\d+)?%)(?!<)/g, '<num>$1</num>');
}

/**
 * Turn an SVG markup string into a Texture. The card art is the existing
 * GameIcon set — 150 hand-built glyphs that already carry the project's "no
 * emoji, ever" rule — so the move to Pixi reuses them rather than starting a
 * new art pipeline. Rendered at 2x the display size and then sampled NEAREST,
 * which keeps the glyph readable while still landing in the pixel layer.
 */
export function svgToTexture(markup, px) {
  return new Promise((resolve) => {
    let svg = markup;
    if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    // Force the intrinsic size: an <svg> with only a viewBox rasterises at
    // whatever the browser feels like, which on Firefox is 150x150 and on
    // Chrome is the CSS default — the glyph would be a different size per
    // browser for no visible reason.
    svg = svg.replace(/width="\d+"/, `width="${px}"`).replace(/height="\d+"/, `height="${px}"`);
    const img = new Image();
    img.onload = () => resolve(Texture.from(img));
    img.onerror = () => resolve(Texture.EMPTY);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export class CardRenderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.onPick = opts.onPick || (() => {});
    this.onHover = opts.onHover || (() => {});
    this.app = new Application();
    this.cards = [];
    this.time = 0;
    this.picked = -1;
    this.ready = false;
    this._destroyed = false;
  }

  async init(count, gap = CARD.GAP) {
    const cols = Math.max(1, count);
    this.gap = gap;
    this.width = cols * CARD.W + (cols - 1) * gap + Math.max(60, gap * 2 + 40);
    this.height = CARD.H + 320;
    await this.app.init({
      canvas: this.canvas,
      width: this.width, height: this.height,
      // Full device resolution: the graininess is produced deliberately by the
      // pixel layer, not by starving the whole canvas. Text has to be sharp.
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true, backgroundAlpha: 0, antialias: true, preference: 'webgl',
    });
    if (this._destroyed) { this.app.destroy(true); return; }

    // The grainy layer. Drawn in logical coordinates and squashed on the way
    // into the texture, so everything else can ignore that it is half size.
    this.rt = RenderTexture.create({
      width: Math.ceil(this.width * PIXEL_SCALE),
      height: Math.ceil(this.height * PIXEL_SCALE),
      resolution: 1,
      scaleMode: 'nearest',
    });
    // ONE soft-radial texture, baked once. Every glow on every card is this
    // texture on an additive Sprite — the project's approved lighting
    // technique (see .claude/skills/waterdrop-lighting). Nothing here redraws
    // a vector circle per frame.
    this.glowTex = this._bakeRadial(128, [
      { offset: 0, color: 'rgba(255,255,255,1)' },
      { offset: 0.32, color: 'rgba(255,255,255,0.55)' },
      { offset: 0.66, color: 'rgba(255,255,255,0.16)' },
      { offset: 1, color: 'rgba(255,255,255,0)' },
    ]);

    this.pixelRoot = new Container();
    this.pixelRoot.scale.set(PIXEL_SCALE);
    // Bloom over the frame layer only. Approved by the same skill — this is a
    // container-level bloom, not a per-sprite community glow filter. It is
    // what makes the ice catch light and the flame tips burn out to white.
    // filterArea is set explicitly per the skill's perf guardrail, so Pixi
    // does not recompute global bounds every frame.
    this.pixelRoot.filters = [new AdvancedBloomFilter({
      threshold: 0.68, bloomScale: 0.5, brightness: 1.0, blur: 2.5, quality: 2,
    })];
    this.pixelRoot.filterArea = new Rectangle(0, 0, this.width, this.height);
    this.pixelSprite = new Sprite(this.rt);
    this.pixelSprite.scale.set(1 / PIXEL_SCALE);
    this.app.stage.addChild(this.pixelSprite);

    // The plate the cards stand on, in the pixel layer so it takes the same
    // chunky treatment as everything else.
    this.gStage = new Graphics();
    this.pixelRoot.addChildAt(this.gStage, 0);
    // Light pools and reflections live between the plate and the cards.
    this.gStageFx = new Graphics();
    this.pixelRoot.addChildAt(this.gStageFx, 1);

    this.textRoot = new Container();
    this.app.stage.addChild(this.textRoot);

    // Title. Drawn on the crisp layer so it stays sharp over the grain.
    this.titleTop = new Text({
      text: 'LEVEL UP',
      style: new TextStyle({
        fontFamily: SANS, fontSize: 34, fontWeight: '800', fill: 0xf3f7ff,
        letterSpacing: 5,
        stroke: { color: 0x0a0d14, width: 5, join: 'round' },
        dropShadow: { color: 0x9fc6ff, blur: 12, distance: 0, alpha: 0.5 },
      }),
    });
    this.titleTop.anchor.set(0.5, 0.5);
    this.titleTop.x = this.width / 2;
    this.titleTop.y = 0;
    this.textRoot.addChild(this.titleTop);

    this.titleSub = new Text({
      text: 'CHOOSE AN UPGRADE',
      style: new TextStyle({
        fontFamily: SANS, fontSize: 13, fontWeight: '700', fill: 0xaebbcd,
        letterSpacing: 5,
        dropShadow: { color: 0x000000, blur: 4, distance: 1, alpha: 0.9 },
      }),
    });
    this.titleSub.anchor.set(0.5, 0.5);
    this.titleSub.x = this.width / 2;
    this.titleSub.y = 0;
    this.textRoot.addChild(this.titleSub);

    // The marks either side of the title, drawn rather than typed — no emoji
    // anywhere in this project.
    this.gTitleFx = new Graphics();
    this.pixelRoot.addChild(this.gTitleFx);

    // The stage plate the cards sit on, and the title plaque above it.
    // Widened margin so the row has visible breathing room inside the frame
    // (Timmy: cards were sitting flush against the frame edge).
    const MARGIN = 46;
    const contentTop = 142;
    const contentBottom = 208 + CARD.H;
    const rowW = count * CARD.W + (count - 1) * gap;
    const contentLeft = (this.width - rowW) / 2;
    this._plate = {
      x: Math.max(14, contentLeft - MARGIN), y: Math.max(14, contentTop - MARGIN),
      w: Math.min(this.width - 28, rowW + MARGIN * 2),
      h: (contentBottom + MARGIN) - Math.max(14, contentTop - MARGIN),
    };
    paintStagePlate(this.gStage, this._plate.x, this._plate.y, this._plate.w, this._plate.h);
    const PLAQUE_H = 78;
    // ONE anchor for the title and the star marks beside it — two independent
    // y's is how they drift apart the moment either one changes.
    this._titleY = this._plate.y - PLAQUE_H * 0.42;
    paintTitlePlaque(this.gStage, this.width / 2, this._titleY, Math.max(360, this.titleTop.width + 150), PLAQUE_H);
    this.titleTop.y = this._titleY - 11;
    this.titleSub.y = this._titleY + 21;

    this.app.ticker.add(this._tick, this);
    this.ready = true;
  }

  // Same helper the Star Raid renderer uses, so the two agree on what a soft
  // light looks like.
  _bakeRadial(size, colorStops) {
    const tg = new Graphics();
    tg.rect(0, 0, size, size).fill(new FillGradient({
      type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops,
    }));
    const tex = this.app.renderer.generateTexture({ target: tg, antialias: true });
    tg.destroy();
    return tex;
  }

  /**
   * @param {Array} models  one per card:
   *   { name, typeLabel, rarity, rarityName, rarityColor, desc, lvl, maxLvl,
   *     glyphSvg, catSvg, isEvolve }
   */
  async setCards(models) {
    if (!this.ready) return;
    this._clearCards();
    const n = models.length;
    const gap = this.gap != null ? this.gap : CARD.GAP;
    const rowW = n * CARD.W + (n - 1) * gap;
    const x0 = (this.width - rowW) / 2;

    for (let i = 0; i < n; i++) {
      const m = models[i];
      const card = this._buildCard(m, i);
      card.baseX = x0 + i * (CARD.W + gap);
      card.baseY = 208;
      this.cards.push(card);
    }
    // Art textures resolve after the card exists, so a slow rasterisation
    // never delays the frames appearing — the plate is up immediately and the
    // glyph fades in.
    await Promise.all(this.cards.map(async (c) => {
      if (c.model.glyphSvg && !c.usesScene) {
        const tex = await svgToTexture(c.model.glyphSvg, 256);
        if (this._destroyed || c.gone) return;
        c.artSprite.texture = tex;
        c.artSprite.width = c.artSprite.height = 168;
        c.artSprite.anchor.set(0.5);
      }
      if (c.model.catSvg) {
        const tex = await svgToTexture(c.model.catSvg, 96);
        if (this._destroyed || c.gone) return;
        c.badgeSprite.texture = tex;
        c.badgeSprite.width = c.badgeSprite.height = 22;
        c.badgeSprite.anchor.set(0.5);
      }
      for (const [sprite, svg] of [[c.evoFromSprite, c.model.evoFromSvg], [c.evoToSprite, c.model.evoToSvg]]) {
        if (!sprite || !svg) continue;
        const tex = await svgToTexture(svg, 64);
        if (this._destroyed || c.gone) return;
        sprite.texture = tex;
        sprite.width = sprite.height = 26;
        sprite.anchor.set(0.5);
      }
    }));
  }

  _buildCard(m, i) {
    const color = m.rarityColor;
    const rarity = RARITY_ORDER.includes(m.rarity) ? m.rarity : 'common';
    const mat = MATERIALS[rarity];
    const seed = i * 977 + 13;

    // --- pixel layer ------------------------------------------------------
    const px = new Container();
    px.x = 0; px.y = 0;
    this.pixelRoot.addChild(px);

    // Rarity halo. One additive sprite, stretched to the card's proportions —
    // it only ever changes tint, scale and alpha after this.
    // Two halos: a wide soft one that reads as light coming from BEHIND the
    // card, and a tighter one hugging the frame. One sprite alone reads as a
    // rim light on the card rather than as something lit from behind.
    const backSprite = new Sprite(this.glowTex);
    backSprite.anchor.set(0.5);
    backSprite.blendMode = 'add';
    backSprite.x = CARD.W / 2; backSprite.y = CARD.H / 2;
    backSprite.tint = BACK_TINT[rarity] || mat.hot;
    px.addChild(backSprite);

    const glowSprite = new Sprite(this.glowTex);
    glowSprite.anchor.set(0.5);
    glowSprite.blendMode = 'add';
    glowSprite.x = CARD.W / 2; glowSprite.y = CARD.H / 2;
    glowSprite.tint = color;
    px.addChild(glowSprite);

    const gBody = new Graphics(); px.addChild(gBody);
    const gPanels = new Graphics(); px.addChild(gPanels);
    // The specular sweep has to stop at the card edge, so it rides its own
    // mask. A parallelogram wide enough to cross the face is necessarily wider
    // than the card; without the mask it paints over the neighbours.
    const gSheenMask = new Graphics();
    gSheenMask.roundRect(0, 0, CARD.W, CARD.H, CARD.R).fill({ color: 0xffffff });
    px.addChild(gSheenMask);
    const gSheen = new Graphics(); px.addChild(gSheen); gSheen.mask = gSheenMask;
    // The art well light. Was ten stacked filled circles redrawn every frame;
    // now one baked radial on an additive sprite, tinted with the PICTURE's
    // colour. Under the art, never over it — over it, the stacked discs washed
    // a grey katana off the card entirely.
    const artGlowSprite = new Sprite(this.glowTex);
    artGlowSprite.anchor.set(0.5);
    artGlowSprite.blendMode = 'add';
    artGlowSprite.tint = m.artColor != null ? m.artColor : color;
    px.addChild(artGlowSprite);
    // gArtFx now carries only the orbiting motes and the rim rings — shapes,
    // not light.
    const gArtFx = new Graphics(); px.addChild(gArtFx);
    const artSprite = new Sprite(Texture.EMPTY); px.addChild(artSprite);
    // Procedural scene, when this card has one. Painted ONCE — Pixi caches the
    // geometry, so a scene with a few hundred shapes costs nothing per frame.
    // A scene beats the rasterised 32-unit glyph at card size by a mile: it is
    // drawn at the size it is shown, with the same lighting model the game's
    // own background world uses.
    const gScene = new Graphics(); px.addChild(gScene);
    const gFrame = new Graphics(); px.addChild(gFrame);
    const badgeSprite = new Sprite(Texture.EMPTY); px.addChild(badgeSprite);

    paintBody(gBody, 0, 0, CARD.W, CARD.H, CARD.R, color);
    // Grain. A flat fill reads as paper however good the frame is, and the
    // pixel layer quantises these to 2px blocks, which is exactly the texture
    // the reference has. Deterministic, so it does not crawl between frames.
    for (let i = 0; i < 260; i++) {
      const gx = 4 + hash(i * 3 + 7, seed) * (CARD.W - 8);
      const gy = 4 + hash(i * 5 + 11, seed) * (CARD.H - 8);
      const up = hash(i * 7 + 13, seed) > 0.5;
      gBody.rect(gx, gy, 2, 2).fill({
        color: up ? 0xffffff : 0x000000,
        alpha: (up ? 0.030 : 0.055) * (0.4 + hash(i * 11, seed) * 0.6),
      });
    }
    // No initial glow paint: the halo is glowSprite, and _tick sets its scale
    // and alpha on the first frame.

    // Two panels, exactly as the reference sheet: an upper plate carrying the
    // name and the art, a lower plate carrying the rule text. One undivided
    // rectangle reads as a label; two plates read as a card.
    const upY = CARD.TOP_H + 2;
    const loY = upY + CARD.UPPER_H + 6;
    const pw = CARD.W - CARD.PAD * 2;
    // Chamfered, not rounded. The reference cuts these corners at 45 degrees,
    // and that single difference is what makes the panel read as a cut plate
    // rather than as a rounded web panel.
    const chamfer = (gg, px0, py0, pw0, ph0, c) => {
      gg.moveTo(px0 + c, py0)
        .lineTo(px0 + pw0 - c, py0).lineTo(px0 + pw0, py0 + c)
        .lineTo(px0 + pw0, py0 + ph0 - c).lineTo(px0 + pw0 - c, py0 + ph0)
        .lineTo(px0 + c, py0 + ph0).lineTo(px0, py0 + ph0 - c)
        .lineTo(px0, py0 + c).closePath();
    };
    chamfer(gPanels, CARD.PAD, upY, pw, CARD.UPPER_H, 13);
    gPanels.fill({ color: 0x0b0f1a, alpha: 0.72 });
    chamfer(gPanels, CARD.PAD, upY, pw, CARD.UPPER_H, 13);
    gPanels.stroke({ width: 2, color, alpha: 0.30 });
    // Inner border around the art itself, inset from the panel — the reference
    // frames the illustration as well as the panel it sits in.
    gPanels.roundRect(CARD.PAD + 7, upY + 74, pw - 14, CARD.UPPER_H - 84, 4)
      .stroke({ width: 1.5, color, alpha: 0.22 });
    for (const [ax, ay, sx, sy] of [
      [CARD.PAD + 7, upY + 74, 1, 1], [CARD.W - CARD.PAD - 7, upY + 74, -1, 1],
      [CARD.PAD + 7, upY + CARD.UPPER_H - 10, 1, -1],
      [CARD.W - CARD.PAD - 7, upY + CARD.UPPER_H - 10, -1, -1],
    ]) {
      gPanels.moveTo(ax + sx * 9, ay).lineTo(ax, ay).lineTo(ax, ay + sy * 9)
        .stroke({ width: 2, color: mat.hot, alpha: 0.5 });
    }
    chamfer(gPanels, CARD.PAD, loY, pw, CARD.H - loY - CARD.PAD, 13);
    gPanels.fill({ color: 0x0b0f1a, alpha: 0.72 });
    chamfer(gPanels, CARD.PAD, loY, pw, CARD.H - loY - CARD.PAD, 13);
    gPanels.stroke({ width: 2, color, alpha: 0.30 });
    // Both panels are SUNK into the card face (light along their bottom lip),
    // which is what makes the card read as a plate with wells milled into it.
    bevel(gPanels, CARD.PAD, upY, pw, CARD.UPPER_H, 6, 2.5, 0.16, 0.7, -1);
    bevel(gPanels, CARD.PAD, loY, pw, CARD.H - loY - CARD.PAD, 6, 2.5, 0.16, 0.7, -1);

    // Header bar: the rarity strip gets its own darker ground running the full
    // width, which is what separates the header from the art panel in the
    // reference. Without it the badge and the rarity word float on the plate.
    gPanels.roundRect(CARD.PAD, 5, CARD.W - CARD.PAD * 2, CARD.TOP_H - 8, 5)
      .fill({ color: 0x080b13, alpha: 0.9 });
    gPanels.roundRect(CARD.PAD, 5, CARD.W - CARD.PAD * 2, CARD.TOP_H - 8, 5)
      .stroke({ width: 1.5, color, alpha: 0.28 });
    bevel(gPanels, CARD.PAD, 5, CARD.W - CARD.PAD * 2, CARD.TOP_H - 8, 5, 2, 0.12, 0.6, -1);
    // A rarity-coloured wash fading out to the right, so the strip carries the
    // tier even where the badge and the word do not reach.
    for (let i = 0; i < 6; i++) {
      gPanels.roundRect(CARD.PAD + i * ((CARD.W - CARD.PAD * 2) / 6), 5,
        (CARD.W - CARD.PAD * 2) / 6 + 1, CARD.TOP_H - 8, i === 0 ? 5 : 0)
        .fill({ color, alpha: 0.13 * (1 - i / 6) });
    }

    // The LOGO housing: a recessed well with its own rim light, standing proud
    // of the header bar it sits in.
    const bX = -2, bY = -4, bW = CARD.BADGE + 4, bH = CARD.BADGE + 2;
    gPanels.roundRect(bX - 1.5, bY - 1.5, bW + 3, bH + 3, 5)
      .fill({ color: 0x000000, alpha: 0.55 });
    gPanels.roundRect(bX, bY, bW, bH, 4).fill({ color: 0x141a26, alpha: 1 });
    gPanels.roundRect(bX, bY, bW, bH, 4).stroke({ width: 2, color, alpha: 0.9 });
    gPanels.roundRect(bX + 3, bY + 3, bW - 6, bH - 6, 2)
      .stroke({ width: 1, color: mat.hot, alpha: 0.25 });
    bevel(gPanels, bX, bY, bW, bH, 4, 2.5, 0.34, 0.65, 1);

    artSprite.x = CARD.W / 2;
    artSprite.y = upY + CARD.UPPER_H - 118;
    artGlowSprite.x = artSprite.x;
    artGlowSprite.y = artSprite.y;
    const sceneKey = m.artKey;
    // Timmy: use the same GameIcon glyph the Weaponsmith already shows for
    // every weapon, instead of a bespoke painted scene — it already exists,
    // already looks right, and keeps the level-up card matching the icon the
    // player picked it by. Scene painters stay in cardScenes.js unused rather
    // than deleted, in case that changes again.
    const usesScene = false && !!(sceneKey && hasScene(sceneKey));
    if (usesScene) {
      // Painted about the origin so its bounds are its own, then fitted.
      paintScene(gScene, sceneKey, 0, 0, 98, m.artColor != null ? m.artColor : color);
      const b = gScene.getLocalBounds();
      const halfW = Math.max(Math.abs(b.minX), Math.abs(b.maxX)) || 1;
      const halfH = Math.max(Math.abs(b.minY), Math.abs(b.maxY)) || 1;
      // The art box: the panel width less its inner border, and the vertical
      // room between the type line and the panel floor.
      const BOX_W = (CARD.W - CARD.PAD * 2 - 22) / 2;
      const BOX_H = 104;
      const fit = Math.min(1, BOX_W / halfW, BOX_H / halfH);
      gScene.scale.set(fit);
      // Recentre on the drawing's actual middle, not on the origin — several
      // scenes are deliberately off-axis (the comet leaves its launcher, the
      // meteor swarm comes in from one side).
      gScene.x = artSprite.x - ((b.minX + b.maxX) / 2) * fit;
      gScene.y = artSprite.y - ((b.minY + b.maxY) / 2) * fit;
      artSprite.visible = false;
    }
    badgeSprite.x = bX + bW / 2;
    badgeSprite.y = bY + bH / 2;

    const perim = makePerimeter(0, 0, CARD.W, CARD.H, CARD.R);

    // --- text layer -------------------------------------------------------
    const tx = new Container();
    this.textRoot.addChild(tx);

    const rarityTxt = new Text({ text: (m.rarityName || rarity).toUpperCase(), style: styleLabelGlow(color, BACK_TINT[rarity] || color, 15, '800') });
    rarityTxt.anchor.set(0, 0.5);
    rarityTxt.x = CARD.PAD + CARD.BADGE + 12;
    rarityTxt.y = 5 + (CARD.TOP_H - 8) / 2 + 1;
    tx.addChild(rarityTxt);

    // Common gets white; every other tier is named in its own colour. That is
    // how the reference distinguishes "you have a card" from "you have THAT
    // card" without another badge.
    const nameColor = rarity === 'common' ? 0xffffff : color;
    let nameSize = 22;
    let nameTxt = new Text({ text: m.name, style: styleName(nameColor, nameSize) });
    // Long names wrap to three lines and shove the art down through the panel
    // floor. Shrink until it fits two, which every name in the game does by 17.
    while (nameTxt.height > nameSize * 2.4 && nameSize > 15) {
      nameSize -= 1.5;
      nameTxt.destroy();
      nameTxt = new Text({ text: m.name, style: styleName(nameColor, nameSize) });
    }
    nameTxt.anchor.set(0.5, 0);
    nameTxt.x = CARD.W / 2;
    nameTxt.y = upY + 12;
    tx.addChild(nameTxt);

    // The type line used to print twice — once right under the name, once at
    // the head of the lower panel — and on a real phone screen the two sat
    // close enough to read as a stutter rather than as reinforcement. One
    // label, at the head of the lower panel (where it actually earns its
    // place: by the time your eye reaches the rule text you've stopped
    // looking at the header, and "is this a weapon or a passive" is the
    // question you re-ask while reading what it does).
    const typeTxt2 = new Text({ text: (m.typeLabel || '').toUpperCase(), style: styleLabel(color, 14, '800') });
    typeTxt2.anchor.set(0.5, 0);
    typeTxt2.x = CARD.W / 2;
    typeTxt2.y = loY + 12;
    tx.addChild(typeTxt2);

    const descTxt = new Text({ text: markupDesc(m.desc), style: styleDesc(14, color) });
    descTxt.anchor.set(0.5, 0);
    descTxt.x = CARD.W / 2;
    // Centred in whatever band is left rather than pinned under the divider.
    // A one-line rule and a three-line rule otherwise sit at the same top edge
    // and leave wildly different holes above the level row — which is exactly
    // how the short cards came out looking unfinished.
    {
      const hasRecipe = !!(m.evoFromId && m.evoToId);
      const bandTop = loY + 46;
      const bandBottom = hasRecipe ? CARD.H - CARD.PAD - 100 : CARD.H - CARD.PAD - 44;
      descTxt.y = Math.max(bandTop, bandTop + (bandBottom - bandTop - descTxt.height) / 2);
    }
    tx.addChild(descTxt);

    // Level dots ride the bottom of the lower panel.
    let dots = null;
    if (Number.isFinite(m.lvl) && m.maxLvl > 0) {
      dots = new Graphics();
      px.addChild(dots);
      const lvlTxt = new Text({
        text: m.lvl < m.maxLvl ? `LV ${m.lvl} ▸ ${m.lvl + 1}  /${m.maxLvl}` : `LV ${m.lvl}  MAX`,
        style: styleLabel(0xa9b6c8, 11.5),
      });
      lvlTxt.anchor.set(0.5, 1);
      lvlTxt.x = CARD.W / 2;
      lvlTxt.y = CARD.H - CARD.PAD - 26;
      tx.addChild(lvlTxt);
    }

    // EVOLUTION RECIPE — what this weapon is now, and what it becomes.
    // Only built when the weapon actually has an evolved form: six weapons do,
    // and the other thirty must not show a recipe for a transform that does
    // not exist (the same mistake the card name used to make).
    let evoFromSprite = null, evoToSprite = null;
    if (m.evoFromId && m.evoToId) {
      const ey = CARD.H - CARD.PAD - 78;
      const gEvo = new Graphics();
      gEvo.roundRect(CARD.PAD + 10, ey - 17, CARD.W - (CARD.PAD + 10) * 2, 34, 5)
        .fill({ color: 0x000000, alpha: 0.45 })
        .stroke({ width: 2, color, alpha: m.evoReady ? 0.85 : 0.28 });
      // The arrow between the two. Solid when the transform is available,
      // hollow when it is still locked — the card should say which at a glance
      // rather than only in the prose.
      const ax = CARD.W / 2;
      gEvo.moveTo(ax - 7, ey - 6).lineTo(ax + 6, ey).lineTo(ax - 7, ey + 6).closePath()
        .fill({ color: m.evoReady ? mat.hot : 0x55617a, alpha: m.evoReady ? 1 : 0.7 });
      px.addChild(gEvo);

      evoFromSprite = new Sprite(Texture.EMPTY);
      evoFromSprite.x = CARD.PAD + 32; evoFromSprite.y = ey;
      evoToSprite = new Sprite(Texture.EMPTY);
      evoToSprite.x = CARD.W - CARD.PAD - 32; evoToSprite.y = ey;
      px.addChild(evoFromSprite); px.addChild(evoToSprite);
      // A locked evolution is shown greyed rather than hidden: knowing the
      // weapon CAN evolve is what makes buying the unlock worth doing.
      if (!m.evoReady) { evoFromSprite.alpha = 0.5; evoToSprite.alpha = 0.35; }

      const evoTxt = new Text({
        text: m.evoReady ? 'EVOLUTION READY' : 'EVOLUTION LOCKED',
        style: styleLabel(m.evoReady ? color : 0x8794a8, 9),
      });
      evoTxt.anchor.set(0.5, 0);
      evoTxt.x = CARD.W / 2;
      evoTxt.y = ey + 19;
      tx.addChild(evoTxt);
    }

    const gDivider = new Graphics();
    // Divider with a centre diamond, tapering out to nothing at both ends —
    // a plain rule reads as a table row, this reads as a card.
    const dy = loY + 36, dx0 = CARD.PAD + 16, dx1 = CARD.W - CARD.PAD - 16, dmid = CARD.W / 2;
    gDivider.moveTo(dx0, dy).lineTo(dmid - 12, dy).stroke({ width: 2, color, alpha: 0.20 });
    gDivider.moveTo(dmid - 34, dy).lineTo(dmid - 12, dy).stroke({ width: 2, color, alpha: 0.65 });
    gDivider.moveTo(dx1, dy).lineTo(dmid + 12, dy).stroke({ width: 2, color, alpha: 0.20 });
    gDivider.moveTo(dmid + 34, dy).lineTo(dmid + 12, dy).stroke({ width: 2, color, alpha: 0.65 });
    gDivider.moveTo(dmid, dy - 5).lineTo(dmid + 6, dy).lineTo(dmid, dy + 5).lineTo(dmid - 6, dy)
      .closePath().fill({ color: mat.hot, alpha: 0.9 });
    // Rivets at the four inner corners of the plate, lit top-left like every
    // other bevel on the card.
    for (const [rx, ry] of [
      [CARD.PAD + 7, CARD.TOP_H + 9], [CARD.W - CARD.PAD - 7, CARD.TOP_H + 9],
      [CARD.PAD + 7, CARD.H - CARD.PAD - 7], [CARD.W - CARD.PAD - 7, CARD.H - CARD.PAD - 7],
    ]) {
      gDivider.circle(rx, ry, 3.4).fill({ color: 0x0a0e16 });
      gDivider.circle(rx, ry, 3.4).stroke({ width: 1.5, color, alpha: 0.55 });
      gDivider.circle(rx - 1, ry - 1, 1.3).fill({ color: 0xffffff, alpha: 0.45 });
    }
    // Inner hairline just inside the frame, so the plate has an edge of its own.
    gDivider.roundRect(4, 4, CARD.W - 8, CARD.H - 8, Math.max(2, CARD.R - 3))
      .stroke({ width: 1.5, color: mat.hot, alpha: 0.16 });
    px.addChild(gDivider);

    // Hit area lives on the text layer, because the pixel layer is rendered
    // off-screen into a texture and is not part of the event tree at all.
    tx.eventMode = 'static';
    tx.cursor = 'pointer';
    tx.hitArea = new Rectangle(0, 0, CARD.W, CARD.H);
    const card = {
      model: m, index: i, rarity, mat, seed, color,
      px, tx, gFrame, gArtFx, glowSprite, backSprite, artGlowSprite, gSheen, dots, artSprite, gScene, usesScene, badgeSprite, evoFromSprite, evoToSprite, perim,
      hover: 0, targetHover: 0, reveal: 0, revealDelay: i * 0.09, gone: false,
    };
    tx.on('pointerenter', () => { card.targetHover = 1; this.onHover(i); });
    tx.on('pointerleave', () => { card.targetHover = 0; });
    tx.on('pointertap', () => this.onPick(i));
    return card;
  }

  setPicked(i) { this.picked = i; }

  _tick(ticker) {
    if (!this.ready || this._destroyed) return;
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    this.time += dt;

    for (const c of this.cards) {
      // Deal-in. Each card rises and fades in a beat after the one before it,
      // which is what makes three cards read as being dealt rather than as a
      // row appearing.
      c.reveal = Math.min(1, Math.max(0, c.reveal + (this.time > c.revealDelay ? dt * 2.6 : 0)));
      // Back-out easing: the card overshoots its resting height and settles.
      // A card that simply fades in has no weight; one that lands does.
      const u = c.reveal;
      const rv = u >= 1 ? 1 : 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;

      c.hover += (c.targetHover - c.hover) * Math.min(1, dt * 12);

      const chosen = this.picked === c.index;
      const rejected = this.picked >= 0 && !chosen;
      const lift = c.hover * 9 + (chosen ? 14 : 0);
      const scale = 1 + c.hover * 0.035 + (chosen ? 0.06 : 0) - (rejected ? 0.08 : 0);
      const alpha = Math.min(1, c.reveal * 1.6) * (rejected ? 0.25 : 1);

      for (const layer of [c.px, c.tx]) {
        layer.pivot.set(CARD.W / 2, CARD.H / 2);
        layer.x = c.baseX + CARD.W / 2;
        layer.y = c.baseY + CARD.H / 2 - lift + (1 - rv) * 150;
        layer.scale.set(scale);
        layer.alpha = alpha;
      }

      // The frame is repainted every frame. It is the only thing here that is
      // genuinely animated — vines sway, ice grows and shrinks, flames flicker,
      // fissures pulse — and Timmy asked for exactly that: "de lyser å gnistrar
      // eller rör sig".
      const boost = 1 + c.hover * 0.35;
      paintFrame(c.gFrame, c.perim, c.rarity, this.time * boost, c.seed);
      // Light is tint + scale + alpha on a baked sprite. No geometry rebuilt.
      const breathe = 0.85 + 0.15 * Math.sin(this.time * 2 + c.seed);
      const gs = GLOW[c.rarity] * breathe * (1 + c.hover * 0.5);
      c.glowSprite.alpha = Math.min(0.75, 0.13 * gs);
      c.glowSprite.scale.set(
        (CARD.W * (1.24 + gs * 0.075)) / 128,
        (CARD.H * (1.00 + gs * 0.028)) / 128,
      );
      // The back light breathes on its own slower cycle, so the two halos
      // drift in and out of phase instead of pulsing as one unit. A bit
      // wider/brighter than the original so it genuinely grows behind the
      // card instead of just rimming the frame — but capped hard, because
      // additive light from six adjacent cards stacks fast: the first pass
      // at this went to 4.4x width, which on legendary/mythical (GLOW 3.2/
      // 4.2) washed the whole plate out into one white sheet instead of
      // distinct rarity-coloured pools.
      const back = 0.8 + 0.2 * Math.sin(this.time * 1.15 + c.seed * 0.7);
      // Brighter but NOT wider than the original — the whiteout came from
      // spreading further (4.4x card width) so six adjacent auras overlapped
      // hard enough to sum past white. Keeping the footprint close to the
      // original width while raising alpha gives each card a strong, clearly
      // its-own-colour pool without eating into its neighbours'.
      c.backSprite.alpha = Math.min(1.0, 0.30 * gs * back);
      c.backSprite.scale.set(
        (CARD.W * (3.4 + gs * 0.38) * back) / 128,
        (CARD.H * (2.0 + gs * 0.15) * back) / 128,
      );
      const apulse = 0.8 + 0.2 * Math.sin(this.time * 1.6 + c.seed);
      c.artGlowSprite.alpha = 0.30 * apulse * (1 + c.hover * 0.4);
      c.artGlowSprite.scale.set((240 * apulse) / 128);
      // Slow sweep, offset per card so a row does not flash in unison, and
      // faster under the pointer — the card you are considering should look
      // more alive than the ones you are not.
      paintSheen(c.gSheen, 0, 0, CARD.W, CARD.H, CARD.R,
        this.time * (0.09 + c.hover * 0.13) + c.index * 0.21, 1 + c.hover * 1.6);
      this._paintArtFx(c);
      if (c.dots) this._paintDots(c);
    }

    // Stage light: a pool behind each card in its own rarity colour, and a
    // reflection on the plate under it. Both are what make the cards sit IN
    // something rather than on top of it.
    {
      const g = this.gStageFx;
      g.clear();
      for (const c of this.cards) {
        if (c.reveal <= 0.02) continue;
        const cx = c.baseX + CARD.W / 2;
        const top = c.baseY;
        const bot = c.baseY + CARD.H;
        const pulse = 0.8 + 0.2 * Math.sin(this.time * 1.4 + c.seed);
        const k = Math.min(1, c.reveal) * pulse;
        // Pool behind the card, widest at the bottom.
        // A large radial burst centred on the card. This is most of what the
        // mockups are doing: the card is a light source and the dark interior
        // is what it burns against.
        const my2 = (top + bot) / 2;
        for (let i = 12; i >= 1; i--) {
          g.ellipse(cx, my2, CARD.W * (0.30 + i * 0.16), CARD.H * (0.22 + i * 0.075))
            .fill({ color: c.color, alpha: 0.019 * k * ((13 - i) / 12) ** 1.6 });
        }
        // Rays fanning off it, so the burst has structure rather than being a
        // smooth blob.
        for (let r2 = 0; r2 < 14; r2++) {
          const a2 = (r2 / 14) * Math.PI * 2 + this.time * 0.09 + c.seed;
          const len = CARD.H * (0.55 + hash(r2, c.seed) * 0.5)
            * (0.85 + 0.15 * Math.sin(this.time * 1.6 + r2));
          const wdt = 5 + hash(r2 * 3, c.seed) * 12;
          const ux = Math.cos(a2), uy = Math.sin(a2);
          const pxr = -uy, pyr = ux;
          g.moveTo(cx - pxr * wdt, my2 - pyr * wdt)
            .lineTo(cx + ux * len, my2 + uy * len)
            .lineTo(cx + pxr * wdt, my2 + pyr * wdt)
            .closePath()
            .fill({ color: c.color, alpha: 0.028 * k });
        }
        // The tight pool at the card's feet.
        for (let i = 6; i >= 1; i--) {
          g.ellipse(cx, bot - 14, CARD.W * (0.42 + i * 0.13), 20 + i * 12)
            .fill({ color: c.color, alpha: 0.030 * k * (7 - i) / 6 });
        }
        // A vertical wash up the plate behind the card.
        for (let i = 0; i < 7; i++) {
          const u2 = i / 7;
          g.rect(cx - CARD.W * 0.62, top + (bot - top) * u2, CARD.W * 1.24, (bot - top) / 7 + 1)
            .fill({ color: c.color, alpha: 0.040 * k * u2 });
        }
        // Light reaching the plate's frame directly above and below the card,
        // so the frame itself picks up the tier's colour rather than staying
        // neutral metal behind a coloured card.
        if (this._plate) {
          const pl = this._plate;
          for (let i = 0; i < 4; i++) {
            const a2 = 0.10 * k * (1 - i / 4);
            g.rect(cx - CARD.W * 0.5, pl.y - 6 + i * 5, CARD.W, 5).fill({ color: c.color, alpha: a2 });
            g.rect(cx - CARD.W * 0.5, pl.y + pl.h + 1 - i * 5, CARD.W, 5).fill({ color: c.color, alpha: a2 });
          }
        }
        // Reflection: a short mirrored smear on the plate under the card,
        // fading fast. A full mirror would read as ice, not as polish.
        for (let i = 0; i < 5; i++) {
          const u2 = i / 5;
          g.rect(cx - CARD.W * 0.42 * (1 - u2 * 0.3), bot + 4 + u2 * 26,
            CARD.W * 0.84 * (1 - u2 * 0.3), 7)
            .fill({ color: c.color, alpha: 0.125 * k * (1 - u2) ** 2 });
        }
      }
      // Title marks: two stars either side, breathing.
      const tx0 = this.width / 2;
      const tw = this.titleTop ? this.titleTop.width : 200;
      const gt = this.gTitleFx;
      gt.clear();
      for (const side of [-1, 1]) {
        const sx = tx0 + side * (tw / 2 + 34);
        const p2 = 0.7 + 0.3 * Math.sin(this.time * 2.2 + (side > 0 ? 1.4 : 0));
        paintStar(gt, sx, this._titleY - 11, 17 * p2, 0xc9a227, 0.38 * p2);
        paintStar(gt, sx, this._titleY - 11, 9 * p2, 0xffffff, 0.85 * p2);
        paintStar(gt, sx + side * 18, this._titleY - 25, 5 * p2, 0x9c2b2b, 0.6 * p2);
      }
    }

    // Pixel layer first, then the app's own render draws the sprite plus text.
    this.app.renderer.render({ container: this.pixelRoot, target: this.rt, clear: true });
  }

  // A ring of light behind the art plus rarity-tinted motes, so the picture
  // sits in something rather than floating on a flat panel.
  _paintArtFx(c) {
    const g = c.gArtFx;
    g.clear();
    const cx = c.artSprite.x, cy = c.artSprite.y;
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 1.6 + c.seed);
    // The LIGHT in the art well is a baked additive sprite (artGlowSprite),
    // tinted with the picture's own colour rather than the rarity's — any card
    // can roll any rarity, so a rarity-tinted backdrop made the same weapon
    // read differently, sometimes barely at all, depending on a roll that has
    // nothing to do with what it is. Rarity stays on the frame, the halo, the
    // rarity word and the name.
    //
    // What is left here is geometry: the rim rings and the orbiting motes.
    const art = c.model.artColor != null ? c.model.artColor : c.color;
    const motes = 4 + RARITY_ORDER.indexOf(c.rarity) * 2;
    for (let i = 0; i < motes; i++) {
      const a = this.time * (0.4 + (i % 3) * 0.16) + i * (Math.PI * 2 / motes);
      const rad = 48 + Math.sin(this.time * 1.3 + i) * 10;
      const s = 2 + hash(i, c.seed) * 2.5;
      g.rect(cx + Math.cos(a) * rad - s / 2, cy + Math.sin(a) * rad * 0.62 - s / 2, s, s)
        .fill({ color: art, alpha: 0.35 + 0.4 * Math.sin(this.time * 2 + i) });
    }
  }

  _paintDots(c) {
    const g = c.dots;
    g.clear();
    const m = c.model;
    const n = m.maxLvl;
    const gap = Math.min(13, (CARD.W - 46) / n);
    const w = (n - 1) * gap;
    const y = CARD.H - CARD.PAD - 13;
    const x0 = CARD.W / 2 - w / 2;
    // Timmy: "level dot som lyser måste va nån tydlig färg glow" — same root
    // cause as the backlight fix above (BACK_TINT): c.color/c.mat.hot both
    // wash out to near-grey on common, so a "lit" dot and an unlit one read
    // almost the same. The saturated tint fixes it here too.
    const glowC = BACK_TINT[c.rarity] || c.color;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * gap;
      if (i < m.lvl) {
        g.circle(cx, y, 4).fill({ color: glowC, alpha: 1 });
        g.circle(cx, y, 7).stroke({ width: 2, color: glowC, alpha: 0.45 });
      } else if (i === m.lvl) {
        // The dot this pick would light. Pulsing, because "what does taking
        // this give me" is the actual question in front of the player.
        const p = 0.5 + 0.5 * Math.sin(this.time * 4.5);
        g.circle(cx, y, 4).fill({ color: glowC, alpha: 0.6 + 0.4 * p });
        g.circle(cx, y, 7 + p * 2.5).stroke({ width: 2, color: glowC, alpha: 0.6 * p });
      } else {
        g.circle(cx, y, 3).stroke({ width: 2, color: 0x53627a, alpha: 0.75 });
      }
    }
  }

  _clearCards() {
    for (const c of this.cards) { c.gone = true; c.px.destroy({ children: true }); c.tx.destroy({ children: true }); }
    this.cards = [];
  }

  destroy() {
    this._destroyed = true;
    if (!this.ready) return;
    this.app.ticker.remove(this._tick, this);
    this._clearCards();
    if (this.rt) this.rt.destroy(true);
    if (this.glowTex) this.glowTex.destroy(true);
    // Destroying the canvas as well would tear down the WebGL context that a
    // remounted modal is about to ask for again; React StrictMode double-mounts
    // in development and that is exactly the path it takes.
    this.app.destroy(false, { children: true, texture: false });
    this.ready = false;
  }
}
