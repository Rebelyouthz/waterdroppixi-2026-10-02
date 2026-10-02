/* Profile level-up payout + rank unlocks.
 * Injected faults: collect from a stale snapshot, unlocks keyed on final
 * rank only, streak copy still claiming 2× when the table is 1.5×. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPendingLevelUp, collectPendingLevelUp, rankUnlocksBetween, nextRankPrize, rewardTiles } from '../src/game/profileLevelUp.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const camp = fs.readFileSync(path.join(ROOT, 'components', 'Camp.jsx'), 'utf8');
const char = fs.readFileSync(path.join(ROOT, 'components', 'CharacterPanel.jsx'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('collect is additive on a live snapshot, not the closed-over save', () => {
  const save = {
    gold: 100, sp: 2, gems: 0, slotCoins: 0, talentPoints: 1, freeShopSpins: 0,
    character: { rarity: 'common', level: 0, pieces: 3, shards: 1 },
    profile: { level: 8, xp: 10 },
    pendingLevelUp: {
      level: 8, fromLevel: 7, gold: 50, sp: 1, talentPoints: 1,
      gems: 0, slotCoins: 0, pieces: 4, shards: 0, freeSpin: true,
    },
  };
  const out = collectPendingLevelUp(save);
  if (out.gold !== 150) return `gold ${out.gold} — collect is not additive`;
  if (out.sp !== 3) return `sp ${out.sp}`;
  if (out.talentPoints !== 2) return `tp ${out.talentPoints}`;
  if (out.character.pieces !== 7) return `pieces ${out.character.pieces} dropped`;
  if (out.freeShopSpins !== 1) return 'free spin was not credited';
  if (out.pendingLevelUp) return 'pendingLevelUp was not cleared';
  if (save.gold !== 100) return 'collect mutated the caller save';
  if (!/collectPendingLevelUp/.test(camp)) return 'Camp overlay does not use collectPendingLevelUp';
  if (/setSave\(\{[\s\S]*pendingLevelUp: null/.test(camp)) return 'Camp still collects from a stale snapshot';
});

check('rank jump lists every prize in the span, not only the last rank', () => {
  const mid = rankUnlocksBetween(19, 25);
  const names = mid.map((u) => u.name);
  if (!names.includes('Bronze Ring')) return `19→25 missed Bronze Ring (rank 5): ${names.join(', ')}`;
  if (!names.includes('Ember')) return `19→25 missed Ember ship (rank 6): ${names.join(', ')}`;
  if (rankUnlocksBetween(20, 21).length) return 'same-rank span should be empty';
});

check('next rank tease and tiles have no emoji / no 2x streak lie', () => {
  const n = nextRankPrize(5);
  if (!n || n.rank !== 2) return `next after lv 5 should be rank 2, got ${JSON.stringify(n)}`;
  const tiles = rewardTiles({ gold: 10, freeSpin: true, talentPoints: 0 });
  if (!tiles.some((t) => t.key === 'spin' && t.amount === 1)) return 'free spin tile is missing or still amount-null';
  if (/[★✦✓]/.test(camp) && /lu-overlay/.test(camp)) {
    const overlay = camp.slice(camp.indexOf('function LevelUpOverlay'));
    if (/[★✦]/.test(overlay)) return 'overlay still prints star/diamond emoji';
  }
  if (/2× STREAK|2x STREAK/.test(camp)) return 'streak copy still claims 2×; the table is 1.5×';
  if (!/1\.5× STREAK/.test(camp)) return '1.5× streak copy missing';
});

check('Character spend is functional and ClaimFx fires', () => {
  if (!/setSave\(\(s\) =>/.test(char)) return 'Character level/evolve still writes a stale snapshot';
  if (!/fireClaimFx/.test(char)) return 'Character buy is silent (no ClaimFx)';
  if (!/char-preview/.test(char)) return 'before/after preview missing';
  if (/LEVEL UP — ★/.test(char)) return 'Character LEVEL UP still uses a star emoji';
});

check('applyPendingLevelUp mutates only the copy it is given', () => {
  const save = {
    gold: 0, character: { rarity: 'common', level: 0, pieces: 0, shards: 0 },
    pendingLevelUp: { gold: 20, pieces: 2, shards: 3, talentPoints: 1 },
    talentPoints: 0,
  };
  applyPendingLevelUp(save);
  if (save.gold !== 20 || save.character.pieces !== 2 || save.character.shards !== 3) {
    return 'in-place apply missed a currency';
  }
});

if (fails.length) {
  console.error(`profileLevelUp.test FAIL ${fails.length}  pass ${pass}\n` + fails.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log(`profileLevelUp.test ok  ${pass} checks`);
