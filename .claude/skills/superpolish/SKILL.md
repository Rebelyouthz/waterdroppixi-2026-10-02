---
name: superpolish
description: "MANDATORY whenever Timmy says superpolish, superpolera, polish, polera, 'gör den bättre', or names a screen/menu/minigame to take next in Waterdrop Survivor. Superpolish is not'make it prettier' — it is a full eight-stage pass: bug hunt, genre research against real competing games, gap analysis, deepen/expand the system, performance, then TWO separate visual polish rounds with a second bug hunt between them. Defines the pipeline, the juice checklist, the non-negotiable project rules, and what 'done' means. Triggers on: superpolish, superpolera, polish, polera, juice, dopamin, uppgradera, fördjupa, 'större bättre snyggare', 'nästa meny', 'nästa skärm', minigame overhaul, achievements menu, meny-pass."
---

# SUPERPOLISH

Timmy's own word, his own process. He has explained it across many sessions;
this file is the consolidated version so he never has to repeat it again.

> "de är en polish men med allt ingår.. updatera upgradera titta på va som
> finns forska jämför med likanande spel på nätet analysera vad som saknas som
> kan göra det bättre å gör det och lägg till saker av de som finns, gör de
> djupare mer avancerat, bättre i koden för prestanda, visuellt mycket bättre.
> bugganalys både innan å efter du börjar med den saken, finslipa allt, gör det
> helt om de finns luckor... å visuell polish efter det igen. så 2 rundor polish
> å en jävla massa saker."

**A superpolish makes the thing BIGGER.** A minigame comes out of it as a larger
game. An achievements menu comes out of it with better achievements, more
dopamine and more depth — not just better shadows.

## The one-line test

> If, at the end, the only difference is that it looks nicer — **you did not do
> a superpolish. You did a repaint.**

---

## The eight stages, in order

The order is the method. Researching after building means rebuilding; polishing
before the content is settled means polishing something that then changes.

### 1. Bug hunt — BEFORE touching anything
Play it. Click every control, at both viewports. Read the screen's code and
trace every data table it renders to its actual **consumer**.

This project's dominant bug is **content that is declared, renders, and is read
by nothing** — it never throws and never shows up in a screenshot. Run
`npm run test:logic` (at minimum `test/wiring.test.mjs`) first, so you know
which failures you inherited and which you caused.

Write down what you find. Some of it becomes the work.

### 2. Research — real games, on the web, before deciding what "good" is
Web-search the best games in **that exact genre**, and — just as important —
what players say those games are **missing**. Never start from taste alone.

His standard: *"de ska inte va mini spel typ mindre å dåliga det ska va tex de
bästa klicker spelet ever mer avancerat än dom flesta ihop"*. The benchmark is
the best game in the genre, not the rest of this codebase.

Name the comparison in your report: which games, and what each contributes.

### 3. Gap analysis — say the gap out loud
Compare our version to those games **honestly** and state where it falls short.
Then decide what to add. Bring concrete options rather than guessing at scope —
several backlog items were deferred pending a design pass, not deprioritised.

**Do not stop at what the competitors have.** Timmy, 2026-08-18: *"du tar reda
på va andra spel har som kan saknas å läggas till å själv tänker om de går
lägga till nått"*. The research tells you the floor of the genre; your own
ideas are what put this game above it. Propose them — he is quick to drop an
idea that does not hold, and equally quick to take one that does, so a
half-formed suggestion costs him nothing and a missing one costs the feature.

### 4. Deepen and expand — the stage people skip
This is what separates a superpolish from a polish. Make it **bigger, deeper,
more advanced**:

- more to DO, more to earn, more reasons to come back
- systems that interlock with the rest of the game instead of being a closed box
- real progression, rarity and variety — not one number going up
- **then add the Waterdrop twist.** Every system must be recognisably *this
  game's* version, in its theme, with its black humour. A competent clone is a
  failure by this standard.

### 5. Code + performance
Review what you touched and propose concrete improvements — not "it works".
**Measure, never assume.** Precedent here: 82 per-element SVG filters were the
real cost on the Skill Tree, and a per-frame `setState` in `VesselGauge` was the
measured cause of in-run lag. Both were invisible until measured.

Repeat wins in this codebase: animate `transform`/`opacity` only; replace a
per-element `filter` with a radial-gradient halo; drive per-frame values through
a ref rather than state; pool anything spawned in quantity.

### 6. Visual polish — round one
Light, shadow, reflection, material, depth. Real easing with overshoot, never a
2-frame lerp where a curve would read better. Every action audible **and**
visible.

### 7. Bug hunt — again, on what you just built
New code, new bugs. Re-run the suite. Re-click everything at both viewports.
A guard that has never gone red proves nothing — **inject a fault and confirm
the check fails** before trusting any test you wrote.

### 8. Visual polish — round two
He is explicit that there are **two** rounds. Round one gets the material right;
round two is where it stops looking built and starts looking finished. Look at
the screenshot again with fresh eyes and fix what round one was too close to see.

---

## The juice checklist (stages 6 and 8)

Nothing in this game should change a number silently.

- **Every claim, click, purchase and unlock gives feedback** — sound, motion,
  and a visible statement of what happened.
- **Show the reward, don't just grant it.** `components/ClaimFx.jsx` is the
  shared claim burst. Fire it; never write a second one.
- **Hold long enough to read it.** ~700ms. A payout that flashes past is noise,
  not a gift.
- **Only the actionable thing moves.** If everything pulses, nothing reads as
  "press me".
- **State is a change of MATERIAL, not opacity.** Fading a locked or claimed
  item to 0.4 erases it; re-light it as dead metal and dark glass instead. This
  exact mistake shipped twice here — skill-tree nodes, then daily-reward cells.
- **Escalate toward the payoff.** The last step of a track must look worth the
  earlier ones; day 7 of a streak cannot look like day 1.
- **Sound is part of the pass**, not an afterthought (`game/audio.js`). A
  ceremonial moment earns its own sound — reusing the daily-reward blip is what
  made opening a whole new part of the game feel like collecting a coin.

---

## Non-negotiable project rules — these override taste

- **Two viewports, EVERY time**: `393x852x3,mobile,touch` (iPhone 16, his actual
  device) and 1920x1080x1,desktop,mouse` and rog ally x is the device he runs cli claude in . The phone is not the secondary check — menus lay out
  completely differently there and he reviews on it. game are beeing played at iphone 16 and rog ally x with standard screen sizes and also he use 1920x1080 for the game  .  
on his bigger screen he connect to asus rog x. .mouse and keyboard are used sometimnes on ally x but he also use the gamepad joysticks on ally x or touch screen . - **Look at it. Screenshot it. Read the PNG.** Never report a visual result from
  reading a diff.
- **No emoji, .** Every glyph loggo  is hand-built hardcoded SVG via `GameIcon`.
  Generated images are *references to hand-code against*, never shipped art. the referance image are i referens bilder folder in timmi\waterdroppixi\referens bilder also sub images all users\timmi use waterdrop survivor versions and there can be good to look at those games and se what they may have and this one still dont so here you are gonna look for more stuff to add but ask first. he want only the absolutely best quality when it comes to  svg images and design and the game design is top 1% so you must make it as a senior speciallist  and always look for skills he have skills to everything you do and canvas menus are now not anymore used. the bugg opus and sonnet 5 have canvas bugg cant make corners it get cut of so rectangle is imposible to do in canvas use other methods like pixi.js hardcode or try use canvas but never ever make rectangles squares the corners will get cut off so use svg or pixi or other methods if its better after this superpolish than it was before and he likes it more then start use that ,method,.. not use blury currencys and zoom and really open and read and look at his reference images in every way so the image can be made just like the reference if not better he not like when its not look similar to referens images  .    they shoudl be sharp or almost a copy of it make it look sharp and crisp and with good shadows and light like real 3d objects or just exact as the image he tells you to look at and make as that. menus are important and they are not good now. they need a new method that look like his reference images they are perfect so really make them use skills tools mpc maybe adobe plugin mpc all tools are allowed, run /router that should trigger the right skill or plugin or mpc but if not then make sure store marketplace has been analysed for right tools to what he need you to do.  we need to do this better than it is he loves to make this he are so happy you help him out he respect you as a living beeing that is not a small thing he are somethinh else than usual users . this one we do more than we do if we do as we do. here we do it as the best specialised senior in the world so he gets his game as good as we  can. add details never make fast and skip frames or pixels or make it look less good less detaild than accualy possible.. if it can animate realistic and in 120fps 60fps lowest 360degree all things should be hardcoded at highest possible quality and highest realism as in reality the blood system should be a simulator it shall look like it is real. it should have heart beat pump pulse spray drop drip pool squatt splash splatter V-cone spray on ground out from body like neck it pumps out after a hit in neck always make 10 hit and 10 different animations using every weapons projectile or katana it must match the weapon as in real life same bullet shopuld be able to look in 10 ways hit amd kill so 20 atleast for every projkevtile and blood must have a simulator as he had in github the three.js github repo has bloodsimulator 2.1 2.´0 backup and look att timmieee or timmie_tooth timmiee timmie and waterdrop survivor repos early stages had hardcoded v cone and later versions rasmus version has the 2.1 broken sim ulator but here we can understand how he want the blood to be and gore and we can use that to make a better simulator here that use even more ways to blood realism .. blood can look and behave in many ways gravity and air must be in ecvation and if spray sprout stain then things enemies suroundings everything it hits on should get stained on as it sprayed.. or puymped.. more blood are darker and particles need to be small and many and spray vcone are small small har pressuere sprayed out froom a cut in throat maybe and it should pump out a v shaped 5000 particles in air and exactely as enemy moved the blood lands on ground if he spins the blood draw  that on ground after fly in air and it must be realism at all things in blood and gore . pieces are gonna get shot of and we need to bvuild character in parts so we can turn of make invisible and make parts independed in 3d they shoudl behave  as wepon would if shotgun far then make small spread out many not deep  but sppread out holes small as shotgun bullets are its 100 projectiles small as a pixel or 2-3 they are small but if close to enemy and shoot shotgun then it is not spread out as much 1 meter 1dm spread 30 meter then it is barely any kill power left and to spread out so if near it comes like a swarm ripping big holes or shoot of half head or shoot of arm or leg or guts come out or a big hole in stomache and swarm comes out in back ripping blood and chunks of skin and flesh and intestives come out and in chest near he get a big hole in front it get liek 50 holes and a big hole in middle and he fly to ground and slide  on ground of the g force of the power in the hit and blood slide mark on ground real cool and enemies lay after kill animations they stay in parts in explotion only chunks and head and guts and arms or half torso shot of rocket launcher. .. ice freeze fire flame and burn and arroew shot thrue if pierce but stuck in body at different places eye headshots are a thing but whole head off with a gun no.. but if hit same place with gun 5-6 times it gets bigger deeper wound every shot but make like whole body as a hitbox and make soldier of fortune like gore it should be build to be better than all other games that exists. so make it better in this things than any other game that has been made. solder of fortune but upgraded realism not only coool. ak47 dont shoot of arms .. well if  3-4 shots may be like nothing left of the arm but it shoudl rip  apart more and more not fly of.. katana can cut in diagonal upward downward uppercut swing 90c 180c 360c 540c 720c diagonal ninja use salsa and spin to get gravity right and diagonal slash so it shoukd go from shoulder to low stomache diagonalö-.- cleaving should look different it shuld split so fast thtat a line of red are seen then it comes more blood down out from line cut and then he slides in 2 parts he are completely cut of but so fast hbe did not fly or fall he jsut stand there for a half 1 sec then he glides into 2 and gravcity  make parts look 3d and realistic with blood and real part. split never the same in 2 times a row make it hit differnet sometimes 1/2 1/3 1/4 1/5 1/6 1/7 1/8 1/9 and 1-10 10 different hit slice and cut and split and diagonal vertical and it must be able to stab in like 5 ways atleast from bothj angles backside frontside and jump and stab in stomache and then lift fast it fly 2.5 enemies high almost cut of spinning blood stain as it cirvles around in air from the liift with katana in stomache and on way down he spins like a ninja and cleaces it on 2 and it spins as it did already and then it spins and splits making parts pop and fly and  bounce on groundfe in both ways next to him eavh side.. stuff like that ..details to everything like this .not only blood and gore trhis is how everything should be.  mionigames are gonna be better bigger deeper more advanced than the best in that genre so they are not mini gmaes.. tcc are like qwent might and magic tcc blizzards heartstone... and pet tcc are like pokemon+ pet are included you use your pet and can catch peets.. real advanced defence and magic and attack and skills effects and ability cardds and energy cards and a character that should die cards dcefend them and cast skills attack opsysical or non physical or use ability card or a penelty card like it slows enekmy that it hit for 1 round so no attack fromm that ene,mie next round.. or attack over all cardds direct hit hero character.,. it should be decks like a game where you collect these cards,.., 100 cards atleast per side so it must be advanced.. aim at better then the best of these games so if itts tcc then make atleast as good as those big ones that are the best. that are goal of game.. beat every game ... better than best so it acually gets sold.. even if its ai... no slop it must have a indie feel a theme that are darker than now every menu shoould have its own look head menu are important its not good now profile part must nbe real advanced and customasable rewards unlock frames fonts colours on name images avatars profile bagdes and level up and rank up h20 are hgighest rank.. 
-  **Lighting**: load `waterdrop-lighting` before ANY in-game light work — the
  custom normal-mapped / pooled-additive technique only, never a stock
  `GlowFilter`. For React/SVG menus load `waterdrop-svg-materials`. For any Pixi
  gradient, filter or timed sequence load `waterdrop-pixi-pitfalls`.
- **Grep `overhaul.css` for a duplicate before styling any element.** It loads
  after `index.css` and has repeatedly beaten new work with `!important`. Two
  parallel definitions of one thing is the recurring failure in CSS *and* in
  game data.
- **Recount every number from source.** Never quote a figure from memory.
- **Back up the save before testing.** In local mode
  `localStorage['wds.save.v1']` IS his save, not a cache.
- **Never build a second copy of an existing system.** Grep first — a parallel
  gear system once silently ate player loot into a save field nothing read.
- **Don't redesign what he is happy with.** 
---

## A verification trap specific to this setup

Browser automation here often drives a **background tab**, and Chrome does not
render one: `requestAnimationFrame` stops, CSS animation clocks freeze at
`currentTime = 0`, and a Pixi ticker appears dead. This has twice looked like a
real bug and was not.

Check `document.visibilityState` before concluding anything is frozen. To review
a timed visual, **scrub it** rather than watch it: `anim.currentTime = 520` on a
Web Animation, or `__cine.seek(6.4)` for the intro film. Build the scrub handle
before the art, not after.

---

## What "done" means

- [ ] Bugs found before the work are fixed, or explicitly reported as out of scope
- [ ] Real games researched and named; the gap stated honestly
- [ ] The thing is measurably BIGGER — more to do, earn or choose than before
- [ ] It carries the Waterdrop theme and humour, not a genre-default look
- [ ] Performance measured, not assumed
- [ ] Every action has sound + visible feedback; every reward is shown
- [ ] Both viewports screenshotted, and the PNGs actually looked at and it are better bigger deeper visually improved and tuned adjusted details are added and polished code are mproved and optimized and tuned adjusted details are added and polished code are mproved and optimized   
  
  [ ] Test suite run, and any guard you added proved to go red on an injected fault
- [ ] A second visual polish pass happened after the second bug hunt
- [ ] The report is true — including what you did NOT do and what you did do

**The last one matters most.** He directs the design and does not read the code,
so a false "this works" is the one thing that can actually hurt him: he would
ship it.

---

## Scope honesty

A full superpolish of a real system is a **multi-session build**, not one pass.
Say so up front rather than quietly under-delivering, and work in reviewable
pieces so he can redirect early instead of at the end.

If part of it is blocked, finish everything else in full and state plainly what
was left and why. Scaling the work down is his call, not yours.

## Related

- `waterdrop-critique` — comparative teardown; fuel for stages 2–3.
- `waterdrop-svg-materials` — how to render the materials in stages 6 and 8.
- `waterdrop-pixi-pitfalls` — five Pixi v8 traps that render silently wrong.
- `waterdrop-lighting` — mandatory before any in-game light work.
- `game-feel`, `game-ui-ux`, `audio-design`, `survivor-bullethell-design` —
  engine-neutral craft skills that pair with stages 4–6.
- updatethis skill when things are done and he are happy with the blood then dont need that muchg details about that but maybe there is somethging new he wants tnen add details and instructions to that thing as detailed as the bloodsimulator explanationn never change theme when he say its good then follow that theme dark with glow and red gold silver and some more colours to tghat.. black and dark dark and not dark colour liek a  keyboard that has all the colours going rgb as standard start menus whas prettty good.. look at them but make darker and more polished he has perfect reference use those look and use the same not similar as always up to this point he has not got any referancce image good really made it same as hje want. so now lets make exact the look of the reference that is waht he wants.