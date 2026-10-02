import os
import numpy as np
from PIL import Image
from scipy import ndimage

BRAIN_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
TURN_SRC = os.path.join(BRAIN_DIR, "waterdrop_turnaround_sheet_1787669453143.jpg")
WALK_SRC = os.path.join(BRAIN_DIR, "waterdrop_walk_sheet_1787669435014.jpg")

def extract_pure_character(crop_img, bg_color):
    arr = np.array(crop_img).astype(np.float32)
    bg = np.array(bg_color).astype(np.float32)
    diff = np.sqrt(np.sum((arr[:, :, :3] - bg) ** 2, axis=2))
    
    # Threshold for solid body
    is_solid = diff > 22.0
    
    # Connected component labeling
    labeled, num_features = ndimage.label(is_solid)
    if num_features == 0:
        return None
    
    # Find the main component closest to the vertical center and largest
    sizes = ndimage.sum(is_solid, labeled, range(1, num_features + 1))
    
    # Score each component by size and proximity to center
    best_label = 0
    best_score = -1e9
    cy, cx = crop_img.height / 2.0, crop_img.width / 2.0
    for label_id in range(1, num_features + 1):
        size = sizes[label_id - 1]
        if size < 400: # discard small specks / stray feet
            continue
        y_idx, x_idx = np.where(labeled == label_id)
        mean_y, mean_x = np.mean(y_idx), np.mean(x_idx)
        dist = np.sqrt((mean_y - cy)**2 + (mean_x - cx)**2)
        score = size - dist * 15.0
        if score > best_score:
            best_score = score
            best_label = label_id
            
    if best_label == 0:
        return None
        
    mask_main = (labeled == best_label)
    # Include limbs attached to main body
    mask_dilated = ndimage.binary_dilation(mask_main, iterations=4)
    # Alpha with smooth anti-aliased edge
    alpha = np.clip((diff - 12.0) / 20.0, 0.0, 1.0) * mask_dilated
    
    out_arr = np.zeros((crop_img.height, crop_img.width, 4), dtype=np.uint8)
    out_arr[:, :, :3] = np.array(crop_img)[:, :, :3]
    out_arr[:, :, 3] = (alpha * 255).astype(np.uint8)
    
    rgba = Image.fromarray(out_arr, "RGBA")
    bbox = rgba.getbbox()
    if bbox:
        return rgba.crop(bbox)
    return rgba

# Test segmentation on turnaround sheet
img = Image.open(TURN_SRC).convert("RGB")
print("=== TESTING CONNECTED COMPONENT SEGMENTATION ON 16 ANGLES ===")
for r in range(4):
    for c in range(4):
        # Precise center coordinates for each character
        center_x = int((c + 0.5) * 256)
        center_y = int([170, 428, 670, 900][r])
        half_w, half_h = 110, 115
        crop = img.crop((center_x - half_w, center_y - half_h, center_x + half_w, center_y + half_h))
        char = extract_pure_character(crop, (193, 195, 197))
        if char:
            print(f"Turn Angle {r*4+c:02d}: Extracted {char.width}x{char.height} | Clean bbox!")
        else:
            print(f"Turn Angle {r*4+c:02d}: FAILED!")

# Test segmentation on walk sheet
walk_img = Image.open(WALK_SRC).convert("RGB")
print("\n=== TESTING CONNECTED COMPONENT SEGMENTATION ON 16 WALK FRAMES ===")
for r in range(4):
    for c in range(4):
        center_x = int((c + 0.5) * 256)
        center_y = int([170, 428, 670, 900][r])
        half_w, half_h = 110, 115
        crop = walk_img.crop((center_x - half_w, center_y - half_h, center_x + half_w, center_y + half_h))
        char = extract_pure_character(crop, (187, 195, 202))
        if char:
            print(f"Walk Frame {r*4+c:02d}: Extracted {char.width}x{char.height} | Clean bbox!")
        else:
            print(f"Walk Frame {r*4+c:02d}: FAILED!")
