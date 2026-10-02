import os
import numpy as np
from PIL import Image, ImageDraw

def extract_and_clean_grid(img_path, rows=4, cols=4, bg_color=(194, 195, 197), tol=28, target_size=(128, 128), anchor_y=112):
    img = Image.open(img_path).convert("RGBA")
    w, h = img.size
    cell_w, cell_h = w // cols, h // rows
    
    extracted_frames = []
    
    for r in range(rows):
        for c in range(cols):
            x0 = c * cell_w
            y0 = r * cell_h
            x1 = x0 + cell_w
            y1 = y0 + cell_h
            
            cell = img.crop((x0, y0, x1, y1))
            arr = np.array(cell, dtype=np.float32)
            
            # Distance from background color
            dist = np.sqrt(np.sum((arr[:, :, :3] - np.array(bg_color, dtype=np.float32)) ** 2, axis=2))
            
            # Smooth alpha mask
            alpha = np.clip((dist - tol) / 16.0, 0.0, 1.0) * 255.0
            arr[:, :, 3] = alpha
            
            clean_cell = Image.fromarray(arr.astype(np.uint8), mode="RGBA")
            
            # Find non-transparent bounding box
            bbox = clean_cell.getbbox()
            if bbox:
                char_crop = clean_cell.crop(bbox)
                cw, ch = char_crop.size
                
                # Scale character to fit target frame nicely (height ~80-84px)
                scale = min(84.0 / ch, 84.0 / cw)
                scaled_w = int(cw * scale)
                scaled_h = int(ch * scale)
                char_scaled = char_crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                
                # Canvas
                frame = Image.new("RGBA", target_size, (0, 0, 0, 0))
                draw = ImageDraw.Draw(frame)
                
                # Contact shadow
                foot_y = anchor_y
                draw.ellipse([64 - 22, foot_y - 2, 64 + 22, foot_y + 6], fill=(4, 10, 18, 90))
                
                # Paste character centered horizontally, resting on foot_y
                paste_x = (target_size[0] - scaled_w) // 2
                paste_y = foot_y - scaled_h
                frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
                extracted_frames.append(frame)
            else:
                extracted_frames.append(Image.new("RGBA", target_size, (0, 0, 0, 0)))
                
    return extracted_frames

if __name__ == "__main__":
    uploaded_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
    turn_path = os.path.join(uploaded_dir, "media_1787676858429.jpg")
    frames = extract_and_clean_grid(turn_path, rows=4, cols=4, bg_color=(194, 195, 197), tol=25)
    
    out_strip = Image.new("RGBA", (128 * 16, 128), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out_strip.paste(f, (i * 128, 0), f)
    
    out_path = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\character\waterdrop-turnaround-16.png"
    out_strip.save(out_path, "PNG")
    print("Exported turnaround from user artwork:", out_path)
