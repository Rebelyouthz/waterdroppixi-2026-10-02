import os
from PIL import Image
import numpy as np
from scipy import ndimage

IDLE_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678481270.jpg"
TURN_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678490635.jpg"

def analyze_sheet(path, name):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    print(f"\n--- Analyzing {name}: size={w}x{h} ---")
    arr = np.array(img)
    # Bright background threshold
    is_char = (arr[:, :, 0] < 220) | (arr[:, :, 1] < 220) | (arr[:, :, 2] < 220)
    labeled, num_features = ndimage.label(is_char)
    objs = ndimage.find_objects(labeled)
    valid_boxes = []
    for s in objs:
        ymin, ymax = s[0].start, s[0].stop
        xmin, xmax = s[1].start, s[1].stop
        box_w = xmax - xmin
        box_h = ymax - ymin
        if box_w > 40 and box_h > 80:
            valid_boxes.append((xmin, ymin, xmax, ymax, box_w, box_h))
            
    # Sort boxes by Y then X
    valid_boxes.sort(key=lambda b: (b[1] // 150, b[0]))
    print(f"Found {len(valid_boxes)} character boxes in {name}:")
    for i, b in enumerate(valid_boxes):
        print(f"  Frame {i:02d}: x=[{b[0]}..{b[2]}] y=[{b[1]}..{b[3]}] w={b[4]} h={b[5]}")
    return valid_boxes

if __name__ == "__main__":
    analyze_sheet(IDLE_SRC, "BASE BODY IDLE")
    analyze_sheet(TURN_SRC, "16 ANGLES TURNAROUND")
