import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W2X, H2X = 1920, 1080  # Full 2X HD Stage (960x540 * 2)
STAGE_W, STAGE_H = 960, 540
NUM_FRAMES = 16

def apply_pro_bloom(img, radius=8, intensity=1.5):
    glow = img.filter(ImageFilter.GaussianBlur(radius))
    arr_base = np.array(img, dtype=np.float32)
    arr_glow = np.array(glow, dtype=np.float32)
    
    out = arr_base.copy()
    for c in range(3):
        out[:, :, c] = np.clip(arr_base[:, :, c] + arr_glow[:, :, c] * intensity * (arr_glow[:, :, 3] / 255.0), 0, 255)
    out[:, :, 3] = np.clip(arr_base[:, :, 3] + arr_glow[:, :, 3] * 0.5, 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")

# =============================================================================
# 1. 2X RETINA HD SPACE STATION MAIN HALL ROOM BACKGROUND (1920x1080)
# =============================================================================

def build_space_station_room_background(output_path):
    canvas = Image.new("RGBA", (W2X, H2X), (10, 14, 22, 255))
    draw = ImageDraw.Draw(canvas)
    
    # 1. Deep Space Cosmic Background for Viewport
    window_x0, window_y0 = int(396 * 2), int(46 * 2)
    window_x1, window_y1 = int(564 * 2), int(140 * 2)
    
    # Stars outside window
    for s in range(60):
        sx = window_x0 + int((s * 47 + s * 19) % (window_x1 - window_x0))
        sy = window_y0 + int((s * 31 + s * 13) % (window_y1 - window_y0))
        draw.point((sx, sy), fill=(210, 235, 255, 200))
        
    # Blue cosmic nebula outside
    draw.ellipse([window_x0 - 50, window_y0 - 40, window_x1 + 50, window_y1 + 40], fill=(25, 45, 95, 120))
    draw.ellipse([window_x0 + 20, window_y0 - 20, window_x1 - 20, window_y1 + 20], fill=(45, 85, 165, 140))
    
    # 2. Heavy Structural Bulkhead Wall (Top Half)
    draw.rectangle([0, 0, W2X, int(152 * 2)], fill=(18, 24, 34, 255))
    
    # Reinforced Metallic Wall Panels with Bevels
    for col in range(0, W2X, int(120 * 2)):
        draw.rectangle([col + 4, 10, col + int(116 * 2), int(148 * 2)], fill=(24, 32, 44, 255), outline=(48, 62, 82, 255), width=3)
        # Vertical Rivet Columns
        for rv in range(20, int(145 * 2), 24):
            draw.circle((col + 14, rv), radius=3, fill=(12, 16, 24, 255), outline=(75, 95, 125, 255))
            draw.circle((col + int(106 * 2), rv), radius=3, fill=(12, 16, 24, 255), outline=(75, 95, 125, 255))
            
    # Window Frame Bulkhead (Heavy Beveled Steel)
    draw.rectangle([window_x0 - 12, window_y0 - 12, window_x1 + 12, window_y1 + 12], fill=(28, 36, 48, 255), outline=(75, 100, 135, 255), width=6)
    draw.rectangle([window_x0, window_y0, window_x1, window_y1], outline=(120, 160, 210, 255), width=3)
    
    # 3. Main Walkable Floor Plating (FLOOR area: x0=128, y0=152, x1=832, y1=456)
    fx0, fy0 = int(128 * 2), int(152 * 2)
    fx1, fy1 = int(832 * 2), int(456 * 2)
    
    # Floor Base - Dark Titanium
    draw.rectangle([fx0, fy0, fx1, fy1], fill=(22, 28, 38, 255))
    
    # Modular Interlocking Floor Plates (Grid with Chamfers)
    plate_w, plate_h = int(64 * 2), int(48 * 2)
    for px in range(fx0, fx1, plate_w):
        for py in range(fy0, fy1, plate_h):
            pw = min(plate_w, fx1 - px)
            ph = min(plate_h, fy1 - py)
            
            # Subtle tone variation
            seed = (px * 37 + py * 19) % 10
            col = (26 + seed, 32 + seed, 44 + seed, 255)
            draw.rectangle([px + 3, py + 3, px + pw - 3, py + ph - 3], fill=col, outline=(40, 52, 70, 255), width=2)
            # Corner screws
            draw.circle((px + 8, py + 8), radius=2, fill=(12, 16, 22, 255), outline=(65, 85, 110, 255))
            draw.circle((px + pw - 8, py + ph - 8), radius=2, fill=(12, 16, 22, 255), outline=(65, 85, 110, 255))
            
    # 4. Inlaid Glowing Cyan & Amber Power Conduits Connecting All Stations
    # Central power bus line
    mid_x = int(480 * 2)
    draw.line([(mid_x, fy0 + 20), (mid_x, fy1 - 20)], fill=(79, 216, 255, 180), width=4)
    # Left power branch to Well
    draw.line([(mid_x, int(310 * 2)), (fx0 + 20, int(310 * 2))], fill=(79, 216, 255, 180), width=4)
    # Right power branch to Bio Lab
    draw.line([(mid_x, int(310 * 2)), (fx1 - 20, int(310 * 2))], fill=(79, 216, 255, 180), width=4)
    # Top-left to Navigation
    draw.line([(int(297 * 2), fy0 + 10), (int(297 * 2), int(240 * 2))], fill=(79, 216, 255, 180), width=4)
    # Top-right to Forge (Thermal Amber Conduit)
    draw.line([(int(662 * 2), fy0 + 10), (int(662 * 2), int(240 * 2))], fill=(255, 140, 30, 200), width=4)
    
    # 5. Station Approach Door Plates & Floor Decals
    # Station positions in stage coordinates:
    station_plates = [
        ("nav", int(297 * 2), int(170 * 2), (79, 216, 255)),
        ("fab", int(662 * 2), int(170 * 2), (255, 140, 30)),
        ("recl", int(155 * 2), int(310 * 2), (79, 216, 255)),
        ("bio", int(805 * 2), int(310 * 2), (55, 255, 160)),
        ("hangar", int(677 * 2), int(435 * 2), (255, 195, 30)),
        ("def", int(480 * 2), int(435 * 2), (80, 255, 130)),
        ("exit", int(269 * 2), int(435 * 2), (79, 216, 255))
    ]
    for name, sx, sy, col in station_plates:
        # Ground interaction pad
        draw.ellipse([sx - 45, sy - 20, sx + 45, sy + 20], fill=(14, 20, 28, 255), outline=col, width=3)
        draw.ellipse([sx - 35, sy - 14, sx + 35, sy + 14], fill=(col[0]//4, col[1]//4, col[2]//4, 180), outline=(255, 255, 255, 180), width=1)
        
    # 6. Outer Structural Ribs / Floor Perimeter Wall
    draw.rectangle([0, fy0, fx0, H2X], fill=(14, 18, 26, 255), outline=(45, 60, 80, 255), width=4)
    draw.rectangle([fx1, fy0, W2X, H2X], fill=(14, 18, 26, 255), outline=(45, 60, 80, 255), width=4)
    draw.rectangle([fx0, fy1, fx1, H2X], fill=(14, 18, 26, 255), outline=(45, 60, 80, 255), width=4)
    
    # Structural Diagonal Floor Braces in Corners
    draw.polygon([(fx0, fy0), (fx0 + 80, fy0), (fx0, fy0 + 80)], fill=(32, 42, 56, 255), outline=(65, 85, 115, 255))
    draw.polygon([(fx1, fy0), (fx1 - 80, fy0), (fx1, fy0 + 80)], fill=(32, 42, 56, 255), outline=(65, 85, 115, 255))
    draw.polygon([(fx0, fy1), (fx0 + 80, fy1), (fx0, fy1 - 80)], fill=(32, 42, 56, 255), outline=(65, 85, 115, 255))
    draw.polygon([(fx1, fy1), (fx1 - 80, fy1), (fx1, fy1 - 80)], fill=(32, 42, 56, 255), outline=(65, 85, 115, 255))
    
    final_img = apply_pro_bloom(canvas, radius=8, intensity=1.4)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    final_img.save(output_path, "PNG")
    print(f"Exported Masterpiece Space Station Background: {output_path} ({W2X}x{H2X})")

# =============================================================================
# 2. DEPARTURE PORTAL TELEPORTER (256x256, 16 FRAMES)
# =============================================================================

def render_teleport_portal_frame(t, fw=256, fh=256):
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    cx, cy = fw // 2, fh - 35
    pulse = (math.sin(t * math.pi * 2) + 1.0) / 2.0
    rot = t * math.pi * 2
    
    # Shadow
    draw.ellipse([cx - 90, cy - 25, cx + 90, cy + 25], fill=(2, 6, 12, 140))
    
    # Outer Octagonal Teleport Pad Rim
    draw.ellipse([cx - 80, cy - 20, cx + 80, cy + 20], fill=(20, 28, 38, 255), outline=(75, 105, 145, 255), width=3)
    draw.ellipse([cx - 65, cy - 14, cx + 65, cy + 14], fill=(12, 45, 75, 240), outline=(79, 216, 255, 255), width=2)
    
    # Swirling Teleport Energy Vortex
    for v in range(3):
        v_rot = rot * (1.0 if v % 2 == 0 else -1.2) + v * 1.5
        vx = int(45 * abs(math.cos(v_rot))) + 10
        vy = int(12 * abs(math.sin(v_rot))) + 4
        draw.ellipse([cx - vx, cy - vy, cx + vx, cy + vy], outline=(140, 235, 255, int(180 + 75 * pulse)), width=2)
        
    # Vertical Upward Warp Particles / Light Stream
    for p in range(10):
        p_life = (t + p * 0.1) % 1.0
        px = cx - 35 + (p * 23) % 70 + math.sin(p_life * math.pi * 4) * 6
        py = cy - (p_life * 150)
        p_alpha = int((1.0 - p_life) * 240)
        if p_alpha > 0 and py > 20:
            draw.line([(px, py), (px, py + 12)], fill=(79, 216, 255, p_alpha), width=2)
            draw.circle((px, py), radius=2, fill=(255, 255, 255, p_alpha))
            
    # Central Portal Singularity Core
    draw.ellipse([cx - 20, cy - 6, cx + 20, cy + 6], fill=(220, 250, 255, 255), outline=(79, 216, 255, 255))
    
    return apply_pro_bloom(frame, radius=6, intensity=1.5)

# =============================================================================
# 3. 2X EARTH WINDOW OBSERVATORY LOOP (384x216, 16 FRAMES)
# =============================================================================

def build_earth_window_2x(output_path, num_frames=16, frame_w=384, frame_h=216):
    strip = Image.new("RGBA", (frame_w * num_frames, frame_h), (0, 0, 0, 0))
    
    for i in range(num_frames):
        t = i / float(num_frames)
        frame = Image.new("RGBA", (frame_w, frame_h), (6, 12, 22, 255))
        draw = ImageDraw.Draw(frame)
        
        # Deep space stars & galaxies
        for s in range(50):
            sx = int((s * 53 + s * 17) % frame_w)
            sy = int((s * 41 + s * 11) % frame_h)
            twinkle = 140 + int(math.sin(t * math.pi * 4 + s) * 110)
            draw.point((sx, sy), fill=(210, 235, 255, twinkle))
            
        # Cosmic deep blue / purple nebula wash
        draw.ellipse([frame_w//2 - 120, -40, frame_w//2 + 160, frame_h + 60], fill=(40, 25, 90, 80))
        draw.ellipse([frame_w//2 - 40, -20, frame_w//2 + 180, frame_h + 40], fill=(20, 70, 140, 80))
        
        # Earth Planet Curve
        earth_cx, earth_cy = frame_w // 2 + 20, frame_h + 80
        earth_r = 148
        
        # Atmosphere glow
        draw.circle((earth_cx, earth_cy), radius=earth_r + 8, outline=(120, 210, 255, 140), width=6)
        draw.circle((earth_cx, earth_cy), radius=earth_r + 4, outline=(180, 240, 255, 180), width=3)
        # Earth Ocean Sphere
        draw.circle((earth_cx, earth_cy), radius=earth_r, fill=(20, 72, 145, 255))
        
        # Rotating Continents (Detailed Green/Earth landmasses)
        rot_offset = int(t * 80)
        for c in range(4):
            lx = earth_cx - 100 + c * 72 + rot_offset
            if lx > earth_cx + earth_r:
                lx -= (earth_r * 2)
            ly = earth_cy - 80 + (c * 36) % 60
            draw.ellipse([lx - 32, ly - 20, lx + 32, ly + 20], fill=(45, 145, 75, 220))
            
        # Atmospheric Cloud Swirls
        cloud_offset = int(t * 120)
        for cl in range(5):
            cx_cloud = earth_cx - 120 + cl * 64 + cloud_offset
            if cx_cloud > earth_cx + earth_r:
                cx_cloud -= (earth_r * 2)
            cy_cloud = earth_cy - 100 + (cl * 28) % 70
            draw.ellipse([cx_cloud - 40, cy_cloud - 12, cx_cloud + 40, cy_cloud + 12], fill=(255, 255, 255, 170))
            
        # Heavy Beveled Window Frame Border
        draw.rectangle([0, 0, frame_w - 1, frame_h - 1], outline=(38, 54, 72, 255), width=6)
        draw.rectangle([4, 4, frame_w - 5, frame_h - 5], outline=(72, 108, 142, 255), width=2)
        
        strip.paste(frame, (i * frame_w, 0))
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, "PNG")
    print(f"Exported 2X Earth Window Observatory: {output_path} ({frame_w * num_frames}x{frame_h})")

# =============================================================================
# MASTER RUNNER
# =============================================================================

if __name__ == "__main__":
    out_camp = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
    
    print("=================================================================")
    print("GENERATING COMPLETE 2X RETINA HD SPACE STATION ENVIRONMENT...")
    print("=================================================================")
    
    # 1. Room Background
    build_space_station_room_background(os.path.join(out_camp, "station-mainhall-background-2x.png"))
    
    # 2. Earth Window Observatory Loop
    build_earth_window_2x(os.path.join(out_camp, "station-earth-window-loop-16.png"))
    
    # 3. Departure Portal Teleporter
    portal_strip = Image.new("RGBA", (256 * NUM_FRAMES, 256), (0, 0, 0, 0))
    for i in range(NUM_FRAMES):
        t = i / float(NUM_FRAMES)
        p_frame = render_teleport_portal_frame(t, fw=256, fh=256)
        portal_strip.paste(p_frame, (i * 256, 0), p_frame)
    portal_path = os.path.join(out_camp, "camp-station-portal-exit-16.png")
    portal_strip.save(portal_path, "PNG")
    print(f"Exported Departure Portal Strip: {portal_path} ({256 * NUM_FRAMES}x256)")
    
    print("\n=================================================================")
    print("COMPLETE MASTERPIECE SPACE STATION ENVIRONMENT GENERATED!")
    print("=================================================================")
