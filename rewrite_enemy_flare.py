import re

with open('frontend/src/game/starRaidRenderer.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 2. Dynamic engine flares for enemy ships
old_enemy_flare = """    // Engine flare out the back of every hull, pulsing.
    const ex = e.x - Math.cos(ang) * r * 0.85;
    const ey = e.y - Math.sin(ang) * r * 0.85;
    const pulse = 0.75 + Math.sin((e._t = (e._t || 0) + dt * 14)) * 0.25;
    g.circle(ex, ey, r * 0.26 * pulse).fill({ color: '#ffb066', alpha: 0.85 });
    this._emitLight(ex, ey, r * 1.5 * pulse, '#ff8a33', 0.35);"""

new_enemy_flare = """    // Dynamic engine flare out the back of every hull, pulsing and scaling with speed.
    const speed = Math.hypot(e.vx || 0, e.vy || 0);
    const thrust = Math.min(1, speed / 80);
    const ex = e.x - Math.cos(ang) * r * 0.85;
    const ey = e.y - Math.sin(ang) * r * 0.85;
    const pulse = 0.5 + Math.sin((e._t = (e._t || 0) + dt * (14 + thrust * 10))) * 0.2 + thrust * 0.5;
    
    // Core flare
    g.circle(ex, ey, r * 0.26 * pulse).fill({ color: '#ffb066', alpha: 0.85 });
    // Bright center
    g.circle(ex, ey, r * 0.15 * pulse).fill({ color: '#ffffff', alpha: 0.9 });
    
    // Tail trail based on thrust
    const tailLen = r * 0.8 * thrust * (0.8 + Math.random() * 0.4);
    const tailX = ex - Math.cos(ang) * tailLen;
    const tailY = ey - Math.sin(ang) * tailLen;
    g.moveTo(ex - Math.sin(ang)*r*0.15, ey + Math.cos(ang)*r*0.15)
     .lineTo(tailX, tailY)
     .lineTo(ex + Math.sin(ang)*r*0.15, ey - Math.cos(ang)*r*0.15)
     .fill({ color: '#ff9a4d', alpha: 0.6 });

    this._emitLight(ex, ey, r * 1.5 * pulse, '#ff8a33', 0.35 + thrust * 0.2);"""

code = code.replace(old_enemy_flare, new_enemy_flare)

with open('frontend/src/game/starRaidRenderer.js', 'w', encoding='utf-8') as f:
    f.write(code)
