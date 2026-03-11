import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  // Goal dimensions (front view)
  const GOAL = {
    x: 60, y: 160, w: 280, h: 220, postW: 8, netDepth: 40,
  };
  const GOAL_CX = GOAL.x + GOAL.w / 2;
  const GOAL_CY = GOAL.y + GOAL.h / 2;

  // Keeper state
  let keeper = {
    x: GOAL_CX, y: GOAL_CY + 40, targetX: GOAL_CX,
    diveDir: 0, diveProgress: 0, diveSpeed: 0,
    armSpan: 55, bodyW: 30, bodyH: 60,
    recovering: false, recoverTimer: 0, idleSway: 0,
  };

  // Ball state
  let activeBall = null;
  let shotTimer = 0;
  let shotDelay = 1.5;
  let savesCount = 0;
  let shotSpeed = 280;
  let gameActive = false;
  let showInstruction = true;
  let shotWarningTimer = 0;
  let warningTarget = null;

  const BASE_SHOT_SPEED = 280;
  const BASE_SHOT_DELAY = 1.5;

  // Grass patches
  let grassPatches = [];
  for (let i = 0; i < 20; i++) {
    grassPatches.push({
      x: Math.random() * 400,
      y: GOAL.y + GOAL.h + 10 + Math.random() * 310,
      size: 2 + Math.random() * 4,
      sway: Math.random() * Math.PI * 2,
    });
  }

  // Pentagon for soccer ball
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

  function checkSave(engine) {
    if (!activeBall || activeBall.progress < 0.85) return false;
    const kx = keeper.x;
    const ky = keeper.y;
    const reach = keeper.armSpan + keeper.bodyW / 2;
    const diveExtend = keeper.diveProgress * 40;
    const dx = activeBall.x - kx;
    const dy = activeBall.y - ky;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const totalReach = reach + diveExtend + activeBall.radius;
    const verticalReach = keeper.bodyH / 2 + 15;
    return dist < totalReach && Math.abs(dy) < verticalReach;
  }

  function onSave(engine) {
    savesCount++;
    engine.addScore(1);

    engine.particles.emit(activeBall.x, activeBall.y, 15, {
      speed: [3, 7], size: [2, 5], life: [0.3, 0.8],
      colors: [THEME.accent, THEME.accentLight, THEME.highlight],
      gravity: 80, spread: Math.PI, angle: -Math.PI / 2,
      type: engine.combo > 5 ? 'star' : 'circle',
    });

    const saveTexts = ['SAVE!', 'GREAT!', 'SUPERB!', 'HEROIC!', 'UNREAL!'];
    const textIdx = Math.min(Math.floor(engine.combo / 3), saveTexts.length - 1);
    const textColor = engine.combo > 5 ? THEME.highlight : engine.combo > 2 ? THEME.accent : THEME.success;
    engine.floatingText.spawn(activeBall.x, activeBall.y - 30, saveTexts[textIdx], {
      color: textColor, size: 24 + Math.min(engine.combo * 2, 12), duration: 0.9,
    });

    const kx = keeper.x;
    if (Math.abs(activeBall.x - kx) > keeper.armSpan + 20) {
      engine.juice.slowMo(0.3, 0.2);
      engine.floatingText.spawn(200, 250, 'CLUTCH!', { color: THEME.highlight, size: 30, duration: 1.0 });
      engine.addScore(1);
    }

    engine.juice.shake(5 + Math.min(engine.combo, 10));

    if (savesCount > 0 && savesCount % 10 === 0) {
      engine.juice.shake(12);
      engine.juice.flash(THEME.highlight, 0.15);
      engine.floatingText.spawn(200, 200, `${savesCount} SAVES!`, { color: THEME.accent, size: 36, duration: 1.5 });
      engine.addScore(5);
      engine.particles.emit(200, 300, 25, { speed: [3, 8], size: [3, 6], life: [0.6, 1.5], colors: THEME.particles, gravity: 50, type: 'star' });
    }

    shotSpeed = BASE_SHOT_SPEED + Math.min(savesCount * 8, 300);
    shotDelay = Math.max(0.6, BASE_SHOT_DELAY - savesCount * 0.04);

    activeBall = null;
    shotTimer = 0;
    shotWarningTimer = 0;
  }

  function onGoal(engine) {
    engine.sound.miss();
    engine.juice.shake(8);
    engine.juice.flash(THEME.fail, 0.2);
    engine.juice.slowMo(0.15, 0.5);
    engine.particles.emit(activeBall.x, activeBall.y, 20, {
      speed: [1, 4], size: [2, 4], life: [0.3, 0.8],
      colors: [THEME.fail, '#fff'], gravity: 40, spread: Math.PI, angle: Math.PI / 2,
    });
    gameActive = false;
    setTimeout(() => engine.setState('gameover'), 500);
  }

  // Drawing functions
  function drawField(ctx, engine) {
    const fieldTop = GOAL.y + GOAL.h;
    const fieldGrad = ctx.createLinearGradient(0, fieldTop, 0, 700);
    fieldGrad.addColorStop(0, '#1a4a2a');
    fieldGrad.addColorStop(1, '#0d2e18');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, fieldTop, 400, 700 - fieldTop);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, fieldTop + 5);
    ctx.lineTo(40, fieldTop + 80);
    ctx.lineTo(360, fieldTop + 80);
    ctx.lineTo(360, fieldTop + 5);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(200, fieldTop + 150, 3, 0, Math.PI * 2);
    ctx.fill();

    grassPatches.forEach(g => {
      const sway = Math.sin(engine.time * 2 + g.sway) * 3;
      ctx.strokeStyle = 'rgba(100,200,100,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + sway, g.y - g.size);
      ctx.stroke();
    });
  }

  function drawGoal(ctx) {
    const { x, y, w, h, postW, netDepth } = GOAL;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const nx = x + (w / 10) * i;
      ctx.beginPath();
      ctx.moveTo(nx, y);
      ctx.lineTo(nx + (nx < 200 ? -netDepth : nx > 200 ? netDepth : 0) * 0.3, y - netDepth * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(nx, y + h);
      ctx.lineTo(nx, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const ny = y + (h / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, ny);
      ctx.lineTo(x + w, ny);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(x, y, w, h);

    const postGrad = ctx.createLinearGradient(x, y, x + postW, y);
    postGrad.addColorStop(0, '#FFFFFF');
    postGrad.addColorStop(0.5, '#E0E0E0');
    postGrad.addColorStop(1, '#C0C0C0');
    ctx.fillStyle = postGrad;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.fillRect(x - postW / 2, y, postW, h);
    ctx.fillRect(x + w - postW / 2, y, postW, h);
    ctx.fillRect(x - postW / 2, y - postW / 2, w + postW, postW);
    ctx.shadowBlur = 0;
  }

  function drawKeeper(ctx, engine) {
    const { x, y, diveDir, diveProgress, bodyW, bodyH } = keeper;
    ctx.save();
    ctx.translate(x, y);
    const diveAngle = diveDir * diveProgress * 0.8;
    const diveOffsetX = diveDir * diveProgress * 50;
    ctx.translate(diveOffsetX, 0);
    ctx.rotate(diveAngle);

    const glowColor = engine.combo > 5 ? THEME.highlight : THEME.accent;
    drawGlow(ctx, 0, 0, 50 + engine.combo * 2, glowColor);

    const bodyGrad = ctx.createLinearGradient(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2);
    bodyGrad.addColorStop(0, THEME.primary);
    bodyGrad.addColorStop(1, THEME.primaryDark);
    ctx.fillStyle = bodyGrad;
    drawRoundedRect(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 8);
    ctx.fill();

    ctx.fillStyle = THEME.textWhite;
    ctx.globalAlpha = 0.6;
    ctx.font = "bold 16px 'Arial Black',Impact,sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('1', 0, 6);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#F5C5A3';
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2 - 10, 12, 0, Math.PI * 2);
    ctx.fill();

    const armExtend = 20 + diveProgress * 30;
    const armY = -5;
    ctx.fillStyle = THEME.accent;
    ctx.shadowColor = THEME.accent;
    ctx.shadowBlur = diveProgress > 0.3 ? 10 : 4;
    ctx.beginPath();
    ctx.arc(-bodyW / 2 - armExtend, armY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyW / 2 + armExtend, armY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = THEME.primaryDark;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, armY);
    ctx.lineTo(-bodyW / 2 - armExtend, armY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bodyW / 2, armY);
    ctx.lineTo(bodyW / 2 + armExtend, armY);
    ctx.stroke();

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    const legSpread = 8 + diveProgress * 15;
    ctx.beginPath();
    ctx.moveTo(-5, bodyH / 2);
    ctx.lineTo(-legSpread, bodyH / 2 + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, bodyH / 2);
    ctx.lineTo(legSpread, bodyH / 2 + 20);
    ctx.stroke();

    ctx.restore();
  }

  function drawBall(ctx, engine) {
    if (!activeBall) return;
    const b = activeBall;
    const t = b.progress;
    const linearX = b.startX + (b.targetX - b.startX) * t;
    const linearY = b.startY + (b.targetY - b.startY) * t;
    const dx = b.targetX - b.startX;
    const dy = b.targetY - b.startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len;
    const curveAmount = Math.sin(t * Math.PI) * b.curve;
    b.x = linearX + perpX * curveAmount;
    b.y = linearY;
    b.scale = 0.4 + t * 0.6;
    const radius = b.radius * b.scale;

    ctx.save();
    ctx.translate(b.x, b.y);

    if (t > 0.1) {
      for (let i = 1; i <= 4; i++) {
        const tt = Math.max(0, t - i * 0.04);
        const tx = b.startX + (b.targetX - b.startX) * tt + perpX * Math.sin(tt * Math.PI) * b.curve;
        const ty = b.startY + (b.targetY - b.startY) * tt;
        ctx.globalAlpha = (1 - i / 4) * 0.2;
        ctx.fillStyle = THEME.primary;
        ctx.beginPath();
        ctx.arc(tx - b.x, ty - b.y, radius * (1 - i / 4) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (t > 0.6) {
      drawGlow(ctx, 0, 0, 35 * b.scale, THEME.fail);
    }

    ctx.scale(b.scale, b.scale);
    const ballGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, b.radius);
    ballGrad.addColorStop(0, '#FFFFFF');
    ballGrad.addColorStop(0.7, '#E8E8E8');
    ballGrad.addColorStop(1, '#C0C0C0');
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = THEME.primaryLight;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    b.rotation += b.spinRate * 0.016;
    ctx.rotate(b.rotation);
    ctx.fillStyle = '#222';
    drawPentagon(ctx, 0, 0, 6);
    ctx.fill();
    for (let i = 0; i < PENTA_ANGLES.length; i++) {
      const a = PENTA_ANGLES[i];
      ctx.fillStyle = '#333';
      drawPentagon(ctx, Math.cos(a) * 10, Math.sin(a) * 10, 4);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-3, -4, 4, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawShotWarning(ctx, engine) {
    if (!warningTarget || shotWarningTimer <= 0) return;
    const alpha = 0.3 + Math.sin(engine.time * 12) * 0.3;
    ctx.globalAlpha = alpha;
    const tx = warningTarget.x;
    const ty = warningTarget.y;
    ctx.strokeStyle = THEME.fail;
    ctx.lineWidth = 2;
    ctx.shadowColor = THEME.fail;
    ctx.shadowBlur = 8;
    const r = 18;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - r - 5, ty);
    ctx.lineTo(tx + r + 5, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty - r - 5);
    ctx.lineTo(tx, ty + r + 5);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function drawInstruction(ctx, engine) {
    if (!showInstruction) return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 16px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('SWIPE TO DIVE', 200, GOAL.y + GOAL.h + 100);
    ctx.strokeStyle = THEME.textWhite;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, GOAL.y + GOAL.h + 120);
    ctx.lineTo(110, GOAL.y + GOAL.h + 120);
    ctx.lineTo(118, GOAL.y + GOAL.h + 115);
    ctx.moveTo(110, GOAL.y + GOAL.h + 120);
    ctx.lineTo(118, GOAL.y + GOAL.h + 125);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(260, GOAL.y + GOAL.h + 120);
    ctx.lineTo(290, GOAL.y + GOAL.h + 120);
    ctx.lineTo(282, GOAL.y + GOAL.h + 115);
    ctx.moveTo(290, GOAL.y + GOAL.h + 120);
    ctx.lineTo(282, GOAL.y + GOAL.h + 125);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawDangerVignette(ctx) {
    if (!activeBall || activeBall.progress < 0.5) return;
    const intensity = (activeBall.progress - 0.5) / 0.5;
    const alpha = intensity * 0.15;
    const grad = ctx.createRadialGradient(200, 350, 100, 200, 350, 400);
    grad.addColorStop(0, 'rgba(255,0,110,0)');
    grad.addColorStop(1, `rgba(255,0,110,${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 700);
  }

  // Game instance
  const game = new ArcadeEngine(canvasId, {
    name: 'GOALIE',
    width: 400,
    height: 700,

    onStateChange(newState) {
      if (newState === 'playing') {
        keeper.x = GOAL_CX;
        keeper.y = GOAL_CY + 40;
        keeper.targetX = GOAL_CX;
        keeper.diveDir = 0;
        keeper.diveProgress = 0;
        keeper.diveSpeed = 0;
        keeper.recovering = false;
        keeper.recoverTimer = 0;
        keeper.idleSway = 0;
        activeBall = null;
        shotTimer = 0;
        shotDelay = BASE_SHOT_DELAY;
        shotSpeed = BASE_SHOT_SPEED;
        savesCount = 0;
        gameActive = true;
        showInstruction = true;
        shotWarningTimer = 0;
        warningTarget = null;
      }
    },

    onInput(type, data, engine) {
      if (type === 'drag_end' && gameActive) {
        showInstruction = false;
        const swipeX = data.dx;
        if (Math.abs(swipeX) > 15) {
          const dir = swipeX > 0 ? 1 : -1;
          keeper.diveDir = dir;
          keeper.diveProgress = 0;
          keeper.diveSpeed = Math.min(Math.abs(swipeX) / 80, 1) * 6;
          keeper.recovering = false;
          const diveDistance = 60 + Math.min(Math.abs(swipeX), 150) * 0.5;
          keeper.targetX = Math.max(GOAL.x + 20, Math.min(GOAL.x + GOAL.w - 20,
            keeper.x + dir * diveDistance));
          engine.sound.tap();
        }
      }
      if (type === 'tap' && gameActive) {
        showInstruction = false;
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive) return;

      // Keeper movement
      if (keeper.diveDir !== 0 && !keeper.recovering) {
        keeper.diveProgress = Math.min(1, keeper.diveProgress + dt * keeper.diveSpeed);
        keeper.x += (keeper.targetX - keeper.x) * dt * 12;
        if (keeper.diveProgress >= 1) {
          keeper.recovering = true;
          keeper.recoverTimer = 0.4;
        }
      } else if (keeper.recovering) {
        keeper.recoverTimer -= dt;
        if (keeper.recoverTimer <= 0) {
          keeper.recovering = false;
          keeper.diveDir = 0;
          keeper.diveProgress = 0;
          keeper.targetX = GOAL_CX;
        }
        keeper.x += (keeper.targetX - keeper.x) * dt * 4;
      } else {
        keeper.idleSway += dt;
        keeper.x += (keeper.targetX - keeper.x) * dt * 5;
        keeper.x += Math.sin(keeper.idleSway * 2) * 0.3;
      }

      keeper.x = Math.max(GOAL.x + 15, Math.min(GOAL.x + GOAL.w - 15, keeper.x));

      // Shot timer
      if (!activeBall) {
        shotTimer += dt;
        const warningTime = Math.max(0.3, shotDelay * 0.4);
        if (shotTimer > shotDelay - warningTime && !warningTarget) {
          const zones = [-0.85, -0.45, 0, 0.45, 0.85];
          const heights = [0.7, 0.3, -0.1];
          warningTarget = {
            x: GOAL_CX + zones[Math.floor(Math.random() * zones.length)] * (GOAL.w / 2 - 15),
            y: GOAL.y + GOAL.h * heights[Math.floor(Math.random() * heights.length)],
          };
          shotWarningTimer = warningTime;
        }
        if (shotWarningTimer > 0) shotWarningTimer -= dt;
        if (shotTimer >= shotDelay) {
          if (warningTarget) {
            const startAngle = (Math.random() - 0.5) * 0.8;
            const startX = 200 + Math.sin(startAngle) * 250;
            const startY = 750;
            const maxCurve = Math.min(savesCount * 4, 120);
            const tdx = warningTarget.x - startX;
            const tdy = warningTarget.y - startY;
            const dist = Math.sqrt(tdx * tdx + tdy * tdy);
            const speed = shotSpeed + Math.random() * 40;
            activeBall = {
              x: startX, y: startY, startX, startY,
              targetX: warningTarget.x, targetY: warningTarget.y,
              progress: 0, speed: speed / dist,
              curve: (Math.random() - 0.5) * maxCurve,
              radius: 16, rotation: 0,
              spinRate: (Math.random() - 0.5) * 12,
              scale: 0.4, shadow: 0.3,
            };
            engine.sound.throw();
          }
          warningTarget = null;
          shotTimer = 0;
        }
      }

      // Update ball
      if (activeBall) {
        activeBall.progress += activeBall.speed * dt;
        if (activeBall.progress >= 0.85 && activeBall.progress < 1.0) {
          if (checkSave(engine)) {
            onSave(engine);
            return;
          }
        }
        if (activeBall.progress >= 1.0) {
          onGoal(engine);
        }
      }
    },

    onDraw(ctx, engine) {
      drawField(ctx, engine);
      drawGoal(ctx);
      drawShotWarning(ctx, engine);
      drawBall(ctx, engine);
      drawKeeper(ctx, engine);
      drawInstruction(ctx, engine);
      drawDangerVignette(ctx);
    },
  });

  game.start();
  return game;
}
