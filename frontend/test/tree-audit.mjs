// Full skill-tree audit. Timmy: "kolla så alla skills nodes verkligen
// funkar å gör rätt sak osv så inget e fel i hela trädet".
//
// Lives in test/ rather than in a scratchpad on purpose: this answers
// "is any node in the tree dead?", and the tree gets edited often.
//   node --import ./test/resolver-register.mjs test/tree-audit.mjs
//
// Written as a FILE, not `node -e`. The first attempt was inline and bash
// quoting mangled the regex backslashes, which reported 36 of 38 stats as
// dead. A tool that lies confidently is worse than no tool at all.
//
// The chain every node depends on:
//   node.stat → POE_INDEX → buildMetaEffects writes result[stat]
//             → engine reads this.meta.<stat> → a run.stats field
//             → engine reads that field somewhere
// Break any link and the node buys, lights up, and does nothing.
import fs from 'fs';
import path from 'path';
import { POE_TREE_NODES, POE_H2O_NODES, POE_INDEX } from '../src/game/poe_tree.js';

const SRC = path.join(process.cwd(), 'src');
const engine = fs.readFileSync(path.join(SRC, 'game/engine.js'), 'utf8');
const gs = fs.readFileSync(path.join(SRC, 'components/GameScreen.jsx'), 'utf8');

const all = [...POE_TREE_NODES, ...POE_H2O_NODES];
const problems = [];
const note = (kind, msg) => problems.push({ kind, msg });

// ── 1. structural integrity ────────────────────────────────────────
const ids = new Set();
for (const n of all) {
  if (ids.has(n.id)) note('DUPLICATE ID', n.id);
  ids.add(n.id);
  if (!n.name) note('NO NAME', n.id);
  if (!n.desc) note('NO DESC', n.id);
  if (!n.icon) note('NO ICON', n.id);
  if (!n.stat) note('NO STAT', `${n.id} (${n.name})`);
  if (n.max == null || n.max < 1) note('BAD MAX', `${n.id} max=${n.max}`);
  if (n.c == null || n.c < 0) note('BAD COST', `${n.id} c=${n.c}`);
  if (n.val == null) note('NO VAL', `${n.id} (${n.name}) stat=${n.stat}`);
  if (!POE_INDEX[n.id]) note('NOT IN POE_INDEX', `${n.id} — buildMetaEffects will never see it`);
}

// ── 2. requirement graph ───────────────────────────────────────────
for (const n of all) {
  for (const r of (n.req || [])) {
    if (!ids.has(r)) note('BROKEN REQ', `${n.id} requires "${r}" which does not exist`);
  }
}
// Reachable = no reqs, or every req is itself reachable. An unreachable
// node is unbuyable content: it renders, and can never be purchased.
const reachable = new Set();
let changed = true;
while (changed) {
  changed = false;
  for (const n of all) {
    if (reachable.has(n.id)) continue;
    const reqs = n.req || [];
    if (reqs.length === 0 || reqs.every(r => reachable.has(r))) { reachable.add(n.id); changed = true; }
  }
}
for (const n of all) {
  if (!reachable.has(n.id)) note('UNREACHABLE', `${n.id} (${n.name}) can never be unlocked`);
}

// ── 3. is each stat actually consumed? ─────────────────────────────
const boolMatch = gs.match(/BOOLEAN_STATS = new Set\(\[([^\]]*)\]/);
const BOOL = new Set((boolMatch?.[1] || '').split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean));

const byStat = {};
for (const n of all) (byStat[n.stat] = byStat[n.stat] || []).push(n.id);

const wired = [], dead = [];
for (const [stat, nodeIds] of Object.entries(byStat)) {
  const metaRead = new RegExp('this\\.meta\\.' + stat + '\\b').test(engine);
  // maxHp and chestSense are buildMetaEffects' two special cases: one adds
  // into result.maxHp, the other sets a flag. Neither appears as
  // `this.meta.<name>` in the engine, and both are genuinely live.
  const special = stat === 'maxHp' || stat === 'chestSense';
  (metaRead || special ? wired : dead).push({ stat, nodeIds, isBool: BOOL.has(stat) });
}
for (const d of dead) {
  note('STAT NOT READ BY ENGINE', `${d.stat} — ${d.nodeIds.length} node(s): ${d.nodeIds.join(', ')}`);
}

// ── 3b. does the run.stats FIELD get read, or only written? ────────
// Check 3 only proves the value reaches `run.stats`. That is one link
// short: the engine renames on the way in (`this.meta.dmg` becomes
// `damageMult`, `this.meta.proj` becomes `projBonus`), and a field that is
// seeded but never read afterwards is exactly as dead as one that was
// never seeded — the m_projspd bug in this project's history was precisely
// that shape.
//
// So: find the run.stats field each meta key is assigned to, then confirm
// something reads it. Reads are counted as `s.field`, `rs.field`,
// `stats.field` or `r.stats.field`; the assignment line itself is excluded
// so a write cannot count as its own read.
for (const w of wired) {
  if (w.stat === 'maxHp' || w.stat === 'chestSense') continue;   // special-cased
  const assign = new RegExp('(\\w+)\\s*:\\s*[^,\\n]*this\\.meta\\.' + w.stat + '\\b').exec(engine);
  if (!assign) {
    note('SEEDED BUT UNNAMED', `${w.stat} — read from meta but not assigned to a run.stats field`);
    continue;
  }
  const field = assign[1];
  const readRe = new RegExp('(?:\\bs|\\brs|\\bstats|\\br\\.stats)\\.' + field + '\\b', 'g');
  const hits = (engine.match(readRe) || []).length;
  if (hits === 0) {
    note('FIELD NEVER READ',
      `${w.stat} → run.stats.${field} is seeded but nothing reads it (nodes: ${w.nodeIds.join(', ')})`);
  }
}

// ── 4. branch balance ──────────────────────────────────────────────
const perBranch = {};
for (const n of POE_TREE_NODES) perBranch[n.branch] = (perBranch[n.branch] || 0) + 1;
const sizes = Object.values(perBranch);
const spread = Math.max(...sizes) - Math.min(...sizes);
if (spread > 3) {
  note('BRANCH IMBALANCE',
    `largest branch has ${spread} more nodes than the smallest: ` +
    Object.entries(perBranch).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}:${v}`).join('  '));
}

// ── 5. warnings: real, but a design call rather than a break ───────
// Two nodes granting the same BOOLEAN stat means the second one is bought
// for nothing — the flag is already true. Not a broken node, so it does
// not fail the run; it is surfaced because nobody would ever notice it in
// play. They would just quietly waste the points.
const warnings = [];
for (const [stat, nodeIds] of Object.entries(byStat)) {
  if (!BOOL.has(stat) || nodeIds.length < 2) continue;
  const ns = nodeIds.map(id => all.find(n => n.id === id));
  warnings.push(
    `boolean stat "${stat}" is granted by ${ns.length} nodes — after the first, ` +
    `the rest cost SP and change nothing: ` +
    ns.map(n => `${n.id} (${n.name}, ${n.c} SP)`).join(' | '));
}

// ── report ─────────────────────────────────────────────────────────
console.log('NODES:', all.length, '| main:', POE_TREE_NODES.length, '| H2O:', POE_H2O_NODES.length);
console.log('DISTINCT STATS:', Object.keys(byStat).length,
            '| read by engine:', wired.length, '| unread:', dead.length);
console.log('BRANCH SIZES:',
  Object.entries(perBranch).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}:${v}`).join('  '));

if (warnings.length) {
  console.log('\ntree-audit WARNINGS (not failures — design calls for Timmy):');
  for (const w of warnings) console.log('   ! ' + w);
}

if (problems.length === 0) {
  console.log('\ntree-audit: OK — every node is structurally sound, reachable, and its stat is consumed.');
  process.exit(0);
}

console.log('\ntree-audit: ' + problems.length + ' PROBLEM(S)');
const grouped = {};
for (const p of problems) (grouped[p.kind] = grouped[p.kind] || []).push(p.msg);
for (const [kind, msgs] of Object.entries(grouped)) {
  console.log('\n  [' + kind + '] x' + msgs.length);
  for (const m of msgs) console.log('     ' + m);
}
process.exit(1);
