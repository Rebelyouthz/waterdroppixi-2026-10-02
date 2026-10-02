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
    print(f"Generated: {output_path} ({total_w}x{frame_h}, {len(frames)} frames)")

def draw_waterdrop_base(draw, cx, cy, w=30, h=36, tilt=0.0, eye_type='normal', glow_eyes=False, color=(43, 127, 168)):
    # Shadow
    draw.ellipse([cx - w*0.8, cy + h - 6, cx + w*0.8, cy + h + 2], fill=(0, 0, 0, 80))
    top_x = cx + math.sin(tilt) * 12
    top_y = cy - h + 4
    bot_y = cy + h - 6
    body_pts = [(top_x, top_y), (cx + w, cy), (cx + w*0.85, bot_y), (cx - w*0.85, bot_y), (cx - w, cy)]
    draw.polygon(body_pts, fill=color, outline=(6, 18, 30, 255))
    draw.ellipse([cx - w*0.6, cy - h*0.4, cx + w*0.2, cy + h*0.3], fill=(79, 180, 230, 240))
    # Headband
    hb_y = cy - h*0.25
    draw.polygon([(cx - w*0.95, hb_y - 4), (cx + w*0.95, hb_y - 4), (cx + w*0.95, hb_y + 7), (cx - w*0.95, hb_y + 7)], fill=(181, 29, 40, 255), outline=(80, 10, 15, 255))
    draw.line([(cx - w*0.95, hb_y + 1), (cx + w*0.95, hb_y + 1)], fill=(245, 245, 245, 255), width=2)
    draw.polygon([(cx - w*0.9, hb_y), (cx - w*1.3, hb_y + 12), (cx - w*1.1, hb_y + 18), (cx - w*0.8, hb_y + 6)], fill=(181, 29, 40, 255))
    # Eyes
    eye_col = (255, 49, 70, 255) if not glow_eyes else (255, 255, 180, 255)
    pupil_col = (255, 255, 255, 255) if not glow_eyes else (255, 40, 40, 255)
    if eye_type == 'normal':
        draw.ellipse([cx - 13, cy - 8, cx - 3, cy + 5], fill=eye_col, outline=(30, 0, 0, 255))
        draw.ellipse([cx - 9, cy - 5, cx - 5, cy + 1], fill=pupil_col)
        draw.ellipse([cx + 3, cy - 8, cx + 13, cy + 5], fill=eye_col, outline=(30, 0, 0, 255))
        draw.ellipse([cx + 7, cy - 5, cx + 11, cy + 1], fill=pupil_col)
    elif eye_type == 'angry':
        draw.polygon([(cx - 14, cy - 6), (cx - 2, cy - 2), (cx - 4, cy + 5), (cx - 14, cy + 2)], fill=eye_col, outline=(30, 0, 0, 255))
        draw.polygon([(cx + 2, cy - 2), (cx + 14, cy - 6), (cx + 14, cy + 2), (cx + 4, cy + 5)], fill=eye_col, outline=(30, 0, 0, 255))
    if glow_eyes:
        draw.line([(cx - 8, cy - 2), (cx - 24, cy - 14)], fill=(255, 50, 50, 220), width=2)
        draw.line([(cx + 8, cy - 2), (cx + 24, cy - 14)], fill=(255, 50, 50, 220), width=2)

# -------------------------------------------------------------
# 1. EVOLVED WEAPONS (16-angle equippable + 16-frame VFX)
# -------------------------------------------------------------

def generate_evo_soul_reaper(output_path, count=16):
    """Evolved Blood Scythe: Demonic double-bladed scythe with skull socket and soul-drain vortex."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        rot_rad = t * math.pi * 2
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2
        
        # Dual blood soul trails
        for arm in range(2):
            base_a = rot_rad + arm * math.pi
            pts = []
            for r_step in range(14, 46, 4):
                cur_a = base_a + r_step * 0.08
                pts.append((cx + math.cos(cur_a) * r_step, cy + math.sin(cur_a) * r_step))
            draw.line(pts, fill=(255, 40, 80, 220), width=4)
            draw.line(pts, fill=(255, 200, 220, 255), width=2)
            
        # Central obsidian staff
        hx0 = cx - math.cos(rot_rad) * 32
        hy0 = cy - math.sin(rot_rad) * 32
        hx1 = cx + math.cos(rot_rad) * 32
        hy1 = cy + math.sin(rot_rad) * 32
        draw.line([(hx0, hy0), (hx1, hy1)], fill=(15, 10, 20, 255), width=5)
        
        # Double crescent blades
        for end in [(hx0, hy0, rot_rad + math.pi), (hx1, hy1, rot_rad)]:
            ex, ey, a = end
            bx = ex + math.sin(a) * 32
            by = ey - math.cos(a) * 32
            tip_x = ex + math.cos(a) * 14
            tip_y = ey + math.sin(a) * 14
            draw.polygon([(ex, ey), (bx, by), (tip_x, tip_y)], fill=(230, 20, 50, 255), outline=(255, 100, 130, 255))
            draw.line([(bx, by), (tip_x, tip_y)], fill=(255, 255, 255, 255), width=2)
            
        # Skull center jewel
        draw.circle((cx, cy), radius=6, fill=(240, 230, 230, 255), outline=(20, 10, 10, 255))
        draw.circle((cx - 2, cy - 1), radius=1.5, fill=(255, 0, 0, 255))
        draw.circle((cx + 2, cy - 1), radius=1.5, fill=(255, 0, 0, 255))
        
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_evo_solar_flare_orbs(output_path, count=16):
    """Evolved Ember Orbs: Miniature nuclear suns with pulsating solar flares."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2
        
        # Giant solar flare prominences
        for p in range(12):
            p_ang = (p / 12.0) * math.pi * 2 + t * math.pi * 3
            flare_len = 28 + math.sin(t * math.pi * 6 + p) * 10
            fx = cx + math.cos(p_ang) * flare_len
            fy = cy + math.sin(p_ang) * flare_len
            draw.line([(cx, cy), (fx, fy)], fill=(255, 90, 10, int(180 + math.sin(t*math.pi*4 + p)*70)), width=4)
            
        draw.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(255, 100, 0, 230), outline=(255, 220, 50, 255))
        draw.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(255, 200, 40, 255))
        draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 255, 255, 255))
        
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

# -------------------------------------------------------------
# 2. ACTIVE SKILLS (16-frame VFX & Hero Cast)
# -------------------------------------------------------------

def generate_skill_overdrive(output_path, count=16):
    """Active Skill Overdrive: Hero bursting with steam, golden aura, and hyper-speed firing sparks."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 10
        
        # Golden Overdrive Aura
        aura_r = 38 + math.sin(t * math.pi * 4) * 6
        draw.ellipse([cx - aura_r, cy - aura_r*0.9, cx + aura_r, cy + aura_r*0.9], outline=(255, 215, 60, 200), width=3)
        
        # Lightning sparks around body
        for s in range(6):
            s_ang = (s / 6.0) * math.pi * 2 + t * math.pi * 4
            sx = cx + math.cos(s_ang) * (aura_r - 4)
            sy = cy + math.sin(s_ang) * (aura_r - 4)
            draw.line([(cx, cy), (sx, sy)], fill=(255, 255, 180, 220), width=2)
            
        draw_waterdrop_base(draw, cx, cy, w=30, h=36, tilt=0.0, eye_type='angry', glow_eyes=True, color=(60, 160, 220))
        
        # Steam vent particles rising from top
        for steam in range(4):
            st_x = cx + math.sin(t * math.pi * 4 + steam) * 12
            st_y = cy - 36 - steam * 8 - (i % 4) * 3
            draw.circle((st_x, st_y), radius=3 + steam, fill=(255, 255, 255, int(180 * (1 - steam/4.0))))
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_skill_bulwark_shield(output_path, count=16):
    """Active Skill Bulwark: Hexagonal crystalline water shield sphere protecting player."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        rot_ang = t * math.pi * 2
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2
        
        r = 44
        # Hexagonal shield facets
        hex_pts = []
        for v in range(6):
            va = rot_ang + (v / 6.0) * math.pi * 2
            hex_pts.append((cx + math.cos(va) * r, cy + math.sin(va) * r))
        draw.polygon(hex_pts, fill=(79, 216, 255, 80), outline=(160, 240, 255, 255))
        
        # Inner energy barrier
        draw.ellipse([cx - r*0.85, cy - r*0.85, cx + r*0.85, cy + r*0.85], outline=(220, 250, 255, 180), width=2)
        # Crystal nodes at vertices
        for pt in hex_pts:
            draw.circle(pt, radius=3.5, fill=(255, 255, 255, 255))
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_skill_bloodrush(output_path, count=16):
    """Active Skill Bloodrush: Berserk movement speed boost with red trailing ghost echoes."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 10
        
        # Red speed ghost echoes trailing behind
        for g in range(3):
            gx = cx - 18 - g * 16
            gy = cy
            g_alpha = int(140 * (1 - g / 3.0))
            draw_waterdrop_base(draw, gx, gy, w=28, h=32, tilt=0.35, eye_type='angry', glow_eyes=True, color=(181, 29, 40))
            
        draw_waterdrop_base(draw, cx + 12, cy, w=30, h=34, tilt=0.35, eye_type='angry', glow_eyes=True, color=(210, 40, 60))
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

# -------------------------------------------------------------
# 3. ADVANCED FINISHERS
# -------------------------------------------------------------

def generate_finisher_hydro_drill(output_path, count=16):
    """Hydro Finisher: Waterdrop transforms into a high-pressure piercing vortex drill and thrusts forward."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        rot_rad = t * math.pi * 4
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 10
        
        prog = math.sin(t * math.pi)
        thrust_x = cx + int((t - 0.5) * 36)
        
        # Conical vortex drill
        drill_len = 48 + int(prog * 24)
        tip_x = thrust_x + drill_len
        drill_poly = [(thrust_x - 16, cy - 18), (tip_x, cy), (thrust_x - 16, cy + 18)]
        draw.polygon(drill_poly, fill=(79, 216, 255, 230), outline=(220, 250, 255, 255))
        
        # Spiral drill flutes
        for f in range(4):
            fx = thrust_x - 12 + f * 14
            fy_top = cy - 16 + f * 4
            fy_bot = cy + 16 - f * 4
            spiral_y = cy + math.sin(rot_rad + f) * (14 - f*3)
            draw.line([(fx, spiral_y - 2), (fx + 8, spiral_y + 2)], fill=(255, 255, 255, 255), width=3)
            
        # Hero body base
        draw_waterdrop_base(draw, thrust_x - 20, cy, w=26, h=30, tilt=0.45, eye_type='angry', glow_eyes=True)
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def update_manifest_complete(root_dir):
    manifest_file = os.path.join(root_dir, "manifest.json")
    with open(manifest_file, "r") as f:
        data = json.load(f)
        
    data["categories"]["evolved_weapons"] = {
        "soul_reaper_evo": { "file": "auto_weapons/soul-reaper-evo-16.png", "frames": 16, "fps": 24, "desc": "Evolved Blood Scythe: Dual-bladed demonic scythe with skull jewel & soul vortex" },
        "solar_flare_evo": { "file": "auto_weapons/solar-flare-evo-16.png", "frames": 16, "fps": 20, "desc": "Evolved Ember Orbs: Miniature nuclear suns with pulsating solar prominences" }
    }
    
    data["categories"]["active_skills"] = {
        "overdrive": { "file": "skills/skill-overdrive-16.png", "frames": 16, "fps": 20, "desc": "Overdrive: Golden lightning aura, rising steam vents, hyper-speed combat boost" },
        "bulwark_shield": { "file": "skills/skill-bulwark-shield-16.png", "frames": 16, "fps": 18, "desc": "Bulwark Shield: Hexagonal crystalline water barrier facet sphere" },
        "bloodrush": { "file": "skills/skill-bloodrush-16.png", "frames": 16, "fps": 24, "desc": "Bloodrush: Berserk sprint speed surge with red trailing ghost echoes" }
    }
    
    data["categories"]["finishers"] = {
        "hydro_drill_execution": { "file": "combat/waterdrop-hydro-drill-finisher-16.png", "frames": 16, "fps": 24, "desc": "Hydro Drill Execution: Piercing water vortex drill charge" }
    }
    
    with open(manifest_file, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Manifest fully updated with evolutions, skills, and finishers at {manifest_file}")

if __name__ == "__main__":
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    # 1. Evolved Weapons
    generate_evo_soul_reaper(os.path.join(out_dir, "auto_weapons", "soul-reaper-evo-16.png"))
    generate_evo_solar_flare_orbs(os.path.join(out_dir, "auto_weapons", "solar-flare-evo-16.png"))
    
    # 2. Active Skills
    generate_skill_overdrive(os.path.join(out_dir, "skills", "skill-overdrive-16.png"))
    generate_skill_bulwark_shield(os.path.join(out_dir, "skills", "skill-bulwark-shield-16.png"))
    generate_skill_bloodrush(os.path.join(out_dir, "skills", "skill-bloodrush-16.png"))
    
    # 3. Finishers
    generate_finisher_hydro_drill(os.path.join(out_dir, "combat", "waterdrop-hydro-drill-finisher-16.png"))
    
    # 4. Manifest update
    update_manifest_complete(out_dir)
    print("ALL EVOLVED WEAPONS, SKILLS AND FINISHERS GENERATED!")
