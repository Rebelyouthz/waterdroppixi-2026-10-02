/* Whole-game superpolish guards: held katana, crit hit-stop, LEVEL UP
 * sequence (spray / colour cycle / falling pixels), menu purchase juice.
 *
 * Source-scan plus a handful of prototype calls. Injected faults: a check
 * that would stay green if the katana still lost to first-manual, if silent
 * DoT crits froze the sim, or if the banner was still "LEVEL UP!" drifting
 * grey with random rotation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const engineSrc = fs.readFileSync(path.join(ROOT, 'game', 'engine.js'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'game', 'pixiRenderer.js'), 'utf8');
const campSrc = fs.readFileSync(path.join(ROOT, 'components', 'Camp.jsx'), 'utf8');
const shopSrc = fs.readFileSync(path.join(ROOT, 'components', 'Shop.jsx'), 'utf8');
const talentSrc = fs.readFileSync(path.join(ROOT, 'components', 'TalentTree.jsx'), 'utf8');
const welcomeSrc = fs.readFileSync(path.join(ROOT, 'components', 'Welcome.jsx'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

const { Game } = await import('../src/game/engine.js');
const { katanaSwingAngle } = await import('../src/game/heroDraw.js');

check('katana claims _heldWid over first-manual pistol', () => {
  if (!/meleeHeld/.test(engineSrc)) return 'updateWeapons never captures a melee id';
  if (!/this\._heldWid = meleeHeld/.test(engineSrc)) return 'melee does not overwrite _heldWid';
});

check('crit hit-stop uses cam.slowmo and skips silent ticks', () => {
  if (!/this\.cam\.slowmo = Math\.max\(this\.cam\.slowmo, stop\)/.test(engineSrc)) {
    return 'crit does not write cam.slowmo';
  }
  const idx = engineSrc.indexOf('Hades-style');
  if (idx < 0) return 'hit-stop comment (the silent-gate) is gone';
  const slice = engineSrc.slice(idx, idx + 700);
  if (!/if \(!silent\)/.test(slice)) return 'hit-stop is not gated on !silent';
});

check('katana crit tiers pick named combo styles', () => {
  if (!/comboTier >= 3\) idx = 7/.test(engineSrc)) return 'mega crit is not the 360 cut';
  if (!/comboTier >= 2\) idx = 6/.test(engineSrc)) return 'super crit is not the cyclone';
  if (!/comboTier >= 1\) idx = 4/.test(engineSrc)) return 'crit is not the rising cut';
});

check('LEVEL UP banner is short LVL UP, not LEVEL UP!', () => {
  if (!/text: 'LVL UP'/.test(rendererSrc)) return 'renderer still constructs LEVEL UP!';
  const draw = rendererSrc.slice(rendererSrc.indexOf('_drawLevelUpText'));
  if (draw.includes("text = 'LEVEL UP!'")) return 'draw path still writes LEVEL UP!';
  if (!/text = 'LVL UP'/.test(draw)) return 'draw path does not set LVL UP';
  if (/Math\.random\(\)/.test(draw.slice(0, 1800))) return 'banner still jitter-rotates with Math.random';
});

check('LEVEL UP colour cycle is blue then yellow then red', () => {
  const at = rendererSrc.indexOf('  _drawLevelUpText(game) {');
  const draw = rendererSrc.slice(at, at + 1800);
  if (!/0x6e/.test(draw) || !/0x31/.test(draw) || !/0xcb/.test(draw)) {
    return 'blue/yellow/red mix constants missing from _drawLevelUpText';
  }
  if (/ash grey|c2 = \[0x8a/.test(draw)) return 'old blue-to-grey drift is still there';
});

check('LEVEL UP spray + falling pixels exist and run', () => {
  if (typeof Game.prototype._spawnLevelUpSpray !== 'function') return 'missing _spawnLevelUpSpray';
  if (typeof Game.prototype._spawnLevelUpPixels !== 'function') return 'missing _spawnLevelUpPixels';
  const spawned = [];
  const stub = {
    spawned,
    _fxScale: 1,
    _levelUpTextPos: { x: 40, y: 80 },
    player: { x: 10, y: 20 },
    parts: {
      acquire() {
        const p = { type: null, x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 1, color: null };
        spawned.push(p);
        return p;
      },
    },
  };
  stub.fxCount = Game.prototype.fxCount;
  Game.prototype._spawnLevelUpSpray.call(stub, stub.player);
  const spray = spawned.filter(p => p.type === 'spark');
  if (spray.length < 4) return `spray spawned ${spray.length} sparks`;
  spawned.length = 0;
  Game.prototype._spawnLevelUpPixels.call(stub);
  const pix = spawned.filter(p => p.type === 'luPixel');
  if (pix.length < 4) return `shatter spawned ${pix.length} luPixels`;
  if (!pix.every(p => p.vy > 0)) return 'pixels do not fall (vy should be positive down)';
});

check('reload cylinder is skipped while the blade is in hand', () => {
  if (!/model\.kind !== 'katana'/.test(rendererSrc)) {
    return 'reload UI still draws on top of the katana';
  }
});

check('held katana slings wind-back then whip then settle', () => {
  if (!/p\._katanaSwingT = form\.swing/.test(engineSrc) && !engineSrc.includes('p._katanaSwingT = 0.28')) {
    return 'weaponKatana never arms the swing timer';
  }
  if (!rendererSrc.includes('katanaSwingAngle')) return 'renderer does not drive the held blade from the swing';
  const p = { _katanaSwingT: 0.28, _katanaSwingMax: 0.28, _katanaSwingDir: 1 };
  if (Math.abs(katanaSwingAngle(p, 0)) > 0.02) return 'u=0 should sit on aim';
  p._katanaSwingT = 0.28 * 0.85;
  if (katanaSwingAngle(p, 0) >= 0) return 'wind-up should go behind aim';
  p._katanaSwingT = 0.28 * 0.48;
  if (katanaSwingAngle(p, 0) <= 0) return 'whip should go through past aim';
  p._katanaSwingT = 0;
  if (Math.abs(katanaSwingAngle(p, 0.4) - 0.4) > 0.001) return 'settled blade should match aim';
});

check('Star Atlas parallax layers split far/near and meteors have tails', () => {
  const raid = fs.readFileSync(path.join(ROOT, 'game', 'starRaidRenderer.js'), 'utf8');
  if (!/speed: 6/.test(raid) || !/speed: 185/.test(raid)) {
    return 'star layers lost the far-slow / near-fast split';
  }
  if (!/a\.meteor/.test(raid) || !/trail/.test(raid)) return 'belt meteors have no trail';
});

check('crowd separation was actually strengthened', () => {
  if (/sepX \* 26 \* dt/.test(engineSrc)) return 'old sep force 26 is still in the integrator';
  if (!/sepX \* 42 \* dt/.test(engineSrc)) return 'new sep force 42 is missing';
  if (!/t\.size \* 1\.55/.test(engineSrc)) return 'sep radius was not widened';
});

check('camp rail clicks are audible', () => {
  if (!/const goTab = \(id\) => \{ Audio\.click\(\); setTab\(id\); \}/.test(campSrc)) {
    return 'goTab helper missing';
  }
  if (!/tapOpen/.test(campSrc)) return 'tapOpen helper missing';
  if (campSrc.includes("onClick={() => setTab('campaign')}")) {
    return 'CAMPAIGN tab still setTab without Audio.click';
  }
});

check('Welcome ENTER THE LAKE and chest opens fire juice', () => {
  if (!/Audio\.menuOpen\?\. \(\); onContinue\(\)/.test(welcomeSrc)
      && !/Audio\.menuOpen\?\.\(\); onContinue\(\)/.test(welcomeSrc)) {
    return 'ENTER THE LAKE is still a silent onContinue';
  }
  if (!/fireClaimFx/.test(shopSrc)) return 'Shop never fires ClaimFx';
  if (!/burstLoot\(anchor, \{ gold: goldAmt, gems: gemsAmt \}\)/.test(shopSrc)) {
    return 'resource chest does not burst gold/gems';
  }
});

check('talent buy uses the skill-buy dopamine sound', () => {
  if (!/Audio\.skillBuy\?\.\(/.test(talentSrc)) return 'TalentTree buy is still unlockReveal/claimPing';
});

check('gamepad does not steal mouse fire', () => {
  if (/this\.input\.shooting = rt > 0\.4 \|\| rb;/.test(engineSrc)) {
    return 'idle pad still overwrites shooting every frame';
  }
  if (!/input\._dev === 'gamepad'/.test(engineSrc)) {
    return 'last-device-wins gate is missing';
  }
  if (!/buttons\[3\]\?\.pressed/.test(engineSrc) || !/input\.heavy = padHeavy/.test(engineSrc)) {
    return 'triangle is not wired as heavy';
  }
});

check('TalentTree teaches rib forms without extra buyable talent flags', () => {
  if (!/rib-forms/.test(talentSrc)) return 'RIB_FORMS teaching strip missing from TalentTree';
  if (!/from '\.\.\/game\/meleeCombo'/.test(talentSrc)) return 'TalentTree does not import RIB_FORMS';
  if (!/from '\.\.\/game\/comboSchool'/.test(talentSrc)) return 'TalentTree does not import combo school nodes';
  if (/afford \? buy\(t\)/.test(talentSrc)) return 'first click still instant-buys — inspect-first is gone';
  if (!/inspectTalent/.test(talentSrc) || !/inspectForm/.test(talentSrc) || !/inspectCombo/.test(talentSrc)) {
    return 'combo school or talent tiles no longer inspect first';
  }
  if (!/talentCeremonyOf/.test(talentSrc)) return 'keystone/move talents never fire the UNLOCKED plate';
});

check('menu buttons do not clip their own corners', () => {
  const css = fs.readFileSync(path.join(ROOT, 'index.css'), 'utf8');
  const btn = css.match(/button \{[\s\S]*?\n\}/);
  if (btn && /overflow:\s*hidden/.test(btn[0])) return 'global button still overflow:hidden';
});

check('visible milestone and daily copy is English', () => {
  const ext = fs.readFileSync(path.join(ROOT, 'game', 'data_ext.js'), 'utf8');
  const daily = fs.readFileSync(path.join(ROOT, 'components', 'CampPanels.jsx'), 'utf8');
  if (/Nå 1000|Fullfölj|Besegra |Överlev |Guld-paket|Legendary Kista/.test(ext + daily)) {
    return 'Swedish player-facing copy is still in milestones or daily rewards';
  }
});

check('attribute spend respects the curve cap', () => {
  if (!/attrCanAdd/.test(campSrc)) return 'buyAttr does not use attrCanAdd';
});

check('profile level-up collect is live and claims through ClaimFx', () => {
  if (!/collectPendingLevelUp/.test(campSrc)) return 'overlay collect is still a stale snapshot';
  if (!/rankUnlocksBetween/.test(campSrc)) return 'multi-rank unlocks are not used';
  if (!/fireClaimFx\(e\?\.currentTarget, bag/.test(campSrc)) return 'CLAIM does not fire ClaimFx';
});

check('card shop uses shopCardCost and applyShopPull', () => {
  const shop = fs.readFileSync(path.join(ROOT, 'components', 'CampPanels.jsx'), 'utf8');
  if (!/shopCardCost/.test(shop) || !/applyShopPull/.test(shop)) {
    return 'shop still uses a flat gold cost or a stale snapshot';
  }
});

check('gear panel levels with slot parts, salvages, and compares to worn', () => {
  const gear = fs.readFileSync(path.join(ROOT, 'components', 'GearPanel.jsx'), 'utf8');
  if (!/gearCanLevel/.test(gear)) return 'level button still keys off generic gearParts';
  if (!/applySalvageGear/.test(gear)) return 'discard is still a silent delete';
  if (!/compareToWorn/.test(gear)) return 'no compare vs the worn piece';
  if (!/sortGearInventory/.test(gear)) return 'inventory is not sorted best-first';
  if (/DISCARD/.test(gear) && /gearInventory: inv.filter/.test(gear)) {
    return 'stale discard path is still in GearPanel';
  }
});

check('maps route lights the takeable node and does not star-emoji gold', () => {
  const src = fs.readFileSync(path.join(ROOT, 'components', 'CampPanels.jsx'), 'utf8');
  const at = src.indexOf('export function MapsPanel');
  if (at < 0) return 'MapsPanel is gone';
  const slice = src.slice(at, src.indexOf('export const DAILY_REWARDS_TABLE'));
  if (!/`map-node \$\{done \? 'done' : ''\} \$\{canStart && !done \? 'available'/.test(slice)
      && !/available/.test(slice)) {
    return 'available class never applied — pulse CSS is dead';
  }
  if (/★|◆|▸|▼/.test(slice)) return 'map node copy still uses star/diamond/triangle glyphs';
  if (!/cur_gold/.test(slice)) return 'map gold is not a GameIcon';
});

check('skill tree forces the dash walk and banners real moves', () => {
  const tree = fs.readFileSync(path.join(ROOT, 'components', 'SkillTree.jsx'), 'utf8');
  const camp = campSrc;
  const moves = fs.readFileSync(path.join(ROOT, 'game', 'skillMoves.js'), 'utf8');
  if (!/skillMoveOf/.test(tree)) return 'SkillTree never reads SKILL_MOVES';
  if (!/onMoveUnlock/.test(tree) || !/onMoveUnlock/.test(camp)) {
    return 'Dash unlocked never reaches the camp banner';
  }
  if (/GOT IT/.test(tree)) return 'GOT IT still skips the dash lesson';
  if (!/BUY SHADOW DASH FIRST/.test(tree)) return 'off-path buy is not denied during the lesson';
  if (!/SHOW THE PATH/.test(tree)) return 'the comic no longer frames the teal walk';
  if (!/pendingSkillTour/.test(camp)) return 'skills unlock does not open the tree after the cascade';
  if (/GlowFilter/.test(tree)) return 'SkillTree imported Pixi GlowFilter';
  if (/filter="url\(#poe-glow\)"/.test(tree)) return 'live veins still hang feGaussianBlur poe-glow';
  if (!/poe_mob3:/.test(moves) || !/poe_com6/.test(fs.readFileSync(path.join(ROOT, '..', 'test', 'skillMoves.test.mjs'), 'utf8'))) {
    return 'SKILL_MOVES lost Shadow Dash or the chance-passive guard';
  }
});

if (fails.length) {
  console.error(`juice.test FAIL ${fails.length}  pass ${pass}\n` + fails.map(f => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log(`juice.test ok  ${pass} checks`);
