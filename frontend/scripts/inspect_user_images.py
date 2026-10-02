import os
from PIL import Image

uploaded_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
for fname in sorted(os.listdir(uploaded_dir)):
    fpath = os.path.join(uploaded_dir, fname)
    if os.path.isfile(fpath):
        im = Image.open(fpath)
        print(f"File: {fname} | Size: {im.size} | Mode: {im.mode}")
