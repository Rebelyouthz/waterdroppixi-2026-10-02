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

def draw_waterdrop(draw, cx, cy, w=30, h=36, tilt=0.0, eye_type='normal', headband=True, glow_eyes=False, arms_pose='idle', mouth='flat', color=(43, 127, 168)):
    """Canonical Waterdrop Hero character renderer with full state flexibility."""
    # Shadow
    draw.ellipse([cx - w*0.8, cy + h - 6, cx + w*0.8, cy + h + 2], fill=(0, 0, 0, 80))
    
    # Body teardrop points
    top_x = cx + math.sin(tilt) * 12
    top_y = cy - h + 4
    bot_y = cy + h - 6
    
    body_pts = [
        (top_x, top_y),
        (cx + w, cy),
        (cx + w*0.85, bot_y),
        (cx - w*0.85, bot_y),
        (cx - w, cy)
    ]
    draw.polygon(body_pts, fill=color, outline=(6, 18, 30, 255))
    # Fluid highlights
    draw.ellipse([cx - w*0.6, cy - h*0.4, cx + w*0.2, cy + h*0.3], fill=(79, 180, 230, 240))
    draw.ellipse([cx - w*0.4, cy - h*0.3, cx - w*0.1, cy - h*0.1], fill=(180, 240, 255, 230))
    
    # Headband
    if headband:
        hb_y = cy - h*0.25
        draw.polygon([(cx - w*0.95, hb_y - 4), (cx + w*0.95, hb_y - 4), (cx + w*0.95, hb_y + 7), (cx - w*0.95, hb_y + 7)], fill=(181, 29, 40, 255), outline=(80, 10, 15, 255))
        draw.line([(cx - w*0.95, hb_y + 1), (cx + w*0.95, hb_y + 1)], fill=(245, 245, 245, 255), width=2)
        # Knot tails
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
    elif eye_type == 'dire':
        draw.ellipse([cx - 13, cy - 4, cx - 3, cy + 6], fill=(200, 220, 255, 255))
        draw.circle((cx - 8, cy + 1), radius=4, fill=(40, 60, 90, 255))
        draw.ellipse([cx + 3, cy - 4, cx + 13, cy + 6], fill=(200, 220, 255, 255))
        draw.circle((cx + 8, cy + 1), radius=4, fill=(40, 60, 90, 255))
    elif eye_type == 'closed':
        draw.line([(cx - 12, cy), (cx - 4, cy)], fill=(20, 10, 10, 255), width=2)
        draw.line([(cx + 4, cy), (cx + 12, cy)], fill=(20, 10, 10, 255), width=2)

    if glow_eyes:
        draw.line([(cx - 8, cy - 2), (cx - 22, cy - 12)], fill=(255, 50, 50, 200), width=2)
        draw.line([(cx + 8, cy - 2), (cx + 22, cy - 12)], fill=(255, 50, 50, 200), width=2)

    # Mouth
    if mouth == 'pant':
        draw.ellipse([cx - 5, cy + 12, cx + 5, cy + 20], fill=(20, 10, 15, 255))
    elif mouth == 'grit':
        draw.rectangle([cx - 6, cy + 14, cx + 6, cy + 18], fill=(240, 240, 240, 255), outline=(30, 10, 10, 255))

    # Arms
    if arms_pose == 'idle':
        draw.line([(cx - w*0.8, cy + 6), (cx - w*0.7, cy + 20)], fill=color, width=4)
        draw.line([(cx + w*0.8, cy + 6), (cx + w*0.7, cy + 20)], fill=color, width=4)
        draw.circle((cx - w*0.7, cy + 20), radius=3, fill=color)
        draw.circle((cx + w*0.7, cy + 20), radius=3, fill=color)
    elif arms_pose == 'aim':
        draw.line([(cx - w*0.6, cy + 4), (cx + 18, cy + 6)], fill=color, width=4)
        draw.line([(cx + w*0.6, cy + 4), (cx + 24, cy + 4)], fill=color, width=4)
    elif arms_pose == 'pant':
        draw.line([(cx - w*0.8, cy + 6), (cx - 16, cy + 26)], fill=color, width=4)
        draw.line([(cx + w*0.8, cy + 6), (cx + 16, cy + 26)], fill=color, width=4)

def generate_origin_awakening(output_path, count=16):
    """How the game begins: Puddle -> Mutation -> Rising up -> Tying headband -> Ready stance!"""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 16
        
        if i < 4:
            # Phase 1: Pure liquid puddle in the lake
            pw = 38 + i * 2
            ph = 8 - i * 1
            draw.ellipse([cx - pw, cy + 18 - ph, cx + pw, cy + 18 + ph], fill=(60, 160, 210, 240), outline=(20, 80, 120, 255))
            # Cosmic mutation sparks
            for s in range(4):
                sp_ang = (s / 4.0) * math.pi * 2 + i * 0.8
                draw.circle((cx + math.cos(sp_ang)*20, cy + 16 + math.sin(sp_ang)*6), radius=2, fill=(255, 80, 50, 220))
        elif i < 9:
            # Phase 2: Rising up and taking teardrop shape
            prog = (i - 4) / 4.0
            h = 10 + prog * 24
            w = 34 - prog * 6
            draw_waterdrop(draw, cx, cy - int(prog*10), w=w, h=h, headband=False, eye_type='closed', arms_pose='idle')
            # Awakening energy burst
            draw.ellipse([cx - 24, cy + 14, cx + 24, cy + 22], outline=(79, 216, 255, int(255*(1-prog))), width=2)
        elif i < 13:
            # Phase 3: Tying the red headband & glowing eyes ignition
            prog = (i - 9) / 3.0
            draw_waterdrop(draw, cx, cy - 10, w=28, h=34, headband=True, eye_type='normal', glow_eyes=(i >= 11), mouth='grit')
            # Hands at head tying knot
            draw.line([(cx - 18, cy - 2), (cx - 28, cy - 14)], fill=(43, 127, 168, 255), width=3)
            draw.line([(cx + 18, cy - 2), (cx + 28, cy - 14)], fill=(43, 127, 168, 255), width=3)
        else:
            # Phase 4: Battle readiness combat idle
            draw_waterdrop(draw, cx, cy - 10, w=28, h=34, headband=True, eye_type='angry', glow_eyes=True, arms_pose='aim', mouth='grit')
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_skid_slide(output_path, count=16):
    """Hard direction reversal skid with liquid spray wake and snap turn."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 10
        
        tilt = -0.35 + (i / 15.0) * 0.70
        lean_wob = math.sin(t * math.pi) * 8
        draw_waterdrop(draw, cx + int(lean_wob), cy, w=30, h=32, tilt=tilt, eye_type='angry', arms_pose='idle', mouth='grit')
        
        # Ground skid marks & water spray
        skid_prog = math.sin(t * math.pi)
        draw.line([(cx - 30, cy + 28), (cx + 20, cy + 28)], fill=(120, 200, 240, int(skid_prog * 200)), width=3)
        for p in range(5):
            px = cx - 25 - p * 6
            py = cy + 26 - p * 3
            draw.circle((px, py), radius=3 - p*0.4, fill=(79, 180, 230, int(skid_prog * 220)))
            
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_backpedal(output_path, count=16):
    """Backpedalling walk cycle while keeping aim locked forward on targets."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 10
        
        bob = math.sin(t * math.pi * 2) * 3
        tilt = 0.15 # leaning slightly forward to balance backward movement
        draw_waterdrop(draw, cx, cy + int(bob), w=28, h=34, tilt=tilt, eye_type='normal', arms_pose='aim')
        
        # Paddle feet in backward walking gait
        foot_ph = math.sin(t * math.pi * 2)
        draw.ellipse([cx - 16, cy + 28 + foot_ph*4, cx - 4, cy + 34 + foot_ph*4], fill=(20, 70, 100, 255))
        draw.ellipse([cx + 4, cy + 28 - foot_ph*4, cx + 16, cy + 34 - foot_ph*4], fill=(20, 70, 100, 255))
        
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_dash_swipe(output_path, count=16):
    """High-speed gesture swipe dash with aerodynamic droplet bullet trail."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 10
        
        # Horizontal elongated droplet
        speed_stretch = 1.0 + math.sin(t * math.pi) * 0.8
        w = int(28 * speed_stretch)
        h = int(32 / speed_stretch)
        
        # Speed wake lines
        for trail in range(4):
            tx = cx - 20 - trail * 14
            alpha = int(180 * (1 - trail / 4.0))
            draw.line([(tx, cy), (tx + 18, cy)], fill=(79, 216, 255, alpha), width=3)
            
        draw_waterdrop(draw, cx + int((t - 0.5)*20), cy, w=w, h=h, tilt=0.4, eye_type='angry', arms_pose='idle', mouth='grit')
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def generate_dire_lowhp(output_path, count=16):
    """Critical low HP (<25% health): heavy panting, exhausted stance, dripping water."""
    frames = []
    FW, FH = 128, 128
    for i in range(count):
        t = i / count
        canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = FW // 2, FH // 2 + 12
        
        pant_h = int(math.sin(t * math.pi * 2) * 4)
        draw_waterdrop(draw, cx, cy, w=30 + pant_h, h=30 - pant_h, tilt=0.08, eye_type='dire', arms_pose='pant', mouth='pant', color=(70, 110, 145))
        
        # Leaking sweat/water droplets
        drop_y = cy + 18 + int(t * 16) % 16
        draw.circle((cx + 18, drop_y), radius=2, fill=(120, 200, 255, 200))
        draw.circle((cx - 18, drop_y + 4), radius=2, fill=(120, 200, 255, 200))
        
        frames.append(canvas)
    save_strip(frames, output_path, FW, FH)

def update_manifest_all(root_dir):
    manifest_file = os.path.join(root_dir, "manifest.json")
    with open(manifest_file, "r") as f:
        data = json.load(f)
        
    data["categories"]["intro_and_origin"] = {
        "awakening": { "file": "intro/waterdrop-origin-awakening-16.png", "frames": 16, "fps": 12, "desc": "Game origin start: Puddle in lake -> Mutation -> Rising up -> Tying red headband -> Combat stance" }
    }
    
    data["categories"]["advanced_movement"] = {
        "skid_slide": { "file": "character/waterdrop-skid-slide-16.png", "frames": 16, "fps": 20, "desc": "Hard reversal skid with liquid spray wake and snap turn" },
        "backpedal": { "file": "character/waterdrop-backpedal-16.png", "frames": 16, "fps": 16, "desc": "Backpedalling walk cycle with locked forward aim" },
        "dash_swipe": { "file": "character/waterdrop-dash-swipe-16.png", "frames": 16, "fps": 24, "desc": "Gesture swipe dash with speed wake lines" },
        "dire_lowhp": { "file": "character/waterdrop-dire-lowhp-16.png", "frames": 16, "fps": 10, "desc": "Critical low HP (<25% health): heavy panting, exhausted stance, dripping droplets" }
    }
    
    with open(manifest_file, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Manifest fully synchronized at {manifest_file}")

if __name__ == "__main__":
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    # 1. Intro & Origin
    generate_origin_awakening(os.path.join(out_dir, "intro", "waterdrop-origin-awakening-16.png"))
    
    # 2. Advanced Character Moves
    generate_skid_slide(os.path.join(out_dir, "character", "waterdrop-skid-slide-16.png"))
    generate_backpedal(os.path.join(out_dir, "character", "waterdrop-backpedal-16.png"))
    generate_dash_swipe(os.path.join(out_dir, "character", "waterdrop-dash-swipe-16.png"))
    generate_dire_lowhp(os.path.join(out_dir, "character", "waterdrop-dire-lowhp-16.png"))
    
    # 3. Update manifest
    update_manifest_all(out_dir)
    print("ALL CORE CHARACTER MOVES AND START ANIMATIONS GENERATED!")
