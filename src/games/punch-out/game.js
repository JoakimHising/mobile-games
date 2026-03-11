import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700;

  let gameActive = false;
  let showInstruction = true;
  let punchesAvoided = 0;

  // Incoming punches
  let punches = [];
  let punchTimer = 0;
  let punchInterval = 1.5;

  // Player
  let player = { x: W / 2, y: H * 0.65, state: 'idle', duckTimer: 0, dodgeDir: 0, dodgeTimer: 0, size: 60 };

  // Glove warning indicators
  let warnings = [];

  function spawnPunch(engine) {
    const difficulty = Math.min(punchesAvoided, 50);
    const speed = 250 + difficulty * 6;

    // Punch types: high (duck), left (dodge right), right (dodge left)
    const types = ['high', 'left', 'right'];
    let type = types[Math.floor(Math.random() * types.length)];

    // After 10, can do combos (two punches close together)
    const isCombo = punchesAvoided > 10 && Math.random() < 0.25;

    const punch = {
      type,
      x: type === 'left' ? -40 : type === 'right' ? W + 40 : W / 2,
      y: type === 'high' ? H * 0.3 : H * 0.55,
      targetX: W / 2,
      targetY: H * 0.65,
      speed,
      progress: 0, // 0 = spawned, 1 = reached player
      size: 35,
      color: type === 'high' ? THEME.fail : type === 'left' ? THEME.primary : THEME.accentDark,
      active: true,
    };

    // Warning
    warnings.push({
      type,
      life: 0.5,
      maxLife: 0.5,
    });

    // Delay punch slightly after warning
    setTimeout(() => {
      if (gameActive) punches.push(punch);
    }, 350);

    if (isCombo) {
      const type2 = types.filter(t => t !== type)[Math.floor(Math.random() * 2)];
      setTimeout(() => {
        if (!gameActive) return;
        warnings.push({ type: type2, life: 0.4, maxLife: 0.4 });
        setTimeout(() => {
          if (gameActive) punches.push({
            type: type2,
            x: type2 === 'left' ? -40 : type2 === 'right' ? W + 40 : W / 2,
            y: type2 === 'high' ? H * 0.3 : H * 0.55,
            targetX: W / 2, targetY: H * 0.65,
            speed, progress: 0, size: 35,
            color: type2 === 'high' ? THEME.fail : type2 === 'left' ? THEME.primary : THEME.accentDark,
            active: true,
          });
        }, 300);
      }, 400);
    }
  }

  function checkPunchHit(punch, engine) {
    if (punch.progress < 0.85) return false;

    const isDucking = player.duckTimer > 0;
    const dodgeDir = player.dodgeDir;

    if (punch.type === 'high' && isDucking) {
      // Successfully ducked
      return true;
    }
    if (punch.type === 'left' && dodgeDir > 0) {
      // Dodged right to avoid left punch
      return true;
    }
    if (punch.type === 'right' && dodgeDir < 0) {
      // Dodged left to avoid right punch
      return true;
    }

    return false;
  }

  function drawRing(ctx) {
    // Ring floor
    ctx.fillStyle = '#2a2a1a';
    ctx.fillRect(30, H * 0.45, W - 60, H * 0.4);

    // Ropes
    const ropeY = [H * 0.35, H * 0.45, H * 0.55];
    ropeY.forEach(y => {
      ctx.strokeStyle = 'rgba(200,180,140,0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.quadraticCurveTo(W / 2, y + 5, W - 30, y);
      ctx.stroke();
    });

    // Corner posts
    [[30, H * 0.33], [W - 30, H * 0.33]].forEach(([x, y]) => {
      ctx.fillStyle = '#666';
      ctx.fillRect(x - 4, y, 8, H * 0.53);
    });

    // Mat
    ctx.fillStyle = 'rgba(100,50,50,0.3)';
    ctx.fillRect(40, H * 0.46, W - 80, H * 0.38);
  }

  function drawPlayer(ctx, engine) {
    const isDucking = player.duckTimer > 0;
    const px = player.x + player.dodgeDir * 60;
    const py = player.y + (isDucking ? 40 : 0);
    const sz = player.size;

    ctx.save();
    ctx.translate(px, py);

    // Body
    ctx.fillStyle = '#4466aa';
    if (isDucking) {
      // Ducking pose — compressed
      drawRoundedRect(ctx, -sz / 2, -10, sz, 30, 8);
      ctx.fill();
      // Head lower
      ctx.fillStyle = '#ddaa88';
      ctx.beginPath();
      ctx.arc(0, -15, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standing
      drawRoundedRect(ctx, -sz / 3, -sz / 2, sz * 0.66, sz, 8);
      ctx.fill();
      // Head
      ctx.fillStyle = '#ddaa88';
      ctx.beginPath();
      ctx.arc(0, -sz / 2 - 14, 18, 0, Math.PI * 2);
      ctx.fill();
      // Guard gloves
      ctx.fillStyle = THEME.fail;
      ctx.beginPath();
      ctx.arc(-22, -sz / 4, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(22, -sz / 4, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPunches(ctx, engine) {
    punches.forEach(p => {
      if (!p.active) return;
      const t = p.progress;

      // Interpolate position
      const cx = p.x + (p.targetX - p.x) * t;
      const cy = p.y + (p.targetY - p.y) * t;
      const scale = 0.3 + t * 1.2; // grows as it approaches

      // Glove
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(3, 3, p.size * 0.6, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glove body
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10 * t;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Glove details
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(-5, 5, p.size * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(-5, -8, p.size * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  function drawWarnings(ctx, engine) {
    warnings.forEach(w => {
      const alpha = (w.life / w.maxLife) * 0.6;
      ctx.globalAlpha = alpha;

      if (w.type === 'high') {
        // Arrow from top
        ctx.fillStyle = THEME.fail;
        ctx.font = "bold 28px Arial, sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('⬇', W / 2, H * 0.4);
        ctx.font = "bold 14px Arial, sans-serif";
        ctx.fillText('DUCK!', W / 2, H * 0.4 + 25);
      } else if (w.type === 'left') {
        ctx.fillStyle = THEME.primary;
        ctx.font = "bold 28px Arial, sans-serif";
        ctx.textAlign = 'left';
        ctx.fillText('➡', 50, H * 0.6);
        ctx.font = "bold 14px Arial, sans-serif";
        ctx.fillText('DODGE!', 45, H * 0.6 + 25);
      } else {
        ctx.fillStyle = THEME.accentDark;
        ctx.font = "bold 28px Arial, sans-serif";
        ctx.textAlign = 'right';
        ctx.fillText('⬅', W - 50, H * 0.6);
        ctx.font = "bold 14px Arial, sans-serif";
        ctx.fillText('DODGE!', W - 45, H * 0.6 + 25);
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawControls(ctx, engine) {
    if (!gameActive) return;
    const alpha = 0.15;
    ctx.globalAlpha = alpha;

    // Duck button (bottom center)
    ctx.fillStyle = THEME.fail;
    ctx.beginPath();
    ctx.arc(W / 2, H - 70, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('DUCK', W / 2, H - 67);

    // Left dodge (bottom left)
    ctx.fillStyle = THEME.accentDark;
    ctx.beginPath();
    ctx.arc(80, H - 70, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('← ', 80, H - 67);

    // Right dodge (bottom right)
    ctx.fillStyle = THEME.primary;
    ctx.beginPath();
    ctx.arc(W - 80, H - 70, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(' →', W - 80, H - 67);

    ctx.globalAlpha = 1;
  }

  function drawInstruction(ctx, engine) {
    if (!showInstruction) return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 15px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('SWIPE DOWN TO DUCK', W / 2, H * 0.45 - 10);
    ctx.fillText('SWIPE LEFT/RIGHT TO DODGE', W / 2, H * 0.45 + 12);
    ctx.globalAlpha = 1;
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'PUNCH OUT', width: W, height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        punchesAvoided = 0;
        punches = [];
        warnings = [];
        punchTimer = 0;
        punchInterval = 1.5;
        player.duckTimer = 0;
        player.dodgeDir = 0;
        player.dodgeTimer = 0;
        gameActive = true;
        showInstruction = true;
      }
    },

    onInput(type, data, engine) {
      if (!gameActive) return;

      if (type === 'drag_end') {
        showInstruction = false;
        const { dx, dy, distance } = data;
        if (distance < 15) return;

        // Determine swipe direction
        if (Math.abs(dy) > Math.abs(dx) && dy > 20) {
          // Swipe down — duck
          player.duckTimer = 0.5;
          engine.sound.tap();
        } else if (dx < -30) {
          // Swipe left — dodge left
          player.dodgeDir = -1;
          player.dodgeTimer = 0.4;
          engine.sound.tap();
        } else if (dx > 30) {
          // Swipe right — dodge right
          player.dodgeDir = 1;
          player.dodgeTimer = 0.4;
          engine.sound.tap();
        }
      }

      // Tap-based controls for mobile (bottom buttons)
      if (type === 'tap') {
        showInstruction = false;
        const { x, y } = data;
        if (y > H - 120) {
          if (x < W / 3) {
            player.dodgeDir = -1;
            player.dodgeTimer = 0.4;
            engine.sound.tap();
          } else if (x > W * 2 / 3) {
            player.dodgeDir = 1;
            player.dodgeTimer = 0.4;
            engine.sound.tap();
          } else {
            player.duckTimer = 0.5;
            engine.sound.tap();
          }
        }
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive) return;

      // Duck timer
      if (player.duckTimer > 0) {
        player.duckTimer -= dt;
        if (player.duckTimer <= 0) player.duckTimer = 0;
      }

      // Dodge timer
      if (player.dodgeTimer > 0) {
        player.dodgeTimer -= dt;
        if (player.dodgeTimer <= 0) {
          player.dodgeTimer = 0;
          player.dodgeDir = 0;
        }
      }

      // Warning timers
      for (let i = warnings.length - 1; i >= 0; i--) {
        warnings[i].life -= dt;
        if (warnings[i].life <= 0) warnings.splice(i, 1);
      }

      // Spawn punches
      punchTimer += dt;
      if (punchTimer >= punchInterval) {
        punchTimer = 0;
        punchInterval = Math.max(0.5, 1.5 - punchesAvoided * 0.04);
        spawnPunch(engine);
      }

      // Update punches
      for (let i = punches.length - 1; i >= 0; i--) {
        const p = punches[i];
        if (!p.active) continue;

        p.progress += (p.speed / 300) * dt;

        if (p.progress >= 1) {
          // Punch reached player
          if (checkPunchHit(p, engine)) {
            // Dodged!
            p.active = false;
            punchesAvoided++;
            engine.addScore(1);
            engine.juice.shake(3);

            // Near miss bonus (dodged very late)
            if (p.progress < 1.1) {
              engine.addScore(1);
              engine.floatingText.spawn(player.x, player.y - 60, 'CLOSE!', { color: THEME.highlight, size: 24, duration: 0.7 });
            }

            engine.particles.emit(p.targetX, p.targetY, 6, { speed: [2, 5], size: [2, 4], life: [0.2, 0.5], colors: [p.color, '#fff'], gravity: 30 });

            // Milestones
            if (punchesAvoided > 0 && punchesAvoided % 10 === 0) {
              engine.juice.shake(10); engine.juice.flash(THEME.highlight, 0.1);
              engine.floatingText.spawn(200, H * 0.35, `${punchesAvoided} DODGES!`, { color: THEME.accent, size: 36, duration: 1.5 });
              engine.addScore(5);
              engine.particles.emit(200, H * 0.4, 20, { speed: [3, 7], size: [3, 6], life: [0.5, 1.2], colors: THEME.particles, gravity: 40, type: 'star' });
            }

            punches.splice(i, 1);
          } else if (p.progress >= 1.15) {
            // Hit! Game over
            p.active = false;
            gameActive = false;
            engine.sound.miss();
            engine.juice.shake(15);
            engine.juice.flash(THEME.fail, 0.3);
            engine.particles.emit(player.x, player.y - 20, 20, { speed: [3, 8], size: [2, 5], life: [0.3, 0.8], colors: [THEME.fail, '#fff'], gravity: 60 });
            engine.floatingText.spawn(W / 2, H * 0.4, 'KO!', { color: THEME.fail, size: 48, duration: 1.5 });
            setTimeout(() => engine.setState('gameover'), 600);
          }
        }
      }
    },

    onDraw(ctx, engine) {
      drawRing(ctx);
      drawWarnings(ctx, engine);
      drawPlayer(ctx, engine);
      drawPunches(ctx, engine);
      drawControls(ctx, engine);
      drawInstruction(ctx, engine);
    },
  });

  game.start();
  return game;
}
