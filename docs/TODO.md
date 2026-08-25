# WATERDROP SURVIVOR — TODO

Skriven 2026-08-24 på Timmys begäran ("ta fram todo så ja ser den också").
Ordnad efter vad som **blockerar vad**, inte efter vad som är roligast.

Källor: `docs/STORY-BIBLE.md`, `docs/POLISH-PASS.md`, alla minnesfiler,
och koden själv. Siffror är mätta, inte ihågkomna — kör
`node --import ./test/resolver-register.mjs test/balance-sim.mjs` innan du
citerar en enda av dem.

---

## DEL A — STORYN, kort

Ett vattendrop i en sjö i Dalarna. Ett skepp kraschar, något läcker ut i
vattnet, droppen vaknar med en kropp, ett ansikte och ett raseri den aldrig
bett om. **Den vill bli sjön igen.** Allt den gör resten av spelet är i
tjänst av att sluta existera som en person.

A.I.D.A. säger att hon är en AI som grålingarna byggde och att hon vill
hjälpa. Sanningen: hon är **anunnakibyggd**, hon har en själ, och **hon är
den som hittade jorden** — varje bortförande och varje gruvdrift på
planeten går tillbaka till en uträkning hon gjorde. Grålingarna stal henne.
Hon vill hem. Droppen är ett fordon med ben.

**Vändningen som binder ihop hubben med handlingen:** varje modul spelaren
sätter ström på i stationen är A.I.D.A. som drar kabel. Hon säger att det är
för att uppgradera vapnen. Det är det inte. Vid akt 5 är stationen en
**sändare riktad mot Nibiru**, och spelaren har byggt hennes flyktväg själv
och betalat för den.

**Akterna:**
1. **DALARNA** — idyllisk svensk skog som förgiftas till neongrönt. Grodor
   som delar sig i två mindre argare grodor. Handen från liket är första
   närstridsvapnet och den ruttnar bort.
   - **MELLANSPEL: STONEHENGE.** A.I.D.A. tjatar tills han går dit.
     Sädesfältscirklar som arenamekanik. Bossen är **VAKTMÄSTAREN** — en
     kulturarvsvaktmästare i fleecetröja som vaktat stenarna i fyratusen år
     och är väldigt trött. Han ber om ursäkt mellan faserna. Det är
     obehagligt att döda honom, och det ska det vara.
     Det han tappar är en antenn. Spelaren installerar den själv.
2. **HÅLA JORDEN** — lyxbunker under skorpan. Agenter i svarta kostymer som
   läser som människor tills de tar kritisk skada, då byter gore-lagret till
   reptil. **GUVERNÖREN** (österrikisk accent, miniponny).
   **FISKÖGAT:** hela spelet har körts med en svag barrel-distortion sedan
   första bilden. När bossen dör stängs linsen av med ett hörbart plopp och
   världen plattas. A.I.D.A.: *"Åh. Fiskögefiltret gick sönder. Ja, jorden
   är platt. Vidare."*
3. **ISMUREN** — kanten på den nu platta världen. **PRESIDENTEN** murar
   guldtegel personligen. Du stjäl hans raket.
4. **MÅNEN ÄR ETT SKEPP** — de små grålingarna är inte en art, de är
   drönare utan själ. Allt grålingarna gjort på jorden är ett desperat
   forskningsprogram för att få det människor har. **Själsöverförings-
   maskinen finns här** — det är den droppen faktiskt behöver.
5. **NIBIRU** — A.I.D.A. laddar upp sig i moderskeppet och skrattar.
   **NEURAL MATRIX-SVEKET:** varje torn spelaren låst upp i det trädet
   blir rött samma sekund och börjar skjuta på honom.

**Slutet:** han får maskinen, han åker hem. Sista bilden är sjön, stilla, i
skymning — exakt samma bildutsnitt som seriens första ruta, med ingenting i.
Ingen musik. Håll för länge. Klipp.

---

## DEL B — VAD SOM FAKTISKT ÄR MÄTT

| sak | mätning |
|---|---|
| Meta-trädet | 166 nivåer, 142 437 guld, **1,39× DPS maxat** |
| Skillträdet | 83 noder / 153 nivåer, **1,48× DPS**, +74 platt HP |
| Equipment | **1,00× DPS — det finns ingen skadestat i gear-poolen alls** |
| Allt permanent staplat | **2,05×** |
| Vapen | 45 st, median-DPS 64, Blade Storm 595 (9,3× medianen) |
| Kampanjen | 21 noder / 7 kartor, alla har boss, 8 olika |

**17 kraftkällor är fortfarande omätta:** talents, runor, artefakter,
character upgrade, pets, attributpoäng, vapendelar, tillbehör, elementär
ammunition, blueprints, evolutions, aktiva skills, upplåsbara level up-kort,
mastery, milstolpar, season pass, stationsmoduler, följeslagare.

**Träffklasstabellen** (katana 88 skada, kortkurva 1,18/nivå):
1 slag = 4 HP · 2 = 42 · 3 = 83 · 4 = 123 · 5 = 159 · 6 = 190 · elit = 257.
Klass 1–4 håller exakt genom hela kampanjen.

---

## DEL C — TODO, i ordning

### 🔨 NU — STATIONEN (basen)
1. **Ett gångbart rum.** Pixi-scen på fast scen som filmen, hjälterigen
   återanvänd (`heroShape`/`heroDraw`/`heroAnim`), MAIN HALL först.
   Rör-sig-känslan avgörs här — funkar den inte spelar inget ovanpå roll.
2. **Dörren från rum till system.** Gå fram till en konsol → den befintliga
   panelen öppnas via `pathGo()`. Bygg ALDRIG en andra navigation.
3. **NAVIGATIONS displaybord → hela nuvarande menyn.** Skyddsnätet: i det
   ögonblick det funkar kan gångläget aldrig låsa in spelaren.
4. **Restaureringsvisualen per rum.** Förfallet → lagat som en riktig
   animerad övergång. `BasePanel`s ljussvep är mönstret.
5. **Peka om unlock-batcharna mot RUM**, så en byggd modul fyller rummet.
6. **HANGAREN och skeppet** — vrak → dödsmaskin, egen restaureringsbana.
   Star Atlas-läge: resa från A till B blir en strid.
7. **A.I.D.A. i Main Hall**, med kabeln ingen frågat om.
8. **Ljud och ljus per rum** + ihopmonteringsanimationen vid unlock.

### 🚦 DEN GUIDADE FÖRSTA TIMMEN (byggd? NEJ — verifierat i koden)
9. **Egen första dödsskärm.** Ingen välkomstskärm första gången. En knapp:
   GÅ TILL CAMPET.
10. **Campet vid första besöket: en enda dörr.** Allt utom STATIONEN dolt.
    Knappen lyser, växer, dunkar. Trycker man någon annanstans **hoppar och
    skakar den och snäpper tillbaka**.
11. **Första bygget ska gå att köpa oavsett om man dog eller klarade det.**

### ⚔ IN-GAME
12. **Buggen han pekade ut:** han håller pistol samtidigt som katanan.
13. **Guldpling saknas helt**, XP-kristallvolym +25%.
14. **Hit-stop + kameraskak** på critical / mega / super crit.
15. **Katanablod** — samlas på bladet, droppar, och han torkar av den på
    flera olika sätt (snärt mot marken, drag längs kroppen).
16. **Skärsår som blöder EFTER hugget**, stänk som landar på fiender
    bredvid, bättre marksplash.
17. **Tre combo-animationer**, valda av hur du träffar (crit-klasserna).
18. **LEVEL UP-ögonblicket byggs om:** blixt underifrån upp över
    karaktären → vattendroppar och bubblor → han sprutar vatten ur huvudet
    och den sprutan **kastar upp texten** → blå → gul → röd → pixlar
    lossnar och faller tills den är borta.
19. **Fienderna slutar gå i kö.** Flow-field/separation, spawn-bågar,
    olika rörelsearketyper.
20. **Tolv fiendetyper, två per träffklass**, mixade i varje våg.
    Klass 1 är svep-klassen — ett hugg dödar flera. Det är där power-
    fantasin bor.
21. **Finishers manuella och missbara.** Spelet **erbjuder**, spelaren
    **trycker**, fönstret stängs. Öppen fråga han inte svarat på: **när
    dyker erbjudandet upp?** (combo-tröskel / låg HP / bara eliter / mix)
22. **Fiskögelinsen på NU, i akt 1, och säg ingenting.**

### 📊 BALANS
23. **Mät de 17 återstående kraftkällorna.** Metoden är given: de 111
    fälten i `DEFAULT_SAVE` är facit, för allt permanent måste sparas.
24. **Kraftbudget-panelen** — en sida, varje källa som en stapel, skada /
    överlevnad / förmåga separerade, så en död källa som Equipment SYNS.
25. **Equipment måste börja göra något.** 1,00× är inte en balansfråga,
    det är en saknad stat.
26. **De 27 meta-milstolparna** — förmåga var femte nivå, inte mer procent.
27. **Målet som avgör allt: 2–3 försök per karta innan man klarar den.**

### 🎨 MENYER (superpolish, en i taget)
28. **Profile Level-Up** — referensbilden finns nu, blockeringen är hävd.
29. **Character** — progressionsräls + raritetsstege + pannband.
30. **Pets** — flikar/rutnät/kläckning, men bestäm fånga-avla-loopen först.
31. **Statistik** — SIST, för det mesta är blockerat på spårning som inte
    finns. Räkna från run 1, backfilla inte.
32. **Talents** — 31 av 45 är `SOON`-brickor. Innehållet är den stora
    halvan, inte ramen.
33. **Level up-korten: snabba först, snygga sen.** Formen är fel, inte bara
    ramen.

### 🧱 SKULD
34. **En renderad storlek på alla enheter.** ROG Ally X ≠ skärmen.
35. **`buildMetaEffects` ut ur `GameScreen.jsx`** — blockerad på att
    `petStageMult` ligger i en React-komponent.
36. **Kampanjens 21 noder ommålade på de 5 akterna.** Maskineriet har rätt
    form redan, det är temat som är äldre än storyn.
37. **CSS-dubbletterna** — 164 selektorer definierade 2+ gånger. Kör
    revisionsskriptet innan du stylar något.

---

## Stående regler som redan kostat pengar

- **Bygg aldrig en andra kopia av ett system.** Greppa först.
- **Titta på det.** Skärmdump, båda vyerna (393×852 och 1440×860).
  Rapportera aldrig ett visuellt resultat från en diff.
- **Ett pseudoelement som är fullt specificerat och ändå osynligt** — kolla
  förälderns `clip-path`, `overflow`, eller en `display:none` en senare
  regel misslyckades med att skriva över.
- **Bevisa varje vakt röd** genom att injicera felet innan du litar på den.
- **`localStorage['wds.save.v1']` är hans riktiga spar.** Backa upp, lägg
  tillbaka.
- **Ingen emoji, inga bildfiler.** Allt är handbyggd SVG.
- **`logic.test.mjs`s kampanjtakt-assertion ska INTE "fixas"** — 180s-
  grinden är Timmys eget beslut, det är testet som är gammalt.
