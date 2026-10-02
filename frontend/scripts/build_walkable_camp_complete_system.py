import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FW_HI, FH_HI = 256, 256
FW, FH = 128, 128
ANCHOR_X_HI, ANCHOR_Y_HI = 128, 224

def save_hi_strip(hi_frames, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    total_w = FW * len(hi_frames)
    strip = Image.new("RGBA", (total_w, FH), (0, 0, 0, 0))
    for i, hf in enumerate(hi_frames):
        lo_frame = hf.resize((FW, FH), Image.Resampling.LANCZOS)
        strip.paste(lo_frame, (i * FW, 0), lo_frame)
    strip.save(output_path, "PNG")
    print(f"Exported (Camp Quality): {output_path} ({total_w}x{FH}, {len(hi_frames)} frames)")

def draw_shadow_hi(draw, cx, cy, radius_x=44, radius_y=14, alpha=110):
    draw.ellipse([cx - radius_x, cy - radius_y, cx + radius_x, cy + radius_y], fill=(4, 10, 18, alpha))
    draw.ellipse([cx - radius_x*0.6, cy - radius_y*0.6, cx + radius_x*0.6, cy + radius_y*0.6], fill=(2, 6, 12, int(alpha*1.4)))

def draw_paddle_leg_hi(draw, hip_x, hip_y, foot_x, foot_y, leg_w=10, knee_bend=1.0, is_stepping=False, facing_y=1.0):
    knee_x = (hip_x + foot_x) / 2.0 + (12 * knee_bend if is_stepping else 4)
    knee_y = (hip_y + foot_y) / 2.0 - (8 if is_stepping else 0)
    
    draw.line([(hip_x, hip_y), (knee_x, knee_y)], fill=(18, 62, 92, 255), width=leg_w)
    draw.line([(knee_x, knee_y), (foot_x, foot_y)], fill=(14, 52, 78, 255), width=leg_w - 2)
    draw.ellipse([knee_x - 4, knee_y - 4, knee_x + 4, knee_y + 4], fill=(32, 98, 142, 255))
    
    # Foot facing
    draw.ellipse([foot_x - 16, foot_y - 6, foot_x + 16, foot_y + 6], fill=(10, 42, 68, 255), outline=(4, 16, 28, 255))
    draw.ellipse([foot_x - 12, foot_y - 4, foot_x + 8, foot_y + 2], fill=(24, 78, 118, 255))

def draw_directional_hero_hi(
    draw, cx=128, cy=160,
    dir_x=0.0, dir_y=1.0, # (0, 1) = South (Front), (0, -1) = North (Back), (1, 0) = East (Right), (-1, 0) = West (Left)
    leg_phase=0.0,
    leg_spread=28,
    body_bob=0.0,
    wobble=0.0,
    headband_flow=0.0,
    eye_type='normal'
):
    """Renders the canonical Aqua Rage model sheet hero facing any of the 8 directions with realistic liquid shading."""
    body_cy = cy + body_bob
    
    # 1. Contact Shadow
    draw_shadow_hi(draw, cx, ANCHOR_Y_HI + 4, radius_x=44 + int(abs(wobble)*4), radius_y=12)
    
    # 2. Grounded Legs
    hip_y = body_cy + 36
    hip_l_x = cx - 18 * (1.0 if abs(dir_x) < 0.5 else 0.5)
    hip_r_x = cx + 18 * (1.0 if abs(dir_x) < 0.5 else 0.5)
    
    foot_l_lift = max(0.0, math.sin(leg_phase) * 16)
    foot_r_lift = max(0.0, math.sin(leg_phase + math.pi) * 16)
    
    foot_l_y = ANCHOR_Y_HI - foot_l_lift
    foot_r_y = ANCHOR_Y_HI - foot_r_lift
    
    foot_l_x = hip_l_x - math.cos(leg_phase) * leg_spread * (1.0 if dir_x >= 0 else -1.0)
    foot_r_x = hip_r_x + math.cos(leg_phase) * leg_spread * (1.0 if dir_x >= 0 else -1.0)
    
    # Draw back legs if facing down, front legs if facing up
    if dir_y <= 0:
        # Back view: draw legs in front of body
        draw_paddle_leg_hi(draw, hip_l_x, hip_y, foot_l_x, foot_l_y, knee_bend=-1.0, is_stepping=(foot_l_lift > 2), facing_y=dir_y)
        draw_paddle_leg_hi(draw, hip_r_x, hip_y, foot_r_x, foot_r_y, knee_bend=1.0, is_stepping=(foot_r_lift > 2), facing_y=dir_y)
    else:
        draw_paddle_leg_hi(draw, hip_l_x, hip_y, foot_l_x, foot_l_y, knee_bend=1.0, is_stepping=(foot_l_lift > 2), facing_y=dir_y)
        draw_paddle_leg_hi(draw, hip_r_x, hip_y, foot_r_x, foot_r_y, knee_bend=-1.0, is_stepping=(foot_r_lift > 2), facing_y=dir_y)
        
    # 3. Teardrop Liquid Torso & Head
    bw = 52 + wobble * 2
    bh = 64 - wobble
    
    # Curved teardrop tip orientation based on facing
    tip_offset_x = dir_x * 12 + math.sin(dir_x) * 8
    top_x = cx + tip_offset_x + wobble
    top_y = body_cy - bh + 4
    bot_y = body_cy + bh * 0.72
    
    body_pts = [
        (top_x, top_y),
        (cx + bw * 0.7, body_cy - bh * 0.4),
        (cx + bw, body_cy),
        (cx + bw * 0.85, bot_y),
        (cx - bw * 0.85, bot_y),
        (cx - bw, body_cy),
        (cx - bw * 0.7, body_cy - bh * 0.4)
    ]
    draw.polygon(body_pts, fill=(28, 92, 138, 255), outline=(4, 14, 24, 255))
    
    # Sub-surface liquid volume & refraction highlights
    core_pts = [
        (top_x, top_y + 12),
        (cx + bw * 0.7, body_cy),
        (cx + bw * 0.5, bot_y - 8),
        (cx - bw * 0.5, bot_y - 8),
        (cx - bw * 0.7, body_cy)
    ]
    draw.polygon(core_pts, fill=(48, 142, 198, 255))
    
    # Specular highlights (only visible if facing front or side)
    if dir_y >= -0.2:
        draw.ellipse([cx - bw*0.65 + dir_x*12, body_cy - bh*0.45, cx + bw*0.1 + dir_x*12, body_cy + bh*0.15], fill=(88, 196, 248, 230))
        draw.ellipse([cx - bw*0.45 + dir_x*12, body_cy - bh*0.4, cx - bw*0.1 + dir_x*12, body_cy - bh*0.15], fill=(210, 248, 255, 255))
        draw.circle((cx - bw*0.3 + dir_x*12, body_cy - bh*0.3), radius=5, fill=(255, 255, 255, 255))
        
    # Micro-condensation water droplets on skin (from model sheet)
    draw.ellipse([cx - 18, body_cy + 10, cx - 12, body_cy + 22], fill=(120, 215, 255, 180))
    draw.ellipse([cx + 14, body_cy + 8, cx + 20, body_cy + 20], fill=(120, 215, 255, 180))
    
    # 4. Red Headband with White Racing Stripe & Knot Ribbons
    hb_y = body_cy - bh * 0.22
    hb_l = cx - bw * 0.95
    hb_r = cx + bw * 0.95
    
    draw.polygon([(hb_l, hb_y - 8), (hb_r, hb_y - 8), (hb_r, hb_y + 14), (hb_l, hb_y + 14)], fill=(188, 24, 38, 255), outline=(72, 8, 14, 255))
    draw.line([(hb_l, hb_y + 2), (hb_r, hb_y + 2)], fill=(250, 250, 250, 255), width=4)
    
    # Headband Knot Ribbons (positioned based on facing direction)
    knot_x = cx - bw * (0.92 if dir_x >= 0 else -0.92) if abs(dir_y) < 0.8 else cx
    knot_y = hb_y if dir_y >= 0 else hb_y + 4
    
    # Flowing dual ribbons with inertia
    r1_x = knot_x - (28 * (1.0 if dir_x >= 0 else -1.0)) + headband_flow * 14
    r1_y = knot_y + 24 + math.sin(headband_flow * 3) * 6
    r2_x = knot_x - (38 * (1.0 if dir_x >= 0 else -1.0)) + headband_flow * 20
    r2_y = knot_y + 38 + math.cos(headband_flow * 3) * 8
    
    draw.polygon([(knot_x, knot_y), (r1_x, r1_y), (r1_x + 6, r1_y + 4), (knot_x, knot_y + 12)], fill=(188, 24, 38, 255), outline=(72, 8, 14, 255))
    draw.polygon([(knot_x, knot_y + 4), (r2_x, r2_y), (r2_x + 6, r2_y + 4), (knot_x, knot_y + 14)], fill=(154, 18, 30, 255), outline=(72, 8, 14, 255))
    
    # 5. Eyes & Facial Expression (Only rendered when facing South/East/West, hidden when facing North)
    if dir_y >= -0.3:
        eye_offset_x = 16 * dir_x
        ey = body_cy - 8
        
        eye_col = (255, 42, 65, 255)
        pupil_col = (255, 255, 255, 255)
        
        # Left Eye
        if dir_x > -0.8: # Visible if not turned direct profile left
            el_x = cx - 20 + eye_offset_x
            draw.ellipse([el_x, ey - 12, el_x + 16, ey + 10], fill=eye_col, outline=(36, 4, 8, 255))
            draw.ellipse([el_x + 6, ey - 6, el_x + 14, ey + 4], fill=pupil_col)
            # Angry brow line
            draw.line([(el_x - 4, ey - 10), (el_x + 18, ey - 6)], fill=(14, 52, 78, 255), width=3)
            
        # Right Eye
        if dir_x < 0.8: # Visible if not turned direct profile right
            er_x = cx + 8 + eye_offset_x
            draw.ellipse([er_x, ey - 12, er_x + 16, ey + 10], fill=eye_col, outline=(36, 4, 8, 255))
            draw.ellipse([er_x + 6, ey - 6, er_x + 14, ey + 4], fill=pupil_col)
            # Angry brow line
            draw.line([(er_x - 2, ey - 6), (er_x + 20, ey - 10)], fill=(14, 52, 78, 255), width=3)
            
        # Intense angry mouth line
        mouth_x = cx + eye_offset_x * 0.7
        draw.arc([mouth_x - 10, body_cy + 6, mouth_x + 10, body_cy + 18], start=200, end=340, fill=(14, 52, 78, 255), width=3)
        
    # 6. Arms & Hands
    sh_l = (cx - bw * 0.72, body_cy + 8)
    sh_r = (cx + bw * 0.72, body_cy + 8)
    
    # Arm swing during walk
    arm_swing = math.sin(leg_phase) * 14
    hand_l = (sh_l[0] - 10, sh_l[1] + 32 + arm_swing)
    hand_r = (sh_r[0] + 10, sh_r[1] + 32 - arm_swing)
    
    draw.line([sh_l, hand_l], fill=(28, 92, 138, 255), width=8)
    draw.circle(hand_l, radius=6, fill=(48, 142, 198, 255), outline=(4, 14, 24, 255))
    
    draw.line([sh_r, hand_r], fill=(28, 92, 138, 255), width=8)
    draw.circle(hand_r, radius=6, fill=(48, 142, 198, 255), outline=(4, 14, 24, 255))

# =============================================================================
# BUILD ALL 8-DIRECTIONAL CAMP WALK CYCLES
# =============================================================================

def build_8dir_camp_hero_walks(camp_dir):
    directions = [
        ("down", 0.0, 1.0, "South / Facing Camera"),
        ("up", 0.0, -1.0, "North / Back View"),
        ("right", 1.0, 0.0, "East / Right Profile"),
        ("left", -1.0, 0.0, "West / Left Profile"),
        ("downright", 0.71, 0.71, "South-East 3/4 Front"),
        ("downleft", -0.71, 0.71, "South-West 3/4 Front"),
        ("upright", 0.71, -0.71, "North-East 3/4 Rear"),
        ("upleft", -0.71, -0.71, "North-West 3/4 Rear"),
    ]
    
    for dir_name, dx, dy, desc in directions:
        hi_frames = []
        for i in range(16):
            t = i / 16.0
            canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
            draw = ImageDraw.Draw(canvas)
            leg_ph = t * math.pi * 2
            bob = -abs(math.sin(leg_ph)) * 5.0
            wob = math.sin(leg_ph) * 3.0
            flow = -0.4 + math.sin(leg_ph) * 0.4
            draw_directional_hero_hi(draw, cx=128, cy=160, dir_x=dx, dir_y=dy, leg_phase=leg_ph, leg_spread=26, body_bob=bob, wobble=wob, headband_flow=flow)
            hi_frames.append(canvas)
        out_file = os.path.join(camp_dir, f"camp-hero-walk-{dir_name}-16.png")
        save_hi_strip(hi_frames, out_file)

# =============================================================================
# EXTRACT RAPID ATTACKS FROM USER ARTWORK
# =============================================================================

def extract_user_rapid_attacks(uploaded_path, output_path):
    img = Image.open(uploaded_path).convert("RGBA")
    w, h = img.size
    cols, rows = 4, 4
    cell_w, cell_h = w // cols, h // rows
    
    frames = []
    for r in range(rows):
        for c in range(cols):
            x0 = c * cell_w + 10
            y0 = r * cell_h + 10
            x1 = (c + 1) * cell_w - 10
            y1 = (r + 1) * cell_h - 10
            
            cell = img.crop((x0, y0, x1, y1))
            arr = np.array(cell, dtype=np.float32)
            
            # Distance from cell background (grey-blue around [125, 140, 155])
            bg_col = np.array([130, 144, 156], dtype=np.float32)
            dist = np.sqrt(np.sum((arr[:, :, :3] - bg_col) ** 2, axis=2))
            alpha = np.clip((dist - 30.0) / 20.0, 0.0, 1.0) * 255.0
            arr[:, :, 3] = alpha
            
            clean_cell = Image.fromarray(arr.astype(np.uint8), mode="RGBA")
            bbox = clean_cell.getbbox()
            if bbox:
                char_crop = clean_cell.crop(bbox)
                cw, ch = char_crop.size
                scale = min(88.0 / ch, 88.0 / cw)
                scaled_w = int(cw * scale)
                scaled_h = int(ch * scale)
                char_scaled = char_crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                
                frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
                draw = ImageDraw.Draw(frame)
                foot_y = 112
                draw.ellipse([64 - 22, foot_y - 2, 64 + 22, foot_y + 6], fill=(4, 10, 18, 90))
                paste_x = (128 - scaled_w) // 2
                paste_y = foot_y - scaled_h
                frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
                frames.append(frame)
            else:
                frames.append(Image.new("RGBA", (128, 128), (0, 0, 0, 0)))
                
    strip = Image.new("RGBA", (128 * len(frames), 128), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * 128, 0), f)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, "PNG")
    print(f"Exported Rapid Attacks Strip from User Art: {output_path}")

# =============================================================================
# MASTER RUNNER
# =============================================================================

if __name__ == "__main__":
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    camp_dir = os.path.join(out_dir, "camp")
    uploaded_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
    
    print("=================================================================")
    print("GENERATING COMPLETE 8-DIR CAMP HERO & EXTRACTING ARTWORK...")
    print("=================================================================")
    
    # 1. Generate all 8-directional walking cycles
    build_8dir_camp_hero_walks(camp_dir)
    
    # 2. Extract Rapid Attacks from user artwork
    atk_img = os.path.join(uploaded_dir, "media_1787676868867.jpg")
    extract_user_rapid_attacks(atk_img, os.path.join(out_dir, "combat", "waterdrop-rapid-attacks-16.png"))
    
    # 3. Update master manifest
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "r") as f:
        data = json.load(f)
        
    data["categories"]["walkable_camp_8dir"] = {
        "walk_down": { "file": "camp/camp-hero-walk-down-16.png", "frames": 16, "fps": 16, "facing": "South (Camera)" },
        "walk_up": { "file": "camp/camp-hero-walk-up-16.png", "frames": 16, "fps": 16, "facing": "North (Away)" },
        "walk_right": { "file": "camp/camp-hero-walk-right-16.png", "frames": 16, "fps": 16, "facing": "East" },
        "walk_left": { "file": "camp/camp-hero-walk-left-16.png", "frames": 16, "fps": 16, "facing": "West" },
        "walk_downright": { "file": "camp/camp-hero-walk-downright-16.png", "frames": 16, "fps": 16, "facing": "South-East" },
        "walk_downleft": { "file": "camp/camp-hero-walk-downleft-16.png", "frames": 16, "fps": 16, "facing": "South-West" },
        "walk_upright": { "file": "camp/camp-hero-walk-upright-16.png", "frames": 16, "fps": 16, "facing": "North-East" },
        "walk_upleft": { "file": "camp/camp-hero-walk-upleft-16.png", "frames": 16, "fps": 16, "facing": "North-West" },
    }
    data["categories"]["combat"]["rapid_attacks"] = {
        "file": "combat/waterdrop-rapid-attacks-16.png", "frames": 16, "fps": 20, "desc": "16-frame rapid attack burst from canonical model artwork"
    }
    
    with open(manifest_path, "w") as f:
        json.dump(data, f, indent=2)
        
    print("\n=================================================================")
    print("ALL 8-DIRECTIONAL CAMP CYCLES AND ARTWORK EXTRACTED SUCCESSFULLY!")
    print("=================================================================")
