# Waterdrop Survivor — plan for the new game modes

Written down here rather than left in chat so it survives between sessions.
Everything below is designed to feed **back into the run**: every mode has to
produce something that makes you stronger in-game, lets you push further in
endless, or gives a higher score. Nothing is a standalone toy.

## The reward economy (decide this first — everything else hangs off it)

Existing currencies: gold, gems, SP, talent points, slot coins, gacha tokens,
pet food, scrap (Star Raid).

Two new ones, and no more than that — a currency nobody can name is a currency
that does nothing:

| Currency | Source | Sink |
|---|---|---|
| **Cores** | Astro Prospector only | Unlocking unique level-up cards |
| **Flux** | Astro Prospector (rare) | Catalyst in the Forge merge, raises success odds |

Rule of thumb for what each mode pays out:

- **Star Raid** → scrap (ship upgrades), artifacts, runes
- **Patrol (idle)** → all standard currencies, equipment, runes, eggs
- **Waterdrop Clicker** → gold early, then gems, then the rarer currencies as
  total production crosses milestones
- **Astro Prospector** → Cores + Flux, and through Cores the unique cards
- **Forge** → consumes duplicates, produces rarity

Artifacts are equipped (3 slots, already built). Runes are the "gems" of this
game: socketed into manual weapons and into ring/amulet gear for stat bonuses
(already built). Both should now also drop as **prizes** from the modes above,
which is the main wiring job.

## 1. Idle tick foundation (build first — three features depend on it)

A single `tickIdle(save, nowMs)` in `store.js`, called on load and on an
interval while the app is open. Everything time-based accrues through it:
patrol missions, the incubator, clicker production.

- `save.lastTickMs` records the last settle.
- Offline accrual is **capped at 8 hours**. Uncapped offline income makes the
  active game pointless, and it also removes the incentive to fiddle with the
  device clock.
- Negative elapsed time (clock moved backwards) settles to zero rather than
  going negative.

## 2. Pet incubator

`save.incubator = { slots: [ { eggId, rarity, type, startMs, durMs, spentMs } ] }`

Two slots to start; more unlocked via base building.

Hatch times, per the spec: common 15m, uncommon 20m, rare 30m, epic 45m,
legendary 70m, mythical 100m. Ticks offline through `tickIdle`.

Speed-up: gems (cheap, small amounts) or gold (expensive, scales). Cost is a
function of remaining time, so a nearly-done egg is nearly free.

Hatching is the payoff moment: three taps to crack the shell, each with a
crack decal, shake and a burst, then the pet emerges.

## 3. Patrol — richer idle rewards, then encounters

Phase 1: broaden the reward table to all currencies plus equipment, runes and
eggs, weighted by mission tier and duration.

Phase 2: a patrol can run into enemies. Resolved as a small **card battle**
using your active pet and a deck of collected cards — closer to Gwent than to
a full TCG: one board, a few rounds, highest total wins the round. Winning
yields the loot; losing yields a fraction. This is the largest single feature
here and lands last.

## 4. Waterdrop Clicker

`save.clicker = { drops, totalDrops, upgrades: {}, lastTickMs }`

- Tapping the well yields `dropsPerClick`.
- Purchased structures yield `dropsPerSec`, accruing offline via `tickIdle`.
- **Drops are the clicker's internal currency** and buy its upgrades — they are
  not directly spendable elsewhere, or it becomes the only mode worth playing.
- Real payouts come from `totalDrops` **milestones**: gold first, then a gem,
  then slot coins, SP, gacha tokens, and finally runes. This is what makes it
  "the more you play it, the better the reward" without letting it outpace the
  game it is attached to.

## 5. Astro Prospector

A push-your-luck descent. You drop a probe and choose, layer by layer, whether
to bank the haul or dig deeper.

- Each layer rolls a node: ore (Cores), a relic (Flux or a card blueprint), or
  a hazard.
- Hazard chance rises with depth. Taking a hazard with no hull left ends the
  run and you lose the **unbanked** haul only.
- Probe upgrades (hull, drill, scanner, cargo) are bought with Cores.

Reward: **Cores**, and blueprints for **unique level-up cards** — deliberately
strong, build-defining cards that then enter the in-run card pool once
unlocked. That is the reason to play it: it is the only place those cards come
from.

## 6. Forge merge

Three identical items, not two — two is too easy and floods the top rarities.

- 3 of the same item and rarity → roll for one item of the next rarity.
- Success by target tier: uncommon 75%, rare 60%, epic 45%, legendary 30%,
  mythical 18%.
- On failure you lose 2 of the 3 and keep 1. Never lose everything: a total
  wipe on a 30% roll makes people stop using the system.
- **Flux** catalysts add +15% each, up to 3 (+45%), which is what makes the
  Prospector's rare drop worth chasing.

Applies to gear, artifacts and runes through one shared merge routine.

## 7. Base building

The camp becomes a place rather than a menu. Each building hosts a mode and
levels up for a passive bonus:

| Building | Hosts | Levelling gives |
|---|---|---|
| Hangar | Star Raid + Prospector ships | +ship stats, more loadout slots |
| Incubator | Pet eggs | more slots, faster hatch |
| Patrol Post | Patrol missions | more concurrent missions, better tables |
| Well | Waterdrop Clicker | +drops/sec |
| Forge | Merge + weaponsmith | +merge success |

Defence layer (later): waves periodically attack the base; placed turrets and
the buildings themselves defend it, and holding it out grants a run buff.

## 8. Star Raid ship roster

Multiple hulls with genuinely different feels rather than one ship with
sliders: an interceptor (fast, fragile, high fire rate), a gunship (balanced),
a hauler (slow, tanky, big magnet radius). Picked in the Hangar.

## Build order

1. Idle tick foundation
2. Pet incubator + hatching
3. Patrol reward tables
4. Forge 3-of-a-kind merge
5. Waterdrop Clicker
6. Astro Prospector + Cores + unique cards
7. Star Raid ship roster
8. Base building
9. Patrol card battles
