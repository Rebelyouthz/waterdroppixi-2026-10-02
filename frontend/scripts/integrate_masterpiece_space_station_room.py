import os
from PIL import Image, ImageFilter

SHELL_ART_PATH = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\camp_topdown_station_shell_1787691848810.jpg"
FLOOR_ART_PATH = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\camp_modular_floor_tileset_1787691835130.jpg"
COZY_ART_PATH  = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\camp_space_station_master_room_1787691818874.jpg"

OUT_DIR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"

def process_and_export_room():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    # 1. Main Hall Shell 2X (1920x1080) & 1X (960x540)
    print("Processing Top-Down Station Shell...")
    shell_img = Image.open(SHELL_ART_PATH).convert("RGBA")
    
    # Fit into 1920x1080
    shell_2x = shell_img.resize((1920, 1080), Image.Resampling.LANCZOS)
    shell_2x_path = os.path.join(OUT_DIR, "station-mainhall-shell-2x.png")
    shell_2x.save(shell_2x_path, "PNG")
    print(f"Saved: {shell_2x_path} (1920x1080)")
    
    shell_1x = shell_img.resize((960, 540), Image.Resampling.LANCZOS)
    shell_1x_path = os.path.join(OUT_DIR, "station-mainhall-shell.png")
    shell_1x.save(shell_1x_path, "PNG")
    print(f"Saved: {shell_1x_path} (960x540)")
    
    # 2. Modular Floor Tileset
    print("Processing Modular Floor Tileset...")
    floor_img = Image.open(FLOOR_ART_PATH).convert("RGBA")
    floor_path = os.path.join(OUT_DIR, "station-floor-tileset-2x.png")
    floor_img.save(floor_path, "PNG")
    print(f"Saved: {floor_path} (1024x1024)")
    
    # 3. Cozy Living Sanctuary Background Variant (for cinema/relaxation)
    print("Processing Cozy Station Sanctuary...")
    cozy_img = Image.open(COZY_ART_PATH).convert("RGBA")
    cozy_2x = cozy_img.resize((1920, 1080), Image.Resampling.LANCZOS)
    cozy_path = os.path.join(OUT_DIR, "station-sanctuary-cinema-2x.png")
    cozy_2x.save(cozy_path, "PNG")
    print(f"Saved: {cozy_path} (1920x1080)")

if __name__ == "__main__":
    process_and_export_room()
