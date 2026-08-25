// Waterdrop Survivor — THE ONE LIGHTING TECHNIQUE, in one place.
//
// The `waterdrop-lighting` skill is explicit that this game has exactly one
// approved way to make something emit or receive light:
//
//   · analytically-baked normal maps (sphere + flat), computed in JS at
//     startup because every entity is a procedural shape with no authored art
//   · ONE shared per-pixel GLSL fragment shader — real Lambertian diffuse plus
//     Blinn-Phong specular — wrapped per lit object via `Filter.from()`
//   · pooled additive light sprites off a baked soft-radial texture for the
//     light SOURCES themselves
//
// and that a community glow filter (`GlowFilter`), or a flat radial-gradient
// sprite standing in for per-object shading, is forbidden.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────
// It all lived inside `pixiRenderer.js`. The moment a SECOND Pixi surface
// needed real light — the walkable station room — the choice was to copy the
// shader or to lift it. Copying is this project's dominant and most expensive
// bug: two parallel implementations of one concept that silently diverge, so
// that a lighting tune lands in the run and not in the station, or vice versa,
// and nothing ever throws.
//
// Same move, same reasoning, as `heroDraw.js` on 2026-08-18: the drawing that
// two surfaces share is lifted into a module and both import it, rather than
// the second surface growing its own lookalike.
//
// `pixiRenderer.js` keeps its `_makeLitFilter` / `_updateLitUniforms` methods
// as thin delegations so all its existing call sites are untouched.
import { Graphics, Sprite, Filter, Texture, FillGradient, defaultFilterVert } from 'pixi.js';

// ── The shader ───────────────────────────────────────────────────────
// GLSL ES 3.0 — `in`/`out`, `texture()`, NOT `gl_FragColor`/`texture2D`.
// The normal map supplies the surface direction per pixel; `uObjSize` puts the
// light into the object's own local pixel space, which is what makes the
// shading independent of the scale the sprite happened to be rasterized at.
export const LIT_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uNormalTexture;
uniform vec2 uLightPos;
uniform vec3 uLightColor;
uniform float uLightRadius;
uniform float uAmbient;
uniform vec2 uObjSize;

void main() {
  vec4 base = texture(uTexture, vTextureCoord);
  if (base.a < 0.01) { finalColor = vec4(0.0); return; }
  vec4 nSample = texture(uNormalTexture, vTextureCoord);
  vec3 normal = normalize(nSample.rgb * 2.0 - 1.0);
  vec2 fragLocal = (vTextureCoord - 0.5) * uObjSize;
  vec2 toLight2D = uLightPos - fragLocal;
  float dist = length(toLight2D);
  vec3 lightDir = normalize(vec3(toLight2D, 55.0));
  float diff = max(dot(normal, lightDir), 0.0);
  float atten = clamp(1.0 - dist / uLightRadius, 0.0, 1.0);
  atten *= atten;
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfV = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfV), 0.0), 20.0) * atten;
  vec3 lit = base.rgb * (uAmbient + diff * atten * uLightColor) + spec * uLightColor * 0.8;
  finalColor = vec4(lit, base.a);
}`;

/**
 * Bakes the three textures the technique needs. Call ONCE per Application.
 *
 * @param {import('pixi.js').Application} app
 * @returns {{normalTex: Texture, flatNormalTex: Texture, litDiffuseTex: Texture}}
 */
export function buildNormalLitTextures(app) {
  const nsize = 128;

  // SPHERE normal map: each pixel's RGB encodes a unit sphere normal, computed
  // analytically — the same maths a 3D engine uses for a round bumped surface.
  // Anything that should read as a lit round BODY samples this.
  const canvas = document.createElement('canvas');
  canvas.width = nsize; canvas.height = nsize;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(nsize, nsize);
  const rr = nsize / 2;
  for (let y = 0; y < nsize; y++) {
    for (let x = 0; x < nsize; x++) {
      const dx = (x - rr + 0.5) / rr, dy = (y - rr + 0.5) / rr;
      const d2 = dx * dx + dy * dy;
      const idx = (y * nsize + x) * 4;
      if (d2 <= 1) {
        const dz = Math.sqrt(1 - d2);
        img.data[idx] = Math.round((dx * 0.5 + 0.5) * 255);
        img.data[idx + 1] = Math.round((dy * 0.5 + 0.5) * 255);
        img.data[idx + 2] = Math.round((dz * 0.5 + 0.5) * 255);
        img.data[idx + 3] = 255;
      } else {
        img.data[idx] = 128; img.data[idx + 1] = 128; img.data[idx + 2] = 255; img.data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalTex = Texture.from(canvas);

  // FLAT normal map: a constant straight-up normal. Light patches cast onto
  // the ground go through the SAME shader as the round bodies instead of being
  // a plain additive glow sprite — which is exactly the substitution the
  // lighting rule forbids.
  const flatCanvas = document.createElement('canvas');
  flatCanvas.width = 4; flatCanvas.height = 4;
  const fctx = flatCanvas.getContext('2d');
  fctx.fillStyle = 'rgb(128,128,255)';
  fctx.fillRect(0, 0, 4, 4);
  const flatNormalTex = Texture.from(flatCanvas);

  // DIFFUSE: one white circle with the same silhouette as the normal map.
  // Colour comes from `.tint`, so no art is needed per colour or per entity.
  const dg = new Graphics();
  dg.circle(nsize / 2, nsize / 2, nsize / 2).fill('#ffffff');
  const litDiffuseTex = app.renderer.generateTexture({ target: dg, antialias: true });
  dg.destroy();

  return { normalTex, flatNormalTex, litDiffuseTex };
}

/**
 * One `Filter` per lit OBJECT — each carries its own uniforms because each is
 * lit from a different relative offset every frame — but all instances share
 * the one compiled fragment string above.
 *
 * TWO GlProgram traps already root-caused once, do not reintroduce them:
 *   1. `Filter.from({ gl: { fragment } })` WITHOUT an explicit `vertex`
 *      crashes — GlProgram's preprocessor runs on `undefined`. Always pass
 *      PixiJS's own `defaultFilterVert`.
 *   2. Nesting a texture under a wrapper key crashes `UniformGroup`. Textures
 *      must be TOP-LEVEL keys in `resources`.
 */
export function makeLitFilter(normalTex) {
  return Filter.from({
    gl: { vertex: defaultFilterVert, fragment: LIT_FRAGMENT },
    resources: {
      uNormalTexture: normalTex.source,
      uLight: {
        uLightPos: { value: [0, 0], type: 'vec2<f32>' },
        uLightColor: { value: [1, 1, 1], type: 'vec3<f32>' },
        uLightRadius: { value: 140, type: 'f32' },
        uAmbient: { value: 0.18, type: 'f32' },
        uObjSize: { value: [40, 40], type: 'vec2<f32>' },
      },
    },
    padding: 0,
  });
}

/**
 * Feeds one light plus this object's own size into its filter, in world-pixel
 * units — which cancels out camera zoom automatically, since `vTextureCoord`
 * is always 0..1 across the object's own rendered bounds whatever scale it was
 * rasterized at.
 *
 * `sizeOverride` exists because `sprite.width` reports the AXIS-ALIGNED bounds
 * of a ROTATED sprite, which grows and shrinks as it spins. Feeding that into
 * `uObjSize` makes the light on a turning body breathe. Callers that rotate
 * pass the intended unrotated size instead.
 */
export function updateLitUniforms(filter, sprite, light, sizeOverride) {
  const u = filter.resources.uLight.uniforms;
  u.uLightPos = [light.x - sprite.x, light.y - sprite.y];
  u.uLightColor = light.rgb;
  u.uLightRadius = light.radius;
  u.uAmbient = light.ambient;
  u.uObjSize = sizeOverride || [sprite.width, sprite.height];
}

/**
 * The baked soft-radial texture every POINT LIGHT is a sprite of. Baked once
 * via `generateTexture` rather than redrawing vector circles per frame — that
 * is the 60fps-vs-30fps difference with dozens of simultaneous lights.
 *
 * Two Pixi v8 gradient traps, both of which render silently wrong:
 *   · a colour stop is `{ offset, color }` and NOTHING else. A sibling `alpha`
 *     key is dropped and you get an OPAQUE stop — i.e. a hard white disc where
 *     a soft light should be. Alpha rides in the colour, via an rgba() string.
 *   · `textureSpace` defaults to 'local', which normalises stops into the
 *     shape's own 0..1 bounds. Absolute coordinates then fall outside the
 *     range and the whole fill collapses to ONE FLAT COLOUR.
 */
export function bakeLightTexture(app, R = 64) {
  const g = new Graphics();
  g.circle(R, R, R).fill(new FillGradient({
    type: 'radial',
    textureSpace: 'global',
    center: { x: R, y: R }, innerRadius: 0,
    outerCenter: { x: R, y: R }, outerRadius: R,
    colorStops: [
      { offset: 0, color: 'rgba(255,255,255,1)' },
      { offset: 0.38, color: 'rgba(255,255,255,0.40)' },
      { offset: 1, color: 'rgba(255,255,255,0)' },
    ],
  }));
  const tex = app.renderer.generateTexture({ target: g, antialias: true });
  g.destroy();
  return { tex, radius: R };
}

/**
 * A fixed-size pool of additive light sprites.
 *
 * The cap is a deliberate performance ceiling, not an oversight: past it the
 * emitter silently no-ops rather than growing the pool, exactly as
 * `pixiRenderer`'s `_emitLight` does. Respect it when adding new emitters.
 */
export function makeLightPool(container, tex, count) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.visible = false;
    container.addChild(s);
    pool.push(s);
  }
  return pool;
}

/** #rrggbb → [r,g,b] in 0..1, the form `uLightColor` wants. */
export function hexToRgb01(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
