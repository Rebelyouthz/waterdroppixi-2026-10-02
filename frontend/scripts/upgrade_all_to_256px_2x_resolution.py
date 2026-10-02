import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import label, find_objects, binary_fill_holes, binary_dilation

FW2X, FH2X = 256, 256
FOOT_Y_2X = 224

# =============================================================================
# 1. 2X RESOLUTION SLICER FOR USER'S RAW ARTWORK (IDLE & TURNAROUND)
# =============================================================================

def extract_fullbody_chars_2x(img_path, bg_type="grey", tol=20):
    img = Image.open(img_path).convert("RGB")
    arr = np.array(img, dtype=np.float32)
    
    if bg_type == "black":
        bg_col = np.array([0, 0, 0], dtype=np.float32)
        diff = np.linalg.norm(arr[:, :, :3] - bg_col, axis=-1)
        fg_mask = diff > 15
    else:
        corners = [arr[5, 5, :3], arr[5, -5, :3], arr[-5, 5, :3], arr[-5, -5, :3]]
        bg_col = np.mean(corners, axis=0)
        diff = np.linalg.norm(arr[:, :, :3] - bg_col, axis=-1)
        fg_mask = diff > tol
        
    labeled, num_features = label(fg_mask)
    objects = find_objects(labeled)
    
    char_boxes = []
    for sl in objects:
        if sl is None:
            continue
        sy, sx = sl
        h = sy.stop - sy.start
        w = sx.stop - sx.start
        if h > 85 and w > 45 and sy.start > 35:
            char_boxes.append((sy.start, sx.start, sy.stop, sx.stop))
            
    char_boxes.sort(key=lambda b: (b[0] // 180, b[1]))
    
    cleaned_chars = []
    for (y0, x0, y1, x1) in char_boxes:
        pad = 2
        cy0 = max(0, y0 - pad)
        cx0 = max(0, x0 - pad)
        cy1 = min(img.height, y1 + pad)
        cx1 = min(img.width, x1 + pad)
        
        crop_rgb = img.crop((cx0, cy0, cx1, cy1))
        crop_arr = np.array(crop_rgb, dtype=np.float32)
        
        if bg_type == "black":
            c_dist = np.linalg.norm(crop_arr[:, :, :3], axis=-1)
            alpha = np.clip((c_dist - 14.0) / 16.0, 0.0, 1.0) * 255.0
        else:
            c_dist = np.linalg.norm(crop_arr[:, :, :3] - bg_col, axis=-1)
            alpha = np.clip((c_dist - (tol * 0.75)) / (tol * 0.5), 0.0, 1.0) * 255.0
            
        mask_local = alpha > 20
        mask_local = binary_fill_holes(mask_local)
        mask_local = binary_dilation(mask_local, iterations=1)
        alpha[~mask_local] = 0
        
        rgba = np.dstack([crop_arr[:, :, :3].astype(np.uint8), alpha.astype(np.uint8)])
        clean_crop = Image.fromarray(rgba, "RGBA")
        
        bbox = clean_crop.getbbox()
        if bbox:
            cleaned_chars.append(clean_crop.crop(bbox))
        else:
            cleaned_chars.append(clean_crop)
            
    return cleaned_chars

def build_strip_2x(cleaned_chars, output_paths):
    frames = []
    for char_img in cleaned_chars:
        frame = Image.new("RGBA", (FW2X, FH2X), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        
        cw, ch = char_img.size
        target_char_h = int(FH2X * 0.82)
        scale = min(target_char_h / max(ch, 1), (FW2X * 0.82) / max(cw, 1))
        scaled_w = max(1, int(cw * scale))
        scaled_h = max(1, int(ch * scale))
        
        char_scaled = char_img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        
        # Soft ground contact shadow (2X resolution)
        draw.ellipse([FW2X//2 - 48, FOOT_Y_2X - 6, FW2X//2 + 48, FOOT_Y_2X + 10], fill=(4, 10, 18, 100))
        
        paste_x = (FW2X - scaled_w) // 2
        paste_y = FOOT_Y_2X - scaled_h
        frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
        frames.append(frame)
        
    total_w = FW2X * len(frames)
    strip = Image.new("RGBA", (total_w, FH2X), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * FW2X, 0), f)
        
    for outp in output_paths:
        os.makedirs(os.path.dirname(outp), exist_ok=True)
        strip.save(outp, "PNG")
        print(f"Exported 2X Resolution Strip (256x256): {outp} ({total_w}x{FH2X})")

def build_directional_walks_2x(turn_chars, out_camp_dir):
    dir_map = {
        "down": turn_chars[0],
        "up": turn_chars[6],
        "right": turn_chars[4],
        "left": turn_chars[9],
        "downright": turn_chars[2],
        "downleft": turn_chars[8],
        "upright": turn_chars[5],
        "upleft": turn_chars[7]
    }
    
    for dir_name, base_crop in dir_map.items():
        cw, ch = base_crop.size
        target_char_h = int(FH2X * 0.82)
        scale = min(target_char_h / max(ch, 1), (FW2X * 0.82) / max(cw, 1))
        scaled_w = max(1, int(cw * scale))
        scaled_h = max(1, int(ch * scale))
        
        char_base = base_crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        
        frames = []
        for i in range(16):
            t = i / 16.0
            phase = t * math.pi * 2
            
            bob = -abs(math.sin(phase)) * 12.0
            squash = math.sin(phase * 2) * 0.03
            
            w_cur = max(1, int(scaled_w * (1.0 + squash)))
            h_cur = max(1, int(scaled_h * (1.0 - squash)))
            
            char_step = char_base.resize((w_cur, h_cur), Image.Resampling.LANCZOS)
            
            frame = Image.new("RGBA", (FW2X, FH2X), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame)
            
            draw.ellipse([FW2X//2 - 48, FOOT_Y_2X - 6, FW2X//2 + 48, FOOT_Y_2X + 10], fill=(4, 10, 18, 100))
            
            paste_x = (FW2X - w_cur) // 2
            paste_y = int(FOOT_Y_2X - h_cur + bob)
            frame.paste(char_step, (paste_x, paste_y), char_step)
            frames.append(frame)
            
        total_w = FW2X * len(frames)
        strip = Image.new("RGBA", (total_w, FH2X), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            strip.paste(f, (i * FW2X, 0), f)
            
        out_file = os.path.join(out_camp_dir, f"camp-hero-walk-{dir_name}-16.png")
        strip.save(out_file, "PNG")
        print(f"Exported 2X Resolution Walk Cycle ({dir_name}): {out_file}")

# =============================================================================
# 2. 2X RESOLUTION STATION MODULES (256x256)
# =============================================================================

from build_luxurious_camp_assets import (
    render_aida_core_frame, render_forge_frame,
    render_biolab_frame, render_well_frame, render_navigation_frame
)

def build_station_modules_2x(out_camp_dir):
    stations = [
        ("camp-core-aida-16.png", render_aida_core_frame),
        ("camp-station-forge-16.png", render_forge_frame),
        ("camp-station-biolab-16.png", render_biolab_frame),
        ("camp-station-well-16.png", render_well_frame),
        ("camp-station-navigation-16.png", render_navigation_frame),
    ]
    
    num_frames = 16
    for filename, render_func in stations:
        strip = Image.new("RGBA", (FW2X * num_frames, FH2X), (0, 0, 0, 0))
        for i in range(num_frames):
            t = i / float(num_frames)
            # Render at 512 and downsample to 256 for supreme antialiased sharpness
            hi_frame = render_func(t, fw=512, fh=512)
            f2x = hi_frame.resize((FW2X, FH2X), Image.Resampling.LANCZOS)
            strip.paste(f2x, (i * FW2X, 0), f2x)
            
        out_path = os.path.join(out_camp_dir, filename)
        strip.save(out_path, "PNG")
        print(f"Exported 2X Station Module: {out_path} ({FW2X * num_frames}x{FH2X})")

# =============================================================================
# MASTER EXECUTION
# =============================================================================

if __name__ == "__main__":
    up_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
    pub_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    camp_dir = os.path.join(pub_dir, "camp")
    
    print("=================================================================")
    print("UPGRADING ENTIRE ASSET SYSTEM TO 2X RETINA HD (256x256 PER FRAME)...")
    print("=================================================================")
    
    # 1. Slice User Idle Sheet at 256x256
    idle_sheet = os.path.join(up_dir, "media_1787678481270.jpg")
    idle_chars = extract_fullbody_chars_2x(idle_sheet, bg_type="black", tol=15)
    build_strip_2x(
        idle_chars,
        [
            os.path.join(pub_dir, "character", "waterdrop-idle-16.png"),
            os.path.join(camp_dir, "camp-hero-idle-16.png")
        ]
    )
    
    # 2. Slice User Turnaround Sheet at 256x256
    turn_sheet = os.path.join(up_dir, "media_1787678490635.jpg")
    turn_chars = extract_fullbody_chars_2x(turn_sheet, bg_type="grey", tol=20)
    build_strip_2x(
        turn_chars,
        [
            os.path.join(pub_dir, "character", "waterdrop-turnaround-16.png"),
            os.path.join(camp_dir, "camp-hero-turnaround-16.png")
        ]
    )
    
    # 3. Build 2x 8-Directional Camp Walks
    build_directional_walks_2x(turn_chars, camp_dir)
    
    # 4. Build 2x Station Modules
    build_station_modules_2x(camp_dir)
    
    # 5. Update Manifest to 256x256
    manifest_path = os.path.join(pub_dir, "manifest.json")
    with open(manifest_path, "r") as f:
        data = json.load(f)
    data["frameWidth"] = 256
    data["frameHeight"] = 256
    with open(manifest_path, "w") as f:
        json.dump(data, f, indent=2)
        
    print("\n=================================================================")
    print("ALL ASSETS SUCCESSFULLY UPGRADED TO 2X RETINA HD (256x256)!")
    print("=================================================================")
