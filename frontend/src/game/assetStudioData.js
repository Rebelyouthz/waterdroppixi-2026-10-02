// Waterdrop Survivor — ASSET DESIGN STUDIO & MASTER CATALOG
// Allows the developer/user to preview 5 distinct visual styles for every major game element,
// choose their favorite options, and export a design manifest before baking.

export const DESIGN_CATEGORIES = [
  {
    id: 'hero_avatar',
    title: 'DEAD CELLS HERO CHARACTER DESIGN',
    sheetImage: '/studio/deadcells_hero_5styles.jpg',
    description: 'Protagonist sprite style, elemental variations, and character personality in Dead Cells 32-bit pixel art.',
    options: [
      { id: 1, name: 'Cyan Fluid Assassin', color: '#5fd6ff', desc: 'Dead Cells style water assassin with glowing orange eye, crimson scarf, leather belt & dual pixel daggers.' },
      { id: 2, name: 'Dark Void Phantom', color: '#b362ff', desc: 'Ethereal shadow phantom with internal galaxy stardust, glowing horns & curved void scythe.' },
      { id: 3, name: 'Cyber Nanotech Drop', color: '#39ff14', desc: 'Cyborg droplet with green circuitry, cyber visor, mechanical pauldrons & plasma blade.' },
      { id: 4, name: 'Solar Knight Droplet', color: '#ffd166', desc: 'Ornate burnished gold pixel armor with radiant sun corona and heavy broadsword.' },
      { id: 5, name: 'Blood Moon Berserker', color: '#ff3355', desc: 'Spiky obsidian plate armor with glowing red eyes and dripping crimson energy blades.' },
    ],
  },
  {
    id: 'weapons_combat',
    title: 'WEAPONS & COMBAT SLASH EFFECTS',
    sheetImage: '/studio/deadcells_weapons_5styles.jpg',
    description: 'Melee weapons, blasters, bows, and dynamic glowing slash impact effects in Dead Cells style.',
    options: [
      { id: 1, name: 'Hydro Katana (Tidal Wave)', color: '#5fd6ff', desc: 'Curved liquid steel katana unleashing sweeping high-speed water blade arcs.' },
      { id: 2, name: 'Void Scythe (Event-Horizon)', color: '#b362ff', desc: 'Massive dark matter scythe creating spinning purple black hole vortexes on hit.' },
      { id: 3, name: 'Plasma Blaster (Neon Burst)', color: '#39ff14', desc: 'High-frequency particle pistol firing rapid neon green laser bursts.' },
      { id: 4, name: 'Solstice Sun Greatbow (Blazing Arrow)', color: '#ffd166', desc: 'Golden celestial greatbow firing blazing spears of pure sunlight.' },
      { id: 5, name: 'Crimson Blood Daggers (Bleed Sparks)', color: '#ff3355', desc: 'Triple serrated daggers flinging razor-sharp blood spikes that cause bleed.' },
    ],
  },
  {
    id: 'xp_drops',
    title: 'XP DROPS & ENERGY PICKUPS',
    sheetImage: '/studio/deadcells_xp_gems_5styles.jpg',
    description: 'In-game collectible energy orbs and soul drops dropped by defeated enemies.',
    options: [
      { id: 1, name: 'Water Souls (Pure Liquid)', color: '#4dc4ff', desc: 'Glossy crystalline water droplet with fluid splash particles & bright specular gleam.' },
      { id: 2, name: 'Cosmic Shards (Stardust)', color: '#b362ff', desc: 'Facet-cut purple crystal cluster orbiting a miniature spinning galaxy spiral.' },
      { id: 3, name: 'Emerald Cyber Nanite Cores', color: '#39ff14', desc: 'Glowing green cyber data cubes with laser circuit traces & wireframe glitch aura.' },
      { id: 4, name: 'Golden Solar Sun Topaz', color: '#ffd166', desc: 'Blazing golden crystal with radiant fire sparks and orbiting solar flare rings.' },
      { id: 5, name: 'Dark Crimson Blood Rubies', color: '#ff3355', desc: 'Dark crimson carved obelisk with pulsing occult runes and dripping blood mist.' },
    ],
  },
  {
    id: 'chests',
    title: 'LOOT CHESTS & REWARD CONTAINERS',
    sheetImage: '/studio/deadcells_chests_5styles.jpg',
    description: 'Mystery caches, boss drops, and milestone reward containers across game modes.',
    options: [
      { id: 1, name: 'High-Tech Cyber Crate', color: '#4dffd4', desc: 'Reinforced alloy box with cyan holographic status lock & glowing cables.' },
      { id: 2, name: 'Ancient Monolith Stone Chest', color: '#7ad96b', desc: 'Moss-covered stone sarcophagus with luminous green celtic runes & emerald interior glow.' },
      { id: 3, name: 'Royal Solstice Gilded Chest', color: '#ffd166', desc: 'Ornate mahogany & polished gold treasure coffer with radiant sun emblem.' },
      { id: 4, name: 'Occult Bloodstone Reliquary', color: '#ff3355', desc: 'Spiked dark obsidian chest bound in glowing crimson chains with blood-red runes.' },
      { id: 5, name: 'Deep Space Hazard Pod', color: '#c8ccd4', desc: 'Weathered industrial metal container with yellow-black hazard stripes & heavy latches.' },
    ],
  },
  {
    id: 'ui_hud',
    title: 'UI HUD & COMBAT INTERFACES',
    sheetImage: '/studio/deadcells_ui_hud_5styles.jpg',
    description: 'Health bars, stamina meters, ability skill hotbars, and telemetry displays in Dead Cells pixel style.',
    options: [
      { id: 1, name: 'Cyberpunk Holographic HUD', color: '#5fd6ff', desc: 'Translucent cyan glassmorphism panels with live digital telemetry.' },
      { id: 2, name: 'Amber CRT Terminal HUD', color: '#ffaa00', desc: 'Vintage monospace phosphor display with segmented bars and scanlines.' },
      { id: 3, name: 'Dark Obsidian Minimalist HUD', color: '#ff3146', desc: 'Ultra-clean matte black bezels with razor-sharp crimson status gauges.' },
      { id: 4, name: 'Heavy Sci-Fi Titanium Mech HUD', color: '#ffd166', desc: 'Riveted steel industrial dashboard with caution tape and hydraulic meters.' },
      { id: 5, name: 'Occult Blood-Rune HUD', color: '#ff3355', desc: 'Gothic stone frame with dripping red vitality crystals and burning candles.' },
    ],
  },
  {
    id: 'station_vistas',
    title: 'SPACE STATION PANORAMIC VISTAS',
    sheetImage: '/backgrounds/vista_earth.jpg',
    description: 'Observation bay window panoramic background views for the Space Station Camp.',
    options: [
      { id: 1, name: 'Earth Twilight Orbit', color: '#5fd6ff', desc: 'Azure blue atmospheric curve with glowing city lights below and glittering stars.' },
      { id: 2, name: 'Deep Quasar Void', color: '#b362ff', desc: 'Ethereal purple & magenta cosmic nebula with a spinning pulsar accretion disk.' },
      { id: 3, name: 'Solstice Sun Corona', color: '#ffd166', desc: 'Blazing golden solar flares and sacred geometry energy rings orbiting the sun.' },
      { id: 4, name: 'Blood Moon Eclipse', color: '#ff3355', desc: 'Crimson lunar eclipse with dark orbital redwood silhouettes & blood mist.' },
      { id: 5, name: 'Cyber Megacity Ecumenopolis', color: '#39ff14', desc: 'High-orbit vista over an infinite cyberpunk city with glowing neon highway grids.' },
    ],
  },
];

const STORAGE_KEY = 'waterdrop_design_studio_choices';

export function loadDesignChoices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    xp_drops: 1,
    gems: 1,
    chests: 1,
    ui_hud: 1,
    hero_avatar: 1,
    station_vistas: 1,
  };
}

export function saveDesignChoices(choices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch (e) {}
}
