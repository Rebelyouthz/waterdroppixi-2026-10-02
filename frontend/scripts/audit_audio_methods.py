import re
import os
import glob

src_dir = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\src"

# Extract methods defined on Audio
audio_file = os.path.join(src_dir, "game", "audio.js")
with open(audio_file, "r", encoding="utf-8") as f:
    audio_content = f.read()

# Match method definitions inside Audio object: e.g. name(...) { or name: ...
# Let's find Audio = { ... }
audio_keys = set()
for match in re.finditer(r'^\s*([a-zA-Z0-9_$]+)\s*(?:\([^)]*\)\s*\{|:\s*(?:function|\()|\b)', audio_content, re.MULTILINE):
    k = match.group(1)
    if k not in ['const', 'let', 'var', 'function', 'if', 'for', 'while', 'switch', 'return', 'try', 'catch', 'import', 'export', 'default']:
        audio_keys.add(k)

print(f"Found {len(audio_keys)} candidate keys in audio.js")

# Find all Audio.method() calls across all JS/JSX files
audio_calls = {}
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.js', '.jsx', '.mjs')):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            for m in re.finditer(r'Audio\.([a-zA-Z0-9_$]+)', content):
                method = m.group(1)
                audio_calls.setdefault(method, []).append(f"{os.path.relpath(path, src_dir)}")

print("\n--- Audio calls analysis ---")
missing = []
for method, locations in sorted(audio_calls.items()):
    # Check if method exists in audio_content
    # e.g. "method(" or "method:"
    exists = bool(re.search(rf'\b{method}\s*[:\(]', audio_content))
    status = "EXISTS" if exists else "MISSING !!!"
    if not exists:
        missing.append((method, locations))
    print(f"Audio.{method:20} -> {status:12} (used in {len(locations)} places: {', '.join(set(locations))})")

print(f"\nTotal Missing Audio Methods: {len(missing)}")
for m, locs in missing:
    print(f"  - Audio.{m} -> in {locs}")
