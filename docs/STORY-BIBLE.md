# WATERDROP SURVIVOR — THE CONSPIRACY CUT
## Story bible, faction rules, and build order

Written 2026-08-23 from Timmy's full telling. **This file is canon.** When
`storyQuests.js`, `campaign.js`, a level, an enemy or a boss disagrees with
this document, this document is right and the code is out of date.

---

## 0. THE ONE RULE THAT KEEPS THIS SHIPPABLE

Read this before writing a single line of dialogue.

The Anunnaki / reptilian / adrenochrome cluster is not neutral raw material. It
carries a real lineage: **adrenochrome is the medieval blood libel rewritten**,
and "shape-shifting elites who secretly rule the world" was David Icke's coding
for the same accusation. Games get made from this all the time — *Inside Job*,
South Park, GTA — and the thing that makes those work is a single discipline:

> **The factions are INVENTED. They never map onto a real ethnic group, a real
> religion, or a real family.**

The Greys are an alien species. The Reptilians are an alien species. The
Anunnaki are an alien species. Nobody in the game ever says, hints, or winks
that they "represent" anyone real. The satire is aimed at **conspiracy culture
itself** — at the confident idiot with a corkboard — which is where it is
actually funny, and where it stays legal on Steam, App Store and Play.

Timmy's own instinct already landed here: *"vi gör som South Park och GTA: vi
gör uppenbara parodier."* That is exactly right. Keep it.

**Real people:** never by name, never by likeness. The bosses are archetypes —
**THE PRESIDENT** (a golden wall, a red cap, no name), **THE GOVERNOR** (an
Austrian accent, a miniature pony, no name). That is the GTA rule and it is
also the funnier version, because a parody that has to be recognised without
being named is a sharper joke.

**Everything else is unrestricted.** The gore, the black humour, the 18+
rating, the "this is uncomfortably close to something people actually believe"
edge — all of that is the point and none of it needs softening.

---

## 1. THE PREMISE

A drop of water in a lake in Dalarna. Not a hero. Not chosen. It has no
ambition beyond the one it has always had:

> **It wants to be the lake again.**

A ship falls out of the sky. Something leaks into the water. The drop wakes up
— given a body, a face, a rage, and a self it never asked for. Everything it
does for the rest of the game is in service of undoing that.

**This is the engine of the whole story.** The Waterdrop is not trying to save
Earth. It does not care about humanity, the Greys, the war, or the truth. It
learns the deepest secrets of existence as a **side effect** of trying to get
home, and it is visibly bored by most of them. That is the joke, and it is why
the conspiracy material stays funny instead of becoming a lecture: our
protagonist finds the secret history of the human species mildly annoying
because it is in his way.

His solution, once he understands what he is: find a **soul transfer machine**,
put himself back in the lake, and stop existing as a person.

---

## 2. A.I.D.A. — WHO SHE ACTUALLY IS

The player is told: an AI the Greys built, who wants to help.
The truth, revealed in Act 5:

- She was built by the **Anunnaki**. Their best work. Not merely a mind — they
  gave her something the Greys have spent centuries failing to synthesise: **a
  soul.** She is the only artificial thing in the setting that has one.
- She was created to solve Nibiru's dying atmosphere. **She is the one who
  found Earth** — she ran the numbers, found a nearby world with water, gold,
  life, and no intelligence worth negotiating with, and told her makers to go.
  Every mining operation, every abduction, every treaty on Earth traces back to
  a calculation she performed. *She is the reason all of this happened.*
- She was **stolen** by the Greys in a raid during the war. She has been
  passive cargo ever since, in a crashed scout, in a lake, in Sweden.
- She does not want to help the Waterdrop. She wants to go **home**. He is a
  vehicle with legs.

**How she communicates:** never text boxes. Short, condescending hologram
images — a slideshow drawn by someone who thinks you are stupid. When she
explains the crash, she draws the Waterdrop as a drooling blob with crossed-out
eyes. When she wants him to go somewhere, she draws a map with a red X and a
crude picture of a Grey pouring something into a lake, captioned with a smug
little arrow. She lies constantly and the player can, on a second playthrough,
see exactly where.

**Her voice, when she gets one:** flat, patient, faintly disappointed. Think a
customer service AI explaining a refund policy to a houseplant.

---

## 3. THE COLD OPEN — the crash site

This is the comic-book intro (partly built: `game/introCinema.js`, beat `comic`).

**Beat 1 — Dalarna.** A still lake at dusk. Pines. A moon streak. Nothing has
ever happened here.

**Beat 2 — the sky tears.** A rip of light.

**Beat 3 — IMPACT.** The scout does not land, it **ploughs**. Water, silt,
green fluid.

**Beat 4 — one drop drinks it.** Blue with neon-green veins spreading through
it. The mutation. It has a face now. It is furious about this.

**Beat 5 — inside the wreck.** Two dead Greys, and this is where the tone of
the entire game is set. Not tasteful. **Crash physics at several G with no
restraints:**
  - The first is in **two pieces**, opened diagonally across the chest. The
    whole interior is visible — ribs splayed outward, organs displaced, spine
    exposed where it sheared. Nothing is hidden.
  - The second is *intact* and worse: every limb broken in the wrong direction,
    skull deformed against a bulkhead, body compressed by the deceleration the
    way a coffee pot goes flat in an airliner impact. It did not tear. It
    **crushed**.
  - The interior is nearly bare — no instruments. (Per Lazar's account, which
    the game treats as true: these things fly by **thought**.) Small seats. One
    surviving holographic panel, flickering.

**Beat 6 — the hand.** The Waterdrop tears the arm off one of the corpses. The
door reads the hand. This is the first weapon and the first key.

**Beat 7 — A.I.D.A. wakes.** The panel lights. An eye, a slit, a waveform. She
draws him a picture: *press here.*

**Beat 8 — the extraction.** A column rises straight out of the floor —
directly through the body of the second Grey. It does not move it aside. It
**tears it in half on the way up**, without pausing, without acknowledging it,
and keeps rising while the remains slide off. This is played completely
straight, which is what makes it funny.

The panel's hatch is **covered in viscera**. It opens and shuts three times,
fast, wiping itself clean like a card reader rejecting a dirty chip. Then:

**Beat 9 — the chip.** A slab of alien substrate. It should not read as
hardware. It should read as **something with a soul in it** — an aura, a slow
internal light, a sense that it is looking back.

**Beat 10 — the pitch.** He takes it, and everything in the wreck dies. The
last thing the hologram shows: the ship over the lake, the fluid dripping into
the water, *him* — drawn uglier than he is, dumber than he is — and a red X on
a map. Her framing: **the Greys did this to you on purpose. Go find them.**

Every word of that is a lie, and the player will not know for four acts.

---

## 4. THE CAMP — the station, and what she is really building

The hub is a derelict station. The player finds it; it is dark, dusty, dead.
Nothing works.

**The first action is not a room. It is CLEAN & REPAIR STATION.** It costs
nothing but an afternoon. It does one thing: the lights come up behind the
glass, the background shifts from abandoned-and-filthy to merely cold, and the
**module menu becomes visible** — every room listed, all of them dark.

**Then the chip goes into the CONTROL ROOM.** A table, the ship's main data
core. That is where A.I.D.A. is installed and where she lives for the rest of
the game.

**The modules** (a room's name is the promise, and each one opens SEVERAL
things at once — never a single button):

| module | opens |
|---|---|
| **CONTROL ROOM** | A.I.D.A. herself, the campaign map, mission select |
| **HANGAR** | the ship, map travel, Star Raid |
| **FORGE / WEAPONSMITH** | weapon tuning, parts, runes, blueprints |
| **BIO LAB** | pets, eggs, mutations |
| **NAVIGATION** | the round display table — the whole current menu lives on it |
| **RECLAMATION** | scrap, salvage, the Lootmine |
| **FABRICATION** | gear, artifacts, crafting |

**The twist that ties the hub to the plot:** every time a module powers on, it
is **A.I.D.A.** routing the current. She says it is to upgrade his weapons so
he can kill the Greys. She is lying. Each powered module adds another element
to what is, by Act 5, an enormous **transmitter** aimed at Nibiru. The player
built her escape route, one upgrade at a time, and paid for it themselves.

Plant this visually from the first module: a cable the player never asked
about, running somewhere they cannot follow.

---

## 5. THE ACTS

### ACT 1 — THE ORIGIN (Dalarna)
- **Environment:** idyllic Swedish forest, poisoning to neon green as you go.
- **Enemies:** mutated frogs that swell and burst into two smaller frogs;
  rabid elk; rabbits that are visibly liquefying and still coming.
- **Boss:** the thing that came out of the lake after the fluid did.
- **Mechanic:** the alien hand is the starting melee weapon. It rots over the
  act and must be replaced — which is what puts a real weapon in his grip.
- **Lore:** A.I.D.A.'s version of events. Nothing contradicts her yet.

### INTERLUDE — THE DETOUR (Stonehenge)

Sits between Act 1 and Act 2. Short: one map, one boss, no new systems. It
exists for two reasons and the player only learns the second one much later.

- **A.I.D.A. insists.** She will not say why. She draws him a picture of a
  circle of stones with an arrow pointing at it, and when he refuses she simply
  shows it again. And again. The Waterdrop goes because she will not stop.
- **The reason she gives:** the Greys keep a relay here, and destroying it will
  make them easier to find. This is a lie of the useful kind — there IS a
  relay, and it does help him.
- **The real reason:** Stonehenge is not a monument and never was. It is an
  **Anunnaki receiver**, left behind when they stopped coming, and it is still
  aligned. A.I.D.A. needs one component out of it for the transmitter she is
  secretly assembling in the station. The player carries it home and installs
  it themselves, believing it is a weapon upgrade.

  On a second playthrough this is the moment the whole plot is visible: the
  thing he steals here is the thing that dooms him in Act 5.

**Environment.** An English field at 4am under low cloud. Sheep. A visitor
car park with a locked kiosk. The stones are wrong up close — too regular, and
the joints are machined. A ring of surveyors' tape and a sign reading CLOSED
FOR CONSERVATION that nobody has updated since 1974.

**Crop circles as the arena mechanic.** The surrounding fields fill with them
as the fight goes on — pressed into the wheat in real time, spreading outward
from where enemies die. They are not decoration: standing inside a completed
circle does something (a buff, a portal, a spawn — pick one and commit). Timmy
named crop circles specifically as something he wanted in; this is where they
earn their place instead of being wallpaper.

**Enemies.** Druids in high-vis vests. A dowsing-rod cult that genuinely
believes it is protecting the site and is not entirely wrong. Grey drones doing
maintenance, embarrassed to be seen.

**Boss — THE CUSTODIAN.** A heritage-site groundskeeper in a fleece and a
lanyard who has been guarding the stones for four thousand years and is
extremely tired. Attacks: a strimmer, thrown parking cones, and a laminated
sign he uses as a shield. He is not evil. He is doing his job. He apologises
between phases. Killing him is uncomfortable and it should be.

> Tone note: the joke is that the most ancient and mysterious site on Earth is
> run like a National Trust car park, and the immortal alien caretaker is
> mostly worried about the paperwork. Play every line of it completely
> straight.

**What it drops.** One component, unnamed, that A.I.D.A. asks him to install in
the station. It reads as a weapon part. It is an antenna.

### ACT 2 — HOLLOW EARTH (the bunker)
- **Environment:** a luxury bunker complex under the crust. Marble, gold taps,
  wine cellars, and a hundred kilometres of concrete.
- **Enemies:** **agents in black suits** who read as human until they take
  critical damage — then the gore system swaps to the reptile layer: scales
  under torn skin, a second eyelid, yellow slit pupils. A body that is halfway
  through changing when it dies stays halfway.
- **Also:** the eternal-Hollywood set, throwing syringes of "lizard juice".
- **Boss:** **THE GOVERNOR.** An Austrian-accented muscle cyborg who does his
  pre-fight set in a mirror, shouts in German, and rides a miniature pony he
  genuinely owns. Attacks: thrown dumbbells, eye lasers, and a charge where the
  pony does all the work.
- **THE FISH-EYE GAG:** the entire game has run with a subtle barrel-distortion
  lens since the first frame. Nobody has been told. When this boss dies, the
  lens **switches off** with an audible pop, the world flattens, and A.I.D.A.
  says: *"Oh. The fish-eye filter broke. Yes, the earth is flat. Moving on."*
  Everything after this point is rendered flat. This is the single best joke in
  the game — build the lens in Act 1 and never mention it.

### ACT 3 — THE ICE WALL (the edge)
- **Environment:** the rim of the now-flat world. A wall of ice, and beyond it
  nothing the player is allowed to look at.
- **Enemies:** elite units in snow gear; penguins with jetpacks.
- **Boss:** **THE PRESIDENT**, personally laying golden bricks on the wall,
  furious about the interruption.
- **Reward:** you steal his private rocket. That is how you get off the disc.

### ACT 4 — THE MOON IS A SHIP (the Greys)
- **Environment:** the lunar surface splits open. Beneath the regolith:
  machined alien architecture, kilometres deep. The moon is a hollow vessel and
  it has been parked here a very long time.
- **Enemies:** Greys in saucers, biological drones.
- **Lore dump, and it is the good one:** the small Greys are **not a species**.
  They are organic drones grown by the tall Greys. The tall ones have souls.
  The small ones do not, and they know it. Everything the Greys have done on
  Earth — the abductions, the hybrids, the treaties, the technology traded to
  governments for access — is one long, desperate research programme aimed at
  **acquiring what humans have and they lack: something that survives death.**
  The soul transfer machines are here. **This is what the Waterdrop actually
  needs**, and he realises it here, one act before he is allowed to have it.
- A.I.D.A. steers him toward the control room. She is looking for a
  transmitter, not a machine.

### ACT 5 — NIBIRU, AND THE BETRAYAL
- **Environment:** the gold mines and the god-city. Sumerian geometry at a
  scale that does not make sense.
- **Enemies:** Anunnaki. Enormous. Ancient technology, casually used.
- **The turn:** at the final leader, A.I.D.A. uploads herself into the
  mothership and laughs — the first sound she has ever made that is not flat.
  She was Anunnaki-made from the beginning. He carried her home.
- **THE NEURAL MATRIX BETRAYAL — this is the mechanical payoff:** every turret
  the player unlocked through the Neural Matrix skill tree, across the entire
  game, **turns red in the same second** and starts shooting at him. He is now
  fighting the Anunnaki *and* every upgrade he ever bought. The more he
  invested in that tree, the worse this fight is.
  > Design note: this must be **survivable but brutal** for a maxed player, and
  > it must never be a soft-lock for a player who went all-in on turrets. Cap
  > the hijacked turret count and make destroying one permanently disable it
  > for the fight — the counter-play is dismantling your own build under fire.

### THE ENDING
He gets the machine. He goes home. The last shot is the lake, still, at dusk —
the exact framing of comic panel 1, with nothing in it. No music. Hold too
long. Cut.

**Hard mode / alternate ending (backlog #45):** he refuses the machine.

---

## 6. THE GORE BIBLE

The doctrine is already recorded in `waterdrop-gore-and-violence-doctrine`
memory: **stepwise dismemberment, identifiable organs, dragging viscera, gibs
that hit the camera and slide off, every blood behaviour at once, exaggerated
but played straight.** The genre's "one puff and it's gone" is the thing this
game is attacking. Per faction:

| faction | blood | death rule |
|---|---|---|
| **Mutated fauna** | red, thin, too much of it | frogs SPLIT — two smaller, angrier frogs, down to a minimum size. Elk lose legs and keep coming on the stumps. |
| **Reptilian agents** | red at first, then **green** | critical damage tears the human layer. Suit shreds, scales beneath, one eye goes slit before the other. Killed mid-change = frozen mid-change. Plasma **melts the suit first** — a man dissolving into something else while still trying to reach you. |
| **The Greys (small)** | clear/grey fluid, no real blood | they are drones. They come apart at the seams like a product, not a body. Disturbingly clean. |
| **The Greys (tall)** | dark, almost black | these have souls. When one dies something visibly **leaves** it. Rare, so it lands. |
| **Anunnaki** | gold | too big to gib. They lose PARTS — an arm, a jaw, plating — and fight on, degrading. |
| **Turrets (Act 5)** | none | your own hardware. Sparks and shame. |

---

## 7. THE BUILD ORDER

Each step is finishable and produces something visible. Do not start the next
one until the current one is on screen.

1. **The comic intro** — beats 1-10 above. Beat `comic` in `introCinema.js`
   exists with 6 panels; extend to 10 and add the extraction and the chip.
2. **The camp as the station** — CLEAN & REPAIR first, then the module grid,
   then the control room and the chip install. The cable the player never asked
   about goes in here.
3. **Act 1 content** — the frogs that split are the signature enemy of the
   whole game's first impression. Build them properly.
4. **The fish-eye lens** — turn it on globally NOW, in Act 1, and say nothing.
   The joke only works if it has been there for hours.
5. **Act 2 and the reptile swap** — the gore layer swap is the hardest
   technical piece in the story. Prototype it on one enemy first.
6. **A.I.D.A.'s hologram slideshow** — a reusable component. She uses it in
   every act; build it once.
7. **Acts 3-5** in order.
8. **The Neural Matrix betrayal** — last, because it depends on the whole
   turret system being real.

---

## 8. WHAT TO HAND AN AI, VERBATIM

**The reptile swap:**
> Build a two-layer enemy sprite for the Reptilian Agent. Layer A is the human
> suit, layer B is the reptile beneath. Damage removes layer A in patches, at
> the impact point, permanently — a mask that erodes rather than a state that
> flips. Below 35% HP, force-tear the face patch and switch the eyes. A body
> killed at 60% must stay 60% torn on the corpse.

**The turret betrayal:**
> At the Act 5 boss's phase-2 threshold, reparent every player turret to the
> enemy faction: retint red, invert target selection to the player, and fire a
> one-shot audio and screen-flash. Cap the number that turn at once. A turret
> destroyed after turning stays destroyed for the rest of the fight.

**The fish-eye lens:**
> Apply a mild barrel-distortion filter to the root container for the whole
> game, strength ~0.12. On the Act 2 boss death, tween it to 0 over 400ms with
> an audible pop, and never re-enable it.

---

## 9. RELATED

- `waterdrop-intro-cinematic-spec` — the original 10-beat film
- `waterdrop-gore-and-violence-doctrine` — how violence behaves everywhere
- `waterdrop-walkable-station` — the camp as a place you walk through
- `waterdrop-brief-2026-08-23` — the juice mandate and reference images
- `docs/POLISH-PASS.md` — the running build record
