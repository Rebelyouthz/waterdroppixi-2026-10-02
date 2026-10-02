import shutil
import glob
import os

ARTIFACT_DIR = r"C:\Users\timmi\.gemini\antigravity-ide\brain\e6b535d3-b329-4115-ae65-7826a9340d4c"
DEST_DIR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\studio"

os.makedirs(DEST_DIR, exist_ok=True)

patterns = {
    "deadcells_hero_5styles.jpg": "deadcells_hero_5styles_*.jpg",
    "deadcells_xp_gems_5styles.jpg": "deadcells_xp_gems_5styles_*.jpg",
    "deadcells_chests_5styles.jpg": "deadcells_chests_5styles_*.jpg",
    "deadcells_ui_hud_5styles.jpg": "deadcells_ui_hud_5styles_*.jpg",
    "deadcells_weapons_5styles.jpg": "deadcells_weapons_5styles_*.jpg",
}

for dest_name, pat in patterns.items():
    matches = glob.glob(os.path.join(ARTIFACT_DIR, pat))
    if matches:
        latest = max(matches, key=os.path.getmtime)
        target = os.path.join(DEST_DIR, dest_name)
        shutil.copy2(latest, target)
        print(f"Copied {latest} -> {target}")
    else:
        print(f"No match for {pat}")
