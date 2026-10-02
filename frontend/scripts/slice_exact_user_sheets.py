import os
import math
import numpy as np
from PIL import Image, ImageDraw

def slice_black_bg_sheet(img_path, output_paths, rows=4, cols=4, top_header_ratio=0.088, frame_w=128, frame_h=128):
    """Cleanly extracts 16 frames from black background sheet."""
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    
    top_offset = int(H * top_header_ratio)
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
            
            # Inset crop to avoid any grid borders
            cell = img.crop((x0 + 4, y0 + 4, x1 - 4, y1 - 4))
            arr = np.array(cell, dtype=np.float32)
            
            # Black background distance
            dist = np.linalg.norm(arr[:, :, :3], axis=-1)
            
            # Clean alpha: anything darker than threshold is transparent
            alpha = np.clip((dist - 14.0) / 18.0, 0.0, 1.0) * 255.0
            
            rgba = np.dstack([arr[:, :, :3].astype(np.uint8), alpha.astype(np.uint8)])
            cell_rgba = Image.fromarray(rgba, "RGBA")
            
            bbox = cell_rgba.getbbox()
            frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame)
            
            if bbox:
                char_crop = cell_rgba.crop(bbox)
                cw, ch = char_crop.size
                
                target_char_h = int(frame_h * 0.82)
                scale = min(target_char_h / max(ch, 1), (frame_w * 0.82) / max(cw, 1))
                scaled_w = max(1, int(cw * scale))
                scaled_h = max(1, int(ch * scale))
                
                char_scaled = char_crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                
                # Soft ground shadow
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
        print(f"Exported Exact User Artwork Strip: {outp} ({total_w}x{frame_h})")

def slice_grey_bg_turnaround(img_path, output_paths, rows=4, cols=4, frame_w=128, frame_h=128):
    """Cleanly extracts 16 angles from grey background turnaround sheet."""
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    
    cell_w = W / cols
    cell_h = H / rows
    
    frames = []
    extracted_chars = []
    
    for r in range(rows):
        for c in range(cols):
            x0 = int(c * cell_w)
            y0 = int(r * cell_h)
            x1 = int((c + 1) * cell_w)
            y1 = int((r + 1) * cell_h)
            
            cell = img.crop((x0 + 4, y0 + 4, x1 - 4, y1 - 4))
            arr = np.array(cell, dtype=np.float32)
            
            # Sample background color from border of this cell
            border = np.concatenate([arr[0:4, :, :3].reshape(-1, 3), arr[-4:, :, :3].reshape(-1, 3), arr[:, 0:4, :3].reshape(-1, 3), arr[:, -4:, :3].reshape(-1, 3)], axis=0)
            bg_col = np.median(border, axis=0)
            
            dist = np.linalg.norm(arr[:, :, :3] - bg_col, axis=-1)
            alpha = np.clip((dist - 22.0) / 16.0, 0.0, 1.0) * 255.0
            
            rgba = np.dstack([arr[:, :, :3].astype(np.uint8), alpha.astype(np.uint8)])
            cell_rgba = Image.fromarray(rgba, "RGBA")
            
            bbox = cell_rgba.getbbox()
            frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame)
            
            if bbox:
                char_crop = cell_rgba.crop(bbox)
                extracted_chars.append(char_crop)
                cw, ch = char_crop.size
                
                target_char_h = int(frame_h * 0.82)
                scale = min(target_char_h / max(ch, 1), (frame_w * 0.82) / max(cw, 1))
                scaled_w = max(1, int(cw * scale))
                scaled_h = max(1, int(ch * scale))
                
                char_scaled = char_crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                
                foot_y = frame_h - int(frame_h * 0.08)
                draw.ellipse([frame_w//2 - 24, foot_y - 3, frame_w//2 + 24, foot_y + 5], fill=(4, 10, 18, 100))
                
                paste_x = (frame_w - scaled_w) // 2
                paste_y = foot_y - scaled_h
                frame.paste(char_scaled, (paste_x, paste_y), char_scaled)
            else:
                extracted_chars.append(None)
                
            frames.append(frame)
            
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
        
    for outp in output_paths:
        os.makedirs(os.path.dirname(outp), exist_ok=True)
        strip.save(outp, "PNG")
        print(f"Exported Exact User Turnaround Strip: {outp} ({total_w}x{frame_h})")
        
    return extracted_chars

def generate_directional_walks_from_exact_art(chars, out_camp_dir, frame_w=128, frame_h=128):
    """Takes the exact sliced character angles from the user's artwork and creates animated walk cycles."""
    # Angle map from turnaround grid (16 angles):
    # 0: Front (South)
    # 2: 3/4 Front Right (South-East)
    # 4: Profile Right (East)
    # 5: 3/4 Rear Right (North-East)
    # 6: Direct Back (North)
    # 7: 3/4 Rear Left (North-West)
    # 8: 3/4 Front Left (South-West)
    # 9: Profile Left (West)
    
    dir_map = {
        "down": chars[0],
        "up": chars[6],
        "right": chars[4],
        "left": chars[9],
        "downright": chars[2],
        "downleft": chars[8],
        "upright": chars[5],
        "upleft": chars[7]
    }
    
    for dir_name, base_crop in dir_map.items():
        if base_crop is None:
            continue
            
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
            
            # Natural hydrodynamic walk bobbing & squash/stretch on the exact art
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
        print(f"Exported Exact Artwork Walk Cycle ({dir_name}): {out_file}")

if __name__ == "__main__":
    up_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
    pub_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    print("=================================================================")
    print("SLICING EXACT CANONICAL ARTWORK PROVIDED BY USER...")
    print("=================================================================")
    
    # 1. Exact 16-frame Idle Animation from black background sheet
    idle_sheet = os.path.join(up_dir, "media_1787678481270.jpg")
    slice_black_bg_sheet(
        idle_sheet,
        [
            os.path.join(pub_dir, "character", "waterdrop-idle-16.png"),
            os.path.join(pub_dir, "camp", "camp-hero-idle-16.png")
        ]
    )
    
    # 2. Exact 16-angle Turnaround from grey background sheet
    turn_sheet = os.path.join(up_dir, "media_1787678490635.jpg")
    chars = slice_grey_bg_turnaround(
        turn_sheet,
        [
            os.path.join(pub_dir, "character", "waterdrop-turnaround-16.png"),
            os.path.join(pub_dir, "camp", "camp-hero-turnaround-16.png")
        ]
    )
    
    # 3. 8-Directional Walk Cycles from Exact Artwork
    generate_directional_walks_from_exact_art(chars, os.path.join(pub_dir, "camp"))
    
    print("\n=================================================================")
    print("ALL SPRITESHEETS UPDATED DIRECTLY WITH YOUR EXACT CANONICAL ARTWORK!")
    print("=================================================================")
