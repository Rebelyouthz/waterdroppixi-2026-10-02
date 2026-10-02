/* Card shop pulls + daily wheel payout.
 * Injected faults: gold cost still 500, owned cards re-roll, collect from a
 * stale snapshot, Welcome wheel missing the spinning class. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHOP_CARD_POOL, shopCardCost, rollShopPull3, applyShopPull,
  isShopEntryOwned, shopSectionStats, nextShopDry, SHOP_PITY_AFTER, SHOP_COMPLETE_GOLD,
} from '../src/game/data_ext2.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const panels = fs.readFileSync(path.join(ROOT, 'components', 'CampPanels.jsx'), 'utf8');
const welcome = fs.readFileSync(path.join(ROOT, 'components', 'Welcome.jsx'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('shop gold cost is the escalating table, not a dead 500', () => {
  if (shopCardCost(0) !== 150) return `shopCardCost(0) is ${shopCardCost(0)}, expected 150`;
  if (shopCardCost(1) <= shopCardCost(0)) return 'cost does not escalate';
  if (!/shopCardCost/.test(panels)) return 'CardShopModal never reads shopCardCost';
  if (/goldFallbackCost|500 gold/.test(panels)) return 'flat 500 gold fallback is still in the shop';
});

check('owned cards are skipped; a full section pays consolation gold', () => {
  const passive = SHOP_CARD_POOL.filter((c) => c.category === 'passive');
  const save = { shopCards: passive.map((c) => c.effect.unlockCard), gold: 0 };
  if (shopSectionStats(save, 'passive').left !== 0) return 'section stats did not mark passive complete';
  const roll = rollShopPull3(0, 'passive', save);
  if (!roll.winner.complete) return 'full section still rolled a duplicate card';
  const out = applyShopPull(save, roll.winner, { goldCost: 150 });
  if (out.gold !== SHOP_COMPLETE_GOLD) return `complete paid ${out.gold}, expected ${SHOP_COMPLETE_GOLD} and no gold charge`;
  if (out.shopPulls) return 'complete still incremented shopPulls';
});

check('applyShopPull is additive and writes pity', () => {
  const card = SHOP_CARD_POOL.find((c) => c.effect.unlockWeapon);
  const save = { gold: 400, shopPulls: 0, shopDry: 3, unlockedWeapons: [] };
  const winner = { ...card, rarity: 'common', effect: card.effect };
  const out = applyShopPull(save, winner, { goldCost: shopCardCost(0) });
  if (out.gold !== 400 - 150) return `gold ${out.gold} after a 150 pull`;
  if (!out.unlockedWeapons.includes(card.effect.unlockWeapon)) return 'weapon unlock dropped';
  if (out.shopDry !== 4) return `shopDry ${out.shopDry} — pity did not climb on a common`;
  if (save.gold !== 400) return 'applyShopPull mutated the caller';
  if (nextShopDry(7, { rarity: 'rare' }) !== 0) return 'rare did not reset pity';
  if (SHOP_PITY_AFTER < 5) return 'pity window vanished';
});

check('Welcome wheel uses applyReward, spinning class, no star in jackpot copy', () => {
  if (!/applyReward\(ns, bag\)/.test(welcome)) return 'daily spin still writes currencies by hand';
  if (!/spin-stage\$\{spinning \? ' spinning'/.test(welcome)) {
    return 'spin-stage never gets the spinning class — pointer flap is dead CSS';
  }
  if (/1500★/.test(welcome)) return 'jackpot copy still uses a star emoji';
  if (!/SPIN_JACKPOT/.test(welcome)) return 'jackpot bag is still a second hardcoded 1500';
});

check('shop panel collect is live + ClaimFx', () => {
  if (!/applyShopPull/.test(panels)) return 'shop still assigns from a closed-over save';
  if (!/fireClaimFx/.test(panels)) return 'shop pull has no ClaimFx';
  if (!/isShopEntryOwned|shopSectionStats/.test(panels)) return 'owned filter is not shown in the shop UI';
});

if (fails.length) {
  console.error(`shopPull.test FAIL ${fails.length}  pass ${pass}\n` + fails.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log(`shopPull.test ok  ${pass} checks`);
