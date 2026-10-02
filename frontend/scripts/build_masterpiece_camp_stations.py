import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 512  # Render at 512x512, downsample to 256x256 for supreme antialiased quality
EXPORT_SIZE = 256
NUM_FRAMES = 16

# =============================================================================
# HIGH-END TEXTURE & LIGHTING UTILITIES
# =============================================================================

def create_radial_gradient(w, h, cx, cy, r, inner_col, outer_col):
    """Generates smooth 32-bit radial light/plasma gradients."""
    y, x = np.ogrid[:h, :w]
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    t = np.clip(dist / max(r, 1), 0.0, 1.0)
    
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    for c in range(4):
        arr[:, :, c] = (inner_col[c] * (1.0 - t) + outer_col[c] * t).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")

def apply_pro_bloom(img, radius=6, intensity=1.6):
    """Applies multi-pass volumetric light bloom."""
    glow = img.filter(ImageFilter.GaussianBlur(radius))
    arr_base = np.array(img, dtype=np.float32)
    arr_glow = np.array(glow, dtype=np.float32)
    
    out = arr_base.copy()
    for c in range(3):
        out[:, :, c] = np.clip(arr_base[:, :, c] + arr_glow[:, :, c] * intensity * (arr_glow[:, :, 3] / 255.0), 0, 255)
    out[:, :, 3] = np.clip(arr_base[:, :, 3] + arr_glow[:, :, 3] * 0.5, 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")

# =============================================================================
# 1. NAVIGATION STAR CHART CONSOLE (MASTER HD)
# =============================================================================

def render_navigation_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 380
    
    # 1. Heavy Chamfered Base Pedestal & Dual Curved Terminal Desks
    # Drop shadow on floor
    draw.ellipse([cx - 180, cy + 30, cx + 180, cy + 90], fill=(2, 6, 12, 130))
    
    # Outer armored base hull
    draw.polygon([
        (cx - 160, cy + 40), (cx + 160, cy + 40),
        (cx + 180, cy + 80), (cx - 180, cy + 80)
    ], fill=(18, 24, 34, 255), outline=(48, 62, 82, 255))
    
    # Brushed metal console desk
    draw.polygon([
        (cx - 150, cy - 20), (cx + 150, cy - 20),
        (cx + 170, cy + 40), (cx - 170, cy + 40)
    ], fill=(28, 38, 52, 255), outline=(75, 98, 130, 255))
    # Beveled desktop highlight
    draw.line([(cx - 145, cy - 18), (cx + 145, cy - 18)], fill=(120, 155, 195, 255), width=3)
    
    # Keyboard & telemetry panels on desk
    for k in range(8):
        kx = cx - 120 + k * 32
        draw.rectangle([kx, cy + 5, kx + 24, cy + 25], fill=(14, 20, 28, 255), outline=(45, 60, 80, 255))
        # Pulsing key LEDs
        key_pulse = (math.sin(t * math.pi * 4 + k) + 1.0) / 2.0
        draw.circle((kx + 12, cy + 15), radius=3, fill=(79, 216, 255, int(180 * key_pulse)))
        
    # Dual Angled Holographic Monitor Wings
    for side in [-1, 1]:
        mx = cx + side * 115
        my = cy - 80
        # Monitor Frame
        draw.polygon([
            (mx - 45, my - 50), (mx + 45, my - 50),
            (mx + 35, my + 30), (mx - 35, my + 30)
        ], fill=(16, 22, 32, 255), outline=(65, 88, 120, 255), width=2)
        # CRT Screen Glass
        draw.polygon([
            (mx - 40, my - 45), (mx + 40, my - 45),
            (mx + 30, my + 25), (mx - 30, my + 25)
        ], fill=(8, 35, 48, 240))
        
        # Tactical Radar / Waveform Display
        radar_ang = (t * math.pi * 2) if side == 1 else (-t * math.pi * 2)
        draw.circle((mx, my - 10), radius=22, outline=(40, 160, 200, 140), width=1)
        draw.circle((mx, my - 10), radius=12, outline=(40, 160, 200, 100), width=1)
        draw.line([(mx, my - 10), (mx + int(math.cos(radar_ang)*22), my - 10 + int(math.sin(radar_ang)*22))], fill=(120, 245, 255, 255), width=2)
        
        # Screen scanlines
        for sc in range(my - 40, my + 20, 6):
            draw.line([(mx - 30, sc), (mx + 30, sc)], fill=(30, 90, 120, 70), width=1)
            
    # 2. Central 3D Celestial Hologram Projector
    holo_cx, holo_cy = cx, cy - 170
    
    # Hologram Projector Emitter Basin on desk
    draw.ellipse([cx - 48, cy - 35, cx + 48, cy - 5], fill=(12, 18, 26, 255), outline=(79, 216, 255, 255), width=2)
    draw.ellipse([cx - 36, cy - 30, cx + 36, cy - 10], fill=(79, 216, 255, 180))
    draw.circle((cx, cy - 20), radius=10, fill=(255, 255, 255, 255))
    
    # Upward Volumetric Hologram Light Beam
    beam = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d_beam = ImageDraw.Draw(beam)
    d_beam.polygon([(cx - 36, cy - 20), (cx + 36, cy - 20), (cx + 120, holo_cy - 80), (cx - 120, holo_cy - 80)], fill=(30, 140, 220, 45))
    canvas = Image.alpha_composite(canvas, beam)
    draw = ImageDraw.Draw(canvas)
    
    # Rotating 3D Holographic Planetary Orbit Sphere
    rot_a = t * math.pi * 2
    # Celestial Coordinates Wireframe Sphere
    for ring in range(3):
        r_phase = rot_a + ring * (math.pi / 3.0)
        rx = int(72 * abs(math.cos(r_phase))) + 15
        ry = int(32 * abs(math.sin(r_phase))) + 10
        draw.ellipse([holo_cx - rx, holo_cy - ry, holo_cx + rx, holo_cy + ry], outline=(79, 216, 255, 140), width=2)
        
    # Holographic Planet Core (Textured Blue/Cyan Water World)
    draw.circle((holo_cx, holo_cy), radius=38, fill=(18, 75, 140, 230), outline=(120, 235, 255, 255), width=2)
    # Rotating Continents on Hologram
    cont_offset = int(t * 76)
    for c in range(3):
        lx = holo_cx - 30 + c * 26 + cont_offset
        if lx > holo_cx + 35:
            lx -= 70
        ly = holo_cy - 18 + (c * 14) % 25
        draw.ellipse([lx - 12, ly - 8, lx + 12, ly + 8], fill=(45, 185, 130, 200))
    # Atmosphere rim glow
    draw.circle((holo_cx, holo_cy), radius=42, outline=(140, 240, 255, 160), width=3)
    
    # Orbiting Moon / Satellite Probe
    sat_x = holo_cx + math.cos(rot_a) * 68
    sat_y = holo_cy + math.sin(rot_a) * 24
    draw.ellipse([holo_cx - 68, holo_cy - 24, holo_cx + 68, holo_cy + 24], outline=(79, 216, 255, 80), width=1)
    draw.circle((sat_x, sat_y), radius=6, fill=(255, 225, 80, 255), outline=(255, 255, 255, 255))
    
    # 3. Holographic Mission Waypoints & Star Beacons
    for wp in range(5):
        w_ang = rot_a * 0.7 + wp * (math.pi * 2 / 5.0)
        wx = holo_cx + math.cos(w_ang) * 95
        wy = holo_cy + math.sin(w_ang) * 45
        draw.polygon([(wx, wy - 6), (wx + 5, wy), (wx, wy + 6), (wx - 5, wy)], fill=(255, 85, 105, 240), outline=(255, 255, 255, 255))
        draw.line([(holo_cx, holo_cy), (wx, wy)], fill=(79, 216, 255, 70), width=1)
        
    return apply_pro_bloom(canvas, radius=6, intensity=1.5)

# =============================================================================
# 2. A.I.D.A. DATA CORE PLINTH (MASTER HD)
# =============================================================================

def render_aida_core_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 390
    pulse = (math.sin(t * math.pi * 2) + 1.0) / 2.0
    
    # Base shadow
    draw.ellipse([cx - 150, cy + 40, cx + 150, cy + 90], fill=(2, 6, 12, 140))
    
    # Multi-Tiered Armored Base Plinth
    draw.ellipse([cx - 130, cy + 20, cx + 130, cy + 70], fill=(16, 22, 32, 255), outline=(45, 60, 80, 255), width=3)
    draw.ellipse([cx - 105, cy + 5, cx + 105, cy + 48], fill=(26, 36, 50, 255), outline=(70, 95, 125, 255), width=2)
    
    # Neon Circuit Inlays on Floor Plinth
    cyan_glow = (79, 216, 255, int(180 + 75 * pulse))
    draw.arc([cx - 90, cy + 10, cx + 90, cy + 42], start=20, end=160, fill=cyan_glow, width=3)
    draw.arc([cx - 90, cy + 10, cx + 90, cy + 42], start=200, end=340, fill=cyan_glow, width=3)
    
    # Central Optical Projector Lens
    draw.ellipse([cx - 48, cy - 10, cx + 48, cy + 15], fill=(120, 230, 255, 220), outline=(255, 255, 255, 255), width=2)
    draw.circle((cx, cy + 2), radius=14, fill=(255, 255, 255, 255))
    
    # Holographic AI Waterdrop Core
    holo_cy = 200 + math.sin(t * math.pi * 2) * 10
    
    # Multi-tiered Rotating Data Rings
    for ring in range(3):
        r_rot = (t * math.pi * 2 * (1 if ring % 2 == 0 else -1)) + ring * 1.2
        rx = int(85 * abs(math.cos(r_rot))) + 25
        ry = int(35 * abs(math.sin(r_rot))) + 15
        draw.ellipse([cx - rx, holo_cy - ry, cx + rx, holo_cy + ry], outline=(79, 216, 255, int(150 + 80 * pulse)), width=2)
        # Orbiting Data Sparks
        sx = cx + math.cos(r_rot) * rx
        sy = holo_cy + math.sin(r_rot) * ry
        draw.circle((sx, sy), radius=5, fill=(255, 255, 255, 255), outline=(79, 216, 255, 255))
        
    # Floating A.I.D.A. Holographic Waterdrop AI Entity
    drop_w, drop_h = 42, 60
    top_x, top_y = cx, holo_cy - drop_h
    bot_y = holo_cy + drop_h * 0.7
    
    drop_pts = [
        (top_x, top_y),
        (cx + drop_w, holo_cy - drop_h * 0.1),
        (cx + drop_w * 0.85, bot_y),
        (cx - drop_w * 0.85, bot_y),
        (cx - drop_w, holo_cy - drop_h * 0.1)
    ]
    draw.polygon(drop_pts, fill=(60, 190, 255, int(200 + 45 * pulse)), outline=(220, 245, 255, 255), width=3)
    # Inner luminous refraction
    draw.ellipse([cx - 22, holo_cy - 20, cx + 8, holo_cy + 10], fill=(255, 255, 255, int(220 * pulse)))
    # AI Expressive Glowing Eyes
    draw.ellipse([cx - 18, holo_cy + 2, cx - 6, holo_cy + 16], fill=(255, 255, 255, 255))
    draw.ellipse([cx + 6, holo_cy + 2, cx + 18, holo_cy + 16], fill=(255, 255, 255, 255))
    
    return apply_pro_bloom(canvas, radius=6, intensity=1.5)

# =============================================================================
# 3. FABRICATION & WEAPON FORGE (MASTER HD)
# =============================================================================

def render_forge_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 380
    heat_pulse = (math.sin(t * math.pi * 4) + 1.0) / 2.0
    
    # Shadow
    draw.ellipse([cx - 160, cy + 30, cx + 160, cy + 85], fill=(2, 5, 10, 140))
    
    # Heavy Industrial Cyber-Anvil Base
    draw.polygon([
        (cx - 140, cy - 20), (cx + 140, cy - 20),
        (cx + 155, cy + 50), (cx - 155, cy + 50)
    ], fill=(22, 26, 34, 255), outline=(60, 72, 90, 255), width=3)
    
    # Molten Lava/Plasma Crucible Basin
    draw.ellipse([cx - 75, cy - 75, cx + 75, cy - 10], fill=(32, 18, 14, 255), outline=(95, 42, 25, 255), width=4)
    # Boiling Magma Core
    draw.ellipse([cx - 62, cy - 65, cx + 62, cy - 20], fill=(255, 75, 15, 255))
    draw.ellipse([cx - 38, cy - 58, cx + 38, cy - 28], fill=(255, 205, 45, int(220 + 35 * heat_pulse)))
    draw.circle((cx, cy - 44), radius=14, fill=(255, 255, 255, 255))
    
    # Rising Thermonuclear Spark Particles
    for sp in range(16):
        sp_seed = sp * 37 + int(t * 16)
        sp_life = (t + sp * 0.0625) % 1.0
        sp_x = cx - 45 + (sp_seed % 90) + math.sin(sp_life * math.pi * 3) * 15
        sp_y = (cy - 65) - (sp_life * 140)
        sp_alpha = int((1.0 - sp_life) * 255)
        if sp_alpha > 0 and sp_y > 20:
            draw.circle((sp_x, sp_y), radius=3, fill=(255, 215, 60, sp_alpha), outline=(255, 255, 255, sp_alpha))
            
    # Dual Hydraulic Clamp Girders & Laser Sights
    draw.line([(cx - 110, cy - 15), (cx - 110, cy - 160)], fill=(55, 68, 85, 255), width=10)
    draw.line([(cx + 110, cy - 15), (cx + 110, cy - 160)], fill=(55, 68, 85, 255), width=10)
    draw.line([(cx - 120, cy - 160), (cx + 120, cy - 160)], fill=(75, 92, 115, 255), width=8)
    
    # Laser Alignment Beams onto Crucible
    draw.line([(cx - 110, cy - 160), (cx - 20, cy - 45)], fill=(255, 45, 65, 200), width=2)
    draw.line([(cx + 110, cy - 160), (cx + 20, cy - 45)], fill=(255, 45, 65, 200), width=2)
    
    return apply_pro_bloom(canvas, radius=6, intensity=1.5)

# =============================================================================
# 4. BIO LAB CRYO INCUBATOR (MASTER HD)
# =============================================================================

def render_biolab_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 380
    
    # Shadow
    draw.ellipse([cx - 130, cy + 30, cx + 130, cy + 80], fill=(2, 6, 10, 140))
    
    # Heavy Base & Top Vacuum Caps
    draw.rectangle([cx - 85, cy - 10, cx + 85, cy + 45], fill=(20, 28, 38, 255), outline=(50, 70, 95, 255), width=3)
    draw.rectangle([cx - 85, cy - 220, cx + 85, cy - 175], fill=(20, 28, 38, 255), outline=(50, 70, 95, 255), width=3)
    
    # Cylindrical Glass Cryo-Tank (Bio-Green Liquid)
    tube_l, tube_r = cx - 68, cx + 68
    tube_top, tube_bot = cy - 175, cy - 10
    draw.rectangle([tube_l, tube_top, tube_r, tube_bot], fill=(10, 52, 38, 230), outline=(55, 185, 125, 255), width=2)
    
    # Suspended Floating Mutation Embryo
    embryo_y = (tube_top + tube_bot) // 2 + math.sin(t * math.pi * 2) * 12
    draw.ellipse([cx - 28, embryo_y - 35, cx + 28, embryo_y + 35], fill=(45, 195, 115, 240), outline=(120, 255, 180, 255), width=3)
    draw.circle((cx - 8, embryo_y - 10), radius=10, fill=(180, 255, 220, 255))
    
    # 12 Rising Nutrient Bubbles
    for b in range(12):
        b_life = (t + b * 0.083) % 1.0
        bx = cx - 45 + (b * 27) % 90 + math.sin(b_life * math.pi * 4) * 8
        by = tube_bot - (b_life * (tube_bot - tube_top))
        b_rad = 4 if b % 2 == 0 else 7
        draw.circle((bx, by), radius=b_rad, outline=(140, 255, 190, 240), fill=(60, 220, 130, 150), width=2)
        draw.circle((bx - 2, by - 2), radius=2, fill=(255, 255, 255, 255))
        
    # Glass Specular Reflections
    draw.line([(tube_l + 8, tube_top + 10), (tube_l + 8, tube_bot - 10)], fill=(255, 255, 255, 160), width=4)
    draw.line([(tube_r - 8, tube_top + 10), (tube_r - 8, tube_bot - 10)], fill=(255, 255, 255, 90), width=2)
    
    # Holographic Diagnostics Screen Wings
    holo_pulse = (math.sin(t * math.pi * 3) + 1.0) / 2.0
    draw.rectangle([cx + 95, cy - 160, cx + 155, cy - 70], fill=(12, 55, 42, int(180 + 50 * holo_pulse)), outline=(55, 255, 160, 255), width=2)
    for l in range(cy - 145, cy - 80, 12):
        draw.line([(cx + 105, l), (cx + 145, l)], fill=(120, 255, 180, 220), width=2)
        
    return apply_pro_bloom(canvas, radius=6, intensity=1.4)

# =============================================================================
# 5. RECLAMATION WELL (MASTER HD)
# =============================================================================

def render_well_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 380
    
    # Shadow
    draw.ellipse([cx - 160, cy + 30, cx + 160, cy + 90], fill=(2, 6, 12, 140))
    
    # Outer Titanium Rim with Hexagonal Bolts
    draw.ellipse([cx - 140, cy - 40, cx + 140, cy + 60], fill=(24, 32, 45, 255), outline=(60, 82, 110, 255), width=4)
    draw.ellipse([cx - 115, cy - 28, cx + 115, cy + 45], fill=(14, 20, 30, 255))
    
    # Deep Glowing Bioluminescent Water Basin
    draw.ellipse([cx - 105, cy - 24, cx + 105, cy + 38], fill=(12, 75, 145, 255))
    
    # Concentric Dynamic Water Wave Ripples
    for rip in range(4):
        rip_phase = (t + rip * 0.25) % 1.0
        rx = int(18 + rip_phase * 80)
        ry = int(6 + rip_phase * 28)
        alpha = int((1.0 - rip_phase) * 240)
        draw.ellipse([cx - rx, cy + 5 - ry, cx + rx, cy + 5 + ry], outline=(120, 230, 255, alpha), width=2)
        
    # Central Spring Emitter & Water Fountain Bubbles
    draw.circle((cx, cy + 5), radius=12, fill=(210, 248, 255, 255), outline=(79, 216, 255, 255), width=2)
    
    # Hydro Pipeline Conduits Feeding Station
    draw.line([(cx - 130, cy - 20), (cx - 180, cy - 70)], fill=(45, 60, 85, 255), width=14)
    draw.line([(cx + 130, cy - 20), (cx + 180, cy - 70)], fill=(45, 60, 85, 255), width=14)
    # Glowing Inner Fluid Lines
    draw.line([(cx - 130, cy - 20), (cx - 180, cy - 70)], fill=(79, 216, 255, 220), width=5)
    draw.line([(cx + 130, cy - 20), (cx + 180, cy - 70)], fill=(79, 216, 255, 220), width=5)
    
    return apply_pro_bloom(canvas, radius=6, intensity=1.4)

# =============================================================================
# EXPORT ALL STATIONS AT 2X RETINA HD (256x256)
# =============================================================================

def build_all_masterpiece_stations(camp_dir):
    os.makedirs(camp_dir, exist_ok=True)
    
    stations = [
        ("camp-station-navigation-16.png", render_navigation_master_frame),
        ("camp-core-aida-16.png", render_aida_core_master_frame),
        ("camp-station-forge-16.png", render_forge_master_frame),
        ("camp-station-biolab-16.png", render_biolab_master_frame),
        ("camp-station-well-16.png", render_well_master_frame)
    ]
    
    for filename, render_func in stations:
        strip = Image.new("RGBA", (EXPORT_SIZE * NUM_FRAMES, EXPORT_SIZE), (0, 0, 0, 0))
        for i in range(NUM_FRAMES):
            t = i / float(NUM_FRAMES)
            hi_frame = render_func(t)
            # Lanczos downscale from 512x512 to 256x256
            frame2x = hi_frame.resize((EXPORT_SIZE, EXPORT_SIZE), Image.Resampling.LANCZOS)
            strip.paste(frame2x, (i * EXPORT_SIZE, 0), frame2x)
            
        out_path = os.path.join(camp_dir, filename)
        strip.save(out_path, "PNG")
        print(f"Exported Masterpiece 2X Station: {out_path} ({EXPORT_SIZE * NUM_FRAMES}x{EXPORT_SIZE})")

if __name__ == "__main__":
    out_camp = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
    print("=================================================================")
    print("GENERATING MASTERPIECE 2X RETINA HD WALKABLE CAMP STATIONS...")
    print("=================================================================")
    build_all_masterpiece_stations(out_camp)
