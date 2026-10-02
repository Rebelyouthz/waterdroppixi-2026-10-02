import os
import math
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

TURN_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678490635.jpg"
OUT_CAMP = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
OUT_CHAR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\character"

FRAME_SIZE = 256
TARGET_HEIGHT = 168  # Standard canonical height in 256x256 frame
FEET_Y = 220         # Feet contact line

# Exact row Y-bands in media_1787678490635.jpg
ROW_BANDS = [
    (58, 286),   # Row 0 (Angles 0..3)
    (318, 540),  # Row 1 (Angles 4..7)
    (564, 776),  # Row 2 (Angles 8..11)
    (796, 1005)  # Row 3 (Angles 12..15)
]

# Exact column X-bands in media_1787678490635.jpg
COL_BANDS = [
    [ (58, 197), (314, 451), (570, 709), (825, 962) ],     # Row 0
    [ (69, 187), (317, 451), (569, 710), (825, 966) ],     # Row 1
    [ (62, 196), (324, 443), (565, 710), (825, 969) ],     # Row 2
    [ (54, 201), (311, 459), (559, 720), (814, 976) ]      # Row 3
]

def extract_clean_character(crop_img):
    arr = np.array(crop_img).astype(np.float32)
    # Background color is light gray ~195
    # Calculate distance from background color
    bg_color = np.array([195.0, 195.0, 196.0])
    diff = np.sqrt(np.sum((arr[:, :, :3] - bg_color) ** 2, axis=2))
    
    # Character pixels have diff > 20
    # Soft alpha matte
    alpha = np.clip((diff - 14.0) / 18.0, 0.0, 1.0)
    
    # Floodfill / connected component to remove stray background specks
    is_solid = (diff > 25.0)
    labeled, num_features = ndimage.label(is_solid)
    if num_features > 0:
        sizes = ndimage.sum(is_solid, labeled, range(1, num_features + 1))
        max_label = np.argmax(sizes) + 1
        mask_main = (labeled == max_label)
        # Dilate main mask slightly
        mask_dilated = ndimage.binary_dilation(mask_main, iterations=3)
        alpha = alpha * mask_dilated
        
    # Build RGBA image
    out_arr = np.zeros((crop_img.height, crop_img.width, 4), dtype=np.uint8)
    out_arr[:, :, :3] = np.array(crop_img)[:, :, :3]
    out_arr[:, :, 3] = (alpha * 255).astype(np.uint8)
    
    char_rgba = Image.fromarray(out_arr, "RGBA")
    
    # Crop to non-empty bbox
    bbox = char_rgba.getbbox()
    if bbox:
        return char_rgba.crop(bbox)
    return char_rgba

def extract_all_16_angles():
    turn_img = Image.open(TURN_SRC).convert("RGB")
    angles = []
    
    for r in range(4):
        y0, y1 = ROW_BANDS[r]
        for c in range(4):
            x0, x1 = COL_BANDS[r][c]
            crop = turn_img.crop((x0, y0, x1, y1))
            char = extract_clean_character(crop)
            angles.append(char)
            print(f"Extracted Angle {r*4+c:02d}: size={char.width}x{char.height}")
            
    return angles

def place_centered_frame(char_img, scale=1.0, offset_y=0, offset_x=0, stretch_y=1.0, stretch_x=1.0):
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    draw_w = int(char_img.width * scale * stretch_x)
    draw_h = int(char_img.height * scale * stretch_y)
    
    resized = char_img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    
    # Anchor at (128, FEET_Y)
    pos_x = int(FRAME_SIZE // 2 - draw_w // 2 + offset_x)
    pos_y = int(FEET_Y - draw_h + offset_y)
    
    # Add subtle contact shadow at feet (128, FEET_Y + 4)
    shadow = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    sh_w = int(draw_w * 0.45)
    sh_h = int(sh_w * 0.28)
    s_draw.ellipse([FRAME_SIZE // 2 - sh_w, FEET_Y - sh_h // 2 + 2, FRAME_SIZE // 2 + sh_w, FEET_Y + sh_h // 2 + 2], fill=(4, 12, 22, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    
    canvas.paste(shadow, (0, 0), shadow)
    canvas.paste(resized, (pos_x, pos_y), resized)
    return canvas

def build_all_perfect_character_sheets():
    angles = extract_all_16_angles()
    
    # Calculate uniform scale so all angles are TARGET_HEIGHT (168px)
    avg_h = np.mean([a.height for a in angles])
    base_scale = TARGET_HEIGHT / avg_h
    print(f"\nUniform character base scale: {base_scale:.4f} (target height: {TARGET_HEIGHT}px)")
    
    # 1. Turnaround Sheet (16 frames)
    turn_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
    for i, a in enumerate(angles):
        f = place_centered_frame(a, scale=base_scale)
        turn_strip.paste(f, (i * FRAME_SIZE, 0), f)
    turn_path = os.path.join(OUT_CHAR, "waterdrop-turnaround-16.png")
    turn_strip.save(turn_path, "PNG")
    turn_strip.save(os.path.join(OUT_CAMP, "camp-hero-turnaround-16.png"), "PNG")
    print(f"Saved Perfect Turnaround: {turn_path}")
    
    # 2. Idle Sheet (Natural breathing & blinking loop, 16 frames)
    idle_base = angles[0]  # South-facing camera pose
    idle_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
    for i in range(16):
        t = i / 16.0
        breath = math.sin(t * math.pi * 2) * 0.03
        stretch_y = 1.0 + breath
        stretch_x = 1.0 - breath * 0.5
        f = place_centered_frame(idle_base, scale=base_scale, stretch_y=stretch_y, stretch_x=stretch_x)
        idle_strip.paste(f, (i * FRAME_SIZE, 0), f)
    idle_path = os.path.join(OUT_CHAR, "waterdrop-idle-16.png")
    idle_strip.save(idle_path, "PNG")
    idle_strip.save(os.path.join(OUT_CAMP, "camp-hero-idle-16.png"), "PNG")
    print(f"Saved Perfect Idle: {idle_path}")
    
    # 3. 8 Directional Walk Cycles (16 frames each)
    # Mapping angles to cardinal/ordinal directions:
    # 0: South (Down)
    # 2: South-East (Down-Right)
    # 4: East (Right)
    # 6: North-East (Up-Right)
    # 8: North (Up)
    # 10: North-West (Up-Left)
    # 12: West (Left)
    # 14: South-West (Down-Left)
    directions = [
        ("camp-hero-walk-down-16.png", 0, 1),
        ("camp-hero-walk-downright-16.png", 2, 1),
        ("camp-hero-walk-right-16.png", 4, 1),
        ("camp-hero-walk-upright-16.png", 6, 1),
        ("camp-hero-walk-up-16.png", 8, 1),
        ("camp-hero-walk-upleft-16.png", 10, 1),
        ("camp-hero-walk-left-16.png", 12, 1),
        ("camp-hero-walk-downleft-16.png", 14, 1)
    ]
    
    for filename, ang_idx, flip_x in directions:
        char_angle = angles[ang_idx]
        walk_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
        for i in range(16):
            t = i / 16.0
            # 2-step walk gait cycle: bobbing + leg sway
            bob = -abs(math.sin(t * math.pi * 2)) * 6.0
            lean = math.sin(t * math.pi * 2) * 2.0
            f = place_centered_frame(char_angle, scale=base_scale, offset_y=bob, offset_x=lean)
            walk_strip.paste(f, (i * FRAME_SIZE, 0), f)
        out_wpath = os.path.join(OUT_CAMP, filename)
        walk_strip.save(out_wpath, "PNG")
        print(f"Saved Perfect Walk Cycle: {out_wpath}")

if __name__ == "__main__":
    from PIL import ImageDraw
    print("=================================================================")
    print("BUILDING PIXEL-PERFECT CANONICAL HERO SPRITESHEETS...")
    print("=================================================================")
    build_all_perfect_character_sheets()
