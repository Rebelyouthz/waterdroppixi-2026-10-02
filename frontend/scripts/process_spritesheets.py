import os
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

def clean_character_cells(img_path, output_path, rows=4, cols=4, has_header=False, frame_w=128, frame_h=128, tol=28):
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
            
            # Label connected components in the cell mask
            labeled_mask, num_features = label(cell_mask)
            
            if num_features > 0:
                # Find the largest component (the main character body)
                sizes = [np.sum(labeled_mask == i) for i in range(1, num_features + 1)]
                largest_label = np.argmax(sizes) + 1
                
                # Keep main component and any close droplets
                main_mask = (labeled_mask == largest_label)
                
                # Dilate slightly to include outlines & antialiased edges
                from scipy.ndimage import binary_dilation
                dilated_mask = binary_dilation(main_mask, iterations=2)
                
                # Create clean RGBA
                cell_np = np.array(cell_img)
                alpha = np.zeros((cell_h_int := y1 - y0, cell_w_int := x1 - x0), dtype=np.uint8)
                
                # Calculate smooth alpha for pixels inside dilated mask
                cell_diff = np.linalg.norm(cell_np.astype(np.float32) - bg_color, axis=-1)
                smooth_alpha = np.clip((cell_diff - (tol * 0.7)) / (tol * 0.6), 0.0, 1.0) * 255.0
                
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
                    paste_x = (frame_w - scaled_w) // 2
                    paste_y = frame_h - scaled_h - int(frame_h * 0.06)
                    frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
                    frames.append(frame)
                else:
                    frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
            else:
                frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
                
    # Assemble horizontal strip
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
        
    strip.save(output_path, "PNG")
    print(f"Exported {len(frames)} clean isolated frames to {output_path}")

if __name__ == "__main__":
    base_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    clean_character_cells(
        os.path.join(base_dir, "waterdrop_walk_sheet_1787669435014.jpg"),
        os.path.join(out_dir, "waterdrop-walk-16.png"),
        rows=4, cols=4, has_header=False, tol=22
    )
    
    clean_character_cells(
        os.path.join(base_dir, "waterdrop_turnaround_sheet_1787669453143.jpg"),
        os.path.join(out_dir, "waterdrop-turnaround-16.png"),
        rows=4, cols=4, has_header=False, tol=22
    )
    
    clean_character_cells(
        os.path.join(base_dir, "waterdrop_attack_sheet_1787669480658.jpg"),
        os.path.join(out_dir, "waterdrop-attack-16.png"),
        rows=4, cols=4, has_header=True, tol=22
    )
