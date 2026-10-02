# THE DRAIN — hangar hatch, Dead Cells descent, unique survivor reward

Written 2026-09-18 so the next session can drop the Dead Cells-like minigame
into a hole that already exists, without renaming the clicker, without a
second gear system, and without a door that opens nothing.

Timmy named it **THE DRAIN**. One session used THE SHAFT as a working title
because the clicker already owns THE WELL. That name is gone. Code id is
`drain`. Saves with `base.shaft` / `shaftRuns` migrate on load.

---

## 0. DO NOT RENAME THE CLICKER

**THE WELL already exists.** It is the idle clicker.

| thing | code id | camp label | where |
|---|---|---|---|
| Idle clicker | building `well` / save.clicker | **THE WELL** | Reclamation door in the Main Hall, camp tab |
| Dead Cells descent | building `drain` | **THE DRAIN** (banner sub: THE GRATE UNDER THE HANGAR) | Hatch in the **hangar floor** |

If he later insists the descent is called The Well, **rename the clicker tab
to RECLAMATION** (that is already the building name). Do not give both the
same string.

---

## 1. What is already wired (do not rebuild)

Walk this path before writing a line of the descent:

1. Repair station → buy **The Hull** → buy **Hangar** at the southern door
   in the Main Hall (`STATIONS` id `hangar` in `game/stationLayout.js`).
2. Using that door no longer jumps to Star Raid. It opens **`HangarRoom.jsx`**,
   a walkable bay next door (WASD / tap, E to use, Esc back to the hall).
3. Inside the hangar:
   - **THE SHIP** (right) → existing `StarRaidScreen` (`onStarRaid`)
   - **TURRET BAY** (left) → existing `BaseDefenceScreen` (`onDefence`)
     — that minigame is still the unfinished #38; the bay is the home, not a
     rewrite of the defender.
   - **THE DRAIN** (floor grate, centre-rear) → buy building `drain`, then
     `DrainScreen.jsx`
   - **MAIN HALL** (pressure door you came through) → back to `StationRoom`
4. First time `drain` is installed, Camp queues the big unlock banner via
   `queueUnlocks(['drain'])`. `CAMP_TAB_META.drain` is `{ label: 'THE DRAIN',
   icon: 'ui_hatch', sub: 'THE GRATE UNDER THE HANGAR' }`. It is **not** in
   `CAMP_UNLOCK_BATCHES` — adding it there would fire the banner on any third
   building level, not on the hatch.
5. Unique reward: **MUTATIONS** (`game/mutations.js`). Stub clears unlock:
   - first: `mut_marrow` / Marrow Rush — engine `.mutMarrow` stretches dash
   - second: `mut_film` / Coolant Film — engine `.mutFilm` adds armor
   Equipped id is `save.mutationLoadout`. `GameScreen.buildMetaEffects`
   merges `buildMutationFlags(save)` into the **same** `flags` bag talents
   use. Do not pay mutations from chests, the skill tree, or a campaign node.

Files:

```
game/hangarLayout.js      floor plan (pixi-free, tested)
game/hangarBitmaps.js     camp floor tileset + hangar-door sheet, Image()
game/drain.js             story, costs, payout, stub-run rules
game/mutations.js         unique survivor reward; engine-consumed flags
components/HangarRoom.jsx walkable hangar (canvas 2d, hall sprites + hardcode)
components/DrainScreen.jsx  SHELL + stub descent. REPLACE THE RUN, KEEP THE SHELL.
docs/THE-DRAIN.md         this file
test/station.test.mjs     hangar stations + drain routing
test/mutations.test.mjs   flags reach the engine; payouts land
```

Camp.jsx `enterBuilding`:

- `hangar` → `setHangarOpen(true)`  (was: `onStarRaid()` — that was the skip)
- `drain`  → hangar stays mounted, `setDrainOpen(true)`
- Star Raid still lives on the camp tab `starraid` and on the ship station

### How the hangar is drawn

Same method as the Main Hall, different surface:

- Hall = Pixi + camp sprite sheets + hardcoded drop (`heroHalfPoints`).
- Hangar = **canvas 2d** (no second live Pixi app) + the **same** camp
  sheets (`station-floor-tileset-2x.png`, `camp-station-hangar-16.png`) +
  hardcoded bay / dusty ship / turret rack / hatch / drop.

The hall wreck/restored paintings are the Main Hall lounge. Do not paste
them into the hangar — wrong composition. Hall unmounts while HangarRoom
is open.

---

## 2. Where Claude puts the Dead Cells game

**Replace the body of `DrainScreen.jsx`'s run view, or swap
`game/drainRun.js` in once it exists. Do not replace:**

- `HangarRoom.jsx` (how you get here)
- building id `drain` / `tryBuyBuilding(save, 'drain')`
- `queueUnlocks(['drain'])`
- `applyDrainPayout` / `unlockMutation`
- `buildMutationFlags` → `run.stats.flags`
- the hatch station in `hangarLayout.js`

The stub run is three pipes of tap-to-clear coolant. It exists so the hatch
is not a dead door while the real descent is missing. Delete the stub the
moment the real loop can pay `applyDrainPayout`.

Suggested shape when you drop it in:

```
components/DrainScreen.jsx     shell: hatch open, story plate, pause, rewards
game/drainRun.js               NEW: the Dead Cells-like loop (rooms, weapons,
                               elites, boss). Pixi v8. Lighting mandate applies
                               if this is a game/ Pixi surface — load
                               waterdrop-lighting, no GlowFilter.
```

Genre analog: Dead Cells **Toxic Sewers** (pipes, poison, hatch/ram rune).
This game's name is still THE DRAIN. Waterdrop twist: it smells like the
lake, mutations are drunk not looted.

Return to HangarRoom on death and on clear. Same rule as the survivor loop:
**the hangar is home**. Do not dump the player on the camp tab rail.

---

## 3. Story (canon, fits STORY-BIBLE.md)

The hangar is the scout's cargo deck, still under a tarp. Under the deck
plates is a **marrow well** the Greys used as a coolant overflow — and, one
layer down, an Anunnaki receiver the same shape as Stonehenge's (Act
interlude). A.I.D.A. calls it a drain. She is not wrong about the word.
She wants a crystal from the bottom for the transmitter she is assembling
in the station.

The Waterdrop goes down because it smells like the lake.

That is why the unique reward is **marrow mutations** (the drop drinks what
is down there) and not another gold faucet. Gold / SP / TP still drip from a
clear so the mode is not a charity run, but the thing you **must** come here
for is a mutation slot.

A.I.D.A. line (already in `aidaDialogue.js` as `quest_drain_hint`):
the grate is a coolant drain, ignore the singing.

Plant visually: a cable the player never asked for, running from the open
hatch toward the Main Hall core. Same transmitter twist as every other module.

---

## 4. Progression beat (same map, many times)

Timmy: you should have to run the same map several times before you clear it,
because you grow on death.

THE DRAIN sits **after the hangar**, which already gates MAPS / Endless.
Recommended order, do not skip:

1. First run(s) → repair → hull → gold for the next module
2. Hangar buy → MAPS open, hangar door opens, ship still dusty
3. Walk in. Ship / turrets usable. Hatch still bolted.
4. Buy the hatch (gold + parts). Banner. Descent available.
5. Die in THE DRAIN. Come back stronger (mutations, a little SP/TP).
6. Same survivor maps still need repeats — THE DRAIN is a side pipe, not a
   skip for pond_1.

Do **not** gate the first campaign node on THE DRAIN. The first hour is
still hall → build → gather.

---

## 5. Unique reward contract (do not invent a second copy)

| minigame | unique to main game | unique to itself |
|---|---|---|
| Star Raid | artifacts | ship upgrades |
| Clicker (THE WELL) | milestone gold/gems/runes | Springs / buildings |
| Prospector | gated level-up cards | dive depth |
| TCG / pets | companion combat | the board |
| Base Defence (#38, unfinished) | turret parts for the hull (planned) | merge-towers |
| **THE DRAIN** | **mutations** (`save.mutationsUnlocked` + `save.mutationLoadout`) | marrow / depth / rooms |

A mutation is one equipped flag, like a talent, not a percent-per-level track.
`test/talents.test.mjs` is the pattern: if you add a mutation flag, the engine
must read `.flagName` as a property. Add a check in `test/mutations.test.mjs`
the same day, not later.

Do not store mutations in `save.talent`, `save.skills`, or `save.gearInventory`.
Those already have owners.

---

## 6. What would break if you "just add a tab"

- Putting `drain` in `CAMP_UNLOCK_BATCHES` fires the banner on any Nth
  building level. The hatch would "unlock" while still bolted.
- Counting `drain` in `totalBuildingLevels` does the same by the back door:
  unscrewing the grate would tick the camp-tab clock. It is excluded there
  on purpose. HangarRoom still queues `queueUnlocks(['drain'])`.
- Routing the hall hangar door back to `onStarRaid` undoes this hook. Star
  Raid launches from the **ship station** now.
- A new Pixi Application inside HangarRoom while StationRoom is still mounted
  is two live Pixi apps. Camp unmounts the hall when the hangar opens.
- Adding a building without a station in HALL ∪ HANGAR fails
  `station.test.mjs` ("every buildable module is present as a door").
- A mutation flag the engine never reads is the dead-config bug. Wire the
  consumer first.
- `.camp-unlock-banner` must stay above the hangar overlay (z-index 4200 vs
  `.sr-overlay` 2600 / `.drain-overlay` 2800) or THE DRAIN Unlocked is
  painted behind the bay and never seen.

---

## 7. Controls / verify

- Hall hangar door, built: ENTER → dusty bay, tarp ship, turret rack, bolted
  grate.
- Esc / MAIN HALL: back in the Main Hall, not the camp rail.
- Buy the grate: bolts unscrew, banner **THE DRAIN**, then DESCEND.
- Stub clear 1: mutation Marrow Rush, next survivor dash is longer.
- Stub clear 2: mutation Coolant Film, next survivor hits land softer.
- Camp tab STAR RAID still opens the shmup. Camp tab THE WELL still opens
  the clicker.

No Chrome lock-poll. One walk-through at the end.

---

## 8. Base Defence and the ship (not this drop)

The turret bay and the ship are **homes**, not finished games.

- Ship restore visuals / hangar levels already buff Star Raid via
  `raidHullMult`. Deeper ship-building is #33 / #40.
- Base Defence is #38. `BaseDefenceScreen.jsx` already exists. Hangar turret
  bay is the door. Do not start the Slime-Castle rewrite from this hatch work.

Timmy said everything should have flow and do its part, no rush. The hangar
is the room that makes those two (and THE DRAIN) physically adjacent, which
is the piece that was missing.
