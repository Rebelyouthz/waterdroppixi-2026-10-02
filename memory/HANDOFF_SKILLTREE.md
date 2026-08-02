# HANDOFF — POE2 Skill Tree Implementation
_Skriven innan context-compaction — läs denna FÖRST_

## VAD SOM SKA BYGGAS
En POE2-stil Skill Tree som ersätter nuvarande `/app/frontend/src/components/SkillTree.jsx`.

### Design-krav (från användaren)
- **SVG pan+zoom canvas** — drag för att flytta, scroll/pinch för att zooma
- **Bottom-to-top layout** — trädet klättrar uppåt, startnoder längst ner
- **Step-by-step unlock** — köpa en nod öppnar nästa uppåt (kedja)
- **Click-to-preview** — klick visar panel med skill-info + BUY-knapp (köper ej direkt)
- **8 kategorier** med egna vertikala banor (branches)
- **Super/Keystone nodes** längre upp i trädet (stora noder, kraftfulla passiver)
- **Attribute nodes** i centrum (ATK, DEX, VIT, MOB, INT, Elemental, Magic)
- **Pet-gren** — uppgradera husdjurs-stats i trädet
- **Meta Unlock Gates** — meta-uppgraderingar i Camp.jsx låses tills rätt träd-nod är köpt

### Kategorierna (8 branches)
1. **COMBAT** (röd `#ff3146`) — ATK, pierce, projectile
2. **MOBILITY** (teal `#4dffd4`) — speed, dash, dodge
3. **DEFENSE** (gul `#ffd166`) — HP, armor, regen, shield
4. **GREED** (guld `#ffd700`) — gold, xp, pickup, luck
5. **ARCANE** (lila `#b362ff`) — crit, critdmg, area, atk speed
6. **BLOODLINE** (rosa `#ff6b9d`) — charRarity bonuses, lifesteal, berserk
7. **VOID** (blå `#4dc4ff`) — elemental, void burst, boss dmg
8. **PETS** (grön `#51cf66`) — pet dmg, pet HP, pet speed, pet harvest

## FILER SOM SKA ÄNDRAS

### 1. `/app/frontend/src/game/poe_tree.js` (NY FIL)
Exporterar:
- `POE_TREE` — objekt med 8 kategorier, varje med `nodes[]`
- `POE_ATTRIBUTES` — 7 attributnoder (ATK/DEX/VIT/MOB/INT/ELE/MAG)
- `META_UNLOCK_REQS` — mapping: meta-ID → required skill node ID
- `ATTR_EFFECTS` — vad varje attributpoäng ger

### 2. `/app/frontend/src/components/SkillTree.jsx` (ERSÄTTS HELT)
- SVG canvas med pan (mousedown+drag) och zoom (wheel, 0.3x–3x)
- Render: SVG lines, nod-cirklar (storlek baserat på typ: minor/notable/keystone)
- Klick på nod → `selectedNode` state → preview panel slide-in
- Preview panel: ikon, namn, beskrivning, pips-display, kostnad, BUY-knapp
- Greyed-out + lås-ikon om `req`-nod inte är köpt

### 3. `/app/frontend/src/components/Camp.jsx` (uppdatera Meta-fliken)
- Importera `META_UNLOCK_REQS` från `poe_tree.js`
- Om `META_UNLOCK_REQS[upg.id]` finns och `save.skills[reqId]` < 1 → locked
- Visa gråtonnad card med hänglås + "Lås upp: [skill namn]"

## TREE-LAYOUT (koordinater för SVG)
Trädet är 1800px brett × 2400px högt (viewBox).
- Kategorier placeras horisontellt (9 kolumner à 200px)
- Varje kategori-branch går vertikalt, med noder på Y: 2200, 1900, 1600, 1300, 1000, 700, 400
- Attribute-noder centrerade runt X=900, Y=1200 (mitten av trädet)
- Keystones/super skills högst upp Y=100-200 per kategori

## NODE-TYPER
- **minor** (r=22px) — vanliga stat-noder, max 3 nivåer
- **notable** (r=32px) — starkare stats, max 1 nivå, kostar mer SP
- **keystone** (r=45px) — unikt passiv, max 1 nivå, mycket dyrt
- **attribute** (r=28px, hexagonal) — investera attributpoäng

## KOSTNADS-SYSTEM
- Minor: 1 SP/nivå
- Notable: 3 SP
- Keystone: 8 SP
- Attribute: 2 SP

## META UNLOCK MAPPING (META_UNLOCK_REQS)
```js
{
  m_superCrit:  'sk_crit',      // kräver Sharp Eye
  m_megaCrit:   'sk_critd',     // kräver Critical Will
  m_revive:     'sk_revive',    // kräver Phoenix
  m_zoom:       'sk_area',      // kräver Wider Wake
  m_dodge:      'sk_dodge',     // kräver Phasing
  m_regen:      'sk_regen',     // kräver Regrowth
  m_start:      'sk_chest',     // kräver Chest Sense
}
```

## TEKNISK APPROACH
```jsx
// Pan/Zoom state
const [viewBox, setViewBox] = useState({ x: 0, y: 0, scale: 1 });

// SVG med transform
<svg viewBox="0 0 1800 2400" 
     style={{ transform: `scale(${scale}) translate(${panX}px, ${panY}px)` }}>
  {/* lines */}
  {/* nodes */}
</svg>

// Node data
{ id, name, icon, type, x, y, req, max, costPerLvl, stat, amount, desc, category }
```

## IMPLEMENTATION ORDER
1. Skapa `poe_tree.js` med alla 64+ noder + koordinater
2. Rewrite `SkillTree.jsx` med SVG canvas + pan/zoom
3. Uppdatera `Camp.jsx` Meta-fliken med lock gates
4. Testa med testing-agent

## SAVE-FORMAT (kompatibelt med befintligt)
`save.skills` används redan — POE tree skriver till samma nyckel.
`save.sp` är befintlig valuta.
Attributpoäng: `save.attrPoints` (nytt, 0 default), `save.attrs` (nytt objekt).

## AKTUELLA TEST-CREDENTIALS
Se `/app/memory/test_credentials.md`

## VIKTIGT
- Svara på SVENSKA till användaren
- Backend rör ej (ingen server.py-ändring behövs)
- Behåll befintlig `SKILL_TREE` i `data_ext.js` för bakåtkompatibilitet
- `SkillTree.jsx` importerar från `poe_tree.js` istället
