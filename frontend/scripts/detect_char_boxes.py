import os
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects

def detect_and_slice_all_characters(img_path, bg_color=None, tol=22):
    img = Image.open(img_path).convert("RGB")
    arr = np.array(img, dtype=np.float32)
    
    if bg_color is None:
        # Sample corners
        corners = [arr[5, 5, :3], arr[5, -5, :3], arr[-5, 5, :3], arr[-5, -5, :3]]
        bg_color = np.mean(corners, axis=0)
        
    diff = np.linalg.norm(arr[:, :, :3] - bg_color, axis=-1)
    fg_mask = diff > tol
    
    # Ignore header text at the top (top 10% if it has title text)
    # Label connected components
    labeled, num_features = label(fg_mask)
    objects = find_objects(labeled)
    
    print(f"Total features detected in {os.path.basename(img_path)}: {num_features}")
    
    # Filter features that are character-sized (height > 100, width > 60)
    char_boxes = []
    for i, sl in enumerate(objects):
        if sl is None:
            continue
        sy, sx = sl
        h = sy.stop - sy.start
        w = sx.stop - sx.start
        if h > 90 and w > 50 and sy.start > 40: # skip header
            char_boxes.append((sy.start, sx.start, sy.stop, sx.stop, h, w))
            
    print(f"Character-sized objects found: {len(char_boxes)}")
    # Sort by Y (rows) then X (cols)
    char_boxes.sort(key=lambda b: (b[0] // 180, b[1]))
    for idx, b in enumerate(char_boxes):
        print(f"Char {idx}: Y=[{b[0]}..{b[2]}] (h={b[4]}), X=[{b[1]}..{b[3]}] (w={b[5]})")
        
    return char_boxes

up_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
print("--- TURNAROUND SHEET (media_1787678490635.jpg) ---")
detect_and_slice_all_characters(os.path.join(up_dir, "media_1787678490635.jpg"), bg_color=np.array([194, 195, 197]))

print("\n--- IDLE SHEET (media_1787678481270.jpg) ---")
detect_and_slice_all_characters(os.path.join(up_dir, "media_1787678481270.jpg"), bg_color=np.array([0, 0, 0]), tol=15)
