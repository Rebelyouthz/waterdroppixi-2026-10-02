import os
from PIL import Image
import numpy as np

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
WALK_SRC = os.path.join(BRAIN_DIR, "waterdrop_walk_sheet_1787669435014.jpg")
RUN_SRC = os.path.join(BRAIN_DIR, "waterdrop_run_sheet_1787670517398.jpg")

def analyze_character_cells(path, name):
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    print(f"\n=======================================================")
    print(f"DETAILED CELL ANALYSIS: {name}")
    print(f"=======================================================")
    # Background color sample from corner
    bg = arr[0, 0]
    print(f"Top-left background RGB: {bg}")
    
    # Distance from background color
    diff = np.sqrt(np.sum((arr.astype(float) - bg.astype(float)) ** 2, axis=2))
    
    # 4 rows x 4 cols
    for r in range(4):
        for c in range(4):
            cell_diff = diff[r*256:(r+1)*256, c*256:(c+1)*256]
            is_char = cell_diff > 25.0
            ys, xs = np.where(is_char)
            if len(ys) > 50:
                print(f"  Row {r} Col {c} (Frame {r*4+c:02d}): y=[{np.min(ys)}..{np.max(ys)}] (h={np.max(ys)-np.min(ys)}) | x=[{np.min(xs)}..{np.max(xs)}] (w={np.max(xs)-np.min(xs)})")
            else:
                print(f"  Row {r} Col {c} (Frame {r*4+c:02d}): NO CHAR DETECTED")

if __name__ == "__main__":
    analyze_character_cells(WALK_SRC, "WALK CYCLE SHEET")
    analyze_character_cells(RUN_SRC, "RUN CYCLE SHEET")
