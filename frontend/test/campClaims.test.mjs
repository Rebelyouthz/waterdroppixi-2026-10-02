/* Camp claimables: season pass is rank, not leftover XP.
 * Injected faults: floor(xp/200) while addAccountXp wraps every rank;
 * claimed.length on { free, premium }; Codex class `unknown` vs CSS `undiscovered`. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  battlePassReachedNode, battlePassUnclaimedCount, normalizeBpClaimed,
  bpRewardBag, BP_NODE_COUNT, whatsOnSide, achievementsReady,
  patrolReadyCount, codexUnclaimedCount,
} from '../src/game/campClaims.js';
import { accountXpToNext } from '../src/game/data_ext.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('rank 10 leftover XP is not the clock', () => {
  const n = battlePassReachedNode({ profile: { level: 10, xp: 10 } });
  if (n !== 9) return `reachedNode was ${n}, expected 9`;
  const old = Math.floor(10 / 200);
  if (n === old) return 'rank formula collapsed to leftover XP (floor(xp/200))';
  if (accountXpToNext(1) === 200) return 'accountXpToNext(1) is still the dead 200';
  if (BP_NODE_COUNT !== 40) return `BP_NODE_COUNT is ${BP_NODE_COUNT}`;
});

check('unclaimed counts both tracks from rank, not claimed.length', () => {
  const save = {
    profile: { level: 5, xp: 3 },
    battlePass: { claimed: { free: [0], premium: [] } },
  };
  // Rank 5 opens nodes 0..4. Free missing 4, premium missing 5 = 9.
  if (battlePassUnclaimedCount(save) !== 9) {
    return `unclaimed was ${battlePassUnclaimedCount(save)}, expected 9`;
  }
  const flatLie = save.battlePass.claimed.length;
  if (typeof flatLie === 'number' && battlePassUnclaimedCount(save) === flatLie) {
    return 'still reading claimed.length as if the pass were a flat array';
  }
  const n = normalizeBpClaimed({ battlePass: { claimed: [0, 1] } });
  if (!n.free.includes(0) || n.premium.length !== 0) return 'array claimed did not migrate onto free';
});

check('bpRewardBag maps gem/slot/talent/shard onto applyReward keys', () => {
  if (bpRewardBag({ type: 'gem', amount: 12 }).gems !== 12) return 'gem bag missed gems';
  if (bpRewardBag({ type: 'slot', amount: 3 }).slotCoins !== 3) return 'slot bag missed slotCoins';
  if (bpRewardBag({ type: 'talent', amount: 5 }).talentPoints !== 5) return 'talent bag missed talentPoints';
  if (bpRewardBag({ type: 'shard', amount: 1 }).shards !== 1) return 'shard bag missed shards';
  if (Object.keys(bpRewardBag({ type: 'petEgg', amount: 1 })).length) return 'petEgg should stay special, not a currency bag';
});

check('WHAT\'S ON priority: ready ach → patrol → pass → codex → nearest', () => {
  const hull = {
    profile: { level: 1, xp: 0 },
    base: { hull: 1 },
    battlePass: { claimed: { free: [0], premium: [0] } },
  };
  const a = whatsOnSide(hull);
  if (!a || a.go !== 'achievements' || !a.ready) return `hull ready was ${JSON.stringify(a)}`;
  if (!achievementsReady(hull).some((x) => x.id === 'a_hull')) return 'a_hull did not fire on hullSealed';

  const patrolSave = {
    profile: { level: 1, xp: 0 },
    battlePass: { claimed: { free: [0], premium: [0] } },
    patrol: { missions: [{ id: 'p1', status: 'complete', defId: 'shore', startMs: 0, durationMs: 1 }] },
  };
  const p = whatsOnSide(patrolSave);
  if (!p || p.go !== 'patrol') return `patrol ready was ${JSON.stringify(p)}`;
  if (patrolReadyCount(patrolSave) !== 1) return 'patrolReadyCount missed complete';

  const passSave = { profile: { level: 2, xp: 0 }, battlePass: { claimed: { free: [], premium: [] } } };
  const bp = whatsOnSide(passSave);
  if (!bp || bp.go !== 'pass' || !bp.ready) return `pass ready was ${JSON.stringify(bp)}`;

  const cxSave = {
    profile: { level: 1, xp: 0 },
    battlePass: { claimed: { free: [0], premium: [0] } },
    codex: { enemies: { slime: { count: 1 } }, weapons: {}, claimedDiscoveries: [] },
  };
  const cx = whatsOnSide(cxSave);
  if (!cx || cx.go !== 'codex') return `codex ready was ${JSON.stringify(cx)}`;
  if (codexUnclaimedCount(cxSave) !== 1) return 'codexUnclaimedCount missed slime';

  const near = whatsOnSide({
    profile: { level: 1, xp: 0 },
    battlePass: { claimed: { free: [0], premium: [0] } },
    totalKills: 40,
    achClaimed: { a_first_kill: true },
  });
  if (!near || near.go !== 'achievements' || near.ready) return `nearest in-progress was ${JSON.stringify(near)}`;
  if (near.goal !== '40 / 100') return `nearest goal was ${near.goal}, expected Hundred 40/100`;
});

check('panels pay through applyReward and the pass is rank-gated', () => {
  const meta = read('components/MetaFeatures.jsx');
  if (/Math\.floor\(\s*(profileXp|save\.profile\?\.xp).*\/\s*200/.test(meta)) {
    return 'BattlePassPanel still uses floor(xp/200)';
  }
  if (/XP_PER_NODE/.test(meta)) return 'dead XP_PER_NODE is still in MetaFeatures';
  if (!/battlePassReachedNode/.test(meta)) return 'BattlePassPanel never reads battlePassReachedNode';
  if (!/applyReward\(ns, bpRewardBag/.test(meta)) return 'claimBpNode does not applyReward(bpRewardBag)';
  if (!/applyReward\(ns, bag\)/.test(meta)) return 'CLAIM ALL / patrol does not applyReward the bag';
  if (!/id: 'shore'/.test(meta) || !/3 \* 60 \* 1000/.test(meta)) return 'Shore Walk is missing';
  if (!/undiscovered/.test(meta)) return 'Codex still uses class unknown';
  if (/codex-entry-icon[^>]*>[●◉]/.test(meta) || />●</.test(meta) || />◉</.test(meta)) {
    return 'Codex still prints bullet glyphs';
  }
  if (!/data-testid="bp-claim-all"/.test(meta) || !/data-testid="codex-claim-all"/.test(meta)) {
    return 'CLAIM ALL missing on pass or codex';
  }
  if (!/>ABORT</.test(meta)) return 'patrol cancel is not ABORT';
});

check('Camp pathGo and WHAT\'S ON strip land on the four tabs', () => {
  const camp = read('components/Camp.jsx');
  if (!/case 'codex':/.test(camp) || !/case 'achievements':/.test(camp)) {
    return 'pathGo is missing codex/achievements';
  }
  if (!/WhatsOnStrip/.test(camp)) return 'Camp never mounts WhatsOnStrip';
  if (!/battlePassUnclaimedCount/.test(camp)) return 'PASS badge is not campClaims';
});

check('CSS: unknown/claimable/running are material, not opacity', () => {
  const overhaul = read('overhaul.css');
  const index = read('index.css');
  if (!/\.codex-entry\.locked,\s*\.codex-entry\.undiscovered,\s*\.codex-entry\.unknown/.test(overhaul)) {
    return 'overhaul never aliases .unknown onto the dashed undiscovered look';
  }
  if (!/\.bp-node\.next,\s*\.bp-node\.ready,\s*\.bp-node\.unclaimed,\s*\.bp-node\.claimable/.test(overhaul)) {
    return 'overhaul never aliases .claimable onto the lit node look';
  }
  if (!/\.patrol-def\.running/.test(overhaul)) return 'overhaul has no .patrol-def.running material';
  const unknownBlock = /\.codex-entry\.unknown\s*\{([^}]*)\}/.exec(index);
  if (unknownBlock && /opacity/.test(unknownBlock[1])) return 'index.css still fades .codex-entry.unknown';
  const claimedBlock = /\.bp-node\.claimed\s*\{([^}]*)\}/.exec(index);
  if (claimedBlock && /opacity/.test(claimedBlock[1])) return 'index.css still fades .bp-node.claimed';
  const runIdx = /\.patrol-def\.running\s*\{([^}]*)\}/.exec(index);
  if (runIdx && /opacity/.test(runIdx[1])) return 'index.css still fades .patrol-def.running';
});

console.log(`\n=== campClaims ${pass} passed, ${fails.length} failed ===`);
if (fails.length) {
  for (const f of fails) console.log('FAIL  ' + f);
  process.exit(1);
}
