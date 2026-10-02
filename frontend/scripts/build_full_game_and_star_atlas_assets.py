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
    print(f"Exported (Dead-Cells Polish): {output_path} ({total_w}x{FH}, {len(hi_frames)} frames)")

# =============================================================================
# 1. STAR ATLAS & STAR RAID SPACECRAFT ASSETS (2X SUPERSAMPLED)
# =============================================================================

def draw_player_starship_hi(draw, cx, cy, ang_rad, thrust=0.5, hit=False, color=(95, 214, 255)):
    """Draws the Player Interceptor Spacecraft matching starRaidRenderer.js with 2x supersampling."""
    cos_a, sin_a = math.cos(ang_rad), math.sin(ang_rad)
    
    def tx(lx, ly):
        return (cx + lx * cos_a - ly * sin_a, cy + lx * sin_a + ly * cos_a)
        
    # Thruster engine flame out the back
    if thrust > 0.05:
        flare_len = 32 + thrust * 36 + np.random.uniform(-4, 4)
        flame_pts = [tx(0, 32), tx(-12, 32), tx(0, 32 + flare_len), tx(12, 32)]
        draw.polygon(flame_pts, fill=(255, 154, 77, int(220 * thrust)))
        draw.polygon([tx(-6, 32), tx(0, 32 + flare_len*0.6), tx(6, 32)], fill=(255, 255, 255, 240))
        
    # Main Hull Body
    hull_pts = [
        tx(0, -50), tx(-12, -20), tx(-36, 10), tx(-28, 36),
        tx(-8, 24), tx(0, 32), tx(8, 24),
        tx(28, 36), tx(36, 10), tx(12, -20)
    ]
    hull_col = (255, 255, 255, 255) if hit else color
    dark_col = (10, 32, 51, 255)
    draw.polygon(hull_pts, fill=hull_col, outline=dark_col)
    
    # Armor Panel lines
    panel_pts = [tx(0, -40), tx(-16, 10), tx(0, 24), tx(16, 10)]
    draw.polygon(panel_pts, fill=(43, 58, 74, 255), outline=(26, 42, 58, 255))
    
    # Cockpit Canopy Glass
    canopy_pts = [tx(0, -24), tx(-10, -12), tx(-8, 4), tx(0, 8), tx(8, 4), tx(10, -12)]
    draw.polygon(canopy_pts, fill=(216, 251, 255, 240))
    draw.line([tx(0, -20), tx(0, 4)], fill=(255, 255, 255, 255), width=2)
    
    # Wingtip Plasma Cannons
    draw.line([tx(-32, 0), tx(-32, -24)], fill=(120, 140, 160, 255), width=4)
    draw.line([tx(32, 0), tx(32, -24)], fill=(120, 140, 160, 255), width=4)

def generate_starship_interceptor_16angles(output_path):
    """16 rotation angles of the Player Interceptor Spacecraft."""
    frames = []
    for i in range(16):
        ang_deg = i * 22.5
        ang_rad = math.radians(ang_deg)
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        draw_player_starship_hi(draw, FW_HI//2, FH_HI//2, ang_rad, thrust=0.6)
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_starship_thruster_flight(output_path):
    """16 frames of flight thrusters, particle flares and hyper-warp exhaust."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW_HI // 2, FH_HI // 2
        
        # Warp speed stars in background
        for s in range(8):
            sy = (i * 24 + s * 44) % FH_HI
            sx = 40 + s * 24
            draw.line([(sx, sy), (sx, sy + 16)], fill=(180, 220, 255, 180), width=2)
            
        thrust = 0.5 + math.sin(t * math.pi * 4) * 0.4
        draw_player_starship_hi(draw, cx, cy, 0.0, thrust=thrust)
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_starship_shield_barrier(output_path):
    """16 frames of defensive energy shield bubble with hexagonal facets."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW_HI // 2, FH_HI // 2
        
        draw_player_starship_hi(draw, cx, cy, 0.0, thrust=0.3)
        
        # Hexagonal shield facets
        r = 76 + math.sin(t * math.pi * 2) * 4
        hex_pts = []
        for v in range(6):
            va = t * math.pi * 2 + (v / 6.0) * math.pi * 2
            hex_pts.append((cx + math.cos(va) * r, cy + math.sin(va) * r))
        draw.polygon(hex_pts, fill=(95, 214, 255, 60), outline=(216, 251, 255, 220))
        frames.append(canvas)
    save_hi_strip(frames, output_path)

# =============================================================================
# 2. REMAINING WEAPONS & COMBAT SHEETS (2X SUPERSAMPLED)
# =============================================================================

def generate_tidal_harpoon_combat(output_path):
    """16 frames of Tidal Harpoon: golden-cyan aquatic trident thrust and launch."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        
        thrust = math.sin(t * math.pi) * 28
        draw_waterdrop_hero_hi(draw, cx=128 + int(thrust*0.5), cy=160, tilt=0.18, arm_r_pose=('aim', 0), arm_l_pose=('support', 0), eye_type='angry')
        
        # Tidal Trident Harpoon
        hx = 152 + thrust * 1.5
        hy = 160
        draw.line([(hx - 48, hy), (hx + 24, hy)], fill=(212, 175, 55, 255), width=6)
        draw.polygon([(hx + 24, hy - 16), (hx + 48, hy - 16), (hx + 36, hy - 8)], fill=(79, 216, 255, 255))
        draw.polygon([(hx + 28, hy - 8), (hx + 56, hy), (hx + 28, hy + 8)], fill=(255, 255, 255, 255))
        draw.polygon([(hx + 24, hy + 16), (hx + 48, hy + 16), (hx + 36, hy + 8)], fill=(79, 216, 255, 255))
        
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_twin_revolvers_combat(output_path):
    """16 frames of Twin Revolvers: dual fast firing with spinning cylinder kickback."""
    frames = []
    for i in range(16):
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, arm_r_pose=('aim', -0.1), arm_l_pose=('aim', 0.1), eye_type='angry')
        
        # Right gun fire
        if i % 2 == 0:
            draw.polygon([(164, 160), (192, 152), (184, 160), (192, 168)], fill=(255, 215, 60, 255))
            draw.circle((168, 160), radius=6, fill=(255, 255, 255, 255))
        # Left gun fire
        if i % 2 == 1:
            draw.polygon([(92, 168), (64, 160), (72, 168), (64, 176)], fill=(255, 215, 60, 255))
            draw.circle((88, 168), radius=6, fill=(255, 255, 255, 255))
            
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_void_scattergun_combat(output_path):
    """16 frames of Void Scattergun: heavy shotgun kickback with dark matter shards."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        recoil = math.sin(t * math.pi * 2) * 10 if i < 6 else 0
        draw_waterdrop_hero_hi(draw, cx=128 - int(recoil), cy=160, tilt=-recoil*0.05, arm_r_pose=('aim', 0), eye_type='angry')
        
        # Void shards cone
        if 1 <= i <= 9:
            prog = (i - 1) / 8.0
            for shard in range(8):
                s_ang = -0.55 + shard * 0.16
                s_dist = 36 + prog * 88
                sx = 156 + math.cos(s_ang) * s_dist
                sy = 160 + math.sin(s_ang) * s_dist
                draw.polygon([(sx, sy), (sx - 8, sy - 6), (sx - 8, sy + 6)], fill=(160, 60, 240, int(255*(1-prog*0.6))), outline=(230, 180, 255, 255))
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_arc_caster_combat(output_path):
    """16 frames of Arc Caster: ball lightning charge and release."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, arm_r_pose=('aim', 0), eye_type='angry')
        
        # Ball lightning charging at nozzle
        r = 12 + math.sin(t * math.pi * 4) * 6
        draw.circle((164, 164), radius=r, fill=(160, 228, 255, 220), outline=(255, 255, 255, 255))
        for spark in range(4):
            sa = t * math.pi * 4 + spark * math.pi * 0.5
            draw.line([(164, 164), (164 + math.cos(sa)*28, 164 + math.sin(sa)*28)], fill=(255, 255, 255, 240), width=2)
            
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_comet_launcher_combat(output_path):
    """16 frames of Comet Launcher: launching celestial ice comet with shimmering blue tail."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, tilt=0.1, arm_r_pose=('aim', 0), eye_type='angry')
        
        if 2 <= i <= 13:
            prog = (i - 2) / 11.0
            cx_comet = 156 + prog * 92
            cy_comet = 164
            for p in range(5):
                tx = cx_comet - p * 16
                draw.circle((tx, cy_comet), radius=12 - p*2, fill=(79, 180, 255, int(220*(1-p/5.0))))
            draw.circle((cx_comet, cy_comet), radius=14, fill=(255, 255, 255, 255), outline=(160, 230, 255, 255))
            
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_acid_sprayer_combat(output_path):
    """16 frames of Acid Sprayer: bio-toxic corrosive green liquid stream."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, arm_r_pose=('aim', 0), eye_type='angry')
        
        for d in range(8):
            dx = 152 + d * 12 + math.sin(t * math.pi * 4 + d) * 8
            dy = 164 + math.sin(d * 0.8 + t * math.pi * 2) * 16
            draw.circle((dx, dy), radius=7, fill=(120, 230, 40, 220), outline=(220, 255, 120, 255))
            
        frames.append(canvas)
    save_hi_strip(frames, output_path)

# =============================================================================
# 3. AUTONOMOUS DRONES & DEPLOYABLE ASSETS (2X SUPERSAMPLED)
# =============================================================================

def generate_drone_squadron_entity(output_path):
    """16 frames of Drone Squadron: hovering autonomous companion drone with scanning eye."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW_HI // 2, FH_HI // 2 + int(math.sin(t * math.pi * 2) * 8)
        
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=32, radius_y=8, alpha=60)
        draw.polygon([(cx, cy - 28), (cx + 36, cy + 20), (cx, cy + 12), (cx - 36, cy + 20)], fill=(42, 49, 61, 255), outline=(15, 20, 28, 255))
        draw.circle((cx, cy - 4), radius=10, fill=(255, 77, 77, 255), outline=(255, 255, 255, 255))
        draw.polygon([(cx, cy + 12), (cx - 28, FH_HI), (cx + 28, FH_HI)], fill=(255, 77, 77, 30))
        
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_plasma_turret_entity(output_path):
    """16 frames of Plasma Turret: deployable rotating automated defense cannon."""
    frames = []
    for i in range(16):
        t = i / 16.0
        rot_ang = t * math.pi * 2
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW_HI // 2, FH_HI // 2 + 20
        
        draw_shadow_hi(draw, cx, ANCHOR_Y_HI, radius_x=44, radius_y=12, alpha=90)
        draw.polygon([(cx - 36, cy + 36), (cx + 36, cy + 36), (cx, cy)], fill=(30, 35, 45, 255))
        draw.circle((cx, cy), radius=24, fill=(58, 70, 88, 255), outline=(15, 20, 28, 255))
        bx = cx + math.cos(rot_ang) * 44
        by = cy + math.sin(rot_ang) * 44
        draw.line([(cx, cy), (bx, by)], fill=(120, 140, 160, 255), width=10)
        draw.circle((bx, by), radius=8, fill=(79, 216, 255, 255))
        
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_shrapnel_mine_entity(output_path):
    """16 frames of Shrapnel Mine: pulsing proximity sensor explosive with red warning ring."""
    frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW_HI // 2, FH_HI // 2 + 28
        
        r_warn = 36 + math.sin(t * math.pi * 2) * 32
        draw.ellipse([cx - r_warn, cy - r_warn*0.5, cx + r_warn, cy + r_warn*0.5], outline=(255, 50, 50, int(180*(1-t))), width=4)
        draw.polygon([(cx - 24, cy + 12), (cx + 24, cy + 12), (cx + 16, cy - 16), (cx - 16, cy - 16)], fill=(40, 45, 55, 255), outline=(10, 15, 20, 255))
        led_col = (255, 30, 30, 255) if (i % 4 < 2) else (80, 10, 10, 255)
        draw.circle((cx, cy - 4), radius=8, fill=led_col)
        
        frames.append(canvas)
    save_hi_strip(frames, output_path)

def generate_railgun_array_entity(output_path):
    """16 frames of Railgun Array: linear accelerator charging and firing relativistic slug."""
    frames = []
    for i in range(16):
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW_HI // 2, FH_HI // 2
        
        draw.line([(20, cy - 12), (236, cy - 12)], fill=(58, 70, 88, 255), width=6)
        draw.line([(20, cy + 12), (236, cy + 12)], fill=(58, 70, 88, 255), width=6)
        for ring in range(5):
            rx = 48 + ring * 40
            draw.line([(rx, cy - 18), (rx, cy + 18)], fill=(79, 216, 255, 200), width=4)
        if i in (1, 2, 3):
            draw.line([(0, cy), (FW_HI, cy)], fill=(255, 255, 255, 255), width=10)
            draw.line([(0, cy), (FW_HI, cy)], fill=(120, 220, 255, 200), width=18)
            
        frames.append(canvas)
    save_hi_strip(frames, output_path)

if __name__ == "__main__":
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    print("================================================================")
    print("POLISHING ALL REMAINING WEAPONS, STAR SHIPS & DRONES (2X QA)...")
    print("================================================================")
    
    # 1. Star Ships
    generate_starship_interceptor_16angles(os.path.join(out_dir, "star_ships", "star-ship-interceptor-16angles.png"))
    generate_starship_thruster_flight(os.path.join(out_dir, "star_ships", "star-ship-flight-thruster-16.png"))
    generate_starship_shield_barrier(os.path.join(out_dir, "star_ships", "star-ship-shield-barrier-16.png"))
    
    # 2. Remaining Combat Weapons
    generate_tidal_harpoon_combat(os.path.join(out_dir, "combat", "waterdrop-tidal-harpoon-16.png"))
    generate_twin_revolvers_combat(os.path.join(out_dir, "combat", "waterdrop-twin-revolvers-16.png"))
    generate_void_scattergun_combat(os.path.join(out_dir, "combat", "waterdrop-void-scatter-16.png"))
    generate_arc_caster_combat(os.path.join(out_dir, "combat", "waterdrop-arc-caster-16.png"))
    generate_comet_launcher_combat(os.path.join(out_dir, "combat", "waterdrop-comet-launcher-16.png"))
    generate_acid_sprayer_combat(os.path.join(out_dir, "combat", "waterdrop-acid-sprayer-16.png"))

    # 3. Autonomous Drones & Deployables
    generate_drone_squadron_entity(os.path.join(out_dir, "auto_weapons", "drone-squadron-16.png"))
    generate_plasma_turret_entity(os.path.join(out_dir, "auto_weapons", "plasma-turret-16.png"))
    generate_shrapnel_mine_entity(os.path.join(out_dir, "auto_weapons", "shrapnel-mine-16.png"))
    generate_railgun_array_entity(os.path.join(out_dir, "auto_weapons", "railgun-array-16.png"))
    
    print("\n================================================================")
    print("ALL 38 WEAPONS AND STAR SHIPS ASSETS POLISHED ON DISK!")
    print("================================================================")
