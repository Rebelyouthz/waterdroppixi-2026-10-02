import os
from PIL import Image

temp_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.tempmediaStorage"
for fname in sorted(os.listdir(temp_dir)):
    fpath = os.path.join(temp_dir, fname)
    if os.path.isfile(fpath):
        im = Image.open(fpath)
        print(f"File: {fname} | Size: {im.size} | Mode: {im.mode}")
