import os
from PIL import Image

up_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"
files = ["media_1787678471235.png", "media_1787678481270.jpg", "media_1787678490635.jpg"]
for f in files:
    im = Image.open(os.path.join(up_dir, f))
    print(f"{f}: size={im.size}, mode={im.mode}")
