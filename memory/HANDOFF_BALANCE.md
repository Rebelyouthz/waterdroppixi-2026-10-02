# HANDOFF — Balance + Paperdoll + Codex + Battle Pass
_Skriven innan context-compaction — läs DENNA FÖRST_

## ÄNDRINGAR GJORDA DENNA SESSION (klar)
- POE2 Skill Tree SVG (65 noder, 8 grenar, pan+zoom) ✅
- Meta Unlock Gates (7 meta-upgrades låsta) ✅  
- Attribute System (7 attribut, 1/profilnivå) ✅

## VAD SOM SKA IMPLEMENTERAS NU

### 1. SKILL TREE UX FIX (liten)
- Start-noder (req:[]) ska pulsera mer synligt
- Lägg till "▼ START" text under varje start-nod
- Initial kamera: visa start-noder tydligt
- Fil: `/app/frontend/src/components/SkillTree.jsx`

### 2. ENEMY BALANCE (data.js)
Fil: `/app/frontend/src/game/data.js` — ENEMIES objekt
- Regular enemies: HP × 1.5, dmg × 1.5
- Fast/small (bat, soulshard, lightningbug, nanoswarm): HP × 1.25, dmg × 1.4
- Bosses: HP × 2, dmg × 1.4
- Enemy projectile: engine.js line ~1136: `ep.dmg = t.dmg * 0.7` → `ep.dmg = t.dmg * 0.95`

### 3. VAMPIRISM FIX
- data_ext2.js line 247: `c_vamp` amount: 0.05 → 0.001 (0.1% lifesteal)
- engine.js line 1419: `dmg * 0.05` → `dmg * (s.vampireAmt || 0.001)`
- poe_tree.js META_UNLOCK_REQS: add `c_vamp: 'poe_bld0'` (need bloodline start)

### 4. IN-RUN STAT_CARDS reduce (data.js)
STAT_CARDS amounts:
- dmg: 0.10 → 0.05
- atks: 0.10 → 0.05  
- spd: 0.08 → 0.04
- crit: 0.05 → 0.03
- critdmg: 0.25 → 0.12
- area: 0.10 → 0.05
- pickup: 0.25 → 0.10
- regen: 0.4 → 0.2
- maxhp: 20 → 10
- heal: 30 → 15
- armor: 2 → 1

### 5. CHARACTER RARITY LEVELS (data_ext2.js)
CHAR_MAX_LEVELS:
- common: 3
- uncommon: 6
- rare: 10 (was 8), evolve cost: 2 shards
- epic: 15 (was 10), evolve cost: 3 shards
- legendary: 20 (was 12), evolve cost: 5 shards
- mythical: 25 (was 15)
CHAR_EVOLVE_COST update to match.

### 6. EQUIPMENT PAPERDOLL (P1 — new tab)
New file: `/app/frontend/src/game/gear.js` — item definitions
New component: `/app/frontend/src/components/GearPanel.jsx`
- 7 slots: helmet, chest, arms, legs, boots, ring, amulet
- Items drop: 8% chance per enemy kill in engine.js killEnemy()
- Merge: 3 identical (same slot + same rarity) → click merge = 1 item at +1 rarity
- stats: small flat bonuses (HP, DMG, armor, mspd, crit, etc.)
- Save: save.inventory[] & save.equipped{}
- Camp tab: "GEAR" (after Character tab)
- Applied to buildMetaEffects in GameScreen.jsx

### 7. CODEX LIBRARY (P2 — new tab)
New component: `/app/frontend/src/components/CodexPanel.jsx`
Tracks: enemies killed (first time), weapons used, cards collected, milestones done
- save.codex = { enemies:{}, weapons:{}, cards:{}, quests:{} }
- First discovery: reward (gems or gold) + lore entry
- Character evolution history logged here
- Camp tab: "CODEX"

### 8. BATTLE PASS GRID (P2 — new tab)
New component: `/app/frontend/src/components/BattlePassPanel.jsx`
- 40 reward nodes in a horizontal scrolling grid
- Based on profile XP
- Free track rewards: alternating gems/gold/slotCoins/talentPoints/shards
- Claim button per reached node
- save.battlePass = { claimed: [] }
- Camp tab: "PASS"

## FILES TO CHANGE
- `/app/frontend/src/game/data.js`: ENEMIES + STAT_CARDS
- `/app/frontend/src/game/data_ext2.js`: CHAR_MAX_LEVELS, CHAR_EVOLVE_COST, c_vamp amount
- `/app/frontend/src/game/engine.js`: ep.dmg formula, vampireAmt, killEnemy gear drop
- `/app/frontend/src/game/poe_tree.js`: META_UNLOCK_REQS add c_vamp
- `/app/frontend/src/components/SkillTree.jsx`: UX fixes
- `/app/frontend/src/components/Camp.jsx`: Add GEAR + CODEX + PASS tabs
- `/app/frontend/src/components/GameScreen.jsx`: Apply equipped gear in buildMetaEffects
- NEW: `/app/frontend/src/game/gear.js`
- NEW: `/app/frontend/src/components/GearPanel.jsx`
- NEW: `/app/frontend/src/components/CodexPanel.jsx`
- NEW: `/app/frontend/src/components/BattlePassPanel.jsx`

## SAVE FORMAT (add to DEFAULT_SAVE)
- `save.inventory`: already exists []
- `save.equipped`: already exists {}
- `save.codex`: { enemies:{}, weapons:{}, cards:{} } NEW
- `save.battlePass`: { claimed:[] } NEW

## TEST CREDENTIALS
See `/app/memory/test_credentials.md`

## CRITICAL NOTES
- User communicates in SWEDISH
- Engine.js is 2785 lines - be careful with edits
- Only use search_replace, never rewrite large files
- VAMPIRE fix: change `dmg * 0.05` to `dmg * (s.vampireAmt || 0.001)` 
  AND in buildMetaEffects: process c_vamp flag with dynamic amount from card's amount field
