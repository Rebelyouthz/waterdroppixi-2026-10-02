/* Dead-config sweep.
 *
 * The most expensive bug class in this project by a wide margin is content
 * that is DECLARED but never READ. It never throws, never logs, and never
 * shows up in a screenshot — it just silently does nothing:
 *
 *   - 16 level-up cards declared `flag:` values the engine never looked at
 *   - meta upgrades m_projspd / m_projrange wrote keys nothing consumed
 *   - the katana shipped with an icon id that had no glyph
 *   - the Deep Current map had no boss, so its nodes were uncompletable
 *   - a story quest read `r.ownedWeapons`, a field that does not exist
 *
 * Every one was found by a person playing, or by a paid review. None was
 * found by a test, because the tests all checked that the DECLARATION was
 * well-formed. This file checks the other end: that something, somewhere,
 * actually reads it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

// Everything that could plausibly consume a stat key.
const CONSUMERS = [
  'game/engine.js', 'game/pixiRenderer.js', 'game/base.js',
  'game/gear.js', 'game/runes.js', 'game/artifacts.js', 'game/progression.js',
  'components/GameScreen.jsx', 'store.js',
];
const haystack = CONSUMERS.map(read).join('\n');
const engine = read('game/engine.js');

const reads = (key) => new RegExp(`\\b${key.replace(/[^\w]/g, '\\$&')}\\b`).test(haystack);

const data = await import('../src/game/data.js');
const ext2 = await import('../src/game/data_ext2.js');

check('every meta upgrade writes a stat something reads', () => {
  const dead = (data.META_UPGRADES || [])
    .filter((u) => u.stat && !reads(u.stat))
    .map((u) => `${u.id} -> ${u.stat}`);
  return dead.length
    ? `bought with gold, changes nothing:\n    ${dead.join('\n    ')}`
    : null;
});

check('every stat card writes a stat something reads', () => {
  const dead = (data.STAT_CARDS || [])
    .filter((c) => c.stat && c.stat !== 'heal' && !reads(c.stat))
    .map((c) => `${c.id} -> ${c.stat}`);
  return dead.length
    ? `offered as a level-up pick, does nothing:\n    ${dead.join('\n    ')}`
    : null;
});

check('every active skill is handled by castSkill', () => {
  const dead = Object.keys(ext2.ACTIVE_SKILLS || {})
    .filter((id) => !new RegExp(`id === '${id}'`).test(engine));
  return dead.length ? `skills with no implementation: ${dead.join(', ')}` : null;
});

const campaign = await import('../src/game/campaign.js');
const quests = await import('../src/game/storyQuests.js');
const ext = await import('../src/game/data_ext.js');
const { DAILY_REWARDS: dailyRewards, CHESTS: chests } = ext;
const { PATH_STEPS } = await import('../src/game/path.js');
const enemies = data.ENEMIES || {};

check('every campaign map has a boss, and that boss exists', () => {
  // The Deep Current shipped without an entry, so the last map of the
  // campaign could never be completed — every node requires "put the
  // guardian down".
  const missing = (ext2.MAP_STAGES || [])
    .filter((m) => !campaign.MAP_BOSS[m.id])
    .map((m) => m.id);
  if (missing.length) return `maps with no boss: ${missing.join(', ')}`;
  const bogus = Object.entries(campaign.MAP_BOSS)
    .filter(([, id]) => !enemies[id])
    .map(([map, id]) => `${map} -> ${id}`);
  return bogus.length ? `boss ids that are not enemies: ${bogus.join(', ')}` : null;
});

check('no weapon falls back to the placeholder icon', () => {
  const icons = read('components/GameIcon.jsx');
  const glyphs = new Set([...icons.matchAll(/^ {2}([a-zA-Z0-9_]+):\s*\(u\)/gm)].map((m) => m[1]));
  const map = /const ICONS = \{([\s\S]*?)\n\};/.exec(icons);
  if (!map) return 'could not find the ICONS map';
  const entries = [...map[1].matchAll(/(\w+):\s*\['(\w+)'/g)];
  const missing = entries.filter(([, , glyph]) => !glyphs.has(glyph))
    .map(([, id, glyph]) => `${id} -> ${glyph}`);
  if (missing.length) return `icon ids with no glyph: ${missing.join(', ')}`;
  const weapons = Object.keys(data.WEAPONS || {});
  const mapped = new Set(entries.map(([, id]) => id));
  const unmapped = weapons.filter((w) => !mapped.has(w));
  return unmapped.length
    ? `weapons with no ICONS entry (render as a pistol): ${unmapped.join(', ')}`
    : null;
});

check('every save key the engine seeds from meta actually exists somewhere', () => {
  /* Catches the m_projspd class directly: engine reads `this.meta.X`, and if
     buildMetaEffects never writes X the multiplier silently stays at its
     default. */
  const gs = read('components/GameScreen.jsx');
  const metaReads = [...engine.matchAll(/this\.meta\.(\w+)/g)].map((m) => m[1]);
  const unique = [...new Set(metaReads)];
  // Keys written dynamically (`result[stat] = …` from the artifact, rune and
  // gear appliers) cannot be found by name, so they are matched against the
  // data that drives those appliers instead of being reported as dead.
  const artifactSrc = read('game/artifacts.js');
  // Same reasoning as artifacts, for the skill tree: buildMetaEffects walks
  // POE_INDEX and does `result[pn.stat] = amt`, so a node's stat gets written
  // without its name ever appearing in GameScreen.jsx. poe_tree.js is that
  // applier's data table, so it counts as a writer — exactly like the affix
  // table above. This does NOT weaken the guard: a `this.meta.X` with no
  // node, no affix and no mention in GameScreen still fails, which is the
  // m_projspd class this check exists to catch. Deliberately matched as
  // `stat: 'X'` rather than a bare word, so a stat name that merely appears
  // in a node's prose description cannot wave itself through.
  const treeSrc = read('game/poe_tree.js');
  const dead = unique.filter((k) => {
    // An artifact affix writes `result[stat]` dynamically, so the key never
    // appears by name in GameScreen — matching the affix table instead.
    if (new RegExp(`\\b${k}\\b`).test(artifactSrc)) return false;
    if (new RegExp(`stat:\\s*'${k}'`).test(treeSrc)) return false;
    return !new RegExp(`\\b${k}\\b`).test(gs);
  });
  return dead.length
    ? `engine reads meta.X that buildMetaEffects never writes: ${dead.join(', ')}`
    : null;
});

/* ---- Wider sweep --------------------------------------------------------
 * The classes above were found the expensive way. These are the same shape of
 * mistake in places nobody has looked yet.
 */

check('every quest metric is a real save field', () => {
  // A quest whose `metric` names a field the save never writes can never be
  // completed, and looks identical to one that is simply hard.
  const storeSrc = read('store.js');
  const appSrc = read('../src/App.js'.replace('../src/', ''));
  const known = new Set([
    ...[...storeSrc.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]),
    ...[...appSrc.matchAll(/ns\.(\w+)\s*=/g)].map((m) => m[1]),
    ...[...appSrc.matchAll(/(\w+):\s*\(?cur\.|(\w+):\s*\(cur/g)].map((m) => m[1] || m[2]),
  ].filter(Boolean));
  const bad = [];
  for (const m of (data.MILESTONES || [])) {
    if (m.metric && !known.has(m.metric)) bad.push(`${m.id} -> ${m.metric}`);
  }
  return bad.length ? `milestones tracking a field nothing writes: ${bad.join(', ')}` : null;
});

check('every reward key has an icon in REWARD_ICONS', () => {
  // A payout with no icon entry is silently omitted from the reward screen —
  // the player is paid and never told. probeKeys hit this exact bug today.
  const prog = read('game/progression.js');
  const iconBlock = /REWARD_ICONS = \{([\s\S]*?)\};/.exec(prog);
  if (!iconBlock) return 'REWARD_ICONS not found';
  const known = new Set([...iconBlock[1].matchAll(/(\w+):/g)].map((m) => m[1]));
  // Everything that is actually paid out, from all three routes.
  //
  // The first version of this check only read quest and milestone reward bags
  // and therefore could not go red on the very bug it was written for:
  // probeKeys is granted by `give('probeKeys', n)` in App.js, a path it never
  // looked at. Deleting the icon left it green. A test that cannot fail on its
  // own motivating example is worse than no test, because it reads as coverage.
  const paid = new Set();
  for (const q of [...(data.MILESTONES || [])]) {
    Object.keys(q.reward || {}).forEach((k) => paid.add(k));
  }
  for (const q of [...quests.STORY_QUESTS, ...quests.CAMP_QUESTS]) {
    Object.keys(q.rwd || {}).forEach((k) => paid.add(k));
  }
  // The run-reward ledger: every `give('key', …)` in App.js.
  const appSrc2 = read('App.js');
  [...appSrc2.matchAll(/give\(\s*'(\w+)'/g)].forEach((m) => paid.add(m[1]));
  const missing = [...paid].filter((k) => !known.has(k) && k !== 'chest' && k !== 'blueprintShards');
  return missing.length
    ? `paid out but invisible on the reward screen: ${missing.join(', ')}`
    : null;
});

check('every gear set bonus applies a stat the engine reads', () => {
  const gear = read('game/gear.js');
  const sets = /GEAR_SETS = \{([\s\S]*?)\n\};/.exec(gear);
  if (!sets) return 'GEAR_SETS not found';
  // `apply: (r) => { r.X += … }` — every X must be something the run reads.
  const touched = [...sets[1].matchAll(/r\.(\w+)\s*[+-]?=/g)].map((m) => m[1]);
  const dead = [...new Set(touched)].filter((k) => !reads(k));
  return dead.length ? `set bonuses writing dead stats: ${dead.join(', ')}` : null;
});

check('every enemy a map spawns actually exists', () => {
  // A typo in an enemyMix is invisible: the map loads, the wave rolls a name
  // that resolves to undefined, and either nothing spawns or it throws deep in
  // the spawner. Nothing in the editor flags it.
  const bad = [];
  for (const m of (ext2.MAP_STAGES || [])) {
    for (const n of m.nodes || []) {
      for (const e of n.enemyMix || []) {
        if (!enemies[e]) bad.push(`${n.id} -> ${e}`);
      }
    }
  }
  return bad.length ? `maps referencing enemies that do not exist: ${bad.join(', ')}` : null;
});

check('every weapon behaviour has a handler', () => {
  // The dispatch is a switch on `w.behaviour`. A weapon with a behaviour the
  // switch does not name simply never fires — no error, it just does nothing,
  // which is exactly how the katana would have shipped without its case.
  const sw = /switch \(w\.behaviour\) \{([\s\S]*?)\n {6}\}/.exec(engine);
  if (!sw) return 'could not find the behaviour switch';
  const handled = new Set([...sw[1].matchAll(/case '(\w+)'/g)].map((m) => m[1]));
  const used = new Set(Object.values(data.WEAPONS || {}).map((w) => w.behaviour).filter(Boolean));
  const dead = [...used].filter((b) => !handled.has(b));
  return dead.length
    ? `weapons declare behaviours nothing handles: ${dead.join(', ')}`
    : null;
});

check('every rune stat is read by the engine', () => {
  // Runes apply through `result[rune.stat]`, so a stat nothing consumes is a
  // rune that does nothing — the same shape as the 16 dead card flags.
  const runes = read('game/runes.js');
  const pool = [...runes.matchAll(/stat:\s*'(\w+)'/g)].map((m) => m[1]);
  const dead = [...new Set(pool)].filter((s) => !reads(s));
  return dead.length ? `rune stats nothing reads: ${dead.join(', ')}` : null;
});

check('every daily reward points at something real', () => {
  // A chest day with a wrong id resolves to undefined, pays nothing, and still
  // consumes the streak day — the player is silently robbed on the day they
  // were most looking forward to. Caught exactly this while adding days 8-14.
  const ext = data.DAILY_REWARDS ? data : null;
  const rewards = (ext && ext.DAILY_REWARDS) || dailyRewards;
  const chestIds = new Set((chests || []).map((c) => c.id));
  const bad = rewards
    .filter((d) => d.type === 'chest' && !chestIds.has(d.chestId))
    .map((d) => `D${d.day} -> ${d.chestId}`);
  if (bad.length) return `days pointing at a chest that does not exist: ${bad.join(', ')}`;
  const noAmount = rewards
    .filter((d) => d.type !== 'chest' && !(d.amount > 0))
    .map((d) => `D${d.day} (${d.type})`);
  return noAmount.length ? `days that pay nothing: ${noAmount.join(', ')}` : null;
});

check('every quest destination lands somewhere in pathGo', () => {
  // `go:` is the "take me there" button. A value the switch does not name is
  // a button that does nothing — the player taps it, the panel does not open,
  // and there is no error to explain why. Camp.jsx says the switch is
  // "exhaustive by construction"; this is what makes that true rather than
  // aspirational, and it is the guard for the destination added alongside the
  // START WEAPONS selector.
  const camp = read('components/Camp.jsx');
  const sw = /const pathGo = \(dest\) => \{\s*switch \(dest\) \{([\s\S]*?)\n {4}\}/.exec(camp);
  if (!sw) return 'could not find the pathGo switch';
  const handled = new Set([...sw[1].matchAll(/case '(\w+)'/g)].map((m) => m[1]));
  const named = new Set([
    ...quests.STORY_QUESTS, ...quests.CAMP_QUESTS, ...(PATH_STEPS || []),
  ].map((q) => q && q.go).filter(Boolean));
  const dead = [...named].filter((d) => !handled.has(d));
  return dead.length
    ? `"take me there" buttons that go nowhere: ${dead.join(', ')}`
    : null;
});

check('the start weapon a run opens with is resolved, not hardcoded', () => {
  // The katana quest asks the player to carry the blade into a run. For years
  // GameScreen hardcoded ['hydropistol'], so the quest asked for something the
  // game did not allow — an uncompletable quest, invisible to every test
  // because the quest itself was well-formed. Both ends are checked: the
  // selector writes the field, and the run reads it through the shared
  // resolver rather than a second copy of the rules.
  const gs = read('components/GameScreen.jsx');
  if (/startWeapons:.*\['hydropistol'\]\s*,/.test(gs)) {
    return 'GameScreen still hardcodes the start weapon';
  }
  if (!/resolveStartWeapon\(save\)/.test(gs)) {
    return 'GameScreen does not resolve the start weapon from the save';
  }
  const smith = read('components/Weaponsmith.jsx');
  if (!/startWeapon:\s*id/.test(smith)) {
    return 'the Weaponsmith never writes save.startWeapon';
  }
  if (!/resolveStartWeapon\(save\)/.test(smith)) {
    return 'the Weaponsmith highlights a pick using its own rules, not the shared resolver';
  }
  // And the resolver must actually refuse a stranger, or the engine gets an id
  // WEAPONS has no entry for and throws in snapshot() every frame.
  const r = ext2.resolveStartWeapon;
  if (r({ startWeapon: 'not_a_weapon' }) !== 'hydropistol') return 'resolver accepts an unknown id';
  if (r({ startWeapon: 'twinSMG' }) !== 'hydropistol') return 'resolver accepts an un-crafted starter';
  if (r({ startWeapon: 'katana' }) !== 'katana') return 'resolver rejects the katana, which costs no shards';
  if (r({ startWeapon: 'twinSMG', craftedWeapons: { twinSMG: true } }) !== 'twinSMG') {
    return 'resolver rejects a crafted starter';
  }
  return r({}) === 'hydropistol' ? null : 'a fresh save does not default to the pistol';
});

check('the currency row and reward payouts use drawn icons, not emoji', () => {
  // Timmy's standing rule: no emoji anywhere. They render differently on every
  // phone, cannot take a tone, and two pairs of them were genuinely
  // indistinguishable at chip size (gems vs char pieces, slot coins vs gacha
  // tokens), so the banner did not tell you what you had.
  //
  // Scoped to the two places currency is SHOWN — the banner row and the
  // level-up payout list — because those are the ones a player reads as a set
  // and compares against each other.
  // Comments are stripped first. A note explaining WHICH emoji were removed
  // is not a shipped emoji, and a guard that cannot tell the difference makes
  // the codebase harder to document — which is the opposite of the point.
  const campRaw = read('components/Camp.jsx');
  const camp = campRaw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  const bad = [];

  // Class LIST, not an exact class name. The row gained a second class
  // (`cp-cur`) when it became a grid, and this guard went red on a cosmetic
  // change that had nothing to do with what it protects. A guard must follow
  // the code, not the spelling of one attribute.
  const row = /<div className="camp-currency-row[^"]*">([\s\S]*?)<\/div>\s*\n\s*<button/.exec(camp);
  if (!row) return 'could not find the currency row';
  for (const line of row[1].split('\n')) {
    if (EMOJI.test(line)) bad.push(`banner: ${line.trim().slice(0, 60)}`);
  }

  const rewards = /const out = \[([\s\S]*?)\]\.filter/.exec(camp);
  if (!rewards) return 'could not find the level-up reward list';
  for (const line of rewards[1].split('\n')) {
    if (EMOJI.test(line)) bad.push(`reward: ${line.trim().slice(0, 60)}`);
  }

  // And every id they DO name must resolve to a real glyph, or it silently
  // renders as a pistol.
  const icons = read('components/GameIcon.jsx');
  const glyphs = new Set([...icons.matchAll(/^ {2}([a-zA-Z0-9_]+):\s*\(u\)/gm)].map(m => m[1]));
  const map = /export const ICONS = \{([\s\S]*?)\n\};/.exec(icons);
  const reg = new Map([...map[1].matchAll(/(\w+):\s*\['(\w+)'/g)].map(m => [m[1], m[2]]));
  for (const m of camp.matchAll(/name="(cur_\w+)"/g)) {
    if (!reg.has(m[1])) bad.push(`Camp uses icon "${m[1]}" that ICONS does not define`);
    else if (!glyphs.has(reg.get(m[1]))) bad.push(`"${m[1]}" maps to glyph "${reg.get(m[1])}" which does not exist`);
  }
  for (const m of rewards[1].matchAll(/icon: '(\w+)'/g)) {
    if (!reg.has(m[1])) bad.push(`reward icon "${m[1]}" is not in ICONS`);
  }

  return bad.length ? `${bad.length} problem(s):\n    ${bad.join('\n    ')}` : null;
});

check('every weapon gets upgrade tracks that suit it', () => {
  // Two failures live here, and neither throws.
  //
  // 1. A per-weapon name override keyed to a weapon that does not exist is
  //    never read. Five were dead when this was written — `runeBolts` and
  //    `scythe` were plain typos of `runebolts` and `bloodscythe`, so those
  //    weapons were MEANT to have tailored names and silently got generic
  //    ones instead.
  // 2. A weapon offered a track it has no use for. Every weapon used to be
  //    sold the same six upgrades, so the katana had an Extended Magazine and
  //    AP Bullets, and a beam had a Barrel Length.
  const bad = [];
  for (const id of Object.keys(ext.WEAPON_PART_OVERRIDES || {})) {
    if (!data.WEAPONS[id] && !/_legacy$/.test(id)) bad.push(`override "${id}" names no weapon`);
  }
  for (const [id, w] of Object.entries(data.WEAPONS || {})) {
    const { tracks } = ext.weaponTracks(id, w);
    if (!tracks.length) { bad.push(`${id} offers no upgrades at all`); continue; }
    const hasMag = !!(w.base && w.base.magazine);
    const countsUnits = ['orbit', 'drone', 'meteor'].includes(w.behaviour);
    if (tracks.includes('magazine') && !hasMag && !countsUnits) {
      bad.push(`${id} (${w.behaviour}) offers a magazine but carries no rounds`);
    }
    if (w.behaviour === 'melee' && tracks.includes('bullets')) {
      bad.push(`${id} is melee and is being sold ammunition`);
    }
    // Every track must resolve to a real name, or the row renders blank.
    for (const t of tracks) {
      const info = ext.trackInfo(id, w, t);
      if (!info.name || !info.icon) bad.push(`${id}/${t} has no name or icon`);
    }
  }
  return bad.length ? `${bad.length} problem(s):\n    ${bad.join('\n    ')}` : null;
});

check('no panel hand-rolls its own drawing of the character', () => {
  // heroShape.js opens with "ONE SOURCE OF TRUTH" because the in-game hero and
  // the paperdoll had drifted into two unrelated drawings. The Character panel
  // and the intro were then each written with a third and fourth drawing, and
  // drifted the same way — the intro showed a plain blue blob with no cigar,
  // no headband and a different body curve, so the scene that introduces the
  // character was the one place that did not show him. Timmy found it by
  // looking; nothing else could have.
  //
  // The rule: outside the renderer and the shared figure, no component draws a
  // teardrop body of its own. A body path is recognisable — it is a `d=` that
  // sweeps out and back to a single point.
  const ALLOWED = new Set(['HeroFigure.jsx', 'GearPanel.jsx']);
  const dir = path.join(SRC, 'components');
  const offenders = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jsx') || ALLOWED.has(f)) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // The two shapes a hand-drawn drop takes here: an explicit cubic teardrop,
    // or the arc-bottomed variant the panel used.
    for (const m of src.matchAll(/d="M\s*(-?[\d.]+)[ ,](-?[\d.]+)\s*C([^"]*)"/g)) {
      const [, , , body] = m;
      const d = m[0];
      // Size is what separates a hero body from an icon glyph. MetaFeatures'
      // eye badge is a two-curve path too, but it lives in a 16-unit viewBox —
      // every coordinate in it is under 15. A drop is drawn at 90+ units.
      const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((n) => Math.abs(+n[0]));
      const span = Math.max(...nums, 0);
      if (span < 30) continue;
      // ...and CLOSED. The rule this guard states in its own words is "a `d=`
      // that sweeps out and back to a single point" — a teardrop is a filled
      // silhouette, so it always closes, explicitly with Z or implicitly by
      // ending where it began. An open stroke that wanders off and stops is a
      // line, not a body.
      //
      // Added because CampFrame.jsx's vines are exactly that: long cubic
      // strokes with fill="none", eleven of which tripped this on sight.
      // Exempting the file by name was the cheap fix and would have blinded the
      // guard there forever; tightening what "a body" MEANS keeps it watching
      // every file, that one included.
      const sx = +m[1], sy = +m[2];
      const pts = [...body.matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/g)];
      const last = pts[pts.length - 1];
      const closesBack = !!last && Math.hypot(+last[1] - sx, +last[2] - sy) <= 10;
      if (!/[Zz]\s*$/.test(body.trim()) && !closesBack) continue;
      if (/A\s*[\d.]+\s+[\d.]+/.test(body) || (body.match(/C/g) || []).length >= 1) {
        offenders.push(`${f}: ${d.slice(0, 46)}…`);
      }
    }
  }
  return offenders.length
    ? `components drawing their own hero body instead of using <HeroFigure>:\n    ${offenders.join('\n    ')}`
    : null;
});

check('every artifact affix stat is read by the engine', () => {
  const arts = read('game/artifacts.js');
  const pool = [...arts.matchAll(/stat:\s*'(\w+)'/g)].map((m) => m[1]);
  const dead = [...new Set(pool)].filter((s) => !reads(s));
  return dead.length ? `artifact stats nothing reads: ${dead.join(', ')}` : null;
});

check('a card only promises an evolution that exists', () => {
  // Thirty weapons carry `evolve: true` on their final level-up and have no
  // entry in WEAPON_EVO_MAP. That is fine — it marks the end of the track —
  // but the level-up card must not therefore claim "EVOLVE!", show the
  // evolution badge and get promoted to epic, which is what it did until the
  // card name was keyed on the flag alone.
  //
  // The guard is on the engine, not the data: the honest condition is that
  // every place deciding "is this an evolution" resolves WEAPON_EVO_MAP first.
  const eng = read('game/engine.js');
  const bad = [];
  if (!/const hasEvo = !!\(upg\?\.evolve && evoDef\)/.test(eng)) {
    bad.push('card generation no longer derives hasEvo from a resolved evo target');
  }
  if (/isEvolve: !!\(upg && upg\.evolve\)/.test(eng)) {
    bad.push('isEvolve is back to keying on the flag alone');
  }
  if (/name: def\.name \+ \(upg\?\.evolve \? ` — EVOLVE!/.test(eng)) {
    bad.push('card name promises EVOLVE from the flag alone');
  }
  return bad.length ? bad.join('; ') : null;
});

check('every weapon evolution is reachable end to end', () => {
  // The chain is skill tree -> save.skills.poe_awk0 -> card shop EVOLUTIONS
  // pull -> save.unlockedEvos -> WEAPON_EVO_MAP. A break anywhere shows up in
  // game as an evolution that can never be obtained, which is invisible until
  // someone plays far enough to notice it never appears.
  const data = read('game/data.js');
  const ext2 = read('game/data_ext2.js');
  const icons = read('components/GameIcon.jsx');
  const wblock = /export const WEAPONS = \{([\s\S]*?)\n\};/.exec(data)[1];
  const evos = [...wblock.matchAll(/^  (\w+): \{([\s\S]*?)^  \},/gm)]
    .filter((m) => /isEvo:\s*true/.test(m[2]))
    .map((m) => ({ id: m[1], from: (/evoFrom:\s*'(\w+)'/.exec(m[2]) || [])[1] }));
  const shop = [...ext2.matchAll(/unlockEvo:\s*'(\w+)'/g)].map((m) => m[1]);
  const bad = [];
  if (!evos.length) bad.push('no evolved weapons found at all');
  for (const e of evos) {
    if (!e.from) bad.push(`${e.id}: isEvo with no evoFrom`);
    else if (!shop.includes(e.from)) bad.push(`${e.id}: nothing in the card shop unlocks it`);
    if (!new RegExp(`\\n  ${e.id}:\\s*\\[`).test(icons)) bad.push(`${e.id}: no card art`);
  }
  return bad.length ? bad.join('; ') : null;
});

check('every level-up card has its own art', () => {
  // Twenty-one passive cards had no ICONS entry, so GameIcon fell through to
  // its `pistol` fallback and sixteen of them drew a water pistol on the
  // level-up screen. Nothing threw and nothing logged — it just looked wrong
  // until someone happened to be offered that exact card.
  //
  // Checked at the CONSUMER end: every flag and every stat that can appear on
  // a card must resolve to a glyph that actually exists.
  const ext2 = read('game/data_ext2.js');
  const data = read('game/data.js');
  const gi = read('components/GameIcon.jsx');
  const reg = {};
  for (const m of (/export const ICONS = \{([\s\S]*?)\n\};/.exec(gi)[1])
    .matchAll(/(\w+):\s*\['(\w+)'/g)) reg[m[1]] = m[2];
  const glyphs = new Set(
    [...gi.matchAll(/^ {2}([a-zA-Z0-9_]+): \(u\) => \(<>/gm)].map((m) => m[1]),
  );

  const adv = /export const ADVANCED_CARDS = \[([\s\S]*?)\n\];/.exec(ext2)[1];
  const flags = [...new Set([...adv.matchAll(/flag:\s*'(\w+)'/g)].map((m) => m[1]))];
  const statBlock = /export const STAT_CARDS = \[([\s\S]*?)\n\];/.exec(data)[1];
  const stats = [...new Set([...statBlock.matchAll(/stat:\s*'(\w+)'/g)].map((m) => m[1]))];

  const bad = [];
  for (const id of [...flags, ...stats]) {
    if (!reg[id]) bad.push(`${id} (falls back to the pistol)`);
    else if (!glyphs.has(reg[id])) bad.push(`${id} -> ${reg[id]} (glyph does not exist)`);
  }
  return bad.length ? `${bad.length} cards without art: ${bad.slice(0, 8).join(', ')}` : null;
});

console.log(`\nwiring.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
