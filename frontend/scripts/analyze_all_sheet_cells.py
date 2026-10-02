import os
import numpy as np
from PIL import Image
from scipy import ndimage

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
TURN_SRC = os.path.join(BRAIN_DIR, "waterdrop_turnaround_sheet_1787669453143.jpg")
WALK_SRC = os.path.join(BRAIN_DIR, "waterdrop_walk_sheet_1787669435014.jpg")
RUN_SRC = os.path.join(BRAIN_DIR, "waterdrop_run_sheet_1787670517398.jpg")

def analyze_sheet_cells(img_path, name):
    img = Image.open(img_path).convert("RGB")
    w, h = img.size
    print(f"\n=======================================================")
    print(f"ANALYZING SHEET: {name} ({w}x{h})")
    print(f"=======================================================")
    
    # 4x4 grid analysis
    cw, ch = w // 4, h // 4
    for r in range(4):
        for c in range(4):
            cell = img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            arr = np.array(cell).astype(np.float32)
            # detect character pixels (differing from background)
            bg = arr[0, 0] # top left
            diff = np.sqrt(np.sum((arr - bg) ** 2, axis=2))
            mask = diff > 20.0
            
            y_indices, x_indices = np.where(mask)
            if len(y_indices) > 0:
                min_y, max_y = np.min(y_indices), np.max(y_indices)
                min_x, max_x = np.min(x_indices), np.max(x_indices)
                char_h = max_y - min_y + 1
                char_w = max_x - min_x + 1
                feet_y = max_y
                head_y = min_y
                center_x = (min_x + max_x) / 2.0
                print(f"Frame ({r},{c}) [Idx {r*4+c:02d}]: bbox=({min_x},{min_y})->({max_x},{max_y}) | size={char_w}x{char_h} | feet_y={feet_y} | head_y={head_y} | center_x={center_x:.1f}")

analyze_sheet_cells(TURN_SRC, "TURNAROUND SHEET (16 ANGLES)")
analyze_sheet_cells(WALK_SRC, "WALK SHEET (16 FRAMES)")
analyze_sheet_cells(RUN_SRC, "RUN SHEET (16 FRAMES)")
