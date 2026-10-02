import os
from PIL import Image
import numpy as np

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"

sheets = [
    "waterdrop_turnaround_sheet_1787669453143.jpg",
    "waterdrop_walk_sheet_1787669435014.jpg",
    "waterdrop_run_sheet_1787670517398.jpg",
    "waterdrop_dash_roll_sheet_1787670536566.jpg",
    "waterdrop_attack_sheet_1787669480658.jpg",
    "waterdrop_katana_slash_sheet_1787670554745.jpg",
    "waterdrop_katana_finisher_sheet_1787670586111.jpg",
    "waterdrop_rage_sheet_1787670605158.jpg",
    "waterdrop_bow_shoot_sheet_1787670626249.jpg",
    "waterdrop_scythe_spin_sheet_1787670644724.jpg",
    "waterdrop_hurt_sheet_1787670665365.jpg",
    "waterdrop_cheer_sheet_1787669646098.jpg",
]

print("=== CHARACTER SPRITESHEET GEOMETRY & COLOR REPORT ===")
for s in sheets:
    path = os.path.join(BRAIN_DIR, s)
    if not os.path.exists(path):
        print(f"MISSING: {s}")
        continue
    img = Image.open(path).convert("RGB")
    w, h = img.size
    arr = np.array(img)
    # Sample 4 corners for background color
    corners = np.array([arr[0,0], arr[0,-1], arr[-1,0], arr[-1,-1]])
    bg_color = np.mean(corners, axis=0)
    print(f"\nSheet: {s} | Size: {w}x{h} | Sampled BG RGB: ({bg_color[0]:.1f}, {bg_color[1]:.1f}, {bg_color[2]:.1f})")
