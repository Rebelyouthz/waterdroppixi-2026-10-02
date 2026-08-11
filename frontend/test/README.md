# Offline harnesses

Plain Node scripts that import the real game modules and check the parts that
decide progression, balance and card presentation. No React, no canvas, no
browser — which is the point: these are the pieces that are wrong silently,
where a bug looks like a game that is merely badly tuned.

```sh
cd frontend
node --import ./test/resolver-register.mjs test/logic.test.mjs
node --import ./test/resolver-register.mjs test/cards.test.mjs
node --import ./test/resolver-register.mjs test/stag.mjs
node --import ./test/resolver-register.mjs test/sim.mjs
```

Or all the assertion-style ones at once: `npm run test:logic`.

| File | What it proves |
|---|---|
| `logic.test.mjs` | Difficulty gating, badge award/equip rules, the quest chain, campaign pacing, plus a regression per code-review finding (30 checks) |
| `cards.test.mjs` | Level-up card text and the before→after row: no doubled signs, multiplier stats read from their 1.0 base, reload/cooldown gains colour as gains (12 checks) |
| `stag.mjs` | Anti-AFK. Prints the stagnation value for eight movement patterns; sprinting and circle-strafing must stay at 0.00 |
| `sim.mjs` | XP curve and boss pacing — prints the level/time table rather than asserting, since the target is a feel judgement |

`resolver.mjs` exists because the app uses webpack-style extensionless imports
(`from './data'`) that Node's ESM resolver rejects. The hook retries with `.js`
appended. `resolver-register.mjs` installs it.

Anything importing `pixiRenderer`, `audio`, or a React component will not run
here — those need a DOM. Keep the logic that matters in modules that don't.
