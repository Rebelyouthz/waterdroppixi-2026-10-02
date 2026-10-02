# MENU SUPERPOLISH — living handoff (read this + POLISH-PASS tail)

Timmy 2026-09-20: keep running sessions until camp/menus are done, then he
will name the next thing. **Update this file every slice.** Do not stack a
new CSS design on `overhaul.css` — grep the selector, edit the block that
already exists. In-game lighting stays custom (`waterdrop-lighting`), never
`GlowFilter`. Visible UI stays English.

## Snabb / Fast

Do **not** skip MEMORY, POLISH-PASS, skills, or consumer-tracing to go
faster. That is the expensive failure on this project (one redone scene ≈
20% of his month). Throughput between screens is fine; skimmed analysis is
not. If Cursor Fast starts skimming, tell him to turn it off.

## Done this run (2026-09-20)

1. Cursor / English / Attributes — `waterCursor.js`, milestone+daily English,
   attr spend respects Agility/Aim max. No fourth `.camp-attr-panel`.
2. **Profile Level-Up** (`LevelUpOverlay` in `Camp.jsx` + `game/profileLevelUp.js`)
   - Collect is `collectPendingLevelUp` (functional save). Stale snapshot is gone.
   - `applyReward` now credits `pieces` / `shards` / `freeSpin`.
   - Rank jump 19→25 lists Bronze Ring **and** Ember, not only the last rank.
   - Streak copy is **1.5×** (the table), not the old lying 2×. No star emoji.
   - ClaimFx on CLAIM. Enter/Escape skip-or-collect.
   - Next-rank tease always (what unlocks, how many levels).
   - Tile plate + card band edited **in place** from leftover crimson → teal.
   - Do **not** append another `.lu-card` / `.lu-overlay` block.
3. **Character** (`CharacterPanel.jsx`)
   - Level / evolve are functional `setSave`. ClaimFx on buy.
   - NOW → NEXT preview. Bonus rows are tracks, not a flat list.
   - No fourth `.char-panel`. New selectors only: `.char-preview`,
     `.char-bonus-row`, `.char-rar-tick`.
4. **Lucky wheel / Card Shop** (`Welcome.jsx` + `CampPanels.jsx` CardShopModal)
   - Daily wheel: `applyReward` + `SPIN_JACKPOT`, one `const target`,
     `.spin-stage.spinning` so the pointer flap actually runs, teal slices.
   - Shop: `shopCardCost` (was a dead 500), owned-filter, pity after 8,
     section-complete gold consolation, `applyShopPull` functional save,
     ClaimFx, `reelTick`, unmount cleanup. No third `.cs-jackpot-banner`.
   - `unlockedActives` DEFAULT is `{}`; loadSave migrates arrays.
   - Tests: `test/shopPull.test.mjs` (5).
5. **Gear / paperdoll** (`GearPanel.jsx` + `game/gear.js`)
   - Level button now uses `gearCanLevel` / `gearLevelPayment` (slot parts
     first). It used to disable whenever generic `gearParts` was low.
   - Salvage replaces silent DISCARD: pays slot scrap, unequips, drops the
     rune map for that item id. ClaimFx on salvage and level.
   - Compare-to-worn (Diablo-style UP/DOWN/SWAP). Only claims UP when the
     primary stat matches. Inventory sorted best → worst.
   - Per-slot part counters visible. Functional `setSave` on equip/level/
     merge/gacha. CLOSE not ✕. GearGlyph never dumps a raw icon string.
   - **Did not** append another `.gear-tab`. New CSS lives in `index.css`
     next to `.gear-parts-bar`: `.gear-slot-parts`, `.gear-cmp*`,
     `.gear-socket-pip`.
   - Tests: gear.test 32 (was 28).
6. **Maps / storyline (started)** (`MapsPanel` + `DifficultyPicker`)
   - Pulse CSS `.map-node.available` was dead — JSX never set the class.
     Takeable nodes now get `available`; locked use `.locked` (the CSS
     that existed), not `node-locked`.
   - Gold/SP are GameIcons. CLEARED/DONE/START/INTRO in English. Connector
     is a bar, not ▼. Difficulty pick is functional `setSave`.
   - Did **not** fake a parchment continent (POLISH-PASS session 3).
7. **Skill tree** (`SkillTree.jsx` + `game/skillMoves.js` + Camp banner)
   - Dash comic is a story mission: English SHIFT / left-stick / i-frames.
     **GOT IT is gone** — it used to mark the lesson seen without buying Dash.
     Off-path buys are denied (`BUY SHADOW DASH FIRST` + `skillDenied`).
   - After the skills-tab UNLOCKED banner (and the rest of that cascade),
     the tree auto-opens if Dash is not owned.
   - Real moves (Dash, Blink, Phoenix, Dual Guns, …) fire the same camp
     UNLOCKED plate + logo. Chance passives are **not** in `SKILL_MOVES`.
   - Locked nodes darker, takeable nodes brighter halo + ready ring.
     Live veins no longer use `filter="url(#poe-glow)"`.
   - Button clip: overflow visible on close/fit/dash/buy/desel. No third
     `.poe-overlay` / `.poe-node-ready`.
   - Tests: `skillMoves.test.mjs` 4, juice 23.
8. **Talents** (`TalentTree.jsx` + `talents.js` ceremonies + `meleeCombo.js` RIB_FORMS)
   - Combos are **taught** in this screen, not sold as a 46th buyable flag.
     The COMBOS column is already 15 engine-read behaviours. Snapped Rib
     L/H strings (TEAR / GIRDER / HOOK / RIPOSTE / CYCLONE / RISE) live in
     the school strip. Cyclone lights when you own Blur; Rise when you own
     Chain Reaction. `talents.test` still locks the tree at 45.
   - Inspect-first: tile click opens the sheet (colour + logo + text).
     LEARN in the sheet buys. Instant-buy on the tile is gone.
   - Side step numbers stay on phone. Header TP meter vs `TALENT_TOTAL_COST`.
   - Glass circular plates: prong 64 / spine 92 / keystone 108. Locked
     darker, takeable halo. Hay-fork wires. Functional `setSave`.
   - Keystone/move talents fire Camp UNLOCKED via `talentCeremonyOf` +
     `onMoveUnlock` (Hydro / Apex / UNBROKEN / Orbit / Rain / Flood).
   - Sounds: existing `Audio.skillHover` / `skillBuy` / `unlockReveal` /
     `click`. ElevenLabs MCP here is speech (`creative_generate_speech`)
     and costs credits — not used for UI SFX.
   - In-place `.tt3-*` edits. No clip-path on `.tt3-tile` / `.tt3-plate`.
     No third `.tt3-overlay` / `.tt3-rib-forms`.
   - Tests: talents 11, meleeCombo 6, juice 23, layout 11, wiring 24, icons 12.
9. **Combo school nodes** (`game/comboSchool.js` + TalentTree rail)
   - Six LARGE skippable nodes on the left of the hay-fork (steps 2/5/8/11/13/15).
     Costs 1, 2, 3, 4, 5, 6 Combo Points. Never TP. Never a 46th talent.
     Buying one unlocks that form in the school strip (school starts empty).
   - Light/Heavy always swing. HOOK/RIPOSTE/CYCLONE/RISE need the school node.
     Cyclone still needs Blur; Rise still needs Chain Reaction.
   - Combo Points pay **once** from: 8 story map finales, THE DRAIN first pipe
     + bottom, THE WELL 10k drops + first prestige, Base Defence waves 5 and 12,
     Star Atlas stages 1 and 3, TCG 1 and 5 wins, Exploration walk, Lootmine
     1 and 5 dives. `applyComboPointSources` in `settleProgression`.
   - Drain records `drainBestDepth` after each pipe (first map = 1).
   - Tests: `comboSchool.test.mjs` 7.

## NEXT — remaining camp/menu surfaces (in this order)

Grep `overhaul.css` for the selector before any edit. Fake radar is still
forbidden (those save fields do not exist).

| # | Surface | File | Notes |
|---|---------|------|--------|
| 1 | Lucky wheel / shop spins | done 2026-09-20 | |
| 2 | Gear / paperdoll | done 2026-09-20 | Do **not** append `.gear-tab`. |
| 3 | Maps / storyline node map | done 2026-09-20 | Pulse class wired. Do not fake parchment. |
| 4 | **Skill tree juice** | done 2026-09-20 | `SKILL_MOVES` banners, forced dash walk, no GOT IT skip. SVG materials, not GlowFilter. |
| 5 | **Talents visual** | done 2026-09-21 | School + inspect-first + orbs. Still 45. Combo nodes added same day. |
| 6 | **Pets shell** | `PetPanel.jsx` | Catch/breed loop is backlog — do not build a shell that blocks it. |
| 7 | **Achievements / Codex / Pass / Patrol / Daily** | done 2026-10-02 | Rank=node; WHAT'S ON strip; Shore Walk. Daily overlay already first-hour. |
| 8 | **Star Raid menus / Base Defence / TCG / Exploration / Clicker depth** | each screen | Do **not** start TCG-as-Gwent, Drain Dead Cells, or Slime Castle unprompted. |
| — | **Statistics charts** | Camp stats | LAST. Per-minute / damage-type fields are not in the save. Share bars from real fields only. |
| — | **Phase 2 HUD** | in-run | Standing POLISH-PASS "NEXT" but Timmy's current order is menus. |

## Next surface (2026-10-02 evening)

Camp-tab claims shipped (Achievements / Codex / Pass / Patrol + WHAT'S ON).
**Next is Pets shell** (`PetPanel.jsx`). Catch/breed loop is backlog — polish
the shell, do not invent a catch loop that blocks it. Grep `.pet-` in
overhaul before any CSS. Do **not** add a 46th talent.

## Do not

- Commit unless he asks.
- Chrome lock-poll (it hung this project).
- "Fix" `logic.test.mjs` 180s campaign-pacing.
- Add a 46th talent.
- Fake radar / invent save fields for charts.
- Fourth copy of `.camp-tab`, `.camp-attr-panel`, `.lu-card`, `.char-panel`, `.clk-shop`, `.gear-tab`, `.cs-jackpot-banner`.
- Rename THE WELL (clicker) or put `drain` in `CAMP_UNLOCK_BATCHES`.

## Verify for the last slices

`test/campClaims.test.mjs` (7), logic 45, wiring 24, juice 23, layout 11,
icons 12. Browser not clicked (lock-poll). Say so.

## Skills for the next surface (Pets)

`superpolish` → `game-ui-ux` → `waterdrop-svg-materials` →
`waterdrop-css-duplicate-blocks`. Catch/breed loop is backlog — polish the
shell, do not invent a catch loop that blocks it. Grep `.pet-` in overhaul
before any CSS. Do **not** add a 46th talent.
