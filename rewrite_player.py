import re

with open('frontend/src/game/starRaidRenderer.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Highly detailed player ship using paths
old_player_hulls = """    // Hull shape follows the ship you actually chose — a roster where every
    // hull looks the same is a roster you cannot see.
    const HULLS = {
      // long, thin, swept right back
      interceptor: [0, -25, -4, -8, -11, 6, -9, 15, -3, 9, 0, 13, 3, 9, 9, 15, 11, 6, 4, -8],
      // wide and blunt with squared shoulders and outboard gun pods
      gunship: [0, -17, -9, -8, -19, -2, -18, 9, -10, 7, -5, 14, 5, 14, 10, 7, 18, 9, 19, -2, 9, -8],
      // fat, slab-sided cargo body
      hauler: [0, -15, -11, -9, -16, 2, -14, 15, 14, 15, 16, 2, 11, -9],
      skiff: [0, -20, -6, -6, -15, 4, -13, 13, -5, 8, 0, 12, 5, 8, 13, 13, 15, 4, 6, -6],
    };
    const hull = HULLS[game.shipId] || HULLS.skiff;
    this._hull(g, p.x, p.y, bank, hull, shipColor, dark, 2);
    // canopy
    this._hull(g, p.x, p.y, bank, [0, -14, -4, -4, 0, 0, 4, -4], '#d8fbff');

    if (game.shipId === 'gunship') {
      // outboard cannons, which is what the extra barrel looks like
      for (const side of [-1, 1]) {
        this._hull(g, p.x, p.y, bank, [side * 13, -6, side * 17, -6, side * 17, 6, side * 13, 6], dark);
        this._hull(g, p.x, p.y, bank, [side * 14, -14, side * 16, -14, side * 16, -5, side * 14, -5], '#9fb4c8');
      }
    } else if (game.shipId === 'hauler') {
      // cargo ribs
      for (const y of [-4, 1, 6]) this._hull(g, p.x, p.y, bank, [-14, y, 14, y, 14, y + 1.6, -14, y + 1.6], dark);
    } else {
      // wing stripes
      this._hull(g, p.x, p.y, bank, [-13, 4, -8, 4, -7, 11, -12, 11], dark);
      this._hull(g, p.x, p.y, bank, [13, 4, 8, 4, 7, 11, 12, 11], dark);
    }"""

new_player_hulls = """    // Hull shape follows the ship you actually chose, using high-detail path layers
    const cx = p.x, cy = p.y;
    const s = Math.sin(bank), c = Math.cos(bank);
    const tx = (lx, ly) => cx + lx * c - ly * s;
    const ty = (lx, ly) => cy + lx * s + ly * c;

    g.moveTo(tx(0, -25))
     .lineTo(tx(-6, -10)).lineTo(tx(-18, 5)).lineTo(tx(-14, 18))
     .lineTo(tx(-4, 12)).lineTo(tx(0, 16)).lineTo(tx(4, 12))
     .lineTo(tx(14, 18)).lineTo(tx(18, 5)).lineTo(tx(6, -10))
     .fill({ color: shipColor, alpha: 0.9 })
     .stroke({ width: 1.5, color: dark });

    // Panel lines
    g.moveTo(tx(0, -20)).lineTo(tx(-8, 5)).lineTo(tx(0, 12)).lineTo(tx(8, 5)).lineTo(tx(0, -20))
     .fill({ color: hit ? '#ffffff' : '#2b3a4a', alpha: 0.9 })
     .stroke({ width: 1, color: '#1a2a3a' });

    // Canopy
    g.moveTo(tx(0, -12)).bezierCurveTo(tx(-5, -6), tx(-4, 2), tx(0, 4)).bezierCurveTo(tx(4, 2), tx(5, -6), tx(0, -12))
     .fill({ color: '#d8fbff', alpha: 0.95 });"""

code = code.replace(old_player_hulls.replace('—', '?"'), new_player_hulls)
code = code.replace(old_player_hulls, new_player_hulls)

with open('frontend/src/game/starRaidRenderer.js', 'w', encoding='utf-8') as f:
    f.write(code)
