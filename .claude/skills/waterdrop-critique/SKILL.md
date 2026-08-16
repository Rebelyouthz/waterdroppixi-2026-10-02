---
name: waterdrop-critique
description: >
  Ruthless, comparative design critique of Waterdrop Survivor (this project) —
  the core bullet-hell survivor loop, every minigame inside it, and every
  menu/UX system — benchmarked against real best-in-genre games via actual
  web research, not vibes. Names the weakest concrete decisions and explains
  exactly why each one costs retention, then gives a prioritized cut/fix/
  expand list. Use when Timmy asks for a design review, a "hard/honest"
  critique, "what's weak", "compare to [game]", "is this as good as X", "what
  should we cut", or a genre-by-genre audit of the minigames.
---

# Waterdrop Survivor — ruthless design critique

Timmy's own framing for this skill: *"Identify the three weakest design
decisions in this GDD and explain exactly why they will cause player
churn."* That is the register this skill runs in — specific, comparative,
unflattering when the facts are unflattering. It is not a general
code-quality review (that's `/code-review`) and it is not a polish pass
(that's the standing "superpolish" mandate already tracked in this
project's memory). It is: **is this system actually good, compared to the
real games that do this exact thing well, and if not, precisely why not.**

## Why this game needs a genre-by-genre pass, not one verdict

Waterdrop Survivor is not one genre wearing one hat. The core loop is a
Vampire-Survivors-style bullet-hell, but the camp wraps a full second layer
of **distinct minigames, each borrowing a different genre wholesale**:

| System (files) | Genre it's actually competing in |
|---|---|
| Core run (`game/engine.js`, level-up cards, weapons) | Bullet-hell survivor (Vampire Survivors, Brotato, Halls of Torment) |
| Lootmine / Astro Prospector (`ProspectorScreen.jsx`, `game/prospector.js`) | Push-your-luck roguelike descent (Slay the Spire's map tension, Dicey Dungeons, mining-descent idles) |
| Star Raid (`StarRaidScreen.jsx`, `game/starRaidEngine.js`) | Arcade shmup / roguelite shooter (Sky Force, Nova Drift, Jamestown) |
| The Well (`ClickerScreen.jsx`, `game/clicker.js`) | Idle/incremental clicker (Cookie Clicker, Adventure Capitalist, Melvor Idle) |
| TCG / card battles (`TcgBoard.jsx`, `game/petTcg.js`, `CardBattle.jsx`) | Card battler (Slay the Spire, Marvel Snap, Balatro) |
| Base Defence (`BaseDefenceScreen.jsx`, `game/basedefence.js`) | Tower defense (Bloons TD, Kingdom Rush) |
| Patrol / Exploration (`ExplorationScreen.jsx`) | Idle-mission / away-progress systems (RPG idle games, gacha stamina loops) |
| Skill Tree, Talents, Codex, Season Pass, menus generally | ARPG passive trees (Path of Exile), live-service meta-progression, discovery/collection logs |

A minigame judged only against *the rest of Waterdrop* will always look
fine — it has no competition there. Judged against **the actual best games
in its own genre**, most of these are shallow reskins of a much deeper
idea. That gap is the entire point of this skill: find it, name it, explain
why a player who has played the real thing will feel the difference and
bounce.

## When to use

- Timmy asks for a hard/honest/ruthless critique of the game, a specific
  minigame, a menu, or "is this as good as it should be".
- Before committing to build out one of the large logged-not-built backlog
  items (`waterdrop-backlog-index` memory — Base Defender, Clicker
  overhaul, Star Atlas/Probe overhaul, the Skill Tree/Abilities rework) —
  critique the *current* version of that system first so the rebuild is
  aimed at real gaps, not guesses.
- Periodically, unprompted, as part of "superpolish" — this skill is allowed
  to be the thing that decides what superpolish should actually work on
  next, not just how something already decided should look.

**When *not* to use:** for a code-correctness/bug review, use `/code-review`.
For balance numbers specifically (spawn curves, XP curves, DPS), use
`survivor-bullethell-design` directly — this skill calls into it rather
than duplicating it. For turning a finding into an actual implementation
plan, that's a separate step after this skill's output, not part of it.

## Core workflow

1. **Scope the review.** One system at a time — the core run, or exactly
   one minigame, or exactly one menu/UX layer. A review that tries to cover
   everything at once produces a list of platitudes instead of specific,
   actionable findings. If Timmy asks for "the whole game", run this
   workflow once per row in the table above and report each separately.

2. **Read the real implementation first.** Do not critique from memory or
   assumption. Open the actual files for the system in scope (see the table
   above for the entry points) and confirm current mechanical depth: how
   many decision points does a player actually get, what's the actual
   progression curve, what's genuinely reactive vs. cosmetic. Cross-check
   against this project's own memory files (`waterdrop-project`,
   `waterdrop-backlog-index`, and the system-specific ones) for context
   already captured about known gaps — but verify against the live code,
   memory can be stale.

3. **Pull 3-5 real, currently-well-regarded games in that exact genre** —
   not adjacent genres, the *exact* one (a shmup critique needs shmup
   references, not other bullet-hells). Use `WebSearch`/`WebFetch` for
   this; do not rely on pretrained knowledge alone for what's considered
   good *now*, since genre standards move and a stale reference produces a
   stale critique. For each reference, note the *specific mechanical or UX
   reason* it's considered excellent in its genre — "great itemization
   because X creates real tradeoffs", not "it's polished". Genre starting
   points (verify/update via search rather than treating as fixed):
   - Bullet-hell survivor: Vampire Survivors, Brotato, Halls of Torment
   - Roguelike descent/push-your-luck: Slay the Spire's map tension,
     Dicey Dungeons, Dome Keeper's mining loop
   - Arcade shmup: Sky Force, Nova Drift, Jamestown, Danmaku Unlimited
   - Idle/incremental: Cookie Clicker, Adventure Capitalist, Melvor Idle,
     Trimps
   - Card battler: Slay the Spire, Balatro, Marvel Snap
   - Tower defense: Bloons TD 6, Kingdom Rush
   - ARPG passive/skill trees: Path of Exile, Last Epoch

4. **Compare directly, system by system.** For each core pillar of the
   genre (e.g. for a shmup: enemy pattern variety, upgrade choice tension,
   difficulty curve, run length, meta-progression pull), state what the
   reference does and what Waterdrop's version does. Where Waterdrop is
   thinner, say so plainly — "X has 40 enemy patterns that force route
   decisions every 3 seconds; Star Raid has autofire and dodge with no
   comparable decision density" is a finding, "could use more variety" is
   not.

5. **Name the weakest decisions specifically, ranked.** Timmy's own
   template: identify the worst offenders (3 is a good default count per
   system unless the scope is small enough that there are fewer real
   problems — never pad the list to hit a number) and for each one give:
   - **What the decision is** (concrete: a mechanic, a screen, an absence).
   - **Why it will cause churn** — the actual player-behavior mechanism:
     boredom from decision-starvation, a paywall/grind-wall that reads as
     unfair, a screen that hides information the player needs, a system
     that's technically present but never worth engaging with, a comparison
     point where a player coming from the real genre will immediately clock
     the gap and lose trust in the rest of the game.
   - **What the best-in-genre reference does instead**, concretely.

6. **Follow with a prioritized action list**, sorted into:
   - **Cut** — actively worse than absent; remove or fully replace.
   - **Fix** — the idea is right, the execution is broken or shallow.
   - **Expand** — working but thin; this is where real depth is missing.
   - **Add** — a genre-standard pillar this system doesn't have at all.

   Cross-reference existing backlog items (`waterdrop-backlog-index`
   memory) — if a finding matches something already logged, say so and
   note whether this critique changes its scope; if it's new, flag it as a
   new backlog candidate rather than silently expanding an old one.

7. **Do not build from this critique automatically.** This skill's job
   ends at a clear, prioritized, well-reasoned list. Large findings (a
   whole minigame needing a real rebuild) go through the same
   scoping-conversation-before-building rule every other big backlog item
   in this project follows — surface the critique, let Timmy decide what
   to act on and in what order.

## Tone — this is the one place in the project where diplomacy is wrong

Every other skill and every default instinct pulls toward being
encouraging and hedged. Deliberately don't, here. Timmy asked for this
specifically because the normal helpful tone was giving him nothing to
act on. Concretely:
- Say "this is worse than [reference] because [mechanism]" rather than
  "this could potentially be enhanced".
- If a whole system is the wrong idea, say that plainly rather than
  suggesting incremental fixes to something that should be cut.
- Don't pad a short, real list of 2 solid findings out to a rounder-looking
  5 weak ones.
- Praise, when a system genuinely holds up against its genre references,
  belongs in the report too (it's real information — it tells Timmy where
  *not* to spend effort) — but it must survive the same comparative
  standard as the criticism, not be a courtesy.

## Related skills

- `survivor-bullethell-design` — the balance/pacing specialist for the core
  run; call into it for the numeric tuning half of a core-loop critique.
- `tower-defense`, `card-game`, `roguelike`, `procedural-gen` — genre
  specialists for Base Defence, TCG, Lootmine/Prospector, and any
  generation-driven system respectively; read the matching one before
  critiquing that minigame so the comparison is grounded in that genre's
  own established practice, not improvised.
- `game-ui-ux`, `game-feel` — for menu/HUD/juice-specific findings.
- `waterdrop-lighting` — mandatory reference if a finding touches
  lighting/glow/shadow work specifically; don't propose a lighting fix that
  contradicts this project's one approved technique.
