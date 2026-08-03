// Waterdrop Survivor — PixiJS (WebGL) renderer.
// Faithful 1:1 visual conversion of the old Canvas2D render() pipeline.
// All GAME LOGIC/STATE lives in engine.js (untouched) — this file is PURE
// drawing: it reads the Game instance's pooled state every frame and paints
// it using PixiJS Graphics/Text, layered to match the original z-order.
import { Application, Container, Graphics, Text, TextStyle, FillGradient, Sprite, Filter, Texture, defaultFilterVert, ColorMatrixFilter } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { WEAPONS } from './data';

const TAU = Math.PI * 2;

// ---- small geometry helpers (rotate local points around an object's own
// heading, since a shared Graphics object has no per-shape transform) ----
function rot(x, y, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [x * c - y * s, y * c + x * s];
}
function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function mixHex(hexA, hexB, t) {
  const a = hexToRgb01(hexA), b = hexToRgb01(hexB);
  const r = Math.round((a[0] + (b[0] - a[0]) * t) * 255);
  const g = Math.round((a[1] + (b[1] - a[1]) * t) * 255);
  const bl = Math.round((a[2] + (b[2] - a[2]) * t) * 255);
  return `#${[r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
function rotPoly(cx, cy, ang, localPts) {
  const out = [];
  for (let i = 0; i < localPts.length; i += 2) {
    const [rx, ry] = rot(localPts[i], localPts[i + 1], ang);
    out.push(cx + rx, cy + ry);
  }
  return out;
}
function rotEllipsePoly(cx, cy, ang, rx, ry, segs = 14) {
  const out = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * TAU;
    const [x, y] = rot(Math.cos(a) * rx, Math.sin(a) * ry, ang);
    out.push(cx + x, cy + y);
  }
  return out;
}
// soft glow approximation (Canvas shadowBlur has no Pixi Graphics equivalent) —
// PERF: single layer only (halved from 2) since this is called per-entity,
// every frame, and entity count scales heavily during sustained combat.
function glow(g, x, y, r, color, strength = 1) {
  g.circle(x, y, r * 1.7).fill({ color, alpha: 0.16 * strength });
}

// ---- Boss guide-arrow pixel-dissolve shape (precomputed once) ----
function pointInTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}
function buildArrowPixelGrid() {
  const pts = [];
  const step = 2.2;
  for (let lx = -10; lx <= 20; lx += step) {
    for (let ly = -14; ly <= 14; ly += step) {
      const inA = pointInTri(lx, ly, 20, 0, -10, 14, -4, 0);
      const inB = pointInTri(lx, ly, 20, 0, -4, 0, -10, -14);
      if (inA || inB) {
        const delay = ((lx + 10) / 30) * 0.6; // 0 at tail -> 0.6 at tip
        pts.push({ lx, ly, delay });
      }
    }
  }
  return pts;
}
const BOSS_ARROW_PIXELS = buildArrowPixelGrid();

const PET_COLORS = {
  aquaSprite: '#5ba3ff', emberFairy: '#ff7a1a', shadowWisp: '#b362ff',
  stormHawk: '#ffe44d', lifeSprite: '#4dffd4',
};

export class PixiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.app = new Application();
    this.ready = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
    this._pendingSize = null;
    this.readyPromise = this.app.init({
      canvas, width: w, height: h, resolution: this.dpr, autoDensity: true,
      backgroundColor: 0x06040a, antialias: true, preference: 'webgl',
    }).then(() => {
      this._buildLayers();
      this.ready = true;
      if (this._pendingSize) { this.resize(this._pendingSize.w, this._pendingSize.h); this._pendingSize = null; }
    });
  }

  _textStyle(size, color, strokeColor, strokeWidth) {
    return new TextStyle({
      fontFamily: 'JetBrains Mono, monospace', fontSize: size, fontWeight: 'bold',
      fill: color, stroke: strokeColor ? { color: strokeColor, width: strokeWidth || 3 } : undefined,
    });
  }

  _buildLayers() {
    const stage = this.app.stage;
    this.zoomRoot = new Container(); stage.addChild(this.zoomRoot);

    // Deep-space parallax backdrop — sits BEHIND the world, scrolls at a
    // fraction of camera speed per layer so distant planets/nebulae/asteroids
    // feel genuinely far away instead of locked to the foreground.
    this.deepSpace = new Container(); this.zoomRoot.addChild(this.deepSpace);
    this.gDeepFar = new Graphics(); this.deepSpace.addChild(this.gDeepFar);
    // Guaranteed moon/planet/star — drawn once, never re-cached (see
    // _drawDeepSpace), so their parallax drift is never reset/snapped back.
    this.gDeepHero = new Graphics(); this.deepSpace.addChild(this.gDeepHero);
    this._heroBodiesDrawn = false;
    // Real shader-driven nebula cloud (fbm noise + uTime color drift) sitting
    // between the far planets and the mid galaxy layer — genuine per-pixel
    // procedural gas clouds, not flat painted circles.
    this._buildNebulaShader();
    this.deepSpace.addChild(this.nebulaSprite);
    this.gDeepMid = new Graphics(); this.deepSpace.addChild(this.gDeepMid);
    this.gDeepNear = new Graphics(); this.deepSpace.addChild(this.gDeepNear);
    this.gShootingStars = new Graphics(); this.deepSpace.addChild(this.gShootingStars);
    this._shootingStars = [];
    this._nextShootingStarAt = 3 + Math.random() * 4;

    this.world = new Container(); this.zoomRoot.addChild(this.world);
    // Soft bloom on the foreground world only — bright saturated colors
    // (projectiles/gems/particles/muzzle flashes) glow, dark ground/grid stays
    // clean since it's below the brightness threshold. A standard
    // ColorMatrixFilter contrast/saturation/brightness pass stacks on top —
    // this is whole-scene color grading (not a per-object dynamic light), so
    // it's fine to use a built-in filter here rather than the custom GLSL
    // lit-shader pipeline that's reserved for actual light sources.
    // NOTE: ColorMatrixFilter.contrast()'s range is 0..1 where 0.5 = neutral
    // (NOT 0 = neutral). Dialed the overall scene darker (brightness < 1)
    // with more contrast than before, per feedback that the world read too
    // bright/flat for muzzle-flash and projectile light to visibly "pop"
    // when it lands on something — a darker, higher-contrast base gives
    // the dynamic point lights (see WORLD_LIGHT below) more room to read.
    this._gradeFilter = new ColorMatrixFilter();
    this._gradeFilter.brightness(0.90, true);
    this._gradeFilter.contrast(0.60, true);
    this._gradeFilter.saturate(0.06, true);
    this.world.filters = [
      new AdvancedBloomFilter({ threshold: 0.6, bloomScale: 0.75, brightness: 1.0, blur: 3, quality: 2 }),
      this._gradeFilter,
    ];

    this.gGround = new Graphics(); this.world.addChild(this.gGround);
    // Sky events (passing meteors/UFOs) — sit just above the ground, behind
    // gameplay entities, so they read as things flying over the play area.
    this.gSkyEvents = new Graphics(); this.world.addChild(this.gSkyEvents);
    this._buildLightSystem();
    this._buildNormalLitSystem();
    // Ground-illumination patches (flat-normal lit sprites) sit in the same
    // gLight container/z-band as the old point-light pool — after ground,
    // before decals/gems/enemies — so muzzle-flash/projectile light washes
    // over the ground and bleeds around enemy silhouettes.
    for (const { sprite } of this._groundLitPool) this.gLight.addChild(sprite);
    for (const { sprite } of this._xpOrbLitPool) this.gLight.addChild(sprite);
    this.gDecals = new Graphics(); this.world.addChild(this.gDecals);
    // Dock Station — sits with decals (ground-level, under enemies/player)
    // so its progress ring reads clearly even while the player stands on it.
    this.gDockStation = new Graphics(); this.world.addChild(this.gDockStation);
    this.dockStationLight = new Sprite(this.lightTex);
    this.dockStationLight.anchor.set(0.5); this.dockStationLight.blendMode = 'add'; this.dockStationLight.visible = false;
    this.gLight.addChild(this.dockStationLight);
    this.dockStationText = new Text({ text: 'DOCK', style: this._textStyle(9, '#4dffe0', '#06121e', 3) });
    this.dockStationText.anchor.set(0.5); this.dockStationText.visible = false;
    this.world.addChild(this.dockStationText);
    this.gGems = new Graphics(); this.world.addChild(this.gGems);
    this.gEnemies = new Graphics(); this.world.addChild(this.gEnemies);
    this.gPlayer = new Graphics(); this.world.addChild(this.gPlayer);
    // Lit player-body sprite renders between the shadow (gPlayer) and the
    // gun/highlights/UI (gPlayerFront) so the normal-mapped shading sits
    // exactly where the old flat body fill used to be.
    this.world.addChild(this.playerBodySprite);
    this.gPlayerFront = new Graphics(); this.world.addChild(this.gPlayerFront);
    this.gPet = new Graphics(); this.world.addChild(this.gPet);
    this.petLevelText = new Text({ text: '', style: this._textStyle(6, '#fff') });
    this.petLevelText.anchor.set(0.5); this.world.addChild(this.petLevelText);
    this.reloadText = new Text({ text: 'RELOADING', style: this._textStyle(9, '#ffd166', '#000000', 2.5) });
    this.reloadText.anchor.set(0.5, 0.5); this.world.addChild(this.reloadText);
    this.gProjectiles = new Graphics(); this.world.addChild(this.gProjectiles);
    // Lit starter-weapon (hydropistol) projectile sprites, same z-band as
    // the regular projectile Graphics layer.
    this.gLitProjectiles = new Container();
    for (const { sprite } of this._litProjPool) this.gLitProjectiles.addChild(sprite);
    this.world.addChild(this.gLitProjectiles);
    this.gBeam = new Graphics(); this.world.addChild(this.gBeam);
    this.gParticles = new Graphics(); this.world.addChild(this.gParticles);

    this.dmgTextContainer = new Container(); this.world.addChild(this.dmgTextContainer);
    this._dmgTextPool = [];
    // Enemy tier tags ("T2", "T3"...) — tiny label under each tier>=2 enemy.
    this.tierTagContainer = new Container(); this.world.addChild(this.tierTagContainer);
    this._tierTagPool = [];
    this.levelUpText = new Text({ text: 'LEVEL UP!', style: this._textStyle(24, '#9fd8ff', '#06121e', 5) });
    this.levelUpText.anchor.set(0.5); this.levelUpText.visible = false; this.world.addChild(this.levelUpText);

    // Screen-space overlays (outside the camera-translated world)
    this.gBossArrow = new Graphics(); stage.addChild(this.gBossArrow);
    this.bossArrowText = new Text({ text: 'BOSS', style: this._textStyle(11, '#000') });
    this.bossArrowText.anchor.set(0.5); stage.addChild(this.bossArrowText);
    this.metersText = new Text({ text: '', style: this._textStyle(12, '#ffd166', '#000', 3) });
    this.metersText.anchor.set(0.5); stage.addChild(this.metersText);
    this.gUI = new Graphics(); stage.addChild(this.gUI);

    // Cached highlight glow color used for player hit-flash
    this.playerBodyColor = '#5fd6ff';
    this.playerBodyFlash = '#ffffff';
  }

  // Builds the entire lighting system ONCE: a shared soft-radial texture used
  // by every point light (baked via generateTexture instead of redrawing
  // vector circles every frame — sprites batch and transform for almost free,
  // which is the difference between this running at 30fps vs 120fps with
  // dozens of simultaneous lights), a pooled set of additive light sprites,
  // a baked starburst muzzle-flash texture, and the flashlight cone.
  _buildLightSystem() {
    const size = 256;
    const tg = new Graphics();
    tg.rect(0, 0, size, size).fill(new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,1)' },
        { offset: 0.4, color: 'rgba(255,255,255,0.45)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ],
      textureSpace: 'local',
    }));
    this.lightTex = this.app.renderer.generateTexture({ target: tg, antialias: true });
    this._lightTexSize = size;
    tg.destroy();

    // Muzzle-flash: baked once, forward-facing (angle 0 = "out the barrel")
    // since this sprite gets rotated to the current aim angle every shot —
    // a full 8-point symmetric starburst read as too wide/round (rays
    // sticking out sideways and even backward off the gun). Real muzzle
    // flashes are a narrow forward cone, so this is one long central spike
    // plus 2 shorter spikes close on either side (±16°/±34°) and nothing
    // past ~40° off-axis.
    const fg = new Graphics();
    const flashRays = [
      { a: 0,     len: 60, w: 6.5 },
      { a: 0.28,  len: 34, w: 3.5 },
      { a: -0.28, len: 34, w: 3.5 },
      { a: 0.60,  len: 18, w: 2.5 },
      { a: -0.60, len: 18, w: 2.5 },
    ];
    for (const r of flashRays) {
      fg.moveTo(0, 0).lineTo(Math.cos(r.a) * r.len, Math.sin(r.a) * r.len).stroke({ width: r.w, color: '#ffffff', alpha: 1 });
    }
    fg.circle(0, 0, 11).fill('#ffffff');
    this.flashTex = this.app.renderer.generateTexture({ target: fg, antialias: true });
    fg.destroy();

    this.gLight = new Container(); this.world.addChild(this.gLight);
    this._lightPool = [];
    for (let i = 0; i < 56; i++) {
      const spr = new Sprite(this.lightTex);
      spr.anchor.set(0.5); spr.blendMode = 'add'; spr.visible = false;
      this.gLight.addChild(spr); this._lightPool.push(spr);
    }
    this._lightIdx = 0;

    // Flashlight cone (single Graphics shape, one draw/frame regardless of
    // how many point lights exist — negligible cost) + the muzzle starburst
    // + a small bright core, both additive sprites reused every shot.
    this.gCone = new Graphics(); this.gCone.blendMode = 'add'; this.world.addChild(this.gCone);
    this.muzzleFlashSprite = new Sprite(this.flashTex);
    this.muzzleFlashSprite.anchor.set(0.5); this.muzzleFlashSprite.blendMode = 'add'; this.muzzleFlashSprite.visible = false;
    this.world.addChild(this.muzzleFlashSprite);
    this.muzzleCoreSprite = new Sprite(this.lightTex);
    this.muzzleCoreSprite.anchor.set(0.5); this.muzzleCoreSprite.blendMode = 'add'; this.muzzleCoreSprite.visible = false;
    this.world.addChild(this.muzzleCoreSprite);
  }

  // Grabs the next pooled additive light sprite and positions/tints it —
  // O(1), no geometry rebuild. Silently no-ops past the pool cap (56
  // simultaneous lights is already far more than a frame realistically needs).
  _emitLight(x, y, r, color, alpha) {
    if (this._lightIdx >= this._lightPool.length) return;
    const spr = this._lightPool[this._lightIdx++];
    spr.visible = true;
    spr.position.set(x, y);
    spr.scale.set((r * 2) / this._lightTexSize);
    spr.tint = color;
    spr.alpha = alpha;
  }

  // ===========================================================================
  // NORMAL-MAPPED LIGHTING — STEP 1 SMOKE TEST
  // Real per-pixel diffuse+specular shading instead of glow stickers. Since
  // this game has no hand-authored sprite art (every entity is a vector
  // Graphics shape), a normal map is baked ANALYTICALLY as a sphere/dome —
  // exact same math a 3D engine uses for a round bumped surface, computed
  // once into a small canvas texture, no art pipeline needed. One shared
  // filter class (GLSL, WebGL2 — the guaranteed baseline) drives it; each lit
  // object gets its own Filter instance (own uniforms) since each is lit
  // from a different relative light-offset every frame.
  // ===========================================================================
  _buildNormalLitSystem() {
    const nsize = 128;
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
    this.normalTex = Texture.from(canvas);

    // Flat "ground" normal map (constant straight-up normal, RGB 128,128,255)
    // — reusing the exact same per-pixel Lambertian/specular shader as the
    // sphere normal map above but on a flat surface, so light patches cast
    // by projectiles/muzzle-flash onto the ground/enemies use the SAME
    // GlProgram lighting pipeline instead of a plain additive glow sprite.
    const flatCanvas = document.createElement('canvas');
    flatCanvas.width = 4; flatCanvas.height = 4;
    const fctx = flatCanvas.getContext('2d');
    fctx.fillStyle = 'rgb(128,128,255)';
    fctx.fillRect(0, 0, 4, 4);
    this.flatNormalTex = Texture.from(flatCanvas);

    // Flat white circle diffuse — same silhouette as the normal map exactly
    // (both are circles of the same size), tinted per-object via .tint so no
    // separate art is needed per color/entity.
    const dg = new Graphics();
    dg.circle(nsize / 2, nsize / 2, nsize / 2).fill('#ffffff');
    this.litDiffuseTex = this.app.renderer.generateTexture({ target: dg, antialias: true });
    dg.destroy();

    this._litFragment = `
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

    // Player body — the one sprite for this step-1 test.
    this.playerBodySprite = new Sprite(this.litDiffuseTex);
    this.playerBodySprite.anchor.set(0.5);
    this.playerBodyFilter = this._makeLitFilter();
    this.playerBodySprite.filters = [this.playerBodyFilter];

    // Pooled lit sprites for the starter weapon's (hydropistol) projectiles —
    // "för de på projektilerna på start vapnet" per spec.
    this._litProjPool = [];
    for (let i = 0; i < 16; i++) {
      const sprite = new Sprite(this.litDiffuseTex);
      sprite.anchor.set(0.5); sprite.visible = false;
      const filter = this._makeLitFilter();
      sprite.filters = [filter];
      this._litProjPool.push({ sprite, filter });
    }

    // Pooled flat-normal lit sprites — used to cast each blue projectile's
    // own small light onto the ground/enemies it passes over. Uses the same
    // SOFT RADIAL GRADIENT base texture as the old point-light pool
    // (this.lightTex, alpha fades to 0 at the edge) instead of the hard-edged
    // diffuse disc, so it reads as a small soft glow — not a giant flat
    // circle — while still being lit through the real GlProgram shader.
    this._groundLitPool = [];
    for (let i = 0; i < 22; i++) {
      const sprite = new Sprite(this.lightTex);
      sprite.anchor.set(0.5); sprite.visible = false; sprite.blendMode = 'add';
      const filter = this._makeLitFilter(this.flatNormalTex);
      sprite.filters = [filter];
      this._groundLitPool.push({ sprite, filter });
    }

    // XP orbs get the SAME custom lit-shader glow (flat-normal + GlProgram),
    // replacing the old plain vector glow() approximation — per spec, no
    // non-custom light anywhere.
    this._xpOrbLitPool = [];
    for (let i = 0; i < 10; i++) {
      const sprite = new Sprite(this.lightTex);
      sprite.anchor.set(0.5); sprite.visible = false; sprite.blendMode = 'add';
      const filter = this._makeLitFilter(this.flatNormalTex);
      sprite.filters = [filter];
      this._xpOrbLitPool.push({ sprite, filter });
    }
  }

  _makeLitFilter(normalTex) {
    return Filter.from({
      gl: { vertex: defaultFilterVert, fragment: this._litFragment },
      resources: {
        uNormalTexture: (normalTex || this.normalTex).source,
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

  // Feeds one moving light + this object's own size/position into its filter
  // — all in world-pixel units, which cancels out camera zoom automatically
  // since vTextureCoord is always 0..1 across the object's own rendered
  // bounds regardless of what scale it was rasterized at.
  _updateLitUniforms(filter, sprite, light) {
    const u = filter.resources.uLight.uniforms;
    u.uLightPos = [light.x - sprite.x, light.y - sprite.y];
    u.uLightColor = light.rgb;
    u.uLightRadius = light.radius;
    u.uAmbient = light.ambient;
    u.uObjSize = [sprite.width, sprite.height];
  }

  resize(W, H) {
    if (!this.ready) { this._pendingSize = { w: W, h: H }; return; }
    this.app.renderer.resize(W, H);
  }

  destroy() {
    this.readyPromise.then(() => { try { this.app.destroy(true, { children: true } ); } catch (e) { /* noop */ } });
  }

  // ============================== MAIN FRAME ==============================
  render(game) {
    if (!this.ready) return;
    const W = game.W, H = game.H;

    const shakeX = (Math.random() - 0.5) * game.cam.shake;
    const shakeY = (Math.random() - 0.5) * game.cam.shake;
    this.world.position.set(-game.cam.x + shakeX, -game.cam.y + shakeY);
    const zoom = game._visionZoom || 1;
    this.zoomRoot.scale.set(1 / zoom);

    this._drawDeepSpace(game);
    this._drawGround(game);
    this._drawSkyEvents(game);
    this._drawLights(game);
    this._drawGroundIllum(game);
    this._drawDecals(game);
    this._drawDockStation(game);
    this._drawGems(game);
    this._drawEnemies(game);
    this._drawEnemyTierTags(game);
    this._drawPlayer(game);
    if (game.pet) this._drawPet(game);
    this._drawProjectiles(game);
    this._drawLitHydroProjectiles(game);
    this._drawEnemyProjectiles(game);
    this._drawBeam(game);
    this._drawParticles(game);
    this._drawDamageNumbers(game);
    this._drawLevelUpText(game);
    this._drawBossArrow(game, W, H);
    this._drawScreenOverlays(game, W, H);
  }

  // ------------------------------ SKY EVENTS --------------------------------
  // Fiery meteors with tails, and slow UFOs trailing a colored light beam —
  // both cross the sky above the play area and feed into _drawLights below
  // so they cast genuine moving colored light onto the world as they pass.
  _drawSkyEvents(game) {
    const g = this.gSkyEvents; g.clear();
    for (const ev of game.skyEvents) {
      if (ev.type === 'meteor') {
        const spd = Math.hypot(ev.vx, ev.vy) || 1;
        const tx = -ev.vx / spd, ty = -ev.vy / spd;
        // Heat/glow intensifies the deeper it burns into the atmosphere.
        const burnFrac = ev.maxLife ? Math.min(1, 1 - ev.life / ev.maxLife) : 0;
        const heat = 0.6 + burnFrac * 0.9;
        for (let i = 0; i < 9; i++) {
          const f = i / 9;
          g.circle(ev.x + tx * f * (46 + burnFrac * 26), ev.y + ty * f * (46 + burnFrac * 26), (5 + burnFrac * 2.5) * (1 - f))
            .fill({ color: ev.color, alpha: (1 - f) * 0.78 * heat });
        }
        glow(g, ev.x, ev.y, 15 + burnFrac * 10, ev.color, 1.5 * heat);
        // White-hot leading edge — brighter/whiter the harder it's burning.
        g.circle(ev.x, ev.y, 5.5 + burnFrac * 2).fill(burnFrac > 0.4 ? '#ffffff' : '#fff8e0');
        // Fragmentation — pieces drift apart and burn out independently.
        if (ev.frags) {
          for (const f of ev.frags) {
            glow(g, ev.x + f.ox, ev.y + f.oy, 8, ev.color, 1.1);
            g.circle(ev.x + f.ox, ev.y + f.oy, 3).fill('#fff2c8');
          }
        }
      } else {
        // UFO — proper hull silhouette + 3 real blinking lamp lights
        // (not a single flat colored dot) plus a soft scan-beam underneath.
        g.ellipse(ev.x, ev.y, 24, 8).fill('#33394a').stroke({ width: 1.5, color: '#5a6478' });
        g.ellipse(ev.x, ev.y, 24, 8).fill({ color: '#6a7488', alpha: 0.25 });
        g.ellipse(ev.x, ev.y - 5, 11, 7).fill('#4a5568');
        g.ellipse(ev.x, ev.y - 6, 8, 4.5).fill({ color: '#bfe8ff', alpha: 0.55 });
        for (let li = 0; li < 3; li++) {
          const lx = ev.x + (li - 1) * 13;
          const blink = 0.5 + 0.5 * Math.sin(ev.t * 5 + li * 2.1);
          g.circle(lx, ev.y + 3, 2.2).fill({ color: ev.color, alpha: 0.5 + blink * 0.5 });
          if (blink > 0.7) glow(g, lx, ev.y + 3, 6, ev.color, blink);
        }
        glow(g, ev.x, ev.y + 5, 20, ev.color, 1.4);
        g.poly([ev.x - 7, ev.y + 5, ev.x + 7, ev.y + 5, ev.x + 17, ev.y + 52, ev.x - 17, ev.y + 52]).fill({ color: ev.color, alpha: 0.13 });
      }
    }
  }

  // ------------------------------ DYNAMIC LIGHTING --------------------------
  // Every light below is an additive SPRITE (pooled, baked texture) instead
  // of a redrawn vector circle — this is the ~120fps-friendly technique real
  // 2D engines use for many simultaneous lights (see PixiJS perf guides: a
  // shared radial-gradient texture + blendMode:'add', reused every frame,
  // rather than rebuilding Graphics geometry per light per frame).
  // The character itself stays dim/ambient on purpose — the muzzle-flash is
  // what should light it (and whatever it's aiming at) up the most.
  // STEP 2 (targeted extension): the merged flashlight/muzzle-flash light
  // now also (a) casts a real per-pixel-lit ground patch via the flat-normal
  // shader pool below (_drawGroundIllum), and (b) drives directional shadows
  // on the player/enemies (see _drawPlayer/_drawEnemies) so the muzzle flash
  // visibly "casts" a shadow the instant it fires, exactly like a real point
  // light would — no plugin, same GlProgram pipeline, just fed a 2nd purpose.
  _drawLights(game) {
    this.gCone.clear();
    this.muzzleFlashSprite.visible = false;
    this.muzzleCoreSprite.visible = false;
    for (const spr of this._lightPool) spr.visible = false;
    this._testLight = this._computeTestLight(game);

    // Combine the ORIGINAL starburst muzzle-flash sprite with the new
    // point-light glow instead of dropping it (per spec: never remove the
    // old effect, layer the new one on top of it). Positioned/colored
    // exactly where the new light sits so both read as one unified flash.
    const L = this._testLight;
    if (L.mt > 0.02) {
      const p = game.player;
      const ang = Math.atan2(L.y - p.y, L.x - p.x);
      this.muzzleFlashSprite.visible = true;
      this.muzzleFlashSprite.position.set(L.x, L.y);
      this.muzzleFlashSprite.rotation = ang;
      this.muzzleFlashSprite.tint = L.hex;
      this.muzzleFlashSprite.alpha = L.mt;
      this.muzzleFlashSprite.scale.set(0.5 + L.mt * 0.22);

      this.muzzleCoreSprite.visible = true;
      this.muzzleCoreSprite.position.set(L.x, L.y);
      this.muzzleCoreSprite.tint = L.hex;
      this.muzzleCoreSprite.alpha = L.mt * 0.8;
      const coreSize = 34 + L.mt * 26;
      this.muzzleCoreSprite.width = coreSize;
      this.muzzleCoreSprite.height = coreSize;
    }
  }

  _computeTestLight(game) {
    const p = game.player;
    const aimAng = Math.atan2(p.aimY, p.aimX);
    // World light dimmed a further 15% per spec (0.85 -> 0.7225).
    const WORLD_LIGHT = 0.7225;
    if (p._muzzleFlashT > 0) {
      const mt = Math.min(1, p._muzzleFlashT / 0.10);
      const mAng = p._muzzleFlashAng != null ? p._muzzleFlashAng : aimAng;
      // Blend the warm gunpowder-flash base color WITH the weapon's own
      // color (don't let the muzzle flash become 100% the weapon's hue —
      // combine the two, per spec) — weighted toward the weapon color but
      // never losing the warm flash identity.
      const hex = mixHex('#fff3d0', p._muzzleFlashColor || '#fff3d0', 0.55);
      return {
        // Exits the barrel further forward (was *20) so it's clearly
        // outside the gun/character silhouette instead of overlapping it.
        x: p.x + Math.cos(mAng) * 32, y: p.y + Math.sin(mAng) * 32,
        rgb: hexToRgb01(hex), hex,
        radius: 210, ambient: (0.22 + 0.55 * mt) * WORLD_LIGHT, mt,
      };
    }
    return {
      x: p.x + Math.cos(aimAng) * 32, y: p.y + Math.sin(aimAng) * 32,
      rgb: hexToRgb01('#fff3d0'), hex: '#fff3d0',
      radius: 150, ambient: 0.16 * WORLD_LIGHT, mt: 0,
    };
  }

  // ------------------------ GROUND ILLUMINATION -----------------------------
  // Extends the SAME normal-mapped filter (_makeLitFilter) to a flat-normal
  // "ground patch" sprite pool — EVERY friendly projectile in flight (not
  // just hydropistol) is now its own small soft light in ITS OWN color,
  // subtly brightening the ground/nearby enemies it flies over. The
  // projectile's own sprite/size is untouched — this is a pure additive
  // glow layered underneath it, nothing about the bolt itself changes.
  // Slot 0 is reserved for a brief muzzle-flash glow (only while actively
  // firing) so nearby enemies visibly catch light from the flash too.
  _drawGroundIllum(game) {
    const pool = this._groundLitPool;
    let idx = 0;
    const L = this._testLight;
    if (L && L.mt > 0.02 && idx < pool.length) {
      const { sprite, filter } = pool[idx++];
      const light = { x: L.x, y: L.y, rgb: L.rgb, radius: 46, ambient: 0.35 + L.mt * 0.3 };
      sprite.visible = true;
      sprite.position.set(L.x, L.y);
      const size = 70 + L.mt * 30;
      sprite.width = size; sprite.height = size;
      sprite.tint = L.hex;
      sprite.alpha = 0.3 * L.mt;
      this._updateLitUniforms(filter, sprite, light);
    }
    game.projs.forEach(pr => {
      if (pr.friendly === false) return;
      if (idx >= pool.length) return;
      const { sprite, filter } = pool[idx++];
      const boltColor = pr.color || '#5fd6ff';
      const isHydro = pr._wid === 'hydropistol' || pr._wid === 'hydropistol_evo';
      // Hydropistol's blue glow was bleeding too far onto enemies — cut its
      // reach/strength specifically, per spec, while other weapons keep
      // their full glow.
      const light = { x: pr.x, y: pr.y, rgb: hexToRgb01(boltColor), radius: isHydro ? 22 : 34, ambient: 0.4 };
      sprite.visible = true;
      sprite.position.set(pr.x, pr.y);
      const size = (pr.size || 6) * (isHydro ? 2.0 : 3.4);
      sprite.width = size; sprite.height = size;
      sprite.tint = boltColor;
      sprite.alpha = isHydro ? 0.2 : 0.32;
      this._updateLitUniforms(filter, sprite, light);
    });
    for (let i = idx; i < pool.length; i++) pool[i].sprite.visible = false;
  }

  // ------------------------- NEBULA SHADER (procedural) --------------------
  _buildNebulaShader() {
    const wg = new Graphics();
    wg.rect(0, 0, 4, 4).fill('#ffffff');
    const whiteTex = this.app.renderer.generateTexture({ target: wg, antialias: false });
    wg.destroy();
    this._nebulaFragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform vec2 uOffset;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p) {
  float v = 0.0, amp = 0.55;
  for (int i = 0; i < 4; i++) { v += amp * vnoise(p); p *= 2.05; amp *= 0.55; }
  return v;
}
void main() {
  vec2 p = vTextureCoord * 3.2 + uOffset;
  float warp = fbm(p * 0.6 + uTime * 0.015);
  float n = fbm(p + warp * 1.6);
  float a = smoothstep(0.38, 0.82, n) * 0.30;
  vec3 col = mix(uColorA, uColorB, clamp(n * 1.3, 0.0, 1.0));
  finalColor = vec4(col * a, a);
}`;
    this._nebulaFilter = Filter.from({
      gl: { vertex: defaultFilterVert, fragment: this._nebulaFragment },
      resources: {
        uNebula: {
          uOffset: { value: [0, 0], type: 'vec2<f32>' },
          uTime: { value: 0, type: 'f32' },
          uColorA: { value: [0.35, 0.15, 0.55], type: 'vec3<f32>' },
          uColorB: { value: [0.1, 0.35, 0.55], type: 'vec3<f32>' },
        },
      },
      padding: 0,
    });
    this.nebulaSprite = new Sprite(whiteTex);
    this.nebulaSprite.anchor.set(0.5);
    this.nebulaSprite.width = 2600; this.nebulaSprite.height = 1700;
    this.nebulaSprite.blendMode = 'add';
    this.nebulaSprite.filters = [this._nebulaFilter];
    this._nebulaHues = [
      [[0.35, 0.15, 0.55], [0.1, 0.35, 0.55]],
      [[0.5, 0.12, 0.3], [0.15, 0.3, 0.15]],
      [[0.12, 0.3, 0.5], [0.45, 0.15, 0.4]],
    ];
  }

  // ------------------------- DEEP SPACE PARALLAX --------------------------
  // 3 layers scrolling at fractions of camera speed (true parallax depth) +
  // occasional shooting stars. Cached like the ground layer — rebuilt only
  // when the (slow) parallax-camera has drifted past a padded buffer.
  _drawDeepSpace(game) {
    const W = game.W, H = game.H;
    // Guard against a stray NaN/Infinity camera position (e.g. from some
    // other bug) ever reaching the parallax math below — worst case this
    // layer just freezes at its last good spot instead of feeding NaN into
    // Graphics positions/hashing.
    const cx = Number.isFinite(game.cam.x) ? game.cam.x : (this._lastCamX || 0);
    const cy = Number.isFinite(game.cam.y) ? game.cam.y : (this._lastCamY || 0);
    this._lastCamX = cx; this._lastCamY = cy;

    // FAR: planets & moons (parallax 0.006 — reads as a fixed backdrop, only
    // drifting a little even over a long pan, instead of visibly "following").
    // 0.035 originally tracked the camera too closely ("follows the
    // image"); 0.006 over-corrected the other way — with such a tiny
    // factor the hero moon/planet/star barely move at all during a normal
    // play session and read as glued to one spot on screen instead of a
    // background that can drift and eventually leave frame. 0.018 is the
    // middle ground: visibly drifts as the camera travels, but still much
    // slower than the foreground world.
    const farF = 0.018, fx = cx * farF, fy = cy * farF;
    if (!this._farCache || Math.abs(fx - this._farCache.x) > 140 || Math.abs(fy - this._farCache.y) > 140) {
      this._farCache = { x: fx, y: fy };
      const g = this.gDeepFar; g.clear();
      const cell = 1400, pad = 500;
      const sX = Math.floor((fx - pad) / cell) * cell, sY = Math.floor((fy - pad) / cell) * cell;
      const palette = [['#8a5a3a', '#c98a5a'], ['#3a5a8a', '#5a8ac9'], ['#7a3a5a', '#c95a8a'], ['#5a7a3a', '#8ac95a']];
      for (let gx = sX; gx < fx + W + pad; gx += cell) {
        for (let gy = sY; gy < fy + H + pad; gy += cell) {
          const h = ((gx * 92821) ^ (gy * 68917)) >>> 0;
          if (h % 4 !== 0) continue;
          const px = gx + (h % cell), py = gy + ((h >> 6) % cell);
          const size = 26 + (h % 46);
          const [base, hi] = palette[h % palette.length];
          // Soft atmospheric glow halo behind the planet body
          g.circle(px, py, size * 1.55).fill({ color: hi, alpha: 0.06 });
          g.circle(px, py, size).fill(base);
          g.circle(px - size * 0.32, py - size * 0.32, size * 0.55).fill({ color: hi, alpha: 0.5 });
          g.circle(px + size * 0.35, py + size * 0.3, size * 0.7).fill({ color: '#000000', alpha: 0.35 });
          if (h % 12 === 0) g.ellipse(px, py, size * 1.8, size * 0.4).stroke({ width: 3, color: hi, alpha: 0.45 });
          if (h % 7 === 0) g.circle(px + size * 1.6, py + size * 0.9, size * 0.22).fill('#cfd6de');
        }
      }
    }
    this.gDeepFar.position.set(-fx, -fy);

    // ---- Hardcoded "hero" celestial bodies (a moon + a planet + a glowing
    // dwarf star must always be visibly present, not left to hashed-grid RNG
    // which can spawn zero bodies near the player for a long time). Drawn
    // ONCE ever into their own layer at a fixed local origin, then given the
    // exact same continuous parallax offset as the far grid above — unlike
    // the grid, this layer is NEVER cleared/re-cached, so there's no
    // periodic "snap back" recentering it near the player. That snapping was
    // the actual bug behind "stuck to the edge": every ~140/farF world-units
    // of camera movement it got recentered back to the same on-screen spot,
    // capping its visible drift to a small radius forever. Now it drifts
    // continuously and will genuinely leave frame on a long pan.
    if (!this._heroBodiesDrawn) {
      this._heroBodiesDrawn = true;
      const g = this.gDeepHero;
      const heroMoonX = W * 0.30, heroMoonY = -H * 0.24;
      g.circle(heroMoonX, heroMoonY, 150).fill({ color: '#cfd9e6', alpha: 0.05 });
      g.circle(heroMoonX, heroMoonY, 92).fill('#8a9199');
      // Sunlit-side highlight toned way down — this used to read as a bright
      // internally-lit patch ("like a lamp") rather than reflected sunlight.
      g.circle(heroMoonX - 30, heroMoonY - 26, 50).fill({ color: '#c7d0dc', alpha: 0.22 });
      g.circle(heroMoonX + 26, heroMoonY + 20, 60).fill({ color: '#4a5058', alpha: 0.35 });
      g.circle(heroMoonX - 18, heroMoonY + 30, 14).fill({ color: '#9aa4b2', alpha: 0.7 });
      g.circle(heroMoonX + 34, heroMoonY - 12, 10).fill({ color: '#9aa4b2', alpha: 0.6 });
      g.circle(heroMoonX + 4, heroMoonY + 48, 8).fill({ color: '#9aa4b2', alpha: 0.55 });
      g.circle(heroMoonX - 40, heroMoonY - 4, 7).fill({ color: '#a6b0be', alpha: 0.5 });

      const heroPlanetX = -W * 0.26, heroPlanetY = H * 0.30;
      const pR = 128;
      g.circle(heroPlanetX, heroPlanetY, pR * 1.5).fill({ color: '#ffb066', alpha: 0.05 });
      g.ellipse(heroPlanetX, heroPlanetY, pR * 1.9, pR * 0.5).stroke({ width: 6, color: '#d9a35a', alpha: 0.5 });
      g.ellipse(heroPlanetX, heroPlanetY, pR * 1.9, pR * 0.5).stroke({ width: 2, color: '#fff3d6', alpha: 0.35 });
      g.circle(heroPlanetX, heroPlanetY, pR).fill('#8a5228');
      for (let bi = -3; bi <= 3; bi++) {
        const by = heroPlanetY + bi * pR * 0.13;
        const bw = Math.sqrt(Math.max(0, pR * pR - (bi * pR * 0.13) * (bi * pR * 0.13)));
        g.ellipse(heroPlanetX, by, bw, pR * 0.075).fill({ color: bi % 2 === 0 ? '#e8a05a' : '#a85f2c', alpha: 0.45 });
      }
      // Sunlit-side highlight (was reading as an internal light source —
      // toned down to a subtle sheen instead of a bright "lamp" patch).
      g.circle(heroPlanetX - pR * 0.3, heroPlanetY - pR * 0.3, pR * 0.5).fill({ color: '#ffd9a0', alpha: 0.14 });
      g.circle(heroPlanetX + pR * 0.35, heroPlanetY + pR * 0.28, pR * 0.65).fill({ color: '#3a1c08', alpha: 0.4 });

      const heroStarX = W * 0.68, heroStarY = H * 0.14;
      for (let ri = 5; ri >= 1; ri--) g.circle(heroStarX, heroStarY, ri * 26).fill({ color: '#fff0c0', alpha: 0.05 });
      g.circle(heroStarX, heroStarY, 22).fill('#fff8e0');
      g.circle(heroStarX, heroStarY, 12).fill('#ffffff');
      for (let ri = 0; ri < 4; ri++) {
        const a = (ri / 4) * TAU + 0.4;
        g.moveTo(heroStarX, heroStarY).lineTo(heroStarX + Math.cos(a) * 46, heroStarY + Math.sin(a) * 46)
          .stroke({ width: 2, color: '#fff8e0', alpha: 0.4 });
      }
    }
    // Slightly slower than the grid layer (0.014 vs 0.018) so the guaranteed
    // hero bodies read as even further away than the procedural planets.
    this.gDeepHero.position.set(-cx * 0.014, -cy * 0.014);

    // MID: galaxy spiral arms + soft nebula clouds (parallax 0.07)
    const midF = 0.07, mx = cx * midF, my = cy * midF;
    if (!this._midCache || Math.abs(mx - this._midCache.x) > 140 || Math.abs(my - this._midCache.y) > 140) {
      this._midCache = { x: mx, y: my };
      const g = this.gDeepMid; g.clear();
      const cell = 900, pad = 400;
      const sX = Math.floor((mx - pad) / cell) * cell, sY = Math.floor((my - pad) / cell) * cell;
      for (let gx = sX; gx < mx + W + pad; gx += cell) {
        for (let gy = sY; gy < my + H + pad; gy += cell) {
          const h = ((gx * 41143) ^ (gy * 30983)) >>> 0;
          if (h % 3 !== 0) continue;
          const px = gx + (h % cell), py = gy + ((h >> 5) % cell);
          const hue = h % 4;
          const color = hue === 0 ? '#7a3ab3' : hue === 1 ? '#2a6a8a' : hue === 2 ? '#8a2a5a' : '#2a8a5a';
          const coreColor = hue === 0 ? '#e0c8ff' : hue === 1 ? '#c8f0ff' : hue === 2 ? '#ffc8e8' : '#c8ffe0';
          // Soft wispy nebula cloud (layered falloff, not a flat disc) behind
          // every galaxy core so the mid layer reads as gas clouds, not dots.
          g.circle(px, py, 220).fill({ color, alpha: 0.035 });
          g.circle(px, py, 140).fill({ color, alpha: 0.05 });
          g.circle(px, py, 70).fill({ color, alpha: 0.08 });
          for (let arm = 0; arm < 2; arm++) {
            const armAng = arm * Math.PI + (h % 100) * 0.01;
            g.moveTo(px, py);
            for (let s = 1; s <= 10; s++) {
              const rr = s * 15, aa = armAng + s * 0.35;
              g.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr);
            }
            g.stroke({ width: 11, color, alpha: 0.1 });
          }
          g.circle(px, py, 30).fill({ color, alpha: 0.14 });
          g.circle(px, py, 9).fill({ color: coreColor, alpha: 0.75 });
        }
      }
    }
    this.gDeepMid.position.set(-mx, -my);

    // Nebula shader quad stays screen-centered (fixed-size fullscreen-ish
    // quad); the parallax-scroll illusion comes purely from feeding the
    // mid-layer camera fraction into uOffset, sliding the noise sample
    // window — the standard technique for shader-driven parallax skies.
    this.nebulaSprite.position.set(W / 2, H / 2);
    const nu = this._nebulaFilter.resources.uNebula.uniforms;
    nu.uTime = (game.run ? game.run.time : 0);
    nu.uOffset = [mx / 900, my / 900];
    const hueIdx = Math.abs(Math.floor(mx / 900) + Math.floor(my / 900)) % this._nebulaHues.length;
    const [hA, hB] = this._nebulaHues[hueIdx];
    nu.uColorA = hA; nu.uColorB = hB;

    // NEAR: drifting asteroid belt chunks (parallax 0.14)
    const nearF = 0.14, nx = cx * nearF, ny = cy * nearF;
    if (!this._nearCache || Math.abs(nx - this._nearCache.x) > 100 || Math.abs(ny - this._nearCache.y) > 100) {
      this._nearCache = { x: nx, y: ny };
      const g = this.gDeepNear; g.clear();
      const cell = 260, pad = 200;
      const sX = Math.floor((nx - pad) / cell) * cell, sY = Math.floor((ny - pad) / cell) * cell;
      for (let gx = sX; gx < nx + W + pad; gx += cell) {
        for (let gy = sY; gy < ny + H + pad; gy += cell) {
          const h = ((gx * 12841) ^ (gy * 19661)) >>> 0;
          if (h % 5 !== 0) continue;
          const px = gx + (h % cell), py = gy + ((h >> 4) % cell);
          const sz = 3 + (h % 6);
          const rotBase = (h % 628) / 100;
          const pts = [];
          for (let i = 0; i < 6; i++) { const a = rotBase + (i / 6) * TAU; const rr = sz * (0.7 + ((h >> i) % 3) * 0.15); pts.push(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
          g.poly(pts).fill({ color: '#6b6258', alpha: 0.5 });
        }
      }
    }
    this.gDeepNear.position.set(-nx, -ny);

    // Shooting stars: occasional bright streaks across the visible sky (screen-space)
    const dt = game.dt || 0.016;
    this._nextShootingStarAt -= dt;
    if (this._nextShootingStarAt <= 0) {
      this._nextShootingStarAt = 5 + Math.random() * 7;
      this._shootingStars.push({ x: Math.random() * W, y: -40, ang: Math.PI * 0.28 + Math.random() * 0.18, life: 1.0, speed: 900 + Math.random() * 400 });
    }
    const gs = this.gShootingStars; gs.clear(); gs.position.set(0, 0);
    for (let i = this._shootingStars.length - 1; i >= 0; i--) {
      const s = this._shootingStars[i];
      s.life -= dt * 0.9;
      s.x += Math.cos(s.ang) * s.speed * dt;
      s.y += Math.sin(s.ang) * s.speed * dt;
      if (s.life <= 0) { this._shootingStars.splice(i, 1); continue; }
      const a = Math.min(1, s.life * 2.2);
      const tailX = s.x - Math.cos(s.ang) * 75, tailY = s.y - Math.sin(s.ang) * 75;
      gs.moveTo(tailX, tailY).lineTo(s.x, s.y).stroke({ width: 2, color: '#ffffff', alpha: a * 0.8 });
      gs.circle(s.x, s.y, 2.4).fill({ color: '#ffffff', alpha: a });
    }
  }

  // ---------------------------- GROUND / BG ------------------------------
  _drawGround(game) {
    const W = game.W, H = game.H, cx = game.cam.x, cy = game.cam.y;
    const t = game.run ? game.run.time : 0;
    // PERF: the starfield/nebula/grid are near-static frame to frame — redrawing
    // hundreds of hashed grid cells every single frame (60-200x/sec) was the
    // #1 cost under sustained combat. Cache the drawing and only rebuild when
    // the camera has actually moved past a padded buffer, or once per second
    // (so slow ambient effects like the nebula pulse / zone tint still update).
    const pad = 260;
    const cache = this._groundCache;
    const moved = !cache || Math.abs(cx - cache.cx) > pad * 0.55 || Math.abs(cy - cache.cy) > pad * 0.55;
    const stale = !cache || (t - cache.t) > 1.0;
    if (!moved && !stale) return;
    this._groundCache = { cx, cy, t };

    const g = this.gGround; g.clear();
    const zoneT = Math.min(1, t / 180);
    const zoneT2 = Math.min(1, Math.max(0, (t - 60) / 120));
    const br = Math.floor(8 + (22 - 8) * zoneT2);
    const bg = Math.floor(4 + (4 - 4) * zoneT2);
    const bb = Math.floor(18 + (10 - 18) * zoneT2);
    // Semi-transparent (not opaque) so the deep-space parallax layer
    // (planets/moons/nebula/galaxy) behind `world` actually bleeds through
    // instead of being 100% hidden — this was the reason the whole parallax
    // system was invisible even though it was drawing correctly.
    g.rect(cx - pad, cy - pad, W + pad * 2, H + pad * 2).fill({ color: `rgb(${br},${bg},${bb})`, alpha: 0.58 });

    const drift = t * 0.4;
    const starGrid = 80;
    const layers = [
      { speed: 0.05, size: 0.7, alpha: 0.35 + zoneT2 * 0.15 },
      { speed: 0.12, size: 1.2, alpha: 0.50 + zoneT2 * 0.10 },
      { speed: 0.20, size: 1.8, alpha: 0.70 + zoneT2 * 0.10 },
    ];
    const starColor = `rgb(${200 + Math.floor(zoneT2 * 55)},${180 - Math.floor(zoneT2 * 80)},${255 - Math.floor(zoneT2 * 180)})`;
    for (const layer of layers) {
      const ox = drift * layer.speed, oy = drift * layer.speed * 0.6;
      const sX = Math.floor((cx - pad - ox) / starGrid) * starGrid;
      const sY = Math.floor((cy - pad - oy) / starGrid) * starGrid;
      let any = false;
      for (let sx = sX; sx < cx + W + pad + starGrid; sx += starGrid) {
        for (let sy = sY; sy < cy + H + pad + starGrid; sy += starGrid) {
          const h1 = ((sx * 1031) ^ (sy * 7919)) >>> 0;
          const h2 = ((sx * 7187) ^ (sy * 3301)) >>> 0;
          const h3 = ((sx * 2053) ^ (sy * 6271)) >>> 0;
          if (h3 % 5 !== 0) continue;
          const wx = sx + (h1 % starGrid) + ox;
          const wy = sy + (h2 % starGrid) + oy;
          g.circle(wx, wy, layer.size);
          any = true;
        }
      }
      if (any) g.fill({ color: starColor, alpha: layer.alpha });
    }

    if (zoneT > 0.1) {
      const pulseA = 0.03 + Math.sin(t * 0.4) * 0.01;
      const nebGrid = 320;
      const nSX = Math.floor((cx - pad) / nebGrid) * nebGrid;
      const nSY = Math.floor((cy - pad) / nebGrid) * nebGrid;
      const rc = 80 + Math.floor(zoneT2 * 120), gc = 20 + Math.floor((1 - zoneT2) * 40), bc = 120 - Math.floor(zoneT2 * 80);
      const nebColor = `rgb(${rc},${gc},${bc})`;
      for (let nx = nSX; nx < cx + W + pad + nebGrid; nx += nebGrid) {
        for (let ny = nSY; ny < cy + H + pad + nebGrid; ny += nebGrid) {
          const nh = ((nx * 4421) ^ (ny * 6247)) >>> 0;
          if (nh % 3 !== 0) continue;
          const ncx = nx + (nh % 200) - 100, ncy = ny + ((nh >> 8) % 200) - 100;
          const r = 90 + (nh % 60);
          g.circle(ncx, ncy, r).fill({ color: nebColor, alpha: (pulseA * zoneT * 1.4).toFixed(3) });
        }
      }
    }

    const grid = 64;
    const startX = Math.floor((cx - pad) / grid) * grid, startY = Math.floor((cy - pad) / grid) * grid;
    const gridColor = `rgb(${Math.floor(20 + zoneT2 * 30)},${Math.floor(8 - zoneT2 * 6)},${Math.floor(36 - zoneT2 * 20)})`;
    for (let x = startX; x < cx + W + pad; x += grid) g.moveTo(x, cy - pad).lineTo(x, cy + H + pad);
    for (let y = startY; y < cy + H + pad; y += grid) g.moveTo(cx - pad, y).lineTo(cx + W + pad, y);
    g.stroke({ width: 1, color: gridColor, alpha: 0.6 });

    // World edge walls
    g.rect(0, 0, game.world.w, game.world.h).stroke({ width: 6, color: '#ff7a1a', alpha: 0.53 });
    g.rect(-8, -8, game.world.w + 16, game.world.h + 16).stroke({ width: 16, color: '#ff7a1a', alpha: 0.2 });
  }

  _drawDecals(game) {
    const g = this.gDecals; g.clear();
    for (const d of game.bloodDecals) {
      // Pools grow into place over ~0.4s instead of popping in at full size,
      // and get a darker clotted core once they've settled — real pooling.
      // Weapon-dependent: color comes from whichever weapon dealt the killing
      // blow (fire=ember, ice=frost, electric=arc, etc.) instead of always red.
      const age = Math.max(0, game.time - (d.bornAt ?? game.time));
      const grow = Math.min(1, age / 0.4);
      const r = d.r * (0.35 + grow * 0.65);
      const bc = d.color || '#780a12';
      g.circle(d.x, d.y, r).fill({ color: bc, alpha: d.a });
      if (grow > 0.5) g.circle(d.x, d.y, r * 0.5).fill({ color: '#000000', alpha: d.a * 0.45 });
    }
  }

  // --------------------------- DOCK STATION --------------------------------
  // Random map objective: stand inside the ring to charge it, get a bonus on
  // completion. Its light goes through the same pooled-additive-sprite
  // technique as every other light source (see waterdrop-lighting skill) —
  // no ad-hoc glow filter.
  _drawDockStation(game) {
    const g = this.gDockStation; g.clear();
    const st = game.dockStation;
    if (!st) {
      this.dockStationLight.visible = false;
      this.dockStationText.visible = false;
      return;
    }
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const activeColor = st.charging ? '#ffffff' : '#4dffe0';

    g.circle(st.x, st.y, st.r * 1.15).fill({ color: '#0a1a22', alpha: 0.55 });
    g.circle(st.x, st.y, st.r).stroke({ width: 3, color: '#2a6a72', alpha: 0.8 });
    g.circle(st.x, st.y, st.r * 0.7).stroke({ width: 1.5, color: '#3a8a92', alpha: 0.5 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 0.15;
      g.moveTo(st.x + Math.cos(a) * st.r * 0.3, st.y + Math.sin(a) * st.r * 0.3)
        .lineTo(st.x + Math.cos(a) * st.r * 0.95, st.y + Math.sin(a) * st.r * 0.95)
        .stroke({ width: 1, color: '#4dffe0', alpha: 0.25 + 0.15 * pulse });
    }
    g.circle(st.x, st.y, 8 + pulse * 2).fill({ color: activeColor, alpha: 0.75 });

    if (st.progress > 0.001) {
      const a0 = -Math.PI / 2, a1 = a0 + TAU * st.progress;
      g.moveTo(st.x + Math.cos(a0) * (st.r + 10), st.y + Math.sin(a0) * (st.r + 10))
        .arc(st.x, st.y, st.r + 10, a0, a1)
        .stroke({ width: 5, color: activeColor, alpha: 0.9 });
    }

    this.dockStationText.visible = true;
    this.dockStationText.position.set(st.x, st.y - st.r - 20);
    this.dockStationText.text = st.progress > 0.001 ? `DOCK ${Math.round(st.progress * 100)}%` : 'DOCK';
    this.dockStationText.style.fill = activeColor;

    this.dockStationLight.visible = true;
    this.dockStationLight.position.set(st.x, st.y);
    const glowSize = 90 + pulse * 20 + st.progress * 40;
    this.dockStationLight.width = glowSize; this.dockStationLight.height = glowSize;
    this.dockStationLight.tint = activeColor;
    this.dockStationLight.alpha = 0.35 + st.progress * 0.35 + pulse * 0.05;
  }

  // ------------------------------- GEMS -----------------------------------
  _drawGems(game) {
    const g = this.gGems; g.clear();
    let xpLitIdx = 0;
    game.gems.forEach(gm => {
      const wobble = Math.sin(gm.t * 6) * 2;
      if (gm.xp > 0) {
        const s = gm.xp <= 2 ? 3 : gm.xp <= 6 ? 5 : gm.xp <= 15 ? 7.5 : 11;
        const glowC = gm.xp > 15 ? '#ffffff' : '#a0c8ff';
        // Custom lit-shader glow (same GlProgram pipeline as everything
        // else) instead of the old plain vector glow() approximation.
        if (gm.xp > 2 && xpLitIdx < this._xpOrbLitPool.length) {
          const { sprite, filter } = this._xpOrbLitPool[xpLitIdx++];
          const light = { x: gm.x, y: gm.y + wobble, rgb: hexToRgb01(glowC), radius: s * 2.2, ambient: 0.5 };
          sprite.visible = true;
          sprite.position.set(gm.x, gm.y + wobble);
          const size = s * 4.2;
          sprite.width = size; sprite.height = size;
          sprite.tint = glowC;
          sprite.alpha = 0.4;
          this._updateLitUniforms(filter, sprite, light);
        }
        g.poly([gm.x, gm.y - s + wobble, gm.x + s * 0.68, gm.y + wobble, gm.x, gm.y + s + wobble, gm.x - s * 0.68, gm.y + wobble]).fill('#5ba3ff');
        if (gm.xp > 6) g.circle(gm.x, gm.y + wobble, s * 0.28).fill({ color: '#dcf0ff', alpha: 0.85 });
      } else if (gm.heart > 0) {
        const hs = 6 + Math.sin(gm.t * 8) * 1.2;
        glow(g, gm.x, gm.y + wobble, hs, '#ff3146', 0.8);
        const cx = gm.x, cy = gm.y + wobble;
        g.moveTo(cx, cy + hs * 0.3)
          .bezierCurveTo(cx - hs * 1.1, cy - hs * 0.5, cx - hs * 1.4, cy + hs * 0.8, cx, cy + hs * 1.2)
          .bezierCurveTo(cx + hs * 1.4, cy + hs * 0.8, cx + hs * 1.1, cy - hs * 0.5, cx, cy + hs * 0.3)
          .fill('#ff3146');
      } else {
        const s = gm.gold <= 2 ? 3 : gm.gold <= 5 ? 4.5 : gm.gold <= 12 ? 6.5 : 9;
        const gc = gm.gold >= 13 ? '#fff7a0' : '#ffd166';
        if (gm.gold > 2) glow(g, gm.x, gm.y + wobble, s, gc, 0.6);
        g.circle(gm.x, gm.y + wobble, s).fill(gc);
        if (gm.gold >= 6) g.circle(gm.x - s * 0.25, gm.y - s * 0.25 + wobble, s * 0.3).fill({ color: '#ffffdc', alpha: 0.7 });
      }
    });
    for (let i = xpLitIdx; i < this._xpOrbLitPool.length; i++) this._xpOrbLitPool[i].sprite.visible = false;
  }

  // ------------------------------ ENEMIES ---------------------------------
  _drawEnemies(game) {
    const g = this.gEnemies; g.clear();
    game.enemies.forEach(e => {
      try {
        const t = e.t; const s = t.size;
        if (t.speed > 88 && e.vx !== undefined) {
          for (let ti = 1; ti <= 3; ti++) {
            const ta = (1 - ti / 4) * 0.28;
            g.circle(e.x - e.vx * ti * 0.032, e.y - e.vy * ti * 0.032, s * (0.45 + ti * 0.06)).fill({ color: t.color, alpha: ta });
          }
        }
        // shadow — leans away from the current merged light (muzzle-flash/
        // flashlight) when close enough to be affected, plain/static beyond
        // that radius so it doesn't jitter far-away enemies pointlessly.
        const L = this._testLight;
        let sdx = 0, sdy = s * 0.45;
        if (L) {
          const ldx = e.x - L.x, ldy = e.y - L.y, ld = Math.hypot(ldx, ldy) || 1;
          const falloff = Math.max(0, 1 - ld / (L.radius * 2.4));
          sdx = (ldx / ld) * s * 0.32 * falloff;
          sdy = s * 0.45 + (ldy / ld) * s * 0.22 * falloff;
        }
        g.ellipse(e.x + sdx, e.y + sdy, s * 0.45, s * 0.18).fill({ color: '#000000', alpha: 0.45 });
        if (t.boss) glow(g, e.x, e.y, s * 0.6, t.color, 1.4);
        else glow(g, e.x, e.y, s * 0.5, t.color, 0.35);

        // Light the enemy's own body, not just the ground under it — gLight
        // (muzzle-flash/flashlight + per-projectile ground-illum sprites)
        // renders BEHIND this opaque Graphics fill in z-order, so an additive
        // sprite alone can never bleed through the shape. Instead we find the
        // single strongest nearby light (merged muzzle/flashlight test light,
        // or the closest friendly projectile in flight) and blend a capped
        // amount of ITS color into the enemy's own fill color — a genuine
        // "projectile casts light on what it flies near" effect while the
        // enemy's own identity color always stays dominant (max 45% mix).
        let bestStrength = 0, bestHex = null;
        if (L) {
          const ld = Math.hypot(e.x - L.x, e.y - L.y);
          const str = Math.max(0, 1 - ld / L.radius) * (0.35 + L.mt * 0.5);
          if (str > bestStrength) { bestStrength = str; bestHex = L.hex; }
        }
        game.projs.forEach(pr => {
          if (pr.friendly === false) return;
          const rad = (pr.size || 6) * 9;
          const pd = Math.hypot(e.x - pr.x, e.y - pr.y);
          if (pd >= rad) return;
          const str = (1 - pd / rad) * 0.55;
          if (str > bestStrength) { bestStrength = str; bestHex = pr.color || '#5fd6ff'; }
        });
        // XP orbs / gold also cast a little light on nearby enemies — much
        // weaker than a muzzle flash or bullet, just enough to read as a
        // faint pickup glow touching whatever's standing next to it.
        game.gems.forEach(gm => {
          if (gm.xp <= 2 && gm.gold <= 2) return; // tiny orbs don't glow at all
          const rad = 46;
          const gd = Math.hypot(e.x - gm.x, e.y - gm.y);
          if (gd >= rad) return;
          const str = (1 - gd / rad) * 0.22;
          const hex = gm.xp > 15 ? '#ffffff' : gm.xp > 0 ? '#a0c8ff' : gm.gold >= 13 ? '#fff7a0' : '#ffd166';
          if (str > bestStrength) { bestStrength = str; bestHex = hex; }
        });
        const litColor = (bestHex && bestStrength > 0.03) ? mixHex(t.color, bestHex, Math.min(0.45, bestStrength)) : t.color;
        const bodyColor = e.hit > 0 ? '#ffffff' : litColor;
        const shape = this._enemyShapeFor(e, t, s);
        this._paintShape(g, shape, bodyColor, { width: 2, color: '#000000' });

        // Progressive gore: reveal accumulated wound patches — torn, wet
        // flesh peeling away exactly where each 10%-HP hit landed.
        if (e._wounds && e._wounds.length) {
          for (const w of e._wounds) {
            const wx = e.x + w.lx, wy = e.y + w.ly;
            // Softer/smaller than before — read as a wet wound patch, not a
            // punched-out hole (a smaller dark core + a softer wet halo).
            g.circle(wx, wy, w.size * 0.95).fill({ color: '#5a0710', alpha: 0.4 });
            g.circle(wx, wy, w.size * 0.62).fill({ color: '#2c0308', alpha: 0.6 });
            g.circle(wx - w.size * 0.2, wy - w.size * 0.16, w.size * 0.22).fill({ color: '#8a1018', alpha: 0.55 });
          }
        }

        // Boss-specific extra passes
        if (t.id === 'swipeWarden') {
          // Armor plating normally; guard-down window telegraphs hard (bright
          // pulsing red outline + exposed white-hot core) so a swipe attack
          // during it reads as a deliberate, earned execute, not a fluke.
          if (e._swipeVulnerable) {
            const pulse = 0.5 + 0.5 * Math.sin(game.time * 10);
            g.circle(e.x, e.y, s * 0.75 + pulse * 4).stroke({ width: 4, color: '#ff3146', alpha: 0.9 });
            glow(g, e.x, e.y, s * 0.65, '#ff3146', 1.8);
            g.circle(e.x, e.y, s * 0.22).fill({ color: '#fff2c8', alpha: 0.9 });
          } else {
            for (let pi = 0; pi < 4; pi++) {
              const pa = (pi / 4) * TAU + Math.PI / 4;
              g.circle(e.x + Math.cos(pa) * s * 0.42, e.y + Math.sin(pa) * s * 0.42, s * 0.16).fill('#8a6a3a');
            }
            g.circle(e.x, e.y, s * 0.2).stroke({ width: 2, color: '#5a4520', alpha: 0.8 });
          }
        } else if (t.id === 'bossOcular') {
          const pulse = 0.5 + 0.5 * Math.sin(game.time * 4);
          g.circle(e.x, e.y, s * 0.68 + pulse * 3).stroke({ width: 4, color: '#ffd166' });
          g.circle(e.x, e.y, s * 0.32).fill('#fff8d0');
          let pdx = 0, pdy = 0;
          if (game.player) {
            const dx = game.player.x - e.x, dy = game.player.y - e.y, d = Math.hypot(dx, dy);
            if (d > 0.001) { pdx = (dx / d) * s * 0.14; pdy = (dy / d) * s * 0.14; }
          }
          g.circle(e.x + pdx, e.y + pdy, s * 0.12).fill('#0a0510');
          g.circle(e.x + pdx, e.y + pdy, s * 0.05).fill('#ff3146');
        } else if (t.id === 'bossAida') {
          g.circle(e.x, e.y, s * 0.18).fill('#000000');
          g.circle(e.x, e.y, s * 0.08).fill('#ff7a1a');
        } else if (t.id === 'bossNecromancer') {
          const pulse = 0.5 + 0.5 * Math.sin(game.time * 5);
          glow(g, e.x - s * 0.18, e.y - s * 0.08, s * 0.10, '#7ad96b', pulse * 1.5);
          glow(g, e.x + s * 0.18, e.y - s * 0.08, s * 0.10, '#7ad96b', pulse * 1.5);
          g.circle(e.x - s * 0.18, e.y - s * 0.08, s * 0.10).fill('#7ad96b');
          g.circle(e.x + s * 0.18, e.y - s * 0.08, s * 0.10).fill('#7ad96b');
          for (let ti = 0; ti < 5; ti++) g.rect(e.x - s * 0.28 + ti * s * 0.14, e.y + s * 0.22, s * 0.09, s * 0.16).fill('#e8f5e0');
        } else if (t.id === 'bossVoidTitan') {
          const pulse = 0.5 + 0.5 * Math.sin(game.time * 3);
          glow(g, e.x, e.y, s * 0.20, '#b362ff', pulse * 2);
          g.circle(e.x, e.y, s * 0.20).fill('#b362ff');
          g.circle(e.x, e.y, s * 0.08).fill('#ffffff');
          g.circle(e.x, e.y, s * 0.7 + pulse * 4).stroke({ width: 3, color: '#b362ff', alpha: 0.5 });
        }

        if (e.hp < e.maxHp) {
          const bw = t.boss ? 80 : Math.max(20, s * 1.2);
          g.rect(e.x - bw / 2, e.y - s * 0.7 - 6, bw, 4).fill('#000000');
          g.rect(e.x - bw / 2, e.y - s * 0.7 - 6, bw * Math.max(0, e.hp / e.maxHp), 4).fill('#ff3146');
        }
      } catch (err) { console.error('[pixi draw enemy]', err); }
    });
  }

  _enemyShapeFor(e, t, s) {
    const x = e.x, y = e.y;
    switch (t.id) {
      case 'bat': return { poly: [x, y - s * 0.4, x + s * 0.6, y, x, y + s * 0.3, x - s * 0.6, y] };
      case 'brute': return { rect: [x - s * 0.5, y - s * 0.5, s, s] };
      case 'ranger': { const pts = []; for (let i = 1; i <= 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; pts.push(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6); } return { poly: pts }; }
      case 'charger': return { poly: [x + s * 0.6, y, x - s * 0.5, y - s * 0.5, x - s * 0.5, y + s * 0.5] };
      case 'ghoul': return { circle: [x, y, s * 0.5] };
      case 'necron': { const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const r = i % 2 ? s * 0.4 : s * 0.7; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'bossOcular': return { circle: [x, y, s * 0.6] };
      case 'bossNecromancer': return { circle: [x, y, s * 0.55] };
      case 'bossVoidTitan': { const pts = [x + s * 0.6, y]; for (let i = 1; i <= 6; i++) { const a = (i / 6) * TAU; pts.push(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6); } return { poly: pts }; }
      case 'bossAida': { const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const r = s * 0.55; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'slime': return { ellipse: [x, y, s * 0.55, s * 0.45] };
      // ---- Distinct silhouettes for enemy types that previously all fell
      // through to the same plain default circle (no bitmap sprite
      // pipeline exists in this project — see waterdrop-lighting skill's
      // "no hand-authored art" note — so this is procedural geometry, the
      // same technique already used for every other enemy above). ----
      case 'crystalite': { const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; const r = i % 2 ? s * 0.42 : s * 0.62; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.3); } return { poly: pts }; }
      case 'soulshard': return { poly: [x, y - s * 0.6, x + s * 0.38, y + s * 0.1, x, y + s * 0.55, x - s * 0.38, y + s * 0.1] };
      case 'bonewalker': { const pts = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; const r = s * (i % 2 ? 0.68 : 0.4); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'voidspawn': { const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2; const r = s * (i % 2 ? 0.66 : 0.26); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'steelbrute': { const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; pts.push(x + Math.cos(a) * s * 0.58, y + Math.sin(a) * s * 0.5); } return { poly: pts }; }
      case 'lightningbug': { const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const r = s * (i % 2 ? 0.62 : 0.22); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'techsoldier': return { poly: [x - s * 0.42, y - s * 0.5, x + s * 0.42, y - s * 0.5, x + s * 0.5, y, x + s * 0.3, y + s * 0.5, x - s * 0.3, y + s * 0.5, x - s * 0.5, y] };
      case 'nanoswarm': { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const r = s * (0.35 + (i % 3) * 0.12); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      default: return { circle: [x, y, s * 0.5] };
    }
  }

  // Tier tags ("T2"/"T3"...) — only drawn once tier >= 2 so a fresh run's
  // opening minutes look untouched. Pooled Text objects (see constructor),
  // same convention as _drawDamageNumbers, so this never allocates per-frame.
  _drawEnemyTierTags(game) {
    let idx = 0;
    game.enemies.forEach(e => {
      if (!e.tier || e.tier < 2) return;
      let txt = this._tierTagPool[idx];
      if (!txt) {
        txt = new Text({ text: '', style: this._textStyle(8, '#ff3146', '#1a0206', 3) });
        txt.anchor.set(0.5);
        this.tierTagContainer.addChild(txt);
        this._tierTagPool[idx] = txt;
      }
      txt.visible = true;
      txt.text = 'T' + e.tier;
      txt.position.set(e.x, e.y - e.t.size * 0.7);
      idx++;
    });
    for (let i = idx; i < this._tierTagPool.length; i++) this._tierTagPool[i].visible = false;
  }

  _paintShape(g, shape, fillColor, strokeStyle) {
    if (shape.poly) g.poly(shape.poly);
    else if (shape.rect) g.rect(...shape.rect);
    else if (shape.circle) g.circle(...shape.circle);
    else if (shape.ellipse) g.ellipse(...shape.ellipse);
    g.fill(fillColor);
    if (strokeStyle) {
      if (shape.poly) g.poly(shape.poly);
      else if (shape.rect) g.rect(...shape.rect);
      else if (shape.circle) g.circle(...shape.circle);
      else if (shape.ellipse) g.ellipse(...shape.ellipse);
      g.stroke(strokeStyle);
    }
  }

  // ------------------------------ PLAYER -----------------------------------
  _drawPlayer(game) {
    const g = this.gPlayer; g.clear();
    const gf = this.gPlayerFront; gf.clear();
    const p = game.player;
    const aimAng = Math.atan2(p.aimY, p.aimX);
    // Idle animation: a slow breathing scale pulse + gentle sway when
    // standing still (dirX/dirY ~0), layered onto the existing squish/tilt
    // "weight" system instead of a parallel one — same water-drop-simulator
    // feel, just alive even when not actively moving.
    const idleT = Math.hypot(p.dirX || 0, p.dirY || 0) < 0.08;
    const breathe = idleT ? Math.sin((p.bob || 0) * 0.6) * 0.02 : 0;
    const sway = idleT ? Math.sin((p.bob || 0) * 0.4) * 0.05 : 0;
    const sqx = 1 + p.squish * 0.25 + breathe, sqy = 1 - p.squish * 0.18 - breathe * 0.6;

    // Shadow — offset directionally AWAY from the current merged light
    // (flashlight normally, muzzle-flash when firing) so it visibly reacts
    // when the muzzle flash fires, i.e. the muzzle flash "casts" the shadow.
    const L = this._testLight;
    let shOffX = 0, shOffY = 10, shElong = 1, shDark = 0.45;
    if (L) {
      const ldx = p.x - L.x, ldy = p.y - L.y;
      const ld = Math.hypot(ldx, ldy) || 1;
      const mt = L.mt || 0;
      const len = 9 + mt * 20;
      shOffX = (ldx / ld) * len;
      shOffY = Math.max(5, (ldy / ld) * len + 6);
      shElong = 1 + mt * 0.55;
      shDark = 0.42 + mt * 0.28;
    }
    g.ellipse(p.x + shOffX, p.y + shOffY, p.r * 0.9 * sqx * shElong, p.r * 0.32).fill({ color: '#000000', alpha: shDark });

    const r = p.r;
    const bodyAng = (p.tilt || 0) + sway;
    const localPts = [];
    // sample the teardrop bezier body outline as a polygon (approx)
    const bez = (t) => {
      // two symmetric bezier halves from (0,-r*1.15) to (0,r) via (±r*1.05, ...)
      const p0 = [0, -r * 1.15], c1 = [r * 1.05, -r * 0.4], c2 = [r * 1.05, r * 0.65], p1 = [0, r];
      const mt = 1 - t;
      const x = mt ** 3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * p1[0];
      const y = mt ** 3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * p1[1];
      return [x, y];
    };
    for (let i = 0; i <= 8; i++) { const [x, y] = bez(i / 8); localPts.push(x, y); }
    for (let i = 8; i >= 0; i--) { const [x, y] = bez(i / 8); localPts.push(-x, y); }
    const rotated = rotPoly(p.x, p.y, bodyAng, scalePts(localPts, sqx, sqy));

    // === LIGHTING TEST: the body is now a real normal-mapped lit sprite ===
    // (baked sphere normal map + a single moving light — flashlight/muzzle
    // flash merged into one uniform, per the step-1 smoke test) instead of a
    // flat poly fill. This REPLACES the old ambient/point-light-sprite
    // system entirely for the body — no legacy glow left underneath it.
    const bodyDiam = r * 2.05;
    this.playerBodySprite.visible = true;
    this.playerBodySprite.position.set(p.x, p.y - r * 0.05);
    this.playerBodySprite.width = bodyDiam; this.playerBodySprite.height = bodyDiam;
    this.playerBodySprite.tint = p.hit > 0 ? this.playerBodyFlash : this.playerBodyColor;
    this._updateLitUniforms(this.playerBodyFilter, this.playerBodySprite, this._testLight);
    gf.poly(rotated).stroke({ width: 2.4, color: '#06121e' });

    // highlight droplets (rotated with body)
    const [hx1, hy1] = rot(-r * 0.35, -r * 0.5, bodyAng);
    gf.ellipse(p.x + hx1, p.y + hy1, 2.6, 4.2).fill({ color: '#ffffff', alpha: 0.85 });
    const [hx2, hy2] = rot(r * 0.3, r * 0.25, bodyAng);
    gf.circle(p.x + hx2, p.y + hy2, 1.6).fill({ color: '#ffffff', alpha: 0.45 });
    if (p.iframes > 0) {
      const [ex1, ey1] = rot(-2, -2, bodyAng), [ex2, ey2] = rot(3, -2, bodyAng);
      gf.circle(p.x + ex1, p.y + ey1, 1.6).fill('#ffd166');
      gf.circle(p.x + ex2, p.y + ey2, 1.6).fill('#ffd166');
    }

    // ===== Rank-unlocked cosmetics (see ProfilePanel) =====
    const cos = game.cosmetics || {};
    if (cos.headbandColor) {
      gf.poly(rotPoly(p.x, p.y, bodyAng, [-r * 0.55, -r * 0.85, r * 0.55, -r * 0.85, r * 0.5, -r * 0.62, -r * 0.5, -r * 0.62]))
        .fill(cos.headbandColor).stroke({ width: 1, color: '#000000', alpha: 0.4 });
      const [knotX, knotY] = rot(r * 0.55, -r * 0.74, bodyAng);
      gf.circle(p.x + knotX, p.y + knotY, 2.2).fill(cos.headbandColor);
    }
    if (cos.cigarOn) {
      const cigarAng = bodyAng + 0.3;
      gf.poly(rotPoly(p.x, p.y, cigarAng, [r * 0.35, -r * 0.16, r * 0.35 + 8, -r * 0.16 - 1, r * 0.35 + 8, -r * 0.16 + 1, r * 0.35, -r * 0.16 + 2]))
        .fill('#5a4632');
      const [tipX, tipY] = rot(r * 0.35 + 8, -r * 0.16, cigarAng);
      const tipPulse = 0.5 + 0.5 * Math.sin(game.time * 6);
      glow(gf, p.x + tipX, p.y + tipY, 3, '#ff6a1a', tipPulse * 1.4);
      gf.circle(p.x + tipX, p.y + tipY, 1.2).fill(tipPulse > 0.5 ? '#ffb347' : '#ff6a1a');
    }

    // ===== Gun (rotated in aim direction) =====
    const recoil = -p.recoil * 4;
    const gx = p.x + Math.cos(aimAng) * recoil, gy = p.y + 1 + Math.sin(aimAng) * recoil;
    const owned = game.run.ownedWeapons;
    let gunColor = '#3a4658', accentColor = '#6cb4ff';
    if (owned.includes('voidBeam')) { gunColor = '#2a1a3a'; accentColor = '#b362ff'; }
    else if (owned.includes('emberOrbs')) { gunColor = '#3a201a'; accentColor = '#ff7a1a'; }
    else if (owned.includes('shotgun')) { gunColor = '#3a302a'; accentColor = '#ffd166'; }
    else if (owned.includes('autoBolts')) { gunColor = '#2a3a44'; accentColor = '#4dffd4'; }

    const gunRect = (lx, ly, lw, lh, color) => gf.poly(rotPoly(gx, gy, aimAng, [lx, ly, lx + lw, ly, lx + lw, ly + lh, lx, ly + lh])).fill(color);
    gunRect(-6, -3, 8, 6, '#1f2632');
    gunRect(-2, 3, 4, 6, '#0f141c');
    gunRect(2, -3, 14, 6, gunColor);
    gunRect(8, 3, 4, 7, '#11161e');
    gunRect(4, -5, 9, 2, '#11161e');
    const [sightX, sightY] = rot(8, -5.5, aimAng);
    gf.circle(gx + sightX, gy + sightY, 1.2).fill(accentColor);
    gunRect(16, -1.6, 12, 3.2, '#2a313d');
    gunRect(27, -2.4, 2.5, 4.8, '#0a0d12');
    gf.poly(rotPoly(gx, gy, aimAng, [3, -0.6, 15, -0.6, 15, 0.6, 3, 0.6])).fill({ color: accentColor, alpha: 0.85 });

    if (p.recoil > 0.05) {
      const [mx, my] = rot(30, 0, aimAng);
      // Small hot-tip glow at the barrel end (the real flash burst itself is
      // drawn additively in _drawLights as a baked starburst sprite).
      const muzzleR = 2 + p.recoil * 2.4;
      gf.circle(gx + mx, gy + my, muzzleR).fill(accentColor);
    }
    if (p.reloading) {
      const headX = p.x, headY = p.y - r * 1.55 - 8; // above the character's head, not on the gun
      const isRevolver = p._reloadWid === 'hydropistol' || p._reloadWid === 'hydropistol_evo';
      const prog = p.reloadTotal ? Math.min(1, Math.max(0, 1 - p.reloadT / p.reloadTotal)) : 0;

      if (isRevolver) {
        // Revolver cylinder: chambers empty out, then refill in order as reload progresses
        const chambers = Math.max(1, Math.round(p._reloadMag || 6));
        const cylR = 8.5;
        gf.circle(headX, headY, cylR + 3.2).fill({ color: '#1a1410', alpha: 0.88 }).stroke({ width: 1.3, color: '#8a6d3b' });
        for (let i = 0; i < chambers; i++) {
          const a = (i / chambers) * TAU - Math.PI / 2;
          const ccx = headX + Math.cos(a) * cylR * 0.62, ccy = headY + Math.sin(a) * cylR * 0.62;
          const filled = i / chambers < prog;
          gf.circle(ccx, ccy, cylR * 0.24).fill(filled ? '#ffd166' : '#2a1f12');
        }
        this.reloadText.anchor.set(0, 0.5);
        this.reloadText.position.set(headX + cylR + 8, headY);
      } else {
        // Other weapons: real mag-eject -> new-mag-insert -> slide-rack
        // pantomime happening AT THE GUN, plus the existing spinner + text
        // above the head as a clear at-a-glance status cue.
        const magW = 5, magH = 10;
        if (prog < 0.35) {
          const ft = prog / 0.35; // old mag drops free and falls away
          const [ex, ey] = rot(-3, 5 + ft * 15, aimAng);
          gf.rect(gx + ex - magW / 2, gy + ey - magH / 2, magW, magH)
            .fill({ color: '#2a313d', alpha: 1 - ft * 0.7 }).stroke({ width: 0.6, color: '#11161e', alpha: 1 - ft * 0.7 });
        } else if (prog < 0.75) {
          const ft = (prog - 0.35) / 0.4; // fresh mag rises up into the well
          const [ex, ey] = rot(-3, 17 - ft * 13, aimAng);
          gf.rect(gx + ex - magW / 2, gy + ey - magH / 2, magW, magH).fill('#2a313d').stroke({ width: 0.6, color: '#11161e' });
        } else {
          const ft = (prog - 0.75) / 0.25; // slide racks back, then snaps shut
          const slideOff = ft < 0.55 ? -(ft / 0.55) * 6 : -(1 - (ft - 0.55) / 0.45) * 6;
          const [sxo, syo] = rot(5 + slideOff, -4, aimAng);
          gf.rect(gx + sxo - 5, gy + syo - 1.4, 10, 2.8).fill('#3a4658');
          const [ex, ey] = rot(-3, 4, aimAng);
          gf.rect(gx + ex - magW / 2, gy + ey - magH / 2, magW, magH).fill('#2a313d').stroke({ width: 0.6, color: '#11161e' });
        }
        // Other weapons: just the text + a clean spinning ring (no cylinder)
        const spinR = 7.5;
        const spinAng = game.time * 9;
        const sweep = Math.PI * 1.4;
        const [sx0, sy0] = [headX + Math.cos(spinAng) * spinR, headY + Math.sin(spinAng) * spinR];
        gf.moveTo(sx0, sy0).arc(headX, headY, spinR, spinAng, spinAng + sweep).stroke({ width: 2, color: '#ffd166' });
        this.reloadText.anchor.set(0.5, 1);
        this.reloadText.position.set(headX, headY - spinR - 4);
      }
      this.reloadText.visible = true;
      this.reloadText.text = 'RELOADING';
    } else if (this.reloadText) {
      this.reloadText.visible = false;
    }

    // crosshair
    if (!game.input.joyAim || (!game.input.joyAim.x && !game.input.joyAim.y)) {
      const wmx = game.input.mx - game.W / 2 + game.cam.x;
      const wmy = game.input.my - game.H / 2 + game.cam.y;
      gf.moveTo(wmx - 8, wmy).lineTo(wmx - 3, wmy)
        .moveTo(wmx + 3, wmy).lineTo(wmx + 8, wmy)
        .moveTo(wmx, wmy - 8).lineTo(wmx, wmy - 3)
        .moveTo(wmx, wmy + 3).lineTo(wmx, wmy + 8)
        .stroke({ width: 1.5, color: '#ff7a1a', alpha: 0.67 });
    }

    // orbit weapons
    const orbitWeaponIds = ['emberOrbs', 'whirlwind', 'frostOrb'];
    for (const wId of orbitWeaponIds) {
      if (!game.run.ownedWeapons.includes(wId)) continue;
      const w = WEAPONS[wId];
      const lvl = game.run.weaponLvls[wId] || 0;
      const ws = game.computeWeaponStats ? game.computeWeaponStats(w || {}, lvl) : {};
      const count = ws.orbitCount || 2;
      const radius = (ws.orbitRadius || 80) * game.run.stats.areaMult;
      const angBase = game.time * (ws.orbitSpeed || 2);
      const orbitColor = ws.color || '#ff7a1a';
      for (let i = 0; i < count; i++) {
        const a = angBase + (i / count) * TAU;
        const ox = p.x + Math.cos(a) * radius, oy = p.y + Math.sin(a) * radius;
        glow(gf, ox, oy, 9, orbitColor, 0.9);
        if (wId === 'whirlwind') {
          gf.poly(rotEllipsePoly(ox, oy, angBase * 3, 12, 3)).fill(orbitColor);
        } else if (wId === 'frostOrb') {
          gf.circle(ox, oy, 9).fill(orbitColor);
          gf.circle(ox, oy, 4).fill({ color: '#ffffff', alpha: 0.45 });
          for (let k = 1; k <= 2; k++) { // trailing frost shards
            const ta = a - k * 0.14, tx = p.x + Math.cos(ta) * radius, ty = p.y + Math.sin(ta) * radius;
            gf.poly([tx, ty - 3, tx + 2.4, ty, tx, ty + 3, tx - 2.4, ty]).fill({ color: '#bff0ff', alpha: 0.35 / k });
          }
        } else if (wId === 'emberOrbs') {
          gf.circle(ox, oy, 8).fill(orbitColor);
          gf.circle(ox, oy, 3.5).fill({ color: '#fff2c2', alpha: 0.85 });
          for (let k = 1; k <= 2; k++) { // trailing embers
            const ta = a - k * 0.16, tx = p.x + Math.cos(ta) * radius, ty = p.y + Math.sin(ta) * radius;
            gf.circle(tx, ty, 3 - k).fill({ color: '#ff7a1a', alpha: 0.4 / k });
          }
        } else {
          gf.circle(ox, oy, 8).fill(orbitColor);
        }
      }
    }

    // Drone Squadron — small hovering bodies at whatever positions
    // engine.js's weaponDrone computed this frame (see game._dronePositions).
    if (game.run.ownedWeapons.includes('droneSquad') && game._dronePositions && game._dronePositions.droneSquad) {
      for (const d of game._dronePositions.droneSquad) {
        const bob = Math.sin(game.time * 4 + d.x * 0.05) * 3;
        glow(gf, d.x, d.y + bob, 8, '#4dc4ff', 0.8);
        gf.circle(d.x, d.y + bob, 6).fill('#1a2a3a');
        gf.circle(d.x, d.y + bob, 6).stroke({ width: 1.5, color: '#4dc4ff', alpha: 0.9 });
        gf.circle(d.x, d.y + bob, 2.4).fill({ color: '#bff0ff', alpha: 0.9 });
      }
    }
  }

  // -------------------------------- PET ------------------------------------
  _drawPet(game) {
    const g = this.gPet; g.clear();
    const pet = game.pet;
    const petType = game.activePet.type;
    const petLevel = game.activePet.level || 1;
    const wobbleY = Math.sin(pet.wobble) * 2.5;
    const color = PET_COLORS[petType] || '#ffffff';
    const sz = 7 + Math.floor(petLevel / 40);
    const cx = pet.x, cy = pet.y + wobbleY;
    glow(g, cx, cy, sz, color, 1.0 + Math.sin(pet.wobble * 1.3) * 0.2);

    if (petType === 'aquaSprite') {
      g.moveTo(cx, cy - sz * 1.2)
        .bezierCurveTo(cx + sz, cy - sz * 0.35, cx + sz, cy + sz * 0.7, cx, cy + sz)
        .bezierCurveTo(cx - sz, cy + sz * 0.7, cx - sz, cy - sz * 0.35, cx, cy - sz * 1.2)
        .fill({ color, alpha: 0.92 });
      g.ellipse(cx - sz * 0.3, cy - sz * 0.55, 1.8, 3).fill({ color: '#ffffff', alpha: 0.6 });
    } else if (petType === 'emberFairy') {
      g.moveTo(cx, cy - sz * 1.3)
        .bezierCurveTo(cx + sz * 0.9, cy, cx + sz * 0.6, cy + sz * 0.8, cx, cy + sz)
        .bezierCurveTo(cx - sz * 0.6, cy + sz * 0.8, cx - sz * 0.9, cy, cx, cy - sz * 1.3)
        .fill({ color, alpha: 0.92 });
      g.circle(cx, cy + sz * 0.2, sz * 0.45).fill('#ffdf80');
    } else if (petType === 'shadowWisp') {
      g.circle(cx, cy, sz).fill({ color, alpha: 0.92 });
      g.circle(cx - sz * 0.32, cy - sz * 0.2, sz * 0.26).fill({ color: '#000000', alpha: 0.7 });
      g.circle(cx + sz * 0.32, cy - sz * 0.2, sz * 0.26).fill({ color: '#000000', alpha: 0.7 });
    } else if (petType === 'stormHawk') {
      g.poly([cx, cy - sz * 1.2, cx + sz * 0.75, cy, cx, cy + sz * 1.2, cx - sz * 0.75, cy]).fill({ color, alpha: 0.92 }).stroke({ width: 1, color: '#ffffff', alpha: 0.5 });
    } else if (petType === 'lifeSprite') {
      g.rect(cx - sz * 0.25, cy - sz, sz * 0.5, sz * 2).fill({ color, alpha: 0.92 });
      g.rect(cx - sz, cy - sz * 0.25, sz * 2, sz * 0.5).fill({ color, alpha: 0.92 });
    }

    if (petLevel > 1) {
      g.circle(cx + sz * 0.9, cy - sz * 0.9, 5).fill({ color: '#0a0d12', alpha: 0.85 });
      this.petLevelText.visible = true;
      this.petLevelText.text = petLevel > 99 ? '!' : String(petLevel);
      this.petLevelText.style.fill = color;
      this.petLevelText.position.set(cx + sz * 0.9, cy - sz * 0.9);
    } else {
      this.petLevelText.visible = false;
    }
  }

  // --------------------------- PROJECTILES ----------------------------------
  _drawLitHydroProjectiles(game) {
    let idx = 0;
    const pool = this._litProjPool;
    game.projs.forEach(pr => {
      if (pr.friendly === false) return;
      if (pr._wid !== 'hydropistol' && pr._wid !== 'hydropistol_evo') return;
      if (idx >= pool.length) return;
      const { sprite, filter } = pool[idx++];
      // 50% smaller than before, per spec — the sprite/lit-shader treatment
      // itself is unchanged, just scaled down.
      const sz = (pr.size || 6) * 0.5;
      sprite.visible = true;
      sprite.position.set(pr.x, pr.y);
      sprite.width = sz; sprite.height = sz;
      sprite.tint = pr.color || '#5fd6ff';
      this._updateLitUniforms(filter, sprite, this._testLight);
    });
    for (let i = idx; i < pool.length; i++) pool[i].sprite.visible = false;
  }

  _drawProjectiles(game) {
    const g = this.gProjectiles; g.clear();
    game.projs.forEach(pr => {
      const sz = pr.size || 6;
      const lvlBoost = 1 + (pr._wlvl || 0) * 0.08;
      const ang = pr._ang != null ? pr._ang : Math.atan2(pr.vy, pr.vx);
      const x = pr.x, y = pr.y;

      if (pr.friendly === false) {
        const pulse = 0.7 + 0.3 * Math.sin(game.time * 18);
        glow(g, x, y, sz * 1.4 * pulse, '#ff3146', 1.6);
        const [tx, ty] = rot(-sz * 2.2, 0, ang);
        g.ellipse(x + tx, y + ty, sz * 2.0, sz * 0.6).fill({ color: '#ff3146', alpha: 0.6 });
        g.circle(x, y, sz * 1.4 * pulse).fill('#ffec99');
        g.circle(x, y, sz * 1.0 * pulse).fill('#ff3146');
        return;
      }
      // Starter weapon (hydropistol) bolts — and its evolution — are
      // rendered by the normal-mapped lit sprite pool instead — see
      // _drawLitHydroProjectiles.
      if (pr._wid === 'hydropistol' || pr._wid === 'hydropistol_evo') return;

      switch (pr._wid) {
        case 'shotgun': case 'tidal': {
          glow(g, x, y, sz, '#ff7a1a', 0.8);
          g.circle(x, y, sz * lvlBoost).fill('#ffd166');
          g.circle(x - sz * 0.3, y - sz * 0.3, sz * 0.3).fill('#fff8d0');
          break;
        }
        case 'autoBolts': case 'runicRifle': {
          const len2 = sz * 3.6 * lvlBoost, w = sz * 0.5;
          g.poly(rotPoly(x, y, ang, [-len2 * 0.5, -w * 0.5, len2 * 0.5, -w * 0.5, len2 * 0.5, w * 0.5, -len2 * 0.5, w * 0.5])).fill(pr.color);
          g.poly(rotPoly(x, y, ang, [-len2 * 0.5, -w * 0.2, len2 * 0.5, -w * 0.2, len2 * 0.5, w * 0.2, -len2 * 0.5, w * 0.2])).fill('#ffffff');
          break;
        }
        case 'twinSMG': {
          g.poly(rotPoly(x, y, ang, [-sz * 0.8, -sz * 0.4, sz * 0.8, -sz * 0.4, sz * 0.8, sz * 0.4, -sz * 0.8, sz * 0.4])).fill('#ffd166');
          break;
        }
        case 'iceLance': {
          g.poly(rotPoly(x, y, ang, [sz * 2.0 * lvlBoost, 0, 0, sz * 0.7 * lvlBoost, -sz * 1.4 * lvlBoost, 0, 0, -sz * 0.7 * lvlBoost]))
            .fill('#e7f9ff').stroke({ width: 1.4, color: '#5fd6ff' });
          break;
        }
        case 'plasmaLance': {
          const r = sz * 1.4 * lvlBoost;
          glow(g, x, y, r, '#4dffd4', 1.4);
          g.circle(x, y, r).fill('#4dffd4');
          g.circle(x, y, r * 0.4).fill('#ffffff');
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * TAU;
            g.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4).lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2).stroke({ width: 1, color: '#ffffff' });
          }
          break;
        }
        case 'runeBolts': {
          g.poly(rotPoly(x, y, ang, [sz * 1.4 * lvlBoost, 0, -sz * 0.8 * lvlBoost, sz * 0.6 * lvlBoost, -sz * 0.4 * lvlBoost, 0, -sz * 0.8 * lvlBoost, -sz * 0.6 * lvlBoost])).fill('#b362ff');
          break;
        }
        case 'flameburst': { // FIRE — hot core, cooling tail, ember glow
          glow(g, x, y, sz * 1.35 * lvlBoost, '#ff7a1a', 1.3);
          g.circle(x, y, sz * lvlBoost).fill('#ffb84d');
          g.circle(x, y, sz * 0.5 * lvlBoost).fill('#fff2c2');
          const [ftx, fty] = rot(-sz * 1.8, 0, ang);
          g.circle(x + ftx, y + fty, sz * 0.7).fill({ color: '#ff3146', alpha: 0.35 });
          break;
        }
        case 'icespike': { // ICE — sharp frost shard, distinct from iceLance's diamond
          glow(g, x, y, sz, '#bff0ff', 0.7);
          g.poly(rotPoly(x, y, ang, [sz * 1.9 * lvlBoost, 0, sz * 0.25, sz * 0.55 * lvlBoost, -sz * 1.3 * lvlBoost, 0, sz * 0.25, -sz * 0.55 * lvlBoost])).fill('#e7f9ff').stroke({ width: 1, color: '#6fd6f0' });
          break;
        }
        case 'arcTesla': case 'chainlightning': { // ELECTRICITY — jagged bolt, matches particle 'lightning' style
          const len2 = sz * 2.4 * lvlBoost;
          const [bx0, by0] = rot(-len2 * 0.5, 0, ang);
          g.moveTo(x + bx0, y + by0);
          for (let s = 1; s <= 4; s++) {
            const tt = s / 4;
            const [lx, ly] = rot(-len2 * 0.5 + len2 * tt, (Math.random() - 0.5) * 5, ang);
            g.lineTo(x + lx, y + ly);
          }
          g.stroke({ width: 2.4, color: '#bff0ff' });
          glow(g, x, y, sz * 0.9, '#e8ffff', 1.1);
          g.circle(x, y, sz * 0.55).fill('#e8ffff');
          break;
        }
        default: {
          // Every weapon without a bespoke render case (all 10 new weapons
          // added this session included) still gets a real light glow
          // around the bolt itself, not just a flat-filled circle — this
          // is what actually casts visible light near where it flies,
          // separate from the invisible enemy-tint blend in _drawEnemies.
          glow(g, x, y, sz * 1.3 * lvlBoost, pr.color, 0.85);
          g.circle(x, y, sz * lvlBoost).fill(pr.color);
          const [dtx, dty] = rot(-sz * 1.6, 0, ang);
          g.circle(x + dtx, y + dty, sz * 0.7).fill({ color: pr.color, alpha: 0.4 });
        }
      }
    });
  }

  _drawEnemyProjectiles(game) {
    const g = this.gProjectiles;
    game.eprojs.forEach(ep => {
      g.circle(ep.x, ep.y, ep.size).fill(ep.color);
    });
  }

  _drawBeam(game) {
    const g = this.gBeam; g.clear();
    if (!game.run.ownedWeapons.includes('voidBeam')) return;
    const p = game.player, tgt = p._beamTarget;
    if (!tgt || !tgt.alive) return;
    glow(g, (p.x + tgt.x) / 2, (p.y + tgt.y) / 2, 6, '#b362ff', 1.2);
    g.moveTo(p.x, p.y).lineTo(tgt.x, tgt.y).stroke({ width: 4, color: '#b362ff' });
    g.moveTo(p.x, p.y).lineTo(tgt.x, tgt.y).stroke({ width: 2, color: '#ffffff' });
  }

  // ------------------------------ PARTICLES ---------------------------------
  _drawParticles(game) {
    const g = this.gParticles; g.clear();
    game.parts.forEach(p => {
      const a = p.life / p.max;
      if (p.type === 'meteorMark') {
        const t01 = 1 - (p.life / p.max);
        const shR = 10 + t01 * (p._radius * 0.35);
        g.ellipse(p.x, p.y, shR, shR * 0.32).fill({ color: '#000000', alpha: 0.45 });
        const fy = (p._fallFrom || -300) * (1 - t01);
        const fx = (p._fallOffX || 0) * (1 - t01);
        for (let k = 0; k < 6; k++) {
          const f = k / 6;
          const tx = p.x + fx * (1 - f * 0.6), ty = p.y + (fy - f * 60);
          const col = k < 3 ? '#fff5d6' : (k < 5 ? '#ff9a3c' : '#b51d28');
          g.circle(tx, ty, (16 - k * 2) * (0.6 + t01 * 0.4)).fill({ color: col, alpha: (1 - f) * 0.7 });
        }
        const mx = p.x + fx, my = p.y + fy, headR = 12 + t01 * 6;
        glow(g, mx, my, headR, p.color, 1.6);
        g.circle(mx, my, headR).fill('#ffb84d');
        g.circle(mx - headR * 0.25, my - headR * 0.25, headR * 0.4).fill('#fff5d6');
        g.circle(mx + 2, my - 1, 2.4).fill('#221008');
        g.circle(mx - 3, my + 2, 1.8).fill('#221008');
      } else if (p.type === 'bossSlamWarn') {
        // Tidebreaker telegraph — a red danger ring that fills in as the
        // window to dodge runs out, so the threat reads at a glance.
        const t01 = 1 - (p.life / p.max);
        g.circle(p.x, p.y, p._radius).stroke({ width: 4, color: '#1fb6ff', alpha: 0.35 + t01 * 0.5 });
        g.circle(p.x, p.y, p._radius * t01).fill({ color: '#1fb6ff', alpha: 0.12 + t01 * 0.22 });
      } else if (p.type === 'poison') {
        g.circle(p.x, p.y, p.size).fill({ color: '#7ad96b', alpha: 0.30 * a }).stroke({ width: 2, color: '#5ab93b', alpha: 0.6 * a });
      } else if (p.type === 'lightning') {
        // Real electric-arc look: bright white-hot core + a wider colored
        // halo stroke, redrawn with fresh jitter so it visibly crackles.
        const sxv = (p.vx - p.x), syv = (p.vy - p.y);
        const segs = 5;
        g.moveTo(p.x, p.y);
        const pts = [[p.x, p.y]];
        for (let s = 1; s <= segs; s++) {
          const t = s / segs;
          const jitter = s < segs ? (Math.random() - 0.5) * 22 : 0;
          const px = p.x + sxv * t + jitter, py = p.y + syv * t + jitter;
          g.lineTo(px, py); pts.push([px, py]);
        }
        g.stroke({ width: 5 + Math.random() * 2, color: p.color, alpha: a * 0.55 });
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.stroke({ width: 1.6, color: '#ffffff', alpha: Math.min(1, a + 0.3) });
      } else if (p.type === 'casing') {
        // Ejected shell casing: tumbling brass rect, cooling from hot orange
        // to dull brass as it fades.
        const rot2 = p._rot || 0;
        const len2 = p.size * 2.4, wid2 = p.size * 0.9;
        const cs2 = Math.cos(rot2), sn2 = Math.sin(rot2);
        const hx = (len2 / 2) * cs2, hy = (len2 / 2) * sn2, wx = (wid2 / 2) * -sn2, wy = (wid2 / 2) * cs2;
        const heat = Math.min(1, a * 1.5);
        const col = heat > 0.55 ? '#ffcf6b' : '#8a5a2a';
        g.poly([p.x - hx - wx, p.y - hy - wy, p.x + hx - wx, p.y + hy - wy, p.x + hx + wx, p.y + hy + wy, p.x - hx + wx, p.y - hy + wy])
          .fill({ color: col, alpha: Math.min(1, a + 0.15) });
      } else if (p.type === 'chunk') {
        g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: Math.min(1, a + 0.2) });
        if (Math.random() < 0.35) g.circle(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.size * 0.6).fill({ color: '#780a12', alpha: 0.6 });
      } else if (p.type === 'ring') {
        const r = p.size * (1 - a);
        g.circle(p.x, p.y, r).stroke({ width: 4, color: p.color, alpha: a });
      } else if (p.type === 'arc') {
        const sweepFrac = Math.min(1, (1 - a) * 2.5 + 0.15);
        const rad = p.size * (0.82 + (1 - a) * 0.22);
        const a0 = (p._ang || 0) - Math.PI * 0.5, a1 = a0 + Math.PI * sweepFrac;
        g.moveTo(p.x + Math.cos(a0) * rad, p.y + Math.sin(a0) * rad)
          .arc(p.x, p.y, rad, a0, a1)
          .stroke({ width: 7 - (1 - a) * 3, color: p.color, alpha: a });
        if (sweepFrac < 0.98) {
          const tipAng = a1;
          g.moveTo(p.x + Math.cos(tipAng - 0.18) * rad, p.y + Math.sin(tipAng - 0.18) * rad)
            .arc(p.x, p.y, rad, tipAng - 0.18, tipAng + 0.04).stroke({ width: 10 * a, color: '#ffffff', alpha: a * 0.7 });
        }
      } else if (p.type === 'spark') {
        g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: a });
      } else if (p.type === 'ash') {
        // Level-up "water-to-ash": droplets cool from icy blue into grey
        // ash flecks as they drift up and burn out.
        const t01 = 1 - a;
        const col = t01 < 0.45 ? '#9fd8ff' : (t01 < 0.75 ? '#c9c9c9' : '#7a7a7a');
        g.rect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size).fill({ color: col, alpha: a * 0.85 });
      } else {
        g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: Math.min(1, a + 0.2) });
      }
    });
  }

  // ---------------------------- DAMAGE NUMBERS ------------------------------
  _drawDamageNumbers(game) {
    let idx = 0;
    game.dmgNums.forEach(d => {
      let txt = this._dmgTextPool[idx];
      if (!txt) {
        txt = new Text({ text: '', style: this._textStyle(14, '#ffffff', '#000000', 4) });
        txt.anchor.set(0.5);
        this.dmgTextContainer.addChild(txt);
        this._dmgTextPool[idx] = txt;
      }
      // Quick "pop" bounce on spawn (life starts at 0.8s and counts down) —
      // overshoots slightly then settles within ~0.12s, nicer than a static number.
      const age = 0.8 - d.life;
      const pop = 1 + Math.max(0, 0.55 - age * 4.5);
      txt.visible = true;
      txt.text = d.text;
      txt.style.fill = d.color;
      txt.style.fontSize = d.size;
      txt.scale.set(pop);
      txt.alpha = Math.min(1, d.life * 2);
      txt.position.set(d.x, d.y);
      idx++;
    });
    for (let i = idx; i < this._dmgTextPool.length; i++) this._dmgTextPool[i].visible = false;
  }

  // --------------------------- LEVEL-UP TEXT --------------------------------
  _drawLevelUpText(game) {
    const timer = game._levelUpTextTimer || 0;
    if (timer <= 0 || !game._levelUpTextPos) { this.levelUpText.visible = false; return; }
    const total = 1.4;
    const t01 = 1 - timer / total; // 0 -> 1 over the animation
    const pos = game._levelUpTextPos;
    this.levelUpText.visible = true;
    this.levelUpText.position.set(pos.x, pos.y - t01 * 46);
    this.levelUpText.alpha = timer > 0.3 ? 1 : (timer / 0.3);
    // Water blue -> ash grey color drift
    const c1 = [0x9f, 0xd8, 0xff], c2 = [0x8a, 0x84, 0x7a];
    const mix = (a, b, f) => Math.round(a + (b - a) * f);
    this.levelUpText.style.fill = `rgb(${mix(c1[0], c2[0], t01)},${mix(c1[1], c2[1], t01)},${mix(c1[2], c2[2], t01)})`;
    this.levelUpText.scale.set(1 + Math.sin(Math.min(1, t01) * Math.PI) * 0.18);
    this.levelUpText.rotation = t01 > 0.55 ? (Math.random() - 0.5) * (t01 - 0.55) * 0.14 : 0;
  }

  // ------------------------------ BOSS ARROW --------------------------------
  _drawBossArrow(game, W, H) {
    const g = this.gBossArrow; g.clear();
    this.metersText.visible = false;
    this.bossArrowText.visible = false;

    if (game._bossArrowOffscreenNow && game._bossArrowLast) {
      const { ax, ay, ang, meters } = game._bossArrowLast;
      const pulse = 0.6 + 0.4 * Math.sin(game.time * 8);
      glow(g, ax, ay, 16 * pulse, '#ffd166', 1.8);
      g.poly(rotPoly(ax, ay, ang, [20, 0, -10, 14, -4, 0, -10, -14])).fill('#ffd166');
      this.bossArrowText.visible = true;
      this.bossArrowText.position.set(ax + Math.cos(ang) * -2, ay + Math.sin(ang) * -2);
      this.metersText.visible = true;
      const [mtx, mty] = rot(6, 30, ang);
      this.metersText.text = meters + 'm \u2192';
      this.metersText.position.set(ax + mtx, ay + mty);
    }

    if (game._bossArrowDissolve) {
      const dis = game._bossArrowDissolve;
      const px = 3;
      for (let i = 0; i < BOSS_ARROW_PIXELS.length; i++) {
        const pt = BOSS_ARROW_PIXELS[i];
        const localT = dis.t - pt.delay;
        const [wx, wy] = rot(pt.lx, pt.ly, dis.ang);
        if (localT <= 0) {
          g.rect(dis.ax + wx - px / 2, dis.ay + wy - px / 2, px, px).fill('#ffd166');
          continue;
        }
        const fallDur = 0.4;
        const ft = localT / fallDur;
        if (ft >= 1) continue;
        const fallDist = 6 + ft * 16;
        const ash = Math.floor(120 + ft * 60);
        const col = `rgb(${Math.floor(255 - ft * 175)},${Math.floor(209 - ft * 129)},${ash})`;
        g.rect(dis.ax + wx - px / 2, dis.ay + wy + fallDist - px / 2, px, px).fill({ color: col, alpha: 1 - ft });
      }
    }
  }

  // --------------------------- SCREEN OVERLAYS ------------------------------
  _ensureVignette(W, H) {
    if (this._vigW === W && this._vigH === H && this._vignetteGrad) return this._vignetteGrad;
    if (this._vignetteGrad) { try { this._vignetteGrad.destroy(); } catch (e) { /* noop */ } }
    this._vigW = W; this._vigH = H;
    const cx = W / 2, cy = H / 2;
    const outerR = Math.hypot(cx, cy) * 1.05;
    const innerR = outerR * 0.58;
    this._vignetteGrad = new FillGradient({
      type: 'radial',
      center: { x: cx, y: cy }, innerRadius: innerR,
      outerCenter: { x: cx, y: cy }, outerRadius: outerR,
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.75, color: 'rgba(0,0,0,0.05)' },
        { offset: 1, color: 'rgba(0,0,0,0.26)' },
      ],
      textureSpace: 'global',
    });
    return this._vignetteGrad;
  }

  _drawScreenOverlays(game, W, H) {
    const g = this.gUI; g.clear();
    // Single centered radial vignette — kept deliberately light now (was
    // darkening the whole screen and making it hard to see, per feedback).
    // Only the far outer corners darken slightly; the entire play area
    // where combat happens stays fully clear.
    g.rect(0, 0, W, H).fill(this._ensureVignette(W, H));

    // Thunder flash — Chain Lightning / Arc Tesla bounces briefly light up
    // the whole screen like real lightning.
    if (game._lightningFlash > 0) {
      const a = Math.min(1, game._lightningFlash * 3.2);
      g.rect(0, 0, W, H).fill({ color: '#e8faff', alpha: a * 0.20 });
    }

    if (game.player.hit > 0) g.rect(0, 0, W, H).fill({ color: '#b51d28', alpha: game.player.hit * 0.35 });
    if (game.cam.slowmo > 0) g.rect(0, 0, W, H).fill({ color: '#4dc4ff', alpha: Math.min(0.2, game.cam.slowmo * 0.4) });

    if (game._bossDeathFlash > 0) {
      const a = Math.min(1, game._bossDeathFlash);
      g.rect(0, 0, W, H).fill({ color: '#ffdc64', alpha: a * 0.55 });
      const ringR = (1.4 - game._bossDeathFlash) * Math.max(W, H) * 0.85;
      g.circle(W / 2, H / 2, ringR).stroke({ width: 8 * a, color: '#ffc832', alpha: a * 0.7 });
    }
    if (game._levelUpFlash > 0) {
      const a = Math.min(1, game._levelUpFlash) * 0.5;
      glow(g, W / 2, H / 2, Math.max(W, H) * 0.3, '#4dffd4', a * 3);
    }
    if (game._critPunch > 0) {
      const a = Math.min(1, game._critPunch);
      g.circle(W / 2, H / 2, Math.max(W, H) * 0.5).stroke({ width: 40, color: '#ff3146', alpha: a * 0.2 });
      if (a > 0.6) g.circle(W / 2, H / 2, 12 * a).fill({ color: '#ffffff', alpha: (a - 0.6) * 0.25 });
    }
  }
}

function scalePts(pts, sx, sy) {
  const out = [];
  for (let i = 0; i < pts.length; i += 2) out.push(pts[i] * sx, pts[i + 1] * sy);
  return out;
}
