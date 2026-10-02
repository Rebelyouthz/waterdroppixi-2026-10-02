import os
import json
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation

def is_background_pixel(r, g, b, bg_mode="gray"):
    if bg_mode == "black":
        return (r < 30) and (g < 30) and (b < 30)
    # Gray background detector: low saturation (r, g, b are close to each other)
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    saturation = (max_c - min_c) / (max_c + 1e-5)
    
    # Also check if it's near the slate gray grid color ~ [165, 175, 185]
    dist_slate = ((r - 170)**2 + (g - 180)**2 + (b - 190)**2)**0.5
    if dist_slate < 55:
        return True
    if saturation < 0.14 and max_c > 80:
        return True
    return False

def extract_and_clean_frames(
    img_path,
    rows=4,
    cols=4,
    top_offset_pct=0.0,
    bg_mode="gray",
    frame_w=128,
    frame_h=128
):
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    
    top_offset = int(H * top_offset_pct)
    grid_h = H - top_offset
    cell_w = W / cols
    cell_h = grid_h / rows
    
    frames = []
    
    for r in range(rows):
        for c in range(cols):
            x0 = int(c * cell_w + cell_w * 0.02)
            y0 = int(top_offset + r * cell_h + cell_h * 0.02)
            x1 = int((c + 1) * cell_w - cell_w * 0.02)
            y1 = int(top_offset + (r + 1) * cell_h - cell_h * 0.02)
            
            cell_img = img.crop((x0, y0, x1, y1))
            data = np.array(cell_img, dtype=np.float32)
            
            # Compute alpha mask using chromaticity & saturation
            r_ch, g_ch, b_ch = data[:, :, 0], data[:, :, 1], data[:, :, 2]
            max_c = np.maximum(np.maximum(r_ch, g_ch), b_ch)
            min_c = np.minimum(np.minimum(r_ch, g_ch), b_ch)
            sat = (max_c - min_c) / (max_c + 1e-5)
            
            if bg_mode == "black":
                diff = np.linalg.norm(data[:, :, :3], axis=-1)
                fg_mask = diff > 22
                alpha = np.clip((diff - 16) / 20.0, 0.0, 1.0) * 255.0
            else:
                dist_slate = np.sqrt((r_ch - 170)**2 + (g_ch - 180)**2 + (b_ch - 190)**2)
                is_bg = (dist_slate < 45) | ((sat < 0.13) & (max_c > 85))
                fg_mask = ~is_bg
                alpha = np.where(fg_mask, 255.0, 0.0)

            labeled_mask, num_features = label(fg_mask)
            
            if num_features > 0:
                sizes = [np.sum(labeled_mask == i) for i in range(1, num_features + 1)]
                largest_label = np.argmax(sizes) + 1
                main_mask = (labeled_mask == largest_label)
                
                # Keep nearby particles/aura
                ch_center = np.array([data.shape[0] / 2, data.shape[1] / 2])
                for idx, size in enumerate(sizes):
                    if idx + 1 == largest_label:
                        continue
                    if size > 15:
                        coords = np.argwhere(labeled_mask == (idx + 1))
                        comp_center = np.mean(coords, axis=0)
                        if np.linalg.norm(comp_center - ch_center) < (cell_h * 0.46):
                            main_mask |= (labeled_mask == (idx + 1))

                dilated = binary_dilation(main_mask, iterations=1)
                
                final_alpha = np.zeros(data.shape[:2], dtype=np.uint8)
                final_alpha[dilated] = alpha[dilated].astype(np.uint8)
                
                # Clean ground shadow at very bottom
                for y in range(int(data.shape[0] * 0.88), data.shape[0]):
                    for x in range(data.shape[1]):
                        if sat[y, x] < 0.15 and max_c[y, x] < 70:
                            final_alpha[y, x] = 0

                rgba = np.dstack([data[:, :, :3].astype(np.uint8), final_alpha])
                cell_clean = Image.fromarray(rgba, "RGBA")
                
                bbox = cell_clean.getbbox()
                if bbox:
                    cropped = cell_clean.crop(bbox)
                    cw, ch = cropped.size
                    
                    target_h = int(frame_h * 0.82)
                    scale = target_h / max(ch, 1)
                    sw = max(1, int(cw * scale))
                    sh = max(1, int(ch * scale))
                    
                    scaled = cropped.resize((sw, sh), Image.Resampling.LANCZOS)
                    
                    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
                    px = (frame_w - sw) // 2
                    py = frame_h - sh - int(frame_h * 0.06)
                    frame.paste(scaled, (px, py), scaled)
                    frames.append(frame)
                else:
                    frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
            else:
                frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
                
    return frames

def save_strip(frames, output_path, frame_w=128, frame_h=128):
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
    strip.save(output_path, "PNG")
    print(f"Saved {output_path} ({total_w}x{frame_h}) with {len(frames)} frames.")

if __name__ == "__main__":
    base_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    os.makedirs(out_dir, exist_ok=True)
    
    FW, FH = 128, 128
    manifest = {
        "frameWidth": FW,
        "frameHeight": FH,
        "animations": {}
    }
    
    # 1. Idle Strip
    idle_src = os.path.join(base_dir, ".user_uploaded", "media_1787669403784.jpg")
    if os.path.exists(idle_src):
        idle_frames = extract_and_clean_frames(idle_src, rows=4, cols=4, top_offset_pct=0.088, bg_mode="black", frame_w=FW, frame_h=FH)
        save_strip(idle_frames, os.path.join(out_dir, "waterdrop-idle-16.png"), frame_w=FW, frame_h=FH)
        manifest["animations"]["idle"] = { "file": "sprites/waterdrop-idle-16.png", "frames": len(idle_frames), "fps": 12, "loop": True }
        
    # 2. Walk Strip
    walk_src = os.path.join(base_dir, "waterdrop_walk_sheet_1787669435014.jpg")
    if os.path.exists(walk_src):
        walk_frames = extract_and_clean_frames(walk_src, rows=4, cols=4, top_offset_pct=0.0, bg_mode="gray", frame_w=FW, frame_h=FH)
        save_strip(walk_frames, os.path.join(out_dir, "waterdrop-walk-16.png"), frame_w=FW, frame_h=FH)
        manifest["animations"]["walk"] = { "file": "sprites/waterdrop-walk-16.png", "frames": len(walk_frames), "fps": 16, "loop": True }
        
    # 3. Turnaround Strip
    turn_src = os.path.join(base_dir, "waterdrop_turnaround_sheet_1787669453143.jpg")
    if os.path.exists(turn_src):
        turn_frames = extract_and_clean_frames(turn_src, rows=4, cols=4, top_offset_pct=0.0, bg_mode="gray", frame_w=FW, frame_h=FH)
        save_strip(turn_frames, os.path.join(out_dir, "waterdrop-turnaround-16.png"), frame_w=FW, frame_h=FH)
        manifest["animations"]["turnaround"] = { "file": "sprites/waterdrop-turnaround-16.png", "frames": len(turn_frames), "fps": 10, "loop": True }
        
    # 4. Attack Strip
    atk_src = os.path.join(base_dir, "waterdrop_attack_sheet_1787669480658.jpg")
    if os.path.exists(atk_src):
        atk_frames = extract_and_clean_frames(atk_src, rows=4, cols=4, top_offset_pct=0.088, bg_mode="gray", frame_w=FW, frame_h=FH)
        save_strip(atk_frames, os.path.join(out_dir, "waterdrop-attack-16.png"), frame_w=FW, frame_h=FH)
        manifest["animations"]["attack"] = { "file": "sprites/waterdrop-attack-16.png", "frames": len(atk_frames), "fps": 20, "loop": False }

    # 5. Cheer Strip
    cheer_src = os.path.join(base_dir, "waterdrop_cheer_sheet_1787669646098.jpg")
    if os.path.exists(cheer_src):
        cheer_frames = extract_and_clean_frames(cheer_src, rows=4, cols=4, top_offset_pct=0.088, bg_mode="gray", frame_w=FW, frame_h=FH)
        save_strip(cheer_frames, os.path.join(out_dir, "waterdrop-cheer-16.png"), frame_w=FW, frame_h=FH)
        manifest["animations"]["cheer"] = { "file": "sprites/waterdrop-cheer-16.png", "frames": len(cheer_frames), "fps": 14, "loop": False }
        
    manifest_path = os.path.join(out_dir, "waterdrop-sprites.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest written to {manifest_path}")
