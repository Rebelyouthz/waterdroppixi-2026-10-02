import os
import numpy as np
from PIL import Image

uploaded_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded"

img_turn = Image.open(os.path.join(uploaded_dir, "media_1787676858429.jpg"))
arr_turn = np.array(img_turn)
print("Turnaround corners color:")
print("Top-left (0,0):", arr_turn[0, 0])
print("Bottom-right (1023,1023):", arr_turn[1023, 1023])

img_atk = Image.open(os.path.join(uploaded_dir, "media_1787676868867.jpg"))
arr_atk = np.array(img_atk)
print("\nAttack sheet corners color:")
print("Top-left (0,0):", arr_atk[0, 0])
print("Sample cell center background (128, 128):", arr_atk[128, 128])
