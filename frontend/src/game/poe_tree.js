// =============================================
// POE2-STYLE SKILL TREE — Data & Config
// =============================================

export const POE_BRANCHES = {
  combat:    { name:'COMBAT',    icon:'ui_blade',  color:'#ff3146', glow:'rgba(255,49,70,0.5)'  },
  mobility:  { name:'MOBILITY',  icon:'pQuick',  color:'#4dffd4', glow:'rgba(77,255,212,0.5)' },
  defense:   { name:'DEFENSE',   icon:'ui_shield',  color:'#ffd166', glow:'rgba(255,209,102,0.5)'},
  greed:     { name:'GREED',     icon:'gold',  color:'#ffd700', glow:'rgba(255,215,0,0.5)'  },
  arcane:    { name:'ARCANE',    icon:'ui_orb',  color:'#b362ff', glow:'rgba(179,98,255,0.5)' },
  bloodline: { name:'BLOODLINE', icon:'pVamp',  color:'#ff6b9d', glow:'rgba(255,107,157,0.5)'},
  void:      { name:'VOID',      icon:'ui_void',  color:'#4dc4ff', glow:'rgba(77,196,255,0.5)' },
  pets:      { name:'PETS',      icon:'ui_pets',  color:'#51cf66', glow:'rgba(81,207,102,0.5)' },
  awakening: { name:'AWAKENING', icon:'trident',  color:'#ff9900', glow:'rgba(255,153,0,0.5)'  },
  tempest:   { name:'TEMPEST',   icon:'pWave',  color:'#1fb6ff', glow:'rgba(31,182,255,0.5)' },
};

// Tree canvas: 1800 × 2600 px
// Branches centered at x: 120, 320, 520, 720, 920, 1120, 1320, 1520
// Y levels (bottom→top): 2380, 2080, 1780, 1480, 1180, 880, 550, 250
//
// Node types:
//   minor    — r=18, max 3 levels
//   notable  — r=27, max 1-2 levels
//   keystone — r=40, max 1 level, active skill or powerful passive
export const POE_TREE_NODES = [

  // ═══════════════════════════════════════════
  // COMBAT (cx=120, #ff3146)
  // ═══════════════════════════════════════════
  { id:'poe_com0', branch:'combat', type:'minor',    x:120,  y:2380, req:[],                    max:3, c:1, stat:'dmg',      val:0.02,  name:'Executioner Stance', icon:'ui_blade',  desc:'+2% damage per level. The warrior\'s lethal focus.' },
  { id:'poe_com1', branch:'combat', type:'minor',    x:120,  y:2080, req:['poe_com0'],           max:3, c:1, stat:'dmg',      val:0.02,  name:'Bloodforged Edge',   icon:'ui_blade',  desc:'+2% damage per level. Your blade thirsts for slaughter.' },
  { id:'poe_com2', branch:'combat', type:'minor',    x:60,   y:1780, req:['poe_com1'],           max:3, c:1, stat:'pierce',   val:1,     name:'Spear of the Abyss', icon:'harpoon',   desc:'+1 pierce per level. Cut straight through the horde.' },
  { id:'poe_com3', branch:'combat', type:'minor',    x:180,  y:1780, req:['poe_com1'],           max:3, c:2, stat:'proj',     val:1,     name:'Splintering Volley', icon:'part_sight',desc:'+1 projectile per level. More lead, more carnage.' },
  { id:'poe_com4', branch:'combat', type:'notable',  x:120,  y:1480, req:['poe_com2','poe_com3'],max:1, c:4, stat:'crit',     val:0.08,  name:'True Aim',           icon:'ui_star',   desc:'+8% crit chance. Precision becomes deadly instinct.' },
  { id:'poe_com5', branch:'combat', type:'minor',    x:120,  y:1180, req:['poe_com4'],           max:3, c:2, stat:'crit',     val:0.03,  name:'Dead Eye',           icon:'ui_eye',    desc:'+3% crit per level. Nothing escapes your crosshairs.' },
  { id:'poe_com6', branch:'combat', type:'keystone', x:120,  y:880,  req:['poe_com5'],           max:1, c:8, stat:'headshot', val:0.08,  name:'Decapitation',       icon:'part_sight',desc:'ACTIVE: 8% chance to instantly execute non-bosses.', active:true },
  { id:'poe_com7', branch:'combat', type:'keystone', x:120,  y:500,  req:['poe_com6'],           max:1, c:8, stat:'berserk',  val:1,     name:'Berserker Rage',     icon:'pVamp',     desc:'ACTIVE: Below 30% HP, gain +40% unyielding damage.', active:true },

  // ═══════════════════════════════════════════
  // MOBILITY (cx=320, #4dffd4)
  // ═══════════════════════════════════════════
  { id:'poe_mob0', branch:'mobility', type:'minor',    x:320, y:2380, req:[],                     max:3, c:1, stat:'mspd',  val:0.02,  name:'Shadow Glide',    icon:'boot',  desc:'+2% move speed per level.' },
  { id:'poe_mob1', branch:'mobility', type:'minor',    x:320, y:2080, req:['poe_mob0'],            max:3, c:1, stat:'mspd',  val:0.02,  name:'Tempest Agility', icon:'pQuick',  desc:'+2% speed per level. The wind accelerates your step.' },
  { id:'poe_mob2', branch:'mobility', type:'minor',    x:260, y:1780, req:['poe_mob1'],            max:3, c:2, stat:'dodge', val:0.03,  name:'Mirage Drift',    icon:'ui_ghost',  desc:'+3% dodge per level. Evade incoming death.' },
  { id:'poe_mob3', branch:'mobility', type:'notable',  x:380, y:1780, req:['poe_mob1'],            max:1, c:3, stat:'dash',  val:1,     name:'Shadow Dash',     icon:'pQuick',  desc:'ACTIVE: SHIFT to dash with invincibility frames.', active:true },
  { id:'poe_mob3b',branch:'mobility', type:'notable',  x:460, y:1630, req:['poe_mob3'],            max:1, c:4, stat:'swipeAttack', val:1, name:'Execution Swipe', icon:'ui_blade', desc:'ACTIVE: a fast swipe executes a nearby enemy instantly in a burst of gore.', active:true },
  { id:'poe_mob4', branch:'mobility', type:'minor',    x:320, y:1480, req:['poe_mob2','poe_mob3'], max:3, c:2, stat:'dashcd',val:0.10,  name:'Quickstep Recall',icon:'ui_clock',  desc:'-10% dash cooldown per level. Unlocks Meta: Dash CD.' },
  { id:'poe_mob5', branch:'mobility', type:'notable',  x:320, y:1180, req:['poe_mob4'],            max:1, c:4, stat:'mspd',  val:0.10,  name:'Ghoststep',       icon:'ui_ghost',  desc:'+10% speed. Unlocks Meta: Eagle Eye.' },
  { id:'poe_mob6', branch:'mobility', type:'keystone', x:320, y:880,  req:['poe_mob5'],            max:1, c:8, stat:'blink', val:1,     name:'Blink Rupture',   icon:'tornado',   desc:'ACTIVE: Dash teleports; detonates AoE at landing.', active:true },
  { id:'poe_mob7', branch:'mobility', type:'keystone', x:320, y:500,  req:['poe_mob6'],            max:1, c:8, stat:'dashInvuln', val:0.45, name:'Phase Form',   icon:'ui_ghost',  desc:'ACTIVE: +0.45s invulnerability on every dash — pass straight through anything leaving cosmic afterimages.', active:true },

  // ═══════════════════════════════════════════
  // DEFENSE (cx=520, #ffd166)
  // ═══════════════════════════════════════════
  { id:'poe_def0', branch:'defense', type:'minor',    x:520, y:2380, req:[],                      max:3, c:1, stat:'maxHp', val:3,    name:'Colossus Vitality', icon:'heart',  desc:'+3 max HP per level. Fortify your essence.' },
  { id:'poe_def1', branch:'defense', type:'minor',    x:460, y:2080, req:['poe_def0'],             max:3, c:1, stat:'armor', val:0.3,  name:'Titan Carapace',    icon:'ui_shield', desc:'+0.3 armor per level.' },
  { id:'poe_def2', branch:'defense', type:'minor',    x:580, y:2080, req:['poe_def0'],             max:3, c:1, stat:'regen', val:0.03, name:'Lake\'s Regrowth',  icon:'ui_leaf',  desc:'+0.03 HP/s per level. Unlocks Meta: Regen.' },
  { id:'poe_def3', branch:'defense', type:'notable',  x:460, y:1780, req:['poe_def1'],             max:1, c:3, stat:'armor', val:2,    name:'Ironclad Ward',     icon:'ui_shield', desc:'+2 armor. Your form hardens like abyssal iron.' },
  { id:'poe_def4', branch:'defense', type:'notable',  x:580, y:1780, req:['poe_def2'],             max:1, c:3, stat:'regen', val:0.15, name:'Font of Life',      icon:'ui_leaf',  desc:'+0.15 HP/s regen. Continuous energetic restoration.' },
  { id:'poe_def5', branch:'defense', type:'notable',  x:520, y:1480, req:['poe_def3','poe_def4'],  max:1, c:4, stat:'maxHp', val:10,   name:'Vigor Infusion',    icon:'ui_blade',  desc:'+10 max HP. Every battle hardens your vessel.' },
  { id:'poe_def6', branch:'defense', type:'keystone', x:460, y:1180, req:['poe_def5'],             max:1, c:8, stat:'shield',val:1,    name:'Aegis Barrier',     icon:'ui_star',  desc:'ACTIVE: Absorb 1 lethal blow every 25s.', active:true },
  { id:'poe_def7', branch:'defense', type:'keystone', x:580, y:1180, req:['poe_def5'],             max:1, c:8, stat:'revive',val:1,    name:'Phoenix Rebirth',   icon:'pHoly',    desc:'ACTIVE: Revive once per run at 50% HP. Unlocks Meta: Revive.', active:true },
  { id:'poe_def8', branch:'defense', type:'keystone', x:520, y:800,  req:['poe_def6','poe_def7'],  max:1, c:12,stat:'maxHp', val:20,   name:'Anunnaki Husk',     icon:'ui_shield', desc:'+20 max HP. Ancient Annunaki-forged physique.' },

  // ═══════════════════════════════════════════
  // GREED (cx=720, #ffd700)
  // ═══════════════════════════════════════════
  { id:'poe_grd0', branch:'greed', type:'minor',    x:720, y:2380, req:[],                      max:3, c:1, stat:'gold',  val:0.04,  name:'Bounty Seeker', icon:'gold',  desc:'+4% gold per level.' },
  { id:'poe_grd1', branch:'greed', type:'minor',    x:660, y:2080, req:['poe_grd0'],             max:3, c:1, stat:'gold',  val:0.04,  name:'Gold Siphon',   icon:'gold',  desc:'+4% gold per level. The coffers overflow.' },
  { id:'poe_grd2', branch:'greed', type:'minor',    x:780, y:2080, req:['poe_grd0'],             max:3, c:1, stat:'xp',    val:0.04,  name:'Codex Scholar', icon:'ui_codex',desc:'+4% XP per level.' },
  { id:'poe_grd3', branch:'greed', type:'notable',  x:660, y:1780, req:['poe_grd1'],             max:1, c:3, stat:'pickup',val:0.20,  name:'Magnetic Core', icon:'pMagnet', desc:'+20% pickup range. Spoils gravitate toward you.' },
  { id:'poe_grd4', branch:'greed', type:'notable',  x:780, y:1780, req:['poe_grd2'],             max:1, c:3, stat:'luck',  val:1.5,   name:'Fate Weaver',   icon:'ui_leaf',  desc:'+1.5 luck. Destinies bend in your favor.' },
  { id:'poe_grd5', branch:'greed', type:'notable',  x:720, y:1480, req:['poe_grd3','poe_grd4'],  max:1, c:4, stat:'gold',  val:0.15,  name:'Golden Intuition',icon:'ui_gem',desc:'+15% gold. Unlocks Meta: Starter Cache.' },
  { id:'poe_grd6', branch:'greed', type:'keystone', x:720, y:1180, req:['poe_grd5'],             max:1, c:8, stat:'chestSense',val:1,  name:'Vault Diviner', icon:'ui_chest',desc:'ACTIVE: Chest enemies spawn 2x more frequently.', active:true },
  { id:'poe_grd7', branch:'greed', type:'keystone', x:720, y:800,  req:['poe_grd6'],             max:1, c:10,stat:'gold',  val:0.30,  name:'Midas Alchemy', icon:'ui_star', desc:'+30% gold. Transmute every kill to pure riches.' },

  // ═══════════════════════════════════════════
  // ARCANE (cx=920, #b362ff)
  // ═══════════════════════════════════════════
  { id:'poe_arc0', branch:'arcane', type:'minor',    x:920, y:2380, req:[],                      max:3, c:1, stat:'atks',     val:0.02,  name:'Chrono Resonance', icon:'ui_orb',   desc:'+2% attack speed per level.' },
  { id:'poe_arc1', branch:'arcane', type:'minor',    x:860, y:2080, req:['poe_arc0'],             max:3, c:1, stat:'atks',     val:0.02,  name:'Hyperdrive Pulse', icon:'ui_clock', desc:'+2% attack speed per level. Acceleration unbound.' },
  { id:'poe_arc2', branch:'arcane', type:'minor',    x:980, y:2080, req:['poe_arc0'],             max:3, c:1, stat:'area',     val:0.04,  name:'Singularity Flare',icon:'tornado',  desc:'+4% area per level. Spacetime widens.' },
  { id:'poe_arc3', branch:'arcane', type:'notable',  x:860, y:1780, req:['poe_arc1'],             max:1, c:3, stat:'critd',    val:0.15,  name:'Rupture Matrix',   icon:'pVamp',    desc:'+15% crit damage. Critical strikes shatter foes.' },
  { id:'poe_arc4', branch:'arcane', type:'notable',  x:980, y:1780, req:['poe_arc2'],             max:1, c:3, stat:'area',     val:0.15,  name:'Cosmic Expanse',   icon:'ui_void',  desc:'+15% area. Your devastation covers the screen.' },
  { id:'poe_arc5', branch:'arcane', type:'notable',  x:920, y:1480, req:['poe_arc3','poe_arc4'],  max:1, c:5, stat:'superCrit',val:0.05,  name:'Super Surge',      icon:'pExplode', desc:'+5% super crit chance. Unlocks Meta: Super Crit.' },
  { id:'poe_arc6', branch:'arcane', type:'notable',  x:920, y:1180, req:['poe_arc5'],             max:1, c:6, stat:'megaCrit', val:0.03,  name:'Mega Cataclysm',   icon:'ui_star',  desc:'+3% mega crit chance. Unlocks Meta: Mega Crit.' },
  { id:'poe_arc7', branch:'arcane', type:'keystone', x:920, y:800,  req:['poe_arc6'],             max:1, c:10,stat:'bossDmg',  val:0.30,  name:'A.I.D.A. Slayer',  icon:'ui_eye',   desc:'ACTIVE: +30% damage to all bosses. Overpower the network.', active:true },

  // ═══════════════════════════════════════════
  // BLOODLINE (cx=1120, #ff6b9d)
  // ═══════════════════════════════════════════
  { id:'poe_bld0', branch:'bloodline', type:'minor',    x:1120, y:2380, req:[],                        max:3, c:1, stat:'maxHp', val:2,    name:'Sanguine Heritage', icon:'pVamp',  desc:'+2 max HP per level. Deep ancestry flows.' },
  { id:'poe_bld1', branch:'bloodline', type:'minor',    x:1060, y:2080, req:['poe_bld0'],               max:3, c:1, stat:'maxHp', val:2,    name:'Crimson Core',      icon:'heart',  desc:'+2 max HP per level. Vital pulse amplified.' },
  { id:'poe_bld2', branch:'bloodline', type:'minor',    x:1180, y:2080, req:['poe_bld0'],               max:3, c:1, stat:'regen', val:0.03, name:'Vampiric Drain',    icon:'pVamp',  desc:'+0.03 HP/s per level. Absorb vital sparks.' },
  { id:'poe_bld3', branch:'bloodline', type:'notable',  x:1060, y:1780, req:['poe_bld1'],               max:1, c:3, stat:'maxHp', val:8,    name:'Gargantuan Heart',  icon:'heart',  desc:'+8 max HP. Towering endurance.' },
  { id:'poe_bld4', branch:'bloodline', type:'notable',  x:1180, y:1780, req:['poe_bld2'],               max:1, c:4, stat:'regen', val:0.20, name:'Blood Overflow',    icon:'pVamp',  desc:'+0.2 HP/s. Pain turns into raw vitality.' },
  { id:'poe_bld5', branch:'bloodline', type:'notable',  x:1120, y:1480, req:['poe_bld3','poe_bld4'],    max:1, c:5, stat:'dmg',   val:0.10, name:'Ancestral Slaughter',icon:'ui_flame',desc:'+10% damage. Primal fury ignited.' },
  { id:'poe_bld6', branch:'bloodline', type:'keystone', x:1120, y:1180, req:['poe_bld5'],               max:1, c:8, stat:'adrenalSurge', val:6, unlockSkill:'overdrive', unlocksAbilities:true, name:'Adrenal Overdrive', icon:'pQuick', desc:'UNLOCKS THE ABILITIES MENU, and grants Overdrive (+70% fire rate, +35% move speed, infinite ammo for 6s).', active:true },
  { id:'poe_bld7', branch:'bloodline', type:'keystone', x:1120, y:800,  req:['poe_bld6'],               max:1, c:12,stat:'maxHp', val:15,   name:'Undying Monarch',   icon:'ui_star',  desc:'+15 max HP. Your legend cannot be extinguished.' },

  // ═══════════════════════════════════════════
  // VOID (cx=1320, #4dc4ff)
  // ═══════════════════════════════════════════
  { id:'poe_vd0', branch:'void', type:'minor',    x:1320, y:2380, req:[],                      max:3, c:1, stat:'area',     val:0.03,  name:'Abyssal Grasp', icon:'ui_void',  desc:'+3% area per level. The abyss stretches.' },
  { id:'poe_vd1', branch:'void', type:'minor',    x:1260, y:2080, req:['poe_vd0'],             max:3, c:1, stat:'area',     val:0.03,  name:'Event Horizon', icon:'tornado',  desc:'+3% area per level.' },
  { id:'poe_vd2', branch:'void', type:'minor',    x:1380, y:2080, req:['poe_vd0'],             max:3, c:1, stat:'bossDmg',  val:0.05,  name:'Colossus Hunter',icon:'ui_eye',  desc:'+5% boss damage per level.' },
  { id:'poe_vd3', branch:'void', type:'notable',  x:1260, y:1780, req:['poe_vd1'],             max:1, c:3, stat:'voidBurst',val:0.10,  name:'Void Nova',     icon:'ui_star',  desc:'+10% void burst on-kill chance.' },
  { id:'poe_vd4', branch:'void', type:'notable',  x:1380, y:1780, req:['poe_vd2'],             max:1, c:4, stat:'bossDmg',  val:0.15,  name:'Predator Mark', icon:'part_sight',desc:'+15% boss damage. Mark them for total eradication.' },
  { id:'poe_vd5', branch:'void', type:'notable',  x:1320, y:1480, req:['poe_vd3','poe_vd4'],  max:1, c:5, stat:'area',     val:0.15,  name:'Eldritch Domain',icon:'tornado', desc:'+15% area. Overwhelm reality.' },
  { id:'poe_vd6', branch:'void', type:'keystone', x:1320, y:1180, req:['poe_vd5'],             max:1, c:8, stat:'voidBurst',val:0.20,  name:'Void Harbinger',icon:'ui_void',  desc:'+20% void burst chance. Cascading annihilation.' },
  { id:'poe_vd7', branch:'void', type:'keystone', x:1320, y:800,  req:['poe_vd6'],             max:1, c:12,stat:'bossDmg',  val:0.25,  name:'Apex Sovereign',icon:'gbCrown',  desc:'+25% boss damage. You reign supreme over Titans.' },

  // ═══════════════════════════════════════════
  // PETS (cx=1520, #51cf66)
  // ═══════════════════════════════════════════
  { id:'poe_pet0', branch:'pets', type:'minor',    x:1520, y:2380, req:[],                       max:3, c:1, stat:'pickup', val:0.05,  name:'Spirit Link',     icon:'ui_pets',  desc:'+5% pickup range. Companions draw in essence.' },
  { id:'poe_pet1', branch:'pets', type:'minor',    x:1460, y:2080, req:['poe_pet0'],              max:3, c:1, stat:'gold',   val:0.03,  name:'Treasure Hound',  icon:'ui_leaf',  desc:'+3% gold per level. Companions sniff out riches.' },
  { id:'poe_pet2', branch:'pets', type:'minor',    x:1580, y:2080, req:['poe_pet0'],              max:3, c:1, stat:'xp',     val:0.03,  name:'Symbiosis',       icon:'ui_codex', desc:'+3% XP per level. Mutual ascension.' },
  { id:'poe_pet3', branch:'pets', type:'notable',  x:1460, y:1780, req:['poe_pet1'],              max:1, c:3, stat:'pickup', val:0.20,  name:'Pack Magnetism',  icon:'pMagnet',  desc:'+20% pickup range. Wide net harvest.' },
  { id:'poe_pet4', branch:'pets', type:'notable',  x:1580, y:1780, req:['poe_pet2'],              max:1, c:3, stat:'luck',   val:1.0,   name:'Familiar Fortune',icon:'ui_leaf',  desc:'+1 luck. Companions bestow good fortune.' },
  { id:'poe_pet5', branch:'pets', type:'notable',  x:1520, y:1480, req:['poe_pet3','poe_pet4'],   max:1, c:5, stat:'gold',   val:0.15,  name:'Alpha Command',   icon:'ui_star',  desc:'+15% gold. Pack masters command greater rewards.' },
  { id:'poe_pet6', branch:'pets', type:'keystone', x:1520, y:1180, req:['poe_pet5'],              max:1, c:8, stat:'pickup', val:0.30,  name:'Apex Pack',       icon:'ui_pets',  desc:'+30% pickup range. Unrivaled field collection.' },
  { id:'poe_pet7', branch:'pets', type:'keystone', x:1520, y:800,  req:['poe_pet6'],              max:1, c:12,stat:'gold',   val:0.25,  name:'Pack Sovereign',  icon:'gbCrown',  desc:'+25% gold. The beast army claims all.' },

  // ═══════════════════════════════════════════
  // AWAKENING (cx=1720, #ff9900) — evolution + level-up shockwave
  // ═══════════════════════════════════════════
  { id:'poe_awk0', branch:'awakening', type:'notable',  x:1720, y:2380, req:[],               max:1, c:6, stat:'area',  val:0.05,  name:'Awakening Core',       icon:'trident', desc:'Unlocks WEAPON EVOLUTION. Grants +5% area.' },
  { id:'poe_awk1', branch:'awakening', type:'notable',  x:1720, y:2080, req:['poe_awk0'],     max:3, c:3, stat:'area',  val:0.03,  name:'Cataclysm Shockwave',  icon:'pExplode', desc:'+3% area per level. Unlocks: Explosion Dmg meta upgrade.' },
  { id:'poe_awk2', branch:'awakening', type:'keystone', x:1720, y:1780, req:['poe_awk1'],     max:1, c:8, stat:'area',  val:0.10,  name:'Seismic Rupture',      icon:'pExplode', desc:'+10% area. Unlocks: Explosion Knockback meta upgrade.' },
  { id:'poe_awk3',  branch:'awakening', type:'minor',    x:1660, y:1630, req:['poe_awk2'],             max:3, c:2,  stat:'atks',     val:0.03, name:'Quickening Pulse',  icon:'fireRateMult', desc:'+3% attack speed per level. The awakening coil tightens.' },
  { id:'poe_awk3b', branch:'awakening', type:'minor',    x:1780, y:1630, req:['poe_awk2'],             max:3, c:2,  stat:'xp',       val:0.04, name:'Ancient Memory',    icon:'ui_codex',     desc:'+4% XP per level. Forgotten power resurfaces.' },
  { id:'poe_awk4',  branch:'awakening', type:'notable',  x:1720, y:1480, req:['poe_awk3','poe_awk3b'], max:1, c:5,  stat:'area',     val:0.08, name:'Resonance Bloom',   icon:'areaMult',     desc:'+8% area. Massive shockwaves ripple across the field.' },
  { id:'poe_awk5',  branch:'awakening', type:'minor',    x:1720, y:1180, req:['poe_awk4'],             max:3, c:3,  stat:'bossDmg',  val:0.04, name:'Titan Breaker',     icon:'ui_skull',     desc:'+4% boss damage per level. Crush the colossal guardians.' },
  { id:'poe_awk6',  branch:'awakening', type:'keystone', x:1720, y:880,  req:['poe_awk5'],             max:1, c:8,  stat:'proj',     val:1,    name:'Split Manifestation',icon:'doubleHit',    desc:'+1 projectile. Duality of destruction.' },
  { id:'poe_awk7',  branch:'awakening', type:'keystone', x:1720, y:500,  req:['poe_awk6'],             max:1, c:10, stat:'megaCrit', val:0.03, name:'Godhead Ascension', icon:'starBurst',    desc:'+3% Mega Crit. Godlike awakening unleashed.' },

  // ═══════════════════════════════════════════
  // TEMPEST (cx=1920, #1fb6ff) — 5 passives + 3 active keystones, gates the
  // level-5 weapon evolution fork system (see engine.js buildLevelUpChoices)
  // ═══════════════════════════════════════════
  { id:'poe_tmp0', branch:'tempest', type:'minor',    x:1920, y:2380, req:[],                         max:3, c:1, stat:'elementalDmg', val:0.02, name:'Tidal Surge',       icon:'pWave', desc:'+2% elemental damage per level.' },
  { id:'poe_tmp1', branch:'tempest', type:'minor',    x:1920, y:2080, req:['poe_tmp0'],                max:3, c:1, stat:'mspd',         val:0.02, name:'Abyssal Current',   icon:'ui_waterdrop', desc:'+2% move speed per level. The stream carries you.' },
  { id:'poe_tmp2', branch:'tempest', type:'minor',    x:1860, y:1780, req:['poe_tmp1'],                max:3, c:1, stat:'pierce',       val:1,    name:'Riptide Fang',      icon:'harpoon', desc:'+1 pierce per level. Water cuts sharper than steel.' },
  { id:'poe_tmp3', branch:'tempest', type:'minor',    x:1980, y:1780, req:['poe_tmp1'],                max:3, c:2, stat:'area',         val:0.03, name:'Wave Expansion',     icon:'tornado', desc:'+3% area per level. Tidal reach expands.' },
  { id:'poe_tmp4', branch:'tempest', type:'notable',  x:1920, y:1480, req:['poe_tmp2','poe_tmp3'],     max:1, c:4, stat:'crit',         val:0.08, name:'Maelstrom Focus',    icon:'ui_star', desc:'+8% crit chance. The eye of the tempest.' },
  { id:'poe_tmp5', branch:'tempest', type:'keystone', x:1920, y:1180, req:['poe_tmp4'],                max:1, c:8, stat:'forksUnlocked',val:1,    name:'Evolution Vortex',    icon:'tornado', desc:'ACTIVE: Unlocks Weapon Evolution Forks — every weapon gets a 4-way choice at lvl 5.', active:true },
  { id:'poe_tmp6', branch:'tempest', type:'keystone', x:1920, y:880,  req:['poe_tmp5'],                max:1, c:8, stat:'undertowDash', val:1,    name:'Undertow Vortex',   icon:'pQuick', desc:'ACTIVE: Dash pulls enemies and grants +50% invulnerability.', active:true },
  { id:'poe_tmp7', branch:'tempest', type:'keystone', x:1920, y:500,  req:['poe_tmp6'],                max:1, c:10,stat:'riptideMastery',val:1,   name:'Riptide Cataclysm', icon:'pWave', desc:'ACTIVE: Riptide Pulse damage +50% and roots targets for 1s.', active:true },
];

// Fast lookup by ID
export const POE_INDEX = {};
for (const n of POE_TREE_NODES) POE_INDEX[n.id] = n;

// ── Meta upgrade unlock requirements ──────────────
// A meta upgrade is locked until the specified POE node is purchased (lvl >= 1).
export const META_UNLOCK_REQS = {
  m_superCrit: 'poe_arc5',   // Super Strike (ARCANE)
  m_megaCrit:  'poe_arc6',   // Mega Strike  (ARCANE)
  m_revive:    'poe_def7',   // Phoenix      (DEFENSE)
  m_zoom:      'poe_mob5',   // Ghoststep    (MOBILITY) — Eagle Eye meta
  m_dodge:     'poe_mob2',   // Evasion      (MOBILITY)
  m_regen:     'poe_def2',   // Regrowth     (DEFENSE)
  m_start:     'poe_grd5',   // Gold Sense   (GREED) — Starter Cache meta
  c_vamp:      'poe_bld0',   // Vampirism card — requires Bloodline start
  m_lvlBoomDmg:'poe_awk1',   // Shockwave Mastery — explosion damage meta
  m_lvlBoomKB: 'poe_awk2',   // Earthshaker — explosion knockback meta
};

// ── 360° RADIAL LAYOUT ───────────────────────────
// Converts each node's (branch, x, y) into polar coordinates radiating from
// a single center point — same 65-node dataset & depth (no rewrite of node
// costs/reqs), just reprojected: branch → angular sector (evenly spaced
// around the full circle), tier (y-level, inner→outer) → ring radius,
// left/right fan offset (x - branchRootX, always exactly ±60 or 0 in the
// source data) → angular offset within the sector.
export const RADIAL_CENTER = 1500;
// 175 → 240 on 2026-08-17. The hidden H2O chamber lives INSIDE the first
// ring, and at 175 its four nodes (r≈42 with bezel, on a 108 ring) came
// within a few pixels of the branches' own tier-0 start nodes — the centre
// read as crowded rather than as a chamber. This is a uniform radial
// offset: every node keeps its branch, its tier and its angle, the wheel
// just gets a bigger hub. MAX_TIER_RADIUS and the frame ring derive from
// this constant, so they follow automatically.
// Exported because SkillTree.jsx positions the branch emblems relative to
// the first node ring. It used to hard-code 115 against the old value of
// 175, so raising RING_BASE silently stranded them in the middle of the
// hub — derive, never re-type a layout constant.
export const RING_BASE = 240;
const RING_STEP = 140;
const MAX_FAN_OFFSET = 60;

const _branchKeys = Object.keys(POE_BRANCHES);
const _sectorAngle = (2 * Math.PI) / _branchKeys.length;
const _sectorHalfAngle = (_sectorAngle / 2) * 0.68; // leaves a visible gap between branch wedges

const _branchRootX = {};
for (const n of POE_TREE_NODES) {
  if (!n.req || n.req.length === 0) _branchRootX[n.branch] = n.x;
}

// Global tier ranking: every distinct y used in the dataset, innermost
// (largest y / start nodes) first — gives concentric rings shared across all
// branches so the wheel reads as one coherent structure.
const _tierYs = [...new Set(POE_TREE_NODES.map(n => n.y))].sort((a, b) => b - a);
const _tierOfY = {};
_tierYs.forEach((y, i) => { _tierOfY[y] = i; });

export const BRANCH_ANGLES = {};
_branchKeys.forEach((k, i) => { BRANCH_ANGLES[k] = -Math.PI / 2 + i * _sectorAngle; });

export const MAX_TIER = _tierYs.length - 1;
export const MAX_TIER_RADIUS = RING_BASE + MAX_TIER * RING_STEP;

export const POE_RADIAL_INDEX = {};
export const POE_RADIAL_NODES = POE_TREE_NODES.map(n => {
  const baseAngle = BRANCH_ANGLES[n.branch];
  const rootX = _branchRootX[n.branch] ?? n.x;
  const fanFrac = Math.max(-1, Math.min(1, (n.x - rootX) / MAX_FAN_OFFSET));
  const angle = baseAngle + fanFrac * _sectorHalfAngle;
  const tier = _tierOfY[n.y] ?? 0;
  const radius = RING_BASE + tier * RING_STEP;
  const out = {
    ...n,
    tier, radius, angle,
    rx: RADIAL_CENTER + radius * Math.cos(angle),
    ry: RADIAL_CENTER + radius * Math.sin(angle),
  };
  POE_RADIAL_INDEX[n.id] = out;
  return out;
});

// ── H2O capstone cluster ─────────────────────────
// Timmy, 2026-08-17: hidden entirely (not dimmed-but-visible like every
// other locked node — genuinely absent) until every single node above is
// maxed. Then reveals a 1-ring cluster at the tree's dead center: 4 nodes
// in a circle, each a standalone "as good as Second Wind" passive, plus a
// 5th node exactly in the middle — "H2O" — that requires all 4 ring nodes
// and grants Dual Guns (dual-wielding the equipped MANUAL weapon; auto
// weapons are covered by one of the ring nodes instead, see below).
//
// Deliberately NOT routed through the branch/tier deriver above — these
// aren't part of any of the 10 real branches (adding an 11th branch key
// to POE_BRANCHES would reflow every other node's angle, since the
// branch count directly drives the sector-angle math). rx/ry are set
// directly instead. `type: 'notable'`/`'keystone'` are reused purely to
// get the existing hex/octagon backdrop and radius for free — this isn't
// really part of the notable/keystone tier system, just borrowing its
// look.
//
// `c: 0` — these are the reward for maxing the whole tree, not one more
// thing to grind SP for. Buying still requires a click (keeps the
// claim-the-reward moment) but never blocks on affordability.
//
// Two of the four ring passives (Second Wind, Overcharge) and the H2O
// core's Dual Guns are locked in via Timmy's own messages; "Deluge" and
// "Undying Tide" are Claude's picks for the other two ring slots (he
// explicitly handed off "hitta på nått coolt" — come up with something
// that fits) — rename/replace freely if he doesn't like them.
export const POE_H2O_BRANCH = { name: 'H2O', icon: 'ui_waterdrop', color: '#8fe8ff', glow: 'rgba(143,232,255,0.6)' };
// Timmy, 2026-08-17, on where the four hidden nodes should sit: "om du
// tänker dom klockslagen så borde dom 4 nodsen sitta innåt". So they are
// placed on CLOCK POSITIONS — 1, 4, 7 and 10 o'clock — rather than on
// 12/3/6/9 where they were. Still 90° apart, just rotated 30°, which
// keeps them off the vertical and horizontal branch spokes so the cluster
// reads as its own thing rather than as an extension of four branches.
// 12 o'clock is -90° in SVG and each hour is +30°.
const H2O_RING_R = 140;
const CLOCK = h => (-90 + h * 30) * Math.PI / 180;
const H2O_HOURS = [1, 4, 7, 10];
export const POE_H2O_NODES = [
  { id: 'h2o_ring_1', branch: 'h2o', type: 'notable', req: [], max: 1, c: 0, stat: 'secondWind', val: 1,
    name: 'Tidal Aegis', icon: 'ui_shield',
    desc: 'Once per run, dropping below 15% HP triggers an impenetrable emergency shield + instant heal.',
    rx: RADIAL_CENTER + H2O_RING_R * Math.cos(CLOCK(H2O_HOURS[0])), ry: RADIAL_CENTER + H2O_RING_R * Math.sin(CLOCK(H2O_HOURS[0])) },
  { id: 'h2o_ring_2', branch: 'h2o', type: 'notable', req: [], max: 1, c: 0, stat: 'autoProjectile', val: 1,
    name: 'Dual Catalyst', icon: 'ui_star',
    desc: '+1 projectile on every automated secondary weapon.',
    rx: RADIAL_CENTER + H2O_RING_R * Math.cos(CLOCK(H2O_HOURS[1])), ry: RADIAL_CENTER + H2O_RING_R * Math.sin(CLOCK(H2O_HOURS[1])) },
  { id: 'h2o_ring_3', branch: 'h2o', type: 'notable', req: [], max: 1, c: 0, stat: 'deluge', val: 1,
    name: 'Abyssal Deluge', icon: 'pWave',
    desc: 'Every 20 kills, unleash a cataclysmic wave: colossal damage + screen-wide knockback.',
    rx: RADIAL_CENTER + H2O_RING_R * Math.cos(CLOCK(H2O_HOURS[2])), ry: RADIAL_CENTER + H2O_RING_R * Math.sin(CLOCK(H2O_HOURS[2])) },
  { id: 'h2o_ring_4', branch: 'h2o', type: 'notable', req: [], max: 1, c: 0, stat: 'undyingTide', val: 1,
    name: 'Immortal Current', icon: 'heart',
    desc: '+1% max HP and +1% armor for every 30s survived this run, uncapped.',
    rx: RADIAL_CENTER + H2O_RING_R * Math.cos(CLOCK(H2O_HOURS[3])), ry: RADIAL_CENTER + H2O_RING_R * Math.sin(CLOCK(H2O_HOURS[3])) },
  { id: 'h2o_core', branch: 'h2o', type: 'keystone', req: ['h2o_ring_1', 'h2o_ring_2', 'h2o_ring_3', 'h2o_ring_4'], max: 1, c: 0, stat: 'dualGuns', val: 1,
    name: 'H2O Dual Guns Protocol', icon: 'ui_waterdrop', active: true,
    desc: 'ACTIVE: dual-wield your equipped manual weapon — double devastation in both hands!',
    rx: RADIAL_CENTER, ry: RADIAL_CENTER },
];
export const POE_H2O_INDEX = {};
for (const n of POE_H2O_NODES) POE_H2O_INDEX[n.id] = n;

// ── The line that makes the capstone actually DO something ──────────
// POE_INDEX is the map `GameScreen.jsx`'s buildMetaEffects walks to turn
// owned nodes into run stats. It was built from POE_TREE_NODES alone, and
// the H2O cluster is deliberately not in that array (it belongs to no
// branch), so all five nodes were purchasable, lit up, and completely
// inert — the exact dead-config failure this project keeps hitting.
// Registering them here is step one; the engine also has to READ each
// stat, which it now does (engine.js: secondWind, autoProjectile, deluge,
// undyingTide, dualGuns).
for (const n of POE_H2O_NODES) POE_INDEX[n.id] = n;

// True once every node in the normal 65-node tree is at its max level —
// the sole unlock condition for the H2O cluster. Deliberately excludes
// POE_H2O_NODES themselves (checking "is everything maxed" against a set
// that includes the reward for being maxed would be circular).
export function isTreeFullyMaxed(skills) {
  return POE_TREE_NODES.every(n => (skills?.[n.id] || 0) >= n.max);
}

// ── Attribute system ────────────────────────────
// Each profile level grants 1 attribute point.
// Stored in save.attrs: { atk, dex, vit, mob, int, ele, mag, aim, luck }
// mob (Agility) and aim (Aim) are special: instead of the generic flat
// perPoint bonus every other attribute uses, they drive a non-linear
// -33%..+33% curve computed directly in engine.js (agilityMult/
// aimSpreadMult) — see GameScreen.jsx's buildMetaEffects, which explicitly
// skips them in the generic attribute-bonus loop to avoid double-applying.
export const POE_ATTRS = [
  { id:'atk',  name:'Attack',       icon:'ui_blade',  color:'#ff3146', stat:'dmg',   perPoint:0.01,  desc:'+1% damage per attribute point' },
  { id:'dex',  name:'Dexterity',    icon:'part_sight',  color:'#4dffd4', stat:'crit',  perPoint:0.005, desc:'+0.5% crit chance per point' },
  { id:'vit',  name:'Vitality',     icon:'heart',  color:'#ffd166', stat:'maxHp', perPoint:2,     desc:'+2 max HP per point' },
  { id:'mob',  name:'Agility',      icon:'pQuick',  color:'#4dffd4', stat:null,   perPoint:0,     curve:true, max:20,
    desc:'Moving, turning, dashing feels sluggish at 0 — 20 points makes you noticeably snappier than the game’s default feel.' },
  { id:'aim',  name:'Aim',          icon:'part_sight',  color:'#ffffff', stat:null,   perPoint:0,     curve:true, max:20,
    desc:'Shots land a little wide of dead-center at 0 — 20 points buys back tight, reliable accuracy.' },
  { id:'int',  name:'Intelligence', icon:'ui_codex',  color:'#b362ff', stat:'xp',    perPoint:0.005, desc:'+0.5% XP per point' },
  { id:'ele',  name:'Elemental',    icon:'tornado',  color:'#4dc4ff', stat:'elementalDmg', perPoint:0.008, desc:'+0.8% elemental damage per point' },
  { id:'mag',  name:'Magic',        icon:'ui_orb',  color:'#b362ff', stat:'atks',  perPoint:0.005, desc:'+0.5% attack speed per point' },
  { id:'luck', name:'Luck',         icon:'ui_leaf',  color:'#4dff91', stat:'luck',  perPoint:0.15,  desc:'+0.15 luck per point (better card/loot rarity rolls)' },
];
