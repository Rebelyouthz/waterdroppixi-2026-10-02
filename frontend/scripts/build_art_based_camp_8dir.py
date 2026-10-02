import os
import math
import numpy as np
from PIL import Image, ImageDraw
from process_all_sheets_zero_box import clean_cell_perfect

def build_art_based_camp_8dir(turnaround_img_path, out_camp_dir, frame_w=128, frame_h=128):
    img = Image.open(turnaround_img_path).convert("RGB")
    W, H = img.size
    cols, rows = 4, 4
    cell_w, cell_h = W // cols, H // rows
    
    # Extract all 16 clean angles
    angles_clean = []
    for r in range(rows):
        for c in range(cols):
            x0 = c * cell_w + 3
            y0 = r * cell_h + 3
            x1 = (c + 1) * cell_w - 3
            y1 = (r + 1) * cell_h - 3
            cell = img.crop((x0, y0, x1, y1))
            clean = clean_cell_perfect(cell, tol=22)
            angles_clean.append(clean)
            
    # Angle mapping from turnaround grid:
    # 0: Front (South)
    # 2: 3/4 Front Right (South-East)
    # 4: Right Profile (East)
    # 5: 3/4 Rear Right (North-East)
    # 6: Back View (North)
    # 7: 3/4 Rear Left (North-West)
    # 8: 3/4 Front Left (South-West)
    # 9: Left Profile (West)
    
    dir_angle_map = {
        "down": angles_clean[0],
        "up": angles_clean[6],
        "right": angles_clean[4],
        "left": angles_clean[9],
        "downright": angles_clean[2],
        "downleft": angles_clean[8],
        "upright": angles_clean[5],
        "upleft": angles_clean[7]
    }
    
    os.makedirs(out_camp_dir, exist_ok=True)
    
    for dir_name, base_char in dir_angle_map.items():
        frames = []
        cw, ch = base_char.size
        target_char_h = int(frame_h * 0.82)
        scale = target_char_h / max(ch, 1)
        scaled_w = max(1, int(cw * scale))
        scaled_h = max(1, int(ch * scale))
        
        char_base = base_char.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        
        for i in range(16):
            t = i / 16.0
            leg_phase = t * math.pi * 2
            
            # Natural liquid walk bob & squash-and-stretch
            bob = -abs(math.sin(leg_phase)) * 6.0
            squash = math.sin(leg_phase * 2) * 0.03
            
            w_frame = int(scaled_w * (1.0 + squash))
            h_frame = int(scaled_h * (1.0 - squash))
            
            char_step = char_base.resize((w_frame, h_frame), Image.Resampling.LANCZOS)
            
            frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame)
            
            # Ground contact shadow
            foot_y = frame_h - int(frame_h * 0.08)
            draw.ellipse([frame_w//2 - 24, foot_y - 2, frame_w//2 + 24, foot_y + 6], fill=(4, 10, 18, 90))
            
            paste_x = (frame_w - w_frame) // 2
            paste_y = int(foot_y - h_frame + bob)
            
            frame.paste(char_step, (paste_x, paste_y), char_step)
            frames.append(frame)
            
        total_w = frame_w * len(frames)
        strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            strip.paste(f, (i * frame_w, 0), f)
            
        out_file = os.path.join(out_camp_dir, f"camp-hero-walk-{dir_name}-16.png")
        strip.save(out_file, "PNG")
        print(f"Exported Canonical Art Camp Walk ({dir_name}): {out_file}")

if __name__ == "__main__":
    uploaded_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
    turn_path = os.path.join(uploaded_dir, "media_1787676858429.jpg")
    out_camp = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
    
    build_art_based_camp_8dir(turn_path, out_camp)
