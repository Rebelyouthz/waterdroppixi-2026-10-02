import os
from PIL import Image, ImageEnhance, ImageFilter

MASTER_ROOM = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\camp_space_station_master_room_1787691818874.jpg"
TOPDOWN_SHELL = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\camp_topdown_station_shell_1787691848810.jpg"
OUT_DIR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"

def create_stunning_station_shell():
    # Load Master Space Station Room
    img = Image.open(MASTER_ROOM).convert("RGB")
    print(f"Loaded Master Room image: {img.size}")
    
    # 1. Resize & Crop cleanly to 1920x1080 (16:9 aspect ratio)
    w, h = img.size
    target_aspect = 1920 / 1080
    curr_aspect = w / h
    
    if curr_aspect > target_aspect:
        new_w = int(h * target_aspect)
        x0 = (w - new_w) // 2
        crop_img = img.crop((x0, 0, x0 + new_w, h))
    else:
        new_h = int(w / target_aspect)
        y0 = (h - new_h) // 2
        crop_img = img.crop((0, y0, w, y0 + new_h))
        
    res_2x = crop_img.resize((1920, 1080), Image.Resampling.LANCZOS)
    
    # Polish contrast and saturation for a breathtaking sci-fi vibe
    enh_c = ImageEnhance.Contrast(res_2x)
    res_2x = enh_c.enhance(1.12)
    enh_s = ImageEnhance.Color(res_2x)
    res_2x = enh_s.enhance(1.15)
    
    # Save 1920x1080 (2X) and 960x540 (1X)
    res_1x = res_2x.resize((960, 540), Image.Resampling.LANCZOS)
    
    path_2x = os.path.join(OUT_DIR, "station-mainhall-shell-2x.png")
    path_1x = os.path.join(OUT_DIR, "station-mainhall-shell.png")
    
    res_2x.save(path_2x, "PNG")
    res_1x.save(path_1x, "PNG")
    print(f"Exported Stunning Master Room 2X: {path_2x}")
    print(f"Exported Stunning Master Room 1X: {path_1x}")

if __name__ == "__main__":
    create_stunning_station_shell()
