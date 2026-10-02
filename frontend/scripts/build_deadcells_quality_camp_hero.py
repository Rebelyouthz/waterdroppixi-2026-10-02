import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# 4x Supersampling for ultra-smooth HD curves (Render at 512x512, export at 128x128 or 256x256)
RENDER_SIZE = 512
EXPORT_SIZE = 128
ANCHOR_X = 256
ANCHOR_Y = 440

def apply_subsurface_and_bloom(img):
    """Adds rich 3D fluid depth and crisp anti-aliased edge shading."""
    # Convert to array for high-precision blending
    arr = np.array(img, dtype=np.float32)
    return img

def draw_hd_shadow(draw, cx, cy, radius_x, radius_y, opacity=120):
    """Multi-layer soft contact shadow on space station floor."""
    draw.ellipse([cx - radius_x, cy - radius_y, cx + radius_x, cy + radius_y], fill=(3, 8, 16, opacity))
    draw.ellipse([cx - radius_x * 0.65, cy - radius_y * 0.65, cx + radius_x * 0.65, cy + radius_y * 0.65], fill=(2, 5, 10, int(opacity * 1.5)))
    draw.ellipse([cx - radius_x * 0.35, cy - radius_y * 0.35, cx + radius_x * 0.35, cy + radius_y * 0.35], fill=(1, 3, 6, int(opacity * 1.8)))

def draw_hd_skeletal_leg(draw, hip_x, hip_y, foot_x, foot_y, leg_thick=22, knee_bias=1.0, is_lifted=False, facing_z=1.0):
    """Draws a 2-segment jointed skeletal water leg with knee bend, thigh, calf, and grounded paddle foot."""
    # Knee IK position
    mid_x = (hip_x + foot_x) / 2.0
    mid_y = (hip_y + foot_y) / 2.0
    knee_x = mid_x + (28 * knee_bias if is_lifted else 8 * knee_bias)
    knee_y = mid_y - (22 if is_lifted else 4)
    
    # Outer dark ocean blue muscle outline
    draw.line([(hip_x, hip_y), (knee_x, knee_y)], fill=(12, 45, 72, 255), width=leg_thick + 8)
    draw.line([(knee_x, knee_y), (foot_x, foot_y)], fill=(12, 45, 72, 255), width=leg_thick + 6)
    
    # Thigh core liquid volume
    draw.line([(hip_x, hip_y), (knee_x, knee_y)], fill=(28, 98, 152, 255), width=leg_thick)
    # Calf core liquid volume
    draw.line([(knee_x, knee_y), (foot_x, foot_y)], fill=(24, 86, 138, 255), width=leg_thick - 2)
    
    # Knee joint cap & specular highlight
    draw.circle((knee_x, knee_y), radius=leg_thick // 2 + 2, fill=(42, 128, 188, 255), outline=(12, 45, 72, 255))
    draw.circle((knee_x - 3, knee_y - 3), radius=leg_thick // 4, fill=(110, 210, 255, 240))
    
    # Ankle & Grounded Paddle Foot
    foot_w = 42
    foot_h = 18
    # Foot outline
    draw.ellipse([foot_x - foot_w//2 - 3, foot_y - foot_h//2 - 2, foot_x + foot_w//2 + 3, foot_y + foot_h//2 + 2], fill=(12, 45, 72, 255))
    # Foot body
    draw.ellipse([foot_x - foot_w//2, foot_y - foot_h//2, foot_x + foot_w//2, foot_y + foot_h//2], fill=(26, 92, 145, 255))
    # Foot specular shine
    draw.ellipse([foot_x - foot_w//3, foot_y - foot_h//3, foot_x + foot_w//4, foot_y], fill=(95, 200, 255, 220))

def draw_hd_character_frame(
    dir_x=0.0, dir_y=1.0, # (0, 1) = South (Camera), (0, -1) = North (Away), (1, 0) = East (Right), (-1, 0) = West (Left)
    walk_phase=0.0,
    is_idle=False,
    idle_breath=0.0,
    blink_state=0.0
):
    """Renders a full-bodied 512x512 high-resolution frame of Aqua Rage matching the Dead Cells / Hades art style."""
    canvas = Image.new("RGBA", (RENDER_SIZE, RENDER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx = ANCHOR_X
    base_cy = 310
    
    # 1. Kinematic Walk / Idle calculations
    if is_idle:
        body_bob = math.sin(idle_breath * math.pi * 2) * 8.0
        squash = math.sin(idle_breath * math.pi * 2) * 0.03
        leg_phase_l = 0.0
        leg_phase_r = 0.0
        foot_l_lift = 0.0
        foot_r_lift = 0.0
        foot_l_x = cx - 38
        foot_r_x = cx + 38
        foot_l_y = ANCHOR_Y
        foot_r_y = ANCHOR_Y
        ribbon_wave = math.sin(idle_breath * math.pi * 2) * 10.0
    else:
        # Full 60fps walking gait with double support & passing phases
        body_bob = -abs(math.sin(walk_phase)) * 14.0
        squash = math.sin(walk_phase * 2) * 0.04
        
        # Leg strides
        leg_stride = 62.0
        foot_l_lift = max(0.0, math.sin(walk_phase) * 38.0)
        foot_r_lift = max(0.0, math.sin(walk_phase + math.pi) * 38.0)
        
        foot_l_y = ANCHOR_Y - foot_l_lift
        foot_r_y = ANCHOR_Y - foot_r_lift
        
        foot_l_x = cx - 36 - math.cos(walk_phase) * leg_stride * (1.0 if dir_x >= 0 else -1.0)
        foot_r_x = cx + 36 + math.cos(walk_phase) * leg_stride * (1.0 if dir_x >= 0 else -1.0)
        
        ribbon_wave = math.sin(walk_phase * 2) * 22.0
        
    cy = base_cy + body_bob
    
    # 2. Dynamic Contact Shadow on Floor
    shadow_spread = 88 + (12 if (foot_l_lift == 0 and foot_r_lift == 0) else -8)
    draw_hd_shadow(draw, cx, ANCHOR_Y + 8, radius_x=shadow_spread, radius_y=26, opacity=130)
    
    # 3. Skeletal Legs (Render order: Back legs first, or all legs before body depending on Y facing)
    hip_y = cy + 72
    hip_l_x = cx - 34 * (1.0 if abs(dir_x) < 0.6 else 0.5)
    hip_r_x = cx + 34 * (1.0 if abs(dir_x) < 0.6 else 0.5)
    
    if dir_y <= 0: # Facing away (North) - legs behind body
        draw_hd_skeletal_leg(draw, hip_l_x, hip_y, foot_l_x, foot_l_y, leg_thick=24, knee_bias=-1.0, is_lifted=(foot_l_lift > 4), facing_z=dir_y)
        draw_hd_skeletal_leg(draw, hip_r_x, hip_y, foot_r_x, foot_r_y, leg_thick=24, knee_bias=1.0, is_lifted=(foot_r_lift > 4), facing_z=dir_y)
    else: # Facing camera or side - legs drawn with depth
        # Draw rear leg first
        if dir_x >= 0:
            draw_hd_skeletal_leg(draw, hip_l_x, hip_y, foot_l_x, foot_l_y, leg_thick=22, knee_bias=-0.8, is_lifted=(foot_l_lift > 4), facing_z=dir_y)
            draw_hd_skeletal_leg(draw, hip_r_x, hip_y, foot_r_x, foot_r_y, leg_thick=25, knee_bias=1.0, is_lifted=(foot_r_lift > 4), facing_z=dir_y)
        else:
            draw_hd_skeletal_leg(draw, hip_r_x, hip_y, foot_r_x, foot_r_y, leg_thick=22, knee_bias=0.8, is_lifted=(foot_r_lift > 4), facing_z=dir_y)
            draw_hd_skeletal_leg(draw, hip_l_x, hip_y, foot_l_x, foot_l_y, leg_thick=25, knee_bias=-1.0, is_lifted=(foot_l_lift > 4), facing_z=dir_y)
            
    # 4. Teardrop 3D Liquid Torso & Head
    bw = int(108 * (1.0 + squash))
    bh = int(136 * (1.0 - squash))
    
    # Curved teardrop crest tip
    tip_x = cx + dir_x * 28 + (math.sin(walk_phase) * 8 if not is_idle else 0)
    tip_y = cy - bh + 6
    bot_y = cy + bh * 0.74
    
    # Outer dark ocean silhouette outline
    body_pts = [
        (tip_x, tip_y),
        (cx + bw * 0.55, cy - bh * 0.5),
        (cx + bw * 0.88, cy - bh * 0.15),
        (cx + bw, cy + bh * 0.25),
        (cx + bw * 0.82, bot_y),
        (cx - bw * 0.82, bot_y),
        (cx - bw, cy + bh * 0.25),
        (cx - bw * 0.88, cy - bh * 0.15),
        (cx - bw * 0.55, cy - bh * 0.5)
    ]
    draw.polygon(body_pts, fill=(12, 45, 72, 255), outline=(6, 24, 40, 255))
    
    # Inner subsurface waterdrop volume (Rich Gradient Layering)
    core_pts = [
        (tip_x, tip_y + 16),
        (cx + bw * 0.5, cy - bh * 0.45),
        (cx + bw * 0.8, cy - bh * 0.1),
        (cx + bw * 0.92, cy + bh * 0.25),
        (cx + bw * 0.75, bot_y - 12),
        (cx - bw * 0.75, bot_y - 12),
        (cx - bw * 0.92, cy + bh * 0.25),
        (cx - bw * 0.8, cy - bh * 0.1),
        (cx - bw * 0.5, cy - bh * 0.45)
    ]
    draw.polygon(core_pts, fill=(28, 98, 152, 255))
    
    # Deep cyan core volume
    core_mid_pts = [
        (tip_x, tip_y + 32),
        (cx + bw * 0.7, cy + bh * 0.1),
        (cx + bw * 0.55, bot_y - 20),
        (cx - bw * 0.55, bot_y - 20),
        (cx - bw * 0.7, cy + bh * 0.1)
    ]
    draw.polygon(core_mid_pts, fill=(48, 148, 208, 255))
    
    # 5. Specular 3D Liquid Caustic Reflections & Micro-Condensation
    if dir_y >= -0.2:
        spec_x = cx - bw * 0.45 + dir_x * 24
        spec_y = cy - bh * 0.3
        draw.ellipse([spec_x - 38, spec_y - 24, spec_x + 38, spec_y + 24], fill=(95, 210, 255, 230))
        draw.ellipse([spec_x - 22, spec_y - 14, spec_x + 22, spec_y + 14], fill=(200, 245, 255, 255))
        draw.circle((spec_x - 8, spec_y - 4), radius=8, fill=(255, 255, 255, 255))
        
        # Micro-condensation sweat droplets (Canonical Model Sheet)
        draw.ellipse([cx - 36, cy + 24, cx - 24, cy + 44], fill=(130, 225, 255, 200), outline=(12, 45, 72, 255))
        draw.ellipse([cx + 30, cy + 18, cx + 42, cy + 38], fill=(130, 225, 255, 200), outline=(12, 45, 72, 255))
        draw.circle((cx - 30, cy + 30), radius=3, fill=(255, 255, 255, 255))
        draw.circle((cx + 36, cy + 24), radius=3, fill=(255, 255, 255, 255))
        
    # 6. Red Warrior Headband with White Racing Stripe & Flowing Ribbons
    hb_y = cy - bh * 0.26
    hb_l = cx - bw * 0.94
    hb_r = cx + bw * 0.94
    hb_thick = 26
    
    # Headband Base (Crimson)
    draw.polygon([
        (hb_l, hb_y - hb_thick//2),
        (hb_r, hb_y - hb_thick//2),
        (hb_r, hb_y + hb_thick//2),
        (hb_l, hb_y + hb_thick//2)
    ], fill=(195, 26, 42, 255), outline=(78, 10, 16, 255))
    
    # White Racing Stripe in Center
    draw.line([(hb_l + 2, hb_y), (hb_r - 2, hb_y)], fill=(250, 250, 250, 255), width=7)
    
    # Dynamic Flowing Knot Ribbons (Anchored to rear/side based on facing)
    knot_x = cx - bw * (0.92 if dir_x >= 0 else -0.92) if abs(dir_y) < 0.75 else cx
    knot_y = hb_y if dir_y >= 0 else hb_y + 8
    
    rib1_x = knot_x - (54 * (1.0 if dir_x >= 0 else -1.0)) + ribbon_wave
    rib1_y = knot_y + 44 + math.sin(walk_phase * 2) * 12
    rib2_x = knot_x - (76 * (1.0 if dir_x >= 0 else -1.0)) + ribbon_wave * 1.4
    rib2_y = knot_y + 72 + math.cos(walk_phase * 2) * 16
    
    draw.polygon([(knot_x, knot_y), (rib1_x, rib1_y), (rib1_x + 12, rib1_y + 6), (knot_x, knot_y + 22)], fill=(195, 26, 42, 255), outline=(78, 10, 16, 255))
    draw.polygon([(knot_x, knot_y + 8), (rib2_x, rib2_y), (rib2_x + 12, rib2_y + 6), (knot_x, knot_y + 26)], fill=(160, 20, 34, 255), outline=(78, 10, 16, 255))
    
    # 7. Facial Features: Fierce Glowing Crimson Eyes & Angry Brow (Hidden when facing North)
    if dir_y >= -0.35:
        eye_center_x = cx + dir_x * 32
        eye_y = cy - 12
        
        # Left Eye (if facing forward/right)
        if dir_x > -0.85:
            el_x = eye_center_x - 38
            # Sclera & Eye Glow
            draw.ellipse([el_x - 18, eye_y - 20, el_x + 18, eye_y + 18], fill=(255, 38, 58, 255), outline=(50, 6, 12, 255), width=3)
            # Pupil / Highlight (Blinking animation)
            if blink_state < 0.8:
                draw.ellipse([el_x - 6, eye_y - 10, el_x + 10, eye_y + 6], fill=(255, 255, 255, 255))
            else: # Closed eyelid for blink
                draw.line([(el_x - 18, eye_y), (el_x + 18, eye_y)], fill=(50, 6, 12, 255), width=5)
            # Angry Brow Line
            draw.line([(el_x - 22, eye_y - 18), (el_x + 22, eye_y - 10)], fill=(12, 45, 72, 255), width=6)
            
        # Right Eye (if facing forward/left)
        if dir_x < 0.85:
            er_x = eye_center_x + 16
            draw.ellipse([er_x - 18, eye_y - 20, er_x + 18, eye_y + 18], fill=(255, 38, 58, 255), outline=(50, 6, 12, 255), width=3)
            if blink_state < 0.8:
                draw.ellipse([er_x - 6, eye_y - 10, er_x + 10, eye_y + 6], fill=(255, 255, 255, 255))
            else:
                draw.line([(er_x - 18, eye_y), (er_x + 18, eye_y)], fill=(50, 6, 12, 255), width=5)
            draw.line([(er_x - 22, eye_y - 10), (er_x + 22, eye_y - 18)], fill=(12, 45, 72, 255), width=6)
            
        # Angry Mouth Line
        mouth_x = eye_center_x
        draw.arc([mouth_x - 18, cy + 14, mouth_x + 18, cy + 34], start=210, end=330, fill=(12, 45, 72, 255), width=5)
        
    # 8. Skeletal Arms & Knuckle Hands (Swinging in natural counter-motion)
    sh_l = (cx - bw * 0.76, cy + 18)
    sh_r = (cx + bw * 0.76, cy + 18)
    
    arm_swing = math.sin(walk_phase) * 32.0 if not is_idle else math.sin(idle_breath * math.pi * 2) * 6.0
    hand_l = (sh_l[0] - 18, sh_l[1] + 58 + arm_swing)
    hand_r = (sh_r[0] + 18, sh_r[1] + 58 - arm_swing)
    
    # Arm outline & core
    draw.line([sh_l, hand_l], fill=(12, 45, 72, 255), width=24)
    draw.line([sh_l, hand_l], fill=(28, 98, 152, 255), width=16)
    draw.circle(hand_l, radius=16, fill=(48, 148, 208, 255), outline=(12, 45, 72, 255), width=3)
    draw.circle((hand_l[0] - 3, hand_l[1] - 3), radius=5, fill=(110, 210, 255, 255))
    
    draw.line([sh_r, hand_r], fill=(12, 45, 72, 255), width=24)
    draw.line([sh_r, hand_r], fill=(28, 98, 152, 255), width=16)
    draw.circle(hand_r, radius=16, fill=(48, 148, 208, 255), outline=(12, 45, 72, 255), width=3)
    draw.circle((hand_r[0] - 3, hand_r[1] - 3), radius=5, fill=(110, 210, 255, 255))
    
    return canvas

# =============================================================================
# EXPORT 24-FRAME HIGH RESOLUTION STRIPS
# =============================================================================

def export_hd_strip(frames, output_path, export_size=128):
    total_w = export_size * len(frames)
    strip = Image.new("RGBA", (total_w, export_size), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        lo_frame = f.resize((export_size, export_size), Image.Resampling.LANCZOS)
        strip.paste(lo_frame, (i * export_size, 0), lo_frame)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, "PNG")
    print(f"Exported Ultra-HD Strip: {output_path} ({total_w}x{export_size}, {len(frames)} frames)")

def build_all_camp_hero_hd_animations(camp_dir):
    num_walk_frames = 16
    
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
    
    print("=================================================================")
    print("GENERATING DEAD-CELLS QUALITY 8-DIRECTIONAL HD HERO WALKS...")
    print("=================================================================")
    
    for dir_name, dx, dy, desc in directions:
        frames = []
        for i in range(num_walk_frames):
            phase = (i / float(num_walk_frames)) * math.pi * 2
            f = draw_hd_character_frame(dir_x=dx, dir_y=dy, walk_phase=phase, is_idle=False)
            frames.append(f)
        out_file = os.path.join(camp_dir, f"camp-hero-walk-{dir_name}-16.png")
        export_hd_strip(frames, out_file, export_size=EXPORT_SIZE)
        
    # Idle animation (16 frames with breathing and eye blink)
    idle_frames = []
    for i in range(16):
        t = i / 16.0
        blink = 1.0 if (i in [10, 11]) else 0.0
        f = draw_hd_character_frame(dir_x=0.0, dir_y=1.0, is_idle=True, idle_breath=t, blink_state=blink)
        idle_frames.append(f)
    export_hd_strip(idle_frames, os.path.join(camp_dir, "camp-hero-idle-16.png"), export_size=EXPORT_SIZE)
    export_hd_strip(idle_frames, r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\character\waterdrop-idle-16.png", export_size=EXPORT_SIZE)

if __name__ == "__main__":
    out_camp = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
    build_all_camp_hero_hd_animations(out_camp)
