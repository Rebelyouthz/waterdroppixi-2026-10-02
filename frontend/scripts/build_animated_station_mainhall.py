import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw

def generate_earth_window_loop(output_path, num_frames=16, frame_w=192, frame_h=108):
    """16 frames of Earth slowly rotating in orbit outside the station window."""
    strip = Image.new("RGBA", (frame_w * num_frames, frame_h), (0, 0, 0, 0))
    
    for i in range(num_frames):
        t = i / float(num_frames)
        frame = Image.new("RGBA", (frame_w, frame_h), (6, 12, 22, 255))
        draw = ImageDraw.Draw(frame)
        
        # Deep space stars
        for s in range(30):
            sx = int((s * 37 + s * 13) % frame_w)
            sy = int((s * 29 + s * 7) % frame_h)
            twinkle = 120 + int(math.sin(t * math.pi * 4 + s) * 100)
            draw.point((sx, sy), fill=(200, 230, 255, twinkle))
            
        # Cosmic blue/purple nebula wash
        draw.ellipse([frame_w//2 - 60, -20, frame_w//2 + 80, frame_h + 30], fill=(40, 20, 80, 60))
        draw.ellipse([frame_w//2 - 20, -10, frame_w//2 + 90, frame_h + 20], fill=(20, 60, 120, 60))
        
        # Earth Planet Curve
        earth_cx, earth_cy = frame_w // 2 + 10, frame_h + 40
        earth_r = 74
        
        # Atmosphere glow
        draw.circle((earth_cx, earth_cy), radius=earth_r + 4, outline=(120, 210, 255, 120), width=3)
        # Earth Ocean Sphere
        draw.circle((earth_cx, earth_cy), radius=earth_r, fill=(24, 76, 148, 255))
        
        # Rotating Continents (Green/Earth landmasses)
        rot_offset = int(t * 40)
        for c in range(3):
            lx = earth_cx - 50 + c * 36 + rot_offset
            if lx > earth_cx + earth_r:
                lx -= (earth_r * 2)
            ly = earth_cy - 40 + (c * 18) % 30
            draw.ellipse([lx - 16, ly - 10, lx + 16, ly + 10], fill=(48, 142, 78, 220))
            
        # Cloud wisps in atmosphere
        cloud_offset = int(t * 60)
        for cl in range(4):
            cx_cloud = earth_cx - 60 + cl * 32 + cloud_offset
            if cx_cloud > earth_cx + earth_r:
                cx_cloud -= (earth_r * 2)
            cy_cloud = earth_cy - 50 + (cl * 14) % 35
            draw.ellipse([cx_cloud - 20, cy_cloud - 6, cx_cloud + 20, cy_cloud + 6], fill=(255, 255, 255, 160))
            
        # Window Frame Border
        draw.rectangle([0, 0, frame_w - 1, frame_h - 1], outline=(38, 54, 72, 255), width=3)
        draw.rectangle([2, 2, frame_w - 3, frame_h - 3], outline=(72, 108, 142, 255), width=1)
        
        strip.paste(frame, (i * frame_w, 0))
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, "PNG")
    print(f"Exported Earth Window Loop: {output_path} ({frame_w * num_frames}x{frame_h}, {num_frames} frames)")

def generate_ambient_station_lights(output_path, num_frames=16, fw=128, fh=128):
    """16 frames of cozy animated ambient light fixtures & computer terminal blinks."""
    strip = Image.new("RGBA", (fw * num_frames, fh), (0, 0, 0, 0))
    
    for i in range(num_frames):
        t = i / float(num_frames)
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        
        # Ceiling Lamp Fixture
        draw.rectangle([fw//2 - 24, 10, fw//2 + 24, 22], fill=(42, 54, 68, 255), outline=(18, 24, 34, 255))
        # Lamp Glow Cone
        glow_pulse = 0.8 + math.sin(t * math.pi * 2) * 0.2
        draw.polygon([(fw//2 - 16, 22), (fw//2 + 16, 22), (fw//2 + 48, fh - 10), (fw//2 - 48, fh - 10)], fill=(120, 220, 255, int(40 * glow_pulse)))
        draw.rectangle([fw//2 - 18, 18, fw//2 + 18, 22], fill=(220, 245, 255, int(255 * glow_pulse)))
        
        # Terminal LED Status Lights
        for led in range(4):
            blink_state = (i + led * 3) % 4 < 2
            col = (79, 216, 255, 255) if blink_state else (20, 60, 80, 255)
            draw.circle((fw//2 - 18 + led * 12, 14), radius=2.5, fill=col)
            
        strip.paste(frame, (i * fw, 0), frame)
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, "PNG")
    print(f"Exported Ambient Station Lights: {output_path} ({fw * num_frames}x{fh}, {num_frames} frames)")

if __name__ == "__main__":
    out_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites\camp"
    generate_earth_window_loop(os.path.join(out_dir, "station-earth-window-loop-16.png"))
    generate_ambient_station_lights(os.path.join(out_dir, "station-ambient-lights-16.png"))
