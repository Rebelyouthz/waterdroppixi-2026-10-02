import os
import math
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, binary_dilation, center_of_mass

def is_bg_pixel(r, g, b, bg_mode="gray"):
    if bg_mode == "black":
        return (r < 25) and (g < 25) and (b < 25)
    sat = (max(r, g, b) - min(r, g, b)) / (max(r, g, b) + 1e-5)
    dist_slate = ((r - 170)**2 + (g - 180)**2 + (b - 190)**2)**0.5
    return (dist_slate < 48) or ((sat < 0.14) and (max(r, g, b) > 80))

def extract_and_clean_frames_auto(
    img_path,
    bg_mode="gray",
    frame_w=128,
    frame_h=128,
    top_offset_pct=0.0
):
    if not os.path.exists(img_path):
        print(f"Warning: Missing {img_path}")
        return []
        
    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    
    top_offset = int(H * top_offset_pct)
    img_crop = img.crop((0, top_offset, W, H))
    cW, cH = img_crop.size
    
    data = np.array(img_crop, dtype=np.float32)
    r_ch, g_ch, b_ch = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    max_c = np.maximum(np.maximum(r_ch, g_ch), b_ch)
    min_c = np.minimum(np.minimum(r_ch, g_ch), b_ch)
    sat = (max_c - min_c) / (max_c + 1e-5)
    
    if bg_mode == "black":
        diff = np.linalg.norm(data[:, :, :3], axis=-1)
        fg_mask = diff > 22
        alpha = np.clip((diff - 14) / 18.0, 0.0, 1.0) * 255.0
    else:
        dist_slate = np.sqrt((r_ch - 170)**2 + (g_ch - 180)**2 + (b_ch - 190)**2)
        is_bg = (dist_slate < 48) | ((sat < 0.14) & (max_c > 80))
        fg_mask = ~is_bg
        alpha = np.where(fg_mask, 255.0, 0.0)

    # 4x4 Grid cell iteration with smart margin clipping
    cell_w = cW / 4.0
    cell_h = cH / 4.0
    
    frames = []
    
    for r in range(4):
        for c in range(4):
            # Centered bounding box per cell
            margin_x = int(cell_w * 0.04)
            margin_y = int(cell_h * 0.04)
            y0 = int(r * cell_h + margin_y)
            y1 = int((r + 1) * cell_h - margin_y)
            x0 = int(c * cell_w + margin_x)
            x1 = int((c + 1) * cell_w - margin_x)
            
            sub_mask = fg_mask[y0:y1, x0:x1]
            sub_data = data[y0:y1, x0:x1]
            sub_alpha = alpha[y0:y1, x0:x1]
            
            labeled, num_features = label(sub_mask)
            if num_features > 0:
                sizes = [np.sum(labeled == i) for i in range(1, num_features + 1)]
                largest_label = np.argmax(sizes) + 1
                main_mask = (labeled == largest_label)
                
                # Include nearby particles/aura
                ch_center = np.array([sub_data.shape[0] / 2, sub_data.shape[1] / 2])
                for idx, size in enumerate(sizes):
                    if idx + 1 == largest_label: continue
                    if size > 15:
                        coords = np.argwhere(labeled == (idx + 1))
                        comp_center = np.mean(coords, axis=0)
                        if np.linalg.norm(comp_center - ch_center) < (cell_h * 0.44):
                            main_mask |= (labeled == (idx + 1))

                dilated = binary_dilation(main_mask, iterations=1)
                
                final_a = np.zeros(sub_data.shape[:2], dtype=np.uint8)
                final_a[dilated] = sub_alpha[dilated].astype(np.uint8)
                
                # Bottom ground cleanup
                for y in range(int(sub_data.shape[0] * 0.88), sub_data.shape[0]):
                    for x in range(sub_data.shape[1]):
                        if sat[y0+y, x0+x] < 0.15 and max_c[y0+y, x0+x] < 70:
                            final_a[y, x] = 0

                rgba = np.dstack([sub_data[:, :, :3].astype(np.uint8), final_a])
                cell_clean = Image.fromarray(rgba, "RGBA")
                bbox = cell_clean.getbbox()
                if bbox:
                    cropped = cell_clean.crop(bbox)
                    cw, ch = cropped.size
                    target_h = int(frame_h * 0.82)
                    scale = target_h / max(ch, 1)
                    sw = max(1, int(cw * scale))
                    sh = max(1, int(ch * scale))
                    scaled = cropped.resize((sw, sh), Image.Resampling.LANCZOS)
                    
                    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
                    px = (frame_w - sw) // 2
                    py = frame_h - sh - int(frame_h * 0.06)
                    frame.paste(scaled, (px, py), scaled)
                    frames.append(frame)
                else:
                    frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
            else:
                frames.append(Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0)))
                
    return frames

def save_strip(frames, output_path, frame_w=128, frame_h=128):
    if not frames: return
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    total_w = frame_w * len(frames)
    strip = Image.new("RGBA", (total_w, frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
    strip.save(output_path, "PNG")
    print(f"Exported: {output_path} ({total_w}x{frame_h}, {len(frames)} frames)")

def generate_16_angle_weapon(weapon_type, output_path, frame_w=128, frame_h=128):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    angles = [i * (360.0 / 16.0) for i in range(16)]
    frames = []
    
    for deg in angles:
        rad = math.radians(deg)
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, frame_h // 2
        
        if weapon_type == "snapped_rib":
            blade_len = 38
            tip_x = cx + math.cos(rad) * blade_len
            tip_y = cy + math.sin(rad) * blade_len
            hilt_x = cx - math.cos(rad) * 12
            hilt_y = cy - math.sin(rad) * 12
            nx = -math.sin(rad) * 4
            ny = math.cos(rad) * 4
            
            poly = [
                (hilt_x - nx, hilt_y - ny),
                (hilt_x + nx, hilt_y + ny),
                (tip_x + nx * 0.4, tip_y + ny * 0.4),
                (tip_x, tip_y),
                (tip_x - nx * 0.8, tip_y - ny * 0.8),
            ]
            draw.polygon(poly, fill=(180, 200, 215, 255), outline=(40, 60, 80, 255))
            draw.line([(tip_x, tip_y), (hilt_x + nx, hilt_y + ny)], fill=(77, 255, 212, 255), width=2)
            draw.line([(hilt_x - nx * 1.5, hilt_y - ny * 1.5), (hilt_x + nx * 1.5, hilt_y + ny * 1.5)], fill=(30, 40, 50, 255), width=3)
            
        elif weapon_type == "hydropistol":
            barrel_len = 24
            bx = cx + math.cos(rad) * barrel_len
            by = cy + math.sin(rad) * barrel_len
            hx = cx - math.cos(rad) * 8
            hy = cy - math.sin(rad) * 8
            nx = -math.sin(rad) * 5
            ny = math.cos(rad) * 5
            
            draw.polygon([(hx - nx, hy - ny), (hx + nx, hy + ny), (bx + nx * 0.6, by + ny * 0.6), (bx - nx * 0.6, by - ny * 0.6)], fill=(30, 50, 75, 255), outline=(15, 25, 40, 255))
            draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(77, 196, 255, 255), outline=(255, 255, 255, 220))
            draw.line([(bx - nx * 0.5, by - ny * 0.5), (bx + nx * 0.5, by + ny * 0.5)], fill=(77, 255, 212, 255), width=2)
            
        elif weapon_type == "desert_eagle":
            barrel_len = 26
            bx = cx + math.cos(rad) * barrel_len
            by = cy + math.sin(rad) * barrel_len
            hx = cx - math.cos(rad) * 10
            hy = cy - math.sin(rad) * 10
            nx = -math.sin(rad) * 6
            ny = math.cos(rad) * 6
            
            draw.polygon([(hx - nx, hy - ny), (hx + nx, hy + ny), (bx + nx, by + ny), (bx - nx, by - ny)], fill=(220, 180, 80, 255), outline=(60, 45, 10, 255))
            draw.line([(hx, hy), (hx + nx * 1.6, hy + ny * 1.6)], fill=(40, 30, 20, 255), width=4)
            
        elif weapon_type == "storm_lance":
            lance_len = 44
            tx = cx + math.cos(rad) * lance_len
            ty = cy + math.sin(rad) * lance_len
            bx = cx - math.cos(rad) * 22
            by = cy - math.sin(rad) * 22
            nx = -math.sin(rad) * 3
            ny = math.cos(rad) * 3
            
            draw.line([(bx, by), (tx, ty)], fill=(240, 220, 100, 255), width=3)
            draw.line([(tx - nx * 4, ty - ny * 4), (tx + math.cos(rad) * 6, ty + math.sin(rad) * 6)], fill=(160, 240, 255, 255), width=2)
            draw.line([(tx + nx * 4, ty + ny * 4), (tx + math.cos(rad) * 6, ty + math.sin(rad) * 6)], fill=(160, 240, 255, 255), width=2)
            
        elif weapon_type == "tidewood_bow":
            bow_r = 24
            arc_pts = []
            for a in range(-60, 61, 15):
                angle_b = rad + math.radians(a)
                arc_pts.append((cx + math.cos(angle_b) * bow_r, cy + math.sin(angle_b) * bow_r))
            draw.line(arc_pts, fill=(160, 110, 60, 255), width=4)
            if len(arc_pts) >= 2:
                draw.line([arc_pts[0], arc_pts[-1]], fill=(120, 230, 255, 240), width=1)
                
        elif weapon_type == "blood_scythe":
            sx = cx - math.cos(rad) * 20
            sy = cy - math.sin(rad) * 20
            ex = cx + math.cos(rad) * 20
            ey = cy + math.sin(rad) * 20
            draw.line([(sx, sy), (ex, ey)], fill=(25, 20, 30, 255), width=3)
            bx = ex + math.sin(rad) * 24
            by = ey - math.cos(rad) * 24
            draw.polygon([(ex, ey), (bx, by), (ex + math.cos(rad) * 8, ey + math.sin(rad) * 8)], fill=(185, 25, 40, 255), outline=(255, 60, 80, 255))

        frames.append(canvas)
        
    save_strip(frames, output_path, frame_w, frame_h)

def generate_16_angle_equipment(equip_type, output_path, frame_w=128, frame_h=128):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    angles = [i * (360.0 / 16.0) for i in range(16)]
    frames = []
    
    for deg in angles:
        rad = math.radians(deg)
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        cx, cy = frame_w // 2, int(frame_h * 0.44)
        
        if equip_type == "headband_warrior":
            hw, hh = 24, 7
            draw.ellipse([cx - hw, cy - hh, cx + hw, cy + hh], fill=(210, 30, 45, 255), outline=(130, 15, 25, 255))
            draw.ellipse([cx - hw + 2, cy - 2, cx + hw - 2, cy + 2], fill=(255, 255, 255, 240))
            tail_x = cx - math.cos(rad) * (hw + 6)
            tail_y = cy - math.sin(rad) * (hh + 2)
            draw.line([(cx - math.cos(rad) * hw, cy), (tail_x, tail_y)], fill=(210, 30, 45, 255), width=3)
            
        elif equip_type == "pharaoh_crown":
            draw.polygon([(cx - 22, cy + 4), (cx + 22, cy + 4), (cx + 18, cy - 18), (cx - 18, cy - 18)], fill=(240, 190, 40, 255), outline=(140, 95, 10, 255))
            draw.line([(cx, cy - 18), (cx, cy - 26)], fill=(77, 255, 212, 255), width=3)
            
        elif equip_type == "cyber_visor":
            vx = cx + math.cos(rad) * 16
            vy = cy + math.sin(rad) * 8
            draw.ellipse([vx - 14, vy - 5, vx + 14, vy + 5], fill=(30, 220, 255, 220), outline=(255, 255, 255, 255))

        frames.append(canvas)
        
    save_strip(frames, output_path, frame_w, frame_h)

if __name__ == "__main__":
    base_dir = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
    out_root = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sprites"
    
    FW, FH = 128, 128
    manifest = {
        "format": "WaterdropSurvivorSpritesheetCatalog_v2",
        "frameWidth": FW,
        "frameHeight": FH,
        "categories": {
            "character": {},
            "combat": {},
            "rage_expressions": {},
            "weapons": {},
            "equipment": {}
        }
    }
    
    # Character
    idle_src = os.path.join(base_dir, ".user_uploaded", "media_1787669403784.jpg")
    f = extract_and_clean_frames_auto(idle_src, bg_mode="black", frame_w=FW, frame_h=FH, top_offset_pct=0.088)
    save_strip(f, os.path.join(out_root, "character", "waterdrop-idle-16.png"), FW, FH)
    save_strip(f, os.path.join(out_root, "waterdrop-idle-16.png"), FW, FH)
    manifest["categories"]["character"]["idle"] = { "file": "character/waterdrop-idle-16.png", "frames": len(f), "fps": 12, "loop": True }

    walk_src = os.path.join(base_dir, "waterdrop_walk_sheet_1787669435014.jpg")
    f = extract_and_clean_frames_auto(walk_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.0)
    save_strip(f, os.path.join(out_root, "character", "waterdrop-walk-16.png"), FW, FH)
    save_strip(f, os.path.join(out_root, "waterdrop-walk-16.png"), FW, FH)
    manifest["categories"]["character"]["walk"] = { "file": "character/waterdrop-walk-16.png", "frames": len(f), "fps": 16, "loop": True }

    run_src = os.path.join(base_dir, "waterdrop_run_sheet_1787670517398.jpg")
    f = extract_and_clean_frames_auto(run_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.088)
    save_strip(f, os.path.join(out_root, "character", "waterdrop-run-16.png"), FW, FH)
    manifest["categories"]["character"]["run"] = { "file": "character/waterdrop-run-16.png", "frames": len(f), "fps": 20, "loop": True }

    roll_src = os.path.join(base_dir, "waterdrop_dash_roll_sheet_1787670536566.jpg")
    f = extract_and_clean_frames_auto(roll_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.0)
    save_strip(f, os.path.join(out_root, "character", "waterdrop-roll-16.png"), FW, FH)
    manifest["categories"]["character"]["roll"] = { "file": "character/waterdrop-roll-16.png", "frames": len(f), "fps": 24, "loop": False }

    turn_src = os.path.join(base_dir, "waterdrop_turnaround_sheet_1787669453143.jpg")
    f = extract_and_clean_frames_auto(turn_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.0)
    save_strip(f, os.path.join(out_root, "character", "waterdrop-turnaround-16.png"), FW, FH)
    save_strip(f, os.path.join(out_root, "waterdrop-turnaround-16.png"), FW, FH)
    manifest["categories"]["character"]["turnaround"] = { "file": "character/waterdrop-turnaround-16.png", "frames": len(f), "angles": 16, "fps": 10, "loop": True }

    hurt_src = os.path.join(base_dir, "waterdrop_hurt_sheet_1787670665365.jpg")
    f = extract_and_clean_frames_auto(hurt_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.088)
    save_strip(f, os.path.join(out_root, "character", "waterdrop-hurt-16.png"), FW, FH)
    manifest["categories"]["character"]["hurt"] = { "file": "character/waterdrop-hurt-16.png", "frames": len(f), "fps": 18, "loop": False }

    cheer_src = os.path.join(base_dir, "waterdrop_cheer_sheet_1787669646098.jpg")
    f = extract_and_clean_frames_auto(cheer_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.088)
    save_strip(f, os.path.join(out_root, "character", "waterdrop-levelup-16.png"), FW, FH)
    save_strip(f, os.path.join(out_root, "waterdrop-cheer-16.png"), FW, FH)
    manifest["categories"]["character"]["levelup"] = { "file": "character/waterdrop-levelup-16.png", "frames": len(f), "fps": 16, "loop": False }

    # Combat
    slash_src = os.path.join(base_dir, "waterdrop_katana_slash_sheet_1787670554745.jpg")
    f = extract_and_clean_frames_auto(slash_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.088)
    save_strip(f, os.path.join(out_root, "combat", "waterdrop-katana-slash-16.png"), FW, FH)
    manifest["categories"]["combat"]["katana_slash"] = { "file": "combat/waterdrop-katana-slash-16.png", "frames": len(f), "fps": 22, "weapon": "katana" }

    fin_src = os.path.join(base_dir, "waterdrop_katana_finisher_sheet_1787670586111.jpg")
    f = extract_and_clean_frames_auto(fin_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.0)
    save_strip(f, os.path.join(out_root, "combat", "waterdrop-katana-finisher-16.png"), FW, FH)
    manifest["categories"]["combat"]["katana_finisher"] = { "file": "combat/waterdrop-katana-finisher-16.png", "frames": len(f), "fps": 18, "weapon": "katana", "finisher": True }

    atk_src = os.path.join(base_dir, "waterdrop_attack_sheet_1787669480658.jpg")
    f = extract_and_clean_frames_auto(atk_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.088)
    save_strip(f, os.path.join(out_root, "combat", "waterdrop-hydropistol-shoot-16.png"), FW, FH)
    save_strip(f, os.path.join(out_root, "waterdrop-attack-16.png"), FW, FH)
    manifest["categories"]["combat"]["hydropistol_shoot"] = { "file": "combat/waterdrop-hydropistol-shoot-16.png", "frames": len(f), "fps": 20, "weapon": "hydropistol" }

    bow_src = os.path.join(base_dir, "waterdrop_bow_shoot_sheet_1787670626249.jpg")
    f = extract_and_clean_frames_auto(bow_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.088)
    save_strip(f, os.path.join(out_root, "combat", "waterdrop-bow-shoot-16.png"), FW, FH)
    manifest["categories"]["combat"]["bow_shoot"] = { "file": "combat/waterdrop-bow-shoot-16.png", "frames": len(f), "fps": 18, "weapon": "bow" }

    scythe_src = os.path.join(base_dir, "waterdrop_scythe_spin_sheet_1787670644724.jpg")
    f = extract_and_clean_frames_auto(scythe_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.0)
    save_strip(f, os.path.join(out_root, "combat", "waterdrop-scythe-spin-16.png"), FW, FH)
    manifest["categories"]["combat"]["scythe_whirlwind"] = { "file": "combat/waterdrop-scythe-spin-16.png", "frames": len(f), "fps": 24, "weapon": "bloodscythe" }

    # Rage
    rage_src = os.path.join(base_dir, "waterdrop_rage_sheet_1787670605158.jpg")
    f = extract_and_clean_frames_auto(rage_src, bg_mode="gray", frame_w=FW, frame_h=FH, top_offset_pct=0.0)
    save_strip(f, os.path.join(out_root, "rage_expressions", "waterdrop-rage-states-16.png"), FW, FH)
    manifest["categories"]["rage_expressions"]["rage_states"] = {
        "file": "rage_expressions/waterdrop-rage-states-16.png",
        "frames": len(f),
        "tiers": {
            "tier1_focus": [0, 1, 2, 3],
            "tier2_steaming": [4, 5, 6, 7],
            "tier3_berserk_lasers": [8, 9, 10, 11],
            "cooldown": [12, 13, 14, 15]
        }
    }

    # 16-Angle Weapons
    weapons_to_bake = [
        ("snapped_rib", "weapon-snapped-rib-16angles.png"),
        ("hydropistol", "weapon-hydropistol-16angles.png"),
        ("desert_eagle", "weapon-desert-eagle-16angles.png"),
        ("storm_lance", "weapon-storm-lance-16angles.png"),
        ("tidewood_bow", "weapon-tidewood-bow-16angles.png"),
        ("blood_scythe", "weapon-blood-scythe-16angles.png"),
    ]
    for w_type, filename in weapons_to_bake:
        out_f = os.path.join(out_root, "weapons", filename)
        generate_16_angle_weapon(w_type, out_f, FW, FH)
        manifest["categories"]["weapons"][w_type] = { "file": f"weapons/{filename}", "angles": 16, "equippable": True }

    # 16-Angle Gear
    gear_to_bake = [
        ("headband_warrior", "gear-headband-warrior-16angles.png"),
        ("pharaoh_crown", "gear-pharaoh-crown-16angles.png"),
        ("cyber_visor", "gear-cyber-visor-16angles.png"),
    ]
    for g_type, filename in gear_to_bake:
        out_f = os.path.join(out_root, "equipment", filename)
        generate_16_angle_equipment(g_type, out_f, FW, FH)
        manifest["categories"]["equipment"][g_type] = { "file": f"equipment/{filename}", "angles": 16, "slot": "head" }

    manifest_path = os.path.join(out_root, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nAll assets generated cleanly! Manifest saved to: {manifest_path}")
