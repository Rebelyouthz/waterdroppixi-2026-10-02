import os
import wave
import math
import struct
import numpy as np

SAMPLE_RATE = 44100
SOUNDS_DIR = r"c:\Users\timmi\WaterdropPixi\wd2d2Pixi-main\frontend\public\sounds"

def save_wav(filename, samples_left, samples_right=None):
    os.makedirs(SOUNDS_DIR, exist_ok=True)
    filepath = os.path.join(SOUNDS_DIR, filename)
    
    if samples_right is None:
        samples_right = samples_left
        
    # Normalize to prevent clipping
    max_val = max(np.max(np.abs(samples_left)), np.max(np.abs(samples_right)))
    if max_val > 0.95:
        samples_left = (samples_left / max_val) * 0.95
        samples_right = (samples_right / max_val) * 0.95
        
    int_left = (samples_left * 32767).astype(np.int16)
    int_right = (samples_right * 32767).astype(np.int16)
    
    # Interleave stereo
    stereo = np.empty((len(int_left) * 2,), dtype=np.int16)
    stereo[0::2] = int_left
    stereo[1::2] = int_right
    
    with wave.open(filepath, 'w') as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(stereo.tobytes())
        
    print(f"Generated High-Fidelity Audio: {filename} ({len(samples_left) / SAMPLE_RATE:.2f}s)")

# =============================================================================
# SYNTHESIS DSP UTILITIES
# =============================================================================

def time_array(duration):
    return np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)

def apply_envelope(samples, attack=0.01, decay=0.05, sustain=0.7, release=0.1):
    n = len(samples)
    env = np.ones(n, dtype=np.float32)
    
    att_samples = int(attack * SAMPLE_RATE)
    dec_samples = int(decay * SAMPLE_RATE)
    rel_samples = int(release * SAMPLE_RATE)
    
    if att_samples > 0:
        env[:att_samples] = np.linspace(0, 1, att_samples)
    if dec_samples > 0 and att_samples + dec_samples <= n:
        env[att_samples:att_samples + dec_samples] = np.linspace(1, sustain, dec_samples)
    if rel_samples > 0 and rel_samples <= n:
        env[-rel_samples:] = np.linspace(sustain if att_samples + dec_samples < n - rel_samples else 1, 0, rel_samples)
        
    return samples * env

def reverb_simple(samples, delays=[0.03, 0.05, 0.07, 0.11], decays=[0.4, 0.3, 0.2, 0.15]):
    out = np.copy(samples)
    for d, decay in zip(delays, decays):
        d_samples = int(d * SAMPLE_RATE)
        if d_samples < len(samples):
            delayed = np.zeros_like(samples)
            delayed[d_samples:] = samples[:-d_samples] * decay
            out += delayed
    return out

# =============================================================================
# 1. CAMP FOOTSTEPS (WATERDROP ON TITANIUM)
# =============================================================================

def generate_footsteps():
    for i in range(1, 5):
        dur = 0.18
        t = time_array(dur)
        
        # Metal tap (high frequency ping with fast decay)
        freq_tap = 1600 + (i * 120)
        metal_tap = np.sin(2 * np.pi * freq_tap * t) * np.exp(-t * 60)
        
        # Hydro droplet thud (low sub squish)
        freq_thud = 140 - (i * 10)
        thud = np.sin(2 * np.pi * freq_thud * t) * np.exp(-t * 30)
        
        # Water splash texture
        noise = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 40)
        
        footstep = (metal_tap * 0.4 + thud * 0.5 + noise * 0.2)
        footstep = apply_envelope(footstep, attack=0.002, release=0.08)
        save_wav(f"camp-step-{i}.wav", footstep * 0.7)

# =============================================================================
# 2. STATION INTERACTION & AMBIENT SFX
# =============================================================================

def generate_station_sfx():
    # 🧭 A. Navigation Radar Ping & Hologram Boot
    dur = 0.8
    t = time_array(dur)
    radar_ping = np.sin(2 * np.pi * (1800 - t * 400) * t) * np.exp(-t * 6)
    radar_sub = np.sin(2 * np.pi * 320 * t) * np.exp(-t * 8)
    hologram_hum = np.sin(2 * np.pi * 880 * t) * (1 + 0.3 * np.sin(2 * np.pi * 30 * t)) * np.exp(-t * 3)
    nav_sound = reverb_simple(radar_ping * 0.5 + radar_sub * 0.3 + hologram_hum * 0.3)
    save_wav("camp-nav-radar.wav", nav_sound)
    
    # 🔥 B. Weapon Forge Clang & Plasma Ignite
    dur = 1.2
    t = time_array(dur)
    anvil_strike = np.sin(2 * np.pi * 520 * t) * np.exp(-t * 5) + np.sin(2 * np.pi * 1040 * t) * np.exp(-t * 8) * 0.6
    plasma_hiss = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 4) * (1 + np.sin(2 * np.pi * 15 * t))
    magma_rumble = np.sin(2 * np.pi * (90 + 20 * np.sin(2 * np.pi * 8 * t)) * t) * np.exp(-t * 2)
    forge_sound = reverb_simple(anvil_strike * 0.6 + plasma_hiss * 0.35 + magma_rumble * 0.4)
    save_wav("camp-forge-strike.wav", forge_sound)
    
    # 💧 C. A.I.D.A. Core Data Chime & Water AI Harmonic
    dur = 1.4
    t = time_array(dur)
    chime1 = np.sin(2 * np.pi * 587.33 * t) * np.exp(-t * 2.5)  # D5
    chime2 = np.sin(2 * np.pi * 880.00 * t) * np.exp(-t * 3.0)  # A5
    chime3 = np.sin(2 * np.pi * 1174.66 * t) * np.exp(-t * 3.5) # D6
    core_hum = np.sin(2 * np.pi * 146.83 * t) * (1 + 0.2 * np.sin(2 * np.pi * 4 * t)) * np.exp(-t * 1.5)
    aida_sound = reverb_simple(chime1 * 0.35 + chime2 * 0.35 + chime3 * 0.25 + core_hum * 0.3, delays=[0.05, 0.1, 0.2, 0.35])
    save_wav("camp-aida-chime.wav", aida_sound)
    
    # 🧪 D. Bio Lab Cryo Bubble & Sonar Pulse
    dur = 1.0
    t = time_array(dur)
    bio_bubble = np.sin(2 * np.pi * (300 + 400 * t * t) * t) * np.exp(-t * 5)
    sonar = np.sin(2 * np.pi * 1250 * t) * np.exp(-t * 4)
    sub_fluid = np.sin(2 * np.pi * (110 + 15 * np.sin(2 * np.pi * 6 * t)) * t) * np.exp(-t * 2)
    biolab_sound = reverb_simple(bio_bubble * 0.45 + sonar * 0.3 + sub_fluid * 0.35)
    save_wav("camp-biolab-bubble.wav", biolab_sound)
    
    # 🌊 E. Reclamation Well Crystal Cascade Splash
    dur = 0.9
    t = time_array(dur)
    drop_hi = np.sin(2 * np.pi * (2200 - 1400 * t) * t) * np.exp(-t * 7)
    water_ring = np.sin(2 * np.pi * 440 * t) * np.exp(-t * 4)
    splash = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 6) * 0.2
    well_sound = reverb_simple(drop_hi * 0.5 + water_ring * 0.4 + splash)
    save_wav("camp-well-splash.wav", well_sound)
    
    # 🚪 F. Hangar Blast Door Pneumatic Release
    dur = 1.1
    t = time_array(dur)
    pneumatic = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 3.5)
    heavy_thud = np.sin(2 * np.pi * 75 * t) * np.exp(-t * 4)
    beacon_strobe = np.sin(2 * np.pi * 960 * t) * np.exp(-t * 8)
    hangar_sound = reverb_simple(pneumatic * 0.4 + heavy_thud * 0.6 + beacon_strobe * 0.2)
    save_wav("camp-hangar-door.wav", hangar_sound)
    
    # 📡 G. Defense Bunker Forcefield Lock
    dur = 0.85
    t = time_array(dur)
    shield_pulse = np.sin(2 * np.pi * (400 + 800 * t) * t) * np.exp(-t * 4)
    target_lock = np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 9)
    defense_sound = reverb_simple(shield_pulse * 0.5 + target_lock * 0.4)
    save_wav("camp-defense-lock.wav", defense_sound)
    
    # 🌀 H. Departure Teleport Portal Warp Singularity
    dur = 1.6
    t = time_array(dur)
    warp_rise = np.sin(2 * np.pi * (80 + 900 * (t ** 1.8)) * t) * apply_envelope(np.ones_like(t), attack=0.1, release=0.3)
    vortex_swirl = np.sin(2 * np.pi * 220 * t) * (1 + np.sin(2 * np.pi * 12 * t)) * apply_envelope(np.ones_like(t), attack=0.05, release=0.2)
    quantum_hiss = np.random.uniform(-1, 1, len(t)) * (t / dur) * apply_envelope(np.ones_like(t), attack=0.2, release=0.1)
    portal_sound = reverb_simple(warp_rise * 0.55 + vortex_swirl * 0.35 + quantum_hiss * 0.25, delays=[0.08, 0.16, 0.28, 0.45])
    save_wav("camp-portal-warp.wav", portal_sound)

# =============================================================================
# 3. ATMOSPHERIC CAMP SANCTUARY MUSIC & AMBIENT DRONE (30 SECONDS STEREO LOOP)
# =============================================================================

def generate_camp_ambient_music():
    dur = 24.0  # 24s smooth looping ambient sanctuary music
    t = time_array(dur)
    
    # Celestial synth chords (Fmaj9 -> Cmaj7 -> Dm9 -> Am7)
    chord_progression = [
        # Chord 1: Fmaj9 (F3, A3, C4, E4, G4)
        (0.0, 6.0, [174.61, 220.00, 261.63, 329.63, 392.00]),
        # Chord 2: Cmaj7 (C3, G3, B3, E4, G4)
        (6.0, 12.0, [130.81, 196.00, 246.94, 329.63, 392.00]),
        # Chord 3: Dm9 (D3, A3, C4, F4, E5)
        (12.0, 18.0, [146.83, 220.00, 261.63, 349.23, 659.25]),
        # Chord 4: Am7 (A2, E3, G3, C4, E4)
        (18.0, 24.0, [110.00, 164.81, 196.00, 261.63, 329.63])
    ]
    
    left_channel = np.zeros_like(t)
    right_channel = np.zeros_like(t)
    
    # Warm analog synth pad
    for t_start, t_end, freqs in chord_progression:
        idx_start = int(t_start * SAMPLE_RATE)
        idx_end = int(t_end * SAMPLE_RATE)
        t_segment = t[idx_start:idx_end] - t_start
        seg_dur = t_end - t_start
        
        seg_left = np.zeros_like(t_segment)
        seg_right = np.zeros_like(t_segment)
        
        for fi, f in enumerate(freqs):
            # Slow chorus detune
            detune_l = np.sin(2 * np.pi * (f * 0.998) * t_segment)
            detune_r = np.sin(2 * np.pi * (f * 1.002) * t_segment)
            
            # Subtle octave harmonic
            harm_l = np.sin(2 * np.pi * (f * 2) * t_segment) * 0.2
            harm_r = np.sin(2 * np.pi * (f * 2) * t_segment) * 0.2
            
            weight = 0.18 / math.sqrt(len(freqs))
            seg_left += (detune_l + harm_l) * weight
            seg_right += (detune_r + harm_r) * weight
            
        # Smooth attack & crossfade envelope
        seg_env = apply_envelope(np.ones_like(t_segment), attack=1.2, decay=0.5, sustain=0.9, release=1.4)
        left_channel[idx_start:idx_end] += seg_left * seg_env
        right_channel[idx_start:idx_end] += seg_right * seg_env
        
    # Cosmic deep space drone sub-bass (55 Hz + 110 Hz warm analog filter)
    sub_drone_l = np.sin(2 * np.pi * 55.0 * t + 0.1 * np.sin(2 * np.pi * 0.2 * t)) * 0.22
    sub_drone_r = np.sin(2 * np.pi * 55.2 * t + 0.1 * np.sin(2 * np.pi * 0.2 * t)) * 0.22
    left_channel += sub_drone_l
    right_channel += sub_drone_r
    
    # Twinkling starlight chimes arpeggios
    chime_notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]
    for ch_i in range(16):
        ch_time = ch_i * 1.5 + (ch_i % 3) * 0.2
        if ch_time + 1.8 < dur:
            ch_idx = int(ch_time * SAMPLE_RATE)
            ch_len = int(1.8 * SAMPLE_RATE)
            t_ch = np.linspace(0, 1.8, ch_len, endpoint=False)
            f_ch = chime_notes[ch_i % len(chime_notes)]
            
            ch_wave = np.sin(2 * np.pi * f_ch * t_ch) * np.exp(-t_ch * 2.8) * 0.12
            pan_l = 0.7 if ch_i % 2 == 0 else 0.3
            pan_r = 0.3 if ch_i % 2 == 0 else 0.7
            
            left_channel[ch_idx:ch_idx + ch_len] += ch_wave * pan_l
            right_channel[ch_idx:ch_idx + ch_len] += ch_wave * pan_r
            
    # Apply warm stereo space reverb
    left_channel = reverb_simple(left_channel, delays=[0.06, 0.14, 0.25, 0.45], decays=[0.35, 0.25, 0.18, 0.12])
    right_channel = reverb_simple(right_channel, delays=[0.08, 0.17, 0.29, 0.48], decays=[0.35, 0.25, 0.18, 0.12])
    
    save_wav("camp-sanctuary-music-loop.wav", left_channel * 0.75, right_channel * 0.75)

# =============================================
# 4. AWAKENING CUTSCENE, A.I.D.A. VOICES & BLAST SHUTTER SFX
# =============================================

def generate_awakening_and_aida_audio():
    # 💥 A. Heavy Power Relay Strikes (*BONG... BONG... BONG...*)
    for i, base_freq in enumerate([65, 82, 110], 1):
        dur = 1.4
        t = time_array(dur)
        # Deep electromagnetic thud + resonant iron ring
        sub_thud = np.sin(2 * np.pi * base_freq * t) * np.exp(-t * 3.5)
        iron_ring = np.sin(2 * np.pi * (base_freq * 3.2) * t) * np.exp(-t * 4.5) * 0.6
        spark_fizzle = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 8.0) * 0.3
        relay = reverb_simple(sub_thud * 0.7 + iron_ring * 0.4 + spark_fizzle * 0.25, delays=[0.05, 0.12, 0.22], decays=[0.4, 0.25, 0.15])
        save_wav(f"camp-power-relay-{i}.wav", relay)

    # ⚡ B. Electrical Sparks & Arc Burst
    dur = 0.6
    t = time_array(dur)
    spark_noise = np.random.uniform(-1, 1, len(t)) * (np.sin(2 * np.pi * 45 * t) ** 2) * np.exp(-t * 5)
    arc_buzz = np.sin(2 * np.pi * 120 * t) * np.exp(-t * 4) * 0.4
    save_wav("camp-sparks.wav", spark_noise * 0.6 + arc_buzz)

    # 💨 C. High-Pressure Pneumatic Vent Purge
    dur = 0.9
    t = time_array(dur)
    steam = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 2.8) * apply_envelope(np.ones_like(t), attack=0.02, release=0.2)
    save_wav("camp-steam-release.wav", steam * 0.55)

    # 🎵 D. A.I.D.A. Crystal Harmonic Vocalizations (Dialogue voice beeps)
    aida_motifs = [
        [587.33, 880.00],          # D5 -> A5 (Calm/Curious)
        [659.25, 987.77, 1318.51], # E5 -> B5 -> E6 (Happy/Proud)
        [440.00, 415.30]           # A4 -> G#4 (Sarcastic/Warning)
    ]
    for vi, notes in enumerate(aida_motifs, 1):
        dur = 0.35
        t = time_array(dur)
        voice_wave = np.zeros_like(t)
        step_len = dur / len(notes)
        for ni, freq in enumerate(notes):
            n_start = int(ni * step_len * SAMPLE_RATE)
            n_end = int((ni + 1) * step_len * SAMPLE_RATE)
            t_sub = t[n_start:n_end] - (ni * step_len)
            tone = np.sin(2 * np.pi * freq * t_sub) * np.exp(-t_sub * 12)
            harm = np.sin(2 * np.pi * freq * 2 * t_sub) * np.exp(-t_sub * 16) * 0.3
            voice_wave[n_start:n_end] += tone + harm
        save_wav(f"camp-aida-voice-{vi}.wav", reverb_simple(voice_wave * 0.45))

    # 🪟 E. Armored Blast Shutter Slide (Heavy motorized hull plates)
    dur = 2.2
    t = time_array(dur)
    motor_hum = np.sin(2 * np.pi * 95 * t) * (1 + 0.2 * np.sin(2 * np.pi * 8 * t)) * apply_envelope(np.ones_like(t), attack=0.2, release=0.3)
    metal_slide = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 1.5) * 0.3
    hydraulic_lock = np.sin(2 * np.pi * 60 * t) * np.exp(-t * 5) * 0.5
    shutter = reverb_simple(motor_hum * 0.5 + metal_slide * 0.3 + hydraulic_lock * 0.4)
    save_wav("camp-shutter-open.wav", shutter)

    # 🔨 F. Station Upgrade/Construction Complete Dopamine Fanfare
    dur = 1.6
    t = time_array(dur)
    chords = [392.00, 523.25, 659.25, 783.99, 1046.50]  # G4, C5, E5, G5, C6
    fanfare = np.zeros_like(t)
    for ci, cf in enumerate(chords):
        c_time = ci * 0.12
        c_idx = int(c_time * SAMPLE_RATE)
        t_note = t[c_idx:] - c_time
        note_wave = np.sin(2 * np.pi * cf * t_note) * np.exp(-t_note * 3.5) * 0.22
        fanfare[c_idx:] += note_wave
    save_wav("camp-build-complete.wav", reverb_simple(fanfare * 0.65))

# =============================================================================
# RUN GENERATION PIPELINE
# =============================================================================

if __name__ == "__main__":
    print("=================================================================")
    print("GENERATING MASTERPIECE WALKABLE CAMP AUDIO & MUSIC PIPELINE...")
    print("=================================================================")
    
    print("\n--- 1. Generating Titanium & Waterdrop Footsteps ---")
    generate_footsteps()
    
    print("\n--- 2. Generating Station Interactive & Ambient SFX ---")
    generate_station_sfx()
    
    print("\n--- 3. Generating Atmospheric Camp Sanctuary Music Loop ---")
    generate_camp_ambient_music()

    print("\n--- 4. Generating Awakening Cutscene, AIDA Voices & Blast Shutter SFX ---")
    generate_awakening_and_aida_audio()
    
    print("\n=================================================================")
    print("ALL WALKABLE CAMP AUDIO & MUSIC ASSETS SUCCESSFULLY GENERATED!")
    print("=================================================================")
