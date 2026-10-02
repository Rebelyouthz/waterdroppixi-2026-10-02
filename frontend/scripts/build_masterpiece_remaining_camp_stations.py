import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 512  # Render at 512x512, downscale to 256x256
EXPORT_SIZE = 256
NUM_FRAMES = 16

def apply_pro_bloom(img, radius=6, intensity=1.5):
    glow = img.filter(ImageFilter.GaussianBlur(radius))
    arr_base = np.array(img, dtype=np.float32)
    arr_glow = np.array(glow, dtype=np.float32)
    
    out = arr_base.copy()
    for c in range(3):
        out[:, :, c] = np.clip(arr_base[:, :, c] + arr_glow[:, :, c] * intensity * (arr_glow[:, :, 3] / 255.0), 0, 255)
    out[:, :, 3] = np.clip(arr_base[:, :, 3] + arr_glow[:, :, 3] * 0.5, 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")

# =============================================================================
# 1. HANGAR BAY AIRLOCK (MASTER HD 256x256)
# =============================================================================

def render_hangar_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 380
    beacon_rot = t * math.pi * 2
    
    # Shadow
    draw.ellipse([cx - 170, cy + 35, cx + 170, cy + 90], fill=(2, 6, 12, 140))
    
    # Heavy Armored Blast Door Arch Frame
    draw.rectangle([cx - 150, cy - 200, cx + 150, cy + 40], fill=(22, 28, 38, 255), outline=(55, 75, 100, 255), width=4)
    # Inner Door Recess (Deep Hangar Bay Interior)
    draw.rectangle([cx - 110, cy - 165, cx + 110, cy + 30], fill=(10, 14, 20, 255), outline=(35, 48, 65, 255), width=2)
    
    # Yellow/Black Hazard Chevron Stripes on Frame
    for h in range(cy - 190, cy + 30, 24):
        # Left stripe
        draw.polygon([(cx - 145, h), (cx - 115, h + 12), (cx - 115, h + 20), (cx - 145, h + 8)], fill=(245, 195, 30, 240))
        # Right stripe
        draw.polygon([(cx + 115, h), (cx + 145, h + 12), (cx + 145, h + 20), (cx + 115, h + 8)], fill=(245, 195, 30, 240))
        
    # Heavy Reinforced Blast Doors (Vertical Interlocking Teeth)
    draw.line([(cx, cy - 165), (cx, cy + 30)], fill=(65, 85, 110, 255), width=4)
    for tooth in range(cy - 150, cy + 20, 30):
        draw.polygon([(cx - 10, tooth), (cx + 10, tooth + 8), (cx - 10, tooth + 16)], fill=(80, 105, 135, 255))
        
    # Dual Rotating Warning Beacons on Top Corners
    for side in [-1, 1]:
        bx = cx + side * 130
        by = cy - 200
        # Beacon housing
        draw.rectangle([bx - 14, by - 16, bx + 14, by], fill=(30, 36, 45, 255), outline=(75, 95, 120, 255))
        # Amber Strobe Light Core
        strobe_alpha = int(180 + 75 * math.sin(beacon_rot + (math.pi if side == -1 else 0)))
        draw.ellipse([bx - 10, by - 24, bx + 10, by - 6], fill=(255, 140, 20, strobe_alpha), outline=(255, 220, 100, 255))
        # Light cone flare
        draw.line([(bx, by - 15), (bx + side * 45, by - 45)], fill=(255, 180, 40, strobe_alpha // 2), width=3)
        
    # Hydraulic Lock Pressure Gauges & Cables
    draw.circle((cx - 80, cy - 80), radius=12, fill=(18, 26, 36, 255), outline=(79, 216, 255, 255), width=2)
    draw.line([(cx - 80, cy - 80), (cx - 80 + int(math.cos(t * math.pi * 2) * 8), cy - 80 + int(math.sin(t * math.pi * 2) * 8))], fill=(255, 60, 60, 255), width=2)
    
    return apply_pro_bloom(canvas, radius=6, intensity=1.4)

# =============================================================================
# 2. DEFENSE RAMPART TACTICAL BUNKER TERMINAL (MASTER HD 256x256)
# =============================================================================

def render_defense_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 380
    radar_angle = t * math.pi * 2
    
    # Shadow
    draw.ellipse([cx - 160, cy + 30, cx + 160, cy + 85], fill=(2, 6, 12, 140))
    
    # Heavy Slanted Armored Defense Bunker Base
    draw.polygon([
        (cx - 150, cy - 10), (cx + 150, cy - 10),
        (cx + 165, cy + 50), (cx - 165, cy + 50)
    ], fill=(24, 30, 40, 255), outline=(55, 72, 95, 255), width=3)
    
    # Tactical Multi-Monitor CRT Array
    draw.rectangle([cx - 95, cy - 130, cx + 95, cy - 20], fill=(12, 18, 24, 255), outline=(70, 95, 125, 255), width=3)
    # Tactical Radar Grid (Green Phosphor Screen)
    draw.rectangle([cx - 85, cy - 120, cx + 85, cy - 30], fill=(6, 32, 18, 255))
    
    # Concentric Radar Rings
    r_cx, r_cy = cx, cy - 75
    draw.circle((r_cx, r_cy), radius=40, outline=(30, 160, 80, 160), width=1)
    draw.circle((r_cx, r_cy), radius=22, outline=(30, 160, 80, 140), width=1)
    draw.circle((r_cx, r_cy), radius=8, outline=(30, 160, 80, 120), width=1)
    
    # Revolving Tactical Radar Sweep Line
    draw.line([(r_cx, r_cy), (r_cx + int(math.cos(radar_angle) * 40), r_cy + int(math.sin(radar_angle) * 40))], fill=(80, 255, 130, 255), width=2)
    
    # Detected Enemy Blip Ping
    blip_ang = radar_angle - 0.4
    bx = r_cx + int(math.cos(blip_ang) * 28)
    by = r_cy + int(math.sin(blip_ang) * 28)
    draw.circle((bx, by), radius=4, fill=(255, 55, 75, 255), outline=(255, 255, 255, 255))
    
    # Hexagonal Force Field Shield Projection Arch
    shield_pulse = (math.sin(t * math.pi * 3) + 1.0) / 2.0
    for ang in range(0, 180, 30):
        rad = math.radians(ang)
        x1 = cx + int(math.cos(rad) * 110)
        y1 = cy - 60 - int(math.sin(rad) * 80)
        x2 = cx + int(math.cos(rad + 0.35) * 110)
        y2 = cy - 60 - int(math.sin(rad + 0.35) * 80)
        draw.line([(x1, y1), (x2, y2)], fill=(79, 216, 255, int(150 + 80 * shield_pulse)), width=2)
        
    return apply_pro_bloom(canvas, radius=6, intensity=1.4)

# =============================================================================
# 3. POLISHED INLAID TITANIUM FLOOR EMBLEM (MASTER HD 256x256)
# =============================================================================

def render_emblem_master_frame(t):
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = 256, 256
    pulse = (math.sin(t * math.pi * 2) + 1.0) / 2.0
    
    # Outer Recessed Floor Rim
    draw.ellipse([cx - 180, cy - 90, cx + 180, cy + 90], fill=(14, 18, 26, 255), outline=(45, 60, 80, 255), width=4)
    draw.ellipse([cx - 155, cy - 75, cx + 155, cy + 75], fill=(22, 28, 40, 255), outline=(75, 100, 135, 255), width=2)
    
    # Concentric Glowing Power Trace Circuits
    glow_col = (79, 216, 255, int(180 + 75 * pulse))
    draw.ellipse([cx - 135, cy - 65, cx + 135, cy + 65], outline=glow_col, width=3)
    draw.ellipse([cx - 110, cy - 50, cx + 110, cy + 50], outline=glow_col, width=2)
    
    # 8 Cardinal Circuit Rays Emanating Outward
    for a in range(8):
        ang = a * (math.pi / 4.0) + (t * 0.2)
        rx1 = cx + int(math.cos(ang) * 110)
        ry1 = cy + int(math.sin(ang) * 50)
        rx2 = cx + int(math.cos(ang) * 150)
        ry2 = cy + int(math.sin(ang) * 72)
        draw.line([(rx1, ry1), (rx2, ry2)], fill=glow_col, width=2)
        draw.circle((rx2, ry2), radius=3, fill=(255, 255, 255, 255))
        
    # Central Polished Titanium Teardrop Emblem
    drop_w, drop_h = 60, 85
    top_x, top_y = cx, cy - drop_h
    bot_y = cy + drop_h * 0.7
    
    drop_pts = [
        (top_x, top_y),
        (cx + drop_w, cy - drop_h * 0.1),
        (cx + drop_w * 0.85, bot_y),
        (cx - drop_w * 0.85, bot_y),
        (cx - drop_w, cy - drop_h * 0.1)
    ]
    draw.polygon(drop_pts, fill=(35, 120, 185, 255), outline=(140, 235, 255, 255), width=4)
    # Inner reflective highlight
    draw.ellipse([cx - 30, cy - 25, cx + 10, cy + 15], fill=(120, 215, 255, int(200 + 45 * pulse)))
    draw.circle((cx - 12, cy - 10), radius=10, fill=(255, 255, 255, 255))
    
    return apply_pro_bloom(canvas, radius=6, intensity=1.5)

# =============================================================================
# EXPORT ALL REMAINING STATIONS (256x256)
# =============================================================================

def build_all_remaining_stations(camp_dir):
    os.makedirs(camp_dir, exist_ok=True)
    
    stations = [
        ("camp-station-hangar-16.png", render_hangar_master_frame),
        ("camp-station-defense-16.png", render_defense_master_frame),
        ("camp-floor-emblem-16.png", render_emblem_master_frame)
    ]
    
    for filename, render_func in stations:
        strip = Image.new("RGBA", (EXPORT_SIZE * NUM_FRAMES, EXPORT_SIZE), (0, 0, 0, 0))
        for i in range(NUM_FRAMES):
            t = i / float(NUM_FRAMES)
            hi_frame = render_func(t)
            frame2x = hi_frame.resize((EXPORT_SIZE, EXPORT_SIZE), Image.Resampling.LANCZOS)
            strip.paste(frame2x, (i * EXPORT_SIZE, 0), frame2x)
            
        out_path = os.path.join(camp_dir, filename)
        strip.save(out_path, "PNG")
        print(f"Exported Masterpiece 2X Station: {out_path} ({EXPORT_SIZE * NUM_FRAMES}x{EXPORT_SIZE})")

if __name__ == "__main__":
    out_camp = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
    print("=================================================================")
    print("GENERATING HANGAR, DEFENSE & EMBLEM IN 2X RETINA HD...")
    print("=================================================================")
    build_all_remaining_stations(out_camp)
