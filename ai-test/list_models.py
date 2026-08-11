"""Lists every model currently live on NVIDIA's NIM catalog, optionally
filtered by a substring — use this whenever a model id in try_nvidia.py
410s (NVIDIA retires/renames these fairly often).

Run:
    python list_models.py
    python list_models.py kimi
"""
import sys

from openai import OpenAI

from try_nvidia import load_api_key

filt = sys.argv[1].lower() if len(sys.argv) > 1 else None

client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=load_api_key())
names = sorted(m.id for m in client.models.list().data)
if filt:
    names = [n for n in names if filt in n.lower()]

for n in names:
    print(n)
print(f"\n{len(names)} model(s)")
