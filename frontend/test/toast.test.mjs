/* Toast once-keys + achievement family copy.
 *
 * Same toast was firing in a run and then again in camp because settle
 * re-pushed it. Milestone keys persist on the save; next tier of the same
 * metric is a different key and different kicker so it cannot look like
 * the first unlock looping.
 */
import { ACHIEVEMENTS, achievementToastCopy, achievementFamily } from '../src/game/data_ext2.js';
import { pushToast, resetToastBusForTests, hydrateToastSeen, subscribeToast } from '../src/game/toastBus.js';
import { settleProgression, rewardItems, normalizeRewardBag } from '../src/game/progression.js';

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try {
    const why = fn();
    if (why) fails.push(`${name}\n    ${why}`);
    else pass++;
  } catch (e) {
    fails.push(`${name}\n    threw: ${e.message}`);
  }
};

const heard = [];
resetToastBusForTests();
const stop = subscribeToast((t) => heard.push(t));

check('identical toasts within the window are dropped', () => {
  heard.length = 0;
  resetToastBusForTests();
  pushToast({ title: 'GEAR PARTS', text: 'GEAR PARTS' });
  pushToast({ title: 'GEAR PARTS', text: 'GEAR PARTS' });
  return heard.length === 1 ? null : `got ${heard.length} copies`;
});

check('once:true never repeats even with a different text', () => {
  heard.length = 0;
  resetToastBusForTests();
  pushToast({ key: 'ach:a_first_kill', once: true, title: 'First Blood', text: 'Kill 1 enemy' });
  pushToast({ key: 'ach:a_first_kill', once: true, title: 'First Blood', text: 'Kill 1 enemy AGAIN' });
  return heard.length === 1 ? null : `got ${heard.length}`;
});

check('hydrateToastSeen blocks a toast that already fired on this save', () => {
  heard.length = 0;
  resetToastBusForTests();
  hydrateToastSeen({ 'ach:a_kills_100': true });
  pushToast({ key: 'ach:a_kills_100', once: true, title: 'Hundred' });
  return heard.length === 0 ? null : 'hydrated key still toasted';
});

check('daily type/amount bags still produce claim chips', () => {
  const items = rewardItems({ type: 'gold', amount: 200 });
  if (!items.length) return 'empty items for {type:gold, amount:200}';
  if (items[0].key !== 'gold' || items[0].amount !== 200) return JSON.stringify(items);
  const bag = normalizeRewardBag({ type: 'gem', amount: 3 });
  if (bag.gems !== 3) return `gem alias -> ${JSON.stringify(bag)}`;
  return null;
});

check('first achievement in a family says UNLOCKED, not NEXT TIER', () => {
  const a = ACHIEVEMENTS.find(x => x.id === 'a_first_kill');
  const copy = achievementToastCopy(a);
  if (!/UNLOCKED/.test(copy.kicker)) return `kicker=${copy.kicker}`;
  if (/NEXT TIER/.test(copy.kicker)) return 'first tier looks like a repeat';
  return null;
});

check('the next kill achievement says it is the next tier', () => {
  const a = ACHIEVEMENTS.find(x => x.id === 'a_kills_100');
  const fam = achievementFamily(a);
  if (fam.length < 2) return 'kill family is not a chain';
  const copy = achievementToastCopy(a);
  if (!/NEXT TIER/.test(copy.kicker)) return `kicker=${copy.kicker}`;
  if (!/II/.test(copy.kicker)) return `expected II in ${copy.kicker}`;
  if (!/2 of /.test(copy.text)) return `text=${copy.text}`;
  return null;
});

check('a later kill achievement is III, not a first unlock', () => {
  const a = ACHIEVEMENTS.find(x => x.id === 'a_kills_1k');
  const copy = achievementToastCopy(a);
  if (!/NEXT TIER/.test(copy.kicker) || !/III/.test(copy.kicker)) return copy.kicker;
  return null;
});

check('existing saves do not dump already-earned achievement toasts', () => {
  heard.length = 0;
  resetToastBusForTests();
  const save = {
    toastsSeen: null,
    totalKills: 10000,
    badgesEarned: {},
    questsDone: {},
    diffCleared: {},
    skills: {},
    equippedActives: [],
    craftedWeapons: {},
    challengesDone: {},
    daily: {},
    mapProgress: {},
    profile: { level: 1, xp: 0 },
  };
  const ns = settleProgression(save);
  if (ns === save) return 'settle did not migrate toastsSeen';
  if (!ns.toastsSeen || !ns.toastsSeen['ach:a_first_kill']) return 'backfill missed First Blood';
  if (!ns.toastsSeen['ach:a_kills_100'] || !ns.toastsSeen['ach:a_kills_1k']) return 'backfill missed the chain';
  const achToasts = heard.filter(t => t.tone === 'achievement');
  if (achToasts.length) return `replayed ${achToasts.length} old achievements: ${achToasts.map(t => t.title).join(', ')}`;
  return null;
});

check('a newly reached next-tier achievement toasts once with NEXT TIER copy', () => {
  heard.length = 0;
  resetToastBusForTests();
  const save = {
    toastsSeen: { 'ach:a_first_kill': true },
    totalKills: 100,
    badgesEarned: {},
    questsDone: {},
    diffCleared: {},
    skills: {},
    equippedActives: [],
    craftedWeapons: {},
    challengesDone: {},
    daily: {},
    mapProgress: {},
    profile: { level: 1, xp: 0 },
  };
  const ns = settleProgression(save);
  const hundred = heard.find(t => t.key === 'ach:a_kills_100');
  if (!hundred) return `no Hundred toast (got ${heard.map(t => t.key).join(', ') || 'none'})`;
  if (!/NEXT TIER/.test(hundred.kicker || '')) return `kicker=${hundred.kicker}`;
  if (!ns.toastsSeen['ach:a_kills_100']) return 'did not persist the key';
  heard.length = 0;
  settleProgression(ns);
  if (heard.find(t => t.key === 'ach:a_kills_100')) return 'Hundred toasted a second time';
  return null;
});

stop && stop();

if (fails.length) {
  console.error(`toast.test.mjs: ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error('  FAIL', f);
  process.exit(1);
}
console.log(`toast.test.mjs: ${pass} passed`);
