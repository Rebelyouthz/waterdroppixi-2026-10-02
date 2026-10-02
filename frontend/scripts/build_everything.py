import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from build_master_spritesheet_library import polish_all_master_assets
from build_auto_weapons_and_effects import (
    build_blood_scythe_sweep, build_ember_orbs, build_rune_bolts,
    build_shockwave_annunaki, build_tide_whip, build_void_beam_core, build_tesla_arc
)
from generate_game_spritesheets import (
    generate_meteor_strike, generate_waterdrop_reload, generate_waterdrop_dual_guns,
    generate_waterdrop_meteor_cast, generate_whirlwind_blade, generate_frost_orbs
)
from build_core_character_moves import (
    generate_origin_awakening, generate_skid_slide, generate_backpedal,
    generate_dash_swipe, generate_dire_lowhp
)
from generate_evolutions_skills_and_finishers import (
    generate_evo_soul_reaper, generate_evo_solar_flare_orbs,
    generate_skill_overdrive, generate_skill_bulwark_shield, generate_skill_bloodrush,
    generate_finisher_hydro_drill
)
import build_full_game_and_star_atlas_assets

if __name__ == "__main__":
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    FW, FH = 128, 128
    
    print("=========================================================")
    print("EXECUTING FULL MASTER SPRITESHEET GENERATION PIPELINE...")
    print("=========================================================")
    
    # 1. Master Character Gaits & Combat Weapons (2x supersampled)
    polish_all_master_assets(out_dir)
    
    # 2. Auto Weapons & Orbitals
    print("\nGenerating Autonomous Orbitals & Entities...")
    build_blood_scythe_sweep(os.path.join(out_dir, "auto_weapons", "bloodscythe-sweep-16.png"), FW, FH)
    build_ember_orbs(os.path.join(out_dir, "auto_weapons", "ember-orb-orbit-16.png"), FW, FH)
    build_rune_bolts(os.path.join(out_dir, "auto_weapons", "rune-bolt-homing-16.png"), FW, FH)
    build_shockwave_annunaki(os.path.join(out_dir, "auto_weapons", "shockwave-annunaki-16.png"), FW, FH)
    build_tide_whip(os.path.join(out_dir, "auto_weapons", "tide-whip-lash-16.png"), FW, FH)
    build_void_beam_core(os.path.join(out_dir, "auto_weapons", "void-beam-vortex-16.png"), FW, FH)
    build_tesla_arc(os.path.join(out_dir, "auto_weapons", "arc-tesla-lightning-16.png"), FW, FH)
    generate_whirlwind_blade(os.path.join(out_dir, "auto_weapons", "whirlwind-blade-orbit-16.png"))
    generate_frost_orbs(os.path.join(out_dir, "auto_weapons", "frost-orbs-orbit-16.png"))
    generate_evo_soul_reaper(os.path.join(out_dir, "auto_weapons", "soul-reaper-evo-16.png"))
    generate_evo_solar_flare_orbs(os.path.join(out_dir, "auto_weapons", "solar-flare-evo-16.png"))

    # 3. Active Skills & Meteors
    print("\nGenerating Active Skills & Meteors...")
    generate_meteor_strike(os.path.join(out_dir, "skills", "meteor-strike-impact-16.png"))
    generate_skill_overdrive(os.path.join(out_dir, "skills", "skill-overdrive-16.png"))
    generate_skill_bulwark_shield(os.path.join(out_dir, "skills", "skill-bulwark-shield-16.png"))
    generate_skill_bloodrush(os.path.join(out_dir, "skills", "skill-bloodrush-16.png"))

    # 4. Character Actions & Mechanics
    print("\nGenerating Character Actions...")
    generate_waterdrop_reload(os.path.join(out_dir, "character_actions", "waterdrop-reload-16.png"))
    generate_waterdrop_dual_guns(os.path.join(out_dir, "character_actions", "waterdrop-dual-guns-16.png"))
    generate_waterdrop_meteor_cast(os.path.join(out_dir, "character_actions", "waterdrop-meteor-cast-16.png"))
    generate_finisher_hydro_drill(os.path.join(out_dir, "combat", "waterdrop-hydro-drill-finisher-16.png"))

    # 5. Intro & Origin
    print("\nGenerating Intro & Advanced Movements...")
    generate_origin_awakening(os.path.join(out_dir, "intro", "waterdrop-origin-awakening-16.png"))
    generate_skid_slide(os.path.join(out_dir, "character", "waterdrop-skid-slide-16.png"))
    generate_backpedal(os.path.join(out_dir, "character", "waterdrop-backpedal-16.png"))
    generate_dash_swipe(os.path.join(out_dir, "character", "waterdrop-dash-swipe-16.png"))
    generate_dire_lowhp(os.path.join(out_dir, "character", "waterdrop-dire-lowhp-16.png"))

    # 6. Star Atlas & Full Weapons
    print("\nGenerating Star Atlas & All Star Weapons...")
    build_full_game_and_star_atlas_assets.generate_starship_interceptor_16angles(os.path.join(out_dir, "star_ships", "star-ship-interceptor-16angles.png"))
    build_full_game_and_star_atlas_assets.generate_starship_thruster_flight(os.path.join(out_dir, "star_ships", "star-ship-flight-thruster-16.png"))
    build_full_game_and_star_atlas_assets.generate_starship_shield_barrier(os.path.join(out_dir, "star_ships", "star-ship-shield-barrier-16.png"))
    build_full_game_and_star_atlas_assets.generate_tidal_harpoon_combat(os.path.join(out_dir, "combat", "waterdrop-tidal-harpoon-16.png"))
    build_full_game_and_star_atlas_assets.generate_twin_revolvers_combat(os.path.join(out_dir, "combat", "waterdrop-twin-revolvers-16.png"))
    build_full_game_and_star_atlas_assets.generate_void_scattergun_combat(os.path.join(out_dir, "combat", "waterdrop-void-scatter-16.png"))
    build_full_game_and_star_atlas_assets.generate_arc_caster_combat(os.path.join(out_dir, "combat", "waterdrop-arc-caster-16.png"))
    build_full_game_and_star_atlas_assets.generate_comet_launcher_combat(os.path.join(out_dir, "combat", "waterdrop-comet-launcher-16.png"))
    build_full_game_and_star_atlas_assets.generate_acid_sprayer_combat(os.path.join(out_dir, "combat", "waterdrop-acid-sprayer-16.png"))
    build_full_game_and_star_atlas_assets.generate_drone_squadron_entity(os.path.join(out_dir, "auto_weapons", "drone-squadron-16.png"))
    build_full_game_and_star_atlas_assets.generate_plasma_turret_entity(os.path.join(out_dir, "auto_weapons", "plasma-turret-16.png"))
    build_full_game_and_star_atlas_assets.generate_shrapnel_mine_entity(os.path.join(out_dir, "auto_weapons", "shrapnel-mine-16.png"))
    build_full_game_and_star_atlas_assets.generate_railgun_array_entity(os.path.join(out_dir, "auto_weapons", "railgun-array-16.png"))

    print("\n=========================================================")
    print("ALL SPRITESHEETS SUCCESSFULLY GENERATED AND READY ON DISK!")
    print("=========================================================")
