import os
from PIL import Image
import numpy as np

up_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
turn_img = Image.open(os.path.join(up_dir, "media_1787678490635.jpg"))
W, H = turn_img.size
cols, rows = 4, 4
cell_w, cell_h = W // cols, H // rows

# Save each raw cell without any cropping or background removal to inspect
debug_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\scripts\debug_cells"
os.makedirs(debug_dir, exist_ok=True)

for r in range(rows):
    for c in range(cols):
        cell = turn_img.crop((c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h))
        cell.save(os.path.join(debug_dir, f"cell_{r}_{c}.png"))

print("Saved raw cells for inspection.")
