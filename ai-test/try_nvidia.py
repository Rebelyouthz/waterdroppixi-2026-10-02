"""
Standalone test of NVIDIA NIM's free-tier hosted models (Kimi K2 / MiniMax),
completely separate from the game — nothing here is imported by frontend/ or
backend/. Point is just to see what these can do before deciding whether to
build anything on top of them.

NVIDIA NIM speaks the OpenAI Chat Completions API, so the standard `openai`
Python package works — you just point it at NVIDIA's base_url instead of
OpenAI's.

Setup:
    pip install openai
    (reads NVIDIA_API_KEY from backend/.env, or set the env var yourself)

Run:
    python try_nvidia.py
    python try_nvidia.py "your own prompt here"
    python try_nvidia.py --model minimaxai/minimax-m1-80k "your prompt"

If a MODEL id below 404s, NVIDIA's catalog page lists the current exact
slug for each model (search "Kimi" / "MiniMax" there) — swap it in and
everything else stays the same:
    https://build.nvidia.com
"""
import os
import sys
from pathlib import Path

from openai import OpenAI

# Confirmed live on NVIDIA's catalog (queried /v1/models directly) — the
# original guesses (kimi-k2-instruct, minimax-m1-80k) had both hit end-of-
# life. Re-check via `python list_models.py` if either breaks again.
#
# minimax: confirmed WORKING with this key.
# kimi: listed in /v1/models but calling it 404s ("Function ... Not found
#   for account") — that's NVIDIA gating access per-account, not a bug here.
#   Open https://build.nvidia.com/moonshotai/kimi-k2-6 and look for a
#   "Request Access" / "Get API Key" button; once granted it should work
#   with the same key and no code change.
MODELS = {
    "kimi": "moonshotai/kimi-k2.6",
    "minimax": "minimaxai/minimax-m3",
}
DEFAULT_MODEL = MODELS["minimax"]


def load_api_key() -> str:
    key = os.environ.get("NVIDIA_API_KEY")
    if key:
        return key
    # Fall back to reading backend/.env directly, so this script works
    # standalone without needing python-dotenv or a shell export.
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("NVIDIA_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit(
        f"No NVIDIA_API_KEY found (checked env var and {env_path}). "
        "Set it or add it to backend/.env."
    )


def main():
    args = sys.argv[1:]
    model = DEFAULT_MODEL
    if args and args[0] == "--model":
        alias = args[1]
        model = MODELS.get(alias, alias)  # allow either a short alias or a raw slug
        args = args[2:]
    prompt = " ".join(args) if args else "Say hello in one short sentence, and name yourself."

    client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=load_api_key())

    print(f"--- model: {model} ---")
    print(f"--- prompt: {prompt} ---\n")

    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=512,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            print(delta, end="", flush=True)
    print()


if __name__ == "__main__":
    main()
