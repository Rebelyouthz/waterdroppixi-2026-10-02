# HANDOFF — Eye of Horus + Patrol + Achievement Rewards
_Skriven INNAN context-compaction_

## VAD SOM IMPLEMENTERADES SIST (✅ testat 100%)
- POE2 Skill Tree SVG, Meta Unlock Gates, Attribute System
- Equipment Paperdoll (7 slots, forge), Gear drops 8%/kill
- Season Pass 40 noder, Codex Library (enemies/weapons)
- Balans: HP+50-100%, Vampirism 0.1%, karaktär rarity ny krav

## VAD SOM IMPLEMENTERAS NU

### 1. Eye of Horus Notifikations-badge
- Liten SVG eye-ikon (svart öga, guldring) på Camp-tabs som har nytt innehåll
- Visas på: CODEX, SEASON PASS, PATROL (missions klara), ACHIEVEMENTS
- Beräknas i Camp.jsx vid render-tid, ingen extra state

### 2. Codex Discovery Claim (1 gem per ny discovery)
- Lägg till "CLAIM 💎" knapp i CodexPanel för varje odisclaimed discovery
- Track i `save.codex.claimedDiscoveries = []` (array av IDs)
- Ny ACHIEVEMENTS-tab i Codex (24 achievements)
- save.achievements.claimed = [] (array av achievement IDs som claimas)

### 3. Idle/Patrol System (ny PATROL tab)
- 4 typer: Scavenge (1h → 800 gold), Explore (2h → 5 gems), Hunt (3h → gear + xp), Void Raid (4h → 8 sp + 8 gems)
- Max 3 aktiva missions
- save.patrol.missions = [{ id, defId, startMs, durationMs, status }]
- Status: 'active' | 'complete' | 'claimed'
- Countdown timer uppdateras var 10e sekund
- Aktiv pet = +20% belöning
- Patrol ger notis (Eye of Horus badge) när mission klar

### 4. Weapon Tracking i Codex
- GameScreen.jsx: vid run-start, anropa save.codex.weapons tracking
- engine.js: redan har onCodexKill, lägg till onWeaponUsed callback

## FILER ATT ÄNDRA
1. `/app/frontend/src/components/MetaFeatures.jsx` — komplett omskrivning med PatrolPanel + CodexPanel uppdatering
2. `/app/frontend/src/components/Camp.jsx` — ny PATROL tab + Eye of Horus badges
3. `/app/frontend/src/store.js` — lägg till patrol, achievements i DEFAULT_SAVE
4. `/app/frontend/src/components/GameScreen.jsx` — weapon tracking vid run-start
5. `/app/frontend/src/index.css` — stilar för patrol, eye-badge

## SAVE FORMAT (tillägg)
- `save.patrol = { missions: [] }` — patrol missions
- `save.achievements = { claimed: [] }` — claimed achievement IDs
- `save.codex = { enemies:{}, weapons:{}, claimedDiscoveries:[] }` — update claimedDiscoveries

## NOTIFICATION LOGIC (Camp.jsx)
```
codexNew = discovered > claimedDiscoveries.length
passNew  = reachableNodes > claimedNodes  
patrolNew = any mission has status === 'complete'
achNew   = completedAchievements > claimedAchievements
```
