// Every weapon must have its own icon.
//
// GameIcon falls back to `pistol` for any unmapped id, so a missing entry
// produces no error, no warning, and no visual clue beyond "this weapon looks
// like a handgun" — which is exactly how 21 of 38 weapons ended up drawing the
// same gun in the Weaponsmith without anyone noticing. One of them
// (`bloodscythe`) even HAD an entry; it was keyed `bloodScythe` and silently
// missed. This test is the thing that would have caught both.
//
// GameIcon.jsx is JSX, so it can't be imported here. The map is parsed out of
// the source instead — which also means the test verifies the file that
// actually ships rather than a copy.

import { readFileSync } from 'node:fs';
import { WEAPONS } from '../src/game/data.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : '')); }
};

const src = readFileSync(new URL('../src/components/GameIcon.jsx', import.meta.url), 'utf8');

// Glyph names: keys of GLYPHS plus anything added via Object.assign(GLYPHS, {...}).
const glyphNames = new Set();
{
  const start = src.indexOf('const GLYPHS = {');
  const seg = src.slice(start, src.indexOf('\nexport const ICONS'));
  for (const m of seg.matchAll(/^\s{2}([a-zA-Z_][a-zA-Z0-9_]*):\s*\(u\)\s*=>/gm)) glyphNames.add(m[1]);
}

// ICONS map: id -> [glyph, colour]
const icons = {};
{
  const start = src.indexOf('export const ICONS = {');
  const seg = src.slice(start, src.indexOf('\n};', start));
  for (const m of seg.matchAll(/^\s{2}([a-zA-Z_][a-zA-Z0-9_]*):\s*\[\s*'([^']+)'\s*,\s*'([^']+)'/gm)) {
    icons[m[1]] = { glyph: m[2], color: m[3] };
  }
}

console.log('\n=== parse ===');
ok(`found glyphs (${glyphNames.size})`, glyphNames.size >= 30, [...glyphNames].join(' '));
ok(`found icon entries (${Object.keys(icons).length})`, Object.keys(icons).length >= 38);

console.log('\n=== coverage ===');
{
  const weaponIds = Object.keys(WEAPONS);
  const missing = weaponIds.filter(id => !icons[id]);
  ok(`every one of the ${weaponIds.length} weapons has an icon entry`, missing.length === 0,
     'unmapped (these would all draw the fallback pistol): ' + missing.join(', '));

  const badGlyph = Object.entries(icons).filter(([, v]) => !glyphNames.has(v.glyph));
  ok('every icon entry points at a glyph that exists', badGlyph.length === 0,
     badGlyph.map(([k, v]) => `${k} -> ${v.glyph}`).join(', '));
}

console.log('\n=== distinctness ===');
{
  const weaponIds = Object.keys(WEAPONS);
  // Two weapons sharing a glyph AND a colour are visually identical. Evolved
  // weapons are allowed to share a glyph with their base (that is the point)
  // but must differ in colour.
  const seen = new Map();
  const clashes = [];
  for (const id of weaponIds) {
    const e = icons[id]; if (!e) continue;
    const key = e.glyph + '|' + e.color;
    if (seen.has(key)) clashes.push(`${seen.get(key)} == ${id} (${key})`);
    else seen.set(key, id);
  }
  ok('no two weapons render an identical glyph+colour', clashes.length === 0, clashes.join('\n       '));

  // The specific complaint: lots of weapons drawing the same shape.
  // Counted over BASE weapons only — an evolution reusing its base's
  // silhouette is the intended design (it is the same weapon, grown), so
  // including `_evo` ids here would flag the one case we deliberately want.
  const perGlyph = {};
  for (const id of weaponIds) {
    if (id.endsWith('_evo')) continue;
    const e = icons[id]; if (!e) continue;
    perGlyph[e.glyph] = (perGlyph[e.glyph] || 0) + 1;
  }
  const worst = Object.entries(perGlyph).sort((a, b) => b[1] - a[1])[0];
  ok(`no glyph is reused by more than 2 base weapons (worst: ${worst[0]} x${worst[1]})`, worst[1] <= 2,
     Object.entries(perGlyph).filter(([, n]) => n > 2).map(([g, n]) => `${g} x${n}`).join(', '));

  // And each evolution must actually differ from its base, or the pair is
  // indistinguishable in the rack.
  const evoSame = weaponIds.filter(id => id.endsWith('_evo'))
    .filter(id => { const b = icons[id.replace('_evo', '')], e = icons[id];
                    return b && e && b.color === e.color; });
  ok('every evolution differs in colour from its base', evoSame.length === 0, evoSame.join(', '));

  const pistolCount = perGlyph.pistol || 0;
  ok(`the fallback pistol is used by at most 2 weapons (was 21)`, pistolCount <= 2, 'pistol x' + pistolCount);
}

/* Gear base types carry an icon id each. GameIcon falls back to the pistol
 * glyph for any name it does not know, silently — so a base added without art
 * would ship looking like a handgun on a boot. */
console.log('\n=== gear base glyphs ===');
{
  const fsx = await import('node:fs');
  const iconSrc = fsx.readFileSync(new URL('../src/components/GameIcon.jsx', import.meta.url), 'utf8');
  const glyphs = new Set([...iconSrc.matchAll(/^ {2}([a-zA-Z0-9_]+):\s*\(u\)/gm)].map((m) => m[1]));

  const { GEAR_BASES, GEAR_SLOTS } = await import('../src/game/gear.js');
  const bases = Object.values(GEAR_BASES).flat();

  ok('every slot has five base types',
    GEAR_SLOTS.every((s) => (GEAR_BASES[s] || []).length === 5),
    GEAR_SLOTS.filter((s) => (GEAR_BASES[s] || []).length !== 5).join(', '));

  ok('there are 35 base types in total', bases.length === 35, `found ${bases.length}`);

  const missing = bases.filter((b) => !glyphs.has(b.icon)).map((b) => `${b.id} -> ${b.icon}`);
  ok('every gear base has a real glyph (no silent pistol fallback)',
    missing.length === 0, missing.join(', '));

  const ids = bases.map((b) => b.icon);
  ok('no two base types share a glyph', new Set(ids).size === ids.length,
    ids.filter((v, i) => ids.indexOf(v) !== i).join(', '));
}

console.log(`\n${pass} checks passed${fail ? `, ${fail} FAILED` : ''}.\n`);
process.exit(fail ? 1 : 0);
