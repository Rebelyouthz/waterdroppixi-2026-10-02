import os
from PIL import Image
import numpy as np

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"

WALK_SRC = os.path.join(BRAIN_DIR, "waterdrop_walk_sheet_1787669435014.jpg")
RUN_SRC = os.path.join(BRAIN_DIR, "waterdrop_run_sheet_1787670517398.jpg")
TURN_SRC = os.path.join(BRAIN_DIR, "waterdrop_turnaround_sheet_1787669453143.jpg")

def inspect_sheet(path, name):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    img = Image.open(path).convert("RGB")
    print(f"\n--- Inspecting {name}: size={img.size} ---")
    arr = np.array(img)
    # Check 4x4 grid cells
    for r in range(4):
        y0, y1 = r * 256, (r + 1) * 256
        for c in range(4):
            x0, x1 = c * 256, (c + 1) * 256
            cell = arr[y0:y1, x0:x1]
            # Character pixels
            is_char = (cell[:, :, 0] < 200) | (cell[:, :, 1] < 200) | (cell[:, :, 2] < 200)
            ys, xs = np.where(is_char)
            if len(ys) > 50:
                print(f"  Frame {r*4+c:02d}: x=[{np.min(xs)}..{np.max(xs)}] y=[{np.min(ys)}..{np.max(ys)}] w={np.max(xs)-np.min(xs)} h={np.max(ys)-np.min(ys)}")
            else:
                print(f"  Frame {r*4+c:02d}: EMPTY")

if __name__ == "__main__":
    inspect_sheet(WALK_SRC, "WALK CYCLE SHEET")
    inspect_sheet(RUN_SRC, "RUN CYCLE SHEET")
    inspect_sheet(TURN_SRC, "TURNAROUND SHEET")
