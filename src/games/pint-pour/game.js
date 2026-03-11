import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700;

  let gameActive = false;
  let showInstruction = true;
  let glassesFilled = 0;

  // Glass and pouring state
  let glass = null;
  let fillLevel = 0; // 0-1
  let targetLevel = 0; // where to fill to
  let isPouring = false;
  let foam = 0; // foam level on top
  let overflow = false;
  let conveyorX = 0;
  let conveyorSpeed = 40;
  let settled = false; // after pour, liquid settles

  function spawnGlass() {
    const difficulty = Math.min(glassesFilled, 40);
    const glassH = Math.max(100, 180 - difficulty * 2);
    const glassW = Math.max(50, 80 - difficulty * 0.5);

    glass = {
      x: W / 2,
      y: H * 0.4,
      w: glassW,
      h: glassH,
    };

    fillLevel = 0;
    foam = 0;
    overflow = false;
    isPouring = false;
    settled = false;

    // Target line position (0.6 to 0.9 of glass)
    targetLevel = 0.65 + Math.random() * 0.25;

    // Conveyor gets faster
    conveyorSpeed = 40 + Math.min(glassesFilled * 3, 80);
  }

  function scorePour(engine) {
    const diff = Math.abs(fillLevel - targetLevel);

    if (diff < 0.02) {
      // Perfect
      engine.addScore(3);
      engine.juice.shake(8);
      engine.juice.slowMo(0.2, 0.25);
      engine.juice.flash(THEME.highlight, 0.12);
      engine.floatingText.spawn(glass.x, glass.y - 40, 'PERFECT!', { color: THEME.highlight, size: 32, duration: 1.2 });
      engine.particles.emit(glass.x, glass.y, 20, { speed: [3, 7], size: [2, 5], life: [0.5, 1.0], colors: [THEME.highlight, '#fff', THEME.primary], gravity: 50, type: 'star' });
    } else if (diff < 0.06) {
      // Good
      engine.addScore(2);
      engine.juice.shake(4);
      engine.floatingText.spawn(glass.x, glass.y - 30, 'GOOD!', { color: THEME.accent, size: 26, duration: 0.9 });
      engine.particles.emit(glass.x, glass.y, 10, { speed: [2, 5], size: [2, 4], life: [0.3, 0.7], colors: [THEME.accent, THEME.accentLight], gravity: 40 });
    } else if (diff < 0.12) {
      // OK
      engine.addScore(1);
      engine.floatingText.spawn(glass.x, glass.y - 25, 'OK', { color: THEME.textWhite, size: 20, duration: 0.7 });
    } else {
      // Too far off — game over
      gameActive = false;
      engine.sound.miss();
      engine.juice.shake(6);
      engine.juice.flash(THEME.fail, 0.2);
      engine.floatingText.spawn(glass.x, glass.y - 30, 'TOO FAR!', { color: THEME.fail, size: 26, duration: 1.0 });
      setTimeout(() => engine.setState('gameover'), 500);
      return;
    }

    glassesFilled++;

    // Milestone
    if (glassesFilled > 0 && glassesFilled % 5 === 0) {
      engine.juice.flash(THEME.highlight, 0.08);
      engine.floatingText.spawn(200, 200, `${glassesFilled} PINTS!`, { color: THEME.accent, size: 36, duration: 1.5 });
      engine.addScore(5);
      engine.particles.emit(200, 250, 20, { speed: [3, 7], size: [3, 6], life: [0.5, 1.2], colors: THEME.particles, gravity: 40, type: 'star' });
    }

    // Next glass
    setTimeout(() => { if (gameActive) spawnGlass(); }, 500);
  }

  function drawConveyor(ctx, engine) {
    // Belt
    ctx.fillStyle = '#333';
    ctx.fillRect(0, H * 0.4 + (glass ? glass.h : 150) + 10, W, 20);

    // Belt stripes
    const stripeW = 30;
    ctx.fillStyle = '#444';
    for (let x = -stripeW + (conveyorX % stripeW); x < W; x += stripeW) {
      ctx.fillRect(x, H * 0.4 + (glass ? glass.h : 150) + 12, stripeW / 2, 16);
    }

    // Rollers
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(20, H * 0.4 + (glass ? glass.h : 150) + 20, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - 20, H * 0.4 + (glass ? glass.h : 150) + 20, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTap(ctx, engine) {
    const tapX = W / 2;
    const tapY = glass ? glass.y - 40 : H * 0.3;

    // Pipe
    ctx.fillStyle = '#888';
    ctx.fillRect(tapX - 8, tapY - 60, 16, 50);

    // Horizontal pipe
    ctx.fillRect(tapX - 40, tapY - 65, 80, 12);

    // Tap handle
    ctx.fillStyle = isPouring ? THEME.primary : '#666';
    ctx.shadowColor = isPouring ? THEME.primary : 'transparent';
    ctx.shadowBlur = isPouring ? 10 : 0;
    drawRoundedRect(ctx, tapX - 6, tapY - 85, 12, 25, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Nozzle
    ctx.fillStyle = '#aaa';
    ctx.fillRect(tapX - 5, tapY - 12, 10, 12);

    // Pour stream
    if (isPouring && glass) {
      const streamH = glass.y + glass.h * (1 - fillLevel) - tapY;
      if (streamH > 0) {
        const grad = ctx.createLinearGradient(0, tapY, 0, tapY + streamH);
        grad.addColorStop(0, '#ddaa22');
        grad.addColorStop(1, '#cc8800');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(tapX - 2, tapY, 4, streamH);

        // Splash particles at impact
        ctx.globalAlpha = 0.4;
        const splashY = tapY + streamH;
        ctx.fillStyle = '#ddaa22';
        for (let i = 0; i < 3; i++) {
          const sx = tapX + (Math.random() - 0.5) * 15;
          const sy = splashY + (Math.random() - 0.5) * 8;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawGlass(ctx, engine) {
    if (!glass) return;
    const gx = glass.x - glass.w / 2;
    const gy = glass.y;
    const gw = glass.w;
    const gh = glass.h;

    // Glass body (transparent with border)
    ctx.fillStyle = 'rgba(200,220,255,0.08)';
    drawRoundedRect(ctx, gx, gy, gw, gh, 4);
    ctx.fill();

    ctx.strokeStyle = 'rgba(200,220,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Liquid
    if (fillLevel > 0) {
      const liquidH = gh * fillLevel;
      const liquidY = gy + gh - liquidH;

      const liqGrad = ctx.createLinearGradient(0, liquidY, 0, gy + gh);
      liqGrad.addColorStop(0, '#ddaa22');
      liqGrad.addColorStop(0.5, '#cc8800');
      liqGrad.addColorStop(1, '#aa6600');
      ctx.fillStyle = liqGrad;
      drawRoundedRect(ctx, gx + 2, liquidY, gw - 4, liquidH - 2, 3);
      ctx.fill();

      // Foam on top
      if (foam > 0) {
        const foamH = Math.min(foam * 30, 20);
        ctx.fillStyle = 'rgba(255,250,220,0.8)';
        ctx.beginPath();
        for (let x = gx + 4; x < gx + gw - 4; x += 8) {
          ctx.arc(x, liquidY - foamH / 2, 6 + Math.sin(engine.time * 3 + x) * 2, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    // Target line
    const targetY = gy + gh - gh * targetLevel;
    ctx.strokeStyle = THEME.textWhite;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(gx - 8, targetY);
    ctx.lineTo(gx + gw + 8, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target arrows
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('▶', gx - 10, targetY + 4);
    ctx.textAlign = 'left';
    ctx.fillText('◀', gx + gw + 10, targetY + 4);

    // Glass shine
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(gx + 4, gy + 8, 6, gh - 16);
  }

  function drawInstruction(ctx, engine) {
    if (!showInstruction) return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 16px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('HOLD TO POUR', W / 2, H - 50);
    ctx.fillText('FILL TO THE LINE', W / 2, H - 30);
    ctx.globalAlpha = 1;
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'PINT POUR', width: W, height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        glassesFilled = 0;
        gameActive = true;
        showInstruction = true;
        spawnGlass();
      }
    },

    onInput(type, data, engine) {
      if (!gameActive || !glass) return;

      if (type === 'drag_start' || type === 'tap') {
        showInstruction = false;
        if (!settled) {
          isPouring = true;
        }
      }
      if (type === 'drag_end') {
        isPouring = false;
        if (fillLevel > 0.1 && !settled && !overflow) {
          settled = true;
          // Score the pour
          setTimeout(() => scorePour(engine), 300);
        }
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive || !glass) return;

      conveyorX += conveyorSpeed * dt;

      if (isPouring && !overflow && !settled) {
        const pourSpeed = 0.3 + Math.min(glassesFilled * 0.02, 0.3);
        fillLevel += pourSpeed * dt;
        foam = Math.min(foam + dt * 0.8, 1);

        if (fillLevel >= 1.0) {
          // Overflow!
          overflow = true;
          isPouring = false;
          gameActive = false;
          engine.sound.miss();
          engine.juice.shake(8);
          engine.juice.flash(THEME.fail, 0.2);
          engine.floatingText.spawn(glass.x, glass.y - 30, 'OVERFLOW!', { color: THEME.fail, size: 30, duration: 1.2 });
          engine.particles.emit(glass.x, glass.y, 15, { speed: [2, 5], size: [2, 4], life: [0.3, 0.7], colors: ['#ddaa22', '#cc8800', '#fff'], gravity: 60 });
          setTimeout(() => engine.setState('gameover'), 600);
        }
      }

      // Foam settles when not pouring
      if (!isPouring && foam > 0) {
        foam -= dt * 0.5;
        if (foam < 0) foam = 0;
      }
    },

    onDraw(ctx, engine) {
      drawConveyor(ctx, engine);
      drawTap(ctx, engine);
      drawGlass(ctx, engine);
      drawInstruction(ctx, engine);
    },
  });

  game.start();
  return game;
}
