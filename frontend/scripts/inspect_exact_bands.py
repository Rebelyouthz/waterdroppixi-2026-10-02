import os
from PIL import Image
import numpy as np

IDLE_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678481270.jpg"
TURN_SRC = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c\.user_uploaded\media_1787678490635.jpg"

def inspect_image_bands(path, name):
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    print(f"\n=======================================================")
    print(f"PROFILE OF {name} (1024x1024)")
    print(f"=======================================================")
    print("Sample corners (0,0):", arr[0, 0], "(1023,1023):", arr[1023, 1023])
    
    # Calculate average row luminance
    row_lum = np.mean(arr, axis=(1, 2))
    # Threshold for character pixels (cyan blue has high blue, low red)
    # Character body is blue (R < 150, B > 160) or headband (R > 180, B < 80)
    is_char_pixel = ((arr[:, :, 2] > arr[:, :, 0] + 30) |  # Blue waterdrop
                     ((arr[:, :, 0] > 180) & (arr[:, :, 1] < 100) & (arr[:, :, 2] < 100)) | # Red headband
                     ((arr[:, :, 0] < 50) & (arr[:, :, 1] < 50) & (arr[:, :, 2] < 50)))    # Black eyes/outlines
    
    row_char_counts = np.sum(is_char_pixel, axis=1)
    
    # Find contiguous row bands where character pixels exist
    in_band = False
    start_y = 0
    bands = []
    for y in range(1024):
        if row_char_counts[y] > 50:
            if not in_band:
                in_band = True
                start_y = y
        else:
            if in_band:
                in_band = False
                bands.append((start_y, y - 1, y - start_y))
    if in_band:
        bands.append((start_y, 1023, 1024 - start_y))
        
    print(f"Found {len(bands)} vertical character rows in {name}:")
    for bi, (y0, y1, bh) in enumerate(bands):
        print(f"  Row Band {bi}: Y=[{y0}..{y1}] (height={bh}px)")
        
        # Now find the 4 column boxes in this band
        band_char_pixels = is_char_pixel[y0:y1, :]
        col_char_counts = np.sum(band_char_pixels, axis=0)
        
        in_col = False
        start_x = 0
        cols = []
        for x in range(1024):
            if col_char_counts[x] > 15:
                if not in_col:
                    in_col = True
                    start_x = x
            else:
                if in_col:
                    in_col = False
                    cols.append((start_x, x - 1, x - start_x))
        if in_col:
            cols.append((start_x, 1023, 1024 - start_x))
            
        print(f"    Found {len(cols)} columns in Row {bi}:")
        for ci, (x0, x1, cw) in enumerate(cols):
            print(f"      Frame {bi*4+ci:02d}: X=[{x0}..{x1}] Y=[{y0}..{y1}] (size: {cw}x{bh})")

if __name__ == "__main__":
    inspect_image_bands(IDLE_SRC, "BASE BODY IDLE (media_1787678481270.jpg)")
    inspect_image_bands(TURN_SRC, "16 ANGLES TURNAROUND (media_1787678490635.jpg)")
