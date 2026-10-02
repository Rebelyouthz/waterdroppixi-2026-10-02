import os
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_fill_holes, binary_dilation

def clean_cell_perfect(cell_img, tol=28):
    """Cleanly isolates character from background using cell-border sampling and floodfill contour."""
    arr = np.array(cell_img, dtype=np.float32)
    h, w, _ = arr.shape
    
    # Sample background color directly from the border of this specific cell
    border_pixels = np.concatenate([
        arr[0:4, :, :3].reshape(-1, 3),
        arr[-4:, :, :3].reshape(-1, 3),
        arr[:, 0:4, :3].reshape(-1, 3),
        arr[:, -4:, :3].reshape(-1, 3)
    ], axis=0)
    bg_col = np.median(border_pixels, axis=0)
    
    # Distance from cell background
    dist = np.linalg.norm(arr[:, :, :3] - bg_col, axis=-1)
    
    # Foreground mask
    fg_mask = dist > tol
    
    # Connected component / hole fill to keep character solid
    from scipy.ndimage import label
    labeled, num_feat = label(fg_mask)
    if num_feat == 0:
        return Image.new("RGBA", (w, h), (0, 0, 0, 0))
        
    sizes = [np.sum(labeled == i) for i in range(1, num_feat + 1)]
    largest_label = np.argmax(sizes) + 1
    char_mask = (labeled == largest_label)
    
    # Also include any nearby blast effects/particles
    for i in range(1, num_feat + 1):
        if i != largest_label and sizes[i - 1] > 25:
            char_mask |= (labeled == i)
            
    char_mask = binary_fill_holes(char_mask)
    char_mask = binary_dilation(char_mask, iterations=1)
    
    # Anti-aliased alpha falloff
    alpha = np.clip((dist - (tol * 0.7)) / (tol * 0.5), 0.0, 1.0) * 255.0
    alpha[~char_mask] = 0.0
    
    rgba = np.dstack([arr[:, :, :3].astype(np.uint8), alpha.astype(np.uint8)])
    cell_rgba = Image.fromarray(rgba, "RGBA")
    
    bbox = cell_rgba.getbbox()
    if bbox:
        return cell_rgba.crop(bbox)
    return cell_rgba

def process_perfect_sheet(img_path, output_path, rows=4, cols=4, has_header=False, frame_w=128, frame_h=128, tol=24):
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    
    top_offset = int(H * 0.088) if has_header else 0
    grid_h = H - top_offset
    cell_w = W / cols
    cell_h = grid_h / rows
    
    frames = []
    
    for r in range(rows):
        for c in range(cols):
            x0 = int(c * cell_w)
            y0 = int(top_offset + r * cell_h)
            x1 = int((c + 1) * cell_w)
            y1 = int(top_offset + (r + 1) * cell_h)
            
            # Crop slightly inset from grid lines
            margin = 3
            cell = img.crop((x0 + margin, y0 + margin, x1 - margin, y1 - margin))
            clean_char = clean_cell_perfect(cell, tol=tol)
            
            bbox = clean_char.getbbox()
            frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame)
            
            if bbox:
                cw, ch = clean_char.size
                scale = min((frame_h * 0.82) / ch, (frame_w * 0.82) / cw)
                scaled_w = max(1, int(cw * scale))
                scaled_h = max(1, int(ch * scale))
                char_scaled = clean_char.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                
                # Ground shadow
                foot_y = frame_h - int(frame_h * 0.08)
                draw.ellipse([frame_w//2 - 24, foot_y - 2, frame_w//2 + 24, foot_y + 6], fill=(4, 10, 18, 90))
                
                paste_x = (frame_w - scaled_w) // 2
                paste_y = foot_y - scaled_h
                frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
                
            frames.append(frame)
            
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, "PNG")
    print(f"Exported 100% Background-Free Strip: {output_path} ({total_w}x{frame_h})")

if __name__ == "__main__":
    base_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
    uploaded_dir = os.path.join(base_dir, ".user_uploaded")
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    # 1. Rapid Attacks
    process_perfect_sheet(
        os.path.join(uploaded_dir, "media_1787676868867.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-rapid-attacks-16.png"),
        has_header=True, tol=22
    )
    
    # 2. Turnaround 16 angles
    process_perfect_sheet(
        os.path.join(uploaded_dir, "media_1787676858429.jpg"),
        os.path.join(out_dir, "character", "waterdrop-turnaround-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(uploaded_dir, "media_1787676858429.jpg"),
        os.path.join(out_dir, "camp", "camp-hero-turnaround-16.png"),
        has_header=False, tol=22
    )
    
    # 3. Walk
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_walk_sheet_1787669435014.jpg"),
        os.path.join(out_dir, "character", "waterdrop-walk-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_walk_sheet_1787669435014.jpg"),
        os.path.join(out_dir, "camp", "camp-hero-walk-16.png"),
        has_header=False, tol=22
    )
    
    # 4. Run, Roll, Hurt, Levelup, Katana, Bow, Scythe, Attack
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_run_sheet_1787670517398.jpg"),
        os.path.join(out_dir, "character", "waterdrop-run-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_dash_roll_sheet_1787670536566.jpg"),
        os.path.join(out_dir, "character", "waterdrop-roll-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_hurt_sheet_1787670665365.jpg"),
        os.path.join(out_dir, "character", "waterdrop-hurt-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_cheer_sheet_1787669646098.jpg"),
        os.path.join(out_dir, "character", "waterdrop-levelup-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_attack_sheet_1787669480658.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-attack-16.png"),
        has_header=True, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_katana_slash_sheet_1787670554745.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-katana-slash-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_katana_finisher_sheet_1787670586111.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-katana-finisher-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_bow_shoot_sheet_1787670626249.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-bow-shoot-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_scythe_spin_sheet_1787670644724.jpg"),
        os.path.join(out_dir, "combat", "waterdrop-scythe-spin-16.png"),
        has_header=False, tol=22
    )
    process_perfect_sheet(
        os.path.join(base_dir, "waterdrop_rage_sheet_1787670605158.jpg"),
        os.path.join(out_dir, "rage_expressions", "waterdrop-rage-states-16.png"),
        has_header=False, tol=22
    )
