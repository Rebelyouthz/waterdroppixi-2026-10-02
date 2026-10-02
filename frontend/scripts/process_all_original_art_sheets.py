import os
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation

def process_single_sheet(img_path, output_path, rows=4, cols=4, has_header=False, frame_w=128, frame_h=128, tol=24):
    if not os.path.exists(img_path):
        print(f"Skipping missing: {img_path}")
        return
        
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    
    top_offset = 0
    if has_header:
        top_offset = int(H * 0.085)
        
    grid_h = H - top_offset
    cell_w = W / cols
    cell_h = grid_h / rows
    
    data = np.array(img, dtype=np.float32)
    corners = [data[5, 5, :3], data[5, -5, :3], data[-5, 5, :3], data[-5, -5, :3]]
    bg_color = np.mean(corners, axis=0)
    
    diff = np.linalg.norm(data - bg_color, axis=-1)
    fg_mask = diff > tol
    
    frames = []
    
    for r in range(rows):
        for c in range(cols):
            x0 = int(c * cell_w)
            y0 = int(top_offset + r * cell_h)
            x1 = int((c + 1) * cell_w)
            y1 = int(top_offset + (r + 1) * cell_h)
            
            cell_img = img.crop((x0, y0, x1, y1))
            cell_mask = fg_mask[y0:y1, x0:x1]
            
            labeled_mask, num_features = label(cell_mask)
            
            if num_features > 0:
                sizes = [np.sum(labeled_mask == i) for i in range(1, num_features + 1)]
                largest_label = np.argmax(sizes) + 1
                main_mask = (labeled_mask == largest_label)
                dilated_mask = binary_dilation(main_mask, iterations=2)
                
                cell_np = np.array(cell_img)
                cell_diff = np.linalg.norm(cell_np.astype(np.float32) - bg_color, axis=-1)
                smooth_alpha = np.clip((cell_diff - (tol * 0.7)) / (tol * 0.6), 0.0, 1.0) * 255.0
                
                alpha = np.zeros((y1 - y0, x1 - x0), dtype=np.uint8)
                alpha[dilated_mask] = smooth_alpha[dilated_mask].astype(np.uint8)
                
                rgba = np.dstack([cell_np, alpha])
                cell_clean = Image.fromarray(rgba, "RGBA")
                
                bbox = cell_clean.getbbox()
                if bbox:
                    char_crop = cell_clean.crop(bbox)
                    cw, ch = char_crop.size
                    
                    target_char_h = int(frame_h * 0.82)
                    scale = target_char_h / max(ch, 1)
                    scaled_w = max(1, int(cw * scale))
                    scaled_h = max(1, int(ch * scale))
                    
                    char_scaled = char_crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                    
                    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
                    
                    # Soft contact shadow
                    foot_y = frame_h - int(frame_h * 0.06)
                    draw_temp = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
                    from PIL import ImageDraw
                    d = ImageDraw.Draw(draw_temp)
                    d.ellipse([frame_w//2 - 24, foot_y - 3, frame_w//2 + 24, foot_y + 5], fill=(4, 10, 18, 90))
                    frame = Image.alpha_composite(frame, draw_temp)
                    
                    paste_x = (frame_w - scaled_w) // 2
                    paste_y = foot_y - scaled_h
                    frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
                    frames.append(frame)
                else:
                    frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
            else:
                frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
                
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, "PNG")
    print(f"Exported clean high-res art strip: {output_path} ({total_w}x{frame_h})")

if __name__ == "__main__":
    base_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
    uploaded_dir = os.path.join(base_dir, ".user_uploaded")
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    print("=================================================================")
    print("PROCESSING ALL ORIGINAL HIGH-RES ARTWORK SPRITESHEETS...")
    print("=================================================================")
    
    # 1. Core Hero Cycles
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_walk_sheet_1787669435014.jpg"),
        os.path.join(out_dir, "character", "waterdrop-walk-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_run_sheet_1787670517398.jpg"),
        os.path.join(out_dir, "character", "waterdrop-run-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_dash_roll_sheet_1787670536566.jpg"),
        os.path.join(out_dir, "character", "waterdrop-roll-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_hurt_sheet_1787670665365.jpg"),
        os.path.join(out_dir, "character", "waterdrop-hurt-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_cheer_sheet_1787669646098.jpg"),
        os.path.join(out_dir, "character", "waterdrop-levelup-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(uploaded_dir, "media_1787676858429.jpg"),
        os.path.join(out_dir, "character", "waterdrop-turnaround-16.png"),
        has_header=False, tol=25
    )
    
    # 2. Combat & Weapons
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_attack_sheet_1787669480658.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-attack-16.png"),
        has_header=True, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_katana_slash_sheet_1787670554745.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-katana-slash-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_katana_finisher_sheet_1787670586111.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-katana-finisher-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_bow_shoot_sheet_1787670626249.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-bow-shoot-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_scythe_spin_sheet_1787670644724.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-scythe-spin-16.png"),
        has_header=False, tol=22
    )
    process_single_sheet(
        os.path.join(uploaded_dir, "media_1787676868867.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-rapid-attacks-16.png"),
        has_header=True, tol=25
    )
    
    # 3. Rage Expressions
    process_single_sheet(
        os.path.join(base_dir, "waterdrop_rage_sheet_1787670605158.jpg"),
        os.path.join(out_dir, "rage_expressions", "waterdrop-rage-states-16.png"),
        has_header=False, tol=22
    )
    
    # 4. Also copy the canonical walk and idle to camp/
    import shutil
    shutil.copyfile(
        os.path.join(out_dir, "character", "waterdrop-walk-16.png"),
        os.path.join(out_dir, "camp", "camp-hero-walk-16.png")
    )
    shutil.copyfile(
        os.path.join(out_dir, "character", "waterdrop-turnaround-16.png"),
        os.path.join(out_dir, "camp", "camp-hero-turnaround-16.png")
    )
    
    print("\n=================================================================")
    print("ALL ORIGINAL HIGH-RES ARTWORK SHEETS PROCESSED & READY ON DISK!")
    print("=================================================================")
