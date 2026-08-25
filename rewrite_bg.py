import re

with open('frontend/src/game/starRaidRenderer.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 6. Richer background
# More nebulas and more asteroid belts

old_belt = """    // Asteroid belt — closest background layer, tumbling.
    this._belt = [];
    for (let i = 0; i < 26; i++) {
      this._belt.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rnd(3, 11), rot: Math.random() * TAU, spin: rnd(-1.4, 1.4),
        speed: rnd(60, 120), sides: 5 + ((Math.random() * 3) | 0),
      });
    }

    // Nebula clouds — a handful of soft coloured blobs, slowest of all.
    this._nebulas = [];
    const hues = ['#5a2a8a', '#1f5a7a', '#7a2a4a'];
    for (let i = 0; i < 4; i++) {
      this._nebulas.push({
        x: rnd(-W * 0.2, W * 1.2), y: rnd(-H * 0.5, H * 1.2),
        r: rnd(H * 0.16, H * 0.34), color: hues[(Math.random() * hues.length) | 0],
        speed: rnd(2, 5),
      });
    }"""

new_belt = """    // Asteroid belt — deeper, multi-layered belts with more varied shapes and sizes
    this._belt = [];
    for (let i = 0; i < 65; i++) {
      const isFar = Math.random() < 0.6;
      this._belt.push({
        x: Math.random() * W, y: Math.random() * H,
        r: isFar ? rnd(2, 6) : rnd(7, 18),
        rot: Math.random() * TAU, spin: rnd(-1.4, 1.4) * (isFar ? 0.6 : 1),
        speed: rnd(50, 140) * (isFar ? 0.5 : 1),
        sides: 5 + ((Math.random() * 4) | 0),
        dark: isFar
      });
    }

    // Nebula clouds — richer, multi-layered AAA volumetric clouds
    this._nebulas = [];
    const hues = ['#4a1a7a', '#154a6a', '#7a1a3a', '#0f3a4a', '#8a3a1a'];
    for (let i = 0; i < 9; i++) {
      this._nebulas.push({
        x: rnd(-W * 0.3, W * 1.3), y: rnd(-H * 0.5, H * 1.5),
        r: rnd(H * 0.2, H * 0.45), color: hues[(Math.random() * hues.length) | 0],
        speed: rnd(1.5, 6),
      });
    }"""
code = code.replace(old_belt.replace('—', '?"'), new_belt)
code = code.replace(old_belt, new_belt)

old_belt_draw = """    // Asteroid belt
    const gb = this.gBelt; gb.clear();
    for (const a of this._belt) {
      a.y += a.speed * dt;
      a.rot += a.spin * dt;
      if (a.y - a.r > H) { a.y = -a.r; a.x = Math.random() * W; }
      const pts = [];
      for (let i = 0; i < a.sides; i++) {
        const ang = a.rot + (i / a.sides) * TAU;
        const rr = a.r * (0.72 + ((i * 37) % 5) * 0.07);
        pts.push(a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr);
      }
      gb.poly(pts).fill({ color: '#5a5348', alpha: 0.62 });
      gb.circle(a.x - a.r * 0.25, a.y - a.r * 0.25, a.r * 0.3).fill({ color: '#8a8375', alpha: 0.35 });
    }"""

new_belt_draw = """    // Asteroid belt
    const gb = this.gBelt; gb.clear();
    for (const a of this._belt) {
      a.y += a.speed * dt;
      a.rot += a.spin * dt;
      if (a.y - a.r > H) { a.y = -a.r; a.x = Math.random() * W; }
      const pts = [];
      for (let i = 0; i < a.sides; i++) {
        const ang = a.rot + (i / a.sides) * TAU;
        const rr = a.r * (0.7 + ((i * 41) % 7) * 0.06);
        pts.push(a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr);
      }
      const baseCol = a.dark ? '#3a3328' : '#5a5348';
      const litCol = a.dark ? '#5a5345' : '#8a8375';
      const alpha = a.dark ? 0.4 : 0.7;
      gb.poly(pts).fill({ color: baseCol, alpha: alpha });
      // Edge highlight instead of flat circle crater for better depth
      gb.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]).lineTo(pts[4], pts[5]).stroke({ width: a.r*0.2, color: litCol, alpha: alpha * 0.8 });
    }"""

code = code.replace(old_belt_draw, new_belt_draw)

with open('frontend/src/game/starRaidRenderer.js', 'w', encoding='utf-8') as f:
    f.write(code)
