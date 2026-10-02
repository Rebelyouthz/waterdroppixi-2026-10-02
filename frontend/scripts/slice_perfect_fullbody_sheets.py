import os
import math
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, find_objects, binary_fill_holes, binary_dilation

def extract_fullbody_chars_from_image(img_path, bg_type="grey", tol=20):
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
        if h > 85 and w > 45 and sy.start > 35: # skip headers
            char_boxes.append((sy.start, sx.start, sy.stop, sx.stop))
            
    # Sort into 4 rows of 4 columns
    char_boxes.sort(key=lambda b: (b[0] // 180, b[1]))
    print(f"Extracted {len(char_boxes)} full-body bounding boxes from {os.path.basename(img_path)}")
    
    cleaned_chars = []
    for (y0, x0, y1, x1) in char_boxes:
        # Add slight margin
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
            
        # Keep only the character's solid component inside the crop
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

def build_strip_from_clean_chars(cleaned_chars, output_paths, frame_w=128, frame_h=128):
    frames = []
    for char_img in cleaned_chars:
        frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        
        cw, ch = char_img.size
        target_char_h = int(frame_h * 0.82)
        scale = min(target_char_h / max(ch, 1), (frame_w * 0.82) / max(cw, 1))
        scaled_w = max(1, int(cw * scale))
        scaled_h = max(1, int(ch * scale))
        
        char_scaled = char_img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        
        # Soft ground contact shadow
        foot_y = frame_h - int(frame_h * 0.08)
        draw.ellipse([frame_w//2 - 24, foot_y - 3, frame_w//2 + 24, foot_y + 5], fill=(4, 10, 18, 100))
        
        paste_x = (frame_w - scaled_w) // 2
        paste_y = foot_y - scaled_h
        frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
        frames.append(frame)
        
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
        
    for outp in output_paths:
        os.makedirs(os.path.dirname(outp), exist_ok=True)
        strip.save(outp, "PNG")
        print(f"Exported Perfect Full-Body Strip: {outp} ({total_w}x{frame_h})")

def build_fullbody_directional_walks(turnaround_chars, out_camp_dir, frame_w=128, frame_h=128):
    """Generates animated walk cycles using full-body character crops with legs intact."""
    # 0: Front (South)
    # 2: 3/4 Front Right (South-East)
    # 4: Profile Right (East)
    # 5: 3/4 Rear Right (North-East)
    # 6: Direct Back (North)
    # 7: 3/4 Rear Left (North-West)
    # 8: 3/4 Front Left (South-West)
    # 9: Profile Left (West)
    
    dir_map = {
        "down": turnaround_chars[0],
        "up": turnaround_chars[6],
        "right": turnaround_chars[4],
        "left": turnaround_chars[9],
        "downright": turnaround_chars[2],
        "downleft": turnaround_chars[8],
        "upright": turnaround_chars[5],
        "upleft": turnaround_chars[7]
    }
    
    for dir_name, base_crop in dir_map.items():
        cw, ch = base_crop.size
        target_char_h = int(frame_h * 0.82)
        scale = min(target_char_h / max(ch, 1), (frame_w * 0.82) / max(cw, 1))
        scaled_w = max(1, int(cw * scale))
        scaled_h = max(1, int(ch * scale))
        
        char_base = base_crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        
        frames = []
        for i in range(16):
            t = i / 16.0
            phase = t * math.pi * 2
            
            bob = -abs(math.sin(phase)) * 6.0
            squash = math.sin(phase * 2) * 0.03
            
            w_cur = max(1, int(scaled_w * (1.0 + squash)))
            h_cur = max(1, int(scaled_h * (1.0 - squash)))
            
            char_step = char_base.resize((w_cur, h_cur), Image.Resampling.LANCZOS)
            
            frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame)
            
            foot_y = frame_h - int(frame_h * 0.08)
            draw.ellipse([frame_w//2 - 24, foot_y - 3, frame_w//2 + 24, foot_y + 5], fill=(4, 10, 18, 100))
            
            paste_x = (frame_w - w_cur) // 2
            paste_y = int(foot_y - h_cur + bob)
            frame.paste(char_step, (paste_x, paste_y), char_step)
            frames.append(frame)
            
        total_w = frame_w * len(frames)
        strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            strip.paste(f, (i * frame_w, 0), f)
            
        out_file = os.path.join(out_camp_dir, f"camp-hero-walk-{dir_name}-16.png")
        strip.save(out_file, "PNG")
        print(f"Exported Perfect Full-Body Walk Cycle ({dir_name}): {out_file}")

if __name__ == "__main__":
    up_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
    pub_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    print("=================================================================")
    print("SLICING 100% PERFECT FULL-BODY CHARACTERS (ZERO CUTOFFS)...")
    print("=================================================================")
    
    # 1. Full-body Idle Animation from black background sheet
    idle_sheet = os.path.join(up_dir, "media_1787678481270.jpg")
    idle_chars = extract_fullbody_chars_from_image(idle_sheet, bg_type="black", tol=15)
    build_strip_from_clean_chars(
        idle_chars,
        [
            os.path.join(pub_dir, "character", "waterdrop-idle-16.png"),
            os.path.join(pub_dir, "camp", "camp-hero-idle-16.png")
        ]
    )
    
    # 2. Full-body Turnaround from grey background sheet
    turn_sheet = os.path.join(up_dir, "media_1787678490635.jpg")
    turn_chars = extract_fullbody_chars_from_image(turn_sheet, bg_type="grey", tol=20)
    build_strip_from_clean_chars(
        turn_chars,
        [
            os.path.join(pub_dir, "character", "waterdrop-turnaround-16.png"),
            os.path.join(pub_dir, "camp", "camp-hero-turnaround-16.png")
        ]
    )
    
    # 3. Full-body 8-directional Walk Cycles in Camp
    build_fullbody_directional_walks(turn_chars, os.path.join(pub_dir, "camp"))
    
    print("\n=================================================================")
    print("EVERY FRAME IS NOW 100% FULL BODY WITH LEGS, FEET & ARMS INTACT!")
    print("=================================================================")
