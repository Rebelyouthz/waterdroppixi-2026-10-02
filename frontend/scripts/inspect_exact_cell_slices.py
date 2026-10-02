import os
from PIL import Image
import numpy as np

IDLE_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678481270.jpg"
TURN_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678490635.jpg"

def inspect_grid_slices(path, name):
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    print(f"\n=======================================================")
    print(f"INSPECTING {name} (1024x1024)")
    print(f"=======================================================")
    
    # 4 rows x 4 cols
    for r in range(4):
        y0 = r * 256
        y1 = (r + 1) * 256
        for c in range(4):
            x0 = c * 256
            x1 = (c + 1) * 256
            cell = arr[y0:y1, x0:x1]
            
            # Find character pixels inside cell (ignore margins)
            # Background is light grey/white (R>200, G>200, B>200)
            is_fg = (cell[:, :, 0] < 190) | (cell[:, :, 1] < 190) | (cell[:, :, 2] < 190)
            
            # Get bounding box inside cell
            fg_y, fg_x = np.where(is_fg)
            if len(fg_y) > 100:
                min_y, max_y = np.min(fg_y), np.max(fg_y)
                min_x, max_x = np.min(fg_x), np.max(fg_x)
                h = max_y - min_y
                w = max_x - min_x
                print(f"Row {r} Col {c} (Index {r*4+c:02d}): y=[{min_y}..{max_y}] h={h} | x=[{min_x}..{max_x}] w={w}")
            else:
                print(f"Row {r} Col {c} (Index {r*4+c:02d}): EMPTY")

if __name__ == "__main__":
    inspect_grid_slices(IDLE_SRC, "BASE BODY IDLE (media_1787678481270.jpg)")
    inspect_grid_slices(TURN_SRC, "16 ANGLES TURNAROUND (media_1787678490635.jpg)")
