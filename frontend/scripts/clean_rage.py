import os
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation

def clean_rage_sheet():
    base_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
    out_root = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    rage_src = os.path.join(base_dir, "waterdrop_rage_sheet_1787670605158.jpg")
    img = Image.open(rage_src).convert("RGB")
    W, H = img.size
    
    # Custom y row ranges matching the visual grid
    row_ranges = [
        (80, 310),
        (320, 550),
        (555, 785),
        (790, 1015),
    ]
    col_w = W / 4.0
    
    frames = []
    FW, FH = 128, 128
    
    for r_idx, (y0, y1) in enumerate(row_ranges):
        for c_idx in range(4):
            x0 = int(c_idx * col_w + col_w * 0.03)
            x1 = int((c_idx + 1) * col_w - col_w * 0.03)
            
            cell = img.crop((x0, y0, x1, y1))
            data = np.array(cell, dtype=np.float32)
            
            r_ch, g_ch, b_ch = data[:, :, 0], data[:, :, 1], data[:, :, 2]
            max_c = np.maximum(np.maximum(r_ch, g_ch), b_ch)
            min_c = np.minimum(np.minimum(r_ch, g_ch), b_ch)
            sat = (max_c - min_c) / (max_c + 1e-5)
            
            dist_slate = np.sqrt((r_ch - 170)**2 + (g_ch - 180)**2 + (b_ch - 190)**2)
            is_bg = (dist_slate < 45) | ((sat < 0.14) & (max_c > 80))
            fg_mask = ~is_bg
            alpha = np.where(fg_mask, 255.0, 0.0)
            
            labeled, num_features = label(fg_mask)
            if num_features > 0:
                sizes = [np.sum(labeled == i) for i in range(1, num_features + 1)]
                largest_label = np.argmax(sizes) + 1
                main_mask = (labeled == largest_label)
                
                ch_center = np.array([data.shape[0] / 2, data.shape[1] / 2])
                for idx, size in enumerate(sizes):
                    if idx + 1 == largest_label: continue
                    if size > 15:
                        coords = np.argwhere(labeled == (idx + 1))
                        comp_center = np.mean(coords, axis=0)
                        if np.linalg.norm(comp_center - ch_center) < (cell.size[1] * 0.44):
                            main_mask |= (labeled == (idx + 1))

                dilated = binary_dilation(main_mask, iterations=1)
                final_a = np.zeros(data.shape[:2], dtype=np.uint8)
                final_a[dilated] = alpha[dilated].astype(np.uint8)
                
                rgba = np.dstack([data[:, :, :3].astype(np.uint8), final_a])
                cell_clean = Image.fromarray(rgba, "RGBA")
                bbox = cell_clean.getbbox()
                if bbox:
                    cropped = cell_clean.crop(bbox)
                    cw, ch = cropped.size
                    target_h = int(FH * 0.82)
                    scale = target_h / max(ch, 1)
                    sw = max(1, int(cw * scale))
                    sh = max(1, int(ch * scale))
                    scaled = cropped.resize((sw, sh), Image.Resampling.LANCZOS)
                    
                    frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
                    px = (FW - sw) // 2
                    py = FH - sh - int(FH * 0.06)
                    frame.paste(scaled, (px, py), scaled)
                    frames.append(frame)
                else:
                    frames.append(Image.new("RGBA", (FW, FH), (0, 0, 0, 0)))
            else:
                frames.append(Image.new("RGBA", (FW, FH), (0, 0, 0, 0)))
                
    strip = Image.new("RGBA", (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * FW, 0), f)
        
    out_path = os.path.join(out_root, "rage_expressions", "waterdrop-rage-states-16.png")
    strip.save(out_path, "PNG")
    print(f"Rage sheet re-exported cleanly to {out_path}")

if __name__ == "__main__":
    clean_rage_sheet()
