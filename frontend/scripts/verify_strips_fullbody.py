import os
from PIL import Image
import numpy as np

pub_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
files = [
    os.path.join(pub_dir, "camp", "camp-hero-walk-right-16.png"),
    os.path.join(pub_dir, "camp", "camp-hero-walk-down-16.png"),
    os.path.join(pub_dir, "character", "waterdrop-idle-16.png"),
    os.path.join(pub_dir, "character", "waterdrop-turnaround-16.png")
]

for fpath in files:
    im = Image.open(fpath)
    # Check all 16 frames in the strip
    print(f"Checking {os.path.basename(fpath)} (Total width: {im.width}):")
    for i in range(16):
        frame = im.crop((i * 128, 0, (i + 1) * 128, 128))
        bbox = frame.getbbox()
        if bbox:
            print(f"  Frame {i}: Non-empty bbox Y=[{bbox[1]}..{bbox[3]}], X=[{bbox[0]}..{bbox[2]}], height={bbox[3]-bbox[1]}")
        else:
            print(f"  Frame {i}: EMPTY!")
