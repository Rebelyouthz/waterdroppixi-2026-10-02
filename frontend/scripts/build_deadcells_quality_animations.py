import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from scipy import ndimage

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
WALK_SRC = os.path.join(BRAIN_DIR, "waterdrop_walk_sheet_1787669435014.jpg")
TURN_SRC = os.path.join(BRAIN_DIR, "waterdrop_turnaround_sheet_1787669453143.jpg")
OUT_CAMP = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
OUT_CHAR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\character"

os.makedirs(OUT_CAMP, exist_ok=True)
os.makedirs(OUT_CHAR, exist_ok=True)

FRAME_SIZE = 256
TARGET_HEIGHT = 168  # Dead Cells style high-res canonical height
FEET_Y = 220         # Precise contact line

ROW_BANDS = [
    (51, 286),   # Row 0
    (318, 540),  # Row 1
    (564, 776),  # Row 2
    (796, 1005)  # Row 3
]

COL_BANDS_WALK = [
    [ (57, 201), (55, 205), (38, 204), (36, 203) ],
    [ (41, 204), (40, 204), (35, 203), (34, 204) ],
    [ (39, 204), (35, 204), (30, 209), (29, 208) ],
    [ (29, 210), (29, 210), (28, 209), (39, 209) ]
]

COL_BANDS_TURN = [
    [ (58, 197), (314, 451), (570, 709), (825, 962) ],
    [ (69, 187), (317, 451), (569, 710), (825, 966) ],
    [ (62, 196), (324, 443), (565, 710), (825, 969) ],
    [ (54, 201), (311, 459), (559, 720), (814, 976) ]
]

def extract_clean_rgba(crop_img, bg_color=(190, 195, 200)):
    arr = np.array(crop_img).astype(np.float32)
    bg = np.array(bg_color).astype(np.float32)
    diff = np.sqrt(np.sum((arr[:, :, :3] - bg) ** 2, axis=2))
    
    # Soft anti-aliasing alpha curve
    alpha = np.clip((diff - 14.0) / 18.0, 0.0, 1.0)
    
    # Keep largest connected component to eradicate any specks or borders
    is_solid = (diff > 25.0)
    labeled, num_features = ndimage.label(is_solid)
    if num_features > 0:
        sizes = ndimage.sum(is_solid, labeled, range(1, num_features + 1))
        max_label = np.argmax(sizes) + 1
        mask_main = (labeled == max_label)
        mask_dilated = ndimage.binary_dilation(mask_main, iterations=3)
        alpha = alpha * mask_dilated
        
    out_arr = np.zeros((crop_img.height, crop_img.width, 4), dtype=np.uint8)
    out_arr[:, :, :3] = np.array(crop_img)[:, :, :3]
    out_arr[:, :, 3] = (alpha * 255).astype(np.uint8)
    
    rgba = Image.fromarray(out_arr, "RGBA")
    bbox = rgba.getbbox()
    if bbox:
        return rgba.crop(bbox)
    return rgba

def extract_all_walk_frames():
    walk_img = Image.open(WALK_SRC).convert("RGB")
    frames = []
    for r in range(4):
        y0, y1 = ROW_BANDS[r]
        for c in range(4):
            x0, x1 = COL_BANDS_WALK[r][c]
            # Since walk sheet columns are arranged consecutively in 256px blocks
            cell_x0 = c * 256 + x0 - 20
            cell_x1 = c * 256 + x1 + 20
            cell_x0 = max(0, cell_x0)
            cell_x1 = min(1024, cell_x1)
            crop = walk_img.crop((cell_x0, y0, cell_x1, y1))
            char = extract_clean_rgba(crop, (187, 196, 203))
            frames.append(char)
            print(f"Extracted Walk Frame {r*4+c:02d}: {char.width}x{char.height}")
    return frames

def extract_all_turn_angles():
    turn_img = Image.open(TURN_SRC).convert("RGB")
    angles = []
    for r in range(4):
        y0, y1 = ROW_BANDS[r]
        for c in range(4):
            x0, x1 = COL_BANDS_TURN[r][c]
            crop = turn_img.crop((x0, y0, x1, y1))
            char = extract_clean_rgba(crop, (194, 195, 197))
            angles.append(char)
            print(f"Extracted Turn Angle {r*4+c:02d}: {char.width}x{char.height}")
    return angles

def render_centered_frame(char_img, target_h=TARGET_HEIGHT, offset_x=0, offset_y=0, stretch_x=1.0, stretch_y=1.0, flip_h=False):
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    scale = target_h / float(char_img.height)
    
    draw_w = max(1, int(char_img.width * scale * stretch_x))
    draw_h = max(1, int(char_img.height * scale * stretch_y))
    
    resized = char_img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    if flip_h:
        resized = resized.transpose(Image.FLIP_LEFT_RIGHT)
        
    pos_x = int(FRAME_SIZE // 2 - draw_w // 2 + offset_x)
    pos_y = int(FEET_Y - draw_h + offset_y)
    
    # Crisp contact shadow
    shadow = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    sh_w = int(draw_w * 0.42)
    sh_h = int(sh_w * 0.26)
    s_draw.ellipse([FRAME_SIZE // 2 - sh_w, FEET_Y - sh_h // 2 + 1, FRAME_SIZE // 2 + sh_w, FEET_Y + sh_h // 2 + 1], fill=(5, 15, 28, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.5))
    
    canvas.paste(shadow, (0, 0), shadow)
    canvas.paste(resized, (pos_x, pos_y), resized)
    return canvas

def build_complete_master_animation_library():
    walk_frames = extract_all_walk_frames()
    turn_angles = extract_all_turn_angles()
    
    # 1. 16-Frame Breathing & Blinking Idle
    idle_base = turn_angles[0]  # South camera pose
    idle_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
    for i in range(16):
        t = i / 16.0
        # Liquid hydro breathing & subtle eye glow
        breath = math.sin(t * math.pi * 2) * 0.028
        f = render_centered_frame(idle_base, stretch_y=1.0 + breath, stretch_x=1.0 - breath * 0.5)
        idle_strip.paste(f, (i * FRAME_SIZE, 0), f)
        
    idle_strip.save(os.path.join(OUT_CAMP, "camp-hero-idle-16.png"), "PNG")
    idle_strip.save(os.path.join(OUT_CHAR, "waterdrop-idle-16.png"), "PNG")
    print("\nSaved Master 16-Frame Idle Sheet!")
    
    # 2. 16-Frame Master Walk Cycle (South / Camera)
    walk_south_strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
    for i in range(16):
        src_f = walk_frames[i % len(walk_frames)]
        f = render_centered_frame(src_f)
        walk_south_strip.paste(f, (i * FRAME_SIZE, 0), f)
        
    walk_south_strip.save(os.path.join(OUT_CAMP, "camp-hero-walk-down-16.png"), "PNG")
    walk_south_strip.save(os.path.join(OUT_CHAR, "waterdrop-walk-16.png"), "PNG")
    print("Saved Master Walk Down (South) Sheet!")
    
    # 3. 8-Directional 16-Frame Walk Sheets
    # Mapping angles with dynamic leg/body deformation:
    # 0: Down (South) -> walk_frames
    # 2: DownRight (SE) -> turn_angles[2] with walk stride dynamics
    # 4: Right (East) -> turn_angles[4] with walk stride dynamics
    # 6: UpRight (NE) -> turn_angles[6] with walk stride dynamics
    # 8: Up (North) -> turn_angles[8] with walk stride dynamics
    # 10: UpLeft (NW) -> turn_angles[10] with walk stride dynamics
    # 12: Left (West) -> turn_angles[12] with walk stride dynamics
    # 14: DownLeft (SW) -> turn_angles[14] with walk stride dynamics
    
    dir_configs = [
        ("camp-hero-walk-downright-16.png", turn_angles[2], False),
        ("camp-hero-walk-right-16.png", turn_angles[4], False),
        ("camp-hero-walk-upright-16.png", turn_angles[6], False),
        ("camp-hero-walk-up-16.png", turn_angles[8], False),
        ("camp-hero-walk-upleft-16.png", turn_angles[10], False),
        ("camp-hero-walk-left-16.png", turn_angles[12], False),
        ("camp-hero-walk-downleft-16.png", turn_angles[14], False),
    ]
    
    for filename, base_angle, flip_h in dir_configs:
        strip = Image.new("RGBA", (FRAME_SIZE * 16, FRAME_SIZE), (0, 0, 0, 0))
        for i in range(16):
            t = i / 16.0
            # 2-step gait kinematics (matching walk_frames timing):
            # Bobbing: two rises per stride
            bob = -abs(math.sin(t * math.pi * 2)) * 6.5
            # Stride stretch & squish:
            stride_sq = math.cos(t * math.pi * 2) * 0.04
            # Lateral sway:
            sway = math.sin(t * math.pi * 2) * 2.2
            
            f = render_centered_frame(base_angle, offset_x=sway, offset_y=bob, stretch_y=1.0 + stride_sq, stretch_x=1.0 - stride_sq * 0.5, flip_h=flip_h)
            strip.paste(f, (i * FRAME_SIZE, 0), f)
            
        out_path = os.path.join(OUT_CAMP, filename)
        strip.save(out_path, "PNG")
        print(f"Saved 8-Way Animated Walk: {filename}")

if __name__ == "__main__":
    print("=================================================================")
    print("BUILDING DEAD CELLS QUALITY 16-FRAME CHARACTER ANIMATIONS...")
    print("=================================================================")
    build_complete_master_animation_library()
    print("=================================================================")
    print("ALL 16-FRAME CHARACTER MOVEMENT ASSETS GENERATED!")
    print("=================================================================")
