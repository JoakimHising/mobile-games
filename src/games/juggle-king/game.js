import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  // Ball state — scoped inside factory
  let ball = {
    x: 200, y: 350,
    vx: 0, vy: 0,
    radius: 22,
    rotation: 0,
    spinRate: 0,
    scaleX: 1, scaleY: 1,
  };

  const BASE_GRAVITY = 580;
  let gravity = BASE_GRAVITY;
  let juggleCount = 0;
  let hitRadius = 50;
  let windForce = 0;
  let windTarget = 0;
  let windTimer = 0;
  let gameOver = false;
  let trail = [];
  let showInstruction = true;
  const GROUND_Y = 630;

  let windParticles = [];
  for (let i = 0; i < 12; i++) {
    windParticles.push({
      x: Math.random() * 400,
      y: Math.random() * 700,
      speed: 0.5 + Math.random() * 1.5,
      size: 1 + Math.random() * 2,
      alpha: 0.04 + Math.random() * 0.08,
    });
  }

  const PENTA_ANGLES = [0, Math.PI * 2 / 5, Math.PI * 4 / 5, Math.PI * 6 / 5, Math.PI * 8 / 5];

  function drawPentagon(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 / 5) * i;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawSoccerBall(ctx, engine) {
    const { x, y, radius, rotation, scaleX, scaleY } = ball;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, scaleY);
    const glowIntensity = 45 + Math.min(engine.combo, 15) * 3;
    const glowColor = engine.combo > 5 ? THEME.highlight : THEME.primaryLight;
    drawGlow(ctx, 0, 0, glowIntensity, glowColor);
    const ballGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, radius);
    ballGrad.addColorStop(0, '#FFFFFF');
    ballGrad.addColorStop(0.7, '#E8E8E8');
    ballGrad.addColorStop(1, '#C0C0C0');
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = THEME.primaryLight;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.rotate(rotation);
    ctx.fillStyle = '#222';
    drawPentagon(ctx, 0, 0, 8);
    ctx.fill();
    for (let i = 0; i < PENTA_ANGLES.length; i++) {
      const a = PENTA_ANGLES[i];
      const px = Math.cos(a) * 14;
      const py = Math.sin(a) * 14;
      ctx.fillStyle = '#333';
      drawPentagon(ctx, px, py, 5);
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-5, -6, 6, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShadow(ctx) {
    const distToGround = GROUND_Y - ball.y;
    const maxDist = 500;
    const t = Math.max(0, Math.min(1, distToGround / maxDist));
    const shadowWidth = 30 * (1 - t * 0.7);
    const shadowAlpha = 0.3 * (1 - t * 0.85);
    if (shadowAlpha < 0.02) return;
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ball.x, GROUND_Y, shadowWidth, 6 * (1 - t * 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawGroundLine(ctx, engine) {
    ctx.strokeStyle = THEME.accentDark;
    ctx.lineWidth = 2;
    ctx.shadowColor = THEME.accentDark;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(30, GROUND_Y + 10);
    ctx.lineTo(370, GROUND_Y + 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function drawDangerZone(ctx) {
    if (ball.y < 480) return;
    const dangerT = Math.min(1, (ball.y - 480) / (GROUND_Y - 480));
    const grad = ctx.createLinearGradient(0, 580, 0, 700);
    grad.addColorStop(0, 'rgba(255,0,110,0)');
    grad.addColorStop(1, `rgba(255,0,110,${dangerT * 0.2})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 580, 400, 120);
  }

  function drawTrail(ctx) {
    if (trail.length < 2) return;
    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length;
      const alpha = t * 0.35;
      const size = ball.radius * t * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = THEME.primary;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWindIndicator(ctx, engine) {
    if (Math.abs(windForce) < 10) return;
    const windNorm = windForce / 120;
    const arrowX = 200 + windNorm * 80;
    ctx.fillStyle = THEME.textDim;
    ctx.font = "600 11px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('WIND', 200, 55);
    ctx.strokeStyle = THEME.primaryLight;
    ctx.lineWidth = 2;
    ctx.shadowColor = THEME.primaryLight;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = Math.min(Math.abs(windNorm) * 2, 0.8);
    ctx.beginPath();
    ctx.moveTo(200, 65);
    ctx.lineTo(arrowX, 65);
    const dir = Math.sign(windNorm);
    ctx.lineTo(arrowX - dir * 6, 60);
    ctx.moveTo(arrowX, 65);
    ctx.lineTo(arrowX - dir * 6, 70);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    windParticles.forEach(wp => {
      wp.x += windForce * wp.speed * 0.015;
      if (wp.x > 420) wp.x = -20;
      if (wp.x < -20) wp.x = 420;
      ctx.globalAlpha = wp.alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(wp.x, wp.y, wp.size * (1 + Math.abs(windNorm)), 1);
    });
    ctx.globalAlpha = 1;
  }

  function drawInstruction(ctx, engine) {
    if (!showInstruction) return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 16px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('TAP THE BALL', 200, ball.y + 55);
    ctx.globalAlpha = 1;
  }

  function kickBall(tapX, tapY, engine) {
    const kickPower = 500;
    ball.vy = -kickPower;
    const offsetX = ball.x - tapX;
    ball.vx += offsetX * 3;
    ball.spinRate = ball.vx * 0.08;
    ball.scaleX = 1.3;
    ball.scaleY = 0.7;
    engine.tweens.add(ball, { scaleX: 1, scaleY: 1 }, 0.35, Ease.outElastic);
    juggleCount++;
    showInstruction = false;
    engine.addScore(1);
    gravity = BASE_GRAVITY + Math.min(juggleCount * 12, 600);
    hitRadius = Math.max(32, 50 - juggleCount * 0.4);
    if (juggleCount === 15) {
      windTarget = (Math.random() - 0.5) * 60;
    }
    const particleCount = engine.combo > 5 ? 15 : 10;
    const particleType = engine.combo > 8 ? 'star' : 'circle';
    engine.particles.emit(ball.x, ball.y + ball.radius, particleCount, {
      speed: [2, 6], size: [2, 5], life: [0.3, 0.8],
      colors: [THEME.primary, THEME.primaryLight, THEME.highlight],
      gravity: 80, angle: -Math.PI / 2, spread: Math.PI * 0.7, type: particleType,
    });
    let shakeAmount = 3;
    const isNearMiss = ball.y > 550;
    if (isNearMiss) {
      shakeAmount = 8;
      engine.juice.slowMo(0.3, 0.2);
      engine.floatingText.spawn(ball.x, ball.y - 40, 'CLOSE!', {
        color: THEME.highlight, size: 26, duration: 0.8,
      });
      engine.addScore(1);
    }
    engine.juice.shake(shakeAmount);
    const comboText = engine.combo > 2 ? `+1 x${engine.combo}` : '+1';
    const textColor = engine.combo > 5 ? THEME.highlight : engine.combo > 2 ? THEME.accent : THEME.success;
    engine.floatingText.spawn(ball.x, ball.y - 30, comboText, {
      color: textColor,
      size: 20 + Math.min(engine.combo * 2, 14),
      duration: 0.8,
    });
    if (juggleCount > 0 && juggleCount % 10 === 0) {
      engine.juice.shake(12);
      engine.juice.flash(THEME.highlight, 0.15);
      engine.floatingText.spawn(200, 200, `${juggleCount} STREAK!`, {
        color: THEME.accent, size: 36, duration: 1.5,
      });
      engine.addScore(5);
      engine.particles.emit(200, 350, 25, {
        speed: [3, 8], size: [3, 6], life: [0.6, 1.5],
        colors: THEME.particles, gravity: 50, type: 'star',
      });
    }
    engine.sound.tap();
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'JUGGLE KING',
    width: 400,
    height: 700,

    onStateChange(newState, oldState) {
      if (newState === 'playing') {
        ball.x = 200; ball.y = 350;
        ball.vx = 0; ball.vy = -280;
        ball.rotation = 0; ball.spinRate = 0;
        ball.scaleX = 1; ball.scaleY = 1;
        gravity = BASE_GRAVITY;
        juggleCount = 0;
        hitRadius = 50;
        windForce = 0; windTarget = 0; windTimer = 0;
        trail = [];
        showInstruction = true;
        gameOver = false;
      }
    },

    onInput(type, data, engine) {
      if (type !== 'tap') return;
      if (gameOver) return;
      const dx = data.x - ball.x;
      const dy = data.y - ball.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius) {
        kickBall(data.x, data.y, engine);
      }
    },

    onUpdate(dt, engine) {
      if (gameOver) return;
      ball.vy += gravity * dt;
      if (juggleCount >= 15) {
        windForce += (windTarget - windForce) * dt * 2;
        ball.vx += windForce * dt;
        windTimer += dt;
        if (windTimer > 5 + Math.random() * 3) {
          windTimer = 0;
          const maxWind = Math.min(40 + juggleCount * 2, 120);
          windTarget = (Math.random() - 0.5) * maxWind;
        }
      }
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.vx *= 0.997;
      ball.rotation += ball.spinRate * dt;
      ball.spinRate *= 0.995;
      if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.vx *= -0.6;
        ball.spinRate = -ball.spinRate * 0.5;
        engine.particles.emit(ball.radius, ball.y, 6, {
          speed: [1, 3], size: [1, 3], life: [0.2, 0.5],
          colors: [THEME.accent, THEME.accentDark], angle: 0, spread: Math.PI * 0.6,
        });
      } else if (ball.x > 400 - ball.radius) {
        ball.x = 400 - ball.radius;
        ball.vx *= -0.6;
        ball.spinRate = -ball.spinRate * 0.5;
        engine.particles.emit(400 - ball.radius, ball.y, 6, {
          speed: [1, 3], size: [1, 3], life: [0.2, 0.5],
          colors: [THEME.accent, THEME.accentDark], angle: Math.PI, spread: Math.PI * 0.6,
        });
      }
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 14) trail.shift();
      if (ball.y > 720) {
        gameOver = true;
        engine.sound.miss();
        engine.juice.shake(6);
        engine.juice.flash(THEME.fail, 0.15);
        engine.juice.slowMo(0.15, 0.4);
        setTimeout(() => engine.setState('gameover'), 300);
      }
    },

    onDraw(ctx, engine) {
      drawGroundLine(ctx, engine);
      drawDangerZone(ctx);
      drawShadow(ctx);
      drawWindIndicator(ctx, engine);
      drawTrail(ctx);
      drawSoccerBall(ctx, engine);
      drawInstruction(ctx, engine);
    },
  });

  game.start();
  return game;
}
