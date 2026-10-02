import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
OUT_CHAR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\character"
OUT_CAMP = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"

os.makedirs(OUT_CHAR, exist_ok=True)
os.makedirs(OUT_CAMP, exist_ok=True)

FRAME_SIZE = 256
CANONICAL_HEIGHT = 168
FEET_Y = 220

ACTION_SHEETS = [
    ("waterdrop_dash_roll_sheet_1787670536566.jpg", "waterdrop-dash-16.png", "camp-hero-dash-16.png"),
    ("waterdrop_run_sheet_1787670517398.jpg", "waterdrop-run-16.png", "camp-hero-run-16.png"),
    ("waterdrop_attack_sheet_1787669480658.jpg", "waterdrop-attack-16.png", "camp-hero-attack-16.png"),
    ("waterdrop_katana_slash_sheet_1787670554745.jpg", "waterdrop-katana-slash-16.png", "camp-hero-katana-slash-16.png"),
    ("waterdrop_katana_finisher_sheet_1787670586111.jpg", "waterdrop-katana-finisher-16.png", "camp-hero-katana-finisher-16.png"),
    ("waterdrop_bow_shoot_sheet_1787670626249.jpg", "waterdrop-bow-shoot-16.png", "camp-hero-bow-shoot-16.png"),
    ("waterdrop_scythe_spin_sheet_1787670644724.jpg", "waterdrop-scythe-spin-16.png", "camp-hero-scythe-spin-16.png"),
    ("waterdrop_rage_sheet_1787670605158.jpg", "waterdrop-rage-16.png", "camp-hero-rage-16.png"),
    ("waterdrop_hurt_sheet_1787670665365.jpg", "waterdrop-hurt-16.png", "camp-hero-hurt-16.png"),
    ("waterdrop_cheer_sheet_1787669646098.jpg", "waterdrop-cheer-16.png", "camp-hero-cheer-16.png"),
]

def extract_pure_character(crop_img, bg_color, threshold=20.0):
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
        if size < 250:
            continue
        y_idx, x_idx = np.where(labeled == label_id)
        mean_y, mean_x = np.mean(y_idx), np.mean(x_idx)
        dist = np.sqrt((mean_y - cy)**2 + (mean_x - cx)**2)
        score = size - dist * 12.0
        if score > best_score:
            best_score = score
            best_label = label_id
            
    if best_label == 0:
        return None
        
    mask_main = (labeled == best_label)
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

def render_normalized_frame(char_img, target_h=CANONICAL_HEIGHT, offset_x=0, offset_y=0, stretch_x=1.0, stretch_y=1.0, draw_shadow=True):
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    scale = target_h / float(char_img.height)
    
    draw_w = max(1, int(char_img.width * scale * stretch_x))
    draw_h = max(1, int(char_img.height * scale * stretch_y))
    
    resized = char_img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
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

def process_all_action_sheets():
    print("=================================================================")
    print("PROCESSING FULL MASTER CHARACTER ACTION ANIMATION LIBRARY...")
    print("=================================================================")
    
    for src_file, out_char_name, out_camp_name in ACTION_SHEETS:
        src_path = os.path.join(BRAIN_DIR, src_file)
        if not os.path.exists(src_path):
            print(f"Skipping missing: {src_file}")
            continue
            
        img = Image.open(src_path).convert("RGB")
        arr = np.array(img)
        corners = np.array([arr[0,0], arr[0,-1], arr[-1,0], arr[-1,-1]])
        bg_color = np.mean(corners, axis=0)
        
        strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
        valid_frames = 0
        
        for r in range(4):
            for c in range(4):
                center_x = int((c + 0.5) * 256)
                center_y = int([170, 428, 670, 900][r])
                half_w, half_h = 110, 115
                crop = img.crop((center_x - half_w, center_y - half_h, center_x + half_w, center_y + half_h))
                char = extract_pure_character(crop, bg_color)
                if char:
                    frame = render_normalized_frame(char)
                    strip.paste(frame, ((r * 4 + c) * FRAME_SIZE, 0), frame)
                    valid_frames += 1
                else:
                    # Fallback to simple center crop if segmentation fails on non-standard pose
                    cell = img.crop((c * 256 + 20, r * 256 + 20, (c + 1) * 256 - 20, (r + 1) * 256 - 20))
                    char = extract_pure_character(cell, bg_color, threshold=15.0)
                    if char:
                        frame = render_normalized_frame(char)
                        strip.paste(frame, ((r * 4 + c) * FRAME_SIZE, 0), frame)
                        valid_frames += 1
                        
        char_dst = os.path.join(OUT_CHAR, out_char_name)
        camp_dst = os.path.join(OUT_CAMP, out_camp_name)
        strip.save(char_dst, "PNG")
        strip.save(camp_dst, "PNG")
        print(f"-> Processed {src_file} -> {out_char_name} ({valid_frames}/16 frames extracted)")

if __name__ == "__main__":
    process_all_action_sheets()
    print("=================================================================")
    print("ALL CHARACTER ACTION ANIMATIONS PROCESSED & SAVED!")
    print("=================================================================")
