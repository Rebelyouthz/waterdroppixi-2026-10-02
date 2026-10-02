import os
from PIL import Image
import numpy as np

debug_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\scripts\debug_cells"
for r in range(4):
    for c in range(4):
        im = Image.open(os.path.join(debug_dir, f"cell_{r}_{c}.png")).convert("RGB")
        arr = np.array(im)
        # Background is roughly 194, 195, 197
        bg = np.array([194, 195, 197])
        diff = np.linalg.norm(arr.astype(float) - bg, axis=-1)
        fg_mask = diff > 20
        coords = np.argwhere(fg_mask)
        if len(coords) > 0:
            y_min, x_min = coords.min(axis=0)
            y_max, x_max = coords.max(axis=0)
            print(f"Cell ({r},{c}): y_min={y_min}, y_max={y_max}, h={y_max-y_min}, x_min={x_min}, x_max={x_max}")
        else:
            print(f"Cell ({r},{c}): EMPTY!")
