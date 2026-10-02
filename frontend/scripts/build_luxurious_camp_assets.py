import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from process_all_sheets_zero_box import clean_cell_perfect

FW, FH = 128, 128

# =============================================================================
# HELPER: GLOW & BLOOM FILTERS
# =============================================================================

def apply_bloom(img, radius=4, intensity=1.5):
    """Applies a soft gaussian bloom to luminous elements."""
    glow = img.filter(ImageFilter.GaussianBlur(radius))
    arr_base = np.array(img, dtype=np.float32)
    arr_glow = np.array(glow, dtype=np.float32)
    
    # Additive blend on RGB
    arr_out = arr_base.copy()
    for c in range(3):
        arr_out[:, :, c] = np.clip(arr_base[:, :, c] + arr_glow[:, :, c] * intensity * (arr_glow[:, :, 3] / 255.0), 0, 255)
    arr_out[:, :, 3] = np.clip(arr_base[:, :, 3] + arr_glow[:, :, 3] * 0.4, 0, 255)
    return Image.fromarray(arr_out.astype(np.uint8), "RGBA")

# =============================================================================
# 1. A.I.D.A. DATA CORE PLINTH & HOLOGRAPHIC WATERDROP (LUSH HIGH-TECH)
# =============================================================================

def render_aida_core_frame(t, fw=128, fh=128):
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    cx, cy = fw // 2, fh - 24
    
    # 1. Pedestal Base - Heavy Chamfered Titanium
    # Outer base ring
    draw.ellipse([cx - 44, cy - 12, cx + 44, cy + 12], fill=(18, 26, 38, 255), outline=(42, 58, 80, 255), width=2)
    draw.ellipse([cx - 36, cy - 9, cx + 36, cy + 9], fill=(28, 40, 56, 255), outline=(70, 95, 128, 255), width=1)
    
    # Glowing Circuit Traces on Pedestal
    pulse = 0.7 + math.sin(t * math.pi * 2) * 0.3
    cyan_glow = (79, 216, 255, int(220 * pulse))
    draw.arc([cx - 30, cy - 7, cx + 30, cy + 7], start=30, end=150, fill=cyan_glow, width=2)
    draw.arc([cx - 30, cy - 7, cx + 30, cy + 7], start=210, end=330, fill=cyan_glow, width=2)
    
    # Central Projector Emitter Lens
    draw.ellipse([cx - 16, cy - 5, cx + 16, cy + 5], fill=(120, 230, 255, int(255 * pulse)), outline=(255, 255, 255, 255))
    
    # 2. Volumetric Holographic Light Cone
    holo_top_y = 20
    draw.polygon([(cx - 8, cy - 4), (cx + 8, cy - 4), (cx + 34, holo_top_y), (cx - 34, holo_top_y)], fill=(30, 140, 220, int(35 * pulse)))
    
    # 3. Rotating 3D Telemetry Orbital Rings
    ring_rot_1 = t * math.pi * 2
    ring_rot_2 = -t * math.pi * 2
    holo_cy = 48 + math.sin(t * math.pi * 2) * 4
    
    rx1 = 28 * math.cos(ring_rot_1)
    ry1 = 10 * math.sin(ring_rot_1)
    draw.ellipse([cx - 28, holo_cy - 12, cx + 28, holo_cy + 12], outline=(79, 216, 255, int(160 * pulse)), width=1)
    draw.ellipse([cx - 20, holo_cy - 20, cx + 20, holo_cy + 20], outline=(140, 235, 255, int(120 * pulse)), width=1)
    
    # Orbiting Data Node Sparks
    node_x = cx + math.cos(ring_rot_1) * 26
    node_y = holo_cy + math.sin(ring_rot_1) * 10
    draw.circle((node_x, node_y), radius=3, fill=(255, 255, 255, 255), outline=(79, 216, 255, 255))
    
    # 4. Floating Holographic Luminous AI Waterdrop Avatar
    drop_y = holo_cy
    drop_w, drop_h = 16, 22
    drop_pts = [
        (cx, drop_y - drop_h),
        (cx + drop_w, drop_y - drop_h * 0.1),
        (cx + drop_w * 0.8, drop_y + drop_h * 0.7),
        (cx - drop_w * 0.8, drop_y + drop_h * 0.7),
        (cx - drop_w, drop_y - drop_h * 0.1)
    ]
    draw.polygon(drop_pts, fill=(90, 210, 255, int(190 * pulse)), outline=(220, 245, 255, int(255 * pulse)))
    draw.ellipse([cx - 6, drop_y - 8, cx + 2, drop_y], fill=(255, 255, 255, int(220 * pulse)))
    
    # AI Eye Indicator
    draw.circle((cx - 4, drop_y + 2), radius=2, fill=(255, 255, 255, 255))
    draw.circle((cx + 4, drop_y + 2), radius=2, fill=(255, 255, 255, 255))
    
    return apply_bloom(frame, radius=3, intensity=1.2)

# =============================================================================
# 2. FABRICATION & WEAPON FORGE (THERMAL MAGMA CRUCIBLE & SPARKS)
# =============================================================================

def render_forge_frame(t, fw=128, fh=128):
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    cx, cy = fw // 2, fh - 18
    
    # 1. Heavy Industrial Anvil Base
    draw.rectangle([cx - 42, cy - 24, cx + 42, cy + 8], fill=(22, 26, 32, 255), outline=(50, 58, 70, 255), width=2)
    # Beveled Metallic Top Plate
    draw.polygon([(cx - 46, cy - 24), (cx + 46, cy - 24), (cx + 42, cy - 20), (cx - 42, cy - 20)], fill=(75, 88, 105, 255))
    
    # 2. Molten Thermal Crucible Basin
    heat_pulse = 0.75 + math.sin(t * math.pi * 4) * 0.25
    draw.ellipse([cx - 24, cy - 48, cx + 24, cy - 22], fill=(35, 20, 18, 255), outline=(90, 40, 25, 255), width=2)
    # Molten Core Lava/Plasma Fluid
    draw.ellipse([cx - 18, cy - 44, cx + 18, cy - 26], fill=(255, 85, 20, int(255 * heat_pulse)))
    draw.ellipse([cx - 10, cy - 40, cx + 10, cy - 30], fill=(255, 215, 60, int(255 * heat_pulse)))
    draw.circle((cx, cy - 35), radius=4, fill=(255, 255, 255, 255))
    
    # 3. Rising Thermonuclear Spark Particles
    for sp in range(8):
        sp_seed = sp * 47 + int(t * 16)
        sp_life = (t + sp * 0.125) % 1.0
        sp_x = cx - 14 + (sp_seed % 28) + math.sin(sp_life * math.pi * 2) * 6
        sp_y = (cy - 44) - (sp_life * 45)
        sp_alpha = int((1.0 - sp_life) * 255)
        if sp_alpha > 0 and sp_y > 10:
            draw.circle((sp_x, sp_y), radius=2, fill=(255, 200, 60, sp_alpha))
            
    # 4. Heavy Tool Rack & Weapon Clamp Girders
    draw.line([(cx - 36, cy - 20), (cx - 36, cy - 65)], fill=(60, 72, 88, 255), width=4)
    draw.line([(cx + 36, cy - 20), (cx + 36, cy - 65)], fill=(60, 72, 88, 255), width=4)
    # Crossbar
    draw.line([(cx - 40, cy - 65), (cx + 40, cy - 65)], fill=(80, 95, 115, 255), width=3)
    
    # 5. Glowing Thermal Conduits on Floor
    draw.line([(cx - 42, cy), (cx - 56, cy + 12)], fill=(255, 95, 30, int(200 * heat_pulse)), width=2)
    draw.line([(cx + 42, cy), (cx + 56, cy + 12)], fill=(255, 95, 30, int(200 * heat_pulse)), width=2)
    
    return apply_bloom(frame, radius=3, intensity=1.3)

# =============================================================================
# 3. BIO LAB CRYO INCUBATOR (SPECIMEN TUBE & GREEN BUBBLES)
# =============================================================================

def render_biolab_frame(t, fw=128, fh=128):
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    cx, cy = fw // 2, fh - 20
    
    # 1. Base & Top Capsule Caps
    draw.rectangle([cx - 28, cy - 14, cx + 28, cy + 10], fill=(24, 32, 42, 255), outline=(55, 75, 95, 255), width=2)
    draw.rectangle([cx - 28, cy - 85, cx + 28, cy - 70], fill=(24, 32, 42, 255), outline=(55, 75, 95, 255), width=2)
    
    # 2. Cylindrical Glass Cryo-Tube Interior (Bio-Green Fluid)
    tube_top, tube_bot = cy - 70, cy - 14
    tube_l, tube_r = cx - 22, cx + 22
    
    # Fluid background
    draw.rectangle([tube_l, tube_top, tube_r, tube_bot], fill=(12, 48, 35, 220))
    
    # Specimen Mutation Embryo floating in center
    embryo_y = (tube_top + tube_bot) // 2 + math.sin(t * math.pi * 2) * 5
    draw.ellipse([cx - 10, embryo_y - 12, cx + 10, embryo_y + 12], fill=(45, 185, 110, 240), outline=(90, 255, 160, 255), width=1)
    draw.circle((cx - 3, embryo_y - 3), radius=3, fill=(180, 255, 210, 255))
    
    # Rising Nutrient Bubbles
    for b in range(6):
        b_life = (t + b * 0.16) % 1.0
        bx = cx - 14 + (b * 13) % 28 + math.sin(b_life * math.pi * 4) * 3
        by = tube_bot - (b_life * (tube_bot - tube_top))
        b_rad = 2 if b % 2 == 0 else 3
        draw.circle((bx, by), radius=b_rad, outline=(140, 255, 190, 230), fill=(80, 230, 140, 140))
        
    # Glass Tube Reflection Highlights
    draw.line([(tube_l + 3, tube_top + 4), (tube_l + 3, tube_bot - 4)], fill=(255, 255, 255, 140), width=2)
    draw.line([(tube_r - 3, tube_top + 4), (tube_r - 3, tube_bot - 4)], fill=(255, 255, 255, 80), width=1)
    
    # Diagnostic Side Hologram Screens
    holo_pulse = 0.8 + math.sin(t * math.pi * 3) * 0.2
    draw.rectangle([cx + 32, cy - 65, cx + 48, cy - 35], fill=(15, 60, 45, int(180 * holo_pulse)), outline=(60, 255, 160, int(255 * holo_pulse)))
    draw.line([(cx + 35, cy - 55), (cx + 45, cy - 55)], fill=(120, 255, 180, int(255 * holo_pulse)), width=1)
    draw.line([(cx + 35, cy - 45), (cx + 43, cy - 45)], fill=(120, 255, 180, int(255 * holo_pulse)), width=1)
    
    return apply_bloom(frame, radius=3, intensity=1.2)

# =============================================================================
# 4. RECLAMATION WELL (BIOLUMINESCENT HYDRO POOL & RIPPLES)
# =============================================================================

def render_well_frame(t, fw=128, fh=128):
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    cx, cy = fw // 2, fh - 24
    
    # 1. Inlaid Outer Stone / Steel Well Rim
    draw.ellipse([cx - 48, cy - 20, cx + 48, cy + 20], fill=(22, 28, 38, 255), outline=(50, 68, 92, 255), width=3)
    draw.ellipse([cx - 40, cy - 15, cx + 40, cy + 15], fill=(14, 20, 30, 255))
    
    # 2. Deep Bioluminescent Aqua Water Basin
    draw.ellipse([cx - 36, cy - 13, cx + 36, cy + 13], fill=(12, 75, 135, 255))
    
    # Concentric Animated Water Ripples
    for rip in range(3):
        rip_phase = (t + rip * 0.33) % 1.0
        rip_rx = int(8 + rip_phase * 26)
        rip_ry = int(3 + rip_phase * 9)
        rip_alpha = int((1.0 - rip_phase) * 230)
        draw.ellipse([cx - rip_rx, cy - rip_ry, cx + rip_rx, cy + rip_ry], outline=(120, 225, 255, rip_alpha), width=1)
        
    # Central Spring Bubble / Fountain Emitter
    draw.circle((cx, cy), radius=4, fill=(200, 245, 255, 255), outline=(79, 216, 255, 255))
    
    # Hydro Fluid Pipes Entering Well
    draw.line([(cx - 45, cy - 12), (cx - 58, cy - 25)], fill=(45, 62, 85, 255), width=6)
    draw.line([(cx + 45, cy - 12), (cx + 58, cy - 25)], fill=(45, 62, 85, 255), width=6)
    # Glowing Fluid Conduits inside pipes
    draw.line([(cx - 45, cy - 12), (cx - 58, cy - 25)], fill=(79, 216, 255, 220), width=2)
    draw.line([(cx + 45, cy - 12), (cx + 58, cy - 25)], fill=(79, 216, 255, 220), width=2)
    
    return apply_bloom(frame, radius=3, intensity=1.2)

# =============================================================================
# 5. NAVIGATION CONSOLE (3D ROTATING STAR CHART HOLOGRAM)
# =============================================================================

def render_navigation_frame(t, fw=128, fh=128):
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    cx, cy = fw // 2, fh - 18
    
    # 1. Console Desk & Dual Monitors
    draw.rectangle([cx - 44, cy - 22, cx + 44, cy + 8], fill=(20, 26, 36, 255), outline=(48, 65, 88, 255), width=2)
    draw.rectangle([cx - 40, cy - 38, cx - 18, cy - 22], fill=(12, 18, 26, 255), outline=(65, 90, 120, 255), width=1)
    draw.rectangle([cx + 18, cy - 38, cx + 40, cy - 22], fill=(12, 18, 26, 255), outline=(65, 90, 120, 255), width=1)
    
    # Radar Sweep on Monitor
    radar_angle = t * math.pi * 2
    r_cx, r_cy = cx - 29, cy - 30
    draw.circle((r_cx, r_cy), radius=6, outline=(40, 180, 220, 180))
    draw.line([(r_cx, r_cy), (r_cx + int(math.cos(radar_angle)*6), r_cy + int(math.sin(radar_angle)*6))], fill=(120, 240, 255, 255), width=1)
    
    # 2. Central 3D Celestial Hologram Sphere (Rotating Star Map)
    holo_cx, holo_cy = cx, cy - 50
    draw.ellipse([cx - 16, cy - 24, cx + 16, cy - 18], fill=(79, 216, 255, 200), outline=(200, 245, 255, 255))
    
    # Hologram Planetary Core
    draw.circle((holo_cx, holo_cy), radius=10, fill=(35, 120, 200, 180), outline=(120, 225, 255, 240), width=1)
    # Orbiting Moon / Satellite
    sat_x = holo_cx + math.cos(radar_angle) * 18
    sat_y = holo_cy + math.sin(radar_angle) * 7
    draw.ellipse([holo_cx - 18, holo_cy - 7, holo_cx + 18, holo_cy + 7], outline=(79, 216, 255, 120), width=1)
    draw.circle((sat_x, sat_y), radius=2.5, fill=(255, 220, 80, 255))
    
    return apply_bloom(frame, radius=3, intensity=1.2)

# =============================================================================
# BUILD MASTER STRIPS FOR ALL STATIONS
# =============================================================================

def build_all_luxurious_station_strips(camp_dir):
    os.makedirs(camp_dir, exist_ok=True)
    
    stations = [
        ("camp-core-aida-16.png", render_aida_core_frame),
        ("camp-station-forge-16.png", render_forge_frame),
        ("camp-station-biolab-16.png", render_biolab_frame),
        ("camp-station-well-16.png", render_well_frame),
        ("camp-station-navigation-16.png", render_navigation_frame),
    ]
    
    num_frames = 16
    for filename, render_func in stations:
        strip = Image.new("RGBA", (FW * num_frames, FH), (0, 0, 0, 0))
        for i in range(num_frames):
            t = i / float(num_frames)
            frame = render_func(t, fw=FW, fh=FH)
            strip.paste(frame, (i * FW, 0), frame)
            
        out_path = os.path.join(camp_dir, filename)
        strip.save(out_path, "PNG")
        print(f"Exported Lush Animated Station Module: {out_path} ({FW * num_frames}x{FH})")

if __name__ == "__main__":
    out_camp = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
    print("=================================================================")
    print("GENERATING LUSH DEAD-CELLS QUALITY CAMP STATIONS...")
    print("=================================================================")
    build_all_luxurious_station_strips(out_camp)
