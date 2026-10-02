import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw

FW_HI, FH_HI = 256, 256
FW, FH = 128, 128
ANCHOR_X_HI, ANCHOR_Y_HI = 128, 224

from build_master_spritesheet_library import draw_waterdrop_hero_hi, draw_shadow_hi

def save_hi_strip(hi_frames, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    total_w = FW * len(hi_frames)
    strip = Image.new("RGBA", (total_w, FH), (0, 0, 0, 0))
    for i, hf in enumerate(hi_frames):
        lo_frame = hf.resize((FW, FH), Image.Resampling.LANCZOS)
        strip.paste(lo_frame, (i * FW, 0), lo_frame)
    strip.save(output_path, "PNG")
    print(f"Exported Camp Asset (Dead-Cells Polish): {output_path} ({total_w}x{FH}, {len(hi_frames)} frames)")

# =============================================================================
# 1. CAMP HERO SPRITES (Calm, relaxed, exploration gait)
# =============================================================================

def generate_camp_hero_idle(output_path):
    """16 frames of relaxed exploration idle in camp with soft sway and blinks."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        bob = math.sin(t * math.pi * 2) * 3.0
        wob = math.sin(t * math.pi * 2) * 2.0
        flow = math.sin(t * math.pi * 2) * 0.3
        blink = 'squint' if i in (7, 8) else 'normal'
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, body_bob=bob, wobble=wob, headband_flow=flow, eye_type=blink)
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_camp_hero_walk(output_path):
    """16 frames of relaxed walking through station hallways."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        leg_ph = t * math.pi * 2
        bob = -abs(math.sin(leg_ph)) * 5.0
        wob = math.sin(leg_ph) * 3.0
        flow = -0.4 + math.sin(leg_ph) * 0.4
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, tilt=0.08, leg_phase=leg_ph, leg_spread=24, body_bob=bob, wobble=wob, headband_flow=flow, facing=1.0)
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

# =============================================================================
# 2. CAMP STATIONS & INTERACTIVE FIXTURES (2X SUPERSAMPLED)
# =============================================================================

def generate_aida_core(output_path):
    """16 frames of A.I.D.A. Data Core: floating holographic waterdrop with spinning orbital rings."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 130 + int(math.sin(t * math.pi * 2) * 6)
        
        # Plinth base on floor
        draw_shadow_hi(draw, 128, ANCHOR_Y_HI, radius_x=48, radius_y=16, alpha=120)
        draw.polygon([(100, ANCHOR_Y_HI - 10), (156, ANCHOR_Y_HI - 10), (168, ANCHOR_Y_HI + 8), (88, ANCHOR_Y_HI + 8)], fill=(32, 44, 58, 255), outline=(14, 22, 32, 255))
        # Hologram projector beam
        draw.polygon([(112, ANCHOR_Y_HI - 10), (144, ANCHOR_Y_HI - 10), (cx + 36, cy + 30), (cx - 36, cy + 30)], fill=(79, 216, 255, 30))
        
        # Floating Hologram Waterdrop AI Core
        draw.polygon([(cx, cy - 36), (cx + 28, cy + 8), (cx + 20, cy + 28), (cx - 20, cy + 28), (cx - 28, cy + 8)], fill=(79, 216, 255, 180), outline=(220, 250, 255, 255))
        draw.circle((cx, cy + 2), radius=8, fill=(255, 255, 255, 240))
        
        # Spinning telemetry rings
        r_ring = 42
        ring_ang = t * math.pi * 2
        draw.ellipse([cx - r_ring, cy - 14, cx + r_ring, cy + 14], outline=(120, 230, 255, 200), width=3)
        # Orbiting data node
        nod_x = cx + math.cos(ring_ang) * r_ring
        nod_y = cy + math.sin(ring_ang) * 14
        draw.circle((nod_x, nod_y), radius=5, fill=(255, 255, 255, 255))
        
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_forge_station(output_path):
    """16 frames of Fabrication & Forge: glowing thermal crucible with sparks and molten metal."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 140
        
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=54, radius_y=16, alpha=100)
        # Heavy industrial anvil plinth
        draw.rectangle([76, 150, 180, ANCHOR_Y_HI], fill=(42, 48, 60, 255), outline=(18, 22, 30, 255))
        # Molten crucible heat chamber
        glow_pulse = 0.7 + math.sin(t * math.pi * 4) * 0.3
        draw.rectangle([92, 160, 164, 200], fill=(255, int(100 * glow_pulse), 20, 255), outline=(255, 200, 80, 255))
        draw.rectangle([104, 168, 152, 192], fill=(255, 240, 180, int(240 * glow_pulse)))
        
        # Flying anvil sparks
        for sp in range(6):
            sp_ang = -1.8 + sp * 0.6 + math.sin(t * math.pi * 2 + sp) * 0.2
            sp_dist = 30 + ((i * 12 + sp * 18) % 40)
            sx = cx + math.cos(sp_ang) * sp_dist
            sy = 150 + math.sin(sp_ang) * sp_dist
            draw.circle((sx, sy), radius=2.5, fill=(255, 220, 120, 240))
            
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_navigation_station(output_path):
    """16 frames of Navigation: rotating 3D holographic star chart & planetary orbits."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 130
        
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=50, radius_y=14, alpha=100)
        draw.polygon([(88, 180), (168, 180), (180, ANCHOR_Y_HI), (76, ANCHOR_Y_HI)], fill=(34, 46, 62, 255), outline=(12, 18, 26, 255))
        
        # Hologram globe & orbital trajectories
        draw.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], outline=(79, 216, 255, 120), width=2)
        draw.ellipse([cx - 48, cy - 14, cx + 48, cy + 14], outline=(140, 235, 255, 180), width=2)
        # Rotating star nodes
        star_a = t * math.pi * 2
        draw.circle((cx + math.cos(star_a) * 34, cy + math.sin(star_a) * 34), radius=4, fill=(255, 255, 255, 255))
        draw.circle((cx + math.cos(star_a + math.pi) * 48, cy + math.sin(star_a + math.pi) * 14), radius=5, fill=(79, 216, 255, 255))
        
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_biolab_station(output_path):
    """16 frames of Bio Lab: cryo-incubation tank with mutation embryo and rising nutrient bubbles."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 140
        
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=44, radius_y=14, alpha=100)
        # Glass cryo-tank chamber
        draw.rectangle([88, 80, 168, ANCHOR_Y_HI - 10], fill=(20, 80, 60, 140), outline=(80, 220, 160, 240))
        draw.rectangle([80, 70, 176, 84], fill=(40, 50, 65, 255), outline=(15, 22, 30, 255))
        draw.rectangle([80, ANCHOR_Y_HI - 12, 176, ANCHOR_Y_HI + 4], fill=(40, 50, 65, 255), outline=(15, 22, 30, 255))
        
        # Mutation embryo core
        emb_y = cy + int(math.sin(t * math.pi * 2) * 4)
        draw.ellipse([cx - 16, emb_y - 20, cx + 16, emb_y + 20], fill=(120, 255, 180, 220), outline=(255, 255, 255, 255))
        
        # Rising green bubbles
        for b in range(5):
            by = ANCHOR_Y_HI - 20 - ((i * 10 + b * 26) % 100)
            bx = 98 + ((b * 16) % 60)
            draw.circle((bx, by), radius=3, fill=(180, 255, 210, 200))
            
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_well_station(output_path):
    """16 frames of Reclamation Well: deep bioluminescent water pool with concentric hydro ripples."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 160
        
        # Well basin rim
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=56, radius_y=20, alpha=120)
        draw.ellipse([cx - 56, cy - 28, cx + 56, cy + 28], fill=(18, 30, 44, 255), outline=(60, 90, 120, 255))
        # Glowing aquatic pool
        draw.ellipse([cx - 46, cy - 20, cx + 46, cy + 20], fill=(16, 88, 132, 240))
        
        # Concentric water ripple waves
        for w in range(3):
            r_rip = ((t + w / 3.0) % 1.0) * 42
            draw.ellipse([cx - r_rip, cy - r_rip*0.44, cx + r_rip, cy + r_rip*0.44], outline=(140, 235, 255, int(240*(1-r_rip/42.0))), width=2)
            
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_hangar_station(output_path):
    """16 frames of Hangar Bay: heavy blast doors with hazard markings and flashing beacon lights."""
    hi_frames = []
    for i in range(16):
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 140
        
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=60, radius_y=16, alpha=100)
        # Heavy blast doors
        draw.rectangle([60, 80, 196, ANCHOR_Y_HI], fill=(36, 42, 54, 255), outline=(12, 16, 24, 255))
        draw.line([(128, 80), (128, ANCHOR_Y_HI)], fill=(12, 16, 24, 255), width=4)
        
        # Hazard stripes
        for h in range(6):
            hx = 64 + h * 22
            draw.polygon([(hx, ANCHOR_Y_HI - 18), (hx + 12, ANCHOR_Y_HI - 18), (hx + 4, ANCHOR_Y_HI), (hx - 8, ANCHOR_Y_HI)], fill=(240, 190, 40, 255))
            
        # Flashing red/yellow warning beacons
        beacon_col = (255, 200, 40, 255) if (i % 4 < 2) else (80, 60, 10, 255)
        draw.circle((76, 92), radius=6, fill=beacon_col)
        draw.circle((180, 92), radius=6, fill=beacon_col)
        
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_defense_console(output_path):
    """16 frames of Defense Console: tactical status screens with rotating green radar sweep."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 150
        
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=50, radius_y=14, alpha=100)
        draw.rectangle([76, 120, 180, ANCHOR_Y_HI], fill=(30, 36, 48, 255), outline=(10, 15, 22, 255))
        # CRT tactical screen
        draw.rectangle([88, 130, 168, 180], fill=(12, 36, 28, 255), outline=(40, 180, 100, 255))
        
        # Rotating green radar sweep
        radar_cx, radar_cy = 128, 155
        sweep_ang = t * math.pi * 2
        draw.line([(radar_cx, radar_cy), (radar_cx + math.cos(sweep_ang)*28, radar_cy + math.sin(sweep_ang)*18)], fill=(120, 255, 160, 255), width=2)
        draw.circle((radar_cx + 12, radar_cy - 6), radius=2, fill=(255, 60, 60, 255)) # Enemy blip
        
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

def generate_floor_emblem(output_path):
    """16 frames of Floor Emblem: inlaid titanium drop crest with glowing cyan circuit traces."""
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 128, 128
        
        pulse = 0.7 + math.sin(t * math.pi * 2) * 0.3
        # Outer titanium ring
        draw.ellipse([cx - 58, cy - 32, cx + 58, cy + 32], outline=(60, 90, 115, 255), width=4)
        # Glowing circuit traces
        draw.ellipse([cx - 52, cy - 28, cx + 52, cy + 28], outline=(79, 216, 255, int(220 * pulse)), width=2)
        # Central drop crest
        draw.polygon([(cx, cy - 20), (cx + 18, cy + 10), (cx, cy + 18), (cx - 18, cy + 10)], fill=(79, 216, 255, int(190 * pulse)), outline=(220, 250, 255, 255))
        
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, output_path)

# =============================================================================
# MASTER BUILDER FOR WALKABLE CAMP
# =============================================================================

def build_all_camp_assets(out_dir):
    camp_dir = os.path.join(out_dir, "camp")
    os.makedirs(camp_dir, exist_ok=True)
    
    print("================================================================")
    print("BUILDING ALL WALKABLE CAMP & STATION SPRITES (DEAD CELLS QA)...")
    print("================================================================")
    
    # 1. Camp Hero Gaits
    generate_camp_hero_idle(os.path.join(camp_dir, "camp-hero-idle-16.png"))
    generate_camp_hero_walk(os.path.join(camp_dir, "camp-hero-walk-16.png"))
    
    # 2. Interactive Stations & Core
    generate_aida_core(os.path.join(camp_dir, "camp-core-aida-16.png"))
    generate_forge_station(os.path.join(camp_dir, "camp-station-forge-16.png"))
    generate_navigation_station(os.path.join(camp_dir, "camp-station-navigation-16.png"))
    generate_biolab_station(os.path.join(camp_dir, "camp-station-biolab-16.png"))
    generate_well_station(os.path.join(camp_dir, "camp-station-well-16.png"))
    generate_hangar_station(os.path.join(camp_dir, "camp-station-hangar-16.png"))
    generate_defense_console(os.path.join(camp_dir, "camp-station-defense-16.png"))
    generate_floor_emblem(os.path.join(camp_dir, "camp-floor-emblem-16.png"))
    
    # 3. Update master manifest
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "r") as f:
        data = json.load(f)
        
    data["categories"]["walkable_camp"] = {
        "hero_idle": { "file": "camp/camp-hero-idle-16.png", "frames": 16, "fps": 12, "desc": "Camp exploration hero idle with relaxed breathing & blinks" },
        "hero_walk": { "file": "camp/camp-hero-walk-16.png", "frames": 16, "fps": 16, "desc": "Camp exploration hero walk cycle through station corridors" },
        "aida_core": { "file": "camp/camp-core-aida-16.png", "frames": 16, "fps": 18, "desc": "A.I.D.A. Data Core with floating holographic waterdrop & spinning telemetry rings" },
        "station_forge": { "file": "camp/camp-station-forge-16.png", "frames": 16, "fps": 20, "desc": "Fabrication & Weapon Forge with thermal crucible & flying sparks" },
        "station_navigation": { "file": "camp/camp-station-navigation-16.png", "frames": 16, "fps": 16, "desc": "Navigation star chart console with rotating hologram planet" },
        "station_biolab": { "file": "camp/camp-station-biolab-16.png", "frames": 16, "fps": 16, "desc": "Bio Lab Cryo Incubator with pulsing mutation embryo & nutrient bubbles" },
        "station_well": { "file": "camp/camp-station-well-16.png", "frames": 16, "fps": 18, "desc": "Reclamation Well with bioluminescent hydro pool & concentric ripples" },
        "station_hangar": { "file": "camp/camp-station-hangar-16.png", "frames": 16, "fps": 16, "desc": "Hangar blast doors with hazard stripes & flashing warning beacons" },
        "station_defense": { "file": "camp/camp-station-defense-16.png", "frames": 16, "fps": 16, "desc": "Defense console with CRT screen & rotating green radar sweep" },
        "floor_emblem": { "file": "camp/camp-floor-emblem-16.png", "frames": 16, "fps": 16, "desc": "Inlaid titanium floor emblem with pulsing cyan circuit traces" }
    }
    
    with open(manifest_path, "w") as f:
        json.dump(data, f, indent=2)
        
    print(f"Master manifest successfully updated at {manifest_path}")
    print("\n================================================================")
    print("ALL WALKABLE CAMP SPRITES GENERATED AND READY ON DISK!")
    print("================================================================")

if __name__ == "__main__":
    out_directory = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    build_all_camp_assets(out_directory)
