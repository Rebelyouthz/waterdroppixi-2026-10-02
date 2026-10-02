import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
TURN_SRC = os.path.join(BRAIN_DIR, "waterdrop_turnaround_sheet_1787669453143.jpg")
WALK_SRC = os.path.join(BRAIN_DIR, "waterdrop_walk_sheet_1787669435014.jpg")
RUN_SRC = os.path.join(BRAIN_DIR, "waterdrop_run_sheet_1787670517398.jpg")

OUT_CAMP = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
OUT_CHAR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\character"
OUT_QA = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\qa"

os.makedirs(OUT_CAMP, exist_ok=True)
os.makedirs(OUT_CHAR, exist_ok=True)
os.makedirs(OUT_QA, exist_ok=True)

FRAME_SIZE = 256
CANONICAL_HEIGHT = 168  # Dead Cells / Hades style crisp resolution
FEET_Y = 220            # Fixed grounded baseline

def extract_pure_character(crop_img, bg_color, threshold=22.0):
    arr = np.array(crop_img).astype(np.float32)
    bg = np.array(bg_color).astype(np.float32)
    diff = np.sqrt(np.sum((arr[:, :, :3] - bg) ** 2, axis=2))
    
    is_solid = diff > threshold
    labeled, num_features = ndimage.label(is_solid)
    if num_features == 0:
        return None
    
    sizes = ndimage.sum(is_solid, labeled, range(1, num_features + 1))
    best_label = 0
    best_score = -1e9
    cy, cx = crop_img.height / 2.0, crop_img.width / 2.0
    
    for label_id in range(1, num_features + 1):
        size = sizes[label_id - 1]
        if size < 350:  # Ignore isolated noise/stray neighbor pixels
            continue
        y_idx, x_idx = np.where(labeled == label_id)
        mean_y, mean_x = np.mean(y_idx), np.mean(x_idx)
        dist = np.sqrt((mean_y - cy)**2 + (mean_x - cx)**2)
        score = size - dist * 14.0
        if score > best_score:
            best_score = score
            best_label = label_id
            
    if best_label == 0:
        return None
        
    mask_main = (labeled == best_label)
    # Binary dilation to preserve anti-aliased edge details
    mask_dilated = ndimage.binary_dilation(mask_main, iterations=4)
    alpha = np.clip((diff - 12.0) / 22.0, 0.0, 1.0) * mask_dilated
    
    out_arr = np.zeros((crop_img.height, crop_img.width, 4), dtype=np.uint8)
    out_arr[:, :, :3] = np.array(crop_img)[:, :, :3]
    out_arr[:, :, 3] = (alpha * 255).astype(np.uint8)
    
    rgba = Image.fromarray(out_arr, "RGBA")
    bbox = rgba.getbbox()
    if bbox:
        return rgba.crop(bbox)
    return rgba

def extract_all_turnaround_angles():
    img = Image.open(TURN_SRC).convert("RGB")
    angles = []
    print("-> Extracting 16 Turnaround Angles...")
    for r in range(4):
        for c in range(4):
            center_x = int((c + 0.5) * 256)
            center_y = int([170, 428, 670, 900][r])
            half_w, half_h = 110, 115
            crop = img.crop((center_x - half_w, center_y - half_h, center_x + half_w, center_y + half_h))
            char = extract_pure_character(crop, (193, 195, 197))
            if char is None:
                raise ValueError(f"Failed to extract turn angle ({r}, {c})")
            angles.append(char)
            print(f"   Angle {r*4+c:02d}: {char.width}x{char.height}")
    return angles

def extract_all_walk_frames():
    img = Image.open(WALK_SRC).convert("RGB")
    walks = []
    print("-> Extracting 16 Walk Frames...")
    for r in range(4):
        for c in range(4):
            center_x = int((c + 0.5) * 256)
            center_y = int([170, 428, 670, 900][r])
            half_w, half_h = 110, 115
            crop = img.crop((center_x - half_w, center_y - half_h, center_x + half_w, center_y + half_h))
            char = extract_pure_character(crop, (187, 195, 202))
            if char is None:
                raise ValueError(f"Failed to extract walk frame ({r}, {c})")
            walks.append(char)
            print(f"   Walk Frame {r*4+c:02d}: {char.width}x{char.height}")
    return walks

def render_normalized_frame(char_img, target_h=CANONICAL_HEIGHT, offset_x=0, offset_y=0, stretch_x=1.0, stretch_y=1.0, flip_h=False, draw_shadow=True):
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    scale = target_h / float(char_img.height)
    
    draw_w = max(1, int(char_img.width * scale * stretch_x))
    draw_h = max(1, int(char_img.height * scale * stretch_y))
    
    resized = char_img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    if flip_h:
        resized = resized.transpose(Image.FLIP_LEFT_RIGHT)
        
    pos_x = int(FRAME_SIZE // 2 - draw_w // 2 + offset_x)
    pos_y = int(FEET_Y - draw_h + offset_y)
    
    if draw_shadow:
        shadow = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(shadow)
        sh_w = int(draw_w * 0.44)
        sh_h = int(sh_w * 0.28)
        s_draw.ellipse([FRAME_SIZE // 2 - sh_w, FEET_Y - sh_h // 2 + 1, FRAME_SIZE // 2 + sh_w, FEET_Y + sh_h // 2 + 1], fill=(4, 12, 22, 130))
        shadow = shadow.filter(ImageFilter.GaussianBlur(2.5))
        canvas.paste(shadow, (0, 0), shadow)
        
    canvas.paste(resized, (pos_x, pos_y), resized)
    return canvas

def build_all_assets():
    turn_angles = extract_all_turnaround_angles()
    walk_frames = extract_all_walk_frames()
    
    # 1. 16-Angle Turnaround Master Strip
    turn_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
    for i in range(16):
        f = render_normalized_frame(turn_angles[i])
        turn_strip.paste(f, (i * FRAME_SIZE, 0), f)
    turn_strip.save(os.path.join(OUT_CAMP, "camp-hero-turnaround-16.png"), "PNG")
    print("\nSaved Master 16-Angle Turnaround Sheet!")
    
    # 2. 16 Directional 16-Frame Breathing Idle Sheets (every 22.5 deg)
    print("\n-> Generating 16 Directional Idle Sheets...")
    for dir_idx in range(16):
        base_angle = turn_angles[dir_idx]
        idle_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
        for i in range(16):
            t = i / 16.0
            # Fluid organic hydro breath with liquid vertical elongation & horizontal squash
            breath = math.sin(t * math.pi * 2) * 0.030
            f = render_normalized_frame(base_angle, stretch_y=1.0 + breath, stretch_x=1.0 - breath * 0.5)
            idle_strip.paste(f, (i * FRAME_SIZE, 0), f)
        
        filename = f"camp-hero-idle-dir{dir_idx}.png"
        idle_strip.save(os.path.join(OUT_CAMP, filename), "PNG")
        if dir_idx == 0:
            idle_strip.save(os.path.join(OUT_CAMP, "camp-hero-idle-16.png"), "PNG")
            idle_strip.save(os.path.join(OUT_CHAR, "waterdrop-idle-16.png"), "PNG")
        print(f"   Saved {filename}")

    # 3. 16 Directional 16-Frame Walk Sheets
    print("\n-> Generating 16 Directional Walk Sheets...")
    # Direction 0 (South): uses authentic walk_frames directly
    # Directions 1..15: synthesized with exact directional angle and gait kinematics
    for dir_idx in range(16):
        walk_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
        if dir_idx == 0:
            for i in range(16):
                src_f = walk_frames[i % len(walk_frames)]
                f = render_normalized_frame(src_f)
                walk_strip.paste(f, (i * FRAME_SIZE, 0), f)
        else:
            base_angle = turn_angles[dir_idx]
            for i in range(16):
                t = i / 16.0
                # 2-step stride physics:
                bob = -abs(math.sin(t * math.pi * 2)) * 6.8
                stride_sq = math.cos(t * math.pi * 2) * 0.045
                sway = math.sin(t * math.pi * 2) * 2.5
                f = render_normalized_frame(base_angle, offset_x=sway, offset_y=bob, stretch_y=1.0 + stride_sq, stretch_x=1.0 - stride_sq * 0.5)
                walk_strip.paste(f, (i * FRAME_SIZE, 0), f)
                
        filename = f"camp-hero-walk-dir{dir_idx}.png"
        walk_strip.save(os.path.join(OUT_CAMP, filename), "PNG")
        if dir_idx == 0:
            walk_strip.save(os.path.join(OUT_CAMP, "camp-hero-walk-down-16.png"), "PNG")
            walk_strip.save(os.path.join(OUT_CHAR, "waterdrop-walk-16.png"), "PNG")
        print(f"   Saved {filename}")
        
    # Also save standard 8-way names for backward compatibility
    dir8_map = {
        0: "camp-hero-walk-down-16.png",
        2: "camp-hero-walk-downright-16.png",
        4: "camp-hero-walk-right-16.png",
        6: "camp-hero-walk-upright-16.png",
        8: "camp-hero-walk-up-16.png",
        10: "camp-hero-walk-upleft-16.png",
        12: "camp-hero-walk-left-16.png",
        14: "camp-hero-walk-downleft-16.png",
    }
    for d_idx, f_name in dir8_map.items():
        src_path = os.path.join(OUT_CAMP, f"camp-hero-walk-dir{d_idx}.png")
        dst_path = os.path.join(OUT_CAMP, f_name)
        img_copy = Image.open(src_path)
        img_copy.save(dst_path, "PNG")

    # 4. Generate QA Contact Sheet
    print("\n-> Generating QA Contact Sheet (Over Checkerboard)...")
    qa_sheet = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE * 2), (28, 38, 48, 255))
    # Checkerboard pattern
    chk_draw = ImageDraw.Draw(qa_sheet)
    for y in range(0, FRAME_SIZE * 2, 16):
        for x in range(0, FRAME_SIZE * 16, 16):
            if ((x // 16) + (y // 16)) % 2 == 1:
                chk_draw.rectangle([x, y, x + 16, y + 16], fill=(38, 50, 62, 255))
                
    # Paste 16 idle angles in Row 0, 16 walk frames in Row 1
    for i in range(16):
        f_idle = render_normalized_frame(turn_angles[i])
        f_walk = render_normalized_frame(walk_frames[i])
        qa_sheet.paste(f_idle, (i * FRAME_SIZE, 0), f_idle)
        qa_sheet.paste(f_walk, (i * FRAME_SIZE, FRAME_SIZE), f_walk)
        
    # Draw red baseline guide at y=FEET_Y and y=FEET_Y + FRAME_SIZE
    chk_draw.line([0, FEET_Y, FRAME_SIZE * 16, FEET_Y], fill=(255, 60, 60, 180), width=1)
    chk_draw.line([0, FEET_Y + FRAME_SIZE, FRAME_SIZE * 16, FEET_Y + FRAME_SIZE], fill=(255, 60, 60, 180), width=1)
    
    qa_sheet.save(os.path.join(OUT_QA, "character_qa_contact_sheet.png"), "PNG")
    print(f"   Saved QA Contact Sheet: {os.path.join(OUT_QA, 'character_qa_contact_sheet.png')}")

if __name__ == "__main__":
    print("=================================================================")
    print("BUILDING MASTER CHARACTER KINEMATICS & 16-ANGLE SPRITESHEETS...")
    print("=================================================================")
    build_all_assets()
    print("=================================================================")
    print("ALL 16-ANGLE ASSETS & QA CONTACT SHEET GENERATED!")
    print("=================================================================")
