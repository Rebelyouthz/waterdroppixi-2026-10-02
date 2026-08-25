import re

with open('frontend/src/game/starRaidRenderer.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 4. Projectiles
# Replace player shots:
old_player_shot = """    // Player shots — bright bolt with a trailing streak and its own light.
    for (const pr of game.projs) {
      const col = pr.color || '#fff44d';
      const len = 12;
      g.rect(pr.x - 1.6, pr.y - len * 0.5, 3.2, len).fill({ color: col, alpha: 0.55 });
      g.circle(pr.x, pr.y, 2.6).fill('#ffffff');
      g.circle(pr.x, pr.y + 3, 1.8).fill({ color: col, alpha: 0.8 });
      this._emitLight(pr.x, pr.y, 22, col, 0.30);
    }"""
new_player_shot = """    // Player shots — plasma bolt with glowing trail
    for (const pr of game.projs) {
      const col = pr.color || '#fff44d';
      const len = 18;
      g.moveTo(pr.x, pr.y + 2).lineTo(pr.x - 2, pr.y - len * 0.4).lineTo(pr.x, pr.y - len).lineTo(pr.x + 2, pr.y - len * 0.4).fill({ color: col, alpha: 0.7 });
      g.circle(pr.x, pr.y, 2.8).fill('#ffffff');
      this._emitLight(pr.x, pr.y, 26, col, 0.40);
    }"""
code = code.replace(old_player_shot.replace('—', '?"'), new_player_shot)
code = code.replace(old_player_shot, new_player_shot)

old_enemy_shot = """    // Enemy shots — hostile red, and they light the field too so incoming
    // fire is legible against a busy background.
    for (const ep of game.eprojs) {
      const col = ep.color || '#ff5566';
      g.circle(ep.x, ep.y, 4.6).fill({ color: col, alpha: 0.35 });
      g.circle(ep.x, ep.y, 2.8).fill(col);
      g.circle(ep.x - 0.8, ep.y - 0.8, 1.2).fill({ color: '#ffe0e0', alpha: 0.9 });
      this._emitLight(ep.x, ep.y, 18, col, 0.34);
    }"""
new_enemy_shot = """    // Enemy shots — plasma drops with glowing trails
    for (const ep of game.eprojs) {
      const col = ep.color || '#ff5566';
      const len = 14;
      g.moveTo(ep.x, ep.y - 2).lineTo(ep.x - 2.5, ep.y + len * 0.4).lineTo(ep.x, ep.y + len).lineTo(ep.x + 2.5, ep.y + len * 0.4).fill({ color: col, alpha: 0.65 });
      g.circle(ep.x, ep.y, 3.2).fill('#ffffff');
      g.circle(ep.x - 0.8, ep.y - 0.8, 1.2).fill({ color: '#ffe0e0', alpha: 0.9 });
      this._emitLight(ep.x, ep.y, 22, col, 0.40);
    }"""
code = code.replace(old_enemy_shot.replace('—', '?"'), new_enemy_shot)
code = code.replace(old_enemy_shot, new_enemy_shot)

with open('frontend/src/game/starRaidRenderer.js', 'w', encoding='utf-8') as f:
    f.write(code)
