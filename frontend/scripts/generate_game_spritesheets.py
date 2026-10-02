import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw

def save_strip(frames, output_path, frame_w=128, frame_h=128):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
    strip.save(output_path, "PNG")
    print(f"Created: {output_path} ({total_w}x{frame_h}, {len(frames)} frames)")

def draw_waterdrop_body(draw, cx, cy, scale=1.0, tilt=0.0, eye_state='normal', eyes_glow=False):
    """Draws the canonical Waterdrop hero body matching the game visual identity."""
    # Shadow
    draw.ellipse([cx - 24*scale, cy + 38*scale, cx + 24*scale, cy + 46*scale], fill=(0, 0, 0, 80))
    
    # Body points (teardrop)
    r = 30 * scale
    top_y = cy - 36 * scale
    bot_y = cy + 30 * scale
    
    # Blue body gradient fill
    body_poly = [
        (cx + math.sin(tilt)*10, top_y),
        (cx + r, cy),
        (cx + r*0.9, bot_y),
        (cx - r*0.9, bot_y),
        (cx - r, cy)
    ]
    draw.polygon(body_poly, fill=(43, 127, 168, 255), outline=(6, 18, 30, 255))
    # Inner hydro highlight
    draw.ellipse([cx - r*0.7, cy - r*0.5, cx + r*0.3, cy + r*0.4], fill=(79, 180, 230, 255))
    draw.ellipse([cx - r*0.5, cy - r*0.4, cx - r*0.1, cy], fill=(160, 230, 255, 220))
    
    # Red Headband with white racing stripe
    hb_y = cy - 14 * scale
    hb_poly = [
        (cx - r*0.95, hb_y - 4),
        (cx + r*0.95, hb_y - 4),
        (cx + r*0.95, hb_y + 8),
        (cx - r*0.95, hb_y + 8)
    ]
    draw.polygon(hb_poly, fill=(181, 29, 40, 255), outline=(80, 10, 15, 255))
    # White stripe
    draw.line([(cx - r*0.95, hb_y + 2), (cx + r*0.95, hb_y + 2)], fill=(245, 245, 245, 255), width=2)
    # Headband knot tails
    draw.polygon([(cx - r*0.9, hb_y), (cx - r*1.4, hb_y + 12), (cx - r*1.2, hb_y + 20), (cx - r*0.8, hb_y + 6)], fill=(181, 29, 40, 255))
    
    # Eyes
    eye_col = (255, 49, 70, 255) if not eyes_glow else (255, 255, 200, 255)
    pupil_col = (255, 255, 255, 255) if not eyes_glow else (255, 50, 50, 255)
    
    if eye_state == 'normal':
        # Left eye
        draw.ellipse([cx - 14*scale, cy - 8*scale, cx - 4*scale, cy + 6*scale], fill=eye_col, outline=(40, 0, 0, 255))
        draw.ellipse([cx - 10*scale, cy - 4*scale, cx - 6*scale, cy + 2*scale], fill=pupil_col)
        # Right eye
        draw.ellipse([cx + 4*scale, cy - 8*scale, cx + 14*scale, cy + 6*scale], fill=eye_col, outline=(40, 0, 0, 255))
        draw.ellipse([cx + 8*scale, cy - 4*scale, cx + 12*scale, cy + 2*scale], fill=pupil_col)
    elif eye_state == 'squint':
        draw.line([(cx - 14*scale, cy - 2*scale), (cx - 4*scale, cy + 2*scale)], fill=eye_col, width=3)
        draw.line([(cx + 4*scale, cy + 2*scale), (cx + 14*scale, cy - 2*scale)], fill=eye_col, width=3)

    if eyes_glow:
        draw.line([(cx - 9*scale, cy - 2*scale), (cx - 20*scale, cy - 10*scale)], fill=(255, 60, 60, 180), width=2)
        draw.line([(cx + 9*scale, cy - 2*scale), (cx + 20*scale, cy - 10*scale)], fill=(255, 60, 60, 180), width=2)

def generate_meteor_strike(output_path, count=16):
    """16 frames of cosmic meteor descent, ground impact, and crater shockwave."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 10
        
        if i < 6:
            # Phase 1: Meteor falling from sky
            prog = i / 5.0
            mx = 110 - prog * 46
            my = -10 + prog * 70
            
            # Fiery tail
            for p in range(6):
                tail_x = mx + (p + 1) * 10
                tail_y = my - (p + 1) * 12
                r = 12 - p * 1.8
                alpha = int(240 * (1 - p / 6.0))
                draw.ellipse([tail_x - r, tail_y - r, tail_x + r, tail_y + r], fill=(255, 100 + p*20, 20, alpha))
                
            # Core meteor rock
            draw.ellipse([mx - 10, my - 10, mx + 10, my + 10], fill=(60, 30, 20, 255), outline=(255, 180, 50, 255))
            draw.ellipse([mx - 6, my - 6, mx + 6, my + 6], fill=(255, 220, 80, 255))
            # Target ground reticle
            draw.ellipse([cx - 20, cy - 8, cx + 20, cy + 8], outline=(255, 80, 40, int(prog * 255)), width=2)
            
        elif i < 11:
            # Phase 2: Violent ground impact & shockwave burst
            prog = (i - 6) / 4.0
            radius = 16 + prog * 44
            alpha = int(255 * (1 - prog * 0.7))
            
            # Ground crater shockwave ring
            draw.ellipse([cx - radius, cy - radius*0.5, cx + radius, cy + radius*0.5], outline=(255, 80, 30, alpha), width=4)
            draw.ellipse([cx - radius*0.7, cy - radius*0.35, cx + radius*0.7, cy + radius*0.35], outline=(255, 220, 90, alpha), width=2)
            
            # Magma fire eruption
            h = 30 + (1 - prog) * 40
            draw.polygon([(cx - radius*0.4, cy), (cx, cy - h), (cx + radius*0.4, cy)], fill=(255, 140, 20, alpha))
            draw.polygon([(cx - radius*0.2, cy), (cx, cy - h*0.8), (cx + radius*0.2, cy)], fill=(255, 255, 180, alpha))
            
            # Flying volcanic sparks
            for s in range(8):
                sang = (s / 8.0) * math.pi * 2
                sdist = radius * 0.9
                spx = cx + math.cos(sang) * sdist
                spy = cy + math.sin(sang) * sdist * 0.5 - prog * 15
                draw.circle((spx, spy), radius=2.5, fill=(255, 220, 50, alpha))
                
        else:
            # Phase 3: Residual embers & crater dissipation
            prog = (i - 11) / 4.0
            radius = 52 + prog * 8
            alpha = int(120 * (1 - prog))
            draw.ellipse([cx - radius, cy - radius*0.45, cx + radius, cy + radius*0.45], outline=(180, 40, 20, alpha), width=2)
            # Fading smoke
            draw.ellipse([cx - 16, cy - 20 - prog*15, cx + 16, cy - prog*15], fill=(80, 70, 70, alpha // 2))
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_waterdrop_reload(output_path, count=16):
    """16 frames of the hero dropping empty mag, grabbing fresh power cell, inserting & racking slide."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 12
        
        # Stance & tilt
        tilt = math.sin(t * math.pi) * 0.08
        draw_waterdrop_body(draw, cx, cy, scale=1.0, tilt=tilt, eye_state='squint' if 4 <= i <= 12 else 'normal')
        
        # Gun in right hand
        gx, gy = cx + 24, cy - 2
        # Gun base
        draw.rectangle([gx - 4, gy - 4, gx + 16, gy + 4], fill=(42, 49, 61, 255), outline=(15, 20, 28, 255))
        draw.rectangle([gx, gy - 6, gx + 14, gy - 2], fill=(58, 70, 88, 255)) # slide
        
        if i < 4:
            # Phase 1: Magazine ejecting
            mag_y = gy + 6 + (i / 3.0) * 18
            draw.rectangle([gx + 2, mag_y, gx + 6, mag_y + 8], fill=(30, 35, 45, 255))
        elif i < 9:
            # Phase 2: Grabbing fresh power cell from belt
            prog = (i - 4) / 4.0
            hx = cx - 10 + prog * 28
            hy = cy + 18 - prog * 14
            # Fresh glowing hydro battery
            draw.rectangle([hx - 2, hy - 4, hx + 4, hy + 6], fill=(77, 196, 255, 255), outline=(255, 255, 255, 255))
            # Left arm moving
            draw.line([(cx - 15, cy), (hx, hy)], fill=(43, 127, 168, 255), width=3)
        elif i < 13:
            # Phase 3: Mag inserted & rack slide!
            prog = (i - 9) / 3.0
            slide_back = math.sin(prog * math.pi) * 5
            draw.rectangle([gx - slide_back, gy - 6, gx + 14 - slide_back, gy - 2], fill=(108, 180, 255, 255))
            # Hand on slide
            draw.circle((gx + 4 - slide_back, gy - 4), radius=4, fill=(43, 127, 168, 255))
            # Click spark
            if i == 11:
                draw.line([(gx + 16, gy - 6), (gx + 22, gy - 10)], fill=(255, 255, 255, 255), width=2)
        else:
            # Phase 4: Ready aim
            draw.circle((gx + 2, gy + 4), radius=3, fill=(43, 127, 168, 255)) # support hand
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_waterdrop_dual_guns(output_path, count=16):
    """16 frames of the H2O dual guns capstone node in rapid alternating fire."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 12
        
        # Dual guns stance: resolute, eyes glowing
        draw_waterdrop_body(draw, cx, cy, scale=1.0, tilt=0.0, eye_state='normal', eyes_glow=True)
        
        # Left gun
        lx, ly = cx - 28, cy - 2
        draw.rectangle([lx - 12, ly - 4, lx + 4, ly + 4], fill=(42, 49, 61, 255), outline=(15, 20, 28, 255))
        # Right gun
        rx, ry = cx + 24, cy - 2
        draw.rectangle([rx - 4, ry - 4, rx + 12, ry + 4], fill=(42, 49, 61, 255), outline=(15, 20, 28, 255))
        
        # Firing cycle
        if i % 4 == 0 or i % 4 == 1:
            # Right gun fires
            draw.polygon([(rx + 12, ry), (rx + 28, ry - 6), (rx + 24, ry), (rx + 28, ry + 6)], fill=(255, 200, 50, 255))
            draw.circle((rx + 14, ry), radius=4, fill=(255, 255, 255, 255))
            draw.line([(rx + 24, ry), (FW, ry)], fill=(77, 196, 255, 200), width=2)
        if i % 4 == 2 or i % 4 == 3:
            # Left gun fires
            draw.polygon([(lx - 12, ly), (lx - 28, ly - 6), (lx - 24, ly), (lx - 28, ly + 6)], fill=(255, 200, 50, 255))
            draw.circle((lx - 14, ly), radius=4, fill=(255, 255, 255, 255))
            draw.line([(lx - 24, ly), (0, ly)], fill=(77, 196, 255, 200), width=2)
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_waterdrop_meteor_cast(output_path, count=16):
    """16 frames of the hero raising arms skyward and calling down cosmic meteors."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 12
        
        arm_lift = math.sin(t * math.pi)
        draw_waterdrop_body(draw, cx, cy, scale=1.0, tilt=0.0, eye_state='normal', eyes_glow=(t > 0.3 and t < 0.9))
        
        # Arms raised to heavens
        hand_l = (cx - 24, cy - 10 - arm_lift * 26)
        hand_r = (cx + 24, cy - 10 - arm_lift * 26)
        draw.line([(cx - 18, cy), hand_l], fill=(43, 127, 168, 255), width=4)
        draw.line([(cx + 18, cy), hand_r], fill=(43, 127, 168, 255), width=4)
        draw.circle(hand_l, radius=4, fill=(43, 127, 168, 255))
        draw.circle(hand_r, radius=4, fill=(43, 127, 168, 255))
        
        # Celestial energy sparks gathering
        if t > 0.2 and t < 0.8:
            for s in range(6):
                ang = (s / 6.0) * math.pi * 2 + t * math.pi * 4
                dist = 14 + math.sin(t * math.pi * 6 + s) * 6
                sx = cx + math.cos(ang) * dist
                sy = cy - 36 + math.sin(ang) * dist
                draw.circle((sx, sy), radius=2.5, fill=(255, 120, 50, 240))
            draw.line([(hand_l[0], hand_l[1]), (cx, cy - 36)], fill=(255, 200, 80, 200), width=2)
            draw.line([(hand_r[0], hand_r[1]), (cx, cy - 36)], fill=(255, 200, 80, 200), width=2)
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_whirlwind_blade(output_path, count=16):
    """16 frames of autonomous orbiting whirlwind blade."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        rot_rad = t * math.pi * 2
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2
        
        # Whirlwind air currents
        for a in range(3):
            arc_ang = rot_rad + (a / 3.0) * math.pi * 2
            pts = []
            for r_step in range(12, 38, 4):
                cur_a = arc_ang + r_step * 0.08
                pts.append((cx + math.cos(cur_a) * r_step, cy + math.sin(cur_a) * r_step))
            draw.line(pts, fill=(200, 230, 255, 180), width=3)
            
        # Aerodynamic silver tri-blade
        for b in range(3):
            blade_ang = rot_rad + (b / 3.0) * math.pi * 2
            bx = cx + math.cos(blade_ang) * 28
            by = cy + math.sin(blade_ang) * 28
            p1 = (cx + math.cos(blade_ang + 0.3) * 8, cy + math.sin(blade_ang + 0.3) * 8)
            p2 = (cx + math.cos(blade_ang - 0.3) * 8, cy + math.sin(blade_ang - 0.3) * 8)
            draw.polygon([(bx, by), p1, (cx, cy), p2], fill=(220, 240, 255, 255), outline=(100, 150, 200, 255))
            
        draw.circle((cx, cy), radius=5, fill=(70, 130, 180, 255))
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_frost_orbs(output_path, count=16):
    """16 frames of orbiting crystalline Frost Orbs with sub-zero ice aura."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        rot_rad = t * math.pi * 2
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2
        
        # 3 orbiting ice crystals
        for k in range(3):
            ang = rot_rad + (k / 3.0) * math.pi * 2
            ox = cx + math.cos(ang) * 24
            oy = cy + math.sin(ang) * 24
            
            # Ice crystal diamond
            pts = [(ox, oy - 10), (ox + 7, oy), (ox, oy + 10), (ox - 7, oy)]
            draw.polygon(pts, fill=(160, 232, 255, 240), outline=(255, 255, 255, 255))
            draw.line([(ox, oy - 8), (ox, oy + 8)], fill=(255, 255, 255, 255), width=1)
            # Cold mist trail
            draw.circle((ox - math.cos(ang)*6, oy - math.sin(ang)*6), radius=5, fill=(190, 240, 255, 100))
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def update_manifest(root_dir):
    manifest_file = os.path.join(root_dir, "manifest.json")
    with open(manifest_file, "r") as f:
        data = json.load(f)
        
    data["categories"]["character_actions"] = {
        "reload": { "file": "character_actions/waterdrop-reload-16.png", "frames": 16, "fps": 18, "desc": "Eject empty mag, grab battery, seat and rack slide" },
        "dual_guns": { "file": "character_actions/waterdrop-dual-guns-16.png", "frames": 16, "fps": 20, "desc": "H2O dual guns rapid alternating fire" },
        "meteor_cast": { "file": "character_actions/waterdrop-meteor-cast-16.png", "frames": 16, "fps": 16, "desc": "Summoning arms skyward calling cosmic meteor" }
    }
    
    data["categories"]["skills_and_spells"] = {
        "meteor_strike": { "file": "skills/meteor-strike-impact-16.png", "frames": 16, "fps": 20, "desc": "Cosmic meteor descent, ground impact & crater shockwave" }
    }
    
    data["categories"]["additional_orbitals"] = {
        "whirlwind": { "file": "auto_weapons/whirlwind-blade-orbit-16.png", "frames": 16, "fps": 24, "desc": "Orbiting tri-blade wind cutter" },
        "frost_orbs": { "file": "auto_weapons/frost-orbs-orbit-16.png", "frames": 16, "fps": 18, "desc": "Sub-zero orbiting ice crystals" }
    }
    
    with open(manifest_file, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Master manifest successfully updated at {manifest_file}")

if __name__ == "__main__":
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    # 1. Generate Skills & Impacts
    generate_meteor_strike(os.path.join(out_dir, "skills", "meteor-strike-impact-16.png"))
    
    # 2. Generate Character Actions & Mechanics
    generate_waterdrop_reload(os.path.join(out_dir, "character_actions", "waterdrop-reload-16.png"))
    generate_waterdrop_dual_guns(os.path.join(out_dir, "character_actions", "waterdrop-dual-guns-16.png"))
    generate_waterdrop_meteor_cast(os.path.join(out_dir, "character_actions", "waterdrop-meteor-cast-16.png"))
    
    # 3. Generate Additional Orbitals & Auto Weapons
    generate_whirlwind_blade(os.path.join(out_dir, "auto_weapons", "whirlwind-blade-orbit-16.png"))
    generate_frost_orbs(os.path.join(out_dir, "auto_weapons", "frost-orbs-orbit-16.png"))
    
    # 4. Update manifest
    update_manifest(out_dir)
    print("ALL SPRITESHEETS GENERATED AND READY FOR IMPORT!")
