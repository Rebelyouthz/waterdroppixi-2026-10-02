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
    print(f"Exported: {output_path} ({total_w}x{frame_h}, {len(frames)} frames)")

def build_blood_scythe_sweep(output_path, frame_w=128, frame_h=128, count=16):
    """Generates the autonomous floating spinning Blood Scythe sweep entity."""
    frames = []
    for i in range(count):
        t = i / count
        rot_rad = t * math.pi * 2
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, frame_h // 2
        
        # Swirling blood energy arc trail
        trail_pts = []
        for a in range(-90, 10, 10):
            trail_ang = rot_rad + math.radians(a)
            r = 38 + math.sin(t * math.pi * 4) * 4
            trail_pts.append((cx + math.cos(trail_ang) * r, cy + math.sin(trail_ang) * r))
        if len(trail_pts) >= 2:
            draw.line(trail_pts, fill=(210, 30, 50, int(180 * (1 - abs(a)/100))), width=5)
            draw.line(trail_pts, fill=(255, 120, 140, 220), width=2)
            
        # Obsidian staff handle
        hx0 = cx - math.cos(rot_rad) * 22
        hy0 = cy - math.sin(rot_rad) * 22
        hx1 = cx + math.cos(rot_rad) * 26
        hy1 = cy + math.sin(rot_rad) * 26
        draw.line([(hx0, hy0), (hx1, hy1)], fill=(20, 15, 25, 255), width=4)
        
        # Crimson crescent blade
        bx = hx1 + math.sin(rot_rad) * 26
        by = hy1 - math.cos(rot_rad) * 26
        tip_x = hx1 + math.cos(rot_rad) * 10
        tip_y = hy1 + math.sin(rot_rad) * 10
        draw.polygon([(hx1, hy1), (bx, by), (tip_x, tip_y)], fill=(195, 20, 40, 255), outline=(255, 60, 90, 255))
        # Glowing inner edge
        draw.line([(bx, by), (tip_x, tip_y)], fill=(255, 220, 230, 240), width=2)
        
        frames.append(canvas)
    save_strip(frames, output_path, frame_w, frame_h)

def build_ember_orbs(output_path, frame_w=128, frame_h=128, count=16):
    """Generates the autonomous orbiting Ember Orbs with animated plasma fire corona."""
    frames = []
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, frame_h // 2
        
        # Solar flare rays
        for ray in range(8):
            ang = (ray / 8.0) * math.pi * 2 + t * math.pi * 2
            ray_len = 24 + math.sin(t * math.pi * 4 + ray) * 6
            rx = cx + math.cos(ang) * ray_len
            ry = cy + math.sin(ang) * ray_len
            draw.line([(cx, cy), (rx, ry)], fill=(255, 120, 20, int(160 + math.sin(t*math.pi*2 + ray)*80)), width=3)
            
        # Molten core
        draw.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(255, 120, 10, 220), outline=(255, 200, 40, 255))
        draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(255, 220, 80, 255))
        draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 255, 255, 255))
        
        frames.append(canvas)
    save_strip(frames, output_path, frame_w, frame_h)

def build_rune_bolts(output_path, frame_w=128, frame_h=128, count=16):
    """Generates the cyan homing rune motes with trailing starlight particles."""
    frames = []
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, frame_h // 2
        
        # Rune symbol rotation
        rot_ang = t * math.pi * 2
        
        # Particle tail
        for p in range(5):
            p_ang = rot_ang + math.pi + (p - 2) * 0.3
            p_dist = 16 + p * 6
            px = cx + math.cos(p_ang) * p_dist
            py = cy + math.sin(p_ang) * p_dist
            draw.circle((px, py), radius=3.5 - p * 0.5, fill=(77, 255, 212, int(220 - p * 40)))
            
        # Core diamond rune
        r_size = 14
        pts = [
            (cx, cy - r_size),
            (cx + r_size, cy),
            (cx, cy + r_size),
            (cx - r_size, cy),
        ]
        draw.polygon(pts, fill=(30, 180, 220, 240), outline=(180, 255, 245, 255))
        draw.line([(cx, cy - r_size + 3), (cx, cy + r_size - 3)], fill=(255, 255, 255, 255), width=2)
        draw.line([(cx - r_size + 3, cy), (cx + r_size - 3, cy)], fill=(255, 255, 255, 255), width=2)
        
        frames.append(canvas)
    save_strip(frames, output_path, frame_w, frame_h)

def build_shockwave_annunaki(output_path, frame_w=128, frame_h=128, count=16):
    """Generates the radial Annunaki eldritch expanding shockwave pulse."""
    frames = []
    for i in range(count):
        t = (i + 1) / count
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, frame_h // 2
        
        r = t * 56
        alpha = int(255 * (1.0 - t * 0.85))
        
        # Outer ring
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(179, 98, 255, alpha), width=3)
        # Inner harmonic ring
        r_in = r * 0.65
        draw.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=(230, 180, 255, int(alpha * 0.8)), width=2)
        # Rune spikes
        for s in range(6):
            ang = (s / 6.0) * math.pi * 2 + t * math.pi
            sx = cx + math.cos(ang) * r
            sy = cy + math.sin(ang) * r
            draw.line([(cx + math.cos(ang) * (r - 8), cy + math.sin(ang) * (r - 8)), (sx, sy)], fill=(255, 255, 255, alpha), width=2)
            
        frames.append(canvas)
    save_strip(frames, output_path, frame_w, frame_h)

def build_tide_whip(output_path, frame_w=128, frame_h=128, count=16):
    """Generates the Tide Lash fluid water whip crack animation."""
    frames = []
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = 16, frame_h // 2
        
        # Sine wave fluid water whip
        pts = []
        ext = 20 + math.sin(t * math.pi) * 88
        for x_step in range(0, int(ext), 6):
            wave_y = cy + math.sin(x_step * 0.08 + t * math.pi * 3) * (14 * (1 - x_step / (ext + 1e-5)))
            pts.append((cx + x_step, wave_y))
            
        if len(pts) >= 2:
            draw.line(pts, fill=(79, 216, 255, 230), width=5)
            draw.line(pts, fill=(220, 250, 255, 255), width=2)
            # Whip crack tip burst
            if t > 0.4 and t < 0.8:
                tx, ty = pts[-1]
                draw.ellipse([tx - 8, ty - 8, tx + 8, ty + 8], fill=(255, 255, 255, 240))
                draw.ellipse([tx - 14, ty - 14, tx + 14, ty + 14], outline=(79, 216, 255, 180), width=2)
                
        frames.append(canvas)
    save_strip(frames, output_path, frame_w, frame_h)

def build_void_beam_core(output_path, frame_w=128, frame_h=128, count=16):
    """Generates the pulsing dark matter Void Beam tether vortex core."""
    frames = []
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, frame_h // 2
        
        # Spiral void tendrils
        for arm in range(4):
            arm_pts = []
            base_ang = (arm / 4.0) * math.pi * 2 + t * math.pi * 2
            for dist in range(4, 28, 4):
                cur_ang = base_ang + dist * 0.15
                arm_pts.append((cx + math.cos(cur_ang) * dist, cy + math.sin(cur_ang) * dist))
            if len(arm_pts) >= 2:
                draw.line(arm_pts, fill=(160, 60, 240, 200), width=3)
                
        draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(15, 5, 30, 255), outline=(190, 80, 255, 255))
        draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(240, 180, 255, 240))
        
        frames.append(canvas)
    save_strip(frames, output_path, frame_w, frame_h)

def build_tesla_arc(output_path, frame_w=128, frame_h=128, count=16):
    """Generates the Arc Tesla electric branching lightning discharge."""
    frames = []
    np.random.seed(42)
    for i in range(count):
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, frame_h // 2
        
        # Main jagged bolt from center outward
        for branch in range(3):
            ang = (branch / 3.0) * math.pi * 2 + np.random.uniform(-0.3, 0.3)
            cur_x, cur_y = cx, cy
            bolt_pts = [(cur_x, cur_y)]
            for step in range(5):
                cur_x += math.cos(ang) * 8 + np.random.uniform(-6, 6)
                cur_y += math.sin(ang) * 8 + np.random.uniform(-6, 6)
                bolt_pts.append((cur_x, cur_y))
            draw.line(bolt_pts, fill=(160, 228, 255, 240), width=3)
            draw.line(bolt_pts, fill=(255, 255, 255, 255), width=1)
            
        draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 255, 255, 255))
        frames.append(canvas)
    save_strip(frames, output_path, frame_w, frame_h)

if __name__ == "__main__":
    out_root = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    FW, FH = 128, 128
    
    # 1. Build Auto-Weapons & Orbitals
    build_blood_scythe_sweep(os.path.join(out_root, "auto_weapons", "bloodscythe-sweep-16.png"), FW, FH)
    build_ember_orbs(os.path.join(out_root, "auto_weapons", "ember-orb-orbit-16.png"), FW, FH)
    build_rune_bolts(os.path.join(out_root, "auto_weapons", "rune-bolt-homing-16.png"), FW, FH)
    build_shockwave_annunaki(os.path.join(out_root, "auto_weapons", "shockwave-annunaki-16.png"), FW, FH)
    build_tide_whip(os.path.join(out_root, "auto_weapons", "tide-whip-lash-16.png"), FW, FH)
    build_void_beam_core(os.path.join(out_root, "auto_weapons", "void-beam-vortex-16.png"), FW, FH)
    build_tesla_arc(os.path.join(out_root, "auto_weapons", "arc-tesla-lightning-16.png"), FW, FH)

    # 2. Update Master Manifest with Auto Weapons category
    manifest_path = os.path.join(out_root, "manifest.json")
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
        
    manifest["categories"]["auto_weapons"] = {
        "bloodscythe_sweep": { "file": "auto_weapons/bloodscythe-sweep-16.png", "frames": 16, "type": "aoe_sweep", "behaviour": "aoe" },
        "ember_orbs": { "file": "auto_weapons/ember-orb-orbit-16.png", "frames": 16, "type": "orbiting_plasma", "behaviour": "orbit" },
        "runebolts": { "file": "auto_weapons/rune-bolt-homing-16.png", "frames": 16, "type": "homing_glyph", "behaviour": "projectile" },
        "shockwave": { "file": "auto_weapons/shockwave-annunaki-16.png", "frames": 16, "type": "radial_shockwave", "behaviour": "aoe" },
        "tide_whip": { "file": "auto_weapons/tide-whip-lash-16.png", "frames": 16, "type": "directional_lash", "behaviour": "aoe" },
        "void_beam": { "file": "auto_weapons/void-beam-vortex-16.png", "frames": 16, "type": "tether_vortex", "behaviour": "beam" },
        "arc_tesla": { "file": "auto_weapons/arc-tesla-lightning-16.png", "frames": 16, "type": "chain_lightning", "behaviour": "chain" },
    }
    
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"\nSuccessfully generated all auto weapon and orbital assets! Manifest updated at {manifest_path}")
