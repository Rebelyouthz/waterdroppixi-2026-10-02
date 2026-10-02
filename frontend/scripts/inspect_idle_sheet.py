import os
from PIL import Image
import numpy as np

IDLE_SRC = r"C:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\scripts\../.user_uploaded/media_1787678481270.jpg"
if not os.path.exists(IDLE_SRC):
    IDLE_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678481270.jpg"

def inspect_idle_sheet():
    img = Image.open(IDLE_SRC).convert("RGB")
    arr = np.array(img)
    w, h = img.size
    print(f"Idle Sheet size: {w}x{h}")
    # Sample grid cells:
    for r in range(4):
        y_center = int(50 + r * 240)
        row_crop = arr[r*256:(r+1)*256, :]
        print(f"\nRow {r}: shape={row_crop.shape}")
        for c in range(4):
            cell = row_crop[:, c*256:(c+1)*256]
            # Find dark pixels or blue pixels
            # Character is cyan/blue/red, background is dark/medium
            avg_color = np.mean(cell, axis=(0, 1))
            min_color = np.min(cell, axis=(0, 1))
            max_color = np.max(cell, axis=(0, 1))
            print(f"  Col {c}: avg={avg_color.astype(int)} min={min_color} max={max_color}")

if __name__ == "__main__":
    inspect_idle_sheet()
