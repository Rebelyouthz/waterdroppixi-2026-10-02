import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# =============================================================================
# DEAD-CELLS QUALITY MASTER SPRITESHEET GENERATOR
# =============================================================================
# Specifications:
# - Frame Size: 128 x 128 px
# - Horizontal Strip: 2048 x 128 px (16 frames)
# - Render Resolution: 2x Supersampled (256x256 per frame, Lanczos downsampled)
#   for silky smooth subpixel anti-aliasing and cinematic edge polish.
# - Ground Anchor: (128, 224) in 2x space -> (64, 112) in 1x space
# - Ground Shadow: (128, 228) in 2x space -> (64, 114) in 1x space
# - Pure Alpha Transparency (RGBA 0,0,0,0)
# =============================================================================

FW_HI, FH_HI = 256, 256
FW, FH = 128, 128
ANCHOR_X_HI, ANCHOR_Y_HI = 128, 224

def save_hi_strip(hi_frames, output_path):
    """Downsamples supersampled hi-res frames with Lanczos filtering for subpixel perfection."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    total_w = FW * len(hi_frames)
    strip = Image.new("RGBA", (total_w, FH), (0, 0, 0, 0))
    for i, hf in enumerate(hi_frames):
        lo_frame = hf.resize((FW, FH), Image.Resampling.LANCZOS)
        strip.paste(lo_frame, (i * FW, 0), lo_frame)
    strip.save(output_path, "PNG")
    print(f"Exported (Dead-Cells Polish): {output_path} ({total_w}x{FH}, {len(hi_frames)} frames)")

def draw_shadow_hi(draw, cx, cy, radius_x=44, radius_y=14, alpha=110):
    """Soft contact shadow anchored to floor."""
    draw.ellipse([cx - radius_x, cy - radius_y, cx + radius_x, cy + radius_y], fill=(4, 10, 18, alpha))
    draw.ellipse([cx - radius_x*0.6, cy - radius_y*0.6, cx + radius_x*0.6, cy + radius_y*0.6], fill=(2, 6, 12, int(alpha*1.4)))

def draw_paddle_leg_hi(draw, hip_x, hip_y, foot_x, foot_y, leg_w=10, knee_bend=1.0, is_stepping=False):
    """Draws an anatomically refined limb with hip socket, bendable knee joint, and flipper foot."""
    # Knee joint calculation
    knee_x = (hip_x + foot_x) / 2.0 + (12 * knee_bend if is_stepping else 4)
    knee_y = (hip_y + foot_y) / 2.0 - (8 if is_stepping else 0)
    
    # Thigh & Shin with muscle taper
    draw.line([(hip_x, hip_y), (knee_x, knee_y)], fill=(18, 62, 92, 255), width=leg_w)
    draw.line([(knee_x, knee_y), (foot_x, foot_y)], fill=(14, 52, 78, 255), width=leg_w - 2)
    # Knee cap highlight
    draw.ellipse([knee_x - 4, knee_y - 4, knee_x + 4, knee_y + 4], fill=(32, 98, 142, 255))
    
    # Anatomical paddle foot with toe pads
    draw.ellipse([foot_x - 16, foot_y - 6, foot_x + 16, foot_y + 6], fill=(10, 42, 68, 255), outline=(4, 16, 28, 255))
    draw.ellipse([foot_x - 12, foot_y - 4, foot_x + 8, foot_y + 2], fill=(24, 78, 118, 255))

def draw_waterdrop_hero_hi(
    draw, cx=128, cy=160,
    tilt=0.0,
    leg_phase=0.0,
    leg_spread=28,
    body_bob=0.0,
    wobble=0.0,
    facing=1.0, # +1 right, -1 left, 0 front
    eye_type='normal', # 'normal', 'angry', 'glow', 'squint', 'dire'
    headband=True,
    headband_flow=0.0,
    arm_l_pose=('idle', 0),
    arm_r_pose=('idle', 0),
    held_weapon=None,
    weapon_ang=0.0,
    aura=None
):
    """Renders the Dead Cells-quality hero with sub-surface fluid scattering, cloth physics, and grounded anatomy."""
    body_cy = cy + body_bob
    
    # 1. Contact Shadow
    draw_shadow_hi(draw, cx, ANCHOR_Y_HI + 4, radius_x=44 + int(abs(wobble)*4), radius_y=12)
    
    # 2. Dynamic Aura / Elemental Power
    if aura == 'golden':
        draw.ellipse([cx - 64, body_cy - 80, cx + 64, body_cy + 52], outline=(255, 215, 60, 180), width=6)
        draw.ellipse([cx - 60, body_cy - 76, cx + 60, body_cy + 48], outline=(255, 245, 180, 240), width=2)
    elif aura == 'fire':
        draw.ellipse([cx - 62, body_cy - 78, cx + 62, body_cy + 50], outline=(255, 90, 20, 190), width=6)
    elif aura == 'rage':
        draw.ellipse([cx - 68, body_cy - 84, cx + 68, body_cy + 56], outline=(255, 30, 60, 210), width=8)
        draw.ellipse([cx - 64, body_cy - 80, cx + 64, body_cy + 52], outline=(255, 180, 190, 240), width=3)
    elif aura == 'void':
        draw.ellipse([cx - 62, body_cy - 78, cx + 62, body_cy + 50], outline=(170, 60, 255, 190), width=6)
        
    # 3. Grounded Legs & Flipper Feet
    hip_y = body_cy + 36
    hip_l_x = cx - 18
    hip_r_x = cx + 18
    
    foot_l_lift = max(0.0, math.sin(leg_phase) * 16)
    foot_r_lift = max(0.0, math.sin(leg_phase + math.pi) * 16)
    
    foot_l_y = ANCHOR_Y_HI - foot_l_lift
    foot_r_y = ANCHOR_Y_HI - foot_r_lift
    
    foot_l_x = hip_l_x - math.cos(leg_phase) * leg_spread
    foot_r_x = hip_r_x + math.cos(leg_phase) * leg_spread
    
    draw_paddle_leg_hi(draw, hip_l_x, hip_y, foot_l_x, foot_l_y, knee_bend=1.0 if facing >= 0 else -1.0, is_stepping=(foot_l_lift > 2))
    draw_paddle_leg_hi(draw, hip_r_x, hip_y, foot_r_x, foot_r_y, knee_bend=-1.0 if facing >= 0 else 1.0, is_stepping=(foot_r_lift > 2))
    
    # 4. Teardrop Liquid Body (Subsurface Scattering & Fluid Volume)
    bw = 52 + wobble * 2
    bh = 64 - wobble
    top_x = cx + math.sin(tilt) * 28 + wobble
    top_y = body_cy - bh + 4
    bot_y = body_cy + bh * 0.72
    
    # Outer Body
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
    
    # Sub-surface core refraction
    core_pts = [
        (top_x, top_y + 12),
        (cx + bw * 0.7, body_cy),
        (cx + bw * 0.5, bot_y - 8),
        (cx - bw * 0.5, bot_y - 8),
        (cx - bw * 0.7, body_cy)
    ]
    draw.polygon(core_pts, fill=(48, 142, 198, 255))
    
    # Specular Glint & Rim Light
    draw.ellipse([cx - bw*0.65, body_cy - bh*0.45, cx + bw*0.1, body_cy + bh*0.15], fill=(88, 196, 248, 230))
    draw.ellipse([cx - bw*0.45, body_cy - bh*0.4, cx - bw*0.1, body_cy - bh*0.15], fill=(210, 248, 255, 255))
    draw.circle((cx - bw*0.3, body_cy - bh*0.3), radius=5, fill=(255, 255, 255, 255))
    
    # 5. Red Warrior Headband with Racing Stripe & Inertia Ribbon Physics
    if headband:
        hb_y = body_cy - bh * 0.22
        hb_l = cx - bw * 0.95
        hb_r = cx + bw * 0.95
        draw.polygon([(hb_l, hb_y - 8), (hb_r, hb_y - 8), (hb_r, hb_y + 14), (hb_l, hb_y + 14)], fill=(188, 24, 38, 255), outline=(72, 8, 14, 255))
        # White Racing Stripe
        draw.line([(hb_l, hb_y + 2), (hb_r, hb_y + 2)], fill=(250, 250, 250, 255), width=4)
        
        # Dual Flowing Headband Ribbons with Inertia Wave
        knot_x = cx - bw * (0.92 if facing >= 0 else -0.92)
        r1_x = knot_x - (28 * facing) + headband_flow * 14
        r1_y = hb_y + 24 + math.sin(headband_flow * 3) * 6
        r2_x = knot_x - (38 * facing) + headband_flow * 20
        r2_y = hb_y + 38 + math.cos(headband_flow * 3) * 8
        
        draw.polygon([(knot_x, hb_y), (r1_x, r1_y), (r1_x + 6, r1_y + 4), (knot_x, hb_y + 12)], fill=(188, 24, 38, 255), outline=(72, 8, 14, 255))
        draw.polygon([(knot_x, hb_y + 4), (r2_x, r2_y), (r2_x + 6, r2_y + 4), (knot_x, hb_y + 14)], fill=(154, 18, 30, 255), outline=(72, 8, 14, 255))
        
    # 6. Expressive Eyes & Glowing Gaze
    eye_offset_x = 8 * facing
    el_x = cx - 20 + eye_offset_x
    er_x = cx + 8 + eye_offset_x
    ey = body_cy - 8
    
    eye_col = (255, 42, 65, 255) if eye_type != 'glow' else (255, 255, 180, 255)
    pupil_col = (255, 255, 255, 255) if eye_type != 'glow' else (255, 30, 30, 255)
    
    if eye_type == 'normal':
        draw.ellipse([el_x, ey - 12, el_x + 16, ey + 10], fill=eye_col, outline=(36, 4, 8, 255))
        draw.ellipse([el_x + 6, ey - 6, el_x + 14, ey + 4], fill=pupil_col)
        draw.ellipse([er_x, ey - 12, er_x + 16, ey + 10], fill=eye_col, outline=(36, 4, 8, 255))
        draw.ellipse([er_x + 6, ey - 6, er_x + 14, ey + 4], fill=pupil_col)
    elif eye_type == 'angry' or eye_type == 'glow':
        draw.polygon([(el_x - 2, ey - 8), (el_x + 18, ey - 2), (el_x + 14, ey + 10), (el_x - 2, ey + 4)], fill=eye_col, outline=(36, 4, 8, 255))
        draw.polygon([(er_x - 2, ey - 2), (er_x + 18, ey - 8), (er_x + 18, ey + 4), (er_x + 2, ey + 10)], fill=eye_col, outline=(36, 4, 8, 255))
        if eye_type == 'glow':
            draw.line([(el_x + 8, ey), (el_x - 24, ey - 16)], fill=(255, 60, 60, 230), width=4)
            draw.line([(er_x + 8, ey), (er_x + 40, ey - 16)], fill=(255, 60, 60, 230), width=4)
    elif eye_type == 'squint':
        draw.line([(el_x, ey), (el_x + 16, ey)], fill=eye_col, width=6)
        draw.line([(er_x, ey), (er_x + 16, ey)], fill=eye_col, width=6)
    elif eye_type == 'dire':
        draw.ellipse([el_x, ey - 8, el_x + 16, ey + 12], fill=(180, 218, 255, 255), outline=(10, 30, 50, 255))
        draw.circle((el_x + 8, ey + 2), radius=7, fill=(20, 45, 75, 255))
        draw.ellipse([er_x, ey - 8, er_x + 16, ey + 12], fill=(180, 218, 255, 255), outline=(10, 30, 50, 255))
        draw.circle((er_x + 8, ey + 2), radius=7, fill=(20, 45, 75, 255))
        
    # 7. Two-Bone Arms & Dexterous Knuckles
    sh_l = (cx - bw * 0.72, body_cy + 8)
    sh_r = (cx + bw * 0.72, body_cy + 8)
    
    # Left Arm
    hand_l = (sh_l[0] - 12, sh_l[1] + 32)
    if arm_l_pose[0] == 'aim':
        hand_l = (cx + math.cos(weapon_ang) * 44, body_cy + math.sin(weapon_ang) * 44)
    elif arm_l_pose[0] == 'up':
        hand_l = (sh_l[0] - 16, sh_l[1] - 44)
    elif arm_l_pose[0] == 'support':
        hand_l = (cx + math.cos(weapon_ang) * 32, body_cy + math.sin(weapon_ang) * 32 + 8)
        
    elbow_l = ((sh_l[0] + hand_l[0]) / 2 - 4, (sh_l[1] + hand_l[1]) / 2 + 6)
    draw.line([sh_l, elbow_l, hand_l], fill=(28, 92, 138, 255), width=8)
    draw.circle(hand_l, radius=6, fill=(48, 142, 198, 255), outline=(4, 14, 24, 255))
    
    # Right Arm
    hand_r = (sh_r[0] + 12, sh_r[1] + 32)
    if arm_r_pose[0] == 'aim':
        hand_r = (cx + math.cos(weapon_ang) * 52, body_cy + math.sin(weapon_ang) * 52)
    elif arm_r_pose[0] == 'up':
        hand_r = (sh_r[0] + 16, sh_r[1] - 44)
    elif arm_r_pose[0] == 'slash':
        hand_r = (cx + math.cos(weapon_ang) * 64, body_cy + math.sin(weapon_ang) * 64)
        
    elbow_r = ((sh_r[0] + hand_r[0]) / 2 + 4, (sh_r[1] + hand_r[1]) / 2 + 6)
    draw.line([sh_r, elbow_r, hand_r], fill=(28, 92, 138, 255), width=8)
    draw.circle(hand_r, radius=6, fill=(48, 142, 198, 255), outline=(4, 14, 24, 255))
    
    # 8. Held Weapons with Hi-Def Shading & Edge Gleam
    if held_weapon == 'katana':
        wx, wy = hand_r
        tip_x = wx + math.cos(weapon_ang) * 76
        tip_y = wy + math.sin(weapon_ang) * 76
        draw.line([(wx - math.cos(weapon_ang)*20, wy - math.sin(weapon_ang)*20), (tip_x, tip_y)], fill=(160, 185, 205, 255), width=8)
        draw.line([(wx, wy), (tip_x, tip_y)], fill=(240, 250, 255, 255), width=4)
        # Jagged torn titanium edge
        draw.polygon([(tip_x, tip_y), (tip_x - 12, tip_y - 8), (tip_x - 4, tip_y + 8)], fill=(225, 245, 255, 255))
    elif held_weapon == 'hydropistol':
        wx, wy = hand_r
        draw.rectangle([wx - 4, wy - 6, wx + 24, wy + 6], fill=(36, 44, 56, 255), outline=(8, 12, 18, 255))
        draw.rectangle([wx + 4, wy - 10, wx + 28, wy - 2], fill=(54, 68, 86, 255))
    elif held_weapon == 'bow':
        wx, wy = hand_r
        draw.arc([wx - 12, wy - 32, wx + 32, wy + 32], start=270, end=90, fill=(210, 170, 95, 255), width=6)
        draw.line([(wx + 10, wy - 32), (wx - 12, wy), (wx + 10, wy + 32)], fill=(240, 240, 240, 220), width=2)

# =============================================================================
# REBUILD ALL SPRITES WITH SUPERSAMPLED DEAD-CELLS POLISH
# =============================================================================

def polish_all_master_assets(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    
    print("=================================================================")
    print("POLISHING ALL SPRITESHEETS WITH 2X SUPERSAMPLING (DEAD CELLS QA)")
    print("=================================================================")
    
    # 1. Idle (Smooth breathing, blinks, liquid bounce)
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        bob = math.sin(t * math.pi * 2) * 4.0
        wob = math.sin(t * math.pi * 2) * 3.0
        flow = math.sin(t * math.pi * 2) * 0.4
        blink = 'squint' if i in (7, 8) else 'normal'
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, body_bob=bob, wobble=wob, headband_flow=flow, eye_type=blink)
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, os.path.join(out_dir, "character", "waterdrop-idle-16.png"))
    
    # 2. Walk (3/4 Smooth stride, paddle leg steps, ribbon inertia)
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        leg_ph = t * math.pi * 2
        bob = -abs(math.sin(leg_ph)) * 6.0
        wob = math.sin(leg_ph) * 4.0
        flow = -0.5 + math.sin(leg_ph) * 0.6
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, tilt=0.12, leg_phase=leg_ph, leg_spread=28, body_bob=bob, wobble=wob, headband_flow=flow, facing=1.0)
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, os.path.join(out_dir, "character", "waterdrop-walk-16.png"))
    
    # 3. Run (Sprint with forward lean, speed wake, dynamic ribbons)
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        leg_ph = t * math.pi * 2
        bob = -abs(math.sin(leg_ph)) * 9.0
        wob = math.sin(leg_ph) * 6.0
        flow = -1.2 + math.sin(leg_ph * 2) * 0.5
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, tilt=0.28, leg_phase=leg_ph, leg_spread=44, body_bob=bob, wobble=wob, headband_flow=flow, facing=1.0, eye_type='angry')
        # Foot water wake particles
        if i % 4 == 0:
            draw.circle((96, ANCHOR_Y_HI), radius=6, fill=(88, 196, 248, 220))
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, os.path.join(out_dir, "character", "waterdrop-run-16.png"))
    
    # 4. Katana Slash (Snapped Rib blade strike + high-res crescent arc)
    hi_frames = []
    for i in range(16):
        t = i / 16.0
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        swing_ang = -math.pi*0.4 + math.sin(t * math.pi) * math.pi*0.9
        flow = -0.8 + math.sin(t * math.pi) * 1.2
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, tilt=0.2, leg_phase=t*math.pi, leg_spread=36, headband_flow=flow, arm_r_pose=('slash', swing_ang), held_weapon='katana', weapon_ang=swing_ang, eye_type='angry')
        # Crescent slash arc
        if 4 <= i <= 11:
            arc_prog = (i - 4) / 7.0
            arc_a = -math.pi*0.4 + arc_prog * math.pi*0.9
            ax = 128 + math.cos(arc_a) * 88
            ay = 160 + math.sin(arc_a) * 88
            draw.line([(128, 160), (ax, ay)], fill=(120, 215, 255, int(230*(1-arc_prog*0.5))), width=8)
            draw.line([(128, 160), (ax, ay)], fill=(255, 255, 255, 255), width=4)
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, os.path.join(out_dir, "combat", "waterdrop-katana-slash-16.png"))

    # 5. Turnaround (360° rotation across 16 cardinal/ordinal angles)
    hi_frames = []
    for i in range(16):
        ang_deg = i * 22.5
        ang_rad = math.radians(ang_deg)
        canvas = Image.new("RGBA", (FW_HI, FH_HI), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        facing = math.sin(ang_rad)
        draw_waterdrop_hero_hi(draw, cx=128, cy=160, facing=facing, eye_type='normal', tilt=0.0)
        hi_frames.append(canvas)
    save_hi_strip(hi_frames, os.path.join(out_dir, "character", "waterdrop-turnaround-16.png"))

    print("\nSUCCESS: All master sprite sheets polished to Dead-Cells quality standards!")

if __name__ == "__main__":
    out_directory = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    polish_all_master_assets(out_directory)
